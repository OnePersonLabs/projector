import { createRequire as __projectorCreateRequire } from "node:module"; const require = __projectorCreateRequire(import.meta.url);
import {
  assessDecisionDeferral,
  authorityRecordHashIsValid,
  normalizeSelector
} from "./shared-ZKECJVYF.js";
import {
  ArchitectureConcernSchema,
  ArchitectureDecisionSchema,
  AuthorityRecordSchema,
  canonicalJson,
  hashFramedDomain,
  hashSemantic
} from "./shared-6VIFAIKJ.js";

// node_modules/@projector/engine/dist/architecture/discovery.js
var compareStrings = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var sortedUnique = (values) => [...new Set(values)].sort(compareStrings);
var materialityRank = { deferable: 0, "material-soon": 1, "blocking-now": 2 };
var platformFrontier = [
  { key: "workspace-topology", title: "Workspace topology", question: "What workspace boundaries preserve coherent ownership across the target surfaces?", minimum: "material-soon", facets: ["workspace-expansion"] },
  { key: "cross-platform-runtime", title: "Cross-platform runtime", question: "Which runtime boundaries safely support the requested target capabilities?", minimum: "blocking-now", facets: ["platform-target"] },
  { key: "shared-code-boundary", title: "Shared-code boundary", question: "Which behavior is safe to share and which remains platform-specific?", minimum: "blocking-now", facets: ["platform-target"] },
  { key: "dependency-version-coherence", title: "Dependency coherence", question: "How will compatible dependency versions remain coherent across governed packages?", minimum: "material-soon", facets: ["workspace-expansion"] },
  { key: "api-contract", title: "API contract", question: "Which public compatibility contract connects the new surfaces?", minimum: "blocking-now", facets: ["public-contract"] },
  { key: "build-release", title: "Build and release", question: "How will each target be built, verified, and released reproducibly?", minimum: "blocking-now", facets: ["platform-target"] },
  { key: "distribution-signing", title: "Distribution and signing", question: "Which distribution, signing, and platform obligations must the product satisfy?", minimum: "blocking-now", facets: ["distribution"] },
  { key: "task-orchestration", title: "Task orchestration", question: "When do existing task dependencies stop being safely coordinated by simple scripts?", minimum: "deferable", facets: ["workspace-expansion"] }
];
function stronger(left, right) {
  return materialityRank[left] >= materialityRank[right] ? left : right;
}
function architectureId(hash) {
  return `architecture-concern:${hash.slice("sha256:v1:".length, "sha256:v1:".length + 24)}`;
}
function reasonKey(reason) {
  return canonicalJson(reason);
}
function discoverArchitectureConcerns(input) {
  const unknowns = sortedUnique(input.closure.unknowns);
  const accumulated = /* @__PURE__ */ new Map();
  const sortedChanges = [...input.changes].map((change) => ({
    ...change,
    subjectIds: sortedUnique(change.subjectIds),
    activationFacets: [...new Set(change.activationFacets)].sort(compareStrings),
    scope: normalizeSelector(change.scope)
  })).sort((left, right) => compareStrings(canonicalJson(left), canonicalJson(right)));
  const add = (definition, scope, sourceClass, materiality, reason) => {
    const normalizedScope = normalizeSelector(scope);
    const mapKey = canonicalJson({ key: definition.key.normalize("NFKC").trim(), scope: normalizedScope });
    const existing = accumulated.get(mapKey);
    if (existing === void 0) {
      accumulated.set(mapKey, {
        key: definition.key.normalize("NFKC").trim(),
        title: definition.title.normalize("NFKC").trim(),
        question: definition.question.normalize("NFKC").trim(),
        scope: normalizedScope,
        sourceClass,
        materiality: stronger(definition.minimum, materiality),
        reasons: [reason]
      });
      return;
    }
    existing.materiality = stronger(existing.materiality, stronger(definition.minimum, materiality));
    if (sourceClass === "derived")
      existing.sourceClass = "derived";
    if (!existing.reasons.some((candidate) => reasonKey(candidate) === reasonKey(reason)))
      existing.reasons.push(reason);
  };
  for (const reasonSource of sortedChanges) {
    const reason = {
      kind: reasonSource.kind,
      subjectIds: reasonSource.subjectIds,
      explanation: reasonSource.explanation,
      causalOrigin: { kind: "relevance-analysis", causedByRelevanceClosureId: input.closure.id }
    };
    for (const definition of platformFrontier) {
      if (definition.facets.some((facet) => reasonSource.activationFacets.includes(facet)))
        add(definition, reasonSource.scope, "derived", definition.minimum, reason);
    }
  }
  for (const candidate of [...input.inferred ?? []].sort((left, right) => compareStrings(canonicalJson(left), canonicalJson(right)))) {
    if (candidate.originatingDecision !== void 0) {
      const expected = hashFramedDomain("architecture-concern-origin", { decisionId: candidate.originatingDecision.decisionId });
      unknowns.push(candidate.originatingDecision.semanticHash === expected ? `circular architecture justification rejected for ${candidate.key}` : `unverifiable originating-decision provenance rejected for ${candidate.key}`);
      continue;
    }
    add({ key: candidate.key, title: candidate.title, question: candidate.question, minimum: "deferable", facets: [] }, candidate.scope, "inferred", candidate.materiality, {
      kind: "inference",
      subjectIds: sortedUnique(candidate.subjectIds),
      explanation: `inferred from the remaining bounded decision frontier for ${candidate.key}`,
      causalOrigin: { kind: "model-inference", causedByRelevanceClosureId: input.closure.id }
    });
  }
  const concerns = [...accumulated.values()].sort((left, right) => compareStrings(canonicalJson({ key: left.key, scope: left.scope }), canonicalJson({ key: right.key, scope: right.scope }))).map((candidate) => {
    const activationReasons = [...candidate.reasons].sort((left, right) => compareStrings(reasonKey(left), reasonKey(right)));
    const identityHash = hashFramedDomain("architecture-concern-identity", {
      key: candidate.key,
      scope: candidate.scope,
      causalContext: activationReasons.map(({ kind, subjectIds, causalOrigin }) => ({ kind, subjectIds, causalOrigin }))
    });
    const withoutHash = {
      id: architectureId(identityHash),
      key: candidate.key,
      title: candidate.title,
      question: candidate.question,
      scope: candidate.scope,
      sourceClass: candidate.sourceClass,
      status: "candidate",
      materiality: candidate.materiality,
      activationReasons,
      relatedConceptIds: [],
      relatedRequirementIds: sortedUnique(input.closure.entries.map(({ entityId }) => entityId).filter((id) => id.startsWith("requirement:"))),
      relevanceClosureId: input.closure.id,
      decisionIds: [],
      evidence: []
    };
    return ArchitectureConcernSchema.parse({ ...withoutHash, semanticHash: hashFramedDomain("architecture-concern", withoutHash) });
  });
  const normalizedUnknowns = sortedUnique(unknowns);
  return {
    concerns,
    unknowns: normalizedUnknowns,
    contentHash: hashFramedDomain("architecture-concern-discovery", { concerns, unknowns: normalizedUnknowns, closureHash: input.closure.contentHash })
  };
}

// node_modules/@projector/engine/dist/architecture/governance.js
var compareStrings2 = (left, right) => left < right ? -1 : left > right ? 1 : 0;
function normalizeDecisions(decisions) {
  const byId = /* @__PURE__ */ new Map();
  for (const raw of decisions) {
    const decision = ArchitectureDecisionSchema.parse(structuredClone(raw));
    if (decision.semanticHash !== hashSemantic("architecture-decision", decision))
      throw new Error(`decision ${decision.id} failed semantic authentication`);
    const existing = byId.get(decision.id);
    if (existing !== void 0 && canonicalJson(existing) !== canonicalJson(decision))
      throw new Error(`conflicting decision ${decision.id}`);
    byId.set(decision.id, decision);
  }
  return [...byId.values()].sort((left, right) => compareStrings2(left.id, right.id));
}
function authorityAllows(decision, record) {
  if (record === void 0)
    return `authority record ${decision.authorityRecordId} is missing`;
  if (record.subjectId !== decision.concernId)
    return `authority record ${record.id} is bound to another concern`;
  if (record.status !== "approved" && record.status !== "auto-approved")
    return `authority record ${record.id} is not active`;
  if (record.conclusion === "unknown" || record.conclusion === "exception")
    return `authority record ${record.id} does not authorize general decision activation`;
  if (record.decidedBy === "system" && record.status !== "auto-approved")
    return `system authority ${record.id} lacks auto-approval`;
  return void 0;
}
function dependencySccs(decisions) {
  const ids = new Set(decisions.map(({ id }) => id));
  const edges = new Map(decisions.map(({ id, consequences }) => [id, [...new Set(consequences.filter(({ kind, targetId }) => kind === "constrain-decision" && targetId !== void 0 && ids.has(targetId)).map(({ targetId }) => targetId))].sort(compareStrings2)]));
  const indices = /* @__PURE__ */ new Map();
  const low = /* @__PURE__ */ new Map();
  const stack = [];
  const onStack = /* @__PURE__ */ new Set();
  const groups = [];
  let nextIndex = 0;
  const visit = (id) => {
    indices.set(id, nextIndex);
    low.set(id, nextIndex);
    nextIndex += 1;
    stack.push(id);
    onStack.add(id);
    for (const target of edges.get(id) ?? []) {
      if (!indices.has(target)) {
        visit(target);
        low.set(id, Math.min(low.get(id), low.get(target)));
      } else if (onStack.has(target))
        low.set(id, Math.min(low.get(id), indices.get(target)));
    }
    if (low.get(id) !== indices.get(id))
      return;
    const group = [];
    while (stack.length > 0) {
      const member = stack.pop();
      onStack.delete(member);
      group.push(member);
      if (member === id)
        break;
    }
    group.sort(compareStrings2);
    if (group.length > 1 || (edges.get(group[0]) ?? []).includes(group[0]))
      groups.push(group);
  };
  for (const id of [...ids].sort(compareStrings2))
    if (!indices.has(id))
      visit(id);
  return groups.sort((left, right) => compareStrings2(canonicalJson(left), canonicalJson(right)));
}
async function acceptArchitectureDecisions(input, ports) {
  let decisions;
  let existingDecisions;
  try {
    decisions = normalizeDecisions(input.decisions);
    existingDecisions = normalizeDecisions(input.existingDecisions).filter(({ lifecycle }) => lifecycle === "active");
  } catch (error) {
    return { activated: false, code: "invalid-decision", reasons: [error instanceof Error ? error.message : "invalid architecture decision batch"] };
  }
  const authorityReasons = [];
  for (const decision of decisions) {
    const loaded = await ports.authority.read(decision.authorityRecordId);
    let record;
    try {
      record = loaded === void 0 ? void 0 : AuthorityRecordSchema.parse(structuredClone(loaded));
    } catch {
      authorityReasons.push(`authority record ${decision.authorityRecordId} failed schema authentication`);
      continue;
    }
    if (record !== void 0 && (record.id !== decision.authorityRecordId || !authorityRecordHashIsValid(record)))
      authorityReasons.push(`authority record ${decision.authorityRecordId} failed semantic authentication`);
    else {
      const reason = authorityAllows(decision, record);
      if (reason !== void 0)
        authorityReasons.push(reason);
    }
  }
  if (authorityReasons.length > 0)
    return { activated: false, code: "unauthorized-decision", reasons: authorityReasons.sort(compareStrings2) };
  for (const members of dependencySccs(decisions)) {
    const membersSet = new Set(members);
    const groupDecisions = decisions.filter(({ id }) => membersSet.has(id));
    const inputDigest = hashFramedDomain("decision-convergence-input", { members, decisions: groupDecisions });
    const proof = await ports.convergence.verify({ members, inputDigest, decisions: structuredClone(groupDecisions) });
    if (proof === void 0 || proof.status !== "converged" || proof.inputDigest !== inputDigest) {
      return { activated: false, code: "decision-convergence-failure", reasons: [`decision dependency SCC lacks fresh convergence proof: ${members.join(", ")}`] };
    }
  }
  const comparisons = [];
  for (let leftIndex = 0; leftIndex < decisions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < decisions.length; rightIndex += 1)
      comparisons.push([decisions[leftIndex], decisions[rightIndex]]);
  }
  for (const candidate of decisions) {
    for (const existing of existingDecisions)
      if (candidate.id !== existing.id)
        comparisons.push([candidate, existing]);
  }
  const overlapReasons = [];
  for (const [left, right] of comparisons) {
    const assessment = await ports.overlap.assess(structuredClone(left), structuredClone(right));
    if (assessment === "incompatible" || assessment === "unknown")
      overlapReasons.push(`${left.id} and ${right.id} have ${assessment} overlap compatibility`);
  }
  if (overlapReasons.length > 0)
    return { activated: false, code: "incompatible-decision-overlap", reasons: overlapReasons.sort(compareStrings2) };
  const consequences = decisions.flatMap(({ consequences: items }) => items).map((item) => structuredClone(item));
  const semanticHash = hashFramedDomain("semantic-governance-decision-batch", { decisions, consequences });
  try {
    await ports.transaction.transact({ decisions, consequences, semanticHash });
    return { activated: true, batchHash: semanticHash };
  } catch (error) {
    return { activated: false, code: "transaction-failure", reasons: [error instanceof Error ? error.message : "semantic governance transaction failed"] };
  }
}
function normalizeDecisionState(members, state) {
  const normalizedMembers = [...new Set(members)].sort(compareStrings2);
  if (normalizedMembers.length === 0)
    throw new Error("decision convergence group cannot be empty");
  const actual = Object.keys(state).sort(compareStrings2);
  if (canonicalJson(normalizedMembers) !== canonicalJson(actual))
    throw new Error("decision convergence state must contain exactly the SCC members");
  return Object.fromEntries(normalizedMembers.map((member) => [member, structuredClone(state[member])]));
}
function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value))
      deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}
async function convergeDecisionGroup(input, port) {
  if (!Number.isInteger(input.maxIterations) || input.maxIterations < 1)
    throw new Error("decision convergence maxIterations must be a positive integer");
  let current = normalizeDecisionState(input.members, input.initialState);
  let digest = hashFramedDomain("decision-convergence-state", current);
  const seen = /* @__PURE__ */ new Set([digest]);
  const fixedInputs = deepFreeze(structuredClone(input.fixedInputs));
  for (let iteration = 1; iteration <= input.maxIterations; iteration += 1) {
    const next = normalizeDecisionState(input.members, await port.evaluate({ previousState: deepFreeze(structuredClone(current)), fixedInputs, iteration }));
    const nextDigest = hashFramedDomain("decision-convergence-state", next);
    if (nextDigest === digest)
      return { status: "converged", digest: nextDigest, iterations: iteration, activatedState: next };
    if (seen.has(nextDigest))
      return { status: "decision-convergence-failure", digest: nextDigest, iterations: iteration, activatedState: void 0 };
    seen.add(nextDigest);
    current = next;
    digest = nextDigest;
  }
  return { status: "decision-convergence-failure", digest, iterations: input.maxIterations, activatedState: void 0 };
}

// node_modules/@projector/engine/dist/architecture/preflight.js
var compareStrings3 = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var riskRank = (risk) => ["R0", "R1", "R2", "R3", "R4"].indexOf(risk);
function authorizedOverride(concernId, raw) {
  const parsed = AuthorityRecordSchema.safeParse(raw);
  if (!parsed.success)
    return false;
  const record = parsed.data;
  return record.subjectId === concernId && record.status === "approved" && record.conclusion === "exception" && (record.decidedBy === "user" || record.decidedBy === "policy") && authorityRecordHashIsValid(record);
}
async function unresolvedBlockingConcern(concern, validity, input, ports) {
  if (concern.materiality !== "blocking-now" || concern.status === "resolved" || concern.status === "dismissed" || concern.status === "superseded")
    return false;
  if (concern.status === "deferred" && concern.deferral !== void 0 && (await assessDecisionDeferral(concern.deferral, ports.deferral)).valid)
    return false;
  const assessments = [];
  for (const assessment of validity.filter(({ decisionId }) => concern.decisionIds.includes(decisionId))) {
    if (await ports.validity.verify({ assessment: structuredClone(assessment), closure: structuredClone(input.closure) }))
      assessments.push(assessment);
  }
  return assessments.length === 0 || assessments.some(({ state, blocksCurrentChange }) => state !== "valid" || blocksCurrentChange);
}
async function runArchitecturePreflight(input, ports) {
  const unresolved = [];
  for (const concern of input.concerns)
    if (await unresolvedBlockingConcern(concern, input.validity, input, ports))
      unresolved.push(concern);
  unresolved.sort((left, right) => compareStrings3(left.id, right.id));
  const overrideRecords = [];
  for (const id of [...new Set(input.overrideAuthorityRecordIds)].sort(compareStrings3)) {
    const record = await ports.authority.read(id);
    if (record !== void 0 && record.id === id)
      overrideRecords.push(record);
  }
  const overriddenConcernIds = unresolved.filter((concern) => overrideRecords.some((record) => authorizedOverride(concern.id, record))).map(({ id }) => id);
  const unresolvedConcernIds = unresolved.map(({ id }) => id).filter((id) => !overriddenConcernIds.includes(id));
  const exploratory = input.mode === "observe" || input.mode === "guide";
  const policyBlocks = !exploratory && riskRank(input.risk) >= riskRank("R2") && unresolvedConcernIds.length > 0;
  const governedCompletion = unresolvedConcernIds.length === 0;
  const code = policyBlocks ? "unresolved-architecture-frontier" : governedCompletion ? "architecture-frontier-clear" : "exploration-only";
  const reasons = policyBlocks ? [`unresolved blocking architecture concerns: ${unresolvedConcernIds.join(", ")}`] : governedCompletion ? ["blocking architecture frontier is resolved, validly deferred, or explicitly overridden"] : ["exploratory work may continue but cannot claim governed completion"];
  const stable = { closureId: input.closure.id, unresolvedConcernIds, overriddenConcernIds, mode: input.mode, risk: input.risk, code, reasons };
  return {
    planningAllowed: !policyBlocks,
    governedCompletion,
    closureId: input.closure.id,
    unresolvedConcernIds,
    overriddenConcernIds,
    code,
    reasons,
    contentHash: hashFramedDomain("architecture-preflight", stable),
    mode: input.mode,
    risk: input.risk
  };
}
function explainArchitectureDecision(decision, validity) {
  if (decision.id !== validity.decisionId)
    throw new Error("decision explanation assessment identity mismatch");
  const reconsidered = validity.state !== "valid" || validity.firedTriggers.length > 0;
  const triggers = [...validity.firedTriggers].sort((left, right) => compareStrings3(canonicalJson(left), canonicalJson(right)));
  const detail = triggers.length === 0 ? validity.explanation : `${validity.explanation}; fired triggers: ${triggers.map(({ type }) => type).join(", ")}`;
  return {
    decisionId: decision.id,
    reconsidered,
    explanation: reconsidered ? `Decision ${decision.id} was reconsidered: ${detail}` : `Decision ${decision.id} was not reconsidered: ${detail}`,
    firedTriggers: triggers,
    staleEvidenceIds: [...new Set(validity.staleEvidenceIds)].sort(compareStrings3)
  };
}
function equivalenceKey(decision) {
  const normalized = normalizeDecisionSets(decision);
  return canonicalJson({
    concernId: normalized.concernId,
    decision: normalized.decision,
    selectedOptionKey: normalized.selectedOptionKey,
    scope: normalizeSelector(normalized.scope),
    lifecycle: normalized.lifecycle,
    consequences: normalized.consequences,
    appliedPreferences: normalized.appliedPreferences,
    migrationId: normalized.migrationId
  });
}
function canonicalSet(values) {
  return [...new Map(values.map((value) => [canonicalJson(value), structuredClone(value)])).entries()].sort(([left], [right]) => compareStrings3(left, right)).map(([, value]) => value);
}
function normalizeDecisionSets(decision) {
  return { ...structuredClone(decision), consequences: canonicalSet(decision.consequences), appliedPreferences: canonicalSet(decision.appliedPreferences) };
}
async function auditArchitectureDecisions(input, ports) {
  const byId = /* @__PURE__ */ new Map();
  for (const raw of input.decisions) {
    const decision = normalizeDecisionSets(raw);
    const existing = byId.get(decision.id);
    if (existing !== void 0 && canonicalJson(existing) !== canonicalJson(decision))
      throw new Error(`conflicting decision ${decision.id}`);
    byId.set(decision.id, decision);
  }
  const decisions = [...byId.values()].sort((left, right) => compareStrings3(left.id, right.id));
  const findings = [];
  const equivalentGroups = /* @__PURE__ */ new Map();
  for (const decision of decisions)
    equivalentGroups.set(equivalenceKey(decision), [...equivalentGroups.get(equivalenceKey(decision)) ?? [], decision]);
  for (const group of equivalentGroups.values())
    if (group.length > 1)
      findings.push({
        code: "equivalent-decisions",
        decisionIds: group.map(({ id }) => id),
        concernIds: [...new Set(group.map(({ concernId }) => concernId))].sort(compareStrings3),
        explanation: "decisions are semantically equivalent for the same concern and scope"
      });
  for (let leftIndex = 0; leftIndex < decisions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < decisions.length; rightIndex += 1) {
      const left = decisions[leftIndex];
      const right = decisions[rightIndex];
      const overlap = await ports.overlap.assess(structuredClone(left), structuredClone(right));
      if (overlap === "incompatible" || overlap === "unknown")
        findings.push({ code: "incompatible-decision-overlap", decisionIds: [left.id, right.id], concernIds: [.../* @__PURE__ */ new Set([left.concernId, right.concernId])].sort(compareStrings3), explanation: `${overlap} compatibility for overlapping decision scopes` });
    }
  }
  for (const decision of decisions) {
    const population = await ports.population.inspect(structuredClone(decision));
    if (!Number.isInteger(population.count) || population.count < 0)
      throw new Error(`invalid governed population for ${decision.id}`);
    if (population.count === 0 && population.observability === "closed")
      findings.push({ code: "stale-no-population", decisionIds: [decision.id], concernIds: [decision.concernId], explanation: "closed-world applicability query found no governed population" });
    else if (population.count === 0 && population.observability !== "closed")
      findings.push({ code: "population-unproven", decisionIds: [decision.id], concernIds: [decision.concernId], explanation: `${population.observability} observation cannot prove the governed population absent` });
  }
  for (const concern of input.concerns)
    if ((concern.status === "candidate" || concern.status === "active") && concern.materiality === "deferable" && concern.activationReasons.length === 0)
      findings.push({ code: "open-concern-without-value", decisionIds: [], concernIds: [concern.id], explanation: "deferable open concern has no current materiality reason" });
  findings.sort((left, right) => compareStrings3(canonicalJson(left), canonicalJson(right)));
  return { findings, contentHash: hashFramedDomain("architecture-decision-audit", findings) };
}

export {
  discoverArchitectureConcerns,
  acceptArchitectureDecisions,
  convergeDecisionGroup,
  runArchitecturePreflight,
  explainArchitectureDecision,
  auditArchitectureDecisions
};
