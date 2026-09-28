import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StatementSync } from "node:sqlite";
import { expect, it, vi } from "vitest";
import { readDerivedCacheSource, withDerivedCacheAdmission } from "./derived-cache.js";

it("rolls back the complete cache batch when cancellation arrives after its final row is written", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-cache-cancellation-"));
  const cache = await mkdtemp(join(tmpdir(), "projector-cache-cancellation-owner-"));
  vi.stubEnv("PROJECTOR_CACHE_DIRECTORY", cache);
  const existing = `.projector/runtime/knowledge/contexts/${"a".repeat(32)}.json`;
  const finalContext = `.projector/runtime/knowledge/contexts/${"c".repeat(32)}.json`;
  const impact = `.projector/runtime/impact/${"b".repeat(64)}.json`;
  try {
    await withDerivedCacheAdmission(root, session => session.publish(existing, "existing authenticated bytes"));
    const controller = new AbortController();
    const cancellation = new Error("cancelled after final context row was written");
    const originalRun = StatementSync.prototype.run;
    const write = vi.spyOn(StatementSync.prototype, "run").mockImplementation(function (this: StatementSync, ...parameters) {
      const result = Reflect.apply(originalRun, this, parameters);
      const values: readonly unknown[] = parameters;
      if (this.sourceSQL.startsWith("INSERT INTO observation_records") && values[0] === "cache-source" && values[1] === finalContext) controller.abort(cancellation);
      return result;
    });
    try {
      await expect(withDerivedCacheAdmission(root, session => session.publishAll([
        { relativePath: existing, content: "existing authenticated bytes" },
        { relativePath: impact, content: "new dependency" },
        { relativePath: finalContext, content: "new context" },
      ]), { signal: controller.signal })).rejects.toBe(cancellation);
    } finally { write.mockRestore(); }
    expect(controller.signal.aborted).toBe(true);
    expect(await readDerivedCacheSource(root, existing)).toBe("existing authenticated bytes");
    expect(await readDerivedCacheSource(root, finalContext)).toBeUndefined();
    expect(await readDerivedCacheSource(root, impact)).toBeUndefined();
    expect(await readdir(root)).toEqual([]);
  } finally {
    vi.unstubAllEnvs();
    await Promise.all([root, cache].map(path => rm(path, { recursive: true, force: true })));
  }
});
