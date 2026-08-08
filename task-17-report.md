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
