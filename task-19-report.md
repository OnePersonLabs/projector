# Task 19 — operations, reporting, benchmarks, and dogfood

## Delivered

- Runtime watch composition serializes initial scan/event handoff, coalesces typed create/change/delete/rename/generated events, widens overflow, authenticates scans, preserves unrelated caches, rejects oscillation, enforces an event budget, and remains active until cancellation/budget. The built source combines root filesystem notifications with bounded overflow scans and never executes repository code.
- Operational policy is enforced before effects: recovery dry-run returns approval-required without journal mutation; Observe watch creates no telemetry. Recovery still composes the existing root-confined durable journal and remains idempotent.
- A canonical proof object derives all exit codes 0–7 with explicit precedence. Reports are validated at the CLI boundary by the authenticated operational port; error findings cannot be self-hashed into exit 0. Text, JSON, Markdown, and SARIF render from the same DTO.
- Redaction removes nested key- and value-shaped credentials, tokens, and private keys before report/context persistence, including secret values under benign-suffix keys, while preserving typed placeholders and inert repository prose.
- Operational run DTOs contain explicit config/toolchain/Git/worktree/canonical bindings plus graph/analyzer/model/snapshot/decision/transform/validation/journal/duration/error records or explicit unavailability. JSONL entries are redacted, versioned, DTO-hashed, sequence/previous-hash bound, replay-bounded, corruption rejecting, and serialized across store/process instances with a root-confined lock.
- Benchmark release gates use a fixed normative inventory, thresholds/directions/protected dimensions, nonempty evidence, an independently hashed clean/incremental/conformance digest, and fail closed on empty/missing/duplicate/caller-redefined gates. Held-out manifests require nonempty disjoint training, held-out, and mutation sets with immutable aggregate replay.
- `verify --clean` securely removes and reconstructs deterministic derived state from the canonical dogfood digest and compares clean/incremental analysis. Built CI refuses malformed governance and architecture decisions that claim repository prose can grant tools or override policy.
- Authored dogfood binds authority and Governance Base hashes. Its independent lint validates identities/status, authority/source hashes, dangerous decisions, required security/benchmark spec clauses, and the current combined authoritative-spec digest. CI runs dogfood lint, verify, and build.
- Every new operational filesystem path is resolved through `RepositoryPathService`; static telemetry symlink escape is refused and mapped to exit 6 without an out-of-root write.

## Acceptance evidence

Initial implementation commit: `f824a81`.

The consolidated review reproduced eight blockers: one-shot watch, unauthorized dry-run/Observe effects, caller-shaped exits, `_budget` redaction bypass, non-atomic/incomplete telemetry, fail-open benchmark evidence, shallow clean/dogfood proof, and telemetry symlink escape. One grouped RED matrix covered those public paths and direct siblings.

Repair-focused result: 18/18 assertions passed across runtime operations, testkit benchmark, CLI operations, and CLI policy. Runtime, testkit, and CLI typechecks passed; dogfood/spec lint and diff check passed.

Frozen repository gate passed:

- `pnpm verify`: 71 files / 637 tests plus all workspace typechecks and the boundary check.
- `pnpm build`: all workspace packages.
- `pnpm check:boundaries` and `git diff --check`.

No live model, paid host, external adapter, or repository-code execution was used. Journal internals and Task 20 publication scope were not reopened.

## Targeted independent closure — FAIL (`f824a81..86e0c61`)

Focused operations/benchmark/policy tests pass (18/18), runtime/testkit/CLI typechecks pass, dogfood/spec lint passes, and the repaired redaction, report validation, cross-store JSONL sequencing, held-out/oracle fail-closure, cancellation, and telemetry-symlink probes close their recorded cases. Two material blockers remain:

1. Built non-mutating policy still writes repository state. On a temporary committed repository with `.projector/state.db` containing `SENTINEL`, `projector verify --clean --dry-run --format json` replaced it with rebuilt JSON and created `.projector/telemetry/runs.jsonl`; `projector ci --dry-run` likewise created telemetry. This contradicts the normalized `ExecutionPolicy.allowAutoMutation=false` boundary and Observe's specified “No repository/canonical mutation” semantics. Consequence: inspection/dry-run can delete or persist governed state despite explicit refusal of mutation.
2. The repaired watch event budget has no supported built path or durable continuation. `projector watch --budget-tokens 1 --format json` exits 1 with “coverage scope, strictness, and budgets are only valid with coverage, complete, or cleanup”; internally the lifecycle result is only ephemeral and watch telemetry/checkpoint persistence is unconditionally skipped. This contradicts the Task 19 requirement that watch resume from durable budget/checkpoint state and the built-path requirement to validate budgets, and prevents the specified authenticated exit 7/resume workflow.

## Final narrow closure

- `ci --dry-run`, `verify --clean --dry-run`, and Observe now suppress every operational repository/derived/telemetry write; an existing `state.db` remains byte-identical.
- Built watch accepts token/cost budgets and `watch:default`. Exit 7 is emitted only after an authenticated, atomically stored root-confined checkpoint exists. Pending events and cumulative sequence resume from that checkpoint; successful cancellation clears it after each queued event effect has run exactly once.

Closure-focused result: 12/12 runtime/CLI assertions passed, including the built budget/resume path; runtime and CLI typechecks plus diff check passed. Final frozen gate passed with 71 files / 640 tests, every workspace build/typecheck, both boundary checks, and diff check.
