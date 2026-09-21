+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "requirement"
id = "requirement:runtime-evidence-legibility"
key = "runtime-evidence-legibility"
lifecycle = "active"

[metadata]
aliases = []
sourceClass = "authored"
+++

# Connect affected meaning to inspectable application behavior

When accepted meaning needs application observation, use a supported adapter with an identifiable build and endpoint, owned setup and teardown, fresh state, explicit trust assumptions and the inputs needed for the observation. Bind evidence to the scenario, source or build, controller state, collection method and freshness. Keep outcome, operational status, currentness and assurance separate. Retain diagnostics when collection fails or is unavailable, and do not claim outcomes that the adapter did not observe.

A host reports its actual capabilities, limits and unavailable surfaces. A command declares its working directory, reads, writes, network need, environment, time, resources and side effects; pass opaque arguments without shell interpolation. Remote observations identify their adapter version and revision. Pin deterministic comparisons to the required snapshot. A refreshed remote state creates a new revision and may invalidate dependent work.

Keep application observation, planning, approval, application and recovery as separate capabilities with explicit inputs and evidence. Do not retain an obsolete delivery transport or create a production interface solely to satisfy an isolated release test.

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
value = "packages/core/src/schemas/application-evidence-*.ts"

[[scope.items]]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/control-plane/src/knowledge/application-evidence.ts"

[[scope.items]]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/cli/src/operational-verification.ts"

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
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/10-operation/cli-modes-and-security.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/10-operation/observability-and-reporting.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/12-delivery/acceptance-core.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/12-delivery/release-and-directive.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md"
contentHash = "sha256:v1:ff986a014ff0cd8b7be189b106e183b54096efb5b3e55e82e5809be5f7981209"
description = """Historical friction-driven modernization, rejection reasons and snapshot/open-world surface conditions; \
  distinct from persisted-data upgrades. Source range 3-102; immutable Git blob a46c14c6a463bb973f562517fe6240e48f1fcc75; \
  content hash is SHA-256 of exact blob bytes."""

[[realizations]]
[realizations.selector]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/runtime/src/execution/command-executor.ts"

[realizations.origin]
kind = "git"
locator = "git:fbb691eb4b7bb62ef51e8d94ff97474782abb95a:packages/runtime/src/execution/command-executor.ts"
description = """Observed implementation surface for requirement:runtime-evidence-legibility; the selector is evaluated \
  from repository facts."""

```
</details>
