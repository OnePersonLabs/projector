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

Expose short installed init, context, check, audit, accept, resume, inspect and recover commands through the existing shared JavaScript services. Core typed contracts own inputs and results. The normal workflow retrieves relevant meaning, uses ordinary authorized Codex edits and checks affected meaning and behavior. Canonical acceptance provides a concise preview/apply route that retains exact-plan authority, current-state checks, journals and explicit recovery. Resume only inspects and rehydrates; it never silently reapplies work or renews authority.

Default output is compact readable meaning, evidence, consequences and actionable unknowns. Exact machine details remain available on inspection. Deduplicate repeated records before budgeting. Use task interpretation with typed relations and current source queries; lexical similarity alone does not establish applicability. Distinguish current knowledge, changed assumptions, new consumers, violated predicates and unavailable observations. Preserve unaffected conclusions.

The installed plugin baseline and owning skills route Codex judgment; deterministic services own observation, parsing, state and recovery. Hooks are quiet on unchanged work and do not inject repetitive per-tool or per-prompt reminders. Retained context is checked before reuse. Canonical meaning and runtime lifecycle owners remain distinct from assimilation and task management. Use existing Codex execution/delegation, without a competing orchestrator. Psychord rehearsal specifics do not ship in the general runtime. Instruction delivery and operation success do not establish understanding or behavioral conformance.

Audit uses the existing coverage, completion and cleanup services. It reads scoped observations and optionally a retained context, discloses evidence limits, and recommends supported next actions. It does not edit source or accepted meaning, apply a repair, or create a second task or completion store. Runtime observation artifacts remain owned by the existing lifecycle and knowledge services.

The harness may manage a resident stdio MCP transport over this same registered runner. MCP handlers invoke shared typed services directly. The resident retains bounded compiler programs and workers between requests; each request retains cancellation and observation accounting and enforces deadlines only when explicitly requested. Separate harness connections may own separate processes. Checkout identity, persisted derived indexes, writer coordination and currentness checks govern reuse across processes. The direct CLI and CI use the same services. No separate daemon or agent task queue is required.

Semantic code facts remain derived and language-neutral. Native compiler, SCIP, SemanticDB, syntax and runtime providers expose their provenance, capabilities, coverage and unknowns. Versioned semantic partitions bind source membership, bytes, configuration, build variant and provider inputs to a completed repository observation. Publication is atomic; incomplete or stale work cannot become current. Retained before/after generations support symbol-level impact while ProjectionUnits preserve governance and mutation ownership. Runtime execution and test outcomes supplement static facts without asserting unobserved verification.

An unchanged repository observation retains graph records and query memoization after trustworthy delta verification or a complete membership and byte scan. Native filesystem notifications remain hints. Per-lane invalidation reuses unaffected facts; query membership dependencies include empty results. Requests may share verified work only when its freshness barrier covers their admission. Cancellation detaches one waiter without cancelling work needed by others. Resource accounting, controlled concurrency, currentness, absence eligibility and recovery protections remain mandatory.

This resident choice assumes repeated tools use a live harness connection. Reconsider an additional transport only if measured cross-thread duplication or a required non-harness consumer justifies its lifecycle cost. MCP itself supplies no semantic accuracy or freshness. Measure the complete currentness and query path before claiming a performance improvement.

Normal repository observation, semantic indexing, verification, generation and test replay have no implicit elapsed-time, repository population, source-byte, artifact-byte or derived-data ceiling. A caller may explicitly constrain an operation; those constraints remain visible and enforced. Control memory use through bounded concurrent work, streamed immutable source versions, addressed reads, and incremental typed partition staging. Repository growth increases the work to complete rather than requiring the user to raise a default capacity limit. Compiler programs may require project-wide state; worker admission and memory allocation must account for available host resources instead of imposing the same fixed heap allowance on every project. Actual resource exhaustion remains an explicit failure with the prior completed state preserved.

A waiting call may return the current run state without stopping the owned computation. Long-running work retains valid writer ownership independently of synchronous compiler execution. Completed staged partitions remain invisible until their complete source and configuration binding is verified and an atomic publication advances the head. Reuse staged work only when its input identity is verified; cancellation, interruption, stale inputs and lost ownership cannot publish incomplete facts or silently restart a potentially committed mutation.

Store changed source bytes and semantic facts in their final immutable representations before publication. Reuse unchanged versions. Batch durable preparation writes and keep full fact insertion and bulk pruning outside the atomic head-publication transaction. A verified unchanged observation must not rewrite its captured source population. Current requests must validate their source binding at admission; they cannot silently use a known-stale generation when refresh is required. Concurrent readers retain one coherent completed snapshot, and explicitly pinned requests may select a historical generation. These guarantees do not claim that database locks prevent external source edits.

Qualify additions to the agent reasoning workflow with the same facts, model, tools, tasks and allowance as a strong ordinary-agent baseline. An installed, artifact-grounded trial may use bounded real source slices and platform I/O fakes to evaluate causal reasoning; it does not replace broader reconstruction obligations or establish musical or hardware performance. Include setup, retrieval, fresh-session reconstruction, review and observed repair cost. A tie or unavailable cost evidence does not justify claiming a net advantage. Retain an added default procedure only when observed benefit pays for its cost.

The September 29 Psychord-source trial rejected the candidate architecture reasoning procedure as a default. Both arms passed every sealed correctness checkpoint, while the Projector arm used 183.9 percent more input-plus-output model tokens and took 134.4 percent longer in the main workload. This result applies to the tested procedure and workload. It does not reject retained project meaning or the deterministic product improvements evaluated separately.

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
value = "plugins/projector-v3/**"

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
