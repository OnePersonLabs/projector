# Projector operations

The installed `scripts/projector.mjs` exposes `init`, `context`, `check`, `integration`, `audit`, `accept`, `resume`, `inspect`, `recover`, `verify`, `generate` and `evaluate`. Run `--help` for arguments. Default output is readable meaning and findings; `--json` exposes the service result. Node 24 or later is the host runtime. No repository-specific package manager is needed.

## Meaning and normal changes

Retrieve task context, accept intended meaning changes when authorized, make authorized edits with Codex, and check the retained context afterward. The [main workflow](../skills/projector/SKILL.md) covers planning, acceptance and implementation. [Verification](../skills/projector-verify/SKILL.md) reviews the actual change against the model and follows the [shared test procedure](verification-procedure.md). Typed relationships and source-query membership help find consequences outside the edited file. Read selected meaning and unknowns; lexical matches do not establish applicability. A changed assumption, new consumer, actual violation and unavailable observation have different consequences.

Compact `context` output identifies omitted records and, for a persisted context, gives a `retainedEvidence` route. `inspect knowledge_context_...` invokes `context.inspect` on that authenticated saved context. It returns a document skeleton and ordered JSON Pointer records. Large strings are split into Unicode-safe text records with offsets; append them in order to reconstruct the saved value. Use `--limit N` (1--100, default 20) and repeat with `--cursor` set to `nextCursor` until no cursor remains. The page also targets a small response size and gives exact total, included, omitted and offset counts. The cursor is bound to the context ID and content hash. `inspect ID --full` exports the exact retained context in one response and cannot use paging options. Inspection reports `retained-only` currentness: use `check CONTEXT` or `reconcile` for current repository state. `context "task" --full` compiles a new complete context and may have a different identity. Read authored source sections with ordinary file tools.

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

`accept proposal.json` captures and plans, then returns a preview and immutable hash. It mutates the capture store, so do not use it for read-only discussion in native Codex Plan mode. Use the [strict proposal guide](proposal-schema.md) and [generated schema](change-proposal.schema.json) when executing an authorized meaning change. `accept --apply CHANGE --hash HASH` approves and applies that exact current plan. Review all affected meaning, scope, assumptions, obligations and blocking questions before applying. A changed proposal is a new capture. Approval never transfers automatically.

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

The typed retained detail request is `context.inspect` with `{ "contextId": "knowledge_context_..." }`, optional `cursor`, and optional `limit`. Its first result contains `document`; every result contains `records`, `offset`, `disclosure`, and optional `nextCursor`. A text record has `path`, `text`, `textOffset`, and `last`; other records have `path` and `value`. Set `view: "full"` without paging options to return the exact saved context. The saved context may be evicted under the disposable cache policy; inspection then fails explicitly and requires a new context. Reconciliation checks currentness separately. Direct `context` and `reconcile` full views remain available without a fixed transport byte ceiling.

The installed `.mcp.json` starts `scripts/projector-mcp.mjs` as a resident stdio host. Each Core operation with a registered input schema appears as `projector_<operation>` with periods and hyphens replaced by underscores. For example, `projector_repository_check` accepts `repositoryRoot`, `input`, and optional `observationLimits` and `requestId`; the tool fixes `apiVersion` and `operation`. Its structured result is the same versioned operation result as the machine entry. Initialization and tool discovery do not require repository observation. One connection reuses its runner and idle computation workers, while each call retains its own Core validation, cancellation, readiness, access, resource accounting, and any caller-requested limits. Read-only, build or test, and mutation annotations describe effects; they do not grant authorization.

`projector code index request.json` creates a source-bound code generation from the request's provider and input binding. In a resident MCP connection, `projector_code_index` returns a run ID while work continues; use `projector_code_index_status`, `projector_code_index_wait`, or `projector_code_index_cancel` with that exact ID. The one-shot CLI waits for its index run to finish before exiting. `projector code query|impact|tests|evidence|export request.json` forwards each exact JSON input to the corresponding Core operation. `projector code test-run request.json` runs one explicitly named Vitest case with isolated JSON and V8 coverage artifacts and imports verified per-test evidence; it does not replace repository verification. Derived code facts and runtime evidence remain separate from accepted authored meaning; a pinned query reports its historical generation, while a current query checks live inputs before using or refreshing an index.

`code.tests` returns `complete` and may return `nextCursor`. Pass that cursor with the same generation and path filter to read the next retained-evidence page. A cursor becomes invalid if retained evidence changes. A test may appear on multiple pages; merge its `reasons` and `evidenceIds` by `testId`. `complete: false` without a cursor means that semantic discovery or another stated uncertainty remains open. `code.export` returns inline `content` for small graphs. Set `artifactName` to a filename when the graph exceeds the inline `maxBytes` allowance; Projector writes a complete artifact in its derived code export directory and returns its path, byte count, and SHA-256 hash. GraphML artifacts include nodes before edges and retain unresolved endpoints.

Code provider capabilities depend on language and evidence source:

| Source language | Native TypeScript provider | Bundled syntax provider | Imported semantic evidence |
| --- | --- | --- | --- |
| TypeScript, TSX, JavaScript, JSX | Available with resolved project relationships when configuration and inputs bind | Partial declarations; resolved references, calls, imports, types, and implementations unavailable | SCIP when an external producer supplies a bound artifact |
| Python, Go, Rust, Java, C#, C, C++, Scala | Unavailable | Partial declarations; resolved relationships unavailable | SCIP or SemanticDB only when a compatible external producer supplies a bound artifact |
| Kotlin, Ruby, PHP, Swift, and other languages | Unavailable | Unavailable in this build | SCIP or SemanticDB only when a compatible external producer supplies a bound artifact |

`code.index` reports provider and per-document coverage. A syntax generation does not imply resolved cross-file relationships. Imported facts carry their producer, artifact, and source binding; a toolchain listed as requiring configuration is not installed by Projector.

Projector repository observation, semantic indexing, verification, and generation have no
implicit execution timeout, repository-count ceiling, source-byte ceiling, or
derived-data capacity ceiling. `null` means no caller-imposed limit. To constrain
an operation explicitly, use the global CLI option `--timeout-ms N` or
`observationLimits: { "timeoutMs": N }`. Other fields in `observationLimits`
constrain file counts, directory counts, source bytes, derived bytes, or worker
heap only when supplied. A CLI command that invokes several operations applies
its explicit override to each operation. Cancellation, source-currentness,
authorization, and atomic publication checks always apply.

Source capture streams raw bytes into immutable chunked versions in the
observation database. Inventory records reference these versions; they do not
embed file contents as JSON. Workers read exact captured versions lazily, and
unchanged files reuse existing versions after currentness verification. A final
hash-only scan checks live membership and bytes without writing another capture.
Without a trustworthy filesystem change journal, a warm currentness check still
reads the selected files. macOS uses the complete scan because Watchman's
FSEvents cookie ordering cannot establish this freshness guarantee. A repeatedly
unsynchronized Watchman backend also requires the complete scan.

Source versions are collected automatically when no capture owns them. Each
capture producer and worker reader holds a shared operating-system lock in a
separate SQLite activity database. Collection takes its exclusive lock before
removing abandoned captures and versions absent from the published inventory.
It runs when the observation store opens, before capture creation, and after
capture release. An active capture delays collection; it has no age deadline.
Process termination releases the activity locks without a shutdown callback.
After a process or computer crash, the next repository access retries cleanup
of abandoned source rows and owned temporary analysis files. Collection stays
outside the atomic publication transaction. SQLite can reuse the freed database
pages; deleting old versions does not necessarily reduce the database file's
allocated length.

The semantic database stores symbols, edges, paths, identities, and provenance
in indexed columns. Provider contributions use an intermediate spool for ordered
merging. Completed partitions enter their final typed tables before publication;
an unpublished stage references those immutable versions. Unchanged partition
digests reuse existing rows. Publication verifies the source binding and writer
token, then atomically inserts generation membership and replaces the head.
It does not copy all facts or prune old generations inside that transaction.
Both observation and semantic databases use SQLite WAL, with one writer at a time.

Readers use one complete generation. A default current query first checks that
its generation matches the checkout observed for that request. A detected change
requires refresh; the query does not silently return the old generation as
current. An edit after that freshness barrier does not change the snapshot
already being queried. Pinned queries explicitly select historical generations.
Database locks do not prevent external source edits. Complete source bindings,
including membership and dependencies, determine whether facts may be reused.

Worker admission accounts for available host memory. These controls
limit concurrent working sets; they do not reject a repository at a fixed size.
Compiler programs still need project-wide state, and actual host resource
exhaustion produces an error while preserving the previous completed generation.

The harness controls MCP startup and response deadlines separately. The bundled
Codex manifest requests a 3600-second tool response timeout. That timeout does
not bound a retained index run: use its run ID for status, wait, or cancellation.
Synchronous operations remain subject to the harness response deadline; use the
direct CLI when they need to run beyond that deadline.

`code.index-wait` waits at most the requested polling interval, then returns the
current run state. Ending that wait does not cancel indexing. Use
`code.index-cancel` for explicit cancellation. A resident host shutdown cancels
its owned runs; incomplete stages cannot become a current generation.

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
`inputPaths`, `populations`, and `environment`. Optional fields are
`timeoutMs`, `sourcePath`, and `completeInputs`; unknown fields are rejected. The executable
must be an absolute path. If `sourcePath` is set, it must also be in
`inputPaths`, and the service passes its resolved path as the first process
argument. Each population has `directory` and boolean `recursive`.
`inputPaths` contains at least one path. `timeoutMs` may be a positive safe
integer or `null`; omission selects `null`. Input populations, file sizes, and
executable sizes have no implicit capacity cutoff.
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
`environment` and `populations`; `timeoutMs` and `completeInputs` are optional.
Unknown fields are rejected. `sourcePath` must be a canonical repository-relative
entrypoint. The service inserts its resolved absolute path as the first argument
and includes it in observed inputs. Each output requires a canonical `path` and
`ownership` (`retained` or `disposable`). Output paths must be unique and separate
from inputs. Outputs cannot target `.projector` or `.git`, including case aliases.
`outputs` contains at least one item. Input and output populations have no
implicit count ceiling.
Generation uses the existing worktree writer lease. Its preparation reservation
binds the request and output scope. Before launch, the immutable local intent
binds the generation ID to actual input and pre-execution output observations.
Another governed writer in the same checkout prevents launch. Lease loss cancels
the owned process. Different checkouts remain independent. Evidence inspection
and publication-only recovery do not acquire a source-write lease. The lease
does not grant canonical mutation authority or process confinement.
`timeoutMs` may be a positive safe integer or `null`; omission selects `null`.
Use argument arrays, not shell command strings.

Include every relevant runtime, source, fixture, configuration and population
dependency. Set `completeInputs: true` to declare input coverage, while treating
that declaration as unverified. Relevant populations include empty directories.
Paths use `/` separators and cannot include `.projector/runtime`; selected
populations must be existing directories. Input, executable, and output sizes
have no implicit byte ceiling. Output hashing streams file contents. On Windows,
the launcher also
passes and hashes available `SystemRoot`, `WINDIR`, `PATH`, `PATHEXT`, `TEMP` and
`TMP` values. Native execution uses configured host permissions and does not
prove exclusive causation or execution confinement.

`generate --inspect producers.json` and `generate --recover producers.json` take a
strict object containing only `activeProducerIds`, an array of
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
