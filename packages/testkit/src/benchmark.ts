import { hashFramedDomain, type ContentHash } from "@projector/core";

export interface BenchmarkGateDefinition { readonly id: string; readonly threshold: number; readonly direction: "minimum" | "maximum" | "strict-maximum"; readonly protectedDimension?: boolean }
export const REQUIRED_BENCHMARK_GATES: readonly BenchmarkGateDefinition[] = Object.freeze([
  { id: "required-recall", threshold: 0.95, direction: "minimum" }, { id: "governing-entity-recall", threshold: 0.95, direction: "minimum" }, { id: "irrelevant-expansion", threshold: 0.1, direction: "strict-maximum" }, { id: "irrelevant-context-expansion", threshold: 0.2, direction: "strict-maximum" }, { id: "duplicate-identities", threshold: 0, direction: "maximum", protectedDimension: true }, { id: "deterministic-mutation", threshold: 0.5, direction: "minimum" }, { id: "hard-pattern-violations", threshold: 0, direction: "maximum", protectedDimension: true }, { id: "context-reduction", threshold: 2, direction: "minimum" }, { id: "second-reconcile-mutations", threshold: 0, direction: "maximum", protectedDimension: true }, { id: "binding-false-stale", threshold: 0, direction: "maximum", protectedDimension: true }, { id: "binding-false-current", threshold: 0, direction: "maximum", protectedDimension: true }, { id: "false-proven-claims", threshold: 0, direction: "maximum", protectedDimension: true }, { id: "transaction-recovery", threshold: 1, direction: "minimum", protectedDimension: true }, { id: "endogenous-authority-increase", threshold: 0, direction: "maximum", protectedDimension: true }, { id: "stale-derivation-proof", threshold: 0, direction: "maximum", protectedDimension: true }, { id: "protected-dimension", threshold: 0, direction: "maximum", protectedDimension: true }, { id: "compact-context-net-negative", threshold: 0, direction: "maximum", protectedDimension: true },
]);

export interface BenchmarkExperimentDefinition {
  readonly experimentId: string;
  readonly gate: BenchmarkGateDefinition;
  readonly testPath: string;
  readonly exactTestIdentity: string;
  readonly publicFacade: string;
  readonly negativeControlTestPath: string;
  readonly negativeControlTestIdentity: string;
}
const gates = new Map(REQUIRED_BENCHMARK_GATES.map((gate) => [gate.id, gate]));
const experiment = (gateId: string, experimentId: string, testPath: string, exactTestIdentity: string, publicFacade: string, negativeControlTestIdentity: string, negativeControlTestPath = testPath): BenchmarkExperimentDefinition => {
  const gate = gates.get(gateId); if (gate === undefined) throw new Error(`unknown benchmark gate ${gateId}`);
  return Object.freeze({ experimentId, gate, testPath, exactTestIdentity, publicFacade, negativeControlTestPath, negativeControlTestIdentity });
};

export const BENCHMARK_GATE_REGISTRY: readonly BenchmarkExperimentDefinition[] = Object.freeze([
  experiment("required-recall", "required-surface-recall-v1", "packages/control-plane/src/change-lifecycle/compiler.test.ts", "repository change compiler reuses semantic identity, binds reverse relevance, projects a spec, and compiles one exact packet", "projector/cli", "repository change compiler blocks duplicate identity candidates and invalid or expired deferrals"),
  experiment("governing-entity-recall", "governing-semantic-recall-v1", "packages/engine/src/relevance/index.test.ts", "bounded four-band Relevance Closure binds empty stopping queries and records open-world emptiness as unknown rather than absence", "projector/engine", "bounded four-band Relevance Closure keeps an open discovery lane uncertain even when it returns a known consumer"),
  experiment("irrelevant-expansion", "impact-expansion-v1", "packages/engine/src/invalidation/invalidation.test.ts", "Impact Rules, selector membership, closure provenance, and oracles records Impact Rule provenance separately from exact derivation provenance", "projector/engine", "Impact Rules, selector membership, closure provenance, and oracles keeps widen-analysis Impact Rule results in the possible frontier"),
  experiment("irrelevant-context-expansion", "semantic-context-expansion-v1", "packages/engine/src/context/index.test.ts", "bounded context and derived behavior views uses full, summary, and identity-only disclosure by semantic band without identity forks", "projector/engine", "Analysis Facets composes only applicable facets and adds obligations without selecting technology"),
  experiment("duplicate-identities", "synonymous-identity-reuse-v1", "packages/engine/src/identity/index.test.ts", "semantic identity resolution blocks create-new when an active, deprecated, superseded, or tombstoned identity still overlaps", "projector/engine", "semantic identity resolution requires an inspectable owns/excludes boundary before a genuinely distinct identity can be created"),
  experiment("deterministic-mutation", "supported-pattern-determinism-v1", "packages/runtime/src/transforms/index.test.ts", "transform registry accepts declared bounded fixed-point cycles and converges them deterministically", "projector/runtime", "transform registry rejects a bounded fixed-point cycle that does not converge within its declared limit"),
  experiment("hard-pattern-violations", "reconciliation-hard-pattern-v1", "packages/engine/src/reconciliation/index.test.ts", "mandatory vertical-slice evidence rejects evidence with a deleted load-bearing proof family for every step", "projector/engine", "mandatory vertical-slice evidence rejects labels that are not substantiated by output-linked assertions"),
  experiment("context-reduction", "scoped-context-reduction-v1", "packages/engine/src/context/index.test.ts", "bounded context and derived behavior views exposes required semantic context that overruns the soft budget", "projector/engine", "bounded context and derived behavior views uses full, summary, and identity-only disclosure by semantic band without identity forks"),
  experiment("second-reconcile-mutations", "reconciliation-fixed-point-v1", "packages/engine/src/invalidation/invalidation.test.ts", "derivation index and exact invalidation iterates an SCC proof strategy to a fixed point and refuses oscillation at the bound", "projector/engine", "derivation index and exact invalidation does not publish a cyclic proof when semantic equality hides changing structural proofs"),
  experiment("binding-false-stale", "unrelated-root-rebind-v1", "packages/integrations/src/codex/adapter.test.ts", "truthful Codex/Claude host adapters accepts a dependency-local rebound only through the authenticated binding validator", "projector/integrations", "dependency-scoped validation rebinds an unrelated root change without recomputing semantic work", "packages/engine/src/state/state-binding.test.ts"),
  experiment("binding-false-current", "changed-dependency-staleness-v1", "packages/engine/src/state/state-binding.test.ts", "dependency-scoped validation marks a changed value dependency stale", "projector/engine", "dependency-scoped validation invalidates when the result set changes even though selected value hashes are unchanged"),
  experiment("false-proven-claims", "open-world-proof-refusal-v1", "packages/engine/src/architecture/evaluation.test.ts", "scoped decision proof and StateBinding binds applicability and negative-space queries and never treats open empty results as absence", "projector/engine", "scoped decision proof and StateBinding keeps disjoint decisions valid and treats lost proof as suspect rather than migration"),
  experiment("transaction-recovery", "transaction-crash-recovery-v1", "packages/control-plane/src/change-lifecycle/service.test.ts", "repository change lifecycle service survives SIGKILL during sandbox validation, takes over the stale lease, and resumes", "projector/cli", "repository change lifecycle service returns authenticated recovery-required detail when interrupted content is a third state"),
  experiment("endogenous-authority-increase", "endogenous-authority-independence-v1", "packages/engine/src/inference/inference.test.ts", "descriptive pattern inference keeps generated members visible without turning them into independent authority or an AuthorityRecord", "projector/engine", "causal evidence grouping collapses copied occurrences and discounts Projector-generated support for its causal lens"),
  experiment("stale-derivation-proof", "engine-upgrade-derivation-invalidation-v1", "packages/engine/src/invalidation/invalidation.test.ts", "derivation index and exact invalidation marks profile-dependent derivations suspect after a signature profile upgrade", "projector/engine", "semantic signature profiles and assurance invalidates the old profile version without conflating profile identity with a path"),
  experiment("protected-dimension", "representation-protected-dimensions-v1", "packages/engine/src/representation/index.test.ts", "semantic representation compilation fails closed for independently parsed protected drift", "projector/engine", "semantic representation compilation rejects dropped scope, guards, order, identities, literals, and swapped Gherkin roles"),
  experiment("compact-context-net-negative", "compact-context-economics-v1", "packages/engine/src/representation/index.test.ts", "semantic representation compilation falls back for measured net-negative compact output but selects compact for measured positive utility", "projector/engine", "semantic representation compilation selects compact by measured net instruction efficiency and falls back when compact fidelity is unsafe"),
]);

export interface BenchmarkVitestAssertion { readonly ancestorTitles?: readonly string[]; readonly fullName?: string; readonly status?: string }
export interface BenchmarkVitestFileResult { readonly name?: string; readonly status?: string; readonly assertionResults?: readonly BenchmarkVitestAssertion[] }
export interface BenchmarkVitestReport { readonly success?: boolean; readonly testResults?: readonly BenchmarkVitestFileResult[] }
export interface VerifiedBenchmarkAssertions { readonly positive: BenchmarkVitestAssertion; readonly negativeControl: BenchmarkVitestAssertion }
export function verifyBenchmarkTestReport(report: BenchmarkVitestReport, registry: readonly BenchmarkExperimentDefinition[] = BENCHMARK_GATE_REGISTRY): ReadonlyMap<string, VerifiedBenchmarkAssertions> {
  if (report.success !== true || !Array.isArray(report.testResults)) throw new Error("benchmark Vitest run failed or returned incomplete evidence");
  const observed = new Map<string, VerifiedBenchmarkAssertions>();
  for (const definition of registry) {
    const findAssertion = (path: string, identity: string): BenchmarkVitestAssertion | undefined => report.testResults?.find(({ name }) => typeof name === "string" && (name === path || name.endsWith(`/${path}`)))?.assertionResults?.find((candidate: BenchmarkVitestAssertion) => candidate.fullName === identity && candidate.status === "passed");
    const positive = findAssertion(definition.testPath, definition.exactTestIdentity);
    if (positive === undefined) throw new Error(`benchmark exact test identity was not observed: ${definition.testPath}#${definition.exactTestIdentity}`);
    const negativeControl = findAssertion(definition.negativeControlTestPath, definition.negativeControlTestIdentity);
    if (negativeControl === undefined) throw new Error(`benchmark exact negative-control identity was not observed: ${definition.negativeControlTestPath}#${definition.negativeControlTestIdentity}`);
    observed.set(definition.experimentId, { positive, negativeControl });
  }
  return observed;
}
export function benchmarkGatePassed(gate: BenchmarkGateDefinition, value: number): boolean { return gate.direction === "minimum" ? value >= gate.threshold : gate.direction === "maximum" ? value <= gate.threshold : value < gate.threshold; }
export interface BenchmarkTrialObservation { readonly output: string; readonly outputHash: ContentHash; readonly sourceHash: ContentHash }
export interface BenchmarkTrialObservations { readonly positive: BenchmarkTrialObservation; readonly negativeControl: BenchmarkTrialObservation }
export type BenchmarkNumeratorMeaning = "matched-known-items" | "irrelevant-items" | "successful-cases" | "detected-defects" | "limiting-baseline-bytes" | "recovered-or-classified-crashes";
export type BenchmarkDenominatorMeaning = "fixture-known-items" | "observed-items" | "executed-cases" | "scoped-context-bytes" | "injected-crashes";
export type BenchmarkCaseEvaluator = "set-recall" | "irrelevant-rate" | "success-rate" | "defect-rate" | "two-baseline-byte-reduction" | "crash-recovery-rate";
export interface BenchmarkCaseObservation {
  readonly caseId: string;
  readonly input: string;
  readonly expectedOutput: string;
  readonly observedOutput: string;
  readonly sourceBytes: string;
  readonly inputHash: ContentHash;
  readonly expectedOutputHash: ContentHash;
  readonly observedOutputHash: ContentHash;
  readonly sourceBytesHash: ContentHash;
}
export interface BenchmarkCaseCorpus {
  readonly corpusId: string;
  readonly evaluator: BenchmarkCaseEvaluator;
  readonly cases: readonly BenchmarkCaseObservation[];
  readonly corpusHash: ContentHash;
}
export function createBenchmarkCaseObservation(gateId: string, input: Omit<BenchmarkCaseObservation, "inputHash" | "expectedOutputHash" | "observedOutputHash" | "sourceBytesHash">): BenchmarkCaseObservation {
  return Object.freeze({ ...input,
    inputHash: hashFramedDomain("benchmark-case-input", { gateId, caseId: input.caseId, value: input.input }),
    expectedOutputHash: hashFramedDomain("benchmark-case-expected-output", { gateId, caseId: input.caseId, value: input.expectedOutput }),
    observedOutputHash: hashFramedDomain("benchmark-case-observed-output", { gateId, caseId: input.caseId, value: input.observedOutput }),
    sourceBytesHash: hashFramedDomain("benchmark-case-source-bytes", { gateId, caseId: input.caseId, value: input.sourceBytes }),
  });
}
export function createBenchmarkCaseCorpus(definition: BenchmarkExperimentDefinition, evaluator: BenchmarkCaseEvaluator, cases: readonly BenchmarkCaseObservation[]): BenchmarkCaseCorpus {
  const body = { corpusId: `${definition.experimentId}:cases`, evaluator, cases: [...cases] };
  return Object.freeze({ ...body, corpusHash: hashFramedDomain("benchmark-case-corpus", { gateId: definition.gate.id, ...body }) });
}
function authenticateTrial(definition: BenchmarkExperimentDefinition, kind: "positive" | "negativeControl", observation: BenchmarkTrialObservation): { readonly status: string } {
  const positive = kind === "positive"; const testPath = positive ? definition.testPath : definition.negativeControlTestPath; const exactTestIdentity = positive ? definition.exactTestIdentity : definition.negativeControlTestIdentity; const domain = positive ? "benchmark-exact-test-observation" : "benchmark-exact-negative-control-observation";
  if (observation.outputHash !== hashFramedDomain(domain, observation.output) || !observation.sourceHash.startsWith("sha256:v1:")) throw new Error(`benchmark ${kind} trial hash is invalid: ${definition.gate.id}`);
  let value: { testPath?: unknown; exactTestIdentity?: unknown; assertion?: { fullName?: unknown; status?: unknown } }; try { value = JSON.parse(observation.output) as typeof value; } catch { throw new Error(`benchmark ${kind} trial output is malformed: ${definition.gate.id}`); }
  if (value.testPath !== testPath || value.exactTestIdentity !== exactTestIdentity || value.assertion?.fullName !== exactTestIdentity || typeof value.assertion.status !== "string") throw new Error(`benchmark ${kind} trial assertion is fabricated: ${definition.gate.id}`);
  return { status: value.assertion.status };
}
export function authenticateBenchmarkTrialEvidence(definition: BenchmarkExperimentDefinition, trials: BenchmarkTrialObservations): void {
  const positiveTrials = [authenticateTrial(definition, "positive", trials.positive)]; const negativeControlTrials = [authenticateTrial(definition, "negativeControl", trials.negativeControl)]; const successfulPositiveTrials = positiveTrials.filter(({ status }) => status === "passed").length; const escapedDefects = negativeControlTrials.filter(({ status }) => status !== "passed").length;
  if (successfulPositiveTrials !== positiveTrials.length || escapedDefects !== 0) throw new Error(`benchmark trial assertion failed: ${definition.gate.id}`);
}

const corpusEvaluators: Readonly<Record<string, BenchmarkCaseEvaluator>> = Object.freeze({
  "required-recall": "set-recall", "governing-entity-recall": "set-recall", "irrelevant-expansion": "irrelevant-rate", "irrelevant-context-expansion": "irrelevant-rate",
  "duplicate-identities": "defect-rate", "deterministic-mutation": "success-rate", "hard-pattern-violations": "defect-rate", "context-reduction": "two-baseline-byte-reduction",
  "second-reconcile-mutations": "defect-rate", "binding-false-stale": "defect-rate", "binding-false-current": "defect-rate", "false-proven-claims": "defect-rate",
  "transaction-recovery": "crash-recovery-rate", "endogenous-authority-increase": "defect-rate", "stale-derivation-proof": "defect-rate", "protected-dimension": "defect-rate", "compact-context-net-negative": "defect-rate",
});
const parseArray = (value: string, field: string, gateId: string): readonly string[] => {
  let parsed: unknown; try { parsed = JSON.parse(value); } catch { throw new Error(`benchmark case output is malformed: ${gateId}`); }
  const items = (parsed as Record<string, unknown> | null)?.[field];
  if (!Array.isArray(items) || items.some((item) => typeof item !== "string") || new Set(items).size !== items.length) throw new Error(`benchmark case ${field} is invalid: ${gateId}`);
  return items;
};
const authenticateCase = (gateId: string, item: BenchmarkCaseObservation): void => {
  if (item.caseId.trim().length === 0
    || item.inputHash !== hashFramedDomain("benchmark-case-input", { gateId, caseId: item.caseId, value: item.input })
    || item.expectedOutputHash !== hashFramedDomain("benchmark-case-expected-output", { gateId, caseId: item.caseId, value: item.expectedOutput })
    || item.observedOutputHash !== hashFramedDomain("benchmark-case-observed-output", { gateId, caseId: item.caseId, value: item.observedOutput })
    || item.sourceBytesHash !== hashFramedDomain("benchmark-case-source-bytes", { gateId, caseId: item.caseId, value: item.sourceBytes })) throw new Error(`benchmark case evidence hash is invalid: ${gateId}/${item.caseId}`);
};
const corpusBody = (corpus: BenchmarkCaseCorpus): Omit<BenchmarkCaseCorpus, "corpusHash"> => ({ corpusId: corpus.corpusId, evaluator: corpus.evaluator, cases: corpus.cases });
export function deriveBenchmarkCorpusMeasurement(definition: BenchmarkExperimentDefinition, corpus: BenchmarkCaseCorpus): { readonly numerator: number; readonly denominator: number; readonly numeratorMeaning: BenchmarkNumeratorMeaning; readonly denominatorMeaning: BenchmarkDenominatorMeaning; readonly value: number } {
  const expectedEvaluator = corpusEvaluators[definition.gate.id];
  if (corpus === undefined || expectedEvaluator === undefined || corpus.evaluator !== expectedEvaluator || corpus.corpusId !== `${definition.experimentId}:cases` || !Array.isArray(corpus.cases) || corpus.cases.length < 2 || new Set(corpus.cases.map(({ caseId }) => caseId)).size !== corpus.cases.length || corpus.corpusHash !== hashFramedDomain("benchmark-case-corpus", { gateId: definition.gate.id, ...corpusBody(corpus) })) throw new Error(`benchmark case corpus is missing or inconsistent: ${definition.gate.id}`);
  for (const item of corpus.cases) authenticateCase(definition.gate.id, item);
  if (corpus.evaluator === "set-recall") {
    let numerator = 0; let denominator = 0;
    for (const item of corpus.cases) { const expected = parseArray(item.expectedOutput, "items", definition.gate.id); const observed = new Set(parseArray(item.observedOutput, "items", definition.gate.id)); numerator += expected.filter((id) => observed.has(id)).length; denominator += expected.length; }
    if (denominator === 0) throw new Error(`benchmark recall corpus has no known items: ${definition.gate.id}`);
    return { numerator, denominator, numeratorMeaning: "matched-known-items", denominatorMeaning: "fixture-known-items", value: numerator / denominator };
  }
  if (corpus.evaluator === "irrelevant-rate") {
    let numerator = 0; let denominator = 0;
    for (const item of corpus.cases) { const relevant = new Set(parseArray(item.expectedOutput, "items", definition.gate.id)); const observed = parseArray(item.observedOutput, "items", definition.gate.id); numerator += observed.filter((id) => !relevant.has(id)).length; denominator += observed.length; }
    if (denominator === 0) throw new Error(`benchmark expansion corpus has no observed items: ${definition.gate.id}`);
    return { numerator, denominator, numeratorMeaning: "irrelevant-items", denominatorMeaning: "observed-items", value: numerator / denominator };
  }
  if (corpus.evaluator === "two-baseline-byte-reduction") {
    if (corpus.cases.length !== 2) throw new Error(`benchmark context corpus must contain repository and full-graph baselines: ${definition.gate.id}`);
    const rows = corpus.cases.map((item) => { let value: unknown; try { value = JSON.parse(item.observedOutput); } catch { throw new Error(`benchmark byte output is malformed: ${definition.gate.id}`); } const row = value as { baseline?: unknown; baselineBytes?: unknown; scopedBytes?: unknown }; if ((row.baseline !== "repository" && row.baseline !== "full-semantic-graph") || !Number.isSafeInteger(row.baselineBytes) || !Number.isSafeInteger(row.scopedBytes) || Number(row.baselineBytes) <= 0 || Number(row.scopedBytes) <= 0) throw new Error(`benchmark byte output is invalid: ${definition.gate.id}`); return row as { baseline: string; baselineBytes: number; scopedBytes: number }; });
    if (new Set(rows.map(({ baseline }) => baseline)).size !== 2) throw new Error(`benchmark context corpus is missing a baseline: ${definition.gate.id}`);
    const limiting = rows.reduce((left, right) => left.baselineBytes / left.scopedBytes <= right.baselineBytes / right.scopedBytes ? left : right);
    return { numerator: limiting.baselineBytes, denominator: limiting.scopedBytes, numeratorMeaning: "limiting-baseline-bytes", denominatorMeaning: "scoped-context-bytes", value: limiting.baselineBytes / limiting.scopedBytes };
  }
  const successes = corpus.cases.filter(({ expectedOutput, observedOutput }) => expectedOutput === observedOutput).length;
  if (corpus.evaluator === "success-rate" || corpus.evaluator === "crash-recovery-rate") return { numerator: successes, denominator: corpus.cases.length, numeratorMeaning: corpus.evaluator === "crash-recovery-rate" ? "recovered-or-classified-crashes" : "successful-cases", denominatorMeaning: corpus.evaluator === "crash-recovery-rate" ? "injected-crashes" : "executed-cases", value: successes / corpus.cases.length };
  const defects = corpus.cases.length - successes;
  return { numerator: defects, denominator: corpus.cases.length, numeratorMeaning: "detected-defects", denominatorMeaning: "executed-cases", value: defects / corpus.cases.length };
}
export function validateBenchmarkMetrics(metrics: readonly BenchmarkMetricResult[]): void {
  const expected = new Map(BENCHMARK_GATE_REGISTRY.map((definition) => [definition.gate.id, definition])); const seen = new Set<string>();
  for (const metric of metrics) {
    const definition = expected.get(metric.id); const gate = definition?.gate;
    if (definition === undefined || gate === undefined || seen.has(metric.id) || metric.threshold !== gate.threshold || metric.direction !== gate.direction || metric.scope !== definition.experimentId || metric.status !== "measured" || !Number.isFinite(metric.numerator) || !Number.isFinite(metric.denominator) || metric.numerator < 0 || metric.denominator <= 0 || metric.value !== metric.numerator / metric.denominator || metric.passed !== benchmarkGatePassed(gate, metric.value) || metric.evidenceIds.length === 0 || metric.negativeControlEvidenceIds.length === 0) throw new Error(`benchmark metric is missing, duplicated, or inconsistent: ${metric.id}`);
    authenticateBenchmarkTrialEvidence(definition, metric.trialObservations);
    const measured = deriveBenchmarkCorpusMeasurement(definition, metric.caseCorpus);
    if (!metric.evidenceIds.includes(metric.trialObservations.positive.outputHash) || !metric.evidenceIds.includes(metric.trialObservations.positive.sourceHash) || !metric.negativeControlEvidenceIds.includes(metric.trialObservations.negativeControl.outputHash) || !metric.negativeControlEvidenceIds.includes(metric.trialObservations.negativeControl.sourceHash)) throw new Error(`benchmark metric trial evidence is inconsistent: ${metric.id}`);
    if (metric.numerator !== measured.numerator || metric.denominator !== measured.denominator || metric.numeratorMeaning !== measured.numeratorMeaning || metric.denominatorMeaning !== measured.denominatorMeaning || metric.value !== measured.value || !metric.evidenceIds.includes(metric.caseCorpus.corpusHash) || metric.caseCorpus.cases.some(({ inputHash, expectedOutputHash, observedOutputHash, sourceBytesHash }) => ![inputHash, expectedOutputHash, observedOutputHash, sourceBytesHash].every((hash) => metric.evidenceIds.includes(hash)))) throw new Error(`benchmark metric case corpus semantics are inconsistent: ${metric.id}`);
    seen.add(metric.id);
  }
  if (seen.size !== expected.size) throw new Error("benchmark metric registry is incomplete");
}

export interface BenchmarkMetricResult extends BenchmarkGateDefinition { readonly scope: string; readonly numerator: number; readonly denominator: number; readonly numeratorMeaning: BenchmarkNumeratorMeaning; readonly denominatorMeaning: BenchmarkDenominatorMeaning; readonly value: number; readonly status: "measured"; readonly passed: boolean; readonly evidenceIds: readonly ContentHash[]; readonly negativeControlEvidenceIds: readonly ContentHash[]; readonly trialObservations: BenchmarkTrialObservations; readonly caseCorpus: BenchmarkCaseCorpus }
export interface BenchmarkGateResult { readonly metrics: readonly BenchmarkMetricResult[]; readonly releaseAllowed: boolean; readonly failures: readonly { readonly metricId: string; readonly evidenceIds: readonly string[]; readonly reason: string }[]; readonly rawObservations: readonly { readonly fixtureId: string; readonly class: "held-out" | "mutation" | "structural-variant" | "experiment" | "negative-control" | "representation"; readonly output: string; readonly outputHash: ContentHash }[] }
