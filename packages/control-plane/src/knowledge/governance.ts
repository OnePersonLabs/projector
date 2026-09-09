import { canonicalJson, hashFramedDomain, type AdapterContext, type ArchitectureDecision, type AuthorityRecord, type AuthorityReconsiderTrigger, type StateQueryDependency } from "@projector/core";
import { DependencyScopedStateBindingValidator, assessDecisionValidity, createStateBinding, type GovernanceBundleEvaluation } from "@projector/engine";

import type { ChangeRepositoryObservation } from "../change-lifecycle/repository-observer.js";
import { DecisionBaselineReader, captureDecisionTriggerObservations, type DecisionBaselineEvidence, type KnowledgeDecisionBaseline } from "./decision-baselines.js";
import type { KnowledgeGraph } from "./graph.js";
import type { KnowledgeDecisionCheck, KnowledgeDecisionValidity } from "./types.js";

const unique = (items: readonly string[]) => [...new Set(items)].sort();
export interface KnowledgeDecisionHost {
  readonly now?: () => string;
  /** Exact post-state baselines for authorities accepted by the enclosing transaction only. */
  readonly acceptedDecisionBaselines?: readonly KnowledgeDecisionBaseline[];
}

export interface DecisionObservation {
  readonly decision: ArchitectureDecision;
  readonly authority?: AuthorityRecord;
  readonly baseline: Omit<DecisionBaselineEvidence, "baseline">;
  readonly checks: readonly KnowledgeDecisionCheck[];
  readonly observations: KnowledgeDecisionBaseline["observations"];
  readonly unknowns: readonly string[];
}

export class KnowledgeDecisionRun {
  private readonly baselines: DecisionBaselineReader;
  private readonly observations = new Map<string, Promise<DecisionObservation>>();
  private readonly now: string;

  constructor(private readonly observation: ChangeRepositoryObservation, private readonly host: KnowledgeDecisionHost = {}) {
    this.baselines = new DecisionBaselineReader(observation);
    this.now = (host.now ?? (() => new Date().toISOString()))();
  }

  observe(decision: ArchitectureDecision, operation: string): Promise<DecisionObservation> {
    const key = `${decision.id}\0${operation}`;
    let result = this.observations.get(key);
    if (result === undefined) { result = this.read(decision, operation); this.observations.set(key, result); }
    return result;
  }

  private async read(decision: ArchitectureDecision, operation: string): Promise<DecisionObservation> {
    const authority = this.observation.canonical.documents.find(({ id, kind }) => id === decision.authorityRecordId && kind === "authority-record")?.payload as unknown as AuthorityRecord | undefined;
    if (authority === undefined) return { decision, baseline: { kind: "unavailable", reason: "decision authority is missing" }, checks: [], observations: [], unknowns: ["decision authority is missing"] };
    const accepted = this.host.acceptedDecisionBaselines?.find((baseline) => baseline.decisionId === decision.id && baseline.decisionSemanticHash === decision.semanticHash && baseline.authorityId === authority.id && baseline.authoritySemanticHash === authority.semanticHash);
    const evidence: DecisionBaselineEvidence = accepted === undefined ? await this.baselines.read(decision, authority)
      : { kind: "authenticated-transaction", reference: "current-approved-canonical-transaction", baseline: accepted };
    const { baseline: captured, ...baseline } = evidence;
    const observed = captureDecisionTriggerObservations(decision, authority, this.observation.canonical.documents, this.observation.analysis.files.map(({ path }) => path), this.observation.analysis.surface.kind);
    const currentValues = new Map(observed.map(({ key, value }) => [key, value]));
    const baselineValues = new Map(captured?.observations.map(({ key, value }) => [key, value]));
    const checks: KnowledgeDecisionCheck[] = [];
    const add = (trigger: AuthorityReconsiderTrigger, status: KnowledgeDecisionCheck["status"], reason: string) => checks.push({ trigger, status, reason });
    const clock = Date.parse(this.now);
    for (const trigger of authority.reconsiderWhen) {
      const key = canonicalJson(trigger);
      if (currentValues.has(key)) {
        const prior = baselineValues.get(key);
        const current = currentValues.get(key)!;
        if (prior === undefined) { add(trigger, "unknown", `No accepted baseline observation for ${trigger.type}: ${evidence.reason ?? "baseline unavailable"}.`); continue; }
        let fired = canonicalJson(prior) !== canonicalJson(current);
        if (trigger.type === "scope-expanded" || trigger.type === "surface-added") {
          const field = trigger.type === "scope-expanded" ? "paths" : "surfaces";
          const before = (prior as Record<string, unknown>)[field];
          const after = (current as Record<string, unknown>)[field];
          if (!Array.isArray(before) || !Array.isArray(after)) { add(trigger, "unknown", `Baseline membership for ${trigger.type} is unavailable.`); continue; }
          fired = after.some((member) => !before.includes(member));
        }
        add(trigger, fired ? "fired" : "current", fired ? `${trigger.type} changed since the accepted authority baseline.` : `${trigger.type} has no observed change since its baseline.`);
      } else if (trigger.type === "date") {
        const deadline = Date.parse(trigger.at);
        add(trigger, !Number.isFinite(clock) || !Number.isFinite(deadline) ? "unknown" : clock >= deadline ? "fired" : "current", `Decision review date is ${trigger.at}.`);
      } else if (trigger.type === "manual-review") {
        add(trigger, operation === "review" || operation === "manual-review" ? "fired" : "unobserved", "Manual review fires only for an explicit review operation; listing it is not a permanent block.");
      } else if (trigger.type === "scope-expanded" || trigger.type === "surface-added") {
        add(trigger, "unknown", `The repository observer cannot establish ${trigger.type} for this declared selector/surface.`);
      } else {
        add(trigger, "unobserved", `${trigger.type} requires an explicit event or supported observer; its absence is not proof that the underlying assumption is true or false.`);
      }
    }
    const refresh = authority.evidenceRefreshPolicy;
    if (refresh?.mode === "max-age") {
      const trigger: AuthorityReconsiderTrigger = { type: "evidence-refresh-required", policyKey: refresh.key };
      const acceptedCreatedAt = baselineValues.get("evidence-refresh-created-at");
      const created = typeof acceptedCreatedAt === "string" ? Date.parse(acceptedCreatedAt) : NaN;
      const days = refresh.maxAgeDays;
      const known = days !== undefined && Number.isFinite(days) && days >= 0 && Number.isFinite(created) && Number.isFinite(clock);
      add(trigger, !known ? "unknown" : clock >= created + days! * 86_400_000 ? "fired" : "current", known ? `Evidence freshness expires ${days} days after accepted authority creation.` : "The required maximum-age observation is unavailable.");
    } else if (refresh?.mode === "version-sensitive") {
      add({ type: "evidence-refresh-required", policyKey: refresh.key }, "unknown", "Required version-sensitive evidence has no supported deterministic version observer.");
    }
    return { decision, authority, baseline, checks, observations: observed, unknowns: unique(checks.filter(({ status }) => status === "unknown").map(({ reason }) => reason)) };
  }
}

export async function assessKnowledgeDecisions(graph: KnowledgeGraph, decisions: readonly ArchitectureDecision[], operation: string, context: AdapterContext): Promise<{ decisions: KnowledgeDecisionValidity[]; dependencies: StateQueryDependency[] }> {
  const result: KnowledgeDecisionValidity[] = [];
  const dependencies: StateQueryDependency[] = [];
  for (const decision of decisions) {
    const observed = await graph.decisionRun.observe(decision, operation);
    const applicability = await graph.bindDecisionApplicability(decision.id, context);
    const triggers = await graph.bindDecisionTriggers(decision.id, operation, context);
    dependencies.push(applicability, triggers);
    const binding = createStateBinding({ compiledAgainst: context.stateDigest, valueDependencies: graph.valueDependencies([decision.id]), queryDependencies: [applicability, triggers] });
    const validator = new DependencyScopedStateBindingValidator({ values: { readVersionHash: async (ref) => graph.currentVersionHash(ref) }, queries: { evaluate: (query, adapter) => graph.registry.evaluate(query, adapter) } });
    const validity = await assessDecisionValidity({ decision, currentScope: decision.scope, binding, currentState: context.stateDigest, context,
      firedTriggers: observed.checks.filter(({ status }) => status === "fired").map(({ trigger }) => trigger), invalidatedAssumptions: [], staleEvidenceIds: [] }, {
      bindingValidator: validator,
      applicability: { evaluate: async () => ({ applicable: true, governedPopulationCount: applicability.priorResult.resultCount, dependency: applicability }) },
    });
    // A relevant future decision still needs its conceptual triggers checked, even
    // before implementation exists. Its validity is not evidence of implemented coverage.
    const assessment = validity.state === "valid" && applicability.priorResult.resultCount === 0
      ? { ...validity, explanation: `decision ${decision.id} has current conceptual proof but no observed governed repository units; implementation satisfaction is not established` }
      : validity;
    result.push({ decisionId: decision.id, authorityId: decision.authorityRecordId, baseline: observed.baseline, checks: observed.checks, assessment,
      contentHash: hashFramedDomain("knowledge-decision-validity", { decisionId: decision.id, baseline: observed.baseline, checks: observed.checks, assessment }) });
  }
  return { decisions: result, dependencies };
}

export function knowledgeGovernanceStatus(evaluations: readonly GovernanceBundleEvaluation[], decisions: readonly KnowledgeDecisionValidity[], unknowns: readonly string[]) {
  return evaluations.some(({ status }) => status === "violated") ? "violated" as const
    : evaluations.some(({ status }) => status === "unknown") || decisions.some(({ assessment }) => assessment.blocksCurrentChange) || unknowns.length > 0 ? "unknown" as const
      : evaluations.length > 0 || decisions.length > 0 ? "conformant" as const : "not-applicable" as const;
}
