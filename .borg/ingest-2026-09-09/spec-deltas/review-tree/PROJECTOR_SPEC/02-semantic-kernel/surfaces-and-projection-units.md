# Surfaces and Projection Units

## Surfaces, observability, and artifacts

```ts
export type ObservabilityClass =
  | "closed"
  | "bounded"
  | "open"
  | "sampled"
  | "unavailable";

export interface EnumerationContract {
  observability: ObservabilityClass;
  method: string;
  assumptions: string[];
  blindSpots: string[];
  dynamicMechanisms: string[];
  freshnessRequirement?: string;
}

export interface SurfaceCapabilities {
  read: boolean;
  write: boolean;
  watch: boolean;
  transactionalWrites: boolean;
  stableAnchors: boolean;
  humanApprovalRequired: boolean;
}

export interface Surface {
  id: EntityId;
  key: string;
  kind:
    | "repository"
    | "ci"
    | "cloud"
    | "package-registry"
    | "app-store"
    | "website"
    | "runtime"
    | "database"
    | "external";
  adapter: string;
  access: "read-write" | "read-only" | "declared-only" | "unavailable";
  enumeration: EnumerationContract;
  capabilities: SurfaceCapabilities;
  boundary: Record<string, unknown>;
}

export interface Artifact {
  id: EntityId;
  surfaceId: EntityId;
  locator: string;
  mediaType: string;
  contentHash: ContentHash;
  structuralSignature?: SemanticSignature;
  semanticSignature?: SemanticSignature;
  observedAt: string;
  observationRevision: string;
  causalOrigin: CausalOrigin;
  metadata: Record<string, unknown>;
}
```

External observations are revisioned snapshots. `observedAt` is informational and does not itself participate in local semantic rebuild hashes.


## Stable semantic anchors, control policy, and Projection Units

```ts
export interface SemanticAnchor {
  kind:
    | "file"
    | "symbol"
    | "ast-node"
    | "json-pointer"
    | "yaml-path"
    | "markdown-section"
    | "workflow-job"
    | "resource-property"
    | "external-field";
  value: string;
  fallbackSignature?: SemanticSignature;
}

export interface ControlPolicy {
  ownership: "exclusive" | "structured" | "shared" | "observed";
  mutation: "replace" | "transform" | "agent" | "external" | "none";
  actuation: "automatic" | "approval" | "human" | "unavailable";
}

export interface LensRef {
  lensId: EntityId;
  version: string;
  semanticHash: ContentHash;
}

export type ValidityState =
  | "valid"
  | "suspect"
  | "invalid"
  | "revalidating"
  | "repair-planned"
  | "blocked"
  | "unreachable";

export interface ProjectionUnit {
  id: EntityId;
  artifactId: EntityId;
  key: string;
  role:
    | "implementation"
    | "contract"
    | "test"
    | "fixture"
    | "documentation"
    | "comment"
    | "configuration"
    | "deployment"
    | "publication"
    | "telemetry"
    | "migration"
    | "supporting";
  anchor: SemanticAnchor;
  control: ControlPolicy;
  conceptIds: EntityId[];
  requirementIds: EntityId[];
  scenarioIds: EntityId[];
  lenses: LensRef[];
  tags: string[];
  structuralSignature: SemanticSignature;
  semanticSignature: SemanticSignature;
  membershipHash: ContentHash;
  validity: ValidityState;
  confidence: Confidence;
  causalOrigin: CausalOrigin;
  generatedFromUnitIds: EntityId[];
}
```

Line numbers MUST NOT be canonical anchors.

Split a Projection Unit only when a stable subregion changes independently, has separable governance/verification, and materially reduces work or conflict. Merge units when isolated identity or verification is not stable.

`requirementIds` and `scenarioIds` provide direct traceability where the mapping is known. They are not required to duplicate transitive Concept relationships. A Projection Unit may implement a capability Concept while its Requirement links are derived through that capability. Projector SHOULD materialize direct bindings only when they improve relevance, impact, verification, or explanation enough to justify their maintenance/derivation cost.


