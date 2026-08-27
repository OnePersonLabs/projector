import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { deriveAcceptanceInventory } from "../packages/testkit/src/index.js";
import { buildTraceabilityManifest, resolveTraceabilityAuthority, validateTraceabilityAuthority, validateTraceabilityAuthorityShape } from "./generate-release-artifacts.mjs";

const scenarioPaths = ["PROJECTOR_SPEC/12-delivery/acceptance-core.md", "PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md", "PROJECTOR_SPEC/12-delivery/acceptance-representation.md", "PROJECTOR_SPEC/12-delivery/acceptance-architecture.md"];

async function inventory() {
  return deriveAcceptanceInventory({
    scenarios: await Promise.all(scenarioPaths.map(async (path) => ({ path, text: await readFile(path, "utf8") }))),
    testing: { path: "PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md", text: await readFile("PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md", "utf8") },
  });
}

describe("explicit release traceability authority", () => {
  it("is bijective to every exact obligation ID and resolves by ID rather than title keywords", async () => {
    const items = await inventory();
    const authority = JSON.parse(await readFile("release/traceability-authority.json", "utf8"));
    const observed = new Set(Object.values(authority.obligations).map((entry: any) => entry.testRef));
    expect(validateTraceabilityAuthority(items, authority, observed)).toBeUndefined();

    const item = items[0]!;
    expect(resolveTraceabilityAuthority({ ...item, title: "manual sandbox lifecycle keyword bait" }, authority)).toEqual(authority.obligations[item.id]);
    const { [item.id]: omitted, ...incomplete } = authority.obligations; void omitted;
    expect(() => validateTraceabilityAuthority(items, { ...authority, obligations: incomplete }, observed)).toThrow(/exact obligation.*missing/iu);
  });

  it("rejects a broad describe anchor even when its file is source controlled", async () => {
    const items = await inventory();
    const authority = JSON.parse(await readFile("release/traceability-authority.json", "utf8"));
    const first = items[0]!;
    const exact = authority.obligations[first.id];
    const collapsed = { ...authority, obligations: { ...authority.obligations, [first.id]: { ...exact, testRef: exact.testRef.split("#")[0] + "#" + exact.testRef.split("#")[1].split(" ").slice(0, 3).join(" ") } } };
    const observed = new Set(Object.values(authority.obligations).map((entry: any) => entry.testRef));
    expect(() => validateTraceabilityAuthority(items, collapsed, observed)).toThrow(/exact.*identity/iu);
  });

  it("rejects malformed authority before test collection can consume its paths", async () => {
    const items = await inventory();
    expect(() => validateTraceabilityAuthorityShape(items, { version: 1, obligations: null })).toThrow(/unsupported shape/iu);
  });

  it("renders the checked-in manifest deterministically from the explicit authority", async () => {
    const items = await inventory(); const authority = JSON.parse(await readFile("release/traceability-authority.json", "utf8")); const sourceTexts = new Map<string, string>();
    for (const { testRef } of Object.values(authority.obligations) as any[]) { const path = testRef.split("#", 1)[0]; if (!sourceTexts.has(path)) sourceTexts.set(path, await readFile(path, "utf8")); }
    const first = buildTraceabilityManifest(items, authority, sourceTexts); const second = buildTraceabilityManifest(items, authority, sourceTexts);
    expect(first).toEqual(second); expect(first).toEqual(JSON.parse(await readFile("release/traceability.json", "utf8")));
  });
});
