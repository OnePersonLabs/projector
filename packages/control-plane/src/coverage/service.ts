import { canonicalJson, hashFramedDomain, type AdapterContext } from "@projector/core";
import { assessLensAuthority, createStateBinding, type GovernanceBundleEvaluation } from "@projector/engine";
import { compileAuthenticatedCoverageSnapshot, REQUIRED_COVERAGE_LANES, type CoverageEvidenceSnapshot, type CoverageLaneEvidence, type RequiredCoverageLaneKey } from "@projector/engine/coverage";
import { observeChangeRepository } from "../change-lifecycle/repository-observer.js";
import { KnowledgeGraph } from "../knowledge/graph.js";
import { assessKnowledgeDecisions } from "../knowledge/governance.js";
import { KnowledgeValidatorRun } from "../knowledge/validators.js";
import { applicationEvidenceDependencies, applicationEvidenceDisposition, assessKnowledgeApplicationEvidence, assessmentKey, type PsychordApplicationEvidenceHost } from "../knowledge/application-evidence.js";
import { deriveCompletionQuestions } from "./issues.js";
import { parseRepositoryCoverageResult, type RepositoryCoverageMode, type RepositoryCoverageResult } from "./transport.js";
import { inspectRepositoryContinuation, type RepositoryContinuationRequest } from "./continuation.js";

export interface RepositoryCoverageRequest extends RepositoryContinuationRequest {
  readonly scope: string;
  readonly continuationSelector?: string;
}

const inside = (path: string, scope: string): boolean => scope === "." || path === scope || path.startsWith(`${scope}/`);
const unavailable = (key: RequiredCoverageLaneKey, reason: string): CoverageLaneEvidence => ({ key, applicability: "required", observability: "unavailable", numerator: 0, confidence: 0, assumptions: [], provenAssumptions: [], blindSpots: [reason], staleObservationIds: [] });

/** Current observations, never an answer ledger or a completion percentage for behavior. */
export async function inspectRepositoryCoverage(repositoryRoot: string, request: RepositoryCoverageRequest, mode: RepositoryCoverageMode = "coverage", options: { readonly signal?: AbortSignal; readonly applicationEvidence?: PsychordApplicationEvidenceHost } = {}): Promise<RepositoryCoverageResult> {
  const signal = options.signal ?? new AbortController().signal;
  signal.throwIfAborted();
  const questionOffset = request.questionOffset ?? 0;
  if (!Number.isSafeInteger(questionOffset) || questionOffset < 0) throw new Error("questionOffset must be a nonnegative safe integer");
  const observation = await observeChangeRepository(repositoryRoot);
  const { analysis, state: currentState } = observation;
  const graph = new KnowledgeGraph(observation);
  const units = graph.units.filter(({ key }) => inside(key, request.scope));
  const unitIds = new Set(units.map(({ id }) => id));
  const artifacts = analysis.artifacts.filter(({ locator }) => inside(locator, request.scope));
  const dependencies = analysis.dependencies.filter(({ importerPath }) => inside(importerPath, request.scope));
  signal.throwIfAborted();
  const context: AdapterContext = { repositoryRoot, stateDigest: currentState, config: {}, signal };
  const activeLenses = graph.lenses.filter(({ status, id }) => status === "active" && (request.scope === "." || graph.lensCompilation === undefined || graph.implementationBindings(id).some((member) => unitIds.has(String(member.id)))));
  const decisions = graph.decisions.filter(({ id }) => request.scope === "." || graph.implementationBindings(id).some((member) => unitIds.has(String(member.id))));
  const decisionResult = await assessKnowledgeDecisions(graph, decisions, "inspect", context);
  const selectedIds = new Set([...unitIds, ...activeLenses.map(({ id }) => id)]);
  const validators = new KnowledgeValidatorRun(observation, context.signal);
  const findings = await validators.evaluateAll(graph.validatorRequests(selectedIds, "inspect"));
  if (validators.executed) {
    const after = await observeChangeRepository(repositoryRoot);
    if (canonicalJson(after.state) !== canonicalJson(currentState)) throw new Error("Repository changed while coverage validators ran; discard these observations and request fresh coverage.");
  }
  const evaluations: Array<{ lensId: string; evaluation: GovernanceBundleEvaluation }> = activeLenses.flatMap((lens) => graph.governanceEvaluations(new Set([...unitIds, lens.id]), "inspect", findings).map((evaluation) => ({ lensId: lens.id, evaluation })));
  const authorityProblems: Array<{ ownerId: string; authorityId: string; reasons: string[] }> = [];
  for (const lens of activeLenses) {
    const assessment = assessLensAuthority(lens, graph.authorities);
    if (!assessment.eligible) authorityProblems.push({ ownerId: lens.id, authorityId: lens.authorityRecordId, reasons: assessment.reasons });
  }
  for (const decision of decisions) {
    const authority = graph.authorities.find(({ id }) => id === decision.authorityRecordId);
    if (authority === undefined || authority.subjectId !== decision.concernId || !["approved", "auto-approved"].includes(authority.status) || ["unknown", "exception"].includes(authority.conclusion) || (authority.decidedBy === "system" && authority.status !== "auto-approved")) {
      authorityProblems.push({ ownerId: decision.id, authorityId: decision.authorityRecordId, reasons: ["An active decision requires an accepted authority record for its concern."] });
    }
  }
  if (graph.lensCompilationUnknown !== undefined) for (const lens of activeLenses.filter(({ id }) => !authorityProblems.some(({ ownerId }) => ownerId === id))) authorityProblems.push({ ownerId: lens.id, authorityId: lens.authorityRecordId, reasons: [graph.lensCompilationUnknown] });
  const questions = deriveCompletionQuestions({ graph, unitIds, decisions: decisionResult.decisions, evaluations, authorityProblems, includeUnrealized: request.scope === ".", now: new Date().toISOString() });
  const intent = graph.entities.filter(({ accepted, kind, payload }) => accepted && ["concept", "requirement", "scenario"].includes(kind) && "status" in payload && payload.status === "active");
  const mapped = new Set(intent.flatMap(({ id }) => graph.implementationBindings(id).map((member) => String(member.id))).filter((id) => unitIds.has(id)));
  const ruleFindings = evaluations.flatMap(({ evaluation }) => evaluation.findings);
  const identityOwners = new Set(questions.filter(({ kind }) => kind === "identity-overlap").flatMap(({ ownerIds }) => ownerIds));
  const scopedIntent = intent.filter(({ id }) => request.scope === "." || graph.implementationBindings(id).some((member) => unitIds.has(String(member.id))));
  const applicationEvidenceAssessments = await assessKnowledgeApplicationEvidence({ observation, ownerIds: scopedIntent.filter(({ kind }) => kind === "requirement" || kind === "scenario").map(({ id }) => id), signal, ...(options.applicationEvidence === undefined ? {} : { host: options.applicationEvidence }) });
  signal.throwIfAborted();
  const applicationEvidenceStatus = applicationEvidenceDisposition(applicationEvidenceAssessments);
  const applicationEvidenceReasons = applicationEvidenceAssessments.flatMap((item) => item.status === "unavailable" ? [item.reason] : item.assessment.fulfillment.status === "satisfied" ? [] : [item.assessment.fulfillment.reason]);
  const enumeration = analysis.surface.enumeration;
  const known = (key: RequiredCoverageLaneKey, numerator: number, denominator: number, meaning: string): CoverageLaneEvidence => ({ key, applicability: "required", observability: enumeration.observability === "unavailable" ? "unavailable" : "bounded", numerator, denominator, confidence: enumeration.observability === "unavailable" ? 0 : 1,
    assumptions: [...enumeration.assumptions, meaning], provenAssumptions: [], blindSpots: [...enumeration.blindSpots], staleObservationIds: [] });
  const lanes = REQUIRED_COVERAGE_LANES.map((key): CoverageLaneEvidence => {
    if (key === "inventory") return known(key, artifacts.length, artifacts.length, "Observed Git-aware repository file inventory; external and runtime-created surfaces are outside this denominator.");
    if (key === "projection-unit-classification") return known(key, units.length, artifacts.length, "Observed file-level projection-unit classifications.");
    if (key === "concept-mapping") return known(key, mapped.size, units.length, "Files with active canonical intent membership. Membership records semantic ownership and does not prove behavioral satisfaction.");
    if (key === "relationship") return known(key, dependencies.filter(({ resolvedPath }) => resolvedPath !== undefined).length, dependencies.length, "Observed static dependency records with resolved local targets; dynamic and external targets are not inferred.");
    if (key === "lens") return known(key, activeLenses.filter(({ id }) => !authorityProblems.some(({ ownerId }) => ownerId === id) && evaluations.some((item) => item.lensId === id) && evaluations.filter((item) => item.lensId === id).every(({ evaluation }) => evaluation.status !== "unknown")).length, activeLenses.length, "Active lenses whose applicable observed units have executable evaluation results. A violated predicate is operational evidence, not conformance.");
    if (key === "rule-enforceability") return graph.lensCompilationUnknown === undefined ? known(key, ruleFindings.filter(({ status }) => status !== "unknown").length, ruleFindings.length, "Applicable rule and validator findings with executable satisfied or violated observations.") : unavailable(key, graph.lensCompilationUnknown);
    if (key === "validation-evidence") {
      if (graph.lensCompilationUnknown !== undefined) return unavailable(key, graph.lensCompilationUnknown);
      const lane = known(key, ruleFindings.filter(({ status }) => status === "satisfied").length + applicationEvidenceAssessments.filter((item) => item.status === "assessed" && item.assessment.fulfillment.status === "satisfied").length, ruleFindings.length + applicationEvidenceAssessments.length, "Satisfied executable findings and authenticated application predicates for their declared obligations only; neither mapping nor hashes establish general behavioral fulfillment.");
      return applicationEvidenceReasons.length === 0 ? lane : { ...lane, blindSpots: [...lane.blindSpots, ...applicationEvidenceReasons] };
    }
    if (key === "authority") return known(key, activeLenses.length + decisions.length - authorityProblems.length, activeLenses.length + decisions.length, "Active lens and decision subjects with usable canonical authority and compilable governance.");
    if (key === "architecture-decision") return known(key, decisionResult.decisions.filter(({ assessment }) => !assessment.blocksCurrentChange).length, decisions.length, "Active decisions with current observed applicability and trigger proof; valid future decisions do not establish implementation.");
    if (key === "semantic-identity") return known(key, scopedIntent.filter(({ id }) => !identityOwners.has(id)).length, scopedIntent.length, "Active intent identities without an exact accepted address collision; semantic equivalence beyond exact addresses remains unobserved.");
    if (key === "surface") return known(key, analysis.surface.access === "unavailable" ? 0 : 1, 1, "The local repository surface only. External ownership and external observations are unavailable.");
    if (key === "change-closure" || key === "planning-surprise") return { key, applicability: "not-applicable", boundaryExclusion: "No semantic change execution is requested by this read-only observation.", observability: "closed", numerator: 0, denominator: 0, confidence: 1, assumptions: [], provenAssumptions: [], blindSpots: [], staleObservationIds: [] };
    if (key === "representation-projection-fidelity") return unavailable(key, "Authenticated representation projection evidence is unavailable.");
    if (key === "historical-metamorphic") return unavailable(key, "Git history and path identities do not establish historical metamorphic behavior.");
    return unavailable(key, `Authenticated ${key} evidence is unavailable for this observation.`);
  });
  const binding = createStateBinding({ compiledAgainst: currentState, valueDependencies: [...graph.valueDependencies(graph.entities.map(({ id }) => id)), ...applicationEvidenceDependencies(applicationEvidenceAssessments), { kind: "adapter", id: "projector.repository-coverage-observation", versionHash: hashFramedDomain("repository-coverage-observation", { state: currentState, scope: request.scope, lanes, questions, applicationEvidence: applicationEvidenceAssessments.map(({ contentHash }) => contentHash) }), role: "Canonical meaning, inventory membership and executable obligation observations" }], queryDependencies: decisionResult.dependencies });
  const analyzerFailures = analysis.failures.filter(({ scope }) => inside(scope, request.scope));
  const failureIds = analyzerFailures.map(({ analyzerId, capability, scope }) => `${analyzerId}:${capability}:${scope}`).sort();
  const evidence: CoverageEvidenceSnapshot = { boundState: binding, lanes, analyzerFailures, unknownFrontierIds: lanes.filter(({ observability }) => observability === "unavailable").map(({ key }) => `coverage:${key}`), unavailableSurfaceIds: analysis.surface.access === "unavailable" ? [analysis.surface.id] : [],
    completion: { artifactsClassified: units.length === artifacts.length, semanticMappingsResolved: mapped.size === units.length, identityDispositionsResolved: identityOwners.size === 0, expectedProjectionsAccounted: false, relevanceNegativeSpaceProven: false, lensesAndRulesOperational: authorityProblems.length === 0 && evaluations.every(({ evaluation }) => evaluation.status !== "unknown"), externalOwnershipAssigned: false, blockerIds: [...failureIds, ...questions.filter(({ blocking }) => blocking).map(({ id }) => id), ...applicationEvidenceAssessments.filter((item) => item.status === "unavailable" || item.assessment.fulfillment.status !== "satisfied").map((item) => `application-evidence:${assessmentKey(item)}`)], unknownUnitIds: units.filter(({ id }) => !mapped.has(id)).map(({ id }) => id), validationIndependenceSatisfied: false, architectureFrontierIds: questions.filter(({ kind }) => kind === "architecture-concern").map(({ id }) => id) } };
  const compiled = await compileAuthenticatedCoverageSnapshot({ graphRevision: 0, boundary: [request.scope], binding, currentState, context }, { bindingValidator: { validate: async () => ({ status: "current", currentState, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [] }) }, evidence: { observe: async () => evidence } });
  let estimatedQuestionTokens = 0;
  const selectedQuestions = [] as typeof questions;
  const questionPage = questions.slice(questionOffset, questionOffset + 10);
  for (const question of questionPage) {
    const cost = Math.ceil(canonicalJson(question).length / 4);
    if (request.budgetTokens !== undefined && estimatedQuestionTokens + cost > request.budgetTokens) break;
    estimatedQuestionTokens += cost; selectedQuestions.push(question);
  }
  const nextQuestionOffset = questionOffset + selectedQuestions.length < questions.length ? questionOffset + selectedQuestions.length : null;
  const disclosure = { total: questions.length, included: selectedQuestions.length, omitted: questions.length - selectedQuestions.length, blocking: questions.filter(({ blocking }) => blocking).length };
  const unsupportedContinuation = request.continuationSelector !== undefined;
  const continuation = mode === "cleanup" && (request.contextId !== undefined || request.changeSelector !== undefined || request.approvalSelector !== undefined)
    ? await inspectRepositoryContinuation(repositoryRoot, {
      scope: request.scope,
      ...(request.contextId === undefined ? {} : { contextId: request.contextId }),
      ...(request.changeSelector === undefined ? {} : { changeSelector: request.changeSelector }),
      ...(request.approvalSelector === undefined ? {} : { approvalSelector: request.approvalSelector }),
      ...(request.evidenceOffset === undefined ? {} : { evidenceOffset: request.evidenceOffset }),
      ...(request.evidenceLimit === undefined ? {} : { evidenceLimit: request.evidenceLimit }),
      ...(request.evidenceIdentity === undefined ? {} : { evidenceIdentity: request.evidenceIdentity }),
    }, options) : undefined;
  if (continuation !== undefined) {
    signal.throwIfAborted();
    const after = await observeChangeRepository(repositoryRoot);
    if (canonicalJson(after.state) !== canonicalJson(currentState)) throw new Error("Repository changed during cleanup continuation inspection; request a fresh cleanup report.");
  }
  return parseRepositoryCoverageResult(mode, { proofStatement: compiled.snapshot.proofStatement, boundary: compiled.snapshot.boundary, lanes: compiled.snapshot.lanes, unavailableSurfaceIds: [...compiled.snapshot.unavailableSurfaceIds, ...(unsupportedContinuation ? ["cleanup-continuation-execution"] : [])], approvalRequired: false,
    ...(continuation === undefined ? {} : { continuation }),
    budgetExhausted: request.budgetTokens !== undefined && selectedQuestions.length < questionPage.length, continuationPersisted: false,
    snapshot: compiled.snapshot, boundState: compiled.boundState, bindingValidation: compiled.bindingValidation, bindingIdentity: compiled.boundState.dependencyDigest,
    localAnalysis: { artifactCount: artifacts.length, projectionUnitCount: units.length, dependencyCount: dependencies.length, analyzerFailureCount: failureIds.length, analyzerFailures,
      realizations: Object.fromEntries(["matched", "unmatched", "unsupported", "unavailable"].map((status) => [status, observation.realizations.filter((item) => item.status === status && (request.scope === "." || item.memberIds.some((id) => unitIds.has(id)))).length])) }, applicationEvidence: { status: applicationEvidenceStatus, assessments: applicationEvidenceAssessments },
    completion: { readOnly: true, disclosure, questions: mode === "coverage" ? [] : selectedQuestions, questionDisclosure: mode === "coverage" ? { ...disclosure, included: 0, omitted: questions.length } : disclosure,
      questionPage: { offset: questionOffset, nextOffset: nextQuestionOffset, note: "Use --question-offset with nextOffset against unchanged evidence. If the token budget admits no question, increase it before continuing. Repository changes recompute ranking; no pagination state is persisted." },
      ranking: "Blocking obligations first, then unrealized accepted behavior before unmapped file groups; within each class, descending affected-file count and stable question identity.",
      limits: ["No behavioral satisfaction is inferred from file membership.", "No external, derivation, metamorphic or representation proof is synthesized.", "Questions are derived from canonical state; no answer ledger or continuation execution is created.", ...(request.budgetTokens === undefined ? [] : ["Token budget bounds question disclosure using an explicit four-characters-per-token estimate; it does not limit repository observation or report metadata."]), ...(request.budgetCost === undefined ? [] : ["Monetary cost estimation is unavailable; this command performs local observation and cannot enforce a monetary budget."])],
      estimatedQuestionTokens, ...(mode === "cleanup" ? { repairPlan: selectedQuestions.map((question, index) => ({ order: index + 1, questionId: question.id, evidenceHash: question.evidenceHash, resolution: question.resolution })), execution: "not-performed" } : {}) } });
}
