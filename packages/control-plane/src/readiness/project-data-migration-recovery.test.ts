import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  hashRootManifest,
  withCanonicalHashes,
  type ContentHash,
  type PendingProjectDataMigration,
  type StateDigest,
} from "@projector/core";
import {
  CanonicalFileRepository,
  FileTransactionJournal,
  PendingProjectDataMigrationStore,
  ProjectDataMigrationReceiptStore,
  RepositoryPathService,
  SqliteDerivedStore,
  createProjectBackup,
  rebuildDerivedStore,
  stringifyTomlDocument,
  WriterLeaseManager,
} from "@projector/runtime";
import { afterEach, describe, expect, test } from "vitest";

import { createPreparedProjectDataMigrationRecoveryService } from "../index.js";
import {
  canonicalOwnerModulePaths,
  createReleaseCandidateProjectDataFormat,
  preparedConfigOwnerModulePaths,
  runtimeEvidenceOwnerModulePaths,
  type ValidatedReleaseCandidateInventory,
} from "./project-data-format-owner.js";

const roots: string[] = [];
const hash = (digit: string) => `sha256:v1:${digit.repeat(64)}` as ContentHash;
const beforeState: StateDigest = {
  gitBase: "base",
  worktreeDigest: hash("d"),
  canonicalProjectorDigest: hash("e"),
  toolchainDigest: hash("f"),
};

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("prepared project-data migration recovery service", () => {
  test("holds both exclusions through exact target validation, receipt publication, and Pending clear", async () => {
    const fixture = await committedFixture();
    const service = createPreparedProjectDataMigrationRecoveryService({
      candidate: fixture.candidate,
      codexDataRoot: fixture.codexDataRoot,
    });

    await expect(service.recover(fixture.root, {
      requestId: "recovery-request",
      processId: process.pid,
    })).resolves.toMatchObject({
      status: "reconciled",
      attemptId: fixture.marker.attemptId,
      migrationId: fixture.marker.migrationId,
    });
    expect(await fixture.pending.read()).toBeUndefined();
    expect(await new ProjectDataMigrationReceiptStore(fixture.root).read(fixture.marker.attemptId))
      .toMatchObject({
        attemptId: fixture.marker.attemptId,
        migrationId: fixture.marker.migrationId,
        journalId: fixture.marker.attemptId,
      });
  });

  test("retains Pending when an untouched SQLite byte changes", async () => {
    const fixture = await committedFixture();
    await writeFile(join(fixture.root, ".projector", "state.db"), "changed");
    const service = createPreparedProjectDataMigrationRecoveryService({
      candidate: fixture.candidate,
      codexDataRoot: fixture.codexDataRoot,
    });

    await expect(service.recover(fixture.root, { requestId: "recovery-request", processId: process.pid }))
      .resolves.toMatchObject({ status: "recovery-required", reason: expect.stringMatching(/changed|state\.db/iu) });
    expect((await fixture.pending.read())?.phase).toBe("publishing");
  });

  test.each([
    ["retained runtime bytes change", ".projector/runtime/application-evidence/retained.bin", "changed"],
    ["legacy activation residue appears", ".projector/config.json", "{}\n"],
  ] as const)("retains Pending when %s", async (_label, relativePath, contents) => {
    const fixture = await committedFixture();
    await writeFile(join(fixture.root, ...relativePath.split("/")), contents);
    const service = serviceFor(fixture);
    await expect(service.recover(fixture.root, { requestId: "recovery-request", processId: process.pid }))
      .resolves.toMatchObject({ status: "recovery-required" });
    expect((await fixture.pending.read())?.phase).toBe("publishing");
  });

  test("does not clear Pending when the authenticated backup is missing", async () => {
    const fixture = await committedFixture();
    await rm(fixture.backupPath);
    const service = serviceFor(fixture);
    await expect(service.recover(fixture.root, { requestId: "recovery-request", processId: process.pid }))
      .resolves.toMatchObject({ status: "recovery-required", reason: expect.stringMatching(/backup/iu) });
    expect((await fixture.pending.read())?.phase).toBe("publishing");
  });

  test("does not race an existing governed writer", async () => {
    const fixture = await committedFixture();
    const manager = new WriterLeaseManager(await RepositoryPathService.create(fixture.root), { staleAfterMs: 30_000 });
    const held = await manager.acquire({
      sessionId: "ordinary-writer",
      processId: process.pid,
      stateBinding: {
        compiledAgainst: beforeState,
        valueDependencies: [],
        queryDependencies: [],
        dependencyDigest: hash("9"),
      },
    });
    try {
      const service = serviceFor(fixture);
      await expect(service.recover(fixture.root, { requestId: "recovery-request", processId: process.pid }))
        .rejects.toThrow(/lease is held/iu);
      expect((await fixture.pending.read())?.phase).toBe("publishing");
    } finally {
      await held.release();
    }
  });
});

async function committedFixture() {
  const root = await mkdtemp(join(tmpdir(), "projector-real-migration-recovery-"));
  roots.push(root);
  const codexDataRoot = join(root, "codex-data");
  await mkdir(join(root, ".projector"));
  await mkdir(codexDataRoot);
  await mkdir(join(root, ".projector", "runtime", "application-evidence"), { recursive: true });
  await writeFile(join(root, ".projector", "runtime", "application-evidence", "retained.bin"), "retained");
  const configBytes = stringifyTomlDocument({
    apiVersion: "projector.config/v1",
    enabled: true,
    projectorVersion: "2.1.0",
  });
  await writeFile(join(root, ".projector", "config.toml"), configBytes);
  const canonicalRepository = new CanonicalFileRepository(root);
  const document = concept();
  await canonicalRepository.write(document);
  const canonical = await canonicalRepository.snapshot();
  const store = new SqliteDerivedStore(join(root, ".projector", "state.db"));
  try { await rebuildDerivedStore(canonicalRepository, store); } finally { store.close(); }

  const backup = await createProjectBackup(
    { repositoryRoot: root, codexDataRoot },
    { createBackupId: () => "real-recovery", createTemporaryId: () => "real-recovery-temp" },
  );
  const candidate = candidateInventory();
  const targetFormat = createReleaseCandidateProjectDataFormat({ candidate });
  const marker: PendingProjectDataMigration = {
    apiVersion: "projector.pending-project-data-migration/v1",
    attemptId: "migration-attempt:real-recovery:001",
    migrationId: "migration:legacy-to-toml",
    sourceSnapshotHash: hash("1"),
    targetSnapshotHash: targetFormat.snapshotHash,
    manifestHash: hash("2"),
    backup: { id: backup.backupId, location: backup.backupLocation, manifestHash: backup.manifestHash },
    stagingLocation: ".projector/migration-stage",
    phase: "backed-up",
    createdAt: "2026-09-10T18:00:00.000Z",
  };
  const pending = new PendingProjectDataMigrationStore(root);
  await pending.create(marker);
  await pending.transition(marker, "staged");
  await pending.transition(marker, "publishing");
  const journal = new FileTransactionJournal(await RepositoryPathService.create(root));
  const transaction = await journal.begin({
    transactionId: marker.attemptId,
    planId: marker.manifestHash,
    beforeState,
    intendedAfterCanonicalDigest: hashRootManifest([{
      entityId: document.id,
      canonicalDocumentHash: document.canonicalDocumentHash,
    }]),
    allowedWriteRoots: [".projector"],
    pendingMigration: marker,
  });
  await transaction.writeFile(".projector/config.toml", configBytes);
  for (const phase of ["workspace-staged", "validating", "canonical-staging", "committing"] as const) {
    await transaction.transition(phase);
  }
  await transaction.commit();
  return { root, codexDataRoot, targetFormat, candidate, marker, pending, canonical, backupPath: backup.backupPath };
}

function serviceFor(fixture: Awaited<ReturnType<typeof committedFixture>>) {
  return createPreparedProjectDataMigrationRecoveryService({
    candidate: fixture.candidate,
    codexDataRoot: fixture.codexDataRoot,
  });
}

function candidateInventory(): ValidatedReleaseCandidateInventory {
  const paths = [...new Set([...preparedConfigOwnerModulePaths, ...canonicalOwnerModulePaths, ...runtimeEvidenceOwnerModulePaths])].sort();
  return {
    packageIdentity: { name: "@onepersonlabs/projector", version: "2.1.0" },
    files: paths.map((path, index) => ({ path, digest: hash(String(index % 10)) })),
  };
}

function concept() {
  return withCanonicalHashes({
    apiVersion: "projector/v2" as const,
    schemaVersion: "2.0.0",
    kind: "concept" as const,
    id: "concept:recovery",
    key: "concept:recovery",
    lifecycle: "active" as const,
    payload: {
      id: "concept:recovery",
      key: "concept:recovery",
      kind: "behavior" as const,
      name: "Recovery",
      aliases: [],
      statement: "Recovery observes the real target.",
      status: "active" as const,
      sourceClass: "authored" as const,
      confidence: 1,
      tags: [],
      evidence: [],
      discoveryHash: hash("0"),
      semanticHash: hash("0"),
    },
  });
}
