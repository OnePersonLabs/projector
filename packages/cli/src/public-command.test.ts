import { describe, expect, it } from "vitest";
import { renderPublicResult, runPublicCommand, type PublicCommandRunner } from "./public-command.js";

function runner(outputs: unknown[] = []) {
  const calls: { operation: string; input: Record<string, unknown> }[] = [];
  const host: PublicCommandRunner = { execute: async (request) => {
    const call = request as { operation: string; input: Record<string, unknown> };
    calls.push(call);
    return { status: "succeeded", exitCode: 0, readiness: { status: "ready" }, output: outputs.shift() ?? {} };
  } };
  return { host, calls };
}

describe("public workflow", () => {
  it("resumes an approval by inspection without recovering or applying", async () => {
    const fixture = runner([{ nextAction: { reason: "Explicit recovery required" } }]);
    const result = await runPublicCommand(["resume", "lifecycle_approval_retained"], { runner: fixture.host, cwd: process.cwd() });
    expect(fixture.calls.map(call => call.operation)).toEqual(["cleanup"]);
    expect(result.text).toContain("No changes applied");
    expect(result.text).toContain("Explicit recovery required");
  });

  it("refuses guessed continuation and apply without the reviewed hash", async () => {
    const fixture = runner();
    await expect(runPublicCommand(["resume", "latest"], { runner: fixture.host, cwd: process.cwd() })).rejects.toThrow("actual retained");
    await expect(runPublicCommand(["accept", "--apply", "semantic_change_a"], { runner: fixture.host, cwd: process.cwd() })).rejects.toThrow("--hash");
    expect(fixture.calls).toHaveLength(0);
  });

  it("applies only the exact hash and approval returned by the authority service", async () => {
    const fixture = runner([{ selector: "lifecycle_approval_exact" }, { outcome: "success" }]);
    await runPublicCommand(["accept", "--apply", "semantic_change_a", "--hash", "sha256:v1:reviewed"], { runner: fixture.host, cwd: process.cwd() });
    expect(fixture.calls).toEqual([
      expect.objectContaining({ operation: "change.approve", input: { changeSelector: "semantic_change_a", planHash: "sha256:v1:reviewed" } }),
      expect.objectContaining({ operation: "change.apply", input: { approvalSelector: "lifecycle_approval_exact" } }),
    ]);
  });

  it("preserves model failure even when the transport succeeds", async () => {
    const fixture = runner([{ selector: "lifecycle_approval_exact" }, { outcome: "partial", reasons: ["interrupted write requires recovery"] }]);
    const result = await runPublicCommand(["accept", "--apply", "semantic_change_a", "--hash", "sha256:v1:reviewed"], { runner: fixture.host, cwd: process.cwd() });
    expect(result.exitCode).toBe(6);
    expect(result.text).toContain("interrupted write requires recovery");
  });

  it("keeps a failed currentness check explicit", async () => {
    const host: PublicCommandRunner = { execute: async () => ({ status: "failed", exitCode: 6, readiness: { status: "ready" }, error: { message: "evidence unavailable" } }) };
    await expect(runPublicCommand(["check", "knowledge_context_a"], { runner: host, cwd: process.cwd() })).rejects.toThrow("evidence unavailable");
  });

  it("renders complete meaning and unknowns once without provenance envelopes", () => {
    const text = renderPublicResult("context", { id: "knowledge_context_a", request: "route preview", meaning: { sections: [
      { heading: "Authorship", text: "System preview MUST NOT become player evidence, including after restart." },
    ], disclosure: { omitted: 1 } }, branches: [], unknowns: ["A consumer has no observed producer."], safety: { unknownObligations: 1 } });
    expect(text).toContain("MUST NOT become player evidence, including after restart.");
    expect(text).toContain("1 meaning sections omitted");
    expect(text).toContain("no observed producer");
    expect(text).not.toContain("semanticHash");
  });

  it("makes scope-only, evidence, and typed-relation revisions visible before apply", () => {
    const text = renderPublicResult("accept-preview", {
      selector: "semantic_change_scope", immutablePlanHash: "sha256:v1:reviewed",
      preview: {
        proposal: { canonicalMutations: [] },
        intentReview: {
          subjects: [],
          canonicalMutations: [{
            id: "requirement:ownership", kind: "requirement", operation: "revise", rationale: "Narrow the approved boundary.",
            before: { title: "Ownership", statement: "Keep the boundary.", scope: { op: "atom", field: "path", matcher: "glob", value: "src/**" }, evidence: [{ evidenceId: "evidence:old", stance: "supports" }] },
            after: { title: "Ownership", statement: "Keep the boundary.", scope: { op: "atom", field: "path", matcher: "glob", value: "src/core/**" }, evidence: [{ evidenceId: "evidence:new", stance: "supports" }], fromId: "concept:owner", type: "constrains", toId: "requirement:ownership" },
          }],
          relations: [{ fromId: "concept:owner", type: "constrains", toId: "requirement:ownership" }],
        },
      },
    });
    expect(text).toContain("Scope:\n- path glob src/**\n+ path glob src/core/**");
    expect(text).toContain("Evidence bindings:\n- evidence:old (supports)\n+ evidence:new (supports)");
    expect(text).toContain("Typed relation:\n- none\n+ concept:owner --constrains--> requirement:ownership");
    expect(text).toContain("Related typed relation: concept:owner --constrains--> requirement:ownership");
  });
});
