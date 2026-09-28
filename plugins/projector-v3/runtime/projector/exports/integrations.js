import {
  FakeSurfaceAdapter,
  FileExternalOperationJournal,
  FileSurfaceSnapshotStore,
  InMemoryExternalOperationJournal,
  captureAndPersistSurfaceSnapshot,
  captureSurfaceSnapshot,
  executeSurfacePlan,
  rebuildPinnedSurfaceSnapshot
} from "../chunks/shared-RGZTUUFR.js";
import {
  InferenceFailure,
  runStructuredInference
} from "../chunks/shared-COR67UF3.js";
import {
  CodexExecProviderError,
  DISABLED_CODEX_EXEC_FEATURES,
  SpawnCodexProcessRunner,
  authenticateRepresentationBinding,
  createCodexExecProvider,
  createCodexExecRouter,
  createCodexHostAdapter,
  createHostAdapter,
  createHostSessionRecord,
  hostSessionSelector,
  loadAuthenticatedRepositorySession
} from "../chunks/shared-ZRCOKSFN.js";
import "../chunks/shared-WYYVWFGB.js";
import "../chunks/shared-3PXVRXWV.js";
import "../chunks/shared-KWLM6SLK.js";
import "../chunks/shared-2U2MJHPJ.js";
import "../chunks/shared-HEBLUKDF.js";
import {
  hashFramedDomain
} from "../chunks/shared-AJ5KBTH5.js";
import "../chunks/shared-WC2OT3WX.js";

// node_modules/@projector/integrations/dist/claude/adapter.js
function createClaudeHostAdapter(dependencies) {
  return createHostAdapter("claude", "claude", dependencies);
}

// node_modules/@projector/integrations/dist/mcp/capabilities.js
import { randomBytes } from "node:crypto";
import { realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
function createNodeCapabilitySecurityPorts() {
  return {
    entropy: () => new Uint8Array(randomBytes(32)),
    clock: { now: () => Date.now() },
    roots: {
      resolveRoot: async (root) => realpath(root),
      resolveTarget: async (canonicalRoot, path) => {
        if (isAbsolute(path) || path.replace(/\\/gu, "/").split("/").includes(".."))
          return void 0;
        const target = resolve(canonicalRoot, path);
        const rel = relative(canonicalRoot, target).replace(/\\/gu, "/");
        if (rel === "" || rel.startsWith("../") || isAbsolute(rel))
          return void 0;
        try {
          const canonicalParent = await realpath(dirname(target));
          if (canonicalParent !== canonicalRoot && !canonicalParent.startsWith(`${canonicalRoot}/`))
            return void 0;
        } catch {
          return void 0;
        }
        return rel;
      }
    }
  };
}
var risk = /* @__PURE__ */ new Map([["R0", 0], ["R1", 1], ["R2", 2], ["R3", 3], ["R4", 4]]);
function matches(scope, value) {
  if (scope === value || scope === "*" || scope === "**")
    return true;
  return scope.endsWith("/**") && (value === scope.slice(0, -3) || value.startsWith(scope.slice(0, -2)));
}
function tokenHash(token) {
  return hashFramedDomain("mcp-mutation-capability-token", token);
}
function tokenFrom(bytes) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}
function bindingAuthentic(binding) {
  return binding.dependencyDigest === hashFramedDomain("state-binding-dependencies", { valueDependencies: binding.valueDependencies, queryDependencies: binding.queryDependencies });
}
function now(dependencies) {
  const value = dependencies.clock.now();
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error("trusted capability clock is invalid");
  return value;
}
function createMutationCapabilityService(dependencies) {
  return {
    async issue(grant) {
      const issuedAt = now(dependencies);
      if (grant.expiresAt <= issuedAt || !bindingAuthentic(grant.binding))
        throw new Error("capability expiry or StateBinding is invalid");
      const canonicalRoot = await dependencies.roots.resolveRoot(grant.repositoryRoot);
      if (!await dependencies.authority.verify(grant))
        throw new Error("capability authority is absent or stale");
      const normalized = { ...grant, repositoryRoot: canonicalRoot, toolNames: [...new Set(grant.toolNames)].sort(), operations: [...new Set(grant.operations)].sort(), semanticScopes: [...new Set(grant.semanticScopes)].sort(), writeScopes: [...new Set(grant.writeScopes)].sort() };
      const grantHash = hashFramedDomain("mcp-mutation-capability-grant", normalized);
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const bytes = dependencies.entropy();
        if (bytes.byteLength < 32)
          throw new Error("capability requires at least 256 bits of cryptographic entropy");
        const token = tokenFrom(bytes);
        const record = { ...normalized, canonicalRoot, tokenHash: tokenHash(token), grantHash, issuedAt, revision: 1, status: "active", changedAt: issuedAt };
        if (await dependencies.store.issue(record))
          return { token, grantHash };
      }
      throw new Error("capability issuance collision");
    },
    async revoke(token) {
      const changedAt = now(dependencies);
      const key = tokenHash(token);
      const record = await dependencies.store.read(key);
      if (record === void 0)
        throw new Error("capability is unknown");
      if (record.status !== "active")
        throw new Error(`capability is ${record.status}`);
      if (!await dependencies.currentness.verify({ record, now: changedAt }))
        throw new Error("capability revocation currentness failed");
      if (!await dependencies.store.compareAndSwap(key, record.revision, { ...record, status: "revoked", revision: record.revision + 1, changedAt }))
        throw new Error("capability revocation conflict");
    },
    async consume(use) {
      const consumedAt = now(dependencies);
      const key = tokenHash(use.token);
      const record = await dependencies.store.read(key);
      if (record === void 0)
        throw new Error("capability is unknown");
      if (record.status !== "active")
        throw new Error(`capability is ${record.status}`);
      if (consumedAt > record.expiresAt)
        throw new Error("capability is expired");
      if (!record.toolNames.includes(use.toolName))
        throw new Error("capability registry tool mismatch");
      if (!record.operations.includes(use.operation))
        throw new Error("capability operation is not granted");
      if ((risk.get(use.risk) ?? Number.POSITIVE_INFINITY) > (risk.get(record.maximumRisk) ?? -1))
        throw new Error("capability risk exceeded");
      if (!use.semanticScopes.every((target) => record.semanticScopes.some((scope) => matches(scope, target))))
        throw new Error("capability semantic scope mismatch");
      const resolved = await Promise.all(use.writePaths.map((path) => dependencies.roots.resolveTarget(record.canonicalRoot, path)));
      if (resolved.some((path) => path === void 0) || !resolved.every((path) => record.writeScopes.some((scope) => matches(scope, path))))
        throw new Error("capability target escapes its write scope");
      const trustedUse = { toolName: use.toolName, operation: use.operation, semanticScopes: [...use.semanticScopes], writePaths: resolved, risk: use.risk };
      if (!await dependencies.currentness.verify({ record, use: trustedUse, now: consumedAt }))
        throw new Error("capability currentness failed");
      const consumed = { ...record, status: "consumed", revision: record.revision + 1, changedAt: consumedAt };
      if (!await dependencies.store.compareAndSwap(key, record.revision, consumed))
        throw new Error("capability was concurrently consumed");
      return consumed;
    }
  };
}

// node_modules/@projector/integrations/dist/mcp/server.js
var sensitiveKey = /(?:secret|token|password|authorization|credential)/iu;
var sensitiveValue = /(?:authorization\s*:|bearer\s+[a-z0-9._~+\/-]+|password\s*=|api[_-]?key\s*[=:]|token\s*[=:])/iu;
function sanitize(value) {
  if (typeof value === "string")
    return sensitiveValue.test(value) ? "[REDACTED]" : value;
  if (Array.isArray(value))
    return value.map(sanitize);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(Object.entries(value).filter(([key]) => !sensitiveKey.test(key)).map(([key, item]) => [key, sanitize(item)]));
  return value;
}
function error(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message: String(sanitize(message)).replace(/[\r\n]/gu, " ").slice(0, 240) } };
}
function toolDefinition(name, controlled) {
  const label = name.replace(/^projector\./u, "").replaceAll("_", " ");
  if (name === "projector.context")
    return {
      name,
      title: "Projector context",
      description: "Retrieve a bounded overview of relevant accepted meaning, candidate interpretations, explicit omissions, and architectural obligations before choosing edits. Repeat the call with a returned entity ID in entities for focused disclosure. Does not save a context; use the context CLI command to retain one across sessions.",
      inputSchema: { type: "object", properties: { request: { type: "string", minLength: 1 }, entities: { type: "array", items: { type: "string", minLength: 1 } } }, required: ["request"], additionalProperties: false }
    };
  if (name === "projector.validate")
    return {
      name,
      title: "Projector validate knowledge",
      description: "Reconcile a saved context against current repository observations. Reports stale knowledge separately from current architectural conformance.",
      inputSchema: { type: "object", properties: { contextId: { type: "string", minLength: 1 } }, required: ["contextId"], additionalProperties: false }
    };
  return {
    name,
    title: `Projector ${label}`,
    description: controlled ? `Execute the approved Projector ${label} operation using a single-use, state-bound mutation capability.` : `Read authenticated Projector ${label} evidence for the current repository state.`,
    inputSchema: controlled ? { type: "object", properties: { capabilityToken: { type: "string", minLength: 1, description: "Single-use mutation capability issued by Projector." } }, required: ["capabilityToken"], additionalProperties: true } : { type: "object", additionalProperties: true }
  };
}
function toolResult(value) {
  const safe = sanitize(value);
  const serialized = typeof safe === "string" ? safe : JSON.stringify(safe) ?? String(safe);
  const structured = safe !== null && typeof safe === "object" && !Array.isArray(safe) ? { structuredContent: safe } : {};
  return { content: [{ type: "text", text: serialized }], ...structured, isError: false };
}
function createProjectorMcpServer(dependencies) {
  const names = [...Object.keys(dependencies.read), ...Object.keys(dependencies.controlled)].sort();
  if (Object.keys(dependencies.controlled).length > 0 && dependencies.capability === void 0)
    throw new Error("controlled MCP handlers require a mutation capability service");
  const registry = {
    list: () => names.map((name) => {
      const controlled = dependencies.controlled[name] !== void 0;
      return { ...toolDefinition(name, controlled), annotations: {
        readOnlyHint: !controlled,
        destructiveHint: controlled,
        idempotentHint: !controlled,
        openWorldHint: controlled
      } };
    }),
    async call(name, input) {
      const reader = dependencies.read[name];
      if (reader !== void 0)
        return sanitize(await reader(input));
      const controlled = dependencies.controlled[name];
      if (controlled === void 0)
        throw new Error(`unknown MCP tool: ${name}`);
      const capabilityToken = input.capabilityToken;
      if (typeof capabilityToken !== "string")
        throw new Error("controlled MCP tool requires a mutation capability token");
      const { capabilityToken: omitted, ...boundedInput } = input;
      void omitted;
      const targets = controlled.targets(boundedInput);
      if (dependencies.capability === void 0)
        throw new Error("controlled MCP handler has no mutation capability service");
      await dependencies.capability.consume({ token: capabilityToken, toolName: name, operation: controlled.operation, semanticScopes: targets.semanticScopes, writePaths: targets.writePaths, risk: controlled.risk });
      return sanitize(await controlled.run(boundedInput));
    }
  };
  return { registry, transport: { async handle(request) {
    if (request.jsonrpc !== "2.0")
      return error(request.id, -32600, "invalid JSON-RPC version");
    if (request.method === "tools/list")
      return { jsonrpc: "2.0", id: request.id, result: { tools: registry.list() } };
    if (request.method !== "tools/call")
      return error(request.id, -32601, "method not found");
    const params = request.params;
    if (params === null || typeof params !== "object")
      return error(request.id, -32602, "invalid tool call parameters");
    const { name, arguments: args } = params;
    if (typeof name !== "string" || args === null || typeof args !== "object")
      return error(request.id, -32602, "invalid tool call parameters");
    try {
      return { jsonrpc: "2.0", id: request.id, result: toolResult(await registry.call(name, args)) };
    } catch (caught) {
      return error(request.id, -32001, caught instanceof Error ? caught.message : String(caught));
    }
  } } };
}
var projectorReadToolNames = ["status", "audit", "explain", "context", "coverage", "list_divergences", "preview_plan", "preview_transform", "preview_representation", "validate_representation", "validate", "resolve_identity", "relevance", "requirements", "scenarios", "impact"].map((name) => `projector.${name}`);
var projectorControlledToolNames = ["apply_transform", "execute_packet", "accept_decision", "create_exception", "apply_plan"].map((name) => `projector.${name}`);
var PROJECTOR_MCP_TOOL_CATALOG = Object.freeze([
  ...projectorReadToolNames.map((name) => Object.freeze({ name, class: "read" })),
  ...projectorControlledToolNames.map((name) => Object.freeze({ name, class: "controlled" }))
]);
var REQUIRED_PROJECTOR_READ_TOOLS = Object.freeze(PROJECTOR_MCP_TOOL_CATALOG.filter(({ class: toolClass }) => toolClass === "read").map(({ name }) => name));
var REQUIRED_PROJECTOR_CONTROLLED_TOOLS = Object.freeze(PROJECTOR_MCP_TOOL_CATALOG.filter(({ class: toolClass }) => toolClass === "controlled").map(({ name }) => name));
export {
  CodexExecProviderError,
  DISABLED_CODEX_EXEC_FEATURES,
  FakeSurfaceAdapter,
  FileExternalOperationJournal,
  FileSurfaceSnapshotStore,
  InMemoryExternalOperationJournal,
  InferenceFailure,
  PROJECTOR_MCP_TOOL_CATALOG,
  REQUIRED_PROJECTOR_CONTROLLED_TOOLS,
  REQUIRED_PROJECTOR_READ_TOOLS,
  SpawnCodexProcessRunner,
  authenticateRepresentationBinding,
  captureAndPersistSurfaceSnapshot,
  captureSurfaceSnapshot,
  createClaudeHostAdapter,
  createCodexExecProvider,
  createCodexExecRouter,
  createCodexHostAdapter,
  createHostAdapter,
  createHostSessionRecord,
  createMutationCapabilityService,
  createNodeCapabilitySecurityPorts,
  createProjectorMcpServer,
  executeSurfacePlan,
  hostSessionSelector,
  loadAuthenticatedRepositorySession,
  rebuildPinnedSurfaceSnapshot,
  runStructuredInference
};
