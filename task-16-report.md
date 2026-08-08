# Task 16 — Semantic change planning and execution

## Outcome

Implemented the bounded semantic-change path across compiler, planning, runtime coordination, and CLI. Deterministic supported local repair now composes through `change:mandatory-slice` and `plan:mandatory-slice`; non-deterministic packet modes require an authenticated continuation.

## Delivered matrix

| Slice | Material invariant | Public regression |
| --- | --- | --- |
| Change compiler | Authenticated facts/state/authority, stable semantic identity, operation conflict and relation integrity, impact-before-risk, no caller risk downgrade | `packages/engine/src/change/compiler.test.ts` |
| Packet planning | Authenticated proposal sets, immutable state-bound packets/capsules, deterministic contract-before-consumer ordering, overlap and SCC rejection | `packages/engine/src/planning/change-plan.test.ts` |
| Runtime execution | Approval/hash/currentness authentication, lease checks through commit, observed diff authority, post-state validators, artifact-before-commit, continuation fail-closed | `packages/runtime/src/execution/packet-coordinator.test.ts` |
| CLI composition | Safe explicit identities, effect-free selected apply dry-run, built deterministic change-to-plan path, legacy command compatibility | `packages/cli/src/change-cli.test.ts` |

## Verification

- Focused affected suite: 97 tests passed; engine, runtime, and CLI typechecks passed.
- Frozen repository gate: `pnpm verify` passed (60 files, 599 tests), `pnpm build` passed, package-boundary check passed, and diff check passed.
- Built CLI smoke passed against a temporary Git fixture, including change/plan selectors and identical plan/capsule StateBinding.
- Existing vertical-slice tests cover clean/incremental convergence, partial certificates, journal tamper detection, recovery refusal, and post-approval drift.

## Scope notes

- Reused normative core schemas plus existing planning, mandatory local-change, analyzer, policy, and transaction machinery.
- Added only owned submodule exports; shared root barrels and integration metadata were not changed.
- Task 17 host adapters remain excluded.

## Independent review — FAIL (`bce3875..da927d9`)

Focused suites pass (engine 359, runtime 117, CLI 36), all three typechecks and diff check pass. Eight material public-path gaps remain:

1. **Request/state identity is not bound.** `compileSemanticChange` accepted caller request B while authenticated facts described request A, and emitted A. The same semantic-change ID was also emitted for two different valid dependency digests/current states, although the required identity binds current `StateBinding`; stale requests/approvals can alias.
2. **Architecture and negative-space sequencing is incomplete.** An authenticated `decision` modification ran impact with zero architecture-preflight calls. Impact declared `query:consumers` while the returned binding had no query dependencies and still compiled, so a new consumer cannot stale the change/plan.
3. **Plan scope and convergent SCCs are not executable contracts.** A change bounded to `packages/api` compiled a capsule granting `packages/other/**`. A declared bounded two-packet SCC compiled, then the public coordinator rejected its emitted order as unsafe; no bounded fixed-point execution exists.
4. **Observed diff cannot authenticate modifications.** Before/after observations expose path sets only. Returning the same out-of-scope path in both phases while changing state/unit/external facts produced `changedPaths:[]` and success. Plan boundary and `forbiddenWrites`, observed unit/external/generated changes, renames, and content hashes are not enforced.
5. **Approval, validation independence, and completion are caller-shaped.** Any `authorityProofHash` is accepted without an authority port. A validator DTO with `independent:true` satisfied independence, and execution completed despite an unmet required unit, exact assurance/evidence lane, unknown limit, required certificate/receipt, and clean-tree contract.
6. **Crash artifacts and semantic outcomes are false/incomplete.** The coordinator durably stored an after-state execution artifact, then commit failed and rollback ran; the success-shaped artifact remained and no failure certificate was emitted. Successful results contain only packet rows—no certificate/receipt, reconciliation, observed-impact closure, or Planning Surprise—and a later packet failure has no truthful partial-plan result.
7. **CLI risk can be downgraded by composition.** An injected apply port executed and returned success/R4 under normalized maximum R1; the CLI invoked it and exited 0 because provider/plan risk is never authorized against policy.
8. **Built selectors are not immutable selections and bypass the new pipeline.** Built plan/apply use fixed `plan:mandatory-slice` and recompute the old mandatory slice. After relevant drift, apply reused the same plan ID, compiled a different before-state, and succeeded. Thus the selector does not identify the approved plan, and built change/plan/apply do not compose the new semantic compiler, packet planner, or coordinator.

Direct bases: authenticated request/state-bound identity; architecture-before-impact and query negative space; bounded SCC/scope grants; actual-diff authority; independent completion evidence; crash-truthful certificates/receipts/reverse impact; normalized risk and explicit immutable CLI selectors. Task 17 host quality remains residual.

## Consolidated repair (`da927d9..HEAD`)

- Bound exact authenticated request, current state and final StateBinding digest into compilation identity; impact query IDs must exist in that binding, and architecture-relevant operation kinds now preflight before impact.
- Restricted normalized packet grants to the semantic boundary/forbidden set and carried authenticated bounded-convergence metadata into coordinator fixed-point execution.
- Replaced path-set observations with authenticated content hashes plus rename/delete, unit, canonical, external and generated state. Plan/capsule scope and the full completion contract are evaluated from observed post-state.
- Added current approval authority, validator provenance-derived independence, intent-before-commit and failure-after-rollback artifacts, partial/recovery outcomes, observed impact, surprises, reconciliation, certificate and receipt identities.
- Authorized immutable selected-plan risk before provider effects. Built compatibility selections are content addressed on disk, bind plan/capsule/approval/risk, and require explicit rebase after relevant drift instead of recomputing under a fixed selector.

Focused repair verification: 99 affected tests passed across engine change/planning, runtime execution and CLI; engine/runtime/CLI typechecks and diff check passed. The full repository gate is intentionally deferred to closure.
