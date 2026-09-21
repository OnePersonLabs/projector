import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { isAbsolute, resolve, sep } from "node:path";

import { hashFramedDomain, type ContentHash } from "@projector/core";

import {
  agentBrowserArgvHash,
  createAgentBrowserProtocolRunner,
  parseAgentBrowserProtocolPayload,
  validateAgentBrowserSessionBinding,
  type AgentBrowserProtocolRunner,
} from "./agent-browser-protocol.js";

import type {
  PsychordArtifactIdentity,
  PsychordBrowserCommandEvidence,
  PsychordBrowserController,
  PsychordCleanupObservation,
  PsychordCurrentnessObservation,
  PsychordDependencyPin,
  PsychordObservationHost,
  PsychordObservationPlan,
  PsychordPreparedAttempt,
  PsychordStoredTraceEvidence,
  PsychordUiSnapshot,
} from "./psychord.js";
import { listenOnPlannedLoopback } from "./psychord-loopback-server.js";

export interface PsychordCommandRequest {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
  readonly maxOutputBytes: number;
  readonly signal: AbortSignal;
}

export interface PsychordCommandResult {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
}

export interface PsychordCommandRunner {
  run(request: PsychordCommandRequest): Promise<PsychordCommandResult>;
}

export interface PsychordAgentBrowserHostConfiguration {
  readonly build: {
    readonly nodeExecutable: string;
    readonly pnpmCli: string;
  };
  readonly agentBrowser: {
    readonly executable: string;
    readonly expectedVersion: "0.31.1";
    readonly chromeExecutable: string;
    readonly namespace: string;
    readonly session: string;
    readonly stdioDrainTimeoutMs: number;
  };
  readonly commandEnvironment: Readonly<Record<string, string>>;
}

export interface PsychordAgentBrowserHostDependencies {
  readonly commands: PsychordCommandRunner;
  readonly agentBrowserCommands?: AgentBrowserProtocolRunner;
  readonly configuration: PsychordAgentBrowserHostConfiguration;
}

export function createPsychordAgentBrowserHost(dependencies: PsychordAgentBrowserHostDependencies): PsychordObservationHost {
  return {
    async prepare(plan, { signal }) {
      const diagnostics: string[] = [];
      const resources: { kind: "server-process" | "browser-context"; handle: string; runId: string }[] = [];
      const browserCommands: PsychordBrowserCommandEvidence[] = [];
      let server: Server | undefined;
      let serverOwned = false;
      const browser = new AgentBrowserCommandClient(dependencies, plan, browserCommands);
      const cleanup = async (cleanupSignal: AbortSignal): Promise<PsychordCleanupObservation> => {
        const observations: PsychordCleanupObservation["resources"][number][] = [];
        if (browser.sessionMayExist) {
          try {
            const result = await browser.command(["close"], cleanupSignal);
            const payload = parseAgentBrowserProtocolPayload(result.stdout);
            const closed = payload.success === true && isRecord(payload.data) && payload.data.closed === true;
            observations.push({ kind: "browser-context", handle: browser.handle, outcome: closed ? "released" : "failed" });
            if (!closed) diagnostics.push("agent-browser close did not confirm the owned session was closed");
          } catch (error) {
            observations.push({ kind: "browser-context", handle: browser.handle, outcome: "failed" });
            diagnostics.push(errorMessage(error));
          }
        }
        if (server !== undefined && serverOwned) {
          try {
            await closeServer(server, cleanupSignal);
            serverOwned = false;
            observations.push({ kind: "server-process", handle: serverHandle(plan), outcome: "released" });
          } catch (error) {
            observations.push({ kind: "server-process", handle: serverHandle(plan), outcome: "failed" });
            diagnostics.push(errorMessage(error));
          }
        }
        return { complete: observations.every(({ outcome }) => outcome === "released" || outcome === "not-found"), resources: observations, diagnostics };
      };

      try {
        validateHostConfiguration(dependencies.configuration, plan);
        const version = await runChecked(dependencies.commands, {
          executable: dependencies.configuration.agentBrowser.executable,
          args: ["--version"],
          cwd: plan.repository.root,
          env: dependencies.configuration.commandEnvironment,
          timeoutMs: plan.limits.timeoutMs,
          maxOutputBytes: plan.limits.maximumOutputBytes,
          signal,
        });
        if (version.stdout.trim() !== `agent-browser ${dependencies.configuration.agentBrowser.expectedVersion}`) {
          throw new Error("agent-browser version did not match the plan-bound host configuration");
        }
        await runChecked(dependencies.commands, {
          executable: dependencies.configuration.build.nodeExecutable,
          args: [dependencies.configuration.build.pnpmCli, "run", "build"],
          cwd: plan.repository.root,
          env: dependencies.configuration.commandEnvironment,
          timeoutMs: plan.limits.timeoutMs,
          maxOutputBytes: plan.limits.maximumOutputBytes,
          signal,
        });
        const buildArtifacts = await readExpectedArtifacts(plan);
        server = createOwnedServer(plan, buildArtifacts);
        try {
          await listenOnPlannedLoopback(server, plan, signal);
          serverOwned = true;
        } catch (error) {
          serverOwned = server.listening;
          throw error;
        }
        resources.push({ kind: "server-process", handle: serverHandle(plan), runId: plan.runId });
        const readiness = await fetchReadiness(plan, signal);
        const servedArtifacts = await fetchServedArtifacts(plan, signal);
        browser.markSessionMayExist();
        resources.push({ kind: "browser-context", handle: browser.handle, runId: plan.runId });
        const opened = parseAgentBrowserProtocolPayload((await browser.command(["open", resolvePlanUrl(plan, plan.server.applicationPath)], signal)).stdout);
        if (opened.success !== true) throw new Error("agent-browser did not report successful navigation");
        await browser.assertSessionBinding(signal);
        const freshStorage = await browser.readFreshStorage(signal);
        const attempt: PsychordPreparedAttempt = {
          runId: plan.runId,
          actualOrigin: plan.server.expectedOrigin,
          readiness,
          buildArtifacts,
          servedArtifacts,
          browserContext: { id: browser.handle, freshStorage },
          ownedResources: resources,
          browserCommands,
          controller: browser,
          observeCurrentness: async (currentnessSignal) => await observeCurrentness(dependencies.commands, plan, dependencies.configuration.commandEnvironment, currentnessSignal),
          collectDiagnostics: async (diagnosticSignal) => await browser.collectDiagnostics(diagnosticSignal),
          cleanup,
        };
        return { status: "prepared", attempt };
      } catch (error) {
        diagnostics.push(errorMessage(error));
        const cleanupDeadline = new AbortController();
        const cleanupTimeout = setTimeout(() => cleanupDeadline.abort(new Error(`Psychord host cleanup exceeded ${plan.limits.cleanupTimeoutMs}ms`)), plan.limits.cleanupTimeoutMs);
        let cleanupObservation: PsychordCleanupObservation;
        try { cleanupObservation = await cleanup(cleanupDeadline.signal); }
        finally { clearTimeout(cleanupTimeout); }
        return {
          status: "unavailable",
          diagnostics,
          ownedResources: resources,
          browserCommands,
          cleanup: cleanupObservation,
          ...(!cleanupObservation.complete ? { recovery: { code: "psychord-host-cleanup-unproved", action: "recover only the recorded server and browser handles for this run" } } : {}),
        };
      }
    },
  };
}

class AgentBrowserCommandClient implements PsychordBrowserController {
  readonly handle: string;
  readonly #baseArgs: readonly string[];
  #sessionMayExist = false;

  constructor(
    private readonly dependencies: PsychordAgentBrowserHostDependencies,
    private readonly plan: PsychordObservationPlan,
    private readonly evidence: PsychordBrowserCommandEvidence[],
  ) {
    const browser = dependencies.configuration.agentBrowser;
    this.handle = `agent-browser:${browser.namespace}:${browser.session}`;
    this.#baseArgs = [
      "--namespace", browser.namespace,
      "--session", browser.session,
      "--engine", "chrome",
      "--executable-path", browser.chromeExecutable,
      "--json",
      "--max-output", String(plan.limits.maximumOutputBytes),
    ];
  }

  get sessionMayExist(): boolean { return this.#sessionMayExist; }
  markSessionMayExist(): void { this.#sessionMayExist = true; }

  async command(args: readonly string[], signal: AbortSignal): Promise<PsychordCommandResult> {
    const executable = this.dependencies.configuration.agentBrowser.executable;
    const argv = [...this.#baseArgs, ...args];
    const result = await (this.dependencies.agentBrowserCommands ?? createAgentBrowserProtocolRunner()).run({
      executable,
      args: argv,
      cwd: this.plan.repository.root,
      env: this.dependencies.configuration.commandEnvironment,
      timeoutMs: this.plan.limits.timeoutMs,
      maxOutputBytes: this.plan.limits.maximumOutputBytes,
      stdioDrainTimeoutMs: this.dependencies.configuration.agentBrowser.stdioDrainTimeoutMs,
      signal,
    });
    this.evidence.push({
      argvHash: agentBrowserArgvHash(executable, argv),
      exitCode: result.exitCode,
      signal: result.signal,
      durationMs: result.durationMs,
      ...result.completion,
    });
    if (result.exitCode !== 0 || result.signal !== null) throw new Error(`agent-browser failed (${result.exitCode ?? result.signal}): ${result.stderr.trim()}`);
    return result;
  }

  async assertSessionBinding(signal: AbortSignal): Promise<void> {
    const payload = parseAgentBrowserProtocolPayload((await this.command(["session", "info"], signal)).stdout);
    const configured = this.dependencies.configuration.agentBrowser;
    validateAgentBrowserSessionBinding(payload, { namespace: configured.namespace, session: configured.session, version: configured.expectedVersion });
  }

  async readFreshStorage(signal: AbortSignal): Promise<boolean> {
    const payload = await this.evaluate("({length:localStorage.length,moments:localStorage.getItem('psychord.moments.v1')})", signal);
    return isRecord(payload) && payload.length === 0 && payload.moments === null;
  }

  async snapshot(signal: AbortSignal): Promise<PsychordUiSnapshot> {
    const raw = await this.evaluate(snapshotScript, signal);
    if (!isRecord(raw) || !isRecord(raw.controls)) throw new Error("Psychord snapshot did not match the controller contract");
    const storageRaw = typeof raw.storageRaw === "string" ? raw.storageRaw : undefined;
    return {
      sound: raw.sound === "running" || raw.sound === "error" ? raw.sound : "disabled",
      controls: {
        listen: raw.controls.listen === true,
        keep: raw.controls.keep === true,
        clear: raw.controls.clear === true,
      },
      archiveCount: integer(raw.archiveCount),
      replay: raw.replay === "active" ? "active" : "idle",
      playerNoteCount: integer(raw.playerNoteCount),
      activeVoiceCount: integer(raw.activeVoiceCount),
      playerEvents: [],
      ...(typeof raw.notice === "string" && raw.notice !== "" ? { notice: raw.notice } : {}),
      ...(storageRaw === undefined ? {} : { storage: decodeStoredTrace(storageRaw) }),
    };
  }

  async enableSoundWithGesture(signal: AbortSignal): Promise<void> { await this.command(["click", ".sound-control"], signal); }
  async playKeyboardNote(input: { readonly code: "KeyA"; readonly holdMs: number }, signal: AbortSignal): Promise<void> {
    if (input.code !== "KeyA") throw new Error("Psychord controller only supports the representative KeyA trigger");
    await this.command(["press", "a"], signal);
    await this.command(["click", "[aria-label^='Play C4,']"], signal);
    await this.command(["keydown", "Space"], signal);
    try { await this.command(["wait", String(input.holdMs)], signal); }
    finally { await this.command(["keyup", "Space"], signal); }
  }
  async keepMoment(signal: AbortSignal): Promise<void> { await this.command(["click", ".phrase-actions .button:nth-of-type(2)"], signal); }
  async reload(signal: AbortSignal): Promise<void> { await this.command(["reload"], signal); }
  async openArchive(signal: AbortSignal): Promise<void> { await this.command(["click", ".archive-toggle"], signal); }
  async listenToFirstSavedMoment(signal: AbortSignal): Promise<void> { await this.command(["click", ".moment-list .button.small"], signal); }
  async waitForReplay(state: "active" | "idle", signal: AbortSignal): Promise<void> {
    const expression = state === "active"
      ? "document.body.innerText.includes('Stop replay')"
      : "!document.body.innerText.includes('Stop replay')";
    await this.command(["wait", "--fn", expression], signal);
  }
  async injectStorageWriteFailure(signal: AbortSignal): Promise<void> {
    await this.evaluate("Storage.prototype.setItem=()=>{throw new Error('forced-storage-write-failure')};true", signal);
  }

  async collectDiagnostics(signal: AbortSignal): Promise<readonly string[]> {
    const diagnostics: string[] = [];
    for (const command of [["console"], ["errors"]] as const) {
      try {
        const result = await this.command(command, signal);
        if (result.stdout.trim() !== "") diagnostics.push(result.stdout.trim());
        if (result.stderr.trim() !== "") diagnostics.push(result.stderr.trim());
      } catch (error) { diagnostics.push(errorMessage(error)); }
    }
    return diagnostics;
  }

  private async evaluate(script: string, signal: AbortSignal): Promise<unknown> {
    const encoded = Buffer.from(script, "utf8").toString("base64");
    const payload = parseAgentBrowserProtocolPayload((await this.command(["eval", "-b", encoded], signal)).stdout);
    if (payload.success !== true || !isRecord(payload.data) || !("result" in payload.data)) throw new Error("agent-browser evaluation failed");
    return payload.data.result;
  }
}

const snapshotScript = `(()=>{const buttons=[...document.querySelectorAll('button')];const byText=t=>buttons.find(b=>b.textContent?.trim()===t);const enabled=t=>{const b=byText(t);return !!b&&!b.disabled};const sound=byText('Sound ready')?'running':byText('Retry sound')?'error':'disabled';const live=document.querySelector('.sr-only')?.textContent||'';const match=live.match(/(\\d+) notes sounding/);return {sound,controls:{listen:enabled('Listen back'),keep:enabled('Keep this moment'),clear:enabled('Clear')},archiveCount:Number(document.querySelector('.count')?.textContent||0),replay:byText('Stop replay')?'active':'idle',playerNoteCount:document.querySelectorAll('.played-note').length,activeVoiceCount:match?Number(match[1]):0,notice:document.querySelector('[role=status]')?.textContent?.trim()||'',storageRaw:localStorage.getItem('psychord.moments.v1')}})()`;

async function readExpectedArtifacts(plan: PsychordObservationPlan): Promise<readonly PsychordArtifactIdentity[]> {
  return await Promise.all(plan.server.expectedBuildArtifacts.map(async ({ role, buildLocator }) => ({
    role,
    locator: buildLocator,
    contentHash: sha256(await readFile(resolveWithin(plan.repository.root, buildLocator))),
  })));
}

function createOwnedServer(plan: PsychordObservationPlan, artifacts: readonly PsychordArtifactIdentity[]): Server {
  const byPath = new Map(plan.server.expectedBuildArtifacts.map((expected) => {
    const actual = artifacts.find(({ role, locator }) => role === expected.role && locator === expected.buildLocator);
    if (actual === undefined) throw new Error(`missing built artifact ${expected.buildLocator}`);
    return [expected.requestPath, { expected, actual }] as const;
  }));
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", plan.server.expectedOrigin);
      if (url.pathname === plan.server.readinessPath) {
        const body = Buffer.from(JSON.stringify({ nonce: plan.server.readinessNonce }), "utf8");
        response.writeHead(200, { "content-type": "application/json", "content-length": body.byteLength });
        response.end(body);
        return;
      }
      const entry = byPath.get(url.pathname);
      if (entry === undefined) { response.writeHead(404); response.end(); return; }
      const body = await readFile(resolveWithin(plan.repository.root, entry.expected.buildLocator));
      if (sha256(body) !== entry.actual.contentHash) { response.writeHead(409); response.end(); return; }
      response.writeHead(200, { "content-type": contentType(entry.expected.buildLocator), "content-length": body.byteLength, "cache-control": "no-store" });
      response.end(body);
    } catch { response.writeHead(500); response.end(); }
  });
}

async function fetchReadiness(plan: PsychordObservationPlan, signal: AbortSignal): Promise<{ url: string; status: number; nonce: string }> {
  const url = resolvePlanUrl(plan, plan.server.readinessPath);
  const response = await fetch(url, { signal, redirect: "error" });
  const payload: unknown = await response.json();
  return { url: response.url, status: response.status, nonce: isRecord(payload) && typeof payload.nonce === "string" ? payload.nonce : "" };
}

async function fetchServedArtifacts(plan: PsychordObservationPlan, signal: AbortSignal): Promise<readonly PsychordArtifactIdentity[]> {
  return await Promise.all(plan.server.expectedBuildArtifacts.map(async ({ role, requestPath }) => {
    const url = resolvePlanUrl(plan, requestPath);
    const response = await fetch(url, { signal, redirect: "error" });
    if (response.status !== 200 || response.url !== url) throw new Error(`served artifact request failed for ${url}`);
    return { role, locator: response.url, contentHash: sha256(Buffer.from(await response.arrayBuffer())) };
  }));
}

async function observeCurrentness(commands: PsychordCommandRunner, plan: PsychordObservationPlan, env: Readonly<Record<string, string>>, signal: AbortSignal): Promise<PsychordCurrentnessObservation> {
  const dependencies = await Promise.all(plan.dependencies.map(async (pin) => await observeDependency(plan, pin)));
  const observedWorktreeDigest = await capturePsychordWorktreeDigest(commands, plan, env, signal);
  const stale = observedWorktreeDigest !== plan.repository.worktreeDigest || dependencies.some(({ status }) => status === "stale");
  const unavailable = dependencies.some(({ status }) => status === "unavailable");
  return { status: unavailable ? "unknown" : stale ? "stale" : "current", observedWorktreeDigest, dependencies };
}

async function observeDependency(plan: PsychordObservationPlan, pin: PsychordDependencyPin): Promise<PsychordCurrentnessObservation["dependencies"][number]> {
  try {
    const observedHash = sha256(await readFile(resolveDependency(plan, pin.locator)));
    return { role: pin.role, locator: pin.locator, expectedHash: pin.contentHash, observedHash, status: observedHash === pin.contentHash ? "current" : "stale" };
  } catch {
    return { role: pin.role, locator: pin.locator, expectedHash: pin.contentHash, status: "unavailable" };
  }
}

export async function capturePsychordWorktreeDigest(commands: PsychordCommandRunner, plan: Pick<PsychordObservationPlan, "repository" | "limits">, env: Readonly<Record<string, string>>, signal: AbortSignal): Promise<ContentHash> {
  const request = (args: readonly string[]) => runChecked(commands, { executable: "git", args, cwd: plan.repository.root, env, timeoutMs: plan.limits.timeoutMs, maxOutputBytes: plan.limits.maximumOutputBytes, signal });
  const [tree, diff, untracked] = await Promise.all([
    request(["ls-tree", "-r", "-z", "HEAD"]),
    request(["diff", "--binary", "--no-ext-diff", "HEAD", "--", ".", ":(exclude).projector", ":(exclude).projector/**"]),
    request(["ls-files", "--others", "--exclude-standard", "-z"]),
  ]);
  const applicationTree = tree.stdout.split("\0").filter((entry) => {
    const separator = entry.indexOf("\t");
    return separator >= 0 && !isProjectorMetadataPath(entry.slice(separator + 1));
  }).join("\0");
  const paths = untracked.stdout.split("\0").filter((path) => path.length > 0 && !isProjectorMetadataPath(path)).sort();
  const untrackedHashes = await Promise.all(paths.map(async (path) => [path, sha256(await readFile(resolveWithin(plan.repository.root, path)))] as const));
  return hashFramedDomain("psychord-application-worktree@2", JSON.stringify({ tree: applicationTree, diff: diff.stdout, untracked: untrackedHashes }));
}

function isProjectorMetadataPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  return normalized === ".projector" || normalized.startsWith(".projector/");
}

async function runChecked(runner: PsychordCommandRunner, request: PsychordCommandRequest): Promise<PsychordCommandResult> {
  const result = await runner.run(request);
  if (result.exitCode !== 0 || result.signal !== null) throw new Error(`command failed: ${request.executable} (${result.exitCode ?? result.signal ?? "unknown"})\n${result.stdout}\n${result.stderr}`);
  return result;
}

function validateHostConfiguration(configuration: PsychordAgentBrowserHostConfiguration, plan: PsychordObservationPlan): void {
  const safeIdentity = /^[a-zA-Z0-9._-]+$/u;
  if (process.platform !== "win32"
    || !isAbsolute(configuration.build.nodeExecutable) || !isAbsolute(configuration.build.pnpmCli)
    || !isAbsolute(configuration.agentBrowser.executable) || !isAbsolute(configuration.agentBrowser.chromeExecutable)
    || !safeIdentity.test(configuration.agentBrowser.namespace) || !safeIdentity.test(configuration.agentBrowser.session)
    || configuration.agentBrowser.namespace === "default" || configuration.agentBrowser.session === "default"
    || !Number.isSafeInteger(configuration.agentBrowser.stdioDrainTimeoutMs) || configuration.agentBrowser.stdioDrainTimeoutMs < 0
    || !isPinnedToolchain(plan, configuration.build.nodeExecutable)
    || !isPinnedToolchain(plan, configuration.build.pnpmCli)
    || !isPinnedToolchain(plan, configuration.agentBrowser.executable)
    || !isPinnedToolchain(plan, configuration.agentBrowser.chromeExecutable)) {
    throw new Error("Psychord Windows Chrome host configuration is invalid or not pinned by the plan");
  }
}

function isPinnedToolchain(plan: PsychordObservationPlan, executable: string): boolean {
  const expected = resolve(executable);
  return plan.dependencies.some(({ role, locator }) => role === "toolchain" && resolveDependency(plan, locator) === expected);
}

function decodeStoredTrace(raw: string): PsychordStoredTraceEvidence {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Psychord stored moments were not an array");
  const noteEvents: PsychordStoredTraceEvidence["noteEvents"][number][] = [];
  for (const moment of parsed) {
    if (!isRecord(moment) || !isRecord(moment.trace) || !Array.isArray(moment.trace.events)) throw new Error("Psychord stored trace was not readable");
    for (const event of moment.trace.events) {
      if (!isRecord(event) || (event.type !== "note-on" && event.type !== "note-off") || !isRecord(event.source)) continue;
      const common = {
        eventId: string(event.eventId), ingestSequence: integer(event.ingestSequence), atMs: number(event.atMs),
        sourceId: string(event.source.sourceId), sourceSequence: integer(event.source.sourceSequence),
        sourceTimestamp: decodeSourceTimestamp(event.source.sourceTimestamp), pitch: integer(event.pitch), midiChannel: integer(event.midiChannel), disposition: "accepted" as const,
      };
      noteEvents.push(event.type === "note-on"
        ? { ...common, type: "note-on", velocity: number(event.velocity) }
        : { ...common, type: "note-off", releaseVelocity: number(event.releaseVelocity) });
    }
  }
  return { rawContentHash: sha256(Buffer.from(raw, "utf8")), rawByteLength: Buffer.byteLength(raw, "utf8"), momentCount: parsed.length, noteEvents };
}

function decodeSourceTimestamp(value: unknown): PsychordStoredTraceEvidence["noteEvents"][number]["sourceTimestamp"] {
  if (value === null) return null;
  if (!isRecord(value) || typeof value.value !== "number" || (value.clock !== "device" && value.clock !== "host-monotonic" && value.clock !== "unknown")) throw new Error("invalid source timestamp");
  return { value: value.value, clock: value.clock };
}

function closeServer(server: Server, signal: AbortSignal): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const abort = (): void => reject(signal.reason ?? new Error("server cleanup aborted"));
    signal.addEventListener("abort", abort, { once: true });
    server.close((error) => { signal.removeEventListener("abort", abort); error === undefined ? resolvePromise() : reject(error); });
    server.closeAllConnections();
  });
}

function resolveDependency(plan: PsychordObservationPlan, locator: string): string { return isAbsolute(locator) ? resolve(locator) : resolveWithin(plan.repository.root, locator); }
function resolveWithin(root: string, locator: string): string {
  const target = resolve(root, locator);
  const prefix = resolve(root) + sep;
  if (target !== resolve(root) && !target.startsWith(prefix)) throw new Error(`path escapes repository root: ${locator}`);
  return target;
}
function resolvePlanUrl(plan: PsychordObservationPlan, path: string): string { return new URL(path, `${plan.server.expectedOrigin}/`).href; }
function serverHandle(plan: PsychordObservationPlan): string { return `http-server:${plan.server.expectedOrigin}`; }
function sha256(bytes: Uint8Array): ContentHash { return `sha256:v1:${createHash("sha256").update(bytes).digest("hex")}`; }
function contentType(path: string): string { return path.endsWith(".html") ? "text/html; charset=utf-8" : path.endsWith(".js") ? "text/javascript; charset=utf-8" : path.endsWith(".css") ? "text/css; charset=utf-8" : "application/octet-stream"; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function integer(value: unknown): number { if (!Number.isSafeInteger(value)) throw new Error("expected integer observation"); return value as number; }
function number(value: unknown): number { if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("expected finite numeric observation"); return value; }
function string(value: unknown): string { if (typeof value !== "string" || value === "") throw new Error("expected non-empty string observation"); return value; }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
