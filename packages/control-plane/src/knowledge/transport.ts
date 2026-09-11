import { AnalyzerFailureSchema, ContentHashSchema, StateDigestSchema } from "@projector/core";
import { z } from "zod";
import {
  KNOWLEDGE_API_VERSION, KnowledgeContextResultSchema, KnowledgeReconciliationResultSchema,
  KnowledgeInterpretationCandidateSchema, KnowledgeLensObligationSchema, KnowledgeDecisionValiditySchema,
  compiledContextSchema, governanceEvaluationSchema,
  type KnowledgeContextResult, type KnowledgeContextBranch, type KnowledgeReconciliationResult,
} from "./types.js";
import { KnowledgeApplicationEvidenceAssessmentSchema } from "./application-evidence.js";

// Transport budgets do not change the persisted proof or clip any semantic record.
// A record that cannot fit is omitted whole, with a count and a full-view route.
const contentBudget = 32_000;
const branchBudget = 48_000;
const messageBudget = 2_048;
const sampleLimit = 12;
const countSchema = z.strictObject({ total: z.number().int().nonnegative(), included: z.number().int().nonnegative(), omitted: z.number().int().nonnegative() });
const stringsSchema = z.strictObject({ values: z.array(z.string()), disclosure: countSchema });
const bindingStatusSchema = z.enum(["current", "rebound", "stale", "suspect", "unavailable"]);
const safetySchema = z.strictObject({
  blockedDecisions: z.number().int().nonnegative(), unknownDecisions: z.number().int().nonnegative(),
  firedDecisionChecks: z.number().int().nonnegative(), unknownDecisionChecks: z.number().int().nonnegative(), unobservedDecisionChecks: z.number().int().nonnegative(),
  violatedGovernance: z.number().int().nonnegative(), unknownGovernance: z.number().int().nonnegative(),
  violatedFindings: z.number().int().nonnegative(), unknownFindings: z.number().int().nonnegative(),
  unknownObligations: z.number().int().nonnegative(), applicationEvidenceCount: z.number().int().nonnegative(),
  violatedApplicationEvidence: z.number().int().nonnegative(), unknownApplicationEvidence: z.number().int().nonnegative(),
});
const contextBranchSchema = z.strictObject({
  id: z.string(), interpretation: KnowledgeInterpretationCandidateSchema, hypothesis: z.boolean(),
  context: z.strictObject({
    items: compiledContextSchema.shape.items, itemsDisclosure: countSchema,
    deferredEntityIds: stringsSchema, requiredExpansionIds: z.array(z.string()), requiredExpansionDisclosure: countSchema,
    estimatedCost: z.number().nonnegative(), requiredBudgetOverrun: z.number().nonnegative(),
  }),
  frontier: z.array(z.string()), frontierDisclosure: countSchema,
  lensObligations: z.array(KnowledgeLensObligationSchema), obligationDisclosure: countSchema,
  decisionValidity: z.array(KnowledgeDecisionValiditySchema), decisionDisclosure: countSchema,
  governanceEvaluations: z.array(governanceEvaluationSchema), governanceDisclosure: countSchema,
  applicationEvidence: z.array(KnowledgeApplicationEvidenceAssessmentSchema), applicationEvidenceDisclosure: countSchema,
  safety: safetySchema,
});
export const KnowledgeContextAgentViewSchema = z.strictObject({
  apiVersion: z.literal(KNOWLEDGE_API_VERSION), view: z.literal("agent"), id: z.string(), request: z.string(),
  persisted: z.boolean(), contentHash: ContentHashSchema, capturedState: StateDigestSchema,
  interpretation: z.strictObject({ status: z.enum(["direct", "candidates", "unresolved"]), candidates: z.array(KnowledgeInterpretationCandidateSchema), candidateDisclosure: countSchema, unknowns: z.array(z.string()), unknownDisclosure: countSchema }),
  branches: z.array(contextBranchSchema), branchDisclosure: countSchema,
  unknowns: z.array(z.string()), unknownDisclosure: countSchema,
  analyzerFailures: z.array(AnalyzerFailureSchema), analyzerFailureDisclosure: countSchema,
  safety: safetySchema,
  fullEvidence: z.strictObject({ operation: z.literal("context"), inputPatch: z.strictObject({ view: z.literal("full") }), note: z.string() }),
});

const validationSchema = z.strictObject({
  status: bindingStatusSchema,
  reasons: z.array(z.string()), reasonDisclosure: countSchema,
  changedValueDependencyIds: z.array(z.string()), changedValueDependencyDisclosure: countSchema,
  changedQueryDependencyIds: z.array(z.string()), changedQueryDependencyDisclosure: countSchema,
});
const governanceBranchSchema = z.strictObject({
  interpretationEntityId: z.string(), retainedBranchId: z.string().optional(), currentBranchId: z.string().optional(),
  status: z.enum(["conformant", "violated", "unknown", "not-applicable"]),
  reasons: z.array(z.string()), reasonDisclosure: countSchema,
  decisionValidity: z.array(KnowledgeDecisionValiditySchema), decisionDisclosure: countSchema,
  evaluations: z.array(governanceEvaluationSchema), evaluationDisclosure: countSchema, safety: safetySchema,
});
const impactSchema = z.strictObject({
  status: z.enum(["current", "changed", "unavailable"]), contentHash: ContentHashSchema,
  repairRoute: z.enum(["reuse", "revalidate", "widen-analysis", "human-decision"]),
  predictedUnitIds: stringsSchema, observedChangedUnitIds: stringsSchema, knownAffectedUnitIds: stringsSchema,
  possibleFrontierUnitIds: stringsSchema, backdatedUnitIds: stringsSchema, blockedUnitIds: stringsSchema,
  surpriseCount: z.number().int().nonnegative(), candidateRelationCount: z.number().int().nonnegative(), diagnostics: stringsSchema,
});
export const KnowledgeReconciliationAgentViewSchema = z.strictObject({
  apiVersion: z.literal(KNOWLEDGE_API_VERSION), view: z.literal("agent"), contextId: z.string(), contentHash: ContentHashSchema,
  capturedState: StateDigestSchema, currentState: StateDigestSchema, status: bindingStatusSchema,
  discoveryValidation: validationSchema,
  branches: z.array(z.strictObject({ branchId: z.string(), validation: validationSchema })), branchDisclosure: countSchema,
  governance: z.strictObject({
    status: z.enum(["conformant", "violated", "unknown", "not-applicable"]), regeneratedContextId: z.string(),
    reasons: z.array(z.string()), reasonDisclosure: countSchema,
    branches: z.array(governanceBranchSchema), branchDisclosure: countSchema, safety: safetySchema,
  }),
  applicationEvidence: z.strictObject({
    status: z.enum(["satisfied", "violated", "unknown", "not-applicable"]),
    branches: z.array(z.strictObject({ branchId: z.string(), status: z.enum(["satisfied", "violated", "unknown", "not-applicable"]), changed: z.boolean(), reasons: z.array(z.string()) })),
    branchDisclosure: countSchema,
  }),
  reasons: z.array(z.string()), reasonDisclosure: countSchema, impact: impactSchema.optional(),
  fullEvidence: z.strictObject({ operation: z.literal("reconcile"), input: z.strictObject({ contextId: z.string(), view: z.literal("full") }) }),
});
export const KnowledgeContextOperationOutputSchema = z.union([KnowledgeContextAgentViewSchema, KnowledgeContextResultSchema]);
export const KnowledgeReconciliationOperationOutputSchema = z.union([KnowledgeReconciliationAgentViewSchema, KnowledgeReconciliationResultSchema]);

function bytes(value: unknown): number { return Buffer.byteLength(JSON.stringify(value), "utf8"); }
function count(total: number, included: number) { return { total, included, omitted: total - included }; }
function sample<T>(values: readonly T[], budget = messageBudget, limit = sampleLimit) {
  const included: T[] = [];
  for (const value of values) {
    const size = bytes(value) + 1;
    if (included.length < limit && size <= budget) { included.push(value); budget -= size; }
  }
  return { values: included, disclosure: count(values.length, included.length) };
}
type SafetyInput = Pick<KnowledgeContextBranch, "lensObligations" | "decisionValidity" | "governanceEvaluations" | "applicationEvidence">;
function safety(branches: readonly SafetyInput[]): z.infer<typeof safetySchema> {
  const decisions = branches.flatMap((branch) => branch.decisionValidity ?? []);
  const checks = decisions.flatMap((decision) => decision.checks);
  const evaluations = branches.flatMap((branch) => branch.governanceEvaluations ?? []);
  const findings = evaluations.flatMap((evaluation) => evaluation.findings);
  return {
    blockedDecisions: decisions.filter((decision) => decision.assessment.blocksCurrentChange).length,
    unknownDecisions: decisions.filter((decision) => decision.baseline.kind === "unavailable" || decision.checks.some((check) => check.status === "unknown")).length,
    firedDecisionChecks: checks.filter((check) => check.status === "fired").length,
    unknownDecisionChecks: checks.filter((check) => check.status === "unknown").length,
    unobservedDecisionChecks: checks.filter((check) => check.status === "unobserved").length,
    violatedGovernance: evaluations.filter((evaluation) => evaluation.status === "violated").length,
    unknownGovernance: evaluations.filter((evaluation) => evaluation.status === "unknown").length,
    violatedFindings: findings.filter((finding) => finding.status === "violated").length,
    unknownFindings: findings.filter((finding) => finding.status === "unknown").length,
    unknownObligations: branches.flatMap((branch) => branch.lensObligations).filter((obligation) => obligation.status === "unknown" || obligation.unknowns.length > 0).length,
    applicationEvidenceCount: branches.reduce((total, branch) => total + branch.applicationEvidence.length, 0),
    violatedApplicationEvidence: branches.flatMap((branch) => branch.applicationEvidence).filter((item) => item.status === "assessed" && item.assessment.fulfillment.status === "violated").length,
    unknownApplicationEvidence: branches.flatMap((branch) => branch.applicationEvidence).filter((item) => item.status === "unavailable" || item.assessment.fulfillment.status === "unknown").length,
  };
}
function decisions(values: NonNullable<KnowledgeContextBranch["decisionValidity"]>) {
  return sample([...values].sort((a, b) => Number(b.assessment.blocksCurrentChange) - Number(a.assessment.blocksCurrentChange)), 4_096);
}
function evaluations(values: NonNullable<KnowledgeContextBranch["governanceEvaluations"]>) {
  return sample([...values].sort((a, b) => Number(b.status !== "conformant") - Number(a.status !== "conformant")), 4_096);
}

/** Only the public transport is projected; saved context identities and hashes still name full proof. */
export function projectKnowledgeContext(report: KnowledgeContextResult, view: "agent" | "full" = "agent") {
  if (view === "full") return report;
  const candidates = sample(report.interpretation.candidates, 4_096);
  const interpretationUnknowns = sample(report.interpretation.unknowns);
  const unknowns = sample(report.unknowns);
  const failures = sample(report.analyzerFailures);
  let remainingContent = contentBudget;
  const projected = report.branches.slice(0, sampleLimit).map((branch) => {
    // Direct meaning precedes governing meaning; no string slicing or semantic reconstruction.
    const priority = (band: string) => band === "direct" ? 0 : band === "governing" ? 1 : 2;
    const ordered = [...branch.context.items].sort((a, b) => priority(a.band) - priority(b.band));
    const items = sample(ordered, remainingContent, 64);
    remainingContent -= items.values.reduce((total, item) => total + bytes(item) + 1, 0);
    const deferred = sample(ordered.filter((item) => !items.values.includes(item)).map((item) => item.entityId));
    const frontier = sample(branch.frontier);
    const expansions = sample(branch.context.requiredExpansionIds);
    const obligations = sample([...branch.lensObligations].sort((a, b) => Number(b.status === "unknown") - Number(a.status === "unknown")), 4_096);
    const decision = decisions(branch.decisionValidity ?? []);
    const governance = evaluations(branch.governanceEvaluations ?? []);
    const applicationEvidence = sample(branch.applicationEvidence, 2_048);
    return {
      id: branch.id, interpretation: branch.interpretation, hypothesis: branch.hypothesis,
      context: { items: items.values, itemsDisclosure: items.disclosure, deferredEntityIds: deferred,
        requiredExpansionIds: expansions.values, requiredExpansionDisclosure: expansions.disclosure,
        estimatedCost: branch.context.estimatedCost, requiredBudgetOverrun: branch.context.requiredBudgetOverrun },
      frontier: frontier.values, frontierDisclosure: frontier.disclosure,
      lensObligations: obligations.values, obligationDisclosure: obligations.disclosure,
      decisionValidity: decision.values, decisionDisclosure: decision.disclosure,
      governanceEvaluations: governance.values, governanceDisclosure: governance.disclosure,
      applicationEvidence: applicationEvidence.values, applicationEvidenceDisclosure: applicationEvidence.disclosure,
      safety: safety([branch]),
    };
  });
  const branches = sample(projected, branchBudget);
  return KnowledgeContextAgentViewSchema.parse({
    apiVersion: report.apiVersion, view: "agent", id: report.id, request: report.request,
    persisted: report.persisted, contentHash: report.contentHash, capturedState: report.capturedState,
    interpretation: { status: report.interpretation.status, candidates: candidates.values, candidateDisclosure: candidates.disclosure,
      unknowns: interpretationUnknowns.values, unknownDisclosure: interpretationUnknowns.disclosure },
    branches: branches.values, branchDisclosure: count(report.branches.length, branches.values.length),
    unknowns: unknowns.values, unknownDisclosure: unknowns.disclosure,
    analyzerFailures: failures.values, analyzerFailureDisclosure: failures.disclosure,
    safety: safety(report.branches),
    fullEvidence: { operation: "context", inputPatch: { view: "full" }, note: "Merge inputPatch into the original context input; it is not a complete request. Preserve request, entities, namedTargets, policy, operation and persist. The saved context and contentHash identify full retained evidence; omitted content is not an absent constraint." },
  });
}

function validation(value: KnowledgeReconciliationResult["discoveryValidation"]) {
  const reasons = sample(value.reasons);
  const values = sample(value.changedValueDependencyIds);
  const queries = sample(value.changedQueryDependencyIds);
  return { status: value.status, reasons: reasons.values, reasonDisclosure: reasons.disclosure,
    changedValueDependencyIds: values.values, changedValueDependencyDisclosure: values.disclosure,
    changedQueryDependencyIds: queries.values, changedQueryDependencyDisclosure: queries.disclosure };
}
export function projectKnowledgeReconciliation(report: KnowledgeReconciliationResult, view: "agent" | "full" = "agent") {
  if (view === "full") return report;
  const reasons = sample(report.reasons);
  const branches = sample(report.branches.map((branch) => ({ branchId: branch.branchId, validation: validation(branch.validation) })), 8_000);
  const governanceReasons = sample(report.governance.reasons);
  const governanceInputs = report.governance.branches.map((branch) => ({ decisionValidity: branch.decisionValidity ?? [], governanceEvaluations: branch.evaluations, lensObligations: [], applicationEvidence: [] }));
  const governanceBranches = sample(report.governance.branches.slice(0, sampleLimit).map((branch, index) => {
    const reasons = sample(branch.reasons);
    const decision = decisions(branch.decisionValidity ?? []);
    const evaluation = evaluations(branch.evaluations);
    return { interpretationEntityId: branch.interpretationEntityId,
      ...(branch.retainedBranchId === undefined ? {} : { retainedBranchId: branch.retainedBranchId }),
      ...(branch.currentBranchId === undefined ? {} : { currentBranchId: branch.currentBranchId }),
      status: branch.status, reasons: reasons.values, reasonDisclosure: reasons.disclosure,
      decisionValidity: decision.values, decisionDisclosure: decision.disclosure,
      evaluations: evaluation.values, evaluationDisclosure: evaluation.disclosure,
      safety: safety([governanceInputs[index]!]) };
  }), 24_000);
  const applications = sample(report.applicationEvidence.branches, 4_096);
  const impact = report.impact;
  return KnowledgeReconciliationAgentViewSchema.parse({
    apiVersion: report.apiVersion, view: "agent", contextId: report.contextId, contentHash: report.contentHash,
    capturedState: report.capturedState, currentState: report.currentState, status: report.status,
    discoveryValidation: validation(report.discoveryValidation), branches: branches.values, branchDisclosure: branches.disclosure,
    reasons: reasons.values, reasonDisclosure: reasons.disclosure,
    governance: { status: report.governance.status, regeneratedContextId: report.governance.regeneratedContextId,
      reasons: governanceReasons.values, reasonDisclosure: governanceReasons.disclosure,
      branches: governanceBranches.values, branchDisclosure: count(report.governance.branches.length, governanceBranches.values.length), safety: safety(governanceInputs) },
    applicationEvidence: { status: report.applicationEvidence.status, branches: applications.values, branchDisclosure: applications.disclosure },
    ...(impact === undefined ? {} : { impact: {
      status: impact.status, contentHash: impact.contentHash, repairRoute: impact.repairRoute,
      predictedUnitIds: sample(impact.predictedUnitIds, 512), observedChangedUnitIds: sample(impact.observedChangedUnitIds, 512),
      knownAffectedUnitIds: sample(impact.knownAffectedUnitIds, 512), possibleFrontierUnitIds: sample(impact.possibleFrontierUnitIds, 512),
      backdatedUnitIds: sample(impact.backdatedUnitIds, 512), blockedUnitIds: sample(impact.blockedUnitIds, 512),
      surpriseCount: impact.surprises.length, candidateRelationCount: impact.candidateRelations.length, diagnostics: sample(impact.diagnostics),
    } }),
    fullEvidence: { operation: "reconcile", input: { contextId: report.contextId, view: "full" } },
  });
}
