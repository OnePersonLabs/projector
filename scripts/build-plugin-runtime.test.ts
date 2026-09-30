import { exec, execFile, spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildPluginRuntime, checkedBuildDirectory, pluginBuildOptions } from "./build-plugin-runtime.mjs";
import { bundledTreeSitterLanguages } from "./bundle-plugin-runtime.mjs";
import { releaseVersion } from "./build-release-package.mjs";
import * as releasePackageBuilder from "./build-release-package.mjs";
import { supportedTreeSitterLanguages } from "../packages/analyzers/src/code-intelligence/tree-sitter-provider.js";

const execute = promisify(execFile);
const executeShell = promisify(exec);
const roots: string[] = [];
const temporary = async () => {
  const root = await mkdtemp(join(tmpdir(), "projector plugin & 100%-"));
  roots.push(root);
  return root;
};
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }))));

describe("standalone plugin assembly", () => {
  it("retains temporary packaging evidence when command cleanup is unconfirmed", async () => {
    const root = await temporary();
    let staging: string | undefined;
    const pack = vi.spyOn(releasePackageBuilder, "buildReleasePackage").mockImplementationOnce(async (path) => {
      staging = path;
      roots.push(dirname(path));
      await mkdir(path);
      await writeFile(join(path, "recovery.txt"), "owned process may still need this");
      throw new Error("wrapped", { cause: Object.assign(new Error("cleanup unconfirmed"), { code: "RELEASE_COMMAND_CLEANUP_UNCONFIRMED" }) });
    });
    try {
      const failure = await buildPluginRuntime(join(root, "plugin")).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(Error);
      expect(String(failure)).toContain(dirname(staging!));
      expect(await readFile(join(staging!, "recovery.txt"), "utf8")).toBe("owned process may still need this");
    } finally {
      pack.mockRestore();
    }
  });

  it("packages the release operation runner and resolves Node through the host PATH", async () => {
    const root = await temporary();
    const plugin = join(root, "installed plugin");
    const result = await buildPluginRuntime(plugin);
    expect(result.root).toBe(plugin);
    expect(result.nodeRuntime).toEqual({ executable: "node", resolution: "host-path" });
    expect(await readdir(join(plugin, "runtime"))).toEqual(["projector"]);
    expect(JSON.parse(await readFile(join(plugin, "runtime/projector/package.json"), "utf8"))).toMatchObject({ name: "@onepersonlabs/projector", version: releaseVersion });
    expect(JSON.parse(await readFile(join(plugin, "runtime/projector/node_modules/typescript/package.json"), "utf8"))).toMatchObject({name:"typescript",version:"5.9.3"});
    expect(await readFile(join(plugin, "runtime/projector/node_modules/typescript/lib/typescript.js"), "utf8")).toBe(await readFile(resolve("node_modules/typescript/lib/typescript.js"),"utf8"));
    expect(bundledTreeSitterLanguages).toEqual(supportedTreeSitterLanguages);
    expect((await readdir(join(plugin, "runtime/projector/node_modules/tree-sitter-wasm/out"))).sort()).toEqual(bundledTreeSitterLanguages);
    expect(await readFile(join(plugin, "runtime/projector/assets/windows-job-supervisor.ps1"), "utf8")).toContain("param");
    expect(JSON.parse(await readFile(join(plugin, "runtime/projector/licenses/third-party.json"), "utf8"))).toContainEqual(expect.objectContaining({ name: "zod" }));
    await access(join(plugin, "runtime/projector/licenses/zod/LICENSE"));
    const hostNode = await execute("node", ["--version"], { cwd: plugin, env: { ...process.env, NODE_PATH: "" }, encoding: "utf8" });
    expect(hostNode.stdout.trim()).toBe(process.version);
    const hooks = JSON.parse(await readFile(join(plugin, "hooks/hooks.json"), "utf8")).hooks;
    const hook = hooks.SessionStart[0].hooks.find((entry: { command: string }) => entry.command.includes("projector-instructions.mjs"));
    expect(hook.command).toBe('node "${PLUGIN_ROOT}/hooks/projector-instructions.mjs"');
    expect(hook.commandWindows).toBeUndefined();
    const instructions = await execute("node", [join(plugin, "hooks/projector-instructions.mjs")], { cwd: root, env: { ...process.env, NODE_PATH: "" }, encoding: "utf8" });
    expect(JSON.parse(instructions.stdout).hookSpecificOutput.additionalContext).toBe(await readFile(join(plugin, "AGENTS.md"), "utf8"));
    expect(hooks.PreToolUse).toBeUndefined();

    const repository = join(root, "ordinary repository");
    await mkdir(repository);
    await execute("git", ["init", "--quiet"], { cwd: repository });
    await mkdir(join(repository,"src"));
    await writeFile(join(repository,"src/typed.ts"),"export interface Contract { value: number }\nexport const typed: Contract = { value: 1 };\n");
    const env = { ...process.env, NODE_PATH: "" };
    const request = {
      apiVersion: "projector.operation/v1",
      operation: "init",
      repositoryRoot: repository,
      requestId: "installed-init",
      input: {},
    };
    const child = spawn(process.execPath, [join(plugin, "scripts/projector-operation.mjs")], { cwd: repository, env, stdio: ["pipe", "pipe", "pipe"] });
    child.stdin.end(`${JSON.stringify(request)}\n`);
    let stdout = ""; let stderr = "";
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.on("data", (chunk) => { stderr += chunk; });
    const exitCode = await new Promise((resolveExit, reject) => { child.once("error", reject); child.once("exit", resolveExit); });
    expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
    expect(JSON.parse(stdout)).toMatchObject({ status: "succeeded", operation: "init", package: { name: "@onepersonlabs/projector", version: releaseVersion }, output: { created: true, readiness: { status: "ready" } } });
    expect(await readFile(join(repository, ".projector/config.toml"), "utf8")).toContain("projectorVersion");

    if (process.platform === "win32") {
      const installedCommand = hook.command.replaceAll("${PLUGIN_ROOT}", plugin);
      const executedHook = await executeShell(`echo {\"hook_event_name\":\"SessionStart\",\"source\":\"startup\"}|${installedCommand}`, {
        cwd: repository,
        env: { ...env, PLUGIN_ROOT: plugin },
        shell: process.env.ComSpec ?? "cmd.exe",
        encoding: "utf8",
      });
      expect(JSON.parse(executedHook.stdout)).toMatchObject({ hookSpecificOutput: { hookEventName: "SessionStart" } });
    }

    const help = await execute("node", [join(plugin, "scripts/projector.mjs"), "--help"], { cwd: repository, env, encoding: "utf8" });
    expect(help.stdout).toContain("context");
    const statusScript = "import { createBundledProjectorOperationRunner } from './runtime/projector/exports/operations.js'; const runner = await createBundledProjectorOperationRunner({ packagedRoot: './runtime/projector' }); console.log(JSON.stringify(await runner.execute(JSON.parse(process.argv[1]))));";
    const status = await execute("node", ["--input-type=module", "-e", statusScript, JSON.stringify({ ...request, operation: "status", requestId: "installed-status" })], { cwd: plugin, env, encoding: "utf8" });
    expect(JSON.parse(status.stdout)).toMatchObject({ operation: "status", readiness: { status: "ready" } });
    const context = await execute("node", [join(plugin, "scripts/projector.mjs"), "context", "Inspect the ordinary repository", "--target","src/typed.ts", "--json"], { cwd: repository, env, encoding: "utf8" });
    expect(JSON.parse(context.stdout)).toHaveProperty("contentHash");
    const check = await execute("node", [join(plugin, "scripts/projector.mjs"), "check", "--json"], { cwd: repository, env, encoding: "utf8" });
    expect(JSON.parse(check.stdout)).toHaveProperty("repository");
  // This integration check packages the compiler and language grammars, then
  // starts the installed CLI for init, context and check on a fresh checkout.
  }, 120_000);

  it("preserves nonempty output, source ancestors, supplied inputs, and linked directories", async () => {
    const root = await temporary();
    const output = join(root, "output");
    await mkdir(output);
    await writeFile(join(output, "keep.txt"), "keep");
    await expect(buildPluginRuntime(output)).rejects.toThrow("must be empty");
    expect(await readFile(join(output, "keep.txt"), "utf8")).toBe("keep");
    await expect(checkedBuildDirectory(resolve("."))).rejects.toThrow("protected input");
    await expect(checkedBuildDirectory(root, [join(root, "trusted-input")])).rejects.toThrow("protected input");
    const link = join(root, "linked-output");
    await symlink(output, link, "junction");
    await expect(buildPluginRuntime(link)).rejects.toThrow("symbolic link");
    expect(await readFile(join(output, "keep.txt"), "utf8")).toBe("keep");
  });

  it("accepts no private runtime inputs", () => {
    expect(pluginBuildOptions([])).toEqual({});
    expect(() => pluginBuildOptions(["--windows-node", "win/node.exe"])).toThrow("invalid plugin build option");
    expect(() => pluginBuildOptions(["--download", "node"])).toThrow("invalid plugin build option");
  });
});
