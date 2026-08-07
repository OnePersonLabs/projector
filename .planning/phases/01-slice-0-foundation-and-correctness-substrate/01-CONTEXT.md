# Phase 1: Slice 0 — Foundation and Correctness Substrate - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous infrastructure phase)

<domain>
## Phase Boundary

Deliver the complete Slice 0 foundation: a host-neutral TypeScript/Node 24 composition root, exact versioned contracts, fine-grained canonical `.projector/` storage, deterministic canonical JSON and SHA-256 identities, rebuildable SQLite derived state, dependency-scoped state bindings, safe local filesystem/Git observation, transaction journal and writer lease, minimal CLI, and fixture/property coverage. This phase establishes the correctness substrate only; the misplaced-script semantic loop begins in Phase 2.

</domain>

<decisions>
## Implementation Decisions

### the agent's Discretion
- All implementation choices inside the locked Phase 1 boundary are at the agent's discretion because this is a pure infrastructure phase.
- The authoritative 1,319-requirement corpus and exact source snapshot remain the semantic source of truth; no requirement may be weakened, summarized away, or deferred merely because later phases consume the substrate.
- Implement the reference stack already fixed by the project: TypeScript/Node 24 ESM, pnpm, Zod plus JSON Schema, SQLite as derived state, canonical JSON plus SHA-256, Vitest, and fast-check.
- Prefer small independently addressed canonical files, explicit ports, deterministic/no-exec behavior, and in-memory fakes at every boundary.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- The repository currently contains planning artifacts, the exact checksummed source snapshot, and agent instructions; there is no application scaffold to preserve.

### Established Patterns
- GSD artifacts use exact requirement IDs, source citations, deterministic ownership, and independent audit reports.
- Repository instructions require GitHub Issues through `gh`, the standard triage labels, and root `CONTEXT.md` plus `docs/adr/` for domain documentation.

### Integration Points
- New runtime packages and CLI must integrate at the repository root without treating `.planning/` or `PROJECTOR_SPEC/` as runtime authority.
- Phase 14 will import the bootstrap semantics into `.projector/`; Phase 1 must make that canonical destination and its rebuild guarantees real.

</code_context>

<specifics>
## Specific Ideas

- Completion means the full committed scope is implemented; roadmap sequencing is dependency ordering, not permission for lazy deferral.
- Build the substrate so Projector can ultimately govern its own repository and make both the source spec directory and local GSD removable after proven semantic equivalence.

</specifics>

<deferred>
## Deferred Ideas

None. Later phases are committed scope with explicit dependencies, not optional backlog.

</deferred>
