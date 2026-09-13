import { exec, execFile, spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildPluginRuntime, checkedBuildDirectory, pluginBuildOptions } from "./build-plugin-runtime.mjs";
import { releaseVersion } from "./build-release-package.mjs";
import * as releasePackageBuilder from "./build-release-package.mjs";

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
    await expect(access(join(plugin, ".mcp.json"))).rejects.toMatchObject({ code: "ENOENT" });
    const hostNode = await execute("node", ["--version"], { cwd: plugin, env: { ...process.env, NODE_PATH: "" }, encoding: "utf8" });
    expect(hostNode.stdout.trim()).toBe(process.version);
    const hooks = JSON.parse(await readFile(join(plugin, "hooks/hooks.json"), "utf8")).hooks;
    const hook = hooks.SessionStart[0].hooks.find((entry: { command: string }) => entry.command.includes("projector-session.mjs"));
    expect(hook.command).toBe('node "${PLUGIN_ROOT}/hooks/projector-session.mjs"');
    expect(hook.commandWindows).toBeUndefined();
    const instructions = await execute("node", [join(plugin, "hooks/projector-instructions.mjs")], { cwd: root, env: { ...process.env, NODE_PATH: "" }, encoding: "utf8" });
    expect(JSON.parse(instructions.stdout).hookSpecificOutput.additionalContext).toBe(await readFile(join(plugin, "AGENTS.md"), "utf8"));
    expect(hooks.PreToolUse[0]).toMatchObject({ matcher: "Bash|apply_patch|Edit|Write", hooks: [{ command: hook.command, additionalContextLimit: 256 }] });

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

    const runHook = async (event) => {
      const child = spawn(process.execPath, [join(plugin, "hooks/projector-session.mjs")], { cwd: repository, env, stdio: ["pipe", "pipe", "pipe"] });
      let output = ""; let errors = "";
      child.stdout.on("data", (chunk) => { output += chunk; });
      child.stderr.on("data", (chunk) => { errors += chunk; });
      child.stdin.end(JSON.stringify({ ...event, cwd: repository, session_id: "installed-boundary-trial" }));
      const code = await new Promise((resolveExit, reject) => { child.once("error", reject); child.once("exit", resolveExit); });
      expect({ code, errors }).toEqual({ code: 0, errors: "" });
      return JSON.parse(output).hookSpecificOutput;
    };
    const startup = await runHook({ hook_event_name: "SessionStart", source: "resume" });
    expect(startup.additionalContext).toContain("Offer $projector-reconcile");
    const cachePath = join(repository, ".projector/runtime/repository-check/state.json");
    const baseline = JSON.parse(await readFile(cachePath, "utf8"));
    await writeFile(join(repository, ".gitignore"), ".projector/runtime/\n");
    await writeFile(join(repository, "notes.md"), "External change arriving between prompts\n");
    await execute("git", ["add", "."], { cwd: repository });
    await execute("git", ["-c", "user.name=Trial", "-c", "user.email=trial@example.invalid", "commit", "-qm", "External update"], { cwd: repository });
    const prompt = await runHook({ hook_event_name: "UserPromptSubmit", prompt: "Continue the original task" });
    expect(prompt.additionalContext).toContain("new evidence");
    const changed = JSON.parse(await readFile(cachePath, "utf8"));
    expect(changed.observation.head).not.toBe(baseline.observation.head);
    expect(changed.pending.findingId).toBe(baseline.pending.findingId);
    expect(changed.offeredSessions).toHaveLength(1);
    const again = await runHook({ hook_event_name: "UserPromptSubmit", prompt: "Continue" });
    expect(again.additionalContext).not.toContain("Offer $projector-reconcile");
    expect(await readFile(cachePath, "utf8")).toBe(JSON.stringify(changed));
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
