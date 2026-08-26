# Authenticated repository sessions design

## Goal

Give host and MCP compositions one deep authority for persisted repository-session identity, immutable selection, approval binding, and representation validity without changing the public CLI helpers or the persisted session bytes.

## Problem

`packages/cli/src/host-cli.ts` currently owns the stored-session contract, hashing, selector parsing, filesystem lookup, canonical repository identity, and plan/capsule/approval checks. `mcp-cli.ts` imports that CLI implementation directly. Representation validity is then checked separately in the host adapter and MCP composition. This makes a security boundary depend on composition-root placement and already allowed advertisement logic to drift from host execution logic.

The existing `task17-host-session` record kind, hash domains, selector syntax, storage path, and public `projector/cli` helper names are compatibility contracts. They must not change in this slice.

## Design

Add `packages/integrations/src/sessions/index.ts` as the shared integration boundary. It owns:

- the exact `StoredHostSession` contract;
- `createHostSessionRecord()` and `hostSessionSelector()` with the existing hash domains and bytes;
- `loadAuthenticatedRepositorySession()`, which parses the immutable selector, reads the existing file path, verifies the record hash, canonical repository root, optional host route, plan revision and hash, capsule hash, approval identities, and exact plan/capsule state binding;
- `authenticateRepresentationBinding()`, a pure function that classifies the capsule/instructions relationship as `valid`, `absent`, or `invalid` with an actionable reason.

The loader returns the authenticated record and its representation classification. A representation mismatch does not become a callable handler. MCP registers representation tools only for `valid`. Host execution requires `valid` before launch and retains its adapter-level defense-in-depth check.

`host-cli.ts` keeps host observation, launch, journal, and reconciliation composition. It imports the shared loader and deletes its local session contract/authentication code. `mcp-cli.ts` imports the same authority directly from `@projector/integrations`, eliminating the CLI-to-CLI security seam. `cli.ts` re-exports the same legacy helper names so `projector/cli` compatibility remains exact.

Representation equality uses canonical JSON, so semantically identical key order does not create host/MCP drift.

The generic MCP server, mutation capability service, and persisted record shape do not change. Currentness and write-selector authorization are deliberately separate follow-on primitives in the engine and runtime respectively: this slice establishes the authenticated session input they will consume without inventing an all-purpose CLI session facade.

## Failure behavior

- Malformed, missing, tampered, wrong-root, wrong-host, or approval-inconsistent records fail before host launch or MCP registration.
- A representation mismatch is reported as `invalid`; MCP leaves representation handlers unadvertised and status exposes the specific reason.
- An absent capsule representation is `absent`, not falsely invalid.
- No invalid or absent representation can be upgraded to an operational handler by caller input.

## Acceptance

1. Existing session record creation produces the same selector and content hash.
2. The shared loader rejects selector, record, root, host, plan, capsule, approval, and binding tampering.
3. Representation classification distinguishes valid, absent, and invalid records deterministically.
4. Host and MCP use the shared module; MCP no longer imports `host-cli.ts`.
5. Invalid and absent representation sessions list only the three operational repository reads; invalid status is actionable.
6. `projector/cli` continues to export `createHostSessionRecord` and `hostSessionSelector` with the persisted format unchanged.
7. Full verification, package boundaries, packed release acceptance, and manual-only Actions remain green.

## Authority

- [Host and MCP Integration](../../../PROJECTOR_SPEC/08-agents/hosts-and-mcp.md)
- [Projector north star](../../../NORTH_STAR.md)
