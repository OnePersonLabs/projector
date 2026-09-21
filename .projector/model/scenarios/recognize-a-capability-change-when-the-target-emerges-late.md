+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "projector-scenario_b75f17cb5558754aedac78abf97da3bc"
key = "recognize-late-project-change"
lifecycle = "active"

[metadata]
aliases = []
sourceClass = "authored"
+++

# Recognize a capability change when the target emerges late

## Given

The conversation begins in a neighboring repository or during implementation of existing meaning.

## When

The target becomes clear or an agent proposes a shipped capability change.

## Then

Retrieve target meaning and route revised intention before dependent edits; preserve planning-only and speculative status.

<details>
<summary>Structured record details</summary>

```toml
evidence = []

[scope]
op = "any"
items = []

```
</details>
