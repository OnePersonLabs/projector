+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "architecture-concern"
id = "concern:project-data-readiness-and-migration"
key = "project-data-readiness-and-migration"
lifecycle = "resolved"

[metadata]
sourceClass = "authored"
materiality = "blocking-now"
relatedConceptIds = [ "concept:reconstruction-authority", "concept:safe-project-data-readiness" ]
relatedRequirementIds = [ "requirement:durable-meaning", "requirement:reverse-reconciliation", "requirement:scoped-invalidation" ]
decisionIds = [ "decision:project-data-readiness-and-migration" ]
+++

# Prepare project data safely before operations

How should installed Projector operations detect, coordinate, migrate, back up, publish, and recover project data before strict current loaders run?

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

```
</details>
