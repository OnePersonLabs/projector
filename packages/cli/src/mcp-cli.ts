import { analyzeLocalRepository } from "@projector/analyzers";
import { createProjectorMcpServer, loadAuthenticatedRepositorySession, PROJECTOR_MCP_TOOL_CATALOG, type JsonRpcRequest, type ProjectorMcpDependencies, type SessionRepresentationAuthentication } from "@projector/integrations";
import { inspectProjectActivation } from "@projector/runtime";
import { defaultKnowledgeCliPort, presentKnowledgeContext, presentKnowledgeReconciliation, type RepositoryKnowledgeCliPort } from "./knowledge-cli.js";

export interface BuiltMcpLifecycle { readonly status: "ready"; readonly tools: readonly string[]; readonly capabilityToken?: string; readonly transport: { handle(request: JsonRpcRequest): Promise<unknown> } }

export function createBuiltMcpCliPort(dependencies: { readonly analyze?: typeof analyzeLocalRepository; readonly inspectActivation?: typeof inspectProjectActivation; readonly knowledge?: RepositoryKnowledgeCliPort } = {}) {
  return { async start(request: { readonly repositoryRoot: string; readonly signal: AbortSignal; readonly sessionSelector?: string }): Promise<BuiltMcpLifecycle> {
    const inspectActivation = dependencies.inspectActivation ?? inspectProjectActivation;
    const activation = await inspectActivation(request.repositoryRoot);
    const repositoryRoot = activation.repositoryRoot;
    const currentActivation = async () => {
      const current = await inspectActivation(repositoryRoot);
      if (current.repositoryRoot !== repositoryRoot) {
        return { enabled: false as const, reason: "the MCP process repository binding is no longer available" };
      }
      return current.status === "enabled"
        ? { enabled: true as const }
        : { enabled: false as const, reason: current.reason };
    };
    const authenticated = activation.status !== "enabled" || request.sessionSelector === undefined ? undefined : await loadAuthenticatedRepositorySession({ repositoryRoot, sessionSelector: request.sessionSelector });
    const representationAuthentication: SessionRepresentationAuthentication = authenticated?.representation ?? { status: "absent", reason: "no authenticated session is selected" };
    const representationUnavailableReason = representationAuthentication.status === "valid" ? "no production handler is registered" : representationAuthentication.reason;
    const operationalNames = new Set<string>();
    const availability = () => PROJECTOR_MCP_TOOL_CATALOG.map((tool) => operationalNames.has(tool.name)
      ? { ...tool, operational: true }
      : { ...tool, operational: false, reason: (tool.name === "projector.preview_representation" || tool.name === "projector.validate_representation") ? representationUnavailableReason : "no production handler is registered" });
    const read: Record<string, ProjectorMcpDependencies["read"][string]> = {
      "projector.context": async (input) => {
        const current = await currentActivation();
        if (!current.enabled) return { status: "unavailable", reason: current.reason };
        if (Object.keys(input).some(key => key !== "request" && key !== "entities")) throw new Error("context accepts only request and optional entities");
        if (typeof input.request !== "string" || input.request.trim() === "" || input.request.includes("\0")) throw new Error("context requires a safe nonblank request");
        if (input.entities !== undefined && (!Array.isArray(input.entities) || input.entities.some(value => typeof value !== "string" || value.trim() === "" || value.includes("\0")))) throw new Error("entities must be nonblank identities");
        return presentKnowledgeContext(await (dependencies.knowledge ?? defaultKnowledgeCliPort()).context({ repositoryRoot, request: input.request,
          ...(input.entities === undefined ? {} : { entities: input.entities as string[] }), persist: false, signal: request.signal }));
      },
      "projector.validate": async (input) => {
        const current = await currentActivation();
        if (!current.enabled) return { status: "unavailable", reason: current.reason };
        if (Object.keys(input).some(key => key !== "contextId") || typeof input.contextId !== "string" || !/^[a-z0-9][a-z0-9._:-]*$/iu.test(input.contextId)) throw new Error("validate requires a saved contextId");
        return presentKnowledgeReconciliation(await (dependencies.knowledge ?? defaultKnowledgeCliPort()).reconcile({ repositoryRoot, contextId: input.contextId, signal: request.signal }));
      },
      "projector.audit": async () => {
        const current = await currentActivation();
        if (!current.enabled) return { status: "unavailable", reason: current.reason };
        const analysis = await (dependencies.analyze ?? analyzeLocalRepository)({ repositoryRoot }); return { status: "ok", failures: analysis.failures };
      },
      "projector.list_divergences": async () => {
        const current = await currentActivation();
        if (!current.enabled) return { status: "unavailable", reason: current.reason };
        const analysis = await (dependencies.analyze ?? analyzeLocalRepository)({ repositoryRoot }); return { status: "ok", divergences: analysis.divergences };
      },
      "projector.status": async () => {
        const current = await currentActivation();
        if (!current.enabled) return { status: "not-enabled", reason: current.reason, toolAvailability: availability() };
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
