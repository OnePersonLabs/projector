import { hashFramedDomain } from "@projector/core";
import { describe, expect, it } from "vitest";

import type { InventoryEntry } from "../filesystem/inventory.js";
import { analyzeJavaScript, isBundledRuntimeDependencyPath } from "./facts.js";

const entry = (path: string, content: string): InventoryEntry => ({ path, kind: "file", mediaType: path.endsWith(".json") ? "application/json" : "text/typescript", content, contentHash: hashFramedDomain("fixture", content), generated: false });

describe("TS/JS semantic index", () => {
  const inputs = [
    entry("packages/contracts/package.json", '{"name":"@demo/contracts"}'),
    entry("packages/contracts/src/index.ts", [
      "export interface Checkout { id: string }",
      "export type CheckoutId = string;",
      "export { CheckoutSchema as PublicCheckout } from './schema.js';",
      "export * from './events.js';",
    ].join("\n")),
    entry("packages/contracts/src/schema.ts", "export const CheckoutSchema = {};"),
    entry("packages/contracts/src/events.ts", "export function publishCheckout(): void;\nexport function publishCheckout() { bus.emit('checkout.created'); bus.emit(dynamicName); }"),
    entry("apps/web/package.json", '{"name":"@demo/web"}'),
    entry("apps/web/src/use.ts", "import type { Checkout as Order } from '@demo/contracts';\nimport { PublicCheckout as Schema } from '@demo/contracts';\nbus.on('checkout.created', handle);\nimport(dynamicModule);"),
  ];

  it("extracts declarations, alias/type/re-export facts, event calls, uncertainty, and locations", () => {
    const result = analyzeJavaScript(inputs);
    const contracts = result.files.find(({ path }) => path === "packages/contracts/src/index.ts")!;
    expect(contracts.declarations).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Checkout", kind: "interface", exported: true, location: expect.objectContaining({ line: 1 }) }),
      expect.objectContaining({ name: "CheckoutId", kind: "type", exported: true, location: expect.objectContaining({ line: 2 }) }),
    ]));
    expect(contracts.exportFacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ exportedName: "PublicCheckout", localName: "CheckoutSchema", from: "./schema.js" }),
      expect.objectContaining({ wildcard: true, from: "./events.js" }),
    ]));
    expect(result.dependencies.find(({ importerPath, specifier }) => importerPath === "apps/web/src/use.ts" && specifier === "@demo/contracts")).toMatchObject({ typeOnly: false, bindings: expect.arrayContaining([expect.objectContaining({ imported: "Checkout", local: "Order", typeOnly: true })]) });
    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ semanticKey: "checkout.created", role: "producer", scopeKey: "@demo/contracts" }),
      expect.objectContaining({ semanticKey: "checkout.created", role: "consumer", scopeKey: "@demo/web" }),
    ]));
    expect(result.files.flatMap(({ unknowns }) => unknowns).join(" ")).toMatch(/dynamic event|dynamic import/iu);
    expect(result.files.find(({ path }) => path.endsWith("events.ts"))?.declarations.some(({ overload }) => overload)).toBe(true);
  });

  it("is deterministic under inventory reorder and keeps package-scoped same names distinct", () => {
    const forward = analyzeJavaScript(inputs);
    const reverse = analyzeJavaScript([...inputs].reverse());
    expect(reverse).toEqual(forward);
    const siblings = analyzeJavaScript([
      entry("packages/a/package.json", '{"name":"@demo/a"}'), entry("packages/a/index.ts", "export interface Result {}"),
      entry("packages/b/package.json", '{"name":"@demo/b"}'), entry("packages/b/index.ts", "export interface Result {}"),
    ]).files.flatMap(({ declarations }) => declarations).filter(({ name }) => name === "Result");
    expect(new Set(siblings.map(({ id }) => id)).size).toBe(2);
  });

  it("keeps bundled runtime dependencies available for resolution without analyzing their source", () => {
    const vendorRoot = "plugins/projector-v3/runtime/projector/node_modules/example";
    const vendorFile = `${vendorRoot}/index.test.ts`;
    const firstPartyFile = "plugins/projector-v3/runtime/projector/src/consumer.ts";
    const result = analyzeJavaScript([
      entry(`${vendorRoot}/package.json`, '{"name":"example"}'),
      entry(vendorFile, [
        "import './missing.js';",
        "export interface VendorContract {}",
        "export function activate() {}",
        "test('vendor', () => {});",
        "bus.emit('vendor.event');",
      ].join("\n")),
      entry("plugins/projector-v3/runtime/projector/package.json", '{"name":"@projector/runtime-bundle"}'),
      entry(firstPartyFile, [
        "import '../node_modules/example/index.test.js';",
        "export interface FirstPartyContract {}",
        "bus.emit('first-party.event');",
      ].join("\n")),
      entry("node_modules/other/index.ts", "export const ordinaryDependency = 1;"),
    ]);

    expect(isBundledRuntimeDependencyPath(vendorFile)).toBe(true);
    expect(isBundledRuntimeDependencyPath("node_modules/other/index.ts")).toBe(false);
    expect(result.files.map(({ path }) => path)).toEqual(["node_modules/other/index.ts", firstPartyFile]);
    expect(result.files.find(({ path }) => path === firstPartyFile)).toMatchObject({
      scopeKey: "@projector/runtime-bundle",
      declarations: expect.arrayContaining([expect.objectContaining({ name: "FirstPartyContract" })]),
    });
    expect(result.dependencies).toEqual([expect.objectContaining({ importerPath: firstPartyFile, resolvedPath: vendorFile })]);
    expect(result.events.map(({ semanticKey }) => semanticKey)).toEqual(["first-party.event"]);
    expect(result.contracts.map(({ semanticKey }) => semanticKey)).toEqual(["FirstPartyContract"]);
    expect(result.testTargets).toEqual([]);
    expect(result.failures).toEqual([]);
  });
});
