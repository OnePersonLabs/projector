# Conflict review and recovery

## Confidence boundary

A conflict is safe to resolve when the requirements, design, callers, history and tests support one combined behavior. A textual resolution is insufficient when two independently valid edits produce an inconsistent contract, duplicate ownership, stale evidence or incompatible operational behavior.

Keep a conflict unresolved when repository authority cannot establish a product choice, ownership decision, migration policy, data-loss tradeoff, security boundary or release behavior. Preserve the base and both sides until the human decides.

## Human decision brief

Describe each unresolved conflict without requiring the reader to open a file or remember prior discussion:

- **Affected behavior:** Explain what the file or section controls and who depends on it.
- **Target intent:** Explain the behavior already present on the branch that will receive the merge.
- **Source intent:** Explain the incoming behavior and the change that introduced it.
- **Why they conflict:** Name the semantic choice that cannot coexist or be inferred safely.
- **Choices and consequences:** Give the viable resolutions and the observable maintenance, compatibility, safety or user effects of each.
- **Recommendation and uncertainty:** Recommend an option only when evidence supports it. State the missing fact when no recommendation is safe.

Group all known decisions in one request. Do not reduce the brief to paths, symbols, conflict markers or unexplained excerpts.

## Interrupted integration

Use `git worktree list --porcelain` and the `projector/merge-*` branch prefix to find preserved work. Confirm the original target branch, pinned target commit and pinned source parent from Git before continuing. Inspect `MERGE_HEAD`, unmerged index stages and the current diff. If several temporary integrations fit, present their concrete branch, path, target and source commits for selection.

Do not reset a target branch, delete a dirty worktree or force-delete a temporary branch during recovery. After successful publication, use `git worktree unlock`, `git worktree remove` and `git branch -d` against the exact recorded targets. If cleanup fails, leave the reviewed target intact and report the remaining worktree or branch.
