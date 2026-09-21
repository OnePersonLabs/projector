# System conception

`§system-conception` · The shared meaning that software development must preserve or intentionally change.

## Core

A system conception is the current understanding of **what a system is for, what its distinctions mean, how its responsibilities fit together, and why its constraints and tradeoffs exist**. It includes intent, behavioral obligations, ownership, assumptions, accepted decisions, non-goals, unresolved alternatives, and consequences of prior experience that still matter.

The repository is evidence of an implementation. It is not a complete statement of intent. A test suite can establish particular behaviors without capturing why those behaviors exist. A specification can accurately express intended structure while the implementation diverges. A learned model can internalize useful relationships while misremembering exact identifiers.

Projector therefore separates four things:

| Thing | Role |
|---|---|
| Conception | The meaning being developed and governed. |
| Representation | A way to encode or learn some of that meaning. |
| Projection | A purpose-specific view of a representation. |
| Evidence | An observation that can support, limit, or contradict a claim. |

A Markdown concept file is a representation and a reading surface. It is not the concept itself. A code patch is a candidate materialization, not proof that the intent has been realized.

## The problem being addressed

Repeated development can reconstruct intent from whatever happens to be visible: nearby code, the latest prompt, an abbreviated history, and a few tests. Each reconstruction can omit an obligation or substitute a superficially similar meaning. Locally plausible changes can then accumulate globally inconsistent ownership, duplicated behavior, accidental compatibility layers, and tests that certify the wrong thing.

The design hypothesis is that **maintaining and reusing project understanding can reduce this repeated reconstruction and its downstream repair cost**. This is a hypothesis to test against competent code-and-documentation workflows, not a claim that conventional repositories are inherently incapable of representing intent.

## Responsibilities, not six mandatory services

A practical implementation needs ways to establish purpose, represent relationships, recognize recurring patterns, observe implementation, evaluate evidence, and predict impact. These are responsibilities. They do not justify six databases, six agents, or six parallel sources of truth.

The architecture should expose the smallest set of mechanisms that makes those responsibilities reliable. Existing repository concepts and tools should be reused before a second workflow store or competing specification system is introduced.

## Authority and uncertainty

The governing conception may change through an authorized decision. Preserving yesterday's architecture against a legitimate new requirement is not semantic fidelity.

Keep requirements distinct from examples, preferred mechanisms, hypotheses, defaults, and unresolved choices. A confidently phrased assistant proposal does not become an accepted requirement merely because it appears repeatedly. An observed implementation does not settle an unresolved product intention.

A useful state distinguishes:

- What is accepted and currently applicable.
- What is observed, including deviations and coverage limits.
- What remains a live alternative or unknown.

Those distinctions should survive every projection, including concise subagent context.

## Holons and perspective

A semantic holon is a coherent subject of inquiry that participates in a larger conception: assessment authority, instrument lifecycle, session identity, or another useful perspective. Its boundary is chosen for a task, not assumed to be a permanently separable piece of reality.

Persistent identity does not require a persistent model process. A concept can be dormant until a change creates an unresolved question about it. The scheduler can then activate the necessary computation and retire it when the question is settled.

## What success looks like

A coherent new feature advances the product purpose, preserves still-applicable obligations, intentionally revises authorized ones, and leaves no unexplained semantic residue. It also avoids making the next change unnecessarily difficult.

A hypothetical music application is not successful merely because ownership boundaries are immaculate. If the design interrupts musical exploration, it may fail its central purpose. Positive capability and useful new possibilities belong alongside preservation checks.

**Continue:** [Conceptual dynamics](conceptual-dynamics.md) explains meaningful change. [Semantic control](semantic-control.md) turns these distinctions into a development loop.
