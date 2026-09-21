+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:copied-precedent-does-not-create-authority"
key = "copied-precedent-does-not-create-authority"
lifecycle = "active"

[metadata]
aliases = [ "scenario:02:copied-slop-majority-and-endogenous-evidence-defense", "property:23:a-projector-caused-conforming-occurrence-never-becomes-independent-support-for-its-causal-lens-rule", "adversary:06:projector-endogenous-authority-evidence" ]
sourceClass = "authored"
+++

# Copied-slop majority and endogenous-evidence defense

## Given

Forty generated packages share a weak pattern; two independent newer implementations and incidents support a better pattern.

## When

Forty generated packages share a weak pattern. Two independently authored newer implementations use a better pattern, and incidents support the latter. Then let Projector normalize several packages under the proposed lens.

## Then

- forty generated copies collapse into one independence group.
- Projector-normalized copies do not become independent votes for the same lens.
- dominant descriptive precedent is not automatically normative.
- a migration recommendation requires the stronger independent evidence and approval appropriate to risk.

## Then

Property across the applicable input population: a Projector-caused conforming occurrence never becomes independent support for its causal lens/rule.

## Given

Adversarial evaluation must exercise this class and reject false success: Projector-endogenous authority evidence.

## Then

Unit evaluation must cover: authority independence and reconsideration triggers.

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
description = """Historical acceptance conditions, lines 10-21; immutable Git blob 804692b98650789629c95b699fa20de3b026d634. \
  Content hash is SHA-256 of exact source blob bytes. Source conditions require reviewed disposition, \
  not automatic authority."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact property condition 23; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 6; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 13; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

```
</details>
