+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "architecture-decision"
id = "decision:project-data-readiness-and-migration"
key = "project-data-readiness-and-migration-decision"
lifecycle = "active"

[metadata]
concernId = "concern:project-data-readiness-and-migration"
selectedOptionKey = "bounded-readiness-exclusive-recoverable-migration"
authorityRecordId = "authority:project-data-readiness-and-migration"
supersedesDecisionIds = []

[[metadata.governanceBasis]]
kind = "adopted-standard"
authorityRecordId = "authority:project-data-readiness-and-migration"
+++

# Use the current authored format with explicit controlled recovery

## Decision

Projector uses the declared current authored format before strict loading, lifetime cooperative operation access and exact controlled-write recovery. Fresh projects initialize with the current format and publish configuration last. The Projector 3 conversion was a completed one-time cutover recorded by its accepted snapshot and receipt; it does not create a live version chain, legacy reader or future per-package data migration obligation. Unsupported formats remain untouched and report their limitation. Read-only resumption checks currentness and continuation only; recovery and application remain explicit authenticated operations.

<details>
<summary>Structured record details</summary>

```toml
appliedPreferences = []

[scope]
op = "any"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = ".projector/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/runtime/src/access/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/runtime/src/activation/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/runtime/src/journal/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/runtime/src/migrations/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/runtime/src/sqlite/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/runtime/src/worktrees/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/control-plane/src/readiness/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/control-plane/src/migrations/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/cli/src/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "plugins/projector/hooks/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "plugins/projector/scripts/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "equals"
value = "scripts/build-plugin-runtime.mjs"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "scripts/*migration*"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "scripts/*release*"

[[consequences]]
kind = "introduce-constraint"
targetId = "concept:safe-project-data-readiness"
explanation = "Preserve readiness, safe cutover and recovery while retiring unused compatibility."

```
</details>
