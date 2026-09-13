# Bundled operation contract

Resolve `../scripts/projector-operation.mjs` from this file's directory. The script uses Node 24 from the host `PATH`, loads the exact packaged Projector services in-process, and derives package identity from `runtime/projector/package.json`.

Write one UTF-8 JSON request file, then run:

```sh
node <projector-operation.mjs> <request.json>
```

The script also accepts the same single JSON object on standard input. A request has this envelope:

```json
{
  "apiVersion": "projector.operation/v1",
  "operation": "status",
  "repositoryRoot": "/absolute/path/to/repository",
  "requestId": "host-selected-correlation-id",
  "input": {}
}
```

Supported built-in operations are `status`, `init`, `context`, `reconcile`, `repository.check`, `operation-access.recover`, `change.capture`, `change.plan`, `change.approve`, `change.apply`, `change.recover`, `change.resume`, `representation.inspect`, `representation.reconcile`, `coverage`, `complete`, `cleanup`, and `verify`. The installed Windows entry also composes `application.observe` for the Psychord adapter. The typed schemas and registered handlers own each operation's exact input and output. Do not add undeclared fields.

Common inputs are:

Repository observation accepts optional envelope-level `observationLimits` with positive finite integer overrides: `maxFiles` (20,000), `maxDirectories` (20,000), `maxFileBytes` (8 MiB), `maxTotalBytes` (256 MiB), `maxGitOutputBytes` (32 MiB), `timeoutMs` (60,000), `maxWorkerHeapMiB` (512), and `maxDerivedBytes` (64 MiB). Omit fields to retain defaults. Nested and secondary observation work shares the allowance. Git failures never authorize recursive fallback or automatic limit increases. Exhaustion fails explicitly without publishing a partial context or replacing its baseline; narrow the requested scope or explicitly revise the finite allowance.

Agent and full knowledge responses have fixed total ceilings of 1 MiB and 16 MiB respectively. Whole-record projection remains unchanged. An oversized response fails rather than being dumped or partially published. Disposable contexts and impact snapshots have a shared 256 MiB hard storage cap without age expiry; eligible least-recently-used data can be collected, while unfinished lifecycle and recovery evidence remains protected. A missing disposable context calls for fresh context, not historical sign-off. Legacy or exclusion-incompatible snapshots cannot establish additions or deletions against the current observation.

- `repository.check`: optional `mode: "full" | "commit-only"` (default `full`), `sessionId`, and `handled: { "findingId": "...", "evidenceIdentity": "sha256:v1:..." }`. Full checks compare bounded local Git and file observations; commit-only checks reuse the observation when HEAD is unchanged. Output status is `unchanged`, `changed`, `no previous observation`, or `incomplete`, with pending finding anchors, bounded paths, limitations, `offer`, and `nextAction`. Observation and pending investigation are separate. A handled request performs a full check and acknowledges only the exact current finding; it never accepts design or proves conformance. Session IDs coalesce offers, not permission. No remote fetch or full source analysis occurs.

- `context`: `{ "request": "...", "persist": true }`; optional `entities`, `namedTargets`, `operation`, and bounded `policy` refine retrieval. Optional `view: "agent" | "full"` selects transport disclosure; the default is `agent`.
- `reconcile`: `{ "contextId": "..." }`; optional `view: "agent" | "full"` selects transport disclosure; the default is `agent`.
- `change.capture`: `{ "request": "...", "proposal": { ... }, "contextId": "..." }`.
- `change.plan`: `{ "changeSelector": "..." }`.
- `change.approve`: `{ "changeSelector": "...", "planHash": "sha256:v1:..." }`.
- `change.apply`, `change.recover`, `change.resume`: `{ "approvalSelector": "..." }`.
- `operation-access.recover`: `{}`. Explicitly reclaims only recognized expired claims from exited processes; ambiguous access evidence remains recovery-required.
- `representation.inspect`: `{ "changeSelector": "...", "view": "summary" | "content" }`; optional `capsuleId` selects one capsule and optional `approvalSelector` authenticates an existing approval without creating authority.
- `representation.reconcile`: `{ "changeSelector": "..." }`; optional `approvalSelector` authenticates the historical approval. It replaces stale profile-bound projections and capsules with a distinct current, unapproved lifecycle capture. It never modifies or transfers the historical approval.
- `coverage`, `complete`, `cleanup`: optional `scope`, `budgetTokens`, `budgetCost`, and `questionOffset`.
- `cleanup` also accepts an existing `contextId`, `changeSelector`, or `approvalSelector` to inspect bounded continuation. Optional `evidenceLimit` (1--50, default 10), `evidenceOffset`, and `evidenceIdentity` page its evidence. Follow the returned `continuation.drillDown` request; if evidence changed, restart at offset zero without the old identity. `continuation.nextAction` is an invocable request, not an approval or proof of completion. Per-item `inspect` requests use the existing reconciliation and representation services.
- `status`, `init`, and `verify`: `{}`.
- `application.observe`: `{ "plan": { ... } }`, where `plan` is the strict Psychord application observation plan. Its repository root must equal the request root and `ownedArtifactRoot` must be `<repository>/.projector/runtime/application-evidence`.

The optional `context` policy is a strict object with these fields: `maxCandidates` and `maxEntries` are positive integers up to 10,000; `maxDepth` is a nonnegative integer up to 1,000; `maxTraversalCost` and `maxContextCost` are positive integers up to 10,000,000; and `minimumScore` is a number from 0 through 1. Omit a bound to use the product default. For a full bounded dependency proof, a request may use:

```json
"policy": { "maxCandidates": 32, "maxEntries": 10000, "maxDepth": 1000, "maxTraversalCost": 10000000, "minimumScore": 0.3, "maxContextCost": 10000000 }
```

The Psychord host uses its running Node executable, resolves the package-declared pnpm CLI and agent-browser 0.31.1 native executable from their ordinary `PATH` installations, and resolves Chrome from its standard Windows installation. The existing `PROJECTOR_NODE_EXECUTABLE`, `PROJECTOR_PNPM_CLI`, `PROJECTOR_AGENT_BROWSER_EXECUTABLE`, and `PROJECTOR_CHROME_EXECUTABLE` overrides select nondefault installations. Every resolved file must also appear as an exact `toolchain` dependency pin in the plan; an override does not bypass that binding.

The script emits one `projector.operation-result/v1` JSON result and exits with that result's `exitCode`. Read `status`, `readiness`, `error`, `action`, and the operation-owned `output` separately. `registered` means a handler is reachable; it does not prove project readiness or host enforcement. `unavailable`, `recovery-required`, `cancelled`, and failed results are not successful evidence. A successful delivery to this process boundary does not prove that an agent understood or acted on returned instructions.

`status` checks operation access when project metadata is ready. A corrupt or abandoned access claim returns `recovery-required` with `action.operation: "operation-access.recover"`; inactive projects remain inspection-only.

Cleanup continuation separates current, stale, and unknown bindings from governance and historical lifecycle outcomes. It prioritizes recovery of unfinished effects, including a published partial result whose journal remains open. Required prepared-success and representation artifacts are authenticated by their existing owners. Advisory notes remain unobservable when those owners do not name any; cleanup creates no note registry, progress store, approval, or prepared-success evidence. Evidence limits bound disclosure, not repository observation, and lifecycle execution still performs its own exact authority and repository-wide recovery checks.

A successful `context` result places the saved context identity at `output.id`, candidate interpretation at `output.interpretation`, and selected semantic items at `output.branches[].context.items`. The default agent view omits internal closure graphs and state-binding transcripts. It includes whole semantic records only, with byte and sample limits; an oversized record is deferred rather than truncated. Inspect every `*Disclosure` total/included/omitted count, branch frontier and obligation counts, and `safety` totals before relying on displayed evidence. Safety totals include blocked decisions and unknown or violated observations in omitted branches. An empty sample with a nonzero total does not mean absence or conformance.

Focus an existing meaning with `input.entities`. If required content or proof is omitted, merge `output.fullEvidence.inputPatch` into the original input, preserving `request`, `entities`, `namedTargets`, `policy`, `operation`, and `persist`. The patch selects `"view": "full"`; it is not a complete request. Full view returns the unprojected current service result. Reconciliation likewise accepts `{"contextId":"...","view":"full"}` and returns that exact drill-down input in its agent view. Full disclosure does not enlarge retrieval policy or close an unresolved frontier. Both views perform the same current observation; changing view neither changes persisted proof nor creates execution authority. Context IDs and `contentHash` identify the full retained evidence, not the projected JSON. Reconciliation still separates binding status from governance and application-evidence status. The operation accepts no CLI flags.

Always provide the intended repository explicitly. The operation entry keeps no hidden workspace binding. Retain context IDs, proposal files, selectors, reviewed plan hashes, receipts, and recovery records in their actual owners; the entry is not a second progress store.
