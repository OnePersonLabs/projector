import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { link, mkdir, open, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

import { exportContractJsonSchemas } from "@projector/core";

import { RepositoryPathService } from "../security/repository-path.js";

export interface ProjectorEditorSchema {
  readonly relativePath: string;
  readonly contents: string;
}

export function createProjectorEditorSchemaBundle(): readonly ProjectorEditorSchema[] {
  const schemas = exportContractJsonSchemas();
  const selected = [
    [".projector/schemas/canonical-document-v2.schema.json", tomlEncodingSchema(schemas.CanonicalDocumentEnvelopeByKind)],
    [".projector/schemas/projector-config-v1.schema.json", schemas.PreparedProjectorConfig],
  ] as const;
  return selected.map(([relativePath, schema]) => {
    if (schema === undefined) throw new Error(`Core contract registry does not export the schema for ${relativePath}`);
    return Object.freeze({ relativePath, contents: `${JSON.stringify(schema, null, 2)}\n` });
  });
}

export async function installProjectorEditorSchemaBundle(repositoryRoot: string): Promise<void> {
  const paths = await RepositoryPathService.create(repositoryRoot);
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
    await mkdir(dirname(item.target), { recursive: true });
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
    } finally {
      if (handle !== undefined) await handle.close();
      await rm(temporary, { force: true });
    }
  }
}

/** Adapts the core JSON-value schema to the lossless, private TOML null encoding. */
function tomlEncodingSchema(schema: unknown): unknown {
  const encoded = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
  transformNullSchemas(encoded);
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

function transformNullSchemas(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (!Array.isArray(value) && (value as Record<string, unknown>).type === "null") {
    for (const key of Object.keys(value)) delete (value as Record<string, unknown>)[key];
    Object.assign(value, {
      type: "object",
      properties: { __projector_toml_null: { const: true } },
      required: ["__projector_toml_null"],
      additionalProperties: false,
    });
    return;
  }
  if (!Array.isArray(value) && (value as Record<string, unknown>).type === "object") {
    const objectSchema = value as Record<string, unknown>;
    const reservedNameRule = { not: { const: "__projector_toml_null" } };
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
