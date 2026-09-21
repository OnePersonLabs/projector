+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:refresh-only-triggered-decision-research"
key = "refresh-only-triggered-decision-research"
lifecycle = "active"

[metadata]
aliases = [ "scenario:59:stale-architecture-research" ]
sourceClass = "authored"
+++

# Stale architecture research

## Given

Acceptance case "Stale architecture research": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

An accepted decision depends on an older platform capability. Add a new target/platform version that fires the decision's refresh policy.

## Then

only the affected decision's evidence is refreshed. The repository is not subjected to a broad trend scan. Refreshing evidence may reaffirm the existing decision with no migration.

## Then

Unit evaluation must cover: scope-specific Decision Validity Assessment.

## Then

Unit evaluation must cover: research freshness policy and current-option verification.

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
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-architecture.md"
contentHash = "sha256:v1:5c3b61124058d6743e05a658b5a63da8b930cbc1b716948bcba2170c7f91e74b"
description = """Full acceptance case \"Stale architecture research\", starting line 28; immutable Git blob 05cc5c84adbe05846b4c779d6d055783f2c321b1. \
  Hash binds original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 15; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 18; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

```
</details>
