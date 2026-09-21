+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:backdate-recursive-contracts-as-proof-group"
key = "backdate-recursive-contracts-as-proof-group"
lifecycle = "active"

[metadata]
aliases = [ "scenario:06:scc-backdating", "property:19:scc-invalidation-backdating-reaches-the-same-fixed-point-as-a-clean-group-recomputation", "adversary:10:scc-backdating" ]
sourceClass = "authored"
+++

# SCC backdating

## Given

Mutually recursive contract units retain externally visible exact signatures after an internal change.

## When

Create mutually recursive contract units whose externally visible exact signatures remain unchanged after an internal change.

## Then

Projector evaluates the SCC as one proof group and reaches a fixed point. Downstream consumers remain valid only after all relevant group signatures regain eligible assurance.

## Then

Property across the applicable input population: SCC invalidation/backdating reaches the same fixed point as a clean group recomputation.

## Given

Adversarial evaluation must exercise this class and reject false success: SCC backdating.

## Then

Unit evaluation must cover: derivations/SCCs/backdating.

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
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-core.md"
contentHash = "sha256:v1:5471e7090610ccdf0d8e567ec2ea1cbba53dc726f6ea53d51f9cac52d994d0fc"
description = """Historical acceptance conditions, lines 43-49; immutable Git blob 804692b98650789629c95b699fa20de3b026d634. \
  Content hash is SHA-256 of exact source blob bytes. Source conditions require reviewed disposition, \
  not automatic authority."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact property condition 19; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 10; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 21; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

```
</details>
