import { describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CanonicalFileRepository } from "@projector/runtime";

import { executeProjector, type CoverageCliPort } from "./cli.js";

const laneKeys = ["inventory", "projection-unit-classification", "concept-mapping", "relationship", "lens", "rule-enforceability", "derivation", "validation-evidence", "surface", "authority", "historical-metamorphic", "architecture-decision", "semantic-identity", "pre-change-relevance", "representation-projection-fidelity", "change-closure", "planning-surprise"];
const report = { proofStatement: "bounded" as const, approvalRequired: false, budgetExhausted: false, continuationPersisted: false, boundary: ["packages/api"], lanes: laneKeys.map((key) => ({ key, observability: "bounded" as const })), unavailableSurfaceIds: [] };

describe("coverage/complete/cleanup CLI composition", () => {
  it("settles canonical answers through the public lifecycle, survives a fresh process, and reopens only newly uncovered membership", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-completion-public-"));
    const git = promisify(execFile);
    const pathScope = (value: string) => ({ op: "atom", field: "path", matcher: "equals", value });
    const requirement = { id: "requirement:owned", key: "owned", title: "Owned behavior", aliases: [], statement: "Keep the owned behavior available.", status: "active", sourceClass: "authored", scope: pathScope("src/owned.mjs"), origin: [], evidence: [] };
    const concern = { id: "concern:choice", key: "choice", title: "Choose storage", question: "Which storage commitments are necessary now?", scope: { op: "atom", field: "path", matcher: "glob", value: "src/**" }, sourceClass: "authored", status: "active", materiality: "blocking-now", activationReasons: [], relatedConceptIds: [], relatedRequirementIds: [requirement.id], decisionIds: [], evidence: [] };
    const author = async (canonicalMutations: readonly unknown[]) => {
      await writeFile(join(root, ".projector/runtime/proposal.json"), JSON.stringify({ apiVersion: "projector.change-proposal/v1", architecture: null, analysisFacets: ["behavior", "architecture"], canonicalMutations }));
      const captured = await executeProjector(["change", "Accept coverage ownership and preserve future choices", "--proposal", ".projector/runtime/proposal.json", "--format", "json"], { cwd: root });
      expect(captured.exitCode, captured.output).toBe(0);
      const approved = await executeProjector(["approve", captured.report.selector, "--plan-hash", captured.report.immutablePlanHash, "--format", "json"], { cwd: root });
      expect(approved.exitCode, approved.output).toBe(0);
      const applied = await executeProjector(["apply", approved.report.selector, "--format", "json"], { cwd: root });
      expect(applied.exitCode, applied.output).toBe(0);
    };
    const freshComplete = async () => {
      const executable = join(import.meta.dirname, "../dist/cli.js");
      const stdout = await new Promise<string>((resolve, reject) => execFile(process.execPath, [executable, "complete", "--format", "json"], { cwd: root }, (error, out) => { if (error !== null && error.code !== 5) reject(error); else resolve(out); }));
      return JSON.parse(stdout);
    };
    try {
      await git("git", ["init", "-q", root]);
      await mkdir(join(root, ".projector/runtime"), { recursive: true }); await mkdir(join(root, "src")); await mkdir(join(root, "other"));
      await writeFile(join(root, ".projector/config.json"), '{"apiVersion":"projector.config/v1","enabled":true}\n');
      await writeFile(join(root, "src/owned.mjs"), "export const owned = true;\n");
      await writeFile(join(root, "src/unmapped.mjs"), "export const unmapped = true;\n");
      await writeFile(join(root, "other/unrelated.mjs"), "export const unrelated = true;\n");
      await author([requirement, concern].map((payload) => ({ kind: payload.id.startsWith("requirement:") ? "requirement" : "architecture-concern", operation: "add", expectedAbsent: true, payload, rationale: "Retain the accepted requirement and unresolved architecture question." })));
      const first = await executeProjector(["complete", "--format", "json"], { cwd: root });
      const questions = first.report.completion.questions;
      const blocker = questions.find((item: { kind: string }) => item.kind === "architecture-concern");
      const unmapped = questions.find((item: { ownerIds: string[] }) => item.ownerIds.includes("repository-group:src"));
      const unrelated = questions.find((item: { ownerIds: string[] }) => item.ownerIds.includes("repository-group:other"));
      expect(questions[0].id).toBe(blocker.id);
      expect(unmapped).toMatchObject({ affectedCount: 1, resolution: { route: "canonical-proposal" } });
      const files = new CanonicalFileRepository(root);
      const beforeRequirement = (await files.read("requirement", requirement.id))!;
      const beforeConcern = (await files.read("architecture-concern", concern.id))!;
      await author([
        { kind: "requirement", operation: "revise", expectedSemanticHash: beforeRequirement.semanticHash, expectedDocumentHash: beforeRequirement.canonicalDocumentHash, payload: { ...requirement, scope: { op: "any", items: [pathScope("src/owned.mjs"), pathScope("src/unmapped.mjs")] } }, rationale: "These two files realize the accepted ownership scope; this mapping makes no behavioral claim." },
        { kind: "architecture-concern", operation: "revise", expectedSemanticHash: beforeConcern.semanticHash, expectedDocumentHash: beforeConcern.canonicalDocumentHash, payload: { ...concern, status: "deferred", deferral: { rationale: "Storage choices are not required for current implementation.", preserveOptionality: ["Keep storage behind the existing boundary."], forbiddenCommitments: ["Do not add a vendor-specific storage dependency."], reconsiderWhen: [{ type: "date", at: "2099-01-01T00:00:00.000Z" }], reviewBy: "2099-01-01T00:00:00.000Z" } }, rationale: "Accept a bounded deferral preserving both options." },
      ]);
      const settled = await freshComplete();
      expect(settled.completion.questions.some((item: { id: string }) => item.id === blocker.id || item.id === unmapped.id)).toBe(false);
      expect(settled.completion.questions).toContainEqual(unrelated);
      await writeFile(join(root, "src/new.mjs"), "export const fresh = true;\n");
      const reopened = await freshComplete();
      expect(reopened.completion.questions).toContainEqual(expect.objectContaining({ id: unmapped.id, affectedCount: 1, evidenceHash: expect.not.stringMatching(unmapped.evidenceHash) }));
      expect(reopened.completion.questions).toContainEqual(unrelated);
      expect(reopened.completion.questions.some((item: { id: string }) => item.id === blocker.id)).toBe(false);
      const beforeCleanup = (await files.snapshot()).rootDigest;
      const cleanup = await executeProjector(["cleanup", "--mode", "observe", "--format", "json"], { cwd: root });
      expect(cleanup.report.completion).toMatchObject({ readOnly: true, execution: "not-performed", repairPlan: expect.any(Array) });
      expect((await files.snapshot()).rootDigest).toBe(beforeCleanup);
      expect(reopened.lanes.find((lane: { key: string }) => lane.key === "concept-mapping")).toMatchObject({ numerator: 2, denominator: 4 });
    } finally { await rm(root, { recursive: true, force: true }); }
  }, 30_000);

  it("normalizes scope, strictness, budgets and uses one provider report for text/JSON", async () => {
    const coverage = vi.fn(async () => report); const port = { coverage, complete: async () => report, cleanup: async () => report } satisfies CoverageCliPort;
    const json = await executeProjector(["coverage", "--scope", "./packages\\api", "--strictness", "bounded", "--budget-tokens", "12", "--budget-cost", "2.5", "--format", "json"], { coverage: port });
    expect(coverage).toHaveBeenCalledWith(expect.objectContaining({ scope: "packages/api", strictness: "bounded", budgetTokens: 12, budgetCost: 2.5 }));
    expect(JSON.parse(json.output)).toEqual(json.report);
    await expect(executeProjector(["coverage", "--scope", "a", "--scope", "a"], { coverage: port })).rejects.toThrow(/duplicate.*scope/iu);
    await expect(executeProjector(["complete", "--budget-tokens", "0"], { coverage: port })).rejects.toThrow(/positive.*budget|budget.*positive/iu);
    await expect(executeProjector(["complete", "--budget-tokens", "1.5"], { coverage: port })).rejects.toThrow(/integer/iu);
    await expect(executeProjector(["coverage", "--budget-cost", "1", "--budget-cost", "2"], { coverage: port })).rejects.toThrow(/duplicate.*budget-cost/iu);
    const complete = vi.fn(async () => report);
    await executeProjector(["complete", "--question-offset", "10"], { coverage: { ...port, complete } });
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ questionOffset: 10 }));
    await expect(executeProjector(["complete", "--question-offset", "1.5"], { coverage: port })).rejects.toThrow(/nonnegative/iu);
    await expect(executeProjector(["coverage", "--question-offset", "0"], { coverage: port })).rejects.toThrow(/only valid/iu);
  });

  it("applies unavailable, durable-budget, approval, and strictness exit precedence", async () => {
    const portFor = (patch: Record<string, unknown>): CoverageCliPort => ({ coverage: async () => ({ ...report, boundary: ["."], ...patch }), complete: async () => ({ ...report, boundary: ["."], ...patch }), cleanup: async () => ({ ...report, boundary: ["."], ...patch }) });
    expect((await executeProjector(["coverage"], { coverage: portFor({ unavailableSurfaceIds: ["surface:a"], budgetExhausted: true, continuationPersisted: true, approvalRequired: true }) })).exitCode).toBe(5);
    expect((await executeProjector(["complete"], { coverage: portFor({ budgetExhausted: true, continuationPersisted: true, approvalRequired: true }) })).exitCode).toBe(7);
    expect((await executeProjector(["complete"], { coverage: portFor({ approvalRequired: true }) })).exitCode).toBe(3);
    expect((await executeProjector(["coverage", "--strictness", "proven"], { coverage: portFor({ strictnessMet: true }) })).exitCode).toBe(4);
    expect((await executeProjector(["complete"], { coverage: portFor({ budgetExhausted: true, continuationPersisted: false }) })).exitCode).toBe(1);
    expect((await executeProjector(["cleanup", "--continuation", "missing"])).exitCode).toBe(5);
  });

  it("fails closed on flags/boundaries and permits read-only cleanup in observe mode", async () => {
    const cleanup = vi.fn(async () => ({ ...report, boundary: ["."] }));
    const port = { coverage: cleanup, complete: cleanup, cleanup } satisfies CoverageCliPort;
    await expect(executeProjector(["coverage", "--mystery"], { coverage: port })).rejects.toThrow(/unknown.*flag|argument/iu);
    await expect(executeProjector(["cleanup", "--dry-run", "--dry-run"], { coverage: port })).rejects.toThrow(/duplicate.*dry-run/iu);
    const dryRun = await executeProjector(["cleanup", "--dry-run", "--mode", "observe"], { coverage: port });
    expect(dryRun.report.policy.allowAutoMutation).toBe(false); expect(dryRun.exitCode).toBe(0); expect(cleanup).toHaveBeenCalledOnce();
    expect((await executeProjector(["coverage", "--scope", "packages/api"], { coverage: { ...port, coverage: async () => ({ ...report, proofStatement: "proven-within-boundary", strictnessMet: true, boundary: ["other"] }) } })).exitCode).not.toBe(0);
    expect((await executeProjector(["coverage", "--strictness", "partial"], { coverage: { ...port, coverage: async () => ({ ...report, boundary: ["."], lanes: [] }) } })).exitCode).not.toBe(0);
  });

  it("composes deterministic coverage from governed repository files and canonical state", async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projector-coverage-"));
    try {
      await mkdir(join(repositoryRoot, ".git"));
      await mkdir(join(repositoryRoot, ".projector"));
      await writeFile(join(repositoryRoot, ".projector", "config.json"), '{"apiVersion":"projector.config/v1","enabled":true}\n');
      await writeFile(join(repositoryRoot, "package.json"), JSON.stringify({ name: "fixture", scripts: { check: "node src/check.js" } }));
      await writeFile(join(repositoryRoot, "bad.json"), "{\"broken\":");
      const first = await executeProjector(["coverage", "--format", "json"], { cwd: repositoryRoot });
      const second = await executeProjector(["coverage"], { cwd: repositoryRoot });
      expect(first.report.lanes).toHaveLength(17);
      expect(new Set(first.report.lanes.map((lane: { key: string }) => lane.key))).toEqual(new Set(laneKeys));
      expect(first.report.localAnalysis).toMatchObject({ artifactCount: 2, projectionUnitCount: 2 });
      expect(first.report.localAnalysis.analyzerFailures).toContainEqual(expect.objectContaining({ capability: "document-parse", scope: "bad.json" }));
      expect(first.report.lanes.find((lane: { key: string }) => lane.key === "representation-projection-fidelity")).toMatchObject({ observability: "unavailable", numerator: 0, blindSpots: [expect.stringMatching(/projection evidence/iu)] });
      expect(first.report.boundState).toMatchObject({ dependencyDigest: expect.stringMatching(/^sha256:v1:/u) });
      expect(first.report.bindingValidation).toMatchObject({ status: "current", currentState: first.report.boundState.compiledAgainst });
      expect(first.report.bindingIdentity).toBe(first.report.boundState.dependencyDigest);
      expect(first.report).not.toHaveProperty("adapter");
      expect(second.report).toEqual(first.report);
      expect(second.output).toContain(`coverage: ${first.report.proofStatement}`);
      expect(second.output).toContain("behavioral satisfaction is not established");
      expect(JSON.parse(first.output)).toEqual(first.report);
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it("excludes sibling structured-document failures from fidelity coverage", async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "projector-coverage-formats-"));
    try {
      await mkdir(join(repositoryRoot, ".git"));
      await mkdir(join(repositoryRoot, ".projector"));
      await writeFile(join(repositoryRoot, ".projector", "config.json"), '{"apiVersion":"projector.config/v1","enabled":true}\n');
      await writeFile(join(repositoryRoot, "valid.toml"), "name = \"fixture\"\n");
      await writeFile(join(repositoryRoot, "duplicate.yaml"), "name: first\nname: second\n");
      const result = await executeProjector(["coverage"], { cwd: repositoryRoot });
      expect(result.report.localAnalysis.analyzerFailures).toContainEqual(expect.objectContaining({ capability: "duplicate-key", scope: "duplicate.yaml" }));
      expect(result.report.lanes.find((lane: { key: string }) => lane.key === "representation-projection-fidelity")).toMatchObject({ observability: "unavailable", numerator: 0, blindSpots: [expect.stringMatching(/projection evidence/iu)] });
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });
});
