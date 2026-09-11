import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import {
  CanonicalDocumentEnvelopeSchema,
  LegacyUnversionedProjectorConfigSchema,
  PackageVersionSchema,
  PreparedProjectorConfigSchema,
  canonicalJson,
  createLegacyUnversionedProjectDataSource,
  parseCanonicalJson,
  type CanonicalDocumentEnvelope,
  type ContentHash,
  type LegacyUnversionedProjectDataSource,
} from "@projector/core";

import { CanonicalFileRepository } from "../persistence/canonical-repository.js";
import { installProjectorEditorSchemaBundle } from "../persistence/project-schema-bundle.js";
import { stringifyTomlDocument } from "../persistence/toml-codec.js";
import { SqliteDerivedStore } from "../sqlite/derived-store.js";
import { rebuildDerivedStore } from "../sqlite/rebuild.js";

const maximumConfigBytes = 16 * 1024;
const maximumDocumentBytes = 16 * 1024 * 1024;
const maximumDocumentCount = 10_000;
const maximumTotalDocumentBytes = 256 * 1024 * 1024;

const legacySuffixKinds = new Map<string, { readonly kind: CanonicalDocumentEnvelope["kind"]; readonly directory: string }>([
  ["concept", { kind: "concept", directory: ".projector/model/concepts/" }],
  ["requirement", { kind: "requirement", directory: ".projector/model/requirements/" }],
  ["scenario", { kind: "behavioral-scenario", directory: ".projector/model/scenarios/" }],
  ["relation", { kind: "relation", directory: ".projector/model/relations/" }],
  ["lineage", { kind: "lineage", directory: ".projector/model/lineage/" }],
  ["tombstone", { kind: "tombstone", directory: ".projector/model/tombstones/" }],
  ["rule", { kind: "rule", directory: ".projector/rules/" }],
  ["lens", { kind: "projection-lens", directory: ".projector/lenses/" }],
  ["representation", { kind: "semantic-representation-profile", directory: ".projector/representations/" }],
  ["authority", { kind: "authority-record", directory: ".projector/authorities/" }],
  ["decision", { kind: "architecture-decision", directory: ".projector/decisions/" }],
  ["concern", { kind: "architecture-concern", directory: ".projector/concerns/" }],
  ["preference", { kind: "developer-preference", directory: ".projector/preferences/" }],
  ["receipt", { kind: "transaction-receipt", directory: ".projector/receipts/" }],
  ["exception", { kind: "exception", directory: ".projector/exceptions/" }],
  ["migration", { kind: "migration", directory: ".projector/migrations/" }],
]);
const legacyCanonicalDirectories = new Set([...legacySuffixKinds.values()].map(({ directory }) => directory));

export interface PreparedLegacyUnversionedProjectData {
  readonly sourceDocumentCount: number;
  readonly canonicalRootDigest: ContentHash;
  readonly retiredPaths: readonly string[];
}

export interface LegacyUnversionedProjectDataObservation {
  readonly kind: "legacy-unversioned";
  readonly descriptor: LegacyUnversionedProjectDataSource;
  readonly enabled: boolean;
  readonly documents: readonly CanonicalDocumentEnvelope[];
  readonly retiredPaths: readonly string[];
}

/** Prepare legacy input in a caller-owned staging root; the source repository is read-only. */
export async function prepareLegacyUnversionedProjectData(input: {
  readonly repositoryRoot: string;
  readonly stagingRoot: string;
  readonly targetProjectorVersion: string;
}): Promise<PreparedLegacyUnversionedProjectData> {
  const source = await inspectLegacyUnversionedProjectData(input.repositoryRoot);
  return prepareObservedLegacyUnversionedProjectData({
    source,
    stagingRoot: input.stagingRoot,
    targetProjectorVersion: input.targetProjectorVersion,
  });
}

export async function inspectLegacyUnversionedProjectData(repositoryRoot: string): Promise<LegacyUnversionedProjectDataObservation> {
  const source = await readLegacyUnversionedProjectData(repositoryRoot);
  return {
    kind: "legacy-unversioned",
    descriptor: createLegacyUnversionedProjectDataSource({
      apiVersion: "projector.legacy-unversioned-project-data-source/v1",
      config: { apiVersion: "projector.config/v1", path: ".projector/config.json", versionBinding: "absent" },
      canonical: { envelopeApiVersion: "projector/v2", layout: "canonical-json" },
    }),
    enabled: source.config.enabled,
    documents: source.documents,
    retiredPaths: [".projector/config.json", ...source.relativePaths],
  };
}

export async function prepareObservedLegacyUnversionedProjectData(input: {
  readonly source: LegacyUnversionedProjectDataObservation;
  readonly stagingRoot: string;
  readonly targetProjectorVersion: string;
}): Promise<PreparedLegacyUnversionedProjectData> {
  const targetProjectorVersion = PackageVersionSchema.parse(input.targetProjectorVersion);
  await requireAbsentProjectorRoot(input.stagingRoot);
  const source = input.source;
  await mkdir(join(input.stagingRoot, ".projector"), { recursive: true });
  const target = new CanonicalFileRepository(input.stagingRoot);
  for (const document of source.documents) await target.write(document);
  await installProjectorEditorSchemaBundle(input.stagingRoot);
  const database = new SqliteDerivedStore(join(input.stagingRoot, ".projector", "state.db"));
  try {
    await rebuildDerivedStore(target, database);
  } finally {
    database.close();
  }
  const preparedConfig = PreparedProjectorConfigSchema.parse({
    apiVersion: "projector.config/v1",
    enabled: source.enabled,
    projectorVersion: targetProjectorVersion,
  });
  await writeFile(
    join(input.stagingRoot, ".projector", "config.toml"),
    stringifyTomlDocument(preparedConfig, { schemaPath: "schemas/projector-config-v1.schema.json" }),
    "utf8",
  );
  const snapshot = await target.snapshot();
  if (canonicalJson(snapshot.documents) !== canonicalJson(source.documents)) {
    throw new Error("Legacy project-data preparation changed canonical meaning, identity, or provenance");
  }
  return {
    sourceDocumentCount: source.documents.length,
    canonicalRootDigest: snapshot.rootDigest,
    retiredPaths: source.retiredPaths,
  };
}

async function readLegacyUnversionedProjectData(repositoryRoot: string): Promise<{
  readonly config: { readonly apiVersion: "projector.config/v1"; readonly enabled: boolean };
  readonly documents: readonly CanonicalDocumentEnvelope[];
  readonly relativePaths: readonly string[];
}> {
  const projectorRoot = join(repositoryRoot, ".projector");
  const configPath = join(projectorRoot, "config.json");
  const configBytes = await readStableFile(configPath, maximumConfigBytes, "Legacy Projector config");
  const configValue = parseStrictCanonicalJson(configBytes, "Legacy Projector config");
  const config = LegacyUnversionedProjectorConfigSchema.parse(configValue);
  try {
    await lstat(join(projectorRoot, "config.toml"));
    throw new Error("Legacy project data is mixed with prepared config.toml");
  } catch (error) {
    if (!isCode(error, "ENOENT")) throw error;
  }

  const candidates: Array<{ readonly absolutePath: string; readonly relativePath: string; readonly kind: CanonicalDocumentEnvelope["kind"] }> = [];
  await visit(projectorRoot, async (absolutePath) => {
    const relativePath = `.projector/${relative(projectorRoot, absolutePath).replaceAll("\\", "/")}`;
    const name = absolutePath.replaceAll("\\", "/").split("/").at(-1)!;
    const tomlMatch = /\.([a-z]+)\.toml$/u.exec(name);
    if (tomlMatch !== null && legacySuffixKinds.has(tomlMatch[1]!)) {
      throw new Error(`Legacy project data is mixed with canonical TOML at ${relativePath}`);
    }
    const match = /\.([a-z]+)\.json$/u.exec(name);
    if (match === null) return;
    const location = legacySuffixKinds.get(match[1]!);
    if (location !== undefined) {
      if (!relativePath.startsWith(location.directory) || relativePath.slice(location.directory.length).includes("/")) {
        if ([...legacyCanonicalDirectories].some((directory) => relativePath.startsWith(directory))) {
          throw new Error(`Legacy canonical filename suffix is not valid for its directory at ${relativePath}`);
        }
        return;
      }
      candidates.push({ absolutePath, relativePath, kind: location.kind });
    }
  });
  candidates.sort((left, right) => Buffer.compare(Buffer.from(left.relativePath), Buffer.from(right.relativePath)));
  if (candidates.length > maximumDocumentCount) throw new Error(`Legacy canonical document count exceeds ${maximumDocumentCount}`);
  const documents: CanonicalDocumentEnvelope[] = [];
  const ids = new Set<string>();
  let totalBytes = 0;
  for (const candidate of candidates) {
    const bytes = await readStableFile(candidate.absolutePath, maximumDocumentBytes, `Legacy canonical document ${candidate.relativePath}`);
    totalBytes += bytes.byteLength;
    if (totalBytes > maximumTotalDocumentBytes) throw new Error(`Legacy canonical bytes exceed ${maximumTotalDocumentBytes}`);
    const document = CanonicalDocumentEnvelopeSchema.parse(
      parseStrictCanonicalJson(bytes, `Legacy canonical document ${candidate.relativePath}`),
    ) as CanonicalDocumentEnvelope;
    if (document.kind !== candidate.kind) throw new Error(`Legacy canonical filename kind does not match document kind at ${candidate.relativePath}`);
    if (ids.has(document.id)) throw new Error(`Legacy canonical entity ID is duplicated: ${document.id}`);
    ids.add(document.id);
    documents.push(document);
  }
  documents.sort((left, right) => left.id.localeCompare(right.id));
  return { config, documents, relativePaths: candidates.map(({ relativePath }) => relativePath) };
}

async function visit(root: string, onFile: (path: string) => Promise<void>): Promise<void> {
  const status = await lstat(root);
  if (status.isSymbolicLink() || !status.isDirectory()) throw new Error(`Legacy Projector root must be a real directory: ${root}`);
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Legacy project data contains a symbolic link: ${path}`);
    if (entry.isDirectory()) await visit(path, onFile);
    else if (entry.isFile()) await onFile(path);
  }
}

async function readStableFile(path: string, maximumBytes: number, label: string): Promise<Buffer> {
  const before = await lstat(path);
  if (before.isSymbolicLink() || !before.isFile()) throw new Error(`${label} must be a regular non-symlink file`);
  if (before.size > maximumBytes) throw new Error(`${label} exceeds ${maximumBytes} bytes`);
  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  const handle = await open(path, constants.O_RDONLY | noFollow);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size) {
      throw new Error(`${label} changed before it was read`);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (bytes.byteLength !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
      throw new Error(`${label} changed while it was read`);
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

function parseStrictCanonicalJson(bytes: Buffer, label: string): unknown {
  const source = bytes.toString("utf8");
  let value: unknown;
  try {
    value = parseCanonicalJson(source);
  } catch (error) {
    throw new Error(`${label} is malformed JSON: ${message(error)}`);
  }
  const canonical = canonicalJson(value);
  if (`${canonical}\n` !== source && `${canonical}\r\n` !== source) {
    throw new Error(`${label} must use canonical JSON bytes`);
  }
  return value;
}

async function requireAbsentProjectorRoot(stagingRoot: string): Promise<void> {
  try {
    await lstat(join(stagingRoot, ".projector"));
    throw new Error("Legacy project-data staging root already contains .projector state");
  } catch (error) {
    if (!isCode(error, "ENOENT")) throw error;
  }
}

function isCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
