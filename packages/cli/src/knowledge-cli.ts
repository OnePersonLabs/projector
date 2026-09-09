import {
  RepositoryKnowledgeService,
  type KnowledgeContextRequest,
  type KnowledgeContextResult,
  type KnowledgeReconciliationResult,
} from "@projector/control-plane";
import { canonicalJson } from "@projector/core";

type ContextReport = Pick<KnowledgeContextResult, "id" | "request" | "persisted" | "interpretation" | "branches" | "unknowns">;
type ReconciliationReport = Pick<KnowledgeReconciliationResult, "contextId" | "status" | "branches" | "reasons">
  & Partial<Pick<KnowledgeReconciliationResult, "governance">>;

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
  unknowns: string[];
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
  const unknowns = boundedStrings(report.unknowns, MESSAGE_BUDGET);
  return {
    detail: "agent" as const,
    id: report.id, request: report.request, persisted: report.persisted,
    interpretation: { ...report.interpretation, candidates: disclosedCandidates, candidateDisclosure: count(report.interpretation.candidates.length, disclosedCandidates.length), unknowns: interpretationUnknowns.included, unknownDisclosure: interpretationUnknowns.disclosure },
    branches: disclosedBranches.map(({ id, interpretation, hypothesis, context, lensObligations, frontier }) => {
      const projectedItems = projectContextItems(context.items, focused, perBranchContentBudget);
      const projectedObligations = projectObligations(lensObligations, focused);
      const frontierLimit = focused ? 24 : 8;
      const disclosedFrontier = frontier.slice(0, frontierLimit);
      const requiredExpansionIds = context.requiredExpansionIds.slice(0, IDENTITY_SAMPLE_LIMIT);
      const requiredDisclosureIds = focused
        ? projectedItems.requiredDisclosureExpansionIds.slice(0, IDENTITY_SAMPLE_LIMIT)
        : [];
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
        fullEvidence: fullEvidenceInstruction(report, interpretation.entityId),
      };
    }),
    branchDisclosure: count(report.branches.length, disclosedBranches.length),
    unknowns: unknowns.included,
    unknownDisclosure: unknowns.disclosure,
    inspection: focused
      ? "This focused agent view contains whole records only. Deferred identities and counts are explicit; use each branch's fullEvidence command for the complete current context and dependency proof."
      : "Choose a candidate, then call projector.context again with that returned entity ID. Deferred identities and counts are explicit; saved knowledge remains authoritative for reconciliation.",
  };
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
  for (const item of items) {
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
    inspection: `Run projector reconcile ${report.contextId} --format json for the full dependency proof and governance evaluations.`,
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
    ...report.reasons.slice(0, 8),
    ...(report.reasons.length > 8 ? [`${report.reasons.length - 8} additional dependency reasons are available with --format json.`] : []),
  ].join("\n");
}
