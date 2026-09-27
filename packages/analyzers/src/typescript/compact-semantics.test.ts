import { DerivedObservationBudget, hashFramedDomain } from "@projector/core";
import { describe, expect, it } from "vitest";

import type { InventoryEntry } from "../filesystem/inventory.js";
import { analyzeJavaScript, hashJavaScriptSemantics, normalizeJavaScriptSemantics } from "./facts.js";

const entry = (path: string, content: string): InventoryEntry => ({ path, kind: "file", mediaType: "text/javascript", content,
  contentHash: hashFramedDomain("fixture", content), generated: true });

describe("compact JavaScript semantics", () => {
  it("preserves all prior domain hashes and participant identities", () => {
    for (const content of ["", "bus.emit('ready');", "const s = '\"\\\\\\n';", "const s = `é漢😀\ud800\udfff\t\0`;", "return\n/x+/gi.test(`a${b}`);", "export const value = 1;"]) {
      const normalized = normalizeJavaScriptSemantics(content);
      const file = analyzeJavaScript([entry("bundle.js", content)]).files[0]!;
      expect(file.semanticHash).toBe(hashFramedDomain("projector.local-semantic", normalized));
      expect(file.fallbackHash).toBe(hashFramedDomain("local-unit-fallback", normalized));
      expect(file.variantHash).toBe(hashFramedDomain("local-unit-variant", normalized));
      const anchors = file.declarations.filter(({ exported }) => exported).map(({ name, kind }) => `${kind}:${name}`).sort();
      expect(file.participantId).toBe(`ts_participant_${hashFramedDomain("typescript-participant", { scopeKey: file.scopeKey, anchor: anchors.length > 0 ? anchors : normalized }).slice(-32)}`);
      const fields = { role: "source", exports: file.exports, dependencySpecifiers: [], lifecycleExports: [] };
      expect(hashJavaScriptSemantics(content, "projector.local-structural", new DerivedObservationBudget(), "bundle.js", { fields, key: "syntaxTokens" }))
        .toBe(hashFramedDomain("projector.local-structural", { ...fields, syntaxTokens: normalized }));
    }
  });

  it("keeps formatting equivalence and lexical distinctions", () => {
    const hash = (content: string): string => hashJavaScriptSemantics(content, "fixture");
    expect(hash("export const value=1; /* comment */")).toBe(hash("export  const value = 1;"));
    expect(hash("export const value=1;")).not.toBe(hash("export const value=2;"));
    expect(hash("return\nvalue;")).not.toBe(hash("return value;"));
    expect(hash("const s='a b';")).not.toBe(hash("const s='ab';"));
    expect(hash("const r=/a+/;")).not.toBe(hash("const r=/a*/;"));
    expect(hash("const s=`a${b}`;")).not.toBe(hash("const s=`a${c}`;"));
  });

  it("does not accumulate expanded normalization across sizable generated files", () => {
    const entries = Array.from({ length: 6 }, (_, index) => entry(`bundle-${index}.js`, ";".repeat(20_000)));
    const budget = new DerivedObservationBudget(2_000_000);
    const facts = analyzeJavaScript(entries, budget);
    expect(facts.files).toHaveLength(entries.length);
    expect(facts.failures).toEqual([]);
    expect(budget.usedBytes).toBeLessThan(10_000);
    expect(facts.files.every(file => !Object.hasOwn(file, "normalizedSemantics"))).toBe(true);
    expect(facts.files.every(file => file.semanticHash === facts.files[0]!.semanticHash)).toBe(true);
  });
});
