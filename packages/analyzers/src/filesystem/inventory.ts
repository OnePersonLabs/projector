import { execFile } from "node:child_process";
import { lstat, readFile, readdir, readlink } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import { hashFramedDomain, type AnalyzerFailure, type ContentHash } from "@projector/core";

import { compareCodePoint } from "../ordering.js";

export interface InventoryEntry {
  readonly path: string;
  readonly kind: "file" | "symlink";
  readonly mediaType: string;
  readonly content: string;
  readonly contentHash: ContentHash;
  readonly generated: boolean;
  readonly generatedReason?: "source-marker";
  readonly symlinkTarget?: string;
}

export interface InventoryResult {
  readonly entries: InventoryEntry[];
  readonly failures: AnalyzerFailure[];
  readonly rootAvailability: "available" | "unavailable";
  readonly enumeration: {
    readonly method: "git-index-and-nonignored-untracked" | "recursive-filesystem-fallback";
    readonly assumptions: readonly string[];
    readonly blindSpots: readonly string[];
  };
}

const ignoredDirectories = new Set([".git", ".worktrees", "node_modules"]);
const excludedPrefixes = [".git", ".worktrees", ".projector/runtime"] as const;
const execFileAsync = promisify(execFile);
const safeGitConfig = [
  "-c", "core.fsmonitor=false",
  "-c", "core.untrackedCache=false",
  "-c", `core.hooksPath=${process.platform === "win32" ? "NUL" : "/dev/null"}`,
] as const;

function repositoryPath(root: string, absolutePath: string): string {
  return relative(root, absolutePath).split(sep).join("/");
}

function mediaType(path: string): string {
  if (path.endsWith(".json")) return "application/json";
  if (/\.ya?ml$/u.test(path)) return "application/yaml";
  if (path.endsWith(".toml")) return "application/toml";
  if (/\.(?:mjs|js)$/u.test(path)) return "text/javascript";
  if (/\.(?:mts|ts)$/u.test(path)) return "text/typescript";
  if (path.endsWith(".md")) return "text/markdown";
  return "application/octet-stream";
}

function isGenerated(content: string): boolean {
  return /(?:@generated|generated file|do not edit)/iu.test(content.slice(0, 1024));
}

function failure(scope: string, capability: string, error: unknown, affectedClaimKinds: string[]): AnalyzerFailure {
  return {
    analyzerId: "projector.filesystem-local",
    capability,
    scope,
    message: error instanceof Error ? error.message : String(error),
    recoverable: true,
    affectedClaimKinds,
  };
}

function gitEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const key of ["PATH", "PATHEXT", "SystemRoot", "WINDIR", "TMP", "TEMP", "TMPDIR", "LANG", "LC_ALL"]) {
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  }
  return {
    ...environment,
    LANG: "C",
    LC_ALL: "C",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    GIT_OPTIONAL_LOCKS: "0",
  };
}

async function isConfirmedNonGitRepository(root: string, error: unknown): Promise<boolean> {
  const stderr = typeof error === "object" && error !== null && "stderr" in error
    ? String((error as { stderr?: unknown }).stderr ?? "")
    : "";
  if (!/not a git repository/iu.test(stderr)) return false;
  try {
    await lstat(join(root, ".git"));
    return false;
  } catch (markerError) {
    return typeof markerError === "object" && markerError !== null && "code" in markerError &&
      (markerError as { code?: unknown }).code === "ENOENT";
  }
}

async function gitInventoryPaths(root: string): Promise<string[]> {
  const { stdout } = await execFileAsync(
    "git",
    [...safeGitConfig, "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8", env: gitEnvironment(), maxBuffer: 16 * 1024 * 1024, timeout: 30_000 },
  );
  return [...new Set(stdout.split("\0").filter(Boolean))]
    .filter((path) => !isExcluded(path))
    .sort(compareCodePoint);
}

function isExcluded(path: string): boolean {
  return excludedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function resolveInventoryPath(root: string, path: string): string | undefined {
  if (path.length === 0 || path.includes("\0") || isAbsolute(path)) return undefined;
  const absolutePath = resolve(root, ...path.split("/"));
  const fromRoot = relative(root, absolutePath);
  return fromRoot === "" || fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)
    ? undefined
    : absolutePath;
}

async function hasSymlinkParent(root: string, absolutePath: string, cache: Map<string, boolean>): Promise<boolean> {
  const parent = dirname(absolutePath);
  if (parent === root) return false;
  const cached = cache.get(parent);
  if (cached !== undefined) return cached;
  if (await hasSymlinkParent(root, parent, cache)) {
    cache.set(parent, true);
    return true;
  }
  const symlink = (await lstat(parent)).isSymbolicLink();
  cache.set(parent, symlink);
  return symlink;
}

export async function inventoryRepository(repositoryRoot: string): Promise<InventoryResult> {
  const root = resolve(repositoryRoot);
  const entries: InventoryEntry[] = [];
  const failures: AnalyzerFailure[] = [];
  let rootAvailability: InventoryResult["rootAvailability"] = "available";

  async function inspect(path: string, absolutePath: string, symlinkParents?: Map<string, boolean>): Promise<void> {
    let stat;
    try {
      if (symlinkParents !== undefined && await hasSymlinkParent(root, absolutePath, symlinkParents)) {
        failures.push(failure(
          path,
          "symlink-parent",
          new Error("Git-selected path traverses a symbolic-link parent"),
          ["artifact-enumeration", "inventory-completeness", "source-relationships"],
        ));
        return;
      }
      stat = await lstat(absolutePath);
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT") return;
      failures.push(failure(path, "artifact-metadata", error, ["artifact", "projection-unit", "source-relationships"]));
      return;
    }
    if (stat.isSymbolicLink()) {
      let symlinkTarget;
      try {
        symlinkTarget = await readlink(absolutePath);
      } catch (error) {
        failures.push(failure(path, "symlink-target", error, ["artifact-content", "projection-unit"]));
        return;
      }
      entries.push({
        path,
        kind: "symlink",
        mediaType: "inode/symlink",
        content: symlinkTarget,
        contentHash: hashFramedDomain("repository-artifact-content", symlinkTarget),
        generated: false,
        symlinkTarget,
      });
      return;
    }
    if (!stat.isFile()) return;
    let bytes;
    try {
      bytes = await readFile(absolutePath);
    } catch (error) {
      failures.push(failure(path, "artifact-content", error, ["artifact-content", "projection-unit", "source-relationships"]));
      return;
    }
    const content = bytes.toString("utf8");
    const generated = isGenerated(content);
    entries.push({
      path,
      kind: "file",
      mediaType: mediaType(path),
      content,
      contentHash: hashFramedDomain("repository-artifact-content", bytes.toString("base64")),
      generated,
      ...(generated ? { generatedReason: "source-marker" as const } : {}),
    });
  }

  async function visit(directory: string): Promise<void> {
    let children;
    try {
      children = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      const scope = directory === root ? "." : repositoryPath(root, directory);
      if (directory === root) rootAvailability = "unavailable";
      failures.push(failure(scope, "directory-enumeration", error, ["artifact-enumeration", "inventory-completeness"]));
      return;
    }
    children.sort((left, right) => compareCodePoint(left.name, right.name));
    for (const child of children) {
      if (child.isDirectory() && ignoredDirectories.has(child.name)) continue;
      const absolutePath = resolve(directory, child.name);
      const path = repositoryPath(root, absolutePath);
      if (isExcluded(path)) continue;
      let stat;
      try {
        stat = await lstat(absolutePath);
      } catch (error) {
        failures.push(failure(path, "artifact-metadata", error, ["artifact", "projection-unit", "source-relationships"]));
        continue;
      }
      if (stat.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      await inspect(path, absolutePath);
    }
  }

  try {
    const paths = await gitInventoryPaths(root);
    const symlinkParents = new Map<string, boolean>();
    for (const path of paths) {
      const absolutePath = resolveInventoryPath(root, path);
      if (absolutePath === undefined) {
        failures.push(failure(path, "git-inventory-path", new Error("Git returned a path outside the repository root"), ["artifact-enumeration", "inventory-completeness"]));
        continue;
      }
      await inspect(path, absolutePath, symlinkParents);
    }
    return {
      entries,
      failures,
      rootAvailability,
      enumeration: {
        method: "git-index-and-nonignored-untracked",
        assumptions: ["Git CLI can read repository ignore and index metadata"],
        blindSpots: ["untracked Git-ignored files outside the repository inventory", "excluded .git, .worktrees, and .projector/runtime contents"],
      },
    };
  } catch (error) {
    if (!await isConfirmedNonGitRepository(root, error)) {
      failures.push(failure(".", "git-aware-inventory", error, ["artifact-enumeration", "inventory-completeness"]));
    }
    await visit(root);
    return {
      entries,
      failures,
      rootAvailability,
      enumeration: {
        method: "recursive-filesystem-fallback",
        assumptions: ["repository root is readable"],
        blindSpots: ["Git ignore boundary unavailable; recursive bounded fallback used", "excluded .git, .worktrees, node_modules, and .projector/runtime contents"],
      },
    };
  }
}
