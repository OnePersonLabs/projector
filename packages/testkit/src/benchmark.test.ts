import { describe, expect, it } from "vitest";
import { createBenchmarkManifest, evaluateBenchmarkGates, replayBenchmarkManifest } from "./benchmark.js";

describe("held-out benchmark and mutation gates", () => {
  it("uses exact thresholds, keeps zero denominators unavailable, and protects correctness before efficiency", () => {
    const result = evaluateBenchmarkGates([{ id: "required-recall", numerator: 95, denominator: 100, threshold: 0.95, direction: "minimum", observability: "closed", evidenceIds: ["e:recall"] }, { id: "irrelevant-expansion", numerator: 10, denominator: 100, threshold: 0.1, direction: "strict-maximum", observability: "closed", evidenceIds: ["e:expansion"] }, { id: "empty", numerator: 0, denominator: 0, threshold: 1, direction: "minimum", observability: "closed", evidenceIds: [] }, { id: "protected-dimension", numerator: 0, denominator: 1, threshold: 1, direction: "minimum", observability: "closed", protectedDimension: true, evidenceIds: ["e:fidelity"] }]);
    expect(result.metrics.find(({ id }) => id === "required-recall")).toMatchObject({ passed: true, value: 0.95 }); expect(result.metrics.find(({ id }) => id === "irrelevant-expansion")?.passed).toBe(false); expect(result.metrics.find(({ id }) => id === "empty")?.status).toBe("unavailable"); expect(result.releaseAllowed).toBe(false);
  });

  it("requires an independent oracle to catch a shared clean/incremental bug", () => {
    const result = evaluateBenchmarkGates([], { cleanDigest: "same-wrong", incrementalDigest: "same-wrong", independentConformancePassed: false }); expect(result.releaseAllowed).toBe(false); expect(result.failures).toContainEqual(expect.objectContaining({ metricId: "independent-conformance" }));
  });

  it("builds immutable disjoint held-out/mutation manifests with deterministic replay aggregates", () => {
    const manifest = createBenchmarkManifest({ seed: 19, fixtures: [{ id: "train:a", class: "training", contentHash: "sha256:v1:a" }, { id: "held:b", class: "held-out", contentHash: "sha256:v1:b" }, { id: "mutation:c", class: "mutation", contentHash: "sha256:v1:c" }] }); expect(Object.isFrozen(manifest.fixtures)).toBe(true); expect(replayBenchmarkManifest(manifest).aggregateHash).toBe(manifest.aggregateHash); expect(() => createBenchmarkManifest({ seed: 1, fixtures: [{ id: "same", class: "training", contentHash: "sha256:v1:a" }, { id: "same", class: "held-out", contentHash: "sha256:v1:a" }] })).toThrow(/disjoint|duplicate/iu);
  });
});
