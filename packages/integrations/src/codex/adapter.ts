import { hashFramedDomain, type AdapterContext, type ContentHash, type ExecutionCapsule, type StateBinding, type StateBindingValidator, type StateDigest } from "@projector/core";

export type HostName = "codex" | "claude";
export type HostFeature = "instruction-installation" | "lifecycle-hooks" | "programmatic-execution" | "subagents" | "isolated-worktrees" | "structured-result" | "tool-observation" | "filesystem-observation" | "cancellation" | "state-capability";

export interface HostProbe {
  executable(name: string): Promise<boolean>;
  feature(name: HostFeature): Promise<boolean>;
}

export interface HostCapabilities {
  readonly host: HostName;
  readonly level: 1 | 2 | 3;
  readonly executable: boolean;
  readonly instructionInstallation: boolean;
  readonly lifecycleHooks: boolean;
  readonly programmaticExecution: boolean;
  readonly subagents: boolean;
  readonly isolatedWorktrees: boolean;
  readonly structuredResult: boolean;
  readonly toolObservation: boolean;
  readonly filesystemObservation: boolean;
  readonly cancellation: boolean;
  readonly stateCapability: boolean;
  readonly enforcement: "instruction-only" | "observed" | "state-bound";
}

export interface HostRunRequest {
  readonly sessionId: string;
  readonly repositoryRoot: string;
  readonly argv: readonly string[];
  readonly environment: Readonly<Record<string, string>>;
  readonly allowedEnvironmentKeys: readonly string[];
  readonly capsule: ExecutionCapsule;
  readonly binding: StateBinding;
  readonly currentState: StateDigest;
  readonly instructions: { readonly text: string; readonly sourceHashes: readonly ContentHash[]; readonly representationId: string };
  readonly signal: AbortSignal;
}

export interface HostObservation { readonly state: StateDigest; readonly paths: readonly string[]; readonly contentHash: ContentHash }
export interface HostRunPorts {
  readonly bindingValidator: StateBindingValidator;
  readonly authority: { verify(input: { readonly sessionId: string; readonly capsule: ExecutionCapsule; readonly binding: StateBinding; readonly currentState: StateDigest }): Promise<boolean> };
  readonly journal: {
    prepare(input: { readonly requestHash: ContentHash; readonly host: HostName; readonly capsuleHash: ContentHash }): Promise<{ readonly id: string; readonly contentHash: ContentHash }>;
    finish(input: { readonly journalId: string; readonly status: HostRunResult["status"]; readonly before: HostObservation; readonly after: HostObservation; readonly failure?: string }): Promise<void>;
  };
  readonly observe: { capture(input: { readonly phase: "before" | "after"; readonly repositoryRoot: string }): Promise<HostObservation> };
  readonly launcher: { launch(input: { readonly executable: string; readonly args: readonly string[]; readonly cwd: string; readonly env: Readonly<Record<string, string>>; readonly signal: AbortSignal; readonly instructions: HostRunRequest["instructions"] }): Promise<{ readonly exitCode: number; readonly signal?: string }> };
  readonly reconcile: { run(input: { readonly capsule: ExecutionCapsule; readonly before: HostObservation; readonly after: HostObservation; readonly launch: { readonly exitCode: number; readonly signal?: string } | undefined; readonly failure?: string }): Promise<{ readonly status: "completed" | "recovered" | "failed"; readonly changedPaths: readonly string[] }> };
}

export interface HostRunResult { readonly status: "completed" | "recovered" | "failed" | "manual"; readonly changedPaths: readonly string[]; readonly journalId?: string; readonly failure?: string }

export interface HostAdapter { capabilities(): Promise<HostCapabilities>; run(request: HostRunRequest, ports: HostRunPorts): Promise<HostRunResult> }

export interface HostAdapterDependencies { readonly probe: HostProbe }

function sameState(left: StateDigest, right: StateDigest): boolean {
  return hashFramedDomain("host-current-state", left) === hashFramedDomain("host-current-state", right);
}

export function createHostAdapter(host: HostName, executable: string, dependencies: HostAdapterDependencies): HostAdapter {
  async function capabilities(): Promise<HostCapabilities> {
    const available = await dependencies.probe.executable(executable);
    const enabled = async (feature: HostFeature): Promise<boolean> => available && dependencies.probe.feature(feature);
    const [instructionInstallation, lifecycleHooks, programmaticExecution, subagents, isolatedWorktrees, structuredResult, toolObservation, filesystemObservation, cancellation, stateCapability] = await Promise.all([
      enabled("instruction-installation"), enabled("lifecycle-hooks"), enabled("programmatic-execution"), enabled("subagents"), enabled("isolated-worktrees"), enabled("structured-result"), enabled("tool-observation"), enabled("filesystem-observation"), enabled("cancellation"), enabled("state-capability"),
    ]);
    const observable = toolObservation || filesystemObservation || lifecycleHooks;
    const level: 1 | 2 | 3 = available && programmaticExecution && structuredResult && observable && stateCapability ? 3 : available && (programmaticExecution || observable) ? 2 : 1;
    return { host, level, executable: available, instructionInstallation, lifecycleHooks, programmaticExecution, subagents, isolatedWorktrees, structuredResult, toolObservation, filesystemObservation, cancellation, stateCapability, enforcement: level === 3 ? "state-bound" : level === 2 ? "observed" : "instruction-only" };
  }

  return {
    capabilities,
    async run(request, ports) {
      const capability = await capabilities();
      if (!capability.executable) return { status: "manual", changedPaths: [], failure: `${host} executable is unavailable` };
      if (request.binding.dependencyDigest !== request.capsule.boundState.dependencyDigest) throw new Error("host binding does not match execution capsule");
      const context: AdapterContext = { repositoryRoot: request.repositoryRoot, stateDigest: request.currentState, config: {}, signal: request.signal };
      const validation = await ports.bindingValidator.validate(request.binding, request.currentState, context);
      if (validation.status !== "current" && validation.status !== "rebound") throw new Error(`host StateBinding is ${validation.status}`);
      const effectiveBinding = validation.status === "rebound" ? validation.rebound : request.binding;
      if (effectiveBinding === undefined || !sameState(effectiveBinding.compiledAgainst, request.currentState) || effectiveBinding.dependencyDigest !== request.binding.dependencyDigest) throw new Error("host StateBinding rebound is unauthenticated");
      if (!request.instructions.sourceHashes.includes(request.capsule.normativeKernelHash)) throw new Error("host instructions omit the normative kernel source");
      if (!await ports.authority.verify({ sessionId: request.sessionId, capsule: request.capsule, binding: effectiveBinding, currentState: request.currentState })) throw new Error("host authority is absent or stale");
      const requestHash = hashFramedDomain("host-run-request", { sessionId: request.sessionId, repositoryRoot: request.repositoryRoot, argv: request.argv, environmentKeys: request.allowedEnvironmentKeys, capsuleHash: request.capsule.contextHash, bindingDigest: effectiveBinding.dependencyDigest, currentState: request.currentState, instructions: request.instructions });
      const capsuleHash = hashFramedDomain("host-execution-capsule", request.capsule);
      const journal = await ports.journal.prepare({ requestHash, host, capsuleHash });
      const before = await ports.observe.capture({ phase: "before", repositoryRoot: request.repositoryRoot });
      const allow = new Set(request.allowedEnvironmentKeys);
      const env = Object.fromEntries(Object.entries(request.environment).filter(([key]) => allow.has(key)));
      let launch: { readonly exitCode: number; readonly signal?: string } | undefined;
      let failure: string | undefined;
      try {
        launch = await ports.launcher.launch({ executable, args: [...request.argv], cwd: request.repositoryRoot, env, signal: request.signal, instructions: request.instructions });
      } catch (error) {
        failure = request.signal.aborted ? "host cancelled" : error instanceof Error ? error.message : String(error);
      }
      const after = await ports.observe.capture({ phase: "after", repositoryRoot: request.repositoryRoot });
      const reconciled = await ports.reconcile.run({ capsule: request.capsule, before, after, launch, ...(failure === undefined ? {} : { failure }) });
      const status = reconciled.status;
      await ports.journal.finish({ journalId: journal.id, status, before, after, ...(failure === undefined ? {} : { failure }) });
      return { status, changedPaths: [...reconciled.changedPaths], journalId: journal.id, ...(failure === undefined ? {} : { failure }) };
    },
  };
}

export function createCodexHostAdapter(dependencies: HostAdapterDependencies): HostAdapter {
  return createHostAdapter("codex", "codex", dependencies);
}
