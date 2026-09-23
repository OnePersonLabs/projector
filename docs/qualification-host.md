# Windows host qualification

Measured on 2026-09-22 with Node **24.19.0**, Windows **10.0.26200.0**, NTFS,
PowerShell **7.6.6**, Git **2.55.0.windows.5**, Codex CLI **0.155.1**, and OpenSpec
**1.13.1**. Projector package/runtime version is **4.0.0**. The installed MCP SDK
is **1.30.0**. These results qualify this Windows profile; other operating systems
and simultaneous Windows/WSL ownership remain unverified.

## Observation boundary

Working-current reads apply to an allocated Git candidate worktree with the
`acknowledged-batches` cooperating-writer contract. Enrollment checks the
allocation in the candidate's actual Git metadata. Initial enrollment requires
an independently inventoried checkpoint. Every participating writer acknowledges
its batch before editing. An unfinished batch returns pending without a current
payload. Unobserved writes require another checkpoint. Exact revision reads do
not claim to describe the latest arbitrary filesystem state.

An ordinary checkout, arbitrary external editor, detached shell writer, or
unconnected WSL writer is not automatically covered. This is a cooperative
workflow boundary, not an operating-system sandbox against another same-user
process. Host hooks are not used as the proof of currentness.

## Executed evidence

Run `npm run build`, followed by `node --test test/host.test.ts` and
`node --test test/host-installed.test.ts`. The first host suite passed five tests:

| Probe | Observed result |
| --- | --- |
| Sixteen concurrent exclusive loopback bind contenders | One owner; fifteen `EADDRINUSE` failures; exactly one dispatcher initialization |
| Transport controls | Missing/wrong credentials rejected; browser Origin rejected; incompatible handshake rejected; payload budget enforced; foreign endpoint rejected without selecting another port |
| Request admission | Sixty-four active operations admitted; excess operations and premature shutdown rejected without starting more work |
| Private Windows state directory | Exactly one explicit DACL entry for the current user, with inheritance disabled |
| SQLite worker | WAL enabled, committed row persisted, synchronous million-row query executed in worker while coordinator progressed |
| Real Git linked worktree | Canonical aliases agree; linked candidate has distinct Git directory and shared common Git directory |

The SQLite sample took **78.23 ms**, allowed **70,903** coordinator event-loop
turns, and left an **8,192-byte** database. Timing and event-loop counts are
observations, not thresholds or comparative performance claims.

The installed test copied the compiled runtime and plugin to a fresh directory
outside the source checkout and installed locked production dependencies with
`npm ci --omit=dev --ignore-scripts --no-audit --no-fund`. Its installation cache
was local to that disposable installation and removed afterward. The observed
installation was **55,731,133 bytes**, completed in **3.35 seconds**, and needed
no native addon compilation because SQLite is bundled with the pinned Node
runtime. Dependency downloads and the cold installation are real costs.

Two separate MCP SDK stdio client processes connected to that installed runtime
using native Windows paths and selected the same kernel identity. They observed:

1. Initial managed enrollment unavailable until checkpoint.
2. Checkpoint followed by a validated current read.
3. A partial source write inside an acknowledged batch returned pending.
4. Batch completion returned the final validated version.
5. Closing one relay left the shared owner and second client usable.
6. An unknown write interval made current unavailable while the exact original
   Git revision remained validated.
7. Installed reads preserved source context, explicit observation edges and
   ownership scope. A private dependency was denied while a read-only observation
   succeeded. A new Markdown owner produced a rebinding finding, and adoption
   required its exact candidate identity.

An identical warm query had these before/after counters:

| Counter | Before | After |
| --- | ---: | ---: |
| Source bytes read | 78 | 78 |
| Hash bytes | 78 | 78 |
| Parsed files / extractions | 2 / 2 | 2 / 2 |
| Dependency visits | 2 | 2 |
| Subprocesses | 7 | 7 |
| Published transactions | 2 | 2 |
| Database cache bytes | 49,152 | 49,152 |
| Model calls | 0 | 0 |
| Observation barriers | 7 | 8 |
| Response bytes | 4,832 | 6,442 |

The barrier and serialization costs remain counted. This installed observation
test is separate from full lifecycle and hosted clean-evolution acceptance.

Run `node --test test/host-lifecycle.test.ts` for the installed lifecycle. It
passed in **16.83 seconds** through two actual MCP clients: nested spec/design
target preparation, missing-applicability blocking, a reviewed plan, acknowledged
implementation edits, target revision preserving valid code, missing-evidence
blocking, a real controlled playback check, archive and candidate-branch
publication. The accepted main branch remained unchanged. A second finish and
resume returned the same publication with no candidate diff. Target revision,
evidence commands and finish invalidated managed observation before possible
writes. The fixture's review fields are explicitly simulated protocol inputs;
this does not claim independent semantic review or hosted clean-evolution
qualification.

The installed lifecycle regression also holds a real evidence subprocess at an
explicit TCP barrier. During that interval, a new managed writer is rejected and
checkpoint cannot qualify currentness. An already acknowledged writer similarly
blocks finish before publication. Once it completes, finish proceeds. Host
requests release their kernel exclusion leases in `finally`, including failures.

Nested installation also runs under `npm run check`. npm 12 treats inherited
`npm_config_allow_scripts` as a CLI policy and rejects it for project-scoped
installation, even when scripts are disabled. The installer removes only that
invocation-specific variable, retains authentication/proxy/user configuration,
and still supplies `--ignore-scripts` explicitly. This behavior was checked
against the installed npm `resolve-allow-scripts.js` implementation.

The complete `npm run check` run passed build, lint, and **53/53 tests** in this
profile. The test phase took **73.60 seconds**; both installation suites ran
inside that npm invocation.

An actual Windows archive-stage `Filename too long` result exposed a Git path
limit after the candidate had been sealed and its target archived. Internal Git
operations now receive `core.longPaths=true` per invocation on Windows; no user
Git configuration is changed. The same sealed, archived candidate resumed and
published after the correction. The regression exercises interruption and
recovery with an archive file path longer than 260 characters.

This correction does not remove every Git path limit. Extremely long worktree
metadata roots were observed to fail with `$GIT_DIR too big`; use a shorter
repository root for that failure.

The separate [hosted clean-evolution results](clean-evolution.md) and
[machine-readable evidence](evidence/clean-evolution.json) contain three passing
final pairs and six accepted candidates after two targeted repairs, across eight
native participant runs. Those participant results supply the independent
semantic evidence that the deterministic installed lifecycle fixture does not.

## Host and permission findings

The installed OPL 0.2.0 manifest was inspected read-only. Its compatibility
layout declares `skills`, `hooks`, and `mcpServers`; its MCP configuration uses
named server objects with `command`, `args`, and optional `env_vars`. Projector
now uses native Agent Plugins schema 1.0.0 with root `plugin.json`, `mcp.json`,
and `${PLUGIN_ROOT}` expansion. Actual Codex qualification exposed that the
legacy MCP launch left `${CLAUDE_PLUGIN_ROOT}` literal and failed its handshake;
the native manifest passed in the same host. See [Codex qualification](qualification-codex.md).
The lifecycle
tools are individual MCP operations, not an opaque command tool. Relay stdout
contains MCP protocol only. The relay uses SDK-supported protocol negotiation.

Official documentation confirms [stdio MCP command configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli),
[plugin manifest support and hook trust](https://developers.openai.com/plugins/build/plugins),
and [the limits of tool-hook coverage](https://learn.chatgpt.com/docs/hooks).
Some specialized/hosted tool paths bypass hooks; background hook completion is
not a synchronous mutation boundary. Plugin hook installation also does not
automatically grant trust. Projector therefore does not rely on hooks to enroll
an ordinary working tree. The SDK client tests do not assert that a user has
registered or trusted a plugin in an existing Codex desktop session; the separate
Codex qualification records supported installation and actual host discovery.

This machine's LocalAppData directory grants additional inherited access,
including a sandbox-users group. POSIX file modes do not provide the necessary
Windows credential privacy. Projector replaces the application directory DACL
with current-user-only access before writing credentials. The operation needs
ordinary ownership of the selected Projector home, not elevation. Nonempty
unrecognized directories are refused. Windows PowerShell's built-in .NET ACL
APIs avoid dependence on the caller's PowerShell module search path.

The endpoint is fixed for the configured user namespace; `PROJECTOR_PORT` is an
explicit override and never an occupied-port fallback. `PROJECTOR_HOME` selects
the private application state location. An immutable port setting in that home
rejects attempts to create a second owner on another port against the same state;
the setting is not a lifetime lock. Owners bind only `127.0.0.1`; losers do
not initialize databases. Authentication uses a 256-bit private credential and
a versioned handshake. Requests/results are bounded at 1 MiB; admission is
limited to 64 active requests and 128 sockets; startup and request deadlines are explicit.
Credentials are never included in logs or tool responses. Closing a client does
not stop the owner; explicit authenticated shutdown is provided for controlled
teardown. The deterministic runtime makes no model calls.
