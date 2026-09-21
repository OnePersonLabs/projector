+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:evaluate-held-out-pattern-preserving-and-breaking-cases"
key = "evaluate-held-out-pattern-preserving-and-breaking-cases"
lifecycle = "active"

[metadata]
aliases = [ "scenario:28:held-out-mutation-generated-benchmark", "adversary:17:mutation-generated-near-misses" ]
sourceClass = "authored"
+++

# Held-out/mutation-generated benchmark

## Given

Structurally varied repositories contain held-out pattern-preserving and pattern-breaking mutations not encoded in fixture-specific detectors.

## When

Generate structurally varied repositories from pattern-preserving and pattern-breaking mutations not directly encoded in fixture-specific detectors.

## Then

reported precision/recall and completeness behavior remain within release thresholds, showing generalization beyond golden fixture memorization.

## Must not

This bounded existing held-out/mutation acceptance case is expanded into a mandatory new economic trial, paid-model comparison or universal generalization proof before delivery.

## Given

Adversarial evaluation must exercise this class and reject false success: Mutation-generated near misses.

## Then

Training/development fixtures:

- `clean-monorepo`.
- `slop-monorepo`.
- `incomplete-refactor`.
- `copied-slop`.
- `cross-platform-product`.
- `external-surfaces`.
- `selector-membership`.
- `semantic-backdating`.
- `governance-cycle`.
- `transaction-crash`.
- `multiple-valid-implementations`.
- `generated-upstream`.
- `representation-semantic-drift`.
- `representation-token-economics`.
- `semantic-identity-overlap`.
- `cross-cutting-relevance`.
- `event-contract-relevance`.
- `scoped-state-binding`.
- `planning-surprise`.

Maintain **held-out** fixture repositories and mutation-generated variants whose exact anomalies are not encoded as one-off detectors. Release metrics MUST include held-out performance.

## Then

Live-model/provider evaluation is opt-in, budgeted, reproducible at the input/program/schema level, and graded structurally. It MUST NOT be the only test for semantic behavior.

<details>
<summary>Structured record details</summary>

```toml
realizations = []
evidence = []

[scope]
op = "atom"
field = "requirement"
matcher = "equals"
value = "requirement:self-hosted-value"

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-core.md"
contentHash = "sha256:v1:5471e7090610ccdf0d8e567ec2ea1cbba53dc726f6ea53d51f9cac52d994d0fc"
description = """Historical acceptance conditions, lines 207-213; immutable Git blob 804692b98650789629c95b699fa20de3b026d634. \
  Content hash is SHA-256 of exact source blob bytes. Source conditions require reviewed disposition, \
  not automatic authority."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 17; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Golden and held-out fixture repositories; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Live evaluation; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

```
</details>
