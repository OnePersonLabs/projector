import { createHash, randomBytes } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { lstat, mkdir, open, opendir, readFile, rename, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import {
  CanonicalDocumentEnvelopeSchemasByKind,
  hydrateCanonicalDocumentWire,
  parseProjectorConfig,
  hashRootManifest,
  toCanonicalDocumentWire,
  type CanonicalDocumentEnvelope,
  type ContentHash,
  type RootManifestEntry,
  ObservationBudget,
  ObservationError,
  DerivedObservationBudget,
  type ObservationLimits,
} from "@projector/core";

import { parseTomlDocument, stringifyTomlDocument } from "./toml-codec.js";
import { canonicalEditorSchemaRelativePath } from "./project-schema-bundle.js";
import { currentObservationScope } from "../observation-scope.js";

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

async function canonicalTomlFiles(root: string, budget: ObservationBudget, signal?: AbortSignal): Promise<string[]> {
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
    signal?.throwIfAborted();
    budget.consume("maxDirectories", 1, "canonical-enumeration", directory);
    const entries = await opendir(directory);
    for await (const entry of entries) {
      signal?.throwIfAborted();
      budget.check("canonical-enumeration", directory);
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
        budget.consume("maxFiles", 1, "canonical-enumeration", path);
        files.push(path);
      } else if (entry.isFile() && isLegacyCanonicalJson(relativePath)) {
        throw new Error(`legacy or mixed canonical JSON requires project readiness migration: ${path}`);
      }
    }
  };
  await visit(root);
  return files.sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
}

export interface CanonicalSnapshotSource {
  readonly path: string;
  readonly relativePath: string;
  readonly source: string;
}

/** Collection owns filesystem access; parsing may execute in a terminable worker. */
export async function collectCanonicalSnapshotSources(
  repositoryRoot: string,
  budget = new ObservationBudget(),
  signal?: AbortSignal,
): Promise<CanonicalSnapshotSource[]> {
  const canonicalRoot = join(repositoryRoot, ".projector");
  const sources: CanonicalSnapshotSource[] = [];
  for (const path of await canonicalTomlFiles(canonicalRoot, budget, signal)) {
    signal?.throwIfAborted();
    const status = await lstat(path);
    if (!status.isFile() || status.isSymbolicLink()) throw new Error(`canonical source is not a regular file: ${path}`);
    budget.assertFileBytes(status.size, path);
    budget.assertTotalBytes(status.size, path);
    const chunks: Buffer[] = [];
    let bytes = 0;
    const stream = createReadStream(path, { highWaterMark: Math.min(64 * 1024, budget.limits.maxFileBytes, budget.remaining("maxTotalBytes") + 1), ...(signal === undefined ? {} : { signal }) });
    try {
      for await (const chunk of stream) {
        const buffer = chunk as Buffer;
        bytes += buffer.length;
        budget.assertFileBytes(bytes, path);
        budget.consume("maxTotalBytes", buffer.length, "canonical-read", path);
        chunks.push(buffer);
      }
    } finally { stream.destroy(); }
    sources.push({ path, relativePath: relative(canonicalRoot, path).replaceAll("\\", "/"), source: Buffer.concat(chunks, bytes).toString("utf8") });
  }
  return sources;
}

export function parseCanonicalSnapshotSources(sources: readonly CanonicalSnapshotSource[], derivedBudget = new DerivedObservationBudget()): CanonicalSnapshot {
  const documents: CanonicalDocumentEnvelope[] = [];
  for (const { path, relativePath, source } of sources) {
    if (relativePath === "config.toml") {
      try { withCanonicalParsingReservation(source, path, derivedBudget, () => parseProjectorConfig(parseTomlDocument(source, path))); }
      catch (error) {
        if (error instanceof ObservationError) throw error;
        throw new Error(`invalid Projector config at ${path}`, { cause: error });
      }
      continue;
    }
    const topLevel = relativePath.split("/")[0];
    const supportedKind = (Object.entries(kindLocations) as Array<[SupportedCanonicalKind, (typeof kindLocations)[SupportedCanonicalKind]]>)
      .find(([, location]) => path.endsWith(`.${location.at(-1)}.toml`))?.[0];
    if (supportedKind === undefined) {
      if (topLevel !== undefined && derivedTopLevelDirectories.has(topLevel)) continue;
      throw new Error(`unsupported canonical unknown kind at ${path}`);
    }
    const relativeParts = relativePath.split("/");
    if (!kindLocations[supportedKind].slice(0, -1).every((part, index) => relativeParts[index] === part)) {
      throw new Error(`canonical file is outside approved canonical family for ${supportedKind}: ${path}`);
    }
    derivedBudget.reserveItems(1, 128, "canonical-record", path);
    const document = withCanonicalParsingReservation(source, path, derivedBudget, () => parseEnvelope(source, path));
    if (document.kind !== supportedKind) throw new Error(`canonical kind/path conflict at ${path}: expected ${supportedKind}, found ${document.kind}`);
    documents.push(document);
  }
  documents.sort((left, right) => Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)) || Buffer.compare(Buffer.from(left.canonicalDocumentHash), Buffer.from(right.canonicalDocumentHash)));
  const keys = new Map<string, string>();
  for (const document of documents) {
    const owner = keys.get(document.key);
    if (owner !== undefined && owner !== document.id) throw new Error(`duplicate canonical key ${document.key}: ${owner} and ${document.id}`);
    keys.set(document.key, document.id);
  }
  const entries = documents.map(({ id, canonicalDocumentHash }) => ({ entityId: id, canonicalDocumentHash }));
  return { documents, entries, rootDigest: hashRootManifest(entries) };
}

function withCanonicalParsingReservation<T>(source: string, path: string, budget: DerivedObservationBudget, parse: () => T): T {
  // Reserve transient decoded-source and parser working space before TOML can
  // expand collections. Sibling sources release this allowance after parsing.
  const temporaryBytes = 256 + source.length * 4;
  budget.reserve(temporaryBytes, "canonical-source-expansion", path);
  try { return parse(); }
  finally { budget.release(temporaryBytes); }
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
  let document: CanonicalDocumentEnvelope;
  try {
    document = hydrateCanonicalDocumentWire(parsed);
  } catch (error) {
    throw new Error(`invalid canonical document at ${path}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
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
  await ensureDurableCanonicalDirectory(directory);
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
  const handle = await open(directory, constants.O_RDONLY);
  try { await handle.sync(); }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EINVAL" && code !== "ENOTSUP" && code !== "EPERM") throw error;
  }
  finally { await handle.close(); }
}

async function ensureDurableCanonicalDirectory(path: string): Promise<void> {
  const missing: string[] = [];
  let current = path;
  while (true) {
    try {
      const status = await lstat(current);
      if (status.isSymbolicLink() || !status.isDirectory()) throw new Error(`canonical path is not a real directory: ${current}`);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      missing.push(current);
      const parent = dirname(current);
      if (parent === current) throw new Error(`canonical path has no existing parent directory: ${path}`);
      current = parent;
    }
  }
  for (const directory of missing.reverse()) {
    const parent = dirname(directory);
    try { await mkdir(directory); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    const status = await lstat(directory);
    if (status.isSymbolicLink() || !status.isDirectory()) throw new Error(`canonical path is not a real directory: ${directory}`);
    await syncCanonicalDirectory(parent);
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
    const schemaPath = relative(dirname(path), join(this.repositoryRoot, canonicalEditorSchemaRelativePath(kind))).replaceAll("\\", "/");
    return {
      path,
      contents: stringifyTomlDocument(toCanonicalDocumentWire(normalized) as unknown as Record<string, unknown>, { schemaPath }),
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

  async snapshot(limits: Partial<ObservationLimits> = {}): Promise<CanonicalSnapshot> {
    const scope = currentObservationScope();
    return parseCanonicalSnapshotSources(await collectCanonicalSnapshotSources(this.repositoryRoot, scope?.budget ?? new ObservationBudget(limits), scope?.signal), new DerivedObservationBudget(scope?.limits.maxDerivedBytes ?? limits.maxDerivedBytes));
  }
}
