import type { MutationCapabilityService } from "./capabilities.js";

type Tool = (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
export interface ProjectorMcpDependencies { readonly capability: MutationCapabilityService; readonly read: Readonly<Record<string, Tool>>; readonly controlled: Readonly<Record<string, Tool>> }
export interface JsonRpcRequest { readonly jsonrpc: "2.0"; readonly id: string | number | null; readonly method: string; readonly params?: unknown }

const sensitive = /(?:secret|token|password|authorization|credential)/iu;
function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !sensitive.test(key)).map(([key, item]) => [key, sanitize(item)]));
  return value;
}
function error(id: JsonRpcRequest["id"], code: number, message: string) { return { jsonrpc: "2.0" as const, id, error: { code, message: message.replace(/[\r\n]/gu, " ").slice(0, 240) } }; }

export function createProjectorMcpServer(dependencies: ProjectorMcpDependencies) {
  const names = [...Object.keys(dependencies.read), ...Object.keys(dependencies.controlled)].sort();
  const registry = {
    list: () => names.map((name) => ({ name })),
    async call(name: string, input: Readonly<Record<string, unknown>>) {
      const reader = dependencies.read[name]; if (reader !== undefined) return sanitize(await reader(input));
      const controlled = dependencies.controlled[name]; if (controlled === undefined) throw new Error(`unknown MCP tool: ${name}`);
      const capability = input.capability;
      if (capability === null || typeof capability !== "object") throw new Error("controlled MCP tool requires a mutation capability");
      await dependencies.capability.consume(capability as Parameters<MutationCapabilityService["consume"]>[0]);
      const { capability: omitted, ...boundedInput } = input; void omitted;
      return sanitize(await controlled(boundedInput));
    },
  };
  return {
    registry,
    transport: {
      async handle(request: JsonRpcRequest) {
        if (request.method === "tools/list") return { jsonrpc: "2.0" as const, id: request.id, result: { tools: registry.list() } };
        if (request.method !== "tools/call") return error(request.id, -32601, "method not found");
        const params = request.params;
        if (params === null || typeof params !== "object") return error(request.id, -32602, "invalid tool call parameters");
        const { name, arguments: args } = params as { name?: unknown; arguments?: unknown };
        if (typeof name !== "string" || args === null || typeof args !== "object") return error(request.id, -32602, "invalid tool call parameters");
        try { return { jsonrpc: "2.0" as const, id: request.id, result: { content: [{ type: "json", value: await registry.call(name, args as Readonly<Record<string, unknown>>) }] } }; }
        catch (caught) { return error(request.id, -32001, caught instanceof Error ? caught.message : String(caught)); }
      },
    },
  };
}
