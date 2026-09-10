import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, readdir, rename, rm } from "node:fs/promises";
import { dirname, join, posix } from "node:path";

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

interface CheckedManifest<TManifest> extends ValidatedArtifactManifest<TManifest> { manifestBytes: Uint8Array }

export class DurableArtifactSetStore<TManifest> {
  constructor(
    readonly storageRoot: string,
    readonly validateManifest: ArtifactManifestValidator<TManifest>,
  ) {
    if (storageRoot.length === 0) throw new TypeError("A durable storage root is required");
  }

  async begin(input: { artifactSetId: string; manifestBytes: Uint8Array }): Promise<{ artifactSetId: string }> {
    assertArtifactSetId(input.artifactSetId);
    const manifest = await this.checkManifest(input.manifestBytes);
    await this.ensureLayout();
    const published = await this.read(input.artifactSetId);
    if (published.status === "published") {
      throw new ArtifactSetIntegrityError(`Artifact set ${input.artifactSetId} is already published`);
    }
    if (published.status === "integrity-failed") throw new ArtifactSetIntegrityError(published.reason);

    const stage = this.stagePath(input.artifactSetId);
    try {
      await mkdir(stage);
      await mkdir(join(stage, "blobs"));
      await writeDurableNewFile(join(stage, "manifest.bin"), manifest.manifestBytes);
      await syncDirectory(stage);
      await syncDirectory(this.stagingRoot());
    } catch (error) {
      if (!isCode(error, "EEXIST")) throw error;
      await this.resumeBegin(stage, manifest.manifestBytes);
    }
    return { artifactSetId: input.artifactSetId };
  }

  async stageBlob(input: { artifactSetId: string; path: string; bytes: Uint8Array }): Promise<void> {
    assertArtifactSetId(input.artifactSetId);
    assertBlobPath(input.path);
    const stage = this.stagePath(input.artifactSetId);
    await assertDirectory(stage, "staged artifact set");
    const manifest = await this.readCheckedManifest(stage);
    const declaration = manifest.blobs.find(({ path }) => path === input.path);
    if (declaration === undefined) throw new ArtifactSetIntegrityError(`Blob ${input.path} is not declared by the manifest`);
    const bytes = Buffer.from(input.bytes);
    if (hash(bytes) !== declaration.sha256) {
      throw new ArtifactSetIntegrityError(`Blob ${input.path} does not match its declared SHA-256 hash`);
    }
    const target = join(stage, "blobs", ...input.path.split("/"));
    await ensureSafeParents(join(stage, "blobs"), input.path);
    try {
      await writeDurableNewFile(target, bytes);
      await syncDirectory(dirname(target));
    } catch (error) {
      if (!isCode(error, "EEXIST")) throw error;
      const existing = await readRegularFile(target, `staged blob ${input.path}`);
      if (!existing.equals(bytes)) {
        throw new ArtifactSetIntegrityError(`Staged blob ${input.path} is immutable and has different bytes`);
      }
    }
  }

  async finalize(artifactSetId: string): Promise<PublishedArtifactSet<TManifest>> {
    assertArtifactSetId(artifactSetId);
    await this.ensureLayout();
    const current = await this.read(artifactSetId);
    if (current.status === "published") return current;
    if (current.status === "integrity-failed") throw new ArtifactSetIntegrityError(current.reason);
    if (current.status === "missing") throw new ArtifactSetIncompleteError(artifactSetId, ["manifest.bin"]);
    const stage = this.stagePath(artifactSetId);
    const checked = await this.readCompleteSet(stage, artifactSetId, false);
    if (checked.status === "incomplete") throw new ArtifactSetIncompleteError(artifactSetId, checked.missingPaths);
    try {
      await rename(stage, this.publishedPath(artifactSetId));
      await syncDirectory(this.publishedRoot());
      await syncDirectory(this.stagingRoot());
    } catch (error) {
      if (!isCode(error, "EEXIST") && !isCode(error, "ENOTEMPTY") && !isCode(error, "ENOENT")) throw error;
      const raced = await this.read(artifactSetId);
      if (raced.status === "published") return raced;
      throw new ArtifactSetIntegrityError(`Artifact set ${artifactSetId} could not be published atomically`);
    }
    const published = await this.read(artifactSetId);
    if (published.status !== "published") {
      throw new ArtifactSetIntegrityError(
        published.status === "integrity-failed" ? published.reason : `Published artifact set ${artifactSetId} disappeared`,
      );
    }
    return published;
  }

  async read(artifactSetId: string): Promise<ArtifactSetReadResult<TManifest>> {
    assertArtifactSetId(artifactSetId);
    const published = this.publishedPath(artifactSetId);
    if (await pathExists(published)) {
      try {
        const result = await this.readCompleteSet(published, artifactSetId, true);
        if (result.status === "incomplete") {
          return { status: "integrity-failed", artifactSetId, reason: `Published artifact set is incomplete: ${result.missingPaths.join(", ")}` };
        }
        return result.value;
      } catch (error) {
        return { status: "integrity-failed", artifactSetId, reason: errorMessage(error) };
      }
    }
    const stage = this.stagePath(artifactSetId);
    if (!(await pathExists(stage))) return { status: "missing", artifactSetId };
    try {
      await this.readCompleteSet(stage, artifactSetId, false);
      return { status: "incomplete", artifactSetId };
    } catch (error) {
      return { status: "integrity-failed", artifactSetId, reason: errorMessage(error) };
    }
  }

  private async readCompleteSet(directory: string, artifactSetId: string, published: boolean): Promise<
    | { status: "complete"; value: PublishedArtifactSet<TManifest> }
    | { status: "incomplete"; missingPaths: string[] }
  > {
    await assertDirectory(directory, published ? "published artifact set" : "staged artifact set");
    let manifest: CheckedManifest<TManifest>;
    try { manifest = await this.readCheckedManifest(directory); }
    catch (error) {
      if (!published && isCode(error, "ENOENT")) {
        await this.inspectSetEntries(directory, undefined, true);
        return { status: "incomplete", missingPaths: ["manifest.bin"] };
      }
      throw error;
    }
    await this.inspectSetEntries(directory, manifest.blobs, false);
    const blobs = new Map<string, Uint8Array>();
    const missing: string[] = [];
    for (const declaration of manifest.blobs) {
      const path = join(directory, "blobs", ...declaration.path.split("/"));
      try {
        const bytes = await readRegularFile(path, `blob ${declaration.path}`);
        if (hash(bytes) !== declaration.sha256) {
          throw new ArtifactSetIntegrityError(`Blob ${declaration.path} failed its declared SHA-256 hash`);
        }
        blobs.set(declaration.path, bytes);
      } catch (error) {
        if (!published && isCode(error, "ENOENT")) missing.push(declaration.path);
        else throw error;
      }
    }
    if (missing.length > 0) return { status: "incomplete", missingPaths: missing };
    return { status: "complete", value: {
      status: "published", artifactSetId, manifestBytes: manifest.manifestBytes,
      manifest: manifest.manifest, blobs,
    } };
  }

  private async inspectSetEntries(
    directory: string,
    declarations: readonly ArtifactBlobDeclaration[] | undefined,
    permitUnknownWhileManifestMissing: boolean,
  ): Promise<void> {
    const allowedFiles = new Set(["manifest.bin"]);
    const allowedDirectories = new Set(["blobs"]);
    if (declarations !== undefined) for (const { path } of declarations) {
      const segments = path.split("/");
      allowedFiles.add(`blobs/${path}`);
      for (let index = 1; index < segments.length; index += 1) {
        allowedDirectories.add(`blobs/${segments.slice(0, index).join("/")}`);
      }
    }
    await inspectDirectory(directory, "", allowedFiles, allowedDirectories, permitUnknownWhileManifestMissing);
  }

  private async readCheckedManifest(directory: string): Promise<CheckedManifest<TManifest>> {
    return this.checkManifest(await readRegularFile(join(directory, "manifest.bin"), "artifact manifest"));
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
    await mkdir(this.storageRoot, { recursive: true });
    await assertDirectory(this.storageRoot, "artifact storage root");
    for (const path of [this.stagingRoot(), this.publishedRoot()]) {
      await mkdir(path, { recursive: true });
      await assertDirectory(path, "artifact storage directory");
    }
  }

  private async resumeBegin(stage: string, manifestBytes: Uint8Array): Promise<void> {
    await assertDirectory(stage, "staged artifact set");
    const blobs = join(stage, "blobs");
    try { await mkdir(blobs); }
    catch (error) { if (!isCode(error, "EEXIST")) throw error; await assertDirectory(blobs, "staged blob directory"); }
    const manifestPath = join(stage, "manifest.bin");
    try { await writeDurableNewFile(manifestPath, manifestBytes); }
    catch (error) {
      if (!isCode(error, "EEXIST")) throw error;
      if (!(await readRegularFile(manifestPath, "artifact manifest")).equals(manifestBytes)) {
        throw new ArtifactSetIntegrityError("Staged artifact manifest is immutable and has different bytes");
      }
    }
    await syncDirectory(stage);
  }

  private stagingRoot(): string { return join(this.storageRoot, "staging"); }
  private publishedRoot(): string { return join(this.storageRoot, "published"); }
  private stagePath(id: string): string { return join(this.stagingRoot(), id); }
  private publishedPath(id: string): string { return join(this.publishedRoot(), id); }
}

function assertArtifactSetId(value: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value) || value === "." || value === "..") {
    throw new TypeError(`Invalid artifact set ID: ${value}`);
  }
}
function assertBlobPath(value: string): void {
  if (value.length === 0 || value.includes("\\") || value.includes("\0") || value.startsWith("/") ||
      /^[A-Za-z]:/u.test(value) || posix.normalize(value) !== value ||
      value.split("/").some((segment) => segment === "." || segment === ".." || segment.length === 0)) {
    throw new TypeError(`Invalid artifact blob path: ${value}`);
  }
}

async function ensureSafeParents(blobRoot: string, relativePath: string): Promise<void> {
  await assertDirectory(blobRoot, "staged blob directory");
  let current = blobRoot;
  for (const segment of relativePath.split("/").slice(0, -1)) {
    const parent = current;
    current = join(current, segment);
    let created = false;
    try { await mkdir(current); created = true; } catch (error) { if (!isCode(error, "EEXIST")) throw error; }
    await assertDirectory(current, "staged blob parent");
    if (created) await syncDirectory(parent);
  }
}

async function inspectDirectory(
  root: string, relative: string, allowedFiles: ReadonlySet<string>, allowedDirectories: ReadonlySet<string>,
  permitUnknown: boolean,
): Promise<void> {
  const directory = relative.length === 0 ? root : join(root, ...relative.split("/"));
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
    const status = await lstat(join(directory, entry.name));
    if (status.isSymbolicLink()) throw new ArtifactSetIntegrityError(`Artifact set contains a symbolic link: ${child}`);
    if (status.isDirectory()) {
      if (!allowedDirectories.has(child) && !permitUnknown) throw new ArtifactSetIntegrityError(`Artifact set contains an unexpected directory: ${child}`);
      await inspectDirectory(root, child, allowedFiles, allowedDirectories, permitUnknown);
    } else if (status.isFile()) {
      if (!allowedFiles.has(child) && !permitUnknown) throw new ArtifactSetIntegrityError(`Artifact set contains an unexpected file: ${child}`);
    } else throw new ArtifactSetIntegrityError(`Artifact set contains a non-regular entry: ${child}`);
  }
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
  } finally {
    await handle.close();
  }
}
async function writeDurableNewFile(path: string, bytes: Uint8Array): Promise<void> {
  const temporary = join(dirname(path), `.artifact-${randomUUID()}.tmp`);
  const handle = await open(temporary, "wx");
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  try { await link(temporary, path); }
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
