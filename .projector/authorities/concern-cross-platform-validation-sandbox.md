+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "authority-record"
id = "authority:windows-wsl-bubblewrap"
key = "windows-wsl-bubblewrap-authority"
lifecycle = "approved"

[metadata]
subjectId = "concern:cross-platform-validation-sandbox"
conclusion = "normalize"
assessmentConfidence = "high"
governanceRiskClass = "R2"
decidedBy = "user"
createdAt = "2026-09-09T17:00:00.000Z"
+++

# Authority for concern:cross-platform-validation-sandbox

## Rationale

Reaffirm host-configured native execution after the runtime-evidence wording revision. The revised requirement preserves actual host permissions, exact source and mutation integrity, explicit unavailable capabilities, caller cancellation and journaled recovery. It removes retired delivery topology; it does not introduce a confinement backend, a Windows-to-WSL bridge, or guarantees against hostile same-user interference.

<details>
<summary>Structured record details</summary>

```toml
assumptions = [ "The host supplies and enforces the permissions under which Projector runs.", "The supported workspace is trusted; same-user or host code can interfere with ordinary-process collection.", "Exact validator bytes, reviewed writes, source/state/version binding, cancellation and recovery remain enforceable without a Projector confinement backend.", "Unsupported CPU, memory, network, or filesystem-isolation controls are reported as unsupported and never silently claimed." ]

[[alternatives]]
key = "landstrip-native"
description = "@landstrip/landstrip-api 0.18.43 LPAC AppContainer, evaluated locally on Windows."
advantages = [ "Open-source npm distribution with a plausible native isolation route; declared-read and write-denial probes worked." ]
disadvantages = [ "Published Node startup failed with WSAStartup 10107.", "A local registryRead-capability patch repaired startup, but transient validator DENY ACE cleanup and immutable source-to-target overlay integration still needed work." ]
rejectedBecause = [ "The evaluated published release did not meet the entire earlier isolation contract, and maintaining a private security fork was not justified." ]
evidence = []

[[alternatives]]
key = "anthropic-sandbox-runtime"
description = "@anthropic-ai/sandbox-runtime 0.0.75 Windows alpha; source audit only."
advantages = [ "Open-source npm package with Windows isolation work." ]
disadvantages = [ "Elevated setup, shared sandbox-account grants and documented resolver limitations; no demonstrated immutable source overlay route." ]
rejectedBecause = [ "No live contract proof justified adopting it, and the selected product direction no longer requires Projector-owned confinement." ]
evidence = []

[[alternatives]]
key = "microsoft-mxc"
description = "@microsoft/mxc-sdk 0.8.0; source audit only."
advantages = [ "Open-source Windows and Linux package." ]
disadvantages = [ "The evaluated project documentation warned that permissive policies should not be treated as security boundaries." ]
rejectedBecause = [ "It did not justify the earlier security-boundary claim, and no current consumer requires a replacement confinement backend." ]
evidence = []

[[alternatives]]
key = "mandatory-projector-confinement"
description = "Continue requiring a Projector-selected confinement backend and Windows-to-WSL bridge."
advantages = [ "Can enforce stronger filesystem and network properties when a proven backend exists." ]
disadvantages = [ "Adds installation, platform, packaging and failure complexity; blocks supported host workflows when the optional backend is absent; risks claims stronger than the actual host path proves." ]
rejectedBecause = [ "The user selected host-configured execution with retained change-integrity checks and honest evidence limits instead of a mandatory Projector confinement product." ]
evidence = []

[[reconsiderWhen]]
type = "requirement-changed"
subjectId = "requirement:runtime-evidence-legibility"

[[reconsiderWhen]]
type = "scope-expanded"
scopeKey = "controlled-host-execution"

[[reconsiderWhen]]
type = "assumption-falsified"
assumptionKey = "trusted-host-permissions"

[vector]
explicitDecisionAlignment = 1
productConstraintFit = 1
semanticFit = 1
independentOccurrence = 0
historicalStability = 0
independentValidationSupport = 0
boundaryCoherence = 1
maintenanceOutcome = 1
platformCompatibility = 1
externalRationale = 0
ecosystemHealth = 0
securitySupport = 0
reversibility = 1
migrationCost = 1
counterEvidence = 0

[[evidence]]
evidenceId = "knowledge_context_6204acbaff99f456aa7e24800a87b41d"
stance = "supports"

```
</details>
