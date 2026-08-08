import { canonicalJson, hashFramedDomain, type ContentHash, type EntityId, type ExecutionPlan, type StateBinding, type StateBindingValidation } from "@projector/core";
import { createExecutionPlan } from "./index.js";
import { createStateBinding } from "../state/index.js";

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare);

export interface PlanRevisionStore {
  get(id: EntityId): Promise<Readonly<ExecutionPlan> | undefined>;
  put(plan: Readonly<ExecutionPlan>): Promise<void>;
}

export class InMemoryPlanRevisionStore implements PlanRevisionStore {
  private readonly plans = new Map<EntityId, Readonly<ExecutionPlan>>();
  async get(id: EntityId): Promise<Readonly<ExecutionPlan> | undefined> {
    const plan = this.plans.get(id);
    return plan === undefined ? undefined : deepFreeze(structuredClone(plan));
  }
  async put(plan: Readonly<ExecutionPlan>): Promise<void> {
    const prior = this.plans.get(plan.id);
    if (prior !== undefined && canonicalJson(prior) !== canonicalJson(plan)) throw new Error(`plan revision ${plan.id} already exists with different content`);
    this.plans.set(plan.id, deepFreeze(structuredClone(plan)));
  }
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export interface RecompiledPlanFields {
  readonly boundState?: StateBinding;
  readonly boundary?: readonly string[];
  readonly packetIds?: readonly EntityId[];
  readonly assumptions?: readonly string[];
  readonly relevanceClosureId?: EntityId;
  readonly predictedImpactClosureHash?: ContentHash;
  readonly knownAffectedUnitIds?: readonly EntityId[];
  readonly possibleFrontierUnitIds?: readonly EntityId[];
  readonly unavailableSurfaceIds?: readonly EntityId[];
  readonly completionCriteria?: ExecutionPlan["completionCriteria"];
  readonly packetHashes?: readonly PacketHashProof[];
  readonly recompiledCapsules?: readonly CapsuleProof[];
  readonly checkpoints?: ExecutionPlan["checkpoints"];
}

export interface RebaseExecutionPlanInput {
  readonly original: Readonly<ExecutionPlan>;
  readonly validation: StateBindingValidation;
  readonly completedPackets: readonly EntityId[];
  readonly isCompletedPacketCurrent: (packetId: EntityId) => Promise<boolean>;
  readonly recompile: () => Promise<RecompiledPlanFields>;
  readonly originalPacketHashes?: readonly PacketHashProof[];
  readonly authenticateOriginalPacketHash?: (packetId: EntityId, packetHash: ContentHash) => Promise<boolean>;
  readonly capsuleInventory?: readonly CapsuleInventoryEntry[];
}

export interface PacketHashProof { readonly packetId: EntityId; readonly packetHash: ContentHash }
export interface CapsuleProof extends PacketHashProof {
  readonly capsuleId: EntityId;
  readonly capsuleHash: ContentHash;
  readonly boundState: StateBinding;
  readonly approvalIds: readonly EntityId[];
}
export interface NoCapsuleProof extends PacketHashProof { readonly noCapsuleProof: ContentHash }
export type CapsuleInventoryEntry = CapsuleProof | NoCapsuleProof;

export interface RebasedExecutionPlan {
  readonly kind: "lightweight-rebind" | "semantic-rebase";
  readonly plan: Readonly<ExecutionPlan>;
  readonly carriedCompletedPacketIds: EntityId[];
  readonly invalidatedPacketIds: EntityId[];
  readonly invalidatedApprovalPlanIds: EntityId[];
  readonly invalidatedApprovalIds: EntityId[];
  readonly invalidatedCapsuleIds: EntityId[];
  readonly recompiledCapsuleIds: EntityId[];
  readonly oldCapsuleMapping: readonly CapsuleInventoryEntry[];
  readonly newCapsuleMapping: readonly CapsuleProof[];
}

export const capsuleProofHash = (proof: Omit<CapsuleProof, "capsuleHash">): ContentHash => hashFramedDomain("rebase-capsule-proof", { ...proof, approvalIds: unique(proof.approvalIds) });
export const noCapsuleProofHash = (proof: PacketHashProof): ContentHash => hashFramedDomain("rebase-no-capsule-proof", proof);
function packetHashMap(proofs: readonly PacketHashProof[], expectedPacketIds: readonly EntityId[], label: string): Map<EntityId, ContentHash> {
  if (proofs.length === 0 || new Set(proofs.map(({ packetId }) => packetId)).size !== proofs.length
    || canonicalJson(unique(proofs.map(({ packetId }) => packetId))) !== canonicalJson(unique(expectedPacketIds))) {
    throw new Error(`${label} packet hash inventory must prove every packet exactly once`);
  }
  return new Map(proofs.map(({ packetId, packetHash }) => [packetId, packetHash]));
}
function validateCapsuleProof(proof: CapsuleProof, expectedPacketHash: ContentHash, expectedBinding: StateBinding, label: string): void {
  if (proof.packetHash !== expectedPacketHash) throw new Error(`${label} capsule is not bound to the authenticated packet hash`);
  const rebuilt = createStateBinding({ compiledAgainst: proof.boundState.compiledAgainst, valueDependencies: proof.boundState.valueDependencies, queryDependencies: proof.boundState.queryDependencies });
  if (rebuilt.dependencyDigest !== proof.boundState.dependencyDigest || canonicalJson(proof.boundState) !== canonicalJson(expectedBinding)) {
    throw new Error(`${label} capsule is not bound to the required plan state`);
  }
  if (new Set(proof.approvalIds).size !== proof.approvalIds.length) throw new Error(`${label} capsule approval inventory contains duplicate identities`);
  if (proof.capsuleHash !== capsuleProofHash({ packetId: proof.packetId, packetHash: proof.packetHash, capsuleId: proof.capsuleId, boundState: proof.boundState, approvalIds: proof.approvalIds })) {
    throw new Error(`${label} capsule identity is not cryptographically proven`);
  }
}

export async function rebaseExecutionPlan(input: RebaseExecutionPlanInput): Promise<RebasedExecutionPlan> {
  if (input.validation.status === "unavailable") throw new Error("plan cannot be safely rebased from unavailable state");
  const lightweight = input.validation.status === "current" || input.validation.status === "rebound";
  if (input.validation.status === "rebound" && input.validation.rebound === undefined) throw new Error("lightweight rebind requires a validated rebound binding");
  const rebound = input.validation.status === "current"
    ? createStateBinding({ compiledAgainst: input.validation.currentState, valueDependencies: input.original.boundState.valueDependencies, queryDependencies: input.original.boundState.queryDependencies })
    : input.validation.rebound!;
  const recomputed = lightweight ? {} : await input.recompile();
  if (!lightweight && input.capsuleInventory === undefined) throw new Error("semantic rebase requires an explicit old capsule inventory");
  if (!lightweight && recomputed.boundState === undefined) throw new Error("semantic rebase must provide a recomputed state binding");
  if (!lightweight && (recomputed.boundary === undefined || recomputed.packetIds === undefined || recomputed.assumptions === undefined
    || recomputed.relevanceClosureId === undefined || recomputed.predictedImpactClosureHash === undefined
    || recomputed.knownAffectedUnitIds === undefined || recomputed.possibleFrontierUnitIds === undefined
    || recomputed.unavailableSurfaceIds === undefined || recomputed.completionCriteria === undefined
    || recomputed.checkpoints === undefined || recomputed.packetHashes === undefined || recomputed.recompiledCapsules === undefined)) {
    throw new Error("semantic rebase requires complete semantic recomputation of scope, packets, assumptions, closures, affected/frontier/unavailable units, checkpoints, completion, and capsules");
  }
  const nextBinding = recomputed.boundState ?? rebound;
  if (canonicalJson(nextBinding.compiledAgainst) !== canonicalJson(input.validation.currentState)) {
    throw new Error("rebased plan binding must compile against the validated current state");
  }
  const validatedBinding = createStateBinding({ compiledAgainst: nextBinding.compiledAgainst, valueDependencies: nextBinding.valueDependencies, queryDependencies: nextBinding.queryDependencies });
  if (validatedBinding.dependencyDigest !== nextBinding.dependencyDigest) throw new Error("rebased plan binding has an invalid dependency digest");
  const nextPacketIds = recomputed.packetIds ?? input.original.packetIds;
  if (!lightweight) {
    if (input.originalPacketHashes === undefined) throw new Error("semantic rebase requires authenticated original packet hashes");
    if (input.authenticateOriginalPacketHash === undefined) throw new Error("semantic rebase requires a trusted original packet hash authenticator");
    const oldPacketHashes = packetHashMap(input.originalPacketHashes, input.original.packetIds, "original");
    for (const { packetId, packetHash } of input.originalPacketHashes) {
      if (!await input.authenticateOriginalPacketHash(packetId, packetHash)) throw new Error(`original packet hash could not be authenticated: ${packetId}`);
    }
    const oldInventory = input.capsuleInventory!;
    if (oldInventory.length === 0 || new Set(oldInventory.map(({ packetId }) => packetId)).size !== oldInventory.length
      || canonicalJson(unique(oldInventory.map(({ packetId }) => packetId))) !== canonicalJson(unique(input.original.packetIds))) {
      throw new Error("old capsule inventory must account for every original packet exactly once");
    }
    const oldCapsules = oldInventory.filter((entry): entry is CapsuleProof => "capsuleId" in entry);
    if (new Set(oldCapsules.map(({ capsuleId }) => capsuleId)).size !== oldCapsules.length
      || new Set(oldCapsules.flatMap(({ approvalIds = [] }) => approvalIds)).size !== oldCapsules.flatMap(({ approvalIds = [] }) => approvalIds).length) {
      throw new Error("old capsule or approval identities alias across packets");
    }
    for (const entry of oldInventory) {
      const expectedHash = oldPacketHashes.get(entry.packetId)!;
      if ("capsuleId" in entry) validateCapsuleProof(entry, expectedHash, input.original.boundState, "old");
      else if (entry.packetHash !== expectedHash || entry.noCapsuleProof !== noCapsuleProofHash({ packetId: entry.packetId, packetHash: entry.packetHash })) throw new Error("old no-capsule claim is not proven");
    }
    const newCapsules = recomputed.recompiledCapsules!;
    const newPacketHashes = packetHashMap(recomputed.packetHashes!, nextPacketIds, "recompiled");
    if (new Set(newCapsules.map(({ packetId }) => packetId)).size !== newCapsules.length
      || canonicalJson(unique(newCapsules.map(({ packetId }) => packetId))) !== canonicalJson(unique(nextPacketIds))) {
      throw new Error("semantic rebase must recompile exactly one capsule for every recomputed packet");
    }
    if (new Set(newCapsules.map(({ capsuleId }) => capsuleId)).size !== newCapsules.length
      || newCapsules.some(({ capsuleId }) => oldCapsules.some((old) => old.capsuleId === capsuleId))) {
      throw new Error("recompiled capsule identities must be unique and must not alias stale capsules");
    }
    for (const capsule of newCapsules) validateCapsuleProof(capsule, newPacketHashes.get(capsule.packetId)!, validatedBinding, "recompiled");
  }
  const carried: EntityId[] = [];
  for (const packetId of unique(input.completedPackets)) {
    if (nextPacketIds.includes(packetId) && await input.isCompletedPacketCurrent(packetId)) carried.push(packetId);
  }
  const invalidated = lightweight ? unique(input.completedPackets).filter((id) => !carried.includes(id)) : unique(input.original.packetIds.filter((id) => !carried.includes(id)));
  const revision = input.original.revision + 1;
  const { recompiledCapsules = [], packetHashes: _packetHashes, ...planFields } = recomputed;
  const fields = {
    ...input.original,
    ...planFields,
    revision,
    supersedesPlanId: input.original.id,
    boundState: validatedBinding,
    packetIds: recomputed.packetIds ?? input.original.packetIds,
    assumptions: recomputed.assumptions ?? input.original.assumptions,
  };
  const identity = hashFramedDomain("execution-plan-revision-id", { ...fields, id: undefined });
  const plan = createExecutionPlan({ ...fields, id: `plan:${identity}` });
  const oldCapsuleMapping = [...(input.capsuleInventory ?? [])].sort((a, b) => compare(a.packetId, b.packetId));
  const newCapsuleMapping = [...recompiledCapsules].sort((a, b) => compare(a.packetId, b.packetId));
  return {
    kind: lightweight ? "lightweight-rebind" : "semantic-rebase", plan,
    carriedCompletedPacketIds: carried, invalidatedPacketIds: invalidated,
    invalidatedApprovalPlanIds: [input.original.id],
    invalidatedApprovalIds: unique(oldCapsuleMapping.flatMap((entry) => "approvalIds" in entry ? entry.approvalIds ?? [] : [])),
    invalidatedCapsuleIds: unique(lightweight
      ? (input.capsuleInventory ?? []).filter((entry): entry is CapsuleProof => "capsuleId" in entry && invalidated.includes(entry.packetId)).map(({ capsuleId }) => capsuleId)
      : input.capsuleInventory!.filter((entry): entry is CapsuleProof => "capsuleId" in entry).map(({ capsuleId }) => capsuleId)),
    recompiledCapsuleIds: unique(recompiledCapsules.map(({ capsuleId }) => capsuleId)),
    oldCapsuleMapping: deepFreeze(structuredClone(oldCapsuleMapping)),
    newCapsuleMapping: deepFreeze(structuredClone(newCapsuleMapping)),
  };
}
