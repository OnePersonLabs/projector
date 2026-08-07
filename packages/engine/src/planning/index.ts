import {
  canonicalJson,
  hashFramedDomain,
  type CompletionContract,
  type EntityId,
  type ExecutionCapsule,
  type ExecutionPlan,
  type PlanCheckpoint,
  type StateBinding,
  type ValidatorBinding,
} from "@projector/core";

import { createStateBinding } from "../state/index.js";

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sortedUnique = <T extends string>(values: readonly T[]): T[] => [...new Set(values)].sort(compareStrings);

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function sortedCanonical<T>(values: readonly T[]): T[] {
  return [...values].map((value) => structuredClone(value)).sort((left, right) =>
    compareStrings(canonicalJson(left), canonicalJson(right)));
}

function normalizeBinding(binding: StateBinding): StateBinding {
  const normalized = createStateBinding(binding);
  if (normalized.dependencyDigest !== binding.dependencyDigest) {
    throw new TypeError("state binding dependency digest does not match its normalized dependencies");
  }
  return normalized;
}

function normalizeCompletionContract(contract: CompletionContract): CompletionContract {
  const unitStates = new Map<EntityId, CompletionContract["requiredUnitStates"][number]["state"]>();
  for (const requirement of contract.requiredUnitStates) {
    const existing = unitStates.get(requirement.unitId);
    if (existing !== undefined && existing !== requirement.state) {
      throw new TypeError(`conflicting completion state for ${requirement.unitId}`);
    }
    unitStates.set(requirement.unitId, requirement.state);
  }
  return {
    ...structuredClone(contract),
    requiredUnitStates: [...unitStates].sort(([left], [right]) => compareStrings(left, right))
      .map(([unitId, state]) => ({ unitId, state })),
    requiredValidators: sortedUnique(contract.requiredValidators),
    requiredEvidenceLanes: sortedUnique(contract.requiredEvidenceLanes),
    requiredArtifacts: sortedUnique(contract.requiredArtifacts),
  };
}

function normalizeCheckpoints(checkpoints: readonly PlanCheckpoint[]): PlanCheckpoint[] {
  const ids = new Set<EntityId>();
  return [...checkpoints]
    .sort((left, right) => compareStrings(left.id, right.id))
    .map((checkpoint) => {
      if (ids.has(checkpoint.id)) throw new TypeError(`duplicate plan checkpoint: ${checkpoint.id}`);
      ids.add(checkpoint.id);
      return {
        ...structuredClone(checkpoint),
        afterPacketIds: sortedUnique(checkpoint.afterPacketIds),
        requiredValidators: sortedUnique(checkpoint.requiredValidators),
      };
    });
}

export type CreateExecutionPlanInput = Omit<ExecutionPlan,
  "boundState" | "boundary" | "assumptions" | "knownAffectedUnitIds" | "possibleFrontierUnitIds"
  | "unavailableSurfaceIds" | "packetIds" | "checkpoints" | "completionCriteria"
> & {
  readonly boundState: StateBinding;
  readonly boundary: readonly string[];
  readonly assumptions: readonly string[];
  readonly knownAffectedUnitIds: readonly EntityId[];
  readonly possibleFrontierUnitIds: readonly EntityId[];
  readonly unavailableSurfaceIds: readonly EntityId[];
  readonly packetIds: readonly EntityId[];
  readonly checkpoints: readonly PlanCheckpoint[];
  readonly completionCriteria: CompletionContract;
};

/** Creates a normative plan DTO whose content cannot drift after approval. */
export function createExecutionPlan(input: CreateExecutionPlanInput): Readonly<ExecutionPlan> {
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) {
    throw new TypeError("execution plan revision must be a positive integer");
  }
  const plan: ExecutionPlan = {
    ...structuredClone(input),
    boundState: normalizeBinding(input.boundState),
    boundary: sortedUnique(input.boundary),
    assumptions: sortedUnique(input.assumptions),
    knownAffectedUnitIds: sortedUnique(input.knownAffectedUnitIds),
    possibleFrontierUnitIds: sortedUnique(input.possibleFrontierUnitIds),
    unavailableSurfaceIds: sortedUnique(input.unavailableSurfaceIds),
    packetIds: sortedUnique(input.packetIds),
    checkpoints: normalizeCheckpoints(input.checkpoints),
    completionCriteria: normalizeCompletionContract(input.completionCriteria),
  };
  return deepFreeze(plan);
}

function validatorKey(validator: ValidatorBinding): string {
  return `${validator.id}@${validator.version}`;
}

export function normalizeValidationSet(validators: readonly ValidatorBinding[]): ReadonlyArray<Readonly<ValidatorBinding>> {
  const normalized = new Map<string, ValidatorBinding>();
  for (const validator of validators) {
    const candidate = structuredClone(validator);
    const key = validatorKey(candidate);
    const existing = normalized.get(key);
    if (existing !== undefined && canonicalJson(existing) !== canonicalJson(candidate)) {
      throw new TypeError(`conflicting validator definition: ${key}`);
    }
    normalized.set(key, candidate);
  }
  return deepFreeze([...normalized.values()].sort((left, right) =>
    compareStrings(left.id, right.id) || compareStrings(left.version, right.version)));
}

export type CreateExecutionCapsuleInput = Omit<ExecutionCapsule, "boundState" | "contextDependencyHash" | "contextHash"> & {
  readonly boundState: StateBinding;
};

/** Compiles the exact bounded capsule DTO and addresses both dependencies and full context. */
export function createExecutionCapsule(input: CreateExecutionCapsuleInput): Readonly<ExecutionCapsule> {
  const normalizedInput = {
    ...structuredClone(input),
    boundState: normalizeBinding(input.boundState),
    unitIds: sortedUnique(input.unitIds),
    analysisFacetKeys: sortedUnique(input.analysisFacetKeys),
    requirementIds: sortedUnique(input.requirementIds),
    scenarioIds: sortedUnique(input.scenarioIds),
    decisionIds: sortedUnique(input.decisionIds),
    unresolvedArchitectureConcerns: sortedUnique(input.unresolvedArchitectureConcerns),
    effectiveRules: sortedCanonical(input.effectiveRules),
    relevantPrecedents: sortedCanonical(input.relevantPrecedents),
    allowedWrites: sortedCanonical(input.allowedWrites),
    forbiddenWrites: sortedCanonical(input.forbiddenWrites),
    availablePrimitives: sortedUnique(input.availablePrimitives),
    requiredValidations: sortedUnique(input.requiredValidations),
    upstreamImplications: sortedUnique(input.upstreamImplications),
    downstreamImplications: sortedUnique(input.downstreamImplications),
    knownExceptions: sortedUnique(input.knownExceptions),
    unknowns: sortedUnique(input.unknowns),
    risk: { ...structuredClone(input.risk), reasons: sortedUnique(input.risk.reasons) },
    completionContract: normalizeCompletionContract(input.completionContract),
  };
  const contextDependencyHash = hashFramedDomain("execution-capsule-dependencies", {
    stateDependencyDigest: normalizedInput.boundState.dependencyDigest,
    requirementIds: normalizedInput.requirementIds,
    scenarioIds: normalizedInput.scenarioIds,
    decisionIds: normalizedInput.decisionIds,
    normativeKernelHash: normalizedInput.normativeKernelHash,
  });
  const capsule: ExecutionCapsule = {
    ...normalizedInput,
    contextDependencyHash,
    contextHash: hashFramedDomain("execution-capsule", { ...normalizedInput, contextDependencyHash }),
  };
  return deepFreeze(capsule);
}

export interface PlannedTransform {
  readonly id: string;
  readonly provenance: "source" | "generated";
  readonly predecessors: readonly string[];
  readonly unitIds: readonly EntityId[];
  readonly exclusiveUnitClaim: boolean;
}

export class PlanningClaimConflictError extends Error {
  constructor(unitId: EntityId, owners: readonly string[]) {
    super(`exclusive transform claim collision for ${unitId}: ${sortedUnique(owners).join(", ")}`);
    this.name = "PlanningClaimConflictError";
  }
}

export class PlanningDependencyCycleError extends Error {
  constructor(ids: readonly string[]) {
    super(`transform dependency cycle is not declared convergent: ${sortedUnique(ids).join(", ")}`);
    this.name = "PlanningDependencyCycleError";
  }
}

/** Orders sources before generated outputs whenever dependencies permit and fails on claim ambiguity. */
export function orderPlannedTransforms(transforms: readonly PlannedTransform[]): PlannedTransform[] {
  const byId = new Map<string, PlannedTransform>();
  const claims = new Map<EntityId, string[]>();
  for (const transform of transforms) {
    if (byId.has(transform.id)) throw new TypeError(`duplicate planned transform: ${transform.id}`);
    const normalized = {
      ...structuredClone(transform),
      predecessors: sortedUnique(transform.predecessors),
      unitIds: sortedUnique(transform.unitIds),
    };
    byId.set(transform.id, normalized);
    if (transform.exclusiveUnitClaim) {
      for (const unitId of normalized.unitIds) {
        const owners = claims.get(unitId) ?? [];
        owners.push(transform.id);
        claims.set(unitId, owners);
      }
    }
  }
  for (const [unitId, owners] of claims) {
    if (owners.length > 1) throw new PlanningClaimConflictError(unitId, owners);
  }

  const remaining = new Map(byId);
  const completed = new Set<string>();
  const ordered: PlannedTransform[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining.values()]
      .filter((transform) => transform.predecessors.every((predecessor) => completed.has(predecessor)))
      .sort((left, right) =>
        (left.provenance === "source" ? 0 : 1) - (right.provenance === "source" ? 0 : 1)
        || compareStrings(left.id, right.id));
    if (ready.length === 0) throw new PlanningDependencyCycleError([...remaining.keys()]);
    for (const transform of ready) {
      ordered.push(transform);
      completed.add(transform.id);
      remaining.delete(transform.id);
    }
  }
  return ordered;
}
