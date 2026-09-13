import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { createProjectorEditorSchemaBundle, installProjectorEditorSchemaBundle } from "./project-schema-bundle.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("installed Projector editor schema bundle", () => {
  test("reuses an immutable editor bundle across consumers", () => {
    const bundle = createProjectorEditorSchemaBundle();
    expect(createProjectorEditorSchemaBundle()).toBe(bundle);
    expect(Object.isFrozen(bundle)).toBe(true);
    expect(() => Object.assign(bundle, { 0: { relativePath: "corrupted", contents: "{}" } })).toThrow(TypeError);
    expect(() => Object.assign(bundle[0]!, { contents: "{}" })).toThrow(TypeError);
  });

  test("derives strict per-kind canonical and config editor schemas from core contract authority", () => {
    const bundle = createProjectorEditorSchemaBundle();

    expect(bundle).toHaveLength(17);
    expect(bundle.map(({ relativePath }) => relativePath).sort()).toEqual(expect.arrayContaining([
      ".projector/schemas/canonical-concept-v2.schema.json",
      ".projector/schemas/canonical-requirement-v2.schema.json",
      ".projector/schemas/projector-config-v1.schema.json",
    ]));
    for (const item of bundle) {
      const schema = JSON.parse(item.contents) as Record<string, unknown>;
      expect(schema.$schema).toBe("http://json-schema.org/draft-04/schema#");
      expect(item.contents.endsWith("\n")).toBe(true);
    }
    const schemaFor = (name: string) => JSON.parse(bundle.find(({ relativePath }) => relativePath === name)!.contents) as {
      properties: Record<string, unknown>;
      definitions: Record<string, unknown>;
    };
    const concept = schemaFor(".projector/schemas/canonical-concept-v2.schema.json");
    const requirement = schemaFor(".projector/schemas/canonical-requirement-v2.schema.json");
    const canonical = concept;
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
    const conceptPayload = dereference(concept.properties.payload as JsonSchema);
    const requirementPayload = (() => {
      const requirementDefinitions = requirement.definitions;
      const payload = requirement.properties.payload as JsonSchema;
      if (payload.$ref === undefined) return payload;
      const key = payload.$ref.match(/^#\/definitions\/(.+)$/u)?.[1];
      return requirementDefinitions[key!] as JsonSchema;
    })();
    expect(conceptPayload).toMatchObject({
      additionalProperties: { not: {} },
      required: expect.arrayContaining(["kind", "name", "statement"]),
    });
    expect(requirementPayload).toMatchObject({
      additionalProperties: { not: {} },
      required: expect.arrayContaining(["statement", "origin"]),
    });
    for (const payload of [conceptPayload, requirementPayload]) {
      expect(payload.properties).not.toHaveProperty("id");
      expect(payload.properties).not.toHaveProperty("key");
      expect(payload.properties).not.toHaveProperty("status");
      expect(payload.properties).not.toHaveProperty("semanticHash");
      expect(payload.properties).not.toHaveProperty("discoveryHash");
    }
    for (const candidate of [concept, requirement]) {
      expect(candidate.properties).not.toHaveProperty("semanticHash");
      expect(candidate.properties).not.toHaveProperty("discoveryHash");
      expect(candidate.properties).not.toHaveProperty("canonicalDocumentHash");
      expect(candidate).toMatchObject({ additionalProperties: { not: {} } });
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
      expect(schema).toMatchObject({ required: ["__projector_toml_null"], additionalProperties: { not: {} } });
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

    const gitLocatorConstraints: Array<Record<string, unknown>> = [];
    const findGitLocator = (value: unknown): void => {
      if (value === null || typeof value !== "object") return;
      if (!Array.isArray(value) && Array.isArray((value as Record<string, unknown>).allOf)
        && JSON.stringify((value as Record<string, unknown>).allOf).includes("^git:")) {
        gitLocatorConstraints.push(...((value as { allOf: Array<Record<string, unknown>> }).allOf));
      }
      for (const child of Object.values(value)) findGitLocator(child);
    };
    for (const item of bundle) findGitLocator(JSON.parse(item.contents));
    expect(gitLocatorConstraints.length).toBeGreaterThan(0);
    const matches = (value: string) => gitLocatorConstraints.every((constraint) => {
      if (typeof constraint.pattern === "string" && !new RegExp(constraint.pattern, "u").test(value)) return false;
      const excluded = (constraint.not as { pattern?: string } | undefined)?.pattern;
      return excluded === undefined || !new RegExp(excluded, "u").test(value);
    });
    const prefix = `git:${"a".repeat(40)}:`;
    expect(matches(`${prefix}nested/file.json`)).toBe(true);
    for (const terminator of ["\r", "\n", "\u2028", "\u2029"]) {
      expect(matches(`${prefix}a${terminator}b`)).toBe(false);
    }
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
    const target = join(root, ".projector", "schemas", "canonical-concept-v2.schema.json");
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, "{}\n");

    await expect(installProjectorEditorSchemaBundle(root)).rejects.toThrow(/differs from the installed Projector bundle/i);
    expect(await readFile(target, "utf8")).toBe("{}\n");
    await expect(stat(join(root, ".taplo.toml"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
