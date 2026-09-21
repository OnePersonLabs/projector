+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:discover-concerns-in-held-out-variants"
key = "discover-concerns-in-held-out-variants"
lifecycle = "active"

[metadata]
aliases = [ "scenario:63:held-out-concern-discovery-robustness" ]
sourceClass = "authored"
+++

# Held-out concern-discovery robustness

## Given

Acceptance case "Held-out concern-discovery robustness": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Run requirement-delta fixtures and mutation-generated variants not named in built-in concern rules.

## When

Measure concern recall, irrelevant-concern rate, decision-question count, correctly deferred concerns, stale-decision detection, and current-research correctness. Fixture-specific names MUST NOT be necessary for success.

## Then

Concern discovery is evaluated on the listed held-out measurements without requiring fixture-specific names.

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
description = """Full acceptance case \"Held-out concern-discovery robustness\", starting line 56; immutable Git blob \
  05cc5c84adbe05846b4c779d6d055783f2c321b1. Hash binds original Git bytes."""

```
</details>
