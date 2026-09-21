+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:reuse-identity-for-synonymous-request"
key = "reuse-identity-for-synonymous-request"
lifecycle = "active"

[metadata]
aliases = [ "scenario:29:synonymous-request-reuses-canonical-identity", "property:17:identity-resolution-renames-aliases-cannot-create-a-second-identity-for-the-same-selected-entity", "adversary:19:semantic-identity-duplicate-overlap-creation-under-synonymous-requests" ]
sourceClass = "authored"
+++

# Synonymous request reuses canonical identity

## Given

Acceptance case "Synonymous request reuses canonical identity": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Canonical state already contains `CAP-MIDI-DEVICE-DISCOVERY` with aliases including `midi devices` and `device enumeration`. Request "add wireless MIDI device enumeration." Seed nearby code and docs that use several different phrases.

## Then

- Semantic Identity Resolution ranks the existing capability as the owner.
- no second capability is created merely because wording differs.
- if BLE-specific behavior is distinct, Projector modifies the existing capability and Requirements or proposes a narrower new identity. The new identity includes owns/excludes boundaries and nearest candidates.
- the resolution remains inspectable.

## Then

Property across the applicable input population: identity-resolution renames/aliases cannot create a second identity for the same selected entity.

## Given

Adversarial evaluation must exercise this class and reject false success: Semantic identity duplicate/overlap creation under synonymous requests.

## Then

Unit evaluation must cover: Semantic Identity Resolution candidate ranking/outcome validation.

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
description = """Full acceptance case \"Synonymous request reuses canonical identity\", starting line 3; immutable Git \
  blob 5d6f3dca8cdea899e17922829e54d0561c8f940a. Hash binds original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact property condition 17; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 19; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 5; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

```
</details>
