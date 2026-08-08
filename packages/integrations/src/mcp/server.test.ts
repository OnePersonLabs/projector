import { hashFramedDomain, type ContentHash } from "@projector/core";
import { describe, expect, it, vi } from "vitest";

import { createMutationCapabilityService, type CapabilityRecord, type CapabilityStore } from "./capabilities.js";
import { createProjectorMcpServer } from "./server.js";

class MemoryStore implements CapabilityStore {
  readonly rows = new Map<ContentHash, CapabilityRecord>();
  async issue(record: CapabilityRecord) { if (this.rows.has(record.tokenHash)) return false; this.rows.set(record.tokenHash, record); return true; }
  async read(tokenHash: ContentHash) { return this.rows.get(tokenHash); }
  async compareAndSwap(tokenHash: ContentHash, revision: number, next: CapabilityRecord) { const current = this.rows.get(tokenHash); if (current?.revision !== revision) return false; this.rows.set(tokenHash, next); return true; }
}

const grant = { sessionId: "s", worktreeId: "w", planHash: hashFramedDomain("mcp", "plan"), packetId: "p", capsuleHash: hashFramedDomain("mcp", "capsule"), approvalHash: hashFramedDomain("mcp", "approval"), bindingDigest: hashFramedDomain("mcp", "binding"), operations: ["write-file"], semanticScopes: ["unit:api"], writeScopes: ["src/**"], maximumRisk: "R2" as const, expiresAt: 2_000 };
const call = (token: string, worktreeId = "w") => ({ token, sessionId: "s", worktreeId, planHash: grant.planHash, packetId: "p", capsuleHash: grant.capsuleHash, approvalHash: grant.approvalHash, bindingDigest: grant.bindingDigest, operation: "write-file", semanticScope: "unit:api", writePath: "src/a.ts", risk: "R1" as const, now: 1_001 });

describe("MCP transport and durable mutation capabilities", () => {
  it("authenticates current authority and atomically rejects replay, revocation, expiry, and cross-worktree use", async () => {
    const store = new MemoryStore(); let nonce = 0;
    const service = createMutationCapabilityService({ store, entropy: () => `secret-${++nonce}`, authority: { verify: async () => true }, currentness: { verify: async () => true } });
    const issued = await service.issue(grant, 1_000);
    await expect(service.consume(call(issued.token))).resolves.toMatchObject({ packetId: "p", status: "consumed" });
    await expect(service.consume(call(issued.token))).rejects.toThrow(/consumed/u);
    const cross = await service.issue(grant, 1_000); await expect(service.consume(call(cross.token, "other"))).rejects.toThrow(/worktree/u);
    const expired = await service.issue(grant, 1_000); await expect(service.consume({ ...call(expired.token), now: 2_001 })).rejects.toThrow(/expired/u);
    const revoked = await service.issue(grant, 1_000); await service.revoke(revoked.token, 1_001); await expect(service.consume(call(revoked.token))).rejects.toThrow(/revoked/u);
    const raced = await service.issue(grant, 1_000);
    const outcomes = await Promise.allSettled([service.consume(call(raced.token)), service.consume(call(raced.token))]);
    expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
  });

  it("routes read and controlled tools through the actual registry transport without leaking secrets", async () => {
    const store = new MemoryStore(); const service = createMutationCapabilityService({ store, entropy: () => "transport-secret", authority: { verify: async () => true }, currentness: { verify: async () => true } });
    const issued = await service.issue(grant, 1_000); const mutate = vi.fn(async () => ({ ok: true, apiToken: "must-not-leak" }));
    const server = createProjectorMcpServer({ capability: service, read: { "projector.query": async () => ({ units: ["unit:api"], secret: "drop" }) }, controlled: { "projector.write": mutate } });
    const listed = await server.transport.handle({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(listed).toMatchObject({ result: { tools: [{ name: "projector.query" }, { name: "projector.write" }] } });
    const read = await server.transport.handle({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "projector.query", arguments: {} } });
    expect(JSON.stringify(read)).not.toMatch(/secret|drop/u); expect(mutate).not.toHaveBeenCalled();
    const written = await server.transport.handle({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "projector.write", arguments: { capability: call(issued.token), value: "x" } } });
    expect(written).toMatchObject({ result: { content: [{ type: "json", value: { ok: true } }] } }); expect(mutate).toHaveBeenCalledOnce();
    const replay = await server.transport.handle({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "projector.write", arguments: { capability: call(issued.token) } } });
    expect(replay).toHaveProperty("error"); expect(mutate).toHaveBeenCalledOnce();
  });
});
