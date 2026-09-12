import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { hashFramedDomain, type RiskAssessment, type StructuredModelRequest } from "@projector/core";
import { describe, expect, it } from "vitest";

import { CodexExecProviderError, DISABLED_CODEX_EXEC_FEATURES, createCodexExecProvider, type CodexProcessRequest, type CodexProcessRunner } from "./provider.js";

const risk: RiskAssessment = { class: "R0", inherentOperationRisk: 0, affectedUnitCount: 0, affectedSurfaceCount: 0, publicContractImpact: false, externalImpact: false, dataImpact: false, reversibility: "full", validationStrength: "strong", closureConfidence: "bounded", unresolvedIdentityCount: 0, relevanceFrontierCount: 0, openWorldDependencies: false, unresolvedBlockingConcernCount: 0, suspectDecisionCount: 0, compensationAvailable: true, reasons: [] };
const request = (): StructuredModelRequest<{ label: string }> => ({ purpose: "classify fixture", role: "classify", programVersion: "1", schemaName: "label", schemaVersion: "1", schema: { type: "object", additionalProperties: false, required: ["label"], properties: { label: { type: "string" } } }, input: { evidence: ["safe"] }, inputHash: hashFramedDomain("structured-model-input", { evidence: ["safe"] }), risk, maxInputTokens: 4_000, maxOutputTokens: 40, maxCost: 1 });

async function waitForExecInvocation(path: string, previousCount: number): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const lines = (await readFile(path, "utf8").catch(() => "")).trim().split("\n").filter(Boolean);
    const calls = lines.slice(previousCount).flatMap((line): { args: string[] }[] => {
      try { return [JSON.parse(line) as { args: string[] }]; } catch { return []; }
    });
    if (calls.some(({ args }) => args[0] === "exec" && args[1] === "--ephemeral")) return;
    await delay(5);
  }
  throw new Error("Codex fixture did not enter its cancellable exec invocation");
}

async function fakeCodex(root: string): Promise<{ executable: string; calls: string; behavior: string; runner?: CodexProcessRunner }> {
  if (process.platform === "win32") {
    const calls = join(root, "calls.jsonl"); const behavior = join(root, "behavior.json"); await writeFile(behavior, "{}\n");
    const runner: CodexProcessRunner = { async run(request: CodexProcessRequest) {
      if (request.signal?.aborted === true) throw new CodexExecProviderError("cancelled", "Codex CLI execution was cancelled");
      const args = [...request.args]; const configured = JSON.parse(await readFile(behavior, "utf8"));
      await writeFile(calls, `${await readFile(calls, "utf8").catch(() => "")}${JSON.stringify({ args, env: request.environment, stdin: args[0] === "exec" ? request.stdin : "" })}\n`);
      if (args[0] === "--version") return { exitCode: 0, stdout: "codex-cli 0.147.0\n", stderr: "" };
      if (args[0] === "login" && args[1] === "status") return { exitCode: 0, stdout: `${configured.auth ?? "Logged in using ChatGPT"}\n`, stderr: "" };
      if (args[0] === "exec" && args[1] === "--help") return { exitCode: 0, stdout: `--output-schema --json --output-last-message --ephemeral --ignore-user-config --ignore-rules --sandbox --cd${configured.missingDisable === true ? "" : " --disable"}\n`, stderr: "" };
      if (args[0] === "features" && args[1] === "list") return { exitCode: 0, stdout: DISABLED_CODEX_EXEC_FEATURES.filter((feature) => configured.missingFeature !== feature).map((feature) => `${feature.padEnd(40)}stable             true`).join("\n"), stderr: "" };
      if (configured.hang === true) return new Promise((_resolve, reject) => {
        const timer = setTimeout(() => reject(new CodexExecProviderError("timeout", "Codex CLI execution exceeded its wall-clock budget")), request.timeoutMs);
        request.signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new CodexExecProviderError("cancelled", "Codex CLI execution was cancelled")); }, { once: true });
      });
      await readFile(args[args.indexOf("--output-schema") + 1]!, "utf8");
      await writeFile(args[args.indexOf("--output-last-message") + 1]!, configured.result ?? JSON.stringify({ label: "ok" }));
      return { exitCode: 0, stdout: `${JSON.stringify({ type: "turn.completed", usage: { input_tokens: Number(configured.inputTokens ?? 30), output_tokens: Number(configured.outputTokens ?? 5) } })}\n`, stderr: "" };
    } };
    return { executable: "codex-fixture", calls, behavior, runner };
  }
  const executable = join(root, "codex-fake.mjs"); const calls = join(root, "calls.jsonl"); const behavior = join(root, "behavior.json"); await writeFile(behavior, "{}\n");
  await writeFile(executable, `#!/usr/bin/env node
import { appendFile, readFile, writeFile } from "node:fs/promises";
const args = process.argv.slice(2); const calls = ${JSON.stringify(calls)};
const behavior = JSON.parse(await readFile(${JSON.stringify(behavior)}, "utf8"));
await appendFile(calls, JSON.stringify({ args, env: process.env, stdin: args[0] === "exec" ? await new Promise((resolve) => { let value = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk) => value += chunk); process.stdin.on("end", () => resolve(value)); }) : "" }) + "\\n");
if (args[0] === "--version") { console.log("codex-cli 0.147.0"); process.exit(0); }
if (args[0] === "login" && args[1] === "status") { console.log(behavior.auth ?? "Logged in using ChatGPT"); process.exit(0); }
if (args[0] === "exec" && args[1] === "--help") { console.log("--output-schema --json --output-last-message --ephemeral --ignore-user-config --ignore-rules --sandbox --cd" + (behavior.missingDisable === true ? "" : " --disable")); process.exit(0); }
if (args[0] === "features" && args[1] === "list") { for (const feature of ${JSON.stringify(DISABLED_CODEX_EXEC_FEATURES)}) if (behavior.missingFeature !== feature) console.log(feature.padEnd(40) + "stable             true"); process.exit(0); }
if (behavior.hang === true) await new Promise(() => {});
const output = args[args.indexOf("--output-last-message") + 1];
await readFile(args[args.indexOf("--output-schema") + 1], "utf8");
await writeFile(output, behavior.result ?? JSON.stringify({ label: "ok" }));
console.log(JSON.stringify({ type: "turn.completed", usage: { input_tokens: Number(behavior.inputTokens ?? 30), output_tokens: Number(behavior.outputTokens ?? 5) } }));
`, "utf8");
  await chmod(executable, 0o755); return { executable, calls, behavior };
}

describe("Codex CLI ChatGPT-subscription provider", () => {
  it("probes explicit subscription auth and generates schema-bound output through a minimal, read-only exec", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-codex-provider-"));
    try {
      const fake = await fakeCodex(root); const provider = createCodexExecProvider({ executable: fake.executable, cwd: root, model: "gpt-test", environment: { PATH: process.env.PATH!, HOME: root, OPENAI_API_KEY: "must-not-leak", UNRELATED: "drop" }, ...(fake.runner === undefined ? {} : { runner: fake.runner }) });
      await expect(provider.capabilities()).resolves.toMatchObject({ available: true, executable: true, authenticated: true, authKind: "chatgpt-subscription", structuredOutput: true, cancellation: true, filesystemAccess: "read-only", toolIsolation: "all-stable-tools-disabled", tokenBudgetEnforcement: "preflight-and-observed", providerRevision: "codex-cli 0.147.0" });
      const route = await provider.authenticatedRoute();
      expect(route.contentHash).toBe(hashFramedDomain("authenticated-model-route", route.value));
      const response = await route.provider.generateStructured(request(), { timeoutMs: 1_000 });
      expect(response).toEqual({ value: { label: "ok" }, provider: "codex-cli-chatgpt", model: "gpt-test", providerRevision: "codex-cli 0.147.0", inputTokens: 30, outputTokens: 5, rawResponseHash: hashFramedDomain("structured-model-response-value", { label: "ok" }), attempt: 1 });
      const calls = (await readFile(fake.calls, "utf8")).trim().split("\n").map((line) => JSON.parse(line)); const invocation = calls.at(-1);
      expect(invocation.args).toEqual(expect.arrayContaining(["exec", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--sandbox", "read-only", "--output-schema", "--output-last-message", "--json", "--cd", root, "--model", "gpt-test", "-"]));
      expect(invocation.args).not.toContain("--dangerously-bypass-approvals-and-sandbox");
      for (const feature of DISABLED_CODEX_EXEC_FEATURES) expect(invocation.args.some((value: string, index: number) => value === "--disable" && invocation.args[index + 1] === feature)).toBe(true);
      expect(invocation.env).toMatchObject({ PATH: process.env.PATH, HOME: root }); expect(invocation.env).not.toHaveProperty("OPENAI_API_KEY"); expect(invocation.env).not.toHaveProperty("UNRELATED");
      const prompt = JSON.parse(invocation.stdin); expect(prompt).toMatchObject({ requestHash: expect.stringMatching(/^sha256:v1:/u), inputHash: request().inputHash, schemaName: "label", maxOutputTokens: 40 });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("is truthfully unavailable for missing, API-key, or contract-incomplete Codex installations", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-codex-provider-"));
    try {
      const missing = createCodexExecProvider({ executable: join(root, "missing"), cwd: root, model: "gpt-test", environment: { PATH: "" } });
      await expect(missing.capabilities()).resolves.toMatchObject({ available: false, executable: false, authenticated: false, authKind: "unavailable" });
      await expect(missing.authenticatedRoute()).rejects.toMatchObject({ code: "unavailable" });
      const fake = await fakeCodex(root); await writeFile(fake.behavior, JSON.stringify({ missingDisable: true })); const incomplete = createCodexExecProvider({ executable: fake.executable, cwd: root, model: "gpt-test", environment: { PATH: process.env.PATH!, HOME: root }, ...(fake.runner === undefined ? {} : { runner: fake.runner }) });
      await expect(incomplete.capabilities()).resolves.toMatchObject({ available: false, authKind: "chatgpt-subscription", reason: expect.stringMatching(/contract/iu) }); await expect(incomplete.authenticatedRoute()).rejects.toMatchObject({ code: "unsupported-contract" });
      await writeFile(fake.behavior, JSON.stringify({ missingFeature: "shell_tool" })); const missingIsolation = createCodexExecProvider({ executable: fake.executable, cwd: root, model: "gpt-test", environment: { PATH: process.env.PATH!, HOME: root }, ...(fake.runner === undefined ? {} : { runner: fake.runner }) });
      await expect(missingIsolation.capabilities()).resolves.toMatchObject({ available: false, authKind: "chatgpt-subscription", reason: expect.stringMatching(/tool-disable inventory/iu) }); await expect(missingIsolation.authenticatedRoute()).rejects.toMatchObject({ code: "unsupported-contract" });
      await writeFile(fake.behavior, JSON.stringify({ auth: "Logged in using an API key" })); const apiKey = createCodexExecProvider({ executable: fake.executable, cwd: root, model: "gpt-test", environment: { PATH: process.env.PATH!, HOME: root }, ...(fake.runner === undefined ? {} : { runner: fake.runner }) });
      await expect(apiKey.capabilities()).resolves.toMatchObject({ available: false, executable: true, authenticated: false, authKind: "unsupported" });
      await expect(apiKey.generateStructured(request())).rejects.toThrow(/ChatGPT subscription/iu);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("kills cancellation/timeout and rejects malformed, oversized, or unaccounted responses without leaking content", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-codex-provider-"));
    try {
      const fake = await fakeCodex(root);
      const provider = () => createCodexExecProvider({ executable: fake.executable, cwd: root, model: "gpt-test", environment: { PATH: process.env.PATH!, HOME: root }, maximumOutputBytes: 80, ...(fake.runner === undefined ? {} : { runner: fake.runner }) });
      await writeFile(fake.behavior, JSON.stringify({ result: "not-json-secret-value" })); await expect(provider().generateStructured(request())).rejects.toMatchObject({ code: "malformed-response" });
      await writeFile(fake.behavior, JSON.stringify({ result: JSON.stringify({ label: "x".repeat(200) }) })); await expect(provider().generateStructured(request())).rejects.toMatchObject({ code: "output-limit" });
      await writeFile(fake.behavior, JSON.stringify({ outputTokens: 41 })); await expect(provider().generateStructured(request())).rejects.toMatchObject({ code: "token-budget" });
      await writeFile(fake.behavior, JSON.stringify({ hang: true })); const priorCallCount = (await readFile(fake.calls, "utf8")).trim().split("\n").filter(Boolean).length;
      const controller = new AbortController(); const cancelled = provider().generateStructured(request(), { signal: controller.signal, timeoutMs: 10_000 });
      await waitForExecInvocation(fake.calls, priorCallCount); controller.abort();
      await expect(cancelled).rejects.toMatchObject({ code: "cancelled" });
      await expect(provider().generateStructured(request(), { timeoutMs: 20 })).rejects.toMatchObject({ code: "timeout" });
    } finally { await rm(root, { recursive: true, force: true }); }
  }, 15_000);
});

it("uses a stable public error type", () => expect(new CodexExecProviderError("unavailable", "no provider")).toMatchObject({ name: "CodexExecProviderError", code: "unavailable" }));
