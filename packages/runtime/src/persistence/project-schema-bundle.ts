import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  CanonicalDocumentWireSchemasByKind,
  type CanonicalKind,
  exportContractJsonSchemas,
} from "@projector/core";
import { z } from "zod";

import { RepositoryPathService } from "../security/repository-path.js";

export interface ProjectorEditorSchema {
  readonly relativePath: string;
  readonly contents: string;
}

export function createProjectorEditorSchemaBundle(): readonly ProjectorEditorSchema[] {
  const schemas = exportContractJsonSchemas();
  const selected = [
    ...Object.entries(CanonicalDocumentWireSchemasByKind).map(([kind, schema]) => [
      `.projector/schemas/canonical-${kind}-v2.schema.json`,
      tomlEncodingSchema(z.toJSONSchema(schema, {
        target: "draft-2020-12",
        reused: "ref",
        cycles: "ref",
        io: "input",
      })),
    ] as const),
    [".projector/schemas/projector-config-v1.schema.json", taploDraft4Schema(schemas.PreparedProjectorConfig)],
  ] as const;
  return selected.map(([relativePath, schema]) => {
    if (schema === undefined) throw new Error(`Core contract registry does not export the schema for ${relativePath}`);
    return Object.freeze({ relativePath, contents: `${JSON.stringify(schema, null, 2)}\n` });
  });
}

export async function installProjectorEditorSchemaBundle(repositoryRoot: string): Promise<void> {
  const paths = await RepositoryPathService.create(repositoryRoot);
  await ensureDurableDirectoryPath(paths.root, [".projector", "schemas"]);
  const prepared = await Promise.all(createProjectorEditorSchemaBundle().map(async (item) => {
    const target = (await paths.resolveWrite(item.relativePath)).realTarget;
    let existing: string | undefined;
    try {
      existing = await readFile(target, "utf8");
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    if (existing !== undefined && existing !== item.contents) {
      throw new Error(`${item.relativePath} differs from the installed Projector bundle`);
    }
    return { ...item, target, missing: existing === undefined };
  }));
  for (const item of prepared) {
    if (!item.missing) continue;
    const temporary = join(dirname(item.target), `.schema.${randomBytes(12).toString("hex")}.tmp`);
    let handle;
    try {
      handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
      try {
        await handle.writeFile(item.contents, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
        handle = undefined;
      }
      try {
        await link(temporary, item.target);
      } catch (error) {
        if (!isCode(error, "EEXIST") || await readFile(item.target, "utf8") !== item.contents) throw error;
      }
      // Publish the durable schema name before config.toml can refer to it.
      await syncDirectory(dirname(item.target));
    } finally {
      if (handle !== undefined) await handle.close();
      await rm(temporary, { force: true });
    }
  }
}

async function ensureDurableDirectoryPath(root: string, segments: readonly string[]): Promise<void> {
  let current = root;
  for (const segment of segments) {
    const parent = current;
    current = join(current, segment);
    try {
      await mkdir(current);
    } catch (error) {
      if (!isCode(error, "EEXIST")) throw error;
    }
    const status = await lstat(current);
    if (status.isSymbolicLink() || !status.isDirectory()) throw new Error(`${current} must be a real directory`);
    // A raced creator may not have persisted the new name yet.
    await syncDirectory(parent);
  }
}

async function syncDirectory(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } catch (error) {
    if (!isCode(error, "EINVAL") && !isCode(error, "ENOTSUP") && !isCode(error, "EPERM")) throw error;
  } finally {
    await handle.close();
  }
}

/** Adapts the core JSON-value schema to the lossless, private TOML null encoding. */
function tomlEncodingSchema(schema: unknown): unknown {
  const encoded = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
  transformNullSchemas(encoded);
  convertToTaploDraft4(encoded, true);
  assertTaploDraft4Schema(encoded);
  const objectSchemas = Array.isArray(encoded.anyOf) ? encoded.anyOf : [encoded];
  if (objectSchemas.length === 0 || objectSchemas.some((candidate) => {
    if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) return true;
    const properties = (candidate as Record<string, unknown>).properties;
    return properties === null || typeof properties !== "object" || Array.isArray(properties);
  })) {
    throw new Error("Canonical document schema must expose strict object alternatives");
  }
  return encoded;
}

const reservedTomlNullKey = "__projector_toml_null";
const portableRelativePathPattern = "^(?!\\s)(?!.*\\s$)(?!\\.$)(?!\\.\\.$)[^\\\\/\\0]+$";
const gitArtifactLocatorPattern = "^git:(?:[a-f0-9]{40}|[a-f0-9]{64}):(?!\\/)(?![A-Za-z]:)(?!.*\\\\)(?!.*\\/\\/)(?!(?:\\.|\\.\\.)(?:\\/|$))(?!.*\\/(?:\\.|\\.\\.)(?:\\/|$))[^/](?:.*[^/])?$";

function taploDraft4Schema(schema: unknown): unknown {
  const encoded = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
  convertToTaploDraft4(encoded, true);
  assertTaploDraft4Schema(encoded);
  return encoded;
}

/** Taplo validates local editor schemas using JSON Schema Draft 4. */
function convertToTaploDraft4(value: unknown, root = false): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) convertToTaploDraft4(item);
    return;
  }
  const schema = value as Record<string, unknown>;
  if (root) schema.$schema = "http://json-schema.org/draft-04/schema#";
  if (schema.$defs !== undefined) {
    if (schema.definitions !== undefined) throw new Error("Canonical document schema defines both $defs and definitions");
    schema.definitions = schema.$defs;
    delete schema.$defs;
  }
  if (typeof schema.$ref === "string") schema.$ref = schema.$ref.replace(/^#\/\$defs\//u, "#/definitions/");
  if (schema.pattern === portableRelativePathPattern) {
    replacePatternWithAllOf(schema, [
      { pattern: "^[^\\s\\\\/\\x00]" },
      { pattern: "[^\\s\\\\/\\x00]$" },
      { pattern: "^[^\\\\/\\x00]+$" },
      { not: { enum: [".", ".."] } },
    ]);
  } else if (schema.pattern === gitArtifactLocatorPattern) {
    const prefix = "git:(?:[a-f0-9]{40}|[a-f0-9]{64}):";
    replacePatternWithAllOf(schema, [
      { pattern: `^${prefix}[^/\\\\\r\n  ](?:[^\\\\\r\n  ]*[^/\\\\\r\n  ])?$` },
      { not: { pattern: `^${prefix}[A-Za-z]:` } },
      { not: { pattern: "//" } },
      { not: { pattern: `(?:^${prefix}|/)(?:\\.|\\.\\.)(?:/|$)` } },
    ]);
  }
  if (Object.hasOwn(schema, "const")) {
    if (schema.enum !== undefined) throw new Error("Canonical document schema defines both const and enum");
    schema.enum = [schema.const];
    delete schema.const;
  }
  // Draft 4's impossible schema preserves strictness while Taplo can attach an unknown-field error to that field.
  if (schema.additionalProperties === false) schema.additionalProperties = { not: {} };
  if (schema.propertyNames !== undefined) {
    const expected = { not: { const: reservedTomlNullKey } };
    const expectedStringNames = { allOf: [{ type: "string" }, expected] };
    const propertyNames = JSON.stringify(schema.propertyNames);
    if ((propertyNames !== JSON.stringify(expected) && propertyNames !== JSON.stringify(expectedStringNames)) || schema.not !== undefined) {
      throw new Error(`Canonical document schema contains an unsupported property-name constraint: ${propertyNames}`);
    }
    delete schema.propertyNames;
    schema.not = { required: [reservedTomlNullKey] };
  }
  for (const item of Object.values(schema)) convertToTaploDraft4(item);
}

const taploDraft4Keywords = new Set([
  "$ref", "$schema", "additionalItems", "additionalProperties", "allOf", "anyOf", "default",
  "definitions", "dependencies", "description", "enum", "exclusiveMaximum", "exclusiveMinimum",
  "format", "id", "items", "maxItems", "maxLength", "maxProperties", "maximum", "minItems",
  "minLength", "minProperties", "minimum", "multipleOf", "not", "oneOf", "pattern",
  "patternProperties", "properties", "required", "title", "type", "uniqueItems",
]);

/** Refuses to label a future schema Draft 4 when Taplo could silently ignore its semantics. */
function assertTaploDraft4Schema(value: unknown, location = "#"): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return;
  const schema = value as Record<string, unknown>;
  for (const key of Object.keys(schema)) {
    if (!taploDraft4Keywords.has(key)) throw new Error(`Editor schema contains unsupported Draft 4 keyword ${key} at ${location}`);
  }
  for (const keyword of ["additionalItems", "additionalProperties", "items", "not"] as const) {
    const child = schema[keyword];
    if (child !== undefined && typeof child === "object" && child !== null && !Array.isArray(child)) {
      assertTaploDraft4Schema(child, `${location}/${keyword}`);
    }
  }
  if (Array.isArray(schema.items)) {
    schema.items.forEach((child, index) => assertTaploDraft4Schema(child, `${location}/items/${index}`));
  }
  for (const keyword of ["allOf", "anyOf", "oneOf"] as const) {
    const children = schema[keyword];
    if (Array.isArray(children)) children.forEach((child, index) => assertTaploDraft4Schema(child, `${location}/${keyword}/${index}`));
  }
  for (const keyword of ["definitions", "dependencies", "patternProperties", "properties"] as const) {
    const children = schema[keyword];
    if (children === null || typeof children !== "object" || Array.isArray(children)) continue;
    for (const [name, child] of Object.entries(children)) {
      if (keyword === "dependencies" && Array.isArray(child)) continue;
      assertTaploDraft4Schema(child, `${location}/${keyword}/${name}`);
    }
  }
}

export function canonicalEditorSchemaRelativePath(kind: CanonicalKind): string {
  return `.projector/schemas/canonical-${kind}-v2.schema.json`;
}

function replacePatternWithAllOf(schema: Record<string, unknown>, constraints: readonly Record<string, unknown>[]): void {
  if (schema.allOf !== undefined) throw new Error(`Canonical document schema combines an unsupported pattern with allOf: ${String(schema.pattern)}`);
  delete schema.pattern;
  schema.allOf = constraints;
}

function transformNullSchemas(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (!Array.isArray(value) && (value as Record<string, unknown>).type === "null") {
    for (const key of Object.keys(value)) delete (value as Record<string, unknown>)[key];
    Object.assign(value, {
      type: "object",
      properties: { [reservedTomlNullKey]: { const: true } },
      required: [reservedTomlNullKey],
      additionalProperties: false,
    });
    return;
  }
  if (!Array.isArray(value) && (value as Record<string, unknown>).type === "object") {
    const objectSchema = value as Record<string, unknown>;
    const reservedNameRule = { not: { const: reservedTomlNullKey } };
    objectSchema.propertyNames = objectSchema.propertyNames === undefined
      ? reservedNameRule
      : { allOf: [objectSchema.propertyNames, reservedNameRule] };
  }
  for (const item of Object.values(value)) transformNullSchemas(item);
}

function isMissing(error: unknown): boolean {
  return isCode(error, "ENOENT");
}

function isCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
