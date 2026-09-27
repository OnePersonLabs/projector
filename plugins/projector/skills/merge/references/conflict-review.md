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

Use `git worktree list --porcelain` and the publication journal under the target Git directory's `projector-publications` directory to find preserved detached integration work. Confirm the recorded target branch, pinned target commit, source parent, exact reviewed commit, and worktree before continuing. Inspect journal progress, `MERGE_HEAD`, unmerged stages, and actual files. If several integrations fit, present their concrete path, target, and source commits for selection. Resume the same prepared transaction rather than creating a second publication.

Do not reset a target branch or delete a dirty worktree during recovery. Preserve unexpected target edits and staged work. After successful publication, use ordinary Git worktree removal against the exact recorded temporary directory. If cleanup fails, leave the reviewed target intact and report remaining cleanup.
