import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";

import { canonicalDocumentEnvelopeSchemaForKind, hydrateCanonicalDocumentWire, withCanonicalHashes, type BehavioralScenario, type ContentHash, type EvidenceRef } from "@projector/core";
import {
  capturePsychordWorktreeDigest,
  createPsychordApplicationObservationPlan,
  observePsychordEvidenceCurrentness,
  type PsychordCommandRequest,
  type PsychordCommandResult,
  type PsychordCommandRunner,
  type PsychordDependencyPin,
  type PsychordApplicationObservationPlan,
  type PsychordObservationPlan,
} from "@projector/integrations/runtime-evidence";
import { parseTomlDocument } from "@projector/runtime";
import { expect, it } from "vitest";

import {
  createDurablePsychordAgentBrowserObservationArtifactService,
  createDurablePsychordObservationArtifactService,
} from "./psychord.js";
import { createPsychordApplicationEvidenceAssessmentService, type PsychordScenarioEnvelope } from "./psychord-assessment.js";

const real = process.env.PROJECTOR_RUN_REAL_PSYCHORD === "1" ? it : it.skip;
const psychordRoot = process.env.PROJECTOR_PSYCHORD_ROOT ?? "C:/dev/projects/psychord-omega";
const nodeExecutable = process.env.PROJECTOR_NODE_EXECUTABLE ?? process.execPath;
const pnpmCli = process.env.PROJECTOR_PNPM_CLI ?? "C:/Users/zethj/AppData/Roaming/npm/node_modules/pnpm/bin/pnpm.cjs";
const agentBrowserExecutable = process.env.PROJECTOR_AGENT_BROWSER_EXECUTABLE ?? "C:/Users/zethj/AppData/Roaming/npm/node_modules/agent-browser/bin/agent-browser-win32-x64.exe";
const chromeExecutable = process.env.PROJECTOR_CHROME_EXECUTABLE ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const applicationEvidenceRoot = join(psychordRoot, ".projector/runtime/application-evidence");
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

for (const caseName of ["no-input", "keep-reload-replay", "save-failure"] as const) {
  real(`observes the real Psychord ${caseName} flow in owned Windows Chrome`, async () => {
    const runner = new FiniteNativeCommandRunner();
    const environment = commandEnvironment();
    const signal = AbortSignal.timeout(90_000);
    const build = await runner.run({ executable: nodeExecutable, args: [pnpmCli, "build"], cwd: psychordRoot, env: environment, timeoutMs: 30_000, maxOutputBytes: 262_144, signal });
    expect(build).toMatchObject({ exitCode: 0, signal: null });
    const runId = `psychord-real-${caseName}-${randomUUID()}`;
    const port = await allocatePort();
    const dependencies = await dependencyPins();
    const scenario = canonicalDocumentEnvelopeSchemaForKind("behavioral-scenario").parse(hydrateCanonicalDocumentWire(parseTomlDocument(await readFile(join(psychordRoot, ".projector/model/scenarios/scenario-keep-reload-replay-owned-moment--9c1e2ad3d203e2c2b9a840364f70b786f86c48bdf5f58883f4bd82d80a827083.scenario.toml"), "utf8")))) as PsychordScenarioEnvelope;
    const plan: PsychordObservationPlan = {
      runId,
      case: caseName,
      scenario: { id: "scenario:keep-reload-replay-owned-moment", semanticHash: scenario.semanticHash },
      repository: { root: psychordRoot, gitHead: "", worktreeDigest: sha256(Buffer.alloc(0)) },
      dependencies,
      ownedArtifactRoot: applicationEvidenceRoot,
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
    await mkdir(boundPlan.ownedArtifactRoot, { recursive: true });
    const artifactService = createDurablePsychordAgentBrowserObservationArtifactService({
      storageRoot: boundPlan.ownedArtifactRoot,
      commands: runner,
      configuration: {
        build: { nodeExecutable, pnpmCli },
        agentBrowser: { executable: agentBrowserExecutable, expectedVersion: "0.31.1", chromeExecutable, namespace: `projector-${runId}`, session: runId, stdioDrainTimeoutMs: 250 },
        commandEnvironment: environment,
      },
    });
    const persisted = await artifactService.observeAndPublish(createPsychordApplicationObservationPlan(boundPlan), { signal });
    if (persisted.status !== "published") throw new Error(JSON.stringify(persisted, null, 2));
    const reopened = createDurablePsychordObservationArtifactService({
      storageRoot: boundPlan.ownedArtifactRoot,
      observer: { async observeApplication() { throw new Error("published evidence read must not recollect"); } },
    });
    const authenticated = await reopened.read(persisted.artifactSetId);
    if (authenticated.status !== "published") throw new Error(JSON.stringify(authenticated, null, 2));
    const evidence: EvidenceRef = {
        evidenceId: persisted.artifactSetId,
        stance: "supports",
        applicationPredicate: {
          kind: "application-observation",
          adapter: { id: persisted.plan.adapter.id, version: persisted.plan.adapter.version },
          scenario: persisted.plan.scenario,
          case: caseName,
          predicateId: caseName === "no-input"
            ? "predicate:no-input-is-not-player"
            : caseName === "keep-reload-replay"
              ? "predicate:keep-reload-replay"
              : "predicate:save-failure-preservation",
          assertionIds: caseName === "no-input"
            ? ["no-input-player"]
            : caseName === "keep-reload-replay"
              ? ["explicit-save", "reload-restores-archive", "replay-is-not-player-input", "replay-preserves-persisted-provenance"]
              : ["save-failure-visible", "save-failure-preserves-archive"],
          observationRole: "latest",
        },
    };
    const boundOwner = realAssessmentRequest(persisted.plan, evidence, scenario);
    const assessments = createPsychordApplicationEvidenceAssessmentService({
      artifacts: reopened,
      currentness: { async observe(currentPlan, { signal: currentnessSignal }) {
        return await observePsychordEvidenceCurrentness({ commands: runner, plan: currentPlan, environment, signal: currentnessSignal });
      } },
      owners: { async readCurrent() { return boundOwner.owner; } },
    });
    const assessment = await assessments.assess(boundOwner.request, { signal });
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

real("keeps attached Projector evidence current while detecting dirty source, controller, and missing build bytes", async () => {
  const runner = new FiniteNativeCommandRunner();
  const environment = commandEnvironment();
  const signal = AbortSignal.timeout(60_000);
  const parent = await mkdtemp(join(tmpdir(), "projector-psychord-currentness-real-"));
  const root = join(parent, "psychord");
  try {
    const clone = await runner.run({ executable: "git", args: ["clone", "--quiet", "--no-hardlinks", psychordRoot, root], cwd: parent, env: environment, timeoutMs: 20_000, maxOutputBytes: 65_536, signal });
    expect(clone).toMatchObject({ exitCode: 0, signal: null });
    await cp(join(psychordRoot, "dist"), join(root, "dist"), { recursive: true });
    const controllerLocator = "task-evidence-controller.ts";
    await writeFile(join(root, controllerLocator), await readFile(hostFile));
    const runId = `psychord-real-currentness-${randomUUID()}`;
    const head = (await runner.run({ executable: "git", args: ["rev-parse", "HEAD"], cwd: root, env: environment, timeoutMs: 5_000, maxOutputBytes: 4_096, signal })).stdout.trim();
    const scenario = hydrateCanonicalDocumentWire(parseTomlDocument(await readFile(join(root, ".projector/model/scenarios/scenario-keep-reload-replay-owned-moment--9c1e2ad3d203e2c2b9a840364f70b786f86c48bdf5f58883f4bd82d80a827083.scenario.toml"), "utf8")));
    const base: PsychordObservationPlan = {
      runId,
      case: "no-input",
      scenario: { id: "scenario:keep-reload-replay-owned-moment", semanticHash: scenario.semanticHash },
      repository: { root, gitHead: head, worktreeDigest: sha256(Buffer.alloc(0)) },
      dependencies: await dependencyPins(root, controllerLocator),
      ownedArtifactRoot: join(root, ".projector/runtime/application-evidence"),
      representativeInput: { code: "KeyA", holdMs: 1_500 },
      server: { expectedOrigin: "http://127.0.0.1:43123", readinessNonce: randomUUID(), readinessPath: "/.projector-ready", applicationPath: "/", expectedBuildArtifacts: await expectedBuildArtifacts(root) },
      limits: { timeoutMs: 30_000, cleanupTimeoutMs: 5_000, maximumOutputBytes: 262_144, maximumDiagnosticBytes: 65_536 },
    };
    const plan = createPsychordApplicationObservationPlan({ ...base, repository: { ...base.repository, worktreeDigest: await capturePsychordWorktreeDigest(runner, base, environment, signal) } });
    const observe = () => observePsychordEvidenceCurrentness({ commands: runner, plan, environment, signal });
    await expect(observe()).resolves.toMatchObject({ status: "current", repository: { observedGitHead: head, status: "current" } });

    await mkdir(join(root, ".projector/runtime/application-evidence/attached"), { recursive: true });
    const attachedEvidencePath = ".projector/runtime/application-evidence/attached/evidence.json";
    await writeFile(join(root, attachedEvidencePath), "{}\n");
    const addMetadata = await runner.run({ executable: "git", args: ["add", "--force", "--", attachedEvidencePath], cwd: root, env: environment, timeoutMs: 5_000, maxOutputBytes: 4_096, signal });
    expect(addMetadata).toMatchObject({ exitCode: 0, signal: null });
    const commitMetadata = await runner.run({ executable: "git", args: ["-c", "user.name=Projector Test", "-c", "user.email=projector@example.invalid", "commit", "--quiet", "-m", "attach application evidence"], cwd: root, env: environment, timeoutMs: 5_000, maxOutputBytes: 4_096, signal });
    expect(commitMetadata).toMatchObject({ exitCode: 0, signal: null });
    const attached = await observe();
    expect(attached).toMatchObject({ status: "current", repository: { expectedGitHead: head, status: "current" } });
    expect(attached.repository.observedGitHead).not.toBe(head);
    const attachedHead = attached.repository.observedGitHead;

    const sourcePath = join(root, "src/ui/App.tsx");
    const source = await readFile(sourcePath);
    await writeFile(sourcePath, Buffer.concat([source, Buffer.from("\n// relevant unchanged-HEAD evidence edit\n")]));
    const dirty = await observe();
    expect(dirty).toMatchObject({ status: "stale", repository: { observedGitHead: attachedHead, status: "stale" } });
    expect(dirty.dependencies).toContainEqual(expect.objectContaining({ role: "source", locator: "src/ui/App.tsx", status: "stale" }));
    await writeFile(sourcePath, source);

    await writeFile(join(root, controllerLocator), "export const changedController = true;\n");
    const changedController = await observe();
    expect(changedController).toMatchObject({ status: "stale", repository: { observedGitHead: attachedHead, status: "stale" } });
    expect(changedController.dependencies).toContainEqual(expect.objectContaining({ role: "controller", locator: controllerLocator, status: "stale" }));

    const documentPath = join(root, "dist/index.html");
    const missingPath = join(root, "dist/index.html.missing");
    await rename(documentPath, missingPath);
    const missing = await observe();
    expect(missing).toMatchObject({ status: "unknown" });
    expect(missing.buildArtifacts).toContainEqual(expect.objectContaining({ role: "application-document", locator: "dist/index.html", status: "unavailable" }));
    await rename(missingPath, documentPath);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
}, 90_000);

function realAssessmentRequest(plan: PsychordApplicationObservationPlan, evidence: EvidenceRef, scenario: PsychordScenarioEnvelope) {
  if (scenario.id !== plan.scenario.id || scenario.semanticHash !== plan.scenario.semanticHash) throw new Error("real observation plan must bind the authenticated Psychord scenario");
  const payload: BehavioralScenario = { ...scenario.payload, evidence: [evidence] };
  const owner = canonicalDocumentEnvelopeSchemaForKind("behavioral-scenario").parse(withCanonicalHashes({ apiVersion: scenario.apiVersion, schemaVersion: scenario.schemaVersion, kind: "behavioral-scenario" as const, id: scenario.id, key: scenario.key, lifecycle: scenario.lifecycle, payload: { ...payload } })) as PsychordScenarioEnvelope;
  if (owner.semanticHash !== scenario.semanticHash) throw new Error("adding observation custody must not change scenario meaning identity");
  return {
    owner,
    request: {
      schemaVersion: "psychord-application-evidence-assessment-request@4" as const,
      owner: { kind: "behavioral-scenario" as const, id: owner.id, canonicalDocumentHash: owner.canonicalDocumentHash },
      evidenceIds: [evidence.evidenceId],
    },
  };
}

async function dependencyPins(root = psychordRoot, controllerLocator = hostFile): Promise<readonly PsychordDependencyPin[]> {
  const entries: readonly [PsychordDependencyPin["role"], string][] = [
    ["source", "src/ui/App.tsx"], ["source", "src/ui/PianoKeyboard.tsx"], ["source", "src/application/session-controller.ts"], ["source", "src/platform/moments.ts"],
    ["lockfile", "pnpm-lock.yaml"], ["build-config", "vite.config.ts"], ["controller", controllerLocator], ["helper", protocolFile], ["helper", contractFile], ["helper", artifactServiceFile], ["helper", compositionFile], ["helper", testFile], ["fixture", "src/platform/moments.ts"],
    ["toolchain", nodeExecutable], ["toolchain", pnpmCli], ["toolchain", agentBrowserExecutable], ["toolchain", chromeExecutable],
  ];
  return await Promise.all(entries.map(async ([role, locator]) => ({ role, locator, contentHash: sha256(await readFile(locator.includes(":") ? locator : join(root, locator))) })));
}

async function expectedBuildArtifacts(root = psychordRoot): Promise<PsychordObservationPlan["server"]["expectedBuildArtifacts"]> {
  const dist = join(root, "dist");
  const files = await walk(dist);
  return await Promise.all(files.map(async (file) => {
    const locator = relative(root, file).replaceAll("\\", "/");
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
