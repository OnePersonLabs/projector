# OPL Projector -- V5

Projector helps an agent recover the reason for a change, find its current implementations, and compare selected behavior with that meaning. The native harness still runs the work and coordinates agents. The plugin stores readable meaning and offers optional evidence and recovery helpers.

The original vocabulary has work to do:

| Term | Purpose |
| --- | --- |
| Concept | A stable idea, its conditions, reasons, exceptions, and reopening assumptions. |
| Typed Relation | A named connection, marked as observed or accepted. |
| Projection Unit | A current source participant discovered through a Lens. Several Units can realize one Concept. |
| Projection Lens | Discovery and checks for particular conditions and participants. |
| Pattern Candidate | A possible reusable approach with examples, counterexamples, and alternatives. |

Meaning lives in `.projector/meaning/` as Markdown with YAML frontmatter. A directive can keep a concise checkpoint in `.projector/work/`. Checks and discovery use disposable caches. Meaning and native application code remain usable after removing the plugin.

## Use it in a project

In a fresh Codex session with the plugin installed, say **"Enable Projector in this project."** The agent uses `$opl-projector:enable-projector` to create `.projector/active`. Then describe work normally. The agent selects the relevant skills and prepares helper requests; you do not need to remember a workflow or command names.

Say **"Turn Projector off in this project"** to remove the marker. Meaning and recovery records remain. Inactive projects receive no hook guidance or runtime observations. A nested Git repository needs its own activation.

Rollback restores saved bytes from one owned repair when the current bytes still match that repair's output. It refuses to overwrite unrelated edits. It does not rewind the repository or undo ordinary native work.

## Try the helper

Use Node.js 24 or newer. From this workspace:

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run setup:plugin
node plugins/opl-projector/runtime/cli.mjs activate --root examples/clip
node plugins/opl-projector/runtime/cli.mjs checkpoint --root examples/clip --request examples/clip/requests/checkpoint.json
node plugins/opl-projector/runtime/cli.mjs focus --root examples/clip --request examples/clip/requests/focus.json
node plugins/opl-projector/runtime/cli.mjs revisit --root examples/clip --request examples/clip/requests/focus.json
node plugins/opl-projector/runtime/cli.mjs reconcile --root examples/clip --request examples/clip/requests/reconcile.json
```

The last request explicitly runs native checks. The clip example requires Python and `rustc` for its persistence and Rust checks. It also includes frontend and C# subjects whose runtime behavior needs separate evidence. An unresolved result can therefore be the correct outcome.

Use `focus` to retrieve selected meaning, `revisit` to refresh discovery, and `reconcile` to collect scoped verdicts. Provider requests are explicit. A normal context request does not start a compiler or install a language server.

The CLI also provides `observe`, `checkpoint`, `resume`, `close`, and `repair`. Results are JSON. Reconciliation exits with `0` for supported results, `1` for a mismatch, and `2` for unresolved evidence or an error. Native checks run without a shell. See [the reference guide](plugins/opl-projector/references/guide.md) for request formats, coverage declarations, provider setup, and owned-output repair.

## Plugin contents

The plugin is in [plugins/opl-projector](plugins/opl-projector). It contains project-scoped hook guidance and four skills:

- `$opl-projector:enable-projector`: enable, disable, or inspect activation in a project.
- `$opl-projector:recover-meaning`: recover the authority, current participants, and relevant uncertainty.
- `$opl-projector:carry-out-directive`: carry out native work with explicit ownership and useful recovery state.
- `$opl-projector:reconcile-and-learn`: investigate discrepancies and retain learning that could change future action.

Create a portable package with `npm.cmd run pack:plugin` after `setup:plugin`. The plugin's own lockfile and dependency directory supply the bundled runtime. The root package supplies test tooling. Unpack the archive and use its `package` directory as the plugin root. Its CLI is `runtime/cli.mjs`. The local marketplace uses a prepared bundle under `.plugin-build/opl-projector`. `$opl:refresh-local-plugins` runs `plugin:prepare-local`, then installs and enables `opl-projector@opl-projector` and trusts its hooks in reachable Windows and WSL user homes. Preparation requires Node.js 24+, npm, and `tar`. Use the source checkout for this workflow. A raw GitHub marketplace checkout needs this preparation before its plugin source is installable.

## Language evidence

| Subject | Available observation route | Scope of verification |
| --- | --- | --- |
| JS, TS, JSX, TSX | Explicit LSP server; native checks | Protocol tests, clip JavaScript runtime checks, and real TS/TSX navigation with a version-provenance gap. |
| Python, Rust, C# | Explicit LSP server; native checks | Real Python navigation and Rust symbols; clip Python/Rust runtime checks. C# runtime unrun here because no .NET SDK is installed. |
| HTML | Packaged HTML language service | Document symbols and local reference highlights. HTML diagnostics are an explicit gap. |
| CSS, SCSS | Packaged CSS language service | Symbols, definitions, references, and diagnostics. |
| Tauri, NativeScript, React Native | Source/message discovery and native checks | Example seams; full framework integration remains unverified. |
| Source-bound imported facts | Explicit JSON index import | Current source bindings and fact scope are checked. |

LSP navigation does not establish a complete cross-language graph. The provider reports its capabilities, source inputs, and gaps. Static observations cannot establish runtime delivery or timing. New consumers require applicable check coverage before they receive support.

## Development

```powershell
npm.cmd test
```

The deterministic tests cover scoped evidence, cache invalidation, discovery changes, native checks, provider failures, repair recovery, project activation, and the [shared Clip example](examples/clip/README.md). They make no AI calls. The [approved plan](docs/approved-plan.md) records the design and approval boundaries; [implementation interfaces](docs/interfaces.md) describe the data contracts. The [implementation report](docs/implementation-report.md) records verification and remaining gaps. The verified archive is [dist/opl-projector-0.1.0.tgz](dist/opl-projector-0.1.0.tgz).

V5 is an experiment in adaptive convergence. Its maintenance cost and benefit on Psychord still need evidence from use. If a Lens costs more than it helps, revise or suspend that mechanism while continuing native development.
