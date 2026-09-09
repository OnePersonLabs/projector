import { describe, expect, it, vi } from "vitest";
import { executeProjector } from "./cli.js";
import { createBuiltMcpCliPort } from "./mcp-cli.js";

function knowledgePort() {
  return {
    context: vi.fn(async ({ request, persist }: { request: string; persist: boolean }) => ({
      id: "knowledge:context:123", request, persisted: persist,
      interpretation: { status: "unresolved" as const, candidates: [], unknowns: [] }, branches: [],
      unknowns: ["No accepted meaning matches this request."],
    })),
    reconcile: vi.fn(async () => ({ contextId: "knowledge:context:123", status: "stale" as const, branches: [], reasons: ["A selected requirement changed."] })),
  };
}

describe("request-first knowledge CLI", () => {
  it("accepts a request and explicit meaning without an edit proposal", async () => {
    const knowledge = knowledgePort();
    const result = await executeProjector(["context", "Preserve meaning across another session", "--entity", "requirement:durable-meaning", "--format", "json"], { knowledge });
    expect(result.exitCode).toBe(0);
    expect(knowledge.context).toHaveBeenCalledWith(expect.objectContaining({
      request: "Preserve meaning across another session", entities: ["requirement:durable-meaning"], persist: true,
    }));
    expect(JSON.parse(result.output)).toMatchObject({ persisted: true, interpretation: { status: "unresolved" } });
  });

  it.each([["--dry-run"], ["--mode", "observe"], ["--audit-only"]])("keeps context inspection nonpersisting with %j", async (...flags) => {
    const knowledge = knowledgePort();
    await executeProjector(["context", "Inspect existing meaning", ...flags], { knowledge });
    expect(knowledge.context).toHaveBeenCalledWith(expect.objectContaining({ persist: false }));
  });

  it("reports stale knowledge as a stale result, not a successful clean check", async () => {
    const knowledge = knowledgePort();
    const result = await executeProjector(["reconcile", "knowledge:context:123"], { knowledge });
    expect(knowledge.reconcile).toHaveBeenCalledWith(expect.objectContaining({ contextId: "knowledge:context:123" }));
    expect(result.exitCode).toBe(4);
    expect(result.output).toContain("stale");
    expect(result.output).toContain("selected requirement changed");
  });

  it("does not report a successful check when current architectural predicates are violated", async () => {
    const knowledge = { ...knowledgePort(), reconcile: async () => ({ contextId: "knowledge:context:123", status: "current" as const, branches: [], reasons: [],
      governance: { status: "violated" as const, regeneratedContextId: "knowledge:context:new", branches: [], reasons: ["Forbidden dependency observed."] } }) };
    const result = await executeProjector(["reconcile", "knowledge:context:123"], { knowledge });
    expect(result.exitCode).toBe(2);
    expect(result.output).toContain("Current architecture: violated");
  });

  it("validates knowledge arguments before invoking the service", async () => {
    const knowledge = knowledgePort();
    await expect(executeProjector(["context"], { knowledge })).rejects.toThrow(/request/iu);
    await expect(executeProjector(["reconcile"], { knowledge })).rejects.toThrow(/context/iu);
    await expect(executeProjector(["reconcile", "../outside"], { knowledge })).rejects.toThrow(/identity|selector/iu);
    await expect(executeProjector(["audit", "--entity", "requirement:one"], { knowledge })).rejects.toThrow(/only valid with context/iu);
    await expect(executeProjector(["context", "\0"], { knowledge })).rejects.toThrow(/nonblank/iu);
    expect(knowledge.context).not.toHaveBeenCalled();
    expect(knowledge.reconcile).not.toHaveBeenCalled();
  });

  it("exposes bounded context and saved-context validation through the real MCP transport", async () => {
    const knowledge = knowledgePort();
    const mcp = await createBuiltMcpCliPort({ knowledge }).start({ repositoryRoot: process.cwd(), signal: new AbortController().signal });
    const response = await mcp.transport.handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: {
      name: "projector.context", arguments: { request: "Retain the request meaning", entities: ["requirement:durable-meaning"] },
    } });
    expect(response).toMatchObject({ result: { structuredContent: { persisted: false } } });
    expect(knowledge.context).toHaveBeenCalledWith(expect.objectContaining({ persist: false, entities: ["requirement:durable-meaning"] }));
    const validation = await mcp.transport.handle({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "projector.validate", arguments: { contextId: "knowledge:context:123" } } });
    expect(validation).toMatchObject({ result: { structuredContent: { status: "stale" } } });
    const invalid = await mcp.transport.handle({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "projector.context", arguments: { request: "context", repositoryRoot: "outside", persist: true } } });
    expect(invalid).toHaveProperty("error");
    expect(knowledge.context).toHaveBeenCalledTimes(1);
  });
});
