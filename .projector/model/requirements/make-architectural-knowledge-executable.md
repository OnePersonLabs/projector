+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "requirement"
id = "requirement:executable-lenses"
key = "executable-lenses"
lifecycle = "active"

[metadata]
aliases = [ "architectural lenses", "predicate constrained implementations" ]
sourceClass = "authored"
+++

# Make architectural knowledge executable

An active architectural lens must select relevant observed units and contribute executable constraints or validators with explicit authority and assumptions. For handwritten code, accept different implementations that satisfy the predicates. Require exact output only when the lens explicitly owns deterministic generation. A prose description or an unregistered validator cannot establish conformance.

Host instructions are regenerable projections of canonical rules and state, and a hard rule cannot survive only as compact prose. An integration claim requires the actual authority, public composition and consumer, invalidation, observability, dogfood, installed delivery, and distinct positive and severed-edge evidence; a label, proxy, constant hash, or default-zero metric does not prove the mechanism is connected.

Selector, lens-membership, and effective-rule evaluation respects governance strata. Cross-cutting constraints may depend on lower-layer classifications but must not create feedback in which a rule changes the facts granting its own authority. Evaluate declared recursive rule or lens groups as strongly connected components with monotonic semantics or an explicit fixed-point function. A repeated state digest must distinguish convergence from a detected cycle, and an iteration limit must terminate evaluation. Nonconvergent or unevaluable governance cannot pass.

Mutating transforms have an applicability check, preview, apply, verification, and risk-appropriate recovery. They must be idempotent or declare bounded convergent fixed-point behavior; declare touched Projection Units, write scope, preconditions and dependency-scoped state binding; preview before applying; fail closed on unresolved semantic anchors; preserve unrelated formatting where practical; emit structured operation evidence; and verify postconditions. R1 changes provide rollback; higher-risk changes provide compensation or explicit irreversibility under the applicable policy.

Composition declares predecessor dependencies, mutual exclusions, commutativity, exclusive unit claims, postconditions, and fixed-point or convergence behavior. Unresolved overlapping exclusive claims block planning. Dependency cycles are explicit strongly connected components only when declared convergent; otherwise they are plan errors. These obligations require scoped invalidation and the recovery discipline retained by reverse reconciliation.

The complete public governance-termination checks and canonical transform-composition workflow remain explicitly unrealized by this ingestion. Existing internal contracts are partial implementation evidence, not proof of connected behavior. Reconsider missing governance checks when a supported evaluation or audit consumer needs their disclosed results, and canonical composition fields only when a named supported transform workflow cannot preserve these obligations using the existing Requirement and Scenario shapes. Do not infer a new schema or realization from a historical type alone.

Assess promotion of a lens or rule by governance impact as well as physical mutation risk. A mechanically reversible record can impose cross-package blocking consequences and therefore require higher governance review. Inferred patterns remain descriptive candidates until explicitly accepted with eligible authority and executable enforcement. Registered operation policy must resolve contradictory inputs explicitly; neither a small diff nor a permissive host changes the accepted meaning, required evidence or exact mutation authority.

<details>
<summary>Structured record details</summary>

```toml
evidence = []

[scope]
op = "any"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/engine/src/governance/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/control-plane/src/knowledge/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/control-plane/src/knowledge-governance.ts"

[[origin]]
kind = "user-request"
locator = "projector-recovered-premise:2026-09-09"
description = """Assistant synthesis of the user-directed recovered vision; implementation and economic advantage require \
  separate evidence."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/04-governance/lenses.md"
contentHash = "sha256:v1:89c8df1e703b614587c9a2db2afb2b80f4bb8d3bff3696fd724880519c3faf57"
description = "Historical proposal supporting this meaning; not automatic authority."

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/08-agents/hosts-and-mcp.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/08-agents/orchestration-and-models.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/12-delivery/acceptance-core.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/12-delivery/acceptance-representation.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/12-delivery/first-vertical-slice.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/12-delivery/release-and-directive.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/04-governance/scope-and-rules.md"
contentHash = "sha256:v1:40146a146f6a47465d9e8c7603477aad68dbd0a618b92aa3c82226e938cb9a83"
description = """Historical source evidence at lines 70-91 and 237-257; immutable Git blob cc91a991916c12d20caabda566ed1e21c1edd57f. \
  Content hash is SHA-256 of the exact Git blob bytes. Preserve useful conditions through explicit acceptance; \
  historical implementation prescriptions are not authority."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/05-projections/runtime-and-representations.md"
contentHash = "sha256:v1:a1aa287be9740885d83c0b5509f5274d57d80794b3a7d615f3cbf97282d841a0"
description = """Historical source evidence at lines 5-58 and 82-93; immutable Git blob 452e6b736a082992b65f0b286b60a7c4a515d93c. \
  Content hash is SHA-256 of the exact Git blob bytes. Preserve useful conditions through explicit acceptance; \
  historical implementation prescriptions are not authority."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/03-knowledge/risk-and-execution-policy.md"
contentHash = "sha256:v1:940550eed6cba1181611b16e901950cb61f679a9c5a14af36eda932978deac10"
description = """Historical contextual risk and governance-impact meaning, interpreted under current accepted host authorization \
  rather than old confinement/network delivery prescriptions. Source range 47-60; immutable Git blob \
  abe3e4a838844c9b3166569f501d8d9bd0a47c96; content hash is SHA-256 of exact blob bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/09-evolution/historical-evaluation-and-research.md"
contentHash = "sha256:v1:3f08636c635ee41916526fd47de9bda4846c47daf4e6680c6c49b2ddcbfc0e20"
description = """Historical evidence independence, possible relevance, shadow evaluation and concern-scoped research; \
  feasibility and uncertainty limits retained. Source range 3-63; immutable Git blob 139f6fc5d1063609d12f6edce0d6fe8e92eaba79; \
  content hash is SHA-256 of exact blob bytes."""

[[realizations]]
[realizations.selector]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/engine/src/governance/lenses.ts"

[realizations.origin]
kind = "git"
locator = "git:fbb691eb4b7bb62ef51e8d94ff97474782abb95a:packages/engine/src/governance/lenses.ts"
description = """Observed implementation surface for requirement:executable-lenses; the selector is evaluated from repository \
  facts."""

```
</details>
