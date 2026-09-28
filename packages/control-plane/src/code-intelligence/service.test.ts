import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { codeInputHash } from "@projector/analyzers";
import { resolveDerivedCachePath, withObservationScope } from "@projector/runtime";
import { ResidentObservationWorkerPool, withResidentObservationWorkerPool } from "../observation/resident-pool.js";
import { executeCodeOperation, shutdownCodeIndexRuns } from "./service.js";
import { executeCodeTestReplay } from "./test-replay.js";

const run = promisify(execFile);
const roots: string[] = [];
const previousCache = process.env.PROJECTOR_CACHE_DIRECTORY;

async function fixture(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "projector-code-service-"));
  roots.push(directory);
  process.env.PROJECTOR_CACHE_DIRECTORY = join(directory, "cache-outside-repository");
  const root = join(directory, "repo");
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "package.json"), '{"name":"code-service-fixture","type":"module"}\n');
  await writeFile(join(root, "tsconfig.json"), '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext","target":"ES2022"},"include":["src"]}\n');
  await writeFile(join(root, "src/clock.ts"), "export function clock(): number { return 1; }\nexport const tick = clock();\n");
  await run("git", ["init", "--quiet"], { cwd: root });
  await run("git", ["add", "."], { cwd: root });
  await run("git", ["-c", "user.name=Projector Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture"], { cwd: root });
  return root;
}

afterEach(async () => {
  await shutdownCodeIndexRuns();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
  if (previousCache === undefined) delete process.env.PROJECTOR_CACHE_DIRECTORY;
  else process.env.PROJECTOR_CACHE_DIRECTORY = previousCache;
});

describe("code index host lifecycle", () => {
  it("bounds history while preserving interrupted runs and direct status lookup", async () => {
    const root = await fixture();
    const directory = await resolveDerivedCachePath(root, ".projector/runtime/code/runs");
    await mkdir(directory, { recursive: true });
    const firstId = "code_index_00000000-0000-0000-0000-000000000000";
    const interruptedId = "code_index_ffffffff-ffff-ffff-ffff-ffffffffffff";
    const records = Array.from({ length: 1001 }, (_, index) => {
      const id = `code_index_${index.toString(16).padStart(8, "0")}-0000-0000-0000-000000000000`;
      const finishedAt = new Date(Date.now() - (1001 - index) * 1000).toISOString();
      return { id, repositoryRoot: root, provider: "native", state: "published", startedAt: finishedAt, finishedAt, ownerPid: process.pid };
    });
    await Promise.all([...records, { id: interruptedId, repositoryRoot: root, provider: "native", state: "interrupted", startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), ownerPid: process.pid }]
      .map(record => writeFile(join(directory, `${record.id}.json`), JSON.stringify(record))));
    const signal = new AbortController().signal;
    const options = { signal, environment: process.env };
    const status = await withObservationScope({ signal }, () => executeCodeOperation(root, "code.index-status", {}, options)) as { runs: { id: string }[]; runsTruncated: boolean };
    expect(status.runs).toHaveLength(1000);
    expect(status.runsTruncated).toBe(true);
    const direct = await withObservationScope({ signal }, () => executeCodeOperation(root, "code.index-status", { runId: firstId }, options)) as { runs: { id: string }[]; runsTruncated: boolean };
    expect(direct.runs.map(run => run.id)).toEqual([firstId]);
    expect(direct.runsTruncated).toBe(false);
    const indexed = await withObservationScope({ signal }, () => executeCodeOperation(root, "code.index", { provider: "native", timeoutMs: 30_000 }, options)) as { state: string };
    expect(indexed.state, JSON.stringify(indexed)).toBe("published");
    const pruned = await withObservationScope({ signal }, () => executeCodeOperation(root, "code.index-status", { runId: firstId }, options)) as { runs: unknown[] };
    expect(pruned.runs).toEqual([]);
    const interrupted = await withObservationScope({ signal }, () => executeCodeOperation(root, "code.index-status", { runId: interruptedId }, options)) as { runs: { state: string }[] };
    expect(interrupted.runs).toEqual([expect.objectContaining({ state: "interrupted" })]);
  }, 60_000);

  it("publishes a native generation, serves a current query, and reports its durable run", async () => {
    const root = await fixture();
    const controller = new AbortController();
    const options = { signal: controller.signal, environment: process.env };
    const indexed = await withObservationScope({ signal: controller.signal }, () => executeCodeOperation(root, "code.index", { provider: "native", timeoutMs: 30_000 }, options)) as { id: string; state: string; generation: string };
    expect(indexed.state, JSON.stringify(indexed)).toBe("published");
    expect(indexed.generation).toMatch(/^sha256:v1:/u);
    const status = await withObservationScope({ signal: controller.signal }, () => executeCodeOperation(root, "code.index-status", {}, options)) as { head: string; runs: { id: string; state: string }[] };
    expect(status.head).toBe(indexed.generation);
    expect(status.runs).toEqual(expect.arrayContaining([expect.objectContaining({ id: indexed.id, state: "published" })]));
    const query = await withObservationScope({ signal: controller.signal }, () => executeCodeOperation(root, "code.query", { kind: "symbols", name: "clock" }, options)) as { query: { symbols: { name: string }[] }; freshness: string };
    expect(query.query.symbols.map(symbol => symbol.name)).toContain("clock");
    expect(query.freshness).toBe("current");
  });

  it("returns a resident run ID and allows a later wait without starting another build", async () => {
    const root = await fixture();
    const pool = new ResidentObservationWorkerPool(2);
    const controller = new AbortController();
    const options = { signal: controller.signal, environment: process.env };
    try {
      const started = await withResidentObservationWorkerPool(pool, () => withObservationScope({ signal: controller.signal }, () =>
        executeCodeOperation(root, "code.index", { provider: "native", timeoutMs: 30_000 }, options))) as { id: string; state: string };
      expect(started.state).toBe("running");
      const finished = await withObservationScope({ signal: controller.signal }, () => executeCodeOperation(root, "code.index-wait", { runId: started.id, timeoutMs: 30_000 }, options)) as { id: string; state: string };
      expect(finished, JSON.stringify(finished)).toMatchObject({ id: started.id, state: "published" });
    } finally { await shutdownCodeIndexRuns(); await pool.close(); }
  });
});

describe("isolated test replay", () => {
  it("runs one escaped Vitest name and imports source-bound coverage", async () => {
    const root = await fixture();
    await writeFile(join(root, ".gitignore"), "node_modules/\n");
    const source = "export const add = (a: number, b: number) => a + b;\n";
    await writeFile(join(root, "src/math.ts"), source);
    await writeFile(join(root, "src/math.test.ts"), [
      'import { test, expect } from "vitest";',
      'import { add } from "./math.js";',
      'test("adds (1+1)", () => { expect(add(1, 1)).toBe(2); });',
      'test("other", () => { expect(add(2, 2)).toBe(4); });',
      "",
    ].join("\n"));
    await run("git", ["add", "."], { cwd: root });
    await run("git", ["-c", "user.name=Projector Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "tests"], { cwd: root });
    await symlink(join(process.cwd(), "node_modules"), join(root, "node_modules"), "junction");
    const signal = new AbortController().signal;
    const options = { signal, environment: process.env };
    const index = await withObservationScope({ signal }, () => executeCodeOperation(root, "code.index", { provider: "native", timeoutMs: 30_000 }, options)) as { state: string };
    expect(index.state, JSON.stringify(index)).toBe("published");
    const output = await withObservationScope({ signal, limits: { timeoutMs: 120_000 } }, () => executeCodeTestReplay(root, {
      testFile: "src/math.test.ts", testName: "adds (1+1)", timeoutMs: 90_000,
      command: { executable: process.execPath, args: [join(process.cwd(), "node_modules", "vitest", "vitest.mjs"), "run"] },
    }, options));
    expect(output.outcome).toBe("passed");
    expect(output.evidenceIds).toHaveLength(1);
    expect(output.sourceHashes["src/math.ts"]).toBe(codeInputHash(source));
    expect(output.testId).toBe("src/math.test.ts::adds (1+1)");
    expect(output.unknowns).toEqual([]);
    expect(output.requiredVerificationUnaffected).toBe(true);
  }, 120_000);

  it("refuses a replay without a test result or coverage report", async () => {
    const root = await fixture();
    await writeFile(join(root, "src/math.test.ts"), 'test("one", () => {});\n');
    await run("git", ["add", "."], { cwd: root });
    await run("git", ["-c", "user.name=Projector Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "test source"], { cwd: root });
    const signal = new AbortController().signal;
    const options = { signal, environment: process.env };
    const index = await withObservationScope({ signal }, () => executeCodeOperation(root, "code.index", { provider: "native", timeoutMs: 30_000 }, options)) as { state: string };
    expect(index.state, JSON.stringify(index)).toBe("published");
    const replay = (script: string) => withObservationScope({ signal, limits: { timeoutMs: 30_000 } }, () => executeCodeTestReplay(root, {
      testFile: "src/math.test.ts", testName: "one", timeoutMs: 20_000,
      command: { executable: process.execPath, args: ["--eval", script] },
    }, options));
    await expect(replay("")).rejects.toThrow("Isolated replay produced no test result");
    await expect(replay('const fs = require("node:fs"); const path = process.argv.find(arg => arg.startsWith("--outputFile=")).slice(13); fs.writeFileSync(path, JSON.stringify({testResults:[{assertionResults:[{fullName:"one",status:"passed"}]}]}));'))
      .rejects.toThrow("Isolated replay produced no coverage report");
  }, 60_000);
});
