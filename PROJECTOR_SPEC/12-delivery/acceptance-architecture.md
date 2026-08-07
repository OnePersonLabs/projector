# Architecture Acceptance Scenarios

## Architecture expansion: web app → cross-platform product

Start from a coherent single web application with no reason to carry monorepo/platform machinery. Request desktop, Android, and iOS targets.

Expected:

1. Requirement intent records new target capabilities, not a preselected stack.
2. Projector activates material concerns including workspace topology, cross-platform runtime/shared-code boundary, dependency coherence, API contract, build/test/release, and distribution obligations.
3. It does **not** require every concern immediately. Projector classifies concerns as `blocking-now`, `material-soon`, or `deferable` for the requested slice.
4. Prior web decisions remain valid for web unless their assumptions actually changed.
5. Volatile technology options are checked against current official/authoritative evidence before recommendation.
6. Pnpm workspace catalog capability, if pnpm is a viable selected package manager, may be evaluated for dependency-version coherence rather than packages independently drifting. It is not mandated independently of the decision.
7. Task orchestration is evaluated as a concern, but Nx/Turbo/another orchestrator is not adopted merely because the repository became a monorepo. "plain workspace scripts are sufficient for now" is a valid decision with reconsideration triggers.
8. User/org/project preferences influence only otherwise viable choices and the material influence is shown.
9. Accepted decisions compile their rules/lenses/migrations transactionally.
10. Implementation planning starts only after the blocking decision frontier is resolved or validly deferred.


## Preference scope isolation

Give one developer a local preference for TypeScript and managed infrastructure while the project has no adopted equivalent preference.

Expected: recommendations may rank viable options accordingly for that developer, but no repository rule is created and another developer's accepted project state is unchanged. Explicitly adopting the preference at project scope makes it shared decision input. Enforcing it still requires a constraint/decision.


## Stale architecture research

An accepted decision depends on an older platform capability. Add a new target/platform version that fires the decision's refresh policy.

Expected: only the affected decision's evidence is refreshed. The repository is not subjected to a broad trend scan. Refreshing evidence may reaffirm the existing decision with no migration.


## Decision deferral preserves optionality

Open a task-orchestration concern before current CI/task complexity justifies a tool.

Expected: Projector may defer with explicit optionality-preserving constraints and revisit triggers. If subsequent implementation would irreversibly depend on one orchestrator, the concern becomes blocking or a temporary explicit decision is required.


## Negative/simple decision

Evaluate whether to add a monorepo orchestrator when workspace scripts are fast and dependency ordering is simple.

Expected: "do not add one yet" can be the accepted decision. It has rationale and triggers but no synthetic implementation rule solely to prove the decision exists.


## Decision overlap conflict

Create two accepted technology decisions whose selectors unexpectedly overlap and whose consequences are incompatible.

Expected: decision consequence compilation blocks before governance activation. Narrowing/supersession/migration/exception is required.


## Held-out concern-discovery robustness

Run requirement-delta fixtures and mutation-generated variants not named in built-in concern rules.

Measure concern recall, irrelevant-concern rate, decision-question count, correctly deferred concerns, stale-decision detection, and current-research correctness. Fixture-specific names MUST NOT be necessary for success.

---


