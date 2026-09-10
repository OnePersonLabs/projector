import { mkdir, open } from "node:fs/promises";
import { dirname } from "node:path";

import {
  RepresentationProjectionSchema,
  canonicalJson,
  hashFramedDomain,
  type ContentHash,
  type RepresentationProjection,
  type RepresentationProjectionRef,
} from "@projector/core";
import { RepositoryPathService } from "@projector/runtime";
import { z } from "zod";

const root = ".projector/runtime/representations";
const maximumArtifactBytes = 8 * 1024 * 1024;
const apiVersion = "projector.representation-artifact/v1" as const;

const recordSchema = z.strictObject({
  apiVersion: z.literal(apiVersion),
  projection: RepresentationProjectionSchema,
  recordHash: z.string().regex(/^sha256:v1:[a-f0-9]{64}$/u),
});

export interface DurableRepresentationArtifact {
  readonly projection: RepresentationProjection;
  readonly content: string;
  readonly recordHash: ContentHash;
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

async function readBounded(path: string): Promise<string> {
  const handle = await open(path, "r");
  try {
    const status = await handle.stat();
    if (!status.isFile()) throw new Error("representation artifact is not a regular file");
    if (status.size > maximumArtifactBytes) throw new Error("representation artifact exceeds the bounded read limit");
    const buffer = Buffer.alloc(Math.min(maximumArtifactBytes + 1, status.size + 1));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > maximumArtifactBytes) throw new Error("representation artifact exceeds the bounded read limit");
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

async function writeExact(paths: RepositoryPathService, path: string, bytes: string): Promise<void> {
  if (Buffer.byteLength(bytes) > maximumArtifactBytes) throw new Error("representation artifact exceeds the bounded write limit");
  const resolved = await paths.resolveWrite(path);
  await mkdir(dirname(resolved.realTarget), { recursive: true });
  try {
    const handle = await open(resolved.realTarget, "wx");
    try {
      await handle.writeFile(bytes, "utf8");
      await handle.sync();
    } finally { await handle.close(); }
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
    const existing = await readBounded((await paths.resolveRead(path)).realTarget);
    if (existing !== bytes) throw new Error(`conflicting durable representation artifact: ${path}`);
  }
}

function assertProjection(projection: RepresentationProjection): void {
  RepresentationProjectionSchema.parse(projection);
  if (projection.semanticHash !== projectionSemanticHash(projection)) throw new Error("representation projection semantic hash is invalid");
  if (projection.preservation.semanticHash !== preservationSemanticHash(projection)) throw new Error("representation preservation hash is invalid");
}

export class RepositoryRepresentationArtifactStore {
  private constructor(private readonly paths: RepositoryPathService) {}

  static async create(repositoryRoot: string): Promise<RepositoryRepresentationArtifactStore> {
    return new RepositoryRepresentationArtifactStore(await RepositoryPathService.create(repositoryRoot));
  }

  async put(contentHash: ContentHash, content: string): Promise<void> {
    if (hashFramedDomain("representation-artifact", content) !== contentHash) throw new Error("representation content hash is invalid");
    await writeExact(this.paths, contentPath(contentHash), content);
  }

  async get(contentHash: ContentHash): Promise<string | undefined> {
    try {
      return await readBounded((await this.paths.resolveRead(contentPath(contentHash))).realTarget);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
      throw error;
    }
  }

  async publish(projection: RepresentationProjection): Promise<void> {
    assertProjection(projection);
    const content = await this.get(projection.contentHash);
    if (content === undefined || hashFramedDomain("representation-artifact", content) !== projection.contentHash) {
      throw new Error("representation projection content is missing or invalid");
    }
    const basis = { apiVersion, projection };
    const record = { ...basis, recordHash: hashFramedDomain("durable-representation-artifact", basis) };
    await writeExact(this.paths, projectionPath(projection.id), canonicalJson(record));
  }

  async read(reference: RepresentationProjectionRef): Promise<DurableRepresentationArtifact | undefined> {
    let source: string;
    try {
      source = await readBounded((await this.paths.resolveRead(projectionPath(reference.projectionId))).realTarget);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
      throw error;
    }
    const record = recordSchema.parse(JSON.parse(source)) as { apiVersion: typeof apiVersion; projection: RepresentationProjection; recordHash: ContentHash };
    const basis = { apiVersion: record.apiVersion, projection: record.projection };
    if (record.recordHash !== hashFramedDomain("durable-representation-artifact", basis)) throw new Error("representation artifact record hash is invalid");
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
