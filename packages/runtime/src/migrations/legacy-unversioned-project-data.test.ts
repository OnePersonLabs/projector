import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { canonicalJson, withCanonicalHashes, type CanonicalDocumentEnvelope } from "@projector/core";
import { afterEach, describe, expect, test } from "vitest";

import { CanonicalFileRepository } from "../persistence/canonical-repository.js";
import { parseTomlDocument } from "../persistence/toml-codec.js";
import { prepareLegacyUnversionedProjectData } from "./legacy-unversioned-project-data.js";

const roots: string[] = [];
const zeroHash = `sha256:v1:${"0".repeat(64)}` as const;

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("legacy-unversioned project-data preparation", () => {
  test("validates legacy JSON and prepares the released TOML baseline without changing meaning", async () => {
    const repositoryRoot = await temporaryRoot("projector-legacy-source-");
    const stagingRoot = await temporaryRoot("projector-legacy-stage-");
    const document = concept("concept:legacy-meaning", "Preserve this accepted meaning.");
    await mkdir(join(repositoryRoot, ".projector", "model", "concepts"), { recursive: true });
    await mkdir(join(repositoryRoot, ".projector", "runtime", "application-evidence"), { recursive: true });
    await writeFile(join(repositoryRoot, ".projector", "config.json"), `${canonicalJson({ apiVersion: "projector.config/v1", enabled: true })}\r\n`);
    await writeFile(join(repositoryRoot, ".projector", "model", "concepts", "legacy.concept.json"), `${canonicalJson(document)}\r\n`);
    await writeFile(join(repositoryRoot, ".projector", "runtime", "application-evidence", "history.receipt.json"), "runtime-history\n");

    const prepared = await prepareLegacyUnversionedProjectData({
      repositoryRoot,
      stagingRoot,
      targetProjectorVersion: "2.1.0",
    });

    expect(prepared.sourceDocumentCount).toBe(1);
    expect(prepared.retiredPaths).not.toContain(".projector/runtime/application-evidence/history.receipt.json");
    const snapshot = await new CanonicalFileRepository(stagingRoot).snapshot();
    expect(snapshot.documents).toEqual([document]);
    expect(parseTomlDocument(await readFile(join(stagingRoot, ".projector", "config.toml"), "utf8"))).toEqual({
      apiVersion: "projector.config/v1",
      enabled: true,
      projectorVersion: "2.1.0",
    });
    await expect(readFile(join(repositoryRoot, ".projector", "config.json"), "utf8"))
      .resolves.toBe(`${canonicalJson({ apiVersion: "projector.config/v1", enabled: true })}\r\n`);
    await expect(readFile(join(repositoryRoot, ".projector", "runtime", "application-evidence", "history.receipt.json"), "utf8"))
      .resolves.toBe("runtime-history\n");
  });

  test("refuses mixed canonical TOML instead of silently omitting authored input", async () => {
    const repositoryRoot = await legacyRepository();
    const stagingRoot = await temporaryRoot("projector-legacy-stage-");
    await writeFile(join(repositoryRoot, ".projector", "model", "concepts", "mixed.concept.toml"), "kind = \"concept\"\n");

    await expect(prepareLegacyUnversionedProjectData({ repositoryRoot, stagingRoot, targetProjectorVersion: "2.1.0" }))
      .rejects.toThrow(/mixed.*toml/iu);
    await expect(readFile(join(stagingRoot, ".projector", "config.toml"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("rejects noncanonical config and a filename whose kind disagrees with its document", async () => {
    const noncanonicalRoot = await legacyRepository();
    const firstStage = await temporaryRoot("projector-legacy-stage-");
    await writeFile(join(noncanonicalRoot, ".projector", "config.json"), '{"enabled":true,"apiVersion":"projector.config/v1"}\n');
    await expect(prepareLegacyUnversionedProjectData({ repositoryRoot: noncanonicalRoot, stagingRoot: firstStage, targetProjectorVersion: "2.1.0" }))
      .rejects.toThrow(/canonical JSON bytes/iu);

    const mismatchedRoot = await legacyRepository();
    const secondStage = await temporaryRoot("projector-legacy-stage-");
    await writeFile(
      join(mismatchedRoot, ".projector", "model", "concepts", "wrong.requirement.json"),
      `${canonicalJson(concept("concept:wrong-kind", "Wrong suffix."))}\n`,
    );
    await expect(prepareLegacyUnversionedProjectData({ repositoryRoot: mismatchedRoot, stagingRoot: secondStage, targetProjectorVersion: "2.1.0" }))
      .rejects.toThrow(/filename suffix.*directory/iu);
  });

  test("rejects a symlink anywhere in legacy Projector state before staging output", async () => {
    const repositoryRoot = await legacyRepository();
    const stagingRoot = await temporaryRoot("projector-legacy-stage-");
    const outside = await temporaryRoot("projector-legacy-outside-");
    await writeFile(join(outside, "evidence.json"), "{}\n");
    await symlink(join(outside, "evidence.json"), join(repositoryRoot, ".projector", "linked.json"), "file");

    await expect(prepareLegacyUnversionedProjectData({ repositoryRoot, stagingRoot, targetProjectorVersion: "2.1.0" }))
      .rejects.toThrow(/symbolic link/iu);
  });
});

async function temporaryRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

async function legacyRepository(): Promise<string> {
  const root = await temporaryRoot("projector-legacy-source-");
  await mkdir(join(root, ".projector", "model", "concepts"), { recursive: true });
  await writeFile(join(root, ".projector", "config.json"), `${canonicalJson({ apiVersion: "projector.config/v1", enabled: true })}\n`);
  await writeFile(
    join(root, ".projector", "model", "concepts", "legacy.concept.json"),
    `${canonicalJson(concept("concept:legacy", "Legacy meaning."))}\n`,
  );
  return root;
}

function concept(id: string, statement: string): CanonicalDocumentEnvelope {
  return withCanonicalHashes({
    apiVersion: "projector/v2",
    schemaVersion: "2.0.0",
    kind: "concept",
    id,
    key: id.slice("concept:".length),
    lifecycle: "active",
    payload: {
      id,
      key: id.slice("concept:".length),
      kind: "behavior",
      name: "Legacy meaning",
      aliases: [],
      statement,
      status: "active",
      sourceClass: "authored",
      confidence: 1,
      tags: [],
      evidence: [],
      discoveryHash: zeroHash,
      semanticHash: zeroHash,
    },
  });
}
