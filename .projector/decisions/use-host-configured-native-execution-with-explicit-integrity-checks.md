+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "architecture-decision"
id = "decision:windows-wsl-bubblewrap"
key = "windows-wsl-bubblewrap"
lifecycle = "active"

[metadata]
concernId = "concern:cross-platform-validation-sandbox"
selectedOptionKey = "host-configured-native-runner"
authorityRecordId = "authority:windows-wsl-bubblewrap"
supersedesDecisionIds = []

[[metadata.governanceBasis]]
kind = "adopted-standard"
authorityRecordId = "authority:windows-wsl-bubblewrap"
+++

# Use host-configured native execution with explicit integrity checks

## Decision

Execute Projector operations and validators through the host's configured permissions, using the native Node runner on Windows and the Linux Node runner for direct WSL. Projector does not require WSL bridging or provide a confinement backend. Preserve exact reviewed mutation authority, actual source/state/version checks, validator provenance and bytes, bounded time/output, caller cancellation and journaled recovery. Report only guarantees that the selected execution path establishes; unavailable required controls stop the affected operation rather than becoming optimistic evidence.

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

[[consequences]]
kind = "introduce-constraint"
targetId = "concept:controlled-validation-isolation"
explanation = "The host-execution integrity contract remains accepted meaning across runner and host changes."

```
</details>
