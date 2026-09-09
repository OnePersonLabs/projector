---
name: projector-change
description: Retrieve existing meaning before choosing edits, carry its context into Projector's change lifecycle, and reconcile the result or a later change.
---

# Projector change

Projector retains accepted meaning, typed relationships, and architectural obligations. Use those before choosing an implementation, then drive the public change lifecycle. Its retrieval candidates are interpretation evidence; they do not prove semantic equivalence.

## Required workflow

1. Read the target repository's agent instructions. Before choosing edit paths, resolve `../../scripts/projector-change.mjs` relative to this skill and run:

   ```sh
   node <projector-change.mjs> context --request <requested-outcome>
   ```

   Inspect candidate meanings, typed relevance reasons, applicable lens obligations, and unknown frontiers. Read the source and tests needed to resolve them. Use `--entity <id-or-key>` when an existing meaning is explicitly selected. Preserve the returned context `id`; a free-text candidate is not an accepted identity. An empty result means knowledge is missing, not that no constraints exist. The wrapper returns compiled context without internal query transcripts. Use the CLI without `--compact` when those full proofs are needed.
2. Read [proposal-schema.md](proposal-schema.md). Write one strict proposal JSON file using the retrieved meaning, repository evidence, and the user's request. Preserve existing requirement/scenario keys and exact meaning where they own the behavior. When the user intends a design revision, provide its current identity, semantic hash, and rationale in `revision`. Inspect `preview.intentReview` for the exact before/after meaning, related obligations, and unresolved targets, including capabilities without current code. A bounded implementation task must still answer to those commitments. The proposal is interpretation evidence, not authority.
3. Ask the user only about an unresolved material ambiguity: conflicting requirement identity, a blocking architecture choice with no current canonical decision, or an irreversible boundary that repository evidence cannot settle. Do not ask about choices that existing authority or a bounded deferral already resolves.
4. From the repository root, resolve `../../scripts/projector-change.mjs` relative to this `SKILL.md`, then start the lifecycle:

   ```sh
   node <projector-change.mjs> start --request <request> --proposal <proposal.json> --context <context-id>
   ```

5. Show the returned preview, `changeSelector`, and exact `planHash` to the user. **Stop.** Never approve on the user's behalf and never treat general permission as approval of this particular hash.
6. Only after the user supplies that exact hash, use the returned change identity:

   ```sh
   node <projector-change.mjs> approve --change <changeSelector> --plan-hash <exact-plan-hash>
   node <projector-change.mjs> apply --approval <approvalSelector>
   ```

7. If apply is interrupted or reports recovery-required, preserve the lifecycle records. Do not hand-edit the target or retry raw apply. Recover and resume the same approval:

   ```sh
   node <projector-change.mjs> recover --approval <approvalSelector>
   node <projector-change.mjs> resume --approval <approvalSelector>
   ```

8. Accept success only when Projector returns the authenticated result, observation, certificate, receipt, and closed journal for the approved plan. Report unavailable, stale, ambiguous, or planning-surprise states as failures that require new evidence or a new plan.

9. After edits made outside Projector, or before reusing context in a later session, run `node <projector-change.mjs> reconcile --context <context-id>`. Keep stale reasoning separate from a violated architectural predicate. A different handwritten implementation can conform. Refresh affected context when dependencies changed; unknown validators or observation gaps cannot establish conformance. Reconciliation never promotes newly inferred relations automatically.

## Fail-closed rules

- Run from the repository root. The wrapper invokes only the installed `projector` executable, or the exact executable configured in `PROJECTOR_CLI`.
- The wrapper is stateless. It creates no trace or continuation and delegates all durable lifecycle authority to the installed CLI.
- Preserve the proposal and returned lifecycle selectors outside the wrapper. A changed proposal or plan requires a new `start` and another exact-hash approval.
- Independent validators must already exist at the Git base and must not be edited by the proposal. Supplemental validators may be proposed, but they do not prove independence.
- A passing validator establishes only the behavior it exercises. The post-change knowledge validator checks applicable executable lens predicates before commit; it does not prove every scenario outcome or the fidelity of the whole design.
- A blocking-now architecture concern requires a current canonical decision. A proposal may record only a bounded `material-soon` or `deferable` concern; it cannot make an architecture decision.
- If the CLI, validator sandbox, capability proof, authenticated observation, or recovery evidence is unavailable, stop. Unavailability is not evidence of safety.
