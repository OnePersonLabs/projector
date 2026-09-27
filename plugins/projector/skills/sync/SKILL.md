---
name: sync
description: Synchronize a Projector change's exact requirements and design target into its managed candidate without archiving the change.
---

Read [the runtime contract](../apply/references/runtime.md).

1. Select one change, inspect its artifacts, and prepare or resume its managed candidate. If source authority changed, revise and validate first.
2. Call `syncChange({root,change})`. This is the sole synchronization owner; do not manually copy deltas into live documents or run a separate OpenSpec sync/archive operation.
3. Inspect the returned target and implementation state. Synchronization materializes the exact target in the selected implementation checkout, which may be the source checkout or an explicitly isolated worktree. It does not advance the branch, archive the change, or establish verification.
4. Settle observation through a checkpoint before claiming a current view. Report the candidate location, synchronized target, and any conflicts or obligations.
5. Subsequent revisions use $projector:revise and refresh affected verification; finish still runs its own completion gates. Continue only within the requested scope.

Completion: candidate authority matches the pinned target, the change remains active, and later revision/finish remain available.
