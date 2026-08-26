import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { deriveEntityId, hashFramedDomain, withCanonicalHashes, type BehavioralScenario, type Requirement } from "@projector/core";
import { executionPlanHash } from "@projector/engine";
import { CanonicalFileRepository } from "@projector/runtime";
import { describe, expect, it } from "vitest";

import { compileRepositoryChange } from "./compiler.js";
import { parseChangeProposal, type ChangeProposal } from "./proposal.js";

const exec = promisify(execFile);
const placeholder = hashFramedDomain("test", "placeholder");

function proposal(): ChangeProposal {
  return parseChangeProposal({
    apiVersion: "projector.change-proposal/v1",
    requirements: [{ key: "greeting-personalization", title: "Personalized greeting", statement: "The greeting includes the supplied name.", aliases: ["named-greeting"] }],
    scenarios: [{ key: "greet-supplied-name", title: "Greet a supplied name", steps: [
      { role: "precondition", statement: "A caller supplies a nonblank name." },
      { role: "trigger", statement: "The caller requests a greeting." },
      { role: "expected-outcome", statement: "The result includes that exact name." },
    ] }],
    architecture: null,
    edits: [{ path: "src/greeting.mjs", before: "export const greet = () => 'hello';\n", after: "export const greet = (name = '') => name ? `hello ${name}` : 'hello';\n" }],
    validation: { independentNodeTests: ["test/public-contract.test.mjs"], supplementalNodeTests: [] },
    analysisFacets: ["behavior", "architecture"],
  });
}

function workspaceProposal(): ChangeProposal {
  return parseChangeProposal({
    apiVersion: "projector.change-proposal/v1",
    requirements: [{ key: "greeting-workspace", title: "Greeting workspace", statement: "The greeting package has an explicit workspace manifest." }],
    scenarios: [{ key: "load-greeting-workspace", title: "Load greeting workspace", steps: [
      { role: "trigger", statement: "A caller loads the greeting workspace." },
      { role: "expected-outcome", statement: "The workspace exposes its module manifest." },
    ] }],
    architecture: {
      concernKey: "task-orchestration",
      title: "Task orchestration",
      question: "When do existing task dependencies stop being safely coordinated by simple scripts?",
      materiality: "deferable",
      deferral: {
        rationale: "This change adds one leaf workspace and does not alter root task orchestration.",
        reconsiderWhen: "A second workspace introduces an inter-package task dependency.",
        validUntil: "2027-02-26T00:00:00.000Z",
        preservedOptions: ["Retain the option to introduce orchestration after dependency evidence exists."],
        forbiddenCommitments: ["Do not select an orchestration technology in this change."],
        forbiddenWritePaths: ["package.json"],
      },
    },
    edits: [{ path: "packages/greeting/package.json", before: null, after: "{\"name\":\"greeting\",\"type\":\"module\"}\n" }],
    validation: { independentNodeTests: ["test/public-contract.test.mjs"], supplementalNodeTests: [] },
    analysisFacets: ["behavior", "architecture", "workspace-expansion"],
  });
}

async function existingRequirement(root: string, id: string, key: string, aliases: string[]): Promise<void> {
  const payload: Requirement = {
    id, key, title: "Legacy named greeting", aliases, statement: "A greeting may include a name.", status: "active",
    sourceClass: "authored", scope: { op: "atom", field: "path", matcher: "equals", value: "src/greeting.mjs" },
    origin: [{ kind: "document", locator: "README.md" }], evidence: [], discoveryHash: placeholder, semanticHash: placeholder,
  };
  await new CanonicalFileRepository(root).write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "requirement", id, key, lifecycle: "active", payload: { ...payload } }));
}

async function existingScenario(root: string): Promise<void> {
  const payload: BehavioralScenario = {
    id: "scenario:greet-supplied-name", key: "greet-supplied-name", title: "Greet a supplied name", aliases: [], status: "active",
    sourceClass: "authored", scope: { op: "atom", field: "path", matcher: "equals", value: "src/greeting.mjs" },
    steps: proposal().scenarios[0]!.steps.map((step) => ({ ...step })), evidence: [], discoveryHash: placeholder, semanticHash: placeholder,
  };
  await new CanonicalFileRepository(root).write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "behavioral-scenario", id: payload.id, key: payload.key, lifecycle: "active", payload: { ...payload } }));
}

async function repository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "projector-change-compiler-"));
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "test"), { recursive: true });
  await writeFile(join(root, "package.json"), "{\"type\":\"module\"}\n");
  await writeFile(join(root, "src", "greeting.mjs"), "export const greet = () => 'hello';\n");
  await writeFile(join(root, "src", "index.mjs"), "import { greet } from './greeting.mjs'; export { greet };\n");
  await writeFile(join(root, "test", "public-contract.test.mjs"), "import assert from 'node:assert/strict'; import { greet } from '../src/index.mjs'; assert.equal(greet(), 'hello');\n");
  await existingRequirement(root, "requirement:legacy-greeting", "legacy-greeting", ["named-greeting"]);
  await exec("git", ["init", "-q"], { cwd: root });
  await exec("git", ["config", "user.email", "projector@example.invalid"], { cwd: root });
  await exec("git", ["config", "user.name", "Projector Test"], { cwd: root });
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-qm", "initial"], { cwd: root });
  return root;
}

describe("repository change compiler", () => {
  it("reuses semantic identity, binds reverse relevance, projects a spec, and compiles one exact packet", async () => {
    const root = await repository();
    try {
      const request = "Let greet accept a name while preserving callers that do not pass one.";
      const first = await compileRepositoryChange({ repositoryRoot: root, request, proposal: proposal(), now: "2026-08-26T00:00:00.000Z" });
      const second = await compileRepositoryChange({ repositoryRoot: root, request, proposal: proposal(), now: "2026-08-26T00:00:00.000Z" });

      expect(first.compiledChange.change.id).toBe(second.compiledChange.change.id);
      expect(first.planHash).toBe(second.planHash);
      expect(first.identityResolutions).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: "requirement", outcome: "reuse-existing", targetId: "requirement:legacy-greeting" }),
        expect.objectContaining({ kind: "scenario", outcome: "create-new" }),
      ]));
      expect(first.canonicalWrites.map(({ id }) => id)).toContain("requirement:legacy-greeting");
      expect(first.compiledChange.change.operations.filter(({ subjectType }) => subjectType === "requirement")[0]).toMatchObject({ requirementId: "requirement:legacy-greeting" });
      expect(first.relevance.knownAffectedPaths).toEqual(["src/greeting.mjs", "src/index.mjs", "test/public-contract.test.mjs"]);
      expect(first.compiledChange.boundState.queryDependencies.map(({ query }) => query.id)).toEqual(expect.arrayContaining([
        expect.stringMatching(/^identity:/u),
        expect.stringMatching(/^relevance:/u),
      ]));
      expect(first.compiledChange.boundState.queryDependencies.map(({ query }) => query.id)).not.toEqual(expect.arrayContaining([expect.stringMatching(/^architecture-deferral:/u)]));
      expect(first.representation).toMatchObject({ profileId: expect.any(String), preservationHash: expect.stringMatching(/^sha256:v1:/u) });
      expect(first.compiledPlan.plan.semanticChangeId).toBe(first.compiledChange.change.id);
      expect(first.planHash).toBe(executionPlanHash(first.compiledPlan.plan));
      expect(first.compiledPlan.packets).toHaveLength(1);
      expect(first.compiledPlan.packets[0]?.packet.transformId).toBe("exact-text-patch");
      expect(first.compiledPlan.packets[0]?.capsule.decisionIds).toEqual([]);
      expect(first.architectureDeferral).toBeUndefined();
      expect(first.relevance.possibleFrontierUnitIds.length).toBeGreaterThan(0);
      expect(first.relevance.unavailableSurfaceIds).toEqual([]);
      expect(first.independentValidators[0]).toMatchObject({ path: "test/public-contract.test.mjs", tracked: true });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("blocks duplicate identity candidates and invalid or expired deferrals", async () => {
    const root = await repository();
    try {
      await existingRequirement(root, "requirement:other-greeting", "other-greeting", ["named-greeting"]);
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "Change greeting", proposal: proposal(), now: "2026-08-26T00:00:00.000Z" })).rejects.toThrow(/ambiguous|duplicate.*identity/iu);
    } finally { await rm(root, { recursive: true, force: true }); }

    const clean = await repository();
    try {
      const bounded = workspaceProposal();
      const secretlySelecting = {
        ...bounded,
        architecture: {
          ...bounded.architecture!,
          deferral: { ...bounded.architecture!.deferral, forbiddenCommitments: ["Must use Redis."] },
        },
      };
      await expect(compileRepositoryChange({ repositoryRoot: clean, request: "Change greeting", proposal: secretlySelecting, now: "2026-08-26T00:00:00.000Z" })).rejects.toThrow(/deferral.*invalid|selects.*option/iu);
      const invented = { ...bounded, architecture: { ...bounded.architecture!, concernKey: "invented-concern" } };
      await expect(compileRepositoryChange({ repositoryRoot: clean, request: "Change greeting", proposal: invented, now: "2026-08-26T00:00:00.000Z" })).rejects.toThrow(/not.*derived|mismatch|discovered/iu);
      const deferred = await compileRepositoryChange({ repositoryRoot: clean, request: "Add a leaf greeting workspace", proposal: bounded, now: "2026-08-26T00:00:00.000Z" });
      expect(deferred.architectureDeferral).toMatchObject({ concernKey: "task-orchestration", materiality: "deferable", authoritativeDecision: false });
      expect(deferred.compiledPlan.packets[0]?.capsule.forbiddenWrites).toEqual(expect.arrayContaining([
        expect.objectContaining({ selector: expect.objectContaining({ value: "package.json" }) }),
      ]));
      await expect(compileRepositoryChange({ repositoryRoot: clean, request: "Change greeting", proposal: bounded, now: "2028-08-26T00:00:00.000Z" })).rejects.toThrow(/deferral.*expired/iu);
      const blocking = parseChangeProposal({ ...proposal(), analysisFacets: ["behavior", "architecture", "public-contract"] });
      await expect(compileRepositoryChange({ repositoryRoot: clean, request: "Change public greeting API", proposal: blocking, now: "2026-08-26T00:00:00.000Z" })).rejects.toThrow(/blocking.*architecture|canonical decision/iu);
    } finally { await rm(clean, { recursive: true, force: true }); }
  });

  it("creates stable new identities without colliding with an occupied derived ID", async () => {
    const root = await repository();
    try {
      const occupied = deriveEntityId("projector.requirement", "new-requirement");
      await existingRequirement(root, occupied, "unrelated", []);
      const changed = parseChangeProposal({ ...proposal(), requirements: [{ key: "new-requirement", title: "New", statement: "New behavior." }] });
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "New behavior", proposal: changed, now: "2026-08-26T00:00:00.000Z" })).rejects.toThrow(/stable ID.*occupied|identity.*collision/iu);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("reuses an unchanged scenario without compiling a no-op canonical edit", async () => {
    const root = await repository();
    try {
      await existingScenario(root);
      const compiled = await compileRepositoryChange({ repositoryRoot: root, request: "Change greeting without rewriting its existing scenario.", proposal: proposal(), now: "2026-08-26T00:00:00.000Z" });
      expect(compiled.identityResolutions).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: "scenario", outcome: "reuse-existing", targetId: "scenario:greet-supplied-name" }),
      ]));
      expect(compiled.canonicalWrites).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: "scenario:greet-supplied-name" })]));
      expect(compiled.exactPatchInput.edits.every(({ before, after }) => before !== after)).toBe(true);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
