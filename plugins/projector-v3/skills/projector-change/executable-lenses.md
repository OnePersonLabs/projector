# Executable lens checks

Use existing declarative predicates when they express the architectural obligation. A custom lens validator uses a tracked repository Node script and an immutable source binding. Its result checks the declared predicate; it does not certify every product requirement.

The validator binding is:

```json
{
  "id": "validator:domain-boundary",
  "provider": "repository-node",
  "version": "git:<blob-object-id>",
  "required": true,
  "input": { "path": "architecture/domain-boundary.mjs", "parameters": { "domain": "src/domain" } }
}
```

Replace the version with the exact output of `git rev-parse HEAD:architecture/domain-boundary.mjs`, prefixed by `git:`. The script must match that Git-base file. A changed, missing, or untracked validator cannot establish conformance. Commit a reviewed validator before adopting its binding; a transaction cannot establish independent validity by rewriting its own validator. The exact Projector `transform-content` hash is also accepted as the version.

The script receives one JSON argument at `process.argv[2]` containing `apiVersion: "projector.knowledge-validator/v1"`, `validatorId`, `unitId`, repository-relative `unitPath`, and the binding's `parameters`. It runs from the repository root through the host's configured permissions. Projector resolves the exact tracked source path and compares its compiled content identity before and after execution. Return exit code zero and exactly one JSON object on stdout:

```json
{"status":"satisfied","reason":"The selected domain unit has no forbidden dependency."}
```

Statuses are `satisfied`, `violated`, or `unknown`; the nonblank reason is at most 4096 characters. Nonzero exit, malformed output, timeout, cancellation, source drift, unsupported providers, and denied host execution produce `unknown`. Each execution is limited to 30 seconds and 256 KiB output. Context and reconciliation run applicable validators; code transactions check them before committing. Model-only transactions establish canonical integrity and decision baselines without claiming repository-code validation.

Custom results are deduplicated within one observation, not persistently cached: a repository script can inspect data outside the static analyzer's observed source population. Change the script's immutable binding when its implementation changes. Keep ignored/runtime inputs explicit in the predicate and treat missing observations as unknown.

The validator runs with the permissions of the installed host on native Windows or direct WSL. The content checks establish which tracked source was launched and whether those bytes remained stable across the observation. They do not establish filesystem confinement, network denial, hostile same-user protection, or prevention of changes between checks. Timeout, output, and caller-cancellation bounds are enforced. Forced Windows process-tree cleanup reports the host command result; POSIX cleanup remains unconfirmed because a descendant can escape its inherited process group, so an interrupted validation cannot produce a successful finding.
