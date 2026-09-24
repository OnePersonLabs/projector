# Existing projects

## Already using OpenSpec

Run `$projector:init`. Projector adds its schema while retaining configuration, requirements, active changes, and archives. New Projector changes explicitly select its schema.

You do not need `opl-openspec` enabled. Existing project-local skills or hooks may still select the old workflow; ask the agent to inspect those if both activate. Initialization does not remove instructions or change other plugins.

Choose an active change to adopt. The agent preserves requirements and nested capability paths, translates relevant design decisions into separate concern designs, and reconciles tasks. Material changes are presented for review. Archives remain history.

Cross-repository OpenSpec stores are outside the local candidate workflow. A store pointer produces an actionable error instead of being ignored or rewritten.

## Already wrote the code

Invoke `$projector:reconcile` and identify the edits to capture.

The agent examines staged, unstaged, and untracked files, identifies a coherent patch, and reconstructs requirements and designs. Observed code shows what exists, not necessarily what you intended.

Original files and index remain intact. Only the selected patch enters the candidate. Unrelated or ambiguous edits remain untouched; conflicts are explained. Imported implementation still needs checks and review.

## Tasks are out of date

Ask `$projector:reconcile` to compare tasks with code. It distinguishes already-present work, stale tasks, and missing work. A task edit cannot silently amend an approved requirement.
