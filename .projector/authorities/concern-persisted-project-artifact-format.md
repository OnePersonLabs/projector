+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "authority-record"
id = "authority:persisted-project-artifact-format"
key = "persisted-project-artifact-format-authority"
lifecycle = "approved"

[metadata]
subjectId = "concern:persisted-project-artifact-format"
conclusion = "migrate"
assessmentConfidence = "high"
governanceRiskClass = "R2"
decidedBy = "user"
createdAt = "2026-09-10T00:00:00Z"
+++

# Authority for concern:persisted-project-artifact-format

## Rationale

The user explicitly authorized the Projector 3 implementation plan on 2026-09-20: human-friendly canonical artifacts, nimble evidence-bound workflows, no backwards compatibility, and a Psychord rebuild readiness comparison.

<details>
<summary>Structured record details</summary>

```toml
assumptions = [ "Core executable contracts remain the schema authority.", "A constrained CommonMark AST and typed TOML metadata can preserve supported values with useful source diagnostics.", "Runtime exact-write and recovery evidence remain distinct from semantic reading views." ]

[[alternatives]]
key = "toml-plus-editable-markdown"
description = "Maintain Markdown and TOML copies of the same meaning."
advantages = [ "Reuses the current codec." ]
disadvantages = [ "Competing editable sources require synchronization and confuse authority." ]
rejectedBecause = [ "The accepted plan requires one authored owner per fact." ]
evidence = []

[[alternatives]]
key = "toml-with-generated-reader"
description = "Keep TOML authoritative and generate a Markdown reading view."
advantages = [ "Smaller initial persistence change." ]
disadvantages = [ "Leaves canonical authoring and field-heavy records cumbersome." ]
rejectedBecause = [ "The user authorized a human-friendly artifact redesign rather than only a display layer." ]
evidence = []

[[reconsiderWhen]]
type = "requirement-changed"
subjectId = "requirement:engineering-english"

[[reconsiderWhen]]
type = "requirement-changed"
subjectId = "requirement:durable-meaning"

[[reconsiderWhen]]
type = "assumption-falsified"
assumptionKey = "toml-round-trip"

[[reconsiderWhen]]
type = "scope-expanded"
scopeKey = "persisted-project-artifact-format"

[[reconsiderWhen]]
type = "manual-review"

[vector]
explicitDecisionAlignment = 1
productConstraintFit = 1
semanticFit = 1
independentOccurrence = 0
historicalStability = 0
independentValidationSupport = 0
boundaryCoherence = 1
maintenanceOutcome = 0
platformCompatibility = 1
externalRationale = 0
ecosystemHealth = 1
securitySupport = 0
reversibility = 1
migrationCost = 0
counterEvidence = 0

[[evidence]]
evidenceId = "knowledge_context_13c8d763d659dcf5a80b04a3f3234cb2"
stance = "supports"

[[evidence]]
evidenceId = "knowledge_context_6204acbaff99f456aa7e24800a87b41d"
stance = "supports"

```
</details>
