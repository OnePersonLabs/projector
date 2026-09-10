# P2 -- Resume checked work through the existing lifecycle

Proposed, simplified after viability review. Implementation owner: wrap-up Task 7A plus shared representation Task 8.4. Typed contribution import/join, new approval hash profiles and a new contribution requirement are removed from this release.

## What and why

Let host agents prepare bounded work independently, then have one coordinator reconcile the relevant contexts and produce one exact reviewed proposal through the existing lifecycle. A fresh session should find usable context, exact planned instructions, transaction recovery state and remaining obligations without trusting a progress narrative.

The current compiler already binds the final proposal into intent and immutable approval. No inspected failure demonstrates that this needs a separate contribution envelope protocol. Notes and worker reports remain advisory. They cannot authorize mutation, prove tests ran, or override required validation.

## Stories

- Backend and UI workers choose incompatible payloads. The coordinator resolves the shared contract and tests the combined result before exact capture; disjoint paths do not prove semantic compatibility.
- A fresh worker reuses an investigation after unrelated documentation changes, but refreshes it when an empty dependency query gains a member.
- A required investigation is unfinished. The coordinator reports the gap instead of pretending every task is complete or approving unknown future edits.
- Mutation committed but publication failed. The next session authenticates and publishes the historical result once using existing recovery; it does not replay the mutation because a note says unfinished.

## Design

Use existing saved contexts, value/query bindings, representation artifacts, proposals, plans/capsules, approvals, attempts and journals. Derive a bounded continuation view with omissions and exact drill-down routes. Before capture, candidate files and notes are owned by the host. At capture, the coordinator submits final concrete edits and existing required evidence through the supported contract. The combined diff is freshly observed and verified; worker claims remain claims.

Ordinary conceptual reading requires no mutation approval. Plan-bound instruction inspection must work before approval for review, while actual execution needs current dependencies, exact artifact delivery and the proper authority. Preserve integrity/currentness/fidelity/authorization/delivery as separate facts. Wrap-up Task 8.4 owns these shared semantics; do not build a competing handoff renderer.

Repair the legacy dispatch path only if a supported consumer needs it. Otherwise retire it, including its optimistic capability and HEAD-only completion claims, after preserving active-host behavior. New shared-runner operations use real repository observation and existing services, not a port of weak dispatch shortcuts.

The earlier complete-envelope hashing design remains a conditional engineering constraint: if future evidence attachments themselves become approval-bearing inputs, their complete content must participate in the approved identity without breaking historical recovery. That is not a current requirement to implement the attachment system. Reopen only on an observed unsupported workflow and compare its cost with this simpler route.

## How and completion evidence

| Task | Concrete implementation | Completion evidence |
|---|---|---|
| P2.1 | Map current saved-context/inspection/recovery outputs to the fresh-session story and existing accepted meaning. | Identify concrete missing fields or composition, rather than creating a synonymous requirement or store. |
| P2.2 | Add only missing bounded continuation composition in control-plane knowledge/lifecycle inspection and the shared runner. | Actual current/stale/unknown results, incomplete work and supported next actions survive process reset; missing local artifacts remain unavailable. |
| P2.3 | Integrate concise skill instructions for host-native preparation, ownership, conflict resolution and final concrete capture. Reuse Task 8.4 representation delivery. | Two host-produced candidates reach one exact reviewed plan after shared-contract resolution; no automatic semantic merge or speculative approval. |
| P2.4 | Complete wrap-up Task 4.6's repair-or-retire decision for actual dispatch consumers and remove redundant routes. | Dirty inputs under unchanged HEAD and absent capabilities are handled honestly through the retained installed path. |
| P2.5 | Exercise changed empty-query membership, relevant/irrelevant edits, missing notes, unresolved work and committed-but-unpublished recovery through the installed runner in fresh sessions. | Appropriate reuse or refresh, exact approval and idempotent recovery; no duplicate mutable progress authority. |

## Spec delta after implementation

After these tasks and the required Task 8.4 integration are verified, wrap-up Task 7A.6 applies the refreshed [P2.patch](../spec-deltas/P2.patch). Five owning modules cover capsules, plans, transactions, host behavior and optional orchestration. The patch specifies current continuation and final-proposal semantics; it does not add the discarded envelope/importer/attachment requirement.

Refresh against earlier interface/representation changes, review canonical/spec/code agreement, and complete the spec update in the same verified change batch. See the [manifest](../spec-deltas/change-manifest.json) for exact paths.
