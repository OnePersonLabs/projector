import { mkdir, mkdtemp, readFile, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { toCanonicalDocumentWire, withCanonicalHashes, type CanonicalDocumentEnvelope } from "@projector/core";
import { afterEach, describe, expect, test } from "vitest";

import { CanonicalFileRepository, compareCanonicalSnapshots } from "./canonical-repository.js";
import { parseCanonicalMarkdownDocument } from "./markdown-canonical.js";

const temporaryRoots: string[] = [];
const zeroHash = `sha256:v1:${"0".repeat(64)}` as const;

async function temporaryRepository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "projector-canonical-"));
  temporaryRoots.push(root);
  return root;
}

function concept(id: string, statement: string, key = `concept:${id}`): CanonicalDocumentEnvelope {
  return withCanonicalHashes({
    apiVersion: "projector/v3", schemaVersion: "3.0.0", kind: "concept", id, key, lifecycle: "active",
    payload: {
      id, key, kind: "behavior", name: id, aliases: [], statement, status: "active", sourceClass: "authored",
      confidence: 1, tags: [], evidence: [], discoveryHash: zeroHash, semanticHash: zeroHash,
    },
  });
}

function requirement(id: string, statement: string): CanonicalDocumentEnvelope {
  const key = `requirement:${id}`;
  return withCanonicalHashes({
    apiVersion: "projector/v3", schemaVersion: "3.0.0", kind: "requirement", id, key, lifecycle: "active",
    payload: {
      id, key, title: "Readable requirement", aliases: [], statement, status: "active", sourceClass: "authored",
      scope: { op: "atom", field: "path", matcher: "glob", value: "packages/**" }, origin: [],
      realizations: [{
        selector: { op: "atom", field: "path", matcher: "equals", value: "packages/core/src/index.ts" },
        origin: { kind: "content", locator: "fixture:core-index", contentHash: zeroHash },
      }],
      evidence: [], discoveryHash: zeroHash, semanticHash: zeroHash,
    },
  });
}

function authority(id: string): CanonicalDocumentEnvelope {
  const key = "authority-fixture";
  return withCanonicalHashes({
    apiVersion: "projector/v3", schemaVersion: "3.0.0", kind: "authority-record", id, key, lifecycle: "approved",
    payload: {
      id, key, subjectId: "concern:fixture", status: "approved", conclusion: "preserve", rationale: "Keep the durable meaning readable.",
      alternatives: [], assumptions: ["The fixture stays small."], reconsiderWhen: [{ type: "manual-review" }],
      evidenceRefreshPolicy: { key: "manual-review", mode: "manual", requireOfficialSourceWhenAvailable: false },
      vector: {
        explicitDecisionAlignment: 1, productConstraintFit: 1, semanticFit: 1, independentOccurrence: 0, historicalStability: 0,
        independentValidationSupport: 0, boundaryCoherence: 1, maintenanceOutcome: 1, platformCompatibility: 1, externalRationale: 0,
        ecosystemHealth: 0, securitySupport: 0, reversibility: 1, migrationCost: 0, counterEvidence: 0,
      },
      assessmentConfidence: "high", evidence: [{ evidenceId: "evidence:fixture", stance: "supports" }],
      governanceRiskClass: "R1", decidedBy: "user", createdAt: "2026-09-20T00:00:00Z", semanticHash: zeroHash,
    },
  });
}

afterEach(async () => { await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("CanonicalFileRepository V3", () => {
  test("uses Markdown as the sole readable source for prose-led records", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const document = concept("concept:durable-meaning", "A person can read this before they know the schema.");

    const path = await repository.write(document);
    const source = await readFile(path, "utf8");

    expect(path.replaceAll("\\", "/")).toMatch(/\/model\/concepts\/concept-durable-meaning--concept-concept-durable-meaning\.md$/u);
    expect(source).toContain("+++\nformat = 3");
    expect(source).toContain("# concept:durable-meaning");
    expect(source).toContain("A person can read this before they know the schema.");
    expect(source).toContain("[metadata]");
    expect(source).toContain('kind = "behavior"');
    expect(source).not.toMatch(/canonicalDocumentHash|semanticHash|discoveryHash/u);
    expect(await repository.read("concept", document.id)).toEqual(document);
    expect(await repository.locate("concept", document.id)).toMatchObject({ path, relativePath: "model/concepts/concept-durable-meaning--concept-concept-durable-meaning.md", format: "markdown" });
  });

  test("keeps a readable source path when the body changes", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const original = concept("concept:stable-id", "Original meaning.");
    const path = await repository.write(original);

    const revised = concept("concept:stable-id", "Revised meaning.");
    expect(await repository.write(revised)).toBe(path);
    expect((await repository.read("concept", "concept:stable-id"))?.payload.statement).toBe("Revised meaning.");
  });

  test("locates a moved Markdown record by its stable ID and preserves that path", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const original = concept("concept:movable", "Original.");
    const path = await repository.write(original);
    const moved = join(root, ".projector", "model", "concepts", "topic", "human-name.md");
    await mkdir(join(moved, ".."), { recursive: true });
    await rename(path, moved);

    expect(await repository.locate("concept", original.id)).toMatchObject({ path: moved });
    expect(await repository.write(concept(original.id, "Revised."))).toBe(moved);
  });

  test("rejects V2 TOML within a prose-led family rather than keeping a compatibility reader", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const legacy = join(root, ".projector", "model", "concepts", "legacy.concept.toml");
    await mkdir(join(legacy, ".."), { recursive: true });
    await writeFile(legacy, 'apiVersion = "projector/v2"\n', "utf8");

    await expect(repository.snapshot()).rejects.toThrow(/one-time V3 cutover/i);
  });

  test("rejects duplicate body and metadata ownership", () => {
    expect(() => parseCanonicalMarkdownDocument(`+++\nformat = 3\napiVersion = "projector/v3"\nschemaVersion = "3.0.0"\nkind = "concept"\nid = "concept:one"\nkey = "one"\nlifecycle = "active"\n[metadata]\nname = "wrong owner"\nkind = "behavior"\naliases = []\nstatus = "active"\nsourceClass = "authored"\nconfidence = 1\ntags = []\nevidence = []\n+++\n\n# Right owner\n\nStatement.\n`))
      .toThrow(/both body and metadata owners/i);
  });

  test("rejects body fields or arbitrary fields in the details appendix", () => {
    const source = `+++\nformat = 3\napiVersion = "projector/v3"\nschemaVersion = "3.0.0"\nkind = "concept"\nid = "concept:one"\nkey = "one"\nlifecycle = "active"\n[metadata]\nkind = "behavior"\naliases = []\nstatus = "active"\nsourceClass = "authored"\nconfidence = 1\ntags = []\nevidence = []\n+++\n\n# Right owner\n\nStatement.\n\n<details>\n<summary>Structured record details</summary>\n\n\`\`\`toml\nstatement = "forged"\n\`\`\`\n</details>\n`;
    expect(() => parseCanonicalMarkdownDocument(source)).toThrow(/details field is not permitted/i);
  });

  test("places scope and realization bindings after the prose without changing authored meaning", () => {
    const document = requirement("requirement:readable", "Start with the meaning a person needs.");
    const source = new CanonicalFileRepository("/repository").prepareWrite(document).contents;

    expect(source).toMatch(/\+\+\+\n\n# Readable requirement\n\nStart with the meaning a person needs\./u);
    expect(source).not.toContain("[metadata.scope]");
    expect(source).toContain("<summary>Structured record details</summary>");
    expect(source).toContain("[scope]");
    expect(source).toContain("[[realizations]]");
    expect(parseCanonicalMarkdownDocument(source)).toEqual(toCanonicalDocumentWire(document));
  });

  test("places authority assumptions, evidence, and reconsideration qualifications after the rationale", () => {
    const document = authority("authority:fixture");
    const source = new CanonicalFileRepository("/repository").prepareWrite(document).contents;
    const header = source.slice(0, source.indexOf("+++\n\n", 4));

    expect(source).toMatch(/\+\+\+\n\n# Authority for concern:fixture\n\n## Rationale/u);
    expect(header).not.toMatch(/\[metadata\.(?:reconsiderWhen|evidence|evidenceRefreshPolicy)\]|assumptions\s*=/u);
    expect(source).toContain("assumptions = [ \"The fixture stays small.\" ]");
    expect(source).toContain("[[reconsiderWhen]]");
    expect(source).toContain("[[evidence]]");
    expect(source).toContain("[evidenceRefreshPolicy]");
    expect(parseCanonicalMarkdownDocument(source)).toEqual(toCanonicalDocumentWire(document));
  });

  test("allows the project README beside authored records", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    await repository.write(concept("concept:indexed", "Meaning."));
    await writeFile(join(root, ".projector", "README.md"), "# Projector records\n", "utf8");
    expect((await repository.snapshot()).documents.map(({ id }) => id)).toEqual(["concept:indexed"]);
  });

  test("uses a stable key to distinguish new records with the same human title", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const firstSource = concept("concept:first", "One.", "first-key");
    const secondSource = concept("concept:second", "Two.", "second-key");
    const first = withCanonicalHashes({ ...firstSource, payload: { ...firstSource.payload, name: "Shared title" } });
    const second = withCanonicalHashes({ ...secondSource, payload: { ...secondSource.payload, name: "Shared title" } });

    const firstPath = await repository.write(first);
    const secondPath = await repository.write(second);
    expect(firstPath.replaceAll("\\", "/")).toMatch(/\/shared-title--first-key\.md$/u);
    expect(secondPath.replaceAll("\\", "/")).toMatch(/\/shared-title--second-key\.md$/u);
  });

  test("uses an unambiguous delimiter after normalizing title and key", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const firstSource = concept("concept:one", "One.", "b-c");
    const secondSource = concept("concept:two", "Two.", "c");
    const first = withCanonicalHashes({ ...firstSource, payload: { ...firstSource.payload, name: "a" } });
    const second = withCanonicalHashes({ ...secondSource, payload: { ...secondSource.payload, name: "a-b" } });

    const firstPath = await repository.write(first);
    const secondPath = await repository.write(second);
    expect(firstPath.replaceAll("\\", "/")).toMatch(/\/a--b-c\.md$/u);
    expect(secondPath.replaceAll("\\", "/")).toMatch(/\/a-b--c\.md$/u);
  });

  test("fails closed when a readable title and stable key collide with a different stable ID", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const firstSource = concept("concept:first", "One.", "shared-key");
    const secondSource = concept("concept:second", "Two.", "shared-key");
    const first = withCanonicalHashes({ ...firstSource, payload: { ...firstSource.payload, name: "Shared title" } });
    const second = withCanonicalHashes({ ...secondSource, payload: { ...secondSource.payload, name: "Shared title" } });

    await repository.write(first);
    const colliding = second;
    await expect(repository.write(colliding)).rejects.toThrow(/owned by concept:first/i);
  });

  test("rejects prepared destinations outside the record's canonical family", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const document = concept("concept:contained", "Meaning.");

    expect(() => repository.prepareWrite(document, { existingPath: join(root, "outside.md") }))
      .toThrow(/outside the concept family/i);
    expect(() => repository.prepareWrite(document, { existingPath: join(root, ".projector", "model", "requirements", "wrong.md") }))
      .toThrow(/outside the concept family/i);
  });

  test("rejects manually duplicated stable IDs and conflicting keys", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const original = concept("concept:original", "One.", "shared-key");
    const path = await repository.write(original);
    const duplicatePath = join(root, ".projector", "model", "concepts", "copied.md");
    await writeFile(duplicatePath, await readFile(path, "utf8"), "utf8");

    await expect(repository.snapshot()).rejects.toThrow(/duplicate/i);
    await rm(duplicatePath);
    await repository.write(concept("concept:other", "Two.", "shared-key"));
    await expect(repository.snapshot()).rejects.toThrow(/duplicate canonical key/i);
  });

  test("does not follow symlinked Markdown source paths", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const external = join(root, "external.md");
    await writeFile(external, "untrusted", "utf8");
    const link = join(root, ".projector", "model", "concepts", "linked.md");
    await mkdir(join(link, ".."), { recursive: true });
    await symlink(external, link);
    await expect(repository.snapshot()).rejects.toThrow(/symlink.*canonical/i);
  });

  test("reports normalized graph differences without comparing source formatting", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    await repository.write(concept("concept:one", "Meaning."));
    const before = await repository.snapshot();
    const path = (await repository.locate("concept", "concept:one"))!.path;
    const source = await readFile(path, "utf8");
    await writeFile(path, source.replaceAll("\n", "\r\n"), "utf8");
    expect(compareCanonicalSnapshots(before, await repository.snapshot())).toEqual([]);
  });

  test("writes atomically without rewriting unrelated readable records", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    await repository.write(concept("concept:one", "One."));
    const otherPath = await repository.write(concept("concept:two", "Two."));
    const before = await stat(otherPath);
    await repository.write(concept("concept:one", "Changed."));
    expect((await stat(otherPath)).ino).toBe(before.ino);
  });
});
