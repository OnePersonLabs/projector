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
