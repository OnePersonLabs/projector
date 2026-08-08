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

function dimensionValue(source: CanonicalRepresentationSource, dimension: PreservationDimension): unknown {
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
    const scenarios = source.scenarios.map((scenario) => `SCENARIO ${scenario.id} | ${scenario.steps
      .map((step) => `${step.role.toUpperCase()}: ${step.statement}`).join(" | ")}`).join("\n");
    return [statements, scenarios].filter(Boolean).join("\n");
  }
  return `${source.statements.map((statement) => `${statement.text}\nSemantic kernel: ${canonicalJson(kernel(statement))}`).join("\n\n")}\n\nBehavioral scenarios: ${canonicalJson(source.scenarios)}`;
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

function assertCandidate(
  source: CanonicalRepresentationSource,
  candidate: string,
  profileKey: BuiltInRepresentationProfileKey,
  measuredAbbreviations: readonly MeasuredAbbreviation[] = [],
): void {
  const lower = candidate.toLowerCase();
  for (const statement of source.statements) {
    if (statement.cardinality === "exactly-one" && /one or more|one-or-more/u.test(lower)) throw new RepresentationFidelityError("quantifier-cardinality", "exactly-one changed to one-or-more");
    if (statement.connective === "iff" && /\bwhen\b/u.test(lower) && !/\biff\b/u.test(lower)) throw new RepresentationFidelityError("logical-connective", "iff changed to when");
    if (statement.normativeForce === "forbid" && !/must_not|must not|forbid/u.test(lower)) throw new RepresentationFidelityError("normative-force", "forbid weakened or changed");
    if (statement.negated && !/must_not|must not|forbid|\bnot\b|\bnever\b/u.test(lower)) throw new RepresentationFidelityError("negation", "negation was dropped");
    if (statement.exceptions.length > 0 && !/unless|except|"exceptions"/u.test(lower)) throw new RepresentationFidelityError("exception", "exception was dropped");
    for (const scope of statement.scope) {
      if (!candidate.includes(scope)) throw new RepresentationFidelityError("scope", `semantic scope changed: ${scope}`);
    }
    if (profileKey === "agent-compact@1" && statement.scope.length > 0 && !candidate.includes(`SCOPE ${statement.scope.join(", ")}`)) {
      throw new RepresentationFidelityError("scope", "semantic scope marker changed");
    }
    if (statement.guard !== undefined && !candidate.includes(statement.guard)) throw new RepresentationFidelityError("condition-guard", `condition guard changed: ${statement.guard}`);
    if (statement.guard !== undefined && profileKey === "agent-compact@1" && !candidate.includes(`IF ${statement.guard}`)) {
      throw new RepresentationFidelityError("condition-guard", `condition guard marker changed: ${statement.guard}`);
    }
    let dependencyOffset = -1;
    for (const dependency of statement.dependencies) {
      const next = candidate.indexOf(dependency, dependencyOffset + 1);
      if (next < 0 || next < dependencyOffset) throw new RepresentationFidelityError("dependency-order", `dependency missing or reordered: ${dependency}`);
      dependencyOffset = next;
    }
    if (profileKey === "agent-compact@1" && statement.dependencies.length > 0 && !candidate.includes(`ORDER ${statement.dependencies.join(" > ")}`)) {
      throw new RepresentationFidelityError("dependency-order", "dependency order marker changed");
    }
    for (const conceptId of statement.conceptIds) {
      if (!candidate.includes(conceptId)) throw new RepresentationFidelityError("concept-identity", `canonical concept identity changed: ${conceptId}`);
    }
    for (const literal of statement.protectedLiterals) {
      if (!candidate.includes(literal)) throw new RepresentationFidelityError("identifier-literal", `protected literal changed: ${literal}`);
    }
  }
  for (const scenario of source.scenarios) {
    let offset = -1;
    for (const step of scenario.steps) {
      const next = candidate.indexOf(step.statement);
      if (next < 0 || next < offset) throw new RepresentationFidelityError("behavior-step-role", `scenario step missing or reordered: ${step.statement}`);
      const roleMarker = profileKey === "behavior-gherkin@1"
        ? ({ precondition: "Given", trigger: "When", "expected-outcome": "Then", "forbidden-outcome": "But" } as const)[step.role]
        : profileKey === "agent-compact@1" ? step.role.toUpperCase() : `"role":"${step.role}"`;
      const markerOffset = candidate.lastIndexOf(roleMarker, next);
      if (markerOffset < 0 || markerOffset < offset) throw new RepresentationFidelityError("behavior-step-role", `scenario role changed: ${step.role}`);
      offset = next;
    }
  }
  if (profileKey === "agent-compact@1") {
    const structural = new Set(["FORBID", "NOT", "MUST", "IFF", "IF", "ORDER", "SCOPE", "ONE", "MORE", "MOST", "ALL", "NONE", "AND", "OR"]);
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
  const expected = render(source, profileKey);
  if (candidate !== expected) {
    throw new RepresentationFidelityError("normative-force", "candidate semantic form is not the canonical exact rendering");
  }
}

export interface CompileRepresentationInput {
  source: CanonicalRepresentationSource;
  binding: StateBinding;
  profileKey: BuiltInRepresentationProfileKey;
  profileOverheadTokens?: number;
}

export class RepresentationCompiler {
  constructor(private readonly ports: { readonly artifacts: RepresentationArtifactStore; readonly tokenizer?: TokenMeasurementPort }) {}

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
    const source = normalizedSource(input.source);
    const selected = BUILT_IN_REPRESENTATION_PROFILES[input.profileKey];
    const boundState = createStateBinding({
      compiledAgainst: input.binding.compiledAgainst,
      valueDependencies: [
        ...input.binding.valueDependencies,
        ...source.sourceEntityIds.map((id) => ({ kind: "canonical-entity" as const, id, versionHash: entitySemanticHash(source, id), role: "representation-source" })),
        { kind: "representation-profile" as const, id: selected.id, versionHash: selected.semanticHash, role: "representation-profile" },
      ],
      queryDependencies: input.binding.queryDependencies,
    });
    const content = render(source, input.profileKey);
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
      id: `representation:${hashFramedDomain("representation-projection-id", { sourceHash: source.sourceSemanticHash, profileId: selected.id, profileVersion: selected.version, binding: boundState.dependencyDigest })}`,
      profileId: selected.id, profileVersion: selected.version, target: selected.target,
      sourceEntityIds: unique(source.sourceEntityIds), sourceSemanticHash: source.sourceSemanticHash,
      boundState, contentHash, preservation,
      ...(tokenAccounting === undefined ? {} : { tokenAccounting }),
      status: "valid" as const, validatorResults: [validation("passed", "all protected dimensions preserved")],
    };
    const projection: RepresentationProjection = { ...projectionBase, semanticHash: hashFramedDomain("representation-projection", projectionBase) };
    return { projection: deepFreeze(projection) };
  }

  async compileBest(input: Omit<CompileRepresentationInput, "profileKey"> & { requestedProfileKey: BuiltInRepresentationProfileKey }): Promise<{ readonly projection: Readonly<RepresentationProjection> }> {
    const requested = await this.compile({ ...input, profileKey: input.requestedProfileKey });
    if (input.requestedProfileKey !== "agent-compact@1" || (requested.projection.tokenAccounting?.estimatedNetTokens ?? 0) > 0) return requested;
    // The first conservative tier is the exact machine kernel. It is freshly compiled,
    // measured, bound and validated; rejected compact accounting is never carried over.
    const fallback = await this.compile({ ...input, profileKey: "machine-invariant@1" });
    const base = {
      ...fallback.projection, status: "fallback-used" as const,
    };
    return { projection: deepFreeze({ ...base, semanticHash: hashFramedDomain("representation-projection", { ...base, semanticHash: undefined }) }) };
  }
}
