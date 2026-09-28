import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { SqliteCodeEvidenceStore } from "./evidence-store.js";
import { resolveDerivedCachePath } from "../cache/location.js";

const roots: string[] = [];
const originalCache = process.env.PROJECTOR_CACHE_DIRECTORY;
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
  if (originalCache === undefined) delete process.env.PROJECTOR_CACHE_DIRECTORY;
  else process.env.PROJECTOR_CACHE_DIRECTORY = originalCache;
});

const evidence = (id: string, path = "src/value.ts") => ({
  id, generation: "generation-a", sourceHashes: { [path]: "source-a" },
  testId: "value test", runId: `run-${id}`, runner: "vitest", buildId: "build-a",
  workload: "one test", attribution: "per-test" as const, outcome: "passed" as const,
  ranges: [{ path, startLine: 1, endLine: 1 }, { path, startLine: 1, endLine: 1 }],
});

test("migrates existing observations once and pages addressed ranges without losing duplicates", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-evidence-store-")); roots.push(root);
  process.env.PROJECTOR_CACHE_DIRECTORY = join(root, "cache");
  const legacyPath = await resolveDerivedCachePath(root, ".projector/runtime/code/evidence.json");
  await mkdir(dirname(legacyPath), { recursive: true });
  const legacy = { evidence: [evidence("a"), evidence("b", "src/other.ts")], bridges: [] };
  await writeFile(legacyPath, JSON.stringify(legacy));
  await expect(SqliteCodeEvidenceStore.open(root, 16)).rejects.toThrow(/maxDerivedBytes/u);
  const store = await SqliteCodeEvidenceStore.open(root, 1024 * 1024);
  const revision = store.revision();
  expect(store.evidencePage(["src/value.ts"], undefined, 1).records[0]?.ranges).toHaveLength(2);
  expect(store.evidencePage(["src/other.ts"], undefined, 1).records.map((item) => item.id)).toEqual(["b"]);
  store.putEvidence([evidence("c"), evidence("d")]);
  const first = store.evidencePage(["src/value.ts"], undefined, 2);
  expect(first.records.map((item) => item.id)).toEqual(["a", "c"]);
  expect(first.nextId).toBe("c");
  expect(store.evidencePage(["src/value.ts"], first.nextId, 2).records.map((item) => item.id)).toEqual(["d"]);
  expect(store.revision()).toBeGreaterThan(revision);
  store.close();
  const reopened = await SqliteCodeEvidenceStore.open(root, 16);
  expect(reopened.evidencePage(["src/value.ts"], undefined, 10).records.map((item) => item.id)).toEqual(["a", "c", "d"]);
  reopened.close();
  expect(JSON.parse(await readFile(legacyPath, "utf8"))).toEqual(legacy);
});

test("concurrent first opens initialize once and failed snapshot releases its transaction", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-evidence-store-")); roots.push(root);
  process.env.PROJECTOR_CACHE_DIRECTORY = join(root, "cache");
  const [first, second] = await Promise.all([
    SqliteCodeEvidenceStore.open(root, 1024 * 1024),
    SqliteCodeEvidenceStore.open(root, 1024 * 1024),
  ]);
  try {
    first.putEvidence([evidence("a")]);
    expect(() => second.withReadSnapshot((revision) => {
      expect(revision).toBe(second.revision());
      expect(second.evidencePage(["src/value.ts"], undefined, 1).records.map((item) => item.id)).toEqual(["a"]);
      throw new Error("aborted reader");
    })).toThrow("aborted reader");
    second.putEvidence([evidence("b")]);
    expect(first.evidencePage(["src/value.ts"], undefined, 3).records.map((item) => item.id)).toEqual(["a", "b"]);
  } finally {
    first.close();
    second.close();
  }
});
