# Assimilation workspace

## Purpose

The proposed `$projector-assimilate` should accept heterogeneous material and maintain a coherent, evolving conception that remains usable across context resets, new conversations, and long pauses. Inputs may include handoffs, branched chats, transcripts, webpages, repositories, research, and unfinished thoughts. Requiring the user to pre-sort the pile defeats a central purpose of the system.

The result is not a larger summary. It is an organized account of current meaning: what the project is trying to accomplish, how its parts relate, what must hold, which mechanisms are proposed, which alternatives remain live, and what still needs to be discovered or decided. Its size may exceed a context window; its structure must make useful, coherent portions available without pretending those portions are the whole.

The workspace can support design without implementation. Assimilation does not itself authorize changing a receiving project, adopting every proposal, or turning exploration into binding specification.

## An isolated assimilation synthesis

The Markdown fileset belongs to assimilation alone. It can be authoritative for the current state of the assimilation exercise while having no authority over Projector's accepted product meaning. Its topic-note names and links organize ideas assembled from the pile. Projector's concept records have a different identity system, schema, acceptance lifecycle, and role. Even when a topic note studies a particular Projector concept, the two are not one entity or synchronized views of one entity. A common name or a reference to a Projector record is evidence about the subject, not an identity bridge.

This separation is necessary because the pile itself contains proposals about how Projector should represent, learn, and use concepts. Treating the topic notes as Projector concept records would force the system to assimilate revisions of its own storage mechanism through the same mechanism it is trying to evaluate. The isolated workspace can reason about that possibility without adopting it.

## Durable synthesis and bounded execution state

Separate the persistent working synthesis and retained intake from disposable execution scratch. A repository-versioned topic fileset can survive repeated invocations and be exported as a portable snapshot. Intake captures and their coverage records remain available for a long campaign; extraction jobs, duplicate-index caches, and worker scratch can be disposable once their consequential results are retained. Neither scratch nor the evidence archive should contain the only surviving copy of important design meaning.

The normal entry point is a small index routing to cohesive topic notes. Split at useful reasoning boundaries, not merely at a fixed word count or one noun per file. A topic note should carry its operative meaning, relevant constraints, concrete consequences, uncertainty, and links to interacting topics. A thin description that requires an unavailable attachment is not a self-contained handoff.

Exact originals and selective evidence can remain behind the conceptual view when useful for verification or reinterpretation. That does not require narrating source history in the design. It also does not permit deleting the sole supporting material while silently promising future auditability. Retention and portability are separate decisions: a portable conception carries necessary meaning; an evidence archive preserves recoverable support when that support matters.

## Reconcile branches as evolving state

A branched chat is neither a wholly independent source nor simply a later replacement for every sibling. Repeated common material should not gain authority through duplication. A later event in one branch may revise its local proposal without resolving an alternative explored elsewhere.

Use known common ancestry, explicit corrections, scope, and the substantive content to reconstruct the current conception. Do not infer ancestry from similar titles alone or assume global last-message-wins ordering. Where lineage is uncertain, retain uncertainty instead of inventing a clean history.

Important distinctions include:

- A restatement can be deduplicated while preserving its qualifications.
- A refinement can replace an earlier formulation while retaining its still-valid obligations.
- A contextual variation can coexist with another formulation without being a contradiction.
- A genuine unresolved conflict needs a clear question or an explicit alternative, not an averaged compromise.
- An unsupported assistant elaboration remains a candidate, even when written confidently.

The current conception should state the resolved result directly. For example, cost-conscious work and refusal of scarcity-driven quality downgrades are compatible constraints on one policy, not opposing positions to reconcile by compromise. Consult the user for material ambiguity that remains after reconstruction; do not make them arbitrate differences that the available context already explains.

## Assimilation is critical adaptation

For a potentially useful donor idea, identify the underlying capability or mechanism, its assumptions, and what it could improve in the recipient. Then consider a native adaptation, including a cross-domain one, rather than copying donor vocabulary and architecture wholesale.

A useful proposal explains a concrete consequence: what changes, which existing owner should absorb it, which constraints survive, and how the benefit could be evaluated. It can also conclude that the idea is already present, unsuitable, premature, or not worth pursuing. Rejection of a mechanism need not discard the capability it was trying to provide.

Preserve consequential reasons and counterexamples. A discarded approach may expose a property that every future approach must preserve. That property belongs in current understanding; a blow-by-blow account of its discovery usually does not.

## Work across bounded contexts

Use deterministic tools for exact enumeration, fingerprints, recoverable copying, and declared-link checks. Use model judgment for semantic reconciliation, causal interpretation, adaptation, and resolving uncertainty. Exact duplicates can be recognized mechanically; semantic equivalence requires care with changed qualifiers and surrounding scope.

Delegate substantial independent slices with a bounded purpose, relevant material, ownership, and an explicit return contract. Workers should return durable results and unresolved interactions rather than flooding the parent with raw input. The integration owner must still examine cross-slice implications: summarizing each document independently and concatenating summaries cannot establish global coherence.

For densely coupled areas that exceed context, establish provisional interface assumptions, inspect affected neighbors, and iterate where a finding invalidates another portion. Track the unresolved boundary explicitly. No designation of a single owner makes an arbitrarily large dependency cycle fit into memory.

Resume from durable state recording what is established, what remains uncertain, the active work item, and the condition for stopping or continuing. A loop is justified by useful unfinished work, not by the mere existence of another possible pass. Stop optional investigation when it cannot plausibly change a consequential decision at a justifiable cost; required proof remains required.

## Everyday continuity

New material can arrive before earlier questions are answered. Incorporate what can safely be understood, keep the question open, and continue independent work. Silence is not approval. An invocation without new inputs should be able to recover the current state and advance a useful existing item.

Expose a small immediate frontier to the user while retaining the complete depth behind it. When a question is needed, prefer one whose answer resolves several consequential branches; state the interpretation at issue and what would change. Reassess its value when new material arrives. Avoid turning organizational assistance into a new obligation to maintain dozens of statuses or answer an exhaustive interview first.

## Boundaries and validation

Assimilation owns ingestion and the evolving interpretation of candidate understanding. Projector owns its accepted product model. Neither system silently writes or reconciles the other's concepts. The [assimilation-to-change boundary](../WORKFLOW.md) carries a mature intent brief into Projector's existing workflow; it does not depend on matching filenames, slugs, or identity IDs.

Test this workflow using branched, partially redundant material with revised commitments, subtle qualifications, missing sources, interacting concepts, and context resets. Compare the resulting conception against available inputs for material omissions and unsupported additions. Then give only the resulting file set to a cold reader and test whether it supports the relevant decisions and expansion triggers.

“Lossless conceptual squash” describes the fidelity ambition, not a proven compression guarantee. A readable output can still omit the one constraint that changes a decision. [Purpose-built context](purpose-built-context.md) addresses use of the resulting conception; [work economics](quality-and-work-economics.md) governs how much machinery and repeated analysis are justified.
