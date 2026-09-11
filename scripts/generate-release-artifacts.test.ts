import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { hashFramedDomain, toCanonicalDocumentWire, withCanonicalHashes } from "@projector/core";
import { createRequire } from "node:module";
const { stringify: stringifyToml } = createRequire(new URL("../packages/testkit/package.json", import.meta.url))("smol-toml");
import { deriveAcceptanceInventory } from "../packages/testkit/src/index.js";
import { buildTraceabilityManifest, readCanonicalReleaseSources, resolveTraceabilityAuthority, validateTraceabilityAuthority, validateTraceabilityAuthorityShape } from "./generate-release-artifacts.mjs";

function source(key: string) {
  const id = `scenario:${key}`;
  const payload = { id, key, title: key, aliases: key === "compact" ? ["scenario:56:compact-context-preserves-critical-tokens-and-avoids-false-compression"] : [], status: "active", sourceClass: "authored", scope: { op: "atom", field: "requirement", matcher: "equals", value: "requirement:engineering-english" }, steps: [{ role: "trigger", statement: `Exercise ${key}.` }, { role: "expected-outcome", statement: `Preserve the complete ${key} conditions.` }], semanticHash: hashFramedDomain("fixture", key), discoveryHash: hashFramedDomain("fixture", key), realizations: [], evidence: [] };
  return { path: `.projector/model/scenarios/${key}.scenario.toml`, text: stringifyToml(toCanonicalDocumentWire(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "behavioral-scenario", id, key, lifecycle: "active", payload }))) };
}
function fixture() {
  const inventory = deriveAcceptanceInventory({ canonical: [source("compact"), source("closure")], legacyMappings: [{ legacyId: "scenario:56:compact-context-preserves-critical-tokens-and-avoids-false-compression", ownerIds: ["scenario:compact", "scenario:closure"] }] });
  const tests = [{ publicFacade: "projector/engine", testRef: "tests/public.test.ts#exact positive" }, { publicFacade: "projector/engine", testRef: "tests/public.test.ts#exact negative" }];
  const authority = { version: 2, obligations: Object.fromEntries(inventory.map(({ id, legacyIds }) => [id, { obligationId: id, legacyIds, tests }])) };
  return { inventory, authority, tests };
}
describe("canonical release traceability test bindings", () => {
  it("requires every canonical split owner and never resolves through legacy or title keywords", () => {
    const { inventory, authority, tests } = fixture(); const observed = new Set(tests.map(({ testRef }) => testRef));
    expect(validateTraceabilityAuthority(inventory, authority, observed)).toBeUndefined();
    const item = inventory[0]!;
    expect(resolveTraceabilityAuthority({ ...item, title: "unrelated keyword bait" }, authority)).toEqual(authority.obligations[item.id]);
    const { [item.id]: omitted, ...missing } = authority.obligations; void omitted;
    expect(() => validateTraceabilityAuthorityShape(inventory, { ...authority, obligations: missing })).toThrow(/missing/iu);
    expect(() => validateTraceabilityAuthorityShape(inventory, { version: 1, obligations: authority.obligations })).toThrow(/unsupported shape/iu);
  });
  it("requires every exact assertion and rejects duplicate, empty, or behavior-bearing bindings", () => {
    const { inventory, authority, tests } = fixture();
    expect(() => validateTraceabilityAuthority(inventory, authority, new Set([tests[0]!.testRef]))).toThrow(/exact assertion identity/iu);
    const id = inventory[0]!.id;
    for (const entry of [{ obligationId: id, tests: [] }, { obligationId: id, tests: [tests[0], tests[0]] }, { obligationId: id, tests, statement: "a parallel behavior definition" }]) expect(() => validateTraceabilityAuthorityShape(inventory, { ...authority, obligations: { ...authority.obligations, [id]: entry } })).toThrow(/binding/iu);
  });
  it("binds every exact test to full canonical conditions and semantic hashes deterministically", () => {
    const { inventory, authority } = fixture(); const texts = new Map([["tests/public.test.ts", "exact observed source\n"]]);
    const manifest = buildTraceabilityManifest(inventory, authority, texts);
    expect(manifest.version).toBe(3); expect(manifest.entries).toHaveLength(4);
    for (const item of inventory) {
      const entries = manifest.entries.filter((entry: { id: string }) => entry.id === item.id);
      expect(entries).toHaveLength(2);
      expect(entries.every((entry: { owner: unknown; semanticHash: string }) => JSON.stringify(entry.owner) === JSON.stringify(item.owner) && entry.semanticHash === item.semanticHash)).toBe(true);
    }
    expect(buildTraceabilityManifest([...inventory].reverse(), authority, texts)).toEqual(manifest);
    expect(() => buildTraceabilityManifest(inventory, authority, new Map())).toThrow(/source is missing/iu);
  });
  it("loads accepted TOML owners and rejects a legacy/draft file instead of falling back", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-canonical-release-"));
    try {
      await mkdir(join(root, ".projector/model/requirements"), { recursive: true }); await mkdir(join(root, ".projector/model/scenarios"), { recursive: true });
      const canonical = source("compact"); await writeFile(join(root, canonical.path), canonical.text);
      expect(deriveAcceptanceInventory({ canonical: await readCanonicalReleaseSources(root) })).toHaveLength(1);
      await writeFile(join(root, ".projector/model/scenarios/draft.json"), "{}");
      await expect(readCanonicalReleaseSources(root)).rejects.toThrow(/migration is required/iu);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
