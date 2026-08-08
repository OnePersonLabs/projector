import {
  canonicalJson,
  hashFramedDomain,
  type BehavioralScenarioStep,
  type ContentHash,
  type EntityId,
  type PreservationDimension,
  type RepresentationProjection,
  type SemanticPreservationFingerprint,
  type SemanticRepresentationProfile,
  type StateBinding,
  type ValidationResult,
} from "@projector/core";
import { createStateBinding } from "../state/index.js";

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare);

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export interface CanonicalRepresentationStatement {
  readonly id: EntityId;
  readonly text: string;
  readonly normativeForce: "require" | "forbid" | "prefer" | "permit";
  readonly negated: boolean;
  readonly scope: readonly string[];
  readonly cardinality?: "exactly-one" | "one-or-more" | "at-most-one" | "all" | "none";
  readonly connective?: "and" | "or" | "implies" | "iff";
  readonly guard?: string;
  readonly exceptions: readonly string[];
  readonly dependencies: readonly string[];
  readonly conceptIds: readonly EntityId[];
  readonly protectedLiterals: readonly string[];
}

export interface CanonicalRepresentationSource {
  readonly sourceEntityIds: readonly EntityId[];
  readonly sourceSemanticHash: ContentHash;
  readonly statements: readonly CanonicalRepresentationStatement[];
  readonly scenarios: ReadonlyArray<{ readonly id: EntityId; readonly title: string; readonly steps: readonly BehavioralScenarioStep[] }>;
}

export interface RepresentationArtifactStore {
  put(contentHash: ContentHash, content: string): Promise<void>;
  get(contentHash: ContentHash): Promise<string | undefined>;
}

export interface TokenMeasurementPort {
  readonly profileId: string;
  measure(content: string): number;
}

const ALL_DIMENSIONS: PreservationDimension[] = [
  "normative-force", "negation", "scope", "quantifier-cardinality", "logical-connective",
  "condition-guard", "exception", "dependency-order", "behavior-step-role", "concept-identity", "identifier-literal",
];

function profile(key: string, target: SemanticRepresentationProfile["target"], optimization: SemanticRepresentationProfile["optimization"]): SemanticRepresentationProfile {
  const value = {
    id: `profile:${key.slice(0, key.lastIndexOf("@"))}`,
    key: key.slice(0, key.lastIndexOf("@")),
    version: key.slice(key.lastIndexOf("@") + 1),
    status: "active" as const,
    target,
    selector: { op: "all" as const, items: [] },
    optimization,
    protectedDimensions: ALL_DIMENSIONS,
    styleRules: [{ key: "literal-preservation", kind: "literal-preservation" as const, parameters: {}, blocking: true }],
    generatorId: `${key}:generator`,
    validatorIds: [`${key}:fidelity`],
    ...(target === "agent-context" ? { tokenizerProfileId: "injected", fallbackProfileId: "profile:human-technical" } : {}),
  };
  return { ...value, semanticHash: hashFramedDomain("semantic-representation-profile", value) };
}

export const BUILT_IN_REPRESENTATION_PROFILES = Object.freeze({
  "human-technical@1": profile("human-technical@1", "human-technical", "clarity-first"),
  "behavior-gherkin@1": profile("behavior-gherkin@1", "behavior-spec", "clarity-first"),
  "agent-compact@1": profile("agent-compact@1", "agent-context", "token-first"),
  "machine-invariant@1": profile("machine-invariant@1", "machine-invariant", "machine-first"),
});
export type BuiltInRepresentationProfileKey = keyof typeof BUILT_IN_REPRESENTATION_PROFILES;

export interface HumanTechnicalLintFinding { readonly rule: string; readonly count: number }
export interface HumanTechnicalLintReport {
  readonly blocking: HumanTechnicalLintFinding[];
  readonly advisory: HumanTechnicalLintFinding[];
  readonly wordCount: number;
  readonly semanticEquivalenceEstablished: false;
  readonly truthEstablished: false;
}

/** Mechanical style signals only; this deliberately makes no semantic or truth claim. */
export function lintHumanTechnical(content: string): HumanTechnicalLintReport {
  const count = (pattern: RegExp): number => [...content.matchAll(pattern)].length;
  const rules: Array<[string, RegExp]> = [
    ["contraction", /\b(?:we|you|they|it|that|there|who)'(?:ll|re|ve|d|s)|\b(?:do|does|did|is|are|was|were|can|could|should|would|must)n't\b/giu],
    ["marketing-language", /\b(?:amazing|revolutionary|best-in-class|world-class)\b/giu],
    ["modal-filler", /\b(?:obviously|simply|clearly|very clear)\b/giu],
    ["semicolon", /;/gu],
    ["verbose-wording", /\b(?:utilize|in order to|due to the fact that)\b/giu],
  ];
  const blocking = rules.map(([rule, pattern]) => ({ rule, count: count(pattern) })).filter(({ count: occurrences }) => occurrences > 0);
  const longSentences = content.split(/[.!?]+/u).filter((sentence) => sentence.trim().split(/\s+/u).filter(Boolean).length > 25).length;
  return {
    blocking,
    advisory: longSentences === 0 ? [] : [{ rule: "sentence-length", count: longSentences }],
    wordCount: content.trim() === "" ? 0 : content.trim().split(/\s+/u).length,
    semanticEquivalenceEstablished: false, truthEstablished: false,
  };
}

function normalizedSource(source: CanonicalRepresentationSource): CanonicalRepresentationSource {
  const statementIds = new Set(source.statements.map(({ id }) => id));
  const crossKindCollision = source.scenarios.find(({ id }) => statementIds.has(id));
  if (crossKindCollision !== undefined) {
    throw new TypeError(`cross-kind canonical source identity collision: ${crossKindCollision.id}`);
  }
  if (new Set(source.sourceEntityIds).size !== source.sourceEntityIds.length) {
    throw new TypeError("duplicate source membership is not permitted");
  }
  const statementById = new Map<EntityId, CanonicalRepresentationStatement>();
  for (const statement of source.statements) {
    const prior = statementById.get(statement.id);
    if (prior !== undefined && canonicalJson(prior) !== canonicalJson(statement)) {
      throw new TypeError(`conflicting canonical representation source statement: ${statement.id}`);
    }
    statementById.set(statement.id, statement);
  }
  const scenarioById = new Map<EntityId, CanonicalRepresentationSource["scenarios"][number]>();
  for (const scenario of source.scenarios) {
    const prior = scenarioById.get(scenario.id);
    if (prior !== undefined && canonicalJson(prior) !== canonicalJson(scenario)) {
      throw new TypeError(`conflicting canonical representation source scenario: ${scenario.id}`);
    }
    scenarioById.set(scenario.id, scenario);
  }
  const statements = [...statementById.values()].map((statement) => ({
      ...structuredClone(statement), scope: unique(statement.scope), exceptions: unique(statement.exceptions),
      conceptIds: unique(statement.conceptIds), protectedLiterals: unique(statement.protectedLiterals),
    })).sort((a, b) => compare(a.id, b.id));
  const scenarios = [...scenarioById.values()].map((scenario) => structuredClone(scenario)).sort((a, b) => compare(a.id, b.id));
  const derivedIds = unique([...statements.map(({ id }) => id), ...scenarios.map(({ id }) => id)]);
  const suppliedIds = [...source.sourceEntityIds].sort(compare);
  if (canonicalJson(derivedIds) !== canonicalJson(suppliedIds)) {
    throw new TypeError("source membership must exactly match canonical statements and scenarios");
  }
  const sourceSemanticHash = hashFramedDomain("canonical-representation-source", {
    sourceEntityIds: derivedIds, statements, scenarios,
  });
  if (source.sourceSemanticHash !== sourceSemanticHash) {
    throw new TypeError("source semantic hash does not authenticate canonical structured input");
  }
  return {
    sourceEntityIds: derivedIds,
    sourceSemanticHash,
    statements,
    scenarios,
  };
}

function entitySemanticHash(source: CanonicalRepresentationSource, id: EntityId): ContentHash {
  const entity = source.statements.find((item) => item.id === id) ?? source.scenarios.find((item) => item.id === id);
  if (entity === undefined) throw new TypeError(`canonical source member is missing: ${id}`);
  return hashFramedDomain("canonical-representation-entity", entity);
}

function typedSourceMembers(source: CanonicalRepresentationSource): Array<{
  readonly kind: "statement" | "scenario"; readonly id: EntityId; readonly semanticHash: ContentHash;
}> {
  return [
    ...source.statements.map(({ id }) => ({ kind: "statement" as const, id, semanticHash: entitySemanticHash(source, id) })),
    ...source.scenarios.map(({ id }) => ({ kind: "scenario" as const, id, semanticHash: entitySemanticHash(source, id) })),
  ].sort((left, right) => compare(`${left.kind}:${left.id}`, `${right.kind}:${right.id}`));
}

function dimensionValue(source: Pick<CanonicalRepresentationSource, "statements" | "scenarios">, dimension: PreservationDimension): unknown {
  switch (dimension) {
    case "normative-force": return source.statements.map(({ id, normativeForce }) => ({ id, normativeForce }));
    case "negation": return source.statements.map(({ id, negated }) => ({ id, negated }));
    case "scope": return source.statements.map(({ id, scope }) => ({ id, scope }));
    case "quantifier-cardinality": return source.statements.map(({ id, cardinality }) => ({ id, cardinality: cardinality ?? null }));
    case "logical-connective": return source.statements.map(({ id, connective }) => ({ id, connective: connective ?? null }));
    case "condition-guard": return source.statements.map(({ id, guard }) => ({ id, guard: guard ?? null }));
    case "exception": return source.statements.map(({ id, exceptions }) => ({ id, exceptions }));
    case "dependency-order": return source.statements.map(({ id, dependencies }) => ({ id, dependencies }));
    case "behavior-step-role": return source.scenarios.map(({ id, steps }) => ({ id, steps }));
    case "concept-identity": return source.statements.map(({ id, conceptIds }) => ({ id, conceptIds }));
    case "identifier-literal": return source.statements.map(({ id, protectedLiterals }) => ({ id, protectedLiterals }));
  }
}

function fingerprint(source: CanonicalRepresentationSource, selected: SemanticRepresentationProfile): SemanticPreservationFingerprint {
  const dimensionHashes = Object.fromEntries(ALL_DIMENSIONS.map((dimension) => [dimension,
    hashFramedDomain(`representation-dimension:${dimension}`, dimensionValue(source, dimension))]));
  const dimensionAssurance = Object.fromEntries(ALL_DIMENSIONS.map((dimension) => [dimension, "exact"]));
  const base = {
    sourceSemanticHash: source.sourceSemanticHash, profileId: selected.id, profileVersion: selected.version,
    protectedDimensions: ALL_DIMENSIONS, dimensionHashes, dimensionAssurance,
    unsupportedDimensions: [], assurance: "exact" as const, evidenceIds: [],
  };
  return { ...base, semanticHash: hashFramedDomain("semantic-preservation-fingerprint", base) };
}

function kernel(statement: CanonicalRepresentationStatement): Record<string, unknown> {
  return {
    id: statement.id, force: statement.normativeForce, negated: statement.negated, scope: statement.scope,
    cardinality: statement.cardinality ?? null, connective: statement.connective ?? null, guard: statement.guard ?? null,
    exceptions: statement.exceptions, dependencyOrder: statement.dependencies, concepts: statement.conceptIds,
    literals: statement.protectedLiterals,
  };
}

function render(source: CanonicalRepresentationSource, key: BuiltInRepresentationProfileKey): string {
  if (key === "machine-invariant@1") {
    return canonicalJson({ apiVersion: "projector.dev/representation/v1", kind: "MachineInvariant", sourceIds: source.sourceEntityIds, statements: source.statements.map(kernel), scenarios: source.scenarios });
  }
  if (key === "behavior-gherkin@1") {
    const scenarios = source.scenarios.map((scenario) => {
      const keywords: Record<BehavioralScenarioStep["role"], string> = { precondition: "Given", trigger: "When", "expected-outcome": "Then", "forbidden-outcome": "But" };
      return [`# source: ${scenario.id}`, `Scenario: ${scenario.title}`, ...scenario.steps.map((step) => `  ${keywords[step.role]} ${step.statement}`)].join("\n");
    }).join("\n\n");
    return `${scenarios}\n\n# invariant-kernel: ${canonicalJson(source.statements.map(kernel))}`;
  }
  if (key === "agent-compact@1") {
    const statements = source.statements.map((statement) => [
      `${statement.normativeForce === "forbid" ? "FORBID" : statement.normativeForce.toUpperCase()}${statement.negated ? " NOT" : ""} ${statement.id}`,
      statement.cardinality?.toUpperCase(), statement.connective?.toUpperCase(),
      statement.guard ? `IF ${statement.guard}` : undefined,
      statement.exceptions.length ? `EXCEPT ${statement.exceptions.join(", ")}` : undefined,
      statement.dependencies.length ? `ORDER ${statement.dependencies.join(" > ")}` : undefined,
      statement.scope.length ? `SCOPE ${statement.scope.join(", ")}` : undefined,
      statement.conceptIds.length ? `CONCEPTS ${statement.conceptIds.join(", ")}` : undefined,
      ...statement.protectedLiterals,
    ].filter(Boolean).join(" | ")).join("\n");
    const scenarios = source.scenarios.map((scenario) => `SCENARIO ${scenario.id} | TITLE ${JSON.stringify(scenario.title)} | ${scenario.steps
      .map((step) => `${step.role.toUpperCase()}: ${step.statement}`).join(" | ")}`).join("\n");
    return [statements, scenarios].filter(Boolean).join("\n");
  }
  return `${source.statements.map((statement) => `Advisory text: ${JSON.stringify(statement.text)}\nSemantic kernel: ${canonicalJson(kernel(statement))}`).join("\n\n")}\n\nBehavioral scenarios: ${canonicalJson(source.scenarios)}`;
}

function renderLessAggressiveCompact(source: CanonicalRepresentationSource): string {
  return [
    ...source.statements.map((statement) => `STATEMENT ${canonicalJson(kernel(statement))}`),
    ...source.scenarios.map((scenario) => `SCENARIO-KERNEL ${canonicalJson(scenario)}`),
  ].join("\n");
}

function validation(status: "passed" | "failed", summary: string, details: Record<string, unknown> = {}): ValidationResult {
  return {
    validatorId: "representation-fidelity@1", status, summary, evidenceIds: [], evidenceLane: "representation",
    independenceGroup: "deterministic-representation-validator@1", assurance: status === "passed" ? "exact" : "strong",
    authorSource: "projector-engine", sideEffectClass: "none", details,
    startedAt: "1970-01-01T00:00:00.000Z", completedAt: "1970-01-01T00:00:00.000Z",
  };
}

export class RepresentationFidelityError extends Error {
  constructor(readonly dimension: PreservationDimension, message: string) {
    super(message); this.name = "RepresentationFidelityError";
  }
}

export interface MeasuredAbbreviation {
  readonly abbreviation: string;
  readonly tokenSavings: number;
  readonly clarityValidated: boolean;
}

type ParsedCandidateSource = Pick<CanonicalRepresentationSource, "statements" | "scenarios">;

function parseKernelStatement(value: unknown): CanonicalRepresentationStatement {
  if (value === null || typeof value !== "object") throw new TypeError("statement kernel is not an object");
  const item = value as Record<string, unknown>;
  const expectedKeys = ["cardinality", "concepts", "connective", "dependencyOrder", "exceptions", "force", "guard", "id", "literals", "negated", "scope"];
  if (canonicalJson(Object.keys(item).sort(compare)) !== canonicalJson(expectedKeys)) throw new TypeError("statement kernel has unknown or missing keys");
  const strings = (key: string): string[] => {
    if (!Array.isArray(item[key]) || !item[key].every((entry) => typeof entry === "string")) throw new TypeError(`${key} is not a string list`);
    return item[key] as string[];
  };
  if (typeof item.id !== "string" || !["require", "forbid", "prefer", "permit"].includes(String(item.force))
    || typeof item.negated !== "boolean") throw new TypeError("statement identity, force, or negation is invalid");
  const cardinality = item.cardinality;
  const connective = item.connective;
  const guard = item.guard;
  if (cardinality !== null && !["exactly-one", "one-or-more", "at-most-one", "all", "none"].includes(String(cardinality))) throw new TypeError("cardinality is invalid");
  if (connective !== null && !["and", "or", "implies", "iff"].includes(String(connective))) throw new TypeError("connective is invalid");
  if (guard !== null && typeof guard !== "string") throw new TypeError("guard is invalid");
  return {
    id: item.id, text: "", normativeForce: item.force as CanonicalRepresentationStatement["normativeForce"], negated: item.negated,
    scope: strings("scope"), ...(cardinality === null ? {} : { cardinality: cardinality as NonNullable<CanonicalRepresentationStatement["cardinality"]> }),
    ...(connective === null ? {} : { connective: connective as NonNullable<CanonicalRepresentationStatement["connective"]> }),
    ...(guard === null ? {} : { guard }), exceptions: strings("exceptions"), dependencies: strings("dependencyOrder"),
    conceptIds: strings("concepts"), protectedLiterals: strings("literals"),
  };
}

function parseScenarios(value: unknown): CanonicalRepresentationSource["scenarios"] {
  if (!Array.isArray(value)) throw new TypeError("scenarios are not an array");
  return value.map((entry) => {
    if (entry === null || typeof entry !== "object") throw new TypeError("scenario is not an object");
    const scenario = entry as Record<string, unknown>;
    if (canonicalJson(Object.keys(scenario).sort(compare)) !== canonicalJson(["id", "steps", "title"])) throw new TypeError("scenario has unknown or missing keys");
    if (typeof scenario.id !== "string" || typeof scenario.title !== "string" || !Array.isArray(scenario.steps)) throw new TypeError("scenario structure is invalid");
    const steps = scenario.steps.map((step) => {
      if (step === null || typeof step !== "object") throw new TypeError("scenario step is invalid");
      const item = step as Record<string, unknown>;
      if (canonicalJson(Object.keys(item).sort(compare)) !== canonicalJson(["role", "statement"])) throw new TypeError("scenario step has unknown or missing keys");
      if (!["precondition", "trigger", "expected-outcome", "forbidden-outcome"].includes(String(item.role)) || typeof item.statement !== "string") {
        throw new TypeError("scenario step role is invalid");
      }
      return { role: item.role as BehavioralScenarioStep["role"], statement: item.statement };
    });
    return { id: scenario.id, title: scenario.title, steps };
  });
}

function assertNoDuplicateJsonKeys(source: string): void {
  const stack: Array<{ kind: "object"; keys: Set<string>; expectsKey: boolean } | { kind: "array" }> = [];
  let index = 0;
  const whitespace = /\s/u;
  while (index < source.length) {
    const character = source[index]!;
    if (whitespace.test(character)) { index += 1; continue; }
    if (character === "{") { stack.push({ kind: "object", keys: new Set(), expectsKey: true }); index += 1; continue; }
    if (character === "[") { stack.push({ kind: "array" }); index += 1; continue; }
    if (character === "}" || character === "]") { stack.pop(); index += 1; continue; }
    if (character === ",") {
      const top = stack.at(-1);
      if (top?.kind === "object") top.expectsKey = true;
      index += 1; continue;
    }
    if (character !== '"') { index += 1; continue; }
    const start = index;
    index += 1;
    let escaped = false;
    while (index < source.length) {
      const current = source[index]!;
      index += 1;
      if (escaped) { escaped = false; continue; }
      if (current === "\\") { escaped = true; continue; }
      if (current === '"') break;
    }
    const raw = source.slice(start, index);
    let lookahead = index;
    while (lookahead < source.length && whitespace.test(source[lookahead]!)) lookahead += 1;
    const top = stack.at(-1);
    if (top?.kind === "object" && top.expectsKey && source[lookahead] === ":") {
      const key = JSON.parse(raw) as string;
      if (top.keys.has(key)) throw new TypeError(`duplicate JSON key: ${key}`);
      top.keys.add(key);
      top.expectsKey = false;
    }
  }
}

/** The sole JSON parser for representation candidates. Duplicate names are rejected recursively before parsing. */
function parseStrictJson(source: string): unknown {
  assertNoDuplicateJsonKeys(source);
  return JSON.parse(source) as unknown;
}

function parseMachineCandidate(candidate: string): ParsedCandidateSource {
  const parsed = parseStrictJson(candidate) as Record<string, unknown>;
  if (canonicalJson(Object.keys(parsed).sort(compare)) !== canonicalJson(["apiVersion", "kind", "scenarios", "sourceIds", "statements"])) {
    throw new TypeError("machine invariant has unknown or missing schema keys");
  }
  if (parsed.apiVersion !== "projector.dev/representation/v1" || parsed.kind !== "MachineInvariant"
    || !Array.isArray(parsed.statements) || !Array.isArray(parsed.sourceIds)
    || !parsed.sourceIds.every((id) => typeof id === "string")) throw new TypeError("candidate is not a supported machine invariant kernel");
  const statements = parsed.statements.map(parseKernelStatement);
  const scenarios = parseScenarios(parsed.scenarios);
  const observedIds = unique([...statements.map(({ id }) => id), ...scenarios.map(({ id }) => id)]);
  if (canonicalJson(observedIds) !== canonicalJson(unique(parsed.sourceIds as string[]))) throw new TypeError("machine source membership does not match its structured kernel");
  return { statements, scenarios };
}

function parseHumanCandidate(candidate: string): ParsedCandidateSource {
  const scenarioMarker = "Behavioral scenarios:";
  const marker = candidate.lastIndexOf(scenarioMarker);
  if (marker < 0) throw new TypeError("human representation has no scenario kernel");
  const scenarios = parseScenarios(parseStrictJson(candidate.slice(marker + scenarioMarker.length).trim()));
  const statementPart = candidate.slice(0, marker).trim();
  const statements = statementPart.split(/\n\s*\n/gu).filter(Boolean).map((block) => {
    const match = /^Advisory text:\s*("(?:[^"\\]|\\.)*")\r?\nSemantic kernel:\s*(\{[^\n]*\})$/su.exec(block.trim());
    if (match === null) throw new TypeError("human statement block cannot be fully parsed");
    const parsed = parseKernelStatement(parseStrictJson(match[2]!));
    const advisory = parseStrictJson(match[1]!);
    if (typeof advisory !== "string") throw new TypeError("human advisory envelope must contain a JSON string");
    return { ...parsed, text: advisory };
  });
  if (statements.length === 0) throw new TypeError("human representation has no statement kernel");
  return { statements, scenarios };
}

function parseGherkinCandidate(candidate: string): ParsedCandidateSource {
  const marker = "# invariant-kernel:";
  const markerOffset = candidate.lastIndexOf(marker);
  if (markerOffset < 0) throw new TypeError("Gherkin representation has no invariant kernel");
  const statementsValue = parseStrictJson(candidate.slice(markerOffset + marker.length).trim());
  if (!Array.isArray(statementsValue)) throw new TypeError("Gherkin invariant kernel is not an array");
  const scenarios = candidate.slice(0, markerOffset).trim().split(/\n\s*\n/gu).filter(Boolean).map((block) => {
    const lines = block.split(/\r?\n/gu).map((line) => line.trim()).filter(Boolean);
    const id = /^# source:\s*(.+)$/u.exec(lines[0] ?? "")?.[1];
    const title = /^Scenario:\s*(.+)$/u.exec(lines[1] ?? "")?.[1];
    if (id === undefined || title === undefined) throw new TypeError("Gherkin scenario identity is invalid");
    const roles: Record<string, BehavioralScenarioStep["role"]> = { Given: "precondition", When: "trigger", Then: "expected-outcome", But: "forbidden-outcome" };
    const steps = lines.slice(2).map((line) => {
      const match = /^(Given|When|Then|But)\s+(.+)$/u.exec(line);
      if (match === null) throw new TypeError("Gherkin scenario step cannot be parsed");
      return { role: roles[match[1]!]!, statement: match[2]! };
    });
    return { id, title, steps };
  });
  return { statements: statementsValue.map(parseKernelStatement), scenarios };
}

function parseCompactCandidate(candidate: string): ParsedCandidateSource {
  if (candidate.split(/\r?\n/gu).some((line) => line.trim().startsWith("STATEMENT "))) {
    const statements: CanonicalRepresentationStatement[] = [];
    const scenarios: Array<CanonicalRepresentationSource["scenarios"][number]> = [];
    for (const line of candidate.split(/\r?\n/gu).map((item) => item.trim()).filter(Boolean)) {
      if (line.startsWith("STATEMENT ")) statements.push(parseKernelStatement(parseStrictJson(line.slice("STATEMENT ".length))));
      else if (line.startsWith("SCENARIO-KERNEL ")) scenarios.push(...parseScenarios([parseStrictJson(line.slice("SCENARIO-KERNEL ".length))]));
      else throw new TypeError("less-aggressive compact line cannot be parsed");
    }
    return { statements, scenarios };
  }
  const statements: CanonicalRepresentationStatement[] = [];
  const scenarios: Array<CanonicalRepresentationSource["scenarios"][number]> = [];
  for (const line of candidate.split(/\r?\n/gu).map((item) => item.trim()).filter(Boolean)) {
    if (line.startsWith("SCENARIO ")) {
      const parts = line.split(/\s*\|\s*/gu);
      const id = parts.shift()!.slice("SCENARIO ".length).trim();
      const titlePart = parts.shift();
      const titleMatch = /^TITLE\s+("(?:[^"\\]|\\.)*")$/u.exec(titlePart ?? "");
      if (titleMatch === null) throw new TypeError("compact scenario title cannot be parsed");
      const title = parseStrictJson(titleMatch[1]!);
      if (typeof title !== "string") throw new TypeError("compact scenario title must be a JSON string");
      const steps = parts.map((part) => {
        const match = /^(PRECONDITION|TRIGGER|EXPECTED-OUTCOME|FORBIDDEN-OUTCOME):\s*(.+)$/u.exec(part);
        if (match === null) throw new TypeError("compact scenario step cannot be parsed");
        return { role: match[1]!.toLowerCase() as BehavioralScenarioStep["role"], statement: match[2]! };
      });
      scenarios.push({ id, title, steps });
      continue;
    }
    const parts = line.split(/\s*\|\s*/gu);
    const head = /^(REQUIRE|FORBID|PREFER|PERMIT)( NOT)?\s+(.+)$/u.exec(parts.shift() ?? "");
    if (head === null) throw new TypeError("compact statement head cannot be parsed");
    const fields = new Map<string, string>();
    const literals: string[] = [];
    for (const part of parts) {
      const field = /^(EXACTLY-ONE|ONE-OR-MORE|AT-MOST-ONE|ALL|NONE|AND|OR|IMPLIES|IFF)$/u.exec(part);
      if (field !== null) {
        const key = ["AND", "OR", "IMPLIES", "IFF"].includes(field[1]!) ? "connective" : "cardinality";
        if (fields.has(key)) throw new TypeError(`duplicate compact ${key}`);
        fields.set(key, field[1]!.toLowerCase());
      }
      else {
        const tagged = /^(IF|EXCEPT|ORDER|SCOPE|CONCEPTS)\s+(.+)$/u.exec(part);
        if (tagged === null) literals.push(part);
        else {
          if (fields.has(tagged[1]!)) throw new TypeError(`duplicate compact ${tagged[1]}`);
          fields.set(tagged[1]!, tagged[2]!);
        }
      }
    }
    const list = (key: string, separator = /,\s*/gu): string[] => fields.get(key)?.split(separator).filter(Boolean) ?? [];
    statements.push({
      id: head[3]!, text: "", normativeForce: head[1]!.toLowerCase() as CanonicalRepresentationStatement["normativeForce"], negated: head[2] !== undefined,
      scope: list("SCOPE"), ...(fields.has("cardinality") ? { cardinality: fields.get("cardinality")! as NonNullable<CanonicalRepresentationStatement["cardinality"]> } : {}),
      ...(fields.has("connective") ? { connective: fields.get("connective")! as NonNullable<CanonicalRepresentationStatement["connective"]> } : {}),
      ...(fields.has("IF") ? { guard: fields.get("IF")! } : {}), exceptions: list("EXCEPT"), dependencies: list("ORDER", /\s*>\s*/gu),
      conceptIds: list("CONCEPTS"), protectedLiterals: literals,
    });
  }
  return { statements, scenarios };
}

function parseCandidate(candidate: string, profileKey: BuiltInRepresentationProfileKey): ParsedCandidateSource {
  try {
    candidate = candidate.trim().replaceAll("\r\n", "\n");
    if (profileKey === "machine-invariant@1") return parseMachineCandidate(candidate);
    if (profileKey === "behavior-gherkin@1") return parseGherkinCandidate(candidate);
    if (profileKey === "agent-compact@1") return parseCompactCandidate(candidate);
    return parseHumanCandidate(candidate);
  } catch (error) {
    throw new RepresentationFidelityError("normative-force", `candidate cannot be deterministically parsed or proved: ${error instanceof Error ? error.message : String(error)}`);
  }
}

interface ProtectedAdvisorySpan { readonly start: number; readonly end: number }

function protectedAdvisorySpans(text: string, declaredLiterals: readonly string[]): ProtectedAdvisorySpan[] {
  const spans: ProtectedAdvisorySpan[] = [];
  const addMatches = (pattern: RegExp): void => {
    for (const match of text.matchAll(pattern)) {
      if (match.index !== undefined && match[0].length > 0) spans.push({ start: match.index, end: match.index + match[0].length });
    }
  };
  for (const literal of declaredLiterals) {
    if (literal.length === 0) continue;
    let offset = 0;
    while (offset <= text.length - literal.length) {
      const start = text.indexOf(literal, offset);
      if (start < 0) break;
      spans.push({ start, end: start + literal.length });
      offset = start + literal.length;
    }
  }
  addMatches(/`[^`\r\n]+`/gu);
  addMatches(/"(?:[^"\\\r\n]|\\.)*"|'(?:[^'\\\r\n]|\\.)*'/gu);
  addMatches(/\bhttps?:\/\/[^\s,;"'`()]+/gu);
  addMatches(/\b(?:[A-Za-z]:[\\/]|\.{0,2}[\\/]|[A-Za-z0-9_.-]+[\\/])[^\s,;:"'`()]+/gu);
  addMatches(/\b(?:[A-Za-z]+[A-Z][A-Za-z0-9]*|[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+|--?[a-z][a-z0-9-]*|[A-Za-z][A-Za-z0-9]*\.[A-Za-z][A-Za-z0-9.]*)\b/gu);
  addMatches(/\b\d+(?:\.\d+)?(?:[ \t]+)?(?:B|KB|MB|GB|TB|KiB|MiB|GiB|ms|s|min|h|Hz|kHz|MHz|GHz|%|px|rem|em)\b/giu);
  addMatches(/\b(?:Error|Exception):[^\r\n]+/gu);

  const merged: ProtectedAdvisorySpan[] = [];
  for (const span of spans.sort((left, right) => left.start - right.start || right.end - left.end)) {
    const prior = merged.at(-1);
    if (prior === undefined || span.start >= prior.end) merged.push(span);
    else if (span.end > prior.end) merged[merged.length - 1] = { start: prior.start, end: span.end };
  }
  return merged;
}

function normalizeCosmeticWhitespace(value: string, trimStart: boolean, trimEnd: boolean): string {
  let normalized = value.replace(/\s+/gu, " ");
  if (trimStart) normalized = normalized.trimStart();
  if (trimEnd) normalized = normalized.trimEnd();
  return normalized;
}

function hasExactLiteralInventory(source: string, candidate: string, declaredLiterals: readonly string[]): boolean {
  const expected = new Map<string, number>();
  for (const span of protectedAdvisorySpans(source, declaredLiterals)) {
    const literal = source.slice(span.start, span.end);
    expected.set(literal, (expected.get(literal) ?? 0) + 1);
  }
  for (const [literal, expectedCount] of expected) {
    let observedCount = 0;
    let offset = 0;
    while (offset <= candidate.length - literal.length) {
      const matchOffset = candidate.indexOf(literal, offset);
      if (matchOffset < 0) break;
      observedCount += 1;
      offset = matchOffset + literal.length;
    }
    if (observedCount !== expectedCount) return false;
  }
  return true;
}

function advisoryMatchesWithExactLiterals(source: string, candidate: string, declaredLiterals: readonly string[]): boolean {
  const spans = protectedAdvisorySpans(source, declaredLiterals);
  if (spans.length === 0) return normalizeCosmeticWhitespace(source, true, true) === normalizeCosmeticWhitespace(candidate, true, true);

  let successfulMappings = 0;
  const search = (spanIndex: number, sourceOffset: number, candidateOffset: number): void => {
    if (successfulMappings > 1) return;
    if (spanIndex === spans.length) {
      if (normalizeCosmeticWhitespace(source.slice(sourceOffset), false, true)
        === normalizeCosmeticWhitespace(candidate.slice(candidateOffset), false, true)) successfulMappings += 1;
      return;
    }
    const span = spans[spanIndex]!;
    const literal = source.slice(span.start, span.end);
    const expectedProse = normalizeCosmeticWhitespace(source.slice(sourceOffset, span.start), spanIndex === 0, false);
    let matchOffset = candidate.indexOf(literal, candidateOffset);
    while (matchOffset >= 0) {
      const observedProse = normalizeCosmeticWhitespace(candidate.slice(candidateOffset, matchOffset), spanIndex === 0, false);
      if (observedProse === expectedProse) search(spanIndex + 1, span.end, matchOffset + literal.length);
      matchOffset = candidate.indexOf(literal, matchOffset + 1);
    }
  };
  search(0, 0, 0);
  return successfulMappings === 1;
}

function assertCandidate(
  source: CanonicalRepresentationSource,
  candidate: string,
  profileKey: BuiltInRepresentationProfileKey,
  measuredAbbreviations: readonly MeasuredAbbreviation[] = [],
): void {
  const observed = parseCandidate(candidate, profileKey);
  const normalizedObserved = {
    statements: [...observed.statements].map((statement) => ({ ...statement, scope: unique(statement.scope), exceptions: unique(statement.exceptions), conceptIds: unique(statement.conceptIds), protectedLiterals: unique(statement.protectedLiterals) })).sort((a, b) => compare(a.id, b.id)),
    scenarios: [...observed.scenarios].sort((a, b) => compare(a.id, b.id)),
  };
  for (const dimension of ALL_DIMENSIONS) {
    if (canonicalJson(dimensionValue(source, dimension)) !== canonicalJson(dimensionValue(normalizedObserved, dimension))) {
      throw new RepresentationFidelityError(dimension, `candidate changed protected dimension: ${dimension}`);
    }
  }
  const expectedKernel = source.statements.map(kernel).sort((a, b) => compare(String(a.id), String(b.id)));
  const observedKernel = normalizedObserved.statements.map(kernel).sort((a, b) => compare(String(a.id), String(b.id)));
  if (canonicalJson(expectedKernel) !== canonicalJson(observedKernel)
    || canonicalJson(source.scenarios) !== canonicalJson(normalizedObserved.scenarios)) {
    throw new RepresentationFidelityError("normative-force", "candidate contains unparsed or contradictory semantic content");
  }
  if (profileKey === "human-technical@1") {
    for (const statement of source.statements) {
      const observedStatement = normalizedObserved.statements.find(({ id }) => id === statement.id);
      if (observedStatement === undefined
        || !advisoryMatchesWithExactLiterals(statement.text, observedStatement.text, statement.protectedLiterals)) {
        const dimension = observedStatement !== undefined
          && !hasExactLiteralInventory(statement.text, observedStatement.text, statement.protectedLiterals)
          ? "identifier-literal" : "normative-force";
        throw new RepresentationFidelityError(dimension, "human candidate advisory envelope changed semantic prose or an exact literal");
      }
    }
  }
  if (profileKey === "agent-compact@1") {
    const structural = new Set(["FORBID", "NOT", "MUST", "IFF", "IF", "ORDER", "SCOPE", "TITLE", "ONE", "MORE", "MOST", "ALL", "NONE", "AND", "OR"]);
    const protectedAcronyms = new Set(source.statements.flatMap(({ protectedLiterals }) => protectedLiterals)
      .flatMap((literal) => literal.match(/\b[A-Z]{2,5}\b/gu) ?? []));
    const measured = new Set(measuredAbbreviations
      .filter(({ tokenSavings, clarityValidated }) => Number.isFinite(tokenSavings) && tokenSavings > 0 && clarityValidated)
      .map(({ abbreviation }) => abbreviation));
    for (const abbreviation of candidate.match(/\b[A-Z]{2,5}\b/gu) ?? []) {
      if (!structural.has(abbreviation) && !protectedAcronyms.has(abbreviation) && !measured.has(abbreviation)) {
        throw new RepresentationFidelityError("identifier-literal", `invented abbreviation lacks measured utility: ${abbreviation}`);
      }
    }
  }
}

export interface CompileRepresentationInput {
  source: CanonicalRepresentationSource;
  binding: StateBinding;
  profileKey: BuiltInRepresentationProfileKey;
  profileOverheadTokens?: number;
}

export class RepresentationCompiler {
  constructor(private readonly ports: {
    readonly artifacts: RepresentationArtifactStore; readonly tokenizer?: TokenMeasurementPort;
    readonly fallbackGate?: (tier: RepresentationFallbackTier) => boolean;
  }) {}

  async validateCandidate(input: { source: CanonicalRepresentationSource; profileKey: BuiltInRepresentationProfileKey; candidate: string; measuredAbbreviations?: readonly MeasuredAbbreviation[] }): Promise<SemanticPreservationFingerprint> {
    const source = normalizedSource(input.source);
    assertCandidate(source, input.candidate, input.profileKey, input.measuredAbbreviations);
    return fingerprint(source, BUILT_IN_REPRESENTATION_PROFILES[input.profileKey]);
  }

  async verifyArtifact(projection: RepresentationProjection): Promise<{ readonly status: "valid" | "invalid"; readonly reason?: string }> {
    const content = await this.ports.artifacts.get(projection.contentHash);
    if (content === undefined) return { status: "invalid", reason: "representation artifact is missing" };
    if (hashFramedDomain("representation-artifact", content) !== projection.contentHash) {
      return { status: "invalid", reason: "representation artifact content hash mismatch" };
    }
    return { status: "valid" };
  }

  async compile(input: CompileRepresentationInput): Promise<{ readonly projection: Readonly<RepresentationProjection> }> {
    return this.compileRendered(input);
  }

  private async compileRendered(input: CompileRepresentationInput, contentOverride?: string, identityVariant = "canonical"): Promise<{ readonly projection: Readonly<RepresentationProjection> }> {
    const source = normalizedSource(input.source);
    const selected = BUILT_IN_REPRESENTATION_PROFILES[input.profileKey];
    const members = typedSourceMembers(source);
    const memberKeys = new Set(members.map(({ kind, id }) => `${kind}:${id}`));
    if (input.binding.valueDependencies.some(({ kind, id }) => kind === "canonical-entity" && memberKeys.has(String(id)))) {
      throw new TypeError("representation source members must occur exactly once in typed bound value dependencies");
    }
    const boundState = createStateBinding({
      compiledAgainst: input.binding.compiledAgainst,
      valueDependencies: [
        ...input.binding.valueDependencies,
        ...members.map((member) => ({ kind: "canonical-entity" as const, id: `${member.kind}:${member.id}`, versionHash: member.semanticHash, role: `representation-source:${member.kind}` })),
        { kind: "representation-profile" as const, id: selected.id, versionHash: selected.semanticHash, role: "representation-profile" },
      ],
      queryDependencies: input.binding.queryDependencies,
    });
    const content = contentOverride ?? render(source, input.profileKey);
    assertCandidate(source, content, input.profileKey);
    // Generated renderers originate from the normalized kernel. Literal checks guard accidental renderer loss.
    for (const literal of source.statements.flatMap(({ protectedLiterals }) => protectedLiterals)) {
      if (!content.includes(literal)) throw new RepresentationFidelityError("identifier-literal", `renderer dropped protected literal: ${literal}`);
    }
    const contentHash = hashFramedDomain("representation-artifact", content);
    await this.ports.artifacts.put(contentHash, content);
    const preservation = fingerprint(source, selected);
    const sourceText = source.statements.map(({ text }) => text).join("\n");
    const tokenAccounting = this.ports.tokenizer === undefined ? undefined : {
      sourceTokens: this.ports.tokenizer.measure(sourceText), outputTokens: this.ports.tokenizer.measure(content),
      profileOverheadTokens: input.profileOverheadTokens ?? 0,
      estimatedNetTokens: this.ports.tokenizer.measure(sourceText) - this.ports.tokenizer.measure(content) - (input.profileOverheadTokens ?? 0),
      tokenizerProfileId: this.ports.tokenizer.profileId,
    };
    const projectionBase = {
      id: `representation:${hashFramedDomain("representation-projection-id", { sourceHash: source.sourceSemanticHash, profileId: selected.id, profileVersion: selected.version, binding: boundState.dependencyDigest, identityVariant })}`,
      profileId: selected.id, profileVersion: selected.version, target: selected.target,
      sourceEntityIds: unique(source.sourceEntityIds), sourceSemanticHash: source.sourceSemanticHash,
      boundState, contentHash, preservation,
      ...(tokenAccounting === undefined ? {} : { tokenAccounting }),
      status: "valid" as const, validatorResults: [validation("passed", "all protected dimensions preserved")],
    };
    const projection: RepresentationProjection = { ...projectionBase, semanticHash: hashFramedDomain("representation-projection", projectionBase) };
    return { projection: deepFreeze(projection) };
  }

  async compileBest(input: Omit<CompileRepresentationInput, "profileKey"> & { requestedProfileKey: BuiltInRepresentationProfileKey }): Promise<{
    readonly projection: Readonly<RepresentationProjection>; readonly advisoryProjection?: Readonly<RepresentationProjection>;
    readonly fallback?: { readonly tier: RepresentationFallbackTier; readonly status: "fallback-used" };
  }> {
    const requested = await this.compile({ ...input, profileKey: input.requestedProfileKey });
    if (input.requestedProfileKey !== "agent-compact@1" || (requested.projection.tokenAccounting?.estimatedNetTokens ?? 0) > 0) return requested;
    const tiers: Array<{ tier: RepresentationFallbackTier; profileKey: BuiltInRepresentationProfileKey }> = [
      { tier: "exact-machine-plus-advisory-compact", profileKey: "machine-invariant@1" },
      { tier: "less-aggressive-compact", profileKey: "agent-compact@1" },
      { tier: "human-technical", profileKey: "human-technical@1" },
    ];
    for (const { tier, profileKey } of tiers) {
      if (this.ports.fallbackGate?.(tier) === false) continue;
      const accepted = tier === "less-aggressive-compact"
        ? await this.compileRendered({ ...input, profileKey: "agent-compact@1" }, renderLessAggressiveCompact(normalizedSource(input.source)), "less-aggressive-compact")
        : profileKey === input.requestedProfileKey ? requested : await this.compile({ ...input, profileKey });
      const base = { ...accepted.projection, status: "fallback-used" as const };
      const projection = deepFreeze({ ...base, semanticHash: hashFramedDomain("representation-projection", { ...base, semanticHash: undefined }) });
      return {
        projection, ...(tier === "exact-machine-plus-advisory-compact" ? { advisoryProjection: requested.projection } : {}),
        fallback: { tier, status: "fallback-used" },
      };
    }
    throw new Error("representation fallback exhausted; projection must block");
  }
}

export type RepresentationFallbackTier = "exact-machine-plus-advisory-compact" | "less-aggressive-compact" | "human-technical";
