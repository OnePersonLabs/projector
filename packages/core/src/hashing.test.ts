import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  hashCanonicalDocument,
  hashDiscovery,
  hashRootManifest,
  hashSemantic,
  parseCanonicalJson,
  registerHashProfile,
  verifyCanonicalEnvelope,
  withCanonicalHashes,
} from "./index.js";

describe("canonical serialization and hash domains", () => {
  it("is independent of object insertion order", () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string({ minLength: 1 }), fc.jsonValue()),
        (record) => {
          const reversed = Object.fromEntries(Object.entries(record).reverse());
          expect(canonicalJson(record)).toBe(canonicalJson(reversed));
        },
      ),
    );
  });

  it("rejects non-JSON and non-finite values", () => {
    expect(() => canonicalJson({ n: Number.NaN })).toThrow(/finite/i);
    expect(() => canonicalJson({ n: 1n })).toThrow(/JSON/i);
    expect(() => canonicalJson({ fn: () => undefined })).toThrow(/JSON/i);
  });

  it("rejects duplicate object keys before canonicalization", () => {
    expect(() => parseCanonicalJson('{"a":1,"a":2}')).toThrow(/duplicate/i);
    expect(parseCanonicalJson('{"a":1,"nested":{"a":2}}')).toEqual({ a: 1, nested: { a: 2 } });
  });

  it("keeps semantic, discovery, and exact-document domains distinct", () => {
    registerHashProfile("Example", {
      semantic: ["meaning"],
      discovery: ["alias"],
      volatile: ["observedAt"],
    });
    const value = { meaning: "same", alias: "old", observedAt: "now" };
    expect(new Set([
      hashSemantic("Example", value),
      hashDiscovery("Example", value),
      hashCanonicalDocument("Example", value),
    ]).size).toBe(3);
  });

  it("excludes aliases from semantic hashes and volatile fields from all projected hashes", () => {
    registerHashProfile("IdentityExample", {
      semantic: ["statement"],
      discovery: ["key", "aliases"],
      volatile: ["observedAt"],
    });
    const base = { key: "checkout", aliases: ["cart"], statement: "collect payment", observedAt: "a" };
    expect(hashSemantic("IdentityExample", base)).toBe(
      hashSemantic("IdentityExample", { ...base, aliases: ["basket"], observedAt: "b" }),
    );
    expect(hashDiscovery("IdentityExample", base)).not.toBe(
      hashDiscovery("IdentityExample", { ...base, aliases: ["basket"] }),
    );
    expect(hashCanonicalDocument("IdentityExample", base)).toBe(
      hashCanonicalDocument("IdentityExample", { ...base, observedAt: "b" }),
    );
  });

  it("rejects hashing a kind without a registered projection", () => {
    expect(() => hashSemantic("Unregistered", { value: 1 })).toThrow(/registered/i);
  });

  it("hashes root entries independently of enumeration order", () => {
    const a = { entityId: "a", canonicalDocumentHash: `sha256:v1:${"a".repeat(64)}` as const };
    const b = { entityId: "b", canonicalDocumentHash: `sha256:v1:${"b".repeat(64)}` as const };
    expect(hashRootManifest([a, b])).toBe(hashRootManifest([b, a]));
    expect(() => hashRootManifest([a, a])).toThrow(/duplicate/i);
  });

  it("ships the canonical Concept projection instead of requiring caller guesses", () => {
    const concept = { kind: "behavior", statement: "charge once", status: "active", tags: ["payment"], key: "charge", name: "Charge", aliases: ["pay"] };
    expect(hashSemantic("concept", concept)).toBe(hashSemantic("concept", { ...concept, aliases: ["collect"] }));
    expect(hashSemantic("concept", concept)).not.toBe(hashSemantic("concept", { ...concept, statement: "charge twice" }));
  });

  it("creates and verifies a versioned canonical envelope", () => {
    const payload = { id: "concept_charge", key: "charge", kind: "behavior", name: "Charge", aliases: [], statement: "charge once", status: "active", sourceClass: "authored", confidence: 1, tags: [], evidence: [], discoveryHash: `sha256:v1:${"0".repeat(64)}`, semanticHash: `sha256:v1:${"0".repeat(64)}` };
    const envelope = withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "concept", id: payload.id, key: payload.key, lifecycle: payload.status, payload });
    expect(verifyCanonicalEnvelope(envelope)).toEqual([]);
    expect(verifyCanonicalEnvelope({ ...envelope, key: "different" })).toContain("envelope key must match payload key");
  });
});
