import { hashFramedDomain } from "@projector/core";
import { describe, expect, it } from "vitest";
import type { InventoryEntry } from "../filesystem/inventory.js";
import { analyzeJavaScript, hashJavaScriptSemantics, normalizeJavaScriptSemantics } from "./facts.js";

const file = (path: string, content: string): InventoryEntry => ({ path, kind: "file", mediaType: "text/typescript", content, contentHash: hashFramedDomain("fixture", content), generated: false });

describe("compiler-backed source observation", () => {
  it("includes named, type, star and namespace re-exports in dependency populations", () => {
    const result = analyzeJavaScript([
      file("src/index.ts", "export { value as renamed } from './value.js';\nexport type { Shape } from './shape.js';\nexport * from './other.js';\nexport * as names from './namespace.js';"),
      file("src/value.ts", "export const value = 1;"),
      file("src/shape.ts", "export interface Shape { value: number }"),
      file("src/other.ts", "export const other = 2;"),
      file("src/namespace.ts", "export const nested = 3;"),
    ]);
    expect(result.dependencies.map(({ resolvedPath }) => resolvedPath).sort()).toEqual(["src/namespace.ts", "src/other.ts", "src/shape.ts", "src/value.ts"]);
    expect(result.dependencies.find(({ specifier }) => specifier === "./shape.js")).toMatchObject({ typeOnly: true, bindings: [{ imported: "Shape", local: "Shape", typeOnly: true }] });
    expect(result.dependencies.find(({ specifier }) => specifier === "./value.js")).toMatchObject({ bindings: [{ imported: "value", local: "renamed", typeOnly: false }] });
    expect(result.files.find(({ path }) => path === "src/index.ts")?.exportFacts).toEqual(expect.arrayContaining([expect.objectContaining({ exportedName: "names", from: "./namespace.js", wildcard: true })]));
  });

  it("observes TSX, JSX and CTS source without interpreting JSX text as declarations", () => {
    const result = analyzeJavaScript([
      file("ui/View.tsx", "import { value } from '../src/value.js';\nexport const View = () => <article>export function imaginary() {value}</article>;"),
      file("ui/Plain.jsx", "export function Plain() { return <section>content</section>; }"),
      file("src/value.ts", "export const value = 1;"),
      file("src/contracts.cts", "export type Shape = { name: string };"),
    ]);
    expect(result.files.map(({ path }) => path).sort()).toEqual(["src/contracts.cts", "src/value.ts", "ui/Plain.jsx", "ui/View.tsx"]);
    expect(result.dependencies).toEqual(expect.arrayContaining([expect.objectContaining({ importerPath: "ui/View.tsx", resolvedPath: "src/value.ts" })]));
    expect(result.files.find(({ path }) => path === "ui/View.tsx")?.declarations.map(({ name }) => name)).toEqual(["View"]);
    expect(result.failures).toEqual([]);
  });

  it("reports invalid source as incomplete syntax observation", () => {
    const result = analyzeJavaScript([file("src/broken.ts", "export const = ;")]);
    expect(result.failures).toEqual(expect.arrayContaining([expect.objectContaining({ scope: "src/broken.ts", capability: "syntax", affectedClaimKinds: expect.arrayContaining(["dependency"]) })]));
    expect(result.files[0]?.unknowns.join(" ")).toContain("syntax");
  });

  it("preserves rendered JSX comment-like text in semantic signatures", () => {
    const first = "export const View = () => <p>/* first */</p>;";
    const second = "export const View = () => <p>/* second */</p>;";
    expect(hashJavaScriptSemantics(first, "fixture", undefined, "View.tsx")).not.toBe(hashJavaScriptSemantics(second, "fixture", undefined, "View.tsx"));
    const envelope = { fields: { scope: "ui" }, key: "syntax" };
    expect(hashJavaScriptSemantics(first, "fixture", undefined, "View.tsx", envelope)).toBe(hashFramedDomain("fixture", { scope: "ui", syntax: normalizeJavaScriptSemantics(first, undefined, "View.tsx") }));
  });

  it("uses syntax locations for repeated event literals and destructured exported bindings", () => {
    const result = analyzeJavaScript([file("src/events.ts", "export const { left, right: renamed } = source;\nbus.emit('same');\nbus.on('same', handler);")]);
    expect(result.files[0]?.declarations.map(({ name }) => name).sort()).toEqual(["left", "renamed"]);
    expect(result.events.find(({ role }) => role === "producer")?.location.line).toBe(2);
    expect(result.events.find(({ role }) => role === "consumer")?.location.line).toBe(3);
  });
});
