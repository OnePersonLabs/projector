import {
  hashFramedDomain,
  type ContentHash,
} from "@projector/core";
import { describe, expect, test } from "vitest";

import {
  compareProjectDataFormats,
  createProjectDataMigrationDraft,
  createReleaseCandidateProjectDataMigration,
  verifyProjectDataMigrationManifest,
} from "./project-data-migration-authoring.js";
import {
  canonicalOwnerModulePaths,
  createReleaseCandidateProjectDataFormat,
  preparedConfigOwnerModulePaths,
  runtimeEvidenceOwnerModulePaths,
  type ValidatedReleaseCandidateInventory,
} from "./project-data-format-owner.js";

const hash = (value: string): ContentHash => hashFramedDomain("migration-authoring-test/v1", value);

function candidate(version: string, extras: readonly { readonly path: string; readonly digest: ContentHash }[] = []): ValidatedReleaseCandidateInventory {
  const paths = [...new Set([...preparedConfigOwnerModulePaths, ...canonicalOwnerModulePaths, ...runtimeEvidenceOwnerModulePaths])].sort();
  return {
    packageIdentity: { name: "@onepersonlabs/projector", version },
    files: [...paths.map((path, index) => ({ path, digest: hash(`owner-${index}`) })), ...extras],
  };
}

const transform = { id: "transform:canonical-v3", relativePath: "migrations/canonical-v3.mjs", contentHash: hash("transform") } as const;
const custom = { id: "transform:custom-fixture", relativePath: "migrations/custom-fixture.mjs", contentHash: hash("custom") } as const;
const validation = { id: "validation:canonical-v3", relativePath: "migrations/validate-canonical-v3.mjs", contentHash: hash("validation") } as const;

describe("project-data migration authoring", () => {
  test("seals a version-only release as a no-data-change edge", () => {
    const source = createReleaseCandidateProjectDataFormat({ candidate: candidate("2.1.0") });
    const targetCandidate = candidate("2.2.0");
    const target = createReleaseCandidateProjectDataFormat({ candidate: targetCandidate });
    expect(compareProjectDataFormats(source, target)).toEqual([]);
    const draft = createProjectDataMigrationDraft({ sourceSnapshot: source, targetSnapshot: target });
    const manifest = createReleaseCandidateProjectDataMigration({
      id: "migration:2.1.0-to-2.2.0",
      draft,
      candidate: targetCandidate,
    });
    expect(manifest).toMatchObject({ kind: "no-data-change", fromVersion: "2.1.0", toVersion: "2.2.0" });
    expect(verifyProjectDataMigrationManifest(manifest)).toEqual(manifest);
  });

  test("preserves ordered transforms and validates their candidate bytes", () => {
    const source = createReleaseCandidateProjectDataFormat({ candidate: candidate("2.1.0") });
    const artifactFiles = [transform, custom, validation].map(({ relativePath: path, contentHash: digest }) => ({ path, digest }));
    const baseTarget = candidate("2.2.0", artifactFiles);
    const targetCandidate = {
      ...baseTarget,
      files: baseTarget.files.map((file) => file.path === canonicalOwnerModulePaths[0] ? { ...file, digest: hash("canonical-v3") } : file),
    };
    const target = createReleaseCandidateProjectDataFormat({ candidate: targetCandidate });
    expect(compareProjectDataFormats(source, target)).toEqual(["canonical"]);
    const draft = createProjectDataMigrationDraft({
      sourceSnapshot: source,
      targetSnapshot: target,
      operations: [transform],
      customTransforms: [custom],
      validations: [validation],
    });
    const manifest = createReleaseCandidateProjectDataMigration({
      id: "migration:2.1.0-to-2.2.0",
      draft,
      candidate: targetCandidate,
    });
    expect(manifest).toMatchObject({ kind: "transform", transforms: [transform, custom], validations: [validation] });
    expect(() => verifyProjectDataMigrationManifest({ ...manifest, targetSnapshotHash: source.snapshotHash })).toThrow(/manifestHash/u);
    expect(() => createReleaseCandidateProjectDataMigration({
      id: "migration:changed-artifact",
      draft,
      candidate: { ...targetCandidate, files: targetCandidate.files.filter((file) => file.path !== transform.relativePath) },
    })).toThrow(/absent or changed/iu);
    expect(() => createReleaseCandidateProjectDataMigration({
      id: "migration:wrong-release",
      draft,
      candidate: { ...targetCandidate, packageIdentity: { ...target.packageIdentity, version: "2.3.0" } },
    })).toThrow(/target release/iu);
    const staleTarget = createReleaseCandidateProjectDataFormat({ candidate: baseTarget });
    const staleDraft = createProjectDataMigrationDraft({ sourceSnapshot: source, targetSnapshot: staleTarget });
    expect(() => createReleaseCandidateProjectDataMigration({
      id: "migration:stale-target",
      draft: staleDraft,
      candidate: targetCandidate,
    })).toThrow(/candidate format.*target snapshot/iu);
  });

  test("rejects changed formats without executable transforms and validations", () => {
    const baseTarget = candidate("2.2.0");
    const targetCandidate = {
      ...baseTarget,
      files: baseTarget.files.map((file) => file.path === canonicalOwnerModulePaths[0] ? { ...file, digest: hash("changed-without-transform") } : file),
    };
    const draft = createProjectDataMigrationDraft({
      sourceSnapshot: createReleaseCandidateProjectDataFormat({ candidate: candidate("2.1.0") }),
      targetSnapshot: createReleaseCandidateProjectDataFormat({ candidate: targetCandidate }),
    });
    expect(() => createReleaseCandidateProjectDataMigration({
      id: "migration:unexecutable",
      draft,
      candidate: targetCandidate,
    })).toThrow(/ordered transforms and validations/iu);
  });
});
