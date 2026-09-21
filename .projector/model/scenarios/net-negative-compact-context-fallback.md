+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:fall-back-when-compression-cost-exceeds-saving"
key = "fall-back-when-compression-cost-exceeds-saving"
lifecycle = "active"

[metadata]
aliases = [ "scenario:53:net-negative-compact-context-fallback", "property:27:profile-selection-is-deterministic-for-fixed-inputs-tokenizer-profile-policy-and-measured-cost-model", "adversary:31:net-negative-representation-overhead-and-fallback-selection" ]
sourceClass = "authored"
+++

# Net-negative compact-context fallback

## Given

Acceptance case "Net-negative compact-context fallback": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Provide an already-terse Execution Capsule where the compact profile's own instructions/tokenizer overhead exceed its expected output savings.

## Then

the Context Compiler selects the source/less-compressed representation instead of paying extra tokens to say the same thing more tersely. A later larger capsule may select compact mode when measured net cost becomes favorable without lowering required fidelity.

## Then

Property across the applicable input population: profile selection is deterministic for fixed inputs, tokenizer profile, policy, and measured cost model.

## Given

Adversarial evaluation must exercise this class and reject false success: Net-negative representation overhead and fallback selection.

## Then

Unit evaluation must cover: tokenizer/profile overhead accounting and fallback selection.

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
description = """Full acceptance case \"Net-negative compact-context fallback\", starting line 17; immutable Git blob \
  71ed07c17947350b56fb1728be386de2071d1a22. Hash binds original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact property condition 27; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 31; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 35; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

```
</details>
