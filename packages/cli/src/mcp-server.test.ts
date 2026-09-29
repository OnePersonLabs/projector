import { InMemoryTransport } from "@modelcontextprotocol/server";
import { describe, expect, it, vi } from "vitest";
import { ResidentObservationWorkerPool } from "@projector/control-plane";
import { createProjectorMcpServer } from "./mcp-server.js";

function protocolClient(transport: InMemoryTransport) {
  let nextId = 1;
  const pending = new Map<number, (message: Record<string, unknown>) => void>();
  transport.onmessage = (message) => {
    const record = message as Record<string, unknown>;
    if (typeof record.id !== "number") return;
    pending.get(record.id)?.(record);
    pending.delete(record.id);
  };
  return {
    request(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
      const id = nextId++;
      const response = new Promise<Record<string, unknown>>((resolve) => pending.set(id, resolve));
      void transport.send({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) });
      return response;
    },
    notify(method: string): Promise<void> { return transport.send({ jsonrpc: "2.0", method }); },
  };
}

describe("resident MCP operation adapter", () => {
  it("initializes before loading the runner, advertises typed tools, and reuses the runner across calls", async () => {
    const execute = vi.fn(async (request: unknown) => ({
      apiVersion: "projector.operation-result/v1", operation: "status", package: { name: "projector", version: "3.0.0" },
      status: "succeeded", exitCode: 0, readiness: { status: "ready" }, output: { request },
    }));
    const runner = vi.fn(async () => ({ execute }));
    const pool = new ResidentObservationWorkerPool();
    const server = createProjectorMcpServer({ runner: runner as never, pool });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = protocolClient(clientTransport);
    await server.connect(serverTransport);
    await clientTransport.start();
    try {
      const initialized = await client.request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
      expect(initialized.result).toBeDefined();
      expect(runner).not.toHaveBeenCalled();
      await client.notify("notifications/initialized");
      const listed = await client.request("tools/list");
      const tools = (listed.result as { tools: { name: string; annotations?: { readOnlyHint?: boolean }; inputSchema: { properties: Record<string, unknown>; $defs?: Record<string, unknown> } }[] }).tools;
      const status = tools.find((tool) => tool.name === "projector_status");
      expect(status?.annotations?.readOnlyHint).toBe(true);
      expect(status?.inputSchema.properties).toHaveProperty("repositoryRoot");
      expect(tools.find((tool) => tool.name === "projector_change_apply")?.annotations?.readOnlyHint).toBe(false);
      expect(tools.find((tool) => tool.name === "projector_code_index_wait")?.inputSchema.properties).toHaveProperty("input");
      expect(tools.some((tool) => tool.name === "projector_context_inspect")).toBe(true);
      const captureSchema = tools.find((tool) => tool.name === "projector_change_capture")?.inputSchema;
      expect(captureSchema?.$defs).toBeDefined();
      expect(JSON.stringify(captureSchema)).toContain("#/$defs/");
      expect(runner).not.toHaveBeenCalled();

      const invalid = await client.request("tools/call", { name: "projector_status", arguments: { repositoryRoot: "C:/repo", input: { unexpected: true } } });
      expect(invalid.error ?? (invalid.result as { isError?: boolean })?.isError).toBeTruthy();
      expect(execute).not.toHaveBeenCalled();

      const validCapture = await client.request("tools/call", { name: "projector_change_capture", arguments: {
        repositoryRoot: "C:/repo",
        input: {
          request: "Add a focused requirement",
          proposal: {
            apiVersion: "projector.change-proposal/v1",
            requirements: [{ key: "mcp-schema-test", title: "MCP schema test", statement: "The nested proposal is retained." }],
            scenarios: [], architecture: null, canonicalMutations: [], edits: [],
            validation: { independentNodeTests: [], supplementalNodeTests: [] },
            analysisFacets: ["behavior", "architecture"],
          },
        },
      } });
      expect((validCapture.result as { structuredContent: { status: string } }).structuredContent.status).toBe("succeeded");
      expect(execute).toHaveBeenCalledTimes(1);
      expect((execute.mock.calls[0]?.[0] as { input: { proposal: { requirements: { key: string }[] } } }).input.proposal.requirements[0]?.key).toBe("mcp-schema-test");

      // This passes the advertised JSON Schema but violates a cross-field Core
      // invariant, proving the handler still applies the authoritative parser.
      const invalidNestedCapture = await client.request("tools/call", { name: "projector_change_capture", arguments: {
        repositoryRoot: "C:/repo",
        input: {
          request: "Add a focused requirement",
          proposal: {
            apiVersion: "projector.change-proposal/v1",
            requirements: [{ key: "mcp-schema-test", title: "MCP schema test", statement: "The nested proposal is retained." }],
            scenarios: [], architecture: null, canonicalMutations: [], edits: [],
            validation: { independentNodeTests: [], supplementalNodeTests: [] },
            analysisFacets: ["events", "security"],
          },
        },
      } });
      expect(invalidNestedCapture.error ?? (invalidNestedCapture.result as { isError?: boolean })?.isError).toBeTruthy();
      expect(execute).toHaveBeenCalledTimes(1);

      for (let index = 0; index < 2; index += 1) {
        const response = await client.request("tools/call", { name: "projector_status", arguments: { repositoryRoot: "C:/repo", input: {} } });
        expect((response.result as { structuredContent: { status: string } }).structuredContent.status).toBe("succeeded");
      }
      expect(runner).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledTimes(3);
    } finally {
      await clientTransport.close();
      await server.close();
      await pool.close();
    }
  });
});
