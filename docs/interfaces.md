# V5 implementation interfaces

Runtime uses Node.js 24 ESM. Runtime source and these interfaces own helper contracts. The native root owns integration and shared meaning. Assign one writer per mutable surface and preserve concurrent edits.

## Activation

`activeRoot(start)` returns the nearest activated ancestor inside the nearest Git boundary, or undefined. `.projector/active` must be a regular file. A `.git` directory or worktree file stops the search after checking its own marker. `projectRoot(start)` returns that activated root, the nearest Git root, or the original directory when neither exists.

`activate(root)` creates the empty marker at the supplied root. `deactivate(root)` removes only that marker. `activationStatus(start)` reports active/inactive and the applicable root and marker. CLI activate/deactivate default to `projectRoot(cwd)`; `--root` selects an explicit directory.

Focus, revisit, reconciliation, observations, checkpoint reads/writes/updates/resume/close, and repair require activation before reading project data or mutating Projector state. They return an inactive result when no marker applies. CLI checks activation before reading a request file. Hooks read consumer guidance only for activated projects.

## Meaning files

Use Markdown with YAML frontmatter. Required fields: id, kind (concept, lens, pattern), title, status (accepted, candidate, retired). The body holds reasons, examples, alternatives, and reopening assumptions. Concept conditions are objects with id, text, evidence (runtime or static), and optional allowsAbsence. Relations are objects with type, target, and status (observed or accepted).

A Lens has conditions expressed as concept-id#condition-id. Its selectors are objects with id, patterns (project-relative globs), optional role. Selection describes the relevant population, not the property being checked. Checks have id, command, args, selectors (IDs), conditions (references), evidence (runtime or static), optional target, inputs (additional project-relative globs), and optional env. Native commands run without a shell. Lens observations are provider requests. A Pattern has concepts, examples, counterexamples, alternatives, and optional lens; promotion is an explicit edit, not automatic inference.

## Helper functions and CLI

Export focus(root, request), revisit(root, request), reconcile(root, request) from runtime/projector.mjs. Requests may select concepts, lenses, paths, query, and work. reconcile runs checks only when runChecks=true; otherwise it reuses applicable receipts. CLI accepts: COMMAND --root PATH --request REQUEST.json. Commands: focus, revisit, reconcile, checkpoint, resume, close, repair, observe. There is no automatic provider installation or semantic indexing.

Every verdict names condition, selector/participants, selection status, evidence, status (supported, mismatch, unresolved), and reason. Reconcile retains the original mismatch in the work checkpoint before applying any changed selector/checker/condition interpretation.

## Shared filesystem functions

runtime/state.mjs exports projectPath(root, relative), hash(value), captureInputs(root, paths), discover(root, patterns), captureScope(root, patterns, extraPaths=[]), readJson(path), writeJson(path,value), and writeText(path,text). Inputs are objects {path, hash}; missing files have hash=null. discover returns sorted project-relative files and refuses outside-root targets. captureScope returns {patterns, inputs, fingerprint}; fingerprint covers membership and contents. Atomically replace individual metadata files. No global observation lock.

## Provider boundary

runtime/providers/index.mjs exports observe(root, request). Request provider is inventory, lsp, html, css, or index. Operations include symbols, definitions, references, diagnostics, relationships. files and patterns identify scope; position is {line,character}; config contains explicit server command/args for lsp, or index path for index. Inventory may use literal text to locate framework names without claiming resolved semantics.

Return {provider:{id,adapterVersion,engine:{name,version}}, requestBinding, operation, status:complete|partial|unavailable, facts, inputs, capabilities, gaps, scope}. inputs use captureInputs. Facts identify path/range and native fact kind. Capture relevant scope before and after analysis; changed scope makes currentness unresolved. Failures retain available source facts and explicit gaps. LSP results are scoped navigation evidence, not a completeness proof. Do not invent a custom parser, type checker, or cross-language graph.

## Checkpoints and repair

Checkpoint requests have id, goal, concepts, lenses, ownership [{owner,paths}], boundaries, completed, questions, and uncertainMutations. Root is the shared checkpoint writer. Closed checkpoints move out of default focus but remain readable. Resume compares source/discovery snapshots with current checkout and never replays a mutation.

Repair requests have id, work, owner, outputs [{path,expectedHash,content|fromFile|delete}], and optional condition and explanation. Only paths explicitly owned in the checkpoint can be automatically changed. fromFile accepts a producer's staged output; the native host runs the known producer. Save before images and an attempt record under the work directory before writes. Repeated same attempts or prior-state recurrence stop the strategy locally. inspect and rollback modes inspect the actual state; rollback changes only bytes still matching this attempt's postimage. Do not overwrite unrelated edits.

Checks may declare coverage as explicit participant paths, or coverage: selection when the command genuinely evaluates the current selected population. Default coverage includes only literal selector paths. Wildcard members do not inherit support from a check unless coverage includes them. Check scope is authored evidence applicability, not a proof that arbitrary check code is complete.

These are cooperative integrity conventions, not a sandbox or universal certificate.
