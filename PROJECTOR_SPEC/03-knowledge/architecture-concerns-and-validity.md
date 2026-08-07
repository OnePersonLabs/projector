# Architecture Concerns and Decision Validity

## Architecture preflight

Before a durable semantic-change plan is finalized, Projector runs:

```text
compile bounded Relevance Closure
→ normalize requirement / scenario / constraint delta
→ discover concern candidates
→ reuse already-valid scoped decisions
→ promote materially unresolved concerns
→ evaluate reconsideration triggers for affected decisions
→ calculate decision frontier
→ refresh external evidence when policy requires it
→ evaluate viable options
→ accept / defer / contest decisions
→ compile consequences transactionally
→ continue to implementation impact closure
```

Architecture preflight MUST run inside ordinary `projector change`. It is not reserved for explicit modernization requests.

Observe/Guide modes MAY allow exploratory work while concerns remain unresolved, but such work cannot become governed completion where a `blocking-now` concern applies. Govern/Autonomous durable R2+ planning MUST resolve or validly defer all blocking concerns in scope.

## Concern discovery

Concern discovery consumes the bounded Relevance Closure rather than rediscovering the project from scratch. It combines:

1. Requirement/Scenario/constraint deltas and the canonical entities selected by relevance discovery.
2. Deterministic platform/constraint and Analysis Facet rules.
3. Currently accepted decisions and their reconsideration triggers.
4. Repository friction/divergence evidence already relevant to the scope.
5. Event/contract/public-surface relationships and adapter-declared platform implications.
6. Replayable model inference for non-obvious concerns at the remaining frontier.
7. Live research when discovery itself depends on a current external capability or constraint.

Decision-frontier/applicability queries that materially determine whether an existing decision is valid, suspect, blocking, or absent are closure-sensitive state queries. When their result can change a bound plan, they MUST be represented in the plan's `StateBinding`. An unchanged set of previously loaded decision documents is not sufficient proof that no newly applicable decision/concern exists.

A concern describes a **question/force**, not an answer. For example, adding desktop/mobile targets may activate `workspace-topology`, `cross-platform-runtime`, `shared-code-boundary`, `dependency-version-coherence`, `task-orchestration`, `API-contract`, `persistence`, `build/release`, and `distribution/signing` concerns. It MUST NOT automatically imply a monorepo, pnpm, Nx, Turbo, Tauri, React Native, REST, GraphQL, or any other technology.

Candidate concerns are transient and deduplicated by semantic key + scope + causal context. Repeated reasoning MAY crystallize into versioned deterministic concern triggers, but such triggers activate questions. They never hardcode the preferred technology answer.

Projector-generated state MUST NOT independently justify the same concern/decision that generated it. Endogenous structure may satisfy a present-state condition, but causal origin remains visible.

## Materiality and progressive disclosure

Architecture concern materiality is not a generic importance score.

A concern qualifies as architecture-level when different viable answers materially change one or more of:

- cross-cutting structure or package/service boundaries.
- public or compatibility contracts.
- long-lived dependency/toolchain/platform commitment.
- data ownership/schema or migration strategy.
- external surfaces or distribution obligations.
- operational/security/reliability posture.
- reversibility or migration cost.
- recurring maintenance/developer-experience cost.
- significant future change closure.

Materiality classes:

- `blocking-now`: a safe durable plan for the affected scope requires resolution.
- `material-soon`: near-term work will require it, but current scope can proceed safely.
- `deferable`: real but safely postponable while preserving option value.

Deterministic hard security/data/platform/public-contract implications may establish a minimum materiality. Model inference MAY raise materiality but MUST NOT lower a deterministic minimum.

The default UX shows blocking decisions first, material-soon concerns as concise foresight, and hides deferable concerns until requested. This is progressive disclosure in service of progressive commitment, not omission.

## Decision validity and dirtying

An accepted decision is evaluated against the scope of the current change. Reconsideration triggers may make it `suspect`, `contested`, or `invalid-for-scope` without mutating the canonical decision.

Decision validity is proof validity, not conclusion inversion. `suspect` means the prior justification no longer proves that the decision covers the current scope/question. It MUST NOT be interpreted as proof that the decision is wrong or that migration is required. Re-evaluation may reaffirm the existing decision unchanged.

Typical dirtying causes:

- requirement/constraint change.
- target surface/platform expansion.
- assumption falsification.
- incompatible toolchain/platform version change.
- material new counterevidence.
- evidence freshness obligation.
- project-adopted preference change explicitly used by the decision.
- migration phase change.

Personal user preference changes alone MUST NOT dirty accepted project architecture.

If an existing valid decision already covers the new scope and no relevant trigger fired, Projector reuses it silently. `projector explain decision:<id>` MUST be able to show both why a decision was reconsidered and why it was *not* reconsidered.

## Scope-specific coexistence and supersession

Architecture decisions are scoped. It is valid for different decisions to govern disjoint platform/package/runtime scopes.

During migration, old and new decisions MAY coexist under migration-phase selectors. Supersession is scoped: the old decision is retired only when its governed population is gone or explicitly excepted.

Before activating decision consequences, the compiler MUST check for incompatible overlapping decision scopes. Compatible layered decisions may compose. Incompatible overlap blocks until narrowed, explicitly superseded, migrated, or excepted.
