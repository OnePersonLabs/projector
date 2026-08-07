# Modernization and External Surfaces

## Modernization engine

## Triggers

- repeated divergence.
- repeated agent difficulty.
- repeated Planning Surprises or missed relevance relationships.
- high invalidation fan-out.
- duplicated abstractions.
- unsupported dependency.
- security/support issues.
- slow feedback loop.
- architecture erosion.
- frequent migration overlays.
- platform incompatibility.
- user request.

## Recommendation contract

A proposal MUST identify the problem before naming technology.

It includes:

- current state.
- observed cost.
- target state.
- alternatives.
- evidence/counterevidence.
- affected Concepts/Requirements and Relevance Closure.
- estimated affected units.
- compatibility strategy.
- migration phases.
- rollback.
- cleanup criteria.
- risk.
- confidence.

## Fashion resistance

Reject an upgrade when:

- current state meets requirements at lower total cost.
- target support is immature.
- migration cost exceeds demonstrated recurring pain.
- benefit depends on speculative scale.
- external rationale does not fit local constraints.
- reversibility is poor and evidence is weak.

Approved upgrades become semantic changes plus migration overlays.

Modernization MUST NOT maintain a separate architecture-ranking system. Upgrade triggers create or dirty Architecture Concerns. Recommendations use the Decision Evaluation, research freshness, preference, Authority Record, Governance Basis, and Decision Consequence machinery in [Progressive Architecture Commitment](../03-knowledge/architecture-decisions.md).

---


## Surface adapters and external observation snapshots

Surface contracts exist from the beginning, but broad external implementations are intentionally later than the local correctness kernel.

```ts
export interface SurfaceAdapter {
  id: string;
  kind: Surface["kind"];
  capabilities: SurfaceCapabilities;
  enumeration: EnumerationContract;

  discover(context: AdapterContext): Promise<Surface[]>;
  inventory(surface: Surface, context: AdapterContext): Promise<Artifact[]>;
  fingerprint(artifact: Artifact, context: AdapterContext): Promise<ArtifactFingerprint>;

  plan?(change: SurfaceChange, context: AdapterContext): Promise<SurfacePlan>;
  apply?(plan: SurfacePlan, context: AdapterContext): Promise<SurfaceApplyResult>;
  validate?(plan: SurfacePlan, context: AdapterContext): Promise<ValidationResult[]>;
}
```

Mutation methods are optional. A read-only or unavailable API MUST NOT fake a writable implementation.

## Initial repository-local surfaces

- filesystem.
- Git.
- workspace/package manifests.
- minimal JavaScript/TypeScript structure required by the first vertical slice.
- then broader TypeScript/JavaScript.
- structured data.
- Markdown.
- GitHub Actions.

## External snapshots

External observations MUST be captured into a timestamped, adapter-versioned observation revision. A semantic transaction that needs deterministic comparison pins a specific external snapshot digest in `StateDigest`.

Refreshing a remote service creates a new observation revision and may invalidate dependent plans/derivations. Live external state is never silently part of a local rebuild.

## Unavailable and open-world surfaces

Unavailable required surfaces become explicit frontier/manual actions. Open/sampled surfaces state their blind spots and MAY support drift evidence without permitting `proven-within-boundary` for claims depending on full enumeration.

---


