+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "requirement"
id = "requirement:scoped-invalidation"
key = "scoped-invalidation"
lifecycle = "active"

[metadata]
aliases = [ "stale knowledge", "dependency-scoped reuse" ]
sourceClass = "authored"
+++

# Reuse knowledge with scoped invalidation

Bind retained reasoning and derived artifacts to their exact semantic values and query results, including empty queries and selector membership. After a known delta, traverse exact derivation dependencies before versioned impact rules; pre-edit relevance is not dependency proof. Reuse unaffected knowledge despite unrelated changes. Backdate only when the registered signature profile proves every required preserved dimension; unchanged structure proves neither behavior nor validation. Changed dependencies or new consumers invalidate affected reasoning. Unknown profiles, missing baselines and open populations remain unknown; rebuilding them does not make runtime caches canonical.

Bind mutation authority to the exact session, plan and approval hash, value/query dependencies, operations, semantic/write scope, risk, expiry and representation profile. Relevant changed or unprovable dependencies invalidate authority. Unrelated root-digest changes trigger validation and may rebind without blanket invalidation. Execution mode changes permission only, never meaning or proof. Stale approvals cannot replay.

Bind transform applicability, preconditions, touched units and write scope to dependency-scoped state before preview and apply. Preserve composition dependencies and exclusive claims; fail on unresolved semantic anchors or overlapping claims. Verify declared postconditions with structured evidence. Preserve executable-lens composition/convergence and reverse-reconciliation upstream-first repair obligations. Full composition/repair enforcement remains unrealized until a named public planning or repair consumer exercises it; internal types and mappings are not fulfillment.

Plans are immutable revisions. Partial execution preserves dependency integrity. Changed repository, canonical, toolchain or external state requires explicit refresh/rebase: recompute snapshot identity, validate/rebind scoped state, retain valid assumptions/closures, recompile stale capsules/packets, carry completed work only with valid proof, emit a new revision and invalidate stale approvals. Governance conflicts block execution pending resolution; automatic semantic Git conflict resolution is not required. A changed global snapshot with current bound values/queries permits lightweight immutable rebind without recomputing unaffected analysis; explain it separately from semantic rebase.

Bounded saved-context/lifecycle continuation and query/profile currentness explanations must retain independently valid work. Unrestricted multi-packet checkpoint orchestration remains unrealized; revisit when a supported multi-packet plan loses valid work or risks stale authority.

Risk includes uncertainty, unresolved identity/ownership, weak coverage/validation, stale observations, open frontiers and limited rollback. More uncertainty never reduces risk or approvals. Highest-risk destructive, production-security, billing, identity or irreversible-release actions are not autonomous. Actual authorization and host permissions govern; historical risk tables grant neither permission nor confinement. Conflicting policies fail explicitly.

Repository observation must complete its declared inventory within explicit finite resource limits or fail without publishing a usable partial snapshot or replacing a previous baseline. Completeness of inventory does not imply semantic completeness for unsupported constructs. Bind snapshots to versioned enumeration scope and effective exclusion inputs; incompatible observations require fresh context and cannot establish file additions or removals. Derived contexts and impact snapshots are disposable, size-bounded caches without age-based expiration. Evict least-recently-used eligible entries while preserving live operations and unfinished/recoverable lifecycle dependencies; admission fails when safe capacity cannot be established. Durable approvals, receipts, journals, canonical meaning and embedded historical lifecycle proof are not cache eviction targets.

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
value = "packages/engine/src/state/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/engine/src/query/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/engine/src/invalidation/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/control-plane/src/knowledge/**"

[[origin]]
kind = "user-request"
locator = "projector-recovered-premise:2026-09-09"
description = """Assistant synthesis of the user-directed recovered vision; implementation and economic advantage require \
  separate evidence."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md"
contentHash = "sha256:v1:d9138ea33f193fb42d96d25e952bc29e5400b18494f1dbc0b4f9a4b49477b703"
description = "Historical proposal supporting this meaning; not automatic authority."

[[origin]]
kind = "user-request"
locator = "conversation:2026-09-09:architectural-reasons-and-harness-assimilation"
description = """The user explicitly requires architectural choices, rejected options and reasons to survive, and requests \
  useful harness practices be assimilated without flattening Projector into instructions."""

[[origin]]
kind = "external"
locator = "https://openai.com/index/harness-engineering/"
description = """Motivating integration evidence; not authority for Projector-specific design or claimed implementation."""

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
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/10-operation/cli-modes-and-security.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/12-delivery/acceptance-core.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/12-delivery/acceptance-representation.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md"
contentHash = "sha256:v1:d9138ea33f193fb42d96d25e952bc29e5400b18494f1dbc0b4f9a4b49477b703"
description = """Historical source evidence at lines 218-259; immutable Git blob cf6ef40eab7b5d382e30e0d11cd00ec97f9506b9. \
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
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/07-change/plans.md"
contentHash = "sha256:v1:67a92413adb5e88b993d5104f755e674a4b9a4e243d2ef491947e6987ed2d39c"
description = """Historical immutable continuation, dependency integrity, rebase and rebind evidence. Source range 5-51; \
  Git blob c69544cc71bc2c4bf1b3ab3fbfb78a0c08fbfe25; content hash is SHA-256 of exact blob bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/03-knowledge/risk-and-execution-policy.md"
contentHash = "sha256:v1:940550eed6cba1181611b16e901950cb61f679a9c5a14af36eda932978deac10"
description = """Historical contextual risk and governance-impact meaning, interpreted under current accepted host authorization \
  rather than old confinement/network delivery prescriptions. Source range 47-60; immutable Git blob \
  abe3e4a838844c9b3166569f501d8d9bd0a47c96; content hash is SHA-256 of exact blob bytes."""

[[origin]]
kind = "document"
locator = "git:2af21351ca06af4943e73692ae4ea26700467b19:packages/engine/src/state/index.ts"
contentHash = "sha256:v1:53f94810dba93edb69239d4dd8887459d35a9048f312bcdf55bab1b136d52fdf"
description = """Accepted second source-absent increment: observed old/current values and query membership explain scoped \
  currentness while unrelated edits retain reuse. Independent same-HEAD value and query-membership changes \
  exercised this distinction. This does not establish exhaustive dependency inference, universal equivalence \
  or economic advantage."""

[[origin]]
kind = "user-request"
locator = "conversation:2026-09-13:bounded-observation-approved-plan"
description = """User explicitly requested implementation of the reviewed complete-or-fail observation and size-bounded \
  disposable cache plan."""

[[realizations]]
[realizations.selector]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/engine/src/state/index.ts"

[realizations.origin]
kind = "git"
locator = "git:fbb691eb4b7bb62ef51e8d94ff97474782abb95a:packages/engine/src/state/index.ts"
description = """Observed implementation surface for requirement:scoped-invalidation; the selector is evaluated from \
  repository facts."""

```
</details>
