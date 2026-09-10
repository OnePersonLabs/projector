import {
  hashFramedDomain,
  hashProjectDataFormatSnapshot,
  type ContentHash,
  type ProjectDataFormatSnapshot,
} from "@projector/core";
import { describe, expect, test } from "vitest";

import {
  compareProjectDataFormats,
  createProjectDataMigrationDraft,
  createReleaseCandidateProjectDataMigration,
  verifyProjectDataMigrationManifest,
} from "./project-data-migration-authoring.js";

const hash = (value: string): ContentHash => hashFramedDomain("migration-authoring-test/v1", value);

function snapshot(version: string, changes: Partial<{
  canonicalHash: ContentHash;
  runtimeHash: ContentHash;
  sqliteVersion: number;
  sqliteHash: ContentHash;
}> = {}): ProjectDataFormatSnapshot {
  const body = {
    apiVersion: "projector.project-data-format-snapshot/v1" as const,
    packageIdentity: { name: "@onepersonlabs/projector", version },
    preparedConfig: { apiVersion: "projector.config/v1" as const, projectorVersion: version, schemaHash: hash("config") },
    canonical: { envelopeApiVersion: "projector/v2" as const, schemaBundleHash: changes.canonicalHash ?? hash("canonical") },
    runtimeEvidence: { schemaVersion: version, schemaHash: changes.runtimeHash ?? hash("runtime") },
    sqlite: { schemaVersion: changes.sqliteVersion ?? 1, migrationSetHash: changes.sqliteHash ?? hash("sqlite") },
  };
  return { ...body, snapshotHash: hashProjectDataFormatSnapshot(body) };
}

const transform = { id: "transform:canonical-v3", relativePath: "migrations/canonical-v3.mjs", contentHash: hash("transform") } as const;
const custom = { id: "transform:custom-fixture", relativePath: "migrations/custom-fixture.mjs", contentHash: hash("custom") } as const;
const validation = { id: "validation:canonical-v3", relativePath: "migrations/validate-canonical-v3.mjs", contentHash: hash("validation") } as const;

describe("project-data migration authoring", () => {
  test("seals a version-only release as a no-data-change edge", () => {
    const source = snapshot("2.1.0");
    const target = snapshot("2.2.0");
    expect(compareProjectDataFormats(source, target)).toEqual([]);
    const draft = createProjectDataMigrationDraft({ sourceSnapshot: source, targetSnapshot: target });
    const manifest = createReleaseCandidateProjectDataMigration({
      id: "migration:2.1.0-to-2.2.0",
      draft,
      candidate: { packageIdentity: target.packageIdentity, files: [] },
    });
    expect(manifest).toMatchObject({ kind: "no-data-change", fromVersion: "2.1.0", toVersion: "2.2.0" });
    expect(verifyProjectDataMigrationManifest(manifest)).toEqual(manifest);
  });

  test("preserves ordered transforms and validates their candidate bytes", () => {
    const source = snapshot("2.1.0");
    const target = snapshot("2.2.0", { canonicalHash: hash("canonical-v3") });
    expect(compareProjectDataFormats(source, target)).toEqual(["canonical"]);
    const draft = createProjectDataMigrationDraft({
      sourceSnapshot: source,
      targetSnapshot: target,
      operations: [transform],
      customTransforms: [custom],
      validations: [validation],
    });
    const files = [transform, custom, validation].map(({ relativePath: path, contentHash: digest }) => ({ path, digest }));
    const manifest = createReleaseCandidateProjectDataMigration({
      id: "migration:2.1.0-to-2.2.0",
      draft,
      candidate: { packageIdentity: target.packageIdentity, files },
    });
    expect(manifest).toMatchObject({ kind: "transform", transforms: [transform, custom], validations: [validation] });
    expect(() => verifyProjectDataMigrationManifest({ ...manifest, targetSnapshotHash: source.snapshotHash })).toThrow(/manifest hash/iu);
    expect(() => createReleaseCandidateProjectDataMigration({
      id: "migration:changed-artifact",
      draft,
      candidate: { packageIdentity: target.packageIdentity, files: files.slice(1) },
    })).toThrow(/absent or changed/iu);
    expect(() => createReleaseCandidateProjectDataMigration({
      id: "migration:wrong-release",
      draft,
      candidate: { packageIdentity: { ...target.packageIdentity, version: "2.3.0" }, files },
    })).toThrow(/target release/iu);
  });

  test("rejects changed formats without executable transforms and validations", () => {
    const draft = createProjectDataMigrationDraft({
      sourceSnapshot: snapshot("2.1.0"),
      targetSnapshot: snapshot("2.2.0", { sqliteVersion: 2, sqliteHash: hash("sqlite-v2") }),
    });
    expect(() => createReleaseCandidateProjectDataMigration({
      id: "migration:unexecutable",
      draft,
      candidate: { packageIdentity: draft.targetSnapshot.packageIdentity, files: [] },
    })).toThrow(/ordered transforms and validations/iu);
  });
});
