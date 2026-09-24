# Runtime and tool reference

Projector connects OpenSpec requirements, nested concern designs and ordinary JavaScript/TypeScript source. It provides exact revision queries, explicitly managed candidate worktrees and a recoverable change loop. Source applications do not import Projector.

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
2. Call `prepareChange` with `root` and `change`. It pins the baseline and target and returns an isolated `candidateRoot` and `candidateId`.
3. Call `validatePlan` with applicability selectors, current contribution dispositions and prerequisites. Resolve its explicit obligations. Task edits remain inputs; behavioral edits need amendments to their owning requirements/designs.
4. Open the candidate with `profile: "managed"` and `candidate: candidateId`. Run `checkpoint` to establish its initial observation boundary. Use acknowledged `beginBatch`/`completeBatch` around cooperating source edits. Unknown shell writes and lifecycle commands invalidate currentness; regain it through an independent checkpoint.
5. Execute the plan. `reviseChange` compares a changed target with the previous target and preserves actual implementation for retain/remove/replace/revise decisions. `recordEvidence` executes a real command with explicit scope and binds the outcome to its input basis. A checked task or invented successful result cannot replace it.
6. Obtain an independent review of the current diff, missing concerns, retained structure and a credible simpler alternative. Submit the review with its exact returned basis, then call `finishChange`. The service checks applicability, actual changes, previous contributions, live references, evidence and prerequisites before materializing the exact target, archiving and updating the **candidate branch** by compare-and-swap.

`finishChange` does not merge the candidate into a working branch. When integration is separately authorized, `$projector:merge` pins the candidate and current target commits and constructs a no-fast-forward merge in a locked linked worktree. It resolves supported conflicts, runs repository checks and obtains independent adversarial review. The target advances through a fast-forward-only merge after its branch, commit and clean state are revalidated. Unresolved conflicts and target drift preserve the temporary integration without changing the target.

`resumeChange` diagnoses stale inputs and resumes an interrupted finish. Authored state lives with the change, and target/previous ownership survives in Git objects and refs. SQLite caches are disposable. Repeating a settled finish reuses its exact publication and has no document/code diff.

Designs use YAML `projectorDesign: 1`, a stable `id`, ownership `scope`, a prose H1 and addressable Contract, Decision, Realization and Subdesigns sections. Choices and reasons are required; consequential boundaries/dependencies/strategies also explain alternatives and tradeoffs. `Applies` entries bind requirements to explicit JSON selectors and reasons. Evidence named in prose remains pending until executed. The repository's own nested designs provide concrete examples.

Working-current reads are conditional on **cooperating writers in an allocated candidate**. Arbitrary editor worktrees, detached writers, unknown observer intervals and Windows/WSL dual ownership are not silently qualified. Pending/unavailable responses contain no purported current payload; explicitly requested historical reads remain separate.

The tested language profile is Markdown and JavaScript/TypeScript. Unsupported CommonJS exports, destructured top-level declarations, inherited/project-reference TypeScript configurations and unadapted dependency policies remain explicit limitations. File, queue, root, result, snapshot and SQLite limits are fixed and reported by `inspectStatus`; overload rejects admission without discarding active recovery state.

Run `npm run check` for build, module boundaries and acceptance tests. The installed-client, failure, concurrency, operation-count and clean-evolution evidence is recorded in the verification and qualification documents under `docs/`. Those measurements establish the stated test conditions, not general performance superiority on a large production project.
