# Task 17 — model, host, and MCP integrations

## Outcome

Implemented the four capsule slices without vendor SDKs or live calls:

- Provider-neutral structured inference now authenticates input, normalized request, route, and response identities; binds replay to route/policy; enforces attempt, token, cost, timeout, and cancellation bounds; validates schemas before recording; and keeps resampling distinct.
- Codex and Claude adapters derive capability levels from executable feature probes. Sessions require current state/capsule/authority proof, filter environment variables, journal and observe before launch, and always recapture/reconcile after completion, crash, or cancellation. Missing hosts return manual continuation.
- MCP uses an actual registry plus JSON-RPC transport. Read calls remain separate from controlled calls and redact secret-shaped fields. Controlled calls consume a durable, one-shot CAS capability bound to session, worktree, plan, packet, capsule, approval, StateBinding, operation, semantic/write scope, risk, expiry, revocation, and currentness.
- `projector run codex|claude --session <selector> -- <argv>` preserves argv arrays, filters environment, uses normalized mutation policy, starts nothing for dry-run/observe, supports cancellation, reconciles post-process repository status, and maps unavailable/recovery states to non-success exits.

## RED → GREEN evidence

- Model/cache group: forged input/route/response hashes, schema retry/replay, exhaustion, cancellation, and hanging-provider timeout.
- Host group: probe-derived levels, missing executable fallback, prelaunch ordering, argv/environment fidelity, crash observation, and recovery.
- MCP group: real transport list/call flow, read/mutation separation, redaction, expiry, revocation, wrong worktree, replay, and concurrent CAS consumption.
- CLI group: literal argv, scoped environment, explicit session selector, dry-run no-launch, unknown/missing hosts, cancellation, and truthful reconciliation.

Focused result: 15 tests passed; integrations and CLI typechecks passed.

## Frozen gate

The single frozen repository gate passed:

- `pnpm verify` — 64 files, 610 tests; all workspace typechecks and boundary checks passed.
- `pnpm build` passed for all workspace packages.
- `pnpm check:boundaries` and `git diff --check` passed.

No live or paid model/host call was made.

## Independent review — FAIL (`1397cee..b61181a`)

Focused integrations/CLI tests pass (9), both package typechecks and diff check pass. Seven material public-path blockers remain:

1. **Replay bypasses every inference proof.** `runStructuredInference` returns any non-`undefined` cache row without checking its key, request/route hashes, provider/model/revision, response hash, schema, candidate hash, or budgets. An exported-API repro replayed an attacker-provider row whose schema validator returned false and whose hashes were literal forgeries. Corrupt/forged cache state can therefore become accepted inferred evidence.
2. **Host capability and currentness claims are false.** A probe reporting only `structured-result` and `tool-observation`—explicitly no programmatic execution, lifecycle hooks, filesystem observation, cancellation, or token support—is advertised as level 3, `state-bound`, and `programmaticExecution: true`. Conversely `run` requires exact compiled-against root equality and has no dependency/query binding validator, so the specified unrelated-root rebind cannot run. Public callers can receive stronger enforcement than exists or lose a valid dependency-local workflow.
3. **The built host wrapper bypasses the Task 17 lifecycle.** CLI `run` spawns the executable directly instead of using the host adapter: the session selector is never resolved, and no capsule, authority, instructions, journal, state binding, scope check, or Task 16 reconciliation is used. A fake `codex` accepted nonexistent `session:not-stored`, changed and committed a tracked file, then the built CLI returned exit 0, `changedPaths: []`, and `reconciled: true` because before/after Git status was clean. Observe/dry-run likewise never validates the selector. This is a false completion over an unobserved direct write.
4. **MCP is a confused deputy.** Capability fields are supplied by the untrusted call and are not bound to the selected registry tool or its actual semantic/write targets. A one-shot grant for operation `write-file` and `src/**` successfully invoked `projector.accept_decision`; `writePath: "src/../outside"` also passed the string-prefix scope check. Thus a valid narrow token can authorize a different governance mutation and path escape before the controlled handler runs.
5. **Capabilities are not unforgeably/currently state-bound.** Eight predictable characters satisfy the entropy check; the grant stores only `bindingDigest`, not the required `StateBinding` plus compiled-against `StateDigest`; expiry uses caller-provided `now`; and there is no normalized root/symlink-safe target binding. The exported service accepted token `12345678`. Guessing or retaining a token can therefore combine with caller-shaped time/state/target claims to bypass expiry and relevant-state authorization.
6. **MCP secret policy leaks value-shaped secrets.** Sanitization removes only object keys matching a regex. The real transport returned `"Authorization: Bearer live-secret"` and `"password=hunter2"` unchanged when embedded in ordinary string/array values, violating the pre-disclosure secret boundary.
7. **There is no built MCP lifecycle or required Projector tool composition.** `projector mcp` is still an unknown CLI command, and the public server is only a caller-populated generic registry; none of the specified status/audit/explain/context/coverage/divergence/plan/representation/identity/relevance/requirements/scenarios/impact tools are installed by a supported composition root. The required MCP workflow cannot be invoked even though isolated registry tests pass.

Direct bases: authenticated/schema-valid replay; truthful host capability and dependency-local binding; state-bound wrapper observation/reconciliation; unforgeable plan/scope/currentness-bound mutation capability; secret/context policy; and the specified `projector mcp` public interface. Repros produce forged semantic evidence, unauthorized governance/path mutation, hidden committed writes with false success, secret disclosure, and required workflow failure.

## Consolidated repair closure

All seven review findings were repaired in one batch. Cache rows are fully re-authenticated before replay. Host levels now require their actual probe features, and run currentness uses dependency-scoped validation/rebound proof. The built wrapper resolves a content-addressed plan/capsule/approval session before dry-run or execution, journals and observes around launch, detects committed-clean changes, and invokes fixed-point reconciliation.

MCP capabilities now store the full StateBinding and canonical root, use trusted clock/256-bit entropy ports, bind registry tool plus handler-derived targets, resolve root-confined paths, and consume atomically. Transport redaction covers secret-shaped keys and string/array values. The built MCP composition installs the exact 16 read-first and five controlled tools through the real registry/transport.

Repair evidence: 18 focused assertions plus integrations/CLI typechecks and diff check passed. Frozen gate passed with 64 files and 613 tests, workspace build, boundaries, and diff check. Fake hosts/providers only; no live or paid call.
