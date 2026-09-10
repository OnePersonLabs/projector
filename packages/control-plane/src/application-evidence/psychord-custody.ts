import { canonicalDocumentEnvelopeSchemaForKind, type ContentHash } from "@projector/core";
import { CanonicalFileRepository } from "@projector/runtime";

import type {
  PsychordApplicationEvidenceAssessmentService,
  PsychordEvidenceCurrentnessPort,
  PsychordRequirementCustodyPort,
  PsychordRequirementEnvelope,
} from "./psychord-assessment.js";
import { createPsychordApplicationEvidenceAssessmentService } from "./psychord-assessment.js";
import type { PsychordObservationArtifactService } from "@projector/integrations/runtime-evidence";

export type RetainedPsychordCanonicalAccess = {
  readonly repositoryRoot: string;
  readonly canonicalProjectorDigest: ContentHash;
  readonly signal: AbortSignal;
};

export function createCanonicalPsychordRequirementCustody(
  retained: RetainedPsychordCanonicalAccess,
): PsychordRequirementCustodyPort {
  const repository = new CanonicalFileRepository(retained.repositoryRoot);
  return {
    async readCurrent(requirement, environment) {
      const signal = AbortSignal.any([retained.signal, environment.signal]);
      signal.throwIfAborted();
      const snapshot = await abortable(repository.snapshot(), signal);
      signal.throwIfAborted();
      if (snapshot.rootDigest !== retained.canonicalProjectorDigest) {
        throw new Error("Current canonical snapshot differs from the retained shared-access state");
      }
      const matches = snapshot.documents.filter(({ kind, id }) => kind === "requirement" && id === requirement.id);
      if (matches.length !== 1) throw new Error("Current canonical requirement is absent or ambiguous");
      const current = canonicalDocumentEnvelopeSchemaForKind("requirement").parse(matches[0]) as PsychordRequirementEnvelope;
      if (current.canonicalDocumentHash !== requirement.canonicalDocumentHash) {
        throw new Error("Current canonical requirement differs from the state-bound requirement document");
      }
      return current;
    },
  };
}

export function createRetainedPsychordApplicationEvidenceAssessmentService(input: {
  readonly retained: RetainedPsychordCanonicalAccess;
  readonly artifacts: PsychordObservationArtifactService;
  readonly currentness: PsychordEvidenceCurrentnessPort;
}): PsychordApplicationEvidenceAssessmentService {
  return createPsychordApplicationEvidenceAssessmentService({
    artifacts: input.artifacts,
    currentness: input.currentness,
    requirements: createCanonicalPsychordRequirementCustody(input.retained),
  });
}

async function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) signal.throwIfAborted();
  return await new Promise<T>((resolvePromise, rejectPromise) => {
    const abort = () => rejectPromise(signal.reason ?? new Error("Canonical requirement custody was cancelled"));
    signal.addEventListener("abort", abort, { once: true });
    work.then(resolvePromise, rejectPromise).finally(() => signal.removeEventListener("abort", abort)).catch(() => undefined);
  });
}
