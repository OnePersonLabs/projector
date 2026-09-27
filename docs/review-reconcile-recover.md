# Review, reconcile, and recover

These workflows answer three different questions: does a candidate satisfy accepted meaning, what changed outside retained work, and how should an interrupted controlled write be inspected or repaired?

## Audit observed coverage

Run `projector audit` to inspect the observed evidence and open questions for the repository, or `projector audit --scope src/feature` for a bounded path. The audit is read-only for source and canonical records; operational observation artifacts may be created. Review the evidence status, unavailable and unsupported surfaces, question details, and each available repair route. Use `--question-offset N` with the returned next offset to read further questions. The report does not establish global completeness or behavioral correctness.

Use `inspect` for exact canonical records, `context` for focused accepted meaning, and the question's available route for a canonical proposal or implementation repair. Rerun audit after changes to observe current evidence. Audit does not execute a proposed repair or promise a future exception or transform lifecycle.

## Review an actual candidate diff

Use `$projector-review` with the candidate diff. Retrieve the relevant accepted meaning or resume its actual context ID, then inspect the current code behind changed responsibilities. Trace inputs, producers, persistence, consumers, registration, and behavior checks. Re-run source queries where needed so new consumers appear.

Try counterexamples using real identities, order, retries, interruption, and stale-state behavior where relevant. Report findings in consequence order. Each finding should name the obligation, location, trigger, observable result, and smallest useful repair. Distinguish demonstrated violations, changed assumptions, missing producers, and unavailable evidence.

A passing self-authored test or reviewer confidence is not universal proof. Recommend completion only for the behavior examined.

## Reconcile outside changes

Use `$projector-reconcile` after a pull, external commit, direct edit, or changed assumption. Choose an actual diff, named commits, or retained context as the comparison basis. With no anchor, inspect the current diff and retrieve fresh context; do not invent earlier intent.

Check current producers and consumers, persistence, query membership, and relevant behavior tests. A changed hash may indicate a harmless edit, a changed assumption, a new consumer, a violation, or unavailable evidence. Explain which interpretation the observed evidence supports. Revise canonical meaning only when the user intends that revision.

For an existing repository finding, acknowledge it through the machine `repository.check` operation only after delivering the investigation or explicitly dismissing it. Acknowledgement does not certify conformance.

## Resume after a context reset

Run `projector resume <actual context/change/approval ID>`. Resume authenticates the retained anchor and reports currentness. It is inspection only: it does not apply a change, reclaim ambiguous ownership, or renew approval. A stale anchor leads back to evidence, not authority. With no known anchor, retrieve new context rather than guessing “latest.”

## Recover an interrupted controlled write

Inspect the actual approval with `projector resume <approval ID>`. For a recognized interrupted transaction, run `projector recover <approval ID>` only when recovery is authorized. Read the result and preserve failed or ambiguous evidence. Recovery restores consistency; it does not retry or reapply the proposal.

If the intended change remains necessary, capture a fresh preview and review its exact meaning and dependencies. Never hand-edit journals or reuse an old approval for a changed plan.

Continue with [Examples](examples.md) or the [CLI reference](reference/cli.md).
