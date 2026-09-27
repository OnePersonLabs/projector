# CLI reference

The separately packaged CLI distribution exposes the bare `projector` command when installed on the host `PATH`. Installing the Projector plugin does not add this command to `PATH`. Plugin skills invoke the bundled CLI as `node <plugin>/scripts/projector.mjs`; for terminal use, prefix an operation with that script path when the standalone CLI is not installed. Both entry points expose the same public operations and arguments. Use Node 24 or later. Run `projector --help` or `node <plugin>/scripts/projector.mjs --help` for help.

## Contents

- [Operations](#operations)
- [Operation notes](#operation-notes)
- [Options](#options)

## Operations

```text
projector init
projector context "task" [--entity ID] [--target path] [--budget characters]
projector check [CONTEXT]
projector audit [--scope PATH] [--context CONTEXT] [--question-offset N] [--json]
projector accept proposal.json [--context CONTEXT] [--request "reason"]
projector accept --apply CHANGE --hash HASH
projector resume CONTEXT|CHANGE|APPROVAL
projector inspect ID
projector recover APPROVAL | --access
```

Global options are `--root PATH` for another repository, `--json` for exact machine results, `--timeout-ms N` for a positive integer observation timeout in milliseconds, and `--help`. The default timeout is 60,000 milliseconds per operation. A longer bounded timeout is appropriate when legitimate repository work needs more time. It preserves other resource limits, currentness checks and mutation authority. Investigate a timeout proportionately; do not make meeting the default an open-ended optimization task. A flag only applies to operations that accept it. Unknown and duplicate options fail.

## Operation notes

### `init`

Takes no positional argument. Activates or validates Projector in the selected repository. Installation alone does not activate a project.

### `context`

Requires a task description. `--entity ID` and `--target path` may each be repeated. `--budget characters` sets the retrieval budget. The result persists a context; retain the returned ID.

### `check`

Accepts an optional context ID. With no ID, the operation performs the supported repository check behavior. Check findings are evidence to interpret, not a universal correctness claim.

### `audit`

Observes bounded implementation and canonical evidence for the selected scope. `--scope PATH` defaults to `.` and must resolve inside the selected repository root. `--context CONTEXT` attaches the audit to an existing context. `--question-offset N` selects a question page and defaults to zero. Use the returned next offset to request another page. Audit calls the read-only cleanup operation once; it does not edit source or canonical records. Operational observation artifacts may be created. The report names evidence status, known questions, unsupported or unavailable coverage, and available repair routes. It does not report a global completeness percentage or prove behavioral completion.

### `accept`

Capture mode takes a proposal JSON file and optionally `--context CONTEXT` and `--request "reason"`. It returns a review preview and immutable plan hash. Apply mode requires `--apply CHANGE --hash HASH` and does not accept proposal options. Apply only the reviewed plan.

### `resume`

Takes an actual context, change, or approval ID. It inspects and restores retained context. It does not apply a change or renew authority.

### `inspect`

Takes an exact ID for a canonical record or retained operation detail. Output is JSON.

### `recover`

Takes an approval ID for explicit recovery, or `--access` for operation-access recovery. Recovery repairs a recognized interrupted controlled transaction; it does not reapply work.

## Options

| Option | Meaning |
|---|---|
| `--root PATH` | Resolve operations against another repository. |
| `--entity ID` | Add an exact entity to context retrieval; repeatable on `context`. |
| `--target path` | Add a source path to context retrieval; repeatable on `context`. |
| `--budget characters` | Set the `context` budget. |
| `--context CONTEXT` | Ground an `accept` capture in retained context or attach an `audit` to retained context. |
| `--scope PATH` | Limit `audit` to a path inside the selected repository root; defaults to `.`. |
| `--question-offset N` | Select the `audit` question page with a nonnegative integer; defaults to `0`. |
| `--request "reason"` | State the reason for an `accept` capture. |
| `--apply CHANGE` | Select the reviewed change for `accept` apply mode. |
| `--hash HASH` | Bind apply mode to the reviewed immutable plan. |
| `--json` | Emit exact machine results. |
| `--help` | Print help. |
| `--access` | Select operation-access recovery with `recover`. |

For the machine integration request envelope, operation schemas, and lifecycle details, read the [operation contract](../../plugins/projector-v3/references/operation-contract.md).

Continue with [Getting started](../getting-started.md) or [Review, reconcile, and recover](../review-reconcile-recover.md).
