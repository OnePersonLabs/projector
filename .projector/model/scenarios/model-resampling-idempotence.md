+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:resampling-inference-does-not-change-accepted-state"
key = "resampling-inference-does-not-change-accepted-state"
lifecycle = "active"

[metadata]
aliases = [ "scenario:14:model-resampling-idempotence", "adversary:11:model-resampling-idempotence" ]
sourceClass = "authored"
+++

# Model resampling idempotence

## Given

The normalized inference evidence remains identical across provider calls.

## When

Run inference twice against identical normalized evidence but force the provider to return two plausible different hypotheses.

## Then

accepted canonical state remains unchanged unless explicit promotion/decision occurs. Recorded inference artifacts remain distinguishable and replayable.

## Given

Adversarial evaluation must exercise this class and reject false success: Model resampling/idempotence.

<details>
<summary>Structured record details</summary>

```toml
realizations = []
evidence = []

[scope]
op = "atom"
field = "requirement"
matcher = "equals"
value = "requirement:scoped-reconsideration"

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-core.md"
contentHash = "sha256:v1:5471e7090610ccdf0d8e567ec2ea1cbba53dc726f6ea53d51f9cac52d994d0fc"
description = """Historical acceptance conditions, lines 103-109; immutable Git blob 804692b98650789629c95b699fa20de3b026d634. \
  Content hash is SHA-256 of exact source blob bytes. Source conditions require reviewed disposition, \
  not automatic authority."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 11; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

```
</details>
