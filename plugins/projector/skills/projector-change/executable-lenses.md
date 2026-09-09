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

The script receives one JSON argument at `process.argv[2]` containing `apiVersion: "projector.knowledge-validator/v1"`, `validatorId`, `unitId`, repository-relative `unitPath`, and the binding's `parameters`. It runs from the repository root with read-only repository access, no writable roots, and denied network. The original script path is overlaid with the authenticated source. Return exit code zero and exactly one JSON object on stdout:

```json
{"status":"satisfied","reason":"The selected domain unit has no forbidden dependency."}
```

Statuses are `satisfied`, `violated`, or `unknown`; the nonblank reason is at most 4096 characters. Nonzero exit, malformed output, timeout, cancellation, source drift, unsupported providers, and unavailable confinement produce `unknown`. Each execution is limited to 30 seconds and 256 KiB output. Context and reconciliation run applicable validators; code transactions check them before committing. Model-only transactions establish canonical integrity and decision baselines without claiming repository-code validation.

Custom results are deduplicated within one observation, not persistently cached: a repository script can inspect data outside the static analyzer's observed source population. Change the script's immutable binding when its implementation changes. Keep ignored/runtime inputs explicit in the predicate and treat missing observations as unknown.

Linux and WSL use bubblewrap directly. Native Windows uses the selected WSL distribution and Linux Node 24 through the same confinement checks. Portable plugin bundles include both Node binaries. An npm/development install on Windows can set `PROJECTOR_WSL_NODE` to an absolute Linux Node 24 executable and `PROJECTOR_WSL_DISTRO` to the intended distribution. Linux-compatible validator dependencies are required in WSL; Windows native modules are not portable. The backend proves filesystem/network confinement, immutable overlays, and descendant cleanup. CPU and memory quotas are not supported; the backend never substitutes an unconfined execution.
