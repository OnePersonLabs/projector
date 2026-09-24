---
name: apply
description: Implement a reviewed Projector change in its managed candidate, including carrying a revised plan into partially implemented code.
---

Read [the runtime contract](references/runtime.md) before lifecycle operations. If artifacts are absent or incomplete, route to $projector:propose.

1. Resolve the fixed source `root` and `change`, read the approved artifacts and actual implementation, and confirm authorization from the conversation.
2. Call `prepareChange({root,change})` for a new candidate or `resumeChange` for an existing one. A `requiresRevision` response routes through $projector:revise. Keep the returned candidate identity and exact target.
3. Enroll the candidate with the managed observation protocol in the runtime reference. Inspect the target's applicability, actual changed artifacts, and previous contributions. Call `validatePlan` with executable selectors and justified retain/remove/replace/revise dispositions.
4. Call `applyChange({root,change})`. Implement only in `candidateRoot`, through acknowledged mutation batches. Keep requirements/design edits in the source change and use $projector:revise for changed intent; do not edit live authority in the candidate.
5. Complete implementation tasks based on actual work. Review affected callers, tests, docs, dependencies, exports, and registrations. Remove obsolete behavior within scope while preserving justified code in shared files.
6. Reconcile changed task wording and update contribution coverage after actual edits. Fix actionable obligations, and run relevant checks through $projector:verify. If end-to-end completion is authorized, continue to $projector:finish.

Completion: the requested code is implemented in the identified candidate, task status reflects real work, and verification results or precise remaining obligations are reported.
