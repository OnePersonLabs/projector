import { AnalyzerFailureSchema, ContentHashSchema, StateDigestSchema, ObservationError } from "@projector/core";
import { z } from "zod";
import {
  KNOWLEDGE_API_VERSION, KnowledgeContextResultSchema, KnowledgeReconciliationResultSchema,
  KnowledgeInterpretationCandidateSchema, KnowledgeLensObligationSchema, KnowledgeDecisionValiditySchema,
  governanceEvaluationSchema,
  type KnowledgeContextResult, type KnowledgeContextBranch, type KnowledgeReconciliationResult,
} from "./types.js";
import { KnowledgeApplicationEvidenceAssessmentSchema } from "./application-evidence.js";

// Transport budgets do not change the persisted proof or clip any semantic record.
// A record that cannot fit is omitted whole, with a count and a full-view route.
const contentBudget = 32_000;
const branchBudget = 48_000;
const messageBudget = 2_048;
const sampleLimit = 12;
export const KNOWLEDGE_RESPONSE_LIMITS = Object.freeze({ agent: 1024 * 1024, full: 16 * 1024 * 1024 });

function boundedResponse<T>(value: T, view: "agent" | "full"): T {
  if (bytes(value) > KNOWLEDGE_RESPONSE_LIMITS[view]) {
    throw new ObservationError("observation-limit-exceeded", "response", ".",
      `Knowledge ${view} response exceeds its ${KNOWLEDGE_RESPONSE_LIMITS[view]} byte limit; request a narrower context.`);
  }
  return value;
}

/** Called before cache admission so an unusable public response cannot publish a new baseline. */
export function assertKnowledgeContextResponseSize(report: KnowledgeContextResult, view: "agent" | "full" = "agent"): void {
  projectKnowledgeContext(report, view);
}
const countSchema = z.strictObject({ total: z.number().int().nonnegative(), included: z.number().int().nonnegative(), omitted: z.number().int().nonnegative() });
const stringsSchema = z.strictObject({ values: z.array(z.string()), disclosure: countSchema });
const bindingStatusSchema = z.enum(["current", "rebound", "stale", "suspect", "unavailable"]);
const humanMeaningSectionSchema = z.strictObject({
  id: z.string(), entityId: z.string(), sourceSemanticHash: ContentHashSchema,
  kind: z.enum(["statement", "scenario", "decision", "qualifier", "currentness", "summary"]),
  heading: z.string(), text: z.string(), branchIds: z.array(z.string()),
});
const humanMeaningSchema = z.strictObject({
  profile: z.strictObject({ id: z.literal("human-compact"), version: z.literal(1), sourceContentHash: ContentHashSchema }),
  sections: z.array(humanMeaningSectionSchema), disclosure: countSchema,
});
const contextItemReferenceSchema = z.strictObject({
  entityId: z.string(), sourceSemanticHash: ContentHashSchema,
  kind: z.enum(["concept", "requirement", "scenario", "decision", "projection-unit", "other"]),
  band: z.enum(["direct", "governing", "consequence", "possible"]), disclosure: z.enum(["full", "summary", "identity"]),
  relevanceScore: z.number().finite(), relevanceReasons: z.array(z.string()), uncertainty: z.array(z.string()), confidence: z.number().finite(),
  sectionIds: z.array(z.string()), sectionDisclosure: countSchema,
});
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
    items: z.array(contextItemReferenceSchema), itemsDisclosure: countSchema,
    meaningDisclosure: countSchema,
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
  meaning: humanMeaningSchema,
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

type MeaningKind = z.infer<typeof humanMeaningSectionSchema>["kind"];
type MeaningSection = z.infer<typeof humanMeaningSectionSchema>;
type JsonObject = Record<string, unknown>;

interface MeaningCandidate {
  readonly branchId: string;
  readonly branchIndex: number;
  readonly hypothesis: boolean;
  readonly item: KnowledgeContextBranch["context"]["items"][number];
  readonly section: Omit<MeaningSection, "branchIds">;
}

function object(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : undefined;
}
function string(value: unknown): string | undefined { return typeof value === "string" && value.trim().length > 0 ? value : undefined; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.flatMap((item) => string(item) ?? []) : []; }
function list(label: string, values: readonly string[]): string | undefined {
  return values.length === 0 ? undefined : `${label}:\n${values.map((value) => `- ${value}`).join("\n")}`;
}
function valueText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value === undefined) return undefined;
  return JSON.stringify(value);
}
function sourceRecord(content: string): { readonly record?: JsonObject; readonly authority?: JsonObject; readonly fallback?: string } {
  try {
    const parsed = object(JSON.parse(content));
    if (parsed === undefined) return { fallback: content };
    const record = object(parsed.record) ?? parsed;
    const authorityEnvelope = object(parsed.authority);
    if (authorityEnvelope === undefined) return { record };
    return { record, authority: object(authorityEnvelope.payload) ?? authorityEnvelope };
  } catch { return { fallback: content }; }
}
function label(record: JsonObject | undefined, fallback: string): string {
  return string(record?.title) ?? string(record?.name) ?? string(record?.key) ?? fallback;
}
function section(item: MeaningCandidate["item"], kind: MeaningKind, heading: string, text: string): Omit<MeaningSection, "branchIds"> {
  return {
    // Source semantic identity keeps all branch copies of the same current fact together.
    id: `${item.entityId}:${item.sourceSemanticHash}:${kind}`,
    entityId: item.entityId, sourceSemanticHash: item.sourceSemanticHash, kind, heading, text,
  };
}

/**
 * This is a display projection only. It reads current typed source fields from
 * the retained raw record, so source and state bindings stay exactly as they
 * were when the context was compiled. Evidence/provenance/history remains in
 * the full view instead of becoming default task noise.
 */
function meaningFromItem(item: MeaningCandidate["item"]): Omit<MeaningSection, "branchIds">[] {
  if (item.disclosure === "identity") return [];
  const parsed = sourceRecord(item.content);
  if (parsed.record === undefined) {
    return parsed.fallback === undefined ? [] : [section(item, "summary", item.entityId, parsed.fallback)];
  }
  const record = parsed.record;
  const sourceLabel = label(record, item.entityId);
  const sections: Omit<MeaningSection, "branchIds">[] = [];
  const statement = string(record.statement);
  const decision = string(record.decision);
  const steps = Array.isArray(record.steps)
    ? record.steps.flatMap((step) => {
      const value = object(step);
      const text = string(value?.statement);
      return text === undefined ? [] : [`${string(value?.role) ?? "step"}: ${text}`];
    })
    : [];
  if (statement !== undefined) sections.push(section(item, "statement", sourceLabel, statement));
  else if (decision !== undefined) sections.push(section(item, "decision", sourceLabel, decision));
  else if (steps.length > 0) sections.push(section(item, "scenario", sourceLabel, steps.join("\n")));
  else if (item.disclosure === "summary") sections.push(section(item, "summary", sourceLabel, string(record.summary) ?? item.content));

  const consequences = Array.isArray(record.consequences)
    ? record.consequences.flatMap((entry) => string(object(entry)?.explanation) ?? []) : [];
  const qualifiers = [
    list("Consequences", consequences),
    valueText(record.scope) === undefined ? undefined : `Scope: ${valueText(record.scope)}`,
    string(parsed.authority?.rationale) === undefined ? undefined : `Rationale: ${parsed.authority!.rationale}`,
    list("Assumptions", strings(parsed.authority?.assumptions)),
    Array.isArray(parsed.authority?.reconsiderWhen) && parsed.authority.reconsiderWhen.length > 0
      ? `Reconsider when: ${JSON.stringify(parsed.authority.reconsiderWhen)}` : undefined,
  ].filter((value): value is string => value !== undefined);
  if (qualifiers.length > 0) sections.push(section(item, "qualifier", `${sourceLabel} qualifiers`, qualifiers.join("\n\n")));

  const current = [
    string(record.lifecycle) === undefined ? undefined : `Lifecycle: ${record.lifecycle}`,
    string(record.status) === undefined ? undefined : `Status: ${record.status}`,
    string(parsed.authority?.status) === undefined ? undefined : `Authority status: ${parsed.authority!.status}`,
    string(parsed.authority?.conclusion) === undefined ? undefined : `Authority conclusion: ${parsed.authority!.conclusion}`,
  ].filter((value): value is string => value !== undefined);
  if (current.length > 0) sections.push(section(item, "currentness", `${sourceLabel} currentness`, current.join("\n")));
  return sections;
}

function bandPriority(band: MeaningCandidate["item"]["band"]): number {
  return band === "direct" ? 0 : band === "governing" ? 1 : band === "consequence" ? 2 : 3;
}
function compareCandidates(left: MeaningCandidate, right: MeaningCandidate): number {
  return bandPriority(left.item.band) - bandPriority(right.item.band)
    || Number(left.hypothesis) - Number(right.hypothesis)
    || right.item.relevanceScore - left.item.relevanceScore
    || left.branchIndex - right.branchIndex
    || left.branchId.localeCompare(right.branchId);
}
function humanMeaning(report: KnowledgeContextResult) {
  const candidates: MeaningCandidate[] = report.branches.flatMap((branch, branchIndex) => branch.context.items.flatMap((item) =>
    meaningFromItem(item).map((source) => ({ branchId: branch.id, branchIndex, hypothesis: branch.hypothesis, item, section: source }))));
  const groups = new Map<string, MeaningCandidate[]>();
  for (const candidate of candidates) groups.set(candidate.section.id, [...(groups.get(candidate.section.id) ?? []), candidate]);
  const ordered = [...groups.values()].map((group) => [...group].sort(compareCandidates)).sort((left, right) => compareCandidates(left[0]!, right[0]!));
  let remaining = contentBudget;
  const included = new Set<string>();
  const sections: MeaningSection[] = [];
  for (const group of ordered) {
    const primary = group[0]!;
    const rendered: MeaningSection = { ...primary.section, branchIds: [...new Set(group.map(({ branchId }) => branchId))].sort() };
    const size = bytes(rendered) + 1;
    if (size > remaining) continue;
    included.add(rendered.id);
    sections.push(rendered);
    remaining -= size;
  }
  return { sections, disclosure: count(ordered.length, sections.length), included };
}

/** Only the public transport is projected; saved context identities and hashes still name full proof. */
export function projectKnowledgeContext(report: KnowledgeContextResult, view: "agent" | "full" = "agent") {
  if (view === "full") return boundedResponse(report, view);
  const candidates = sample(report.interpretation.candidates, 4_096);
  const interpretationUnknowns = sample(report.interpretation.unknowns);
  const unknowns = sample(report.unknowns);
  const failures = sample(report.analyzerFailures);
  const meaning = humanMeaning(report);
  const projected = report.branches.slice(0, sampleLimit).map((branch) => {
    // Branches only refer to the one globally deduplicated section list.
    // Direct meaning still precedes governing meaning within each branch.
    const priority = (band: string) => band === "direct" ? 0 : band === "governing" ? 1 : 2;
    const ordered = [...branch.context.items].sort((a, b) => priority(a.band) - priority(b.band));
    const references = ordered.map((item) => {
      const ids = meaningFromItem(item).map(({ id }) => id);
      const selected = ids.filter((id) => meaning.included.has(id));
      return {
        entityId: item.entityId, sourceSemanticHash: item.sourceSemanticHash, kind: item.kind, band: item.band, disclosure: item.disclosure,
        relevanceScore: item.relevanceScore, relevanceReasons: item.relevanceReasons, uncertainty: item.uncertainty, confidence: item.confidence,
        sectionIds: selected, sectionDisclosure: count(ids.length, selected.length),
      };
    });
    const items = sample(references, 8_000, 64);
    const deferred = sample(ordered.filter((item) => {
      const ids = meaningFromItem(item).map(({ id }) => id);
      return ids.some((id) => !meaning.included.has(id)) || !items.values.some(({ entityId }) => entityId === item.entityId);
    }).map((item) => item.entityId));
    const frontier = sample(branch.frontier);
    const expansions = sample(branch.context.requiredExpansionIds);
    const obligations = sample([...branch.lensObligations].sort((a, b) => Number(b.status === "unknown") - Number(a.status === "unknown")), 4_096);
    const decision = decisions(branch.decisionValidity ?? []);
    const governance = evaluations(branch.governanceEvaluations ?? []);
    const applicationEvidence = sample(branch.applicationEvidence, 2_048);
    return {
      id: branch.id, interpretation: branch.interpretation, hypothesis: branch.hypothesis,
      context: { items: items.values, itemsDisclosure: items.disclosure, deferredEntityIds: deferred,
        meaningDisclosure: count(references.reduce((total, reference) => total + reference.sectionDisclosure.total, 0), references.reduce((total, reference) => total + reference.sectionDisclosure.included, 0)),
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
  return boundedResponse(KnowledgeContextAgentViewSchema.parse({
    apiVersion: report.apiVersion, view: "agent", id: report.id, request: report.request,
    persisted: report.persisted, contentHash: report.contentHash, capturedState: report.capturedState,
    interpretation: { status: report.interpretation.status, candidates: candidates.values, candidateDisclosure: candidates.disclosure,
      unknowns: interpretationUnknowns.values, unknownDisclosure: interpretationUnknowns.disclosure },
    branches: branches.values, branchDisclosure: count(report.branches.length, branches.values.length),
    meaning: { profile: { id: "human-compact", version: 1, sourceContentHash: report.contentHash }, sections: meaning.sections, disclosure: meaning.disclosure },
    unknowns: unknowns.values, unknownDisclosure: unknowns.disclosure,
    analyzerFailures: failures.values, analyzerFailureDisclosure: failures.disclosure,
    safety: safety(report.branches),
    fullEvidence: { operation: "context", inputPatch: { view: "full" }, note: "Merge inputPatch into the original context input; it is not a complete request. Preserve request, entities, namedTargets, policy, operation and persist. The saved context and contentHash identify full retained evidence; omitted content is not an absent constraint." },
  }), view);
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
  if (view === "full") return boundedResponse(report, view);
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
  return boundedResponse(KnowledgeReconciliationAgentViewSchema.parse({
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
  }), view);
}
