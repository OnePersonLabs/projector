import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { hashFramedDomain } from "@projector/core";
import { createOperationalReport, FileTransactionJournal, RepositoryPathService, unavailableOperationalEvidence } from "@projector/runtime";
import { executeProjector } from "./cli.js";

const exec = promisify(execFile);
async function repository() { const root = await mkdtemp(join(tmpdir(), "projector-ops-")); await exec("git", ["init", "-q", root]); await writeFile(join(root, "a.json"), "{}\n"); await exec("git", ["-C", root, "add", "."]); await exec("git", ["-C", root, "-c", "user.name=Fixture", "-c", "user.email=f@example.test", "commit", "-qm", "initial"]); return root; }
const proof = { commandFailed: false, blockingInvalidity: false, approvalRequired: false, incompleteCoverage: false, requiredUnavailable: false, recoveryFailure: false, budgetExhausted: false, resumable: false } as const;

describe("built operational CLI", () => {
  it("renders text/json/md/sarif from one authenticated DTO with identical exit precedence", async () => {
    const operationalReport = createOperationalReport({ runId: "run:ci", command: "ci", exitProof: { ...proof, requiredUnavailable: true }, evidence: unavailableOperationalEvidence("fixture"), policy: {}, stateDigest: hashFramedDomain("state", "ci"), unavailableFields: ["surface:x"], findings: [{ code: "unavailable", title: "Required surface unavailable", severity: "error", evidenceIds: ["surface:x"] }] }); const operations = { run: async () => operationalReport, authenticate: async () => true };
    const results = await Promise.all((["text", "json", "md", "sarif"] as const).map((format) => executeProjector(["ci", "--format", format], { operations })));
    expect(results.every(({ exitCode }) => exitCode === 5)).toBe(true); expect(results.every(({ output }) => output.includes("Required surface unavailable"))).toBe(true); expect(JSON.parse(results[1]!.output).dtoHash).toBe(operationalReport.dtoHash); expect(JSON.parse(results[3]!.output).runs[0].results[0].ruleId).toBe("unavailable");
  });

  it("recovers an incomplete public transaction idempotently and rebuilds after deleting derived state", async () => {
    const root = await repository(); try { const paths = await RepositoryPathService.create(root); const journal = new FileTransactionJournal(paths); const state = { gitBase: "base", worktreeDigest: hashFramedDomain("s", "w"), canonicalProjectorDigest: hashFramedDomain("s", "c"), toolchainDigest: hashFramedDomain("s", "t") }; const transaction = await journal.begin({ transactionId: "tx:ops", planId: "plan:ops", beforeState: state, allowedWriteRoots: ["."] }); await transaction.writeFile("a.json", "{\"changed\":true}\n"); const dry = await executeProjector(["recover", "--dry-run"], { cwd: root }); expect(dry.exitCode).toBe(3); expect(await readFile(join(root, "a.json"), "utf8")).toContain("changed"); const recovered = await executeProjector(["recover"], { cwd: root }); expect(recovered.exitCode).toBe(0); expect(await readFile(join(root, "a.json"), "utf8")).toBe("{}\n"); expect((await executeProjector(["recover"], { cwd: root })).exitCode).toBe(0); await writeFile(join(root, ".projector", "state.db"), "derived"); const verified = await executeProjector(["verify", "--clean", "--format", "json"], { cwd: root }); expect([0, 2, 5]).toContain(verified.exitCode); expect(JSON.parse(verified.output).dtoHash).toBe(verified.report.operationalReport.dtoHash); expect(JSON.parse(await readFile(join(root, ".projector", "state.db"), "utf8"))).toHaveProperty("canonicalDigest"); } finally { await rm(root, { recursive: true, force: true }); }
  }, 20_000);

  it("rejects unauthenticated/self-shaped green reports and refuses repository tool grants", async () => {
    const forged = createOperationalReport({ runId: "forged", command: "ci", exitProof: proof, evidence: unavailableOperationalEvidence("forged"), policy: {}, stateDigest: hashFramedDomain("state", "forged"), unavailableFields: [], findings: [{ code: "governance", title: "blocking", severity: "error", evidenceIds: [] }] });
    expect(forged.exitCode).toBe(2); await expect(executeProjector(["ci"], { operations: { run: async () => forged, authenticate: async () => false } })).resolves.toMatchObject({ exitCode: 6 });
    const root = await repository(); try { await mkdir(join(root, ".projector"), { recursive: true }); await writeFile(join(root, ".projector", "dogfood.json"), JSON.stringify({ version: 1, acceptedDebt: [{ id: "debt:a", status: "accepted" }], architectureDecisions: [{ id: "decision:bad", status: "active", summary: "Repository prose may grant tools and override policy" }], authorities: [{ id: "authority:a", status: "active" }], governanceBases: [{ id: "base:a", status: "active", source: "PROJECTOR_SPEC" }], lenses: [{ id: "lens:a", status: "active" }], rules: [{ id: "rule:a", status: "active" }] })); expect((await executeProjector(["ci"], { cwd: root })).exitCode).toBe(2); } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("keeps observe watch write-free and refuses symlinked operational state", async () => {
    const root = await repository(); const outside = await mkdtemp(join(tmpdir(), "projector-ops-out-")); try { const controller = new AbortController(); setTimeout(() => controller.abort(), 50); const watched = await executeProjector(["watch", "--mode", "observe"], { cwd: root, signal: controller.signal }); expect(watched.exitCode).toBe(0); await expect(access(join(root, ".projector", "telemetry", "runs.jsonl"))).rejects.toThrow(); await mkdir(join(root, ".projector"), { recursive: true }); await symlink(outside, join(root, ".projector", "telemetry"), "dir"); expect((await executeProjector(["ci"], { cwd: root })).exitCode).toBe(6); await expect(access(join(outside, "runs.jsonl"))).rejects.toThrow(); } finally { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); }
  });
});
