import { lstat, readFile, readdir, readlink } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

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
}

const ignoredDirectories = new Set([".git", "node_modules"]);

function repositoryPath(root: string, absolutePath: string): string {
  return relative(root, absolutePath).split(sep).join("/");
}

function mediaType(path: string): string {
  if (path.endsWith(".json")) return "application/json";
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

export async function inventoryRepository(repositoryRoot: string): Promise<InventoryResult> {
  const root = resolve(repositoryRoot);
  const entries: InventoryEntry[] = [];
  const failures: AnalyzerFailure[] = [];
  let rootAvailability: InventoryResult["rootAvailability"] = "available";

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
      if (stat.isSymbolicLink()) {
        let symlinkTarget;
        try {
          symlinkTarget = await readlink(absolutePath);
        } catch (error) {
          failures.push(failure(path, "symlink-target", error, ["artifact-content", "projection-unit"]));
          continue;
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
        continue;
      }
      if (!stat.isFile()) continue;
      let bytes;
      try {
        bytes = await readFile(absolutePath);
      } catch (error) {
        failures.push(failure(path, "artifact-content", error, ["artifact-content", "projection-unit", "source-relationships"]));
        continue;
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
  }

  await visit(root);
  return { entries, failures, rootAvailability };
}
