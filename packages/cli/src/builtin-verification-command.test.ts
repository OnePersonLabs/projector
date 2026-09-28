import { expect, test } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { runPublicCommand, type PublicCommandRunner } from "./public-command.js";
function fixture(output: unknown) { const calls: unknown[] = []; const runner: PublicCommandRunner = { execute: async request => { calls.push(request); return { status: "succeeded", exitCode: 0, readiness: { status: "ready" }, output }; } }; return { calls, runner }; }
test("compiled public CLI executes and assesses host-trusted retained canonical evidence", async () => {
  const execute = promisify(execFile), root = await mkdtemp(join(tmpdir(), "projector-public-builtin-")), store = await mkdtemp(join(tmpdir(), "projector-public-retention-"));
  try {
    for (const args of [["init", "-q"], ["config", "user.email", "test@example.invalid"], ["config", "user.name", "Test"]]) await execute("git", args, { cwd: root });
    await writeFile(join(root, "base.txt"), "base");
    await execute("git", ["add", "."], { cwd: root }); await execute("git", ["commit", "-qm", "base"], { cwd: root });
    await mkdir(join(root, ".projector")); await writeFile(join(root, ".projector/config.toml"), 'apiVersion = "projector.config/v3"\nenabled = true\nprojectorVersion = "3.0.0"\n');
    const code = `import {createBundledProjectorOperationRunner} from ${JSON.stringify(new URL("../dist/operation-runner.js", import.meta.url).href)}; import {runPublicCommand} from ${JSON.stringify(new URL("../dist/public-command.js", import.meta.url).href)}; const installed = await createBundledProjectorOperationRunner({packagedRoot:${JSON.stringify(fileURLToPath(new URL("..", import.meta.url)))}}); const runner = {execute:request=>installed.execute(request,{environment:{PROJECTOR_VERIFICATION_EVIDENCE_STORE:${JSON.stringify(store)},PROJECTOR_VERIFICATION_TRUST_POLICY:'projector.canonical-integrity/v1'}})}; const first = await runPublicCommand(['verify','--builtin','--target','HEAD','--json'],{runner,cwd:${JSON.stringify(root)}}); const record = JSON.parse(first.text); const second = await runPublicCommand(['verify','--builtin','--assess',record.id,'--target','HEAD','--json'],{runner,cwd:${JSON.stringify(root)}}); console.log(JSON.stringify({first:first.exitCode,record,second:second.exitCode,assessment:JSON.parse(second.text)}));`;
    const result = JSON.parse((await execute(process.execPath, ["--input-type=module", "-e", code], { maxBuffer: 4 * 1024 * 1024 })).stdout);
    expect(result).toMatchObject({ first: 0, record: { status: "passed" }, second: 0, assessment: { reusable: true, authorization: false, scope: "projector.canonical-integrity/v1" } });
    expect(result.record.binding.queryDependencies[0].priorResult.resultCount).toBe(0);
  } finally { await rm(root, { recursive: true, force: true }); await rm(store, { recursive: true, force: true }); }
});
test("public verify executes the fixed builtin and assesses only an explicit event and target", async () => {
  const f = fixture({ status: "passed", profile: "projector-closed-static/v1", id: "execution_test" });
  await runPublicCommand(["verify", "--builtin", "--target", "HEAD"], { runner: f.runner, cwd: process.cwd() });
  expect(f.calls).toEqual([expect.objectContaining({ operation: "verification.builtin", input: { command: { action: "execute", request: { check: "projector.canonical-integrity/v1", target: "HEAD" } } } })]);
  const a = fixture({ eventId: "execution_test", scope: "projector.canonical-integrity/v1", reusable: true, authorization: false, bindingStatus: "rebound", reasons: ["named check only"] });
  const result = await runPublicCommand(["verify", "--builtin", "--assess", "execution_test", "--target", "HEAD"], { runner: a.runner, cwd: process.cwd() });
  expect(a.calls).toEqual([expect.objectContaining({ operation: "verification.builtin", input: { command: { action: "assess", eventId: "execution_test", target: "HEAD" } } })]);
  expect(result.exitCode).toBe(0); expect(result.text).toContain("canonical/static check only"); expect(result.text).toContain("rebound");
});
test("builtin unavailable reuse exits nonzero, and inspect/recover never executes a check", async () => {
  const f = fixture({ eventId: "execution_test", scope: "projector.canonical-integrity/v1", reusable: false, authorization: false, bindingStatus: "stale", reasons: ["canonical population changed"] });
  expect((await runPublicCommand(["verify", "--builtin", "--assess", "execution_test", "--target", "HEAD"], { runner: f.runner, cwd: process.cwd() })).exitCode).toBe(6);
  const i = fixture({ records: [], pendingPublications: [] });
  await runPublicCommand(["verify", "--builtin", "--inspect"], { runner: i.runner, cwd: process.cwd() });
  await runPublicCommand(["verify", "--builtin", "--recover"], { runner: i.runner, cwd: process.cwd() });
  expect(i.calls).toEqual([expect.objectContaining({ input: { command: { action: "inspect" } } }), expect.objectContaining({ input: { command: { action: "recover" } } })]);
  for (const args of [["--builtin"], ["--assess", "execution_test", "--target", "HEAD"], ["--builtin", "--target", "HEAD", "--target", "other"], ["--builtin", "--inspect", "--target", "HEAD"]]) await expect(runPublicCommand(["verify", ...args], { runner: i.runner, cwd: process.cwd() })).rejects.toThrow();
});
