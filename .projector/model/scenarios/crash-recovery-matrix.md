+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:recover-every-transaction-journal-phase"
key = "recover-every-transaction-journal-phase"
lifecycle = "active"

[metadata]
aliases = [ "scenario:10:crash-recovery-matrix", "property:21:rollback-restores-fixture-supported-physical-and-canonical-state", "adversary:04:crash-at-every-semantic-transaction-phase" ]
sourceClass = "authored"
+++

# Crash recovery matrix

## Given

A controlled transaction has journal phases and affects workspace and canonical state.

## When

Inject process failure after every transaction journal phase: prepared, during workspace mutation, staged, validating, canonical staging, commit, rollback.

## Then

restart either resumes safely, rolls back, or reports `recovery-required`. Canonical state never claims a transaction completed when workspace state is partial.

## Then

Property across the applicable input population: rollback restores fixture-supported physical and canonical state.

## Given

Adversarial evaluation must exercise this class and reject false success: Crash at every semantic transaction phase.

## Then

Unit evaluation must cover: transaction journal/recovery.

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
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-core.md"
contentHash = "sha256:v1:5471e7090610ccdf0d8e567ec2ea1cbba53dc726f6ea53d51f9cac52d994d0fc"
description = """Historical acceptance conditions, lines 75-81; immutable Git blob 804692b98650789629c95b699fa20de3b026d634. \
  Content hash is SHA-256 of exact source blob bytes. Source conditions require reviewed disposition, \
  not automatic authority."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact property condition 21; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 4; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 26; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

```
</details>
