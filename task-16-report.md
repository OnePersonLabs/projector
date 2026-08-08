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
