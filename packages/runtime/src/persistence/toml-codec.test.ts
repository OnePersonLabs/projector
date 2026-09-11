import { describe, expect, test } from "vitest";

import { parseTomlDocument, stringifyTomlDocument } from "./toml-codec.js";

describe("TOML document codec", () => {
  test("round-trips canonical-shaped values including readable multiline prose", () => {
    const value = {
      apiVersion: "projector/v2",
      schemaVersion: "2.0.0",
      id: "concept:durable-meaning",
      statement: "First paragraph.\n\nSecond paragraph with \\\"quotes\\\", ''' and \\\\slashes.\n",
      aliases: ["durable", "portable"],
      evidence: [{ source: "PROJECTOR_SPEC/01.md", confidence: 0.75 }],
    };

    const encoded = stringifyTomlDocument(value, {
      schemaPath: "../../schemas/canonical-document-v2.schema.json",
    });

    expect(encoded.startsWith("#:schema ../../schemas/canonical-document-v2.schema.json\n")).toBe(true);
    expect(encoded).toContain('statement = """');
    expect(encoded).toContain("\n\nSecond paragraph");
    expect(parseTomlDocument(encoded, "durable-meaning.concept.toml")).toEqual(value);
  });

  test("wraps long prose without changing its parsed meaning and leaves concise metadata compact", () => {
    const statement = "Report finite observed coverage populations and distinguish mapping from fulfillment. Preserve accepted capabilities before implementation exists. Rank concrete unresolved obligations using observed effect and blocking status.";
    const value = {
      id: "requirement:evidence-bound-completion",
      title: "Expose remaining design obligations progressively",
      payload: { statement },
    };

    const encoded = stringifyTomlDocument(value);

    expect(encoded).toContain('title = "Expose remaining design obligations progressively"');
    expect(encoded).toMatch(/statement = """[^\n]+\\\r?\n  /u);
    expect(parseTomlDocument(encoded)).toEqual(value);
  });

  test("treats comments and presentation whitespace as non-semantic", () => {
    const first = parseTomlDocument('id = "concept:one"\ncount = 2\n');
    const second = parseTomlDocument('# editor note\nid="concept:one" # inline\ncount = 2\n');

    expect(second).toEqual(first);
  });

  test("normalizes native syntax newlines without changing escaped carriage-return content", () => {
    const value = {
      statement: "First paragraph.\n\nSecond paragraph.",
      escapedCarriageReturn: "literal\rcontent",
    };
    const linuxBytes = stringifyTomlDocument(value);
    const nativeBytes = linuxBytes.replaceAll("\n", "\r\n");

    expect(nativeBytes).not.toBe(linuxBytes);
    expect(parseTomlDocument(nativeBytes)).toEqual(value);
    expect((parseTomlDocument(nativeBytes) as typeof value).escapedCarriageReturn).toContain("\r");
  });

  test("produces deterministic bytes and rejects unsafe schema directives", () => {
    const value = { id: "concept:one", statement: "line one\nline two" };
    const options = { schemaPath: "../../schemas/canonical-document-v2.schema.json" };

    expect(stringifyTomlDocument(value, options)).toBe(stringifyTomlDocument(value, options));
    expect(() => stringifyTomlDocument(value, { schemaPath: "https://example.test/schema.json" }))
      .toThrow(/document-relative.*schema path/i);
    expect(() => stringifyTomlDocument(value, { schemaPath: "../schema.json\nforged = true" }))
      .toThrow(/document-relative.*schema path/i);
  });

  test("reports malformed TOML with the source path and parser position", () => {
    expect(() => parseTomlDocument('id = "ok"\nbroken = [\n', "broken.concept.toml"))
      .toThrow(/broken\.concept\.toml.*line \d+.*column/isu);
  });

  test("does not silently round an integer outside JavaScript's safe range", () => {
    expect(() => parseTomlDocument("unsafe = 9007199254740993\n", "unsafe.toml"))
      .toThrow(/unsupported TOML value.*bigint/isu);
  });

  test("round-trips explicit null values that TOML does not represent natively", () => {
    const value = { payload: { optional: null, items: ["kept", null] } };

    const encoded = stringifyTomlDocument(value);

    expect(encoded).toContain("__projector_toml_null = true");
    expect(parseTomlDocument(encoded)).toEqual(value);
  });

  test("rejects authored or malformed private null markers", () => {
    expect(() => stringifyTomlDocument({ nested: { __projector_toml_null: true } })).toThrow(/reserved/iu);
    expect(() => parseTomlDocument('[value]\n__projector_toml_null = false\n'))
      .toThrow(/invalid reserved TOML null marker/iu);
    expect(() => parseTomlDocument('[value]\n__projector_toml_null = true\nextra = true\n'))
      .toThrow(/invalid reserved TOML null marker/iu);
  });
});
