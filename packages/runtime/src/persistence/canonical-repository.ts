import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, open, readdir, readFile, rename, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import {
  CanonicalDocumentEnvelopeSchema,
  canonicalJson,
  parseCanonicalJson,
  hashRootManifest,
  type CanonicalDocumentEnvelope,
  type ContentHash,
  type RootManifestEntry,
} from "@projector/core";

const kindLocations = {
  concept: ["model", "concepts", "concept"],
  requirement: ["model", "requirements", "requirement"],
  "behavioral-scenario": ["model", "scenarios", "scenario"],
  relation: ["model", "relations", "relation"],
  lineage: ["model", "lineage", "lineage"],
  tombstone: ["model", "tombstones", "tombstone"],
  rule: ["rules", "rule"],
  "projection-lens": ["lenses", "lens"],
  "semantic-representation-profile": ["representations", "representation"],
  "authority-record": ["authorities", "authority"],
  "architecture-decision": ["decisions", "decision"],
  "transaction-receipt": ["receipts", "receipt"],
} as const;

export type SupportedCanonicalKind = keyof typeof kindLocations;
export const canonicalApiVersion = "projector/v2";
export const canonicalSchemaVersion = "2.0.0";

export interface CanonicalSnapshot {
  readonly documents: readonly CanonicalDocumentEnvelope[];
  readonly entries: readonly RootManifestEntry[];
  readonly rootDigest: ContentHash;
}

const derivedTopLevelDirectories = new Set([
  "cache",
  "certificates",
  "generated",
  "plans",
  "reports",
]);

async function canonicalJsonFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (directory === root && derivedTopLevelDirectories.has(entry.name)) continue;
        await visit(path);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        files.push(path);
      }
    }
  };
  await visit(root);
  return files.sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
}

function parseEnvelope(source: string, path: string): CanonicalDocumentEnvelope {
  let parsed: unknown;
  try {
    parsed = parseCanonicalJson(source);
  } catch (error) {
    throw new Error(`invalid canonical JSON at ${path}`, { cause: error });
  }
  const result = CanonicalDocumentEnvelopeSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`invalid canonical document at ${path}: ${result.error.message}`);
  }
  const document = result.data as CanonicalDocumentEnvelope;
  assertSupportedCanonicalVersions(document, ` at ${path}`);
  return document;
}

export function assertSupportedCanonicalVersions(document: CanonicalDocumentEnvelope, location = ""): void {
  if (document.apiVersion !== canonicalApiVersion) {
    throw new Error(`unsupported canonical apiVersion ${document.apiVersion}${location}`);
  }
  if (document.schemaVersion !== canonicalSchemaVersion) {
    throw new Error(`unsupported canonical schemaVersion ${document.schemaVersion}${location}`);
  }
}

async function atomicWrite(path: string, contents: string): Promise<void> {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true });
  const temporaryPath = join(directory, `.${randomBytes(12).toString("hex")}.tmp`);
  let handle;
  try {
    handle = await open(temporaryPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    await handle.writeFile(contents, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, path);
    const directoryHandle = await open(directory, constants.O_RDONLY);
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
  } finally {
    if (handle !== undefined) await handle.close();
    await rm(temporaryPath, { force: true });
  }
}

export class CanonicalFileRepository {
  readonly canonicalRoot: string;

  constructor(readonly repositoryRoot: string) {
    this.canonicalRoot = join(repositoryRoot, ".projector");
  }

  pathFor(kind: SupportedCanonicalKind, id: string): string {
    const location = kindLocations[kind];
    const directoryParts = location.slice(0, -1);
    const suffix = location.at(-1);
    return join(this.canonicalRoot, ...directoryParts, `${encodeURIComponent(id)}.${suffix}.json`);
  }

  async write(document: CanonicalDocumentEnvelope): Promise<string> {
    const result = CanonicalDocumentEnvelopeSchema.safeParse(document);
    if (!result.success) throw new Error(`invalid canonical document: ${result.error.message}`);
    assertSupportedCanonicalVersions(document);
    const kind = document.kind as SupportedCanonicalKind;
    if (!(kind in kindLocations)) throw new Error(`unsupported canonical kind: ${document.kind}`);
    const path = this.pathFor(kind, document.id);
    await atomicWrite(path, `${canonicalJson(document)}\n`);
    return path;
  }

  async read(kind: SupportedCanonicalKind, id: string): Promise<CanonicalDocumentEnvelope | undefined> {
    const path = this.pathFor(kind, id);
    try {
      await access(path, constants.R_OK);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
    const document = parseEnvelope(await readFile(path, "utf8"), path);
    if (document.kind !== kind || document.id !== id) {
      throw new Error(`canonical path lookup conflict at ${path}`);
    }
    return document;
  }

  async delete(kind: SupportedCanonicalKind, id: string): Promise<boolean> {
    const path = this.pathFor(kind, id);
    try {
      await rm(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
    const directoryHandle = await open(dirname(path), constants.O_RDONLY);
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
    return true;
  }

  async snapshot(): Promise<CanonicalSnapshot> {
    const documents: CanonicalDocumentEnvelope[] = [];
    for (const path of await canonicalJsonFiles(this.canonicalRoot)) {
      const supportedKind = (Object.entries(kindLocations) as Array<
        [SupportedCanonicalKind, (typeof kindLocations)[SupportedCanonicalKind]]
      >).find(([, location]) => path.endsWith(`.${location.at(-1)}.json`))?.[0];
      if (supportedKind === undefined) {
        const relativePath = relative(this.canonicalRoot, path).replaceAll("\\", "/");
        const unsupportedKind = relativePath === "config.json" ? "Config"
          : relativePath.endsWith(".exception.json") ? "Exception"
            : relativePath.endsWith(".migration.json") ? "Migration"
              : "unknown";
        throw new Error(`unsupported canonical ${unsupportedKind} kind at ${path}`);
      }
      const document = parseEnvelope(await readFile(path, "utf8"), path);
      if (document.kind !== supportedKind) {
        throw new Error(`canonical kind/path conflict at ${path}: expected ${supportedKind}, found ${document.kind}`);
      }
      documents.push(document);
    }
    documents.sort((left, right) =>
      Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)) ||
      Buffer.compare(Buffer.from(left.canonicalDocumentHash), Buffer.from(right.canonicalDocumentHash)));
    const keys = new Map<string, string>();
    for (const document of documents) {
      const owner = keys.get(document.key);
      if (owner !== undefined && owner !== document.id) {
        throw new Error(`duplicate canonical key ${document.key}: ${owner} and ${document.id}`);
      }
      keys.set(document.key, document.id);
    }
    const entries = documents.map(({ id, canonicalDocumentHash }) => ({
      entityId: id,
      canonicalDocumentHash,
    }));
    return {
      documents,
      entries,
      rootDigest: hashRootManifest(entries),
    };
  }
}
