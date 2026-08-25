import { dirname, isAbsolute } from "node:path";

import {
  ExecutionRefusedError,
  NativeProcessLauncher,
  type ProcessLaunchRequest,
  type ProcessLauncher,
} from "./command-executor.js";

export interface SandboxBackendCandidate {
  readonly id: string;
  probe(): Promise<boolean>;
  createLauncher(): ProcessLauncher;
}

export interface SandboxLauncherOptions {
  readonly platform?: NodeJS.Platform;
  readonly nativeLauncher?: ProcessLauncher;
  readonly fallbackBackends?: readonly SandboxBackendCandidate[];
}

const bubblewrapExecutable = "/usr/bin/bwrap";
const bubblewrapProbeExecutable = "/usr/bin/true";
const systemReadRoots = ["/usr", "/lib", "/lib64"] as const;

export async function createSandboxLauncher(options: SandboxLauncherOptions = {}): Promise<ProcessLauncher> {
  const platform = options.platform ?? process.platform;
  const nativeLauncher = options.nativeLauncher ?? new NativeProcessLauncher();
  const candidates: SandboxBackendCandidate[] = [];
  if (platform === "linux") candidates.push(createBubblewrapCandidate(nativeLauncher));
  candidates.push(...(options.fallbackBackends ?? []));

  for (const candidate of candidates) {
    let proven = false;
    try {
      proven = await candidate.probe();
    } catch {
      proven = false;
    }
    if (!proven) continue;

    const launcher = candidate.createLauncher();
    if (launcher.capabilities.filesystemIsolation && launcher.capabilities.networkIsolation) {
      return launcher;
    }
  }

  throw new ExecutionRefusedError(
    "unsupported-isolation",
    `No capability-proven sandbox backend is available for ${platform}`,
  );
}

function createBubblewrapCandidate(nativeLauncher: ProcessLauncher): SandboxBackendCandidate {
  return {
    id: "bubblewrap",
    async probe() {
      const result = await nativeLauncher.launch({
        executable: bubblewrapExecutable,
        args: [...bubblewrapBaseArguments("deny"), bubblewrapProbeExecutable],
        cwd: "/",
        env: {},
        readRoots: [],
        writeRoots: [],
        network: "deny",
        timeoutMs: 2_000,
        maxOutputBytes: 16 * 1_024,
        signal: new AbortController().signal,
      });
      return result.exitCode === 0;
    },
    createLauncher() {
      return new BubblewrapSandboxLauncher(nativeLauncher);
    },
  };
}

class BubblewrapSandboxLauncher implements ProcessLauncher {
  readonly capabilities = {
    filesystemIsolation: true,
    networkIsolation: true,
    cpuLimits: false,
    memoryLimits: false,
    externalWrites: false,
  };

  constructor(private readonly nativeLauncher: ProcessLauncher) {}

  launch(request: ProcessLaunchRequest) {
    if (!isAbsolute(request.executable)) {
      throw new ExecutionRefusedError(
        "invalid-command",
        `Sandboxed executable must be an absolute path: ${request.executable}`,
      );
    }

    const readRoots = uniqueRoots(request.readRoots);
    const writeRoots = uniqueRoots(request.writeRoots);
    const executableRoot = dirname(request.executable);
    const args = bubblewrapBaseArguments(request.network);
    if (![...systemReadRoots, ...readRoots, ...writeRoots].some((root) => contains(root, request.executable))) {
      args.push("--ro-bind", executableRoot, executableRoot);
    }
    for (const root of readRoots) args.push("--ro-bind", root, root);
    for (const root of writeRoots) args.push("--bind", root, root);
    args.push("--chdir", request.cwd);
    for (const [key, value] of Object.entries(request.env).sort(([left], [right]) => left.localeCompare(right))) {
      args.push("--setenv", key, value);
    }
    args.push(request.executable, ...request.args);

    return this.nativeLauncher.launch({
      ...request,
      executable: bubblewrapExecutable,
      args,
      env: {},
      readRoots: [],
      writeRoots: [],
    });
  }
}

function bubblewrapBaseArguments(network: ProcessLaunchRequest["network"]): string[] {
  return [
    "--die-with-parent",
    "--new-session",
    ...(network === "deny" ? ["--unshare-net"] : []),
    "--clearenv",
    ...systemReadRoots.flatMap((root) => ["--ro-bind", root, root]),
  ];
}

function uniqueRoots(roots: readonly string[]): string[] {
  return [...new Set(roots)];
}

function contains(root: string, target: string): boolean {
  return target === root || target.startsWith(`${root}/`);
}
