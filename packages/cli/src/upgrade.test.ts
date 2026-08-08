import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { hashFramedDomain, type CompletionContract, type ExecutionPlan, type StateBinding } from "@projector/core";
import { createExecutionPlan } from "@projector/engine";
import type { PacketExecutionPorts } from "@projector/runtime";
import { describe, expect, it, vi } from "vitest";

import { composeUpgradePlan, executeCompiledUpgrade } from "./upgrade.js";
import { executeProjector } from "./cli.js";

const executeFile = promisify(execFile);

const state = { gitBase: "base", worktreeDigest: hashFramedDomain("test", "worktree"), canonicalProjectorDigest: hashFramedDomain("test", "canonical"), toolchainDigest: hashFramedDomain("test", "toolchain") };
const binding: StateBinding = { compiledAgainst: state, valueDependencies: [], queryDependencies: [], dependencyDigest: hashFramedDomain("state-binding-dependencies", { valueDependencies: [], queryDependencies: [] }) };
const completion: CompletionContract = { requiredUnitStates: [], requiredValidators: [], requiredEvidenceLanes: [], minimumValidationAssurance: "supporting", requireIndependentValidation: false, maximumNewDivergences: 0, maximumUnknowns: 0, allowUnavailableExternalActions: false, requiredArtifacts: [], cleanWorkingTree: true };
const immutablePlan = (): Readonly<ExecutionPlan> => createExecutionPlan({ id: "plan:upgrade", revision: 1, semanticChangeId: "change:upgrade", sourceRunId: "run:upgrade", boundState: binding, boundary: [], assumptions: [], knownAffectedUnitIds: [], possibleFrontierUnitIds: [], unavailableSurfaceIds: [], packetIds: [], checkpoints: [], completionCriteria: completion });

describe("upgrade CLI composition", () => {
  it("returns the exact deeply immutable Task16 plan and rejects mutable or rebound compiler output", async () => {
    const compile = vi.fn().mockResolvedValue({ plan: immutablePlan(), packets: [], executionOrder: [], packetHash: hashFramedDomain("test", "packets") });
    const result = await composeUpgradePlan({ recommendationId: "upgrade:one", semanticChangeId: "change:upgrade", revision: 1, sourceRunId: "run:upgrade" }, { compile });
    expect(result).toMatchObject({ selector: "upgrade:plan:upgrade", packetCount: 0, plan: { semanticChangeId: "change:upgrade" } });
    expect(Object.isFrozen(result.plan.boundState)).toBe(true);
    const mutable = structuredClone(immutablePlan());
    await expect(composeUpgradePlan({ recommendationId: "upgrade:one", semanticChangeId: "change:upgrade", revision: 1, sourceRunId: "run:upgrade" }, { compile: async () => ({ plan: mutable, packets: [], executionOrder: [], packetHash: hashFramedDomain("test", "mutable") }) })).rejects.toThrow(/mutable/iu);
    await expect(composeUpgradePlan({ recommendationId: "upgrade:one", semanticChangeId: "change:other", revision: 1, sourceRunId: "run:upgrade" }, { compile })).rejects.toThrow(/outside|revision/iu);
  });

  it("exposes the default modernization workflow through the built CLI dispatcher", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-upgrade-cli-"));
    try {
      await executeFile("git", ["init", "--quiet"], { cwd: root });
      const result = await executeProjector(["upgrade"], { cwd: root });
      expect(result).toMatchObject({ exitCode: 0, report: { kind: "upgrade-candidate", pipeline: "modernization-task16", applied: false, persisted: true, selector: expect.stringMatching(/^upgrade:execution_plan_/u) } });
      const run = vi.fn(); const dryRun = await executeProjector(["upgrade", "--dry-run"], { cwd: root, upgrade: { run } });
      expect(dryRun.report).toMatchObject({ dryRun: true, persisted: false }); expect(run).not.toHaveBeenCalled();
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("executes the public immutable upgrade envelope through Task16 certificate/recovery composition", async () => {
    const plan = immutablePlan(); const compiled = { plan, packets: [], executionOrder: [], packetHash: hashFramedDomain("test", "packets") };
    const approval = { planHash: hashFramedDomain("semantic-change-execution-plan", plan), approvedRiskClass: "R0" as const, authorityProofHash: hashFramedDomain("test", "authority") };
    const unused = async (): Promise<never> => { throw new Error("unused for an empty approved plan"); };
    const ports = { lease: { acquire: async () => ({ assertOwned: async () => {}, release: async () => {} }) }, authority: { verify: unused }, currentness: { validate: unused }, transaction: { begin: unused }, effect: { run: unused }, observe: { capture: unused }, validate: { run: unused }, validatorTrust: { verify: unused }, reconciliation: { run: async ({ plan: current, observedImpact, finalState }) => { const value = { planId: current.id, observedImpact, finalState, converged: true, iterations: 0 }; return { converged: true, iterations: 0, contentHash: hashFramedDomain("authenticated-plan-reconciliation", value) }; } }, artifacts: { put: async (artifact) => ({ contentHash: hashFramedDomain("packet-execution-artifact", artifact), replayed: false }) } } satisfies PacketExecutionPorts;
    await expect(executeCompiledUpgrade(compiled, approval, ports)).rejects.toThrow(/CompletionContract/iu);
  });
});
