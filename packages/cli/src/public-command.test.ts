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

  it("restores context and reconciliation from one cleanup observation", async () => {
    const meaning = { status: "rebound", governance: { status: "conformant" } };
    const context = { id: "knowledge_context_retained", meaning: { sections: [{ text: "Keep replay distinct from original input." }] } };
    const fixture = runner([{ continuation: { restoration: { meaning, context } } }]);
    const result = await runPublicCommand(["resume", context.id], { runner: fixture.host, cwd: process.cwd() });
    expect(fixture.calls.map(({ operation }) => operation)).toEqual(["cleanup"]);
    expect(result.output).toMatchObject({ meaning, context });
  });

  it("preserves unavailable saved context without attempting an independent read", async () => {
    const continuation = { context: { contextId: "knowledge_context_missing", status: "unknown" }, nextAction: { operation: "context" } };
    const fixture = runner([{ continuation }]);
    const result = await runPublicCommand(["resume", "knowledge_context_missing"], { runner: fixture.host, cwd: process.cwd() });
    expect(fixture.calls.map(({ operation }) => operation)).toEqual(["cleanup"]);
    expect(result.output).toEqual({ continuation: { continuation } });
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

  it("applies an explicit observation timeout to each lifecycle operation without changing exact approval", async () => {
    const fixture = runner([{ selector: "lifecycle_approval_exact" }, { outcome: "success" }]);
    await runPublicCommand(["accept", "--apply", "semantic_change_a", "--hash", "sha256:v1:reviewed", "--timeout-ms", "120000"], { runner: fixture.host, cwd: process.cwd() });
    expect(fixture.calls).toEqual([
      expect.objectContaining({ operation: "change.approve", input: { changeSelector: "semantic_change_a", planHash: "sha256:v1:reviewed" }, observationLimits: { timeoutMs: 120000 } }),
      expect.objectContaining({ operation: "change.apply", input: { approvalSelector: "lifecycle_approval_exact" }, observationLimits: { timeoutMs: 120000 } }),
    ]);
  });

  it("rejects unbounded, nonpositive, fractional and duplicate timeout options before dispatch", async () => {
    const fixture = runner();
    for (const value of ["0", "-1", "Infinity", "NaN", "1.5", "9007199254740992"]) {
      await expect(runPublicCommand(["audit", "--timeout-ms", value], { runner: fixture.host, cwd: process.cwd() })).rejects.toThrow("positive safe integer");
    }
    await expect(runPublicCommand(["audit", "--timeout-ms", "1000", "--timeout-ms", "2000"], { runner: fixture.host, cwd: process.cwd() })).rejects.toThrow("Duplicate option");
    expect(fixture.calls).toHaveLength(0);
  });

  it("identifies the source and accounting detail of an observation failure", async () => {
    const host: PublicCommandRunner = { execute: async () => ({
      status: "failed", exitCode: 6, readiness: { status: "ready" },
      error: { message: "Derived observation exceeded its allowance", observation: {
        stage: "javascript-normalization", scope: "src/generated.js", limit: "maxDerivedBytes", observed: 67108890,
      } },
    }) };
    await expect(runPublicCommand(["context", "Inspect meaning"], { runner: host, cwd: process.cwd() }))
      .rejects.toThrow("javascript-normalization at src/generated.js; maxDerivedBytes observed 67108890");
  });

  it("routes audit through one read-only cleanup call and passes exact JSON output", async () => {
    const output = { proofStatement: "bounded", completion: { readOnly: true, questions: [] } };
    const fixture = runner([output]);
    const result = await runPublicCommand(["audit", "--scope", "src\\feature\\..\\payments", "--context", "knowledge_context_a", "--question-offset", "20", "--json"], { runner: fixture.host, cwd: process.cwd() });
    expect(fixture.calls).toEqual([expect.objectContaining({ operation: "cleanup", input: { scope: "src/payments", questionOffset: 20, contextId: "knowledge_context_a" } })]);
    expect(result.output).toBe(output);
    expect(result.text).toBe(`${JSON.stringify(output, null, 2)}\n`);
  });

  it("uses the repository root and first question page by default", async () => {
    const fixture = runner([{ proofStatement: "bounded", bindingValidation: { status: "current" }, completion: { questionDisclosure: { total: 0, omitted: 0 }, questionPage: { nextOffset: null }, questions: [], limits: [] } }]);
    const result = await runPublicCommand(["audit"], { runner: fixture.host, cwd: process.cwd() });
    expect(fixture.calls).toHaveLength(1);
    expect(fixture.calls[0]).toMatchObject({ operation: "cleanup", input: { scope: ".", questionOffset: 0 } });
    expect(result.text).toContain("Read-only audit");
  });

  it("rejects unsupported audit options, duplicates, invalid pages, and escaping scopes before dispatch", async () => {
    const fixture = runner();
    await expect(runPublicCommand(["audit", "--entity", "requirement:a"], { runner: fixture.host, cwd: process.cwd() })).rejects.toThrow("does not apply");
    await expect(runPublicCommand(["audit", "--not-an-option"], { runner: fixture.host, cwd: process.cwd() })).rejects.toThrow("Unknown option");
    await expect(runPublicCommand(["audit", "--scope", "src", "--scope", "test"], { runner: fixture.host, cwd: process.cwd() })).rejects.toThrow("Duplicate option --scope");
    await expect(runPublicCommand(["audit", "--context", "one", "--context", "two"], { runner: fixture.host, cwd: process.cwd() })).rejects.toThrow("Duplicate option --context");
    await expect(runPublicCommand(["audit", "--question-offset", "-1"], { runner: fixture.host, cwd: process.cwd() })).rejects.toThrow("nonnegative safe integer");
    await expect(runPublicCommand(["audit", "--question-offset", "later"], { runner: fixture.host, cwd: process.cwd() })).rejects.toThrow("nonnegative safe integer");
    await expect(runPublicCommand(["audit", "--scope", "../outside"], { runner: fixture.host, cwd: process.cwd() })).rejects.toThrow("must stay within the selected repository root");
    expect(fixture.calls).toHaveLength(0);
  });

  it("renders evidence status, question assessment, repair alternatives, and limits without a completeness score", () => {
    const text = renderPublicResult("audit", {
      proofStatement: "bounded", bindingValidation: { status: "current" }, applicationEvidence: { status: "unknown" },
      lanes: [{ key: "validation-evidence", observability: "unavailable", numerator: 0, denominator: 2, blindSpots: ["Runtime behavior was not observed."] }],
      localAnalysis: { artifactCount: 8, projectionUnitCount: 3, realizations: { matched: 2, unmatched: 1, unsupported: 0, unavailable: 1 } },
      unavailableSurfaceIds: ["surface:external-api"], completion: {
        limits: ["External effects require application evidence."], questionDisclosure: { total: 1, omitted: 0 }, questionPage: { nextOffset: null },
        questions: [{ kind: "unrealized-requirement", blocking: true, question: "Is retry behavior implemented?", assessment: { status: "unknown", category: "unrealized-behavior" }, ownerIds: ["requirement:retry"], reasons: ["No observed realization."], resolution: { route: "implementation-repair", instruction: "Inspect the handler.", alternatives: [{ strategy: "agent-repair", status: "available", reason: "A local agent can repair it.", capabilityIds: ["capability:edit"] }, { strategy: "human-decision", status: "unavailable", reason: "No decision needed.", capabilityIds: [] }] } }],
        repairPlan: [],
      },
    });
    expect(text).toContain("Evidence: bounded; binding current.");
    expect(text).toContain("Blocking unrealized-requirement (unknown: unrealized-behavior)");
    expect(text).toContain("Repair route: implementation-repair");
    expect(text).toContain("Repair option: agent-repair (available)");
    expect(text).toContain("Repair option: human-decision (unavailable)");
    expect(text).toContain("Unsupported or unavailable surface: surface:external-api");
    expect(text).toContain("Operational observation artifacts may be created");
    expect(text).not.toMatch(/completeness\s*[:=]?\s*\d+%/iu);
  });

  it("keeps stale retained reasoning visible beside a current audit binding", () => {
    const text = renderPublicResult("audit", {
      bindingValidation: { status: "current" },
      continuation: {
        context: { contextId: "knowledge_context_old", status: "stale", governance: "violated" },
        lifecycle: { changeSelector: "change:old", status: "recovery-required", planFreshness: "stale", approvalSelector: "approval:old" },
        reason: "Refresh affected reasoning before reuse.",
        evidence: [{ id: "consumer-membership", status: "stale", availability: "present", reason: "A new consumer joined the dependency closure." }],
        page: { omitted: 3, nextOffset: 50 },
        advisoryNotes: { status: "unobservable", reason: "No advisory artifact was selected." },
        limits: ["Resume cannot apply recovery."],
        nextAction: { operation: "context", input: { request: "Refresh changed consumers" } },
      },
    });
    expect(text).toContain("binding current");
    expect(text).toContain("Retained context knowledge_context_old: stale; governance violated");
    expect(text).toContain("Retained change change:old: recovery-required; plan stale; approval approval:old");
    expect(text).toContain("Refresh affected reasoning before reuse");
    expect(text).toContain("A new consumer joined the dependency closure");
    expect(text).toContain("3 omitted; next offset 50");
    expect(text).toContain("No advisory artifact was selected");
    expect(text).toContain("Resume cannot apply recovery");
    expect(text).toContain('Next supported operation: context; input {"request":"Refresh changed consumers"}');
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
