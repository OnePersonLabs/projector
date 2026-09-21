+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "authority-record"
id = "authority:project-data-readiness-and-migration"
key = "project-data-readiness-and-migration-authority"
lifecycle = "approved"

[metadata]
subjectId = "concern:project-data-readiness-and-migration"
conclusion = "migrate"
assessmentConfidence = "high"
governanceRiskClass = "R2"
decidedBy = "user"
createdAt = "2026-09-10T00:00:00Z"
+++

# Authority for concern:project-data-readiness-and-migration

## Rationale

The user explicitly authorized the Projector 3 implementation plan on 2026-09-20: human-friendly canonical artifacts, nimble evidence-bound workflows, no backwards compatibility, and a Psychord rebuild readiness comparison.

<details>
<summary>Structured record details</summary>

```toml
assumptions = [ "Projector itself is the only used project requiring a one-time conversion.", "The verified snapshot and unfinished runtime evidence remain recoverable.", "Current writers honor shared access and transaction journals; old processes are stopped before cutover." ]

[[alternatives]]
key = "permanent-v2-compatibility"
description = "Ship old format readers and historical package-version migration chains indefinitely."
advantages = [ "Supports projects that remain on old formats." ]
disadvantages = [ "Adds maintenance and release coupling without an existing external user." ]
rejectedBecause = [ "The user explicitly waived backwards compatibility." ]
evidence = []

[[reconsiderWhen]]
type = "requirement-changed"
subjectId = "requirement:durable-meaning"

[[reconsiderWhen]]
type = "requirement-changed"
subjectId = "requirement:reverse-reconciliation"

[[reconsiderWhen]]
type = "assumption-falsified"
assumptionKey = "compatible-runner-access-participation"

[[reconsiderWhen]]
type = "assumption-falsified"
assumptionKey = "codex-backup-root-available"

[[reconsiderWhen]]
type = "scope-expanded"
scopeKey = "project-data-readiness-and-migration"

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
ecosystemHealth = 0
securitySupport = 0
reversibility = 1
migrationCost = 0
counterEvidence = 0

[[evidence]]
evidenceId = "knowledge_context_6204acbaff99f456aa7e24800a87b41d"
stance = "supports"

```
</details>
