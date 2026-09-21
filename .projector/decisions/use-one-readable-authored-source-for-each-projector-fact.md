+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "architecture-decision"
id = "decision:persisted-project-artifact-format"
key = "persisted-project-artifact-format-decision"
lifecycle = "active"

[metadata]
concernId = "concern:persisted-project-artifact-format"
selectedOptionKey = "markdown-prose-typed-toml-metadata"
authorityRecordId = "authority:persisted-project-artifact-format"
supersedesDecisionIds = []

[[metadata.governanceBasis]]
kind = "adopted-standard"
authorityRecordId = "authority:persisted-project-artifact-format"
+++

# Use one readable authored source for each Projector fact

## Decision

Projector 3 uses Markdown as the sole canonical source for prose-led records, with typed TOML metadata. Independent relations, executable rules, lenses and configuration remain TOML. Runtime and derived data remain JSON or SQLite where appropriate. Parse the authored source directly into existing normalized Core records; do not persist an editable alternate canonical representation. Stable IDs survive readable path changes. Writers resolve the current ID-to-path binding and authenticate the path, header ID and exact write basis before replacement. Preserve source diagnostics, structural validation, atomic writes, leases and recovery journals. Convert existing data in a checked, recoverable one-time cutover, proving preservation before changing prose or lifecycle meaning. Historical provenance remains inspectable off the normal reading path. Retire v2 codecs and compatibility only after the conversion and callers are verified; no permanent dual reader is required.

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

[[consequences]]
kind = "introduce-constraint"
targetId = "concept:human-readable-persisted-artifacts"
explanation = "The constraint owns the authored-source, identity, validation and currentness behavior."

```
</details>
