# Context compilation

`§context-compilation` · Give an agent the perspective it needs, including the boundary of what it does not yet know.

## Core

Context compilation derives a task-specific working view from shared project meaning and current evidence. It is more than retrieving a few similar paragraphs, and less than asking a parent agent to rewrite the whole architecture for every worker.

A useful packet contains the task, applicable obligations, relevant current evidence, allowed decisions, prohibited assumptions, expected output, and a way to request additional detail. It should include enough information to recognize when its own scope has become insufficient.

The object being optimized is **the composed packet in use**, not the elegance of each individual concept file.

## Stable identity, ordinary files

The lightweight reference convention is `§<lowercase-kebab-case-id>`. A stable subject such as `§assessment-authority` is distinct from the path of a file that currently describes it.

Ordinary Markdown links work now. A future resolver may support explicit views such as `§[assessment-authority?view=implementation]` or an addressable subsection. That syntax would be a convention implemented by the resolver, not built-in Markdown behavior.

Keep recipient identity, budgets, revision state, and delivery receipts out of the prose syntax. Those belong in the surrounding execution context.

## A bounded packet

A context packet should answer:

| Field | Purpose |
|---|---|
| Goal and output contract | Define the useful result, not merely an activity. |
| Applicable concepts | Explain the meaning the task depends on. |
| Evidence handles | Identify revision-bound source, observations, or query results. |
| Decision boundary | Separate settled decisions from judgment delegated to this worker. |
| Disclosure frontier | Say when additional context is necessary and how to obtain it. |
| Verification | Identify checks that can disprove the result. |

For example, an adapter-implementation packet may disclose lifecycle ownership and the public contract while withholding a large history of unrelated alternatives. It should still signal that changing registration or destruction behavior requires a lifecycle view.

“Ownership” should be disambiguated where necessary: responsibility for lifecycle and changes is not automatically exclusive ownership of a source file.

## Incremental disclosure

The delivery system can track what it has supplied to a particular context instance and send a relevant delta instead of repeating the entire concept description. This requires a revision basis and invalidation rules.

A delivery receipt establishes exposure, not understanding. A context reset, compaction, stale source, or changed concept can invalidate assumptions about what the recipient still has available. A successful first answer does not prove it retained every governing obligation.

If the initial packet consistently causes the same necessary follow-up, consider preloading that material. If implementation work requests one detail and review work another, condition the initial view on the task. If the branch depends on a discovery, retain explicit disclosure triggers instead of preloading both possibilities.

A high follow-up rate can mean the packet is poor, or that progressive disclosure is working. No follow-ups can mean efficiency, or silent ignorance. Optimize against outcomes, not query count alone.

## Delivery learning is not concept learning

Delivery learning improves wording, examples, view selection, and preload strategy. Concept learning revises what is understood to be true or intended.

Do not improve packet scores by silently dropping difficult constraints. Do not turn a worker's misunderstanding into an authorized conceptual change. Their feedback can reveal ambiguity, but the governing decision requires its own evidence and authority.

## Context is an external-memory workflow

For material too large for a context window, keep evidence and intermediate artifacts on disk with stable addresses. Return bounded receipts, not whole logs. A coordinator can inspect the manifest and unresolved decisions, then open the specific supporting spans necessary for synthesis.

Splitting into arbitrary chunks is insufficient. Shared trunks, cross-file disagreements, definitions, and examples must retain relationships. The task graph should follow semantic dependencies; the file inventory is only the input map.

The concrete archive application is described in [archive workflow](../orchestration/archive-workflow.md).

## How to test it

Compare ordinary file context, competent retrieval, compiled views, and compiled views with explicit frontiers and revision-aware supplementation. Hold task, model, tools, and acceptance criteria constant.

Include a context reset, a deliberately omitted but discoverable obligation, a misleadingly similar concept, and a changed source premise. Measure successful completion, missed constraints, unnecessary reads, total inference and rendering cost, repair, and elapsed time.

A prettier packet or a lower initial token count is not sufficient evidence of improvement.
