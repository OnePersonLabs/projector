import { constants } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  readlink,
  realpath,
  rename,
  rm,
  symlink,
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
      let target = await validateMutationPath(resolvedRoot, relativePath, false);
      await mkdir(path.dirname(target), { recursive: true });
      target = await validateMutationPath(resolvedRoot, relativePath, false);
      const handle = await open(
        target,
        constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW,
        0o666,
      );
      try {
        await handle.writeFile(content, "utf8");
      } finally {
        await handle.close();
      }
    },
    async remove(relativePath) {
      await rm(await validateMutationPath(resolvedRoot, relativePath, false), { recursive: true, force: true });
    },
    async move(from, to) {
      const source = await validateMutationPath(resolvedRoot, from, true);
      let destination = await validateMutationPath(resolvedRoot, to, false);
      await mkdir(path.dirname(destination), { recursive: true });
      destination = await validateMutationPath(resolvedRoot, to, false);
      await rename(source, destination);
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
  const normalizedPath = relativePath.replaceAll("\\", "/");
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, normalizedPath);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Path is outside fixture root: ${relativePath}`);
  }
  return resolved;
}

async function validateMutationPath(root: string, relativePath: string, mustExist: boolean): Promise<string> {
  const target = resolveInside(root, relativePath);
  const rootRealPath = await realpath(root);
  const normalizedPath = relativePath.replaceAll("\\", "/");
  const components = normalizedPath.split("/").filter((component) => component !== "" && component !== ".");
  let current = path.resolve(root);
  let targetExists = true;

  for (const [index, component] of components.entries()) {
    current = path.join(current, component);
    let stats;
    try {
      stats = await lstat(current);
    } catch (error) {
      if (isMissingPathError(error)) {
        targetExists = false;
        break;
      }
      throw error;
    }
    if (stats.isSymbolicLink()) {
      throw new Error(`Mutation path contains a symbolic link: ${relativePath}`);
    }
    if (index < components.length - 1 && !stats.isDirectory()) {
      throw new Error(`Mutation path ancestor is not a directory: ${relativePath}`);
    }
    assertRealPathInside(rootRealPath, await realpath(current), relativePath);
  }

  if (mustExist && !targetExists) {
    throw new Error(`Mutation source does not exist: ${relativePath}`);
  }
  const parent = path.dirname(target);
  try {
    assertRealPathInside(rootRealPath, await realpath(parent), relativePath);
  } catch (error) {
    if (!isMissingPathError(error)) throw error;
  }
  return target;
}

function assertRealPathInside(rootRealPath: string, candidateRealPath: string, relativePath: string): void {
  const relative = path.relative(rootRealPath, candidateRealPath);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Mutation path resolves outside fixture root: ${relativePath}`);
  }
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function toPortablePath(value: string): string {
  return value.split(path.sep).join("/");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
