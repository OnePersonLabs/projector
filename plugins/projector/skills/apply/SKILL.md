---
name: apply
description: Implement a reviewed Projector change in the selected checkout or an explicitly isolated workspace, preserving partial work across revisions.
---

Read [the runtime contract](references/runtime.md) before lifecycle operations. If artifacts are absent or incomplete, route to $projector:propose.

1. Resolve the fixed source `root` and `change`, read the approved artifacts and actual implementation, and confirm authorization from the conversation.
2. Call `prepareChange({root,change,workspaceMode:"checkout"})` or `resumeChange` for an existing change. The selected checkout is the default, including an already selected worktree. Request `workspaceMode:"isolated"` when parallel work or isolation needs another checkout. A `requiresRevision` response routes through $projector:revise. Keep the returned identity and exact target.
3. Enroll the candidate with the managed observation protocol in the runtime reference. Inspect the target's applicability, actual changed artifacts, and previous contributions. Call `validatePlan` with executable selectors and justified retain/remove/replace/revise dispositions.
4. Use $projector:verify to derive obligations, a test-change plan, and execution selection before behavioral slices. Call `applyChange({root,change})`. Implement in the returned `candidateRoot`, through acknowledged batches. In checkout mode it is the selected source checkout. Keep proposed authority in the active change and use $projector:revise for changed intent; do not directly edit accepted live authority.
5. Complete implementation tasks based on actual work. Review affected callers, tests, docs, dependencies, exports, and registrations. Remove obsolete behavior within scope while preserving justified code in shared files.
6. Reconcile changed task wording and update contribution coverage after actual edits. Fix actionable obligations, and run relevant checks through $projector:verify. If end-to-end completion is authorized, continue to $projector:finish.

Completion: the requested code is implemented in the identified candidate, task status reflects real work, and verification results or precise remaining obligations are reported.
