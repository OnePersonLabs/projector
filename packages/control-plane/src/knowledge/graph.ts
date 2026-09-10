import {
  ArchitectureDecisionSchema,
  ArchitectureConcernSchema,
  DeveloperPreferenceSchema,
  AuthorityRecordSchema,
  BehavioralScenarioSchema,
  ConceptSchema,
  LineageRecordSchema,
  ProjectionLensSchema,
  RelationSchema,
  RequirementSchema,
  TombstoneSchema,
  canonicalJson,
  hashFramedDomain,
  type AdapterContext,
  type ArchitectureDecision,
  type ArchitectureConcern,
  type DeveloperPreference,
  type AuthorityRecord,
  type BehavioralScenario,
  type CanonicalDocumentEnvelope,
  type Concept,
  type ContentHash,
  type LineageRecord,
  type ProjectionLens,
  type ProjectionUnit,
  type Relation,
  type RelevanceBand,
  type RelevanceReason,
  type Requirement,
  type StateQueryDependency,
  type StateValueDependencyRef,
  type Tombstone,
} from "@projector/core";
import {
  InMemoryGraphReader,
  QueryDependencyRegistry,
  assessLensAuthority,
  compileEffectiveRuleBundle,
  compileProjectionLenses,
  evaluateEffectiveRuleBundle,
  evaluateSelector,
  evaluateSelectorMembership,
  projectionUnitSelectorSubject,
  type ContextSource,
  type ContextSourcePort,
  type GovernanceBundleEvaluation,
  type ExternalGovernanceValidatorFinding,
  type GovernanceObservation,
  type ProjectionLensCompilation,
  type ProjectionUnitSelectorFacts,
  type RelevanceDiscoveryEdge,
  type RelevanceDiscoveryPort,
} from "@projector/engine";

import type { ChangeRepositoryObservation } from "../change-lifecycle/repository-observer.js";
import { KnowledgeDecisionRun, type KnowledgeDecisionHost } from "./governance.js";
import type { KnowledgeValidatorRequest } from "./validators.js";
import type {
  KnowledgeCandidateSignal,
  KnowledgeEntityKind,
  KnowledgeInterpretationCandidate,
  KnowledgeLensObligation,
} from "./types.js";

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare);
const normalize = (value: string): string => value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
const tokens = (value: string): string[] => unique(normalize(value).split(/[^\p{L}\p{N}._:@/-]+/u).filter((item) => item.length > 1));

interface SemanticEntity {
  readonly id: string;
  readonly key: string;
  readonly kind: KnowledgeEntityKind;
  readonly aliases: readonly string[];
  readonly searchable: readonly string[];
  readonly semanticHash: ContentHash;
  readonly discoveryHash: ContentHash;
  readonly accepted: boolean;
  readonly payload: Concept | Requirement | BehavioralScenario | ArchitectureDecision | ArchitectureConcern | DeveloperPreference | ProjectionLens;
  readonly envelope: CanonicalDocumentEnvelope;
}

interface BoundQueryResult<T> {
  readonly value: T;
  readonly dependency: StateQueryDependency;
}

const KNOWLEDGE_QUERY_PROGRAMS = Object.freeze({
  identity: "projector.knowledge.identity",
  relations: "projector.knowledge.relations",
  implementation: "projector.knowledge.implementation-binding",
  topology: "projector.knowledge.repository-topology",
  lensMembership: "projector.knowledge.lens-membership",
  decisionMembership: "projector.knowledge.decision-membership",
  decisionApplicability: "projector.knowledge.decision-applicability",
  decisionTriggers: "projector.knowledge.decision-triggers",
});

function entityStatusAccepted(value: Concept | Requirement | BehavioralScenario): boolean {
  return value.status !== "candidate" && value.status !== "rejected";
}

function parseEntities(documents: readonly CanonicalDocumentEnvelope[]): SemanticEntity[] {
  const result: SemanticEntity[] = [];
  for (const envelope of documents) {
    if (envelope.kind === "concept") {
      const payload = ConceptSchema.parse(envelope.payload) as Concept;
      result.push({ id: payload.id, key: payload.key, kind: "concept", aliases: payload.aliases, searchable: [payload.key, payload.name, payload.statement, ...payload.aliases], semanticHash: payload.semanticHash, discoveryHash: payload.discoveryHash, accepted: entityStatusAccepted(payload), payload, envelope });
    } else if (envelope.kind === "requirement") {
      const payload = RequirementSchema.parse(envelope.payload) as Requirement;
      result.push({ id: payload.id, key: payload.key, kind: "requirement", aliases: payload.aliases, searchable: [payload.key, payload.title, payload.statement, ...payload.aliases], semanticHash: payload.semanticHash, discoveryHash: payload.discoveryHash, accepted: entityStatusAccepted(payload), payload, envelope });
    } else if (envelope.kind === "behavioral-scenario") {
      const payload = BehavioralScenarioSchema.parse(envelope.payload) as BehavioralScenario;
      result.push({ id: payload.id, key: payload.key, kind: "scenario", aliases: payload.aliases, searchable: [payload.key, payload.title, ...payload.aliases, ...payload.steps.map(({ statement }) => statement)], semanticHash: payload.semanticHash, discoveryHash: payload.discoveryHash, accepted: entityStatusAccepted(payload), payload, envelope });
    } else if (envelope.kind === "architecture-decision") {
      const payload = ArchitectureDecisionSchema.parse(envelope.payload) as ArchitectureDecision;
      result.push({ id: payload.id, key: payload.key, kind: "architecture-decision", aliases: [], searchable: [payload.key, payload.title, payload.decision, ...payload.consequences.map(({ explanation }) => explanation)], semanticHash: payload.semanticHash, discoveryHash: envelope.canonicalDocumentHash, accepted: payload.lifecycle === "active", payload, envelope });
    } else if (envelope.kind === "projection-lens") {
      const payload = ProjectionLensSchema.parse(envelope.payload) as ProjectionLens;
      result.push({ id: payload.id, key: payload.key, kind: "projection-lens", aliases: [], searchable: [payload.key, payload.purpose], semanticHash: payload.semanticHash, discoveryHash: envelope.canonicalDocumentHash, accepted: payload.status === "active", payload, envelope });
    } else if (envelope.kind === "architecture-concern") {
      const payload = ArchitectureConcernSchema.parse(envelope.payload) as ArchitectureConcern;
      result.push({ id: payload.id, key: payload.key, kind: "architecture-concern", aliases: [], searchable: [payload.key, payload.title, payload.question], semanticHash: payload.semanticHash, discoveryHash: envelope.discoveryHash ?? envelope.canonicalDocumentHash, accepted: payload.sourceClass === "authored", payload, envelope });
    } else if (envelope.kind === "developer-preference") {
      const payload = DeveloperPreferenceSchema.parse(envelope.payload) as DeveloperPreference;
      result.push({ id: payload.id, key: payload.key, kind: "developer-preference", aliases: [], searchable: [payload.key, payload.statement], semanticHash: payload.semanticHash, discoveryHash: envelope.discoveryHash ?? envelope.canonicalDocumentHash, accepted: payload.sourceClass === "authored", payload, envelope });
    }
  }
  return result.sort((left, right) => compare(left.id, right.id));
}

function scoreLexical(request: string, entity: SemanticEntity): number {
  const requestTokens = tokens(request);
  if (requestTokens.length === 0) return 0;
  const identityTokens = new Set(tokens([entity.key, ...entity.aliases].join(" ")));
  const allTokens = new Set(tokens(entity.searchable.join(" ")));
  const identityHits = requestTokens.filter((item) => identityTokens.has(item)).length;
  const allHits = requestTokens.filter((item) => allTokens.has(item)).length;
  if (allHits === 0) return 0;
  return Math.min(0.95, 0.2 + (0.5 * identityHits + 0.3 * allHits) / requestTokens.length);
}

function mergeCandidates(values: readonly KnowledgeInterpretationCandidate[]): KnowledgeInterpretationCandidate[] {
  const byId = new Map<string, KnowledgeInterpretationCandidate>();
  for (const value of values) {
    const existing = byId.get(value.entityId);
    byId.set(value.entityId, existing === undefined ? value : {
      ...existing,
      score: Math.max(existing.score, value.score),
      direct: existing.direct || value.direct,
      signals: unique([...existing.signals, ...value.signals]) as KnowledgeCandidateSignal[],
      continuityFromIds: unique([...existing.continuityFromIds, ...value.continuityFromIds]),
      explanation: existing.explanation === value.explanation ? existing.explanation : `${existing.explanation}; ${value.explanation}`,
    });
  }
  return [...byId.values()].sort((left, right) => Number(right.direct) - Number(left.direct) || right.score - left.score || compare(left.entityId, right.entityId));
}

function candidateFor(entity: SemanticEntity, signal: KnowledgeCandidateSignal, score: number, direct: boolean, continuityFromIds: readonly string[] = []): KnowledgeInterpretationCandidate {
  const explanation = signal === "lexical"
    ? "Lexical overlap retrieved this candidate; it is not proof of semantic identity."
    : signal === "lineage" || signal === "tombstone"
      ? `Canonical ${signal} continuity points from ${continuityFromIds.join(", ")} to this identity${direct ? "." : ", but its status is not accepted; it remains a candidate."}`
      : `Explicit ${signal} addressing matched canonical ${entity.kind} ${entity.id}${direct ? "." : ", but its status is not accepted; it remains a candidate."}`;
  return { entityId: entity.id, entityKind: entity.kind, score, direct, signals: [signal], explanation, continuityFromIds: unique(continuityFromIds) };
}

export class KnowledgeGraph implements ContextSourcePort {
  readonly entities: readonly SemanticEntity[];
  readonly entitiesById: ReadonlyMap<string, SemanticEntity>;
  readonly relations: readonly Relation[];
  readonly units: readonly ProjectionUnit[];
  readonly lenses: readonly ProjectionLens[];
  readonly decisions: readonly ArchitectureDecision[];
  readonly decisionRun: KnowledgeDecisionRun;
  readonly authorities: readonly AuthorityRecord[];
  readonly lineages: readonly LineageRecord[];
  readonly tombstones: readonly Tombstone[];
  readonly registry: QueryDependencyRegistry;
  readonly lensCompilation: ProjectionLensCompilation | undefined;
  readonly lensCompilationUnknown: string | undefined;

  private readonly unitPath = new Map<string, string>();
  private readonly unitByPath = new Map<string, ProjectionUnit>();
  private readonly selectorFactsByUnitId = new Map<string, ProjectionUnitSelectorFacts>();
  private readonly selectorSubjects: readonly ReturnType<typeof projectionUnitSelectorSubject>[];
  private readonly implementationBindingsBySubjectId = new Map<string, readonly Readonly<Record<string, unknown>>[]>();
  private readonly envelopeById = new Map<string, CanonicalDocumentEnvelope>();

  constructor(readonly observation: ChangeRepositoryObservation, decisionHost: KnowledgeDecisionHost = {}) {
    this.entities = parseEntities(observation.canonical.documents);
    this.entitiesById = new Map(this.entities.map((entity) => [entity.id, entity]));
    for (const envelope of observation.canonical.documents) this.envelopeById.set(envelope.id, envelope);
    this.relations = observation.canonical.documents.filter(({ kind }) => kind === "relation").map(({ payload }) => RelationSchema.parse(payload) as Relation).filter(({ active }) => active).sort((left, right) => compare(left.id, right.id));
    this.lenses = this.entities.filter(({ kind }) => kind === "projection-lens").map(({ payload }) => payload as ProjectionLens);
    this.decisions = this.entities.filter(({ kind }) => kind === "architecture-decision").map(({ payload }) => payload as ArchitectureDecision).filter(({ lifecycle }) => lifecycle === "active");
    this.decisionRun = new KnowledgeDecisionRun(observation, decisionHost);
    this.authorities = observation.canonical.documents.filter(({ kind }) => kind === "authority-record").map(({ payload }) => AuthorityRecordSchema.parse(payload) as AuthorityRecord).sort((left, right) => compare(left.id, right.id));
    this.lineages = observation.canonical.documents.filter(({ kind }) => kind === "lineage").map(({ payload }) => LineageRecordSchema.parse(payload) as LineageRecord).sort((left, right) => compare(left.id, right.id));
    this.tombstones = observation.canonical.documents.filter(({ kind }) => kind === "tombstone").map(({ payload }) => TombstoneSchema.parse(payload) as Tombstone).sort((left, right) => compare(left.entityId, right.entityId));
    this.units = [...observation.analysis.projectionUnits].sort((left, right) => compare(left.id, right.id));
    const filesByArtifact = new Map(observation.analysis.files.map((file) => [file.artifactId, file]));
    for (const unit of this.units) {
      const path = filesByArtifact.get(unit.artifactId)?.path;
      if (path !== undefined) {
        this.unitPath.set(unit.id, path);
        this.unitByPath.set(path, unit);
        const segments = path.split("/");
        const packageRoot = (segments[0] === "packages" || segments[0] === "apps") && segments[1] !== undefined
          ? `${segments[0]}/${segments[1]}`
          : undefined;
        this.selectorFactsByUnitId.set(unit.id, {
          path,
          surface: observation.analysis.surface.kind,
          ...(packageRoot === undefined ? {} : { package: packageRoot, packageKind: segments[0] }),
        });
      }
    }
    this.selectorSubjects = this.units.map((unit) => projectionUnitSelectorSubject(unit, this.selectorFactsByUnitId.get(unit.id)));
    let compilation: ProjectionLensCompilation | undefined;
    let compilationUnknown: string | undefined;
    try {
      compilation = compileProjectionLenses({ lenses: this.lenses, units: this.units, authorityRecords: this.authorities, selectorFactsByUnitId: this.selectorFactsByUnitId });
    } catch (error) {
      compilationUnknown = error instanceof Error ? error.message : "lens compilation is unavailable";
    }
    this.lensCompilation = compilation;
    this.lensCompilationUnknown = compilationUnknown;
    const graph = new InMemoryGraphReader({
      concepts: this.entities.filter(({ kind }) => kind === "concept").map(({ payload }) => payload as Concept),
      requirements: this.entities.filter(({ kind }) => kind === "requirement").map(({ payload }) => payload as Requirement),
      behavioralScenarios: this.entities.filter(({ kind }) => kind === "scenario").map(({ payload }) => payload as BehavioralScenario),
      projectionUnits: this.units,
      relations: this.relations,
    });
    this.registry = new QueryDependencyRegistry(graph, false);
    this.registerPrograms();
  }

  search(request: string, addressed: readonly string[], maxCandidates: number): KnowledgeInterpretationCandidate[] {
    const candidates: KnowledgeInterpretationCandidate[] = [];
    const selectors = addressed.length > 0 ? addressed : [request];
    for (const selector of selectors) {
      const normalized = normalize(selector);
      for (const entity of this.entities) {
        if (normalize(entity.id) === normalized) candidates.push(candidateFor(entity, "id", 1, entity.accepted));
        else if (normalize(entity.key) === normalized) candidates.push(candidateFor(entity, "key", 1, entity.accepted));
        else if (entity.accepted && entity.aliases.some((alias) => normalize(alias) === normalized)) candidates.push(candidateFor(entity, "alias", 1, true));
      }
      candidates.push(...this.continuityCandidates(normalized));
    }
    const direct = mergeCandidates(candidates);
    if (direct.length > 0 || addressed.length > 0) return direct.slice(0, maxCandidates);
    return mergeCandidates(this.entities
      .filter(({ kind }) => kind !== "projection-lens")
      .map((entity) => ({ entity, score: scoreLexical(request, entity) }))
      .filter(({ score }) => score > 0)
      .map(({ entity, score }) => candidateFor(entity, "lexical", score, false)))
      .slice(0, maxCandidates);
  }

  private continuityCandidates(normalized: string): KnowledgeInterpretationCandidate[] {
    const edges = [
      ...this.lineages.flatMap(({ fromIds, toIds }) => fromIds.map((from) => ({ from, toIds, origins: fromIds, signal: "lineage" as const }))),
      ...this.tombstones.map(({ entityId, replacementIds }) => ({ from: entityId, toIds: replacementIds, origins: [entityId], signal: "tombstone" as const })),
    ];
    const seen = new Map<string, { origins: string[]; signals: Array<"lineage" | "tombstone"> }>();
    const pending = unique(edges.filter(({ from }) => normalize(from) === normalized).map(({ from }) => from));
    for (const id of pending) seen.set(id, { origins: [], signals: [] });
    // Monotone sets over finite canonical IDs reach a fixed point even for malformed cycles.
    for (let index = 0; index < pending.length; index += 1) {
      const id = pending[index]!; const current = seen.get(id)!;
      for (const edge of edges.filter(({ from }) => from === id)) for (const targetId of edge.toIds) {
        const prior = seen.get(targetId);
        const origins = unique([...(prior?.origins ?? []), ...current.origins, ...edge.origins]);
        const signals = [...new Set([...(prior?.signals ?? []), ...current.signals, edge.signal])].sort();
        if (prior === undefined || origins.length !== prior.origins.length || signals.length !== prior.signals.length) {
          seen.set(targetId, { origins, signals }); pending.push(targetId);
        }
      }
    }
    return [...seen].flatMap(([id, { origins, signals }]) => {
      const target = this.entitiesById.get(id);
      return target === undefined ? [] : signals.map((signal) => candidateFor(target, signal, 1, target.accepted, origins.filter((origin) => origin !== id)));
    });
  }

  resolveNamedTargets(namedTargets: readonly string[]): KnowledgeInterpretationCandidate[] {
    const result: KnowledgeInterpretationCandidate[] = [];
    for (const target of unique(namedTargets)) {
      const normalized = target.replaceAll("\\", "/");
      const unit = this.unitByPath.get(normalized) ?? this.units.find(({ id, key }) => id === target || key === target);
      if (unit === undefined) continue;
      result.push({
        entityId: unit.id,
        entityKind: "projection-unit",
        score: 1,
        direct: true,
        signals: [unit.id === target ? "id" : "key"],
        explanation: `Explicit repository target ${target} resolved to observed projection unit ${unit.id}.`,
        continuityFromIds: [],
      });
    }
    return mergeCandidates(result);
  }

  async bindIdentity(request: string, addressed: readonly string[], namedTargets: readonly string[], context: AdapterContext): Promise<BoundQueryResult<KnowledgeInterpretationCandidate[]>> {
    const query = this.registry.createSpec({ id: `knowledge-identity:${hashFramedDomain("knowledge-identity-input", { request, addressed, namedTargets }).slice(-24)}`, programId: KNOWLEDGE_QUERY_PROGRAMS.identity, input: { request, addressed, namedTargets } });
    const value = mergeCandidates([...this.search(request, addressed, Number.MAX_SAFE_INTEGER), ...this.resolveNamedTargets(namedTargets)]);
    return { value, dependency: { query, priorResult: await this.registry.evaluate(query, context), role: "semantic identity candidates, accepted addresses, lineage, and tombstone continuity" } };
  }

  discovery(context: AdapterContext, collect: StateQueryDependency[]): RelevanceDiscoveryPort {
    return { discover: async (subjectId, depth) => this.discover(subjectId, depth, context, collect) };
  }

  async load(entityId: string): Promise<ContextSource | undefined> {
    const entity = this.entitiesById.get(entityId);
    if (entity !== undefined) {
      const kind = entity.kind === "architecture-decision" ? "decision" : entity.kind === "projection-lens" || entity.kind === "architecture-concern" || entity.kind === "developer-preference" ? "other" : entity.kind;
      const authority = this.authorityFor(entity);
      const authorityEnvelope = authority === undefined ? undefined : this.envelopeById.get(authority.id);
      const full = canonicalJson(authorityEnvelope === undefined
        ? entity.payload
        : { record: entity.payload, authority: authorityEnvelope });
      return {
        entityId,
        kind,
        semanticHash: authority === undefined
          ? entity.semanticHash
          : hashFramedDomain("knowledge-context-source", { entity: entity.semanticHash, authority: authority.semanticHash }),
        full,
        summary: authority === undefined ? this.summary(entity) : `${this.summary(entity)} Authority rationale: ${authority.rationale}`,
      };
    }
    const unit = this.units.find(({ id }) => id === entityId);
    if (unit === undefined) return undefined;
    return { entityId, kind: "projection-unit", semanticHash: unit.semanticSignature.hash, full: canonicalJson(unit), summary: `${unit.role} ${this.unitPath.get(unit.id) ?? unit.key}` };
  }

  valueDependency(entityId: string): StateValueDependencyRef | undefined {
    const entity = this.entitiesById.get(entityId);
    if (entity !== undefined) return { kind: entity.kind === "projection-lens" ? "canonical-governance" : "canonical-entity", id: entity.id, versionHash: entity.semanticHash, role: "knowledge semantic meaning" };
    const unit = this.units.find(({ id }) => id === entityId);
    return unit === undefined ? undefined : { kind: "projection-unit", id: unit.id, versionHash: unit.semanticSignature.hash, role: "knowledge observed semantic unit" };
  }

  valueDependencies(entityIds: readonly string[]): StateValueDependencyRef[] {
    const dependencies = entityIds.map((id) => this.valueDependency(id)).filter((item): item is StateValueDependencyRef => item !== undefined);
    for (const id of unique(entityIds)) {
      const sourceHash = this.sourceHash(id);
      if (sourceHash !== undefined) dependencies.push({ kind: "artifact", id: `knowledge-source:${id}`, versionHash: sourceHash, role: `exact source for knowledge ${id}` });
    }
    for (const entity of this.entities.filter(({ id, kind }) => entityIds.includes(id) && (kind === "projection-lens" || kind === "architecture-decision"))) {
      const authority = this.referencedAuthority(entity);
      if (authority !== undefined) {
        dependencies.push({ kind: "canonical-governance", id: authority.id, versionHash: authority.semanticHash, role: `authority for knowledge ${entity.kind} ${entity.id}` });
        const authoritySource = this.sourceHash(authority.id);
        if (authoritySource !== undefined) dependencies.push({ kind: "artifact", id: `knowledge-source:${authority.id}`, versionHash: authoritySource, role: `exact authority source for knowledge ${entity.kind} ${entity.id}` });
      }
    }
    return dependencies;
  }

  authorityUnknowns(entityIds: readonly string[]): string[] {
    return this.entities
      .filter(({ id, kind }) => entityIds.includes(id) && (kind === "projection-lens" || kind === "architecture-decision"))
      .filter((entity) => this.authorityFor(entity) === undefined)
      .map((entity) => `referenced authority for ${entity.kind} ${entity.id} is unavailable or does not govern its declared subject`)
      .sort(compare);
  }

  topologyUnknowns(entityIds: readonly string[]): string[] {
    if (!entityIds.some((id) => this.supportsStaticTopology(id))) return [];
    return this.uncertainTopologyImporters().map(({ path, uncertainty }) => `runtime dependency target remains unknown in ${path}: ${uncertainty.join("; ")}`);
  }

  sourceHash(entityId: string): ContentHash | undefined {
    const entity = this.entitiesById.get(entityId);
    if (entity !== undefined) return entity.envelope.canonicalDocumentHash;
    const canonical = this.envelopeById.get(entityId);
    if (canonical !== undefined) return canonical.canonicalDocumentHash;
    const unit = this.units.find(({ id }) => id === entityId);
    if (unit === undefined) return undefined;
    return this.observation.analysis.files.find(({ artifactId }) => artifactId === unit.artifactId)?.contentHash ?? unit.structuralSignature.hash;
  }

  semanticHash(entityId: string): ContentHash | undefined {
    return this.entitiesById.get(entityId)?.semanticHash ?? this.units.find(({ id }) => id === entityId)?.semanticSignature.hash;
  }

  lensObligations(entityIds: ReadonlySet<string>, operation: string): KnowledgeLensObligation[] {
    if (this.lensCompilation === undefined) return [];
    const activeLenses = this.lenses.filter(({ status, id }) => status === "active" && entityIds.has(id));
    const units = this.units.filter(({ id }) => entityIds.has(id));
    const result: KnowledgeLensObligation[] = [];
    for (const lens of activeLenses) {
      const members = new Set(this.lensCompilation.memberships[lens.id] ?? []);
      for (const unit of units.filter(({ id }) => members.has(id))) {
        const selectorFacts = { ...(this.selectorFactsByUnitId.get(unit.id) ?? {}), operation };
        const subject = projectionUnitSelectorSubject(unit, selectorFacts);
        const bundle = compileEffectiveRuleBundle({ unit, operation, rules: lens.rules, selectorFacts });
        const expectations = lens.expectedProjections.filter((projection) => projection.role === unit.role && projection.surfaceKind === "repository" && evaluateSelector(projection.selector, subject).matched);
        const expectationValidators = expectations.flatMap(({ expectation }) => expectation.kind === "predicate-constrained" ? expectation.validatorIds : []);
        result.push({
          lensId: lens.id,
          lensVersion: lens.version,
          lensSemanticHash: lens.semanticHash,
          authorityRecordId: lens.authorityRecordId,
          unitId: unit.id,
          membershipFingerprint: this.lensCompilation.membershipFingerprints[lens.id] as ContentHash,
          applicabilityFingerprint: hashFramedDomain("knowledge-lens-applicability", { lensId: lens.id, unitId: unit.id, operation, bundle: bundle.dependencyFingerprint, expectations: expectations.map(({ role, expectation }) => ({ role, kind: expectation.kind })) }),
          ruleIds: bundle.rules.map(({ id }) => id),
          predicates: bundle.predicates,
          validatorIds: unique([...bundle.rules.flatMap(({ validatorIds }) => validatorIds), ...bundle.predicates.flatMap((predicate) => predicate.kind === "validator" ? [predicate.validatorId] : []), ...expectationValidators, ...lens.validators.filter(({ required }) => required).map(({ id, version }) => `${id}@${version}`)]),
          expectationKinds: unique(expectations.map(({ expectation }) => expectation.kind)),
          status: "applicable",
          unknowns: [],
        });
      }
    }
    return result.sort((left, right) => compare(`${left.lensId}\0${left.unitId}`, `${right.lensId}\0${right.unitId}`));
  }

  validatorRequests(entityIds: ReadonlySet<string>, operation: string): KnowledgeValidatorRequest[] {
    const requests: KnowledgeValidatorRequest[] = [];
    for (const obligation of this.lensObligations(entityIds, operation)) {
      const lens = this.lenses.find(({ id }) => id === obligation.lensId)!;
      for (const binding of lens.validators) {
        if (binding.provider === "deterministic-governance" && binding.id === "projector.builtin.static-dependency-boundary" && binding.version === "1") continue;
        if (binding.required || obligation.validatorIds.includes(`${binding.id}@${binding.version}`)) requests.push({ binding, unitId: obligation.unitId, unitPath: this.unitPath.get(obligation.unitId) ?? "" });
      }
    }
    return requests;
  }

  relevantDecisions(entityIds: ReadonlySet<string>): ArchitectureDecision[] {
    const selected = new Set(entityIds);
    for (const lens of this.lenses.filter(({ id }) => entityIds.has(id))) {
      for (const basis of [...lens.governanceBasis, ...lens.rules.flatMap(({ governanceBasis }) => governanceBasis)]) if (basis.kind === "architecture-decision") selected.add(basis.decisionId);
    }
    return this.decisions.filter(({ id }) => selected.has(id));
  }

  bindDecisionApplicability(decisionId: string, context: AdapterContext): Promise<StateQueryDependency> {
    return this.dependency(KNOWLEDGE_QUERY_PROGRAMS.decisionApplicability, `knowledge-decision-applicability:${decisionId}`, { decisionId }, "decision-applicability", context);
  }

  bindDecisionTriggers(decisionId: string, operation: string, context: AdapterContext): Promise<StateQueryDependency> {
    return this.dependency(KNOWLEDGE_QUERY_PROGRAMS.decisionTriggers, `knowledge-decision-triggers:${decisionId}`, { decisionId, operation }, "decision-trigger-observations", context);
  }

  governanceEvaluations(entityIds: ReadonlySet<string>, operation: string, validatorFindings: readonly ExternalGovernanceValidatorFinding[] = []): GovernanceBundleEvaluation[] {
    if (this.lensCompilation === undefined) return [];
    const observation = this.governanceObservation();
    const evaluations: GovernanceBundleEvaluation[] = [];
    for (const lens of this.lenses.filter(({ status, id }) => status === "active" && entityIds.has(id))) {
      const members = new Set(this.lensCompilation.memberships[lens.id] ?? []);
      for (const unit of this.units.filter(({ id }) => entityIds.has(id) && members.has(id))) {
        const selectorFacts = { ...(this.selectorFactsByUnitId.get(unit.id) ?? {}), operation };
        const bundle = compileEffectiveRuleBundle({ unit, operation, rules: lens.rules, selectorFacts });
        const requiredValidatorIds = lens.validators.filter(({ required }) => required).map(({ id, version }) => `${id}@${version}`);
        const expected = this.lensObligations(entityIds, operation).find((item) => item.lensId === lens.id && item.unitId === unit.id);
        const expectationIds = expected?.validatorIds ?? [];
        evaluations.push(evaluateEffectiveRuleBundle(bundle, observation, { validatorFindings, requiredValidatorIds: unique([...requiredValidatorIds, ...expectationIds]) }));
      }
    }
    return evaluations.sort((left, right) => compare(left.unitId, right.unitId) || compare(left.contentHash, right.contentHash));
  }

  governanceObservation(): GovernanceObservation {
    const subjects = this.units.map((unit) => projectionUnitSelectorSubject(unit, this.selectorFactsByUnitId.get(unit.id)));
    const externalSubjects = new Map<string, GovernanceObservation["subjects"][number]>();
    const dependencies: Array<GovernanceObservation["dependencies"][number]> = [];
    for (const dependency of this.observation.analysis.dependencies) {
      const from = this.unitByPath.get(dependency.importerPath);
      if (from === undefined) continue;
      const local = dependency.resolvedPath === undefined ? undefined : this.unitByPath.get(dependency.resolvedPath);
      let toSubjectId = local?.id;
      if (toSubjectId === undefined && !dependency.specifier.startsWith(".") && !dependency.specifier.startsWith("#") && !dependency.specifier.startsWith("/")) {
        const packageName = externalPackageName(dependency.specifier);
        toSubjectId = `external-package:${packageName}`;
        externalSubjects.set(toSubjectId, {
          id: toSubjectId,
          // External packages are known not to have a repository-relative path.
          // An empty value set lets mixed path/package selectors decide that
          // branch as false instead of treating the path fact as unavailable.
          values: { path: [], package: packageName, "package-kind": "external" },
          dependencyKeys: [`external-package:${packageName}`],
        });
      }
      dependencies.push({
        fromUnitId: from.id,
        ...(toSubjectId === undefined ? {} : { toSubjectId }),
        specifier: dependency.specifier,
        evidenceIds: [`dependency_evidence_${hashFramedDomain("knowledge-dependency-evidence", dependency).slice(-32)}`],
      });
    }
    const javascriptCapability = this.observation.analysis.capabilities.find(({ analyzerId }) => analyzerId === "projector.javascript-local");
    const filesByPath = new Map(this.observation.analysis.javaScript.files.map((file) => [file.path, file]));
    const dependencyEnumerations = this.units.map((unit) => {
      const path = this.unitPath.get(unit.id);
      const file = path === undefined ? undefined : filesByPath.get(path);
      const failures = path === undefined ? [] : this.observation.analysis.javaScript.failures.filter(({ scope, affectedClaimKinds }) => scope === path && affectedClaimKinds.includes("dependency"));
      const unknowns = unique([...(file?.unknowns ?? []).filter((item) => /import|module|dependency/iu.test(item)), ...failures.map(({ message }) => message)]);
      const base = javascriptCapability?.enumeration;
      const contract = file === undefined || base === undefined
        ? { observability: "unavailable" as const, method: "no supported static dependency analyzer for unit", assumptions: [], blindSpots: ["dependency observations unavailable"], dynamicMechanisms: [] }
        : { ...base, dynamicMechanisms: unknowns.some((item) => /dynamic|runtime/iu.test(item)) ? base.dynamicMechanisms : [] };
      return { unitId: unit.id, contract, unknowns };
    });
    return {
      subjects: [...subjects, ...externalSubjects.values()].sort((left, right) => compare(left.id, right.id)),
      unitIds: this.units.map(({ id }) => id),
      dependencies,
      unitEnumeration: this.observation.analysis.surface.enumeration,
      dependencyEnumerations,
    };
  }

  currentVersionHash(dependency: StateValueDependencyRef): ContentHash | undefined {
    if (dependency.kind === "artifact" && dependency.id.startsWith("knowledge-source:")) return this.sourceHash(dependency.id.slice("knowledge-source:".length));
    const entity = this.entitiesById.get(dependency.id);
    if (entity !== undefined) return entity.semanticHash;
    const unit = this.units.find(({ id }) => id === dependency.id);
    if (unit !== undefined) return unit.semanticSignature.hash;
    return this.authorities.find(({ id }) => id === dependency.id)?.semanticHash;
  }

  private registerPrograms(): void {
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.decisionApplicability, version: "1", kind: "decision-applicability", normalizeInput: (input) => ({ decisionId: String(input.decisionId) }), evaluate: ({ input }) => this.decisionApplicabilityResult(String(input.decisionId)) });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.decisionMembership, version: "1", kind: "selector-membership", normalizeInput: (input) => ({ unitId: String(input.unitId) }), evaluate: ({ input }) => ({ results: this.decisions.filter((decision) => this.implementationBindings(decision.id).some(({ id }) => id === input.unitId)).map(({ id, semanticHash }) => ({ id, semanticHash })), observability: this.observation.analysis.surface.enumeration.observability, assumptions: [], unavailableLanes: this.failureLanes(["projector.filesystem-local"]), dependencyKeys: ["canonical-decisions", "projection-unit-membership"] }) });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.decisionTriggers, version: "1", kind: "custom", normalizeInput: (input) => ({ decisionId: String(input.decisionId), operation: String(input.operation) }), evaluate: async ({ input }) => {
      const decision = this.decisions.find(({ id }) => id === input.decisionId);
      if (decision === undefined) return { results: [], observability: "unavailable", assumptions: [], unavailableLanes: ["decision missing"], dependencyKeys: ["canonical-decisions"] };
      const observed = await this.decisionRun.observe(decision, String(input.operation));
      return { results: [{ id: decision.id, baseline: observed.baseline, checks: observed.checks, observations: observed.observations }], observability: "closed", assumptions: observed.checks.filter(({ status }) => status === "unobserved").map(({ reason }) => reason), unavailableLanes: [...observed.unknowns], dependencyKeys: ["canonical-decisions", "canonical-authorities", "decision-trigger-observations"] };
    } });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.identity, version: "1", kind: "semantic-identity-search", normalizeInput: (input) => ({ request: String(input.request ?? "").normalize("NFKC").trim(), addressed: unique(Array.isArray(input.addressed) ? input.addressed.map(String).map((item) => item.normalize("NFKC").trim()).filter(Boolean) : []), namedTargets: unique(Array.isArray(input.namedTargets) ? input.namedTargets.map(String).map((item) => item.replaceAll("\\", "/").normalize("NFKC").trim()).filter(Boolean) : []) }), evaluate: ({ input }) => ({ results: mergeCandidates([...this.search(input.request as string, input.addressed as string[], Number.MAX_SAFE_INTEGER), ...this.resolveNamedTargets(input.namedTargets as string[])]).map((item) => ({ id: item.entityId, ...item })), observability: "closed", assumptions: [], unavailableLanes: [], dependencyKeys: ["canonical-identity-discovery", "canonical-lineage", "canonical-tombstones", "projection-unit-membership", ...((input.namedTargets as string[]).map((target) => `path:${target}`))] }) });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.relations, version: "1", kind: "relation-neighborhood", normalizeInput: (input) => ({ subjectId: String(input.subjectId ?? "") }), evaluate: ({ input }) => ({ results: this.relations.filter(({ fromId, toId }) => fromId === input.subjectId || toId === input.subjectId).map(({ id, fromId, toId, type, semanticHash }) => ({ id, fromId, toId, type, semanticHash })), observability: "closed", assumptions: [], unavailableLanes: [], dependencyKeys: ["canonical-relations", `entity:${String(input.subjectId)}`] }) });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.implementation, version: "1", kind: "implementation-binding", normalizeInput: (input) => ({ subjectId: String(input.subjectId ?? "") }), evaluate: ({ input }) => ({ results: this.implementationBindings(String(input.subjectId)), observability: this.observation.analysis.surface.enumeration.observability, assumptions: this.observation.analysis.surface.enumeration.assumptions, unavailableLanes: this.failureLanes(["projector.filesystem-local"]), dependencyKeys: ["canonical-scopes", "projection-unit-membership", `entity:${String(input.subjectId)}`] }) });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.topology, version: "3", kind: "package-dependency", normalizeInput: (input) => ({ unitId: String(input.unitId ?? "") }), evaluate: ({ input }) => {
      const unitId = String(input.unitId);
      const boundary = this.topologyObservationBoundary(unitId);
      return { results: [...this.topologyNeighbors(unitId), ...this.uncertainTopologyImporters()], ...boundary, dependencyKeys: ["repository-module-dependencies", "repository-test-targets", `projection-unit:${unitId}`] };
    } });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.lensMembership, version: "1", kind: "selector-membership", normalizeInput: (input) => ({ unitId: String(input.unitId ?? "") }), evaluate: ({ input }) => this.lensMembershipResult(String(input.unitId)) });
  }

  private async dependency(programId: string, id: string, input: Record<string, unknown>, role: string, context: AdapterContext): Promise<StateQueryDependency> {
    const query = this.registry.createSpec({ id, programId, input });
    return { query, priorResult: await this.registry.evaluate(query, context), role };
  }

  private async discover(subjectId: string, depth: number, context: AdapterContext, collect: StateQueryDependency[]): Promise<{ edges: readonly RelevanceDiscoveryEdge[]; dependency: StateQueryDependency }> {
    const relationDependency = await this.dependency(KNOWLEDGE_QUERY_PROGRAMS.relations, `knowledge-relations:${subjectId}`, { subjectId }, `typed relation neighborhood for ${subjectId}`, context);
    const dependencies = [relationDependency];
    const edges: RelevanceDiscoveryEdge[] = this.relationEdges(subjectId, depth);
    const implementationDependency = await this.dependency(KNOWLEDGE_QUERY_PROGRAMS.implementation, `knowledge-implementation:${subjectId}`, { subjectId }, `implementation and selector bindings for ${subjectId}`, context);
    dependencies.push(implementationDependency);
    edges.push(...this.implementationBindings(subjectId).map(({ id, reason }) => this.edge(subjectId, id as string, "consequence", 0.82, "implementation-binding", reason as string, "derived")));
    if (this.units.some(({ id }) => id === subjectId)) {
      const decisionDependency = await this.dependency(KNOWLEDGE_QUERY_PROGRAMS.decisionMembership, `knowledge-decisions:${subjectId}`, { unitId: subjectId }, `active decision applicability for ${subjectId}`, context);
      dependencies.push(decisionDependency);
      for (const decision of this.decisions.filter((item) => this.implementationBindings(item.id).some(({ id }) => id === subjectId))) edges.push(this.edge(subjectId, decision.id, "governing", 0.93, "selector-applicability", `active decision ${decision.id} applies to ${subjectId}`, "derived", true));
      if (this.supportsStaticTopology(subjectId)) {
        const topologyDependency = await this.dependency(KNOWLEDGE_QUERY_PROGRAMS.topology, `knowledge-topology:${subjectId}`, { unitId: subjectId }, `static dependency and test topology for ${subjectId}`, context);
        dependencies.push(topologyDependency);
        edges.push(...this.topologyNeighbors(subjectId).map(({ id, reasons, directions }) => {
          const verification = reasons.includes("test-target");
          return this.edge(subjectId, id, "consequence", 0.72, verification ? "verification-binding" : "package-dependency", `${reasons.join("+")} topology (${directions.join(",") || "undirected"})`, "observed");
        }));
      }
      const lensDependency = await this.dependency(KNOWLEDGE_QUERY_PROGRAMS.lensMembership, `knowledge-lenses:${subjectId}`, { unitId: subjectId }, `active lens membership for ${subjectId}`, context);
      dependencies.push(lensDependency);
      if (this.lensCompilation !== undefined) {
        for (const lens of this.lenses.filter(({ status, id }) => status === "active" && (this.lensCompilation!.memberships[id] ?? []).includes(subjectId))) {
          edges.push(this.edge(subjectId, lens.id, "governing", 0.94, "selector-applicability", `active lens ${lens.id} applies to ${subjectId}`, "derived", true));
        }
      }
    }
    collect.push(...dependencies);
    return { edges, dependency: relationDependency };
  }

  private relationEdges(subjectId: string, depth: number): RelevanceDiscoveryEdge[] {
    return this.relations.filter(({ fromId, toId }) => fromId === subjectId || toId === subjectId).map((relation) => {
      const outgoing = relation.fromId === subjectId;
      const targetId = outgoing ? relation.toId : relation.fromId;
      const governing = outgoing
        ? ["requires", "depends-on", "governed-by", "has-requirement", "constrains"].includes(relation.type)
        : ["constrains", "applies-to", "governed-by", "has-requirement"].includes(relation.type);
      const band: Exclude<RelevanceBand, "direct"> = governing ? "governing" : depth > 0 ? "possible" : "consequence";
      const reasonKind: RelevanceReason["kind"] = relation.type === "constrains" ? "constrains" : relation.type === "depends-on" || relation.type === "requires" ? "depends-on" : relation.type === "governed-by" ? "governs" : relation.type === "verifies" || relation.type === "demonstrated-by" ? "verification-binding" : "implementation-binding";
      return this.edge(subjectId, targetId, band, Math.max(0.55, relation.confidence), reasonKind, `${relation.type} relation ${relation.id} connects ${subjectId} to ${targetId}`, relation.sourceClass === "inferred" ? "inferred" : relation.sourceClass === "observed" ? "observed" : "declared", governing);
    });
  }

  implementationBindings(subjectId: string): Array<Record<string, unknown>> {
    // Membership depends only on this graph's repository observation. Reuse it
    // across branches and query validation, never across fresh observations or
    // for live decision-trigger checks. Callers cannot mutate retained results.
    let bindings = this.implementationBindingsBySubjectId.get(subjectId);
    if (bindings === undefined) {
      bindings = Object.freeze(this.computeImplementationBindings(subjectId).map((binding) => Object.freeze(binding)));
      this.implementationBindingsBySubjectId.set(subjectId, bindings);
    }
    return bindings.map((binding) => ({ ...binding }));
  }

  private computeImplementationBindings(subjectId: string): Array<Record<string, unknown>> {
    const direct = this.units.filter((unit) => unit.conceptIds.includes(subjectId) || unit.requirementIds.includes(subjectId) || unit.scenarioIds.includes(subjectId)).map(({ id }) => ({ id, reason: "typed projection-unit semantic binding" }));
    const entity = this.entitiesById.get(subjectId);
    // Preferences influence future options. They do not implicitly govern code or
    // reactivate decisions that retain an earlier preference snapshot.
    if (entity?.kind === "developer-preference") return direct;
    if (entity?.kind === "projection-lens") return (this.lensCompilation?.memberships[subjectId] ?? []).map((id) => ({ id, reason: "active lens selector matched observed unit", membershipFingerprint: this.lensCompilation!.membershipFingerprints[subjectId] }));
    if (entity === undefined || !("scope" in entity.payload) || typeof entity.payload.scope === "string") return direct;
    const membership = evaluateSelectorMembership(entity.payload.scope, this.selectorSubjects, { observability: this.observation.analysis.surface.enumeration.observability, assumptions: this.observation.analysis.surface.enumeration.assumptions, unavailableLanes: this.failureLanes(["projector.filesystem-local"]) });
    return [...direct, ...membership.memberIds.map((id) => ({ id, reason: `canonical ${entity.kind} scope selector matched observed unit`, selectorHash: membership.selectorHash }))]
      .sort((left, right) => compare(String(left.id), String(right.id)));
  }

  private decisionApplicabilityResult(decisionId: string) {
    const decision = this.decisions.find(({ id }) => id === decisionId);
    const fields = (selector: ArchitectureDecision["scope"]): string[] => selector.op === "atom" ? [selector.field] : selector.op === "not" ? fields(selector.item) : selector.items.flatMap(fields);
    const supported = decision !== undefined && fields(decision.scope).every((field) => ["path", "surface", "package", "package-kind"].includes(field));
    const failures = this.failureLanes(["projector.filesystem-local"]);
    const available = this.observation.analysis.surface.access !== "unavailable";
    return { results: this.implementationBindings(decisionId), observability: supported && available && failures.length === 0 ? "closed" as const : "unavailable" as const,
      assumptions: [...this.observation.analysis.surface.enumeration.assumptions, "Applicability is closed over the repository inventory's declared file boundary, not runtime-created or external units."],
      unavailableLanes: [...failures, ...(!supported ? ["decision selector requires facts outside the supported repository applicability observer"] : []), ...(!available ? ["repository inventory unavailable"] : [])], dependencyKeys: ["canonical-decisions", "projection-unit-membership"] };
  }

  private topologyNeighbors(unitId: string): Array<{ readonly id: string; readonly reasons: string[]; readonly directions: string[] }> {
    const path = this.unitPath.get(unitId);
    if (path === undefined) return [];
    const results = new Map<string, { reasons: Set<string>; directions: Set<string> }>();
    const add = (id: string, reason: string, direction?: string): void => {
      const aggregate = results.get(id) ?? { reasons: new Set<string>(), directions: new Set<string>() };
      aggregate.reasons.add(reason);
      if (direction !== undefined) aggregate.directions.add(direction);
      results.set(id, aggregate);
    };
    for (const dependency of this.observation.analysis.dependencies) {
      if (dependency.importerPath === path && dependency.resolvedPath !== undefined) {
        const target = this.unitByPath.get(dependency.resolvedPath);
        if (target !== undefined) add(target.id, "static-import", "out");
      } else if (dependency.resolvedPath === path) {
        const target = this.unitByPath.get(dependency.importerPath);
        if (target !== undefined) add(target.id, "static-import", "in");
      }
    }
    for (const target of this.observation.analysis.testTargets) {
      if (target.targetPath === path) {
        const unit = this.unitByPath.get(target.testPath);
        if (unit !== undefined) add(unit.id, "test-target");
      } else if (target.testPath === path) {
        const unit = this.unitByPath.get(target.targetPath);
        if (unit !== undefined) add(unit.id, "test-target");
      }
    }
    return [...results.entries()].map(([id, aggregate]) => ({ id, reasons: [...aggregate.reasons].sort(compare), directions: [...aggregate.directions].sort(compare) }))
      .sort((left, right) => compare(left.id, right.id));
  }

  private topologyObservationBoundary(unitId: string) {
    const path = this.unitPath.get(unitId);
    const capability = this.observation.analysis.capabilities.find(({ analyzerId }) => analyzerId === "projector.javascript-local");
    const file = path === undefined ? undefined : this.observation.analysis.javaScript.files.find((candidate) => candidate.path === path);
    if (path === undefined || capability === undefined || file === undefined) {
      return {
        observability: "unavailable" as const,
        assumptions: [],
        unavailableLanes: [`projector.javascript-local:static-dependency-topology:${path ?? unitId}`],
      };
    }
    const failures = this.observation.analysis.javaScript.failures
      .filter(({ scope, affectedClaimKinds }) => scope === path && (affectedClaimKinds.includes("dependency") || affectedClaimKinds.includes("test-target")))
      .map(({ analyzerId, capability: failedCapability, scope }) => `${analyzerId}:${failedCapability}:${scope}`);
    return {
      observability: capability.enumeration.observability,
      assumptions: unique([
        ...capability.enumeration.assumptions,
        `topology is bounded to observed static import, export, and test-target syntax for ${path}`,
        "incoming runtime dependency targets are not inferred; uncertain importer identities and source hashes are bound separately",
      ]),
      // Dynamic/runtime targets are explicit uncertainty records in the query
      // result. They remain unknown, but do not make the supported static
      // syntax lane itself unavailable.
      unavailableLanes: unique(failures),
    };
  }

  private supportsStaticTopology(unitId: string): boolean {
    const path = this.unitPath.get(unitId);
    return path !== undefined && this.observation.analysis.javaScript.files.some((file) => file.path === path);
  }

  private uncertainTopologyImporters(): Array<{ readonly id: string; readonly path: string; readonly sourceHash: ContentHash; readonly uncertainty: string[] }> {
    const uncertaintyByPath = new Map<string, string[]>();
    for (const file of this.observation.analysis.javaScript.files) {
      const unknowns = file.unknowns.filter((item) => /import|module|dependency/iu.test(item));
      if (unknowns.length > 0) uncertaintyByPath.set(file.path, unknowns);
    }
    for (const failure of this.observation.analysis.javaScript.failures.filter(({ affectedClaimKinds }) => affectedClaimKinds.includes("dependency") || affectedClaimKinds.includes("test-target"))) {
      uncertaintyByPath.set(failure.scope, unique([...(uncertaintyByPath.get(failure.scope) ?? []), failure.message]));
    }
    return [...uncertaintyByPath.entries()].flatMap(([path, uncertainty]) => {
      const source = this.observation.analysis.files.find((file) => file.path === path);
      if (source === undefined) return [];
      return [{ id: `uncertain-topology-importer:${source.artifactId}`, path, sourceHash: source.contentHash, uncertainty: unique(uncertainty) }];
    }).sort((left, right) => compare(left.id, right.id));
  }

  private lensMembershipResult(unitId: string) {
    if (this.lensCompilation === undefined) return { results: [], observability: "unavailable" as const, assumptions: [], unavailableLanes: [this.lensCompilationUnknown ?? "lens compilation unavailable"], dependencyKeys: ["canonical-lenses", "canonical-authorities", `projection-unit:${unitId}`] };
    const results = this.lenses.filter(({ status, id }) => status === "active" && (this.lensCompilation!.memberships[id] ?? []).includes(unitId)).map(({ id, version, semanticHash, authorityRecordId }) => ({ id, version, semanticHash, authorityRecordId, membershipFingerprint: this.lensCompilation!.membershipFingerprints[id] }));
    return { results, observability: "bounded" as const, assumptions: this.observation.analysis.surface.enumeration.assumptions, unavailableLanes: [], dependencyKeys: ["canonical-lenses", "canonical-authorities", "projection-unit-membership", `projection-unit:${unitId}`] };
  }

  private failureLanes(analyzerIds: readonly string[]): string[] {
    const selected = new Set(analyzerIds);
    return this.observation.analysis.failures
      .filter(({ analyzerId }) => selected.has(analyzerId))
      .map(({ analyzerId, capability, scope }) => `${analyzerId}:${capability}:${scope}`)
      .sort(compare);
  }

  private authorityFor(entity: SemanticEntity): AuthorityRecord | undefined {
    if (entity.kind === "projection-lens") {
      const lens = entity.payload as ProjectionLens;
      const assessment = assessLensAuthority(lens, this.authorities);
      return assessment.eligible ? assessment.record : undefined;
    }
    if (entity.kind === "architecture-decision") {
      const decision = entity.payload as ArchitectureDecision;
      const record = this.authorities.find(({ id }) => id === decision.authorityRecordId);
      if (record === undefined
        || record.subjectId !== decision.concernId
        || (record.status !== "approved" && record.status !== "auto-approved")
        || record.conclusion === "unknown"
        || record.conclusion === "exception"
        || (record.decidedBy === "system" && record.status !== "auto-approved")) return undefined;
      return record;
    }
    return undefined;
  }

  private referencedAuthority(entity: SemanticEntity): AuthorityRecord | undefined {
    if (entity.kind === "projection-lens") return this.authorities.find(({ id }) => id === (entity.payload as ProjectionLens).authorityRecordId);
    if (entity.kind === "architecture-decision") return this.authorities.find(({ id }) => id === (entity.payload as ArchitectureDecision).authorityRecordId);
    return undefined;
  }

  private edge(fromId: string, entityId: string, band: Exclude<RelevanceBand, "direct">, score: number, kind: RelevanceReason["kind"], explanation: string, provenance: RelevanceReason["provenance"], requiredForPlanning = false): RelevanceDiscoveryEdge {
    return { entityId, band, score, requiredForPlanning, cost: 1, reason: { kind, fromId, weight: score, provenance, confidence: score, explanation, evidenceIds: [] } };
  }

  private summary(entity: SemanticEntity): string {
    const payload = entity.payload;
    if (entity.kind === "concept") return `${(payload as Concept).name}: ${(payload as Concept).statement}`;
    if (entity.kind === "requirement") return `${(payload as Requirement).title}: ${(payload as Requirement).statement}`;
    if (entity.kind === "scenario") return `${(payload as BehavioralScenario).title}: ${(payload as BehavioralScenario).steps.map(({ role, statement }) => `${role}: ${statement}`).join("; ")}`;
    if (entity.kind === "architecture-decision") return `${(payload as ArchitectureDecision).title}: ${(payload as ArchitectureDecision).decision}`;
    if (entity.kind === "architecture-concern") return `${(payload as ArchitectureConcern).title}: ${(payload as ArchitectureConcern).question}`;
    if (entity.kind === "developer-preference") return `${(payload as DeveloperPreference).key}: ${(payload as DeveloperPreference).statement}`;
    return `${(payload as ProjectionLens).key}: ${(payload as ProjectionLens).purpose}`;
  }
}

function externalPackageName(specifier: string): string {
  if (specifier.startsWith("@")) return specifier.split("/").slice(0, 2).join("/");
  return specifier.startsWith("node:") ? specifier : specifier.split("/")[0]!;
}
