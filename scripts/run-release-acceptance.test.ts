import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import * as runtime from "@projector/runtime";
import * as controlPlane from "@projector/control-plane";
import { describe, expect, it } from "vitest";
import * as core from "@projector/core";
import * as engine from "@projector/engine";
// @ts-expect-error release entrypoint is an executable JavaScript module
import { verifyRepresentationProjection, observeInstalledRepresentationLinks, observeRepresentationProfileRecovery } from "./run-release-acceptance.mjs";

const id = "scenario:verify-representation-end-to-end-closure";
const owner = { id, title: "Preserve representation closure", steps: [
  { role: "precondition", statement: "An approved canonical owner exists." },
  { role: "trigger", statement: "Compile the owner's complete conditions." },
  { role: "expected-outcome", statement: "Preserve every required outcome." },
  { role: "forbidden-outcome", statement: "Do not weaken the authorization boundary." },
] };
const inventory = [{ id, owner, title: owner.title, semanticHash: core.hashFramedDomain("fixture-owner", owner), legacyIds: ["scenario:56:representation"] }];
const input = { core, engine, inventory, sourceRevision: "fixture-revision", worktreeDigest: core.hashFramedDomain("fixture-worktree", "test") };

describe("release representation observations", () => {
  it("exercises public profile recovery and three rejection controls without claiming packaged delivery", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-release-profile-"));
    try {
      await mkdir(join(root, "src")); await mkdir(join(root, "test"));
      const before = "export const greet = () => 'hello';\n";
      await writeFile(join(root, "package.json"), '{"type":"module"}\n');
      await writeFile(join(root, "src/greeting.mjs"), before);
      await writeFile(join(root, "test/greeting.test.mjs"), "import assert from 'node:assert/strict'; import { greet } from '../src/greeting.mjs'; assert.equal(greet('Ada'), 'hello Ada');\n");
      const requirement = { key: "greeting", title: "Greeting", statement: "The greeting includes the supplied name.", aliases: [] };
      const scenario = { key: "greet-name", title: "Greet a name", steps: [{ role: "precondition", statement: "A caller supplies a name." }, { role: "trigger", statement: "The caller requests a greeting." }, { role: "expected-outcome", statement: "The greeting includes that name." }] };
      for (const [kind, record] of [["requirement", requirement], ["behavioral-scenario", scenario]] as const) {
        const id = (kind === "requirement" ? "requirement:" : "scenario:") + record.key;
        const placeholder = core.hashFramedDomain("release-profile-fixture", null);
        const payload = { ...record, id, aliases: [], status: "active", sourceClass: "authored", scope: { op: "atom", field: "path", matcher: "equals", value: "src/greeting.mjs" }, origin: [], evidence: [], discoveryHash: placeholder, semanticHash: placeholder };
        await new runtime.CanonicalFileRepository(root).write(core.withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind, id, key: record.key, lifecycle: "active", payload }));
      }
      const exec = promisify(execFile);
      for (const args of [["init", "-q"], ["config", "user.email", "test@example.invalid"], ["config", "user.name", "Release Probe"], ["add", "."], ["commit", "-qm", "fixture"]]) await exec("git", args, { cwd: root, windowsHide: true });
      const proposal = { apiVersion: "projector.change-proposal/v1", requirements: [requirement], scenarios: [scenario], architecture: null, edits: [{ path: "src/greeting.mjs", before, after: "export const greet = (name) => 'hello ' + name;\n" }], validation: { independentNodeTests: ["test/greeting.test.mjs"], supplementalNodeTests: [] }, analysisFacets: ["behavior", "architecture"] };
      const service = await controlPlane.RepositoryRepresentationProfileReconciliationService.create(root);
      const recovered = await observeRepresentationProfileRecovery({ root, core, engine, controlPlane, proposal, reconcile: (input: { changeSelector: string; approvalSelector?: string }) => service.reconcile(input) });
      expect(recovered.result.profile).toMatchObject({ fromVersion: "1", toVersion: "2" });
      expect(recovered.result.delivery).toMatchObject({ stage: "reconciliation-service", deliveredToRunnerBoundary: false });
      expect(Object.values(recovered.negatives).every(({ rejected }) => rejected)).toBe(true);
      expect(recovered.preservedHistory.length).toBeGreaterThan(0);
    } finally { await rm(root, { recursive: true, force: true }); }
  }, 30_000);

  it.skipIf(!process.env.PROJECTOR_TEST_PACKAGED_ROOT)("exercises installed composition, delivery, profile recovery, and severed-package controls", async () => {
    const result = await observeInstalledRepresentationLinks({ packagedRoot: process.env.PROJECTOR_TEST_PACKAGED_ROOT });
    expect(result.publicComposition.fidelity.status).toBe("valid");
    expect(result.contentIntegrity.delivered.artifactIntegrity.status).toBe("valid");
    expect(result.contentIntegrity.wrongCapsule.result?.status).toBe("failed");
    expect(result.contentIntegrity.tampered.renderedText).toBeUndefined();
    expect(result.packagedExport.severedPackage.result).toBeUndefined();
    expect(result.packagedExport.restored.artifactIntegrity.status).toBe("valid");
    expect(result.profileRecovery.result.replacement).toMatchObject({ artifactStatus: "valid", dependencyStatus: "current", approvalStatus: "not-supplied" });
    expect(Object.values(result.profileRecovery.negatives).every(({ rejected }: { rejected: boolean }) => rejected)).toBe(true);
  }, 90_000);

  it("directly exercises canonical owner authority, fidelity, and telemetry", async () => {
    const result = await verifyRepresentationProjection(input);
    expect(result.fidelity.assurance).toBe("exact");
    expect(Object.values(result.negatives).every(({ rejected }) => rejected)).toBe(true);
    expect(result.telemetry.some(({ event }: { event: string }) => event === "representation.compiled")).toBe(true);
    const changed = await verifyRepresentationProjection({ ...input, inventory: [{ ...inventory[0], owner: { ...owner, steps: [...owner.steps, { role: "expected-outcome", statement: "Retain the explicit exception." }] } }] });
    expect(changed.projection.contentHash).not.toBe(result.projection.contentHash);
  });
  it("rejects a missing canonical owner instead of using historical headings", async () => {
    await expect(verifyRepresentationProjection({ ...input, inventory: [] })).rejects.toThrow("accepted canonical closure scenario missing");
  });
  it("refuses to certify a negative control that unexpectedly succeeds", async () => {
    class BrokenValidator extends engine.RepresentationCompiler {
      override async validateCandidate(input: Parameters<engine.RepresentationCompiler["validateCandidate"]>[0]) {
        if (input.candidate === "") return {} as Awaited<ReturnType<engine.RepresentationCompiler["validateCandidate"]>>;
        return super.validateCandidate(input);
      }
    }
    await expect(verifyRepresentationProjection({ ...input, engine: { ...engine, RepresentationCompiler: BrokenValidator } })).rejects.toThrow("negative control unexpectedly passed");
  });
});
