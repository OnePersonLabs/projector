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
projector integration --target REF --incoming REF [--base REF] [--result REF]
projector audit [--scope PATH] [--context CONTEXT] [--question-offset N] [--json]
projector accept proposal.json [--context CONTEXT] [--request "reason"]
projector accept --apply CHANGE --hash HASH
projector resume CONTEXT|CHANGE|APPROVAL
projector inspect ID
projector recover APPROVAL | --access
projector verify check.json
projector verify --inspect [EVENT] | --recover
projector generate generation.json
projector generate --inspect producers.json | --recover producers.json
```

Global options are `--root PATH` for another repository, `--json` for exact machine results, `--timeout-ms N` for a positive integer observation timeout in milliseconds, and `--help`. The default timeout is 60,000 milliseconds per operation. A longer bounded timeout is appropriate when legitimate repository work needs more time. It preserves other resource limits, currentness checks and mutation authority. Investigate a timeout proportionately; do not make meeting the default an open-ended optimization task. A flag only applies to operations that accept it. Unknown and duplicate options fail.

## Operation notes

### `init`

Takes no positional argument. Activates or validates Projector in the selected repository. Installation alone does not activate a project.

### `context`

Requires a task description. `--entity ID` and `--target path` may each be repeated. `--budget characters` sets the retrieval budget. The result persists a context; retain the returned ID.

### `check`

Accepts an optional context ID. With no ID, the operation performs the supported repository check behavior. Check findings are evidence to interpret, not a universal correctness claim.

### `integration`

Requires one `--target REF` and one `--incoming REF`. It compares ordinary Git
contributions without a candidate ID, source checkout, or managed worktree.
It resolves the refs to immutable objects before assessing them. `--base REF`
selects an explicit common ancestor; otherwise Git must identify one merge base.

Use `--result REF` to assess the actual merge, rebase, squash, or hosting-provider
result. Without it, Git calculates a proposed merge tree. This can create
immutable Git objects but does not change refs, the index, or working files.
Calculation uses committed target attributes. Unsupported custom merge settings
require an ordinary merge result supplied through `--result`.

The report lists authored model and file contributions from both sides. It
distinguishes preserved, altered, and lost work. It exposes Git conflicts,
canonical check scope, and remaining verification and review obligations.
Exit code 6 reports conflicts, invalid records, altered/lost contributions, or
static governance with `failed` or `incomplete` status. Exit code 0 means the
assessment completed without those findings; it does not mean behavioral checks,
full governance, CI, or independent review have passed.
The actual result is also reconciled against static import and re-export
consumer populations, observed rule membership and obligations. A consumer added
by either contribution can become relevant to a dependency changed by the other.
Dynamic or unsupported relationships remain unknown. These source observations
do not constitute reusable behavioral verification.
Use `--json` for exact input identities and all contribution details.

### `audit`

Observes bounded implementation and canonical evidence for the selected scope. `--scope PATH` defaults to `.` and must resolve inside the selected repository root. `--context CONTEXT` attaches the audit to an existing context. `--question-offset N` selects a question page and defaults to zero. Use the returned next offset to request another page. Audit calls the read-only cleanup operation once; it does not edit source or canonical records. Operational observation artifacts may be created. The report names evidence status, known questions, unsupported or unavailable coverage, and available repair routes. It does not report a global completeness percentage or prove behavioral completion.

### `accept`

Capture mode takes a proposal JSON file and optionally `--context CONTEXT` and `--request "reason"`. It returns a review preview and immutable plan hash. Apply mode requires `--apply CHANGE --hash HASH` and does not accept proposal options. Apply only the reviewed plan.

### `resume`

Takes an actual context, change, or approval ID. It inspects and restores retained context. It does not apply a change or renew authority.

### `inspect`

Takes an exact ID for a canonical record or retained operation detail. Output is JSON.

Use `inspect --representations` to list interrupted representation publications
and their capture association without changing them.

### `recover`

Takes an approval ID for explicit recovery, or `--access` for operation-access recovery. Recovery repairs a recognized interrupted controlled transaction; it does not reapply work.

Use `recover --representations` to recover staged representation publications.
An uncaptured change remains uncaptured. Missing staging data or conflicting
final bytes remain explicit recovery failures. Inspection does not run recovery.

### `verify`

`verify check.json` runs a native process and retains its input snapshot, result,
and failure or interruption history without a candidate ID. The strict JSON
object requires `executable`, `args`, `inputPaths`, `populations`, `environment`,
and `timeoutMs`; it may include `sourcePath` and `completeInputs`. Unknown fields
are rejected. `executable` must be an absolute path. Each population has
`directory` and `recursive`. When `sourcePath` is supplied, it must also appear
in `inputPaths` and is passed to the executable as its first argument.

Set the optional complete-input declaration to `true` for input and population
coverage. This declaration does not prove hermeticity or discover every
dynamic read, or detect transient changes that occur and disappear during
execution. Include relevant source, tests, fixtures, configuration and tool
inputs. Declare relevant existing directory populations even when empty. Input
paths must be canonical and cannot include `.projector/runtime`. Root file
populations use `{ "directory": ".", "recursive": false }`. Recursive `.` or
`.projector` populations are refused because they include runtime evidence
created by the operation; declare narrower source directories instead. Selected
environment values are hashed rather than stored. On Windows, the launcher also
passes and hashes available `SystemRoot`, `WINDIR`, `PATH`, `PATHEXT`, `TEMP`
and `TMP` values. Projector does not confine this native process. Configured host
permissions apply.
`verify --inspect [EVENT]` reads historical records, optionally filtered by
event ID, without running them again. `verify --recover` finalizes recoverable
saved evidence and re-inspects; it never reruns a process. Missing staging
evidence remains unresolved.

Native records describe an observed execution. They do not certify complete
dependencies, hermetic execution, portable reuse, or correctness. Assessment
always reports `reusable: false`, including when declared inputs still match.
The optional host environment variable `PROJECTOR_VERIFICATION_EVIDENCE_STORE`
selects an absolute host path for retaining complete immutable records. Local
publication journals remain under `.projector/runtime`. A configured host store
allows historical records to be inspected after the source checkout is gone.

`verify --builtin --target REF` runs the shipped
`projector.canonical-integrity/v1` check over an immutable Git revision. The host
must configure an absolute `PROJECTOR_VERIFICATION_EVIDENCE_STORE` and include
that exact check ID in the comma-separated
`PROJECTOR_VERIFICATION_TRUST_POLICY`. The optional
`PROJECTOR_VERIFICATION_TRUST_POLICY_VERSION` distinguishes host policy
revisions. The request and repository content cannot grant this trust.

This fixed check binds the complete selected canonical population, including
empty results and configuration presence, the actual installed producer and
dependency bytes, Node and Git executables, and its evaluation contract. It
validates canonical integrity and supported static governance. It does not run
repository commands or verify application behavior.

`verify --builtin --assess EVENT --target REF` compares retained evidence with
current complete inputs and host trust. Matching qualified evidence can report
`reusable: true` for this named check only. It always reports
`authorization: false`. `verify --builtin --inspect [EVENT]` reads history;
`verify --builtin --recover` completes recoverable evidence publication without
rerunning the check. Failures, interruptions and contradictory observations stay
visible. Independent timestamps do not establish supersession.

### `generate`

`generate generation.json` invokes a declared repository source entrypoint
through its absolute runtime executable and retains generation evidence. Its
strict JSON object requires `producerId`, `executable`, `sourcePath`, `args`,
`inputPaths`, `populations`, `outputs`, `environment`, and `timeoutMs`; it may
include `completeInputs`. Unknown fields are rejected. `sourcePath` and all
repository paths are canonical repository-relative paths. Each output contains
`path` and `ownership` (`retained` or `disposable`); output paths must be unique
and separate from inputs. Outputs cannot target `.projector` or `.git`, including
case aliases.
The entrypoint is included in the observed inputs.
Include all relevant runtime, source, configuration and population dependencies.
The runtime receives the resolved entrypoint as its first argument; ordinary
shell-command strings are not accepted.

Generation holds the existing worktree writer lease while it observes inputs,
records its local intent, runs the producer and observes the resulting outputs.
An active governed writer blocks a second generator in the same checkout.
Different checkouts remain independent. Evidence inspection and publication-only
recovery do not acquire that source-write lease. Host permissions still govern
the process; this coordination does not establish confinement.

`generate --inspect producers.json` inspects historical evidence against the
listed `activeProducerIds`. The strict object contains only that array. An empty
array treats all observed producers as retired. `generate --recover
producers.json` finalizes complete saved output records, then inspects them
against the same producer list. It does not run the producer again. If recovery
joins a completed native execution to an interrupted generation intent, it
observes outputs at recovery time and records `afterObservation: "recovery"`.
That evidence is never current because its immediate post-execution observation
is unavailable. Missing staging evidence remains unresolved.

Generation evidence distinguishes unchanged bytes from bytes changed after the
invocation. `afterObservation` is `immediate` after normal execution or
`recovery` when recovery observes output bytes after an interrupted association.
It does not prove exclusive causation, execution confinement, complete
dependencies, portable reuse or correctness. Changed inputs or outputs, failed
execution, or a retired producer prevent current evidence. Inspection keeps
historical records when their producer or inputs are unavailable. It returns
`current: false` and gives the unavailable reason. It preserves retained
outputs and identifies disposable outputs eligible for removal; it never
deletes them. The optional
host evidence store also retains complete immutable generation records;
publication journals remain local under `.projector/runtime`.

### `evaluate`

`evaluate options.json` evaluates proposed options for a canonical `concernId`.
The request can name additional `preferenceIds`, concern-scoped `research`
records and an acceptance mode. Accepted applicable project preferences and
authority freshness requirements still apply. Missing or stale research remains
explicit. Submitted research provenance is not independent proof of external
truth. The result does not accept or mutate canonical meaning. Use `--json` for
the complete tradeoff matrix and evidence.

## Options

| Option | Meaning |
|---|---|
| `--root PATH` | Resolve operations against another repository. |
| `--entity ID` | Add an exact entity to context retrieval; repeatable on `context`. |
| `--target path` | Add a source path to context retrieval; repeatable on `context`. |
| `--budget characters` | Set the `context` budget. |
| `--full` | Return full context detail on `context`; normal transport limits still apply. |
| `--context CONTEXT` | Ground an `accept` capture in retained context or attach an `audit` to retained context. |
| `--scope PATH` | Limit `audit` to a path inside the selected repository root; defaults to `.`. |
| `--question-offset N` | Select the `audit` question page with a nonnegative integer; defaults to `0`. |
| `--request "reason"` | State the reason for an `accept` capture. |
| `--apply CHANGE` | Select the reviewed change for `accept` apply mode. |
| `--hash HASH` | Bind apply mode to the reviewed immutable plan. |
| `--json` | Emit exact machine results. |
| `--help` | Print help. |
| `--access` | Select operation-access recovery with `recover`. |
| `--representations` | Inspect pending representation publications or explicitly recover them. |

For the machine integration request envelope, operation schemas, and lifecycle details, read the [operation contract](../../plugins/projector-v3/references/operation-contract.md).

Continue with [Getting started](../getting-started.md) or [Review, reconcile, and recover](../review-reconcile-recover.md).
