import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { hashFramedDomain, hashSemantic, withCanonicalHashes, type AuthorityRecord } from "@projector/core";
import { CanonicalFileRepository } from "@projector/runtime";
import { describe, expect, it } from "vitest";
import { RepositoryKnowledgeService } from "../knowledge/service.js";
import { inspectRepositoryArchitecture } from "../knowledge/architecture-inspection.js";
import { RepositoryChangeLifecycleService } from "./service.js";

const exec = promisify(execFile);
const placeholder = hashSemantic("requirement", {});
const scope = { op: "atom", field: "path", matcher: "glob", value: "src/**" } as const;
const constraint = { id: "concept:boundary", key: "boundary", kind: "constraint", name: "Domain boundary", aliases: [], statement: "All domain behavior remains in src.", status: "active", sourceClass: "authored", confidence: 1, tags: [], evidence: [] };
const preference = { id: "preference:simple", key: "simple", scope: "project", selector: scope, strength: "prefer", statement: "Prefer simple infrastructure.", status: "active", sourceClass: "authored" };
const decision = { id: "decision:boundary", key: "boundary-decision", concernId: "concern:boundary", title: "Domain boundary", decision: "Keep domain code in src.", selectedOptionKey: "src", scope, lifecycle: "active", authorityRecordId: "authority:boundary", governanceBasis: [], consequences: [{ kind: "introduce-constraint", targetId: constraint.id, explanation: "Retain the domain ownership boundary." }], appliedPreferences: [{ key: preference.key, scope: "project", semanticHash: hashSemantic("developer-preference", preference), influence: "A single domain location avoids extra infrastructure." }], supersedesDecisionIds: [] };
const concern = { id: "concern:boundary", key: "boundary-concern", title: "Domain ownership", question: "Where does domain behavior belong?", scope, sourceClass: "authored", status: "resolved", materiality: "blocking-now", activationReasons: [], relatedConceptIds: [constraint.id], relatedRequirementIds: [], decisionIds: [decision.id], evidence: [] };
const authority: Omit<AuthorityRecord, "semanticHash"> = { id: "authority:boundary", key: "boundary-authority", subjectId: concern.id, status: "approved", conclusion: "preserve", rationale: "Accepted simple boundary.", alternatives: [], assumptions: [], reconsiderWhen: [{ type: "manual-review" }], vector: { explicitDecisionAlignment: 1, productConstraintFit: 1, semanticFit: 1, independentOccurrence: 1, historicalStability: 1, independentValidationSupport: 1, boundaryCoherence: 1, maintenanceOutcome: 1, platformCompatibility: 1, externalRationale: 0, ecosystemHealth: 0, securitySupport: 0, reversibility: 1, migrationCost: 0, counterEvidence: 0 }, assessmentConfidence: "high", evidence: [], governanceRiskClass: "R1", decidedBy: "user", createdAt: "2026-09-09T00:00:00.000Z" };
const addition = (kind: string, payload: object) => ({ kind, operation: "add", expectedAbsent: true, payload, rationale: "Record the accepted architecture and its actual products." });
const initialMutations = () => [addition("concept", constraint), addition("developer-preference", preference), addition("architecture-concern", concern), addition("architecture-decision", decision), addition("authority-record", authority)];
const proposal = (mutations: readonly unknown[] = initialMutations()) => ({ apiVersion: "projector.change-proposal/v1", architecture: null, analysisFacets: ["behavior", "architecture"], canonicalMutations: mutations });

async function repository() {
  const root = await mkdtemp(join(tmpdir(), "projector-architecture-products-"));
  await exec("git", ["init", "-q", root]);
  await exec("git", ["config", "user.name", "Projector Test"], { cwd: root });
  await exec("git", ["config", "user.email", "projector@example.invalid"], { cwd: root });
  await mkdir(join(root, "src")); await writeFile(join(root, "src/value.mjs"), "export const value = 1;\n");
  return root;
}

describe("public architectural products", () => {
  it("requires relevant decision reconsideration and accepts an explicit same-transaction reaffirmation", async () => {
    const root = await repository();
    try {
      const files = new CanonicalFileRepository(root);
      const requirement = { id: "requirement:boundary", key: "boundary-requirement", title: "Domain location", aliases: [], statement: "Domain behavior stays in src.", status: "active", sourceClass: "authored", scope, origin: [], evidence: [], semanticHash: placeholder, discoveryHash: placeholder };
      const baselineAuthority = { ...authority, reconsiderWhen: [{ type: "requirement-changed", subjectId: requirement.id }] as const };
      const records = [
        ["concept", constraint, "active"],
        ["developer-preference", preference, "active"],
        ["requirement", requirement, "active"],
        ["architecture-concern", concern, "resolved"],
        ["architecture-decision", decision, "active"],
        ["authority-record", baselineAuthority, "approved"],
      ] as const;
      for (const [kind, payload, lifecycle] of records) {
        const hashedPayload = kind === "concept" || kind === "requirement"
          ? { ...payload, discoveryHash: placeholder, semanticHash: placeholder }
          : { ...payload, semanticHash: placeholder };
        await files.write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind, id: payload.id, key: payload.key, lifecycle, payload: hashedPayload }));
      }
      await exec("git", ["add", ".projector"], { cwd: root });
      await exec("git", ["commit", "-qm", "tracked architecture baseline"], { cwd: root });

      const beforeRequirement = (await files.read("requirement", requirement.id))!;
      const { semanticHash: _requirementSemanticHash, discoveryHash: _requirementDiscoveryHash, ...requirementPayload } = beforeRequirement.payload;
      const revisedRequirement = {
        kind: "requirement", operation: "revise", expectedSemanticHash: beforeRequirement.semanticHash, expectedDocumentHash: beforeRequirement.canonicalDocumentHash,
        payload: { ...requirementPayload, statement: "Domain behavior and adapters stay in src." }, rationale: "Expand the accepted boundary requirement.",
      };
      const lifecycle = await RepositoryChangeLifecycleService.create(root);
      const blockedCapture = await lifecycle.capture({ request: "Expand the boundary requirement without reconsidering its decision.", proposal: proposal([revisedRequirement]) });
      expect(blockedCapture.compiled.compiledPlan.plan.completionCriteria.requiredValidators).toContain("projector.canonical-decision-baselines");
      const blockedApproval = await lifecycle.approve(blockedCapture.capture.semanticChangeId, blockedCapture.capture.planHash);
      const blocked = await lifecycle.apply(blockedApproval.id);
      expect(blocked.outcome).toBe("partial");
      expect(blocked.reasons).toContain("required validation projector.canonical-decision-baselines blocked");
      expect(blocked.validations).toEqual(expect.arrayContaining([expect.objectContaining({
        validatorId: "projector.canonical-decision-baselines", status: "blocked",
        details: expect.objectContaining({ decisionValidity: expect.arrayContaining([expect.objectContaining({ decisionId: decision.id, assessment: expect.objectContaining({ blocksCurrentChange: true }) })]) }),
      })]));
      expect((await files.read("requirement", requirement.id))!.canonicalDocumentHash).toBe(beforeRequirement.canonicalDocumentHash);

      const beforeAuthority = (await files.read("authority-record", baselineAuthority.id))!;
      const { semanticHash: _authoritySemanticHash, discoveryHash: _authorityDiscoveryHash, ...authorityPayload } = beforeAuthority.payload;
      const reaffirmed = await lifecycle.capture({ request: "Expand the requirement and explicitly reaffirm the governing decision under the new observation.", proposal: proposal([
        revisedRequirement,
        {
          kind: "authority-record", operation: "revise", expectedSemanticHash: beforeAuthority.semanticHash, expectedDocumentHash: beforeAuthority.canonicalDocumentHash,
          payload: { ...authorityPayload, rationale: "Reaffirm the accepted boundary after reviewing the expanded requirement." }, rationale: "Capture the reviewed trigger observation in this same transaction.",
        },
      ]) });
      const reaffirmedApproval = await lifecycle.approve(reaffirmed.capture.semanticChangeId, reaffirmed.capture.planHash);
      const accepted = await lifecycle.apply(reaffirmedApproval.id);
      expect(accepted.outcome, accepted.reasons.join("; ")).toBe("success");
      expect(accepted.validations).toEqual(expect.arrayContaining([expect.objectContaining({ validatorId: "projector.canonical-decision-baselines", status: "passed" })]));
      expect((await files.read("requirement", requirement.id))!.payload.statement).toContain("and adapters");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("preserves an unrealized requirement and scenario, then revises their implementation scope without replacing their identities", async () => {
    const root = await repository();
    try {
      const lifecycle = await RepositoryChangeLifecycleService.create(root);
      const futureScope = { op: "atom", field: "path", matcher: "glob", value: "future/**" };
      const requirement = { id: "requirement:future-export", key: "future-export", title: "Export provenance", aliases: [], statement: "A future export preserves original provenance.", status: "active", sourceClass: "authored", scope: futureScope, origin: [{ kind: "user-request", locator: "test:future-capability" }], evidence: [] };
      const scenario = { id: "scenario:future-export", key: "export-provenance", title: "Export retains provenance", aliases: [], status: "active", sourceClass: "authored", scope: futureScope, steps: [{ role: "trigger", statement: "The user exports a record." }, { role: "expected-outcome", statement: "The export retains its original provenance." }], evidence: [] };
      const captured = await lifecycle.capture({ request: "Preserve the future export before code exists", proposal: proposal([addition("requirement", requirement), addition("behavioral-scenario", scenario)]) });
      const approval = await lifecycle.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      expect((await lifecycle.apply(approval.id)).outcome).toBe("success");
      const files = new CanonicalFileRepository(root);
      const beforeRequirement = (await files.read("requirement", requirement.id))!;
      expect(beforeRequirement.payload.scope).toEqual(futureScope);
      const beforeScenario = (await files.read("behavioral-scenario", scenario.id))!;
      const realization = { selector: scope, origin: { kind: "content" as const, locator: "test:future-export-realization", contentHash: hashFramedDomain("architecture-products-realization-origin", "accepted future export implementation") } };
      const revisions = [beforeRequirement, beforeScenario].map((before) => {
        const { semanticHash: _semanticHash, discoveryHash: _discoveryHash, ...payload } = before.payload;
        return { kind: before.kind, operation: "revise", expectedSemanticHash: before.semanticHash, expectedDocumentHash: before.canonicalDocumentHash, payload: { ...payload, scope, realizations: [realization] }, rationale: "The accepted capability now belongs to the existing source surface; its behavior is preserved." };
      });
      const next = await lifecycle.capture({ request: "Bind the preserved export capability to its implementation surface", proposal: proposal(revisions) });
      const nextApproval = await lifecycle.approve(next.capture.semanticChangeId, next.capture.planHash);
      const result = await lifecycle.apply(nextApproval.id);
      expect(result.outcome, JSON.stringify(result)).toBe("success");
      expect(result.receipt.changedRequirementIds).toContain(requirement.id);
      expect(result.receipt.changedScenarioIds).toContain(scenario.id);
      const after = (await files.read("requirement", requirement.id))!;
      expect(after.payload).toMatchObject({ statement: requirement.statement, origin: requirement.origin, scope, realizations: [realization] });
      expect(after.semanticHash).not.toBe(beforeRequirement.semanticHash);
      expect((await files.read("behavioral-scenario", scenario.id))!.payload.steps).toEqual(scenario.steps);
      const knowledge = await RepositoryKnowledgeService.create(root);
      const context = await knowledge.context({ request: "Implement provenance-preserving export", entities: [requirement.id], persist: false });
      expect(context.interpretation.status).toBe("direct");
      expect(JSON.stringify(context)).toContain("src/value.mjs");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("commits the concern, preference, decision and required consequence together, then preserves them through clone and preference evolution", async () => {
    const root = await repository(); const clone = `${root}-clone`;
    try {
      const lifecycle = await RepositoryChangeLifecycleService.create(root);
      const captured = await lifecycle.capture({ request: "Accept the domain boundary and its rationale", proposal: proposal() });
      const approval = await lifecycle.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      const result = await lifecycle.apply(approval.id);
      expect(result.outcome, JSON.stringify(result)).toBe("success");
      expect(result.receipt.changedCanonicalEntityIds).toEqual(expect.arrayContaining([concern.id, preference.id, decision.id, constraint.id]));
      const files = new CanonicalFileRepository(root);
      const before = (await files.read("developer-preference", preference.id))!;
      const { semanticHash: _hash, ...payload } = before.payload;
      const changed = await lifecycle.capture({ request: "Prefer managed infrastructure for future options", proposal: proposal([{
        kind: "developer-preference", operation: "revise", expectedSemanticHash: before.semanticHash, expectedDocumentHash: before.canonicalDocumentHash,
        payload: { ...payload, statement: "Prefer managed infrastructure for future decisions." }, rationale: "This is a future soft preference, not a change to accepted architecture.",
      }]) });
      const nextApproval = await lifecycle.approve(changed.capture.semanticChangeId, changed.capture.planHash);
      expect((await lifecycle.apply(nextApproval.id)).outcome).toBe("success");
      const inspected = await inspectRepositoryArchitecture(root);
      expect(await inspected.population.inspect(inspected.decisions[0]!)).toMatchObject({ count: 1, observability: "closed" });
      expect(await inspected.validity(decision.id)).toMatchObject({ state: "valid", blocksCurrentChange: false });
      expect((await files.read("architecture-decision", decision.id))!.payload.appliedPreferences).toEqual(decision.appliedPreferences);
      await exec("git", ["add", "src", ".projector/model", ".projector/concerns", ".projector/preferences", ".projector/decisions", ".projector/authorities"], { cwd: root });
      await exec("git", ["commit", "-qm", "accepted conceptual architecture"], { cwd: root });
      await exec("git", ["clone", "-q", "--no-hardlinks", root, clone]);
      const fresh = await RepositoryKnowledgeService.create(clone);
      const context = await fresh.context({ request: "Review domain ownership", entities: [concern.id], persist: false });
      expect(context.interpretation.status).toBe("direct");
      expect((await new CanonicalFileRepository(clone).read("developer-preference", preference.id))!.payload.statement).toContain("managed infrastructure");
    } finally { await rm(root, { recursive: true, force: true }); await rm(clone, { recursive: true, force: true }); }
  });

  it("refuses unsupported declared products and implicit personal preference adoption before writing any canonical state", async () => {
    const root = await repository();
    try {
      const lifecycle = await RepositoryChangeLifecycleService.create(root);
      const invalid = proposal(initialMutations().map((mutation) => mutation.kind === "architecture-decision" ? { ...mutation, payload: { ...decision, consequences: [{ kind: "require-migration", targetId: "migration:missing", explanation: "A real migration is required." }] } } : mutation));
      await expect(lifecycle.capture({ request: "Accept migration architecture", proposal: invalid })).rejects.toThrow(/consequence require-migration.*unavailable/);
      await expect(lifecycle.capture({ request: "Implicitly adopt personal preference", proposal: proposal([addition("developer-preference", { ...preference, scope: "user" })]) })).rejects.toThrow(/project scope/);
      expect((await new CanonicalFileRepository(root).snapshot()).documents).toHaveLength(0);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
