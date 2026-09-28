import {
  createExecutionPlan
} from "./shared-2U2MJHPJ.js";
import {
  BUILT_IN_QUERY_PROGRAM_IDS,
  assertMonotonicLensSelector,
  createBuiltInQueryDependency,
  createStateBinding,
  evaluateSelector,
  matchesCanonicalGlob,
  normalizeSelector,
  projectionUnitSelectorSubject,
  selectorHash,
  selectorLensDependencies
} from "./shared-HEBLUKDF.js";
import {
  AuthorityRecordSchema,
  CanonicalDocumentEnvelopeSchema,
  ConfidenceSchema,
  ContentHashSchema,
  DerivedObservationBudget,
  EntityIdSchema,
  EvidenceRefSchema,
  EvidenceSchema,
  LineageRecordSchema,
  NewSemanticBoundarySchema,
  ObservationError,
  SemanticIdentityCandidateSchema,
  StateBindingSchema,
  StateBindingValidationSchema,
  TombstoneSchema,
  buildManifest,
  canonicalJson,
  compileWriteAuthorization,
  hashFramedDomain,
  hashSemantic,
  manifestKey,
  normalizeRepositoryRelativePath,
  validateLineage
} from "./shared-AJ5KBTH5.js";

// node_modules/@projector/engine/dist/inference/index.js
var compareStrings = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var sortedUnique = (values) => [...new Set(values)].sort(compareStrings);
var isGenerated = (origin) => origin.kind === "model-inference" || origin.kind === "semantic-resolution" || origin.kind === "relevance-analysis" || origin.kind === "planning-surprise" || origin.kind === "lens-transform" || origin.kind === "plan" || origin.causedByLensId !== void 0 || origin.causedByRuleId !== void 0 || origin.causedByTransformId !== void 0 || origin.causedBySemanticChangeId !== void 0 || origin.causedByRelevanceClosureId !== void 0 || origin.causedByPlanningSurpriseId !== void 0 || origin.causedByPlanId !== void 0 || origin.causedByPacketId !== void 0;
var isEndogenous = (origin, target) => isGenerated(origin) || target.targetLensId !== void 0 && origin.causedByLensId === target.targetLensId || target.targetRuleId !== void 0 && origin.causedByRuleId === target.targetRuleId;
function groupCausalEvidence(evidence, options = {}) {
  const grouped = /* @__PURE__ */ new Map();
  for (const item of evidence) {
    const matchesClaim = options.claim === void 0 || item.claims.some((claim) => (options.claim?.subjectKey === void 0 || claim.subjectKey === options.claim.subjectKey) && (options.claim?.predicate === void 0 || claim.predicate === options.claim.predicate));
    if (!matchesClaim)
      continue;
    const key = item.independenceGroup.trim();
    if (key.length === 0)
      throw new Error(`evidence ${item.id} has an empty independence group`);
    const members = grouped.get(key) ?? [];
    members.push(item);
    grouped.set(key, members);
  }
  return [...grouped.entries()].sort(([left], [right]) => compareStrings(left, right)).map(([independenceGroup, members]) => {
    const ordered = [...members].sort((left, right) => compareStrings(left.id, right.id));
    const eligible2 = ordered.filter((item) => !isEndogenous(item.causalOrigin, options));
    const discounted = ordered.filter((item) => isEndogenous(item.causalOrigin, options));
    return {
      independenceGroup,
      evidenceIds: ordered.map(({ id }) => id),
      eligibleEvidenceIds: eligible2.map(({ id }) => id),
      discountedEvidenceIds: discounted.map(({ id }) => id),
      causalOriginKinds: sortedUnique(ordered.map(({ causalOrigin }) => causalOrigin.kind)),
      authorityEligible: eligible2.length > 0
    };
  });
}
function summarizeEvidenceSupport(input) {
  const groups = groupCausalEvidence(input.evidence, {
    ...input.targetLensId === void 0 ? {} : { targetLensId: input.targetLensId },
    ...input.targetRuleId === void 0 ? {} : { targetRuleId: input.targetRuleId }
  });
  const lanes = input.lanes ?? [{ id: "provided-evidence", observability: "closed" }];
  const proofCaveats = [];
  for (const lane of lanes) {
    if (lane.unavailable === true || lane.observability === "unavailable") {
      proofCaveats.push(`evidence lane ${lane.id} is unavailable`);
    } else if (lane.observability === "open" || lane.observability === "sampled") {
      proofCaveats.push(`evidence lane ${lane.id} is ${lane.observability} and cannot prove absence`);
    } else if ((lane.assumptions?.length ?? 0) > 0) {
      proofCaveats.push(`evidence lane ${lane.id} depends on boundary assumptions`);
    }
  }
  return {
    groups,
    independentOccurrenceCount: groups.filter(({ authorityEligible }) => authorityEligible).length,
    sourceEvidenceIds: input.evidence.filter(({ causalOrigin }) => !isGenerated(causalOrigin)).map(({ id }) => id).sort(compareStrings),
    generatedEvidenceIds: input.evidence.filter(({ causalOrigin }) => isGenerated(causalOrigin)).map(({ id }) => id).sort(compareStrings),
    absenceProven: input.evidence.length === 0 && proofCaveats.length === 0 && lanes.length > 0,
    proofCaveats: sortedUnique(proofCaveats)
  };
}
var evidenceRefKey = (reference) => `${reference.evidenceId}\0${reference.stance}\0${reference.weight ?? ""}`;
function normalizedEvidenceRefs(references) {
  const byKey = /* @__PURE__ */ new Map();
  for (const reference of references)
    byKey.set(evidenceRefKey(reference), structuredClone(reference));
  return [...byKey.entries()].sort(([left], [right]) => compareStrings(left, right)).map(([, reference]) => reference);
}
function inferPatternFamilies(observations) {
  const families = /* @__PURE__ */ new Map();
  for (const observation of observations) {
    const familyKey = observation.familyKey.trim();
    if (familyKey.length === 0)
      throw new Error("pattern family key cannot be empty");
    const existing = families.get(familyKey) ?? [];
    existing.push(observation);
    families.set(familyKey, existing);
  }
  return [...families.entries()].sort(([left], [right]) => compareStrings(left, right)).map(([key, entries]) => {
    const purposeHypotheses = sortedUnique(entries.map(({ purposeHypothesis }) => purposeHypothesis.trim()).filter(Boolean));
    if (purposeHypotheses.length !== 1)
      throw new Error(`pattern family ${key} has conflicting purpose hypotheses`);
    const members = entries.filter(({ classification }) => classification === "member");
    const independentGroups = sortedUnique(members.filter(({ unit }) => !isGenerated(unit.causalOrigin)).map(({ independenceGroup, unit }) => independenceGroup?.trim() || unit.id));
    const counterGroups = new Set(entries.filter(({ classification, unit }) => classification === "counterexample" && !isGenerated(unit.causalOrigin)).map(({ independenceGroup, unit }) => independenceGroup?.trim() || unit.id));
    const confidence = independentGroups.length === 0 ? 0 : independentGroups.length / (independentGroups.length + counterGroups.size + 1);
    const candidateWithoutHash = {
      id: `pattern:${key}`,
      key,
      purposeHypothesis: purposeHypotheses[0],
      memberUnitIds: sortedUnique(members.map(({ unit }) => unit.id)),
      excludedUnitIds: sortedUnique(entries.filter(({ classification }) => classification === "excluded").map(({ unit }) => unit.id)),
      counterExamples: sortedUnique(entries.filter(({ classification }) => classification === "counterexample").map(({ unit }) => unit.id)),
      independenceGroups: independentGroups,
      alternatives: sortedUnique(entries.flatMap(({ alternatives }) => alternatives ?? [])),
      confidence,
      evidence: normalizedEvidenceRefs(entries.flatMap(({ evidence }) => evidence))
    };
    return {
      ...candidateWithoutHash,
      semanticHash: hashFramedDomain("pattern-candidate", candidateWithoutHash)
    };
  });
}

// node_modules/@projector/engine/dist/authority/index.js
var AUTHORITY_ORDER = [
  "host-safety",
  "platform-constraint",
  "approved-user-intent",
  "active-lens",
  "adopted-external-standard",
  "migration-overlay",
  "local-convention",
  "inferred-candidate",
  "task-suggestion"
];
var authorityRanks = new Map(AUTHORITY_ORDER.map((authority, index) => [authority, index]));
function authorityRank(authority) {
  const rank = authorityRanks.get(authority);
  if (rank === void 0)
    throw new Error(`unknown authority class ${String(authority)}`);
  return rank;
}
function compareAuthority(left, right) {
  return authorityRank(left) - authorityRank(right);
}
function governanceBasisIsEndogenous(lensId, basis) {
  return basis.some((item) => item.kind === "active-lens" && item.lensId === lensId);
}
function assessLensAuthority(lens, records) {
  const record = records.find(({ id }) => id === lens.authorityRecordId);
  const reasons = [];
  if (governanceBasisIsEndogenous(lens.id, lens.governanceBasis)) {
    reasons.push(`lens ${lens.id} cannot cite itself as its governance basis`);
  }
  if (record === void 0) {
    reasons.push(`authority record ${lens.authorityRecordId} is missing`);
  } else {
    if (record.subjectId !== lens.id) {
      reasons.push(`authority record ${record.id} belongs to ${record.subjectId}, not lens ${lens.id}`);
    }
    if (record.status !== "approved" && record.status !== "auto-approved") {
      reasons.push(`authority record ${record.id} has non-active status ${record.status}`);
    }
    if (record.conclusion === "unknown" || record.conclusion === "exception") {
      reasons.push(`authority record ${record.id} does not authorize general lens activation`);
    }
  }
  return {
    eligible: reasons.length === 0,
    reasons,
    ...record === void 0 ? {} : { record: structuredClone(record) }
  };
}

// node_modules/@projector/engine/dist/governance/lenses.js
var compareStrings2 = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var sortedUnique2 = (values) => [...new Set(values)].sort(compareStrings2);
var LensCompilationError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "LensCompilationError";
  }
};
var GovernanceCycleError = class extends LensCompilationError {
  lensIds;
  constructor(lensIds) {
    super(`governance-cycle: recursive lens membership lacks declared fixed-point semantics (${sortedUnique2(lensIds).join(", ")})`);
    this.name = "GovernanceCycleError";
    this.lensIds = sortedUnique2(lensIds);
  }
};
var NonconvergentGovernanceError = class extends LensCompilationError {
  constructor(groupId, maxIterations) {
    super(`governance fixed-point group ${groupId} did not converge within ${maxIterations} iterations`);
    this.name = "NonconvergentGovernanceError";
  }
};
var LensOwnershipCollisionError = class extends LensCompilationError {
  constructor(unitId, role, lensIds) {
    super(`projection owner collision for unit ${unitId} role ${role}: ${sortedUnique2(lensIds).join(", ")}`);
    this.name = "LensOwnershipCollisionError";
  }
};
function lensMembershipFingerprint(lensId, memberRoot) {
  return hashFramedDomain("lens-membership/v2", { lensId, memberRoot });
}
function stronglyConnectedComponents(lenses) {
  const known = new Set(lenses.map(({ id }) => id));
  const knownIds = [...known].sort(compareStrings2);
  const graph = new Map(lenses.map((lens) => [lens.id, selectorLensDependencies(lens.selector, knownIds)]));
  let nextIndex = 0;
  const indexes = /* @__PURE__ */ new Map();
  const lowLinks = /* @__PURE__ */ new Map();
  const stack = [];
  const onStack = /* @__PURE__ */ new Set();
  const components = [];
  const connect = (id) => {
    indexes.set(id, nextIndex);
    lowLinks.set(id, nextIndex);
    nextIndex += 1;
    stack.push(id);
    onStack.add(id);
    for (const dependency of graph.get(id) ?? []) {
      if (!indexes.has(dependency)) {
        connect(dependency);
        lowLinks.set(id, Math.min(lowLinks.get(id), lowLinks.get(dependency)));
      } else if (onStack.has(dependency)) {
        lowLinks.set(id, Math.min(lowLinks.get(id), indexes.get(dependency)));
      }
    }
    if (lowLinks.get(id) === indexes.get(id)) {
      const component = [];
      let member;
      do {
        member = stack.pop();
        onStack.delete(member);
        component.push(member);
      } while (member !== id);
      const selfCycle = component.length === 1 && (graph.get(component[0]) ?? []).includes(component[0]);
      if (component.length > 1 || selfCycle)
        components.push(component.sort(compareStrings2));
    }
  };
  [...graph.keys()].sort(compareStrings2).forEach((id) => {
    if (!indexes.has(id))
      connect(id);
  });
  return components.sort((left, right) => compareStrings2(left.join("\0"), right.join("\0")));
}
function subjectWithMemberships(unit, memberships, facts = {}) {
  const subject = projectionUnitSelectorSubject(unit, facts);
  const computedLensIds = [...memberships.entries()].filter(([, memberIds]) => memberIds.has(unit.id)).map(([lensId]) => lensId);
  return {
    ...subject,
    values: {
      ...subject.values,
      lens: sortedUnique2([...subject.values.lens, ...computedLensIds])
    },
    dependencyKeys: sortedUnique2([
      ...subject.dependencyKeys,
      ...computedLensIds.map((lensId) => `lens-membership:${lensId}:${unit.id}`)
    ])
  };
}
function evaluateLensMembers(lens, units, memberships, facts, reserveMember) {
  const result = /* @__PURE__ */ new Set();
  for (const unit of units) {
    if (!evaluateSelector(lens.selector, subjectWithMemberships(unit, memberships, facts?.get(unit.id))).matched)
      continue;
    if (result.has(unit.id))
      continue;
    reserveMember?.(lens.id, unit.id);
    result.add(unit.id);
  }
  return result;
}
function sameSet(left, right) {
  return left.size === right.size && [...left].every((item) => right.has(item));
}
function validateLenses(lenses, authorityRecords) {
  const ids = /* @__PURE__ */ new Set();
  for (const lens of lenses) {
    if (ids.has(lens.id))
      throw new LensCompilationError(`duplicate lens stable ID ${lens.id}`);
    ids.add(lens.id);
    normalizeSelector(lens.selector);
    lens.expectedProjections.forEach(({ selector }) => normalizeSelector(selector));
    lens.impactRules.forEach(({ selector }) => normalizeSelector(selector));
    for (const rule of lens.rules) {
      normalizeSelector(rule.selector);
      for (const predicate of rule.predicates) {
        if (predicate.kind === "relation-required" || predicate.kind === "relation-forbidden") {
          normalizeSelector(predicate.targetSelector);
        } else if (predicate.kind === "cardinality") {
          normalizeSelector(predicate.selector);
        } else if (predicate.kind === "dependency-allowed" || predicate.kind === "dependency-forbidden") {
          normalizeSelector(predicate.from);
          normalizeSelector(predicate.to);
        }
      }
    }
    if (governanceBasisIsEndogenous(lens.id, lens.governanceBasis)) {
      throw new LensCompilationError(`lens ${lens.id} cannot cite itself as its governance basis`);
    }
    if (lens.status === "active") {
      const assessment = assessLensAuthority(lens, authorityRecords);
      if (!assessment.eligible)
        throw new LensCompilationError(assessment.reasons.join("; "));
      if (lens.governanceBasis.length === 0)
        throw new LensCompilationError(`active lens ${lens.id} lacks a typed governance basis`);
      if (lens.recognizers.length === 0 || lens.validators.length === 0 || lens.expectedProjections.length === 0) {
        throw new LensCompilationError(`active lens ${lens.id} lacks executable recognition, validation, or projection expectations`);
      }
    }
  }
}
function validateFixedPointGroups(cycles, groups, lenses) {
  const lensesById = new Map(lenses.map((lens) => [lens.id, lens]));
  const byLens = /* @__PURE__ */ new Map();
  for (const group of groups) {
    if (group.maxIterations < 1 || !Number.isSafeInteger(group.maxIterations)) {
      throw new LensCompilationError(`fixed-point group ${group.id} has an invalid iteration budget`);
    }
    for (const lensId of sortedUnique2(group.lensIds)) {
      if (!lensesById.has(lensId))
        throw new LensCompilationError(`fixed-point group ${group.id} references unknown lens ${lensId}`);
      if (byLens.has(lensId))
        throw new LensCompilationError(`lens ${lensId} belongs to multiple fixed-point groups`);
      byLens.set(lensId, group);
    }
    for (const lensId of sortedUnique2(group.lensIds)) {
      assertMonotonicLensSelector(lensesById.get(lensId).selector, group.lensIds);
    }
  }
  for (const cycle of cycles) {
    const group = byLens.get(cycle[0]);
    if (group === void 0 || cycle.some((lensId) => byLens.get(lensId)?.id !== group.id))
      throw new GovernanceCycleError(cycle);
    const declared = sortedUnique2(group.lensIds);
    if (declared.some((lensId) => cycle.includes(lensId)) && cycle.some((lensId) => !declared.includes(lensId))) {
      throw new GovernanceCycleError(cycle);
    }
  }
  return byLens;
}
function compileOwnership(lenses, units, memberships, facts) {
  const owners = /* @__PURE__ */ new Map();
  for (const lens of lenses.filter(({ status, contributions }) => status === "active" && contributions.includes("projection-owner"))) {
    for (const unit of units) {
      if (!(memberships.get(lens.id)?.has(unit.id) ?? false))
        continue;
      for (const projection of lens.expectedProjections) {
        if (projection.role !== unit.role)
          continue;
        if (!evaluateSelector(projection.selector, subjectWithMemberships(unit, memberships, facts?.get(unit.id))).matched)
          continue;
        const key = `${unit.id}\0${projection.role}`;
        const entries = owners.get(key) ?? /* @__PURE__ */ new Set();
        entries.add(lens.id);
        owners.set(key, entries);
      }
    }
  }
  for (const [key, lensIdSet] of owners) {
    const lensIds = [...lensIdSet].sort(compareStrings2);
    if (lensIds.length < 2)
      continue;
    const [unitId, role] = key.split("\0");
    throw new LensOwnershipCollisionError(unitId, role, lensIds);
  }
}
function stabilizeAcyclicMemberships(lenses, units, memberships, iterationBudget, facts, reserveMember) {
  for (let iteration = 0; iteration <= iterationBudget; iteration += 1) {
    let changed = false;
    for (const lens of lenses) {
      const next = evaluateLensMembers(lens, units, memberships, facts, reserveMember);
      if (!sameSet(memberships.get(lens.id), next)) {
        memberships.set(lens.id, next);
        changed = true;
      }
    }
    if (!changed)
      return;
  }
  throw new GovernanceCycleError(lenses.map(({ id }) => id));
}
function compileProjectionLenses(input) {
  const derivedBudget = input.derivedBudget ?? new DerivedObservationBudget();
  const chargedMembers = /* @__PURE__ */ new Map();
  const reserveMember = (lensId, unitId) => {
    const charged = chargedMembers.get(lensId);
    if (charged?.has(unitId))
      return;
    derivedBudget.reserve(256 + 4 * (lensId.length + unitId.length), "lens-membership", lensId);
    if (charged === void 0)
      chargedMembers.set(lensId, /* @__PURE__ */ new Set([unitId]));
    else
      charged.add(unitId);
  };
  const lenses = [...input.lenses].sort((left, right) => compareStrings2(left.id, right.id));
  const units = [...input.units].sort((left, right) => compareStrings2(left.id, right.id));
  validateLenses(lenses, input.authorityRecords);
  const cycles = stronglyConnectedComponents(lenses);
  const fixedPointGroups = input.fixedPointGroups ?? [];
  const groupByLens = validateFixedPointGroups(cycles, fixedPointGroups, lenses);
  const memberships = new Map(lenses.map(({ id }) => [id, /* @__PURE__ */ new Set()]));
  const fixedPointIterations = {};
  const acyclic = lenses.filter((lens) => !groupByLens.has(lens.id));
  stabilizeAcyclicMemberships(acyclic, units, memberships, lenses.length, input.selectorFactsByUnitId, reserveMember);
  const groups = [...new Map(fixedPointGroups.map((group) => [group.id, group])).values()].sort((left, right) => compareStrings2(left.id, right.id));
  for (const group of groups) {
    const groupLenses = lenses.filter(({ id }) => group.lensIds.includes(id));
    let changeRounds = 0;
    let converged = false;
    for (let iteration = 0; iteration < group.maxIterations; iteration += 1) {
      const proposals = new Map(groupLenses.map((lens) => [lens.id, evaluateLensMembers(lens, units, memberships, input.selectorFactsByUnitId, reserveMember)]));
      let changed = false;
      for (const lens of groupLenses) {
        const current = memberships.get(lens.id);
        const next = /* @__PURE__ */ new Set([...current, ...proposals.get(lens.id) ?? []]);
        if (!sameSet(current, next)) {
          memberships.set(lens.id, next);
          changed = true;
        }
      }
      if (!changed) {
        converged = true;
        break;
      }
      changeRounds += 1;
    }
    if (!converged)
      throw new NonconvergentGovernanceError(group.id, group.maxIterations);
    fixedPointIterations[group.id] = changeRounds;
  }
  stabilizeAcyclicMemberships(acyclic, units, memberships, lenses.length, input.selectorFactsByUnitId, reserveMember);
  compileOwnership(lenses, units, memberships, input.selectorFactsByUnitId);
  const membershipObject = Object.fromEntries([...memberships.entries()].sort(([left], [right]) => compareStrings2(left, right)).map(([lensId, memberIds]) => [lensId, [...memberIds].sort(compareStrings2)]));
  const membershipFingerprints = Object.fromEntries(Object.entries(membershipObject).map(([lensId, memberIds]) => [
    lensId,
    lensMembershipFingerprint(lensId, buildManifest(memberIds.map((id) => ({ key: manifestKey(id), value: id }))).root)
  ]));
  const activeRules = lenses.filter(({ status }) => status === "active").flatMap(({ rules }) => rules).sort((left, right) => compareStrings2(left.id, right.id));
  return { memberships: membershipObject, membershipFingerprints, activeRules, fixedPointIterations };
}
function createRepositoryScriptLens(input) {
  const id = input.id ?? "lens:repository-script";
  const selector = input.selector ?? { op: "atom", field: "tag", matcher: "equals", value: "repository-automation" };
  const pathRuleWithoutHash = {
    id: `${id}:placement`,
    key: `${id}:placement`,
    version: "1",
    effect: "require",
    authorityClass: "active-lens",
    governanceBasis: structuredClone(input.governanceBasis),
    selector: structuredClone(selector),
    predicates: [{ kind: "path-under", root: "scripts" }],
    rationale: "repository automation belongs under scripts",
    evidence: [],
    conflictPolicy: "error",
    validatorIds: ["repository-script-placement@1"],
    transformIds: ["move-repository-script@1"]
  };
  const testRuleWithoutHash = {
    id: `${id}:test-colocation`,
    key: `${id}:test-colocation`,
    version: "1",
    effect: "require",
    authorityClass: "active-lens",
    governanceBasis: structuredClone(input.governanceBasis),
    selector: structuredClone(selector),
    predicates: [{
      kind: "relation-required",
      relation: "verifies",
      targetSelector: { op: "atom", field: "artifact-role", matcher: "equals", value: "test" }
    }],
    rationale: "repository automation has colocated verification",
    evidence: [],
    conflictPolicy: "error",
    validatorIds: ["repository-script-test-colocation@1"],
    transformIds: ["move-repository-script@1"]
  };
  const rules = [pathRuleWithoutHash, testRuleWithoutHash].map((rule) => ({
    ...rule,
    semanticHash: hashFramedDomain("rule", rule)
  }));
  const lensWithoutHash = {
    id,
    key: id,
    version: "1",
    status: input.status,
    purpose: "keep repository-wide automation and its tests under scripts",
    realizesConceptKinds: ["capability"],
    selector: structuredClone(selector),
    contributions: ["projection-owner", "constraint-contributor", "validator-contributor"],
    expectedProjections: [{
      role: "implementation",
      cardinality: "many",
      surfaceKind: "repository",
      selector: structuredClone(selector),
      control: { ownership: "shared", mutation: "transform", actuation: "approval" },
      expectation: {
        kind: "predicate-constrained",
        predicateIds: rules.map(({ id: ruleId }) => ruleId),
        validatorIds: ["repository-script-placement@1", "repository-script-test-colocation@1"]
      }
    }],
    rules,
    impactRules: [],
    recognizers: [{
      id: "repository-script-recognizer",
      version: "1",
      adapterId: "projection-unit-facts",
      query: { tags: ["repository-automation"] },
      minimumConfidence: 0.8
    }],
    validators: [{
      id: "repository-script-validator",
      version: "1",
      provider: "deterministic-governance",
      input: { ruleIds: rules.map(({ id: ruleId }) => ruleId) },
      required: true,
      requiredIndependenceGroup: "repository-script-validator@1"
    }],
    transforms: [{ id: "move-repository-script", version: "1", input: { root: "scripts" }, exclusiveUnitClaim: true }],
    migrations: [],
    conflictsWith: [],
    compatibleWith: [],
    examples: [],
    counterExamples: [],
    authorityRecordId: input.authorityRecordId,
    governanceBasis: structuredClone(input.governanceBasis)
  };
  return { ...lensWithoutHash, semanticHash: hashFramedDomain("projection-lens", lensWithoutHash) };
}

// node_modules/@projector/engine/dist/governance/rules.js
var compareStrings3 = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var sortedUnique3 = (values) => [...new Set(values)].sort(compareStrings3);
var RuleCompilationError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "RuleCompilationError";
  }
};
var GovernanceConflictError = class extends Error {
  bundle;
  constructor(bundle) {
    super(`governance compilation for unit ${bundle.unitId} has ${bundle.conflicts.length} blocking conflict(s)`);
    this.name = "GovernanceConflictError";
    this.bundle = structuredClone(bundle);
  }
};
function isHardRule(rule) {
  return rule.effect === "require" || rule.effect === "forbid" || rule.effect === "restrict" || rule.effect === "grant" || rule.effect === "validate" && (rule.predicates.length > 0 || rule.validatorIds.length > 0);
}
function selectorSpecificity(selector) {
  let atoms = 0;
  let exact = 0;
  let negations = 0;
  const visit = (expression) => {
    if (expression.op === "all" || expression.op === "any")
      expression.items.forEach(visit);
    else if (expression.op === "not") {
      negations += 1;
      visit(expression.item);
    } else {
      atoms += 1;
      if (expression.matcher === "equals" || expression.matcher === "in" || expression.matcher === "exists")
        exact += 1;
    }
  };
  visit(normalizeSelector(selector));
  return [exact, atoms, negations];
}
function compareSpecificity(left, right) {
  const leftTuple = [...selectorSpecificity(left.selector), left.predicates.length];
  const rightTuple = [...selectorSpecificity(right.selector), right.predicates.length];
  for (let index = 0; index < leftTuple.length; index += 1) {
    const difference = rightTuple[index] - leftTuple[index];
    if (difference !== 0)
      return difference;
  }
  return compareStrings3(left.id, right.id);
}
function compareRules(left, right) {
  const authorityDifference = authorityRank(left.authorityClass) - authorityRank(right.authorityClass);
  return authorityDifference !== 0 ? authorityDifference : compareSpecificity(left, right);
}
function validateHardRule(rule) {
  if (!isHardRule(rule))
    return;
  if (rule.predicates.length === 0 && rule.validatorIds.length === 0) {
    throw new RuleCompilationError(`blocking rule ${rule.id} has no normalized predicate or validator`);
  }
  if (rule.effect === "grant" && rule.predicates.some((predicate) => predicate.kind !== "permission")) {
    throw new RuleCompilationError(`grant rule ${rule.id} may only contain permission predicates`);
  }
}
function normalizePredicate(predicate) {
  const cloned = structuredClone(predicate);
  if (cloned.kind === "relation-required" || cloned.kind === "relation-forbidden") {
    return { ...cloned, targetSelector: normalizeSelector(cloned.targetSelector) };
  }
  if (cloned.kind === "cardinality")
    return { ...cloned, selector: normalizeSelector(cloned.selector) };
  if (cloned.kind === "dependency-allowed" || cloned.kind === "dependency-forbidden") {
    return { ...cloned, from: normalizeSelector(cloned.from), to: normalizeSelector(cloned.to) };
  }
  return cloned;
}
function normalizeRule(rule) {
  const cloned = structuredClone(rule);
  return {
    ...cloned,
    selector: normalizeSelector(cloned.selector),
    predicates: cloned.predicates.map(normalizePredicate),
    transformIds: sortedUnique3(cloned.transformIds)
  };
}
function sameSelector(left, right) {
  return canonicalJson(normalizeSelector(left)) === canonicalJson(normalizeSelector(right));
}
function conflictBetweenPredicates(left, right) {
  if (left.kind === "permission" && right.kind === "permission" && left.operation === right.operation && left.allowed !== right.allowed) {
    return { kind: "incompatible-predicate", explanation: `permission ${left.operation} is both allowed and denied` };
  }
  if (left.kind === "path-under" && right.kind === "path-not-under" && left.root === right.root || left.kind === "path-not-under" && right.kind === "path-under" && left.root === right.root) {
    return { kind: "incompatible-predicate", explanation: `path is both required under and forbidden under ${left.root}` };
  }
  if (left.kind === "relation-required" && right.kind === "relation-forbidden" && left.relation === right.relation && sameSelector(left.targetSelector, right.targetSelector) || left.kind === "relation-forbidden" && right.kind === "relation-required" && left.relation === right.relation && sameSelector(left.targetSelector, right.targetSelector)) {
    return { kind: "incompatible-predicate", explanation: `relation ${left.relation} is both required and forbidden` };
  }
  if (left.kind === "dependency-allowed" && right.kind === "dependency-forbidden" && sameSelector(left.from, right.from) && sameSelector(left.to, right.to) || left.kind === "dependency-forbidden" && right.kind === "dependency-allowed" && sameSelector(left.from, right.from) && sameSelector(left.to, right.to)) {
    return { kind: "incompatible-predicate", explanation: "the same dependency is both allowed and forbidden" };
  }
  if (left.kind === "unit-state" && right.kind === "unit-state" && left.state !== right.state) {
    return { kind: "incompatible-predicate", explanation: `unit state cannot be both ${left.state} and ${right.state}` };
  }
  if (left.kind === "cardinality" && right.kind === "cardinality" && sameSelector(left.selector, right.selector)) {
    const leftMin = left.min ?? 0;
    const rightMin = right.min ?? 0;
    const leftMax = left.max ?? Number.POSITIVE_INFINITY;
    const rightMax = right.max ?? Number.POSITIVE_INFINITY;
    if (Math.max(leftMin, rightMin) > Math.min(leftMax, rightMax)) {
      return { kind: "incompatible-predicate", explanation: "cardinality ranges do not overlap" };
    }
  }
  return void 0;
}
function rulePairConflict(left, right) {
  for (const leftPredicate of left.predicates) {
    for (const rightPredicate of right.predicates) {
      const conflict = conflictBetweenPredicates(leftPredicate, rightPredicate);
      if (conflict !== void 0)
        return conflict;
      if (canonicalJson(leftPredicate) === canonicalJson(rightPredicate) && (left.effect === "require" && right.effect === "forbid" || left.effect === "forbid" && right.effect === "require")) {
        return { kind: "require-forbid", explanation: "the same normalized state is both required and forbidden" };
      }
    }
  }
  if (left.effect === "transform" && right.effect === "transform" && canonicalJson(left.transformIds) !== canonicalJson(right.transformIds)) {
    return { kind: "exclusive-transform", explanation: "exclusive transforms claim the same unit" };
  }
  return void 0;
}
function evidenceIds(left, right) {
  return [...new Set([...left.evidence, ...right.evidence].map(({ evidenceId }) => evidenceId))].sort(compareStrings3);
}
function compileEffectiveRuleBundle(input) {
  const facts = { ...input.selectorFacts, operation: input.operation };
  const subject = projectionUnitSelectorSubject(input.unit, facts);
  const selected = input.rules.map(normalizeRule).filter((rule) => evaluateSelector(rule.selector, subject).matched).sort(compareRules);
  selected.forEach(validateHardRule);
  const suppressed = /* @__PURE__ */ new Map();
  const conflicts = [];
  for (let leftIndex = 0; leftIndex < selected.length; leftIndex += 1) {
    const left = selected[leftIndex];
    if (!isHardRule(left) && left.effect !== "transform")
      continue;
    for (let rightIndex = leftIndex + 1; rightIndex < selected.length; rightIndex += 1) {
      const right = selected[rightIndex];
      if (!isHardRule(right) && right.effect !== "transform")
        continue;
      const predicateConflict = rulePairConflict(left, right);
      if (predicateConflict === void 0)
        continue;
      const leftRank = authorityRank(left.authorityClass);
      const rightRank = authorityRank(right.authorityClass);
      if (leftRank < rightRank && right.conflictPolicy === "higher-authority") {
        suppressed.set(right.id, { ruleId: right.id, reason: "suppressed by explicitly configured higher authority", supersededBy: left.id });
        continue;
      }
      conflicts.push({
        ruleIds: [left.id, right.id].sort(compareStrings3),
        unitId: input.unit.id,
        kind: leftRank === rightRank ? predicateConflict.kind : "authority-override",
        explanation: leftRank === rightRank ? predicateConflict.explanation : `${right.id} (${right.authorityClass}) attempts to override ${left.id} (${left.authorityClass})`,
        evidenceIds: evidenceIds(left, right)
      });
    }
  }
  const unsuppressedHardRules = selected.filter((rule) => isHardRule(rule) && !suppressed.has(rule.id));
  const predicatesByKey = /* @__PURE__ */ new Map();
  for (const rule of unsuppressedHardRules) {
    for (const predicate of rule.predicates)
      predicatesByKey.set(canonicalJson(predicate), structuredClone(predicate));
  }
  const predicates = [...predicatesByKey.entries()].sort(([left], [right]) => compareStrings3(left, right)).map(([, predicate]) => predicate);
  const evaluations = selected.map((rule) => ({
    ruleId: rule.id,
    selectorHash: hashFramedDomain("selector", normalizeSelector(rule.selector)),
    inputFingerprint: evaluateSelector(rule.selector, subject).inputFingerprint
  }));
  const dependencyFingerprint = hashFramedDomain("effective-rule-dependencies", {
    unitId: input.unit.id,
    operation: input.operation,
    unitMembershipHash: input.unit.membershipHash,
    evaluations
  });
  const normalizedConflicts = [...new Map(conflicts.map((conflict) => [canonicalJson(conflict), conflict])).entries()].sort(([left], [right]) => compareStrings3(left, right)).map(([, conflict]) => conflict);
  const suppressedRules = [...suppressed.values()].sort((left, right) => compareStrings3(left.ruleId, right.ruleId));
  const bundleWithoutHash = {
    unitId: input.unit.id,
    operation: input.operation,
    rules: selected,
    suppressedRules,
    predicates,
    conflicts: normalizedConflicts,
    dependencyFingerprint
  };
  return {
    ...bundleWithoutHash,
    bundleHash: hashFramedDomain("effective-rule-bundle", bundleWithoutHash)
  };
}
function assertGovernable(bundle) {
  if (bundle.conflicts.length > 0)
    throw new GovernanceConflictError(bundle);
  return bundle;
}

// node_modules/@projector/engine/dist/governance/evaluation.js
function governancePopulationEntry(selector, subject) {
  const matched = matches(selector, subject);
  return matched === false ? void 0 : { key: manifestKey(subject.id), value: { id: subject.id, matched: matched ?? null } };
}
function summarizeGovernanceManifest(root, knownCount, unknownCount) {
  return {
    knownCount,
    unknownCount,
    fingerprint: hashFramedDomain("governance-selector-population/v2", { root, knownCount, unknownCount })
  };
}
function buildGovernancePopulation(selector, subjects) {
  const entries = subjects.flatMap((subject) => {
    const entry = governancePopulationEntry(selector, subject);
    return entry === void 0 ? [] : [entry];
  });
  const manifest = buildManifest(entries);
  const known = entries.filter(({ value }) => value.matched === true).length;
  return { summary: summarizeGovernanceManifest(manifest.root, known, entries.length - known), manifest };
}
function summarizeGovernancePopulation(selector, subjects) {
  return buildGovernancePopulation(selector, subjects).summary;
}
var strings = (values) => [...new Set(values)].sort();
var unique = (values) => [...new Map(values.map((value) => [canonicalJson(value), value])).entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, value]) => value);
var check = (status, reason, evidenceIds2 = []) => ({ status, reason, evidenceIds: strings(evidenceIds2) });
var eligible = (contract) => contract !== void 0 && (contract.observability === "closed" || contract.observability === "bounded") && contract.dynamicMechanisms.length === 0;
function matches(selector, subject) {
  if (selector.op === "all" || selector.op === "any") {
    const children = selector.items.map((item) => matches(item, subject));
    if (selector.op === "all")
      return children.includes(false) ? false : children.includes(void 0) ? void 0 : true;
    return children.includes(true) ? true : children.includes(void 0) ? void 0 : false;
  }
  if (selector.op === "not") {
    const matched = matches(selector.item, subject);
    return matched === void 0 ? void 0 : !matched;
  }
  if (subject.values[selector.field] === void 0)
    return void 0;
  try {
    return evaluateSelector(selector, subject).matched;
  } catch {
    return void 0;
  }
}
function canonicalPath(value) {
  if (typeof value !== "string" || value.includes("\\"))
    return void 0;
  const normalized = normalizeRepositoryRelativePath(value);
  return normalized === value ? normalized : void 0;
}
function evaluateEffectiveRuleBundle(bundle, observation, options = {}) {
  return prepareGovernanceEvaluator(observation, options.validatorFindings)(bundle, options);
}
function prepareGovernanceEvaluator(input, findings = []) {
  const observation = structuredClone(input);
  const subjects = /* @__PURE__ */ new Map();
  for (const subject of observation.subjects) {
    if (subjects.has(subject.id))
      throw new Error(`duplicate governance subject ${subject.id}`);
    subjects.set(subject.id, { ...subject, dependencyKeys: strings(subject.dependencyKeys) });
  }
  const unitIds = strings(observation.unitIds);
  if (unitIds.length !== observation.unitIds.length || unitIds.some((id) => !subjects.has(id)))
    throw new Error("invalid or duplicate enumerated governance unit");
  const enumerations = /* @__PURE__ */ new Map();
  for (const enumeration of observation.dependencyEnumerations) {
    if (enumerations.has(enumeration.unitId))
      throw new Error(`duplicate dependency enumeration ${enumeration.unitId}`);
    enumerations.set(enumeration.unitId, { ...enumeration, unknowns: strings(enumeration.unknowns) });
  }
  const dependencies = unique(observation.dependencies.map((edge) => ({ ...edge, evidenceIds: strings(edge.evidenceIds) })));
  const outgoingByUnit = /* @__PURE__ */ new Map();
  for (const edge of dependencies) {
    const outgoing = outgoingByUnit.get(edge.fromUnitId) ?? [];
    outgoing.push(edge);
    outgoingByUnit.set(edge.fromUnitId, outgoing);
  }
  const populations = /* @__PURE__ */ new Map();
  return prepareIndexedGovernanceEvaluator({
    unitEnumeration: observation.unitEnumeration,
    subject: (id) => subjects.get(id),
    outgoing: (id) => outgoingByUnit.get(id) ?? [],
    enumeration: (id) => enumerations.get(id),
    cardinality: (selector) => {
      const key = hashFramedDomain("governance-selector", selector);
      let population = populations.get(key);
      if (population === void 0) {
        population = summarizeGovernancePopulation(selector, unitIds.map((id) => subjects.get(id)));
        populations.set(key, population);
      }
      return population;
    }
  }, findings);
}
function prepareIndexedGovernanceEvaluator(observation, findings = []) {
  const findingsByUnit = /* @__PURE__ */ new Map();
  for (const finding of structuredClone(findings)) {
    const unitFindings = findingsByUnit.get(finding.unitId) ?? [];
    unitFindings.push(finding);
    findingsByUnit.set(finding.unitId, unitFindings);
  }
  const validatorObservations = /* @__PURE__ */ new Map();
  return (bundle, options = {}) => {
    let validatorObservation = validatorObservations.get(bundle.unitId);
    if (validatorObservation === void 0) {
      const unitFindings = /* @__PURE__ */ new Map();
      for (const finding of findingsByUnit.get(bundle.unitId) ?? []) {
        if (unitFindings.has(finding.validatorId))
          throw new Error(`duplicate validator observation ${finding.validatorId} for ${bundle.unitId}`);
        unitFindings.set(finding.validatorId, finding);
      }
      validatorObservation = unitFindings;
      validatorObservations.set(bundle.unitId, validatorObservation);
    }
    const validatorCheck = (validatorId) => {
      const finding = validatorObservation.get(validatorId);
      return finding === void 0 ? check("unknown", `Validator ${validatorId} has no registered evaluator for this rule.`) : check(finding.status, finding.reason, finding.evidenceIds);
    };
    const subject = observation.subject(bundle.unitId);
    const enumeration = observation.enumeration(bundle.unitId);
    const outgoing = unique(observation.outgoing(bundle.unitId).map((edge) => ({ ...edge, evidenceIds: strings(edge.evidenceIds) })));
    const targets = new Map(outgoing.flatMap(({ toSubjectId }) => toSubjectId === void 0 ? [] : [[toSubjectId, observation.subject(toSubjectId)]]));
    const populations = /* @__PURE__ */ new Map();
    const suppressed = new Set(bundle.suppressedRules.map(({ ruleId }) => ruleId));
    const rules = bundle.rules.filter((rule) => isHardRule(rule) && !suppressed.has(rule.id));
    const allowed = rules.filter((rule) => rule.effect !== "forbid").flatMap((rule) => rule.predicates).filter((predicate) => predicate.kind === "dependency-allowed");
    const evaluate = (predicate) => {
      if (subject === void 0)
        return check("unknown", "The governed unit is not present in the observation.");
      if (predicate.kind === "validator")
        return validatorCheck(predicate.validatorId);
      if (predicate.kind === "path-under" || predicate.kind === "path-not-under") {
        const path = canonicalPath(subject.values.path);
        const root = canonicalPath(predicate.root);
        if (path === void 0 || root === void 0)
          return check("unknown", "A canonical repository path or predicate root is unavailable.");
        const under = path === root || path.startsWith(`${root}/`);
        const satisfied = predicate.kind === "path-under" ? under : !under;
        return check(satisfied ? "satisfied" : "violated", `${path} ${under ? "is" : "is not"} under ${root}.`, subject.dependencyKeys);
      }
      if (predicate.kind === "dependency-forbidden" || predicate.kind === "dependency-allowed") {
        const from = matches(predicate.from, subject);
        if (from === void 0)
          return check("unknown", "Dependency source selector facts are incomplete.");
        if (!from)
          return check("satisfied", "The dependency predicate does not apply to this source.");
        let incomplete = !eligible(enumeration?.contract) || (enumeration?.unknowns.length ?? 0) > 0;
        const allowedTargets = allowed.filter((item) => matches(item.from, subject) === true).map((item) => item.to);
        const unknownAllowedSource = allowed.some((item) => matches(item.from, subject) === void 0);
        const violationEvidence = [];
        const violatedSpecifiers = [];
        for (const edge of outgoing) {
          const target = edge.toSubjectId === void 0 ? void 0 : targets.get(edge.toSubjectId);
          if (target === void 0) {
            incomplete = true;
            continue;
          }
          const targetMatches = predicate.kind === "dependency-forbidden" ? matches(predicate.to, target) : matches({ op: "any", items: allowedTargets }, target);
          if (targetMatches === void 0) {
            incomplete = true;
            continue;
          }
          const violation = predicate.kind === "dependency-forbidden" ? targetMatches : !targetMatches;
          if (violation && predicate.kind === "dependency-allowed" && unknownAllowedSource) {
            incomplete = true;
            continue;
          }
          if (violation) {
            violatedSpecifiers.push(edge.specifier);
            violationEvidence.push(...edge.evidenceIds);
          }
        }
        if (violatedSpecifiers.length > 0)
          return check("violated", `Observed dependencies violate the boundary: ${strings(violatedSpecifiers).join(", ")}.`, violationEvidence);
        if (incomplete)
          return check("unknown", `Dependency conformance is not established: ${enumeration?.unknowns.join("; ") || "incomplete dependency observations"}.`);
        return check("satisfied", "Observed dependencies satisfy the predicate within the declared enumeration boundary.", outgoing.flatMap((edge) => edge.evidenceIds));
      }
      if (predicate.kind === "cardinality") {
        const { min, max } = predicate;
        if (min === void 0 && max === void 0 || [min, max].some((value) => value !== void 0 && (!Number.isSafeInteger(value) || value < 0)) || min !== void 0 && max !== void 0 && min > max)
          return check("unknown", "Invalid cardinality bounds.");
        const selectorHash2 = hashFramedDomain("governance-selector", predicate.selector);
        if (!populations.has(selectorHash2))
          populations.set(selectorHash2, observation.cardinality(predicate.selector));
        const population = populations.get(selectorHash2);
        if (population === void 0)
          return check("unknown", "The complete cardinality population is unavailable.");
        const count = population.knownCount;
        if (max !== void 0 && count > max)
          return check("violated", `${count} observed members exceed maximum ${max}.`);
        if (!eligible(observation.unitEnumeration) || population.unknownCount > 0)
          return check("unknown", `Only ${count} members are known in an incomplete universe.`);
        if (min !== void 0 && count < min)
          return check("violated", `${count} members are below minimum ${min}.`);
        return check("satisfied", `${count} observed members satisfy cardinality.`);
      }
      return check("unknown", `Predicate ${predicate.kind} has no registered evaluator.`);
    };
    const findings2 = [];
    const add = (ruleId, predicate, result2) => {
      const predicateHash = hashFramedDomain("governance-predicate", predicate);
      const id = hashFramedDomain("governance-finding", { unitId: bundle.unitId, ruleId, predicateHash, ...result2 });
      findings2.push({ id, unitId: bundle.unitId, ruleId, predicateHash, ...result2 });
    };
    for (const rule of rules) {
      for (const predicate of unique(rule.predicates)) {
        add(rule.id, predicate, ["require", "validate", "restrict"].includes(rule.effect) ? evaluate(predicate) : check("unknown", `Rule effect ${rule.effect} has no registered execution semantics.`));
      }
      for (const validatorId of strings(rule.validatorIds)) {
        const builtin = validatorId === "projector.builtin.static-dependency-boundary@1" && rule.predicates.length > 0 && rule.predicates.every((predicate) => predicate.kind === "dependency-forbidden" || predicate.kind === "dependency-allowed");
        if (!builtin)
          add(rule.id, { validatorId }, validatorCheck(validatorId));
      }
    }
    const referencedValidators = new Set(rules.flatMap((rule) => [...rule.validatorIds, ...rule.predicates.flatMap((predicate) => predicate.kind === "validator" ? [predicate.validatorId] : [])]));
    for (const validatorId of strings(options.requiredValidatorIds ?? [])) {
      if (!referencedValidators.has(validatorId))
        add(`validator:${validatorId}`, { validatorId }, validatorCheck(validatorId));
    }
    for (const conflict of bundle.conflicts)
      add(conflict.ruleIds.join(","), conflict, check("violated", conflict.explanation, conflict.evidenceIds));
    const ordered = unique(findings2);
    const status = ordered.some((item) => item.status === "violated") ? "violated" : ordered.length === 0 || ordered.some((item) => item.status === "unknown") ? "unknown" : "conformant";
    const boundary = strings([
      observation.unitEnumeration.method,
      ...observation.unitEnumeration.assumptions,
      ...observation.unitEnumeration.blindSpots,
      ...enumeration === void 0 ? [] : [enumeration.contract.method, ...enumeration.contract.assumptions, ...enumeration.contract.blindSpots]
    ]);
    const observationHash = hashFramedDomain("governance-observation/v2", {
      subject: subject ?? null,
      enumeration: enumeration ?? null,
      outgoing,
      targets: [...targets].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([id, value]) => ({ id, value: value ?? null })),
      unitEnumeration: observation.unitEnumeration,
      populations: [...populations].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([selector, value]) => ({ selector, value: value ?? null })),
      validatorFindings: unique([...validatorObservation.values()])
    });
    const result = { unitId: bundle.unitId, status, findings: ordered, boundary, observationHash };
    return { ...result, contentHash: hashFramedDomain("governance-bundle-evaluation", result) };
  };
}

// node_modules/@projector/engine/dist/change/compiler.js
var compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var unique2 = (values) => [...new Set(values)].sort(compare);
var riskRank = (risk) => ["R0", "R1", "R2", "R3", "R4"].indexOf(risk);
function operationSubject(operation) {
  if (operation.subjectType === "requirement")
    return `requirement:${operation.requirementId ?? operation.proposedRequirement?.id ?? "missing"}`;
  if (operation.subjectType === "scenario")
    return `scenario:${operation.scenarioId ?? operation.proposedScenario?.id ?? "missing"}`;
  return `${operation.subjectType}:${operation.subjectId ?? operation.subjectKey}`;
}
function normalizeOperations(proposals) {
  const accepted = /* @__PURE__ */ new Map();
  const candidates = /* @__PURE__ */ new Map();
  for (const proposal of proposals) {
    const operation = structuredClone(proposal.operation);
    const subject = operationSubject(operation);
    if (subject.endsWith(":missing") || subject.endsWith(":"))
      throw new Error("change operation requires a stable subject identity");
    const target = proposal.provenance === "authenticated" ? accepted : candidates;
    const existing = target.get(subject);
    if (existing !== void 0 && canonicalJson(existing) !== canonicalJson(operation))
      throw new Error(`conflicting change operations for ${subject}`);
    target.set(subject, existing ?? operation);
  }
  const sort = (values) => [...values].sort((a, b) => compare(operationSubject(a), operationSubject(b)) || compare(canonicalJson(a), canonicalJson(b)));
  return { accepted: sort(accepted.values()), candidates: sort(candidates.values()) };
}
function validateRelationIntegrity(operations, relations) {
  const relationOperations = new Set(operations.filter((operation) => operation.subjectType === "relation" && (operation.kind === "remove" || operation.kind === "replace")).map(operationSubject));
  for (const operation of operations) {
    if (operation.subjectType !== "requirement" && operation.subjectType !== "scenario" || operation.kind !== "remove" && operation.kind !== "supersede")
      continue;
    const subjectId = operation.subjectType === "requirement" ? operation.requirementId : operation.scenarioId;
    if (subjectId === void 0)
      throw new Error("remove/supersede operation requires an existing stable subject ID");
    for (const relation of relations.filter(({ subjectIds }) => subjectIds.includes(subjectId))) {
      if (!relationOperations.has(`relation:${relation.id}`))
        throw new Error(`change would leave dangling relation ${relation.id}`);
    }
  }
}
function minimumRisk(operations) {
  if (operations.some((operation) => operation.subjectType === "surface"))
    return "R3";
  if (operations.some((operation) => operation.subjectType === "decision" || operation.subjectType === "rule" || operation.subjectType === "relation"))
    return "R2";
  return operations.length === 0 ? "R0" : "R1";
}
async function compileSemanticChange(input, ports) {
  if (input.request.trim() === "")
    throw new Error("semantic change request must not be blank");
  const authenticated = await ports.facts.load(input.request, input.currentState);
  if (authenticated.contentHash !== hashFramedDomain("authenticated-change-compiler-facts", authenticated.value))
    throw new Error("change compiler facts hash is not authenticated");
  const facts = structuredClone(authenticated.value);
  if (facts.intentAnalysis.request !== input.request)
    throw new Error("authenticated intent request does not equal the compiler request");
  const { contentHash: _intentHash, ...intentFields } = facts.intentAnalysis;
  if (facts.intentAnalysis.contentHash !== hashFramedDomain("change-intent-analysis", intentFields))
    throw new Error("change intent analysis hash is invalid");
  if (facts.identityResolutionIds.length === 0 || facts.intentAnalysis.ambiguity.length > 0)
    throw new Error("semantic identity is missing or ambiguous");
  const allowedFacets = /* @__PURE__ */ new Set(["behavior", "architecture", "events", "security", "realtime", "migration", "public-contract", "persistence", "performance", "observability", "compatibility", "distribution", "cleanup", "external-surface"]);
  if (facts.analysisFacetKeys.some((key) => !allowedFacets.has(key)))
    throw new Error("analysis facet is unsupported or selects implementation technology");
  const requestedBinding = createStateBinding(facts.boundState);
  if (requestedBinding.dependencyDigest !== facts.boundState.dependencyDigest)
    throw new Error("semantic change StateBinding is invalid");
  const validation2 = await ports.bindingValidator.validate(requestedBinding, input.currentState, input.context);
  if (validation2.status !== "current" && validation2.status !== "rebound")
    throw new Error(`semantic change binding is ${validation2.status}`);
  const boundState = createStateBinding(validation2.status === "rebound" ? validation2.rebound : requestedBinding);
  if (canonicalJson(boundState.compiledAgainst) !== canonicalJson(input.currentState))
    throw new Error("semantic change binding is not current");
  if (!await ports.authority.verify({ subjectHash: authenticated.contentHash, binding: boundState, currentState: input.currentState }))
    throw new Error("semantic change compiler facts lack current authority");
  const normalized = normalizeOperations(facts.operations);
  validateRelationIntegrity(normalized.accepted, facts.relations);
  const architectureSubjects = /* @__PURE__ */ new Set(["requirement", "scenario", "decision", "rule", "relation", "surface"]);
  const material = normalized.accepted.some((operation) => architectureSubjects.has(operation.subjectType)) || facts.analysisFacetKeys.includes("architecture") || facts.intentAnalysis.statements.some(({ kind }) => kind === "constraint");
  let decisionIds = [];
  if (material) {
    const architecture = await ports.architecture.preflight(facts);
    if (architecture.contentHash !== hashFramedDomain("change-architecture-preflight", { allowed: architecture.allowed, decisionIds: architecture.decisionIds }) || !architecture.allowed)
      throw new Error("architecture preflight is unauthenticated or blocking");
    decisionIds = architecture.decisionIds;
  }
  const impact = await ports.impact.compile(facts);
  if (impact.contentHash !== hashFramedDomain("authenticated-impact-closure", impact.value))
    throw new Error("impact closure hash is invalid");
  const boundQueryIds = new Set(boundState.queryDependencies.map(({ query }) => query.id));
  if (impact.value.queryDependencyIds.some((id) => !boundQueryIds.has(id)))
    throw new Error("impact negative-space query is absent from the final StateBinding");
  if (impact.value.reasons.some(({ kind }) => kind === "open") && impact.value.possibleFrontierUnitIds.length === 0)
    throw new Error("open impact evidence must widen the possible frontier");
  const risk = await ports.risk.assess({ facts, impact: impact.value });
  if (risk.contentHash !== hashFramedDomain("authenticated-change-risk", risk.value))
    throw new Error("change risk hash is invalid");
  if (riskRank(risk.value.class) < riskRank(minimumRisk(normalized.accepted)))
    throw new Error("authenticated change risk is downgraded below inherent operation risk");
  const impactRef = { contentHash: impact.contentHash, knownAffectedUnitIds: unique2(impact.value.knownAffectedUnitIds), possibleFrontierUnitIds: unique2(impact.value.possibleFrontierUnitIds), unavailableSurfaceIds: unique2(impact.value.unavailableSurfaceIds) };
  const semanticFields = { normalizedIntent: facts.intentAnalysis.normalizedIntent.trim(), intentAnalysisId: facts.intentAnalysis.id, identityResolutionIds: unique2(facts.identityResolutionIds), relevanceClosureId: facts.relevanceClosureId, analysisFacetKeys: unique2(facts.analysisFacetKeys), operations: normalized.accepted, decisionIds: unique2(decisionIds), assumptions: unique2(facts.assumptions), boundary: unique2(facts.boundary), predictedImpact: impactRef, risk: risk.value };
  const identityHash = hashFramedDomain("semantic-change-identity", { ...semanticFields, stateBindingDigest: boundState.dependencyDigest, compiledAgainst: boundState.compiledAgainst });
  const change = { id: `semantic_change_${identityHash.slice(-32)}`, request: facts.intentAnalysis.request, ...semanticFields, status: "analyzed" };
  return { change: Object.freeze(change), candidateOperations: Object.freeze(normalized.candidates), boundState: Object.freeze(boundState), compilerFactsHash: authenticated.contentHash, impactReasons: Object.freeze([...impact.value.reasons]), impactQueryDependencyIds: Object.freeze(unique2(impact.value.queryDependencyIds)) };
}

// node_modules/@projector/engine/dist/change/index.js
var compareStrings4 = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var sortedUnique4 = (values) => [...new Set(values)].sort(compareStrings4);
function executionPlanHash(plan) {
  return hashFramedDomain("execution-plan", plan);
}
function executionCapsuleHash(capsule) {
  return hashFramedDomain("approved-execution-capsule", capsule);
}
function createExecutionApproval(plan, capsule, id) {
  return Object.freeze({
    id,
    planId: plan.id,
    planRevision: plan.revision,
    planHash: executionPlanHash(plan),
    dependencyDigest: plan.boundState.dependencyDigest,
    capsuleId: capsule.id,
    capsuleHash: executionCapsuleHash(capsule)
  });
}
function isApprovalCurrent(plan, capsule, approval) {
  return approval.planId === plan.id && approval.planRevision === plan.revision && approval.planHash === executionPlanHash(plan) && approval.dependencyDigest === plan.boundState.dependencyDigest && approval.capsuleId === capsule.id && approval.capsuleHash === executionCapsuleHash(capsule);
}
function outsideApprovedUnits(unitIds, approvedUnits) {
  return sortedUnique4(unitIds.filter((unitId) => !approvedUnits.has(unitId)));
}
function normalizeValidations(validations) {
  return [...validations].map((validation2) => ({
    ...structuredClone(validation2),
    evidenceIds: sortedUnique4(validation2.evidenceIds)
  })).sort((left, right) => compareStrings4(left.validatorId, right.validatorId) || compareStrings4(left.independenceGroup, right.independenceGroup));
}
function validationReasons(required, validations) {
  const byId = new Map(validations.map((validation2) => [validation2.validatorId, validation2]));
  const reasons = [];
  for (const validatorId of sortedUnique4(required)) {
    const result = byId.get(validatorId);
    if (result === void 0)
      reasons.push(`required validation missing: ${validatorId}`);
    else if (result.status !== "passed")
      reasons.push(`required validation ${validatorId} ${result.status}`);
  }
  return reasons;
}
var assuranceRank = {
  weak: 0,
  supporting: 1,
  strong: 2,
  exact: 3
};
function normalizeCompletionAssessment(assessment) {
  return {
    unitStates: [...assessment.unitStates].map((state) => structuredClone(state)).sort((left, right) => compareStrings4(left.unitId, right.unitId) || compareStrings4(left.state, right.state)),
    newDivergenceIds: sortedUnique4(assessment.newDivergenceIds),
    unknowns: sortedUnique4(assessment.unknowns),
    unavailableActions: sortedUnique4(assessment.unavailableActions),
    availableArtifacts: sortedUnique4(assessment.availableArtifacts),
    cleanWorkingTree: assessment.cleanWorkingTree
  };
}
function completionContractReasons(plan, capsule, validations, assessment) {
  const contract = plan.completionCriteria;
  const reasons = validationReasons([...contract.requiredValidators, ...capsule.requiredValidations], validations);
  const passed = validations.filter((validation2) => validation2.status === "passed");
  for (const lane of contract.requiredEvidenceLanes) {
    if (!passed.some((validation2) => validation2.evidenceLane === lane)) {
      reasons.push(`required evidence lane did not pass: ${lane}`);
    }
  }
  const byValidator = new Map(validations.map((validation2) => [validation2.validatorId, validation2]));
  for (const validatorId of sortedUnique4([...contract.requiredValidators, ...capsule.requiredValidations])) {
    const result = byValidator.get(validatorId);
    if (result?.status === "passed" && assuranceRank[result.assurance] < assuranceRank[contract.minimumValidationAssurance]) {
      reasons.push(`required validation ${validatorId} is below ${contract.minimumValidationAssurance} assurance`);
    }
  }
  if (contract.requireIndependentValidation && !passed.some((validation2) => validation2.evidenceLane !== "same-packet-agent" && validation2.independenceGroup !== "deterministic-transform")) {
    reasons.push("completion requires an independent passing validation");
  }
  const unitStates = /* @__PURE__ */ new Map();
  for (const observed of assessment.unitStates) {
    const existing = unitStates.get(observed.unitId);
    if (existing !== void 0 && existing !== observed.state) {
      reasons.push(`conflicting observed unit states: ${observed.unitId}`);
    } else {
      unitStates.set(observed.unitId, observed.state);
    }
  }
  for (const required of contract.requiredUnitStates) {
    if (unitStates.get(required.unitId) !== required.state) {
      reasons.push(`required unit state not established: ${required.unitId} must be ${required.state}`);
    }
  }
  const divergenceCount = new Set(assessment.newDivergenceIds).size;
  if (divergenceCount > contract.maximumNewDivergences) {
    reasons.push(`new divergence count ${divergenceCount} exceeds maximum ${contract.maximumNewDivergences}`);
  }
  const unknownCount = (/* @__PURE__ */ new Set([...capsule.unknowns, ...assessment.unknowns])).size;
  if (unknownCount > contract.maximumUnknowns) {
    reasons.push(`unknown count ${unknownCount} exceeds maximum ${contract.maximumUnknowns}`);
  }
  const unavailableActions = sortedUnique4(assessment.unavailableActions);
  if (!contract.allowUnavailableExternalActions && unavailableActions.length > 0) {
    reasons.push(`unavailable external actions are not allowed: ${unavailableActions.join(", ")}`);
  }
  const availableArtifacts = /* @__PURE__ */ new Set(["certificate", "receipt", ...assessment.availableArtifacts]);
  for (const artifact of contract.requiredArtifacts) {
    if (!availableArtifacts.has(artifact))
      reasons.push(`required artifact is unavailable: ${artifact}`);
  }
  if (contract.cleanWorkingTree && !assessment.cleanWorkingTree) {
    reasons.push("completion requires a clean working tree");
  }
  return sortedUnique4(reasons);
}
var StateBoundChangeExecutor = class {
  state;
  bindingValidator;
  transform;
  transactions;
  artifacts;
  completion;
  successDurability;
  changedCanonicalEntityIds;
  changedConceptIds;
  changedRequirementIds;
  changedScenarioIds;
  changedRelationIds;
  planningSurpriseIds;
  environment;
  now;
  constructor(options) {
    this.state = options.state;
    this.bindingValidator = options.bindingValidator;
    this.transform = options.transform;
    this.transactions = options.transactions;
    this.artifacts = options.artifacts;
    this.completion = options.completion;
    this.successDurability = options.successDurability;
    this.changedCanonicalEntityIds = options.changedCanonicalEntityIds ?? (() => []);
    this.changedConceptIds = options.changedConceptIds ?? (() => []);
    this.changedRequirementIds = options.changedRequirementIds ?? (() => []);
    this.changedScenarioIds = options.changedScenarioIds ?? (() => []);
    this.changedRelationIds = options.changedRelationIds ?? (() => []);
    this.planningSurpriseIds = options.planningSurpriseIds ?? (() => []);
    if (options.environment.repositoryRoot.length === 0)
      throw new TypeError("execution repository root cannot be blank");
    this.environment = Object.freeze({
      repositoryRoot: options.environment.repositoryRoot,
      signal: options.environment.signal
    });
    this.now = options.now ?? (() => (/* @__PURE__ */ new Date()).toISOString());
  }
  async execute(input) {
    const beforeState = await this.state.current();
    const attempt = { validations: [] };
    const preflightReasons = [];
    const planApprovalMatches = input.approval.planId === input.plan.id && input.approval.planRevision === input.plan.revision && input.approval.planHash === executionPlanHash(input.plan) && input.approval.dependencyDigest === input.plan.boundState.dependencyDigest;
    if (!planApprovalMatches) {
      preflightReasons.push("approval does not match the immutable execution plan");
    } else if (!isApprovalCurrent(input.plan, input.capsule, input.approval)) {
      preflightReasons.push("approval does not match the immutable execution capsule");
    }
    if (canonicalJson(input.capsule.boundState) !== canonicalJson(input.plan.boundState)) {
      preflightReasons.push("execution capsule does not match the plan state binding");
    }
    if (canonicalJson(input.capsule.completionContract) !== canonicalJson(input.plan.completionCriteria)) {
      preflightReasons.push("execution capsule completion contract does not match the immutable plan");
    }
    const planUnits = new Set(input.plan.knownAffectedUnitIds);
    const capsuleUnitsOutsidePlan = outsideApprovedUnits(input.capsule.unitIds, planUnits);
    if (capsuleUnitsOutsidePlan.length > 0) {
      preflightReasons.push(`capsule units are outside the immutable plan: ${capsuleUnitsOutsidePlan.join(", ")}`);
    }
    const writeAuthorization = compileWriteAuthorization(input.capsule);
    preflightReasons.push(...writeAuthorization.reasons);
    const adapterContext = {
      repositoryRoot: this.environment.repositoryRoot,
      stateDigest: beforeState,
      config: {},
      signal: this.environment.signal
    };
    const executionBinding = input.plan.boundState;
    if (preflightReasons.length === 0) {
      const bindingValidation = await this.bindingValidator.validate(input.plan.boundState, beforeState, adapterContext);
      if (bindingValidation.status === "rebound") {
        preflightReasons.push("state binding requires an explicit plan rebind and new approval", ...bindingValidation.reasons);
      } else if (bindingValidation.status !== "current") {
        preflightReasons.push(`state binding is ${bindingValidation.status}`, ...bindingValidation.reasons);
      }
    }
    if (preflightReasons.length > 0) {
      return this.finalize(input, beforeState, await this.state.current(), "failure", preflightReasons, attempt);
    }
    const transformContext = {
      repositoryRoot: this.environment.repositoryRoot,
      stateBinding: executionBinding,
      allowedUnits: sortedUnique4(input.capsule.unitIds),
      dryRun: false,
      signal: adapterContext.signal,
      approvedBoundary: sortedUnique4(input.plan.boundary),
      writeAuthorization,
      capsuleId: input.capsule.id,
      capsuleHash: input.approval.capsuleHash
    };
    try {
      attempt.preview = await this.transform.preview(input.transformInput, transformContext);
      const approvedUnits = new Set(transformContext.allowedUnits);
      const previewOutsideScope = outsideApprovedUnits(attempt.preview.touchedUnitIds, approvedUnits);
      if (previewOutsideScope.length > 0) {
        return this.finalize(input, beforeState, await this.state.current(), "failure", [`transform preview touched units outside the approved capsule: ${previewOutsideScope.join(", ")}`], attempt);
      }
      attempt.transaction = await this.transactions.begin({
        planId: input.plan.id,
        beforeState,
        boundState: executionBinding,
        allowedUnits: transformContext.allowedUnits
      });
      await attempt.transaction.checkpoint("before-transform");
      attempt.result = await this.transform.apply(input.transformInput, transformContext);
      const resultOutsideScope = outsideApprovedUnits([...attempt.result.touchedUnitIds, ...attempt.result.operations.flatMap((operation) => operation.unitIds)], approvedUnits);
      if (resultOutsideScope.length > 0) {
        await attempt.transaction.rollback();
        return this.finalize(input, beforeState, await this.state.current(), attempt.result.changed ? "partial" : "failure", [`transform result touched units outside the approved capsule: ${resultOutsideScope.join(", ")}`], attempt);
      }
      await attempt.transaction.transition("workspace-staged");
      await attempt.transaction.transition("validating");
      attempt.validations = normalizeValidations(await this.transform.verify(attempt.result, transformContext));
      attempt.completionAssessment = normalizeCompletionAssessment(await this.completion.assess({
        plan: input.plan,
        capsule: input.capsule,
        transformResult: attempt.result,
        validations: attempt.validations
      }));
      const failedValidations = completionContractReasons(input.plan, input.capsule, attempt.validations, attempt.completionAssessment);
      if (failedValidations.length > 0) {
        await attempt.transaction.rollback();
        const outcome = attempt.result.changed ? "partial" : "failure";
        return this.finalize(input, beforeState, await this.state.current(), outcome, failedValidations, attempt);
      }
      const afterState = await this.state.current();
      const preparedSuccess = createPreparedStateBoundChangeSuccess({
        plan: input.plan,
        capsule: input.capsule,
        approval: input.approval,
        beforeState,
        afterState,
        ...attempt.preview === void 0 ? {} : { preview: attempt.preview },
        transformResult: attempt.result,
        validations: attempt.validations,
        completionAssessment: attempt.completionAssessment,
        changedCanonicalEntityIds: this.changedCanonicalEntityIds(attempt.result),
        changedConceptIds: this.changedConceptIds(attempt.result),
        changedRequirementIds: this.changedRequirementIds(attempt.result),
        changedScenarioIds: this.changedScenarioIds(attempt.result),
        changedRelationIds: this.changedRelationIds(attempt.result),
        planningSurpriseIds: this.planningSurpriseIds(attempt.result),
        createdAt: this.now()
      });
      await this.successDurability?.prepare(preparedSuccess);
      await attempt.transaction.checkpoint(preparedSuccess.checkpointId);
      await attempt.transaction.transition("canonical-staging");
      await attempt.transaction.transition("committing");
      await attempt.transaction.commit();
      return publishPreparedStateBoundChangeSuccess(preparedSuccess, this.artifacts);
    } catch (caught) {
      const error = caught;
      if (error.partialResult !== void 0)
        attempt.result = error.partialResult;
      const changed = attempt.result?.changed === true;
      if (attempt.transaction !== void 0 && attempt.transaction.phase !== "committed") {
        try {
          await attempt.transaction.rollback();
        } catch {
        }
      }
      return this.finalize(input, beforeState, await this.state.current(), changed ? "partial" : "failure", [error instanceof Error ? error.message : "deterministic transform failed"], attempt);
    }
  }
  async finalize(input, beforeState, afterState, outcome, reasons, attempt) {
    const createdAt = this.now();
    const operations = attempt.result?.operations ?? [];
    const changedUnits = sortedUnique4(attempt.result?.touchedUnitIds ?? []);
    const changedConceptIds = attempt.result === void 0 ? [] : sortedUnique4(this.changedConceptIds(attempt.result).filter((id) => changedUnits.includes(id)));
    const changedRequirementIds = attempt.result === void 0 ? [] : sortedUnique4(this.changedRequirementIds(attempt.result).filter((id) => changedUnits.includes(id)));
    const changedScenarioIds = attempt.result === void 0 ? [] : sortedUnique4(this.changedScenarioIds(attempt.result).filter((id) => changedUnits.includes(id)));
    const changedRelationIds = attempt.result === void 0 ? [] : sortedUnique4(this.changedRelationIds(attempt.result).filter((id) => changedUnits.includes(id)));
    const transactionPhase = attempt.transaction?.phase ?? "not-started";
    const rollbackSucceeded = transactionPhase === "rolled-back";
    const recoveryState = outcome === "success" || transactionPhase === "not-started" || transactionPhase === "committed" ? "not-required" : rollbackSucceeded ? "rolled-back" : "recovery-required";
    const certificate = {
      id: `certificate:${input.plan.id}:${input.approval.id}`,
      planId: input.plan.id,
      beforeState: structuredClone(beforeState),
      afterState: structuredClone(afterState),
      changedConcepts: changedConceptIds,
      changedRequirements: changedRequirementIds,
      changedScenarios: changedScenarioIds,
      changedRelations: changedRelationIds,
      changedUnits,
      planningSurpriseIds: attempt.result === void 0 ? [] : sortedUnique4(this.planningSurpriseIds(attempt.result)),
      deterministicOperations: structuredClone(operations),
      agentOperations: [],
      validations: normalizeValidations(attempt.validations),
      divergencesResolved: [],
      divergencesIntroduced: [],
      modeledBoundary: sortedUnique4(input.plan.boundary),
      completeness: outcome === "success" ? "bounded" : outcome === "partial" ? "partial" : "not-established",
      unknowns: sortedUnique4(reasons),
      unavailableActions: [],
      rollback: outcome === "success" ? [] : [{
        kind: recoveryState === "rolled-back" ? "git-checkpoint" : "manual",
        ...attempt.transaction?.lastCheckpointId === void 0 ? {} : { checkpointId: attempt.transaction.lastCheckpointId },
        ...recoveryState === "recovery-required" ? { instructions: "inspect the durable transaction journal" } : {}
      }],
      createdAt
    };
    const artifact = {
      version: 1,
      outcome,
      ...attempt.transaction?.lastCheckpointId === void 0 ? {} : { lastCheckpointId: attempt.transaction.lastCheckpointId },
      journalPhase: transactionPhase,
      recoveryState,
      reasons: sortedUnique4(reasons),
      ...attempt.completionAssessment === void 0 ? {} : { completionAssessment: structuredClone(attempt.completionAssessment) },
      certificate
    };
    const certificateHash = hashFramedDomain("change-certificate-artifact", artifact);
    const certificateRef = await this.artifacts.write("certificate", certificateHash, canonicalJson(artifact));
    const validationSummaryHash = hashFramedDomain("validation-summary", certificate.validations);
    const changedCanonicalEntityIds = attempt.result === void 0 ? [] : sortedUnique4(this.changedCanonicalEntityIds(attempt.result).filter((id) => changedUnits.includes(id)));
    const receiptWithoutHash = {
      id: `receipt:${input.plan.id}:${input.approval.id}`,
      planId: input.plan.id,
      riskClass: input.capsule.risk.class,
      beforeState: structuredClone(beforeState),
      afterState: structuredClone(afterState),
      changedCanonicalEntityIds,
      changedRequirementIds,
      changedScenarioIds,
      changedUnitIds: changedUnits,
      validationSummaryHash,
      certificateHash,
      createdAt
    };
    const receipt = {
      ...receiptWithoutHash,
      semanticHash: hashSemantic("transaction-receipt", receiptWithoutHash)
    };
    const receiptHash = hashFramedDomain("transaction-receipt-artifact", receipt);
    const receiptRef = await this.artifacts.write("receipt", receiptHash, canonicalJson(receipt));
    return {
      outcome,
      reasons: sortedUnique4(reasons),
      ...attempt.preview === void 0 ? {} : { preview: attempt.preview },
      ...attempt.result === void 0 ? {} : { transformResult: attempt.result },
      validations: certificate.validations,
      certificate,
      certificateHash,
      certificateRef,
      receipt,
      receiptHash,
      receiptRef
    };
  }
};
function preparedSuccessContentHash(success) {
  return hashFramedDomain("prepared-state-bound-change-success", success);
}
function preparedSuccessIdentityHash(input) {
  return hashFramedDomain("state-bound-success-preparation-identity", input);
}
function createPreparedStateBoundChangeSuccess(input) {
  const changedUnits = sortedUnique4(input.transformResult.touchedUnitIds);
  const changedCanonicalEntityIds = sortedUnique4(input.changedCanonicalEntityIds.filter((id) => changedUnits.includes(id)));
  const changedConceptIds = sortedUnique4((input.changedConceptIds ?? []).filter((id) => changedUnits.includes(id)));
  const changedRequirementIds = sortedUnique4(input.changedRequirementIds.filter((id) => changedUnits.includes(id)));
  const changedScenarioIds = sortedUnique4(input.changedScenarioIds.filter((id) => changedUnits.includes(id)));
  const changedRelationIds = sortedUnique4((input.changedRelationIds ?? []).filter((id) => changedUnits.includes(id)));
  const validations = normalizeValidations(input.validations);
  const completionAssessment = normalizeCompletionAssessment(input.completionAssessment);
  const preparationIdentityHash = preparedSuccessIdentityHash({
    planId: input.plan.id,
    executionApprovalId: input.approval.id,
    beforeState: input.beforeState,
    afterState: input.afterState,
    ...input.preview === void 0 ? {} : { preview: input.preview },
    transformResult: input.transformResult,
    validations,
    completionAssessment,
    changedCanonicalEntityIds,
    ...changedConceptIds.length === 0 ? {} : { changedConceptIds },
    changedRequirementIds,
    changedScenarioIds,
    ...changedRelationIds.length === 0 ? {} : { changedRelationIds },
    planningSurpriseIds: sortedUnique4(input.planningSurpriseIds)
  });
  const preparationId = `prepared_success_${preparationIdentityHash.slice(-32)}`;
  const checkpointId = `prepared-success:${preparationId}`;
  const certificate = {
    id: `certificate:${input.plan.id}:${input.approval.id}`,
    planId: input.plan.id,
    beforeState: structuredClone(input.beforeState),
    afterState: structuredClone(input.afterState),
    changedConcepts: changedConceptIds,
    changedRequirements: changedRequirementIds,
    changedScenarios: changedScenarioIds,
    changedRelations: changedRelationIds,
    changedUnits,
    planningSurpriseIds: sortedUnique4(input.planningSurpriseIds),
    deterministicOperations: structuredClone(input.transformResult.operations),
    agentOperations: [],
    validations,
    divergencesResolved: [],
    divergencesIntroduced: sortedUnique4(completionAssessment.newDivergenceIds),
    modeledBoundary: sortedUnique4(input.plan.boundary),
    completeness: "bounded",
    unknowns: sortedUnique4(completionAssessment.unknowns),
    unavailableActions: sortedUnique4(completionAssessment.unavailableActions),
    rollback: [],
    createdAt: input.createdAt
  };
  const certificateArtifact = {
    version: 1,
    outcome: "success",
    lastCheckpointId: checkpointId,
    journalPhase: "committed",
    recoveryState: "not-required",
    reasons: [],
    completionAssessment,
    certificate
  };
  const certificateHash = hashFramedDomain("change-certificate-artifact", certificateArtifact);
  const receiptWithoutHash = {
    id: `receipt:${input.plan.id}:${input.approval.id}`,
    planId: input.plan.id,
    riskClass: input.capsule.risk.class,
    beforeState: structuredClone(input.beforeState),
    afterState: structuredClone(input.afterState),
    changedCanonicalEntityIds,
    changedRequirementIds,
    changedScenarioIds,
    changedUnitIds: changedUnits,
    validationSummaryHash: hashFramedDomain("validation-summary", validations),
    certificateHash,
    createdAt: input.createdAt
  };
  const receipt = { ...receiptWithoutHash, semanticHash: hashSemantic("transaction-receipt", receiptWithoutHash) };
  const receiptHash = hashFramedDomain("transaction-receipt-artifact", receipt);
  const basis = {
    version: 1,
    preparationId,
    checkpointId,
    planId: input.plan.id,
    executionApprovalId: input.approval.id,
    beforeState: structuredClone(input.beforeState),
    afterState: structuredClone(input.afterState),
    ...input.preview === void 0 ? {} : { preview: structuredClone(input.preview) },
    transformResult: structuredClone(input.transformResult),
    validations,
    completionAssessment,
    certificateArtifact,
    certificateHash,
    receipt,
    receiptHash
  };
  return { ...basis, contentHash: preparedSuccessContentHash(basis) };
}
function authenticatePreparedStateBoundChangeSuccess(success) {
  const { contentHash, ...basis } = success;
  const expectedPreparationId = `prepared_success_${preparedSuccessIdentityHash({
    planId: success.planId,
    executionApprovalId: success.executionApprovalId,
    beforeState: success.beforeState,
    afterState: success.afterState,
    ...success.preview === void 0 ? {} : { preview: success.preview },
    transformResult: success.transformResult,
    validations: success.validations,
    completionAssessment: success.completionAssessment,
    changedCanonicalEntityIds: success.receipt.changedCanonicalEntityIds,
    ...success.certificateArtifact.certificate.changedConcepts.length === 0 ? {} : { changedConceptIds: success.certificateArtifact.certificate.changedConcepts },
    changedRequirementIds: success.receipt.changedRequirementIds,
    changedScenarioIds: success.receipt.changedScenarioIds,
    ...success.certificateArtifact.certificate.changedRelations.length === 0 ? {} : { changedRelationIds: success.certificateArtifact.certificate.changedRelations },
    planningSurpriseIds: success.certificateArtifact.certificate.planningSurpriseIds
  }).slice(-32)}`;
  if (success.version !== 1 || success.preparationId !== expectedPreparationId || success.checkpointId !== `prepared-success:${success.preparationId}` || contentHash !== preparedSuccessContentHash(basis) || success.certificateHash !== hashFramedDomain("change-certificate-artifact", success.certificateArtifact) || success.receiptHash !== hashFramedDomain("transaction-receipt-artifact", success.receipt) || success.receipt.certificateHash !== success.certificateHash || success.receipt.semanticHash !== hashSemantic("transaction-receipt", success.receipt) || success.certificateArtifact.outcome !== "success" || success.certificateArtifact.journalPhase !== "committed" || success.certificateArtifact.lastCheckpointId !== success.checkpointId || success.certificateArtifact.certificate.planId !== success.planId || success.receipt.planId !== success.planId || success.certificateArtifact.certificate.id !== `certificate:${success.planId}:${success.executionApprovalId}` || success.receipt.id !== `receipt:${success.planId}:${success.executionApprovalId}` || canonicalJson(success.certificateArtifact.certificate.beforeState) !== canonicalJson(success.beforeState) || canonicalJson(success.certificateArtifact.certificate.afterState) !== canonicalJson(success.afterState) || canonicalJson(success.receipt.beforeState) !== canonicalJson(success.beforeState) || canonicalJson(success.receipt.afterState) !== canonicalJson(success.afterState)) {
    throw new Error("prepared state-bound success failed content authentication");
  }
  return success;
}
async function publishPreparedStateBoundChangeSuccess(untrusted, artifacts) {
  const success = authenticatePreparedStateBoundChangeSuccess(untrusted);
  const certificateRef = await artifacts.write("certificate", success.certificateHash, canonicalJson(success.certificateArtifact));
  const receiptRef = await artifacts.write("receipt", success.receiptHash, canonicalJson(success.receipt));
  return {
    outcome: "success",
    reasons: [],
    ...success.preview === void 0 ? {} : { preview: structuredClone(success.preview) },
    transformResult: structuredClone(success.transformResult),
    validations: structuredClone(success.validations),
    certificate: structuredClone(success.certificateArtifact.certificate),
    certificateHash: success.certificateHash,
    certificateRef,
    receipt: structuredClone(success.receipt),
    receiptHash: success.receiptHash,
    receiptRef
  };
}

// node_modules/@projector/engine/dist/reconciliation/index.js
var MANDATORY_VERTICAL_SLICE_STEPS = [
  "inventory-and-classify-without-execution",
  "infer-descriptive-pattern-families",
  "classify-misplaced-script-by-causal-evidence",
  "separate-candidate-from-lens-authority",
  "exclude-generated-occurrences-from-authority",
  "compile-active-and-shadow-governance",
  "emit-placement-and-test-divergences",
  "preview-r1-deterministic-repair",
  "bind-plan-capsule-and-approval-to-state",
  "acquire-writer-lease-and-journal",
  "move-source-test-and-update-references",
  "run-independent-validators",
  "reconcile-to-fixed-point",
  "prove-second-run-zero-material-delta",
  "emit-zero-unresolved-cleanup-plan",
  "emit-receipt-and-certificate",
  "prove-derived-state-rebuild-equivalence"
];
var MANDATORY_VERTICAL_SLICE_EVIDENCE_KINDS = [
  "inventory",
  "pattern-families",
  "causal-classification",
  "authority-lens",
  "generated-exclusion",
  "governance",
  "divergences",
  "preview",
  "binding",
  "lease-journal",
  "operations",
  "validators",
  "fixed-point",
  "second-run",
  "cleanup",
  "receipt-certificate",
  "rebuild"
];
var proofContracts = [
  { kind: "inventory", required: ["inventoryUnitIds", "classificationIds", "executedRepositoryCode", "artifactRefs"], nonEmpty: ["inventoryUnitIds", "classificationIds", "artifactRefs"] },
  { kind: "pattern-families", required: ["familyKeys", "familyCount", "artifactRefs"], nonEmpty: ["familyKeys", "artifactRefs"] },
  { kind: "causal-classification", required: ["sourceUnitId", "testUnitId", "causalEvidenceIds", "artifactRefs"], nonEmpty: ["sourceUnitId", "testUnitId", "causalEvidenceIds", "artifactRefs"] },
  { kind: "authority-lens", required: ["authorityId", "activeLensId", "authorityStatus", "artifactRefs"], nonEmpty: ["authorityId", "activeLensId", "authorityStatus", "artifactRefs"] },
  { kind: "generated-exclusion", required: ["repairedPaths", "independenceGroups", "provenanceRef", "artifactRefs"], nonEmpty: ["repairedPaths", "provenanceRef", "artifactRefs"] },
  { kind: "governance", required: ["activeLensId", "shadowLensId", "ruleIds", "artifactRefs"], nonEmpty: ["activeLensId", "shadowLensId", "ruleIds", "artifactRefs"] },
  { kind: "divergences", required: ["divergenceIds", "counterEvidenceIds", "artifactRefs"], nonEmpty: ["divergenceIds", "counterEvidenceIds", "artifactRefs"] },
  { kind: "preview", required: ["planId", "operationKinds", "touchedUnitIds", "artifactRefs"], nonEmpty: ["planId", "operationKinds", "touchedUnitIds", "artifactRefs"] },
  { kind: "binding", required: ["planDependencyDigest", "capsuleDependencyDigest", "approvalDependencyDigest", "artifactRefs"], nonEmpty: ["planDependencyDigest", "capsuleDependencyDigest", "approvalDependencyDigest", "artifactRefs"] },
  { kind: "lease-journal", required: ["leaseId", "transactionId", "journalRef", "journalPhases", "touchedPaths", "artifactRefs"], nonEmpty: ["leaseId", "transactionId", "journalRef", "journalPhases", "touchedPaths", "artifactRefs"] },
  { kind: "operations", required: ["operationIds", "touchedUnitIds", "pathSummaries", "artifactRefs"], nonEmpty: ["operationIds", "touchedUnitIds", "pathSummaries", "artifactRefs"] },
  { kind: "validators", required: ["validatorIds", "validationStatuses", "validatorEvidenceIds", "artifactRefs"], nonEmpty: ["validatorIds", "validationStatuses", "validatorEvidenceIds", "artifactRefs"] },
  { kind: "fixed-point", required: ["iterationDigests", "materialChanged", "terminalIteration", "artifactRefs"], nonEmpty: ["iterationDigests", "artifactRefs"] },
  { kind: "second-run", required: ["invocation", "beforeDigest", "afterDigest", "materialDelta", "artifactRefs"], nonEmpty: ["beforeDigest", "afterDigest", "artifactRefs"] },
  { kind: "cleanup", required: ["unresolvedClusterWork", "unresolvedDivergenceIds", "computedFrom", "artifactRefs"], nonEmpty: ["computedFrom", "artifactRefs"] },
  { kind: "receipt-certificate", required: ["receiptRef", "certificateRef", "receiptHash", "certificateHash", "artifactRefs"], nonEmpty: ["receiptRef", "certificateRef", "receiptHash", "certificateHash", "artifactRefs"] },
  { kind: "rebuild", required: ["beforeDigest", "afterDigest", "semanticHashPairs", "artifactRefs"], nonEmpty: ["beforeDigest", "afterDigest", "semanticHashPairs", "artifactRefs"] }
];
function mandatoryVerticalSliceEvidenceDigest(step, evidenceKind, artifactRefs, proof) {
  return hashFramedDomain("mandatory-vertical-slice-proof", { step, evidenceKind, artifactRefs, proof });
}
function mandatoryVerticalSliceExecutionContextDigest(context) {
  return hashFramedDomain("mandatory-vertical-slice-execution-context", {
    observations: context.observations,
    artifactRefs: context.artifactRefs,
    artifacts: context.artifacts
  });
}
function createMandatoryVerticalSliceExecutionContext(input) {
  const detached = structuredClone(input);
  const context = {
    ...detached,
    contextDigest: mandatoryVerticalSliceExecutionContextDigest(detached)
  };
  return deepFreeze(context);
}
function assertMandatoryVerticalSliceEvidence(evidence, context) {
  if (context === void 0 || !isHash(context.contextDigest)) {
    throw new Error("mandatory vertical slice requires an execution context");
  }
  if (context.contextDigest !== mandatoryVerticalSliceExecutionContextDigest(context)) {
    throw new Error("mandatory vertical slice execution context digest does not match observations");
  }
  if (evidence.length !== MANDATORY_VERTICAL_SLICE_STEPS.length) {
    throw new Error("mandatory vertical slice requires exactly 17 ordered steps");
  }
  for (const [index, expected] of MANDATORY_VERTICAL_SLICE_STEPS.entries()) {
    const item = evidence[index];
    const contract = proofContracts[index];
    if (item?.sequence !== index + 1 || item.step !== expected || item.summary.trim().length === 0) {
      throw new Error(`mandatory vertical slice step ${index + 1} must be ${expected}`);
    }
    if (item.details === void 0 || !item.details.outputDigest.startsWith("sha256:v1:") || item.details.evidenceKind !== contract?.kind || item.details.artifactRefs.length === 0 || item.details.assertions.length === 0 || !isConcreteArtifactRefs(item.details.artifactRefs) || item.details.proof === void 0 || canonicalComparable(item.details.proof.artifactRefs) !== canonicalComparable(item.details.artifactRefs)) {
      throw new Error(`mandatory vertical slice step ${index + 1} requires structured details linked to outputs`);
    }
    if (item.details.outputDigest !== mandatoryVerticalSliceEvidenceDigest(item.step, item.details.evidenceKind, item.details.artifactRefs, item.details.proof)) {
      throw new Error(`mandatory vertical slice step ${index + 1} output digest does not match proof`);
    }
    const observedProof = context.observations[item.details.evidenceKind];
    const observedRefs = context.artifactRefs[item.details.evidenceKind];
    if (observedProof === void 0 || observedRefs === void 0 || canonicalComparable(observedRefs) !== canonicalComparable(item.details.artifactRefs) || observedRefs.some((ref) => !Object.hasOwn(context.artifacts, ref))) {
      throw new Error(`mandatory vertical slice step ${index + 1} is not linked to an observed execution artifact`);
    }
    const proofKeys = Object.keys(item.details.proof).filter((key) => key !== "artifactRefs").sort();
    const observedProofKeys = Object.keys(observedProof).filter((key) => key !== "artifactRefs").sort();
    if (proofKeys.length !== observedProofKeys.length || proofKeys.some((key, keyIndex) => key !== observedProofKeys[keyIndex])) {
      throw new Error(`mandatory vertical slice step ${index + 1} proof keys do not exactly match execution observations`);
    }
    for (const [key, value] of Object.entries(item.details.proof)) {
      if (key === "artifactRefs")
        continue;
      if (canonicalComparable(observedProof[key]) !== canonicalComparable(value)) {
        throw new Error(`mandatory vertical slice step ${index + 1} proof field ${key} does not correspond to execution observations`);
      }
    }
    for (const key of contract?.required ?? []) {
      if (!Object.hasOwn(item.details.proof, key)) {
        throw new Error(`mandatory vertical slice step ${index + 1} is missing proof field ${key}`);
      }
    }
    for (const key of contract?.nonEmpty ?? []) {
      const value = item.details.proof[key];
      if (typeof value === "string" && value.trim().length === 0 || Array.isArray(value) && value.length === 0 || value === void 0 || value === null) {
        throw new Error(`mandatory vertical slice step ${index + 1} has empty proof field ${key}`);
      }
    }
    if (!validateProofContract(contract?.kind, item.details.proof)) {
      throw new Error(`mandatory vertical slice step ${index + 1} proof failed its typed predicate`);
    }
    if (Object.values(item.details.proof).some((value) => typeof value === "string" && (value === expected || value === item.summary || value === item.step))) {
      throw new Error(`mandatory vertical slice step ${index + 1} proof is self-corresponding rather than concrete`);
    }
    if (item.details.assertions.some((assertion) => !assertion.passed || assertion.claim.trim().length === 0 || canonicalComparable(assertion.observed) !== canonicalComparable(assertion.expected))) {
      throw new Error(`mandatory vertical slice step ${index + 1} contains a failed assertion`);
    }
  }
}
function isConcreteArtifactRefs(refs) {
  return refs.every((ref) => ref.trim().length > 2 && /^[a-z][a-z0-9_-]*:/u.test(ref) && !/^artifact:(?:step-)?[a-z0-9-]+$/u.test(ref));
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);
}
function isHash(value) {
  return typeof value === "string" && /^sha256:v1:[0-9a-f]{64}$/u.test(value);
}
function isEntityReference(value) {
  return typeof value === "string" && value.trim().length > 2 && (value.includes(":") || /^[a-z][a-z0-9_-]+_[0-9a-f]{16,}$/u.test(value));
}
function validateProofContract(kind, proof) {
  switch (kind) {
    case "inventory":
      return isStringArray(proof.inventoryUnitIds) && isStringArray(proof.classificationIds) && proof.executedRepositoryCode === false;
    case "pattern-families":
      return isStringArray(proof.familyKeys) && typeof proof.familyCount === "number" && proof.familyCount === proof.familyKeys.length && proof.familyCount > 0;
    case "causal-classification":
      return isEntityReference(proof.sourceUnitId) && isEntityReference(proof.testUnitId) && isStringArray(proof.causalEvidenceIds);
    case "authority-lens":
      return typeof proof.authorityId === "string" && proof.authorityId.startsWith("authority:") && typeof proof.activeLensId === "string" && proof.activeLensId.startsWith("lens:") && proof.authorityStatus === "approved";
    case "generated-exclusion":
      return isStringArray(proof.repairedPaths) && proof.repairedPaths.some((path) => path.includes("scripts/validate-repo")) && Array.isArray(proof.independenceGroups) && typeof proof.provenanceRef === "string" && proof.provenanceRef.startsWith("receipt:");
    case "governance":
      return typeof proof.activeLensId === "string" && proof.activeLensId.startsWith("lens:") && typeof proof.shadowLensId === "string" && proof.shadowLensId.startsWith("lens:") && proof.activeLensId !== proof.shadowLensId && isStringArray(proof.ruleIds);
    case "divergences":
      return isStringArray(proof.divergenceIds) && isStringArray(proof.counterEvidenceIds);
    case "preview":
      return typeof proof.planId === "string" && proof.planId.length > 3 && isStringArray(proof.operationKinds) && isStringArray(proof.touchedUnitIds);
    case "binding":
      return isHash(proof.planDependencyDigest) && proof.planDependencyDigest === proof.capsuleDependencyDigest && proof.planDependencyDigest === proof.approvalDependencyDigest;
    case "lease-journal":
      return typeof proof.leaseId === "string" && (proof.leaseId.startsWith("lease:") || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/u.test(proof.leaseId)) && typeof proof.transactionId === "string" && proof.transactionId.startsWith("transaction:") && typeof proof.journalRef === "string" && /^journal:[0-9a-f]{64}$/u.test(proof.journalRef) && isStringArray(proof.journalPhases) && proof.journalPhases.includes("committed") && isStringArray(proof.touchedPaths);
    case "operations":
      return isStringArray(proof.operationIds) && isStringArray(proof.touchedUnitIds) && isStringArray(proof.pathSummaries) && proof.pathSummaries.some((summary) => summary.startsWith("moved ")) && proof.pathSummaries.some((summary) => summary.includes("reference"));
    case "validators":
      return isStringArray(proof.validatorIds) && Array.isArray(proof.validationStatuses) && proof.validationStatuses.length === proof.validatorIds.length && proof.validationStatuses.every((status) => status === "passed") && isStringArray(proof.validatorEvidenceIds);
    case "fixed-point":
      return Array.isArray(proof.iterationDigests) && proof.iterationDigests.length > 0 && proof.iterationDigests.every(isHash) && Array.isArray(proof.materialChanged) && proof.materialChanged.length === proof.iterationDigests.length && proof.materialChanged.some((changed) => changed === true) && proof.terminalIteration === true;
    case "second-run":
      return proof.invocation === 2 && isHash(proof.beforeDigest) && isHash(proof.afterDigest) && proof.beforeDigest === proof.afterDigest && proof.materialDelta === false;
    case "cleanup":
      return proof.unresolvedClusterWork === 0 && Array.isArray(proof.unresolvedDivergenceIds) && proof.unresolvedDivergenceIds.length === 0 && typeof proof.computedFrom === "string" && proof.computedFrom.startsWith("state:");
    case "receipt-certificate":
      return typeof proof.receiptRef === "string" && proof.receiptRef.startsWith("/") && typeof proof.certificateRef === "string" && proof.certificateRef.startsWith("/") && isHash(proof.receiptHash) && isHash(proof.certificateHash);
    case "rebuild":
      return isHash(proof.beforeDigest) && isHash(proof.afterDigest) && proof.beforeDigest === proof.afterDigest && proof.semanticHashPairs !== void 0;
    default:
      return false;
  }
}
function canonicalComparable(value) {
  return JSON.stringify(value, (_key, item) => {
    if (item !== null && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right)));
    }
    return item;
  });
}
function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value))
      deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
var NonconvergentReconciliationError = class extends Error {
  code = "nonconvergent-reconciliation";
  constructor(message) {
    super(`nonconvergent-reconciliation: ${message}`);
    this.name = "NonconvergentReconciliationError";
  }
};
async function reconcileToFixedPoint(port, options = {}) {
  const maximumIterations = options.maximumIterations ?? 8;
  if (!Number.isSafeInteger(maximumIterations) || maximumIterations < 1) {
    throw new TypeError("reconciliation maximumIterations must be a positive integer");
  }
  const iterations = [];
  const nonterminalDigests = /* @__PURE__ */ new Set();
  for (let iteration = 1; iteration <= maximumIterations; iteration += 1) {
    const outcome = structuredClone(await port.iterate(iteration));
    iterations.push(outcome);
    if (!outcome.materialChanged && outcome.fixedPointTerminal) {
      return {
        converged: true,
        iterations,
        materialDelta: false,
        reconciliationHash: hashFramedDomain("fixed-point-reconciliation", iterations)
      };
    }
    if (nonterminalDigests.has(outcome.governedStateDigest)) {
      throw new NonconvergentReconciliationError(`repeated nonterminal governed digest ${outcome.governedStateDigest} at iteration ${iteration}`);
    }
    nonterminalDigests.add(outcome.governedStateDigest);
  }
  throw new NonconvergentReconciliationError(`iteration budget ${maximumIterations} exhausted`);
}

// node_modules/@projector/engine/dist/invalidation/index.js
var compareStrings5 = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var sortedUnique5 = (values) => [...new Set(values)].sort(compareStrings5);
function parseVersion(version) {
  const match = /^(\d+(?:\.\d+)*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.exec(version);
  if (match === null)
    throw new Error(`unsupported version format ${version}; use numeric dot segments with optional SemVer prerelease`);
  return {
    numeric: match[1].split("."),
    prerelease: match[2] === void 0 ? [] : match[2].split(".")
  };
}
function compareNumericTokens(left, right) {
  const normalizedLeft = left.replace(/^0+(?=\d)/u, "");
  const normalizedRight = right.replace(/^0+(?=\d)/u, "");
  if (normalizedLeft.length !== normalizedRight.length)
    return normalizedLeft.length < normalizedRight.length ? -1 : 1;
  return compareStrings5(normalizedLeft, normalizedRight);
}
function compareVersions(left, right) {
  const leftParsed = parseVersion(left);
  const rightParsed = parseVersion(right);
  const numericLength = Math.max(leftParsed.numeric.length, rightParsed.numeric.length);
  for (let index = 0; index < numericLength; index += 1) {
    const difference = compareNumericTokens(leftParsed.numeric[index] ?? "0", rightParsed.numeric[index] ?? "0");
    if (difference !== 0)
      return difference;
  }
  if (leftParsed.prerelease.length === 0 && rightParsed.prerelease.length > 0)
    return 1;
  if (leftParsed.prerelease.length > 0 && rightParsed.prerelease.length === 0)
    return -1;
  const prereleaseLength = Math.max(leftParsed.prerelease.length, rightParsed.prerelease.length);
  for (let index = 0; index < prereleaseLength; index += 1) {
    const leftToken = leftParsed.prerelease[index];
    const rightToken = rightParsed.prerelease[index];
    if (leftToken === void 0)
      return -1;
    if (rightToken === void 0)
      return 1;
    const leftNumeric = /^\d+$/u.test(leftToken);
    const rightNumeric = /^\d+$/u.test(rightToken);
    if (leftNumeric && rightNumeric) {
      const difference = compareNumericTokens(leftToken, rightToken);
      if (difference !== 0)
        return difference;
    } else if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1;
    } else {
      const difference = compareStrings5(leftToken, rightToken);
      if (difference !== 0)
        return difference;
    }
  }
  return 0;
}
function compareVersionStrings(left, right) {
  return compareVersions(left, right) || compareStrings5(left, right);
}
var assuranceRank2 = {
  heuristic: 0,
  validated: 1,
  exact: 2
};
var validationAssuranceRank = {
  weak: 0,
  supporting: 1,
  strong: 2,
  exact: 3
};
function hasCorrelatedProvenance(result) {
  const normalizedGroup = result.independenceGroup.trim().toLocaleLowerCase("en-US");
  const normalizedAuthor = result.authorSource.trim().toLocaleLowerCase("en-US");
  const correlated = /packet|correlat|causal|projector[\s_-]*generated/u;
  return result.evidenceLane === "same-packet-agent" || normalizedGroup === "packet" || correlated.test(normalizedGroup) || correlated.test(normalizedAuthor);
}
var SemanticSignatureProfileRegistry = class {
  profiles = /* @__PURE__ */ new Map();
  register(profile2) {
    if (profile2.id.trim() === "" || profile2.version.trim() === "" || profile2.scope.trim() === "") {
      throw new Error("signature profile identity, version, and scope are required");
    }
    parseVersion(profile2.version);
    if ((profile2.maximumAssurance === "exact" || profile2.maximumAssurance === "validated") && profile2.assuranceEvidence.length === 0) {
      throw new Error(`${profile2.maximumAssurance} signature profile ${profile2.id}@${profile2.version} requires assurance evidence`);
    }
    const key = `${profile2.id}\0${profile2.version}`;
    const existing = this.profiles.get(key);
    const descriptor = (value) => ({
      id: value.id,
      version: value.version,
      scope: value.scope,
      normalization: value.normalization,
      ignoredDifferences: sortedUnique5(value.ignoredDifferences),
      adapterId: value.adapterId,
      adapterVersion: value.adapterVersion,
      maximumAssurance: value.maximumAssurance,
      assuranceEvidence: sortedUnique5(value.assuranceEvidence),
      unsupportedConstructs: sortedUnique5(value.unsupportedConstructs)
    });
    if (existing !== void 0 && canonicalJson(descriptor(existing)) !== canonicalJson(descriptor(profile2))) {
      throw new Error(`conflicting signature profile ${profile2.id}@${profile2.version}`);
    }
    this.profiles.set(key, {
      ...profile2,
      ignoredDifferences: sortedUnique5(profile2.ignoredDifferences),
      assuranceEvidence: sortedUnique5(profile2.assuranceEvidence),
      unsupportedConstructs: sortedUnique5(profile2.unsupportedConstructs)
    });
  }
  get(id, version) {
    const profile2 = this.profiles.get(`${id}\0${version}`);
    if (profile2 === void 0)
      throw new Error(`unknown semantic signature profile ${id}@${version}`);
    return profile2;
  }
  currentVersion(id) {
    return [...this.profiles.values()].filter((profile2) => profile2.id === id).map((profile2) => profile2.version).sort(compareVersionStrings).at(-1);
  }
  assess(signature) {
    const currentVersion = this.currentVersion(signature.profileId);
    if (currentVersion === void 0) {
      return { current: false, reason: `signature profile ${signature.profileId} is unavailable` };
    }
    if (currentVersion !== signature.profileVersion) {
      return {
        current: false,
        reason: `signature profile version changed from ${signature.profileVersion} to ${currentVersion}`
      };
    }
    const profile2 = this.get(signature.profileId, signature.profileVersion);
    if (profile2.scope !== signature.scope)
      return { current: false, reason: "signature scope does not match its profile" };
    if (assuranceRank2[signature.assurance] > assuranceRank2[profile2.maximumAssurance]) {
      return { current: false, reason: "signature assurance exceeds its profile assurance" };
    }
    return { current: true, reason: "signature uses the current registered profile" };
  }
  sign(id, version, input, options) {
    const profile2 = this.get(id, version);
    if (assuranceRank2[options.assurance] > assuranceRank2[profile2.maximumAssurance]) {
      throw new Error(`profile ${id}@${version} cannot issue ${options.assurance} assurance`);
    }
    const normalized = profile2.normalize(structuredClone(input));
    const repeated = profile2.normalize(structuredClone(input));
    if (canonicalJson(normalized) !== canonicalJson(repeated)) {
      throw new Error(`signature profile ${id}@${version} produced nondeterministic normalization`);
    }
    return {
      hash: hashFramedDomain("semantic-signature", {
        profileId: id,
        profileVersion: version,
        scope: profile2.scope,
        normalized
      }),
      profileId: id,
      profileVersion: version,
      scope: profile2.scope,
      assurance: options.assurance,
      evidenceIds: sortedUnique5(options.evidenceIds)
    };
  }
};
var sameSignatureProfile = (left, right) => left.profileId === right.profileId && left.profileVersion === right.profileVersion && left.scope === right.scope;
function assessBackdating(previous, current, validations, policy) {
  if (!sameSignatureProfile(previous, current)) {
    return { eligible: false, materiallyChanged: true, reason: "signature profile, version, or scope changed", qualifyingValidatorIds: [] };
  }
  if (previous.hash !== current.hash) {
    return { eligible: false, materiallyChanged: true, reason: "semantic signature materially changed", qualifyingValidatorIds: [] };
  }
  if (previous.assurance === "heuristic" || current.assurance === "heuristic") {
    return {
      eligible: false,
      materiallyChanged: false,
      reason: "heuristic equality cannot backdate downstream validity",
      qualifyingValidatorIds: []
    };
  }
  if (previous.assurance === "exact" && current.assurance === "exact") {
    return { eligible: true, materiallyChanged: false, reason: "exact semantic equality", qualifyingValidatorIds: [] };
  }
  const disallowed = /* @__PURE__ */ new Set([
    ...policy.disallowedEvidenceLanes ?? [],
    ...policy.requireIndependent ? ["same-packet-agent"] : []
  ]);
  const qualifying = validations.filter((result) => result.status === "passed" && validationAssuranceRank[result.assurance] >= validationAssuranceRank[policy.minimumValidatedAssurance] && !disallowed.has(result.evidenceLane) && (!policy.requireIndependent || result.independenceGroup.trim() !== "") && (!policy.requireIndependent || !hasCorrelatedProvenance(result)) && result.evidenceIds.some((evidenceId) => current.evidenceIds.includes(evidenceId)));
  return qualifying.length > 0 ? {
    eligible: true,
    materiallyChanged: false,
    reason: "validated semantic equality has policy-sufficient independent evidence",
    qualifyingValidatorIds: sortedUnique5(qualifying.map(({ validatorId }) => validatorId))
  } : {
    eligible: false,
    materiallyChanged: false,
    reason: "validated equality lacks policy-sufficient independent evidence",
    qualifyingValidatorIds: []
  };
}
var inputKey = (input) => canonicalJson({ kind: input.kind, id: input.id, role: input.role });
function normalizeRecord(record) {
  const inputs = /* @__PURE__ */ new Map();
  for (const input of record.inputs) {
    const key = inputKey(input);
    const existing = inputs.get(key);
    if (existing !== void 0 && existing.versionHash !== input.versionHash) {
      throw new Error(`conflicting derivation input ${input.id} for ${record.unitId}`);
    }
    inputs.set(key, structuredClone(input));
  }
  return {
    ...structuredClone(record),
    inputs: [...inputs.entries()].sort(([left], [right]) => compareStrings5(left, right)).map(([, input]) => input),
    outputSemanticSignature: {
      ...structuredClone(record.outputSemanticSignature),
      evidenceIds: sortedUnique5(record.outputSemanticSignature.evidenceIds)
    },
    outputStructuralSignature: {
      ...structuredClone(record.outputStructuralSignature),
      evidenceIds: sortedUnique5(record.outputStructuralSignature.evidenceIds)
    },
    validators: [...record.validators].map((item) => structuredClone(item)).sort((left, right) => compareStrings5(left.validatorId, right.validatorId))
  };
}
var DerivationIndex = class {
  byUnit = /* @__PURE__ */ new Map();
  reverse = /* @__PURE__ */ new Map();
  groups = /* @__PURE__ */ new Map();
  constructor(records = []) {
    this.replaceRecords(records);
  }
  /** Replace the rebuildable derived index after a successful revalidation. */
  replaceRecords(records) {
    this.byUnit.clear();
    this.reverse.clear();
    this.groups.clear();
    for (const candidate of records) {
      const record = normalizeRecord(candidate);
      const existing = this.byUnit.get(record.unitId);
      if (existing !== void 0 && canonicalJson(existing) !== canonicalJson(record)) {
        throw new Error(`conflicting derivation record ${record.unitId}`);
      }
      this.byUnit.set(record.unitId, record);
    }
    for (const record of this.byUnit.values()) {
      for (const input of record.inputs) {
        this.addReverseDependency(input.id, record.unitId);
      }
      this.addReverseDependency(record.outputSemanticSignature.profileId, record.unitId);
      this.addReverseDependency(record.outputStructuralSignature.profileId, record.unitId);
    }
    this.buildProofGroups();
  }
  upsert(record) {
    this.replaceRecords([...this.byUnit.values(), record]);
  }
  addReverseDependency(subjectId, dependentId) {
    const dependents = this.reverse.get(subjectId) ?? /* @__PURE__ */ new Set();
    dependents.add(dependentId);
    this.reverse.set(subjectId, dependents);
  }
  records() {
    return [...this.byUnit.values()].sort((left, right) => compareStrings5(left.unitId, right.unitId)).map((item) => structuredClone(item));
  }
  get(unitId) {
    const record = this.byUnit.get(unitId);
    return record === void 0 ? void 0 : structuredClone(record);
  }
  reverseDependents(subjectId) {
    return sortedUnique5([...this.reverse.get(subjectId) ?? []]);
  }
  proofGroupFor(unitId) {
    const group = this.groups.get(unitId);
    return group === void 0 ? void 0 : structuredClone(group);
  }
  allUnitIds() {
    return [...this.byUnit.keys()].sort(compareStrings5);
  }
  snapshot() {
    const groups = /* @__PURE__ */ new Map();
    for (const group of this.groups.values())
      groups.set(group.id, group);
    return {
      schemaVersion: "invalidation-derived@1",
      records: this.records(),
      reverseDependencies: [...this.reverse.entries()].sort(([left], [right]) => compareStrings5(left, right)).map(([subjectId, dependentIds]) => ({ subjectId, dependentIds: sortedUnique5([...dependentIds]) })),
      proofGroups: [...groups.values()].sort((left, right) => compareStrings5(left.id, right.id)).map((group) => structuredClone(group))
    };
  }
  buildProofGroups() {
    const nodes = this.allUnitIds();
    const adjacency = new Map(nodes.map((id) => [id, this.get(id).inputs.filter((input) => input.kind === "unit" && this.byUnit.has(input.id)).map((input) => input.id).sort(compareStrings5)]));
    let nextIndex = 0;
    const indexes = /* @__PURE__ */ new Map();
    const lows = /* @__PURE__ */ new Map();
    const stack = [];
    const onStack = /* @__PURE__ */ new Set();
    const components = [];
    const visit = (node) => {
      indexes.set(node, nextIndex);
      lows.set(node, nextIndex);
      nextIndex += 1;
      stack.push(node);
      onStack.add(node);
      for (const target of adjacency.get(node) ?? []) {
        if (!indexes.has(target)) {
          visit(target);
          lows.set(node, Math.min(lows.get(node), lows.get(target)));
        } else if (onStack.has(target))
          lows.set(node, Math.min(lows.get(node), indexes.get(target)));
      }
      if (lows.get(node) !== indexes.get(node))
        return;
      const component = [];
      let popped;
      do {
        popped = stack.pop();
        onStack.delete(popped);
        component.push(popped);
      } while (popped !== node);
      components.push(component.sort(compareStrings5));
    };
    nodes.forEach((node) => {
      if (!indexes.has(node))
        visit(node);
    });
    const declaredGroups = /* @__PURE__ */ new Map();
    for (const members of components) {
      const declaredIds = sortedUnique5(members.map((id) => this.byUnit.get(id)?.proofGroupId).filter((id) => id !== void 0));
      if (declaredIds.length > 1) {
        throw new Error(`incompatible declared proof group IDs inside SCC ${members.join(", ")}: ${declaredIds.join(", ")}`);
      }
      const selfCycle = members.length === 1 && (adjacency.get(members[0]) ?? []).includes(members[0]);
      const declaredId = declaredIds[0];
      if (declaredId === void 0) {
        if (members.length > 1 || selfCycle) {
          const group = {
            id: `proof-group:${hashFramedDomain("derivation-proof-group", members).slice("sha256:v1:".length)}`,
            memberIds: members,
            cyclic: true
          };
          members.forEach((id) => this.groups.set(id, group));
        }
        continue;
      }
      const existing = declaredGroups.get(declaredId);
      if (existing === void 0) {
        declaredGroups.set(declaredId, { memberIds: [...members], cyclic: members.length > 1 || selfCycle });
      } else {
        existing.memberIds.push(...members);
        existing.cyclic ||= members.length > 1 || selfCycle || existing.memberIds.length > 1;
      }
    }
    for (const [id, definition] of declaredGroups.entries()) {
      const group = {
        id,
        memberIds: sortedUnique5(definition.memberIds),
        cyclic: definition.cyclic || definition.memberIds.length > 1
      };
      group.memberIds.forEach((memberId) => this.groups.set(memberId, group));
    }
  }
};
var ImpactRuleRegistry = class {
  rules = /* @__PURE__ */ new Map();
  constructor(rules = []) {
    rules.forEach((rule) => this.register(rule));
  }
  register(rule) {
    parseVersion(rule.version);
    const key = `${rule.id}\0${rule.version}`;
    const existing = this.rules.get(key);
    if (existing !== void 0 && canonicalJson(existing) !== canonicalJson(rule)) {
      throw new Error(`conflicting impact rule ${rule.id}@${rule.version}`);
    }
    this.rules.set(key, structuredClone(rule));
  }
  current() {
    const byId = /* @__PURE__ */ new Map();
    for (const rule of this.rules.values()) {
      const existing = byId.get(rule.id);
      if (existing === void 0 || compareVersionStrings(existing.version, rule.version) < 0)
        byId.set(rule.id, rule);
    }
    return [...byId.values()].sort((left, right) => compareStrings5(`${left.id}\0${left.version}`, `${right.id}\0${right.version}`)).map((rule) => structuredClone(rule));
  }
};
function syntheticQueryDependency(input) {
  return createBuiltInQueryDependency({
    id: input.id,
    programId: input.programId,
    input: input.input,
    role: input.role,
    observed: {
      results: input.result,
      observability: input.observability,
      assumptions: input.assumptions ?? [],
      unavailableLanes: input.unavailableLanes ?? [],
      dependencyKeys: input.dependencyKeys.length > 0 ? input.dependencyKeys : [`query:${input.id}`]
    }
  });
}
function queryIdResults(ids, disposition) {
  return sortedUnique5(ids).map((id) => ({
    id,
    ...disposition === void 0 ? {} : { disposition }
  }));
}
function queryTraversalResults(traversal) {
  return [
    ...queryIdResults(traversal.knownIds, "known"),
    ...queryIdResults(traversal.possibleIds, "possible"),
    ...queryIdResults(traversal.unavailableIds, "unavailable")
  ].sort((left, right) => compareStrings5(canonicalJson(left), canonicalJson(right)));
}
function mergeImpactStateBinding(binding, event, generated) {
  return createStateBinding({
    compiledAgainst: binding.compiledAgainst ?? event.stateDigest,
    valueDependencies: binding.valueDependencies ?? [],
    queryDependencies: [...binding.queryDependencies ?? [], ...generated]
  });
}
function normalizeSubjectResults(subjects) {
  return subjects.map(({ id }) => ({ id })).sort((left, right) => compareStrings5(canonicalJson(left), canonicalJson(right)));
}
function impactSelectorHash(rule) {
  try {
    return selectorHash(rule.selector);
  } catch {
    return rule.semanticHash;
  }
}
var triggerFor = (eventKind) => {
  const triggers = /* @__PURE__ */ new Set([
    "concept-change",
    "interface-change",
    "membership-change",
    "removal",
    "lens-change",
    "rule-change",
    "decision-change",
    "concern-resolution",
    "representation-profile-change",
    "external-change",
    "manual"
  ]);
  return triggers.has(eventKind) ? eventKind : void 0;
};
function normalizeClosureEntries(entries) {
  const byKey = /* @__PURE__ */ new Map();
  const proofRank = { unavailable: 0, inferred: 1, "impact-rule": 2, "exact-derivation": 3 };
  const observabilityRank = { closed: 0, bounded: 1, sampled: 2, open: 3, unavailable: 4 };
  const dispositionRank = { known: 0, possible: 1, blocked: 2, unavailable: 3 };
  for (const candidate of entries) {
    const entry = { ...structuredClone(candidate), reasons: sortedUnique5(candidate.reasons) };
    const key = `${entry.unitId}\0${entry.disposition}`;
    const existing = byKey.get(key);
    if (existing === void 0)
      byKey.set(key, entry);
    else {
      existing.reasons = sortedUnique5([...existing.reasons, ...entry.reasons]);
      existing.frontier ||= entry.frontier;
      if (proofRank[entry.proofClass] > proofRank[existing.proofClass])
        existing.proofClass = entry.proofClass;
      if (observabilityRank[entry.observability] > observabilityRank[existing.observability])
        existing.observability = entry.observability;
    }
  }
  return [...byKey.values()].sort((left, right) => compareStrings5(left.unitId, right.unitId) || dispositionRank[left.disposition] - dispositionRank[right.disposition]);
}
function createImpactClosure(input) {
  const entries = normalizeClosureEntries(input.entries);
  const blocks = [...input.blocks ?? []].map((block) => ({
    ...structuredClone(block),
    unitIds: sortedUnique5(block.unitIds)
  })).sort((left, right) => compareStrings5(`${left.ruleId}\0${left.ruleVersion}`, `${right.ruleId}\0${right.ruleVersion}`) || compareStrings5(left.reason, right.reason));
  const payload = {
    version: "impact-closure@1",
    event: structuredClone(input.event),
    stateBinding: structuredClone(input.stateBinding),
    entries,
    blocks
  };
  const contentHash = hashFramedDomain("impact-closure", payload);
  return {
    ...payload,
    contentHash,
    ref: {
      contentHash,
      knownAffectedUnitIds: sortedUnique5(entries.filter(({ disposition }) => disposition === "known" || disposition === "blocked").map(({ unitId }) => unitId)),
      possibleFrontierUnitIds: sortedUnique5(entries.filter(({ disposition }) => disposition === "possible").map(({ unitId }) => unitId)),
      unavailableSurfaceIds: sortedUnique5(entries.filter(({ disposition }) => disposition === "unavailable").map(({ unitId }) => unitId))
    }
  };
}
var normalizeProofSignature = (signature) => ({
  ...structuredClone(signature),
  evidenceIds: sortedUnique5(signature.evidenceIds)
});
var normalizeProofInputs = (inputs) => [...inputs].map((input) => structuredClone(input)).sort((left, right) => compareStrings5(inputKey(left), inputKey(right)) || compareStrings5(left.versionHash, right.versionHash));
var normalizeProofValidation = (validation2) => ({
  ...structuredClone(validation2),
  evidenceIds: sortedUnique5(validation2.evidenceIds)
});
function normalizeRevalidatedUnits(outputs) {
  const byUnit = /* @__PURE__ */ new Map();
  for (const candidate of outputs) {
    const normalized = {
      ...structuredClone(candidate),
      signature: normalizeProofSignature(candidate.signature),
      ...candidate.structuralSignature === void 0 ? {} : {
        structuralSignature: normalizeProofSignature(candidate.structuralSignature)
      },
      ...candidate.inputs === void 0 ? {} : { inputs: normalizeProofInputs(candidate.inputs) },
      ...candidate.validations === void 0 ? {} : {
        validations: [...candidate.validations].map(normalizeProofValidation).sort((left, right) => compareStrings5(left.validatorId, right.validatorId) || compareStrings5(left.summary, right.summary) || compareStrings5(canonicalJson(left), canonicalJson(right)))
      }
    };
    const existing = byUnit.get(normalized.unitId);
    if (existing !== void 0) {
      if (canonicalJson(existing) !== canonicalJson(normalized)) {
        throw new Error(`duplicate revalidation output ${normalized.unitId} has conflicting signatures or validations`);
      }
      continue;
    }
    byUnit.set(normalized.unitId, normalized);
  }
  return [...byUnit.values()].sort((left, right) => compareStrings5(left.unitId, right.unitId));
}
var ReservedInvalidationSet = class extends Set {
  budget;
  constructor(budget, values = []) {
    super();
    this.budget = budget;
    for (const value of values)
      this.add(value);
  }
  add(value) {
    if (!this.has(value))
      this.budget.reserve(1024 + 4 * value.length, "invalidation-frontier", value);
    return super.add(value);
  }
};
var InvalidationEngine = class {
  derivations;
  impactRules;
  impactPort;
  closureStore;
  signatureProfiles;
  derivationStore;
  constructor(options) {
    this.derivations = options.derivations;
    this.impactRules = options.impactRules;
    this.impactPort = options.impactPort;
    this.closureStore = options.closureStore;
    this.signatureProfiles = options.signatureProfiles;
    this.derivationStore = options.derivationStore;
    if (this.impactRules === void 0 !== (this.impactPort === void 0)) {
      throw new Error("Impact Rules require an evaluation port and vice versa");
    }
  }
  async invalidate(event, options) {
    const budget = options.derivedBudget ?? new DerivedObservationBudget();
    const directlyAffected = new ReservedInvalidationSet(budget, this.derivations.reverseDependents(event.subjectId));
    const transitivelyAffected = new ReservedInvalidationSet(budget);
    const possibleFrontier = new ReservedInvalidationSet(budget);
    const unavailable = new ReservedInvalidationSet(budget);
    const backdated = new ReservedInvalidationSet(budget);
    const refreshedRecords = /* @__PURE__ */ new Map();
    const blocked = /* @__PURE__ */ new Map();
    const diagnostics = new ReservedInvalidationSet(budget);
    const queryDependencies = [];
    const reasons = /* @__PURE__ */ new Map();
    const unavailableReasons = /* @__PURE__ */ new Map();
    const proofClasses = /* @__PURE__ */ new Map();
    const observability = /* @__PURE__ */ new Map();
    const proofClassesByDisposition = /* @__PURE__ */ new Map();
    const observabilityByDisposition = /* @__PURE__ */ new Map();
    const proofClassRank = { unavailable: 0, inferred: 1, "impact-rule": 2, "exact-derivation": 3 };
    const observabilityRank = { closed: 0, bounded: 1, sampled: 2, open: 3, unavailable: 4 };
    budget.reserve(2048 + directlyAffected.size * 512, "invalidation-query", event.subjectId);
    queryDependencies.push(syntheticQueryDependency({
      id: `invalidation:reverse-derivation:${event.subjectId}`,
      programId: BUILT_IN_QUERY_PROGRAM_IDS.exactReverseDerivation,
      input: { eventKind: event.eventKind, subjectId: event.subjectId },
      role: "exact reverse derivation dependents",
      result: queryIdResults([...directlyAffected]),
      observability: "closed",
      dependencyKeys: [`reverse-derivations:${event.subjectId}`]
    }));
    const addReason = (id, reason) => {
      const values = reasons.get(id) ?? /* @__PURE__ */ new Set();
      if (!values.has(reason))
        budget.reserve(512 + 4 * (id.length + reason.length), "invalidation-reason", id);
      values.add(reason);
      reasons.set(id, values);
    };
    const addUnavailableReason = (id, reason) => {
      const values = unavailableReasons.get(id) ?? /* @__PURE__ */ new Set();
      values.add(reason);
      unavailableReasons.set(id, values);
      addReason(id, reason);
    };
    const setProofClass = (id, proofClass, disposition = "known") => {
      const existing = proofClasses.get(id);
      if (existing === void 0 || proofClassRank[proofClass] > proofClassRank[existing])
        proofClasses.set(id, proofClass);
      const byDisposition = proofClassesByDisposition.get(id) ?? /* @__PURE__ */ new Map();
      const existingForDisposition = byDisposition.get(disposition);
      if (existingForDisposition === void 0 || proofClassRank[proofClass] > proofClassRank[existingForDisposition]) {
        byDisposition.set(disposition, proofClass);
      }
      proofClassesByDisposition.set(id, byDisposition);
    };
    const setObservability = (id, value, disposition = "known") => {
      const existing = observability.get(id);
      if (existing === void 0 || value !== "unavailable" && observabilityRank[value] > observabilityRank[existing])
        observability.set(id, value);
      const byDisposition = observabilityByDisposition.get(id) ?? /* @__PURE__ */ new Map();
      const existingForDisposition = byDisposition.get(disposition);
      if (existingForDisposition === void 0 || value !== "unavailable" && observabilityRank[value] > observabilityRank[existingForDisposition]) {
        byDisposition.set(disposition, value);
      }
      observabilityByDisposition.set(id, byDisposition);
    };
    directlyAffected.forEach((id) => {
      addReason(id, `exact derivation input ${event.subjectId} changed`);
      setProofClass(id, "exact-derivation");
      setObservability(id, "closed");
      const record = this.derivations.get(id);
      if (event.eventKind === "signature-profile-change" && record !== void 0 && (record.outputSemanticSignature.profileId === event.subjectId || record.outputStructuralSignature.profileId === event.subjectId)) {
        addReason(id, `signature profile ${event.subjectId} changed; output derivation requires fresh proof`);
      }
    });
    if (this.impactRules !== void 0 && this.impactPort !== void 0) {
      const trigger = triggerFor(event.eventKind);
      for (const rule of this.impactRules.current().filter((candidate) => candidate.trigger === trigger)) {
        let before;
        let after;
        try {
          [before, after] = await Promise.all([
            this.impactPort.subjects(rule, "before", event),
            this.impactPort.subjects(rule, "after", event)
          ]);
          for (const [phase, subjects] of [["before", before], ["after", after]]) {
            budget.reserve(2048 + 4 * canonicalJson(subjects).length, "invalidation-query", rule.id);
            queryDependencies.push(syntheticQueryDependency({
              id: `invalidation:${rule.id}:${rule.version}:selector-membership:${phase}`,
              programId: BUILT_IN_QUERY_PROGRAM_IDS.impactRuleSelectorMembership,
              input: {
                eventKind: event.eventKind,
                subjectId: event.subjectId,
                ruleId: rule.id,
                ruleVersion: rule.version,
                selectorHash: impactSelectorHash(rule),
                phase,
                historicalMemberIds: phase === "before" ? sortedUnique5(subjects.map(({ id }) => id)) : [],
                observability: "closed",
                assumptions: [],
                unavailableLanes: [],
                dependencyKeys: sortedUnique5(subjects.flatMap(({ dependencyKeys }) => dependencyKeys))
              },
              role: "Impact Rule selector membership",
              result: normalizeSubjectResults(subjects),
              observability: "closed",
              dependencyKeys: subjects.flatMap(({ dependencyKeys }) => dependencyKeys)
            }));
          }
        } catch (error) {
          if (error instanceof ObservationError)
            throw error;
          for (const phase of ["before", "after"]) {
            budget.reserve(2048 + 4 * rule.id.length, "invalidation-query", rule.id);
            queryDependencies.push(syntheticQueryDependency({
              id: `invalidation:${rule.id}:${rule.version}:selector-membership:${phase}`,
              programId: BUILT_IN_QUERY_PROGRAM_IDS.impactRuleSelectorMembership,
              input: {
                eventKind: event.eventKind,
                subjectId: event.subjectId,
                ruleId: rule.id,
                ruleVersion: rule.version,
                selectorHash: impactSelectorHash(rule),
                phase,
                historicalMemberIds: [],
                observability: "unavailable",
                assumptions: [],
                unavailableLanes: [`Impact Rule ${rule.id}@${rule.version} membership`],
                dependencyKeys: [`impact-rule-membership:${rule.id}:${phase}`]
              },
              role: "Impact Rule selector membership",
              result: [],
              observability: "unavailable",
              unavailableLanes: [`Impact Rule ${rule.id}@${rule.version} membership`],
              dependencyKeys: [`impact-rule-membership:${rule.id}:${phase}`]
            }));
          }
          unavailable.add(event.subjectId);
          addReason(event.subjectId, `Impact Rule ${rule.id}@${rule.version} membership is unavailable`);
          addReason(event.subjectId, `Impact Rule ${rule.id}@${rule.version} membership failure: ${error instanceof Error ? error.message : "unknown failure"}`);
          continue;
        }
        let seeds;
        try {
          seeds = sortedUnique5([...before, ...after].filter((subject) => evaluateSelector(rule.selector, subject).matched).map(({ id }) => id));
          budget.reserve(2048 + 4 * (canonicalJson(before).length + canonicalJson(after).length), "invalidation-query", rule.id);
          queryDependencies.push(syntheticQueryDependency({
            id: `invalidation:${rule.id}:${rule.version}:applicability`,
            programId: BUILT_IN_QUERY_PROGRAM_IDS.impactRuleApplicability,
            input: {
              eventKind: event.eventKind,
              subjectId: event.subjectId,
              ruleId: rule.id,
              ruleVersion: rule.version,
              selectorHash: impactSelectorHash(rule),
              beforeMemberIds: sortedUnique5(before.map(({ id }) => id)),
              observability: "closed",
              assumptions: [],
              unavailableLanes: [],
              dependencyKeys: sortedUnique5([...before, ...after].flatMap(({ dependencyKeys }) => dependencyKeys))
            },
            role: "Impact Rule applicability",
            result: queryIdResults(seeds),
            observability: "closed",
            dependencyKeys: [...before, ...after].flatMap(({ dependencyKeys }) => dependencyKeys)
          }));
        } catch (error) {
          if (error instanceof ObservationError)
            throw error;
          budget.reserve(2048 + 4 * rule.id.length, "invalidation-query", rule.id);
          queryDependencies.push(syntheticQueryDependency({
            id: `invalidation:${rule.id}:${rule.version}:applicability`,
            programId: BUILT_IN_QUERY_PROGRAM_IDS.impactRuleApplicability,
            input: {
              eventKind: event.eventKind,
              subjectId: event.subjectId,
              ruleId: rule.id,
              ruleVersion: rule.version,
              selectorHash: impactSelectorHash(rule),
              beforeMemberIds: [],
              observability: "unavailable",
              assumptions: [],
              unavailableLanes: [`Impact Rule ${rule.id}@${rule.version} evaluation`],
              dependencyKeys: [`impact-rule-applicability:${rule.id}`]
            },
            role: "Impact Rule applicability",
            result: [],
            observability: "unavailable",
            unavailableLanes: [`Impact Rule ${rule.id}@${rule.version} evaluation`],
            dependencyKeys: [`impact-rule-applicability:${rule.id}`]
          }));
          unavailable.add(event.subjectId);
          addReason(event.subjectId, `Impact Rule ${rule.id}@${rule.version} evaluation is unavailable`);
          addReason(event.subjectId, `Impact Rule ${rule.id}@${rule.version} evaluation failure: ${error instanceof Error ? error.message : "unknown failure"}`);
          continue;
        }
        seeds.forEach((id) => {
          directlyAffected.add(id);
          addReason(id, `Impact Rule ${rule.id}@${rule.version} applies to prior or current selector membership`);
          setProofClass(id, "impact-rule");
          setObservability(id, "closed");
        });
        if (seeds.length === 0 || rule.effect === "advisory")
          continue;
        if (rule.effect === "block") {
          budget.reserve(1024 + seeds.length * 512, "invalidation-block", rule.id);
          const block = {
            ruleId: rule.id,
            ruleVersion: rule.version,
            unitIds: sortedUnique5(seeds),
            reason: `Impact Rule ${rule.id}@${rule.version} blocks planning and mutation for applicable selector members`
          };
          blocked.set(`${rule.id}\0${rule.version}`, block);
          block.unitIds.forEach((id) => {
            addReason(id, block.reason);
            setProofClass(id, "impact-rule", "blocked");
            setObservability(id, "closed", "blocked");
          });
          diagnostics.add(`impact-rule-block:${rule.id}@${rule.version}`);
          continue;
        }
        try {
          const traversal = await this.impactPort.traverse(seeds, rule, event);
          budget.reserve(4096 + 8 * canonicalJson(traversal).length, "invalidation-query", rule.id);
          const traversalResults = queryTraversalResults(traversal);
          const traversalDependencyKeys = [
            ...seeds.map((id) => `selector-member:${id}`),
            ...traversal.dependencyKeys ?? []
          ];
          const traversalRebindable = false;
          const traversalQueryInput = {
            eventKind: event.eventKind,
            subjectId: event.subjectId,
            ruleId: rule.id,
            ruleVersion: rule.version,
            selectorHash: impactSelectorHash(rule),
            seedIds: sortedUnique5(seeds),
            excludedIds: sortedUnique5(seeds),
            rebindable: traversalRebindable,
            observability: traversal.observability,
            assumptions: sortedUnique5(traversal.assumptions ?? []),
            unavailableLanes: sortedUnique5(traversal.unavailableLanes ?? []),
            dependencyKeys: sortedUnique5(traversalDependencyKeys)
          };
          queryDependencies.push(syntheticQueryDependency({
            id: `invalidation:${rule.id}:${rule.version}:reverse-traversal`,
            programId: BUILT_IN_QUERY_PROGRAM_IDS.impactRuleReverseTraversal,
            input: traversalQueryInput,
            role: "Impact Rule reverse derivation traversal",
            result: traversalResults,
            observability: traversal.observability,
            ...traversal.assumptions === void 0 ? {} : { assumptions: traversal.assumptions },
            ...traversal.unavailableLanes === void 0 ? {} : { unavailableLanes: traversal.unavailableLanes },
            dependencyKeys: traversalDependencyKeys
          }));
          queryDependencies.push(syntheticQueryDependency({
            id: `invalidation:${rule.id}:${rule.version}:enumeration`,
            programId: BUILT_IN_QUERY_PROGRAM_IDS.impactRuleEnumeration,
            input: traversalQueryInput,
            role: "Impact Rule bounded consequence enumeration",
            result: traversalResults,
            observability: traversal.observability,
            ...traversal.assumptions === void 0 ? {} : { assumptions: traversal.assumptions },
            ...traversal.unavailableLanes === void 0 ? {} : { unavailableLanes: traversal.unavailableLanes },
            dependencyKeys: traversalDependencyKeys
          }));
          traversal.knownIds.forEach((id) => {
            if (rule.effect === "widen-analysis")
              possibleFrontier.add(id);
            else
              transitivelyAffected.add(id);
            const disposition = rule.effect === "widen-analysis" ? "possible" : "known";
            setProofClass(id, rule.effect === "widen-analysis" ? "inferred" : "impact-rule", disposition);
            setObservability(id, traversal.observability, disposition);
            addReason(id, `${rule.effect === "widen-analysis" ? "possible" : "proven"} Impact Rule ${rule.id}@${rule.version} consequence`);
          });
          traversal.possibleIds.forEach((id) => {
            possibleFrontier.add(id);
            setProofClass(id, "inferred", "possible");
            setObservability(id, traversal.observability, "possible");
            addReason(id, `possible Impact Rule ${rule.id}@${rule.version} consequence`);
          });
          traversal.unavailableIds.forEach((id) => {
            unavailable.add(id);
            setProofClass(id, "unavailable", "unavailable");
            setObservability(id, "unavailable", "unavailable");
            addUnavailableReason(id, `Impact Rule ${rule.id}@${rule.version} traversal unavailable`);
          });
          for (const [id, values] of Object.entries(traversal.reasons)) {
            values.forEach((reason) => traversal.unavailableIds.includes(id) ? addUnavailableReason(id, reason) : addReason(id, reason));
          }
          if (traversal.observability === "open" || traversal.observability === "sampled") {
            seeds.forEach((id) => addReason(id, `${traversal.observability} Impact Rule traversal cannot prove closure`));
          }
        } catch (error) {
          if (error instanceof ObservationError)
            throw error;
          budget.reserve(4096 + seeds.length * 512, "invalidation-query", rule.id);
          queryDependencies.push(syntheticQueryDependency({
            id: `invalidation:${rule.id}:${rule.version}:reverse-traversal`,
            programId: BUILT_IN_QUERY_PROGRAM_IDS.impactRuleReverseTraversal,
            input: {
              eventKind: event.eventKind,
              subjectId: event.subjectId,
              ruleId: rule.id,
              ruleVersion: rule.version,
              selectorHash: impactSelectorHash(rule),
              seedIds: sortedUnique5(seeds),
              excludedIds: sortedUnique5(seeds),
              rebindable: false,
              observability: "unavailable",
              assumptions: [],
              unavailableLanes: [`Impact Rule ${rule.id}@${rule.version} traversal`],
              dependencyKeys: seeds.map((id) => `selector-member:${id}`)
            },
            role: "Impact Rule reverse derivation traversal",
            result: [],
            observability: "unavailable",
            unavailableLanes: [`Impact Rule ${rule.id}@${rule.version} traversal`],
            dependencyKeys: seeds.map((id) => `selector-member:${id}`)
          }));
          queryDependencies.push(syntheticQueryDependency({
            id: `invalidation:${rule.id}:${rule.version}:enumeration`,
            programId: BUILT_IN_QUERY_PROGRAM_IDS.impactRuleEnumeration,
            input: {
              eventKind: event.eventKind,
              subjectId: event.subjectId,
              ruleId: rule.id,
              ruleVersion: rule.version,
              selectorHash: impactSelectorHash(rule),
              seedIds: sortedUnique5(seeds),
              excludedIds: sortedUnique5(seeds),
              rebindable: false,
              observability: "unavailable",
              assumptions: [],
              unavailableLanes: [`Impact Rule ${rule.id}@${rule.version} enumeration`],
              dependencyKeys: seeds.map((id) => `selector-member:${id}`)
            },
            role: "Impact Rule bounded consequence enumeration",
            result: [],
            observability: "unavailable",
            unavailableLanes: [`Impact Rule ${rule.id}@${rule.version} enumeration`],
            dependencyKeys: seeds.map((id) => `selector-member:${id}`)
          }));
          seeds.forEach((id) => {
            unavailable.add(id);
            setProofClass(id, "unavailable", "unavailable");
            setObservability(id, "unavailable", "unavailable");
            addUnavailableReason(id, `Impact Rule ${rule.id}@${rule.version} traversal unavailable: ${error instanceof Error ? error.message : "unknown failure"}`);
          });
        }
      }
    }
    const policy = options.backdatingPolicy ?? {
      minimumValidatedAssurance: "strong",
      requireIndependent: true
    };
    const processed = new ReservedInvalidationSet(budget);
    for (const directId of [...directlyAffected].sort(compareStrings5)) {
      if (processed.has(directId))
        continue;
      const group = this.derivations.proofGroupFor(directId);
      const memberIds = group?.memberIds ?? [directId];
      memberIds.forEach((id) => processed.add(id));
      const priorRecords = memberIds.map((id) => this.derivations.get(id)).filter((item) => item !== void 0);
      if (priorRecords.length === 0)
        continue;
      const maximumIterations = Math.max(1, options.maximumProofGroupIterations ?? 8);
      let outputs = [];
      let priorRoundHash;
      let fixedPointReached = group?.cyclic !== true;
      let completeCoverage = group?.cyclic !== true;
      for (let iteration = 0; iteration < (group?.cyclic ? maximumIterations : 1); iteration += 1) {
        try {
          outputs = normalizeRevalidatedUnits(await options.revalidate(memberIds));
        } catch (error) {
          if (error instanceof ObservationError)
            throw error;
          outputs = [];
          diagnostics.add(error instanceof Error ? error.message : "semantic revalidation failed");
          break;
        }
        const outputHash = hashFramedDomain("proof-group-output", [...outputs].map(({ unitId, signature, structuralSignature, inputs, validations }) => ({ unitId, signature, structuralSignature, inputs, validations })).sort((left, right) => compareStrings5(left.unitId, right.unitId)));
        completeCoverage = outputs.length === memberIds.length && memberIds.every((memberId) => outputs.some(({ unitId }) => unitId === memberId));
        if (completeCoverage && (group?.cyclic !== true || priorRoundHash === outputHash)) {
          fixedPointReached = true;
          break;
        }
        priorRoundHash = outputHash;
      }
      const byUnit = new Map(outputs.map((output) => [output.unitId, output]));
      const assessments = priorRecords.map((prior) => {
        const output = byUnit.get(prior.unitId);
        return {
          unitId: prior.unitId,
          assessment: output === void 0 ? void 0 : this.assessBackdating(prior, output, event, policy)
        };
      });
      const hasCompleteCurrentProof = group?.cyclic !== true || completeCoverage && priorRecords.every((prior) => {
        const output = byUnit.get(prior.unitId);
        if (output?.inputs === void 0 || output.structuralSignature === void 0)
          return false;
        const inputs = [...output.inputs];
        const inputKey2 = (input) => `${input.kind}\0${input.id}\0${input.role}`;
        if (new Set(inputs.map(inputKey2)).size !== inputs.length)
          return false;
        if (!prior.inputs.every((priorInput) => inputs.some((input) => inputKey2(input) === inputKey2(priorInput))))
          return false;
        return inputs.every((input) => {
          if (input.id === event.subjectId)
            return input.versionHash === (event.newHash ?? hashFramedDomain("invalidation-event-input", event));
          if (input.kind !== "unit" || !memberIds.includes(input.id))
            return true;
          return input.versionHash === byUnit.get(input.id)?.signature.hash;
        });
      });
      const currentProofEstablished = fixedPointReached && completeCoverage && hasCompleteCurrentProof;
      if (currentProofEstablished) {
        for (const prior of priorRecords) {
          const output = byUnit.get(prior.unitId);
          const assessment = assessments.find(({ unitId }) => unitId === prior.unitId)?.assessment;
          if (output !== void 0 && assessment !== void 0) {
            budget.reserve(1024 + 4 * canonicalJson(output).length, "invalidation-record", prior.unitId);
            refreshedRecords.set(prior.unitId, this.refreshDerivationRecord(prior, output, event));
          }
        }
      }
      const groupEligible = currentProofEstablished && assessments.length === memberIds.length && assessments.every(({ assessment }) => assessment?.eligible);
      if (groupEligible) {
        memberIds.forEach((id) => backdated.add(id));
        continue;
      }
      const proofUnavailable = group?.cyclic === true && !currentProofEstablished;
      if (proofUnavailable) {
        diagnostics.add("derivation-cycle-unresolved");
        memberIds.forEach((id) => {
          unavailable.add(id);
          addReason(id, "cyclic derivation proof is unresolved");
        });
      }
      const anyUnavailable = proofUnavailable || assessments.some(({ assessment }) => assessment === void 0);
      const anyMaterial = assessments.some(({ assessment }) => assessment?.materiallyChanged);
      const assuranceInsufficient = assessments.some(({ assessment }) => assessment !== void 0 && !assessment.eligible && !assessment.materiallyChanged);
      if (group?.cyclic && (!fixedPointReached || anyUnavailable || assuranceInsufficient)) {
        diagnostics.add("derivation-cycle-unresolved");
      }
      const reason = assessments.find(({ assessment }) => !assessment?.eligible)?.assessment?.reason ?? "semantic revalidation is unavailable";
      const downstream = this.transitiveDependents(memberIds, new Set(memberIds), budget);
      budget.reserve(2048 + (memberIds.length + downstream.length) * 512, "invalidation-query", event.subjectId);
      queryDependencies.push(syntheticQueryDependency({
        id: `invalidation:reverse-derivation:downstream:${memberIds.join(",")}`,
        programId: BUILT_IN_QUERY_PROGRAM_IDS.transitiveReverseDerivation,
        input: { eventKind: event.eventKind, subjectId: event.subjectId, seedIds: sortedUnique5(memberIds), excludedIds: sortedUnique5(memberIds) },
        role: "transitive reverse derivation dependents",
        result: queryIdResults(downstream),
        observability: "closed",
        dependencyKeys: memberIds.map((id) => `reverse-derivations:${id}`)
      }));
      if (anyMaterial && fixedPointReached)
        downstream.forEach((id) => {
          if (!directlyAffected.has(id))
            transitivelyAffected.add(id);
          addReason(id, reason);
        });
      else
        downstream.forEach((id) => {
          possibleFrontier.add(id);
          addReason(id, reason);
        });
      if (anyUnavailable)
        memberIds.forEach((id) => {
          unavailable.add(id);
          addReason(id, "semantic revalidation is unavailable");
        });
    }
    const allUnitIds = this.derivations.allUnitIds();
    budget.reserveItems(allUnitIds.length, 128, "invalidation-result", event.subjectId);
    const revalidatedRecords = [...refreshedRecords.values()].sort((left, right) => compareStrings5(left.unitId, right.unitId));
    if (revalidatedRecords.length > 0 && options.preserveDerivations !== true) {
      const refreshedById = new Map(revalidatedRecords.map((record) => [record.unitId, record]));
      const replacementRecords = this.derivations.records().map((record) => refreshedById.get(record.unitId) ?? record);
      const replacementIndex = new DerivationIndex(replacementRecords);
      await (options.derivationStore ?? this.derivationStore)?.replace(replacementIndex.snapshot());
      this.derivations.replaceRecords(replacementRecords);
    }
    directlyAffected.forEach((id) => {
      transitivelyAffected.delete(id);
      possibleFrontier.delete(id);
    });
    transitivelyAffected.forEach((id) => possibleFrontier.delete(id));
    const invalidation = {
      directlyAffected: sortedUnique5([...directlyAffected]),
      transitivelyAffected: sortedUnique5([...transitivelyAffected]),
      possibleFrontier: sortedUnique5([...possibleFrontier]),
      unavailable: sortedUnique5([...unavailable]),
      reasons: Object.fromEntries([...reasons.entries()].sort(([left], [right]) => compareStrings5(left, right)).map(([id, values]) => [id, sortedUnique5([...values])]))
    };
    const invalid = /* @__PURE__ */ new Set([
      ...invalidation.directlyAffected,
      ...invalidation.transitivelyAffected,
      ...invalidation.possibleFrontier,
      ...invalidation.unavailable,
      ...[...blocked.values()].flatMap(({ unitIds }) => unitIds)
    ]);
    const blockedUnitIds = new Set([...blocked.values()].flatMap(({ unitIds }) => unitIds));
    backdated.forEach((id) => {
      if (!blockedUnitIds.has(id))
        invalid.delete(id);
    });
    const entries = [
      ...invalidation.directlyAffected.map((unitId) => ({ unitId, disposition: "known", proofClass: proofClassesByDisposition.get(unitId)?.get("known") ?? proofClasses.get(unitId) ?? "exact-derivation", observability: observabilityByDisposition.get(unitId)?.get("known") ?? observability.get(unitId) ?? "closed", frontier: false, reasons: [...invalidation.reasons[unitId] ?? []].filter((reason) => !(unavailableReasons.get(unitId)?.has(reason) ?? false)) })),
      ...invalidation.transitivelyAffected.map((unitId) => ({ unitId, disposition: "known", proofClass: proofClassesByDisposition.get(unitId)?.get("known") ?? proofClasses.get(unitId) ?? "exact-derivation", observability: observabilityByDisposition.get(unitId)?.get("known") ?? observability.get(unitId) ?? "closed", frontier: false, reasons: [...invalidation.reasons[unitId] ?? []].filter((reason) => !(unavailableReasons.get(unitId)?.has(reason) ?? false)) })),
      ...invalidation.possibleFrontier.map((unitId) => ({ unitId, disposition: "possible", proofClass: proofClassesByDisposition.get(unitId)?.get("possible") ?? proofClasses.get(unitId) ?? "inferred", observability: observabilityByDisposition.get(unitId)?.get("possible") ?? observability.get(unitId) ?? "open", frontier: true, reasons: [...invalidation.reasons[unitId] ?? []].filter((reason) => !(unavailableReasons.get(unitId)?.has(reason) ?? false)) })),
      ...[...blocked.values()].flatMap((block) => block.unitIds.map((unitId) => ({ unitId, disposition: "blocked", proofClass: proofClassesByDisposition.get(unitId)?.get("blocked") ?? "impact-rule", observability: observabilityByDisposition.get(unitId)?.get("blocked") ?? observability.get(unitId) ?? "closed", frontier: true, reasons: [...invalidation.reasons[unitId] ?? [], block.reason].filter((reason) => !(unavailableReasons.get(unitId)?.has(reason) ?? false)) }))),
      ...invalidation.unavailable.map((unitId) => ({ unitId, disposition: "unavailable", proofClass: "unavailable", observability: "unavailable", frontier: true, reasons: invalidation.reasons[unitId] ?? [] }))
    ];
    const normalizedBinding = options.stateBinding === void 0 ? void 0 : mergeImpactStateBinding(options.stateBinding, event, queryDependencies);
    const impactClosure = options.stateBinding === void 0 ? void 0 : createImpactClosure({ event, stateBinding: normalizedBinding, entries, blocks: [...blocked.values()] });
    if (impactClosure !== void 0)
      await this.closureStore?.put(impactClosure);
    return {
      invalidation,
      backdatedUnitIds: sortedUnique5([...backdated]),
      validUnitIds: allUnitIds.filter((id) => !invalid.has(id)),
      revalidatedRecords,
      blocked: [...blocked.values()].sort((left, right) => compareStrings5(`${left.ruleId}\0${left.ruleVersion}`, `${right.ruleId}\0${right.ruleVersion}`)),
      blockedUnitIds: sortedUnique5([...blocked.values()].flatMap(({ unitIds }) => unitIds)),
      diagnostics: sortedUnique5([...diagnostics]),
      ...impactClosure === void 0 ? {} : { impactClosure }
    };
  }
  assessBackdating(prior, output, event, policy) {
    const profileChanged = event.eventKind === "signature-profile-change" && (event.subjectId === prior.outputSemanticSignature.profileId || event.subjectId === prior.outputStructuralSignature.profileId);
    if (profileChanged) {
      return {
        eligible: false,
        materiallyChanged: true,
        reason: "signature profile changed and requires a fresh derivation proof",
        qualifyingValidatorIds: []
      };
    }
    if (this.signatureProfiles !== void 0) {
      for (const candidate of [output.signature, prior.outputStructuralSignature]) {
        const profileAssessment = this.signatureProfiles.assess(candidate);
        if (!profileAssessment.current) {
          return {
            eligible: false,
            materiallyChanged: true,
            reason: profileAssessment.reason,
            qualifyingValidatorIds: []
          };
        }
      }
    }
    return assessBackdating(prior.outputSemanticSignature, output.signature, output.validations ?? [], policy);
  }
  refreshDerivationRecord(prior, output, event) {
    const changedVersionHash = event.newHash ?? hashFramedDomain("invalidation-event-input", event);
    const inputs = output.inputs === void 0 ? prior.inputs.map((input) => input.id === event.subjectId ? { ...input, versionHash: changedVersionHash } : input) : [...output.inputs].map((input) => structuredClone(input));
    const profileDependency = event.eventKind === "signature-profile-change" && (prior.outputSemanticSignature.profileId === event.subjectId || prior.outputStructuralSignature.profileId === event.subjectId) && !inputs.some((input) => input.kind === "signature-profile" && input.id === event.subjectId);
    if (profileDependency)
      inputs.push({
        kind: "signature-profile",
        id: event.subjectId,
        versionHash: changedVersionHash,
        role: "output-signature-profile"
      });
    return normalizeRecord({
      ...prior,
      inputs,
      outputSemanticSignature: structuredClone(output.signature),
      outputStructuralSignature: structuredClone(output.structuralSignature ?? prior.outputStructuralSignature),
      validators: output.validations === void 0 ? prior.validators : [...output.validations]
    });
  }
  transitiveDependents(seedIds, excluded, budget) {
    const seen = new ReservedInvalidationSet(budget);
    const pending = [...seedIds].sort(compareStrings5);
    while (pending.length > 0) {
      const current = pending.shift();
      for (const dependent of this.derivations.reverseDependents(current)) {
        if (excluded.has(dependent) || seen.has(dependent))
          continue;
        seen.add(dependent);
        pending.push(dependent);
        pending.sort(compareStrings5);
      }
    }
    return sortedUnique5([...seen]);
  }
};
function compareCorrectnessOracles(input) {
  const rebuildConsistent = input.rebuild.incrementalHash === input.rebuild.cleanHash;
  const minimumAssurance = input.conformancePolicy?.minimumAssurance ?? "strong";
  const minimumIndependentGroups = Math.max(1, input.conformancePolicy?.minimumIndependentGroups ?? 1);
  const disallowedEvidenceLanes = /* @__PURE__ */ new Set([
    "same-packet-agent",
    ...input.conformancePolicy?.disallowedEvidenceLanes ?? []
  ]);
  const qualifyingConformance = input.conformance.filter((result) => result.status === "passed" && validationAssuranceRank[result.assurance] >= validationAssuranceRank[minimumAssurance] && !disallowedEvidenceLanes.has(result.evidenceLane) && result.independenceGroup.trim() !== "" && result.authorSource.trim() !== "" && !hasCorrelatedProvenance(result) && result.evidenceIds.length > 0);
  const independentGroups = new Set(qualifyingConformance.map(({ independenceGroup }) => independenceGroup.trim()));
  const conformancePassed = input.conformance.length > 0 && input.conformance.every(({ status }) => status === "passed") && qualifyingConformance.length > 0 && independentGroups.size >= minimumIndependentGroups;
  const historicalPassed = input.historical.length === 0 ? void 0 : input.historical.every(({ status }) => status === "passed");
  const contradictions = sortedUnique5([
    ...input.conformance.filter(({ status }) => status === "failed" || status === "blocked").map(({ summary }) => summary),
    ...input.historical.filter(({ status }) => status === "failed" || status === "blocked").map(({ summary }) => summary)
  ]);
  return {
    rebuildConsistent,
    conformancePassed,
    historicalPassed,
    strongCompletion: rebuildConsistent && conformancePassed && contradictions.length === 0,
    contradictions,
    evidenceByOracle: {
      rebuild: [rebuildConsistent ? "clean and incremental derived state agree" : "clean and incremental derived state differ"],
      conformance: input.conformance.map(({ summary }) => summary).sort(compareStrings5),
      historical: input.historical.map(({ summary }) => summary).sort(compareStrings5)
    }
  };
}

// node_modules/@projector/engine/dist/identity/index.js
import { z } from "zod";
var IdentityAssessmentSchema = z.enum(["same", "overlap", "split", "merge", "replace", "delete", "distinct", "ambiguous"]);
var RequestedKindSchema = z.enum(["concept", "requirement", "scenario", "unknown"]);
var compareStrings6 = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var sortedUnique6 = (values) => [...new Set(values)].sort(compareStrings6);
function canonicalJsonSet(values) {
  const byCanonicalValue = new Map(values.map((value) => [canonicalJson(value), value]));
  return [...byCanonicalValue.entries()].sort(([left], [right]) => compareStrings6(left, right)).map(([, value]) => structuredClone(value));
}
function isCanonicalJsonSet(values) {
  return canonicalJson(values) === canonicalJson(canonicalJsonSet(values));
}
function canonicalStateBinding(binding) {
  return createStateBinding({
    compiledAgainst: binding.compiledAgainst,
    valueDependencies: binding.valueDependencies,
    queryDependencies: binding.queryDependencies
  });
}
function reportCanonicalStateBindingIssues(binding, issue) {
  let canonical;
  try {
    canonical = canonicalStateBinding(binding);
  } catch (error) {
    issue(error instanceof Error ? error.message : "StateBinding cannot be canonicalized");
    return;
  }
  if (canonicalJson(binding.valueDependencies) !== canonicalJson(canonical.valueDependencies)) {
    issue("StateBinding value dependencies must be canonically ordered and unique", ["valueDependencies"]);
  }
  if (canonicalJson(binding.queryDependencies) !== canonicalJson(canonical.queryDependencies)) {
    issue("StateBinding query dependencies and nested fingerprint sets must be canonical", ["queryDependencies"]);
  }
  if (binding.dependencyDigest !== canonical.dependencyDigest) {
    issue("StateBinding dependency digest must equal its canonical dependency projection", ["dependencyDigest"]);
  }
}
function requireCanonicalStateBinding(binding, message) {
  const issues = [];
  reportCanonicalStateBindingIssues(binding, (issue) => issues.push(issue));
  if (issues.length > 0)
    throw new Error(`${message}: ${issues.join("; ")}`);
  return canonicalStateBinding(binding);
}
function normalizedTerm(value) {
  return value.normalize("NFKC").trim();
}
function reportCanonicalBoundaryIssues(boundary, issue) {
  for (const field of ["owns", "excludes", "nearestEntityIds"]) {
    const values = boundary[field];
    const normalized = values.map(normalizedTerm);
    if (normalized.some((value) => value.length === 0))
      issue(`semantic boundary ${field} cannot contain blank values`, [field]);
    if (canonicalJson(values) !== canonicalJson(sortedUnique6(normalized))) {
      issue(`semantic boundary ${field} must contain canonical normalized, sorted, unique values`, [field]);
    }
  }
  if (boundary.rationale.length === 0 || boundary.rationale !== normalizedTerm(boundary.rationale)) {
    issue("semantic boundary rationale must be canonical normalized, trimmed, and nonblank", ["rationale"]);
  }
  const excluded = new Set(boundary.excludes);
  if (boundary.owns.some((value) => excluded.has(value))) {
    issue("semantic boundary owns and excludes must be disjoint after normalization");
  }
}
var CanonicalSemanticBoundarySchema = NewSemanticBoundarySchema.superRefine((boundary, context) => {
  reportCanonicalBoundaryIssues(boundary, (message, path) => context.addIssue({ code: "custom", message, path }));
});
var OperationFactCommon = {
  version: z.literal(1),
  requestId: EntityIdSchema,
  requestedMeaning: z.string().min(1),
  requestedKind: RequestedKindSchema,
  sourceIds: z.array(EntityIdSchema),
  targetIds: z.array(EntityIdSchema)
};
var IdentityOperationFactSchema = z.union([
  z.strictObject({ ...OperationFactCommon, operation: z.literal("same"), equivalentMeaning: z.string().min(1) }),
  z.strictObject({ ...OperationFactCommon, operation: z.literal("overlap"), coordinatedSourceIds: z.array(EntityIdSchema) }),
  z.strictObject({ ...OperationFactCommon, operation: z.literal("split"), partitionTargetIds: z.array(EntityIdSchema) }),
  z.strictObject({ ...OperationFactCommon, operation: z.literal("merge"), convergence: z.strictObject({ sourceIds: z.array(EntityIdSchema), targetId: EntityIdSchema }) }),
  z.strictObject({ ...OperationFactCommon, operation: z.literal("replace"), supersession: z.strictObject({ sourceId: EntityIdSchema, targetIds: z.array(EntityIdSchema) }) }),
  z.strictObject({ ...OperationFactCommon, operation: z.literal("delete"), durableMeaningCeased: z.literal(true) }),
  z.strictObject({ ...OperationFactCommon, operation: z.literal("delete"), noDurableEntity: z.literal(true) }),
  z.strictObject({ ...OperationFactCommon, operation: z.literal("distinct"), boundary: CanonicalSemanticBoundarySchema.nullable() }),
  z.strictObject({ ...OperationFactCommon, operation: z.literal("ambiguous"), unresolvedConflict: z.string().min(1) })
]);
var VerifiedIdentityClaimRefSchema = z.strictObject({
  evidenceId: EntityIdSchema,
  subjectKey: EntityIdSchema,
  predicate: z.string().min(1),
  object: IdentityOperationFactSchema,
  inferenceConfidence: ConfidenceSchema.optional()
});
var IdentityLineageProposalSchema = z.strictObject({
  id: EntityIdSchema,
  canonical: z.literal(false),
  kind: z.enum(["split", "merge", "replace", "delete"]),
  fromIds: z.array(EntityIdSchema),
  toIds: z.array(EntityIdSchema),
  reason: z.string().min(1),
  stateDigest: ContentHashSchema
}).superRefine((proposal, context) => {
  for (const message of validateLineage(proposal))
    context.addIssue({ code: "custom", message });
  if (canonicalJson(proposal.fromIds) !== canonicalJson(sortedUnique6(proposal.fromIds)) || canonicalJson(proposal.toIds) !== canonicalJson(sortedUnique6(proposal.toIds))) {
    context.addIssue({ code: "custom", message: "lineage proposal endpoints must be normalized, sorted, and unique" });
  }
  const overlaps = proposal.fromIds.some((id) => proposal.toIds.includes(id));
  if (overlaps)
    context.addIssue({ code: "custom", message: "lineage source and target endpoints must be disjoint" });
  const validCardinality = proposal.kind === "split" ? proposal.fromIds.length === 1 && proposal.toIds.length >= 2 : proposal.kind === "merge" ? proposal.fromIds.length >= 2 && proposal.toIds.length === 1 : proposal.kind === "replace" ? proposal.fromIds.length === 1 && proposal.toIds.length === 1 : proposal.fromIds.length === 1 && proposal.toIds.length === 0;
  if (!validCardinality)
    context.addIssue({ code: "custom", message: `${proposal.kind} lineage endpoints violate operation cardinality` });
});
var IdentityTombstoneProposalSchema = z.strictObject({
  id: EntityIdSchema,
  canonical: z.literal(false),
  entityId: EntityIdSchema,
  lastSemanticHash: ContentHashSchema,
  replacementIds: z.array(EntityIdSchema),
  reason: z.string().min(1)
}).superRefine((proposal, context) => {
  if (canonicalJson(proposal.replacementIds) !== canonicalJson(sortedUnique6(proposal.replacementIds))) {
    context.addIssue({ code: "custom", message: "tombstone replacements must be normalized, sorted, and unique" });
  }
  if (proposal.replacementIds.includes(proposal.entityId)) {
    context.addIssue({ code: "custom", message: "tombstone replacement continuity cannot point to the deleted identity" });
  }
});
var IdentityCandidateRecordSchema = z.strictObject({
  candidate: SemanticIdentityCandidateSchema,
  lifecycle: z.enum(["active", "deprecated", "superseded", "tombstone"]),
  replacementIds: z.array(EntityIdSchema)
}).superRefine((record, context) => {
  const candidate = record.candidate;
  if (!sameJson(record.replacementIds, sortedUnique6(record.replacementIds.map(normalizedTerm)))) {
    context.addIssue({ code: "custom", message: "candidate replacement IDs must be normalized, sorted, and unique" });
  }
  if (record.replacementIds.includes(candidate.entityId)) {
    context.addIssue({ code: "custom", message: "candidate lifecycle replacement cannot point to the same identity" });
  }
  if ((record.lifecycle === "active" || record.lifecycle === "deprecated") && record.replacementIds.length > 0) {
    context.addIssue({ code: "custom", message: `${record.lifecycle} candidate records cannot declare replacement continuity` });
  }
  if (!isCanonicalJsonSet(candidate.evidence)) {
    context.addIssue({ code: "custom", message: "candidate evidence references must be canonically ordered and unique", path: ["candidate", "evidence"] });
  }
});
var IdentityAdjudicationSchema = z.strictObject({
  kind: IdentityAssessmentSchema,
  operation: IdentityAssessmentSchema,
  sourceIds: z.array(EntityIdSchema),
  proposedTargetIds: z.array(EntityIdSchema),
  factPayloads: z.array(IdentityOperationFactSchema),
  evidenceIds: z.array(EntityIdSchema),
  claims: z.array(VerifiedIdentityClaimRefSchema),
  claimHashes: z.array(ContentHashSchema),
  lineageProposals: z.array(IdentityLineageProposalSchema),
  tombstoneProposals: z.array(IdentityTombstoneProposalSchema),
  contentHash: ContentHashSchema
}).superRefine((adjudication, context) => {
  if (adjudication.kind !== adjudication.operation) {
    context.addIssue({ code: "custom", message: "adjudication kind must equal operation" });
  }
  for (const [label, values] of [
    ["sourceIds", adjudication.sourceIds],
    ["proposedTargetIds", adjudication.proposedTargetIds],
    ["evidenceIds", adjudication.evidenceIds],
    ["claimHashes", adjudication.claimHashes]
  ]) {
    if (canonicalJson(values) !== canonicalJson(sortedUnique6(values))) {
      context.addIssue({ code: "custom", message: `adjudication ${label} must be normalized, sorted, and unique` });
    }
  }
  if (!isCanonicalJsonSet(adjudication.claims)) {
    context.addIssue({ code: "custom", message: "adjudication claims must be canonically ordered and unique", path: ["claims"] });
  }
  if (!isCanonicalJsonSet(adjudication.lineageProposals)) {
    context.addIssue({ code: "custom", message: "adjudication lineage proposals must be canonically ordered and unique", path: ["lineageProposals"] });
  }
  if (!isCanonicalJsonSet(adjudication.tombstoneProposals)) {
    context.addIssue({ code: "custom", message: "adjudication tombstone proposals must be canonically ordered and unique", path: ["tombstoneProposals"] });
  }
  reportAdjudicationSemanticIssues(adjudication, (message, path) => context.addIssue({ code: "custom", message, path }));
});
var AdjudicatedSemanticIdentityResolutionSchema = z.strictObject({
  contractVersion: z.literal(1),
  id: EntityIdSchema,
  requestedMeaning: z.string(),
  requestedKind: RequestedKindSchema,
  outcome: z.enum(["reuse-existing", "coordinated-modification", "split-existing", "merge-existing", "replace-existing", "create-new", "no-durable-entity", "unresolved"]),
  candidates: z.array(SemanticIdentityCandidateSchema),
  candidateRecords: z.array(IdentityCandidateRecordSchema),
  selectedEntityIds: z.array(EntityIdSchema),
  newBoundary: CanonicalSemanticBoundarySchema.optional(),
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceRefSchema),
  unknowns: z.array(z.string()),
  boundState: StateBindingSchema,
  operation: IdentityAssessmentSchema,
  proposedTargetIds: z.array(EntityIdSchema),
  adjudication: IdentityAdjudicationSchema.optional(),
  lineageProposals: z.array(IdentityLineageProposalSchema),
  tombstoneProposals: z.array(IdentityTombstoneProposalSchema),
  contentHash: ContentHashSchema
}).superRefine((resolution, context) => {
  if (canonicalJson(resolution.selectedEntityIds) !== canonicalJson(sortedUnique6(resolution.selectedEntityIds)) || canonicalJson(resolution.proposedTargetIds) !== canonicalJson(sortedUnique6(resolution.proposedTargetIds))) {
    context.addIssue({ code: "custom", message: "resolution operation targets must be normalized, sorted, and unique" });
  }
  if (!isCanonicalJsonSet(resolution.evidence)) {
    context.addIssue({ code: "custom", message: "resolution evidence references must be canonically ordered and unique", path: ["evidence"] });
  }
  if (canonicalJson(resolution.unknowns) !== canonicalJson(sortedUnique6(resolution.unknowns))) {
    context.addIssue({ code: "custom", message: "resolution unknowns must be sorted and unique", path: ["unknowns"] });
  }
  if (!isCanonicalJsonSet(resolution.lineageProposals)) {
    context.addIssue({ code: "custom", message: "resolution lineage proposals must be canonically ordered and unique", path: ["lineageProposals"] });
  }
  if (!isCanonicalJsonSet(resolution.tombstoneProposals)) {
    context.addIssue({ code: "custom", message: "resolution tombstone proposals must be canonically ordered and unique", path: ["tombstoneProposals"] });
  }
  reportCanonicalStateBindingIssues(resolution.boundState, (message, path) => context.addIssue({ code: "custom", message, path: ["boundState", ...path ?? []] }));
  if (resolution.adjudication !== void 0) {
    if (resolution.operation !== resolution.adjudication.operation || canonicalJson(resolution.proposedTargetIds) !== canonicalJson(resolution.adjudication.proposedTargetIds) || canonicalJson(resolution.lineageProposals) !== canonicalJson(resolution.adjudication.lineageProposals) || canonicalJson(resolution.tombstoneProposals) !== canonicalJson(resolution.adjudication.tombstoneProposals)) {
      context.addIssue({ code: "custom", message: "resolution continuity must equal its adjudication" });
    }
    if ((resolution.operation === "same" || resolution.operation === "overlap") && resolution.adjudication.factPayloads.some((fact) => canonicalJson(fact.targetIds) !== canonicalJson(resolution.selectedEntityIds))) {
      context.addIssue({ code: "custom", message: "same/overlap fact targets must exactly equal selected entity IDs" });
    }
  }
  reportResolutionSemanticIssues(resolution, (message, path) => context.addIssue({ code: "custom", message, path }));
});
var predicatesByOperation = {
  same: ["identity-equivalent"],
  overlap: ["identity-shared-ownership"],
  split: ["identity-partition"],
  merge: ["identity-convergence"],
  replace: ["identity-supersession"],
  delete: ["identity-cessation", "identity-no-durable-entity"],
  distinct: ["identity-distinct-boundary"],
  ambiguous: ["identity-conflict"]
};
function sameJson(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}
function reportNormalizedIds(values, label, issue, path) {
  if (!sameJson(values, sortedUnique6(values.map(normalizedTerm)))) {
    issue(`${label} must contain canonical normalized, sorted, unique entity IDs`, path);
  }
}
function reportProposalIdentity(proposal, issue, path) {
  const { id: _id, canonical: _canonical, ...basis } = proposal;
  const expected = `lineage_proposal_${hashFramedDomain("identity-lineage-proposal", basis).slice(-32)}`;
  if (proposal.id !== expected)
    issue("lineage proposal ID must be bound to its exact semantic basis", path);
}
function reportTombstoneIdentity(proposal, issue, path) {
  const { id: _id, canonical: _canonical, ...basis } = proposal;
  const expected = `tombstone_proposal_${hashFramedDomain("identity-tombstone-proposal", basis).slice(-32)}`;
  if (proposal.id !== expected)
    issue("tombstone proposal ID must be bound to its exact semantic basis", path);
}
function reportAdjudicationSemanticIssues(adjudication, issue) {
  const operation = adjudication.operation;
  const expectedPredicates = predicatesByOperation[operation];
  const actualPredicates = adjudication.claims.map(({ predicate }) => predicate).sort(compareStrings6);
  if (adjudication.claims.length !== expectedPredicates.length || !sameJson(actualPredicates, [...expectedPredicates].sort(compareStrings6))) {
    issue(`adjudication ${operation} claims must use the exact allowed predicate set`, ["claims"]);
  }
  if (adjudication.factPayloads.length !== expectedPredicates.length || !sameJson(adjudication.factPayloads, adjudication.claims.map(({ object }) => object))) {
    issue(`adjudication ${operation} facts must exactly equal its applicable claim payloads`, ["factPayloads"]);
  }
  if (!sameJson(adjudication.evidenceIds, sortedUnique6(adjudication.claims.map(({ evidenceId }) => evidenceId)))) {
    issue("adjudication evidence IDs must exactly equal its claim evidence endpoints", ["evidenceIds"]);
  }
  for (const [index, fact] of adjudication.factPayloads.entries()) {
    reportNormalizedIds(fact.sourceIds, "fact source IDs", issue, ["factPayloads", index, "sourceIds"]);
    reportNormalizedIds(fact.targetIds, "fact target IDs", issue, ["factPayloads", index, "targetIds"]);
    if (fact.operation !== operation)
      issue(`adjudication ${operation} cannot contain a ${fact.operation} fact`, ["factPayloads", index, "operation"]);
    if (!sameJson(fact.sourceIds, adjudication.sourceIds))
      issue("fact source IDs must exactly equal adjudication source IDs", ["factPayloads", index, "sourceIds"]);
  }
  for (const [index, claim] of adjudication.claims.entries()) {
    if (claim.object.operation !== operation)
      issue(`claim predicate ${claim.predicate} does not describe adjudication ${operation}`, ["claims", index]);
    const predicateMatchesFact = claim.predicate === "identity-equivalent" ? claim.object.operation === "same" : claim.predicate === "identity-shared-ownership" ? claim.object.operation === "overlap" : claim.predicate === "identity-partition" ? claim.object.operation === "split" : claim.predicate === "identity-convergence" ? claim.object.operation === "merge" : claim.predicate === "identity-supersession" ? claim.object.operation === "replace" : claim.predicate === "identity-cessation" ? claim.object.operation === "delete" && "durableMeaningCeased" in claim.object : claim.predicate === "identity-no-durable-entity" ? claim.object.operation === "delete" && "noDurableEntity" in claim.object : claim.predicate === "identity-distinct-boundary" ? claim.object.operation === "distinct" : claim.predicate === "identity-conflict" && claim.object.operation === "ambiguous";
    if (!predicateMatchesFact)
      issue(`claim predicate ${claim.predicate} does not match its typed fact`, ["claims", index, "predicate"]);
  }
  const facts = adjudication.factPayloads;
  const expectedTargets = operation === "same" || operation === "overlap" ? facts[0]?.targetIds ?? [] : adjudication.proposedTargetIds;
  if (facts.some(({ targetIds }) => !sameJson(targetIds, expectedTargets))) {
    issue(`adjudication ${operation} facts must use one exact target endpoint set`, ["factPayloads"]);
  }
  const sourceCount = adjudication.sourceIds.length;
  const targetCount = adjudication.proposedTargetIds.length;
  const overlappingEndpoints = adjudication.sourceIds.filter((id) => adjudication.proposedTargetIds.includes(id));
  if (overlappingEndpoints.length > 0) {
    issue(`${operation} source and destination endpoints must be disjoint`, ["proposedTargetIds"]);
  }
  const exactLineage = (kind) => {
    if (adjudication.lineageProposals.length !== 1) {
      issue(`${operation} requires exactly one ${kind} lineage proposal`, ["lineageProposals"]);
      return;
    }
    const proposal = adjudication.lineageProposals[0];
    if (proposal.kind !== kind || !sameJson(proposal.fromIds, adjudication.sourceIds) || !sameJson(proposal.toIds, adjudication.proposedTargetIds)) {
      issue(`${operation} lineage kind and endpoints must exactly describe the adjudicated operation`, ["lineageProposals"]);
    }
    reportProposalIdentity(proposal, issue, ["lineageProposals", 0, "id"]);
  };
  const noContinuity = () => {
    if (adjudication.lineageProposals.length > 0 || adjudication.tombstoneProposals.length > 0) {
      issue(`${operation} cannot authorize lineage or tombstone continuity`);
    }
  };
  switch (operation) {
    case "same": {
      if (sourceCount < 1 || adjudication.proposedTargetIds.length !== 0 || expectedTargets.length < 1)
        issue("same requires supported source identities and exact selected targets");
      const fact = facts[0];
      if (fact?.operation === "same" && fact.equivalentMeaning !== fact.requestedMeaning)
        issue("same equivalence must name the exact requested meaning", ["factPayloads", 0]);
      noContinuity();
      break;
    }
    case "overlap": {
      if (sourceCount < 1 || targetCount !== 0 || expectedTargets.length < 1)
        issue("coordinated overlap requires supported source identities and exact selected targets");
      const fact = facts[0];
      if (fact?.operation === "overlap" && !sameJson(fact.coordinatedSourceIds, adjudication.sourceIds))
        issue("coordination facts must name the exact source identities", ["factPayloads", 0]);
      noContinuity();
      break;
    }
    case "split": {
      if (sourceCount !== 1 || targetCount < 2)
        issue("split requires exactly one source and at least two proposed targets");
      const fact = facts[0];
      if (fact?.operation === "split" && !sameJson(fact.partitionTargetIds, adjudication.proposedTargetIds))
        issue("split partition targets must exactly equal proposed targets", ["factPayloads", 0]);
      exactLineage("split");
      if (adjudication.tombstoneProposals.length > 0)
        issue("split cannot create tombstone proposals", ["tombstoneProposals"]);
      break;
    }
    case "merge": {
      if (sourceCount < 2 || targetCount !== 1)
        issue("merge requires at least two sources and exactly one proposed target");
      const fact = facts[0];
      if (fact?.operation === "merge" && (!sameJson(fact.convergence.sourceIds, adjudication.sourceIds) || fact.convergence.targetId !== adjudication.proposedTargetIds[0]))
        issue("merge convergence must exactly describe sources and target", ["factPayloads", 0]);
      exactLineage("merge");
      if (adjudication.tombstoneProposals.length > 0)
        issue("merge cannot create tombstone proposals", ["tombstoneProposals"]);
      break;
    }
    case "replace": {
      if (sourceCount !== 1 || targetCount !== 1)
        issue("replace requires exactly one source and one proposed target");
      const fact = facts[0];
      if (fact?.operation === "replace" && (fact.supersession.sourceId !== adjudication.sourceIds[0] || !sameJson(fact.supersession.targetIds, adjudication.proposedTargetIds)))
        issue("replace supersession must exactly describe source and target", ["factPayloads", 0]);
      exactLineage("replace");
      break;
    }
    case "delete": {
      if (sourceCount !== 1 || targetCount !== 0 || facts.some(({ targetIds }) => targetIds.length > 0))
        issue("delete requires exactly one source and empty destinations");
      exactLineage("delete");
      break;
    }
    case "distinct": {
      if (targetCount !== 0 || facts.some(({ targetIds }) => targetIds.length > 0))
        issue("distinct facts cannot name target identities");
      noContinuity();
      break;
    }
    case "ambiguous": {
      if (targetCount !== 0 || facts.some(({ targetIds }) => targetIds.length > 0))
        issue("conflict facts cannot authorize target continuity");
      noContinuity();
      break;
    }
  }
  if (operation === "replace" || operation === "delete") {
    if (adjudication.tombstoneProposals.length !== 1)
      issue(`${operation} requires exactly one source tombstone`, ["tombstoneProposals"]);
    for (const [index, proposal] of adjudication.tombstoneProposals.entries()) {
      if (proposal.entityId !== adjudication.sourceIds[0] || !sameJson(proposal.replacementIds, adjudication.proposedTargetIds) || proposal.reason !== adjudication.lineageProposals[0]?.reason) {
        issue(`${operation} tombstone must exactly preserve its source and replacement continuity`, ["tombstoneProposals", index]);
      }
      reportTombstoneIdentity(proposal, issue, ["tombstoneProposals", index, "id"]);
    }
  }
}
function reportResolutionSemanticIssues(resolution, issue) {
  const requestedMeaning = normalizedTerm(resolution.requestedMeaning);
  if (requestedMeaning.length === 0 || requestedMeaning !== resolution.requestedMeaning) {
    issue("resolution requested meaning must be canonical normalized, trimmed, and nonblank", ["requestedMeaning"]);
  }
  reportNormalizedIds(resolution.selectedEntityIds, "selected entity IDs", issue, ["selectedEntityIds"]);
  reportNormalizedIds(resolution.proposedTargetIds, "proposed target IDs", issue, ["proposedTargetIds"]);
  const analysis = candidateAnalysis(resolution.candidateRecords, resolution.requestedKind, resolution.boundState);
  for (const lifecycleIssue of analysis.lifecycleIssues) {
    issue(lifecycleIssue, ["candidateRecords"]);
  }
  if (!sameJson(resolution.candidateRecords, normalizeRecords(resolution.candidateRecords))) {
    issue("persisted candidate records must be canonical normalized and uniquely identified", ["candidateRecords"]);
  }
  if (!sameJson(resolution.candidates, resolution.candidateRecords.map(({ candidate }) => candidate))) {
    issue("persisted candidates must exactly equal the candidate-record projection", ["candidates"]);
  }
  const unresolvedDuplicateBlocker = hasUnresolvedCandidateSearchBlocker(resolution.boundState, resolution.candidateRecords);
  const allowedOutcomes = {
    same: ["reuse-existing", "unresolved"],
    overlap: ["coordinated-modification", "unresolved"],
    split: ["split-existing", "unresolved"],
    merge: ["merge-existing", "unresolved"],
    replace: ["replace-existing", "unresolved"],
    delete: ["no-durable-entity", "unresolved"],
    distinct: ["create-new", "no-durable-entity", "unresolved"],
    ambiguous: ["unresolved"]
  };
  if (!allowedOutcomes[resolution.operation].includes(resolution.outcome)) {
    issue(`resolution operation ${resolution.operation} is incompatible with outcome ${resolution.outcome}`);
  }
  if (resolution.adjudication === void 0) {
    if (resolution.outcome !== "unresolved" && !(resolution.operation === "distinct" && resolution.outcome === "no-durable-entity")) {
      issue("a resolved identity outcome requires persisted adjudication facts", ["adjudication"]);
    }
    if (resolution.selectedEntityIds.length > 0 || resolution.proposedTargetIds.length > 0) {
      issue("unadjudicated identity cannot authorize selected or proposed targets");
    }
    if (resolution.lineageProposals.length > 0 || resolution.tombstoneProposals.length > 0)
      issue("unadjudicated resolution cannot authorize continuity");
    return;
  }
  const adjudication = resolution.adjudication;
  if (adjudication.kind !== resolution.operation || adjudication.operation !== resolution.operation) {
    issue("outer operation and adjudication discriminants must exactly agree", ["adjudication"]);
  }
  if (!sameJson(resolution.proposedTargetIds, adjudication.proposedTargetIds))
    issue("outer proposed targets must exactly equal adjudication targets");
  if (!sameJson(adjudication.sourceIds, analysis.endpointIds)) {
    issue("adjudication sources must exactly equal operation-eligible persisted candidate endpoints", ["adjudication", "sourceIds"]);
  }
  const requestId = `identity_request_${hashFramedDomain("semantic-identity-request", {
    requestedMeaning,
    requestedKind: resolution.requestedKind
  }).slice(-32)}`;
  for (const [index, fact] of adjudication.factPayloads.entries()) {
    if (fact.requestId !== requestId || fact.requestedMeaning !== requestedMeaning || fact.requestedKind !== resolution.requestedKind) {
      issue("fact request identity, meaning, and kind must exactly describe the outer resolution", ["adjudication", "factPayloads", index]);
    }
  }
  for (const [index, claim] of adjudication.claims.entries()) {
    if (claim.subjectKey !== requestId || !sameJson(claim.object, adjudication.factPayloads[index])) {
      issue("claim subject and payload endpoints must exactly describe the outer resolution", ["adjudication", "claims", index]);
    }
  }
  if (resolution.outcome === "unresolved") {
    if (resolution.selectedEntityIds.length > 0 || resolution.proposedTargetIds.length > 0 || resolution.lineageProposals.length > 0 || resolution.tombstoneProposals.length > 0) {
      issue("unresolved identity cannot authorize selected targets, proposals, lineage, or tombstones");
    }
  } else if (resolution.operation === "same" || resolution.operation === "overlap") {
    const factTargets = adjudication.factPayloads[0]?.targetIds ?? [];
    if (!sameJson(resolution.selectedEntityIds, factTargets))
      issue("same/coordinated selected identities must exactly equal fact targets");
  } else if (["split", "merge", "replace", "delete"].includes(resolution.operation)) {
    if (!sameJson(resolution.selectedEntityIds, adjudication.sourceIds))
      issue("lifecycle selected identities must exactly equal operation sources");
  } else if (resolution.selectedEntityIds.length > 0) {
    issue(`${resolution.operation} cannot select canonical entity targets`, ["selectedEntityIds"]);
  }
  const distinctFact = adjudication.factPayloads.find((fact) => fact.operation === "distinct");
  if (distinctFact !== void 0) {
    const factBoundary = distinctFact.boundary ?? void 0;
    if (resolution.newBoundary === void 0 !== (factBoundary === void 0) || resolution.newBoundary !== void 0 && !sameJson(resolution.newBoundary, factBoundary)) {
      issue("distinct-boundary fact must exactly equal the outer normalized new boundary");
    }
  }
  if (resolution.outcome === "create-new") {
    if (resolution.operation !== "distinct" || adjudication.sourceIds.length !== 0 || analysis.supportedRecords.length > 0 || analysis.unresolvedHistoricalBlockers.length > 0 || unresolvedDuplicateBlocker || distinctFact?.boundary === null || distinctFact?.boundary === void 0 || resolution.newBoundary === void 0 || !sameJson(resolution.newBoundary, distinctFact.boundary)) {
      issue("create-new requires no eligible duplicate candidate or unresolved history and one exact distinct-boundary fact equal to the outer canonical boundary");
    }
  } else if (resolution.newBoundary !== void 0) {
    issue("only create-new may persist a new semantic boundary", ["newBoundary"]);
  }
  for (const [index, proposal] of adjudication.lineageProposals.entries()) {
    if (proposal.stateDigest !== resolution.boundState.compiledAgainst.canonicalProjectorDigest) {
      issue("lineage proposal state digest must equal the resolution canonical state digest", ["adjudication", "lineageProposals", index, "stateDigest"]);
    }
  }
  for (const [index, proposal] of adjudication.tombstoneProposals.entries()) {
    const semanticValues = resolution.boundState.valueDependencies.filter(({ kind, id, role }) => kind === "canonical-entity" && id === proposal.entityId && role === "identity candidate semantic value");
    if (semanticValues.length !== 1 || semanticValues[0].versionHash !== proposal.lastSemanticHash) {
      issue("tombstone last semantic hash must equal its exact bound source value", ["adjudication", "tombstoneProposals", index, "lastSemanticHash"]);
    }
  }
}
var verifiedOutcomeEvidence = /* @__PURE__ */ new WeakSet();
function normalizeCandidate(candidate) {
  return {
    ...structuredClone(candidate),
    evidence: canonicalJsonSet(candidate.evidence)
  };
}
function hasUnresolvedCandidateSearchBlocker(binding, records) {
  return records.length === 0 && binding.queryDependencies.some(({ query, priorResult }) => ["identity.exact-search", "identity.alias-search", "identity.lineage", "identity.tombstone"].includes(query.programId) && priorResult.resultCount > 0);
}
var requiredIdentityPrograms = [
  "identity.exact-search",
  "identity.alias-search",
  "identity.lineage",
  "identity.tombstone",
  "identity.relations",
  "identity.topology"
];
function validateIdentityBinding(binding, requestedMeaning, requestedKind, queryRegistry) {
  const normalized = createStateBinding(binding);
  if (normalized.dependencyDigest !== binding.dependencyDigest)
    throw new Error("identity dependency binding digest is invalid");
  const programs = new Set(binding.queryDependencies.map(({ query }) => query.programId));
  const missing = requiredIdentityPrograms.filter((program) => !programs.has(program));
  if (missing.length > 0)
    throw new Error(`identity dependency binding is incomplete: ${missing.join(", ")}`);
  for (const dependency of binding.queryDependencies) {
    queryRegistry.assertCurrent(dependency.query);
    const queryMeaning = dependency.query.input.requestedMeaning;
    const queryKind = dependency.query.input.requestedKind;
    if (queryMeaning !== requestedMeaning.normalize("NFKC").trim() || queryKind !== requestedKind) {
      throw new Error(`identity query dependency ${dependency.query.id} is not bound to the normalized request meaning and kind`);
    }
    if (dependency.query.semanticHash !== dependency.priorResult.queryHash || dependency.priorResult.dependencyKeys.length === 0) {
      throw new Error(`identity query dependency ${dependency.query.id} is not re-evaluable`);
    }
    if (dependency.priorResult.observability !== "closed" && dependency.priorResult.observability !== "bounded") {
      throw new Error(`identity query dependency ${dependency.query.id} cannot establish negative space under ${dependency.priorResult.observability} observability`);
    }
  }
}
function validateCandidateValueDependencies(binding, records) {
  const boundIds = new Set(binding.valueDependencies.filter(({ kind, role }) => kind === "canonical-entity" && role === "identity candidate semantic value").map(({ id }) => String(id)));
  const requiredIds = sortedUnique6(records.flatMap(({ candidate, replacementIds }) => [candidate.entityId, ...replacementIds]));
  const missing = requiredIds.filter((id) => !boundIds.has(id));
  if (missing.length > 0)
    throw new Error(`identity candidate value hashes are incomplete: ${missing.join(", ")}`);
}
function hasOutcomeEvidence(input) {
  const basis = input.outcomeEvidence;
  if (basis === void 0 || !verifiedOutcomeEvidence.has(basis) || basis.kind !== input.assessment || basis.rationale.trim().length === 0 || basis.evidenceIds.length === 0)
    return false;
  const supporting = new Set(input.evidence.filter(({ stance }) => stance === "supports").map(({ evidenceId }) => evidenceId));
  if (!basis.evidenceIds.every((id) => id.trim().length > 0 && supporting.has(id)))
    return false;
  switch (basis.kind) {
    case "same":
      return basis.equivalentMeaning === true;
    case "overlap":
      return basis.sharedOwnership === true;
    case "split":
      return basis.partitionMeanings.length >= 2 && basis.partitionMeanings.every((meaning) => meaning.trim().length > 0);
    case "merge":
      return basis.convergentTargetMeaning.trim().length > 0;
    case "replace":
      return basis.incompatibility.trim().length > 0;
    case "delete":
      return basis.durableMeaningCeased === true;
    case "distinct":
      return basis.independentBoundary === true;
    case "ambiguous":
      return basis.unresolvedConflict.trim().length > 0;
  }
}
function computeEvidenceContentHash(evidence) {
  const parsed = EvidenceSchema.parse(evidence);
  const { contentHash: _declared, ...projection } = parsed;
  return hashFramedDomain("evidence-content", projection);
}
function parseVerifiedEvidence(value, expectedId) {
  const evidence = EvidenceSchema.parse(value);
  if (evidence.id !== expectedId)
    throw new Error(`trusted Evidence ID mismatch for ${expectedId}`);
  if (computeEvidenceContentHash(evidence) !== evidence.contentHash) {
    throw new Error(`trusted Evidence content hash integrity mismatch for ${expectedId}`);
  }
  return evidence;
}
function outcomeFactFromEvidence(assessment, evidence, input, analysis) {
  const requestedMeaning = input.requestedMeaning.normalize("NFKC").trim();
  const requestId = `identity_request_${hashFramedDomain("semantic-identity-request", {
    requestedMeaning,
    requestedKind: input.requestedKind
  }).slice(-32)}`;
  const sourceIds = analysis.endpointIds;
  const proposedTargetIds = sortedUnique6(input.proposedTargetIds ?? []);
  const targetIds = assessment === "same" || assessment === "overlap" ? analysis.endpointIds : proposedTargetIds;
  const common = {
    version: 1,
    requestId,
    requestedMeaning,
    requestedKind: input.requestedKind,
    operation: assessment,
    sourceIds,
    targetIds
  };
  const expectedByPredicate = assessment === "same" ? { "identity-equivalent": { ...common, equivalentMeaning: requestedMeaning } } : assessment === "overlap" ? { "identity-shared-ownership": { ...common, coordinatedSourceIds: sourceIds } } : assessment === "split" ? { "identity-partition": { ...common, partitionTargetIds: targetIds } } : assessment === "merge" ? { "identity-convergence": { ...common, convergence: { sourceIds, targetId: targetIds[0] } } } : assessment === "replace" ? { "identity-supersession": { ...common, supersession: { sourceId: sourceIds[0], targetIds } } } : assessment === "delete" ? {
    "identity-cessation": { ...common, durableMeaningCeased: true },
    "identity-no-durable-entity": { ...common, noDurableEntity: true }
  } : assessment === "distinct" ? { "identity-distinct-boundary": { ...common, boundary: input.newBoundary ?? null } } : { "identity-conflict": { ...common, unresolvedConflict: "ownership conflict" } };
  const expectedPredicates = Object.keys(expectedByPredicate);
  const claims = evidence.flatMap((item) => item.claims.filter(({ subjectKey, predicate }) => subjectKey === requestId && expectedPredicates.includes(predicate)).map((claim) => ({ evidenceId: item.id, claim })));
  for (const predicate of expectedPredicates) {
    const payloads = claims.filter(({ claim }) => claim.predicate === predicate).map(({ claim }) => claim.object);
    if (payloads.some((payload) => canonicalJson(payload) !== canonicalJson(expectedByPredicate[predicate]))) {
      throw new Error(`incompatible ${predicate} payload for the requested identity operation`);
    }
    if (payloads.length === 0)
      return void 0;
  }
  const evidenceIds2 = sortedUnique6(claims.map(({ evidenceId }) => evidenceId));
  const fact = assessment === "same" ? { kind: "same", equivalentMeaning: true, evidenceIds: evidenceIds2, rationale: "verified request-bound identity equivalence claim" } : assessment === "overlap" ? { kind: "overlap", sharedOwnership: true, evidenceIds: evidenceIds2, rationale: "verified request-bound coordination claim" } : assessment === "split" ? { kind: "split", partitionMeanings: targetIds, evidenceIds: evidenceIds2, rationale: "verified request-bound partition claim" } : assessment === "merge" ? { kind: "merge", convergentTargetMeaning: targetIds[0] ?? "", evidenceIds: evidenceIds2, rationale: "verified request-bound convergence claim" } : assessment === "replace" ? { kind: "replace", incompatibility: `${sourceIds[0] ?? ""}->${targetIds.join(",")}`, evidenceIds: evidenceIds2, rationale: "verified request-bound supersession claim" } : assessment === "delete" ? { kind: "delete", durableMeaningCeased: true, evidenceIds: evidenceIds2, rationale: "verified request-bound cessation claims" } : assessment === "distinct" ? { kind: "distinct", independentBoundary: true, evidenceIds: evidenceIds2, rationale: "verified request-bound distinct boundary claim" } : { kind: "ambiguous", unresolvedConflict: "ownership conflict", evidenceIds: evidenceIds2, rationale: "verified request-bound conflict claim" };
  return {
    ...fact,
    verifiedClaims: claims.map(({ evidenceId, claim }) => ({
      evidenceId,
      subjectKey: claim.subjectKey,
      predicate: claim.predicate,
      object: IdentityOperationFactSchema.parse(claim.object),
      ...claim.inferenceConfidence === void 0 ? {} : { inferenceConfidence: claim.inferenceConfidence }
    })).sort((left, right) => compareStrings6(canonicalJson(left), canonicalJson(right)))
  };
}
function normalizeRecords(records) {
  const byId = /* @__PURE__ */ new Map();
  for (const record of records) {
    const normalized = { ...structuredClone(record), replacementIds: sortedUnique6(record.replacementIds), candidate: normalizeCandidate(record.candidate) };
    const existing = byId.get(record.candidate.entityId);
    if (existing !== void 0 && canonicalJson(existing) !== canonicalJson(normalized)) {
      throw new Error(`conflicting duplicate identity observation for ${record.candidate.entityId}`);
    }
    byId.set(record.candidate.entityId, normalized);
  }
  return [...byId.values()].sort((left, right) => compareStrings6(canonicalJson(left), canonicalJson(right)));
}
function supportsRequestedIdentity(record, requestedKind) {
  const { candidate } = record;
  return (requestedKind === "unknown" || candidate.entityKind === requestedKind) && candidate.similarity >= 0.75 && candidate.ownershipFit >= 0.75 && candidate.boundaryFit >= 0.7 && candidate.explanation.trim().length > 0 && candidate.evidence.some(({ evidenceId, stance }) => evidenceId.trim().length > 0 && stance === "supports");
}
function candidateAnalysis(records, requestedKind, binding) {
  const supportedRecords = records.filter((record) => supportsRequestedIdentity(record, requestedKind));
  const recordsById = new Map(records.map((record) => [record.candidate.entityId, record]));
  const semanticDependencyCounts = /* @__PURE__ */ new Map();
  for (const dependency of binding.valueDependencies) {
    if (dependency.kind === "canonical-entity" && dependency.role === "identity candidate semantic value") {
      semanticDependencyCounts.set(String(dependency.id), (semanticDependencyCounts.get(String(dependency.id)) ?? 0) + 1);
    }
  }
  const lifecycleIssues = /* @__PURE__ */ new Set();
  const endpointIds = /* @__PURE__ */ new Set();
  const resolveReplacement = (record, path, reachedByReplacement) => {
    const id = record.candidate.entityId;
    if (path.includes(id)) {
      lifecycleIssues.add(`identity lifecycle replacement cycle detected: ${[...path, id].join(" -> ")}`);
      return;
    }
    const isTerminal = record.lifecycle === "active" || record.lifecycle === "deprecated";
    if ((reachedByReplacement || isTerminal) && !supportsRequestedIdentity(record, requestedKind)) {
      lifecycleIssues.add(`identity lifecycle replacement ${id} is not eligible for the requested kind and meaning`);
      return;
    }
    if ((reachedByReplacement || isTerminal) && (semanticDependencyCounts.get(id) ?? 0) !== 1) {
      lifecycleIssues.add(`identity lifecycle replacement ${id} requires exactly one bound semantic candidate value`);
      return;
    }
    if (isTerminal) {
      endpointIds.add(id);
      return;
    }
    if (record.replacementIds.length === 0) {
      if (reachedByReplacement) {
        lifecycleIssues.add(`identity lifecycle replacement ${id} is a nonterminal historical endpoint`);
      }
      return;
    }
    for (const replacementId of record.replacementIds) {
      if (replacementId === id) {
        lifecycleIssues.add(`identity lifecycle replacement ${id} cannot point to itself`);
        continue;
      }
      const replacement = recordsById.get(replacementId);
      if (replacement === void 0) {
        lifecycleIssues.add(`identity lifecycle replacement ${replacementId} is missing its persisted candidate record`);
        continue;
      }
      if (requestedKind !== "unknown" && replacement.candidate.entityKind !== requestedKind) {
        lifecycleIssues.add(`identity lifecycle replacement ${replacementId} has the wrong requested kind`);
        continue;
      }
      resolveReplacement(replacement, [...path, id], true);
    }
  };
  for (const record of records) {
    const matchesRequestedKind = requestedKind === "unknown" || record.candidate.entityKind === requestedKind;
    if (!matchesRequestedKind || record.lifecycle !== "superseded" && record.lifecycle !== "tombstone")
      continue;
    if (record.replacementIds.length > 0)
      resolveReplacement(record, [], false);
  }
  for (const record of supportedRecords) {
    if (record.lifecycle === "active" || record.lifecycle === "deprecated")
      resolveReplacement(record, [], false);
  }
  return {
    supportedRecords,
    endpointIds: sortedUnique6([...endpointIds]),
    unresolvedHistoricalBlockers: records.filter(({ candidate, lifecycle, replacementIds }) => (requestedKind === "unknown" || candidate.entityKind === requestedKind) && (lifecycle === "superseded" || lifecycle === "tombstone") && replacementIds.length === 0),
    lifecycleIssues: [...lifecycleIssues].sort(compareStrings6)
  };
}
function assertValidLifecycleAnalysis(analysis) {
  if (analysis.lifecycleIssues.length > 0) {
    throw new Error(`invalid identity lifecycle replacement graph: ${analysis.lifecycleIssues.join("; ")}`);
  }
}
function normalizeBoundary(boundary) {
  if (boundary === void 0)
    return void 0;
  NewSemanticBoundarySchema.parse(boundary);
  const normalizeMembers = (values, label) => {
    const normalized = values.map((value) => value.normalize("NFKC").trim());
    if (normalized.some((value) => value.length === 0))
      throw new Error(`semantic boundary ${label} members cannot be blank`);
    return sortedUnique6(normalized);
  };
  const owns = normalizeMembers(boundary.owns, "owns");
  const excludes = normalizeMembers(boundary.excludes, "excludes");
  const overlap = owns.filter((value) => excludes.includes(value));
  if (overlap.length > 0)
    throw new Error(`semantic boundary owns/excludes sets overlap: ${overlap.join(", ")}`);
  const nearestEntityIds = normalizeMembers(boundary.nearestEntityIds, "nearestEntityIds");
  nearestEntityIds.forEach((id) => EntityIdSchema.parse(id));
  const rationale = boundary.rationale.normalize("NFKC").trim();
  if (rationale.length === 0)
    throw new Error("semantic boundary rationale cannot be blank");
  return CanonicalSemanticBoundarySchema.parse({ owns, excludes, nearestEntityIds, rationale });
}
function prepareIdentityInput(input) {
  if ((input.proposedTargetIds ?? []).some((id) => id.trim().length === 0))
    throw new Error("identity lineage target IDs cannot be blank");
  if (new Set(input.proposedTargetIds ?? []).size !== (input.proposedTargetIds ?? []).length)
    throw new Error("identity lineage target IDs must be unique");
  const proposedTargetIds = sortedUnique6((input.proposedTargetIds ?? []).map((id) => id.normalize("NFKC").trim()));
  proposedTargetIds.forEach((id) => EntityIdSchema.parse(id));
  const newBoundary = normalizeBoundary(input.newBoundary);
  const { newBoundary: _rawBoundary, ...inputWithoutBoundary } = input;
  return {
    ...inputWithoutBoundary,
    requestedMeaning: input.requestedMeaning.normalize("NFKC").trim(),
    records: normalizeRecords(input.records),
    boundState: canonicalStateBinding(input.boundState),
    proposedTargetIds,
    ...newBoundary === void 0 ? {} : { newBoundary }
  };
}
function validBoundary(boundary) {
  return boundary !== void 0 && boundary.owns.some((value) => value.trim().length > 0) && boundary.excludes.some((value) => value.trim().length > 0) && boundary.rationale.trim().length > 0;
}
function decision(input, records, analysis) {
  const unknowns = sortedUnique6(input.unknowns);
  if (!input.durableEntity)
    return { outcome: "no-durable-entity", selectedEntityIds: [], unknowns };
  if (!hasOutcomeEvidence(input)) {
    return { outcome: "unresolved", selectedEntityIds: [], unknowns: sortedUnique6([...unknowns, "identity outcome lacks outcome-specific supporting evidence"]) };
  }
  const supported = analysis.supportedRecords;
  const targets = analysis.endpointIds;
  const historicalBlockers = analysis.unresolvedHistoricalBlockers;
  if (input.assessment === "ambiguous") {
    return { outcome: "unresolved", selectedEntityIds: [], unknowns: sortedUnique6([...unknowns, "semantic ownership remains ambiguous"]) };
  }
  if (input.assessment === "distinct") {
    const unresolvedSearchResults = hasUnresolvedCandidateSearchBlocker(input.boundState, records);
    if (unresolvedSearchResults) {
      return { outcome: "unresolved", selectedEntityIds: [], unknowns: sortedUnique6([...unknowns, "identity search returned candidates or history that were not resolved into candidate records"]) };
    }
    if (supported.length > 0) {
      return { outcome: "unresolved", selectedEntityIds: [], unknowns: sortedUnique6([...unknowns, "existing or historical identity overlaps the requested meaning"]) };
    }
    if (!validBoundary(input.newBoundary)) {
      return {
        outcome: "unresolved",
        selectedEntityIds: [],
        unknowns: sortedUnique6([
          ...unknowns,
          input.records.length > 0 ? "existing or historical identity overlaps the requested meaning" : "new semantic boundary is incomplete"
        ])
      };
    }
    return { outcome: "create-new", selectedEntityIds: [], unknowns, newBoundary: structuredClone(input.newBoundary) };
  }
  if (historicalBlockers.length > 0) {
    return { outcome: "unresolved", selectedEntityIds: [], unknowns: sortedUnique6([...unknowns, "unreplaced tombstone blocks live identity reuse"]) };
  }
  if (targets.length === 0) {
    return { outcome: "unresolved", selectedEntityIds: [], unknowns: sortedUnique6([...unknowns, "no candidate supports the requested identity decision"]) };
  }
  if ((input.assessment === "same" || input.assessment === "split" || input.assessment === "replace" || input.assessment === "delete") && targets.length !== 1) {
    return { outcome: "unresolved", selectedEntityIds: [], unknowns: sortedUnique6([...unknowns, `${input.assessment} identity adjudication requires exactly one supported live target`]) };
  }
  const outcome = input.assessment === "same" ? "reuse-existing" : input.assessment === "overlap" ? "coordinated-modification" : input.assessment === "split" ? "split-existing" : input.assessment === "merge" ? "merge-existing" : input.assessment === "delete" ? "no-durable-entity" : "replace-existing";
  if (outcome === "merge-existing" && targets.length < 2) {
    return { outcome: "unresolved", selectedEntityIds: [], unknowns: sortedUnique6([...unknowns, "merge requires at least two existing identities"]) };
  }
  return { outcome, selectedEntityIds: targets, unknowns };
}
function resolveSemanticIdentity(input) {
  const prepared = prepareIdentityInput(input);
  const analysis = candidateAnalysis(prepared.records, prepared.requestedKind, prepared.boundState);
  assertValidLifecycleAnalysis(analysis);
  return resolvePreparedSemanticIdentity(prepared, analysis);
}
function resolvePreparedSemanticIdentity(input, analysis) {
  if (input.requestedMeaning.trim().length === 0)
    throw new Error("requested semantic meaning cannot be blank");
  if (input.durableEntity)
    validateIdentityBinding(input.boundState, input.requestedMeaning, input.requestedKind, input.queryRegistry);
  const records = input.records;
  if (input.durableEntity)
    validateCandidateValueDependencies(input.boundState, records);
  const candidates = records.map(({ candidate }) => candidate);
  const resolved = decision(input, records, analysis);
  const evidence = canonicalJsonSet(input.evidence);
  const candidateScores = candidates.map(({ similarity, ownershipFit, boundaryFit }) => Math.min(similarity, ownershipFit, boundaryFit));
  const confidence = resolved.outcome === "no-durable-entity" ? 1 : resolved.outcome === "unresolved" ? Math.min(0.49, ...candidates.map(({ similarity, ownershipFit, boundaryFit }) => Math.min(similarity, ownershipFit, boundaryFit)), 0.49) : resolved.outcome === "create-new" ? candidates.length === 0 ? 1 : 1 - Math.max(...candidateScores) : candidates.length === 0 ? 1 : Math.min(...candidateScores);
  const proposedTargetIds = resolved.outcome === "unresolved" ? [] : sortedUnique6(input.proposedTargetIds ?? []);
  const sourceIds = analysis.endpointIds;
  const lineageKind = resolved.outcome === "split-existing" ? "split" : resolved.outcome === "merge-existing" ? "merge" : resolved.outcome === "replace-existing" ? "replace" : input.assessment === "delete" && resolved.outcome === "no-durable-entity" && input.durableEntity ? "delete" : void 0;
  if (lineageKind !== void 0 && proposedTargetIds.some((id) => sourceIds.includes(id))) {
    throw new Error(`${lineageKind} lineage targets must be nonblank and distinct from source identities to preserve continuity`);
  }
  if (lineageKind !== void 0 && lineageKind !== "delete") {
    const targetDependencies = input.boundState.valueDependencies.filter(({ kind, role }) => kind === "canonical-entity" && role === "identity candidate semantic value");
    const missingTargets = proposedTargetIds.filter((targetId) => targetDependencies.filter(({ id }) => id === targetId).length !== 1);
    if (missingTargets.length > 0)
      throw new Error(`identity lineage target semantic bindings are incomplete or ambiguous: ${missingTargets.join(", ")}`);
  }
  if (resolved.outcome === "split-existing" && (sourceIds.length !== 1 || proposedTargetIds.length < 2))
    throw new Error("split lineage requires exactly one source and at least two targets");
  if (resolved.outcome === "merge-existing" && (sourceIds.length < 2 || proposedTargetIds.length !== 1))
    throw new Error("merge lineage requires at least two sources and exactly one target");
  if (resolved.outcome === "replace-existing" && (sourceIds.length !== 1 || proposedTargetIds.length !== 1))
    throw new Error("replace lineage requires exactly one source and one replacement");
  if (input.assessment === "delete" && resolved.outcome === "no-durable-entity" && sourceIds.length !== 1)
    throw new Error("delete lineage requires exactly one source");
  if (input.assessment === "delete" && proposedTargetIds.length !== 0)
    throw new Error("delete lineage cannot have destinations or replacements");
  const lineageBasis = lineageKind === void 0 ? void 0 : {
    kind: lineageKind,
    fromIds: sourceIds,
    toIds: proposedTargetIds,
    reason: `evidence-backed ${lineageKind} of requested meaning`,
    stateDigest: input.boundState.compiledAgainst.canonicalProjectorDigest
  };
  const lineageProposals = lineageBasis === void 0 ? [] : (() => {
    const lineageErrors = validateLineage(lineageBasis);
    if (lineageErrors.length > 0)
      throw new Error(`invalid identity lineage proposal: ${lineageErrors.join("; ")}`);
    const proposal = {
      id: `lineage_proposal_${hashFramedDomain("identity-lineage-proposal", lineageBasis).slice(-32)}`,
      canonical: false,
      ...lineageBasis
    };
    LineageRecordSchema.parse({
      id: proposal.id,
      kind: proposal.kind,
      fromIds: proposal.fromIds,
      toIds: proposal.toIds,
      reason: proposal.reason,
      stateDigest: proposal.stateDigest
    });
    return [proposal];
  })();
  const tombstoneProposals = lineageKind === "replace" || lineageKind === "delete" ? sourceIds.map((entityId) => {
    const semanticDependencies = input.boundState.valueDependencies.filter(({ kind, id, role }) => kind === "canonical-entity" && id === entityId && role === "identity candidate semantic value");
    if (semanticDependencies.length !== 1) {
      throw new Error(`identity candidate ${entityId} requires exactly one explicit semantic value dependency for tombstone continuity`);
    }
    const lastSemanticHash = semanticDependencies[0].versionHash;
    const basis = { entityId, lastSemanticHash, replacementIds: proposedTargetIds, reason: lineageBasis.reason };
    if (lineageKind === "delete" && basis.replacementIds.length !== 0)
      throw new Error("delete tombstone cannot have replacement IDs");
    TombstoneSchema.parse({ ...basis, deletedAtRevision: 0 });
    return { id: `tombstone_proposal_${hashFramedDomain("identity-tombstone-proposal", basis).slice(-32)}`, canonical: false, ...basis };
  }) : [];
  const semantic = {
    contractVersion: 1,
    requestedMeaning: input.requestedMeaning.normalize("NFKC").trim(),
    requestedKind: input.requestedKind,
    outcome: resolved.outcome,
    candidates,
    candidateRecords: structuredClone(records),
    selectedEntityIds: resolved.selectedEntityIds,
    ...resolved.newBoundary === void 0 ? {} : {
      newBoundary: {
        owns: sortedUnique6(resolved.newBoundary.owns),
        excludes: sortedUnique6(resolved.newBoundary.excludes),
        nearestEntityIds: sortedUnique6(resolved.newBoundary.nearestEntityIds),
        rationale: resolved.newBoundary.rationale
      }
    },
    confidence,
    evidence,
    unknowns: resolved.unknowns,
    boundState: structuredClone(input.boundState)
  };
  const adjudication = input.outcomeEvidence !== void 0 && verifiedOutcomeEvidence.has(input.outcomeEvidence) && (resolved.outcome !== "unresolved" || input.assessment === "ambiguous") ? {
    kind: input.outcomeEvidence.kind,
    operation: input.assessment,
    sourceIds,
    proposedTargetIds,
    factPayloads: canonicalJsonSet(input.outcomeEvidence.verifiedClaims ?? []).map(({ object }) => structuredClone(object)),
    evidenceIds: sortedUnique6(input.outcomeEvidence.evidenceIds),
    claims: canonicalJsonSet(input.outcomeEvidence.verifiedClaims ?? []),
    claimHashes: sortedUnique6((input.outcomeEvidence.verifiedClaims ?? []).map((claim) => hashFramedDomain("identity-adjudication-claim-ref", claim))),
    lineageProposals: structuredClone(lineageProposals),
    tombstoneProposals: structuredClone(tombstoneProposals)
  } : void 0;
  const adjudicationWithHash = adjudication === void 0 ? void 0 : {
    ...adjudication,
    contentHash: hashFramedDomain("identity-adjudication", adjudication)
  };
  const contentHash = hashFramedDomain("semantic-identity-resolution", {
    ...semantic,
    operation: input.assessment,
    proposedTargetIds,
    lineageProposals,
    tombstoneProposals,
    ...adjudicationWithHash === void 0 ? {} : { adjudication: adjudicationWithHash }
  });
  const result = {
    id: `identity_resolution_${contentHash.slice(-32)}`,
    ...semantic,
    operation: input.assessment,
    proposedTargetIds,
    ...adjudicationWithHash === void 0 ? {} : { adjudication: adjudicationWithHash },
    lineageProposals,
    tombstoneProposals,
    contentHash
  };
  return AdjudicatedSemanticIdentityResolutionSchema.parse(result);
}
async function resolveSemanticIdentityFromEvidence(input, repository) {
  const prepared = prepareIdentityInput(input);
  const analysis = candidateAnalysis(prepared.records, prepared.requestedKind, prepared.boundState);
  assertValidLifecycleAnalysis(analysis);
  const supportingIds = sortedUnique6(prepared.evidence.filter(({ stance }) => stance === "supports").map(({ evidenceId }) => evidenceId));
  const evidence = await Promise.all(supportingIds.map(async (id) => parseVerifiedEvidence(await repository.loadEvidence(id), id)));
  const applicable = evidence.filter((item) => item.applicability === "direct" && item.reliability !== "low" && item.reliability !== "untrusted");
  const outcomeEvidence = outcomeFactFromEvidence(prepared.assessment, applicable, prepared, analysis);
  if (outcomeEvidence !== void 0)
    verifiedOutcomeEvidence.add(outcomeEvidence);
  const { outcomeEvidence: _callerOutcome, ...trustedInput } = prepared;
  return resolvePreparedSemanticIdentity(outcomeEvidence === void 0 ? trustedInput : { ...trustedInput, outcomeEvidence }, analysis);
}
async function resolveSemanticIdentityFromSearch(input) {
  if (canonicalJson(input.context.stateDigest) !== canonicalJson(input.compiledAgainst)) {
    throw new Error("identity search context snapshot differs from compiledAgainst state");
  }
  const search = await input.search.inspect({ requestedMeaning: input.requestedMeaning, requestedKind: input.requestedKind }, input.context);
  const boundState = createStateBinding({
    compiledAgainst: input.compiledAgainst,
    valueDependencies: search.valueDependencies,
    queryDependencies: search.queryDependencies
  });
  const { compiledAgainst: _compiledAgainst, context: _context, search: _search, evidenceRepository, ...resolutionInput } = input;
  return resolveSemanticIdentityFromEvidence({ ...resolutionInput, records: search.records, boundState }, evidenceRepository);
}
function parseIdentityAdjudication(value) {
  const record = IdentityAdjudicationSchema.parse(value);
  if (record.kind !== record.operation) {
    throw new Error("trusted identity adjudication is invalid");
  }
  const claims = record.claims.map((claim) => structuredClone(claim)).sort((left, right) => compareStrings6(canonicalJson(left), canonicalJson(right)));
  const expectedClaimHashes = sortedUnique6(claims.map((claim) => hashFramedDomain("identity-adjudication-claim-ref", claim)));
  const expectedFactPayloads = claims.map(({ object }) => structuredClone(object));
  const basis = {
    kind: record.kind,
    operation: record.operation,
    sourceIds: sortedUnique6(record.sourceIds),
    proposedTargetIds: sortedUnique6(record.proposedTargetIds),
    factPayloads: structuredClone(record.factPayloads),
    evidenceIds: sortedUnique6(record.evidenceIds),
    claims,
    claimHashes: sortedUnique6(record.claimHashes),
    lineageProposals: structuredClone(record.lineageProposals),
    tombstoneProposals: structuredClone(record.tombstoneProposals)
  };
  if (canonicalJson(record.sourceIds) !== canonicalJson(basis.sourceIds) || canonicalJson(record.proposedTargetIds) !== canonicalJson(basis.proposedTargetIds) || canonicalJson(basis.factPayloads) !== canonicalJson(expectedFactPayloads)) {
    throw new Error("trusted identity adjudication endpoint sets are not normalized and unique");
  }
  for (const proposal of basis.lineageProposals) {
    if (proposal.canonical !== false || validateLineage(proposal).length > 0)
      throw new Error("trusted identity adjudication lineage proposal is invalid");
    LineageRecordSchema.parse({
      id: proposal.id,
      kind: proposal.kind,
      fromIds: proposal.fromIds,
      toIds: proposal.toIds,
      reason: proposal.reason,
      stateDigest: proposal.stateDigest
    });
  }
  for (const proposal of basis.tombstoneProposals) {
    if (proposal.canonical !== false || new Set(proposal.replacementIds).size !== proposal.replacementIds.length) {
      throw new Error("trusted identity adjudication tombstone proposal is invalid");
    }
    TombstoneSchema.parse({
      entityId: proposal.entityId,
      deletedAtRevision: 0,
      lastSemanticHash: proposal.lastSemanticHash,
      replacementIds: proposal.replacementIds,
      reason: proposal.reason
    });
  }
  if (canonicalJson(basis.claimHashes) !== canonicalJson(expectedClaimHashes) || claims.some(({ evidenceId }) => !basis.evidenceIds.includes(evidenceId))) {
    throw new Error("trusted identity adjudication claim references are invalid");
  }
  if (hashFramedDomain("identity-adjudication", basis) !== record.contentHash)
    throw new Error("trusted identity adjudication content hash mismatch");
  return { ...basis, contentHash: record.contentHash };
}
async function assertCanonicalCreationAllowed(request, repository) {
  const resolution = AdjudicatedSemanticIdentityResolutionSchema.parse(await repository.loadResolution(request.resolutionId));
  requireCanonicalStateBinding(resolution.boundState, "canonical creation refused: trusted resolution StateBinding is not canonical");
  if (resolution.id !== request.resolutionId)
    throw new Error("canonical creation refused: trusted resolution ID mismatch");
  const { id: _id, contentHash: _contentHash, ...resolutionSemantic } = resolution;
  const adjudication = resolution.adjudication === void 0 ? void 0 : parseIdentityAdjudication(resolution.adjudication);
  if (canonicalJson(sortedUnique6(resolution.proposedTargetIds)) !== canonicalJson(resolution.proposedTargetIds) || adjudication !== void 0 && (adjudication.operation !== resolution.operation || canonicalJson(adjudication.proposedTargetIds) !== canonicalJson(resolution.proposedTargetIds) || canonicalJson(adjudication.lineageProposals) !== canonicalJson(resolution.lineageProposals) || canonicalJson(adjudication.tombstoneProposals) !== canonicalJson(resolution.tombstoneProposals))) {
    throw new Error("canonical creation refused: resolution continuity differs from its adjudication");
  }
  if (hashFramedDomain("semantic-identity-resolution", resolutionSemantic) !== resolution.contentHash) {
    throw new Error("canonical creation refused: trusted resolution content hash mismatch");
  }
  if (resolution.id !== `identity_resolution_${resolution.contentHash.slice(-32)}`) {
    throw new Error("canonical creation refused: trusted resolution ID is not bound to its content hash");
  }
  if (!await repository.verifyAdjudication(resolution)) {
    throw new Error("canonical creation refused: trusted repository has no verified adjudication provenance for this resolution");
  }
  const validation2 = StateBindingValidationSchema.parse(await repository.validateBinding(resolution.boundState));
  if (validation2.changedValueDependencyIds.length > 0 || validation2.changedQueryDependencyIds.length > 0) {
    throw new Error(`canonical creation refused: ${validation2.status} binding validation is inconsistent with changed dependencies`);
  }
  let mutationBinding;
  if (validation2.status === "current") {
    if (validation2.rebound !== void 0 || canonicalJson(validation2.currentState) !== canonicalJson(resolution.boundState.compiledAgainst)) {
      throw new Error("canonical creation refused: current binding validation is internally inconsistent");
    }
    mutationBinding = resolution.boundState;
  } else if (validation2.status === "rebound") {
    if (validation2.rebound === void 0) {
      throw new Error("canonical creation refused: rebound binding validation is internally inconsistent");
    }
    const rebound = requireCanonicalStateBinding(validation2.rebound, "canonical creation refused: rebound StateBinding is not canonical");
    if (canonicalJson(rebound.compiledAgainst) !== canonicalJson(validation2.currentState) || rebound.dependencyDigest !== resolution.boundState.dependencyDigest) {
      throw new Error("canonical creation refused: rebound binding validation is internally inconsistent");
    }
    mutationBinding = rebound;
  } else {
    throw new Error("canonical creation refused: identity resolution was not adjudicated against current authoritative state");
  }
  if (resolution.outcome !== "create-new") {
    throw new Error(`canonical creation refused: identity outcome ${resolution.outcome} is unresolved or overlaps existing authority`);
  }
  const candidateEligibility = candidateAnalysis(resolution.candidateRecords, resolution.requestedKind, resolution.boundState);
  assertValidLifecycleAnalysis(candidateEligibility);
  if (candidateEligibility.supportedRecords.length > 0 || candidateEligibility.unresolvedHistoricalBlockers.length > 0 || hasUnresolvedCandidateSearchBlocker(resolution.boundState, resolution.candidateRecords)) {
    throw new Error("canonical creation refused: persisted eligible candidates or unresolved identity history block duplicate creation");
  }
  if (adjudication?.kind !== "distinct" || adjudication.claims.length === 0) {
    throw new Error("canonical creation refused: persisted hash-bound distinct adjudication facts are required");
  }
  if (!validBoundary(resolution.newBoundary))
    throw new Error("canonical creation refused: inspectable semantic boundary is required");
  if (resolution.confidence < 0.75 || resolution.evidence.every(({ evidenceId, stance }) => evidenceId.trim().length === 0 || stance !== "supports")) {
    throw new Error("canonical creation refused: identity resolution evidence and confidence do not meet the authoritative acceptance threshold");
  }
  const supportingResolutionRefs = resolution.evidence.filter(({ stance }) => stance === "supports");
  const resolutionEvidence = await Promise.all(supportingResolutionRefs.map(async ({ evidenceId }) => ({
    evidenceId,
    evidence: parseVerifiedEvidence(await repository.loadEvidence(evidenceId), evidenceId)
  })));
  if (resolutionEvidence.length === 0 || resolutionEvidence.some(({ evidenceId, evidence: item }) => item.id !== evidenceId || item.applicability !== "direct" || item.reliability === "low" || item.reliability === "untrusted" || !item.claims.some(({ subjectKey, predicate, object }) => subjectKey === resolution.id && predicate === "identity-create-new-supported" && object === true))) {
    throw new Error("canonical creation refused: trusted directly applicable resolution evidence claim is required");
  }
  const resolutionEvidenceById = new Map(resolutionEvidence.map(({ evidenceId, evidence: item }) => [evidenceId, item]));
  if (adjudication.claims.some(({ evidenceId, ...expectedClaim }) => {
    const item = resolutionEvidenceById.get(evidenceId);
    return item === void 0 || !item.claims.some((claim) => canonicalJson(claim) === canonicalJson(expectedClaim));
  })) {
    throw new Error("canonical creation refused: persisted adjudication facts do not match hash-verified repository Evidence");
  }
  const authorityEnvelope = CanonicalDocumentEnvelopeSchema.parse(await repository.loadAuthorityEnvelope(request.authorityRecordId));
  if (authorityEnvelope.kind !== "authority-record" || authorityEnvelope.id !== request.authorityRecordId) {
    throw new Error("canonical creation refused: trusted Authority Record envelope mismatch");
  }
  const authority = AuthorityRecordSchema.parse(authorityEnvelope.payload);
  if (authority.status !== "approved" && authority.status !== "auto-approved" || authority.decidedBy !== "user" && authority.decidedBy !== "policy") {
    throw new Error("canonical creation refused: approved user or policy Authority Record is required");
  }
  if (authority.subjectId !== resolution.id || authority.rationale.trim().length === 0) {
    throw new Error("canonical creation refused: Authority Record must directly govern this identity resolution");
  }
  if (authority.conclusion !== "normalize") {
    throw new Error(`canonical creation refused: Authority Record conclusion ${authority.conclusion} does not normatively authorize create-new`);
  }
  const evidence = await Promise.all(authority.evidence.map(async ({ evidenceId }) => parseVerifiedEvidence(await repository.loadEvidence(evidenceId), evidenceId)));
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  if (authority.evidence.length === 0 || authority.evidence.some(({ evidenceId, stance }) => {
    const item = evidenceById.get(evidenceId);
    const creationClaims = item?.claims.filter(({ subjectKey, predicate }) => subjectKey === resolution.id && predicate === "canonical-creation-approved") ?? [];
    return evidenceId.trim().length === 0 || item === void 0 || item.id !== evidenceId || item.applicability !== "direct" || item.reliability === "low" || item.reliability === "untrusted" || stance !== "supports" || item.normativeAuthority !== "binding-decision" && item.normativeAuthority !== "hard-constraint" || creationClaims.length === 0 || creationClaims.some(({ object }) => object !== true);
  }))
    throw new Error("canonical creation refused: validated nonblank authoritative evidence is required");
  return structuredClone(mutationBinding);
}

// node_modules/@projector/engine/dist/relevance/index.js
var compareStrings7 = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var sortedUnique7 = (values) => [...new Set(values)].sort(compareStrings7);
var bandRank = { direct: 0, governing: 1, consequence: 2, possible: 3 };
function analyzeIntent(input) {
  const value = {
    request: input.request.normalize("NFKC").trim(),
    what: sortedUnique7(input.outcomes.map((item) => item.normalize("NFKC").trim()).filter(Boolean)),
    why: sortedUnique7(input.constraints.map((item) => item.normalize("NFKC").trim()).filter(Boolean)),
    nonGoals: sortedUnique7(input.nonGoals.map((item) => item.normalize("NFKC").trim()).filter(Boolean)),
    solutionProposals: sortedUnique7(input.implementationProposals.map((item) => item.normalize("NFKC").trim()).filter(Boolean))
  };
  const behavioralMeaning = [...value.what, ...value.why, ...value.nonGoals.map((item) => `not: ${item}`)].join("; ");
  return { ...value, behavioralMeaning, contentHash: hashFramedDomain("intent-analysis", { ...value, behavioralMeaning }) };
}
async function scoutRelevance(input, port) {
  const raw = await port.inspect({ request: input.request, namedTargets: sortedUnique7(input.namedTargets) });
  const seeds = normalizeSeeds(raw.seeds);
  const value = {
    seeds,
    discoveredIds: sortedUnique7(raw.discoveredIds),
    questions: sortedUnique7(raw.questions),
    unavailableLanes: sortedUnique7(raw.unavailableLanes)
  };
  return { ...value, contentHash: hashFramedDomain("relevance-scout", value) };
}
function normalizeSeeds(seeds) {
  const unique5 = /* @__PURE__ */ new Map();
  for (const seed of seeds) {
    if (seed.confidence < 0 || seed.confidence > 1 || !Number.isFinite(seed.confidence))
      throw new Error("seed confidence must be within 0..1");
    const normalized = structuredClone(seed);
    unique5.set(canonicalJson(normalized), normalized);
  }
  return [...unique5.entries()].sort(([left], [right]) => compareStrings7(left, right)).map(([, value]) => value);
}
function validatePolicy(policy) {
  if (!Number.isInteger(policy.maxEntries) || policy.maxEntries < 1)
    throw new Error("Relevance maxEntries must be a positive integer");
  if (!Number.isInteger(policy.maxDepth) || policy.maxDepth < 0)
    throw new Error("Relevance maxDepth must be a non-negative integer");
  if (![policy.maxCost, policy.minimumScore].every(Number.isFinite) || policy.maxCost < 0 || policy.minimumScore < 0 || policy.minimumScore > 1) {
    throw new Error("Relevance cost and score bounds are invalid");
  }
}
function normalizeReason(reason) {
  if (![reason.weight, reason.confidence].every(Number.isFinite) || reason.confidence < 0 || reason.confidence > 1) {
    throw new Error("Relevance reason confidence and weight must be finite and confidence must be within 0..1");
  }
  return { ...structuredClone(reason), evidenceIds: sortedUnique7(reason.evidenceIds) };
}
function entryOrder(left, right) {
  return bandRank[left.band] - bandRank[right.band] || right.score - left.score || compareStrings7(left.entityId, right.entityId);
}
function chooseBand(left, right) {
  return bandRank[left] <= bandRank[right] ? left : right;
}
function addEntry(entries, candidate) {
  const existing = entries.get(candidate.entityId);
  if (existing === void 0) {
    entries.set(candidate.entityId, candidate);
    return true;
  }
  const reasons = new Map([...existing.reasons, ...candidate.reasons].map((reason) => [canonicalJson(reason), reason]));
  entries.set(candidate.entityId, {
    entityId: candidate.entityId,
    band: chooseBand(existing.band, candidate.band),
    score: Math.max(existing.score, candidate.score),
    requiredForPlanning: existing.requiredForPlanning || candidate.requiredForPlanning,
    reasons: [...reasons.entries()].sort(([left], [right]) => compareStrings7(left, right)).map(([, value]) => value)
  });
  return false;
}
function openWorldUnknown(dependency) {
  const { observability, resultCount } = dependency.priorResult;
  if (observability !== "open" && observability !== "sampled")
    return void 0;
  return resultCount === 0 ? `${dependency.query.id} returned empty under ${observability} observability and cannot prove absence or completeness` : `${dependency.query.id} used ${observability} observability and cannot prove the consumer enumeration complete or exclude additional results`;
}
function normalizeDiscoveryEdges(edges) {
  const groups = /* @__PURE__ */ new Map();
  for (const edge of edges) {
    if (!Number.isFinite(edge.score) || edge.score < 0 || edge.score > 1 || !Number.isFinite(edge.cost) || edge.cost < 0) {
      throw new Error(`invalid Relevance edge ${edge.entityId}`);
    }
    if (edge.entityId.trim().length === 0)
      throw new Error("Relevance edge entity identity cannot be blank");
    groups.set(edge.entityId, [...groups.get(edge.entityId) ?? [], edge]);
  }
  const normalized = [...groups.entries()].map(([entityId, rows]) => ({
    entityId,
    band: rows.map(({ band }) => band).reduce((left, right) => bandRank[left] <= bandRank[right] ? left : right),
    score: Math.max(...rows.map(({ score }) => score)),
    requiredForPlanning: rows.some(({ requiredForPlanning }) => requiredForPlanning),
    cost: Math.min(...rows.map(({ cost }) => cost)),
    reasons: [...new Map(rows.map(({ reason }) => normalizeReason(reason)).map((reason) => [canonicalJson(reason), reason])).entries()].sort(([left], [right]) => compareStrings7(left, right)).map(([, reason]) => reason)
  })).sort((left, right) => bandRank[left.band] - bandRank[right.band] || right.score - left.score || compareStrings7(left.entityId, right.entityId));
  return { edges: normalized, duplicateCount: edges.length - normalized.length };
}
async function compileRelevanceClosure(input) {
  validatePolicy(input.policy);
  if (canonicalJson(input.identityResolution.boundState.compiledAgainst) !== canonicalJson(input.compiledAgainst)) {
    throw new Error("semantic identity evidence is stale: it was compiled against a different state snapshot");
  }
  if (canonicalJson(input.context.stateDigest) !== canonicalJson(input.compiledAgainst)) {
    throw new Error("relevance discovery context snapshot differs from compiledAgainst state");
  }
  const seeds = normalizeSeeds(input.seeds);
  const entries = /* @__PURE__ */ new Map();
  const queue = [];
  for (const seed of seeds) {
    if (seed.subjectId === void 0)
      continue;
    const entityId = String(seed.subjectId);
    addEntry(entries, {
      entityId,
      band: "direct",
      score: seed.confidence,
      requiredForPlanning: true,
      reasons: [{
        kind: "explicit",
        fromId: entityId,
        weight: 1,
        provenance: "declared",
        confidence: seed.confidence,
        explanation: seed.reason,
        evidenceIds: []
      }]
    });
    queue.push({ entityId, depth: 0 });
  }
  for (const entityId of sortedUnique7(input.identityResolution.selectedEntityIds)) {
    const created = addEntry(entries, {
      entityId,
      band: "direct",
      score: input.identityResolution.confidence,
      requiredForPlanning: true,
      reasons: [{
        kind: "identity-match",
        fromId: input.identityResolution.id,
        weight: 1,
        provenance: "derived",
        confidence: input.identityResolution.confidence,
        explanation: `selected by semantic identity resolution ${input.identityResolution.id}`,
        evidenceIds: input.identityResolution.evidence.map(({ evidenceId }) => evidenceId)
      }]
    });
    if (created)
      queue.push({ entityId, depth: 0 });
  }
  queue.sort((left, right) => left.depth - right.depth || compareStrings7(left.entityId, right.entityId));
  const expanded = /* @__PURE__ */ new Set();
  const queryDependencies = [...input.identityResolution.boundState.queryDependencies];
  const frontier = /* @__PURE__ */ new Set();
  const unknowns = new Set(input.identityResolution.unknowns);
  const unavailableLanes = /* @__PURE__ */ new Set();
  let consideredEdgeCount = 0;
  let includedEdgeCount = 0;
  let duplicateEdgeCount = 0;
  let belowThresholdEdgeCount = 0;
  let budgetDeferredEdgeCount = 0;
  let cost = 0;
  while (queue.length > 0) {
    const current = queue.shift();
    if (expanded.has(current.entityId))
      continue;
    if (current.depth > input.policy.maxDepth) {
      frontier.add(current.entityId);
      unknowns.add(`depth bound stopped expansion at ${current.entityId}`);
      continue;
    }
    expanded.add(current.entityId);
    const result = await input.discovery.discover(current.entityId, current.depth, input.context);
    queryDependencies.push(structuredClone(result.dependency));
    const negativeSpace = openWorldUnknown(result.dependency);
    if (negativeSpace !== void 0)
      unknowns.add(negativeSpace);
    for (const lane of result.dependency.priorResult.unavailableLanes)
      unavailableLanes.add(lane);
    if (result.dependency.priorResult.observability === "unavailable") {
      unavailableLanes.add(result.dependency.query.id);
      unknowns.add(`required discovery lane ${result.dependency.query.id} is unavailable`);
    }
    const normalized = normalizeDiscoveryEdges(result.edges);
    const edges = normalized.edges;
    consideredEdgeCount += result.edges.length;
    duplicateEdgeCount += normalized.duplicateCount;
    for (const edge of edges) {
      if (edge.score < input.policy.minimumScore && !edge.requiredForPlanning) {
        belowThresholdEdgeCount += 1;
        if (!entries.has(edge.entityId))
          frontier.add(edge.entityId);
        continue;
      }
      const isNew = !entries.has(edge.entityId);
      if (isNew && (entries.size >= input.policy.maxEntries || cost + edge.cost > input.policy.maxCost)) {
        budgetDeferredEdgeCount += 1;
        frontier.add(edge.entityId);
        unknowns.add(`Relevance budget bound stopped expansion before ${edge.entityId}`);
        continue;
      }
      if (isNew) {
        cost += edge.cost;
        includedEdgeCount += 1;
      }
      const added = addEntry(entries, {
        entityId: edge.entityId,
        band: edge.band,
        score: edge.score,
        requiredForPlanning: edge.requiredForPlanning,
        reasons: edge.reasons
      });
      if (added) {
        frontier.delete(edge.entityId);
        queue.push({ entityId: edge.entityId, depth: current.depth + 1 });
        queue.sort((left, right) => left.depth - right.depth || compareStrings7(left.entityId, right.entityId));
      }
    }
  }
  const valueDependencies = [...input.valueDependencies, ...input.identityResolution.boundState.valueDependencies];
  const boundState = createStateBinding({ compiledAgainst: input.compiledAgainst, valueDependencies, queryDependencies });
  const closureBasis = {
    requestHash: hashFramedDomain("relevance-request", input.request.normalize("NFKC").trim()),
    seeds,
    entries: [...entries.values()].sort(entryOrder),
    activatedFacetKeys: sortedUnique7(input.activatedFacetKeys),
    unknowns: sortedUnique7([...unknowns]),
    unavailableLanes: sortedUnique7([...unavailableLanes]),
    boundState
  };
  const contentHash = hashFramedDomain("relevance-closure", closureBasis);
  const closure = { id: `relevance_closure_${contentHash.slice(-32)}`, ...closureBasis, contentHash };
  const uniqueConsidered = consideredEdgeCount - duplicateEdgeCount;
  const finalFrontier = sortedUnique7([...frontier].filter((entityId) => !entries.has(entityId)));
  return {
    closure,
    frontier: finalFrontier,
    metrics: {
      consideredEdgeCount,
      includedEdgeCount,
      duplicateEdgeCount,
      belowThresholdEdgeCount,
      budgetDeferredEdgeCount,
      frontierCount: finalFrontier.length,
      irrelevantExpansionRate: uniqueConsidered === 0 ? 0 : belowThresholdEdgeCount / uniqueConsidered,
      closureSize: closure.entries.length
    }
  };
}
function classify(unexpected) {
  if (unexpected.some(({ legitimacy }) => legitimacy === "unexplained"))
    return "agent-overreach";
  if (unexpected.some(({ legitimacy, proposedRelation, evidence }) => legitimacy === "required" && proposedRelation !== void 0 && evidence.length > 0)) {
    return "legitimate-new-relationship";
  }
  if (unexpected.some(({ legitimacy }) => legitimacy === "analysis-deficiency"))
    return "missing-predicted-impact";
  if (unexpected.some(({ legitimacy }) => legitimacy === "required"))
    return "legitimate-scope-expansion";
  return "incidental-change";
}
function classifyPlanningSurprise(input) {
  const predictedEntityIds = sortedUnique7(input.predictedEntityIds);
  const predicted = new Set(predictedEntityIds);
  const observed = [...input.observed].map((item) => ({ ...structuredClone(item), evidence: [...item.evidence].sort((left, right) => compareStrings7(canonicalJson(left), canonicalJson(right))) })).sort((left, right) => compareStrings7(left.entityId, right.entityId) || compareStrings7(canonicalJson(left), canonicalJson(right)));
  const observedEntityIds = sortedUnique7(observed.map(({ entityId }) => entityId));
  const unexpected = observed.filter(({ entityId }) => !predicted.has(entityId));
  const unexpectedEntityIds = sortedUnique7(unexpected.map(({ entityId }) => entityId));
  if (unexpected.length === 0)
    return void 0;
  for (const item of unexpected) {
    if (item.proposedRelation === void 0)
      continue;
    const { fromId, toId } = item.proposedRelation;
    const otherId = fromId === item.entityId ? toId : fromId;
    if (fromId.trim().length === 0 || toId.trim().length === 0 || fromId !== item.entityId && toId !== item.entityId || !predicted.has(otherId) && !observedEntityIds.includes(otherId)) {
      throw new Error(`relationship proposal endpoints must be nonblank and include unexpected entity ${item.entityId}`);
    }
    if (!item.evidence.some(({ evidenceId, stance }) => evidenceId.trim().length > 0 && stance === "supports")) {
      throw new Error(`relationship proposal for ${item.entityId} requires supporting evidence`);
    }
  }
  const classification = classify(unexpected);
  const impactClassifications = unexpected.map((item) => ({ entityId: item.entityId, classification: classify([item]) }));
  const overreachIds = new Set(impactClassifications.filter(({ classification: itemClassification }) => itemClassification === "agent-overreach").map(({ entityId }) => entityId));
  const proposals = unexpected.flatMap(({ legitimacy, proposedRelation, evidence: evidence2 }) => {
    if (legitimacy !== "required")
      return [];
    if (proposedRelation === void 0 || evidence2.length === 0)
      return [];
    if (overreachIds.has(proposedRelation.fromId) || overreachIds.has(proposedRelation.toId))
      return [];
    const basis = { ...proposedRelation, evidence: evidence2 };
    const contentHash2 = hashFramedDomain("relationship-proposal", basis);
    return [{
      id: `relationship_proposal_${contentHash2.slice(-32)}`,
      status: "proposed",
      canonical: false,
      sourceClass: "inferred",
      ...proposedRelation,
      evidence: [...evidence2],
      contentHash: contentHash2
    }];
  }).sort((left, right) => compareStrings7(left.id, right.id));
  const kind = classification === "agent-overreach" ? "agent-overreach" : classification === "legitimate-scope-expansion" ? "scope-expansion" : classification === "legitimate-new-relationship" ? "missing-relation" : classification === "incidental-change" ? "benign-discovery" : unexpected.some(({ impact }) => impact === "semantic") ? "unpredicted-semantic-impact" : "unpredicted-code-impact";
  const disposition = classification === "agent-overreach" ? "revert-overreach" : classification === "legitimate-scope-expansion" || classification === "missing-predicted-impact" ? "repair-plan" : classification === "legitimate-new-relationship" ? "accept-and-learn" : "accept-no-model-change";
  const evidence = new Map(unexpected.flatMap((item) => item.evidence).map((item) => [canonicalJson(item), item]));
  const semantic = {
    planId: input.planId,
    kind,
    predictedEntityIds,
    observedEntityIds,
    unexpectedEntityIds,
    evidence: [...evidence.entries()].sort(([left], [right]) => compareStrings7(left, right)).map(([, item]) => item),
    explanation: `${classification}: ${unexpectedEntityIds.join(", ") || "no unexpected semantic entity"}`,
    disposition,
    proposedRelationIds: proposals.map(({ id }) => id)
  };
  const contentHash = hashFramedDomain("planning-surprise", semantic);
  return {
    classification,
    impactClassifications,
    surprise: { id: `planning_surprise_${contentHash.slice(-32)}`, ...semantic, contentHash },
    proposals
  };
}

// node_modules/@projector/engine/dist/context/index.js
var compareStrings8 = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var sortedUnique8 = (values) => [...new Set(values)].sort(compareStrings8);
function activateAnalysisFacets(facets, subject) {
  const byKey = /* @__PURE__ */ new Map();
  for (const facet of facets) {
    const existing = byKey.get(facet.key);
    if (existing !== void 0 && canonicalJson(existing) !== canonicalJson(facet)) {
      throw new Error(`conflicting Analysis Facet ${facet.key}`);
    }
    byKey.set(facet.key, structuredClone(facet));
  }
  const active = [...byKey.values()].filter((facet) => evaluateSelector(facet.selector, subject).matched).sort((left, right) => compareStrings8(left.key, right.key));
  const value = {
    facetKeys: active.map(({ key }) => key),
    questionKeys: sortedUnique8(active.flatMap(({ questionKeys }) => questionKeys)),
    relevanceRuleIds: sortedUnique8(active.flatMap(({ relevanceRuleIds }) => relevanceRuleIds)),
    requiredEvidenceLanes: sortedUnique8(active.flatMap(({ requiredEvidenceLanes }) => requiredEvidenceLanes)),
    outputKinds: sortedUnique8(active.flatMap(({ outputKinds }) => outputKinds)),
    dependencyKeys: sortedUnique8([
      ...subject.dependencyKeys,
      ...active.map(({ key, version }) => `analysis-facet:${key}@${version}`)
    ])
  };
  return { ...value, contentHash: hashFramedDomain("activated-analysis-facets", value) };
}
var bandRank2 = { direct: 0, governing: 1, consequence: 2, possible: 3 };
function disclosure(band) {
  return band === "direct" || band === "governing" ? "full" : band === "consequence" ? "summary" : "identity";
}
async function compileContext(closure, sources, policy) {
  if (!Number.isFinite(policy.maxCost) || policy.maxCost < 0)
    throw new Error("context maxCost must be a non-negative finite number");
  const entries = [...closure.entries].sort((left, right) => bandRank2[left.band] - bandRank2[right.band] || right.score - left.score || compareStrings8(left.entityId, right.entityId));
  const items = [];
  const unknowns = [...closure.unknowns];
  let estimatedCost = 0;
  const requiredExpansionIds = [];
  for (const entry of entries) {
    const source = await sources.load(entry.entityId);
    if (source === void 0) {
      unknowns.push(`context source ${entry.entityId} is unavailable`);
      continue;
    }
    if (source.entityId !== entry.entityId)
      throw new Error(`context source identity fork for ${entry.entityId}`);
    const mode = disclosure(entry.band);
    const content = mode === "full" ? source.full : mode === "summary" ? source.summary : source.entityId;
    const cost = content.length;
    if (estimatedCost + cost > policy.maxCost && !entry.requiredForPlanning) {
      unknowns.push(`context budget retained ${entry.entityId} on the frontier`);
      continue;
    }
    if (estimatedCost + cost > policy.maxCost && entry.requiredForPlanning) {
      requiredExpansionIds.push(entry.entityId);
      unknowns.push(`required semantic context ${entry.entityId} exceeds the context budget`);
    }
    const normalizedReasons = [...entry.reasons].sort((left, right) => compareStrings8(canonicalJson(left), canonicalJson(right)));
    items.push({
      entityId: source.entityId,
      sourceSemanticHash: source.semanticHash,
      kind: source.kind,
      band: entry.band,
      disclosure: mode,
      content,
      relevanceScore: entry.score,
      relevanceReasons: sortedUnique8(normalizedReasons.map(({ explanation }) => explanation).filter(Boolean)),
      uncertainty: entry.band === "possible" ? sortedUnique8(normalizedReasons.map(({ provenance, kind, confidence }) => `${provenance} ${kind} at confidence ${confidence}`)) : [],
      confidence: entry.score
    });
    estimatedCost += cost;
  }
  const value = {
    sourceClosureId: closure.id,
    items,
    unknowns: sortedUnique8(unknowns),
    estimatedCost,
    requiredBudgetOverrun: Math.max(0, estimatedCost - policy.maxCost),
    requiredExpansionIds: sortedUnique8(requiredExpansionIds)
  };
  return { ...value, contentHash: hashFramedDomain("compiled-semantic-context", value) };
}

// node_modules/@projector/engine/dist/representation/index.js
var compare2 = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var unique3 = (values) => [...new Set(values)].sort(compare2);
function deepFreeze2(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value))
      deepFreeze2(child);
    Object.freeze(value);
  }
  return value;
}
var ALL_DIMENSIONS = [
  "normative-force",
  "negation",
  "scope",
  "quantifier-cardinality",
  "logical-connective",
  "condition-guard",
  "exception",
  "dependency-order",
  "behavior-step-role",
  "concept-identity",
  "identifier-literal"
];
function profile(key, target, optimization, status = "active") {
  const value = {
    id: `profile:${key.slice(0, key.lastIndexOf("@"))}`,
    key: key.slice(0, key.lastIndexOf("@")),
    version: key.slice(key.lastIndexOf("@") + 1),
    status,
    target,
    selector: { op: "all", items: [] },
    optimization,
    protectedDimensions: ALL_DIMENSIONS,
    styleRules: [{ key: "literal-preservation", kind: "literal-preservation", parameters: {}, blocking: true }],
    generatorId: `${key}:generator`,
    validatorIds: [`${key}:fidelity`],
    ...target === "agent-context" ? { tokenizerProfileId: "injected", fallbackProfileId: "profile:human-technical" } : {}
  };
  return { ...value, semanticHash: hashFramedDomain("semantic-representation-profile", value) };
}
var BUILT_IN_REPRESENTATION_PROFILES = Object.freeze({
  "human-technical@1": profile("human-technical@1", "human-technical", "clarity-first"),
  "behavior-gherkin@1": profile("behavior-gherkin@1", "behavior-spec", "clarity-first"),
  "agent-compact@1": profile("agent-compact@1", "agent-context", "token-first"),
  "agent-compact@2": profile("agent-compact@2", "agent-context", "token-first"),
  "machine-invariant@1": profile("machine-invariant@1", "machine-invariant", "machine-first")
});
var CURRENT_BUILT_IN_REPRESENTATION_PROFILE_KEYS = /* @__PURE__ */ new Set([
  "human-technical@1",
  "behavior-gherkin@1",
  "agent-compact@2",
  "machine-invariant@1"
]);
function currentBuiltInRepresentationProfile(profileId) {
  const current = Object.entries(BUILT_IN_REPRESENTATION_PROFILES).filter(([key, value]) => CURRENT_BUILT_IN_REPRESENTATION_PROFILE_KEYS.has(key) && value.id === profileId).map(([, value]) => value);
  if (current.length > 1)
    throw new TypeError(`built-in representation profile has multiple current versions: ${profileId}`);
  return current[0];
}
function isAgentCompactProfileKey(key) {
  return key === "agent-compact@1" || key === "agent-compact@2";
}
function lintHumanTechnical(content) {
  const count = (pattern) => [...content.matchAll(pattern)].length;
  const rules = [
    ["contraction", /\b(?:we|you|they|it|that|there|who)'(?:ll|re|ve|d|s)|\b(?:do|does|did|is|are|was|were|can|could|should|would|must)n't\b/giu],
    ["marketing-language", /\b(?:amazing|revolutionary|best-in-class|world-class)\b/giu],
    ["modal-filler", /\b(?:obviously|simply|clearly|very clear)\b/giu],
    ["semicolon", /;/gu],
    ["verbose-wording", /\b(?:utilize|in order to|due to the fact that)\b/giu]
  ];
  const blocking = rules.map(([rule, pattern]) => ({ rule, count: count(pattern) })).filter(({ count: occurrences }) => occurrences > 0);
  const longSentences = content.split(/[.!?]+/u).filter((sentence) => sentence.trim().split(/\s+/u).filter(Boolean).length > 25).length;
  return {
    blocking,
    advisory: longSentences === 0 ? [] : [{ rule: "sentence-length", count: longSentences }],
    wordCount: content.trim() === "" ? 0 : content.trim().split(/\s+/u).length,
    semanticEquivalenceEstablished: false,
    truthEstablished: false
  };
}
function normalizedSource(source) {
  const statementIds = new Set(source.statements.map(({ id }) => id));
  const crossKindCollision = source.scenarios.find(({ id }) => statementIds.has(id));
  if (crossKindCollision !== void 0) {
    throw new TypeError(`cross-kind canonical source identity collision: ${crossKindCollision.id}`);
  }
  if (new Set(source.sourceEntityIds).size !== source.sourceEntityIds.length) {
    throw new TypeError("duplicate source membership is not permitted");
  }
  const statementById = /* @__PURE__ */ new Map();
  for (const statement of source.statements) {
    const prior = statementById.get(statement.id);
    if (prior !== void 0 && canonicalJson(prior) !== canonicalJson(statement)) {
      throw new TypeError(`conflicting canonical representation source statement: ${statement.id}`);
    }
    statementById.set(statement.id, statement);
  }
  const scenarioById = /* @__PURE__ */ new Map();
  for (const scenario of source.scenarios) {
    const prior = scenarioById.get(scenario.id);
    if (prior !== void 0 && canonicalJson(prior) !== canonicalJson(scenario)) {
      throw new TypeError(`conflicting canonical representation source scenario: ${scenario.id}`);
    }
    scenarioById.set(scenario.id, scenario);
  }
  const statements = [...statementById.values()].map((statement) => ({
    ...structuredClone(statement),
    scope: unique3(statement.scope),
    exceptions: unique3(statement.exceptions),
    conceptIds: unique3(statement.conceptIds),
    protectedLiterals: unique3(statement.protectedLiterals)
  })).sort((a, b) => compare2(a.id, b.id));
  const scenarios = [...scenarioById.values()].map((scenario) => structuredClone(scenario)).sort((a, b) => compare2(a.id, b.id));
  const derivedIds = unique3([...statements.map(({ id }) => id), ...scenarios.map(({ id }) => id)]);
  const suppliedIds = [...source.sourceEntityIds].sort(compare2);
  if (canonicalJson(derivedIds) !== canonicalJson(suppliedIds)) {
    throw new TypeError("source membership must exactly match canonical statements and scenarios");
  }
  const sourceSemanticHash = hashFramedDomain("canonical-representation-source", {
    sourceEntityIds: derivedIds,
    statements,
    scenarios
  });
  if (source.sourceSemanticHash !== sourceSemanticHash) {
    throw new TypeError("source semantic hash does not authenticate canonical structured input");
  }
  return {
    sourceEntityIds: derivedIds,
    sourceSemanticHash,
    statements,
    scenarios
  };
}
function entitySemanticHash(source, id) {
  const entity = source.statements.find((item) => item.id === id) ?? source.scenarios.find((item) => item.id === id);
  if (entity === void 0)
    throw new TypeError(`canonical source member is missing: ${id}`);
  return hashFramedDomain("canonical-representation-entity", entity);
}
function typedSourceMembers(source) {
  return [
    ...source.statements.map(({ id }) => ({ kind: "statement", id, semanticHash: entitySemanticHash(source, id) })),
    ...source.scenarios.map(({ id }) => ({ kind: "scenario", id, semanticHash: entitySemanticHash(source, id) }))
  ].sort((left, right) => compare2(`${left.kind}:${left.id}`, `${right.kind}:${right.id}`));
}
function dimensionValue(source, dimension) {
  switch (dimension) {
    case "normative-force":
      return source.statements.map(({ id, normativeForce }) => ({ id, normativeForce }));
    case "negation":
      return source.statements.map(({ id, negated }) => ({ id, negated }));
    case "scope":
      return source.statements.map(({ id, scope }) => ({ id, scope }));
    case "quantifier-cardinality":
      return source.statements.map(({ id, cardinality }) => ({ id, cardinality: cardinality ?? null }));
    case "logical-connective":
      return source.statements.map(({ id, connective }) => ({ id, connective: connective ?? null }));
    case "condition-guard":
      return source.statements.map(({ id, guard }) => ({ id, guard: guard ?? null }));
    case "exception":
      return source.statements.map(({ id, exceptions }) => ({ id, exceptions }));
    case "dependency-order":
      return source.statements.map(({ id, dependencies }) => ({ id, dependencies }));
    case "behavior-step-role":
      return source.scenarios.map(({ id, steps }) => ({ id, steps }));
    case "concept-identity":
      return source.statements.map(({ id, conceptIds }) => ({ id, conceptIds }));
    case "identifier-literal":
      return source.statements.map(({ id, protectedLiterals }) => ({ id, protectedLiterals }));
  }
}
function fingerprint(source, selected) {
  const dimensionHashes = Object.fromEntries(ALL_DIMENSIONS.map((dimension) => [
    dimension,
    hashFramedDomain(`representation-dimension:${dimension}`, dimensionValue(source, dimension))
  ]));
  const dimensionAssurance = Object.fromEntries(ALL_DIMENSIONS.map((dimension) => [dimension, "exact"]));
  const base = {
    sourceSemanticHash: source.sourceSemanticHash,
    profileId: selected.id,
    profileVersion: selected.version,
    protectedDimensions: ALL_DIMENSIONS,
    dimensionHashes,
    dimensionAssurance,
    unsupportedDimensions: [],
    assurance: "exact",
    evidenceIds: []
  };
  return { ...base, semanticHash: hashFramedDomain("semantic-preservation-fingerprint", base) };
}
function kernel(statement) {
  return {
    id: statement.id,
    force: statement.normativeForce,
    negated: statement.negated,
    scope: statement.scope,
    cardinality: statement.cardinality ?? null,
    connective: statement.connective ?? null,
    guard: statement.guard ?? null,
    exceptions: statement.exceptions,
    dependencyOrder: statement.dependencies,
    concepts: statement.conceptIds,
    literals: statement.protectedLiterals
  };
}
function render(source, key) {
  if (key === "machine-invariant@1") {
    return canonicalJson({ apiVersion: "projector.dev/representation/v1", kind: "MachineInvariant", sourceIds: source.sourceEntityIds, statements: source.statements.map(kernel), scenarios: source.scenarios });
  }
  if (key === "behavior-gherkin@1") {
    const scenarios = source.scenarios.map((scenario) => {
      const keywords = { precondition: "Given", trigger: "When", "expected-outcome": "Then", "forbidden-outcome": "But" };
      return [`# source: ${scenario.id}`, `Scenario: ${scenario.title}`, ...scenario.steps.map((step) => `  ${keywords[step.role]} ${step.statement}`)].join("\n");
    }).join("\n\n");
    return `${scenarios}

# invariant-kernel: ${canonicalJson(source.statements.map(kernel))}`;
  }
  if (isAgentCompactProfileKey(key)) {
    const statements = source.statements.map((statement) => [
      `${statement.normativeForce === "forbid" ? "FORBID" : statement.normativeForce.toUpperCase()}${statement.negated ? " NOT" : ""} ${statement.id}`,
      statement.cardinality?.toUpperCase(),
      statement.connective?.toUpperCase(),
      statement.guard ? `IF ${statement.guard}` : void 0,
      statement.exceptions.length ? `EXCEPT ${statement.exceptions.join(", ")}` : void 0,
      statement.dependencies.length ? `ORDER ${statement.dependencies.join(" > ")}` : void 0,
      statement.scope.length ? `SCOPE ${statement.scope.join(", ")}` : void 0,
      statement.conceptIds.length ? `CONCEPTS ${statement.conceptIds.join(", ")}` : void 0,
      ...statement.protectedLiterals
    ].filter(Boolean).join(" | ")).join("\n");
    const scenarios = source.scenarios.map((scenario) => `SCENARIO ${scenario.id} | TITLE ${JSON.stringify(scenario.title)} | ${scenario.steps.map((step) => `${step.role.toUpperCase()}: ${step.statement}`).join(" | ")}`).join("\n");
    return [statements, scenarios].filter(Boolean).join("\n");
  }
  return `${source.statements.map((statement) => `Advisory text: ${JSON.stringify(statement.text)}
Semantic kernel: ${canonicalJson(kernel(statement))}`).join("\n\n")}

Behavioral scenarios: ${canonicalJson(source.scenarios)}`;
}
function renderLessAggressiveCompact(source) {
  return [
    ...source.statements.map((statement) => `STATEMENT ${canonicalJson(kernel(statement))}`),
    ...source.scenarios.map((scenario) => `SCENARIO-KERNEL ${canonicalJson(scenario)}`)
  ].join("\n");
}
function validation(status, summary, details = {}) {
  return {
    validatorId: "representation-fidelity@1",
    status,
    summary,
    evidenceIds: [],
    evidenceLane: "representation",
    independenceGroup: "deterministic-representation-validator@1",
    assurance: status === "passed" ? "exact" : "strong",
    authorSource: "projector-engine",
    sideEffectClass: "none",
    details,
    startedAt: "1970-01-01T00:00:00.000Z",
    completedAt: "1970-01-01T00:00:00.000Z"
  };
}
var RepresentationFidelityError = class extends Error {
  dimension;
  constructor(dimension, message) {
    super(message);
    this.dimension = dimension;
    this.name = "RepresentationFidelityError";
  }
};
function parseKernelStatement(value) {
  if (value === null || typeof value !== "object")
    throw new TypeError("statement kernel is not an object");
  const item = value;
  const expectedKeys = ["cardinality", "concepts", "connective", "dependencyOrder", "exceptions", "force", "guard", "id", "literals", "negated", "scope"];
  if (canonicalJson(Object.keys(item).sort(compare2)) !== canonicalJson(expectedKeys))
    throw new TypeError("statement kernel has unknown or missing keys");
  const strings2 = (key) => {
    if (!Array.isArray(item[key]) || !item[key].every((entry) => typeof entry === "string"))
      throw new TypeError(`${key} is not a string list`);
    return item[key];
  };
  if (typeof item.id !== "string" || !["require", "forbid", "prefer", "permit"].includes(String(item.force)) || typeof item.negated !== "boolean")
    throw new TypeError("statement identity, force, or negation is invalid");
  const cardinality = item.cardinality;
  const connective = item.connective;
  const guard = item.guard;
  if (cardinality !== null && !["exactly-one", "one-or-more", "at-most-one", "all", "none"].includes(String(cardinality)))
    throw new TypeError("cardinality is invalid");
  if (connective !== null && !["and", "or", "implies", "iff"].includes(String(connective)))
    throw new TypeError("connective is invalid");
  if (guard !== null && typeof guard !== "string")
    throw new TypeError("guard is invalid");
  return {
    id: item.id,
    text: "",
    normativeForce: item.force,
    negated: item.negated,
    scope: strings2("scope"),
    ...cardinality === null ? {} : { cardinality },
    ...connective === null ? {} : { connective },
    ...guard === null ? {} : { guard },
    exceptions: strings2("exceptions"),
    dependencies: strings2("dependencyOrder"),
    conceptIds: strings2("concepts"),
    protectedLiterals: strings2("literals")
  };
}
function parseScenarios(value) {
  if (!Array.isArray(value))
    throw new TypeError("scenarios are not an array");
  return value.map((entry) => {
    if (entry === null || typeof entry !== "object")
      throw new TypeError("scenario is not an object");
    const scenario = entry;
    if (canonicalJson(Object.keys(scenario).sort(compare2)) !== canonicalJson(["id", "steps", "title"]))
      throw new TypeError("scenario has unknown or missing keys");
    if (typeof scenario.id !== "string" || typeof scenario.title !== "string" || !Array.isArray(scenario.steps))
      throw new TypeError("scenario structure is invalid");
    const steps = scenario.steps.map((step) => {
      if (step === null || typeof step !== "object")
        throw new TypeError("scenario step is invalid");
      const item = step;
      if (canonicalJson(Object.keys(item).sort(compare2)) !== canonicalJson(["role", "statement"]))
        throw new TypeError("scenario step has unknown or missing keys");
      if (!["precondition", "trigger", "expected-outcome", "forbidden-outcome"].includes(String(item.role)) || typeof item.statement !== "string") {
        throw new TypeError("scenario step role is invalid");
      }
      return { role: item.role, statement: item.statement };
    });
    return { id: scenario.id, title: scenario.title, steps };
  });
}
function assertNoDuplicateJsonKeys(source) {
  const stack = [];
  let index = 0;
  const whitespace = /\s/u;
  while (index < source.length) {
    const character = source[index];
    if (whitespace.test(character)) {
      index += 1;
      continue;
    }
    if (character === "{") {
      stack.push({ kind: "object", keys: /* @__PURE__ */ new Set(), expectsKey: true });
      index += 1;
      continue;
    }
    if (character === "[") {
      stack.push({ kind: "array" });
      index += 1;
      continue;
    }
    if (character === "}" || character === "]") {
      stack.pop();
      index += 1;
      continue;
    }
    if (character === ",") {
      const top2 = stack.at(-1);
      if (top2?.kind === "object")
        top2.expectsKey = true;
      index += 1;
      continue;
    }
    if (character !== '"') {
      index += 1;
      continue;
    }
    const start = index;
    index += 1;
    let escaped = false;
    while (index < source.length) {
      const current = source[index];
      index += 1;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (current === "\\") {
        escaped = true;
        continue;
      }
      if (current === '"')
        break;
    }
    const raw = source.slice(start, index);
    let lookahead = index;
    while (lookahead < source.length && whitespace.test(source[lookahead]))
      lookahead += 1;
    const top = stack.at(-1);
    if (top?.kind === "object" && top.expectsKey && source[lookahead] === ":") {
      const key = JSON.parse(raw);
      if (top.keys.has(key))
        throw new TypeError(`duplicate JSON key: ${key}`);
      top.keys.add(key);
      top.expectsKey = false;
    }
  }
}
function parseStrictJson(source) {
  assertNoDuplicateJsonKeys(source);
  return JSON.parse(source);
}
function parseMachineCandidate(candidate) {
  const parsed = parseStrictJson(candidate);
  if (canonicalJson(Object.keys(parsed).sort(compare2)) !== canonicalJson(["apiVersion", "kind", "scenarios", "sourceIds", "statements"])) {
    throw new TypeError("machine invariant has unknown or missing schema keys");
  }
  if (parsed.apiVersion !== "projector.dev/representation/v1" || parsed.kind !== "MachineInvariant" || !Array.isArray(parsed.statements) || !Array.isArray(parsed.sourceIds) || !parsed.sourceIds.every((id) => typeof id === "string"))
    throw new TypeError("candidate is not a supported machine invariant kernel");
  const statements = parsed.statements.map(parseKernelStatement);
  const scenarios = parseScenarios(parsed.scenarios);
  const observedIds = unique3([...statements.map(({ id }) => id), ...scenarios.map(({ id }) => id)]);
  if (canonicalJson(observedIds) !== canonicalJson(unique3(parsed.sourceIds)))
    throw new TypeError("machine source membership does not match its structured kernel");
  return { statements, scenarios };
}
function parseHumanCandidate(candidate) {
  const scenarioMarker = "Behavioral scenarios:";
  const marker = candidate.lastIndexOf(scenarioMarker);
  if (marker < 0)
    throw new TypeError("human representation has no scenario kernel");
  const scenarios = parseScenarios(parseStrictJson(candidate.slice(marker + scenarioMarker.length).trim()));
  const statementPart = candidate.slice(0, marker).trim();
  const statements = statementPart.split(/\n\s*\n/gu).filter(Boolean).map((block) => {
    const match = /^Advisory text:\s*("(?:[^"\\]|\\.)*")\r?\nSemantic kernel:\s*(\{[^\n]*\})$/su.exec(block.trim());
    if (match === null)
      throw new TypeError("human statement block cannot be fully parsed");
    const parsed = parseKernelStatement(parseStrictJson(match[2]));
    const advisory = parseStrictJson(match[1]);
    if (typeof advisory !== "string")
      throw new TypeError("human advisory envelope must contain a JSON string");
    return { ...parsed, text: advisory };
  });
  if (statements.length === 0)
    throw new TypeError("human representation has no statement kernel");
  return { statements, scenarios };
}
function parseGherkinCandidate(candidate) {
  const marker = "# invariant-kernel:";
  const markerOffset = candidate.lastIndexOf(marker);
  if (markerOffset < 0)
    throw new TypeError("Gherkin representation has no invariant kernel");
  const statementsValue = parseStrictJson(candidate.slice(markerOffset + marker.length).trim());
  if (!Array.isArray(statementsValue))
    throw new TypeError("Gherkin invariant kernel is not an array");
  const scenarios = candidate.slice(0, markerOffset).trim().split(/\n\s*\n/gu).filter(Boolean).map((block) => {
    const lines = block.split(/\r?\n/gu).map((line) => line.trim()).filter(Boolean);
    const id = /^# source:\s*(.+)$/u.exec(lines[0] ?? "")?.[1];
    const title = /^Scenario:\s*(.+)$/u.exec(lines[1] ?? "")?.[1];
    if (id === void 0 || title === void 0)
      throw new TypeError("Gherkin scenario identity is invalid");
    const roles = { Given: "precondition", When: "trigger", Then: "expected-outcome", But: "forbidden-outcome" };
    const steps = lines.slice(2).map((line) => {
      const match = /^(Given|When|Then|But)\s+(.+)$/u.exec(line);
      if (match === null)
        throw new TypeError("Gherkin scenario step cannot be parsed");
      return { role: roles[match[1]], statement: match[2] };
    });
    return { id, title, steps };
  });
  return { statements: statementsValue.map(parseKernelStatement), scenarios };
}
function parseCompactCandidate(candidate) {
  if (candidate.split(/\r?\n/gu).some((line) => line.trim().startsWith("STATEMENT "))) {
    const statements2 = [];
    const scenarios2 = [];
    for (const line of candidate.split(/\r?\n/gu).map((item) => item.trim()).filter(Boolean)) {
      if (line.startsWith("STATEMENT "))
        statements2.push(parseKernelStatement(parseStrictJson(line.slice("STATEMENT ".length))));
      else if (line.startsWith("SCENARIO-KERNEL "))
        scenarios2.push(...parseScenarios([parseStrictJson(line.slice("SCENARIO-KERNEL ".length))]));
      else
        throw new TypeError("less-aggressive compact line cannot be parsed");
    }
    return { statements: statements2, scenarios: scenarios2 };
  }
  const statements = [];
  const scenarios = [];
  for (const line of candidate.split(/\r?\n/gu).map((item) => item.trim()).filter(Boolean)) {
    if (line.startsWith("SCENARIO ")) {
      const parts2 = line.split(/\s*\|\s*/gu);
      const id = parts2.shift().slice("SCENARIO ".length).trim();
      const titlePart = parts2.shift();
      const titleMatch = /^TITLE\s+("(?:[^"\\]|\\.)*")$/u.exec(titlePart ?? "");
      if (titleMatch === null)
        throw new TypeError("compact scenario title cannot be parsed");
      const title = parseStrictJson(titleMatch[1]);
      if (typeof title !== "string")
        throw new TypeError("compact scenario title must be a JSON string");
      const steps = parts2.map((part) => {
        const match = /^(PRECONDITION|TRIGGER|EXPECTED-OUTCOME|FORBIDDEN-OUTCOME):\s*(.+)$/u.exec(part);
        if (match === null)
          throw new TypeError("compact scenario step cannot be parsed");
        return { role: match[1].toLowerCase(), statement: match[2] };
      });
      scenarios.push({ id, title, steps });
      continue;
    }
    const parts = line.split(/\s*\|\s*/gu);
    const head = /^(REQUIRE|FORBID|PREFER|PERMIT)( NOT)?\s+(.+)$/u.exec(parts.shift() ?? "");
    if (head === null)
      throw new TypeError("compact statement head cannot be parsed");
    const fields = /* @__PURE__ */ new Map();
    const literals = [];
    for (const part of parts) {
      const field = /^(EXACTLY-ONE|ONE-OR-MORE|AT-MOST-ONE|ALL|NONE|AND|OR|IMPLIES|IFF)$/u.exec(part);
      if (field !== null) {
        const key = ["AND", "OR", "IMPLIES", "IFF"].includes(field[1]) ? "connective" : "cardinality";
        if (fields.has(key))
          throw new TypeError(`duplicate compact ${key}`);
        fields.set(key, field[1].toLowerCase());
      } else {
        const tagged = /^(IF|EXCEPT|ORDER|SCOPE|CONCEPTS)\s+(.+)$/u.exec(part);
        if (tagged === null)
          literals.push(part);
        else {
          if (fields.has(tagged[1]))
            throw new TypeError(`duplicate compact ${tagged[1]}`);
          fields.set(tagged[1], tagged[2]);
        }
      }
    }
    const list = (key, separator = /,\s*/gu) => fields.get(key)?.split(separator).filter(Boolean) ?? [];
    statements.push({
      id: head[3],
      text: "",
      normativeForce: head[1].toLowerCase(),
      negated: head[2] !== void 0,
      scope: list("SCOPE"),
      ...fields.has("cardinality") ? { cardinality: fields.get("cardinality") } : {},
      ...fields.has("connective") ? { connective: fields.get("connective") } : {},
      ...fields.has("IF") ? { guard: fields.get("IF") } : {},
      exceptions: list("EXCEPT"),
      dependencies: list("ORDER", /\s*>\s*/gu),
      conceptIds: list("CONCEPTS"),
      protectedLiterals: literals
    });
  }
  return { statements, scenarios };
}
function parseCandidate(candidate, profileKey) {
  try {
    candidate = candidate.trim().replaceAll("\r\n", "\n");
    if (profileKey === "machine-invariant@1")
      return parseMachineCandidate(candidate);
    if (profileKey === "behavior-gherkin@1")
      return parseGherkinCandidate(candidate);
    if (isAgentCompactProfileKey(profileKey))
      return parseCompactCandidate(candidate);
    return parseHumanCandidate(candidate);
  } catch (error) {
    throw new RepresentationFidelityError("normative-force", `candidate cannot be deterministically parsed or proved: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function protectedAdvisorySpans(text, declaredLiterals) {
  const spans = [];
  const addMatches = (pattern) => {
    for (const match of text.matchAll(pattern)) {
      if (match.index !== void 0 && match[0].length > 0)
        spans.push({ start: match.index, end: match.index + match[0].length });
    }
  };
  for (const literal of declaredLiterals) {
    if (literal.length === 0)
      continue;
    let offset = 0;
    while (offset <= text.length - literal.length) {
      const start = text.indexOf(literal, offset);
      if (start < 0)
        break;
      spans.push({ start, end: start + literal.length });
      offset = start + literal.length;
    }
  }
  addMatches(/`[^`\r\n]+`/gu);
  addMatches(/"(?:[^"\\\r\n]|\\.)*"|'(?:[^'\\\r\n]|\\.)*'/gu);
  addMatches(/“[^”\r\n]*”|‘[^’\r\n]*’/gu);
  addMatches(/\bhttps?:\/\/[^\s,;"'`()]+/gu);
  addMatches(/\b(?:[A-Za-z]:[\\/]|\.{0,2}[\\/]|[A-Za-z0-9_.-]+[\\/])[^\s,;:"'`()]+/gu);
  addMatches(/\b(?:[A-Za-z]+[A-Z][A-Za-z0-9]*|[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+|--?[a-z][a-z0-9-]*|[A-Za-z][A-Za-z0-9]*\.[A-Za-z][A-Za-z0-9.]*)\b/gu);
  addMatches(/\b\d+(?:\.\d+)?(?:[ \t]+)?(?:B|KB|MB|GB|TB|KiB|MiB|GiB|ms|s|min|h|Hz|kHz|MHz|GHz|%|px|rem|em)\b/giu);
  addMatches(/\b(?:Error|Exception):[^\r\n]+/gu);
  addMatches(/\b(?:EACCES|EEXIST|EINVAL|ENOENT|ENOTSUP|EPERM):[^\r\n]+/gu);
  const merged = [];
  for (const span of spans.sort((left, right) => left.start - right.start || right.end - left.end)) {
    const prior = merged.at(-1);
    if (prior === void 0 || span.start >= prior.end)
      merged.push(span);
    else if (span.end > prior.end)
      merged[merged.length - 1] = { start: prior.start, end: span.end };
  }
  return merged;
}
function normalizeCosmeticWhitespace(value, trimStart, trimEnd) {
  let normalized = value.replace(/\s+/gu, " ");
  if (trimStart)
    normalized = normalized.trimStart();
  if (trimEnd)
    normalized = normalized.trimEnd();
  return normalized;
}
function hasExactLiteralInventory(source, candidate, declaredLiterals) {
  const expected = /* @__PURE__ */ new Map();
  for (const span of protectedAdvisorySpans(source, declaredLiterals)) {
    const literal = source.slice(span.start, span.end);
    expected.set(literal, (expected.get(literal) ?? 0) + 1);
  }
  for (const [literal, expectedCount] of expected) {
    let observedCount = 0;
    let offset = 0;
    while (offset <= candidate.length - literal.length) {
      const matchOffset = candidate.indexOf(literal, offset);
      if (matchOffset < 0)
        break;
      observedCount += 1;
      offset = matchOffset + literal.length;
    }
    if (observedCount !== expectedCount)
      return false;
  }
  return true;
}
function advisoryMatchesWithExactLiterals(source, candidate, declaredLiterals) {
  const spans = protectedAdvisorySpans(source, declaredLiterals);
  if (spans.length === 0)
    return normalizeCosmeticWhitespace(source, true, true) === normalizeCosmeticWhitespace(candidate, true, true);
  let successfulMappings = 0;
  const search = (spanIndex, sourceOffset, candidateOffset) => {
    if (successfulMappings > 1)
      return;
    if (spanIndex === spans.length) {
      if (normalizeCosmeticWhitespace(source.slice(sourceOffset), false, true) === normalizeCosmeticWhitespace(candidate.slice(candidateOffset), false, true))
        successfulMappings += 1;
      return;
    }
    const span = spans[spanIndex];
    const literal = source.slice(span.start, span.end);
    const expectedProse = normalizeCosmeticWhitespace(source.slice(sourceOffset, span.start), spanIndex === 0, false);
    let matchOffset = candidate.indexOf(literal, candidateOffset);
    while (matchOffset >= 0) {
      const observedProse = normalizeCosmeticWhitespace(candidate.slice(candidateOffset, matchOffset), spanIndex === 0, false);
      if (observedProse === expectedProse)
        search(spanIndex + 1, span.end, matchOffset + literal.length);
      matchOffset = candidate.indexOf(literal, matchOffset + 1);
    }
  };
  search(0, 0, 0);
  return successfulMappings === 1;
}
function assertCandidate(source, candidate, profileKey, measuredAbbreviations = []) {
  const observed = parseCandidate(candidate, profileKey);
  const normalizedObserved = {
    statements: [...observed.statements].map((statement) => ({ ...statement, scope: unique3(statement.scope), exceptions: unique3(statement.exceptions), conceptIds: unique3(statement.conceptIds), protectedLiterals: unique3(statement.protectedLiterals) })).sort((a, b) => compare2(a.id, b.id)),
    scenarios: [...observed.scenarios].sort((a, b) => compare2(a.id, b.id))
  };
  for (const dimension of ALL_DIMENSIONS) {
    if (canonicalJson(dimensionValue(source, dimension)) !== canonicalJson(dimensionValue(normalizedObserved, dimension))) {
      throw new RepresentationFidelityError(dimension, `candidate changed protected dimension: ${dimension}`);
    }
  }
  const expectedKernel = source.statements.map(kernel).sort((a, b) => compare2(String(a.id), String(b.id)));
  const observedKernel = normalizedObserved.statements.map(kernel).sort((a, b) => compare2(String(a.id), String(b.id)));
  if (canonicalJson(expectedKernel) !== canonicalJson(observedKernel) || canonicalJson(source.scenarios) !== canonicalJson(normalizedObserved.scenarios)) {
    throw new RepresentationFidelityError("normative-force", "candidate contains unparsed or contradictory semantic content");
  }
  if (profileKey === "human-technical@1") {
    for (const statement of source.statements) {
      const observedStatement = normalizedObserved.statements.find(({ id }) => id === statement.id);
      if (observedStatement === void 0 || !advisoryMatchesWithExactLiterals(statement.text, observedStatement.text, statement.protectedLiterals)) {
        const dimension = observedStatement !== void 0 && !hasExactLiteralInventory(statement.text, observedStatement.text, statement.protectedLiterals) ? "identifier-literal" : "normative-force";
        throw new RepresentationFidelityError(dimension, "human candidate advisory envelope changed semantic prose or an exact literal");
      }
    }
  }
  if (isAgentCompactProfileKey(profileKey)) {
    const structural = /* @__PURE__ */ new Set(["FORBID", "NOT", "MUST", "IFF", "IF", "ORDER", "SCOPE", "TITLE", "ONE", "MORE", "MOST", "ALL", "NONE", "AND", "OR"]);
    const protectedAcronyms = new Set(source.statements.flatMap(({ protectedLiterals }) => protectedLiterals).flatMap((literal) => literal.match(/\b[A-Z]{2,5}\b/gu) ?? []));
    const measured = new Set(measuredAbbreviations.filter(({ tokenSavings, clarityValidated }) => Number.isFinite(tokenSavings) && tokenSavings > 0 && clarityValidated).map(({ abbreviation }) => abbreviation));
    for (const abbreviation of candidate.match(/\b[A-Z]{2,5}\b/gu) ?? []) {
      if (!structural.has(abbreviation) && !protectedAcronyms.has(abbreviation) && !measured.has(abbreviation)) {
        throw new RepresentationFidelityError("identifier-literal", `invented abbreviation lacks measured utility: ${abbreviation}`);
      }
    }
  }
}
function stringsIn(value) {
  if (typeof value === "string")
    return value.trim() === "" ? [] : [value];
  if (Array.isArray(value))
    return value.flatMap(stringsIn);
  if (value !== null && typeof value === "object")
    return Object.values(value).flatMap(stringsIn);
  return [];
}
function canonicalRepresentationSourceFromSemanticChange(change) {
  const statementId = `change-directive:${change.id}`;
  const changeKernelHash = hashFramedDomain("semantic-change-normative-kernel", change);
  const scenarioOperations = change.operations.filter((operation) => operation.subjectType === "scenario" && operation.proposedScenario !== void 0);
  const scenarios = scenarioOperations.map((operation) => ({
    id: operation.proposedScenario.id,
    title: operation.proposedScenario.title,
    steps: operation.proposedScenario.steps
  }));
  const operationIds = change.operations.flatMap((operation) => operation.subjectType === "requirement" ? [operation.requirementId, operation.proposedRequirement?.id] : operation.subjectType === "scenario" ? [operation.scenarioId, operation.proposedScenario?.id] : [operation.subjectId]).filter((id) => id !== void 0);
  const statement = {
    id: statementId,
    text: change.normalizedIntent,
    normativeForce: "require",
    negated: false,
    scope: unique3(change.boundary),
    ...change.operations.length > 1 ? { cardinality: "all", connective: "and" } : {},
    exceptions: [],
    dependencies: unique3([...change.decisionIds, ...change.identityResolutionIds, ...change.assumptions.map((item) => `assumption:${item}`)]),
    conceptIds: unique3(operationIds),
    protectedLiterals: unique3([change.id, changeKernelHash, ...change.boundary, ...change.operations.flatMap(stringsIn), ...change.assumptions])
  };
  const body = { sourceEntityIds: unique3([statementId, ...scenarios.map(({ id }) => id)]), statements: [statement], scenarios };
  return { ...body, sourceSemanticHash: hashFramedDomain("canonical-representation-source", body) };
}
var RepresentationCompiler = class {
  ports;
  constructor(ports) {
    this.ports = ports;
  }
  async validateCandidate(input) {
    const source = normalizedSource(input.source);
    assertCandidate(source, input.candidate, input.profileKey, input.measuredAbbreviations);
    return fingerprint(source, BUILT_IN_REPRESENTATION_PROFILES[input.profileKey]);
  }
  async verifyArtifact(projection) {
    const content = await this.ports.artifacts.get(projection.contentHash);
    if (content === void 0)
      return { status: "invalid", reason: "representation artifact is missing" };
    if (hashFramedDomain("representation-artifact", content) !== projection.contentHash) {
      return { status: "invalid", reason: "representation artifact content hash mismatch" };
    }
    return { status: "valid" };
  }
  async compile(input) {
    return this.compileRendered(input, input.candidate);
  }
  async compileRendered(input, contentOverride, identityVariant = "canonical") {
    const source = normalizedSource(input.source);
    const selected = BUILT_IN_REPRESENTATION_PROFILES[input.profileKey];
    const members = typedSourceMembers(source);
    const memberKeys = new Set(members.map(({ kind, id }) => `${kind}:${id}`));
    if (input.binding.valueDependencies.some(({ kind, id }) => kind === "canonical-entity" && memberKeys.has(String(id)))) {
      throw new TypeError("representation source members must occur exactly once in typed bound value dependencies");
    }
    const existingProfileDependencies = input.binding.valueDependencies.filter(({ kind, id }) => kind === "representation-profile" && id === selected.id);
    if (existingProfileDependencies.length > 1 || existingProfileDependencies.length === 1 && existingProfileDependencies[0].versionHash !== selected.semanticHash) {
      throw new TypeError("selected representation profile dependency is duplicated or stale");
    }
    const boundState = createStateBinding({
      compiledAgainst: input.binding.compiledAgainst,
      valueDependencies: [
        ...input.binding.valueDependencies,
        ...members.map((member) => ({ kind: "canonical-entity", id: `${member.kind}:${member.id}`, versionHash: member.semanticHash, role: `representation-source:${member.kind}` })),
        ...existingProfileDependencies.length === 0 ? [{ kind: "representation-profile", id: selected.id, versionHash: selected.semanticHash, role: "representation-profile" }] : []
      ],
      queryDependencies: input.binding.queryDependencies
    });
    const content = contentOverride ?? render(source, input.profileKey);
    assertCandidate(source, content, input.profileKey);
    const contentHash = hashFramedDomain("representation-artifact", content);
    await this.ports.artifacts.put(contentHash, content);
    const preservation = fingerprint(source, selected);
    const sourceText = source.statements.map(({ text }) => text).join("\n");
    const tokenAccounting = this.ports.tokenizer === void 0 ? void 0 : {
      sourceTokens: this.ports.tokenizer.measure(sourceText),
      outputTokens: this.ports.tokenizer.measure(content),
      profileOverheadTokens: input.profileOverheadTokens ?? 0,
      estimatedNetTokens: this.ports.tokenizer.measure(sourceText) - this.ports.tokenizer.measure(content) - (input.profileOverheadTokens ?? 0),
      tokenizerProfileId: this.ports.tokenizer.profileId,
      ...this.ports.utility === void 0 ? {} : (() => {
        const measured = this.ports.utility.measure({ source, candidate: content, profileKey: input.profileKey, profileOverheadTokens: input.profileOverheadTokens ?? 0 });
        if (!Number.isFinite(measured.netInstructionEfficiency) || measured.evidence.trim() === "")
          throw new TypeError("instruction utility measurement must be finite and evidenced");
        return { estimatedNetInstructionEfficiency: measured.netInstructionEfficiency, utilityProfileId: this.ports.utility.profileId, utilityEvidence: measured.evidence };
      })()
    };
    const projectionBase = {
      id: `representation:${hashFramedDomain("representation-projection-id", { sourceHash: source.sourceSemanticHash, profileId: selected.id, profileVersion: selected.version, binding: boundState.dependencyDigest, identityVariant })}`,
      profileId: selected.id,
      profileVersion: selected.version,
      target: selected.target,
      sourceEntityIds: unique3(source.sourceEntityIds),
      sourceSemanticHash: source.sourceSemanticHash,
      boundState,
      contentHash,
      preservation,
      ...tokenAccounting === void 0 ? {} : { tokenAccounting },
      status: "valid",
      validatorResults: [validation("passed", "all protected dimensions preserved")]
    };
    const projection = { ...projectionBase, semanticHash: hashFramedDomain("representation-projection", projectionBase) };
    await this.ports.telemetry?.record({ event: "representation.compiled", projectionId: projection.id, profileId: projection.profileId, sourceSemanticHash: projection.sourceSemanticHash, protectedDimensionCount: projection.preservation.protectedDimensions.length, fidelityStatus: "valid", ...projection.tokenAccounting?.estimatedNetInstructionEfficiency === void 0 ? {} : { netInstructionEfficiency: projection.tokenAccounting.estimatedNetInstructionEfficiency } });
    return { projection: deepFreeze2(projection) };
  }
  async compileBest(input) {
    let requested;
    try {
      requested = await this.compile({ ...input, profileKey: input.requestedProfileKey });
    } catch (error) {
      if (!isAgentCompactProfileKey(input.requestedProfileKey) || !(error instanceof RepresentationFidelityError))
        throw error;
    }
    const efficiency = requested?.projection.tokenAccounting?.estimatedNetInstructionEfficiency ?? requested?.projection.tokenAccounting?.estimatedNetTokens ?? Number.NEGATIVE_INFINITY;
    if (!isAgentCompactProfileKey(input.requestedProfileKey) && requested !== void 0)
      return requested;
    if (requested !== void 0 && efficiency > 0)
      return requested;
    const tiers = [
      { tier: "exact-machine-plus-advisory-compact", profileKey: "machine-invariant@1" },
      { tier: "less-aggressive-compact", profileKey: input.requestedProfileKey },
      { tier: "human-technical", profileKey: "human-technical@1" }
    ];
    for (const { tier, profileKey } of tiers) {
      if (this.ports.fallbackGate?.(tier) === false)
        continue;
      const { candidate: omittedCandidate, ...fallbackInput } = input;
      void omittedCandidate;
      const accepted = tier === "less-aggressive-compact" ? await this.compileRendered({ ...input, profileKey: input.requestedProfileKey }, renderLessAggressiveCompact(normalizedSource(input.source)), "less-aggressive-compact") : profileKey === input.requestedProfileKey && requested !== void 0 ? requested : await this.compile({ ...fallbackInput, profileKey });
      const base = { ...accepted.projection, status: "fallback-used" };
      const projection = deepFreeze2({ ...base, semanticHash: hashFramedDomain("representation-projection", { ...base, semanticHash: void 0 }) });
      await this.ports.telemetry?.record({ event: "representation.fallback", requestedProfileId: BUILT_IN_REPRESENTATION_PROFILES[input.requestedProfileKey].id, acceptedProjectionId: projection.id, tier, reason: requested === void 0 ? "unsafe" : "instruction-inefficient" });
      return {
        projection,
        ...tier === "exact-machine-plus-advisory-compact" && requested !== void 0 ? { advisoryProjection: requested.projection } : {},
        fallback: { tier, status: "fallback-used" }
      };
    }
    throw new Error("representation fallback exhausted; projection must block");
  }
};

// node_modules/@projector/engine/dist/representation/upgrades.js
import { z as z2 } from "zod";
var normalizeKeys = (keys) => [...new Set(keys)].sort();
var strictNonblank = z2.string().min(1).refine((value) => value === value.trim(), "value must be trimmed");
var UpgradeDeclarationSchema = z2.strictObject({
  apiVersion: z2.literal("projector.dev/upgrade-declaration/v1"),
  schemaVersion: z2.literal("1"),
  kind: z2.enum(["engine", "schema", "analyzer", "signature-profile", "representation-profile"]),
  id: strictNonblank,
  fromVersion: strictNonblank,
  toVersion: strictNonblank,
  affectedDependencyKeys: z2.array(strictNonblank).transform(normalizeKeys),
  requiredAction: z2.enum(["none", "reindex", "revalidate", "migrate"])
});
var upgradeDeclarationHash = (declaration) => {
  const parsed = UpgradeDeclarationSchema.parse(declaration);
  return hashFramedDomain("upgrade-declaration:v1", { ...parsed, affectedDependencyKeys: normalizeKeys(parsed.affectedDependencyKeys) });
};
function planUpgradeInvalidation(declaration, dependents, registry) {
  for (const value of [declaration.id, declaration.fromVersion, declaration.toVersion, ...declaration.affectedDependencyKeys]) {
    if (value.trim() === "" || value !== value.trim())
      throw new TypeError("upgrade identities, versions, and dependency keys must be nonblank and trimmed");
  }
  if (declaration.fromVersion === declaration.toVersion)
    throw new TypeError("upgrade versions must differ");
  if (declaration.requiredAction === "none")
    throw new TypeError("semantic interpretation upgrade and profile upgrade require a non-none action");
  const keys = normalizeKeys(declaration.affectedDependencyKeys);
  if (keys.length === 0)
    throw new TypeError("upgrade must declare affected dependency keys");
  const known = new Set(normalizeKeys(registry.knownDependencyKeys));
  const unresolved = keys.filter((key) => !known.has(key));
  if (unresolved.length > 0)
    throw new TypeError(`affected dependency keys do not resolve in the known dependency registry: ${unresolved.join(", ")}`);
  const definitions = /* @__PURE__ */ new Map();
  for (const dependent of dependents) {
    if (dependent.id.trim() === "" || dependent.id !== dependent.id.trim() || dependent.dependencyKeys.some((key) => key.trim() === "" || key !== key.trim())) {
      throw new TypeError("dependent identities and dependency keys must be nonblank and trimmed");
    }
    const normalized = canonicalJson({ ...dependent, dependencyKeys: normalizeKeys(dependent.dependencyKeys) });
    const prior = definitions.get(dependent.id);
    if (prior !== void 0 && prior !== normalized)
      throw new TypeError(`conflicting dependent identity: ${dependent.id}`);
    definitions.set(dependent.id, normalized);
  }
  const normalizedDependents = [...new Map(dependents.map((dependent) => [dependent.id, { ...dependent, dependencyKeys: normalizeKeys(dependent.dependencyKeys) }])).values()];
  const targetKeys = Object.entries(registry.ownedDependencyKeys).filter(([, owner]) => owner.kind === declaration.kind && owner.id === declaration.id).map(([key]) => key).sort();
  if (targetKeys.length === 0 || canonicalJson(keys) !== canonicalJson(targetKeys)) {
    throw new TypeError("affected dependency keys must exactly enumerate the complete target-owned dependency key set");
  }
  const dependentsById = new Map(normalizedDependents.map((dependent) => [dependent.id, dependent]));
  const unregisteredDependentKeys = normalizeKeys(normalizedDependents.flatMap(({ dependencyKeys }) => dependencyKeys)).filter((key) => !known.has(key));
  if (unregisteredDependentKeys.length > 0) {
    throw new TypeError(`dependency registry coverage is missing dependency keys: ${unregisteredDependentKeys.join(", ")}`);
  }
  for (const key of known) {
    const registered = registry.directDependentIdsByDependencyKey[key];
    if (registered === void 0)
      throw new TypeError(`dependency registry coverage is missing direct dependents for ${key}`);
    const actual = normalizedDependents.filter((dependent) => dependent.dependencyKeys.includes(key)).map(({ id }) => id).sort();
    const declared = normalizeKeys(registered);
    if (declared.length !== registered.length || canonicalJson(declared) !== canonicalJson(actual)) {
      throw new TypeError(`dependency registry coverage disagrees with direct dependents for ${key}`);
    }
    if (declared.some((id) => !dependentsById.has(id)))
      throw new TypeError(`dependency registry names a missing direct dependent for ${key}`);
  }
  const affected = new Set(targetKeys);
  const invalidated = /* @__PURE__ */ new Set();
  const pending = [...targetKeys];
  while (pending.length > 0) {
    const dependencyKey = pending.shift();
    for (const id of registry.directDependentIdsByDependencyKey[dependencyKey] ?? []) {
      const dependent = dependentsById.get(id);
      if (dependent.kind === "canonical-entity" || invalidated.has(id))
        continue;
      invalidated.add(id);
      const producedKey = `${dependent.kind}:${dependent.id}`;
      if (known.has(producedKey) && !affected.has(producedKey)) {
        affected.add(producedKey);
        pending.push(producedKey);
      }
    }
  }
  if (invalidated.size === 0)
    throw new TypeError("semantic upgrade must produce a nonempty actual invalidation; vacuous dependency keys are not permitted");
  return {
    invalidatedIds: [...invalidated].sort(),
    preservedCanonicalEntityIds: normalizedDependents.filter(({ kind }) => kind === "canonical-entity").map(({ id }) => id).sort(),
    requiredAction: declaration.requiredAction
  };
}
async function reconcileRepresentationProfileUpgrade(plan, ports) {
  const invalidatedIds = normalizeKeys(plan.invalidatedIds);
  const preservedCanonicalEntityIds = normalizeKeys(plan.preservedCanonicalEntityIds);
  if (invalidatedIds.length === 0)
    throw new TypeError("representation reconciliation requires nonempty invalidation");
  if (invalidatedIds.some((id) => preservedCanonicalEntityIds.includes(id)))
    throw new TypeError("canonical authority cannot be invalidated during representation reconciliation");
  await ports.invalidate(invalidatedIds);
  const refreshedEntries = [];
  for (const id of invalidatedIds) {
    const contentHash = await ports.refresh(id);
    if (!/^sha256:v1:[a-f0-9]{64}$/u.test(contentHash))
      throw new TypeError(`refreshed representation dependent ${id} is unauthenticated`);
    refreshedEntries.push([id, contentHash]);
  }
  const refreshed = Object.fromEntries(refreshedEntries);
  const body = { invalidatedIds, refreshed, preservedCanonicalEntityIds, requiredAction: plan.requiredAction };
  return { status: "reconciled", ...body, refreshedIds: Object.keys(refreshed).sort(), receiptHash: hashFramedDomain("representation-upgrade-reconciliation", body) };
}

// node_modules/@projector/engine/dist/governance/execution-policy.js
var RISKS = ["R0", "R1", "R2", "R3", "R4"];
var riskRank2 = (risk) => RISKS.indexOf(risk);
function normalizeRiskPolicy(risk) {
  const rank = riskRank2(risk);
  if (rank < 0)
    throw new TypeError(`unknown risk class: ${risk}`);
  return { approval: risk, worktree: rank < 2 ? "R0" : risk, independentValidation: rank < 1 ? "R0" : risk, minimumEvidence: rank + 1 };
}
function assertPolicyRiskMonotonic(policy) {
  if (riskRank2(policy.maximumAutomaticRisk) >= 4)
    throw new TypeError("R4 can never be automatic");
  if (policy.allowAutoMutation && riskRank2(policy.requireIndependentValidationAtOrAbove) > riskRank2(policy.maximumAutomaticRisk)) {
    throw new TypeError("automatic mutation would bypass its independent-validation threshold");
  }
}
function assertGovernanceConflictPolicy(preset, conflictPaths) {
  if ((preset === "govern" || preset === "autonomous") && conflictPaths.length > 0) {
    throw new Error(`canonical governance conflict blocks ${preset}: ${[...conflictPaths].sort().join(", ")}`);
  }
}

// node_modules/@projector/engine/dist/governance/ignore-policy.js
var CONCERNS = ["inventory", "inferenceAuthority", "mutation", "reporting", "modelContext", "coverageDenominator"];
var compare3 = (a, b) => a < b ? -1 : a > b ? 1 : 0;
var IgnorePolicyConflictError = class extends Error {
  constructor(id) {
    super(`conflicting ignore rule identity: ${id}`);
    this.name = "IgnorePolicyConflictError";
  }
};
var LAYER_RANK = { repository: 0, config: 1, lens: 2, rule: 3 };
var same = (left, right) => canonicalJson(left) === canonicalJson(right);
var includesValue = (values, value) => values.some((item) => canonicalJson(item) === canonicalJson(value));
function selectorContainedBy(left, right) {
  if (same(left, right))
    return "yes";
  if (right.op === "all" && right.items.length === 0)
    return "yes";
  if (left.op === "any" && left.items.length === 0)
    return "yes";
  if (left.op === "not" || right.op === "not")
    return "unknown";
  if (right.op === "all")
    return right.items.every((item) => selectorContainedBy(left, item) === "yes") ? "yes" : "unknown";
  if (left.op === "any")
    return left.items.every((item) => selectorContainedBy(item, right) === "yes") ? "yes" : "unknown";
  if (right.op === "any")
    return right.items.some((item) => selectorContainedBy(left, item) === "yes") ? "yes" : "unknown";
  if (left.op === "all")
    return left.items.some((item) => selectorContainedBy(item, right) === "yes") ? "yes" : "unknown";
  if (left.op !== "atom" || right.op !== "atom" || left.field !== right.field)
    return "unknown";
  if (left.matcher === "equals" && right.matcher === "in" && Array.isArray(right.value))
    return includesValue(right.value, left.value) ? "yes" : "no";
  if (left.matcher === "in" && right.matcher === "in" && Array.isArray(left.value) && Array.isArray(right.value)) {
    return left.value.every((value) => includesValue(right.value, value)) ? "yes" : "no";
  }
  if (left.matcher === "equals" && right.matcher === "glob" && typeof left.value === "string" && typeof right.value === "string") {
    return matchesCanonicalGlob(right.value, left.value) ? "yes" : "no";
  }
  return "unknown";
}
function compileLayeredIgnorePolicy(input) {
  const definitions = /* @__PURE__ */ new Map();
  const rules = input.rules.map((rule) => ({ ...structuredClone(rule), selector: normalizeSelector(rule.selector) }));
  for (const rule of rules) {
    const serialized = canonicalJson(rule);
    const prior = definitions.get(rule.id);
    if (prior !== void 0 && prior !== serialized)
      throw new IgnorePolicyConflictError(rule.id);
    definitions.set(rule.id, serialized);
  }
  const normalizedRules = [...new Map(rules.map((rule) => [canonicalJson(rule), rule])).values()].sort((a, b) => compare3(canonicalJson(a), canonicalJson(b)));
  const byUnit = Object.fromEntries([...input.units].sort((a, b) => compare3(a.id, b.id)).map((unit) => {
    const subject = projectionUnitSelectorSubject(unit);
    const winners = /* @__PURE__ */ new Map();
    for (const concern of CONCERNS) {
      const matching = normalizedRules.filter((rule) => rule.concern === concern && evaluateSelector(rule.selector, subject).matched);
      const highest = matching.reduce((rank, rule) => Math.max(rank, LAYER_RANK[rule.layer]), -1);
      const layerWinners = matching.filter((rule) => LAYER_RANK[rule.layer] === highest);
      const atHighest = layerWinners.filter((candidate) => !layerWinners.some((other) => other !== candidate && selectorContainedBy(other.selector, candidate.selector) === "yes" && selectorContainedBy(candidate.selector, other.selector) !== "yes"));
      if (new Set(atHighest.map(({ effect }) => effect)).size > 1) {
        throw new IgnorePolicyConflictError(`conflicting layered ignore for ${unit.id}:${concern}`);
      }
      winners.set(concern, atHighest);
    }
    const decision2 = Object.fromEntries(CONCERNS.map((concern) => [concern, winners.get(concern)?.[0]?.effect === "ignore"]));
    if (CONCERNS.every((concern) => decision2[concern]) && !CONCERNS.every((concern) => winners.get(concern)?.some(({ authorizeAllRoles }) => authorizeAllRoles === true))) {
      throw new IgnorePolicyConflictError(`ignore rules erase all semantic roles for ${unit.id} without explicit authorization`);
    }
    return [unit.id, decision2];
  }));
  return { byUnit, policyHash: hashFramedDomain("layered-ignore-policy:v2", normalizedRules) };
}
function compileIgnorePolicy(input) {
  const normalized = Object.fromEntries(CONCERNS.map((concern) => {
    const selectors = input.policy[concern].map(normalizeSelector);
    const ids = input.ruleIds?.[concern];
    if (ids !== void 0) {
      const definitions = /* @__PURE__ */ new Map();
      selectors.forEach((selector, index) => {
        const id = ids[index];
        if (id === void 0)
          throw new TypeError(`missing ignore rule identity for ${concern}`);
        const prior = definitions.get(id);
        const serialized = canonicalJson(selector);
        if (prior !== void 0 && prior !== serialized)
          throw new IgnorePolicyConflictError(id);
        definitions.set(id, serialized);
      });
    }
    return [concern, [...new Map(selectors.map((selector) => [canonicalJson(selector), selector])).values()].sort((a, b) => compare3(canonicalJson(a), canonicalJson(b)))];
  }));
  const byUnit = Object.fromEntries([...input.units].sort((a, b) => compare3(a.id, b.id)).map((unit) => {
    const subject = projectionUnitSelectorSubject(unit);
    return [unit.id, Object.fromEntries(CONCERNS.map((concern) => [
      concern,
      normalized[concern].some((selector) => evaluateSelector(selector, subject).matched)
    ]))];
  }));
  return { byUnit, policyHash: hashFramedDomain("layered-ignore-policy", normalized) };
}

// node_modules/@projector/engine/dist/planning/revisions.js
var compare4 = (a, b) => a < b ? -1 : a > b ? 1 : 0;
var unique4 = (values) => [...new Set(values)].sort(compare4);
var InMemoryPlanRevisionStore = class {
  plans = /* @__PURE__ */ new Map();
  async get(id) {
    const plan = this.plans.get(id);
    return plan === void 0 ? void 0 : deepFreeze3(structuredClone(plan));
  }
  async put(plan) {
    const prior = this.plans.get(plan.id);
    if (prior !== void 0 && canonicalJson(prior) !== canonicalJson(plan))
      throw new Error(`plan revision ${plan.id} already exists with different content`);
    this.plans.set(plan.id, deepFreeze3(structuredClone(plan)));
  }
};
function deepFreeze3(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value))
      deepFreeze3(child);
    Object.freeze(value);
  }
  return value;
}
function packetHashMap(proofs, expectedPacketIds, label) {
  if (new Set(proofs.map(({ packetId }) => packetId)).size !== proofs.length || canonicalJson(unique4(proofs.map(({ packetId }) => packetId))) !== canonicalJson(unique4(expectedPacketIds))) {
    throw new Error(`${label} packet hash inventory must prove every packet exactly once`);
  }
  return new Map(proofs.map(({ packetId, packetHash }) => [packetId, packetHash]));
}
function validateCapsuleProof(proof, expectedPacketHash, expectedBinding, label) {
  if (proof.packetHash !== expectedPacketHash)
    throw new Error(`${label} capsule is not bound to the authenticated packet hash`);
  const rebuilt = createStateBinding({ compiledAgainst: proof.boundState.compiledAgainst, valueDependencies: proof.boundState.valueDependencies, queryDependencies: proof.boundState.queryDependencies });
  if (rebuilt.dependencyDigest !== proof.boundState.dependencyDigest || canonicalJson(proof.boundState) !== canonicalJson(expectedBinding)) {
    throw new Error(`${label} capsule is not bound to the required plan state`);
  }
  if (new Set(proof.approvalIds).size !== proof.approvalIds.length)
    throw new Error(`${label} capsule approval inventory contains duplicate identities`);
  if (proof.capsuleId.trim() === "" || proof.capsuleContentHash.trim() === "")
    throw new Error(`${label} capsule identity or authenticated content hash is blank`);
}
async function rebaseExecutionPlan(input) {
  if (input.validation.status === "unavailable")
    throw new Error("plan cannot be safely rebased from unavailable state");
  const lightweight = input.validation.status === "current" || input.validation.status === "rebound";
  if (input.validation.status === "rebound" && input.validation.rebound === void 0)
    throw new Error("lightweight rebind requires a validated rebound binding");
  const rebound = input.validation.status === "current" ? createStateBinding({ compiledAgainst: input.validation.currentState, valueDependencies: input.original.boundState.valueDependencies, queryDependencies: input.original.boundState.queryDependencies }) : input.validation.rebound;
  const recomputed = lightweight ? {} : await input.recompile();
  if (!lightweight && input.capsuleInventoryPort === void 0)
    throw new Error("semantic rebase requires a trusted old capsule inventory port");
  if (!lightweight && input.capsuleCompilerVerifier === void 0)
    throw new Error("semantic rebase requires a separate trusted capsule compiler/verifier");
  if (!lightweight && recomputed.boundState === void 0)
    throw new Error("semantic rebase must provide a recomputed state binding");
  if (!lightweight && (recomputed.boundary === void 0 || recomputed.packetIds === void 0 || recomputed.assumptions === void 0 || recomputed.relevanceClosureId === void 0 || recomputed.predictedImpactClosureHash === void 0 || recomputed.knownAffectedUnitIds === void 0 || recomputed.possibleFrontierUnitIds === void 0 || recomputed.unavailableSurfaceIds === void 0 || recomputed.completionCriteria === void 0 || recomputed.checkpoints === void 0)) {
    throw new Error("semantic rebase requires complete semantic recomputation of scope, packets, assumptions, closures, affected/frontier/unavailable units, checkpoints, completion, and capsules");
  }
  const nextBinding = recomputed.boundState ?? rebound;
  if (canonicalJson(nextBinding.compiledAgainst) !== canonicalJson(input.validation.currentState)) {
    throw new Error("rebased plan binding must compile against the validated current state");
  }
  const validatedBinding = createStateBinding({ compiledAgainst: nextBinding.compiledAgainst, valueDependencies: nextBinding.valueDependencies, queryDependencies: nextBinding.queryDependencies });
  if (validatedBinding.dependencyDigest !== nextBinding.dependencyDigest)
    throw new Error("rebased plan binding has an invalid dependency digest");
  const nextPacketIds = recomputed.packetIds ?? input.original.packetIds;
  let oldCapsuleMapping = [];
  let newCapsuleMapping = [];
  if (!lightweight) {
    const oldInventory = await input.capsuleInventoryPort.enumerateAuthenticated({ planId: input.original.id, packetIds: input.original.packetIds });
    if (new Set(oldInventory.map(({ packetId }) => packetId)).size !== oldInventory.length || canonicalJson(unique4(oldInventory.map(({ packetId }) => packetId))) !== canonicalJson(unique4(input.original.packetIds))) {
      throw new Error("trusted old capsule inventory must account for every original packet exactly once");
    }
    if (oldInventory.some(({ planId }) => planId !== input.original.id))
      throw new Error("trusted capsule inventory is bound to the wrong original plan");
    const oldPacketHashes = packetHashMap(oldInventory, input.original.packetIds, "trusted original");
    const oldCapsules2 = oldInventory.filter((entry) => "capsuleId" in entry);
    if (new Set(oldCapsules2.map(({ capsuleId }) => capsuleId)).size !== oldCapsules2.length || new Set(oldCapsules2.flatMap(({ approvalIds = [] }) => approvalIds)).size !== oldCapsules2.flatMap(({ approvalIds = [] }) => approvalIds).length) {
      throw new Error("old capsule or approval identities alias across packets");
    }
    for (const entry of oldInventory) {
      const expectedHash = oldPacketHashes.get(entry.packetId);
      if ("capsuleId" in entry)
        validateCapsuleProof(entry, expectedHash, input.original.boundState, "old");
      else if (entry.packetHash.trim() === "")
        throw new Error("trusted no-capsule inventory has a blank authenticated packet hash");
    }
    const newCapsules = await input.capsuleCompilerVerifier.compileAndVerify({
      originalPlanId: input.original.id,
      revision: input.original.revision + 1,
      packetIds: nextPacketIds,
      boundState: validatedBinding,
      recomputedPlan: recomputed
    });
    const newPacketHashes = packetHashMap(newCapsules, nextPacketIds, "verified recompiled");
    if (new Set(newCapsules.map(({ packetId }) => packetId)).size !== newCapsules.length || canonicalJson(unique4(newCapsules.map(({ packetId }) => packetId))) !== canonicalJson(unique4(nextPacketIds))) {
      throw new Error("semantic rebase must recompile exactly one capsule for every recomputed packet");
    }
    if (new Set(newCapsules.map(({ capsuleId }) => capsuleId)).size !== newCapsules.length || newCapsules.some(({ capsuleId }) => oldCapsules2.some((old) => old.capsuleId === capsuleId))) {
      throw new Error("recompiled capsule identities must be unique and must not alias stale capsules");
    }
    for (const capsule of newCapsules)
      validateCapsuleProof(capsule, newPacketHashes.get(capsule.packetId), validatedBinding, "recompiled");
    oldCapsuleMapping = deepFreeze3(structuredClone([...oldInventory].sort((a, b) => compare4(a.packetId, b.packetId))));
    newCapsuleMapping = deepFreeze3(structuredClone([...newCapsules].sort((a, b) => compare4(a.packetId, b.packetId))));
  }
  const carried = [];
  for (const packetId of unique4(input.completedPackets)) {
    if (nextPacketIds.includes(packetId) && await input.isCompletedPacketCurrent(packetId))
      carried.push(packetId);
  }
  const invalidated = lightweight ? unique4(input.completedPackets).filter((id) => !carried.includes(id)) : unique4(input.original.packetIds.filter((id) => !carried.includes(id)));
  const revision = input.original.revision + 1;
  const fields = {
    ...input.original,
    ...recomputed,
    revision,
    supersedesPlanId: input.original.id,
    boundState: validatedBinding,
    packetIds: recomputed.packetIds ?? input.original.packetIds,
    assumptions: recomputed.assumptions ?? input.original.assumptions
  };
  const identity = hashFramedDomain("execution-plan-revision-id", { ...fields, id: void 0 });
  const plan = createExecutionPlan({ ...fields, id: `plan:${identity}` });
  const oldCapsules = oldCapsuleMapping.filter((entry) => "capsuleId" in entry);
  return {
    kind: lightweight ? "lightweight-rebind" : "semantic-rebase",
    plan,
    carriedCompletedPacketIds: carried,
    invalidatedPacketIds: invalidated,
    invalidatedApprovalPlanIds: [input.original.id],
    invalidatedApprovalIds: unique4(oldCapsules.flatMap(({ approvalIds }) => approvalIds)),
    invalidatedCapsuleIds: unique4(lightweight ? oldCapsules.filter((entry) => invalidated.includes(entry.packetId)).map(({ capsuleId }) => capsuleId) : oldCapsules.map(({ capsuleId }) => capsuleId)),
    recompiledCapsuleIds: unique4(newCapsuleMapping.map(({ capsuleId }) => capsuleId)),
    oldCapsuleMapping,
    newCapsuleMapping
  };
}

export {
  groupCausalEvidence,
  summarizeEvidenceSupport,
  inferPatternFamilies,
  AUTHORITY_ORDER,
  authorityRank,
  compareAuthority,
  governanceBasisIsEndogenous,
  assessLensAuthority,
  LensCompilationError,
  GovernanceCycleError,
  NonconvergentGovernanceError,
  LensOwnershipCollisionError,
  lensMembershipFingerprint,
  compileProjectionLenses,
  createRepositoryScriptLens,
  RuleCompilationError,
  GovernanceConflictError,
  isHardRule,
  compareRules,
  compileEffectiveRuleBundle,
  assertGovernable,
  governancePopulationEntry,
  summarizeGovernanceManifest,
  buildGovernancePopulation,
  summarizeGovernancePopulation,
  evaluateEffectiveRuleBundle,
  prepareGovernanceEvaluator,
  prepareIndexedGovernanceEvaluator,
  compileSemanticChange,
  executionPlanHash,
  executionCapsuleHash,
  createExecutionApproval,
  StateBoundChangeExecutor,
  createPreparedStateBoundChangeSuccess,
  authenticatePreparedStateBoundChangeSuccess,
  publishPreparedStateBoundChangeSuccess,
  MANDATORY_VERTICAL_SLICE_STEPS,
  MANDATORY_VERTICAL_SLICE_EVIDENCE_KINDS,
  mandatoryVerticalSliceEvidenceDigest,
  mandatoryVerticalSliceExecutionContextDigest,
  createMandatoryVerticalSliceExecutionContext,
  assertMandatoryVerticalSliceEvidence,
  NonconvergentReconciliationError,
  reconcileToFixedPoint,
  SemanticSignatureProfileRegistry,
  assessBackdating,
  DerivationIndex,
  ImpactRuleRegistry,
  createImpactClosure,
  InvalidationEngine,
  compareCorrectnessOracles,
  CanonicalSemanticBoundarySchema,
  IdentityOperationFactSchema,
  VerifiedIdentityClaimRefSchema,
  IdentityLineageProposalSchema,
  IdentityTombstoneProposalSchema,
  IdentityCandidateRecordSchema,
  IdentityAdjudicationSchema,
  AdjudicatedSemanticIdentityResolutionSchema,
  computeEvidenceContentHash,
  resolveSemanticIdentity,
  resolveSemanticIdentityFromEvidence,
  resolveSemanticIdentityFromSearch,
  assertCanonicalCreationAllowed,
  analyzeIntent,
  scoutRelevance,
  compileRelevanceClosure,
  classifyPlanningSurprise,
  activateAnalysisFacets,
  compileContext,
  BUILT_IN_REPRESENTATION_PROFILES,
  currentBuiltInRepresentationProfile,
  lintHumanTechnical,
  RepresentationFidelityError,
  canonicalRepresentationSourceFromSemanticChange,
  RepresentationCompiler,
  UpgradeDeclarationSchema,
  upgradeDeclarationHash,
  planUpgradeInvalidation,
  reconcileRepresentationProfileUpgrade,
  riskRank2 as riskRank,
  normalizeRiskPolicy,
  assertPolicyRiskMonotonic,
  assertGovernanceConflictPolicy,
  IgnorePolicyConflictError,
  compileLayeredIgnorePolicy,
  compileIgnorePolicy,
  InMemoryPlanRevisionStore,
  rebaseExecutionPlan
};
