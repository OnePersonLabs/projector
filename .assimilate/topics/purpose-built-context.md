# Purpose-built context

## Purpose

An agent needs a working understanding suitable for its current decision, not every document that might be associated with its task. A purpose-built context mechanism constructs that understanding from a durable conception, while preserving access to relevant detail and making its limitations visible.

The proposed semantic context compiler is a Projector research direction described inside the assimilation workspace, not yet a required standalone service. Its input would be the task, decision, scope, current project state, recipient capabilities, and relevant Projector meaning. Its output would be a jointly coherent working view, with constraints, unresolved assumptions, and routes to further disclosure. Assimilation may separately use its own Markdown and relationships to prepare task context for its workers. That operational use does not make assimilation's file identities the identities of Projector's accepted concepts. A richer [learned project counterpart](persistent-project-understanding.md) could participate in Projector later without being reduced to a prose retrieval store.

## Concepts and their expressions

A concept is not identical to one filename or paragraph. Its useful meaning includes the distinctions it enables, relationships it participates in, obligations it imposes, and consequences it helps predict. Prose, examples, tests, traces, and diagrams can express different aspects of that meaning.

A task-specific view is comparable to rendering a scene from a selected perspective: include what matters from that position without implying that invisible parts do not exist. This is a design analogy, not evidence that conceptual rendering has a geometric or lossless implementation.

For an undo-related change, a useful view might expose action identity, consequence ownership, reversibility, and dependencies on later actions. A generic definition such as “undo reverses an action” does not supply that working understanding. The needed view changes with the decision: storage design, user experience, and recovery validation need overlapping but different detail.

## Compile interacting concepts together

Independent summaries of individually relevant concepts can omit their critical interaction. Construct the context packet around the decision and its dependencies, including governing constraints that lie outside the immediate edit surface. A latency improvement may look sound locally but change authority or recovery semantics elsewhere.

The packet should make clear:

- The intended outcome and the decision or work the agent owns.
- The current-state assumptions and relevant revision binding.
- The operative constraints, relationships, and acceptance conditions.
- What is intentionally outside scope, unknown, or not yet supplied.
- Which observations require expansion, reconsideration, or escalation.

These are information obligations, not a demand to repeat a large template for every trivial task. The packet is sufficient only relative to its purpose and evidence. Shortness and confident prose are not measures of sufficiency.

## Disclosure frontier

A view needs explicit boundaries. It should identify where further context is likely to matter and provide resolvable access to that context. An agent that discovers it is changing action ownership, for example, should know to load the authority and recovery constraints before proceeding.

Expansion can happen proactively when a known relationship makes a dependency material, or reactively when work reveals a new uncertainty. A child agent should normally expand against the same basis for the task, rather than inheriting only a summary of a summary. For an assimilation worker, that basis is the assimilation fileset and relevant captured material. For a Projector development worker, it is Projector's accepted meaning and current evidence. Findings return to the relevant owner when they alter another task's assumptions.

Supplementation is not pure set subtraction. Repeating a short governing constraint may be necessary to make a new view coherent even if those words appeared earlier. Avoid duplicate exposition, but do not optimize away the anchors that give new detail its meaning.

## Delivery state is not understanding

Track delivered context, when tracking is worthwhile, against the actual context instance and conceptual revision. An agent identity does not prove that a particular explanation survived a reset, handoff, or compaction. A delivery receipt records delivery, not comprehension or correct application.

If a concept changes, dependent views may become stale. Their validity should be reconsidered according to what changed and what each view depends on. If precise invalidation is unavailable, communicate that limitation and conservatively reload material relevant to the consequential decision; do not claim complete dependency knowledge.

If the host assembles context incrementally, applying the same identified supplement twice should not duplicate or corrupt that assembly. That is a testable delivery property, not proof that a recipient interprets the material identically each time. A useful supplement may repeat a short governing anchor while avoiding an unnecessary second exposition of what was already supplied.

The durable conception and its correctness obligations must remain separate from learned delivery preferences. Finding that a shorter packet often works does not authorize silently weakening a requirement in the underlying model.

## References and navigation

The supplied discussion favors a lowercase kebab-case `§` reference such as `§semantic-dynamics`, with a possible view form like `§[semantic-dynamics?view=review]`. That was a proposal for referring to project concepts and their views. It does not define an assimilation topic-note syntax, a current Projector parser, or an identity mapping between the two systems.

Assimilation topic notes use ordinary relative Markdown links for navigation. If Projector later adopts a concept-reference notation, its identities should not be unnecessarily coupled to storage paths. Renames, aliases, view parameters, and resolver behavior would need a separate concrete contract. An elegant sigil alone does not solve identity, relationship discovery, or sufficiency.

## Improve delivery from outcomes

Observe whether packets support correct decisions, when recipients need supplementation, and which failures arise from missing or misleading context. Absence of questions is not proof of success: an agent may confidently proceed without noticing what it lacks.

If a dependency is almost always needed immediately, preloading it may reduce repeated work. If different task classes need different aspects, condition the view accordingly. If the dependency becomes relevant only after a discovery, retain an expansion route. If recipients repeatedly misinterpret prose, improve its precision and examples rather than simply delivering more of it.

Controlled wording and evaluation-driven refinement are useful candidates, but identical interpretation across models and sessions cannot be assumed. Evaluate the complete packet, including interactions, against tasks and adverse cases. Include silent omissions, changes of revision, resets, and uncertainty that should trigger expansion. Compare against simple retrieval and explicit brief baselines at comparable quality.

## Boundaries

This mechanism supplies a task-conditioned working perspective. It does not by itself establish persistent learned judgment, prove that its dependency closure is complete, or authorize a downstream action. [Semantic dynamics](semantic-dynamics.md) describes a richer capability to reason about interventions; [project stewardship](project-stewardship-and-change.md) determines how mature understanding becomes authorized change.

Context construction, caching, specialization, and supplementation must earn their combined cost. More specialized agents can increase duplication and integration work. The criterion is better end-to-end work under the [quality and economics policy](quality-and-work-economics.md), not the smallest prompt or largest swarm.
