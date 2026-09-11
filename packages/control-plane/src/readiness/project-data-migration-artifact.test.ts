import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { loadProjectDataMigrationArtifact } from "./project-data-migration-artifact.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("packaged project-data migration artifacts", () => {
  test("loads only an exact-byte transform beneath the authenticated project-data package root", async () => {
    const packagedRoot = await mkdtemp(join(tmpdir(), "projector-migration-package-"));
    roots.push(packagedRoot);
    const relativePath = "project-data/migrations/artifacts/example-transform.mjs";
    const path = join(packagedRoot, ...relativePath.split("/"));
    await mkdir(join(path, ".."), { recursive: true });
    const source = [
      "export const projectDataMigrationArtifact = {",
      '  apiVersion: "projector.project-data-migration-artifact/v1",',
      '  id: "migration-artifact:example-transform",',
      '  kind: "transform",',
      '  async run() { return { apiVersion: "projector.project-data-migration-transform-result/v1", status: "prepared" }; },',
      "};",
      "",
    ].join("\n");
    await writeFile(path, source, "utf8");

    const artifact = await loadProjectDataMigrationArtifact({
      packagedRoot,
      expectedKind: "transform",
      reference: {
        id: "migration-artifact:example-transform",
        relativePath,
        contentHash: hashBytes(source),
      },
    });

    expect(artifact.id).toBe("migration-artifact:example-transform");
    await expect(artifact.run({} as never)).resolves.toEqual({
      apiVersion: "projector.project-data-migration-transform-result/v1",
      status: "prepared",
    });
  });

  test("rejects changed bytes, manifest identity drift, and invalid run results", async () => {
    const packagedRoot = await mkdtemp(join(tmpdir(), "projector-migration-package-"));
    roots.push(packagedRoot);
    const relativePath = "project-data/migrations/artifacts/example-transform.mjs";
    const path = join(packagedRoot, ...relativePath.split("/"));
    await mkdir(join(path, ".."), { recursive: true });
    const invalidResult = artifactSource("migration-artifact:example-transform", "transform", "{ status: 'prepared' }");
    await writeFile(path, invalidResult, "utf8");

    await expect(loadProjectDataMigrationArtifact({
      packagedRoot,
      expectedKind: "transform",
      reference: { id: "migration-artifact:example-transform", relativePath, contentHash: hashBytes(`${invalidResult}\n`) },
    })).rejects.toThrow(/content hash/i);

    const artifact = await loadProjectDataMigrationArtifact({
      packagedRoot,
      expectedKind: "transform",
      reference: { id: "migration-artifact:example-transform", relativePath, contentHash: hashBytes(invalidResult) },
    });
    await expect(artifact.run({} as never)).rejects.toThrow();

    await expect(loadProjectDataMigrationArtifact({
      packagedRoot,
      expectedKind: "validation",
      reference: { id: "migration-artifact:example-transform", relativePath, contentHash: hashBytes(invalidResult) },
    })).rejects.toThrow(/kind/i);
  });

  test("rejects refs outside the fixed packaged artifact directory", async () => {
    const packagedRoot = await mkdtemp(join(tmpdir(), "projector-migration-package-"));
    roots.push(packagedRoot);
    await expect(loadProjectDataMigrationArtifact({
      packagedRoot,
      expectedKind: "transform",
      reference: {
        id: "migration-artifact:example-transform",
        relativePath: "project-data/migrations/example-transform.mjs",
        contentHash: hashBytes("absent"),
      },
    })).rejects.toThrow(/outside/i);
  });
});

function artifactSource(id: string, kind: string, result: string): string {
  return [
    "export const projectDataMigrationArtifact = {",
    '  apiVersion: "projector.project-data-migration-artifact/v1",',
    `  id: ${JSON.stringify(id)},`,
    `  kind: ${JSON.stringify(kind)},`,
    `  async run() { return ${result}; },`,
    "};",
    "",
  ].join("\n");
}

function hashBytes(value: string): `sha256:v1:${string}` {
  return `sha256:v1:${createHash("sha256").update(value).digest("hex")}`;
}
