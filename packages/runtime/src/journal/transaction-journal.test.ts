import { chmod, mkdir, mkdtemp, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
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
    await expect(transaction.transition("committed")).rejects.toBeInstanceOf(InvalidJournalTransitionError);
  });

  it("does not let the public journal transition API bypass commit guards", async () => {
    const { journal } = await harness();
    const transaction = await journal.begin(beginInput("tx-transition-bypass"));
    await transaction.transition("workspace-mutating");
    await transaction.transition("workspace-staged");
    await transaction.transition("validating");
    await transaction.transition("canonical-staging");
    await transaction.transition("committing");
    const record = await journal.read("tx-transition-bypass");

    await expect(journal.transitionRecord(record, "committed")).rejects.toBeInstanceOf(
      InvalidJournalTransitionError,
    );
  });

  it("does not let the public journal transition API bypass rollback effects", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-transition-rollback-"));
    let crashed = false;
    const journal = await journalFor(root, (point) => {
      if (!crashed && point === "after-phase:rolling-back") {
        crashed = true;
        throw new Error("crash:rolling-back");
      }
    });
    const transaction = await journal.begin(beginInput("tx-rollback-transition-bypass"));
    await transaction.writeFile("sample.txt", "after");
    await expect(transaction.rollback()).rejects.toThrow("crash:rolling-back");
    const restarted = await journalFor(root);
    const record = await restarted.read("tx-rollback-transition-bypass");

    await expect(restarted.transitionRecord(record, "rolled-back")).rejects.toBeInstanceOf(
      InvalidJournalTransitionError,
    );
  });

  it.each([
    "prepared",
    "workspace-mutating",
    "workspace-staged",
    "validating",
    "canonical-staging",
    "committing",
  ] satisfies TransactionPhase[])("deterministically rolls back an interruption in %s", async (phase) => {
    const { root, journal } = await harness();
    await writeFile(join(root, "sample.txt"), "before");
    const transaction = await journal.begin(beginInput(`tx-${phase}`));

    if (phase !== "prepared") {
      await transaction.writeFile("sample.txt", "after");
    }
    if (phase !== "prepared" && phase !== "workspace-mutating") {
      for (const next of phasesAfterMutation) {
        await transaction.transition(next);
        if (phase === next) break;
      }
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

  it.each([
    "prepared",
    "workspace-mutating",
    "workspace-staged",
    "validating",
    "canonical-staging",
    "committing",
    "committed",
    "rolling-back",
    "rolled-back",
    "recovery-required",
  ] satisfies TransactionPhase[])("recovers a restart injected after authoritative phase %s", async (targetPhase) => {
    const root = await mkdtemp(join(tmpdir(), "projector-phase-crash-"));
    await writeFile(join(root, "workspace.txt"), "workspace-before");
    await mkdir(join(root, ".projector", "model"), { recursive: true });
    await writeFile(join(root, ".projector", "model", "canonical.json"), "canonical-before");
    let crashed = false;
    const journal = await journalFor(root, (point) => {
      if (!crashed && point === `after-phase:${targetPhase}`) {
        crashed = true;
        throw new Error(`crash:${targetPhase}`);
      }
    });

    try {
      const transaction = await journal.begin(beginInput(`tx-phase-${targetPhase}`));
      await transaction.writeFile("workspace.txt", "workspace-after");
      await transaction.writeFile(".projector/model/canonical.json", "canonical-after");
      if (targetPhase === "rolling-back" || targetPhase === "rolled-back") {
        await transaction.rollback();
      } else if (targetPhase === "recovery-required") {
        await transaction.recordCompensation({ externalOperationId: "remote-1", kind: "manual" });
        await journal.recoverIncomplete();
      } else {
        for (const phase of phasesAfterMutation) await transaction.transition(phase);
        await transaction.commit();
      }
    } catch (error) {
      expect(error).toEqual(new Error(`crash:${targetPhase}`));
    }
    expect(crashed).toBe(true);

    const restarted = await journalFor(root);
    const recovery = await restarted.recoverIncomplete();
    const workspace = await readFile(join(root, "workspace.txt"), "utf8");
    const canonical = await readFile(join(root, ".projector", "model", "canonical.json"), "utf8");
    if (targetPhase === "committed") {
      expect(recovery).toEqual([]);
      expect([workspace, canonical]).toEqual(["workspace-after", "canonical-after"]);
    } else if (targetPhase === "rolled-back") {
      expect(recovery).toEqual([]);
      expect([workspace, canonical]).toEqual(["workspace-before", "canonical-before"]);
    } else if (targetPhase === "recovery-required") {
      expect(recovery[0]).toMatchObject({ action: "recovery-required" });
      expect([workspace, canonical]).toEqual(["workspace-after", "canonical-after"]);
    } else {
      expect(recovery[0]).toMatchObject({ action: "rolled-back", priorPhase: targetPhase });
      expect([workspace, canonical]).toEqual(["workspace-before", "canonical-before"]);
    }
  });

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
    await transaction.commit();

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

  it("treats an unexplained mode change as a third state instead of overwriting it", async () => {
    const { root, journal } = await harness();
    const path = join(root, "sample.txt");
    await writeFile(path, "before");
    await chmod(path, 0o600);
    const transaction = await journal.begin(beginInput("tx-mode-change"));
    await transaction.writeFile("sample.txt", "planned-after");
    await chmod(path, 0o640);

    const [result] = await journal.recoverIncomplete();
    expect(result).toMatchObject({ action: "recovery-required" });
    expect(await readFile(path, "utf8")).toBe("planned-after");
    expect((await stat(path)).mode & 0o777).toBe(0o640);
  });

  it("restores the original mode together with file content during rollback", async () => {
    const { root, journal } = await harness();
    const path = join(root, "sample.txt");
    await writeFile(path, "before");
    await chmod(path, 0o600);
    const transaction = await journal.begin(beginInput("tx-mode-restore"));
    await transaction.writeFile("sample.txt", "after");

    await journal.recoverIncomplete();
    expect(await readFile(path, "utf8")).toBe("before");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
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

  it("refuses commit with pending compensation and persists manual recovery state", async () => {
    const { journal } = await harness();
    const transaction = await journal.begin(beginInput("tx-pending-commit"));
    await transaction.writeFile("sample.txt", "after");
    await transaction.recordCompensation({
      externalOperationId: "remote-write-1",
      kind: "manual",
      instructions: "Inspect and compensate the remote write",
    });
    for (const phase of phasesAfterMutation) await transaction.transition(phase);

    await expect(transaction.commit()).rejects.toBeInstanceOf(JournalRecoveryRequiredError);
    expect((await journal.read("tx-pending-commit")).entry.phase).toBe("recovery-required");
    const [recovery] = await journal.recoverIncomplete();
    expect(recovery).toMatchObject({
      transactionId: "tx-pending-commit",
      action: "recovery-required",
      reason: "Uncompensated external operation remote-write-1",
    });
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

  it("fails closed when persisted touched paths disagree with reversible operations", async () => {
    const { root, journal } = await harness();
    const transaction = await journal.begin(beginInput("tx-corrupt-path-index"));
    await transaction.writeFile("sample.txt", "after");
    const directory = join(root, ".projector", "runtime", "journal");
    const [name] = await readdir(directory);
    if (name === undefined) throw new Error("Expected a journal record");
    const path = join(directory, name);
    const record = JSON.parse(await readFile(path, "utf8"));
    record.entry.touchedPaths = [];
    await writeFile(path, JSON.stringify(record));

    await expect(journal.recoverIncomplete()).rejects.toBeInstanceOf(JournalRecoveryRequiredError);
  });

  it("fails closed when a journal filename does not match its transaction identity", async () => {
    const { root, journal } = await harness();
    const transaction = await journal.begin(beginInput("tx-renamed-record"));
    await transaction.writeFile("sample.txt", "after");
    const directory = join(root, ".projector", "runtime", "journal");
    const [name] = await readdir(directory);
    if (name === undefined) throw new Error("Expected a journal record");
    await rename(join(directory, name), join(directory, `${"0".repeat(64)}.json`));

    await expect(journal.recoverIncomplete()).rejects.toBeInstanceOf(JournalRecoveryRequiredError);
    expect(await readFile(join(root, "sample.txt"), "utf8")).toBe("after");
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
