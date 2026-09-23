# OpenSpec and lifecycle qualification

Tested on Windows with Node **24.19.0** and `@fission-ai/openspec` **1.13.1**. The production dependency pins that version. Projector checks the actual CLI version before projecting a target.

The bounded qualification established these concrete seams:

| Probe | Observed result |
| --- | --- |
| `openspec schema validate projector-probe --json` | A project-local schema with separate `specs/**/spec.md` and `designs/**/design.md` artifacts validates. |
| `openspec status --change nested-probe --json` | Both nested requirements and nested designs appear in their respective `artifactPaths.*.existingOutputPaths`; two spec paths and one design path were discovered. |
| `openspec instructions designs --change nested-probe --json` | The custom nested design artifact is addressable through the supported instructions command. |
| `openspec validate nested-probe --strict --json` | The nested add/modify fixture validates. |
| `openspec archive nested-probe --yes --json` | OpenSpec merges one nested added requirement and one modified requirement, archives the whole change, and preserves its design delta. It does not merge designs into live designs. |
| `openspec validate --specs --strict --json` | Resulting live nested requirements validate. |
| Repeat CLI archive | Returns failure for the missing active change. Projector supplies exact publication/archive recovery rather than claiming the CLI is idempotent. |

The package's public exports expose its root CLI/configuration, references, stores, and planning-home APIs. `specs-apply` and `ArchiveCommand` are internal files, not exported library APIs. Projector therefore invokes the pinned CLI with an argument array inside isolated target staging and the candidate, and verifies the resulting exact live document inventory and bytes. It does not reproduce OpenSpec requirement merging or import private merge modules.

The archive JSON result uses `archive.change`, `archive.archivedAs`, `archive.path`, `archive.specsUpdated`, and `archive.totals`. The adapter validates the selected change identity. Design deltas are applied by Projector's document module, and their exact final state is checked independently after archive.

An inspection of the previously installed `opl-openspec` 0.9.0 guard confirmed that `openspec-x-*` is its explicit stock-skill extension namespace. A bounded guard probe permitted `$openspec-x-projector` and rejected editing the stock apply skill. Its archive hooks recognized shell archive moves, but not the OpenSpec CLI archive command; those hooks were never a complete mutation boundary. The user subsequently disabled that companion plugin. The shipped Projector extension and lifecycle therefore do not invoke or depend on its hooks, cache, or workflow skills.

Windows qualification found that a Git checkout's automatic line-ending conversion can differ from the exact accepted Git bytes used by a design delta's baseline hash. Candidate allocation uses Git's canonical bytes for its authority documents and disables automatic line-ending conversion for that allocation command only. It does not change repository or user Git configuration.

Reproduce the durable integration evidence with:

```powershell
npm run build
node --test test/change*.test.ts
npx eslint src/change test/change*.test.ts
```

The lifecycle tests exercise real Git worktrees and the installed OpenSpec CLI. They verify separate accepted/proposed/actual views, preserved same-file work across target revision, exact symbol contribution obligations, missing applicability and unplanned source blocking, task wording reconciliation, stale executed evidence, candidate-only compare-and-swap publication, archive/publication interruption recovery, and settled repeat finish. Review records inside deterministic fixtures are explicitly simulated attestations; actual isolated review is separate delivery evidence. No model is called by these tests or the deterministic lifecycle.

Durable state lives with the change; Git refs retain the current and previous target. Disposable observation caches are not consulted by the lifecycle's recovery path. An archive is verified before the candidate branch changes. A sealed implementation changed during recovery is refused rather than published. Source planning state remains available to locate the candidate, while the completed candidate contains the archived change; integrating that branch into the accepted branch remains a separate operation.

Concurrent lifecycle requests use a queue per canonical repository/change inside the shared host process. The host's OS-held endpoint provides the process ownership boundary. Direct library consumers must use one owner per repository; independent processes must route through the host instead of treating the library as a cross-process lock service. No PID-file takeover or stale-lock deletion is used. Deterministic contention tests cover queued predecessors, failing operations, successor exclusion, and independent roots; concurrent service instances prepare one candidate.

A replacement disposition withdraws the old contribution just as removal does. If its exact symbol remains without current support, completion reports structural residue even when a different symbol in the same file passes its check.

For changed JavaScript/TypeScript files, the lifecycle independently compares extracted declaration identities, body hashes, and export visibility with the accepted baseline. Every added or modified declaration requires an exact or containing-symbol realization, or explicit whole-file responsibility. A narrow replay binding does not cover a new unrelated export; unchanged declarations in the same file require no new disposition solely because their neighbor changed.
