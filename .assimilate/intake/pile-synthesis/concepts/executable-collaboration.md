# Executable collaboration

`§executable-collaboration` · Work on the same candidate change rather than exchanging descriptions of separate imagined changes.

## Core

A frontier agent and a project counterpart can collaborate through a revision-bound candidate, source queries, counterexamples, proposed patches, and acceptance conditions. The shared object has operational consequences outside either model's explanation.

Text remains useful. The important question is **which reasoning has already been performed and which claims can be checked**, not whether the communication alphabet is prose or vectors.

## A concrete transaction

For a hypothetical offline-account transition, a counterpart could return:

```text
Candidate: reconcile guest identity into an existing account
Basis: repository revision + accepted-conception revision
Conflict: relinking may change duplicate-observation detection
Evidence: current consumer query and relevant behavior trace
Counterexample: one observation receives two canonical assessments
Proposed repair: preserve observation identity across relinking
Unresolved: whether historical assessments should be recomputed
```

This is an interface sketch, not an implemented API. Its value depends on the query resolving actual code, the counterexample being executable or otherwise independently checkable, and the candidate being inspectable and revisable by both participants.

The frontier agent can reject the proposed repair, implement an alternative, and ask the counterpart to assess the actual diff. The counterpart is not a rubber stamp; the frontier is not obliged to accept an explanation as proof.

## Bind all relevant inputs

A candidate's basis includes more than the files it will edit. It can depend on contracts, generated artifacts, configuration, observed traces, and query membership.

If a planner found three consumers and a fourth appears, the plan may be stale even when the first three files are unchanged. An empty query can also be consequential evidence. Negative findings must be tied to their search scope and revision.

Revalidate affected assumptions before promotion. Preserve work whose dependencies remain valid instead of restarting every worker because anything changed.

## Context interface versus intervention interface

A context interface answers “what should I know?” An intervention interface helps establish “what happens if we make this particular change?” Both can be useful.

A learned counterpart is not automatically necessary for the intervention interface. A generic model with strong retrieval and good tools might obtain most of the benefit. Conversely, training may improve judgment without requiring a special communication channel.

Use a factorial comparison to separate these effects: generic versus project-trained counterpart, each with compiled-context versus shared-intervention collaboration. Include a frontier-only baseline. Keep evidence, tools, tasks, and acceptance criteria comparable.

Vary the communication budget and repeat across coupled changes. Otherwise, a carefully prepared one-off packet may be mistaken for persistent understanding.

## Limits of latent collaboration

Ordinary model APIs do not become shared neural memory because an agent sends a vector, an embedding identifier, or a tool name. Direct latent-state collaboration would require an actual supported interface and its own evidence of benefit.

A practical first version can use text, structured records, files, and executable tools. It should demonstrate useful division of reasoning before investing in a new latent protocol.

## Admission test

A transaction is valuable when it removes necessary reconstruction, exposes a consequence that matters, or makes a candidate easier to verify at lower total cost. A verbose tool result that merely restates the architecture has not achieved that.

The same discipline applies to ordinary subagents: return the useful completed reasoning, its evidence, and the remaining decision, not a transcript of activity.
