+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "requirement"
id = "requirement:durable-meaning"
key = "durable-meaning"
lifecycle = "active"

[metadata]
aliases = [ "conceptual operations", "stable meaning", "semantic identity" ]
sourceClass = "authored"
+++

# Durable conceptual operations

Retain accepted meaning under stable identities across changes and sessions. Reuse an existing Requirement or Scenario when it owns the meaning. Treat wording, aliases, paths, and similarity as discovery evidence; they cannot by themselves prove semantic equivalence or authorize a new identity. Preserve explicit split, merge, replacement, and deletion history.

Keep the semantic core provider-neutral. Agent and model output remains a candidate until deterministic policy or explicit acceptance promotes it; resampling cannot mutate accepted architecture or redefine identity. Fine-grained storage, filenames, sharding, wording, and implementation replacement do not change stable identity, meaning, relations, or lineage.

The conceptual model owns intended behavior. Code and implementation plans are revisable realizations. Incremental projection is a practical efficiency choice, not a requirement to preserve generated code. Planning and implementation inform each other. Feed discoveries back into an explicit model revision when intended behavior changes. Critically assess revisions against preserved behavior, constraints, data safety and recovery, rather than conformance to an earlier procedure. Keep unresolved meaning explicit. Evaluate projection, verification and maintenance effort together; a report or internally consistent model does not establish net benefit.

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
value = "packages/engine/src/identity/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/core/src/identity/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/runtime/src/persistence/**"

[[origin]]
kind = "user-request"
locator = "projector-recovered-premise:2026-09-09"
description = """Assistant synthesis of the user-directed recovered vision; implementation and economic advantage require \
  separate evidence."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/02-semantic-kernel/identity-and-relations.md"
contentHash = "sha256:v1:d5b86822bdd85d18e9003399e2f3dcee2580201c635ddde302d87fe8b58c04ef"
description = "Historical proposal supporting this meaning; not automatic authority."

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
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/12-delivery/implementation-plan.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/12-delivery/release-and-directive.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "user-request"
locator = "user:2026-09-11:projection-feedback-proportionate-verification"
description = """The user explicitly authorized an immediate corrective pivot: code is a revisable projection of conceptual \
  meaning, implementation discoveries may defensibly amend the plan, and verification must protect concrete \
  behavior rather than create repetitive certification overhead. Preserve required behavior, critical \
  review, data safety, authority and recovery."""

[[realizations]]
[realizations.selector]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/runtime/src/persistence/canonical-repository.ts"

[realizations.origin]
kind = "git"
locator = "git:fbb691eb4b7bb62ef51e8d94ff97474782abb95a:packages/runtime/src/persistence/canonical-repository.ts"
description = """Observed implementation surface for requirement:durable-meaning; the selector is evaluated from repository \
  facts."""

```
</details>
