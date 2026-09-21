# Codex workspace-write Git observation boundary

Evidence: [the isolated diagnostic log](../../.temp/projector3-codex-workspace-write-git-spawn-diagnostic.log).

The diagnostic ran inside a separate `codex exec --sandbox workspace-write`
session. PowerShell resolved and ran Git directly. A Node process in that same
session received `EPERM` for `child_process.spawnSync` for Git with inherited
environment, Projector's sanitized observation environment, and the absolute
Git executable path.

Projector's `change.capture` reaches this boundary at the read-only Git
inventory step before worker computation, lifecycle persistence, or canonical
writes. This establishes a workspace-write sandbox limitation; it does not
show that Projector is unusable when its process has ordinary child-process
permission. The current parent environment is `danger-full-access`, which is
a different execution condition.

The confirmed non-Git filesystem fallback must not be used for a Git
repository. It would remove tracked-object identity, move, and Git-base
evidence. No Git-observation bridge is proposed or implemented in this
campaign.
