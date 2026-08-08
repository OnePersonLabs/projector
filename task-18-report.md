# Task 18 — Modernization and Surface Framework

Base: `1397cee`

## Delivered

- Authenticated, deterministic friction aggregation across all modernization triggers. Projector-generated evidence is retained for explanation but cannot increase independent recurrence.
- Concern-scoped current research with authenticated source revisions, local freshness, pinned offline reuse, explicit unavailability/uncertainty, and current user uncertainty exceptions delegated to the architecture evaluation authority boundary.
- Problem-first recommendations that bind the complete problem/migration contract and a closed current viable-option enumeration, including empty results. Ranking reuses Task 13 evaluation; preferences never authorize. Approval additionally requires authenticated current decision, authority, and Governance Basis.
- Reversible upgrade compilation through Task 16 with required bridge, all-consumer, incremental-cutover, validation, rollback checkpoints, residue-zero cleanup, and immutable plan/capsule output.
- Fake-only `SurfaceAdapter` framework with capability/observability non-inflation, strict pagination and identity checks, authenticated fingerprints, content-addressed timestamped adapter revisions, semantic digests stable under reorder, and explicit open/unavailable blind spots.
- Task 16-bound surface apply with exact snapshot pinning, stale-approval refusal, R3/R4 manual continuation, atomic durable-operation reservation contract, idempotent replay, crash ambiguity handling, validation, and compensation without duplicate apply.
- Narrow injected CLI upgrade composition that exposes only the exact deeply immutable Task 16 plan.

No live provider adapter or external call was added. Serial package/root exports are now wired; lockfile and Task 17 host/MCP paths remain untouched.

## Evidence

- RED: grouped modernization and surface tests initially failed at their missing public modules.
- Focused GREEN: engine 362 tests; integrations 3 tests before the final open/unavailable addition; CLI 37 tests. Final Task 18 focused set: 8 tests across modernization, surfaces, and upgrade CLI.
- Typecheck GREEN: `@projector/engine`, `@projector/integrations`, and `@projector/cli`.
- Frozen final gate: `pnpm verify`, `pnpm build`, `git diff --cached --check`.

## Residual integration work

- Merge serial exports with Task 17 metadata. No real adapter should be selected before Task 21.

## Independent comprehensive review — FAIL (`1397cee..0d53b523`)

Eight focused tests and affected typechecks passed, but seven supported-path blockers remained: caller-controlled friction origin; self-authenticated option/evidence completeness; label-only migration closure with no public Task 16 execution; post-approval surface scope/risk/effect escalation; nonexclusive in-memory reservation; invalid, non-reopenable snapshots; and no exported built `upgrade` workflow.

## Consolidated repair closure

One batch closes all seven findings: trusted source-origin groups; authenticated current query/evidence stores; consumer/residue closure bound into Task 16; public packet execution; capsule-bound target/risk/effect approval; durable owner leases with heartbeat and ambiguity recovery; persisted timestamp-valid snapshot rebuilds; serial exports and built default `upgrade` dispatch. Fake surfaces only.

Focused repair GREEN: 25 public-path tests plus affected package typechecks. Final frozen gate: `pnpm verify && pnpm build && pnpm check:boundaries && git diff --check`.

## Targeted repair review — FAIL (`0d53b523..489050d`)

Findings 1–4, 6, and 7 closed. Finding 5 remained: same-owner reserve replaced a live lease token, and a crash-left file lock permanently reported an expired operation as in-flight.

## Final finding 5 closure

All unexpired reservations, including repeated owner IDs, now remain in-flight without token replacement. An expired durable record behind an extant lock returns explicit `recovery-required`; it never enters validation or compensation, while owner-plus-token checks prevent stale executors from mutating a taken-over reservation. Exact same-owner, stale-lock, and stale-token regressions are covered.

## Final independent closure — PASS (`489050d..5de0c20`)

The two exact lease blockers close on exported public journals. A same-owner repeat during the live lease returns `in-flight`, preserves the original lease token, and that token still renews. An expired record behind a crash-left file lock returns `recovery-required` with the durable prior owner/expiry; a competing owner cannot mark it compensated, so no validation, replay, or compensation races the uncertain effect. Focused surface tests (5), integrations typecheck, exact-range diff check, and direct runtime repros pass. No material regression remains in finding 5; the frozen 613-test/build gate was relied upon.
