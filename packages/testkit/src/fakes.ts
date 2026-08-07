import type {
  AdapterContext,
  Artifact,
  ArtifactFingerprint,
  BehavioralScenario,
  Concept,
  ContentHash,
  DerivationInput,
  EntityId,
  GraphReader,
  ModelProvider,
  ProjectionUnit,
  Relation,
  Requirement,
  StateQueryReader,
  StateQueryResultFingerprint,
  StateQuerySpec,
  StructuredModelRequest,
  StructuredModelResponse,
  Surface,
  SurfaceAdapter,
  SurfaceApplyResult,
  SurfaceCapabilities,
  SurfaceChange,
  SurfacePlan,
  ValidationResult,
  EnumerationContract,
} from "@projector/core";

const clone = <T>(value: T): T => structuredClone(value);
const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sortStrings = (values: readonly string[]): string[] => [...values].sort(compareText);

export interface FakeGraphSeed {
  concepts?: readonly Concept[];
  requirements?: readonly Requirement[];
  behavioralScenarios?: readonly BehavioralScenario[];
  projectionUnits?: readonly ProjectionUnit[];
  relations?: readonly Relation[];
  reverseDerivationDependents?: Readonly<Record<string, readonly EntityId[]>>;
  derivationInputs?: Readonly<Record<string, readonly DerivationInput[]>>;
  selectorDependencies?: Readonly<Record<string, readonly EntityId[]>>;
  semanticSearchResults?: Readonly<Record<string, readonly EntityId[]>>;
}

export class FakeGraphReader implements GraphReader {
  readonly #concepts: Map<EntityId, Concept>;
  readonly #requirements: Map<EntityId, Requirement>;
  readonly #scenarios: Map<EntityId, BehavioralScenario>;
  readonly #units: Map<EntityId, ProjectionUnit>;
  readonly #relations: Relation[];
  readonly #reverseDerivations: Readonly<Record<string, readonly EntityId[]>>;
  readonly #derivationInputs: Readonly<Record<string, readonly DerivationInput[]>>;
  readonly #selectorDependencies: Readonly<Record<string, readonly EntityId[]>>;
  readonly #semanticSearchResults: Readonly<Record<string, readonly EntityId[]>>;

  public constructor(seed: FakeGraphSeed = {}) {
    this.#concepts = new Map((seed.concepts ?? []).map((value) => [value.id, clone(value)]));
    this.#requirements = new Map((seed.requirements ?? []).map((value) => [value.id, clone(value)]));
    this.#scenarios = new Map((seed.behavioralScenarios ?? []).map((value) => [value.id, clone(value)]));
    this.#units = new Map((seed.projectionUnits ?? []).map((value) => [value.id, clone(value)]));
    this.#relations = [...(seed.relations ?? [])].map(clone).sort((left, right) => compareText(left.id, right.id));
    this.#reverseDerivations = clone(seed.reverseDerivationDependents ?? {});
    this.#derivationInputs = clone(seed.derivationInputs ?? {});
    this.#selectorDependencies = clone(seed.selectorDependencies ?? {});
    this.#semanticSearchResults = clone(seed.semanticSearchResults ?? {});
  }

  public getConcept(id: EntityId): Concept | undefined {
    return cloneOptional(this.#concepts.get(id));
  }

  public getRequirement(id: EntityId): Requirement | undefined {
    return cloneOptional(this.#requirements.get(id));
  }

  public getBehavioralScenario(id: EntityId): BehavioralScenario | undefined {
    return cloneOptional(this.#scenarios.get(id));
  }

  public getProjectionUnit(id: EntityId): ProjectionUnit | undefined {
    return cloneOptional(this.#units.get(id));
  }

  public getRelations(id: EntityId, direction: "in" | "out" | "both"): Relation[] {
    return this.#relations
      .filter((relation) =>
        direction === "in" ? relation.toId === id :
          direction === "out" ? relation.fromId === id :
            relation.fromId === id || relation.toId === id,
      )
      .map(clone);
  }

  public reverseDerivationDependents(subjectId: EntityId | string): EntityId[] {
    return sortStrings(this.#reverseDerivations[subjectId] ?? []);
  }

  public getDerivationInputs(unitId: EntityId): DerivationInput[] {
    return [...(this.#derivationInputs[unitId] ?? [])]
      .map(clone)
      .sort((left, right) => compareText(`${left.kind}:${left.id}:${left.role}`, `${right.kind}:${right.id}:${right.role}`));
  }

  public querySelectorDependencies(selectorHash: ContentHash): EntityId[] {
    return sortStrings(this.#selectorDependencies[selectorHash] ?? []);
  }

  public searchSemanticIdentities(query: string, kinds?: Array<"concept" | "requirement" | "scenario">): EntityId[] {
    const candidates = this.#semanticSearchResults[query] ?? [];
    if (kinds === undefined) return sortStrings(candidates);
    const allowed = new Set(kinds);
    return sortStrings(candidates.filter((id) =>
      (allowed.has("concept") && this.#concepts.has(id)) ||
      (allowed.has("requirement") && this.#requirements.has(id)) ||
      (allowed.has("scenario") && this.#scenarios.has(id)),
    ));
  }
}

function cloneOptional<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : clone(value);
}

export type FakeStateQueryHandler = (
  query: StateQuerySpec,
  context: AdapterContext,
) => Promise<StateQueryResultFingerprint> | StateQueryResultFingerprint;

export class FakeStateQueryReader implements StateQueryReader {
  readonly #results: Readonly<Record<string, StateQueryResultFingerprint>>;
  readonly #handler: FakeStateQueryHandler | undefined;
  readonly #queries: StateQuerySpec[] = [];

  public constructor(
    results: Readonly<Record<string, StateQueryResultFingerprint>> = {},
    handler?: FakeStateQueryHandler,
  ) {
    this.#results = clone(results);
    this.#handler = handler;
  }

  public async evaluate(query: StateQuerySpec, context: AdapterContext): Promise<StateQueryResultFingerprint> {
    this.#queries.push(clone(query));
    if (this.#handler !== undefined) return clone(await this.#handler(clone(query), context));
    const result = this.#results[query.id];
    if (result === undefined) throw new Error(`No fake query result configured for ${query.id}`);
    return clone(result);
  }

  public queries(): StateQuerySpec[] {
    return this.#queries.map(clone);
  }
}

export interface FakeModelResponse<T = unknown> {
  value: T;
  rawResponseHash: ContentHash;
  provider?: string;
  model?: string;
  providerRevision?: string;
  inputTokens?: number;
  outputTokens?: number;
  attempt?: number;
}

export class FakeModelProvider implements ModelProvider {
  readonly #responses: FakeModelResponse[];
  readonly #requests: StructuredModelRequest<unknown>[] = [];

  public constructor(responses: readonly FakeModelResponse[] = []) {
    this.#responses = responses.map(clone);
  }

  public async generateStructured<T>(request: StructuredModelRequest<T>): Promise<StructuredModelResponse<T>> {
    this.#requests.push(clone(request as StructuredModelRequest<unknown>));
    const response = this.#responses.shift();
    if (response === undefined) throw new Error("Fake model response queue is empty");
    return {
      value: clone(response.value) as T,
      provider: response.provider ?? "fake",
      model: response.model ?? "deterministic",
      ...(response.providerRevision === undefined ? {} : { providerRevision: response.providerRevision }),
      ...(response.inputTokens === undefined ? {} : { inputTokens: response.inputTokens }),
      ...(response.outputTokens === undefined ? {} : { outputTokens: response.outputTokens }),
      rawResponseHash: response.rawResponseHash,
      attempt: response.attempt ?? 1,
    };
  }

  public requests(): StructuredModelRequest<unknown>[] {
    return this.#requests.map(clone);
  }
}

export interface FakeSurfaceAdapterSeed {
  id?: string;
  kind?: Surface["kind"];
  capabilities?: SurfaceCapabilities;
  enumeration?: EnumerationContract;
  surfaces?: readonly Surface[];
  artifacts?: Readonly<Record<string, readonly Artifact[]>>;
  fingerprints?: Readonly<Record<string, ArtifactFingerprint>>;
  plans?: Readonly<Record<string, SurfacePlan>>;
  applyResults?: Readonly<Record<string, SurfaceApplyResult>>;
  validations?: Readonly<Record<string, readonly ValidationResult[]>>;
}

export class FakeSurfaceAdapter implements SurfaceAdapter {
  public readonly id: string;
  public readonly kind: Surface["kind"];
  public readonly capabilities: SurfaceCapabilities;
  public readonly enumeration: EnumerationContract;
  readonly #surfaces: Surface[];
  readonly #artifacts: Readonly<Record<string, readonly Artifact[]>>;
  readonly #fingerprints: Readonly<Record<string, ArtifactFingerprint>>;
  readonly #plans: Readonly<Record<string, SurfacePlan>>;
  readonly #applyResults: Readonly<Record<string, SurfaceApplyResult>>;
  readonly #validations: Readonly<Record<string, readonly ValidationResult[]>>;

  public constructor(seed: FakeSurfaceAdapterSeed = {}) {
    this.id = seed.id ?? "fake-surface-adapter";
    this.kind = seed.kind ?? "repository";
    this.capabilities = clone(seed.capabilities ?? {
      read: true, write: false, watch: false, transactionalWrites: false, stableAnchors: true, humanApprovalRequired: false,
    });
    this.enumeration = clone(seed.enumeration ?? {
      observability: "closed", method: "fake-fixture", assumptions: [], blindSpots: [], dynamicMechanisms: [],
    });
    this.#surfaces = [...(seed.surfaces ?? [])].map(clone).sort((left, right) => compareText(left.id, right.id));
    this.#artifacts = clone(seed.artifacts ?? {});
    this.#fingerprints = clone(seed.fingerprints ?? {});
    this.#plans = clone(seed.plans ?? {});
    this.#applyResults = clone(seed.applyResults ?? {});
    this.#validations = clone(seed.validations ?? {});
  }

  public async discover(_context: AdapterContext): Promise<Surface[]> {
    return this.#surfaces.map(clone);
  }

  public async inventory(surface: Surface, _context: AdapterContext): Promise<Artifact[]> {
    return [...(this.#artifacts[surface.id] ?? [])].map(clone).sort((left, right) => compareText(left.id, right.id));
  }

  public async fingerprint(artifact: Artifact, _context: AdapterContext): Promise<ArtifactFingerprint> {
    return clone(this.#fingerprints[artifact.id] ?? { contentHash: artifact.contentHash, adapterVersion: "fake@1" });
  }

  public async plan(change: SurfaceChange, _context: AdapterContext): Promise<SurfacePlan> {
    return configured(this.#plans, change.semanticChangeId, "surface plan");
  }

  public async apply(plan: SurfacePlan, _context: AdapterContext): Promise<SurfaceApplyResult> {
    return configured(this.#applyResults, plan.surfaceId, "surface apply result");
  }

  public async validate(plan: SurfacePlan, _context: AdapterContext): Promise<ValidationResult[]> {
    return [...configured(this.#validations, plan.surfaceId, "surface validations")].map(clone);
  }
}

function configured<T>(values: Readonly<Record<string, T>>, key: string, kind: string): T {
  const value = values[key];
  if (value === undefined) throw new Error(`No fake ${kind} configured for ${key}`);
  return clone(value);
}
