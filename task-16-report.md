# Task 16 — Semantic change planning and execution

## Targeted closure — FAIL (`da927d9..205d62f`)

Focused engine/runtime/CLI suites pass (514 tests), all three typechecks and diff check pass. Compiler request/current-binding identity, architecture-before-impact/query binding, normalized write/forbidden scope, observed content/rename/unit scope, authority/risk checks, and commit-failure intent replacement are repaired. Six material supported-path blockers remain:

1. **The plan-wide completion contract is enforced per packet and independence remains self-attested.** A valid two-packet plan whose contract requires both post-state units fails before its first commit because each packet observation is required to contain the other packet's final unit. Conversely, a validator port can satisfy independence using only caller-chosen `authorSource`/`independenceGroup` strings and hashes of those strings. This makes composed completion unusable or falsely proven instead of evaluating the combined final state with authenticated independent evidence.
2. **Declared SCC execution mutates before proving convergence.** A public two-packet SCC with changing outputs commits both packets on all three iterations (six commits), then returns partial/recovery-required. The capsule requires undeclared/nonconvergent SCCs to reject before transaction start and bounded fixed-point reconciliation; the current loop also defines convergence from caller-returned effect hashes rather than authenticated observed final state.
3. **Execution currentness is not bound to the authoritative before observation.** The currentness port returned one `StateDigest`, the authenticated before observation returned a different one, and the packet completed. Thus approval/currentness can authorize one state while effects and validation operate on another.
4. **Plan artifacts and reverse-impact claims are synthesized rather than reconciled/durable.** A completed plan with `knownAffectedUnitIds: []` changed `unit:a` yet returned no Planning Surprise and `reconciliation.converged: true`. Its returned certificate and required receipt hashes matched none of the persisted artifacts. Applied plans therefore lack exportable durable plan certificates/receipts and can silently omit predicted-versus-observed impact differences.
5. **CLI observe/dry-run violates selector and no-exec guarantees.** `change ... --mode observe` created `.projector/task16-selections/change-*.json`; `apply plan:missing --dry-run` exited 0 without resolving/authenticating the selector. The required read-only mode writes derived state, while missing/stale selector errors can be hidden by dry-run.
6. **CLI immutable selection and new-pipeline composition remain bypassable.** An injected public port resolved `planHash: expected` but applied and reported `immutablePlanHash: different` at the same risk; the CLI executed and exited 0 because it never compares the hashes. The built default path still reports `compatibility: true` and calls the legacy mandatory-slice prepare/apply path rather than the semantic compiler, packet planner, and coordinator, so the required Task 16 pipeline is not reachable through its real CLI composition root.

Direct bases: combined completion contract and independent post-state validation; nonconvergent SCC rejection before mutation; state-bound approval/currentness; actual-diff reconciliation and durable certificates/receipts; explicit immutable selectors; observe/dry-run no writes; built supported change→plan→apply pipeline. These reproduce stale authorization, committed nonconvergent state, false completion/artifact claims, and required workflow failure rather than residual hardening.

## Targeted closure repair (`205d62f..HEAD`)

- Packet-local validators/unit postconditions now precede mutation commit; the full CompletionContract is evaluated once over authenticated combined final state. Independence is supplied by a trusted validator registry result.
- SCC packets reject before lease/effect/transaction when no staging adapter exists. Before observations must exactly equal authenticated currentness state.
- Authenticated reconciliation compares predicted and observed impact, emits surprises, and plan certificate/required receipt artifacts are stored content-addressably; returned hashes are the verified stored hashes.
- Observe-mode change compilation is non-persistent. Dry-run resolves and currentness-checks immutable selectors before returning. Applied plan/risk/approval/capsule identities must match the resolved tuple.
- Default semantic selectors now compose the public semantic compiler, packet planner and packet coordinator around the supported mandatory transform; legacy mutation remains the packet effect rather than bypassing Task 16 orchestration.

Closure-focused verification: 99 affected tests passed; engine/runtime/CLI typechecks and diff check passed. Full repository gate remains deferred as requested.

## Final runtime patch (`064c6c7..HEAD`)

- Effect source/group is authenticated by packet identity; trusted validator registry provenance is compared to that actual author, so the same source/group cannot prove independence.
- Observed and attempted impact independently carry changed paths, units, canonical entities, external operations and generated outputs into scope checks, reconciliation, surprises and artifacts.
- Rollback/compensation recaptures an authenticated final observation. Partial/failure reconciliation and certificates bind durable rolled-back state while retaining the attempted after-state and impact separately.

Focused runtime/CLI tests, both typechecks and diff check pass. Full gate remains deferred.

## Precommit validation and built-impact closure

- Trusted registry provenance and independence now pass packet-local checks before intent persistence or durable commit. A validator matching the authenticated effect source/group rolls back with zero commits.
- Successful packet observations map authenticated state/path change to the packet's affected units before reconciliation. The built mandatory pipeline now reports its exact predicted unit set with no false missing-unit surprises.

Focused runtime/CLI tests and typechecks pass; runtime was rebuilt before the built CLI assertion. Diff check passes; full gate remains deferred.
