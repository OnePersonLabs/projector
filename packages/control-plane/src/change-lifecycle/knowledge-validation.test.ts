import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { hashFramedDomain, parseChangeProposal, withCanonicalHashes, type AuthorityRecord, type ProjectionLens } from "@projector/core";
import { createRepositoryScriptLens } from "@projector/engine";
import { CanonicalFileRepository } from "@projector/runtime";
import { expect } from "vitest";
import { integrationTest as it } from "../../../../scripts/testing/integration-test.mjs";

import { RepositoryKnowledgeService } from "../knowledge/service.js";
import { compileRepositoryChange } from "./compiler.js";
import { validatePostChangeKnowledge } from "./knowledge-validation.js";
import { observeChangeRepository } from "./repository-observer.js";

const exec = promisify(execFile);
const hash = hashFramedDomain("post-knowledge-test", null);

async function repository() {
  const root = await mkdtemp(join(tmpdir(), "projector-post-knowledge-"));
  await mkdir(join(root, "src")); await mkdir(join(root, "test"));
  await writeFile(join(root, "package.json"), '{"type":"module"}\n');
  await writeFile(join(root, "src/value.mjs"), "export const value = 1;\n");
  await writeFile(join(root, "test/value.test.mjs"), "import assert from 'node:assert/strict'; import { value } from '../src/value.mjs'; assert.ok(value > 0);\n");
  const authority: AuthorityRecord = {
    id: "authority:boundary", key: "authority:boundary", subjectId: "lens:boundary", status: "approved", conclusion: "normalize", rationale: "Keep source independent of the forbidden package.",
    alternatives: [], assumptions: [], reconsiderWhen: [{ type: "manual-review" }], evidence: [], assessmentConfidence: "high", governanceRiskClass: "R1", decidedBy: "user", createdAt: "2026-09-09T00:00:00.000Z", semanticHash: hash,
    vector: { explicitDecisionAlignment: 1, productConstraintFit: 1, semanticFit: 1, independentOccurrence: 1, historicalStability: 1, independentValidationSupport: 1, boundaryCoherence: 1, maintenanceOutcome: 1, platformCompatibility: 1, externalRationale: 0, ecosystemHealth: 0, securitySupport: 0, reversibility: 1, migrationCost: 0, counterEvidence: 0 },
  };
  const selector = { op: "atom", field: "path", matcher: "glob", value: "src/**" } as const;
  const base = createRepositoryScriptLens({ id: "lens:boundary", status: "active", authorityRecordId: authority.id, selector, governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:boundary" }] });
  const lens: ProjectionLens = { ...base, rules: [{
    id: "rule:boundary", key: "rule:boundary", version: "1", selector, effect: "validate", authorityClass: "active-lens", governanceBasis: base.governanceBasis,
    predicates: [{ kind: "dependency-forbidden", from: selector, to: { op: "atom", field: "package", matcher: "equals", value: "@forbidden/pkg" } }],
    rationale: authority.rationale, evidence: [], conflictPolicy: "error", validatorIds: ["projector.builtin.static-dependency-boundary@1"], transformIds: [], semanticHash: hash,
  }],
    validators: [{ id: "projector.builtin.static-dependency-boundary", version: "1", provider: "deterministic-governance", input: { ruleIds: ["rule:boundary"] }, required: true }],
    expectedProjections: base.expectedProjections.map((projection) => ({ ...projection, expectation: { kind: "predicate-constrained", predicateIds: ["rule:boundary"], validatorIds: ["projector.builtin.static-dependency-boundary@1"] } })),
  };
  const canonical = new CanonicalFileRepository(root);
  for (const [kind, payload, lifecycle] of [["authority-record", authority, "approved"], ["projection-lens", lens, "active"]] as const) {
    await canonical.write(withCanonicalHashes({ apiVersion: "projector/v3", schemaVersion: "3.0.0", kind, id: payload.id, key: payload.key, lifecycle, payload: { ...payload } }));
  }
  await exec("git", ["init", "-q"], { cwd: root });
  await exec("git", ["-c", "user.email=projector@example.invalid", "-c", "user.name=Projector Test", "add", "."], { cwd: root });
  await exec("git", ["-c", "user.email=projector@example.invalid", "-c", "user.name=Projector Test", "commit", "-qm", "baseline"], { cwd: root });
  return root;
}

it("validates actual post-state lenses, including new members, and permits different conforming code", async () => {
  const root = await repository();
  try {
    const knowledge = await RepositoryKnowledgeService.create(root);
    const retained = await knowledge.context({ request: "Preserve source dependency boundaries.", namedTargets: ["src/value.mjs"] });
    const proposal = parseChangeProposal({ apiVersion: "projector.change-proposal/v1",
      requirements: [{ key: "positive-value", title: "Positive value", statement: "The value remains positive." }],
      scenarios: [{ key: "read-value", title: "Read value", steps: [{ role: "trigger", statement: "Read the value." }, { role: "expected-outcome", statement: "The value is positive." }] }],
      architecture: null, edits: [{ path: "src/value.mjs", before: "export const value = 1;\n", after: "const replacement = 2; export { replacement as value };\n" }, { path: "src/next.mjs", before: null, after: "export const next = 3;\n" }],
      validation: { independentNodeTests: ["test/value.test.mjs"] }, analysisFacets: ["behavior", "architecture"],
    });
    const compiled = await compileRepositoryChange({ repositoryRoot: root, request: "Change the implementation and add a source.", proposal, knowledgeContext: retained });
    expect(compiled.compiledPlan.packets[0]!.capsule.requiredValidations).toContain("projector.post-change-knowledge");
    expect(compiled.compiledChange.boundState.valueDependencies).toEqual(expect.arrayContaining([expect.objectContaining({ id: `knowledge-context:${retained.id}` })]));
    for (const edit of compiled.exactPatchInput.edits) {
      const path = join(root, edit.path); await mkdir(join(path, ".."), { recursive: true }); await writeFile(path, edit.after!);
    }
    const validate = async () => validatePostChangeKnowledge(compiled, await observeChangeRepository(root), "2026-09-09T00:00:00Z", () => "2026-09-09T00:00:01Z");
    const allowed = await validate();
    expect(allowed.status, JSON.stringify(allowed.details?.reasons)).toBe("passed");
    expect(allowed.details).toMatchObject({ semanticFidelity: "not-established", retainedReconciliation: { status: "stale", governance: { status: "conformant" } } });
    await writeFile(join(root, "src/next.mjs"), "import '@forbidden/pkg'; export const next = 3;\n");
    expect((await validate()).status).toBe("failed");
    await writeFile(join(root, "src/next.mjs"), "export const next = (name) => import(name);\n");
    expect((await validate()).status).toBe("failed");
    await writeFile(join(root, "src/next.mjs"), "export const next = 3;\n");
    await rm(join(root, "src/value.mjs"));
    const withoutContext = { ...compiled, knowledgeContext: undefined };
    const { knowledgeContext: _omitted, ...noRetainedContext } = withoutContext;
    const removed = await validatePostChangeKnowledge(noRetainedContext, await observeChangeRepository(root), "2026-09-09T00:00:00Z", () => "2026-09-09T00:00:01Z");
    expect(removed.status).toBe("failed");
    expect(JSON.stringify(removed.details?.reasons)).toContain("Previously governed source src/value.mjs");
  } finally { await rm(root, { recursive: true, force: true }); }
});
