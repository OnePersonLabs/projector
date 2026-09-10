import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { canonicalJson, hashFramedDomain } from "../packages/core/src/index.js";

import { terminateProcessTree, verifyPackedLifecycleEvidence } from "./packed-lifecycle-acceptance.mjs";

const sortValue = (value) => Array.isArray(value) ? value.map(sortValue) : value !== null && typeof value === "object"
  ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortValue(item)]))
  : value;
const hash = (domain, value) => `sha256:v1:${createHash("sha256").update(`${domain}\0${JSON.stringify(sortValue(value))}`, "utf8").digest("hex")}`;

function trace() {
  const sequence = [["invoked", "start", null], ["completed", "start", 3], ["invoked", "approve", null], ["completed", "approve", 2], ["invoked", "approve", null], ["completed", "approve", 0], ["invoked", "apply", null], ["invoked", "recover", null], ["completed", "recover", 0], ["invoked", "resume", null], ["completed", "resume", 0], ["invoked", "resume", null], ["completed", "resume", 0]];
  let previousHash = null;
  return sequence.map(([phase, command, exitCode], index) => {
    const args = command === "approve"
      ? ["--change", "semantic_change_abc", "--plan-hash", index === 2 || index === 3 ? "sha256:v1:substituted" : "sha256:v1:plan"]
      : ["selector"];
    const output = phase === "completed" ? JSON.stringify({ index }) : null;
    const diagnostic = phase === "completed" && exitCode !== 0 ? "approval requires the exact plan hash" : phase === "completed" ? "" : null;
    const body = {
      version: 1,
      phase,
      command,
      args,
      exitCode,
      invocationHash: hash("projector-agent-cli-invocation", { command, args }),
      output,
      diagnostic,
      outputHash: phase === "completed" ? hash("projector-agent-cli-output", { exitCode, stdout: output }) : null,
      diagnosticHash: phase === "completed" ? hash("projector-agent-cli-diagnostic", diagnostic) : null,
      previousHash,
      recordedAt: `2026-08-26T00:00:${String(index).padStart(2, "0")}.000Z`,
    };
    const entry = { ...body, entryHash: hash("projector-agent-trace-entry", body) };
    previousHash = entry.entryHash;
    return entry;
  });
}

function evidence() {
  const certificateArtifact = { version: 1, outcome: "success", certificate: { planId: "plan_abc" } };
  const certificateHash = hashFramedDomain("change-certificate-artifact", certificateArtifact);
  const receipt = { planId: "plan_abc", certificateHash };
  const receiptHash = hashFramedDomain("transaction-receipt-artifact", receipt);
  const sourceHash = hash("packed-lifecycle-source-bytes", "after");
  return {
    version: 1,
    runId: "01234567-89ab-4def-8123-456789abcdef",
    request: "Trim surrounding label whitespace while preserving existing callers.",
    activation: { initialized: true, projectEnabled: true, config: { apiVersion: "projector.config/v1", enabled: true } },
    artifactBoundary: { checkoutDependency: "none-declared", checkoutPathInput: null, checkoutAbsenceObservation: "not-claimed", installedSymlinkCount: 0, pluginSymlinkCount: 0, nodePathEmpty: true, execution: "trusted-host" },
    direct: { changeSelector: "semantic_change_abc", planHash: "sha256:v1:plan", planId: "plan_abc", predictedChangedPaths: ["src/format-label.mjs", "test/trim-label.test.mjs"] },
    pause: { status: "approval-required", changeSelector: "semantic_change_abc", planHash: "sha256:v1:plan" },
    approval: { status: "approved", approvalSelector: "lifecycle_approval_abc", planHash: "sha256:v1:plan" },
    interruption: process.platform === "win32"
      ? { terminationRequested: true, rootExitObserved: true, rootAbsentObserved: true, cleanupStatus: "reported-complete", cleanupStrategy: "windows-taskkill-tree", cleanupCommandExitCode: 0, journalPhase: "validating", mutationObserved: true }
      : { terminationRequested: true, rootExitObserved: true, rootAbsentObserved: true, cleanupStatus: "unconfirmed", cleanupStrategy: "posix-process-group-sigkill", cleanupReason: "escaped descendants cannot be confirmed absent", journalPhase: "validating", mutationObserved: true },
    recovery: { action: "rolled-back", exactBeforeRestored: true },
    result: {
      outcome: "success", approvalSelector: "lifecycle_approval_abc", planId: "plan_abc",
      certificateHash, receiptHash, certificateBytes: `${canonicalJson(certificateArtifact)}\n`, receiptBytes: `${canonicalJson(receipt)}\n`,
      predictedChangedPaths: ["src/format-label.mjs", "test/trim-label.test.mjs"],
      observedChangedPaths: ["src/format-label.mjs", "test/trim-label.test.mjs"],
      unexpectedChangedPaths: [], unexpectedChangedCanonicalIds: [], planningSurpriseIds: [], unknowns: [],
      independentExecutionSource: "exact-live-tracked-validator", fixedPoint: true,
    },
    independentOracle: { beforeExitCode: 1, afterExitCode: 0, gitObjectId: "a".repeat(40), expectedContentHash: "validator-hash", beforeContentHash: "validator-hash", afterContentHash: "validator-hash", executedContentHash: "validator-hash", executionSource: "exact-live-tracked-validator" },
    fixedPointRerun: { firstCertificateHash: certificateHash, secondCertificateHash: certificateHash, firstReceiptHash: receiptHash, secondReceiptHash: receiptHash, afterSourceHash: sourceHash, rerunSourceHash: sourceHash },
    trace: trace(),
  };
}

describe("packed held-out lifecycle evidence", () => {
  it("accepts one source-severed approval/interruption/recovery proof with closed impact", () => {
    expect(verifyPackedLifecycleEvidence(evidence())).toMatch(/^sha256:v1:[a-f0-9]{64}$/u);
  });

  it("rejects a broken trace chain or unexplained observed impact", () => {
    const brokenTrace = evidence();
    brokenTrace.trace[8].previousHash = "sha256:v1:tampered";
    expect(() => verifyPackedLifecycleEvidence(brokenTrace)).toThrow(/trace/iu);
    const surprise = evidence();
    surprise.result.observedChangedPaths.push("src/unapproved.mjs");
    expect(() => verifyPackedLifecycleEvidence(surprise)).toThrow(/impact|path/iu);
  });

  it("rejects source-presence claims and incomplete interrupted-process cleanup", () => {
    const checkoutPresent = evidence(); checkoutPresent.artifactBoundary.checkoutDependency = "declared";
    expect(() => verifyPackedLifecycleEvidence(checkoutPresent)).toThrow(/source|checkout|artifact/iu);
    const inheritedSource = evidence(); inheritedSource.artifactBoundary.nodePathEmpty = false;
    expect(() => verifyPackedLifecycleEvidence(inheritedSource)).toThrow(/NODE_PATH|source|artifact/iu);
    const incompleteCleanup = evidence(); incompleteCleanup.interruption.cleanupStatus = "unconfirmed"; delete incompleteCleanup.interruption.cleanupReason;
    expect(() => verifyPackedLifecycleEvidence(incompleteCleanup)).toThrow(/cleanup|interruption/iu);
  });

  it.runIf(process.platform === "win32")("observes the taskkill root absent before reporting Windows cleanup complete", async () => {
    const child = spawn(process.execPath, ["--eval", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
    if (child.pid === undefined) throw new Error("test child has no process identifier");
    const closed = once(child, "close");
    const cleanup = await terminateProcessTree(child.pid);
    await closed;
    expect(cleanup).toMatchObject({ strategy: "windows-taskkill-tree", cleanupCommandExitCode: 0, rootAbsentObserved: true, status: "reported-complete" });
  });

  it.runIf(process.platform !== "win32")("keeps cleanup unconfirmed when a descendant escapes the owned POSIX process group", async () => {
    const program = "const {spawn}=require('node:child_process'); const child=spawn(process.execPath,['--eval','setInterval(() => {}, 1000)'],{detached:true,stdio:'ignore'}); child.unref(); process.stdout.write(String(child.pid)+'\\n'); setInterval(() => {}, 1000);";
    const root = spawn(process.execPath, ["--eval", program], { detached: true, stdio: ["ignore", "pipe", "ignore"] });
    if (root.pid === undefined || root.stdout === null) throw new Error("test root has no process identifier or stdout");
    root.stdout.setEncoding("utf8");
    const [chunk] = await once(root.stdout, "data");
    const escapedProcessId = Number(String(chunk).trim());
    try {
      const closed = once(root, "close");
      const cleanup = await terminateProcessTree(root.pid);
      await closed;
      expect(cleanup).toMatchObject({ strategy: "posix-process-group-sigkill", status: "unconfirmed" });
      expect(cleanup.reason).toMatch(/escaped.*cannot be confirmed/iu);
      expect(() => process.kill(escapedProcessId, 0)).not.toThrow();
    } finally {
      try { process.kill(escapedProcessId, "SIGKILL"); } catch (error) { if (error?.code !== "ESRCH") throw error; }
    }
  });

  it("recomputes completion hashes and derives oracle/fixed-point outcomes instead of trusting flags", () => {
    const noncanonicalCertificate = evidence(); noncanonicalCertificate.result.certificateBytes += " ";
    expect(() => verifyPackedLifecycleEvidence(noncanonicalCertificate)).toThrow(/artifact bytes/iu);
    const corruptedCertificate = evidence(); const parsedCertificate = JSON.parse(corruptedCertificate.result.certificateBytes); parsedCertificate.certificate.planId = "forged"; corruptedCertificate.result.certificateBytes = `${canonicalJson(parsedCertificate)}\n`;
    expect(() => verifyPackedLifecycleEvidence(corruptedCertificate)).toThrow(/completion hash/iu);
    const corruptedReceipt = evidence(); corruptedReceipt.result.receiptBytes = `${canonicalJson({ planId: "forged", certificateHash: corruptedReceipt.result.certificateHash })}\n`;
    expect(() => verifyPackedLifecycleEvidence(corruptedReceipt)).toThrow(/completion hash/iu);
    const forgedFlags = evidence(); forgedFlags.result.fixedPoint = false; forgedFlags.result.independentExecutionSource = "caller-forged";
    expect(verifyPackedLifecycleEvidence(forgedFlags)).toMatch(/^sha256:v1:/u);
    const failedOracle = evidence(); failedOracle.independentOracle.beforeExitCode = 0;
    expect(() => verifyPackedLifecycleEvidence(failedOracle)).toThrow(/desired-behavior oracle/iu);
    const failedRerun = evidence(); failedRerun.fixedPointRerun.secondReceiptHash = `sha256:v1:${"f".repeat(64)}`;
    expect(() => verifyPackedLifecycleEvidence(failedRerun)).toThrow(/fixed-point rerun/iu);
  });

  it("derives substituted plan-hash rejection from authenticated command evidence", () => {
    const forgedFlag = evidence();
    forgedFlag.approval.substitutedHashRejected = true;
    expect(verifyPackedLifecycleEvidence(forgedFlag)).toMatch(/^sha256:v1:/u);

    const missingNegative = evidence();
    missingNegative.trace.splice(2, 2);
    rechain(missingNegative.trace);
    expect(() => verifyPackedLifecycleEvidence(missingNegative)).toThrow(/substituted|approval trace|interrupted invocation/iu);

    const falseNegative = evidence();
    falseNegative.trace[3].exitCode = 0;
    falseNegative.trace[3].diagnostic = "";
    rechain(falseNegative.trace);
    expect(() => verifyPackedLifecycleEvidence(falseNegative)).toThrow(/substituted|approval trace/iu);
  });
});

function rechain(entries) {
  let previousHash = null;
  for (const entry of entries) {
    entry.previousHash = previousHash;
    if (entry.phase === "completed") {
      entry.outputHash = hash("projector-agent-cli-output", { exitCode: entry.exitCode, stdout: entry.output });
      entry.diagnosticHash = hash("projector-agent-cli-diagnostic", entry.diagnostic);
    }
    const { entryHash: omitted, ...body } = entry; void omitted;
    entry.entryHash = hash("projector-agent-trace-entry", body);
    previousHash = entry.entryHash;
  }
}
