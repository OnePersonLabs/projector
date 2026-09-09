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
type GroupedObligation = Omit<ContextBranch["lensObligations"][number], "unitId"> & { unitIds: string[] };
type ContextView = Omit<ContextReport, "branches"> & {
  detail: "agent";
  branches: Array<Pick<ContextBranch, "id" | "interpretation" | "hypothesis" | "frontier"> & {
    context: Pick<ContextBranch["context"], "items" | "estimatedCost" | "requiredBudgetOverrun" | "requiredExpansionIds">;
    lensObligations: GroupedObligation[];
  }>;
  inspection: string;
};
type ReconciliationView = Pick<ReconciliationReport, "contextId" | "status" | "reasons"> & {
  detail: "agent";
  branches: Array<{ branchId: string } & Pick<KnowledgeReconciliationResult["branches"][number]["validation"], "status" | "reasons" | "changedValueDependencyIds" | "changedQueryDependencyIds">>;
  governance: ReconciliationReport["governance"];
  inspection: string;
};

export function presentKnowledgeContext(report: ContextReport): ContextView {
  return {
    detail: "agent" as const,
    id: report.id, request: report.request, persisted: report.persisted,
    interpretation: report.interpretation,
    branches: report.branches.map(({ id, interpretation, hypothesis, context, lensObligations, frontier }) => ({
      id, interpretation, hypothesis,
      context: { items: context.items, estimatedCost: context.estimatedCost, requiredBudgetOverrun: context.requiredBudgetOverrun, requiredExpansionIds: context.requiredExpansionIds },
      lensObligations: groupObligations(lensObligations), frontier,
    })),
    unknowns: report.unknowns,
    inspection: "Run context without --compact for the full dependency proof. Saved knowledge remains the authoritative input to reconciliation, not this display.",
  };
}

function groupObligations(obligations: ContextBranch["lensObligations"]): GroupedObligation[] {
  const groups = new Map<string, GroupedObligation>();
  for (const { unitId, ...obligation } of obligations) {
    const key = canonicalJson(obligation);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, { ...obligation, unitIds: [unitId] });
    else group.unitIds.push(unitId);
  }
  return [...groups.values()];
}

export function presentKnowledgeReconciliation(report: ReconciliationReport): ReconciliationView {
  return {
    detail: "agent" as const,
    contextId: report.contextId, status: report.status, reasons: report.reasons,
    branches: report.branches.map(({ branchId, validation }) => ({
      branchId, status: validation.status, reasons: validation.reasons,
      changedValueDependencyIds: validation.changedValueDependencyIds,
      changedQueryDependencyIds: validation.changedQueryDependencyIds,
    })),
    governance: report.governance,
    inspection: "Run reconcile without --compact for the full dependency proof.",
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
