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

Focused modernization/surface/upgrade tests (8) and the three affected package typechecks pass. Architecture-option evaluation parity, explicit offline-user uncertainty, snapshot reorder/duplicate/pagination/open-result behavior, and ordinary sequential idempotency/compensation also hold. Seven material supported-path blockers remain:

1. **Friction origin and independence are caller assertions.** `createFrictionObservation` accepts `endogenous`, and aggregation treats distinct caller-supplied source revisions as independent. A direct module repro submitted two `projector:run` observations for the same repair, marked both `endogenous: false`, with distinct authenticated revisions; aggregation returned `independentOccurrences: 2` and `repeated: true`. This violates the required endogenous/copy defense and lets Projector manufacture the recurrence evidence that authorizes modernization pressure.
2. **Option completeness and recommendation evidence are self-authenticated.** The caller constructs both the closed `StateQueryDependency` (including an empty result) and the option set whose hash it covers; no query authority executes or current-validates that dependency. Problem evidence/counterevidence identifiers and the base binding are likewise never resolved through an authenticated current store, and approval authentication does not repair those inputs. A caller can omit viable options or inject stale/fabricated evidence and still obtain a recommendation/approved upgrade premise, contrary to current complete option enumeration and evidence-authentication requirements.
3. **Migration completeness is encoded as labels, not proven closure.** Compilation checks that four phase kinds and nonempty validator IDs exist, but it carries no authenticated exhaustive consumer query, no residue-zero query result, and no required bridge/cutover/cleanup dependency proof. Arbitrary target-state/validator strings therefore compile through Task 16 as “all consumers” and “residue zero” while a real consumer or legacy artifact remains, risking a breaking cutover or destructive cleanup. There is also no Task 18 public composition that executes this output through Task 16's stale-approval/rebase/crash recovery path.
4. **Surface effect authority, risk, and scope can be escalated after capsule approval.** A direct `executeSurfacePlan` repro used an authenticated `R1` capsule whose only operation was `read`, then supplied an `R4` surface plan targeting `surface:NOT-IN-SNAPSHOT` with operation `delete-production`, caller text `requiredApprovals: ["caller-says-approved"]`, and `manualContinuation: true`. The pinned snapshot contained only `surface:allowed`; execution nevertheless called the adapter and returned `success`. The executor neither binds surface risk/operations/target to the capsule nor verifies the target is in the pinned snapshot, so caller-shaped strings can authorize an out-of-scope irreversible external effect.
5. **Reservation does not provide exclusive in-flight ownership.** A second executor seeing a journal row in `reserved` state classifies it as crash ambiguity and may validate or compensate while the first adapter call is still in flight; there is no lease/owner distinction. On the supported concurrent path this can race compensation against the original remote effect, violating atomic external-operation reservation and risking remote corruption or a false terminal result. The only supplied journal is in-memory and no public durable/certificate composition closes that boundary.
6. **A captured snapshot is not a re-openable pinned revision.** `captureSurfaceSnapshot` accepts an invalid timestamp (a direct repro with `"not-a-timestamp"` returned a revision carrying it), and the implementation exposes no content-addressed snapshot store/read/rebuild path beyond the returned object. That permits invalid freshness metadata and leaves the required persisted, rebuildable snapshot revision unavailable even though semantic digest stability and pagination checks themselves pass.
7. **The required public upgrade workflow is absent.** Neither new module is exported from its package root, and `upgrade.ts` is an injected helper not wired into the built CLI dispatcher. A direct built-path call to `executeProjector(["upgrade"])` fails with `unknown command: upgrade`; there is no default provider/store/selector/apply composition. This is a required workflow failure, not serial metadata cleanup: the delivered behavior cannot be invoked through a supported package or CLI surface.

## Consolidated repair closure

One batch closes all seven findings: trusted source-origin groups; authenticated current query/evidence stores; consumer/residue closure bound into Task 16; public packet execution; capsule-bound target/risk/effect approval; durable owner leases with heartbeat and ambiguity recovery; persisted timestamp-valid snapshot rebuilds; serial exports and built default `upgrade` dispatch. Fake surfaces only.

Focused repair GREEN: 25 public-path tests plus affected package typechecks. Final frozen gate: `pnpm verify && pnpm build && pnpm check:boundaries && git diff --check`.
