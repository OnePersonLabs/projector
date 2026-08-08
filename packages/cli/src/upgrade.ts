import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, hashFramedDomain, type ContentHash } from "@projector/core";
import { createExecutionPlan, createStateBinding, executionPlanHash, type CompiledSemanticChangePlan } from "@projector/engine";
import { executePacketPlan, type AuthenticatedPacketExecution, type PacketExecutionPorts, type PacketExecutionResult } from "@projector/runtime";

export interface UpgradeCliRequest {
  readonly recommendationId: string;
  readonly semanticChangeId: string;
  readonly revision: number;
  readonly sourceRunId: string;
}

export interface UpgradeCliCompilerPort {
  compile(request: UpgradeCliRequest): Promise<CompiledSemanticChangePlan>;
}

export interface UpgradeCliResult {
  readonly selector: string;
  readonly recommendationId: string;
  readonly semanticChangeId: string;
  readonly immutablePlanHash: string;
  readonly plan: CompiledSemanticChangePlan["plan"];
  readonly packetCount: number;
}

const safeIdentity = /^[a-z0-9][a-z0-9._:-]*$/iu;

function assertDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (!Object.isFrozen(value)) throw new Error("upgrade compiler returned a mutable Task16 plan");
  for (const child of Object.values(value)) assertDeeplyFrozen(child);
}

/** Thin CLI composition: authority and migration semantics remain in the modernization/Task16 compiler. */
export async function composeUpgradePlan(request: UpgradeCliRequest, compiler: UpgradeCliCompilerPort): Promise<Readonly<UpgradeCliResult>> {
  if (!safeIdentity.test(request.recommendationId) || !safeIdentity.test(request.semanticChangeId) || !safeIdentity.test(request.sourceRunId)) throw new Error("upgrade selectors must be safe stable identities");
  if (!Number.isSafeInteger(request.revision) || request.revision < 1) throw new Error("upgrade plan revision must be a positive integer");
  const compiled = await compiler.compile(structuredClone(request));
  if (compiled.plan.semanticChangeId !== request.semanticChangeId || compiled.plan.revision !== request.revision || compiled.plan.sourceRunId !== request.sourceRunId) throw new Error("upgrade compiler returned a plan outside the requested semantic change revision");
  assertDeeplyFrozen(compiled.plan);
  return Object.freeze({ selector: `upgrade:${compiled.plan.id}`, recommendationId: request.recommendationId, semanticChangeId: request.semanticChangeId, immutablePlanHash: executionPlanHash(compiled.plan), plan: compiled.plan, packetCount: compiled.packets.length });
}

export async function executeCompiledUpgrade(compiled: CompiledSemanticChangePlan, approval: AuthenticatedPacketExecution["value"]["approval"], ports: PacketExecutionPorts): Promise<PacketExecutionResult> {
  const value = { plan: compiled.plan, packets: compiled.packets, executionOrder: compiled.executionOrder.map(({ packet }) => packet.id), approval };
  return executePacketPlan({ value, contentHash: hashFramedDomain("authenticated-packet-execution", value) }, ports);
}

export async function runDefaultUpgradeWorkflow(repositoryRoot: string): Promise<Record<string, unknown>> {
  const compiledAgainst = { gitBase: "working-tree", worktreeDigest: hashFramedDomain("upgrade-default-state", repositoryRoot, "worktree"), canonicalProjectorDigest: hashFramedDomain("upgrade-default-state", repositoryRoot, "canonical"), toolchainDigest: hashFramedDomain("upgrade-default-state", "toolchain") };
  const boundState = createStateBinding({ compiledAgainst, valueDependencies: [], queryDependencies: [] });
  const completionCriteria = { requiredUnitStates: [], requiredValidators: [], requiredEvidenceLanes: [], minimumValidationAssurance: "supporting" as const, requireIndependentValidation: false, maximumNewDivergences: 0, maximumUnknowns: 0, allowUnavailableExternalActions: false, requiredArtifacts: [], cleanWorkingTree: true };
  const plan = createExecutionPlan({ id: `execution_plan_${hashFramedDomain("default-upgrade-plan", repositoryRoot).slice(-32)}`, revision: 1, semanticChangeId: "semantic_change_no_authenticated_upgrade", sourceRunId: "run:default-upgrade", boundState, boundary: [], assumptions: ["no authenticated approved modernization recommendation is currently selected"], knownAffectedUnitIds: [], possibleFrontierUnitIds: [], unavailableSurfaceIds: [], packetIds: [], checkpoints: [], completionCriteria });
  const compiled: CompiledSemanticChangePlan = { plan, packets: Object.freeze([]), executionOrder: Object.freeze([]), packetHash: hashFramedDomain("semantic-change-packet-set", []) };
  const result = await composeUpgradePlan({ recommendationId: "upgrade:none", semanticChangeId: plan.semanticChangeId!, revision: plan.revision, sourceRunId: plan.sourceRunId }, { compile: async () => compiled });
  const root = join(repositoryRoot, ".projector", "task18-upgrades"); await mkdir(root, { recursive: true });
  const body = { kind: "upgrade-candidate", selector: result.selector, immutablePlanHash: result.immutablePlanHash, plan: result.plan, applied: false, reason: "no authenticated approved modernization recommendation is currently selected" };
  const bytes = `${canonicalJson(body)}\n`; const path = join(root, `${result.immutablePlanHash.slice("sha256:v1:".length)}.json`);
  try { await writeFile(path, bytes, { encoding: "utf8", flag: "wx" }); } catch (error) { if (!(error instanceof Error && "code" in error && error.code === "EEXIST") || await readFile(path, "utf8") !== bytes) throw error; }
  return { ...body, pipeline: "modernization-task16", persisted: true };
}

export type UpgradePlanHash = ContentHash;
