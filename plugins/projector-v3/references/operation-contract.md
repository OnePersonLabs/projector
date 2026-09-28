# Projector operations

The installed `scripts/projector.mjs` exposes `init`, `context`, `check`, `integration`, `audit`, `accept`, `resume`, `inspect`, `recover`, `verify`, `generate` and `evaluate`. Run `--help` for arguments. Default output is readable meaning and findings; `--json` exposes the service result. Node 24 or later is the host runtime. No repository-specific package manager is needed.

## Meaning and normal changes

Retrieve task context, make authorized edits with Codex, and check the retained context afterward. Typed relationships and source-query membership help find consequences outside the edited file. Read selected meaning and unknowns; lexical matches do not establish applicability. A changed assumption, new consumer, actual violation and unavailable observation have different consequences.

Canonical prose has one Markdown owner with typed TOML metadata. Relations and executable policies remain TOML. The parser normalizes these records into Core contracts. Stable identity is independent of the readable filename. Exact authored bytes remain bound for replacement and recovery; formatting equivalence cannot authorize a different write.

`audit` uses the existing cleanup operation to report scoped coverage, unresolved accepted work and ordered repair recommendations. It may inspect a retained context with `--context`. It performs no source or canonical writes and does not execute repairs. Runtime observation artifacts remain owned by the existing services. Read question and evidence omissions before treating a page as complete; an unavailable check is not an observed violation.

## Acceptance and recovery

For ordinary Git integration, use `integration --target REF --incoming REF`
with optional `--base REF` and `--result REF`. The corresponding
`repository.integration` input is `{ "target": "REF", "incoming": "REF" }`
with optional `base` and `result` strings. No candidate ID or surviving source
checkout is required. Supply the actual provider or ordinary merge result when
available; otherwise the command calculates a proposed merge from committed
inputs. Git may store immutable objects, but refs, the index, and working files
are preserved. Unsupported custom merge configuration requires `--result`.

Read retained, altered, and lost contributions from both sides. Check the
canonical validation scope in the report and its verification gaps. Conflicts, invalid records,
altered/lost contributions, or static governance with `failed` or `incomplete`
status produce CLI exit code 6. A successful operation envelope or CLI exit code
0 does not establish behavioral verification, full governance, independent
review, or permission to merge. The operation never transfers source-session
approvals.

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

The default observation timeout is 60,000 milliseconds. Use the global CLI option
`--timeout-ms N`, or the request field
`observationLimits: { "timeoutMs": N }`, to select a positive, finite timeout.
A CLI command that invokes several operations applies the value to each one. The
override changes elapsed-time allowance only. It does not remove byte, inventory,
cancellation, freshness or authorization checks. See `$projector` for the choice
between targeted optimization and a longer bounded observation.

Full lifecycle operations remain available for integrations: `change.capture`, `change.plan`, `change.approve`, `change.apply`, and `change.recover`. Representation inspection distinguishes artifact integrity, dependency freshness, semantic fidelity and execution authorization. Hash agreement establishes byte or normalized-value agreement, not truth or agent understanding.

`representation.pending` inspects publication journals. `representation.recover`
explicitly recovers exact staged bytes and reports capture status. Neither
operation grants capture or mutation authority. `architecture.evaluate` evaluates
candidate options against canonical concerns and preferences; it cannot accept
the result as canonical meaning.

### Native verification and generation

`verify check.json` parses a strict `VerificationRequestSchema` object.
It passes that object to `verification.execute`. Required fields are
`executable`, `args`,
`inputPaths`, `populations`, `environment`, and `timeoutMs`. Optional fields are
`sourcePath` and `completeInputs`; unknown fields are rejected. The executable
must be an absolute path. If `sourcePath` is set, it must also be in
`inputPaths`, and the service passes its resolved path as the first process
argument. Each population has `directory` and boolean `recursive`.
`inputPaths` contains 1--10,000 paths. `args` has at most 1,024 entries.
`populations` has at most 128 entries. `environment` has at most 256 names.
`timeoutMs` is positive and at most 300,000. Each input file is limited to 8 MiB;
the snapshot is limited to 64 MiB. The executable is limited to 256 MiB.
Input paths must be canonical and cannot include `.projector/runtime`.
A selected population must be an existing directory.
Use `{ "directory": ".", "recursive": false }` for root files. Recursive `.`
or `.projector` populations are refused because they include runtime evidence
created by the operation. Declare narrower source directories instead.

Use `completeInputs: true` to declare coverage of relevant inputs and
populations. This is a declaration only. Native execution does not prove
hermeticity or discover every dynamic read. It cannot detect transient input
changes that occur and disappear during execution. It does not establish
reusable evidence. Include source, tests, fixtures, configuration, tools, and
any other relevant files.
Declare relevant directory populations even when empty. Selected environment
values are hashed; they are not stored in the request. On Windows, the launcher
also passes and hashes available `SystemRoot`, `WINDIR`, `PATH`, `PATHEXT`,
`TEMP` and `TMP` values. Projector does not confine this native process.
Configured host permissions apply.

`verify --inspect [EVENT]` invokes `verification.inspect`; its input is either an
empty object or `{ "eventIds": ["EVENT"] }`. Inspection reads historical
records and pending publications without running the check. `verify --recover`
invokes `verification.recover` with an empty input object. It finalizes complete
saved manifests, then inspects and retains records. It does not rerun the
process. Missing staging evidence stays unresolved. Verification assessment
reports `reusable: false` even when declared inputs match.

The host may set `PROJECTOR_VERIFICATION_EVIDENCE_STORE` to an absolute path.
The operation retains complete immutable verification and generation records
there. Publication journals remain local under `.projector/runtime`. Historical
records in the host store can be inspected after the source checkout is gone.

`generate generation.json` calls `generated.execute`.
Its input object has a single `generation` property. That property follows the
strict `GeneratedOutputRequestSchema`. Required fields are
`producerId`, `executable`, `sourcePath`, `args`, `inputPaths`, `outputs`,
`environment`, `timeoutMs`, and `populations`; `completeInputs` is optional.
Unknown fields are rejected. `sourcePath` must be a canonical repository-relative
entrypoint. The service inserts its resolved absolute path as the first argument
and includes it in observed inputs. Each output requires a canonical `path` and
`ownership` (`retained` or `disposable`). Output paths must be unique and separate
from inputs. Outputs cannot target `.projector` or `.git`, including case aliases.
`args` has at most 1,024 entries. The combined `inputPaths` and
`sourcePath` set has at most 10,000 unique paths. `outputs` has 1--10,000 items.
Generation uses the existing worktree writer lease. Its preparation reservation
binds the request and output scope. Before launch, the immutable local intent
binds the generation ID to actual input and pre-execution output observations.
Another governed writer in the same checkout prevents launch. Lease loss cancels
the owned process. Different checkouts remain independent. Evidence inspection
and publication-only recovery do not acquire a source-write lease. The lease
does not grant canonical mutation authority or process confinement.
`populations` has at most 128 items. `environment` has at most 256 names.
`timeoutMs` is positive and at most 300,000. Use argument arrays, not shell
command strings.

Include every relevant runtime, source, fixture, configuration and population
dependency. Set `completeInputs: true` to declare input coverage, while treating
that declaration as unverified. Relevant populations include empty directories.
Paths use `/` separators and cannot include `.projector/runtime`; selected
populations must be existing directories. Input files are limited to 8 MiB each
and 64 MiB total. The executable is limited to 256 MiB. Declared output files
and the complete output set are limited to 64 MiB. On Windows, the launcher also
passes and hashes available `SystemRoot`, `WINDIR`, `PATH`, `PATHEXT`, `TEMP` and
`TMP` values. Native execution uses configured host permissions and does not
prove exclusive causation or execution confinement.

`generate --inspect producers.json` and `generate --recover producers.json` take a
strict object containing only `activeProducerIds`, an array of at most 10,000
nonempty producer IDs. An empty array treats all observed producers as retired.
They invoke `generated.inspect` and `generated.recover`, respectively, whose
inputs contain only `activeProducerIds`. Inspection reports history, currentness,
reason, output ownership and disposition, plus pending publications. It keeps
historical records when a producer or input is unavailable. It returns
`current: false` with a reason that names unavailable current inputs. It does not
run producers or delete output files.
Retained and disposable labels do not grant deletion authority. Recovery
finalizes saved evidence without rerunning the producer; it cannot reconstruct
missing staging data. If recovery joins a completed native execution to an
interrupted generation intent, it observes outputs at recovery time and records
`afterObservation: "recovery"`. This evidence is never current because the
immediate post-execution association is unavailable. Normal execution records
`afterObservation: "immediate"`.

Only a nested `check.status` of `passed` records a successful execution with
matching pre/post input snapshots. A completed non-passing verify or generation
execution returns CLI exit code 6. Operation errors have their own nonzero
result. Historical inspection is not an execution or correctness claim; review
`current`, `reason`, and pending publication state. Neither current generation
evidence nor output ownership grants semantic acceptance, publication or merge
authority.

Controlled code execution requires authenticated exact patch input, bounded
write scope, current dependencies, and independent validators available at the
Git base. A proposed validator cannot certify its own independence. Ordinary
Codex edits use host authorization and verification. They do not receive the
transaction guarantee for Projector-controlled writes.

Read [harness-guide.md](harness-guide.md) for service ownership and custom
integration. Read the relevant skill reference for canonical authoring. Keep
application-specific observation code and test harnesses outside the general
runtime.
