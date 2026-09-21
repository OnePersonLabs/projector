+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:recover-sandbox-rationale"
key = "recover-sandbox-rationale"
lifecycle = "active"

[metadata]
aliases = []
sourceClass = "authored"
+++

# Recover the host-execution decision after a fresh start

## Given

The project is cloned or the agent starts a new session before changing a validator, approval path, coverage operation, packaged runner, or launcher.

## When

The agent requests current Projector context for the affected host-execution change.

## Then

Context exposes the native host-execution decision, retained source/state/version/authorization/cancellation/recovery guarantees, trust limits, prior rejected confinement routes, and typed reconsideration conditions.

## Must not

The agent silently restores mandatory Projector confinement or claims that ordinary host execution enforces denied network, hidden paths, immutable overlays, quotas, or hostile same-user protection.

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
value = "packages/runtime/src/execution/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/control-plane/src/change-lifecycle/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/control-plane/src/knowledge/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/control-plane/src/coverage/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/cli/src/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "plugins/projector/scripts/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "plugins/projector/hooks/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "equals"
value = "scripts/build-plugin-runtime.mjs"

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/10-operation/cli-modes-and-security.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/12-delivery/release-and-directive.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[realizations]]
[realizations.selector]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/runtime/src/execution/command-executor.test.ts"

[realizations.origin]
kind = "git"
locator = "git:fbb691eb4b7bb62ef51e8d94ff97474782abb95a:packages/runtime/src/execution/command-executor.test.ts"
description = """Observed implementation surface for scenario:recover-sandbox-rationale; the selector is evaluated from \
  repository facts."""

```
</details>
