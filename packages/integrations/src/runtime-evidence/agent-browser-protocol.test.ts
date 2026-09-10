import { expect, it } from "vitest";

import {
  AgentBrowserProtocolError,
  createAgentBrowserProtocolRunner,
  parseAgentBrowserProtocolPayload,
  validateAgentBrowserSessionBinding,
} from "./agent-browser-protocol.js";

it.each(["", "{", "null", "{}", '{"success":true}', '{"success":false,"data":{}}'])(
  "rejects incomplete or malformed protocol output: %s",
  (stdout) => expect(() => parseAgentBrowserProtocolPayload(stdout)).toThrow(/incomplete|malformed|envelope/u),
);

it("rejects a successful response bound to the wrong browser session", () => {
  const payload = parseAgentBrowserProtocolPayload(JSON.stringify({
    success: true,
    data: {
      active: true,
      namespace: "owned-namespace",
      session: "different-session",
      version: "0.31.1",
      runtime: { engine: "chrome", restoreStatus: "not_configured" },
    },
    error: null,
  }));
  expect(() => validateAgentBrowserSessionBinding(payload, {
    namespace: "owned-namespace",
    session: "owned-session",
    version: "0.31.1",
  })).toThrow(/session identity/u);
});

it("accepts the exact fresh Chrome session binding", () => {
  const payload = parseAgentBrowserProtocolPayload(JSON.stringify({
    success: true,
    data: {
      active: true,
      namespace: "owned-namespace",
      session: "owned-session",
      version: "0.31.1",
      runtime: { engine: "chrome", restoreStatus: "not_configured" },
    },
    error: null,
  }));
  expect(() => validateAgentBrowserSessionBinding(payload, {
    namespace: "owned-namespace",
    session: "owned-session",
    version: "0.31.1",
  })).not.toThrow();
});

it("reports cancellation before root exit without descendant-cleanup claims", async () => {
  const controller = new AbortController();
  const run = createAgentBrowserProtocolRunner().run(request(["-e", "setTimeout(()=>{}, 10_000)"], controller.signal));
  setTimeout(() => controller.abort(), 25);
  await expect(run).rejects.toMatchObject({ limit: "aborted" } satisfies Partial<AgentBrowserProtocolError>);
});

it("bounds inherited pipe drain after observing root exit", async () => {
  const childScript = "setTimeout(()=>{},250)";
  const parentScript = `require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(childScript)}],{stdio:['ignore',1,2],detached:true}).unref();process.stdout.write('ok')`;
  const result = await createAgentBrowserProtocolRunner().run(request(["-e", parentScript], new AbortController().signal, 20));
  expect(result).toMatchObject({
    exitCode: 0,
    stdout: "ok",
    completion: { rootExitObserved: true, stdio: "detached-after-bounded-drain", descendantState: "not-observed" },
  });
});

function request(args: readonly string[], signal: AbortSignal, stdioDrainTimeoutMs = 50) {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  return {
    executable: process.execPath,
    args,
    cwd: process.cwd(),
    env,
    timeoutMs: 2_000,
    maxOutputBytes: 4_096,
    stdioDrainTimeoutMs,
    signal,
  };
}
