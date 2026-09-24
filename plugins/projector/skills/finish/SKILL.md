---
name: finish
description: Verify and archive one or multiple Projector changes, recover interrupted completion, or carry an explicitly authorized change through end-to-end delivery.
---

Read [the runtime contract](../apply/references/runtime.md). For several changes, also read [bulk completion](references/bulk.md).

1. Resolve the explicit change selection. “Finish” authorizes necessary verification and archive for the selected change. It does not authorize unrelated scope, integration into the current working branch, deployment or external publication.
2. For incomplete planning/implementation under an end-to-end request, route through $projector:propose and $projector:apply. For an interrupted finish, call `resumeChange` and act only on remaining bookkeeping or obligations.
3. Use $projector:verify for current executed evidence and independent review. Resolve every completion obligation. Never manufacture successful review/evidence records or mark unperformed tasks complete.
4. Call `finishChange({root,change})` as the single archive pipeline. Inspect its returned result, archive path, and publication. Do not run generic OpenSpec archive afterward.
5. After a successful settled finish, call it again and confirm a substantive no-op. If the baseline or candidate branch moved, preserve all work and report the scoped recovery needed; never force-update refs.
6. Tell the user what works, what was checked, and where the candidate branch is. Archiving leaves verified work on that branch. If the user also authorized integration, read and use $projector:merge; otherwise, state that integration into the working branch is a separate action.

Completion: exact target archived and candidate branch published with settled recovery, or an actionable per-change blocker with no claimed success.
