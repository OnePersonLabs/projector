import { execFile } from "node:child_process";
import { lstat, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { comparePackageVersions } from "../packages/core/dist/index.js";

const execute = promisify(execFile);
const numericVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

export function selectProjectDataMigrationReleaseVersion(authoredVersion, sourceVersion) {
  if (!numericVersion.test(authoredVersion) || !numericVersion.test(sourceVersion)) throw new Error("release versions must be numeric semantic versions");
  if (comparePackageVersions(authoredVersion, sourceVersion) > 0) return { version: authoredVersion, changed: false };
  const match = numericVersion.exec(sourceVersion);
  const patch = BigInt(match[3]) + 1n;
  return { version: `${match[1]}.${match[2]}.${patch}`, changed: true };
}

export async function synchronizeWorkspaceReleaseVersion(repositoryRoot, version, options = {}) {
  if (!numericVersion.test(version)) throw new Error(`invalid release version: ${version}`);
  const manifests = [join(repositoryRoot, "package.json")];
  for (const entry of await readdir(join(repositoryRoot, "packages"), { withFileTypes: true })) {
    if (entry.isDirectory()) manifests.push(join(repositoryRoot, "packages", entry.name, "package.json"));
  }
  manifests.push(join(repositoryRoot, "plugins/projector/.codex-plugin/plugin.json"));
  const existing = new Map();
  for (const path of manifests) {
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`release version owner is not a regular file: ${path}`);
    const bytes = await readFile(path, "utf8");
    const manifest = JSON.parse(bytes);
    if (typeof manifest.version !== "string") throw new Error(`release version owner has no version: ${path}`);
    existing.set(path, bytes);
  }
  const lockPath = join(repositoryRoot, "pnpm-lock.yaml");
  existing.set(lockPath, await readFile(lockPath, "utf8"));
  const changed = [...existing.keys()].filter((path) => path !== lockPath && JSON.parse(existing.get(path)).version !== version);
  if (changed.length === 0) return { version, changedPaths: [] };
  try {
    for (const path of changed) {
      const manifest = JSON.parse(existing.get(path));
      manifest.version = version;
      await replaceFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
    }
    const runPackageManager = options.runPackageManager ?? (async () => {
      const pnpmEntry = process.env.npm_execpath;
      if (pnpmEntry === undefined || !/[\\/]pnpm(?:\.cjs)?$/iu.test(pnpmEntry)) throw new Error("run this workflow through pnpm so the selected package manager is authenticated");
      await execute(process.execPath, [pnpmEntry, "install", "--lockfile-only"], { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 10_000_000 });
    });
    await runPackageManager(repositoryRoot);
    for (const path of changed) if (JSON.parse(await readFile(path, "utf8")).version !== version) throw new Error(`release version synchronization did not retain ${path}`);
    return { version, changedPaths: changed };
  } catch (error) {
    for (const [path, bytes] of existing) await replaceFile(path, bytes);
    throw error;
  }
}

async function replaceFile(path, bytes) {
  const temporary = `${path}.projector-version-${process.pid}.tmp`;
  await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
  try { await rename(temporary, path); }
  finally { await rm(temporary, { force: true }); }
}
