import { executionPlanHash, type CompiledSemanticChangePlan } from "@projector/engine";

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
