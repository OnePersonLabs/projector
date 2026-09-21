+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:preserve-one-source-across-projections"
key = "preserve-one-source-across-projections"
lifecycle = "active"

[metadata]
aliases = [ "scenario:52:cross-projection-consistency" ]
sourceClass = "authored"
+++

# Cross-projection consistency

## Given

Acceptance case "Cross-projection consistency": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Compile the same canonical semantic scope through `human-technical@1`, `agent-compact@1`, and `machine-invariant@1`.

## Then

texts/structures may differ substantially, but all valid projections bind to the same source semantic hash and compatible preservation fingerprints. Textual similarity is not required. Editing one derived rendering does not mutate the source semantic model. Reconciliation either regenerates it or treats an intentional semantic edit as a normal proposed semantic change.

## Given

Adversarial evaluation must exercise this class and reject false success: Human/agent/machine/Gherkin projections with different text but one canonical semantic source.

## Then

Unit evaluation must cover: Semantic Representation Profile compilation and canonical rebuild.

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
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-representation.md"
contentHash = "sha256:v1:da531331605b94681697c33a4a763da6dfabe19200cc37d73c93798efb1af3b5"
description = """Full acceptance case \"Cross-projection consistency\", starting line 10; immutable Git blob 71ed07c17947350b56fb1728be386de2071d1a22. \
  Hash binds original Git bytes."""

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
description = "Unit coverage family 32; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

```
</details>
