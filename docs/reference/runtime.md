# Runtime and tool reference

Projector connects OpenSpec requirements, nested designs, and ordinary application artifacts. It provides exact revision queries, enrolled implementation checkouts, and a recoverable change loop. Source applications do not import Projector.

Node **24.19.0** is the tested runtime. OpenSpec **1.13.1** and the MCP SDK are pinned in the lockfile. The deterministic runtime makes **zero model calls**; the host agent supplies interpretation and independent review.

```powershell
npm ci
npm run check
node dist/host/cli.js install C:/tools/projector-v4
```

The installer creates a self-contained plugin in a fresh directory outside this checkout. Register that directory through your host's local plugin marketplace. Its MCP configuration launches a thin stdio relay. CLI commands use the same authenticated user-local owner as MCP clients. The owner starts on demand; closing one relay does not stop other clients. `PROJECTOR_HOME` selects an isolated state directory, and `PROJECTOR_PORT` explicitly selects its fixed loopback port. A foreign or incompatible endpoint is an error. Windows credentials use an owner-only ACL; browser origins and unauthenticated requests are rejected.

The package uses native Agent Plugins schema 1.0.0 in root `plugin.json` and `mcp.json`. Codex expands `${PLUGIN_ROOT}` in its stdio launch arguments. [Codex qualification](../qualification-codex.md) records actual marketplace registration and host discovery.

For an ordinary checkout, start with an exact revision:

```powershell
node dist/host/cli.js openRoot --json '{"root":"C:/work/app","profile":"revision"}'
```

Use the returned `rootId` with `read`, an explicit `view: "revision"`, a commit in `revision`, and a `reference` such as `[[code:src/player.ts#Player]]`, `[[spec:audio/playback#Replay]]`, or `[[design:audio/playback#contract]]`. A returned token identifies the root incarnation, view, observation epoch and dependency basis. Optional `fromPath`, `scope` and `edge` distinguish an architectural dependency from a read-only observation. A rebinding finding can be adopted by supplying its exact candidate ID as `adoptBinding`; qualification is usually clearer.

Bare names use Unicode case folding, ignoring spaces and underscores while retaining other punctuation. A unique Markdown H1 owns a bare name before a unique top-level code declaration. Duplicate Markdown owners and ambiguous code names are reported. Package-qualified names use actual package export topology. Unsupported source/module/policy behavior returns unknown rather than a guessed answer.

Queries also accept bounded selectors: `{ "kind": "path", "root": ".", "prefix": "src/audio/" }`, exact IDs, concern descendants, imports/consumers, and conjunction/union. Results are paged with revision-bound cursors. An empty selector result still depends on its search population.

For a managed change:

1. The agent authors `openspec/changes/<name>/proposal.md`, nested requirement deltas in `specs/**/spec.md`, nested design deltas in `designs/**/design.md`, and editable `tasks.md`. The `projector` OpenSpec schema keeps the two artifact kinds separate.
2. Call `prepareChange({root,change,baseline?,workspaceMode?})`. Mode is `"checkout"` by default or explicitly `"isolated"`. It pins the baseline and target and returns `candidateRoot` and `candidateId`. In checkout mode candidateRoot is the selected root. Existing isolated sessions remain isolated.
3. Call `validatePlan` with applicability selectors, current contribution dispositions and prerequisites. Resolve its explicit obligations. Task edits remain inputs; behavioral edits need amendments to their owning requirements/designs.
4. Open the candidate with `profile: "managed"` and `candidate: candidateId`. Run `checkpoint` to establish its initial observation boundary. Use acknowledged `beginBatch`/`completeBatch` around cooperating source edits. Unknown shell writes and lifecycle commands invalidate currentness; regain it through an independent checkpoint.
5. Execute the plan. `reviseChange` compares a changed target with the previous target and preserves actual implementation for retain/remove/replace/revise decisions. `recordEvidence` executes a real command with explicit scope and binds the outcome to its input basis. A checked task or invented successful result cannot replace it.
6. Obtain independent review of the actual diff, missing concerns, retained structure, and a simpler alternative. Submit its exact returned `basis`, then call `finishChange`. The service checks applicability, contributions, references, evidence, and prerequisites, then assembles implementation, authority, and archive in temporary isolation. It runs normal commit hooks, qualifies the actual resulting tree, conditionally advances the selected branch, and installs prepared checkout/index state without discarding unrelated work.

Finish integrates code and accepted specifications in one commit. File/index installation is recoverable, not a filesystem-wide atomic transaction. The publication journal pins target and reviewed commit and records before/after index and touched-file identities. Hooks that change checked inputs require renewed evidence and review. Actual overlapping changes, unexpected writes, and target drift remain explicit recovery obligations; unrelated staged, unstaged, and untracked work may remain present.

`resumeChange` diagnoses stale inputs and resumes interrupted finish. Runtime-owned versioned state lives under the repository Git directory in `projector-changes/`, with an active `implementation-state.json` mirror. It is recovery data, not authority over manually revised proposal/specification/design/task files. Target and previous ownership survive in Git objects and refs. SQLite is disposable. Repeating settled finish reuses the exact publication without a document/code diff.

For failed or hook-mutated finalization, `resumeChange({root,change,reconcileFinalization:true})` reconciles the retained implementation delta into the selected checkout and reopens implementation. It preserves unrelated work, clears seals/review, and retains evidence history. Changed inputs require renewed verification and independent review before finish. Actual conflicts remain explicit; this operation does not approve the failed result or bypass hooks.

Hook changes to authority or change artifacts remain listed in `pendingFinalizationArtifacts`. Incorporate the retained bytes into the prospective target or authored change inputs. To discard a specific hook edit, pass `finalizationDispositions:[{path,reason}]` to `validatePlan`. The disposition becomes part of the independent review basis. Merely validating again does not clear unresolved edits.

For a separately selected source branch, `$projector:merge` constructs and reviews the pinned merge in temporary isolation. The installed `./change` module exports `preparePublication({root,targetBranch,targetHead,commit,directory,change?})` and `publishPublication(root,transaction,{save?,fault?})`. The directory must contain the exact reviewed commit in a detached linked worktree. These helpers preserve residual staged/working changes and journal publication; they do not establish semantic correctness or independent review. Merge uses the default Git-directory `projector-publications/` journal. Lifecycle supplies its state-saving callback.

## Verification and execution

The shared verify skill derives obligations before inspecting assertions for fresh work, separates the test-change plan from execution selection, and checks coherent slices. Final impact includes committed, staged, unstaged, and untracked differences from the baseline. Empty or uncertain selection broadens checks; repository and release gates still apply.

`validatePlan` returns plan/review `basis` and a separate versioned `verificationBasis`. `recordEvidence({root,change,command,args,scope,timeoutMs?,inputPaths?,purpose?,supersedes?,generatedOutputs?})` executes an executable plus an argument array. Scope names covered files; inputPaths names actual check inputs, including tests, transitive source, fixtures, and configuration. Omit uncertain inputPaths for conservative whole-checkout freshness. Actual Markdown task completion and result bookkeeping do not automatically invalidate application evidence; substantive task edits still need reconciliation.

Purpose defaults to `verification`; `diagnostic`, `baseline`, `red`, and `generation` preserve history without becoming final assurance. A current passing broader check can explicitly supersede earlier IDs when its scope and actual assertions preserve their obligations. Historical passes and failures remain recorded. The runtime checks declared coverage and freshness, not whether an assertion is sufficient.

Evidence execution defaults to 60000 ms and permits integer timeouts from 1 through 600000 ms. Client/owner transport adds 15000 ms for settlement. Finish/resume transport defaults to 600000 ms plus settlement; ordinary operations retain 30000 ms. MCP caller timeouts are caller-owned: configure them to cover the operation, or use the installed CLI. Supplied progress tokens receive relay progress. Inspect persisted results before repeating a mutation after disconnect. On Windows, npm/npx execution uses Node and their CLI entry rather than treating a command string as an executable.

Relevant generated outputs can be declared on their owning design decision with `Generated: {"output":"path","producer":"path","inputs":["input","configuration"],"retention":"tracked"}` or disposable retention. `generatedOutputs` records actual producer/input/output identity after successful stable-input execution. A generation receipt can remain valid while changed outputs stale ordinary verification. Changed inputs require regeneration; removed producers require removal or surviving support for tracked outputs.

Designs use YAML `projectorDesign: 1`, a stable `id`, ownership `scope`, a prose H1 and addressable Contract, Decision, Realization and Subdesigns sections. Choices and reasons are required; consequential boundaries/dependencies/strategies also explain alternatives and tradeoffs. `Applies` entries bind requirements to explicit JSON selectors and reasons. Evidence named in prose remains pending until executed. The repository's own nested designs provide concrete examples.

Working-current reads require lifecycle enrollment and cooperating acknowledged writes in the selected or isolated checkout. An ordinary checkout is eligible through enrollment, not by assertion alone. Unobserved writers, unknown intervals, and Windows/WSL dual ownership are not silently qualified. Pending/unavailable responses contain no current payload; historical reads remain separate.

## Document providers and limits

The synchronous `extractFile(path,source)` keeps its existing Markdown, JavaScript/TypeScript, and opaque behavior. `await createDocumentIntelligence({providers?})` provides the full service with `extract(path,string|Uint8Array)`, `resolveRepository(Map)`, and a provider fingerprint. Production indexing uses this service. Built-ins compose in source; there is no repository provider manifest or dynamic provider installation.

| Input | Built-in intelligence and explicit limits |
| --- | --- |
| Markdown, JavaScript, TypeScript, JSX, TSX | Existing extraction, addresses, and module resolution; unsupported source/configuration/policy patterns remain unknown. |
| C# | Declarations, namespaces/imports, and static project compile/reference relationships; unsupported MSBuild evaluation or generation remains unknown. |
| Rust | Declarations, Cargo/local dependency and static module/use relationships; macros and unresolved conditional configuration remain unknown. |
| Python | Declarations and static package/import relationships using supported source-root configuration; dynamic imports and unresolved package topology remain unknown. |
| HTML, CSS, SCSS | Domain-specific markup/style facts and static relationships. Parsing SCSS does not prove compiled CSS behavior. |
| Indented `.sass` | File recognition and ownership; semantic support is unknown. |
| Tauri | Static commands and registration, supported frontend invocation wrappers, events/configuration/resources; dynamic commands and unproven wiring remain incomplete. |
| React Native | Static StyleSheet entries/usages, inline/array composition, platform/native/configuration/assets relationships; dynamic relationships and unproven native registration remain incomplete. |

Existing `code:`, `spec:`, and `design:` identities remain. Non-code units use `artifact:<domain>:<encoded-path>#<encoded-key>` with markup, style, framework-style, framework, or configuration domains; they do not enter bare code-symbol lookup. Every tracked artifact retains raw-byte identity and ownership, including large binary banks and generated outputs. Text parsing and retained source remain bounded. Ignored disposable outputs do not establish authority.

Capability completeness distinguishes syntax, units, dependencies, repository resolution, and cross-domain facts. Expected unsupported semantics produce scoped unknowns; parser initialization, package/ABI, and programming failures are actionable errors. Provider/parser/grammar/query revisions and project configuration participate in cache identities. File, queue, root, result, snapshot, and cache limits are reported by `inspectStatus`; overload does not discard recovery state. The 64 MiB extraction cache limit does not bound every SQLite table or total repository storage.

Run `npm run check` for build, module boundaries and acceptance tests. The installed-client, failure, concurrency, operation-count and clean-evolution evidence is recorded in the verification and qualification documents under `docs/`. Those measurements establish the stated test conditions, not general performance superiority on a large production project.
