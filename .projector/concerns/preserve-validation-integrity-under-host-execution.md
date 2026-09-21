+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "architecture-concern"
id = "concern:cross-platform-validation-sandbox"
key = "cross-platform-validation-sandbox"
lifecycle = "resolved"

[metadata]
sourceClass = "authored"
materiality = "blocking-now"
relatedConceptIds = [ "concept:controlled-validation-isolation" ]
relatedRequirementIds = [ "requirement:executable-lenses", "requirement:runtime-evidence-legibility", "requirement:scoped-invalidation", "requirement:scoped-reconsideration" ]
decisionIds = [ "decision:windows-wsl-bubblewrap" ]
+++

# Preserve validation integrity under host execution

How does controlled validation preserve change integrity and honest evidence under the configured host permissions on native Windows and direct WSL?

<details>
<summary>Structured record details</summary>

```toml
activationReasons = []
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

```
</details>
