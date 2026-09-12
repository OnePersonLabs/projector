# Project stewardship and precise change

The intended development relationship is with a project steward: an agent responsible for understanding the project, helping the user decide what it should become, and carrying that understanding through implementation and validation. The user should not need to prescribe every edit, remember every architectural implication, or manually coordinate specialists. Responsibility includes investigating questions the repository can answer, explaining consequential alternatives, and retaining the reasons behind accepted choices.

This is a conception of desired behavior. It does not assert that present Projector code delivers the complete experience. A materialization compiler, transformation language, shadow repository, or swarm could help realize it; none is established as a mandatory subsystem merely by naming it.

## Shared understanding before consequential commitment

The steward develops a reviewable account of the desired behavior, constraints, preservation obligations, and unresolved decisions. Interviewing is useful where an answer would change the next consequential commitment. A fixed interrogation is unnecessary: local investigation, retained preferences, and accepted decisions should eliminate questions the user has already answered. Experiments and provisional implementations can resolve uncertainties that conversation cannot.

For example, adding an optional instrument capability raises a consequential question: must every instrument support it, or should capable instruments advertise it? That choice governs contracts and consumers. The steward should surface the distinction and recommend a direction before embedding an assumption throughout the project.

Readiness means enough understanding to proceed responsibly within a bounded scope. Unresolved assumptions remain visible; discoveries reopen affected decisions. Responsibility survives sessions through retained understanding rather than an indefinitely growing transcript.

Architecture belongs in this relationship. A move from a simple web application to several platforms activates concerns about shared code, dependencies, packaging, testing, and delivery. Those concerns invite decisions when they become material; they do not automatically prescribe a particular framework. Decisions retain their rationale, alternatives, assumptions, preferences, and consequences. Changing an assumption makes its dependent decision suspect within the affected scope, without making every previous decision obsolete. Fresh research is warranted when a material choice depends on changing external capabilities.

## From agreement to an executable targeting solution

The orbital-satellite image expresses concrete coordinated change: identify what must be removed, replaced, inserted, moved, refactored, preserved, and checked, then realize the change efficiently. Its distinctive value is precise targeting and coherent execution. Agent count is secondary.

A candidate materialization compiler would connect accepted semantic change with the actual repository revision to derive executable operations. Packaging a proposal into a plan is insufficient if deriving the correct proposal still requires every worker to reconstruct the architecture independently. The missing conceptual bridge is from intended difference to justified effects.

An operation would identify its purpose, machine-resolvable targets, input dependencies, permitted effects, preconditions, preservation obligations, and postconditions. Targets may include symbols, configuration entries, registrations, generated artifacts, tests, and relationships. A capability can span many files, and a file can contain several responsibilities.

For an API migration, the concrete program might bind the existing contract and resolved consumer set, replace selected calls and imports, preserve ordering and fallback behavior, retire the obsolete registration, and validate compatibility plus complete removal of the old path. This is more informative than assigning “update consumers” to a worker. A refactor similarly needs an explicit structural objective and behavior-preservation contract, rather than an open request to make code cleaner.

Three achievements remain distinct:

| Achievement | Necessary evidence |
| --- | --- |
| Hit selected targets precisely | Resolvable selectors, bound inputs, supported transforms, mismatch rejection |
| Establish adequate impact coverage | Semantic bindings, analyzers, observations, explicit unknown frontiers |
| Realize the intended change | Shared understanding, independent acceptance criteria, experiments and validation |

Exact execution cannot make an incomplete impact model complete or an incorrect intention correct. The ambition is increasingly precise execution with bounded, visible uncertainty.

## Preserve validity while the repository changes

Binding a plan to source files alone misses important dependencies. Suppose discovery finds three consumers of an interface. A fourth appears while replacements are prepared, without modifying those original files. Their hashes still match, but the removal plan is stale. Its basis includes reference-query membership, relevant empty results, contracts, and observed state.

This also constrains parallel work. Disjoint edits can depend on the same unsettled contract. Independent preparation becomes useful only when semantic reads, writes, assumptions, and shared resources permit it. Stable shared reads can support parallelism; disputed shared meaning generally belongs with one strong owner until a meaningful boundary exists.

The intended response to changed evidence is selective reconciliation. Refresh the invalidated targeting or decision, preserve still-valid work, and validate the resulting combined revision. A clean merge supplies no evidence that shared assumptions still hold. Complete obsolete-path removal must include its direct manifestations and references; leaving compatibility machinery requires a separate reason grounded in the requested behavior.

## Candidate construction and coordinated integration

One promising arrangement prepares novel implementations and mechanical rewrites in a provisional repository state, validates the candidate, freezes the exact transformation, and applies it against its bound basis. Deterministic tools can handle supported renames, structured rewrites, generation, and verification; models handle the unresolved design and synthesis.

This arrangement controls intermediate states and can avoid exposing a destructive gap between removal and replacement. It does not eliminate creative work or make that work free. Repository promotion also cannot make database or external-service effects atomic; migrations need appropriate sequencing and recovery.

“One progressive iterative pass” is best retained as one coordinated evolution that avoids repeated global rediscovery. Local iteration remains possible when evidence requires it. Whole-change freezing, smaller coherent prepared units, and ordinary authorized edits followed by reconciliation are alternatives whose scope remains open. Replaying every small edit through elaborate machinery could cost more than it prevents.

Ordered changes to the same region need either one compound operation with continuous ownership or explicit sequencing with intermediate-state checks. This is a representation decision, not a problem solved by adding workers. Worktrees are another optional mechanism; their isolation and integration expense must justify their use.

## Product completeness and decisions still open

The desired lifecycle includes initial intent, clarification, architecture, implementation, failure recovery, resumption, verification, and reconciliation. Specification-driven development supplies its forward path; ongoing observation and reconsideration close the maintenance loop. Specifications and plans should express retained meaning without becoming competing authority stores. A new change-case aggregate is warranted only if existing identities cannot support the coordination required.

Historical reports distinguish sophisticated generic machinery from incomplete installed product composition. Those observations are useful audit questions, not present-day facts. Any implementation proposal must inspect the actual branch, revision, current canonical model, and public workflow before prescribing changes. Evidence should connect requirements through engine, CLI, MCP, plugin, and installed artifact where those surfaces matter.

The important open questions are how targeting is derived, what coverage is achievable, how large a prepared unit should be, and when preparation earns its total cost. A discriminating experiment would migrate a cross-package implementation with hidden registrations, generated outputs, obsolete code, and a newly introduced consumer. Compare against a strong ordinary owner using the same tools and acceptance criteria. Count indexing, planning, synthesis, integration, missed effects, repair, and retained valid work. Reduced reasoning after the first canonical write alone proves only that reasoning moved; it does not prove an economic advantage.
