---
name: projector-change
description: Establish or revise Projector's canonical conceptual model, carry accepted meaning into implementation, and reconcile it across subsequent changes.
---

# Projector change

Projector retains accepted meaning, typed relationships, and architectural obligations independently of implementation. Use the same public change lifecycle to establish the model before code exists, revise it explicitly, and plan implementation. Retrieval candidates are interpretation evidence; they do not prove semantic equivalence.

## Required workflow

1. Read the target repository's agent instructions. Before choosing edit paths, resolve `../../scripts/projector-change.mjs` relative to this skill and run:

   ```sh
   node <projector-change.mjs> context --request <requested-outcome>
   ```

   Inspect candidate meanings, typed relevance reasons, applicable lens obligations, and unknown frontiers. Read the source and tests needed to resolve them. Use `--entity <id-or-key>` when an existing meaning is explicitly selected. Preserve the returned context `id`; a free-text candidate is not an accepted identity. An empty result means knowledge is missing, not that no constraints exist. The wrapper returns compiled context without internal query transcripts. Use the CLI without `--compact` when those full proofs are needed.
2. Read [proposal-schema.md](proposal-schema.md). Write one strict proposal JSON file using the retrieved meaning and the user's intended design. Preserve existing requirement/scenario keys and exact meaning where they own the behavior. When the user intends a design revision, provide its current identity, semantic hash, and rationale in `revision`. Use `canonicalMutations` for typed concept, relation, decision, lens, and authority changes. Inspect `preview.intentReview` for exact before/after meaning, related obligations, and unresolved targets, including capabilities without current code.

   A model-only proposal has no implementation edits or executable test commands. It establishes or revises accepted meaning and architecture, with canonical integrity validation. It does not establish runtime behavior. Do not invent code edits or dummy tests to establish a future obligation. Historical code and prose supply provenance or counterevidence; accepting a concept must not silently accept its old implementation.
3. Ask the user only about an unresolved material ambiguity: conflicting requirement identity, a blocking architecture choice with no current canonical decision, or an irreversible boundary that repository evidence cannot settle. Do not ask about choices that existing authority or a bounded deferral already resolves.
4. From the repository root, resolve `../../scripts/projector-change.mjs` relative to this `SKILL.md`, then start the lifecycle:

   ```sh
   node <projector-change.mjs> start --request <request> --proposal <proposal.json> --context <context-id>
   ```

5. Inspect the returned preview, `changeSelector`, and exact `immutablePlanHash`. Check every meaning revision, authority change, affected obligation, and unknown against the user's authorization. For model-only local changes within an explicit autonomous mandate, the agent may approve that inspected plan under the mandate. Otherwise obtain the required approval. Approval always names the exact reviewed hash; it does not authorize a changed plan or broader scope.
6. After that review and authorization, use the returned change identity and exact hash:

   ```sh
   node <projector-change.mjs> approve --change <changeSelector> --plan-hash <exact-plan-hash>
   node <projector-change.mjs> apply --approval <approvalSelector>
   ```

7. If apply is interrupted or reports recovery-required, preserve the lifecycle records. Do not hand-edit the target or retry raw apply. Recover and resume the same approval:

   ```sh
   node <projector-change.mjs> recover --approval <approvalSelector>
   node <projector-change.mjs> resume --approval <approvalSelector>
   ```

8. Check the authenticated result, receipt, and closed journal for the approved plan. Report exactly the assurance returned: a canonical model commit is not a certificate of behavioral conformance. Unsupported execution, stale dependencies, ambiguity, and planning surprises require new evidence or a revised plan.

9. Codex may realize the accepted model through ordinary host-owned edits within the user's authorization. Run the relevant behavioral checks and `node <projector-change.mjs> reconcile --context <context-id>` afterward, and before reusing context in a later session. Keep stale reasoning separate from a violated architectural predicate. A different implementation can conform. Refresh affected context when dependencies change; unknown validators or observation gaps cannot establish conformance. Reconciliation never promotes newly inferred relations automatically, and host-owned edits do not acquire Projector's controlled-execution guarantees.

## Fail-closed rules

- Run from the repository root. The wrapper uses the packaged Projector runtime, the installed `projector` executable, or the exact executable configured in `PROJECTOR_CLI`. If the user has requested initialization, `node <projector-change.mjs> init` activates the target repository.
- The wrapper is stateless. It creates no trace or continuation and delegates all durable lifecycle authority to the installed CLI.
- Preserve the proposal and returned lifecycle selectors outside the wrapper. A changed proposal or plan requires a new `start` and another exact-hash approval.
- Code-bearing controlled changes require independent validators at the Git base that the proposal does not edit. Supplemental validators may be proposed, but they do not prove independence. Model-only changes validate canonical integrity without executing repository code.
- A passing validator establishes only the behavior it exercises. The post-change knowledge validator checks applicable executable lens predicates before commit; it does not prove every scenario outcome or the fidelity of the whole design.
- A blocking-now architecture concern requires a current eligible canonical decision. Establish or revise that decision and its authority through a model transaction before relying on it for implementation. A bounded deferral is not an accepted architectural choice.
- If the CLI, validator sandbox, capability proof, authenticated observation, or recovery evidence is unavailable, stop. Unavailability is not evidence of safety.
