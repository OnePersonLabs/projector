import {
  canonicalJson,
  hashFramedDomain,
  type AdapterContext,
  type ChangeIntentAnalysis,
  type ChangeOperation,
  type ContentHash,
  type ImpactClosureRef,
  type RiskAssessment,
  type SemanticChange,
  type StateBinding,
  type StateBindingValidator,
  type StateDigest,
} from "@projector/core";

import { createStateBinding } from "../state/index.js";

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare);
const riskRank = (risk: RiskAssessment["class"]): number => ["R0", "R1", "R2", "R3", "R4"].indexOf(risk);

export interface AuthenticatedOperationProposal { readonly provenance: "authenticated" | "inferred" | "model"; readonly operation: ChangeOperation }
export interface ChangeRelationFact { readonly id: string; readonly subjectIds: readonly string[] }
export interface ChangeCompilerFacts {
  readonly intentAnalysis: ChangeIntentAnalysis;
  readonly identityResolutionIds: readonly string[];
  readonly relevanceClosureId: string;
  readonly analysisFacetKeys: readonly string[];
  readonly operations: readonly AuthenticatedOperationProposal[];
  readonly relations: readonly ChangeRelationFact[];
  readonly assumptions: readonly string[];
  readonly boundary: readonly string[];
  readonly boundState: StateBinding;
}
export interface AuthenticatedChangeCompilerFacts { readonly value: ChangeCompilerFacts; readonly contentHash: ContentHash }
export interface AuthenticatedImpactClosure {
  readonly knownAffectedUnitIds: readonly string[];
  readonly possibleFrontierUnitIds: readonly string[];
  readonly unavailableSurfaceIds: readonly string[];
  readonly reasons: readonly { readonly unitId: string; readonly kind: "exact" | "rule" | "heuristic" | "open"; readonly reason: string }[];
  readonly queryDependencyIds: readonly string[];
}
export interface CompiledSemanticChange {
  readonly change: Readonly<SemanticChange>;
  readonly candidateOperations: readonly ChangeOperation[];
  readonly boundState: Readonly<StateBinding>;
  readonly compilerFactsHash: ContentHash;
  readonly impactReasons: AuthenticatedImpactClosure["reasons"];
  readonly impactQueryDependencyIds: readonly string[];
}

export interface SemanticChangeCompilerPorts {
  readonly facts: { load(request: string, currentState: StateDigest): Promise<AuthenticatedChangeCompilerFacts> };
  readonly bindingValidator: StateBindingValidator;
  readonly authority: { verify(input: { readonly subjectHash: ContentHash; readonly binding: StateBinding; readonly currentState: StateDigest }): Promise<boolean> };
  readonly architecture: { preflight(facts: ChangeCompilerFacts): Promise<{ readonly allowed: boolean; readonly decisionIds: readonly string[]; readonly contentHash: ContentHash }> };
  readonly impact: { compile(facts: ChangeCompilerFacts): Promise<{ readonly value: AuthenticatedImpactClosure; readonly contentHash: ContentHash }> };
  readonly risk: { assess(input: { readonly facts: ChangeCompilerFacts; readonly impact: AuthenticatedImpactClosure }): Promise<{ readonly value: RiskAssessment; readonly contentHash: ContentHash }> };
}

function operationSubject(operation: ChangeOperation): string {
  if (operation.subjectType === "requirement") return `requirement:${operation.requirementId ?? operation.proposedRequirement?.id ?? "missing"}`;
  if (operation.subjectType === "scenario") return `scenario:${operation.scenarioId ?? operation.proposedScenario?.id ?? "missing"}`;
  return `${operation.subjectType}:${operation.subjectId ?? operation.subjectKey}`;
}

function normalizeOperations(proposals: readonly AuthenticatedOperationProposal[]): { accepted: ChangeOperation[]; candidates: ChangeOperation[] } {
  const accepted = new Map<string, ChangeOperation>(); const candidates = new Map<string, ChangeOperation>();
  for (const proposal of proposals) {
    const operation = structuredClone(proposal.operation);
    const subject = operationSubject(operation);
    if (subject.endsWith(":missing") || subject.endsWith(":")) throw new Error("change operation requires a stable subject identity");
    const target = proposal.provenance === "authenticated" ? accepted : candidates;
    const existing = target.get(subject);
    if (existing !== undefined && canonicalJson(existing) !== canonicalJson(operation)) throw new Error(`conflicting change operations for ${subject}`);
    target.set(subject, existing ?? operation);
  }
  const sort = (values: Iterable<ChangeOperation>): ChangeOperation[] => [...values].sort((a, b) => compare(operationSubject(a), operationSubject(b)) || compare(canonicalJson(a), canonicalJson(b)));
  return { accepted: sort(accepted.values()), candidates: sort(candidates.values()) };
}

function validateRelationIntegrity(operations: readonly ChangeOperation[], relations: readonly ChangeRelationFact[]): void {
  const relationOperations = new Set(operations.filter((operation) => operation.subjectType === "relation" && (operation.kind === "remove" || operation.kind === "replace")).map(operationSubject));
  for (const operation of operations) {
    if ((operation.subjectType !== "requirement" && operation.subjectType !== "scenario") || (operation.kind !== "remove" && operation.kind !== "supersede")) continue;
    const subjectId = operation.subjectType === "requirement" ? operation.requirementId : operation.scenarioId;
    if (subjectId === undefined) throw new Error("remove/supersede operation requires an existing stable subject ID");
    for (const relation of relations.filter(({ subjectIds }) => subjectIds.includes(subjectId))) {
      if (!relationOperations.has(`relation:${relation.id}`)) throw new Error(`change would leave dangling relation ${relation.id}`);
    }
  }
}

function minimumRisk(operations: readonly ChangeOperation[]): RiskAssessment["class"] {
  if (operations.some((operation) => operation.subjectType === "surface")) return "R3";
  if (operations.some((operation) => operation.subjectType === "decision" || operation.subjectType === "rule" || operation.subjectType === "relation")) return "R2";
  return operations.length === 0 ? "R0" : "R1";
}

export async function compileSemanticChange(
  input: { readonly request: string; readonly currentState: StateDigest; readonly context: AdapterContext },
  ports: SemanticChangeCompilerPorts,
): Promise<CompiledSemanticChange> {
  if (input.request.trim() === "") throw new Error("semantic change request must not be blank");
  const authenticated = await ports.facts.load(input.request, input.currentState);
  if (authenticated.contentHash !== hashFramedDomain("authenticated-change-compiler-facts", authenticated.value)) throw new Error("change compiler facts hash is not authenticated");
  const facts = structuredClone(authenticated.value);
  if (facts.intentAnalysis.request !== input.request) throw new Error("authenticated intent request does not equal the compiler request");
  const { contentHash: _intentHash, ...intentFields } = facts.intentAnalysis;
  if (facts.intentAnalysis.contentHash !== hashFramedDomain("change-intent-analysis", intentFields)) throw new Error("change intent analysis hash is invalid");
  if (facts.identityResolutionIds.length === 0 || facts.intentAnalysis.ambiguity.length > 0) throw new Error("semantic identity is missing or ambiguous");
  const allowedFacets = new Set(["behavior", "architecture", "events", "security", "realtime", "migration", "public-contract", "persistence", "performance", "observability", "compatibility", "distribution", "cleanup", "external-surface"]);
  if (facts.analysisFacetKeys.some((key) => !allowedFacets.has(key))) throw new Error("analysis facet is unsupported or selects implementation technology");
  const requestedBinding = createStateBinding(facts.boundState);
  if (requestedBinding.dependencyDigest !== facts.boundState.dependencyDigest) throw new Error("semantic change StateBinding is invalid");
  const validation = await ports.bindingValidator.validate(requestedBinding, input.currentState, input.context);
  if (validation.status !== "current" && validation.status !== "rebound") throw new Error(`semantic change binding is ${validation.status}`);
  const boundState = createStateBinding(validation.status === "rebound" ? validation.rebound! : requestedBinding);
  if (canonicalJson(boundState.compiledAgainst) !== canonicalJson(input.currentState)) throw new Error("semantic change binding is not current");
  if (!(await ports.authority.verify({ subjectHash: authenticated.contentHash, binding: boundState, currentState: input.currentState }))) throw new Error("semantic change compiler facts lack current authority");
  const normalized = normalizeOperations(facts.operations);
  validateRelationIntegrity(normalized.accepted, facts.relations);
  const architectureSubjects = new Set(["requirement", "scenario", "decision", "rule", "relation", "surface"]);
  const material = normalized.accepted.some((operation) => architectureSubjects.has(operation.subjectType)) || facts.analysisFacetKeys.includes("architecture") || facts.intentAnalysis.statements.some(({ kind }) => kind === "constraint");
  let decisionIds: readonly string[] = [];
  if (material) {
    const architecture = await ports.architecture.preflight(facts);
    if (architecture.contentHash !== hashFramedDomain("change-architecture-preflight", { allowed: architecture.allowed, decisionIds: architecture.decisionIds }) || !architecture.allowed) throw new Error("architecture preflight is unauthenticated or blocking");
    decisionIds = architecture.decisionIds;
  }
  const impact = await ports.impact.compile(facts);
  if (impact.contentHash !== hashFramedDomain("authenticated-impact-closure", impact.value)) throw new Error("impact closure hash is invalid");
  const boundQueryIds = new Set(boundState.queryDependencies.map(({ query }) => query.id));
  if (impact.value.queryDependencyIds.some((id) => !boundQueryIds.has(id))) throw new Error("impact negative-space query is absent from the final StateBinding");
  if (impact.value.reasons.some(({ kind }) => kind === "open") && impact.value.possibleFrontierUnitIds.length === 0) throw new Error("open impact evidence must widen the possible frontier");
  const risk = await ports.risk.assess({ facts, impact: impact.value });
  if (risk.contentHash !== hashFramedDomain("authenticated-change-risk", risk.value)) throw new Error("change risk hash is invalid");
  if (riskRank(risk.value.class) < riskRank(minimumRisk(normalized.accepted))) throw new Error("authenticated change risk is downgraded below inherent operation risk");
  const impactRef: ImpactClosureRef = { contentHash: impact.contentHash, knownAffectedUnitIds: unique(impact.value.knownAffectedUnitIds), possibleFrontierUnitIds: unique(impact.value.possibleFrontierUnitIds), unavailableSurfaceIds: unique(impact.value.unavailableSurfaceIds) };
  const semanticFields = { normalizedIntent: facts.intentAnalysis.normalizedIntent.trim(), intentAnalysisId: facts.intentAnalysis.id, identityResolutionIds: unique(facts.identityResolutionIds), relevanceClosureId: facts.relevanceClosureId, analysisFacetKeys: unique(facts.analysisFacetKeys), operations: normalized.accepted, decisionIds: unique(decisionIds), assumptions: unique(facts.assumptions), boundary: unique(facts.boundary), predictedImpact: impactRef, risk: risk.value };
  const identityHash = hashFramedDomain("semantic-change-identity", { ...semanticFields, stateBindingDigest: boundState.dependencyDigest, compiledAgainst: boundState.compiledAgainst });
  const change: SemanticChange = { id: `semantic_change_${identityHash.slice(-32)}`, request: facts.intentAnalysis.request, ...semanticFields, status: "analyzed" };
  return { change: Object.freeze(change), candidateOperations: Object.freeze(normalized.candidates), boundState: Object.freeze(boundState), compilerFactsHash: authenticated.contentHash, impactReasons: Object.freeze([...impact.value.reasons]), impactQueryDependencyIds: Object.freeze(unique(impact.value.queryDependencyIds)) };
}
