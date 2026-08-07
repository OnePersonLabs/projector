# State Binding and Core Ports

## State binding and execution primitives

```ts
export interface StateDigest {
  gitBase: string;
  worktreeDigest: ContentHash; // complete governed worktree snapshot identity
  canonicalProjectorDigest: ContentHash; // complete canonical Projector snapshot identity
  toolchainDigest: ContentHash;
  pinnedExternalSnapshotDigest?: ContentHash;
}

export type StateValueDependencyKind =
  | "canonical-entity"
  | "canonical-governance"
  | "projection-unit"
  | "artifact"
  | "toolchain"
  | "adapter"
  | "signature-profile"
  | "representation-profile"
  | "external-snapshot";

export interface StateValueDependencyRef {
  kind: StateValueDependencyKind;
  id: EntityId | string;
  versionHash: ContentHash;
  role: string;
}

export type StateQueryKind =
  | "semantic-identity-search"
  | "relation-neighborhood"
  | "reverse-derivation"
  | "selector-membership"
  | "impact-rule-applicability"
  | "decision-applicability"
  | "implementation-binding"
  | "event-topology"
  | "contract-topology"
  | "verification-binding"
  | "package-dependency"
  | "surface-enumeration"
  | "custom";

export interface StateQuerySpec {
  id: string;
  kind: StateQueryKind;
  programId: string;
  programVersion: string;
  input: Record<string, unknown>;
  semanticHash: ContentHash;
}

export interface StateQueryResultFingerprint {
  queryHash: ContentHash;
  resultHash: ContentHash;
  resultCount: number;
  observability: ObservabilityClass;
  assumptions: string[];
  unavailableLanes: string[];
  dependencyKeys: string[];
}

export interface StateQueryDependency {
  query: StateQuerySpec;
  priorResult: StateQueryResultFingerprint;
  role: string;
}

export interface StateBinding {
  compiledAgainst: StateDigest;
  valueDependencies: StateValueDependencyRef[];
  queryDependencies: StateQueryDependency[];
  dependencyDigest: ContentHash;
}

export interface StateBindingValidation {
  status: "current" | "rebound" | "stale" | "suspect" | "unavailable";
  currentState: StateDigest;
  changedValueDependencyIds: Array<EntityId | string>;
  changedQueryDependencyIds: string[];
  reasons: string[];
  rebound?: StateBinding;
}

export interface ValidationResult {
  validatorId: string;
  status: "passed" | "failed" | "skipped" | "blocked";
  summary: string;
  evidenceIds: EntityId[];
  evidenceLane:
    | "compiler"
    | "test"
    | "schema"
    | "runtime"
    | "property"
    | "representation"
    | "architecture"
    | "historical"
    | "human"
    | "independent-agent"
    | "same-packet-agent";
  independenceGroup: string;
  assurance: "weak" | "supporting" | "strong" | "exact";
  authorSource: string;
  sideEffectClass: "none" | "read-only" | "workspace-write" | "external-write";
  details: Record<string, unknown>;
  startedAt: string;
  completedAt: string;
}

export interface RollbackSpec {
  kind: "git-checkpoint" | "inverse-transform" | "compensation" | "manual" | "none";
  checkpointId?: string;
  transformId?: string;
  instructions?: string;
}

export interface OperationEvidence {
  operationId: string;
  executor: "transform" | "agent" | "manual" | "external";
  unitIds: EntityId[];
  beforeHashes: ContentHash[];
  afterHashes: ContentHash[];
  evidenceIds: EntityId[];
  summary: string;
}
```

`StateDigest` identifies a complete snapshot and remains appropriate for receipts, certificates, rebuild comparison, and diagnostics. `StateBinding` determines whether bounded work is stale.

A mismatch in `compiledAgainst` MUST NOT automatically invalidate locally scoped work. Projector re-evaluates the binding's explicit dependencies and any selector/query membership fingerprints that could change the dependency set:

```text
snapshot root unchanged
→ binding current

snapshot root changed
→ compare bound dependencies + bound query-result fingerprints
   → none changed: rebind to the new snapshot without recomputing semantic work
   → relevant dependency changed: stale; recompile/revalidate
   → dependency lane unavailable/ambiguous: mark suspect and widen according to policy
```

The dependency set itself is part of correctness. A binding that omits a dependency required to determine applicability is a stale-analysis bug even if every recorded hash still matches.

`valueDependencies` bind facts that were selected or consumed. Their `versionHash` MUST use the hash dimension appropriate to the dependency role. Use semantic meaning/signature for behavioral or derivation dependence. Use discovery metadata when the consumer depends directly on names or aliases. Use canonical document content when exact document identity matters.

Other roles can use an explicitly versioned profile. A consumer MUST NOT bind a broader hash merely for convenience. Broad hashes cause needless invalidation.

`queryDependencies` bind the **discovery operations that established the selected boundary**. They also bind negative-space conclusions such as "no additional governing relation/consumer/membership exists within this observable scope."

Every `StateQuerySpec` MUST name a deterministic, versioned query program and normalized serializable input. Canonical/query data MUST NOT embed arbitrary executable code. `semanticHash` covers the query program identity/version and normalized input.

`StateQueryResultFingerprint.resultHash` covers the declared semantic result projection in deterministic order. The projection includes identity, membership, existence, and closure-relevant ranking or qualifying fields. It includes other declared result properties. It excludes display-only metadata.

A binding MUST capture a `StateQueryDependency` when correctness depends on a query returning its current set, including an empty set. This includes searches, adjacency lookups, selector membership, and producer/consumer enumeration. A new Concept, Requirement, Relation, Projection Unit, event consumer, contract consumer, selector match, or implementation binding can change a bound query result. When it does, Projector MUST stale or re-evaluate the closure even if every previously selected entity hash is unchanged.

Binding validation after a changed global snapshot therefore performs two independent checks:

1. Compare each `valueDependency` against its current version hash.
2. Re-evaluate each bound `StateQuerySpec` whose dependency keys may have changed. If Projector cannot prove the keys unchanged, re-evaluate conservatively. Then compare the new semantic result fingerprint with `priorResult`.

A query-program/version change itself invalidates the query dependency. If a query cannot be re-evaluated, or its required observation lane becomes unavailable, the binding becomes `suspect`/`unavailable` rather than silently current.

**Negative-space proof is observability-bound.** An empty or unchanged result can establish absence only for a `closed` lane. A `bounded` lane can also establish absence when its assumptions hold. `open`, `sampled`, and `unavailable` lanes may support relevance ranking or frontier widening. They MUST NOT prove that no additional relevant entity exists.

`dependencyKeys` are a performance optimization for localized query re-evaluation, not a correctness escape hatch. If Projector cannot prove from dependency keys that a query result is unaffected by a changed snapshot, it MUST re-run the query.

`dependencyDigest` hashes the normalized value dependencies and query dependencies, including their query/result fingerprints. It MUST NOT merely hash the currently returned semantic entities.

Global repository/canonical-root hashes MUST NOT be inserted into every local dependency set merely to simplify stale checks. That would recreate global invalidation under a different type name.


## Analyzer, graph, runtime, and surface ports

```ts
export interface AnalyzerCapabilities {
  analyzerId: string;
  adapterVersion: string;
  supportedLanguages: string[];
  supportedSemantics: string[];
  enumeration: EnumerationContract;
  executesRepositoryCode: boolean;
}

export interface AnalyzerFailure {
  analyzerId: string;
  capability: string;
  scope: string;
  message: string;
  recoverable: boolean;
  affectedClaimKinds: string[];
}

export interface AdapterContext {
  repositoryRoot: string;
  stateDigest: StateDigest;
  config: Record<string, unknown>;
  signal: AbortSignal;
}

export interface ArtifactFingerprint {
  contentHash: ContentHash;
  structuralSignature?: SemanticSignature;
  semanticSignature?: SemanticSignature;
  adapterVersion: string;
}

export interface GraphReader {
  getConcept(id: EntityId): Concept | undefined;
  getRequirement(id: EntityId): Requirement | undefined;
  getBehavioralScenario(id: EntityId): BehavioralScenario | undefined;
  getProjectionUnit(id: EntityId): ProjectionUnit | undefined;
  getRelations(id: EntityId, direction: "in" | "out" | "both"): Relation[];
  reverseDerivationDependents(subjectId: EntityId | string): EntityId[];
  getDerivationInputs(unitId: EntityId): DerivationInput[];
  querySelectorDependencies(selectorHash: ContentHash): EntityId[];
  searchSemanticIdentities(query: string, kinds?: Array<"concept" | "requirement" | "scenario">): EntityId[];
}

export interface StateQueryReader {
  evaluate(query: StateQuerySpec, context: AdapterContext): Promise<StateQueryResultFingerprint>;
}

export interface StateBindingValidator {
  validate(
    binding: StateBinding,
    currentState: StateDigest,
    context: AdapterContext,
  ): Promise<StateBindingValidation>;
}

export interface TransformContext {
  repositoryRoot: string;
  stateBinding: StateBinding;
  allowedUnits: EntityId[];
  dryRun: boolean;
  signal: AbortSignal;
}

export interface TransformPreview {
  applicable: boolean;
  operations: Array<Record<string, unknown>>;
  touchedUnitIds: EntityId[];
  expectedDiff: string;
  warnings: string[];
}

export interface TransformResult {
  transformId: string;
  changed: boolean;
  touchedUnitIds: EntityId[];
  operations: OperationEvidence[];
  checkpointId?: string;
}

export interface SurfaceChange {
  semanticChangeId: EntityId;
  surfaceId: EntityId;
  operation: string;
  payload: Record<string, unknown>;
}

export interface SurfacePlan {
  adapterId: string;
  surfaceId: EntityId;
  riskClass: RiskClass;
  operations: Array<Record<string, unknown>>;
  requiredApprovals: string[];
  validatorIds: string[];
  boundState: StateBinding;
}

export interface SurfaceApplyResult {
  changed: boolean;
  operationEvidence: OperationEvidence[];
  externalReferences: string[];
}

export interface TokenCounter {
  profileId: string;
  count(text: string): number;
}
```


## Lens/validator/transform supporting contracts

```ts
export interface RecognizerBinding {
  id: string;
  version: string;
  adapterId: string;
  query: Record<string, unknown>;
  minimumConfidence: Confidence;
}

export interface ValidatorBinding {
  id: string;
  version: string;
  provider: string;
  input: Record<string, unknown>;
  required: boolean;
  requiredIndependenceGroup?: string;
}

export interface TransformBinding {
  id: string;
  version: string;
  input: Record<string, unknown>;
  exclusiveUnitClaim: boolean;
}

export interface MigrationBinding {
  fromVersion: string;
  toVersion: string;
  transformIds: string[];
  validationIds: string[];
}

export interface LensExample {
  unitId?: EntityId;
  artifactLocator?: string;
  explanation: string;
  evidenceIds: EntityId[];
}

export interface AuthorityAlternative {
  key: string;
  description: string;
  advantages: string[];
  disadvantages: string[];
  rejectedBecause: string[];
  evidence: EvidenceRef[];
}
```


