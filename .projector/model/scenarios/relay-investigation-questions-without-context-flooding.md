+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "projector-scenario_a9bf38a9725c1539b81070a884b397be"
key = "delegate-reconciliation-questions"
lifecycle = "active"

[metadata]
aliases = []
sourceClass = "authored"
+++

# Keep investigation questions focused

## Given

The user has authorized an investigation.

## When

The investigator finds a consequential unresolved choice or an overlapping write.

## Then

Explain the choice and its evidence concisely, coordinate overlap, and continue independent work. Request user input only when the missing decision exceeds existing authority or cannot be resolved from available evidence.

## Must not

Infer historical intent from files alone, require delegation for every investigation, or require the user to repeat authorization already given.

<details>
<summary>Structured record details</summary>

```toml
evidence = []

[scope]
op = "any"
items = []

```
</details>
