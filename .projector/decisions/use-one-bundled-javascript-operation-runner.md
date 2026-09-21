+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "architecture-decision"
id = "decision:bundled-operation-runner"
key = "bundled-operation-runner"
lifecycle = "active"

[metadata]
concernId = "concern:installed-operation-interface"
selectedOptionKey = "bundled-in-process-operation-runner"
authorityRecordId = "authority:bundled-operation-runner"
supersedesDecisionIds = []

[[metadata.governanceBasis]]
kind = "adopted-standard"
authorityRecordId = "authority:bundled-operation-runner"
+++

# Use one bundled JavaScript operation runner

## Decision

Expose short installed init, context, check, accept, resume, inspect and recover commands through the existing shared JavaScript services. Core typed contracts own inputs and results. The normal workflow retrieves relevant meaning, uses ordinary authorized Codex edits and checks affected meaning and behavior. Canonical acceptance provides a concise preview/apply route that retains exact-plan authority, current-state checks, journals and explicit recovery. Resume only inspects and rehydrates; it never silently reapplies work or renews authority.

Default output is compact readable meaning, evidence, consequences and actionable unknowns. Exact machine details remain available on inspection. Deduplicate repeated records before budgeting. Use task interpretation with typed relations and current source queries; lexical similarity alone does not establish applicability. Distinguish current knowledge, changed assumptions, new consumers, violated predicates and unavailable observations. Preserve unaffected conclusions.

The installed plugin baseline and owning skills route Codex judgment; deterministic services own observation, parsing, state and recovery. Hooks are quiet on unchanged work and do not inject repetitive per-tool or per-prompt reminders. Retained context is checked before reuse. Canonical meaning and runtime lifecycle owners remain distinct from assimilation and task management. Use existing Codex execution/delegation, without a competing orchestrator. Psychord rehearsal specifics do not ship in the general runtime. Instruction delivery and operation success do not establish understanding or behavioral conformance.

<details>
<summary>Structured record details</summary>

```toml
appliedPreferences = []

[scope]
op = "any"

[[scope.items]]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/core/src/schemas/operations.ts"

[[scope.items]]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/core/src/schemas/registry.ts"

[[scope.items]]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/core/src/index.ts"

[[scope.items]]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/core/src/domain/contracts.ts"

[[scope.items]]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/cli/src/operation-runner.ts"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/control-plane/src/readiness/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "plugins/projector/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "equals"
value = "scripts/build-plugin-runtime.mjs"

[[consequences]]
kind = "introduce-constraint"
targetId = "concept:representation-responsibility-boundary"
explanation = """The shared runner must preserve the distinction among reading, instruction inspection, authorization \
  and observed delivery."""

```
</details>
