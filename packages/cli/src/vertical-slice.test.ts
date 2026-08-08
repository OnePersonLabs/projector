import { execFile } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
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

    process.env.PROJECTOR_FIXTURE_EXECUTION_MARKER = "sandbox-escape.txt";
    const reconciled = await executeProjector(["reconcile", "--format", "json"], { cwd: repository.root });
    delete process.env.PROJECTOR_FIXTURE_EXECUTION_MARKER;
    expect(reconciled.exitCode, reconciled.output).toBe(0);
    expect(reconciled.report.steps).toHaveLength(17);
    expect(reconciled.report.fixedPoint.iterations).toHaveLength(2);
    expect(reconciled.report.secondReconciliation.invocation).toBe(2);
    expect(reconciled.report.secondReconciliation.fixedPoint.iterations).toHaveLength(1);
    expect(reconciled.report.secondReconciliation.beforeDigest).toBe(reconciled.report.secondReconciliation.afterDigest);
    expect(reconciled.report.secondRunMaterialDelta).toBe(false);
    expect(reconciled.report.cleanupPlan.unresolvedClusterWork).toBe(0);
    expect(reconciled.report.receipt).toBeDefined();
    expect(reconciled.report.receiptRef).toContain("/.projector/receipts/");
    expect(reconciled.report.certificateRef).toContain("/.projector/reports/certificates/");
    expect(reconciled.report.certificate.validations.every(({ status }: { status: string }) => status === "passed")).toBe(true);
    expect(reconciled.report.receipt.changedCanonicalEntityIds).toEqual([
      "authority:repository-script-placement", "lens:repository-script",
    ]);
    expect(reconciled.report.steps.every(({ details }: { details?: { artifactRefs?: unknown[]; assertions?: Array<{ passed: boolean }> } }) =>
      details !== undefined && details.artifactRefs!.length > 0 && details.assertions!.every(({ passed }) => passed),
    )).toBe(true);
    await expect(access(join(repository.root, "sandbox-escape.txt"))).rejects.toThrow();

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
    expect(identicalReconciliation.report.secondReconciliation.fixedPoint.iterations).toHaveLength(1);
    expect(identicalReconciliation.report.secondReconciliation.beforeDigest).toBe(identicalReconciliation.report.secondReconciliation.afterDigest);

    const beforeDelete = reconciled.report.canonicalSemantics;
    await rm(join(repository.root, ".projector/state.db"), { force: true });
    const rebuilt = await executeProjector(["audit", "--format", "json"], { cwd: repository.root });
    expect(rebuilt.report.canonicalSemantics).toEqual(beforeDelete);
    expect(rebuilt.report.divergences).toEqual([]);
    const repairedCandidate = rebuilt.report.analysis.patternCandidates.find(({ key }: { key: string }) => key === "repository-automation");
    expect(repairedCandidate.independenceGroups).not.toContain("authored:scripts/validate-repo.mjs");
  });

  it("does not discount a manually moved occurrence without Projector transaction provenance", async () => {
    const repository = await createTempGitRepository();
    repositories.push(repository);
    const repaired = await executeProjector(["reconcile", "--format", "json"], { cwd: repository.root });
    expect(repaired.exitCode, repaired.output).toBe(0);
    await rm(join(repository.root, ".projector/receipts"), { recursive: true, force: true });
    await rm(join(repository.root, ".projector/reports/certificates"), { recursive: true, force: true });
    const analysis = await executeProjector(["audit", "--format", "json"], { cwd: repository.root });
    const candidate = analysis.report.analysis.patternCandidates.find(({ key }: { key: string }) => key === "repository-automation");
    expect(candidate.independenceGroups).toContain("authored:scripts/validate-repo.mjs");
  });

  it("rejects a hand-authored receipt/certificate pair with fabricated provenance", async () => {
    const repository = await createTempGitRepository();
    repositories.push(repository);
    const repaired = await executeProjector(["reconcile", "--format", "json"], { cwd: repository.root });
    expect(repaired.exitCode, repaired.output).toBe(0);
    const receiptDirectory = join(repository.root, ".projector/receipts");
    const certificateDirectory = join(repository.root, ".projector/reports/certificates");
    const receiptName = (await readdir(receiptDirectory))[0];
    const certificateName = (await readdir(certificateDirectory))[0];
    if (receiptName === undefined || certificateName === undefined) throw new Error("expected receipt and certificate artifacts");
    const receiptPath = join(receiptDirectory, receiptName);
    const certificatePath = join(certificateDirectory, certificateName);
    const receipt = JSON.parse(await readFile(receiptPath, "utf8")) as Record<string, unknown>;
    receipt.semanticHash = `sha256:v1:${"f".repeat(64)}`;
    await writeFile(receiptPath, `${JSON.stringify(receipt)}\n`, "utf8");
    const analysis = await executeProjector(["audit", "--format", "json"], { cwd: repository.root });
    const candidate = analysis.report.analysis.patternCandidates.find(({ key }: { key: string }) => key === "repository-automation");
    expect(candidate.independenceGroups).toContain("authored:scripts/validate-repo.mjs");
    await writeFile(certificatePath, `${await readFile(certificatePath, "utf8")}tampered`, "utf8");
    const afterTamper = await executeProjector(["audit", "--format", "json"], { cwd: repository.root });
    const afterTamperCandidate = afterTamper.report.analysis.patternCandidates.find(({ key }: { key: string }) => key === "repository-automation");
    expect(afterTamperCandidate.independenceGroups).toContain("authored:scripts/validate-repo.mjs");
  });

  it("rejects renamed and byte-tampered receipt artifacts", async () => {
    const repository = await createTempGitRepository();
    repositories.push(repository);
    const repaired = await executeProjector(["reconcile", "--format", "json"], { cwd: repository.root });
    expect(repaired.exitCode, repaired.output).toBe(0);
    const receiptDirectory = join(repository.root, ".projector/receipts");
    const names = await readdir(receiptDirectory);
    const receiptName = names[0]!;
    await rename(join(receiptDirectory, receiptName), join(receiptDirectory, "hand-authored.json"));
    const analysis = await executeProjector(["audit", "--format", "json"], { cwd: repository.root });
    const candidate = analysis.report.analysis.patternCandidates.find(({ key }: { key: string }) => key === "repository-automation");
    expect(candidate.independenceGroups).toContain("authored:scripts/validate-repo.mjs");
  });

  it("rejects certificate operation and touched-unit mismatches against the journal", async () => {
    const repository = await createTempGitRepository();
    repositories.push(repository);
    const repaired = await executeProjector(["reconcile", "--format", "json"], { cwd: repository.root });
    expect(repaired.exitCode, repaired.output).toBe(0);
    const certificatePath = repaired.report.certificateRef as string;
    const certificate = JSON.parse(await readFile(certificatePath, "utf8")) as {
      certificate: { deterministicOperations: Array<{ summary: string }> };
    };
    certificate.certificate.deterministicOperations[0]!.summary = "moved .codex/hooks/validate-repo.mjs to scripts/fabricated.mjs";
    await writeFile(certificatePath, `${JSON.stringify(certificate)}\n`, "utf8");
    const analysis = await executeProjector(["audit", "--format", "json"], { cwd: repository.root });
    const candidate = analysis.report.analysis.patternCandidates.find(({ key }: { key: string }) => key === "repository-automation");
    expect(candidate.independenceGroups).toContain("authored:scripts/validate-repo.mjs");
  });

  it("rejects journal plan, transaction, and touched-path mismatches", async () => {
    const repository = await createTempGitRepository();
    repositories.push(repository);
    const repaired = await executeProjector(["reconcile", "--format", "json"], { cwd: repository.root });
    expect(repaired.exitCode, repaired.output).toBe(0);
    const journalDirectory = join(repository.root, ".projector/runtime/journal");
    const journalName = (await readdir(journalDirectory))[0];
    if (journalName === undefined) throw new Error("expected committed journal");
    const journalPath = join(journalDirectory, journalName);
    const journal = JSON.parse(await readFile(journalPath, "utf8")) as { entry: { planId: string; transactionId: string; touchedPaths: string[] } };
    journal.entry.planId = "plan:forged";
    journal.entry.transactionId = "transaction:forged";
    journal.entry.touchedPaths[0] = "scripts/forged.mjs";
    await writeFile(journalPath, `${JSON.stringify(journal)}\n`, "utf8");
    const analysis = await executeProjector(["audit", "--format", "json"], { cwd: repository.root });
    const candidate = analysis.report.analysis.patternCandidates.find(({ key }: { key: string }) => key === "repository-automation");
    expect(candidate.independenceGroups).toContain("authored:scripts/validate-repo.mjs");
  });

  it("rejects receipt touched-unit and plan mismatches", async () => {
    const repository = await createTempGitRepository();
    repositories.push(repository);
    const repaired = await executeProjector(["reconcile", "--format", "json"], { cwd: repository.root });
    expect(repaired.exitCode, repaired.output).toBe(0);
    const receiptPath = repaired.report.receiptRef as string;
    const receipt = JSON.parse(await readFile(receiptPath, "utf8")) as { planId: string; changedUnitIds: string[] };
    receipt.planId = "plan:forged";
    receipt.changedUnitIds = [];
    await writeFile(receiptPath, `${JSON.stringify(receipt)}\n`, "utf8");
    const analysis = await executeProjector(["audit", "--format", "json"], { cwd: repository.root });
    const candidate = analysis.report.analysis.patternCandidates.find(({ key }: { key: string }) => key === "repository-automation");
    expect(candidate.independenceGroups).toContain("authored:scripts/validate-repo.mjs");
  });

  it("refuses after a post-approval canonical edit before any workspace mutation", async () => {
    const repository = await createTempGitRepository();
    repositories.push(repository);
    const prepared = await import("./vertical-slice.js").then(({ prepareMandatorySlice }) => prepareMandatorySlice(repository.root));
    const canonicalPath = join(repository.root, prepared.canonicalWrites[0]!.path);
    await mkdir(join(canonicalPath, ".."), { recursive: true });
    await writeFile(canonicalPath, `${prepared.canonicalWrites[0]!.content}\n`);
    const result = await import("./vertical-slice.js").then(({ applyMandatorySlice }) => applyMandatorySlice(repository.root, prepared));
    expect(result.outcome).toBe("failure");
    await expect(access(join(repository.root, ".codex/hooks/validate-repo.mjs"))).resolves.toBeUndefined();
  });
});
