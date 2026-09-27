import { z } from "zod";
import type { RepairStrategy } from "../domain/contracts.js";

export const CompletionAssessmentSchema = z.object({
  status: z.enum(["violated", "unknown", "unavailable"]),
  category: z.enum(["authority-problem", "rule-violation", "conflicting-rules", "unreachable-selector", "missing-validator", "unrealized-behavior", "missing-evidence", "meaning-gap"]),
}).strict();
export type CompletionAssessment = z.infer<typeof CompletionAssessmentSchema>;

export const CompletionRepairRouteSchema = z.enum(["canonical-proposal", "implementation-repair", "missing-evidence"]);
export type CompletionRepairRoute = z.infer<typeof CompletionRepairRouteSchema>;
export const CompletionRepairAlternativeSchema = z.object({
  strategy: z.enum(["reuse", "revalidate", "regenerate", "deterministic-patch", "agent-repair", "widen-analysis", "human-decision"]),
  status: z.enum(["available", "unavailable", "skipped"]),
  reason: z.string().min(1), capabilityIds: z.array(z.string()),
}).strict();
export type CompletionRepairAlternative = Omit<z.infer<typeof CompletionRepairAlternativeSchema>, "strategy"> & { strategy: RepairStrategy };
