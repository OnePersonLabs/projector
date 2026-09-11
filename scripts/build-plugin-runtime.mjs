import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { buildReleasePackage, releasePackageName, releaseVersion } from "./build-release-package.mjs";

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

/** Assemble a plugin containing Projector while resolving Node 24 through the host PATH. */
export async function buildPluginRuntime(outputRoot, options = {}) {
  const inputPaths = [options.releaseRoot].filter((path) => path !== undefined);
  const target = await checkedBuildDirectory(outputRoot, inputPaths);
  if (inside(await realpath(pluginSource), target) || (options.releaseRoot !== undefined && inside(await realpath(options.releaseRoot), target))) throw new Error("plugin output cannot be inside a copied input");
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
    if (manifest.name !== releasePackageName || manifest.version !== releaseVersion || manifest.bin !== undefined || manifest.exports?.["./operations"] === undefined) throw new Error("plugin runtime is not the expected operation-only Projector release");
    await cp(pluginSource, target, { recursive: true, filter: (source) => source !== join(pluginSource, "runtime") });
    const pluginManifestPath = join(target, ".codex-plugin/plugin.json");
    const pluginManifest = JSON.parse(await readFile(pluginManifestPath, "utf8"));
    pluginManifest.version = releaseVersion;
    await writeFile(pluginManifestPath, `${JSON.stringify(pluginManifest, null, 2)}\n`);
    await mkdir(join(target, "runtime"), { recursive: true });
    await cp(releaseRoot, join(target, "runtime/projector"), { recursive: true });
    return { root: target, releaseVersion, nodeRuntime: { executable: "node", resolution: "host-path" } };
  } finally {
    if (temporary !== undefined) {
      const checked = await checkedBuildDirectory(temporary);
      if (dirname(checked) !== await realpath(tmpdir()) || !basename(checked).startsWith("projector-plugin-build-")) throw new Error("unsafe plugin temporary cleanup path");
      await rm(checked, { recursive: true, force: true });
    }
  }
}

export function pluginBuildOptions(args) {
  if (args.length !== 0) throw new Error(`invalid plugin build option: ${args[0]}`);
  return {};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === undefined) throw new Error("usage: build-plugin-runtime <empty-output-directory>");
  const result = await buildPluginRuntime(process.argv[2], pluginBuildOptions(process.argv.slice(3)));
  process.stdout.write(`${JSON.stringify({ status: "plugin-runtime-built", ...result })}\n`);
}
