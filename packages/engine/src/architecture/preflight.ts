import {
  AuthorityRecordSchema,
  canonicalJson,
  hashFramedDomain,
  type ArchitectureConcern,
  type ArchitectureDecision,
  type AuthorityRecord,
  type ContentHash,
  type DecisionValidityAssessment,
  type ExecutionPolicy,
  type ObservabilityClass,
  type RelevanceClosure,
  type RiskClass,
} from "@projector/core";

import { normalizeSelector } from "../governance/selectors.js";
import {
  assessDecisionDeferral,
  authorityRecordHashIsValid,
  type AuthenticatedAuthorityPort,
  type DecisionDeferralAssessmentPort,
} from "./evaluation.js";
import type { DecisionOverlapPort } from "./governance.js";

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const riskRank = (risk: RiskClass): number => ["R0", "R1", "R2", "R3", "R4"].indexOf(risk);

export interface ArchitecturePreflightInput {
  closure: RelevanceClosure;
  concerns: readonly ArchitectureConcern[];
  validity: readonly DecisionValidityAssessment[];
  overrideAuthorityRecordIds: readonly string[];
  mode: ExecutionPolicy["preset"];
  risk: RiskClass;
}

export interface ArchitecturePreflightResult {
  planningAllowed: boolean;
  governedCompletion: boolean;
  closureId: string;
  unresolvedConcernIds: string[];
  overriddenConcernIds: string[];
  code: "architecture-frontier-clear" | "exploration-only" | "unresolved-architecture-frontier";
  reasons: string[];
  contentHash: ContentHash;
  mode: ExecutionPolicy["preset"];
  risk: RiskClass;
}

function authorizedOverride(concernId: string, raw: AuthorityRecord): boolean {
  const parsed = AuthorityRecordSchema.safeParse(raw);
  if (!parsed.success) return false;
  const record = parsed.data as AuthorityRecord;
  return record.subjectId === concernId
    && record.status === "approved"
    && record.conclusion === "exception"
    && (record.decidedBy === "user" || record.decidedBy === "policy")
    && authorityRecordHashIsValid(record);
}

export interface ArchitecturePreflightPorts {
  authority: AuthenticatedAuthorityPort;
  deferral: DecisionDeferralAssessmentPort;
  validity: { verify(input: { assessment: DecisionValidityAssessment; closure: RelevanceClosure }): Promise<boolean> };
}

async function unresolvedBlockingConcern(concern: ArchitectureConcern, validity: readonly DecisionValidityAssessment[], input: ArchitecturePreflightInput, ports: ArchitecturePreflightPorts): Promise<boolean> {
  if (concern.materiality !== "blocking-now" || concern.status === "resolved" || concern.status === "dismissed" || concern.status === "superseded") return false;
  if (concern.status === "deferred" && concern.deferral !== undefined && (await assessDecisionDeferral(concern.deferral, ports.deferral)).valid) return false;
  const assessments: DecisionValidityAssessment[] = [];
  for (const assessment of validity.filter(({ decisionId }) => concern.decisionIds.includes(decisionId))) {
    if (await ports.validity.verify({ assessment: structuredClone(assessment), closure: structuredClone(input.closure) })) assessments.push(assessment);
  }
  return assessments.length === 0 || assessments.some(({ state, blocksCurrentChange }) => state !== "valid" || blocksCurrentChange);
}

/** Pure preflight consumes the supplied bounded closure and never mutates canonical or workspace state. */
export async function runArchitecturePreflight(input: ArchitecturePreflightInput, ports: ArchitecturePreflightPorts): Promise<ArchitecturePreflightResult> {
  const unresolved: ArchitectureConcern[] = [];
  for (const concern of input.concerns) if (await unresolvedBlockingConcern(concern, input.validity, input, ports)) unresolved.push(concern);
  unresolved.sort((left, right) => compareStrings(left.id, right.id));
  const overrideRecords: AuthorityRecord[] = [];
  for (const id of [...new Set(input.overrideAuthorityRecordIds)].sort(compareStrings)) {
    const record = await ports.authority.read(id);
    if (record !== undefined && record.id === id) overrideRecords.push(record);
  }
  const overriddenConcernIds = unresolved.filter((concern) => overrideRecords.some((record) => authorizedOverride(concern.id, record))).map(({ id }) => id);
  const unresolvedConcernIds = unresolved.map(({ id }) => id).filter((id) => !overriddenConcernIds.includes(id));
  const exploratory = input.mode === "observe" || input.mode === "guide";
  const policyBlocks = !exploratory && riskRank(input.risk) >= riskRank("R2") && unresolvedConcernIds.length > 0;
  const governedCompletion = unresolvedConcernIds.length === 0;
  const code = policyBlocks ? "unresolved-architecture-frontier" : governedCompletion ? "architecture-frontier-clear" : "exploration-only";
  const reasons = policyBlocks
    ? [`unresolved blocking architecture concerns: ${unresolvedConcernIds.join(", ")}`]
    : governedCompletion ? ["blocking architecture frontier is resolved, validly deferred, or explicitly overridden"]
      : ["exploratory work may continue but cannot claim governed completion"];
  const stable = { closureId: input.closure.id, unresolvedConcernIds, overriddenConcernIds, mode: input.mode, risk: input.risk, code, reasons };
  return {
    planningAllowed: !policyBlocks,
    governedCompletion,
    closureId: input.closure.id,
    unresolvedConcernIds,
    overriddenConcernIds,
    code,
    reasons,
    contentHash: hashFramedDomain("architecture-preflight", stable),
    mode: input.mode,
    risk: input.risk,
  };
}

export interface DecisionExplanation {
  decisionId: string;
  reconsidered: boolean;
  explanation: string;
  firedTriggers: DecisionValidityAssessment["firedTriggers"];
  staleEvidenceIds: string[];
}

export function explainArchitectureDecision(decision: ArchitectureDecision, validity: DecisionValidityAssessment): DecisionExplanation {
  if (decision.id !== validity.decisionId) throw new Error("decision explanation assessment identity mismatch");
  const reconsidered = validity.state !== "valid" || validity.firedTriggers.length > 0;
  const triggers = [...validity.firedTriggers].sort((left, right) => compareStrings(canonicalJson(left), canonicalJson(right)));
  const detail = triggers.length === 0 ? validity.explanation : `${validity.explanation}; fired triggers: ${triggers.map(({ type }) => type).join(", ")}`;
  return {
    decisionId: decision.id,
    reconsidered,
    explanation: reconsidered ? `Decision ${decision.id} was reconsidered: ${detail}` : `Decision ${decision.id} was not reconsidered: ${detail}`,
    firedTriggers: triggers,
    staleEvidenceIds: [...new Set(validity.staleEvidenceIds)].sort(compareStrings),
  };
}

export interface DecisionPopulationPort {
  inspect(decision: ArchitectureDecision): Promise<{ count: number; observability: ObservabilityClass }>;
}

export type DecisionAuditFindingCode =
  | "equivalent-decisions"
  | "incompatible-decision-overlap"
  | "stale-no-population"
  | "population-unproven"
  | "open-concern-without-value";

export interface DecisionAuditFinding {
  code: DecisionAuditFindingCode;
  decisionIds: string[];
  concernIds: string[];
  explanation: string;
}

export interface DecisionAuditReport {
  findings: DecisionAuditFinding[];
  contentHash: ContentHash;
}

function equivalenceKey(decision: ArchitectureDecision): string {
  const normalized = normalizeDecisionSets(decision);
  return canonicalJson({
    concernId: normalized.concernId,
    decision: normalized.decision,
    selectedOptionKey: normalized.selectedOptionKey,
    scope: normalizeSelector(normalized.scope),
    lifecycle: normalized.lifecycle,
    consequences: normalized.consequences,
    appliedPreferences: normalized.appliedPreferences,
    migrationId: normalized.migrationId,
  });
}

function canonicalSet<T>(values: readonly T[]): T[] {
  return [...new Map(values.map((value) => [canonicalJson(value), structuredClone(value)])).entries()]
    .sort(([left], [right]) => compareStrings(left, right)).map(([, value]) => value);
}

function normalizeDecisionSets(decision: ArchitectureDecision): ArchitectureDecision {
  return { ...structuredClone(decision), consequences: canonicalSet(decision.consequences), appliedPreferences: canonicalSet(decision.appliedPreferences) };
}

export async function auditArchitectureDecisions(
  input: { decisions: readonly ArchitectureDecision[]; concerns: readonly ArchitectureConcern[] },
  ports: { overlap: DecisionOverlapPort; population: DecisionPopulationPort },
): Promise<DecisionAuditReport> {
  const byId = new Map<string, ArchitectureDecision>();
  for (const raw of input.decisions) {
    const decision = normalizeDecisionSets(raw);
    const existing = byId.get(decision.id);
    if (existing !== undefined && canonicalJson(existing) !== canonicalJson(decision)) throw new Error(`conflicting decision ${decision.id}`);
    byId.set(decision.id, decision);
  }
  const decisions = [...byId.values()].sort((left, right) => compareStrings(left.id, right.id));
  const findings: DecisionAuditFinding[] = [];
  const equivalentGroups = new Map<string, ArchitectureDecision[]>();
  for (const decision of decisions) equivalentGroups.set(equivalenceKey(decision), [...(equivalentGroups.get(equivalenceKey(decision)) ?? []), decision]);
  for (const group of equivalentGroups.values()) if (group.length > 1) findings.push({
    code: "equivalent-decisions", decisionIds: group.map(({ id }) => id), concernIds: [...new Set(group.map(({ concernId }) => concernId))].sort(compareStrings), explanation: "decisions are semantically equivalent for the same concern and scope",
  });
  for (let leftIndex = 0; leftIndex < decisions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < decisions.length; rightIndex += 1) {
      const left = decisions[leftIndex]!;
      const right = decisions[rightIndex]!;
      const overlap = await ports.overlap.assess(structuredClone(left), structuredClone(right));
      if (overlap === "incompatible" || overlap === "unknown") findings.push({ code: "incompatible-decision-overlap", decisionIds: [left.id, right.id], concernIds: [...new Set([left.concernId, right.concernId])].sort(compareStrings), explanation: `${overlap} compatibility for overlapping decision scopes` });
    }
  }
  for (const decision of decisions) {
    const population = await ports.population.inspect(structuredClone(decision));
    if (!Number.isInteger(population.count) || population.count < 0) throw new Error(`invalid governed population for ${decision.id}`);
    if (population.count === 0 && population.observability === "closed") findings.push({ code: "stale-no-population", decisionIds: [decision.id], concernIds: [decision.concernId], explanation: "closed-world applicability query found no governed population" });
    else if (population.count === 0 && population.observability !== "closed") findings.push({ code: "population-unproven", decisionIds: [decision.id], concernIds: [decision.concernId], explanation: `${population.observability} observation cannot prove the governed population absent` });
  }
  for (const concern of input.concerns) if ((concern.status === "candidate" || concern.status === "active") && concern.materiality === "deferable" && concern.activationReasons.length === 0) findings.push({ code: "open-concern-without-value", decisionIds: [], concernIds: [concern.id], explanation: "deferable open concern has no current materiality reason" });
  findings.sort((left, right) => compareStrings(canonicalJson(left), canonicalJson(right)));
  return { findings, contentHash: hashFramedDomain("architecture-decision-audit", findings) };
}
