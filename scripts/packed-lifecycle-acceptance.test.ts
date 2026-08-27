import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson, hashFramedDomain } from "../packages/core/src/index.js";

import * as packedLifecycle from "./packed-lifecycle-acceptance.mjs";

const { packedLifecycleSeveranceMode, verifyPackedLifecycleEvidence } = packedLifecycle;

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
    sourceBoundary: { sourceAccessDenied: true, installedSymlinkCount: 0, pluginSourceReferenceCount: 0 },
    direct: { changeSelector: "semantic_change_abc", planHash: "sha256:v1:plan", planId: "plan_abc", predictedChangedPaths: ["src/format-label.mjs", "test/trim-label.test.mjs"] },
    pause: { status: "approval-required", changeSelector: "semantic_change_abc", planHash: "sha256:v1:plan" },
    approval: { status: "approved", approvalSelector: "lifecycle_approval_abc", planHash: "sha256:v1:plan" },
    interruption: { signal: "SIGKILL", journalPhase: "validating", mutationObserved: true },
    recovery: { action: "rolled-back", exactBeforeRestored: true },
    result: {
      outcome: "success", approvalSelector: "lifecycle_approval_abc", planId: "plan_abc",
      certificateHash, receiptHash, certificateBytes: `${canonicalJson(certificateArtifact)}\n`, receiptBytes: `${canonicalJson(receipt)}\n`,
      predictedChangedPaths: ["src/format-label.mjs", "test/trim-label.test.mjs"],
      observedChangedPaths: ["src/format-label.mjs", "test/trim-label.test.mjs"],
      unexpectedChangedPaths: [], unexpectedChangedCanonicalIds: [], planningSurpriseIds: [], unknowns: [],
      independentExecutionSource: "immutable-captured-overlay", fixedPoint: true,
    },
    independentOracle: { beforeExitCode: 1, afterExitCode: 0, gitObjectId: "a".repeat(40), expectedContentHash: "validator-hash", beforeContentHash: "validator-hash", afterContentHash: "validator-hash", executedContentHash: "validator-hash", executionSource: "immutable-captured-overlay" },
    fixedPointRerun: { firstCertificateHash: certificateHash, secondCertificateHash: certificateHash, firstReceiptHash: receiptHash, secondReceiptHash: receiptHash, afterSourceHash: sourceHash, rerunSourceHash: sourceHash },
    trace: trace(),
    fixtureMarkerAbsent: true,
  };
}

describe("packed held-out lifecycle evidence", () => {
  it("closes the actual namespace keeper instead of only its launcher", async () => {
    const launcher = spawn("/bin/sh", ["-c", "sleep 120 & printf '%s\\n' \"$!\"; wait"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const [chunk] = await once(launcher.stdout, "data");
    const namespaceProcessId = String(chunk).trim();
    const completed = once(launcher, "exit");
    try {
      const closeNamespaceKeeper = Reflect.get(packedLifecycle, "closePackedLifecycleNamespaceKeeper");
      expect(typeof closeNamespaceKeeper).toBe("function");
      if (typeof closeNamespaceKeeper !== "function") return;

      await closeNamespaceKeeper({
        namespaceProcessId,
        keeper: { child: launcher, completed },
        signalProcess: async (processId, signal) => { process.kill(Number(processId), signal); },
      });

      expect(() => process.kill(Number(namespaceProcessId), 0)).toThrow();
      expect(launcher.exitCode === null && launcher.signalCode === null).toBe(false);
    } finally {
      try { process.kill(Number(namespaceProcessId), "SIGKILL"); } catch { /* already closed */ }
      if (launcher.exitCode === null && launcher.signalCode === null) launcher.kill("SIGKILL");
      await completed;
    }
  });

  it("launches nsenter in the hosted repository working directory", () => {
    const repository = mkdtempSync(join(tmpdir(), "projector-nsenter-cwd-"));
    try {
      const buildWorkingDirectoryArguments = Reflect.get(packedLifecycle, "packedLifecycleNsenterWorkingDirectoryArguments");
      const workingDirectoryArguments = typeof buildWorkingDirectoryArguments === "function"
        ? buildWorkingDirectoryArguments(repository)
        : [];
      const result = spawnSync("/usr/bin/nsenter", [
        "--target", String(process.pid), ...workingDirectoryArguments, "--", "/usr/bin/pwd",
      ], { cwd: process.cwd(), encoding: "utf8" });

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout.trim()).toBe(repository);
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  it("uses a host mount namespace on GitHub Actions to preserve the inner sandbox boundary", () => {
    expect(packedLifecycleSeveranceMode({ GITHUB_ACTIONS: "true" })).toBe("host-mount-namespace");
    expect(packedLifecycleSeveranceMode({})).toBe("bubblewrap");
  });

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
