import { describe, expect, it } from "vitest";
import { hashFramedDomain } from "@projector/core";
import { REQUIRED_BENCHMARK_GATES, createBenchmarkManifest, createIndependentBenchmarkOracle, evaluateBenchmarkGates, replayBenchmarkManifest } from "./benchmark.js";

function metrics(scale = 100) {
  return REQUIRED_BENCHMARK_GATES.map((gate) => {
    const numerator = gate.direction === "minimum" ? Math.ceil(gate.threshold * scale) : 0; const denominator = scale; const fixtureId = "held:a"; const fixtureClass = "held-out" as const; const scope = "fixture:held-out"; const evidenceHash = hashFramedDomain("test-evidence", gate.id);
    const contentHash = hashFramedDomain("benchmark-raw-observation", { fixtureId, fixtureClass, metricId: gate.id, numerator, denominator, scope, evidenceHash });
    return { ...gate, scope, numerator, denominator, observability: "closed" as const, evidenceIds: [`e:${gate.id}`], rawEvidence: [{ fixtureId, fixtureClass, numerator, denominator, evidenceHash, contentHash }] };
  });
}
function replaceRaw(metric: ReturnType<typeof metrics>[number], numerator: number, denominator: number) { const entry = metric.rawEvidence[0]!; return { ...metric, numerator, denominator, rawEvidence: [{ ...entry, numerator, denominator, contentHash: hashFramedDomain("benchmark-raw-observation", { fixtureId: entry.fixtureId, fixtureClass: entry.fixtureClass, metricId: metric.id, numerator, denominator, scope: metric.scope, evidenceHash: entry.evidenceHash }) }] }; }

describe("held-out benchmark and mutation gates", () => {
  it("uses 17 exact scoped gates, keeps zero denominators unavailable, and protects correctness", () => {
    expect(REQUIRED_BENCHMARK_GATES).toHaveLength(17); const input = metrics().map((metric) => metric.id === "irrelevant-expansion" ? replaceRaw(metric, 10, 100) : metric.id === "protected-dimension" ? replaceRaw(metric, 0, 0) : metric); const result = evaluateBenchmarkGates(input, createIndependentBenchmarkOracle({ cleanDigest: "same", incrementalDigest: "same", independentDigest: "same" }));
    expect(result.metrics.find(({ id }) => id === "required-recall")).toMatchObject({ passed: true, value: 0.95 }); expect(result.metrics.find(({ id }) => id === "irrelevant-expansion")?.passed).toBe(false); expect(result.metrics.find(({ id }) => id === "protected-dimension")?.status).toBe("unavailable"); expect(result.releaseAllowed).toBe(false);
  });

  it("rejects caller-shaped aggregates and requires an independent oracle", () => {
    expect(() => evaluateBenchmarkGates([])).toThrow(/required benchmark|empty/iu); const input = metrics(10); const result = evaluateBenchmarkGates(input, createIndependentBenchmarkOracle({ cleanDigest: "same-wrong", incrementalDigest: "same-wrong", independentDigest: "independent-correct" })); expect(result.releaseAllowed).toBe(false); expect(result.failures).toContainEqual(expect.objectContaining({ metricId: "independent-conformance" })); expect(() => evaluateBenchmarkGates(input.map((metric, index) => index === 0 ? { ...metric, numerator: metric.numerator + 1 } : metric), createIndependentBenchmarkOracle({ cleanDigest: "same", incrementalDigest: "same", independentDigest: "same" }))).toThrow(/raw|numerator/iu);
  });

  it("builds immutable disjoint held-out/mutation manifests with deterministic replay aggregates", () => {
    const manifest = createBenchmarkManifest({ seed: 19, fixtures: [{ id: "train:a", class: "training", contentHash: "sha256:v1:a" }, { id: "held:b", class: "held-out", contentHash: "sha256:v1:b" }, { id: "mutation:c", class: "mutation", contentHash: "sha256:v1:c" }] }); expect(Object.isFrozen(manifest.fixtures)).toBe(true); expect(replayBenchmarkManifest(manifest).aggregateHash).toBe(manifest.aggregateHash); expect(() => createBenchmarkManifest({ seed: 1, fixtures: [] })).toThrow(/empty|fixture/iu); expect(() => createBenchmarkManifest({ seed: 1, fixtures: [{ id: "same", class: "training", contentHash: "sha256:v1:a" }, { id: "same", class: "held-out", contentHash: "sha256:v1:a" }] })).toThrow(/disjoint|duplicate/iu);
  });
});
