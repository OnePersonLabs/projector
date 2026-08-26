# Authenticated repository sessions implementation plan

**Goal:** Replace the CLI-to-CLI session authority seam with one compatibility-preserving integration module used by host and MCP compositions.

**Architecture:** Put stored-session authentication and representation classification in `@projector/integrations`; leave launch/reconciliation in the CLI composition and keep all persisted/public contracts exact.

**Spec:** `docs/superpowers/specs/2026-08-26-authenticated-repository-sessions-design.md`

## Constraints

- Preserve `task17-host-session`, selector/hash domains, `.projector/task17-sessions/session-<hash>.json`, and public helper names.
- No new mutation capability or MCP tool.
- No broad CLI refactor.
- GitHub Actions remains `workflow_dispatch` only.

### Task 1: Characterize the shared authority contract

**Files:**
- Add: `packages/integrations/src/sessions/index.test.ts`
- Modify: `packages/cli/src/run-cli.test.ts`
- Modify: `packages/cli/src/cli.test.ts`

- [x] Add valid, absent, invalid, tampered, wrong-root, wrong-host, and approval-mismatch session cases.
- [x] Assert the exact legacy selector/hash and public CLI exports.
- [x] Assert MCP status gives the invalid representation reason while leaving both representation tools unknown.
- [x] Run RED before adding the shared implementation.

### Task 2: Implement the deep session module

**Files:**
- Add: `packages/integrations/src/sessions/index.ts`
- Modify: `packages/integrations/src/index.ts`
- Modify: `packages/integrations/src/codex/adapter.ts`
- Modify: `packages/cli/src/host-cli.ts`
- Modify: `packages/cli/src/mcp-cli.ts`
- Modify: `packages/cli/src/cli.ts`

- [x] Move the exact record contract, creation, selector, and authenticated loader to integrations.
- [x] Add pure valid/absent/invalid representation classification.
- [x] Delete local session authentication from `host-cli.ts`.
- [x] Compose both host and MCP from the shared authority and retain the public CLI aliases.
- [x] Run focused GREEN, typecheck, and package-boundary checks.

### Task 3: Verify and land

- [x] Run continuity review against the design acceptance list.
- [x] Fix accepted material findings test-first.
- [x] Run `pnpm verify && pnpm build && pnpm release:artifacts:check && pnpm release:acceptance && git diff --check`.
- [x] Commit the slice independently.
