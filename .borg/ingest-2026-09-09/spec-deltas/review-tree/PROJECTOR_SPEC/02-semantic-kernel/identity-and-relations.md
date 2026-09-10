# Identity, Concepts, and Relations

## Core contract authority

Every public serialized contract MUST have a corresponding Zod schema. A normative code block MUST NOT reference an undefined cross-package type. CI MUST load the exported contract registry and fail if a referenced public schema is absent or not explicitly marked `extension-defined`.

Implementations MAY add backward-compatible fields, but MUST preserve the semantics below.

## Base identity, source class, and semantic hashing

```ts
export type EntityId = string;
export type Confidence = number; // 0..1; inference confidence, not a calibrated probability unless stated
export type ContentHash = `sha256:v1:${string}`;

export type SourceClass =
  | "authored"
  | "derived"
  | "observed"
  | "inferred";

export interface EvidenceRef {
  evidenceId: EntityId;
  stance: "supports" | "contradicts" | "context";
  weight?: number;
}

export interface CausalOrigin {
  kind:
    | "pre-projector"
    | "human"
    | "deterministic-observation"
    | "model-inference"
    | "semantic-resolution"
    | "relevance-analysis"
    | "planning-surprise"
    | "lens-transform"
    | "plan"
    | "external";
  causedByLensId?: EntityId;
  causedByRuleId?: EntityId;
  causedByTransformId?: string;
  causedBySemanticChangeId?: EntityId;
  causedByRelevanceClosureId?: EntityId;
  causedByPlanningSurpriseId?: EntityId;
  causedByPlanId?: EntityId;
  causedByPacketId?: EntityId;
}

export interface SemanticSignature {
  hash: ContentHash;
  profileId: string;
  profileVersion: string;
  scope: string;
  assurance: "exact" | "validated" | "heuristic";
  evidenceIds: EntityId[];
}
```

Every entity schema MUST define a **semantic projection**: the exact subset and normalization of fields that participate in its semantic hash. Volatile timestamps, run IDs, local cache locations, and UI metadata are excluded unless explicitly semantically meaningful.

Identity policy:

- authored entities receive a stable ID once and retain it.
- derived entities use deterministic adapter-namespaced identity from canonical semantic identity.
- inferred candidates derive identity from stable semantic key plus normalized evidence-set identity.
- moves preserve identity when the semantic anchor resolves.
- splits, merges, replacements, and deletions produce explicit lineage records and tombstones.

```ts
export interface LineageRecord {
  id: EntityId;
  kind: "move" | "split" | "merge" | "replace" | "delete";
  fromIds: EntityId[];
  toIds: EntityId[];
  reason: string;
  stateDigest: ContentHash;
}

export interface Tombstone {
  entityId: EntityId;
  deletedAtRevision: number;
  lastSemanticHash: ContentHash;
  replacementIds: EntityId[];
  reason: string;
}
```


## Concepts and factual relations

```ts
export interface Concept {
  id: EntityId;
  key: string;
  kind:
    | "capability"
    | "behavior"
    | "invariant"
    | "decision"
    | "ownership"
    | "obligation"
    | "data"
    | "interface"
    | "event"
    | "command"
    | "policy"
    | "read-model"
    | "contract"
    | "assumption"
    | "migration"
    | "constraint";
  name: string;
  aliases: string[];
  statement: string;
  status: "candidate" | "active" | "deprecated" | "rejected";
  sourceClass: SourceClass;
  confidence: Confidence;
  tags: string[];
  evidence: EvidenceRef[];
  discoveryHash: ContentHash;
  semanticHash: ContentHash;
}

export type RelationType =
  | "realizes"
  | "requires"
  | "constrains"
  | "depends-on"
  | "has-requirement"
  | "demonstrated-by"
  | "produces"
  | "consumes"
  | "triggers"
  | "governed-by"
  | "applies-to"
  | "generates"
  | "documents"
  | "verifies"
  | "deploys-to"
  | "publishes-to"
  | "observes"
  | "owns"
  | "incompatible-with"
  | "derived-from"
  | "supersedes"
  | "exception-to"
  | "variant-of";

export interface Relation {
  id: EntityId;
  fromId: EntityId;
  toId: EntityId;
  type: RelationType;
  sourceClass: SourceClass;
  confidence: Confidence;
  evidence: EvidenceRef[];
  active: boolean;
  semanticHash: ContentHash;
}
export interface IntentOriginRef {
  kind: "user-request" | "linear" | "github-issue" | "document" | "external";
  locator: string;
  contentHash?: ContentHash;
  description?: string;
}

export interface Requirement {
  id: EntityId;
  key: string;
  title: string;
  aliases: string[];
  statement: string;
  status: "candidate" | "active" | "deprecated" | "rejected" | "superseded";
  sourceClass: SourceClass;
  scope: SelectorExpr;
  origin: IntentOriginRef[];
  evidence: EvidenceRef[];
  discoveryHash: ContentHash;
  semanticHash: ContentHash;
}

export interface BehavioralScenarioStep {
  role: "precondition" | "trigger" | "expected-outcome" | "forbidden-outcome";
  statement: string;
}

export interface BehavioralScenario {
  id: EntityId;
  key: string;
  title: string;
  aliases: string[];
  status: "candidate" | "active" | "deprecated" | "rejected" | "superseded";
  sourceClass: SourceClass;
  scope: SelectorExpr;
  steps: BehavioralScenarioStep[];
  evidence: EvidenceRef[];
  discoveryHash: ContentHash;
  semanticHash: ContentHash;
}
```

A `Relation` records a fact or hypothesis. It MUST NOT carry mandatory governance propagation merely because the relation exists. Exact invalidation is derived from derivation inputs. Conceptual widening/impact behavior is defined by `ImpactRule` in active governance.

Requirements and Behavioral Scenarios are canonical semantic entities only when their stable identity changes planning, relevance discovery, verification, explanation, or change closure. They are not required for every trivial code edit.

Their authored `scope` reuses `SelectorExpr` machinery, but behavioral semantics SHOULD be scoped through semantic/product dimensions such as Concept, platform, operation, contract, or explicit tags. Implementation-only scope atoms MUST NOT define behavioral meaning just because current code lives there. Examples include path, language, AST pattern, and control mechanism. Implementation bindings belong in derived Relations/Projection Units unless location itself is an accepted product/compatibility constraint.

A Behavioral Scenario captures observable semantics, not an implementation test file or Gherkin syntax tree. `BehavioralScenarioStep.role` is representation-neutral: preconditions, trigger/action, expected outcomes, and explicitly forbidden outcomes. Gherkin `GIVEN`/`WHEN`/`THEN`/`AND`/`BUT`, Cucumber/Behave features, generated test skeletons, and human-readable acceptance specifications MAY be Representation Projections or verification evidence derived from the same scenario identity. Conjunction wording is a rendering concern. It MUST NOT become canonical scenario identity.

Aliases, canonical keys, and human-facing names/titles are discovery/terminology metadata. They MUST NOT define or replace stable identity, and changing them MUST NOT create a new entity or imply that the entity's behavioral/system meaning changed.

`discoveryHash` fingerprints the schema-defined metadata used by semantic identity resolution/retrieval. `semanticHash` fingerprints the entity's schema-defined meaning/applicability semantics and MUST exclude purely discovery/display metadata unless that metadata is itself semantically meaningful for that entity kind. A canonical document/snapshot hash still changes when any canonical field changes.

Therefore an alias/name change can invalidate identity-search/Relevance `StateQueryDependency`s while leaving derivations that depend only on unchanged semantic meaning current. Stable identity remains the entity ID, not either hash.

Use stable Concepts plus typed Relations for event, command, policy, read-model, and contract topology. Add a specialized canonical entity only when it changes Projector behavior enough to justify itself.

Canonical entity documents own intrinsic entity semantics. Canonical `Relation` documents own graph edges. Requirement↔Capability and Requirement↔Behavioral Scenario links MUST use typed Relations (`has-requirement`, `demonstrated-by`) rather than duplicating authoritative edge lists inside both endpoint documents. Derived indexes MAY materialize adjacency arrays for query speed, but they remain rebuildable.

`Concept` is the canonical generic semantic-identity record only when no richer specialized canonical contract owns the same semantics. Projector MUST NOT duplicate a `Requirement`, `BehavioralScenario`, or `ArchitectureDecision` as a second Concept document merely to make the graph uniform. Typed Relations may target any stable `EntityId` directly, and derived indexes MAY project common summary fields for heterogeneous graph queries. `Concept.kind = "decision"` is therefore reserved for durable non-architecture decisions that do not use the `ArchitectureDecision` contract. A `behavior` Concept names reusable behavioral meaning. A normative obligation about that behavior belongs in a `Requirement`.


