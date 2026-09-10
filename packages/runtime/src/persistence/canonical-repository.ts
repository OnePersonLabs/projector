import { createHash, randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, readFile, rename, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import {
  CanonicalDocumentEnvelopeSchema,
  CanonicalDocumentEnvelopeSchemasByKind,
  parseProjectorConfig,
  hashRootManifest,
  type CanonicalDocumentEnvelope,
  type ContentHash,
  type RootManifestEntry,
} from "@projector/core";

import { parseTomlDocument, stringifyTomlDocument } from "./toml-codec.js";

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
  "architecture-concern": ["concerns", "concern"],
  "developer-preference": ["preferences", "preference"],
  "transaction-receipt": ["receipts", "receipt"],
  exception: ["exceptions", "exception"],
  migration: ["migrations", "migration"],
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
const operationalTopLevelDirectories = new Set(["runtime", "task17-host-journals", "task17-sessions", "task17-capabilities", "task18-upgrades", "telemetry", "watch"]);
const operationalRootFiles = new Set(["dogfood.json", "governance.json"]);

async function canonicalTomlFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const rootStatus = await lstat(root);
    if (rootStatus.isSymbolicLink() || !rootStatus.isDirectory()) {
      throw new Error(`canonical root must be a real directory: ${root}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return files;
    throw error;
  }
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
      } else if (entry.isFile() && entry.name.endsWith(".toml")) {
        files.push(path);
      } else if (entry.isFile() && isLegacyCanonicalJson(relativePath)) {
        throw new Error(`legacy or mixed canonical JSON requires project readiness migration: ${path}`);
      }
    }
  };
  await visit(root);
  return files.sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
}

function isLegacyCanonicalJson(relativePath: string): boolean {
  if (relativePath === "config.json") return true;
  return Object.values(kindLocations).some((location) => relativePath.endsWith(`.${location.at(-1)}.json`));
}

export interface PreparedCanonicalWrite {
  readonly path: string;
  readonly contents: string;
}

function parseEnvelope(source: string, path: string): CanonicalDocumentEnvelope {
  let parsed: unknown;
  try {
    parsed = parseTomlDocument(source, path);
  } catch (error) {
    throw new Error(`invalid canonical TOML at ${path}`, { cause: error });
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
    await syncCanonicalDirectory(directory);
  } finally {
    if (handle !== undefined) await handle.close();
    await rm(temporaryPath, { force: true });
  }
}

async function syncCanonicalDirectory(directory: string): Promise<void> {
  // Node cannot fsync a directory on Windows. The file contents are still
  // flushed before atomic replacement; power-loss durability of the directory
  // entry is only established on platforms that support directory fsync.
  if (process.platform === "win32") return;
  const handle = await open(directory, constants.O_RDONLY);
  try { await handle.sync(); }
  finally { await handle.close(); }
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
    const identityHash = createHash("sha256").update(id, "utf8").digest("hex");
    const readableIdentity = id.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 80) || "entity";
    return join(this.canonicalRoot, ...directoryParts, `${readableIdentity}--${identityHash}.${suffix}.toml`);
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

  prepareWrite(document: CanonicalDocumentEnvelope): PreparedCanonicalWrite {
    const kind = document.kind as SupportedCanonicalKind;
    if (!(kind in kindLocations)) throw new Error(`unsupported canonical kind: ${document.kind}`);
    const result = CanonicalDocumentEnvelopeSchemasByKind[kind].safeParse(document);
    if (!result.success) throw new Error(`invalid canonical document: ${result.error.message}`);
    const normalized = result.data as CanonicalDocumentEnvelope;
    assertSupportedCanonicalVersions(normalized);
    const path = this.pathFor(kind, normalized.id);
    const schemaPath = relative(dirname(path), join(this.canonicalRoot, "schemas", "canonical-document-v2.schema.json")).replaceAll("\\", "/");
    return {
      path,
      contents: stringifyTomlDocument(normalized as unknown as Record<string, unknown>, { schemaPath }),
    };
  }

  async write(document: CanonicalDocumentEnvelope): Promise<string> {
    const prepared = this.prepareWrite(document);
    await this.validateOwnedPath(prepared.path, document.kind as SupportedCanonicalKind, document.id);
    await atomicWrite(prepared.path, prepared.contents);
    return prepared.path;
  }

  async read(kind: SupportedCanonicalKind, id: string): Promise<CanonicalDocumentEnvelope | undefined> {
    const path = this.pathFor(kind, id);
    if (!await this.validateOwnedPath(path, kind, id)) return undefined;
    const document = parseEnvelope(await readFile(path, "utf8"), path);
    if (document.kind !== kind || document.id !== id) {
      throw new Error(`canonical path lookup conflict at ${path}`);
    }
    return document;
  }

  async delete(kind: SupportedCanonicalKind, id: string): Promise<boolean> {
    const path = this.pathFor(kind, id);
    if (!await this.validateOwnedPath(path, kind, id)) return false;
    await rm(path);
    await syncCanonicalDirectory(dirname(path));
    return true;
  }

  async snapshot(): Promise<CanonicalSnapshot> {
    const documents: CanonicalDocumentEnvelope[] = [];
    for (const path of await canonicalTomlFiles(this.canonicalRoot)) {
      const relativePath = relative(this.canonicalRoot, path).replaceAll("\\", "/");
      if (relativePath === "config.toml") {
        try {
          parseProjectorConfig(parseTomlDocument(await readFile(path, "utf8"), path));
        } catch (error) {
          throw new Error(`invalid Projector config at ${path}`, { cause: error });
        }
        continue;
      }
      const topLevel = relativePath.split("/")[0];
      const supportedKind = (Object.entries(kindLocations) as Array<
        [SupportedCanonicalKind, (typeof kindLocations)[SupportedCanonicalKind]]
      >).find(([, location]) => path.endsWith(`.${location.at(-1)}.toml`))?.[0];
      if (supportedKind === undefined) {
        if (topLevel !== undefined && derivedTopLevelDirectories.has(topLevel)) continue;
        const unsupportedKind = relativePath.endsWith(".exception.toml") ? "Exception"
            : relativePath.endsWith(".migration.toml") ? "Migration"
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
