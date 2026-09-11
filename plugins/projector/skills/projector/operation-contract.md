# Bundled operation contract

Resolve `../../scripts/projector-operation.mjs` from this file's directory. The script uses Node 24 from the host `PATH`, loads the exact packaged Projector services in-process, and derives package identity from `runtime/projector/package.json`.

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

Supported built-in operations are `status`, `init`, `context`, `reconcile`, `change.capture`, `change.plan`, `change.approve`, `change.apply`, `change.recover`, `change.resume`, `representation.inspect`, `coverage`, `complete`, `cleanup`, and `verify`. The installed Windows entry also composes `application.observe` for the Psychord adapter. The typed schemas and registered handlers own each operation's exact input and output. Do not add undeclared fields.

Common inputs are:

- `context`: `{ "request": "...", "persist": true }`; optional `entities`, `namedTargets`, `operation`, and bounded `policy` refine retrieval.
- `reconcile`: `{ "contextId": "..." }`.
- `change.capture`: `{ "request": "...", "proposal": { ... }, "contextId": "..." }`.
- `change.plan`: `{ "changeSelector": "..." }`.
- `change.approve`: `{ "changeSelector": "...", "planHash": "sha256:v1:..." }`.
- `change.apply`, `change.recover`, `change.resume`: `{ "approvalSelector": "..." }`.
- `representation.inspect`: `{ "changeSelector": "...", "view": "summary" | "content" }`; optional `capsuleId` selects one capsule and optional `approvalSelector` authenticates an existing approval without creating authority.
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

Cleanup continuation separates current, stale, and unknown bindings from governance and historical lifecycle outcomes. It prioritizes recovery of unfinished effects, including a published partial result whose journal remains open. Required prepared-success and representation artifacts are authenticated by their existing owners. Advisory notes remain unobservable when those owners do not name any; cleanup creates no note registry, progress store, approval, or prepared-success evidence. Evidence limits bound disclosure, not repository observation, and lifecycle execution still performs its own exact authority and repository-wide recovery checks.

A successful `context` result places the saved context identity at `output.id`, candidate interpretation at `output.interpretation`, and retained semantic items at `output.branches[].context.items`. Inspect `output.unknowns` and branch frontiers and obligations before relying on the retained context. Focus an existing meaning with `input.entities`; the operation accepts no CLI flags.

Always provide the intended repository explicitly. The operation entry keeps no hidden workspace binding. Retain context IDs, proposal files, selectors, reviewed plan hashes, receipts, and recovery records in their actual owners; the entry is not a second progress store.
