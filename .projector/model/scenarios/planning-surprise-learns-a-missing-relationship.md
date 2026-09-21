+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:learn-evidenced-missing-relationship-after-surprise"
key = "learn-evidenced-missing-relationship-after-surprise"
lifecycle = "active"

[metadata]
aliases = [ "scenario:46:planning-surprise-learns-a-missing-relationship" ]
sourceClass = "authored"
+++

# Planning Surprise learns a missing relationship

## Given

Acceptance case "Planning Surprise learns a missing relationship": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Plan a MIDI timing change whose Relevance/Impact Closure omits replay normalization. During legitimate implementation, deterministic reverse analysis shows replay semantics were necessarily affected.

## Then

- reconciliation emits a Planning Surprise instead of silently pretending the original plan predicted replay.
- Projector classifies whether this is legitimate scope growth, a missing Relation/analyzer/facet, or agent overreach.
- if evidence supports a reusable relationship, it is proposed through normal source-class/authority rules.
- a future equivalent change discovers replay earlier.

## Given

Adversarial evaluation must exercise this class and reject false success: Predicted-versus-observed impact surprise and relationship learning.

## Then

Unit evaluation must cover: predicted-versus-observed impact comparison and Planning Surprise classification.

<details>
<summary>Structured record details</summary>

```toml
realizations = []
evidence = []

[scope]
op = "atom"
field = "requirement"
matcher = "equals"
value = "requirement:reverse-reconciliation"

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md"
contentHash = "sha256:v1:11d59a588b7fa0a781ace0a04b81e0856a45b59bbaba6fe0cf433e7200a16b39"
description = """Full acceptance case \"Planning Surprise learns a missing relationship\", starting line 164; immutable \
  Git blob 5d6f3dca8cdea899e17922829e54d0561c8f940a. Hash binds original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 28; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 25; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

```
</details>
