import { describe, expect, it } from "vitest";
import { REQUIRED_BENCHMARK_GATES, createBenchmarkManifest, createBenchmarkMetrics, createIndependentBenchmarkOracle, evaluateBenchmarkGates, replayBenchmarkManifest } from "./benchmark.js";

const fixtureBytes = (id: string, patch: Record<string, readonly number[]> = {}) => JSON.stringify({ artifact: { id, exitCode: 0 }, samples: Object.fromEntries(REQUIRED_BENCHMARK_GATES.map(({ id: gateId, direction }) => [gateId, patch[gateId] ?? [direction === "minimum" ? (gateId === "context-reduction" ? 3 : 1) : 0]])) });
const manifest = (patch: Record<string, readonly number[]> = {}) => createBenchmarkManifest({ seed: 19, fixtures: [{ id: "train:a", class: "training", bytes: fixtureBytes("train", patch) }, { id: "held:b", class: "held-out", bytes: fixtureBytes("held", patch) }, { id: "mutation:c", class: "mutation", bytes: fixtureBytes("mutation", patch) }, { id: "struct:d", class: "structural-variant", bytes: fixtureBytes("structural", patch) }] });

describe("held-out benchmark and mutation gates", () => {
  it("derives every gate from held-out, mutation, and structural raw executions", () => {
    const fixtures = manifest();
    const generated = createBenchmarkMetrics(fixtures, "repository:release"); expect(generated).toHaveLength(17); expect(generated.every(({ rawEvidence }) => new Set(rawEvidence.map(({ fixtureClass }) => fixtureClass)).size === 3)).toBe(true); const forged = generated.map((metric, index) => index === 0 ? { ...metric, numerator: 300, rawEvidence: metric.rawEvidence.map((raw) => ({ ...raw, numerator: 100 })) } : metric); expect(() => evaluateBenchmarkGates(forged, createIndependentBenchmarkOracle({ cleanDigest: "same", incrementalDigest: "same", independentDigest: "same" }))).toThrow(/fixture|sample|evidence|hash/iu);
  });
  it("uses 17 exact scoped gates, keeps zero denominators unavailable, and protects correctness", () => {
    expect(REQUIRED_BENCHMARK_GATES).toHaveLength(17); const input = createBenchmarkMetrics(manifest({ "irrelevant-expansion": [1] }), "fixture:held-out"); const result = evaluateBenchmarkGates(input, createIndependentBenchmarkOracle({ cleanDigest: "same", incrementalDigest: "same", independentDigest: "same" })); expect(result.metrics.find(({ id }) => id === "required-recall")).toMatchObject({ passed: true, value: 1 }); expect(result.metrics.find(({ id }) => id === "irrelevant-expansion")?.passed).toBe(false); expect(result.releaseAllowed).toBe(false);
  });

  it("rejects caller-shaped aggregates and requires an independent oracle", () => {
    expect(() => evaluateBenchmarkGates([])).toThrow(/required benchmark|empty/iu); const input = createBenchmarkMetrics(manifest(), "fixture:held-out"); const result = evaluateBenchmarkGates(input, createIndependentBenchmarkOracle({ cleanDigest: "same-wrong", incrementalDigest: "same-wrong", independentDigest: "independent-correct" })); expect(result.releaseAllowed).toBe(false); expect(result.failures).toContainEqual(expect.objectContaining({ metricId: "independent-conformance" })); expect(() => evaluateBenchmarkGates(input.map((metric, index) => index === 0 ? { ...metric, numerator: metric.numerator + 1 } : metric), createIndependentBenchmarkOracle({ cleanDigest: "same", incrementalDigest: "same", independentDigest: "same" }))).toThrow(/raw|numerator/iu);
  });

  it("builds immutable disjoint held-out/mutation manifests with deterministic replay aggregates", () => {
    const fixtures = manifest(); expect(Object.isFrozen(fixtures.fixtures)).toBe(true); expect(replayBenchmarkManifest(fixtures).aggregateHash).toBe(fixtures.aggregateHash); expect(() => createBenchmarkManifest({ seed: 1, fixtures: [] })).toThrow(/empty|fixture/iu); expect(() => createBenchmarkManifest({ seed: 1, fixtures: [{ id: "same", class: "training", bytes: "same" }, { id: "same", class: "held-out", bytes: "same" }] })).toThrow(/disjoint|duplicate/iu);
  });
});
