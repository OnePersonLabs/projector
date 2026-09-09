import { canonicalJson, hashFramedDomain, type ValidationResult } from "@projector/core";

import { KnowledgeGraph } from "../knowledge/graph.js";
import { RepositoryKnowledgeService } from "../knowledge/service.js";
import type { CompiledRepositoryChange } from "./compiler.js";
import type { ChangeRepositoryObservation } from "./repository-observer.js";

/** Check executable obligations against the actual post-state before the transaction commits. */
export async function validatePostChangeKnowledge(
  compiled: CompiledRepositoryChange,
  observation: ChangeRepositoryObservation,
  startedAt: string,
  completedAt: () => string,
): Promise<ValidationResult> {
  const graph = new KnowledgeGraph(observation);
  const changedPaths = new Set(compiled.exactPatchInput.edits.map(({ path }) => path));
  const selectedIds = new Set([
    ...compiled.relevance.knownAffectedUnitIds,
    ...graph.units.filter(({ key }) => changedPaths.has(key)).map(({ id }) => id),
    ...(compiled.knowledgeContext?.branches.filter(({ hypothesis }) => !hypothesis).flatMap(({ closure }) => closure.entries.map(({ entityId }) => entityId)) ?? []),
  ]);
  const applicableLenses = graph.lenses.filter(({ id, status }) => status === "active"
    && (graph.lensCompilation?.memberships[id] ?? []).some((unitId) => selectedIds.has(unitId)));
  for (const lens of applicableLenses) selectedIds.add(lens.id);
  const evaluations = graph.governanceEvaluations(selectedIds, compiled.knowledgeContext?.operation ?? "change");
  const reasons = [
    ...(graph.lensCompilationUnknown === undefined ? [] : [graph.lensCompilationUnknown]),
    ...graph.authorityUnknowns([...selectedIds]),
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
    : await (await RepositoryKnowledgeService.create(observation.repositoryRoot)).reconcile(compiled.knowledgeContext.id);
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
