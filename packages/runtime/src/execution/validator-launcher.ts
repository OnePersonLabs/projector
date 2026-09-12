import { mkdir, mkdtemp, realpath, rm, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { delimiter, isAbsolute, join, relative } from "node:path";

import { NativeProcessLauncher, configuredHostAssumptions, type ProcessLauncher, type ProcessLaunchRequest, type ProcessExecutionResult } from "./command-executor.js";

/** A command sandbox only: no model call, login, or administrator setup. */
export class CodexReadOnlyValidatorLauncher implements ProcessLauncher {
  readonly capabilities = { cpuLimits: false, memoryLimits: false };
  private readonly native = new NativeProcessLauncher();

  constructor(private readonly executable?: string) {
    if (executable !== undefined && !isAbsolute(executable)) throw new Error("Validator Codex override must be an absolute executable path");
  }

  async launch(request: ProcessLaunchRequest): Promise<ProcessExecutionResult> {
    if (request.signal.aborted) throw new Error("Validator execution was cancelled before sandbox startup");
    if (request.cpuBudgetMs !== undefined || request.memoryBudgetMb !== undefined) {
      throw new Error("Codex validator sandbox does not enforce CPU or memory budgets");
    }
    const executable = this.executable ?? await resolveHostCodex(request.cwd);
    const homes = join(homedir(), ".cache", "projector", "validator-homes");
    await mkdir(homes, { recursive: true });
    const home = await mkdtemp(join(homes, "codex-"));
    try {
      // An owned empty home prevents user/project configuration from selecting
      // a different backend. The built-in profile fixes permissions explicitly.
      const environment: Record<string, string> = {};
      for (const key of ["SystemRoot", "PATH"]) {
        if (process.env[key] !== undefined) environment[key] = process.env[key]!;
      }
      return await this.native.launch({
        ...request,
        executable,
        args: ["sandbox", "--permission-profile", ":read-only", "-c", 'windows.sandbox="unelevated"', "--cd", request.cwd, "--", request.executable, ...request.args],
        env: { ...environment, ...request.env, TEMP: tmpdir(), TMP: tmpdir(), CODEX_HOME: home },
      });
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  }
}

async function resolveHostCodex(cwd: string): Promise<string> {
  const repository = await realpath(cwd);
  for (const entry of (process.env.PATH ?? "").split(delimiter)) {
    const directory = entry.trim().replace(/^"(.*)"$/, "$1");
    if (!isAbsolute(directory)) continue;
    try {
      const executable = await realpath(join(directory, "codex.exe"));
      const fromRepository = relative(repository, executable);
      if (!isAbsolute(fromRepository) && fromRepository !== ".." && !fromRepository.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) continue;
      if ((await stat(executable)).isFile()) return executable;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") throw error;
    }
  }
  throw Object.assign(new Error("Windows validators require codex.exe on the host PATH outside the repository; unsandboxed execution is not permitted"), { code: "ENOENT" });
}

export function createValidatorLauncher(): ProcessLauncher {
  return process.platform === "win32" ? new CodexReadOnlyValidatorLauncher() : new NativeProcessLauncher();
}

export function validatorExecutionAssumptions(launcher: ProcessLauncher) {
  return launcher instanceof CodexReadOnlyValidatorLauncher
    ? { ...configuredHostAssumptions, permissions: "codex-unelevated-read-only" as const, writeRestriction: "codex-read-only-profile" as const, readIsolation: false, pipedChildProcesses: "unsupported" as const }
    : configuredHostAssumptions;
}

export function validatorExecutionDescription(launcher: ProcessLauncher): string {
  return launcher instanceof CodexReadOnlyValidatorLauncher
    ? "Executed with Codex's unelevated read-only Windows profile; reads remain under host permissions, network denial and hostile same-user protection are not established, and Node child processes with piped stdio are unsupported."
    : "Executed under the configured host permissions; this result does not establish filesystem confinement, network denial, or hostile same-user protection.";
}
