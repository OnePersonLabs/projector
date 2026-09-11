import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { hashFramedDomain, withCanonicalHashes } from "@projector/core";
import { CanonicalFileRepository, FileTransactionJournal } from "@projector/runtime";
import { afterEach, expect, test, vi } from "vitest";

import { RepositoryKnowledgeService } from "../knowledge/service.js";
import { RepositoryChangeLifecycleService } from "../change-lifecycle/service.js";
import { ChangeLifecycleStore } from "../change-lifecycle/store.js";
import { inspectRepositoryCoverage } from "./service.js";

const exec = promisify(execFile);
const roots: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function repository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "projector-continuation-"));
  roots.push(root);
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src/greeting.mjs"), "export const greet = () => 'hello';\n");
  await mkdir(join(root, "test"));
  await writeFile(join(root, "test/greeting.test.mjs"), "import assert from 'node:assert/strict'; import { greet } from '../src/greeting.mjs'; assert.equal(greet('Ada'), 'hello Ada');\n");
  const hash = hashFramedDomain("continuation-test", "initial");
  await new CanonicalFileRepository(root).write(withCanonicalHashes({
    apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "requirement", id: "requirement:greeting", key: "greeting", lifecycle: "active",
    payload: { id: "requirement:greeting", key: "greeting", title: "Greeting", statement: "The greeting includes the supplied name.", aliases: [], status: "active", sourceClass: "authored", scope: { op: "atom", field: "path", matcher: "equals", value: "src/greeting.mjs" }, origin: [], evidence: [], discoveryHash: hash, semanticHash: hash },
  }));
  await new CanonicalFileRepository(root).write(withCanonicalHashes({
    apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "behavioral-scenario", id: "scenario:greet-name", key: "greet-name", lifecycle: "active",
    payload: { ...scenario, id: "scenario:greet-name", aliases: [], status: "active", sourceClass: "authored", scope: { op: "atom", field: "path", matcher: "equals", value: "src/greeting.mjs" }, evidence: [], discoveryHash: hash, semanticHash: hash },
  }));
  await exec("git", ["init", "-q"], { cwd: root });
  await exec("git", ["config", "user.email", "projector@example.invalid"], { cwd: root });
  await exec("git", ["config", "user.name", "Projector Test"], { cwd: root });
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-qm", "initial"], { cwd: root });
  return root;
}

test("cleanup resumes a saved context after reset and discloses a bounded evidence page", async () => {
  const root = await repository();
  const context = await (await RepositoryKnowledgeService.create(root)).context({ request: "Continue greeting work", entities: ["requirement:greeting"], persist: true });
  const report = await inspectRepositoryCoverage(root, { scope: ".", contextId: context.id, evidenceLimit: 1 }, "cleanup");
  expect(report.continuation).toMatchObject({
    readOnly: true,
    context: { contextId: context.id, status: "current" },
    advisoryNotes: { status: "unobservable" },
    page: { offset: 0, included: 1, nextOffset: 1 },
  });
  expect(report.continuation!.page.total).toBeGreaterThan(1);
  expect(report.continuation!.evidence).toHaveLength(1);
  expect(report.continuation!.drillDown).toMatchObject({ operation: "cleanup", input: { contextId: context.id, evidenceOffset: 1, evidenceLimit: 1 } });
  const page = await inspectRepositoryCoverage(root, { scope: ".", contextId: context.id, evidenceLimit: 1, evidenceOffset: 1, evidenceIdentity: report.continuation!.page.evidenceIdentity }, "cleanup");
  expect(page.continuation!.evidence[0]!.id).not.toBe(report.continuation!.evidence[0]!.id);
  await writeFile(join(root, "src/greeting.mjs"), "export const greet = () => 'changed';\n");
  await expect(inspectRepositoryCoverage(root, { scope: ".", contextId: context.id, evidenceOffset: 1, evidenceIdentity: report.continuation!.page.evidenceIdentity }, "cleanup")).rejects.toThrow(/evidence changed/);
});

test("cleanup preserves current independent context branches and explains changed queries", async () => {
  const root = await repository();
  const writer = new CanonicalFileRepository(root);
  const hash = hashFramedDomain("continuation-test", "concept");
  for (const key of ["local", "independent"]) await writer.write(withCanonicalHashes({
    apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "concept", id: `concept:${key}`, key, lifecycle: "active",
    payload: { id: `concept:${key}`, key, kind: "capability", name: key, aliases: [], statement: `${key} capability`, status: "active", sourceClass: "authored", confidence: 1, tags: [], evidence: [], discoveryHash: hash, semanticHash: hash },
  }));
  const service = await RepositoryKnowledgeService.create(root);
  const retained = await service.context({ request: "Inspect two independent meanings", entities: ["concept:local", "concept:independent"], persist: true });
  await writer.write(withCanonicalHashes({
    apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "relation", id: "relation:local-greeting", key: "relation:relation:local-greeting", lifecycle: "active",
    payload: { id: "relation:local-greeting", fromId: "concept:local", toId: "requirement:greeting", type: "depends-on", active: true, sourceClass: "authored", confidence: 1, evidence: [], semanticHash: hash },
  }));
  const report = await inspectRepositoryCoverage(root, { scope: ".", contextId: retained.id, evidenceLimit: 50 }, "cleanup");
  expect(report.continuation!.context?.status).toBe("stale");
  const independent = retained.branches.find(({ interpretation }) => interpretation.entityId === "concept:independent")!;
  expect(report.continuation!.evidence).toContainEqual(expect.objectContaining({ id: `${retained.id}:${independent.id}`, status: "current" }));
  expect(report.continuation!.evidence).toContainEqual(expect.objectContaining({ status: "stale", reason: expect.stringContaining("Bound query semantics or result changed: knowledge-relations:concept:local") }));
  expect(report.continuation!.nextAction).toMatchObject({ operation: "context", input: { entities: expect.arrayContaining(["concept:local", "concept:independent"]), persist: true } });
});

test("cleanup distinguishes an absent required context from unobservable advisory notes", async () => {
  const root = await repository();
  const report = await inspectRepositoryCoverage(root, { scope: ".", contextId: "knowledge_context_00000000000000000000000000000000" }, "cleanup");
  expect(report.continuation).toMatchObject({ context: { status: "unknown", governance: "unknown" }, advisoryNotes: { status: "unobservable" }, counts: { current: 0, stale: 0, unknown: 1 }, nextAction: { operation: "context" } });
  expect(report.continuation!.evidence[0]).toMatchObject({ availability: "missing", required: true });
});

const scenario = { key: "greet-name", title: "Greet a name", steps: [
  { role: "precondition", statement: "A caller supplies a name." },
  { role: "trigger", statement: "The caller requests a greeting." },
  { role: "expected-outcome", statement: "The greeting includes that name." },
] };
const proposal = {
  apiVersion: "projector.change-proposal/v1", architecture: null, analysisFacets: ["behavior", "architecture"],
  requirements: [{ key: "greeting", title: "Greeting", statement: "The greeting includes the supplied name.", aliases: [] }],
  scenarios: [scenario],
  edits: [{ path: "src/greeting.mjs", before: "export const greet = () => 'hello';\n", after: "export const greet = (name) => `hello ${name}`;\n" }],
  validation: { independentNodeTests: ["test/greeting.test.mjs"], supplementalNodeTests: [] },
};

test("cleanup prioritizes recovery over unresolved work and missing preparation, then resumes the exact approval", async () => {
  const root = await repository();
  const lifecycle = await RepositoryChangeLifecycleService.create(root);
  const captured = await lifecycle.capture({ request: "Implement the accepted greeting", proposal });
  const approval = await lifecycle.approve(captured.capture.semanticChangeId, captured.capture.planHash);
  const store = await ChangeLifecycleStore.create(root);
  const attempt = await store.beginAttempt(approval.id);
  const input = { scope: ".", approvalSelector: approval.id, evidenceLimit: 50 };
  const interrupted = await inspectRepositoryCoverage(root, input, "cleanup");
  expect(interrupted.continuation).toMatchObject({ lifecycle: { status: "recovery-required" }, nextAction: { operation: "change.recover", input: { approvalSelector: approval.id } } });
  expect(interrupted.continuation!.evidence).toContainEqual(expect.objectContaining({ id: attempt.id, required: true, availability: "present" }));
  expect(interrupted.continuation!.evidence).not.toContainEqual(expect.objectContaining({ id: `${attempt.id}:prepared-success`, required: true }));
  const fresh = await RepositoryChangeLifecycleService.create(root);
  expect(await fresh.recover(approval.id)).toMatchObject([{ action: "no-transaction" }]);
  const recovered = await inspectRepositoryCoverage(root, input, "cleanup");
  expect(recovered.continuation).toMatchObject({ lifecycle: { status: "unresolved" }, nextAction: { operation: "change.resume", input: { approvalSelector: approval.id } } });
  const applied = await fresh.resume(approval.id);
  expect(applied.outcome).toBe("success");
  const completed = await inspectRepositoryCoverage(root, input, "cleanup");
  expect(completed.continuation).toMatchObject({ lifecycle: { status: "completed" } });
  expect(completed.continuation!.nextAction?.operation).not.toMatch(/^change\.(apply|resume)$/);
});

test("cleanup distinguishes missing committed proof and preserves safe publication recovery", async () => {
  const root = await repository();
  const lifecycle = await RepositoryChangeLifecycleService.create(root);
  const captured = await lifecycle.capture({ request: "Implement the accepted greeting", proposal });
  const approval = await lifecycle.approve(captured.capture.semanticChangeId, captured.capture.planHash);
  const publish = vi.spyOn(ChangeLifecycleStore.prototype, "writeArtifact").mockRejectedValueOnce(new Error("publication interrupted"));
  await expect(lifecycle.apply(approval.id)).rejects.toThrow("publication interrupted");
  publish.mockRestore();
  const preparedRoot = join(root, ".projector/runtime/change-lifecycles/prepared");
  const preparedPath = join(preparedRoot, (await readdir(preparedRoot))[0]!);
  const preparedBytes = await readFile(preparedPath);
  await rm(preparedPath);
  const input = { scope: ".", approvalSelector: approval.id, evidenceLimit: 50 };
  const missing = await inspectRepositoryCoverage(root, input, "cleanup");
  expect(missing.continuation).toMatchObject({ lifecycle: { status: "recovery-required" }, nextAction: { operation: "change.recover" } });
  expect(missing.continuation!.evidence).toContainEqual(expect.objectContaining({ id: expect.stringContaining(":prepared-success"), status: "unknown", availability: "missing", required: true }));
  const fresh = await RepositoryChangeLifecycleService.create(root);
  expect(await fresh.recover(approval.id)).toMatchObject([{ action: "recovery-required", reason: expect.stringContaining("no authenticated prepared-success") }]);
  await expect(access(preparedPath)).rejects.toMatchObject({ code: "ENOENT" });
  await writeFile(preparedPath, preparedBytes);
  const present = await inspectRepositoryCoverage(root, input, "cleanup");
  expect(present.continuation!.evidence).toContainEqual(expect.objectContaining({ id: expect.stringContaining(":prepared-success"), status: "current", availability: "present", required: true }));
  expect(await fresh.recover(approval.id)).toMatchObject([{ action: "finalized" }]);
  expect(await fresh.recover(approval.id)).toEqual([]);
  expect((await fresh.resume(approval.id)).outcome).toBe("success");
});

test("cleanup retains failed validation outcomes and routes missing representations to their existing plan owner", async () => {
  const root = await repository();
  const lifecycle = await RepositoryChangeLifecycleService.create(root);
  const captured = await lifecycle.capture({ request: "Implement the accepted greeting", proposal: { ...proposal, edits: [{ ...proposal.edits[0], after: "export const greet = () => 'wrong';\n" }] } });
  const approval = await lifecycle.approve(captured.capture.semanticChangeId, captured.capture.planHash);
  expect((await lifecycle.apply(approval.id)).outcome).toBe("partial");
  const artifactRoot = join(root, ".projector/runtime/representations");
  await rm(artifactRoot, { recursive: true });
  const report = await inspectRepositoryCoverage(root, { scope: ".", approvalSelector: approval.id, evidenceLimit: 50 }, "cleanup");
  expect(report.continuation).toMatchObject({ lifecycle: { status: "unresolved" }, nextAction: { operation: "change.plan", input: { changeSelector: captured.capture.semanticChangeId } } });
  expect(report.continuation!.evidence).toContainEqual(expect.objectContaining({ owner: "lifecycle", outcome: "partial" }));
  expect(report.continuation!.evidence).toContainEqual(expect.objectContaining({ owner: "representation", availability: "missing", required: true, inspect: expect.objectContaining({ operation: "representation.inspect" }) }));
  await expect(access(artifactRoot)).rejects.toMatchObject({ code: "ENOENT" });
});

test("cleanup detects an unclosed journal even when a partial result was published", async () => {
  const root = await repository();
  const lifecycle = await RepositoryChangeLifecycleService.create(root);
  const captured = await lifecycle.capture({ request: "Implement the accepted greeting", proposal: { ...proposal, edits: [{ ...proposal.edits[0], after: "export const greet = () => 'wrong';\n" }] } });
  const approval = await lifecycle.approve(captured.capture.semanticChangeId, captured.capture.planHash);
  const rollback = vi.spyOn(FileTransactionJournal.prototype, "rollbackRecord").mockRejectedValueOnce(new Error("rollback interrupted"));
  expect((await lifecycle.apply(approval.id)).outcome).toBe("partial");
  rollback.mockRestore();
  const report = await inspectRepositoryCoverage(root, { scope: ".", approvalSelector: approval.id, evidenceLimit: 50 }, "cleanup");
  expect(report.continuation).toMatchObject({ lifecycle: { status: "recovery-required" }, nextAction: { operation: "change.recover" } });
  expect(report.continuation!.evidence).toContainEqual(expect.objectContaining({ outcome: "partial" }));
  const fresh = await RepositoryChangeLifecycleService.create(root);
  expect(await fresh.recover(approval.id)).toMatchObject([{ action: "rolled-back" }]);
  expect(await fresh.recover(approval.id)).toEqual([]);
  const recovered = await inspectRepositoryCoverage(root, { scope: ".", approvalSelector: approval.id, evidenceLimit: 50 }, "cleanup");
  expect(recovered.continuation!.lifecycle?.status).toBe("unresolved");
  expect(recovered.continuation!.evidence).toContainEqual(expect.objectContaining({ outcome: "partial" }));
});
