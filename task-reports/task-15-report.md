# Task 15 — Coverage and Completion

## Delivery

- Branch: `codex/projector-t15`
- Base: `86dbca3`
- Scope: authenticated coverage snapshots, ranked completion questions, resumable cleanup plans, coverage metrics, and CLI composition.

## Implemented behavior

Delivered authenticated coverage, completion questions, resumable cleanup, metrics, and CLI composition with public-path RED→GREEN tests.

## Frozen gate

- Initial delivery passed 582 tests, workspace typecheck/build/boundaries, schema/diff checks, and built facade smoke imports.

## Independent review — FAIL (`86dbca3..1bc32a7`)

Seven public-path gaps covered incomplete proof ratios, analyzer failure degradation, forged settlements, rebound/CAS authorization, stale cleanup approvals/checkpoints, pre-CAS effects, and unsafe/unwired CLI proof policy.

## Consolidated repair (`1bc32a7..`)

- Required lanes now prove closure only when their known numerator equals the denominator; real analyzer capability/claim failures map deterministically to dependent lanes and unmapped failures fail closed.
- Question suppression reads only authenticated store state. Settlement verifies listed binding evidence, persists rebound binding identity, revalidates inside atomic CAS, and requires an authenticated exceptional-outcome contract for exception/defer.
- Every cleanup revision clears prior approvals. Due checkpoint validators pass before execution, and a durable work reservation precedes side effects so CAS contention cannot execute unrecorded work.
- Cleanup is normalized as mutation. Observe/dry-run does not call effects; unknown/duplicate flags fail. CLI strictness, unavailability, and scope exits derive from proof/boundary data, and the built command has a repository-boundary default with explicit fail-closed cleanup fallback.

Repair RED covered all seven public-path findings. GREEN: focused 15/15, engine 352/352, CLI 32/32, affected typechecks, and diff check. Per closure sequencing, the repository-wide frozen gate is deferred.

## Targeted closure — FAIL (`1bc32a7..018fe6d`)

Engine 352/352, CLI 32/32, typechecks, and diff check pass. Numeric, Task 14 mapping, metric/currentness, settlement, approval/checkpoint, and reservation-conflict repairs hold. Four blockers remain:

1. Failure mapping ignores boundary: an out-of-scope `document-parse` failure degrades three `packages/api` lanes and weakens proof, contrary to required failure locality.
2. An unchecked `SettledAnswerStore.read` DTO with only matching question/hash/binding fields suppresses a blocking question without answer, authority, or evidence authentication.
3. Reservation is not exclusive: concurrent and reserved revision 2 plans both store, leaving divergent continuations after effects and ambiguous/repeatable recovery.
4. CLI success outruns proof: built `coverage --strictness partial` exits 0 with zero lanes from a synthetic adapter, not the required real 17-lane composition; `cleanup --dry-run` also exits 0 with partial proof under default bounded strictness because exit derivation is skipped.

## Targeted closure repair (`018fe6d..`)

- Analyzer failures are filtered against normalized requested boundaries before lane degradation; in-scope failures still fail proof.
- Stored answers are schema/hash checked, duplicate-conflict checked, rebound to listed evidence, and re-authenticated against the current authority record and `StateBinding` before suppressing a question.
- Store reservations now exclude competing revisions through commit, and commit verifies the lease still owns the latest plan transition.
- CLI strictness requires the exact 17-lane inventory. Zero-lane/default observation fails non-success, while cleanup dry-run remains effect-free and returns the proof-derived incomplete exit.

Closure RED covered all four public repros. GREEN: focused 18/18, engine 355/355, CLI 32/32, affected typechecks, and diff check. Full gate remains deferred as directed.

## Final narrow closure — FAIL (`018fe6d..0dedff0`)

Boundary locality, malformed/revoked settlement authentication, evidence reopening, reservation exclusivity, zero-lane rejection, dry-run exit derivation, unavailable metrics, and currentness pass; engine 355/355, CLI 32/32, and both typechecks pass. One blocker remains: built `projector coverage` still uses the filesystem-stat synthetic adapter, returns zero lanes and exit 5, and never composes the required real 17-lane engine/store path. The required built coverage workflow therefore remains unavailable.

## Built-path repair (`0dedff0..`)

Default coverage composes Task14 analysis through the authenticated Task15 compiler. It reports 17 real lanes, scoped counts/failures, explicit unavailable/N/A dimensions, and proof-derived exits; cleanup remains unavailable without trusted continuation state. Temp-repository determinism RED→GREEN passed with 49 focused tests, both typechecks, and diff check.

## Built default closure — FAIL (`0dedff0..33c0578`)

The executable now emits 17 deterministic scoped lanes, localizes failures, derives exit 5, has no synthetic marker, and leaves cleanup unavailable; CLI 33/33, typecheck, and diff check pass. Two material output gaps remain: it discards `compiled.boundState`/binding validation, so the public report cannot authenticate or revalidate currentness; and a fixture with one valid plus one malformed JSON reports representation fidelity `2/2` rather than `1/2` while attaching the parse failure, overstating the actual covered count.

## Built-report closure (`33c0578..`)

The real report now exposes the compiler-returned `boundState`, validation, and binding identity. Fidelity counts only successfully observed structured paths without representation failures; malformed JSON and duplicate-key YAML siblings remain in the denominator. Temp public tests, 21 focused tests, typechecks, and diff check pass; full gate remains deferred.

## Built-report final closure — FAIL (`33c0578..a09453b`)

JSON passes: exact compiler binding/identity/current validation reconstitutes and changes with evidence, deterministic 17 lanes/exit remain, JSON and duplicate-key YAML both report fidelity `1/2` with localized failure; CLI 34/34, typecheck, and diff check pass. One public-path gap remains: built text output is only `coverage: not-established` and carries neither binding identity nor current validation, so text and JSON do not yet expose the same authenticated report as required.

## Lean closure disposition

The terminal-summary difference is a nonblocking presentation residual. The terminal statement is conservative, while the command result and JSON retain the authenticated binding/currentness report; the shorter text cannot produce false completeness, stale authorization, data loss, or failure of the required coverage workflow. No additional repair cycle is warranted under the material-blocker rule.
