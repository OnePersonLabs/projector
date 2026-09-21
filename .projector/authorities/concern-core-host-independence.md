+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "authority-record"
id = "authority:core-host-independence-decision"
key = "core-host-independence-decision-authority"
lifecycle = "auto-approved"

[metadata]
subjectId = "concern:core-host-independence"
conclusion = "preserve"
assessmentConfidence = "medium"
governanceRiskClass = "R1"
decidedBy = "system"
createdAt = "2026-09-09T00:00:00.000Z"
+++

# Authority for concern:core-host-independence

## Rationale

Reaffirm the existing static core dependency boundary after its scope-expansion trigger. Fresh retained context knowledge_context_6204acbaff99f456aa7e24800a87b41d (sha256:v1:5290553931fc3960115742786629db7b6204acbaff99f456aa7e24800a87b41d) observes the current packages/core/src scope and reports every applicable projection unit conformant with rule:core-static-dependencies, with zero relevance frontiers. The repository build and focused public-export producer tests passed at ddb2e815663d60670479d4ca1b24a53425589f87; pnpm check:boundaries, runtime typecheck, and all 46 transaction-journal tests pass through 01ff51a. This reaffirms only the existing core-host-independence decision and its current applicability; it does not claim runtime dependency completeness, complete implementation, or economic advantage.

<details>
<summary>Structured record details</summary>

```toml
assumptions = [ "Core owns contracts and value semantics, not host integration.", "Static TS/JS imports are an explicitly bounded observation; runtime dependency mechanisms are outside this lens." ]

[[alternatives]]
key = "standalone-script-only"
description = """Keep the existing package boundary checker without integrating its constraint into request relevance \
  or retained context."""
advantages = [ "Small existing deterministic check." ]
disadvantages = [ "Its rationale and applicability do not enter request-first context or scoped reconciliation." ]
rejectedBecause = [ "Use the core boundary as a bounded experiment in connecting accepted architecture to the public conceptual loop. Retain the script as an independent check." ]
evidence = []

[[reconsiderWhen]]
type = "requirement-changed"
subjectId = "requirement:executable-lenses"

[[reconsiderWhen]]
type = "scope-expanded"
scopeKey = "packages/core/src"

[[reconsiderWhen]]
type = "assumption-falsified"
assumptionKey = "core-host-independence"

[vector]
explicitDecisionAlignment = 0
productConstraintFit = 1
semanticFit = 1
independentOccurrence = 0
historicalStability = 0
independentValidationSupport = 0
boundaryCoherence = 1
maintenanceOutcome = 0
platformCompatibility = 0
externalRationale = 0
ecosystemHealth = 0
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
