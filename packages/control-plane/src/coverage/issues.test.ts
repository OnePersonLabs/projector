import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeLocalRepository } from "@projector/analyzers";
import { hashFramedDomain, withCanonicalHashes, type CanonicalDocumentEnvelope } from "@projector/core";
import { CanonicalFileRepository } from "@projector/runtime";
import { describe, expect, it } from "vitest";
import { completionRepairAlternatives, deriveCompletionQuestions } from "./issues.js";
import { inspectRepositoryCoverage } from "./service.js";
import { CompletionQuestionSchema } from "./transport.js";

describe("evidence-bound completion repair", () => {
  it("routes an accepted unrealized scenario to implementation repair without requiring a meaning change", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-audit-routes-"));
    try {
      const payload = { id: "scenario:future", key: "future", title: "Future behavior", aliases: [], status: "active", sourceClass: "authored", scope: { op: "atom", field: "path", matcher: "glob", value: "future/**" }, steps: [{ role: "trigger", statement: "The user requests an export." }, { role: "expected-outcome", statement: "The export preserves provenance." }], evidence: [] };
      const hash = hashFramedDomain("audit-fixture", payload);
      const envelope = withCanonicalHashes({ apiVersion: "projector/v3", schemaVersion: "3.0.0", kind: "behavioral-scenario", id: payload.id, key: payload.key, lifecycle: "active", payload: { ...payload, semanticHash: hash, discoveryHash: hash } }) as CanonicalDocumentEnvelope;
      await new CanonicalFileRepository(root).write(envelope);
      const result = await inspectRepositoryCoverage(root, { scope: "." }, "cleanup");
      const question = result.completion.questions.find(({ kind }) => kind === "unrealized-scenario")!;
      expect(question.assessment).toEqual({ status: "unknown", category: "unrealized-behavior" });
      expect(question.resolution.route).toBe("implementation-repair");
      expect(question.resolution.instruction).toContain("Preserve accepted meaning");
      expect(CompletionQuestionSchema.safeParse(question).success).toBe(true);
      expect(result.completion.execution).toBe("not-performed");
      expect(result.completion.repairPlan?.find(({ questionId }) => questionId === question.id)?.evidenceHash).toBe(question.evidenceHash);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("does not substitute a similarly named runtime primitive for an unsupported lens binding", () => {
    const alternatives = completionRepairAlternatives("implementation-repair", ["move-repository-script@1"]);
    expect(alternatives.map(({ strategy }) => strategy)).toEqual(["reuse", "revalidate", "regenerate", "deterministic-patch", "agent-repair", "widen-analysis", "human-decision"]);
    expect(alternatives.find(({ strategy }) => strategy === "deterministic-patch")).toMatchObject({ status: "unavailable", capabilityIds: ["move-repository-script@1"] });
    expect(completionRepairAlternatives("implementation-repair", ["exact-text-patch@1"]).find(({ strategy }) => strategy === "deterministic-patch")).toMatchObject({ status: "available" });
    expect(completionRepairAlternatives("missing-evidence", ["exact-text-patch@1"]).find(({ strategy }) => strategy === "deterministic-patch")?.status).toBe("unavailable");
  });

  it("routes generated findings upstream first and does not offer an exact-text patch", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-audit-generated-output-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(join(root, "src/generated.mjs"), "// @generated\nexport const value = 1;\n");
      const analysis = await analyzeLocalRepository({ repositoryRoot: root });
      const generatedUnit = analysis.projectionUnits.find(({ key }) => key === "src/generated.mjs")!;
      expect(generatedUnit.tags).toContain("generated");
      expect(generatedUnit.generatedFromUnitIds).toEqual([]);

      const lens = { id: "lens:generated", authorityRecordId: "authority:generated", transforms: [{ id: "exact-text-patch", version: "1" }], rules: [] };
      const graph = {
        units: [generatedUnit], lenses: [lens], entities: [], entitiesById: new Map(), observation: { realizations: [] },
        implementationBindings: () => [generatedUnit], semanticHash: () => undefined, sourceHash: () => undefined,
      };
      const questions = deriveCompletionQuestions({
        graph: graph as never,
        unitIds: new Set([generatedUnit.id]), decisions: [], authorityProblems: [], includeUnrealized: false, now: "2026-09-27T00:00:00.000Z",
        evaluations: [{ lensId: lens.id, evaluation: { unitId: generatedUnit.id, findings: [{ ruleId: "rule:generated", status: "violated", reason: "Generated output violates the accepted boundary." }] } as never }],
      });

      const question = questions[0]!;
      expect(question.reasons.join(" ")).toContain("Inspect its upstream source and generator first");
      expect(question.reasons.join(" ")).toContain("do not patch the output directly");
      expect(question.resolution.alternatives.find(({ strategy }) => strategy === "regenerate"))
        .toMatchObject({ status: "unavailable", reason: expect.stringContaining("until an executable lifecycle generator is registered") });
      expect(question.resolution.alternatives.find(({ strategy }) => strategy === "deterministic-patch"))
        .toMatchObject({ status: "unavailable", reason: expect.stringContaining("Do not patch the output directly") });
      expect(question.evidenceHash).toMatch(/^sha256:v1:/u);

      const transformedUnit = { ...generatedUnit, tags: generatedUnit.tags.filter((tag) => tag !== "generated"), causalOrigin: { kind: "lens-transform" as const }, generatedFromUnitIds: [] };
      const transformedGraph = { ...graph, units: [transformedUnit], implementationBindings: () => [transformedUnit] };
      const transformedQuestion = deriveCompletionQuestions({
        graph: transformedGraph as never,
        unitIds: new Set([transformedUnit.id]), decisions: [], authorityProblems: [], includeUnrealized: false, now: "2026-09-27T00:00:00.000Z",
        evaluations: [{ lensId: lens.id, evaluation: { unitId: transformedUnit.id, findings: [{ ruleId: "rule:generated", status: "violated", reason: "Transformed source violates the accepted boundary." }] } as never }],
      })[0]!;
      expect(transformedQuestion.reasons.join(" ")).not.toContain("Generated output is affected");
      expect(transformedQuestion.resolution.alternatives.find(({ strategy }) => strategy === "deterministic-patch"))
        .toMatchObject({ status: "available" });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
