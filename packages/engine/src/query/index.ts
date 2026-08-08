import {
  canonicalJson,
  hashFramedDomain,
  type AdapterContext,
  type BehavioralScenario,
  type Concept,
  type ContentHash,
  type DerivationInput,
  type EntityId,
  type GraphReader,
  type ObservabilityClass,
  type ProjectionUnit,
  type Relation,
  type Requirement,
  type StateQueryKind,
  type StateQueryDependency,
  type StateQueryReader,
  type StateQueryResultFingerprint,
  type StateQuerySpec,
} from "@projector/core";

type SemanticIdentityKind = "concept" | "requirement" | "scenario";
type QueryResult = Record<string, unknown>;

export interface InMemoryDerivationInputs {
  unitId: EntityId;
  inputs: DerivationInput[];
}

export interface InMemoryReverseDerivation {
  subjectId: EntityId | string;
  dependentIds: EntityId[];
}

export interface InMemorySelectorMembership {
  selectorHash: ContentHash;
  memberIds: EntityId[];
}

export interface InMemoryGraphSnapshot {
  concepts?: readonly Concept[];
  requirements?: readonly Requirement[];
  behavioralScenarios?: readonly BehavioralScenario[];
  projectionUnits?: readonly ProjectionUnit[];
  relations?: readonly Relation[];
  derivationInputs?: readonly InMemoryDerivationInputs[];
  reverseDerivations?: readonly InMemoryReverseDerivation[];
  selectorMemberships?: readonly InMemorySelectorMembership[];
}

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sortedUniqueStrings = (values: readonly string[]): string[] => [...new Set(values)].sort(compareStrings);

function indexed<T extends { id: string }>(kind: string, values: readonly T[]): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    if (result.has(value.id)) throw new Error(`duplicate ${kind} stable ID ${value.id}`);
    result.set(value.id, structuredClone(value));
  }
  return result;
}

function indexedLists<T>(
  kind: string,
  values: readonly T[],
  keyOf: (value: T) => string,
  listOf: (value: T) => readonly string[],
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const value of values) {
    const key = keyOf(value);
    if (result.has(key)) throw new Error(`duplicate ${kind} key ${key}`);
    result.set(key, sortedUniqueStrings(listOf(value)));
  }
  return result;
}

/** A deterministic, bounded graph primitive for adapters, tests, and small repositories. */
export class InMemoryGraphReader implements GraphReader {
  private concepts = new Map<string, Concept>();
  private requirements = new Map<string, Requirement>();
  private scenarios = new Map<string, BehavioralScenario>();
  private units = new Map<string, ProjectionUnit>();
  private relations = new Map<string, Relation>();
  private inputs = new Map<string, DerivationInput[]>();
  private reverse = new Map<string, string[]>();
  private selectorMembers = new Map<string, string[]>();

  constructor(snapshot: InMemoryGraphSnapshot = {}) {
    this.replace(snapshot);
  }

  replace(snapshot: InMemoryGraphSnapshot): void {
    const concepts = indexed("concept", snapshot.concepts ?? []);
    const requirements = indexed("requirement", snapshot.requirements ?? []);
    const scenarios = indexed("behavioral scenario", snapshot.behavioralScenarios ?? []);
    const units = indexed("projection unit", snapshot.projectionUnits ?? []);
    const relations = indexed("relation", snapshot.relations ?? []);
    const entityIds = new Set<string>();
    for (const collection of [concepts, requirements, scenarios, units]) {
      for (const id of collection.keys()) {
        if (entityIds.has(id)) throw new Error(`duplicate graph stable ID ${id}`);
        entityIds.add(id);
      }
    }

    const inputs = new Map<string, DerivationInput[]>();
    for (const entry of snapshot.derivationInputs ?? []) {
      if (inputs.has(entry.unitId)) throw new Error(`duplicate derivation input key ${entry.unitId}`);
      inputs.set(
        entry.unitId,
        [...entry.inputs]
          .map((input) => structuredClone(input))
          .sort((left, right) => compareStrings(canonicalJson(left), canonicalJson(right))),
      );
    }

    this.concepts = concepts;
    this.requirements = requirements;
    this.scenarios = scenarios;
    this.units = units;
    this.relations = relations;
    this.inputs = inputs;
    this.reverse = indexedLists(
      "reverse derivation",
      snapshot.reverseDerivations ?? [],
      (entry) => entry.subjectId,
      (entry) => entry.dependentIds,
    );
    this.selectorMembers = indexedLists(
      "selector membership",
      snapshot.selectorMemberships ?? [],
      (entry) => entry.selectorHash,
      (entry) => entry.memberIds,
    );
  }

  getConcept(id: EntityId): Concept | undefined {
    return structuredClone(this.concepts.get(id));
  }

  getRequirement(id: EntityId): Requirement | undefined {
    return structuredClone(this.requirements.get(id));
  }

  getBehavioralScenario(id: EntityId): BehavioralScenario | undefined {
    return structuredClone(this.scenarios.get(id));
  }

  getProjectionUnit(id: EntityId): ProjectionUnit | undefined {
    return structuredClone(this.units.get(id));
  }

  getRelations(id: EntityId, direction: "in" | "out" | "both"): Relation[] {
    return [...this.relations.values()]
      .filter((item) =>
        direction === "in" ? item.toId === id : direction === "out" ? item.fromId === id : item.fromId === id || item.toId === id,
      )
      .sort((left, right) => compareStrings(left.id, right.id))
      .map((item) => structuredClone(item));
  }

  reverseDerivationDependents(subjectId: EntityId | string): EntityId[] {
    return [...(this.reverse.get(subjectId) ?? [])];
  }

  getDerivationInputs(unitId: EntityId): DerivationInput[] {
    return structuredClone(this.inputs.get(unitId) ?? []);
  }

  querySelectorDependencies(selectorHash: ContentHash): EntityId[] {
    return [...(this.selectorMembers.get(selectorHash) ?? [])];
  }

  searchSemanticIdentities(query: string, kinds: SemanticIdentityKind[] = ["concept", "requirement", "scenario"]): EntityId[] {
    const needle = query.trim().toLocaleLowerCase("en-US");
    if (needle.length === 0) return [];
    const matches: string[] = [];
    const includes = (values: readonly string[]): boolean => values.some((value) => value.toLocaleLowerCase("en-US").includes(needle));
    if (kinds.includes("concept")) {
      for (const item of this.concepts.values()) {
        if (includes([item.key, item.name, item.statement, ...item.aliases])) matches.push(item.id);
      }
    }
    if (kinds.includes("requirement")) {
      for (const item of this.requirements.values()) {
        if (includes([item.key, item.title, item.statement, ...item.aliases])) matches.push(item.id);
      }
    }
    if (kinds.includes("scenario")) {
      for (const item of this.scenarios.values()) {
        if (includes([item.key, item.title, ...item.aliases, ...item.steps.map(({ statement }) => statement)])) matches.push(item.id);
      }
    }
    return sortedUniqueStrings(matches);
  }
}

export interface QueryProgramResult {
  results: readonly QueryResult[];
  observability: ObservabilityClass;
  assumptions: readonly string[];
  unavailableLanes: readonly string[];
  dependencyKeys: readonly string[];
}

export interface RegisteredQueryProgram {
  id: string;
  version: string;
  kind: StateQueryKind;
  normalizeInput?(input: Readonly<Record<string, unknown>>): Record<string, unknown>;
  evaluate(args: { input: Readonly<Record<string, unknown>>; graph: GraphReader; context: AdapterContext }): QueryProgramResult | Promise<QueryProgramResult>;
}

export class UnknownQueryProgramError extends Error {
  constructor(programId: string) {
    super(`unknown registered query program ${programId}`);
    this.name = "UnknownQueryProgramError";
  }
}

export class QueryProgramVersionError extends Error {
  constructor(programId: string, expected: string, received: string) {
    super(`query program ${programId} version changed from ${received} to ${expected}`);
    this.name = "QueryProgramVersionError";
  }
}

export class InvalidQuerySpecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidQuerySpecError";
  }
}

const querySemanticHash = (query: Pick<StateQuerySpec, "kind" | "programId" | "programVersion" | "input">): ContentHash =>
  hashFramedDomain("state-query", {
    kind: query.kind,
    programId: query.programId,
    programVersion: query.programVersion,
    input: query.input,
  });

function requireString(input: Readonly<Record<string, unknown>>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.length === 0) throw new InvalidQuerySpecError(`query input ${key} must be a non-empty string`);
  return value;
}

function requireStringArray(input: Readonly<Record<string, unknown>>, key: string): string[] {
  const value = input[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new InvalidQuerySpecError(`query input ${key} must be an array of non-empty strings`);
  }
  return sortedUniqueStrings(value as string[]);
}

function optionalStringArray(input: Readonly<Record<string, unknown>>, key: string): string[] {
  return input[key] === undefined ? [] : requireStringArray(input, key);
}

function reverseClosure(graph: GraphReader, seedIds: readonly string[], excludedIds: readonly string[] = []): string[] {
  const seen = new Set<string>();
  const excluded = new Set(excludedIds);
  const pending = [...seedIds].sort(compareStrings);
  while (pending.length > 0) {
    const current = pending.shift()!;
    for (const dependent of graph.reverseDerivationDependents(current).slice().sort(compareStrings)) {
      if (excluded.has(dependent) || seen.has(dependent)) continue;
      seen.add(dependent);
      pending.push(dependent);
      pending.sort(compareStrings);
    }
  }
  return sortedUniqueStrings([...seen]);
}

function requireBoolean(input: Readonly<Record<string, unknown>>, key: string): boolean {
  const value = input[key];
  if (typeof value !== "boolean") throw new InvalidQuerySpecError(`query input ${key} must be a boolean`);
  return value;
}

function requireObservability(input: Readonly<Record<string, unknown>>): ObservabilityClass {
  const value = input.observability;
  if (!["closed", "bounded", "sampled", "open", "unavailable"].includes(String(value))) {
    throw new InvalidQuerySpecError("query input observability is invalid");
  }
  return value as ObservabilityClass;
}

function observationMetadata(input: Readonly<Record<string, unknown>>): Omit<QueryProgramResult, "results"> {
  return {
    observability: requireObservability(input),
    assumptions: requireStringArray(input, "assumptions"),
    unavailableLanes: requireStringArray(input, "unavailableLanes"),
    dependencyKeys: requireStringArray(input, "dependencyKeys"),
  };
}

function normalizeObservationInput(input: Readonly<Record<string, unknown>>, arrays: readonly string[]): Record<string, unknown> {
  return {
    ...structuredClone(input),
    ...Object.fromEntries(arrays.map((key) => [key, requireStringArray(input, key)])),
    observability: requireObservability(input),
    assumptions: requireStringArray(input, "assumptions"),
    unavailableLanes: requireStringArray(input, "unavailableLanes"),
    dependencyKeys: requireStringArray(input, "dependencyKeys"),
  };
}

export class NonRebindableQueryError extends UnknownQueryProgramError {
  constructor(programId: string) {
    super(programId);
    this.message = `query program ${programId} has an explicit non-rebindable observation contract`;
    this.name = "NonRebindableQueryError";
  }
}

function idResults(ids: readonly string[], disposition?: string): QueryResult[] {
  return sortedUniqueStrings(ids).map((id) => ({
    id,
    ...(disposition === undefined ? {} : { disposition }),
  }));
}

export const BUILT_IN_QUERY_PROGRAM_IDS = Object.freeze({
  eventTopologyRelevance: "projector.topology.event-relevance",
  contractTopologyRelevance: "projector.topology.contract-relevance",
  exactReverseDerivation: "invalidation.exact-reverse-derivation",
  transitiveReverseDerivation: "invalidation.transitive-reverse-derivation",
  impactRuleSelectorMembership: "invalidation.impact-rule-selector-membership",
  impactRuleApplicability: "invalidation.impact-rule-applicability",
  impactRuleReverseTraversal: "invalidation.impact-rule-reverse-traversal",
  impactRuleEnumeration: "invalidation.impact-rule-enumeration",
} as const);

/** Canonical IDs for host-registered identity boundary programs; these are deliberately not generic built-ins. */
export const IDENTITY_BOUNDARY_QUERY_PROGRAM_IDS = Object.freeze({
  exact: "identity.exact-search",
  alias: "identity.alias-search",
  lineage: "identity.lineage",
  tombstone: "identity.tombstone",
  relations: "identity.relations",
  topology: "identity.topology",
} as const);

export interface TopologyRelevanceQueryStatePort {
  inspect(subjectId: string, subjectKind: "event" | "contract", context: AdapterContext): QueryProgramResult | Promise<QueryProgramResult>;
}

export function createTopologyRelevanceQueryPrograms(port: TopologyRelevanceQueryStatePort): RegisteredQueryProgram[] {
  const create = (subjectKind: "event" | "contract"): RegisteredQueryProgram => ({
    id: subjectKind === "event" ? BUILT_IN_QUERY_PROGRAM_IDS.eventTopologyRelevance : BUILT_IN_QUERY_PROGRAM_IDS.contractTopologyRelevance,
    version: "1",
    kind: subjectKind === "event" ? "event-topology" : "contract-topology",
    normalizeInput: (input) => ({ subjectId: requireString(input, "subjectId") }),
    evaluate: ({ input, context }) => port.inspect(requireString(input, "subjectId"), subjectKind, context),
  });
  return [create("event"), create("contract")];
}

export type IdentityBoundaryLane = "exact" | "alias" | "lineage" | "tombstone" | "relations" | "topology";

export interface IdentityBoundaryQueryStatePort {
  inspect(
    lane: IdentityBoundaryLane,
    input: { requestedMeaning: string; requestedKind: "concept" | "requirement" | "scenario" | "unknown" },
    context: AdapterContext,
  ): QueryProgramResult | Promise<QueryProgramResult>;
}

const identityBoundaryDefinitions = [
  ["exact", IDENTITY_BOUNDARY_QUERY_PROGRAM_IDS.exact, "semantic-identity-search"],
  ["alias", IDENTITY_BOUNDARY_QUERY_PROGRAM_IDS.alias, "semantic-identity-search"],
  ["lineage", IDENTITY_BOUNDARY_QUERY_PROGRAM_IDS.lineage, "custom"],
  ["tombstone", IDENTITY_BOUNDARY_QUERY_PROGRAM_IDS.tombstone, "custom"],
  ["relations", IDENTITY_BOUNDARY_QUERY_PROGRAM_IDS.relations, "relation-neighborhood"],
  ["topology", IDENTITY_BOUNDARY_QUERY_PROGRAM_IDS.topology, "custom"],
] as const satisfies readonly [IdentityBoundaryLane, string, StateQueryKind][];

/**
 * Registers host-authoritative identity lanes. GraphReader cannot truthfully replay
 * aliases, lineage, tombstones, relations, and topology through one text search,
 * so none of these programs are installed as generic graph built-ins.
 */
export function createIdentityBoundaryQueryPrograms(port: IdentityBoundaryQueryStatePort): RegisteredQueryProgram[] {
  const normalize = (input: Readonly<Record<string, unknown>>) => {
    const requestedMeaning = requireString(input, "requestedMeaning").normalize("NFKC").trim();
    const requestedKind = requireString(input, "requestedKind");
    if (!["concept", "requirement", "scenario", "unknown"].includes(requestedKind)) {
      throw new InvalidQuerySpecError("identity requestedKind is invalid");
    }
    return { requestedMeaning, requestedKind: requestedKind as "concept" | "requirement" | "scenario" | "unknown" };
  };
  return identityBoundaryDefinitions.map(([lane, id, kind]) => ({
    id,
    version: "2",
    kind,
    normalizeInput: normalize,
    evaluate: ({ input, context }) => port.inspect(lane, normalize(input), context),
  }));
}

function impactTraversalProgram(
  id: typeof BUILT_IN_QUERY_PROGRAM_IDS.impactRuleReverseTraversal | typeof BUILT_IN_QUERY_PROGRAM_IDS.impactRuleEnumeration,
  kind: "reverse-derivation" | "surface-enumeration",
): RegisteredQueryProgram {
  return {
    id,
    version: "1",
    kind,
    normalizeInput: (input) => ({
      ...normalizeObservationInput(input, ["seedIds", "excludedIds"]),
      rebindable: requireBoolean(input, "rebindable"),
    }),
    evaluate: ({ input, graph }) => {
      if (!requireBoolean(input, "rebindable")) throw new NonRebindableQueryError(id);
      return {
        results: idResults(
          reverseClosure(graph, requireStringArray(input, "seedIds"), requireStringArray(input, "excludedIds")),
          "known",
        ),
        ...observationMetadata(input),
      };
    },
  };
}

function builtInPrograms(): RegisteredQueryProgram[] {
  return [
    {
      id: "graph.semantic-identity-search",
      version: "1",
      kind: "semantic-identity-search",
      normalizeInput: (input) => {
        const query = requireString(input, "query");
        const kinds = input.kinds;
        if (kinds !== undefined && (!Array.isArray(kinds) || kinds.some((kind) => !["concept", "requirement", "scenario"].includes(String(kind))))) {
          throw new InvalidQuerySpecError("semantic identity kinds must contain only concept, requirement, or scenario");
        }
        return {
          query,
          ...(kinds === undefined ? {} : { kinds: sortedUniqueStrings(kinds as string[]) }),
        };
      },
      evaluate: ({ input, graph }) => {
        const query = requireString(input, "query");
        const kindsValue = input.kinds;
        const kinds = kindsValue === undefined ? undefined : kindsValue;
        if (kinds !== undefined && (!Array.isArray(kinds) || kinds.some((kind) => !["concept", "requirement", "scenario"].includes(String(kind))))) {
          throw new InvalidQuerySpecError("semantic identity kinds must contain only concept, requirement, or scenario");
        }
        const normalizedKinds = kinds === undefined ? undefined : sortedUniqueStrings(kinds as string[]) as SemanticIdentityKind[];
        return {
          results: graph.searchSemanticIdentities(query, normalizedKinds).map((id) => ({ id })),
          observability: "closed",
          assumptions: [],
          unavailableLanes: [],
          dependencyKeys: ["semantic-identities"],
        };
      },
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
            semanticHash,
          })),
          observability: "closed",
          assumptions: [],
          unavailableLanes: [],
          dependencyKeys: [`relations:${direction}:${entityId}`],
        };
      },
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
          dependencyKeys: [`reverse-derivations:${subjectId}`],
        };
      },
    },
    {
      id: "graph.selector-membership",
      version: "1",
      kind: "selector-membership",
      evaluate: ({ input, graph }) => {
        const selectorHash = requireString(input, "selectorHash") as ContentHash;
        return {
          results: graph.querySelectorDependencies(selectorHash).map((id) => ({ id })),
          observability: "closed",
          assumptions: [],
          unavailableLanes: [],
          dependencyKeys: [`selector-membership:${selectorHash}`],
        };
      },
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
          dependencyKeys: [`reverse-derivations:${subjectId}`],
        };
      },
    },
    {
      id: BUILT_IN_QUERY_PROGRAM_IDS.transitiveReverseDerivation,
      version: "1",
      kind: "reverse-derivation",
      normalizeInput: (input) => ({
        ...structuredClone(input),
        seedIds: requireStringArray(input, "seedIds"),
        excludedIds: optionalStringArray(input, "excludedIds"),
      }),
      evaluate: ({ input, graph }) => {
        const seedIds = requireStringArray(input, "seedIds");
        const excludedIds = requireStringArray(input, "excludedIds");
        return {
          results: idResults(reverseClosure(graph, seedIds, excludedIds)),
          observability: "closed",
          assumptions: [],
          unavailableLanes: [],
          dependencyKeys: seedIds.map((id) => `reverse-derivations:${id}`),
        };
      },
    },
    {
      id: BUILT_IN_QUERY_PROGRAM_IDS.impactRuleSelectorMembership,
      version: "1",
      kind: "selector-membership",
      normalizeInput: (input) => ({
        ...normalizeObservationInput(input, ["historicalMemberIds"]),
        selectorHash: requireString(input, "selectorHash"),
        phase: requireString(input, "phase"),
      }),
      evaluate: ({ input, graph }) => {
        const selectorHash = requireString(input, "selectorHash") as ContentHash;
        const phase = requireString(input, "phase");
        if (phase !== "before" && phase !== "after") throw new InvalidQuerySpecError("membership phase must be before or after");
        const memberIds = phase === "before"
          ? requireStringArray(input, "historicalMemberIds")
          : graph.querySelectorDependencies(selectorHash);
        return {
          results: idResults(memberIds),
          ...observationMetadata(input),
        };
      },
    },
    {
      id: BUILT_IN_QUERY_PROGRAM_IDS.impactRuleApplicability,
      version: "1",
      kind: "impact-rule-applicability",
      normalizeInput: (input) => ({
        ...normalizeObservationInput(input, ["beforeMemberIds"]),
        selectorHash: requireString(input, "selectorHash"),
      }),
      evaluate: ({ input, graph }) => {
        const selectorHash = requireString(input, "selectorHash") as ContentHash;
        const ids = sortedUniqueStrings([
          ...requireStringArray(input, "beforeMemberIds"),
          ...graph.querySelectorDependencies(selectorHash),
        ]);
        return {
          results: idResults(ids),
          ...observationMetadata(input),
        };
      },
    },
    impactTraversalProgram(BUILT_IN_QUERY_PROGRAM_IDS.impactRuleReverseTraversal, "reverse-derivation"),
    impactTraversalProgram(BUILT_IN_QUERY_PROGRAM_IDS.impactRuleEnumeration, "surface-enumeration"),
  ];
}

export interface CreateQuerySpecInput {
  id: string;
  programId: string;
  input: Record<string, unknown>;
}

function normalizeProgramResult(programId: string, queryHash: ContentHash, raw: QueryProgramResult): StateQueryResultFingerprint {
  const normalizedById = new Map<string, { json: string; result: QueryResult }>();
  for (const result of raw.results) {
    if (typeof result !== "object" || result === null || Array.isArray(result) || typeof result.id !== "string" || result.id.length === 0) {
      throw new Error(`query program ${programId} returned a result without a stable id`);
    }
    const json = canonicalJson(result);
    const existing = normalizedById.get(result.id);
    if (existing !== undefined && existing.json !== json) {
      throw new Error(`query program ${programId} returned conflicting projections for stable id ${result.id}`);
    }
    normalizedById.set(result.id, { json, result: structuredClone(result) });
  }
  const normalizedResults = [...normalizedById.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([, { result }]) => result);
  const dependencyKeys = sortedUniqueStrings(raw.dependencyKeys);
  if (dependencyKeys.length === 0) throw new Error(`query program ${programId} returned no dependency keys`);
  return {
    queryHash,
    resultHash: hashFramedDomain("state-query-result", normalizedResults),
    resultCount: normalizedResults.length,
    observability: raw.observability,
    assumptions: sortedUniqueStrings(raw.assumptions),
    unavailableLanes: sortedUniqueStrings(raw.unavailableLanes),
    dependencyKeys,
  };
}

export function createBuiltInQueryDependency(input: CreateQuerySpecInput & {
  role: string;
  observed: QueryProgramResult;
}): StateQueryDependency {
  const program = builtInPrograms().find(({ id }) => id === input.programId);
  if (program === undefined) throw new UnknownQueryProgramError(input.programId);
  const normalizedInput = program.normalizeInput?.(structuredClone(input.input)) ?? structuredClone(input.input);
  const basis = { kind: program.kind, programId: program.id, programVersion: program.version, input: normalizedInput };
  const semanticHash = querySemanticHash(basis);
  return {
    query: { id: input.id, ...basis, semanticHash },
    priorResult: normalizeProgramResult(program.id, semanticHash, input.observed),
    role: input.role,
  };
}

/** Registry is intentionally data-only at the query boundary: inputs are normalized serializable records, never executable payloads. */
export class QueryDependencyRegistry implements StateQueryReader {
  private readonly programs = new Map<string, RegisteredQueryProgram>();
  private readonly versionHistory = new Map<string, Set<string>>();

  constructor(private readonly graph: GraphReader, includeBuiltIns = true) {
    if (includeBuiltIns) for (const program of builtInPrograms()) this.register(program);
  }

  register(program: RegisteredQueryProgram): void {
    if (program.id.length === 0 || program.version.length === 0) throw new Error("query program ID and version must be non-empty");
    const history = this.versionHistory.get(program.id) ?? new Set<string>();
    if (history.has(program.version)) {
      throw new Error(`query program ${program.id} version ${program.version} was previously registered; version identifiers cannot be rebound`);
    }
    this.programs.set(program.id, Object.freeze({ ...program }));
    history.add(program.version);
    this.versionHistory.set(program.id, history);
  }

  createSpec(input: CreateQuerySpecInput): StateQuerySpec {
    const program = this.programs.get(input.programId);
    if (program === undefined) throw new UnknownQueryProgramError(input.programId);
    canonicalJson(input.input);
    const normalizedInput = program.normalizeInput?.(structuredClone(input.input)) ?? structuredClone(input.input);
    canonicalJson(normalizedInput);
    const basis = {
      kind: program.kind,
      programId: program.id,
      programVersion: program.version,
      input: normalizedInput,
    };
    return { id: input.id, ...basis, semanticHash: querySemanticHash(basis) };
  }

  assertCurrent(query: StateQuerySpec): void {
    const program = this.programs.get(query.programId);
    if (program === undefined) throw new UnknownQueryProgramError(query.programId);
    if (program.version !== query.programVersion) throw new QueryProgramVersionError(program.id, program.version, query.programVersion);
    if (program.kind !== query.kind) throw new InvalidQuerySpecError(`query kind ${query.kind} does not match program kind ${program.kind}`);
    const normalizedInput = program.normalizeInput?.(structuredClone(query.input)) ?? structuredClone(query.input);
    if (canonicalJson(normalizedInput) !== canonicalJson(query.input) || querySemanticHash({ ...query, input: normalizedInput }) !== query.semanticHash) {
      throw new InvalidQuerySpecError("query semantic hash does not match program and normalized input");
    }
  }

  async evaluate(query: StateQuerySpec, context: AdapterContext): Promise<StateQueryResultFingerprint> {
    this.assertCurrent(query);
    const program = this.programs.get(query.programId)!;
    const expectedHash = querySemanticHash(query);
    const raw = await program.evaluate({ input: structuredClone(query.input), graph: this.graph, context });
    return normalizeProgramResult(program.id, expectedHash, raw);
  }
}

export function createTopologyQueryBindingPort(registry: QueryDependencyRegistry): {
  bind(subjectId: string, subjectKind: "event" | "contract", context: AdapterContext): Promise<StateQueryDependency>;
} {
  return {
    bind: async (subjectId, subjectKind, context) => {
      const programId = subjectKind === "event"
        ? BUILT_IN_QUERY_PROGRAM_IDS.eventTopologyRelevance
        : BUILT_IN_QUERY_PROGRAM_IDS.contractTopologyRelevance;
      const query = registry.createSpec({ id: `topology-consumers:${subjectId}`, programId, input: { subjectId } });
      return {
        query,
        priorResult: await registry.evaluate(query, context),
        role: `known ${subjectKind} consumers and negative space for ${subjectId}`,
      };
    },
  };
}
