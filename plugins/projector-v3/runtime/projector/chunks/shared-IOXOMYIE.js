import {
  IndexedGraphReader
} from "./shared-3QLR5CBD.js";
import {
  IndexedQueryMemo
} from "./shared-2UYHDFME.js";
import {
  KNOWLEDGE_QUERY_PROGRAMS,
  candidateFor,
  mergeCandidates,
  scoreLexical,
  tokens
} from "./shared-SN3OO5CC.js";
import "./shared-WY2QJ7AR.js";
import "./shared-2INZJVA6.js";
import {
  SEMANTIC_TOPOLOGY_PROGRAM
} from "./shared-AHRONKDP.js";
import "./shared-IFEDFPQ4.js";
import "./shared-EHAKQ7RC.js";
import "./shared-T66EWDMN.js";
import "./shared-WYYVWFGB.js";
import "./shared-3PXVRXWV.js";
import "./shared-KWLM6SLK.js";
import "./shared-2U2MJHPJ.js";
import {
  QueryDependencyRegistry
} from "./shared-HEBLUKDF.js";
import {
  hashFramedDomain
} from "./shared-AJ5KBTH5.js";
import "./shared-WC2OT3WX.js";

// node_modules/@projector/control-plane/dist/knowledge/indexed-graph.js
var unique = (values) => [...new Set(values)].sort();
var normalize = (value) => value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
var IndexedKnowledgeGraph = class {
  descriptor;
  store;
  derivedBudget;
  semantic;
  registry;
  memo;
  governance;
  core;
  constructor(descriptor, store, governanceFactory, derivedBudget, semantic) {
    this.descriptor = descriptor;
    this.store = store;
    this.derivedBudget = derivedBudget;
    this.semantic = semantic;
    this.core = new IndexedGraphReader(store, descriptor.generation);
    this.memo = new IndexedQueryMemo(store, descriptor.generation, semantic === void 0 ? void 0 : (key) => semantic.version(key));
    this.registry = new QueryDependencyRegistry(this.core, false, this.memo);
    this.registerPrograms();
    this.governance = governanceFactory(this.registry);
  }
  row(kind, key) {
    return this.store.getAt(this.descriptor.generation, kind, key);
  }
  semanticSummary(unitIds) {
    return this.semantic?.summary(unitIds, this.store);
  }
  population(selector, namespace) {
    if (this.row("population-version", selector) === void 0 && (namespace === void 0 || this.row("population-version", namespace) === void 0))
      throw new Error(`Knowledge population ${selector} is not enrolled; rebuild the complete observation`);
    return this.store.populationAt(this.descriptor.generation, selector);
  }
  required(kind, key) {
    const value = this.row(kind, key);
    if (value === void 0)
      throw new Error(`Indexed knowledge record ${kind}:${key} is missing; rebuild the complete observation`);
    return value;
  }
  identity(id) {
    return this.row("knowledge-identity", id);
  }
  search(request, addressed, maxCandidates) {
    const candidates = [];
    for (const selector of addressed.length > 0 ? addressed : [request]) {
      const needle = normalize(selector);
      for (const id of this.population(`knowledge-address:${needle}`, "knowledge-address")) {
        const entity = this.required("knowledge-identity", id);
        if (normalize(entity.id) === needle)
          candidates.push(candidateFor(entity, "id", 1, entity.accepted));
        else if (normalize(entity.key) === needle)
          candidates.push(candidateFor(entity, "key", 1, entity.accepted));
        else if (entity.accepted && entity.aliases.some((alias) => normalize(alias) === needle))
          candidates.push(candidateFor(entity, "alias", 1, true));
      }
      candidates.push(...this.continuityCandidates(needle));
    }
    const direct = mergeCandidates(candidates);
    if (direct.length > 0 || addressed.length > 0)
      return direct.slice(0, maxCandidates);
    for (const id of unique(tokens(request).flatMap((token) => this.population(`knowledge-lexical:${token}`, "knowledge-lexical")))) {
      const entity = this.required("knowledge-identity", id);
      const score = scoreLexical(request, entity);
      if (score > 0)
        candidates.push(candidateFor(entity, "lexical", score, false));
    }
    return mergeCandidates(candidates).slice(0, maxCandidates);
  }
  continuityCandidates(needle) {
    const seen = /* @__PURE__ */ new Map();
    const starts = this.population(`knowledge-continuity-address:${needle}`, "knowledge-continuity").map((key) => this.required("knowledge-continuity", key));
    const pending = unique(starts.map(({ from }) => from));
    for (const from of pending)
      seen.set(from, { origins: [], signals: [] });
    for (let index = 0; index < pending.length; index++) {
      const from = pending[index];
      const current = seen.get(from);
      for (const key of this.population(`knowledge-continuity:${from}`, "knowledge-continuity")) {
        const edge = this.required("knowledge-continuity", key);
        for (const targetId of edge.toIds) {
          const prior = seen.get(targetId);
          const origins = unique([...prior?.origins ?? [], ...current.origins, ...edge.origins]);
          const signals = [.../* @__PURE__ */ new Set([...prior?.signals ?? [], ...current.signals, edge.signal])].sort();
          if (prior === void 0 || origins.length !== prior.origins.length || signals.length !== prior.signals.length) {
            seen.set(targetId, { origins, signals });
            pending.push(targetId);
          }
        }
      }
    }
    return [...seen].flatMap(([id, { origins, signals }]) => {
      const entity = this.identity(id);
      return entity === void 0 ? [] : signals.map((signal) => candidateFor(entity, signal, 1, entity.accepted, origins.filter((origin) => origin !== id)));
    });
  }
  resolveNamedTargets(targets) {
    if (this.row("population-version", "knowledge-unit-address") === void 0)
      throw new Error("Knowledge target population is not enrolled; rebuild the complete observation");
    return mergeCandidates(unique(targets).flatMap((target) => {
      const candidate = this.row("knowledge-target", target.replaceAll("\\", "/"));
      return candidate === void 0 ? [] : [{ ...candidate, signals: [candidate.entityId === target ? "id" : "key"], explanation: `Explicit repository target ${target} resolved to observed projection unit ${candidate.entityId}.` }];
    }));
  }
  async bindIdentity(request, addressed, namedTargets, context) {
    const query = this.registry.createSpec({ id: `knowledge-identity:${hashFramedDomain("knowledge-identity-input", { request, addressed, namedTargets }).slice(-24)}`, programId: KNOWLEDGE_QUERY_PROGRAMS.identity, input: { request, addressed, namedTargets } });
    const evaluated = await this.registry.evaluateObserved(query, context);
    return { value: evaluated.observed.results.map(({ id: _id, ...candidate }) => candidate), dependency: { query, priorResult: evaluated.fingerprint, role: "semantic identity candidates, accepted addresses, lineage, and tombstone continuity" } };
  }
  async load(id) {
    return this.row("knowledge-source", id);
  }
  valueDependency(id) {
    return this.valueDependencies([id]).find(({ kind }) => kind === "canonical-entity" || kind === "canonical-governance" || kind === "projection-unit");
  }
  valueDependencies(ids) {
    const lists = ids.map((id) => this.row("knowledge-values", id) ?? []);
    const orderedLists = unique(ids).map((id) => this.row("knowledge-values", id) ?? []);
    const values = lists.flatMap((items) => items.slice(0, 1));
    const sources = orderedLists.flatMap((items) => items.slice(1, 2));
    const authorities = orderedLists.flatMap((items) => items.slice(2));
    return [...values, ...sources, ...authorities];
  }
  sourceHash(id) {
    return this.row("knowledge-source-hash", id) ?? this.row("canonical", id)?.canonicalDocumentHash;
  }
  semanticHash(id) {
    return this.identity(id)?.semanticHash ?? this.row("unit", id)?.semanticSignature.hash;
  }
  currentVersionHash(dependency) {
    if (dependency.kind === "artifact" && dependency.id.startsWith("knowledge-source:"))
      return this.sourceHash(dependency.id.slice("knowledge-source:".length));
    return this.semanticHash(dependency.id) ?? this.row("canonical", dependency.id)?.semanticHash;
  }
  authorityUnknowns(ids) {
    return unique(ids.flatMap((id) => this.row("knowledge-authority-unknowns", id) ?? []));
  }
  realizationUnknowns(ids) {
    return unique(ids.flatMap((id) => this.row("knowledge-realization-unknowns", id) ?? []));
  }
  topologyUnknowns(ids) {
    if (!ids.some((id) => this.row("knowledge-topology", id)?.supported === true))
      return [];
    return this.uncertainImporters().map(({ path, uncertainty }) => `runtime dependency target remains unknown in ${path}: ${uncertainty.join("; ")}`);
  }
  uncertainImporters() {
    return this.required("knowledge-global", "uncertain-importers");
  }
  implementationBindings(subjectId) {
    return this.row("knowledge-bindings", subjectId) ?? [];
  }
  get lensCompilationUnknown() {
    return this.governance.lensCompilationUnknown;
  }
  get decisionRun() {
    return this.governance.decisionRun;
  }
  lensObligations(...args) {
    return this.governance.lensObligations(...args);
  }
  validatorRequests(...args) {
    return this.governance.validatorRequests(...args);
  }
  relevantDecisions(...args) {
    return this.governance.relevantDecisions(...args);
  }
  bindDecisionApplicability(...args) {
    return this.governance.bindDecisionApplicability(...args);
  }
  bindDecisionTriggers(...args) {
    return this.governance.bindDecisionTriggers(...args);
  }
  governanceEvaluations(...args) {
    return this.governance.governanceEvaluations(...args);
  }
  async dependency(programId, id, input, role, context) {
    const query = this.registry.createSpec({ id, programId, input });
    return { query, priorResult: await this.registry.evaluate(query, context), role };
  }
  discovery(context, collect) {
    return { discover: async (subjectId, depth) => {
      const relation = await this.dependency(KNOWLEDGE_QUERY_PROGRAMS.relations, `knowledge-relations:${subjectId}`, { subjectId }, `typed relation neighborhood for ${subjectId}`, context);
      const dependencies = [relation, await this.dependency(KNOWLEDGE_QUERY_PROGRAMS.implementation, `knowledge-implementation:${subjectId}`, { subjectId }, `implementation and selector bindings for ${subjectId}`, context)];
      const edges = this.relationEdges(subjectId, depth);
      edges.push(...this.implementationBindings(subjectId).map(({ id, reason }) => this.edge(subjectId, String(id), "consequence", 0.82, "implementation-binding", String(reason), "derived")));
      if (this.row("unit", subjectId) !== void 0) {
        if (this.semantic?.generation !== void 0) {
          const query = this.registry.createSpec({ id: `knowledge-code:${subjectId}`, programId: SEMANTIC_TOPOLOGY_PROGRAM, input: { unitId: subjectId } });
          const observed = await this.registry.evaluateObserved(query, context);
          dependencies.push({ query, priorResult: observed.fingerprint, role: `source-bound semantic relationships for ${subjectId}` });
          for (const result of observed.observed.results)
            edges.push({ ...this.edge(subjectId, String(result.id), "consequence", 0.85, "package-dependency", `Compiler or structural code relationships connect the owning source units: ${String(result.path)}`, "derived"), reason: { ...this.edge(subjectId, String(result.id), "consequence", 0.85, "package-dependency", "Semantic code relationship", "derived").reason, evidenceIds: Array.isArray(result.evidenceIds) ? result.evidenceIds.map(String) : [] } });
        }
        const decisions = await this.registry.evaluateObserved(this.registry.createSpec({ id: `knowledge-decisions:${subjectId}`, programId: KNOWLEDGE_QUERY_PROGRAMS.decisionMembership, input: { unitId: subjectId } }), context);
        const decisionQuery = this.registry.createSpec({ id: `knowledge-decisions:${subjectId}`, programId: KNOWLEDGE_QUERY_PROGRAMS.decisionMembership, input: { unitId: subjectId } });
        dependencies.push({ query: decisionQuery, priorResult: decisions.fingerprint, role: `active decision applicability for ${subjectId}` });
        for (const { id } of decisions.observed.results)
          edges.push(this.edge(subjectId, String(id), "governing", 0.93, "selector-applicability", `active decision ${String(id)} applies to ${subjectId}`, "derived", true));
        const topology = this.required("knowledge-topology", subjectId);
        if (topology.supported) {
          dependencies.push(await this.dependency(KNOWLEDGE_QUERY_PROGRAMS.topology, `knowledge-topology:${subjectId}`, { unitId: subjectId }, `static dependency and test topology for ${subjectId}`, context));
          for (const { id, reasons, directions } of topology.neighbors)
            edges.push(this.edge(subjectId, id, "consequence", 0.72, reasons.includes("test-target") ? "verification-binding" : "package-dependency", `${reasons.join("+")} topology (${directions.join(",") || "undirected"})`, "observed"));
        }
        const lensQuery = this.registry.createSpec({ id: `knowledge-lenses:${subjectId}`, programId: KNOWLEDGE_QUERY_PROGRAMS.lensMembership, input: { unitId: subjectId } });
        const lenses = await this.registry.evaluateObserved(lensQuery, context);
        dependencies.push({ query: lensQuery, priorResult: lenses.fingerprint, role: `active lens membership for ${subjectId}` });
        for (const { id } of lenses.observed.results)
          edges.push(this.edge(subjectId, String(id), "governing", 0.94, "selector-applicability", `active lens ${String(id)} applies to ${subjectId}`, "derived", true));
      }
      collect.push(...dependencies);
      return { edges, dependency: relation };
    } };
  }
  relationEdges(subjectId, depth) {
    return this.core.getRelations(subjectId, "both").map((relation) => {
      const outgoing = relation.fromId === subjectId;
      const target = outgoing ? relation.toId : relation.fromId;
      const governing = outgoing ? ["requires", "depends-on", "governed-by", "has-requirement", "constrains"].includes(relation.type) : ["constrains", "applies-to", "governed-by", "has-requirement"].includes(relation.type);
      const kind = relation.type === "constrains" ? "constrains" : relation.type === "depends-on" || relation.type === "requires" ? "depends-on" : relation.type === "governed-by" ? "governs" : relation.type === "verifies" || relation.type === "demonstrated-by" ? "verification-binding" : "implementation-binding";
      return this.edge(subjectId, target, governing ? "governing" : depth > 0 ? "possible" : "consequence", Math.max(0.55, relation.confidence), kind, `${relation.type} relation ${relation.id} connects ${subjectId} to ${target}`, relation.sourceClass === "inferred" ? "inferred" : relation.sourceClass === "observed" ? "observed" : "declared", governing);
    });
  }
  edge(fromId, entityId, band, score, kind, explanation, provenance, requiredForPlanning = false) {
    return { entityId, band, score, requiredForPlanning, cost: 1, reason: { kind, fromId, weight: score, provenance, confidence: score, explanation, evidenceIds: [] } };
  }
  registerPrograms() {
    this.registry.register({ id: SEMANTIC_TOPOLOGY_PROGRAM, version: "1", kind: "package-dependency", normalizeInput: (input) => ({ unitId: String(input.unitId ?? "") }), evaluate: ({ input }) => this.semantic?.neighborhood(String(input.unitId), this.store) ?? { results: [], observability: "unavailable", assumptions: [], unavailableLanes: ["semantic-code-index:not-open"], dependencyKeys: [] } });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.identity, version: "1", kind: "semantic-identity-search", normalizeInput: (input) => ({ request: String(input.request ?? "").normalize("NFKC").trim(), addressed: unique(Array.isArray(input.addressed) ? input.addressed.map(String).map((item) => item.normalize("NFKC").trim()).filter(Boolean) : []), namedTargets: unique(Array.isArray(input.namedTargets) ? input.namedTargets.map(String).map((item) => item.replaceAll("\\", "/").normalize("NFKC").trim()).filter(Boolean) : []) }), evaluate: ({ input }) => ({ results: mergeCandidates([...this.search(input.request, input.addressed, Number.MAX_SAFE_INTEGER), ...this.resolveNamedTargets(input.namedTargets)]).map((item) => ({ id: item.entityId, ...item })), observability: "closed", assumptions: [], unavailableLanes: [], dependencyKeys: ["canonical-identity-discovery", "canonical-lineage", "canonical-tombstones", "projection-unit-membership", ...input.namedTargets.map((target) => `path:${target}`)] }) });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.relations, version: "1", kind: "relation-neighborhood", normalizeInput: (input) => ({ subjectId: String(input.subjectId ?? "") }), evaluate: ({ input }) => ({ results: this.core.getRelations(String(input.subjectId), "both").map(({ id, fromId, toId, type, semanticHash }) => ({ id, fromId, toId, type, semanticHash })), observability: "closed", assumptions: [], unavailableLanes: [], dependencyKeys: ["canonical-relations", `entity:${String(input.subjectId)}`] }) });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.implementation, version: "2", kind: "implementation-binding", normalizeInput: (input) => ({ subjectId: String(input.subjectId ?? "") }), evaluate: ({ input }) => {
      const subjectId = String(input.subjectId);
      const unavailable = (this.row("realization", subjectId) ?? []).filter(({ status }) => status === "unsupported" || status === "unavailable");
      const failures = this.required("knowledge-global", "failures").filter(({ analyzerId }) => analyzerId === "projector.filesystem-local").map(({ analyzerId, capability, scope }) => `${analyzerId}:${capability}:${scope}`).sort();
      return { results: this.implementationBindings(subjectId), observability: unavailable.length === 0 ? this.descriptor.metadata.analysisHeader.surface.enumeration.observability : "unavailable", assumptions: this.descriptor.metadata.analysisHeader.surface.enumeration.assumptions, unavailableLanes: [...failures, ...unavailable.map(({ bindingIndex, reason }) => `canonical-realization:${subjectId}:${bindingIndex}:${reason}`)], dependencyKeys: ["canonical-realizations", "canonical-scopes", "projection-unit-membership", `entity:${subjectId}`] };
    } });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.topology, version: "3", kind: "package-dependency", normalizeInput: (input) => ({ unitId: String(input.unitId ?? "") }), evaluate: ({ input }) => {
      const unitId = String(input.unitId);
      let topology = this.row("knowledge-topology", unitId);
      if (topology === void 0) {
        if (this.row("population-version", "unit") === void 0 || this.row("unit", unitId) !== void 0)
          throw new Error(`Indexed topology ${unitId} is missing; rebuild the complete observation`);
        topology = { supported: false, neighbors: [], boundary: { observability: "unavailable", assumptions: [], unavailableLanes: [`projector.javascript-local:static-dependency-topology:${unitId}`] } };
      }
      return { results: [...topology.neighbors.map((neighbor) => ({ ...neighbor })), ...this.uncertainImporters().map((importer) => ({ ...importer }))], ...topology.boundary, dependencyKeys: ["repository-module-dependencies", "repository-test-targets", `projection-unit:${String(input.unitId)}`] };
    } });
  }
};
export {
  IndexedKnowledgeGraph
};
