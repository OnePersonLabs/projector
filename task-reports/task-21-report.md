# Task 21 — Codex CLI subscription provider

## Delivered

- `createCodexExecProvider` and `createCodexExecRouter` make the installed Codex CLI a public structured-model provider through `projector/integrations/codex`, `projector/integrations/models`, and the root integrations facade.
- Availability is explicit and authenticated: the adapter probes a versioned CLI contract, requires `codex login status` to identify a ChatGPT login, rejects API-key/access-token authentication, and reports missing or incomplete installations without claiming provider capability.
- Inference uses direct argv spawning with no shell, a real explicit cwd, an explicit model, isolated user configuration, ephemeral sessions, ignored repository rules, a read-only sandbox, a generated JSON Schema, JSONL token usage, and a minimal environment limited to executable/auth/runtime location keys. API keys and unrelated variables are never inherited. The capability probe additionally requires a stable `--disable` contract and proves the complete stable tool-feature inventory before every shell, unified-exec, code-mode, browser/computer, app/plugin, MCP-elicitation, multi-agent, image, hook, skill, and workspace-discovery surface is explicitly disabled; the model therefore has no tool path to read the authentication home.
- Input, request, capsule, schema, route, response, and replay identities are content-bound through the existing authenticated gateway. Route probing and provider execution share cancellation and remaining wall-clock budgets; failed calls never reach the inference artifact store.
- Input/schema bytes are preflighted against the declared input budget. Structured output and process diagnostics have hard byte limits; observed input/output usage must be present and within declared and cumulative gateway token budgets. Temporary schema/result files are private and always removed.
- Failures have stable codes and content-free diagnostics for unavailable/auth/contract, cancellation, timeout, output/token limits, process exit, and malformed response. The existing `projector mcp` transport and tool inventory were not changed, preserving compatibility with the separately installed Projector Codex plugin.

## Acceptance evidence

- RED: the provider module and public facade were absent.
- GREEN: 7 focused provider/gateway/public-entry tests, including a fake executable at the real spawn boundary, exact per-feature disable assertions, and fail-closed missing-disable/missing-feature contracts; affected integrations typecheck passed.
- Frozen gate: 74 files / 648 tests, all workspace typechecks and builds, package boundaries, generated release traceability, and diff check passed under Node 24. A read-only probe of the installed `codex-cli 0.147.0` confirmed the full structured-exec contract and ChatGPT subscription authentication.
- The release traceability test initially detected its expected source digest change after the public facade assertion; regenerated authenticated traceability and the targeted 3-test release suite passed.

## Residual

Codex CLI 0.147.0 exposes no hard output-token flag. The adapter therefore reports `preflight-and-observed` rather than claiming strict provider-side token enforcement: input/schema size is rejected before launch, usage is required and checked after the call, and wall-clock/output-byte limits remain hard. No paid/live inference was used; the local subscription status and CLI contract were probed read-only.
