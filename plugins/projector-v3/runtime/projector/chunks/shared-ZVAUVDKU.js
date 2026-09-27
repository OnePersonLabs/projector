import { createRequire as __projectorCreateRequire } from "node:module"; const require = __projectorCreateRequire(import.meta.url);
import {
  RepositoryContinuationSchema,
  createKnowledgeComputeHostHandler
} from "./shared-7TU7H6FV.js";
import {
  observeChangeRepository
} from "./shared-JZDJZQHJ.js";
import {
  KnowledgeApplicationEvidenceAssessmentSchema,
  applicationEvidenceDependencies,
  applicationEvidenceDisposition,
  assessmentKey
} from "./shared-UF33E7SL.js";
import {
  KnowledgeGraph,
  assessKnowledgeDecisions
} from "./shared-E2ZEUURS.js";
import {
  runObservationTask
} from "./shared-HODAXZKW.js";
import {
  withObservationScope
} from "./shared-3WNQLUKU.js";
import {
  assessLensAuthority,
  isHardRule
} from "./shared-FZTNE5ZL.js";
import {
  REQUIRED_COVERAGE_LANES,
  compileAuthenticatedCoverageSnapshot
} from "./shared-RWHW46VO.js";
import {
  createStateBinding,
  normalizeSelector,
  validateDecisionDeferral
} from "./shared-ZKECJVYF.js";
import {
  AnalyzerFailureSchema,
  CompletionAssessmentSchema,
  CompletionRepairAlternativeSchema,
  CompletionRepairRouteSchema,
  ContentHashSchema,
  CoverageLaneSchema,
  CoverageSnapshotSchema,
  StateBindingSchema,
  StateBindingValidationSchema,
  canonicalJson,
  external_exports,
  hashFramedDomain
} from "./shared-6VIFAIKJ.js";

// node_modules/@projector/control-plane/dist/coverage/issues.js
function completionRepairAlternatives(route, transforms, observedValidators = [], generatedOutput = false) {
  const supported = transforms.filter((id) => id === "exact-text-patch@1");
  const unsupported = transforms.filter((id) => id !== "exact-text-patch@1");
  return [
    { strategy: "reuse", status: "skipped", reason: "Current evidence leaves this obligation unresolved; no reusable satisfying result was established.", capabilityIds: [] },
    { strategy: "revalidate", status: observedValidators.length > 0 ? "available" : "unavailable", reason: observedValidators.length > 0 ? "Current governance findings were evaluated by the supported built-in static dependency validator. Rerun bounded completion after repair; availability does not imply satisfaction." : "This finding establishes no executable validator capability. Inspect context to identify a supported validator.", capabilityIds: [...observedValidators] },
    { strategy: "regenerate", status: "unavailable", reason: generatedOutput ? "Generated output is affected. Inspect its upstream source and generator first; regeneration remains unavailable until an executable lifecycle generator is registered." : "No lifecycle generator for this obligation is established.", capabilityIds: [] },
    { strategy: "deterministic-patch", status: !generatedOutput && route === "implementation-repair" && supported.length > 0 ? "available" : "unavailable", reason: generatedOutput ? "Generated output is affected. Do not patch the output directly; inspect its upstream source and generator first. No registered regeneration path is established." : supported.length > 0 && route === "implementation-repair" ? "The lifecycle compiler and executor support exact-text-patch@1. A concrete state-bound patch, review and approval are still required." : unsupported.length > 0 ? `Advertised bindings ${unsupported.join(", ")} are not supported by the lifecycle executor; no transform substitution is inferred.` : "No applicable deterministic transform binding is established.", capabilityIds: [...supported, ...unsupported] },
    { strategy: "agent-repair", status: "unavailable", reason: "This read-only inspection has no authenticated agent repair executor. Ordinary implementation repair can preserve accepted meaning without canonical revision.", capabilityIds: [] },
    { strategy: "widen-analysis", status: "available", reason: "The context command can inspect named owners and targets. Wider observation requires a new bounded request.", capabilityIds: ["context"] },
    { strategy: "human-decision", status: "available", reason: route === "canonical-proposal" ? "An accepted meaning change requires an explicit canonical proposal through capture, review, approve and apply." : "Choose implementation repair or collect missing evidence while preserving accepted meaning. Only an explicit meaning change uses a canonical proposal.", capabilityIds: ["context", "capture", "review", "approve", "apply"] }
  ];
}
var unique = (values) => [...new Set(values)].sort();
var normalize = (value) => value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
function deriveCompletionQuestions(input) {
  const { graph, unitIds } = input;
  const questions = [];
  const paths = new Map(graph.units.map((unit) => [unit.id, unit.key]));
  const lensesById = new Map(graph.lenses.map((lens) => [String(lens.id), lens]));
  const observedPredicates = new Set(input.evaluations.flatMap(({ lensId, evaluation }) => evaluation.findings.filter(({ status }) => status !== "unknown").map(({ ruleId, predicateHash }) => `${lensId}\0${ruleId}\0${predicateHash}`)));
  const members = (id) => unique(graph.implementationBindings(id).map((item) => String(item.id)).filter((unitId) => unitIds.has(unitId)));
  const add = (kind, owners, subjects, blocking, question, reasons, facts, targets = [], assessment) => {
    const ownerIds = unique(owners);
    const subjectIds = unique(subjects);
    const generatedOutputs = graph.units.filter((unit) => subjectIds.includes(unit.id) && (unit.tags.includes("generated") || unit.generatedFromUnitIds.length > 0));
    const generatedOutputEvidence = generatedOutputs.map((unit) => ({ id: unit.id, key: unit.key, origin: unit.causalOrigin, generatedFromUnitIds: unit.generatedFromUnitIds }));
    const generatedOutputReason = "Generated output is affected. Inspect its upstream source and generator first. Regeneration is unavailable until an executable lifecycle generator is registered; do not patch the output directly.";
    const reportedReasons = generatedOutputs.length > 0 ? [...unique(reasons.filter((reason) => reason !== generatedOutputReason)).slice(0, 4), generatedOutputReason] : unique(reasons);
    const disposition = assessment ?? { status: "unknown", category: kind.startsWith("unrealized-") ? "unrealized-behavior" : kind === "realization-binding" ? "missing-evidence" : "meaning-gap" };
    const route = disposition.category === "conflicting-rules" ? "canonical-proposal" : disposition.status === "violated" || disposition.category === "unrealized-behavior" ? "implementation-repair" : ["missing-evidence", "missing-validator", "unreachable-selector"].includes(disposition.category) ? "missing-evidence" : "canonical-proposal";
    const ownerLenses = ownerIds.flatMap((id) => lensesById.has(id) ? [lensesById.get(id)] : []);
    const transforms = unique(ownerLenses.flatMap((lens) => lens.transforms.map(({ id, version }) => `${id}@${version}`)));
    const observedValidators = unique(ownerLenses.flatMap((lens) => lens.rules.filter(({ id, predicates }) => ownerIds.includes(id) && predicates.length > 0 && predicates.every((predicate) => predicate.kind === "dependency-forbidden" || predicate.kind === "dependency-allowed") && predicates.some((predicate) => (predicate.kind === "dependency-forbidden" || predicate.kind === "dependency-allowed") && observedPredicates.has(`${lens.id}\0${id}\0${hashFramedDomain("governance-predicate", { ...predicate, from: normalizeSelector(predicate.from), to: normalizeSelector(predicate.to) })}`))).flatMap(({ validatorIds }) => validatorIds.filter((id) => id === "projector.builtin.static-dependency-boundary@1"))));
    const subjectHashes = unique([...ownerIds, ...subjectIds]).map((id) => ({ id, semanticHash: graph.semanticHash(id) ?? null, sourceHash: graph.sourceHash(id) ?? null }));
    questions.push({
      id: `completion_question_${hashFramedDomain("completion-question-identity", { kind, ownerIds }).slice(-32)}`,
      kind,
      blocking,
      ownerIds,
      affectedCount: subjectIds.filter((id) => unitIds.has(id)).length,
      subjectCount: subjectIds.length,
      examples: subjectIds.slice(0, 5).map((id) => paths.get(id) ?? id),
      question,
      reasons: reportedReasons.slice(0, 5),
      reasonCount: unique([...reasons, ...generatedOutputs.length > 0 ? [generatedOutputReason] : []]).length,
      assessment: disposition,
      evidenceHash: hashFramedDomain("completion-question-evidence", { kind, ownerIds, subjectHashes, subjectIds, facts, generatedOutputEvidence, disposition, transforms }),
      resolution: {
        context: { command: "context", request: question, entities: ownerIds.filter((id) => graph.entitiesById.has(id)), namedTargets: unique(targets) },
        route,
        alternatives: completionRepairAlternatives(route, transforms, observedValidators, generatedOutputs.length > 0),
        instruction: route === "canonical-proposal" ? "Inspect current context and explicitly propose any accepted meaning change through capture, review, approve and apply. Rerun completion against changed facts." : "Preserve accepted meaning. Repair the implementation or collect the missing evidence, then rerun completion. A meaning change requires a separate explicit canonical proposal. No repair is executed by this report."
      }
    });
  };
  for (const problem of input.authorityProblems)
    add("governance", [problem.authorityId, problem.ownerId], members(problem.ownerId), true, `What accepted authority and executable obligations govern ${problem.ownerId}?`, problem.reasons, problem, [], { status: "unknown", category: "authority-problem" });
  const grouped = /* @__PURE__ */ new Map();
  for (const { lensId, evaluation } of input.evaluations) {
    const lens = graph.lenses.find(({ id }) => id === lensId);
    for (const finding of evaluation.findings.filter(({ status }) => status !== "satisfied")) {
      const owners = [lens.authorityRecordId, lensId, finding.ruleId];
      const key = canonicalJson(owners);
      const group = grouped.get(key) ?? { owners, subjects: [], findings: [] };
      group.subjects.push(evaluation.unitId);
      group.findings.push(finding);
      grouped.set(key, group);
    }
  }
  for (const { owners, subjects, findings } of grouped.values())
    add("governance", owners, subjects, true, `How should ${owners[2]} be satisfied or canonically revised?`, findings.map(({ reason }) => reason), { findings, governedMembership: graph.implementationBindings(owners[1]) }, [], { status: findings.some(({ status }) => status === "violated") ? "violated" : "unknown", category: owners[2].includes(",") ? "conflicting-rules" : findings.some(({ reason }) => reason.startsWith("Validator ")) ? "missing-validator" : findings.some(({ status }) => status === "violated") ? "rule-violation" : "missing-evidence" });
  for (const decision of input.decisions.filter(({ assessment }) => assessment.blocksCurrentChange))
    add("governance", [decision.authorityId, decision.decisionId], members(decision.decisionId), true, `Should ${decision.decisionId} be reaffirmed or revised against its current evidence?`, [decision.assessment.explanation, ...decision.checks.filter(({ status }) => status === "fired" || status === "unknown").map(({ reason }) => reason)], decision);
  for (const lens of graph.lenses.filter(({ status }) => status === "active")) {
    const subjects = members(lens.id);
    if (!input.includeUnrealized && subjects.length === 0)
      continue;
    if (input.includeUnrealized && graph.lensCompilation !== void 0 && (graph.lensCompilation.memberships[lens.id] ?? []).length === 0)
      add("governance", [lens.authorityRecordId, lens.id, `selector:${lens.id}`], [], false, `Does the selector for ${lens.key} reach its intended implementation?`, ["The compiled selector selects no units in the finite observed inventory. This does not prove that the selector is logically unreachable or that future units cannot match."], { selector: lens.selector, membershipFingerprint: graph.lensCompilation.membershipFingerprints[lens.id] }, [], { status: "unknown", category: "unreachable-selector" });
    for (const transform of lens.transforms.filter(({ id, version }) => `${id}@${version}` !== "exact-text-patch@1"))
      add("governance", [lens.authorityRecordId, lens.id, `transform:${transform.id}@${transform.version}`], subjects, false, `How can ${transform.id}@${transform.version} repair the governed implementation?`, ["The lens advertises this transform, but the repository lifecycle compiler and executor do not dispatch it. Runtime primitives with different identifiers do not establish this binding's availability."], transform, [], { status: "unavailable", category: "missing-evidence" });
    for (const rule of lens.rules.filter((rule2) => isHardRule(rule2) && rule2.predicates.length === 0 && rule2.validatorIds.length === 0))
      add("governance", [lens.authorityRecordId, lens.id, rule.id], subjects, true, `What executable predicate or validator establishes ${rule.key}?`, ["This non-advisory rule declares neither a predicate nor a validator. Prose alone does not establish executable satisfaction."], rule, [], { status: "unavailable", category: "missing-validator" });
  }
  for (const evidence of input.applicationEvidence ?? []) {
    const status = evidence.status === "unavailable" ? "unavailable" : evidence.assessment.fulfillment.status;
    if (status === "satisfied")
      continue;
    add("governance", [evidence.owner.id, `application-evidence:${hashFramedDomain("completion-application-binding", evidence.binding)}`], members(evidence.owner.id), true, `What current observation demonstrates the accepted behavior of ${evidence.owner.id}?`, [evidence.status === "unavailable" ? evidence.reason : evidence.assessment.fulfillment.reason], evidence, [], { status, category: status === "violated" ? "unrealized-behavior" : "missing-evidence" });
  }
  const meanings = graph.entities.filter(({ kind, accepted, payload }) => accepted && ["concept", "requirement", "scenario"].includes(kind) && "status" in payload && payload.status === "active");
  for (const entity of meanings) {
    const failed = graph.observation.realizations.filter(({ entityId, status }) => entityId === entity.id && status !== "matched");
    if (failed.length > 0 && (input.includeUnrealized || members(entity.id).length > 0))
      add("realization-binding", [entity.id], members(entity.id), false, `Which observed implementation should the declared realizations of ${entity.key} identify?`, failed.map(({ bindingIndex, reason }) => `Realization ${bindingIndex}: ${reason}`), failed, [], { status: failed.some(({ status }) => status === "unsupported" || status === "unavailable") ? "unavailable" : "unknown", category: "missing-evidence" });
  }
  const mapped = new Set(meanings.flatMap(({ id }) => members(id)));
  const groups = /* @__PURE__ */ new Map();
  for (const unit of graph.units.filter(({ id }) => unitIds.has(id) && !mapped.has(id))) {
    const parts = unit.key.split("/");
    parts.pop();
    const group = parts.join("/") || ".";
    groups.set(group, [...groups.get(group) ?? [], unit.id]);
  }
  for (const [group, subjects] of groups)
    add("unmapped-group", [`repository-group:${group}`], subjects, false, `Which accepted meaning owns the unmapped files in ${group}?`, ["Observed files have no active canonical concept, requirement, or scenario membership. A scope mapping records ownership, not behavioral satisfaction."], { group }, [group]);
  for (const entity of meanings.filter(({ kind, id }) => kind === "requirement" && graph.implementationBindings(id).length === 0 && input.includeUnrealized))
    add("unrealized-requirement", [entity.id], [entity.id], false, `What implementation should realize ${entity.key}?`, ["The active requirement has no observed implementation members. Preserve its accepted meaning while choosing implementation or an explicit canonical revision."], entity.payload);
  for (const entity of meanings.filter(({ kind, id }) => kind === "scenario" && graph.implementationBindings(id).length === 0 && input.includeUnrealized))
    add("unrealized-scenario", [entity.id], [entity.id], false, `What implementation and evidence should demonstrate ${entity.key}?`, ["The active scenario has no observed implementation members. Preserve its accepted trigger and outcomes while choosing implementation and validation or an explicit canonical revision. Membership alone does not prove these outcomes."], entity.payload);
  const claims = /* @__PURE__ */ new Map();
  for (const entity of meanings)
    for (const claim of unique([entity.id, entity.key, ...entity.aliases].map(normalize))) {
      const key = `${entity.kind}:${claim}`;
      claims.set(key, unique([...claims.get(key) ?? [], entity.id]));
    }
  const collisions = /* @__PURE__ */ new Map();
  for (const [claim, owners] of claims)
    if (owners.length > 1) {
      const key = canonicalJson(owners);
      const group = collisions.get(key) ?? { owners, claims: [] };
      group.claims.push(claim);
      collisions.set(key, group);
    }
  for (const { owners, claims: addresses } of collisions.values())
    if (input.includeUnrealized || owners.some((id) => members(id).length > 0))
      add("identity-overlap", owners, unique(owners.flatMap(members)), true, `Which accepted identities should own the overlapping addresses ${addresses.join(", ")}?`, ["Exact accepted keys or aliases overlap. This is an address ambiguity, not proof that the meanings are equivalent; preserve distinctions or record explicit canonical lineage."], { addresses });
  for (const entity of graph.entities.filter(({ kind }) => kind === "architecture-concern")) {
    const concern = entity.payload;
    if (concern.sourceClass !== "authored" || concern.materiality !== "blocking-now" || ["candidate", "dismissed", "superseded"].includes(concern.status))
      continue;
    const subjects = members(concern.id);
    if (!input.includeUnrealized && subjects.length === 0)
      continue;
    const selected = input.decisions.filter(({ decisionId }) => concern.decisionIds.includes(decisionId));
    if (concern.status === "resolved" && selected.length > 0 && selected.every(({ assessment }) => !assessment.blocksCurrentChange))
      continue;
    let reasons = [concern.status === "resolved" ? "The resolved concern has no current accepted decision proof." : "An accepted blocking-now concern requires a decision or explicit valid deferral."];
    if (concern.status === "deferred") {
      const deferral = concern.deferral;
      if (deferral !== void 0) {
        const validation = validateDecisionDeferral(deferral);
        const deadline = deferral.reviewBy === void 0 ? void 0 : Date.parse(deferral.reviewBy);
        const dates = deferral.reconsiderWhen.filter((trigger) => trigger.type === "date");
        const expired = deadline !== void 0 && (!Number.isFinite(deadline) || Date.parse(input.now) >= deadline) || dates.some((trigger) => !Number.isFinite(Date.parse(trigger.at)) || Date.parse(input.now) >= Date.parse(trigger.at));
        const unsupported = deferral.reconsiderWhen.filter(({ type }) => type !== "date" && type !== "manual-review");
        if (validation.valid && !expired && unsupported.length === 0)
          continue;
        reasons = [...validation.reasons, ...expired ? ["The canonical deferral review date has expired."] : [], ...unsupported.map(({ type }) => `Deferral trigger ${type} has no accepted baseline observer; continued deferral is not established.`)];
      } else
        reasons = ["The deferred concern lacks its canonical deferral contract."];
    }
    add("architecture-concern", [concern.id], subjects, true, concern.question, reasons, { concern, selected });
  }
  const priority = (question) => question.kind === "unmapped-group" ? 2 : question.kind.startsWith("unrealized-") ? 1 : 0;
  return questions.sort((a, b) => Number(b.blocking) - Number(a.blocking) || priority(a) - priority(b) || b.affectedCount - a.affectedCount || a.id.localeCompare(b.id));
}

// node_modules/@projector/control-plane/dist/coverage/transport.js
var CompletionQuestionSchema = external_exports.object({
  id: external_exports.string(),
  kind: external_exports.enum(["governance", "unmapped-group", "unrealized-requirement", "unrealized-scenario", "realization-binding", "identity-overlap", "architecture-concern"]),
  blocking: external_exports.boolean(),
  ownerIds: external_exports.array(external_exports.string()),
  affectedCount: external_exports.number().int().nonnegative(),
  subjectCount: external_exports.number().int().nonnegative(),
  examples: external_exports.array(external_exports.string()),
  question: external_exports.string(),
  reasons: external_exports.array(external_exports.string()),
  reasonCount: external_exports.number().int().nonnegative(),
  evidenceHash: ContentHashSchema,
  assessment: CompletionAssessmentSchema,
  resolution: external_exports.object({ context: external_exports.object({ command: external_exports.literal("context"), request: external_exports.string(), entities: external_exports.array(external_exports.string()), namedTargets: external_exports.array(external_exports.string()) }).strict(), route: CompletionRepairRouteSchema, instruction: external_exports.string(), alternatives: external_exports.array(CompletionRepairAlternativeSchema) }).strict()
}).strict();
var disclosureSchema = external_exports.object({ total: external_exports.number().int().nonnegative(), included: external_exports.number().int().nonnegative(), omitted: external_exports.number().int().nonnegative(), blocking: external_exports.number().int().nonnegative() }).strict();
var completionSchema = external_exports.object({
  readOnly: external_exports.literal(true),
  disclosure: disclosureSchema,
  questions: external_exports.array(CompletionQuestionSchema),
  questionDisclosure: disclosureSchema,
  questionPage: external_exports.object({ offset: external_exports.number().int().nonnegative(), nextOffset: external_exports.number().int().nonnegative().nullable(), note: external_exports.string() }).strict(),
  ranking: external_exports.string(),
  limits: external_exports.array(external_exports.string()),
  estimatedQuestionTokens: external_exports.number().int().nonnegative(),
  repairPlan: external_exports.array(external_exports.object({ order: external_exports.number().int().positive(), questionId: external_exports.string(), evidenceHash: ContentHashSchema, resolution: CompletionQuestionSchema.shape.resolution }).strict()).optional(),
  execution: external_exports.literal("not-performed").optional()
}).strict();
var RepositoryCoverageResultBaseSchema = external_exports.object({
  proofStatement: external_exports.enum(["proven-within-boundary", "bounded", "high-confidence", "partial", "not-established"]),
  boundary: external_exports.array(external_exports.string()),
  lanes: external_exports.array(CoverageLaneSchema),
  unavailableSurfaceIds: external_exports.array(external_exports.string()),
  approvalRequired: external_exports.literal(false),
  budgetExhausted: external_exports.boolean(),
  continuationPersisted: external_exports.literal(false),
  snapshot: CoverageSnapshotSchema,
  boundState: StateBindingSchema,
  bindingValidation: StateBindingValidationSchema,
  bindingIdentity: ContentHashSchema,
  localAnalysis: external_exports.object({ artifactCount: external_exports.number().int().nonnegative(), projectionUnitCount: external_exports.number().int().nonnegative(), dependencyCount: external_exports.number().int().nonnegative(), analyzerFailureCount: external_exports.number().int().nonnegative(), analyzerFailures: external_exports.array(AnalyzerFailureSchema), realizations: external_exports.object({ matched: external_exports.number().int().nonnegative(), unmatched: external_exports.number().int().nonnegative(), unsupported: external_exports.number().int().nonnegative(), unavailable: external_exports.number().int().nonnegative() }).strict() }).strict(),
  applicationEvidence: external_exports.object({ status: external_exports.enum(["satisfied", "violated", "unknown", "not-applicable"]), assessments: external_exports.array(KnowledgeApplicationEvidenceAssessmentSchema) }).strict(),
  completion: completionSchema,
  continuation: RepositoryContinuationSchema.optional()
}).strict();
var RepositoryCoverageOutputSchema = RepositoryCoverageResultBaseSchema.superRefine((value, context) => {
  if (value.continuation !== void 0)
    context.addIssue({ code: "custom", message: "continuation inspection belongs to cleanup", path: ["continuation"] });
  if (value.completion.questions.length !== 0 || value.completion.repairPlan !== void 0 || value.completion.execution !== void 0)
    context.addIssue({ code: "custom", message: "coverage output cannot disclose questions or a repair plan", path: ["completion"] });
});
var RepositoryCompletionOutputSchema = RepositoryCoverageResultBaseSchema.superRefine((value, context) => {
  if (value.continuation !== void 0)
    context.addIssue({ code: "custom", message: "continuation inspection belongs to cleanup", path: ["continuation"] });
  if (value.completion.repairPlan !== void 0 || value.completion.execution !== void 0)
    context.addIssue({ code: "custom", message: "completion output cannot claim a cleanup plan", path: ["completion"] });
});
var RepositoryCleanupOutputSchema = RepositoryCoverageResultBaseSchema.superRefine((value, context) => {
  if (value.completion.repairPlan === void 0 || value.completion.execution !== "not-performed")
    context.addIssue({ code: "custom", message: "cleanup output must expose its non-executed repair plan", path: ["completion"] });
});
function parseRepositoryCoverageResult(mode, value) {
  const schema = mode === "coverage" ? RepositoryCoverageOutputSchema : mode === "complete" ? RepositoryCompletionOutputSchema : RepositoryCleanupOutputSchema;
  return schema.parse(value);
}

// node_modules/@projector/control-plane/dist/coverage/service.js
var inside = (path, scope) => scope === "." || path === scope || path.startsWith(`${scope}/`);
var unavailable = (key, reason) => ({ key, applicability: "required", observability: "unavailable", numerator: 0, confidence: 0, assumptions: [], provenAssumptions: [], blindSpots: [reason], staleObservationIds: [] });
async function inspectRepositoryCoverage(repositoryRoot, request, mode = "coverage", options = {}) {
  return withObservationScope({ ...options.signal === void 0 ? {} : { signal: options.signal } }, async (scope) => {
    const observation = await observeChangeRepository(repositoryRoot);
    const { independentValidator: _validator, ...data } = observation;
    return runObservationTask("coverage", { observation: data, request, mode, now: (/* @__PURE__ */ new Date()).toISOString() }, {
      ...scope,
      onHostRequest: createKnowledgeComputeHostHandler(observation, options)
    });
  });
}
async function computeRepositoryCoverage(observation, request, mode, host, now, derivedBudget) {
  const repositoryRoot = observation.repositoryRoot;
  const signal = new AbortController().signal;
  signal.throwIfAborted();
  const questionOffset = request.questionOffset ?? 0;
  if (!Number.isSafeInteger(questionOffset) || questionOffset < 0)
    throw new Error("questionOffset must be a nonnegative safe integer");
  const { analysis, state: currentState } = observation;
  const graph = new KnowledgeGraph(observation, { now: () => now, readDecisionBaseline: host.baseline }, derivedBudget);
  const units = graph.units.filter(({ key }) => inside(key, request.scope));
  const unitIds = new Set(units.map(({ id }) => id));
  const artifacts = analysis.artifacts.filter(({ locator }) => inside(locator, request.scope));
  const dependencies = analysis.dependencies.filter(({ importerPath }) => inside(importerPath, request.scope));
  signal.throwIfAborted();
  const context = { repositoryRoot, stateDigest: currentState, config: {}, signal };
  const activeLenses = graph.lenses.filter(({ status, id }) => status === "active" && (request.scope === "." || graph.lensCompilation === void 0 || graph.implementationBindings(id).some((member) => unitIds.has(String(member.id)))));
  const decisions = graph.decisions.filter(({ id }) => request.scope === "." || graph.implementationBindings(id).some((member) => unitIds.has(String(member.id))));
  const decisionResult = await assessKnowledgeDecisions(graph, decisions, "inspect", context);
  const selectedIds = /* @__PURE__ */ new Set([...unitIds, ...activeLenses.map(({ id }) => id)]);
  const { findings, executed } = await host.validators(graph.validatorRequests(selectedIds, "inspect"));
  if (executed) {
    const after = await host.freshState();
    if (canonicalJson(after) !== canonicalJson(currentState))
      throw new Error("Repository changed while coverage validators ran; discard these observations and request fresh coverage.");
  }
  const evaluations = graph.governanceEvaluationsWithProvenance(selectedIds, "inspect", findings);
  const authorityProblems = [];
  for (const lens of activeLenses) {
    const assessment = assessLensAuthority(lens, graph.authorities);
    if (!assessment.eligible)
      authorityProblems.push({ ownerId: lens.id, authorityId: lens.authorityRecordId, reasons: assessment.reasons });
  }
  for (const decision of decisions) {
    const authority = graph.authorities.find(({ id }) => id === decision.authorityRecordId);
    if (authority === void 0 || authority.subjectId !== decision.concernId || !["approved", "auto-approved"].includes(authority.status) || ["unknown", "exception"].includes(authority.conclusion) || authority.decidedBy === "system" && authority.status !== "auto-approved") {
      authorityProblems.push({ ownerId: decision.id, authorityId: decision.authorityRecordId, reasons: ["An active decision requires an accepted authority record for its concern."] });
    }
  }
  if (graph.lensCompilationUnknown !== void 0)
    for (const lens of activeLenses.filter(({ id }) => !authorityProblems.some(({ ownerId }) => ownerId === id)))
      authorityProblems.push({ ownerId: lens.id, authorityId: lens.authorityRecordId, reasons: [graph.lensCompilationUnknown] });
  const intent = graph.entities.filter(({ accepted, kind, payload }) => accepted && ["concept", "requirement", "scenario"].includes(kind) && "status" in payload && payload.status === "active");
  const mapped = new Set(intent.flatMap(({ id }) => graph.implementationBindings(id).map((member) => String(member.id))).filter((id) => unitIds.has(id)));
  const ruleFindings = evaluations.flatMap(({ evaluation }) => evaluation.findings);
  const scopedIntent = intent.filter(({ id }) => request.scope === "." || graph.implementationBindings(id).some((member) => unitIds.has(String(member.id))));
  const applicationEvidenceAssessments = await host.applicationEvidence(scopedIntent.filter(({ kind }) => kind === "requirement" || kind === "scenario").map(({ id }) => id));
  const questions = deriveCompletionQuestions({ graph, unitIds, decisions: decisionResult.decisions, evaluations, authorityProblems, applicationEvidence: applicationEvidenceAssessments, includeUnrealized: request.scope === ".", now });
  const identityOwners = new Set(questions.filter(({ kind }) => kind === "identity-overlap").flatMap(({ ownerIds }) => ownerIds));
  signal.throwIfAborted();
  const applicationEvidenceStatus = applicationEvidenceDisposition(applicationEvidenceAssessments);
  const applicationEvidenceReasons = applicationEvidenceAssessments.flatMap((item) => item.status === "unavailable" ? [item.reason] : item.assessment.fulfillment.status === "satisfied" ? [] : [item.assessment.fulfillment.reason]);
  const enumeration = analysis.surface.enumeration;
  const known = (key, numerator, denominator, meaning) => ({
    key,
    applicability: "required",
    observability: enumeration.observability === "unavailable" ? "unavailable" : "bounded",
    numerator,
    denominator,
    confidence: enumeration.observability === "unavailable" ? 0 : 1,
    assumptions: [...enumeration.assumptions, meaning],
    provenAssumptions: [],
    blindSpots: [...enumeration.blindSpots],
    staleObservationIds: []
  });
  const lanes = REQUIRED_COVERAGE_LANES.map((key) => {
    if (key === "inventory")
      return known(key, artifacts.length, artifacts.length, "Observed Git-aware repository file inventory; external and runtime-created surfaces are outside this denominator.");
    if (key === "projection-unit-classification")
      return known(key, units.length, artifacts.length, "Observed file-level projection-unit classifications.");
    if (key === "concept-mapping")
      return known(key, mapped.size, units.length, "Files with active canonical intent membership. Membership records semantic ownership and does not prove behavioral satisfaction.");
    if (key === "relationship")
      return known(key, dependencies.filter(({ resolvedPath }) => resolvedPath !== void 0).length, dependencies.length, "Observed static dependency records with resolved local targets; dynamic and external targets are not inferred.");
    if (key === "lens")
      return known(key, activeLenses.filter(({ id }) => !authorityProblems.some(({ ownerId }) => ownerId === id) && evaluations.some((item) => item.lensId === id) && evaluations.filter((item) => item.lensId === id).every(({ evaluation }) => evaluation.status !== "unknown")).length, activeLenses.length, "Active lenses whose applicable observed units have executable evaluation results. A violated predicate is operational evidence, not conformance.");
    if (key === "rule-enforceability")
      return graph.lensCompilationUnknown === void 0 ? known(key, ruleFindings.filter(({ status }) => status !== "unknown").length, ruleFindings.length, "Applicable rule and validator findings with executable satisfied or violated observations.") : unavailable(key, graph.lensCompilationUnknown);
    if (key === "validation-evidence") {
      if (graph.lensCompilationUnknown !== void 0)
        return unavailable(key, graph.lensCompilationUnknown);
      const lane = known(key, ruleFindings.filter(({ status }) => status === "satisfied").length + applicationEvidenceAssessments.filter((item) => item.status === "assessed" && item.assessment.fulfillment.status === "satisfied").length, ruleFindings.length + applicationEvidenceAssessments.length, "Satisfied executable findings and authenticated application predicates for their declared obligations only; neither mapping nor hashes establish general behavioral fulfillment.");
      return applicationEvidenceReasons.length === 0 ? lane : { ...lane, blindSpots: [...lane.blindSpots, ...applicationEvidenceReasons] };
    }
    if (key === "authority")
      return known(key, activeLenses.length + decisions.length - authorityProblems.length, activeLenses.length + decisions.length, "Active lens and decision subjects with usable canonical authority and compilable governance.");
    if (key === "architecture-decision")
      return known(key, decisionResult.decisions.filter(({ assessment }) => !assessment.blocksCurrentChange).length, decisions.length, "Active decisions with current observed applicability and trigger proof; valid future decisions do not establish implementation.");
    if (key === "semantic-identity")
      return known(key, scopedIntent.filter(({ id }) => !identityOwners.has(id)).length, scopedIntent.length, "Active intent identities without an exact accepted address collision; semantic equivalence beyond exact addresses remains unobserved.");
    if (key === "surface")
      return known(key, analysis.surface.access === "unavailable" ? 0 : 1, 1, "The local repository surface only. External ownership and external observations are unavailable.");
    if (key === "change-closure" || key === "planning-surprise")
      return { key, applicability: "not-applicable", boundaryExclusion: "No semantic change execution is requested by this read-only observation.", observability: "closed", numerator: 0, denominator: 0, confidence: 1, assumptions: [], provenAssumptions: [], blindSpots: [], staleObservationIds: [] };
    if (key === "representation-projection-fidelity")
      return unavailable(key, "Authenticated representation projection evidence is unavailable.");
    if (key === "historical-metamorphic")
      return unavailable(key, "Git history and path identities do not establish historical metamorphic behavior.");
    return unavailable(key, `Authenticated ${key} evidence is unavailable for this observation.`);
  });
  const binding = createStateBinding({ compiledAgainst: currentState, valueDependencies: [...graph.valueDependencies(graph.entities.map(({ id }) => id)), ...applicationEvidenceDependencies(applicationEvidenceAssessments), { kind: "adapter", id: "projector.repository-coverage-observation", versionHash: hashFramedDomain("repository-coverage-observation", { state: currentState, scope: request.scope, lanes, questions, applicationEvidence: applicationEvidenceAssessments.map(({ contentHash }) => contentHash) }), role: "Canonical meaning, inventory membership and executable obligation observations" }], queryDependencies: decisionResult.dependencies });
  const analyzerFailures = analysis.failures.filter(({ scope }) => inside(scope, request.scope));
  const failureIds = analyzerFailures.map(({ analyzerId, capability, scope }) => `${analyzerId}:${capability}:${scope}`).sort();
  const evidence = {
    boundState: binding,
    lanes,
    analyzerFailures,
    unknownFrontierIds: lanes.filter(({ observability }) => observability === "unavailable").map(({ key }) => `coverage:${key}`),
    unavailableSurfaceIds: analysis.surface.access === "unavailable" ? [analysis.surface.id] : [],
    completion: { artifactsClassified: units.length === artifacts.length, semanticMappingsResolved: mapped.size === units.length, identityDispositionsResolved: identityOwners.size === 0, expectedProjectionsAccounted: false, relevanceNegativeSpaceProven: false, lensesAndRulesOperational: authorityProblems.length === 0 && evaluations.every(({ evaluation }) => evaluation.status !== "unknown"), externalOwnershipAssigned: false, blockerIds: [...failureIds, ...questions.filter(({ blocking }) => blocking).map(({ id }) => id), ...applicationEvidenceAssessments.filter((item) => item.status === "unavailable" || item.assessment.fulfillment.status !== "satisfied").map((item) => `application-evidence:${assessmentKey(item)}`)], unknownUnitIds: units.filter(({ id }) => !mapped.has(id)).map(({ id }) => id), validationIndependenceSatisfied: false, architectureFrontierIds: questions.filter(({ kind }) => kind === "architecture-concern").map(({ id }) => id) }
  };
  const compiled = await compileAuthenticatedCoverageSnapshot({ graphRevision: 0, boundary: [request.scope], binding, currentState, context }, { bindingValidator: { validate: async () => ({ status: "current", currentState, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [] }) }, evidence: { observe: async () => evidence } });
  let estimatedQuestionTokens = 0;
  const selectedQuestions = [];
  const questionPage = questions.slice(questionOffset, questionOffset + 10);
  for (const question of questionPage) {
    const cost = Math.ceil(canonicalJson(question).length / 4);
    if (request.budgetTokens !== void 0 && estimatedQuestionTokens + cost > request.budgetTokens)
      break;
    estimatedQuestionTokens += cost;
    selectedQuestions.push(question);
  }
  const nextQuestionOffset = questionOffset + selectedQuestions.length < questions.length ? questionOffset + selectedQuestions.length : null;
  const disclosure = { total: questions.length, included: selectedQuestions.length, omitted: questions.length - selectedQuestions.length, blocking: questions.filter(({ blocking }) => blocking).length };
  const unsupportedContinuation = request.continuationSelector !== void 0;
  const continuation = mode === "cleanup" && (request.contextId !== void 0 || request.changeSelector !== void 0 || request.approvalSelector !== void 0) ? await host.continuation({
    scope: request.scope,
    ...request.contextId === void 0 ? {} : { contextId: request.contextId },
    ...request.changeSelector === void 0 ? {} : { changeSelector: request.changeSelector },
    ...request.approvalSelector === void 0 ? {} : { approvalSelector: request.approvalSelector },
    ...request.evidenceOffset === void 0 ? {} : { evidenceOffset: request.evidenceOffset },
    ...request.evidenceLimit === void 0 ? {} : { evidenceLimit: request.evidenceLimit },
    ...request.evidenceIdentity === void 0 ? {} : { evidenceIdentity: request.evidenceIdentity }
  }) : void 0;
  if (continuation !== void 0) {
    signal.throwIfAborted();
    const after = await host.freshState();
    if (canonicalJson(after) !== canonicalJson(currentState))
      throw new Error("Repository changed during cleanup continuation inspection; request a fresh cleanup report.");
  }
  return parseRepositoryCoverageResult(mode, {
    proofStatement: compiled.snapshot.proofStatement,
    boundary: compiled.snapshot.boundary,
    lanes: compiled.snapshot.lanes,
    unavailableSurfaceIds: [...compiled.snapshot.unavailableSurfaceIds, ...unsupportedContinuation ? ["cleanup-continuation-execution"] : []],
    approvalRequired: false,
    ...continuation === void 0 ? {} : { continuation },
    budgetExhausted: request.budgetTokens !== void 0 && selectedQuestions.length < questionPage.length,
    continuationPersisted: false,
    snapshot: compiled.snapshot,
    boundState: compiled.boundState,
    bindingValidation: compiled.bindingValidation,
    bindingIdentity: compiled.boundState.dependencyDigest,
    localAnalysis: {
      artifactCount: artifacts.length,
      projectionUnitCount: units.length,
      dependencyCount: dependencies.length,
      analyzerFailureCount: failureIds.length,
      analyzerFailures,
      realizations: Object.fromEntries(["matched", "unmatched", "unsupported", "unavailable"].map((status) => [status, observation.realizations.filter((item) => item.status === status && (request.scope === "." || item.memberIds.some((id) => unitIds.has(id)))).length]))
    },
    applicationEvidence: { status: applicationEvidenceStatus, assessments: applicationEvidenceAssessments },
    completion: {
      readOnly: true,
      disclosure,
      questions: mode === "coverage" ? [] : selectedQuestions,
      questionDisclosure: mode === "coverage" ? { ...disclosure, included: 0, omitted: questions.length } : disclosure,
      questionPage: { offset: questionOffset, nextOffset: nextQuestionOffset, note: "Set input.questionOffset to nextOffset in the next complete or cleanup request against unchanged evidence. If the token budget admits no question, increase it before continuing. Repository changes recompute ranking; no pagination state is persisted." },
      ranking: "Blocking obligations first, then unrealized accepted behavior before unmapped file groups; within each class, descending affected-file count and stable question identity.",
      limits: ["No behavioral satisfaction is inferred from file membership.", "No external, derivation, metamorphic or representation proof is synthesized.", "Questions are derived from canonical state; no answer ledger or continuation execution is created.", ...request.budgetTokens === void 0 ? [] : ["Token budget bounds question disclosure using an explicit four-characters-per-token estimate; it does not limit repository observation or report metadata."], ...request.budgetCost === void 0 ? [] : ["Monetary cost estimation is unavailable; this command performs local observation and cannot enforce a monetary budget."]],
      estimatedQuestionTokens,
      ...mode === "cleanup" ? { repairPlan: selectedQuestions.map((question, index) => ({ order: index + 1, questionId: question.id, evidenceHash: question.evidenceHash, resolution: question.resolution })), execution: "not-performed" } : {}
    }
  });
}

export {
  CompletionQuestionSchema,
  RepositoryCoverageOutputSchema,
  RepositoryCompletionOutputSchema,
  RepositoryCleanupOutputSchema,
  parseRepositoryCoverageResult,
  inspectRepositoryCoverage,
  computeRepositoryCoverage
};
