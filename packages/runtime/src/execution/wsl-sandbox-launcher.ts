import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, posix, win32 } from "node:path";

import {
  ExecutionLimitError,
  ExecutionRefusedError,
  type ProcessExecutionResult,
  type ProcessLaunchRequest,
  type ProcessLauncher,
} from "./command-executor.js";
import type {
  SandboxBackendCandidate,
  SandboxProbeEvidence,
} from "./sandbox-launcher.js";

const defaultWslExecutable = "C:\\Windows\\System32\\wsl.exe";
const bubblewrapExecutable = "/usr/bin/bwrap";
const linuxSystemReadRoots = ["/usr", "/lib", "/lib64"] as const;

export interface WslSandboxOptions {
  readonly distro?: string;
  readonly linuxNode?: string;
  readonly companionWindowsNode?: string;
  readonly windowsNodeExecutable?: string;
  readonly wslExecutable?: string;
}

export interface WslExecutionControl {
  readonly timeoutMs: number;
  readonly maxOutputBytes: number;
  readonly signal: AbortSignal;
}

export interface WslRuntime {
  readonly distro: string;
  readonly linuxNode: string;
  translatePath(path: string): Promise<string>;
  runTrustedNode(source: string, args: readonly string[], control: WslExecutionControl): Promise<ProcessExecutionResult>;
  launchBubblewrap(args: readonly string[], control: WslExecutionControl): Promise<ProcessExecutionResult>;
}

export function createWslBubblewrapCandidate(options: WslSandboxOptions = {}): SandboxBackendCandidate {
  let selectedRuntime: WslRuntime | undefined;
  const windowsNodeExecutable = win32.resolve(options.windowsNodeExecutable ?? process.execPath);
  return {
    id: "wsl-bubblewrap",
    async probe() {
      const runtime = await createProductionWslRuntime(options);
      const evidence = await probeWslBubblewrap(runtime, windowsNodeExecutable);
      selectedRuntime = runtime;
      return evidence;
    },
    createLauncher() {
      if (selectedRuntime === undefined) {
        throw new ExecutionRefusedError("unsupported-isolation", "WSL bubblewrap launcher was created before its live probe completed");
      }
      return createWslSandboxLauncher(selectedRuntime, windowsNodeExecutable);
    },
  };
}

export function createWslSandboxLauncher(runtime: WslRuntime, windowsNodeExecutable = process.execPath): ProcessLauncher {
  return new WslBubblewrapSandboxLauncher(runtime, win32.resolve(windowsNodeExecutable));
}

class WslBubblewrapSandboxLauncher implements ProcessLauncher {
  readonly capabilities = {
    filesystemIsolation: true,
    networkIsolation: true,
    cpuLimits: false,
    memoryLimits: false,
    externalWrites: false,
    readOnlyFileOverlays: true,
  };

  constructor(
    private readonly runtime: WslRuntime,
    private readonly windowsNodeExecutable: string,
  ) {}

  async launch(request: ProcessLaunchRequest): Promise<ProcessExecutionResult> {
    if (!sameWindowsPath(request.executable, this.windowsNodeExecutable)) {
      throw new ExecutionRefusedError(
        "invalid-command",
        `WSL sandbox supports only the configured Windows Node executable: ${request.executable}`,
      );
    }
    const [cwd, readRoots, writeRoots] = await Promise.all([
      this.runtime.translatePath(request.cwd),
      Promise.all(unique(request.readRoots).map((root) => this.runtime.translatePath(root))),
      Promise.all(unique(request.writeRoots).map((root) => this.runtime.translatePath(root))),
    ]);
    const overlays = await Promise.all(
      [...(request.readOnlyFileOverlays ?? [])]
        .sort((left, right) => left.target.localeCompare(right.target))
        .map(async (overlay) => {
          requireOverlayTarget(overlay.target, request.readRoots);
          const [source, target] = await Promise.all([
            this.runtime.translatePath(overlay.source),
            this.runtime.translatePath(overlay.target),
          ]);
          if (!readRoots.some((root) => containsLinux(root, target))) {
            throw new ExecutionRefusedError("invalid-command", `Translated overlay target escaped its read root: ${target}`);
          }
          return { source, target };
        }),
    );
    const protectedPaths = [
      ...linuxSystemReadRoots,
      this.runtime.linuxNode,
      ...readRoots,
      ...overlays.map(({ source }) => source),
    ];
    for (const writeRoot of writeRoots) {
      const covered = protectedPaths.find((protectedPath) => containsLinux(writeRoot, protectedPath));
      if (covered !== undefined) {
        throw new ExecutionRefusedError(
          "invalid-command",
          `Writable WSL root ${writeRoot} contains protected read-only path ${covered}`,
        );
      }
    }
    const translatedArgs = await translateNodeArguments(this.runtime, request.args);
    const args = wslBubblewrapBaseArguments(request.network);
    appendLinuxExecutableBinding(args, this.runtime.linuxNode, [...readRoots, ...writeRoots]);
    for (const root of readRoots) args.push("--ro-bind", root, root);
    for (const root of writeRoots) args.push("--bind", root, root);
    for (const overlay of overlays) args.push("--ro-bind", overlay.source, overlay.target);
    args.push("--chdir", cwd);
    for (const [key, value] of Object.entries(request.env).sort(([left], [right]) => left.localeCompare(right))) {
      args.push("--setenv", key, value);
    }
    args.push(this.runtime.linuxNode, ...translatedArgs);
    return this.runtime.launchBubblewrap(args, request);
  }
}

async function createProductionWslRuntime(options: WslSandboxOptions): Promise<WslRuntime> {
  const host = new WindowsWslHost(options.wslExecutable ?? defaultWslExecutable);
  const distro = validateDistroName(options.distro ?? process.env.PROJECTOR_WSL_DISTRO ??
    await discoverDefaultDistro(host));
  const configuredNode = options.linuxNode ?? process.env.PROJECTOR_WSL_NODE;
  const companion = options.companionWindowsNode ?? join(dirname(process.execPath), "node");
  const linuxNode = await discoverLinuxNode(host, distro, configuredNode, companion);
  await requireLinuxTool(host, distro, bubblewrapExecutable);
  return {
    distro,
    linuxNode,
    async translatePath(path) {
      const unc = parseWslUnc(path);
      if (unc !== undefined) {
        if (unc.distro.toLocaleLowerCase() !== distro.toLocaleLowerCase()) {
          throw new ExecutionRefusedError(
            "invalid-command",
            `WSL UNC path belongs to ${unc.distro}, but sandbox distro is ${distro}: ${path}`,
          );
        }
        return unc.linuxPath;
      }
      if (!isWindowsDriveAbsolute(path)) {
        throw new ExecutionRefusedError("invalid-command", `WSL sandbox path must be an absolute Windows drive or matching WSL UNC path: ${path}`);
      }
      const result = await host.run(
        ["-d", distro, "--exec", "/usr/bin/wslpath", "-u", "-a", path],
        discoveryControl(),
      );
      return requireSuccessfulAbsoluteOutput(result, `translate Windows path ${path}`);
    },
    runTrustedNode(source, args, control) {
      return host.runSupervised(distro, linuxNode, linuxNode, ["--input-type=module", "--eval", source, ...args], control);
    },
    launchBubblewrap(args, control) {
      return host.runSupervised(distro, linuxNode, bubblewrapExecutable, args, control);
    },
  };
}

class WindowsWslHost {
  constructor(private readonly executable: string) {
    if (!win32.isAbsolute(executable)) throw new Error(`wsl.exe path must be absolute: ${executable}`);
  }

  run(args: readonly string[], control: WslExecutionControl): Promise<ProcessExecutionResult> {
    return captureProcess(this.executable, args, control, false);
  }

  runSupervised(
    distro: string,
    linuxNode: string,
    executable: string,
    args: readonly string[],
    control: WslExecutionControl,
  ): Promise<ProcessExecutionResult> {
    return captureProcess(this.executable, [
      "-d", distro,
      "--exec", linuxNode,
      "--input-type=module", "--eval", linuxSupervisorSource,
      JSON.stringify({ executable, args }),
    ], control, true);
  }
}

async function discoverDefaultDistro(host: WindowsWslHost): Promise<string> {
  const result = await host.run(
    ["--exec", "/bin/sh", "-c", "printf '%s' \"$WSL_DISTRO_NAME\""],
    discoveryControl(),
  );
  return validateDistroName(requireSuccessfulOutput(result, "discover the default WSL distro"));
}

async function discoverLinuxNode(
  host: WindowsWslHost,
  distro: string,
  configuredNode: string | undefined,
  companionWindowsNode: string,
): Promise<string> {
  const candidates: string[] = [];
  if (configuredNode !== undefined) candidates.push(requireLinuxAbsolute(configuredNode, "PROJECTOR_WSL_NODE"));
  try {
    if ((await stat(companionWindowsNode)).isFile()) {
      const translated = await host.run(
        ["-d", distro, "--exec", "/usr/bin/wslpath", "-u", "-a", companionWindowsNode],
        discoveryControl(),
      );
      candidates.push(requireSuccessfulAbsoluteOutput(translated, "translate packaged Linux Node companion"));
    }
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
  const failures: string[] = [];
  for (const candidate of unique(candidates)) {
    const result = await host.run([
      "-d", distro,
      "--exec", candidate,
      "--input-type=module", "--eval",
      "process.stdout.write(JSON.stringify({platform:process.platform,version:process.version}))",
    ], discoveryControl());
    if (result.exitCode === 0 && isLinuxNode24(result.stdout)) return candidate;
    failures.push(`${candidate}: ${diagnostic(result)}`);
  }
  throw new ExecutionRefusedError(
    "unsupported-isolation",
    `No usable Linux Node 24 runtime was found in WSL distro ${distro}. Configure PROJECTOR_WSL_NODE or install the packaged Linux companion${failures.length === 0 ? "" : `. Attempts: ${failures.join("; ")}`}`,
  );
}

async function requireLinuxTool(host: WindowsWslHost, distro: string, path: string): Promise<void> {
  const result = await host.run(["-d", distro, "--exec", "/usr/bin/test", "-x", path], discoveryControl());
  if (result.exitCode !== 0) {
    throw new ExecutionRefusedError("unsupported-isolation", `${path} is unavailable in WSL distro ${distro}: ${diagnostic(result)}`);
  }
}

async function probeWslBubblewrap(runtime: WslRuntime, windowsNodeExecutable: string): Promise<SandboxProbeEvidence> {
  const root = await mkdtemp(join(tmpdir(), "projector-wsl-sandbox-probe-"));
  const readRoot = join(root, "read");
  const writeRoot = join(root, "write");
  const readablePath = join(readRoot, "readable.txt");
  const sentinelPath = join(root, "undeclared-sentinel.txt");
  const overlaySource = join(root, "captured-validator.mjs");
  const overlayTarget = join(readRoot, "validator.mjs");
  try {
    await Promise.all([mkdir(readRoot), mkdir(writeRoot)]);
    await Promise.all([
      writeFile(readablePath, "projector-readable"),
      writeFile(sentinelPath, "projector-undeclared"),
      writeFile(overlaySource, "captured-validator"),
      writeFile(overlayTarget, "live-validator"),
    ]);
    const translated = await Promise.all([
      runtime.translatePath(readRoot),
      runtime.translatePath(writeRoot),
      runtime.translatePath(readablePath),
      runtime.translatePath(sentinelPath),
      runtime.translatePath(overlaySource),
      runtime.translatePath(overlayTarget),
    ]);
    const result = await runtime.runTrustedNode(wslProbeOrchestratorSource, [JSON.stringify({
      linuxNode: runtime.linuxNode,
      readRoot: translated[0],
      writeRoot: translated[1],
      readablePath: translated[2],
      sentinelPath: translated[3],
      overlaySource: translated[4],
      overlayTarget: translated[5],
    })], {
      timeoutMs: 4_000,
      maxOutputBytes: 16 * 1_024,
      signal: new AbortController().signal,
    });
    if (result.exitCode !== 0) throw new Error(`WSL bubblewrap probe failed: ${diagnostic(result)}`);
    const evidence = parseProbeEvidence(result.stdout);
    if (evidence.readOnlyOverlayApplied !== true) throw new Error("WSL bubblewrap probe did not prove read-only overlay semantics");
    await Promise.all(
      (["normal", "aborted", "timeout", "output"] as const).map((mode) =>
        proveDescendantCleanup(runtime, windowsNodeExecutable, root, writeRoot, mode)),
    );
    return evidence;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

type DescendantCleanupMode = "normal" | "aborted" | "timeout" | "output";

async function proveDescendantCleanup(
  runtime: WslRuntime,
  windowsNodeExecutable: string,
  root: string,
  writeRoot: string,
  mode: DescendantCleanupMode,
): Promise<void> {
  const ready = join(writeRoot, `${mode}-ready.txt`);
  const escaped = join(writeRoot, `${mode}-escaped.txt`);
  const controller = new AbortController();
  const launcher = createWslSandboxLauncher(runtime, windowsNodeExecutable);
  const launch = launcher.launch({
    executable: windowsNodeExecutable,
    args: ["--input-type=module", "--eval", escapedDescendantProbeSource,
      JSON.stringify({
        ready: await runtime.translatePath(ready),
        escaped: await runtime.translatePath(escaped),
        node: runtime.linuxNode,
        mode,
      })],
    cwd: root,
    env: {},
    readRoots: [root],
    writeRoots: [writeRoot],
    network: "deny",
    timeoutMs: mode === "timeout" ? 1_500 : 4_000,
    maxOutputBytes: mode === "output" ? 1_024 : 4_096,
    signal: controller.signal,
  });
  const outcome = launch.then(
    (result) => ({ status: "fulfilled" as const, result }),
    (error: unknown) => ({ status: "rejected" as const, error }),
  );
  if (mode !== "normal") await waitForFile(ready, 2_500);
  if (mode === "aborted") controller.abort();
  const settled = await outcome;
  if (mode === "normal") {
    if (settled.status === "rejected") throw settled.error;
    if (settled.result.exitCode !== 0) throw new Error(`normal descendant-cleanup probe failed: ${diagnostic(settled.result)}`);
  } else {
    if (settled.status === "fulfilled") {
      throw new Error(`${mode} descendant-cleanup probe unexpectedly completed without reaching its limit`);
    }
    if (!(settled.error instanceof ExecutionLimitError) || settled.error.limit !== mode) throw settled.error;
  }
  await delay(2_300);
  try {
    await access(escaped);
    throw new Error(`WSL sandbox ${mode} path left an escaped grandchild running`);
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
}

type ExtendedProbeEvidence = SandboxProbeEvidence & { readonly readOnlyOverlayApplied: boolean };

function parseProbeEvidence(stdout: string): ExtendedProbeEvidence {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`WSL bubblewrap probe returned invalid JSON: ${errorMessage(error)}`);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("WSL bubblewrap probe returned non-object evidence");
  const record = value as Record<string, unknown>;
  for (const property of ["readRootReadable", "readRootReadOnly", "writeRootWritable", "undeclaredPathInvisible", "networkDenied", "readOnlyOverlayApplied"]) {
    if (record[property] !== true) throw new Error(`WSL bubblewrap probe did not prove ${property}`);
  }
  return value as ExtendedProbeEvidence;
}

function wslBubblewrapBaseArguments(network: ProcessLaunchRequest["network"]): string[] {
  return [
    "--die-with-parent",
    "--new-session",
    "--unshare-pid",
    ...(network === "deny" ? ["--unshare-net"] : []),
    "--clearenv",
    ...linuxSystemReadRoots.flatMap((root) => ["--ro-bind", root, root]),
  ];
}

function appendLinuxExecutableBinding(args: string[], executable: string, declaredRoots: readonly string[]): void {
  if ([...linuxSystemReadRoots, ...declaredRoots].some((root) => containsLinux(root, executable))) return;
  const root = posix.dirname(executable);
  args.push("--ro-bind", root, root);
}

function requireOverlayTarget(target: string, readRoots: readonly string[]): void {
  if (!isAbsoluteWindowsPath(target) || !readRoots.some((root) => containsWindows(root, target))) {
    throw new ExecutionRefusedError(
      "invalid-command",
      `Read-only file overlay must remain under an allowed Windows read root: ${target}`,
    );
  }
}

async function translateNodeArguments(runtime: WslRuntime, args: readonly string[]): Promise<string[]> {
  const translated = [...args];
  const mainScriptIndex = findNodeMainScriptIndex(args);
  if (mainScriptIndex !== undefined && isAbsoluteWindowsPath(args[mainScriptIndex]!)) {
    translated[mainScriptIndex] = await runtime.translatePath(args[mainScriptIndex]!);
  }
  return translated;
}

function findNodeMainScriptIndex(args: readonly string[]): number | undefined {
  const valueOptions = new Set([
    "--conditions", "--diagnostic-dir", "--disable-warning", "--env-file", "--env-file-if-exists",
    "--experimental-default-type", "--heap-prof-dir", "--icu-data-dir", "--import", "--input-type",
    "--inspect-port", "--loader", "--max-http-header-size", "--openssl-config", "--permission",
    "--redirect-warnings", "--require", "-C", "-r",
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (["--eval", "-e", "--print", "-p", "--check", "-c"].includes(argument)) return undefined;
    if (argument === "--") return index + 1 < args.length ? index + 1 : undefined;
    if (valueOptions.has(argument)) {
      index += 1;
      continue;
    }
    if (argument.startsWith("-")) continue;
    return index;
  }
  return undefined;
}

function isLinuxNode24(stdout: string): boolean {
  try {
    const value = JSON.parse(stdout) as { platform?: unknown; version?: unknown };
    return value.platform === "linux" && typeof value.version === "string" && /^v24\.\d+\.\d+$/.test(value.version);
  } catch {
    return false;
  }
}

function isAbsoluteWindowsPath(path: string): boolean {
  return isWindowsDriveAbsolute(path) || parseWslUnc(path) !== undefined;
}

function isWindowsDriveAbsolute(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path);
}

function parseWslUnc(path: string): { distro: string; linuxPath: string } | undefined {
  const normalized = path.replaceAll("/", "\\");
  const match = /^\\\\(?:wsl\$|wsl\.localhost)\\([^\\]+)\\?(.*)$/i.exec(normalized);
  if (match === null) return undefined;
  const distro = validateDistroName(match[1] ?? "");
  const segments = (match[2] ?? "").split("\\").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new ExecutionRefusedError("invalid-command", `WSL UNC path contains traversal: ${path}`);
  }
  return { distro, linuxPath: `/${segments.join("/")}` };
}

function containsWindows(root: string, target: string): boolean {
  const path = win32.relative(win32.resolve(root), win32.resolve(target));
  return path === "" || (!path.startsWith("..") && !win32.isAbsolute(path));
}

function containsLinux(root: string, target: string): boolean {
  const path = posix.relative(root, target);
  return path === "" || (!path.startsWith("..") && !posix.isAbsolute(path));
}

function sameWindowsPath(left: string, right: string): boolean {
  return win32.resolve(left).toLocaleLowerCase() === win32.resolve(right).toLocaleLowerCase();
}

function validateDistroName(value: string): string {
  const name = value.trim();
  if (name.length === 0 || name.startsWith("-") || /[\0\r\n]/.test(name)) {
    throw new ExecutionRefusedError("invalid-command", `Invalid WSL distro name: ${JSON.stringify(value)}`);
  }
  return name;
}

function requireLinuxAbsolute(value: string, description: string): string {
  const path = value.trim();
  if (!posix.isAbsolute(path) || path.includes("\0") || path.includes("\n") || path.includes("\r")) {
    throw new ExecutionRefusedError("invalid-command", `${description} must be one absolute Linux path`);
  }
  return path;
}

function requireSuccessfulOutput(result: ProcessExecutionResult, action: string): string {
  if (result.exitCode !== 0) throw new ExecutionRefusedError("unsupported-isolation", `Could not ${action}: ${diagnostic(result)}`);
  return result.stdout.trim();
}

function requireSuccessfulAbsoluteOutput(result: ProcessExecutionResult, action: string): string {
  return requireLinuxAbsolute(requireSuccessfulOutput(result, action), action);
}

function discoveryControl(): WslExecutionControl {
  return { timeoutMs: 3_000, maxOutputBytes: 16 * 1_024, signal: new AbortController().signal };
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function diagnostic(result: ProcessExecutionResult): string {
  return result.stderr.trim() || result.stdout.trim() || `exit ${result.exitCode ?? result.signal ?? "unknown"}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT";
}

async function waitForFile(path: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await access(path);
      return;
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    await delay(20);
  }
  throw new Error(`timed out waiting for sandbox readiness: ${path}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function captureProcess(
  executable: string,
  args: readonly string[],
  control: WslExecutionControl,
  supervised: boolean,
): Promise<ProcessExecutionResult> {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const child = spawn(executable, args, {
      env: hostWslEnvironment(),
      shell: false,
      windowsHide: true,
      stdio: [supervised ? "pipe" : "ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let limitError: ExecutionLimitError | undefined;
    let forceTimer: NodeJS.Timeout | undefined;
    const stopFor = (error: ExecutionLimitError) => {
      if (limitError !== undefined) return;
      limitError = error;
      if (supervised) {
        child.stdin!.end();
        forceTimer = setTimeout(() => child.kill("SIGKILL"), 1_000);
        forceTimer.unref();
      } else {
        child.kill("SIGKILL");
      }
    };
    const capture = (target: Buffer[], chunk: Buffer) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > control.maxOutputBytes) {
        stopFor(new ExecutionLimitError("output", `Process exceeded ${control.maxOutputBytes} output bytes`));
      } else {
        target.push(chunk);
      }
    };
    child.stdout!.on("data", (chunk: Buffer) => capture(stdout, chunk));
    child.stderr!.on("data", (chunk: Buffer) => capture(stderr, chunk));
    const timeout = setTimeout(() => {
      stopFor(new ExecutionLimitError("timeout", `Process exceeded ${control.timeoutMs}ms`));
    }, control.timeoutMs);
    timeout.unref();
    const abort = () => stopFor(new ExecutionLimitError("aborted", "Process execution was aborted"));
    control.signal.addEventListener("abort", abort, { once: true });
    if (control.signal.aborted) abort();
    if (supervised && limitError === undefined) child.stdin!.write("start\n");
    child.once("error", (error) => {
      clearTimeout(timeout);
      if (forceTimer !== undefined) clearTimeout(forceTimer);
      control.signal.removeEventListener("abort", abort);
      reject(error);
    });
    child.once("close", (exitCode, signal) => {
      clearTimeout(timeout);
      if (forceTimer !== undefined) clearTimeout(forceTimer);
      control.signal.removeEventListener("abort", abort);
      if (limitError !== undefined) {
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

function hostWslEnvironment(): NodeJS.ProcessEnv {
  return {
    SystemRoot: process.env.SystemRoot ?? process.env.WINDIR ?? "C:\\Windows",
    WINDIR: process.env.WINDIR ?? process.env.SystemRoot ?? "C:\\Windows",
  };
}

const linuxSupervisorSource = String.raw`
import { spawn } from "node:child_process";

const input = JSON.parse(process.argv[1]);
let child;
let started = false;
let handshake = "";
const terminate = () => {
  if (!child?.pid) return;
  try { process.kill(-child.pid, "SIGKILL"); } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
};
const finish = (code, signal) => {
  if (signal) {
    const numbers = { SIGHUP: 1, SIGINT: 2, SIGQUIT: 3, SIGKILL: 9, SIGTERM: 15 };
    process.exitCode = 128 + (numbers[signal] ?? 1);
  } else {
    process.exitCode = code ?? 1;
  }
  process.stdin.destroy();
};
const start = () => {
  if (started) return;
  started = true;
  child = spawn(input.executable, input.args, { detached: true, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  child.once("error", (error) => {
    process.stderr.write(String(error));
    process.exitCode = 126;
    process.stdin.destroy();
  });
  child.once("close", finish);
};
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  handshake += chunk;
  if (handshake === "start\n") start();
  else if (!"start\n".startsWith(handshake)) {
    process.exitCode = 125;
    process.stdin.destroy();
  }
});
process.stdin.once("end", () => {
  if (!started) {
    process.exitCode = 125;
    return;
  }
  terminate();
});
`;

const wslProbeOrchestratorSource = String.raw`
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { dirname } from "node:path";

const input = JSON.parse(process.argv[1]);
const server = createServer((socket) => socket.destroy());
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const address = server.address();
const args = [
  "--die-with-parent", "--new-session", "--unshare-pid", "--unshare-net", "--clearenv",
  "--ro-bind", "/usr", "/usr", "--ro-bind", "/lib", "/lib", "--ro-bind", "/lib64", "/lib64",
];
if (!input.linuxNode.startsWith("/usr/") && !input.linuxNode.startsWith("/lib/") && !input.linuxNode.startsWith("/lib64/")) {
  args.push("--ro-bind", dirname(input.linuxNode), dirname(input.linuxNode));
}
args.push(
  "--ro-bind", input.readRoot, input.readRoot,
  "--bind", input.writeRoot, input.writeRoot,
  "--ro-bind", input.overlaySource, input.overlayTarget,
  "--chdir", "/",
  input.linuxNode, "--input-type=module", "--eval", ${JSON.stringify(String.raw`
import { access, readFile, writeFile } from "node:fs/promises";
import { createConnection } from "node:net";
import { join } from "node:path";
const input = JSON.parse(process.argv[1]);
const readable = await readFile(input.readablePath, "utf8");
let readRootReadOnly = false;
try { await writeFile(join(input.readRoot, "forbidden.txt"), "forbidden"); } catch (error) { readRootReadOnly = error?.code === "EROFS" || error?.code === "EACCES"; }
await writeFile(join(input.writeRoot, "allowed.txt"), "allowed");
const writeRootWritable = await readFile(join(input.writeRoot, "allowed.txt"), "utf8") === "allowed";
let undeclaredPathInvisible = false;
try { await access(input.sentinelPath); } catch (error) { undeclaredPathInvisible = error?.code === "ENOENT"; }
const overlay = await readFile(input.overlayTarget, "utf8");
let overlayReadOnly = false;
try { await writeFile(input.overlayTarget, "changed"); } catch (error) { overlayReadOnly = error?.code === "EROFS" || error?.code === "EACCES"; }
const networkDenied = await new Promise((resolve) => {
  const socket = createConnection({ host: "127.0.0.1", port: input.port });
  const finish = (value) => { socket.destroy(); resolve(value); };
  socket.setTimeout(400);
  socket.once("connect", () => finish(false));
  socket.once("error", () => finish(true));
  socket.once("timeout", () => finish(true));
});
process.stdout.write(JSON.stringify({
  readRootReadable: readable === "projector-readable",
  readRootReadOnly,
  writeRootWritable,
  undeclaredPathInvisible,
  networkDenied,
  readOnlyOverlayApplied: overlay === "captured-validator" && overlayReadOnly,
}));
`)},
  JSON.stringify({ ...input, port: address.port }),
);
const child = spawn("/usr/bin/bwrap", args, { stdio: ["ignore", "pipe", "pipe"] });
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
const outcome = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("close", (code, signal) => resolve({ code, signal }));
});
await new Promise((resolve) => server.close(resolve));
if (outcome.signal) process.kill(process.pid, outcome.signal);
process.exit(outcome.code ?? 1);
`;

const escapedDescendantProbeSource = String.raw`
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
const input = JSON.parse(process.argv[1]);
const child = spawn(input.node, ["--input-type=module", "--eval", ${JSON.stringify(String.raw`
import { writeFile } from "node:fs/promises";
await new Promise((resolve) => setTimeout(resolve, 2100));
await writeFile(process.argv[1], "escaped");
`)}, input.escaped], { detached: true, stdio: ["pipe", "pipe", "pipe"] });
await new Promise((resolve, reject) => {
  child.once("spawn", resolve);
  child.once("error", reject);
});
child.stdin.destroy();
child.stdout.destroy();
child.stderr.destroy();
child.unref();
await writeFile(input.ready, "ready");
if (input.mode === "normal") {
  process.exitCode = 0;
} else if (input.mode === "output") {
  process.stdout.write("x".repeat(8192));
  setInterval(() => {}, 1000);
} else {
  setInterval(() => {}, 1000);
}
`;
