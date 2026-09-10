import { lstat, open, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  ProjectDataFormatSnapshotSchema,
  ProjectDataMigrationDraftSchema,
  canonicalJson,
} from "../packages/core/dist/index.js";
import {
  createProjectDataMigrationDraft,
  createReleaseCandidateProjectDataMigration,
} from "../packages/control-plane/dist/index.js";

import { validateReleaseCandidate } from "./release-candidate.mjs";

export async function createProjectDataMigrationFile(input) {
  const sourceSnapshot = ProjectDataFormatSnapshotSchema.parse(await readStrictJsonFile(input.sourcePath, "released format snapshot"));
  const suppliedDraft = ProjectDataMigrationDraftSchema.parse(await readStrictJsonFile(input.draftPath, "project-data migration draft"));
  if (sourceSnapshot.snapshotHash !== suppliedDraft.sourceSnapshot.snapshotHash) {
    throw new Error("Migration draft source does not match the authenticated released format snapshot");
  }
  const candidate = await validateReleaseCandidate(input.candidateRoot);
  const draft = createProjectDataMigrationDraft({
    sourceSnapshot,
    targetSnapshot: suppliedDraft.targetSnapshot,
    operations: suppliedDraft.operations,
    customTransforms: suppliedDraft.customTransforms,
    validations: suppliedDraft.validations,
  });
  const manifest = createReleaseCandidateProjectDataMigration({
    id: input.migrationId,
    draft,
    candidate: {
      packageIdentity: { name: candidate.manifest.release.name, version: candidate.manifest.release.version },
      files: candidate.files,
    },
  });
  const bytes = `${canonicalJson(manifest)}\n`;
  await writeImmutable(input.outputPath, bytes);
  return { manifest, outputPath: resolve(input.outputPath) };
}

async function readStrictJsonFile(path, label) {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`${label} must be a regular file`);
  const bytes = await readFile(path, "utf8");
  let value;
  try { value = JSON.parse(bytes); } catch { throw new Error(`${label} is malformed JSON`); }
  if (`${canonicalJson(value)}\n` !== bytes) throw new Error(`${label} must use canonical JSON bytes`);
  return value;
}

async function writeImmutable(path, bytes) {
  try {
    const file = await open(path, "wx", 0o600);
    try {
      await file.writeFile(bytes, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
    await syncDirectoryIfSupported(dirname(resolve(path)));
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`Existing migration manifest is not a regular file: ${path}`);
    const file = await open(path, "r+");
    try {
      if (await file.readFile("utf8") !== bytes) throw new Error(`Refusing to replace an existing migration manifest with different bytes: ${path}`);
      await file.sync();
    } finally {
      await file.close();
    }
    await syncDirectoryIfSupported(dirname(resolve(path)));
  }
}

async function syncDirectoryIfSupported(path) {
  const directory = await open(path, "r");
  try { await directory.sync(); }
  catch (error) {
    if (!["EINVAL", "ENOTSUP", "EPERM"].includes(error?.code)) throw error;
  } finally { await directory.close(); }
}

function parseArguments(argv) {
  const allowed = new Set(["--candidate", "--source", "--draft", "--id", "--output"]);
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(key) || value === undefined || value.length === 0 || values.has(key)) {
      throw new Error("Usage: pnpm create-migration -- --candidate <release-candidate> --source <released-snapshot.json> --draft <net-draft.json> --id <migration-id> --output <manifest.json>");
    }
    values.set(key, value);
  }
  if (values.size !== allowed.size) throw new Error("Every create-migration option is required");
  return {
    candidateRoot: values.get("--candidate"),
    sourcePath: values.get("--source"),
    draftPath: values.get("--draft"),
    migrationId: values.get("--id"),
    outputPath: values.get("--output"),
  };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await createProjectDataMigrationFile(parseArguments(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify({ status: "created", id: result.manifest.id, manifestHash: result.manifest.manifestHash, outputPath: result.outputPath })}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
