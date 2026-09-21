# Projector operations

The installed `scripts/projector.mjs` exposes `init`, `context`, `check`, `accept`, `resume`, `inspect` and `recover`. Run `--help` for arguments. Default output is readable meaning and findings; `--json` exposes the service result. Node 24 or later is the host runtime. No repository-specific package manager is needed.

## Meaning and normal changes

Retrieve task context, make authorized edits with Codex, and check the retained context afterward. Typed relationships and source-query membership help find consequences outside the edited file. Read selected meaning and unknowns; lexical matches do not establish applicability. A changed assumption, new consumer, actual violation and unavailable observation have different consequences.

Canonical prose has one Markdown owner with typed TOML metadata. Relations and executable policies remain TOML. The parser normalizes these records into Core contracts. Stable identity is independent of the readable filename. Exact authored bytes remain bound for replacement and recovery; formatting equivalence cannot authorize a different write.

## Acceptance and recovery

`accept proposal.json` captures and plans, then returns a preview and immutable hash. `accept --apply CHANGE --hash HASH` approves and applies that exact current plan. Review all affected meaning, scope, assumptions, obligations and blocking questions before applying. A changed proposal is a new capture. Approval never transfers automatically.

`resume ID` performs read-only inspection and context recovery. It does not reclaim ambiguous ownership, apply changes or renew authority. Use the actual retained ID, never a guessed latest result. `recover APPROVAL` explicitly repairs a recognized interrupted controlled transaction; inspect its outcome before deciding on any further application. An unrecognized journal remains preserved for investigation.

## Machine integration

`scripts/projector-operation.mjs [request.json]` reads one strict request from a file or stdin:

```json
{
  "apiVersion": "projector.operation/v1",
  "operation": "context",
  "repositoryRoot": "<absolute path>",
  "input": { "request": "<outcome>", "persist": true }
}
```

Core owns supported operations and input schemas. Every result has `status`, `exitCode`, `readiness`, and either `output` or an actionable error. Check the operation-specific outcome too. `init` publishes current configuration last. An unsupported authored format is left untouched. Package patch releases do not require semantic data migration.

Full lifecycle operations remain available for integrations: `change.capture`, `change.plan`, `change.approve`, `change.apply`, and `change.recover`. Representation inspection distinguishes artifact integrity, dependency freshness, semantic fidelity and execution authorization. Hash agreement establishes byte or normalized-value agreement, not truth or agent understanding.

Controlled code execution requires authenticated exact patch input, bounded write scope, current dependencies and independent validators available at the Git base. A proposed validator cannot certify its own independence. Ordinary Codex edits carry the host's authorization and verification, not Projector's transaction guarantee.

Read [harness-guide.md](harness-guide.md) for service ownership and custom integration. Read the owning skill's proposal reference for canonical authoring. Keep application-specific observation code and test harnesses outside the general runtime.
