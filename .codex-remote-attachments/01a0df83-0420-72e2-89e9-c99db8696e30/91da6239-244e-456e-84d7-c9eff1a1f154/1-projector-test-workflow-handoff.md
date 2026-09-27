# Projector handoff: impact-aware, test-first verification

## Task

Inspect this repository and **propose an implementation plan, not an implementation**, for the workflow below. Treat it as a reusable workflow policy/capability, not merely a change to Projector's own tests. Identify its proper home in the current architecture without assuming particular files, frameworks, or capabilities already exist.

The goal is **sufficient behavioral protection with minimal unnecessary test creation and execution**. Verification happens at explicit workflow checkpoints, not after every code edit. This is a proposed policy, not a claim of universally optimal methodology.

## Policy in one paragraph

Before implementation, derive the required behavioral coverage independently of existing tests; inspect impact and reconcile that proposal with existing coverage; plan which tests to keep, create, update, refactor, replace, or delete. Establish appropriate tests before changing the corresponding production behavior. Implement in coherent slices. At verification checkpoints, run the smallest defensible test set and expand when impact cannot be bounded reliably. Recompute impact from the complete final change before completion. Never weaken tests merely to accommodate the implementation.

## Required workflow

### 1. Derive behavioral obligations independently

Read the requested change, specifications, public contracts, and necessary system context **before reviewing existing test assertions**. Identify:

- New or changed externally observable behavior.
- Existing behavior and invariants that must survive.
- Meaningful boundaries, failure cases, and plausible regressions.

Produce a compact coverage inventory, not executable tests or a test-count target. Independent means unanchored by existing test choices, not ignorant of requirements or interfaces. It does not require a separate agent.

“Minimum” means **minimum sufficient protection**: each proposed test must address an obligation or meaningful risk not already adequately covered. Do not require a test for every function, method, or implementation detail.

### 2. Inspect impact and reconcile coverage

Inspect affected implementation areas, consumers, tests, fixtures, schemas, configuration, and relevant integration boundaries. Use repository impact/dependency tooling where available, supplemented by code inspection for relationships it misses.

Maintain two distinct outputs:

| Output | Purpose |
| --- | --- |
| **Test-change plan** | Which tests need authoring, editing, replacement, or deletion. |
| **Verification selection** | Which tests need execution, including unchanged regression tests. |

An affected test usually needs to **run**, not necessarily change. Classify relevant tests:

| Decision | Required justification |
| --- | --- |
| Keep unchanged | Its behavioral obligation remains valid and its protection remains useful. |
| Create | A required behavior or meaningful risk lacks adequate coverage. |
| Update | The intended contract changes; state the old and new expectation. |
| Refactor or replace | The obligation remains, but the test is brittle, misleading, or unnecessarily costly. Preserve its useful protection. |
| Delete | The obligation is intentionally retired, or useful protection is demonstrably preserved elsewhere. |

Reconcile the independent inventory with existing coverage; reuse adequate tests rather than duplicating them. Shared code coverage alone does not establish redundancy.

Where practical, run relevant existing tests before editing them to establish a baseline. Record pre-existing failures separately; do not silently fold unrelated repairs into scope.

### 3. Establish protection before changing behavior

Plan coverage for the whole change, but author executable tests **per coherent behavioral slice** rather than speculatively writing every test upfront.

For a missing feature, changed contract, or reproduced bug, add/update the corresponding tests first and observe the intended failure before changing production behavior. A failure caused solely by unrelated infrastructure or broken test setup is not evidence that the test protects the requirement.

If test infrastructure needs refactoring, first verify that the cleanup preserves existing checks, then change behavioral expectations.

Exceptions must remain explicit:

- **Pure refactoring:** unchanged tests may already provide sufficient protection. Do not manufacture test edits or a red state.
- **Adding protection for already-correct behavior:** a new test can legitimately pass immediately. Record that it adds coverage rather than demonstrating missing behavior.
- **Non-behavioral work:** use relevant validation without inventing behavioral tests solely to satisfy the procedure.

Derive expectations from specifications, independently worked examples, or another justified oracle. Never copy observed implementation output into assertions merely to make them pass.

### 4. Implement and verify at checkpoints

| Checkpoint | Required verification |
| --- | --- |
| Before implementing a behavioral slice | Run its new/changed tests to establish the intended failure, subject to the exceptions above. |
| After completing the slice | Run its focused tests and relevant nearby regression checks. |
| After test refactoring or replacement | Verify that retained behavioral obligations remain protected. |
| Before handing off the complete change | Recompute impact and run the final selected regression set. |

A small change may collapse naturally into one red run and one final verification run. Larger changes use meaningful intermediate checkpoints. **No automatic test run after each file edit, patch application, or helper extraction.** Additional diagnostic runs remain available when useful.

### 5. Complete test maintenance without erasing protection

Plan deletions during reconciliation. When replacing coverage, ordinarily demonstrate the replacement's protection before deleting the old tests. Intentionally removed behavior may require earlier removal of obsolete assertions; identify the retired requirement.

“It fails after my implementation change” never justifies weakening, updating, or deleting a test. Keep unrelated test-suite cleanup outside the change unless necessary to establish trustworthy verification.

### 6. Recompute final impact and report evidence

The initial impact set is provisional. Recompute from the **complete change against the appropriate baseline**, including relevant committed, staged, unstaged, and new files. Do not select solely from the last edit or last commit.

```text
Final verification set =
    new and modified tests
  + regression tests selected by impact/dependency analysis
  + explicitly identified contract and integration checks
  + additional checks required by uncertainty or risk
```

Deduplicate selections. Include changes discovered during implementation, not only those anticipated during planning.

Report compactly: scope/baseline, commands and outcomes, intended red evidence or exception, pre-existing failures, unexecuted checks, and residual uncertainty. An empty selection is not automatically successful verification; justify it or widen scope.

## Scope-selection and escalation rules

**Default to targeted verification, never an absolute “only affected tests” prohibition.**

Use existing deterministic repository commands for selection/execution where possible. Individual tests or files suit focused slice checks; affected-project selection may be the more defensible completion gate. Do not confuse project-level dependency selection with exact individual-test impact analysis.

Broaden verification for shared test setup, broad configuration/dependency changes, cross-boundary contracts, dynamic/runtime relationships missing from the graph, stale or unavailable impact data, or unexpected failures suggesting wider effects. Expand to the relevant package, dependent projects, integration suite, or full suite as warranted.

Define an appropriate broader integration/release backstop. Targeted local verification must not silently replace the repository's overall assurance policy. Preserve stricter existing gates unless the proposed plan explicitly justifies changing them.

## Implementation design constraints

- Locate the canonical policy source. Where Projector generates instructions or other outputs, update the source and regeneration path rather than hand-editing derivatives.
- Prefer a short standing `AGENTS.md` rule routing to one workflow skill, plus existing repository scripts for deterministic mechanics. Adapt this arrangement to the architecture found.
- Reconcile conflicting existing instructions, skills, hooks, and templates. Do not leave competing “test every edit,” “test every function,” or unconditional full-suite rules active alongside this policy without resolving their scope.
- Separate behavioral obligations from framework-specific adapters. Confirm installed tools and command semantics; do not invent flags or assume Nx/Vitest are present.
- Distinguish advisory instructions from enforced lifecycle gates. Do not claim that prose alone guarantees compliance.
- Start with the smallest useful implementation. No custom impact engine, mandatory second agent, or elaborate tracking system unless inspection demonstrates the need. Reuse existing planning artifacts for brief evidence.

## Requested plan

Return a concise, decision-ready proposal containing:

1. **Current-state findings:** existing workflow/policy owners, test tooling, selection capabilities, conflicting rules, and material gaps, with repository paths.
2. **Proposed integration:** exact files/components to change, canonical versus generated ownership, checkpoint wiring, selection commands, and escalation/backstop policy.
3. **Implementation sequence:** smallest useful first slice, subsequent necessary work, and any justified deviations from this handoff. Include the proposed standing rule and workflow structure.
4. **Acceptance checks:** demonstrate a small bug fix, pure refactor, newly discovered impact, shared configuration change, coverage-preserving replacement/deletion, and an empty or unreliable selection. Check both protection and avoidance of unnecessary runs.
5. **Tradeoffs and unresolved decisions:** explain material uncertainties and recommend defaults. Separate genuinely blocking unknowns from questions repository inspection can resolve.

**Do not implement yet. Inspect, reconcile, and propose the plan.**
