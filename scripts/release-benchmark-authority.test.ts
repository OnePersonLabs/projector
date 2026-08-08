import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execute = promisify(execFile);
const run = async (root: string) => JSON.parse((await execute(process.execPath, ["scripts/release-benchmark-authority.mjs", root], { cwd: process.cwd(), encoding: "utf8" })).stdout) as { releaseAllowed: boolean; metrics: { id: string; value: number }[]; rawObservations: { class: string; outputHash: string; output: string }[] };
describe("release benchmark executable authority", () => {
  it("accepts only a repository root and derives fixed-seed analyzer evidence", async () => { const root = await mkdtemp(join(tmpdir(), "benchmark-authority-")); try { await writeFile(join(root, "package.json"), '{"name":"benchmark-fixture","version":"1.0.0"}\n'); const result = await run(root); expect(result.metrics).toHaveLength(17); expect(result.rawObservations.map(({ class: fixtureClass }) => fixtureClass)).toEqual(["held-out", "mutation", "structural-variant"]); expect(result.rawObservations.every(({ outputHash, output }) => outputHash.startsWith("sha256:v1:") && output.includes("artifacts"))).toBe(true); await expect(execute(process.execPath, ["scripts/release-benchmark-authority.mjs", root, "{\"samples\":{}}"], { cwd: process.cwd() })).rejects.toBeDefined(); } finally { await rm(root, { recursive: true, force: true }); } });
  it("changes a protected gate when analyzed artifact behavior changes", async () => { const valid = await mkdtemp(join(tmpdir(), "benchmark-valid-")); const malformed = await mkdtemp(join(tmpdir(), "benchmark-malformed-")); try { await writeFile(join(valid, "package.json"), '{"name":"valid","version":"1.0.0"}\n'); await writeFile(join(malformed, "package.json"), '{"name":'); const good = await run(valid), bad = await run(malformed); expect(good.metrics.find(({ id }) => id === "hard-pattern-violations")?.value).not.toBe(bad.metrics.find(({ id }) => id === "hard-pattern-violations")?.value); expect(bad.releaseAllowed).toBe(false); } finally { await rm(valid, { recursive: true, force: true }); await rm(malformed, { recursive: true, force: true }); } });
});
