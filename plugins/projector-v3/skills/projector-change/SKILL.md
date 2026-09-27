---
name: projector-change
description: Accept new or revised canonical Projector meaning with a readable preview and exact-state apply.
disable-model-invocation: false
---

# Accept meaning

Use `$projector` to retrieve the relevant obligations, rationale and current source evidence. Reuse an existing identity when it owns the intended meaning. Similar wording is a candidate, not proof of identity. A new identity needs an explicit boundary and inspected nearest meanings; a split, merge or retirement needs preserved lineage.

Write a proposal using [proposal-schema.md](proposal-schema.md). Core validates the JSON; [change-proposal.schema.json](change-proposal.schema.json) supplies the exact executable shape. A model-only proposal has no code edits or executable tests. Accepting meaning establishes an obligation, not proof that it works.

Use `node <plugin>/scripts/projector.mjs` as `projector` below:

1. Run `projector accept proposal.json --context <context ID> --request "reason"`. The result previews the changed meaning, scope, affected obligations and unresolved questions. Review it against the user's authorization. Inspect the exact record or change if detail is missing.
2. When the preview is correct and the action is already authorized, run `projector accept --apply <change ID> --hash <reviewed hash>`. The service checks live dependencies, authenticates the exact plan, acquires operation access and journals writes. Read the outcome and reasons; transport success alone does not establish a successful change.
3. Realize accepted meaning with ordinary Codex edits. Run relevant checks and `projector check <context ID>`. Retain a useful new scenario, relation, selector or rationale when the work discovers one. Revise the model again if implementation changes intended behavior.

Carry existing authorization forward. Ask only when a material unresolved choice or irreversible action exceeds it. An approval names one exact plan; a changed proposal or stale dependency needs a fresh preview and approval. Never transfer an old approval to a replacement plan.

For an interrupted write, run `projector resume <approval ID>` to inspect the journal, then explicit `projector recover <approval ID>` when authorized. Recovery restores a consistent state. It does not reapply changes. Preserve ambiguous ownership and unavailable evidence; do not hand-edit journals or guess an approval.

Conditional architectural rationale must retain the assumptions, alternatives, consequence and reconsideration condition that affect a later choice. Establish a blocking architectural decision and its constraint/lens products together. A bounded deferral states what remains forbidden and when to reconsider; it does not accept the deferred choice.

Ordinary host edits do not need controlled execution. For a change that specifically requires Projector-controlled code execution, read [executable-lenses.md](executable-lenses.md) and the [operation contract](../../references/operation-contract.md): authenticated validators, exact patch scope and recovery remain mandatory. Tests establish their observed behavior, not completeness of the whole design.
