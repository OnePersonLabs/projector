# Operational MCP Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Advertise only MCP tools backed by operational handlers while preserving and exposing the complete canonical Projector tool inventory.

**Architecture:** Delete the shallow built-server wrapper. Keep the generic MCP server as the deep module and make the CLI composition provide explicit session-dependent handler maps. Expose declared availability through `projector.status`.

**Tech Stack:** TypeScript, Vitest, JSON-RPC MCP transport, Projector mutation capabilities.

**Spec:** `docs/superpowers/specs/2026-08-26-operational-mcp-registry-design.md`

## Global Constraints

- Preserve all 21 canonical MCP names and existing schema shapes.
- Advertise only handlers that can perform their declared behavior in the current session.
- Mutation remains single-use, state-bound, scope-bound, risk-bound, and fail-closed.
- GitHub Actions remains `workflow_dispatch` only.

---

### Task 1: Characterize operational advertisement and catalog inspection

**Files:**
- Modify: `packages/cli/src/run-cli.test.ts`
- Modify: `packages/integrations/src/mcp/server.test.ts`

**Interfaces:**
- Consumes: `executeProjector(["mcp"])`, `createBuiltMcpCliPort().start()`, JSON-RPC `tools/list` and `tools/call`.
- Produces: executable expectations for sessionless/session-bound lists, canonical availability, and unknown-tool refusal.

- [ ] **Step 1: Change the sessionless CLI expectation to the literal operational read list**

Expect exactly `projector.audit`, `projector.list_divergences`, and `projector.status`.

```ts
expect(result.report.tools).toEqual([
  "projector.audit",
  "projector.list_divergences",
  "projector.status",
]);
```

- [ ] **Step 2: Extend the authenticated-session test**

Expect the authenticated lifecycle list to add `projector.apply_transform`, `projector.preview_representation`, and `projector.validate_representation`. Call status and assert that all 21 names are accounted for while `projector.apply_plan` is explicitly unavailable.

```ts
expect(mcp.tools).toEqual([
  "projector.apply_transform",
  "projector.audit",
  "projector.list_divergences",
  "projector.preview_representation",
  "projector.status",
  "projector.validate_representation",
]);
expect(status.result.structuredContent.toolAvailability).toHaveLength(21);
expect(status.result.structuredContent.toolAvailability).toContainEqual({
  name: "projector.apply_plan",
  class: "controlled",
  operational: false,
  reason: "no production handler is registered",
});
```

- [ ] **Step 3: Add an unadvertised-call refusal assertion**

Call `projector.apply_plan` with the issued token. Expect an unknown-tool JSON-RPC error, then prove the same token still authorizes one valid `projector.apply_transform` call.

```ts
const unavailable = await mcp.transport.handle({
  jsonrpc: "2.0", id: 2, method: "tools/call",
  params: { name: "projector.apply_plan", arguments: { capabilityToken: mcp.capabilityToken } },
});
expect(unavailable).toMatchObject({ error: { message: expect.stringMatching(/unknown MCP tool/iu) } });
```

- [ ] **Step 4: Run RED**

Run: `pnpm vitest run packages/cli/src/run-cli.test.ts packages/integrations/src/mcp/server.test.ts`

Expected: failure because the built composition still advertises all 21 tools and status lacks availability.

### Task 2: Replace synthetic handlers with the operational composition

**Files:**
- Modify: `packages/integrations/src/mcp/server.ts`
- Modify: `packages/cli/src/mcp-cli.ts`
- Modify: `packages/integrations/src/mcp/server.test.ts`

**Interfaces:**
- Consumes: explicit `ProjectorMcpDependencies` handler maps and `MutationCapabilityService`.
- Produces: `PROJECTOR_MCP_TOOL_CATALOG`, explicit operational maps, status availability records.

- [ ] **Step 1: Export the canonical tool catalog**

Represent every existing name once with its `read` or `controlled` class. Derive compatibility name arrays from the catalog.

```ts
export interface ProjectorMcpCatalogEntry {
  readonly name: string;
  readonly class: "read" | "controlled";
}

export const PROJECTOR_MCP_TOOL_CATALOG: readonly ProjectorMcpCatalogEntry[] = Object.freeze([
  ...["status", "audit", "explain", "context", "coverage", "list_divergences", "preview_plan", "preview_transform", "preview_representation", "validate_representation", "validate", "resolve_identity", "relevance", "requirements", "scenarios", "impact"]
    .map((name) => ({ name: `projector.${name}`, class: "read" as const })),
  ...["apply_transform", "execute_packet", "accept_decision", "create_exception", "apply_plan"]
    .map((name) => ({ name: `projector.${name}`, class: "controlled" as const })),
]);
```

- [ ] **Step 2: Delete `createBuiltProjectorMcpServer()`**

Move no behavior into a replacement wrapper. Keep `createProjectorMcpServer()` as the only registry/transport constructor.

- [ ] **Step 3: Compose session-dependent handler maps in `mcp-cli.ts`**

Always register status, audit, and divergence reads. Register representation reads and `apply_transform` only for an authenticated session. Issue capabilities only for registered controlled names.

```ts
const read: Record<string, Tool> = {
  "projector.status": status,
  "projector.audit": audit,
  "projector.list_divergences": audit,
  ...(session === undefined ? {} : {
    "projector.preview_representation": (input) => representation(input, true),
    "projector.validate_representation": (input) => representation(input, false),
  }),
};
const controlled = session === undefined ? {} : {
  "projector.apply_transform": applyTransform,
};
```

- [ ] **Step 4: Return canonical availability from status**

For every catalog entry, return `{ name, class, operational, reason? }`. Derive `operational` from the actual maps, not a second hard-coded list.

```ts
const operationalNames = new Set([...Object.keys(read), ...Object.keys(controlled)]);
const toolAvailability = PROJECTOR_MCP_TOOL_CATALOG.map((entry) => ({
  ...entry,
  operational: operationalNames.has(entry.name),
  ...(operationalNames.has(entry.name) ? {} : { reason: "no production handler is registered" }),
}));
```

- [ ] **Step 5: Run GREEN and typecheck**

Run: `pnpm vitest run packages/cli/src/run-cli.test.ts packages/integrations/src/mcp/server.test.ts scripts/projector-plugin.test.ts`

Run: `pnpm --filter @projector/integrations typecheck && pnpm --filter @projector/cli typecheck`

Expected: all pass.

### Task 3: Verify, review, and commit the slice

**Files:**
- Modify only if review finds a material acceptance gap in Tasks 1–2.

**Interfaces:**
- Consumes: exact diff from `3bc2394` and the design acceptance list.
- Produces: independently reviewed operational registry commit.

- [ ] **Step 1: Run the continuity review against the acceptance matrix**

Block only on a normative requirement with a public-path reproduction and material consequence.

- [ ] **Step 2: Batch-fix accepted findings test-first**

Repeat RED/GREEN only for demonstrated gaps.

- [ ] **Step 3: Run the frozen gate**

Run: `pnpm verify && pnpm build && pnpm release:artifacts:check && git diff --check`

- [ ] **Step 4: Commit**

```bash
git add packages/integrations/src/mcp/server.ts packages/integrations/src/mcp/server.test.ts packages/cli/src/mcp-cli.ts packages/cli/src/run-cli.test.ts docs/superpowers/specs/2026-08-26-operational-mcp-registry-design.md docs/superpowers/plans/2026-08-26-operational-mcp-registry.md
git commit -m "refactor: advertise only operational MCP tools"
```
