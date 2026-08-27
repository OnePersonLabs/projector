import { describe, expect, it } from "vitest";
import { access } from "node:fs/promises";
import { hashFramedDomain } from "@projector/core";
import { BENCHMARK_GATE_REGISTRY, REQUIRED_BENCHMARK_GATES, benchmarkGatePassed, createBenchmarkCaseCorpus, createBenchmarkCaseObservation, deriveBenchmarkCorpusMeasurement, validateBenchmarkMetrics, verifyBenchmarkTestReport, type BenchmarkCaseEvaluator, type BenchmarkMetricResult } from "./benchmark.js";

const digest = hashFramedDomain("benchmark-test", "fixture");
function metricFixtures(): BenchmarkMetricResult[] {
  return BENCHMARK_GATE_REGISTRY.map((definition) => {
    const positiveOutput = JSON.stringify({ testPath: definition.testPath, exactTestIdentity: definition.exactTestIdentity, assertion: { fullName: definition.exactTestIdentity, status: "passed" } });
    const negativeControlOutput = JSON.stringify({ testPath: definition.negativeControlTestPath, exactTestIdentity: definition.negativeControlTestIdentity, assertion: { fullName: definition.negativeControlTestIdentity, status: "passed" } });
    const positiveOutputHash = hashFramedDomain("benchmark-exact-test-observation", positiveOutput); const negativeControlOutputHash = hashFramedDomain("benchmark-exact-negative-control-observation", negativeControlOutput);
    const evaluator: BenchmarkCaseEvaluator = definition.gate.id === "required-recall" || definition.gate.id === "governing-entity-recall" ? "set-recall" : definition.gate.id === "irrelevant-expansion" || definition.gate.id === "irrelevant-context-expansion" ? "irrelevant-rate" : definition.gate.id === "deterministic-mutation" ? "success-rate" : definition.gate.id === "context-reduction" ? "two-baseline-byte-reduction" : definition.gate.id === "transaction-recovery" ? "crash-recovery-rate" : "defect-rate";
    const cases = [0, 1].map((index) => {
      const expectedOutput = evaluator === "set-recall" || evaluator === "irrelevant-rate" ? JSON.stringify({ items: [`known:${index}`] }) : evaluator === "two-baseline-byte-reduction" ? JSON.stringify({ baseline: index === 0 ? "repository" : "full-semantic-graph" }) : JSON.stringify({ outcome: "expected" });
      const observedOutput = evaluator === "two-baseline-byte-reduction" ? JSON.stringify({ baseline: index === 0 ? "repository" : "full-semantic-graph", baselineBytes: 240 + index * 20, scopedBytes: 100 }) : expectedOutput;
      return createBenchmarkCaseObservation(definition.gate.id, { caseId: `case-${index}`, input: JSON.stringify({ index }), expectedOutput, observedOutput, sourceBytes: `fixture source ${index}` });
    });
    const caseCorpus = createBenchmarkCaseCorpus(definition, evaluator, cases); const measurement = deriveBenchmarkCorpusMeasurement(definition, caseCorpus);
    const caseEvidence = cases.flatMap(({ inputHash, expectedOutputHash, observedOutputHash, sourceBytesHash }) => [inputHash, expectedOutputHash, observedOutputHash, sourceBytesHash]);
    return { ...definition.gate, scope: definition.experimentId, ...measurement, status: "measured" as const, passed: benchmarkGatePassed(definition.gate, measurement.value), evidenceIds: [positiveOutputHash, digest, caseCorpus.corpusHash, ...caseEvidence], negativeControlEvidenceIds: [negativeControlOutputHash, digest], trialObservations: { positive: { output: positiveOutput, outputHash: positiveOutputHash, sourceHash: digest }, negativeControl: { output: negativeControlOutput, outputHash: negativeControlOutputHash, sourceHash: digest } }, caseCorpus };
  });
}

describe("release benchmark inventory", () => {
  it("keeps one explicit runnable experiment for each exact immutable gate", async () => {
    expect(REQUIRED_BENCHMARK_GATES).toHaveLength(17);
    expect(Object.isFrozen(REQUIRED_BENCHMARK_GATES)).toBe(true);
    expect(BENCHMARK_GATE_REGISTRY.map(({ gate }) => gate.id)).toEqual(REQUIRED_BENCHMARK_GATES.map(({ id }) => id));
    expect(new Set(BENCHMARK_GATE_REGISTRY.map(({ experimentId }) => experimentId)).size).toBe(17);
    expect(new Set(BENCHMARK_GATE_REGISTRY.map(({ exactTestIdentity }) => exactTestIdentity)).size).toBe(17);
    for (const definition of BENCHMARK_GATE_REGISTRY) {
      await expect(access(definition.testPath)).resolves.toBeUndefined();
      await expect(access(definition.negativeControlTestPath)).resolves.toBeUndefined();
      expect(definition.exactTestIdentity.length).toBeGreaterThan(20);
      expect(definition.negativeControlTestIdentity.length).toBeGreaterThan(20);
      expect(definition.negativeControlTestIdentity).not.toBe(definition.exactTestIdentity);
    }
  });

  it("rejects a missing or renamed exact assertion identity", () => {
    const byPath = new Map<string, Array<{ ancestorTitles: string[]; fullName: string; status: string }>>();
    for (const definition of BENCHMARK_GATE_REGISTRY) {
      for (const [path, fullName] of [[definition.testPath, definition.exactTestIdentity], [definition.negativeControlTestPath, definition.negativeControlTestIdentity]] as const) {
        const assertions = byPath.get(path) ?? [];
        if (!assertions.some((assertion) => assertion.fullName === fullName)) assertions.push({ ancestorTitles: [], fullName, status: "passed" });
        byPath.set(path, assertions);
      }
    }
    const report = { success: true, testResults: [...byPath].map(([name, assertionResults]) => ({ name, status: "passed", assertionResults })) };
    expect(verifyBenchmarkTestReport(report).size).toBe(17);
    const renamed = structuredClone(report);
    renamed.testResults[0]!.assertionResults[0]!.fullName += " renamed";
    expect(() => verifyBenchmarkTestReport(renamed)).toThrow(/exact test identity/iu);
    const missingControl = structuredClone(report);
    const first = BENCHMARK_GATE_REGISTRY[0]!;
    const controlFile = missingControl.testResults.find(({ name }) => name === first.negativeControlTestPath)!;
    controlFile.assertionResults = controlFile.assertionResults.filter(({ fullName }) => fullName !== first.negativeControlTestIdentity);
    expect(() => verifyBenchmarkTestReport(missingControl)).toThrow(/negative-control identity/iu);
  });

  it("rejects fabricated trial outcomes and inconsistent numerator semantics", () => {
    const metrics = metricFixtures(); expect(() => validateBenchmarkMetrics(metrics)).not.toThrow();
    const forgedStatus = structuredClone(metrics); const positive = forgedStatus[0]!.trialObservations.positive; const forgedOutput = positive.output.replace('"status":"passed"', '"status":"failed"'); forgedStatus[0] = { ...forgedStatus[0]!, trialObservations: { ...forgedStatus[0]!.trialObservations, positive: { ...positive, output: forgedOutput, outputHash: hashFramedDomain("benchmark-exact-test-observation", forgedOutput) } } };
    expect(() => validateBenchmarkMetrics(forgedStatus)).toThrow(/trial|assertion/iu);
    const inconsistentCount = structuredClone(metrics); inconsistentCount[0] = { ...inconsistentCount[0]!, numerator: 0 };
    expect(() => validateBenchmarkMetrics(inconsistentCount)).toThrow(/numerator|inconsistent/iu);
    const fabricatedHash = structuredClone(metrics); fabricatedHash[0] = { ...fabricatedHash[0]!, trialObservations: { ...fabricatedHash[0]!.trialObservations, negativeControl: { ...fabricatedHash[0]!.trialObservations.negativeControl, outputHash: digest } } };
    expect(() => validateBenchmarkMetrics(fabricatedHash)).toThrow(/trial|hash/iu);
  });

  it("rejects binary assertion proxies and metrics without an authenticated executed case corpus", () => {
    const binaryProxies = metricFixtures().map((metric) => ({ ...metric, caseCorpus: createBenchmarkCaseCorpus(BENCHMARK_GATE_REGISTRY.find(({ gate }) => gate.id === metric.id)!, metric.caseCorpus.evaluator, metric.caseCorpus.cases.slice(0, 1)) }));
    expect(() => validateBenchmarkMetrics(binaryProxies)).toThrow(/case corpus|binary proxy/iu);
  });
});
