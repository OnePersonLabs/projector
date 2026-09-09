import {
  RepositoryKnowledgeService,
  type KnowledgeContextRequest,
  type KnowledgeContextResult,
  type KnowledgeReconciliationResult,
} from "@projector/control-plane";
import { canonicalJson } from "@projector/core";

type ContextReport = Pick<KnowledgeContextResult, "id" | "request" | "persisted" | "interpretation" | "branches" | "unknowns">
  & Partial<Pick<KnowledgeContextResult, "contentHash">>;
type ReconciliationReport = Pick<KnowledgeReconciliationResult, "contextId" | "status" | "branches" | "reasons">
  & Partial<Pick<KnowledgeReconciliationResult, "governance" | "impact">>;

export interface RepositoryKnowledgeCliPort {
  context(request: KnowledgeContextRequest & { repositoryRoot: string; persist: boolean }): Promise<ContextReport>;
  reconcile(request: { repositoryRoot: string; contextId: string; signal: AbortSignal }): Promise<ReconciliationReport>;
}

export function defaultKnowledgeCliPort(): RepositoryKnowledgeCliPort {
  return {
    async context({ repositoryRoot, ...request }) {
      const service = await RepositoryKnowledgeService.create(repositoryRoot);
      return service.context(request);
    },
    async reconcile({ repositoryRoot, contextId, signal }) {
      const service = await RepositoryKnowledgeService.create(repositoryRoot);
      return service.reconcile(contextId, { signal });
    },
  };
}

/** Transport projection only: preserve compiled meaning and uncertainty, omit internal query transcripts. */
type ContextBranch = KnowledgeContextResult["branches"][number];
type ContextItem = ContextBranch["context"]["items"][number];
type LensObligation = ContextBranch["lensObligations"][number];
type DeferredContextItemGroup = Pick<ContextItem, "kind" | "band" | "disclosure"> & {
  reason: string;
  items: Array<Pick<ContextItem, "entityId"> & { contentBytes: number }>;
};
type GroupedObligation = Omit<LensObligation, "unitId" | "membershipFingerprint" | "applicabilityFingerprint" | "unknowns"> & {
  unitIds: string[];
  unitCount: number;
  omittedUnitCount: number;
  membershipFingerprintVariants: number;
  applicabilityFingerprintVariants: number;
  unknowns: string[];
  unknownCount: number;
  omittedUnknownCount: number;
};
type DeferredObligation = Pick<GroupedObligation, "lensId" | "lensVersion" | "authorityRecordId" | "ruleIds" | "validatorIds" | "expectationKinds" | "status" | "unitCount"> & {
  reason: string;
  predicateCount: number;
  unknownCount: number;
  ruleDisclosure: DisclosureCount;
  validatorDisclosure: DisclosureCount;
  expectationDisclosure: DisclosureCount;
};
type DisclosureCount = { total: number; included: number; omitted: number };
type FullEvidenceInstruction = { command: "projector"; arguments: string[]; note: string };
type CandidateMeaning = {
  entityId: string;
  title: string | null;
  statement: string | null;
  sourceSemanticHash: string | null;
  titleTruncated: boolean;
  statementTruncated: boolean;
  fullRecordAvailable: boolean;
};
type UnknownGroup = { reason: string; total: number; examples: string[]; omitted: number };
type DecisionValidity = NonNullable<ContextBranch["decisionValidity"]>[number];
type DecisionView = {
  decisionId: string; authorityId: string; state: DecisionValidity["assessment"]["state"]; blocksCurrentChange: boolean;
  baselineKind: DecisionValidity["baseline"]["kind"]; checks: Array<{ type: string; status: string; reason: string; reasonTruncated: boolean }>;
  checkDisclosure: DisclosureCount; checkCounts: { current: number; fired: number; unknown: number; unobserved: number };
};
type DecisionDisclosure = { decisions: DecisionView[]; disclosure: DisclosureCount; blocked: number };

const OVERVIEW_CONTENT_BUDGET = 16_000;
const FOCUSED_CONTENT_BUDGET = 32_000;
const OBLIGATION_BUDGET = 16_000;
const MESSAGE_BUDGET = 4_096;
const SOURCE_SAMPLE_LIMIT = 8;
const UNIT_SAMPLE_LIMIT = 12;
const IDENTITY_SAMPLE_LIMIT = 24;
const BRANCH_SAMPLE_LIMIT = 12;
const CANDIDATE_SAMPLE_LIMIT = 12;
const OBLIGATION_SUMMARY_SAMPLE_LIMIT = 12;

type ContextView = Omit<ContextReport, "branches" | "interpretation" | "unknowns"> & {
  detail: "agent";
  interpretation: ContextReport["interpretation"] & { candidateDisclosure: DisclosureCount; unknownDisclosure: DisclosureCount };
  candidateMeanings: CandidateMeaning[];
  unknowns: string[];
  unknownGroups: UnknownGroup[];
  branches: Array<Pick<ContextBranch, "id" | "interpretation" | "hypothesis" | "frontier"> & {
    context: Pick<ContextBranch["context"], "items" | "estimatedCost" | "requiredBudgetOverrun" | "requiredExpansionIds"> & {
      itemsDisclosure: DisclosureCount;
      deferredItems: DeferredContextItemGroup[];
      deferredIdentityDisclosure: DisclosureCount;
      requiredExpansionDisclosure: DisclosureCount;
      requiredDisclosureExpansionIds: string[];
      requiredDisclosureExpansion: DisclosureCount;
    };
    lensObligations: GroupedObligation[];
    obligationDisclosure: DisclosureCount;
    deferredObligations: DeferredObligation[];
    deferredObligationDisclosure: DisclosureCount;
    frontierDisclosure: DisclosureCount;
    decisionValidity: DecisionDisclosure;
    governance: { evaluationCount: number; violated: number; unknown: number; criticalFindings: GovernanceFinding[]; criticalFindingDisclosure: DisclosureCount };
    fullEvidence: FullEvidenceInstruction;
  }>;
  branchDisclosure: DisclosureCount;
  unknownDisclosure: DisclosureCount;
  inspection: string;
};
type GovernanceReport = NonNullable<ReconciliationReport["governance"]>;
type GovernanceFinding = GovernanceReport["branches"][number]["evaluations"][number]["findings"][number];
type ReconciliationView = Pick<ReconciliationReport, "contextId" | "status"> & {
  detail: "agent";
  reasons: string[];
  reasonDisclosure: DisclosureCount;
  branches: Array<{ branchId: string } & Pick<KnowledgeReconciliationResult["branches"][number]["validation"], "status" | "changedValueDependencyIds" | "changedQueryDependencyIds"> & {
    reasons: string[];
    reasonDisclosure: DisclosureCount;
    changedValueDependencyDisclosure: DisclosureCount;
    changedQueryDependencyDisclosure: DisclosureCount;
  }>;
  branchDisclosure: DisclosureCount;
  impact?: ReturnType<typeof projectImpact>;
  governance: undefined | Pick<GovernanceReport, "status" | "regeneratedContextId"> & {
    reasons: string[];
    reasonDisclosure: DisclosureCount;
    branches: Array<Pick<GovernanceReport["branches"][number], "interpretationEntityId" | "retainedBranchId" | "currentBranchId" | "status"> & {
      reasons: string[];
      reasonDisclosure: DisclosureCount;
      evaluationCount: number;
      findingCounts: { satisfied: number; violated: number; unknown: number };
      criticalFindings: GovernanceFinding[];
      criticalFindingDisclosure: DisclosureCount;
      decisionValidity: DecisionDisclosure;
    }>;
    branchDisclosure: DisclosureCount;
  };
  inspection: string;
};

export function presentKnowledgeContext(report: ContextReport): ContextView {
  const focused = report.interpretation.status === "direct";
  const disclosedBranches = report.branches.slice(0, BRANCH_SAMPLE_LIMIT);
  const disclosedCandidates = report.interpretation.candidates.slice(0, CANDIDATE_SAMPLE_LIMIT);
  const perBranchContentBudget = Math.floor((focused ? FOCUSED_CONTENT_BUDGET : OVERVIEW_CONTENT_BUDGET) / Math.max(1, disclosedBranches.length));
  const interpretationUnknowns = boundedStrings(report.interpretation.unknowns, MESSAGE_BUDGET);
  const unknowns = groupedUnknowns(report.unknowns);
  let remainingContentBudget = focused ? FOCUSED_CONTENT_BUDGET : OVERVIEW_CONTENT_BUDGET;
  let remainingDecisionBudget = MESSAGE_BUDGET;
  let remainingGovernanceBudget = MESSAGE_BUDGET;
  return {
    detail: "agent" as const,
    id: report.id, request: report.request, persisted: report.persisted,
    ...(report.contentHash === undefined ? {} : { contentHash: report.contentHash }),
    interpretation: { ...report.interpretation, candidates: disclosedCandidates, candidateDisclosure: count(report.interpretation.candidates.length, disclosedCandidates.length), unknowns: interpretationUnknowns.included, unknownDisclosure: interpretationUnknowns.disclosure },
    candidateMeanings: disclosedCandidates.map(({ entityId }) => candidateMeaning(entityId, report.branches)),
    branches: disclosedBranches.map(({ id, interpretation, hypothesis, context, lensObligations, frontier, decisionValidity, governanceEvaluations }) => {
      const projectedItems = projectContextItems(context.items, focused, focused ? perBranchContentBudget : remainingContentBudget);
      remainingContentBudget -= projectedItems.included.reduce((bytes, item) => bytes + serializedBytes(item), 0);
      const projectedObligations = projectObligations(lensObligations, focused);
      const frontierLimit = focused ? 24 : 8;
      const disclosedFrontier = frontier.slice(0, frontierLimit);
      const requiredExpansionIds = context.requiredExpansionIds.slice(0, IDENTITY_SAMPLE_LIMIT);
      const requiredDisclosureIds = focused
        ? projectedItems.requiredDisclosureExpansionIds.slice(0, IDENTITY_SAMPLE_LIMIT)
        : [];
      const decisions = projectDecisionValidity(decisionValidity ?? [], remainingDecisionBudget);
      remainingDecisionBudget -= decisions.decisions.reduce((bytes, item) => bytes + serializedBytes(item), 0);
      const governance = projectContextGovernance(governanceEvaluations ?? [], remainingGovernanceBudget);
      remainingGovernanceBudget -= governance.criticalFindings.reduce((bytes, item) => bytes + serializedBytes(item), 0);
      return {
        id, interpretation, hypothesis,
        context: {
          items: projectedItems.included,
          estimatedCost: context.estimatedCost,
          requiredBudgetOverrun: context.requiredBudgetOverrun,
          requiredExpansionIds,
          requiredExpansionDisclosure: count(context.requiredExpansionIds.length, requiredExpansionIds.length),
          itemsDisclosure: count(context.items.length, projectedItems.included.length),
          deferredItems: projectedItems.deferred,
          deferredIdentityDisclosure: projectedItems.deferredIdentityDisclosure,
          requiredDisclosureExpansionIds: requiredDisclosureIds,
          requiredDisclosureExpansion: count(focused ? projectedItems.requiredDisclosureExpansionIds.length : 0, requiredDisclosureIds.length),
        },
        lensObligations: projectedObligations.included,
        obligationDisclosure: count(projectedObligations.total, projectedObligations.included.length),
        deferredObligations: projectedObligations.deferred,
        deferredObligationDisclosure: projectedObligations.deferredDisclosure,
        frontier: disclosedFrontier,
        frontierDisclosure: count(frontier.length, disclosedFrontier.length),
        decisionValidity: decisions,
        governance,
        fullEvidence: fullEvidenceInstruction(report, interpretation.entityId),
      };
    }),
    branchDisclosure: count(report.branches.length, disclosedBranches.length),
    unknowns: unknowns.included,
    unknownDisclosure: unknowns.disclosure,
    unknownGroups: unknowns.groups,
    inspection: focused
      ? "This focused agent view contains whole records only. Deferred identities and counts are explicit; use each branch's fullEvidence command for the complete current context and dependency proof."
      : "Choose a candidate, then call projector.context again with that returned entity ID. Deferred identities and counts are explicit; saved knowledge remains authoritative for reconciliation.",
  };
}

function projectDecisionValidity(values: readonly DecisionValidity[], budget = MESSAGE_BUDGET): DecisionDisclosure {
  const ordered = [...values].sort((a, b) => Number(b.assessment.blocksCurrentChange) - Number(a.assessment.blocksCurrentChange));
  const decisions = ordered.slice(0, 12).map((value) => {
    const checks = [...value.checks].sort((a, b) => Number(b.status === "fired" || b.status === "unknown") - Number(a.status === "fired" || a.status === "unknown")).slice(0, 6);
    return { decisionId: value.decisionId, authorityId: value.authorityId, state: value.assessment.state, blocksCurrentChange: value.assessment.blocksCurrentChange,
      baselineKind: value.baseline.kind, checks: checks.map(({ trigger, status, reason }) => { const part = excerpt(reason, 480); return { type: trigger.type, status, reason: part.text!, reasonTruncated: part.truncated }; }),
      checkDisclosure: count(value.checks.length, checks.length), checkCounts: {
        current: value.checks.filter(({ status }) => status === "current").length, fired: value.checks.filter(({ status }) => status === "fired").length,
        unknown: value.checks.filter(({ status }) => status === "unknown").length, unobserved: value.checks.filter(({ status }) => status === "unobserved").length,
      } };
  }).filter((decision) => { const size = serializedBytes(decision); if (size > budget) return false; budget -= size; return true; });
  return { decisions, disclosure: count(values.length, decisions.length), blocked: values.filter(({ assessment }) => assessment.blocksCurrentChange).length };
}

function projectContextGovernance(values: NonNullable<ContextBranch["governanceEvaluations"]>, budget = MESSAGE_BUDGET): ContextView["branches"][number]["governance"] {
  const critical = values.flatMap(({ findings }) => findings).filter(({ status }) => status !== "satisfied");
  const criticalFindings = critical.filter((finding) => { const size = serializedBytes(finding); if (size > budget) return false; budget -= size; return true; });
  return { evaluationCount: values.length, violated: values.filter(({ status }) => status === "violated").length, unknown: values.filter(({ status }) => status === "unknown").length,
    criticalFindings, criticalFindingDisclosure: count(critical.length, criticalFindings.length) };
}

function excerpt(value: unknown, limit: number): { text: string | null; truncated: boolean } {
  if (typeof value !== "string") return { text: null, truncated: false };
  const characters = Array.from(value);
  return { text: characters.slice(0, limit).join(""), truncated: characters.length > limit };
}

function candidateMeaning(entityId: string, branches: readonly ContextBranch[]): CandidateMeaning {
  const items = branches.flatMap(({ context }) => context.items).filter((candidate) => candidate.entityId === entityId);
  const item = items.find(({ disclosure }) => disclosure === "full") ?? items[0];
  let record: Record<string, unknown> = {};
  if (item !== undefined) {
    try {
      const parsed: unknown = JSON.parse(item.content);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        const object = parsed as Record<string, unknown>;
        record = typeof object.payload === "object" && object.payload !== null && !Array.isArray(object.payload)
          ? object.payload as Record<string, unknown> : object;
      }
    } catch {
      // Context also contains plain-text observations. They have no structured
      // title or statement; the whole record remains available through drill-down.
    }
  }
  const title = excerpt(record.title ?? record.name, 160);
  const steps = Array.isArray(record.steps) ? record.steps.flatMap((step: unknown) => {
    if (typeof step !== "object" || step === null || !("statement" in step) || typeof step.statement !== "string") return [];
    return [`${"role" in step && typeof step.role === "string" ? step.role : "step"}: ${step.statement}`];
  }).join("; ") : undefined;
  const statement = excerpt(record.statement ?? record.decision ?? record.reason ?? steps ?? (item?.disclosure === "summary" ? item.content : undefined), 480);
  return { entityId, title: title.text, statement: statement.text, sourceSemanticHash: item?.sourceSemanticHash ?? null,
    titleTruncated: title.truncated, statementTruncated: statement.truncated, fullRecordAvailable: items.some(({ disclosure }) => disclosure === "full") };
}

function groupedUnknowns(values: readonly string[]): { included: string[]; disclosure: DisclosureCount; groups: UnknownGroup[] } {
  const groups = new Map<string, string[]>();
  const other: string[] = [];
  const prefix = "Relevance budget bound stopped expansion before ";
  for (const value of values) {
    if (!value.startsWith(prefix)) { other.push(value); continue; }
    const identity = value.slice(prefix.length);
    const kind = identity.startsWith("projector-projection-unit_") ? "projection units" : identity.split(":", 1)[0] ?? "entities";
    const reason = `Relevance budget stopped expansion of ${kind}`;
    const examples = groups.get(reason);
    if (examples === undefined) groups.set(reason, [identity]); else examples.push(identity);
  }
  // Group only this known, repeated diagnostic. Preserve other uncertainty
  // verbatim and never interpret a grouped frontier as an absent constraint.
  const disclosedGroups = [...groups].slice(0, IDENTITY_SAMPLE_LIMIT).map(([reason, examples]) => ({
    reason, total: examples.length, examples: examples.slice(0, 3), omitted: Math.max(0, examples.length - 3),
  }));
  const messages = boundedStrings(other, MESSAGE_BUDGET);
  return { included: messages.included, disclosure: count(values.length, messages.included.length), groups: disclosedGroups };
}

function count(total: number, included: number): DisclosureCount {
  return { total, included, omitted: total - included };
}

function serializedBytes(value: unknown): number {
  return Buffer.byteLength(canonicalJson(value), "utf8");
}

function boundedStrings(values: readonly string[], budget: number): { included: string[]; disclosure: DisclosureCount } {
  const included: string[] = [];
  let used = 0;
  for (const value of values) {
    const bytes = Buffer.byteLength(JSON.stringify(value), "utf8");
    if (used + bytes > budget) continue;
    included.push(value);
    used += bytes;
  }
  return { included, disclosure: count(values.length, included.length) };
}

function projectContextItems(items: readonly ContextItem[], focused: boolean, budget: number): {
  included: ContextItem[];
  deferred: DeferredContextItemGroup[];
  deferredIdentityDisclosure: DisclosureCount;
  requiredDisclosureExpansionIds: string[];
} {
  const sourceCandidates = items.filter((item) => item.kind === "projection-unit").slice(0, SOURCE_SAMPLE_LIMIT);
  const eligible = new Set(focused
    ? [...items.filter((item) => item.kind !== "projection-unit" && (item.band === "direct" || item.band === "governing")), ...sourceCandidates]
    : items.filter((item) => item.band === "direct"));
  const included: ContextItem[] = [];
  const deferred = new Map<string, DeferredContextItemGroup>();
  let used = 0;
  const priority = (item: ContextItem): number => item.band === "direct" ? 0 : item.band === "governing" ? 1 : 2;
  for (const item of [...items].sort((left, right) => priority(left) - priority(right))) {
    const bytes = serializedBytes(item);
    if (eligible.has(item) && used + bytes <= budget) {
      included.push(item);
      used += bytes;
      continue;
    }
    const reason = !eligible.has(item)
        ? focused ? "deferred from the focused agent view; address this identity or use fullEvidence" : "deferred until this candidate is addressed directly"
        : "whole record exceeds the remaining agent-view byte budget; use fullEvidence";
    const key = canonicalJson({ kind: item.kind, band: item.band, disclosure: item.disclosure, reason });
    const group = deferred.get(key);
    const deferredItem = { entityId: item.entityId, contentBytes: Buffer.byteLength(item.content, "utf8") };
    if (group === undefined) deferred.set(key, { kind: item.kind, band: item.band, disclosure: item.disclosure, reason, items: [deferredItem] });
    else group.items.push(deferredItem);
  }
  const allDeferred = [...deferred.values()];
  const requiredDisclosureExpansionIds = focused
    ? allDeferred.filter(({ band }) => band === "direct" || band === "governing").flatMap(({ items: groupItems }) => groupItems.map(({ entityId }) => entityId))
    : [];
  let remaining = IDENTITY_SAMPLE_LIMIT;
  const disclosedDeferred = allDeferred.flatMap((group) => {
    if (remaining === 0) return [];
    const sampledItems = group.items.slice(0, remaining);
    remaining -= sampledItems.length;
    return sampledItems.length === 0 ? [] : [{ ...group, items: sampledItems }];
  });
  return {
    included,
    deferred: disclosedDeferred,
    deferredIdentityDisclosure: count(items.length - included.length, disclosedDeferred.reduce((total, group) => total + group.items.length, 0)),
    requiredDisclosureExpansionIds,
  };
}

function fullEvidenceInstruction(report: ContextReport, entityId: string): FullEvidenceInstruction {
  return {
    command: "projector",
    arguments: ["context", "--request", report.request, "--entity", entityId, "--format", "json", "--mode", "observe"],
    note: report.persisted
      ? "Reruns full disclosure against current state; the saved context remains the reconciliation authority."
      : "Reruns full disclosure without persistence against current state.",
  };
}

function projectObligations(obligations: readonly LensObligation[], focused: boolean): { included: GroupedObligation[]; deferred: DeferredObligation[]; deferredDisclosure: DisclosureCount; total: number } {
  type Aggregate = { semantic: Omit<LensObligation, "unitId" | "membershipFingerprint" | "applicabilityFingerprint">; unitIds: string[]; memberships: Set<string>; applicability: Set<string> };
  const aggregates = new Map<string, Aggregate>();
  for (const { unitId, membershipFingerprint, applicabilityFingerprint, ...semantic } of obligations) {
    // Status, predicates, and unknowns remain in the key. Only per-unit proof
    // fingerprints are summarized, so governance distinctions cannot collapse.
    const key = canonicalJson(semantic);
    const existing = aggregates.get(key);
    if (existing === undefined) aggregates.set(key, { semantic, unitIds: [unitId], memberships: new Set([membershipFingerprint]), applicability: new Set([applicabilityFingerprint]) });
    else {
      existing.unitIds.push(unitId);
      existing.memberships.add(membershipFingerprint);
      existing.applicability.add(applicabilityFingerprint);
    }
  }
  const groups = [...aggregates.values()].map(({ semantic, unitIds, memberships, applicability }): GroupedObligation => {
    const unknownProjection = boundedStrings(semantic.unknowns, MESSAGE_BUDGET);
    return {
      ...semantic,
      unitIds: unitIds.slice(0, UNIT_SAMPLE_LIMIT),
      unitCount: unitIds.length,
      omittedUnitCount: Math.max(0, unitIds.length - UNIT_SAMPLE_LIMIT),
      membershipFingerprintVariants: memberships.size,
      applicabilityFingerprintVariants: applicability.size,
      unknowns: unknownProjection.included,
      unknownCount: semantic.unknowns.length,
      omittedUnknownCount: unknownProjection.disclosure.omitted,
    };
  });
  const included: GroupedObligation[] = [];
  const deferred: DeferredObligation[] = [];
  let used = 0;
  for (const group of groups) {
    const bytes = serializedBytes(group);
    if (focused && used + bytes <= OBLIGATION_BUDGET) {
      included.push(group);
      used += bytes;
      continue;
    }
    const ruleIds = group.ruleIds.slice(0, IDENTITY_SAMPLE_LIMIT);
    const validatorIds = group.validatorIds.slice(0, IDENTITY_SAMPLE_LIMIT);
    const expectationKinds = group.expectationKinds.slice(0, IDENTITY_SAMPLE_LIMIT);
    deferred.push({
      lensId: group.lensId,
      lensVersion: group.lensVersion,
      authorityRecordId: group.authorityRecordId,
      ruleIds,
      ruleDisclosure: count(group.ruleIds.length, ruleIds.length),
      validatorIds,
      validatorDisclosure: count(group.validatorIds.length, validatorIds.length),
      expectationKinds,
      expectationDisclosure: count(group.expectationKinds.length, expectationKinds.length),
      status: group.status,
      unitCount: group.unitCount,
      predicateCount: group.predicates.length,
      unknownCount: group.unknownCount,
      reason: focused ? "whole obligation exceeds the remaining agent-view byte budget; use fullEvidence" : "predicate detail is deferred until this candidate is addressed directly",
    });
  }
  const disclosedDeferred = deferred.slice(0, OBLIGATION_SUMMARY_SAMPLE_LIMIT);
  return { included, deferred: disclosedDeferred, deferredDisclosure: count(deferred.length, disclosedDeferred.length), total: groups.length };
}

export function presentKnowledgeReconciliation(report: ReconciliationReport): ReconciliationView {
  const reasons = boundedStrings(report.reasons, MESSAGE_BUDGET);
  const disclosedBranches = report.branches.slice(0, BRANCH_SAMPLE_LIMIT);
  return {
    detail: "agent" as const,
    contextId: report.contextId, status: report.status, reasons: reasons.included, reasonDisclosure: reasons.disclosure,
    branches: disclosedBranches.map(({ branchId, validation }) => ({
      ...projectBindingValidation(branchId, validation),
    })),
    branchDisclosure: count(report.branches.length, disclosedBranches.length),
    governance: report.governance === undefined ? undefined : projectGovernance(report.governance),
    ...(report.impact === undefined ? {} : { impact: projectImpact(report.impact) }),
    inspection: `Run projector reconcile ${report.contextId} --format json for the full dependency proof, governance evaluations, impact and Planning Surprise evidence.`,
  };
}

function projectImpact(impact: NonNullable<ReconciliationReport["impact"]>) {
  const sample = (ids: readonly string[]) => ({ ids: ids.slice(0, IDENTITY_SAMPLE_LIMIT), disclosure: count(ids.length, Math.min(ids.length, IDENTITY_SAMPLE_LIMIT)) });
  const diagnostics = boundedStrings(impact.diagnostics, MESSAGE_BUDGET);
  return { status: impact.status, contentHash: impact.contentHash, repairRoute: impact.repairRoute,
    predicted: sample(impact.predictedUnitIds), observedChanged: sample(impact.observedChangedUnitIds), knownAffected: sample(impact.knownAffectedUnitIds),
    possibleFrontier: sample(impact.possibleFrontierUnitIds), backdated: sample(impact.backdatedUnitIds), blocked: sample(impact.blockedUnitIds),
    surpriseDisclosure: count(impact.surprises.length, Math.min(impact.surprises.length, 3)),
    surprises: impact.surprises.slice(0, 3).map((surprise) => ({ id: surprise.id, kind: surprise.kind, disposition: surprise.disposition, unexpected: sample(surprise.unexpectedEntityIds), contentHash: surprise.contentHash })),
    candidateRelationDisclosure: count(impact.candidateRelations.length, Math.min(impact.candidateRelations.length, 8)),
    candidateRelations: impact.candidateRelations.slice(0, 8).map(({ id, fromId, toId, sourceClass, evidenceHash }) => ({ id, fromId, toId, sourceClass, evidenceHash })),
    diagnostics: diagnostics.included, diagnosticDisclosure: diagnostics.disclosure,
    limits: "Derived impact and candidate relations do not establish behavioral equivalence or canonical authority. Inspect omitted evidence before relying on this boundary.",
  };
}

function projectBindingValidation(branchId: string, validation: KnowledgeReconciliationResult["branches"][number]["validation"]): ReconciliationView["branches"][number] {
  const reasons = boundedStrings(validation.reasons, MESSAGE_BUDGET);
  const changedValueDependencyIds = validation.changedValueDependencyIds.slice(0, IDENTITY_SAMPLE_LIMIT);
  const changedQueryDependencyIds = validation.changedQueryDependencyIds.slice(0, IDENTITY_SAMPLE_LIMIT);
  return {
      branchId, status: validation.status, reasons: reasons.included, reasonDisclosure: reasons.disclosure,
      changedValueDependencyIds,
      changedValueDependencyDisclosure: count(validation.changedValueDependencyIds.length, changedValueDependencyIds.length),
      changedQueryDependencyIds,
      changedQueryDependencyDisclosure: count(validation.changedQueryDependencyIds.length, changedQueryDependencyIds.length),
  };
}

function projectGovernance(governance: GovernanceReport): NonNullable<ReconciliationView["governance"]> {
  const reasons = boundedStrings(governance.reasons, MESSAGE_BUDGET);
  const disclosedBranches = governance.branches.slice(0, BRANCH_SAMPLE_LIMIT);
  let remainingCriticalBudget = OBLIGATION_BUDGET;
  let remainingDecisionBudget = MESSAGE_BUDGET;
  return {
    status: governance.status,
    regeneratedContextId: governance.regeneratedContextId,
    reasons: reasons.included,
    reasonDisclosure: reasons.disclosure,
    branches: disclosedBranches.map((branch) => {
      const branchReasons = boundedStrings(branch.reasons, MESSAGE_BUDGET);
      const findings = branch.evaluations.flatMap(({ findings: evaluationFindings }) => evaluationFindings);
      const critical = findings.filter(({ status }) => status === "violated" || status === "unknown");
      const criticalFindings: GovernanceFinding[] = [];
      for (const finding of critical) {
        const bytes = serializedBytes(finding);
        if (bytes > remainingCriticalBudget) continue;
        criticalFindings.push(finding);
        remainingCriticalBudget -= bytes;
      }
      const decisions = projectDecisionValidity(branch.decisionValidity ?? [], remainingDecisionBudget);
      remainingDecisionBudget -= decisions.decisions.reduce((bytes, item) => bytes + serializedBytes(item), 0);
      return {
        interpretationEntityId: branch.interpretationEntityId,
        ...(branch.retainedBranchId === undefined ? {} : { retainedBranchId: branch.retainedBranchId }),
        ...(branch.currentBranchId === undefined ? {} : { currentBranchId: branch.currentBranchId }),
        status: branch.status,
        reasons: branchReasons.included,
        reasonDisclosure: branchReasons.disclosure,
        evaluationCount: branch.evaluations.length,
        findingCounts: {
          satisfied: findings.filter(({ status }) => status === "satisfied").length,
          violated: findings.filter(({ status }) => status === "violated").length,
          unknown: findings.filter(({ status }) => status === "unknown").length,
        },
        criticalFindings,
        criticalFindingDisclosure: count(critical.length, criticalFindings.length),
        decisionValidity: decisions,
      };
    }),
    branchDisclosure: count(governance.branches.length, disclosedBranches.length),
  };
}

export function renderKnowledgeContext(report: ContextReport): string {
  const candidates = report.interpretation.candidates.map((candidate) =>
    `${candidate.direct ? "Selected" : "Candidate"}: ${candidate.entityId} (${candidate.entityKind}) — ${candidate.explanation}`);
  const items = report.branches.flatMap((branch) => branch.context.items);
  const meanings = items.filter(item => item.kind !== "projection-unit");
  const units = items.filter(item => item.kind === "projection-unit");
  const branches = meanings.map(item => `[${item.band}] ${item.entityId}: ${readableMeaning(item.content)}`);
  return [
    `Context: ${report.id}${report.persisted ? "" : " (not saved)"}`,
    `Interpretation: ${report.interpretation.status}`,
    ...candidates,
    ...branches,
    ...units.slice(0, 12).map(item => `Source: ${item.content}`),
    ...(units.length > 12 ? [`${units.length - 12} additional source entries are available with --format json.`] : []),
    ...report.unknowns.slice(0, 3).map((unknown) => `Unknown: ${unknown}`),
    ...(report.unknowns.length > 3 ? [`${report.unknowns.length - 3} additional unknowns are available with --format json.`] : []),
  ].join("\n");
}

function readableMeaning(content: string): string {
  try {
    const value: unknown = JSON.parse(content);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return content;
    const nested = value as Record<string, unknown>;
    const entity = typeof nested.record === "object" && nested.record !== null ? nested.record as Record<string, unknown> : nested;
    const statement = entity.statement ?? entity.decision ?? entity.purpose;
    if (typeof statement !== "string") return content;
    const authority = (nested.authority as { payload?: Record<string, unknown> } | undefined)?.payload;
    return statement + (entity.scope === undefined ? "" : `\nScope: ${JSON.stringify(entity.scope)}`)
      + (authority === undefined ? "" : `\nRationale: ${authority.rationale}\nAssumptions: ${JSON.stringify(authority.assumptions)}\nReconsider when: ${JSON.stringify(authority.reconsiderWhen)}`);
  } catch { return content; }
}

export function renderKnowledgeReconciliation(report: ReconciliationReport): string {
  return [`Knowledge: ${report.status} (${report.contextId})`,
    ...(report.governance === undefined ? [] : [`Current architecture: ${report.governance.status}`, ...report.governance.reasons]),
    ...(report.impact === undefined ? [] : [`Impact: ${report.impact.status}; ${report.impact.knownAffectedUnitIds.length} known affected, ${report.impact.possibleFrontierUnitIds.length} possible, ${report.impact.surprises.length} surprises; next: ${report.impact.repairRoute}. Full evidence: --format json.`]),
    ...report.reasons.slice(0, 8),
    ...(report.reasons.length > 8 ? [`${report.reasons.length - 8} additional dependency reasons are available with --format json.`] : []),
  ].join("\n");
}
