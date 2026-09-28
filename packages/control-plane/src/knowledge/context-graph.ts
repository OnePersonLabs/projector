import type { KnowledgeDecisionRun } from "./governance.js";
import type { KnowledgeGraph } from "./graph.js";

/** The existing context compiler consumes this graph port. Explicit repository
 * coverage and architecture consumers retain their complete graph contract. */
export type KnowledgeContextGraph = Pick<KnowledgeGraph,
  "search" | "resolveNamedTargets" | "bindIdentity" | "discovery" | "load"
  | "valueDependency" | "valueDependencies" | "sourceHash" | "semanticHash" | "currentVersionHash"
  | "authorityUnknowns" | "topologyUnknowns" | "realizationUnknowns"
  | "lensObligations" | "validatorRequests" | "relevantDecisions" | "bindDecisionApplicability"
  | "bindDecisionTriggers" | "governanceEvaluations" | "registry" | "lensCompilationUnknown"
> & { readonly decisionRun: Pick<KnowledgeDecisionRun, "observe">; readonly semanticSummary?: (unitIds: readonly string[]) => import("@projector/core").CodeContextSummary | undefined };
