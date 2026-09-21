+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:inspect-isolated-application-behavior"
key = "inspect-isolated-application-behavior"
lifecycle = "active"

[metadata]
aliases = []
sourceClass = "authored"
+++

# Inspect application behavior in an owned test instance

## Given

A supported application adapter identifies the build and endpoint, owns setup and teardown, provides fresh state and declares its trust assumptions.

## When

An affected user-facing scenario runs against that application state.

## Then

The reviewer consumes the adapter outcome and records the scenario, source or build, controller state, collection method, freshness, cleanup and assurance before citing behavioral evidence.

## Must not

Treat a registered handler, unavailable observation, unconsumed artifact, wrong build or endpoint, or contaminated state as behavioral proof; claim outcomes that the adapter did not observe.

<details>
<summary>Structured record details</summary>

```toml
evidence = []

[scope]
op = "any"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/integrations/src/runtime-evidence/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "plugins/projector/skills/**"

[[origin]]
kind = "user-request"
locator = "conversation:2026-09-13:complete-existing-projector-control-loop"
description = """The user approved explicit skill, hook, runner, and service ownership; selector-based continuation; \
  installed consumption and recovery verification."""

```
</details>
