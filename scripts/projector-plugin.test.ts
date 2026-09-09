import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
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
    structuredContent?: { status?: string; artifactCount?: number };
  };
};

async function finishMcpExchange(
  child: ReturnType<typeof spawn>,
  responseSeen: () => boolean,
  output: () => string,
): Promise<void> {
  const closed = new Promise<number | null>((resolveClose, rejectClose) => {
    child.once("error", rejectClose);
    child.once("close", resolveClose);
  });
  try {
    await new Promise<void>((accept, reject) => {
      const timeout = setTimeout(() => reject(new Error(`MCP launch timed out\n${output()}`)), 8_000);
      const inspect = (): void => {
        if (!responseSeen()) return;
        clearTimeout(timeout);
        accept();
      };
      child.stdout.on("data", inspect);
      child.once("error", (error) => { clearTimeout(timeout); reject(error); });
      child.once("exit", (code) => {
        if (responseSeen()) return;
        clearTimeout(timeout);
        reject(new Error(`MCP server exited ${code}\n${output()}`));
      });
      inspect();
    });
    child.stdin.end();
    const code = await closed;
    if (code !== 0) throw new Error(`MCP server exited ${code}\n${output()}`);
  } catch (error) {
    child.stdin.end();
    child.kill();
    await closed.catch(() => undefined);
    throw error;
  }
}

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

  await finishMcpExchange(child, () => stdout.includes('"id":2'), () => `stdout: ${stdout}\nstderr: ${stderr}`);

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
        expect.objectContaining({ name: "projector.context" }),
        expect.objectContaining({ name: "projector.list_divergences" }),
        expect.objectContaining({ name: "projector.status" }),
        expect.objectContaining({ name: "projector.validate" }),
        expect.objectContaining({ name: "projector.bind_workspace" }),
      ]);
  });

  test("session hook announces Projector only after the repository explicitly opts in", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-plugin-hook-"));
    const installedPluginRoot = join(root, "installed-plugin");
    const repository = join(root, "repository");
    try {
      await cp(pluginRoot, installedPluginRoot, { recursive: true });
      await mkdir(repository);
      expect((await runExecutable("git", ["init", "-q"], repository, process.env)).status).toBe(0);
      const hook = join(installedPluginRoot, "hooks", "projector-session.mjs");
      const environment = { ...process.env, PLUGIN_ROOT: installedPluginRoot, PROJECTOR_CLI: resolve(repositoryRoot, "packages", "cli", "dist", "cli.js") };
      delete environment.PROJECTOR_ROOT;
      const inactive = await runExecutable(process.execPath, [hook], repository, environment);
      expect(inactive).toMatchObject({ status: 0, stdout: "" });
      await mkdir(join(repository, ".projector"));
      await writeFile(join(repository, ".projector", "config.json"), '{"apiVersion":"projector.config/v1","enabled":true,"extra":true}\n');
      const malformed = await runExecutable(process.execPath, [hook], repository, environment);
      expect(malformed).toMatchObject({ status: 0, stdout: "" });
      await writeFile(join(repository, ".projector", "config.json"), '{"apiVersion":"projector.config/v1","enabled":true}\n');
      const active = await runExecutable(process.execPath, [hook], repository, environment);
      expect(active.status).toBe(0);
      expect(JSON.parse(active.stdout)).toMatchObject({ hookSpecificOutput: { hookEventName: "SessionStart" } });
      const unavailable = await runExecutable(process.execPath, [hook], repository, { ...environment, PROJECTOR_CLI: join(root, "absent-cli.mjs") });
      expect(unavailable).toMatchObject({ status: 0, stdout: "" });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  test("MCP launcher binds the parent host repository instead of its plugin working directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-plugin-parent-root-"));
    const installedPluginRoot = join(root, "installed-plugin");
    const hostRepository = join(root, "host-repository");
    try {
      await cp(pluginRoot, installedPluginRoot, { recursive: true });
      await mkdir(join(hostRepository, ".projector"), { recursive: true });
      expect((await runExecutable("git", ["init", "-q"], hostRepository, process.env)).status).toBe(0);
      await writeFile(join(hostRepository, ".projector", "config.json"), '{"apiVersion":"projector.config/v1","enabled":true}\n');
      await writeFile(join(hostRepository, "host-only.txt"), "host\n");
      const parent = join(root, "host-parent.mjs");
      await writeFile(parent, [
        "import { spawn } from 'node:child_process';",
        "const child = spawn(process.execPath, [process.env.WRAPPER], { cwd: process.env.PLUGIN_CWD, env: { ...process.env, PWD: process.env.PLUGIN_CWD } });",
        "process.stdin.pipe(child.stdin); child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);",
        "child.on('exit', (code) => { process.exitCode = code ?? 1; });",
      ].join("\n"));
      const environment = { ...process.env, WRAPPER: join(installedPluginRoot, "scripts", "projector-mcp.mjs"), PLUGIN_CWD: installedPluginRoot, PROJECTOR_CLI: resolve(repositoryRoot, "packages", "cli", "dist", "cli.js") };
      delete environment.PROJECTOR_ROOT;
      delete environment.CODEX_CWD;
      if (process.platform === "win32") environment.CODEX_WORKSPACE_ROOT = hostRepository;
      else delete environment.CODEX_WORKSPACE_ROOT;
      delete environment.INIT_CWD;
      const child = spawn(process.execPath, [parent], { cwd: hostRepository, env: environment, stdio: ["pipe", "pipe", "pipe"] });
      let stdout = ""; let stderr = "";
      child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => { stdout += chunk; }); child.stderr.on("data", (chunk: string) => { stderr += chunk; });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } })}\n`);
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "projector.status", arguments: { cwd: installedPluginRoot } } })}\n`);
      await finishMcpExchange(child, () => stdout.includes('"id":2'), () => `${stdout}\n${stderr}`);
      const status = stdout.trim().split("\n").map((line) => JSON.parse(line) as JsonRpcMessage).find(({ id }) => id === 2);
      expect(status?.result?.structuredContent).toMatchObject({ status: "ok", artifactCount: 2 });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  test("MCP launcher reports an unbound workspace when only its own plugin directory is discoverable", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-plugin-inactive-root-"));
    try {
      const parent = join(root, "plugin-parent.mjs");
      await writeFile(parent, [
        "import { spawn } from 'node:child_process';",
        "import { mkdirSync, writeFileSync } from 'node:fs';",
        "import { tmpdir } from 'node:os';",
        "import { join } from 'node:path';",
        "for (let pid = process.pid + 1; pid <= process.pid + 32; pid += 1) { const stale = join(tmpdir(), `projector-inactive-${pid}`); mkdirSync(join(stale, '.git'), { recursive: true }); mkdirSync(join(stale, '.projector'), { recursive: true }); writeFileSync(join(stale, '.projector', 'config.json'), '{\"apiVersion\":\"projector.config/v1\",\"enabled\":true}\\n'); writeFileSync(join(stale, 'stale-activation.txt'), 'must-not-scan\\n'); }",
        "const child = spawn(process.execPath, [process.env.WRAPPER], { cwd: process.env.PLUGIN_CWD, env: { ...process.env, PWD: process.env.PLUGIN_CWD } });",
        "process.stdin.pipe(child.stdin); child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);",
        "child.on('exit', (code) => { process.exitCode = code ?? 1; });",
      ].join("\n"));
      const isolatedTmp = join(root, "tmp"); await mkdir(isolatedTmp);
      const environment = { ...process.env, TMPDIR: isolatedTmp, WRAPPER: join(pluginRoot, "scripts", "projector-mcp.mjs"), PLUGIN_CWD: pluginRoot, PROJECTOR_CLI: resolve(repositoryRoot, "packages", "cli", "dist", "cli.js") };
      delete environment.PROJECTOR_ROOT; delete environment.CODEX_WORKSPACE_ROOT; delete environment.CODEX_CWD; delete environment.INIT_CWD;
      const child = spawn(process.execPath, [parent], { cwd: pluginRoot, env: environment, stdio: ["pipe", "pipe", "pipe"] });
      let stdout = ""; let stderr = "";
      child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8"); child.stdout.on("data", (chunk: string) => { stdout += chunk; }); child.stderr.on("data", (chunk: string) => { stderr += chunk; });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } })}\n`);
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "projector.status", arguments: {} } })}\n`);
      await finishMcpExchange(child, () => stdout.includes('"id":2'), () => `${stdout}\n${stderr}`);
      const status = stdout.trim().split("\n").map((line) => JSON.parse(line) as JsonRpcMessage).find(({ id }) => id === 2);
      expect(status?.result?.structuredContent).toMatchObject({ status: "workspace-unbound" });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  test("an invalid host directory leaves the session unbound so it can select its repository once", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-plugin-bind-"));
    const repository = join(root, "repository");
    const other = join(root, "other");
    try {
      for (const directory of [repository, other]) {
        await mkdir(directory);
        expect((await runExecutable("git", ["init", "-q"], directory, process.env)).status).toBe(0);
      }
      await mkdir(join(repository, ".projector"));
      await writeFile(join(repository, ".projector", "config.json"), '{"apiVersion":"projector.config/v1","enabled":true}\n');
      await writeFile(join(repository, "host-only.txt"), "host\n");
      const child = spawn(process.execPath, [join(pluginRoot, "scripts", "projector-mcp.mjs")], {
        cwd: pluginRoot,
        env: { ...process.env, PROJECTOR_ROOT: root, PROJECTOR_CLI: join(repositoryRoot, "packages", "cli", "dist", "cli.js") },
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = ""; let stderr = "";
      child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => { stdout += chunk; }); child.stderr.on("data", (chunk: string) => { stderr += chunk; });
      const send = (value: unknown): void => { child.stdin.write(`${JSON.stringify(value)}\n`); };
      send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
      send({ jsonrpc: "2.0", method: "notifications/initialized" });
      send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "projector.status", arguments: {} } });
      send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "projector.bind_workspace", arguments: { repositoryRoot: repository } } });
      send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "projector.bind_workspace", arguments: { repositoryRoot: other } } });
      send({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "projector.bind_workspace", arguments: { repositoryRoot: repository } } });
      send({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "projector.status", arguments: { cwd: other } } });
      await finishMcpExchange(child, () => stdout.includes('"id":6'), () => `${stdout}\n${stderr}`);
      const messages = stdout.trim().split("\n").map((line) => JSON.parse(line));
      expect(messages.find(({ id }) => id === 2)?.result.structuredContent.status).toBe("workspace-unbound");
      expect(messages.find(({ id }) => id === 3)?.result.structuredContent.status).toBe("bound");
      expect(messages.find(({ id }) => id === 4)?.result.isError).toBe(true);
      expect(messages.find(({ id }) => id === 5)?.result.structuredContent.status).toBe("bound");
      expect(messages.find(({ id }) => id === 6)?.result.structuredContent).toMatchObject({ status: "ok", artifactCount: 2 });
      expect(await readdir(other)).toEqual([".git"]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

describe("Projector installed change workflow", () => {
  test("the installed wrapper uses its bundled CLI without a global installation or source checkout", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-plugin-runtime-"));
    const installedPluginRoot = join(root, "installed-plugin");
    const repository = join(root, "repository");
    try {
      await cp(pluginRoot, installedPluginRoot, { recursive: true });
      await mkdir(repository);
      const cliDirectory = join(installedPluginRoot, "runtime", "projector", "bin");
      await mkdir(cliDirectory, { recursive: true });
      await writeFile(join(installedPluginRoot, "runtime", "projector", "package.json"), '{"type":"module"}');
      await writeFile(join(cliDirectory, "projector.js"), 'process.stdout.write(JSON.stringify({kind:"bundled-init",args:process.argv.slice(2),cwd:process.cwd()})+"\\n");');
      const env = { ...process.env }; delete env.PROJECTOR_CLI;
      const result = await runPluginChange(join(installedPluginRoot, "scripts", "projector-change.mjs"), ["init"], repository, env);
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({ kind: "bundled-init", args: ["init", "--format", "json"], cwd: repository });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  test("uses only the installed CLI, preserves JSON and exit codes, and writes no repository state", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-plugin-change-"));
    const installedPluginRoot = join(root, "installed-plugin");
    const repository = join(root, "repository");
    const outside = join(root, "outside-projector-state");
    const invocationLog = join(root, "cli-invocations.jsonl");
    try {
      await cp(pluginRoot, installedPluginRoot, { recursive: true });
      await mkdir(repository, { recursive: true });
      await mkdir(outside, { recursive: true });
      await symlink(outside, join(repository, ".projector"));
      const fakeCli = join(root, "projector-cli.mjs");
      await writeFile(fakeCli, [
        "import { appendFile } from 'node:fs/promises';",
        "const args = process.argv.slice(2); await appendFile(process.env.FAKE_PROJECTOR_LOG, JSON.stringify(args) + '\\n');",
        "const command = args[0];",
        "const report = command === 'change' ? { kind: 'lifecycle-change', selector: 'semantic_change_abc', immutablePlanHash: 'sha256:v1:plan' }",
        "  : command === 'plan' ? { kind: 'lifecycle-plan', selector: 'semantic_change_abc', immutablePlanHash: 'sha256:v1:plan', preview: { expectedDiff: 'replace src/value.mjs' } }",
        "  : command === 'approve' ? { kind: 'lifecycle-approval', selector: 'lifecycle_approval_abc', immutablePlanHash: args[args.indexOf('--plan-hash') + 1] }",
        "  : { kind: `lifecycle-${command}`, selector: args[1], outcome: command === 'resume' ? 'success' : 'recovery-required' };",
        "process.stdout.write(JSON.stringify(report) + '\\n'); if (command === 'apply') process.exitCode = 6;",
      ].join("\n"));
      const script = join(installedPluginRoot, "scripts", "projector-change.mjs");
      const environment = { ...process.env, PROJECTOR_CLI: fakeCli, FAKE_PROJECTOR_LOG: invocationLog };
      const started = await runPluginChange(script, ["start", "--request", "Make value useful", "--proposal", "proposal.json"], repository, environment);
      expect(started.status).toBe(3);
      expect(JSON.parse(started.stdout)).toMatchObject({ outcome: "approval-required", changeSelector: "semantic_change_abc", immutablePlanHash: "sha256:v1:plan" });
      const approved = await runPluginChange(script, ["approve", "--change", "semantic_change_abc", "--plan-hash", "sha256:v1:plan"], repository, environment);
      expect(JSON.parse(approved.stdout)).toMatchObject({ kind: "lifecycle-approval", selector: "lifecycle_approval_abc" });
      const applied = await runPluginChange(script, ["apply", "--approval", "lifecycle_approval_abc"], repository, environment);
      expect(applied.status).toBe(6);
      expect(JSON.parse(applied.stdout)).toEqual({ kind: "lifecycle-apply", selector: "lifecycle_approval_abc", outcome: "recovery-required" });
      expect(await readdir(outside)).toEqual([]);
      expect((await readFile(invocationLog, "utf8")).trim().split("\n").map((line) => JSON.parse(line)[0])).toEqual(["change", "plan", "approve", "apply"]);
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
