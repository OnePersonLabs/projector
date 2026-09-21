+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:derive-behavior-representations-from-one-source"
key = "derive-behavior-representations-from-one-source"
lifecycle = "active"

[metadata]
aliases = [ "scenario:38:requirement-and-scenario-projections-are-derived" ]
sourceClass = "authored"
+++

# Requirement and scenario projections are derived

## Given

Acceptance case "Requirement and scenario projections are derived": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Create a canonical Requirement and Behavioral Scenario. Compile a human Markdown spec, a Gherkin representation, compact agent context, and a machine-invariant representation where applicable.

## Then

- all representations bind to the same canonical source identities/hashes.
- editing a generated spec/Gherkin file does not silently rewrite canonical behavior.
- an intentional behavioral edit is reconciled as a proposed semantic change.
- representation wording/format changes do not create new Requirement/Scenario identities.

## Given

Adversarial evaluation must exercise this class and reject false success: Human/agent/machine/Gherkin projections with different text but one canonical semantic source.

## Then

Unit evaluation must cover: Requirement and Behavioral Scenario contracts and semantic hashing.

<details>
<summary>Structured record details</summary>

```toml
realizations = []
evidence = []

[scope]
op = "atom"
field = "requirement"
matcher = "equals"
value = "requirement:engineering-english"

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md"
contentHash = "sha256:v1:11d59a588b7fa0a781ace0a04b81e0856a45b59bbaba6fe0cf433e7200a16b39"
description = """Full acceptance case \"Requirement and scenario projections are derived\", starting line 88; immutable \
  Git blob 5d6f3dca8cdea899e17922829e54d0561c8f940a. Hash binds original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 32; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 4; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

```
</details>
