+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "requirement"
id = "requirement:pre-edit-relevance"
key = "pre-edit-relevance"
lifecycle = "active"

[metadata]
aliases = [ "relevance before editing", "request-first context" ]
sourceClass = "authored"
+++

# Determine relevance before choosing edits

Given a requested outcome, retrieve existing meaning, constraints, decisions, and distant consumers before choosing implementation paths. Traverse typed canonical relations and implementation bindings with explicit reasons and bounds. Distinguish candidate interpretations and unknown frontiers from confirmed identity or absence. Post-edit impact analysis does not replace this step.

Order work from deterministic observation and transforms through cheap bounded classification to implementation and frontier review; use model rendering only for deterministic residue. Analysis facets may add applicable obligations but cannot choose technology. General multi-model routing remains deferred until a supported public workflow supplies a concrete consumer and measured need.

Repeated historical/co-change relationships may seed possible relevance across semantic neighborhoods not explained by deterministic topology. They remain contextual/inferred: co-change alone establishes neither an exact dependency nor an impact rule or authority claim. Repeated observed Planning Surprises can provide stronger evidence of an omitted relationship, but still require explicit acceptance before promotion. Preserve independently sourced examples, alternatives, counterexamples and uncertainty rather than treating copied ancestry as corroboration.

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
value = "packages/control-plane/src/knowledge/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/engine/src/relevance/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/engine/src/context/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/cli/src/operation-runner.ts"

[[origin]]
kind = "user-request"
locator = "projector-recovered-premise:2026-09-09"
description = """Assistant synthesis of the user-directed recovered vision; implementation and economic advantage require \
  separate evidence."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md"
contentHash = "sha256:v1:7630d0d66c3c9eea8affd2dbf17adf2bdc24bb076f7536edeb4164ba698728fa"
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
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md"
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
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/09-evolution/historical-evaluation-and-research.md"
contentHash = "sha256:v1:3f08636c635ee41916526fd47de9bda4846c47daf4e6680c6c49b2ddcbfc0e20"
description = """Historical evidence independence, possible relevance, shadow evaluation and concern-scoped research; \
  feasibility and uncertainty limits retained. Source range 3-63; immutable Git blob 139f6fc5d1063609d12f6edce0d6fe8e92eaba79; \
  content hash is SHA-256 of exact blob bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/02-semantic-kernel/terminology-and-source-classes.md"
contentHash = "sha256:v1:4f4dcb11b9e7e6eddd3a2b2e23ab542510ffcaea8ab49448b77b6c79902056d5"
description = """Historical source-class boundaries; executable field/type definitions remain owned by core. Source range \
  59-126; immutable Git blob 4ab4e468cafafed5a8d68633f1249586e578f4ac; content hash is SHA-256 of exact \
  blob bytes."""

[[realizations]]
[realizations.selector]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/control-plane/src/knowledge/service.ts"

[realizations.origin]
kind = "git"
locator = "git:fbb691eb4b7bb62ef51e8d94ff97474782abb95a:packages/control-plane/src/knowledge/service.ts"
description = """Observed implementation surface for requirement:pre-edit-relevance; the selector is evaluated from repository \
  facts."""

```
</details>
