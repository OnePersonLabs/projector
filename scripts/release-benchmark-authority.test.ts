import { describe, expect, it } from "vitest";
import { hashFramedDomain } from "../packages/core/src/index.js";
import { BENCHMARK_GATE_REGISTRY, createBenchmarkCaseCorpus, createBenchmarkCaseObservation } from "../packages/testkit/src/benchmark.js";
import { compileReleaseBenchmarkMetrics } from "./release-benchmark-authority.mjs";
import { runProductionBenchmarkCaseCorpora } from "./release-benchmark-experiments.mjs";

const sourceHash = hashFramedDomain("benchmark-test-source", "fixture");
function observations() {
  return BENCHMARK_GATE_REGISTRY.map((definition) => {
    const positiveOutput = JSON.stringify({ testPath: definition.testPath, exactTestIdentity: definition.exactTestIdentity, assertion: { fullName: definition.exactTestIdentity, status: "passed" } });
    const negativeControlOutput = JSON.stringify({ testPath: definition.negativeControlTestPath, exactTestIdentity: definition.negativeControlTestIdentity, assertion: { fullName: definition.negativeControlTestIdentity, status: "passed" } });
    const positiveOutputHash = hashFramedDomain("benchmark-exact-test-observation", positiveOutput); const negativeControlOutputHash = hashFramedDomain("benchmark-exact-negative-control-observation", negativeControlOutput);
    return { definition, positiveOutput, negativeControlOutput, positiveOutputHash, negativeControlOutputHash, positiveSourceHash: sourceHash, negativeControlSourceHash: sourceHash, trialObservations: { positive: { output: positiveOutput, outputHash: positiveOutputHash, sourceHash }, negativeControl: { output: negativeControlOutput, outputHash: negativeControlOutputHash, sourceHash } } };
  });
}
describe("release benchmark executable authority", () => {
  it("derives every gate metric from authenticated trials and production context bytes", async () => {
    const caseCorpora = await runProductionBenchmarkCaseCorpora(process.cwd());
    const result = compileReleaseBenchmarkMetrics(observations(), caseCorpora);
    expect(result).toHaveLength(17);
    expect(result.every((metric) => metric.value === metric.numerator / metric.denominator)).toBe(true);
    expect(result.every((metric) => metric.caseCorpus.cases.length > 1)).toBe(true);
    expect(result.find(({ id }) => id === "context-reduction")?.caseCorpus.cases.map(({ caseId }) => caseId).sort()).toEqual(["full-semantic-graph", "repository"]);
    expect(result.every(({ passed }) => passed)).toBe(true);

    const missing = new Map(caseCorpora); missing.delete("required-recall");
    expect(() => compileReleaseBenchmarkMetrics(observations(), missing)).toThrow(/case corpus is missing/iu);
    const fabricated = new Map(caseCorpora); const required = fabricated.get("required-recall")!; const firstCase = required.cases[0]!; fabricated.set("required-recall", { ...required, cases: [{ ...firstCase, observedOutput: JSON.stringify({ items: [] }) }, ...required.cases.slice(1)] });
    expect(() => compileReleaseBenchmarkMetrics(observations(), fabricated)).toThrow(/hash|corpus/iu);
    const rehashed = new Map(caseCorpora); const definition = BENCHMARK_GATE_REGISTRY.find(({ gate }) => gate.id === "required-recall")!; const failed = createBenchmarkCaseObservation("required-recall", { caseId: firstCase.caseId, input: firstCase.input, expectedOutput: firstCase.expectedOutput, observedOutput: JSON.stringify({ items: [] }), sourceBytes: firstCase.sourceBytes }); const failedCorpus = createBenchmarkCaseCorpus(definition, required.evaluator, [failed, ...required.cases.slice(1)]); rehashed.set("required-recall", failedCorpus);
    expect(compileReleaseBenchmarkMetrics(observations(), rehashed).find(({ id }) => id === "required-recall")?.passed).toBe(false);
  });
});
