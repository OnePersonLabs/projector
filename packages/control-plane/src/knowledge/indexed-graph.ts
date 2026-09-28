import {
  hashFramedDomain,
  type AdapterContext, type CanonicalDocumentEnvelope, type ContentHash, type DerivedObservationBudget,
  type ProjectionUnit, type RelevanceBand, type RelevanceReason,
  type StateQueryDependency, type StateValueDependencyRef,
} from "@projector/core";
import { QueryDependencyRegistry, type ContextSource, type RelevanceDiscoveryEdge, type RelevanceDiscoveryPort } from "@projector/engine";
import type { SqliteObservationStore } from "@projector/runtime";
import type { IndexedObservationDescriptor } from "../observation/indexed-types.js";
import type { KnowledgeContextGraph } from "./context-graph.js";
import { candidateFor, KNOWLEDGE_QUERY_PROGRAMS, mergeCandidates, scoreLexical, tokens, type BoundQueryResult, type SemanticEntity } from "./graph.js";
import { IndexedGraphReader } from "./indexed-graph-reader.js";
import { IndexedQueryMemo } from "./indexed-query.js";
import type { KnowledgeInterpretationCandidate } from "./types.js";
import { SEMANTIC_TOPOLOGY_PROGRAM, type IndexedSemanticGraph } from "./code-graph.js";

export type IndexedGovernancePort = Pick<KnowledgeContextGraph,
  "lensObligations" | "validatorRequests" | "relevantDecisions" | "bindDecisionApplicability"
  | "bindDecisionTriggers" | "governanceEvaluations" | "lensCompilationUnknown" | "decisionRun"
>;
interface ContinuityEdge { readonly from: string; readonly toIds: readonly string[]; readonly origins: readonly string[]; readonly signal: "lineage" | "tombstone" }
interface TopologyNode {
  readonly supported: boolean;
  readonly neighbors: readonly { readonly id: string; readonly reasons: readonly string[]; readonly directions: readonly string[] }[];
  readonly boundary: { readonly observability: "closed" | "bounded" | "open" | "unavailable"; readonly assumptions: readonly string[]; readonly unavailableLanes: readonly string[] };
}
interface UncertainImporter { readonly id: string; readonly path: string; readonly sourceHash: ContentHash; readonly uncertainty: readonly string[] }
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort();
const normalize = (value: string): string => value.normalize("NFKC").trim().toLocaleLowerCase("en-US");

/** Scoped adapter for the existing query/context compiler. All reusable results
 * bind complete indexed populations, never a filtered observation DTO. */
export class IndexedKnowledgeGraph implements KnowledgeContextGraph {
  readonly registry: QueryDependencyRegistry;
  readonly memo: IndexedQueryMemo;
  readonly governance: IndexedGovernancePort;
  private readonly core: IndexedGraphReader;
  constructor(
    readonly descriptor: IndexedObservationDescriptor,
    readonly store: SqliteObservationStore,
    governanceFactory: (registry: QueryDependencyRegistry) => IndexedGovernancePort,
    readonly derivedBudget: DerivedObservationBudget,
    readonly semantic?: IndexedSemanticGraph,
  ) {
    this.core = new IndexedGraphReader(store, descriptor.generation);
    this.memo = new IndexedQueryMemo(store, descriptor.generation, semantic === undefined ? undefined : key => semantic.version(key));
    this.registry = new QueryDependencyRegistry(this.core, false, this.memo);
    this.registerPrograms();
    this.governance = governanceFactory(this.registry);
  }
  row<T>(kind: string, key: string): T | undefined { return this.store.getAt<T>(this.descriptor.generation, kind, key); }
  semanticSummary(unitIds: readonly string[]) { return this.semantic?.summary(unitIds, this.store); }
  population(selector: string, namespace?: string): string[] {
    if (this.row("population-version", selector) === undefined && (namespace === undefined || this.row("population-version", namespace) === undefined)) throw new Error(`Knowledge population ${selector} is not enrolled; rebuild the complete observation`);
    return this.store.populationAt(this.descriptor.generation, selector);
  }
  private required<T>(kind: string, key: string): T {
    const value = this.row<T>(kind, key);
    if (value === undefined) throw new Error(`Indexed knowledge record ${kind}:${key} is missing; rebuild the complete observation`);
    return value;
  }
  private identity(id: string): SemanticEntity | undefined { return this.row<SemanticEntity>("knowledge-identity", id); }
  search(request: string, addressed: readonly string[], maxCandidates: number): KnowledgeInterpretationCandidate[] {
    const candidates: KnowledgeInterpretationCandidate[] = [];
    for (const selector of addressed.length > 0 ? addressed : [request]) {
      const needle = normalize(selector);
      for (const id of this.population(`knowledge-address:${needle}`, "knowledge-address")) {
        const entity = this.required<SemanticEntity>("knowledge-identity", id);
        if (normalize(entity.id) === needle) candidates.push(candidateFor(entity, "id", 1, entity.accepted));
        else if (normalize(entity.key) === needle) candidates.push(candidateFor(entity, "key", 1, entity.accepted));
        else if (entity.accepted && entity.aliases.some((alias) => normalize(alias) === needle)) candidates.push(candidateFor(entity, "alias", 1, true));
      }
      candidates.push(...this.continuityCandidates(needle));
    }
    const direct = mergeCandidates(candidates);
    if (direct.length > 0 || addressed.length > 0) return direct.slice(0, maxCandidates);
    // The original score is positive exactly when searchable tokens overlap.
    // Complete token populations therefore preserve every scored candidate.
    for (const id of unique(tokens(request).flatMap((token) => this.population(`knowledge-lexical:${token}`, "knowledge-lexical")))) {
      const entity = this.required<SemanticEntity>("knowledge-identity", id);
      const score = scoreLexical(request, entity);
      if (score > 0) candidates.push(candidateFor(entity, "lexical", score, false));
    }
    return mergeCandidates(candidates).slice(0, maxCandidates);
  }
  private continuityCandidates(needle: string): KnowledgeInterpretationCandidate[] {
    const seen = new Map<string, { origins: string[]; signals: Array<"lineage" | "tombstone"> }>();
    const starts = this.population(`knowledge-continuity-address:${needle}`, "knowledge-continuity").map((key) => this.required<ContinuityEdge>("knowledge-continuity", key));
    const pending = unique(starts.map(({ from }) => from));
    for (const from of pending) seen.set(from, { origins: [], signals: [] });
    for (let index = 0; index < pending.length; index++) {
      const from = pending[index]!;
      const current = seen.get(from)!;
      for (const key of this.population(`knowledge-continuity:${from}`, "knowledge-continuity")) {
        const edge = this.required<ContinuityEdge>("knowledge-continuity", key);
        for (const targetId of edge.toIds) {
          const prior = seen.get(targetId);
          const origins = unique([...(prior?.origins ?? []), ...current.origins, ...edge.origins]);
          const signals = [...new Set([...(prior?.signals ?? []), ...current.signals, edge.signal])].sort();
          if (prior === undefined || origins.length !== prior.origins.length || signals.length !== prior.signals.length) {
            seen.set(targetId, { origins, signals }); pending.push(targetId);
          }
        }
      }
    }
    return [...seen].flatMap(([id, { origins, signals }]) => {
      const entity = this.identity(id);
      return entity === undefined ? [] : signals.map((signal) => candidateFor(entity, signal, 1, entity.accepted, origins.filter((origin) => origin !== id)));
    });
  }
  resolveNamedTargets(targets: readonly string[]): KnowledgeInterpretationCandidate[] {
    if (this.row("population-version", "knowledge-unit-address") === undefined) throw new Error("Knowledge target population is not enrolled; rebuild the complete observation");
    return mergeCandidates(unique(targets).flatMap((target) => {
      const candidate = this.row<KnowledgeInterpretationCandidate>("knowledge-target", target.replaceAll("\\", "/"));
      return candidate === undefined ? [] : [{ ...candidate, signals: [candidate.entityId === target ? "id" as const : "key" as const], explanation: `Explicit repository target ${target} resolved to observed projection unit ${candidate.entityId}.` }];
    }));
  }
  async bindIdentity(request: string, addressed: readonly string[], namedTargets: readonly string[], context: AdapterContext): Promise<BoundQueryResult<KnowledgeInterpretationCandidate[]>> {
    const query = this.registry.createSpec({ id: `knowledge-identity:${hashFramedDomain("knowledge-identity-input", { request, addressed, namedTargets }).slice(-24)}`, programId: KNOWLEDGE_QUERY_PROGRAMS.identity, input: { request, addressed, namedTargets } });
    const evaluated = await this.registry.evaluateObserved(query, context);
    return { value: evaluated.observed.results.map(({ id: _id, ...candidate }) => candidate as unknown as KnowledgeInterpretationCandidate), dependency: { query, priorResult: evaluated.fingerprint, role: "semantic identity candidates, accepted addresses, lineage, and tombstone continuity" } };
  }
  async load(id: string): Promise<ContextSource | undefined> { return this.row<ContextSource>("knowledge-source", id); }
  valueDependency(id: string): StateValueDependencyRef | undefined { return this.valueDependencies([id]).find(({ kind }) => kind === "canonical-entity" || kind === "canonical-governance" || kind === "projection-unit"); }
  valueDependencies(ids: readonly string[]): StateValueDependencyRef[] {
    const lists = ids.map((id) => this.row<StateValueDependencyRef[]>("knowledge-values", id) ?? []);
    const orderedLists = unique(ids).map((id) => this.row<StateValueDependencyRef[]>("knowledge-values", id) ?? []);
    // Preserve the existing graph's ordering: own values, exact sources, authorities.
    const values = lists.flatMap((items) => items.slice(0, 1));
    const sources = orderedLists.flatMap((items) => items.slice(1, 2));
    const authorities = orderedLists.flatMap((items) => items.slice(2));
    return [...values, ...sources, ...authorities];
  }
  sourceHash(id: string): ContentHash | undefined { return this.row<ContentHash>("knowledge-source-hash", id) ?? this.row<CanonicalDocumentEnvelope>("canonical", id)?.canonicalDocumentHash; }
  semanticHash(id: string): ContentHash | undefined { return this.identity(id)?.semanticHash ?? this.row<ProjectionUnit>("unit", id)?.semanticSignature.hash; }
  currentVersionHash(dependency: StateValueDependencyRef): ContentHash | undefined {
    if (dependency.kind === "artifact" && dependency.id.startsWith("knowledge-source:")) return this.sourceHash(dependency.id.slice("knowledge-source:".length));
    return this.semanticHash(dependency.id) ?? this.row<CanonicalDocumentEnvelope>("canonical", dependency.id)?.semanticHash;
  }
  authorityUnknowns(ids: readonly string[]): string[] { return unique(ids.flatMap((id) => this.row<string[]>("knowledge-authority-unknowns", id) ?? [])); }
  realizationUnknowns(ids: readonly string[]): string[] { return unique(ids.flatMap((id) => this.row<string[]>("knowledge-realization-unknowns", id) ?? [])); }
  topologyUnknowns(ids: readonly string[]): string[] {
    if (!ids.some((id) => this.row<TopologyNode>("knowledge-topology", id)?.supported === true)) return [];
    return this.uncertainImporters().map(({ path, uncertainty }) => `runtime dependency target remains unknown in ${path}: ${uncertainty.join("; ")}`);
  }
  private uncertainImporters(): UncertainImporter[] { return this.required<UncertainImporter[]>("knowledge-global", "uncertain-importers"); }
  implementationBindings(subjectId: string): Array<Record<string, unknown>> { return this.row<Array<Record<string, unknown>>>("knowledge-bindings", subjectId) ?? []; }
  get lensCompilationUnknown() { return this.governance.lensCompilationUnknown; }
  get decisionRun() { return this.governance.decisionRun; }
  lensObligations(...args: Parameters<IndexedGovernancePort["lensObligations"]>) { return this.governance.lensObligations(...args); }
  validatorRequests(...args: Parameters<IndexedGovernancePort["validatorRequests"]>) { return this.governance.validatorRequests(...args); }
  relevantDecisions(...args: Parameters<IndexedGovernancePort["relevantDecisions"]>) { return this.governance.relevantDecisions(...args); }
  bindDecisionApplicability(...args: Parameters<IndexedGovernancePort["bindDecisionApplicability"]>) { return this.governance.bindDecisionApplicability(...args); }
  bindDecisionTriggers(...args: Parameters<IndexedGovernancePort["bindDecisionTriggers"]>) { return this.governance.bindDecisionTriggers(...args); }
  governanceEvaluations(...args: Parameters<IndexedGovernancePort["governanceEvaluations"]>) { return this.governance.governanceEvaluations(...args); }
  private async dependency(programId: string, id: string, input: Record<string, unknown>, role: string, context: AdapterContext): Promise<StateQueryDependency> {
    const query = this.registry.createSpec({ id, programId, input });
    return { query, priorResult: await this.registry.evaluate(query, context), role };
  }
  discovery(context: AdapterContext, collect: StateQueryDependency[]): RelevanceDiscoveryPort {
    return { discover: async (subjectId, depth) => {
      const relation = await this.dependency(KNOWLEDGE_QUERY_PROGRAMS.relations, `knowledge-relations:${subjectId}`, { subjectId }, `typed relation neighborhood for ${subjectId}`, context);
      const dependencies = [relation, await this.dependency(KNOWLEDGE_QUERY_PROGRAMS.implementation, `knowledge-implementation:${subjectId}`, { subjectId }, `implementation and selector bindings for ${subjectId}`, context)];
      const edges = this.relationEdges(subjectId, depth);
      edges.push(...this.implementationBindings(subjectId).map(({ id, reason }) => this.edge(subjectId, String(id), "consequence", 0.82, "implementation-binding", String(reason), "derived")));
      if (this.row<ProjectionUnit>("unit", subjectId) !== undefined) {
        if (this.semantic?.generation !== undefined) {
          const query = this.registry.createSpec({ id: `knowledge-code:${subjectId}`, programId: SEMANTIC_TOPOLOGY_PROGRAM, input: { unitId: subjectId } });
          const observed = await this.registry.evaluateObserved(query, context);
          dependencies.push({ query, priorResult: observed.fingerprint, role: `source-bound semantic relationships for ${subjectId}` });
          for (const result of observed.observed.results) edges.push({ ...this.edge(subjectId, String(result.id), "consequence", 0.85, "package-dependency", `Compiler or structural code relationships connect the owning source units: ${String(result.path)}`, "derived"), reason: { ...this.edge(subjectId, String(result.id), "consequence", 0.85, "package-dependency", "Semantic code relationship", "derived").reason, evidenceIds: Array.isArray(result.evidenceIds) ? result.evidenceIds.map(String) : [] } });
        }
        const decisions = await this.registry.evaluateObserved(this.registry.createSpec({ id: `knowledge-decisions:${subjectId}`, programId: KNOWLEDGE_QUERY_PROGRAMS.decisionMembership, input: { unitId: subjectId } }), context);
        const decisionQuery = this.registry.createSpec({ id: `knowledge-decisions:${subjectId}`, programId: KNOWLEDGE_QUERY_PROGRAMS.decisionMembership, input: { unitId: subjectId } });
        dependencies.push({ query: decisionQuery, priorResult: decisions.fingerprint, role: `active decision applicability for ${subjectId}` });
        for (const { id } of decisions.observed.results) edges.push(this.edge(subjectId, String(id), "governing", 0.93, "selector-applicability", `active decision ${String(id)} applies to ${subjectId}`, "derived", true));
        const topology = this.required<TopologyNode>("knowledge-topology", subjectId);
        if (topology.supported) {
          dependencies.push(await this.dependency(KNOWLEDGE_QUERY_PROGRAMS.topology, `knowledge-topology:${subjectId}`, { unitId: subjectId }, `static dependency and test topology for ${subjectId}`, context));
          for (const { id, reasons, directions } of topology.neighbors) edges.push(this.edge(subjectId, id, "consequence", 0.72, reasons.includes("test-target") ? "verification-binding" : "package-dependency", `${reasons.join("+")} topology (${directions.join(",") || "undirected"})`, "observed"));
        }
        const lensQuery = this.registry.createSpec({ id: `knowledge-lenses:${subjectId}`, programId: KNOWLEDGE_QUERY_PROGRAMS.lensMembership, input: { unitId: subjectId } });
        const lenses = await this.registry.evaluateObserved(lensQuery, context);
        dependencies.push({ query: lensQuery, priorResult: lenses.fingerprint, role: `active lens membership for ${subjectId}` });
        for (const { id } of lenses.observed.results) edges.push(this.edge(subjectId, String(id), "governing", 0.94, "selector-applicability", `active lens ${String(id)} applies to ${subjectId}`, "derived", true));
      }
      collect.push(...dependencies);
      return { edges, dependency: relation };
    } };
  }
  private relationEdges(subjectId: string, depth: number): RelevanceDiscoveryEdge[] {
    return this.core.getRelations(subjectId, "both").map((relation) => {
      const outgoing = relation.fromId === subjectId;
      const target = outgoing ? relation.toId : relation.fromId;
      const governing = outgoing ? ["requires", "depends-on", "governed-by", "has-requirement", "constrains"].includes(relation.type) : ["constrains", "applies-to", "governed-by", "has-requirement"].includes(relation.type);
      const kind: RelevanceReason["kind"] = relation.type === "constrains" ? "constrains" : relation.type === "depends-on" || relation.type === "requires" ? "depends-on" : relation.type === "governed-by" ? "governs" : relation.type === "verifies" || relation.type === "demonstrated-by" ? "verification-binding" : "implementation-binding";
      return this.edge(subjectId, target, governing ? "governing" : depth > 0 ? "possible" : "consequence", Math.max(0.55, relation.confidence), kind, `${relation.type} relation ${relation.id} connects ${subjectId} to ${target}`, relation.sourceClass === "inferred" ? "inferred" : relation.sourceClass === "observed" ? "observed" : "declared", governing);
    });
  }
  private edge(fromId: string, entityId: string, band: Exclude<RelevanceBand, "direct">, score: number, kind: RelevanceReason["kind"], explanation: string, provenance: RelevanceReason["provenance"], requiredForPlanning = false): RelevanceDiscoveryEdge {
    return { entityId, band, score, requiredForPlanning, cost: 1, reason: { kind, fromId, weight: score, provenance, confidence: score, explanation, evidenceIds: [] } };
  }
  private registerPrograms(): void {
    this.registry.register({ id: SEMANTIC_TOPOLOGY_PROGRAM, version: "1", kind: "package-dependency", normalizeInput: input => ({ unitId: String(input.unitId ?? "") }), evaluate: ({ input }) => this.semantic?.neighborhood(String(input.unitId), this.store) ?? { results: [], observability: "unavailable", assumptions: [], unavailableLanes: ["semantic-code-index:not-open"], dependencyKeys: [] } });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.identity, version: "1", kind: "semantic-identity-search", normalizeInput: (input) => ({ request: String(input.request ?? "").normalize("NFKC").trim(), addressed: unique(Array.isArray(input.addressed) ? input.addressed.map(String).map((item) => item.normalize("NFKC").trim()).filter(Boolean) : []), namedTargets: unique(Array.isArray(input.namedTargets) ? input.namedTargets.map(String).map((item) => item.replaceAll("\\", "/").normalize("NFKC").trim()).filter(Boolean) : []) }), evaluate: ({ input }) => ({ results: mergeCandidates([...this.search(input.request as string, input.addressed as string[], Number.MAX_SAFE_INTEGER), ...this.resolveNamedTargets(input.namedTargets as string[])]).map((item) => ({ id: item.entityId, ...item })), observability: "closed", assumptions: [], unavailableLanes: [], dependencyKeys: ["canonical-identity-discovery", "canonical-lineage", "canonical-tombstones", "projection-unit-membership", ...((input.namedTargets as string[]).map((target) => `path:${target}`))] }) });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.relations, version: "1", kind: "relation-neighborhood", normalizeInput: (input) => ({ subjectId: String(input.subjectId ?? "") }), evaluate: ({ input }) => ({ results: this.core.getRelations(String(input.subjectId), "both").map(({ id, fromId, toId, type, semanticHash }) => ({ id, fromId, toId, type, semanticHash })), observability: "closed", assumptions: [], unavailableLanes: [], dependencyKeys: ["canonical-relations", `entity:${String(input.subjectId)}`] }) });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.implementation, version: "2", kind: "implementation-binding", normalizeInput: (input) => ({ subjectId: String(input.subjectId ?? "") }), evaluate: ({ input }) => {
      const subjectId = String(input.subjectId);
      const unavailable = (this.row<Array<{ entityId: string; status: string; bindingIndex: number; reason: string }>>("realization", subjectId) ?? []).filter(({ status }) => status === "unsupported" || status === "unavailable");
      const failures = this.required<Array<{ analyzerId: string; capability: string; scope: string }>>("knowledge-global", "failures").filter(({ analyzerId }) => analyzerId === "projector.filesystem-local").map(({ analyzerId, capability, scope }) => `${analyzerId}:${capability}:${scope}`).sort();
      return { results: this.implementationBindings(subjectId), observability: unavailable.length === 0 ? this.descriptor.metadata.analysisHeader.surface.enumeration.observability : "unavailable", assumptions: this.descriptor.metadata.analysisHeader.surface.enumeration.assumptions, unavailableLanes: [...failures, ...unavailable.map(({ bindingIndex, reason }) => `canonical-realization:${subjectId}:${bindingIndex}:${reason}`)], dependencyKeys: ["canonical-realizations", "canonical-scopes", "projection-unit-membership", `entity:${subjectId}`] };
    } });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.topology, version: "3", kind: "package-dependency", normalizeInput: (input) => ({ unitId: String(input.unitId ?? "") }), evaluate: ({ input }) => {
      const unitId = String(input.unitId);
      let topology = this.row<TopologyNode>("knowledge-topology", unitId);
      if (topology === undefined) {
        if (this.row("population-version", "unit") === undefined || this.row("unit", unitId) !== undefined) throw new Error(`Indexed topology ${unitId} is missing; rebuild the complete observation`);
        topology = { supported: false, neighbors: [], boundary: { observability: "unavailable", assumptions: [], unavailableLanes: [`projector.javascript-local:static-dependency-topology:${unitId}`] } };
      }
      return { results: [...topology.neighbors.map((neighbor) => ({ ...neighbor })), ...this.uncertainImporters().map((importer) => ({ ...importer }))], ...topology.boundary, dependencyKeys: ["repository-module-dependencies", "repository-test-targets", `projection-unit:${String(input.unitId)}`] };
    } });
  }
}
