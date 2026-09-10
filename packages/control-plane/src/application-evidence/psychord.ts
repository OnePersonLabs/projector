import {
  createPsychordAgentBrowserHost,
  createPsychordApplicationObserver,
  createPsychordObservationArtifactService,
  createStrictPsychordApplicationObserver,
  validatePsychordObservationArtifactManifest,
  type PsychordAgentBrowserHostDependencies,
  type PsychordArtifactSetStorePort,
  type PsychordObservationArtifactManifest,
  type PsychordObservationArtifactService,
  type StrictPsychordApplicationObserver,
} from "@projector/integrations/runtime-evidence";
import { ArtifactSetIncompleteError, DurableArtifactSetStore } from "@projector/runtime";

export function createDurablePsychordObservationArtifactService(input: {
  readonly storageRoot: string;
  readonly observer: StrictPsychordApplicationObserver;
}): PsychordObservationArtifactService {
  const durable = new DurableArtifactSetStore<PsychordObservationArtifactManifest>(
    input.storageRoot,
    validatePsychordObservationArtifactManifest,
  );
  const artifactStore: PsychordArtifactSetStorePort = {
    storageRoot: durable.storageRoot,
    async begin(request) { await durable.begin(request); },
    async stageBlob(request) { await durable.stageBlob(request); },
    async finalize(request) { await durable.finalize(request); },
    async resumeFinalize(artifactSetId) {
      try { await durable.resumeFinalize(artifactSetId); return "published"; }
      catch (error) { if (error instanceof ArtifactSetIncompleteError) return "incomplete"; throw error; }
    },
    async read(artifactSetId) { return await durable.read(artifactSetId); },
  };
  return createPsychordObservationArtifactService({ artifactStore, observer: input.observer });
}

export type DurablePsychordAgentBrowserObservationServiceInput =
  PsychordAgentBrowserHostDependencies & {
    readonly storageRoot: string;
  };

/**
 * Composes the production Windows Chrome host with authenticated durable
 * publication. The configured storage root must be the exact
 * `plan.adapter.input.ownedArtifactRoot` used by every submitted plan.
 */
export function createDurablePsychordAgentBrowserObservationArtifactService(
  input: DurablePsychordAgentBrowserObservationServiceInput,
): PsychordObservationArtifactService {
  const host = createPsychordAgentBrowserHost({
    commands: input.commands,
    ...(input.agentBrowserCommands === undefined ? {} : { agentBrowserCommands: input.agentBrowserCommands }),
    configuration: input.configuration,
  });
  return createDurablePsychordObservationArtifactService({
    storageRoot: input.storageRoot,
    observer: createStrictPsychordApplicationObserver(createPsychordApplicationObserver(host)),
  });
}
