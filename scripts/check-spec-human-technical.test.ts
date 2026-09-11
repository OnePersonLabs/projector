import { mkdir, mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import { hashFramedDomain, toCanonicalDocumentWire, withCanonicalHashes } from "@projector/core";
import { checkAuthoritativeSpecification } from "./check-spec-human-technical.mjs";
const { stringify } = createRequire(new URL("../packages/testkit/package.json", import.meta.url))("smol-toml");
const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));
async function fixture(statement = "Preserve the complete conditions.") {
  const root = await mkdtemp(join(tmpdir(), "projector-canonical-style-")); roots.push(root);
  for (const directory of ["requirements", "scenarios"]) await mkdir(join(root, ".projector/model", directory), { recursive: true });
  const id = "scenario:style"; const hash = hashFramedDomain("fixture", id);
  const payload = { id, key: "style", title: "Preserve prose", aliases: [], status: "active", sourceClass: "authored", scope: { op: "all", items: [] }, steps: [{ role: "trigger", statement: "Read `obviously` as an exact token." }, { role: "expected-outcome", statement }], evidence: [], discoveryHash: hash, semanticHash: hash };
  const wire = toCanonicalDocumentWire(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "behavioral-scenario", id, key: "style", lifecycle: "active", payload }));
  const path = join(root, ".projector/model/scenarios/style.scenario.toml"); await writeFile(path, stringify(wire));
  return { root, path, wire };
}
describe("canonical human technical check", () => {
  it("checks typed owner prose without a Markdown manifest and does not claim semantic equivalence", async () => {
    const { root } = await fixture();
    await expect(checkAuthoritativeSpecification(root)).resolves.toMatchObject({ ownerIds: ["scenario:style"], blocking: [], semanticEquivalenceEstablished: false, truthEstablished: false });
  });
  it("keeps authored prose style advisory with its stable owner and exact field", async () => {
    const { root } = await fixture("This is obviously correct.");
    await expect(checkAuthoritativeSpecification(root)).resolves.toMatchObject({ blocking: [], advisory: [{ ownerId: "scenario:style", field: "steps.1.statement", rule: "modal-filler", count: 1 }] });
  });
  it("rejects malformed core payloads even when their prose is clean", async () => {
    const { root, path, wire } = await fixture();
    await writeFile(path, stringify({ ...wire, payload: { ...wire.payload, steps: [{ role: "unsupported", statement: "Clean prose." }] } }));
    await expect(checkAuthoritativeSpecification(root)).rejects.toThrow();
  });
  it("rejects missing canonical owners", async () => {
    const { root, path } = await fixture(); await rm(path);
    await expect(checkAuthoritativeSpecification(root)).rejects.toThrow(/owners are missing/iu);
  });
  it("routes package verification and CI through the canonical checker", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8"));
    expect(pkg.scripts["spec:check"]).toBe("node scripts/check-spec-human-technical.mjs");
    expect(pkg.scripts.verify).toContain("pnpm spec:check");
    expect(await readFile(".github/workflows/projector-operations.yml", "utf8")).toContain("pnpm verify");
  });
});
