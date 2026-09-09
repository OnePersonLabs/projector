import { execFile } from "node:child_process";
import { chmod, cp, lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { buildReleasePackage, releasePackageName, releaseVersion } from "./build-release-package.mjs";

const execute = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const pluginSource = join(repositoryRoot, "plugins/projector");
const inside = (parent, child) => {
  const path = relative(parent, child);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
};

async function physicalPath(path) {
  try {
    if ((await lstat(path)).isSymbolicLink()) throw new Error(`build path is a symbolic link: ${path}`);
    return await realpath(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return join(await physicalPath(dirname(path)), basename(path));
  }
}

// Resolve before any removal/copy and protect the checkout and supplied inputs.
export async function checkedBuildDirectory(path, protectedPaths = []) {
  const target = await physicalPath(resolve(path));
  if (target === parse(target).root) throw new Error("build output cannot be a filesystem root");
  for (const protectedPath of [repositoryRoot, ...protectedPaths]) {
    if (inside(target, await physicalPath(resolve(protectedPath)))) throw new Error(`build output contains a protected input: ${protectedPath}`);
  }
  return target;
}

export async function inspectNodeBinary(path, platform, declaredVersion) {
  if (!/^24\.\d+\.\d+$/u.test(declaredVersion ?? "")) throw new Error("supplied Node binaries require --node-version 24.x.y from their trusted distribution");
  const source = await realpath(resolve(path));
  const handle = await open(source, "r");
  let architecture;
  try {
    if (!(await handle.stat()).isFile()) throw new Error(`Node binary is not a regular file: ${source}`);
    const header = Buffer.alloc(64);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (platform === "linux" && bytesRead === 64 && header.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) && header[4] === 2 && header[5] === 1) {
      architecture = new Map([[62, "x64"], [183, "arm64"]]).get(header.readUInt16LE(18));
    } else if (platform === "win32" && bytesRead === 64 && header.toString("ascii", 0, 2) === "MZ") {
      const pe = Buffer.alloc(6);
      const read = await handle.read(pe, 0, pe.length, header.readUInt32LE(60));
      if (read.bytesRead === 6 && pe.subarray(0, 4).equals(Buffer.from([0x50, 0x45, 0, 0]))) architecture = new Map([[0x8664, "x64"], [0xaa64, "arm64"]]).get(pe.readUInt16LE(4));
    }
  } finally { await handle.close(); }
  if (architecture === undefined) throw new Error(`expected a ${platform === "linux" ? "64-bit ELF" : "PE"} x64/arm64 Node binary: ${source}`);
  let versionVerification = "caller-declared";
  if (platform === process.platform && architecture === process.arch) {
    const { stdout } = await execute(source, ["--version"], { encoding: "utf8", timeout: 10_000 });
    if (stdout.trim() !== `v${declaredVersion}`) throw new Error(`native Node version ${stdout.trim()} does not match declared ${declaredVersion}`);
    versionVerification = "native-executed";
  }
  return { source, platform, architecture, version: declaredVersion, versionVerification };
}

/** Assemble a standalone plugin; optional executable paths are trusted local Node 24 inputs. */
export async function buildPluginRuntime(outputRoot, options = {}) {
  const inputPaths = [options.releaseRoot, options.windowsNode, options.linuxNode, options.nodeLicense].filter((path) => path !== undefined);
  const target = await checkedBuildDirectory(outputRoot, inputPaths);
  if (inside(await realpath(pluginSource), target) || (options.releaseRoot !== undefined && inside(await realpath(options.releaseRoot), target))) throw new Error("plugin output cannot be inside a copied input");
  const binaries = await Promise.all([
    ...(options.windowsNode === undefined ? [] : [inspectNodeBinary(options.windowsNode, "win32", options.nodeVersion)]),
    ...(options.linuxNode === undefined ? [] : [inspectNodeBinary(options.linuxNode, "linux", options.nodeVersion)]),
  ]);
  if (new Set(binaries.map(({ architecture }) => architecture)).size > 1) throw new Error("Windows and Linux Node binaries must have the same architecture");
  let license;
  if (binaries.length !== 0) {
    if (options.nodeLicense === undefined) throw new Error("supplied Node binaries require --node-license <official distribution LICENSE including third-party notices>");
    license = await realpath(resolve(options.nodeLicense));
    const metadata = await lstat(license);
    if (!metadata.isFile() || metadata.size === 0) throw new Error("Node distribution LICENSE must be a nonempty regular file");
  }
  await mkdir(target, { recursive: true });
  if ((await readdir(target)).length !== 0) throw new Error(`plugin output must be empty: ${target}`);
  let temporary;
  try {
    let releaseRoot = options.releaseRoot;
    if (releaseRoot === undefined) {
      temporary = await mkdtemp(join(await realpath(tmpdir()), "projector-plugin-build-"));
      releaseRoot = await checkedBuildDirectory(join(temporary, "projector-release-runtime"));
      await buildReleasePackage(releaseRoot, join(temporary, "artifacts"));
    }
    const manifest = JSON.parse(await readFile(join(releaseRoot, "package.json"), "utf8"));
    if (manifest.name !== releasePackageName || manifest.version !== releaseVersion || manifest.bin?.projector !== "./bin/projector.js") throw new Error("plugin runtime is not the expected built Projector release");
    await cp(pluginSource, target, { recursive: true, filter: (source) => source !== join(pluginSource, "runtime") });
    await mkdir(join(target, "runtime"), { recursive: true });
    await cp(releaseRoot, join(target, "runtime/projector"), { recursive: true });
    if (binaries.length !== 0) {
      await mkdir(join(target, "runtime/node"));
      await cp(license, join(target, "runtime/node/LICENSE"));
      const installed = [];
      for (const { source, ...binary } of binaries) {
        const file = binary.platform === "win32" ? "node.exe" : "node";
        await cp(source, join(target, "runtime/node", file));
        if (binary.platform === "linux") await chmod(join(target, "runtime/node", file), 0o755);
        installed.push({ ...binary, file });
      }
      await writeFile(join(target, "runtime/node/manifest.json"), `${JSON.stringify({ license: "LICENSE", binaries: installed }, null, 2)}\n`);
      const platforms = new Set(binaries.map(({ platform }) => platform));
      const mcp = JSON.parse(await readFile(join(target, ".mcp.json"), "utf8"));
      // CreateProcess resolves the extensionless executable to node.exe on
      // Windows; POSIX executes node. Keep the archive relocatable on both hosts.
      mcp.mcpServers.projector.command = platforms.has("linux") ? "./runtime/node/node" : "./runtime/node/node.exe";
      await writeFile(join(target, ".mcp.json"), `${JSON.stringify(mcp, null, 2)}\n`);
      const hooks = JSON.parse(await readFile(join(target, "hooks/hooks.json"), "utf8"));
      for (const event of Object.values(hooks.hooks)) for (const matcher of event) for (const hook of matcher.hooks) {
        if (hook.type !== "command" || hook.command !== 'node "${PLUGIN_ROOT}/hooks/projector-session.mjs"') continue;
        if (platforms.has("linux")) hook.command = '"${PLUGIN_ROOT}/runtime/node/node" "${PLUGIN_ROOT}/hooks/projector-session.mjs"';
        if (platforms.has("win32")) hook.commandWindows = '"${PLUGIN_ROOT}/runtime/node/node.exe" "${PLUGIN_ROOT}/hooks/projector-session.mjs"';
      }
      await writeFile(join(target, "hooks/hooks.json"), `${JSON.stringify(hooks, null, 2)}\n`);
    }
    return { root: target, releaseVersion, nodeBinaries: binaries.map(({ source, ...binary }) => binary) };
  } finally {
    if (temporary !== undefined) {
      const checked = await checkedBuildDirectory(temporary);
      if (dirname(checked) !== await realpath(tmpdir()) || !basename(checked).startsWith("projector-plugin-build-")) throw new Error("unsafe plugin temporary cleanup path");
      await rm(checked, { recursive: true, force: true });
    }
  }
}

export function pluginBuildOptions(args) {
  const options = {};
  const keys = new Map([["--windows-node", "windowsNode"], ["--linux-node", "linuxNode"], ["--node-version", "nodeVersion"], ["--node-license", "nodeLicense"]]);
  for (let index = 0; index < args.length; index += 2) {
    const key = keys.get(args[index]);
    const value = args[index + 1];
    if (key === undefined || value === undefined || value.trim() === "" || Object.hasOwn(options, key)) throw new Error(`invalid plugin build option: ${args[index]}`);
    options[key] = value;
  }
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === undefined) throw new Error("usage: build-plugin-runtime <empty-output-directory> [--windows-node <node.exe>] [--linux-node <node>] [--node-version 24.x.y --node-license <distribution-LICENSE>]");
  const result = await buildPluginRuntime(process.argv[2], pluginBuildOptions(process.argv.slice(3)));
  process.stdout.write(`${JSON.stringify({ status: "plugin-runtime-built", ...result })}\n`);
}
