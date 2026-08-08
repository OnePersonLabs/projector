import { createHash, randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, readFile, rename, rm } from "node:fs/promises";
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
const operationalTopLevelDirectories = new Set(["runtime", "task16-selections", "task17-host-journals", "task17-sessions", "task17-capabilities", "task18-upgrades", "telemetry", "watch"]);
const operationalRootFiles = new Set(["dogfood.json", "governance.json"]);

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
      const path = join(directory, entry.name);
      const relativePath = relative(root, path).replaceAll("\\", "/");
      const [topLevel] = relativePath.split("/");
      if ((entry.isDirectory() && topLevel !== undefined && operationalTopLevelDirectories.has(topLevel))
        || (entry.isFile() && !relativePath.includes("/") && operationalRootFiles.has(entry.name))
        || (entry.isFile() && topLevel === "receipts" && !entry.name.endsWith(".receipt.json"))) continue;
      if (entry.isSymbolicLink()) {
        if (topLevel === undefined || !derivedTopLevelDirectories.has(topLevel)) {
          throw new Error(`symlink canonical entry is not allowed: ${path}`);
        }
        continue;
      }
      if (entry.isDirectory()) {
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
    const storageKey = createHash("sha256").update(id, "utf8").digest("hex");
    return join(this.canonicalRoot, ...directoryParts, `${storageKey}.${suffix}.json`);
  }

  private legacyPathFor(kind: SupportedCanonicalKind, id: string): string {
    const location = kindLocations[kind];
    return join(this.canonicalRoot, ...location.slice(0, -1), `${encodeURIComponent(id)}.${location.at(-1)}.json`);
  }

  private async validateOwnedPath(path: string, kind: SupportedCanonicalKind, id: string): Promise<boolean> {
    await this.assertNoSymlinks(path);
    try {
      const existing = parseEnvelope(await readFile(path, "utf8"), path);
      if (existing.kind !== kind || existing.id !== id) throw new Error(`canonical path ${path} is owned by ${existing.id}`);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }

  private async assertNoSymlinks(path: string): Promise<void> {
    const parts = relative(this.canonicalRoot, path).split(/[\\/]/u).filter(Boolean);
    let current = this.canonicalRoot;
    for (const part of ["", ...parts]) {
      if (part !== "") current = join(current, part);
      try {
        if ((await lstat(current)).isSymbolicLink()) throw new Error(`symlink canonical path is not allowed: ${current}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
    }
  }

  async write(document: CanonicalDocumentEnvelope): Promise<string> {
    const result = CanonicalDocumentEnvelopeSchema.safeParse(document);
    if (!result.success) throw new Error(`invalid canonical document: ${result.error.message}`);
    assertSupportedCanonicalVersions(document);
    const kind = document.kind as SupportedCanonicalKind;
    if (!(kind in kindLocations)) throw new Error(`unsupported canonical kind: ${document.kind}`);
    const path = this.pathFor(kind, document.id);
    await this.validateOwnedPath(path, kind, document.id);
    const legacyPath = this.legacyPathFor(kind, document.id);
    const hasLegacy = legacyPath !== path && await this.validateOwnedPath(legacyPath, kind, document.id);
    await atomicWrite(path, `${canonicalJson(document)}\n`);
    if (hasLegacy) await rm(legacyPath);
    return path;
  }

  async read(kind: SupportedCanonicalKind, id: string): Promise<CanonicalDocumentEnvelope | undefined> {
    let path = this.pathFor(kind, id);
    if (!await this.validateOwnedPath(path, kind, id)) path = this.legacyPathFor(kind, id);
    if (!await this.validateOwnedPath(path, kind, id)) return undefined;
    const document = parseEnvelope(await readFile(path, "utf8"), path);
    if (document.kind !== kind || document.id !== id) {
      throw new Error(`canonical path lookup conflict at ${path}`);
    }
    return document;
  }

  async delete(kind: SupportedCanonicalKind, id: string): Promise<boolean> {
    const paths = [...new Set([this.pathFor(kind, id), this.legacyPathFor(kind, id)])];
    const owned: string[] = [];
    for (const path of paths) if (await this.validateOwnedPath(path, kind, id)) owned.push(path);
    if (owned.length === 0) return false;
    for (const path of owned) await rm(path);
    for (const directory of new Set(owned.map(dirname))) {
      const directoryHandle = await open(directory, constants.O_RDONLY);
      try {
        await directoryHandle.sync();
      } finally {
        await directoryHandle.close();
      }
    }
    return true;
  }

  async snapshot(): Promise<CanonicalSnapshot> {
    const documents: CanonicalDocumentEnvelope[] = [];
    for (const path of await canonicalJsonFiles(this.canonicalRoot)) {
      const relativePath = relative(this.canonicalRoot, path).replaceAll("\\", "/");
      const topLevel = relativePath.split("/")[0];
      const supportedKind = (Object.entries(kindLocations) as Array<
        [SupportedCanonicalKind, (typeof kindLocations)[SupportedCanonicalKind]]
      >).find(([, location]) => path.endsWith(`.${location.at(-1)}.json`))?.[0];
      if (supportedKind === undefined) {
        if (topLevel !== undefined && derivedTopLevelDirectories.has(topLevel)) continue;
        const unsupportedKind = relativePath === "config.json" ? "Config"
          : relativePath.endsWith(".exception.json") ? "Exception"
            : relativePath.endsWith(".migration.json") ? "Migration"
              : "unknown";
        throw new Error(`unsupported canonical ${unsupportedKind} kind at ${path}`);
      }
      const relativeParts = relative(this.canonicalRoot, path).replaceAll("\\", "/").split("/");
      const approvedPrefix = kindLocations[supportedKind].slice(0, -1);
      if (!approvedPrefix.every((part, index) => relativeParts[index] === part)) {
        throw new Error(`canonical file is outside approved canonical family for ${supportedKind}: ${path}`);
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
