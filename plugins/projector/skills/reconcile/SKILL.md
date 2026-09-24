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
4. Prepare and validate a candidate, then import only the selected patch using the reference procedure. Preserve staging distinctions in the source; the candidate represents the selected final implementation.
5. Audit residue and completeness in the candidate, reconcile tasks against actual work, and run $projector:verify against imported code. Never reuse source-worktree test results as candidate evidence.
6. Report included/excluded paths, provenance, untouched source/index, candidate location, and validation. Continue to $projector:finish only if authorized.

Completion: a coherent agent-authored change explains the selected existing work and its imported candidate has real verification, while unrelated source work remains intact.
