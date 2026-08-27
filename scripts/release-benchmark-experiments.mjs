import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeLocalRepository } from "../packages/analyzers/dist/index.js";
import { compileWriteAuthorization, hashFramedDomain } from "../packages/core/dist/index.js";
import {
  DependencyScopedStateBindingValidator,
  RepresentationCompiler, assessBackdating, compareCorrectnessOracles, compileContext, compileRelevanceClosure,
  computeEvidenceContentHash, createStateBinding, groupCausalEvidence, reconcileToFixedPoint, resolveSemanticIdentityFromEvidence,
  summarizeEvidenceSupport,
} from "../packages/engine/dist/index.js";
import { ExactTextPatchTransform, FileTransactionJournal, RepositoryPathService } from "../packages/runtime/dist/index.js";
import { BENCHMARK_GATE_REGISTRY, createBenchmarkCaseCorpus, createBenchmarkCaseObservation } from "../packages/testkit/dist/benchmark.js";

const json = (value) => JSON.stringify(value);
const digest = (value) => hashFramedDomain("release-benchmark-fixture", value);
const definitions = new Map(BENCHMARK_GATE_REGISTRY.map((definition) => [definition.gate.id, definition]));
const state = (suffix = "old") => ({ gitBase: "benchmark-base", worktreeDigest: digest(`worktree:${suffix}`), canonicalProjectorDigest: digest("canonical"), toolchainDigest: digest("toolchain") });
const adapterContext = (stateDigest) => ({ repositoryRoot: "/benchmark", stateDigest, config: {}, signal: new AbortController().signal });
function observedCase(gateId, caseId, source, input, expectedOutput, observedOutput) {
  return createBenchmarkCaseObservation(gateId, { caseId, sourceBytes: typeof source === "string" ? source : json(source), input: json(input), expectedOutput: json(expectedOutput), observedOutput: json(observedOutput) });
}
function corpus(gateId, evaluator, cases) {
  const definition = definitions.get(gateId); if (definition === undefined) throw new Error(`unknown benchmark gate ${gateId}`);
  return createBenchmarkCaseCorpus(definition, evaluator, cases);
}
const queryDependency = (id, resultCount) => { const queryHash = digest(`query:${id}`); return { query: { id, kind: "relation-neighborhood", programId: "benchmark.relevance", programVersion: "1", input: { id }, semanticHash: queryHash }, priorResult: { queryHash, resultHash: digest(`result:${id}:${resultCount}`), resultCount, observability: "closed", assumptions: [], unavailableLanes: [], dependencyKeys: [`relations:${id}`] }, role: `benchmark relevance expansion from ${id}` }; };
const relevanceFixtures = [
  { id: "held-out-contract", seed: "contract:checkout", governing: "requirement:auth", consequence: "consumer:billing", irrelevant: "avatar:theme" },
  { id: "mutation-event", seed: "event:invoice-created", governing: "requirement:event-order", consequence: "consumer:ledger", irrelevant: "docs:colors" },
  { id: "structural-variant", seed: "api:public-value", governing: "requirement:compatibility", consequence: "consumer:sdk", irrelevant: "asset:logo" },
];
async function relevanceCorpora(analyzerCases) {
  const rows = [];
  for (const fixture of relevanceFixtures) {
    const compiledAgainst = state(fixture.id);
    const binding = createStateBinding({ compiledAgainst, valueDependencies: [], queryDependencies: [] });
    const identityResolution = { id: `resolution:${fixture.id}`, requestedMeaning: fixture.seed, requestedKind: "unknown", outcome: "reuse-existing", candidates: [], selectedEntityIds: [fixture.seed], confidence: 1, evidence: [], unknowns: [], boundState: binding, contentHash: digest(`identity:${fixture.id}`) };
    const edges = new Map([
      [fixture.seed, [{ entityId: fixture.governing, band: "governing", score: 1, requiredForPlanning: true, reason: { kind: "governs", fromId: fixture.seed, weight: 1, provenance: "derived", confidence: 1, explanation: "fixture-known governing dependency", evidenceIds: [`evidence:${fixture.id}:governing`] }, cost: 1 }, { entityId: fixture.irrelevant, band: "possible", score: 0.01, requiredForPlanning: false, reason: { kind: "semantic-similarity", fromId: fixture.seed, weight: 0.01, provenance: "inferred", confidence: 0.01, explanation: "seeded irrelevant neighbor", evidenceIds: [`evidence:${fixture.id}:irrelevant`] }, cost: 1 }]],
      [fixture.governing, [{ entityId: fixture.consequence, band: "consequence", score: 0.95, requiredForPlanning: true, reason: { kind: "depends-on", fromId: fixture.governing, weight: 1, provenance: "derived", confidence: 1, explanation: "fixture-known downstream dependency", evidenceIds: [`evidence:${fixture.id}:consequence`] }, cost: 1 }]],
    ]);
    const discovery = { discover: async (subjectId) => { const found = edges.get(subjectId) ?? []; return { edges: found, dependency: queryDependency(`${fixture.id}:${subjectId}`, found.length) }; } };
    const compilation = await compileRelevanceClosure({ request: `benchmark ${fixture.id}`, seeds: [{ kind: "semantic-entity", subjectId: fixture.seed, reason: "fixture target", confidence: 1 }], identityResolution, activatedFacetKeys: [], compiledAgainst, context: adapterContext(compiledAgainst), discovery, valueDependencies: [], policy: { maxEntries: 8, maxDepth: 3, maxCost: 20, minimumScore: 0.2 } });
    const known = [fixture.seed, fixture.governing, fixture.consequence];
    const sources = new Map([...known, fixture.irrelevant].map((id, index) => [id, { entityId: id, kind: "concept", semanticHash: digest(`source:${id}`), full: `${id}:${"x".repeat(180 + index)}`, summary: id }]));
    const context = await compileContext(compilation.closure, { load: async (id) => sources.get(id) }, { maxCost: 10_000 });
    rows.push({ fixture, compilation, context, source: json({ fixture, edges: [...edges] }), known });
  }
  const analyzerRequired = analyzerCases.map(({ variant, sourceBytes, observedArtifacts }) => observedCase("required-recall", `analyzer-${variant}`, sourceBytes, { api: "analyzeLocalRepository", fixtureClass: variant }, { items: ["package.json", "src/index.ts", "src/value.ts"] }, { items: observedArtifacts }));
  const analyzerGoverning = analyzerCases.map(({ variant, sourceBytes, observedDeclarations }) => observedCase("governing-entity-recall", `analyzer-${variant}`, sourceBytes, { api: "analyzeLocalRepository", fixtureClass: variant }, { items: ["releaseValue"] }, { items: observedDeclarations }));
  const analyzerExpansion = analyzerCases.map(({ variant, sourceBytes, observedArtifacts }) => observedCase("irrelevant-expansion", `analyzer-${variant}`, sourceBytes, { api: "analyzeLocalRepository", fixtureClass: variant }, { items: ["package.json", "src/index.ts", "src/value.ts"] }, { items: observedArtifacts }));
  return {
    required: corpus("required-recall", "set-recall", [...rows.map(({ fixture, compilation, source, known }) => observedCase("required-recall", fixture.id, source, { api: "compileRelevanceClosure", fixtureClass: fixture.id }, { items: known }, { items: compilation.closure.entries.filter(({ requiredForPlanning }) => requiredForPlanning).map(({ entityId }) => entityId) })), ...analyzerRequired]),
    governing: corpus("governing-entity-recall", "set-recall", [...rows.map(({ fixture, compilation, source }) => observedCase("governing-entity-recall", fixture.id, source, { api: "compileRelevanceClosure", fixtureClass: fixture.id }, { items: [fixture.governing] }, { items: compilation.closure.entries.filter(({ band }) => band === "governing").map(({ entityId }) => entityId) })), ...analyzerGoverning]),
    expansion: corpus("irrelevant-expansion", "irrelevant-rate", [...rows.map(({ fixture, compilation, source, known }) => observedCase("irrelevant-expansion", fixture.id, source, { api: "compileRelevanceClosure", fixtureClass: fixture.id }, { items: known }, { items: compilation.closure.entries.map(({ entityId }) => entityId) })), ...analyzerExpansion]),
    contextExpansion: corpus("irrelevant-context-expansion", "irrelevant-rate", rows.map(({ fixture, context, source, known }) => observedCase("irrelevant-context-expansion", fixture.id, source, { api: "compileContext", fixtureClass: fixture.id }, { items: known }, { items: context.items.map(({ entityId }) => entityId) }))),
  };
}

async function identityCorpus() {
  const requestedMeaning = "synonymous durable behavior"; const requestedKind = "concept";
  const programIds = ["identity.exact-search", "identity.alias-search", "identity.lineage", "identity.tombstone", "identity.relations", "identity.topology"];
  const cases = await Promise.all(["active", "deprecated", "tombstone"].map(async (lifecycle) => {
    const candidate = { entityId: `concept:${lifecycle}`, entityKind: "concept", similarity: 0.99, ownershipFit: 0.99, boundaryFit: 0.99, evidence: [{ evidenceId: `candidate:${lifecycle}`, stance: "supports" }], explanation: "owns the synonymous requested behavior" };
    const compiledAgainst = state(`identity:${lifecycle}`); const queryDependencies = programIds.map((programId) => { const semanticHash = digest(`${lifecycle}:${programId}`); return { query: { id: `${programId}:${lifecycle}`, kind: "custom", programId, programVersion: "1", input: { requestedMeaning, requestedKind }, semanticHash }, priorResult: { queryHash: semanticHash, resultHash: digest(`result:${lifecycle}:${programId}`), resultCount: 1, observability: "closed", assumptions: [], unavailableLanes: [], dependencyKeys: [`identity:${lifecycle}`] }, role: "identity negative space" }; });
    const binding = createStateBinding({ compiledAgainst, valueDependencies: [{ kind: "canonical-entity", id: candidate.entityId, versionHash: digest(`candidate:${lifecycle}`), role: "identity candidate semantic value" }], queryDependencies });
    const requestId = `identity_request_${hashFramedDomain("semantic-identity-request", { requestedMeaning, requestedKind }).slice(-32)}`; const sourceIds = lifecycle === "active" || lifecycle === "deprecated" ? [candidate.entityId] : []; const fact = { version: 1, requestId, requestedMeaning, requestedKind, operation: "same", sourceIds, targetIds: sourceIds, equivalentMeaning: requestedMeaning }; const draft = { id: `request:${lifecycle}`, kind: "user-decision", locator: `benchmark:${lifecycle}`, capturedAt: "1970-01-01T00:00:00.000Z", claims: [{ subjectKey: requestId, predicate: "identity-equivalent", object: fact }], reliability: "high", normativeAuthority: "supporting", independenceGroup: `human:${lifecycle}`, applicability: "direct", freshness: 1, causalOrigin: { kind: "human" }, metadata: {}, contentHash: digest("placeholder") }; const evidence = { ...draft, contentHash: computeEvidenceContentHash(draft) };
    const resolution = await resolveSemanticIdentityFromEvidence({ requestedMeaning, requestedKind, durableEntity: true, queryRegistry: { assertCurrent: () => {} }, records: [{ candidate, lifecycle, replacementIds: [] }], boundState: binding, assessment: "same", evidence: [{ evidenceId: evidence.id, stance: "supports" }], unknowns: [] }, { loadEvidence: async () => evidence });
    return observedCase("duplicate-identities", lifecycle, { lifecycle, candidate, evidence }, { api: "resolveSemanticIdentityFromEvidence", lifecycle }, { createdDuplicate: false, outcome: lifecycle === "tombstone" ? "unresolved" : "reuse-existing" }, { createdDuplicate: resolution.outcome === "create-new", outcome: resolution.outcome });
  }));
  return corpus("duplicate-identities", "defect-rate", cases);
}

async function deterministicMutationCorpus() {
  const cases = [];
  for (const fixture of [{ id: "create", before: null, after: "created\n" }, { id: "replace", before: "before\n", after: "after\n" }, { id: "delete", before: "delete\n", after: null }]) {
    const path = `${fixture.id}.txt`; const files = new Map(fixture.before === null ? [] : [[path, fixture.before]]); const events = [];
    const mutation = { readFile: async (target) => files.get(target), assertWritable: async () => {}, moveFile: async () => { throw new Error("not used"); }, writeFile: async (target, content) => { files.set(target, content); events.push(`write:${target}`); }, deleteFile: async (target) => { files.delete(target); events.push(`delete:${target}`); }, checkpoint: async (id) => { events.push(`checkpoint:${id}`); } };
    const transform = new ExactTextPatchTransform(mutation, { now: () => "1970-01-01T00:00:00.000Z" }); const input = { edits: [{ unitId: `unit:${path}`, path, before: fixture.before, after: fixture.after }] }; const compiledAgainst = state(`mutation:${fixture.id}`); const context = { repositoryRoot: "/benchmark", stateBinding: createStateBinding({ compiledAgainst, valueDependencies: [], queryDependencies: [] }), allowedUnits: [`unit:${path}`], dryRun: false, signal: new AbortController().signal, approvedBoundary: [path], writeAuthorization: compileWriteAuthorization({ operation: "exact-text-patch", allowedWrites: [{ selector: { op: "atom", field: "path", matcher: "equals", value: path }, operations: ["exact-text-patch"], reason: "supported benchmark migration" }], forbiddenWrites: [] }) };
    const preview = await transform.preview(input, context); const result = await transform.apply(input, context); const verification = await transform.verify(result, context);
    cases.push(observedCase("deterministic-mutation", fixture.id, json({ fixture, input }), { api: "ExactTextPatchTransform.apply", migration: fixture.id }, { applicable: true, changed: true, operationCount: 1, finalBytes: fixture.after, verification: "passed" }, { applicable: preview.applicable, changed: result.changed, operationCount: result.operations.length, finalBytes: files.get(path) ?? null, verification: verification[0]?.status }));
  }
  return corpus("deterministic-mutation", "success-rate", cases);
}

async function reconciliationCorpora() {
  const hardCases = [];
  const validation = (status, summary, lane = "schema") => ({ validatorId: `benchmark:${summary}`, status, summary, evidenceIds: [`evidence:${summary}`], evidenceLane: lane, independenceGroup: "independent-benchmark-oracle", assurance: "strong", authorSource: "benchmark-oracle", sideEffectClass: "none", details: {}, startedAt: "1970-01-01T00:00:00.000Z", completedAt: "1970-01-01T00:00:00.000Z" });
  for (const fixture of [{ id: "clean-incremental-divergence", rebuild: { incrementalHash: digest("incremental"), cleanHash: digest("clean") }, conformance: [validation("passed", "independent schema passed")], historical: [] }, { id: "seeded-conformance-violation", rebuild: { incrementalHash: digest("same"), cleanHash: digest("same") }, conformance: [validation("failed", "seeded hard pattern escaped reconciliation")], historical: [] }, { id: "seeded-historical-regression", rebuild: { incrementalHash: digest("same"), cleanHash: digest("same") }, conformance: [validation("passed", "independent schema passed")], historical: [validation("failed", "seeded historical hard pattern regression", "historical")] }]) {
    const reconciliation = await reconcileToFixedPoint({ iterate: async () => ({ governedStateDigest: digest(`reconciled:${fixture.id}`), materialChanged: false, fixedPointTerminal: true }) }); const verdict = compareCorrectnessOracles({ rebuild: fixture.rebuild, conformance: fixture.conformance, historical: fixture.historical }); const undetected = reconciliation.converged && verdict.strongCompletion;
    hardCases.push(observedCase("hard-pattern-violations", fixture.id, json(fixture), { api: "reconcileToFixedPoint+compareCorrectnessOracles", fixture: fixture.id }, { undetected: false }, { undetected }));
  }
  const fixedCases = [];
  for (const initialChanges of [1, 2, 3]) {
    let remaining = initialChanges;
    const run = async () => reconcileToFixedPoint({ iterate: async () => { if (remaining > 0) { remaining -= 1; return { governedStateDigest: digest(`remaining:${remaining}`), materialChanged: true, fixedPointTerminal: false }; } return { governedStateDigest: digest("stable"), materialChanged: false, fixedPointTerminal: true }; } });
    await run(); const second = await run();
    fixedCases.push(observedCase("second-reconcile-mutations", `initial-${initialChanges}`, json({ initialChanges }), { api: "reconcileToFixedPoint", invocation: 2 }, { materialMutations: 0 }, { materialMutations: second.iterations.filter(({ materialChanged }) => materialChanged).length }));
  }
  return { hard: corpus("hard-pattern-violations", "defect-rate", hardCases), fixed: corpus("second-reconcile-mutations", "defect-rate", fixedCases) };
}

async function bindingCorpora() {
  const oldState = state("binding-old"); const newState = { ...oldState, worktreeDigest: digest("binding-new") };
  const falseStale = []; const falseCurrent = [];
  for (const id of ["concept:a", "concept:b", "concept:c"]) {
    const versionHash = digest(`version:${id}`); const binding = createStateBinding({ compiledAgainst: oldState, valueDependencies: [{ kind: "canonical-entity", id, versionHash, role: "semantic meaning" }], queryDependencies: [] });
    const queries = { evaluate: async () => { throw new Error("no query dependencies"); } };
    const rebound = await new DependencyScopedStateBindingValidator({ values: { readVersionHash: async () => versionHash }, queries, changedDependencyKeys: { changedKeys: async () => ["unrelated:root"] } }).validate(binding, newState, adapterContext(newState));
    falseStale.push(observedCase("binding-false-stale", id, json(binding), { api: "DependencyScopedStateBindingValidator.validate", change: "unrelated" }, { status: "rebound" }, { status: rebound.status }));
    const stale = await new DependencyScopedStateBindingValidator({ values: { readVersionHash: async () => digest(`changed:${id}`) }, queries, changedDependencyKeys: { changedKeys: async () => [] } }).validate(binding, newState, adapterContext(newState));
    falseCurrent.push(observedCase("binding-false-current", id, json(binding), { api: "DependencyScopedStateBindingValidator.validate", change: "bound-value" }, { status: "stale" }, { status: stale.status }));
  }
  return { falseStale: corpus("binding-false-stale", "defect-rate", falseStale), falseCurrent: corpus("binding-false-current", "defect-rate", falseCurrent) };
}

function proofAndAuthorityCorpora() {
  const proofCases = ["open", "sampled", "unavailable"].map((observability) => { const summary = summarizeEvidenceSupport({ evidence: [], lanes: [{ id: `lane:${observability}`, observability, unavailable: observability === "unavailable" }] }); return observedCase("false-proven-claims", observability, observability, { api: "summarizeEvidenceSupport", observability }, { absenceProven: false }, { absenceProven: summary.absenceProven }); });
  const evidence = (id, independenceGroup, causalOrigin) => ({ id, kind: "observation", locator: id, capturedAt: "1970-01-01T00:00:00.000Z", claims: [{ subjectKey: "rule", predicate: "conforms", object: true }], reliability: "high", normativeAuthority: "supporting", independenceGroup, applicability: "direct", freshness: 1, causalOrigin, metadata: {}, contentHash: digest(`evidence:${id}`) });
  const authorityCases = ["lens-transform", "semantic-resolution", "model-inference"].map((kind) => { const human = evidence(`human:${kind}`, `human:${kind}`, { kind: "human" }); const generated = evidence(`generated:${kind}`, `generated:${kind}`, kind === "lens-transform" ? { kind, causedByLensId: "lens:benchmark" } : kind === "semantic-resolution" ? { kind, causedByRuleId: "rule:benchmark" } : { kind }); const baselineGroups = groupCausalEvidence([human], { targetLensId: "lens:benchmark" }); const combinedGroups = groupCausalEvidence([human, generated], { targetLensId: "lens:benchmark" }); const before = baselineGroups.filter(({ authorityEligible }) => authorityEligible).length; const after = combinedGroups.filter(({ authorityEligible }) => authorityEligible).length; const generatedEligibleEvidence = combinedGroups.flatMap(({ eligibleEvidenceIds }) => eligibleEvidenceIds).filter((id) => id === generated.id); return observedCase("endogenous-authority-increase", kind, json({ human, generated }), { api: "groupCausalEvidence", baseline: "human", addition: kind }, { authorityIncrease: 0, generatedEligibleEvidence: [] }, { authorityIncrease: Math.max(0, after - before), generatedEligibleEvidence }); });
  return { proof: corpus("false-proven-claims", "defect-rate", proofCases), authority: corpus("endogenous-authority-increase", "defect-rate", authorityCases) };
}

function staleProofCorpus() {
  const cases = [["1", "2"], ["2", "3"], ["1", "10"]].map(([from, to]) => { const signature = (version) => ({ hash: digest("same-output"), profileId: "typescript-public-interface", profileVersion: version, scope: "exports", assurance: "exact", evidenceIds: [] }); const result = assessBackdating(signature(from), signature(to), [], { minimumValidatedAssurance: "strong", requireIndependent: true }); return observedCase("stale-derivation-proof", `${from}-to-${to}`, json({ from, to }), { api: "assessBackdating", from, to }, { eligible: false, materiallyChanged: true }, { eligible: result.eligible, materiallyChanged: result.materiallyChanged }); });
  return corpus("stale-derivation-proof", "defect-rate", cases);
}

async function transactionCorpus(root) {
  const phases = ["prepared", "workspace-mutating", "workspace-staged", "validating", "canonical-staging", "committing", "committed", "rolling-back", "rolled-back", "recovery-required"]; const scenarios = [...phases.map((phase) => ({ id: `phase-${phase}`, phase, matches: (point) => point === `after-phase:${phase}` })), { id: "new-record-claim", matches: (point) => point === "after-new-record-claim" }, { id: "operation-intent", matches: (point) => point === "after-operation-intent" }, { id: "operation-apply", matches: (point) => point === "after-operation-apply" }, { id: "operation-revert", rollback: true, matches: (point) => String(point).startsWith("after-operation-revert:") }]; const cases = [];
  for (const scenario of scenarios) {
    const caseRoot = join(root, `transaction-${scenario.id}`); await mkdir(caseRoot, { recursive: true }); await writeFile(join(caseRoot, "sample.txt"), "before"); const paths = await RepositoryPathService.create(caseRoot); let injected = false; const journal = new FileTransactionJournal(paths, { now: () => new Date("1970-01-01T00:00:00.000Z"), crash: (point) => { if (!injected && scenario.matches(point)) { injected = true; throw new Error(`injected crash at ${scenario.id}`); } } });
    try {
      const transaction = await journal.begin({ transactionId: `tx-${scenario.id}`, planId: "plan-benchmark", beforeState: state(`tx:${scenario.id}`), allowedWriteRoots: ["."] }); await transaction.writeFile("sample.txt", "after");
      if (scenario.rollback === true || scenario.phase === "rolling-back" || scenario.phase === "rolled-back") await transaction.rollback();
      else if (scenario.phase === "recovery-required") { await transaction.recordCompensation({ externalOperationId: "remote-1", kind: "manual" }); await journal.recoverIncomplete(); }
      else { for (const next of ["workspace-staged", "validating", "canonical-staging", "committing"]) await transaction.transition(next); await transaction.commit(); }
    } catch (error) { if (!injected) throw error; }
    if (!injected) throw new Error(`transaction benchmark did not inject ${scenario.id} crash`);
    const restarted = new FileTransactionJournal(await RepositoryPathService.create(caseRoot), { now: () => new Date("1970-01-01T00:00:01.000Z") }); const recovery = await restarted.recoverIncomplete(); const bytes = await readFile(join(caseRoot, "sample.txt"), "utf8"); const expected = scenario.phase === "committed" ? { action: "committed", bytes: "after" } : scenario.phase === "rolled-back" ? { action: "rolled-back", bytes: "before" } : scenario.phase === "recovery-required" ? { action: "recovery-required", bytes: "after" } : { action: "rolled-back", bytes: "before" }; const observed = { action: recovery[0]?.action ?? (scenario.phase === "committed" ? "committed" : scenario.phase === "rolled-back" ? "rolled-back" : "missing"), bytes };
    cases.push(observedCase("transaction-recovery", scenario.id, json({ crashPointClass: scenario.id, before: "before", after: "after" }), { api: "FileTransactionJournal.recoverIncomplete", crashPointClass: scenario.id }, expected, observed));
  }
  return corpus("transaction-recovery", "crash-recovery-rate", cases);
}

const representationSource = () => { const body = { sourceEntityIds: ["rule:benchmark"], statements: [{ id: "rule:benchmark", text: "MUST_NOT delete API_V2 exactly once unless approved", normativeForce: "forbid", negated: true, scope: ["production"], cardinality: "exactly-one", connective: "iff", guard: "approved", exceptions: ["approved"], dependencies: ["authenticate", "delete"], conceptIds: ["concept:data"], protectedLiterals: ["API_V2"] }], scenarios: [] }; return { ...body, sourceSemanticHash: hashFramedDomain("canonical-representation-source", body) }; };
const representationBinding = () => createStateBinding({ compiledAgainst: state("representation"), valueDependencies: [], queryDependencies: [] });
async function representationCorpora() {
  const artifacts = new Map(); const store = { put: async (hash, content) => { artifacts.set(hash, content); }, get: async (hash) => artifacts.get(hash) }; const source = representationSource(); const base = new RepresentationCompiler({ artifacts: store }); const exact = artifacts.get((await base.compile({ source, binding: representationBinding(), profileKey: "agent-compact@1" })).projection.contentHash);
  const mutations = [["force", exact.replace("FORBID", "PERMIT")], ["negation", exact.replace(" NOT ", " ")], ["scope", exact.replace("production", "staging")], ["cardinality", exact.replace("EXACTLY-ONE", "ONE-OR-MORE")], ["connective", exact.replace("IFF", "AND")], ["guard", exact.replace("IF approved", "approved")], ["exception", exact.replace(" | EXCEPT approved", "")], ["order", exact.replace("authenticate > delete", "delete > authenticate")], ["concept", exact.replace("concept:data", "concept:other")], ["literal", exact.replace("API_V2", "API_V3")]]; const fidelityCases = [];
  for (const [dimension, candidate] of mutations) { let accepted = true; try { await base.validateCandidate({ source, profileKey: "agent-compact@1", candidate }); } catch { accepted = false; } fidelityCases.push(observedCase("protected-dimension", dimension, candidate, { api: "RepresentationCompiler.validateCandidate", dimension }, { accepted: false }, { accepted })); }
  const netCases = [];
  for (const efficiency of [-1, 0, -5]) { const compiler = new RepresentationCompiler({ artifacts: store, tokenizer: { profileId: "benchmark@1", measure: (text) => text.trim().split(/\s+/u).filter(Boolean).length }, utility: { profileId: "benchmark-utility@1", measure: () => ({ netInstructionEfficiency: efficiency, evidence: `held-out utility ${efficiency}` }) } }); const selected = await compiler.compileBest({ source, binding: representationBinding(), requestedProfileKey: "agent-compact@1" }); netCases.push(observedCase("compact-context-net-negative", `efficiency-${efficiency}`, json({ source, efficiency }), { api: "RepresentationCompiler.compileBest", efficiency }, { selectedCompact: false }, { selectedCompact: selected.projection.profileId === "profile:agent-compact" && selected.fallback === undefined })); }
  return { fidelity: corpus("protected-dimension", "defect-rate", fidelityCases), netNegative: corpus("compact-context-net-negative", "defect-rate", netCases) };
}

async function contextReductionCorpus(repositoryRoot) {
  const digestSource = (value) => hashFramedDomain("context-reduction-benchmark", value); const bands = ["direct", "governing", "consequence", "consequence", "possible", "possible"]; const entries = bands.map((band, index) => ({ entityId: `entity:${index + 1}`, band, score: 1 - index * 0.1, requiredForPlanning: index < 2, reasons: [] })); const sources = new Map(entries.map(({ entityId }, index) => [entityId, { entityId, kind: "concept", semanticHash: digestSource(entityId), full: `${entityId}:${"x".repeat(420 + index * 10)}`, summary: `${entityId}:summary` }])); const closure = { id: "benchmark-context", requestHash: digestSource("request"), seeds: [], entries, activatedFacetKeys: [], unknowns: [], unavailableLanes: [], boundState: createStateBinding({ compiledAgainst: state("context"), valueDependencies: [], queryDependencies: [] }), contentHash: digestSource("closure") }; const requiredBytes = entries.slice(0, 2).reduce((sum, { entityId }) => sum + Buffer.byteLength(sources.get(entityId).full), 0); const compiled = await compileContext(closure, { load: async (id) => sources.get(id) }, { maxCost: requiredBytes }); const selectedIds = compiled.items.map(({ entityId }) => entityId); if (selectedIds.length !== 2 || selectedIds.some((id, index) => id !== entries[index].entityId)) throw new Error("context benchmark did not compile the intended scoped subset"); const concatenate = (values) => Buffer.concat(values.map((value) => Buffer.from(value))); const scopedBytes = concatenate(compiled.items.map(({ content }) => content)).byteLength; const fullGraph = concatenate([...sources.values()].map(({ full }) => full)); const repositoryFiles = [await readFile(join(repositoryRoot, "package.json"), "utf8"), ...[...sources.values()].map(({ full }) => full), "unrelated repository fixture\n".repeat(80)]; const repository = concatenate(repositoryFiles); const repositoryBytes = repository.byteLength; const fullGraphBytes = fullGraph.byteLength;
  const sourceBytes = concatenate(repositoryFiles).toString("utf8"); return corpus("context-reduction", "two-baseline-byte-reduction", [["repository", repositoryBytes], ["full-semantic-graph", fullGraphBytes]].map(([baseline, baselineBytes]) => observedCase("context-reduction", baseline, sourceBytes, { api: "compileContext", baseline, selectedIds }, { baseline }, { baseline, baselineBytes, scopedBytes })));
}

async function analyzerCorpus(repositoryRoot, temporaryRoot) {
  const packageBytes = await readFile(join(repositoryRoot, "package.json"), "utf8"); const cases = [];
  for (const variant of ["held-out", "mutation", "structural-variant"]) { const root = join(temporaryRoot, `analyzer-${variant}`); await mkdir(join(root, "src"), { recursive: true }); await writeFile(join(root, "package.json"), packageBytes); const indexBytes = variant === "structural-variant" ? 'export { releaseValue as publicValue } from "./value.js";\n' : 'export { releaseValue } from "./value.js";\n'; const valueBytes = `export const releaseValue = ${variant === "mutation" ? 2 : 1};\n`; await writeFile(join(root, "src/index.ts"), indexBytes); await writeFile(join(root, "src/value.ts"), valueBytes); const analysis = await analyzeLocalRepository({ repositoryRoot: root, observedAt: "1970-01-01T00:00:00.000Z" }); cases.push({ variant, sourceBytes: json({ packageBytes, indexBytes, valueBytes }), observedArtifacts: analysis.artifacts.map(({ locator }) => locator).sort(), observedDeclarations: [...new Set(analysis.javaScript.files.flatMap(({ declarations }) => declarations.map(({ name }) => name)))].sort() }); }
  return cases;
}

export async function runProductionBenchmarkCaseCorpora(repositoryRoot) {
  const temporary = await mkdtemp(join(tmpdir(), "projector-benchmark-corpora-"));
  try {
    const analyzerCases = await analyzerCorpus(repositoryRoot, temporary); const relevance = await relevanceCorpora(analyzerCases); const reconciliation = await reconciliationCorpora(); const binding = await bindingCorpora(); const proof = proofAndAuthorityCorpora(); const representation = await representationCorpora();
    return new Map([
      ["required-recall", relevance.required], ["governing-entity-recall", relevance.governing], ["irrelevant-expansion", relevance.expansion], ["irrelevant-context-expansion", relevance.contextExpansion], ["duplicate-identities", await identityCorpus()], ["deterministic-mutation", await deterministicMutationCorpus()], ["hard-pattern-violations", reconciliation.hard], ["context-reduction", await contextReductionCorpus(repositoryRoot)], ["second-reconcile-mutations", reconciliation.fixed], ["binding-false-stale", binding.falseStale], ["binding-false-current", binding.falseCurrent], ["false-proven-claims", proof.proof], ["transaction-recovery", await transactionCorpus(temporary)], ["endogenous-authority-increase", proof.authority], ["stale-derivation-proof", staleProofCorpus()], ["protected-dimension", representation.fidelity], ["compact-context-net-negative", representation.netNegative],
    ]);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
