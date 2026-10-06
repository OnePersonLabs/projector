# Projector reference

Use [Applying Projector](applying-projector.md) to turn meaning, participant selection, and evidence into implementation decisions and maintain affected Lenses. This guide owns artifact syntax and helper operation details.

## Activation

The plugin runs only in projects with a `.projector/active` file. Use `$opl-projector:enable-projector` for explicit activation changes. The agent selects the other skills and prepares helper requests from ordinary directives. The user does not need runtime command names.

Hooks search from the working directory to the nearest Git boundary. An active ancestor supplies the project root within that boundary. A nested Git repository cannot inherit the parent's activation. Runtime entrypoints return `inactive` before reading meaning or writing Projector state when no marker applies. A disable request removes only the marker; it preserves meaning and recovery records.

## Authority and storage

Store authored Markdown with YAML frontmatter under `.projector/meaning/`. The loader reads nested directories and excludes archives from default discovery. Concepts, typed Relations, Projection Units, Pattern Candidates, and Projection Lenses supply navigation and scoped evidence. Authoritative meaning remains usable without this plugin.

Every meaning file has `id`, `kind` (`concept`, `lens`, or `pattern`), `title`, and `status` (`accepted`, `candidate`, or `retired`). Put reasons, exceptions, examples, alternatives, and reopening assumptions in the Markdown body. Keep summaries linked to these files.

Concept `conditions` contain `id`, `text`, `evidence` (`runtime` or `static`), and optional `allowsAbsence`. Typed `relations` contain `type`, `target`, and `status` (`observed` or `accepted`). Pattern Candidates contain `concepts`, `examples`, `counterexamples`, `alternatives`, and optional `lens`. Set a Pattern to `accepted` only through an explicit meaning decision.

## Projection Lenses

A Lens names conditions as `concept-id#condition-id`. A selector contains `id`, project-relative glob `patterns`, optional `role`. Select the relevant population independently of the property under test.

Each check has `id`, `command`, `args`, `selectors`, `conditions`, and `evidence`. Optional fields are `target`, additional input glob `inputs`, and `env`. Commands execute without a shell. Pass arguments separately. Name a real executable available to the native host.

Declare `coverage` as the explicit participant paths that the command tests. Use `coverage: selection` only when the command evaluates every current selected participant. Wildcard selection does not make a check cover every discovered file. Without `coverage`, only literal selector paths establish coverage. A new consumer stays unresolved until a check covers it.

```yaml
---
id: playback
kind: lens
title: Playback keeps source notes
status: accepted
conditions: [clip#playback-isolation]
selectors:
  - id: playback-source
    patterns: [js/*.mjs]
    role: playback
checks:
  - id: playback-check
    command: node
    args: [checks/playback.mjs]
    selectors: [playback-source]
    conditions: [clip#playback-isolation]
    evidence: runtime
    coverage: [js/playback.mjs, js/export.mjs]
    inputs: [checks/playback.mjs, shared/clip.json]
---
```

Every verdict names condition, selector or participants, selection status, evidence, status (`supported`, `mismatch`, or `unresolved`), and reason. Required empty selection is unresolved unless the condition allows absence. A successful scoped check does not establish unobserved language behavior. Preserve supported evidence when another observation fails.

A Lens with `checks: []` supplies navigation without behavioral support. Helper verdicts cover named conditions, not every requirement in a Concept's prose. Keep relevant prose obligations and independent native evidence visible in the existing plan or checkpoint. See [Lens maintenance](applying-projector.md#maintain-affected-lenses) for selector, binding, and evidence upkeep.

Projection Units bind meaning to participants discovered by a Lens. Treat a binding as current only when its source and membership snapshots still match. Use `revisit` after source changes or new consumers. Do not treat an inventory match as resolved cross-language semantics.

The helper returns file-based Units. They can represent coordinated functions, components, styles, or protocol declarations. Use provider symbol and location facts to investigate finer subjects within those files. Participation identifies a place to investigate; it does not establish that every symbol in the file implements the Concept.

## CLI and helper requests

The installed package needs Node.js 24 and its declared npm runtime dependencies. Resolve `PLUGIN_ROOT` from the actual installed plugin location. Runtime is packaged inside the plugin; do not resolve another Projector version or assume a workspace checkout.

```text
node PLUGIN_ROOT/runtime/cli.mjs focus --root PROJECT --request REQUEST.json
```

The CLI accepts `activate`, `deactivate`, `status`, `focus`, `revisit`, `reconcile`, `checkpoint`, `resume`, `close`, `repair`, and `observe`. Request paths identify JSON files. Use absolute project and request paths when the current directory differs. `focus`, `revisit`, and `reconcile` accept selective `concepts`, `lenses`, `paths`, `query`, and `work`. `reconcile` runs native checks only with `runChecks: true`; otherwise it reuses applicable receipts. The helper does not install providers or build an implicit semantic index.

```json
{"concepts":["clip"],"lenses":["clip-playback"],"work":"clip-export","runChecks":true}
```

ESM callers can import `focus`, `revisit`, and `reconcile` from `PLUGIN_ROOT/runtime/projector.mjs` and pass `(root, request)`. Checkpoint helpers are `writeCheckpoint(root, request)`, `resume(root, id)`, and `closeCheckpoint(root, id)`. CLI resume and close requests use `{"id":"clip-export"}`.

`focus` returns compact checkpoint context when `work` is selected. CLI
`checkpoint` and `resume` also return compact context. It includes open questions,
uncertain mutation identities, evidence counts, and the saved record path.
Resume also reports changed paths and repair-record pointers. Detailed source
inventories, verdict participants, narrative, and recovery bytes remain in the
saved records. Read relevant fields when needed; this summary is navigation,
not sufficient evidence for acceptance or mutation.

Set `includeWorkDetails: true` in these requests only when the full record is
needed. Direct ESM checkpoint and resume APIs retain their full results for
programmatic consumers. Select the required fields before sending them to an
agent. SessionStart loads full consumer guidance; UserPromptSubmit checks
activation and gives a short reminder with a bootstrap pointer.

`focus.paths` matches exact project-relative files in discovered Lens populations; it is not a glob or general source search. `focus.related` returns pointers, including outgoing Relation endpoints, not all incoming Relations or a transitive impact closure. Use the [bounded incoming-Relation search](applying-projector.md#recover-the-governing-meaning) when governing constraints or dependents matter.

With `work`, `revisit` observes the checkpoint's declared discovery boundaries. Request `paths` add boundary patterns for this observation. Changed paths inside those boundaries but outside current Lens selection become discovery questions. Unchanged consumers and files outside declared boundaries are not automatically discovered. A literal `query` searches selected source and these boundaries. Declared Lens observations run on demand. Ordinary `focus` does not run them. Refreshing selection does not repair an incomplete authored selector.

Check receipts bind relevant meaning/Lens records, declared input scope, check configuration, and execution dependencies. Changed membership or inputs can make a receipt unresolved. Do not silently backdate it; keep independently applicable native evidence separate. See [evidence reuse](applying-projector.md#compare-results-and-reassess-the-premise) for the distinction.

## Provider setup

An `observe` request selects `provider` (`inventory`, `lsp`, `html`, `css`, or `index`), `operation` (`symbols`, `definitions`, `references`, `diagnostics`, or `relationships`), and scoped `files` or `patterns`. Use zero-based `position: {line, character}` for navigation. Inventory can locate literal `text`, including framework names, but does not resolve semantics.

HTML and CSS providers use packaged language services. CSS supports CSS and SCSS, not indented `.sass`. LSP uses a server explicitly supplied by the repository; configure its executable `command` and separate `args`. Install and pin that server through the repository's normal tooling. Do not infer an available language server from a filename.

Run a scoped request through the native CLI, using the plugin location supplied by the activated hook:

```text
node <plugin-root>/runtime/cli.mjs observe --root <project-root> --request <request.json>
```

For an existing semantic index, supply `config.path`. The JSON artifact has `version: 1`, a nonempty `inputs` array of `{path, hash}` source bindings, and a `facts` array. Facts identify `kind` (`symbol`, `definition`, `reference`, `diagnostic`, or `relationship`), project-relative `path`, and native range. A fact with `target.path` also needs that target in `inputs`. Compute source hashes with the runtime `hash` helper. Stale or unbound facts are rejected with gaps. The index provider reads that artifact; it does not create it.

Use only operations supported by the selected provider. HTML supports symbols and document-local reference highlights. CSS supports symbols, definitions, references, and diagnostics. Results contain provider identity, operation, `complete`, `partial`, or `unavailable` status, facts, inputs, capabilities, gaps, and scope. Read capabilities and gaps before using a fact. LSP references are scoped navigation evidence, not a proof that every consumer was found. Changed source or discovery during analysis makes currentness unresolved.

Provider metadata separates `adapterVersion` from `engine.name` and `engine.version`. Direct services report their installed package version. LSP uses the server's initialization identity. A missing engine version remains an explicit provenance gap. `requestBinding` binds the operation, scope, position, configuration, and literal query. Index artifacts can identify their producer in `provider: {name, version}`. Read all gaps before reusing evidence.

### Native observations for Python, Rust, and TypeScript

Use the same candidate-navigation procedure for each language. Find the actual import, re-export, call, or callback registration in the scoped source. Query a definition at that usage and compare its target with the changed owner. A reference query can stop at an alias; an empty result does not prove that no consumer exists. See [discovery choices and limits](applying-projector.md#choose-deterministic-discovery-for-the-missing-fact).

Resolve executable paths from the repository's tooling. On Windows, use the actual executable, such as Node plus a JavaScript server entry, rather than a PowerShell shim. Keep executable arguments separate and use native filesystem paths for server-specific options. The examples below assume project-local packages where shown. Adjust paths, files, and zero-based positions to the inspected project; they do not install tools or establish compatibility.

**Python.** Inspect the actual interpreter/environment, `pyrightconfig.json` or `pyproject.toml`, package roots, imports, and stubs. Pyright's [configuration](https://github.com/microsoft/pyright/blob/main/docs/configuration.md) controls project selection and environment assumptions. This request selects a candidate at line 2, character 12:

```json
{
  "provider": "lsp", "operation": "definitions",
  "files": ["src/consumer.py"], "position": {"line": 2, "character": 12},
  "timeoutMs": 30000,
  "config": {"command": "node", "args": ["./node_modules/pyright/langserver.index.js", "--stdio"]}
}
```

Exercise the actual interpreter and project before reusing the result. With Pyright 1.1.414 and a Python 3.14 package, scoped definitions resolved aliased calls and callback values; references segmented across renamed bindings. Missing reported engine version and rejected external diagnostic paths remained explicit gaps. A file diagnostic notification is not a generic workspace-readiness contract. Dynamic imports, monkey-patching, environment changes, and uninspected stubs remain outside these examples.

**Rust.** Inspect the actual Cargo workspace or `rust-project.json`, target, enabled features, generated sources, build scripts, and procedural macros. This example uses an explicit [non-Cargo project](https://github.com/rust-lang/rust-analyzer/blob/master/docs/book/src/non_cargo_based_projects.md) and rust-analyzer's [persistent server-status notification](https://github.com/rust-lang/rust-analyzer/blob/master/docs/book/src/contributing/lsp-extensions.md):

```json
{
  "provider": "lsp", "operation": "definitions",
  "files": ["src/consumer.rs"], "position": {"line": 1, "character": 26},
  "timeoutMs": 30000,
  "config": {
    "command": "rust-analyzer", "args": [],
    "initializationOptions": {
      "linkedProjects": ["rust-project.json"], "checkOnSave": false,
      "cargo": {"buildScripts": {"enable": false}}, "procMacro": {"enable": false}
    },
    "experimentalCapabilities": {"serverStatusNotification": true},
    "readiness": {"notification": "experimental/serverStatus", "equals": {"health": "ok", "quiescent": true}}
  }
}
```

A small `no_std` crate with rust-analyzer 1.98.1 resolved the candidate definitions after its status matched. The cold request without that gate returned no definitions. Ready reference queries still missed aliased consumers. This fixture does not qualify Cargo projects, macros, feature combinations, generated code, or target-specific dependencies. Disabling those mechanisms in a real project that needs them leaves coverage incomplete; do not copy these settings to hide missing dependencies.

**TypeScript.** Inspect the installed package's actual entry points, `tsconfig.json`, module resolution, and generated/declaration inputs. A missing `tsserver.js` does not establish that semantic navigation is unavailable. TypeScript 7.0.2 supplies a [native LSP entry](https://github.com/microsoft/TypeScript/blob/v7.0.2/tsc/cmd/tsgo/main.go): resolve the native compiler executable from the installed package's launcher, set it as `config.command`, and use `config.args: ["--lsp", "--stdio"]`. Use the native executable directly, not a shell shim or a substituted TypeScript 6 compiler.

That native 7.0.2 route resolved an actual TypeScript call to its imported transport function through this CLI. The native server then exited with code 1 during shutdown; the observation retained `lsp-shutdown-failed` and remained partial. This establishes that scoped navigation route, not complete project qualification or clean shutdown for that server version.

For a project that instead uses a compatible classic compiler/server pair, inspect its `tsserver.js`. The language server's [configuration](https://github.com/typescript-language-server/typescript-language-server/blob/master/docs/configuration.md#tsserver-options) permits full semantic-server routing for short-lived observations:

```json
{
  "provider": "lsp", "operation": "definitions",
  "files": ["src/consumer.ts"], "position": {"line": 1, "character": 29},
  "timeoutMs": 30000,
  "config": {
    "command": "node", "args": ["./node_modules/typescript-language-server/lib/cli.mjs", "--stdio"],
    "initializationOptions": {"disableAutomaticTypingAcquisition": true, "tsserver": {"useSyntaxServer": "never"}}
  }
}
```

An explicit `tsserver.path`, when needed, must identify the compatible compiler in the host's native path form. Language-server 6.0.1 with TypeScript 6.0.3 resolved the exercised aliases; the default syntax-server routing had returned a sparse result during startup. That separate example does not qualify TypeScript 7. Disabled automatic type acquisition prevents downloads, and missing types remain a coverage limit. Missing reported engine version remains a provenance gap.

The three examples verify candidate identities, not complete dependencies. A stored callback's invocation may resolve only to its storage binding. Read the registration and dispatch contract. Cross-language messages, foreign-function calls, and subprocess/RPC boundaries need an explicit sender/schema/receiver trace in the existing evidence; no language server here establishes that edge.

### Optional LSP readiness contract

`config.experimentalCapabilities` supplies only initialize's `capabilities.experimental`; it cannot replace the adapter's existing capabilities. `config.readiness` names a server `notification` and a nonempty `equals` map of expected top-level primitive fields. Configure it only from an actual supported server contract. A gate requires an explicit positive `timeoutMs` resource budget; the examples' 30 seconds are not a required analysis duration or correctness threshold.

The handler is active before initialize. An early match remains observable until a later notification supersedes it. Before each semantic request, the latest observed parameters must match. Cancellation, failure, or the caller's same budget ends the wait and invokes existing child cleanup. No sleep, empty-result retry, or silent bypass is used. The optional result `readiness` includes the notification, expected fields, latest `observed` parameters, and `matched` or `unconfirmed` status. An unmet gate retains source facts and reports `lsp-readiness-unconfirmed`.

A matched persistent status is not correlated to a particular `didOpen` or source version. It does not prove complete project analysis or consumer discovery. Requests without a gate make no readiness claim. Operation-level `complete`, source currentness, and semantic completeness remain separate; `scope.semanticCompleteness` stays `unclaimed`.

V5 captures requested and returned source files, not every environment/configuration input used by a server. Preserve relevant uncaptured inputs with a separate native source/configuration snapshot before reuse. Source-bound index artifacts can include those dependencies explicitly. No example authorizes another compiler, tool installation, implicit repository-wide indexing, or a persistent service.

## Checkpoints and owned repair

Keep current decisions, assignments, unresolved risks, and next actions concise.
Replace superseded narrative status instead of appending a session diary.
Preserve intent, reasons, exceptions, original mismatches, and unresolved repair
evidence. Link detailed results and read them for a specific question.

The native root writes the shared checkpoint with `id`, `goal`, `concepts`, `lenses`, `ownership`, `boundaries`, `completed`, `questions`, and `uncertainMutations`. Each ownership entry has `owner` and explicit output `paths`. `boundaries` contains project-relative discovery globs for the source snapshot. Put narrative limits in optional `body`. Active checkpoints live at `.projector/work/ID.md`; closed checkpoints move to `.projector/work/archive/ID.md` and remain readable.

Resume compares recorded source and discovery with the checkout. Inspect uncertain mutations; never replay them automatically. Reconcile records an original mismatch before applying changed selector, checker, or condition interpretation.

Run a known producer through the native host and stage its output. Inspect the staged bytes. `repair(root, request)` accepts `mode` (`apply`, `inspect`, or `rollback`; default `apply`), `id`, `work`, `owner`, and `outputs`. Each output has `path`, `expectedHash`, and one of `content`, `fromFile`, or `delete: true`. Hashes use the runtime `hash` helper. A missing file has hash `null`.

```json
{"id":"publish-export","work":"clip-export","owner":"export-worker","outputs":[{"path":"published/clip-export.json","expectedHash":"CURRENT_CONTENT_HASH","fromFile":"staged/clip-export.json"}],"condition":"clip#playback-isolation","explanation":"Publish reviewed per-use export."}
```

Replace `CURRENT_CONTENT_HASH` with the current content hash before use. This is request syntax, not an executable fixture receipt. Only checkpoint-owned paths can change automatically. Repair saves before images and an attempt record before writes. Repeated identical attempts or prior-state recurrence stop that local strategy. Inspect actual state after interruption. Rollback changes only bytes that still match this attempt's postimage; unrelated edits remain intact.

Rollback preflights all outputs and records uncertainty before restoration. If restoration stops partway through, resume exposes the rollback record. Inspect output state and retry only the explicit recovery operation. Ownership checks compare physical files, including internal junction aliases.

## What hashes establish

Runtime hashes have defined consumers: reject stale provider facts, invalidate
inapplicable check results, detect source changes on resume, and refuse repair
or rollback against changed contents. They identify bytes within those checks.
They do not prove behavior, coverage, user intent, or human comprehension.
Repair remains cooperative; a hash comparison is not a lock against another
process changing a file afterward.

Use Git commits and scoped diffs for ordinary code review identity. An extra
snapshot or hash inventory needs a specific consumer and decision that Git or
existing runtime records cannot supply. Do not maintain duplicate manifests or
hash the evidence again merely to label it accepted. Backup or asset integrity
checks retain their own purpose and do not become application acceptance.

## Reviewable local commits

The execution skill owns commit judgment. The native root uses Git directly; Projector does not create a commit daemon or require a new work ledger. This policy applies only while the project is activated. More specific user and repository rules take precedence.

Choose a unit that explains one behavior, fix, or decision. For example, a protocol field change belongs with its producer, consumers, tests, and meaning. An unrelated presentation change belongs in another commit. A large change can remain one unit when splitting it would produce misleading or unusable intermediate states. Explain its dependencies and review order rather than inventing a size limit.

Before staging, wait for that unit's writers to finish. Independent workers can continue on disjoint surfaces. Coordinate ownership of the shared Git index and commit operation through the native root; do not add a Projector lock or scheduler. Inspect existing staged work and the current working diff. Paths alone do not distinguish task changes from another writer's edits in the same file.

Stage the exact owned paths or hunks for the unit. Include related checks and authored meaning when they explain the change. Exclude secrets, disposable caches, repair before images, and transient producer staging files. Include published generated outputs only when the repository expects them, with the source changes that explain them. Do not use blanket staging in a dirty shared checkout.

Inspect the full staged diff, not only its filenames or statistics. Confirm it contains the intended unit and no unrelated staged work. Confirm its source and check evidence still apply after integration. If the index or selected files change concurrently, inspect the new state before proceeding. When safe isolation is unavailable, preserve all edits and leave the unit uncommitted. Do not unstage another writer's work or commit it for convenience.

Use a message that describes the final change, its reason, relevant validation, and any important limitation. Commit with the repository's normal hooks. Do not use bypass flags for a pass. Inspect the resulting commit and remaining status. Record its ID and any uncommitted remainder in the existing handoff or useful checkpoint; do not duplicate Git history into a new ledger.

For resumed work, inspect current history, staged changes, and actual working changes before deciding whether a unit is already committed. Do not recreate a commit from a stale checkpoint. A rollback of an owned repair can become a new reviewed correction commit when appropriate; it does not reset repository history. Pushing, amending published commits, rebasing, resetting, and force-pushing require separate authorization.

## Convergence and maintenance

After two identical failed explanations or a return to an earlier output state, the helper stops that local automatic repair strategy. If accepted conditions conflict, the native root must stop repeating the affected repair and record the competing obligations. Continue independent work. Change approach or request the specific meaning decision.

Keep related behavior understandable together. The user must be able to follow
consequential behavior and detect a wrong assumption. Use concrete names, useful
interfaces, and nearby explanations of reasons and constraints. Investigate
large files for distinct reasons to change; splitting them into many small files
does not itself improve comprehension. If fixes repeatedly require additional
layers, revisit the premise. Do not enforce line-count, call-depth, or folder
quotas. Do not substitute an agent's readability judgment for human understanding.

Promote a Pattern only through an explicit meaning decision. Create or revise an explicitly scoped Lens, preserve applicability and counterexamples, and use evidence independent of that Lens's own repair. Repetition alone does not accept a Pattern.

Update meaning when the directive changes it. Retain friction only when it can change a plausible future action. Otherwise, close the checkpoint without a maintenance pass. Keep current meaning prominent; Git history can retain previous versions. Revise existing meaning before creating duplicate Concepts.

Distill routing, evidence lists, duplicate candidates, and checkpoints more freely than authority. Preserve conditions, exceptions, distinctive terms, reasons, and counterexamples. If a Lens becomes noisy or expensive, investigate its mechanism and revise or suspend it without silently weakening meaning. Native development and plain OpenSpec remain available.

Optional AI distillation experiments need explicit authorization. Use one bounded packet and one question about observed friction. Return proposals to the root. Do not schedule calls, recursively delegate, audit whole histories, or automatically promote candidates.

These cooperative integrity conventions are not a sandbox or a universal certificate. Use the native host's existing permission and review rules.
