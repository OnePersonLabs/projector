import { createRequire as __projectorCreateRequire } from "node:module"; const require = __projectorCreateRequire(import.meta.url);
import {
  authorityRecordHashIsValid,
  createStateBinding,
  evaluateDecisionOptions
} from "./shared-ZKECJVYF.js";
import {
  canonicalJson,
  hashFramedDomain,
  hashSemantic
} from "./shared-6VIFAIKJ.js";

// node_modules/@projector/engine/dist/planning/generated-output-repair.js
function planGeneratedOutputRepair(request) {
  if (request.intent === "direct-generated-patch")
    throw new Error("direct generated-output repair is forbidden; repair the upstream source or use an explicit temporary overlay");
  if (request.intent === "upstream-regeneration") {
    if (!request.capabilities.generator || !request.capabilities.upstreamSourceKnown || !request.capabilities.validatorCanProveValidity)
      throw new Error("upstream regeneration requires a known source, generator, and proving validator");
    return Object.freeze({ strategy: "upstream-regeneration", operations: Object.freeze(["change-upstream", "regenerate", "validate"]) });
  }
  const overlay = request.temporaryOverlay;
  if (overlay === void 0 || overlay.migrationId.trim() === "" || overlay.debtId.trim() === "" || overlay.exitCriteria.length === 0 || overlay.exitCriteria.some((criterion) => criterion.trim() === ""))
    throw new Error("temporary generated-output overlay requires explicit migration, accepted debt, and exit criteria");
  return Object.freeze({ strategy: "temporary-overlay", operations: Object.freeze(["apply-overlay", "validate"]), migrationId: overlay.migrationId, debtId: overlay.debtId, exitCriteria: Object.freeze([...overlay.exitCriteria]) });
}

// node_modules/@projector/engine/dist/planning/index.js
var compareStrings = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var sortedUnique = (values) => [...new Set(values)].sort(compareStrings);
function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value))
      deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
function sortedCanonical(values) {
  return [...values].map((value) => structuredClone(value)).sort((left, right) => compareStrings(canonicalJson(left), canonicalJson(right)));
}
function normalizeBinding(binding) {
  const normalized = createStateBinding(binding);
  if (normalized.dependencyDigest !== binding.dependencyDigest) {
    throw new TypeError("state binding dependency digest does not match its normalized dependencies");
  }
  return normalized;
}
function normalizeCompletionContract(contract) {
  const unitStates = /* @__PURE__ */ new Map();
  for (const requirement of contract.requiredUnitStates) {
    const existing = unitStates.get(requirement.unitId);
    if (existing !== void 0 && existing !== requirement.state) {
      throw new TypeError(`conflicting completion state for ${requirement.unitId}`);
    }
    unitStates.set(requirement.unitId, requirement.state);
  }
  return {
    ...structuredClone(contract),
    requiredUnitStates: [...unitStates].sort(([left], [right]) => compareStrings(left, right)).map(([unitId, state]) => ({ unitId, state })),
    requiredValidators: sortedUnique(contract.requiredValidators),
    requiredEvidenceLanes: sortedUnique(contract.requiredEvidenceLanes),
    requiredArtifacts: sortedUnique(contract.requiredArtifacts)
  };
}
function normalizeCheckpoints(checkpoints) {
  const ids = /* @__PURE__ */ new Set();
  return [...checkpoints].sort((left, right) => compareStrings(left.id, right.id)).map((checkpoint) => {
    if (ids.has(checkpoint.id))
      throw new TypeError(`duplicate plan checkpoint: ${checkpoint.id}`);
    ids.add(checkpoint.id);
    return {
      ...structuredClone(checkpoint),
      afterPacketIds: sortedUnique(checkpoint.afterPacketIds),
      requiredValidators: sortedUnique(checkpoint.requiredValidators)
    };
  });
}
function createExecutionPlan(input) {
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) {
    throw new TypeError("execution plan revision must be a positive integer");
  }
  const plan = {
    ...structuredClone(input),
    boundState: normalizeBinding(input.boundState),
    boundary: sortedUnique(input.boundary),
    assumptions: sortedUnique(input.assumptions),
    knownAffectedUnitIds: sortedUnique(input.knownAffectedUnitIds),
    possibleFrontierUnitIds: sortedUnique(input.possibleFrontierUnitIds),
    unavailableSurfaceIds: sortedUnique(input.unavailableSurfaceIds),
    packetIds: sortedUnique(input.packetIds),
    checkpoints: normalizeCheckpoints(input.checkpoints),
    completionCriteria: normalizeCompletionContract(input.completionCriteria)
  };
  return deepFreeze(plan);
}
function validatorKey(validator) {
  return `${validator.id}@${validator.version}`;
}
function normalizeValidationSet(validators) {
  const normalized = /* @__PURE__ */ new Map();
  for (const validator of validators) {
    const candidate = structuredClone(validator);
    const key = validatorKey(candidate);
    const existing = normalized.get(key);
    if (existing !== void 0 && canonicalJson(existing) !== canonicalJson(candidate)) {
      throw new TypeError(`conflicting validator definition: ${key}`);
    }
    normalized.set(key, candidate);
  }
  return deepFreeze([...normalized.values()].sort((left, right) => compareStrings(left.id, right.id) || compareStrings(left.version, right.version)));
}
function createExecutionCapsule(input) {
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
    completionContract: normalizeCompletionContract(input.completionContract)
  };
  const contextDependencyHash = hashFramedDomain("execution-capsule-dependencies", {
    stateDependencyDigest: normalizedInput.boundState.dependencyDigest,
    requirementIds: normalizedInput.requirementIds,
    scenarioIds: normalizedInput.scenarioIds,
    decisionIds: normalizedInput.decisionIds,
    normativeKernelHash: normalizedInput.normativeKernelHash,
    representation: normalizedInput.representation
  });
  const capsule = {
    ...normalizedInput,
    contextDependencyHash,
    contextHash: hashFramedDomain("execution-capsule", { ...normalizedInput, contextDependencyHash })
  };
  return deepFreeze(capsule);
}
var PlanningClaimConflictError = class extends Error {
  constructor(unitId, owners) {
    super(`exclusive transform claim collision for ${unitId}: ${sortedUnique(owners).join(", ")}`);
    this.name = "PlanningClaimConflictError";
  }
};
var PlanningDependencyCycleError = class extends Error {
  constructor(ids) {
    super(`transform dependency cycle is not declared convergent: ${sortedUnique(ids).join(", ")}`);
    this.name = "PlanningDependencyCycleError";
  }
};
var PlanningFixedPointError = class extends Error {
  constructor(ids, maximumIterations) {
    super(`transform fixed-point group ${sortedUnique(ids).join(", ")} did not converge within ${maximumIterations} iterations`);
    this.name = "PlanningFixedPointError";
  }
};
function normalizePlanningMetadata(metadata) {
  const convergence = metadata.convergence.kind === "idempotent" ? { kind: "idempotent" } : {
    kind: "bounded-fixed-point",
    maximumIterations: metadata.convergence.maximumIterations
  };
  if (convergence.kind === "bounded-fixed-point" && (!Number.isSafeInteger(convergence.maximumIterations) || convergence.maximumIterations < 1)) {
    throw new TypeError("bounded transform convergence requires a positive maximum iteration count");
  }
  return {
    predecessors: sortedUnique(metadata.predecessors),
    unitClaim: metadata.unitClaim,
    convergence
  };
}
function plannedTransformGroups(transforms, registry) {
  const byId = /* @__PURE__ */ new Map();
  const claims = /* @__PURE__ */ new Map();
  for (const transform of transforms) {
    if (byId.has(transform.id))
      throw new TypeError(`duplicate planned transform: ${transform.id}`);
    const metadata = registry.getMetadata(transform.id, transform.version);
    if (metadata === void 0)
      throw new TypeError(`unknown registered transform: ${transform.id}@${transform.version}`);
    const normalized = {
      id: transform.id,
      version: transform.version,
      provenance: transform.provenance,
      unitIds: sortedUnique(transform.unitIds)
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
    if (owners.length > 1)
      throw new PlanningClaimConflictError(unitId, owners);
  }
  for (const [id, resolved] of byId) {
    for (const predecessor of resolved.metadata.predecessors) {
      if (!byId.has(predecessor))
        throw new TypeError(`transform ${id} requires predecessor ${predecessor}`);
    }
  }
  let nextIndex = 0;
  const indices = /* @__PURE__ */ new Map();
  const lowLinks = /* @__PURE__ */ new Map();
  const stack = [];
  const onStack = /* @__PURE__ */ new Set();
  const components = [];
  const visit = (id) => {
    const ownIndex = nextIndex;
    nextIndex += 1;
    indices.set(id, ownIndex);
    lowLinks.set(id, ownIndex);
    stack.push(id);
    onStack.add(id);
    const resolved = byId.get(id);
    if (resolved === void 0)
      throw new TypeError(`unknown planned transform: ${id}`);
    for (const predecessor of resolved.metadata.predecessors) {
      if (!indices.has(predecessor)) {
        visit(predecessor);
        lowLinks.set(id, Math.min(lowLinks.get(id) ?? ownIndex, lowLinks.get(predecessor) ?? ownIndex));
      } else if (onStack.has(predecessor)) {
        lowLinks.set(id, Math.min(lowLinks.get(id) ?? ownIndex, indices.get(predecessor) ?? ownIndex));
      }
    }
    if (lowLinks.get(id) !== ownIndex)
      return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      if (member === void 0)
        throw new Error("invalid planned transform component stack");
      onStack.delete(member);
      component.push(member);
    } while (member !== id);
    components.push(component.sort(compareStrings));
  };
  for (const id of [...byId.keys()].sort(compareStrings))
    if (!indices.has(id))
      visit(id);
  const componentById = /* @__PURE__ */ new Map();
  components.forEach((component, index) => component.forEach((id) => componentById.set(id, index)));
  const outgoing = components.map(() => /* @__PURE__ */ new Set());
  const indegree = components.map(() => 0);
  for (const [id, resolved] of byId) {
    const currentComponent = componentById.get(id);
    if (currentComponent === void 0)
      throw new Error(`missing planned transform component for ${id}`);
    for (const predecessor of resolved.metadata.predecessors) {
      const predecessorComponent = componentById.get(predecessor);
      if (predecessorComponent === void 0 || predecessorComponent === currentComponent)
        continue;
      const edges = outgoing[predecessorComponent];
      if (edges !== void 0 && !edges.has(currentComponent)) {
        edges.add(currentComponent);
        indegree[currentComponent] = (indegree[currentComponent] ?? 0) + 1;
      }
    }
  }
  const orderedComponentTransforms = (component) => component.map((id) => byId.get(id)?.transform).filter((transform) => transform !== void 0).sort((left, right) => (left.provenance === "source" ? 0 : 1) - (right.provenance === "source" ? 0 : 1) || compareStrings(left.id, right.id) || compareStrings(left.version, right.version));
  const groups = [];
  const remaining = new Set(components.map((_component, index) => index));
  while (remaining.size > 0) {
    const ready = [...remaining].filter((index) => indegree[index] === 0).sort((left, right) => {
      const leftFirst = orderedComponentTransforms(components[left] ?? [])[0];
      const rightFirst = orderedComponentTransforms(components[right] ?? [])[0];
      if (leftFirst === void 0 || rightFirst === void 0)
        return left - right;
      return (leftFirst.provenance === "source" ? 0 : 1) - (rightFirst.provenance === "source" ? 0 : 1) || compareStrings(leftFirst.id, rightFirst.id);
    });
    if (ready.length === 0)
      throw new Error("planned transform component graph is cyclic");
    for (const componentIndex of ready) {
      const component = components[componentIndex] ?? [];
      const selfCycle = component.some((id) => byId.get(id)?.metadata.predecessors.includes(id));
      const isCycle = component.length > 1 || selfCycle;
      const convergences = component.map((id) => byId.get(id)?.metadata.convergence);
      if (isCycle && convergences.some((convergence) => convergence?.kind !== "bounded-fixed-point")) {
        throw new PlanningDependencyCycleError(component);
      }
      const maximumIterations = isCycle ? Math.min(...convergences.map((convergence) => convergence?.kind === "bounded-fixed-point" ? convergence.maximumIterations : 0)) : 1;
      groups.push({
        kind: isCycle ? "bounded-fixed-point" : "sequential",
        transforms: orderedComponentTransforms(component),
        maximumIterations
      });
      remaining.delete(componentIndex);
      for (const dependent of outgoing[componentIndex] ?? []) {
        indegree[dependent] = (indegree[dependent] ?? 0) - 1;
      }
    }
  }
  return groups;
}
function orderPlannedTransforms(transforms, registry) {
  return plannedTransformGroups(transforms, registry).flatMap((group) => group.transforms);
}
async function convergePlannedTransforms(transforms, registry, execute) {
  const groups = plannedTransformGroups(transforms, registry);
  let iterations = groups.length === 0 ? 0 : 1;
  for (const group of groups) {
    if (group.kind === "sequential") {
      for (const transform of group.transforms)
        await execute(transform, 1);
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

// node_modules/@projector/engine/dist/planning/change-plan.js
var compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var unique = (values) => [...new Set(values)].sort(compare);
var stages = ["contract", "bridge", "source", "generated", "consumer", "cutover", "agent", "cleanup"];
var pathRoot = (value) => value.trim().replace(/\\/gu, "/").replace(/^\.\//u, "").replace(/\/\*\*.*$/u, "").replace(/\*.*$/u, "").replace(/\/+$/u, "");
var pathOverlap = (left, right) => {
  const a = pathRoot(left);
  const b = pathRoot(right);
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
};
var pathWithin = (candidate, boundary) => {
  const child = pathRoot(candidate);
  const parent = pathRoot(boundary);
  return parent === "." || child === parent || child.startsWith(`${parent}/`);
};
function normalizeProposals(raw) {
  const byKey = /* @__PURE__ */ new Map();
  for (const item of raw) {
    if (item.key.trim() === "" || item.unitIds.length === 0 || item.writeSelectors.length === 0)
      throw new Error("change packet requires a stable key, units, and explicit write selectors");
    if (item.convergence !== void 0 && (!Number.isSafeInteger(item.convergence.maximumIterations) || item.convergence.maximumIterations < 1))
      throw new Error("packet convergence requires positive bounded iterations");
    const proposal = { ...structuredClone(item), unitIds: unique(item.unitIds), semanticOwnerIds: unique(item.semanticOwnerIds), writeSelectors: unique(item.writeSelectors), ...item.forbiddenWriteSelectors === void 0 ? {} : { forbiddenWriteSelectors: unique(item.forbiddenWriteSelectors) }, dependencies: unique(item.dependencies), validatorIds: unique(item.validatorIds) };
    const existing = byKey.get(proposal.key);
    if (existing !== void 0 && canonicalJson(existing) !== canonicalJson(proposal))
      throw new Error(`conflicting change packet ${proposal.key}`);
    byKey.set(proposal.key, existing ?? proposal);
  }
  const proposals = [...byKey.values()].sort((a, b) => stages.indexOf(a.stage) - stages.indexOf(b.stage) || compare(a.key, b.key));
  for (const proposal of proposals)
    for (const dependency of proposal.dependencies)
      if (!byKey.has(dependency))
        throw new Error(`packet ${proposal.key} has missing dependency ${dependency}`);
  for (let leftIndex = 0; leftIndex < proposals.length; leftIndex += 1)
    for (let rightIndex = leftIndex + 1; rightIndex < proposals.length; rightIndex += 1) {
      const left = proposals[leftIndex];
      const right = proposals[rightIndex];
      const semanticOverlap = left.unitIds.some((id) => right.unitIds.includes(id)) || left.semanticOwnerIds.some((id) => right.semanticOwnerIds.includes(id));
      const selectorOverlap = left.writeSelectors.some((a) => right.writeSelectors.some((b) => pathOverlap(a, b)));
      if (semanticOverlap || selectorOverlap)
        throw new Error(`packet semantic/write overlap: ${left.key}, ${right.key}`);
    }
  return proposals;
}
function executionKeys(proposals) {
  const byKey = new Map(proposals.map((item) => [item.key, item]));
  const visiting = /* @__PURE__ */ new Set();
  const visited = /* @__PURE__ */ new Set();
  const ordered = [];
  const visit = (key, lineage) => {
    if (visited.has(key))
      return;
    if (visiting.has(key)) {
      const cycle = lineage.slice(lineage.indexOf(key));
      const group = byKey.get(key)?.convergence?.group;
      if (group === void 0 || cycle.some((id) => byKey.get(id)?.convergence?.group !== group))
        throw new Error(`packet dependency cycle is not declared convergent: ${unique(cycle).join(", ")}`);
      for (const id of unique(cycle)) {
        visited.add(id);
        ordered.push(id);
      }
      return;
    }
    visiting.add(key);
    const proposal = byKey.get(key);
    if (proposal === void 0)
      throw new Error(`unknown packet ${key}`);
    for (const dependency of proposal.dependencies)
      visit(dependency, [...lineage, key]);
    visiting.delete(key);
    if (!visited.has(key)) {
      visited.add(key);
      ordered.push(key);
    }
  };
  for (const proposal of proposals)
    visit(proposal.key, []);
  return ordered;
}
async function compileSemanticChangePlan(input, ports) {
  const authenticatedChange = await ports.changes.read(input.changeId);
  if (authenticatedChange.contentHash !== hashFramedDomain("authenticated-change-planning-input", authenticatedChange.value) || authenticatedChange.value.change.id !== input.changeId)
    throw new Error("change planning input is unauthenticated or mismatched");
  const representation = await ports.representations.compile(authenticatedChange.value);
  if ([representation.projectionId, representation.profileId, representation.profileVersion, representation.contentHash, representation.preservationHash].some((value) => value.trim() === ""))
    throw new Error("semantic-change representation reference is incomplete");
  const proposalsEnvelope = await ports.packets.compile(authenticatedChange.value.change);
  if (proposalsEnvelope.contentHash !== hashFramedDomain("authenticated-change-packet-proposals", proposalsEnvelope.value))
    throw new Error("change packet compiler output is unauthenticated");
  const proposals = normalizeProposals(proposalsEnvelope.value.proposals);
  for (const proposal of proposals) {
    if (proposal.writeSelectors.some((selector) => !authenticatedChange.value.change.boundary.some((boundary) => pathWithin(selector, boundary))))
      throw new Error(`packet ${proposal.key} write scope is outside the semantic change boundary`);
    if (proposal.writeSelectors.some((selector) => proposal.forbiddenWriteSelectors?.some((forbidden) => pathOverlap(selector, forbidden)) === true))
      throw new Error(`packet ${proposal.key} write scope intersects a forbidden selector`);
  }
  const order = executionKeys(proposals);
  const planIdentity = hashFramedDomain("semantic-change-plan-identity", { changeId: input.changeId, revision: input.revision, sourceRunId: input.sourceRunId, proposals, completionContract: proposalsEnvelope.value.completionContract, bindingDigest: authenticatedChange.value.boundState.dependencyDigest });
  const planId = `execution_plan_${planIdentity.slice(-32)}`;
  const normativeKernelHash = hashFramedDomain("semantic-change-normative-kernel", authenticatedChange.value.change);
  const packets = proposals.map((proposal) => {
    const packetId = `work_packet_${hashFramedDomain("semantic-change-packet-identity", { planId, key: proposal.key }).slice(-32)}`;
    const capsule = createExecutionCapsule({ id: `capsule_${hashFramedDomain("semantic-change-capsule-identity", { packetId }).slice(-32)}`, taskId: packetId, objective: proposal.title, operation: proposal.transformId ?? proposal.stage, unitIds: [...proposal.unitIds], boundState: authenticatedChange.value.boundState, relevanceClosureId: authenticatedChange.value.change.relevanceClosureId, analysisFacetKeys: [...authenticatedChange.value.change.analysisFacetKeys], requirementIds: authenticatedChange.value.change.operations.filter((item) => item.subjectType === "requirement").map((item) => item.requirementId).filter(Boolean), scenarioIds: authenticatedChange.value.change.operations.filter((item) => item.subjectType === "scenario").map((item) => item.scenarioId).filter(Boolean), conceptSummary: authenticatedChange.value.change.normalizedIntent, decisionIds: [...authenticatedChange.value.change.decisionIds], decisionSummary: "authenticated semantic-change prerequisites", unresolvedArchitectureConcerns: [], lensSummary: "compiled from impact closure", effectiveRules: [], normativeKernelHash, representation, relevantPrecedents: [], allowedWrites: proposal.writeSelectors.map((path) => ({ selector: { op: "atom", field: "path", matcher: path.includes("*") ? "glob" : "equals", value: path }, operations: [proposal.transformId ?? proposal.stage], reason: "compiled packet write scope" })), forbiddenWrites: (proposal.forbiddenWriteSelectors ?? []).map((path) => ({ selector: { op: "atom", field: "path", matcher: path.includes("*") ? "glob" : "equals", value: path }, operations: [proposal.transformId ?? proposal.stage], reason: "compiled packet forbidden scope" })), availablePrimitives: proposal.transformId === void 0 ? [] : [proposal.transformId], requiredValidations: [...proposal.validatorIds], upstreamImplications: [...proposal.dependencies], downstreamImplications: proposals.filter(({ dependencies }) => dependencies.includes(proposal.key)).map(({ key }) => key), knownExceptions: [], unknowns: proposal.executionMode === "deterministic" ? [] : ["host continuation required"], risk: authenticatedChange.value.change.risk, completionContract: proposalsEnvelope.value.completionContract });
    const packet = { id: packetId, planId, title: proposal.title, strategy: proposal.executionMode === "deterministic" ? "deterministic-patch" : proposal.executionMode === "agent" ? "agent-repair" : "human-decision", unitIds: [...proposal.unitIds], dependencies: proposal.dependencies.map((key) => `work_packet_${hashFramedDomain("semantic-change-packet-identity", { planId, key }).slice(-32)}`), capsuleId: capsule.id, risk: authenticatedChange.value.change.risk, executionMode: proposal.executionMode, ...proposal.transformId === void 0 ? {} : { transformId: proposal.transformId }, validatorIds: [...proposal.validatorIds], rollback: { kind: proposal.executionMode === "external" ? "compensation" : "git-checkpoint" }, boundState: authenticatedChange.value.boundState, status: "pending" };
    return { key: proposal.key, packet: Object.freeze(packet), capsule, packetHash: hashFramedDomain("semantic-change-work-packet", packet), capsuleHash: hashFramedDomain("semantic-change-execution-capsule", capsule), semanticOwnerIds: Object.freeze([...proposal.semanticOwnerIds]), writeSelectors: Object.freeze([...proposal.writeSelectors]), ...proposal.convergence === void 0 ? {} : { convergence: Object.freeze({ ...proposal.convergence }) } };
  });
  const byKey = new Map(packets.map((item) => [item.key, item]));
  const firstPacketId = order[0] === void 0 ? void 0 : byKey.get(order[0])?.packet.id;
  const predictedImpactClosureHash = authenticatedChange.value.change.predictedImpact?.contentHash;
  const plan = createExecutionPlan({ id: planId, revision: input.revision, semanticChangeId: input.changeId, sourceRunId: input.sourceRunId, boundState: authenticatedChange.value.boundState, relevanceClosureId: authenticatedChange.value.change.relevanceClosureId, ...predictedImpactClosureHash === void 0 ? {} : { predictedImpactClosureHash }, boundary: authenticatedChange.value.change.boundary, assumptions: authenticatedChange.value.change.assumptions, knownAffectedUnitIds: authenticatedChange.value.change.predictedImpact?.knownAffectedUnitIds ?? [], possibleFrontierUnitIds: authenticatedChange.value.change.predictedImpact?.possibleFrontierUnitIds ?? [], unavailableSurfaceIds: authenticatedChange.value.change.predictedImpact?.unavailableSurfaceIds ?? [], packetIds: packets.map(({ packet }) => packet.id), checkpoints: packets.map(({ packet }) => ({ id: `checkpoint:${packet.id}`, afterPacketIds: [packet.id], requiredValidators: [...packet.validatorIds], rollback: packet.rollback })), completionCriteria: proposalsEnvelope.value.completionContract, ...firstPacketId === void 0 ? {} : { recommendedNextChunk: firstPacketId } });
  return { plan, packets: Object.freeze(packets), executionOrder: Object.freeze(order.map((key) => byKey.get(key))), packetHash: hashFramedDomain("semantic-change-packet-set", packets.map(({ packetHash, capsuleHash }) => ({ packetHash, capsuleHash }))) };
}

// node_modules/@projector/engine/dist/modernization/index.js
var compare2 = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var unique2 = (values) => [...new Set(values)].sort(compare2);
function deepFreeze2(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value))
      deepFreeze2(child);
    Object.freeze(value);
  }
  return value;
}
function createFrictionObservation(input) {
  if (input.id.trim() === "" || input.recurrenceKey.trim() === "" || input.sourceId.trim() === "" || input.sourceRevision.trim() === "") {
    throw new TypeError("friction observation requires stable identity, recurrence, source, and revision");
  }
  const semantic = { ...structuredClone(input), affectedUnitIds: unique2(input.affectedUnitIds) };
  if (!Number.isFinite(Date.parse(input.observedAt)))
    throw new TypeError("friction observation requires a valid observed-at timestamp");
  return deepFreeze2({ ...semantic, semanticHash: hashFramedDomain("modernization-friction-observation", semantic) });
}
async function aggregateFriction(observations, sources) {
  const byId = /* @__PURE__ */ new Map();
  const revisions = /* @__PURE__ */ new Map();
  for (const raw of observations) {
    const { semanticHash, ...semantic } = structuredClone(raw);
    if (semanticHash !== hashFramedDomain("modernization-friction-observation", semantic))
      throw new Error(`friction observation ${raw.id} failed semantic authentication`);
    const existing = byId.get(raw.id);
    if (existing !== void 0 && canonicalJson(existing) !== canonicalJson(raw))
      throw new Error(`conflicting friction observation ${raw.id}`);
    const revision = await sources.read(raw.sourceId, raw.sourceRevision);
    if (revision === void 0 || !revision.current || revision.contentHash !== raw.sourceContentHash)
      throw new Error(`source revision authentication failed for ${raw.sourceId}@${raw.sourceRevision}`);
    if (revision.metadataHash !== hashFramedDomain("authenticated-evidence-origin", { sourceId: raw.sourceId, sourceRevision: raw.sourceRevision, contentHash: revision.contentHash, origin: revision.origin, independenceKey: revision.independenceKey }))
      throw new Error(`source origin authentication failed for ${raw.sourceId}@${raw.sourceRevision}`);
    byId.set(raw.id, { ...structuredClone(raw), endogenous: revision.origin === "projector-generated" });
    revisions.set(raw.id, revision);
  }
  const groups = /* @__PURE__ */ new Map();
  for (const item of byId.values())
    groups.set(item.recurrenceKey, [...groups.get(item.recurrenceKey) ?? [], item]);
  return [...groups.entries()].sort(([left], [right]) => compare2(left, right)).map(([recurrenceKey, items]) => {
    const independent = new Set(items.map(({ id }) => revisions.get(id)).filter(({ origin }) => origin === "independent").map(({ independenceKey }) => independenceKey));
    return deepFreeze2({ recurrenceKey, triggers: unique2(items.map(({ trigger }) => trigger)), observationIds: unique2(items.map(({ id }) => id)), affectedUnitIds: unique2(items.flatMap(({ affectedUnitIds }) => affectedUnitIds)), authenticatedOccurrences: items.length, independentOccurrences: independent.size, repeated: independent.size >= 2 });
  });
}
function normalizeOptions(options) {
  const byKey = /* @__PURE__ */ new Map();
  for (const option of options) {
    const candidate = structuredClone(option);
    const existing = byKey.get(candidate.key);
    if (existing !== void 0 && canonicalJson(existing) !== canonicalJson(candidate))
      throw new Error(`conflicting researched option ${candidate.key}`);
    byKey.set(candidate.key, candidate);
  }
  return [...byKey.values()].sort((left, right) => compare2(left.key, right.key));
}
function createResearchRecord(input) {
  const observedAt = Date.parse(input.observedAt);
  const validUntil = Date.parse(input.validUntil);
  if (!Number.isFinite(observedAt) || !Number.isFinite(validUntil) || validUntil < observedAt)
    throw new TypeError("research record requires a valid freshness interval");
  const semantic = { ...structuredClone(input), options: normalizeOptions(input.options), evidenceIds: unique2(input.evidenceIds), assumptions: unique2(input.assumptions), uncertainty: unique2(input.uncertainty) };
  return deepFreeze2({ ...semantic, semanticHash: hashFramedDomain("modernization-concern-research", semantic) });
}
async function researchConcern(input, ports) {
  const records = input.mode === "online" && ports.fetch !== void 0 ? [await ports.fetch(structuredClone(input.concern), normalizeOptions(input.candidateOptions))] : input.pinned.filter(({ concernId }) => concernId === input.concern.id);
  const valid = [];
  const byId = /* @__PURE__ */ new Map();
  const uncertainty = [];
  for (const record of records) {
    const { semanticHash, ...semantic } = structuredClone(record);
    if (semanticHash !== hashFramedDomain("modernization-concern-research", semantic))
      throw new Error(`research ${record.id} failed semantic authentication`);
    const serialized = canonicalJson(record);
    const existing = byId.get(record.id);
    if (existing !== void 0 && existing !== serialized)
      throw new Error(`conflicting research identity ${record.id}`);
    byId.set(record.id, serialized);
    const source = await ports.sources.read(record.sourceId, record.sourceRevision);
    if (source === void 0 || source.contentHash !== record.sourceContentHash)
      throw new Error(`research source revision authentication failed for ${record.sourceId}@${record.sourceRevision}`);
    if (source.metadataHash !== hashFramedDomain("authenticated-evidence-origin", { sourceId: record.sourceId, sourceRevision: record.sourceRevision, contentHash: source.contentHash, origin: source.origin, independenceKey: source.independenceKey }))
      throw new Error(`research source origin authentication failed for ${record.sourceId}@${record.sourceRevision}`);
    if (!source.current || Date.parse(record.validUntil) < Date.parse(input.now)) {
      uncertainty.push(`research ${record.id} is stale for concern ${input.concern.id}`);
      continue;
    }
    valid.push(structuredClone(record));
  }
  if (valid.length === 0)
    return { options: normalizeOptions(input.candidateOptions), evidenceIds: [], unavailable: true, uncertainty: unique2([...uncertainty, `${input.mode} current research unavailable for concern ${input.concern.id}`]), recordIds: [] };
  return { options: normalizeOptions(valid.flatMap(({ options }) => options)), evidenceIds: unique2(valid.flatMap(({ evidenceIds }) => evidenceIds)), unavailable: false, uncertainty: unique2(valid.flatMap((record) => [...record.assumptions.map((item) => `assumption: ${item}`), ...record.uncertainty])), recordIds: unique2(valid.map(({ id }) => id)) };
}
function validateViableEnumeration(concernId, dependency) {
  if (dependency.role !== "modernization-viable-options" || dependency.query.programId !== "modernization.viable-options" || dependency.query.input.concernId !== concernId)
    throw new Error("viable-option enumeration is not bound to the current concern");
  if (dependency.priorResult.queryHash !== dependency.query.semanticHash)
    throw new Error("viable-option enumeration query hash mismatch");
  const queryHash = hashFramedDomain("state-query", { kind: dependency.query.kind, programId: dependency.query.programId, programVersion: dependency.query.programVersion, input: dependency.query.input });
  if (dependency.query.semanticHash !== queryHash || !dependency.priorResult.dependencyKeys.includes(`concern:${concernId}`))
    throw new Error("viable-option enumeration query is unauthenticated");
  if (dependency.priorResult.observability !== "closed" || dependency.priorResult.unavailableLanes.length > 0)
    throw new Error("viable-option enumeration must be closed and available, including empty results");
}
async function recommend(input, ports) {
  const normalizedBase = createStateBinding(input.baseBinding);
  if (normalizedBase.dependencyDigest !== input.baseBinding.dependencyDigest)
    throw new Error("modernization base binding is unauthenticated");
  const enumerationEnvelope = await ports.enumeration.enumerate(structuredClone(input.concern), structuredClone(input.baseBinding.compiledAgainst));
  if (enumerationEnvelope.contentHash !== hashFramedDomain("authenticated-modernization-option-enumeration", enumerationEnvelope.value))
    throw new Error("viable-option enumeration store result is unauthenticated");
  const enumerated = enumerationEnvelope.value;
  validateViableEnumeration(input.concern.id, enumerated.dependency);
  if (!await ports.enumeration.assertCurrent(enumerated.dependency, input.baseBinding.compiledAgainst))
    throw new Error("viable-option enumeration is not current in the registered query store");
  const evaluationResult = await evaluateDecisionOptions({ concern: input.concern, options: enumerated.options, preferenceIds: input.preferenceIds, research: input.research, acceptance: input.acceptance, ...input.evaluatedAt === void 0 ? {} : { evaluatedAt: input.evaluatedAt } }, ports);
  const currentViableOptions = evaluationResult.evaluation.options.filter(({ hardConstraintStatus }) => hardConstraintStatus === "passes").map(({ key }) => key).sort(compare2);
  const viableResultHash = hashFramedDomain("modernization-viable-option-result", currentViableOptions);
  if (enumerated.dependency.priorResult.resultCount !== currentViableOptions.length || enumerated.dependency.priorResult.resultHash !== viableResultHash)
    throw new Error("viable-option enumeration is stale or unauthenticated");
  const evidenceIds = unique2([...input.problem.evidenceIds, ...input.problem.counterEvidenceIds, ...evaluationResult.evaluation.researchEvidenceIds, ...evaluationResult.evaluation.options.flatMap(({ evidence }) => evidence.map(({ evidenceId }) => evidenceId))]);
  const evidenceDependencies = [];
  for (const evidenceId of evidenceIds) {
    const evidenceEnvelope = await ports.evidence.read(evidenceId);
    if (evidenceEnvelope === void 0 || evidenceEnvelope.contentHash !== hashFramedDomain("authenticated-modernization-evidence", evidenceEnvelope.value) || evidenceEnvelope.value.id !== evidenceId || !evidenceEnvelope.value.current)
      throw new Error(`modernization evidence ${evidenceId} is unavailable, stale, or unauthenticated`);
    evidenceDependencies.push({ kind: "canonical-entity", id: evidenceId, versionHash: evidenceEnvelope.value.semanticHash, role: "modernization-evidence" });
  }
  const boundState = createStateBinding({ compiledAgainst: input.baseBinding.compiledAgainst, valueDependencies: [...input.baseBinding.valueDependencies, ...evidenceDependencies], queryDependencies: [...input.baseBinding.queryDependencies, enumerated.dependency] });
  const fashionReasons = unique2([
    ...input.problem.currentState.trim() === "" || input.problem.observedCost.trim() === "" || input.problem.targetOutcome.trim() === "" ? ["problem, observed cost, and target outcome must precede technology"] : [],
    ...input.problem.currentMeetsRequirementsAtLowerCost === true ? ["current state meets requirements at lower total cost"] : [],
    ...input.problem.targetSupportImmature === true ? ["target support is immature"] : [],
    ...input.problem.speculativeScaleBenefit === true ? ["benefit depends on speculative scale"] : [],
    ...input.problem.poorReversibility === true && input.problem.confidence < 0.8 ? ["reversibility is poor and evidence is weak"] : [],
    ...evidenceIds.length === 0 ? ["recommendation lacks authenticated observed evidence"] : [],
    ...input.problem.estimatedAffectedUnits === void 0 ? ["affected-unit denominator is unavailable"] : []
  ]);
  const stable = { concernId: input.concern.id, problem: structuredClone(input.problem), evaluationId: evaluationResult.evaluation.id, evaluationHash: evaluationResult.evaluation.semanticHash, boundState };
  const semanticHash = hashFramedDomain("modernization-upgrade-recommendation", stable);
  const recommendation = deepFreeze2({ id: `upgrade:${semanticHash.slice(-24)}`, concernId: input.concern.id, problem: structuredClone(input.problem), evaluationId: evaluationResult.evaluation.id, boundState, semanticHash });
  if (fashionReasons.some((reason) => reason !== "affected-unit denominator is unavailable"))
    return { status: "rejected", reasons: fashionReasons, recommendation, boundState, evaluation: evaluationResult.evaluation };
  if (evaluationResult.acceptanceBlocked || evaluationResult.evaluation.outcome !== "recommended" || evaluationResult.evaluation.recommendedOptionKey === void 0 || ports.approval === void 0)
    return { status: "candidate", reasons: unique2([...fashionReasons, ...evaluationResult.evaluation.unknowns]), recommendation, boundState, evaluation: evaluationResult.evaluation };
  const proof = await ports.approval.authenticate({ concernId: input.concern.id, evaluationId: evaluationResult.evaluation.id, recommendedOptionKey: evaluationResult.evaluation.recommendedOptionKey });
  const decisionValid = proof.decision.semanticHash === hashSemantic("architecture-decision", proof.decision) && proof.decision.concernId === input.concern.id && proof.decision.selectedOptionKey === evaluationResult.evaluation.recommendedOptionKey && proof.decision.governanceBasis.length > 0;
  const authorityValid = proof.authority.id === proof.decision.authorityRecordId && proof.authority.subjectId === input.concern.id && authorityRecordHashIsValid(proof.authority) && (proof.authority.status === "approved" || proof.authority.status === "auto-approved") && proof.authority.conclusion !== "unknown" && proof.authority.conclusion !== "exception";
  return proof.current && decisionValid && authorityValid ? { status: "approved", reasons: fashionReasons, recommendation, boundState, evaluation: evaluationResult.evaluation } : { status: "candidate", reasons: unique2([...fashionReasons, "current authority, decision, and governance basis are required"]), recommendation, boundState, evaluation: evaluationResult.evaluation };
}
var evaluateModernization = Object.freeze({ aggregateFriction, recommend });
function validateMigrationQuery(dependency, resultIds, programId) {
  if (dependency.query.programId !== programId || dependency.priorResult.queryHash !== dependency.query.semanticHash || dependency.priorResult.observability !== "closed" || dependency.priorResult.unavailableLanes.length > 0)
    throw new Error(`${programId} requires a current exhaustive closed query proof`);
  const expectedQueryHash = hashFramedDomain("state-query", { kind: dependency.query.kind, programId: dependency.query.programId, programVersion: dependency.query.programVersion, input: dependency.query.input });
  if (dependency.query.semanticHash !== expectedQueryHash)
    throw new Error(`${programId} query proof is unauthenticated`);
  const ids = unique2(resultIds);
  const resultHash = hashFramedDomain("state-query-result", ids.map((id) => ({ id })));
  if (dependency.priorResult.resultCount !== ids.length || dependency.priorResult.resultHash !== resultHash)
    throw new Error(`${programId} query results are unauthenticated`);
  if (programId === "modernization.residue-zero" && ids.length !== 0)
    throw new Error("upgrade cleanup requires authenticated zero residue");
}
async function compileUpgradePlan(input, ports) {
  if (input.approval.recommendationId !== input.recommendationId)
    throw new Error("upgrade approval is bound to another recommendation");
  const proof = await ports.approvals.authenticate(input.approval);
  if (!proof.current || !proof.decisionCurrent || !proof.governanceBasisCurrent || proof.recommendationHash !== input.approval.recommendationHash || proof.stateDependencyDigest !== input.approval.stateDependencyDigest)
    throw new Error("stale upgrade approval requires refresh or rebase");
  const kinds = new Set(input.phases.map(({ kind }) => kind));
  for (const required of ["compatibility-bridge", "all-consumers", "incremental-cutover", "residue-zero-cleanup"])
    if (!kinds.has(required))
      throw new Error(`upgrade migration is missing ${required}`);
  if (input.phases.length !== 4 || new Set(input.phases.map(({ key }) => key)).size !== input.phases.length)
    throw new Error("upgrade migration requires exactly one uniquely identified phase of each kind");
  if (input.phases.some(({ validatorIds }) => validatorIds.length === 0))
    throw new Error("every upgrade phase requires validation");
  const byKind = new Map(input.phases.map((phase) => [phase.kind, phase]));
  const bridge = byKind.get("compatibility-bridge");
  const consumers = byKind.get("all-consumers");
  const cutover = byKind.get("incremental-cutover");
  const residue = byKind.get("residue-zero-cleanup");
  if ((bridge.dependencies ?? []).length > 0 || canonicalJson(unique2(consumers.dependencies ?? [])) !== canonicalJson([bridge.key]) || canonicalJson(unique2(cutover.dependencies ?? [])) !== canonicalJson([consumers.key]) || canonicalJson(unique2(residue.dependencies ?? [])) !== canonicalJson([cutover.key]))
    throw new Error("upgrade phases must prove bridge \u2192 all consumers \u2192 cutover \u2192 residue-zero order");
  const closure = await ports.migrationProof.verify({ recommendationId: input.recommendationId, semanticChangeId: input.semanticChangeId });
  if (!closure.current)
    throw new Error("migration closure proof is stale");
  validateMigrationQuery(closure.consumerEnumeration, closure.consumerUnitIds, "modernization.all-consumers");
  validateMigrationQuery(closure.residueEnumeration, closure.residueUnitIds, "modernization.residue-zero");
  if (canonicalJson(unique2(consumers.unitIds)) !== canonicalJson(unique2(closure.consumerUnitIds)))
    throw new Error("all-consumers phase does not cover the authenticated exhaustive consumer set");
  const authenticatedChange = await ports.changes.read(input.semanticChangeId);
  if (authenticatedChange.contentHash !== hashFramedDomain("authenticated-change-planning-input", authenticatedChange.value))
    throw new Error("change planning input is unauthenticated");
  const closureBoundState = createStateBinding({ compiledAgainst: authenticatedChange.value.boundState.compiledAgainst, valueDependencies: authenticatedChange.value.boundState.valueDependencies, queryDependencies: [...authenticatedChange.value.boundState.queryDependencies, closure.consumerEnumeration, closure.residueEnumeration] });
  if (closureBoundState.dependencyDigest !== input.approval.stateDependencyDigest)
    throw new Error("migration closure no longer matches approved state");
  const closureChangeValue = { ...authenticatedChange.value, boundState: closureBoundState };
  const result = await compileSemanticChangePlan({ changeId: input.semanticChangeId, revision: input.revision, sourceRunId: input.sourceRunId }, {
    changes: { read: async () => ({ value: closureChangeValue, contentHash: hashFramedDomain("authenticated-change-planning-input", closureChangeValue) }) },
    packets: { compile: async () => {
      const proposals = input.phases.map((phase) => ({ key: phase.key, title: phase.title, stage: phase.kind === "compatibility-bridge" ? "bridge" : phase.kind === "all-consumers" ? "consumer" : phase.kind === "incremental-cutover" ? "cutover" : "cleanup", executionMode: "deterministic", transformId: phase.transformId, unitIds: [...phase.unitIds], semanticOwnerIds: [...phase.unitIds], writeSelectors: [...phase.writeSelectors], dependencies: [...phase.dependencies ?? []], validatorIds: [...phase.validatorIds] }));
      const completionContract = { requiredUnitStates: unique2(input.phases.flatMap(({ unitIds }) => unitIds)).map((unitId) => ({ unitId, state: "valid" })), requiredValidators: unique2(input.phases.flatMap(({ validatorIds }) => validatorIds)), requiredEvidenceLanes: ["test"], minimumValidationAssurance: "strong", requireIndependentValidation: true, maximumNewDivergences: 0, maximumUnknowns: 0, allowUnavailableExternalActions: false, requiredArtifacts: ["residue-zero-certificate", "rollback-checkpoints"], cleanWorkingTree: true };
      const value = { proposals, completionContract };
      return { value, contentHash: hashFramedDomain("authenticated-change-packet-proposals", value) };
    } },
    representations: ports.representations
  });
  if (result.plan.boundState.dependencyDigest !== input.approval.stateDependencyDigest)
    throw new Error("compiled upgrade plan no longer matches approved state");
  return result;
}

export {
  compileSemanticChangePlan,
  planGeneratedOutputRepair,
  createExecutionPlan,
  normalizeValidationSet,
  createExecutionCapsule,
  PlanningClaimConflictError,
  PlanningDependencyCycleError,
  PlanningFixedPointError,
  orderPlannedTransforms,
  convergePlannedTransforms,
  createFrictionObservation,
  createResearchRecord,
  researchConcern,
  evaluateModernization,
  compileUpgradePlan
};
