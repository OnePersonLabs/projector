import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  withCanonicalHashes,
  type ContentHash,
  type EvidenceRef,
} from "@projector/core";
import {
  CanonicalFileRepository,
  rebuildDerivedStore,
  SqliteDerivedStore,
  stringifyTomlDocument,
} from "@projector/runtime";
import { afterEach, describe, expect, test } from "vitest";

import { observePreparedMigrationTarget } from "./project-data-migration-target.js";
import {
  canonicalOwnerModulePaths,
  createReleaseCandidateProjectDataFormat,
  preparedConfigOwnerModulePaths,
  runtimeEvidenceOwnerModulePaths,
  type ValidatedReleaseCandidateInventory,
} from "./project-data-format-owner.js";

const roots: string[] = [];
const hash = (digit: string) => `sha256:v1:${digit.repeat(64)}` as ContentHash;

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("prepared migration target observation", () => {
  test("uses strict config, canonical, runtime-evidence, and SQLite owners", async () => {
    const fixture = await preparedTarget();
    await expect(observePreparedMigrationTarget({
      repositoryRoot: fixture.root,
      targetFormat: fixture.format,
      authenticatedFiles: [],
      signal: new AbortController().signal,
    })).resolves.toMatchObject({ format: fixture.format, canonicalRootDigest: fixture.canonicalRootDigest });
  });

  test("rejects changed SQLite state instead of treating schema identity as target evidence", async () => {
    const fixture = await preparedTarget();
    await new CanonicalFileRepository(fixture.root).write(concept("concept:later"));
    await expect(observePreparedMigrationTarget({
      repositoryRoot: fixture.root,
      targetFormat: fixture.format,
      authenticatedFiles: [],
      signal: new AbortController().signal,
    })).rejects.toThrow(/state\.db canonical root mismatch/iu);
  });

  test("derives retained evidence IDs from canonical meaning and rejects an omitted artifact", async () => {
    const fixture = await preparedTarget(concept("concept:initial", [{
      evidenceId: "psychord-missing",
      stance: "supports" as const,
      applicationPredicate: {
        kind: "application-observation" as const,
        adapter: { id: "psychord.keep-reload-replay", version: "1" },
        scenario: { id: "scenario:keep-reload-replay-owned-moment", semanticHash: hash("8") },
        case: "keep-reload-replay",
        predicateId: "predicate:keep-reload-replay",
        assertionIds: ["assertion:kept"],
        observationRole: "prior" as const,
      },
    }]));
    await expect(observePreparedMigrationTarget({
      repositoryRoot: fixture.root,
      targetFormat: fixture.format,
      authenticatedFiles: [],
      signal: new AbortController().signal,
    })).rejects.toThrow(/psychord-missing.*authenticated artifact root/iu);
  });
});

async function preparedTarget(document = concept("concept:initial")) {
  const root = await mkdtemp(join(tmpdir(), "projector-prepared-target-"));
  roots.push(root);
  await mkdir(join(root, ".projector"));
  await writeFile(join(root, ".projector", "config.toml"), stringifyTomlDocument({
    apiVersion: "projector.config/v1",
    enabled: true,
    projectorVersion: "2.1.0",
  }));
  const repository = new CanonicalFileRepository(root);
  await repository.write(document);
  const snapshot = await repository.snapshot();
  const store = new SqliteDerivedStore(join(root, ".projector", "state.db"));
  try { await rebuildDerivedStore(repository, store); } finally { store.close(); }
  const format = createReleaseCandidateProjectDataFormat({
    candidate: candidateInventory(),
  });
  return { root, format, canonicalRootDigest: snapshot.rootDigest };
}

function candidateInventory(): ValidatedReleaseCandidateInventory {
  const paths = [...new Set([...preparedConfigOwnerModulePaths, ...canonicalOwnerModulePaths, ...runtimeEvidenceOwnerModulePaths])].sort();
  return {
    packageIdentity: { name: "@onepersonlabs/projector", version: "2.1.0" },
    files: paths.map((path, index) => ({ path, digest: hash(String(index % 10)) })),
  };
}

function concept(id: string, evidence: EvidenceRef[] = []) {
  return withCanonicalHashes({
    apiVersion: "projector/v2" as const,
    schemaVersion: "2.0.0",
    kind: "concept" as const,
    id,
    key: id,
    lifecycle: "active" as const,
    payload: {
      id,
      key: id,
      kind: "behavior" as const,
      name: id,
      aliases: [],
      statement: id,
      status: "active" as const,
      sourceClass: "authored" as const,
      confidence: 1,
      tags: [],
      evidence,
      discoveryHash: hash("0"),
      semanticHash: hash("0"),
    },
  });
}
