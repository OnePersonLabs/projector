import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { buildPluginRuntime, checkedBuildDirectory, inspectNodeBinary, pluginBuildOptions } from "./build-plugin-runtime.mjs";

const execute = promisify(execFile);
const roots: string[] = [];
const temporary = async () => {
  const root = await mkdtemp(join(tmpdir(), "projector plugin & 100%-"));
  roots.push(root);
  return root;
};
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }))));

function foreignBinary() {
  if (process.platform === "win32") {
    const bytes = Buffer.alloc(64);
    bytes.set([0x7f, 0x45, 0x4c, 0x46, 2, 1]);
    bytes.writeUInt16LE(62, 18);
    return { bytes, platform: "linux", file: "node", option: "linuxNode" };
  }
  const bytes = Buffer.alloc(70);
  bytes.write("MZ"); bytes.writeUInt32LE(64, 60);
  bytes.set([0x50, 0x45, 0, 0], 64); bytes.writeUInt16LE(0x8664, 68);
  return { bytes, platform: "win32", file: "node.exe", option: "windowsNode" };
}

describe("standalone plugin assembly", () => {
  it("runs the bundled release CLI without a source override and records foreign binary verification honestly", async () => {
    const root = await temporary();
    const fixture = foreignBinary();
    const binary = join(root, "trusted foreign binary");
    await writeFile(binary, fixture.bytes);
    const nodeLicense = join(root, "distribution-LICENSE");
    await writeFile(nodeLicense, "Fixture distribution license including third-party notices\n");
    const plugin = join(root, "installed plugin");
    const nativeOption = process.platform === "win32" ? "windowsNode" : "linuxNode";
    const result = await buildPluginRuntime(plugin, { [fixture.option]: binary, [nativeOption]: process.execPath, nodeVersion: process.versions.node, nodeLicense });
    expect(result.root).toBe(plugin);
    const metadata = JSON.parse(await readFile(join(plugin, "runtime/node/manifest.json"), "utf8"));
    expect(metadata.license).toBe("LICENSE");
    expect(await readFile(join(plugin, "runtime/node/LICENSE"))).toEqual(await readFile(nodeLicense));
    expect(metadata.binaries).toEqual(expect.arrayContaining([{ platform: fixture.platform, architecture: "x64", version: process.versions.node, versionVerification: "caller-declared", file: fixture.file }]));
    expect(await readFile(join(plugin, "runtime/node", fixture.file))).toEqual(fixture.bytes);
    expect(JSON.parse(await readFile(join(plugin, "runtime/projector/package.json"), "utf8"))).toMatchObject({ name: "@onepersonlabs/projector", version: "2.1.0" });
    const mcp = JSON.parse(await readFile(join(plugin, ".mcp.json"), "utf8"));
    expect(mcp.mcpServers.projector.command).toBe("./runtime/node/node");
    const withoutPathNode = await execute(mcp.mcpServers.projector.command, ["--version"], { cwd: plugin, env: { ...process.env, PATH: "", NODE_PATH: "" }, encoding: "utf8" });
    expect(withoutPathNode.stdout.trim()).toBe(process.version);
    const hook = JSON.parse(await readFile(join(plugin, "hooks/hooks.json"), "utf8")).hooks.SessionStart[0].hooks[0];
    expect(hook.command).toBe('"${PLUGIN_ROOT}/runtime/node/node" "${PLUGIN_ROOT}/hooks/projector-session.mjs"');
    expect(hook.commandWindows).toBe('"${PLUGIN_ROOT}/runtime/node/node.exe" "${PLUGIN_ROOT}/hooks/projector-session.mjs"');

    const repository = join(root, "ordinary repository");
    await mkdir(repository);
    await execute("git", ["init", "--quiet"], { cwd: repository });
    const env = { ...process.env, NODE_PATH: "" };
    delete env.PROJECTOR_CLI;
    const { stdout } = await execute(process.execPath, [join(plugin, "scripts/projector-change.mjs"), "init"], { cwd: repository, env, encoding: "utf8" });
    expect(JSON.parse(stdout)).toMatchObject({ initialized: true, projectEnabled: true, configCreated: true });
    expect(await readFile(join(repository, ".projector/config.json"), "utf8")).toContain("projector");
  }, 30_000);

  it("checks the current native binary version without copying a Node distribution", async () => {
    if (process.platform !== "win32" && process.platform !== "linux") return;
    expect(await inspectNodeBinary(process.execPath, process.platform, process.versions.node)).toMatchObject({ architecture: process.arch, version: process.versions.node, versionVerification: "native-executed" });
    await expect(inspectNodeBinary(process.execPath, process.platform, "24.999.999")).rejects.toThrow("does not match declared");
  });

  it("rejects missing version declarations and malformed binaries before touching an output", async () => {
    const root = await temporary();
    const binary = join(root, "not-node");
    await writeFile(binary, "not executable");
    await expect(buildPluginRuntime(join(root, "output"), { linuxNode: binary })).rejects.toThrow("--node-version");
    await expect(buildPluginRuntime(join(root, "output"), { linuxNode: binary, nodeVersion: "24.20.0" })).rejects.toThrow("64-bit ELF");
    await expect(inspectNodeBinary(binary, "win32", "24.20.0")).rejects.toThrow("PE");
    expect(await readdir(root)).toEqual(["not-node"]);
  });

  it("requires the distribution license and rejects a mixed-architecture pair before copying", async () => {
    const root = await temporary();
    const fixture = foreignBinary();
    const binary = join(root, "foreign-node");
    await writeFile(binary, fixture.bytes);
    await expect(buildPluginRuntime(join(root, "output"), { [fixture.option]: binary, nodeVersion: "24.20.0" })).rejects.toThrow("--node-license");
    if (process.platform === "win32" || process.platform === "linux") {
      if (process.arch === "x64") fixture.bytes.writeUInt16LE(fixture.platform === "linux" ? 183 : 0xaa64, fixture.platform === "linux" ? 18 : 68);
      await writeFile(binary, fixture.bytes);
      const nativeOption = process.platform === "win32" ? "windowsNode" : "linuxNode";
      await expect(buildPluginRuntime(join(root, "output"), { [fixture.option]: binary, [nativeOption]: process.execPath, nodeVersion: process.versions.node })).rejects.toThrow("same architecture");
    }
    expect(await readdir(root)).toEqual(["foreign-node"]);
  });

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

  it("accepts only explicit, unique CLI inputs", () => {
    expect(pluginBuildOptions(["--windows-node", "win/node.exe", "--linux-node", "linux/node", "--node-version", "24.20.0", "--node-license", "LICENSE"])).toEqual({ windowsNode: "win/node.exe", linuxNode: "linux/node", nodeVersion: "24.20.0", nodeLicense: "LICENSE" });
    expect(() => pluginBuildOptions(["--download", "node"])).toThrow("invalid plugin build option");
    expect(() => pluginBuildOptions(["--linux-node", "one", "--linux-node", "two"])).toThrow("invalid plugin build option");
  });
});
