import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, readFile, rename } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export interface ProjectBackupInput {
  repositoryRoot: string;
  codexDataRoot: string;
}

export interface ProjectBackupManifestFile {
  path: string;
  length: number;
  sha256: string;
}

export interface ProjectBackupManifest {
  formatVersion: 1;
  backupId: string;
  createdAt: string;
  source: { projectorDirectory: ".projector" };
  files: ProjectBackupManifestFile[];
}

export interface ProjectBackupResult {
  backupId: string;
  backupPath: string;
  manifest: ProjectBackupManifest;
}

export interface ProjectBackupDependencies {
  createBackupId?: () => string;
  now?: () => Date;
  afterFileCopied?: (relativePath: string) => void | Promise<void>;
}

export class ProjectBackupError extends Error {
  constructor(message: string, readonly recoveryPath?: string) {
    super(message);
    this.name = "ProjectBackupError";
  }
}

export async function createProjectBackup(
  input: ProjectBackupInput,
  dependencies: ProjectBackupDependencies = {},
): Promise<ProjectBackupResult> {
  const repositoryRoot = resolveRequiredPath(input.repositoryRoot, "repository root");
  const codexDataRoot = resolveRequiredPath(input.codexDataRoot, "Codex data root");
  const sourceRoot = containedPath(repositoryRoot, join(repositoryRoot, ".projector"), "project source");
  const backupId = (dependencies.createBackupId ?? (() => randomUUID()))();
  assertBackupId(backupId);

  await assertRegularDirectory(repositoryRoot, "Repository root");
  await assertRegularDirectory(codexDataRoot, "Codex data root");
  await assertRegularDirectory(sourceRoot, "Projector source directory");

  const backupRoot = await ensureOwnedDirectory(codexDataRoot, ["projector", "backups"]);
  const stagingRoot = await ensureOwnedDirectory(backupRoot, ["staging"]);
  const publishedRoot = await ensureOwnedDirectory(backupRoot, ["published"]);
  const stagePath = containedPath(stagingRoot, join(stagingRoot, backupId), "backup stage");
  const backupPath = containedPath(publishedRoot, join(publishedRoot, backupId), "published backup");
  if (await exists(stagePath) || await exists(backupPath)) {
    throw new ProjectBackupError(`Backup identifier already exists: ${backupId}`);
  }

  const initial = await scanTree(sourceRoot);
  try {
    await createDurableDirectory(stagingRoot, stagePath);
  } catch (error) {
    if (hasCode(error, "EEXIST")) throw new ProjectBackupError(`Backup identifier already exists: ${backupId}`);
    throw error;
  }

  try {
    const stagedProjector = join(stagePath, ".projector");
    await createDurableDirectory(stagePath, stagedProjector);
    for (const directory of initial.directories) {
      const target = join(stagedProjector, ...directory.split("/"));
      await createDurableDirectory(dirname(target), target);
    }
    for (const file of initial.files) {
      const sourcePath = join(sourceRoot, ...file.path.split("/"));
      const bytes = await readRegularFile(sourcePath, `Source file .projector/${file.path}`);
      if (bytes.byteLength !== file.length || sha256(bytes) !== file.sha256) {
        throw new ProjectBackupError(`Projector source changed while copying .projector/${file.path}`, stagePath);
      }
      const destinationPath = join(stagedProjector, ...file.path.split("/"));
      await writeDurableExclusive(destinationPath, bytes);
      const copied = await readRegularFile(destinationPath, `Copied file .projector/${file.path}`);
      if (copied.byteLength !== file.length || sha256(copied) !== file.sha256) {
        throw new ProjectBackupError(`Backup verification failed for .projector/${file.path}`, stagePath);
      }
      await dependencies.afterFileCopied?.(`.projector/${file.path}`);
    }

    const finalSnapshot = await scanTree(sourceRoot);
    if (!sameSnapshot(initial, finalSnapshot)) {
      throw new ProjectBackupError("Projector source changed while the backup was being created", stagePath);
    }

    const manifest: ProjectBackupManifest = {
      formatVersion: 1,
      backupId,
      createdAt: (dependencies.now ?? (() => new Date()))().toISOString(),
      source: { projectorDirectory: ".projector" },
      files: initial.files.map((file) => ({
        path: `.projector/${file.path}`,
        length: file.length,
        sha256: file.sha256,
      })),
    };
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    const manifestPath = join(stagePath, "manifest.json");
    await writeDurableExclusive(manifestPath, manifestBytes);
    if (!(await readFile(manifestPath)).equals(manifestBytes)) {
      throw new ProjectBackupError("Backup manifest failed exact-byte verification", stagePath);
    }
    await syncDirectory(stagedProjector);
    await syncDirectory(stagePath);
    await syncDirectory(stagingRoot);

    if (await exists(backupPath)) throw new ProjectBackupError(`Backup identifier already exists: ${backupId}`, stagePath);
    await rename(stagePath, backupPath);
    await syncDirectory(publishedRoot);
    await syncDirectory(stagingRoot);
    return { backupId, backupPath, manifest };
  } catch (error) {
    if (error instanceof ProjectBackupError) {
      if (error.recoveryPath === undefined) {
        throw new ProjectBackupError(error.message, stagePath);
      }
      throw error;
    }
    throw new ProjectBackupError(
      `Backup creation failed; inspect or remove the incomplete stage at ${stagePath}: ${errorMessage(error)}`,
      stagePath,
    );
  }
}

interface SnapshotFile { path: string; length: number; sha256: string }
interface TreeSnapshot { directories: string[]; files: SnapshotFile[] }

async function scanTree(root: string): Promise<TreeSnapshot> {
  const directories: string[] = [];
  const files: SnapshotFile[] = [];
  async function visit(directory: string, prefix: string): Promise<void> {
    await assertRegularDirectory(directory, prefix.length === 0 ? "Projector source directory" : `.projector/${prefix}`);
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => compareText(left.name, right.name));
    for (const entry of entries) {
      const relativePath = prefix.length === 0 ? entry.name : `${prefix}/${entry.name}`;
      const path = join(directory, entry.name);
      const status = await lstat(path);
      if (status.isSymbolicLink()) throw new ProjectBackupError(`Projector source contains a symbolic link: .projector/${relativePath}`);
      if (status.isDirectory()) {
        directories.push(relativePath);
        await visit(path, relativePath);
      } else if (status.isFile()) {
        const bytes = await readRegularFile(path, `Source file .projector/${relativePath}`);
        files.push({ path: relativePath, length: bytes.byteLength, sha256: sha256(bytes) });
      } else {
        throw new ProjectBackupError(`Projector source contains a non-regular entry: .projector/${relativePath}`);
      }
    }
  }
  await visit(root, "");
  return { directories, files };
}

async function ensureOwnedDirectory(root: string, segments: string[]): Promise<string> {
  let current = root;
  for (const segment of segments) {
    const parent = current;
    current = containedPath(root, join(parent, segment), "backup directory");
    let created = false;
    try { await mkdir(current); created = true; }
    catch (error) { if (!hasCode(error, "EEXIST")) throw error; }
    await assertRegularDirectory(current, "Backup directory");
    if (created) await syncDirectory(parent);
  }
  return current;
}

async function createDurableDirectory(parent: string, path: string): Promise<void> {
  await mkdir(path);
  await assertRegularDirectory(path, "Backup staging directory");
  await syncDirectory(parent);
}

async function assertRegularDirectory(path: string, label: string): Promise<void> {
  const status = await lstat(path);
  if (status.isSymbolicLink()) throw new ProjectBackupError(`${label} is a symbolic link`);
  if (!status.isDirectory()) throw new ProjectBackupError(`${label} is not a regular directory`);
}

async function readRegularFile(path: string, label: string): Promise<Buffer> {
  const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);
  let handle;
  try { handle = await open(path, flags); }
  catch (error) {
    if (hasCode(error, "ELOOP")) throw new ProjectBackupError(`${label} is a symbolic link`);
    throw error;
  }
  try {
    const status = await handle.stat();
    if (!status.isFile()) throw new ProjectBackupError(`${label} is not a regular file`);
    return await handle.readFile();
  } finally { await handle.close(); }
}

async function writeDurableExclusive(path: string, bytes: Uint8Array): Promise<void> {
  const handle = await open(path, "wx");
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally { await handle.close(); }
}

async function syncDirectory(path: string): Promise<void> {
  const handle = await open(path, "r");
  try { await handle.sync(); }
  catch (error) {
    if (!hasCode(error, "EINVAL") && !hasCode(error, "ENOTSUP") && !hasCode(error, "EPERM")) throw error;
  } finally { await handle.close(); }
}

function sameSnapshot(left: TreeSnapshot, right: TreeSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function resolveRequiredPath(value: string, label: string): string {
  if (value.length === 0) throw new TypeError(`A ${label} is required`);
  return resolve(value);
}

function containedPath(root: string, target: string, label: string): string {
  const resolvedRoot = resolve(root);
  const resolvedTarget = resolve(target);
  const offset = relative(resolvedRoot, resolvedTarget);
  if (offset === "" || offset === ".." || offset.startsWith(`..\\`) || offset.startsWith("../") || isAbsolute(offset)) {
    if (resolvedTarget !== resolvedRoot) throw new ProjectBackupError(`${label} escapes its required root`);
  }
  return resolvedTarget;
}

function assertBackupId(value: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value) || value === "." || value === "..") {
    throw new TypeError(`Invalid backup identifier: ${value}`);
  }
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function compareText(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; }
  catch (error) { if (hasCode(error, "ENOENT")) return false; throw error; }
}
function hasCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
