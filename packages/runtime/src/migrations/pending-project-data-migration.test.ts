import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { canonicalJson, type ContentHash, type PendingProjectDataMigration } from "@projector/core";

import { PendingProjectDataMigrationStore } from "./pending-project-data-migration.js";

const roots: string[] = [];
const hashA = `sha256:v1:${"a".repeat(64)}` as ContentHash;
const hashB = `sha256:v1:${"b".repeat(64)}` as ContentHash;

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

async function fixture(): Promise<{ repositoryRoot: string; markerPath: string }> {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "projector-pending-migration-"));
  roots.push(repositoryRoot);
  await mkdir(join(repositoryRoot, ".projector"));
  return {
    repositoryRoot,
    markerPath: join(repositoryRoot, ".projector", "pending-project-data-migration.json"),
  };
}

function marker(phase: PendingProjectDataMigration["phase"] = "backed-up"): PendingProjectDataMigration {
  return {
    apiVersion: "projector.pending-project-data-migration/v2",
    attemptId: "migration-attempt:2.1.0:2.2.0:001",
    migrationId: "migration:2.1.0:2.2.0",
    sourceAuthority: { kind: "release-format", snapshotHash: hashA },
    targetSnapshotHash: hashB,
    manifestHash: hashA,
    backup: {
      id: "backup:2.1.0",
      location: { kind: "codex-data-relative", path: "projector/backups/published/backup-001" },
      manifestHash: hashB,
    },
    stagingLocation: ".projector.staging/2.2.0",
    phase,
    createdAt: "2026-09-10T12:00:00.000Z",
  };
}

function canonicalBytes(value: PendingProjectDataMigration): string {
  return `${canonicalJson(value)}\n`;
}

describe("pending project-data migration persistence", () => {
  test("creates canonical bytes exclusively and accepts only exact-byte idempotence", async () => {
    const { repositoryRoot, markerPath } = await fixture();
    const store = new PendingProjectDataMigrationStore(repositoryRoot);
    const expected = marker();

    expect(await store.create(expected)).toEqual(expected);
    expect(await readFile(markerPath, "utf8")).toBe(canonicalBytes(expected));
    expect(await store.create(expected)).toEqual(expected);
    await expect(new PendingProjectDataMigrationStore(repositoryRoot).create(marker("staged")))
      .rejects.toThrow(/begin in backed-up/i);

    await writeFile(markerPath, `${JSON.stringify(expected, null, 2)}\n`);
    await expect(store.create(expected)).rejects.toThrow(/unknown|exact/i);
    expect(await readFile(markerPath, "utf8")).toBe(`${JSON.stringify(expected, null, 2)}\n`);
  });

  test("performs direct monotonic identity-bound transitions and makes repeats idempotent", async () => {
    const { repositoryRoot } = await fixture();
    const store = new PendingProjectDataMigrationStore(repositoryRoot);
    await store.create(marker());
    const binding = { attemptId: marker().attemptId, migrationId: marker().migrationId, manifestHash: hashA };

    expect((await store.transition(binding, "staged")).phase).toBe("staged");
    expect((await store.transition(binding, "staged")).phase).toBe("staged");
    expect((await store.transition(binding, "publishing")).phase).toBe("publishing");
    await expect(store.transition(binding, "backed-up")).rejects.toThrow(/transition/i);
    await expect(store.transition({ ...binding, manifestHash: hashB }, "publishing")).rejects.toThrow(/identity/i);
    await expect(store.transition({ ...binding, attemptId: "migration-attempt:2.1.0:2.2.0:002" }, "publishing"))
      .rejects.toThrow(/identity/i);
  });

  test("leaves the prior durable phase readable when replacement is interrupted before publication", async () => {
    const { repositoryRoot, markerPath } = await fixture();
    const initialStore = new PendingProjectDataMigrationStore(repositoryRoot);
    await initialStore.create(marker());
    const interrupted = new PendingProjectDataMigrationStore(repositoryRoot, {
      crash: () => { throw new Error("simulated interruption"); },
    });

    await expect(interrupted.transition({
      attemptId: marker().attemptId,
      migrationId: marker().migrationId,
      manifestHash: hashA,
    }, "staged"))
      .rejects.toThrow(/simulated interruption/i);
    expect(await readFile(markerPath, "utf8")).toBe(canonicalBytes(marker()));
    expect(await new PendingProjectDataMigrationStore(repositoryRoot).read()).toEqual(marker());
  });

  test("leaves recognized bytes after namespace publication is interrupted before the post-publication file flush", async () => {
    const { repositoryRoot } = await fixture();
    const initialStore = new PendingProjectDataMigrationStore(repositoryRoot);
    await initialStore.create(marker());
    const interrupted = new PendingProjectDataMigrationStore(repositoryRoot, {
      crash: (point) => {
        if (point === "after-publication-before-flush") throw new Error("simulated post-publication interruption");
      },
    });

    await expect(interrupted.transition({
      attemptId: marker().attemptId,
      migrationId: marker().migrationId,
      manifestHash: hashA,
    }, "staged"))
      .rejects.toThrow(/simulated post-publication interruption/i);
    await expect(new PendingProjectDataMigrationStore(repositoryRoot).read()).resolves.toEqual(marker("staged"));
  });

  test("clears only the exact publishing marker after config-last publication", async () => {
    const { repositoryRoot, markerPath } = await fixture();
    const store = new PendingProjectDataMigrationStore(repositoryRoot);
    await store.create(marker());
    const binding = { attemptId: marker().attemptId, migrationId: marker().migrationId, manifestHash: hashA };
    await store.transition(binding, "staged");
    await store.transition(binding, "publishing");

    await expect(store.clearAfterReceiptPublication({ ...binding, manifestHash: hashB }))
      .rejects.toThrow(/identity/i);
    expect(await readFile(markerPath, "utf8")).toBe(canonicalBytes(marker("publishing")));
    await store.clearAfterReceiptPublication(binding);
    expect(await store.read()).toBeUndefined();
  });

  test("rejects malformed, oversized, and symbolic-link marker bytes without replacing them", async () => {
    const { repositoryRoot, markerPath } = await fixture();
    await mkdir(join(markerPath, ".."), { recursive: true });
    const store = new PendingProjectDataMigrationStore(repositoryRoot);
    await writeFile(markerPath, "not-json\n");
    await expect(store.read()).rejects.toThrow(/malformed|invalid/i);
    expect(await readFile(markerPath, "utf8")).toBe("not-json\n");

    await writeFile(markerPath, Buffer.alloc(65 * 1024, 0x20));
    await expect(store.read()).rejects.toThrow(/large|limit/i);

    await rm(markerPath);
    const outside = join(repositoryRoot, "outside.json");
    await writeFile(outside, canonicalBytes(marker()));
    await symlink(outside, markerPath, "file");
    await expect(store.read()).rejects.toThrow(/symbolic link/i);
    expect(await readFile(outside, "utf8")).toBe(canonicalBytes(marker()));
  });
});
