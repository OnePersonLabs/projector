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
      expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
      expect(item.contents.endsWith("\n")).toBe(true);
    }
    const canonical = JSON.parse(bundle[0]!.contents) as {
      properties: Record<string, unknown>;
      $defs: Record<string, unknown>;
    };
    expect(canonical.properties.__projector_null_paths).toBeUndefined();
    expect(JSON.stringify(canonical.$defs)).toContain('\"__projector_toml_null\":{\"const\":true}');
    expect(JSON.stringify(canonical.$defs)).not.toContain('\"type\":\"null\"');
    const objectSchemas: Array<Record<string, unknown>> = [];
    const visit = (value: unknown): void => {
      if (value === null || typeof value !== "object") return;
      if (!Array.isArray(value) && (value as Record<string, unknown>).type === "object") {
        objectSchemas.push(value as Record<string, unknown>);
      }
      for (const child of Object.values(value)) visit(child);
    };
    visit(canonical);
    const [nullWireSchema] = objectSchemas.filter((schema) => (JSON.stringify(schema.properties) ?? "").includes("__projector_toml_null"));
    expect(nullWireSchema).toMatchObject({ required: ["__projector_toml_null"], additionalProperties: false });
    for (const schema of objectSchemas.filter((candidate) => candidate !== nullWireSchema)) {
      expect(JSON.stringify(schema.propertyNames)).toContain('\"not\":{\"const\":\"__projector_toml_null\"}');
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
    const target = join(root, ".projector", "schemas", "canonical-document-v2.schema.json");
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, "{}\n");

    await expect(installProjectorEditorSchemaBundle(root)).rejects.toThrow(/differs from the installed Projector bundle/i);
    expect(await readFile(target, "utf8")).toBe("{}\n");
    await expect(stat(join(root, ".taplo.toml"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
