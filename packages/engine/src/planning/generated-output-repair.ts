import type { RepairCapabilities } from "@projector/core";

export type GeneratedOutputRepairIntent = "upstream-regeneration" | "direct-generated-patch" | "temporary-generated-overlay";
export interface GeneratedOutputRepairRequest {
  readonly capabilities: RepairCapabilities;
  readonly intent: GeneratedOutputRepairIntent;
  readonly temporaryOverlay?: { readonly migrationId: string; readonly debtId: string; readonly exitCriteria: readonly string[] };
}
export interface GeneratedOutputRepairPlan {
  readonly strategy: "upstream-regeneration" | "temporary-overlay";
  readonly operations: readonly ("change-upstream" | "regenerate" | "validate" | "apply-overlay")[];
  readonly migrationId?: string; readonly debtId?: string; readonly exitCriteria?: readonly string[];
}
export function planGeneratedOutputRepair(request: GeneratedOutputRepairRequest): GeneratedOutputRepairPlan {
  if (request.intent === "direct-generated-patch") throw new Error("direct generated-output repair is forbidden; repair the upstream source or use an explicit temporary overlay");
  if (request.intent === "upstream-regeneration") {
    if (!request.capabilities.generator || !request.capabilities.upstreamSourceKnown || !request.capabilities.validatorCanProveValidity) throw new Error("upstream regeneration requires a known source, generator, and proving validator");
    return Object.freeze({ strategy: "upstream-regeneration", operations: Object.freeze(["change-upstream", "regenerate", "validate"] as const) });
  }
  const overlay = request.temporaryOverlay;
  if (overlay === undefined || overlay.migrationId.trim() === "" || overlay.debtId.trim() === "" || overlay.exitCriteria.length === 0 || overlay.exitCriteria.some((criterion) => criterion.trim() === "")) throw new Error("temporary generated-output overlay requires explicit migration, accepted debt, and exit criteria");
  return Object.freeze({ strategy: "temporary-overlay", operations: Object.freeze(["apply-overlay", "validate"] as const), migrationId: overlay.migrationId, debtId: overlay.debtId, exitCriteria: Object.freeze([...overlay.exitCriteria]) });
}
