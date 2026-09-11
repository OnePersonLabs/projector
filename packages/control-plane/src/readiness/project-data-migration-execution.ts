import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { cp, lstat, mkdir, mkdtemp, open, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

import {
  ProjectDataFormatSnapshotSchema,
  ProjectDataLegacyIngressManifestSchema,
  ProjectDataMigrationChainSchema,
  StateDigestSchema,
  canonicalJson,
  hashFramedDomain,
  parseCanonicalJson,
  type ContentHash,
  type PendingProjectDataMigration,
  type ProjectDataFormatSnapshot,
  type ProjectDataMigrationArtifactRef,
  type ProjectDataMigrationSourceAuthority,
  type StateDigest,
} from "@projector/core";
import {
  CanonicalFileRepository,
  FileTransactionJournal,
  PendingProjectDataMigrationStore,
  RepositoryPathService,
  WriterLeaseManager,
  createProjectBackup,
  inspectLegacyUnversionedProjectData,
  withProjectOperationAccess,
  type ProjectBackupManifestFile,
} from "@projector/runtime";

import { loadProjectDataMigrationArtifact, type ProjectDataMigrationSourceObservation } from "./project-data-migration-artifact.js";
import { createPreparedProjectDataMigrationRecoveryService } from "./project-data-migration-recovery.js";
import { observePreparedMigrationTarget } from "./project-data-migration-target.js";

const writerLeaseStaleAfterMs = 30_000;

export interface PackagedProjectDataMigrationResult {
  readonly status: "migrated" | "reconciled" | "not-required";
  readonly attemptId?: string;
  readonly migrationId?: string;
}

export function createPackagedProjectDataMigrationService(input: {
  readonly packagedRoot: string;
  readonly codexDataRoot: string;
}) {
  const packagedRoot = resolve(input.packagedRoot);
  return {
    async migrate(repositoryRoot: string, request: {
      readonly requestId: string;
      readonly processId: number;
      readonly signal?: AbortSignal;
    }): Promise<PackagedProjectDataMigrationResult> {
      const targetFormat = await readCanonicalFile(
        join(packagedRoot, "project-data/format-target.json"),
        ProjectDataFormatSnapshotSchema,
        "packaged target format",
      );
      const pending = await new PendingProjectDataMigrationStore(repositoryRoot).read();
      if (pending !== undefined) {
        const recovered = await createPreparedProjectDataMigrationRecoveryService({
          targetFormat,
          codexDataRoot: input.codexDataRoot,
        }).recover(repositoryRoot, request);
        if (recovered.status !== "reconciled") {
          throw new Error(recovered.status === "no-pending" ? "Pending migration disappeared before recovery" : recovered.reason);
        }
        return { status: "reconciled", attemptId: recovered.attemptId, migrationId: recovered.migrationId };
      }

      const selection = await selectMigration(packagedRoot, repositoryRoot, targetFormat);
      if (selection === undefined) return { status: "not-required" };
      const attemptId = `migration-attempt:${randomUUID()}`;
      const stagingRoot = await mkdtemp(join(repositoryRoot, ".projector-migration-stage-"));
      const stagingLocation = relative(repositoryRoot, stagingRoot).replaceAll("\\", "/");
      let committed = false;
      try {
        await withProjectOperationAccess(repositoryRoot, {
          operation: "project-data-migration",
          mode: "exclusive",
          ...(request.signal === undefined ? {} : { signal: request.signal }),
        }, async (access) => {
          const paths = await RepositoryPathService.create(repositoryRoot);
          const lease = await new WriterLeaseManager(paths, { staleAfterMs: writerLeaseStaleAfterMs })
            .acquireProjectDataMigration({
              sessionId: request.requestId,
              processId: request.processId,
              attemptId,
              migrationId: selection.manifest.id,
              manifestHash: selection.manifest.manifestHash,
              sourceAuthority: selection.sourceAuthority,
              targetSnapshotHash: targetFormat.snapshotHash,
            });
          const assertOwned = async () => {
            throwIfAborted(access.signal);
            await access.assertOwned();
            await lease.heartbeat();
            throwIfAborted(access.signal);
          };
          try {
            await assertOwned();
            const backup = await createProjectBackup({
              repositoryRoot,
              codexDataRoot: input.codexDataRoot,
              coordination: { operationAccess: access, writerLease: lease },
            });
            await assertOwned();
            const source = await observeSource(repositoryRoot, selection, backup.manifest.files, access.signal);
            if (source.kind === "release-format") {
              await prepareStageFromBackup(repositoryRoot, stagingRoot, backup.manifest.files);
            }
            await runArtifacts(packagedRoot, selection.transforms, "transform", {
              sourceAuthority: selection.sourceAuthority,
              targetFormat,
              source,
              stagingRoot,
              signal: access.signal,
            });
            if (source.kind === "legacy-unversioned") {
              await mergeRetainedBackupFiles(repositoryRoot, stagingRoot, backup.manifest.files, new Set(selection.retiredPaths));
            }
            await runArtifacts(packagedRoot, selection.validations, "validation", {
              sourceAuthority: selection.sourceAuthority,
              targetFormat,
              source,
              stagingRoot,
              signal: access.signal,
            });
            const stagedFiles = await inventoryProjectorFiles(stagingRoot);
            const stagedSnapshot = await new CanonicalFileRepository(stagingRoot).snapshot();
            await observePreparedMigrationTarget({
              repositoryRoot: stagingRoot,
              targetFormat,
              authenticatedFiles: [...stagedFiles.values()].map(({ path, bytes }) => ({
                path,
                length: bytes.byteLength,
                sha256: rawSha256(bytes),
              })),
              signal: access.signal,
            });
            await assertOwned();
            const marker: PendingProjectDataMigration = {
              apiVersion: "projector.pending-project-data-migration/v2",
              attemptId,
              migrationId: selection.manifest.id,
              sourceAuthority: selection.sourceAuthority,
              targetSnapshotHash: targetFormat.snapshotHash,
              manifestHash: selection.manifest.manifestHash,
              backup: {
                id: backup.backupId,
                location: backup.backupLocation,
                manifestHash: backup.manifestHash,
              },
              stagingLocation,
              phase: "backed-up",
              createdAt: new Date().toISOString(),
            };
            const pendingStore = new PendingProjectDataMigrationStore(repositoryRoot);
            await pendingStore.create(marker);
            const beforeState = StateDigestSchema.parse({
              gitBase: `project-data-migration:${selection.manifest.id}`,
              worktreeDigest: hashFramedDomain("project-data-migration-source-files/v1", backup.manifest.files),
              canonicalProjectorDigest: source.kind === "legacy-unversioned"
                ? hashFramedDomain("legacy-canonical-documents/v1", source.documents.map(({ id, canonicalDocumentHash }) => ({ id, canonicalDocumentHash })))
                : (await new CanonicalFileRepository(repositoryRoot).snapshot()).rootDigest,
              toolchainDigest: targetFormat.snapshotHash,
            }) as StateDigest;
            const journal = new FileTransactionJournal(paths);
            const transaction = await journal.begin({
              transactionId: attemptId,
              planId: selection.manifest.manifestHash,
              beforeState,
              intendedAfterCanonicalDigest: stagedSnapshot.rootDigest,
              allowedWriteRoots: [".projector"],
              pendingMigration: marker,
            });
            await pendingStore.transition(marker, "staged");
            const sourceFiles = new Map(backup.manifest.files.map((file) => [file.path, file]));
            for (const [path, staged] of [...stagedFiles].sort(([left], [right]) => left.localeCompare(right))) {
              if (path === ".projector/config.toml") continue;
              const prior = sourceFiles.get(path);
              if (prior?.length === staged.bytes.byteLength && prior.sha256 === rawSha256(staged.bytes)) continue;
              await transaction.writeFile(path, staged.bytes);
              await assertOwned();
            }
            for (const path of selection.retiredPaths) {
              if (sourceFiles.has(path)) await transaction.deleteFile(path);
              await assertOwned();
            }
            await pendingStore.transition(marker, "publishing");
            const config = stagedFiles.get(".projector/config.toml");
            if (config === undefined) throw new Error("Migration stage omits prepared config.toml");
            await transaction.writeFile(config.path, config.bytes);
            await assertOwned();
            for (const phase of ["workspace-staged", "validating", "canonical-staging", "committing"] as const) {
              await transaction.transition(phase);
            }
            await transaction.commit();
            committed = true;
            await assertOwned();
          } finally {
            await lease.release();
          }
        });
        const recovered = await createPreparedProjectDataMigrationRecoveryService({
          targetFormat,
          codexDataRoot: input.codexDataRoot,
        }).recover(repositoryRoot, request);
        if (recovered.status !== "reconciled") {
          throw new Error(recovered.status === "no-pending" ? "Committed migration lost its Pending marker" : recovered.reason);
        }
        return { status: "migrated", attemptId, migrationId: selection.manifest.id };
      } finally {
        if (!committed) {
          // A published Pending/journal is retained for authenticated recovery; staging is disposable only before effects.
          const pendingAfter = await new PendingProjectDataMigrationStore(repositoryRoot).read().catch(() => undefined);
          if (pendingAfter === undefined) await rm(stagingRoot, { recursive: true, force: true });
        } else {
          await rm(stagingRoot, { recursive: true, force: true });
        }
      }
    },
  };
}

type SelectedMigration = {
  manifest: { id: string; manifestHash: ContentHash };
  sourceAuthority: ProjectDataMigrationSourceAuthority;
  sourceFormat?: ProjectDataFormatSnapshot;
  transforms: readonly ProjectDataMigrationArtifactRef[];
  validations: readonly ProjectDataMigrationArtifactRef[];
  retiredPaths: readonly string[];
};

async function selectMigration(packagedRoot: string, repositoryRoot: string, target: ProjectDataFormatSnapshot): Promise<SelectedMigration | undefined> {
  const legacyPath = join(repositoryRoot, ".projector/config.json");
  if (await exists(legacyPath)) {
    const manifest = await readCanonicalFile(join(packagedRoot, "project-data/legacy-ingress.json"), ProjectDataLegacyIngressManifestSchema, "legacy ingress manifest");
    if (manifest.targetSnapshotHash !== target.snapshotHash) throw new Error("Legacy ingress does not target the packaged format");
    const source = await inspectLegacyUnversionedProjectData(repositoryRoot);
    if (source.descriptor.sourceHash !== manifest.source.sourceHash) throw new Error("Legacy source does not match the packaged ingress authority");
    return {
      manifest,
      sourceAuthority: { kind: "legacy-unversioned", sourceHash: manifest.source.sourceHash },
      transforms: manifest.transforms,
      validations: manifest.validations,
      retiredPaths: source.retiredPaths,
    };
  }
  const configSource = await readFile(join(repositoryRoot, ".projector/config.toml"), "utf8");
  const match = /^projectorVersion\s*=\s*"([^"]+)"/mu.exec(configSource);
  if (match === null) throw new Error("Prepared config omits projectorVersion");
  if (match[1] === target.packageIdentity.version) return undefined;
  const baseline = await readCanonicalFile(join(packagedRoot, "project-data/format-baseline.json"), ProjectDataFormatSnapshotSchema, "packaged format baseline");
  const chain = await readCanonicalFile(join(packagedRoot, `project-data/migrations/chain-through-${target.packageIdentity.version}.json`), ProjectDataMigrationChainSchema, "packaged migration chain");
  const manifest = chain.manifests.find((candidate) => candidate.fromVersion === match[1] && candidate.toVersion === target.packageIdentity.version);
  if (manifest === undefined || manifest.sourceSnapshotHash !== baseline.snapshotHash || manifest.targetSnapshotHash !== target.snapshotHash) {
    throw new Error(`Packaged migration chain does not connect ${match[1]} to ${target.packageIdentity.version}`);
  }
  return {
    manifest,
    sourceAuthority: { kind: "release-format", snapshotHash: baseline.snapshotHash },
    sourceFormat: baseline,
    transforms: manifest.kind === "transform" ? manifest.transforms : [],
    validations: manifest.kind === "transform" ? manifest.validations : [],
    retiredPaths: [],
  };
}

async function observeSource(
  repositoryRoot: string,
  selection: SelectedMigration,
  authenticatedFiles: readonly ProjectBackupManifestFile[],
  signal: AbortSignal,
): Promise<ProjectDataMigrationSourceObservation> {
  if (selection.sourceAuthority.kind === "legacy-unversioned") return inspectLegacyUnversionedProjectData(repositoryRoot);
  if (selection.sourceFormat === undefined) throw new Error("Released migration source format is unavailable");
  await observePreparedMigrationTarget({ repositoryRoot, targetFormat: selection.sourceFormat, authenticatedFiles, signal });
  return { kind: "release-format", snapshot: selection.sourceFormat };
}

async function runArtifacts(
  packagedRoot: string,
  references: readonly ProjectDataMigrationArtifactRef[],
  kind: "transform" | "validation",
  context: Parameters<Awaited<ReturnType<typeof loadProjectDataMigrationArtifact>>["run"]>[0],
): Promise<void> {
  for (const reference of references) {
    throwIfAborted(context.signal);
    const artifact = await loadProjectDataMigrationArtifact({ packagedRoot, expectedKind: kind, reference });
    await artifact.run(context);
  }
}

async function prepareStageFromBackup(repositoryRoot: string, stagingRoot: string, files: readonly ProjectBackupManifestFile[]): Promise<void> {
  for (const file of files) {
    const source = join(repositoryRoot, ...file.path.split("/"));
    const target = join(stagingRoot, ...file.path.split("/"));
    const bytes = await readStableFile(source);
    if (bytes.byteLength !== file.length || rawSha256(bytes) !== file.sha256) throw new Error(`Source changed after backup: ${file.path}`);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, { force: false, errorOnExist: true });
  }
}

async function mergeRetainedBackupFiles(
  repositoryRoot: string,
  stagingRoot: string,
  files: readonly ProjectBackupManifestFile[],
  retiredPaths: ReadonlySet<string>,
): Promise<void> {
  for (const file of files) {
    if (retiredPaths.has(file.path)) continue;
    const target = join(stagingRoot, ...file.path.split("/"));
    if (await exists(target)) continue;
    const source = join(repositoryRoot, ...file.path.split("/"));
    const bytes = await readStableFile(source);
    if (bytes.byteLength !== file.length || rawSha256(bytes) !== file.sha256) throw new Error(`Retained source changed after backup: ${file.path}`);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, { force: false, errorOnExist: true });
  }
}

async function inventoryProjectorFiles(root: string): Promise<Map<string, { path: string; bytes: Buffer }>> {
  const found = new Map<string, { path: string; bytes: Buffer }>();
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Migration stage contains a symbolic link: ${path}`);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        const relativePath = relative(root, path).replaceAll("\\", "/");
        found.set(relativePath, { path: relativePath, bytes: await readStableFile(path) });
      }
    }
  };
  await visit(join(root, ".projector"));
  return found;
}

async function readCanonicalFile<T>(path: string, schema: { parse(value: unknown): T }, label: string): Promise<T> {
  const source = (await readStableFile(path)).toString("utf8");
  const value = parseCanonicalJson(source);
  if (`${canonicalJson(value)}\n` !== source) throw new Error(`${label} does not use canonical JSON bytes`);
  return schema.parse(value);
}

async function readStableFile(path: string): Promise<Buffer> {
  const before = await lstat(path);
  if (!before.isFile() || before.isSymbolicLink()) throw new Error(`Expected a regular non-symlink file: ${path}`);
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (after.size !== before.size || after.mtimeMs !== before.mtimeMs || bytes.byteLength !== before.size) throw new Error(`File changed while reading: ${path}`);
    return bytes;
  } finally { await handle.close(); }
}

async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; }
  catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return false; throw error; }
}

function rawSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}
