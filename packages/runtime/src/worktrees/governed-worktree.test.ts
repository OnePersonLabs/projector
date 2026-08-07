import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ContentHash, StateBinding, StateDigest } from "@projector/core";
import { describe, expect, it } from "vitest";

import { FileTransactionJournal } from "../journal/index.js";
import { RepositoryPathService } from "../security/index.js";
import { GovernedWorktreeRuntime, StateBoundMutationError } from "./governed-worktree.js";
import { WriterLeaseManager } from "./writer-lease.js";

const hash = `sha256:v1:${"3".repeat(64)}` as ContentHash;
const state: StateDigest = {
  gitBase: "base-revision",
  worktreeDigest: hash,
  canonicalProjectorDigest: hash,
  toolchainDigest: hash,
};
const binding: StateBinding = {
  compiledAgainst: state,
  valueDependencies: [],
  queryDependencies: [],
  dependencyDigest: hash,
};

describe("GovernedWorktreeRuntime", () => {
  it("requires the transaction state to match the snapshot held by its writer lease", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-governed-"));
    const paths = await RepositoryPathService.create(root);
    const runtime = new GovernedWorktreeRuntime(
      new WriterLeaseManager(paths, { staleAfterMs: 10_000 }),
      new FileTransactionJournal(paths),
    );
    const session = await runtime.open({ sessionId: "session-a", processId: 42, stateBinding: binding });
    const changedState = { ...state, gitBase: "different-revision" };

    await expect(
      session.begin({
        transactionId: "tx-stale",
        planId: "plan-1",
        beforeState: changedState,
        allowedWriteRoots: ["."],
      }),
    ).rejects.toBeInstanceOf(StateBoundMutationError);
    await session.close();
  });
});
