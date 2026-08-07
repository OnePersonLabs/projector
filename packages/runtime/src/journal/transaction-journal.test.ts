import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ContentHash, StateDigest, TransactionPhase } from "@projector/core";
import { describe, expect, it } from "vitest";

import { RepositoryPathService } from "../security/index.js";
import {
  FileTransactionJournal,
  InvalidJournalTransitionError,
  JournalRecoveryRequiredError,
  type JournalCrashPoint,
} from "./transaction-journal.js";

const hash = `sha256:v1:${"2".repeat(64)}` as ContentHash;
const beforeState: StateDigest = {
  gitBase: "base-revision",
  worktreeDigest: hash,
  canonicalProjectorDigest: hash,
  toolchainDigest: hash,
};

describe("FileTransactionJournal", () => {
  it("enforces the normative forward phase order", async () => {
    const { journal } = await harness();
    const transaction = await journal.begin(beginInput("tx-order"));

    await expect(transaction.transition("validating")).rejects.toBeInstanceOf(InvalidJournalTransitionError);
    await transaction.transition("workspace-mutating");
    await transaction.transition("workspace-staged");
    await transaction.transition("validating");
    await transaction.transition("canonical-staging");
    await transaction.transition("committing");
    await transaction.transition("committed");
    await expect(transaction.transition("rolling-back")).rejects.toBeInstanceOf(InvalidJournalTransitionError);
  });

  it.each([
    "prepared",
    "workspace-mutating",
    "workspace-staged",
    "validating",
    "canonical-staging",
    "committing",
    "rolling-back",
  ] satisfies TransactionPhase[])("deterministically rolls back an interruption in %s", async (phase) => {
    const { root, journal } = await harness();
    await writeFile(join(root, "sample.txt"), "before");
    const transaction = await journal.begin(beginInput(`tx-${phase}`));

    if (phase !== "prepared") {
      await transaction.writeFile("sample.txt", "after");
    }
    if (phase !== "prepared" && phase !== "workspace-mutating" && phase !== "rolling-back") {
      for (const next of phasesAfterMutation) {
        await transaction.transition(next);
        if (phase === next) break;
      }
    }
    if (phase === "rolling-back") {
      await transaction.transition("rolling-back");
    }

    const restarted = await journalFor(root);
    const [result] = await restarted.recoverIncomplete();
    expect(result).toMatchObject({ transactionId: `tx-${phase}`, action: "rolled-back" });
    expect(await readFile(join(root, "sample.txt"), "utf8")).toBe("before");
    expect((await restarted.read(`tx-${phase}`)).entry.phase).toBe("rolled-back");
  });

  it.each(["after-operation-intent", "after-operation-apply"] satisfies JournalCrashPoint[])(
    "recovers a crash at %s without guessing whether the write happened",
    async (crashPoint) => {
      const root = await mkdtemp(join(tmpdir(), "projector-journal-"));
      await writeFile(join(root, "sample.txt"), "before");
      let injected = false;
      const journal = await journalFor(root, (point) => {
        if (!injected && point === crashPoint) {
          injected = true;
          throw new Error(`crash:${point}`);
        }
      });
      const transaction = await journal.begin(beginInput(`tx-${crashPoint}`));
      await expect(transaction.writeFile("sample.txt", "after")).rejects.toThrow(`crash:${crashPoint}`);

      const restarted = await journalFor(root);
      await restarted.recoverIncomplete();
      expect(await readFile(join(root, "sample.txt"), "utf8")).toBe("before");
    },
  );

  it("leaves a complete prepared record when creation crashes after claiming the transaction ID", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-journal-"));
    const journal = await journalFor(root, (point) => {
      if (String(point) === "after-new-record-claim") throw new Error("crash:new-record");
    });

    await expect(journal.begin(beginInput("tx-create-crash"))).rejects.toThrow("crash:new-record");
    const restarted = await journalFor(root);
    expect((await restarted.read("tx-create-crash")).entry.phase).toBe("prepared");
    await restarted.recoverIncomplete();
    expect((await restarted.read("tx-create-crash")).entry.phase).toBe("rolled-back");
  });

  it("resumes a rollback interrupted after entering rolling-back", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-journal-"));
    await writeFile(join(root, "sample.txt"), "before");
    let injected = false;
    const journal = await journalFor(root, (point) => {
      if (!injected && point === "after-phase:rolling-back") {
        injected = true;
        throw new Error("crash:rollback");
      }
    });
    const transaction = await journal.begin(beginInput("tx-rollback-crash"));
    await transaction.writeFile("sample.txt", "after");
    await expect(transaction.rollback()).rejects.toThrow("crash:rollback");

    const restarted = await journalFor(root);
    await restarted.recoverIncomplete();
    expect(await readFile(join(root, "sample.txt"), "utf8")).toBe("before");
    expect((await restarted.read("tx-rollback-crash")).entry.phase).toBe("rolled-back");
  });

  it("does not recover or roll back a committed transaction", async () => {
    const { root, journal } = await harness();
    const transaction = await journal.begin(beginInput("tx-committed"));
    await transaction.writeFile("sample.txt", "committed");
    for (const phase of phasesAfterMutation) await transaction.transition(phase);
    await transaction.transition("committed");

    expect(await journal.recoverIncomplete()).toEqual([]);
    expect(await readFile(join(root, "sample.txt"), "utf8")).toBe("committed");
  });

  it("restores overwritten moves, deletions, and newly created files in reverse order", async () => {
    const { root, journal } = await harness();
    await writeFile(join(root, "source.txt"), "source-before");
    await writeFile(join(root, "destination.txt"), "destination-before");
    await writeFile(join(root, "deleted.txt"), "deleted-before");
    const transaction = await journal.begin(beginInput("tx-mixed-files"));
    await transaction.moveFile("source.txt", "destination.txt");
    await transaction.deleteFile("deleted.txt");
    await transaction.writeFile("created.txt", "created-after");

    const [result] = await journal.recoverIncomplete();
    expect(result?.action).toBe("rolled-back");
    expect(await readFile(join(root, "source.txt"), "utf8")).toBe("source-before");
    expect(await readFile(join(root, "destination.txt"), "utf8")).toBe("destination-before");
    expect(await readFile(join(root, "deleted.txt"), "utf8")).toBe("deleted-before");
    await expect(readFile(join(root, "created.txt"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("requires intervention when a touched file matches neither durable snapshot", async () => {
    const { root, journal } = await harness();
    await writeFile(join(root, "sample.txt"), "before");
    const transaction = await journal.begin(beginInput("tx-unexplained"));
    await transaction.writeFile("sample.txt", "planned-after");
    await writeFile(join(root, "sample.txt"), "unexplained-third-state");

    const [result] = await journal.recoverIncomplete();
    expect(result).toMatchObject({ action: "recovery-required" });
    expect(await readFile(join(root, "sample.txt"), "utf8")).toBe("unexplained-third-state");
    expect((await journal.read("tx-unexplained")).entry.phase).toBe("recovery-required");
  });

  it("records checkpoints and requires intervention for an uncompensated external operation", async () => {
    const { journal } = await harness();
    const transaction = await journal.begin(beginInput("tx-external"));
    await transaction.checkpoint("before-api-call");
    await transaction.recordCompensation({
      externalOperationId: "api-call-1",
      kind: "manual",
      instructions: "Reverse the remote change",
    });

    const [result] = await journal.recoverIncomplete();
    expect(result).toMatchObject({ action: "recovery-required", lastCheckpointId: "before-api-call" });
    const record = await journal.read("tx-external");
    expect(record.entry).toMatchObject({
      phase: "recovery-required",
      checkpointIds: ["before-api-call"],
      externalOperationIds: ["api-call-1"],
    });
    expect(record.compensations).toEqual([
      expect.objectContaining({ externalOperationId: "api-call-1", status: "pending" }),
    ]);
  });

  it("fails closed instead of interpreting a corrupt journal phase", async () => {
    const { root, journal } = await harness();
    await journal.begin(beginInput("tx-corrupt"));
    const directory = join(root, ".projector", "runtime", "journal");
    const [name] = await readdir(directory);
    if (name === undefined) throw new Error("Expected a journal record");
    const path = join(directory, name);
    const record = JSON.parse(await readFile(path, "utf8"));
    record.entry.phase = "invented-phase";
    await writeFile(path, JSON.stringify(record));

    await expect(journal.recoverIncomplete()).rejects.toBeInstanceOf(JournalRecoveryRequiredError);
  });
});

const phasesAfterMutation = [
  "workspace-staged",
  "validating",
  "canonical-staging",
  "committing",
] as const;

async function harness() {
  const root = await mkdtemp(join(tmpdir(), "projector-journal-"));
  return { root, journal: await journalFor(root) };
}

async function journalFor(root: string, crash?: (point: JournalCrashPoint) => void) {
  const paths = await RepositoryPathService.create(root);
  return new FileTransactionJournal(paths, {
    now: () => new Date("2026-08-07T12:00:00.000Z"),
    ...(crash === undefined ? {} : { crash }),
  });
}

function beginInput(transactionId: string) {
  return {
    transactionId,
    planId: "plan-1",
    beforeState,
    allowedWriteRoots: ["."],
  };
}
