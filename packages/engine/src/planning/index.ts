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

export * from "./change-plan.js";

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
  readonly version: string;
  readonly provenance: "source" | "generated";
  readonly unitIds: readonly EntityId[];
}

export type PlanningTransformConvergence =
  | { readonly kind: "idempotent" }
  | { readonly kind: "bounded-fixed-point"; readonly maximumIterations: number };

export interface PlanningTransformMetadata {
  readonly predecessors: readonly string[];
  readonly unitClaim: "exclusive" | "shared";
  readonly convergence: PlanningTransformConvergence;
}

/** Injected facade over the registered runtime transform catalog. */
export interface PlanningTransformRegistry {
  getMetadata(id: string, version: string): PlanningTransformMetadata | undefined;
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

export class PlanningFixedPointError extends Error {
  constructor(ids: readonly string[], maximumIterations: number) {
    super(`transform fixed-point group ${sortedUnique(ids).join(", ")} did not converge within ${maximumIterations} iterations`);
    this.name = "PlanningFixedPointError";
  }
}

interface ResolvedPlannedTransform {
  readonly transform: PlannedTransform;
  readonly metadata: PlanningTransformMetadata;
}

interface PlannedTransformGroup {
  readonly kind: "sequential" | "bounded-fixed-point";
  readonly transforms: PlannedTransform[];
  readonly maximumIterations: number;
}

function normalizePlanningMetadata(metadata: PlanningTransformMetadata): PlanningTransformMetadata {
  const convergence = metadata.convergence.kind === "idempotent"
    ? { kind: "idempotent" as const }
    : {
        kind: "bounded-fixed-point" as const,
        maximumIterations: metadata.convergence.maximumIterations,
      };
  if (
    convergence.kind === "bounded-fixed-point"
    && (!Number.isSafeInteger(convergence.maximumIterations) || convergence.maximumIterations < 1)
  ) {
    throw new TypeError("bounded transform convergence requires a positive maximum iteration count");
  }
  return {
    predecessors: sortedUnique(metadata.predecessors),
    unitClaim: metadata.unitClaim,
    convergence,
  };
}

function plannedTransformGroups(
  transforms: readonly PlannedTransform[],
  registry: PlanningTransformRegistry,
): PlannedTransformGroup[] {
  const byId = new Map<string, ResolvedPlannedTransform>();
  const claims = new Map<EntityId, string[]>();
  for (const transform of transforms) {
    if (byId.has(transform.id)) throw new TypeError(`duplicate planned transform: ${transform.id}`);
    const metadata = registry.getMetadata(transform.id, transform.version);
    if (metadata === undefined) throw new TypeError(`unknown registered transform: ${transform.id}@${transform.version}`);
    const normalized: PlannedTransform = {
      id: transform.id,
      version: transform.version,
      provenance: transform.provenance,
      unitIds: sortedUnique(transform.unitIds),
    };
    const resolved = { transform: normalized, metadata: normalizePlanningMetadata(metadata) };
    byId.set(transform.id, resolved);
    if (resolved.metadata.unitClaim === "exclusive") {
      for (const unitId of normalized.unitIds) {
        const owners = claims.get(unitId) ?? [];
        owners.push(`${transform.id}@${transform.version}`);
        claims.set(unitId, owners);
      }
    }
  }
  for (const [unitId, owners] of claims) {
    if (owners.length > 1) throw new PlanningClaimConflictError(unitId, owners);
  }

  for (const [id, resolved] of byId) {
    for (const predecessor of resolved.metadata.predecessors) {
      if (!byId.has(predecessor)) throw new TypeError(`transform ${id} requires predecessor ${predecessor}`);
    }
  }

  let nextIndex = 0;
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  const visit = (id: string): void => {
    const ownIndex = nextIndex;
    nextIndex += 1;
    indices.set(id, ownIndex);
    lowLinks.set(id, ownIndex);
    stack.push(id);
    onStack.add(id);
    const resolved = byId.get(id);
    if (resolved === undefined) throw new TypeError(`unknown planned transform: ${id}`);
    for (const predecessor of resolved.metadata.predecessors) {
      if (!indices.has(predecessor)) {
        visit(predecessor);
        lowLinks.set(id, Math.min(lowLinks.get(id) ?? ownIndex, lowLinks.get(predecessor) ?? ownIndex));
      } else if (onStack.has(predecessor)) {
        lowLinks.set(id, Math.min(lowLinks.get(id) ?? ownIndex, indices.get(predecessor) ?? ownIndex));
      }
    }
    if (lowLinks.get(id) !== ownIndex) return;
    const component: string[] = [];
    let member: string | undefined;
    do {
      member = stack.pop();
      if (member === undefined) throw new Error("invalid planned transform component stack");
      onStack.delete(member);
      component.push(member);
    } while (member !== id);
    components.push(component.sort(compareStrings));
  };
  for (const id of [...byId.keys()].sort(compareStrings)) if (!indices.has(id)) visit(id);

  const componentById = new Map<string, number>();
  components.forEach((component, index) => component.forEach((id) => componentById.set(id, index)));
  const outgoing = components.map(() => new Set<number>());
  const indegree = components.map(() => 0);
  for (const [id, resolved] of byId) {
    const currentComponent = componentById.get(id);
    if (currentComponent === undefined) throw new Error(`missing planned transform component for ${id}`);
    for (const predecessor of resolved.metadata.predecessors) {
      const predecessorComponent = componentById.get(predecessor);
      if (predecessorComponent === undefined || predecessorComponent === currentComponent) continue;
      const edges: Set<number> | undefined = outgoing[predecessorComponent];
      if (edges !== undefined && !edges.has(currentComponent)) {
        edges.add(currentComponent);
        indegree[currentComponent] = (indegree[currentComponent] ?? 0) + 1;
      }
    }
  }

  const orderedComponentTransforms = (component: readonly string[]): PlannedTransform[] => component
    .map((id) => byId.get(id)?.transform)
    .filter((transform): transform is PlannedTransform => transform !== undefined)
    .sort((left, right) =>
      (left.provenance === "source" ? 0 : 1) - (right.provenance === "source" ? 0 : 1)
      || compareStrings(left.id, right.id)
      || compareStrings(left.version, right.version));
  const groups: PlannedTransformGroup[] = [];
  const remaining = new Set(components.map((_component, index) => index));
  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter((index) => indegree[index] === 0)
      .sort((left, right) => {
        const leftFirst = orderedComponentTransforms(components[left] ?? [])[0];
        const rightFirst = orderedComponentTransforms(components[right] ?? [])[0];
        if (leftFirst === undefined || rightFirst === undefined) return left - right;
        return (leftFirst.provenance === "source" ? 0 : 1) - (rightFirst.provenance === "source" ? 0 : 1)
          || compareStrings(leftFirst.id, rightFirst.id);
      });
    if (ready.length === 0) throw new Error("planned transform component graph is cyclic");
    for (const componentIndex of ready) {
      const component = components[componentIndex] ?? [];
      const selfCycle = component.some((id) => byId.get(id)?.metadata.predecessors.includes(id));
      const isCycle = component.length > 1 || selfCycle;
      const convergences = component.map((id) => byId.get(id)?.metadata.convergence);
      if (isCycle && convergences.some((convergence) => convergence?.kind !== "bounded-fixed-point")) {
        throw new PlanningDependencyCycleError(component);
      }
      const maximumIterations = isCycle
        ? Math.min(...convergences.map((convergence) =>
            convergence?.kind === "bounded-fixed-point" ? convergence.maximumIterations : 0))
        : 1;
      groups.push({
        kind: isCycle ? "bounded-fixed-point" : "sequential",
        transforms: orderedComponentTransforms(component),
        maximumIterations,
      });
      remaining.delete(componentIndex);
      for (const dependent of outgoing[componentIndex] ?? []) {
        indegree[dependent] = (indegree[dependent] ?? 0) - 1;
      }
    }
  }
  return groups;
}

/** Orders sources before generated outputs and preflights claims using registered metadata. */
export function orderPlannedTransforms(
  transforms: readonly PlannedTransform[],
  registry: PlanningTransformRegistry,
): PlannedTransform[] {
  return plannedTransformGroups(transforms, registry).flatMap((group) => group.transforms);
}

/** Executes declared fixed-point SCCs deterministically until stable or their registry bound is exhausted. */
export async function convergePlannedTransforms(
  transforms: readonly PlannedTransform[],
  registry: PlanningTransformRegistry,
  execute: (
    transform: PlannedTransform,
    iteration: number,
  ) => Promise<{ readonly changed: boolean }>,
): Promise<{ readonly converged: true; readonly iterations: number }> {
  const groups = plannedTransformGroups(transforms, registry);
  let iterations = groups.length === 0 ? 0 : 1;
  for (const group of groups) {
    if (group.kind === "sequential") {
      for (const transform of group.transforms) await execute(transform, 1);
      continue;
    }
    let converged = false;
    for (let iteration = 1; iteration <= group.maximumIterations; iteration += 1) {
      let changed = false;
      for (const transform of group.transforms) {
        const result = await execute(transform, iteration);
        changed ||= result.changed;
      }
      iterations = Math.max(iterations, iteration);
      if (!changed) {
        converged = true;
        break;
      }
    }
    if (!converged) {
      throw new PlanningFixedPointError(group.transforms.map((transform) => transform.id), group.maximumIterations);
    }
  }
  return { converged: true, iterations };
}
