import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir, readFile, rename, readdir, cp, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterEach, expect, test } from "vitest";

const execute = promisify(execFile), roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function git(root: string, ...args: string[]) { return (await execute("git", args, { cwd: root })).stdout.trim(); }
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "projector-builtin-verification-")); roots.push(root);
  const store = await mkdtemp(join(tmpdir(), "projector-builtin-retained-")); roots.push(store);
  await git(root, "init", "-q"); await git(root, "config", "user.email", "test@example.invalid"); await git(root, "config", "user.name", "Test");
  await writeFile(join(root, "unrelated.txt"), "base"); await git(root, "add", "."); await git(root, "commit", "-qm", "base");
  return { root, store };
}
async function run(root: string, store: string, action: string, input: unknown, options: { trustedChecks?: string[]; trustPolicyVersion?: string; env?: Record<string, string>; moduleUrl?: string } = {}) {
  const moduleUrl = options.moduleUrl ?? new URL("../../dist/verification/builtin-service.js", import.meta.url).href;
  const code = `import { BuiltinVerificationService } from ${JSON.stringify(moduleUrl)}; const service = await BuiltinVerificationService.create(${JSON.stringify(root)}, { evidenceStoreRoot: ${JSON.stringify(store)}, trustedChecks: ${JSON.stringify(options.trustedChecks ?? ["projector.canonical-integrity/v1"])}, trustPolicyVersion: ${JSON.stringify(options.trustPolicyVersion ?? "1")} }); console.log(JSON.stringify(await service[${JSON.stringify(action)}](${JSON.stringify(input)})));`;
  const result = await execute(process.execPath, ["--input-type=module", "-e", code], { cwd: resolve("."), maxBuffer: 4 * 1024 * 1024, env: { ...process.env, ...options.env } });
  return JSON.parse(result.stdout);
}
test("trusted installed check retains empty canonical population and rebinds across unrelated trees and clone deletion", async () => {
  const f = await fixture();
  const record = await run(f.root, f.store, "execute", { check: "projector.canonical-integrity/v1", target: "HEAD" });
  expect(record.status).toBe("passed");
  expect(record.binding.queryDependencies[0].priorResult.resultCount).toBe(0);
  const clone = await mkdtemp(join(tmpdir(), "projector-builtin-receiver-")); roots.push(clone);
  await git(clone, "clone", "-q", f.root, "."); await rm(f.root, { recursive: true });
  await git(clone, "config", "user.email", "test@example.invalid"); await git(clone, "config", "user.name", "Test");
  await writeFile(join(clone, "another-unrelated.txt"), "new"); await git(clone, "add", "."); await git(clone, "commit", "-qm", "unrelated");
  expect(await run(clone, f.store, "assess", { eventId: record.id, target: "HEAD" })).toMatchObject({ reusable: true, scope: "projector.canonical-integrity/v1", bindingStatus: "rebound", authorization: false });
  await mkdir(join(clone, ".projector"));
  await writeFile(join(clone, ".projector/config.toml"), 'apiVersion = "projector.config/v3"\nenabled = true\nprojectorVersion = "3.0.0"\n');
  await git(clone, "add", "."); await git(clone, "commit", "-qm", "config presence");
  expect(await run(clone, f.store, "assess", { eventId: record.id, target: "HEAD" })).toMatchObject({ reusable: false, bindingStatus: "stale" });
});
test("portable installed package identities survive relocation and deny changed actual producer bytes", async () => {
  const f = await fixture(), installed = await mkdtemp(join(tmpdir(), "projector-installed-producer-")); roots.push(installed);
  const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
  await cp(join(packageRoot, "dist"), join(installed, "dist"), { recursive: true });
  await cp(join(packageRoot, "package.json"), join(installed, "package.json"));
  await symlink(join(packageRoot, "node_modules"), join(installed, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  const moduleUrl = pathToFileURL(join(installed, "dist/verification/builtin-service.js")).href;
  const record = await run(f.root, f.store, "execute", { check: "projector.canonical-integrity/v1", target: "HEAD" });
  expect(await run(f.root, f.store, "assess", { eventId: record.id, target: "HEAD" }, { moduleUrl })).toMatchObject({ reusable: true });
  const producer = join(installed, "dist/verification/builtin-producer.js");
  await writeFile(producer, `${await readFile(producer, "utf8")}\n// A different installed build.\n`);
  expect(await run(f.root, f.store, "assess", { eventId: record.id, target: "HEAD" }, { moduleUrl })).toMatchObject({ reusable: false, bindingStatus: "stale" });
});
test("an interrupted same-basis execution remains contradictory after a later pass", async () => {
  const f = await fixture(), moduleUrl = new URL("../../dist/verification/builtin-service.js", import.meta.url).href;
  const code = `import { watch } from 'node:fs'; import { mkdir } from 'node:fs/promises'; import { BuiltinVerificationService } from ${JSON.stringify(moduleUrl)}; const published = ${JSON.stringify(join(f.store, "builtin-verification/published"))}; await mkdir(published, {recursive:true}); const controller = new AbortController(); const watcher = watch(published, (_event,name) => { if(String(name).endsWith('_running')) controller.abort(new Error('host interrupted')); }); try { const service = await BuiltinVerificationService.create(${JSON.stringify(f.root)}, { evidenceStoreRoot:${JSON.stringify(f.store)}, trustedChecks:['projector.canonical-integrity/v1'], signal:controller.signal }); console.log(JSON.stringify(await service.execute({check:'projector.canonical-integrity/v1',target:'HEAD'}))); } finally { watcher.close(); }`;
  const interrupted = JSON.parse((await execute(process.execPath, ["--input-type=module", "-e", code], { maxBuffer: 4 * 1024 * 1024 })).stdout);
  expect(interrupted.status).toBe("interrupted");
  const passed = await run(f.root, f.store, "execute", { check: "projector.canonical-integrity/v1", target: "HEAD" });
  expect(passed.basisHash).toBe(interrupted.basisHash);
  expect(await run(f.root, f.store, "assess", { eventId: passed.id, target: "HEAD" })).toMatchObject({ reusable: false, contradictory: true });
});
test("canonical changes, trust/environment changes, and required artifact loss deny reuse", async () => {
  const f = await fixture();
  const record = await run(f.root, f.store, "execute", { check: "projector.canonical-integrity/v1", target: "HEAD" });
  expect(await run(f.root, f.store, "assess", { eventId: record.id, target: "HEAD" }, { trustedChecks: [] })).toMatchObject({ reusable: false });
  expect(await run(f.root, f.store, "assess", { eventId: record.id, target: "HEAD" }, { trustPolicyVersion: "2" })).toMatchObject({ reusable: false, bindingStatus: "stale" });
  expect(await run(f.root, f.store, "assess", { eventId: record.id, target: "HEAD" }, { env: { TZ: "Pacific/Honolulu" } })).toMatchObject({ reusable: false, bindingStatus: "stale" });
  await mkdir(join(f.root, ".projector")); await writeFile(join(f.root, ".projector/config.toml"), 'apiVersion = "projector.config/v3"\nenabled = true\nprojectorVersion = "3.0.0"\n');
  await git(f.root, "add", "."); await git(f.root, "commit", "-qm", "canonical");
  const configured = await run(f.root, f.store, "execute", { check: "projector.canonical-integrity/v1", target: "HEAD" });
  await writeFile(join(f.root, ".projector/config.toml"), 'apiVersion = "projector.config/v3"\nenabled = false\nprojectorVersion = "3.0.0"\n');
  await git(f.root, "add", "."); await git(f.root, "commit", "-qm", "canonical change");
  expect(await run(f.root, f.store, "assess", { eventId: configured.id, target: "HEAD" })).toMatchObject({ reusable: false, bindingStatus: "stale" });
  await rm(join(f.store, "builtin-verification/published", `${record.id}_completed`, "blobs/result.json"));
  expect(await run(f.root, f.store, "assess", { eventId: record.id, target: "HEAD" })).toMatchObject({ reusable: false, bindingStatus: "unavailable" });
});
test("terminal publication recovers retained artifacts without running the check again", async () => {
  const f = await fixture();
  const record = await run(f.root, f.store, "execute", { check: "projector.canonical-integrity/v1", target: "HEAD" });
  const slot = `${record.id}_completed`, evidence = join(f.store, "builtin-verification");
  await rename(join(evidence, "published", slot), join(evidence, "finalizing", slot));
  await mkdir(join(f.root, ".projector")); await writeFile(join(f.root, ".projector/invalid.md"), "invalid canonical data");
  await git(f.root, "add", "."); await git(f.root, "commit", "-qm", "would fail rerun");
  const result = await run(f.root, f.store, "recover", undefined);
  expect(result.recoveredArtifactSetIds).toEqual([slot]);
  expect(result.inspection.records).toEqual([record]);
  expect((await readdir(join(evidence, "published"))).sort()).toEqual([slot, `${record.id}_running`].sort());
  expect(JSON.parse(await readFile(join(evidence, "published", slot, "blobs/result.json"), "utf8")).status).toBe("passed");
});
