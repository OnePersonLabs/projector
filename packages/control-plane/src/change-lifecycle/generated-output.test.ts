import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, rm, mkdir, copyFile, rename, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { NativeProcessLauncher, WriterLeaseManager, RepositoryPathService, GovernedWorktreeRuntime, FileTransactionJournal } from "@projector/runtime";
import { hashFramedDomain } from "@projector/core";
import { VerificationService } from "../verification/service.js";
import { GeneratedOutputService } from "./generated-output.js";
import { observeChangeRepository } from "./repository-observer.js";

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture(source: string) {
  const root = await mkdtemp(join(tmpdir(), "projector-generated-")); roots.push(root);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  git("init"); git("config", "user.name", "Generated test"); git("config", "user.email", "generated@example.test");
  await writeFile(join(root, "producer.cjs"), source); await writeFile(join(root, "input.txt"), "input");
  git("add", "."); git("commit", "-m", "baseline");
  const request = { producerId: "producer:test", executable: process.execPath, sourcePath: "producer.cjs", args: [], inputPaths: ["input.txt"], populations: [], completeInputs: true as const, outputs: [{ path: "output.txt", ownership: "retained" as const }, { path: "cache.txt", ownership: "disposable" as const }], environment: [], timeoutMs: 10000 };
  return { root, request, service: await GeneratedOutputService.create(root) };
}
test("actual source execution binds bytes, contradictory failure prevents currentness, input changes and retirement invalidate", async () => {
  const { root, request, service } = await fixture("const fs=require('node:fs');if(fs.existsSync('fail'))process.exit(3);fs.writeFileSync('output.txt',fs.readFileSync('input.txt'));fs.writeFileSync('cache.txt','cache');");
  const first = await service.execute(request);
  expect(first.check.status).toBe("passed");
  expect(first.check.request.sourcePath).toBe("producer.cjs");
  expect((await service.inspect([request.producerId])).records[0]?.current).toBe(true);
  expect((await (await VerificationService.create(root)).inspect()).records).toHaveLength(1);
  await writeFile(join(root, "fail"), "fail");
  const failed = await service.execute(request);
  expect(failed.check.status).toBe("failed");
  expect((await service.inspect([request.producerId])).records.every((record) => !record.current)).toBe(true);
  await rm(join(root, "fail")); await service.execute(request);
  await writeFile(join(root, "input.txt"), "changed");
  expect((await service.inspect([request.producerId])).records.every((record) => !record.current)).toBe(true);
  const retired = await (await GeneratedOutputService.create(root)).inspect([]);
  expect(retired.records[0]?.outputs.map((output) => output.disposition)).toEqual(["preserve-and-review", "removal-eligible"]);
});
test("no-op producer exposes unchanged existing bytes without claiming this run produced them", async () => {
  const { root, request, service } = await fixture("process.exit(0)");
  await writeFile(join(root, "output.txt"), "old"); await writeFile(join(root, "cache.txt"), "old");
  await service.execute(request);
  const result = (await service.inspect([request.producerId])).records[0]!;
  expect(result.outputs.every((output) => output.observation === "unchanged-after-invocation")).toBe(true);
  expect(result.reason).toContain("exclusive causation is unproven");
  await writeFile(join(root, "producer.cjs"), "process.exit(4)");
  expect((await service.inspect([request.producerId])).records[0]?.current).toBe(false);
});
test("pending durable output evidence is visible and recovery never runs its producer again", async () => {
  const { root, request, service } = await fixture("require('node:fs').writeFileSync('output.txt','result');require('node:fs').writeFileSync('cache.txt','cache');");
  const evidence = await service.execute(request);
  const pendingId = `${evidence.id}_pending`;
  const finalizing = join(root, ".projector/runtime/change-lifecycles/generated-outputs", "finalizing", pendingId);
  await mkdir(finalizing); await writeFile(join(finalizing, "manifest.bin"), JSON.stringify(evidence));
  expect((await service.inspect([request.producerId])).pendingPublications).toEqual([{ artifactSetId: pendingId, state: "finalizing", recoverable: true }]);
  const recovered = await (await GeneratedOutputService.create(root)).recover([request.producerId]);
  expect(recovered.recoveredArtifactSetIds).toEqual([pendingId]);
  expect(recovered.inspection.pendingPublications).toEqual([]);
  expect((await (await VerificationService.create(root)).inspect()).records).toHaveLength(1);
});
test("generated history overflow and cancellation preserve committed evidence without rerunning the producer", async () => {
  const { root, request, service } = await fixture("require('node:fs').writeFileSync('output.txt','result');require('node:fs').writeFileSync('cache.txt','cache');");
  await service.execute(request);
  const published = join(root, ".projector/runtime/change-lifecycles/generated-outputs", "published");
  const overflowNames = Array.from({ length: 10000 }, (_, index) => `overflow-${String(index).padStart(5, "0")}`);
  await Promise.all(overflowNames.map((name) => mkdir(join(published, name))));
  await expect(service.inspect([request.producerId])).rejects.toThrow(/maxFiles/u);
  await Promise.all(overflowNames.map((name) => rm(join(published, name), { recursive: true })));

  const controller = new AbortController(); controller.abort();
  const cancelled = await GeneratedOutputService.create(root, { signal: controller.signal });
  await expect(cancelled.inspect([request.producerId])).rejects.toThrow();
  await expect(cancelled.recover([request.producerId])).rejects.toThrow();
  expect((await service.inspect([request.producerId])).records).toHaveLength(1);
  expect((await (await VerificationService.create(root)).inspect()).records).toHaveLength(1);
});
test("retained generation observations survive a deleted source checkout", async () => {
  const source = await fixture("require('node:fs').writeFileSync('output.txt','result');require('node:fs').writeFileSync('cache.txt','cache');");
  const destination = await fixture("require('node:fs').writeFileSync('output.txt','result');require('node:fs').writeFileSync('cache.txt','cache');");
  const shared = await mkdtemp(join(tmpdir(), "projector-generated-retained-")); roots.push(shared);
  const service = await GeneratedOutputService.create(source.root, { evidenceStoreRoot: shared });
  const evidence = await service.execute(source.request);
  for (const path of ["output.txt", "cache.txt"]) await copyFile(join(source.root, path), join(destination.root, path));
  await rm(source.root, { recursive: true });
  const receiver = await GeneratedOutputService.create(destination.root, { evidenceStoreRoot: shared });
  const result = await receiver.inspect([destination.request.producerId]);
  expect(result.records).toHaveLength(1); expect(result.records[0]?.evidence.contentHash).toBe(evidence.contentHash);
  expect(result.records[0]?.current).toBe(true);
  expect(result.records[0]?.reason).toContain("exclusive causation is unproven");
  await rm(join(destination.root, "producer.cjs"));
  const historical = await receiver.inspect([destination.request.producerId]);
  expect(historical.records[0]?.current).toBe(false);
  expect(historical.records[0]?.reason).toContain("unavailable");
  expect((await receiver.inspect([])).records[0]?.reason).toBe("Producer retired");
});
test("process time does not consume the post-generation observation budget", async () => {
  const { root, request } = await fixture("require('node:fs').writeFileSync('output.txt','result');require('node:fs').writeFileSync('cache.txt','cache');");
  const native = new NativeProcessLauncher(); const now = Date.now.bind(Date); let elapsed = 0;
  const clock = vi.spyOn(Date, "now").mockImplementation(() => now() + elapsed);
  try {
    const service = await GeneratedOutputService.create(root, { launcher: { capabilities: native.capabilities, launch: async (input) => { const result = await native.launch(input); elapsed = 60000; return result; } } });
    expect((await service.execute(request)).check.status).toBe("passed");
  } finally { clock.mockRestore(); }
});
test("failed post-process observation recovers association without rerunning producer", async () => {
  const { root, request } = await fixture("const fs=require('node:fs');fs.mkdirSync('output.txt');fs.writeFileSync('cache.txt','cache');fs.writeFileSync('counter.txt','once');");
  const service = await GeneratedOutputService.create(root);
  await expect(service.execute(request)).rejects.toThrow(/regular file/u);
  const pending = (await service.inspect([])).pendingPublications;
  expect(pending).toHaveLength(1);
  await rm(join(root, "output.txt"), { recursive: true }); await writeFile(join(root, "output.txt"), "recovered bytes");
  await writeFile(join(root, "producer.cjs"), "throw Error('must not rerun')");
  const result = await service.recover([request.producerId]);
  expect(result.recoveredArtifactSetIds).toEqual([pending[0]?.artifactSetId]);
  expect(result.inspection.records[0]?.evidence.afterObservation).toBe("recovery");
  expect(result.inspection.records[0]?.current).toBe(false);
});
test("a generated wrapper cannot substitute an unrelated valid execution", async () => {
  const { root, request, service } = await fixture("require('node:fs').writeFileSync('output.txt','result');require('node:fs').writeFileSync('cache.txt','cache');");
  const evidence = await service.execute(request);
  const unrelated = await (await VerificationService.create(root)).execute({ executable: process.execPath, args: ["--eval", "process.exit(0)"], inputPaths: ["input.txt"], populations: [], environment: [], timeoutMs: 10000 });
  const { contentHash: _hash, ...basis } = { ...evidence, check: unrelated };
  const forged = { ...basis, contentHash: hashFramedDomain("generated-output-evidence", basis) };
  await writeFile(join(root, ".projector/runtime/change-lifecycles/generated-outputs/published", evidence.id, "manifest.bin"), JSON.stringify(forged));
  await expect(service.inspect([request.producerId])).rejects.toThrow(/association|integrity-failed/u);
});
test("prepared immediate evidence wins over its generation intent during recovery", async () => {
  const { root, request, service } = await fixture("require('node:fs').writeFileSync('output.txt','result');require('node:fs').writeFileSync('cache.txt','cache');");
  const evidence = await service.execute(request);
  const storage = join(root, ".projector/runtime/change-lifecycles/generated-outputs");
  await rename(join(storage, "published", evidence.id), join(storage, "finalizing", evidence.id));
  expect((await service.inspect([])).pendingPublications).toEqual([{ artifactSetId: evidence.id, state: "finalizing", recoverable: true }]);
  const recovered = await service.recover([request.producerId]);
  expect(recovered.inspection.records[0]?.evidence.contentHash).toBe(evidence.contentHash);
  expect(recovered.inspection.records[0]?.evidence.afterObservation).toBe("immediate");
});
test("generation intent recovers an interrupted empty terminal staging area", async () => {
  const { root, request, service } = await fixture("require('node:fs').writeFileSync('output.txt','result');require('node:fs').writeFileSync('cache.txt','cache');");
  const evidence = await service.execute(request);
  const storage = join(root, ".projector/runtime/change-lifecycles/generated-outputs");
  await rm(join(storage, "published", evidence.id), { recursive: true });
  await mkdir(join(storage, "staging", evidence.id, "blobs"), { recursive: true });
  expect((await service.inspect([])).pendingPublications).toEqual([{ artifactSetId: evidence.id, state: "staged", recoverable: true }]);
  const result = await service.recover([request.producerId]);
  expect(result.inspection.records[0]?.evidence.afterObservation).toBe("recovery");
  expect(result.inspection.records[0]?.current).toBe(false);
});
test("interrupted intent publication remains visible and recoverable", async () => {
  const { root, request, service } = await fixture("require('node:fs').writeFileSync('output.txt','result');require('node:fs').writeFileSync('cache.txt','cache');");
  const evidence = await service.execute(request);
  const storage = join(root, ".projector/runtime/change-lifecycles/generated-outputs");
  await rm(join(storage, "published", evidence.id), { recursive: true });
  await rename(join(storage, "intents/published", evidence.id), join(storage, "intents/finalizing", evidence.id));
  expect((await service.inspect([])).pendingPublications).toEqual([{ artifactSetId: evidence.id, state: "finalizing", recoverable: true }]);
  expect((await service.recover([])).inspection.records[0]?.evidence.afterObservation).toBe("recovery");
});
test("an intent with only a running execution cannot promise terminal recovery", async () => {
  const { root, request } = await fixture("require('node:fs').writeFileSync('output.txt','result');require('node:fs').writeFileSync('cache.txt','cache');");
  const native = new NativeProcessLauncher();
  let markStarted!: () => void; const started = new Promise<void>(resolve => { markStarted = resolve; });
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const service = await GeneratedOutputService.create(root, { launcher: { capabilities: native.capabilities, launch: async input => { markStarted(); await gate; return native.launch(input); } } });
  const execution = service.execute(request);
  await started;
  try {
    expect((await service.inspect([])).pendingPublications[0]?.recoverable).toBe(false);
    expect((await service.recover([])).recoveredArtifactSetIds).toEqual([]);
  } finally { release(); }
  expect((await execution).check.status).toBe("passed");
});

async function waitForProducer(root: string) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    try { await readFile(join(root, "started.txt")); return; }
    catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error("Native generation producer did not start within 10 seconds");
}
const waitingProducer = "const fs=require('node:fs');fs.writeFileSync('started.txt','ready');const timer=setInterval(()=>{if(fs.existsSync('stop.txt')){fs.writeFileSync('output.txt','generated');fs.writeFileSync('cache.txt','cache');clearInterval(timer)}},20);";
test("native generation and the lifecycle writer coordinate while independent checkout and evidence reads remain available", async () => {
  const source = await fixture(waitingProducer);
  const destination = await fixture("require('node:fs').writeFileSync('output.txt','independent');require('node:fs').writeFileSync('cache.txt','cache');");
  const execution = source.service.execute(source.request);
  await waitForProducer(source.root);
  try {
    const paths = await RepositoryPathService.create(source.root);
    const worktree = new GovernedWorktreeRuntime(new WriterLeaseManager(paths, { staleAfterMs: 30000 }), new FileTransactionJournal(paths));
    const observation = await observeChangeRepository(source.root);
    const stateBinding = { compiledAgainst: observation.state, valueDependencies: [], queryDependencies: [], dependencyDigest: hashFramedDomain("generation-overlap-test", observation.state) };
    const owner = { sessionId: "lifecycle-overlap", processId: process.pid, stateBinding };
    await expect(worktree.open(owner)).rejects.toMatchObject({ code: "lease-held" });
    await expect(source.service.execute(source.request)).rejects.toMatchObject({ code: "lease-held" });
    expect((await source.service.inspect([])).pendingPublications[0]?.recoverable).toBe(false);
    expect((await source.service.recover([])).recoveredArtifactSetIds).toEqual([]);
    expect((await destination.service.execute(destination.request)).check.status).toBe("passed");
    await writeFile(join(source.root, "stop.txt"), "stop"); await execution;
    const session = await worktree.open(owner);
    try {
      const transaction = await session.begin({ transactionId: "tx-overlapping-generation", planId: "plan-overlapping-generation", beforeState: observation.state, allowedWriteRoots: ["output.txt"] });
      await transaction.writeFile("output.txt", "lifecycle");
      for (const phase of ["workspace-staged", "validating", "canonical-staging", "committing"] as const) await transaction.transition(phase);
      await transaction.commit();
      await expect(source.service.execute(source.request)).rejects.toMatchObject({ code: "lease-held" });
    } finally { await session.close(); }
    expect(await readFile(join(source.root, "output.txt"), "utf8")).toBe("lifecycle");
  } finally {
    await writeFile(join(source.root, "stop.txt"), "stop"); await execution;
  }
});
test("generation refuses canonical and Git-owned outputs including aliases before launching", async () => {
  const { root, request, service } = await fixture("require('node:fs').writeFileSync('started.txt','launched')");
  for (const path of [".projector/model/x", ".PROJECTOR/config.toml", ".git/config", ".GIT/config"]) {
    await expect(service.execute({ ...request, outputs: [{ path, ownership: "retained" }] })).rejects.toThrow(/cannot authorize/u);
  }
  await mkdir(join(root, ".projector/model"), { recursive: true });
  await symlink(join(root, ".projector/model"), join(root, "alias"), process.platform === "win32" ? "junction" : "dir");
  await expect(service.execute({ ...request, outputs: [{ path: "alias/output.txt", ownership: "retained" }] })).rejects.toMatchObject({ code: "symlink-refused" });
  await expect(readFile(join(root, "started.txt"))).rejects.toMatchObject({ code: "ENOENT" });
});
test("writer ownership loss cancels the real native producer and preserves the replacement writer", async () => {
  const { root, request, service } = await fixture(waitingProducer);
  const execution = service.execute({ ...request, timeoutMs: 20000 });
  const failed = expect(execution).rejects.toThrow();
  await waitForProducer(root);
  await rename(join(root, ".projector/runtime/writer-lease.lock"), join(root, ".projector/runtime/displaced-generation-lock"));
  const manager = new WriterLeaseManager(await RepositoryPathService.create(root), { staleAfterMs: 30000 });
  const generationId = "generated_11111111-1111-4111-8111-111111111111";
  const replacement = await manager.acquireGeneration({ sessionId: generationId, generationId, processId: process.pid, requestHash: hashFramedDomain("replacement-writer", request), writePaths: ["output.txt"] });
  try {
    await failed; await replacement.heartbeat();
    expect((await (await VerificationService.create(root)).inspect()).records[0]?.status).toBe("interrupted");
    await expect(readFile(join(root, "output.txt"))).rejects.toMatchObject({ code: "ENOENT" });
  } finally { await replacement.release(); }
});
