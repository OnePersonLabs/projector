import { execFile } from "node:child_process";
import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { executeProjector } from "./cli.js";

const executeFile = promisify(execFile);
const repositories: Array<{ root: string; dispose(): Promise<void> }> = [];

async function createTempGitRepository(): Promise<{ root: string; dispose(): Promise<void> }> {
  const root = await mkdtemp(join(tmpdir(), "projector-cli-fixture-"));
  await cp(fileURLToPath(new URL("../../../fixtures/misplaced-repository-script/", import.meta.url)), root, { recursive: true });
  const gitEnvironment = {
    ...process.env,
    GIT_AUTHOR_EMAIL: "cli-test@projector.invalid",
    GIT_AUTHOR_NAME: "Projector CLI Test",
    GIT_COMMITTER_EMAIL: "cli-test@projector.invalid",
    GIT_COMMITTER_NAME: "Projector CLI Test",
    GIT_CONFIG_GLOBAL: join(root, ".projector-test-no-global-gitconfig"),
    GIT_CONFIG_NOSYSTEM: "1",
  };
  await executeFile("git", ["init", "--quiet", "--initial-branch=main"], { cwd: root, env: gitEnvironment });
  await executeFile("git", ["add", "--all"], { cwd: root, env: gitEnvironment });
  await executeFile("git", ["commit", "--quiet", "--no-gpg-sign", "-m", "fixture"], { cwd: root, env: gitEnvironment });
  return { root, dispose: () => rm(root, { recursive: true, force: true }) };
}

afterEach(async () => {
  await Promise.all(repositories.splice(0).map((repository) => repository.dispose()));
});

describe("mandatory misplaced repository-script vertical slice", () => {
  it("repairs and reconciles the exact fixture to a durable fixed point", async () => {
    const repository = await createTempGitRepository();
    repositories.push(repository);

    const dryInit = await executeProjector(["init", "--dry-run", "--format", "json"], { cwd: repository.root });
    expect(dryInit.exitCode).toBe(0);
    await expect(access(join(repository.root, ".projector/state.db"))).rejects.toThrow();
    const initialized = await executeProjector(["init", "--format", "json"], { cwd: repository.root });
    expect(initialized.exitCode).toBe(0);
    await expect(access(join(repository.root, ".projector/state.db"))).resolves.toBeUndefined();

    const audit = await executeProjector(["audit", "--format", "json"], { cwd: repository.root });
    expect(audit.exitCode).toBe(2);
    expect(audit.report.analysis.executedRepositoryCode).toBe(false);
    expect(audit.report.analysis.classifications[".codex/hooks/validate-repo.mjs"]).toBe("repository-automation");
    expect(audit.report.analysis.patternCandidates.map(({ key }: { key: string }) => key)).toEqual([
      "hook-entrypoint",
      "hook-private-support",
      "repository-automation",
      "test-colocation",
    ]);
    expect(audit.report.divergences).toHaveLength(2);
    expect(audit.report.divergences.every((item: { rationale: string; counterEvidence: unknown[]; coverageCaveat: string }) =>
      item.rationale.length > 0 && item.counterEvidence.length > 0 && item.coverageCaveat.length > 0,
    )).toBe(true);

    const plan = await executeProjector(["plan", "--format", "json"], { cwd: repository.root });
    expect(plan.exitCode).toBe(0);
    expect(plan.report.plan.boundState.compiledAgainst).toEqual(plan.report.capsule.boundState.compiledAgainst);
    expect(plan.report.risk.class).toBe("R1");
    expect(plan.report.preview.expectedDiff).toContain("scripts/validate-repo.mjs");

    const reconciled = await executeProjector(["reconcile", "--format", "json"], { cwd: repository.root });
    expect(reconciled.exitCode).toBe(0);
    expect(reconciled.report.steps).toHaveLength(17);
    expect(reconciled.report.fixedPoint.iterations).toHaveLength(2);
    expect(reconciled.report.secondRunMaterialDelta).toBe(false);
    expect(reconciled.report.cleanupPlan.unresolvedClusterWork).toBe(0);
    expect(reconciled.report.receipt).toBeDefined();
    expect(reconciled.report.receiptRef).toContain("/.projector/receipts/");
    expect(reconciled.report.certificateRef).toContain("/.projector/reports/certificates/");
    expect(reconciled.report.certificate.validations.every(({ status }: { status: string }) => status === "passed")).toBe(true);

    await expect(access(join(repository.root, ".codex/hooks/validate-repo.mjs"))).rejects.toThrow();
    await expect(access(join(repository.root, ".codex/hooks/validate-repo.test.mjs"))).rejects.toThrow();
    await expect(access(join(repository.root, "scripts/validate-repo.mjs"))).resolves.toBeUndefined();
    await expect(access(join(repository.root, "scripts/validate-repo.test.mjs"))).resolves.toBeUndefined();
    const manifest = JSON.parse(await readFile(join(repository.root, "package.json"), "utf8"));
    expect(manifest.scripts.test).toBe("node --test scripts/*.test.mjs");
    expect(manifest.scripts["validate:repo"]).toBe("node scripts/validate-repo.mjs");

    const identicalReconciliation = await executeProjector(["reconcile", "--format", "json"], { cwd: repository.root });
    expect(identicalReconciliation.exitCode).toBe(0);
    expect(identicalReconciliation.report.secondRunMaterialDelta).toBe(false);
    expect(identicalReconciliation.report.fixedPoint.iterations).toHaveLength(1);

    const beforeDelete = reconciled.report.canonicalSemantics;
    await rm(join(repository.root, ".projector/state.db"), { force: true });
    const rebuilt = await executeProjector(["audit", "--format", "json"], { cwd: repository.root });
    expect(rebuilt.report.canonicalSemantics).toEqual(beforeDelete);
    expect(rebuilt.report.divergences).toEqual([]);
    const repairedCandidate = rebuilt.report.analysis.patternCandidates.find(({ key }: { key: string }) => key === "repository-automation");
    expect(repairedCandidate.independenceGroups).not.toContain("authored:scripts/validate-repo.mjs");
  });
});
