# Troubleshooting

Start from the reported symptom and preserve the relevant candidate and artifacts. Ask the agent for the exact failed operation, affected paths, and next useful action.

## Contents

- [Skills are missing](#skills-are-missing)
- [Skills work but tools fail](#skills-work-but-tools-fail)
- [Initialization is blocked](#initialization-is-blocked)
- [Completion is blocked](#completion-is-blocked)
- [Integration is blocked](#integration-is-blocked)
- [An owner version conflicts](#an-owner-version-conflicts)

## Skills are missing

Ask the agent to inspect installed and enabled plugin state. After installation or refresh, start a fresh Codex session. Confirm that the actual installed package contains the expected skills, including `$projector:propose` and `$projector:merge`.

Do not keep issuing the same invocation to a session that has not discovered the package. [Installation](getting-started.md#install-the-plugin) and [development](development.md#local-plugin-installation) describe the supported route.

## Skills work but tools fail

A skill can be visible while its MCP relay fails to start. Ask for the actual installed MCP startup error and a tool-execution check. Registration and a successful handshake are distinct from initialization in a real project.

Inspect prerequisites, installed package identity, and the configured endpoint. A foreign or incompatible owner is an error. The runtime does not silently choose another production port to hide a conflict.

## Initialization is blocked

| Symptom | Useful action |
| --- | --- |
| Customized schema differs from the bundle | Compare exact files and decide a scoped resolution; preserve the customized source. |
| Store-backed configuration is found | Select the owning local Git repository or retain the existing store workflow; do not manufacture competing local authority. |
| No Git baseline exists | Planning can proceed; establish a valid baseline within authorized scope before preparing a candidate. |
| Old local instructions select another workflow | Inspect the owning instructions or hooks and resolve the overlap deliberately. |

Initialization preserves existing configuration and historical archives. See [existing projects](existing-projects.md).

Recognized previous bundled schemas upgrade automatically. A customized file remains a conflict to inspect; do not replace it merely because a new bundle differs.

## Completion is blocked

| Symptom | Useful action |
| --- | --- |
| Several active changes could match | Name the intended change. |
| Task status does not match code | Use `$projector:reconcile` for task-only accounting. |
| Evidence is stale | Execute affected checks again against the final basis and refresh independent review. |
| A check failed | Trace the cause and repair it within scope; preserve the failed result. |
| Previous contributions remain unresolved | Inspect retain/remove/replace/revise accounting and actual ownership. |
| Prerequisite result is absent from the baseline | Resolve the required integration or revision; bulk finish cannot silently repin. |
| Publication or target reference moved | Preserve the candidate and inspect the exact mismatch before scoped recovery. |

Checked tasks, narrative test claims, and simulated review cannot settle these obligations. If a check covers only compilation, the report must leave unexercised behavior visible.

If a long check disconnects, inspect its persisted evidence before repeating it. Projector permits the selected execution deadline plus settlement time, but MCP caller timeouts belong to the host. Configure that caller deadline or use the installed CLI. Do not mistake a disconnected response for a failed or absent execution.

Use [revisions and recovery](revisions-and-recovery.md) to resume the original change. Repeating the same failed finish without changed inputs does not resolve its cause.

## Integration is blocked

A successful finish integrates the selected change. If the branch is unchanged, inspect completion obligations and the publication journal; an archived candidate alone is not completion.

Unrelated dirty work is permitted and preserved. Actual overlapping edits need scoped reconciliation; the merge skill will not stash, commit, or discard your work. If the target moved during review, preserve the isolated integration and inspect the drift.

For an ambiguous conflict, read the decision brief and specify the desired behavior. The brief should include both branch intents, dependencies, and consequences. The original target stays unchanged while the choice is unresolved.

[Integration](integration.md) explains no-op, successful publication, preservation, and deliberate rejection.

## An owner version conflicts

Settle active operations and release clients before replacing an active owner. The agent uses the old authenticated installed client for shutdown, then lets the new client start the updated owner. It must not kill unidentified processes or bypass the conflict with a different production endpoint.

[Development](development.md#updating-an-active-owner) gives the maintainer procedure. For a problem that remains unresolved, retain the exact error and relevant candidate location and report those alongside the next required action.
