import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:net";
import { dirname, isAbsolute, join } from "node:path";
import { tmpdir } from "node:os";

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
const bubblewrapProbeExecutable = process.execPath;
const systemReadRoots = ["/usr", "/lib", "/lib64"] as const;
const requiredProbeEvidence = [
  "readRootReadable",
  "readRootReadOnly",
  "writeRootWritable",
  "undeclaredPathInvisible",
  "networkDenied",
] as const;

type ProbeEvidence = Record<(typeof requiredProbeEvidence)[number], boolean>;

export async function createSandboxLauncher(options: SandboxLauncherOptions = {}): Promise<ProcessLauncher> {
  const platform = options.platform ?? process.platform;
  const nativeLauncher = options.nativeLauncher ?? new NativeProcessLauncher();
  const candidates: SandboxBackendCandidate[] = [];
  const failures: string[] = [];
  if (platform === "linux") candidates.push(createBubblewrapCandidate(nativeLauncher));
  candidates.push(...(options.fallbackBackends ?? []));

  for (const candidate of candidates) {
    let proven = false;
    try {
      proven = await candidate.probe();
    } catch (error) {
      failures.push(`${candidate.id}: ${errorMessage(error)}`);
      continue;
    }
    if (!proven) {
      failures.push(`${candidate.id}: probe reported unsupported`);
      continue;
    }

    const launcher = candidate.createLauncher();
    if (launcher.capabilities.filesystemIsolation && launcher.capabilities.networkIsolation) {
      return launcher;
    }
    failures.push(`${candidate.id}: launcher did not advertise filesystem and network isolation`);
  }

  throw new ExecutionRefusedError(
    "unsupported-isolation",
    `No capability-proven sandbox backend is available for ${platform}${failures.length === 0 ? "" : `. Attempts: ${failures.join("; ")}`}`,
  );
}

function createBubblewrapCandidate(nativeLauncher: ProcessLauncher): SandboxBackendCandidate {
  return {
    id: "bubblewrap",
    async probe() {
      const probeRoot = await mkdtemp(join(tmpdir(), "projector-sandbox-probe-"));
      const readRoot = join(probeRoot, "read");
      const writeRoot = join(probeRoot, "write");
      const readablePath = join(readRoot, "readable.txt");
      const sentinelPath = join(probeRoot, "undeclared-sentinel.txt");
      const server = createServer((socket) => socket.destroy());
      try {
        await Promise.all([mkdir(readRoot), mkdir(writeRoot)]);
        await Promise.all([
          writeFile(readablePath, "projector-readable"),
          writeFile(sentinelPath, "projector-undeclared"),
        ]);
        const port = await listen(server);
        const args = bubblewrapBaseArguments("deny");
        appendExecutableRootBinding(args, bubblewrapProbeExecutable, []);
        args.push(
          "--ro-bind",
          readRoot,
          readRoot,
          "--bind",
          writeRoot,
          writeRoot,
          bubblewrapProbeExecutable,
          "--input-type=module",
          "--eval",
          bubblewrapProbeSource,
          JSON.stringify({ readRoot, writeRoot, readablePath, sentinelPath, port }),
        );
        const result = await nativeLauncher.launch({
          executable: bubblewrapExecutable,
          args,
          cwd: "/",
          env: {},
          readRoots: [],
          writeRoots: [],
          network: "deny",
          timeoutMs: 2_000,
          maxOutputBytes: 16 * 1_024,
          signal: new AbortController().signal,
        });
        if (result.exitCode !== 0) {
          const cause = result.stderr.trim() || result.stdout.trim() || "no process diagnostic";
          throw new Error(`probe exited with code ${result.exitCode ?? `signal ${result.signal ?? "unknown"}`}: ${cause}`);
        }
        const evidence = parseProbeEvidence(result.stdout);
        const missing = requiredProbeEvidence.find((property) => evidence[property] !== true);
        if (missing !== undefined) throw new Error(`probe did not prove ${missing}`);
        return true;
      } finally {
        try {
          await close(server);
        } finally {
          await rm(probeRoot, { recursive: true, force: true });
        }
      }
    },
    createLauncher() {
      return new BubblewrapSandboxLauncher(nativeLauncher);
    },
  };
}

const bubblewrapProbeSource = String.raw`
import { access, readFile, writeFile } from "node:fs/promises";
import { createConnection } from "node:net";
import { join } from "node:path";

const input = JSON.parse(process.argv[1]);
const readable = await readFile(input.readablePath, "utf8");

let readRootReadOnly = false;
try {
  await writeFile(join(input.readRoot, "forbidden.txt"), "forbidden");
} catch (error) {
  readRootReadOnly = error?.code === "EROFS" || error?.code === "EACCES";
}

await writeFile(join(input.writeRoot, "allowed.txt"), "allowed");
const writeRootWritable = await readFile(join(input.writeRoot, "allowed.txt"), "utf8") === "allowed";

let undeclaredPathInvisible = false;
try {
  await access(input.sentinelPath);
} catch (error) {
  undeclaredPathInvisible = error?.code === "ENOENT";
}

const networkDenied = await new Promise((resolve) => {
  const socket = createConnection({ host: "127.0.0.1", port: input.port });
  const finish = (denied) => {
    socket.destroy();
    resolve(denied);
  };
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
}));
`;

function parseProbeEvidence(stdout: string): ProbeEvidence {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`probe returned invalid JSON: ${errorMessage(error)}`);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("probe returned non-object evidence");
  }
  return value as ProbeEvidence;
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("probe server did not bind an IP port");
  return address.port;
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
    const args = bubblewrapBaseArguments(request.network);
    appendExecutableRootBinding(args, request.executable, [...readRoots, ...writeRoots]);
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

function appendExecutableRootBinding(
  args: string[],
  executable: string,
  declaredRoots: readonly string[],
): void {
  if ([...systemReadRoots, ...declaredRoots].some((root) => contains(root, executable))) return;
  const executableRoot = dirname(executable);
  args.push("--ro-bind", executableRoot, executableRoot);
}

function uniqueRoots(roots: readonly string[]): string[] {
  return [...new Set(roots)];
}

function contains(root: string, target: string): boolean {
  return target === root || target.startsWith(`${root}/`);
}
