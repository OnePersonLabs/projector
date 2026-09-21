+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:invalidate-only-profile-dependent-projections"
key = "invalidate-only-profile-dependent-projections"
lifecycle = "active"

[metadata]
aliases = [ "scenario:54:representation-profile-invalidation", "property:24:changing-only-a-representation-profile-never-changes-canonical-semantic-hashes-of-its-source-entities" ]
sourceClass = "authored"
+++

# Representation-profile invalidation

## Given

Acceptance case "Representation-profile invalidation": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Change only `agent-compact@1` to a new version while canonical concepts, rules, decisions, and predicates remain unchanged.

## Then

affected agent-context projections/capsules become suspect and regenerate. Human/machine projections that do not depend on the changed profile remain valid. Canonical semantic source hashes and architecture decisions do not dirty merely because the encoding profile changed.

## Then

Property across the applicable input population: changing only a Representation Profile never changes canonical semantic hashes of its source entities.

<details>
<summary>Structured record details</summary>

```toml
realizations = []
evidence = []

[scope]
op = "atom"
field = "requirement"
matcher = "equals"
value = "requirement:scoped-invalidation"

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-representation.md"
contentHash = "sha256:v1:da531331605b94681697c33a4a763da6dfabe19200cc37d73c93798efb1af3b5"
description = """Full acceptance case \"Representation-profile invalidation\", starting line 24; immutable Git blob 71ed07c17947350b56fb1728be386de2071d1a22. \
  Hash binds original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact property condition 24; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

```
</details>
