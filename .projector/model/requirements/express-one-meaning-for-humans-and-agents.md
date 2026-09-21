+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "requirement"
id = "requirement:engineering-english"
key = "engineering-english"
lifecycle = "active"

[metadata]
aliases = [ "simplified engineering English", "controlled English" ]
sourceClass = "authored"
+++

# Express one meaning for humans and agents

Express accepted meaning in plain technical English that people and agents can use directly. Preserve conditions, exceptions, identifiers, normative force, causal distinctions and reasons that still affect decisions. Markdown prose and typed metadata are one canonical source, parsed into Core contracts; there is no independently editable compressed specification.

Default task context contains deduplicated whole meaningful sections, applicable rationale, current evidence, typed relationships and explicit unknowns. Historical provenance, hashes and execution transcripts are available on inspection rather than repeated in each packet. Never hide an obligation or unresolved retrieval frontier to meet a display budget. Rendering preserves authored meaning; it does not prove semantic truth or agent understanding.

Review and remove rejected transient ideas, unexplained references, duplicated instructions and obsolete implementation prescriptions through explicit meaning revisions. Preserve useful rationale, uncertainty and reopening conditions. Style lint is advisory; short text is not automatically correct or useful. Caveman compression is not the canonical artifact format.

Measure composed context and subsequent work, including retrieval, repair and maintenance. Use direct representation-fidelity, currentness, source-association and recovery checks. An installed workflow exercise covers actual delivery. Do not introduce certification reports, duplicate execution or a transcript-processing framework merely to record that checks ran.

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
value = "packages/engine/src/representation/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/engine/src/context/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/core/src/domain/contracts.ts"

[[origin]]
kind = "user-request"
locator = "projector-recovered-premise:2026-09-09"
description = """Assistant synthesis of the user-directed recovered vision; implementation and economic advantage require \
  separate evidence."""

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
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/12-delivery/acceptance-representation.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/12-delivery/release-and-directive.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/05-projections/runtime-and-representations.md"
contentHash = "sha256:v1:a1aa287be9740885d83c0b5509f5274d57d80794b3a7d615f3cbf97282d841a0"
description = """Historical source evidence at lines 5-58 and 82-93; immutable Git blob 452e6b736a082992b65f0b286b60a7c4a515d93c. \
  Content hash is SHA-256 of the exact Git blob bytes. Preserve useful conditions through explicit acceptance; \
  historical implementation prescriptions are not authority."""

[[origin]]
kind = "user-request"
locator = "user:2026-09-11:projection-feedback-proportionate-verification"
description = """The user explicitly authorized an immediate corrective pivot: code is a revisable projection of conceptual \
  meaning, implementation discoveries may defensibly amend the plan, and verification must protect concrete \
  behavior rather than create repetitive certification overhead. Preserve required behavior, critical \
  review, data safety, authority and recovery."""

[[origin]]
kind = "document"
locator = "git:ce7d2e92378921dfdce97f23bca076d795bc31af:packages/engine/src/representation/index.ts"
contentHash = "sha256:v1:14b500eeee082a4c597c86608187875705680128397acc3b5b096963a017c62f"
description = """Accepted P3 local correction: preserve the immutable historical machine-invariant@1 descriptor while \
  selecting @2 separately. The observed hash-regression repair is protected by its historical fixed-hash \
  regression and installed reconciliation preserving prior capture/approval, refusing bad binding, missing \
  artifact and already-current cases. A fresh replacement remains unapproved. No new policy/classifier \
  is inferred from this local repair; conditional paired probes remain conditional."""

[[origin]]
kind = "document"
locator = "git:73555e2c334d105c13727dcf9b542100df177ddb:scripts/run-release-acceptance.mjs"
contentHash = "sha256:v1:129512c022e1c48878d350b41ba3e05fe44778b8024f4e4c224461c88f0b195d"
description = """Accepted coherent integration of independently prepared release checks and canonical test bindings: \
  the coordinator resolved removed certificate API/exact test-identity consumers and the distinction \
  between an environment-conditional installed test and regular mapped checks. The final release directly \
  awaits installed checks; the mapped profile check does not claim packaged delivery. Integrated release \
  execution passed. This shared-contract resolution does not establish general automatic conflict resolution."""

[[realizations]]
[realizations.selector]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/engine/src/representation/index.ts"

[realizations.origin]
kind = "git"
locator = "git:fbb691eb4b7bb62ef51e8d94ff97474782abb95a:packages/engine/src/representation/index.ts"
description = """Observed implementation surface for requirement:engineering-english; the selector is evaluated from \
  repository facts."""

```
</details>
