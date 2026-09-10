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
    "import { access, readFile } from 'node:fs/promises';",
    "import { join } from 'node:path';",
    "export async function createBundledProjectorOperationRunner({ packagedRoot }) {",
    " const manifest = JSON.parse(await readFile(join(packagedRoot, 'package.json'), 'utf8'));",
    " return { execute: async (request, options = {}) => {",
    "  const active = await access(join(request.repositoryRoot, '.projector/config.toml')).then(() => true, () => false);",
    "  const readiness = active ? { status: 'ready', package: { name: manifest.name, version: manifest.version }, observed: { configApiVersion: 'projector.config/v1', preparedProjectorVersion: manifest.version } } : { status: 'inactive', package: { name: manifest.name, version: manifest.version }, reason: 'fixture' };",
    "  return {",
    "  apiVersion: 'projector.operation-result/v1', operation: request.operation, package: { name: manifest.name, version: manifest.version },",
    "  ...(request.requestId === undefined ? {} : { requestId: request.requestId }), status: 'succeeded', exitCode: 0,",
    "  readiness,",
    "  output: { repositoryRoot: request.repositoryRoot, packagedRoot, cancelled: options.signal?.aborted === true },",
    "  };",
    " } };",
    "}",
  ].join("\n"));
  return { root, pluginRoot, packagedRoot };
}

describe("Projector installed operation entry", () => {
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

describe("Projector SessionStart hook", () => {
  test("announces only an active project with the installed operation runner and surfaces unexpected access failures", async () => {
    const { root, pluginRoot } = await installedFixture();
    const repository = join(root, "repository");
    await mkdir(repository);
    expect((await run("git", ["init", "-q"], repository)).exitCode).toBe(0);
    const hook = join(pluginRoot, "hooks/projector-session.mjs");

    const inactive = await run(process.execPath, [hook], repository);
    expect(inactive).toMatchObject({ exitCode: 0, stdout: "", stderr: "" });

    await mkdir(join(repository, ".projector"));
    await writeFile(join(repository, ".projector/config.toml"), 'apiVersion = "projector.config/v1"\nenabled = true\nprojectorVersion = "9.8.7"\n');
    const active = await run(process.execPath, [hook], repository);
    expect(active).toMatchObject({ exitCode: 0, stderr: "" });
    expect(JSON.parse(active.stdout)).toMatchObject({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: expect.stringContaining("projector-operation.mjs"),
      },
    });

    await rm(join(pluginRoot, "runtime/projector/exports/operations.js"));
    await mkdir(join(pluginRoot, "runtime/projector/exports/operations.js"));
    const unexpected = await run(process.execPath, [hook], repository);
    expect(unexpected.exitCode).toBe(1);
    expect(unexpected.stdout).toBe("");
    expect(unexpected.stderr).not.toBe("");
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
