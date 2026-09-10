import { canonicalJson, hashFramedDomain, type AdapterContext, type ValidationResult } from "@projector/core";

import { KnowledgeGraph } from "../knowledge/graph.js";
import { RepositoryKnowledgeService } from "../knowledge/service.js";
import { captureDecisionBaselines, triggerSubjectId } from "../knowledge/decision-baselines.js";
import { assessKnowledgeDecisions } from "../knowledge/governance.js";
import { KnowledgeValidatorRun } from "../knowledge/validators.js";
import type { CompiledRepositoryChange } from "./compiler.js";
import type { ChangeRepositoryObservation } from "./repository-observer.js";

/** Check executable obligations against the actual post-state before the transaction commits. */
export async function validatePostChangeKnowledge(
  compiled: CompiledRepositoryChange,
  observation: ChangeRepositoryObservation,
  startedAt: string,
  completedAt: () => string,
  signal: AbortSignal = new AbortController().signal,
): Promise<ValidationResult> {
  const decisionBaselines = transactionDecisionBaselines(compiled, observation);
  const graph = new KnowledgeGraph(observation, { acceptedDecisionBaselines: decisionBaselines, now: completedAt });
  const changedPaths = new Set(compiled.exactPatchInput.edits.map(({ path }) => path));
  const selectedIds = new Set([
    ...compiled.relevance.knownAffectedUnitIds,
    ...graph.units.filter(({ key }) => changedPaths.has(key)).map(({ id }) => id),
    ...(compiled.knowledgeContext?.branches.filter(({ hypothesis }) => !hypothesis).flatMap(({ closure }) => closure.entries.map(({ entityId }) => entityId)) ?? []),
  ]);
  const applicableLenses = graph.lenses.filter(({ id, status }) => status === "active"
    && (graph.lensCompilation?.memberships[id] ?? []).some((unitId) => selectedIds.has(unitId)));
  for (const lens of applicableLenses) selectedIds.add(lens.id);
  selectChangedDecisions(compiled, graph, selectedIds);
  const operation = compiled.knowledgeContext?.operation ?? "change";
  const context: AdapterContext = { repositoryRoot: observation.repositoryRoot, stateDigest: observation.state, config: {}, signal };
  const decisions = await assessKnowledgeDecisions(graph, graph.relevantDecisions(selectedIds), operation, context);
  const validators = new KnowledgeValidatorRun(observation, signal);
  const findings = await validators.evaluateAll(graph.validatorRequests(selectedIds, operation));
  const evaluations = graph.governanceEvaluations(selectedIds, operation, findings);
  const reasons = [
    ...(graph.lensCompilationUnknown === undefined ? [] : [graph.lensCompilationUnknown]),
    ...graph.authorityUnknowns([...selectedIds]),
    ...decisions.decisions.filter(({ assessment }) => assessment.blocksCurrentChange).map(({ assessment }) => assessment.explanation),
    ...evaluations.filter(({ status }) => status !== "conformant").flatMap(({ findings, boundary }) => [
      ...findings.filter(({ status }) => status !== "satisfied").map(({ reason }) => reason), ...boundary,
    ]),
  ];
  for (const before of compiled.governanceBefore.memberships) {
    const current = graph.units.find(({ key }) => key === before.path);
    if (current === undefined || !(graph.lensCompilation?.memberships[before.lensId] ?? []).includes(current.id)) {
      reasons.push(`Previously governed source ${before.path} no longer has applicability under ${before.lensId}; removal or relocation requires explicit conceptual reconciliation.`);
    }
  }
  const retained = compiled.knowledgeContext === undefined ? undefined
    : await (await RepositoryKnowledgeService.create({ repositoryRoot: observation.repositoryRoot, acceptedDecisionBaselines: decisionBaselines, now: completedAt })).reconcile(compiled.knowledgeContext.id, { signal });
  if (retained !== undefined) {
    if (canonicalJson(retained.currentState) !== canonicalJson(observation.state)) reasons.push("Repository changed between post-state observation and retained-context reconciliation.");
    // Exact approved writes necessarily stale the old context. Unknown or violated
    // obligations are not an expected consequence and must not pass as success.
    if (retained.status === "suspect" || retained.status === "unavailable") reasons.push(`Retained knowledge is ${retained.status}.`);
    if (retained.governance.status === "unknown" || retained.governance.status === "violated") reasons.push(...retained.governance.reasons, `Retained governance is ${retained.governance.status}.`);
  }
  const passed = reasons.length === 0 && evaluations.every(({ status }) => status === "conformant");
  const details = {
    state: observation.state,
    intentReviewHash: compiled.intentReview.contentHash,
    preChangeGovernanceHash: compiled.governanceBefore.contentHash,
    evaluations,
    decisionValidity: decisions.decisions,
    decisionBaselines,
    ...(retained === undefined ? {} : { retainedReconciliation: retained }),
    reasons: [...new Set(reasons)].sort(),
    semanticFidelity: "not-established",
  };
  const contentHash = hashFramedDomain("repository-post-change-knowledge", details);
  return {
    validatorId: "projector.post-change-knowledge",
    status: passed ? "passed" : "failed",
    summary: passed ? "Applicable executable architectural obligations conform in the post-state; full behavioral fidelity is not established."
      : "Post-change conceptual knowledge has violated or unavailable executable obligations.",
    evidenceIds: [`evidence_${contentHash.slice(-32)}`],
    evidenceLane: "runtime", independenceGroup: "projector.knowledge-governance", assurance: "strong",
    authorSource: "projector.local-repository", sideEffectClass: "none", details, startedAt, completedAt: completedAt(),
  };
}

function transactionDecisionBaselines(compiled: CompiledRepositoryChange, observation: ChangeRepositoryObservation) {
  return captureDecisionBaselines(observation,
    compiled.canonicalWrites.filter(({ kind }) => kind === "authority-record").map(({ id }) => id),
    compiled.canonicalWrites.filter(({ kind }) => kind === "architecture-decision").map(({ id }) => id));
}

function selectChangedDecisions(compiled: CompiledRepositoryChange, graph: KnowledgeGraph, selectedIds: Set<string>): void {
  const changed = new Set(compiled.canonicalWrites.map(({ id }) => id));
  for (const decision of graph.decisions) {
    const authority = graph.authorities.find(({ id }) => id === decision.authorityRecordId);
    if (changed.has(decision.id) || changed.has(decision.authorityRecordId) || authority?.reconsiderWhen.some((trigger) => { const id = triggerSubjectId(trigger); return id !== undefined && changed.has(id); }) === true) selectedIds.add(decision.id);
  }
}

/** Canonical acceptance captures exact post-state observations without claiming code execution. */
export async function validateCanonicalDecisionBaselines(compiled: CompiledRepositoryChange, observation: ChangeRepositoryObservation, startedAt: string, completedAt: () => string, signal: AbortSignal = new AbortController().signal): Promise<ValidationResult> {
  const decisionBaselines = transactionDecisionBaselines(compiled, observation);
  const graph = new KnowledgeGraph(observation, { acceptedDecisionBaselines: decisionBaselines, now: completedAt });
  const selectedIds = new Set<string>();
  selectChangedDecisions(compiled, graph, selectedIds);
  const context: AdapterContext = { repositoryRoot: observation.repositoryRoot, stateDigest: observation.state, config: {}, signal };
  const decisions = await assessKnowledgeDecisions(graph, graph.relevantDecisions(selectedIds), compiled.knowledgeContext?.operation ?? "change", context);
  const reasons = [...graph.authorityUnknowns([...selectedIds]), ...decisions.decisions.filter(({ assessment }) => assessment.blocksCurrentChange).map(({ assessment }) => assessment.explanation)];
  const details = { state: observation.state, decisionValidity: decisions.decisions, decisionBaselines, reasons, runtimeValidation: "not-performed" };
  return { validatorId: "projector.canonical-decision-baselines", status: reasons.length === 0 ? "passed" : "blocked", summary: reasons.length === 0 ? "Accepted conceptual decision baselines captured from the actual post-state; runtime behavior was not validated." : "A relevant decision requires reconsideration before this canonical change.",
    evidenceIds: [`evidence_${hashFramedDomain("canonical-decision-baselines", details).slice(-32)}`], evidenceLane: "architecture", independenceGroup: "projector.knowledge-governance", assurance: "exact", authorSource: "projector.local-repository", sideEffectClass: "none", details, startedAt, completedAt: completedAt() };
}
