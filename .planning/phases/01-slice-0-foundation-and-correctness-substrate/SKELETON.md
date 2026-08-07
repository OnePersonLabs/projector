# Walking Skeleton — Projector

**Phase:** 1  
**Generated:** 2026-08-07

## Capability Proven End-to-End

A maintainer can invoke the local `projector` CLI to initialize one canonical record, rebuild the disposable SQLite index from that record, and inspect the same state as deterministic terminal or JSON output.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Runtime | Node.js 24, strict TypeScript, ESM | This is the locked host-neutral reference runtime and language boundary. |
| Workspace | pnpm packages | The package graph makes dependency direction testable without a service or daemon. |
| Contract source | Zod schemas with generated JSON Schema | Runtime validation, TypeScript inference, and external schemas have one executable authority. |
| Canonical state | Independently addressable JSON documents under `.projector/` | Authored/governance meaning remains version-controlled, local, and rebuildable. |
| Derived state | `node:sqlite` behind runtime ports | SQLite is disposable/queryable state and does not leak into domain contracts. |
| Identity | Versioned canonical JSON plus SHA-256 | Exact, semantic, discovery, query, and root identities remain deterministic and distinct. |
| Trust boundary | Root-constrained paths and no-exec observation | Repository content is data; canonical writes cannot escape the governed root. |
| Composition root | `packages/cli` | Core owns contracts, adapters implement ports, and only the CLI assembles concrete implementations. |
| Auth | None in Phase 1 | The product is a local CLI with no authentication or session surface in this phase. |
| Run target | Documented local command | `pnpm projector -- init --repo <fixture> --format json` exercises the complete local stack. |

## Stack Touched in Phase 1

- [ ] Workspace scaffold, strict build, lint, and Vitest/fast-check harness
- [ ] CLI routing for `init` and `status`
- [ ] One canonical write and bounded canonical read
- [ ] One SQLite deletion/rebuild/read path
- [ ] Deterministic terminal and JSON output
- [ ] No-exec filesystem/Git observation
- [ ] Transaction journal and writer lease recovery

## Phase Boundary

Phase 1 ships the complete correctness substrate and the contracts consumed by dependency-ordered slices. It does not implement the misplaced-script semantic repair or broad TypeScript, structured-data, Markdown, GitHub Actions, host, MCP, or external-surface adapters. Those capabilities remain committed roadmap work.

## Subsequent Slice Contract

Every subsequent phase adds a governed vertical capability through the ports and canonical/derived boundary established here. No later slice may make SQLite authoritative, bypass root-constrained writes, insert global roots into local bindings, duplicate canonical contract ownership, or treat observed/inferred content as authored authority.
