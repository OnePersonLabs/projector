import { analyzeLocalRepository } from "@projector/analyzers";
import { hashFramedDomain } from "@projector/core";
import { createProjectorMcpServer, PROJECTOR_MCP_TOOL_CATALOG, type JsonRpcRequest, type ProjectorMcpDependencies } from "@projector/integrations";

import { loadBuiltHostSession } from "./host-cli.js";

export interface BuiltMcpLifecycle { readonly status: "ready"; readonly tools: readonly string[]; readonly capabilityToken?: string; readonly transport: { handle(request: JsonRpcRequest): Promise<unknown> } }

export function createBuiltMcpCliPort() {
  return { async start(request: { readonly repositoryRoot: string; readonly signal: AbortSignal; readonly sessionSelector?: string }): Promise<BuiltMcpLifecycle> {
    const session = request.sessionSelector === undefined ? undefined : await loadBuiltHostSession({ repositoryRoot: request.repositoryRoot, sessionSelector: request.sessionSelector });
    const operationalNames = new Set<string>();
    const availability = () => PROJECTOR_MCP_TOOL_CATALOG.map((tool) => operationalNames.has(tool.name)
      ? { ...tool, operational: true }
      : { ...tool, operational: false, reason: "no production handler is registered" });
    const read: Record<string, ProjectorMcpDependencies["read"][string]> = {
      "projector.audit": async () => { const analysis = await analyzeLocalRepository({ repositoryRoot: request.repositoryRoot }); return { status: "ok", failures: analysis.failures }; },
      "projector.list_divergences": async () => { const analysis = await analyzeLocalRepository({ repositoryRoot: request.repositoryRoot }); return { status: "ok", failures: analysis.failures }; },
      "projector.status": async () => { const analysis = await analyzeLocalRepository({ repositoryRoot: request.repositoryRoot }); return { status: "ok", artifactCount: analysis.artifacts.length, unitCount: analysis.projectionUnits.length, failureCount: analysis.failures.length, toolAvailability: availability() }; },
    };
    const validRepresentation = session?.capsule.representation !== undefined
      && hashFramedDomain("representation-artifact", session.instructions.text) === session.capsule.representation.contentHash
      && JSON.stringify(session.instructions.representation) === JSON.stringify(session.capsule.representation);
    const representation = async (input: Readonly<Record<string, unknown>>, includeContent: boolean) => {
      if (!validRepresentation || session?.capsule.representation === undefined) throw new Error("authenticated session representation artifact is invalid");
      if (typeof input.projectionId === "string" && input.projectionId !== session.capsule.representation.projectionId) throw new Error("requested representation is not bound to the authenticated session");
      return { status: "valid", projection: session.capsule.representation, protectedDimensions: 11, ...(includeContent ? { content: session.instructions.text } : {}) };
    };
    if (validRepresentation) {
      read["projector.preview_representation"] = (input) => representation(input, true);
      read["projector.validate_representation"] = (input) => representation(input, false);
    }
    for (const name of Object.keys(read)) operationalNames.add(name);
    const server = createProjectorMcpServer({ read, controlled: {} });
    return { status: "ready", tools: server.registry.list().map(({ name }) => name), transport: server.transport };
  } };
}
