import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, realpath } from "node:fs/promises";
import { delimiter, isAbsolute, join, relative, resolve, sep } from "node:path";

import { createDurablePsychordAgentBrowserObservationArtifactService } from "@projector/control-plane/application-evidence";
import {
  type PsychordApplicationObservationPlan,
  type PsychordCommandRunner,
  type PsychordObservationArtifactService,
} from "@projector/integrations/runtime-evidence";
import { NativeProcessLauncher } from "@projector/runtime";

const maximumToolManifestBytes = 64 * 1024;
const expectedAgentBrowserVersion = "0.31.1" as const;
const inheritedCommandEnvironmentKeys = ["SystemRoot", "WINDIR", "COMSPEC", "PATHEXT", "PATH", "TEMP", "TMP", "TMPDIR"] as const;

export interface InstalledPsychordObservationFactoryInput {
  readonly repositoryRoot: string;
  readonly plan: PsychordApplicationObservationPlan;
  readonly signal: AbortSignal;
  readonly environment: Readonly<Record<string, string | undefined>>;
}

export type InstalledPsychordObservationFactory = (
  input: InstalledPsychordObservationFactoryInput,
) => Promise<PsychordObservationArtifactService>;

/** Resolves the accepted Windows Psychord adapter tools only when its operation executes. */
export function createInstalledPsychordObservationFactory(): InstalledPsychordObservationFactory {
  return async ({ repositoryRoot, plan, signal, environment }) => {
    signal.throwIfAborted();
    if (process.platform !== "win32") throw new Error("Psychord application observation requires the supported Windows Chrome host");
    const plannedRoot = resolve(plan.adapter.input.repository.root);
    const operationRoot = resolve(repositoryRoot);
    if (plannedRoot !== operationRoot) throw new Error("Psychord observation plan repository does not match the operation repository");
    const storageRoot = join(operationRoot, ".projector/runtime/application-evidence");
    if (resolve(plan.adapter.input.ownedArtifactRoot) !== storageRoot) {
      throw new Error(`Psychord observation plan must own the stable artifact root ${storageRoot}`);
    }

    const tools = await resolvePsychordTools(environment);
    signal.throwIfAborted();
    await mkdir(storageRoot, { recursive: true });
    signal.throwIfAborted();
    const launcher = new NativeProcessLauncher();
    const commands: PsychordCommandRunner = {
      run: async (request) => launcher.launch({ ...request, args: [...request.args] }),
    };
    const commandEnvironment = selectedEnvironment(environment);
    const identity = createHash("sha256")
      .update(plan.adapter.id)
      .update("\0")
      .update(plan.runId)
      .digest("hex")
      .slice(0, 32);
    return createDurablePsychordAgentBrowserObservationArtifactService({
      storageRoot,
      commands,
      configuration: {
        build: { nodeExecutable: tools.node, pnpmCli: tools.pnpm },
        agentBrowser: {
          executable: tools.agentBrowser,
          expectedVersion: expectedAgentBrowserVersion,
          chromeExecutable: tools.chrome,
          namespace: `projector-${identity}`,
          session: `run-${identity}`,
          stdioDrainTimeoutMs: 250,
        },
        commandEnvironment,
      },
    });
  };
}

async function resolvePsychordTools(environment: Readonly<Record<string, string | undefined>>) {
  const node = await regularFile(environment.PROJECTOR_NODE_EXECUTABLE ?? process.execPath, "Node executable");
  const pnpm = environment.PROJECTOR_PNPM_CLI === undefined
    ? await resolvePackageBin(environment, "pnpm", "pnpm")
    : await regularFile(environment.PROJECTOR_PNPM_CLI, "pnpm CLI override");
  const agentBrowser = environment.PROJECTOR_AGENT_BROWSER_EXECUTABLE === undefined
    ? await resolveAgentBrowser(environment)
    : await regularFile(environment.PROJECTOR_AGENT_BROWSER_EXECUTABLE, "agent-browser executable override");
  const chrome = environment.PROJECTOR_CHROME_EXECUTABLE === undefined
    ? await resolveChrome(environment)
    : await regularFile(environment.PROJECTOR_CHROME_EXECUTABLE, "Chrome executable override");
  return { node, pnpm, agentBrowser, chrome };
}

async function resolvePackageBin(
  environment: Readonly<Record<string, string | undefined>>,
  packageName: string,
  binName: string,
): Promise<string> {
  for (const directory of pathDirectories(environment)) {
    if (!await anyRegularFile([join(directory, `${binName}.cmd`), join(directory, `${binName}.ps1`), join(directory, binName)])) continue;
    const packageRoot = join(directory, "node_modules", packageName);
    const manifest = await readToolManifest(packageRoot).catch(() => undefined);
    if (manifest === undefined) continue;
    const declared = typeof manifest.bin === "string" ? manifest.bin : recordString(manifest.bin, binName);
    if (declared === undefined) continue;
    const target = resolve(packageRoot, declared);
    if (!within(packageRoot, target)) throw new Error(`${packageName} declares a bin outside its package root`);
    return regularFile(target, `${packageName} package bin`);
  }
  throw new Error(`Unable to resolve ${packageName} from its ordinary PATH installation; provide its supported explicit override`);
}

async function resolveAgentBrowser(environment: Readonly<Record<string, string | undefined>>): Promise<string> {
  for (const directory of pathDirectories(environment)) {
    if (!await anyRegularFile([join(directory, "agent-browser.cmd"), join(directory, "agent-browser.ps1"), join(directory, "agent-browser")])) continue;
    const packageRoot = join(directory, "node_modules", "agent-browser");
    const manifest = await readToolManifest(packageRoot).catch(() => undefined);
    if (manifest?.name !== "agent-browser" || manifest.version !== expectedAgentBrowserVersion) continue;
    return regularFile(join(packageRoot, "bin/agent-browser-win32-x64.exe"), `agent-browser ${expectedAgentBrowserVersion} Windows executable`);
  }
  throw new Error("Unable to resolve agent-browser 0.31.1 from its ordinary PATH installation; set PROJECTOR_AGENT_BROWSER_EXECUTABLE for a nondefault install");
}

async function resolveChrome(environment: Readonly<Record<string, string | undefined>>): Promise<string> {
  const candidates = [
    environment.ProgramFiles,
    environment.PROGRAMFILES,
    environment["ProgramFiles(x86)"],
    environment["PROGRAMFILES(X86)"],
    environment.LOCALAPPDATA,
  ].flatMap((root) => root === undefined || root.length === 0 ? [] : [join(root, "Google/Chrome/Application/chrome.exe")]);
  for (const candidate of candidates) {
    try { return await regularFile(candidate, "Google Chrome executable"); } catch { /* continue bounded standard-location discovery */ }
  }
  throw new Error("Unable to resolve Google Chrome from its standard Windows installation; set PROJECTOR_CHROME_EXECUTABLE for a nondefault install");
}

async function readToolManifest(packageRoot: string): Promise<Record<string, unknown>> {
  const path = join(packageRoot, "package.json");
  const status = await lstat(path);
  if (!status.isFile() || status.isSymbolicLink() || status.size > maximumToolManifestBytes) throw new Error(`Tool package manifest is not a bounded regular file: ${path}`);
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error(`Tool package manifest is not an object: ${path}`);
  return parsed as Record<string, unknown>;
}

async function regularFile(path: string, label: string): Promise<string> {
  if (!isAbsolute(path)) throw new Error(`${label} must resolve to an absolute path`);
  const exact = await realpath(path);
  const status = await lstat(exact);
  if (!status.isFile() || status.isSymbolicLink()) throw new Error(`${label} is not a regular file: ${path}`);
  return exact;
}

async function anyRegularFile(paths: readonly string[]): Promise<boolean> {
  for (const path of paths) {
    try { if ((await lstat(path)).isFile()) return true; } catch { /* try next launcher */ }
  }
  return false;
}

function pathDirectories(environment: Readonly<Record<string, string | undefined>>): readonly string[] {
  return [...new Set((environment.PATH ?? environment.Path ?? "").split(delimiter)
    .map((entry) => entry.trim().replace(/^"|"$/gu, ""))
    .filter((entry) => entry.length > 0 && isAbsolute(entry)))];
}

function selectedEnvironment(environment: Readonly<Record<string, string | undefined>>): Record<string, string> {
  return Object.fromEntries(inheritedCommandEnvironmentKeys.flatMap((key) => {
    const value = environment[key];
    return value === undefined ? [] : [[key, value]];
  }));
}

function recordString(value: unknown, key: string): string | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && typeof (value as Record<string, unknown>)[key] === "string"
    ? (value as Record<string, string>)[key]
    : undefined;
}

function within(root: string, target: string): boolean {
  const path = relative(resolve(root), resolve(target));
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}
