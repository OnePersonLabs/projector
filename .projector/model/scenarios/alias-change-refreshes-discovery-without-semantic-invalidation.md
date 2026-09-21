+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:refresh-discovery-without-semantic-invalidation"
key = "refresh-discovery-without-semantic-invalidation"
lifecycle = "active"

[metadata]
aliases = [ "scenario:30:alias-change-refreshes-discovery-without-semantic-invalidation", "property:18:alias-name-only-changes-alter-discovery-canonical-document-hashes-but-not-semantic-meaning-hashes-and-therefore-refresh-affected-identity-relevance-queries-without-staling-meaning-only-derivations" ]
sourceClass = "authored"
+++

# Alias change refreshes discovery without semantic invalidation

## Given

Acceptance case "Alias change refreshes discovery without semantic invalidation": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Add a new accepted synonym to an existing Requirement/Concept without changing its statement, behavioral scope, or other semantic fields.

## Then

- stable entity ID remains unchanged.
- `discoveryHash` and complete canonical snapshot/document hash change.
- `semanticHash` remains unchanged.
- identity-search/Relevance query dependencies whose results are affected are re-evaluated.
- derivations/plans that bind only the unchanged semantic meaning are not invalidated solely because the synonym changed.
- a later request using the new synonym resolves to the existing identity.

## Then

Property across the applicable input population: alias/name-only changes alter discovery/canonical-document hashes but not semantic meaning hashes, and therefore refresh affected identity/relevance queries without staling meaning-only derivations.

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
description = """Full acceptance case \"Alias change refreshes discovery without semantic invalidation\", starting line \
  14; immutable Git blob 5d6f3dca8cdea899e17922829e54d0561c8f940a. Hash binds original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact property condition 18; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

```
</details>
