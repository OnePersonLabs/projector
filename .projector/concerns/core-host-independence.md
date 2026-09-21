+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "architecture-concern"
id = "concern:core-host-independence"
key = "core-host-independence"
lifecycle = "resolved"

[metadata]
sourceClass = "authored"
materiality = "blocking-now"
relatedConceptIds = []
relatedRequirementIds = [ "requirement:executable-lenses" ]
decisionIds = [ "decision:core-static-dependencies" ]
+++

# Core host independence

Should the contract and value-semantics core depend on repository implementation packages?

<details>
<summary>Structured record details</summary>

```toml
activationReasons = []
evidence = []

[scope]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/core/src/**"

```
</details>
