import {
  authorityRecordHashIsValid,
  createStateBinding
} from "./shared-HEBLUKDF.js";
import {
  AuthorityRecordSchema,
  canonicalJson,
  hashFramedDomain
} from "./shared-AJ5KBTH5.js";

// node_modules/@projector/engine/dist/coverage/snapshot.js
var REQUIRED_COVERAGE_LANES = [
  "inventory",
  "projection-unit-classification",
  "concept-mapping",
  "relationship",
  "lens",
  "rule-enforceability",
  "derivation",
  "validation-evidence",
  "surface",
  "authority",
  "historical-metamorphic",
  "architecture-decision",
  "semantic-identity",
  "pre-change-relevance",
  "representation-projection-fidelity",
  "change-closure",
  "planning-surprise"
];
var CLAIM_KINDS = {
  inventory: ["artifact-enumeration", "inventory-completeness", "inventory"],
  "projection-unit-classification": ["projection-unit", "classification", "structured-document", "stable-path", "artifact-content", "artifact-metadata", "symlink-target"],
  "concept-mapping": ["concept", "semantic-mapping"],
  relationship: ["relation", "dependency", "relationship", "module-resolution", "package-script-invocations", "source-relationships"],
  lens: ["lens", "recognition"],
  "rule-enforceability": ["rule", "validator"],
  derivation: ["derivation", "source-relationships"],
  "validation-evidence": ["validation", "evidence-lane"],
  surface: ["surface", "external-ownership"],
  authority: ["authority", "governance"],
  "historical-metamorphic": ["historical", "metamorphic", "introduction-history", "git-identity-and-moves"],
  "architecture-decision": ["architecture", "architecture-decision"],
  "semantic-identity": ["identity", "semantic-identity", "overlap", "git-identity-and-moves", "stable-path"],
  "pre-change-relevance": ["relevance", "event-topology", "public-contract-topology"],
  "representation-projection-fidelity": ["representation", "representation-projection", "markdown-structure", "protected-dimension", "structured-document", "stable-path", "document-parse", "duplicate-key"],
  "change-closure": ["change-closure", "impact"],
  "planning-surprise": ["planning-surprise", "predicted-impact", "observed-impact"]
};
var compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var unique = (values) => [...new Set(values)].sort(compare);
var normalizedPath = (value) => value.trim().replace(/\\/gu, "/").replace(/^\.\//u, "").replace(/\/+$/u, "") || ".";
var insideBoundary = (scope, boundary) => {
  const normalizedScope = normalizedPath(scope);
  return boundary.some((item) => {
    const normalized = normalizedPath(item);
    return normalized === "." || normalizedScope === normalized || normalizedScope.startsWith(`${normalized}/`);
  });
};
function normalizedBinding(binding) {
  const normalized = createStateBinding(binding);
  if (normalized.dependencyDigest !== binding.dependencyDigest)
    throw new Error("coverage StateBinding dependency digest is invalid");
  return normalized;
}
function requireCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`${label} must be a finite non-negative integer`);
}
function normalizeLane(raw, failures) {
  requireCount(raw.numerator, `${raw.key} numerator`);
  if (raw.denominator !== void 0) {
    requireCount(raw.denominator, `${raw.key} denominator`);
    if (raw.denominator > 0 && raw.numerator > raw.denominator)
      throw new Error(`${raw.key} numerator cannot exceed denominator`);
    if (raw.denominator === 0 && raw.numerator !== 0)
      throw new Error(`${raw.key} numerator must be zero when denominator is zero`);
  }
  if (!Number.isFinite(raw.confidence) || raw.confidence < 0 || raw.confidence > 1)
    throw new Error(`${raw.key} confidence must be within 0..1`);
  if (raw.applicability === "not-applicable" && (raw.boundaryExclusion === void 0 || raw.boundaryExclusion.trim() === "")) {
    throw new Error(`${raw.key} not-applicable evidence requires an explicit boundary exclusion`);
  }
  const assumptions = unique(raw.assumptions);
  const proven = new Set(raw.provenAssumptions);
  const blindSpots = unique(raw.blindSpots);
  const staleObservationIds = unique(raw.staleObservationIds);
  const claimKinds = new Set(CLAIM_KINDS[raw.key]);
  const analyzerFailures = [...failures].filter(({ capability, affectedClaimKinds }) => claimKinds.has(capability) || affectedClaimKinds.some((kind) => claimKinds.has(kind))).sort((left, right) => compare(canonicalJson(left), canonicalJson(right)));
  const requiredAssumptionsProven = assumptions.every((assumption) => proven.has(assumption));
  const exactClosureProvable = raw.applicability === "not-applicable" || raw.denominator !== void 0 && raw.numerator === raw.denominator && (raw.observability === "closed" || raw.observability === "bounded") && (raw.observability !== "bounded" || requiredAssumptionsProven) && blindSpots.length === 0 && analyzerFailures.length === 0 && staleObservationIds.length === 0;
  const lane = {
    key: raw.key,
    observability: raw.applicability === "not-applicable" ? "closed" : raw.observability,
    numerator: raw.applicability === "not-applicable" ? 0 : raw.numerator,
    ...raw.applicability === "not-applicable" ? { denominator: 0 } : raw.denominator === void 0 ? {} : { denominator: raw.denominator },
    confidence: raw.confidence,
    assumptions: raw.applicability === "not-applicable" ? unique([...assumptions, `boundary-exclusion:${raw.boundaryExclusion}`]) : assumptions,
    blindSpots,
    analyzerFailures,
    staleObservationIds,
    exactClosureProvable,
    applicability: raw.applicability,
    ...raw.boundaryExclusion === void 0 ? {} : { boundaryExclusion: raw.boundaryExclusion },
    ...raw.applicability === "required" && raw.denominator !== void 0 && raw.denominator > 0 ? { percentage: raw.numerator / raw.denominator * 100 } : {}
  };
  return lane;
}
function semanticCompletion(evidence) {
  const item = evidence.completion;
  return item.artifactsClassified && item.semanticMappingsResolved && item.identityDispositionsResolved && item.expectedProjectionsAccounted && item.relevanceNegativeSpaceProven && item.lensesAndRulesOperational && item.externalOwnershipAssigned && item.blockerIds.length === 0 && item.unknownUnitIds.length === 0 && item.validationIndependenceSatisfied && item.architectureFrontierIds.length === 0;
}
async function compileAuthenticatedCoverageSnapshot(input, ports) {
  if (!Number.isSafeInteger(input.graphRevision) || input.graphRevision < 0)
    throw new Error("coverage graph revision must be a non-negative integer");
  const boundary = unique(input.boundary.map((item) => item.trim()).filter(Boolean));
  if (boundary.length === 0)
    throw new Error("coverage boundary must not be empty");
  const requestedBinding = normalizedBinding(input.binding);
  const bindingValidation = await ports.bindingValidator.validate(requestedBinding, input.currentState, input.context);
  if (bindingValidation.status !== "current" && bindingValidation.status !== "rebound")
    throw new Error(`coverage binding is ${bindingValidation.status}`);
  const boundState = normalizedBinding(bindingValidation.status === "rebound" ? bindingValidation.rebound : requestedBinding);
  if (canonicalJson(boundState.compiledAgainst) !== canonicalJson(input.currentState))
    throw new Error("coverage binding is not compiled against current state");
  const evidence = await ports.evidence.observe({ boundary, currentState: input.currentState, context: input.context });
  if (canonicalJson(normalizedBinding(evidence.boundState)) !== canonicalJson(boundState))
    throw new Error("coverage evidence is not authenticated to the validated StateBinding");
  const byKey = /* @__PURE__ */ new Map();
  for (const raw of evidence.lanes) {
    if (!REQUIRED_COVERAGE_LANES.includes(raw.key))
      throw new Error(`unknown coverage lane ${raw.key}`);
    const normalizedRaw = { ...raw, assumptions: unique(raw.assumptions), provenAssumptions: unique(raw.provenAssumptions), blindSpots: unique(raw.blindSpots), staleObservationIds: unique(raw.staleObservationIds), ...raw.boundaryExclusion === void 0 ? {} : { boundaryExclusion: raw.boundaryExclusion.trim() } };
    const existing = byKey.get(raw.key);
    if (existing !== void 0 && canonicalJson(existing) !== canonicalJson(normalizedRaw))
      throw new Error(`conflicting coverage lane ${raw.key}`);
    byKey.set(raw.key, normalizedRaw);
  }
  const missing = REQUIRED_COVERAGE_LANES.filter((key) => !byKey.has(key));
  if (missing.length > 0 || byKey.size !== REQUIRED_COVERAGE_LANES.length)
    throw new Error(`coverage evidence must contain exactly 17 required lanes; missing: ${missing.join(", ")}`);
  const relevantFailures = evidence.analyzerFailures.filter((failure) => insideBoundary(failure.scope, boundary));
  for (const failure of relevantFailures) {
    const mapped = REQUIRED_COVERAGE_LANES.some((key) => {
      const claims = new Set(CLAIM_KINDS[key]);
      return claims.has(failure.capability) || failure.affectedClaimKinds.some((kind) => claims.has(kind));
    });
    if (!mapped)
      throw new Error(`analyzer failure ${failure.capability} omits all recognized dependent coverage claims`);
  }
  const laneReports = REQUIRED_COVERAGE_LANES.map((key) => normalizeLane(byKey.get(key), relevantFailures));
  const allExact = laneReports.every(({ exactClosureProvable }) => exactClosureProvable);
  const completeWithinBoundary = allExact && semanticCompletion(evidence) && evidence.unknownFrontierIds.length === 0 && evidence.unavailableSurfaceIds.length === 0;
  const anyUnavailable = laneReports.some(({ observability }) => observability === "unavailable") || evidence.unavailableSurfaceIds.length > 0;
  const anyIncompleteBoundary = laneReports.some(({ observability, exactClosureProvable }) => !exactClosureProvable || observability === "open" || observability === "sampled");
  const averageConfidence = laneReports.reduce((sum, { confidence }) => sum + confidence, 0) / laneReports.length;
  const proofStatement = completeWithinBoundary ? "proven-within-boundary" : anyUnavailable ? "not-established" : !anyIncompleteBoundary ? "bounded" : averageConfidence >= 0.8 ? "high-confidence" : "partial";
  const snapshot = {
    graphRevision: input.graphRevision,
    boundary,
    lanes: laneReports.map(({ percentage: _percentage, applicability: _applicability, boundaryExclusion: _boundaryExclusion, ...lane }) => lane),
    completeWithinBoundary,
    allowsBoundedAgentRepair: !anyUnavailable && evidence.completion.blockerIds.length === 0,
    unknownFrontierIds: unique([...evidence.unknownFrontierIds, ...evidence.completion.unknownUnitIds]),
    unavailableSurfaceIds: unique(evidence.unavailableSurfaceIds),
    proofStatement
  };
  return { snapshot, boundState, bindingValidation, laneReports };
}

// node_modules/@projector/engine/dist/coverage/questions.js
var RANKING_VERSION = "1";
var compare2 = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var unique2 = (values) => [...new Set(values)].sort(compare2);
function finite(value, label, allowZero = true) {
  if (!Number.isFinite(value) || value < 0 || !allowZero && value === 0)
    throw new Error(`${label} ${allowZero ? "must be finite and non-negative" : "cost must be finite and positive"}`);
}
function normalizeCandidate(candidate) {
  if (candidate.uncertaintyKey.trim() === "" || candidate.displayText.trim() === "")
    throw new Error("completion question uncertainty and display text must be nonblank");
  for (const [label, value] of Object.entries({ expectedUncertaintyReduction: candidate.expectedUncertaintyReduction, affectedUnitCount: candidate.affectedUnitCount, futureChangeFrequency: candidate.futureChangeFrequency, divergenceLeverage: candidate.divergenceLeverage, decisionReuse: candidate.decisionReuse, architectureMateriality: candidate.architectureMateriality }))
    finite(value, label);
  finite(candidate.userEffort, "user effort", false);
  finite(candidate.ambiguity, "ambiguity", false);
  finite(candidate.risk, "risk", false);
  return {
    uncertaintyKey: candidate.uncertaintyKey.trim(),
    kind: candidate.kind,
    displayText: candidate.displayText.trim(),
    scopeIds: unique2(candidate.scopeIds),
    evidenceDependencyIds: unique2(candidate.evidenceDependencyIds),
    rankingVersion: RANKING_VERSION,
    expectedUncertaintyReduction: candidate.expectedUncertaintyReduction,
    affectedUnitCount: candidate.affectedUnitCount,
    futureChangeFrequency: candidate.futureChangeFrequency,
    divergenceLeverage: candidate.divergenceLeverage,
    decisionReuse: candidate.decisionReuse,
    architectureMateriality: candidate.architectureMateriality,
    userEffort: candidate.userEffort,
    ambiguity: candidate.ambiguity,
    risk: candidate.risk
  };
}
function identitySemantic(question) {
  return { uncertaintyKey: question.uncertaintyKey, kind: question.kind, scopeIds: question.scopeIds, evidenceDependencyIds: question.evidenceDependencyIds, rankingVersion: question.rankingVersion };
}
function materiality(kind) {
  if (kind === "blocking-architecture")
    return 1e3;
  if (kind === "identity-fragmentation" || kind === "relevance-fragmentation")
    return 100;
  if (kind === "semantic")
    return 10;
  if (kind === "cleanup")
    return 1;
  return 0.01;
}
function rank(candidate) {
  const normalized = normalizeCandidate(candidate);
  const identity = identitySemantic(normalized);
  const idHash = hashFramedDomain("completion-question-identity", identity);
  const numerator = normalized.expectedUncertaintyReduction * Math.max(1, normalized.affectedUnitCount) * Math.max(1, normalized.futureChangeFrequency) * Math.max(1, normalized.divergenceLeverage) * Math.max(1, normalized.decisionReuse) * Math.max(1, normalized.architectureMateriality) * materiality(normalized.kind);
  const utility = numerator / (normalized.userEffort * normalized.ambiguity * normalized.risk);
  if (!Number.isFinite(utility))
    throw new Error("completion question utility must be finite");
  const semantic = { ...normalized, displayText: void 0, utilityInputs: { expectedUncertaintyReduction: normalized.expectedUncertaintyReduction, affectedUnitCount: normalized.affectedUnitCount, futureChangeFrequency: normalized.futureChangeFrequency, divergenceLeverage: normalized.divergenceLeverage, decisionReuse: normalized.decisionReuse, architectureMateriality: normalized.architectureMateriality, userEffort: normalized.userEffort, ambiguity: normalized.ambiguity, risk: normalized.risk } };
  return { ...normalized, id: `completion_question_${idHash.slice(-32)}`, contentHash: hashFramedDomain("completion-question", semantic), utility };
}
async function rankCompletionQuestions(candidates, input) {
  const currentBinding = createStateBinding(input.currentBinding);
  if (currentBinding.dependencyDigest !== input.currentBinding.dependencyDigest)
    throw new Error("completion ranking StateBinding is invalid");
  const questions = /* @__PURE__ */ new Map();
  for (const candidate of candidates) {
    const question = rank(candidate);
    const existing = questions.get(question.id);
    if (existing !== void 0 && existing.contentHash !== question.contentHash)
      throw new Error(`conflicting completion question identity ${question.id}`);
    questions.set(question.id, existing ?? question);
  }
  const unsettled = [];
  for (const question of questions.values()) {
    const answer = await authenticatedStoredAnswer(question, currentBinding, input.store, input.authority);
    if (answer === void 0)
      unsettled.push(question);
  }
  return unsettled.sort((left, right) => right.utility - left.utility || compare2(left.id, right.id));
}
var InMemorySettledAnswerStore = class {
  answers = /* @__PURE__ */ new Map();
  async read(questionId) {
    const answer = this.answers.get(questionId);
    return answer === void 0 ? [] : [structuredClone(answer)];
  }
  async compareAndStore(expectedRevision, answer, validateAtCommit) {
    await validateAtCommit();
    const current = this.answers.get(answer.questionId);
    if (current !== void 0 && canonicalJson(current) === canonicalJson(answer))
      return { status: "idempotent", answer: structuredClone(current) };
    if (current?.revision !== expectedRevision)
      return { status: "conflict" };
    this.answers.set(answer.questionId, structuredClone(answer));
    return { status: "stored", answer: structuredClone(answer) };
  }
};
function boundEvidence(question, binding) {
  const dependencies = [];
  for (const id of question.evidenceDependencyIds) {
    const value = binding.valueDependencies.find((item) => item.id === id);
    const query = binding.queryDependencies.find((item) => item.query.id === id || item.priorResult.dependencyKeys.includes(id));
    if (value === void 0 && query === void 0)
      throw new Error(`settled answer evidence dependency ${id} is absent from the authenticated StateBinding`);
    dependencies.push(value ?? query);
  }
  return { hash: hashFramedDomain("completion-question-bound-evidence", { evidenceDependencyIds: question.evidenceDependencyIds, questionContentHash: question.contentHash, bindingDependencyDigest: binding.dependencyDigest, dependencies }), dependencies };
}
var answerKeys = ["answer", "authorityRecordId", "authoritySemanticHash", "bindingDependencyDigest", "boundEvidenceHash", "contentHash", "id", "outcome", "questionContentHash", "questionId", "revision"];
function parseStoredAnswer(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw) || canonicalJson(Object.keys(raw).sort(compare2)) !== canonicalJson(answerKeys))
    throw new Error("stored settled answer is malformed");
  const item = raw;
  const strings = ["id", "questionId", "questionContentHash", "boundEvidenceHash", "outcome", "answer", "authorityRecordId", "authoritySemanticHash", "bindingDependencyDigest", "contentHash"];
  if (strings.some((key) => typeof item[key] !== "string" || item[key].trim() === "") || !Number.isSafeInteger(item.revision) || item.revision < 1 || !["approve", "alternative", "correction", "exception", "defer", "policy"].includes(item.outcome))
    throw new Error("stored settled answer is malformed");
  const semantic = { questionId: item.questionId, questionContentHash: item.questionContentHash, boundEvidenceHash: item.boundEvidenceHash, outcome: item.outcome, answer: item.answer, authorityRecordId: item.authorityRecordId, authoritySemanticHash: item.authoritySemanticHash, bindingDependencyDigest: item.bindingDependencyDigest, revision: item.revision };
  const contentHash = hashFramedDomain("settled-completion-answer", semantic);
  if (item.contentHash !== contentHash || item.id !== `settled_answer_${contentHash.slice(-32)}`)
    throw new Error("stored settled answer semantic hash is invalid");
  return raw;
}
function oneStoredAnswer(rows) {
  if (rows.length === 0)
    return void 0;
  const parsed = rows.map(parseStoredAnswer);
  if (parsed.some((item) => canonicalJson(item) !== canonicalJson(parsed[0])))
    throw new Error("conflicting stored settled answers");
  return parsed[0];
}
async function authenticatedStoredAnswer(question, binding, store, authorityPort) {
  const answer = oneStoredAnswer(await store.read(question.id));
  if (answer === void 0 || answer.questionContentHash !== question.contentHash || answer.bindingDependencyDigest !== binding.dependencyDigest)
    return void 0;
  if (answer.boundEvidenceHash !== boundEvidence(question, binding).hash)
    throw new Error("stored settled answer evidence authentication failed");
  const parsed = AuthorityRecordSchema.safeParse(await authorityPort.read(answer.authorityRecordId));
  if (!parsed.success)
    throw new Error("stored settled answer authority authentication failed");
  const authority = parsed.data;
  if (!authorityRecordHashIsValid(authority) || authority.semanticHash !== answer.authoritySemanticHash || authority.subjectId !== question.id || !["approved", "auto-approved"].includes(authority.status))
    throw new Error("stored settled answer authority authentication failed");
  return answer;
}
async function settleCompletionQuestion(input, ports) {
  if (input.answer.trim() === "")
    throw new Error("settled answer must not be blank");
  const reranked = rank(input.question);
  if (reranked.id !== input.question.id || reranked.contentHash !== input.question.contentHash)
    throw new Error("question contract or semantic hash is invalid");
  const normalizedBinding2 = createStateBinding(input.boundState);
  if (normalizedBinding2.dependencyDigest !== input.boundState.dependencyDigest)
    throw new Error("settled answer StateBinding is invalid");
  const validation = await ports.bindingValidator.validate(normalizedBinding2, input.currentState, input.context);
  if (validation.status !== "current" && validation.status !== "rebound")
    throw new Error(`settled answer binding is ${validation.status}`);
  const effectiveBinding = createStateBinding(validation.status === "rebound" ? validation.rebound : normalizedBinding2);
  if (canonicalJson(effectiveBinding.compiledAgainst) !== canonicalJson(input.currentState))
    throw new Error("settled answer rebound binding is not compiled against current state");
  const current = oneStoredAnswer(await ports.store.read(input.question.id));
  const boundEvidenceHash = boundEvidence(input.question, effectiveBinding).hash;
  const revision = current === void 0 ? 1 : current.revision + 1;
  const authorityRaw = await ports.authority.read(input.authorityRecordId);
  const parsed = AuthorityRecordSchema.safeParse(authorityRaw);
  if (!parsed.success)
    throw new Error("settled answer authority record is unavailable or invalid");
  const authority = parsed.data;
  if (!authorityRecordHashIsValid(authority) || authority.subjectId !== input.question.id || !["approved", "auto-approved"].includes(authority.status))
    throw new Error("settled answer authority proof is not approved for this question");
  if ((input.outcome === "exception" || input.outcome === "defer") && (ports.exceptional === void 0 || !await ports.exceptional.authenticate({ outcome: input.outcome, question: input.question, authority, boundState: effectiveBinding, answer: input.answer.trim() })))
    throw new Error(`${input.outcome} requires an authenticated exceptional-outcome contract`);
  const semantic = { questionId: input.question.id, questionContentHash: input.question.contentHash, boundEvidenceHash, outcome: input.outcome, answer: input.answer.trim(), authorityRecordId: authority.id, authoritySemanticHash: authority.semanticHash, bindingDependencyDigest: effectiveBinding.dependencyDigest, revision };
  const contentHash = hashFramedDomain("settled-completion-answer", semantic);
  const answer = { id: `settled_answer_${contentHash.slice(-32)}`, ...semantic, contentHash };
  if (current !== void 0 && current.questionContentHash === answer.questionContentHash && current.boundEvidenceHash === answer.boundEvidenceHash && current.outcome === answer.outcome && current.answer === answer.answer && current.authoritySemanticHash === answer.authoritySemanticHash)
    return current;
  if (current !== void 0 && input.outcome !== "correction")
    throw new Error("conflicting settled answer requires an explicit correction revision");
  const stored = await ports.store.compareAndStore(current?.revision, answer, async () => {
    const commitValidation = await ports.bindingValidator.validate(effectiveBinding, input.currentState, input.context);
    if (commitValidation.status !== "current")
      throw new Error(`settled answer binding changed before atomic commit: ${commitValidation.status}`);
    boundEvidence(input.question, effectiveBinding);
  });
  if (stored.status === "conflict")
    throw new Error("settled answer compare-and-store race conflict");
  return stored.answer ?? answer;
}

// node_modules/@projector/engine/dist/coverage/cleanup.js
var compare3 = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var unique3 = (values) => [...new Set(values)].sort(compare3);
function validateCost(value, label) {
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`${label} must be finite and non-negative`);
}
function createCleanupPlan(input) {
  if (input.key.trim() === "" || !Number.isSafeInteger(input.revision) || input.revision < 1)
    throw new Error("cleanup plan key and positive revision are required");
  const binding = createStateBinding(input.boundState);
  if (binding.dependencyDigest !== input.boundState.dependencyDigest)
    throw new Error("cleanup plan StateBinding is invalid");
  const completedWorkIds = unique3(input.completedWorkIds);
  const remaining = /* @__PURE__ */ new Map();
  for (const item of input.remainingWork) {
    if (item.id.trim() === "" || completedWorkIds.includes(item.id) || remaining.has(item.id))
      throw new Error(`conflicting cleanup work identity ${item.id}`);
    validateCost(item.tokenCost, `${item.id} token cost`);
    validateCost(item.monetaryCost, `${item.id} monetary cost`);
    remaining.set(item.id, { ...item });
  }
  const fields = {
    key: input.key.trim(),
    revision: input.revision,
    ...input.supersedesPlanId === void 0 ? {} : { supersedesPlanId: input.supersedesPlanId },
    boundState: binding,
    frontierIds: unique3(input.frontierIds),
    completedWorkIds,
    remainingWork: [...remaining.values()].sort((a, b) => compare3(a.id, b.id)),
    checkpoints: [...input.checkpoints].map((item) => ({ ...item, afterWorkIds: unique3(item.afterWorkIds), requiredValidators: unique3(item.requiredValidators) })).sort((a, b) => compare3(a.id, b.id)),
    assumptions: unique3(input.assumptions),
    externalActions: [...input.externalActions].sort((a, b) => compare3(a.id, b.id)),
    approvalIds: unique3(input.approvalIds ?? []),
    ...input.recommendedNextChunk === void 0 ? {} : { recommendedNextChunk: input.recommendedNextChunk }
  };
  const contentHash = hashFramedDomain("cleanup-continuation-plan", fields);
  return { id: input.id ?? `cleanup_plan_${hashFramedDomain("cleanup-continuation-plan-identity", { key: fields.key, revision: fields.revision, contentHash }).slice(-32)}`, ...fields, contentHash };
}
var InMemoryCleanupPlanStore = class {
  plans = /* @__PURE__ */ new Map();
  reservations = /* @__PURE__ */ new Map();
  async lookupAuthenticated(selector) {
    return [...this.plans.values()].filter((plan) => plan.id === selector || plan.key === selector).map((plan) => structuredClone(plan)).sort((a, b) => b.revision - a.revision);
  }
  async compareAndStore(expectedRevision, plan) {
    const existing = this.plans.get(plan.id);
    if (existing !== void 0)
      return canonicalJson(existing) === canonicalJson(plan) ? "idempotent" : "conflict";
    const latest = [...this.plans.values()].filter(({ key }) => key === plan.key).sort((a, b) => b.revision - a.revision)[0];
    if (latest?.revision !== expectedRevision || latest !== void 0 && [...this.reservations.values()].some((item) => item.planId === latest.id))
      return "conflict";
    this.plans.set(plan.id, structuredClone(plan));
    return "stored";
  }
  async reserve(expectedRevision, plan, workIds) {
    const latest = [...this.plans.values()].filter(({ key }) => key === plan.key).sort((a, b) => b.revision - a.revision)[0];
    if (latest?.id !== plan.id || latest.revision !== expectedRevision || [...this.reservations.values()].some((item) => item.planId === plan.id))
      return { status: "conflict" };
    const normalizedWorkIds = unique3(workIds);
    const reservationId = `cleanup_reservation_${hashFramedDomain("cleanup-work-reservation", { planId: plan.id, revision: plan.revision, workIds: normalizedWorkIds }).slice(-32)}`;
    this.reservations.set(reservationId, { planId: plan.id, revision: plan.revision, workIds: normalizedWorkIds });
    return { status: "reserved", reservationId };
  }
  async commitReservation(reservationId, plan) {
    const reservation = this.reservations.get(reservationId);
    const latest = reservation === void 0 ? void 0 : [...this.plans.values()].filter(({ key }) => key === plan.key).sort((a, b) => b.revision - a.revision)[0];
    if (reservation === void 0 || latest?.id !== reservation.planId || latest.revision !== reservation.revision || plan.revision !== reservation.revision + 1 || plan.supersedesPlanId !== reservation.planId || reservation.workIds.some((id) => !plan.completedWorkIds.includes(id) || plan.remainingWork.some((item) => item.id === id)))
      return "conflict";
    this.plans.set(plan.id, structuredClone(plan));
    this.reservations.delete(reservationId);
    return "stored";
  }
};
async function resumeCleanupPlan(input, ports) {
  validateCost(input.budget.tokens, "cleanup token budget");
  validateCost(input.budget.cost, "cleanup cost budget");
  if (input.budget.tokens === 0 || input.budget.cost === 0)
    throw new Error("cleanup budgets must be positive");
  const matches = await ports.store.lookupAuthenticated(input.selector);
  if (matches.length === 0)
    throw new Error(`cleanup plan selector ${input.selector} is missing`);
  if (matches.length > 1)
    throw new Error(`cleanup plan selector ${input.selector} is ambiguous`);
  const storedPlan = matches[0];
  let plan = createCleanupPlan(storedPlan);
  if (plan.id !== storedPlan.id || plan.contentHash !== storedPlan.contentHash)
    throw new Error("cleanup store returned a plan with invalid authenticated identity or content hash");
  const validation = await ports.bindingValidator.validate(plan.boundState, input.currentState, input.context);
  let rebaseKind;
  let reboundBinding;
  if (validation.status === "stale") {
    if (ports.recompile === void 0)
      throw new Error("stale cleanup plan requires semantic rebase before resume");
    const recomputed = await ports.recompile(plan, input.currentState);
    const { id: _recomputedId, ...recomputedFields } = recomputed;
    plan = createCleanupPlan({ ...recomputedFields, revision: plan.revision + 1, supersedesPlanId: plan.id, approvalIds: [] });
    if (canonicalJson(plan.boundState.compiledAgainst) !== canonicalJson(input.currentState))
      throw new Error("semantic cleanup rebase is not bound to current state");
    if (await ports.store.compareAndStore(plan.revision - 1, plan) === "conflict")
      throw new Error("cleanup semantic rebase compare-and-store conflict");
    rebaseKind = "semantic-rebase";
  } else if (validation.status === "suspect" || validation.status === "unavailable")
    throw new Error(`cleanup plan state is ${validation.status}`);
  else if (validation.status === "rebound") {
    if (validation.rebound === void 0)
      throw new Error("cleanup lightweight rebind lacks authenticated StateBinding");
    reboundBinding = validation.rebound;
  }
  const progress = await ports.progress.authenticate(plan);
  if (progress.boundDependencyDigest !== plan.boundState.dependencyDigest)
    throw new Error("cleanup progress proof is bound to different state dependencies");
  const completed = unique3(progress.completedWorkIds);
  const remainingIds = unique3(progress.remainingWorkIds);
  const allWork = unique3([...plan.completedWorkIds, ...plan.remainingWork.map(({ id }) => id)]);
  if (completed.some((id) => remainingIds.includes(id)) || canonicalJson(unique3([...completed, ...remainingIds])) !== canonicalJson(allWork))
    throw new Error("cleanup progress proof must account for every work item exactly once");
  if (plan.completedWorkIds.some((id) => !completed.includes(id)))
    throw new Error("previously completed cleanup work lost authenticated progress and requires semantic rebase");
  if (remainingIds.length === 0)
    return { kind: "no-op", plan, executedWorkIds: [], authenticatedCompletedWorkIds: completed, authenticatedRemainingWorkIds: [], budgetExhausted: false, continuationPersisted: true };
  if (reboundBinding !== void 0) {
    const { id: _oldId2, contentHash: _oldHash2, ...planFields2 } = plan;
    const rebound = createCleanupPlan({ ...planFields2, revision: plan.revision + 1, supersedesPlanId: plan.id, boundState: reboundBinding, approvalIds: [] });
    if (await ports.store.compareAndStore(plan.revision, rebound) === "conflict")
      throw new Error("cleanup lightweight rebind compare-and-store conflict");
    plan = rebound;
    rebaseKind = "rebound";
  }
  const byId = new Map(plan.remainingWork.map((item) => [item.id, item]));
  let tokens = 0;
  let cost = 0;
  const selected = [];
  for (const id of remainingIds) {
    const item = byId.get(id);
    if (item === void 0)
      continue;
    if (tokens + item.tokenCost > input.budget.tokens || cost + item.monetaryCost > input.budget.cost)
      continue;
    selected.push(id);
    tokens += item.tokenCost;
    cost += item.monetaryCost;
  }
  if (selected.length === 0)
    return { kind: rebaseKind ?? "no-op", plan, executedWorkIds: [], authenticatedCompletedWorkIds: completed, authenticatedRemainingWorkIds: remainingIds, budgetExhausted: true, continuationPersisted: true };
  const prospectiveCompleted = unique3([...completed, ...selected]);
  for (const checkpoint of plan.checkpoints.filter(({ afterWorkIds }) => afterWorkIds.every((id) => prospectiveCompleted.includes(id)))) {
    if (checkpoint.requiredValidators.length === 0)
      continue;
    if (ports.checkpoints === void 0)
      throw new Error(`cleanup checkpoint ${checkpoint.id} validator proof is unavailable`);
    const results = await ports.checkpoints.validate({ plan, checkpoint, selectedWorkIds: selected });
    const byValidator = new Map(results.map((result) => [result.validatorId, result.status]));
    if (checkpoint.requiredValidators.some((id) => byValidator.get(id) !== "passed"))
      throw new Error(`cleanup checkpoint ${checkpoint.id} required validator did not pass`);
  }
  const reservation = await ports.store.reserve(plan.revision, plan, selected);
  if (reservation.status === "conflict")
    throw new Error("cleanup durable work reservation conflict");
  const execution = await ports.runChunk(selected);
  if (canonicalJson(unique3(execution.completedWorkIds)) !== canonicalJson(unique3(selected)))
    throw new Error("cleanup chunk did not authenticate completion of exactly the selected work");
  const nextCompleted = unique3([...completed, ...execution.completedWorkIds]);
  const nextRemaining = plan.remainingWork.filter(({ id }) => !nextCompleted.includes(id));
  const { id: _oldId, contentHash: _oldHash, ...planFields } = plan;
  const next = createCleanupPlan({ ...planFields, revision: plan.revision + 1, supersedesPlanId: plan.id, completedWorkIds: nextCompleted, remainingWork: nextRemaining, externalActions: [...plan.externalActions, ...execution.externalActions], approvalIds: [], ...nextRemaining[0] === void 0 ? {} : { recommendedNextChunk: nextRemaining[0].id } });
  const stored = await ports.store.commitReservation(reservation.reservationId, next);
  if (stored === "conflict")
    throw new Error("cleanup continuation reservation commit conflict");
  return { kind: rebaseKind ?? "advanced", plan: next, executedWorkIds: unique3(selected), authenticatedCompletedWorkIds: nextCompleted, authenticatedRemainingWorkIds: nextRemaining.map(({ id }) => id), budgetExhausted: nextRemaining.length > 0, continuationPersisted: true };
}

// node_modules/@projector/engine/dist/coverage/metrics.js
function ratio(numerator, denominator, caveat) {
  if (numerator !== void 0 && (!Number.isSafeInteger(numerator) || numerator < 0))
    throw new Error("coverage quality metric numerator must be a non-negative integer");
  if (denominator !== void 0 && (!Number.isSafeInteger(denominator) || denominator < 0))
    throw new Error("coverage quality metric denominator must be a non-negative integer");
  if (numerator === void 0 || denominator === void 0 || denominator === 0)
    return { availability: "unavailable", caveat };
  if (numerator > denominator)
    throw new Error("coverage quality metric numerator cannot exceed denominator");
  return { availability: "available", numerator, denominator, value: numerator / denominator, caveat };
}
function computeCoverageQualityMetrics(input) {
  const retrieved = new Set(input.relevance.retrievedIds);
  const relevant = input.relevance.relevantIds === void 0 ? void 0 : new Set(input.relevance.relevantIds);
  const relevanceRecall = relevant === void 0 ? ratio(void 0, void 0, "relevance ground truth unavailable") : ratio([...relevant].filter((id) => retrieved.has(id)).length, relevant.size, "supported recall within declared relevance ground truth");
  const irrelevantExpansion = relevant === void 0 ? ratio(void 0, void 0, "relevance ground truth unavailable") : ratio([...retrieved].filter((id) => !relevant.has(id)).length, retrieved.size, "retrieved entities outside declared relevant set");
  const observed = input.planning.observedIds === void 0 ? void 0 : new Set(input.planning.observedIds);
  const predicted = new Set(input.planning.predictedIds);
  const planningSurpriseRate = observed === void 0 ? ratio(void 0, void 0, "observed implementation impact unavailable") : ratio([...observed].filter((id) => !predicted.has(id)).length, observed.size, `surprise dispositions: ${[...new Set(input.planning.surpriseDispositions)].sort().join(", ") || "none"}`);
  const analyzerFailureRate = ratio(input.analyzers.failureCount, input.analyzers.observationCount, "analyzer failures per authenticated observation attempt");
  return { relevanceRecall, irrelevantExpansion, planningSurpriseRate, analyzerFailureRate, caveats: [relevanceRecall, irrelevantExpansion, planningSurpriseRate, analyzerFailureRate].filter(({ availability }) => availability === "unavailable").map(({ caveat }) => caveat) };
}

export {
  REQUIRED_COVERAGE_LANES,
  compileAuthenticatedCoverageSnapshot,
  rankCompletionQuestions,
  InMemorySettledAnswerStore,
  settleCompletionQuestion,
  createCleanupPlan,
  InMemoryCleanupPlanStore,
  resumeCleanupPlan,
  computeCoverageQualityMetrics
};
