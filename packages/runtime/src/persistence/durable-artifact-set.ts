import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, readdir, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { PortableRelativePathSchema } from "@projector/core";

export interface ArtifactBlobDeclaration { path: string; sha256: string }
export interface ValidatedArtifactManifest<TManifest> {
  manifest: TManifest;
  blobs: readonly ArtifactBlobDeclaration[];
}
export type ArtifactManifestValidator<TManifest> = (
  manifestBytes: Uint8Array,
) => ValidatedArtifactManifest<TManifest> | Promise<ValidatedArtifactManifest<TManifest>>;

export interface PublishedArtifactSet<TManifest> {
  status: "published";
  artifactSetId: string;
  manifestBytes: Uint8Array;
  manifest: TManifest;
  blobs: ReadonlyMap<string, Uint8Array>;
}
export type ArtifactSetReadResult<TManifest> =
  | PublishedArtifactSet<TManifest>
  | { status: "incomplete"; artifactSetId: string }
  | { status: "missing"; artifactSetId: string }
  | { status: "integrity-failed"; artifactSetId: string; reason: string };

export class ArtifactSetIntegrityError extends Error {
  constructor(message: string) { super(message); this.name = "ArtifactSetIntegrityError"; }
}
export class ArtifactSetIncompleteError extends Error {
  constructor(readonly artifactSetId: string, readonly missingPaths: readonly string[]) {
    super(`Artifact set ${artifactSetId} is incomplete: ${missingPaths.join(", ")}`);
    this.name = "ArtifactSetIncompleteError";
  }
}

interface CheckedManifest<TManifest> extends ValidatedArtifactManifest<TManifest> { manifestBytes: Buffer }
interface ArtifactStoreTestHooks {
  beforeStageBlobTemporaryOpen?: () => void | Promise<void>;
  beforeStageBlobLink?: () => void | Promise<void>;
}
class RecoverableArtifactSetValidationError extends ArtifactSetIntegrityError {}

export class DurableArtifactSetStore<TManifest> {
  constructor(
    readonly storageRoot: string,
    readonly validateManifest: ArtifactManifestValidator<TManifest>,
    private readonly testHooks: ArtifactStoreTestHooks = {},
  ) {
    if (storageRoot.length === 0) throw new TypeError("A durable storage root is required");
  }

  async begin(input: { artifactSetId: string }): Promise<{ artifactSetId: string }> {
    assertArtifactSetId(input.artifactSetId);
    await this.ensureLayout();
    if (await pathExists(this.temporarySetPath(input.artifactSetId))) {
      await assertTemporaryDirectoryClear(this.temporarySetPath(input.artifactSetId));
    }
    const current = await this.read(input.artifactSetId);
    if (current.status === "published") {
      throw new ArtifactSetIntegrityError(`Artifact set ${input.artifactSetId} is already published`);
    }
    if (current.status === "integrity-failed") throw new ArtifactSetIntegrityError(current.reason);
    if (await pathExists(this.finalizingPath(input.artifactSetId))) return { artifactSetId: input.artifactSetId };
    await ensureDurableDirectory(this.stagePath(input.artifactSetId), "staged artifact set");
    await ensureDurableDirectory(join(this.stagePath(input.artifactSetId), "blobs"), "staged blob directory");
    return { artifactSetId: input.artifactSetId };
  }

  async stageBlob(input: { artifactSetId: string; path: string; bytes: Uint8Array }): Promise<void> {
    assertArtifactSetId(input.artifactSetId);
    assertBlobPath(input.path);
    if (await pathExists(this.publishedPath(input.artifactSetId))) {
      throw new ArtifactSetIntegrityError(`Artifact set ${input.artifactSetId} is already published`);
    }
    if (await pathExists(this.finalizingPath(input.artifactSetId))) {
      throw new ArtifactSetIntegrityError(`Artifact set ${input.artifactSetId} is already being finalized`);
    }
    const stage = this.stagePath(input.artifactSetId);
    await assertDirectory(stage, "staged artifact set");
    if (await pathExists(join(stage, "manifest.bin"))) {
      throw new ArtifactSetIntegrityError(`Artifact set ${input.artifactSetId} is already being finalized`);
    }
    const blobRoot = join(stage, "blobs");
    await assertDirectory(blobRoot, "staged blob directory");
    await ensureSafeParents(blobRoot, input.path);
    const target = join(blobRoot, ...input.path.split("/"));
    const bytes = Buffer.from(input.bytes);
    const temporary = this.temporarySetPath(input.artifactSetId);
    await ensureDurableDirectory(temporary, "artifact-set temporary directory");
    try {
      await this.testHooks.beforeStageBlobTemporaryOpen?.();
      await writeDurableNewFile(target, bytes, temporary, this.testHooks.beforeStageBlobLink);
    } catch (error) {
      if (!isCode(error, "EEXIST")) throw error;
      if (!(await readRegularFile(target, `staged blob ${input.path}`)).equals(bytes)) {
        throw new ArtifactSetIntegrityError(`Staged blob ${input.path} is immutable and has different bytes`);
      }
    }
    // Persist both a new link and a raced, exact link from another writer.
    await syncDirectory(dirname(target));
  }

  async finalize(input: {
    artifactSetId: string;
    manifestBytes: Uint8Array;
  }): Promise<PublishedArtifactSet<TManifest>> {
    assertArtifactSetId(input.artifactSetId);
    const manifest = await this.checkManifest(input.manifestBytes);
    await this.ensureLayout();
    const temporary = this.temporarySetPath(input.artifactSetId);
    await ensureDurableDirectory(temporary, "artifact-set temporary directory");
    await assertTemporaryDirectoryClear(temporary);
    const publishedPath = this.publishedPath(input.artifactSetId);
    if (await pathExists(publishedPath)) {
      const published = await this.read(input.artifactSetId);
      if (published.status !== "published") {
        throw new ArtifactSetIntegrityError(published.status === "integrity-failed" ? published.reason : "Published artifact set is unavailable");
      }
      if (!Buffer.from(published.manifestBytes).equals(manifest.manifestBytes)) {
        throw new ArtifactSetIntegrityError(`Artifact set ${input.artifactSetId} was published with a different manifest`);
      }
      return published;
    }

    const stage = this.stagePath(input.artifactSetId);
    const finalizing = this.finalizingPath(input.artifactSetId);
    const stageExists = await pathExists(stage);
    const finalizingExists = await pathExists(finalizing);
    if (stageExists && finalizingExists) {
      throw new ArtifactSetIntegrityError(`Artifact set ${input.artifactSetId} has ambiguous staging and finalizing state`);
    }
    if (!stageExists && !finalizingExists) throw new ArtifactSetIncompleteError(input.artifactSetId, ["staging"]);
    if (!finalizingExists) {
      const stagedState = await this.read(input.artifactSetId);
      if (stagedState.status === "integrity-failed") throw new ArtifactSetIntegrityError(stagedState.reason);
      try {
        await rename(stage, finalizing);
        await syncDirectory(this.finalizingRoot());
        await syncDirectory(this.stagingRoot());
      } catch (error) {
        if (!isCode(error, "ENOENT") || !(await pathExists(finalizing))) throw error;
      }
    }
    const manifestPath = join(finalizing, "manifest.bin");
    if (await pathExists(manifestPath) && !(await readRegularFile(manifestPath, "artifact manifest")).equals(manifest.manifestBytes)) {
      throw new ArtifactSetIntegrityError(`Artifact set ${input.artifactSetId} is being finalized with a different manifest`);
    }
    if (!(await pathExists(manifestPath))) {
      try {
        await writeDurableNewFile(manifestPath, manifest.manifestBytes, temporary);
      } catch (error) {
        if (!isCode(error, "EEXIST")) throw error;
        if (!(await readRegularFile(manifestPath, "artifact manifest")).equals(manifest.manifestBytes)) {
          throw new ArtifactSetIntegrityError(`Artifact set ${input.artifactSetId} is being finalized with a different manifest`);
        }
      }
    }
    await syncDirectory(finalizing);
    try {
      await this.readCompleteSet(finalizing, input.artifactSetId);
    } catch (error) {
      if (error instanceof RecoverableArtifactSetValidationError) {
        await this.rollbackFinalizing(input.artifactSetId, manifest.manifestBytes);
      }
      throw error;
    }

    try {
      await rename(finalizing, this.publishedPath(input.artifactSetId));
      await syncDirectory(this.publishedRoot());
      await syncDirectory(this.finalizingRoot());
    } catch (error) {
      if (!isCode(error, "EEXIST") && !isCode(error, "ENOTEMPTY") && !isCode(error, "ENOENT")) throw error;
      const raced = await this.read(input.artifactSetId);
      if (raced.status === "published" && Buffer.from(raced.manifestBytes).equals(manifest.manifestBytes)) return raced;
      throw new ArtifactSetIntegrityError(`Artifact set ${input.artifactSetId} could not be published atomically`);
    }
    const published = await this.read(input.artifactSetId);
    if (published.status !== "published") {
      throw new ArtifactSetIntegrityError(
        published.status === "integrity-failed" ? published.reason : `Published artifact set ${input.artifactSetId} disappeared`,
      );
    }
    return published;
  }

  async resumeFinalize(artifactSetId: string): Promise<PublishedArtifactSet<TManifest>> {
    assertArtifactSetId(artifactSetId);
    await this.ensureLayout();
    const current = await this.read(artifactSetId);
    if (current.status === "published") return current;
    if (current.status === "integrity-failed" && await pathExists(this.publishedPath(artifactSetId))) {
      throw new ArtifactSetIntegrityError(current.reason);
    }
    const finalizing = this.finalizingPath(artifactSetId);
    const manifestPath = join(finalizing, "manifest.bin");
    if (!(await pathExists(finalizing)) || !(await pathExists(manifestPath))) {
      throw new ArtifactSetIncompleteError(artifactSetId, ["finalizing/manifest.bin"]);
    }
    const manifestBytes = await readRegularFile(manifestPath, "artifact manifest");
    return this.finalize({ artifactSetId, manifestBytes });
  }

  async read(artifactSetId: string): Promise<ArtifactSetReadResult<TManifest>> {
    assertArtifactSetId(artifactSetId);
    const publishedPath = this.publishedPath(artifactSetId);
    if (await pathExists(publishedPath)) {
      try { return await this.readCompleteSet(publishedPath, artifactSetId); }
      catch (error) { return { status: "integrity-failed", artifactSetId, reason: errorMessage(error) }; }
    }
    const stage = this.stagePath(artifactSetId);
    const finalizing = this.finalizingPath(artifactSetId);
    if (await pathExists(stage) && await pathExists(finalizing)) {
      return { status: "integrity-failed", artifactSetId, reason: "Artifact set has ambiguous staging and finalizing state" };
    }
    const incomplete = await pathExists(finalizing) ? finalizing : stage;
    if (!(await pathExists(incomplete))) return { status: "missing", artifactSetId };
    try {
      const manifestPath = join(incomplete, "manifest.bin");
      if (await pathExists(manifestPath)) await this.readCompleteSet(incomplete, artifactSetId);
      else await collectStagedBlobs(incomplete);
      return { status: "incomplete", artifactSetId };
    } catch (error) {
      return { status: "integrity-failed", artifactSetId, reason: errorMessage(error) };
    }
  }

  private async readCompleteSet(directory: string, artifactSetId: string): Promise<PublishedArtifactSet<TManifest>> {
    await assertDirectory(directory, "artifact set");
    const manifest = await this.checkManifest(await readRegularFile(join(directory, "manifest.bin"), "artifact manifest"));
    const staged = await collectStagedBlobs(directory, true);
    assertExactDeclaredSet(artifactSetId, manifest.blobs, staged);
    verifyHashes(manifest.blobs, staged);
    return {
      status: "published",
      artifactSetId,
      manifestBytes: manifest.manifestBytes,
      manifest: manifest.manifest,
      blobs: staged,
    };
  }

  private async checkManifest(bytes: Uint8Array): Promise<CheckedManifest<TManifest>> {
    const manifestBytes = Buffer.from(bytes);
    const validated = await this.validateManifest(Buffer.from(manifestBytes));
    if (typeof validated !== "object" || validated === null || !Array.isArray(validated.blobs)) {
      throw new TypeError("Manifest validator must return a manifest and blob declarations");
    }
    const seen = new Set<string>();
    for (const declaration of validated.blobs) {
      if (typeof declaration !== "object" || declaration === null) throw new TypeError("Invalid blob declaration");
      assertBlobPath(declaration.path);
      if (!/^[0-9a-f]{64}$/u.test(declaration.sha256)) {
        throw new TypeError(`Blob ${declaration.path} has an invalid lowercase SHA-256 hash`);
      }
      if (seen.has(declaration.path)) throw new TypeError(`Duplicate blob declaration: ${declaration.path}`);
      for (const prior of seen) if (prior.startsWith(`${declaration.path}/`) || declaration.path.startsWith(`${prior}/`)) {
        throw new TypeError(`Blob paths conflict as file and directory: ${prior}, ${declaration.path}`);
      }
      seen.add(declaration.path);
    }
    const blobs = Object.freeze(validated.blobs.map(({ path, sha256 }) => Object.freeze({ path, sha256 })));
    return { manifestBytes, manifest: validated.manifest, blobs };
  }

  private async ensureLayout(): Promise<void> {
    await ensureDurableDirectory(this.storageRoot, "artifact storage root");
    await ensureDurableDirectory(this.stagingRoot(), "artifact staging directory");
    await ensureDurableDirectory(this.finalizingRoot(), "artifact finalization directory");
    await ensureDurableDirectory(this.publishedRoot(), "artifact publication directory");
    await ensureDurableDirectory(this.temporaryRoot(), "artifact temporary directory");
  }

  private async rollbackFinalizing(artifactSetId: string, manifestBytes: Buffer): Promise<void> {
    const finalizing = this.finalizingPath(artifactSetId);
    const manifestPath = join(finalizing, "manifest.bin");
    try {
      if ((await readRegularFile(manifestPath, "artifact manifest")).equals(manifestBytes)) {
        await rm(manifestPath);
        await syncDirectory(finalizing);
      }
      if (!(await pathExists(this.stagePath(artifactSetId)))) {
        await rename(finalizing, this.stagePath(artifactSetId));
        await syncDirectory(this.stagingRoot());
        await syncDirectory(this.finalizingRoot());
      }
    } catch {
      // Preserve the exact finalizing state for a later integrity read/recovery.
    }
  }

  private stagingRoot(): string { return join(this.storageRoot, "staging"); }
  private finalizingRoot(): string { return join(this.storageRoot, "finalizing"); }
  private publishedRoot(): string { return join(this.storageRoot, "published"); }
  private temporaryRoot(): string { return join(this.storageRoot, "temporary"); }
  private temporarySetPath(id: string): string { return join(this.temporaryRoot(), id); }
  private stagePath(id: string): string { return join(this.stagingRoot(), id); }
  private finalizingPath(id: string): string { return join(this.finalizingRoot(), id); }
  private publishedPath(id: string): string { return join(this.publishedRoot(), id); }
}

function assertExactDeclaredSet(
  artifactSetId: string,
  declarations: readonly ArtifactBlobDeclaration[],
  staged: ReadonlyMap<string, Uint8Array>,
): void {
  const declared = new Set(declarations.map(({ path }) => path));
  const missing = [...declared].filter((path) => !staged.has(path)).sort();
  const undeclared = [...staged.keys()].filter((path) => !declared.has(path)).sort();
  if (missing.length > 0 || undeclared.length > 0) {
    const parts = [
      ...(missing.length === 0 ? [] : [`missing declared blobs: ${missing.join(", ")}`]),
      ...(undeclared.length === 0 ? [] : [`undeclared staged blobs: ${undeclared.join(", ")}`]),
    ];
    throw new RecoverableArtifactSetValidationError(`Artifact set ${artifactSetId} does not match its manifest; ${parts.join("; ")}`);
  }
}

function verifyHashes(
  declarations: readonly ArtifactBlobDeclaration[],
  staged: ReadonlyMap<string, Uint8Array>,
): void {
  for (const declaration of declarations) {
    const bytes = staged.get(declaration.path);
    if (bytes === undefined || hash(bytes) !== declaration.sha256) {
      throw new RecoverableArtifactSetValidationError(`Blob ${declaration.path} failed its declared SHA-256 hash`);
    }
  }
}

async function collectStagedBlobs(directory: string, allowManifest = false): Promise<Map<string, Uint8Array>> {
  await assertDirectory(directory, "artifact set");
  const rootEntries = await readdir(directory, { withFileTypes: true });
  let foundBlobs = false;
  for (const entry of rootEntries) {
    const status = await lstat(join(directory, entry.name));
    if (status.isSymbolicLink()) throw new ArtifactSetIntegrityError(`Artifact set contains a symbolic link: ${entry.name}`);
    if (entry.name === "blobs" && status.isDirectory()) foundBlobs = true;
    else if (!(allowManifest && entry.name === "manifest.bin" && status.isFile())) {
      throw new ArtifactSetIntegrityError(`Artifact set contains an unexpected entry: ${entry.name}`);
    }
  }
  if (!foundBlobs) return new Map();
  const blobs = new Map<string, Uint8Array>();
  await collectBlobDirectory(join(directory, "blobs"), "", blobs);
  return blobs;
}

async function collectBlobDirectory(root: string, relative: string, blobs: Map<string, Uint8Array>): Promise<void> {
  const directory = relative.length === 0 ? root : join(root, ...relative.split("/"));
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
    assertBlobPath(path);
    const absolute = join(directory, entry.name);
    const status = await lstat(absolute);
    if (status.isSymbolicLink()) throw new ArtifactSetIntegrityError(`Artifact set contains a symbolic link: blobs/${path}`);
    if (status.isDirectory()) await collectBlobDirectory(root, path, blobs);
    else if (status.isFile()) blobs.set(path, await readRegularFile(absolute, `blob ${path}`));
    else throw new ArtifactSetIntegrityError(`Artifact set contains a non-regular entry: blobs/${path}`);
  }
}

function assertArtifactSetId(value: string): void {
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(value) || value.includes("/") || !PortableRelativePathSchema.safeParse(value).success) {
    throw new TypeError(`Invalid artifact set ID: ${value}`);
  }
}
function assertBlobPath(value: string): void {
  if (!/^[a-z0-9][a-z0-9._/-]*$/u.test(value) || !PortableRelativePathSchema.safeParse(value).success) {
    throw new TypeError(`Invalid artifact blob path: ${value}`);
  }
}

async function ensureSafeParents(blobRoot: string, relativePath: string): Promise<void> {
  await assertDirectory(blobRoot, "staged blob directory");
  let current = blobRoot;
  for (const segment of relativePath.split("/").slice(0, -1)) {
    const parent = current;
    current = join(current, segment);
    try { await mkdir(current); } catch (error) { if (!isCode(error, "EEXIST")) throw error; }
    await assertDirectory(current, "staged blob parent");
    await syncDirectory(parent);
  }
}

async function ensureDurableDirectory(path: string, label: string): Promise<void> {
  const missing: string[] = [];
  let current = resolve(path);
  while (!(await pathExists(current))) {
    missing.push(current);
    const parent = dirname(current);
    if (parent === current) throw new ArtifactSetIntegrityError(`${label} has no existing parent directory`);
    current = parent;
  }
  await assertDirectory(current, label);
  for (const directory of missing.reverse()) {
    const parent = dirname(directory);
    try { await mkdir(directory); } catch (error) { if (!isCode(error, "EEXIST")) throw error; }
    await assertDirectory(directory, label);
    await syncDirectory(parent);
  }
}

async function assertTemporaryDirectoryClear(path: string): Promise<void> {
  await assertDirectory(path, "artifact-set temporary directory");
  const entries = await readdir(path, { withFileTypes: true });
  if (entries.length === 0) return;
  const locations: string[] = [];
  for (const entry of entries) {
    const target = join(path, entry.name);
    const status = await lstat(target);
    if (entry.isSymbolicLink() || !status.isFile() || !/^\.artifact-[0-9a-f-]{36}\.tmp$/u.test(entry.name)) {
      throw new ArtifactSetIntegrityError(`Artifact temporary directory contains an unsafe entry: ${target}`);
    }
    locations.push(target);
  }
  throw new ArtifactSetIntegrityError(
    `Artifact publication is blocked by active or interrupted temporary files: ${locations.sort().join(", ")}. ` +
    "Retry after active writers finish, or remove only these exact files after confirming no writer remains active.",
  );
}

async function assertDirectory(path: string, label: string): Promise<void> {
  const status = await lstat(path);
  if (status.isSymbolicLink() || !status.isDirectory()) throw new ArtifactSetIntegrityError(`${label} is not a regular directory`);
}
async function readRegularFile(path: string, label: string): Promise<Buffer> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const status = await handle.stat();
    if (!status.isFile()) throw new ArtifactSetIntegrityError(`${label} is not a regular file`);
    return await handle.readFile();
  } finally { await handle.close(); }
}
async function writeDurableNewFile(
  path: string,
  bytes: Uint8Array,
  temporaryRoot: string,
  beforeLink?: () => void | Promise<void>,
): Promise<void> {
  const temporary = join(temporaryRoot, `.artifact-${randomUUID()}.tmp`);
  const handle = await open(temporary, "wx");
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  try {
    await beforeLink?.();
    await link(temporary, path);
  }
  finally { await rm(temporary, { force: true }); }
}
function hash(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
async function pathExists(path: string): Promise<boolean> {
  try { await lstat(path); return true; }
  catch (error) { if (isCode(error, "ENOENT")) return false; throw error; }
}
async function syncDirectory(path: string): Promise<void> {
  const handle = await open(path, "r");
  try { await handle.sync(); }
  catch (error) { if (!isCode(error, "EINVAL") && !isCode(error, "ENOTSUP") && !isCode(error, "EPERM")) throw error; }
  finally { await handle.close(); }
}
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function isCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
