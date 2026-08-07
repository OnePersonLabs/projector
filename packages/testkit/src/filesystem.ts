import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  readlink,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export type FilesystemSnapshotEntry =
  | { path: string; kind: "file"; encoding: "utf8" | "base64"; content: string }
  | { path: string; kind: "symlink"; target: string };

export interface SnapshotFilesystemOptions {
  exclude?: readonly string[];
}

export async function snapshotFilesystem(
  root: string,
  options: SnapshotFilesystemOptions = {},
): Promise<FilesystemSnapshotEntry[]> {
  const rootPath = path.resolve(root);
  const exclusions = new Set(options.exclude ?? [".git"]);
  const entries: FilesystemSnapshotEntry[] = [];

  async function visit(relativeDirectory: string): Promise<void> {
    const absoluteDirectory = resolveInside(rootPath, relativeDirectory);
    const children = await readdir(absoluteDirectory, { withFileTypes: true });
    children.sort((left, right) => compareText(left.name, right.name));
    for (const child of children) {
      const relativePath = toPortablePath(path.join(relativeDirectory, child.name));
      const topLevel = relativePath.split("/")[0];
      if (topLevel !== undefined && exclusions.has(topLevel)) continue;
      const absolutePath = resolveInside(rootPath, relativePath);
      if (child.isDirectory()) {
        await visit(relativePath);
      } else if (child.isSymbolicLink()) {
        entries.push({ path: relativePath, kind: "symlink", target: toPortablePath(await readlink(absolutePath)) });
      } else if (child.isFile()) {
        const bytes = await readFile(absolutePath);
        const text = bytes.toString("utf8");
        if (Buffer.from(text, "utf8").equals(bytes)) {
          entries.push({ path: relativePath, kind: "file", encoding: "utf8", content: text });
        } else {
          entries.push({ path: relativePath, kind: "file", encoding: "base64", content: bytes.toString("base64") });
        }
      }
    }
  }

  await visit("");
  return entries;
}

export async function copyFixtureTree(source: string, destination: string): Promise<void> {
  const sourceRoot = path.resolve(source);
  const destinationRoot = path.resolve(destination);
  await mkdir(destinationRoot, { recursive: true });

  async function copyDirectory(relativeDirectory: string): Promise<void> {
    const sourceDirectory = resolveInside(sourceRoot, relativeDirectory);
    const children = await readdir(sourceDirectory, { withFileTypes: true });
    children.sort((left, right) => compareText(left.name, right.name));
    for (const child of children) {
      if (relativeDirectory === "" && child.name === ".git") continue;
      const relativePath = path.join(relativeDirectory, child.name);
      const sourcePath = resolveInside(sourceRoot, relativePath);
      const destinationPath = resolveInside(destinationRoot, relativePath);
      if (child.isDirectory()) {
        await mkdir(destinationPath, { recursive: true });
        await copyDirectory(relativePath);
      } else if (child.isSymbolicLink()) {
        await symlink(await readlink(sourcePath), destinationPath);
      } else if (child.isFile()) {
        await copyFile(sourcePath, destinationPath);
      }
    }
  }

  await copyDirectory("");
}

export interface FixturePaths {
  resolve(relativePath: string): string;
  readText(relativePath: string): Promise<string>;
  writeText(relativePath: string, content: string): Promise<void>;
  remove(relativePath: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
}

export function createFixturePaths(root: string): FixturePaths {
  const resolvedRoot = path.resolve(root);
  return {
    resolve(relativePath) {
      return resolveInside(resolvedRoot, relativePath);
    },
    async readText(relativePath) {
      return readFile(resolveInside(resolvedRoot, relativePath), "utf8");
    },
    async writeText(relativePath, content) {
      const target = resolveInside(resolvedRoot, relativePath);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content, "utf8");
    },
    async remove(relativePath) {
      await rm(resolveInside(resolvedRoot, relativePath), { recursive: true, force: true });
    },
    async move(from, to) {
      const destination = resolveInside(resolvedRoot, to);
      await mkdir(path.dirname(destination), { recursive: true });
      await rename(resolveInside(resolvedRoot, from), destination);
    },
  };
}

export function resolveInside(root: string, relativePath: string): string {
  if (
    relativePath.includes("\0") ||
    path.isAbsolute(relativePath) ||
    path.win32.isAbsolute(relativePath) ||
    /^[A-Za-z]:/.test(relativePath) ||
    relativePath.startsWith("\\\\")
  ) {
    throw new Error(`Path is outside fixture root: ${relativePath}`);
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Path is outside fixture root: ${relativePath}`);
  }
  return resolved;
}

function toPortablePath(value: string): string {
  return value.split(path.sep).join("/");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
