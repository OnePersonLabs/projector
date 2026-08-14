import { canonicalJson, hashFramedDomain, type ContentHash } from "@projector/core";

export const SUBSYSTEM_CLOSURE_STAGES = [
  "authority", "public-composition", "downstream-consumer", "invalidation-recovery",
  "observability", "dogfood", "packed-release",
] as const;
export type SubsystemClosureStage = (typeof SUBSYSTEM_CLOSURE_STAGES)[number];

export interface SubsystemClosureObservation {
  readonly obligationId: string;
  readonly stage: SubsystemClosureStage;
  readonly producer: string;
  readonly entrypoint: string;
  readonly observedOutputHash: ContentHash;
  readonly failureHash: ContentHash;
  readonly severedEdgeRejected: boolean;
}

export interface SubsystemClosureReceipt {
  readonly version: 1;
  readonly subsystemId: string;
  readonly revision: string;
  readonly worktreeDigest: ContentHash;
  readonly observations: readonly SubsystemClosureObservation[];
  readonly receiptHash: ContentHash;
}

function receiptBody(receipt: Omit<SubsystemClosureReceipt, "receiptHash"> | SubsystemClosureReceipt) {
  const { receiptHash: omitted, ...body } = receipt as SubsystemClosureReceipt; void omitted;
  return body;
}

export function createSubsystemClosureReceipt(input: Omit<SubsystemClosureReceipt, "version" | "receiptHash">): Readonly<SubsystemClosureReceipt> {
  const body = { version: 1 as const, ...structuredClone(input), observations: [...input.observations].sort((left, right) => left.obligationId.localeCompare(right.obligationId)) };
  return Object.freeze({ ...body, observations: Object.freeze(body.observations.map((observation) => Object.freeze(observation))), receiptHash: hashFramedDomain("subsystem-closure-receipt:v1", body) });
}

export function evaluateSubsystemClosure(contract: {
  readonly subsystemId: string;
  readonly requiredObligationIds: readonly string[];
  readonly expectedRevision?: string;
  readonly expectedWorktreeDigest?: ContentHash;
}, receipt: SubsystemClosureReceipt): { readonly status: "closed" | "open"; readonly blockers: readonly string[] } {
  const blockers: string[] = [];
  if (receipt.receiptHash !== hashFramedDomain("subsystem-closure-receipt:v1", receiptBody(receipt))) blockers.push("receipt authentication failed");
  if (receipt.subsystemId !== contract.subsystemId) blockers.push("receipt subsystem identity mismatch");
  if (contract.expectedRevision !== undefined && receipt.revision !== contract.expectedRevision) blockers.push("receipt revision is stale");
  if (contract.expectedWorktreeDigest !== undefined && receipt.worktreeDigest !== contract.expectedWorktreeDigest) blockers.push("receipt worktree digest is stale");
  const required = [...new Set(contract.requiredObligationIds)].sort();
  if (required.length !== contract.requiredObligationIds.length) blockers.push("closure contract contains duplicate obligation ids");
  const ids = receipt.observations.map(({ obligationId }) => obligationId);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))].sort();
  if (duplicateIds.length > 0) blockers.push(`duplicate observation obligations: ${duplicateIds.join(", ")}`);
  const actual = new Set(ids);
  const missing = required.filter((id) => !actual.has(id));
  if (missing.length > 0) blockers.push(`missing required observations: ${missing.join(", ")}`);
  const unexpected = [...actual].filter((id) => !required.includes(id)).sort();
  if (unexpected.length > 0) blockers.push(`unexpected observations cannot substitute for obligations: ${unexpected.join(", ")}`);
  const stages = new Set(receipt.observations.map(({ stage }) => stage));
  const missingStages = SUBSYSTEM_CLOSURE_STAGES.filter((stage) => !stages.has(stage));
  if (missingStages.length > 0) blockers.push(`missing closure stages: ${missingStages.join(", ")}`);
  for (const observation of receipt.observations) {
    if ([observation.obligationId, observation.producer, observation.entrypoint].some((value) => value.trim() === "")) blockers.push(`blank closure evidence field for ${observation.obligationId || "unknown"}`);
    if (observation.producer === contract.subsystemId) blockers.push(`self-asserted evidence is forbidden for ${observation.obligationId}`);
    if (!observation.severedEdgeRejected) blockers.push(`severed edge was not rejected for ${observation.obligationId}`);
    if (canonicalJson(observation.observedOutputHash) === canonicalJson(observation.failureHash)) blockers.push(`positive and negative evidence collide for ${observation.obligationId}`);
  }
  return { status: blockers.length === 0 ? "closed" : "open", blockers: Object.freeze([...new Set(blockers)].sort()) };
}
