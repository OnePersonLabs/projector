---
name: finish
description: Verify, archive, and integrate selected Projector changes, including recovery of interrupted publication.
---

Read [the runtime contract](../apply/references/runtime.md). For several changes, read [bulk completion](references/bulk.md).

1. Resolve the selected change. Finish authorizes verification, archive, and integration into the selected branch. It does not authorize unrelated scope, deployment, or external publication.
2. Route incomplete planning and implementation through $projector:propose and $projector:apply. For interrupted finish, call `resumeChange` and inspect remaining steps and obligations. Preserve unexpected edits.
3. Use $projector:verify for current evidence and independent review. Never manufacture results or mark unperformed tasks complete.
4. Call `finishChange({root,change})`. Publication assembles selected implementation and accepted authority in a temporary detached linked worktree. It runs normal hooks, inspects the resulting commit and hook writes, and integrates reviewed code and authority together. Inspect publication, archive, and recovery details. Do not run generic OpenSpec archive afterward.
5. If hooks alter checked inputs or finalization fails, inspect the retained delta. Use `resumeChange({root,change,reconcileFinalization:true})` to recover that implementation delta into the selected checkout and reopen implementation. Repair, refresh affected checks, and independently review the result before another finish. Actual overlap or target drift needs scoped reconciliation. Preserve unrelated staged, unstaged, and untracked work, including disjoint shared-file edits. Never stash, reset, bypass hooks, or force-update the target.
6. Verify the integrated tree and settled recovery. Repeat finish to confirm a substantive no-op. Report the integrated result, checks, and precise remaining obligations. An archived candidate alone is not completion.

Completion: the selected branch contains reviewed implementation and accepted authority together. Archive bookkeeping is settled and temporary finalization is removed. Otherwise preserve recoverable work and report the blocker.
