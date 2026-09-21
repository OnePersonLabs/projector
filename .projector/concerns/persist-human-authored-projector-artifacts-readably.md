+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "architecture-concern"
id = "concern:persisted-project-artifact-format"
key = "persisted-project-artifact-format"
lifecycle = "resolved"

[metadata]
sourceClass = "authored"
materiality = "blocking-now"
relatedConceptIds = [ "concept:human-readable-persisted-artifacts", "concept:reconstruction-authority" ]
relatedRequirementIds = [ "requirement:durable-meaning", "requirement:engineering-english", "requirement:scoped-invalidation" ]
decisionIds = [ "decision:persisted-project-artifact-format" ]
+++

# Persist human-authored Projector artifacts readably

Which persisted formats, filenames, schemas, and hash meanings let people edit Projector configuration and accepted artifacts without weakening machine validation, state binding, or recovery?

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
matcher = "equals"
value = "packages/core/src/domain/contracts.ts"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/core/src/hashing/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/core/src/schemas/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/runtime/src/activation/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/runtime/src/persistence/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "scripts/generate-*schema*"

```
</details>
