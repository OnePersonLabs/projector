import { createHash } from "node:crypto";
import { spawn } from "node:child_process";

export interface AgentBrowserProtocolRequest {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
  readonly maxOutputBytes: number;
  readonly stdioDrainTimeoutMs: number;
  readonly signal: AbortSignal;
}

export interface AgentBrowserProtocolResult {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly completion: {
    readonly rootExitObserved: true;
    readonly stdio: "closed" | "detached-after-bounded-drain";
    readonly descendantState: "not-observed";
  };
}

export interface AgentBrowserProtocolRunner {
  run(request: AgentBrowserProtocolRequest): Promise<AgentBrowserProtocolResult>;
}

export class AgentBrowserProtocolError extends Error {
  constructor(readonly limit: "aborted" | "output" | "timeout" | "spawn", message: string) {
    super(message);
    this.name = "AgentBrowserProtocolError";
  }
}

export function createAgentBrowserProtocolRunner(): AgentBrowserProtocolRunner {
  return {
    async run(request) {
      validateRequest(request);
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
        let outputBytes = 0;
        let settled = false;
        let stdoutClosed = false;
        let stderrClosed = false;

        const settleFailure = (error: AgentBrowserProtocolError): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          request.signal.removeEventListener("abort", abort);
          child.kill("SIGKILL");
          child.stdout.destroy();
          child.stderr.destroy();
          reject(error);
        };
        const capture = (target: Buffer[], chunk: Buffer): void => {
          outputBytes += chunk.byteLength;
          if (outputBytes > request.maxOutputBytes) {
            settleFailure(new AgentBrowserProtocolError("output", `agent-browser exceeded ${request.maxOutputBytes} output bytes`));
            return;
          }
          target.push(chunk);
        };
        child.stdout.on("data", (chunk: Buffer) => capture(stdout, chunk));
        child.stderr.on("data", (chunk: Buffer) => capture(stderr, chunk));
        child.stdout.once("close", () => { stdoutClosed = true; });
        child.stderr.once("close", () => { stderrClosed = true; });
        const timeout = setTimeout(() => settleFailure(new AgentBrowserProtocolError("timeout", `agent-browser exceeded ${request.timeoutMs}ms before root exit`)), request.timeoutMs);
        const abort = (): void => settleFailure(new AgentBrowserProtocolError("aborted", "agent-browser was aborted before root exit"));
        request.signal.addEventListener("abort", abort, { once: true });
        if (request.signal.aborted) abort();
        child.once("error", (error) => settleFailure(new AgentBrowserProtocolError("spawn", error.message)));
        child.once("exit", (exitCode, signal) => {
          if (settled) return;
          clearTimeout(timeout);
          request.signal.removeEventListener("abort", abort);
          const finish = (stdio: AgentBrowserProtocolResult["completion"]["stdio"]): void => {
            if (settled) return;
            settled = true;
            child.stdout.destroy();
            child.stderr.destroy();
            resolvePromise({
              exitCode,
              signal,
              stdout: Buffer.concat(stdout).toString("utf8"),
              stderr: Buffer.concat(stderr).toString("utf8"),
              durationMs: performance.now() - startedAt,
              completion: { rootExitObserved: true, stdio, descendantState: "not-observed" },
            });
          };
          if (stdoutClosed && stderrClosed) { finish("closed"); return; }
          const drain = setTimeout(() => finish("detached-after-bounded-drain"), request.stdioDrainTimeoutMs);
          const maybeFinish = (): void => {
            if (stdoutClosed && stderrClosed) { clearTimeout(drain); finish("closed"); }
          };
          child.stdout.once("close", maybeFinish);
          child.stderr.once("close", maybeFinish);
        });
      });
    },
  };
}

export function parseAgentBrowserProtocolPayload(stdout: string): Record<string, unknown> {
  let payload: unknown;
  try { payload = JSON.parse(stdout); }
  catch { throw new Error("agent-browser output was incomplete or malformed JSON"); }
  if (!isRecord(payload) || typeof payload.success !== "boolean"
    || (payload.success && !("data" in payload))
    || (!payload.success && !("error" in payload))) {
    throw new Error("agent-browser output did not match the protocol envelope");
  }
  return payload;
}

export function validateAgentBrowserSessionBinding(
  payload: Record<string, unknown>,
  expected: { readonly namespace: string; readonly session: string; readonly version: string },
): void {
  const data = payload.data;
  const runtime = isRecord(data) && isRecord(data.runtime) ? data.runtime : undefined;
  if (payload.success !== true || !isRecord(data) || data.active !== true
    || data.namespace !== expected.namespace || data.session !== expected.session
    || data.version !== expected.version || runtime?.engine !== "chrome"
    || runtime.restoreStatus !== "not_configured") {
    throw new Error("agent-browser session identity, engine, version, or fresh-state routing did not match the plan");
  }
}

export function agentBrowserArgvHash(executable: string, args: readonly string[]): string {
  return `sha256:v1:${createHash("sha256").update(JSON.stringify([executable, ...args])).digest("hex")}`;
}

function validateRequest(request: AgentBrowserProtocolRequest): void {
  if (!Number.isSafeInteger(request.timeoutMs) || request.timeoutMs <= 0
    || !Number.isSafeInteger(request.maxOutputBytes) || request.maxOutputBytes <= 0
    || !Number.isSafeInteger(request.stdioDrainTimeoutMs) || request.stdioDrainTimeoutMs < 0) {
    throw new TypeError("agent-browser protocol bounds are invalid");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
