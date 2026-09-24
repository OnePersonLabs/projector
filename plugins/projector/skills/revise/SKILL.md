---
name: revise
description: Revise a Projector proposal or partially implemented change, reconcile edited tasks, or infer missing tasks from implementation evidence.
---

Read [artifact authoring](../propose/references/artifacts.md) and [the runtime contract](../apply/references/runtime.md).

1. Read the selected change, live baseline, candidate if present, and requested edits. Compare the previous plan with the intended revision; preserve all still-applicable commitments.
2. Classify task edits as scheduling changes or proposed changes to behavior/decisions. Task text never overrides requirements and designs. For reverse-task requests, inspect actual code/diff first, derive verifiable tasks, and leave unverified work unchecked.
3. Author coherent revisions in the source change artifacts. Amend requirements and decisions whenever meaning changes, and update downstream tasks and evidence obligations. Preserve useful partial implementation.
4. If prepared, call `reviseChange({root,change})` after authority edits. Inspect the exact returned target diff and prior contribution inventory. Resolve source/candidate task divergence by combining both requests in both task files, within acknowledged candidate batches.
5. Call `validatePlan` with refreshed applicability and contribution dispositions. For changed task wording supply `taskChange:{kind:"scheduling"|"authority-amended",reason,targetId}` using the returned current target ID. Do not claim authority-amended before the authority is actually amended.
6. Report what changed and why. Continue implementation only if authorized; a planning-only revision ends with the updated artifacts and consequences for existing code.

Completion: artifacts agree, task edits are preserved/classified, and prepared state describes the new target without losing valid work.
