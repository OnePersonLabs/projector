# Phase 1: Slice 0 — Foundation and Correctness Substrate - Pattern Map

**Mapped:** 2026-08-07  
**Files/packages classified:** 27 implementation units  
**Repository application analogs:** 0 / 27 — the application scaffold is absent.  
**Authoritative analogs:** the checksummed source snapshot under `.planning/intel/source-snapshot/PROJECTOR_SPEC/` (not the mutable convenience copy under `PROJECTOR_SPEC/`).

## Scope and analogue rule

The Phase 1 context and Slice 0 delivery contract require a fresh TypeScript/Node ESM workspace; there are no `src/`, package manifests, tests, or product modules to copy. Do **not** infer a Python runtime style from `PROJECTOR_SPEC/scripts/*.py`: those scripts are bootstrap-spec maintenance tooling only.

Use the source snapshot as the normative interface/layout analogue, especially:

- [`reference-implementation.md`](../../intel/source-snapshot/PROJECTOR_SPEC/02-semantic-kernel/reference-implementation.md) lines 45, 50-116: ports architecture, package graph, dependency direction, composition root.
- [`canonical-state.md`](../../intel/source-snapshot/PROJECTOR_SPEC/02-semantic-kernel/canonical-state.md) lines 5-127: `.projector/` layout, fine-grained persistence, hash dimensions, rebuild boundary.
- [`state-binding-and-ports.md`](../../intel/source-snapshot/PROJECTOR_SPEC/02-semantic-kernel/state-binding-and-ports.md) lines 5-177 and 180-283: exact state-binding and adapter/graph/runtime port contracts.
- [`implementation-plan.md`](../../intel/source-snapshot/PROJECTOR_SPEC/12-delivery/implementation-plan.md) lines 5-42: Phase 1 allowed surface and acceptance constraints.
- [`testing-and-adversarial-evaluation.md`](../../intel/source-snapshot/PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md) lines 5-145: fixture-first unit/property/test categories.

The only local code analogue is `PROJECTOR_SPEC/scripts/check_spec.py` lines 5-13, 27-48, and 84-103: resolve a fixed root, enumerate an explicit manifest, accumulate diagnostics, and fail only after deterministic validation. It is useful **only** for the deterministic-checker shape, not language, package, or error conventions.

## File Classification

| New/modified file or package | Role | Data flow | Closest analogue | Match quality |
|---|---|---|---|---|
| `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.workspace.ts` | config | transform | reference layout 50-110; tech choices 127-136 | spec-exact |
| `packages/core/package.json`, `src/index.ts` | package/public facade | request-response | reference layout 57-62, dependency rule 103-110 | spec-exact |
| `packages/core/src/domain/contracts.ts` | model | transform | state-binding contracts 5-114; Slice 0 list 18-23 | spec-exact |
| `packages/core/src/schemas/contracts.ts` | schema/validation | transform | reference tech choice 130; canonical requirements 75-88 | spec-exact |
| `packages/core/src/hashing/canonical-json.ts` | utility | transform | canonical-state 75-100; testing properties 47-72 | spec-exact |
| `packages/core/src/hashing/digests.ts` | utility | transform | state-binding 5-12, 72-76; canonical-state 84-100 | spec-exact |
| `packages/core/src/identity/stable-identity.ts` | service | CRUD | canonical-state 49-51, 75-82, 94-104 | spec-exact |
| `packages/core/src/state/binding.ts` | service | request-response | state-binding 5-177 | spec-exact |
| `packages/core/src/ports/index.ts` | port/interface | request-response | state-binding ports 180-283; reference layout 103-114 | spec-exact |
| `packages/core/src/storage/canonical-store.ts` | repository | file-I/O | canonical-state 7-44, 90-104, 119-127 | spec-exact |
| `packages/core/src/storage/canonical-manifest.ts` | utility | transform | canonical-state 84-100 | spec-exact |
| `packages/runtime/package.json`, `src/index.ts` | package/public facade | request-response | reference layout 80-85, 103-110 | spec-exact |
| `packages/runtime/src/filesystem/root-path.ts` | utility/security | file-I/O | CLI security 106-127 | spec-exact |
| `packages/runtime/src/git/git-reader.ts` | adapter | request-response | persistence/observation 93-125; reference tech choice 134 | spec-exact |
| `packages/runtime/src/sqlite/derived-store.ts` | adapter/repository | CRUD | persistence/observation 5-54; implementation plan 23-25 | spec-exact |
| `packages/runtime/src/sqlite/migrations.ts` | migration | batch | canonical-state 75-88; persistence/observation 54-72 | spec-exact |
| `packages/runtime/src/journal/transaction-journal.ts` | service | event-driven | canonical-state 94-100; persistence/observation 27-54 | spec-exact |
| `packages/runtime/src/journal/writer-lease.ts` | service | request-response | persistence/observation 27-54; first vertical slice 44-68 | spec-exact |
| `packages/analyzers/package.json`, `src/index.ts` | package/public facade | request-response | reference layout 73-79, 103-110 | spec-exact |
| `packages/analyzers/src/filesystem/inventory.ts` | adapter | file-I/O | persistence/observation 74-115; Slice 1 boundary at implementation-plan 44-55 | spec-exact |
| `packages/analyzers/src/git/observation.ts` | adapter | request-response | persistence/observation 93-125 | spec-exact |
| `packages/cli/package.json`, `src/main.ts` | composition root/CLI | request-response | reference architecture 5-23, 112-114; CLI commands 5-72 | spec-exact |
| `packages/cli/src/commands/init.ts` | controller/CLI command | file-I/O | canonical-state 7-44, 119-127; CLI modes 77-104 | spec-exact |
| `packages/cli/src/commands/status.ts` | controller/CLI command | request-response | CLI commands 5-72; persistence rebuild invariant 35-54 | spec-exact |
| `packages/testkit/package.json`, `src/fixture-repository.ts`, `src/fakes.ts` | test utility | file-I/O | reference layout 92-94; reference architecture 45; test strategy 5-105 | spec-exact |
| `fixtures/transaction-crash/**`, `fixtures/scoped-state-binding/**` | fixture | file-I/O | test strategy 47-105; Slice 0 acceptance 31-40 | spec-exact |
| `packages/*/test/**/*.test.ts` | test | transform | testing strategy 5-145; implementation plan 5-12 | spec-exact |

## Pattern Assignments

### Workspace and package manifests

**Copy boundary:** reference implementation layout lines 50-116.

```text
core          -> no workspace dependency
engine        -> core
analyzers     -> core
runtime       -> core
integrations  -> core
cli           -> core + engine + analyzers + runtime + integrations
```

For Slice 0, create only `core`, `runtime`, `analyzers`, `cli`, and `testkit`; omit `engine` and `integrations` until a phase needs their public facades. Package-direction tests must encode this rule (implementation-plan lines 39-40). All packages use strict TypeScript ESM, pnpm workspaces, Vitest, and fast-check (reference implementation lines 127-136).

### `packages/core/src/domain/contracts.ts` and `schemas/contracts.ts`

**Copy contract:** `state-binding-and-ports.md` lines 5-114 and Slice 0 deliverables in `implementation-plan.md` lines 18-23.

```ts
export interface StateBinding {
  compiledAgainst: StateDigest;
  valueDependencies: StateValueDependencyRef[];
  queryDependencies: StateQueryDependency[];
  dependencyDigest: ContentHash;
}

export interface StateBindingValidation {
  status: "current" | "rebound" | "stale" | "suspect" | "unavailable";
  currentState: StateDigest;
  changedValueDependencyIds: Array<EntityId | string>;
  changedQueryDependencyIds: string[];
  reasons: string[];
  rebound?: StateBinding;
}
```

Build the Zod schema first and derive/export TypeScript types and JSON Schema from it. Preserve exact discriminator literals and field names from the source snapshot; do not create an alternative DTO layer. Canonical documents must include version, stable ID/key, lifecycle, semantic hash, required discovery hash, and stable-ID references (canonical-state lines 75-88).

### `packages/core/src/hashing/{canonical-json,digests}.ts`

**Copy contract:** canonical-state lines 84-100; test properties lines 47-72.

Implement a versioned canonical JSON serializer, then SHA-256 the declared projections. Maintain distinct **canonical document**, **semantic**, and **discovery** hashes. The root manifest is a deterministic derived value over sorted `(entityId, canonicalDocumentHash)` entries; never persist it as editable authority. Explicitly exclude schema-declared volatile values (timestamps, run IDs, local paths, UI metadata) from semantic hashes.

### `packages/core/src/identity/stable-identity.ts`

**Copy contract:** canonical-state lines 49-51 and 94-104.

Identity is stable ID/key based—not a filename, storage path, or directory. Relations persist independently by stable ID. Support aliases and lineage in the canonical contract while keeping physical sharding a nonsemantic storage concern.

### `packages/core/src/state/binding.ts`

**Copy contract:** state-binding-and-ports lines 5-177.

```text
root snapshot changed
→ compare explicit value dependencies + query-result fingerprints
  → none changed: rebind
  → relevant value/query changed: stale
  → unavailable/ambiguous lane: suspect or unavailable
```

Do not add whole-repository/global-root hashes to each local binding. A query dependency includes deterministic program ID/version, normalized input, result fingerprint, observability, assumptions, unavailable lanes, and dependency keys. Empty results from open/sampled/unavailable lanes cannot prove absence.

### `packages/core/src/ports/index.ts`

**Copy contract:** state-binding-and-ports lines 180-283 and reference implementation lines 103-114.

Declare interfaces only: graph/query readers, binding validator, analyzer capability/failure contracts, transform preview/result, and any storage/journal seams that core needs. Core must compile and test with fakes; no `node:fs`, SQLite driver, subprocess, host brand, or CLI imports in this package.

### `packages/core/src/storage/{canonical-store,canonical-manifest}.ts`

**Copy contract:** canonical-state lines 7-44, 90-127.

Persist one independently addressable document per entity/governance record under the specified `.projector/` paths. Load/update one bounded entity without loading or rewriting the graph. Resolve every canonical filesystem location through the runtime root-constrained path port. Keep `state.db`, cache, reports, generated output, and certificates derived/ignored by default; rebuild reads only repository/Git, committed canonical state, and explicit pinned external snapshots.

### `packages/runtime/src/filesystem/root-path.ts`

**Copy contract:** CLI security lines 106-127.

Accept POSIX-style relative paths and enforce root constraint after normalization; reject `..` escapes, account for Windows drive/UNC semantics and real filesystem case sensitivity, enforce explicit symlink policy, prevent outward write traversal, and return the real target used by safety checks. This is the sole route for canonical filesystem writes.

### `packages/runtime/src/{git/git-reader,sqlite/derived-store,sqlite/migrations}.ts`

**Copy contract:** persistence-and-observation lines 5-54 and 93-125; reference tech choices lines 131 and 134.

SQLite is derived, local, transactional, queryable state. It indexes authoritative fine-grained files and can be deleted/rebuilt without semantic loss. Git access uses inspectable argv-based subprocess invocation through a port; never execute repository package scripts or source as part of observation. Migrations are versioned, deterministic, previewable, and independently testable.

### `packages/runtime/src/journal/{transaction-journal,writer-lease}.ts`

**Copy contract:** canonical-state lines 94-100; persistence-and-observation lines 27-54; first vertical slice lines 44-68.

Model multi-document canonical mutation as journaled phases protected by a writer lease. A run sees a consistent graph revision and promotes derived state atomically only at the appropriate journal phase. Recovery is explicit and tested by forced interruption; never rely on a single monolithic canonical file for atomicity.

### `packages/analyzers/src/{filesystem/inventory,git/observation}.ts`

**Copy contract:** persistence-and-observation lines 74-125.

Keep only safe Phase-1 observation contracts: deterministic filesystem/Git/package facts and declared capabilities/failures. No broad TS/JS, Markdown, structured-data, or GitHub Actions semantic analyzer belongs in this phase; those are explicitly later rollout steps. Degrade unavailable/unsupported capabilities as observations rather than turning them into empty results or aborting unrelated lanes.

### `packages/cli/src/{main,commands/init,commands/status}.ts`

**Copy contract:** reference implementation lines 5-23 and 112-114; CLI modes/security lines 3-145.

CLI is the composition root: instantiate runtime/analyzer adapters and inject their ports into core. `init` creates/validates the canonical destination and derived state; `status` is read-only. Normalize flags/modes into one execution policy, reject contradictions, and use documented exit categories. No package below CLI imports concrete adapter implementations.

### `packages/testkit/**`, fixtures, and tests

**Copy contract:** implementation-plan lines 5-12 and 29-42; testing strategy lines 5-145.

Start each vertical unit with failing fixture/property coverage. Supply in-memory fakes for all core ports. Required Phase-1 fixture/property families: canonical serialization insertion-order invariance; fine-grained storage/root digest; volatile-field exclusion; scoped binding rebind/stale/query-change cases; open-world negative-space refusal; root path escapes/symlinks; `state.db` deletion/rebuild; transaction crash/recovery; and workspace dependency direction. `transaction-crash` and `scoped-state-binding` are named authoritative fixture families.

## Shared Patterns

### Dependency direction and composition

**Source:** reference implementation lines 101-116.  
**Apply to:** all packages.  
Core owns contracts and pure deterministic logic; runtime/analyzers implement injected ports; only CLI composes concretes. This is a hard boundary and gets a package-graph test.

### Deterministic diagnostics and errors

**Local code source:** `PROJECTOR_SPEC/scripts/check_spec.py` lines 5-13, 27-48, 95-103.  
**Apply to:** CLI validation/rebuild/check commands.

```py
errors=[]
warnings=[]
...
if errors:
    print('SPEC CHECK FAILED')
    for e in errors: print('-',e)
    raise SystemExit(1)
```

Adapt the shape, not Python syntax: return structured typed diagnostics with deterministic ordering, preserve warnings separately, and map to the CLI's documented exit codes. Never silently ignore unavailable evidence lanes.

### Security and no-exec observation

**Source:** CLI modes/security lines 106-145; persistence-and-observation lines 93-125.  
**Apply to:** filesystem, Git, CLI, and all adapters.

Treat repository content as data, use argv arrays rather than shell interpolation, declare cwd/scope/timeouts, root-constrain paths, and make analyzer capabilities/no-exec behavior inspectable.

### Rebuild and state validity

**Source:** canonical-state lines 119-127; state-binding-and-ports lines 115-177.  
**Apply to:** storage, SQLite, journal, CLI status, and tests.

Canonical inputs are authority; SQLite is rebuildable. Global digest changes trigger scoped binding validation/rebinding, never blanket staleness.

## No Repository Analog Found

All Phase-1 TypeScript runtime units lack a local product-code analogue because no application scaffold exists. Their implementation must follow the cited exact source-snapshot contracts, with test-first construction, rather than copying bootstrap Python or GSD artifacts.

## Metadata

**Analog search scope:** repository root excluding generated Git internals; `PROJECTOR_SPEC/scripts/`; `.planning/intel/source-snapshot/PROJECTOR_SPEC/`.  
**Product source files scanned:** 0 (none exist).  
**Specification/tool files read:** phase context, roadmap, requirements corpus, relevant exact snapshot modules, and bootstrap checker/bundler.  
**Pattern extraction date:** 2026-08-07.
