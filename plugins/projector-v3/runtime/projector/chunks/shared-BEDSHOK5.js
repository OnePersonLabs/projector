import {
  DecisionBaselineReader,
  captureDecisionTriggerObservations
} from "./shared-JM234DST.js";
import {
  SEMANTIC_TOPOLOGY_PROGRAM,
  projectSemanticNeighborhood
} from "./shared-I4PDDX5T.js";
import {
  SqliteCodeStore,
  checkoutCacheLocation
} from "./shared-QSFRBEBN.js";
import {
  verifyCodeInputBinding
} from "./shared-BGCYVYNK.js";
import {
  assessLensAuthority,
  compileEffectiveRuleBundle,
  compileProjectionLenses,
  prepareGovernanceEvaluator
} from "./shared-XN3IZTFL.js";
import {
  DependencyScopedStateBindingValidator,
  InMemoryGraphReader,
  QueryDependencyRegistry,
  assessDecisionValidity,
  createStateBinding,
  evaluateSelector,
  evaluateSelectorMembership,
  projectionUnitSelectorSubject
} from "./shared-RMBXVF7C.js";
import {
  ArchitectureConcernSchema,
  ArchitectureDecisionSchema,
  AuthorityRecordSchema,
  BehavioralScenarioSchema,
  ConceptSchema,
  DerivedObservationBudget,
  DeveloperPreferenceSchema,
  LineageRecordSchema,
  ObservationError,
  ProjectionLensSchema,
  RelationSchema,
  RequirementSchema,
  TombstoneSchema,
  canonicalJson,
  hashFramedDomain
} from "./shared-Q56AARV7.js";

// node_modules/@projector/control-plane/dist/knowledge/governance.js
var unique = (items) => [...new Set(items)].sort();
var KnowledgeDecisionRun = class {
  host;
  source;
  observations = /* @__PURE__ */ new Map();
  now;
  constructor(observation, host = {}) {
    this.host = host;
    if ("authority" in observation)
      this.source = observation;
    else {
      const baselines = new DecisionBaselineReader(observation);
      this.source = {
        authority: (decision) => observation.canonical.documents.find(({ id, kind }) => id === decision.authorityRecordId && kind === "authority-record")?.payload,
        observations: (decision, authority) => captureDecisionTriggerObservations(decision, authority, observation.canonical.documents, observation.analysis.files.map(({ path }) => path), observation.analysis.surface.kind),
        baseline: (decision, authority) => baselines.read(decision, authority)
      };
    }
    this.now = (host.now ?? (() => (/* @__PURE__ */ new Date()).toISOString()))();
  }
  observe(decision, operation) {
    const key = `${decision.id}\0${operation}`;
    let result = this.observations.get(key);
    if (result === void 0) {
      result = this.read(decision, operation);
      this.observations.set(key, result);
    }
    return result;
  }
  async read(decision, operation) {
    const authority = this.source.authority(decision);
    if (authority === void 0)
      return { decision, baseline: { kind: "unavailable", reason: "decision authority is missing" }, checks: [], observations: [], unknowns: ["decision authority is missing"] };
    const accepted = this.host.acceptedDecisionBaselines?.find((baseline2) => baseline2.decisionId === decision.id && baseline2.decisionSemanticHash === decision.semanticHash && baseline2.authorityId === authority.id && baseline2.authoritySemanticHash === authority.semanticHash);
    const evidence = accepted === void 0 ? await (this.host.readDecisionBaseline?.(decision, authority) ?? this.source.baseline(decision, authority)) : { kind: "authenticated-transaction", reference: "current-approved-canonical-transaction", baseline: accepted };
    const { baseline: captured, ...baseline } = evidence;
    const observed = this.source.observations(decision, authority);
    const currentValues = new Map(observed.map(({ key, value }) => [key, value]));
    const baselineValues = new Map(captured?.observations.map(({ key, value }) => [key, value]));
    const checks = [];
    const staleEvidenceIds = [];
    const evidenceUnknowns = [];
    for (const { evidenceId } of authority.evidence) {
      const prior = baselineValues.get(`evidence:${evidenceId}`);
      const current = currentValues.get(`evidence:${evidenceId}`);
      if (prior?.semanticHash == null)
        evidenceUnknowns.push(`Evidence ${evidenceId} has no supported accepted observation; external evidence validity is unknown.`);
      else if (prior.semanticHash !== current?.semanticHash)
        staleEvidenceIds.push(evidenceId);
    }
    const add = (trigger, status, reason) => checks.push({ trigger, status, reason });
    const clock = Date.parse(this.now);
    for (const trigger of authority.reconsiderWhen) {
      const key = canonicalJson(trigger);
      if (currentValues.has(key)) {
        const prior = baselineValues.get(key);
        const current = currentValues.get(key);
        if (prior === void 0) {
          add(trigger, "unknown", `No accepted baseline observation for ${trigger.type}: ${evidence.reason ?? "baseline unavailable"}.`);
          continue;
        }
        let fired = canonicalJson(prior) !== canonicalJson(current);
        if (trigger.type === "scope-expanded" || trigger.type === "surface-added") {
          const field = trigger.type === "scope-expanded" ? "paths" : "surfaces";
          const before = prior[field];
          const after = current[field];
          if (!Array.isArray(before) || !Array.isArray(after)) {
            add(trigger, "unknown", `Baseline membership for ${trigger.type} is unavailable.`);
            continue;
          }
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
      const trigger = { type: "evidence-refresh-required", policyKey: refresh.key };
      const acceptedCreatedAt = baselineValues.get("evidence-refresh-created-at");
      const created = typeof acceptedCreatedAt === "string" ? Date.parse(acceptedCreatedAt) : NaN;
      const days = refresh.maxAgeDays;
      const known = days !== void 0 && Number.isFinite(days) && days >= 0 && Number.isFinite(created) && Number.isFinite(clock);
      add(trigger, !known ? "unknown" : clock >= created + days * 864e5 ? "fired" : "current", known ? `Evidence freshness expires ${days} days after accepted authority creation.` : "The required maximum-age observation is unavailable.");
    } else if (refresh?.mode === "version-sensitive") {
      add({ type: "evidence-refresh-required", policyKey: refresh.key }, "unknown", "Required version-sensitive evidence has no supported deterministic version observer.");
    }
    return { decision, authority, baseline, checks, observations: observed, staleEvidenceIds, unknowns: unique([...evidenceUnknowns, ...checks.filter(({ status }) => status === "unknown").map(({ reason }) => reason)]) };
  }
};
async function assessKnowledgeDecisions(graph, decisions, operation, context) {
  const result = [];
  const dependencies = [];
  for (const decision of decisions) {
    const observed = await graph.decisionRun.observe(decision, operation);
    const applicability = await graph.bindDecisionApplicability(decision.id, context);
    const triggers = await graph.bindDecisionTriggers(decision.id, operation, context);
    dependencies.push(applicability, triggers);
    const binding = createStateBinding({ compiledAgainst: context.stateDigest, valueDependencies: graph.valueDependencies([decision.id]), queryDependencies: [applicability, triggers] });
    const validator = new DependencyScopedStateBindingValidator({ values: { readVersionHash: async (ref) => graph.currentVersionHash(ref) }, queries: { evaluate: (query, adapter) => graph.registry.evaluate(query, adapter) } });
    const validity = await assessDecisionValidity({
      decision,
      currentScope: decision.scope,
      binding,
      currentState: context.stateDigest,
      context,
      firedTriggers: observed.checks.filter(({ status }) => status === "fired").map(({ trigger }) => trigger),
      invalidatedAssumptions: observed.checks.filter(({ status, trigger }) => status === "fired" && trigger.type === "assumption-falsified").map(({ trigger }) => trigger.assumptionKey),
      staleEvidenceIds: observed.staleEvidenceIds ?? []
    }, {
      bindingValidator: validator,
      applicability: { evaluate: async () => ({ applicable: true, governedPopulationCount: applicability.priorResult.resultCount, dependency: applicability }) }
    });
    const assessment = validity.state === "valid" && applicability.priorResult.resultCount === 0 ? { ...validity, explanation: `decision ${decision.id} has current conceptual proof but no observed governed repository units; implementation satisfaction is not established` } : validity;
    result.push({
      decisionId: decision.id,
      authorityId: decision.authorityRecordId,
      baseline: observed.baseline,
      checks: observed.checks,
      assessment,
      contentHash: hashFramedDomain("knowledge-decision-validity", { decisionId: decision.id, baseline: observed.baseline, checks: observed.checks, assessment })
    });
  }
  return { decisions: result, dependencies };
}
function knowledgeGovernanceStatus(evaluations, decisions, unknowns) {
  return evaluations.some(({ status }) => status === "violated") ? "violated" : evaluations.some(({ status }) => status === "unknown") || decisions.some(({ assessment }) => assessment.blocksCurrentChange) || unknowns.length > 0 ? "unknown" : evaluations.length > 0 || decisions.length > 0 ? "conformant" : "not-applicable";
}

// node_modules/@projector/control-plane/dist/knowledge/lens-obligations.js
var unique2 = (values) => [...new Set(values)].sort();
function compileKnowledgeLensObligation(lens, unit, membershipFingerprint, facts, operation) {
  const selectorFacts = { ...facts, operation };
  const subject = projectionUnitSelectorSubject(unit, selectorFacts);
  const bundle = compileEffectiveRuleBundle({ unit, operation, rules: lens.rules, selectorFacts });
  const expectations = lens.expectedProjections.filter((projection) => projection.role === unit.role && projection.surfaceKind === "repository" && evaluateSelector(projection.selector, subject).matched);
  const expectationValidators = expectations.flatMap(({ expectation }) => expectation.kind === "predicate-constrained" ? expectation.validatorIds : []);
  return {
    lensId: lens.id,
    lensVersion: lens.version,
    lensSemanticHash: lens.semanticHash,
    authorityRecordId: lens.authorityRecordId,
    unitId: unit.id,
    membershipFingerprint,
    applicabilityFingerprint: hashFramedDomain("knowledge-lens-applicability", { lensId: lens.id, unitId: unit.id, operation, bundle: bundle.dependencyFingerprint, expectations: expectations.map(({ role, expectation }) => ({ role, kind: expectation.kind })) }),
    ruleIds: bundle.rules.map(({ id }) => id),
    predicates: bundle.predicates,
    validatorIds: unique2([...bundle.rules.flatMap(({ validatorIds }) => validatorIds), ...bundle.predicates.flatMap((predicate) => predicate.kind === "validator" ? [predicate.validatorId] : []), ...expectationValidators, ...lens.validators.filter(({ required }) => required).map(({ id, version }) => `${id}@${version}`)]),
    expectationKinds: unique2(expectations.map(({ expectation }) => expectation.kind)),
    status: "applicable",
    unknowns: []
  };
}

// node_modules/@projector/control-plane/dist/knowledge/graph.js
var compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var unique3 = (values) => [...new Set(values)].sort(compare);
var normalize = (value) => value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
var tokens = (value) => unique3(normalize(value).split(/[^\p{L}\p{N}._:@/-]+/u).filter((item) => item.length > 1));
var KNOWLEDGE_QUERY_PROGRAMS = Object.freeze({
  identity: "projector.knowledge.identity",
  relations: "projector.knowledge.relations",
  implementation: "projector.knowledge.implementation-binding",
  topology: "projector.knowledge.repository-topology",
  lensMembership: "projector.knowledge.lens-membership",
  decisionMembership: "projector.knowledge.decision-membership",
  decisionApplicability: "projector.knowledge.decision-applicability",
  decisionTriggers: "projector.knowledge.decision-triggers"
});
function entityStatusAccepted(value) {
  return value.status !== "candidate" && value.status !== "rejected";
}
function parseEntities(documents) {
  const result = [];
  for (const envelope of documents) {
    if (envelope.kind === "concept") {
      const payload = ConceptSchema.parse(envelope.payload);
      result.push({ id: payload.id, key: payload.key, kind: "concept", aliases: payload.aliases, searchable: [payload.key, payload.name, payload.statement, ...payload.aliases], semanticHash: payload.semanticHash, discoveryHash: payload.discoveryHash, accepted: entityStatusAccepted(payload), payload, envelope });
    } else if (envelope.kind === "requirement") {
      const payload = RequirementSchema.parse(envelope.payload);
      result.push({ id: payload.id, key: payload.key, kind: "requirement", aliases: payload.aliases, searchable: [payload.key, payload.title, payload.statement, ...payload.aliases], semanticHash: payload.semanticHash, discoveryHash: payload.discoveryHash, accepted: entityStatusAccepted(payload), payload, envelope });
    } else if (envelope.kind === "behavioral-scenario") {
      const payload = BehavioralScenarioSchema.parse(envelope.payload);
      result.push({ id: payload.id, key: payload.key, kind: "scenario", aliases: payload.aliases, searchable: [payload.key, payload.title, ...payload.aliases, ...payload.steps.map(({ statement }) => statement)], semanticHash: payload.semanticHash, discoveryHash: payload.discoveryHash, accepted: entityStatusAccepted(payload), payload, envelope });
    } else if (envelope.kind === "architecture-decision") {
      const payload = ArchitectureDecisionSchema.parse(envelope.payload);
      result.push({ id: payload.id, key: payload.key, kind: "architecture-decision", aliases: [], searchable: [payload.key, payload.title, payload.decision, ...payload.consequences.map(({ explanation }) => explanation)], semanticHash: payload.semanticHash, discoveryHash: envelope.canonicalDocumentHash, accepted: payload.lifecycle === "active", payload, envelope });
    } else if (envelope.kind === "projection-lens") {
      const payload = ProjectionLensSchema.parse(envelope.payload);
      result.push({ id: payload.id, key: payload.key, kind: "projection-lens", aliases: [], searchable: [payload.key, payload.purpose], semanticHash: payload.semanticHash, discoveryHash: envelope.canonicalDocumentHash, accepted: payload.status === "active", payload, envelope });
    } else if (envelope.kind === "architecture-concern") {
      const payload = ArchitectureConcernSchema.parse(envelope.payload);
      result.push({ id: payload.id, key: payload.key, kind: "architecture-concern", aliases: [], searchable: [payload.key, payload.title, payload.question], semanticHash: payload.semanticHash, discoveryHash: envelope.discoveryHash ?? envelope.canonicalDocumentHash, accepted: payload.sourceClass === "authored", payload, envelope });
    } else if (envelope.kind === "developer-preference") {
      const payload = DeveloperPreferenceSchema.parse(envelope.payload);
      result.push({ id: payload.id, key: payload.key, kind: "developer-preference", aliases: [], searchable: [payload.key, payload.statement], semanticHash: payload.semanticHash, discoveryHash: envelope.discoveryHash ?? envelope.canonicalDocumentHash, accepted: payload.sourceClass === "authored", payload, envelope });
    }
  }
  return result.sort((left, right) => compare(left.id, right.id));
}
function scoreLexical(request, entity) {
  const requestTokens = tokens(request);
  if (requestTokens.length === 0)
    return 0;
  const identityTokens = new Set(tokens([entity.key, ...entity.aliases].join(" ")));
  const allTokens = new Set(tokens(entity.searchable.join(" ")));
  const identityHits = requestTokens.filter((item) => identityTokens.has(item)).length;
  const allHits = requestTokens.filter((item) => allTokens.has(item)).length;
  if (allHits === 0)
    return 0;
  return Math.min(0.95, 0.2 + (0.5 * identityHits + 0.3 * allHits) / requestTokens.length);
}
function mergeCandidates(values) {
  const byId = /* @__PURE__ */ new Map();
  for (const value of values) {
    const existing = byId.get(value.entityId);
    byId.set(value.entityId, existing === void 0 ? value : {
      ...existing,
      score: Math.max(existing.score, value.score),
      direct: existing.direct || value.direct,
      signals: unique3([...existing.signals, ...value.signals]),
      continuityFromIds: unique3([...existing.continuityFromIds, ...value.continuityFromIds]),
      explanation: existing.explanation === value.explanation ? existing.explanation : `${existing.explanation}; ${value.explanation}`
    });
  }
  return [...byId.values()].sort((left, right) => Number(right.direct) - Number(left.direct) || right.score - left.score || compare(left.entityId, right.entityId));
}
function candidateFor(entity, signal, score, direct, continuityFromIds = []) {
  const explanation = signal === "lexical" ? "Lexical overlap retrieved this candidate; it is not proof of semantic identity." : signal === "lineage" || signal === "tombstone" ? `Canonical ${signal} continuity points from ${continuityFromIds.join(", ")} to this identity${direct ? "." : ", but its status is not accepted; it remains a candidate."}` : `Explicit ${signal} addressing matched canonical ${entity.kind} ${entity.id}${direct ? "." : ", but its status is not accepted; it remains a candidate."}`;
  return { entityId: entity.id, entityKind: entity.kind, score, direct, signals: [signal], explanation, continuityFromIds: unique3(continuityFromIds) };
}
var KnowledgeGraph = class {
  observation;
  derivedBudget;
  entities;
  entitiesById;
  relations;
  units;
  lenses;
  decisions;
  decisionRun;
  authorities;
  lineages;
  tombstones;
  registry;
  lensCompilation;
  lensCompilationUnknown;
  unitPath = /* @__PURE__ */ new Map();
  unitByPath = /* @__PURE__ */ new Map();
  unitById = /* @__PURE__ */ new Map();
  unitByIdentity = /* @__PURE__ */ new Map();
  fileByArtifact = /* @__PURE__ */ new Map();
  selectorFactsByUnitId = /* @__PURE__ */ new Map();
  selectorSubjects;
  implementationBindingsBySubjectId = /* @__PURE__ */ new Map();
  directBindingsBySubjectId = /* @__PURE__ */ new Map();
  envelopeById = /* @__PURE__ */ new Map();
  obligationBytesByLensId = /* @__PURE__ */ new Map();
  validatorBytes = /* @__PURE__ */ new WeakMap();
  constructor(observation, decisionHost = {}, derivedBudget = new DerivedObservationBudget(observation.analysis.observationDescriptor.limits.maxDerivedBytes), memo, preparedLensCompilation) {
    this.observation = observation;
    this.derivedBudget = derivedBudget;
    this.entities = parseEntities(observation.canonical.documents);
    this.entitiesById = new Map(this.entities.map((entity) => [entity.id, entity]));
    for (const envelope of observation.canonical.documents)
      this.envelopeById.set(envelope.id, envelope);
    this.relations = observation.canonical.documents.filter(({ kind }) => kind === "relation").map(({ payload }) => RelationSchema.parse(payload)).filter(({ active }) => active).sort((left, right) => compare(left.id, right.id));
    this.lenses = this.entities.filter(({ kind }) => kind === "projection-lens").map(({ payload }) => payload);
    for (const lens of this.lenses) {
      this.obligationBytesByLensId.set(lens.id, 1024 + 2 * canonicalJson({ rules: lens.rules, validators: lens.validators, expectedProjections: lens.expectedProjections }).length);
      for (const binding of lens.validators)
        this.validatorBytes.set(binding, 256 + 2 * canonicalJson(binding).length);
    }
    this.decisions = this.entities.filter(({ kind }) => kind === "architecture-decision").map(({ payload }) => payload).filter(({ lifecycle }) => lifecycle === "active");
    this.decisionRun = new KnowledgeDecisionRun(observation, decisionHost);
    this.authorities = observation.canonical.documents.filter(({ kind }) => kind === "authority-record").map(({ payload }) => AuthorityRecordSchema.parse(payload)).sort((left, right) => compare(left.id, right.id));
    this.lineages = observation.canonical.documents.filter(({ kind }) => kind === "lineage").map(({ payload }) => LineageRecordSchema.parse(payload)).sort((left, right) => compare(left.id, right.id));
    this.tombstones = observation.canonical.documents.filter(({ kind }) => kind === "tombstone").map(({ payload }) => TombstoneSchema.parse(payload)).sort((left, right) => compare(left.entityId, right.entityId));
    this.units = [...observation.analysis.projectionUnits].sort((left, right) => compare(left.id, right.id));
    const filesByArtifact = new Map(observation.analysis.files.map((file) => [file.artifactId, file]));
    for (const [id, file] of filesByArtifact)
      this.fileByArtifact.set(id, file);
    for (const unit of this.units) {
      this.unitById.set(unit.id, unit);
      for (const address of [unit.id, unit.key])
        if (!this.unitByIdentity.has(address))
          this.unitByIdentity.set(address, unit);
      for (const subjectId of /* @__PURE__ */ new Set([...unit.conceptIds, ...unit.requirementIds, ...unit.scenarioIds])) {
        const bindings = this.directBindingsBySubjectId.get(subjectId) ?? [];
        bindings.push({ id: unit.id, reason: "typed projection-unit semantic binding" });
        this.directBindingsBySubjectId.set(subjectId, bindings);
      }
      const path = filesByArtifact.get(unit.artifactId)?.path;
      if (path !== void 0) {
        this.unitPath.set(unit.id, path);
        this.unitByPath.set(path, unit);
        const segments = path.split("/");
        const packageRoot = (segments[0] === "packages" || segments[0] === "apps") && segments[1] !== void 0 ? `${segments[0]}/${segments[1]}` : void 0;
        this.selectorFactsByUnitId.set(unit.id, {
          path,
          surface: observation.analysis.surface.kind,
          ...packageRoot === void 0 ? {} : { package: packageRoot, packageKind: segments[0] }
        });
      }
    }
    this.selectorSubjects = this.units.map((unit) => projectionUnitSelectorSubject(unit, this.selectorFactsByUnitId.get(unit.id)));
    let compilation;
    let compilationUnknown;
    if (preparedLensCompilation !== void 0) {
      compilation = preparedLensCompilation.compilation;
      compilationUnknown = preparedLensCompilation.unknown;
    } else
      try {
        compilation = compileProjectionLenses({ lenses: this.lenses, units: this.units, authorityRecords: this.authorities, selectorFactsByUnitId: this.selectorFactsByUnitId, derivedBudget });
      } catch (error) {
        if (error instanceof ObservationError)
          throw error;
        compilationUnknown = error instanceof Error ? error.message : "lens compilation is unavailable";
      }
    this.lensCompilation = compilation;
    this.lensCompilationUnknown = compilationUnknown;
    const graph = new InMemoryGraphReader({
      concepts: this.entities.filter(({ kind }) => kind === "concept").map(({ payload }) => payload),
      requirements: this.entities.filter(({ kind }) => kind === "requirement").map(({ payload }) => payload),
      behavioralScenarios: this.entities.filter(({ kind }) => kind === "scenario").map(({ payload }) => payload),
      projectionUnits: this.units,
      relations: this.relations
    });
    this.registry = new QueryDependencyRegistry(graph, false, memo);
    this.registerPrograms();
  }
  search(request, addressed, maxCandidates) {
    const candidates = [];
    const selectors = addressed.length > 0 ? addressed : [request];
    for (const selector of selectors) {
      const normalized = normalize(selector);
      for (const entity of this.entities) {
        if (normalize(entity.id) === normalized)
          candidates.push(candidateFor(entity, "id", 1, entity.accepted));
        else if (normalize(entity.key) === normalized)
          candidates.push(candidateFor(entity, "key", 1, entity.accepted));
        else if (entity.accepted && entity.aliases.some((alias) => normalize(alias) === normalized))
          candidates.push(candidateFor(entity, "alias", 1, true));
      }
      candidates.push(...this.continuityCandidates(normalized));
    }
    const direct = mergeCandidates(candidates);
    if (direct.length > 0 || addressed.length > 0)
      return direct.slice(0, maxCandidates);
    return mergeCandidates(this.entities.filter(({ kind }) => kind !== "projection-lens").map((entity) => ({ entity, score: scoreLexical(request, entity) })).filter(({ score }) => score > 0).map(({ entity, score }) => candidateFor(entity, "lexical", score, false))).slice(0, maxCandidates);
  }
  continuityCandidates(normalized) {
    const edges = [
      ...this.lineages.flatMap(({ fromIds, toIds }) => fromIds.map((from) => ({ from, toIds, origins: fromIds, signal: "lineage" }))),
      ...this.tombstones.map(({ entityId, replacementIds }) => ({ from: entityId, toIds: replacementIds, origins: [entityId], signal: "tombstone" }))
    ];
    const seen = /* @__PURE__ */ new Map();
    const pending = unique3(edges.filter(({ from }) => normalize(from) === normalized).map(({ from }) => from));
    for (const id of pending)
      seen.set(id, { origins: [], signals: [] });
    for (let index = 0; index < pending.length; index += 1) {
      const id = pending[index];
      const current = seen.get(id);
      for (const edge of edges.filter(({ from }) => from === id))
        for (const targetId of edge.toIds) {
          const prior = seen.get(targetId);
          const origins = unique3([...prior?.origins ?? [], ...current.origins, ...edge.origins]);
          const signals = [.../* @__PURE__ */ new Set([...prior?.signals ?? [], ...current.signals, edge.signal])].sort();
          if (prior === void 0 || origins.length !== prior.origins.length || signals.length !== prior.signals.length) {
            seen.set(targetId, { origins, signals });
            pending.push(targetId);
          }
        }
    }
    return [...seen].flatMap(([id, { origins, signals }]) => {
      const target = this.entitiesById.get(id);
      return target === void 0 ? [] : signals.map((signal) => candidateFor(target, signal, 1, target.accepted, origins.filter((origin) => origin !== id)));
    });
  }
  resolveNamedTargets(namedTargets) {
    const result = [];
    for (const target of unique3(namedTargets)) {
      const normalized = target.replaceAll("\\", "/");
      const unit = this.unitByPath.get(normalized) ?? this.unitByIdentity.get(target);
      if (unit === void 0)
        continue;
      result.push({
        entityId: unit.id,
        entityKind: "projection-unit",
        score: 1,
        direct: true,
        signals: [unit.id === target ? "id" : "key"],
        explanation: `Explicit repository target ${target} resolved to observed projection unit ${unit.id}.`,
        continuityFromIds: []
      });
    }
    return mergeCandidates(result);
  }
  async bindIdentity(request, addressed, namedTargets, context) {
    const query = this.registry.createSpec({ id: `knowledge-identity:${hashFramedDomain("knowledge-identity-input", { request, addressed, namedTargets }).slice(-24)}`, programId: KNOWLEDGE_QUERY_PROGRAMS.identity, input: { request, addressed, namedTargets } });
    const evaluated = await this.registry.evaluateObserved(query, context);
    const value = evaluated.observed.results.map(({ id: _id, ...candidate }) => candidate);
    return { value, dependency: { query, priorResult: evaluated.fingerprint, role: "semantic identity candidates, accepted addresses, lineage, and tombstone continuity" } };
  }
  discovery(context, collect) {
    return { discover: async (subjectId, depth) => this.discover(subjectId, depth, context, collect) };
  }
  async load(entityId) {
    return this.loadSource(entityId);
  }
  loadSource(entityId) {
    const entity = this.entitiesById.get(entityId);
    if (entity !== void 0) {
      const kind = entity.kind === "architecture-decision" ? "decision" : entity.kind === "projection-lens" || entity.kind === "architecture-concern" || entity.kind === "developer-preference" ? "other" : entity.kind;
      const authority = this.authorityFor(entity);
      const authorityEnvelope = authority === void 0 ? void 0 : this.envelopeById.get(authority.id);
      const full = canonicalJson(authorityEnvelope === void 0 ? entity.payload : { record: entity.payload, authority: authorityEnvelope });
      return {
        entityId,
        kind,
        semanticHash: authority === void 0 ? entity.semanticHash : hashFramedDomain("knowledge-context-source", { entity: entity.semanticHash, authority: authority.semanticHash }),
        full,
        summary: authority === void 0 ? this.summary(entity) : `${this.summary(entity)} Authority rationale: ${authority.rationale}`
      };
    }
    const unit = this.unitById.get(entityId);
    if (unit === void 0)
      return void 0;
    return { entityId, kind: "projection-unit", semanticHash: unit.semanticSignature.hash, full: canonicalJson(unit), summary: `${unit.role} ${this.unitPath.get(unit.id) ?? unit.key}` };
  }
  valueDependency(entityId) {
    const entity = this.entitiesById.get(entityId);
    if (entity !== void 0)
      return { kind: entity.kind === "projection-lens" ? "canonical-governance" : "canonical-entity", id: entity.id, versionHash: entity.semanticHash, role: "knowledge semantic meaning" };
    const unit = this.unitById.get(entityId);
    return unit === void 0 ? void 0 : { kind: "projection-unit", id: unit.id, versionHash: unit.semanticSignature.hash, role: "knowledge observed semantic unit" };
  }
  valueDependencies(entityIds) {
    const dependencies = entityIds.map((id) => this.valueDependency(id)).filter((item) => item !== void 0);
    for (const id of unique3(entityIds)) {
      const sourceHash = this.sourceHash(id);
      if (sourceHash !== void 0)
        dependencies.push({ kind: "artifact", id: `knowledge-source:${id}`, versionHash: sourceHash, role: `exact source for knowledge ${id}` });
    }
    for (const entity of unique3(entityIds).map((id) => this.entitiesById.get(id)).filter((entity2) => entity2 !== void 0 && (entity2.kind === "projection-lens" || entity2.kind === "architecture-decision"))) {
      const authority = this.referencedAuthority(entity);
      if (authority !== void 0) {
        dependencies.push({ kind: "canonical-governance", id: authority.id, versionHash: authority.semanticHash, role: `authority for knowledge ${entity.kind} ${entity.id}` });
        const authoritySource = this.sourceHash(authority.id);
        if (authoritySource !== void 0)
          dependencies.push({ kind: "artifact", id: `knowledge-source:${authority.id}`, versionHash: authoritySource, role: `exact authority source for knowledge ${entity.kind} ${entity.id}` });
      }
    }
    return dependencies;
  }
  authorityUnknowns(entityIds) {
    return unique3(entityIds).map((id) => this.entitiesById.get(id)).filter((entity) => entity !== void 0 && (entity.kind === "projection-lens" || entity.kind === "architecture-decision")).filter((entity) => this.authorityFor(entity) === void 0).map((entity) => `referenced authority for ${entity.kind} ${entity.id} is unavailable or does not govern its declared subject`).sort(compare);
  }
  topologyUnknowns(entityIds) {
    if (!entityIds.some((id) => this.supportsStaticTopology(id)))
      return [];
    return this.uncertainTopologyImporters().map(({ path, uncertainty }) => `runtime dependency target remains unknown in ${path}: ${uncertainty.join("; ")}`);
  }
  realizationUnknowns(entityIds) {
    const ids = new Set(entityIds);
    return this.observation.realizations.filter(({ entityId, status }) => ids.has(entityId) && status !== "matched").map(({ entityId, bindingIndex, reason }) => `realization ${entityId}[${bindingIndex}]: ${reason}`).sort(compare);
  }
  sourceHash(entityId) {
    const entity = this.entitiesById.get(entityId);
    if (entity !== void 0)
      return entity.envelope.canonicalDocumentHash;
    const canonical = this.envelopeById.get(entityId);
    if (canonical !== void 0)
      return canonical.canonicalDocumentHash;
    const unit = this.unitById.get(entityId);
    if (unit === void 0)
      return void 0;
    return this.fileByArtifact.get(unit.artifactId)?.contentHash ?? unit.structuralSignature.hash;
  }
  semanticHash(entityId) {
    return this.entitiesById.get(entityId)?.semanticHash ?? this.unitById.get(entityId)?.semanticSignature.hash;
  }
  lensObligations(entityIds, operation) {
    if (this.lensCompilation === void 0)
      return [];
    const activeLenses = this.lenses.filter(({ status, id }) => status === "active" && entityIds.has(id));
    const units = this.units.filter(({ id }) => entityIds.has(id));
    const result = [];
    for (const lens of activeLenses) {
      const members = new Set(this.lensCompilation.memberships[lens.id] ?? []);
      for (const unit of units) {
        if (!members.has(unit.id))
          continue;
        this.derivedBudget.reserve(this.obligationBytesByLensId.get(lens.id) + 2 * unit.id.length, "lens-obligation", lens.id);
        result.push(compileKnowledgeLensObligation(lens, unit, this.lensCompilation.membershipFingerprints[lens.id], this.selectorFactsByUnitId.get(unit.id) ?? {}, operation));
      }
    }
    return result.sort((left, right) => compare(`${left.lensId}\0${left.unitId}`, `${right.lensId}\0${right.unitId}`));
  }
  validatorRequests(entityIds, operation) {
    const requests = [];
    const beforeObligations = this.derivedBudget.usedBytes;
    const obligations = this.lensObligations(entityIds, operation);
    const obligationBytes = this.derivedBudget.usedBytes - beforeObligations;
    try {
      for (const obligation of obligations) {
        const lens = this.lenses.find(({ id }) => id === obligation.lensId);
        for (const binding of lens.validators) {
          if (binding.provider === "deterministic-governance" && binding.id === "projector.builtin.static-dependency-boundary" && binding.version === "1")
            continue;
          if (binding.required || obligation.validatorIds.includes(`${binding.id}@${binding.version}`)) {
            const unitPath = this.unitPath.get(obligation.unitId) ?? "";
            this.derivedBudget.reserve(this.validatorBytes.get(binding) + 2 * (obligation.unitId.length + unitPath.length), "validator-request", obligation.lensId);
            requests.push({ binding, unitId: obligation.unitId, unitPath });
          }
        }
      }
      return requests;
    } finally {
      this.derivedBudget.release(obligationBytes);
    }
  }
  relevantDecisions(entityIds) {
    const selected = new Set(entityIds);
    for (const lens of this.lenses.filter(({ id }) => entityIds.has(id))) {
      for (const basis of [...lens.governanceBasis, ...lens.rules.flatMap(({ governanceBasis }) => governanceBasis)])
        if (basis.kind === "architecture-decision")
          selected.add(basis.decisionId);
    }
    return this.decisions.filter(({ id }) => selected.has(id));
  }
  bindDecisionApplicability(decisionId, context) {
    return this.dependency(KNOWLEDGE_QUERY_PROGRAMS.decisionApplicability, `knowledge-decision-applicability:${decisionId}`, { decisionId }, "decision-applicability", context);
  }
  bindDecisionTriggers(decisionId, operation, context) {
    return this.dependency(KNOWLEDGE_QUERY_PROGRAMS.decisionTriggers, `knowledge-decision-triggers:${decisionId}`, { decisionId, operation }, "decision-trigger-observations", context);
  }
  governanceEvaluations(entityIds, operation, validatorFindings = []) {
    return this.governanceEvaluationsWithProvenance(entityIds, operation, validatorFindings).map(({ evaluation }) => evaluation);
  }
  governanceEvaluationsWithProvenance(entityIds, operation, validatorFindings = []) {
    if (this.lensCompilation === void 0)
      return [];
    const observation = this.governanceObservation();
    const evaluate = prepareGovernanceEvaluator(observation, validatorFindings);
    const beforeObligations = this.derivedBudget.usedBytes;
    const obligations = this.lensObligations(entityIds, operation);
    const obligationBytes = this.derivedBudget.usedBytes - beforeObligations;
    try {
      const obligationsByLensAndUnit = new Map(obligations.map((item) => [`${item.lensId}\0${item.unitId}`, item]));
      const evaluations = [];
      for (const lens of this.lenses.filter(({ status, id }) => status === "active" && entityIds.has(id))) {
        const members = new Set(this.lensCompilation.memberships[lens.id] ?? []);
        for (const unit of this.units) {
          if (!entityIds.has(unit.id) || !members.has(unit.id))
            continue;
          this.derivedBudget.reserve(this.obligationBytesByLensId.get(lens.id), "governance-evaluation", lens.id);
          const selectorFacts = { ...this.selectorFactsByUnitId.get(unit.id) ?? {}, operation };
          const bundle = compileEffectiveRuleBundle({ unit, operation, rules: lens.rules, selectorFacts });
          const requiredValidatorIds = lens.validators.filter(({ required }) => required).map(({ id, version }) => `${id}@${version}`);
          const expected = obligationsByLensAndUnit.get(`${lens.id}\0${unit.id}`);
          const expectationIds = expected?.validatorIds ?? [];
          evaluations.push({ lensId: lens.id, evaluation: evaluate(bundle, { requiredValidatorIds: unique3([...requiredValidatorIds, ...expectationIds]) }) });
        }
      }
      return evaluations.sort((left, right) => compare(left.evaluation.unitId, right.evaluation.unitId) || compare(left.evaluation.contentHash, right.evaluation.contentHash));
    } finally {
      this.derivedBudget.release(obligationBytes);
    }
  }
  governanceObservation() {
    const subjects = this.units.map((unit) => projectionUnitSelectorSubject(unit, this.selectorFactsByUnitId.get(unit.id)));
    const externalSubjects = /* @__PURE__ */ new Map();
    const dependencies = [];
    for (const dependency of this.observation.analysis.dependencies) {
      const from = this.unitByPath.get(dependency.importerPath);
      if (from === void 0)
        continue;
      const local = dependency.resolvedPath === void 0 ? void 0 : this.unitByPath.get(dependency.resolvedPath);
      let toSubjectId = local?.id;
      if (toSubjectId === void 0 && !dependency.specifier.startsWith(".") && !dependency.specifier.startsWith("#") && !dependency.specifier.startsWith("/")) {
        const packageName = externalPackageName(dependency.specifier);
        toSubjectId = `external-package:${packageName}`;
        externalSubjects.set(toSubjectId, {
          id: toSubjectId,
          // External packages are known not to have a repository-relative path.
          // An empty value set lets mixed path/package selectors decide that
          // branch as false instead of treating the path fact as unavailable.
          values: { path: [], package: packageName, "package-kind": "external" },
          dependencyKeys: [`external-package:${packageName}`]
        });
      }
      dependencies.push({
        fromUnitId: from.id,
        ...toSubjectId === void 0 ? {} : { toSubjectId },
        specifier: dependency.specifier,
        evidenceIds: [`dependency_evidence_${hashFramedDomain("knowledge-dependency-evidence", dependency).slice(-32)}`]
      });
    }
    const javascriptCapability = this.observation.analysis.capabilities.find(({ analyzerId }) => analyzerId === "projector.javascript-local");
    const filesByPath = new Map(this.observation.analysis.javaScript.files.map((file) => [file.path, file]));
    const dependencyEnumerations = this.units.map((unit) => {
      const path = this.unitPath.get(unit.id);
      const file = path === void 0 ? void 0 : filesByPath.get(path);
      const failures = path === void 0 ? [] : this.observation.analysis.javaScript.failures.filter(({ scope, affectedClaimKinds }) => scope === path && affectedClaimKinds.includes("dependency"));
      const unknowns = unique3([...(file?.unknowns ?? []).filter((item) => /import|module|dependency/iu.test(item)), ...failures.map(({ message }) => message)]);
      const base = javascriptCapability?.enumeration;
      const contract = file === void 0 || base === void 0 ? { observability: "unavailable", method: "no supported static dependency analyzer for unit", assumptions: [], blindSpots: ["dependency observations unavailable"], dynamicMechanisms: [] } : { ...base, dynamicMechanisms: unknowns.some((item) => /dynamic|runtime/iu.test(item)) ? base.dynamicMechanisms : [] };
      return { unitId: unit.id, contract, unknowns };
    });
    return {
      subjects: [...subjects, ...externalSubjects.values()].sort((left, right) => compare(left.id, right.id)),
      unitIds: this.units.map(({ id }) => id),
      dependencies,
      unitEnumeration: this.observation.analysis.surface.enumeration,
      dependencyEnumerations
    };
  }
  currentVersionHash(dependency) {
    if (dependency.kind === "artifact" && dependency.id.startsWith("knowledge-source:"))
      return this.sourceHash(dependency.id.slice("knowledge-source:".length));
    const entity = this.entitiesById.get(dependency.id);
    if (entity !== void 0)
      return entity.semanticHash;
    const unit = this.unitById.get(dependency.id);
    if (unit !== void 0)
      return unit.semanticSignature.hash;
    return this.authorities.find(({ id }) => id === dependency.id)?.semanticHash;
  }
  registerPrograms() {
    this.registry.register({ id: SEMANTIC_TOPOLOGY_PROGRAM, version: "1", kind: "package-dependency", normalizeInput: (input) => ({ unitId: String(input.unitId ?? "") }), evaluate: async ({ input }) => {
      const unitId = String(input.unitId);
      const path = this.unitById.get(unitId)?.key ?? unitId;
      const unavailable = { results: [], observability: "unavailable", assumptions: [], unavailableLanes: ["semantic-code-index:not-current"], dependencyKeys: [`code:neighborhood:${path}`] };
      const checkout = await checkoutCacheLocation(this.observation.repositoryRoot);
      const store = await SqliteCodeStore.open(this.observation.repositoryRoot);
      try {
        return store.withReadSnapshot(() => {
          const head = store.head();
          const manifest = head === null ? void 0 : store.manifest(head);
          if (head === null || manifest?.binding.checkoutId !== checkout.checkoutId || manifest.binding.worktreeDigest !== this.observation.state.worktreeDigest || manifest.binding.status !== "verified" || !verifyCodeInputBinding(manifest.binding, this.observation.repositoryRoot))
            return unavailable;
          return projectSemanticNeighborhood(path, store.neighborhood(head, path, 5e3), (relatedPath) => this.units.filter((unit) => unit.key === relatedPath).map((unit) => unit.id));
        });
      } finally {
        store.close();
      }
    } });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.decisionApplicability, version: "1", kind: "decision-applicability", normalizeInput: (input) => ({ decisionId: String(input.decisionId) }), evaluate: ({ input }) => this.decisionApplicabilityResult(String(input.decisionId)) });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.decisionMembership, version: "1", kind: "selector-membership", normalizeInput: (input) => ({ unitId: String(input.unitId) }), evaluate: ({ input }) => ({ results: this.decisions.filter((decision) => this.implementationBindings(decision.id).some(({ id }) => id === input.unitId)).map(({ id, semanticHash }) => ({ id, semanticHash })), observability: this.observation.analysis.surface.enumeration.observability, assumptions: [], unavailableLanes: this.failureLanes(["projector.filesystem-local"]), dependencyKeys: ["canonical-decisions", "projection-unit-membership"] }) });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.decisionTriggers, version: "1", kind: "custom", normalizeInput: (input) => ({ decisionId: String(input.decisionId), operation: String(input.operation) }), evaluate: async ({ input }) => {
      const decision = this.decisions.find(({ id }) => id === input.decisionId);
      if (decision === void 0)
        return { results: [], observability: "unavailable", assumptions: [], unavailableLanes: ["decision missing"], dependencyKeys: ["canonical-decisions"] };
      const observed = await this.decisionRun.observe(decision, String(input.operation));
      return { results: [{ id: decision.id, baseline: observed.baseline, checks: observed.checks, observations: observed.observations }], observability: "closed", assumptions: observed.checks.filter(({ status }) => status === "unobserved").map(({ reason }) => reason), unavailableLanes: [...observed.unknowns], dependencyKeys: ["canonical-decisions", "canonical-authorities", "decision-trigger-observations"] };
    } });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.identity, version: "1", kind: "semantic-identity-search", normalizeInput: (input) => ({ request: String(input.request ?? "").normalize("NFKC").trim(), addressed: unique3(Array.isArray(input.addressed) ? input.addressed.map(String).map((item) => item.normalize("NFKC").trim()).filter(Boolean) : []), namedTargets: unique3(Array.isArray(input.namedTargets) ? input.namedTargets.map(String).map((item) => item.replaceAll("\\", "/").normalize("NFKC").trim()).filter(Boolean) : []) }), evaluate: ({ input }) => ({ results: mergeCandidates([...this.search(input.request, input.addressed, Number.MAX_SAFE_INTEGER), ...this.resolveNamedTargets(input.namedTargets)]).map((item) => ({ id: item.entityId, ...item })), observability: "closed", assumptions: [], unavailableLanes: [], dependencyKeys: ["canonical-identity-discovery", "canonical-lineage", "canonical-tombstones", "projection-unit-membership", ...input.namedTargets.map((target) => `path:${target}`)] }) });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.relations, version: "1", kind: "relation-neighborhood", normalizeInput: (input) => ({ subjectId: String(input.subjectId ?? "") }), evaluate: ({ input }) => ({ results: this.relations.filter(({ fromId, toId }) => fromId === input.subjectId || toId === input.subjectId).map(({ id, fromId, toId, type, semanticHash }) => ({ id, fromId, toId, type, semanticHash })), observability: "closed", assumptions: [], unavailableLanes: [], dependencyKeys: ["canonical-relations", `entity:${String(input.subjectId)}`] }) });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.implementation, version: "2", kind: "implementation-binding", normalizeInput: (input) => ({ subjectId: String(input.subjectId ?? "") }), evaluate: ({ input }) => {
      const subjectId = String(input.subjectId);
      const unavailable = this.observation.realizations.filter(({ entityId, status }) => entityId === subjectId && (status === "unsupported" || status === "unavailable"));
      return {
        results: this.implementationBindings(subjectId),
        observability: unavailable.length === 0 ? this.observation.analysis.surface.enumeration.observability : "unavailable",
        assumptions: this.observation.analysis.surface.enumeration.assumptions,
        unavailableLanes: [...this.failureLanes(["projector.filesystem-local"]), ...unavailable.map(({ bindingIndex, reason }) => `canonical-realization:${subjectId}:${bindingIndex}:${reason}`)],
        dependencyKeys: ["canonical-realizations", "canonical-scopes", "projection-unit-membership", `entity:${subjectId}`]
      };
    } });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.topology, version: "3", kind: "package-dependency", normalizeInput: (input) => ({ unitId: String(input.unitId ?? "") }), evaluate: ({ input }) => {
      const unitId = String(input.unitId);
      const boundary = this.topologyObservationBoundary(unitId);
      return { results: [...this.topologyNeighbors(unitId), ...this.uncertainTopologyImporters()], ...boundary, dependencyKeys: ["repository-module-dependencies", "repository-test-targets", `projection-unit:${unitId}`] };
    } });
    this.registry.register({ id: KNOWLEDGE_QUERY_PROGRAMS.lensMembership, version: "2", kind: "selector-membership", normalizeInput: (input) => ({ unitId: String(input.unitId ?? "") }), evaluate: ({ input }) => this.lensMembershipResult(String(input.unitId)) });
  }
  async dependency(programId, id, input, role, context) {
    const query = this.registry.createSpec({ id, programId, input });
    return { query, priorResult: await this.registry.evaluate(query, context), role };
  }
  async discover(subjectId, depth, context, collect) {
    const relationDependency = await this.dependency(KNOWLEDGE_QUERY_PROGRAMS.relations, `knowledge-relations:${subjectId}`, { subjectId }, `typed relation neighborhood for ${subjectId}`, context);
    const dependencies = [relationDependency];
    const edges = this.relationEdges(subjectId, depth);
    const implementationDependency = await this.dependency(KNOWLEDGE_QUERY_PROGRAMS.implementation, `knowledge-implementation:${subjectId}`, { subjectId }, `implementation and selector bindings for ${subjectId}`, context);
    dependencies.push(implementationDependency);
    edges.push(...this.implementationBindings(subjectId).map(({ id, reason }) => this.edge(subjectId, id, "consequence", 0.82, "implementation-binding", reason, "derived")));
    if (this.unitById.has(subjectId)) {
      const query = this.registry.createSpec({ id: `knowledge-code:${subjectId}`, programId: SEMANTIC_TOPOLOGY_PROGRAM, input: { unitId: subjectId } });
      const semantic = await this.registry.evaluateObserved(query, context);
      if (semantic.observed.observability !== "unavailable") {
        dependencies.push({ query, priorResult: semantic.fingerprint, role: `source-bound semantic relationships for ${subjectId}` });
        for (const result of semantic.observed.results) {
          const related = this.edge(subjectId, String(result.id), "consequence", 0.85, "package-dependency", `Compiler or structural code relationships connect the owning source units: ${String(result.path)}`, "derived");
          edges.push({ ...related, reason: { ...related.reason, evidenceIds: Array.isArray(result.evidenceIds) ? result.evidenceIds.map(String) : [] } });
        }
      }
      const decisionDependency = await this.dependency(KNOWLEDGE_QUERY_PROGRAMS.decisionMembership, `knowledge-decisions:${subjectId}`, { unitId: subjectId }, `active decision applicability for ${subjectId}`, context);
      dependencies.push(decisionDependency);
      for (const decision of this.decisions.filter((item) => this.implementationBindings(item.id).some(({ id }) => id === subjectId)))
        edges.push(this.edge(subjectId, decision.id, "governing", 0.93, "selector-applicability", `active decision ${decision.id} applies to ${subjectId}`, "derived", true));
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
      if (this.lensCompilation !== void 0) {
        for (const lens of this.lenses.filter(({ status, id }) => status === "active" && (this.lensCompilation.memberships[id] ?? []).includes(subjectId))) {
          edges.push(this.edge(subjectId, lens.id, "governing", 0.94, "selector-applicability", `active lens ${lens.id} applies to ${subjectId}`, "derived", true));
        }
      }
    }
    collect.push(...dependencies);
    return { edges, dependency: relationDependency };
  }
  relationEdges(subjectId, depth) {
    return this.relations.filter(({ fromId, toId }) => fromId === subjectId || toId === subjectId).map((relation) => {
      const outgoing = relation.fromId === subjectId;
      const targetId = outgoing ? relation.toId : relation.fromId;
      const governing = outgoing ? ["requires", "depends-on", "governed-by", "has-requirement", "constrains"].includes(relation.type) : ["constrains", "applies-to", "governed-by", "has-requirement"].includes(relation.type);
      const band = governing ? "governing" : depth > 0 ? "possible" : "consequence";
      const reasonKind = relation.type === "constrains" ? "constrains" : relation.type === "depends-on" || relation.type === "requires" ? "depends-on" : relation.type === "governed-by" ? "governs" : relation.type === "verifies" || relation.type === "demonstrated-by" ? "verification-binding" : "implementation-binding";
      return this.edge(subjectId, targetId, band, Math.max(0.55, relation.confidence), reasonKind, `${relation.type} relation ${relation.id} connects ${subjectId} to ${targetId}`, relation.sourceClass === "inferred" ? "inferred" : relation.sourceClass === "observed" ? "observed" : "declared", governing);
    });
  }
  implementationBindings(subjectId) {
    let bindings = this.implementationBindingsBySubjectId.get(subjectId);
    if (bindings === void 0) {
      bindings = Object.freeze(this.computeImplementationBindings(subjectId).map((binding) => Object.freeze(binding)));
      this.implementationBindingsBySubjectId.set(subjectId, bindings);
    }
    return bindings.map((binding) => ({ ...binding }));
  }
  computeImplementationBindings(subjectId) {
    const direct = (this.directBindingsBySubjectId.get(subjectId) ?? []).map((binding) => ({ ...binding }));
    const entity = this.entitiesById.get(subjectId);
    if (entity?.kind === "concept" || entity?.kind === "requirement" || entity?.kind === "scenario")
      return direct;
    if (entity?.kind === "developer-preference")
      return direct;
    if (entity?.kind === "projection-lens")
      return (this.lensCompilation?.memberships[subjectId] ?? []).map((id) => ({ id, reason: "active lens selector matched observed unit", membershipFingerprint: this.lensCompilation.membershipFingerprints[subjectId] }));
    if (entity === void 0 || !("scope" in entity.payload) || typeof entity.payload.scope === "string")
      return direct;
    const membership = evaluateSelectorMembership(entity.payload.scope, this.selectorSubjects, { observability: this.observation.analysis.surface.enumeration.observability, assumptions: this.observation.analysis.surface.enumeration.assumptions, unavailableLanes: this.failureLanes(["projector.filesystem-local"]) });
    return [...direct, ...membership.memberIds.map((id) => ({ id, reason: `canonical ${entity.kind} scope selector matched observed unit`, selectorHash: membership.selectorHash }))].sort((left, right) => compare(String(left.id), String(right.id)));
  }
  decisionApplicabilityResult(decisionId) {
    const decision = this.decisions.find(({ id }) => id === decisionId);
    const fields = (selector) => selector.op === "atom" ? [selector.field] : selector.op === "not" ? fields(selector.item) : selector.items.flatMap(fields);
    const supported = decision !== void 0 && fields(decision.scope).every((field) => ["path", "surface", "package", "package-kind"].includes(field));
    const failures = this.failureLanes(["projector.filesystem-local"]);
    const available = this.observation.analysis.surface.access !== "unavailable";
    return {
      results: this.implementationBindings(decisionId),
      observability: supported && available && failures.length === 0 ? "closed" : "unavailable",
      assumptions: [...this.observation.analysis.surface.enumeration.assumptions, "Applicability is closed over the repository inventory's declared file boundary, not runtime-created or external units."],
      unavailableLanes: [...failures, ...!supported ? ["decision selector requires facts outside the supported repository applicability observer"] : [], ...!available ? ["repository inventory unavailable"] : []],
      dependencyKeys: ["canonical-decisions", "projection-unit-membership"]
    };
  }
  topologyNeighbors(unitId) {
    const path = this.unitPath.get(unitId);
    if (path === void 0)
      return [];
    const results = /* @__PURE__ */ new Map();
    const add = (id, reason, direction) => {
      const aggregate = results.get(id) ?? { reasons: /* @__PURE__ */ new Set(), directions: /* @__PURE__ */ new Set() };
      aggregate.reasons.add(reason);
      if (direction !== void 0)
        aggregate.directions.add(direction);
      results.set(id, aggregate);
    };
    for (const dependency of this.observation.analysis.dependencies) {
      if (dependency.importerPath === path && dependency.resolvedPath !== void 0) {
        const target = this.unitByPath.get(dependency.resolvedPath);
        if (target !== void 0)
          add(target.id, "static-import", "out");
      } else if (dependency.resolvedPath === path) {
        const target = this.unitByPath.get(dependency.importerPath);
        if (target !== void 0)
          add(target.id, "static-import", "in");
      }
    }
    for (const target of this.observation.analysis.testTargets) {
      if (target.targetPath === path) {
        const unit = this.unitByPath.get(target.testPath);
        if (unit !== void 0)
          add(unit.id, "test-target");
      } else if (target.testPath === path) {
        const unit = this.unitByPath.get(target.targetPath);
        if (unit !== void 0)
          add(unit.id, "test-target");
      }
    }
    return [...results.entries()].map(([id, aggregate]) => ({ id, reasons: [...aggregate.reasons].sort(compare), directions: [...aggregate.directions].sort(compare) })).sort((left, right) => compare(left.id, right.id));
  }
  topologyObservationBoundary(unitId) {
    const path = this.unitPath.get(unitId);
    const capability = this.observation.analysis.capabilities.find(({ analyzerId }) => analyzerId === "projector.javascript-local");
    const file = path === void 0 ? void 0 : this.observation.analysis.javaScript.files.find((candidate) => candidate.path === path);
    if (path === void 0 || capability === void 0 || file === void 0) {
      return {
        observability: "unavailable",
        assumptions: [],
        unavailableLanes: [`projector.javascript-local:static-dependency-topology:${path ?? unitId}`]
      };
    }
    const failures = this.observation.analysis.javaScript.failures.filter(({ scope, affectedClaimKinds }) => scope === path && (affectedClaimKinds.includes("dependency") || affectedClaimKinds.includes("test-target"))).map(({ analyzerId, capability: failedCapability, scope }) => `${analyzerId}:${failedCapability}:${scope}`);
    return {
      observability: capability.enumeration.observability,
      assumptions: unique3([
        ...capability.enumeration.assumptions,
        `topology is bounded to observed static import, export, and test-target syntax for ${path}`,
        "incoming runtime dependency targets are not inferred; uncertain importer identities and source hashes are bound separately"
      ]),
      // Dynamic/runtime targets are explicit uncertainty records in the query
      // result. They remain unknown, but do not make the supported static
      // syntax lane itself unavailable.
      unavailableLanes: unique3(failures)
    };
  }
  supportsStaticTopology(unitId) {
    const path = this.unitPath.get(unitId);
    return path !== void 0 && this.observation.analysis.javaScript.files.some((file) => file.path === path);
  }
  uncertainTopologyImporters() {
    const uncertaintyByPath = /* @__PURE__ */ new Map();
    for (const file of this.observation.analysis.javaScript.files) {
      const unknowns = file.unknowns.filter((item) => /import|module|dependency/iu.test(item));
      if (unknowns.length > 0)
        uncertaintyByPath.set(file.path, unknowns);
    }
    for (const failure of this.observation.analysis.javaScript.failures.filter(({ affectedClaimKinds }) => affectedClaimKinds.includes("dependency") || affectedClaimKinds.includes("test-target"))) {
      uncertaintyByPath.set(failure.scope, unique3([...uncertaintyByPath.get(failure.scope) ?? [], failure.message]));
    }
    return [...uncertaintyByPath.entries()].flatMap(([path, uncertainty]) => {
      const source = this.observation.analysis.files.find((file) => file.path === path);
      if (source === void 0)
        return [];
      return [{ id: `uncertain-topology-importer:${source.artifactId}`, path, sourceHash: source.contentHash, uncertainty: unique3(uncertainty) }];
    }).sort((left, right) => compare(left.id, right.id));
  }
  lensMembershipResult(unitId) {
    if (this.lensCompilation === void 0)
      return { results: [], observability: "unavailable", assumptions: [], unavailableLanes: [this.lensCompilationUnknown ?? "lens compilation unavailable"], dependencyKeys: ["canonical-lenses", "canonical-authorities", `projection-unit:${unitId}`] };
    const results = this.lenses.filter(({ status, id }) => status === "active" && (this.lensCompilation.memberships[id] ?? []).includes(unitId)).map(({ id, version, semanticHash, authorityRecordId }) => ({ id, version, semanticHash, authorityRecordId, membershipFingerprint: this.lensCompilation.membershipFingerprints[id] }));
    return { results, observability: "bounded", assumptions: this.observation.analysis.surface.enumeration.assumptions, unavailableLanes: [], dependencyKeys: ["canonical-lenses", "canonical-authorities", "projection-unit-membership", `projection-unit:${unitId}`] };
  }
  failureLanes(analyzerIds) {
    const selected = new Set(analyzerIds);
    return this.observation.analysis.failures.filter(({ analyzerId }) => selected.has(analyzerId)).map(({ analyzerId, capability, scope }) => `${analyzerId}:${capability}:${scope}`).sort(compare);
  }
  authorityFor(entity) {
    if (entity.kind === "projection-lens") {
      const lens = entity.payload;
      const assessment = assessLensAuthority(lens, this.authorities);
      return assessment.eligible ? assessment.record : void 0;
    }
    if (entity.kind === "architecture-decision") {
      const decision = entity.payload;
      const record = this.authorities.find(({ id }) => id === decision.authorityRecordId);
      if (record === void 0 || record.subjectId !== decision.concernId || record.status !== "approved" && record.status !== "auto-approved" || record.conclusion === "unknown" || record.conclusion === "exception" || record.decidedBy === "system" && record.status !== "auto-approved")
        return void 0;
      return record;
    }
    return void 0;
  }
  referencedAuthority(entity) {
    if (entity.kind === "projection-lens")
      return this.authorities.find(({ id }) => id === entity.payload.authorityRecordId);
    if (entity.kind === "architecture-decision")
      return this.authorities.find(({ id }) => id === entity.payload.authorityRecordId);
    return void 0;
  }
  edge(fromId, entityId, band, score, kind, explanation, provenance, requiredForPlanning = false) {
    return { entityId, band, score, requiredForPlanning, cost: 1, reason: { kind, fromId, weight: score, provenance, confidence: score, explanation, evidenceIds: [] } };
  }
  summary(entity) {
    const payload = entity.payload;
    if (entity.kind === "concept")
      return `${payload.name}: ${payload.statement}`;
    if (entity.kind === "requirement")
      return `${payload.title}: ${payload.statement}`;
    if (entity.kind === "scenario")
      return `${payload.title}: ${payload.steps.map(({ role, statement }) => `${role}: ${statement}`).join("; ")}`;
    if (entity.kind === "architecture-decision")
      return `${payload.title}: ${payload.decision}`;
    if (entity.kind === "architecture-concern")
      return `${payload.title}: ${payload.question}`;
    if (entity.kind === "developer-preference")
      return `${payload.key}: ${payload.statement}`;
    return `${payload.key}: ${payload.purpose}`;
  }
};
function externalPackageName(specifier) {
  if (specifier.startsWith("@"))
    return specifier.split("/").slice(0, 2).join("/");
  return specifier.startsWith("node:") ? specifier : specifier.split("/")[0];
}

export {
  KnowledgeDecisionRun,
  assessKnowledgeDecisions,
  knowledgeGovernanceStatus,
  compileKnowledgeLensObligation,
  tokens,
  KNOWLEDGE_QUERY_PROGRAMS,
  parseEntities,
  scoreLexical,
  mergeCandidates,
  candidateFor,
  KnowledgeGraph
};
