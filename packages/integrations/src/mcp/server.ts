import type { CapabilityRisk, MutationCapabilityService } from "./capabilities.js";

type Tool = (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
export interface ControlledTool { readonly operation: string; readonly risk: CapabilityRisk; readonly targets: (input: Readonly<Record<string, unknown>>) => { readonly semanticScopes: readonly string[]; readonly writePaths: readonly string[] }; readonly run: Tool }
export interface ProjectorMcpDependencies { readonly capability?: MutationCapabilityService; readonly read: Readonly<Record<string, Tool>>; readonly controlled: Readonly<Record<string, ControlledTool>> }
export interface JsonRpcRequest { readonly jsonrpc: "2.0"; readonly id: string | number | null; readonly method: string; readonly params?: unknown }
export interface ProjectorMcpCatalogEntry { readonly name: string; readonly class: "read" | "controlled" }

interface McpToolDefinition {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
}

const sensitiveKey = /(?:secret|token|password|authorization|credential)/iu;
const sensitiveValue = /(?:authorization\s*:|bearer\s+[a-z0-9._~+\/-]+|password\s*=|api[_-]?key\s*[=:]|token\s*[=:])/iu;
function sanitize(value: unknown): unknown {
  if (typeof value === "string") return sensitiveValue.test(value) ? "[REDACTED]" : value;
  if (Array.isArray(value)) return value.map(sanitize);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !sensitiveKey.test(key)).map(([key, item]) => [key, sanitize(item)]));
  return value;
}
function error(id: JsonRpcRequest["id"], code: number, message: string) { return { jsonrpc: "2.0" as const, id, error: { code, message: String(sanitize(message)).replace(/[\r\n]/gu, " ").slice(0, 240) } }; }

function toolDefinition(name: string, controlled: boolean): McpToolDefinition {
  const label = name.replace(/^projector\./u, "").replaceAll("_", " ");
  if (name === "projector.context") return {
    name, title: "Projector context", description: "Retrieve relevant accepted meaning, candidate interpretations, and architectural obligations before choosing edits. Does not save a context; use the context CLI command to retain one across sessions.",
    inputSchema: { type: "object", properties: { request: { type: "string", minLength: 1 }, entities: { type: "array", items: { type: "string", minLength: 1 } } }, required: ["request"], additionalProperties: false },
  };
  if (name === "projector.validate") return {
    name, title: "Projector validate knowledge", description: "Reconcile a saved context against current repository observations. Reports stale knowledge separately from current architectural conformance.",
    inputSchema: { type: "object", properties: { contextId: { type: "string", minLength: 1 } }, required: ["contextId"], additionalProperties: false },
  };
  return {
    name,
    title: `Projector ${label}`,
    description: controlled
      ? `Execute the approved Projector ${label} operation using a single-use, state-bound mutation capability.`
      : `Read authenticated Projector ${label} evidence for the current repository state.`,
    inputSchema: controlled
      ? { type: "object", properties: { capabilityToken: { type: "string", minLength: 1, description: "Single-use mutation capability issued by Projector." } }, required: ["capabilityToken"], additionalProperties: true }
      : { type: "object", additionalProperties: true },
  };
}

function toolResult(value: unknown) {
  const safe = sanitize(value);
  const serialized = typeof safe === "string" ? safe : JSON.stringify(safe) ?? String(safe);
  const structured = safe !== null && typeof safe === "object" && !Array.isArray(safe)
    ? { structuredContent: safe as Readonly<Record<string, unknown>> }
    : {};
  return { content: [{ type: "text" as const, text: serialized }], ...structured, isError: false };
}

export function createProjectorMcpServer(dependencies: ProjectorMcpDependencies) {
  const names = [...Object.keys(dependencies.read), ...Object.keys(dependencies.controlled)].sort();
  if (Object.keys(dependencies.controlled).length > 0 && dependencies.capability === undefined) throw new Error("controlled MCP handlers require a mutation capability service");
  const registry = {
    list: () => names.map((name) => toolDefinition(name, dependencies.controlled[name] !== undefined)),
    async call(name: string, input: Readonly<Record<string, unknown>>) {
      const reader = dependencies.read[name]; if (reader !== undefined) return sanitize(await reader(input));
      const controlled = dependencies.controlled[name]; if (controlled === undefined) throw new Error(`unknown MCP tool: ${name}`);
      const capabilityToken = input.capabilityToken; if (typeof capabilityToken !== "string") throw new Error("controlled MCP tool requires a mutation capability token");
      const { capabilityToken: omitted, ...boundedInput } = input; void omitted;
      const targets = controlled.targets(boundedInput);
      if (dependencies.capability === undefined) throw new Error("controlled MCP handler has no mutation capability service");
      await dependencies.capability.consume({ token: capabilityToken, toolName: name, operation: controlled.operation, semanticScopes: targets.semanticScopes, writePaths: targets.writePaths, risk: controlled.risk });
      return sanitize(await controlled.run(boundedInput));
    },
  };
  return { registry, transport: { async handle(request: JsonRpcRequest) {
    if (request.jsonrpc !== "2.0") return error(request.id, -32600, "invalid JSON-RPC version");
    if (request.method === "tools/list") return { jsonrpc: "2.0" as const, id: request.id, result: { tools: registry.list() } };
    if (request.method !== "tools/call") return error(request.id, -32601, "method not found");
    const params = request.params; if (params === null || typeof params !== "object") return error(request.id, -32602, "invalid tool call parameters");
    const { name, arguments: args } = params as { name?: unknown; arguments?: unknown };
    if (typeof name !== "string" || args === null || typeof args !== "object") return error(request.id, -32602, "invalid tool call parameters");
    try { return { jsonrpc: "2.0" as const, id: request.id, result: toolResult(await registry.call(name, args as Readonly<Record<string, unknown>>)) }; }
    catch (caught) { return error(request.id, -32001, caught instanceof Error ? caught.message : String(caught)); }
  } } };
}

const projectorReadToolNames = ["status", "audit", "explain", "context", "coverage", "list_divergences", "preview_plan", "preview_transform", "preview_representation", "validate_representation", "validate", "resolve_identity", "relevance", "requirements", "scenarios", "impact"].map((name) => `projector.${name}`);
const projectorControlledToolNames = ["apply_transform", "execute_packet", "accept_decision", "create_exception", "apply_plan"].map((name) => `projector.${name}`);

export const PROJECTOR_MCP_TOOL_CATALOG: readonly ProjectorMcpCatalogEntry[] = Object.freeze([
  ...projectorReadToolNames.map((name) => Object.freeze({ name, class: "read" as const })),
  ...projectorControlledToolNames.map((name) => Object.freeze({ name, class: "controlled" as const })),
]);
export const REQUIRED_PROJECTOR_READ_TOOLS = Object.freeze(PROJECTOR_MCP_TOOL_CATALOG.filter(({ class: toolClass }) => toolClass === "read").map(({ name }) => name));
export const REQUIRED_PROJECTOR_CONTROLLED_TOOLS = Object.freeze(PROJECTOR_MCP_TOOL_CATALOG.filter(({ class: toolClass }) => toolClass === "controlled").map(({ name }) => name));
