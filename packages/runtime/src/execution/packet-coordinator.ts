import { canonicalJson, hashFramedDomain, type ContentHash, type ExecutionCapsule, type ExecutionPlan, type RiskClass, type StateDigest, type WorkPacket } from "@projector/core";

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare);

export interface AuthenticatedPacketExecution {
  readonly value: {
    readonly plan: ExecutionPlan;
    readonly packets: readonly { readonly packet: WorkPacket; readonly capsule: ExecutionCapsule; readonly packetHash: ContentHash; readonly capsuleHash: ContentHash; readonly convergence?: { readonly group: string; readonly maximumIterations: number } }[];
    readonly executionOrder: readonly string[];
    readonly approval: { readonly planHash: ContentHash; readonly approvedRiskClass: RiskClass; readonly authorityProofHash: ContentHash };
  };
  readonly contentHash: ContentHash;
}

export interface PacketObservation { readonly state: StateDigest; readonly pathContentHashes: Readonly<Record<string, ContentHash>>; readonly renames: readonly { readonly from: string; readonly to: string }[]; readonly deletedPaths: readonly string[]; readonly unitStates: Readonly<Record<string, "valid" | "removed" | "exception" | "invalid">>; readonly canonicalEntityHashes: Readonly<Record<string, ContentHash>>; readonly externalStateHashes: Readonly<Record<string, ContentHash>>; readonly generatedArtifactHashes: Readonly<Record<string, ContentHash>>; readonly cleanWorkingTree: boolean; readonly unknownCount: number; readonly divergenceCount: number }
export interface AuthenticatedPacketObservation { readonly value: PacketObservation; readonly contentHash: ContentHash }
export interface PacketValidationProof { readonly validatorId: string; readonly validatorVersion: string; readonly invocationHash: ContentHash; readonly postStateHash: ContentHash; readonly provenanceHash: ContentHash; readonly status: "passed" | "failed" | "blocked" | "skipped"; readonly authorSource: string; readonly independenceGroup: string; readonly evidenceLane: string; readonly assurance: "weak" | "supporting" | "strong" | "exact" }
export interface PacketContinuation { readonly packetId: string; readonly capsuleHash: ContentHash; readonly currentState: StateDigest; readonly authorityProofHash: ContentHash; readonly contentHash: ContentHash }
export interface PacketExecutionArtifact { readonly status: "intent" | "success" | "failure"; readonly planId: string; readonly packetId: string; readonly packetHash: ContentHash; readonly capsuleHash: ContentHash; readonly before: PacketObservation; readonly after?: PacketObservation; readonly changedPaths: readonly string[]; readonly outputHash?: ContentHash; readonly validationProofs: readonly PacketValidationProof[]; readonly currentnessProofHash: ContentHash; readonly lastCheckpoint?: string; readonly recovery: "not-required" | "rolled-back" | "required"; readonly reason?: string }

export interface PacketExecutionPorts {
  readonly lease: { acquire(planId: string): Promise<{ assertOwned(): Promise<void>; release(): Promise<void> }> };
  readonly authority: { verify(input: { readonly approval: AuthenticatedPacketExecution["value"]["approval"]; readonly subjectHash: ContentHash; readonly currentState: StateDigest; readonly risk: RiskClass }): Promise<boolean> };
  readonly currentness: { validate(input: { packet: WorkPacket; capsule: ExecutionCapsule; predecessorOutputHashes: readonly ContentHash[] }): Promise<{ currentState: StateDigest; valid: boolean; proofHash: ContentHash }> };
  readonly transaction: { begin(input: { plan: ExecutionPlan; packet: WorkPacket; currentState: StateDigest }): Promise<{ apply(): Promise<void>; commit(): Promise<void>; rollback(): Promise<void> }> };
  readonly effect: { run(input: { packet: WorkPacket; capsule: ExecutionCapsule }): Promise<{ claimedChangedPaths: readonly string[]; outputHash: ContentHash; authorSource?: string }> };
  readonly observe: { capture(input: { packet: WorkPacket; phase: "before" | "after" }): Promise<AuthenticatedPacketObservation> };
  readonly validate: { run(input: { packet: WorkPacket; capsule: ExecutionCapsule; postState: StateDigest }): Promise<readonly PacketValidationProof[]> };
  readonly artifacts: { put(artifact: PacketExecutionArtifact): Promise<{ contentHash: ContentHash; replayed: boolean }> };
  readonly continuation?: { read(packetId: string): Promise<PacketContinuation | undefined> };
}

export interface PacketExecutionResult { readonly status: "completed" | "partial"; readonly packetResults: readonly { readonly packetId: string; readonly changedPaths: readonly string[]; readonly outputHash: ContentHash; readonly artifactHash: ContentHash }[]; readonly certificateHash: ContentHash; readonly receiptHash?: ContentHash; readonly reconciliation: { readonly converged: boolean; readonly iterations: number }; readonly observedImpact: { readonly changedPaths: readonly string[]; readonly changedUnitIds: readonly string[] }; readonly surprises: readonly string[]; readonly lastCheckpoint?: string; readonly recovery: "not-required" | "rolled-back" | "required" }

const selectorRoot = (value: string): string => value.replace(/\\/gu, "/").replace(/^\.\//u, "").replace(/\/\*\*.*$/u, "").replace(/\*.*$/u, "").replace(/\/+$/u, "");
const selectorAllows = (selector: ExecutionCapsule["allowedWrites"][number]["selector"], path: string): boolean => {
  if (selector.op !== "atom" || selector.field !== "path" || typeof selector.value !== "string") return false;
  const normalized = path.replace(/\\/gu, "/").replace(/^\.\//u, "");
  return selector.matcher === "equals" ? normalized === selector.value : normalized === selectorRoot(selector.value) || normalized.startsWith(`${selectorRoot(selector.value)}/`);
};
function authenticateObservation(observed: AuthenticatedPacketObservation): PacketObservation {
  if (observed.contentHash !== hashFramedDomain("authenticated-packet-observation", observed.value)) throw new Error("packet observation is unauthenticated");
  return observed.value;
}
const changedPaths = (before: PacketObservation, after: PacketObservation): string[] => unique([...Object.keys(before.pathContentHashes), ...Object.keys(after.pathContentHashes)].filter((path) => before.pathContentHashes[path] !== after.pathContentHashes[path]).concat(after.renames.flatMap(({ from, to }) => [from, to]), after.deletedPaths));

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
  for (const id of input.value.executionOrder) for (const dependency of byId.get(id)?.packet.dependencies ?? []) if (input.value.executionOrder.indexOf(dependency) >= input.value.executionOrder.indexOf(id)) {
    const current = byId.get(id)?.convergence; const prior = byId.get(dependency)?.convergence;
    if (current === undefined || prior === undefined || current.group !== prior.group || current.maximumIterations !== prior.maximumIterations || current.maximumIterations < 1) throw new Error("packet dependency SCC or order is unsafe");
  }
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
  let totalIterations = 0;
  const resultFor = (status: "completed" | "partial", recovery: PacketExecutionResult["recovery"], surprises: readonly string[] = []): PacketExecutionResult => {
    const changed = unique(results.flatMap(({ changedPaths: paths }) => paths));
    const changedUnitIds = unique(results.flatMap(({ packetId }) => byId.get(packetId)?.packet.unitIds ?? []));
    const certificateHash = hashFramedDomain("packet-plan-certificate", { planHash: input.value.approval.planHash, status, results, recovery, surprises });
    const receiptRequired = input.value.plan.completionCriteria.requiredArtifacts.includes("receipt");
    return { status, packetResults: Object.freeze([...results]), certificateHash, ...(receiptRequired ? { receiptHash: hashFramedDomain("packet-plan-receipt", { certificateHash, planId: input.value.plan.id }) } : {}), reconciliation: { converged: status === "completed", iterations: totalIterations }, observedImpact: { changedPaths: changed, changedUnitIds }, surprises: Object.freeze([...surprises]), ...(results.length === 0 ? {} : { lastCheckpoint: `checkpoint:${results.at(-1)!.packetId}` }), recovery };
  };
  const executeOne = async (packetId: string): Promise<void> => {
    const item = byId.get(packetId)!;
    if (item.packet.executionMode !== "deterministic") {
      const continuation = await ports.continuation?.read(packetId);
      if (continuation === undefined || continuation.packetId !== packetId || continuation.capsuleHash !== item.capsuleHash || continuation.contentHash !== hashFramedDomain("authenticated-packet-continuation", { packetId: continuation.packetId, capsuleHash: continuation.capsuleHash, currentState: continuation.currentState, authorityProofHash: continuation.authorityProofHash })) throw new Error(`authenticated continuation required for ${packetId}`);
    }
    await lease.assertOwned();
    const predecessorOutputHashes = item.packet.dependencies.map((id) => outputs.get(id)).filter((hash): hash is ContentHash => hash !== undefined);
    const missing = item.packet.dependencies.filter((id) => !outputs.has(id));
    if (missing.some((id) => byId.get(id)?.convergence?.group !== item.convergence?.group)) throw new Error(`missing predecessor output for ${packetId}`);
    const currentness = await ports.currentness.validate({ packet: item.packet, capsule: item.capsule, predecessorOutputHashes });
    if (!currentness.valid) throw new Error(`packet ${packetId} is stale`);
    if (!(await ports.authority.verify({ approval: input.value.approval, subjectHash: input.value.approval.planHash, currentState: currentness.currentState, risk: item.packet.risk.class }))) throw new Error("plan approval lacks current authority");
    const before = authenticateObservation(await ports.observe.capture({ packet: item.packet, phase: "before" }));
    const transaction = await ports.transaction.begin({ plan: input.value.plan, packet: item.packet, currentState: currentness.currentState });
    let intent: PacketExecutionArtifact | undefined;
    try {
      await lease.assertOwned();
      await transaction.apply();
      const effect = await ports.effect.run({ packet: item.packet, capsule: item.capsule });
      const after = authenticateObservation(await ports.observe.capture({ packet: item.packet, phase: "after" }));
      const authoritativePaths = changedPaths(before, after);
      const inPlanBoundary = (path: string): boolean => input.value.plan.boundary.some((boundary) => selectorRoot(path) === selectorRoot(boundary) || selectorRoot(path).startsWith(`${selectorRoot(boundary)}/`));
      if (authoritativePaths.some((path) => !inPlanBoundary(path) || !item.capsule.allowedWrites.some(({ selector }) => selectorAllows(selector, path)) || item.capsule.forbiddenWrites.some(({ selector }) => selectorAllows(selector, path)))) throw new Error(`packet ${packetId} widened plan/capsule scope`);
      const changedRecordKeys = (left: Readonly<Record<string, unknown>>, right: Readonly<Record<string, unknown>>): string[] => unique([...Object.keys(left), ...Object.keys(right)].filter((key) => canonicalJson(left[key]) !== canonicalJson(right[key])));
      const changedUnits = changedRecordKeys(before.unitStates, after.unitStates);
      if (changedUnits.some((id) => !item.packet.unitIds.includes(id))) throw new Error(`packet ${packetId} changed an undeclared unit`);
      for (const [kind, left, right] of [["canonical", before.canonicalEntityHashes, after.canonicalEntityHashes], ["external", before.externalStateHashes, after.externalStateHashes], ["generated", before.generatedArtifactHashes, after.generatedArtifactHashes]] as const) if (changedRecordKeys(left, right).some((id) => !item.packet.unitIds.includes(id))) throw new Error(`packet ${packetId} changed undeclared ${kind} state`);
      const validationProofs = [...await ports.validate.run({ packet: item.packet, capsule: item.capsule, postState: after.state })];
      const proofIds = new Set<string>(); const postStateHash = hashFramedDomain("packet-post-state", after.state);
      for (const proof of validationProofs) {
        const key = `${proof.validatorId}@${proof.validatorVersion}`;
        if (proofIds.has(key)) throw new Error(`duplicate validator proof ${key}`);
        proofIds.add(key);
        const provenanceHash = hashFramedDomain("packet-validator-provenance", { validatorId: proof.validatorId, validatorVersion: proof.validatorVersion, authorSource: proof.authorSource, independenceGroup: proof.independenceGroup, evidenceLane: proof.evidenceLane, assurance: proof.assurance });
        if (proof.provenanceHash !== provenanceHash || proof.status !== "passed" || proof.postStateHash !== postStateHash || proof.invocationHash !== hashFramedDomain("packet-validator-invocation", { packetId, validatorId: proof.validatorId, validatorVersion: proof.validatorVersion, postStateHash, provenanceHash })) throw new Error(`validator ${key} did not prove the packet post-state`);
      }
      const contract = item.capsule.completionContract; const assuranceRank = ["weak", "supporting", "strong", "exact"];
      if (item.packet.validatorIds.some((id) => !validationProofs.some((proof) => proof.validatorId === id)) || contract.requiredValidators.some((id) => !validationProofs.some((proof) => proof.validatorId === id))) throw new Error("required validator is missing");
      if (contract.requireIndependentValidation && !validationProofs.some((proof) => proof.authorSource !== (effect.authorSource ?? "effect") && proof.independenceGroup !== (effect.authorSource ?? "effect"))) throw new Error("independent validation provenance is missing");
      if (contract.requiredEvidenceLanes.some((lane) => !validationProofs.some((proof) => proof.evidenceLane === lane)) || validationProofs.every((proof) => assuranceRank.indexOf(proof.assurance) < assuranceRank.indexOf(contract.minimumValidationAssurance))) throw new Error("completion evidence lane or assurance is insufficient");
      if (contract.requiredUnitStates.some(({ unitId, state }) => after.unitStates[unitId] !== state) || after.unknownCount > contract.maximumUnknowns || after.divergenceCount > contract.maximumNewDivergences || (contract.cleanWorkingTree && !after.cleanWorkingTree)) throw new Error("completion contract is not satisfied by observed post-state");
      intent = { status: "intent", planId: input.value.plan.id, packetId, packetHash: item.packetHash, capsuleHash: item.capsuleHash, before, after, changedPaths: authoritativePaths, outputHash: effect.outputHash, validationProofs, currentnessProofHash: currentness.proofHash, recovery: "required" };
      await lease.assertOwned();
      const storedIntent = await ports.artifacts.put(intent);
      if (storedIntent.contentHash !== hashFramedDomain("packet-execution-artifact", intent)) throw new Error("artifact intent was not durably bound");
      await lease.assertOwned();
      await transaction.commit();
      const success: PacketExecutionArtifact = { ...intent, status: "success", recovery: "not-required", lastCheckpoint: `checkpoint:${packetId}` };
      const stored = await ports.artifacts.put(success);
      if (stored.contentHash !== hashFramedDomain("packet-execution-artifact", success)) throw new Error("success certificate was not durably bound");
      outputs.set(packetId, effect.outputHash);
      const priorIndex = results.findIndex(({ packetId: id }) => id === packetId);
      const row = { packetId, changedPaths: authoritativePaths, outputHash: effect.outputHash, artifactHash: stored.contentHash };
      if (priorIndex < 0) results.push(row); else results[priorIndex] = row;
    } catch (error) {
      let recovery: PacketExecutionResult["recovery"] = "rolled-back";
      try { await transaction.rollback(); } catch { recovery = "required"; }
      const failure: PacketExecutionArtifact = { ...(intent ?? { status: "failure", planId: input.value.plan.id, packetId, packetHash: item.packetHash, capsuleHash: item.capsuleHash, before, changedPaths: [], validationProofs: [], currentnessProofHash: currentness.proofHash }), status: "failure", recovery, reason: error instanceof Error ? error.message : String(error), ...(results.length === 0 ? {} : { lastCheckpoint: `checkpoint:${results.at(-1)!.packetId}` }) };
      const storedFailure = await ports.artifacts.put(failure);
      if (storedFailure.contentHash !== hashFramedDomain("packet-execution-artifact", failure)) recovery = "required";
      throw Object.assign(error instanceof Error ? error : new Error(String(error)), { packetFailure: true, recovery });
    }
  };
  try {
    const handledGroups = new Set<string>();
    for (const packetId of input.value.executionOrder) {
      const convergence = byId.get(packetId)?.convergence;
      if (convergence === undefined) { totalIterations += 1; await executeOne(packetId); continue; }
      if (handledGroups.has(convergence.group)) continue;
      handledGroups.add(convergence.group);
      const members = input.value.executionOrder.filter((id) => byId.get(id)?.convergence?.group === convergence.group);
      let prior: string | undefined; let converged = false;
      for (let iteration = 1; iteration <= convergence.maximumIterations; iteration += 1) {
        totalIterations += 1;
        for (const member of members) await executeOne(member);
        const current = canonicalJson(members.map((id) => outputs.get(id)));
        if (current === prior) { converged = true; break; }
        prior = current;
      }
      if (!converged) throw new Error(`convergence group ${convergence.group} did not converge within its bound`);
    }
    return resultFor("completed", "not-required");
  } catch (error) {
    if (results.length > 0 || (error instanceof Error && "packetFailure" in error)) return resultFor("partial", (error as { recovery?: PacketExecutionResult["recovery"] }).recovery ?? "required", [error instanceof Error ? error.message : String(error)]);
    throw error;
  } finally {
    await lease.release();
  }
}
