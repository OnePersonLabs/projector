+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:bound-context-despite-weak-similarity-neighbors"
key = "bound-context-despite-weak-similarity-neighbors"
lifecycle = "active"

[metadata]
aliases = [ "scenario:35:relevance-over-expansion-refusal", "adversary:21:relevance-over-expansion-returning-effectively-project-wide-context" ]
sourceClass = "authored"
+++

# Relevance over-expansion refusal

## Given

Acceptance case "Relevance over-expansion refusal": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Create a large semantic graph with one localized change and many weak semantic-similarity neighbors.

## Then

- direct/governing context remains bounded.
- weak neighbors are dropped or retained only in the possible band with concise rationale.
- the Context Compiler does not serialize the entire semantic graph.
- metrics expose irrelevant expansion.

## Given

Adversarial evaluation must exercise this class and reject false success: Relevance over-expansion returning effectively project-wide context.

## Then

Unit evaluation must cover: Relevance Closure expansion, banding, provenance, budget termination, and dependency fingerprints.

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
description = """Full acceptance case \"Relevance over-expansion refusal\", starting line 65; immutable Git blob 5d6f3dca8cdea899e17922829e54d0561c8f940a. \
  Hash binds original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 21; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 6; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

```
</details>
