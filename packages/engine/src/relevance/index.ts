import {
  canonicalJson,
  hashFramedDomain,
  type AdapterContext,
  type ContentHash,
  type EvidenceRef,
  type PlanningSurprise,
  type RelationType,
  type RelevanceBand,
  type RelevanceClosure,
  type RelevanceEntry,
  type RelevanceReason,
  type RelevanceSeed,
  type SemanticIdentityResolution,
  type StateDigest,
  type StateQueryDependency,
  type StateValueDependencyRef,
} from "@projector/core";

import { createStateBinding } from "../state/index.js";

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort(compareStrings);
const bandRank: Record<RelevanceBand, number> = { direct: 0, governing: 1, consequence: 2, possible: 3 };

export interface IntentAnalysisInput {
  request: string;
  outcomes: readonly string[];
  constraints: readonly string[];
  nonGoals: readonly string[];
  implementationProposals: readonly string[];
}

export interface IntentAnalysis {
  request: string;
  what: string[];
  why: string[];
  nonGoals: string[];
  solutionProposals: string[];
  behavioralMeaning: string;
  contentHash: ContentHash;
}

/** Normalizes explicit WHAT/WHY fields while quarantining solution-shaped HOW proposals. */
export function analyzeIntent(input: IntentAnalysisInput): IntentAnalysis {
  const value = {
    request: input.request.normalize("NFKC").trim(),
    what: sortedUnique(input.outcomes.map((item) => item.normalize("NFKC").trim()).filter(Boolean)),
    why: sortedUnique(input.constraints.map((item) => item.normalize("NFKC").trim()).filter(Boolean)),
    nonGoals: sortedUnique(input.nonGoals.map((item) => item.normalize("NFKC").trim()).filter(Boolean)),
    solutionProposals: sortedUnique(input.implementationProposals.map((item) => item.normalize("NFKC").trim()).filter(Boolean)),
  };
  const behavioralMeaning = [...value.what, ...value.why, ...value.nonGoals.map((item) => `not: ${item}`)].join("; ");
  return { ...value, behavioralMeaning, contentHash: hashFramedDomain("intent-analysis", { ...value, behavioralMeaning }) };
}

export interface RelevanceScoutResult {
  seeds: RelevanceSeed[];
  discoveredIds: string[];
  questions: string[];
  unavailableLanes: string[];
  contentHash: ContentHash;
}

export interface RelevanceScoutPort {
  inspect(input: { request: string; namedTargets: readonly string[] }): Promise<Omit<RelevanceScoutResult, "contentHash">>;
}

/** Read-only WHERE/WHAT-ELSE analysis is injected independently from intent analysis. */
export async function scoutRelevance(
  input: { request: string; namedTargets: readonly string[] },
  port: RelevanceScoutPort,
): Promise<RelevanceScoutResult> {
  const raw = await port.inspect({ request: input.request, namedTargets: sortedUnique(input.namedTargets) });
  const seeds = normalizeSeeds(raw.seeds);
  const value = {
    seeds,
    discoveredIds: sortedUnique(raw.discoveredIds),
    questions: sortedUnique(raw.questions),
    unavailableLanes: sortedUnique(raw.unavailableLanes),
  };
  return { ...value, contentHash: hashFramedDomain("relevance-scout", value) };
}

export interface RelevanceDiscoveryEdge {
  entityId: string;
  band: Exclude<RelevanceBand, "direct">;
  score: number;
  requiredForPlanning: boolean;
  reason: RelevanceReason;
  cost: number;
}

export interface RelevanceDiscoveryResult {
  edges: readonly RelevanceDiscoveryEdge[];
  dependency: StateQueryDependency;
}

export interface RelevanceDiscoveryPort {
  discover(subjectId: string, depth: number, context: AdapterContext): Promise<RelevanceDiscoveryResult>;
}

export interface RelevancePolicy {
  maxEntries: number;
  maxDepth: number;
  maxCost: number;
  minimumScore: number;
}

export interface CompileRelevanceClosureInput {
  request: string;
  seeds: readonly RelevanceSeed[];
  identityResolution: SemanticIdentityResolution;
  activatedFacetKeys: readonly string[];
  compiledAgainst: StateDigest;
  context: AdapterContext;
  discovery: RelevanceDiscoveryPort;
  valueDependencies: readonly StateValueDependencyRef[];
  policy: RelevancePolicy;
}

export interface RelevanceMetrics {
  consideredEdgeCount: number;
  includedEdgeCount: number;
  irrelevantExpansionRate: number;
  closureSize: number;
}

export interface RelevanceCompilation {
  closure: RelevanceClosure;
  frontier: string[];
  metrics: RelevanceMetrics;
}

function normalizeSeeds(seeds: readonly RelevanceSeed[]): RelevanceSeed[] {
  const unique = new Map<string, RelevanceSeed>();
  for (const seed of seeds) {
    if (seed.confidence < 0 || seed.confidence > 1 || !Number.isFinite(seed.confidence)) throw new Error("seed confidence must be within 0..1");
    const normalized = structuredClone(seed);
    unique.set(canonicalJson(normalized), normalized);
  }
  return [...unique.entries()].sort(([left], [right]) => compareStrings(left, right)).map(([, value]) => value);
}

function validatePolicy(policy: RelevancePolicy): void {
  if (!Number.isInteger(policy.maxEntries) || policy.maxEntries < 1) throw new Error("Relevance maxEntries must be a positive integer");
  if (!Number.isInteger(policy.maxDepth) || policy.maxDepth < 0) throw new Error("Relevance maxDepth must be a non-negative integer");
  if (![policy.maxCost, policy.minimumScore].every(Number.isFinite) || policy.maxCost < 0 || policy.minimumScore < 0 || policy.minimumScore > 1) {
    throw new Error("Relevance cost and score bounds are invalid");
  }
}

function normalizeReason(reason: RelevanceReason): RelevanceReason {
  if (![reason.weight, reason.confidence].every(Number.isFinite) || reason.confidence < 0 || reason.confidence > 1) {
    throw new Error("Relevance reason confidence and weight must be finite and confidence must be within 0..1");
  }
  return { ...structuredClone(reason), evidenceIds: sortedUnique(reason.evidenceIds) };
}

function entryOrder(left: RelevanceEntry, right: RelevanceEntry): number {
  return bandRank[left.band] - bandRank[right.band] || right.score - left.score || compareStrings(left.entityId, right.entityId);
}

function chooseBand(left: RelevanceBand, right: RelevanceBand): RelevanceBand {
  return bandRank[left] <= bandRank[right] ? left : right;
}

function addEntry(entries: Map<string, RelevanceEntry>, candidate: RelevanceEntry): boolean {
  const existing = entries.get(candidate.entityId);
  if (existing === undefined) {
    entries.set(candidate.entityId, candidate);
    return true;
  }
  const reasons = new Map([...existing.reasons, ...candidate.reasons].map((reason) => [canonicalJson(reason), reason]));
  entries.set(candidate.entityId, {
    entityId: candidate.entityId,
    band: chooseBand(existing.band, candidate.band),
    score: Math.max(existing.score, candidate.score),
    requiredForPlanning: existing.requiredForPlanning || candidate.requiredForPlanning,
    reasons: [...reasons.entries()].sort(([left], [right]) => compareStrings(left, right)).map(([, value]) => value),
  });
  return false;
}

function openWorldUnknown(dependency: StateQueryDependency): string | undefined {
  const { observability, resultCount } = dependency.priorResult;
  if (observability !== "open" && observability !== "sampled") return undefined;
  return resultCount === 0
    ? `${dependency.query.id} returned empty under ${observability} observability and cannot prove absence or completeness`
    : `${dependency.query.id} used ${observability} observability and cannot prove the consumer enumeration complete or exclude additional results`;
}

/**
 * Deterministic bounded graph expansion. Every executed boundary query, including an empty leaf/stopping query,
 * is retained in StateBinding. Unexecuted budget frontiers remain explicit unknowns.
 */
export async function compileRelevanceClosure(input: CompileRelevanceClosureInput): Promise<RelevanceCompilation> {
  validatePolicy(input.policy);
  if (canonicalJson(input.identityResolution.boundState.compiledAgainst) !== canonicalJson(input.compiledAgainst)) {
    throw new Error("semantic identity evidence is stale: it was compiled against a different state snapshot");
  }
  const seeds = normalizeSeeds(input.seeds);
  const entries = new Map<string, RelevanceEntry>();
  const queue: Array<{ entityId: string; depth: number }> = [];
  for (const seed of seeds) {
    if (seed.subjectId === undefined) continue;
    const entityId = String(seed.subjectId);
    addEntry(entries, {
      entityId,
      band: "direct",
      score: seed.confidence,
      requiredForPlanning: true,
      reasons: [{
        kind: "explicit",
        fromId: entityId,
        weight: 1,
        provenance: "declared",
        confidence: seed.confidence,
        explanation: seed.reason,
        evidenceIds: [],
      }],
    });
    queue.push({ entityId, depth: 0 });
  }
  for (const entityId of sortedUnique(input.identityResolution.selectedEntityIds)) {
    const created = addEntry(entries, {
      entityId,
      band: "direct",
      score: input.identityResolution.confidence,
      requiredForPlanning: true,
      reasons: [{
        kind: "identity-match", fromId: input.identityResolution.id, weight: 1,
        provenance: "derived", confidence: input.identityResolution.confidence,
        explanation: `selected by semantic identity resolution ${input.identityResolution.id}`,
        evidenceIds: input.identityResolution.evidence.map(({ evidenceId }) => evidenceId),
      }],
    });
    if (created) queue.push({ entityId, depth: 0 });
  }
  queue.sort((left, right) => left.depth - right.depth || compareStrings(left.entityId, right.entityId));
  const expanded = new Set<string>();
  const queryDependencies: StateQueryDependency[] = [...input.identityResolution.boundState.queryDependencies];
  const frontier = new Set<string>();
  const unknowns = new Set(input.identityResolution.unknowns);
  const unavailableLanes = new Set<string>();
  let consideredEdgeCount = 0;
  let includedEdgeCount = 0;
  let cost = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (expanded.has(current.entityId)) continue;
    if (current.depth > input.policy.maxDepth) {
      frontier.add(current.entityId);
      unknowns.add(`depth bound stopped expansion at ${current.entityId}`);
      continue;
    }
    expanded.add(current.entityId);
    const result = await input.discovery.discover(current.entityId, current.depth, input.context);
    queryDependencies.push(structuredClone(result.dependency));
    const negativeSpace = openWorldUnknown(result.dependency);
    if (negativeSpace !== undefined) unknowns.add(negativeSpace);
    for (const lane of result.dependency.priorResult.unavailableLanes) unavailableLanes.add(lane);
    if (result.dependency.priorResult.observability === "unavailable") {
      unavailableLanes.add(result.dependency.query.id);
      unknowns.add(`required discovery lane ${result.dependency.query.id} is unavailable`);
    }
    const edges = [...result.edges].sort((left, right) =>
      bandRank[left.band] - bandRank[right.band] || right.score - left.score || compareStrings(left.entityId, right.entityId));
    consideredEdgeCount += edges.length;
    for (const edge of edges) {
      if (!Number.isFinite(edge.score) || edge.score < 0 || edge.score > 1 || !Number.isFinite(edge.cost) || edge.cost < 0) {
        throw new Error(`invalid Relevance edge ${edge.entityId}`);
      }
      if (edge.score < input.policy.minimumScore && !edge.requiredForPlanning) {
        frontier.add(edge.entityId);
        continue;
      }
      const isNew = !entries.has(edge.entityId);
      if (isNew && (entries.size >= input.policy.maxEntries || cost + edge.cost > input.policy.maxCost)) {
        frontier.add(edge.entityId);
        unknowns.add(`Relevance budget bound stopped expansion before ${edge.entityId}`);
        continue;
      }
      if (isNew) {
        cost += edge.cost;
        includedEdgeCount += 1;
      }
      const added = addEntry(entries, {
        entityId: edge.entityId,
        band: edge.band,
        score: edge.score,
        requiredForPlanning: edge.requiredForPlanning,
        reasons: [normalizeReason(edge.reason)],
      });
      if (added) {
        queue.push({ entityId: edge.entityId, depth: current.depth + 1 });
        queue.sort((left, right) => left.depth - right.depth || compareStrings(left.entityId, right.entityId));
      }
    }
  }

  const valueDependencies = [...input.valueDependencies, ...input.identityResolution.boundState.valueDependencies];
  const boundState = createStateBinding({ compiledAgainst: input.compiledAgainst, valueDependencies, queryDependencies });
  const closureBasis = {
    requestHash: hashFramedDomain("relevance-request", input.request.normalize("NFKC").trim()),
    seeds,
    entries: [...entries.values()].sort(entryOrder),
    activatedFacetKeys: sortedUnique(input.activatedFacetKeys),
    unknowns: sortedUnique([...unknowns]),
    unavailableLanes: sortedUnique([...unavailableLanes]),
    boundState,
  };
  const contentHash = hashFramedDomain("relevance-closure", closureBasis);
  const closure: RelevanceClosure = { id: `relevance_closure_${contentHash.slice(-32)}`, ...closureBasis, contentHash };
  const rejected = consideredEdgeCount - includedEdgeCount;
  return {
    closure,
    frontier: sortedUnique([...frontier]),
    metrics: {
      consideredEdgeCount,
      includedEdgeCount,
      irrelevantExpansionRate: consideredEdgeCount === 0 ? 0 : rejected / consideredEdgeCount,
      closureSize: closure.entries.length,
    },
  };
}

export type SurpriseClassification =
  | "legitimate-new-relationship"
  | "legitimate-scope-expansion"
  | "agent-overreach"
  | "missing-predicted-impact"
  | "incidental-change";

export interface ObservedPlanningImpact {
  entityId: string;
  impact: "semantic" | "code";
  legitimacy: "required" | "unexplained" | "analysis-deficiency" | "incidental";
  authorized: boolean;
  evidence: readonly EvidenceRef[];
  proposedRelation?: { fromId: string; toId: string; type: RelationType };
}

export interface RelationshipProposal {
  id: string;
  status: "proposed";
  canonical: false;
  sourceClass: "derived" | "inferred";
  fromId: string;
  toId: string;
  type: RelationType;
  evidence: EvidenceRef[];
  contentHash: ContentHash;
}

export interface PlanningSurpriseClassification {
  classification: SurpriseClassification;
  surprise: PlanningSurprise;
  proposals: RelationshipProposal[];
}

function classify(unexpected: readonly ObservedPlanningImpact[]): SurpriseClassification {
  if (unexpected.some(({ legitimacy }) => legitimacy === "unexplained")) return "agent-overreach";
  if (unexpected.some(({ legitimacy, authorized }) => legitimacy === "required" && !authorized)) return "legitimate-scope-expansion";
  if (unexpected.some(({ legitimacy, proposedRelation, evidence }) => legitimacy === "required" && proposedRelation !== undefined && evidence.length > 0)) {
    return "legitimate-new-relationship";
  }
  if (unexpected.some(({ legitimacy }) => legitimacy === "analysis-deficiency")) return "missing-predicted-impact";
  return "incidental-change";
}

/** Compares immutable prediction with observation; proposals remain non-canonical evidence pending normal promotion. */
export function classifyPlanningSurprise(input: {
  planId: string;
  predictedEntityIds: readonly string[];
  observed: readonly ObservedPlanningImpact[];
}): PlanningSurpriseClassification {
  const predictedEntityIds = sortedUnique(input.predictedEntityIds);
  const predicted = new Set(predictedEntityIds);
  const observed = [...input.observed]
    .map((item) => ({ ...structuredClone(item), evidence: [...item.evidence].sort((left, right) => compareStrings(canonicalJson(left), canonicalJson(right))) }))
    .sort((left, right) => compareStrings(left.entityId, right.entityId) || compareStrings(canonicalJson(left), canonicalJson(right)));
  const observedEntityIds = sortedUnique(observed.map(({ entityId }) => entityId));
  const unexpected = observed.filter(({ entityId }) => !predicted.has(entityId));
  const unexpectedEntityIds = sortedUnique(unexpected.map(({ entityId }) => entityId));
  const classification = classify(unexpected);
  const proposals: RelationshipProposal[] = classification === "legitimate-new-relationship"
    ? unexpected.flatMap(({ proposedRelation, evidence }) => {
      if (proposedRelation === undefined || evidence.length === 0) return [];
      const basis = { ...proposedRelation, evidence };
      const contentHash = hashFramedDomain("relationship-proposal", basis);
      return [{
        id: `relationship_proposal_${contentHash.slice(-32)}`,
        status: "proposed" as const,
        canonical: false as const,
        sourceClass: "inferred" as const,
        ...proposedRelation,
        evidence: [...evidence],
        contentHash,
      }];
    }).sort((left, right) => compareStrings(left.id, right.id))
    : [];
  const kind: PlanningSurprise["kind"] = classification === "agent-overreach" ? "agent-overreach"
    : classification === "legitimate-scope-expansion" ? "scope-expansion"
      : classification === "legitimate-new-relationship" ? "missing-relation"
        : classification === "incidental-change" ? "benign-discovery"
          : unexpected.some(({ impact }) => impact === "semantic") ? "unpredicted-semantic-impact" : "unpredicted-code-impact";
  const disposition: PlanningSurprise["disposition"] = classification === "agent-overreach" ? "revert-overreach"
    : classification === "legitimate-scope-expansion" || classification === "missing-predicted-impact" ? "repair-plan"
      : classification === "legitimate-new-relationship" ? "accept-and-learn" : "accept-no-model-change";
  const evidence = new Map(unexpected.flatMap((item) => item.evidence).map((item) => [canonicalJson(item), item]));
  const semantic = {
    planId: input.planId,
    kind,
    predictedEntityIds,
    observedEntityIds,
    unexpectedEntityIds,
    evidence: [...evidence.entries()].sort(([left], [right]) => compareStrings(left, right)).map(([, item]) => item),
    explanation: `${classification}: ${unexpectedEntityIds.join(", ") || "no unexpected semantic entity"}`,
    disposition,
    proposedRelationIds: proposals.map(({ id }) => id),
  };
  const contentHash = hashFramedDomain("planning-surprise", semantic);
  return {
    classification,
    surprise: { id: `planning_surprise_${contentHash.slice(-32)}`, ...semantic, contentHash },
    proposals,
  };
}
