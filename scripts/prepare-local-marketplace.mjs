import { randomUUID } from "node:crypto";
import { cp, lstat, mkdir, realpath, rename, rm } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { buildPluginRuntime } from "./build-plugin-runtime.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const pluginParent = join(repositoryRoot, ".build/local-marketplace/plugins");
const pluginRoot = join(pluginParent, "projector-v3");
const shippingRoot = join(repositoryRoot, "plugins/projector-v3");

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
  if (suffix !== `.build${sep}local-marketplace${sep}plugins`) throw new Error(`local marketplace path escapes the repository: ${pluginParent}`);
}

async function renameDirectory(source, destination) {
  for (let attempt = 0; ; attempt += 1) {
    try { return await rename(source, destination); }
    catch (error) {
      if (process.platform !== "win32" || !["EPERM", "EBUSY", "EACCES"].includes(error?.code) || attempt === 4) throw error;
      process.stderr.write(`${JSON.stringify({ event: "local-marketplace-rename-retry", source, destination, attempt: attempt + 1, code: error.code })}\n`);
      await delay(100 * 2 ** attempt);
    }
  }
}

export async function publishLocalBundle(staged, destination) {
  const previous = join(dirname(destination), `.projector-previous-${randomUUID()}`);
  let movedPrevious = false;
  if (await existingDirectory(destination)) {
    await renameDirectory(destination, previous);
    movedPrevious = true;
  }
  try {
    await renameDirectory(staged, destination);
  } catch (error) {
    if (movedPrevious) await renameDirectory(previous, destination);
    throw error;
  }
  if (movedPrevious) await rm(previous, { recursive: true, maxRetries: 4, retryDelay: 100 });
}

export async function prepareLocalMarketplace() {
  await assertOwnedParent();
  if (await realpath(shippingRoot) !== join(await realpath(repositoryRoot), "plugins/projector-v3")) throw new Error("shipping plugin path escapes the repository");
  const staged = join(pluginParent, `.projector-next-${randomUUID()}`);
  const stagedRuntime = join(pluginParent, `.projector-runtime-next-${randomUUID()}`);
  try {
    const result = await buildPluginRuntime(staged);
    await cp(join(staged, "runtime"), stagedRuntime, { recursive: true });
    await publishLocalBundle(stagedRuntime, join(shippingRoot, "runtime"));
    await publishLocalBundle(staged, pluginRoot);
    return { root: pluginRoot, shippingRoot, releaseVersion: result.releaseVersion };
  } finally {
    if (await existingDirectory(staged)) await rm(staged, { recursive: true, maxRetries: 4, retryDelay: 100 });
    if (await existingDirectory(stagedRuntime)) await rm(stagedRuntime, { recursive: true, maxRetries: 4, retryDelay: 100 });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw new Error("usage: prepare-local-marketplace");
  const result = await prepareLocalMarketplace();
  process.stdout.write(`${JSON.stringify({ status: "local-marketplace-prepared", ...result })}\n`);
}
