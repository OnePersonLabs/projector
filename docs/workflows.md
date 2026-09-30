# Workflows

`$projector` is the main Codex skill for project work. Choose the route by what the task changes and where the evidence came from.

## Contents

- [Plan a change to meaning](#plan-a-change-to-meaning)
- [Execute the authorized task](#execute-the-authorized-task)
- [Repair code under existing meaning](#repair-code-under-existing-meaning)
- [Verify an actual implementation](#verify-an-actual-implementation)
- [Reconcile outside changes](#reconcile-outside-changes)
- [Assimilate substantial sources](#assimilate-substantial-sources)
- [When Projector is unavailable](#when-projector-is-unavailable)

## Plan a change to meaning

Use `$projector` in native Codex Plan mode. Retrieve relevant accepted records and inspect the code and consumers. Show proposed concept, requirement, scenario, relation, and decision changes with readable contents, stable identities, likely paths, reasons, and implementation effects. Revise the plan through conversation. A question or tentative idea does not authorize a model write. Plan mode does not capture, accept, or implement the plan.

See [Changing accepted meaning](changing-accepted-meaning.md) and the [Clip/Placement example](examples/clip-placement.md).

## Execute the authorized task

Authorize Codex to implement the agreed task outside Plan mode. That authorization covers model acceptance, implementation and verification together. `$projector` carries the scope through without another implementation prompt or skill invocation. Review the accepted records, actual code, application checks, context findings, and remaining unknowns. Internal lifecycle capture/apply commands are described in the [CLI reference](reference/cli.md) for terminal users and integrations; they are not additional skill invocations for the normal task.

If implementation reveals a new intent decision, revise the proposed meaning before depending on it. If the implementation is different but satisfies the same model, retain the model and explain the realization.

## Repair code under existing meaning

Use `$projector` to retrieve the governing model, inspect the failing path, and repair the implementation. For example, if a saved placement loses its transpose on reload, the existing requirement already says to preserve it. A code fix and discriminating reload check can satisfy that obligation without changing the requirement. Check retained context after the edit and report changed assumptions or new consumers.

## Verify an actual implementation

Use `$projector-verify` to compare code with the applicable concept, requirement, and scenario. Follow producers, persistence, consumers, and registrations. Try a counterexample that could distinguish a bad implementation: two placements of the same clip with different transpose values, then save and reload. Report demonstrated violations, passing observed cases, and unavailable evidence separately. Verification does not turn an untested case into a pass.

## Reconcile outside changes

Use `$projector-reconcile` after a pull, external commit, direct edit, or new consumer outside the retained task. Supply the actual diff, commits, or context ID. Inspect which assumptions and source-query members changed. A changed source hash can be harmless, a changed assumption, a violation, or an evidence gap. Revise accepted meaning only if intended meaning changes.

## Assimilate substantial sources

Use `$projector-assimilate` for large or branching chats, documents, research, or repository histories. Its `.assimilate/` working synthesis has separate identity and authority. Ground a mature change brief in current `$projector` context before proposing accepted meaning.

## When Projector is unavailable

Read canonical records under `.projector/` directly and state that automated retrieval or currentness assurance was unavailable. Continue only as supported by the task's authorization and the evidence in hand.

Continue with [Skills](skills.md), [Examples](examples.md), or [Review, reconcile, and recover](review-reconcile-recover.md).
