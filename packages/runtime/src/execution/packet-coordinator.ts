import { canonicalJson, hashFramedDomain, type ContentHash, type ExecutionCapsule, type ExecutionPlan, type RiskClass, type StateDigest, type WorkPacket } from "@projector/core";

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare);

export interface AuthenticatedPacketExecution {
  readonly value: {
    readonly plan: ExecutionPlan;
    readonly packets: readonly { readonly packet: WorkPacket; readonly capsule: ExecutionCapsule; readonly packetHash: ContentHash; readonly capsuleHash: ContentHash }[];
    readonly executionOrder: readonly string[];
    readonly approval: { readonly planHash: ContentHash; readonly approvedRiskClass: RiskClass; readonly authorityProofHash: ContentHash };
  };
  readonly contentHash: ContentHash;
}

export interface PacketObservation { readonly state: StateDigest; readonly paths: readonly string[]; readonly unitIds: readonly string[]; readonly externalIds?: readonly string[]; readonly generatedIds?: readonly string[] }
export interface PacketValidationProof { readonly validatorId: string; readonly validatorVersion: string; readonly invocationHash: ContentHash; readonly postStateHash: ContentHash; readonly status: "passed" | "failed" | "blocked" | "skipped"; readonly independent: boolean }
export interface PacketContinuation { readonly packetId: string; readonly capsuleHash: ContentHash; readonly currentState: StateDigest; readonly authorityProofHash: ContentHash; readonly contentHash: ContentHash }
export interface PacketExecutionArtifact { readonly planId: string; readonly packetId: string; readonly packetHash: ContentHash; readonly capsuleHash: ContentHash; readonly before: PacketObservation; readonly after: PacketObservation; readonly changedPaths: readonly string[]; readonly outputHash: ContentHash; readonly validationProofs: readonly PacketValidationProof[]; readonly currentnessProofHash: ContentHash }

export interface PacketExecutionPorts {
  readonly lease: { acquire(planId: string): Promise<{ assertOwned(): Promise<void>; release(): Promise<void> }> };
  readonly currentness: { validate(input: { packet: WorkPacket; capsule: ExecutionCapsule; predecessorOutputHashes: readonly ContentHash[] }): Promise<{ currentState: StateDigest; valid: boolean; proofHash: ContentHash }> };
  readonly transaction: { begin(input: { plan: ExecutionPlan; packet: WorkPacket; currentState: StateDigest }): Promise<{ apply(): Promise<void>; commit(): Promise<void>; rollback(): Promise<void> }> };
  readonly effect: { run(input: { packet: WorkPacket; capsule: ExecutionCapsule }): Promise<{ claimedChangedPaths: readonly string[]; outputHash: ContentHash }> };
  readonly observe: { capture(input: { packet: WorkPacket; phase: "before" | "after" }): Promise<PacketObservation> };
  readonly validate: { run(input: { packet: WorkPacket; capsule: ExecutionCapsule; postState: StateDigest }): Promise<readonly PacketValidationProof[]> };
  readonly artifacts: { put(artifact: PacketExecutionArtifact): Promise<{ contentHash: ContentHash; replayed: boolean }> };
  readonly continuation?: { read(packetId: string): Promise<PacketContinuation | undefined> };
}

export interface PacketExecutionResult { readonly status: "completed"; readonly packetResults: readonly { readonly packetId: string; readonly changedPaths: readonly string[]; readonly outputHash: ContentHash; readonly artifactHash: ContentHash }[] }

const selectorRoot = (value: string): string => value.replace(/\\/gu, "/").replace(/^\.\//u, "").replace(/\/\*\*.*$/u, "").replace(/\*.*$/u, "").replace(/\/+$/u, "");
const selectorAllows = (selector: ExecutionCapsule["allowedWrites"][number]["selector"], path: string): boolean => {
  if (selector.op !== "atom" || selector.field !== "path" || typeof selector.value !== "string") return false;
  const normalized = path.replace(/\\/gu, "/").replace(/^\.\//u, "");
  return selector.matcher === "equals" ? normalized === selector.value : normalized === selectorRoot(selector.value) || normalized.startsWith(`${selectorRoot(selector.value)}/`);
};
const changedPaths = (before: PacketObservation, after: PacketObservation): string[] => unique([...before.paths.filter((path) => !after.paths.includes(path)), ...after.paths.filter((path) => !before.paths.includes(path))]);

function authenticate(input: AuthenticatedPacketExecution): Map<string, AuthenticatedPacketExecution["value"]["packets"][number]> {
  if (input.contentHash !== hashFramedDomain("authenticated-packet-execution", input.value)) throw new Error("packet execution envelope is unauthenticated");
  if (input.value.approval.planHash !== hashFramedDomain("semantic-change-execution-plan", input.value.plan)) throw new Error("plan approval does not bind this plan");
  if (input.value.approval.approvedRiskClass !== input.value.packets.reduce<RiskClass>((risk, item) => risk > item.packet.risk.class ? risk : item.packet.risk.class, "R0")) throw new Error("approved risk does not match packet risk");
  const byId = new Map<string, AuthenticatedPacketExecution["value"]["packets"][number]>();
  for (const item of input.value.packets) {
    if (item.packetHash !== hashFramedDomain("semantic-change-work-packet", item.packet) || item.capsuleHash !== hashFramedDomain("semantic-change-execution-capsule", item.capsule)) throw new Error("packet or capsule hash mismatch");
    if (item.packet.planId !== input.value.plan.id || item.packet.capsuleId !== item.capsule.id || item.capsule.taskId !== item.packet.id || item.packet.boundState.dependencyDigest !== input.value.plan.boundState.dependencyDigest) throw new Error("packet relation or binding mismatch");
    if (byId.has(item.packet.id)) throw new Error(`duplicate packet ${item.packet.id}`);
    byId.set(item.packet.id, item);
  }
  if (unique(input.value.executionOrder).length !== input.value.executionOrder.length || canonicalJson(unique(input.value.executionOrder)) !== canonicalJson(unique(input.value.plan.packetIds))) throw new Error("execution order does not cover the plan exactly");
  for (const id of input.value.executionOrder) for (const dependency of byId.get(id)?.packet.dependencies ?? []) if (input.value.executionOrder.indexOf(dependency) >= input.value.executionOrder.indexOf(id)) throw new Error("packet dependency SCC or order is unsafe");
  const items = [...byId.values()];
  for (let left = 0; left < items.length; left += 1) for (let right = left + 1; right < items.length; right += 1) {
    const a = items[left]!.capsule.allowedWrites; const b = items[right]!.capsule.allowedWrites;
    const roots = (grants: ExecutionCapsule["allowedWrites"]): string[] => grants.flatMap(({ selector }) => selector.op === "atom" && selector.field === "path" && typeof selector.value === "string" ? [selectorRoot(selector.value)] : []);
    const leftRoots = roots(a); const rightRoots = roots(b);
    if (leftRoots.some((root) => rightRoots.includes(root))) throw new Error("packet write selectors overlap");
  }
  return byId;
}

export async function executePacketPlan(input: AuthenticatedPacketExecution, ports: PacketExecutionPorts): Promise<PacketExecutionResult> {
  const byId = authenticate(input);
  const lease = await ports.lease.acquire(input.value.plan.id);
  const outputs = new Map<string, ContentHash>();
  const results: Array<PacketExecutionResult["packetResults"][number]> = [];
  try {
    for (const packetId of input.value.executionOrder) {
      const item = byId.get(packetId)!;
      if (item.packet.executionMode !== "deterministic") {
        const continuation = await ports.continuation?.read(packetId);
        if (continuation === undefined || continuation.packetId !== packetId || continuation.capsuleHash !== item.capsuleHash || continuation.contentHash !== hashFramedDomain("authenticated-packet-continuation", { packetId: continuation.packetId, capsuleHash: continuation.capsuleHash, currentState: continuation.currentState, authorityProofHash: continuation.authorityProofHash })) throw new Error(`authenticated continuation required for ${packetId}`);
      }
      await lease.assertOwned();
      const predecessorOutputHashes = item.packet.dependencies.map((id) => outputs.get(id)).filter((hash): hash is ContentHash => hash !== undefined);
      if (predecessorOutputHashes.length !== item.packet.dependencies.length) throw new Error(`missing predecessor output for ${packetId}`);
      const currentness = await ports.currentness.validate({ packet: item.packet, capsule: item.capsule, predecessorOutputHashes });
      if (!currentness.valid) throw new Error(`packet ${packetId} is stale`);
      const before = await ports.observe.capture({ packet: item.packet, phase: "before" });
      const transaction = await ports.transaction.begin({ plan: input.value.plan, packet: item.packet, currentState: currentness.currentState });
      try {
        await lease.assertOwned();
        await transaction.apply();
        const effect = await ports.effect.run({ packet: item.packet, capsule: item.capsule });
        const after = await ports.observe.capture({ packet: item.packet, phase: "after" });
        const authoritativePaths = changedPaths(before, after);
        if (authoritativePaths.some((path) => !item.capsule.allowedWrites.some(({ selector }) => selectorAllows(selector, path)))) throw new Error(`packet ${packetId} widened write scope`);
        const validationProofs = [...await ports.validate.run({ packet: item.packet, capsule: item.capsule, postState: after.state })];
        const proofIds = new Set<string>(); const postStateHash = hashFramedDomain("packet-post-state", after.state);
        for (const proof of validationProofs) {
          const key = `${proof.validatorId}@${proof.validatorVersion}`;
          if (proofIds.has(key)) throw new Error(`duplicate validator proof ${key}`);
          proofIds.add(key);
          if (proof.status !== "passed" || proof.postStateHash !== postStateHash || proof.invocationHash !== hashFramedDomain("packet-validator-invocation", { packetId, validatorId: proof.validatorId, validatorVersion: proof.validatorVersion, postStateHash })) throw new Error(`validator ${key} did not prove the packet post-state`);
        }
        if (item.packet.validatorIds.some((id) => !validationProofs.some((proof) => proof.validatorId === id)) || (item.capsule.completionContract.requireIndependentValidation && !validationProofs.some(({ independent }) => independent))) throw new Error("required validator or independent proof is missing");
        const artifact: PacketExecutionArtifact = { planId: input.value.plan.id, packetId, packetHash: item.packetHash, capsuleHash: item.capsuleHash, before, after, changedPaths: authoritativePaths, outputHash: effect.outputHash, validationProofs, currentnessProofHash: currentness.proofHash };
        await lease.assertOwned();
        const stored = await ports.artifacts.put(artifact);
        if (stored.contentHash !== hashFramedDomain("packet-execution-artifact", artifact)) throw new Error("artifact store did not durably bind the execution result");
        await lease.assertOwned();
        await transaction.commit();
        outputs.set(packetId, effect.outputHash);
        results.push({ packetId, changedPaths: authoritativePaths, outputHash: effect.outputHash, artifactHash: stored.contentHash });
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    }
    return { status: "completed", packetResults: Object.freeze(results) };
  } finally {
    await lease.release();
  }
}
