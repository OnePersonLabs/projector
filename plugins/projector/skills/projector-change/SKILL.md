---
name: projector-change
description: Establish or revise Projector's canonical conceptual model, carry accepted meaning into implementation, and reconcile it across subsequent changes.
disable-model-invocation: false
---

# Projector change

Projector retains accepted meaning, typed relationships, and architectural obligations independently of implementation. Use the same public change lifecycle to establish the model before code exists, revise it explicitly, and plan implementation. Retrieval candidates are interpretation evidence; they do not prove semantic equivalence.

Resolve `node` through the host `PATH`; Projector requires Node 24 on native Windows and direct WSL. The installed plugin bundles Projector JavaScript, not a private Node runtime.

## Required workflow

1. Read the target repository's agent instructions and the [bundled operation contract](../projector/operation-contract.md). Before choosing edit paths, resolve `../../scripts/projector-operation.mjs` relative to this skill. Write a `projector.operation/v1` request with operation `context`, the absolute repository root, and input `{ "request": "<requested-outcome>", "persist": true }`, then run:

   ```sh
   node <projector-operation.mjs> <context-request.json>
   ```

   Inspect `candidateMeanings`, typed relevance reasons, applicable lens obligations, and unknown frontiers. Read the source and tests needed to resolve them. Select an existing meaning before using `--entity <id-or-key>` for focused detail. Preserve the returned context `id` and `contentHash`; a free-text candidate is not an accepted identity. An empty result means knowledge is missing, not that no constraints exist. `unknownGroups` aggregates repeated frontier diagnostics with exact counts; grouped or deferred entries are not absent constraints.

   The wrapper returns a bounded view. Inspect `itemsDisclosure`, sampled `deferredItems`, `requiredDisclosureExpansion`, `requiredExpansionDisclosure`, obligation counts, and unknown counts. Included records retain their whole content. Expand required direct or governing records before relying on focused context; `requiredDisclosureExpansionIds` and semantic `requiredExpansionIds` are samples, so use full detail when their omitted counts are nonzero. Inspect other deferred records when relevant. Grouped lens results include the full predicate with unit counts and a sample of unit IDs. A sample is not the entire applicability set, and zero sampled findings or identities does not mean zero total.

   For focused detail, send another `context` request with the selected stable IDs in `entities` and suitable bounded policy values. This regenerates current evidence; it does not read an old saved proof. Reconcile the saved ID before relying on prior reasoning. If a returned expansion requires a request that the registered operation schema cannot express, keep that limitation visible for the representation drill-down work instead of invoking an unregistered private command.
2. Read [proposal-schema.md](proposal-schema.md). Write one strict proposal JSON file using the retrieved meaning and the user's intended design. Preserve existing requirement/scenario keys and exact meaning where they own the behavior. When the user intends a design revision, provide its current identity, semantic hash, and rationale in `revision`. Use `canonicalMutations` for typed concept, relation, concern, project preference, decision, lens, and authority changes, and full requirement/scenario records when revising scope, provenance or status. Inspect `preview.intentReview` for exact before/after meaning, related obligations, and unresolved targets, including capabilities without current code.

   To select a retrieved candidate or establish distinct new meaning, include `identityResolution` with the saved candidate `contextId`, `contextHash`, reviewed outcome, selected IDs, and rationale. New ownership needs `newBoundary` explaining what it owns, excludes, and the inspected nearest meanings. Use the lineage mutation for split, merge, replacement, relocation, or deletion; it atomically preserves history and tombstones. Do not imitate retirement by deleting JSON files. Capture can retrieve exact unchanged existing meaning automatically, but omitting context cannot bypass an unresolved interpretation. Empty-model bootstrap is supported without inventing an existing identity.

   A model-only proposal has no implementation edits or executable test commands. It establishes or revises accepted meaning and architecture, with canonical integrity validation. It does not establish runtime behavior. Do not invent code edits or dummy tests to establish a future obligation. Historical code and prose supply provenance or counterevidence; accepting a concept must not silently accept its old implementation.

   Architecture choices come from the host agent's investigation of the current options and the user's constraints. Use fresh primary evidence for volatile technology choices; do not invent research provenance. Keep alternatives and uncertainties in the authority record. A concern can be resolved by a corresponding accepted decision or explicitly deferred with preserved options, forbidden commitments, and reconsideration conditions. Include a decision's required constraint/lens/migration products in the same reviewed transaction: declaring a consequence is insufficient. Adopt shared preferences explicitly with project scope; changing a soft preference does not retroactively revise earlier decisions.
3. Ask the user only about an unresolved material ambiguity: conflicting requirement identity, a blocking architecture choice with no current canonical decision, or an irreversible boundary that repository evidence cannot settle. Do not ask about choices that existing authority or a bounded deferral already resolves.
4. Send `change.capture` with the request, parsed proposal object, and retained context ID. If capture succeeds, send `change.plan` with its `changeSelector`:

   ```sh
   node <projector-operation.mjs> <capture-request.json>
   node <projector-operation.mjs> <plan-request.json>
   ```

5. Inspect the returned preview, `changeSelector`, and exact `immutablePlanHash`. Use `representation.inspect` with that selector when the plan has a bound representation; request `summary` first and `content` only when the exact rendered instructions are needed. Check artifact integrity, live dependency freshness, semantic fidelity, and plan/capsule association separately. Inspection creates no execution authority. Check every meaning revision, authority change, affected obligation, and unknown against the user's authorization. Within the user's authorization for local changes, the agent may approve that inspected plan. Ask only when a material decision or action exceeds that authorization. Approval always names the exact reviewed hash; it does not authorize a changed plan or broader scope.
6. After that review and authorization, send `change.approve` with the change selector and exact plan hash, then send `change.apply` with the returned approval selector:

   ```sh
   node <projector-operation.mjs> <approval-request.json>
   node <projector-operation.mjs> <apply-request.json>
   ```

7. If apply is interrupted or reports recovery-required, preserve the lifecycle records. Do not hand-edit the target or retry raw apply. Recover and resume the same approval:

   Send `change.recover` with the same approval selector. After a successful recovery result, send `change.resume` with that selector. A new process or session must re-read the durable readiness and lifecycle result; delivery of an earlier result does not prove it was consumed.

8. Check the authenticated result, receipt, and closed journal for the approved plan. Report exactly the assurance returned: a canonical model commit is not a certificate of behavioral conformance. Unsupported execution, stale dependencies, ambiguity, and planning surprises require new evidence or a revised plan.

9. Codex may realize the accepted model through ordinary host-owned edits within the user's authorization. Run the relevant behavioral checks and send a `reconcile` operation with the retained context ID afterward, and before reusing context in a later session. Keep stale reasoning separate from a violated architectural predicate. A different implementation can conform. Refresh affected context when dependencies change; unknown validators or observation gaps cannot establish conformance. Reconciliation never promotes newly inferred relations automatically, and host-owned edits do not acquire Projector's controlled-execution guarantees.

   Inspect `decisionValidity` as well as predicate findings. Observable reconsideration conditions are rechecked against authenticated transaction baselines or tracked history. A fresh context does not reset a fired condition. Manual review conditions require an explicit event; unsupported assumptions remain visibly unobserved. An accepted semantic revision can reauthorize the affected decision. See [executable-lenses.md](executable-lenses.md) for custom validators and platform behavior.

## Fail-closed rules

- Put the absolute repository root in every request. The operation entry loads only its packaged Projector runtime and does not keep a hidden workspace binding. If the user has requested initialization, send an `init` operation for that repository.
- The entry is stateless. It creates no parallel trace or continuation; the registered services own durable context, lifecycle authority, receipts, and recovery.
- Preserve the proposal and returned lifecycle selectors outside the wrapper. A changed proposal or plan requires a new `start` and another exact-hash approval.
- Code-bearing controlled changes require independent validators at the Git base that the proposal does not edit. Supplemental validators may be proposed, but they do not prove independence. Model-only changes validate canonical integrity without executing repository code.
- A passing validator establishes only the behavior it exercises. The post-change knowledge validator checks applicable executable lens predicates before commit; it does not prove every scenario outcome or the fidelity of the whole design.
- A blocking-now architecture concern requires a current eligible canonical decision. Establish or revise that decision and its authority through a model transaction before relying on it for implementation. A bounded deferral is not an accepted architectural choice.
- Stop an operation when its required runner, host permission, authenticated validator source, observation, or recovery evidence is unavailable. Host validator execution is bounded and source-checked, but it does not establish filesystem confinement, network denial, or hostile same-user protection. A failed or interrupted validator cannot establish conformance. Model-only transactions remain available without executing repository code. Unavailability is not evidence of safety.
