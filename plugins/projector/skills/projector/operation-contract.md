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

Supported built-in operations are `status`, `init`, `context`, `reconcile`, `change.capture`, `change.plan`, `change.approve`, `change.apply`, `change.recover`, `change.resume`, `coverage`, `complete`, `cleanup`, and `verify`. `application.observe` is available only when a concrete application service is composed by its host. The typed schemas and registered handlers own each operation's exact input and output. Do not add undeclared fields.

Common inputs are:

- `context`: `{ "request": "...", "persist": true }`; optional `entities`, `namedTargets`, `operation`, and bounded `policy` refine retrieval.
- `reconcile`: `{ "contextId": "..." }`.
- `change.capture`: `{ "request": "...", "proposal": { ... }, "contextId": "..." }`.
- `change.plan`: `{ "changeSelector": "..." }`.
- `change.approve`: `{ "changeSelector": "...", "planHash": "sha256:v1:..." }`.
- `change.apply`, `change.recover`, `change.resume`: `{ "approvalSelector": "..." }`.
- `coverage`, `complete`, `cleanup`: optional `scope`, `budgetTokens`, `budgetCost`, and `questionOffset`.
- `status`, `init`, and `verify`: `{}`.

The script emits one `projector.operation-result/v1` JSON result and exits with that result's `exitCode`. Read `status`, `readiness`, `error`, `action`, and the operation-owned `output` separately. `registered` means a handler is reachable; it does not prove project readiness or host enforcement. `unavailable`, `recovery-required`, `cancelled`, and failed results are not successful evidence. A successful delivery to this process boundary does not prove that an agent understood or acted on returned instructions.

Always provide the intended repository explicitly. The operation entry keeps no hidden workspace binding. Retain context IDs, proposal files, selectors, reviewed plan hashes, receipts, and recovery records in their actual owners; the entry is not a second progress store.
