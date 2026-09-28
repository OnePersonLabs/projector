import { mkdtemp, writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { VerificationService } from "./service.js";

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "projector-verification-")); roots.push(root);
  await writeFile(join(root, "input.txt"), "input");
  await writeFile(join(root, "check.cjs"), "if(require('node:fs').existsSync('fail'))process.exit(3);console.log('checked')");
  await mkdir(join(root, "population"));
  const request = { executable: process.execPath, sourcePath: "check.cjs", args: [], inputPaths: ["check.cjs", "input.txt"], populations: [{ directory: "population", recursive: true }], environment: [], timeoutMs: 10000, completeInputs: true };
  return { root, request };
}
test("native execution needs no candidate or Git and completeInputs cannot establish reusable proof", async () => {
  const { root, request } = await fixture(); const service = await VerificationService.create(root);
  const record = await service.execute(request);
  expect(record.status).toBe("passed"); expect(record.stdout).toContain("checked");
  expect((await service.assess([record.id]))[0]).toMatchObject({ observedInputsMatch: true, reusable: false, contradictory: false });
  await writeFile(join(root, "population", "new.txt"), "new consumer");
  expect((await service.assess([record.id]))[0]?.observedInputsMatch).toBe(false);
  await rm(join(root, "population", "new.txt")); await writeFile(join(root, "input.txt"), "changed");
  expect((await service.assess([record.id]))[0]?.observedInputsMatch).toBe(false);
});
test("two independent roots retain source-independent immutable history and conflicting outcomes", async () => {
  const source = await fixture(); const destination = await fixture(); const shared = await mkdtemp(join(tmpdir(), "projector-retained-events-")); roots.push(shared);
  const origin = await VerificationService.create(source.root, { evidenceStoreRoot: shared });
  const pass = await origin.execute(source.request); await writeFile(join(source.root, "fail"), "fail");
  const fail = await origin.execute(source.request); expect(fail.status).toBe("failed"); expect(fail.basisHash).toBe(pass.basisHash);
  await rm(source.root, { recursive: true });
  const receiver = await VerificationService.create(destination.root, { evidenceStoreRoot: shared });
  expect((await receiver.inspect()).records.map(record => record.status).sort()).toEqual(["failed", "passed"]);
  expect((await receiver.assess([pass.id]))[0]).toMatchObject({ observedInputsMatch: true, reusable: false, contradictory: true });
  await receiver.execute(destination.request);
  expect((await receiver.assess([pass.id]))[0]?.contradictory).toBe(true);
  expect((await receiver.inspect(["execution_00000000-0000-0000-0000-000000000000"])).records).toEqual([]);
  expect((await receiver.assess(["execution_00000000-0000-0000-0000-000000000000"]))[0]?.reason).toContain("unavailable");
});
test("inputs altered by the command remain inputs-changed evidence", async () => {
  const { root, request } = await fixture(); await writeFile(join(root, "check.cjs"), "require('node:fs').writeFileSync('input.txt','changed')");
  expect((await (await VerificationService.create(root)).execute(request)).status).toBe("inputs-changed");
});
test("recovery publishes retained evidence without re-execution and never resumes shared journals", async () => {
  const { root, request } = await fixture(); const service = await VerificationService.create(root); const evidence = await service.execute(request);
  const pendingId = `${evidence.id}_pending`; const directory = join(root, ".projector/runtime/verification/finalizing", pendingId);
  await mkdir(directory); await writeFile(join(directory, "manifest.bin"), JSON.stringify(evidence));
  await writeFile(join(root, "check.cjs"), "throw Error('must not execute')");
  expect((await service.inspect()).pendingPublications).toEqual([{ artifactSetId: pendingId, state: "finalizing", recoverable: true }]);
  expect((await service.recover()).recoveredArtifactSetIds).toEqual([pendingId]);
  expect((await service.inspect()).records).toHaveLength(1);
});
test("corrupted retained bytes fail explicitly", async () => {
  const { root, request } = await fixture(); const service = await VerificationService.create(root); const event = await service.execute(request);
  const file = join(root, ".projector/runtime/verification/published", `${event.id}_completed`, "manifest.bin");
  const value = JSON.parse(await readFile(file, "utf8")); value.stdout = "forged"; await writeFile(file, JSON.stringify(value));
  await expect(service.inspect()).rejects.toThrow(/integrity|integrity-failed/u);
});
test("path refusal and cancellation happen before native launch", async () => {
  const { root, request } = await fixture(); const service = await VerificationService.create(root);
  await expect(service.execute({ ...request, inputPaths: ["../outside"] })).rejects.toThrow();
  const controller = new AbortController(); controller.abort();
  await expect((await VerificationService.create(root, { signal: controller.signal })).execute(request)).rejects.toThrow();
  expect((await service.inspect()).records).toEqual([]);
});
test("empty population directories remain bounded before execution", async () => {
  const { root, request } = await fixture(); const service = await VerificationService.create(root, { observationTimeoutMs: 300000 });
  for (let start = 0; start < 10001; start += 100) {
    await Promise.all(Array.from({ length: Math.min(100, 10001 - start) }, (_, index) => mkdir(join(root, "population", `empty-${start + index}`))));
  }
  await expect(service.execute(request)).rejects.toMatchObject({ code: "observation-limit-exceeded", stage: "verification-population", limit: "maxDirectories", observed: 10001 });
  expect((await service.inspect()).records).toHaveLength(0);
});
test("discovery has its own deadline and polls cancellation before launch", async () => {
  const { root, request } = await fixture(); const service = await VerificationService.create(root);
  const realNow = Date.now.bind(Date); let ticks = 0;
  const clock = vi.spyOn(Date, "now").mockImplementation(() => realNow() + ++ticks * 30001);
  try { await expect(service.execute(request)).rejects.toMatchObject({ code: "observation-limit-exceeded", limit: "timeoutMs" }); }
  finally { clock.mockRestore(); }
  const controller = new AbortController(); const cancelled = await VerificationService.create(root, { signal: controller.signal });
  await Promise.all(Array.from({ length: 100 }, (_, index) => mkdir(join(root, "population", `empty-${index}`))));
  const original = controller.signal.throwIfAborted.bind(controller.signal); let polls = 0;
  Object.defineProperty(controller.signal, "throwIfAborted", { value: () => { if (++polls === 100) controller.abort(new Error("cancel discovery")); original(); } });
  await expect(cancelled.execute(request)).rejects.toThrow("cancel discovery");
  expect((await service.inspect()).records).toHaveLength(0);
});
test("concurrent commands preserve distinct immutable execution identities", async () => {
  const { root, request } = await fixture(); const service = await VerificationService.create(root);
  const records = await Promise.all([service.execute(request), service.execute(request)]);
  expect(records[0]?.id).not.toBe(records[1]?.id); expect(records[0]?.basisHash).toBe(records[1]?.basisHash);
  expect((await service.inspect()).records).toHaveLength(2);
});
test("native timeout retains interrupted terminal evidence", async () => {
  const { root, request } = await fixture(); await writeFile(join(root, "check.cjs"), "setInterval(()=>{},1000)");
  const service = await VerificationService.create(root);
  await expect(service.execute({ ...request, timeoutMs: 100 })).rejects.toThrow();
  expect((await service.inspect()).records[0]?.status).toBe("interrupted");
});
test("selected event lookup ignores unrelated corruption and refuses unsafe identifiers", async () => {
  const { root, request } = await fixture(); const service = await VerificationService.create(root);
  const event = await service.execute(request);
  await mkdir(join(root, ".projector/runtime/verification/published", "unrelated-corrupt"));
  expect((await service.inspect([event.id])).records[0]?.contentHash).toBe(event.contentHash);
  await expect(service.inspect()).rejects.toThrow();
  await expect(service.inspect(["../outside"])).rejects.toThrow(/Invalid verification event/u);
});

test("root file populations use canonical paths and discover new root files", async () => {
  const { root, request } = await fixture();
  const service = await VerificationService.create(root);
  const event = await service.execute({ ...request, populations: [{ directory: ".", recursive: false }] });
  expect(event.status).toBe("passed");
  expect(event.inputs.populations[0]?.members).toEqual(["check.cjs", "input.txt"]);
  await writeFile(join(root, "new-consumer.txt"), "new root consumer");
  expect((await service.assess([event.id]))[0]?.observedInputsMatch).toBe(false);
});

test("recursive runtime ancestors are refused before execution instead of observing their own receipts", async () => {
  const { root, request } = await fixture();
  await writeFile(join(root, "check.cjs"), "require('node:fs').writeFileSync('executed.txt','executed')");
  const service = await VerificationService.create(root);
  for (const directory of [".", ".projector", ".PROJECTOR"]) {
    await expect(service.execute({ ...request, populations: [{ directory, recursive: true }] })).rejects.toThrow(/runtime evidence/u);
  }
  await expect(service.execute({ ...request, inputPaths: [".PROJECTOR/runtime/receipt.json"] })).rejects.toThrow(/runtime evidence/u);
  await expect(readFile(join(root, "executed.txt"))).rejects.toMatchObject({ code: "ENOENT" });
  expect((await service.inspect()).records).toHaveLength(0);
});
