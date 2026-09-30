# Changing accepted meaning

Use `$projector` when the intended behavior, concept boundary, requirement, scenario, architecture, or rationale changes. A code repair can leave accepted meaning intact.

## Contents

- [Plan in conversation](#plan-in-conversation)
- [Revise the proposal](#revise-the-proposal)
- [Authorize execution](#authorize-execution)
- [Keep identity and future commitments](#keep-identity-and-future-commitments)
- [Handle an interrupted operation](#handle-an-interrupted-operation)

## Plan in conversation

In native Codex Plan mode, `$projector` retrieves relevant accepted meaning, checks existing identities, and presents proposed changes as readable contents. For each changed artifact, inspect its stable ID, proposed path, changed text, relationship to other records, reason, and expected effect on implementation and checks. For a new boundary, the plan should explain what the new record owns and excludes. For an existing boundary, it should explain why the same identity still owns the change.

Plan mode remains a conversation. It does not write canonical artifacts, capture or accept a model transaction, or implement code. A question about a candidate is not authorization. The [clip use example](examples/clip-use.md) shows what the user sees before execution and links complete schema-valid proposals.

## Revise the proposal

Correct the proposed contents before authorizing execution. The plan should preserve requirements and scenarios that still apply while explaining substantive changes. If the task introduces an unrealized future capability, the model can retain the commitment and its reasons even though code does not yet satisfy it. If implementation details later change without changing intent, the same model can govern a different code realization.

## Authorize execution

When the plan describes the desired result, leave native Codex Plan mode and direct Codex to implement it. `$projector` handles model acceptance through the controlled lifecycle, then implements and verifies the scope. The internal lifecycle checks the exact proposal and current dependencies; an old review does not silently authorize changed contents. The terminal `accept` capture/apply operations remain available for integrations and inspection in the [CLI reference](reference/cli.md), but are not a second user-facing workflow step.

Implementation and verification have distinct evidence. Accepted records state intended meaning. Relevant application checks exercise actual behavior. `$projector-verify` inspects actual code against the concepts, requirements, and scenarios, tries counterexamples, and reports unavailable evidence. Neither acceptance nor a hash is proof that the software works.

## Keep identity and future commitments

Reuse a record ID when it still owns the meaning. A filename can change without changing identity. A distinct new boundary needs a new identity and relationship to the current model. Do not erase an accepted future obligation because its code has not been written or because a first implementation took another form.

In the worked example, `requirement:independent-transposition-per-use` first governs independent values and reload. A later user decision adds integer limits and rejection of invalid values. The revision retains that ID and the earlier save/reload obligation.

## Handle an interrupted operation

If a controlled write stops, inspect its actual approval ID and retained lifecycle state before retrying. `projector resume <approval ID>` inspects state. `projector recover <approval ID>` explicitly repairs a recognized interrupted transaction under the applicable authorization; it does not reapply the proposal. Preserve ambiguous evidence for investigation.

Continue with [Workflows](workflows.md), [Review, reconcile, and recover](review-reconcile-recover.md), or the [CLI reference](reference/cli.md).
