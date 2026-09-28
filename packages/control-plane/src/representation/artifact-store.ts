import { createHash } from "node:crypto";
import { link, mkdir, open, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";

import {
  DurableRepresentationArtifactRecordSchema,
  RepresentationProjectionSchema,
  canonicalJson,
  createDurableRepresentationArtifactRecord,
  hashFramedDomain,
  type ContentHash,
  type RepresentationProjection,
  type RepresentationProjectionRef,
} from "@projector/core";
import { ArtifactSetIncompleteError, DurableArtifactSetStore, RepositoryPathService } from "@projector/runtime";

const root = ".projector/runtime/representations";
const publicationRoot = ".projector/runtime/representation-publication";
const publicationSchema = z.object({
  path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  semanticChangeId: z.string().optional(), projectionId: z.string().optional(),
}).strict();
type Publication = z.infer<typeof publicationSchema>;
export interface RepresentationPublicationState {
  readonly publicationId: string;
  readonly status: "published" | "incomplete" | "integrity-failed";
  readonly semanticChangeId?: string;
  readonly projectionId?: string;
  readonly reason?: string;
}
export interface RepresentationRecoveryOutcome extends Omit<RepresentationPublicationState, "status"> {
  readonly status: "recovered" | "recovery-required";
}

function validatePublication(bytes: Uint8Array) {
  const source = Buffer.from(bytes).toString("utf8");
  const manifest = publicationSchema.parse(JSON.parse(source));
  if (canonicalJson(manifest) !== source || !/^\.projector\/runtime\/representations\/(content\/[a-f0-9]{64}\.txt|projections\/[a-f0-9]{64}\.json)$/u.test(manifest.path)) {
    throw new Error("representation publication manifest is invalid");
  }
  return { manifest, blobs: [{ path: "artifact", sha256: manifest.sha256 }] };
}

export interface DurableRepresentationArtifact {
  readonly projection: RepresentationProjection;
  readonly content: string;
  readonly recordHash: ContentHash;
}

export interface AuthenticatedRepresentationFile {
  readonly path: string;
  readonly length: number;
  readonly sha256: string;
}

function projectionPath(projectionId: string): string {
  return `${root}/projections/${hashFramedDomain("representation-projection-path", projectionId).slice("sha256:v1:".length)}.json`;
}

function contentPath(contentHash: ContentHash): string {
  return `${root}/content/${contentHash.slice("sha256:v1:".length)}.txt`;
}

function projectionSemanticHash(projection: RepresentationProjection): ContentHash {
  const { semanticHash: _semanticHash, ...basis } = projection;
  return hashFramedDomain("representation-projection", basis);
}

function preservationSemanticHash(projection: RepresentationProjection): ContentHash {
  const { semanticHash: _semanticHash, ...basis } = projection.preservation;
  return hashFramedDomain("semantic-preservation-fingerprint", basis);
}

async function readArtifact(path: string): Promise<string> {
  const handle = await open(path, "r");
  try {
    const status = await handle.stat();
    if (!status.isFile()) throw new Error("representation artifact is not a regular file");
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (bytes.length !== status.size || after.size !== status.size || after.mtimeMs !== status.mtimeMs) {
      throw new Error("representation artifact changed while it was read");
    }
    return bytes.toString("utf8");
  } finally {
    await handle.close();
  }
}

async function writeExact(paths: RepositoryPathService, path: string, bytes: string, stagedPath: string): Promise<void> {
  const resolved = await paths.resolveWrite(path);
  await mkdir(dirname(resolved.realTarget), { recursive: true });
  try {
    await link(stagedPath, resolved.realTarget);
    let directoryPath = dirname(resolved.realTarget);
    while (true) {
      const directory = await open(directoryPath, "r");
      try { await directory.sync(); }
      catch (error) {
        if (!(error instanceof Error && "code" in error && ["EINVAL", "ENOTSUP", "EPERM"].includes(String(error.code)))) throw error;
      } finally { await directory.close(); }
      if (directoryPath === paths.root) break;
      directoryPath = dirname(directoryPath);
    }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    const existing = await readArtifact((await paths.resolveRead(path)).realTarget);
    if (existing !== bytes) throw new Error(`conflicting durable representation artifact: ${path}`);
  }
}

function assertProjection(projection: RepresentationProjection): void {
  RepresentationProjectionSchema.parse(projection);
  if (projection.semanticHash !== projectionSemanticHash(projection)) throw new Error("representation projection semantic hash is invalid");
  if (projection.preservation.semanticHash !== preservationSemanticHash(projection)) throw new Error("representation preservation hash is invalid");
}

export class RepositoryRepresentationArtifactStore {
  private readonly publications: DurableArtifactSetStore<Publication>;
  private constructor(private readonly paths: RepositoryPathService, private readonly options: { afterStage?: () => void | Promise<void> }) {
    this.publications = new DurableArtifactSetStore(join(paths.root, publicationRoot), validatePublication);
  }

  static async create(repositoryRoot: string, options: { afterStage?: () => void | Promise<void> } = {}): Promise<RepositoryRepresentationArtifactStore> {
    return new RepositoryRepresentationArtifactStore(await RepositoryPathService.create(repositoryRoot), options);
  }

  private async materialize(publicationId: string): Promise<Publication> {
    const set = await this.publications.resumeFinalize(publicationId);
    if (hashFramedDomain("representation-publication", set.manifest).slice("sha256:v1:".length) !== publicationId) throw new Error("representation publication identity authentication failed");
    const bytes = Buffer.from(set.blobs.get("artifact")!).toString("utf8");
    const contentMatch = /content\/([a-f0-9]{64})\.txt$/u.exec(set.manifest.path);
    if (contentMatch !== null) {
      if (hashFramedDomain("representation-artifact", bytes) !== `sha256:v1:${contentMatch[1]}`) throw new Error("representation publication content authentication failed");
    } else {
      const record = DurableRepresentationArtifactRecordSchema.parse(JSON.parse(bytes)) as { projection: RepresentationProjection };
      assertProjection(record.projection);
      if (canonicalJson(record) !== bytes || projectionPath(record.projection.id) !== set.manifest.path || set.manifest.projectionId !== record.projection.id) throw new Error("representation publication projection authentication failed");
      const content = await this.get(record.projection.contentHash);
      if (content === undefined || hashFramedDomain("representation-artifact", content) !== record.projection.contentHash) throw new Error("representation publication has no authenticated content");
    }
    await writeExact(this.paths, set.manifest.path, bytes, join(this.publications.storageRoot, "published", publicationId, "blobs", "artifact"));
    return set.manifest;
  }

  private async removePublication(publicationId: string): Promise<void> {
    const target = (await this.paths.resolveWrite(`${publicationRoot}/published/${publicationId}`)).realTarget;
    await rm(target, { recursive: true, force: true });
    const temporary = (await this.paths.resolveWrite(`${publicationRoot}/temporary/${publicationId}`)).realTarget;
    await rm(temporary, { recursive: true, force: true });
  }

  private async writePublication(path: string, content: string, association: { semanticChangeId?: string; projectionId?: string } = {}): Promise<void> {
    try {
      const existing = await readArtifact((await this.paths.resolveRead(path)).realTarget);
      if (existing !== content) throw new Error(`conflicting durable representation artifact: ${path}`);
      if (association.semanticChangeId === undefined) return;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    const manifest = { path, sha256: createHash("sha256").update(content).digest("hex"), ...association };
    const manifestBytes = Buffer.from(canonicalJson(manifest));
    const publicationId = hashFramedDomain("representation-publication", manifest).slice("sha256:v1:".length);
    const current = await this.publications.read(publicationId);
    if (current.status !== "published") {
      await this.publications.begin({ artifactSetId: publicationId });
      await this.publications.stageBlob({ artifactSetId: publicationId, path: "artifact", bytes: Buffer.from(content) });
      await this.publications.finalize({ artifactSetId: publicationId, manifestBytes });
    }
    await this.options.afterStage?.();
    try { await this.materialize(publicationId); }
    catch (error) {
      if (!(error instanceof ArtifactSetIncompleteError) || (await this.publications.read(publicationId)).status !== "missing") throw error;
      // An exact concurrent writer can acknowledge and remove the shared journal.
      // Its immutable final bytes, rather than absence of staging, prove completion.
      const existing = await readArtifact((await this.paths.resolveRead(path)).realTarget);
      if (existing !== content) throw new Error(`conflicting durable representation artifact: ${path}`);
    }
    if (association.semanticChangeId === undefined) await this.removePublication(publicationId);
  }

  async pending(options: { signal?: AbortSignal } = {}): Promise<RepresentationPublicationState[]> {
    options.signal?.throwIfAborted();
    const ids = new Set<string>();
    for (const phase of ["staging", "finalizing", "published"]) {
      try {
        const directory = (await this.paths.resolveRead(`${publicationRoot}/${phase}`)).realTarget;
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          if (!entry.isDirectory() || !/^[a-f0-9]{64}$/u.test(entry.name)) throw new Error("representation publication namespace contains an unsupported entry");
          ids.add(entry.name);
        }
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      }
    }
    const states: RepresentationPublicationState[] = [];
    for (const publicationId of [...ids].sort()) {
      options.signal?.throwIfAborted();
      const current = await this.publications.read(publicationId);
      if (current.status === "missing") continue;
      let association = current.status === "published" ? current.manifest : undefined;
      if (current.status === "incomplete") {
        try {
          const manifestPath = (await this.paths.resolveRead(`${publicationRoot}/finalizing/${publicationId}/manifest.bin`)).realTarget;
          association = validatePublication(Buffer.from(await readArtifact(manifestPath))).manifest;
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
        }
      }
      if (association !== undefined && hashFramedDomain("representation-publication", association).slice("sha256:v1:".length) !== publicationId) {
        states.push({ publicationId, status: "integrity-failed", reason: "representation publication identity authentication failed" });
        continue;
      }
      states.push({ publicationId, status: current.status, ...(association?.semanticChangeId === undefined ? {} : { semanticChangeId: association.semanticChangeId }), ...(association?.projectionId === undefined ? {} : { projectionId: association.projectionId }), ...(current.status === "integrity-failed" ? { reason: current.reason } : {}) });
    }
    return states;
  }

  async recover(options: { signal?: AbortSignal } = {}): Promise<RepresentationRecoveryOutcome[]> {
    const outcomes: RepresentationRecoveryOutcome[] = [];
    // Content must exist before its projection can authenticate the pair.
    const states = await this.pending(options);
    for (const state of states.sort((a, b) => Number(a.projectionId !== undefined) - Number(b.projectionId !== undefined))) {
      options.signal?.throwIfAborted();
      try {
        const manifest = await this.materialize(state.publicationId);
        options.signal?.throwIfAborted();
        outcomes.push({ publicationId: state.publicationId, status: "recovered", ...(manifest.semanticChangeId === undefined ? {} : { semanticChangeId: manifest.semanticChangeId }), ...(manifest.projectionId === undefined ? {} : { projectionId: manifest.projectionId }) });
        if (manifest.semanticChangeId === undefined) await this.removePublication(state.publicationId);
      } catch (error) {
        options.signal?.throwIfAborted();
        outcomes.push({ ...state, status: "recovery-required", reason: error instanceof Error ? error.message : String(error) });
      }
    }
    return outcomes;
  }

  async acknowledgeCapture(semanticChangeId: string): Promise<void> {
    for (const state of await this.pending()) {
      if (state.semanticChangeId === semanticChangeId && state.status === "published") await this.removePublication(state.publicationId);
    }
  }

  async put(contentHash: ContentHash, content: string): Promise<void> {
    if (hashFramedDomain("representation-artifact", content) !== contentHash) throw new Error("representation content hash is invalid");
    await this.writePublication(contentPath(contentHash), content);
  }

  async get(contentHash: ContentHash): Promise<string | undefined> {
    try {
      return await readArtifact((await this.paths.resolveRead(contentPath(contentHash))).realTarget);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
      throw error;
    }
  }

  async publish(projection: RepresentationProjection, semanticChangeId?: string): Promise<void> {
    assertProjection(projection);
    const content = await this.get(projection.contentHash);
    if (content === undefined || hashFramedDomain("representation-artifact", content) !== projection.contentHash) {
      throw new Error("representation projection content is missing or invalid");
    }
    const record = createDurableRepresentationArtifactRecord(projection);
    await this.writePublication(projectionPath(projection.id), canonicalJson(record), { projectionId: projection.id, ...(semanticChangeId === undefined ? {} : { semanticChangeId }) });
  }

  async read(reference: RepresentationProjectionRef): Promise<DurableRepresentationArtifact | undefined> {
    let source: string;
    try {
      source = await readArtifact((await this.paths.resolveRead(projectionPath(reference.projectionId))).realTarget);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
      throw error;
    }
    const record = DurableRepresentationArtifactRecordSchema.parse(JSON.parse(source)) as { projection: RepresentationProjection; recordHash: ContentHash };
    assertProjection(record.projection);
    const expected = {
      projectionId: record.projection.id,
      profileId: record.projection.profileId,
      profileVersion: record.projection.profileVersion,
      contentHash: record.projection.contentHash,
      preservationHash: record.projection.preservation.semanticHash,
    };
    if (canonicalJson(expected) !== canonicalJson(reference)) throw new Error("representation artifact does not match the selected plan reference");
    const content = await this.get(reference.contentHash);
    if (content === undefined || hashFramedDomain("representation-artifact", content) !== reference.contentHash) throw new Error("representation artifact content is missing or invalid");
    return { projection: record.projection, content, recordHash: record.recordHash };
  }
}

/** Validates every retained file in the durable representation namespace. */
export async function validateRetainedRepresentationArtifacts(input: {
  readonly repositoryRoot: string;
  readonly authenticatedFiles: readonly AuthenticatedRepresentationFile[];
  readonly signal: AbortSignal;
}): Promise<void> {
  const files = input.authenticatedFiles
    .filter(({ path }) => path === root || path.startsWith(`${root}/`))
    .sort((left, right) => left.path.localeCompare(right.path));
  const contents = new Map<ContentHash, string>();
  const projections: RepresentationProjection[] = [];
  const paths = await RepositoryPathService.create(input.repositoryRoot);
  for (const file of files) {
    input.signal.throwIfAborted();
    const source = await readArtifact((await paths.resolveRead(file.path)).realTarget);
    if (Buffer.byteLength(source) !== file.length || createHash("sha256").update(source).digest("hex") !== file.sha256) {
      throw new Error(`retained representation artifact changed during validation: ${file.path}`);
    }
    const contentMatch = /^\.projector\/runtime\/representations\/content\/([a-f0-9]{64})\.txt$/u.exec(file.path);
    if (contentMatch !== null) {
      const contentHash = `sha256:v1:${contentMatch[1]}` as ContentHash;
      if (hashFramedDomain("representation-artifact", source) !== contentHash) {
        throw new Error(`retained representation content filename does not authenticate its bytes: ${file.path}`);
      }
      contents.set(contentHash, source);
      continue;
    }
    if (!/^\.projector\/runtime\/representations\/projections\/[a-f0-9]{64}\.json$/u.test(file.path)) {
      throw new Error(`unsupported retained representation artifact path: ${file.path}`);
    }
    let value: unknown;
    try { value = JSON.parse(source); }
    catch { throw new Error(`retained representation record is malformed JSON: ${file.path}`); }
    const record = DurableRepresentationArtifactRecordSchema.parse(value) as { projection: RepresentationProjection };
    if (canonicalJson(record) !== source) throw new Error(`retained representation record is not canonical JSON: ${file.path}`);
    assertProjection(record.projection);
    if (projectionPath(record.projection.id) !== file.path) {
      throw new Error(`retained representation record path does not match its projection: ${file.path}`);
    }
    projections.push(record.projection);
  }
  for (const projection of projections) {
    const content = contents.get(projection.contentHash);
    if (content === undefined || hashFramedDomain("representation-artifact", content) !== projection.contentHash) {
      throw new Error(`retained representation ${projection.id} is missing authenticated content`);
    }
  }
}
