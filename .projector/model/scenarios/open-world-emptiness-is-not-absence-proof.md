+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:refuse-absence-proof-from-open-query"
key = "refuse-absence-proof-from-open-query"
lifecycle = "active"

[metadata]
aliases = [ "scenario:45:open-world-emptiness-is-not-absence-proof", "property:07:an-empty-query-on-an-open-sampled-unavailable-lane-never-upgrades-a-negative-space-claim-to-proof", "adversary:27:open-sampled-discovery-lane-incorrectly-proving-absence" ]
sourceClass = "authored"
+++

# Open-world emptiness is not absence proof

## Given

Acceptance case "Open-world emptiness is not absence proof": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Run an event/contract-consumer discovery lane whose enumeration is `sampled` or `open` and returns no additional consumers.

## Then

- the empty result may contribute supporting context.
- Projector records the lane/assumptions in the query-result fingerprint and Relevance Closure unknown/frontier.
- Projector MUST NOT conclude that no other consumers exist or use the empty result to produce a proof-strength closure claim.
- changing the lane to `closed`/eligible `bounded` and re-evaluating may establish the stronger absence result.

## Then

Property across the applicable input population: an empty query on an open/sampled/unavailable lane never upgrades a negative-space claim to proof.

## Given

Adversarial evaluation must exercise this class and reject false success: Open/sampled discovery lane incorrectly proving absence.

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
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md"
contentHash = "sha256:v1:11d59a588b7fa0a781ace0a04b81e0856a45b59bbaba6fe0cf433e7200a16b39"
description = """Full acceptance case \"Open-world emptiness is not absence proof\", starting line 152; immutable Git \
  blob 5d6f3dca8cdea899e17922829e54d0561c8f940a. Hash binds original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact property condition 7; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 27; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

```
</details>
