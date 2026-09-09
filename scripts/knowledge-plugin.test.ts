import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const exec = promisify(execFile);
const wrapper = fileURLToPath(new URL("../plugins/projector/scripts/projector-change.mjs", import.meta.url));

describe("installed plugin knowledge workflow", () => {
  it("routes saved context and reconciliation and checks retained knowledge before starting a change", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-knowledge-plugin-"));
    try {
      const cli = join(root, "projector.mjs");
      const log = join(root, "calls.jsonl");
      await writeFile(cli, `import {appendFileSync} from 'node:fs';
appendFileSync(process.env.CALLS, JSON.stringify(process.argv.slice(2))+'\\n');
const command = process.argv[2];
if(command==='context') console.log(JSON.stringify({id:'knowledge:context:one',persisted:true}));
else if(command==='reconcile') {console.log(JSON.stringify({status:process.env.STALE==='1'?'stale':'current'}));process.exitCode=process.env.STALE==='1'?4:0;}
else if(command==='change') console.log(JSON.stringify({selector:'change:one'}));
else if(command==='plan') console.log(JSON.stringify({immutablePlanHash:'sha256:v1:plan',preview:{expectedDiff:'one bounded change'}}));
else throw new Error('unexpected command');
`);
      const env = { ...process.env, PROJECTOR_CLI: cli, CALLS: log };
      const context = await exec(process.execPath, [wrapper, "context", "--request", "Preserve meaning", "--entity", "requirement:one"], { cwd: root, env });
      expect(JSON.parse(context.stdout)).toMatchObject({ id: "knowledge:context:one", persisted: true });
      await exec(process.execPath, [wrapper, "reconcile", "--context", "knowledge:context:one"], { cwd: root, env });
      await expect(exec(process.execPath, [wrapper, "start", "--request", "Preserve meaning", "--proposal", "proposal.json", "--context", "knowledge:context:one"], { cwd: root, env: { ...env, STALE: "1" } })).rejects.toMatchObject({ code: 4 });
      const calls = (await readFile(log, "utf8")).trim().split("\n").map(line => JSON.parse(line));
      expect(calls.map(args => args[0])).toEqual(["context", "reconcile", "reconcile"]);
      expect(calls[0]).toEqual(["context", "Preserve meaning", "--entity", "requirement:one", "--compact", "--format", "json"]);
      await expect(exec(process.execPath, [wrapper, "start", "--request", "Preserve meaning", "--proposal", "proposal.json", "--context", "knowledge:context:one"], { cwd: root, env })).rejects.toMatchObject({ code: 3 });
      const after = (await readFile(log, "utf8")).trim().split("\n").map(line => JSON.parse(line));
      expect(after.slice(-3).map(args => args[0])).toEqual(["reconcile", "change", "plan"]);
      expect(after.at(-2)).toEqual(["change", "Preserve meaning", "--proposal", "proposal.json", "--context", "knowledge:context:one", "--format", "json"]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
