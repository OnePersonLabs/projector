import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashFramedDomain, type ArchitectureDecision, type AuthorityRecord } from "@projector/core";
import { parseCanonicalSnapshotSources, withObservationScope } from "@projector/runtime";
import { afterEach, describe, expect, test } from "vitest";
import { DecisionBaselineReader } from "./decision-baselines.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });
const hash = hashFramedDomain("baseline-limit-test", "fixture");
const decision: ArchitectureDecision = { id: "decision:test", key: "test", concernId: "concern:test", title: "Test", decision: "Keep baseline evidence bounded.", selectedOptionKey: "bounded", scope: { op: "atom", field: "path", matcher: "glob", value: "src/**" }, lifecycle: "active", authorityRecordId: "authority:test", governanceBasis: [], consequences: [], appliedPreferences: [], supersedesDecisionIds: [], semanticHash: hash };
const authority: AuthorityRecord = { id: "authority:test", key: "test", subjectId: "concern:test", status: "approved", conclusion: "preserve", rationale: "Bounded observations.", alternatives: [], assumptions: [], reconsiderWhen: [], vector: { explicitDecisionAlignment: 1, productConstraintFit: 1, semanticFit: 1, independentOccurrence: 1, historicalStability: 1, independentValidationSupport: 1, boundaryCoherence: 1, maintenanceOutcome: 1, platformCompatibility: 1, externalRationale: 0, ecosystemHealth: 0, securitySupport: 0, reversibility: 1, migrationCost: 0, counterEvidence: 0 }, assessmentConfidence: "high", evidence: [], governanceRiskClass: "R1", decidedBy: "user", createdAt: "2026-09-09T00:00:00.000Z", semanticHash: hash };

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "projector-baseline-limits-"));
  roots.push(root);
  const directory = join(root, ".projector/runtime/change-lifecycles/results");
  await mkdir(directory, { recursive: true });
  return { root, directory, reader: new DecisionBaselineReader({ repositoryRoot: root, canonical: parseCanonicalSnapshotSources([]) }) };
}

describe("decision baseline secondary observation bounds", () => {
  test("does not turn an oversized receipt source into an unavailable baseline", async () => {
    const { reader, directory } = await fixture();
    await writeFile(join(directory, `${"a".repeat(64)}.json`), " ".repeat(512));
    await expect(withObservationScope({ limits: { maxFileBytes: 16 } }, () => reader.read(decision, authority)))
      .rejects.toMatchObject({ code: "observation-limit-exceeded", limit: "maxFileBytes" });
  });
  test("charges receipt enumeration to the original shared file allowance", async () => {
    const { reader, directory } = await fixture();
    await writeFile(join(directory, `${"a".repeat(64)}.json`), "{}");
    await writeFile(join(directory, `${"b".repeat(64)}.json`), "{}");
    await expect(withObservationScope({ limits: { maxFiles: 1 } }, () => reader.read(decision, authority)))
      .rejects.toMatchObject({ code: "observation-limit-exceeded", limit: "maxFiles" });
  });
  test("propagates cancellation that arrives inside an existing observation scope", async () => {
    const { reader } = await fixture();
    const controller = new AbortController();
    await expect(withObservationScope({ signal: controller.signal }, async () => {
      controller.abort(new Error("stop secondary reads"));
      return reader.read(decision, authority);
    })).rejects.toThrow(/cancel|stop secondary/u);
  });
  test("does not hide exhaustion of the shared Git-output allowance", async () => {
    const { reader } = await fixture();
    await expect(withObservationScope({ limits: { maxGitOutputBytes: 1 } }, () => reader.read(decision, authority)))
      .rejects.toMatchObject({ code: "observation-limit-exceeded", limit: "maxGitOutputBytes" });
  });
});
