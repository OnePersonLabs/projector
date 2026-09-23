# Projector V4 verification

The supported profile is Windows on NTFS, Node 24.19.0, Git 2.55.0.windows.5,
OpenSpec 1.13.1 and Codex 0.155.1. Runtime and plugin version: **4.0.0**.
Working-current means an allocated candidate with cooperating, acknowledged
writers. Exact Git revision reads have a separate validity contract.

## Reproduction

```powershell
npm ci
npm run check
npx openspec validate --all --strict --json
```

The suite uses real Git worktrees, pinned OpenSpec, SQLite workers, installed
runtime copies and two SDK clients. It also injects publication failures and
worker exits. No test calls a model. Fake observation events and explicit
barriers determine race ordering; elapsed time is not the correctness oracle.

The final production-source check passed compilation, ESLint and **52/52
tests**; the test phase took **71.95 seconds**. Strict OpenSpec validation covers
the three live nested specification documents. The 65 references in the five
durable concern designs resolve against the actual repository file inventory.

| Acceptance area | Executed checks |
| --- | --- |
| Authored references | Unicode normalization, Markdown ownership, legal code duplicates, aliases and re-exports, nested parts, boundary decisions, rebinding, malformed and overlapping deltas |
| Independent coverage | Selector population changes, hidden declarations, new exports beside covered symbols, actual changed-artifact inventory, prior contribution and replacement residue |
| Shared observation | One endpoint owner, independent roots, 100 edits/32 readers, generation races, interrupted batches, unknown observation intervals, identity changes and exact historical queries |
| Recovery | Worker exit and replacement, missing/corrupt disposable database, reconstruction from Git targets, archive/publication faults and repeated finish |
| Change lifecycle | Nested target projection, task reconciliation, partial target revision, preserved same-file contributions, missing/stale executed evidence, prerequisites and candidate-only publication |
| Installed behavior | Fresh external installation, two MCP clients, native Windows paths, managed mutation/read interleaving and writer exclusion during lifecycle mutations |

Independent review found and led to fixes for checkpoint epoch races, canonical
Git/working-tree byte differences, hidden-file ambiguity, alias-chain cache
invalidation, root admission release, narrow realization coverage, replaced
symbol residue and publication overlapping an acknowledged writer. The
regressions exercise the production interfaces. Review attribution inside
deterministic fixtures is a simulated input, not independent review evidence.

## Operation costs and fixed limits

With 100 undemanded writes followed by 32 readers, the measured refresh read and
hashed **40 bytes**, parsed/extracted **one file**, visited **one dependency**,
published **one transaction**, and started **zero subprocesses or model calls**.
The requests counted **132 observation barriers** and **52,320 response bytes**.
The next identical warm query performed zero source reads, hashing, parsing,
extraction, dependency visits, subprocess starts or model calls. Its observation
barrier and response serialization still occurred.

The same local update against 10 and 2,000 unchanged background files cost
**24 source bytes, 24 hash bytes, one parse/extraction, one dependency visit,
one transaction and zero subprocess/model starts** in both cases. Cold inventory
was paid separately:

| Background files | Cold source/hash bytes | Cold parses/extractions | Cold subprocesses | Database bytes |
| ---: | ---: | ---: | ---: | ---: |
| 10 | 264 | 11 | 7 | 77,824 |
| 2,000 | 57,804 | 2,001 | 7 | 5,955,584 |

These counts establish a bounded local workload, not general economic benefit
on a large production application. New population members and explicit broad
checkpoints still require real inventory work. Responses are counted in bytes;
the runtime does not invent tokenizer-specific output-token counts.

The initial limits are two worker lanes, eight active roots, 128 queued jobs,
20,000 inventory files, 1 MiB per file, 32 MiB per snapshot, 128 cached queries,
256 KiB per query result, 250 rows per page and four retained snapshot versions.
The worker caps SQLite at 64 MiB, bounds journal growth and checkpoints WAL.
Host transport caps request/result bodies at 1 MiB and admits at most 64 active
requests. Active pending/recovery state is preserved; overload rejects admission.

## Evidence boundaries

[Host qualification](qualification-host.md) records installation footprint,
transport, ACL, SQLite and installed lifecycle measurements.
[OpenSpec qualification](qualification-openspec.md) records supported nested
artifact discovery, merge/archive behavior and exact recovery.
[Actual Codex qualification](qualification-codex.md) records the production
marketplace installation and successful native discovery of all 15 tools.
[Evaluation instructions](../evaluation/README.md) describe the coupled world,
held-out oracle and its five seeded-defect controls.

Unsupported CommonJS export inference, destructured declarations, inherited or
project-reference TypeScript configurations and unadapted dependency policies
return explicit unknowns. Arbitrary external editors, disconnected shell writers,
other operating systems and simultaneous Windows/WSL ownership are not qualified
for working-current reads. The ordinary application has no Projector runtime
imports; authored specifications and designs remain ordinary files.
