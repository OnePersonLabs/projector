# Revisions and recovery

## Change direction

Use `$projector:revise` with the new behavior. The agent updates requirements and designs, then adjusts tasks and implementation.

Valid work remains available. The agent accounts for what to keep, remove, replace, or revise, including shared code in otherwise obsolete files. Changed inputs invalidate affected checks and review.

## Resume

Use `$projector:continue`. The agent discovers active changes and reads durable state rather than relying on chat memory. It asks which change you mean only when selection is ambiguous.

The next step may be drafting, a review decision, implementation, checks, or recovery. Missing authorization is not inferred from elapsed time.

## Checks and interrupted completion

Failed checks produce concrete findings. The agent fixes the cause within scope and reruns relevant checks. Stale successes and simulated review do not authorize finish.

Projector recognizes an exact existing archive/publication and resumes remaining bookkeeping. Moved branches or mismatched targets are reported rather than overwritten. Repeating settled finish produces no substantive change.
