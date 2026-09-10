import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, open, opendir, rm, type FileHandle } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import {
  PortableRelativePathSchema,
  canonicalJson,
  hashFramedDomain,
  parseCanonicalJson,
  type ContentHash,
  type PendingProjectDataMigration,
} from "@projector/core";

import {
  hashFileTransactionJournalBytes,
  type ExactFileTransactionJournalRecord,
} from "../journal/transaction-journal.js";

const archiveMagic = Buffer.from("PROJECTOR-BACKUP-ARCHIVE-V1\n");
const maximumEntryCount = 100_000;
const maximumArchiveBytes = 64 * 1024 * 1024 * 1024;
const maximumManifestBytes = 16 * 1024 * 1024;
const ioBufferSize = 1024 * 1024;

export interface ProjectBackupInput { repositoryRoot: string; codexDataRoot: string }
export interface ProjectBackupManifestFile { path: string; length: number; sha256: string }
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
  backupLocation: { readonly kind: "codex-data-relative"; readonly path: string };
  manifest: ProjectBackupManifest;
  manifestHash: ContentHash;
  archiveHash: ContentHash;
}
export interface VerifyProjectBackupInput {
  codexDataRoot: string;
  backup: PendingProjectDataMigration["backup"];
}
export interface VerifyRetainedProjectDataTargetInput extends VerifyProjectBackupInput {
  repositoryRoot: string;
  journal: ExactFileTransactionJournalRecord;
  operationalPaths: readonly string[];
}
export interface RetainedProjectDataTargetVerification {
  backup: ProjectBackupResult;
  journalHash: ContentHash;
  retainedFileCount: number;
  currentFiles: ProjectBackupManifestFile[];
}
export type ProjectBackupCrashPoint = "before-namespace-publish" | "after-namespace-publish";
export interface ProjectBackupDependencies {
  createBackupId?: () => string;
  createTemporaryId?: () => string;
  now?: () => Date;
  afterFileCopied?: (relativePath: string) => void | Promise<void>;
  crash?: (point: ProjectBackupCrashPoint) => void;
  afterNamespacePublished?: (path: string) => void | Promise<void>;
  syncPublished?: (handle: FileHandle) => Promise<void>;
  syncDirectory?: (path: string) => Promise<void>;
  platform?: NodeJS.Platform;
}

export class ProjectBackupError extends Error {
  constructor(message: string, readonly recoveryPath?: string, options?: ErrorOptions) {
    super(message, options);
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
  const backupId = (dependencies.createBackupId ?? randomUUID)();
  const temporaryId = (dependencies.createTemporaryId ?? randomUUID)();
  assertBackupId(backupId);
  assertBackupId(temporaryId);
  await assertRegularDirectory(repositoryRoot, "Repository root");
  await assertRegularDirectory(sourceRoot, "Projector source directory");
  await assertRegularDirectory(codexDataRoot, "Codex data root");

  const fileName = `projector-backup-${backupId}.pba`;
  const backupPath = containedPath(codexDataRoot, join(codexDataRoot, fileName), "backup archive");
  const temporaryPath = containedPath(
    codexDataRoot,
    join(codexDataRoot, `.projector-backup-${backupId}.${temporaryId}.tmp`),
    "backup staging archive",
  );
  if (await exists(backupPath)) return recoverPublishedArchive(backupPath, codexDataRoot, backupId, dependencies);
  if (await exists(temporaryPath)) {
    throw new ProjectBackupError(`Backup staging name already exists: ${temporaryPath}`, temporaryPath);
  }

  const initial = await scanTree(sourceRoot);
  const manifest: ProjectBackupManifest = {
    formatVersion: 1,
    backupId,
    createdAt: (dependencies.now ?? (() => new Date()))().toISOString(),
    source: { projectorDirectory: ".projector" },
    files: initial.files.map((file) => ({ path: `.projector/${file.path}`, length: file.length, sha256: file.sha256 })),
  };
  const manifestBytes = Buffer.from(`${canonicalJson(manifest)}\n`);
  if (manifestBytes.byteLength > maximumManifestBytes) throw new ProjectBackupError("Backup manifest exceeds its byte limit");
  const lengthBytes = Buffer.alloc(8);
  lengthBytes.writeBigUInt64BE(BigInt(manifestBytes.byteLength));

  let namespacePublished = false;
  try {
    const archiveHash = createHash("sha256");
    const output = await open(temporaryPath, "wx", 0o600);
    try {
      for (const bytes of [archiveMagic, lengthBytes, manifestBytes]) {
        await writeAll(output, bytes);
        archiveHash.update(bytes);
      }
      for (const file of initial.files) {
        const source = await openRegularFile(join(sourceRoot, ...file.path.split("/")), "r", `.projector/${file.path}`);
        try {
          const copied = await copyAndHash(source, output, archiveHash);
          if (copied.length !== file.length || copied.sha256 !== file.sha256) {
            throw new ProjectBackupError(`Projector source changed while copying .projector/${file.path}`, temporaryPath);
          }
        } finally { await source.close(); }
        await dependencies.afterFileCopied?.(`.projector/${file.path}`);
      }
      await output.sync();
    } finally { await output.close(); }

    const finalSnapshot = await scanTree(sourceRoot);
    if (!sameSnapshot(initial, finalSnapshot)) {
      throw new ProjectBackupError("Projector source changed while the backup was being created", temporaryPath);
    }
    const staged = await inspectArchive(temporaryPath, backupId);
    const expectedArchiveHash = contentHash(archiveHash.digest("hex"));
    if (staged.archiveHash !== expectedArchiveHash || !staged.manifestBytes.equals(manifestBytes)) {
      throw new ProjectBackupError("Staged backup archive failed exact verification", temporaryPath);
    }
    dependencies.crash?.("before-namespace-publish");
    try { await link(temporaryPath, backupPath); }
    catch (error) {
      if (hasCode(error, "EEXIST")) {
        return await recoverPublishedArchive(backupPath, codexDataRoot, backupId, dependencies);
      }
      throw error;
    }
    namespacePublished = true;
    await syncBackupDirectory(codexDataRoot, dependencies);
    dependencies.crash?.("after-namespace-publish");
    await dependencies.afterNamespacePublished?.(backupPath);
    await flushPublished(backupPath, dependencies);
    const published = await inspectArchive(backupPath, backupId);
    if (published.archiveHash !== expectedArchiveHash || !published.manifestBytes.equals(manifestBytes)) {
      throw new ProjectBackupError("Published backup archive failed exact verification", backupPath);
    }
    await rm(temporaryPath);
    await syncBackupDirectory(codexDataRoot, dependencies);
    return resultFromInspection(backupPath, codexDataRoot, published);
  } catch (error) {
    const recoveryPath = namespacePublished ? backupPath : temporaryPath;
    if (error instanceof ProjectBackupError) {
      if (error.recoveryPath !== undefined) throw error;
      throw new ProjectBackupError(error.message, recoveryPath, { cause: error });
    }
    throw new ProjectBackupError(
      `Backup archive publication failed; recover from ${recoveryPath}: ${errorMessage(error)}`,
      recoveryPath,
      { cause: error },
    );
  }
}

export function hashProjectBackupManifest(bytes: Uint8Array): ContentHash {
  return hashFramedDomain("project-data-backup-archive-manifest-bytes", Buffer.from(bytes).toString("base64"));
}
export function hashProjectBackupArchive(bytes: Uint8Array): ContentHash {
  return contentHash(createHash("sha256").update(bytes).digest("hex"));
}

export async function verifyProjectBackup(input: VerifyProjectBackupInput): Promise<ProjectBackupResult> {
  const codexDataRoot = resolveRequiredPath(input.codexDataRoot, "Codex data root");
  await assertRegularDirectory(codexDataRoot, "Codex data root");
  assertBackupId(input.backup.id);
  if (input.backup.location.kind !== "codex-data-relative") {
    throw new ProjectBackupError("Recorded backup location kind is unsupported");
  }
  const expectedLocation = `projector-backup-${input.backup.id}.pba`;
  if (input.backup.location.path !== expectedLocation) {
    throw new ProjectBackupError("Recorded backup location does not match its backup identity");
  }
  const backupPath = containedPath(
    codexDataRoot,
    join(codexDataRoot, ...input.backup.location.path.split("/")),
    "recorded backup archive",
  );
  let inspection: ArchiveInspection;
  try {
    inspection = await inspectArchive(backupPath, input.backup.id);
  } catch (error) {
    throw new ProjectBackupError(
      `Recorded backup archive could not be authenticated: ${errorMessage(error)}`,
      backupPath,
      { cause: error },
    );
  }
  const manifestHash = hashProjectBackupManifest(inspection.manifestBytes);
  if (manifestHash !== input.backup.manifestHash) {
    throw new ProjectBackupError("Recorded backup manifest hash does not match the exact archive manifest", backupPath);
  }
  return resultFromInspection(backupPath, codexDataRoot, inspection);
}

export async function verifyRetainedProjectDataTarget(
  input: VerifyRetainedProjectDataTargetInput,
): Promise<RetainedProjectDataTargetVerification> {
  const repositoryRoot = resolveRequiredPath(input.repositoryRoot, "repository root");
  await assertRegularDirectory(repositoryRoot, "Repository root");
  const sourceRoot = containedPath(repositoryRoot, join(repositoryRoot, ".projector"), "project source");
  await assertRegularDirectory(sourceRoot, "Projector source directory");
  const backup = await verifyProjectBackup(input);
  verifyExactCommittedJournal(input.journal, repositoryRoot);
  const operationalPaths = validateOperationalPaths(input.operationalPaths);

  const expected = new Map<string, ProjectBackupManifestFile>();
  for (const file of backup.manifest.files) expected.set(file.path, { ...file });
  for (const operation of input.journal.record.operations) {
    for (const change of operation.changes) {
      if (!change.path.startsWith(".projector/")) {
        throw new ProjectBackupError(`Committed migration journal change is outside .projector: ${change.path}`);
      }
      if (operationalPaths.has(change.path)) continue;
      const prior = expected.get(change.path);
      if (!snapshotMatchesFile(change.before, prior)) {
        throw new ProjectBackupError(`Committed migration journal before-state does not match backup: ${change.path}`);
      }
      if (change.after.kind === "missing") expected.delete(change.path);
      else {
        const bytes = decodeSnapshotBytes(change.after.contentBase64, change.path);
        expected.set(change.path, { path: change.path, length: bytes.byteLength, sha256: rawSha256(bytes) });
      }
    }
  }

  const current = await scanTree(sourceRoot);
  const currentFiles = current.files
    .map((file) => ({ path: `.projector/${file.path}`, length: file.length, sha256: file.sha256 }))
    .filter((file) => !operationalPaths.has(file.path));
  for (const path of operationalPaths) expected.delete(path);
  const currentByPath = new Map(currentFiles.map((file) => [file.path, file]));
  const missing: string[] = [];
  const changed: string[] = [];
  const extra: string[] = [];
  for (const [path, file] of expected) {
    const observed = currentByPath.get(path);
    if (observed === undefined) missing.push(path);
    else if (observed.length !== file.length || observed.sha256 !== file.sha256) changed.push(path);
  }
  for (const path of currentByPath.keys()) if (!expected.has(path)) extra.push(path);
  if (missing.length > 0 || extra.length > 0 || changed.length > 0) {
    throw new ProjectBackupError(
      `Retained project target mismatch: missing [${missing.sort(compareText).join(", ")}]; ` +
      `extra [${extra.sort(compareText).join(", ")}]; changed [${changed.sort(compareText).join(", ")}]`,
    );
  }
  currentFiles.sort((left, right) => compareText(left.path, right.path));
  return {
    backup,
    journalHash: input.journal.contentHash,
    retainedFileCount: currentFiles.length,
    currentFiles,
  };
}

function verifyExactCommittedJournal(journal: ExactFileTransactionJournalRecord, repositoryRoot: string): void {
  if (hashFileTransactionJournalBytes(journal.bytes) !== journal.contentHash) {
    throw new ProjectBackupError("Committed migration journal bytes do not match their exact content hash");
  }
  if (!journal.bytes.equals(Buffer.from(`${JSON.stringify(journal.record)}\n`))) {
    throw new ProjectBackupError("Committed migration journal record does not match its exact persisted bytes");
  }
  if (journal.record.entry.phase !== "committed" || journal.record.operations.some(({ status }) => status !== "applied")) {
    throw new ProjectBackupError("Migration journal must be committed with every operation applied");
  }
  if (resolve(journal.record.entry.worktreePath) !== repositoryRoot) {
    throw new ProjectBackupError("Committed migration journal is bound to a different repository root");
  }
}

function validateOperationalPaths(paths: readonly string[]): Set<string> {
  const exact = new Set<string>();
  for (const path of paths) {
    if (!path.startsWith(".projector/") || path.includes("*") || path.includes("?") ||
        !PortableRelativePathSchema.safeParse(path).success || exact.has(path)) {
      throw new ProjectBackupError(`Invalid or duplicate exact operational path: ${path}`);
    }
    exact.add(path);
  }
  return exact;
}

function snapshotMatchesFile(
  snapshot: ExactFileTransactionJournalRecord["record"]["operations"][number]["changes"][number]["before"],
  file: ProjectBackupManifestFile | undefined,
): boolean {
  if (snapshot.kind === "missing") return file === undefined;
  if (file === undefined) return false;
  const bytes = decodeSnapshotBytes(snapshot.contentBase64, file.path);
  return bytes.byteLength === file.length && rawSha256(bytes) === file.sha256;
}

function decodeSnapshotBytes(contentBase64: string, path: string): Buffer {
  const bytes = Buffer.from(contentBase64, "base64");
  if (bytes.toString("base64") !== contentBase64) {
    throw new ProjectBackupError(`Committed migration journal snapshot is invalid base64: ${path}`);
  }
  return bytes;
}

interface SnapshotFile { path: string; length: number; sha256: string }
interface TreeSnapshot { files: SnapshotFile[] }
interface ArchiveInspection {
  manifest: ProjectBackupManifest;
  manifestBytes: Buffer;
  archiveHash: ContentHash;
}

async function recoverPublishedArchive(
  path: string,
  codexDataRoot: string,
  backupId: string,
  dependencies: ProjectBackupDependencies,
): Promise<ProjectBackupResult> {
  let inspection: ArchiveInspection;
  try { inspection = await inspectArchive(path, backupId); }
  catch (error) {
    throw new ProjectBackupError(`Existing backup ID ${backupId} contains unknown archive bytes`, path, { cause: error });
  }
  try { await flushPublished(path, dependencies); }
  catch (error) {
    throw new ProjectBackupError(`Existing backup archive could not be flushed: ${errorMessage(error)}`, path, { cause: error });
  }
  await syncBackupDirectory(codexDataRoot, dependencies);
  inspection = await inspectArchive(path, backupId);
  return resultFromInspection(path, codexDataRoot, inspection);
}

function resultFromInspection(path: string, root: string, inspection: ArchiveInspection): ProjectBackupResult {
  return {
    backupId: inspection.manifest.backupId,
    backupPath: path,
    backupLocation: { kind: "codex-data-relative", path: relative(root, path).replaceAll("\\", "/") },
    manifest: inspection.manifest,
    manifestHash: hashProjectBackupManifest(inspection.manifestBytes),
    archiveHash: inspection.archiveHash,
  };
}

async function flushPublished(path: string, dependencies: ProjectBackupDependencies): Promise<void> {
  const handle = await openRegularFile(path, "r+", "Published backup archive");
  try { await (dependencies.syncPublished ?? ((file) => file.sync()))(handle); }
  catch (error) { throw new ProjectBackupError(`Published backup archive flush failed: ${errorMessage(error)}`, path, { cause: error }); }
  finally { await handle.close(); }
}

async function syncDirectory(path: string, platform: NodeJS.Platform): Promise<void> {
  const handle = await open(path, "r");
  try { await handle.sync(); }
  catch (error) {
    if (
      platform === "win32" &&
      (hasCode(error, "EINVAL") || hasCode(error, "ENOTSUP") || hasCode(error, "EPERM"))
    ) return;
    throw error;
  } finally { await handle.close(); }
}

async function syncBackupDirectory(path: string, dependencies: ProjectBackupDependencies): Promise<void> {
  if (dependencies.syncDirectory !== undefined) return dependencies.syncDirectory(path);
  return syncDirectory(path, dependencies.platform ?? process.platform);
}

async function inspectArchive(path: string, expectedBackupId: string): Promise<ArchiveInspection> {
  const handle = await openRegularFile(path, "r", "Backup archive");
  try {
    const status = await handle.stat();
    if (status.size > maximumArchiveBytes) throw new ProjectBackupError("Backup archive exceeds its byte limit", path);
    const archiveHash = createHash("sha256");
    let offset = 0;
    const readPart = async (length: number): Promise<Buffer> => {
      const bytes = await readExact(handle, offset, length);
      offset += length;
      archiveHash.update(bytes);
      return bytes;
    };
    if (!(await readPart(archiveMagic.byteLength)).equals(archiveMagic)) throw new ProjectBackupError("Backup archive magic is invalid", path);
    const manifestLength = Number((await readPart(8)).readBigUInt64BE());
    if (!Number.isSafeInteger(manifestLength) || manifestLength < 1 || manifestLength > maximumManifestBytes) {
      throw new ProjectBackupError("Backup archive manifest length is invalid", path);
    }
    const manifestBytes = await readPart(manifestLength);
    const manifest = parseManifest(manifestBytes, expectedBackupId);
    for (const file of manifest.files) {
      const digest = createHash("sha256");
      let remaining = file.length;
      while (remaining > 0) {
        const chunk = await readPart(Math.min(ioBufferSize, remaining));
        digest.update(chunk);
        remaining -= chunk.byteLength;
      }
      if (digest.digest("hex") !== file.sha256) throw new ProjectBackupError(`Backup archive payload failed SHA-256: ${file.path}`, path);
    }
    if (offset !== status.size) throw new ProjectBackupError("Backup archive contains trailing or missing bytes", path);
    return { manifest, manifestBytes, archiveHash: contentHash(archiveHash.digest("hex")) };
  } finally { await handle.close(); }
}

function parseManifest(bytes: Buffer, expectedBackupId: string): ProjectBackupManifest {
  let value: unknown;
  try { value = parseCanonicalJson(bytes.toString("utf8")); }
  catch (error) { throw new ProjectBackupError(`Backup archive manifest is malformed: ${errorMessage(error)}`); }
  if (!isRecord(value) || !hasExactKeys(value, ["backupId", "createdAt", "files", "formatVersion", "source"])) {
    throw new ProjectBackupError("Backup archive manifest has an invalid structure");
  }
  const source = value.source;
  if (!isRecord(source) || !hasExactKeys(source, ["projectorDirectory"]) || source.projectorDirectory !== ".projector") {
    throw new ProjectBackupError("Backup archive manifest source is invalid");
  }
  if (value.formatVersion !== 1 || value.backupId !== expectedBackupId || typeof value.createdAt !== "string" ||
      new Date(value.createdAt).toISOString() !== value.createdAt || !Array.isArray(value.files) || value.files.length > maximumEntryCount) {
    throw new ProjectBackupError("Backup archive manifest identity or metadata is invalid");
  }
  assertBackupId(value.backupId);
  const files: ProjectBackupManifestFile[] = [];
  let prior = "";
  let total = 0;
  for (const item of value.files) {
    if (!isRecord(item) || !hasExactKeys(item, ["length", "path", "sha256"]) || typeof item.path !== "string" ||
        !item.path.startsWith(".projector/") || !PortableRelativePathSchema.safeParse(item.path).success ||
        typeof item.length !== "number" || !Number.isSafeInteger(item.length) || item.length < 0 ||
        typeof item.sha256 !== "string" || !/^[0-9a-f]{64}$/u.test(item.sha256) || item.path <= prior) {
      throw new ProjectBackupError("Backup archive manifest contains an invalid file declaration");
    }
    prior = item.path;
    total += item.length;
    if (!Number.isSafeInteger(total) || total > maximumArchiveBytes) throw new ProjectBackupError("Backup archive payload exceeds its byte limit");
    files.push({ path: item.path, length: item.length, sha256: item.sha256 });
  }
  const manifest: ProjectBackupManifest = {
    formatVersion: 1,
    backupId: value.backupId,
    createdAt: value.createdAt,
    source: { projectorDirectory: ".projector" },
    files,
  };
  if (!bytes.equals(Buffer.from(`${canonicalJson(manifest)}\n`))) throw new ProjectBackupError("Backup archive manifest is not canonical JSON");
  return manifest;
}

async function scanTree(root: string): Promise<TreeSnapshot> {
  const files: SnapshotFile[] = [];
  let entries = 0;
  let totalBytes = 0;
  async function visit(directory: string, prefix: string): Promise<void> {
    await assertRegularDirectory(directory, prefix.length === 0 ? "Projector source directory" : `.projector/${prefix}`);
    const names: string[] = [];
    const stream = await opendir(directory);
    for await (const entry of stream) {
      entries += 1;
      if (entries > maximumEntryCount) throw new ProjectBackupError("Projector source exceeds its entry limit");
      names.push(entry.name);
    }
    names.sort(compareText);
    for (const name of names) {
      const relativePath = prefix.length === 0 ? name : `${prefix}/${name}`;
      if (!PortableRelativePathSchema.safeParse(`.projector/${relativePath}`).success) {
        throw new ProjectBackupError(`Projector source contains an unsafe path: .projector/${relativePath}`);
      }
      const path = join(directory, name);
      const status = await lstat(path);
      if (status.isSymbolicLink()) throw new ProjectBackupError(`Projector source contains a symbolic link: .projector/${relativePath}`);
      if (status.isDirectory()) await visit(path, relativePath);
      else if (status.isFile()) {
        const source = await openRegularFile(path, "r", `.projector/${relativePath}`);
        try {
          const measured = await hashOpenFile(source);
          totalBytes += measured.length;
          if (!Number.isSafeInteger(totalBytes) || totalBytes > maximumArchiveBytes) throw new ProjectBackupError("Projector source exceeds its byte limit");
          files.push({ path: relativePath, ...measured });
        } finally { await source.close(); }
      } else throw new ProjectBackupError(`Projector source contains a non-regular entry: .projector/${relativePath}`);
    }
  }
  await visit(root, "");
  files.sort((left, right) => compareText(left.path, right.path));
  return { files };
}

async function hashOpenFile(handle: FileHandle): Promise<{ length: number; sha256: string }> {
  const digest = createHash("sha256");
  let length = 0;
  const buffer = Buffer.allocUnsafe(ioBufferSize);
  while (true) {
    const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, null);
    if (bytesRead === 0) break;
    digest.update(buffer.subarray(0, bytesRead));
    length += bytesRead;
    if (length > maximumArchiveBytes) throw new ProjectBackupError("Projector source file exceeds its byte limit");
  }
  return { length, sha256: digest.digest("hex") };
}

async function copyAndHash(source: FileHandle, destination: FileHandle, archiveHash: ReturnType<typeof createHash>): Promise<{ length: number; sha256: string }> {
  const digest = createHash("sha256");
  let length = 0;
  const buffer = Buffer.allocUnsafe(ioBufferSize);
  while (true) {
    const { bytesRead } = await source.read(buffer, 0, buffer.byteLength, null);
    if (bytesRead === 0) break;
    const chunk = buffer.subarray(0, bytesRead);
    await writeAll(destination, chunk);
    digest.update(chunk);
    archiveHash.update(chunk);
    length += bytesRead;
    if (length > maximumArchiveBytes) throw new ProjectBackupError("Projector source file exceeds its byte limit");
  }
  return { length, sha256: digest.digest("hex") };
}

async function writeAll(handle: FileHandle, bytes: Uint8Array): Promise<void> {
  let offset = 0;
  while (offset < bytes.byteLength) offset += (await handle.write(bytes, offset, bytes.byteLength - offset)).bytesWritten;
}
async function readExact(handle: FileHandle, position: number, length: number): Promise<Buffer> {
  const bytes = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const result = await handle.read(bytes, offset, length - offset, position + offset);
    if (result.bytesRead === 0) throw new ProjectBackupError("Backup archive ended unexpectedly");
    offset += result.bytesRead;
  }
  return bytes;
}
async function openRegularFile(path: string, mode: "r" | "r+", label: string): Promise<FileHandle> {
  const status = await lstat(path);
  if (status.isSymbolicLink()) throw new ProjectBackupError(`${label} is a symbolic link`);
  if (!status.isFile()) throw new ProjectBackupError(`${label} is not a regular file`);
  const flags = (mode === "r" ? constants.O_RDONLY : constants.O_RDWR) | (constants.O_NOFOLLOW ?? 0);
  return open(path, flags);
}
async function assertRegularDirectory(path: string, label: string): Promise<void> {
  const status = await lstat(path);
  if (status.isSymbolicLink()) throw new ProjectBackupError(`${label} is a symbolic link`);
  if (!status.isDirectory()) throw new ProjectBackupError(`${label} is not a regular directory`);
}
function sameSnapshot(left: TreeSnapshot, right: TreeSnapshot): boolean { return JSON.stringify(left) === JSON.stringify(right); }
function resolveRequiredPath(value: string, label: string): string {
  if (value.length === 0) throw new TypeError(`A ${label} is required`);
  return resolve(value);
}
function containedPath(root: string, target: string, label: string): string {
  const resolvedRoot = resolve(root);
  const resolvedTarget = resolve(target);
  const offset = relative(resolvedRoot, resolvedTarget);
  if (offset === "" || offset === ".." || offset.startsWith("..\\") || offset.startsWith("../") || isAbsolute(offset)) {
    if (resolvedTarget !== resolvedRoot) throw new ProjectBackupError(`${label} escapes its required root`);
  }
  return resolvedTarget;
}
function assertBackupId(value: string): void {
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(value) || !PortableRelativePathSchema.safeParse(value).success) {
    throw new TypeError(`Invalid backup identifier: ${value}`);
  }
}
function contentHash(hex: string): ContentHash { return `sha256:v1:${hex}`; }
function rawSha256(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
function compareText(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort(compareText);
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}
async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; }
  catch (error) { if (hasCode(error, "ENOENT")) return false; throw error; }
}
function hasCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
