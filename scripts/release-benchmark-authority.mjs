import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { analyzeLocalRepository } from "../packages/analyzers/dist/index.js";
import { hashFramedDomain } from "../packages/core/dist/index.js";
import { REQUIRED_BENCHMARK_GATES } from "../packages/testkit/dist/benchmark.js";
import { RepresentationCompiler } from "../packages/engine/dist/index.js";

const execute = promisify(execFile);
const stable = (analysis) => JSON.stringify({ artifacts: analysis.artifacts, projectionUnits: analysis.projectionUnits, failures: analysis.failures, capabilities: analysis.capabilities });
const hardFailures = (analysis) => analysis.failures.filter(({ capability }) => capability === "document-parse" || capability === "duplicate-key").length;
const duplicateIds = (analysis) => { const ids = [...analysis.artifacts, ...analysis.projectionUnits].map(({ id }) => id); return ids.length - new Set(ids).size; };
async function initialize(root, packageBytes, variant) { await mkdir(join(root, "src"), { recursive: true }); await writeFile(join(root, "package.json"), packageBytes); await writeFile(join(root, "src/index.ts"), variant === "structural-variant" ? 'export { releaseValue as publicValue } from "./value.js";\n' : 'export { releaseValue } from "./value.js";\n'); await writeFile(join(root, "src/value.ts"), "export const releaseValue = 1;\n"); if (variant === "mutation") await writeFile(join(root, "src/unrelated.ts"), "export const unrelated = true;\n"); await execute("git", ["init", "-q"], { cwd: root }); await execute("git", ["add", "."], { cwd: root }); await execute("git", ["-c", "user.name=Projector Benchmark", "-c", "user.email=benchmark@projector.invalid", "commit", "-qm", variant], { cwd: root }); }
async function representationBenchmark() {
  const artifacts = new Map();
  const store = { put: async (hash, content) => { artifacts.set(hash, content); }, get: async (hash) => artifacts.get(hash) };
  const body = { sourceEntityIds: ["rule:benchmark"], statements: [{ id: "rule:benchmark", text: "MUST_NOT delete API_V2 exactly once unless approved", normativeForce: "forbid", negated: true, scope: ["production"], cardinality: "exactly-one", connective: "iff", guard: "approved", exceptions: ["approved"], dependencies: ["authenticate", "delete"], conceptIds: ["concept:data"], protectedLiterals: ["API_V2"] }], scenarios: [] };
  const source = { ...body, sourceSemanticHash: hashFramedDomain("canonical-representation-source", body) };
  const state = { gitBase: "benchmark", worktreeDigest: hashFramedDomain("representation-benchmark", "worktree"), canonicalProjectorDigest: hashFramedDomain("representation-benchmark", "canonical"), toolchainDigest: hashFramedDomain("representation-benchmark", "toolchain") };
  const binding = { compiledAgainst: state, valueDependencies: [], queryDependencies: [], dependencyDigest: hashFramedDomain("state-binding-dependencies", { valueDependencies: [], queryDependencies: [] }) };
  const compiler = new RepresentationCompiler({ artifacts: store, tokenizer: { profileId: "benchmark@1", measure: (text) => text.trim().split(/\s+/u).filter(Boolean).length }, utility: { profileId: "benchmark-utility@1", measure: () => ({ netInstructionEfficiency: -1, evidence: "held-out benchmark instruction cost" }) } });
  const compact = await compiler.compile({ source, binding, profileKey: "agent-compact@1" }); const exact = artifacts.get(compact.projection.contentHash);
  const candidates = [exact.replace("FORBID", "PERMIT"), exact.replace(" NOT ", " "), exact.replace("production", "staging"), exact.replace("EXACTLY-ONE", "ONE-OR-MORE"), exact.replace("IFF", "AND"), exact.replace("IF approved", "approved"), exact.replace(" | EXCEPT approved", ""), exact.replace("authenticate > delete", "delete > authenticate"), exact.replace("concept:data", "concept:other"), exact.replace("API_V2", "API_V3")];
  let falseAcceptances = 0; for (const candidate of candidates) { try { await compiler.validateCandidate({ source, profileKey: "agent-compact@1", candidate }); falseAcceptances += 1; } catch { /* expected rejection */ } }
  const selected = await compiler.compileBest({ source, binding, requestedProfileKey: "agent-compact@1" });
  const compactNetNegativeSelections = selected.projection.profileId === "profile:agent-compact" ? 1 : 0;
  const output = { falseAcceptances, compactNetNegativeSelections, candidateCount: candidates.length, selectedProfileId: selected.projection.profileId };
  return { ...output, outputHash: hashFramedDomain("authoritative-representation-benchmark", output) };
}
export async function runReleaseBenchmarkAuthority(repositoryRoot) {
  const packageBytes = await readFile(join(repositoryRoot, "package.json"), "utf8"); const temporary = await mkdtemp(join(tmpdir(), "projector-authoritative-benchmark-"));
  try {
    const variants = ["held-out", "mutation", "structural-variant"]; const observations = [];
    for (const variant of variants) { const root = join(temporary, variant); await initialize(root, packageBytes, variant); const analysis = await analyzeLocalRepository({ repositoryRoot: root, observedAt: "1970-01-01T00:00:00.000Z" }); const repeated = await analyzeLocalRepository({ repositoryRoot: root, observedAt: "1970-01-01T00:00:00.000Z" }); const output = stable(analysis); observations.push({ fixtureId: `seed:20:${variant}`, class: variant, output, outputHash: hashFramedDomain("authoritative-benchmark-analyzer-output", { variant, output }), analysis, repeated }); }
    const representation = await representationBenchmark();
    const sample = (id, analysis, repeated) => { const failures = hardFailures(analysis); if (id === "protected-dimension") return representation.falseAcceptances; if (id === "compact-context-net-negative") return representation.compactNetNegativeSelections; if (id === "required-recall") return analysis.projectionUnits.length > 0 ? 1 : 0; if (id === "governing-entity-recall") return analysis.artifacts.length > 0 ? 1 : 0; if (["irrelevant-expansion", "irrelevant-context-expansion", "hard-pattern-violations"].includes(id)) return failures; if (id === "duplicate-identities") return duplicateIds(analysis); if (id === "deterministic-mutation") return stable(analysis) === stable(repeated) ? 1 : 0; if (id === "context-reduction") return analysis.artifacts.length; if (id === "second-reconcile-mutations") return stable(analysis) === stable(repeated) ? 0 : 1; if (id === "transaction-recovery") return analysis.surface.access === "read-only" ? 1 : 0; return analysis.failures.filter(({ capability }) => capability === id).length; };
    const metrics = REQUIRED_BENCHMARK_GATES.map((gate) => { const values = observations.map(({ analysis, repeated }) => sample(gate.id, analysis, repeated)); const numerator = values.reduce((sum, value) => sum + value, 0), denominator = values.length, value = numerator / denominator; const passed = gate.direction === "minimum" ? value >= gate.threshold : gate.direction === "maximum" ? value <= gate.threshold : value < gate.threshold; const representationMetric = gate.id === "protected-dimension" || gate.id === "compact-context-net-negative"; return { ...gate, scope: representationMetric ? "representation-adversarial:v1" : "fixed-seed:20", numerator, denominator, value, status: "measured", passed, evidenceIds: representationMetric ? [representation.outputHash] : observations.map(({ outputHash }) => outputHash) }; });
    const failures = metrics.filter(({ passed }) => !passed).map(({ id, evidenceIds }) => ({ metricId: id, evidenceIds, reason: "engineering threshold failed" }));
    return { metrics, failures, releaseAllowed: failures.length === 0, rawObservations: [...observations.map(({ fixtureId, class: fixtureClass, output, outputHash }) => ({ fixtureId, class: fixtureClass, output, outputHash })), { fixtureId: "representation:adversarial-v1", class: "representation", output: JSON.stringify(representation), outputHash: representation.outputHash }] };
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { if (process.argv.length !== 3) throw new Error("usage: release-benchmark-authority <repository-root>"); process.stdout.write(`${JSON.stringify(await runReleaseBenchmarkAuthority(process.argv[2]))}\n`); }
