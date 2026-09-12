import { randomUUID } from "node:crypto";
import { lstat, mkdir, realpath, rename, rm } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { buildPluginRuntime } from "./build-plugin-runtime.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const pluginParent = join(repositoryRoot, ".temp/local-marketplace/plugins");
const pluginRoot = join(pluginParent, "projector");

async function existingDirectory(path) {
  try {
    const status = await lstat(path);
    if (!status.isDirectory() || status.isSymbolicLink()) throw new Error(`local marketplace path is not a regular directory: ${path}`);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function assertOwnedParent() {
  await mkdir(pluginParent, { recursive: true });
  const root = await realpath(repositoryRoot);
  const parent = await realpath(pluginParent);
  const suffix = relative(root, parent);
  if (suffix !== `.temp${sep}local-marketplace${sep}plugins`) throw new Error(`local marketplace path escapes the repository: ${pluginParent}`);
}

export async function prepareLocalMarketplace() {
  await assertOwnedParent();
  const nonce = randomUUID();
  const staged = join(pluginParent, `.projector-next-${nonce}`);
  const previous = join(pluginParent, `.projector-previous-${nonce}`);
  let movedPrevious = false;
  try {
    const result = await buildPluginRuntime(staged);
    if (await existingDirectory(pluginRoot)) {
      await rename(pluginRoot, previous);
      movedPrevious = true;
    }
    try {
      await rename(staged, pluginRoot);
    } catch (error) {
      if (movedPrevious) await rename(previous, pluginRoot);
      throw error;
    }
    if (movedPrevious) await rm(previous, { recursive: true });
    return { root: pluginRoot, releaseVersion: result.releaseVersion };
  } finally {
    if (await existingDirectory(staged)) await rm(staged, { recursive: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw new Error("usage: prepare-local-marketplace");
  const result = await prepareLocalMarketplace();
  process.stdout.write(`${JSON.stringify({ status: "local-marketplace-prepared", ...result })}\n`);
}
