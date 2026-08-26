import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { packedLifecycleSeveranceMode, verifyPackedLifecycleEvidence } from "./packed-lifecycle-acceptance.mjs";

const sortValue = (value) => Array.isArray(value) ? value.map(sortValue) : value !== null && typeof value === "object"
  ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortValue(item)]))
  : value;
const hash = (domain, value) => `sha256:v1:${createHash("sha256").update(`${domain}\0${JSON.stringify(sortValue(value))}`, "utf8").digest("hex")}`;

function trace() {
  const sequence = [["invoked", "change", null], ["completed", "change", 0], ["invoked", "plan", null], ["completed", "plan", 0], ["invoked", "approve", null], ["completed", "approve", 0], ["invoked", "apply", null], ["invoked", "recover", null], ["completed", "recover", 0], ["invoked", "resume", null], ["completed", "resume", 0], ["invoked", "resume", null], ["completed", "resume", 0]];
  let previousHash = null;
  return sequence.map(([phase, command, exitCode], index) => {
    const args = [command === "change" ? "held-out request" : "selector"];
    const body = {
      version: 1,
      phase,
      command,
      args,
      exitCode,
      invocationHash: hash("projector-agent-cli-invocation", { command, args }),
      outputHash: phase === "completed" ? hash("projector-agent-cli-output", { exitCode, output: { index } }) : null,
      diagnosticHash: phase === "completed" ? hash("projector-agent-cli-diagnostic", "") : null,
      previousHash,
      recordedAt: `2026-08-26T00:00:${String(index).padStart(2, "0")}.000Z`,
    };
    const entry = { ...body, entryHash: hash("projector-agent-trace-entry", body) };
    previousHash = entry.entryHash;
    return entry;
  });
}

function evidence() {
  return {
    version: 1,
    request: "Trim surrounding label whitespace while preserving existing callers.",
    sourceBoundary: { sourceAccessDenied: true, installedSymlinkCount: 0, pluginSourceReferenceCount: 0 },
    direct: { changeSelector: "semantic_change_abc", planHash: "sha256:v1:plan", planId: "plan_abc", predictedChangedPaths: ["src/format-label.mjs", "test/trim-label.test.mjs"] },
    pause: { status: "approval-required", changeSelector: "semantic_change_abc", planHash: "sha256:v1:plan" },
    approval: { status: "approved", approvalSelector: "lifecycle_approval_abc", planHash: "sha256:v1:plan", substitutedHashRejected: true },
    interruption: { signal: "SIGKILL", journalPhase: "validating", mutationObserved: true },
    recovery: { action: "rolled-back", exactBeforeRestored: true },
    result: {
      outcome: "success", approvalSelector: "lifecycle_approval_abc", planId: "plan_abc",
      certificateHash: `sha256:v1:${"c".repeat(64)}`, receiptHash: `sha256:v1:${"d".repeat(64)}`,
      predictedChangedPaths: ["src/format-label.mjs", "test/trim-label.test.mjs"],
      observedChangedPaths: ["src/format-label.mjs", "test/trim-label.test.mjs"],
      unexpectedChangedPaths: [], unexpectedChangedCanonicalIds: [], planningSurpriseIds: [], unknowns: [],
      independentExecutionSource: "immutable-captured-overlay", fixedPoint: true,
    },
    trace: trace(),
    fixtureMarkerAbsent: true,
  };
}

describe("packed held-out lifecycle evidence", () => {
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
});
