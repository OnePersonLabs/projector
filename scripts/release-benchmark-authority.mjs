import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { analyzeLocalRepository } from "../packages/analyzers/dist/index.js";
import { hashFramedDomain } from "../packages/core/dist/index.js";
import { BENCHMARK_GATE_REGISTRY, benchmarkGatePassed, deriveBenchmarkCorpusMeasurement, validateBenchmarkMetrics, verifyBenchmarkTestReport } from "../packages/testkit/dist/benchmark.js";
import { runProductionBenchmarkCaseCorpora } from "./release-benchmark-experiments.mjs";

const execute = promisify(execFile);
const authorityRoot = fileURLToPath(new URL("../", import.meta.url));
const stable = (analysis) => JSON.stringify({ artifacts: analysis.artifacts, projectionUnits: analysis.projectionUnits, failures: analysis.failures, capabilities: analysis.capabilities });
async function initialize(root, packageBytes, variant) { await mkdir(join(root, "src"), { recursive: true }); await writeFile(join(root, "package.json"), packageBytes); await writeFile(join(root, "src/index.ts"), variant === "structural-variant" ? 'export { releaseValue as publicValue } from "./value.js";\n' : 'export { releaseValue } from "./value.js";\n'); await writeFile(join(root, "src/value.ts"), "export const releaseValue = 1;\n"); if (variant === "mutation") await writeFile(join(root, "src/unrelated.ts"), "export const unrelated = true;\n"); await execute("git", ["init", "-q"], { cwd: root }); await execute("git", ["add", "."], { cwd: root }); await execute("git", ["-c", "user.name=Projector Benchmark", "-c", "user.email=benchmark@projector.invalid", "commit", "-qm", variant], { cwd: root }); }
export function compileReleaseBenchmarkMetrics(experimentObservations, caseCorpora) {
  const metrics = experimentObservations.map(({ definition, positiveOutputHash, negativeControlOutputHash, positiveSourceHash, negativeControlSourceHash, trialObservations }) => { const caseCorpus = caseCorpora.get(definition.gate.id); if (caseCorpus === undefined) throw new Error(`benchmark case corpus is missing: ${definition.gate.id}`); const measurement = deriveBenchmarkCorpusMeasurement(definition, caseCorpus); const caseEvidenceIds = caseCorpus.cases.flatMap(({ inputHash, expectedOutputHash, observedOutputHash, sourceBytesHash }) => [inputHash, expectedOutputHash, observedOutputHash, sourceBytesHash]); return { ...definition.gate, scope: definition.experimentId, ...measurement, status: "measured", passed: benchmarkGatePassed(definition.gate, measurement.value), evidenceIds: [positiveOutputHash, positiveSourceHash, caseCorpus.corpusHash, ...caseEvidenceIds], negativeControlEvidenceIds: [negativeControlOutputHash, negativeControlSourceHash], trialObservations, caseCorpus }; });
  validateBenchmarkMetrics(metrics);
  return metrics;
}
export async function runReleaseBenchmarkAuthority(repositoryRoot) {
  const packageBytes = await readFile(join(repositoryRoot, "package.json"), "utf8"); const temporary = await mkdtemp(join(tmpdir(), "projector-authoritative-benchmark-"));
  try {
    const benchmarkTestPaths = [...new Set(BENCHMARK_GATE_REGISTRY.flatMap(({ testPath, negativeControlTestPath }) => [testPath, negativeControlTestPath]))].sort();
    const benchmarkTestIdentities = [...new Set(BENCHMARK_GATE_REGISTRY.flatMap(({ exactTestIdentity, negativeControlTestIdentity }) => [exactTestIdentity, negativeControlTestIdentity]))];
    const testNamePattern = `^(?:${benchmarkTestIdentities.map((identity) => identity.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|")})$`;
    const vitest = join(authorityRoot, "node_modules/vitest/vitest.mjs");
    const reporterOutput = (await execute(process.execPath, [vitest, "run", ...benchmarkTestPaths, "--testNamePattern", testNamePattern, "--reporter=json"], { cwd: authorityRoot, encoding: "utf8", maxBuffer: 30_000_000 })).stdout;
    const report = JSON.parse(reporterOutput); const verifiedAssertions = verifyBenchmarkTestReport(report);
    const caseCorpora = await runProductionBenchmarkCaseCorpora(repositoryRoot);
    const variants = ["held-out", "mutation", "structural-variant"]; const observations = [];
    for (const variant of variants) { const root = join(temporary, variant); await initialize(root, packageBytes, variant); const analysis = await analyzeLocalRepository({ repositoryRoot: root, observedAt: "1970-01-01T00:00:00.000Z" }); const repeated = await analyzeLocalRepository({ repositoryRoot: root, observedAt: "1970-01-01T00:00:00.000Z" }); const output = stable(analysis); observations.push({ fixtureId: `seed:20:${variant}`, class: variant, output, outputHash: hashFramedDomain("authoritative-benchmark-analyzer-output", { variant, output }), analysis, repeated }); }
    const experimentObservations = await Promise.all(BENCHMARK_GATE_REGISTRY.map(async (definition) => {
      const assertions = verifiedAssertions.get(definition.experimentId);
      const positiveOutput = JSON.stringify({ testPath: definition.testPath, exactTestIdentity: definition.exactTestIdentity, assertion: assertions.positive });
      const negativeControlOutput = JSON.stringify({ testPath: definition.negativeControlTestPath, exactTestIdentity: definition.negativeControlTestIdentity, assertion: assertions.negativeControl });
      const positiveOutputHash = hashFramedDomain("benchmark-exact-test-observation", positiveOutput); const negativeControlOutputHash = hashFramedDomain("benchmark-exact-negative-control-observation", negativeControlOutput); const positiveSourceHash = hashFramedDomain("benchmark-experiment-source-bytes", await readFile(join(authorityRoot, definition.testPath), "utf8")); const negativeControlSourceHash = hashFramedDomain("benchmark-negative-control-source-bytes", await readFile(join(authorityRoot, definition.negativeControlTestPath), "utf8"));
      return { definition, positiveOutput, negativeControlOutput, positiveOutputHash, negativeControlOutputHash, positiveSourceHash, negativeControlSourceHash, trialObservations: { positive: { output: positiveOutput, outputHash: positiveOutputHash, sourceHash: positiveSourceHash }, negativeControl: { output: negativeControlOutput, outputHash: negativeControlOutputHash, sourceHash: negativeControlSourceHash } } };
    }));
    const metrics = compileReleaseBenchmarkMetrics(experimentObservations, caseCorpora);
    const failures = metrics.filter(({ passed }) => !passed).map(({ id, evidenceIds }) => ({ metricId: id, evidenceIds, reason: "engineering threshold failed" }));
    const registryObservations = experimentObservations.flatMap(({ definition, positiveOutput, negativeControlOutput, positiveOutputHash, negativeControlOutputHash }) => [
      { fixtureId: `experiment:${definition.experimentId}`, class: "experiment", output: positiveOutput, outputHash: positiveOutputHash },
      { fixtureId: `negative-control:${definition.experimentId}`, class: "negative-control", output: negativeControlOutput, outputHash: negativeControlOutputHash },
    ]);
    const representationOutput = JSON.stringify(caseCorpora.get("protected-dimension")); const representationOutputHash = hashFramedDomain("authoritative-representation-benchmark", representationOutput);
    return { metrics, failures, releaseAllowed: failures.length === 0, rawObservations: [...observations.map(({ fixtureId, class: fixtureClass, output, outputHash }) => ({ fixtureId, class: fixtureClass, output, outputHash })), { fixtureId: "representation:adversarial-v1", class: "representation", output: representationOutput, outputHash: representationOutputHash }, ...registryObservations] };
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { if (process.argv.length !== 3) throw new Error("usage: release-benchmark-authority <repository-root>"); process.stdout.write(`${JSON.stringify(await runReleaseBenchmarkAuthority(process.argv[2]))}\n`); }
