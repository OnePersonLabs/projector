+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:discover-event-consumers-from-known-topology"
key = "discover-event-consumers-from-known-topology"
lifecycle = "active"

[metadata]
aliases = [ "scenario:36:event-topology-discovers-non-obvious-consumers" ]
sourceClass = "authored"
+++

# Event topology discovers non-obvious consumers

## Given

Acceptance case "Event topology discovers non-obvious consumers": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Model `MidiNoteCaptured` as an event Concept with known producers/consumers in recording, multiplayer, scoring, and visualization. Request a semantic schema change to the event.

## Then

known consumers enter relevance deterministically from producer/consumer topology before model inference. Missing model recall cannot hide a consumer already present in the graph.

## Given

Adversarial evaluation must exercise this class and reject false success: Event/contract consumer omission despite deterministic topology.

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
description = """Full acceptance case \"Event topology discovers non-obvious consumers\", starting line 76; immutable \
  Git blob 5d6f3dca8cdea899e17922829e54d0561c8f940a. Hash binds original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 22; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

```
</details>
