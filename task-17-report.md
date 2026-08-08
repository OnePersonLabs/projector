# Task 17 — model, host, and MCP integrations

## Delivered

- Provider-neutral inference authenticates normalized request, input, route, response, cache artifact, schema, candidate, provider revision, and replay policy. Attempts, tokens, cost, timeout, cancellation, and resampling are bounded; malformed output never becomes evidence.
- Codex and Claude adapters derive levels from real feature probes. Observed enforcement requires lifecycle/tool/filesystem observation; state-bound enforcement additionally requires programmatic execution, structured results, and state capability. Missing executables return manual continuation.
- Host runs authenticate capsule, plan approval, instructions, authority, and dependency-local StateBinding currentness. They journal and observe before launch, recapture after completion/crash/cancellation, include committed-clean writes, enforce capsule paths, validate changed repository documents, and run engine fixed-point reconciliation.
- MCP exposes the exact 16 read-first and five controlled tools through the actual JSON-RPC registry/transport. Status/audit/divergence use real local-repository analysis; unsupported reads return explicit unavailable results.
- Controlled MCP calls use a durable atomic file store and one-shot capability bound to session, canonical root, plan/packet/capsule/approval, full StateBinding, tool, handler-derived semantic/write targets, risk, expiry, and revocation. Entropy and time come from trusted ports; root/symlink escape rejects before effects.
- Secret-shaped keys and values are redacted before transport disclosure.
- `projector run codex|claude --session ... -- ...` preserves argv arrays, scopes environment, validates selectors even in dry-run, and maps unavailable/failed reconciliation to non-success.
- `projector mcp` keeps a JSON-lines transport alive through EOF. With an authenticated session it issues a durable capability and supports the bounded local `apply_transform` path; other unavailable controlled adapters fail explicitly.

## Acceptance evidence

Public-path RED→GREEN coverage includes:

- forged input/route/response/cache identities, schema-invalid retries, replay, exhaustion, cancellation, and hanging-provider timeout;
- probe level truthfulness, missing executable, dependency-local unrelated-HEAD rebound, prelaunch ordering, argv/environment fidelity, crash recovery, committed-clean changes, and invalid committed governance rejection;
- real MCP list/call transport, multi-request lifecycle, real status read, read/mutation separation, redaction, weak entropy, expiry, revocation, tool mismatch, path escape, replay, concurrent CAS consumption, and an authorized controlled fake write;
- explicit run session selection, dry-run no-launch with selector authentication, unknown host, signal/recovery exits, and built 21-tool MCP composition.

Focused closure: 18 assertions passed; integrations and CLI typechecks plus diff check passed.

## Review history

The first independent review found seven material blockers: unauthenticated replay, overstated host capabilities, direct-spawn CLI bypass, confused-deputy MCP routing, weak/currentness-free capabilities, secret-value disclosure, and missing MCP composition. Commit `760e3f1` closed the cache, routing, capability, and redaction findings and introduced authenticated built compositions.

The targeted closure review retained three blockers: programmatic-only hosts still claimed observation, built run rejected dependency-local rebound and used path-only reconciliation, and built MCP only listed names. The final closure makes observation claims probe-dependent, validates/rebinds before execution, blocks analyzer-invalid committed state, and provides a durable functioning transport/read/control lifecycle.

## Verification

- Initial implementation commit: `b61181a`.
- Consolidated repair commit: `760e3f1`.
- Fake providers/hosts only; no live or paid call.
- Final frozen gate passed: 64 files/613 tests, workspace build, package boundaries, and diff check.
