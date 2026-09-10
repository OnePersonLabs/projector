import { exec, execFile, spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { buildPluginRuntime, checkedBuildDirectory, pluginBuildOptions } from "./build-plugin-runtime.mjs";

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
  it("packages the release operation runner and resolves Node through the host PATH", async () => {
    const root = await temporary();
    const plugin = join(root, "installed plugin");
    const result = await buildPluginRuntime(plugin);
    expect(result.root).toBe(plugin);
    expect(result.nodeRuntime).toEqual({ executable: "node", resolution: "host-path" });
    expect(await readdir(join(plugin, "runtime"))).toEqual(["projector"]);
    expect(JSON.parse(await readFile(join(plugin, "runtime/projector/package.json"), "utf8"))).toMatchObject({ name: "@onepersonlabs/projector", version: "2.1.0" });
    await expect(access(join(plugin, ".mcp.json"))).rejects.toMatchObject({ code: "ENOENT" });
    const hostNode = await execute("node", ["--version"], { cwd: plugin, env: { ...process.env, NODE_PATH: "" }, encoding: "utf8" });
    expect(hostNode.stdout.trim()).toBe(process.version);
    const hook = JSON.parse(await readFile(join(plugin, "hooks/hooks.json"), "utf8")).hooks.SessionStart[0].hooks[0];
    expect(hook.command).toBe('node "${PLUGIN_ROOT}/hooks/projector-session.mjs"');
    expect(hook.commandWindows).toBeUndefined();

    const repository = join(root, "ordinary repository");
    await mkdir(repository);
    await execute("git", ["init", "--quiet"], { cwd: repository });
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
    expect(JSON.parse(stdout)).toMatchObject({ status: "succeeded", operation: "init", package: { name: "@onepersonlabs/projector", version: "2.1.0" }, output: { created: true, readiness: { status: "ready" } } });
    expect(await readFile(join(repository, ".projector/config.toml"), "utf8")).toContain("projectorVersion");

    if (process.platform === "win32") {
      const installedCommand = hook.command.replaceAll("${PLUGIN_ROOT}", plugin);
      const executedHook = await executeShell(installedCommand, {
        cwd: repository,
        env: { ...env, PLUGIN_ROOT: plugin },
        shell: process.env.ComSpec ?? "cmd.exe",
        encoding: "utf8",
      });
      expect(JSON.parse(executedHook.stdout)).toMatchObject({ hookSpecificOutput: { hookEventName: "SessionStart" } });
    }
  }, 30_000);

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
