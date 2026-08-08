import { hashFramedDomain, type AdapterContext, type AnalyzerFailure, type ContentHash, type StateBinding, type StateDigest } from "@projector/core";
import { describe, expect, it } from "vitest";

import { REQUIRED_COVERAGE_LANES, compileAuthenticatedCoverageSnapshot, type CoverageEvidenceSnapshot, type CoverageLaneEvidence } from "./snapshot.js";

const hash = (value: string): ContentHash => hashFramedDomain("coverage-test", value);
const state: StateDigest = { gitBase: "base", worktreeDigest: hash("worktree"), canonicalProjectorDigest: hash("canonical"), toolchainDigest: hash("tools") };
const binding: StateBinding = { compiledAgainst: state, valueDependencies: [], queryDependencies: [], dependencyDigest: hashFramedDomain("state-binding-dependencies", { valueDependencies: [], queryDependencies: [] }) };
const context = { repositoryRoot: "/repo", stateDigest: state, config: {}, signal: new AbortController().signal } satisfies AdapterContext;
const lane = (key: (typeof REQUIRED_COVERAGE_LANES)[number], patch: Partial<CoverageLaneEvidence> = {}): CoverageLaneEvidence => ({ key, applicability: "required", observability: "closed", numerator: 1, denominator: 1, confidence: 1, assumptions: [], provenAssumptions: [], blindSpots: [], staleObservationIds: [], ...patch });
const completion = { artifactsClassified: true, semanticMappingsResolved: true, identityDispositionsResolved: true, expectedProjectionsAccounted: true, relevanceNegativeSpaceProven: true, lensesAndRulesOperational: true, externalOwnershipAssigned: true, blockerIds: [], unknownUnitIds: [], validationIndependenceSatisfied: true, architectureFrontierIds: [] };
const evidence = (lanes: CoverageLaneEvidence[] = REQUIRED_COVERAGE_LANES.map((key) => lane(key)), failures: AnalyzerFailure[] = []): CoverageEvidenceSnapshot => ({ boundState: binding, lanes, analyzerFailures: failures, unknownFrontierIds: [], unavailableSurfaceIds: [], completion });
const ports = (observed: CoverageEvidenceSnapshot, validationStatus: "current" | "stale" = "current") => ({ bindingValidator: { validate: async () => ({ status: validationStatus, currentState: state, changedValueDependencyIds: validationStatus === "stale" ? ["entity:a"] : [], changedQueryDependencyIds: [], reasons: [] }) }, evidence: { observe: async () => observed } });

describe("authenticated coverage snapshot", () => {
  it("normalizes exactly 17 lanes, collapses identical duplicates, and derives proof/completion", async () => {
    const observed = evidence([...REQUIRED_COVERAGE_LANES.map((key) => lane(key)), lane("inventory")]);
    const report = await compileAuthenticatedCoverageSnapshot({ graphRevision: 4, boundary: ["packages/api"], binding, currentState: state, context }, ports(observed));
    expect(report.snapshot.lanes).toHaveLength(17);
    expect(report.snapshot).toMatchObject({ completeWithinBoundary: true, proofStatement: "proven-within-boundary" });
    expect(report.laneReports.every(({ percentage }) => percentage === 100)).toBe(true);
  });

  it("fails closed on conflicts/numeric invalidity and never invents a percentage for unknown denominators", async () => {
    await expect(compileAuthenticatedCoverageSnapshot({ graphRevision: 1, boundary: ["."], binding, currentState: state, context }, ports(evidence([...REQUIRED_COVERAGE_LANES.map((key) => lane(key)), lane("inventory", { numerator: 0 })])))).rejects.toThrow(/conflicting.*inventory/iu);
    await expect(compileAuthenticatedCoverageSnapshot({ graphRevision: 1, boundary: ["."], binding, currentState: state, context }, ports(evidence(REQUIRED_COVERAGE_LANES.map((key) => key === "inventory" ? lane(key, { numerator: 2, denominator: 1 }) : lane(key)))))).rejects.toThrow(/numerator|denominator/iu);
    const report = await compileAuthenticatedCoverageSnapshot({ graphRevision: 1, boundary: ["."], binding, currentState: state, context }, ports(evidence(REQUIRED_COVERAGE_LANES.map((key) => key === "planning-surprise" ? lane(key, { numerator: 0, denominator: undefined, observability: "unavailable" }) : lane(key)))));
    expect(report.laneReports.find(({ key }) => key === "planning-surprise")?.percentage).toBeUndefined();
    expect(report.snapshot.proofStatement).toBe("not-established");
  });

  it("maps failures locally and refuses caller-ratio completion without semantic predicates or current binding", async () => {
    const markdownFailure: AnalyzerFailure = { analyzerId: "markdown", capability: "markdown-structure", scope: "README.md", message: "bad", recoverable: true, affectedClaimKinds: ["representation-projection"] };
    const incomplete = evidence(REQUIRED_COVERAGE_LANES.map((key) => lane(key)), [markdownFailure]);
    incomplete.completion = { ...completion, identityDispositionsResolved: false };
    const report = await compileAuthenticatedCoverageSnapshot({ graphRevision: 1, boundary: ["."], binding, currentState: state, context }, ports(incomplete));
    expect(report.snapshot.completeWithinBoundary).toBe(false);
    expect(report.snapshot.lanes.find(({ key }) => key === "representation-projection-fidelity")?.analyzerFailures).toHaveLength(1);
    expect(report.snapshot.lanes.find(({ key }) => key === "inventory")?.analyzerFailures).toHaveLength(0);
    await expect(compileAuthenticatedCoverageSnapshot({ graphRevision: 1, boundary: ["."], binding, currentState: state, context }, ports(evidence(), "stale"))).rejects.toThrow(/stale|binding/iu);
  });

  it("treats reordered set evidence identically and requires proof for bounded assumptions or exclusions", async () => {
    const inventory = lane("inventory", { observability: "bounded", assumptions: ["b", "a"], provenAssumptions: ["a"] });
    const observed = evidence([...REQUIRED_COVERAGE_LANES.map((key) => key === "inventory" ? inventory : key === "planning-surprise" ? lane(key, { applicability: "not-applicable", boundaryExclusion: "no executed changes", denominator: 0, numerator: 0 }) : lane(key)), { ...inventory, assumptions: ["a", "b"], provenAssumptions: ["a"] }]);
    const report = await compileAuthenticatedCoverageSnapshot({ graphRevision: 1, boundary: ["."], binding, currentState: state, context }, ports(observed));
    expect(report.snapshot.lanes.find(({ key }) => key === "inventory")?.exactClosureProvable).toBe(false);
    const surprise = report.laneReports.find(({ key }) => key === "planning-surprise");
    expect(surprise).toMatchObject({ applicability: "not-applicable" });
    expect(surprise?.percentage).toBeUndefined();
  });
});
