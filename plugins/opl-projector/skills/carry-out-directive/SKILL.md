---
name: carry-out-directive
description: In a Projector-activated project, carry out implementation work with shared meaning, scoped evidence, owned recovery, and reviewable local commits.
---

# Carry out a directive

Check that this project is activated before Projector work. If `.projector/active` is absent, continue the native task without Projector. Do not make activation a condition of ordinary work.

Read the applicable authority and relevant exceptions. Use the native host to plan and execute the work. The native root owns shared meaning and the checkpoint. Give workers disjoint output paths and the conditions that apply to their outputs. Projector supplies evidence and recovery helpers; it does not schedule work.

If the project is a Git checkout, inspect the branch, current commit, and Git status before editing. Identify existing staged work and inspect relevant working diffs. Distinguish existing work from the directive's changes. For every project, identify the next unit that a reviewer can understand as one change. Adjust that boundary as dependencies become clear; do not wait until final handoff to divide a large changeset.

Use Projection Units to navigate from a Concept to affected implementation participants. Refresh stale bindings when files or discovery membership change. Use Projection Lenses to select the population separately from the property under test. Handwritten implementations can satisfy the same Concept without sharing a generator or syntax.

Run known producers through the native host. When replacement needs recovery, produce staged files first. Inspect staged content, then use an owned `repair` request with expected hashes. Read [the reference guide](../../references/guide.md) for the request contract. Keep source, generated outputs, and producer ownership explicit.

Keep original mismatch evidence before changing an implementation, selector, check, or Concept. Run the smallest relevant deterministic checks. State what they establish and which language or framework checks remain unrun.

## Reviewable local commits

In an activated Git project, the native root makes local commits when a coherent unit is ready. Follow more specific user and repository rules, including a request to leave work uncommitted. Workers return changes and evidence; they do not stage or commit. Read [the commit procedure](../../references/guide.md#reviewable-local-commits) when preparing a commit.

Group changes by the behavior or decision they explain. Keep the implementation, affected consumers, relevant checks, and necessary meaning changes together. Split unrelated behavior and cleanup. A preparatory change earns a separate commit when it is useful and reviewable by itself. Do not split by file, language, agent, elapsed time, or a fixed size quota. If dependent changes cannot form coherent intermediate states, keep them together. Provide a clear review order.

At a unit's completion point, inspect its actual diff and applicable check results. Apply existing review requirements. Do not add a certification cycle for every commit. Preserve evidence scope and unresolved questions; a commit does not certify the whole feature. Never bypass a failed hook or describe a known failure as passing.

Write a subject that names the concrete result. Add a short body with the reason, the behavior or exception that matters, and validation or remaining limits. For a broad unit, say why it belongs together and where to start reading. The reviewer should understand the unit without this conversation.

Commit only the directive's reviewed changes. Preserve other staged and working changes. If ownership, concurrent index use, or mixed edits prevent safe isolation, leave the unit uncommitted, retain its reason and next action in existing task state, and continue independent work. Report local commit IDs in the handoff. Push or rewrite history only with separate authorization.

## Handoff

Update shared meaning only when this work changes meaning. Update the checkpoint when it creates a useful future action or interruption state. Preserve unrelated edits. Hand the root exact changed paths, evidence, gaps, and decisions.
