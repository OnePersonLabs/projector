+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:preserve-meaning-after-canonical-storage-move"
key = "preserve-meaning-after-canonical-storage-move"
lifecycle = "active"

[metadata]
aliases = [ "scenario:49:semantic-storage-path-does-not-define-meaning", "property:02:splitting-canonical-entities-into-independent-files-does-not-alter-semantic-project-root-identity" ]
sourceClass = "authored"
+++

# Semantic storage path does not define meaning

## Given

Acceptance case "Semantic storage path does not define meaning": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Move a canonical Concept file to a deterministic shard directory without changing its stable ID or semantic fields.

## Then

semantic identity, relationships, relevance, and semantic hash remain unchanged. Only storage/index metadata changes.

## Then

Property across the applicable input population: splitting canonical entities into independent files does not alter semantic project-root identity.

<details>
<summary>Structured record details</summary>

```toml
realizations = []
evidence = []

[scope]
op = "atom"
field = "requirement"
matcher = "equals"
value = "requirement:durable-meaning"

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md"
contentHash = "sha256:v1:11d59a588b7fa0a781ace0a04b81e0856a45b59bbaba6fe0cf433e7200a16b39"
description = """Full acceptance case \"Semantic storage path does not define meaning\", starting line 187; immutable \
  Git blob 5d6f3dca8cdea899e17922829e54d0561c8f940a. Hash binds original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact property condition 2; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

```
</details>
