+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "authority-record"
id = "authority:bundled-operation-runner"
key = "bundled-operation-runner-authority"
lifecycle = "approved"

[metadata]
subjectId = "concern:installed-operation-interface"
conclusion = "migrate"
assessmentConfidence = "high"
governanceRiskClass = "R2"
decidedBy = "user"
createdAt = "2026-09-10T11:00:00-05:00"
+++

# Authority for concern:installed-operation-interface

## Rationale

The user directed complete orchestrated delivery from the September 10 wrap-up plan. The selected route reduces duplicated wrapper parsing and subprocess delivery while preserving service-owned lifecycle, currentness and recovery semantics. The wrapper-to-CLI subprocess chain and standalone MCP/CLI delivery were rejected because the plan selects one bundled in-process runner and existing typed services already own behavior. Repairing task17 host dispatch was rejected because it has no product producer, drops instructions, observes incomplete state and overstates capabilities. This decision proves delivery only to the runner or tool boundary; Task 10.7 separately observes active-host consumption and resulting behavior.

<details>
<summary>Structured record details</summary>

```toml
assumptions = [ "The packaged JavaScript can load the bundled TypeScript service implementation without this checkout.", "The host supplies and enforces its own process permissions.", "A returned tool-channel result establishes delivery to that boundary but not agent understanding or action.", "Obsolete MCP, standalone CLI, and task17 dispatch surfaces have no remaining required consumer before removal." ]
evidence = []

[[alternatives]]
key = "wrapper-cli-chain"
description = "Keep plugin wrappers that spawn the standalone CLI for each operation."
advantages = [ "Reuses the current CLI parser and process boundary." ]
disadvantages = [ "Duplicates parsing and policy surface, complicates cancellation, and requires checkout-style CLI delivery." ]
rejectedBecause = [ "The accepted plan selects direct in-process calls to the existing TypeScript services." ]
evidence = []

[[alternatives]]
key = "standalone-mcp-delivery"
description = "Keep standalone MCP registration and the old CLI as the installed plugin contract."
advantages = [ "Preserves existing command and tool names." ]
disadvantages = [ "Maintains a second integration surface and obsolete installation assumptions without a required consumer." ]
rejectedBecause = [ "Supported skills and hooks use the one bundled operation contract; compatibility names alone do not justify a live surface." ]
evidence = []

[[alternatives]]
key = "repair-task17-dispatch"
description = "Repair and retain the built host-dispatch session composition."
advantages = [ "Could preserve a dedicated host-session abstraction." ]
disadvantages = [ "The current launcher drops instructions, hardcodes capabilities, observes incomplete state, and has only test or release-fixture producers." ]
rejectedBecause = [ "The representation inspection and active runner path preserve the legitimate exact-instruction purpose without retaining disconnected session machinery." ]
evidence = []

[[reconsiderWhen]]
type = "manual-review"

[[reconsiderWhen]]
type = "scope-expanded"
scopeKey = "external-operation-consumer"

[vector]
explicitDecisionAlignment = 1
productConstraintFit = 1
semanticFit = 1
independentOccurrence = 0
historicalStability = 0
independentValidationSupport = 1
boundaryCoherence = 1
maintenanceOutcome = 1
platformCompatibility = 1
externalRationale = 0
ecosystemHealth = 0
securitySupport = 0
reversibility = 1
migrationCost = 1
counterEvidence = 0

```
</details>
