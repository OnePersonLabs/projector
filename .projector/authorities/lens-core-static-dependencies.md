+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "authority-record"
id = "authority:core-static-dependencies"
key = "core-static-dependencies-authority"
lifecycle = "auto-approved"

[metadata]
subjectId = "lens:core-static-dependencies"
conclusion = "preserve"
assessmentConfidence = "medium"
governanceRiskClass = "R1"
decidedBy = "system"
createdAt = "2026-09-09T00:00:00.000Z"
+++

# Authority for lens:core-static-dependencies

## Rationale

Agent-selected bounded self-hosting constraint under the user instruction to implement the recovered vision. It preserves the existing core package boundary and adds an executable lens. Historical reports are not authority. The numeric vector records only this local design assessment; it is not empirical evidence of product advantage.

<details>
<summary>Structured record details</summary>

```toml
assumptions = [ "Core owns contracts and value semantics, not host integration.", "Static TS/JS imports are an explicitly bounded observation; runtime dependency mechanisms are outside this lens." ]
evidence = []

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

```
</details>
