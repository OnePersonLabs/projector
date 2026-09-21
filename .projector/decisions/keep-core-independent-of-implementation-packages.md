+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "architecture-decision"
id = "decision:core-static-dependencies"
key = "core-static-dependencies-decision"
lifecycle = "active"

[metadata]
concernId = "concern:core-host-independence"
selectedOptionKey = "static-boundary-lens"
authorityRecordId = "authority:core-host-independence-decision"
supersedesDecisionIds = []

[[metadata.governanceBasis]]
kind = "adopted-standard"
authorityRecordId = "authority:core-host-independence-decision"
+++

# Keep core independent of implementation packages

## Decision

Core source may use its external libraries but must not statically import implementation packages in this repository. Check observed import syntax; accept alternate implementations that satisfy the same boundary.

<details>
<summary>Structured record details</summary>

```toml
consequences = []
appliedPreferences = []

[scope]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/core/src/**"

```
</details>
