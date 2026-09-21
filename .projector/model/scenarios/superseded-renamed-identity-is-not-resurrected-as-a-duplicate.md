+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:resolve-lineage-without-resurrecting-identity"
key = "resolve-lineage-without-resurrecting-identity"
lifecycle = "active"

[metadata]
aliases = [ "scenario:31:superseded-renamed-identity-is-not-resurrected-as-a-duplicate" ]
sourceClass = "authored"
+++

# Superseded/renamed identity is not resurrected as a duplicate

## Given

Acceptance case "Superseded/renamed identity is not resurrected as a duplicate": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Create a semantic identity, move/rename/supersede it through explicit lineage, then request behavior using terminology associated with the earlier identity.

## Then

- identity resolution inspects active identities plus relevant aliases, lineage, tombstones, and superseded entities.
- Projector resolves to the surviving/replacement identity or presents an explicit split/new-identity decision.
- it does not mint a fresh identity merely because the old canonical name/path no longer appears among active entities.

## Then

Unit evaluation must cover: stable IDs, aliases, lineage, tombstones.

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
description = """Full acceptance case \"Superseded/renamed identity is not resurrected as a duplicate\", starting line \
  27; immutable Git blob 5d6f3dca8cdea899e17922829e54d0561c8f940a. Hash binds original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 2; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

```
</details>
