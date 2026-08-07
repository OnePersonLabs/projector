import { mkdtemp, mkdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ContentHash, StateBinding, StateDigest } from "@projector/core";
import { describe, expect, it } from "vitest";

import { RepositoryPathService } from "../security/index.js";
import { LeaseConflictError, WriterLeaseManager } from "./writer-lease.js";

const hash = `sha256:v1:${"1".repeat(64)}` as ContentHash;
const state: StateDigest = {
  gitBase: "base-revision",
  worktreeDigest: hash,
  canonicalProjectorDigest: hash,
  toolchainDigest: hash,
};
const stateBinding: StateBinding = {
  compiledAgainst: state,
  valueDependencies: [],
  queryDependencies: [],
  dependencyDigest: hash,
};

describe("WriterLeaseManager", () => {
  it("allows at most one writer and permits acquisition after explicit release", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-lease-"));
    const manager = await leaseManager(root);
    const first = await manager.acquire(owner("session-a"));

    await expect(manager.acquire(owner("session-b"))).rejects.toBeInstanceOf(LeaseConflictError);
    await first.release();
    const second = await manager.acquire(owner("session-b"));
    expect(second.record.sessionId).toBe("session-b");
    await second.release();
  });

  it("durably records owner identity, state binding, and compiled snapshot identity", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-lease-"));
    const manager = await leaseManager(root);
    const lease = await manager.acquire(owner("session-a"));

    const record = JSON.parse(
      await readFile(join(root, ".projector", "runtime", "writer-lease.lock", "owner.json"), "utf8"),
    );
    expect(record).toMatchObject({
      version: 1,
      sessionId: "session-a",
      processId: 42,
      stateBinding,
      compiledAgainstSnapshot: state,
    });
    await lease.release();
  });

  it("recovers a stale lease but the displaced owner cannot release the replacement", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-lease-"));
    let now = new Date("2026-08-07T12:00:00.000Z");
    const paths = await RepositoryPathService.create(root);
    const manager = new WriterLeaseManager(paths, {
      staleAfterMs: 1_000,
      now: () => now,
    });
    const displaced = await manager.acquire(owner("session-a"));
    now = new Date("2026-08-07T12:00:02.000Z");
    const replacement = await manager.acquire(owner("session-b"));

    await expect(displaced.heartbeat()).rejects.toMatchObject({ code: "lease-lost" });
    await expect(displaced.release()).rejects.toMatchObject({ code: "lease-lost" });
    await expect(manager.acquire(owner("session-c"))).rejects.toMatchObject({ code: "lease-held" });
    await replacement.release();
  });

  it("refuses to place its lease through a symlinked runtime directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-lease-"));
    const outside = await mkdtemp(join(tmpdir(), "projector-outside-"));
    await mkdir(join(root, ".projector"));
    await symlink(outside, join(root, ".projector", "runtime"), "dir");
    const manager = await leaseManager(root);

    await expect(manager.acquire(owner("session-a"))).rejects.toMatchObject({ code: "symlink-refused" });
  });

  it("fails closed on a path-unsafe persisted lease ID before stale archival", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-lease-"));
    let now = new Date("2026-08-07T12:00:00.000Z");
    const paths = await RepositoryPathService.create(root);
    const manager = new WriterLeaseManager(paths, { staleAfterMs: 1_000, now: () => now });
    await manager.acquire(owner("session-a"));
    const ownerPath = join(root, ".projector", "runtime", "writer-lease.lock", "owner.json");
    const record = JSON.parse(await readFile(ownerPath, "utf8"));
    record.leaseId = "../../../stolen";
    await writeFile(ownerPath, JSON.stringify(record));
    now = new Date("2026-08-07T12:00:02.000Z");

    await expect(manager.acquire(owner("session-b"))).rejects.toMatchObject({ code: "lease-corrupt" });
    expect((await stat(join(root, ".projector", "runtime", "writer-lease.lock"))).isDirectory()).toBe(true);
    await expect(stat(join(root, "stolen"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});

async function leaseManager(root: string): Promise<WriterLeaseManager> {
  const paths = await RepositoryPathService.create(root);
  return new WriterLeaseManager(paths, { staleAfterMs: 10_000 });
}

function owner(sessionId: string) {
  return { sessionId, processId: 42, stateBinding };
}
