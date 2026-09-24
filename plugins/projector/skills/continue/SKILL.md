---
name: continue
description: Resume a Projector change after interruption or advance its next planning or implementation step from durable state.
---

Read [the runtime contract](../apply/references/runtime.md).

1. Resolve the source repository and selected change from context or active changes. Inspect artifact files and durable state; use a single clear active change without re-asking. If several fit, present their concrete names and states for selection.
2. Without prepared state, inspect planning completeness. Read $projector:propose and author the next missing layer for incremental mode, or complete all remaining layers when that was requested. Preserve existing reviewed artifacts.
3. With prepared state, call `resumeChange({root,change})`. Use its returned candidate and obligations; do not allocate a duplicate candidate or infer success from task checkboxes.
4. Route changed meaning or conflicting task edits to $projector:revise; implementation work to $projector:apply; completed work awaiting evidence to $projector:verify; finish/recovery to $projector:finish. Read the selected skill before following it.
5. Preserve the original authorization across interruption. Do not turn “continue” into authorization for a previously unapproved proposal or new scope. An existing end-to-end authorization remains sufficient.
6. Report recovered state, work completed, and any exact remaining obligation. A published result needs only remaining bookkeeping and a settled no-op check, not a second implementation.

Completion: the authorized next step is performed against the original durable change, or a concrete blocker is explained with the preserved candidate location.
