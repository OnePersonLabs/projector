---
name: projector-reconcile
description: Investigate repository changes made outside Projector, such as external pulls or edits, after the user requests reconciliation or accepts a change-check offer. Delegate the comparison and return concise design implications; a hook notice alone does not authorize investigation.
disable-model-invocation: false
---

# Reconcile changes made elsewhere

Determine how observed repository changes fit the project's accepted intentions without filling the main task's context with the investigation. A changed hash is evidence of changed inputs, not a design violation or acceptance of new meaning.

## Root: offer and dispatch

If invoked by a hook notice alone, briefly offer investigation and wait. An explicit request or existing acceptance is sufficient; do not ask again. Continue independent main-task work while waiting. Read [the investigation procedure](references/investigation.md) only after investigation is authorized, or when assigned the investigation as a subagent.

Resolve the actual target repository. Use `repository.check` through [the shared operation contract](../../references/operation-contract.md) and [harness guide](../../references/harness-guide.md) to obtain the current pending finding. Reuse an existing investigator for that checkout, sending updated evidence instead of spawning another. Otherwise delegate a compact assignment: repository, finding and observation anchors, known saved-context IDs, requested outcome, authorization, active main-task scope, and this skill's path. Do not fork the whole conversation or supply a predetermined interpretation.

An explicit investigation can have no pending finding, for example after an earlier observation was handled. Use the user's requested scope, named commits or saved context as comparison anchors; inspect the current diff when no historical baseline is supplied. Do not invent a pending finding or a prior intention. No handled acknowledgement is needed for a finding that does not exist.

The subagent owns detailed inspection and evidence. The root owns user interaction, integration and coordination. If delegation is unavailable, report that limitation and offer a bounded local investigation instead of silently loading the entire process into the main context.

## Root: questions and integration

Relay a material subagent question through `request_user_input` with its meaningful choices and recommendation, then send the answer back. If that tool is unavailable, ask the same concise question in the root conversation. Ask at a suitable conversational boundary; a question must not interrupt a running tool or stop unrelated work. The subagent sends questions to the root rather than invoking the user-input tool itself. Silence is not an answer.

Before overlapping edits or design decisions, agree on ownership at the next safe boundary and refresh affected evidence. Investigation alone authorizes neither repair nor canonical acceptance. Continue already-authorized implementation where its scope permits; otherwise present the concrete proposed action.

Return only the consequential changes, design implications, unresolved choices, and references to detailed evidence. Do not mark a finding handled while a material question is unanswered or investigation is unfinished, even after delivering an interim report. Retain the question and continuation in a finding-specific runtime investigation note before ending the turn. Mark handled only after the completed investigation has been delivered or the user explicitly dismisses the finding; handling acknowledges observation, not conformance or design approval.
