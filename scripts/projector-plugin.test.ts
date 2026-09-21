import { spawn } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

const sourcePluginRoot = resolve(import.meta.dirname, "../plugins/projector");
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 })));
});

async function installedFixture() {
  const root = await mkdtemp(join(tmpdir(), "projector-installed-interface-"));
  roots.push(root);
  const pluginRoot = join(root, "projector");
  const packagedRoot = join(pluginRoot, "runtime/projector");
  await cp(sourcePluginRoot, pluginRoot, { recursive: true });
  await mkdir(join(packagedRoot, "exports"), { recursive: true });
  await writeFile(join(packagedRoot, "package.json"), JSON.stringify({ name: "@onepersonlabs/projector", version: "9.8.7", type: "module" }));
  await writeFile(join(packagedRoot, "exports/operations.js"), [
    "import { access, readFile, writeFile } from 'node:fs/promises';",
    "import { join } from 'node:path';",
    "export async function createBundledProjectorOperationRunner({ packagedRoot }) {",
    " const manifest = JSON.parse(await readFile(join(packagedRoot, 'package.json'), 'utf8'));",
    " return { execute: async (request, options = {}) => {",
    "  await writeFile(join(request.repositoryRoot, '.fixture-request.json'), JSON.stringify(request));",
    "  const active = await access(join(request.repositoryRoot, '.projector/config.toml')).then(() => true, () => false);",
    "  const blocked = await readFile(join(request.repositoryRoot, '.projector/non-ready-status'), 'utf8').then(value => value.trim(), () => undefined);",
    "  const check = request.operation === 'repository.check' ? await readFile(join(request.repositoryRoot, '.projector/check-fixture.json'), 'utf8').then(JSON.parse, () => ({ status: 'unchanged', offer: false })) : undefined;",
    "  const readiness = blocked ? { status: blocked, package: { name: manifest.name, version: manifest.version }, reason: `${blocked} fixture state`, recovery: { code: 'fixture-active-state', action: `resolve ${blocked} fixture state` } } : active ? { status: 'ready', package: { name: manifest.name, version: manifest.version }, observed: { configApiVersion: 'projector.config/v1', preparedProjectorVersion: manifest.version } } : { status: 'inactive', package: { name: manifest.name, version: manifest.version }, reason: 'fixture' };",
    "  return {",
    "  apiVersion: 'projector.operation-result/v1', operation: request.operation, package: { name: manifest.name, version: manifest.version },",
    "  ...(request.requestId === undefined ? {} : { requestId: request.requestId }), status: 'succeeded', exitCode: 0,",
    "  readiness,",
    "  output: check ?? { repositoryRoot: request.repositoryRoot, packagedRoot, cancelled: options.signal?.aborted === true },",
    "  };",
    " } };",
    "}",
  ].join("\n"));
  return { root, pluginRoot, packagedRoot };
}

describe("Projector installed operation entry", () => {
  test("injects complete installed instructions independently of repository observation", async () => {
    const { root, pluginRoot, packagedRoot } = await installedFixture();
    const manifest = JSON.parse(await readFile(join(pluginRoot, "hooks/hooks.json"), "utf8"));
    const session = manifest.hooks.SessionStart[0];
    expect(session.matcher).toBe("startup|resume|clear|compact");
    const injection = session.hooks.find((entry: { command: string }) => entry.command.includes("projector-instructions.mjs"));
    expect(session.hooks).toHaveLength(1);
    const contents = await readFile(join(pluginRoot, "AGENTS.md"), "utf8");
    expect(contents.length).toBeLessThanOrEqual(injection.additionalContextLimit);
    const hook = join(pluginRoot, "hooks/projector-instructions.mjs");
    const repository = join(root, "inactive");
    await mkdir(repository);
    for (const cwd of [root, repository]) {
      for (const source of ["startup", "resume", "clear", "compact"]) {
        const result = await run(process.execPath, [hook], cwd, JSON.stringify({ hook_event_name: "SessionStart", source, cwd }));
        expect(result).toMatchObject({ exitCode: 0, stderr: "" });
        expect(JSON.parse(result.stdout)).toEqual({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: contents } });
      }
      expect((await run("git", ["init", "-q"], repository)).exitCode).toBe(0);
    }
    await writeFile(join(packagedRoot, "exports/operations.js"), "throw new Error('observation unavailable');");
    const independent = await run(process.execPath, [hook], repository);
    expect(JSON.parse(independent.stdout).hookSpecificOutput.additionalContext).toBe(contents);
    await rm(join(pluginRoot, "AGENTS.md"));
    const missing = await run(process.execPath, [hook], root);
    expect(missing).toMatchObject({ exitCode: 1, stdout: "", stderr: expect.stringMatching(/cannot read.*AGENTS.md/iu) });
    await mkdir(join(pluginRoot, "AGENTS.md"));
    const unreadable = await run(process.execPath, [hook], root);
    expect(unreadable).toMatchObject({ exitCode: 1, stdout: "", stderr: expect.stringMatching(/cannot read.*AGENTS.md/iu) });
  });

  test("loads one bundled runner from the packaged root and accepts a versioned JSON request on stdin", async () => {
    const { pluginRoot, packagedRoot } = await installedFixture();
    const repositoryRoot = join(pluginRoot, "../repository");
    await mkdir(repositoryRoot);
    const request = {
      apiVersion: "projector.operation/v1",
      operation: "status",
      repositoryRoot,
      requestId: "request-17",
      input: {},
    };

    const result = await runOperation(pluginRoot, `${JSON.stringify(request)}\n`);

    expect(result).toMatchObject({ exitCode: 0, stderr: "" });
    expect(JSON.parse(result.stdout)).toEqual({
      apiVersion: "projector.operation-result/v1",
      operation: "status",
      package: { name: "@onepersonlabs/projector", version: "9.8.7" },
      requestId: "request-17",
      status: "succeeded",
      exitCode: 0,
      readiness: { status: "inactive", package: { name: "@onepersonlabs/projector", version: "9.8.7" }, reason: "fixture" },
      output: { repositoryRoot, packagedRoot, cancelled: false },
    });
  });

  test("accepts an exact request file and rejects malformed input without invoking another surface", async () => {
    const { root, pluginRoot } = await installedFixture();
    const requestPath = join(root, "request.json");
    await writeFile(requestPath, JSON.stringify({ apiVersion: "projector.operation/v1", operation: "status", repositoryRoot: root, input: {} }));
    const fromFile = await runOperation(pluginRoot, undefined, [requestPath]);
    expect(fromFile).toMatchObject({ exitCode: 0, stderr: "" });

    const malformed = await runOperation(pluginRoot, "{\n");
    expect(malformed.exitCode).toBe(2);
    expect(malformed.stdout).toBe("");
    expect(malformed.stderr).not.toBe("");
  });

  test("bounds request files and rejects non-regular or linked inputs", async () => {
    const { root, pluginRoot } = await installedFixture();
    const oversized = join(root, "oversized.json");
    await writeFile(oversized, Buffer.alloc(8 * 1024 * 1024 + 1, 0x20));
    await expect(runOperation(pluginRoot, undefined, [oversized])).resolves.toMatchObject({ exitCode: 2, stdout: "", stderr: expect.stringMatching(/exceeds/iu) });

    const directory = join(root, "request-directory");
    await mkdir(directory);
    await expect(runOperation(pluginRoot, undefined, [directory])).resolves.toMatchObject({ exitCode: 2, stdout: "", stderr: expect.stringMatching(/regular file|directory/iu) });

    const request = join(root, "request.json");
    const linked = join(root, "linked-request.json");
    await writeFile(request, '{}\n');
    await symlink(request, linked, "file");
    await expect(runOperation(pluginRoot, undefined, [linked])).resolves.toMatchObject({ exitCode: 2, stdout: "", stderr: expect.stringMatching(/symbolic|link|too many levels/iu) });
  });

  test("removes the replaced MCP and CLI-wrapper plugin surfaces", async () => {
    for (const path of [
      ".mcp.json",
      "scripts/projector-mcp.mjs",
      "scripts/projector-change.mjs",
      "scripts/projector-runtime.mjs",
    ]) {
      await expect(access(join(sourcePluginRoot, path))).rejects.toMatchObject({ code: "ENOENT" });
    }
    const manifest = JSON.parse(await readFile(join(sourcePluginRoot, ".codex-plugin/plugin.json"), "utf8"));
    expect(manifest).not.toHaveProperty("mcpServers");
  });
});

async function runOperation(pluginRoot: string, stdin?: string, arguments_: string[] = []) {
  return run(process.execPath, [join(pluginRoot, "scripts/projector-operation.mjs"), ...arguments_], pluginRoot, stdin);
}

async function run(executable: string, args: string[], cwd: string, stdin?: string): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  const child = spawn(executable, args, { cwd, env: process.env, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = ""; let stderr = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => { stdout += chunk; });
  child.stderr.on("data", (chunk: string) => { stderr += chunk; });
  child.stdin.end(stdin);
  const exitCode = await new Promise<number | null>((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", resolveExit);
  });
  return { exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
}
