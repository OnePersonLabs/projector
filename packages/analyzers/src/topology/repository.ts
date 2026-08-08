import { hashFramedDomain, type AnalyzerCapabilities, type AnalyzerFailure, type ContentHash } from "@projector/core";

import type { ActionsWorkflowFact } from "../formats/documents.js";
import { compareCodePoint } from "../ordering.js";
import type { JavaScriptFacts } from "../typescript/facts.js";
import { compileAuthenticatedAnalyzerTopology, type AuthenticatedTopologyParticipant, type AuthenticatedTopologySubject, type EventContractTopology, type TopologyAssurance } from "./index.js";

export interface AnalyzerDivergenceFact {
  readonly id: string;
  readonly code: "broken-static-import" | "duplicate-public-export" | "actions-needs-gap" | "generated-source-drift";
  readonly path: string;
  readonly subjectIds: string[];
  readonly explanation: string;
  readonly provenance: { analyzerId: string; evidenceIds: string[] };
  readonly assurance: TopologyAssurance;
  readonly counterevidence: string[];
  readonly coverageCaveat: string;
  readonly contentHash: ContentHash;
}

export function compileRepositoryTopology(javaScript: JavaScriptFacts, capabilities: readonly AnalyzerCapabilities[], failures: readonly AnalyzerFailure[]): EventContractTopology {
  const observations = [...javaScript.events.map((fact) => ({ ...fact, subjectKind: "event" as const })), ...javaScript.contracts.map((fact) => ({ ...fact, subjectKind: "contract" as const, dynamic: false }))];
  const bySubject = new Map<string, typeof observations>();
  for (const observation of observations) bySubject.set(observation.subjectId, [...(bySubject.get(observation.subjectId) ?? []), observation]);
  const uncertainEventReceivers = new Set(javaScript.eventUncertainties.map(({ receiver }) => receiver));
  const subjects: AuthenticatedTopologySubject[] = [...bySubject.values()].map((group) => {
    const producer = group.find(({ role }) => role === "producer") ?? group[0]!;
    const receiver = "receiver" in producer ? producer.receiver : undefined;
    return { subjectId: producer.subjectId, subjectKind: producer.subjectKind, semanticKey: producer.semanticKey, scopeKey: producer.scopeKey, artifactHash: producer.artifactHash, dynamic: group.some(({ dynamic }) => dynamic) || (receiver !== undefined && uncertainEventReceivers.has(receiver)) };
  });
  const participants: AuthenticatedTopologyParticipant[] = observations.map(({ subjectId, participantId, role, evidenceId, artifactHash }) => ({ subjectId, participantId, role, evidenceIds: [evidenceId], artifactHash }));
  return compileAuthenticatedAnalyzerTopology({ subjects, participants, capabilities, failures });
}

function divergence(code: AnalyzerDivergenceFact["code"], path: string, subjectIds: string[], explanation: string, evidenceIds: string[], coverageCaveat: string): AnalyzerDivergenceFact {
  const semantic = { code, path, subjectIds: [...new Set(subjectIds)].sort(compareCodePoint), explanation, provenance: { analyzerId: "projector.mechanical-divergence", evidenceIds: [...new Set(evidenceIds)].sort(compareCodePoint) }, assurance: "exact" as const, counterevidence: [] as string[], coverageCaveat };
  return { id: `analyzer_divergence_${hashFramedDomain("analyzer-divergence-identity", { code, path, subjectIds: semantic.subjectIds }).slice(-32)}`, ...semantic, contentHash: hashFramedDomain("analyzer-divergence", semantic) };
}

export function detectMechanicalDivergences(javaScript: JavaScriptFacts, actions: readonly ActionsWorkflowFact[]): AnalyzerDivergenceFact[] {
  const result: AnalyzerDivergenceFact[] = [];
  for (const failure of javaScript.failures.filter(({ capability }) => capability === "module-resolution")) result.push(divergence("broken-static-import", failure.scope, [], failure.message, [], "Only static relative imports are resolved."));
  const publicExports = new Map<string, Array<{ path: string; id: string }>>();
  for (const file of javaScript.files) for (const declaration of file.declarations.filter(({ exported }) => exported)) {
    const key = `${file.scopeKey}\u0000${declaration.name}`; publicExports.set(key, [...(publicExports.get(key) ?? []), { path: file.path, id: declaration.id }]);
  }
  for (const candidates of publicExports.values()) {
    const duplicates = [...new Map(candidates.map((candidate) => [candidate.path, candidate])).values()];
    if (duplicates.length > 1) result.push(divergence("duplicate-public-export", duplicates.map(({ path }) => path).sort(compareCodePoint)[0]!, duplicates.map(({ id }) => id), "The same package scope exposes multiple declarations with one public name.", duplicates.map(({ id }) => id), "Declaration merging remains outside exact duplicate classification."));
  }
  for (const workflow of actions) {
    const jobIds = new Set(workflow.jobs.map(({ id }) => id));
    for (const job of workflow.jobs) for (const missing of job.needs.filter((need) => !jobIds.has(need))) result.push(divergence("actions-needs-gap", workflow.path, [`actions-job:${job.id}`, `actions-job:${missing}`], `Job ${job.id} needs missing job ${missing}.`, [`${workflow.path}:${job.line}`], "Only literal needs entries in this workflow are checked."));
  }
  return result.sort((a, b) => compareCodePoint(a.code, b.code) || compareCodePoint(a.path, b.path) || compareCodePoint(a.id, b.id));
}
