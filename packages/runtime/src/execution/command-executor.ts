import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

import type {
  AdapterContext,
  CommandSpec,
  StateBinding,
  StateBindingValidator,
  StateDigest,
} from "@projector/core";

import { PathSecurityError, type RepositoryPathService } from "../security/index.js";

export type ExecutionRefusalCode =
  | "command-refused"
  | "external-write-refused"
  | "invalid-command"
  | "network-refused"
  | "scope-refused"
  | "stale-binding"
  | "unsupported-isolation";

export class ExecutionRefusedError extends Error {
  readonly code: ExecutionRefusalCode;

  constructor(code: ExecutionRefusalCode, message: string) {
    super(message);
    this.name = "ExecutionRefusedError";
    this.code = code;
  }
}

export class ExecutionLimitError extends Error {
  readonly limit: "aborted" | "output" | "timeout";

  constructor(limit: "aborted" | "output" | "timeout", message: string) {
    super(message);
    this.name = "ExecutionLimitError";
    this.limit = limit;
  }
}

export class ExecutionCleanupError extends ExecutionLimitError {
  readonly cleanupError: unknown;
  readonly cleanup: ProcessCleanupObservation;

  constructor(limitError: ExecutionLimitError, cleanupError: unknown, cleanup: ProcessCleanupObservation) {
    super(limitError.limit, `${limitError.message}; owned process cleanup could not be confirmed`);
    this.name = "ExecutionCleanupError";
    this.cleanupError = cleanupError;
    this.cleanup = cleanup;
  }
}

export interface ProcessCleanupObservation {
  readonly rootProcessId: number;
  readonly rootExitObserved: boolean;
  readonly processGroupId?: number;
  readonly requested: "posix-process-group-sigkill" | "windows-taskkill-tree";
  readonly cleanupCommandExitCode?: number | null;
  readonly status: "reported-complete" | "unconfirmed";
  readonly reason?: string;
}

export interface ProcessLauncherCapabilities {
  filesystemIsolation: boolean;
  networkIsolation: boolean;
  cpuLimits: boolean;
  memoryLimits: boolean;
  externalWrites: boolean;
  readOnlyFileOverlays: boolean;
}

export interface ReadOnlyFileOverlay {
  readonly source: string;
  readonly target: string;
}

export interface ProcessLaunchRequest {
  executable: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  readRoots: string[];
  writeRoots: string[];
  readOnlyFileOverlays?: ReadOnlyFileOverlay[];
  network: "deny" | "allow";
  timeoutMs: number;
  cpuBudgetMs?: number;
  memoryBudgetMb?: number;
  maxOutputBytes: number;
  signal: AbortSignal;
}

export interface ProcessExecutionResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface ProcessLauncher {
  readonly capabilities: ProcessLauncherCapabilities;
  launch(request: ProcessLaunchRequest): Promise<ProcessExecutionResult>;
}

export interface CommandExecutionAuthorization {
  boundState: StateBinding;
  currentState: StateDigest;
  allowedCommandIds: readonly string[];
  declaredCommands: readonly CommandSpec[];
  allowedReadRoots: readonly string[];
  allowedWriteRoots: readonly string[];
  allowNetwork: boolean;
  allowExternalWrites: boolean;
  environment: Readonly<Record<string, string | undefined>>;
  maxOutputBytes: number;
  signal: AbortSignal;
}

export class StateBoundCommandExecutor {
  constructor(
    private readonly paths: RepositoryPathService,
    private readonly bindingValidator: StateBindingValidator,
    private readonly launcher: ProcessLauncher,
  ) {}

  async execute(
    spec: CommandSpec,
    authorization: CommandExecutionAuthorization,
  ): Promise<ProcessExecutionResult> {
    this.validateDeclaration(spec, authorization);

    const context: AdapterContext = {
      repositoryRoot: this.paths.root,
      stateDigest: authorization.currentState,
      config: {},
      signal: authorization.signal,
    };
    const binding = await this.bindingValidator.validate(
      authorization.boundState,
      authorization.currentState,
      context,
    );
    if (
      binding.status !== "current" &&
      (binding.status !== "rebound" || binding.rebound === undefined || !sameState(binding.rebound.compiledAgainst, authorization.currentState))
    ) {
      throw new ExecutionRefusedError(
        "stale-binding",
        `Command ${spec.id} is bound to ${binding.status} state: ${binding.reasons.join("; ")}`,
      );
    }

    let cwd: Awaited<ReturnType<RepositoryPathService["resolveScopedRead"]>>;
    let readRoots: string[];
    let writeRoots: string[];
    try {
      cwd = await this.paths.resolveScopedRead(spec.cwd, spec.readScope);
      await this.paths.resolveScopedRead(spec.cwd, authorization.allowedReadRoots);
      readRoots = await Promise.all(
        spec.readScope.map(async (scope) => {
          const resolved = await this.paths.resolveScopedRead(scope, authorization.allowedReadRoots);
          return resolved.realTarget;
        }),
      );
      writeRoots = await Promise.all(
        spec.writeScope.map(async (scope) => {
          const resolved = await this.paths.resolveScopedWrite(scope, authorization.allowedWriteRoots);
          return resolved.realTarget;
        }),
      );
    } catch (error) {
      if (error instanceof PathSecurityError) {
        throw new ExecutionRefusedError("scope-refused", error.message);
      }
      throw error;
    }

    this.validateLauncherCapabilities(spec);
    const env: Record<string, string> = {};
    for (const key of spec.environmentKeys) {
      const value = authorization.environment[key];
      if (value !== undefined) env[key] = value;
    }

    const executable = spec.argv[0];
    if (executable === undefined) {
      throw new ExecutionRefusedError("invalid-command", `Command ${spec.id} has no executable`);
    }
    return this.launcher.launch({
      executable,
      args: spec.argv.slice(1),
      cwd: cwd.realTarget,
      env,
      readRoots,
      writeRoots,
      network: spec.network,
      timeoutMs: spec.timeoutMs,
      ...(spec.cpuBudgetMs === undefined ? {} : { cpuBudgetMs: spec.cpuBudgetMs }),
      ...(spec.memoryBudgetMb === undefined ? {} : { memoryBudgetMb: spec.memoryBudgetMb }),
      maxOutputBytes: authorization.maxOutputBytes,
      signal: authorization.signal,
    });
  }

  private validateDeclaration(spec: CommandSpec, authorization: CommandExecutionAuthorization): void {
    if (
      !authorization.allowedCommandIds.includes(spec.id) ||
      !authorization.declaredCommands.some((declared) => sameCommand(declared, spec))
    ) {
      throw new ExecutionRefusedError("command-refused", `Command ${spec.id} does not match a plan-authorized declaration`);
    }
    if (spec.argv.length === 0 || spec.argv.some((argument) => argument.includes("\0"))) {
      throw new ExecutionRefusedError("invalid-command", `Command ${spec.id} has invalid argv`);
    }
    if (
      !isPositiveSafeInteger(spec.timeoutMs) ||
      !isPositiveSafeInteger(authorization.maxOutputBytes) ||
      (spec.cpuBudgetMs !== undefined && !isPositiveSafeInteger(spec.cpuBudgetMs)) ||
      (spec.memoryBudgetMb !== undefined && !isPositiveSafeInteger(spec.memoryBudgetMb))
    ) {
      throw new ExecutionRefusedError("invalid-command", `Command ${spec.id} has invalid resource limits`);
    }
    if ((spec.sideEffectClass === "none" || spec.sideEffectClass === "read-only") && spec.writeScope.length > 0) {
      throw new ExecutionRefusedError("scope-refused", `Read-only command ${spec.id} declares write scope`);
    }
    if (spec.network === "allow" && !authorization.allowNetwork) {
      throw new ExecutionRefusedError("network-refused", `Command ${spec.id} has no network grant`);
    }
    if (spec.sideEffectClass === "external-write" && !authorization.allowExternalWrites) {
      throw new ExecutionRefusedError("external-write-refused", `Command ${spec.id} has no external-write grant`);
    }
  }

  private validateLauncherCapabilities(spec: CommandSpec): void {
    const capabilities = this.launcher.capabilities;
    if (spec.cpuBudgetMs !== undefined && !capabilities.cpuLimits) {
      throw new ExecutionRefusedError("unsupported-isolation", "Host process launcher cannot enforce the requested CPU budget");
    }
    if (spec.memoryBudgetMb !== undefined && !capabilities.memoryLimits) {
      throw new ExecutionRefusedError("unsupported-isolation", "Host process launcher cannot enforce the requested memory budget");
    }
  }
}

function sameCommand(left: CommandSpec, right: CommandSpec): boolean {
  return (
    left.id === right.id &&
    sameStrings(left.argv, right.argv) &&
    left.cwd === right.cwd &&
    sameStrings(left.readScope, right.readScope) &&
    sameStrings(left.writeScope, right.writeScope) &&
    left.network === right.network &&
    sameStrings(left.environmentKeys, right.environmentKeys) &&
    left.sideEffectClass === right.sideEffectClass &&
    Object.is(left.timeoutMs, right.timeoutMs) &&
    Object.is(left.cpuBudgetMs, right.cpuBudgetMs) &&
    Object.is(left.memoryBudgetMb, right.memoryBudgetMb)
  );
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isSafeInteger(value) && value > 0;
}

function sameState(left: StateDigest, right: StateDigest): boolean {
  return (
    left.gitBase === right.gitBase &&
    left.worktreeDigest === right.worktreeDigest &&
    left.canonicalProjectorDigest === right.canonicalProjectorDigest &&
    left.toolchainDigest === right.toolchainDigest &&
    left.pinnedExternalSnapshotDigest === right.pinnedExternalSnapshotDigest
  );
}

export class NativeProcessLauncher implements ProcessLauncher {
  readonly capabilities: ProcessLauncherCapabilities = {
    filesystemIsolation: false,
    networkIsolation: false,
    cpuLimits: false,
    memoryLimits: false,
    externalWrites: false,
    readOnlyFileOverlays: false,
  };

  launch(request: ProcessLaunchRequest): Promise<ProcessExecutionResult> {
    return new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const child = spawn(request.executable, request.args, {
        cwd: request.cwd,
        env: request.env,
        detached: process.platform !== "win32",
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let outputBytes = 0;
      let limitError: ExecutionLimitError | undefined;
      let cleanup: Promise<ProcessCleanupObservation> | undefined;

      const stopFor = (error: ExecutionLimitError) => {
        if (limitError === undefined) {
          limitError = error;
          cleanup = terminateOwnedProcessTree(child);
        }
      };
      const capture = (target: Buffer[], chunk: Buffer) => {
        outputBytes += chunk.byteLength;
        if (outputBytes > request.maxOutputBytes) {
          stopFor(new ExecutionLimitError("output", `Process exceeded ${request.maxOutputBytes} output bytes`));
          return;
        }
        target.push(chunk);
      };
      child.stdout.on("data", (chunk: Buffer) => capture(stdout, chunk));
      child.stderr.on("data", (chunk: Buffer) => capture(stderr, chunk));

      const timeout = setTimeout(() => {
        stopFor(new ExecutionLimitError("timeout", `Process exceeded ${request.timeoutMs}ms`));
      }, request.timeoutMs);
      timeout.unref();
      const abort = () => stopFor(new ExecutionLimitError("aborted", "Process execution was aborted"));
      request.signal.addEventListener("abort", abort, { once: true });
      if (request.signal.aborted) abort();

      child.once("error", (error) => {
        clearTimeout(timeout);
        request.signal.removeEventListener("abort", abort);
        reject(error);
      });
      child.once("close", async (exitCode, signal) => {
        clearTimeout(timeout);
        request.signal.removeEventListener("abort", abort);
        if (limitError !== undefined) {
          try {
            if (cleanup === undefined) throw new Error("process limit was recorded without a cleanup attempt");
            const attempt = await cleanup;
            const observation: ProcessCleanupObservation = { ...attempt, rootExitObserved: true };
            if (observation.status === "unconfirmed") {
              reject(new ExecutionCleanupError(limitError, undefined, observation));
              return;
            }
          } catch (error) {
            reject(new ExecutionCleanupError(limitError, error, {
              rootProcessId: child.pid ?? -1,
              rootExitObserved: true,
              requested: process.platform === "win32" ? "windows-taskkill-tree" : "posix-process-group-sigkill",
              status: "unconfirmed",
              reason: error instanceof Error ? error.message : String(error),
            }));
            return;
          }
          reject(limitError);
          return;
        }
        resolve({
          exitCode,
          signal,
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
          durationMs: performance.now() - startedAt,
        });
      });
    });
  }
}

async function terminateOwnedProcessTree(child: ReturnType<typeof spawn>): Promise<ProcessCleanupObservation> {
  if (child.pid === undefined) throw new Error("spawned process has no owned process identifier");
  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
    return {
      rootProcessId: child.pid,
      rootExitObserved: false,
      processGroupId: child.pid,
      requested: "posix-process-group-sigkill",
      status: "unconfirmed",
      reason: "The owned process group received SIGKILL, but descendants that escaped into another session cannot be confirmed absent.",
    };
  }
  return new Promise<ProcessCleanupObservation>((resolve, reject) => {
    const cleanup = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      shell: false,
      windowsHide: true,
      stdio: "ignore",
    });
    cleanup.once("error", (error) => {
      child.kill("SIGKILL");
      reject(error);
    });
    cleanup.once("close", (code) => {
      if (code === 0) resolve({
        rootProcessId: child.pid!,
        rootExitObserved: false,
        requested: "windows-taskkill-tree",
        cleanupCommandExitCode: code,
        status: "reported-complete",
      });
      else {
        child.kill("SIGKILL");
        reject(new Error(`taskkill exited with code ${String(code)}`));
      }
    });
  });
}
