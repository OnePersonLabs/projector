import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hashFramedDomain, type RiskAssessment, type StructuredModelRequest } from "@projector/core";
import { describe, expect, it } from "vitest";

import { CodexExecProviderError, createCodexExecProvider } from "./provider.js";

const risk: RiskAssessment = { class: "R0", inherentOperationRisk: 0, affectedUnitCount: 0, affectedSurfaceCount: 0, publicContractImpact: false, externalImpact: false, dataImpact: false, reversibility: "full", validationStrength: "strong", closureConfidence: "bounded", unresolvedIdentityCount: 0, relevanceFrontierCount: 0, openWorldDependencies: false, unresolvedBlockingConcernCount: 0, suspectDecisionCount: 0, compensationAvailable: true, reasons: [] };
const request = (): StructuredModelRequest<{ label: string }> => ({ purpose: "classify fixture", role: "classify", programVersion: "1", schemaName: "label", schemaVersion: "1", schema: { type: "object", additionalProperties: false, required: ["label"], properties: { label: { type: "string" } } }, input: { evidence: ["safe"] }, inputHash: hashFramedDomain("structured-model-input", { evidence: ["safe"] }), risk, maxInputTokens: 4_000, maxOutputTokens: 40, maxCost: 1 });

async function fakeCodex(root: string): Promise<{ executable: string; calls: string; behavior: string }> {
  const executable = join(root, "codex-fake.mjs"); const calls = join(root, "calls.jsonl"); const behavior = join(root, "behavior.json"); await writeFile(behavior, "{}\n");
  await writeFile(executable, `#!/usr/bin/env node
import { appendFile, readFile, writeFile } from "node:fs/promises";
const args = process.argv.slice(2); const calls = ${JSON.stringify(calls)};
const behavior = JSON.parse(await readFile(${JSON.stringify(behavior)}, "utf8"));
await appendFile(calls, JSON.stringify({ args, env: process.env, stdin: args[0] === "exec" ? await new Promise((resolve) => { let value = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk) => value += chunk); process.stdin.on("end", () => resolve(value)); }) : "" }) + "\\n");
if (args[0] === "--version") { console.log("codex-cli 0.147.0"); process.exit(0); }
if (args[0] === "login" && args[1] === "status") { console.log(behavior.auth ?? "Logged in using ChatGPT"); process.exit(0); }
if (args[0] === "exec" && args[1] === "--help") { console.log("--output-schema --json --output-last-message --ephemeral --ignore-user-config --ignore-rules --sandbox --cd"); process.exit(0); }
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
      const fake = await fakeCodex(root); const provider = createCodexExecProvider({ executable: fake.executable, cwd: root, model: "gpt-test", environment: { PATH: process.env.PATH!, HOME: root, OPENAI_API_KEY: "must-not-leak", UNRELATED: "drop" } });
      await expect(provider.capabilities()).resolves.toMatchObject({ available: true, executable: true, authenticated: true, authKind: "chatgpt-subscription", structuredOutput: true, cancellation: true, filesystemAccess: "read-only", tokenBudgetEnforcement: "preflight-and-observed", providerRevision: "codex-cli 0.147.0" });
      const route = await provider.authenticatedRoute();
      expect(route.contentHash).toBe(hashFramedDomain("authenticated-model-route", route.value));
      const response = await route.provider.generateStructured(request(), { timeoutMs: 1_000 });
      expect(response).toEqual({ value: { label: "ok" }, provider: "codex-cli-chatgpt", model: "gpt-test", providerRevision: "codex-cli 0.147.0", inputTokens: 30, outputTokens: 5, rawResponseHash: hashFramedDomain("structured-model-response-value", { label: "ok" }), attempt: 1 });
      const calls = (await readFile(fake.calls, "utf8")).trim().split("\n").map((line) => JSON.parse(line)); const invocation = calls.at(-1);
      expect(invocation.args).toEqual(expect.arrayContaining(["exec", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--sandbox", "read-only", "--output-schema", "--output-last-message", "--json", "--cd", root, "--model", "gpt-test", "-"]));
      expect(invocation.args).not.toContain("--dangerously-bypass-approvals-and-sandbox");
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
      const fake = await fakeCodex(root); await writeFile(fake.behavior, JSON.stringify({ auth: "Logged in using an API key" })); const apiKey = createCodexExecProvider({ executable: fake.executable, cwd: root, model: "gpt-test", environment: { PATH: process.env.PATH!, HOME: root } });
      await expect(apiKey.capabilities()).resolves.toMatchObject({ available: false, executable: true, authenticated: false, authKind: "unsupported" });
      await expect(apiKey.generateStructured(request())).rejects.toThrow(/ChatGPT subscription/iu);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("kills cancellation/timeout and rejects malformed, oversized, or unaccounted responses without leaking content", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-codex-provider-"));
    try {
      const fake = await fakeCodex(root);
      const provider = () => createCodexExecProvider({ executable: fake.executable, cwd: root, model: "gpt-test", environment: { PATH: process.env.PATH!, HOME: root }, maximumOutputBytes: 80 });
      await writeFile(fake.behavior, JSON.stringify({ result: "not-json-secret-value" })); await expect(provider().generateStructured(request())).rejects.toMatchObject({ code: "malformed-response" });
      await writeFile(fake.behavior, JSON.stringify({ result: JSON.stringify({ label: "x".repeat(200) }) })); await expect(provider().generateStructured(request())).rejects.toMatchObject({ code: "output-limit" });
      await writeFile(fake.behavior, JSON.stringify({ outputTokens: 41 })); await expect(provider().generateStructured(request())).rejects.toMatchObject({ code: "token-budget" });
      await writeFile(fake.behavior, JSON.stringify({ hang: true })); const controller = new AbortController(); const cancelled = provider().generateStructured(request(), { signal: controller.signal, timeoutMs: 1_000 }); setTimeout(() => controller.abort(), 20);
      await expect(cancelled).rejects.toMatchObject({ code: "cancelled" });
      await expect(provider().generateStructured(request(), { timeoutMs: 20 })).rejects.toMatchObject({ code: "timeout" });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

it("uses a stable public error type", () => expect(new CodexExecProviderError("unavailable", "no provider")).toMatchObject({ name: "CodexExecProviderError", code: "unavailable" }));
