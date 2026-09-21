+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "architecture-concern"
id = "concern:installed-operation-interface"
key = "installed-operation-interface"
lifecycle = "resolved"

[metadata]
sourceClass = "authored"
materiality = "blocking-now"
relatedConceptIds = [ "concept:representation-responsibility-boundary" ]
relatedRequirementIds = [ "requirement:pre-edit-relevance", "requirement:reverse-reconciliation", "requirement:evidence-bound-completion", "requirement:self-hosted-value" ]
decisionIds = [ "decision:bundled-operation-runner" ]
+++

# Installed Projector operation interface

How do installed skills and hooks invoke supported Projector operations with one typed contract, readiness and recovery on native Windows and direct WSL?

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
matcher = "equals"
value = "packages/core/src/schemas/operations.ts"

[[scope.items]]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/core/src/schemas/registry.ts"

[[scope.items]]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/core/src/index.ts"

[[scope.items]]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/core/src/domain/contracts.ts"

[[scope.items]]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/cli/src/operation-runner.ts"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/control-plane/src/readiness/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "plugins/projector/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "equals"
value = "scripts/build-plugin-runtime.mjs"

```
</details>
