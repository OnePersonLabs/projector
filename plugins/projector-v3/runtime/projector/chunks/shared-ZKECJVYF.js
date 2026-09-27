import { createRequire as __projectorCreateRequire } from "node:module"; const require = __projectorCreateRequire(import.meta.url);
import {
  DecisionDeferralSchema,
  DecisionEvaluationSchema,
  DecisionOptionSchema,
  DecisionValidityAssessmentSchema,
  DeveloperPreferenceSchema,
  canonicalJson,
  hashFramedDomain,
  hashSemantic,
  matchesCanonicalGlob,
  validateCanonicalGlob
} from "./shared-6VIFAIKJ.js";

// node_modules/@projector/engine/dist/query/index.js
var compareStrings = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var sortedUniqueStrings = (values) => [...new Set(values)].sort(compareStrings);
function indexed(kind, values) {
  const result = /* @__PURE__ */ new Map();
  for (const value of values) {
    if (result.has(value.id))
      throw new Error(`duplicate ${kind} stable ID ${value.id}`);
    result.set(value.id, structuredClone(value));
  }
  return result;
}
function indexedLists(kind, values, keyOf, listOf) {
  const result = /* @__PURE__ */ new Map();
  for (const value of values) {
    const key = keyOf(value);
    if (result.has(key))
      throw new Error(`duplicate ${kind} key ${key}`);
    result.set(key, sortedUniqueStrings(listOf(value)));
  }
  return result;
}
var InMemoryGraphReader = class {
  concepts = /* @__PURE__ */ new Map();
  requirements = /* @__PURE__ */ new Map();
  scenarios = /* @__PURE__ */ new Map();
  units = /* @__PURE__ */ new Map();
  relations = /* @__PURE__ */ new Map();
  inputs = /* @__PURE__ */ new Map();
  reverse = /* @__PURE__ */ new Map();
  selectorMembers = /* @__PURE__ */ new Map();
  constructor(snapshot = {}) {
    this.replace(snapshot);
  }
  replace(snapshot) {
    const concepts = indexed("concept", snapshot.concepts ?? []);
    const requirements = indexed("requirement", snapshot.requirements ?? []);
    const scenarios = indexed("behavioral scenario", snapshot.behavioralScenarios ?? []);
    const units = indexed("projection unit", snapshot.projectionUnits ?? []);
    const relations = indexed("relation", snapshot.relations ?? []);
    const entityIds = /* @__PURE__ */ new Set();
    for (const collection of [concepts, requirements, scenarios, units]) {
      for (const id of collection.keys()) {
        if (entityIds.has(id))
          throw new Error(`duplicate graph stable ID ${id}`);
        entityIds.add(id);
      }
    }
    const inputs = /* @__PURE__ */ new Map();
    for (const entry of snapshot.derivationInputs ?? []) {
      if (inputs.has(entry.unitId))
        throw new Error(`duplicate derivation input key ${entry.unitId}`);
      inputs.set(entry.unitId, [...entry.inputs].map((input) => structuredClone(input)).sort((left, right) => compareStrings(canonicalJson(left), canonicalJson(right))));
    }
    this.concepts = concepts;
    this.requirements = requirements;
    this.scenarios = scenarios;
    this.units = units;
    this.relations = relations;
    this.inputs = inputs;
    this.reverse = indexedLists("reverse derivation", snapshot.reverseDerivations ?? [], (entry) => entry.subjectId, (entry) => entry.dependentIds);
    this.selectorMembers = indexedLists("selector membership", snapshot.selectorMemberships ?? [], (entry) => entry.selectorHash, (entry) => entry.memberIds);
  }
  getConcept(id) {
    return structuredClone(this.concepts.get(id));
  }
  getRequirement(id) {
    return structuredClone(this.requirements.get(id));
  }
  getBehavioralScenario(id) {
    return structuredClone(this.scenarios.get(id));
  }
  getProjectionUnit(id) {
    return structuredClone(this.units.get(id));
  }
  getRelations(id, direction) {
    return [...this.relations.values()].filter((item) => direction === "in" ? item.toId === id : direction === "out" ? item.fromId === id : item.fromId === id || item.toId === id).sort((left, right) => compareStrings(left.id, right.id)).map((item) => structuredClone(item));
  }
  reverseDerivationDependents(subjectId) {
    return [...this.reverse.get(subjectId) ?? []];
  }
  getDerivationInputs(unitId) {
    return structuredClone(this.inputs.get(unitId) ?? []);
  }
  querySelectorDependencies(selectorHash2) {
    return [...this.selectorMembers.get(selectorHash2) ?? []];
  }
  searchSemanticIdentities(query, kinds = ["concept", "requirement", "scenario"]) {
    const needle = query.trim().toLocaleLowerCase("en-US");
    if (needle.length === 0)
      return [];
    const matches = [];
    const includes = (values) => values.some((value) => value.toLocaleLowerCase("en-US").includes(needle));
    if (kinds.includes("concept")) {
      for (const item of this.concepts.values()) {
        if (includes([item.key, item.name, item.statement, ...item.aliases]))
          matches.push(item.id);
      }
    }
    if (kinds.includes("requirement")) {
      for (const item of this.requirements.values()) {
        if (includes([item.key, item.title, item.statement, ...item.aliases]))
          matches.push(item.id);
      }
    }
    if (kinds.includes("scenario")) {
      for (const item of this.scenarios.values()) {
        if (includes([item.key, item.title, ...item.aliases, ...item.steps.map(({ statement }) => statement)]))
          matches.push(item.id);
      }
    }
    return sortedUniqueStrings(matches);
  }
};
var UnknownQueryProgramError = class extends Error {
  constructor(programId) {
    super(`unknown registered query program ${programId}`);
    this.name = "UnknownQueryProgramError";
  }
};
var QueryProgramVersionError = class extends Error {
  constructor(programId, expected, received) {
    super(`query program ${programId} version changed from ${received} to ${expected}`);
    this.name = "QueryProgramVersionError";
  }
};
var InvalidQuerySpecError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidQuerySpecError";
  }
};
var querySemanticHash = (query) => hashFramedDomain("state-query", {
  kind: query.kind,
  programId: query.programId,
  programVersion: query.programVersion,
  input: query.input
});
function requireString(input, key) {
  const value = input[key];
  if (typeof value !== "string" || value.length === 0)
    throw new InvalidQuerySpecError(`query input ${key} must be a non-empty string`);
  return value;
}
function requireStringArray(input, key) {
  const value = input[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new InvalidQuerySpecError(`query input ${key} must be an array of non-empty strings`);
  }
  return sortedUniqueStrings(value);
}
function optionalStringArray(input, key) {
  return input[key] === void 0 ? [] : requireStringArray(input, key);
}
function reverseClosure(graph, seedIds, excludedIds = []) {
  const seen = /* @__PURE__ */ new Set();
  const excluded = new Set(excludedIds);
  const pending = [...seedIds].sort(compareStrings);
  while (pending.length > 0) {
    const current = pending.shift();
    for (const dependent of graph.reverseDerivationDependents(current).slice().sort(compareStrings)) {
      if (excluded.has(dependent) || seen.has(dependent))
        continue;
      seen.add(dependent);
      pending.push(dependent);
      pending.sort(compareStrings);
    }
  }
  return sortedUniqueStrings([...seen]);
}
function requireBoolean(input, key) {
  const value = input[key];
  if (typeof value !== "boolean")
    throw new InvalidQuerySpecError(`query input ${key} must be a boolean`);
  return value;
}
function requireObservability(input) {
  const value = input.observability;
  if (!["closed", "bounded", "sampled", "open", "unavailable"].includes(String(value))) {
    throw new InvalidQuerySpecError("query input observability is invalid");
  }
  return value;
}
function observationMetadata(input) {
  return {
    observability: requireObservability(input),
    assumptions: requireStringArray(input, "assumptions"),
    unavailableLanes: requireStringArray(input, "unavailableLanes"),
    dependencyKeys: requireStringArray(input, "dependencyKeys")
  };
}
function normalizeObservationInput(input, arrays) {
  return {
    ...structuredClone(input),
    ...Object.fromEntries(arrays.map((key) => [key, requireStringArray(input, key)])),
    observability: requireObservability(input),
    assumptions: requireStringArray(input, "assumptions"),
    unavailableLanes: requireStringArray(input, "unavailableLanes"),
    dependencyKeys: requireStringArray(input, "dependencyKeys")
  };
}
var NonRebindableQueryError = class extends UnknownQueryProgramError {
  constructor(programId) {
    super(programId);
    this.message = `query program ${programId} has an explicit non-rebindable observation contract`;
    this.name = "NonRebindableQueryError";
  }
};
function idResults(ids, disposition) {
  return sortedUniqueStrings(ids).map((id) => ({
    id,
    ...disposition === void 0 ? {} : { disposition }
  }));
}
var BUILT_IN_QUERY_PROGRAM_IDS = Object.freeze({
  eventTopologyRelevance: "projector.topology.event-relevance",
  contractTopologyRelevance: "projector.topology.contract-relevance",
  exactReverseDerivation: "invalidation.exact-reverse-derivation",
  transitiveReverseDerivation: "invalidation.transitive-reverse-derivation",
  impactRuleSelectorMembership: "invalidation.impact-rule-selector-membership",
  impactRuleApplicability: "invalidation.impact-rule-applicability",
  impactRuleReverseTraversal: "invalidation.impact-rule-reverse-traversal",
  impactRuleEnumeration: "invalidation.impact-rule-enumeration"
});
var IDENTITY_BOUNDARY_QUERY_PROGRAM_IDS = Object.freeze({
  exact: "identity.exact-search",
  alias: "identity.alias-search",
  lineage: "identity.lineage",
  tombstone: "identity.tombstone",
  relations: "identity.relations",
  topology: "identity.topology"
});
function createTopologyRelevanceQueryPrograms(port) {
  const create = (subjectKind) => ({
    id: subjectKind === "event" ? BUILT_IN_QUERY_PROGRAM_IDS.eventTopologyRelevance : BUILT_IN_QUERY_PROGRAM_IDS.contractTopologyRelevance,
    version: "1",
    kind: subjectKind === "event" ? "event-topology" : "contract-topology",
    normalizeInput: (input) => ({ subjectId: requireString(input, "subjectId") }),
    evaluate: ({ input, context }) => port.inspect(requireString(input, "subjectId"), subjectKind, context)
  });
  return [create("event"), create("contract")];
}
var identityBoundaryDefinitions = [
  ["exact", IDENTITY_BOUNDARY_QUERY_PROGRAM_IDS.exact, "semantic-identity-search"],
  ["alias", IDENTITY_BOUNDARY_QUERY_PROGRAM_IDS.alias, "semantic-identity-search"],
  ["lineage", IDENTITY_BOUNDARY_QUERY_PROGRAM_IDS.lineage, "custom"],
  ["tombstone", IDENTITY_BOUNDARY_QUERY_PROGRAM_IDS.tombstone, "custom"],
  ["relations", IDENTITY_BOUNDARY_QUERY_PROGRAM_IDS.relations, "relation-neighborhood"],
  ["topology", IDENTITY_BOUNDARY_QUERY_PROGRAM_IDS.topology, "custom"]
];
function createIdentityBoundaryQueryPrograms(port) {
  const normalize = (input) => {
    const requestedMeaning = requireString(input, "requestedMeaning").normalize("NFKC").trim();
    const requestedKind = requireString(input, "requestedKind");
    if (!["concept", "requirement", "scenario", "unknown"].includes(requestedKind)) {
      throw new InvalidQuerySpecError("identity requestedKind is invalid");
    }
    return { requestedMeaning, requestedKind };
  };
  return identityBoundaryDefinitions.map(([lane, id, kind]) => ({
    id,
    version: "2",
    kind,
    normalizeInput: normalize,
    evaluate: ({ input, context }) => port.inspect(lane, normalize(input), context)
  }));
}
function impactTraversalProgram(id, kind) {
  return {
    id,
    version: "1",
    kind,
    normalizeInput: (input) => ({
      ...normalizeObservationInput(input, ["seedIds", "excludedIds"]),
      rebindable: requireBoolean(input, "rebindable")
    }),
    evaluate: ({ input, graph }) => {
      if (!requireBoolean(input, "rebindable"))
        throw new NonRebindableQueryError(id);
      return {
        results: idResults(reverseClosure(graph, requireStringArray(input, "seedIds"), requireStringArray(input, "excludedIds")), "known"),
        ...observationMetadata(input)
      };
    }
  };
}
function builtInPrograms() {
  return [
    {
      id: "graph.semantic-identity-search",
      version: "1",
      kind: "semantic-identity-search",
      normalizeInput: (input) => {
        const query = requireString(input, "query");
        const kinds = input.kinds;
        if (kinds !== void 0 && (!Array.isArray(kinds) || kinds.some((kind) => !["concept", "requirement", "scenario"].includes(String(kind))))) {
          throw new InvalidQuerySpecError("semantic identity kinds must contain only concept, requirement, or scenario");
        }
        return {
          query,
          ...kinds === void 0 ? {} : { kinds: sortedUniqueStrings(kinds) }
        };
      },
      evaluate: ({ input, graph }) => {
        const query = requireString(input, "query");
        const kindsValue = input.kinds;
        const kinds = kindsValue === void 0 ? void 0 : kindsValue;
        if (kinds !== void 0 && (!Array.isArray(kinds) || kinds.some((kind) => !["concept", "requirement", "scenario"].includes(String(kind))))) {
          throw new InvalidQuerySpecError("semantic identity kinds must contain only concept, requirement, or scenario");
        }
        const normalizedKinds = kinds === void 0 ? void 0 : sortedUniqueStrings(kinds);
        return {
          results: graph.searchSemanticIdentities(query, normalizedKinds).map((id) => ({ id })),
          observability: "closed",
          assumptions: [],
          unavailableLanes: [],
          dependencyKeys: ["semantic-identities"]
        };
      }
    },
    {
      id: "graph.relation-neighborhood",
      version: "1",
      kind: "relation-neighborhood",
      evaluate: ({ input, graph }) => {
        const entityId = requireString(input, "entityId");
        const direction = input.direction;
        if (direction !== "in" && direction !== "out" && direction !== "both") {
          throw new InvalidQuerySpecError("relation direction must be in, out, or both");
        }
        return {
          results: graph.getRelations(entityId, direction).map(({ id, fromId, toId, type, active, semanticHash }) => ({
            id,
            fromId,
            toId,
            type,
            active,
            semanticHash
          })),
          observability: "closed",
          assumptions: [],
          unavailableLanes: [],
          dependencyKeys: [`relations:${direction}:${entityId}`]
        };
      }
    },
    {
      id: "graph.reverse-derivation",
      version: "1",
      kind: "reverse-derivation",
      evaluate: ({ input, graph }) => {
        const subjectId = requireString(input, "subjectId");
        return {
          results: graph.reverseDerivationDependents(subjectId).map((id) => ({ id })),
          observability: "closed",
          assumptions: [],
          unavailableLanes: [],
          dependencyKeys: [`reverse-derivations:${subjectId}`]
        };
      }
    },
    {
      id: "graph.selector-membership",
      version: "1",
      kind: "selector-membership",
      evaluate: ({ input, graph }) => {
        const selectorHash2 = requireString(input, "selectorHash");
        return {
          results: graph.querySelectorDependencies(selectorHash2).map((id) => ({ id })),
          observability: "closed",
          assumptions: [],
          unavailableLanes: [],
          dependencyKeys: [`selector-membership:${selectorHash2}`]
        };
      }
    },
    {
      id: BUILT_IN_QUERY_PROGRAM_IDS.exactReverseDerivation,
      version: "1",
      kind: "reverse-derivation",
      normalizeInput: (input) => ({ ...structuredClone(input), subjectId: requireString(input, "subjectId") }),
      evaluate: ({ input, graph }) => {
        const subjectId = requireString(input, "subjectId");
        return {
          results: idResults(graph.reverseDerivationDependents(subjectId)),
          observability: "closed",
          assumptions: [],
          unavailableLanes: [],
          dependencyKeys: [`reverse-derivations:${subjectId}`]
        };
      }
    },
    {
      id: BUILT_IN_QUERY_PROGRAM_IDS.transitiveReverseDerivation,
      version: "1",
      kind: "reverse-derivation",
      normalizeInput: (input) => ({
        ...structuredClone(input),
        seedIds: requireStringArray(input, "seedIds"),
        excludedIds: optionalStringArray(input, "excludedIds")
      }),
      evaluate: ({ input, graph }) => {
        const seedIds = requireStringArray(input, "seedIds");
        const excludedIds = requireStringArray(input, "excludedIds");
        return {
          results: idResults(reverseClosure(graph, seedIds, excludedIds)),
          observability: "closed",
          assumptions: [],
          unavailableLanes: [],
          dependencyKeys: seedIds.map((id) => `reverse-derivations:${id}`)
        };
      }
    },
    {
      id: BUILT_IN_QUERY_PROGRAM_IDS.impactRuleSelectorMembership,
      version: "1",
      kind: "selector-membership",
      normalizeInput: (input) => ({
        ...normalizeObservationInput(input, ["historicalMemberIds"]),
        selectorHash: requireString(input, "selectorHash"),
        phase: requireString(input, "phase")
      }),
      evaluate: ({ input, graph }) => {
        const selectorHash2 = requireString(input, "selectorHash");
        const phase = requireString(input, "phase");
        if (phase !== "before" && phase !== "after")
          throw new InvalidQuerySpecError("membership phase must be before or after");
        const memberIds = phase === "before" ? requireStringArray(input, "historicalMemberIds") : graph.querySelectorDependencies(selectorHash2);
        return {
          results: idResults(memberIds),
          ...observationMetadata(input)
        };
      }
    },
    {
      id: BUILT_IN_QUERY_PROGRAM_IDS.impactRuleApplicability,
      version: "1",
      kind: "impact-rule-applicability",
      normalizeInput: (input) => ({
        ...normalizeObservationInput(input, ["beforeMemberIds"]),
        selectorHash: requireString(input, "selectorHash")
      }),
      evaluate: ({ input, graph }) => {
        const selectorHash2 = requireString(input, "selectorHash");
        const ids = sortedUniqueStrings([
          ...requireStringArray(input, "beforeMemberIds"),
          ...graph.querySelectorDependencies(selectorHash2)
        ]);
        return {
          results: idResults(ids),
          ...observationMetadata(input)
        };
      }
    },
    impactTraversalProgram(BUILT_IN_QUERY_PROGRAM_IDS.impactRuleReverseTraversal, "reverse-derivation"),
    impactTraversalProgram(BUILT_IN_QUERY_PROGRAM_IDS.impactRuleEnumeration, "surface-enumeration")
  ];
}
function normalizeProgramResult(programId, queryHash, raw) {
  const normalizedById = /* @__PURE__ */ new Map();
  for (const result of raw.results) {
    if (typeof result !== "object" || result === null || Array.isArray(result) || typeof result.id !== "string" || result.id.length === 0) {
      throw new Error(`query program ${programId} returned a result without a stable id`);
    }
    const json = canonicalJson(result);
    const existing = normalizedById.get(result.id);
    if (existing !== void 0 && existing.json !== json) {
      throw new Error(`query program ${programId} returned conflicting projections for stable id ${result.id}`);
    }
    normalizedById.set(result.id, { json, result: structuredClone(result) });
  }
  const normalizedResults = [...normalizedById.entries()].sort(([left], [right]) => compareStrings(left, right)).map(([, { result }]) => result);
  const dependencyKeys = sortedUniqueStrings(raw.dependencyKeys);
  if (dependencyKeys.length === 0)
    throw new Error(`query program ${programId} returned no dependency keys`);
  return {
    queryHash,
    resultHash: hashFramedDomain("state-query-result", normalizedResults),
    resultCount: normalizedResults.length,
    observability: raw.observability,
    assumptions: sortedUniqueStrings(raw.assumptions),
    unavailableLanes: sortedUniqueStrings(raw.unavailableLanes),
    dependencyKeys
  };
}
function createBuiltInQueryDependency(input) {
  const program = builtInPrograms().find(({ id }) => id === input.programId);
  if (program === void 0)
    throw new UnknownQueryProgramError(input.programId);
  const normalizedInput = program.normalizeInput?.(structuredClone(input.input)) ?? structuredClone(input.input);
  const basis = { kind: program.kind, programId: program.id, programVersion: program.version, input: normalizedInput };
  const semanticHash = querySemanticHash(basis);
  return {
    query: { id: input.id, ...basis, semanticHash },
    priorResult: normalizeProgramResult(program.id, semanticHash, input.observed),
    role: input.role
  };
}
var QueryDependencyRegistry = class {
  graph;
  programs = /* @__PURE__ */ new Map();
  versionHistory = /* @__PURE__ */ new Map();
  constructor(graph, includeBuiltIns = true) {
    this.graph = graph;
    if (includeBuiltIns)
      for (const program of builtInPrograms())
        this.register(program);
  }
  register(program) {
    if (program.id.length === 0 || program.version.length === 0)
      throw new Error("query program ID and version must be non-empty");
    const history = this.versionHistory.get(program.id) ?? /* @__PURE__ */ new Set();
    if (history.has(program.version)) {
      throw new Error(`query program ${program.id} version ${program.version} was previously registered; version identifiers cannot be rebound`);
    }
    this.programs.set(program.id, Object.freeze({ ...program }));
    history.add(program.version);
    this.versionHistory.set(program.id, history);
  }
  createSpec(input) {
    const program = this.programs.get(input.programId);
    if (program === void 0)
      throw new UnknownQueryProgramError(input.programId);
    canonicalJson(input.input);
    const normalizedInput = program.normalizeInput?.(structuredClone(input.input)) ?? structuredClone(input.input);
    canonicalJson(normalizedInput);
    const basis = {
      kind: program.kind,
      programId: program.id,
      programVersion: program.version,
      input: normalizedInput
    };
    return { id: input.id, ...basis, semanticHash: querySemanticHash(basis) };
  }
  assertCurrent(query) {
    const program = this.programs.get(query.programId);
    if (program === void 0)
      throw new UnknownQueryProgramError(query.programId);
    if (program.version !== query.programVersion)
      throw new QueryProgramVersionError(program.id, program.version, query.programVersion);
    if (program.kind !== query.kind)
      throw new InvalidQuerySpecError(`query kind ${query.kind} does not match program kind ${program.kind}`);
    const normalizedInput = program.normalizeInput?.(structuredClone(query.input)) ?? structuredClone(query.input);
    if (canonicalJson(normalizedInput) !== canonicalJson(query.input) || querySemanticHash({ ...query, input: normalizedInput }) !== query.semanticHash) {
      throw new InvalidQuerySpecError("query semantic hash does not match program and normalized input");
    }
  }
  async evaluate(query, context) {
    this.assertCurrent(query);
    const program = this.programs.get(query.programId);
    const expectedHash = querySemanticHash(query);
    const raw = await program.evaluate({ input: structuredClone(query.input), graph: this.graph, context });
    return normalizeProgramResult(program.id, expectedHash, raw);
  }
};
function createTopologyQueryBindingPort(registry) {
  return {
    bind: async (subjectId, subjectKind, context) => {
      const programId = subjectKind === "event" ? BUILT_IN_QUERY_PROGRAM_IDS.eventTopologyRelevance : BUILT_IN_QUERY_PROGRAM_IDS.contractTopologyRelevance;
      const query = registry.createSpec({ id: `topology-consumers:${subjectId}`, programId, input: { subjectId } });
      return {
        query,
        priorResult: await registry.evaluate(query, context),
        role: `known ${subjectKind} consumers and negative space for ${subjectId}`
      };
    }
  };
}

// node_modules/@projector/engine/dist/state/index.js
var compareStrings2 = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var sortedUniqueStrings2 = (values) => [...new Set(values)].sort(compareStrings2);
var valueKey = (dependency) => canonicalJson({ kind: dependency.kind, id: dependency.id, role: dependency.role });
var queryKey = (dependency) => canonicalJson({ id: dependency.query.id, role: dependency.role });
function normalizeValueDependencies(dependencies) {
  const byKey = /* @__PURE__ */ new Map();
  for (const dependency of dependencies) {
    const key = valueKey(dependency);
    const existing = byKey.get(key);
    if (existing !== void 0 && existing.versionHash !== dependency.versionHash) {
      throw new Error(`conflicting value dependency ${dependency.id}`);
    }
    byKey.set(key, structuredClone(dependency));
  }
  return [...byKey.entries()].sort(([left], [right]) => compareStrings2(left, right)).map(([, dependency]) => dependency);
}
function normalizeFingerprint(fingerprint) {
  return {
    ...structuredClone(fingerprint),
    assumptions: sortedUniqueStrings2(fingerprint.assumptions),
    unavailableLanes: sortedUniqueStrings2(fingerprint.unavailableLanes),
    dependencyKeys: sortedUniqueStrings2(fingerprint.dependencyKeys)
  };
}
function normalizeQueryDependencies(dependencies) {
  const byKey = /* @__PURE__ */ new Map();
  for (const dependency of dependencies) {
    const normalized = { ...structuredClone(dependency), priorResult: normalizeFingerprint(dependency.priorResult) };
    if (normalized.priorResult.queryHash !== normalized.query.semanticHash) {
      throw new Error(`query dependency ${dependency.query.id} prior result query hash does not match its query`);
    }
    if (normalized.priorResult.dependencyKeys.length === 0) {
      throw new Error(`query dependency ${dependency.query.id} must declare at least one dependency key`);
    }
    const key = queryKey(normalized);
    const existing = byKey.get(key);
    if (existing !== void 0 && canonicalJson(existing) !== canonicalJson(normalized)) {
      throw new Error(`conflicting query dependency ${dependency.query.id}`);
    }
    byKey.set(key, normalized);
  }
  return [...byKey.entries()].sort(([left], [right]) => compareStrings2(left, right)).map(([, dependency]) => dependency);
}
function createStateBinding(input) {
  const valueDependencies = normalizeValueDependencies(input.valueDependencies);
  const queryDependencies = normalizeQueryDependencies(input.queryDependencies);
  return {
    compiledAgainst: structuredClone(input.compiledAgainst),
    valueDependencies,
    queryDependencies,
    dependencyDigest: hashFramedDomain("state-binding-dependencies", { valueDependencies, queryDependencies })
  };
}
var sameState = (left, right) => canonicalJson(left) === canonicalJson(right);
var sameFingerprint = (left, right) => canonicalJson(normalizeFingerprint(left)) === canonicalJson(normalizeFingerprint(right));
var cannotProveEmptyAbsence = (fingerprint) => fingerprint.resultCount === 0 && (fingerprint.observability === "open" || fingerprint.observability === "sampled");
function queryObservation(dependency, currentResult, basis) {
  const unavailable = dependency.priorResult.observability === "unavailable" || currentResult.observability === "unavailable";
  const changed = !sameFingerprint(dependency.priorResult, currentResult);
  const incomplete = dependency.priorResult.unavailableLanes.length > 0 || currentResult.unavailableLanes.length > 0 || cannotProveEmptyAbsence(dependency.priorResult) || cannotProveEmptyAbsence(currentResult);
  const status = unavailable ? "unknown" : changed ? "stale" : incomplete ? "unknown" : "current";
  return { kind: "query", dependency, currentResult, basis, status, reason: unavailable ? "A required prior or current query observation is unavailable." : changed ? "The query fingerprint changed; compare result membership, query semantics and observation boundaries." : incomplete ? "Matching query fingerprints cannot prove an empty open population or unavailable observation lanes." : basis === "evaluated" ? "Re-evaluation preserved the bound query fingerprint." : basis === "same-snapshot" ? "The snapshot and registered query semantics remain unchanged." : "Registered query semantics and all declared dependency keys remain unchanged." };
}
function failedQueryObservation(dependency, error) {
  return {
    kind: "query",
    dependency,
    status: error instanceof QueryProgramVersionError && dependency.priorResult.observability !== "unavailable" ? "stale" : "unknown",
    basis: "unavailable",
    reason: error instanceof Error ? error.message : `query ${dependency.query.id} could not be observed`
  };
}
var DependencyScopedStateBindingValidator = class {
  values;
  queries;
  changedDependencyKeys;
  constructor(options) {
    this.values = options.values;
    this.queries = options.queries;
    this.changedDependencyKeys = options.changedDependencyKeys;
  }
  async validate(binding, currentState, context) {
    const observations = [];
    let normalizedBinding;
    try {
      normalizedBinding = createStateBinding(binding);
      if (normalizedBinding.dependencyDigest !== binding.dependencyDigest) {
        return {
          status: "suspect",
          currentState: structuredClone(currentState),
          changedValueDependencyIds: [],
          changedQueryDependencyIds: [],
          reasons: ["binding dependency digest does not match its value and query dependencies"]
        };
      }
    } catch (error) {
      return {
        status: "suspect",
        currentState: structuredClone(currentState),
        changedValueDependencyIds: [],
        changedQueryDependencyIds: [],
        reasons: [error instanceof Error ? error.message : "invalid state binding"]
      };
    }
    if (sameState(binding.compiledAgainst, currentState)) {
      for (const dependency of normalizedBinding.valueDependencies)
        observations.push({ kind: "value", dependency, status: "current", basis: "same-snapshot", currentVersionHash: dependency.versionHash, reason: "The exact compiled snapshot remains unchanged." });
      const changedQueryDependencyIds2 = [];
      const unavailableQueryDependencyIds2 = [];
      const suspectQueryDependencyIds2 = [];
      const reasons2 = [];
      for (const dependency of normalizedBinding.queryDependencies) {
        if (dependency.priorResult.observability === "unavailable") {
          unavailableQueryDependencyIds2.push(dependency.query.id);
        } else if (dependency.priorResult.unavailableLanes.length > 0 || cannotProveEmptyAbsence(dependency.priorResult)) {
          suspectQueryDependencyIds2.push(dependency.query.id);
        }
        try {
          if (this.queries.assertCurrent !== void 0) {
            this.queries.assertCurrent(dependency.query);
            observations.push(queryObservation(dependency, dependency.priorResult, "same-snapshot"));
          } else {
            const current = normalizeFingerprint(await this.queries.evaluate(dependency.query, context));
            observations.push(queryObservation(dependency, current, "evaluated"));
            if (current.observability === "unavailable")
              unavailableQueryDependencyIds2.push(dependency.query.id);
            else if (!sameFingerprint(current, dependency.priorResult))
              changedQueryDependencyIds2.push(dependency.query.id);
            else if (current.unavailableLanes.length > 0 || cannotProveEmptyAbsence(current))
              suspectQueryDependencyIds2.push(dependency.query.id);
          }
        } catch (error) {
          observations.push(failedQueryObservation(dependency, error));
          if (error instanceof QueryProgramVersionError) {
            changedQueryDependencyIds2.push(dependency.query.id);
            reasons2.push(error.message);
          } else {
            unavailableQueryDependencyIds2.push(dependency.query.id);
            reasons2.push(error instanceof Error ? error.message : `query ${dependency.query.id} is unavailable`);
          }
        }
      }
      const changedQueries2 = sortedUniqueStrings2(changedQueryDependencyIds2);
      const unavailableQueries2 = sortedUniqueStrings2(unavailableQueryDependencyIds2);
      const suspectQueries2 = sortedUniqueStrings2(suspectQueryDependencyIds2);
      if (changedQueries2.length > 0)
        reasons2.push(`query dependencies changed: ${changedQueries2.join(", ")}`);
      if (unavailableQueries2.length > 0)
        reasons2.push(`query dependencies unavailable: ${unavailableQueries2.join(", ")}`);
      if (suspectQueries2.length > 0)
        reasons2.push(`query observation boundary is incomplete: ${suspectQueries2.join(", ")}`);
      const result = {
        observations,
        currentState: structuredClone(currentState),
        changedValueDependencyIds: [],
        changedQueryDependencyIds: changedQueries2,
        reasons: reasons2
      };
      if (unavailableQueries2.length > 0)
        return { status: "unavailable", ...result };
      if (changedQueries2.length > 0)
        return { status: "stale", ...result };
      if (suspectQueries2.length > 0)
        return { status: "suspect", ...result };
      return { status: "current", ...result, reasons: ["compiled snapshot and registered query dependencies are unchanged"] };
    }
    const changedValueDependencyIds = [];
    const changedQueryDependencyIds = [];
    const unavailableValueDependencyIds = [];
    const unavailableQueryDependencyIds = [];
    const suspectQueryDependencyIds = [];
    const reasons = [];
    for (const dependency of normalizedBinding.valueDependencies) {
      try {
        const currentHash = await this.values.readVersionHash(dependency, currentState, context);
        observations.push({ kind: "value", dependency, status: currentHash === void 0 ? "unknown" : currentHash === dependency.versionHash ? "current" : "stale", basis: "observed", ...currentHash === void 0 ? {} : { currentVersionHash: currentHash }, reason: currentHash === void 0 ? "The bound value or profile is unavailable in the current observation." : currentHash === dependency.versionHash ? "The observed value or profile hash matches its binding." : "The observed value or profile hash differs from its binding." });
        if (currentHash === void 0) {
          unavailableValueDependencyIds.push(dependency.id);
        } else if (currentHash !== dependency.versionHash) {
          changedValueDependencyIds.push(dependency.id);
        }
      } catch (error) {
        unavailableValueDependencyIds.push(dependency.id);
        observations.push({ kind: "value", dependency, status: "unknown", basis: "observed", reason: error instanceof Error ? error.message : `value ${dependency.id} could not be observed` });
      }
    }
    let changedKeys;
    try {
      changedKeys = await this.changedDependencyKeys?.changedKeys(binding.compiledAgainst, currentState, context);
    } catch {
      changedKeys = void 0;
      reasons.push("changed dependency keys could not be proven; queries were re-evaluated conservatively");
    }
    const changedKeySet = changedKeys === void 0 ? void 0 : new Set(changedKeys);
    const reboundQueryDependencies = [];
    for (const dependency of normalizedBinding.queryDependencies) {
      if (dependency.priorResult.observability === "unavailable") {
        unavailableQueryDependencyIds.push(dependency.query.id);
      } else if (dependency.priorResult.unavailableLanes.length > 0) {
        suspectQueryDependencyIds.push(dependency.query.id);
      }
      try {
        this.queries.assertCurrent?.(dependency.query);
      } catch (error) {
        observations.push(failedQueryObservation(dependency, error));
        if (error instanceof QueryProgramVersionError) {
          changedQueryDependencyIds.push(dependency.query.id);
          reasons.push(error.message);
        } else {
          unavailableQueryDependencyIds.push(dependency.query.id);
          reasons.push(error instanceof Error ? error.message : `query ${dependency.query.id} is unavailable`);
        }
        reboundQueryDependencies.push(dependency);
        continue;
      }
      const isProvablyUnchanged = this.queries.assertCurrent !== void 0 && changedKeySet !== void 0 && dependency.priorResult.dependencyKeys.every((key) => !changedKeySet.has(key));
      if (isProvablyUnchanged) {
        observations.push(queryObservation(dependency, dependency.priorResult, "unchanged-dependency-keys"));
        if (dependency.priorResult.observability === "unavailable")
          unavailableQueryDependencyIds.push(dependency.query.id);
        else if (cannotProveEmptyAbsence(dependency.priorResult))
          suspectQueryDependencyIds.push(dependency.query.id);
        reboundQueryDependencies.push(dependency);
        continue;
      }
      try {
        const current = normalizeFingerprint(await this.queries.evaluate(dependency.query, context));
        observations.push(queryObservation(dependency, current, "evaluated"));
        reboundQueryDependencies.push({ ...dependency, priorResult: current });
        if (current.observability === "unavailable") {
          unavailableQueryDependencyIds.push(dependency.query.id);
        } else if (!sameFingerprint(current, dependency.priorResult)) {
          changedQueryDependencyIds.push(dependency.query.id);
        } else if (cannotProveEmptyAbsence(current)) {
          suspectQueryDependencyIds.push(dependency.query.id);
        } else if (current.unavailableLanes.length > 0) {
          suspectQueryDependencyIds.push(dependency.query.id);
        }
      } catch (error) {
        observations.push(failedQueryObservation(dependency, error));
        if (error instanceof QueryProgramVersionError) {
          changedQueryDependencyIds.push(dependency.query.id);
          reasons.push(error.message);
        } else if (error instanceof UnknownQueryProgramError) {
          unavailableQueryDependencyIds.push(dependency.query.id);
          reasons.push(error.message);
        } else {
          unavailableQueryDependencyIds.push(dependency.query.id);
          reasons.push(`query ${dependency.query.id} could not be re-evaluated`);
        }
        reboundQueryDependencies.push(dependency);
      }
    }
    const changedValues = sortedUniqueStrings2(changedValueDependencyIds);
    const changedQueries = sortedUniqueStrings2(changedQueryDependencyIds);
    const unavailableValues = sortedUniqueStrings2(unavailableValueDependencyIds);
    const unavailableQueries = sortedUniqueStrings2(unavailableQueryDependencyIds);
    const suspectQueries = sortedUniqueStrings2(suspectQueryDependencyIds);
    if (changedValues.length > 0)
      reasons.push(`value dependencies changed: ${changedValues.join(", ")}`);
    if (changedQueries.length > 0)
      reasons.push(`query dependencies changed: ${changedQueries.join(", ")}`);
    if (unavailableValues.length > 0)
      reasons.push(`value dependencies unavailable: ${unavailableValues.join(", ")}`);
    if (unavailableQueries.length > 0)
      reasons.push(`query dependencies unavailable: ${unavailableQueries.join(", ")}`);
    if (suspectQueries.length > 0)
      reasons.push(`query absence is not proof-eligible: ${suspectQueries.join(", ")}`);
    const base = {
      observations,
      currentState: structuredClone(currentState),
      changedValueDependencyIds: changedValues,
      changedQueryDependencyIds: changedQueries,
      reasons
    };
    if (unavailableValues.length > 0 || unavailableQueries.length > 0)
      return { status: "unavailable", ...base };
    if (changedValues.length > 0 || changedQueries.length > 0)
      return { status: "stale", ...base };
    if (suspectQueries.length > 0)
      return { status: "suspect", ...base };
    const rebound = createStateBinding({
      compiledAgainst: currentState,
      valueDependencies: normalizedBinding.valueDependencies,
      queryDependencies: reboundQueryDependencies
    });
    return {
      status: "rebound",
      ...base,
      reasons: reasons.length === 0 ? ["all bound value hashes and query dependencies remain current"] : reasons,
      rebound
    };
  }
};
var DependencyScopedCache = class {
  validator;
  entries = /* @__PURE__ */ new Map();
  constructor(validator) {
    this.validator = validator;
  }
  set(key, value, binding) {
    const normalized = createStateBinding(binding);
    if (normalized.valueDependencies.length === 0) {
      throw new Error("cache entry binding must declare at least one value dependency");
    }
    if (normalized.queryDependencies.length === 0) {
      throw new Error("cache entry binding must declare at least one query dependency");
    }
    if (normalized.dependencyDigest !== binding.dependencyDigest) {
      throw new Error("cache entry binding dependency digest is invalid");
    }
    this.entries.set(key, { value, binding: normalized });
  }
  async get(key, currentState, context) {
    const entry = this.entries.get(key);
    if (entry === void 0)
      return void 0;
    const validation = await this.validator.validate(entry.binding, currentState, context);
    if (validation.status === "current")
      return entry.value;
    if (validation.status === "rebound" && validation.rebound !== void 0) {
      entry.binding = validation.rebound;
      return entry.value;
    }
    this.entries.delete(key);
    return void 0;
  }
};

// node_modules/@projector/engine/dist/governance/selectors.js
var compareStrings3 = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var sortedUnique = (values) => [...new Set(values)].sort(compareStrings3);
var selectorFields = /* @__PURE__ */ new Set([
  "path",
  "language",
  "artifact-role",
  "concept",
  "concept-kind",
  "requirement",
  "scenario",
  "lens",
  "surface",
  "package",
  "package-kind",
  "operation",
  "platform",
  "migration-phase",
  "risk",
  "tag",
  "control-ownership",
  "control-mutation",
  "ast-pattern",
  "relation",
  "causal-origin"
]);
var selectorMatchers = /* @__PURE__ */ new Set([
  "equals",
  "in",
  "glob",
  "regex",
  "contains",
  "exists",
  "matches-structural-query"
]);
var SelectorEvaluationError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "SelectorEvaluationError";
  }
};
function projectionUnitSelectorSubject(unit, facts = {}) {
  return {
    id: unit.id,
    values: {
      path: facts.path ?? unit.anchor.value,
      "artifact-role": unit.role,
      concept: unit.conceptIds,
      "concept-kind": facts.conceptKinds ?? [],
      requirement: unit.requirementIds,
      scenario: unit.scenarioIds,
      lens: unit.lenses.map(({ lensId }) => lensId),
      tag: unit.tags,
      "control-ownership": unit.control.ownership,
      "control-mutation": unit.control.mutation,
      "causal-origin": unit.causalOrigin.kind,
      ...facts.language === void 0 ? {} : { language: facts.language },
      ...facts.surface === void 0 ? {} : { surface: facts.surface },
      ...facts.package === void 0 ? {} : { package: facts.package },
      ...facts.packageKind === void 0 ? {} : { "package-kind": facts.packageKind },
      ...facts.operation === void 0 ? {} : { operation: facts.operation },
      ...facts.platform === void 0 ? {} : { platform: facts.platform },
      ...facts.migrationPhase === void 0 ? {} : { "migration-phase": facts.migrationPhase },
      ...facts.risk === void 0 ? {} : { risk: facts.risk },
      ...facts.astPattern === void 0 ? {} : { "ast-pattern": facts.astPattern },
      ...facts.relation === void 0 ? {} : { relation: facts.relation }
    },
    dependencyKeys: sortedUnique([
      `projection-unit:${unit.id}`,
      `membership:${unit.id}:${unit.membershipHash}`,
      ...unit.conceptIds.map((id) => `concept:${id}`),
      ...unit.requirementIds.map((id) => `requirement:${id}`),
      ...unit.scenarioIds.map((id) => `scenario:${id}`),
      ...unit.lenses.map(({ lensId, semanticHash }) => `lens:${lensId}:${semanticHash}`)
    ])
  };
}
function normalizeAtom(atom) {
  if (!selectorFields.has(atom.field))
    throw new SelectorEvaluationError(`unsupported selector field ${String(atom.field)}`);
  if (!selectorMatchers.has(atom.matcher))
    throw new SelectorEvaluationError(`unsupported selector matcher ${String(atom.matcher)}`);
  let value = structuredClone(atom.value);
  if (atom.matcher === "in") {
    if (!Array.isArray(value))
      throw new SelectorEvaluationError(`selector ${atom.field} in matcher requires an array`);
    value = [...new Map(value.map((item) => [canonicalJson(item), item])).entries()].sort(([left], [right]) => compareStrings3(left, right)).map(([, item]) => item);
  }
  if (["glob", "regex", "contains"].includes(atom.matcher) && typeof value !== "string") {
    throw new SelectorEvaluationError(`selector ${atom.field} ${atom.matcher} matcher requires a string`);
  }
  if (atom.matcher === "exists" && typeof value !== "boolean") {
    throw new SelectorEvaluationError(`selector ${atom.field} exists matcher requires a boolean`);
  }
  canonicalJson(value);
  if (atom.matcher === "glob") {
    try {
      validateCanonicalGlob(value);
    } catch (error) {
      throw new SelectorEvaluationError(error instanceof Error ? error.message : "invalid glob selector");
    }
  }
  if (atom.matcher === "regex")
    deterministicRegexTokens(value);
  return { ...atom, value };
}
function normalizeSelector(selector) {
  if (selector.op === "atom")
    return normalizeAtom(selector);
  if (selector.op === "not") {
    const item = normalizeSelector(selector.item);
    return item.op === "not" ? item.item : { op: "not", item };
  }
  const items = selector.items.flatMap((item) => {
    const normalized = normalizeSelector(item);
    return normalized.op === selector.op ? normalized.items : [normalized];
  });
  const unique = new Map(items.map((item) => [canonicalJson(item), item]));
  return {
    op: selector.op,
    items: [...unique.entries()].sort(([left], [right]) => compareStrings3(left, right)).map(([, item]) => item)
  };
}
function selectorHash(selector) {
  return hashFramedDomain("selector", normalizeSelector(selector));
}
function scalarValues(value) {
  return Array.isArray(value) ? value : value === void 0 ? [] : [value];
}
function matchesCanonicalGlob2(glob, candidate) {
  return matchesCanonicalGlob(glob, candidate);
}
function parseCharacterClass(source) {
  const negated = source.startsWith("^");
  const body = negated ? source.slice(1) : source;
  const singles = /* @__PURE__ */ new Set();
  const ranges = [];
  for (let index = 0; index < body.length; index += 1) {
    let start = body[index];
    if (start === "\\") {
      index += 1;
      if (index >= body.length)
        throw new SelectorEvaluationError("unterminated character-class escape");
      start = body[index];
    }
    if (body[index + 1] === "-" && body[index + 2] !== void 0) {
      let end = body[index + 2];
      index += 2;
      if (end === "\\") {
        index += 1;
        if (index >= body.length)
          throw new SelectorEvaluationError("unterminated character-class range escape");
        end = body[index];
      }
      const startPoint = start.codePointAt(0);
      const endPoint = end.codePointAt(0);
      if (startPoint > endPoint)
        throw new SelectorEvaluationError("descending character-class ranges are unsupported");
      ranges.push([startPoint, endPoint]);
    } else
      singles.add(start);
  }
  return (character) => {
    const point = character.codePointAt(0);
    const contained = singles.has(character) || ranges.some(([start, end]) => point >= start && point <= end);
    return negated ? !contained : contained;
  };
}
function deterministicRegexTokens(pattern) {
  if (pattern.length === 0 || pattern.length > 256)
    throw new SelectorEvaluationError("regex selector must contain 1..256 characters");
  if (!pattern.startsWith("^") || !pattern.endsWith("$")) {
    throw new SelectorEvaluationError("regex selector must be explicitly anchored");
  }
  const body = pattern.slice(1, -1);
  const tokens = [];
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    let matches;
    if (character === "\\") {
      index += 1;
      const escaped = body[index];
      if (escaped === void 0 || /[1-9dDsSwWbB]/u.test(escaped)) {
        throw new SelectorEvaluationError("regex selector uses an unsupported escape or backreference");
      }
      matches = (input) => input === escaped;
    } else if (character === "[") {
      let end = index + 1;
      let escaped = false;
      while (end < body.length && (body[end] !== "]" || escaped)) {
        escaped = body[end] === "\\" && !escaped;
        if (body[end] !== "\\")
          escaped = false;
        end += 1;
      }
      if (end >= body.length)
        throw new SelectorEvaluationError("unterminated regex character class");
      matches = parseCharacterClass(body.slice(index + 1, end));
      index = end;
    } else if (character === ".")
      matches = () => true;
    else if ("()|{}^$*+?".includes(character)) {
      throw new SelectorEvaluationError(`regex selector uses unsupported operator ${character}`);
    } else
      matches = (input) => input === character;
    const quantifier = body[index + 1];
    if (quantifier === "*" || quantifier === "+" || quantifier === "?")
      index += 1;
    if (quantifier === "+") {
      tokens.push({ matches, repetition: "one" }, { matches, repetition: "star" });
    } else {
      tokens.push({ matches, repetition: quantifier === "*" ? "star" : quantifier === "?" ? "optional" : "one" });
    }
  }
  return tokens;
}
function epsilonClosure(states, tokens) {
  const closure = new Set(states);
  const pending = [...states];
  while (pending.length > 0) {
    const state = pending.pop();
    const token = tokens[state];
    if (token !== void 0 && token.repetition !== "one" && !closure.has(state + 1)) {
      closure.add(state + 1);
      pending.push(state + 1);
    }
  }
  return closure;
}
function deterministicRegexMatches(pattern, value) {
  const tokens = deterministicRegexTokens(pattern);
  let states = epsilonClosure(/* @__PURE__ */ new Set([0]), tokens);
  for (const character of [...value]) {
    const next = /* @__PURE__ */ new Set();
    for (const state of states) {
      const token = tokens[state];
      if (token === void 0 || !token.matches(character))
        continue;
      if (token.repetition === "star")
        next.add(state);
      else
        next.add(state + 1);
    }
    states = epsilonClosure(next, tokens);
    if (states.size === 0)
      return false;
  }
  return epsilonClosure(states, tokens).has(tokens.length);
}
function atomMatches(atom, actual) {
  const values = scalarValues(actual);
  switch (atom.matcher) {
    case "exists": {
      const exists = values.length > 0;
      return typeof atom.value === "boolean" ? exists === atom.value : exists;
    }
    case "equals":
      return values.some((value) => canonicalJson(value) === canonicalJson(atom.value));
    case "in": {
      const expected = atom.value;
      const expectedKeys = new Set(expected.map(canonicalJson));
      return values.some((value) => expectedKeys.has(canonicalJson(value)));
    }
    case "contains":
      return values.some((value) => typeof value === "string" && value.includes(atom.value));
    case "glob": {
      return values.some((value) => typeof value === "string" && matchesCanonicalGlob2(atom.value, value));
    }
    case "regex": {
      const pattern = atom.value;
      deterministicRegexTokens(pattern);
      return values.some((value) => typeof value === "string" && value.length <= 4096 && deterministicRegexMatches(pattern, value));
    }
    case "matches-structural-query":
      return values.some((value) => canonicalJson(value) === canonicalJson(atom.value));
  }
}
function evaluateSelector(selector, subject) {
  const normalized = normalizeSelector(selector);
  const matchedAtoms = [];
  const failedAtoms = [];
  const evaluate = (expression) => {
    if (expression.op === "all")
      return expression.items.every(evaluate);
    if (expression.op === "any")
      return expression.items.some(evaluate);
    if (expression.op === "not")
      return !evaluate(expression.item);
    const key = canonicalJson(expression);
    const matched2 = atomMatches(expression, subject.values[expression.field]);
    (matched2 ? matchedAtoms : failedAtoms).push(key);
    return matched2;
  };
  const matched = evaluate(normalized);
  const dependencyKeys = sortedUnique([
    ...subject.dependencyKeys,
    `selector:${selectorHash(normalized)}`,
    ...Object.keys(subject.values).map((field) => `selector-field:${subject.id}:${field}`)
  ]);
  return {
    matched,
    matchedAtoms: sortedUnique(matchedAtoms),
    failedAtoms: sortedUnique(failedAtoms),
    dependencyKeys,
    inputFingerprint: hashFramedDomain("selector-input", {
      subjectId: subject.id,
      values: subject.values,
      dependencyKeys
    })
  };
}
function evaluateSelectorMembership(selector, subjects, options) {
  const normalized = normalizeSelector(selector);
  const hash = selectorHash(normalized);
  const byId = /* @__PURE__ */ new Map();
  for (const subject of subjects) {
    if (byId.has(subject.id))
      throw new SelectorEvaluationError(`duplicate selector subject ${subject.id}`);
    byId.set(subject.id, subject);
  }
  const evaluations = [...byId.values()].map((subject) => ({ subject, evaluation: evaluateSelector(normalized, subject) }));
  const memberIds = evaluations.filter(({ evaluation }) => evaluation.matched).map(({ subject }) => subject.id).sort(compareStrings3);
  const dependencyKeys = sortedUnique(evaluations.flatMap(({ evaluation }) => evaluation.dependencyKeys));
  const assumptions = sortedUnique(options.assumptions ?? []);
  const unavailableLanes = sortedUnique(options.unavailableLanes ?? []);
  const proofCaveats = [];
  if (options.observability === "open" || options.observability === "sampled") {
    proofCaveats.push(`${options.observability} selector membership cannot prove absence`);
  }
  if (options.observability === "unavailable")
    proofCaveats.push("selector membership is unavailable");
  if (unavailableLanes.length > 0)
    proofCaveats.push(`unavailable selector lanes: ${unavailableLanes.join(", ")}`);
  if (assumptions.length > 0)
    proofCaveats.push("selector boundary depends on assumptions");
  return {
    selectorHash: hash,
    memberIds,
    dependencyKeys,
    membershipFingerprint: hashFramedDomain("selector-membership", {
      selectorHash: hash,
      members: memberIds,
      subjects: evaluations.map(({ subject, evaluation }) => ({ id: subject.id, inputFingerprint: evaluation.inputFingerprint, matched: evaluation.matched })).sort((left, right) => compareStrings3(left.id, right.id)),
      observability: options.observability,
      assumptions,
      unavailableLanes
    }),
    observability: options.observability,
    absenceProven: memberIds.length === 0 && proofCaveats.length === 0 && (options.observability === "closed" || options.observability === "bounded"),
    proofCaveats
  };
}
function lensAtomDependencies(atom, candidateLensIds) {
  if (atom.field !== "lens")
    return [];
  if (atom.matcher === "matches-structural-query") {
    throw new SelectorEvaluationError("matches-structural-query is unsupported for lens membership dependencies");
  }
  if (candidateLensIds.length === 0) {
    if (atom.matcher === "equals" && typeof atom.value === "string")
      return [atom.value];
    if (atom.matcher === "in" && Array.isArray(atom.value)) {
      return sortedUnique(atom.value.filter((item) => typeof item === "string"));
    }
    if (atom.matcher !== "exists") {
      throw new SelectorEvaluationError(`lens ${atom.matcher} dependency extraction requires the candidate lens universe`);
    }
  }
  if (atom.matcher === "exists")
    return sortedUnique(candidateLensIds);
  return sortedUnique(candidateLensIds.filter((lensId) => evaluateSelector(atom, {
    id: `lens-dependency:${lensId}`,
    values: { lens: [lensId] },
    dependencyKeys: []
  }).matched));
}
function selectorLensDependencies(selector, candidateLensIds = []) {
  const dependencies = [];
  const normalized = normalizeSelector(selector);
  const visit = (expression) => {
    if (expression.op === "all" || expression.op === "any")
      expression.items.forEach(visit);
    else if (expression.op === "not")
      visit(expression.item);
    else
      dependencies.push(...lensAtomDependencies(expression, candidateLensIds));
  };
  visit(normalized);
  return sortedUnique(dependencies);
}
function assertMonotonicLensSelector(selector, recursiveLensIds) {
  const candidates = sortedUnique(recursiveLensIds);
  const visit = (expression, negated) => {
    if (expression.op === "all" || expression.op === "any") {
      expression.items.forEach((item) => visit(item, negated));
    } else if (expression.op === "not") {
      visit(expression.item, !negated);
    } else if (expression.field === "lens") {
      const dependencies = lensAtomDependencies(expression, candidates);
      if (dependencies.length === 0)
        return;
      if (negated || expression.matcher === "exists" && expression.value === false) {
        throw new SelectorEvaluationError(`monotonic-union recursion requires positive lens dependencies; non-monotone atom reaches ${dependencies.join(", ")}`);
      }
    }
  };
  visit(normalizeSelector(selector), false);
}

// node_modules/@projector/engine/dist/architecture/evaluation.js
var compareStrings4 = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var sortedUnique2 = (values) => [...new Set(values)].sort(compareStrings4);
function captureDecisionStateBinding(input) {
  return createStateBinding({
    compiledAgainst: input.closure.boundState.compiledAgainst,
    valueDependencies: input.closure.boundState.valueDependencies,
    queryDependencies: [
      ...input.closure.boundState.queryDependencies,
      ...input.applicabilityQueries,
      ...input.negativeSpaceQueries
    ]
  });
}
async function assessDecisionValidity(input, ports) {
  const scope = normalizeSelector(input.currentScope);
  const firedTriggers = [...new Map(input.firedTriggers.map((trigger) => [canonicalJson(trigger), trigger])).entries()].sort(([left], [right]) => compareStrings4(left, right)).map(([, trigger]) => structuredClone(trigger));
  const invalidatedAssumptions = sortedUnique2(input.invalidatedAssumptions);
  const staleEvidenceIds = sortedUnique2(input.staleEvidenceIds);
  const applicability = await ports.applicability.evaluate({ decision: structuredClone(input.decision), scope, currentState: structuredClone(input.currentState), context: input.context });
  if (!Number.isInteger(applicability.governedPopulationCount) || applicability.governedPopulationCount < 0)
    throw new Error("governed population count must be a non-negative integer");
  if (applicability.dependency.role !== "decision-applicability" || applicability.dependency.query.kind !== "decision-applicability")
    throw new Error("applicability port returned a non-applicability dependency");
  const boundDependency = input.binding.queryDependencies.find(({ query, role }) => query.id === applicability.dependency.query.id && role === applicability.dependency.role);
  const applicabilityProofCurrent = boundDependency !== void 0 && canonicalJson(boundDependency) === canonicalJson(applicability.dependency);
  const bindingValidation = await ports.bindingValidator.validate(input.binding, input.currentState, input.context);
  const observationIncomplete = applicability.dependency.priorResult.observability !== "closed" || applicability.dependency.priorResult.unavailableLanes.length > 0;
  const bindingCurrent = bindingValidation.status === "current" || bindingValidation.status === "rebound";
  let state;
  let blocksCurrentChange;
  let explanation;
  if (!applicabilityProofCurrent || !bindingCurrent || observationIncomplete || !applicability.applicable && applicability.governedPopulationCount > 0) {
    state = "suspect";
    blocksCurrentChange = true;
    explanation = `decision ${input.decision.id} lost authenticated applicability or state-binding proof; reassessment may reaffirm the existing decision`;
  } else if (applicability.governedPopulationCount === 0 && !applicability.applicable) {
    state = "valid";
    blocksCurrentChange = false;
    explanation = `decision ${input.decision.id} remains valid outside the changed scope and was not reconsidered`;
  } else if (!applicability.applicable) {
    state = "valid";
    blocksCurrentChange = false;
    explanation = `decision ${input.decision.id} remains valid outside the changed scope and was not reconsidered`;
  } else if (invalidatedAssumptions.length > 0) {
    state = "contested";
    blocksCurrentChange = true;
    explanation = `decision ${input.decision.id} has invalidated assumptions and must be resolved for this scope`;
  } else if (firedTriggers.length > 0 || staleEvidenceIds.length > 0) {
    state = "suspect";
    blocksCurrentChange = true;
    explanation = `decision ${input.decision.id} lost proof for this scope; reassessment may reaffirm the existing decision`;
  } else {
    state = "valid";
    blocksCurrentChange = false;
    explanation = `decision ${input.decision.id} was not reconsidered because its scope and proof dependencies remain current`;
  }
  return DecisionValidityAssessmentSchema.parse({
    decisionId: input.decision.id,
    scope,
    state,
    firedTriggers,
    invalidatedAssumptions,
    staleEvidenceIds,
    blocksCurrentChange,
    explanation
  });
}
function normalizeOptions(options) {
  const byKey = /* @__PURE__ */ new Map();
  for (const option of options) {
    const normalized = DecisionOptionSchema.parse(structuredClone(option));
    const existing = byKey.get(normalized.key);
    if (existing !== void 0 && canonicalJson(existing) !== canonicalJson(normalized))
      throw new Error(`conflicting option ${normalized.key}`);
    byKey.set(normalized.key, normalized);
  }
  return [...byKey.values()].sort((left, right) => compareStrings4(left.key, right.key));
}
var preferenceScopeRank = { user: 0, organization: 1, project: 2 };
var preferenceStrength = { avoid: -1, prefer: 1, "strongly-prefer": 2 };
function authorityRecordHashIsValid(record) {
  return record.semanticHash === hashSemantic("authority-record", record);
}
function developerPreferenceHashIsValid(preference) {
  return preference.semanticHash === hashSemantic("developer-preference", preference);
}
async function evaluateDecisionOptions(input, ports) {
  const proposedOptions = normalizeOptions(input.options);
  let options = proposedOptions;
  let researchEvidenceIds = [];
  let researchUnavailable = false;
  let unknowns = [];
  if (input.research.required) {
    if (ports.research === void 0) {
      researchUnavailable = true;
      unknowns.push("required current option-set research is unavailable");
    } else {
      const researched = await ports.research.verifyOptionSet({
        concern: structuredClone(input.concern),
        candidateOptions: proposedOptions,
        affectedEvidenceIds: sortedUnique2(input.research.affectedEvidenceIds)
      });
      options = normalizeOptions(researched.options);
      researchEvidenceIds = sortedUnique2(researched.evidenceIds);
      researchUnavailable = researched.unavailable;
      unknowns.push(...researched.uncertainty);
    }
  }
  const eliminatedOptionKeys = options.filter(({ hardConstraintStatus }) => hardConstraintStatus === "fails").map(({ key }) => key);
  const uncertainOptions = options.filter(({ hardConstraintStatus }) => hardConstraintStatus === "unknown").map(({ key }) => key);
  unknowns.push(...uncertainOptions.map((key) => `option ${key} has unknown hard-constraint status`));
  const viable = options.filter(({ hardConstraintStatus }) => hardConstraintStatus === "passes");
  const activePreferences = [];
  const preferenceMatches = {};
  for (const preferenceId of sortedUnique2(input.preferenceIds)) {
    const loaded = await ports.preferences.read(preferenceId);
    if (loaded === void 0)
      throw new Error(`authenticated preference ${preferenceId} is unavailable`);
    const preference = DeveloperPreferenceSchema.parse(structuredClone(loaded));
    if (preference.id !== preferenceId || !developerPreferenceHashIsValid(preference))
      throw new Error(`preference ${preferenceId} failed semantic authentication`);
    if (preference.status !== "active")
      continue;
    activePreferences.push(preference);
    preferenceMatches[preference.id] = sortedUnique2(await ports.preferences.match({ preference: structuredClone(preference), concern: structuredClone(input.concern), options: structuredClone(options) }));
  }
  const maximumScopeRank = activePreferences.reduce((maximum, item) => Math.max(maximum, preferenceScopeRank[item.scope]), -1);
  const rankingPreferences = activePreferences.filter((item) => preferenceScopeRank[item.scope] === maximumScopeRank);
  const scores = new Map(viable.map(({ key }) => [key, 0]));
  const preferenceConflicts = [];
  for (const preference of rankingPreferences) {
    for (const optionKey of preferenceMatches[preference.id] ?? []) {
      if (!scores.has(optionKey))
        continue;
      scores.set(optionKey, scores.get(optionKey) + preferenceStrength[preference.strength]);
    }
  }
  for (const option of viable) {
    const influences = rankingPreferences.filter((preference) => (preferenceMatches[preference.id] ?? []).includes(option.key));
    if (influences.some(({ strength }) => strength === "avoid") && influences.some(({ strength }) => strength !== "avoid")) {
      preferenceConflicts.push(`conflicting ${influences[0]?.scope ?? "soft"} preferences remain visible for option ${option.key}`);
    }
  }
  const favoredOptionKeys = sortedUnique2(rankingPreferences.filter(({ strength }) => strength !== "avoid").flatMap((preference) => preferenceMatches[preference.id] ?? []).filter((key) => scores.has(key)));
  if (favoredOptionKeys.length > 1)
    preferenceConflicts.push(`conflicting ${rankingPreferences[0]?.scope ?? "soft"} preferences favor distinct viable options: ${favoredOptionKeys.join(", ")}`);
  const ranked = [...viable].sort((left, right) => scores.get(right.key) - scores.get(left.key) || compareStrings4(left.key, right.key));
  const recommendedOptionKey = ranked[0]?.key;
  let uncertaintyExceptionAuthorized = false;
  if (input.research.required && researchUnavailable && input.acceptance.kind === "explicit-user") {
    const record = await ports.authority.read(input.acceptance.authorityRecordId);
    uncertaintyExceptionAuthorized = record !== void 0 && record.id === input.acceptance.authorityRecordId && record.subjectId === input.concern.id && record.status === "approved" && record.conclusion === "exception" && record.decidedBy === "user" && authorityRecordHashIsValid(record);
  }
  const acceptanceBlocked = input.research.required && researchUnavailable && !uncertaintyExceptionAuthorized;
  const topScore = recommendedOptionKey === void 0 ? void 0 : scores.get(recommendedOptionKey);
  const tied = topScore === void 0 ? [] : ranked.filter(({ key }) => scores.get(key) === topScore);
  const outcome = acceptanceBlocked || recommendedOptionKey === void 0 ? "insufficient-evidence" : tied.length > 1 && preferenceConflicts.length > 0 ? "contested" : "recommended";
  const materiallyInfluential = recommendedOptionKey !== void 0 && (scores.get(recommendedOptionKey) ?? 0) !== 0 ? rankingPreferences.filter((preference) => (preferenceMatches[preference.id] ?? []).includes(recommendedOptionKey)) : [];
  const appliedPreferences = materiallyInfluential.map((preference) => ({
    key: preference.key,
    scope: preference.scope,
    semanticHash: preference.semanticHash,
    influence: `${preference.strength} changed the viable-option ranking toward ${recommendedOptionKey}`
  })).sort((left, right) => compareStrings4(canonicalJson(left), canonicalJson(right)));
  unknowns = sortedUnique2(unknowns);
  const preferenceSnapshotHash = hashFramedDomain("architecture-preference-snapshot", rankingPreferences.map(({ id, semanticHash: semanticHash2 }) => ({ id, semanticHash: semanticHash2 })).sort((left, right) => compareStrings4(left.id, right.id)));
  const stableEvaluation = {
    concernId: input.concern.id,
    scope: normalizeSelector(input.concern.scope),
    options,
    eliminatedOptionKeys,
    ...recommendedOptionKey === void 0 || acceptanceBlocked ? {} : { recommendedOptionKey },
    outcome,
    hardConstraints: [],
    preferenceSnapshotHash,
    researchEvidenceIds,
    unknowns
  };
  const semanticHash = hashFramedDomain("decision-evaluation", stableEvaluation);
  const evaluation = DecisionEvaluationSchema.parse({
    id: `decision-evaluation:${semanticHash.slice("sha256:v1:".length, "sha256:v1:".length + 24)}`,
    ...stableEvaluation,
    evaluatedAt: input.evaluatedAt ?? "deterministic",
    semanticHash
  });
  return { evaluation, acceptanceBlocked, appliedPreferences, preferenceConflicts: sortedUnique2(preferenceConflicts), governanceConsequences: [] };
}
function validateDecisionDeferral(deferral) {
  const parsed = DecisionDeferralSchema.safeParse(deferral);
  const reasons = [];
  if (!parsed.success)
    reasons.push("deferral does not satisfy the normative DecisionDeferral contract");
  if (deferral.rationale.trim().length === 0)
    reasons.push("deferral requires rationale");
  if (deferral.preserveOptionality.length === 0)
    reasons.push("deferral must state preserved optionality");
  if (deferral.forbiddenCommitments.length === 0)
    reasons.push("deferral must forbid irreversible commitments");
  if (deferral.reconsiderWhen.length === 0)
    reasons.push("deferral requires a deterministic reconsideration trigger");
  return { valid: reasons.length === 0, reasons };
}
async function assessDecisionDeferral(deferral, port) {
  const structural = validateDecisionDeferral(deferral);
  if (!structural.valid)
    return structural;
  const assessment = await port.assess(structuredClone(deferral));
  const reasons = [];
  if (!assessment.compatibilityPreserving)
    reasons.push("deferral has no compatibility-preserving path");
  if (!assessment.optionalityPreserved)
    reasons.push("deferral does not preserve stated optionality");
  if (assessment.secretlySelectsOption)
    reasons.push("deferral guardrail secretly selects an option and must be represented as a temporary decision");
  if (assessment.irreversibleCommitments.length > 0)
    reasons.push(`deferral permits irreversible commitments: ${sortedUnique2(assessment.irreversibleCommitments).join(", ")}`);
  return { valid: reasons.length === 0, reasons };
}

export {
  InMemoryGraphReader,
  UnknownQueryProgramError,
  QueryProgramVersionError,
  InvalidQuerySpecError,
  NonRebindableQueryError,
  BUILT_IN_QUERY_PROGRAM_IDS,
  IDENTITY_BOUNDARY_QUERY_PROGRAM_IDS,
  createTopologyRelevanceQueryPrograms,
  createIdentityBoundaryQueryPrograms,
  createBuiltInQueryDependency,
  QueryDependencyRegistry,
  createTopologyQueryBindingPort,
  createStateBinding,
  DependencyScopedStateBindingValidator,
  DependencyScopedCache,
  SelectorEvaluationError,
  projectionUnitSelectorSubject,
  normalizeSelector,
  selectorHash,
  matchesCanonicalGlob2 as matchesCanonicalGlob,
  evaluateSelector,
  evaluateSelectorMembership,
  selectorLensDependencies,
  assertMonotonicLensSelector,
  captureDecisionStateBinding,
  assessDecisionValidity,
  authorityRecordHashIsValid,
  developerPreferenceHashIsValid,
  evaluateDecisionOptions,
  validateDecisionDeferral,
  assessDecisionDeferral
};
