import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { createProjectDataMigrationReceipt, type ContentHash } from "@projector/core";

import { ProjectDataMigrationReceiptStore } from "./project-data-migration-receipt.js";

const roots: string[] = [];
const hash = (digit: string) => `sha256:v1:${digit.repeat(64)}` as ContentHash;

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "projector-migration-receipt-"));
  roots.push(root);
  await mkdir(join(root, ".projector"));
  return root;
}

function receipt() {
  return createProjectDataMigrationReceipt({
    apiVersion: "projector.project-data-migration-receipt/v2",
    attemptId: "migration-attempt:legacy-to-toml:001",
    migrationId: "migration:legacy-to-toml",
    manifestHash: hash("1"),
    sourceAuthority: { kind: "legacy-unversioned", sourceHash: hash("2") },
    targetSnapshotHash: hash("3"),
    journalId: "migration-attempt:legacy-to-toml:001",
    journalHash: hash("4"),
    backup: {
      id: "backup:legacy-to-toml",
      location: { kind: "codex-data-relative", path: "projector-backup-legacy-to-toml.bin" },
      manifestHash: hash("5"),
    },
    outcome: "completed",
    completedAt: "2026-09-10T18:00:00.000Z",
  });
}

describe("project-data migration receipt persistence", () => {
  test("publishes immutable canonical receipt bytes under the stable Projector root", async () => {
    const root = await fixture();
    const store = new ProjectDataMigrationReceiptStore(root);
    const expected = receipt();

    expect(await store.publish(expected)).toEqual(expected);
    expect(await store.publish(expected)).toEqual(expected);
    expect(await store.read(expected.attemptId)).toEqual(expected);
    expect(await readFile(store.pathFor(expected.attemptId), "utf8")).toContain(expected.receiptHash);
    await expect(store.publish({ ...expected, journalHash: hash("6") })).rejects.toThrow(/invalid|hash|different/i);
  });

  test("retries an interruption after namespace publication by flushing exact existing bytes", async () => {
    const root = await fixture();
    const expected = receipt();
    const interrupted = new ProjectDataMigrationReceiptStore(root, {
      crash: () => { throw new Error("simulated receipt interruption"); },
    });

    await expect(interrupted.publish(expected)).rejects.toThrow(/simulated receipt interruption/i);
    expect(await new ProjectDataMigrationReceiptStore(root).publish(expected)).toEqual(expected);
  });

  test("keeps separate receipt identities for repeated attempts of the same migration", async () => {
    const root = await fixture();
    const store = new ProjectDataMigrationReceiptStore(root);
    const first = receipt();
    const { receiptHash: _receiptHash, ...firstBody } = first;
    void _receiptHash;
    const second = createProjectDataMigrationReceipt({
      ...firstBody,
      attemptId: "migration-attempt:legacy-to-toml:002",
      journalId: "migration-attempt:legacy-to-toml:002",
    });

    expect(store.pathFor(first.attemptId)).not.toBe(store.pathFor(second.attemptId));
    await store.publish(first);
    await store.publish(second);
    expect(await store.read(first.attemptId)).toEqual(first);
    expect(await store.read(second.attemptId)).toEqual(second);
  });

  test("rejects malformed, oversized, and symbolic-link receipt bytes", async () => {
    const root = await fixture();
    const store = new ProjectDataMigrationReceiptStore(root);
    const path = store.pathFor(receipt().attemptId);
    await writeFile(path, "not-json\n");
    await expect(store.read(receipt().attemptId)).rejects.toThrow(/malformed|invalid/i);
    await writeFile(path, Buffer.alloc(65 * 1024));
    await expect(store.read(receipt().attemptId)).rejects.toThrow(/limit|large/i);
    await rm(path);
    const outside = join(root, "outside.json");
    await writeFile(outside, "{}\n");
    await symlink(outside, path, "file");
    await expect(store.read(receipt().attemptId)).rejects.toThrow(/symbolic link/i);
  });
});
