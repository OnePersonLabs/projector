import { lstat, readFile, readdir, readlink } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import { hashFramedDomain, type ContentHash } from "@projector/core";

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

export async function inventoryRepository(repositoryRoot: string): Promise<InventoryEntry[]> {
  const root = resolve(repositoryRoot);
  const entries: InventoryEntry[] = [];

  async function visit(directory: string): Promise<void> {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) => Buffer.compare(Buffer.from(left.name), Buffer.from(right.name)));
    for (const child of children) {
      if (child.isDirectory() && ignoredDirectories.has(child.name)) continue;
      const absolutePath = resolve(directory, child.name);
      const path = repositoryPath(root, absolutePath);
      const stat = await lstat(absolutePath);
      if (stat.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (stat.isSymbolicLink()) {
        const symlinkTarget = await readlink(absolutePath);
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
      const bytes = await readFile(absolutePath);
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
  return entries;
}
