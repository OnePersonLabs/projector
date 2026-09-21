+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "projector-scenario_2abeee80cd0dae371c8deb189aede82d"
key = "preserve-pending-check-finding"
lifecycle = "active"

[metadata]
aliases = []
sourceClass = "authored"
+++

# Keep unresolved findings until evidence changes

## Given

A repository observation identifies a change that has not yet been investigated.

## When

A later check sees the same change or new relevant bytes.

## Then

Keep the unresolved finding distinct from the observation, update it when relevant bytes change, and state any incomplete evidence.

## Must not

Repeat the same finding as a new obligation, silently discard it, or require prompt and session hooks to perform the check.

<details>
<summary>Structured record details</summary>

```toml
evidence = []

[scope]
op = "any"
items = []

```
</details>
