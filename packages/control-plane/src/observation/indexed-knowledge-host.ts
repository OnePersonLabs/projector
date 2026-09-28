import type { CanonicalDocumentEnvelope } from "@projector/core";
import { currentObservationScope, withObservationScope } from "@projector/runtime";
import { captureIndependentValidator, observeChangeRepository } from "../change-lifecycle/repository-observer.js";
import { inspectRepositoryContinuation } from "../coverage/continuation.js";
import { readRepositoryImpactSnapshot } from "../impact/service.js";
import { assessKnowledgeApplicationEvidence, type ApplicationEvidencePort } from "../knowledge/application-evidence.js";
import { DecisionBaselineReader } from "../knowledge/decision-baselines.js";
import type { KnowledgeDecisionHost } from "../knowledge/governance.js";
import { KnowledgeValidatorRun, type KnowledgeValidatorHost } from "../knowledge/validators.js";
import { createKnowledgeComputeHostHandler } from "../knowledge/service.js";
import { runObservationTask } from "./task-runner.js";
import type { IndexedRepositoryObservation } from "./indexed-types.js";
import type { KnowledgeHostRequest } from "./knowledge-host.js";
import { observationHostSignal } from "./deadline-signal.js";

/** Host effects keep the same authority checks. Default metadata/application
 * reads and Git-bound validator identities are addressed. Legacy impact keeps
 * its explicit complete-observation compatibility path. */
export function createIndexedKnowledgeComputeHostHandler(
  observation: IndexedRepositoryObservation,
  host: KnowledgeDecisionHost & KnowledgeValidatorHost & { readonly applicationEvidence?: ApplicationEvidencePort } = {},
): (request: KnowledgeHostRequest, signal: AbortSignal) => Promise<unknown> {
  const { descriptor, store } = observation;
  const readDocument = (id: string): CanonicalDocumentEnvelope | undefined => store.getAt<CanonicalDocumentEnvelope>(descriptor.generation, "canonical", id);
  const baselines = new DecisionBaselineReader({ repositoryRoot: descriptor.repositoryRoot, readDocument });
  let validators: KnowledgeValidatorRun | undefined;
  const handle = async (request: KnowledgeHostRequest, signal: AbortSignal): Promise<unknown> => {
    const scope = currentObservationScope()!;
    const hostSignal = observationHostSignal(scope, signal);
    const combined = hostSignal.signal;
    try { return await withObservationScope({ signal: combined }, async () => {
      store.verifyGeneration(descriptor.generation);
      switch (request.type) {
        case "baseline": return baselines.read(request.decision, request.authority);
        case "application-evidence": {
          const documents = [...new Set(request.ownerIds)].sort().map(readDocument).filter((document): document is CanonicalDocumentEnvelope => document !== undefined);
          return assessKnowledgeApplicationEvidence({ observation: { canonical: { documents, readDocument } }, ownerIds: request.ownerIds, signal: combined, ...(host.applicationEvidence === undefined ? {} : { port: host.applicationEvidence }) });
        }
        case "validators": {
          if (request.requests.length === 0) return { findings: [], executed: false };
          validators ??= new KnowledgeValidatorRun({
            repositoryRoot: descriptor.repositoryRoot,
            independentValidator: (path) => captureIndependentValidator(descriptor.repositoryRoot, descriptor.metadata.analysisHeader.git.availability, (address) => store.getAt<import("@projector/analyzers").LocalRepositoryAnalysis["gitIdentities"][number]>(descriptor.generation, "git-identity", address), path),
          }, combined, host);
          return { findings: await validators.evaluateAll(request.requests), executed: validators.executed };
        }
        case "fresh-state": {
          // Validator freshness is an independent observation, not publication
          // of a replacement source generation while this worker holds a lease.
          // A complete capture also preserves the existing no-provider proof.
          return (await observeChangeRepository(descriptor.repositoryRoot)).state;
        }
        case "read-impact": return readRepositoryImpactSnapshot(descriptor.repositoryRoot, request.reference);
        case "coverage-continuation": return inspectRepositoryContinuation(descriptor.repositoryRoot, request.request, {
          signal: combined, ...(host.applicationEvidence === undefined ? {} : { applicationEvidence: host.applicationEvidence }),
          reconcileContext: async (retained) => {
            const now = (host.now ?? (() => new Date().toISOString()))();
            const accepted = host.acceptedDecisionBaselines === undefined ? {} : { acceptedDecisionBaselines: host.acceptedDecisionBaselines };
            if (retained.impactBaseline === undefined) return runObservationTask("indexed-knowledge-reconcile", { descriptor, retained, now, ...accepted }, { ...currentObservationScope()!, onHostRequest: handle });
            const full = await observeChangeRepository(descriptor.repositoryRoot);
            const { independentValidator: _validator, ...data } = full;
            return runObservationTask("knowledge-reconcile", { observation: data, retained, now, ...accepted }, { ...currentObservationScope()!, onHostRequest: createKnowledgeComputeHostHandler(full, host) });
          },
        });
      }
    }); } finally { hostSignal.close(); }
  };
  return handle;
}
