---
name: projector-change
description: Use when an ordinary repository change must pass through Projector's installed, approval-bound lifecycle, including recovery after an interrupted attempt.
---

# Projector change

Projector owns change semantics. Use this skill to inspect the repository, express the requested result as evidence, and drive Projector's public lifecycle. Do not implement the change with shell edits or invent a parallel approval protocol.

## Required workflow

1. Inspect the target repository read-only. Read its agent instructions, source, tests, and authoritative specifications before interpreting the request.
2. Read [proposal-schema.md](proposal-schema.md) completely. Write one strict proposal JSON file from repository evidence and the user's request. The proposal is interpretation evidence, not authority.
3. Ask the user only about an unresolved material ambiguity: conflicting requirement identity, a blocking architecture choice with no current canonical decision, or an irreversible boundary that repository evidence cannot settle. Do not ask about choices that existing authority or a bounded deferral already resolves.
4. From the repository root, resolve `../../scripts/projector-change.mjs` relative to this `SKILL.md`, then start the lifecycle:

   ```sh
   node <projector-change.mjs> start --request <request> --proposal <proposal.json>
   ```

5. Show the returned preview, `changeSelector`, and exact `planHash` to the user. **Stop.** Never approve on the user's behalf and never treat general permission as approval of this particular hash.
6. Only after the user supplies that exact hash, use the returned continuation:

   ```sh
   node <projector-change.mjs> approve --continuation <continuation> --plan-hash <exact-plan-hash>
   node <projector-change.mjs> apply --approval <approvalSelector>
   ```

7. If apply is interrupted or reports recovery-required, preserve the lifecycle records. Do not hand-edit the target or retry raw apply. Recover and resume the same approval:

   ```sh
   node <projector-change.mjs> recover --approval <approvalSelector>
   node <projector-change.mjs> resume --approval <approvalSelector>
   ```

8. Accept success only when Projector returns the authenticated result, observation, certificate, receipt, and closed journal for the approved plan. Report unavailable, stale, ambiguous, or planning-surprise states as failures that require new evidence or a new plan.

## Fail-closed rules

- Run from the repository root. The wrapper invokes only the installed `projector` executable, or the exact executable configured in `PROJECTOR_CLI`.
- Preserve the proposal, authenticated continuation, approval selector, and `.projector/runtime/change-lifecycles/agent-trace.jsonl`.
- The continuation is content-authenticated. A changed proposal or plan requires a new `start` and another exact-hash approval.
- Independent validators must already exist at the Git base and must not be edited by the proposal. Supplemental validators may be proposed, but they do not prove independence.
- A blocking-now architecture concern requires a current canonical decision. A proposal may record only a bounded `material-soon` or `deferable` concern; it cannot make an architecture decision.
- If the CLI, validator sandbox, capability proof, authenticated observation, or recovery evidence is unavailable, stop. Unavailability is not evidence of safety.
