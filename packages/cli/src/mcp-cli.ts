import { analyzeLocalRepository } from "@projector/analyzers";
import { createProjectorMcpServer, loadAuthenticatedRepositorySession, PROJECTOR_MCP_TOOL_CATALOG, type JsonRpcRequest, type ProjectorMcpDependencies, type SessionRepresentationAuthentication } from "@projector/integrations";
import { inspectProjectActivation } from "@projector/runtime";

export interface BuiltMcpLifecycle { readonly status: "ready"; readonly tools: readonly string[]; readonly capabilityToken?: string; readonly transport: { handle(request: JsonRpcRequest): Promise<unknown> } }

export function createBuiltMcpCliPort(dependencies: { readonly analyze?: typeof analyzeLocalRepository; readonly inspectActivation?: typeof inspectProjectActivation } = {}) {
  return { async start(request: { readonly repositoryRoot: string; readonly signal: AbortSignal; readonly sessionSelector?: string }): Promise<BuiltMcpLifecycle> {
    const activation = await (dependencies.inspectActivation ?? inspectProjectActivation)(request.repositoryRoot);
    const enabled = activation.status === "enabled";
    const repositoryRoot = activation.repositoryRoot;
    const authenticated = !enabled || request.sessionSelector === undefined ? undefined : await loadAuthenticatedRepositorySession({ repositoryRoot, sessionSelector: request.sessionSelector });
    const representationAuthentication: SessionRepresentationAuthentication = authenticated?.representation ?? { status: "absent", reason: "no authenticated session is selected" };
    const representationUnavailableReason = representationAuthentication.status === "valid" ? "no production handler is registered" : representationAuthentication.reason;
    const operationalNames = new Set<string>();
    const availability = () => PROJECTOR_MCP_TOOL_CATALOG.map((tool) => operationalNames.has(tool.name)
      ? { ...tool, operational: true }
      : { ...tool, operational: false, reason: (tool.name === "projector.preview_representation" || tool.name === "projector.validate_representation") ? representationUnavailableReason : "no production handler is registered" });
    const read: Record<string, ProjectorMcpDependencies["read"][string]> = {
      "projector.audit": async () => {
        if (!enabled) return { status: "unavailable", reason: activation.reason };
        const analysis = await (dependencies.analyze ?? analyzeLocalRepository)({ repositoryRoot }); return { status: "ok", failures: analysis.failures };
      },
      "projector.list_divergences": async () => {
        if (!enabled) return { status: "unavailable", reason: activation.reason };
        const analysis = await (dependencies.analyze ?? analyzeLocalRepository)({ repositoryRoot }); return { status: "ok", divergences: analysis.divergences };
      },
      "projector.status": async () => {
        if (!enabled) return { status: "not-enabled", reason: activation.reason, toolAvailability: availability() };
        const analysis = await (dependencies.analyze ?? analyzeLocalRepository)({ repositoryRoot }); return { status: "ok", artifactCount: analysis.artifacts.length, unitCount: analysis.projectionUnits.length, failureCount: analysis.failures.length, toolAvailability: availability() };
      },
    };
    const representation = async (input: Readonly<Record<string, unknown>>, includeContent: boolean) => {
      if (representationAuthentication.status !== "valid") throw new Error(representationAuthentication.reason);
      if (typeof input.projectionId === "string" && input.projectionId !== representationAuthentication.projection.projectionId) throw new Error("requested representation is not bound to the authenticated session");
      return { status: "valid", projection: representationAuthentication.projection, protectedDimensions: 11, ...(includeContent ? { content: representationAuthentication.text } : {}) };
    };
    if (representationAuthentication.status === "valid") {
      read["projector.preview_representation"] = (input) => representation(input, true);
      read["projector.validate_representation"] = (input) => representation(input, false);
    }
    for (const name of Object.keys(read)) operationalNames.add(name);
    const server = createProjectorMcpServer({ read, controlled: {} });
    return { status: "ready", tools: server.registry.list().map(({ name }) => name), transport: server.transport };
  } };
}
