import { spawn } from "node:child_process";
import { open, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { canonicalJson, hashFramedDomain, type ContentHash, type StructuredModelRequest, type StructuredModelResponse } from "@projector/core";

import type { AuthenticatedModelRoute, InferencePorts, ModelCallControl } from "../models/inference.js";

export type CodexExecProviderErrorCode = "unavailable" | "unsupported-auth" | "unsupported-contract" | "invalid-request" | "cancelled" | "timeout" | "output-limit" | "token-budget" | "process-failed" | "malformed-response";

export class CodexExecProviderError extends Error {
  constructor(readonly code: CodexExecProviderErrorCode, message: string) { super(message); this.name = "CodexExecProviderError"; }
}

export interface CodexExecCapabilities {
  readonly providerId: "codex-cli-chatgpt";
  readonly available: boolean;
  readonly executable: boolean;
  readonly authenticated: boolean;
  readonly authKind: "chatgpt-subscription" | "unsupported" | "unavailable";
  readonly providerRevision?: string;
  readonly structuredOutput: boolean;
  readonly programmaticExecution: boolean;
  readonly cancellation: boolean;
  readonly filesystemAccess: "read-only";
  readonly configuration: "isolated";
  readonly tokenBudgetEnforcement: "preflight-and-observed";
  readonly monetaryCostMetering: false;
  readonly reason?: string;
}

export interface CodexProcessRequest {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly environment: Readonly<Record<string, string>>;
  readonly stdin: string;
  readonly signal?: AbortSignal;
  readonly timeoutMs: number;
  readonly maximumOutputBytes: number;
}
export interface CodexProcessResult { readonly exitCode: number; readonly stdout: string; readonly stderr: string }
export interface CodexProcessRunner { run(request: CodexProcessRequest): Promise<CodexProcessResult> }

export interface CodexExecProviderOptions {
  readonly cwd: string;
  readonly model: string;
  readonly executable?: string;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly maximumOutputBytes?: number;
  readonly probeTimeoutMs?: number;
  readonly runner?: CodexProcessRunner;
}

const PROVIDER_ID = "codex-cli-chatgpt" as const;
const DEFAULT_MAXIMUM_OUTPUT_BYTES = 1024 * 1024;
const DEFAULT_PROBE_TIMEOUT_MS = 5_000;
const REQUIRED_EXEC_FLAGS = ["--output-schema", "--json", "--output-last-message", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--sandbox", "--cd"] as const;

function validBound(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive safe integer`);
  return value;
}

function minimalEnvironment(source: Readonly<Record<string, string | undefined>>): Readonly<Record<string, string>> {
  const allowed = process.platform === "win32" ? ["PATH", "HOME", "CODEX_HOME", "TMPDIR", "LANG", "LC_ALL", "SystemRoot"] : ["PATH", "HOME", "CODEX_HOME", "TMPDIR", "LANG", "LC_ALL"];
  const entries: Array<[string, string]> = []; for (const key of allowed) if (typeof source[key] === "string" && source[key] !== "") entries.push([key, source[key]!]);
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}

function safeFailureMessage(error: unknown): string {
  if (error instanceof CodexExecProviderError) return error.message;
  if (error instanceof Error && "code" in error && error.code === "ENOENT") return "Codex CLI executable was not found";
  return "Codex CLI process could not be started";
}

export class SpawnCodexProcessRunner implements CodexProcessRunner {
  async run(request: CodexProcessRequest): Promise<CodexProcessResult> {
    if (request.signal?.aborted === true) throw new CodexExecProviderError("cancelled", "Codex CLI execution was cancelled");
    return new Promise<CodexProcessResult>((resolve, reject) => {
      let settled = false; let stdoutBytes = 0; let stderrBytes = 0; const stdout: Buffer[] = []; const stderr: Buffer[] = [];
      const child = spawn(request.executable, [...request.args], { cwd: request.cwd, env: { ...request.environment }, shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
      const stop = (error: CodexExecProviderError) => { if (settled) return; settled = true; clearTimeout(timer); request.signal?.removeEventListener("abort", cancel); child.kill("SIGKILL"); reject(error); };
      const cancel = () => stop(new CodexExecProviderError("cancelled", "Codex CLI execution was cancelled"));
      const timer = setTimeout(() => stop(new CodexExecProviderError("timeout", "Codex CLI execution exceeded its wall-clock budget")), request.timeoutMs);
      request.signal?.addEventListener("abort", cancel, { once: true });
      const collect = (target: Buffer[], chunk: Buffer, stream: "stdout" | "stderr") => {
        if (settled) return;
        if (stream === "stdout") stdoutBytes += chunk.byteLength; else stderrBytes += chunk.byteLength;
        if (stdoutBytes + stderrBytes > request.maximumOutputBytes) { stop(new CodexExecProviderError("output-limit", "Codex CLI diagnostic output exceeded its byte budget")); return; }
        target.push(chunk);
      };
      child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk, "stdout")); child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk, "stderr"));
      child.once("error", (error) => { if (settled) return; settled = true; clearTimeout(timer); request.signal?.removeEventListener("abort", cancel); reject(error); });
      child.once("close", (exitCode) => { if (settled) return; settled = true; clearTimeout(timer); request.signal?.removeEventListener("abort", cancel); resolve({ exitCode: exitCode ?? 1, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") }); });
      child.stdin.end(request.stdin);
    });
  }
}

function unavailable(executable: boolean, reason: string, authKind: CodexExecCapabilities["authKind"] = "unavailable", providerRevision?: string): CodexExecCapabilities {
  return { providerId: PROVIDER_ID, available: false, executable, authenticated: false, authKind, ...(providerRevision === undefined ? {} : { providerRevision }), structuredOutput: false, programmaticExecution: false, cancellation: true, filesystemAccess: "read-only", configuration: "isolated", tokenBudgetEnforcement: "preflight-and-observed", monetaryCostMetering: false, reason };
}

function parseUsage(stdout: string): { readonly inputTokens: number; readonly outputTokens: number } {
  let usage: { readonly inputTokens: number; readonly outputTokens: number } | undefined;
  for (const line of stdout.split(/\r?\n/u).filter((value) => value.trim() !== "")) {
    let event: unknown; try { event = JSON.parse(line); } catch { throw new CodexExecProviderError("malformed-response", "Codex CLI emitted malformed structured event output"); }
    if (event !== null && typeof event === "object" && (event as { type?: unknown }).type === "turn.completed") {
      const raw = (event as { usage?: { input_tokens?: unknown; output_tokens?: unknown } }).usage; const inputTokens = raw?.input_tokens; const outputTokens = raw?.output_tokens;
      if (Number.isSafeInteger(inputTokens) && Number(inputTokens) >= 0 && Number.isSafeInteger(outputTokens) && Number(outputTokens) >= 0) usage = { inputTokens: Number(inputTokens), outputTokens: Number(outputTokens) };
    }
  }
  if (usage === undefined) throw new CodexExecProviderError("malformed-response", "Codex CLI did not provide authenticated token usage");
  return usage;
}

async function boundedRead(path: string, maximumBytes: number): Promise<string> {
  const handle = await open(path, "r");
  try { const stat = await handle.stat(); if (stat.size > maximumBytes) throw new CodexExecProviderError("output-limit", "Codex CLI structured response exceeded its byte budget"); return await handle.readFile("utf8"); }
  finally { await handle.close(); }
}

export interface CodexExecProvider {
  capabilities(signal?: AbortSignal): Promise<CodexExecCapabilities>;
  authenticatedRoute(control?: ModelCallControl): Promise<AuthenticatedModelRoute>;
  generateStructured<T>(request: StructuredModelRequest<T>, control?: ModelCallControl): Promise<StructuredModelResponse<T>>;
}

export function createCodexExecRouter(provider: CodexExecProvider): InferencePorts["router"] {
  return { route: async (_request, control) => provider.authenticatedRoute(control) };
}

export function createCodexExecProvider(options: CodexExecProviderOptions): CodexExecProvider {
  const executable = options.executable ?? "codex"; const model = options.model.trim();
  if (model === "" || /[\u0000\r\n]/u.test(model)) throw new Error("Codex provider requires an explicit safe model identity");
  const maximumOutputBytes = validBound(options.maximumOutputBytes ?? DEFAULT_MAXIMUM_OUTPUT_BYTES, "maximumOutputBytes"); const probeTimeoutMs = validBound(options.probeTimeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS, "probeTimeoutMs");
  const runner = options.runner ?? new SpawnCodexProcessRunner(); const environment = minimalEnvironment(options.environment ?? process.env);
  const invoke = async (cwd: string, args: readonly string[], timeoutMs: number, signal?: AbortSignal, stdin = ""): Promise<CodexProcessResult> => runner.run({ executable, args, cwd, environment, stdin, timeoutMs, maximumOutputBytes: Math.max(64 * 1024, maximumOutputBytes), ...(signal === undefined ? {} : { signal }) });

  async function probe(signal: AbortSignal | undefined, totalTimeoutMs: number): Promise<CodexExecCapabilities> {
    const deadline = Date.now() + validBound(totalTimeoutMs, "probe timeout"); const remaining = (): number => { const value = deadline - Date.now(); if (value < 1) throw new CodexExecProviderError("timeout", "Codex CLI capability probe exceeded its wall-clock budget"); return value; };
    let cwd: string; try { cwd = await realpath(options.cwd); } catch { return unavailable(false, "Provider working directory is unavailable"); }
    let versionResult: CodexProcessResult; try { versionResult = await invoke(cwd, ["--version"], remaining(), signal); } catch (error) { if (error instanceof CodexExecProviderError && (error.code === "cancelled" || error.code === "timeout")) throw error; return unavailable(false, safeFailureMessage(error)); }
    const providerRevision = versionResult.stdout.trim().split(/\r?\n/u)[0]?.slice(0, 120); if (versionResult.exitCode !== 0 || providerRevision === undefined || !/^codex-cli\s+\d+\.\d+\.\d+/u.test(providerRevision)) return unavailable(true, "Codex CLI version identity is unavailable");
    let login: CodexProcessResult; try { login = await invoke(cwd, ["login", "status"], remaining(), signal); } catch (error) { if (error instanceof CodexExecProviderError && (error.code === "cancelled" || error.code === "timeout")) throw error; return unavailable(true, "Codex CLI login status is unavailable", "unavailable", providerRevision); }
    const loginStatus = `${login.stdout}\n${login.stderr}`;
    if (login.exitCode !== 0 || !/logged in using chatgpt/iu.test(loginStatus)) {
      const unsupported = /api key|access token/iu.test(loginStatus); return unavailable(true, unsupported ? "Codex CLI is authenticated with unsupported credentials; a ChatGPT subscription login is required" : "Codex CLI is not authenticated with a ChatGPT subscription", unsupported ? "unsupported" : "unavailable", providerRevision);
    }
    let help: CodexProcessResult; try { help = await invoke(cwd, ["exec", "--help"], remaining(), signal); } catch (error) { if (error instanceof CodexExecProviderError && (error.code === "cancelled" || error.code === "timeout")) throw error; return unavailable(true, "Codex CLI exec contract is unavailable", "chatgpt-subscription", providerRevision); }
    const missing = REQUIRED_EXEC_FLAGS.filter((flag) => !help.stdout.includes(flag));
    if (help.exitCode !== 0 || missing.length > 0) return unavailable(true, "Codex CLI does not expose the required bounded structured-exec contract", "chatgpt-subscription", providerRevision);
    return { providerId: PROVIDER_ID, available: true, executable: true, authenticated: true, authKind: "chatgpt-subscription", providerRevision, structuredOutput: true, programmaticExecution: true, cancellation: true, filesystemAccess: "read-only", configuration: "isolated", tokenBudgetEnforcement: "preflight-and-observed", monetaryCostMetering: false };
  }
  async function capabilities(signal?: AbortSignal): Promise<CodexExecCapabilities> { return probe(signal, probeTimeoutMs); }

  async function executeStructured<T>(request: StructuredModelRequest<T>, control: ModelCallControl | undefined, proven: CodexExecCapabilities): Promise<StructuredModelResponse<T>> {
    if (!proven.available || proven.providerRevision === undefined) throw new CodexExecProviderError(proven.authKind === "unsupported" ? "unsupported-auth" : "unavailable", proven.reason ?? "Codex CLI provider is unavailable");
    if (request.inputHash !== hashFramedDomain("structured-model-input", request.input)) throw new CodexExecProviderError("invalid-request", "Codex provider input hash does not match normalized input");
    if (!Number.isSafeInteger(request.maxInputTokens) || request.maxInputTokens! < 1 || !Number.isSafeInteger(request.maxOutputTokens) || request.maxOutputTokens! < 1) throw new CodexExecProviderError("invalid-request", "Codex provider requires explicit positive input and output token budgets");
    const cwd = await realpath(options.cwd); const requestHash: ContentHash = hashFramedDomain("codex-exec-structured-request", request); const capsuleHash = request.executionCapsule === undefined ? undefined : hashFramedDomain("codex-exec-capsule-binding", request.executionCapsule);
    const promptValue = { protocol: "projector.codex-structured.v1", requestHash, purpose: request.purpose, role: request.role, programVersion: request.programVersion, schemaName: request.schemaName, schemaVersion: request.schemaVersion, schemaHash: hashFramedDomain("codex-exec-output-schema", request.schema), input: request.input, inputHash: request.inputHash, ...(request.executionCapsule === undefined ? {} : { executionCapsule: request.executionCapsule, capsuleHash }), risk: request.risk, maxInputTokens: request.maxInputTokens, maxOutputTokens: request.maxOutputTokens, instruction: "Return only one JSON value matching the supplied output schema. Do not modify files or use credentials." };
    const prompt = canonicalJson(promptValue); const schemaText = `${canonicalJson(request.schema)}\n`; const estimatedInputTokens = Math.ceil((Buffer.byteLength(prompt, "utf8") + Buffer.byteLength(schemaText, "utf8")) / 4);
    if (estimatedInputTokens > request.maxInputTokens!) throw new CodexExecProviderError("token-budget", "Codex provider prompt exceeds its declared input token budget");
    const timeoutMs = validBound(control?.timeoutMs ?? probeTimeoutMs, "timeoutMs"); const temporary = await mkdtemp(join(tmpdir(), "projector-codex-exec-")); const schemaPath = join(temporary, "schema.json"); const outputPath = join(temporary, "response.json");
    try {
      await writeFile(schemaPath, schemaText, { encoding: "utf8", mode: 0o600, flag: "wx" });
      const result = await invoke(cwd, ["exec", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--sandbox", "read-only", "--color", "never", "--output-schema", schemaPath, "--output-last-message", outputPath, "--json", "--cd", cwd, "--model", model, "-"], timeoutMs, control?.signal, prompt);
      if (result.exitCode !== 0) throw new CodexExecProviderError("process-failed", `Codex CLI structured execution failed with exit code ${result.exitCode}`);
      const usage = parseUsage(result.stdout); if (usage.inputTokens > request.maxInputTokens! || usage.outputTokens > request.maxOutputTokens!) throw new CodexExecProviderError("token-budget", "Codex CLI exceeded the declared token budget");
      const raw = await boundedRead(outputPath, maximumOutputBytes); let value: T; try { value = JSON.parse(raw) as T; } catch { throw new CodexExecProviderError("malformed-response", "Codex CLI returned malformed structured JSON"); }
      return { value, provider: PROVIDER_ID, model, providerRevision: proven.providerRevision, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, rawResponseHash: hashFramedDomain("structured-model-response-value", value), attempt: 1 };
    } finally { await rm(temporary, { recursive: true, force: true }); }
  }

  const provider: CodexExecProvider = {
    capabilities,
    async authenticatedRoute(control) { const proven = await probe(control?.signal, control?.timeoutMs ?? probeTimeoutMs); if (!proven.available || proven.providerRevision === undefined) throw new CodexExecProviderError(proven.authKind === "unsupported" ? "unsupported-auth" : proven.authKind === "chatgpt-subscription" ? "unsupported-contract" : "unavailable", proven.reason ?? "Codex CLI provider is unavailable"); const value = { providerId: PROVIDER_ID, model, providerRevision: proven.providerRevision }; return { value, contentHash: hashFramedDomain("authenticated-model-route", value), provider: { generateStructured: (request: StructuredModelRequest<unknown>, callControl?: ModelCallControl) => executeStructured(request, callControl, proven) } }; },
    async generateStructured<T>(request: StructuredModelRequest<T>, control?: ModelCallControl) { const totalTimeoutMs = control?.timeoutMs ?? probeTimeoutMs; const started = Date.now(); const proven = await probe(control?.signal, totalTimeoutMs); const remaining = totalTimeoutMs - (Date.now() - started); if (remaining < 1) throw new CodexExecProviderError("timeout", "Codex CLI execution exceeded its wall-clock budget"); return executeStructured(request, { timeoutMs: remaining, ...(control?.signal === undefined ? {} : { signal: control.signal }) }, proven); },
  };
  return provider;
}
