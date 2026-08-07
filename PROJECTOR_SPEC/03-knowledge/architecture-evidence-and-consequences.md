# Architecture Evidence, Preferences, and Consequences

## Current research and evidence freshness

A materially affected architecture decision MUST use fresh-enough evidence when its viable option set or constraints depend on mutable external facts.

Research is required when, for the changed question:

- current platform/framework/toolchain capabilities matter.
- support/security/lifecycle status matters.
- viable alternatives may have materially changed.
- official constraints are uncertain.
- local evidence is contradictory.
- a technology selection would create a significant long-lived commitment.

Research MUST NOT run merely because time passed. `EvidenceRefreshPolicy` may be trigger-sensitive, version-sensitive, max-age, or manual. Official documentation/specifications remain preferred evidence.

For volatile technology decisions, Projector MUST verify the **current option set**, not merely ask a model to recall alternatives and decorate them with citations. Unsupported remembered options remain hypotheses until evidenced.

Refreshing research means reassessing the decision, not automatically migrating. Keeping the current or simple architecture remains valid when evidence supports it. Migration cost, operational burden, reversibility, and local fit are core criteria.

Offline mode uses cached evidence with visible freshness. If policy requires fresh evidence for a blocking decision and it cannot be obtained, automatic acceptance is blocked. An explicit user decision MAY proceed with recorded uncertainty.

## Developer and organization preferences

Preferences accelerate decision making without becoming invisible architecture law.

Scopes:

- **user:** local reusable preferences across projects.
- **organization:** shared decision-support preferences from an organization/policy provider.
- **project:** explicitly adopted repository preference committed under `.projector/preferences/`.

Examples include preferring TypeScript, managed infrastructure, low operational burden, minimal native code, maximal shared code, or conservative dependencies.

Composition rules:

1. Hard product/platform/security constraints always dominate preferences.
2. Explicit project preferences dominate organization/user preferences for shared project recommendations.
3. Conflicting soft preferences remain visible rather than being silently averaged.
4. Preferences are non-blocking by type.
5. If a preference must be enforced, Projector promotes it through an explicit constraint/decision.
6. Accepted decisions record only the preferences that materially influenced evaluation, by semantic hash and concise influence statement.
7. Future changes to a local personal preference affect future proposals, not already accepted project architecture unless the preference was explicitly adopted as a project assumption.

Option evaluation SHOULD use a tradeoff matrix and hard-constraint elimination before any optional weighted ranking. Numeric scoring MUST expose weights and MUST NOT be presented as objective probability.

## Decision deferral and option preservation

Deferral is legal only when a neutral or compatibility-preserving path exists.

A durable deferral records:

- rationale.
- affected scope.
- what optionality must be preserved.
- commitments forbidden while deferred.
- revisit triggers/review condition.
- risk/unknowns.

Deferral guardrails may protect reversibility, but MUST NOT secretly select one architecture. If a supposedly temporary guardrail materially commits the project to one option, it is itself a temporary architecture decision and must be represented as such.

## Decision consequences and governance basis

Decision acceptance compiles a small typed consequence kernel into governance artifacts. A consequence may change governance, constraints, technology concepts, migrations, or other concerns. It may constrain another decision or remain advisory.

Detailed implementation behavior belongs in Rules, Projection Lenses, Impact Rules, and migrations rather than expanding the decision-consequence taxonomy indefinitely.

`Rule` and `ProjectionLens` MUST expose `GovernanceBasis[]`. This enables:

```text
Why does this rule exist?
→ because Decision D selected centralized workspace dependency policy
→ because current multi-package constraints made dependency coherence material
→ supported by current local/external evidence

What changes if Decision D is superseded?
→ affected rules/lenses/Impact Rules/migrations and governed Projection Units
```

Decision acceptance and required consequence compilation occur in one crash-consistent semantic governance transaction. A decision does not become active if required consequence products fail validation.

A negative/simple decision may intentionally emit no implementation rule—for example, "do not add a task orchestrator yet"—while still carrying explicit reconsideration triggers.

## Decision dependencies and convergence

Concerns and decisions may depend on one another and may form strongly connected components. Projector uses the same deterministic convergence discipline as governance evaluation:

- model proposals are sampled outside the deterministic fixed-point loop.
- one evaluation iteration operates on fixed inputs.
- stable semantic digest means convergence.
- repeated non-stable digest means a cycle.
- maximum iteration/time bounds terminate with `decision-convergence-failure`.
- cyclic groups are presented/resolved together when ordering cannot be proven.

Numeric concern thresholds SHOULD use hysteresis or stable trend evidence to avoid oscillation.

## Modernization is not a separate decision system

The modernization engine supplies concern candidates, friction evidence, alternative research, and migration planning. It MUST use the same `ArchitectureConcern`, `ArchitectureDecision`, preference, authority, research, validity, and consequence machinery as feature-driven architecture evolution.

This prevents `projector upgrade` from producing an architectural answer inconsistent with the answer `projector change` would reach for the same forces.

## Decision explainability and self-audit

Projector MUST support a progressive explanation chain:

```text
user intent
→ resolved semantic identities + Relevance Closure
→ requirement/scenario/constraint delta
→ activated concern
→ materiality
→ existing decision validity / reconsideration trigger
→ viable options
→ hard constraints
→ current research/evidence
→ material preference influences
→ selected decision + uncertainty
→ consequences
→ resulting rules/lenses/migration
```

`projector audit --decisions` MUST detect:

- redundant or semantically equivalent decisions.
- incompatible overlapping scopes.
- stale decisions whose governed population disappeared.
- concerns that remain open without clear value.
- decisions frequently reopened because triggers are too broad.
- consequences with no governed population.
- decisions whose rationale no longer affects governance.
- excessive decision density or maintenance cost relative to value.

- architecture context repeatedly pulled into changes despite lacking a relevance path or materiality reason.

Architecture preflight MUST NOT use package location alone as a proxy for decision relevance. A decision may govern code across many packages, and code in one package may participate in multiple semantic domains. Applicability follows the decision scope, canonical relationships, and Relevance Closure.

---
