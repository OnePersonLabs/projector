import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { hashFramedDomain, hydrateCanonicalDocumentWire, type ContentHash } from "@projector/core";
import { parse as parseToml } from "smol-toml";
import { validateBenchmarkMetrics, type BenchmarkGateResult } from "./benchmark.js";
import type { SubsystemClosureReceipt } from "./subsystem-closure.js";

export type AcceptanceStratum = "scenario" | "property" | "adversary";
export interface AcceptanceInventoryItem { readonly id: string; readonly stratum: AcceptanceStratum; readonly ordinal: number; readonly title: string; readonly sourcePath: string; readonly sourceDigest: ContentHash }
export interface AcceptanceSource { readonly path: string; readonly text: string }
export interface TraceabilityEntry extends AcceptanceInventoryItem { readonly publicFacade: string; readonly testRef: string; readonly testSourceDigest: ContentHash; readonly requiredArtifactIds?: readonly string[]; readonly mappingHash: ContentHash }
export interface TraceabilityManifest { readonly version: 2; readonly entries: readonly TraceabilityEntry[]; readonly inventoryHash: ContentHash }
export interface VerifiedTraceability { readonly verified: true; readonly inventoryHash: ContentHash; readonly runEvidenceHash: ContentHash; readonly rawOutput?: string; readonly contentHash: ContentHash }
export const PACKED_LIFECYCLE_OBLIGATION_IDS = Object.freeze(new Set([
  "scenario:19:installed-held-out-change-lifecycle",
  "adversary:33:installed-source-severed-lifecycle-interruption-recovery-and-identity-continuity",
]));
const PACKED_LIFECYCLE_ARTIFACT_IDS = Object.freeze(["packed-held-out-lifecycle", "packed-held-out-lifecycle-transcript"]);
const execute = promisify(execFile);

const slug = (value: string) => value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
const portableText = (text: string) => text.replace(/\r\n?/gu, "\n");
const sourceDigest = (path: string, text: string) => hashFramedDomain("acceptance-authoritative-source", { path, text: portableText(text) });
function inventoryItem(stratum: AcceptanceStratum, ordinal: number, title: string, source: AcceptanceSource): AcceptanceInventoryItem { return { id: `${stratum}:${String(ordinal).padStart(2, "0")}:${slug(title)}`, stratum, ordinal, title, sourcePath: source.path, sourceDigest: sourceDigest(source.path, source.text) }; }

export function deriveAcceptanceInventory(input: { readonly scenarios: readonly AcceptanceSource[]; readonly testing: AcceptanceSource }): readonly AcceptanceInventoryItem[] {
  let scenarioOrdinal = 0;
  const scenarioSources = input.scenarios.map((source) => ({ ...source, text: portableText(source.text) }));
  const testing = { ...input.testing, text: portableText(input.testing.text) };
  const scenarios = scenarioSources.flatMap((source) => [...source.text.matchAll(/^## (.+)$/gmu)].map((match) => match[1]!).filter((title) => !/^Relevance and Semantic Identity Acceptance Scenarios$/u.test(title)).map((title) => inventoryItem("scenario", ++scenarioOrdinal, title, source)));
  const propertySection = /## Property-based tests\s+Mandatory properties include:\s+([\s\S]*?)\n## /u.exec(testing.text)?.[1];
  if (propertySection === undefined) throw new Error("authoritative property inventory is missing");
  const properties = [...propertySection.matchAll(/^- (.+)$/gmu)].map((match) => match[1]!).map((title, index) => inventoryItem("property", index + 1, title, testing));
  const adversarySection = /## Anti-self-deception tests\s+Mandatory adversarial classes:\s+([\s\S]*?)\n## /u.exec(testing.text)?.[1];
  if (adversarySection === undefined) throw new Error("authoritative adversary inventory is missing");
  const adversaries = [...adversarySection.matchAll(/^\d+\. (.+)$/gmu)].map((match) => match[1]!).map((title, index) => inventoryItem("adversary", index + 1, title, testing));
  if (scenarios.length !== 63 || properties.length !== 27 || adversaries.length !== 33) throw new Error(`authoritative acceptance inventory mismatch: ${scenarios.length}/63 scenarios, ${properties.length}/27 properties, ${adversaries.length}/33 adversaries`);
  return Object.freeze([...scenarios, ...properties, ...adversaries]);
}

const inventoryBody = (entries: readonly Pick<AcceptanceInventoryItem, "id" | "stratum" | "ordinal" | "title" | "sourcePath" | "sourceDigest">[]) => entries.map(({ id, stratum, ordinal, title, sourcePath, sourceDigest }) => ({ id, stratum, ordinal, title, sourcePath, sourceDigest }));
export function traceabilityInventoryHash(inventory: readonly AcceptanceInventoryItem[]): ContentHash { return hashFramedDomain("release-traceability-inventory", inventoryBody(inventory)); }
export function traceabilityEntryHash(entry: Omit<TraceabilityEntry, "mappingHash">): ContentHash { return hashFramedDomain("release-traceability-entry", entry); }
export function verifyTraceabilityAssertionIdentity(testRef: string, result: { readonly status?: unknown; readonly assertionResults?: unknown }): void {
  const exactTestIdentity = testRef.split("#", 2)[1];
  const assertions = Array.isArray(result.assertionResults) ? result.assertionResults as { fullName?: unknown; status?: unknown }[] : [];
  if (exactTestIdentity === undefined || exactTestIdentity.trim() === "" || result.status !== "passed" || !assertions.some(({ fullName, status }) => status === "passed" && fullName === exactTestIdentity)) throw new Error(`traceability exact passing test identity was not observed: ${testRef}`);
}

function validateManifestStructure(manifest: TraceabilityManifest, inventory: readonly AcceptanceInventoryItem[]): void {
  if (manifest.version !== 2 || manifest.inventoryHash !== traceabilityInventoryHash(inventory)) throw new Error("traceability inventory hash is stale");
  if (manifest.entries.length !== inventory.length) throw new Error("traceability entry count is incomplete");
  const expected = new Map(inventory.map((item) => [item.id, item])); const seen = new Set<string>();
  for (const entry of manifest.entries) {
    const item = expected.get(entry.id);
    if (item === undefined || seen.has(entry.id)) throw new Error(`duplicate, relabeled, or unknown traceability identity ${entry.id}`);
    seen.add(entry.id);
    if (entry.stratum !== item.stratum || entry.ordinal !== item.ordinal || entry.title !== item.title || entry.sourcePath !== item.sourcePath || entry.sourceDigest !== item.sourceDigest) throw new Error(`stale or relabeled traceability mapping ${entry.id}`);
    const { mappingHash, ...body } = entry;
    const requiredArtifactIds = entry.requiredArtifactIds ?? [];
    if (entry.publicFacade.length === 0 || !entry.testRef.includes("#") || entry.testSourceDigest.length === 0 || requiredArtifactIds.some((id) => id.length === 0) || new Set(requiredArtifactIds).size !== requiredArtifactIds.length || mappingHash !== traceabilityEntryHash(body)) throw new Error(`unauthenticated traceability mapping ${entry.id}`);
    const expectedArtifacts = PACKED_LIFECYCLE_OBLIGATION_IDS.has(entry.id) ? PACKED_LIFECYCLE_ARTIFACT_IDS : [];
    if (JSON.stringify([...requiredArtifactIds].sort()) !== JSON.stringify([...expectedArtifacts].sort())) throw new Error(`traceability artifact routing is not bound to exact obligation identity ${entry.id}`);
  }
}

export async function validateTraceabilityTestReferences(repositoryRoot: string, testRefs: readonly string[]): Promise<readonly string[]> {
  const root = resolve(repositoryRoot);
  const realRoot = await realpath(root);
  const files = new Set<string>();
  for (const testRef of testRefs) {
    const parts = testRef.split("#");
    const relativePath = parts[0];
    if (parts.length !== 2 || relativePath === undefined || relativePath.length === 0 || parts[1]?.trim() === ""
      || isAbsolute(relativePath) || relativePath.includes("\\") || relativePath.includes("\0")) {
      throw new Error(`invalid traceability test reference: ${testRef}`);
    }
    const path = resolve(root, relativePath);
    if (path === root || (!path.startsWith(`${root}${sep}`))) throw new Error(`traceability test escapes repository: ${relativePath}`);
    const normalized = relative(root, path).replaceAll("\\", "/");
    if (normalized !== relativePath) throw new Error(`traceability test reference is not normalized: ${relativePath}`);
    let current = root;
    for (const component of relativePath.split("/")) {
      current = resolve(current, component);
      let metadata;
      try { metadata = await lstat(current); } catch { throw new Error(`traceability test does not exist: ${relativePath}`); }
      if (metadata.isSymbolicLink()) throw new Error(`traceability test reference contains a symlink: ${relativePath}`);
    }
    const realPath = await realpath(path);
    if (realPath !== realRoot && !realPath.startsWith(`${realRoot}${sep}`)) throw new Error(`traceability test escapes repository: ${relativePath}`);
    files.add(relativePath);
  }
  return Object.freeze([...files].sort());
}

export async function verifyTraceabilityManifest(manifest: TraceabilityManifest, inventory: readonly AcceptanceInventoryItem[], input: { readonly repositoryRoot: string }): Promise<VerifiedTraceability> {
  validateManifestStructure(manifest, inventory);
  if (Object.keys(input).some((key) => key !== "repositoryRoot")) throw new Error("caller-supplied traceability results are forbidden");
  const root = resolve(input.repositoryRoot); const testFiles = await validateTraceabilityTestReferences(root, manifest.entries.map(({ testRef }) => testRef)); const exactNames = [...new Set(manifest.entries.map(({ testRef }) => testRef.split("#", 2)[1]!))].sort(); const testNamePattern = `^(?:${exactNames.map((name) => name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|")})$`; const vitest = resolve(root, "node_modules/vitest/vitest.mjs"); let reporterOutput: string; try { ({ stdout: reporterOutput } = await execute(process.execPath, [vitest, "run", ...testFiles, "--testNamePattern", testNamePattern, "--reporter=json"], { cwd: root, encoding: "utf8", maxBuffer: 20_000_000 })); } catch (error) { throw new Error("authoritative mapped Vitest execution failed", { cause: error }); }
  let report: { success?: unknown; numTotalTests?: unknown; numPassedTests?: unknown; numFailedTests?: unknown; testResults?: unknown }; try { report = JSON.parse(reporterOutput) as typeof report; } catch { throw new Error("authoritative Vitest JSON reporter output is invalid"); }
  if (report.success !== true || !Number.isSafeInteger(report.numTotalTests) || !Number.isSafeInteger(report.numPassedTests) || Number(report.numPassedTests) < new Set(manifest.entries.map(({ testRef }) => testRef)).size || report.numFailedTests !== 0 || !Array.isArray(report.testResults) || report.testResults.length === 0) throw new Error("traceability Vitest reporter contains failed or incomplete run evidence");
  const results = report.testResults as { name?: unknown; status?: unknown; assertionResults?: unknown }[];
  const facades = new Set(["projector", "projector/cli", "projector/core", "projector/analyzers", "projector/engine", "projector/engine/architecture", "projector/engine/coverage", "projector/engine/modernization", "projector/runtime", "projector/integrations", "projector/integrations/surfaces", "projector/control-plane", "projector/testkit"]);
  const sourceCache = new Map<string, string>();
  for (const entry of manifest.entries) {
    const [relativePath, exactTestIdentity] = entry.testRef.split("#", 2);
    const result = results.find(({ name }) => typeof name === "string" && (resolve(name) === resolve(root, relativePath ?? "") || name === relativePath));
    if (relativePath === undefined || exactTestIdentity === undefined || !facades.has(entry.publicFacade)) throw new Error(`traceability passing test result or public facade was not observed: ${entry.testRef}`);
    verifyTraceabilityAssertionIdentity(entry.testRef, result ?? {});
    const path = resolve(root, relativePath); if (path !== root && !path.startsWith(`${root}${sep}`)) throw new Error(`traceability test escapes repository: ${relativePath}`);
    let text = sourceCache.get(relativePath); if (text === undefined) { try { text = await readFile(path, "utf8"); } catch { throw new Error(`traceability test does not exist: ${relativePath}`); } sourceCache.set(relativePath, text); }
    if (hashFramedDomain("traceability-test-source", { path: relativePath, text: portableText(text) }) !== entry.testSourceDigest) throw new Error(`traceability test source or exact identity is stale: ${entry.testRef}`);
  }
  const runEvidenceHash = hashFramedDomain("vitest-json-reporter-output", reporterOutput); const body = { inventoryHash: manifest.inventoryHash, runEvidenceHash, entries: manifest.entries.map(({ mappingHash }) => mappingHash) };
  return Object.freeze({ verified: true, inventoryHash: manifest.inventoryHash, runEvidenceHash, rawOutput: reporterOutput, contentHash: hashFramedDomain("verified-traceability", body) });
}

export interface DerivedConformanceObservation { readonly derivedDigest: ContentHash; readonly semanticDigest: ContentHash; readonly entityIds: readonly string[] }
export interface IndependentConformanceObservation { readonly clean: DerivedConformanceObservation; readonly incremental: DerivedConformanceObservation; readonly rawDocuments: readonly { readonly path: string; readonly bytes: string }[]; readonly schemaId: "canonical-envelope-v2"; readonly runtimeLane: string; readonly locality: { readonly changedEntityIds: readonly string[]; readonly recomputedEntityIds: readonly string[] }; readonly evidenceIds: readonly string[] }
const canonicalSet = (values: readonly string[]) => [...new Set(values)].sort();
export function evaluateIndependentConformance(observation: IndependentConformanceObservation): { readonly passed: boolean; readonly reasons: readonly string[]; readonly contentHash: ContentHash } {
  const entities = observation.rawDocuments.map(({ path, bytes }) => {
    let parsed: unknown;
    try { parsed = decodeTomlNulls(parseToml(bytes, { integersAsBigInt: "asNeeded" })); }
    catch (error) { throw new Error(`independent raw TOML fixture is malformed at ${path}`, { cause: error }); }
    try {
      const document = hydrateCanonicalDocumentWire(parsed);
      return { id: document.id, kind: document.kind, semanticHash: document.semanticHash };
    } catch (error) {
      throw new Error(`independent raw TOML fixture does not satisfy canonical semantic schema at ${path}`, { cause: error });
    }
  }).sort((a, b) => a.id.localeCompare(b.id)); const rawIds = canonicalSet(entities.map(({ id }) => id)); const independentSemanticDigest = hashFramedDomain("independent-release-semantics", { schemaId: observation.schemaId, runtimeLane: observation.runtimeLane, entities }); const cleanIds = canonicalSet(observation.clean.entityIds); const incrementalIds = canonicalSet(observation.incremental.entityIds); const changed = new Set(observation.locality.changedEntityIds);
  const reasons = [...(observation.clean.derivedDigest === observation.incremental.derivedDigest ? [] : ["clean and incremental derived observations differ"]), ...(observation.clean.semanticDigest === independentSemanticDigest && observation.incremental.semanticDigest === independentSemanticDigest ? [] : ["derived semantics contradict independent raw fixture interpretation"]), ...(JSON.stringify(cleanIds) === JSON.stringify(rawIds) && JSON.stringify(incrementalIds) === JSON.stringify(rawIds) ? [] : ["derived observations contradict independent raw canonical identities"]), ...(observation.locality.recomputedEntityIds.every((id) => changed.has(id)) ? [] : ["incremental recomputation escaped the changed dependency scope"]), ...(observation.evidenceIds.length > 0 && observation.rawDocuments.length > 0 ? [] : ["independent raw evidence is missing"] )];
  return { passed: reasons.length === 0, reasons, contentHash: hashFramedDomain("independent-release-conformance", observation) };
}

function decodeTomlNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeTomlNulls);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (Object.hasOwn(value, "__projector_toml_null")) {
      if (entries.length !== 1 || (value as Record<string, unknown>).__projector_toml_null !== true) {
        throw new Error("invalid reserved TOML null marker");
      }
      return null;
    }
    return Object.fromEntries(entries.map(([key, item]) => [key, decodeTomlNulls(item)]));
  }
  return value;
}

export interface ReleaseDeviation { readonly id: string; readonly severity: "note" | "minor" | "major"; readonly impact: string; readonly evidenceIds: readonly string[]; readonly waivedGateIds: readonly string[] }
export interface ReleaseArtifact { readonly id: string; readonly bytesHash: ContentHash; readonly runId?: string }
export interface ReleaseEvidenceInput { readonly sourceRevision: string; readonly worktreeDigest: ContentHash; readonly toolchainDigest: ContentHash; readonly buildDigest: ContentHash; readonly tarballDigest: ContentHash; readonly rawArtifacts: readonly ReleaseArtifact[]; readonly traceability: TraceabilityManifest; readonly traceabilityVerification: VerifiedTraceability; readonly inventory: readonly AcceptanceInventoryItem[]; readonly benchmark: Pick<BenchmarkGateResult, "metrics" | "failures" | "releaseAllowed"> | { readonly metrics: readonly unknown[]; readonly failures: readonly unknown[]; readonly releaseAllowed: boolean }; readonly rebuildDigest: ContentHash; readonly conformance: ReturnType<typeof evaluateIndependentConformance>; readonly deviations: readonly ReleaseDeviation[]; readonly subsystemClosureReceipts: readonly SubsystemClosureReceipt[] }
export interface ReleaseEvidence extends Omit<ReleaseEvidenceInput, "inventory"> { readonly version: 2; readonly releaseAllowed: true; readonly contentHash: ContentHash }
export function compileReleaseEvidence(input: ReleaseEvidenceInput): ReleaseEvidence {
  validateManifestStructure(input.traceability, input.inventory);
  const verificationBody = { inventoryHash: input.traceability.inventoryHash, runEvidenceHash: input.traceabilityVerification.runEvidenceHash, entries: input.traceability.entries.map(({ mappingHash }) => mappingHash) };
  if (!input.traceabilityVerification.verified || input.traceabilityVerification.inventoryHash !== input.traceability.inventoryHash || input.traceabilityVerification.contentHash !== hashFramedDomain("verified-traceability", verificationBody)) throw new Error("release traceability was not verified by observed public tests");
  if (input.sourceRevision.length === 0 || input.rawArtifacts.length === 0 || new Set(input.rawArtifacts.map(({ id }) => id)).size !== input.rawArtifacts.length || input.rawArtifacts.some(({ bytesHash }) => !bytesHash.startsWith("sha256:v1:"))) throw new Error("release artifact evidence is incomplete");
  const observedArtifactIds = new Set(input.rawArtifacts.map(({ id }) => id));
  const missingTraceabilityArtifacts = [...new Set(input.traceability.entries.flatMap(({ requiredArtifactIds }) => requiredArtifactIds ?? []))].filter((id) => !observedArtifactIds.has(id));
  if (missingTraceabilityArtifacts.length > 0) throw new Error(`release traceability is missing required packed lifecycle artifacts: ${missingTraceabilityArtifacts.join(", ")}`);
  const lifecycleArtifacts = PACKED_LIFECYCLE_ARTIFACT_IDS.map((id) => input.rawArtifacts.find((artifact) => artifact.id === id));
  if (lifecycleArtifacts.some((artifact) => artifact?.runId === undefined || artifact.runId.trim().length === 0) || new Set(lifecycleArtifacts.map((artifact) => artifact?.runId)).size !== 1) throw new Error("release traceability packed lifecycle evidence and transcript are not from the same authenticated run");
  validateBenchmarkMetrics(input.benchmark.metrics as BenchmarkGateResult["metrics"]);
  if (!input.benchmark.releaseAllowed || input.benchmark.failures.length > 0 || !input.conformance.passed) throw new Error("release gates cannot be waived");
  if (input.subsystemClosureReceipts.length === 0 || new Set(input.subsystemClosureReceipts.map(({ subsystemId }) => subsystemId)).size !== input.subsystemClosureReceipts.length) throw new Error("release subsystem closure receipts are missing or duplicated");
  for (const receipt of input.subsystemClosureReceipts) if (receipt.revision !== input.sourceRevision || receipt.worktreeDigest !== input.worktreeDigest || receipt.receiptHash !== hashFramedDomain("subsystem-closure-receipt:v1", (({ receiptHash: omitted, ...body }) => { void omitted; return body; })(receipt))) throw new Error(`release subsystem closure receipt is stale or unauthenticated: ${receipt.subsystemId}`);
  if (input.deviations.some(({ impact, evidenceIds, waivedGateIds }) => impact.length === 0 || evidenceIds.length === 0 || waivedGateIds.length > 0)) throw new Error("release deviations cannot waive gates or omit evidence");
  const { inventory: omitted, ...body } = input; void omitted; const base = { version: 2 as const, releaseAllowed: true as const, ...body };
  return Object.freeze({ ...base, contentHash: hashFramedDomain("projector-release-evidence", base) });
}
