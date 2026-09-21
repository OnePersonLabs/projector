+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "projector-scenario_4e2fc9f2c68c08d706037ae16c243fe5"
key = "detect-pull-on-next-prompt"
lifecycle = "active"

[metadata]
aliases = []
sourceClass = "authored"
+++

# Detect external changes before reusing context

## Given

A retained context exists for a checkout.

## When

Another tool changes the checkout, then the agent requests, resumes or checks the retained context.

## Then

Observe the current state and identify affected dependencies before reuse. Preserve unaffected conclusions and unresolved findings; explain incomplete observation.

## Must not

Treat a changed commit as proof of semantic drift, silently reuse stale context, or interrupt work with repeated prompt and tool reminders.

<details>
<summary>Structured record details</summary>

```toml
evidence = []

[scope]
op = "any"
items = []

```
</details>
