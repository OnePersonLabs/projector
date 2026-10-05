# Projector reference

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

With `work`, `revisit` also refreshes the checkpoint's discovery boundaries. Request `paths` add boundaries for this observation. Changes outside current Lens selection become discovery questions. A literal `query` searches the selected source and these boundaries. Declared Lens observations run on demand. Ordinary `focus` does not run them.

## Provider setup

An `observe` request selects `provider` (`inventory`, `lsp`, `html`, `css`, or `index`), `operation` (`symbols`, `definitions`, `references`, `diagnostics`, or `relationships`), and scoped `files` or `patterns`. Use zero-based `position: {line, character}` for navigation. Inventory can locate literal `text`, including framework names, but does not resolve semantics.

HTML and CSS providers use packaged language services. CSS supports CSS and SCSS, not indented `.sass`. LSP uses a server explicitly supplied by the repository; configure its executable `command` and separate `args`. Install and pin that server through the repository's normal tooling. Do not infer an available language server from a filename.

```json
{"provider":"lsp","operation":"definitions","files":["src/view.ts"],"position":{"line":4,"character":10},"config":{"command":"typescript-language-server","args":["--stdio"]}}
```

For an existing semantic index, supply `config.path`. The JSON artifact has `version: 1`, a nonempty `inputs` array of `{path, hash}` source bindings, and a `facts` array. Facts identify `kind` (`symbol`, `definition`, `reference`, `diagnostic`, or `relationship`), project-relative `path`, and native range. A fact with `target.path` also needs that target in `inputs`. Compute source hashes with the runtime `hash` helper. Stale or unbound facts are rejected with gaps. The index provider reads that artifact; it does not create it.

Use only operations supported by the selected provider. HTML supports symbols and document-local reference highlights. CSS supports symbols, definitions, references, and diagnostics. Results contain provider identity, operation, `complete`, `partial`, or `unavailable` status, facts, inputs, capabilities, gaps, and scope. Read capabilities and gaps before using a fact. LSP references are scoped navigation evidence, not a proof that every consumer was found. Changed source or discovery during analysis makes currentness unresolved.

Provider metadata separates `adapterVersion` from `engine.name` and `engine.version`. Direct services report their installed package version. LSP uses the server's initialization identity. A missing engine version remains an explicit provenance gap. `requestBinding` binds the operation, scope, position, configuration, and literal query. Index artifacts can identify their producer in `provider: {name, version}`. Read all gaps before reusing evidence.

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
