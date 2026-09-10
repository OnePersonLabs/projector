import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { createProjectorEditorSchemaBundle, installProjectorEditorSchemaBundle } from "./project-schema-bundle.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("installed Projector editor schema bundle", () => {
  test("derives the two versioned editor schemas from core contract authority", () => {
    const bundle = createProjectorEditorSchemaBundle();

    expect(bundle.map(({ relativePath }) => relativePath)).toEqual([
      ".projector/schemas/canonical-document-v2.schema.json",
      ".projector/schemas/projector-config-v1.schema.json",
    ]);
    for (const item of bundle) {
      const schema = JSON.parse(item.contents) as Record<string, unknown>;
      expect(schema.$schema).toBe("http://json-schema.org/draft-04/schema#");
      expect(item.contents.endsWith("\n")).toBe(true);
    }
    const canonical = JSON.parse(bundle[0]!.contents) as {
      anyOf: Array<{ properties: Record<string, unknown> }>;
      definitions: Record<string, unknown>;
    };
    expect(canonical.anyOf).toHaveLength(16);
    expect(JSON.stringify(canonical.definitions)).toContain('\"__projector_toml_null\":{\"enum\":[true]}');
    expect(JSON.stringify(canonical.definitions)).not.toContain('\"type\":\"null\"');

    type JsonSchema = {
      $ref?: string;
      const?: string;
      enum?: unknown[];
      properties?: Record<string, JsonSchema>;
      required?: string[];
      additionalProperties?: boolean;
    };
    const dereference = (value: JsonSchema): JsonSchema => {
      if (value.$ref === undefined) return value;
      const key = value.$ref.match(/^#\/definitions\/(.+)$/u)?.[1];
      const target = key === undefined ? undefined : canonical.definitions[key];
      if (target === undefined) throw new Error(`unresolved test schema reference ${value.$ref}`);
      return target as JsonSchema;
    };
    const arm = (kind: string): JsonSchema => canonical.anyOf
      .map((candidate) => candidate as JsonSchema)
      .find((candidate) => (dereference(candidate.properties!.kind!) as { enum?: unknown[] }).enum?.[0] === kind)!;
    const conceptPayload = dereference(arm("concept").properties!.payload!);
    const requirementPayload = dereference(arm("requirement").properties!.payload!);
    expect(conceptPayload).toMatchObject({
      additionalProperties: false,
      required: expect.arrayContaining(["kind", "name", "statement"]),
    });
    expect(requirementPayload).toMatchObject({
      additionalProperties: false,
      required: expect.arrayContaining(["statement", "origin"]),
    });
    for (const payload of [conceptPayload, requirementPayload]) {
      expect(payload.properties).not.toHaveProperty("id");
      expect(payload.properties).not.toHaveProperty("key");
      expect(payload.properties).not.toHaveProperty("status");
      expect(payload.properties).not.toHaveProperty("semanticHash");
      expect(payload.properties).not.toHaveProperty("discoveryHash");
    }
    for (const candidate of canonical.anyOf) {
      expect(candidate.properties).not.toHaveProperty("semanticHash");
      expect(candidate.properties).not.toHaveProperty("discoveryHash");
      expect(candidate.properties).not.toHaveProperty("canonicalDocumentHash");
    }
    expect(requirementPayload.properties).not.toHaveProperty("name");
    const objectSchemas: Array<Record<string, unknown>> = [];
    const visit = (value: unknown): void => {
      if (value === null || typeof value !== "object") return;
      if (!Array.isArray(value) && (value as Record<string, unknown>).type === "object") {
        objectSchemas.push(value as Record<string, unknown>);
      }
      for (const child of Object.values(value)) visit(child);
    };
    visit(canonical);
    const nullWireSchemas = objectSchemas.filter((schema) => {
      const properties = schema.properties;
      return properties !== null && typeof properties === "object" && Object.hasOwn(properties, "__projector_toml_null");
    });
    expect(nullWireSchemas.length).toBeGreaterThan(0);
    for (const schema of nullWireSchemas) {
      expect(schema).toMatchObject({ required: ["__projector_toml_null"], additionalProperties: false });
    }
    for (const schema of objectSchemas.filter((candidate) => !nullWireSchemas.includes(candidate))) {
      expect(schema.not).toEqual({ required: ["__projector_toml_null"] });
    }
    const serialized = JSON.stringify(canonical);
    expect(serialized).not.toContain('"$defs"');
    expect(serialized).not.toContain('"const"');
    expect(serialized).not.toContain('"propertyNames"');
    expect(serialized).not.toContain("#/$defs/");
    expect(serialized).not.toContain("(?!");
    expect(serialized).toContain("#/definitions/");
    expect(serialized).toContain("\\\\x00");
  });

  test("installs exact deterministic bytes without creating or overwriting editor configuration", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-schema-bundle-"));
    roots.push(root);
    await mkdir(join(root, ".projector"));
    await writeFile(join(root, ".taplo.toml"), "[formatting]\nindent_string = '    '\n");

    await installProjectorEditorSchemaBundle(root);
    await installProjectorEditorSchemaBundle(root);

    for (const item of createProjectorEditorSchemaBundle()) {
      expect(await readFile(join(root, item.relativePath), "utf8")).toBe(item.contents);
    }
    expect(await readFile(join(root, ".taplo.toml"), "utf8")).toBe("[formatting]\nindent_string = '    '\n");
  });

  test("refuses to replace a differing installed schema", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-schema-bundle-"));
    roots.push(root);
    const target = join(root, ".projector", "schemas", "canonical-document-v2.schema.json");
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, "{}\n");

    await expect(installProjectorEditorSchemaBundle(root)).rejects.toThrow(/differs from the installed Projector bundle/i);
    expect(await readFile(target, "utf8")).toBe("{}\n");
    await expect(stat(join(root, ".taplo.toml"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
