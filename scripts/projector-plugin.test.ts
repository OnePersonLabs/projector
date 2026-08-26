import { spawn } from "node:child_process";
import { appendFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "..");
const pluginRoot = resolve(repositoryRoot, "plugins", "projector");

type JsonRpcMessage = {
  id?: number;
  result?: {
    serverInfo?: { name?: string; version?: string };
    tools?: Array<{ name?: string }>;
  };
};

const launchConfiguredServer = async (): Promise<JsonRpcMessage[]> => {
  const installationRoot = await mkdtemp(join(tmpdir(), "projector-plugin-test-"));
  const installedPluginRoot = resolve(installationRoot, "projector");
  await cp(pluginRoot, installedPluginRoot, { recursive: true });
  const configuration = JSON.parse(await readFile(resolve(pluginRoot, ".mcp.json"), "utf8")) as {
    mcpServers: { projector: { command: string; args?: string[]; cwd?: string } };
  };
  const server = configuration.mcpServers.projector;
  const cwd = server.cwd === undefined ? repositoryRoot : resolve(installedPluginRoot, server.cwd);
  const environment = { ...process.env };
  delete environment.PWD;
  delete environment.CODEX_CWD;
  delete environment.CODEX_WORKSPACE_ROOT;
  delete environment.INIT_CWD;
  delete environment.PROJECTOR_ROOT;
  environment.PROJECTOR_CLI = resolve(repositoryRoot, "packages", "cli", "dist", "cli.js");
  const child = spawn(server.command, server.args ?? [], {
    cwd,
    env: environment,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => { stdout += chunk; });
  child.stderr.on("data", (chunk: string) => { stderr += chunk; });
  child.stdin.write(`${JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "projector-plugin-test", version: "1" },
    },
  })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);

  await new Promise<void>((accept, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`MCP launch timed out\nstdout: ${stdout}\nstderr: ${stderr}`));
    }, 8_000);
    child.stdout.on("data", () => {
      if (stdout.includes('"id":2')) {
        clearTimeout(timeout);
        child.kill();
        accept();
      }
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      if (!stdout.includes('"id":2')) {
        reject(new Error(`MCP server exited ${code}\nstdout: ${stdout}\nstderr: ${stderr}`));
      }
    });
  });

  const messages = stdout.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as JsonRpcMessage);
  await rm(installationRoot, { recursive: true, force: true });
  return messages;
};

describe("Projector Codex plugin MCP launch", () => {
  test("handshakes and lists tools from an installed plugin working directory", async () => {
    const messages = await launchConfiguredServer();
    const manifest = JSON.parse(await readFile(resolve(pluginRoot, ".codex-plugin", "plugin.json"), "utf8")) as {
      version: string;
    };

    expect(messages.find((message) => message.id === 1)?.result?.serverInfo?.name).toBe("projector");
    expect(messages.find((message) => message.id === 1)?.result?.serverInfo?.version).toBe(manifest.version);
    expect(messages.find((message) => message.id === 2)?.result?.tools)
      .toEqual([
        expect.objectContaining({ name: "projector.audit" }),
        expect.objectContaining({ name: "projector.list_divergences" }),
        expect.objectContaining({ name: "projector.status" }),
      ]);
  });

  test("session hook recognizes an installed CLI in an ordinary repository without a source fallback", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-plugin-hook-"));
    const installedPluginRoot = join(root, "installed-plugin");
    const repository = join(root, "repository");
    try {
      await cp(pluginRoot, installedPluginRoot, { recursive: true });
      await mkdir(repository);
      expect((await runExecutable("git", ["init", "-q"], repository, process.env)).status).toBe(0);
      const hook = join(installedPluginRoot, "hooks", "projector-session.sh");
      const environment = { ...process.env, PLUGIN_ROOT: installedPluginRoot, PROJECTOR_CLI: resolve(repositoryRoot, "packages", "cli", "dist", "cli.js") };
      delete environment.PROJECTOR_ROOT;
      const result = await runExecutable("bash", [hook], repository, environment);
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ hookSpecificOutput: { hookEventName: "SessionStart" } });
      const unavailable = await runExecutable("bash", [hook], repository, { PLUGIN_ROOT: installedPluginRoot, PATH: "/usr/bin:/bin" });
      expect(unavailable).toMatchObject({ status: 0, stdout: "" });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

describe("Projector installed change workflow", () => {
  test("pauses on the exact plan hash, rejects substitutions, resumes through the CLI, and chains its trace", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-plugin-change-"));
    const installedPluginRoot = join(root, "installed-plugin");
    const repository = join(root, "repository");
    const invocationLog = join(root, "cli-invocations.jsonl");
    try {
      await cp(pluginRoot, installedPluginRoot, { recursive: true });
      await mkdir(repository, { recursive: true });
      await writeFile(join(repository, "proposal.json"), "{}\n");
      const fakeCli = join(root, "projector-cli.mjs");
      await writeFile(fakeCli, [
        "import { appendFile } from 'node:fs/promises';",
        "const args = process.argv.slice(2);",
        "await appendFile(process.env.FAKE_PROJECTOR_LOG, JSON.stringify(args) + '\\n');",
        "const command = args[0];",
        "const report = command === 'change' ? { kind: 'lifecycle-change', selector: 'semantic_change_abc', immutablePlanHash: 'sha256:v1:plan' }",
        "  : command === 'plan' ? { kind: 'lifecycle-plan', selector: 'semantic_change_abc', immutablePlanHash: 'sha256:v1:plan', preview: { expectedDiff: 'replace src/value.mjs' } }",
        "  : command === 'approve' ? { kind: 'lifecycle-approval', selector: 'lifecycle_approval_abc', immutablePlanHash: args[args.indexOf('--plan-hash') + 1] }",
        "  : command === 'apply' ? { kind: 'lifecycle-apply', selector: args[1], outcome: 'recovery-required', attemptId: 'attempt_interrupted' }",
        "  : command === 'recover' ? { kind: 'lifecycle-recovery', selector: args[1], outcomes: [{ attemptId: 'attempt_interrupted', action: 'rolled-back' }] }",
        "  : command === 'resume' ? { kind: 'lifecycle-resume', selector: args[1], outcome: 'success', certificateHash: 'sha256:v1:certificate' }",
        "  : { kind: `lifecycle-${command}`, selector: args[1], outcomes: [] };",
        "process.stdout.write(JSON.stringify(report) + '\\n');",
        "if (command === 'apply') process.exitCode = 3;",
      ].join("\n"));
      const script = join(installedPluginRoot, "scripts", "projector-change.mjs");
      const environment = { ...process.env, PROJECTOR_CLI: fakeCli, FAKE_PROJECTOR_LOG: invocationLog };

      const started = await runPluginChange(script, ["start", "--request", "Make the value useful", "--proposal", "proposal.json"], repository, environment);
      expect(started.status).toBe(0);
      const pause = JSON.parse(started.stdout) as { status: string; planHash: string; continuation: string };
      expect(pause).toMatchObject({ status: "approval-required", planHash: "sha256:v1:plan" });
      expect((await readFile(invocationLog, "utf8")).trim().split("\n").map((line) => JSON.parse(line)[0])).toEqual(["change", "plan"]);

      const substituted = await runPluginChange(script, ["approve", "--continuation", pause.continuation, "--plan-hash", "sha256:v1:different"], repository, environment);
      expect(substituted.status).not.toBe(0);
      expect(substituted.stderr).toMatch(/exact plan hash/iu);
      const approved = await runPluginChange(script, ["approve", "--continuation", pause.continuation, "--plan-hash", pause.planHash], repository, environment);
      expect(JSON.parse(approved.stdout)).toMatchObject({ status: "approved", approvalSelector: "lifecycle_approval_abc" });
      const interrupted = await runPluginChange(script, ["apply", "--approval", "lifecycle_approval_abc"], repository, environment);
      expect(interrupted.status).toBe(3);
      expect(JSON.parse(interrupted.stdout)).toMatchObject({ status: "recovery-required", projectorExitCode: 3, attemptId: "attempt_interrupted" });
      const recovered = await runPluginChange(script, ["recover", "--approval", "lifecycle_approval_abc"], repository, environment);
      expect(JSON.parse(recovered.stdout)).toMatchObject({ status: "recovered", outcomes: [{ action: "rolled-back" }] });
      const resumed = await runPluginChange(script, ["resume", "--approval", "lifecycle_approval_abc"], repository, environment);
      expect(JSON.parse(resumed.stdout)).toMatchObject({ status: "success", certificateHash: "sha256:v1:certificate" });

      const trace = (await readFile(join(repository, ".projector", "runtime", "change-lifecycles", "agent-trace.jsonl"), "utf8")).trim().split("\n").map((line) => JSON.parse(line) as { phase: string; command: string; exitCode: number | null; previousHash: string | null; entryHash: string });
      expect(trace.length).toBe(12);
      expect(trace[0]?.previousHash).toBeNull();
      expect(trace.map(({ phase }) => phase)).toEqual(["invoked", "completed", "invoked", "completed", "invoked", "completed", "invoked", "completed", "invoked", "completed", "invoked", "completed"]);
      expect(trace[6]).toMatchObject({ phase: "invoked", command: "apply", exitCode: null });
      expect(trace[7]).toMatchObject({ phase: "completed", command: "apply", exitCode: 3 });
      for (let index = 1; index < trace.length; index += 1) expect(trace[index]?.previousHash).toBe(trace[index - 1]?.entryHash);
      expect(trace.every(({ entryHash }) => /^sha256:v1:[a-f0-9]{64}$/u.test(entryHash))).toBe(true);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

async function runPluginChange(
  script: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return runExecutable(process.execPath, [script, ...args], cwd, env);
}

async function runExecutable(
  executable: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const child = spawn(executable, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = ""; let stderr = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => { stdout += chunk; });
  child.stderr.on("data", (chunk: string) => { stderr += chunk; });
  const status = await new Promise<number | null>((resolveStatus, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolveStatus(code));
  });
  return { status, stdout: stdout.trim(), stderr: stderr.trim() };
}
