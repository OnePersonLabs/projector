import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  withCanonicalHashes,
  hashFramedDomain,
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
import { RepresentationCompiler, createStateBinding, type CanonicalRepresentationSource } from "@projector/engine";

import { observePreparedMigrationTarget } from "./project-data-migration-target.js";
import { RepositoryRepresentationArtifactStore } from "../representation/artifact-store.js";
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

  test("rejects a retained representation record whose authenticated body is invalid", async () => {
    const fixture = await preparedTarget();
    const store = await RepositoryRepresentationArtifactStore.create(fixture.root);
    const compiler = new RepresentationCompiler({ artifacts: store });
    const sourceBody = {
      sourceEntityIds: ["concept:initial"],
      statements: [{ id: "concept:initial", text: "Retain exact meaning.", normativeForce: "require" as const, negated: false, scope: ["."], exceptions: [], dependencies: [], conceptIds: ["concept:initial"], protectedLiterals: [] }],
      scenarios: [],
    };
    const source: CanonicalRepresentationSource = { ...sourceBody, sourceSemanticHash: hashFramedDomain("canonical-representation-source", sourceBody) };
    const { projection } = await compiler.compile({
      source,
      binding: createStateBinding({
        compiledAgainst: { gitBase: "a".repeat(40), worktreeDigest: hash("1"), canonicalProjectorDigest: fixture.canonicalRootDigest, toolchainDigest: hash("2") },
        valueDependencies: [],
        queryDependencies: [],
      }),
      profileKey: "human-technical@1",
    });
    await store.publish(projection);
    const actualRecordRelative = `.projector/runtime/representations/projections/${hashFramedDomain("representation-projection-path", projection.id).slice("sha256:v1:".length)}.json`;
    const recordPath = join(fixture.root, ...actualRecordRelative.split("/"));
    const record = JSON.parse(await readFile(recordPath, "utf8")) as { projection: { status: string } };
    record.projection.status = "invalid";
    await writeFile(recordPath, JSON.stringify(record));
    const contentRelative = `.projector/runtime/representations/content/${projection.contentHash.slice("sha256:v1:".length)}.txt`;
    await expect(observePreparedMigrationTarget({
      repositoryRoot: fixture.root,
      targetFormat: fixture.format,
      authenticatedFiles: await Promise.all([actualRecordRelative, contentRelative].map((path) => authenticatedFile(fixture.root, path))),
      signal: new AbortController().signal,
    })).rejects.toThrow(/record hash/iu);
  });
});

async function authenticatedFile(root: string, path: string) {
  const bytes = await readFile(join(root, ...path.split("/")));
  const status = await stat(join(root, ...path.split("/")));
  return { path, length: status.size, sha256: createHash("sha256").update(bytes).digest("hex") };
}

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
