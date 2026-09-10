import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { basename, join, relative } from "node:path";

import type { ContentHash } from "@projector/core";
import {
  capturePsychordWorktreeDigest,
  createPsychordAgentBrowserHost,
  createPsychordApplicationObservationPlan,
  createPsychordApplicationObserver,
  createStrictPsychordApplicationObserver,
  observePsychordEvidenceCurrentness,
  type PsychordCommandRequest,
  type PsychordCommandResult,
  type PsychordCommandRunner,
  type PsychordDependencyPin,
  type PsychordObservationPlan,
} from "@projector/integrations/runtime-evidence";
import { expect, it } from "vitest";

import { createDurablePsychordObservationArtifactService } from "./psychord.js";
import { createPsychordApplicationEvidenceAssessmentService } from "./psychord-assessment.js";

const real = process.env.PROJECTOR_RUN_REAL_PSYCHORD === "1" ? it : it.skip;
const psychordRoot = process.env.PROJECTOR_PSYCHORD_ROOT ?? "C:/dev/projects/psychord-omega";
const nodeExecutable = process.env.PROJECTOR_NODE_EXECUTABLE ?? "C:/Users/zethj/AppData/Local/Temp/projector-wrap-up-node24-20260910/node-v24.19.0-win-x64/node.exe";
const pnpmCli = process.env.PROJECTOR_PNPM_CLI ?? "C:/Users/zethj/AppData/Roaming/npm/node_modules/pnpm/bin/pnpm.cjs";
const agentBrowserExecutable = process.env.PROJECTOR_AGENT_BROWSER_EXECUTABLE ?? "C:/Users/zethj/AppData/Roaming/npm/node_modules/agent-browser/bin/agent-browser-win32-x64.exe";
const chromeExecutable = process.env.PROJECTOR_CHROME_EXECUTABLE ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const integrationsEvidenceRoot = join(import.meta.dirname, "../../../integrations/src/runtime-evidence");
const hostFile = join(integrationsEvidenceRoot, "psychord-agent-browser-host.ts");
const protocolFile = join(integrationsEvidenceRoot, "agent-browser-protocol.ts");
const contractFile = join(integrationsEvidenceRoot, "psychord-contract.ts");
const artifactServiceFile = join(integrationsEvidenceRoot, "psychord-artifact-set.ts");
const compositionFile = new URL("./psychord.ts", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/u, (value) => value.slice(1));
const testFile = new URL("./psychord.real.test.ts", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/u, (value) => value.slice(1));

class FiniteNativeCommandRunner implements PsychordCommandRunner {
  async run(request: PsychordCommandRequest): Promise<PsychordCommandResult> {
    return await new Promise((resolvePromise, reject) => {
      const startedAt = performance.now();
      const child = spawn(request.executable, [...request.args], {
        cwd: request.cwd,
        env: request.env,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let bytes = 0;
      let settled = false;
      const fail = (error: Error): void => {
        if (settled) return;
        settled = true;
        child.kill("SIGKILL");
        reject(error);
      };
      const capture = (target: Buffer[], chunk: Buffer): void => {
        bytes += chunk.byteLength;
        if (bytes > request.maxOutputBytes) { fail(new Error("real-test command output exceeded its bound")); return; }
        target.push(chunk);
      };
      child.stdout.on("data", (chunk: Buffer) => capture(stdout, chunk));
      child.stderr.on("data", (chunk: Buffer) => capture(stderr, chunk));
      const timeout = setTimeout(() => fail(new Error("real-test command exceeded its time bound")), request.timeoutMs);
      const abort = (): void => fail(new Error("real-test command aborted"));
      request.signal.addEventListener("abort", abort, { once: true });
      child.once("error", fail);
      child.once("exit", (exitCode, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        request.signal.removeEventListener("abort", abort);
        child.stdout.destroy();
        child.stderr.destroy();
        const durationMs = performance.now() - startedAt;
        resolvePromise({ exitCode, signal, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8"), durationMs });
      });
    });
  }
}

for (const caseName of ["keep-reload-replay", "save-failure"] as const) {
  real(`observes the real Psychord ${caseName} flow in owned Windows Chrome`, async () => {
    const runner = new FiniteNativeCommandRunner();
    const environment = commandEnvironment();
    const signal = AbortSignal.timeout(90_000);
    const build = await runner.run({ executable: nodeExecutable, args: [pnpmCli, "build"], cwd: psychordRoot, env: environment, timeoutMs: 30_000, maxOutputBytes: 262_144, signal });
    expect(build).toMatchObject({ exitCode: 0, signal: null });
    const runId = `psychord-real-${caseName}-${randomUUID()}`;
    const port = await allocatePort();
    const dependencies = await dependencyPins();
    const scenario = JSON.parse(await readFile(join(psychordRoot, ".projector/model/scenarios/9c1e2ad3d203e2c2b9a840364f70b786f86c48bdf5f58883f4bd82d80a827083.scenario.json"), "utf8")) as { semanticHash: ContentHash };
    const plan: PsychordObservationPlan = {
      runId,
      case: caseName,
      scenario: { id: "scenario:keep-reload-replay-owned-moment", semanticHash: scenario.semanticHash },
      repository: { root: psychordRoot, gitHead: "", worktreeDigest: sha256(Buffer.alloc(0)) },
      dependencies,
      ownedArtifactRoot: join(psychordRoot, ".projector/runtime/application-evidence", runId),
      representativeInput: { code: "KeyA", holdMs: 1_500 },
      server: {
        expectedOrigin: `http://127.0.0.1:${port}`,
        readinessNonce: randomUUID(),
        readinessPath: "/.projector-ready",
        applicationPath: "/",
        expectedBuildArtifacts: await expectedBuildArtifacts(),
      },
      limits: { timeoutMs: 60_000, cleanupTimeoutMs: 5_000, maximumOutputBytes: 262_144, maximumDiagnosticBytes: 65_536 },
    };
    const head = (await runner.run({ executable: "git", args: ["rev-parse", "HEAD"], cwd: psychordRoot, env: environment, timeoutMs: 5_000, maxOutputBytes: 4_096, signal })).stdout.trim();
    const repository = { ...plan.repository, gitHead: head, worktreeDigest: await capturePsychordWorktreeDigest(runner, plan, environment, signal) };
    const boundPlan = { ...plan, repository };
    const host = createPsychordAgentBrowserHost({
      commands: runner,
      configuration: {
        build: { executable: nodeExecutable, args: [pnpmCli, "build"] },
        agentBrowser: { executable: agentBrowserExecutable, expectedVersion: "0.31.1", chromeExecutable, namespace: `projector-${runId}`, session: runId, stdioDrainTimeoutMs: 250 },
        commandEnvironment: environment,
      },
    });

    await mkdir(boundPlan.ownedArtifactRoot, { recursive: true });
    const artifactService = createDurablePsychordObservationArtifactService({
      storageRoot: boundPlan.ownedArtifactRoot,
      observer: createStrictPsychordApplicationObserver(createPsychordApplicationObserver(host)),
    });
    const persisted = await artifactService.observeAndPublish(createPsychordApplicationObservationPlan(boundPlan), { signal });
    if (persisted.status !== "published") throw new Error(JSON.stringify(persisted, null, 2));
    const reopened = createDurablePsychordObservationArtifactService({
      storageRoot: boundPlan.ownedArtifactRoot,
      observer: { async observeApplication() { throw new Error("published evidence read must not recollect"); } },
    });
    const authenticated = await reopened.read(persisted.artifactSetId);
    if (authenticated.status !== "published") throw new Error(JSON.stringify(authenticated, null, 2));
    const assessments = createPsychordApplicationEvidenceAssessmentService({
      artifacts: reopened,
      currentness: { async observe(currentPlan, { signal: currentnessSignal }) {
        return await observePsychordEvidenceCurrentness({ commands: runner, plan: currentPlan, environment, signal: currentnessSignal });
      } },
    });
    const assessment = await assessments.assess({
      schemaVersion: "psychord-application-evidence-assessment-request@1",
      requirementId: "requirement:keep-owned-moment",
      scenario: persisted.plan.scenario,
      case: caseName,
      predicate: caseName === "keep-reload-replay"
        ? { id: "predicate:keep-reload-replay", assertionIds: ["explicit-save", "reload-restores-archive", "replay-is-not-player-input", "replay-preserves-persisted-provenance"] }
        : { id: "predicate:save-failure-preservation", assertionIds: ["save-failure-visible", "save-failure-preserves-archive"] },
      observations: [{ role: "latest", runId, artifactSetId: persisted.artifactSetId }],
    }, { signal });
    expect(assessment).toMatchObject({ fulfillment: { status: "satisfied", selectedArtifactSetId: persisted.artifactSetId }, observations: [{ eligibility: "eligible", reuseCurrentness: { status: "current" } }] });
    const result = persisted.result;
    const output = result.adapter.output;

    if (result.operationalStatus !== "completed" || result.outcome !== "passed" || !result.cleanup.complete) {
      throw new Error(JSON.stringify(result, null, 2));
    }
    expect(result).toMatchObject({ operationalStatus: "completed", outcome: "passed", currentness: "current", cleanup: { complete: true } });
    expect(persisted.behavioralEvidence).toBe(true);
    expect(authenticated.behavioralEvidence).toBe(true);
    expect(output.assertions.every(({ passed }) => passed)).toBe(true);
    expect(output.host.readiness).toMatchObject({ status: 200, nonce: boundPlan.server.readinessNonce });
    expect(output.host.buildArtifacts).toHaveLength(boundPlan.server.expectedBuildArtifacts.length);
    expect(output.host.servedArtifacts).toHaveLength(boundPlan.server.expectedBuildArtifacts.length);
    expect(output.host.browserCommands.length).toBeGreaterThan(0);
    expect(output.host.browserCommands.every(({ rootExitObserved, descendantState }) => rootExitObserved && descendantState === "not-observed")).toBe(true);
    expect(output.host.browserCommands.some(({ stdio }) => stdio === "detached-after-bounded-drain")).toBe(true);
  }, 150_000);
}

async function dependencyPins(): Promise<readonly PsychordDependencyPin[]> {
  const entries: readonly [PsychordDependencyPin["role"], string][] = [
    ["source", "src/ui/App.tsx"], ["source", "src/ui/PianoKeyboard.tsx"], ["source", "src/application/session-controller.ts"], ["source", "src/platform/moments.ts"],
    ["lockfile", "pnpm-lock.yaml"], ["build-config", "vite.config.ts"], ["controller", hostFile], ["helper", protocolFile], ["helper", contractFile], ["helper", artifactServiceFile], ["helper", compositionFile], ["helper", testFile], ["fixture", "src/platform/moments.ts"],
    ["toolchain", nodeExecutable], ["toolchain", pnpmCli], ["toolchain", agentBrowserExecutable], ["toolchain", chromeExecutable],
  ];
  return await Promise.all(entries.map(async ([role, locator]) => ({ role, locator, contentHash: sha256(await readFile(locator.includes(":") ? locator : join(psychordRoot, locator))) })));
}

async function expectedBuildArtifacts(): Promise<PsychordObservationPlan["server"]["expectedBuildArtifacts"]> {
  const dist = join(psychordRoot, "dist");
  const files = await walk(dist);
  return await Promise.all(files.map(async (file) => {
    const locator = relative(psychordRoot, file).replaceAll("\\", "/");
    const requestPath = basename(file) === "index.html" ? "/" : `/${relative(dist, file).replaceAll("\\", "/")}`;
    return { role: basename(file) === "index.html" ? "application-document" : `asset:${requestPath}`, buildLocator: locator, requestPath, contentHash: sha256(await readFile(file)) };
  }));
}

async function walk(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => entry.isDirectory() ? await walk(join(root, entry.name)) : [join(root, entry.name)]));
  return nested.flat().sort();
}

async function allocatePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolvePromise, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolvePromise); });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("failed to allocate loopback port");
  await new Promise<void>((resolvePromise, reject) => server.close((error) => error === undefined ? resolvePromise() : reject(error)));
  return address.port;
}

function commandEnvironment(): Readonly<Record<string, string>> {
  const env: Record<string, string> = {};
  for (const key of ["PATH", "Path", "PATHEXT", "SystemRoot", "SYSTEMROOT", "TEMP", "TMP", "USERPROFILE", "LOCALAPPDATA", "APPDATA"]) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}

function sha256(bytes: Uint8Array): ContentHash { return `sha256:v1:${createHash("sha256").update(bytes).digest("hex")}`; }
