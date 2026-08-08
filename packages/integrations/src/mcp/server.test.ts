import { hashFramedDomain, type ContentHash, type StateBinding, type StateDigest } from "@projector/core";
import { describe, expect, it, vi } from "vitest";

import { createMutationCapabilityService, type CapabilityRecord, type CapabilityStore } from "./capabilities.js";
import { createProjectorMcpServer } from "./server.js";

class MemoryStore implements CapabilityStore {
  readonly rows = new Map<ContentHash, CapabilityRecord>();
  async issue(record: CapabilityRecord) { if (this.rows.has(record.tokenHash)) return false; this.rows.set(record.tokenHash, record); return true; }
  async read(tokenHash: ContentHash) { return this.rows.get(tokenHash); }
  async compareAndSwap(tokenHash: ContentHash, revision: number, next: CapabilityRecord) { const current = this.rows.get(tokenHash); if (current?.revision !== revision) return false; this.rows.set(tokenHash, next); return true; }
}

const state: StateDigest = { gitBase: "g", worktreeDigest: hashFramedDomain("mcp", "w"), canonicalProjectorDigest: hashFramedDomain("mcp", "c"), toolchainDigest: hashFramedDomain("mcp", "t") };
const binding: StateBinding = { compiledAgainst: state, valueDependencies: [], queryDependencies: [], dependencyDigest: hashFramedDomain("state-binding-dependencies", { valueDependencies: [], queryDependencies: [] }) };
const grant = { sessionId: "s", worktreeId: "w", repositoryRoot: "/repo", planHash: hashFramedDomain("mcp", "plan"), packetId: "p", capsuleHash: hashFramedDomain("mcp", "capsule"), approvalHash: hashFramedDomain("mcp", "approval"), binding, toolNames: ["projector.write"], operations: ["write-file"], semanticScopes: ["unit:api"], writeScopes: ["src/**"], maximumRisk: "R2" as const, expiresAt: 2_000 };
const use = (token: string, overrides = {}) => ({ token, toolName: "projector.write", operation: "write-file", semanticScopes: ["unit:api"], writePaths: ["src/a.ts"], risk: "R1" as const, ...overrides });

describe("MCP transport and durable mutation capabilities", () => {
  it("authenticates current authority and atomically rejects replay, revocation, expiry, and cross-worktree use", async () => {
    const store = new MemoryStore(); let nonce = 0;
    const weak = createMutationCapabilityService({ store: new MemoryStore(), entropy: () => new Uint8Array(8), clock: { now: () => 1_000 }, roots: { resolveRoot: async () => "/repo", resolveTarget: async (_root, path) => path }, authority: { verify: async () => true }, currentness: { verify: async () => true } });
    await expect(weak.issue(grant)).rejects.toThrow(/256|entropy/u);
    let now = 1_000; const service = createMutationCapabilityService({ store, entropy: () => new Uint8Array(32).fill(++nonce), clock: { now: () => now }, roots: { resolveRoot: async () => "/repo", resolveTarget: async (_root, path) => path.includes("..") ? undefined : path }, authority: { verify: async () => true }, currentness: { verify: async ({ record }) => record.binding.dependencyDigest === binding.dependencyDigest } });
    const issued = await service.issue(grant);
    await expect(service.consume(use(issued.token))).resolves.toMatchObject({ packetId: "p", status: "consumed" });
    await expect(service.consume(use(issued.token))).rejects.toThrow(/consumed/u);
    const wrongTool = await service.issue(grant); await expect(service.consume(use(wrongTool.token, { toolName: "projector.accept_decision" }))).rejects.toThrow(/tool/u);
    const escaped = await service.issue(grant); await expect(service.consume(use(escaped.token, { writePaths: ["src/../outside"] }))).rejects.toThrow(/target|scope/u);
    const expired = await service.issue(grant); now = 2_001; await expect(service.consume(use(expired.token))).rejects.toThrow(/expired/u); now = 1_001;
    const revoked = await service.issue(grant); await service.revoke(revoked.token); await expect(service.consume(use(revoked.token))).rejects.toThrow(/revoked/u);
    const raced = await service.issue(grant);
    const outcomes = await Promise.allSettled([service.consume(use(raced.token)), service.consume(use(raced.token))]);
    expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
  });

  it("routes read and controlled tools through the actual registry transport without leaking secrets", async () => {
    const store = new MemoryStore(); const service = createMutationCapabilityService({ store, entropy: () => new Uint8Array(32).fill(7), clock: { now: () => 1_000 }, roots: { resolveRoot: async () => "/repo", resolveTarget: async (_root, path) => path }, authority: { verify: async () => true }, currentness: { verify: async () => true } });
    const issued = await service.issue(grant); const mutate = vi.fn(async () => ({ ok: true, apiToken: "must-not-leak" }));
    const server = createProjectorMcpServer({ capability: service, read: { "projector.query": async () => ({ units: ["Authorization: Bearer live-secret", "password=hunter2"], secret: "drop" }) }, controlled: { "projector.write": { operation: "write-file", risk: "R1", targets: () => ({ semanticScopes: ["unit:api"], writePaths: ["src/a.ts"] }), run: mutate } } });
    const listed = await server.transport.handle({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(listed).toMatchObject({ result: { tools: [
      { name: "projector.query", description: expect.stringMatching(/authenticated/iu), inputSchema: { type: "object", additionalProperties: true } },
      { name: "projector.write", description: expect.stringMatching(/single-use/iu), inputSchema: { type: "object", required: ["capabilityToken"], properties: { capabilityToken: { type: "string" } } } },
    ] } });
    const read = await server.transport.handle({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "projector.query", arguments: {} } });
    expect(JSON.stringify(read)).not.toMatch(/secret|drop|hunter|Bearer/iu);
    expect(read).toMatchObject({ result: { content: [{ type: "text", text: expect.any(String) }], structuredContent: { units: ["[REDACTED]", "[REDACTED]"] }, isError: false } });
    expect(mutate).not.toHaveBeenCalled();
    const written = await server.transport.handle({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "projector.write", arguments: { capabilityToken: issued.token, value: "x" } } });
    expect(written).toMatchObject({ result: { content: [{ type: "text", text: "{\"ok\":true}" }], structuredContent: { ok: true }, isError: false } }); expect(mutate).toHaveBeenCalledOnce();
    const replay = await server.transport.handle({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "projector.write", arguments: { capabilityToken: issued.token } } });
    expect(replay).toHaveProperty("error"); expect(mutate).toHaveBeenCalledOnce();
  });
});
