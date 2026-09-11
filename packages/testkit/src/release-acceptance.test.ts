import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hashFramedDomain, toCanonicalDocumentWire, withCanonicalHashes } from "@projector/core";
import { stringify as stringifyToml } from "smol-toml";
import { BENCHMARK_GATE_REGISTRY, createBenchmarkCaseCorpus, createBenchmarkCaseObservation, deriveBenchmarkCorpusMeasurement, type BenchmarkCaseEvaluator, type BenchmarkMetricResult } from "./benchmark.js";
import { compileReleaseEvidence, deriveAcceptanceInventory, evaluateIndependentConformance, requiresPackedLifecycleArtifacts, traceabilityEntryHash, traceabilityInventoryHash, validateTraceabilityTestReferences, verifyTraceabilityAssertionIdentity, verifyTraceabilityManifest, type AcceptanceSource, type TraceabilityManifest } from "./release-acceptance.js";


function canonicalSource(key: string, aliases: string[], outcome = "Reject weakened meaning without changing canonical behavior."): AcceptanceSource {
  const payload = { id: `scenario:${key}`, key, title: key, aliases, status: "active", sourceClass: "authored", scope: { op: "atom", field: "requirement", matcher: "equals", value: "requirement:engineering-english" }, steps: [{ role: "precondition", statement: "Accepted source and an exact artifact exist." }, { role: "trigger", statement: "Compile and consume the representation." }, { role: "expected-outcome", statement: outcome }, { role: "forbidden-outcome", statement: "Treat a stored positive status as observed proof." }], semanticHash: hashFramedDomain("fixture", key), discoveryHash: hashFramedDomain("fixture", key), realizations: [], evidence: [] };
  const document = withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "behavioral-scenario", id: payload.id, key, lifecycle: "active", payload });
  return { path: `.projector/model/scenarios/${key}.scenario.toml`, text: stringifyToml(toCanonicalDocumentWire(document)) };
}
function sources() { return { legacyMappings: [{ legacyId: "scenario:56:compact-context-preserves-critical-tokens-and-avoids-false-compression", ownerIds: ["scenario:compact", "scenario:closure"] }], canonical: [canonicalSource("compact", ["scenario:56:compact-context-preserves-critical-tokens-and-avoids-false-compression"]), canonicalSource("closure", [], "Every closure edge needs an observed positive and a severed-edge failure."), canonicalSource("recover-installed-held-out-change-lifecycle", ["scenario:19:installed-held-out-change-lifecycle", "adversary:33:installed-source-severed-lifecycle-interruption-recovery-and-identity-continuity"])] }; }
const manifestFor = (inventory: Awaited<ReturnType<typeof deriveAcceptanceInventory>>, testSourceDigest: ReturnType<typeof hashFramedDomain>, testRef = "tests/public.test.ts#supported public behavior"): TraceabilityManifest => ({ version: 3, inventoryHash: traceabilityInventoryHash(inventory), entries: inventory.map((item) => { const requiredArtifactIds = requiresPackedLifecycleArtifacts(item) ? ["packed-held-out-lifecycle", "packed-held-out-lifecycle-transcript"] : undefined; const entry = { ...item, publicFacade: "projector/testkit", testRef, testSourceDigest, ...(requiredArtifactIds === undefined ? {} : { requiredArtifactIds }) }; return { ...entry, mappingHash: traceabilityEntryHash(entry) }; }) });
const conceptWire = (id: string) => ({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "concept", id, key: id, lifecycle: "active", payload: { kind: "constraint", name: id, aliases: [], statement: "Retain independent raw meaning.", sourceClass: "authored", confidence: 1, tags: [], evidence: [] } });
const conceptToml = (id: string) => `apiVersion = "projector/v2"\nschemaVersion = "2.0.0"\nkind = "concept"\nid = "${id}"\nkey = "${id}"\nlifecycle = "active"\n\n[payload]\nkind = "constraint"\nname = "${id}"\naliases = []\nstatement = "Retain independent raw meaning."\nsourceClass = "authored"\nconfidence = 1\ntags = []\nevidence = []\n`;
const independentlyFrozenConceptSemanticHash = "sha256:v1:8d21bce1266786651b58e1ce35b2d16f135ea4e7ff1656566c828b4cdcbc99b3";

function benchmarkMetrics(sourceHash: ReturnType<typeof hashFramedDomain>): BenchmarkMetricResult[] {
  return BENCHMARK_GATE_REGISTRY.map((definition) => {
    const positiveOutput = JSON.stringify({ testPath: definition.testPath, exactTestIdentity: definition.exactTestIdentity, assertion: { fullName: definition.exactTestIdentity, status: "passed" } }); const negativeControlOutput = JSON.stringify({ testPath: definition.negativeControlTestPath, exactTestIdentity: definition.negativeControlTestIdentity, assertion: { fullName: definition.negativeControlTestIdentity, status: "passed" } }); const positiveOutputHash = hashFramedDomain("benchmark-exact-test-observation", positiveOutput); const negativeControlOutputHash = hashFramedDomain("benchmark-exact-negative-control-observation", negativeControlOutput);
    const evaluator: BenchmarkCaseEvaluator = ["required-recall", "governing-entity-recall"].includes(definition.gate.id) ? "set-recall" : ["irrelevant-expansion", "irrelevant-context-expansion"].includes(definition.gate.id) ? "irrelevant-rate" : definition.gate.id === "context-reduction" ? "two-baseline-byte-reduction" : definition.gate.id === "deterministic-mutation" ? "success-rate" : definition.gate.id === "transaction-recovery" ? "crash-recovery-rate" : "defect-rate";
    const cases = ["one", "two"].map((caseId, index) => createBenchmarkCaseObservation(definition.gate.id, { caseId, input: `input:${caseId}`, expectedOutput: evaluator === "set-recall" || evaluator === "irrelevant-rate" ? JSON.stringify({ items: [`item:${caseId}`] }) : evaluator === "two-baseline-byte-reduction" ? JSON.stringify({ accepted: true }) : "accepted", observedOutput: evaluator === "set-recall" || evaluator === "irrelevant-rate" ? JSON.stringify({ items: [`item:${caseId}`] }) : evaluator === "two-baseline-byte-reduction" ? JSON.stringify({ baseline: index === 0 ? "repository" : "full-semantic-graph", baselineBytes: 4, scopedBytes: 1 }) : "accepted", sourceBytes: `fixture:${caseId}` }));
    const caseCorpus = createBenchmarkCaseCorpus(definition, evaluator, cases); const measurement = deriveBenchmarkCorpusMeasurement(definition, caseCorpus);
    const caseEvidence = caseCorpus.cases.flatMap(({ inputHash, expectedOutputHash, observedOutputHash, sourceBytesHash }) => [inputHash, expectedOutputHash, observedOutputHash, sourceBytesHash]);
    return { ...definition.gate, scope: definition.experimentId, ...measurement, status: "measured", passed: true, evidenceIds: [positiveOutputHash, sourceHash, caseCorpus.corpusHash, ...caseEvidence], negativeControlEvidenceIds: [negativeControlOutputHash, sourceHash], trialObservations: { positive: { output: positiveOutput, outputHash: positiveOutputHash, sourceHash }, negativeControl: { output: negativeControlOutput, outputHash: negativeControlOutputHash, sourceHash } }, caseCorpus };
  });
}

describe("public release acceptance authority", { timeout: 30_000 }, () => {
  it("confines mapped test references before collection and rejects traversal and symlink aliases", async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projector-traceability-paths-"));
    const outsideRoot = await mkdtemp(join(tmpdir(), "projector-traceability-outside-"));
    try {
      await mkdir(join(repositoryRoot, "tests"));
      await writeFile(join(repositoryRoot, "tests", "inside.test.ts"), "export {};\n");
      await writeFile(join(outsideRoot, "outside.test.ts"), "export {};\n");
      await symlink(join(outsideRoot, "outside.test.ts"), join(repositoryRoot, "tests", "alias.test.ts"));
      await expect(validateTraceabilityTestReferences(repositoryRoot, ["../outside.test.ts#outside"])).rejects.toThrow(/escapes repository/iu);
      await expect(validateTraceabilityTestReferences(repositoryRoot, ["tests/alias.test.ts#outside"])).rejects.toThrow(/symlink/iu);
      await expect(validateTraceabilityTestReferences(repositoryRoot, ["tests/inside.test.ts#inside"])).resolves.toEqual(["tests/inside.test.ts"]);
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
      await rm(outsideRoot, { recursive: true, force: true });
    }
  });
  it("spawns a pinned exact Vitest assertion and rejects any caller result channel", async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projector-traceability-"));
    const testPath = "tests/public.test.ts"; const text = "import { expect, it } from \"vitest\";\nit(\"supported public behavior\", () => { expect(1).toBe(1); });\n";
    try {
      await mkdir(join(repositoryRoot, "tests")); await writeFile(join(repositoryRoot, testPath), text.replaceAll("\n", "\r\n")); await symlink(resolve("node_modules"), join(repositoryRoot, "node_modules"), "dir");
      const inventory = deriveAcceptanceInventory(await sources()); const manifest = manifestFor(inventory, hashFramedDomain("traceability-test-source", { path: testPath, text }));
      await mkdir(join(repositoryRoot, "release"));
      await writeFile(join(repositoryRoot, "release/traceability-authority.json"), JSON.stringify({ version: 2, obligations: Object.fromEntries(inventory.map(({ id, legacyIds }) => [id, { obligationId: id, legacyIds, tests: [{ publicFacade: "projector/testkit", testRef: `${testPath}#supported public behavior` }] }])) }));
      await expect(verifyTraceabilityManifest(manifest, inventory, { repositoryRoot, reporterOutput: "{\"success\":true}" } as never)).rejects.toThrow(/caller-supplied/iu);
      await expect(verifyTraceabilityManifest(manifest, inventory, { repositoryRoot })).resolves.toMatchObject({ verified: true });
      await writeFile(join(repositoryRoot, "release/traceability-authority.json"), JSON.stringify({ version: 2, obligations: Object.fromEntries(inventory.map(({ id, legacyIds }) => [id, { obligationId: id, legacyIds, tests: [{ publicFacade: "projector/testkit", testRef: `${testPath}#supported public behavior` }, { publicFacade: "projector/testkit", testRef: `${testPath}#required negative control` }] }])) }));
      await expect(verifyTraceabilityManifest(manifest, inventory, { repositoryRoot })).rejects.toThrow(/exact test bindings differ/iu);
    } finally { await rm(repositoryRoot, { recursive: true, force: true }); }
  });
  it("derives the same acceptance inventory across native and Linux line endings", async () => {
    const source = await sources();
    const crlf = { ...source, canonical: source.canonical.map((item) => ({ ...item, text: item.text.replace(/\r\n?/gu, "\n").replaceAll("\n", "\r\n") })) };
    expect(deriveAcceptanceInventory(crlf)).toEqual(deriveAcceptanceInventory(source));
  });
  it("keeps stable owners and complete split conditions across source reordering and relocation", () => {
    const input = sources(); const inventory = deriveAcceptanceInventory(input);
    expect(deriveAcceptanceInventory({ ...input, canonical: input.canonical.toReversed().map((source) => ({ ...source, path: `moved/${source.path}` })) })).toEqual(inventory);
    const split = inventory.filter((item) => item.legacyIds.includes("scenario:56:compact-context-preserves-critical-tokens-and-avoids-false-compression"));
    expect(split.map(({ id }) => id)).toEqual(["scenario:closure", "scenario:compact"]);
    expect(split[0]!.owner.steps).toContainEqual({ role: "expected-outcome", statement: "Every closure edge needs an observed positive and a severed-edge failure." });
    expect(split[1]!.owner.steps).toContainEqual({ role: "forbidden-outcome", statement: "Treat a stored positive status as observed proof." });
    const changed = deriveAcceptanceInventory({ canonical: [canonicalSource("compact", [], "Preserve exact negation, exceptions, and ordering.")] });
    expect(changed[0]!.id).toBe("scenario:compact");
    expect(changed[0]!.semanticHash).not.toBe(inventory.find(({ id }) => id === "scenario:compact")!.semanticHash);
    expect(traceabilityInventoryHash(changed)).not.toBe(traceabilityInventoryHash(inventory));
  });
  it("refuses empty, duplicate, draft, Markdown, and malformed canonical authority", () => {
    const source = sources().canonical[0]!;
    expect(() => deriveAcceptanceInventory({ canonical: [] })).toThrow(/missing/iu);
    expect(() => deriveAcceptanceInventory({ canonical: [source, source] })).toThrow(/duplicate/iu);
    expect(() => deriveAcceptanceInventory({ canonical: [source], legacyMappings: [{ legacyId: "scenario:56:compact-context-preserves-critical-tokens-and-avoids-false-compression", ownerIds: ["scenario:missing"] }] })).toThrow(/no active canonical owner/iu);
    for (const text of ["## plausible scenario", JSON.stringify({ canonicalMutations: [] }), 'semanticHash = "forged"\n' + source.text]) expect(() => deriveAcceptanceInventory({ canonical: [{ ...source, text }] })).toThrow(/invalid/iu);
  });
  it("rejects an omitted split owner and a modified condition even with recomputed mapping hashes", async () => {
    const inventory = deriveAcceptanceInventory(sources()); const digest = hashFramedDomain("fixture", "test"); const manifest = manifestFor(inventory, digest);
    await expect(verifyTraceabilityManifest({ ...manifest, entries: manifest.entries.filter(({ id }) => id !== "scenario:closure") }, inventory, { repositoryRoot: process.cwd() })).rejects.toThrow(/owner coverage/iu);
    const changed = manifest.entries.map((entry, index) => { if (index !== 0) return entry; const { mappingHash, ...body } = entry; void mappingHash; const altered = { ...body, owner: { ...body.owner, steps: [] } }; return { ...altered, mappingHash: traceabilityEntryHash(altered) }; });
    await expect(verifyTraceabilityManifest({ ...manifest, entries: changed }, inventory, { repositoryRoot: process.cwd() })).rejects.toThrow(/stale or relabeled/iu);
  });
  it("rejects missing or renamed exact Vitest assertion identities", () => { const result = { status: "passed", assertionResults: [{ fullName: "public facade exact behavior", status: "passed" }] }; expect(() => verifyTraceabilityAssertionIdentity("tests/public.test.ts#public facade exact behavior", result)).not.toThrow(); expect(() => verifyTraceabilityAssertionIdentity("tests/public.test.ts#public facade renamed behavior", result)).toThrow(/exact passing test identity/iu); expect(() => verifyTraceabilityAssertionIdentity("tests/public.test.ts#public facade exact behavior", { ...result, assertionResults: [] })).toThrow(/exact passing test identity/iu); });
  it("independently interprets raw authored-wire TOML and catches a shared seeded semantic contradiction", () => {
    const id = "concept:right";
    const bytes = conceptToml(id);
    const semanticHash = independentlyFrozenConceptSemanticHash;
    const semanticDigest = hashFramedDomain("independent-release-semantics", { schemaId: "canonical-envelope-v2", runtimeLane: "node-smol-toml-independent", entities: [{ id, kind: "concept", semanticHash }] });
    const digest = hashFramedDomain("derived", "same");
    const base = { rawDocuments: [{ path: "right.concept.toml", bytes }], schemaId: "canonical-envelope-v2" as const, runtimeLane: "node-smol-toml-independent", locality: { changedEntityIds: [id], recomputedEntityIds: [id] }, evidenceIds: ["raw:schema"] };
    expect(evaluateIndependentConformance({ ...base, clean: { derivedDigest: digest, semanticDigest: hashFramedDomain("wrong", "shared"), entityIds: [id] }, incremental: { derivedDigest: digest, semanticDigest: hashFramedDomain("wrong", "shared"), entityIds: [id] } }).passed).toBe(false);
    expect(evaluateIndependentConformance({ ...base, clean: { derivedDigest: digest, semanticDigest, entityIds: [id] }, incremental: { derivedDigest: digest, semanticDigest, entityIds: [id] } }).passed).toBe(true);
    expect(evaluateIndependentConformance({
      ...base,
      rawDocuments: [{ path: "right.concept.toml", bytes: bytes.replace('lifecycle = "active"', 'lifecycle = "deprecated"') }],
      clean: { derivedDigest: digest, semanticDigest, entityIds: [id] },
      incremental: { derivedDigest: digest, semanticDigest, entityIds: [id] },
    }).reasons).toContain("derived semantics contradict independent raw fixture interpretation");
    expect(() => evaluateIndependentConformance({
      ...base,
      clean: { derivedDigest: digest, semanticDigest, entityIds: [id] },
      incremental: { derivedDigest: digest, semanticDigest, entityIds: [id] },
      rawDocuments: [{ path: "legacy.json", bytes: JSON.stringify(conceptWire(id)) }],
    })).toThrow(/raw TOML fixture is malformed.*legacy\.json/iu);
  });
  it("binds verified traceability, full benchmark results, and same-run packed lifecycle artifacts", async () => { const inventory = deriveAcceptanceInventory(await sources()); const digest = hashFramedDomain("release", "fixture"); const traceability = manifestFor(inventory, digest); const traceabilityVerification = { verified: true as const, inventoryHash: traceability.inventoryHash, runEvidenceHash: digest, contentHash: hashFramedDomain("verified-traceability", { inventoryHash: traceability.inventoryHash, runEvidenceHash: digest, entries: traceability.entries.map(({ mappingHash }) => mappingHash) }) }; const raw = conceptWire("concept:a"); const semanticDigest = hashFramedDomain("independent-release-semantics", { schemaId: "canonical-envelope-v2", runtimeLane: "node-smol-toml-independent", entities: [{ id: raw.id, kind: raw.kind, semanticHash: independentlyFrozenConceptSemanticHash }] }); const conformance = evaluateIndependentConformance({ clean: { derivedDigest: digest, semanticDigest, entityIds: ["concept:a"] }, incremental: { derivedDigest: digest, semanticDigest, entityIds: ["concept:a"] }, rawDocuments: [{ path: "a.concept.toml", bytes: conceptToml("concept:a") }], schemaId: "canonical-envelope-v2" as const, runtimeLane: "node-smol-toml-independent", locality: { changedEntityIds: ["concept:a"], recomputedEntityIds: ["concept:a"] }, evidenceIds: ["raw:fixture"] }); const benchmark = { metrics: benchmarkMetrics(digest), failures: [], releaseAllowed: true }; const input = { sourceRevision: "revision:fixture", worktreeDigest: digest, toolchainDigest: digest, buildDigest: digest, tarballDigest: digest, rawArtifacts: [{ id: "tarball", bytesHash: digest }, { id: "packed-held-out-lifecycle", bytesHash: digest, runId: "packed-run:one" }, { id: "packed-held-out-lifecycle-transcript", bytesHash: digest, runId: "packed-run:one" }], traceability, traceabilityVerification, inventory, benchmark, rebuildDigest: digest, conformance, deviations: [{ id: "deviation:none", severity: "note" as const, impact: "No release-impacting deviation", evidenceIds: ["gate:fixture"], waivedGateIds: [] }] }; expect(compileReleaseEvidence(input)).toMatchObject({ releaseAllowed: true, benchmark, contentHash: expect.stringMatching(/^sha256:v1:/u) }); expect(() => compileReleaseEvidence({ ...input, benchmark: { ...benchmark, metrics: benchmark.metrics.map((metric, index) => index === 0 ? { ...metric, value: 0, passed: true } : metric) } })).toThrow(/inconsistent/iu); expect(() => compileReleaseEvidence({ ...input, rawArtifacts: input.rawArtifacts.filter(({ id }) => id !== "packed-held-out-lifecycle") })).toThrow(/packed.*lifecycle/iu); expect(() => compileReleaseEvidence({ ...input, rawArtifacts: input.rawArtifacts.filter(({ id }) => id !== "packed-held-out-lifecycle-transcript") })).toThrow(/packed.*lifecycle/iu); expect(() => compileReleaseEvidence({ ...input, rawArtifacts: input.rawArtifacts.map((artifact) => artifact.id === "packed-held-out-lifecycle-transcript" ? { ...artifact, runId: "packed-run:other" } : artifact) })).toThrow(/same authenticated run/iu); expect(() => compileReleaseEvidence({ ...input, deviations: [{ ...input.deviations[0]!, waivedGateIds: ["benchmark"] }] })).toThrow(/cannot waive/iu); });
});
