+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:accept-simple-decision-without-synthetic-rule"
key = "accept-simple-decision-without-synthetic-rule"
lifecycle = "active"

[metadata]
aliases = [ "scenario:61:negative-simple-decision" ]
sourceClass = "authored"
+++

# Negative/simple decision

## Given

Acceptance case "Negative/simple decision": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Evaluate whether to add a monorepo orchestrator when workspace scripts are fast and dependency ordering is simple.

## Then

"do not add one yet" can be the accepted decision. It has rationale and triggers but no synthetic implementation rule solely to prove the decision exists.

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
description = """Full acceptance case \"Negative/simple decision\", starting line 42; immutable Git blob 05cc5c84adbe05846b4c779d6d055783f2c321b1. \
  Hash binds original Git bytes."""

```
</details>
