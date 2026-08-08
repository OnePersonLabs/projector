import { hashFramedDomain, type ExecutionCapsule, type StateBinding, type StateDigest } from "@projector/core";
import { describe, expect, it, vi } from "vitest";

import { createCodexHostAdapter } from "./adapter.js";
import { createClaudeHostAdapter } from "../claude/adapter.js";

const state: StateDigest = { gitBase: "base", worktreeDigest: hashFramedDomain("host", "w"), canonicalProjectorDigest: hashFramedDomain("host", "c"), toolchainDigest: hashFramedDomain("host", "t") };
const binding: StateBinding = { compiledAgainst: state, valueDependencies: [], queryDependencies: [], dependencyDigest: hashFramedDomain("host", "binding") };
const capsule = { id: "capsule", taskId: "packet", objective: "edit", operation: "replace", unitIds: ["unit:a"], boundState: binding, relevanceClosureId: "closure", analysisFacetKeys: [], requirementIds: [], scenarioIds: [], conceptSummary: "x", decisionIds: [], decisionSummary: "x", unresolvedArchitectureConcerns: [], lensSummary: "x", effectiveRules: [], normativeKernelHash: hashFramedDomain("host", "kernel"), relevantPrecedents: [], allowedWrites: [], forbiddenWrites: [], availablePrimitives: [], requiredValidations: [], upstreamImplications: [], downstreamImplications: [], knownExceptions: [], unknowns: [], risk: { class: "R1", inherentOperationRisk: 1, affectedUnitCount: 1, affectedSurfaceCount: 0, publicContractImpact: false, externalImpact: false, dataImpact: false, reversibility: "full", validationStrength: "strong", closureConfidence: "bounded", unresolvedIdentityCount: 0, relevanceFrontierCount: 0, openWorldDependencies: false, unresolvedBlockingConcernCount: 0, suspectDecisionCount: 0, compensationAvailable: true, reasons: [] }, completionContract: { requiredUnitStates: [], requiredValidators: [], requiredEvidenceLanes: [], minimumValidationAssurance: "strong", requireIndependentValidation: false, maximumNewDivergences: 0, maximumUnknowns: 0, allowUnavailableExternalActions: false, requiredArtifacts: [], cleanWorkingTree: false }, contextDependencyHash: hashFramedDomain("host", "deps"), contextHash: hashFramedDomain("host", "context") } satisfies ExecutionCapsule;

describe("truthful Codex/Claude host adapters", () => {
  it("derives capabilities from executable probes and degrades missing hosts to manual continuation", async () => {
    const missing = createCodexHostAdapter({ probe: { executable: async () => false, feature: async () => false } });
    expect(await missing.capabilities()).toMatchObject({ level: 1, executable: false, programmaticExecution: false, enforcement: "instruction-only" });
    const codex = createCodexHostAdapter({ probe: { executable: async () => true, feature: async (name) => ["structured-result", "tool-observation", "cancellation"].includes(name) } });
    expect(await codex.capabilities()).toMatchObject({ executable: true, structuredResult: true, toolObservation: true, cancellation: true, programmaticExecution: false, level: 2, enforcement: "observed" });
    const claude = createClaudeHostAdapter({ probe: { executable: async () => true, feature: async () => false } });
    expect((await claude.capabilities()).host).toBe("claude");
  });

  it("journals/snapshots before launch and reconciles final diff after crash or cancellation", async () => {
    const events: string[] = []; const launcher = vi.fn(async () => { events.push("launch"); throw new Error("host crashed"); });
    const adapter = createCodexHostAdapter({ probe: { executable: async () => true, feature: async () => true } });
    const ports = { bindingValidator: { validate: async () => ({ status: "current" as const, currentState: state, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [] }) }, authority: { verify: async () => true }, journal: { prepare: async () => { events.push("journal"); return { id: "journal:1", contentHash: hashFramedDomain("host-journal", "1") }; }, finish: async ({ status }: { status: string }) => { events.push(`finish:${status}`); } }, observe: { capture: async ({ phase }: { phase: string }) => { events.push(`observe:${phase}`); return { state, paths: phase === "before" ? [] : ["src/a.ts"], contentHash: hashFramedDomain("host-observation", phase) }; } }, launcher: { launch: launcher }, reconcile: { run: async () => { events.push("reconcile"); return { status: "recovered" as const, changedPaths: ["src/a.ts"] }; } } };
    const result = await adapter.run({ sessionId: "session", repositoryRoot: "/repo", argv: ["--fake"], environment: { SAFE: "1", SECRET: "drop" }, allowedEnvironmentKeys: ["SAFE"], capsule, binding, currentState: state, instructions: { text: "bounded", sourceHashes: [capsule.normativeKernelHash], representationId: "profile:full" }, signal: new AbortController().signal }, ports);
    expect(result).toMatchObject({ status: "recovered", changedPaths: ["src/a.ts"] });
    expect(events.slice(0, 3)).toEqual(["journal", "observe:before", "launch"]); expect(events).toContain("observe:after"); expect(events).toContain("reconcile");
    expect((launcher.mock.calls as unknown as readonly [readonly [{ executable: string; args: readonly string[]; env: Readonly<Record<string, string>> }]])[0]![0]).toMatchObject({ executable: "codex", args: ["--fake"], env: { SAFE: "1" } });
  });

  it("accepts a dependency-local rebound only through the authenticated binding validator", async () => {
    const currentState = { ...state, worktreeDigest: hashFramedDomain("host", "unrelated-root-change") };
    const adapter = createCodexHostAdapter({ probe: { executable: async () => true, feature: async () => true } });
    const rebound = { ...binding, compiledAgainst: currentState };
    const ports = { bindingValidator: { validate: async () => ({ status: "rebound" as const, currentState, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [], rebound }) }, authority: { verify: async ({ binding: verified }: { binding: StateBinding }) => verified === rebound }, journal: { prepare: async () => ({ id: "j", contentHash: hashFramedDomain("j", "1") }), finish: async () => undefined }, observe: { capture: async () => ({ state: currentState, paths: [], contentHash: hashFramedDomain("o", "1") }) }, launcher: { launch: async () => ({ exitCode: 0 }) }, reconcile: { run: async () => ({ status: "completed" as const, changedPaths: [] }) } };
    await expect(adapter.run({ sessionId: "s", repositoryRoot: "/repo", argv: [], environment: {}, allowedEnvironmentKeys: [], capsule, binding, currentState, instructions: { text: "x", sourceHashes: [capsule.normativeKernelHash], representationId: "p" }, signal: new AbortController().signal }, ports)).resolves.toMatchObject({ status: "completed" });
  });
});
