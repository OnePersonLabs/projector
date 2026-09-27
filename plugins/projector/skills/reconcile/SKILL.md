---
name: reconcile
description: Reconcile Projector tasks with actual implementation, or reconstruct a change from staged, unstaged, and untracked edits while preserving unrelated work.
---

First distinguish task reconciliation from reconstructing an uncommitted patch.

For a task-only request, inspect the selected change's tasks, requirements, designs, implementation, and available evidence. Read and follow $projector:revise for the actual corrections: infer missing tasks from observed work, preserve still-applicable tasks, leave unverified work unchecked, and classify scheduling versus authority amendments. Do not reconstruct a patch, create a new change, import files, or change implementation merely to reconcile task status. Completion is a coherent task list with truthful evidence and any remaining mismatch reported.

For patch reconstruction, read [importing existing work](references/import.md), [artifact authoring](../propose/references/artifacts.md), and [the runtime contract](../apply/references/runtime.md), then follow these steps.

1. Inventory staged, unstaged, and untracked work. Inspect actual content and identify one coherent selected patch, unrelated files, and ambiguous ownership. Clarify only scope that cannot be inferred safely.
2. Infer durable behavior and decisions from the selected patch. Use $projector:propose to author a historical reconstruction, explicitly distinguishing inferred intent from observed implementation and preserving source implementation/index.
3. Reject ghost requirements about performing this reconciliation or cleaning stale references. Put cleanup in tasks/evidence; describe surviving behavior in real requirement deltas.
4. Prepare and validate the selected implementation checkout, recording the selected patch separately from unrelated edits. Preserve source staging distinctions. If explicit isolated mode is needed, import only the selected patch using the reference procedure.
5. In checkout mode the selected patch is already present: do not import it over itself. In isolated mode use the selected-patch import procedure, preserving source files and index. Audit residue and completeness in the implementation checkout, reconcile actual tasks, and use $projector:verify. Reuse previous results only when their actual inputs and environment match; location alone is not proof of equivalence.
6. Report included/excluded paths, historical provenance, preserved unrelated work/index, implementation location, and validation. Continue to $projector:finish when authorized.

Completion: a coherent agent-authored change explains the selected existing work and its implementation has real verification, while unrelated work remains intact.
