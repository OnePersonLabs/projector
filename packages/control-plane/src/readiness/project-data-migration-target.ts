import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";

import {
  EvidenceRefSchema,
  PreparedProjectorConfigSchema,
  ProjectDataFormatSnapshotSchema,
  canonicalJson,
  type CanonicalDocumentEnvelope,
  type EvidenceRef,
  type ProjectDataFormatSnapshot,
} from "@projector/core";
import {
  psychordObservationAdapterId,
  psychordObservationAdapterVersion,
  type StrictPsychordApplicationObserver,
} from "@projector/integrations/runtime-evidence";
import {
  CanonicalFileRepository,
  inspectExistingSqliteDerivedState,
  parseTomlDocument,
  type ProjectBackupManifestFile,
} from "@projector/runtime";

import { createDurablePsychordObservationArtifactService } from "../application-evidence/psychord.js";
import { validateRetainedRepresentationArtifacts } from "../representation/artifact-store.js";

const maximumConfigBytes = 16 * 1024;

export interface ObservedPreparedMigrationTarget {
  readonly format: ProjectDataFormatSnapshot;
  readonly canonicalRootDigest: ProjectDataFormatSnapshot["snapshotHash"];
}

/**
 * Validates the current release-owned formats with their real owners. Historical
 * byte equality remains the migration journal/backup verifier's responsibility.
 */
export async function observePreparedMigrationTarget(input: {
  readonly repositoryRoot: string;
  readonly targetFormat: ProjectDataFormatSnapshot;
  readonly authenticatedFiles: readonly ProjectBackupManifestFile[];
  readonly signal: AbortSignal;
  readonly requireSqlite?: boolean;
}): Promise<ObservedPreparedMigrationTarget> {
  throwIfAborted(input.signal);
  const target = ProjectDataFormatSnapshotSchema.parse(input.targetFormat);
  const config = await readPreparedConfig(join(input.repositoryRoot, ".projector", "config.toml"));
  if (
    config.apiVersion !== target.preparedConfig.apiVersion ||
    config.projectorVersion !== target.preparedConfig.projectorVersion
  ) {
    throw new Error("Prepared config does not match the sealed target release format");
  }

  const canonical = await new CanonicalFileRepository(input.repositoryRoot).snapshot();
  throwIfAborted(input.signal);
  await validateRuntimeEvidence(input.repositoryRoot, canonical.documents, input.authenticatedFiles, input.signal);
  await validateRetainedRepresentationArtifacts({
    repositoryRoot: input.repositoryRoot,
    authenticatedFiles: input.authenticatedFiles,
    signal: input.signal,
  });
  if (input.requireSqlite !== false) {
    const sqlite = await inspectExistingSqliteDerivedState(
    join(input.repositoryRoot, ".projector", "state.db"),
    canonical.rootDigest,
    { signal: input.signal },
    );
    if (sqlite.status !== "valid") throw new Error("Prepared target is missing its validated SQLite derived state");
    if (
      sqlite.schemaVersion !== target.sqlite.schemaVersion ||
      sqlite.migrationSetHash !== target.sqlite.migrationSetHash
    ) {
      throw new Error("SQLite state does not match the sealed target release format");
    }
  }

  return { format: target, canonicalRootDigest: canonical.rootDigest };
}

async function readPreparedConfig(path: string) {
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const status = await handle.stat();
    if (!status.isFile() || status.size > maximumConfigBytes) throw new Error("Prepared config is not a bounded regular file");
    return PreparedProjectorConfigSchema.parse(parseTomlDocument(await handle.readFile("utf8"), path));
  } finally {
    await handle.close();
  }
}

async function validateRuntimeEvidence(
  repositoryRoot: string,
  documents: readonly CanonicalDocumentEnvelope[],
  files: readonly ProjectBackupManifestFile[],
  signal: AbortSignal,
): Promise<void> {
  const references = applicationEvidenceReferences(documents);
  for (const reference of references) {
    throwIfAborted(signal);
    if (
      reference.applicationPredicate?.adapter.id !== psychordObservationAdapterId ||
      reference.applicationPredicate.adapter.version !== psychordObservationAdapterVersion
    ) {
      throw new Error(`Unsupported retained application evidence owner for ${reference.evidenceId}`);
    }
    const marker = `/published/${reference.evidenceId}/manifest.bin`;
    const matches = files.filter(({ path }) => path.endsWith(marker));
    if (matches.length !== 1) {
      throw new Error(`Retained application evidence ${reference.evidenceId} does not have one authenticated artifact root`);
    }
    const rootRelative = matches[0]!.path.slice(0, -marker.length);
    const service = createDurablePsychordObservationArtifactService({
      storageRoot: join(repositoryRoot, ...rootRelative.split("/")),
      observer: unavailableObserver,
    });
    const observed = await service.read(reference.evidenceId);
    if (observed.status !== "published") {
      throw new Error(`Retained application evidence ${reference.evidenceId} is ${observed.status}`);
    }
  }
}

const unavailableObserver: StrictPsychordApplicationObserver = {
  async observeApplication() {
    throw new Error("Recovery validates retained evidence and cannot collect a new observation");
  },
};

function applicationEvidenceReferences(documents: readonly CanonicalDocumentEnvelope[]): EvidenceRef[] {
  const found = new Map<string, EvidenceRef>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value !== "object" || value === null) return;
    const parsed = EvidenceRefSchema.safeParse(value);
    const reference = parsed.success ? parsed.data as EvidenceRef : undefined;
    if (reference?.applicationPredicate?.kind === "application-observation") {
      const prior = found.get(reference.evidenceId);
      if (prior !== undefined && canonicalJson(prior) !== canonicalJson(reference)) {
        throw new Error(`Application evidence ${reference.evidenceId} has conflicting canonical bindings`);
      }
      found.set(reference.evidenceId, reference);
      return;
    }
    for (const nested of Object.values(value)) visit(nested);
  };
  for (const document of documents) visit(document);
  return [...found.values()].sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}
