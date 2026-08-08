import { describe, expect, it } from "vitest";
import { REQUIRED_BENCHMARK_GATES, createBenchmarkManifest, createIndependentBenchmarkOracle, evaluateBenchmarkGates, replayBenchmarkManifest } from "./benchmark.js";

describe("held-out benchmark and mutation gates", () => {
  it("uses exact thresholds, keeps zero denominators unavailable, and protects correctness before efficiency", () => {
    const metrics = REQUIRED_BENCHMARK_GATES.map((gate) => ({ ...gate, numerator: gate.direction === "minimum" ? gate.threshold * 100 : 0, denominator: 100, observability: "closed" as const, evidenceIds: [`e:${gate.id}`] })).map((metric) => metric.id === "irrelevant-expansion" ? { ...metric, numerator: 10 } : metric.id === "protected-dimension" ? { ...metric, numerator: 0, denominator: 0 } : metric); const result = evaluateBenchmarkGates(metrics, createIndependentBenchmarkOracle({ cleanDigest: "same", incrementalDigest: "same", independentDigest: "same" }));
    expect(result.metrics.find(({ id }) => id === "required-recall")).toMatchObject({ passed: true, value: 0.95 }); expect(result.metrics.find(({ id }) => id === "irrelevant-expansion")?.passed).toBe(false); expect(result.metrics.find(({ id }) => id === "protected-dimension")?.status).toBe("unavailable"); expect(result.releaseAllowed).toBe(false);
  });

  it("requires an independent oracle to catch a shared clean/incremental bug", () => {
    expect(() => evaluateBenchmarkGates([])).toThrow(/required benchmark|empty/iu); const metrics = REQUIRED_BENCHMARK_GATES.map((gate) => ({ ...gate, numerator: gate.direction === "minimum" ? gate.threshold * 100 : 0, denominator: 100, observability: "closed" as const, evidenceIds: [`e:${gate.id}`] })); const result = evaluateBenchmarkGates(metrics, createIndependentBenchmarkOracle({ cleanDigest: "same-wrong", incrementalDigest: "same-wrong", independentDigest: "independent-correct" })); expect(result.releaseAllowed).toBe(false); expect(result.failures).toContainEqual(expect.objectContaining({ metricId: "independent-conformance" }));
  });

  it("builds immutable disjoint held-out/mutation manifests with deterministic replay aggregates", () => {
    const manifest = createBenchmarkManifest({ seed: 19, fixtures: [{ id: "train:a", class: "training", contentHash: "sha256:v1:a" }, { id: "held:b", class: "held-out", contentHash: "sha256:v1:b" }, { id: "mutation:c", class: "mutation", contentHash: "sha256:v1:c" }] }); expect(Object.isFrozen(manifest.fixtures)).toBe(true); expect(replayBenchmarkManifest(manifest).aggregateHash).toBe(manifest.aggregateHash); expect(() => createBenchmarkManifest({ seed: 1, fixtures: [] })).toThrow(/empty|fixture/iu); expect(() => createBenchmarkManifest({ seed: 1, fixtures: [{ id: "same", class: "training", contentHash: "sha256:v1:a" }, { id: "same", class: "held-out", contentHash: "sha256:v1:a" }] })).toThrow(/disjoint|duplicate/iu);
  });
});
