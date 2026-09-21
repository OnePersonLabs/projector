+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:activate-facets-without-technology-lock-in"
key = "activate-facets-without-technology-lock-in"
lifecycle = "active"

[metadata]
aliases = [ "scenario:50:analysis-facets-compose-without-methodology-lock-in" ]
sourceClass = "authored"
+++

# Analysis Facets compose without methodology lock-in

## Given

Acceptance case "Analysis Facets compose without methodology lock-in": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Run one simple behavior-only change and one realtime event/public-contract change.

## Then

- the first activates only the minimal useful facets.
- the second activates behavior + events + realtime + public-contract facets because their predicates apply.
- facet activation adds discovery/verification obligations but does not preselect an implementation technology.

## Then

Unit evaluation must cover: Analysis Facet activation without accidental governance.

<details>
<summary>Structured record details</summary>

```toml
realizations = []
evidence = []

[scope]
op = "atom"
field = "requirement"
matcher = "equals"
value = "requirement:pre-edit-relevance"

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md"
contentHash = "sha256:v1:11d59a588b7fa0a781ace0a04b81e0856a45b59bbaba6fe0cf433e7200a16b39"
description = """Full acceptance case \"Analysis Facets compose without methodology lock-in\", starting line 193; immutable \
  Git blob 5d6f3dca8cdea899e17922829e54d0561c8f940a. Hash binds original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 7; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

```
</details>
