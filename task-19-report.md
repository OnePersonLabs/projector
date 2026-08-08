# Task 19 — operations, reporting, benchmarks, and dogfood

## Delivered

- Runtime `WatchCoordinator` serializes event handoff, coalesces create/change/delete/rename/generated events, widens overflow to full scan, authenticates scan hashes, preserves unrelated cache keys, and rejects repeated-digest/nonconvergent processing. Its ports expose no repository-code execution path.
- `redactBeforeBoundary` deterministically replaces credential, bearer/token, and private-key values with typed placeholders before context or persistence while preserving benign technical literals and treating hostile repository prose as inert data.
- One versioned, hash-bound operational report DTO drives text, JSON, Markdown, and SARIF with deterministic finding IDs/evidence. JSONL telemetry is redacted before append, sequence/previous-hash bound, bounded, concurrency-serialized, DTO-traceable, and fail-closed on malformed/corrupt replay.
- Built `projector watch`, `ci`, `recover`, and `verify --clean` normalize through the existing ExecutionPolicy. CI/watch/verify use the no-exec local analyzer; recovery composes the existing root-constrained durable journal and is idempotent. Exit codes come from the authenticated report DTO and remain identical across report formats.
- Testkit benchmark gates preserve exact inclusive/strict thresholds, explicit numerator/denominator/observability, unavailable zero denominators, protected-dimension hard constraints, and an independent shared-bug oracle. Held-out/training/mutation manifests are disjoint, immutable, seeded, aggregate-hashed, and replayable.
- Repository dogfood declares active authority, Governance Base, architecture decision, lens/rules, and bounded accepted debt. Its executable lint rejects missing, inactive, or duplicate governance identities. CI runs dogfood lint, verify, and build.

## Public-path acceptance

- Watch: coalescing, overflow, generated follow-up, cache locality, scan authentication, and oscillation rejection.
- Recovery: incomplete transaction rollback, second-run idempotency, corrupt-journal failure mapping, checkpoint/effect behavior inherited from the exhaustive journal phase/crash suite, and root-constrained paths.
- Trust/reporting: nested/value-shaped/private-key redaction, typed placeholders, hostile inert content, text/JSON/Markdown/SARIF parity, concurrent JSONL append, deterministic replay, and corruption rejection.
- Benchmarks: exact 95% boundary, strict 10% ceiling, zero denominator, protected fidelity, shared clean/incremental bug, independent oracle, and held-out manifest disjointness/hash replay.
- Dogfood: authored state and deterministic lint.

Focused result: 14 assertions passed; runtime, testkit, and CLI typechecks plus diff check passed.

## Verification

Frozen `pnpm verify && pnpm build && pnpm check:boundaries && git diff --check` passed: 71 files / 633 tests, all workspace typechecks and builds, and both boundary checks. A built `projector ci --format json` smoke against a fresh committed temporary repository returned the deterministic authenticated report with exit 0. No live model, host, external adapter, or repository-code execution was used.
