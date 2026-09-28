import {
  CanonicalDocumentEnvelopeSchema,
  CanonicalDocumentEnvelopeSchemasByKind,
  CanonicalDocumentWireSchemasByKind,
  ContentHashSchema,
  DerivedObservationBudget,
  ObservationBudget,
  ObservationError,
  PortableRelativePathSchema,
  StateBindingSchema,
  StateDigestSchema,
  authorizeRepositoryPath,
  canonicalJson,
  compileWriteAuthorization,
  exportContractJsonSchemas,
  hashFramedDomain,
  hashRootManifest,
  hydrateCanonicalDocumentWire,
  parseCanonicalJson,
  parseProjectorConfig,
  projectorConfigApiVersion,
  toCanonicalDocumentWire
} from "./shared-ZRBELDV4.js";

// node_modules/@projector/runtime/dist/persistence/canonical-repository.js
import { createHash, randomBytes as randomBytes2 } from "node:crypto";
import { constants as constants2, createReadStream } from "node:fs";
import { lstat as lstat3, mkdir as mkdir2, open as open2, opendir, readFile as readFile2, rename, rm as rm2 } from "node:fs/promises";
import { dirname as dirname2, join as join3, relative as relative2 } from "node:path";

// node_modules/@projector/runtime/dist/persistence/toml-codec.js
import { parse, stringify, TomlError } from "smol-toml";
var nullMarkerKey = "__projector_toml_null";
var readableProseKeys = /* @__PURE__ */ new Set([
  "compensationPlan",
  "conclusion",
  "decision",
  "description",
  "explanation",
  "influence",
  "purpose",
  "question",
  "rationale",
  "reason",
  "rollbackPlan",
  "statement"
]);
var readableProseColumn = 100;
function assertJsonCompatible(value, path = "$") {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error(`unsupported TOML value at ${path}: non-finite number`);
    return;
  }
  if (typeof value === "bigint")
    throw new Error(`unsupported TOML value at ${path}: bigint`);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonCompatible(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === "object" && !(value instanceof Date)) {
    for (const [key, item] of Object.entries(value))
      assertJsonCompatible(item, `${path}.${key}`);
    return;
  }
  throw new Error(`unsupported TOML value at ${path}: ${value instanceof Date ? "date" : typeof value}`);
}
function parseTomlDocument(source, path = "TOML document") {
  try {
    const value = parse(source.replaceAll("\r\n", "\n"), { integersAsBigInt: "asNeeded" });
    const decoded = decodeNulls(value);
    if (decoded === null)
      throw new Error("a TOML document root cannot be null");
    assertJsonCompatible(decoded);
    return decoded;
  } catch (error) {
    if (error instanceof TomlError) {
      throw new Error(`invalid TOML at ${path}, line ${error.line}, column ${error.column}: ${error.message}`, { cause: error });
    }
    throw error;
  }
}
function stringifyTomlDocument(value, options = {}) {
  assertJsonCompatible(value);
  assertNoReservedNullMarkers(value);
  const schemaDirective = options.schemaPath === void 0 ? "" : schemaHeader(options.schemaPath);
  const encodable = encodeNulls(value);
  const reserved = /* @__PURE__ */ new Set();
  collectStrings(encodable, reserved);
  const replacements = [];
  const prepared = replaceMultilineStrings(encodable, reserved, replacements);
  let encoded = stringify(prepared);
  for (const replacement of replacements) {
    const quotedToken = JSON.stringify(replacement.token);
    const pieces = encoded.split(quotedToken);
    if (pieces.length !== 2)
      throw new Error("TOML multiline placeholder was not serialized exactly once");
    encoded = `${pieces[0]}${renderMultilineBasicString(replacement.value)}${pieces[1]}`;
  }
  return `${schemaDirective}${encoded.endsWith("\n") ? encoded : `${encoded}
`}`;
}
function encodeNulls(value) {
  if (value === null)
    return { [nullMarkerKey]: true };
  if (Array.isArray(value))
    return value.map(encodeNulls);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeNulls(item)]));
  }
  return value;
}
function decodeNulls(value) {
  if (Array.isArray(value))
    return value.map(decodeNulls);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (Object.hasOwn(value, nullMarkerKey)) {
      if (entries.length !== 1 || value[nullMarkerKey] !== true) {
        throw new Error(`invalid reserved TOML null marker ${nullMarkerKey}`);
      }
      return null;
    }
    return Object.fromEntries(entries.map(([key, item]) => [key, decodeNulls(item)]));
  }
  return value;
}
function assertNoReservedNullMarkers(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoReservedNullMarkers(item, `${path}[${index}]`));
  } else if (value !== null && typeof value === "object") {
    if (Object.hasOwn(value, nullMarkerKey))
      throw new Error(`${nullMarkerKey} is reserved at ${path}`);
    for (const [key, item] of Object.entries(value))
      assertNoReservedNullMarkers(item, `${path}.${key}`);
  }
}
function schemaHeader(path) {
  const relativeSchemaPath = /^(?![A-Za-z][A-Za-z0-9+.-]*:)(?![/\\])(?:\.{1,2}\/|[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.json$/u;
  if (!relativeSchemaPath.test(path)) {
    throw new Error(`schemaPath must be a document-relative JSON schema path: ${path}`);
  }
  return `#:schema ${path}
`;
}
function collectStrings(value, collected) {
  if (typeof value === "string") {
    collected.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value)
      collectStrings(item, collected);
  } else if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      collected.add(key);
      collectStrings(item, collected);
    }
  }
}
function replaceMultilineStrings(value, reserved, replacements, key) {
  if (typeof value === "string" && (value.includes("\n") || shouldWrapProse(key, value))) {
    let suffix = replacements.length;
    let token = `__PROJECTOR_MULTILINE_${suffix.toString().padStart(8, "0")}__`;
    while (reserved.has(token)) {
      suffix += 1;
      token = `__PROJECTOR_MULTILINE_${suffix.toString().padStart(8, "0")}__`;
    }
    reserved.add(token);
    replacements.push({ token, value });
    return token;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceMultilineStrings(item, reserved, replacements, key));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([entryKey, item]) => [entryKey, replaceMultilineStrings(item, reserved, replacements, entryKey)]));
  }
  return value;
}
function shouldWrapProse(key, value) {
  return key !== void 0 && readableProseKeys.has(key) && value.length > readableProseColumn && value.includes(" ");
}
function renderMultilineBasicString(value) {
  let encoded = "";
  let column = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const code = character.charCodeAt(0);
    let fragment;
    if (character === "\n")
      fragment = index === 0 || index === value.length - 1 ? "\\n" : "\n";
    else if (character === "\\")
      fragment = "\\\\";
    else if (character === '"')
      fragment = '\\"';
    else if (character === "\b")
      fragment = "\\b";
    else if (character === "	")
      fragment = "\\t";
    else if (character === "\f")
      fragment = "\\f";
    else if (character === "\r")
      fragment = "\\r";
    else if (code < 32 || code === 127)
      fragment = `\\u${code.toString(16).padStart(4, "0")}`;
    else
      fragment = character;
    encoded += fragment;
    if (fragment === "\n")
      column = 0;
    else
      column += fragment.length;
    if (character === " " && column >= readableProseColumn && index < value.length - 1 && value[index + 1] !== " ") {
      encoded += "\\\n  ";
      column = 2;
    }
  }
  return `"""${encoded}"""`;
}

// node_modules/@projector/runtime/dist/persistence/project-schema-bundle.js
import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat as lstat2, mkdir, open, readFile, rm } from "node:fs/promises";
import { dirname, join as join2 } from "node:path";
import { z } from "zod";

// node_modules/@projector/runtime/dist/security/repository-path.js
import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, join, posix, relative, sep } from "node:path";
var PathSecurityError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "PathSecurityError";
    this.code = code;
  }
};
var RepositoryPathService = class _RepositoryPathService {
  root;
  constructor(root) {
    this.root = root;
  }
  static async create(root) {
    return new _RepositoryPathService(await realpath(root));
  }
  resolveRead(path, symlinks = "reject") {
    return this.resolve(path, symlinks);
  }
  resolveWrite(path, symlinks = "reject") {
    return this.resolve(path, symlinks);
  }
  async resolveScopedRead(path, scopes2, symlinks = "reject") {
    this.assertDeclaredScope(path, scopes2);
    return this.resolveRead(path, symlinks);
  }
  async resolveScopedWrite(path, scopes2, symlinks = "reject") {
    this.assertDeclaredScope(path, scopes2);
    return this.resolveWrite(path, symlinks);
  }
  canonicalize(path) {
    if (path.length === 0 || path.includes("\\") || path.includes("\0") || path.startsWith("/") || /^[A-Za-z]:/u.test(path) || /^\/{2}/u.test(path)) {
      throw new PathSecurityError("invalid-path", `Not a canonical repository path: ${path}`);
    }
    const normalized = posix.normalize(path);
    if (normalized === ".." || normalized.startsWith("../") || normalized !== path) {
      throw new PathSecurityError("root-escape", `Repository path escapes or is not normalized: ${path}`);
    }
    return normalized;
  }
  assertDeclaredScope(path, scopes2) {
    const canonicalPath2 = this.canonicalize(path);
    const allowed = scopes2.some((scope) => {
      const canonicalScope = this.canonicalize(scope);
      return canonicalScope === "." || canonicalPath2 === canonicalScope || canonicalPath2.startsWith(`${canonicalScope}/`);
    });
    if (!allowed) {
      throw new PathSecurityError("scope-refused", `${canonicalPath2} is outside the declared scope`);
    }
  }
  async resolve(path, symlinks) {
    const canonicalPath2 = this.canonicalize(path);
    const segments = canonicalPath2 === "." ? [] : canonicalPath2.split("/");
    let cursor = this.root;
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (segment === void 0) {
        throw new PathSecurityError("invalid-path", `Invalid repository path: ${path}`);
      }
      const candidate = join(cursor, segment);
      try {
        const status = await lstat(candidate);
        if (status.isSymbolicLink()) {
          if (symlinks === "reject") {
            throw new PathSecurityError("symlink-refused", `Symbolic links are not allowed for ${canonicalPath2}`);
          }
          try {
            cursor = await realpath(candidate);
          } catch (error) {
            if (isMissingPathError(error)) {
              throw new PathSecurityError("symlink-refused", `Dangling symbolic link is not allowed for ${canonicalPath2}`);
            }
            throw error;
          }
          this.assertInsideRoot(cursor, canonicalPath2);
        } else {
          cursor = candidate;
        }
      } catch (error) {
        if (isMissingPathError(error)) {
          cursor = join(cursor, ...segments.slice(index));
          this.assertInsideRoot(cursor, canonicalPath2);
          break;
        }
        throw error;
      }
    }
    this.assertInsideRoot(cursor, canonicalPath2);
    return { canonicalPath: canonicalPath2, realTarget: cursor };
  }
  assertInsideRoot(target, canonicalPath2) {
    const fromRoot = relative(this.root, target);
    if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
      throw new PathSecurityError("root-escape", `${canonicalPath2} resolves outside the governed root`);
    }
  }
};
function isMissingPathError(error) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

// node_modules/@projector/runtime/dist/persistence/project-schema-bundle.js
var editorSchemaBundle;
function createProjectorEditorSchemaBundle() {
  if (editorSchemaBundle !== void 0)
    return editorSchemaBundle;
  const schemas = exportContractJsonSchemas();
  const selected = [
    ...Object.entries(CanonicalDocumentWireSchemasByKind).map(([kind, schema]) => [
      `.projector/schemas/canonical-${kind}-v3.schema.json`,
      tomlEncodingSchema(z.toJSONSchema(schema, {
        target: "draft-2020-12",
        reused: "ref",
        cycles: "ref",
        io: "input"
      }))
    ]),
    [".projector/schemas/projector-config-v3.schema.json", taploDraft4Schema(schemas.PreparedProjectorConfig)]
  ];
  editorSchemaBundle = Object.freeze(selected.map(([relativePath, schema]) => {
    if (schema === void 0)
      throw new Error(`Core contract registry does not export the schema for ${relativePath}`);
    return Object.freeze({ relativePath, contents: `${JSON.stringify(schema, null, 2)}
` });
  }));
  return editorSchemaBundle;
}
async function installProjectorEditorSchemaBundle(repositoryRoot) {
  const paths = await RepositoryPathService.create(repositoryRoot);
  await ensureDurableDirectoryPath(paths.root, [".projector", "schemas"]);
  const prepared = await Promise.all(createProjectorEditorSchemaBundle().map(async (item) => {
    const target = (await paths.resolveWrite(item.relativePath)).realTarget;
    let existing;
    try {
      existing = await readFile(target, "utf8");
    } catch (error) {
      if (!isMissing(error))
        throw error;
    }
    if (existing !== void 0 && existing !== item.contents) {
      throw new Error(`${item.relativePath} differs from the installed Projector bundle`);
    }
    return { ...item, target, missing: existing === void 0 };
  }));
  for (const item of prepared) {
    if (!item.missing)
      continue;
    const temporary = join2(dirname(item.target), `.schema.${randomBytes(12).toString("hex")}.tmp`);
    let handle;
    try {
      handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 384);
      try {
        await handle.writeFile(item.contents, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
        handle = void 0;
      }
      try {
        await link(temporary, item.target);
      } catch (error) {
        if (!isCode(error, "EEXIST") || await readFile(item.target, "utf8") !== item.contents)
          throw error;
      }
      await syncDirectory(dirname(item.target));
    } finally {
      if (handle !== void 0)
        await handle.close();
      await rm(temporary, { force: true });
    }
  }
}
async function ensureDurableDirectoryPath(root, segments) {
  let current = root;
  for (const segment of segments) {
    const parent = current;
    current = join2(current, segment);
    try {
      await mkdir(current);
    } catch (error) {
      if (!isCode(error, "EEXIST"))
        throw error;
    }
    const status = await lstat2(current);
    if (status.isSymbolicLink() || !status.isDirectory())
      throw new Error(`${current} must be a real directory`);
    await syncDirectory(parent);
  }
}
async function syncDirectory(path) {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } catch (error) {
    if (!isCode(error, "EINVAL") && !isCode(error, "ENOTSUP") && !isCode(error, "EPERM"))
      throw error;
  } finally {
    await handle.close();
  }
}
function tomlEncodingSchema(schema) {
  const encoded = JSON.parse(JSON.stringify(schema));
  transformNullSchemas(encoded);
  convertToTaploDraft4(encoded, true);
  assertTaploDraft4Schema(encoded);
  const objectSchemas = Array.isArray(encoded.anyOf) ? encoded.anyOf : [encoded];
  if (objectSchemas.length === 0 || objectSchemas.some((candidate) => {
    if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate))
      return true;
    const properties = candidate.properties;
    return properties === null || typeof properties !== "object" || Array.isArray(properties);
  })) {
    throw new Error("Canonical document schema must expose strict object alternatives");
  }
  return encoded;
}
var reservedTomlNullKey = "__projector_toml_null";
var portableRelativePathPattern = "^(?!\\s)(?!.*\\s$)(?!\\.$)(?!\\.\\.$)[^\\\\/\\0]+$";
var gitArtifactLocatorPattern = "^git:(?:[a-f0-9]{40}|[a-f0-9]{64}):(?!\\/)(?![A-Za-z]:)(?!.*\\\\)(?!.*\\/\\/)(?!(?:\\.|\\.\\.)(?:\\/|$))(?!.*\\/(?:\\.|\\.\\.)(?:\\/|$))[^/](?:.*[^/])?$";
function taploDraft4Schema(schema) {
  const encoded = JSON.parse(JSON.stringify(schema));
  convertToTaploDraft4(encoded, true);
  assertTaploDraft4Schema(encoded);
  return encoded;
}
function convertToTaploDraft4(value, root = false) {
  if (value === null || typeof value !== "object")
    return;
  if (Array.isArray(value)) {
    for (const item of value)
      convertToTaploDraft4(item);
    return;
  }
  const schema = value;
  if (root)
    schema.$schema = "http://json-schema.org/draft-04/schema#";
  if (schema.$defs !== void 0) {
    if (schema.definitions !== void 0)
      throw new Error("Canonical document schema defines both $defs and definitions");
    schema.definitions = schema.$defs;
    delete schema.$defs;
  }
  if (typeof schema.$ref === "string")
    schema.$ref = schema.$ref.replace(/^#\/\$defs\//u, "#/definitions/");
  if (schema.pattern === portableRelativePathPattern) {
    replacePatternWithAllOf(schema, [
      { pattern: "^[^\\s\\\\/\\x00]" },
      { pattern: "[^\\s\\\\/\\x00]$" },
      { pattern: "^[^\\\\/\\x00]+$" },
      { not: { enum: [".", ".."] } }
    ]);
  } else if (schema.pattern === gitArtifactLocatorPattern) {
    const prefix = "git:(?:[a-f0-9]{40}|[a-f0-9]{64}):";
    replacePatternWithAllOf(schema, [
      { pattern: `^${prefix}[^/\\\\\r
\u2028\u2029](?:[^\\\\\r
\u2028\u2029]*[^/\\\\\r
\u2028\u2029])?$` },
      { not: { pattern: `^${prefix}[A-Za-z]:` } },
      { not: { pattern: "//" } },
      { not: { pattern: `(?:^${prefix}|/)(?:\\.|\\.\\.)(?:/|$)` } }
    ]);
  }
  if (Object.hasOwn(schema, "const")) {
    if (schema.enum !== void 0)
      throw new Error("Canonical document schema defines both const and enum");
    schema.enum = [schema.const];
    delete schema.const;
  }
  if (schema.additionalProperties === false)
    schema.additionalProperties = { not: {} };
  if (schema.propertyNames !== void 0) {
    const expected = { not: { const: reservedTomlNullKey } };
    const expectedStringNames = { allOf: [{ type: "string" }, expected] };
    const propertyNames = JSON.stringify(schema.propertyNames);
    if (propertyNames !== JSON.stringify(expected) && propertyNames !== JSON.stringify(expectedStringNames) || schema.not !== void 0) {
      throw new Error(`Canonical document schema contains an unsupported property-name constraint: ${propertyNames}`);
    }
    delete schema.propertyNames;
    schema.not = { required: [reservedTomlNullKey] };
  }
  for (const item of Object.values(schema))
    convertToTaploDraft4(item);
}
var taploDraft4Keywords = /* @__PURE__ */ new Set([
  "$ref",
  "$schema",
  "additionalItems",
  "additionalProperties",
  "allOf",
  "anyOf",
  "default",
  "definitions",
  "dependencies",
  "description",
  "enum",
  "exclusiveMaximum",
  "exclusiveMinimum",
  "format",
  "id",
  "items",
  "maxItems",
  "maxLength",
  "maxProperties",
  "maximum",
  "minItems",
  "minLength",
  "minProperties",
  "minimum",
  "multipleOf",
  "not",
  "oneOf",
  "pattern",
  "patternProperties",
  "properties",
  "required",
  "title",
  "type",
  "uniqueItems"
]);
function assertTaploDraft4Schema(value, location = "#") {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return;
  const schema = value;
  for (const key of Object.keys(schema)) {
    if (!taploDraft4Keywords.has(key))
      throw new Error(`Editor schema contains unsupported Draft 4 keyword ${key} at ${location}`);
  }
  for (const keyword of ["additionalItems", "additionalProperties", "items", "not"]) {
    const child = schema[keyword];
    if (child !== void 0 && typeof child === "object" && child !== null && !Array.isArray(child)) {
      assertTaploDraft4Schema(child, `${location}/${keyword}`);
    }
  }
  if (Array.isArray(schema.items)) {
    schema.items.forEach((child, index) => assertTaploDraft4Schema(child, `${location}/items/${index}`));
  }
  for (const keyword of ["allOf", "anyOf", "oneOf"]) {
    const children = schema[keyword];
    if (Array.isArray(children))
      children.forEach((child, index) => assertTaploDraft4Schema(child, `${location}/${keyword}/${index}`));
  }
  for (const keyword of ["definitions", "dependencies", "patternProperties", "properties"]) {
    const children = schema[keyword];
    if (children === null || typeof children !== "object" || Array.isArray(children))
      continue;
    for (const [name, child] of Object.entries(children)) {
      if (keyword === "dependencies" && Array.isArray(child))
        continue;
      assertTaploDraft4Schema(child, `${location}/${keyword}/${name}`);
    }
  }
}
function canonicalEditorSchemaRelativePath(kind) {
  return `.projector/schemas/canonical-${kind}-v3.schema.json`;
}
function replacePatternWithAllOf(schema, constraints) {
  if (schema.allOf !== void 0)
    throw new Error(`Canonical document schema combines an unsupported pattern with allOf: ${String(schema.pattern)}`);
  delete schema.pattern;
  schema.allOf = constraints;
}
function transformNullSchemas(value) {
  if (value === null || typeof value !== "object")
    return;
  if (!Array.isArray(value) && value.type === "null") {
    for (const key of Object.keys(value))
      delete value[key];
    Object.assign(value, {
      type: "object",
      properties: { [reservedTomlNullKey]: { const: true } },
      required: [reservedTomlNullKey],
      additionalProperties: false
    });
    return;
  }
  if (!Array.isArray(value) && value.type === "object") {
    const objectSchema = value;
    const reservedNameRule = { not: { const: reservedTomlNullKey } };
    objectSchema.propertyNames = objectSchema.propertyNames === void 0 ? reservedNameRule : { allOf: [objectSchema.propertyNames, reservedNameRule] };
  }
  for (const item of Object.values(value))
    transformNullSchemas(item);
}
function isMissing(error) {
  return isCode(error, "ENOENT");
}
function isCode(error, code) {
  return error instanceof Error && "code" in error && error.code === code;
}

// node_modules/@projector/runtime/dist/observation-scope.js
import { AsyncLocalStorage } from "node:async_hooks";
var scopes = new AsyncLocalStorage();
function currentObservationScope() {
  return scopes.getStore();
}
function withObservationScope(options, operation) {
  const existing = scopes.getStore();
  if (existing !== void 0) {
    if (options.signal === void 0 || options.signal === existing.signal)
      return operation(existing);
    const nested = { ...existing, signal: AbortSignal.any([existing.signal, options.signal]) };
    nested.signal.throwIfAborted();
    return scopes.run(nested, async () => {
      try {
        return await operation(nested);
      } catch (error) {
        nested.signal.throwIfAborted();
        throw error;
      }
    });
  }
  const budget = new ObservationBudget(options.limits);
  let active = true;
  const cleanups = /* @__PURE__ */ new Set();
  const scope = {
    budget,
    limits: budget.limits,
    deadline: budget.deadline,
    signal: options.signal ?? new AbortController().signal,
    isActive: () => active,
    registerCleanup: (cleanup) => {
      if (!active)
        throw new Error("Cannot retain resources in a completed observation scope");
      cleanups.add(cleanup);
    }
  };
  scope.signal.throwIfAborted();
  return scopes.run(scope, async () => {
    let value;
    const failures = [];
    try {
      value = await operation(scope);
    } catch (error) {
      failures.push(scope.signal.aborted ? scope.signal.reason : error);
    }
    active = false;
    const drained = await Promise.allSettled([...cleanups].map((cleanup) => cleanup()));
    failures.push(...drained.flatMap((result) => result.status === "rejected" ? [result.reason] : []));
    if (failures.length === 1)
      throw failures[0];
    if (failures.length > 1)
      throw new AggregateError(failures, "Observation and resource cleanup failed");
    return value;
  });
}

// node_modules/@projector/runtime/dist/persistence/markdown-canonical.js
import { fromMarkdown } from "mdast-util-from-markdown";
var markdownCanonicalKinds = Object.freeze([
  "concept",
  "requirement",
  "behavioral-scenario",
  "architecture-concern",
  "architecture-decision",
  "authority-record"
]);
var markdownKindSet = new Set(markdownCanonicalKinds);
var markdownFormatVersion = 3;
var envelopeFields = /* @__PURE__ */ new Set(["format", "apiVersion", "schemaVersion", "kind", "id", "key", "lifecycle", "metadata"]);
var appendixFields = /* @__PURE__ */ new Set([
  "origin",
  "provenance",
  "history",
  "alternatives",
  "vector",
  "activationReasons",
  "consequences",
  "appliedPreferences",
  "deferral",
  "scope",
  "realizations",
  "assumptions",
  "reconsiderWhen",
  "evidence",
  "evidenceRefreshPolicy"
]);
var detailsStart = "\n\n<details>\n<summary>Structured record details</summary>\n\n```toml\n";
var detailsEnd = "\n```\n</details>\n";
function isMarkdownCanonicalKind(kind) {
  return markdownKindSet.has(kind);
}
function parseCanonicalMarkdownDocument(source, path = "canonical Markdown document") {
  const { header, body } = splitFrontMatter(source, path);
  if (header.format !== markdownFormatVersion)
    throw new Error(`unsupported canonical Markdown format at ${path}: expected ${markdownFormatVersion}`);
  const kind = requiredString(header.kind, "kind", path);
  if (!isMarkdownCanonicalKind(kind))
    throw new Error(`canonical Markdown kind is not prose-led at ${path}: ${kind}`);
  for (const field of Object.keys(header)) {
    if (!envelopeFields.has(field))
      throw new Error(`canonical Markdown front matter has unowned field at ${path}: ${field}`);
  }
  const metadata = header.metadata === void 0 ? {} : objectField(header.metadata, "metadata", path);
  const { prose, details } = splitDetailsAppendix(body, path);
  const detailsMetadata = details === void 0 ? {} : objectField(parseTomlDocument(details, path), "details", path);
  for (const field of Object.keys(detailsMetadata)) {
    if (!appendixFields.has(field))
      throw new Error(`canonical Markdown details field is not permitted at ${path}: ${field}`);
    if (Object.hasOwn(metadata, field))
      throw new Error(`canonical Markdown field has both header and details owners at ${path}: ${field}`);
  }
  const parsedBody = parseMarkdownBody(prose, kind, path);
  if (kind === "authority-record") {
    const titleSubject = parsedBody.__authorityTitleSubject;
    delete parsedBody.__authorityTitleSubject;
    if (titleSubject !== metadata.subjectId)
      throw new Error(`authority Markdown title does not match subjectId at ${path}`);
  }
  for (const field of Object.keys(parsedBody)) {
    if (Object.hasOwn(metadata, field) || Object.hasOwn(detailsMetadata, field))
      throw new Error(`canonical Markdown field has both body and metadata owners at ${path}: ${field}`);
  }
  const wire = {
    apiVersion: requiredString(header.apiVersion, "apiVersion", path),
    schemaVersion: requiredString(header.schemaVersion, "schemaVersion", path),
    kind,
    id: requiredString(header.id, "id", path),
    key: requiredString(header.key, "key", path),
    lifecycle: requiredString(header.lifecycle, "lifecycle", path),
    payload: { ...metadata, ...detailsMetadata, ...parsedBody }
  };
  const validated = CanonicalDocumentWireSchemasByKind[kind].parse(wire);
  hydrateCanonicalDocumentWire(validated);
  return validated;
}
function stringifyCanonicalMarkdownDocument(document) {
  const wire = toCanonicalDocumentWire(document);
  if (!isMarkdownCanonicalKind(wire.kind))
    throw new Error(`canonical kind is not prose-led Markdown: ${wire.kind}`);
  const { bodyFields, body } = renderMarkdownBody(wire, wire.kind);
  const metadata = { ...wire.payload };
  for (const field of bodyFields)
    delete metadata[field];
  const details = Object.fromEntries(Object.entries(metadata).filter(([field]) => appendixFields.has(field)));
  for (const field of Object.keys(details))
    delete metadata[field];
  return `+++
${stringifyTomlDocument({
    format: markdownFormatVersion,
    apiVersion: wire.apiVersion,
    schemaVersion: wire.schemaVersion,
    kind: wire.kind,
    id: wire.id,
    key: wire.key,
    lifecycle: wire.lifecycle,
    metadata
  })}+++

${body}${Object.keys(details).length === 0 ? "\n" : `${detailsStart}${stringifyTomlDocument(details)}${detailsEnd}`}`;
}
function splitDetailsAppendix(body, path) {
  const start = body.indexOf(detailsStart);
  if (start < 0)
    return { prose: body, details: void 0 };
  if (body.indexOf(detailsStart, start + detailsStart.length) >= 0)
    throw new Error(`canonical Markdown contains more than one details appendix at ${path}`);
  const end = body.indexOf(detailsEnd, start + detailsStart.length);
  if (end < 0 || body.slice(end + detailsEnd.length).trim() !== "")
    throw new Error(`canonical Markdown details appendix is malformed at ${path}`);
  return { prose: body.slice(0, start), details: body.slice(start + detailsStart.length, end) };
}
function splitFrontMatter(source, path) {
  const normalized = source.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("+++\n"))
    throw new Error(`canonical Markdown must start with +++ TOML front matter at ${path}`);
  const close = normalized.indexOf("\n+++\n", 4);
  if (close < 0)
    throw new Error(`canonical Markdown front matter is not closed at ${path}`);
  const parsed = parseTomlDocument(normalized.slice(4, close), path);
  if (!isObject(parsed))
    throw new Error(`canonical Markdown front matter must be an object at ${path}`);
  return { header: parsed, body: normalized.slice(close + "\n+++\n".length).replace(/^\n/u, "") };
}
function parseMarkdownBody(body, kind, path) {
  const headings = headingsFromMarkdown(fromMarkdown(body), body, path);
  if (headings.length === 0 || headings[0].level !== 1 || headings[0].start !== 0)
    throw new Error(`canonical Markdown requires one leading H1 title at ${path}`);
  if (headings.filter(({ level }) => level === 1).length !== 1)
    throw new Error(`canonical Markdown permits exactly one H1 title at ${path}`);
  if (headings.some(({ level }) => level > 2))
    throw new Error(`canonical Markdown does not permit headings below H2 at ${path}`);
  const title = headings[0].text;
  if (title.length === 0)
    throw new Error(`canonical Markdown title cannot be blank at ${path}`);
  const sections = sectionsAfterTitle(body, headings, path);
  if (kind === "concept")
    return { name: title, statement: singleBody(sections, path, kind) };
  if (kind === "requirement")
    return { title, statement: singleBody(sections, path, kind) };
  if (kind === "architecture-concern")
    return { title, question: singleBody(sections, path, kind) };
  if (kind === "architecture-decision")
    return { title, decision: singleNamedSection(sections, "Decision", path) };
  if (kind === "authority-record") {
    const subject = title.match(/^Authority for (.+)$/u)?.[1];
    if (subject === void 0 || subject.trim() === "")
      throw new Error(`authority Markdown title must be 'Authority for <subject ID>' at ${path}`);
    return { rationale: singleNamedSection(sections, "Rationale", path), __authorityTitleSubject: subject };
  }
  return { title, steps: scenarioSteps(sections, path) };
}
function renderMarkdownBody(wire, kind) {
  const payload = wire.payload;
  if (kind === "concept")
    return { bodyFields: ["name", "statement"], body: `# ${titleLine(payload.name, "concept name")}

${requiredBody(payload.statement, "concept statement")}` };
  if (kind === "requirement")
    return { bodyFields: ["title", "statement"], body: `# ${titleLine(payload.title, "requirement title")}

${requiredBody(payload.statement, "requirement statement")}` };
  if (kind === "architecture-concern")
    return { bodyFields: ["title", "question"], body: `# ${titleLine(payload.title, "concern title")}

${requiredBody(payload.question, "concern question")}` };
  if (kind === "architecture-decision")
    return { bodyFields: ["title", "decision"], body: `# ${titleLine(payload.title, "decision title")}

## Decision

${requiredBody(payload.decision, "decision")}` };
  if (kind === "authority-record")
    return { bodyFields: ["rationale"], body: `# Authority for ${titleLine(payload.subjectId, "authority subject ID")}

## Rationale

${requiredBody(payload.rationale, "authority rationale")}` };
  return { bodyFields: ["title", "steps"], body: `# ${titleLine(payload.title, "scenario title")}${scenarioBody(payload.steps)}` };
}
function headingsFromMarkdown(tree, body, path) {
  if (!isObject(tree) || tree.type !== "root" || !Array.isArray(tree.children))
    throw new Error(`Markdown parser did not produce a document root at ${path}`);
  const headings = [];
  for (const child of tree.children) {
    if (!isObject(child) || child.type !== "heading")
      continue;
    const position = child.position;
    if (typeof child.depth !== "number" || !isObject(position) || !isObject(position.start) || !isObject(position.end) || typeof position.start.offset !== "number" || typeof position.end.offset !== "number")
      throw new Error(`Markdown heading lacks source positions at ${path}`);
    const lineEnd = body.indexOf("\n", position.start.offset);
    const line = body.slice(position.start.offset, lineEnd < 0 ? body.length : lineEnd);
    const match = /^(#{1,2})[ \t]+(.+?)\s*$/u.exec(line);
    if (match === null || match[1].length !== child.depth)
      throw new Error(`canonical Markdown headings must use ATX H1 or H2 syntax at ${path}`);
    headings.push({ level: child.depth, text: match[2], start: position.start.offset, end: lineEnd < 0 ? body.length : lineEnd });
  }
  return headings.sort((left, right) => left.start - right.start);
}
function sectionsAfterTitle(body, headings, path) {
  const title = headings[0];
  const remaining = headings.slice(1);
  const firstStart = title.end + (body[title.end] === "\n" ? 1 : 0);
  if (remaining.length === 0)
    return [{ heading: void 0, text: normalizeBody(body.slice(firstStart), path) }];
  const beforeFirst = body.slice(firstStart, remaining[0].start).trim();
  if (beforeFirst !== "")
    throw new Error(`canonical Markdown prose before the first H2 is ambiguous at ${path}`);
  return remaining.map((heading, index) => {
    if (heading.level !== 2)
      throw new Error(`canonical Markdown section must be H2 at ${path}`);
    const start = heading.end + (body[heading.end] === "\n" ? 1 : 0);
    return { heading: heading.text, text: normalizeBody(body.slice(start, remaining[index + 1]?.start ?? body.length), path) };
  });
}
function singleBody(sections, path, kind) {
  if (sections.length !== 1 || sections[0].heading !== void 0)
    throw new Error(`${kind} Markdown cannot contain H2 sections at ${path}`);
  return sections[0].text;
}
function singleNamedSection(sections, expected, path) {
  if (sections.length !== 1 || sections[0].heading !== expected)
    throw new Error(`canonical Markdown requires exactly one '${expected}' H2 section at ${path}`);
  return sections[0].text;
}
function scenarioSteps(sections, path) {
  const roles = { Given: "precondition", When: "trigger", Then: "expected-outcome", "Must not": "forbidden-outcome" };
  if (sections.length === 0 || sections.some(({ heading, text }) => heading === void 0 || roles[heading] === void 0 || text === ""))
    throw new Error(`scenario Markdown requires nonempty Given, When, Then, or Must not sections at ${path}`);
  return sections.map(({ heading, text }) => ({ role: roles[heading], statement: text }));
}
function scenarioBody(value) {
  if (!Array.isArray(value) || value.length === 0)
    throw new Error("scenario steps must be a nonempty array");
  const headings = { precondition: "Given", trigger: "When", "expected-outcome": "Then", "forbidden-outcome": "Must not" };
  return value.map((step) => {
    if (!isObject(step) || typeof step.role !== "string" || headings[step.role] === void 0)
      throw new Error("scenario step has an unsupported role");
    return `

## ${headings[step.role]}

${requiredBody(step.statement, "scenario step")}`;
  }).join("");
}
function normalizeBody(value, path) {
  const result = value.trim();
  if (result === "")
    throw new Error(`canonical Markdown section cannot be blank at ${path}`);
  return result;
}
function requiredBody(value, label) {
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(`${label} must be nonblank prose`);
  return value.trim();
}
function titleLine(value, label) {
  if (typeof value !== "string" || value.trim() === "" || /[\r\n]/u.test(value))
    throw new Error(`${label} must be one nonblank line`);
  return value;
}
function requiredString(value, field, path) {
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(`canonical Markdown ${field} must be a nonblank string at ${path}`);
  return value;
}
function objectField(value, field, path) {
  if (!isObject(value))
    throw new Error(`canonical Markdown ${field} must be a TOML table at ${path}`);
  return value;
}
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// node_modules/@projector/runtime/dist/persistence/canonical-repository.js
var kindLocations = {
  concept: { directory: ["model", "concepts"], suffix: "concept", format: "markdown" },
  requirement: { directory: ["model", "requirements"], suffix: "requirement", format: "markdown" },
  "behavioral-scenario": { directory: ["model", "scenarios"], suffix: "scenario", format: "markdown" },
  relation: { directory: ["model", "relations"], suffix: "relation", format: "toml" },
  lineage: { directory: ["model", "lineage"], suffix: "lineage", format: "toml" },
  tombstone: { directory: ["model", "tombstones"], suffix: "tombstone", format: "toml" },
  rule: { directory: ["rules"], suffix: "rule", format: "toml" },
  "projection-lens": { directory: ["lenses"], suffix: "lens", format: "toml" },
  "semantic-representation-profile": { directory: ["representations"], suffix: "representation", format: "toml" },
  "authority-record": { directory: ["authorities"], suffix: "authority", format: "markdown" },
  "architecture-decision": { directory: ["decisions"], suffix: "decision", format: "markdown" },
  "architecture-concern": { directory: ["concerns"], suffix: "concern", format: "markdown" },
  "developer-preference": { directory: ["preferences"], suffix: "preference", format: "toml" },
  "transaction-receipt": { directory: ["receipts"], suffix: "receipt", format: "toml" },
  exception: { directory: ["exceptions"], suffix: "exception", format: "toml" },
  migration: { directory: ["migrations"], suffix: "migration", format: "toml" }
};
var canonicalApiVersion = "projector/v3";
var canonicalSchemaVersion = "3.0.0";
var derivedTopLevelDirectories = /* @__PURE__ */ new Set([
  "cache",
  "certificates",
  "generated",
  "plans",
  "reports"
]);
var operationalTopLevelDirectories = /* @__PURE__ */ new Set(["runtime", "task17-host-journals", "task17-sessions", "task17-capabilities", "task18-upgrades", "telemetry", "watch"]);
var operationalRootFiles = /* @__PURE__ */ new Set(["dogfood.json", "governance.json"]);
var readableIndexRootFiles = /* @__PURE__ */ new Set(["README.md", "INDEX.md"]);
function classifyCanonicalSource(relativePath, type) {
  const [topLevel] = relativePath.split("/");
  const name = relativePath.split("/").at(-1);
  if (topLevel !== void 0 && operationalTopLevelDirectories.has(topLevel))
    return "ignore";
  if (!relativePath.includes("/") && (operationalRootFiles.has(name) || readableIndexRootFiles.has(name)))
    return "ignore";
  if (type === "file" && topLevel === "receipts" && !name.endsWith(".receipt.json"))
    return "ignore";
  if (type === "symlink") {
    if (topLevel !== void 0 && derivedTopLevelDirectories.has(topLevel))
      return "ignore";
    throw new Error(`symlink canonical entry is not allowed: ${relativePath}`);
  }
  if (type === "directory")
    return "visit";
  if (name.endsWith(".toml") || name.endsWith(".md"))
    return "source";
  if (isLegacyCanonicalJson(relativePath))
    throw new Error(`legacy or mixed canonical JSON requires project readiness migration: ${relativePath}`);
  return "ignore";
}
async function canonicalSourceFiles(root, budget, signal) {
  const files = [];
  try {
    const rootStatus = await lstat3(root);
    if (rootStatus.isSymbolicLink() || !rootStatus.isDirectory()) {
      throw new Error(`canonical root must be a real directory: ${root}`);
    }
  } catch (error) {
    if (error.code === "ENOENT")
      return files;
    throw error;
  }
  const visit = async (directory) => {
    signal?.throwIfAborted();
    budget.consume("maxDirectories", 1, "canonical-enumeration", directory);
    const entries = await opendir(directory);
    for await (const entry of entries) {
      signal?.throwIfAborted();
      budget.check("canonical-enumeration", directory);
      const path = join3(directory, entry.name);
      const relativePath = relative2(root, path).replaceAll("\\", "/");
      const selection = classifyCanonicalSource(relativePath, entry.isSymbolicLink() ? "symlink" : entry.isDirectory() ? "directory" : "file");
      if (selection === "ignore")
        continue;
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile() && selection === "source") {
        budget.consume("maxFiles", 1, "canonical-enumeration", path);
        files.push(path);
      } else if (entry.isFile() && isLegacyCanonicalJson(relativePath)) {
        throw new Error(`legacy or mixed canonical JSON requires project readiness migration: ${path}`);
      }
    }
  };
  await visit(root);
  return files.sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
}
async function collectCanonicalSnapshotSources(repositoryRoot, budget = new ObservationBudget(), signal) {
  const canonicalRoot = join3(repositoryRoot, ".projector");
  const sources = [];
  for (const path of await canonicalSourceFiles(canonicalRoot, budget, signal)) {
    signal?.throwIfAborted();
    const status = await lstat3(path);
    if (!status.isFile() || status.isSymbolicLink())
      throw new Error(`canonical source is not a regular file: ${path}`);
    budget.assertFileBytes(status.size, path);
    budget.assertTotalBytes(status.size, path);
    const chunks = [];
    let bytes = 0;
    const stream = createReadStream(path, { highWaterMark: Math.min(64 * 1024, budget.limits.maxFileBytes, budget.remaining("maxTotalBytes") + 1), ...signal === void 0 ? {} : { signal } });
    try {
      for await (const chunk of stream) {
        const buffer = chunk;
        bytes += buffer.length;
        budget.assertFileBytes(bytes, path);
        budget.consume("maxTotalBytes", buffer.length, "canonical-read", path);
        chunks.push(buffer);
      }
    } finally {
      stream.destroy();
    }
    sources.push({ path, relativePath: relative2(canonicalRoot, path).replaceAll("\\", "/"), source: Buffer.concat(chunks, bytes).toString("utf8") });
  }
  return sources;
}
function parseCanonicalSnapshotSources(sources, derivedBudget = new DerivedObservationBudget()) {
  return parseCanonicalSnapshotSourcesWithLocators(sources, derivedBudget).snapshot;
}
function parseCanonicalSnapshotSourcesWithLocators(sources, derivedBudget) {
  const documents = [];
  const locators = [];
  for (const { path, relativePath, source } of sources) {
    if (relativePath === "config.toml") {
      try {
        withCanonicalParsingReservation(source, path, derivedBudget, () => parseProjectorConfig(parseTomlDocument(source, path)));
      } catch (error) {
        if (error instanceof ObservationError)
          throw error;
        throw new Error(`invalid Projector config at ${path}`, { cause: error });
      }
      continue;
    }
    const topLevel = relativePath.split("/")[0];
    const supportedKind = canonicalKindForPath(relativePath);
    if (supportedKind === void 0) {
      if (topLevel !== void 0 && derivedTopLevelDirectories.has(topLevel))
        continue;
      throw new Error(`unsupported canonical unknown kind at ${path}`);
    }
    const location = kindLocations[supportedKind];
    const extension = relativePath.endsWith(".md") ? "markdown" : "toml";
    if (location.format !== extension)
      throw new Error(`legacy or mixed canonical format requires one-time V3 cutover at ${path}`);
    derivedBudget.reserveItems(1, 128, "canonical-record", path);
    const document = withCanonicalParsingReservation(source, path, derivedBudget, () => parseEnvelope(source, path, location.format));
    if (document.kind !== supportedKind)
      throw new Error(`canonical kind/path conflict at ${path}: expected ${supportedKind}, found ${document.kind}`);
    documents.push(document);
    locators.push({ kind: supportedKind, id: document.id, path, relativePath, format: location.format });
  }
  documents.sort((left, right) => Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)) || Buffer.compare(Buffer.from(left.canonicalDocumentHash), Buffer.from(right.canonicalDocumentHash)));
  const keys = /* @__PURE__ */ new Map();
  for (const document of documents) {
    const owner = keys.get(document.key);
    if (owner !== void 0 && owner !== document.id)
      throw new Error(`duplicate canonical key ${document.key}: ${owner} and ${document.id}`);
    keys.set(document.key, document.id);
  }
  const entries = documents.map(({ id, canonicalDocumentHash }) => ({ entityId: id, canonicalDocumentHash }));
  return { snapshot: { documents, entries, rootDigest: hashRootManifest(entries) }, locators };
}
function canonicalKindForPath(relativePath) {
  const parts = relativePath.split("/");
  for (const [kind, location] of Object.entries(kindLocations)) {
    if (!location.directory.every((part, index) => parts[index] === part))
      continue;
    if (location.format === "markdown" && relativePath.endsWith(".md"))
      return kind;
    if (location.format === "toml" && relativePath.endsWith(".toml"))
      return kind;
    if (relativePath.endsWith(".md") || relativePath.endsWith(".toml"))
      return kind;
  }
  return void 0;
}
function withCanonicalParsingReservation(source, path, budget, parse3) {
  const temporaryBytes = 256 + source.length * 4;
  budget.reserve(temporaryBytes, "canonical-source-expansion", path);
  try {
    return parse3();
  } finally {
    budget.release(temporaryBytes);
  }
}
function isLegacyCanonicalJson(relativePath) {
  if (relativePath === "config.json")
    return true;
  return Object.values(kindLocations).some((location) => relativePath.endsWith(`.${location.suffix}.json`));
}
function parseEnvelope(source, path, format) {
  let parsed;
  try {
    parsed = format === "markdown" ? parseCanonicalMarkdownDocument(source, path) : parseTomlDocument(source, path);
  } catch (error) {
    throw new Error(`invalid canonical ${format} at ${path}`, { cause: error });
  }
  let document;
  try {
    document = hydrateCanonicalDocumentWire(parsed);
  } catch (error) {
    throw new Error(`invalid canonical document at ${path}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  assertSupportedCanonicalVersions(document, ` at ${path}`);
  return document;
}
function assertSupportedCanonicalVersions(document, location = "") {
  if (document.apiVersion !== canonicalApiVersion) {
    throw new Error(`unsupported canonical apiVersion ${document.apiVersion}${location}`);
  }
  if (document.schemaVersion !== canonicalSchemaVersion) {
    throw new Error(`unsupported canonical schemaVersion ${document.schemaVersion}${location}`);
  }
}
async function atomicWrite(path, contents) {
  const directory = dirname2(path);
  await ensureDurableCanonicalDirectory(directory);
  const temporaryPath = join3(directory, `.${randomBytes2(12).toString("hex")}.tmp`);
  let handle;
  try {
    handle = await open2(temporaryPath, constants2.O_CREAT | constants2.O_EXCL | constants2.O_WRONLY, 384);
    await handle.writeFile(contents, "utf8");
    await handle.sync();
    await handle.close();
    handle = void 0;
    await rename(temporaryPath, path);
    await syncCanonicalDirectory(directory);
  } finally {
    if (handle !== void 0)
      await handle.close();
    await rm2(temporaryPath, { force: true });
  }
}
async function syncCanonicalDirectory(directory) {
  const handle = await open2(directory, constants2.O_RDONLY);
  try {
    await handle.sync();
  } catch (error) {
    const code = error.code;
    if (code !== "EINVAL" && code !== "ENOTSUP" && code !== "EPERM")
      throw error;
  } finally {
    await handle.close();
  }
}
async function ensureDurableCanonicalDirectory(path) {
  const missing = [];
  let current = path;
  while (true) {
    try {
      const status = await lstat3(current);
      if (status.isSymbolicLink() || !status.isDirectory())
        throw new Error(`canonical path is not a real directory: ${current}`);
      break;
    } catch (error) {
      if (error.code !== "ENOENT")
        throw error;
      missing.push(current);
      const parent = dirname2(current);
      if (parent === current)
        throw new Error(`canonical path has no existing parent directory: ${path}`);
      current = parent;
    }
  }
  for (const directory of missing.reverse()) {
    const parent = dirname2(directory);
    try {
      await mkdir2(directory);
    } catch (error) {
      if (error.code !== "EEXIST")
        throw error;
    }
    const status = await lstat3(directory);
    if (status.isSymbolicLink() || !status.isDirectory())
      throw new Error(`canonical path is not a real directory: ${directory}`);
    await syncCanonicalDirectory(parent);
  }
}
var CanonicalFileRepository = class {
  repositoryRoot;
  canonicalRoot;
  constructor(repositoryRoot) {
    this.repositoryRoot = repositoryRoot;
    this.canonicalRoot = join3(repositoryRoot, ".projector");
  }
  pathForNew(kind, id, slug) {
    const location = kindLocations[kind];
    if (location.format === "markdown") {
      return join3(this.canonicalRoot, ...location.directory, `${slug}.md`);
    }
    const identityHash = createHash("sha256").update(id, "utf8").digest("hex");
    const readableIdentity = readableSlug(id);
    return join3(this.canonicalRoot, ...location.directory, `${readableIdentity}--${identityHash}.${location.suffix}.toml`);
  }
  async validateOwnedPath(path, kind, id) {
    await this.assertNoSymlinks(path);
    try {
      const existing = parseEnvelope(await readFile2(path, "utf8"), path, kindLocations[kind].format);
      if (existing.kind !== kind || existing.id !== id)
        throw new Error(`canonical path ${path} is owned by ${existing.id}`);
      return true;
    } catch (error) {
      if (error.code === "ENOENT")
        return false;
      throw error;
    }
  }
  async assertNoSymlinks(path) {
    const parts = relative2(this.canonicalRoot, path).split(/[\\/]/u).filter(Boolean);
    let current = this.canonicalRoot;
    for (const part of ["", ...parts]) {
      if (part !== "")
        current = join3(current, part);
      try {
        if ((await lstat3(current)).isSymbolicLink())
          throw new Error(`symlink canonical path is not allowed: ${current}`);
      } catch (error) {
        if (error.code === "ENOENT")
          continue;
        throw error;
      }
    }
  }
  prepareWrite(document, options = {}) {
    const kind = document.kind;
    if (!(kind in kindLocations))
      throw new Error(`unsupported canonical kind: ${document.kind}`);
    const result = CanonicalDocumentEnvelopeSchemasByKind[kind].safeParse(document);
    if (!result.success)
      throw new Error(`invalid canonical document: ${result.error.message}`);
    const normalized = result.data;
    assertSupportedCanonicalVersions(normalized);
    const slug = options.slug === void 0 ? documentTitleSlug(normalized) : readableSlug(options.slug);
    const path = options.existingPath ?? this.pathForNew(kind, normalized.id, slug);
    const format = kindLocations[kind].format;
    this.assertPreparedDestination(path, kind);
    const schemaPath = relative2(dirname2(path), join3(this.repositoryRoot, canonicalEditorSchemaRelativePath(kind))).replaceAll("\\", "/");
    return {
      path,
      contents: format === "markdown" ? stringifyCanonicalMarkdownDocument(normalized) : stringifyTomlDocument(toCanonicalDocumentWire(normalized), { schemaPath })
    };
  }
  assertPreparedDestination(path, kind) {
    const relativePath = relative2(this.canonicalRoot, path).replaceAll("\\", "/");
    const location = kindLocations[kind];
    const parts = relativePath.split("/");
    if (relativePath === "" || relativePath === ".." || relativePath.startsWith("../") || !location.directory.every((part, index) => parts[index] === part) || (location.format === "markdown" ? !relativePath.endsWith(".md") : !relativePath.endsWith(".toml"))) {
      throw new Error(`prepared canonical destination is outside the ${kind} family: ${path}`);
    }
  }
  async write(document) {
    const kind = document.kind;
    const existing = await this.locate(kind, document.id);
    const prepared = this.prepareWrite(document, existing === void 0 ? {} : { existingPath: existing.path });
    await this.validateOwnedPath(prepared.path, document.kind, document.id);
    await atomicWrite(prepared.path, prepared.contents);
    return prepared.path;
  }
  async read(kind, id) {
    const located = await this.locate(kind, id);
    if (located === void 0)
      return void 0;
    if (!await this.validateOwnedPath(located.path, kind, id))
      return void 0;
    const document = parseEnvelope(await readFile2(located.path, "utf8"), located.path, kindLocations[kind].format);
    if (document.kind !== kind || document.id !== id) {
      throw new Error(`canonical path lookup conflict at ${located.path}`);
    }
    return document;
  }
  async delete(kind, id) {
    const located = await this.locate(kind, id);
    if (located === void 0 || !await this.validateOwnedPath(located.path, kind, id))
      return false;
    await rm2(located.path);
    await syncCanonicalDirectory(dirname2(located.path));
    return true;
  }
  async locate(kind, id, limits = {}) {
    return (await this.locations(limits)).find((locator) => locator.kind === kind && locator.id === id);
  }
  /** A fresh operation-local index; callers must not retain it across mutations. */
  async locations(limits = {}) {
    const scope = currentObservationScope();
    const parsed = parseCanonicalSnapshotSourcesWithLocators(await collectCanonicalSnapshotSources(this.repositoryRoot, scope?.budget ?? new ObservationBudget(limits), scope?.signal), new DerivedObservationBudget(scope?.limits.maxDerivedBytes ?? limits.maxDerivedBytes));
    return parsed.locators;
  }
  async snapshot(limits = {}) {
    const scope = currentObservationScope();
    return parseCanonicalSnapshotSources(await collectCanonicalSnapshotSources(this.repositoryRoot, scope?.budget ?? new ObservationBudget(limits), scope?.signal), new DerivedObservationBudget(scope?.limits.maxDerivedBytes ?? limits.maxDerivedBytes));
  }
};
function compareCanonicalSnapshots(expected, actual) {
  const expectedById = new Map(expected.documents.map((document) => [document.id, document]));
  const actualById = new Map(actual.documents.map((document) => [document.id, document]));
  const ids = [.../* @__PURE__ */ new Set([...expectedById.keys(), ...actualById.keys()])].sort();
  const differences = [];
  for (const id of ids) {
    const left = expectedById.get(id);
    const right = actualById.get(id);
    if (left === void 0)
      differences.push({ id, message: "unexpected canonical document" });
    else if (right === void 0)
      differences.push({ id, message: "missing canonical document" });
    else if (canonicalJson(canonicalMeaning(left)) !== canonicalJson(canonicalMeaning(right)))
      differences.push({ id, message: "canonical meaning differs" });
  }
  return differences;
}
function canonicalMeaning(document) {
  const wire = toCanonicalDocumentWire(document);
  return { kind: wire.kind, id: wire.id, key: wire.key, lifecycle: wire.lifecycle, payload: wire.payload };
}
function readableSlug(value) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 96) || "entity";
}
function documentTitleSlug(document) {
  const payload = document.payload;
  const candidate = payload.name ?? payload.title ?? payload.subjectId ?? document.id;
  const title = readableSlug(typeof candidate === "string" ? candidate : document.id);
  const key = readableSlug(document.key);
  return title === key ? title : `${title.slice(0, 45)}--${key.slice(0, 48)}`;
}

// node_modules/@projector/runtime/dist/persistence/durable-artifact-set.js
import { createHash as createHash2, randomUUID } from "node:crypto";
import { constants as constants3 } from "node:fs";
import { link as link2, lstat as lstat4, mkdir as mkdir3, open as open3, opendir as opendir2, readdir, rename as rename2, rm as rm3 } from "node:fs/promises";
import { dirname as dirname3, join as join4, resolve } from "node:path";
var ArtifactSetIntegrityError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ArtifactSetIntegrityError";
  }
};
var ArtifactSetIncompleteError = class extends Error {
  artifactSetId;
  missingPaths;
  constructor(artifactSetId, missingPaths) {
    super(`Artifact set ${artifactSetId} is incomplete: ${missingPaths.join(", ")}`);
    this.artifactSetId = artifactSetId;
    this.missingPaths = missingPaths;
    this.name = "ArtifactSetIncompleteError";
  }
};
var RecoverableArtifactSetValidationError = class extends ArtifactSetIntegrityError {
};
var DurableArtifactSetStore = class {
  storageRoot;
  validateManifest;
  testHooks;
  explicitReadScope;
  constructor(storageRoot, validateManifest, testHooks = {}, explicitReadScope) {
    this.storageRoot = storageRoot;
    this.validateManifest = validateManifest;
    this.testHooks = testHooks;
    this.explicitReadScope = explicitReadScope;
    if (storageRoot.length === 0)
      throw new TypeError("A durable storage root is required");
  }
  async begin(input) {
    assertArtifactSetId(input.artifactSetId);
    await this.ensureLayout();
    if (await pathExists(this.temporarySetPath(input.artifactSetId))) {
      await assertTemporaryDirectoryClear(this.temporarySetPath(input.artifactSetId));
    }
    const current = await this.read(input.artifactSetId);
    if (current.status === "published") {
      throw new ArtifactSetIntegrityError(`Artifact set ${input.artifactSetId} is already published`);
    }
    if (current.status === "integrity-failed")
      throw new ArtifactSetIntegrityError(current.reason);
    if (await pathExists(this.finalizingPath(input.artifactSetId)))
      return { artifactSetId: input.artifactSetId };
    await ensureDurableDirectory(this.stagePath(input.artifactSetId), "staged artifact set");
    await ensureDurableDirectory(join4(this.stagePath(input.artifactSetId), "blobs"), "staged blob directory");
    return { artifactSetId: input.artifactSetId };
  }
  async stageBlob(input) {
    assertArtifactSetId(input.artifactSetId);
    assertBlobPath(input.path);
    if (await pathExists(this.publishedPath(input.artifactSetId))) {
      throw new ArtifactSetIntegrityError(`Artifact set ${input.artifactSetId} is already published`);
    }
    if (await pathExists(this.finalizingPath(input.artifactSetId))) {
      throw new ArtifactSetIntegrityError(`Artifact set ${input.artifactSetId} is already being finalized`);
    }
    const stage = this.stagePath(input.artifactSetId);
    await assertDirectory(stage, "staged artifact set");
    if (await pathExists(join4(stage, "manifest.bin"))) {
      throw new ArtifactSetIntegrityError(`Artifact set ${input.artifactSetId} is already being finalized`);
    }
    const blobRoot = join4(stage, "blobs");
    await assertDirectory(blobRoot, "staged blob directory");
    await ensureSafeParents(blobRoot, input.path);
    const target = join4(blobRoot, ...input.path.split("/"));
    const bytes = Buffer.from(input.bytes);
    const temporary = this.temporarySetPath(input.artifactSetId);
    await ensureDurableDirectory(temporary, "artifact-set temporary directory");
    try {
      await this.testHooks.beforeStageBlobTemporaryOpen?.();
      await writeDurableNewFile(target, bytes, temporary, this.testHooks.beforeStageBlobLink);
    } catch (error) {
      if (!isCode2(error, "EEXIST"))
        throw error;
      if (!(await readRegularFile(target, `staged blob ${input.path}`)).equals(bytes)) {
        throw new ArtifactSetIntegrityError(`Staged blob ${input.path} is immutable and has different bytes`);
      }
    }
    await syncDirectory2(dirname3(target));
  }
  async finalize(input) {
    assertArtifactSetId(input.artifactSetId);
    const manifest = await this.checkManifest(input.manifestBytes);
    await this.ensureLayout();
    const temporary = this.temporarySetPath(input.artifactSetId);
    await ensureDurableDirectory(temporary, "artifact-set temporary directory");
    await assertTemporaryDirectoryClear(temporary);
    const publishedPath = this.publishedPath(input.artifactSetId);
    if (await pathExists(publishedPath)) {
      const published2 = await this.read(input.artifactSetId);
      if (published2.status !== "published") {
        throw new ArtifactSetIntegrityError(published2.status === "integrity-failed" ? published2.reason : "Published artifact set is unavailable");
      }
      if (!Buffer.from(published2.manifestBytes).equals(manifest.manifestBytes)) {
        throw new ArtifactSetIntegrityError(`Artifact set ${input.artifactSetId} was published with a different manifest`);
      }
      return published2;
    }
    const stage = this.stagePath(input.artifactSetId);
    const finalizing = this.finalizingPath(input.artifactSetId);
    const stageExists = await pathExists(stage);
    const finalizingExists = await pathExists(finalizing);
    if (stageExists && finalizingExists) {
      throw new ArtifactSetIntegrityError(`Artifact set ${input.artifactSetId} has ambiguous staging and finalizing state`);
    }
    if (!stageExists && !finalizingExists)
      throw new ArtifactSetIncompleteError(input.artifactSetId, ["staging"]);
    if (!finalizingExists) {
      const stagedState = await this.read(input.artifactSetId);
      if (stagedState.status === "integrity-failed")
        throw new ArtifactSetIntegrityError(stagedState.reason);
      try {
        await rename2(stage, finalizing);
        await syncDirectory2(this.finalizingRoot());
        await syncDirectory2(this.stagingRoot());
      } catch (error) {
        if (!isCode2(error, "ENOENT") || !await pathExists(finalizing))
          throw error;
      }
    }
    const manifestPath = join4(finalizing, "manifest.bin");
    if (await pathExists(manifestPath) && !(await readRegularFile(manifestPath, "artifact manifest")).equals(manifest.manifestBytes)) {
      throw new ArtifactSetIntegrityError(`Artifact set ${input.artifactSetId} is being finalized with a different manifest`);
    }
    if (!await pathExists(manifestPath)) {
      try {
        await writeDurableNewFile(manifestPath, manifest.manifestBytes, temporary);
      } catch (error) {
        if (!isCode2(error, "EEXIST"))
          throw error;
        if (!(await readRegularFile(manifestPath, "artifact manifest")).equals(manifest.manifestBytes)) {
          throw new ArtifactSetIntegrityError(`Artifact set ${input.artifactSetId} is being finalized with a different manifest`);
        }
      }
    }
    await syncDirectory2(finalizing);
    try {
      await this.readCompleteSet(finalizing, input.artifactSetId);
    } catch (error) {
      if (error instanceof RecoverableArtifactSetValidationError) {
        await this.rollbackFinalizing(input.artifactSetId, manifest.manifestBytes);
      }
      throw error;
    }
    try {
      await rename2(finalizing, this.publishedPath(input.artifactSetId));
      await syncDirectory2(this.publishedRoot());
      await syncDirectory2(this.finalizingRoot());
    } catch (error) {
      if (!isCode2(error, "EEXIST") && !isCode2(error, "ENOTEMPTY") && !isCode2(error, "ENOENT"))
        throw error;
      const raced = await this.read(input.artifactSetId);
      if (raced.status === "published" && Buffer.from(raced.manifestBytes).equals(manifest.manifestBytes))
        return raced;
      throw new ArtifactSetIntegrityError(`Artifact set ${input.artifactSetId} could not be published atomically`);
    }
    const published = await this.read(input.artifactSetId);
    if (published.status !== "published") {
      throw new ArtifactSetIntegrityError(published.status === "integrity-failed" ? published.reason : `Published artifact set ${input.artifactSetId} disappeared`);
    }
    return published;
  }
  async resumeFinalize(artifactSetId) {
    assertArtifactSetId(artifactSetId);
    checkReadScope(this.readScope(), "artifact-recovery", artifactSetId);
    await this.ensureLayout();
    const current = await this.read(artifactSetId);
    if (current.status === "published")
      return current;
    if (current.status === "integrity-failed" && await pathExists(this.publishedPath(artifactSetId))) {
      throw new ArtifactSetIntegrityError(current.reason);
    }
    const finalizing = this.finalizingPath(artifactSetId);
    const manifestPath = join4(finalizing, "manifest.bin");
    if (!await pathExists(finalizing) || !await pathExists(manifestPath)) {
      throw new ArtifactSetIncompleteError(artifactSetId, ["finalizing/manifest.bin"]);
    }
    const manifestBytes = await readRegularFile(manifestPath, "artifact manifest", this.readScope());
    checkReadScope(this.readScope(), "artifact-recovery", artifactSetId);
    return this.finalize({ artifactSetId, manifestBytes });
  }
  async read(artifactSetId) {
    assertArtifactSetId(artifactSetId);
    const scope = this.readScope();
    checkReadScope(scope, "artifact-set", artifactSetId);
    const derivedBudget = scope?.derivedBudget ?? (scope === void 0 ? void 0 : new DerivedObservationBudget(scope.budget.limits.maxDerivedBytes));
    const publishedPath = this.publishedPath(artifactSetId);
    if (await pathExists(publishedPath)) {
      try {
        const value = await this.readCompleteSet(publishedPath, artifactSetId, scope, derivedBudget);
        checkReadScope(scope, "artifact-set", artifactSetId);
        return value;
      } catch (error) {
        rethrowReadInterruption(error, scope);
        return { status: "integrity-failed", artifactSetId, reason: errorMessage(error) };
      }
    }
    const stage = this.stagePath(artifactSetId);
    const finalizing = this.finalizingPath(artifactSetId);
    if (await pathExists(stage) && await pathExists(finalizing)) {
      checkReadScope(scope, "artifact-set", artifactSetId);
      return { status: "integrity-failed", artifactSetId, reason: "Artifact set has ambiguous staging and finalizing state" };
    }
    const incomplete = await pathExists(finalizing) ? finalizing : stage;
    if (!await pathExists(incomplete)) {
      checkReadScope(scope, "artifact-set", artifactSetId);
      return { status: "missing", artifactSetId };
    }
    try {
      const manifestPath = join4(incomplete, "manifest.bin");
      if (await pathExists(manifestPath))
        await this.readCompleteSet(incomplete, artifactSetId, scope, derivedBudget);
      else
        await collectStagedBlobs(incomplete, false, scope, derivedBudget);
      checkReadScope(scope, "artifact-set", artifactSetId);
      return { status: "incomplete", artifactSetId };
    } catch (error) {
      rethrowReadInterruption(error, scope);
      return { status: "integrity-failed", artifactSetId, reason: errorMessage(error) };
    }
  }
  async readCompleteSet(directory, artifactSetId, scope = this.readScope(), inheritedDerivedBudget) {
    checkReadScope(scope, "artifact-set", artifactSetId);
    await assertDirectory(directory, "artifact set");
    const derivedBudget = inheritedDerivedBudget ?? scope?.derivedBudget ?? (scope === void 0 ? void 0 : new DerivedObservationBudget(scope.budget.limits.maxDerivedBytes));
    const manifestBytes = await readRegularFile(join4(directory, "manifest.bin"), "artifact manifest", scope, derivedBudget);
    const manifest = await this.checkManifest(manifestBytes, scope, derivedBudget);
    const staged = await collectStagedBlobs(directory, true, scope, derivedBudget);
    assertExactDeclaredSet(artifactSetId, manifest.blobs, staged);
    verifyHashes(manifest.blobs, staged, scope);
    checkReadScope(scope, "artifact-set", artifactSetId);
    return {
      status: "published",
      artifactSetId,
      manifestBytes: manifest.manifestBytes,
      manifest: manifest.manifest,
      blobs: staged
    };
  }
  async checkManifest(bytes, scope = this.readScope(), derivedBudget) {
    checkReadScope(scope, "artifact-manifest", this.storageRoot);
    scope?.budget.assertFileBytes(bytes.byteLength, this.storageRoot);
    derivedBudget?.reserve(Math.min(Number.MAX_SAFE_INTEGER, bytes.byteLength * 3 + 256), "artifact-manifest", this.storageRoot);
    const manifestBytes = Buffer.from(bytes);
    const validated = await this.validateManifest(Buffer.from(manifestBytes));
    if (typeof validated !== "object" || validated === null || !Array.isArray(validated.blobs)) {
      throw new TypeError("Manifest validator must return a manifest and blob declarations");
    }
    const seen = /* @__PURE__ */ new Set();
    for (const declaration of validated.blobs) {
      if (typeof declaration !== "object" || declaration === null)
        throw new TypeError("Invalid blob declaration");
      assertBlobPath(declaration.path);
      if (!/^[0-9a-f]{64}$/u.test(declaration.sha256)) {
        throw new TypeError(`Blob ${declaration.path} has an invalid lowercase SHA-256 hash`);
      }
      if (seen.has(declaration.path))
        throw new TypeError(`Duplicate blob declaration: ${declaration.path}`);
      for (const prior of seen)
        if (prior.startsWith(`${declaration.path}/`) || declaration.path.startsWith(`${prior}/`)) {
          throw new TypeError(`Blob paths conflict as file and directory: ${prior}, ${declaration.path}`);
        }
      seen.add(declaration.path);
      derivedBudget?.reserveString(declaration.path.length, "artifact-manifest", declaration.path);
      derivedBudget?.reserve(128, "artifact-manifest", declaration.path);
    }
    const blobs = Object.freeze(validated.blobs.map(({ path, sha256 }) => Object.freeze({ path, sha256 })));
    checkReadScope(scope, "artifact-manifest", this.storageRoot);
    return { manifestBytes, manifest: validated.manifest, blobs };
  }
  async ensureLayout() {
    await ensureDurableDirectory(this.storageRoot, "artifact storage root");
    await ensureDurableDirectory(this.stagingRoot(), "artifact staging directory");
    await ensureDurableDirectory(this.finalizingRoot(), "artifact finalization directory");
    await ensureDurableDirectory(this.publishedRoot(), "artifact publication directory");
    await ensureDurableDirectory(this.temporaryRoot(), "artifact temporary directory");
  }
  async rollbackFinalizing(artifactSetId, manifestBytes) {
    const scope = this.readScope();
    const finalizing = this.finalizingPath(artifactSetId);
    const manifestPath = join4(finalizing, "manifest.bin");
    try {
      if ((await readRegularFile(manifestPath, "artifact manifest", scope)).equals(manifestBytes)) {
        await rm3(manifestPath);
        await syncDirectory2(finalizing);
      }
      if (!await pathExists(this.stagePath(artifactSetId))) {
        await rename2(finalizing, this.stagePath(artifactSetId));
        await syncDirectory2(this.stagingRoot());
        await syncDirectory2(this.finalizingRoot());
      }
    } catch (error) {
      rethrowReadInterruption(error, scope);
    }
  }
  readScope() {
    return this.explicitReadScope ?? currentObservationScope();
  }
  stagingRoot() {
    return join4(this.storageRoot, "staging");
  }
  finalizingRoot() {
    return join4(this.storageRoot, "finalizing");
  }
  publishedRoot() {
    return join4(this.storageRoot, "published");
  }
  temporaryRoot() {
    return join4(this.storageRoot, "temporary");
  }
  temporarySetPath(id) {
    return join4(this.temporaryRoot(), id);
  }
  stagePath(id) {
    return join4(this.stagingRoot(), id);
  }
  finalizingPath(id) {
    return join4(this.finalizingRoot(), id);
  }
  publishedPath(id) {
    return join4(this.publishedRoot(), id);
  }
};
function assertExactDeclaredSet(artifactSetId, declarations, staged) {
  const declared = new Set(declarations.map(({ path }) => path));
  const missing = [...declared].filter((path) => !staged.has(path)).sort();
  const undeclared = [...staged.keys()].filter((path) => !declared.has(path)).sort();
  if (missing.length > 0 || undeclared.length > 0) {
    const parts = [
      ...missing.length === 0 ? [] : [`missing declared blobs: ${missing.join(", ")}`],
      ...undeclared.length === 0 ? [] : [`undeclared staged blobs: ${undeclared.join(", ")}`]
    ];
    throw new RecoverableArtifactSetValidationError(`Artifact set ${artifactSetId} does not match its manifest; ${parts.join("; ")}`);
  }
}
function verifyHashes(declarations, staged, scope) {
  for (const declaration of declarations) {
    checkReadScope(scope, "artifact-hash", declaration.path);
    const bytes = staged.get(declaration.path);
    if (bytes === void 0 || hash(bytes) !== declaration.sha256) {
      throw new RecoverableArtifactSetValidationError(`Blob ${declaration.path} failed its declared SHA-256 hash`);
    }
  }
}
async function collectStagedBlobs(directory, allowManifest = false, scope, derivedBudget) {
  checkReadScope(scope, "artifact-blobs", directory);
  scope?.budget.consume("maxDirectories", 1, "artifact-blobs", directory);
  await assertDirectory(directory, "artifact set");
  let foundBlobs = false;
  const entries = await opendir2(directory);
  for await (const entry of entries) {
    checkReadScope(scope, "artifact-blobs", directory);
    const status = await lstat4(join4(directory, entry.name));
    if (status.isSymbolicLink())
      throw new ArtifactSetIntegrityError(`Artifact set contains a symbolic link: ${entry.name}`);
    if (entry.name === "blobs" && status.isDirectory())
      foundBlobs = true;
    else if (!(allowManifest && entry.name === "manifest.bin" && status.isFile())) {
      throw new ArtifactSetIntegrityError(`Artifact set contains an unexpected entry: ${entry.name}`);
    }
  }
  checkReadScope(scope, "artifact-blobs", directory);
  if (!foundBlobs)
    return /* @__PURE__ */ new Map();
  const blobs = /* @__PURE__ */ new Map();
  await collectBlobDirectory(join4(directory, "blobs"), "", blobs, scope, derivedBudget);
  return blobs;
}
async function collectBlobDirectory(root, relative4, blobs, scope, derivedBudget) {
  const directory = relative4.length === 0 ? root : join4(root, ...relative4.split("/"));
  checkReadScope(scope, "artifact-blobs", directory);
  scope?.budget.consume("maxDirectories", 1, "artifact-blobs", directory);
  const entries = await opendir2(directory);
  for await (const entry of entries) {
    checkReadScope(scope, "artifact-blobs", directory);
    scope?.budget.check("artifact-blobs", entry.name);
    const path = relative4.length === 0 ? entry.name : `${relative4}/${entry.name}`;
    assertBlobPath(path);
    const absolute = join4(directory, entry.name);
    const status = await lstat4(absolute);
    if (status.isSymbolicLink())
      throw new ArtifactSetIntegrityError(`Artifact set contains a symbolic link: blobs/${path}`);
    if (status.isDirectory())
      await collectBlobDirectory(root, path, blobs, scope, derivedBudget);
    else if (status.isFile()) {
      const bytes = await readRegularFile(absolute, `blob ${path}`, scope, derivedBudget);
      derivedBudget?.reserveString(path.length, "artifact-blobs", path);
      derivedBudget?.reserve(128, "artifact-blobs", path);
      blobs.set(path, bytes);
    } else
      throw new ArtifactSetIntegrityError(`Artifact set contains a non-regular entry: blobs/${path}`);
  }
  checkReadScope(scope, "artifact-blobs", directory);
}
function assertArtifactSetId(value) {
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(value) || value.includes("/") || !PortableRelativePathSchema.safeParse(value).success) {
    throw new TypeError(`Invalid artifact set ID: ${value}`);
  }
}
function assertBlobPath(value) {
  if (!/^[a-z0-9][a-z0-9._/-]*$/u.test(value) || !PortableRelativePathSchema.safeParse(value).success) {
    throw new TypeError(`Invalid artifact blob path: ${value}`);
  }
}
async function ensureSafeParents(blobRoot, relativePath) {
  await assertDirectory(blobRoot, "staged blob directory");
  let current = blobRoot;
  for (const segment of relativePath.split("/").slice(0, -1)) {
    const parent = current;
    current = join4(current, segment);
    try {
      await mkdir3(current);
    } catch (error) {
      if (!isCode2(error, "EEXIST"))
        throw error;
    }
    await assertDirectory(current, "staged blob parent");
    await syncDirectory2(parent);
  }
}
async function ensureDurableDirectory(path, label) {
  const missing = [];
  let current = resolve(path);
  while (!await pathExists(current)) {
    missing.push(current);
    const parent = dirname3(current);
    if (parent === current)
      throw new ArtifactSetIntegrityError(`${label} has no existing parent directory`);
    current = parent;
  }
  await assertDirectory(current, label);
  for (const directory of missing.reverse()) {
    const parent = dirname3(directory);
    try {
      await mkdir3(directory);
    } catch (error) {
      if (!isCode2(error, "EEXIST"))
        throw error;
    }
    await assertDirectory(directory, label);
    await syncDirectory2(parent);
  }
}
async function assertTemporaryDirectoryClear(path) {
  await assertDirectory(path, "artifact-set temporary directory");
  const entries = await readdir(path, { withFileTypes: true });
  if (entries.length === 0)
    return;
  const locations = [];
  for (const entry of entries) {
    const target = join4(path, entry.name);
    const status = await lstat4(target);
    if (entry.isSymbolicLink() || !status.isFile() || !/^\.artifact-[0-9a-f-]{36}\.tmp$/u.test(entry.name)) {
      throw new ArtifactSetIntegrityError(`Artifact temporary directory contains an unsafe entry: ${target}`);
    }
    locations.push(target);
  }
  throw new ArtifactSetIntegrityError(`Artifact publication is blocked by active or interrupted temporary files: ${locations.sort().join(", ")}. Retry after active writers finish, or remove only these exact files after confirming no writer remains active.`);
}
async function assertDirectory(path, label) {
  const status = await lstat4(path);
  if (status.isSymbolicLink() || !status.isDirectory())
    throw new ArtifactSetIntegrityError(`${label} is not a regular directory`);
}
async function readRegularFile(path, label, scope, inheritedDerivedBudget) {
  checkReadScope(scope, "artifact-file", label);
  const handle = await open3(path, constants3.O_RDONLY | constants3.O_NOFOLLOW);
  try {
    const status = await handle.stat();
    if (!status.isFile())
      throw new ArtifactSetIntegrityError(`${label} is not a regular file`);
    if (scope === void 0)
      return await handle.readFile();
    scope.budget.consume("maxFiles", 1, "artifact-file", label);
    scope.budget.assertFileBytes(status.size, label);
    scope.budget.assertTotalBytes(status.size, label);
    const derivedBudget = inheritedDerivedBudget ?? new DerivedObservationBudget(scope.budget.limits.maxDerivedBytes);
    derivedBudget.reserve(Math.min(Number.MAX_SAFE_INTEGER, status.size * 2 + 128), "artifact-file", label);
    const chunks = [];
    let total = 0;
    const stream = handle.createReadStream({ autoClose: false, signal: scope.signal });
    try {
      for await (const chunk of stream) {
        checkReadScope(scope, "artifact-file", label);
        const bytes = Buffer.from(chunk);
        total += bytes.length;
        scope.budget.assertFileBytes(total, label);
        scope.budget.consume("maxTotalBytes", bytes.length, "artifact-file", label);
        if (total > status.size)
          derivedBudget.reserve((total - status.size) * 2, "artifact-file", label);
        chunks.push(bytes);
      }
    } finally {
      stream.destroy();
    }
    checkReadScope(scope, "artifact-file", label);
    if (total !== status.size)
      throw new ArtifactSetIntegrityError(`${label} changed while being read`);
    return Buffer.concat(chunks, total);
  } finally {
    await handle.close();
  }
}
async function writeDurableNewFile(path, bytes, temporaryRoot, beforeLink) {
  const temporary = join4(temporaryRoot, `.artifact-${randomUUID()}.tmp`);
  const handle = await open3(temporary, "wx");
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await beforeLink?.();
    await link2(temporary, path);
  } finally {
    await rm3(temporary, { force: true });
  }
}
function hash(bytes) {
  return createHash2("sha256").update(bytes).digest("hex");
}
async function pathExists(path) {
  try {
    await lstat4(path);
    return true;
  } catch (error) {
    if (isCode2(error, "ENOENT"))
      return false;
    throw error;
  }
}
async function syncDirectory2(path) {
  const handle = await open3(path, "r");
  try {
    await handle.sync();
  } catch (error) {
    if (!isCode2(error, "EINVAL") && !isCode2(error, "ENOTSUP") && !isCode2(error, "EPERM"))
      throw error;
  } finally {
    await handle.close();
  }
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function isCode2(error, code) {
  return error instanceof Error && "code" in error && error.code === code;
}
function checkReadScope(scope, stage, scopeName) {
  scope?.signal?.throwIfAborted();
  scope?.budget.check(stage, scopeName);
}
function rethrowReadInterruption(error, scope) {
  if (scope?.signal?.aborted)
    scope.signal.throwIfAborted();
  if (error instanceof ObservationError)
    throw error;
}

// node_modules/@projector/runtime/dist/sqlite/derived-store.js
import { mkdirSync } from "node:fs";
import { dirname as dirname4 } from "node:path";
import { DatabaseSync } from "node:sqlite";

// node_modules/@projector/runtime/dist/sqlite/migrations.js
var currentSqliteSchemaVersion = 1;
var migrationOne = `
  CREATE TABLE canonical_documents (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    canonical_key TEXT NOT NULL UNIQUE,
    lifecycle TEXT NOT NULL,
    semantic_hash TEXT NOT NULL,
    discovery_hash TEXT,
    canonical_document_hash TEXT NOT NULL,
    document_json TEXT NOT NULL,
    indexed_revision INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE entities (
    id TEXT PRIMARY KEY REFERENCES canonical_documents(id) ON DELETE CASCADE,
    entity_kind TEXT NOT NULL,
    source_class TEXT NOT NULL,
    status TEXT NOT NULL
  ) STRICT;

  CREATE TABLE requirements (
    id TEXT PRIMARY KEY REFERENCES canonical_documents(id) ON DELETE CASCADE,
    source_class TEXT NOT NULL,
    status TEXT NOT NULL
  ) STRICT;

  CREATE TABLE behavioral_scenarios (
    id TEXT PRIMARY KEY REFERENCES canonical_documents(id) ON DELETE CASCADE,
    source_class TEXT NOT NULL,
    status TEXT NOT NULL
  ) STRICT;

  CREATE TABLE relations (
    id TEXT PRIMARY KEY REFERENCES canonical_documents(id) ON DELETE CASCADE,
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    active INTEGER NOT NULL CHECK (active IN (0, 1))
  ) STRICT;
  CREATE INDEX relations_from_id ON relations(from_id);
  CREATE INDEX relations_to_id ON relations(to_id);

  CREATE TABLE lineage_records (
    id TEXT PRIMARY KEY REFERENCES canonical_documents(id) ON DELETE CASCADE,
    lineage_kind TEXT NOT NULL
  ) STRICT;

  CREATE TABLE tombstones (
    id TEXT PRIMARY KEY REFERENCES canonical_documents(id) ON DELETE CASCADE,
    entity_id TEXT NOT NULL,
    deleted_at_revision INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE governance_documents (
    id TEXT PRIMARY KEY REFERENCES canonical_documents(id) ON DELETE CASCADE,
    governance_kind TEXT NOT NULL
  ) STRICT;

  CREATE TABLE graph_state (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    revision INTEGER NOT NULL,
    canonical_root_digest TEXT
  ) STRICT;
  INSERT INTO graph_state(singleton, revision, canonical_root_digest) VALUES (1, 0, NULL);
`;
var sqliteMigrationSetHash = hashFramedDomain("projector-sqlite-migration-set:v1", [
  { version: 1, sql: migrationOne }
]);
function migrateSqlite(database) {
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY) STRICT;`);
    const row = database.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations").get();
    const version = row?.version ?? 0;
    if (version > currentSqliteSchemaVersion) {
      throw new Error(`state.db schema version ${version} is newer than supported version ${currentSqliteSchemaVersion}`);
    }
    if (version === 0) {
      database.exec(migrationOne);
      database.prepare("INSERT INTO schema_migrations(version) VALUES (?)").run(1);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

// node_modules/@projector/runtime/dist/sqlite/derived-store.js
function payloadOf(document) {
  return document.payload;
}
function requiredString2(payload, field) {
  const value = payload[field];
  if (typeof value !== "string")
    throw new Error(`canonical payload field ${field} must be a string`);
  return value;
}
var SqliteDerivedStore = class {
  path;
  database;
  constructor(path) {
    this.path = path;
    mkdirSync(dirname4(path), { recursive: true });
    this.database = new DatabaseSync(path, {
      allowExtension: false,
      defensive: true,
      enableDoubleQuotedStringLiterals: false,
      enableForeignKeyConstraints: true,
      timeout: 5e3
    });
    this.database.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA trusted_schema = OFF;
    `);
    try {
      migrateSqlite(this.database);
      this.database.exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;`);
      this.validateStoredState();
    } catch (error) {
      this.database.close();
      throw error;
    }
  }
  close() {
    this.database.close();
  }
  replaceCanonicalSnapshot(snapshot) {
    const computedDigest = hashRootManifest(snapshot.documents.map((document) => ({
      entityId: document.id,
      canonicalDocumentHash: document.canonicalDocumentHash
    })));
    if (computedDigest !== snapshot.rootDigest) {
      throw new Error(`canonical snapshot root mismatch: expected ${computedDigest}, received ${snapshot.rootDigest}`);
    }
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const nextRevision = this.revisionNumber() + 1;
      this.database.exec(`
        DELETE FROM entities;
        DELETE FROM requirements;
        DELETE FROM behavioral_scenarios;
        DELETE FROM relations;
        DELETE FROM lineage_records;
        DELETE FROM tombstones;
        DELETE FROM governance_documents;
        DELETE FROM canonical_documents;
      `);
      for (const document of snapshot.documents)
        this.insertDocument(document, nextRevision);
      this.database.prepare("UPDATE graph_state SET revision = ?, canonical_root_digest = ? WHERE singleton = 1").run(nextRevision, snapshot.rootDigest);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.revision();
  }
  applyCanonicalUpdate(document, rootDigest) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const nextRevision = this.revisionNumber() + 1;
      this.database.prepare("DELETE FROM canonical_documents WHERE id = ?").run(document.id);
      this.insertDocument(document, nextRevision);
      const computedDigest = this.indexedRootDigest();
      if (computedDigest !== rootDigest) {
        throw new Error(`canonical root mismatch: expected ${computedDigest}, received ${rootDigest}`);
      }
      this.database.prepare("UPDATE graph_state SET revision = ?, canonical_root_digest = ? WHERE singleton = 1").run(nextRevision, rootDigest);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.revision();
  }
  applyCanonicalDelete(id, rootDigest) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const nextRevision = this.revisionNumber() + 1;
      const result = this.database.prepare("DELETE FROM canonical_documents WHERE id = ?").run(id);
      if (result.changes !== 1)
        throw new Error(`canonical document ${id} is not indexed`);
      const computedDigest = this.indexedRootDigest();
      if (computedDigest !== rootDigest) {
        throw new Error(`canonical root mismatch: expected ${computedDigest}, received ${rootDigest}`);
      }
      this.database.prepare("UPDATE graph_state SET revision = ?, canonical_root_digest = ? WHERE singleton = 1").run(nextRevision, rootDigest);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.revision();
  }
  revision() {
    this.validateStoredState();
    const state = this.database.prepare("SELECT revision, canonical_root_digest AS rootDigest FROM graph_state WHERE singleton = 1").get();
    if (state === void 0 || state.rootDigest === null)
      throw new Error("state.db has not indexed a canonical snapshot");
    const count = this.database.prepare("SELECT COUNT(*) AS count FROM canonical_documents").get();
    return { revision: state.revision, rootDigest: state.rootDigest, documentCount: count?.count ?? 0 };
  }
  canonicalRows() {
    this.validateStoredState();
    return this.rawCanonicalRows();
  }
  rawCanonicalRows() {
    return this.database.prepare(`
      SELECT
        id,
        kind,
        canonical_key AS canonicalKey,
        lifecycle,
        semantic_hash AS semanticHash,
        discovery_hash AS discoveryHash,
        canonical_document_hash AS canonicalDocumentHash,
        document_json AS documentJson,
        indexed_revision AS indexedRevision
      FROM canonical_documents
      ORDER BY id, canonical_document_hash
    `).all();
  }
  relationCount() {
    this.validateStoredState();
    const row = this.database.prepare("SELECT COUNT(*) AS count FROM relations").get();
    return row?.count ?? 0;
  }
  logicalCounts() {
    this.validateStoredState();
    return this.database.prepare(`
      SELECT
        (SELECT COUNT(*) FROM entities) AS entities,
        (SELECT COUNT(*) FROM requirements) AS requirements,
        (SELECT COUNT(*) FROM behavioral_scenarios) AS behavioralScenarios,
        (SELECT COUNT(*) FROM relations) AS relations,
        (SELECT COUNT(*) FROM lineage_records) AS lineageRecords,
        (SELECT COUNT(*) FROM tombstones) AS tombstones,
        (SELECT COUNT(*) FROM governance_documents) AS governanceDocuments
    `).get();
  }
  securityPosture() {
    const foreignKeys = this.database.prepare("PRAGMA foreign_keys").get();
    const trustedSchema = this.database.prepare("PRAGMA trusted_schema").get();
    const integrity = this.database.prepare("PRAGMA integrity_check").get();
    this.database.exec("PRAGMA writable_schema = ON");
    const writableSchema = this.database.prepare("PRAGMA writable_schema").get();
    this.database.exec("PRAGMA writable_schema = OFF");
    return {
      foreignKeysEnabled: foreignKeys?.foreign_keys === 1,
      trustedSchemaDisabled: trustedSchema?.trusted_schema === 0,
      defensiveModeEnabled: writableSchema?.writable_schema === 0,
      integrity: integrity?.integrity_check ?? "unavailable"
    };
  }
  readCanonicalDocument(id) {
    this.validateStoredState();
    const row = this.database.prepare(`SELECT id, kind, canonical_key AS canonicalKey, lifecycle,
      semantic_hash AS semanticHash, discovery_hash AS discoveryHash,
      canonical_document_hash AS canonicalDocumentHash, document_json AS documentJson,
      indexed_revision AS indexedRevision FROM canonical_documents WHERE id = ?`).get(id);
    if (row === void 0)
      return void 0;
    return this.validateStoredRow(row, id);
  }
  validateStoredRow(row, requestedId = row.id) {
    const result = CanonicalDocumentEnvelopeSchema.safeParse(parseCanonicalJson(row.documentJson));
    if (!result.success)
      throw new Error(`corrupt canonical index row ${requestedId}: ${result.error.message}`);
    const document = result.data;
    assertSupportedCanonicalVersions(document);
    const mismatched = document.id !== requestedId || document.id !== row.id || document.kind !== row.kind || document.key !== row.canonicalKey || document.lifecycle !== row.lifecycle || document.semanticHash !== row.semanticHash || (document.discoveryHash ?? null) !== row.discoveryHash || document.canonicalDocumentHash !== row.canonicalDocumentHash || canonicalJson(document) !== row.documentJson;
    if (mismatched)
      throw new Error(`corrupt canonical index row ${requestedId}: envelope/column mismatch`);
    return document;
  }
  validateStoredState() {
    const state = this.database.prepare("SELECT revision, canonical_root_digest AS rootDigest FROM graph_state WHERE singleton=1").get();
    if (state === void 0)
      throw new Error("corrupt state.db: missing graph_state singleton");
    const rows = this.rawCanonicalRows();
    if (state.rootDigest === null) {
      if (state.revision !== 0 || rows.length !== 0)
        throw new Error("corrupt state.db: NULL canonical root after nonempty revision");
      return;
    }
    for (const row of rows)
      this.validateStoredRow(row);
    const actual = this.indexedRootDigest();
    if (actual !== state.rootDigest)
      throw new Error(`corrupt state.db canonical root mismatch: expected ${actual}, received ${state.rootDigest}`);
  }
  revisionNumber() {
    const row = this.database.prepare("SELECT revision FROM graph_state WHERE singleton = 1").get();
    if (row === void 0)
      throw new Error("state.db graph state is missing");
    return row.revision;
  }
  indexedRootDigest() {
    const rows = this.database.prepare(`
      SELECT id, canonical_document_hash AS canonicalDocumentHash
      FROM canonical_documents
    `).all();
    return hashRootManifest(rows.map((row) => ({
      entityId: row.id,
      canonicalDocumentHash: row.canonicalDocumentHash
    })));
  }
  insertDocument(document, revision) {
    const result = CanonicalDocumentEnvelopeSchema.safeParse(document);
    if (!result.success)
      throw new Error(`invalid canonical document ${document.id}: ${result.error.message}`);
    assertSupportedCanonicalVersions(document);
    this.database.prepare(`
      INSERT INTO canonical_documents(
        id, kind, canonical_key, lifecycle, semantic_hash, discovery_hash,
        canonical_document_hash, document_json, indexed_revision
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(document.id, document.kind, document.key, document.lifecycle, document.semanticHash, document.discoveryHash ?? null, document.canonicalDocumentHash, canonicalJson(document), revision);
    const payload = payloadOf(document);
    switch (document.kind) {
      case "concept":
        this.database.prepare("INSERT INTO entities(id, entity_kind, source_class, status) VALUES (?, ?, ?, ?)").run(document.id, requiredString2(payload, "kind"), requiredString2(payload, "sourceClass"), requiredString2(payload, "status"));
        break;
      case "requirement":
        this.database.prepare("INSERT INTO requirements(id, source_class, status) VALUES (?, ?, ?)").run(document.id, requiredString2(payload, "sourceClass"), requiredString2(payload, "status"));
        break;
      case "behavioral-scenario":
        this.database.prepare("INSERT INTO behavioral_scenarios(id, source_class, status) VALUES (?, ?, ?)").run(document.id, requiredString2(payload, "sourceClass"), requiredString2(payload, "status"));
        break;
      case "relation":
        this.database.prepare("INSERT INTO relations(id, from_id, to_id, relation_type, active) VALUES (?, ?, ?, ?, ?)").run(document.id, requiredString2(payload, "fromId"), requiredString2(payload, "toId"), requiredString2(payload, "type"), payload.active === true ? 1 : 0);
        break;
      case "lineage":
        this.database.prepare("INSERT INTO lineage_records(id, lineage_kind) VALUES (?, ?)").run(document.id, requiredString2(payload, "kind"));
        break;
      case "tombstone":
        this.database.prepare("INSERT INTO tombstones(id, entity_id, deleted_at_revision) VALUES (?, ?, ?)").run(document.id, requiredString2(payload, "entityId"), payload.deletedAtRevision);
        break;
      default:
        this.database.prepare("INSERT INTO governance_documents(id, governance_kind) VALUES (?, ?)").run(document.id, document.kind);
    }
  }
};

// node_modules/@projector/runtime/dist/sqlite/inspection.js
import { constants as constants4 } from "node:fs";
import { lstat as lstat5, mkdtemp, open as open4, rm as rm4 } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join as join5 } from "node:path";
import { DatabaseSync as DatabaseSync2 } from "node:sqlite";

// node_modules/@projector/runtime/dist/execution/command-executor.js
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
var ExecutionRefusedError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "ExecutionRefusedError";
    this.code = code;
  }
};
var ExecutionLimitError = class extends Error {
  limit;
  constructor(limit, message) {
    super(message);
    this.name = "ExecutionLimitError";
    this.limit = limit;
  }
};
var ExecutionCleanupError = class extends ExecutionLimitError {
  cleanupError;
  cleanup;
  constructor(limitError, cleanupError, cleanup) {
    super(limitError.limit, `${limitError.message}; owned process cleanup could not be confirmed`);
    this.name = "ExecutionCleanupError";
    this.cleanupError = cleanupError;
    this.cleanup = cleanup;
  }
};
var configuredHostAssumptions = {
  permissions: "configured-host",
  filesystemConfinement: false,
  networkDenial: false,
  hostileSameUserProtection: false
};
var StateBoundCommandExecutor = class {
  paths;
  bindingValidator;
  launcher;
  constructor(paths, bindingValidator, launcher) {
    this.paths = paths;
    this.bindingValidator = bindingValidator;
    this.launcher = launcher;
  }
  async execute(spec, authorization) {
    this.validateDeclaration(spec, authorization);
    const context = {
      repositoryRoot: this.paths.root,
      stateDigest: authorization.currentState,
      config: {},
      signal: authorization.signal
    };
    const binding = await this.bindingValidator.validate(authorization.boundState, authorization.currentState, context);
    if (binding.status !== "current" && (binding.status !== "rebound" || binding.rebound === void 0 || !sameState(binding.rebound.compiledAgainst, authorization.currentState))) {
      throw new ExecutionRefusedError("stale-binding", `Command ${spec.id} is bound to ${binding.status} state: ${binding.reasons.join("; ")}`);
    }
    let cwd;
    try {
      cwd = await this.paths.resolveScopedRead(spec.cwd, spec.readScope);
      await this.paths.resolveScopedRead(spec.cwd, authorization.allowedReadRoots);
      await Promise.all(spec.readScope.map(async (scope) => {
        const resolved = await this.paths.resolveScopedRead(scope, authorization.allowedReadRoots);
        return resolved.realTarget;
      }));
      await Promise.all(spec.writeScope.map(async (scope) => {
        const resolved = await this.paths.resolveScopedWrite(scope, authorization.allowedWriteRoots);
        return resolved.realTarget;
      }));
    } catch (error) {
      if (error instanceof PathSecurityError) {
        throw new ExecutionRefusedError("scope-refused", error.message);
      }
      throw error;
    }
    this.validateLauncherCapabilities(spec);
    const env = {};
    for (const key of spec.environmentKeys) {
      const value = authorization.environment[key];
      if (value !== void 0)
        env[key] = value;
    }
    const executable = spec.argv[0];
    if (executable === void 0) {
      throw new ExecutionRefusedError("invalid-command", `Command ${spec.id} has no executable`);
    }
    const observed = await this.launcher.launch({
      executable,
      args: spec.argv.slice(1),
      cwd: cwd.realTarget,
      env,
      timeoutMs: spec.timeoutMs,
      ...spec.cpuBudgetMs === void 0 ? {} : { cpuBudgetMs: spec.cpuBudgetMs },
      ...spec.memoryBudgetMb === void 0 ? {} : { memoryBudgetMb: spec.memoryBudgetMb },
      maxOutputBytes: authorization.maxOutputBytes,
      signal: authorization.signal
    });
    return {
      ...observed,
      authorization: {
        commandId: spec.id,
        readScope: [...spec.readScope],
        writeScope: [...spec.writeScope],
        requiresNetwork: spec.requiresNetwork,
        sideEffectClass: spec.sideEffectClass
      },
      hostAssumptions: configuredHostAssumptions
    };
  }
  validateDeclaration(spec, authorization) {
    if (!authorization.allowedCommandIds.includes(spec.id) || !authorization.declaredCommands.some((declared) => sameCommand(declared, spec))) {
      throw new ExecutionRefusedError("command-refused", `Command ${spec.id} does not match a plan-authorized declaration`);
    }
    if (spec.argv.length === 0 || spec.argv.some((argument) => argument.includes("\0"))) {
      throw new ExecutionRefusedError("invalid-command", `Command ${spec.id} has invalid argv`);
    }
    if (!isPositiveSafeInteger(spec.timeoutMs) || !isPositiveSafeInteger(authorization.maxOutputBytes) || spec.cpuBudgetMs !== void 0 && !isPositiveSafeInteger(spec.cpuBudgetMs) || spec.memoryBudgetMb !== void 0 && !isPositiveSafeInteger(spec.memoryBudgetMb)) {
      throw new ExecutionRefusedError("invalid-command", `Command ${spec.id} has invalid resource limits`);
    }
    if ((spec.sideEffectClass === "none" || spec.sideEffectClass === "read-only") && spec.writeScope.length > 0) {
      throw new ExecutionRefusedError("scope-refused", `Read-only command ${spec.id} declares write scope`);
    }
    if (spec.requiresNetwork && !authorization.allowNetwork) {
      throw new ExecutionRefusedError("network-refused", `Command ${spec.id} has no network grant`);
    }
    if (spec.sideEffectClass === "external-write" && !authorization.allowExternalWrites) {
      throw new ExecutionRefusedError("external-write-refused", `Command ${spec.id} has no external-write grant`);
    }
  }
  validateLauncherCapabilities(spec) {
    const capabilities = this.launcher.capabilities;
    if (spec.cpuBudgetMs !== void 0 && !capabilities.cpuLimits) {
      throw new ExecutionRefusedError("unsupported-resource-limit", "Host process launcher cannot enforce the requested CPU budget");
    }
    if (spec.memoryBudgetMb !== void 0 && !capabilities.memoryLimits) {
      throw new ExecutionRefusedError("unsupported-resource-limit", "Host process launcher cannot enforce the requested memory budget");
    }
  }
};
function sameCommand(left, right) {
  return left.id === right.id && sameStrings(left.argv, right.argv) && left.cwd === right.cwd && sameStrings(left.readScope, right.readScope) && sameStrings(left.writeScope, right.writeScope) && left.requiresNetwork === right.requiresNetwork && sameStrings(left.environmentKeys, right.environmentKeys) && left.sideEffectClass === right.sideEffectClass && Object.is(left.timeoutMs, right.timeoutMs) && Object.is(left.cpuBudgetMs, right.cpuBudgetMs) && Object.is(left.memoryBudgetMb, right.memoryBudgetMb);
}
function sameStrings(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function isPositiveSafeInteger(value) {
  return Number.isFinite(value) && Number.isSafeInteger(value) && value > 0;
}
function sameState(left, right) {
  return left.gitBase === right.gitBase && left.worktreeDigest === right.worktreeDigest && left.canonicalProjectorDigest === right.canonicalProjectorDigest && left.toolchainDigest === right.toolchainDigest && left.pinnedExternalSnapshotDigest === right.pinnedExternalSnapshotDigest;
}
var NativeProcessLauncher = class {
  capabilities = {
    cpuLimits: false,
    memoryLimits: false
  };
  launch(request) {
    return new Promise((resolve3, reject) => {
      const startedAt = performance.now();
      const windows = process.platform === "win32";
      const supervisor = fileURLToPath(new URL("../assets/windows-job-supervisor.ps1", import.meta.url));
      const developmentSupervisor = fileURLToPath(new URL("../../../../scripts/windows-job-supervisor.ps1", import.meta.url));
      const supervisorPath = existsSync(supervisor) ? supervisor : developmentSupervisor;
      if (windows && !existsSync(supervisorPath)) {
        reject(new Error(`Windows job supervisor is missing: ${supervisorPath}`));
        return;
      }
      const payload = windows ? Buffer.from(JSON.stringify({ file: request.executable, args: request.args, cwd: request.cwd }), "utf8").toString("base64") : "";
      const child = spawn(windows ? "powershell.exe" : request.executable, windows ? ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", supervisorPath, payload] : request.args, {
        cwd: request.cwd,
        env: request.env,
        detached: !windows,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
      });
      const stdout = [];
      const stderr = [];
      let outputBytes = 0;
      let limitError;
      let cleanup;
      const stopFor = (error) => {
        if (limitError === void 0) {
          limitError = error;
          cleanup = terminateOwnedProcessTree(child);
        }
      };
      const capture = (target, chunk) => {
        outputBytes += chunk.byteLength;
        if (outputBytes > request.maxOutputBytes) {
          stopFor(new ExecutionLimitError("output", `Process exceeded ${request.maxOutputBytes} output bytes`));
          return;
        }
        target.push(chunk);
      };
      child.stdout.on("data", (chunk) => capture(stdout, chunk));
      child.stderr.on("data", (chunk) => capture(stderr, chunk));
      const timeout = setTimeout(() => {
        stopFor(new ExecutionLimitError("timeout", `Process exceeded ${request.timeoutMs}ms`));
      }, request.timeoutMs);
      timeout.unref();
      const abort = () => stopFor(new ExecutionLimitError("aborted", "Process execution was aborted"));
      request.signal.addEventListener("abort", abort, { once: true });
      if (request.signal.aborted)
        abort();
      child.once("error", (error) => {
        clearTimeout(timeout);
        request.signal.removeEventListener("abort", abort);
        reject(error);
      });
      child.once("close", async (exitCode, signal) => {
        clearTimeout(timeout);
        request.signal.removeEventListener("abort", abort);
        if (limitError !== void 0) {
          try {
            if (cleanup === void 0)
              throw new Error("process limit was recorded without a cleanup attempt");
            const attempt = await cleanup;
            const observation = { ...attempt, rootExitObserved: true };
            if (observation.status === "unconfirmed") {
              reject(new ExecutionCleanupError(limitError, void 0, observation));
              return;
            }
          } catch (error) {
            reject(new ExecutionCleanupError(limitError, error, {
              rootProcessId: child.pid ?? -1,
              rootExitObserved: true,
              requested: process.platform === "win32" ? "windows-job-close" : "posix-process-group-sigkill",
              status: "unconfirmed",
              reason: error instanceof Error ? error.message : String(error)
            }));
            return;
          }
          reject(limitError);
          return;
        }
        if (windows && exitCode === 127 && Buffer.concat(stderr).toString("utf8").trim() === "PROJECTOR_SUPERVISOR_SPAWN_ERROR:ENOENT") {
          reject(Object.assign(new Error(`Executable was not found: ${request.executable}`), { code: "ENOENT" }));
          return;
        }
        resolve3({
          exitCode,
          signal,
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
          durationMs: performance.now() - startedAt
        });
      });
    });
  }
};
async function terminateOwnedProcessTree(child) {
  if (child.pid === void 0)
    throw new Error("spawned process has no owned process identifier");
  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH")
        throw error;
    }
    return {
      rootProcessId: child.pid,
      rootExitObserved: false,
      processGroupId: child.pid,
      requested: "posix-process-group-sigkill",
      status: "unconfirmed",
      reason: "The owned process group received SIGKILL, but descendants that escaped into another session cannot be confirmed absent."
    };
  }
  if (!child.kill("SIGKILL"))
    throw new Error("Windows job supervisor could not be terminated");
  return {
    rootProcessId: child.pid,
    rootExitObserved: false,
    requested: "windows-job-close",
    status: "reported-complete"
  };
}

// node_modules/@projector/runtime/dist/execution/packet-coordinator.js
var compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var unique = (values) => [...new Set(values)].sort(compare);
var selectorRoot = (value) => value.replace(/\\/gu, "/").replace(/^\.\//u, "").replace(/\/\*\*.*$/u, "").replace(/\*.*$/u, "").replace(/\/+$/u, "");
function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value))
      deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
function authenticateObservation(observed) {
  if (observed.contentHash !== hashFramedDomain("authenticated-packet-observation", observed.value))
    throw new Error("packet observation is unauthenticated");
  return observed.value;
}
var changedPaths = (before, after) => unique([...Object.keys(before.pathContentHashes), ...Object.keys(after.pathContentHashes)].filter((path) => before.pathContentHashes[path] !== after.pathContentHashes[path]).concat(after.renames.flatMap(({ from, to }) => [from, to]), after.deletedPaths));
var changedKeys = (left, right) => unique([...Object.keys(left), ...Object.keys(right)].filter((key) => canonicalJson(left[key]) !== canonicalJson(right[key])));
var impactBetween = (before, after) => ({ changedPaths: changedPaths(before, after), changedUnitIds: changedKeys(before.unitStates, after.unitStates), changedCanonicalIds: changedKeys(before.canonicalEntityHashes, after.canonicalEntityHashes), externalOperationIds: changedKeys(before.externalStateHashes, after.externalStateHashes), generatedOutputIds: changedKeys(before.generatedArtifactHashes, after.generatedArtifactHashes) });
var emptyImpact = () => ({ changedPaths: [], changedUnitIds: [], changedCanonicalIds: [], externalOperationIds: [], generatedOutputIds: [] });
function authenticate(input) {
  if (input.contentHash !== hashFramedDomain("authenticated-packet-execution", input.value))
    throw new Error("packet execution envelope is unauthenticated");
  const value = deepFreeze(structuredClone(input.value));
  if (value.approval.planHash !== hashFramedDomain("semantic-change-execution-plan", value.plan))
    throw new Error("plan approval does not bind this plan");
  if (value.approval.approvedRiskClass !== value.packets.reduce((risk, item) => risk > item.packet.risk.class ? risk : item.packet.risk.class, "R0"))
    throw new Error("approved risk does not match packet risk");
  const byId = /* @__PURE__ */ new Map();
  for (const item of value.packets) {
    if (item.packetHash !== hashFramedDomain("semantic-change-work-packet", item.packet) || item.capsuleHash !== hashFramedDomain("semantic-change-execution-capsule", item.capsule))
      throw new Error("packet or capsule hash mismatch");
    if (item.packet.planId !== value.plan.id || item.packet.capsuleId !== item.capsule.id || item.capsule.taskId !== item.packet.id || item.packet.boundState.dependencyDigest !== value.plan.boundState.dependencyDigest)
      throw new Error("packet relation or binding mismatch");
    if (byId.has(item.packet.id))
      throw new Error(`duplicate packet ${item.packet.id}`);
    const writeAuthorization = compileWriteAuthorization(item.capsule);
    if (!writeAuthorization.enforceable || !writeAuthorization.operationGranted) {
      throw new Error(`packet ${item.packet.id} has no enforceable write authorization: ${writeAuthorization.reasons.join("; ")}`);
    }
    byId.set(item.packet.id, Object.freeze({ ...item, writeAuthorization }));
  }
  if (unique(value.executionOrder).length !== value.executionOrder.length || canonicalJson(unique(value.executionOrder)) !== canonicalJson(unique(value.plan.packetIds)))
    throw new Error("execution order does not cover the plan exactly");
  for (const id of value.executionOrder)
    for (const dependency of byId.get(id)?.packet.dependencies ?? [])
      if (value.executionOrder.indexOf(dependency) >= value.executionOrder.indexOf(id)) {
        const current = byId.get(id)?.convergence;
        const prior = byId.get(dependency)?.convergence;
        if (current === void 0 || prior === void 0 || current.group !== prior.group || current.maximumIterations !== prior.maximumIterations || current.maximumIterations < 1)
          throw new Error("packet dependency SCC or order is unsafe");
      }
  const items = [...byId.values()];
  if (items.some(({ convergence }) => convergence !== void 0))
    throw new Error("bounded SCC execution requires a staging adapter before effects");
  for (let left = 0; left < items.length; left += 1)
    for (let right = left + 1; right < items.length; right += 1) {
      const a = items[left].capsule.allowedWrites;
      const b = items[right].capsule.allowedWrites;
      const roots = (grants) => grants.flatMap(({ selector }) => selector.op === "atom" && selector.field === "path" && typeof selector.value === "string" ? [selectorRoot(selector.value)] : []);
      const leftRoots = roots(a);
      const rightRoots = roots(b);
      if (leftRoots.some((root) => rightRoots.includes(root)))
        throw new Error("packet write selectors overlap");
    }
  return Object.freeze({ value, byId });
}
async function executePacketPlan(input, ports) {
  const { value: execution, byId } = authenticate(input);
  const lease = await ports.lease.acquire(execution.plan.id);
  const outputs = /* @__PURE__ */ new Map();
  const results = [];
  let totalIterations = 0;
  let finalObservation;
  const combinedUnitStates = {};
  const trustedValidations = [];
  const attemptedImpacts = [];
  const resultFor = async (status, recovery, failureSurprises = []) => {
    const combine = (impacts) => ({ changedPaths: unique(impacts.flatMap((item) => item.changedPaths)), changedUnitIds: unique(impacts.flatMap((item) => item.changedUnitIds)), changedCanonicalIds: unique(impacts.flatMap((item) => item.changedCanonicalIds)), externalOperationIds: unique(impacts.flatMap((item) => item.externalOperationIds)), generatedOutputIds: unique(impacts.flatMap((item) => item.generatedOutputIds)) });
    const combinedObserved = combine(results.map(({ observedImpact: observedImpact2 }) => observedImpact2));
    const observedImpact = { ...combinedObserved, changedUnitIds: unique([...combinedObserved.changedUnitIds, ...results.flatMap(({ packetId }) => byId.get(packetId)?.packet.unitIds ?? [])]) };
    const attemptedImpact = combine(attemptedImpacts);
    const changedUnitIds = observedImpact.changedUnitIds;
    const predicted = /* @__PURE__ */ new Set([...execution.plan.knownAffectedUnitIds, ...execution.plan.possibleFrontierUnitIds, ...execution.plan.unavailableSurfaceIds]);
    const observedIds = unique([...changedUnitIds, ...observedImpact.changedCanonicalIds, ...observedImpact.externalOperationIds, ...observedImpact.generatedOutputIds]);
    const observed = new Set(observedIds);
    const surprises = unique([...failureSurprises, ...observedIds.filter((id) => !predicted.has(id)).map((id) => `unexpected-observed-subject:${id}`), ...execution.plan.knownAffectedUnitIds.filter((id) => !observed.has(id)).map((id) => `predicted-unit-not-observed:${id}`)]);
    const finalState = finalObservation?.state ?? execution.plan.boundState.compiledAgainst;
    const reconciled = await ports.reconciliation.run({ plan: execution.plan, observedImpact, finalState });
    if (reconciled.contentHash !== hashFramedDomain("authenticated-plan-reconciliation", { planId: execution.plan.id, observedImpact, finalState, converged: reconciled.converged, iterations: reconciled.iterations }))
      throw new Error("plan reconciliation proof is unauthenticated");
    if (status === "completed" && !reconciled.converged)
      status = "partial";
    const certificate = { kind: "certificate", planId: execution.plan.id, planHash: execution.approval.planHash, status, packetArtifactHashes: results.map(({ artifactHash }) => artifactHash), observedImpact, attemptedImpact, surprises, reconciliationProofHash: reconciled.contentHash, recovery };
    const storedCertificate = await ports.artifacts.put(certificate);
    const expectedCertificateHash = hashFramedDomain("packet-execution-artifact", certificate);
    if (storedCertificate.contentHash !== expectedCertificateHash)
      throw new Error("stored plan certificate bytes do not match returned hash");
    const certificateHash = storedCertificate.contentHash;
    const receiptRequired = execution.plan.completionCriteria.requiredArtifacts.includes("receipt");
    let receiptHash;
    if (receiptRequired) {
      const receipt = { ...certificate, kind: "receipt", certificateHash };
      const storedReceipt = await ports.artifacts.put(receipt);
      if (storedReceipt.contentHash !== hashFramedDomain("packet-execution-artifact", receipt))
        throw new Error("stored plan receipt bytes do not match returned hash");
      receiptHash = storedReceipt.contentHash;
    }
    return { status, packetResults: Object.freeze([...results]), certificateHash, ...receiptHash === void 0 ? {} : { receiptHash }, reconciliation: { converged: reconciled.converged, iterations: reconciled.iterations }, observedImpact, attemptedImpact, surprises: Object.freeze([...surprises]), ...results.length === 0 ? {} : { lastCheckpoint: `checkpoint:${results.at(-1).packetId}` }, recovery };
  };
  const executeOne = async (packetId) => {
    const item = byId.get(packetId);
    if (item.packet.executionMode !== "deterministic") {
      const continuation = await ports.continuation?.read(packetId);
      if (continuation === void 0 || continuation.packetId !== packetId || continuation.capsuleHash !== item.capsuleHash || continuation.contentHash !== hashFramedDomain("authenticated-packet-continuation", { packetId: continuation.packetId, capsuleHash: continuation.capsuleHash, currentState: continuation.currentState, authorityProofHash: continuation.authorityProofHash }))
        throw new Error(`authenticated continuation required for ${packetId}`);
    }
    await lease.assertOwned();
    const predecessorOutputHashes = item.packet.dependencies.map((id) => outputs.get(id)).filter((hash2) => hash2 !== void 0);
    const missing = item.packet.dependencies.filter((id) => !outputs.has(id));
    if (missing.some((id) => byId.get(id)?.convergence?.group !== item.convergence?.group))
      throw new Error(`missing predecessor output for ${packetId}`);
    const currentness = await ports.currentness.validate({ packet: item.packet, capsule: item.capsule, predecessorOutputHashes });
    if (!currentness.valid)
      throw new Error(`packet ${packetId} is stale`);
    if (!await ports.authority.verify({ approval: execution.approval, subjectHash: execution.approval.planHash, currentState: currentness.currentState, risk: item.packet.risk.class }))
      throw new Error("plan approval lacks current authority");
    const before = authenticateObservation(await ports.observe.capture({ packet: item.packet, phase: "before" }));
    if (canonicalJson(before.state) !== canonicalJson(currentness.currentState))
      throw new Error("authoritative before observation does not match approved current state");
    const transaction = await ports.transaction.begin({ plan: execution.plan, packet: item.packet, currentState: currentness.currentState });
    let intent;
    let attemptedAfter;
    let attemptedImpact = emptyImpact();
    try {
      await lease.assertOwned();
      await transaction.apply();
      const effect = await ports.effect.run({ packet: item.packet, capsule: item.capsule });
      if (effect.author.contentHash !== hashFramedDomain("authenticated-effect-author", { source: effect.author.source, group: effect.author.group, packetId }))
        throw new Error("effect author provenance is unauthenticated");
      const after = authenticateObservation(await ports.observe.capture({ packet: item.packet, phase: "after" }));
      attemptedAfter = after;
      attemptedImpact = impactBetween(before, after);
      if (attemptedImpact.changedPaths.length > 0 || canonicalJson(before.state) !== canonicalJson(after.state))
        attemptedImpact = { ...attemptedImpact, changedUnitIds: unique([...attemptedImpact.changedUnitIds, ...item.packet.unitIds]) };
      attemptedImpacts.push(attemptedImpact);
      const authoritativePaths = attemptedImpact.changedPaths;
      const inPlanBoundary = (path) => execution.plan.boundary.some((boundary) => selectorRoot(path) === selectorRoot(boundary) || selectorRoot(path).startsWith(`${selectorRoot(boundary)}/`));
      if (authoritativePaths.some((path) => !inPlanBoundary(path) || !authorizeRepositoryPath(item.writeAuthorization, path).authorized))
        throw new Error(`packet ${packetId} widened plan/capsule scope`);
      const changedUnits = changedKeys(before.unitStates, after.unitStates);
      if (changedUnits.some((id) => !item.packet.unitIds.includes(id)))
        throw new Error(`packet ${packetId} changed an undeclared unit`);
      for (const [kind, left, right] of [["canonical", before.canonicalEntityHashes, after.canonicalEntityHashes], ["external", before.externalStateHashes, after.externalStateHashes], ["generated", before.generatedArtifactHashes, after.generatedArtifactHashes]])
        if (changedKeys(left, right).some((id) => !item.packet.unitIds.includes(id)))
          throw new Error(`packet ${packetId} changed undeclared ${kind} state`);
      const validationProofs = [...await ports.validate.run({ packet: item.packet, capsule: item.capsule, postState: after.state })];
      const packetTrusted = [];
      const proofIds = /* @__PURE__ */ new Set();
      const postStateHash = hashFramedDomain("packet-post-state", after.state);
      for (const proof of validationProofs) {
        const key = `${proof.validatorId}@${proof.validatorVersion}`;
        if (proofIds.has(key))
          throw new Error(`duplicate validator proof ${key}`);
        proofIds.add(key);
        const provenanceHash = hashFramedDomain("packet-validator-provenance", { validatorId: proof.validatorId, validatorVersion: proof.validatorVersion, authorSource: proof.authorSource, independenceGroup: proof.independenceGroup, evidenceLane: proof.evidenceLane, assurance: proof.assurance });
        if (proof.provenanceHash !== provenanceHash || proof.status !== "passed" || proof.postStateHash !== postStateHash || proof.invocationHash !== hashFramedDomain("packet-validator-invocation", { packetId, validatorId: proof.validatorId, validatorVersion: proof.validatorVersion, postStateHash, provenanceHash }))
          throw new Error(`validator ${key} did not prove the packet post-state`);
        const trust = await ports.validatorTrust.verify({ proof, packet: item.packet, postState: after.state });
        if (!trust.trusted)
          throw new Error(`validator ${key} is not registered/trusted`);
        const authenticatedProof = { ...proof, readonlySource: trust.authorSource, readonlyGroup: trust.independenceGroup, effectSource: effect.author.source, effectGroup: effect.author.group };
        trustedValidations.push(authenticatedProof);
        packetTrusted.push(authenticatedProof);
      }
      if (item.packet.validatorIds.some((id) => !validationProofs.some((proof) => proof.validatorId === id)) || item.packet.unitIds.some((id) => after.unitStates[id] === "invalid"))
        throw new Error("packet-local postcondition is not satisfied");
      if (item.capsule.completionContract.requireIndependentValidation && !packetTrusted.some((proof) => proof.readonlySource !== proof.effectSource && proof.readonlyGroup !== proof.effectGroup))
        throw new Error("packet-local independent validation is missing");
      Object.assign(combinedUnitStates, after.unitStates);
      finalObservation = after;
      intent = { status: "intent", planId: execution.plan.id, packetId, packetHash: item.packetHash, capsuleHash: item.capsuleHash, before, after, observedImpact: attemptedImpact, attemptedImpact, changedPaths: authoritativePaths, outputHash: effect.outputHash, validationProofs, currentnessProofHash: currentness.proofHash, recovery: "required" };
      await lease.assertOwned();
      const storedIntent = await ports.artifacts.put(intent);
      if (storedIntent.contentHash !== hashFramedDomain("packet-execution-artifact", intent))
        throw new Error("artifact intent was not durably bound");
      await lease.assertOwned();
      await transaction.commit();
      const success = { ...intent, status: "success", recovery: "not-required", lastCheckpoint: `checkpoint:${packetId}` };
      const stored = await ports.artifacts.put(success);
      if (stored.contentHash !== hashFramedDomain("packet-execution-artifact", success))
        throw new Error("success certificate was not durably bound");
      outputs.set(packetId, effect.outputHash);
      const priorIndex = results.findIndex(({ packetId: id }) => id === packetId);
      const row = { packetId, changedPaths: authoritativePaths, observedImpact: attemptedImpact, outputHash: effect.outputHash, artifactHash: stored.contentHash };
      if (priorIndex < 0)
        results.push(row);
      else
        results[priorIndex] = row;
    } catch (error) {
      let recovery = "rolled-back";
      try {
        await transaction.rollback();
      } catch {
        recovery = "required";
      }
      let rolledBack;
      try {
        rolledBack = authenticateObservation(await ports.observe.capture({ packet: item.packet, phase: "rollback" }));
        finalObservation = rolledBack;
      } catch {
        recovery = "required";
      }
      const durableImpact = rolledBack === void 0 ? emptyImpact() : impactBetween(before, rolledBack);
      const failure = { ...intent ?? { status: "failure", planId: execution.plan.id, packetId, packetHash: item.packetHash, capsuleHash: item.capsuleHash, before, changedPaths: [], validationProofs: [], currentnessProofHash: currentness.proofHash }, status: "failure", ...rolledBack === void 0 ? {} : { after: rolledBack }, ...attemptedAfter === void 0 ? {} : { attemptedAfter }, observedImpact: durableImpact, attemptedImpact, changedPaths: durableImpact.changedPaths, recovery, reason: error instanceof Error ? error.message : String(error), ...results.length === 0 ? {} : { lastCheckpoint: `checkpoint:${results.at(-1).packetId}` } };
      const storedFailure = await ports.artifacts.put(failure);
      if (storedFailure.contentHash !== hashFramedDomain("packet-execution-artifact", failure))
        recovery = "required";
      throw Object.assign(error instanceof Error ? error : new Error(String(error)), { packetFailure: true, recovery });
    }
  };
  try {
    const handledGroups = /* @__PURE__ */ new Set();
    for (const packetId of execution.executionOrder) {
      const convergence = byId.get(packetId)?.convergence;
      if (convergence === void 0) {
        totalIterations += 1;
        await executeOne(packetId);
        continue;
      }
      if (handledGroups.has(convergence.group))
        continue;
      handledGroups.add(convergence.group);
      const members = execution.executionOrder.filter((id) => byId.get(id)?.convergence?.group === convergence.group);
      let prior;
      let converged = false;
      for (let iteration = 1; iteration <= convergence.maximumIterations; iteration += 1) {
        totalIterations += 1;
        for (const member of members)
          await executeOne(member);
        const current = canonicalJson(members.map((id) => outputs.get(id)));
        if (current === prior) {
          converged = true;
          break;
        }
        prior = current;
      }
      if (!converged)
        throw new Error(`convergence group ${convergence.group} did not converge within its bound`);
    }
    const contract = execution.plan.completionCriteria;
    const assuranceRank = ["weak", "supporting", "strong", "exact"];
    if (contract.requiredUnitStates.some(({ unitId, state }) => combinedUnitStates[unitId] !== state) || contract.requiredValidators.some((id) => !trustedValidations.some((proof) => proof.validatorId === id)) || contract.requiredEvidenceLanes.some((lane) => !trustedValidations.some((proof) => proof.evidenceLane === lane)) || trustedValidations.every((proof) => assuranceRank.indexOf(proof.assurance) < assuranceRank.indexOf(contract.minimumValidationAssurance)) || contract.requireIndependentValidation && !trustedValidations.some((proof) => proof.readonlySource !== proof.effectSource && proof.readonlyGroup !== proof.effectGroup) || finalObservation !== void 0 && (finalObservation.unknownCount > contract.maximumUnknowns || finalObservation.divergenceCount > contract.maximumNewDivergences || contract.cleanWorkingTree && !finalObservation.cleanWorkingTree))
      throw new Error("combined final plan state does not satisfy CompletionContract");
    return await resultFor("completed", "not-required");
  } catch (error) {
    if (results.length > 0 || error instanceof Error && "packetFailure" in error)
      return await resultFor("partial", error.recovery ?? "required", [error instanceof Error ? error.message : String(error)]);
    throw error;
  } finally {
    await lease.release();
  }
}

// node_modules/@projector/runtime/dist/sqlite/inspection.js
var maximumDatabaseBytes = 256 * 1024 * 1024;
var maximumRowsPerTable = 25e4;
var inspectionTimeoutMs = 1e4;
var childSource = String.raw`
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.argv[1], { allowExtension:false, defensive:true, enableDoubleQuotedStringLiterals:false, enableForeignKeyConstraints:true, readOnly:true, timeout:5000 });
try {
  db.exec('PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;');
  const maxRows = Number(process.argv[2]);
  const maxBytes = Number(process.argv[3]);
  const pageCount = db.prepare('PRAGMA page_count').get().page_count;
  const pageSize = db.prepare('PRAGMA page_size').get().page_size;
  if (!Number.isSafeInteger(pageCount) || pageCount < 0 || !Number.isSafeInteger(pageSize) || pageSize < 512 || pageCount * pageSize > maxBytes) {
    throw new Error('state.db page allocation exceeds bounded inspection limit');
  }
  const count = (table) => { const n=db.prepare('SELECT COUNT(*) AS count FROM '+table).get().count; if(!Number.isSafeInteger(n)||n<0||n>maxRows) throw new Error(table+' exceeds bounded row limit'); };
  const tables=['schema_migrations','graph_state','canonical_documents','entities','requirements','behavioral_scenarios','relations','lineage_records','tombstones','governance_documents'];
  for (const table of tables) count(table);
  const integrity=db.prepare('PRAGMA integrity_check').get().integrity_check;
  if(integrity!=='ok') throw new Error('integrity check returned '+String(integrity));
  process.stdout.write(JSON.stringify({
    pageCount,pageSize,
    migrations:db.prepare('SELECT version FROM schema_migrations ORDER BY version').all(),
    schema:db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name,tbl_name").all(),
    graph:db.prepare('SELECT revision,canonical_root_digest AS rootDigest FROM graph_state WHERE singleton=1').get(),
    canonicalRows:db.prepare('SELECT id,kind,canonical_key AS canonicalKey,lifecycle,semantic_hash AS semanticHash,discovery_hash AS discoveryHash,canonical_document_hash AS canonicalDocumentHash,document_json AS documentJson,indexed_revision AS indexedRevision FROM canonical_documents ORDER BY id,canonical_document_hash').all(),
    logical:{
      entities:db.prepare('SELECT id,entity_kind,source_class,status FROM entities ORDER BY id').all(),requirements:db.prepare('SELECT id,source_class,status FROM requirements ORDER BY id').all(),
      behavioral_scenarios:db.prepare('SELECT id,source_class,status FROM behavioral_scenarios ORDER BY id').all(),relations:db.prepare('SELECT id,from_id,to_id,relation_type,active FROM relations ORDER BY id').all(),
      lineage_records:db.prepare('SELECT id,lineage_kind FROM lineage_records ORDER BY id').all(),tombstones:db.prepare('SELECT id,entity_id,deleted_at_revision FROM tombstones ORDER BY id').all(),
      governance_documents:db.prepare('SELECT id,governance_kind FROM governance_documents ORDER BY id').all()
    }
  }));
} finally { db.close(); }
`;
async function inspectExistingSqliteDerivedState(path, expectedRoot, options = {}) {
  const initial = await lstat5(path, { bigint: true }).catch((error) => isCode3(error, "ENOENT") ? void 0 : Promise.reject(error));
  if (initial === void 0)
    return { status: "absent" };
  assertBoundedRegular(initial, path);
  throwIfAborted(options.signal);
  const scratch = await mkdtemp(join5(tmpdir(), "projector-sqlite-inspection-"));
  try {
    await copyBounded(path, join5(scratch, basename(path)), options.afterSourcePreflight, options.signal);
    const rollbackJournal = `${path}-journal`;
    const rollbackJournalStatus = await lstat5(rollbackJournal, { bigint: true }).catch((error) => isCode3(error, "ENOENT") ? void 0 : Promise.reject(error));
    if (rollbackJournalStatus !== void 0) {
      throw new Error(`${rollbackJournal} exists; hot rollback-journal state cannot be inspected safely`);
    }
    const walPath = `${path}-wal`;
    const walStatus = await lstat5(walPath, { bigint: true }).catch((error) => isCode3(error, "ENOENT") ? void 0 : Promise.reject(error));
    if (walStatus !== void 0) {
      assertBoundedRegular(walStatus, walPath);
      await copyBounded(walPath, join5(scratch, `${basename(path)}-wal`), void 0, options.signal);
    }
    await assertSidecarStateUnchanged(rollbackJournal, void 0);
    await assertSidecarStateUnchanged(walPath, walStatus);
    const signal = options.signal ?? new AbortController().signal;
    const result = await (options.launcher ?? new NativeProcessLauncher()).launch({
      executable: process.execPath,
      args: [
        "--input-type=commonjs",
        "--eval",
        childSource,
        join5(scratch, basename(path)),
        String(maximumRowsPerTable),
        String(maximumDatabaseBytes)
      ],
      cwd: scratch,
      env: { PATH: process.env.PATH ?? "" },
      timeoutMs: inspectionTimeoutMs,
      maxOutputBytes: maximumDatabaseBytes,
      signal
    });
    if (result.exitCode !== 0) {
      throw new Error(`state.db bounded inspection failed: ${result.stderr || `exit ${String(result.exitCode)}`}`);
    }
    throwIfAborted(options.signal);
    return validateInspection(JSON.parse(result.stdout), expectedRoot);
  } finally {
    await rm4(scratch, { recursive: true, force: true });
  }
}
async function copyBounded(source, target, afterPreflight, signal) {
  const before = await lstat5(source, { bigint: true });
  assertBoundedRegular(before, source);
  await afterPreflight?.();
  const input = await open4(source, constants4.O_RDONLY | (constants4.O_NOFOLLOW ?? 0));
  try {
    const output = await open4(target, constants4.O_CREAT | constants4.O_EXCL | constants4.O_WRONLY, 384);
    try {
      const opened = await input.stat({ bigint: true });
      if (!sameIdentity(before, opened))
        throw new Error(`${source} changed identity before its inspection handle opened`);
      const buffer = Buffer.allocUnsafe(1024 * 1024);
      let copied = 0;
      while (true) {
        throwIfAborted(signal);
        const { bytesRead } = await input.read(buffer, 0, buffer.length, null);
        if (bytesRead === 0)
          break;
        copied += bytesRead;
        if (copied > maximumDatabaseBytes)
          throw new Error(`${source} grew beyond the bounded inspection limit`);
        await writeAll(output, buffer.subarray(0, bytesRead));
      }
      await output.sync();
      const afterHandle = await input.stat({ bigint: true });
      const afterPath = await lstat5(source, { bigint: true });
      if (!sameIdentity(opened, afterHandle) || !sameIdentity(opened, afterPath) || BigInt(copied) !== afterHandle.size) {
        throw new Error(`${source} changed during inspection snapshot creation`);
      }
    } finally {
      await output.close();
    }
  } finally {
    await input.close();
  }
}
async function assertSidecarStateUnchanged(path, expected) {
  const observed = await lstat5(path, { bigint: true }).catch((error) => isCode3(error, "ENOENT") ? void 0 : Promise.reject(error));
  if (expected === void 0 ? observed !== void 0 : observed === void 0 || !sameIdentity(expected, observed)) {
    throw new Error(`${path} changed while the inspection snapshot was created`);
  }
}
async function writeAll(output, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const written = await output.write(bytes, offset, bytes.length - offset, null);
    if (written.bytesWritten <= 0)
      throw new Error("state.db snapshot write made no progress");
    offset += written.bytesWritten;
  }
}
function assertBoundedRegular(status, label) {
  if (status.isSymbolicLink() || !status.isFile())
    throw new Error(`${label} must be a regular non-symlink file`);
  if (status.size > BigInt(maximumDatabaseBytes)) {
    throw new Error(`${label} exceeds the bounded ${maximumDatabaseBytes}-byte inspection limit`);
  }
}
function sameIdentity(a, b) {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size;
}
function validateInspection(value, expectedRoot) {
  if (!isRecord(value))
    throw new Error("state.db inspection returned malformed output");
  const inspection = value;
  if (!Number.isSafeInteger(inspection.pageCount) || inspection.pageCount < 0 || !Number.isSafeInteger(inspection.pageSize) || inspection.pageSize < 512 || inspection.pageCount * inspection.pageSize > maximumDatabaseBytes)
    throw new Error("state.db page allocation exceeds bounded inspection limit");
  if (canonicalJson(inspection.migrations.map(({ version }) => version)) !== canonicalJson([currentSqliteSchemaVersion])) {
    throw new Error("state.db schema migrations do not match released version");
  }
  if (canonicalJson(inspection.schema) !== canonicalJson(expectedSchema())) {
    throw new Error("state.db schema does not match the released SQLite migration set");
  }
  const graph = inspection.graph;
  if (graph === void 0 || !Number.isSafeInteger(graph.revision) || graph.revision < 0) {
    throw new Error("corrupt state.db: graph revision is invalid");
  }
  if (graph.rootDigest === null)
    throw new Error("state.db has not indexed a canonical snapshot");
  const documents = inspection.canonicalRows.map((row) => validateRow(row, graph.revision));
  const actual = hashRootManifest(inspection.canonicalRows.map((row) => ({
    entityId: row.id,
    canonicalDocumentHash: row.canonicalDocumentHash
  })));
  if (actual !== graph.rootDigest || graph.rootDigest !== expectedRoot) {
    throw new Error(`state.db canonical root mismatch: expected ${expectedRoot}, received ${graph.rootDigest}`);
  }
  validateLogical(inspection.logical, documents);
  return {
    status: "valid",
    schemaVersion: currentSqliteSchemaVersion,
    migrationSetHash: sqliteMigrationSetHash,
    canonicalRootDigest: graph.rootDigest,
    documentCount: documents.length
  };
}
var releasedSchema;
function expectedSchema() {
  if (releasedSchema !== void 0)
    return releasedSchema;
  const database = new DatabaseSync2(":memory:");
  try {
    migrateSqlite(database);
    releasedSchema = database.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name,tbl_name").all();
    return releasedSchema;
  } finally {
    database.close();
  }
}
function validateRow(row, revision) {
  const result = CanonicalDocumentEnvelopeSchema.safeParse(parseCanonicalJson(row.documentJson));
  if (!result.success)
    throw new Error(`corrupt canonical index row ${row.id}: ${result.error.message}`);
  const document = result.data;
  assertSupportedCanonicalVersions(document);
  if (document.id !== row.id || document.kind !== row.kind || document.key !== row.canonicalKey || document.lifecycle !== row.lifecycle || document.semanticHash !== row.semanticHash || (document.discoveryHash ?? null) !== row.discoveryHash || document.canonicalDocumentHash !== row.canonicalDocumentHash || canonicalJson(document) !== row.documentJson || !Number.isSafeInteger(row.indexedRevision) || row.indexedRevision < 1 || row.indexedRevision > revision)
    throw new Error(`corrupt canonical index row ${row.id}: envelope/column mismatch`);
  return document;
}
function validateLogical(actual, documents) {
  const expected = {
    entities: [],
    requirements: [],
    behavioral_scenarios: [],
    relations: [],
    lineage_records: [],
    tombstones: [],
    governance_documents: []
  };
  for (const document of documents) {
    const payload = document.payload;
    switch (document.kind) {
      case "concept":
        expected.entities.push({ id: document.id, entity_kind: payload.kind, source_class: payload.sourceClass, status: payload.status });
        break;
      case "requirement":
        expected.requirements.push({ id: document.id, source_class: payload.sourceClass, status: payload.status });
        break;
      case "behavioral-scenario":
        expected.behavioral_scenarios.push({ id: document.id, source_class: payload.sourceClass, status: payload.status });
        break;
      case "relation":
        expected.relations.push({ id: document.id, from_id: payload.fromId, to_id: payload.toId, relation_type: payload.type, active: payload.active === true ? 1 : 0 });
        break;
      case "lineage":
        expected.lineage_records.push({ id: document.id, lineage_kind: payload.kind });
        break;
      case "tombstone":
        expected.tombstones.push({ id: document.id, entity_id: payload.entityId, deleted_at_revision: payload.deletedAtRevision });
        break;
      default:
        expected.governance_documents.push({ id: document.id, governance_kind: document.kind });
    }
  }
  for (const [name, rows] of Object.entries(expected)) {
    if (canonicalJson(actual[name]) !== canonicalJson(rows)) {
      throw new Error(`corrupt state.db: ${name} does not match canonical documents`);
    }
  }
}
function throwIfAborted(signal) {
  if (signal?.aborted)
    throw signal.reason ?? new Error("SQLite inspection aborted");
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isCode3(error, code) {
  return error instanceof Error && "code" in error && error.code === code;
}

// node_modules/@projector/runtime/dist/sqlite/rebuild.js
async function rebuildDerivedStore(canonical, store) {
  return store.replaceCanonicalSnapshot(await canonical.snapshot());
}

// node_modules/@projector/runtime/dist/sqlite/observation-store.js
import { appendFileSync, mkdirSync as mkdirSync2 } from "node:fs";
import { dirname as dirname5, isAbsolute as isAbsolute3 } from "node:path";
import { threadId } from "node:worker_threads";
import { DatabaseSync as DatabaseSync3 } from "node:sqlite";
import { createHash as createHash3 } from "node:crypto";

// node_modules/@projector/runtime/dist/cache/derived-cache.js
var DERIVED_CACHE_MAX_BYTES = 256 * 1024 * 1024;
var DerivedCacheError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "DerivedCacheError";
  }
};
async function withDerivedCacheAdmission(root, body, options = {}) {
  return withIndexedCacheAdmission(root, body, options);
}
function classify(path) {
  const match = /^\.projector\/runtime\/(knowledge\/contexts\/[0-9a-f]{32}|impact\/[0-9a-f]{64})\.json(\.\d+\.(?:[0-9a-f-]+)\.tmp)?$/u.exec(path);
  if (match === null)
    throw new DerivedCacheError("cache-corrupt", `Unrecognized disposable cache entry: ${path}`);
  return match[2] !== void 0 ? "staging" : path.includes("/contexts/") ? "context" : "impact";
}
function checkDerivedCacheBudget(budget) {
  if (Date.now() > budget.deadline || budget.remainingEntries < 0 || budget.remainingBytes < 0)
    throw new DerivedCacheError("cache-budget", "Derived cache maintenance could not complete its bounded safety inspection; no unproven entries may be removed");
}
function checkAdmission(signal, deadline) {
  signal?.throwIfAborted();
  if (deadline !== void 0 && Date.now() >= deadline)
    throw new DerivedCacheError("cache-budget", "Derived cache publication exceeded the operation deadline; retry with an explicit larger observation allowance");
}
async function withIndexedCacheAdmission(root, body, options) {
  checkAdmission(options.signal, options.deadline ?? options.budget?.deadline);
  const deadline = options.deadline ?? options.budget?.deadline ?? Date.now() + 5e3;
  const store = await SqliteObservationStore.open(root, { budget: new ObservationBudget({ timeoutMs: Math.max(1, Math.ceil(deadline - Date.now())), ...options.budget === void 0 ? {} : { maxDerivedBytes: options.budget.remainingBytes } }), ...options.signal === void 0 ? {} : { signal: options.signal }, ...options.maxBytes === void 0 ? {} : { maxBytes: options.maxBytes } });
  let active = true, inspected;
  const inspectedHashes = /* @__PURE__ */ new Map();
  const check = () => {
    if (!active)
      throw new DerivedCacheError("cache-busy", "Cache admission session is closed");
    checkAdmission(options.signal, deadline);
  };
  const session = {
    get totalBytes() {
      check();
      return store.totalBytes;
    },
    get entries() {
      check();
      if (inspected === void 0) {
        inspected = /* @__PURE__ */ new Map();
        inspectedHashes.clear();
        for (const record of store.cacheEntries()) {
          const entry = { relativePath: record.key, bytes: record.bytes, lastUsedMs: record.lastUsedMs, kind: classify(record.key) };
          if (options.budget !== void 0) {
            options.budget.remainingEntries--;
            checkDerivedCacheBudget(options.budget);
          }
          inspected.set(record.key, entry);
          inspectedHashes.set(record.key, record.valueHash);
        }
      }
      return [...inspected.values()];
    },
    async publish(relativePath, content) {
      await this.publishAll([{ relativePath, content }]);
    },
    async publishAll(writes) {
      check();
      const unique4 = /* @__PURE__ */ new Map();
      const assertions = [];
      for (const write of writes) {
        if (classify(write.relativePath) === "staging")
          throw new DerivedCacheError("cache-corrupt", "Cannot publish a staging path");
        if (unique4.has(write.relativePath) && unique4.get(write.relativePath) !== write.content)
          throw new DerivedCacheError("cache-corrupt", "Conflicting cache batch addresses");
        const existing = store.get("cache-source", write.relativePath);
        if (existing !== void 0 && existing.content !== write.content)
          throw new DerivedCacheError("cache-corrupt", `Derived cache content differs at ${write.relativePath}; inspect this disposable entry before refreshing context`);
        assertions.push({ kind: "cache-source", key: write.relativePath, expected: existing });
        unique4.set(write.relativePath, write.content);
      }
      const head = store.head();
      try {
        store.publish(head?.generation ?? null, head ?? { contract: "projector-cache-owner/v1", metadata: {} }, { upserts: [...unique4].map(([key, content]) => ({ kind: "cache-source", key, value: { content, lastUsedMs: Date.now() } })) }, { retainGeneration: true, preserveMetadata: true, assertions, ...options.signal === void 0 ? {} : { signal: options.signal } });
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "observation-limit-exceeded")
          throw new DerivedCacheError("cache-capacity", "Shared disposable cache cannot admit the transaction including database and rollback journal peak; finish active operations or maintain the cache before retrying");
        throw error;
      }
      inspected = void 0;
    },
    async remove(entry) {
      check();
      if (inspected?.get(entry.relativePath) !== entry)
        throw new DerivedCacheError("cache-corrupt", "Cache deletion did not name an inspected entry");
      const head = store.head();
      try {
        store.publish(head.generation, head, { deletes: [{ kind: "cache-source", key: entry.relativePath }] }, { retainGeneration: true, preserveMetadata: true, assertions: [{ kind: "cache-source", key: entry.relativePath, expectedHash: inspectedHashes.get(entry.relativePath) }] });
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "observation-record-changed")
          throw new DerivedCacheError("cache-corrupt", "Cache entry changed after inspection");
        throw error;
      }
      inspected.delete(entry.relativePath);
    }
  };
  try {
    const result = await body(session);
    check();
    return result;
  } finally {
    active = false;
    store.close();
  }
}
async function readDerivedCacheSource(root, relativePath, options = {}) {
  classify(relativePath);
  const store = await SqliteObservationStore.open(root, options);
  try {
    return store.get("cache-source", relativePath)?.content;
  } finally {
    store.close();
  }
}
async function touchDerivedCacheEntry(root, relativePath) {
  classify(relativePath);
  const store = await SqliteObservationStore.open(root);
  try {
    const source = store.get("cache-source", relativePath);
    if (source === void 0)
      return;
    const head = store.head();
    store.publish(head.generation, head, { upserts: [{ kind: "cache-source", key: relativePath, value: { ...source, lastUsedMs: Date.now() } }] }, { retainGeneration: true, preserveMetadata: true, assertions: [{ kind: "cache-source", key: relativePath, expected: source }] });
  } finally {
    store.close();
  }
}

// node_modules/@projector/runtime/dist/cache/location.js
import { lstat as lstat6, mkdir as mkdir4, realpath as realpath2 } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute as isAbsolute2, join as join6 } from "node:path";
async function checkoutCacheLocation(repositoryRoot) {
  const checkoutRoot = await realpath2(repositoryRoot);
  const identity = await lstat6(checkoutRoot, { bigint: true });
  if (!identity.isDirectory() || identity.isSymbolicLink())
    throw new Error("Checkout cache requires a real checkout directory");
  const checkoutId = hashFramedDomain("projector-checkout-cache-v1", { root: checkoutRoot, device: String(identity.dev), inode: String(identity.ino), created: String(identity.birthtimeNs) }).slice("sha256:v1:".length);
  const configured = process.env.PROJECTOR_CACHE_DIRECTORY;
  const base = configured ?? (process.platform === "win32" ? join6(process.env.LOCALAPPDATA ?? join6(homedir(), "AppData", "Local"), "Projector", "cache") : process.platform === "darwin" ? join6(homedir(), "Library", "Caches", "Projector") : join6(process.env.XDG_CACHE_HOME ?? join6(homedir(), ".cache"), "projector"));
  if (!isAbsolute2(base))
    throw new Error("Projector user cache directory must be absolute");
  const cacheRoot = join6(base, "checkouts", checkoutId);
  await mkdir4(cacheRoot, { recursive: true });
  for (const directory of [base, join6(base, "checkouts"), cacheRoot]) {
    const stat3 = await lstat6(directory);
    if (!stat3.isDirectory() || stat3.isSymbolicLink())
      throw new Error("Projector user cache directory is redirected through a symbolic link");
  }
  return { checkoutId, checkoutRoot, cacheRoot };
}
async function resolveDerivedCachePath(repositoryRoot, relativePath) {
  if (!/^\.projector\/runtime\/(?:knowledge\/contexts\/|impact\/|observations\/)/u.test(relativePath))
    throw new Error("Path is not a disposable Projector cache address");
  const { cacheRoot } = await checkoutCacheLocation(repositoryRoot);
  const paths = await RepositoryPathService.create(cacheRoot);
  return (await paths.resolveWrite(relativePath)).realTarget;
}

// node_modules/@projector/runtime/dist/sqlite/observation-store.js
var recordDigest = (value) => createHash3("sha256").update(value).digest("hex");
var SqliteObservationStore = class _SqliteObservationStore {
  path;
  options;
  database;
  maximum;
  closed = false;
  metrics = { rowsRead: 0, rowsWritten: 0, bytesRead: 0, bytesWritten: 0 };
  /** Resolve the database and SQLite sidecars through the checkout's existing path boundary. */
  static async open(repositoryRoot, options = {}) {
    options.signal?.throwIfAborted();
    options.budget?.check("observation-index-path");
    const location = await checkoutCacheLocation(repositoryRoot);
    const paths = await RepositoryPathService.create(location.cacheRoot);
    const relative4 = ".projector/runtime/observations/index.sqlite";
    const database = await paths.resolveWrite(relative4);
    for (const suffix of ["-wal", "-shm", "-journal"])
      await paths.resolveWrite(`${relative4}${suffix}`);
    options.signal?.throwIfAborted();
    options.budget?.check("observation-index-path");
    return new _SqliteObservationStore(database.realTarget, options);
  }
  constructor(path, options = {}) {
    this.path = path;
    this.options = options;
    this.maximum = options.maxBytes ?? DERIVED_CACHE_MAX_BYTES;
    if (!Number.isSafeInteger(this.maximum) || this.maximum < 1 || this.maximum > DERIVED_CACHE_MAX_BYTES)
      throw new RangeError("Invalid observation cache capacity");
    this.check();
    mkdirSync2(dirname5(path), { recursive: true });
    this.database = new DatabaseSync3(path, { allowExtension: false, defensive: true, enableDoubleQuotedStringLiterals: false, enableForeignKeyConstraints: true, timeout: Math.min(5e3, options.budget?.remainingMs() ?? 5e3) });
    try {
      this.database.exec("PRAGMA trusted_schema=OFF; PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;");
      const pageSize = this.database.prepare("PRAGMA page_size").get();
      this.database.exec(`PRAGMA max_page_count=${Math.floor(DERIVED_CACHE_MAX_BYTES / (2 * pageSize.page_size))};`);
      const version = this.database.prepare("PRAGMA user_version").get();
      if (version.user_version !== 0 && version.user_version !== 1)
        throw new Error("Observation index version is unsupported; rebuild the disposable observation cache");
      if (version.user_version === 0) {
        this.database.exec("BEGIN IMMEDIATE");
        try {
          const currentVersion = this.database.prepare("PRAGMA user_version").get();
          if (currentVersion.user_version === 0)
            this.database.exec(`
        CREATE TABLE observation_head(singleton INTEGER PRIMARY KEY CHECK(singleton=1), generation INTEGER NOT NULL, contract TEXT NOT NULL, metadata TEXT NOT NULL, bytes INTEGER NOT NULL) STRICT;
        CREATE TABLE observation_records(kind TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, bytes INTEGER NOT NULL, PRIMARY KEY(kind,key)) STRICT, WITHOUT ROWID;
        CREATE TABLE observation_populations(selector TEXT NOT NULL, member TEXT NOT NULL, bytes INTEGER NOT NULL, PRIMARY KEY(selector,member)) STRICT, WITHOUT ROWID;
        CREATE TABLE observation_dependencies(consumer TEXT NOT NULL, input TEXT NOT NULL, bytes INTEGER NOT NULL, PRIMARY KEY(consumer,input)) STRICT, WITHOUT ROWID;
        CREATE INDEX observation_dependency_input ON observation_dependencies(input,consumer);
        CREATE TABLE observation_accounting(singleton INTEGER PRIMARY KEY CHECK(singleton=1), bytes INTEGER NOT NULL CHECK(bytes>=0)) STRICT;
        INSERT INTO observation_accounting VALUES(1,0);
        PRAGMA user_version=1;
      `);
          else if (currentVersion.user_version !== 1)
            throw new Error("Observation index version is unsupported; rebuild the disposable observation cache");
          this.database.exec("COMMIT");
        } catch (error) {
          this.database.exec("ROLLBACK");
          throw error;
        }
      }
      const installedColumns = this.database.prepare("PRAGMA table_info(observation_records)").all();
      if (!["value_hash", "cache_content_bytes", "cache_last_used"].every((name) => installedColumns.some((column) => column.name === name))) {
        this.database.exec("BEGIN IMMEDIATE");
        try {
          const columns = this.database.prepare("PRAGMA table_info(observation_records)").all();
          if (!columns.some((column) => column.name === "value_hash"))
            this.database.exec("ALTER TABLE observation_records ADD COLUMN value_hash TEXT;");
          if (!columns.some((column) => column.name === "cache_content_bytes"))
            this.database.exec("ALTER TABLE observation_records ADD COLUMN cache_content_bytes INTEGER;");
          if (!columns.some((column) => column.name === "cache_last_used"))
            this.database.exec("ALTER TABLE observation_records ADD COLUMN cache_last_used INTEGER;");
          this.database.exec("COMMIT");
        } catch (error) {
          this.database.exec("ROLLBACK");
          throw error;
        }
      }
      this.check();
    } catch (error) {
      this.database.close();
      throw error;
    }
  }
  close() {
    if (this.closed)
      return;
    this.database.close();
    this.closed = true;
    const sink = process.env.PROJECTOR_OBSERVATION_METRICS_FILE;
    if (sink !== void 0) {
      if (!isAbsolute3(sink))
        throw new Error("Observation metrics evidence sink must be an absolute host-selected path");
      appendFileSync(sink, JSON.stringify({ kind: "observation-addressed-record-metrics", pid: process.pid, threadId, ...this.metrics }) + "\n", "utf8");
    }
  }
  check() {
    this.options.signal?.throwIfAborted();
    this.options.budget?.check("observation-index");
  }
  assertRecordBytes(bytes, key) {
    const limit = this.options.budget?.limits.maxDerivedBytes ?? DERIVED_CACHE_MAX_BYTES;
    if (bytes > limit)
      throw new ObservationError("observation-limit-exceeded", "observation-index-record", key, "Indexed derived record exceeds the declared derived memory limit", "maxDerivedBytes", bytes);
  }
  encoded(value) {
    const encoded = canonicalJson(value);
    this.assertRecordBytes(Buffer.byteLength(encoded), "observation-index-record");
    return encoded;
  }
  head() {
    this.check();
    const row = this.database.prepare("SELECT generation,contract,metadata,bytes FROM observation_head WHERE singleton=1").get();
    if (row === void 0)
      return void 0;
    this.metrics.rowsRead++;
    this.metrics.bytesRead += Buffer.byteLength(row.metadata);
    return { generation: row.generation, contract: row.contract, metadata: JSON.parse(row.metadata) };
  }
  get(kind, key) {
    this.check();
    const limit = this.options.budget?.limits.maxDerivedBytes ?? DERIVED_CACHE_MAX_BYTES;
    const row = this.database.prepare("SELECT length(CAST(value AS BLOB)) AS bytes, CASE WHEN length(CAST(value AS BLOB))<=? THEN value END AS value FROM observation_records WHERE kind=? AND key=?").get(limit, kind, key);
    if (row === void 0)
      return void 0;
    this.assertRecordBytes(row.bytes, key);
    if (row.value === null)
      throw new Error("Indexed record size changed during bounded read");
    this.metrics.rowsRead++;
    this.metrics.bytesRead += row.bytes;
    return JSON.parse(row.value);
  }
  has(kind, key) {
    this.check();
    return this.database.prepare("SELECT 1 FROM observation_records WHERE kind=? AND key=?").get(kind, key) !== void 0;
  }
  verifyGeneration(generation) {
    if (this.head()?.generation !== generation)
      throw new Error("Observation generation changed during indexed computation; retry from the completed generation");
  }
  getAt(generation, kind, key) {
    return this.readGeneration(generation, () => this.get(kind, key));
  }
  populationAt(generation, selector) {
    return this.readGeneration(generation, () => this.population(selector));
  }
  dependentsAt(generation, input) {
    return this.readGeneration(generation, () => this.dependents(input));
  }
  get totalBytes() {
    this.check();
    return this.database.prepare("SELECT bytes FROM observation_accounting WHERE singleton=1").get().bytes;
  }
  cacheEntries() {
    this.check();
    const result = [];
    const limit = this.options.budget?.limits.maxDerivedBytes ?? DERIVED_CACHE_MAX_BYTES;
    for (const row of this.database.prepare("SELECT key,CASE WHEN cache_content_bytes IS NULL THEN CASE WHEN length(CAST(value AS BLOB))<=? THEN length(CAST(json_extract(value,'$.content') AS BLOB)) END ELSE cache_content_bytes END AS content_bytes,CASE WHEN cache_last_used IS NULL THEN CASE WHEN length(CAST(value AS BLOB))<=? THEN json_extract(value,'$.lastUsedMs') END ELSE cache_last_used END AS last_used,value_hash,CASE WHEN value_hash IS NULL OR cache_content_bytes IS NULL OR cache_last_used IS NULL THEN length(CAST(value AS BLOB)) END AS legacy_bytes,CASE WHEN value_hash IS NULL AND length(CAST(value AS BLOB))<=? THEN value END AS legacy_value FROM observation_records WHERE kind='cache-source' ORDER BY key").iterate(limit, limit, limit)) {
      this.check();
      this.options.budget?.consume("maxFiles", 1, "cache-maintenance");
      if (row.legacy_bytes !== null)
        this.assertRecordBytes(Number(row.legacy_bytes), String(row.key));
      if (typeof row.content_bytes !== "number" || typeof row.last_used !== "number")
        throw new Error("Disposable cache metadata is invalid; no unproven entries may be removed");
      result.push({ key: String(row.key), bytes: row.content_bytes, lastUsedMs: row.last_used, valueHash: row.value_hash === null ? recordDigest(String(row.legacy_value)) : String(row.value_hash) });
    }
    return result;
  }
  /** All addressed reads in body see one completed generation, even if another process publishes. */
  readGeneration(generation, body) {
    this.check();
    this.database.exec("BEGIN");
    try {
      if (this.head()?.generation !== generation)
        throw new Error("Observation generation changed before indexed reads; retry from the completed generation");
      const result = body(this);
      if (result !== null && (typeof result === "object" || typeof result === "function") && "then" in result)
        throw new TypeError("Indexed generation reads must finish synchronously before releasing their snapshot");
      this.check();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
  population(selector) {
    return this.select("SELECT member AS value FROM observation_populations WHERE selector=? ORDER BY member", selector);
  }
  dependents(input) {
    return this.select("SELECT consumer AS value FROM observation_dependencies WHERE input=? ORDER BY consumer", input);
  }
  select(sql, key) {
    this.check();
    const result = [];
    for (const row of this.database.prepare(sql).iterate(key)) {
      this.check();
      const value = String(row.value);
      this.options.budget?.consume("maxFiles", 1, "observation-index-query", key);
      this.metrics.rowsRead++;
      this.metrics.bytesRead += Buffer.byteLength(value);
      result.push(value);
    }
    return result;
  }
  /** expectedGeneration is a compare-and-swap lease, not authority to mutate authored files. */
  publish(expectedGeneration, next, delta, options = {}) {
    this.check();
    options.signal?.throwIfAborted();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const previous = this.database.prepare("SELECT generation,bytes FROM observation_head WHERE singleton=1").get();
      if ((previous?.generation ?? null) !== expectedGeneration)
        throw new Error("Observation generation changed during collection; retry from the completed generation");
      if (options.preserveMetadata === true) {
        if (options.retainGeneration !== true)
          throw new Error("Metadata preservation requires a cache-only retained generation");
        const current = this.head();
        if (current !== void 0)
          next = current;
      }
      for (const assertion of options.assertions ?? []) {
        const size = this.database.prepare("SELECT length(CAST(value AS BLOB)) AS bytes FROM observation_records WHERE kind=? AND key=?").get(assertion.kind, assertion.key);
        let matches;
        if (assertion.expectedHash !== void 0) {
          const hash2 = createHash3("sha256");
          const chunkBytes = Math.min(64 * 1024, this.options.budget?.limits.maxDerivedBytes ?? DERIVED_CACHE_MAX_BYTES);
          if (chunkBytes < 1)
            throw new Error("Indexed digest read requires a positive derived-data allowance");
          if (size !== void 0)
            for (let offset = 1; offset <= size.bytes; offset += chunkBytes) {
              this.check();
              options.signal?.throwIfAborted();
              const chunk = this.database.prepare("SELECT substr(CAST(value AS BLOB),?,?) AS value FROM observation_records WHERE kind=? AND key=?").get(offset, chunkBytes, assertion.kind, assertion.key);
              hash2.update(chunk.value);
              this.metrics.rowsRead++;
              this.metrics.bytesRead += chunk.value.byteLength;
            }
          matches = size !== void 0 && hash2.digest("hex") === assertion.expectedHash;
        } else {
          if (size !== void 0)
            this.assertRecordBytes(size.bytes, assertion.key);
          const row = this.database.prepare("SELECT value FROM observation_records WHERE kind=? AND key=?").get(assertion.kind, assertion.key);
          matches = row?.value === (assertion.expected === void 0 ? void 0 : this.encoded(assertion.expected));
        }
        if (!matches)
          throw Object.assign(new Error("Observation record changed after inspection; retry the addressed cache operation"), { code: "observation-record-changed" });
      }
      const accounting = this.database.prepare("SELECT bytes FROM observation_accounting WHERE singleton=1").get();
      let bytes = accounting.bytes;
      const check = () => {
        this.check();
        options.signal?.throwIfAborted();
        if (bytes > this.maximum)
          throw new ObservationError("observation-limit-exceeded", "observation-index-capacity", ".", "Completed observation exceeds the disposable cache capacity; prior generation remains unchanged", "maxDerivedBytes", bytes);
      };
      if (delta.rebuild === true) {
        this.database.exec("DELETE FROM observation_records WHERE kind!='cache-source'; DELETE FROM observation_populations; DELETE FROM observation_dependencies;");
        bytes = this.database.prepare("SELECT COALESCE(SUM(bytes),0) AS bytes FROM observation_records").get().bytes + (previous?.bytes ?? 0);
      }
      for (const record of delta.deletes ?? []) {
        check();
        const existing = this.database.prepare("SELECT bytes FROM observation_records WHERE kind=? AND key=?").get(record.kind, record.key);
        this.database.prepare("DELETE FROM observation_records WHERE kind=? AND key=?").run(record.kind, record.key);
        bytes -= existing?.bytes ?? 0;
        this.metrics.rowsWritten++;
      }
      for (const record of delta.upserts ?? []) {
        check();
        const value = this.encoded(record.value), digest = record.kind === "cache-source" ? recordDigest(value) : null;
        let contentBytes = null, lastUsed = null;
        if (record.kind === "cache-source") {
          if (typeof record.value !== "object" || record.value === null || !("content" in record.value) || typeof record.value.content !== "string" || !("lastUsedMs" in record.value) || !Number.isSafeInteger(record.value.lastUsedMs))
            throw new Error("Disposable cache source metadata is invalid");
          contentBytes = Buffer.byteLength(record.value.content);
          lastUsed = record.value.lastUsedMs;
        }
        const size = Buffer.byteLength(record.kind) + Buffer.byteLength(record.key) + Buffer.byteLength(value) + 64 + (digest === null ? 0 : 80);
        const existing = this.database.prepare("SELECT bytes FROM observation_records WHERE kind=? AND key=?").get(record.kind, record.key);
        bytes += size - (existing?.bytes ?? 0);
        check();
        this.database.prepare("INSERT INTO observation_records(kind,key,value,bytes,value_hash,cache_content_bytes,cache_last_used) VALUES(?,?,?,?,?,?,?) ON CONFLICT(kind,key) DO UPDATE SET value=excluded.value,bytes=excluded.bytes,value_hash=excluded.value_hash,cache_content_bytes=excluded.cache_content_bytes,cache_last_used=excluded.cache_last_used").run(record.kind, record.key, value, size, digest, contentBytes, lastUsed);
        this.metrics.rowsWritten++;
        this.metrics.bytesWritten += size;
      }
      for (const [table, left, right, changes] of [
        ["observation_populations", "selector", "member", (delta.populations ?? []).map((item) => ({ a: item.selector, b: item.member, present: item.present }))],
        ["observation_dependencies", "consumer", "input", (delta.dependencies ?? []).map((item) => ({ a: item.consumer, b: item.input, present: item.present }))]
      ])
        for (const item of changes) {
          check();
          const existing = this.database.prepare(`SELECT bytes FROM ${table} WHERE ${left}=? AND ${right}=?`).get(item.a, item.b);
          const size = Buffer.byteLength(item.a) + Buffer.byteLength(item.b) + 64;
          bytes += (item.present ? size : 0) - (existing?.bytes ?? 0);
          check();
          if (item.present)
            this.database.prepare(`INSERT INTO ${table} VALUES(?,?,?) ON CONFLICT(${left},${right}) DO UPDATE SET bytes=excluded.bytes`).run(item.a, item.b, size);
          else
            this.database.prepare(`DELETE FROM ${table} WHERE ${left}=? AND ${right}=?`).run(item.a, item.b);
          this.metrics.rowsWritten++;
        }
      const metadata = this.encoded(next.metadata), headBytes = Buffer.byteLength(metadata) + Buffer.byteLength(next.contract) + 64;
      bytes += headBytes - (previous?.bytes ?? 0);
      check();
      const generation = (previous?.generation ?? 0) + (options.retainGeneration === true ? 0 : 1);
      if (!Number.isSafeInteger(generation))
        throw new Error("Observation generation counter exhausted; rebuild the disposable observation cache");
      this.database.prepare("INSERT INTO observation_head VALUES(1,?,?,?,?) ON CONFLICT(singleton) DO UPDATE SET generation=excluded.generation,contract=excluded.contract,metadata=excluded.metadata,bytes=excluded.bytes").run(generation, next.contract, metadata, headBytes);
      this.database.prepare("UPDATE observation_accounting SET bytes=? WHERE singleton=1").run(bytes);
      check();
      this.database.exec("COMMIT");
      return { generation, contract: next.contract, metadata: JSON.parse(metadata) };
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
};

// node_modules/@projector/runtime/dist/journal/transaction-journal.js
import { createHash as createHash4, randomUUID as randomUUID2 } from "node:crypto";
import { constants as constants5 } from "node:fs";
import { chmod, link as link3, lstat as lstat7, mkdir as mkdir5, open as open5, readFile as readFile3, readdir as readdir2, rename as rename3, rm as rm5 } from "node:fs/promises";
import { dirname as dirname6, join as join7, posix as posix2 } from "node:path";
var journalRoot = ".projector/runtime/journal";
var maximumJournalBytes = 64 * 1024 * 1024;
var transientWindowsRenameCodes = /* @__PURE__ */ new Set(["EACCES", "EBUSY", "EPERM"]);
async function publishJournalRecord(source, destination, renameRecord, platform) {
  for (const delayMs of [0, 10, 25, 50, 100, 200]) {
    if (delayMs > 0)
      await new Promise((resolve3) => setTimeout(resolve3, delayMs));
    try {
      await renameRecord(source, destination);
      return;
    } catch (error) {
      const retryable = platform === "win32" && typeof error === "object" && error !== null && "code" in error && transientWindowsRenameCodes.has(String(error.code));
      if (!retryable)
        throw error;
      if (delayMs === 200)
        throw new Error(`Journal record publication remained blocked after bounded Windows retries: ${source} -> ${destination}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }
}
function hashFileTransactionJournalBytes(bytes) {
  return hashFramedDomain("file-transaction-journal-bytes:v1", Buffer.from(bytes).toString("base64"));
}
function fileTransactionJournalRelativePath(transactionId) {
  return `${journalRoot}/${recordFileName(transactionId)}`;
}
function parseFileTransactionJournalSource(source, transactionId, repositoryRoot) {
  const record = parseRecord(source);
  if (record.entry.transactionId !== transactionId || record.entry.worktreePath !== repositoryRoot) {
    throw new JournalRecoveryRequiredError("Journal identity or worktree binding does not match its path");
  }
  return record;
}
var InvalidJournalTransitionError = class extends Error {
  constructor(from, to) {
    super(`Transaction phase cannot transition from ${from} to ${to}`);
    this.name = "InvalidJournalTransitionError";
  }
};
var JournalRecoveryRequiredError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "JournalRecoveryRequiredError";
  }
};
var FileTransaction = class {
  journal;
  record;
  constructor(journal, record) {
    this.journal = journal;
    this.record = record;
  }
  get entry() {
    return this.record.entry;
  }
  transition(phase) {
    if (phase === "committed" || phase === "rolling-back" || phase === "rolled-back" || phase === "recovery-required") {
      return Promise.reject(new InvalidJournalTransitionError(this.record.entry.phase, phase));
    }
    return this.journal.transitionRecord(this.record, phase);
  }
  commit() {
    return this.journal.commitRecord(this.record);
  }
  async writeFile(path, content) {
    await this.ensureMutationPhase();
    const before = await this.journal.snapshot(path, this.record.allowedWriteRoots);
    const after = {
      kind: "file",
      contentBase64: Buffer.from(content).toString("base64"),
      mode: before.kind === "file" ? before.mode : 438
    };
    await this.journal.applyOperation(this.record, "write-file", [{ path, before, after }], async () => {
      await this.journal.restore(path, after, this.record.allowedWriteRoots);
    });
  }
  async deleteFile(path) {
    await this.ensureMutationPhase();
    const before = await this.journal.snapshot(path, this.record.allowedWriteRoots);
    await this.journal.applyOperation(this.record, "delete-file", [{ path, before, after: { kind: "missing" } }], async () => this.journal.restore(path, { kind: "missing" }, this.record.allowedWriteRoots));
  }
  async moveFile(source, destination) {
    await this.ensureMutationPhase();
    if (source === destination)
      throw new TypeError("Move source and destination must differ");
    const sourceBefore = await this.journal.snapshot(source, this.record.allowedWriteRoots);
    if (sourceBefore.kind !== "file")
      throw new Error(`Move source does not exist: ${source}`);
    const destinationBefore = await this.journal.snapshot(destination, this.record.allowedWriteRoots);
    await this.journal.applyOperation(this.record, "move-file", [
      { path: source, before: sourceBefore, after: { kind: "missing" } },
      { path: destination, before: destinationBefore, after: sourceBefore }
    ], async () => this.journal.move(source, destination, this.record.allowedWriteRoots));
  }
  async checkpoint(id) {
    await this.assertMetadataMutable();
    if (id.length === 0 || this.record.entry.checkpointIds.includes(id)) {
      throw new TypeError(`Invalid or duplicate checkpoint: ${id}`);
    }
    this.record.entry.checkpointIds.push(id);
    this.record.checkpoints.push({
      id,
      phase: this.record.entry.phase,
      operationCount: this.record.operations.length,
      createdAt: this.journal.timestamp()
    });
    await this.journal.persist(this.record);
  }
  async recordCompensation(input) {
    await this.assertMetadataMutable();
    if (input.externalOperationId.length === 0 || this.record.entry.externalOperationIds.includes(input.externalOperationId)) {
      throw new TypeError(`Invalid or duplicate external operation: ${input.externalOperationId}`);
    }
    this.record.entry.externalOperationIds.push(input.externalOperationId);
    this.record.compensations.push({
      ...input,
      status: "pending",
      recordedAt: this.journal.timestamp()
    });
    await this.journal.persist(this.record);
  }
  async markCompensated(externalOperationId) {
    await this.assertMetadataMutable();
    const compensation = this.record.compensations.find((candidate) => candidate.externalOperationId === externalOperationId);
    if (compensation === void 0)
      throw new TypeError(`Unknown external operation: ${externalOperationId}`);
    compensation.status = "completed";
    compensation.completedAt = this.journal.timestamp();
    await this.journal.persist(this.record);
  }
  rollback() {
    return this.journal.rollbackRecord(this.record);
  }
  async ensureMutationPhase() {
    if (this.record.entry.phase === "prepared") {
      await this.journal.transitionRecord(this.record, "workspace-mutating");
    }
    if (this.record.entry.phase !== "workspace-mutating") {
      throw new InvalidJournalTransitionError(this.record.entry.phase, "workspace-mutating");
    }
  }
  async assertMetadataMutable() {
    const durablePhase = (await this.journal.read(this.record.entry.transactionId)).entry.phase;
    if (durablePhase !== this.record.entry.phase || durablePhase === "committed" || durablePhase === "rolled-back" || durablePhase === "recovery-required") {
      throw new InvalidJournalTransitionError(this.record.entry.phase, durablePhase);
    }
  }
};
var FileTransactionJournal = class {
  paths;
  now;
  crash;
  renameRecord;
  platform;
  constructor(paths, options = {}) {
    this.paths = paths;
    this.now = options.now ?? (() => /* @__PURE__ */ new Date());
    this.crash = options.crash;
    this.renameRecord = options.renameRecord ?? rename3;
    this.platform = options.platform ?? process.platform;
  }
  async begin(input) {
    if (input.transactionId.length === 0 || input.planId.length === 0 || input.allowedWriteRoots.length === 0) {
      throw new TypeError("A transaction requires IDs and at least one write root");
    }
    await this.ensureJournalRoot();
    const now = this.timestamp();
    const record = {
      version: 1,
      entry: {
        transactionId: input.transactionId,
        planId: input.planId,
        phase: "prepared",
        beforeState: input.beforeState,
        ...input.intendedAfterCanonicalDigest === void 0 ? {} : { intendedAfterCanonicalDigest: input.intendedAfterCanonicalDigest },
        worktreePath: this.paths.root,
        checkpointIds: [],
        touchedPaths: [],
        externalOperationIds: [],
        updatedAt: now
      },
      allowedWriteRoots: [...input.allowedWriteRoots],
      operations: [],
      checkpoints: [],
      compensations: []
    };
    await this.persist(record, true);
    this.inject("after-phase:prepared");
    return new FileTransaction(this, record);
  }
  async read(transactionId) {
    return (await this.readExact(transactionId)).record;
  }
  async readExact(transactionId) {
    const path = await this.recordPath(transactionId);
    const bytes = await readBoundedRegularFile(path, maximumJournalBytes);
    const record = parseFileTransactionJournalSource(bytes.toString("utf8"), transactionId, this.paths.root);
    return { record, bytes, contentHash: hashFileTransactionJournalBytes(bytes) };
  }
  async ensureRecordDurable(transactionId) {
    const path = await this.recordPath(transactionId);
    const expected = await readBoundedRegularFile(path, maximumJournalBytes);
    await flushPublishedJournalRecord(path, expected);
    const exact = await this.readExact(transactionId);
    if (!exact.bytes.equals(expected)) {
      throw new JournalRecoveryRequiredError("Journal record changed while its publication was confirmed");
    }
    return exact;
  }
  async inspectRecordedAfterState(transactionId) {
    const exact = await this.readExact(transactionId);
    const finalByPath = /* @__PURE__ */ new Map();
    for (const operation of exact.record.operations) {
      for (const change of operation.changes)
        finalByPath.set(change.path, change.after);
    }
    const mismatchedPaths = [];
    for (const [path, expected] of finalByPath) {
      const observed = await this.snapshot(path, exact.record.allowedWriteRoots);
      if (!sameSnapshot(observed, expected))
        mismatchedPaths.push(path);
    }
    mismatchedPaths.sort();
    return {
      ...exact,
      matchesRecordedAfterState: mismatchedPaths.length === 0,
      mismatchedPaths
    };
  }
  async recoverIncomplete(options = {}) {
    throwIfAborted2(options.signal);
    return this.recoverRecords(await this.discover(void 0, options), options);
  }
  async incomplete(transactionIds) {
    const records = transactionIds === void 0 ? await this.discover() : await this.discover(transactionIds);
    return records.filter(({ entry }) => entry.phase !== "committed" && entry.phase !== "rolled-back");
  }
  async recover(transactionIds, options = {}) {
    throwIfAborted2(options.signal);
    if (transactionIds.length === 0)
      return [];
    return this.recoverRecords(await this.discover(transactionIds, options), options);
  }
  async discover(transactionIds, options = {}) {
    throwIfAborted2(options.signal);
    if (transactionIds !== void 0) {
      if (new Set(transactionIds).size !== transactionIds.length)
        throw new Error("targeted recovery transaction identities must be unique");
      const records = [];
      for (const transactionId of [...transactionIds].sort()) {
        throwIfAborted2(options.signal);
        try {
          const record = await this.read(transactionId);
          throwIfAborted2(options.signal);
          records.push(record);
        } catch (error) {
          if (!isCode4(error, "ENOENT"))
            throw error;
        }
      }
      return records;
    }
    const directory = await this.ensureJournalRoot();
    throwIfAborted2(options.signal);
    const names = (await readdir2(directory)).filter((name) => name.endsWith(".json")).sort();
    throwIfAborted2(options.signal);
    const discovered = [];
    const discoveredIds = /* @__PURE__ */ new Set();
    for (const name of names) {
      throwIfAborted2(options.signal);
      const source = await readFile3(join7(directory, name), "utf8");
      throwIfAborted2(options.signal);
      const record = parseRecord(source);
      throwIfAborted2(options.signal);
      if (name !== recordFileName(record.entry.transactionId)) {
        throw new JournalRecoveryRequiredError(`Journal filename ${name} does not match transaction ${record.entry.transactionId}`);
      }
      if (discoveredIds.has(record.entry.transactionId)) {
        throw new JournalRecoveryRequiredError(`Duplicate journal identity ${record.entry.transactionId}`);
      }
      discoveredIds.add(record.entry.transactionId);
      if (record.entry.worktreePath !== this.paths.root) {
        if (record.entry.phase === "committed" || record.entry.phase === "rolled-back")
          continue;
        throw new JournalRecoveryRequiredError(`Journal ${name} belongs to a different worktree`);
      }
      discovered.push(record);
    }
    return discovered;
  }
  async recoverRecords(discovered, options) {
    const results = [];
    for (const record of discovered) {
      throwIfAborted2(options.signal);
      if (record.entry.phase === "committed" || record.entry.phase === "rolled-back")
        continue;
      const priorPhase = record.entry.phase;
      const pending = record.compensations.find((compensation) => compensation.status === "pending");
      if (pending !== void 0 || record.entry.phase === "recovery-required") {
        if (record.entry.phase !== "recovery-required") {
          await this.forcePhase(record, "recovery-required");
        }
        results.push({
          transactionId: record.entry.transactionId,
          action: "recovery-required",
          priorPhase,
          ...lastCheckpoint(record),
          reason: pending === void 0 ? "Transaction already requires recovery" : `Uncompensated external operation ${pending.externalOperationId}`
        });
        continue;
      }
      results.push(await this.rollbackRecord(record, options));
    }
    return results;
  }
  async transitionRecord(record, phase) {
    if (phase === "committed" || phase === "rolling-back" || phase === "rolled-back" || phase === "recovery-required") {
      throw new InvalidJournalTransitionError(record.entry.phase, phase);
    }
    const allowed = allowedTransitions[record.entry.phase];
    if (!allowed.includes(phase))
      throw new InvalidJournalTransitionError(record.entry.phase, phase);
    await this.forcePhase(record, phase);
  }
  async commitRecord(record) {
    if (record.entry.phase !== "committing") {
      throw new InvalidJournalTransitionError(record.entry.phase, "committed");
    }
    if (record.operations.some((operation) => operation.status !== "applied")) {
      throw new JournalRecoveryRequiredError("A transaction with incomplete or reverted operations cannot commit");
    }
    const pending = record.compensations.find((compensation) => compensation.status === "pending");
    if (pending !== void 0) {
      await this.forcePhase(record, "recovery-required");
      throw new JournalRecoveryRequiredError(`Uncompensated external operation ${pending.externalOperationId} requires manual recovery`);
    }
    await this.forcePhase(record, "committed");
  }
  async applyOperation(record, kind, changes, apply) {
    const operation = {
      id: randomUUID2(),
      kind,
      status: "intended",
      changes
    };
    record.operations.push(operation);
    for (const change of changes) {
      if (!record.entry.touchedPaths.includes(change.path))
        record.entry.touchedPaths.push(change.path);
    }
    await this.persist(record);
    this.inject("after-operation-intent");
    await apply();
    this.inject("after-operation-apply");
    operation.status = "applied";
    await this.persist(record);
  }
  async rollbackRecord(record, options = {}) {
    throwIfAborted2(options.signal);
    const priorPhase = record.entry.phase;
    if (record.entry.phase !== "rolling-back") {
      if (record.entry.phase === "committed" || record.entry.phase === "rolled-back") {
        throw new InvalidJournalTransitionError(record.entry.phase, "rolling-back");
      }
      await this.forcePhase(record, "rolling-back");
    }
    try {
      for (const operation of [...record.operations].reverse()) {
        throwIfAborted2(options.signal);
        if (operation.status === "reverted")
          continue;
        for (const change of [...operation.changes].reverse()) {
          throwIfAborted2(options.signal);
          const current = await this.snapshot(change.path, record.allowedWriteRoots);
          if (sameSnapshot(current, change.before))
            continue;
          if (!sameSnapshot(current, change.after)) {
            throw new JournalRecoveryRequiredError(`${change.path} matches neither the recorded before nor after state`);
          }
          await this.restore(change.path, change.before, record.allowedWriteRoots);
          throwIfAborted2(options.signal);
        }
        this.inject(`after-operation-revert:${operation.id}`);
        throwIfAborted2(options.signal);
        operation.status = "reverted";
        await this.persist(record);
      }
      throwIfAborted2(options.signal);
      await this.forcePhase(record, "rolled-back");
      return {
        transactionId: record.entry.transactionId,
        action: "rolled-back",
        priorPhase,
        ...lastCheckpoint(record)
      };
    } catch (error) {
      if (!(error instanceof JournalRecoveryRequiredError))
        throw error;
      await this.forcePhase(record, "recovery-required");
      return {
        transactionId: record.entry.transactionId,
        action: "recovery-required",
        priorPhase,
        ...lastCheckpoint(record),
        reason: error.message
      };
    }
  }
  async snapshot(path, scopes2) {
    const target = await this.paths.resolveScopedWrite(path, scopes2);
    try {
      const status = await lstat7(target.realTarget);
      if (!status.isFile())
        throw new JournalRecoveryRequiredError(`${path} is not a regular file`);
      return {
        kind: "file",
        contentBase64: (await readFile3(target.realTarget)).toString("base64"),
        mode: status.mode & 511
      };
    } catch (error) {
      if (isCode4(error, "ENOENT"))
        return { kind: "missing" };
      throw error;
    }
  }
  async restore(path, snapshot, scopes2) {
    const target = await this.paths.resolveScopedWrite(path, scopes2);
    if (snapshot.kind === "missing") {
      await rm5(target.realTarget, { force: true });
      await syncDirectory3(dirname6(target.realTarget));
      return;
    }
    await this.ensureParent(path, scopes2);
    const resolved = await this.paths.resolveScopedWrite(path, scopes2);
    const temporary = join7(dirname6(resolved.realTarget), `.projector-tx-${randomUUID2()}.tmp`);
    const handle = await open5(temporary, "wx", snapshot.mode);
    try {
      await handle.writeFile(Buffer.from(snapshot.contentBase64, "base64"));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await chmod(temporary, snapshot.mode);
    await rename3(temporary, resolved.realTarget);
    await syncDirectory3(dirname6(resolved.realTarget));
  }
  async move(source, destination, scopes2) {
    const sourcePath = await this.paths.resolveScopedWrite(source, scopes2);
    await this.ensureParent(destination, scopes2);
    const destinationPath = await this.paths.resolveScopedWrite(destination, scopes2);
    await rename3(sourcePath.realTarget, destinationPath.realTarget);
    await syncDirectory3(dirname6(sourcePath.realTarget));
    if (dirname6(sourcePath.realTarget) !== dirname6(destinationPath.realTarget)) {
      await syncDirectory3(dirname6(destinationPath.realTarget));
    }
  }
  async persist(record, mustBeNew = false) {
    record.entry.updatedAt = this.timestamp();
    const destination = await this.recordPath(record.entry.transactionId);
    const directory = dirname6(destination);
    const temporary = join7(directory, `.${recordFileName(record.entry.transactionId)}.${randomUUID2()}.tmp`);
    const bytes = Buffer.from(`${JSON.stringify(record)}
`, "utf8");
    const handle = await open5(temporary, "wx");
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    if (mustBeNew) {
      try {
        await link3(temporary, destination);
        this.inject(`after-record-publication-before-flush:${record.entry.phase}`);
        await flushPublishedJournalRecord(destination, bytes);
        await syncDirectory3(directory);
        this.inject("after-new-record-claim");
      } catch (error) {
        await rm5(temporary, { force: true });
        if (isCode4(error, "EEXIST"))
          throw new Error(`Transaction already exists: ${record.entry.transactionId}`);
        throw error;
      }
      await rm5(temporary, { force: true });
      await syncDirectory3(directory);
      return;
    }
    await publishJournalRecord(temporary, destination, this.renameRecord, this.platform);
    this.inject(`after-record-publication-before-flush:${record.entry.phase}`);
    await flushPublishedJournalRecord(destination, bytes);
    await syncDirectory3(directory);
  }
  timestamp() {
    return this.now().toISOString();
  }
  async forcePhase(record, phase) {
    record.entry.phase = phase;
    await this.persist(record);
    this.inject(`after-phase:${phase}`);
  }
  inject(point) {
    this.crash?.(point);
  }
  async ensureJournalRoot() {
    const initial = await this.paths.resolveWrite(journalRoot);
    await mkdir5(initial.realTarget, { recursive: true });
    return (await this.paths.resolveWrite(journalRoot)).realTarget;
  }
  async recordPath(transactionId) {
    await this.ensureJournalRoot();
    return (await this.paths.resolveWrite(fileTransactionJournalRelativePath(transactionId))).realTarget;
  }
  async ensureParent(path, scopes2) {
    const authorizedTarget = await this.paths.resolveScopedWrite(path, scopes2);
    await mkdir5(dirname6(authorizedTarget.realTarget), { recursive: true });
    await this.paths.resolveScopedWrite(path, scopes2);
  }
};
function throwIfAborted2(signal) {
  if (signal?.aborted === true)
    throw signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}
var allowedTransitions = {
  prepared: ["workspace-mutating", "rolling-back", "recovery-required"],
  "workspace-mutating": ["workspace-staged", "rolling-back", "recovery-required"],
  "workspace-staged": ["validating", "rolling-back", "recovery-required"],
  validating: ["canonical-staging", "rolling-back", "recovery-required"],
  "canonical-staging": ["committing", "rolling-back", "recovery-required"],
  committing: ["committed", "rolling-back", "recovery-required"],
  committed: [],
  "rolling-back": ["rolled-back", "recovery-required"],
  "rolled-back": [],
  "recovery-required": []
};
function recordFileName(transactionId) {
  return `${createHash4("sha256").update(transactionId).digest("hex")}.json`;
}
async function readBoundedRegularFile(path, maximumBytes) {
  const before = await lstat7(path);
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new JournalRecoveryRequiredError(`Journal path is not a regular file: ${path}`);
  }
  if (before.size > maximumBytes) {
    throw new JournalRecoveryRequiredError(`Journal record exceeds ${maximumBytes} bytes: ${path}`);
  }
  const handle = await open5(path, constants5.O_RDONLY | (constants5.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size !== before.size) {
      throw new JournalRecoveryRequiredError(`Journal record changed while it was opened: ${path}`);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (bytes.length !== opened.size || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs) {
      throw new JournalRecoveryRequiredError(`Journal record changed while it was read: ${path}`);
    }
    return bytes;
  } finally {
    await handle.close();
  }
}
async function flushPublishedJournalRecord(path, expected) {
  const handle = await open5(path, constants5.O_RDWR | (constants5.O_NOFOLLOW ?? 0));
  try {
    const status = await handle.stat();
    if (!status.isFile())
      throw new JournalRecoveryRequiredError(`Published journal is not a regular file: ${path}`);
    await handle.sync();
    const observed = await handle.readFile();
    if (!observed.equals(expected)) {
      throw new JournalRecoveryRequiredError(`Published journal bytes changed during durable flush: ${path}`);
    }
  } finally {
    await handle.close();
  }
}
function sameSnapshot(left, right) {
  return left.kind === right.kind && (left.kind === "missing" || right.kind === "file" && left.contentBase64 === right.contentBase64 && left.mode === right.mode);
}
function parseRecord(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new JournalRecoveryRequiredError(`Journal JSON is corrupt: ${String(error)}`);
  }
  if (!isRecord2(value))
    throw new JournalRecoveryRequiredError("Journal record has an invalid structure");
  if (Object.hasOwn(value, "pendingMigration") && !["committed", "rolled-back"].includes(value.entry.phase)) {
    throw new JournalRecoveryRequiredError("Unsupported pre-cutover migration journal; preserve it and inspect with its matching runtime before recovery.");
  }
  return value;
}
function isRecord2(value) {
  if (typeof value !== "object" || value === null)
    return false;
  const record = value;
  const entry = record.entry;
  return record.version === 1 && typeof entry === "object" && entry !== null && typeof entry.transactionId === "string" && typeof entry.planId === "string" && transactionPhases.includes(entry.phase) && isStateDigest(entry.beforeState) && typeof entry.worktreePath === "string" && isStringArray(entry.checkpointIds) && isStringArray(entry.touchedPaths) && isStringArray(entry.externalOperationIds) && typeof entry.updatedAt === "string" && isStringArray(record.allowedWriteRoots) && Array.isArray(record.operations) && record.operations.every(isOperation) && Array.isArray(record.checkpoints) && record.checkpoints.every(isCheckpoint) && Array.isArray(record.compensations) && record.compensations.every(isCompensation) && hasConsistentRecordIndexes(record);
}
var transactionPhases = [
  "prepared",
  "workspace-mutating",
  "workspace-staged",
  "validating",
  "canonical-staging",
  "committing",
  "committed",
  "rolling-back",
  "rolled-back",
  "recovery-required"
];
function isStateDigest(value) {
  if (typeof value !== "object" || value === null)
    return false;
  const state = value;
  return typeof state.gitBase === "string" && isContentHash(state.worktreeDigest) && isContentHash(state.canonicalProjectorDigest) && isContentHash(state.toolchainDigest) && (state.pinnedExternalSnapshotDigest === void 0 || isContentHash(state.pinnedExternalSnapshotDigest));
}
function isOperation(value) {
  if (typeof value !== "object" || value === null)
    return false;
  const operation = value;
  return typeof operation.id === "string" && (operation.kind === "delete-file" || operation.kind === "move-file" || operation.kind === "write-file") && (operation.status === "intended" || operation.status === "applied" || operation.status === "reverted") && Array.isArray(operation.changes) && operation.changes.every(isPathChange);
}
function isPathChange(value) {
  if (typeof value !== "object" || value === null)
    return false;
  const change = value;
  return typeof change.path === "string" && isSnapshot(change.before) && isSnapshot(change.after);
}
function isSnapshot(value) {
  if (typeof value !== "object" || value === null)
    return false;
  const snapshot = value;
  return snapshot.kind === "missing" || snapshot.kind === "file" && typeof snapshot.contentBase64 === "string" && Buffer.from(snapshot.contentBase64, "base64").toString("base64") === snapshot.contentBase64 && typeof snapshot.mode === "number" && Number.isSafeInteger(snapshot.mode) && snapshot.mode >= 0 && snapshot.mode <= 511;
}
function isCheckpoint(value) {
  if (typeof value !== "object" || value === null)
    return false;
  const checkpoint = value;
  return typeof checkpoint.id === "string" && transactionPhases.includes(checkpoint.phase) && typeof checkpoint.operationCount === "number" && Number.isSafeInteger(checkpoint.operationCount) && checkpoint.operationCount >= 0 && typeof checkpoint.createdAt === "string";
}
function isCompensation(value) {
  if (typeof value !== "object" || value === null)
    return false;
  const compensation = value;
  return typeof compensation.externalOperationId === "string" && (compensation.kind === "registered" || compensation.kind === "manual") && (compensation.status === "pending" || compensation.status === "completed") && typeof compensation.recordedAt === "string" && (compensation.compensationId === void 0 || typeof compensation.compensationId === "string") && (compensation.instructions === void 0 || typeof compensation.instructions === "string") && (compensation.completedAt === void 0 || typeof compensation.completedAt === "string");
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function hasConsistentRecordIndexes(record) {
  const operationIds = record.operations.map((operation) => operation.id);
  const touchedPaths = record.operations.flatMap((operation) => operation.changes.map((change) => change.path));
  const checkpointIds = record.checkpoints.map((checkpoint) => checkpoint.id);
  const externalOperationIds = record.compensations.map((compensation) => compensation.externalOperationId);
  return allUnique(operationIds) && sameStringSet(record.entry.touchedPaths, touchedPaths) && sameStringSet(record.entry.checkpointIds, checkpointIds) && sameStringSet(record.entry.externalOperationIds, externalOperationIds) && allUnique(record.allowedWriteRoots) && record.allowedWriteRoots.every(isCanonicalRepositoryPath) && touchedPaths.every((path) => isCanonicalRepositoryPath(path) && record.allowedWriteRoots.some((scope) => isWithinScope(path, scope))) && record.checkpoints.every((checkpoint) => checkpoint.operationCount <= record.operations.length) && (record.entry.phase !== "prepared" || record.operations.length === 0) && (record.entry.phase !== "committed" || record.operations.every((operation) => operation.status === "applied")) && (record.entry.phase !== "rolled-back" || record.operations.every((operation) => operation.status === "reverted"));
}
function isCanonicalRepositoryPath(path) {
  return path.length > 0 && !path.includes("\\") && !path.includes("\0") && !path.startsWith("/") && !/^[A-Za-z]:/u.test(path) && posix2.normalize(path) === path && path !== ".." && !path.startsWith("../");
}
function isWithinScope(path, scope) {
  return scope === "." || path === scope || path.startsWith(`${scope}/`);
}
function sameStringSet(left, right) {
  return allUnique(left) && allUnique(right) && left.length === right.length && left.every((value) => right.includes(value));
}
function allUnique(values) {
  return new Set(values).size === values.length;
}
function isContentHash(value) {
  return typeof value === "string" && /^sha256:v1:[0-9a-f]{64}$/u.test(value);
}
function lastCheckpoint(record) {
  const last = record.entry.checkpointIds.at(-1);
  return last === void 0 ? {} : { lastCheckpointId: last };
}
async function syncDirectory3(path) {
  const handle = await open5(path, "r");
  try {
    await handle.sync();
  } catch (error) {
    if (!isCode4(error, "EINVAL") && !isCode4(error, "ENOTSUP") && !isCode4(error, "EPERM"))
      throw error;
  } finally {
    await handle.close();
  }
}
function isCode4(error, code) {
  return error instanceof Error && "code" in error && error.code === code;
}

// node_modules/@projector/runtime/dist/worktrees/governed-worktree.js
var StateBoundMutationError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "StateBoundMutationError";
  }
};
var GovernedWorktreeRuntime = class {
  leases;
  journal;
  constructor(leases, journal) {
    this.leases = leases;
    this.journal = journal;
  }
  async open(owner) {
    const lease = await this.leases.acquire(owner);
    return new GovernedWorktreeSession(lease, this.journal);
  }
};
var GovernedWorktreeSession = class {
  lease;
  journal;
  closed = false;
  constructor(lease, journal) {
    this.lease = lease;
    this.journal = journal;
  }
  async begin(input) {
    this.assertOpen();
    await this.lease.heartbeat();
    if (!sameState2(input.beforeState, this.lease.record.compiledAgainstSnapshot)) {
      throw new StateBoundMutationError(`Transaction ${input.transactionId} does not match the snapshot held by the writer lease`);
    }
    return this.journal.begin(input);
  }
  async recover(transactionIds, options = {}) {
    this.assertOpen();
    options.signal?.throwIfAborted();
    await this.lease.heartbeat();
    options.signal?.throwIfAborted();
    return this.journal.recover(transactionIds, options);
  }
  async heartbeat() {
    this.assertOpen();
    await this.lease.heartbeat();
  }
  async close() {
    this.assertOpen();
    await this.lease.release();
    this.closed = true;
  }
  assertOpen() {
    if (this.closed)
      throw new StateBoundMutationError("Governed worktree session is closed");
  }
};
function sameState2(left, right) {
  return left.gitBase === right.gitBase && left.worktreeDigest === right.worktreeDigest && left.canonicalProjectorDigest === right.canonicalProjectorDigest && left.toolchainDigest === right.toolchainDigest && left.pinnedExternalSnapshotDigest === right.pinnedExternalSnapshotDigest;
}

// node_modules/@projector/runtime/dist/worktrees/writer-lease.js
import { randomUUID as randomUUID3 } from "node:crypto";
import { mkdir as mkdir6, open as open6, readFile as readFile4, rename as rename4, rm as rm6, stat } from "node:fs/promises";
import { join as join8 } from "node:path";
var runtimeDirectory = ".projector/runtime";
var activeLeaseName = "writer-lease.lock";
var LeaseConflictError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "LeaseConflictError";
    this.code = code;
  }
};
var WriterLeaseHandle = class {
  manager;
  record;
  released = false;
  constructor(manager, record) {
    this.manager = manager;
    this.record = record;
  }
  async heartbeat() {
    this.assertNotReleased();
    await this.manager.heartbeat(this.record.leaseId);
  }
  async release() {
    this.assertNotReleased();
    await this.manager.release(this.record.leaseId);
    this.released = true;
  }
  assertNotReleased() {
    if (this.released) {
      throw new LeaseConflictError("lease-lost", `Lease ${this.record.leaseId} is already released`);
    }
  }
};
var MigrationRecoveryWriterLeaseHandle = class {
  manager;
  record;
  released = false;
  constructor(manager, record) {
    this.manager = manager;
    this.record = record;
  }
  async heartbeat() {
    this.assertNotReleased();
    await this.manager.heartbeat(this.record.leaseId);
  }
  async release() {
    this.assertNotReleased();
    await this.manager.release(this.record.leaseId);
    this.released = true;
  }
  assertNotReleased() {
    if (this.released)
      throw lostLease(this.record.leaseId);
  }
};
var GenerationWriterLeaseHandle = class {
  manager;
  record;
  released = false;
  constructor(manager, record) {
    this.manager = manager;
    this.record = record;
  }
  async heartbeat() {
    if (this.released)
      throw lostLease(this.record.leaseId);
    await this.manager.heartbeat(this.record.leaseId);
  }
  async release() {
    if (this.released)
      throw lostLease(this.record.leaseId);
    await this.manager.release(this.record.leaseId);
    this.released = true;
  }
};
var WriterLeaseManager = class {
  paths;
  staleAfterMs;
  now;
  constructor(paths, options) {
    this.paths = paths;
    if (!Number.isSafeInteger(options.staleAfterMs) || options.staleAfterMs <= 0) {
      throw new TypeError("staleAfterMs must be a positive integer");
    }
    this.staleAfterMs = options.staleAfterMs;
    this.now = options.now ?? (() => /* @__PURE__ */ new Date());
  }
  async acquire(owner) {
    assertOwnerIdentity(owner);
    const record = await this.acquireRecord((base) => ({
      ...base,
      sessionId: owner.sessionId,
      processId: owner.processId,
      version: 1,
      stateBinding: owner.stateBinding,
      compiledAgainstSnapshot: owner.stateBinding.compiledAgainst
    }));
    if (record.version !== 1)
      throw new Error("Internal writer lease kind mismatch");
    return new WriterLeaseHandle(this, record);
  }
  async acquireGeneration(owner) {
    assertOwnerIdentity(owner);
    assertExactKeys(owner, ["generationId", "processId", "requestHash", "sessionId", "writePaths"]);
    ContentHashSchema.parse(owner.requestHash);
    if (!/^generated_[0-9a-f-]{36}$/u.test(owner.generationId) || owner.sessionId !== owner.generationId)
      throw new TypeError("Invalid generation lease identity");
    if (owner.writePaths.length === 0 || owner.writePaths.length > 1e4 || new Set(owner.writePaths).size !== owner.writePaths.length)
      throw new TypeError("Generation lease requires unique declared write paths");
    for (const path of owner.writePaths) {
      const reserved = path.toLowerCase();
      if (this.paths.canonicalize(path) !== path || path === "." || reserved === ".git" || reserved.startsWith(".git/") || reserved === ".projector" || reserved.startsWith(".projector/"))
        throw new TypeError(`Invalid generation write scope: ${path}`);
    }
    const record = await this.acquireRecord((base) => ({ ...base, ...owner, writePaths: [...owner.writePaths], version: 3, ownerKind: "generation" }));
    if (record.version !== 3)
      throw new Error("Internal generation writer lease kind mismatch");
    return new GenerationWriterLeaseHandle(this, record);
  }
  async acquireMigrationRecovery(owner) {
    assertOwnerIdentity(owner);
    assertExactKeys(owner, [
      "attemptId",
      "backupManifestHash",
      "manifestHash",
      "migrationId",
      "processId",
      "sessionId",
      "targetSnapshotHash"
    ]);
    if (!/^[a-z0-9][a-z0-9._:-]{0,511}$/u.test(owner.attemptId))
      throw new TypeError("Invalid migration recovery attempt identity");
    if (!/^[a-z0-9][a-z0-9._:-]{0,511}$/u.test(owner.migrationId))
      throw new TypeError("Invalid migration recovery identity");
    for (const value of [owner.manifestHash, owner.targetSnapshotHash, owner.backupManifestHash])
      ContentHashSchema.parse(value);
    const record = await this.acquireRecord((base) => ({
      ...base,
      version: 2,
      ownerKind: "migration-recovery",
      sessionId: owner.sessionId,
      processId: owner.processId,
      attemptId: owner.attemptId,
      migrationId: owner.migrationId,
      manifestHash: owner.manifestHash,
      targetSnapshotHash: owner.targetSnapshotHash,
      backupManifestHash: owner.backupManifestHash
    }));
    if (record.version !== 2)
      throw new Error("Internal writer lease kind mismatch");
    return new MigrationRecoveryWriterLeaseHandle(this, record);
  }
  async acquireRecord(createRecord) {
    const runtime = await this.ensureRuntimeDirectory();
    const activePath = join8(runtime, activeLeaseName);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await mkdir6(activePath);
        const acquired = this.now();
        const expires = new Date(acquired.getTime() + this.staleAfterMs);
        const record = createRecord({
          leaseId: randomUUID3(),
          acquiredAt: acquired.toISOString(),
          heartbeatAt: acquired.toISOString(),
          expiresAt: expires.toISOString(),
          staleAfterMs: this.staleAfterMs
        });
        if (!isLeaseRecord(record))
          throw new TypeError("Writer lease owner produced an invalid persisted record");
        try {
          await writeDurableNewFile2(join8(activePath, "owner.json"), `${JSON.stringify(record)}
`);
          await writeDurableNewFile2(join8(activePath, "heartbeat"), `${record.leaseId}
`);
          const heartbeat2 = await open6(join8(activePath, "heartbeat"), "r+");
          try {
            await heartbeat2.utimes(acquired, acquired);
            await heartbeat2.sync();
          } finally {
            await heartbeat2.close();
          }
          await syncDirectory4(activePath);
          await syncDirectory4(runtime);
          return record;
        } catch (error) {
          await rm6(activePath, { recursive: true, force: true });
          throw error;
        }
      } catch (error) {
        if (!isCode5(error, "EEXIST"))
          throw error;
      }
      const existing = await this.readActiveRecord();
      const heartbeat = await stat(join8(activePath, "heartbeat")).catch((error) => {
        throw corruptLease(error);
      });
      if (this.now().getTime() - heartbeat.mtimeMs < existing.staleAfterMs) {
        throw new LeaseConflictError("lease-held", `Worktree writer lease is held by ${existing.sessionId}/${String(existing.processId)}`);
      }
      const staleDirectory = join8(runtime, "stale-leases");
      await mkdir6(staleDirectory, { recursive: true });
      const displacedPath = join8(staleDirectory, existing.leaseId);
      try {
        await rename4(activePath, displacedPath);
        await syncDirectory4(runtime);
      } catch (error) {
        if (isCode5(error, "ENOENT") || isCode5(error, "EEXIST"))
          continue;
        throw error;
      }
    }
    throw new LeaseConflictError("lease-held", "Writer lease changed repeatedly during acquisition");
  }
  async heartbeat(leaseId) {
    await this.assertOwned(leaseId);
    const heartbeatPath = await this.activeChild("heartbeat");
    const handle = await open6(heartbeatPath, "r+");
    try {
      const current = await this.readActiveRecord();
      if (current.leaseId !== leaseId)
        throw lostLease(leaseId);
      const now = this.now();
      await handle.utimes(now, now);
      await handle.sync();
    } finally {
      await handle.close();
    }
  }
  async release(leaseId) {
    await this.assertOwned(leaseId);
    const activePath = await this.activeDirectory();
    const releasedPath = join8(await this.runtimePath(), `released-${leaseId}`);
    try {
      await rename4(activePath, releasedPath);
    } catch (error) {
      if (isCode5(error, "ENOENT"))
        throw lostLease(leaseId);
      throw error;
    }
    const moved = await readLeaseRecord(join8(releasedPath, "owner.json"));
    if (moved.leaseId !== leaseId) {
      throw lostLease(leaseId);
    }
    await rm6(releasedPath, { recursive: true });
    await syncDirectory4(await this.runtimePath());
  }
  async assertOwned(leaseId) {
    let record;
    try {
      record = await this.readActiveRecord();
    } catch (error) {
      if (error instanceof LeaseConflictError && error.code === "lease-corrupt")
        throw error;
      throw lostLease(leaseId);
    }
    if (record.leaseId !== leaseId)
      throw lostLease(leaseId);
  }
  async readActiveRecord() {
    try {
      return await readLeaseRecord(await this.activeChild("owner.json"));
    } catch (error) {
      if (error instanceof LeaseConflictError)
        throw error;
      throw corruptLease(error);
    }
  }
  async ensureRuntimeDirectory() {
    const initial = await this.paths.resolveWrite(runtimeDirectory);
    await mkdir6(initial.realTarget, { recursive: true });
    return (await this.paths.resolveWrite(runtimeDirectory)).realTarget;
  }
  async runtimePath() {
    return (await this.paths.resolveWrite(runtimeDirectory)).realTarget;
  }
  async activeDirectory() {
    return (await this.paths.resolveWrite(`${runtimeDirectory}/${activeLeaseName}`)).realTarget;
  }
  async activeChild(name) {
    return (await this.paths.resolveWrite(`${runtimeDirectory}/${activeLeaseName}/${name}`)).realTarget;
  }
};
async function readLeaseRecord(path) {
  try {
    const parsed = JSON.parse(await readFile4(path, "utf8"));
    if (!isLeaseRecord(parsed))
      throw new Error("Invalid lease record");
    return parsed;
  } catch (error) {
    throw corruptLease(error);
  }
}
function isLeaseRecord(value) {
  if (typeof value !== "object" || value === null)
    return false;
  const candidate = value;
  const common = typeof candidate.leaseId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(candidate.leaseId) && typeof candidate.sessionId === "string" && candidate.sessionId.length > 0 && (typeof candidate.processId === "string" && candidate.processId.length > 0 || typeof candidate.processId === "number" && Number.isSafeInteger(candidate.processId) && candidate.processId > 0) && typeof candidate.staleAfterMs === "number" && Number.isSafeInteger(candidate.staleAfterMs) && candidate.staleAfterMs > 0 && isIsoDate(candidate.acquiredAt) && isIsoDate(candidate.heartbeatAt) && isIsoDate(candidate.expiresAt);
  if (!common)
    return false;
  if (candidate.version === 1)
    return StateBindingSchema.safeParse(candidate.stateBinding).success && StateDigestSchema.safeParse(candidate.compiledAgainstSnapshot).success && JSON.stringify(candidate.stateBinding?.compiledAgainst) === JSON.stringify(candidate.compiledAgainstSnapshot);
  if (candidate.version === 2)
    return candidate.ownerKind === "migration-recovery" && typeof candidate.attemptId === "string" && /^[a-z0-9][a-z0-9._:-]{0,511}$/u.test(candidate.attemptId) && typeof candidate.migrationId === "string" && /^[a-z0-9][a-z0-9._:-]{0,511}$/u.test(candidate.migrationId) && ContentHashSchema.safeParse(candidate.manifestHash).success && ContentHashSchema.safeParse(candidate.targetSnapshotHash).success && ContentHashSchema.safeParse(candidate.backupManifestHash).success;
  if (candidate.version === 3)
    return candidate.ownerKind === "generation" && typeof candidate.generationId === "string" && /^generated_[0-9a-f-]{36}$/u.test(candidate.generationId) && candidate.sessionId === candidate.generationId && ContentHashSchema.safeParse(candidate.requestHash).success && Array.isArray(candidate.writePaths) && candidate.writePaths.length > 0 && candidate.writePaths.length <= 1e4 && new Set(candidate.writePaths).size === candidate.writePaths.length && candidate.writePaths.every((path) => typeof path === "string" && PortableRelativePathSchema.safeParse(path).success && path !== "." && ![".git", ".projector"].some((reserved) => path.toLowerCase() === reserved || path.toLowerCase().startsWith(`${reserved}/`)));
  return false;
}
function assertOwnerIdentity(owner) {
  const validProcess = typeof owner.processId === "number" ? Number.isSafeInteger(owner.processId) && owner.processId > 0 : owner.processId.length > 0 && owner.processId.trim() === owner.processId;
  if (owner.sessionId.length === 0 || owner.sessionId.trim() !== owner.sessionId || !validProcess) {
    throw new TypeError("A writer lease requires process and session identity");
  }
}
function assertExactKeys(value, expected) {
  const actual = Object.keys(value).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError("Writer lease owner contains unexpected keys or missing fields");
  }
}
function isIsoDate(value) {
  if (typeof value !== "string")
    return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}
async function writeDurableNewFile2(path, content) {
  const handle = await open6(path, "wx");
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function syncDirectory4(path) {
  const handle = await open6(path, "r");
  try {
    await handle.sync();
  } catch (error) {
    if (!isCode5(error, "EINVAL") && !isCode5(error, "ENOTSUP") && !isCode5(error, "EPERM"))
      throw error;
  } finally {
    await handle.close();
  }
}
function corruptLease(cause) {
  return new LeaseConflictError("lease-corrupt", `Writer lease is unreadable and requires recovery: ${cause instanceof Error ? cause.message : String(cause)}`);
}
function lostLease(leaseId) {
  return new LeaseConflictError("lease-lost", `Writer lease ${leaseId} is no longer active`);
}
function isCode5(error, code) {
  return error instanceof Error && "code" in error && error.code === code;
}

// node_modules/@projector/runtime/dist/transforms/contracts.js
var TransformScopeError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "TransformScopeError";
  }
};
var TransformPreconditionError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "TransformPreconditionError";
  }
};

// node_modules/@projector/runtime/dist/transforms/exact-text-patch.js
var compare2 = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var unique2 = (values) => [...new Set(values)].sort(compare2);
var contentHash = (content) => hashFramedDomain("transform-content", content);
function canonicalPath(path) {
  return path.length > 0 && path === path.replace(/\\/gu, "/").replace(/^\.\//u, "").replace(/\/{2,}/gu, "/").replace(/\/$/u, "") && !path.startsWith("/") && !/^[A-Za-z]:/u.test(path) && !path.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
}
function pathMatchesBoundary(path, boundary) {
  return boundary.some((pattern) => {
    if (pattern === "**" || pattern === ".")
      return true;
    if (pattern.endsWith("/**")) {
      const root = pattern.slice(0, -3).replace(/\/$/u, "");
      return path === root || path.startsWith(`${root}/`);
    }
    return path === pattern;
  });
}
var ExactTextPatchTransform = class {
  mutation;
  id = "exact-text-patch";
  version = "1";
  description = "Create, replace, or delete UTF-8 files with exact before-content preconditions";
  now;
  appliedInputs = /* @__PURE__ */ new WeakMap();
  constructor(mutation, options = {}) {
    this.mutation = mutation;
    this.now = options.now ?? (() => (/* @__PURE__ */ new Date()).toISOString());
  }
  async applies(input, context) {
    return (await this.prepare(input, context, "before")).length > 0;
  }
  async preview(input, context) {
    const edits = await this.prepare(input, context, "before");
    return {
      applicable: edits.length > 0,
      operations: edits.map(({ unitId, path, beforeHash, afterHash, after }) => ({
        kind: after === null ? "delete-file" : "write-file",
        unitId,
        path,
        beforeHash,
        afterHash,
        provenance: "source"
      })),
      touchedUnitIds: unique2(edits.map(({ unitId }) => unitId)),
      expectedDiff: edits.map(({ path, before, after }) => before === null ? `create ${path}` : after === null ? `delete ${path}` : `replace ${path}`).join("\n"),
      warnings: []
    };
  }
  async apply(input, context) {
    const edits = await this.prepare(input, context, "before");
    if (context.dryRun || edits.length === 0) {
      return { transformId: this.id, changed: false, touchedUnitIds: [], operations: [] };
    }
    await this.mutation.checkpoint(`${this.id}@${this.version}:before`);
    const evidence = [];
    try {
      for (const [index, edit] of edits.entries()) {
        if (context.signal.aborted)
          throw new Error("transform aborted");
        if (edit.after === null)
          await this.mutation.deleteFile(edit.path);
        else
          await this.mutation.writeFile(edit.path, edit.after);
        evidence.push({
          operationId: `${this.id}:${index + 1}`,
          executor: "transform",
          unitIds: [edit.unitId],
          beforeHashes: [edit.beforeHash],
          afterHashes: [edit.afterHash],
          evidenceIds: [],
          summary: edit.after === null ? `deleted ${edit.path}` : edit.before === null ? `created ${edit.path}` : `replaced ${edit.path}`
        });
      }
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error("exact text patch failed");
      const partial = error;
      partial.partialResult ??= {
        transformId: this.id,
        changed: evidence.length > 0,
        touchedUnitIds: unique2(evidence.flatMap(({ unitIds }) => unitIds)),
        operations: evidence,
        checkpointId: `${this.id}@${this.version}:before`
      };
      throw partial;
    }
    await this.mutation.checkpoint(`${this.id}@${this.version}:after`);
    const result = {
      transformId: this.id,
      changed: true,
      touchedUnitIds: unique2(edits.map(({ unitId }) => unitId)),
      operations: evidence,
      checkpointId: `${this.id}@${this.version}:after`
    };
    this.appliedInputs.set(result, structuredClone(input));
    return result;
  }
  async verify(result, context) {
    const startedAt = this.now();
    const violations = [];
    const input = this.appliedInputs.get(result);
    if (result.changed && input === void 0) {
      violations.push("transform result is not associated with this transform execution");
    } else if (input !== void 0) {
      try {
        await this.prepare(input, context, "after");
      } catch (error) {
        violations.push(error instanceof Error ? error.message : "postcondition verification failed");
      }
    }
    if (context.signal.aborted)
      violations.push("verification aborted");
    return [{
      validatorId: `${this.id}.verify`,
      status: violations.length === 0 ? "passed" : "blocked",
      summary: violations.length === 0 ? "exact text patch postconditions verified" : violations.join("; "),
      evidenceIds: [],
      evidenceLane: "runtime",
      independenceGroup: "deterministic-transform",
      assurance: "exact",
      authorSource: `${this.id}@${this.version}`,
      sideEffectClass: "none",
      details: { violations },
      startedAt,
      completedAt: this.now()
    }];
  }
  async prepare(input, context, expectedSide) {
    const approvedBoundary = context.approvedBoundary;
    const authorization = context.writeAuthorization;
    if (approvedBoundary === void 0 || approvedBoundary.length === 0)
      throw new TransformScopeError("transform context has no approved path boundary");
    if (authorization === void 0)
      throw new TransformScopeError("transform context has no compiled write authorization");
    if (input.edits.length === 0)
      throw new TransformPreconditionError("exact text patch requires at least one edit");
    const allowedUnits = new Set(context.allowedUnits);
    const paths = /* @__PURE__ */ new Set();
    const prepared = [];
    for (const edit of [...input.edits].sort((left, right) => compare2(left.path, right.path))) {
      if (!canonicalPath(edit.path))
        throw new TransformScopeError(`transform path is not canonical repository-relative: ${edit.path}`);
      if (paths.has(edit.path))
        throw new TransformPreconditionError(`duplicate exact text edit: ${edit.path}`);
      paths.add(edit.path);
      if (!allowedUnits.has(edit.unitId))
        throw new TransformScopeError(`unit is outside the granted transform scope: ${edit.unitId}`);
      if (!pathMatchesBoundary(edit.path, approvedBoundary) || !authorizeRepositoryPath(authorization, edit.path).authorized) {
        throw new TransformScopeError(`exact text edit is outside the approved boundary: ${edit.path}`);
      }
      if (edit.before === edit.after)
        throw new TransformPreconditionError(`exact text edit is a no-op: ${edit.path}`);
      await this.mutation.assertWritable(edit.path);
      const actual = await this.mutation.readFile(edit.path) ?? null;
      const expected = expectedSide === "before" ? edit.before : edit.after;
      if (actual !== expected) {
        throw new TransformPreconditionError(`exact ${expectedSide} content mismatch: ${edit.path}`);
      }
      prepared.push({ ...edit, beforeHash: contentHash(edit.before), afterHash: contentHash(edit.after) });
    }
    return prepared;
  }
};

// node_modules/@projector/runtime/dist/transforms/index.js
var compareStrings = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var sortedUnique = (values) => [...new Set(values)].sort(compareStrings);
function provenanceRank(provenance) {
  return provenance === "source" ? 0 : 1;
}
function operationPath(operation) {
  return operation.kind === "move" ? operation.from : operation.path;
}
function orderOperations(operations) {
  return [...operations].sort((left, right) => provenanceRank(left.provenance) - provenanceRank(right.provenance) || (left.kind === "move" ? 0 : 1) - (right.kind === "move" ? 0 : 1) || compareStrings(operationPath(left), operationPath(right)));
}
function assertRelativeRepositoryPath(path) {
  if (path.length === 0 || path.startsWith("/") || path.startsWith("\\") || /^[A-Za-z]:/u.test(path) || path.split(/[\\/]/u).some((segment) => segment === ".." || segment.length === 0)) {
    throw new TransformScopeError(`transform path is outside the repository-relative scope: ${path}`);
  }
}
function countOccurrences(content, anchor) {
  if (anchor.length === 0)
    throw new TransformPreconditionError("reference anchor cannot be empty");
  return content.split(anchor).length - 1;
}
function contentHash2(content) {
  return hashFramedDomain("transform-content", content);
}
function pathMatchesBoundary2(path, boundary) {
  return boundary.some((pattern) => {
    if (pattern === "**")
      return true;
    if (pattern.endsWith("/**")) {
      const root = pattern.slice(0, -3).replace(/\/$/u, "");
      return path === root || path.startsWith(`${root}/`);
    }
    return path === pattern;
  });
}
var MoveReferenceTransform = class {
  mutation;
  id = "move-reference-update";
  version = "1";
  description = "Move projection units and update exact registered references";
  now;
  appliedInputs = /* @__PURE__ */ new WeakMap();
  constructor(mutation, options = {}) {
    this.mutation = mutation;
    this.now = options.now ?? (() => (/* @__PURE__ */ new Date()).toISOString());
  }
  async applies(input, context) {
    return (await this.prepare(input, context)).length > 0;
  }
  async preview(input, context) {
    const operations = await this.prepare(input, context);
    return {
      applicable: operations.length > 0,
      operations: operations.map((operation) => operation.kind === "move" ? {
        kind: operation.kind,
        unitId: operation.unitId,
        from: operation.from,
        to: operation.to,
        provenance: operation.provenance
      } : {
        kind: operation.kind,
        unitId: operation.unitId,
        path: operation.path,
        from: operation.from,
        to: operation.to,
        provenance: operation.provenance
      }),
      touchedUnitIds: sortedUnique(operations.map((operation) => operation.unitId)),
      expectedDiff: operations.map((operation) => operation.kind === "move" ? `move ${operation.from} -> ${operation.to}` : `replace ${JSON.stringify(operation.from)} with ${JSON.stringify(operation.to)} in ${operation.path}`).join("\n"),
      warnings: []
    };
  }
  async apply(input, context) {
    const operations = await this.prepare(input, context);
    if (context.dryRun || operations.length === 0) {
      const result2 = { transformId: this.id, changed: false, touchedUnitIds: [], operations: [] };
      if (!context.dryRun)
        this.appliedInputs.set(result2, structuredClone(input));
      return result2;
    }
    await this.mutation.checkpoint(`${this.id}@${this.version}:before`);
    const evidence = [];
    try {
      for (const [index, operation] of operations.entries()) {
        if (context.signal.aborted)
          throw new Error("transform aborted");
        if (operation.kind === "move") {
          await this.mutation.moveFile(operation.from, operation.to);
          evidence.push({
            operationId: `${this.id}:move:${index + 1}`,
            executor: "transform",
            unitIds: [operation.unitId],
            beforeHashes: [contentHash2(operation.content)],
            afterHashes: [contentHash2(operation.content)],
            evidenceIds: [],
            summary: `moved ${operation.from} to ${operation.to}`
          });
        } else {
          await this.mutation.writeFile(operation.path, operation.after);
          evidence.push({
            operationId: `${this.id}:reference:${index + 1}`,
            executor: "transform",
            unitIds: [operation.unitId],
            beforeHashes: [contentHash2(operation.before)],
            afterHashes: [contentHash2(operation.after)],
            evidenceIds: [],
            summary: `updated registered reference in ${operation.path}`
          });
        }
      }
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error("transform mutation failed");
      const partial = error;
      partial.partialResult ??= {
        transformId: this.id,
        changed: evidence.length > 0,
        touchedUnitIds: sortedUnique(evidence.flatMap((operation) => operation.unitIds)),
        operations: evidence,
        checkpointId: `${this.id}@${this.version}:before`
      };
      throw partial;
    }
    await this.mutation.checkpoint(`${this.id}@${this.version}:after`);
    const result = {
      transformId: this.id,
      changed: true,
      touchedUnitIds: sortedUnique(operations.map((operation) => operation.unitId)),
      operations: evidence,
      checkpointId: `${this.id}@${this.version}:after`
    };
    this.appliedInputs.set(result, structuredClone(input));
    return result;
  }
  async verify(result, context) {
    const startedAt = this.now();
    const violations = [];
    const appliedInput = this.appliedInputs.get(result);
    if (result.changed && appliedInput === void 0) {
      violations.push("transform result is not associated with this transform execution");
    } else if (appliedInput !== void 0) {
      try {
        const remaining = await this.prepare(appliedInput, context);
        if (remaining.length > 0)
          violations.push(`${remaining.length} postcondition operations remain`);
      } catch (error) {
        violations.push(error instanceof Error ? error.message : "postcondition verification failed");
      }
    }
    if (context.signal.aborted)
      violations.push("verification aborted");
    const completedAt = this.now();
    return [{
      validatorId: `${this.id}.verify`,
      status: violations.length === 0 ? "passed" : "blocked",
      summary: violations.length === 0 ? "move/reference postconditions verified" : violations.join("; "),
      evidenceIds: [],
      evidenceLane: "runtime",
      independenceGroup: "deterministic-transform",
      assurance: "exact",
      authorSource: `${this.id}@${this.version}`,
      sideEffectClass: "none",
      details: { violations },
      startedAt,
      completedAt
    }];
  }
  async prepare(input, context) {
    const allowedUnits = new Set(context.allowedUnits);
    const approvedBoundary = context.approvedBoundary;
    if (approvedBoundary === void 0 || approvedBoundary.length === 0) {
      throw new TransformScopeError("transform context has no approved path boundary");
    }
    const writeAuthorization = context.writeAuthorization;
    if (writeAuthorization === void 0) {
      throw new TransformScopeError("transform context has no compiled write authorization");
    }
    const pathIsApproved = (path) => pathMatchesBoundary2(path, approvedBoundary) && authorizeRepositoryPath(writeAuthorization, path).authorized;
    const operations = [];
    const destinations = /* @__PURE__ */ new Set();
    const movePaths = /* @__PURE__ */ new Set();
    const moveSources = /* @__PURE__ */ new Set();
    for (const move of input.moves) {
      if (moveSources.has(move.from))
        throw new TransformPreconditionError(`duplicate move source claim: ${move.from}`);
      if (destinations.has(move.to))
        throw new TransformPreconditionError(`duplicate move destination: ${move.to}`);
      moveSources.add(move.from);
      destinations.add(move.to);
    }
    const referenceClaims = /* @__PURE__ */ new Set();
    const referencesByPath = /* @__PURE__ */ new Map();
    for (const reference of input.references) {
      const claim = `${reference.path}\0${reference.from}`;
      if (referenceClaims.has(claim)) {
        throw new TransformPreconditionError(`duplicate reference claim: ${reference.path} ${reference.from}`);
      }
      referenceClaims.add(claim);
      if (reference.from === reference.to || reference.from.includes(reference.to) || reference.to.includes(reference.from)) {
        throw new TransformPreconditionError(`non-convergent replacement in ${reference.path}: ${reference.from} -> ${reference.to}`);
      }
      const prior = referencesByPath.get(reference.path) ?? [];
      const overlap = prior.find((candidate) => reference.to.includes(candidate.from) || candidate.to.includes(reference.from));
      if (overlap !== void 0) {
        throw new TransformPreconditionError(`overlapping replacement claims in ${reference.path}`);
      }
      prior.push(reference);
      referencesByPath.set(reference.path, prior);
    }
    for (const move of input.moves) {
      this.assertUnitAllowed(move.unitId, allowedUnits);
      assertRelativeRepositoryPath(move.from);
      assertRelativeRepositoryPath(move.to);
      if (!pathIsApproved(move.from) || !pathIsApproved(move.to)) {
        throw new TransformScopeError(`move path is outside the approved boundary: ${move.from} -> ${move.to}`);
      }
      if (move.from === move.to)
        throw new TransformPreconditionError(`move source equals destination: ${move.from}`);
      movePaths.add(move.from);
      movePaths.add(move.to);
      await this.mutation.assertWritable(move.from);
      await this.mutation.assertWritable(move.to);
      const [source, destination] = await Promise.all([
        this.mutation.readFile(move.from),
        this.mutation.readFile(move.to)
      ]);
      if (source === void 0) {
        if (destination === void 0) {
          throw new TransformPreconditionError(`move source and destination are both missing: ${move.from}, ${move.to}`);
        }
        if (move.expectedContentHash === void 0) {
          throw new TransformPreconditionError(`missing move source requires an expected content identity: ${move.from}`);
        }
        if (contentHash2(destination) !== move.expectedContentHash) {
          throw new TransformPreconditionError(`move destination content identity does not match approval: ${move.to}`);
        }
        continue;
      }
      if (contentHash2(source) !== move.expectedContentHash) {
        throw new TransformPreconditionError(`move source content identity does not match approval: ${move.from}`);
      }
      if (destination !== void 0) {
        throw new TransformPreconditionError(`move destination collision: ${move.to}`);
      }
      operations.push({ kind: "move", ...move, content: source });
    }
    const referenceContents = /* @__PURE__ */ new Map();
    const references = [...input.references].sort((left, right) => provenanceRank(left.provenance) - provenanceRank(right.provenance) || compareStrings(left.path, right.path) || compareStrings(left.from, right.from) || compareStrings(left.to, right.to) || compareStrings(left.unitId, right.unitId));
    for (const reference of references) {
      this.assertUnitAllowed(reference.unitId, allowedUnits);
      assertRelativeRepositoryPath(reference.path);
      if (!pathIsApproved(reference.path)) {
        throw new TransformScopeError(`reference path is outside the approved boundary: ${reference.path}`);
      }
      if (movePaths.has(reference.path)) {
        throw new TransformPreconditionError(`reference file also participates in a move: ${reference.path}`);
      }
      if (!Number.isSafeInteger(reference.expectedOccurrences) || reference.expectedOccurrences < 1) {
        throw new TransformPreconditionError(`invalid expected occurrence count for ${reference.path}`);
      }
      await this.mutation.assertWritable(reference.path);
      const content = referenceContents.get(reference.path) ?? await this.mutation.readFile(reference.path);
      if (content === void 0)
        throw new TransformPreconditionError(`reference file is missing: ${reference.path}`);
      const oldCount = countOccurrences(content, reference.from);
      if (oldCount === 0 && countOccurrences(content, reference.to) >= reference.expectedOccurrences)
        continue;
      if (oldCount !== reference.expectedOccurrences) {
        throw new TransformPreconditionError(`unresolved reference anchor in ${reference.path}: expected ${reference.expectedOccurrences}, found ${oldCount}`);
      }
      const after = content.split(reference.from).join(reference.to);
      referenceContents.set(reference.path, after);
      operations.push({
        kind: "update-reference",
        ...reference,
        before: content,
        after
      });
    }
    return orderOperations(operations);
  }
  assertUnitAllowed(unitId, allowedUnits) {
    if (!allowedUnits.has(unitId))
      throw new TransformScopeError(`unit is outside the granted transform scope: ${unitId}`);
  }
};
var TransformClaimConflictError = class extends Error {
  constructor(unitId, transformIds) {
    super(`exclusive transform claim collision for ${unitId}: ${sortedUnique(transformIds).join(", ")}`);
    this.name = "TransformClaimConflictError";
  }
};
function normalizeMetadata(metadata) {
  const convergence = metadata.convergence.kind === "idempotent" ? Object.freeze({ kind: "idempotent" }) : Object.freeze({ kind: "bounded-fixed-point", maximumIterations: metadata.convergence.maximumIterations });
  if (convergence.kind === "bounded-fixed-point" && (!Number.isSafeInteger(convergence.maximumIterations) || convergence.maximumIterations < 1)) {
    throw new TypeError("bounded transform convergence requires a positive maximum iteration count");
  }
  return Object.freeze({
    preconditions: Object.freeze(sortedUnique(metadata.preconditions)),
    writeScope: Object.freeze(sortedUnique(metadata.writeScope)),
    predecessors: Object.freeze(sortedUnique(metadata.predecessors)),
    exclusions: Object.freeze(sortedUnique(metadata.exclusions)),
    commutativity: metadata.commutativity,
    postconditions: Object.freeze(sortedUnique(metadata.postconditions)),
    unitClaim: metadata.unitClaim,
    convergence
  });
}
var TransformRegistry = class {
  transforms = /* @__PURE__ */ new Map();
  register(registration) {
    const registeredId = registration.implementation.id;
    const registeredVersion = registration.implementation.version;
    if (registeredId.length === 0 || registeredVersion.length === 0) {
      throw new TypeError("transform identity and version cannot be blank");
    }
    const key = this.key(registeredId, registeredVersion);
    if (this.transforms.has(key))
      throw new TypeError(`transform already registered: ${key}`);
    const normalized = Object.freeze({
      implementation: registration.implementation,
      metadata: normalizeMetadata(registration.metadata)
    });
    this.transforms.set(key, Object.freeze({ registeredId, registeredVersion, registration: normalized }));
  }
  get(id, version) {
    const entry = this.transforms.get(this.key(id, version));
    if (entry === void 0)
      return void 0;
    this.assertIdentity(entry);
    return entry.registration;
  }
  orderInvocations(invocations) {
    return this.compositionGroups(invocations).flatMap((group) => group.invocations);
  }
  async convergeInvocations(invocations, execute) {
    const groups = this.compositionGroups(invocations);
    let iterations = groups.length === 0 ? 0 : 1;
    for (const group of groups) {
      if (group.kind === "sequential") {
        for (const invocation of group.invocations)
          await execute(invocation, 1);
        continue;
      }
      let converged = false;
      for (let iteration = 1; iteration <= group.maximumIterations; iteration += 1) {
        let changed = false;
        for (const invocation of group.invocations) {
          const result = await execute(invocation, iteration);
          changed ||= result.changed;
        }
        iterations = Math.max(iterations, iteration);
        if (!changed) {
          converged = true;
          break;
        }
      }
      if (!converged) {
        throw new Error(`transform fixed-point group ${group.invocations.map((invocation) => invocation.transformId).join(", ")} did not converge within ${group.maximumIterations} iterations`);
      }
    }
    return { converged: true, iterations };
  }
  compositionGroups(invocations) {
    const claims = /* @__PURE__ */ new Map();
    const registeredInvocations = invocations.map((invocation) => {
      const registration = this.get(invocation.transformId, invocation.version);
      if (registration === void 0) {
        throw new TypeError(`unknown transform: ${invocation.transformId}@${invocation.version}`);
      }
      return { invocation, registration };
    });
    const invokedIds = new Set(invocations.map((invocation) => invocation.transformId));
    const registrationById = /* @__PURE__ */ new Map();
    for (const { invocation, registration } of registeredInvocations) {
      const existing = registrationById.get(invocation.transformId);
      if (existing !== void 0 && existing.implementation.version !== invocation.version) {
        throw new TypeError(`multiple versions of transform ${invocation.transformId} cannot share one composition`);
      }
      registrationById.set(invocation.transformId, registration);
      for (const excludedId of registration.metadata.exclusions) {
        if (invokedIds.has(excludedId)) {
          throw new TypeError(`transform ${invocation.transformId} excludes ${excludedId}`);
        }
      }
      for (const predecessorId of registration.metadata.predecessors) {
        if (!invokedIds.has(predecessorId)) {
          throw new TypeError(`transform ${invocation.transformId} requires predecessor ${predecessorId}`);
        }
      }
      if (registration.metadata.unitClaim !== "exclusive")
        continue;
      for (const unitId of sortedUnique(invocation.unitIds)) {
        const owners = claims.get(unitId) ?? [];
        owners.push(`${invocation.transformId}@${invocation.version}`);
        claims.set(unitId, owners);
      }
    }
    for (const [unitId, owners] of claims) {
      if (owners.length > 1)
        throw new TransformClaimConflictError(unitId, owners);
    }
    let nextIndex = 0;
    const indices = /* @__PURE__ */ new Map();
    const lowLinks = /* @__PURE__ */ new Map();
    const stack = [];
    const onStack = /* @__PURE__ */ new Set();
    const components = [];
    const visit = (id) => {
      const ownIndex = nextIndex;
      nextIndex += 1;
      indices.set(id, ownIndex);
      lowLinks.set(id, ownIndex);
      stack.push(id);
      onStack.add(id);
      const registration = registrationById.get(id);
      if (registration === void 0)
        throw new TypeError(`unknown transform in composition: ${id}`);
      for (const predecessor of registration.metadata.predecessors) {
        if (!indices.has(predecessor)) {
          visit(predecessor);
          lowLinks.set(id, Math.min(lowLinks.get(id) ?? ownIndex, lowLinks.get(predecessor) ?? ownIndex));
        } else if (onStack.has(predecessor)) {
          lowLinks.set(id, Math.min(lowLinks.get(id) ?? ownIndex, indices.get(predecessor) ?? ownIndex));
        }
      }
      if (lowLinks.get(id) === ownIndex) {
        const component = [];
        let member;
        do {
          member = stack.pop();
          if (member === void 0)
            throw new Error("invalid transform component stack");
          onStack.delete(member);
          component.push(member);
        } while (member !== id);
        components.push(component.sort(compareStrings));
      }
    };
    for (const id of [...invokedIds].sort(compareStrings))
      if (!indices.has(id))
        visit(id);
    const componentById = /* @__PURE__ */ new Map();
    components.forEach((component, index) => component.forEach((id) => componentById.set(id, index)));
    const outgoing = components.map(() => /* @__PURE__ */ new Set());
    const indegree = components.map(() => 0);
    for (const [id, registration] of registrationById) {
      const currentComponent = componentById.get(id);
      if (currentComponent === void 0)
        throw new Error(`missing component for ${id}`);
      for (const predecessor of registration.metadata.predecessors) {
        const predecessorComponent = componentById.get(predecessor);
        if (predecessorComponent === void 0 || predecessorComponent === currentComponent)
          continue;
        const edges = outgoing[predecessorComponent];
        if (edges !== void 0 && !edges.has(currentComponent)) {
          edges.add(currentComponent);
          indegree[currentComponent] = (indegree[currentComponent] ?? 0) + 1;
        }
      }
    }
    const groups = [];
    const remainingComponents = new Set(components.map((_component, index) => index));
    while (remainingComponents.size > 0) {
      const ready = [...remainingComponents].filter((index) => indegree[index] === 0).sort((left, right) => compareStrings(components[left]?.[0] ?? "", components[right]?.[0] ?? ""));
      if (ready.length === 0)
        throw new Error("transform component graph is cyclic");
      for (const componentIndex of ready) {
        const component = components[componentIndex] ?? [];
        const selfCycle = component.some((id) => registrationById.get(id)?.metadata.predecessors.includes(id));
        const isCycle = component.length > 1 || selfCycle;
        const convergences = component.map((id) => registrationById.get(id)?.metadata.convergence);
        if (isCycle && convergences.some((convergence) => convergence?.kind !== "bounded-fixed-point")) {
          throw new TypeError(`transform predecessor cycle is not declared bounded-convergent: ${component.join(", ")}`);
        }
        const maximumIterations = isCycle ? Math.min(...convergences.map((convergence) => convergence?.kind === "bounded-fixed-point" ? convergence.maximumIterations : 0)) : 1;
        const componentInvocations = registeredInvocations.filter(({ invocation }) => component.includes(invocation.transformId)).map(({ invocation }) => structuredClone(invocation)).sort((left, right) => compareStrings(left.transformId, right.transformId) || compareStrings(left.version, right.version));
        groups.push({
          kind: isCycle ? "bounded-fixed-point" : "sequential",
          invocations: componentInvocations,
          maximumIterations
        });
        remainingComponents.delete(componentIndex);
        for (const dependent of outgoing[componentIndex] ?? []) {
          indegree[dependent] = (indegree[dependent] ?? 0) - 1;
        }
      }
    }
    return groups;
  }
  assertIdentity(entry) {
    if (entry.registration.implementation.id !== entry.registeredId || entry.registration.implementation.version !== entry.registeredVersion) {
      throw new Error(`transform implementation identity drift: expected ${entry.registeredId}@${entry.registeredVersion}, received ${entry.registration.implementation.id}@${entry.registration.implementation.version}`);
    }
  }
  key(id, version) {
    return `${id}@${version}`;
  }
};

// node_modules/@projector/runtime/dist/operations/watch.js
import { mkdir as mkdir7, readFile as readFile5, rename as rename5, rm as rm7, writeFile } from "node:fs/promises";
import { posix as posix3 } from "node:path";
var unique3 = (values) => [...new Set(values)].sort();
var WatchCoordinator = class {
  ports;
  options;
  tail = Promise.resolve();
  constructor(ports, options = {}) {
    this.ports = ports;
    this.options = options;
  }
  submit(events) {
    const run = this.tail.then(() => this.run(events));
    this.tail = run.catch(() => void 0);
    return run;
  }
  async run(initial) {
    let events = [...initial];
    const seen = /* @__PURE__ */ new Set();
    const maximum = this.options.maximumIterations ?? 8;
    let latest;
    for (let iteration = 1; iteration <= maximum; iteration += 1) {
      const fullScan = events.some(({ kind }) => kind === "overflow");
      const paths = unique3(events.flatMap(({ path, to }) => [path, ...to === void 0 ? [] : [to]]).filter((path) => path !== "."));
      const scan = await this.ports.scan({ fullScan, paths, events: [...events] });
      const value = { digest: scan.digest, affectedDependencyIds: [...scan.affectedDependencyIds], generatedEventIds: [...scan.generatedEventIds] };
      if (scan.contentHash !== hashFramedDomain("authenticated-watch-scan", value))
        throw new Error("watch scan authentication failed");
      const processed = await this.ports.process(scan);
      if (processed.digest !== scan.digest)
        throw new Error("watch process digest mismatch");
      const invalidated = unique3(scan.affectedDependencyIds);
      latest = { digest: scan.digest, fullScan, paths, invalidatedDependencyIds: invalidated, preservedCacheKeys: unique3(processed.cacheKeys.filter((key) => !invalidated.includes(key))), generatedEventIds: unique3(scan.generatedEventIds), iterations: iteration };
      const follow = processed.followUpEvents ?? [];
      if (follow.length === 0)
        return latest;
      if (seen.has(scan.digest))
        throw new Error(`nonconvergent watch repeated digest ${scan.digest}`);
      seen.add(scan.digest);
      events = [...follow];
    }
    throw new Error(`nonconvergent watch exceeded ${maximum} iterations (${latest?.digest ?? "no digest"})`);
  }
};
var checkpointBody = (checkpoint) => ({ version: 1, sequence: checkpoint.sequence, pendingEvents: checkpoint.pendingEvents, lastResult: checkpoint.lastResult });
function authenticateWatchCheckpoint(checkpoint) {
  return checkpoint.version === 1 && Number.isSafeInteger(checkpoint.sequence) && checkpoint.sequence >= 0 && checkpoint.contentHash === hashFramedDomain("authenticated-watch-checkpoint", checkpointBody(checkpoint));
}
var FileWatchCheckpointStore = class _FileWatchCheckpointStore {
  paths;
  path;
  constructor(paths, path) {
    this.paths = paths;
    this.path = path;
  }
  static async create(paths, path = ".projector/watch/checkpoint.json") {
    const canonical = paths.canonicalize(path);
    await mkdir7((await paths.resolveWrite(posix3.dirname(canonical))).realTarget, { recursive: true });
    return new _FileWatchCheckpointStore(paths, canonical);
  }
  async load() {
    let bytes;
    try {
      bytes = await readFile5((await this.paths.resolveRead(this.path)).realTarget, "utf8");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return null;
      throw error;
    }
    let checkpoint;
    try {
      checkpoint = JSON.parse(bytes);
    } catch {
      throw new Error("watch checkpoint is corrupt");
    }
    if (!authenticateWatchCheckpoint(checkpoint))
      throw new Error("watch checkpoint authentication failed");
    return checkpoint;
  }
  async save(checkpoint) {
    if (!authenticateWatchCheckpoint(checkpoint))
      throw new Error("watch checkpoint authentication failed");
    const temporary = `${this.path}.${process.pid}.tmp`;
    const target = await this.paths.resolveWrite(this.path);
    const temporaryTarget = await this.paths.resolveWrite(temporary);
    try {
      await writeFile(temporaryTarget.realTarget, `${JSON.stringify(checkpoint)}
`, { encoding: "utf8", flag: "wx" });
      await rename5(temporaryTarget.realTarget, target.realTarget);
    } finally {
      await rm7(temporaryTarget.realTarget, { force: true });
    }
    return checkpoint;
  }
  async clear(contentHash4) {
    const checkpoint = await this.load();
    if (checkpoint === null)
      return;
    if (checkpoint.contentHash !== contentHash4)
      throw new Error("watch checkpoint changed before clear");
    await rm7((await this.paths.resolveWrite(this.path)).realTarget, { force: true });
  }
};
async function runWatchLifecycle(coordinator, source, options) {
  const maximumEvents = options.maximumEvents ?? 1e4;
  if (!Number.isSafeInteger(maximumEvents) || maximumEvents < 1)
    throw new Error("watch event budget must be positive");
  const prior = await options.checkpointStore?.load() ?? null;
  if (prior !== null && !authenticateWatchCheckpoint(prior))
    throw new Error("watch checkpoint authentication failed");
  let processedEvents = 0;
  let lastResult;
  let tail = Promise.resolve();
  const pendingEvents = [];
  let settle;
  let rejectFailure;
  const done = new Promise((resolve3, reject) => {
    settle = resolve3;
    rejectFailure = reject;
  });
  const enqueue2 = (events) => {
    tail = tail.then(async () => {
      const capacity = maximumEvents - processedEvents;
      const accepted = events.slice(0, Math.max(0, capacity));
      pendingEvents.push(...events.slice(accepted.length));
      if (accepted.length > 0) {
        processedEvents += accepted.length;
        lastResult = await coordinator.submit(accepted);
      }
      if (processedEvents >= maximumEvents)
        settle?.();
    }).catch((error) => rejectFailure?.(error));
  };
  let closed = false;
  const closeSource = source.subscribe((event) => enqueue2([event]), (error) => rejectFailure?.(error));
  const close = () => {
    if (!closed) {
      closed = true;
      closeSource();
    }
  };
  const abort = () => settle?.();
  options.signal.addEventListener("abort", abort, { once: true });
  try {
    lastResult = await coordinator.submit([{ kind: "overflow", path: "." }]);
    if (prior !== null)
      enqueue2(prior.pendingEvents);
    if (options.signal.aborted)
      settle?.();
    await done;
    close();
    await tail;
    if (lastResult === void 0)
      throw new Error("watch lifecycle produced no authenticated scan");
    const budgetExhausted = !options.signal.aborted && processedEvents >= maximumEvents;
    if (budgetExhausted) {
      if (options.checkpointStore === void 0)
        return { cancelled: false, budgetExhausted, processedEvents, lastResult };
      const body = { version: 1, sequence: (prior?.sequence ?? 0) + processedEvents, pendingEvents: [...pendingEvents], lastResult };
      const checkpoint = await options.checkpointStore.save({ ...body, contentHash: hashFramedDomain("authenticated-watch-checkpoint", body) });
      return { cancelled: false, budgetExhausted, processedEvents, lastResult, checkpoint };
    }
    if (prior !== null && options.checkpointStore !== void 0)
      await options.checkpointStore.clear(prior.contentHash);
    return { cancelled: options.signal.aborted, budgetExhausted: false, processedEvents, lastResult };
  } finally {
    close();
    options.signal.removeEventListener("abort", abort);
  }
}

// node_modules/@projector/runtime/dist/operations/telemetry.js
import { appendFile, mkdir as mkdir8, readFile as readFile6, rm as rm8 } from "node:fs/promises";
import { posix as posix4 } from "node:path";
import { z as z2 } from "zod";
var OperationalExitProofSchema = z2.strictObject({
  commandFailed: z2.boolean(),
  blockingInvalidity: z2.boolean(),
  approvalRequired: z2.boolean(),
  incompleteCoverage: z2.boolean(),
  requiredUnavailable: z2.boolean(),
  recoveryFailure: z2.boolean(),
  budgetExhausted: z2.boolean(),
  resumable: z2.boolean()
});
var UnavailableOperationalEvidenceSchema = z2.strictObject({ unavailable: z2.string() });
var OperationalEvidenceValueSchema = z2.union([ContentHashSchema, UnavailableOperationalEvidenceSchema]);
var OperationalRunEvidenceSchema = z2.strictObject({
  configDigest: OperationalEvidenceValueSchema,
  toolchainDigest: OperationalEvidenceValueSchema,
  gitHead: OperationalEvidenceValueSchema,
  worktreeDigest: OperationalEvidenceValueSchema,
  canonicalDigest: OperationalEvidenceValueSchema,
  graphRecords: z2.array(z2.string()),
  analyzerRecords: z2.array(z2.string()),
  modelRecords: z2.array(z2.string()),
  snapshotRecords: z2.array(z2.string()),
  decisionRecords: z2.array(z2.string()),
  transformRecords: z2.array(z2.string()),
  validationRecords: z2.array(z2.string()),
  journalRecords: z2.array(z2.string()),
  errorRecords: z2.array(z2.string()),
  durationMs: z2.union([z2.number().finite().nonnegative(), UnavailableOperationalEvidenceSchema])
});
var OperationalFindingSchema = z2.strictObject({
  id: ContentHashSchema,
  code: z2.string(),
  title: z2.string(),
  path: z2.string().optional(),
  severity: z2.enum(["note", "warning", "error"]),
  evidenceIds: z2.array(z2.string())
}).superRefine((finding, context) => {
  if (Object.hasOwn(finding, "path") && finding.path === void 0)
    context.addIssue({ code: "custom", path: ["path"], message: "operational finding path must be omitted or a string" });
});
function unavailableOperationalEvidence(reason) {
  const unavailable = { unavailable: reason };
  return { configDigest: unavailable, toolchainDigest: unavailable, gitHead: unavailable, worktreeDigest: unavailable, canonicalDigest: unavailable, graphRecords: [], analyzerRecords: [], modelRecords: [], snapshotRecords: [], decisionRecords: [], transformRecords: [], validationRecords: [], journalRecords: [], errorRecords: [], durationMs: unavailable };
}
function deriveOperationalExitCode(proof) {
  return proof.budgetExhausted && proof.resumable ? 7 : proof.recoveryFailure ? 6 : proof.requiredUnavailable ? 5 : proof.incompleteCoverage ? 4 : proof.approvalRequired ? 3 : proof.blockingInvalidity ? 2 : proof.commandFailed || proof.budgetExhausted ? 1 : 0;
}
var secretKey = /(?:authorization|credential|password|private[_-]?key|api[_-]?key|access[_-]?token|secret)/iu;
var classify2 = (value, key) => /-----BEGIN [A-Z ]*PRIVATE KEY-----/u.test(value) ? "private-key" : /(?:authorization\s*:|password\s*=|credential)/iu.test(value) || key !== void 0 && secretKey.test(key) ? "credential" : /(?:gh[pousr]_[A-Za-z0-9]{20,}|bearer\s+[A-Za-z0-9._~+\/-]{8,}|[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{8,})/iu.test(value) ? "token" : void 0;
function redactBeforeBoundary(value, key) {
  if (typeof value === "string") {
    const kind = classify2(value, key);
    return kind === void 0 ? value : `<redacted:${kind}>`;
  }
  if (Array.isArray(value))
    return value.map((item) => redactBeforeBoundary(item));
  if (value !== null && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redactBeforeBoundary(item, name)]));
  return value;
}
var OperationalReportSchema = z2.strictObject({
  version: z2.literal(1),
  runId: z2.string(),
  command: z2.string(),
  exitCode: z2.number().int(),
  exitProof: OperationalExitProofSchema,
  evidence: OperationalRunEvidenceSchema,
  policy: z2.json(),
  stateDigest: ContentHashSchema,
  unavailableFields: z2.array(z2.string()),
  findings: z2.array(OperationalFindingSchema),
  dtoHash: ContentHashSchema
}).superRefine((report, context) => {
  const { dtoHash, ...authenticatedBody } = report;
  if (dtoHash !== hashFramedDomain("operational-report-dto", authenticatedBody))
    context.addIssue({ code: "custom", path: ["dtoHash"], message: "operational report DTO hash does not authenticate its body" });
  if (report.exitCode !== deriveOperationalExitCode(report.exitProof))
    context.addIssue({ code: "custom", path: ["exitCode"], message: "operational report exit code does not match its exit proof" });
  if (report.exitCode === 0 && report.findings.some(({ severity }) => severity === "error"))
    context.addIssue({ code: "custom", path: ["findings"], message: "a successful operational report cannot contain error findings" });
});
function parseOperationalReport(value) {
  return OperationalReportSchema.parse(value);
}
function createOperationalReport(input) {
  const findings = input.findings.map((finding) => ({ ...finding, evidenceIds: [...new Set(finding.evidenceIds)].sort(), id: hashFramedDomain("operational-finding", finding) })).sort((left, right) => left.id.localeCompare(right.id));
  const hasUnclassifiedError = findings.some(({ severity }) => severity === "error") && !input.exitProof.commandFailed && !input.exitProof.blockingInvalidity && !input.exitProof.approvalRequired && !input.exitProof.incompleteCoverage && !input.exitProof.requiredUnavailable && !input.exitProof.recoveryFailure && !input.exitProof.budgetExhausted;
  const exitProof = { ...input.exitProof, blockingInvalidity: input.exitProof.blockingInvalidity || hasUnclassifiedError };
  const base = redactBeforeBoundary({ version: 1, runId: input.runId, command: input.command, exitCode: deriveOperationalExitCode(exitProof), exitProof, evidence: input.evidence, policy: input.policy, stateDigest: input.stateDigest, unavailableFields: [...new Set(input.unavailableFields)].sort(), findings });
  return parseOperationalReport({ ...base, dtoHash: hashFramedDomain("operational-report-dto", base) });
}
function validateOperationalReport(report) {
  return OperationalReportSchema.safeParse(report).success;
}
function renderOperationalReport(report, format) {
  if (!validateOperationalReport(report))
    throw new Error("operational report authentication failed");
  if (format === "json")
    return JSON.stringify(report, null, 2);
  if (format === "sarif")
    return JSON.stringify({ version: "2.1.0", runs: [{ tool: { driver: { name: "Projector" } }, results: report.findings.map((finding) => ({ ruleId: finding.code, level: finding.severity, message: { text: finding.title }, fingerprints: { projectorFindingId: finding.id }, properties: { evidenceIds: finding.evidenceIds }, locations: finding.path === void 0 ? [] : [{ physicalLocation: { artifactLocation: { uri: finding.path } } }] })) }] }, null, 2);
  const lines = report.findings.map((finding) => `${finding.severity.toUpperCase()} ${finding.code}: ${finding.title}${finding.path === void 0 ? "" : ` (${finding.path})`}`);
  return format === "md" ? [`# Projector ${report.command}`, "", ...report.findings.map((finding) => `- **${finding.severity} ${finding.code}**: ${finding.title}${finding.path === void 0 ? "" : ` (\`${finding.path}\`)`}`)].join("\n") : [`Projector ${report.command} (exit ${report.exitCode})`, ...lines].join("\n");
}
var delay = (milliseconds) => new Promise((resolve3) => setTimeout(resolve3, milliseconds));
var JsonlTelemetryStore = class _JsonlTelemetryStore {
  paths;
  path;
  maximumRecords;
  constructor(paths, path, maximumRecords) {
    this.paths = paths;
    this.path = path;
    this.maximumRecords = maximumRecords;
  }
  static async create(paths, path, maximumRecords = 1e4) {
    if (!Number.isSafeInteger(maximumRecords) || maximumRecords < 1)
      throw new Error("telemetry bound must be positive");
    const parent = posix4.dirname(paths.canonicalize(path));
    const resolved = await paths.resolveWrite(parent);
    await mkdir8(resolved.realTarget, { recursive: true });
    await paths.resolveWrite(path);
    return new _JsonlTelemetryStore(paths, path, maximumRecords);
  }
  async acquire() {
    const lockPath = `${this.path}.lock`;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const lock = await this.paths.resolveWrite(lockPath);
      try {
        await mkdir8(lock.realTarget);
        return async () => {
          const current = await this.paths.resolveWrite(lockPath);
          await rm8(current.realTarget, { recursive: true, force: true });
        };
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "EEXIST"))
          throw error;
        await delay(5);
      }
    }
    throw new Error("telemetry append lock budget exhausted");
  }
  async append(report) {
    const release = await this.acquire();
    try {
      const prior = await this.replay();
      const sequence = prior.length + 1;
      const previousHash = prior.at(-1)?.entryHash ?? null;
      const safe = createOperationalReport({ ...report, findings: report.findings.map(({ id: omitted, ...finding }) => {
        void omitted;
        return finding;
      }) });
      const base = { version: 1, sequence, previousHash, report: safe };
      const line = { ...base, entryHash: hashFramedDomain("operational-telemetry-line", base) };
      const target = await this.paths.resolveWrite(this.path);
      await appendFile(target.realTarget, `${canonicalJson(line)}
`, "utf8");
      return line;
    } finally {
      await release();
    }
  }
  async replay() {
    const target = await this.paths.resolveRead(this.path);
    let text;
    try {
      text = await readFile6(target.realTarget, "utf8");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return [];
      throw error;
    }
    const lines = text.split(/\r?\n/u).filter(Boolean);
    if (lines.length > this.maximumRecords)
      throw new Error(`telemetry JSONL exceeds bounded replay limit ${this.maximumRecords}`);
    const records = [];
    for (const [index, line] of lines.entries()) {
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        throw new Error(`corrupt telemetry JSONL at sequence ${index + 1}`);
      }
      const { entryHash, ...base } = record;
      if (record.version !== 1 || record.sequence !== index + 1 || record.previousHash !== (records.at(-1)?.entryHash ?? null) || entryHash !== hashFramedDomain("operational-telemetry-line", base) || !validateOperationalReport(record.report))
        throw new Error(`corrupt telemetry JSONL hash/sequence at ${index + 1}`);
      records.push(record);
    }
    return records;
  }
};

// node_modules/@projector/runtime/dist/activation/project-activation.js
import { randomBytes as randomBytes3 } from "node:crypto";
import { constants as constants6 } from "node:fs";
import { lstat as lstat8, open as open7, rename as rename6, rm as rm9 } from "node:fs/promises";
import { dirname as dirname7, join as join9, parse as parse2 } from "node:path";
import { parse as parseToml } from "smol-toml";
var PROJECTOR_CONFIG_PATH = ".projector/config.toml";
var MAXIMUM_CONFIG_BYTES = 16 * 1024;
var PROJECTOR_LOCAL_IGNORE_RULES = ["/state.db", "/state.db-wal", "/state.db-shm", "/state.db-journal", "/runtime/", "/telemetry/", "/watch/"];
var disabled = (repositoryRoot, failure, reason) => ({
  status: "disabled",
  repositoryRoot,
  configPath: PROJECTOR_CONFIG_PATH,
  failure,
  reason
});
function isMissing2(error) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
async function resolveRepositoryRoot(candidate) {
  let cursor = (await RepositoryPathService.create(candidate)).root;
  while (true) {
    try {
      const gitMarker = await lstat8(join9(cursor, ".git"));
      if (gitMarker.isDirectory() || gitMarker.isFile())
        return cursor;
    } catch (error) {
      if (!isMissing2(error))
        throw error;
    }
    const parent = dirname7(cursor);
    if (parent === cursor || cursor === parse2(cursor).root)
      throw new Error("no Git repository root contains the requested path");
    cursor = parent;
  }
}
async function inspectProjectActivation(repositoryRoot) {
  let paths;
  try {
    paths = await RepositoryPathService.create(await resolveRepositoryRoot(repositoryRoot));
  } catch (error) {
    return disabled(repositoryRoot, "unsafe", `Projector repository root is unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
  let configPath;
  let source;
  try {
    configPath = (await paths.resolveRead(PROJECTOR_CONFIG_PATH)).realTarget;
    const handle = await open7(configPath, constants6.O_RDONLY | constants6.O_NOFOLLOW);
    try {
      const status = await handle.stat();
      if (!status.isFile())
        return disabled(paths.root, "malformed", `${PROJECTOR_CONFIG_PATH} must be a regular file`);
      if (status.size > MAXIMUM_CONFIG_BYTES)
        return disabled(paths.root, "malformed", `${PROJECTOR_CONFIG_PATH} exceeds ${MAXIMUM_CONFIG_BYTES} bytes`);
      source = await handle.readFile("utf8");
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (isMissing2(error))
      return disabled(paths.root, "missing", `Projector is not enabled; run projector init to create ${PROJECTOR_CONFIG_PATH}`);
    return disabled(paths.root, "unsafe", `Projector activation marker is unsafe: ${error instanceof Error ? error.message : String(error)}`);
  }
  let value;
  try {
    value = parseToml(source);
  } catch (error) {
    return disabled(paths.root, "malformed", `${PROJECTOR_CONFIG_PATH} is malformed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (value !== null && typeof value === "object" && "apiVersion" in value && value.apiVersion !== projectorConfigApiVersion) {
    return disabled(paths.root, "unsupported", `${PROJECTOR_CONFIG_PATH} uses an unsupported apiVersion`);
  }
  try {
    return { status: "enabled", repositoryRoot: paths.root, configPath: PROJECTOR_CONFIG_PATH, config: parseProjectorConfig(value) };
  } catch (error) {
    return disabled(paths.root, "malformed", `${PROJECTOR_CONFIG_PATH} is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
}
async function initializeProjectLocalIgnore(repositoryRoot) {
  await initializeProjectIgnore(await RepositoryPathService.create(repositoryRoot));
}
async function initializeProjectIgnore(paths) {
  const target = (await paths.resolveWrite(".projector/.gitignore")).realTarget;
  let existing = "";
  try {
    const handle = await open7(target, constants6.O_RDONLY | constants6.O_NOFOLLOW);
    try {
      if (!(await handle.stat()).isFile())
        throw new Error(".projector/.gitignore must be a regular file");
      existing = await handle.readFile("utf8");
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (!isMissing2(error))
      throw error;
  }
  const existingRules = new Set(existing.split(/\r?\n/u).map((line) => line.trim()));
  const missing = PROJECTOR_LOCAL_IGNORE_RULES.filter((rule) => !existingRules.has(rule));
  if (missing.length === 0)
    return;
  const next = `# Projector derived indexes and execution-local state
${missing.join("\n")}
${existing}`;
  const temporary = join9(dirname7(target), `.gitignore.${randomBytes3(12).toString("hex")}.tmp`);
  try {
    const handle = await open7(temporary, constants6.O_CREAT | constants6.O_EXCL | constants6.O_WRONLY, 384);
    try {
      await handle.writeFile(next, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await paths.resolveWrite(".projector/.gitignore");
    await rename6(temporary, target);
    await syncDirectory5(dirname7(target));
  } finally {
    await rm9(temporary, { force: true });
  }
}
async function syncDirectory5(path) {
  const handle = await open7(path, constants6.O_RDONLY);
  try {
    await handle.sync();
  } catch (error) {
    if (!isCode6(error, "EINVAL") && !isCode6(error, "ENOTSUP") && !isCode6(error, "EPERM"))
      throw error;
  } finally {
    await handle.close();
  }
}
function isCode6(error, code) {
  return error instanceof Error && "code" in error && error.code === code;
}

// node_modules/@projector/runtime/dist/access/operation-access.js
import { randomUUID as randomUUID4 } from "node:crypto";
import { lstat as lstat9, mkdir as mkdir9, open as open8, readFile as readFile7, readdir as readdir3, realpath as realpath3, rename as rename7, rm as rm10, rmdir, stat as stat2 } from "node:fs/promises";
import { join as join10 } from "node:path";
var OperationAccessError = class extends Error {
  code;
  constructor(code, message, options) {
    super(message, options);
    this.name = "OperationAccessError";
    this.code = code;
  }
};
var runtimeRelativePath = join10(".projector", "runtime");
var accessDirectoryName = "operation-access";
var requestsDirectoryName = "requests";
var holdersDirectoryName = "holders";
var counterFileName = "next-ticket";
var mutexDirectoryName = "mutex";
var pollIntervalMs = 10;
var abandonedMutexAfterMs = 3e4;
var abandonedClaimAfterMs = 3e4;
var uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
async function tryWithProjectExclusiveAccess(root, operationName, operation, signal) {
  validateOptions({ operation: operationName, mode: "exclusive" });
  throwIfAborted3(signal);
  const accessPath = await prepareAccessDirectory(root);
  const mutexPath = join10(accessPath, mutexDirectoryName);
  try {
    await mkdir9(mutexPath);
  } catch (error) {
    if (isCode7(error, "EEXIST"))
      return { acquired: false };
    throw error;
  }
  let claim;
  try {
    const state = await readAccessState(accessPath);
    if (state.requests.length !== 0 || state.holders.length !== 0)
      return { acquired: false };
    if (state.nextTicket === Number.MAX_SAFE_INTEGER)
      throw corrupt("Operation access ticket space is exhausted");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    claim = {
      version: 1,
      requestId: randomUUID4(),
      ticket: state.nextTicket + 1,
      operation: operationName,
      mode: "exclusive",
      processId: process.pid,
      createdAt: now,
      heartbeatAt: now
    };
    await writeAtomic(accessPath, counterFileName, `${claim.ticket}
`);
    await writeNewClaim(join10(accessPath, holdersDirectoryName, `${claim.requestId}.json`), claim);
  } finally {
    await rmdir(mutexPath);
  }
  const owned = claim;
  const integrity = new AbortController();
  const heartbeat = startHeartbeat(accessPath, owned, integrity);
  try {
    try {
      return { acquired: true, value: await operation({
        signal: signal === void 0 ? integrity.signal : AbortSignal.any([signal, integrity.signal]),
        ownedRelativePaths: [".projector/runtime/operation-access/next-ticket", `.projector/runtime/operation-access/holders/${owned.requestId}.json`],
        assertOwned: async () => {
          await refreshHeartbeat(accessPath, owned);
        }
      }) };
    } finally {
      await heartbeat.stop();
    }
  } finally {
    await removeOwnClaim(accessPath, holdersDirectoryName, owned);
  }
}
async function withProjectOperationAccess(root, options, operation) {
  validateOptions(options);
  throwIfAborted3(options.signal);
  const accessPath = await prepareAccessDirectory(root);
  const claim = await enqueue(accessPath, options);
  const integrity = new AbortController();
  const heartbeat = startHeartbeat(accessPath, claim, integrity);
  let acquired = false;
  try {
    try {
      await waitToAcquire(accessPath, claim, options.signal);
      acquired = true;
      const signal = options.signal === void 0 ? integrity.signal : AbortSignal.any([options.signal, integrity.signal]);
      return await operation({
        signal,
        ownedRelativePaths: [
          ".projector/runtime/operation-access/next-ticket",
          `.projector/runtime/operation-access/holders/${claim.requestId}.json`
        ],
        assertOwned: async () => {
          await refreshHeartbeat(accessPath, claim);
        }
      });
    } finally {
      await heartbeat.stop();
    }
  } finally {
    await removeOwnClaim(accessPath, acquired ? holdersDirectoryName : requestsDirectoryName, claim);
  }
}
async function recoverAbandonedProjectOperationAccess(root, signal) {
  throwIfAborted3(signal);
  const accessPath = await prepareAccessDirectory(root);
  await recoverInterruptedMutex(accessPath);
  return withMutex(accessPath, signal, async () => {
    const state = await readAccessState(accessPath, true, true);
    const interrupted = await readInterruptedHeartbeats(accessPath, state);
    const now = Date.now();
    const abandoned = [...state.requests, ...state.holders].filter((claim) => {
      const heartbeat = new Date(claim.heartbeatAt).getTime();
      if (heartbeat > now + abandonedClaimAfterMs) {
        throw corrupt(`Operation access claim ${claim.requestId} has an invalid future heartbeat and requires manual recovery`);
      }
      return now - heartbeat > abandonedClaimAfterMs;
    });
    for (const claim of abandoned) {
      if (processIsAlive(claim.processId)) {
        throw corrupt(`Operation access claim ${claim.requestId} is stale but its recorded process is still alive`);
      }
    }
    for (const heartbeat of interrupted) {
      if (!abandoned.some(({ requestId }) => requestId === heartbeat.requestId)) {
        throw corrupt(`Interrupted heartbeat ${heartbeat.requestId} does not belong to an abandoned claim`);
      }
    }
    for (const heartbeat of interrupted)
      await rm10(heartbeat.path);
    const requestIds = new Set(state.requests.map(({ requestId }) => requestId));
    const synced = /* @__PURE__ */ new Set();
    for (const heartbeat of interrupted)
      synced.add(heartbeat.directory);
    for (const claim of abandoned) {
      const directory = join10(accessPath, requestIds.has(claim.requestId) ? requestsDirectoryName : holdersDirectoryName);
      await rm10(join10(directory, `${claim.requestId}.json`));
      synced.add(directory);
    }
    for (const directory of synced)
      await syncDirectory6(directory);
    return { removedClaimIds: abandoned.map(({ requestId }) => requestId) };
  });
}
async function recoverInterruptedMutex(accessPath) {
  const mutexPath = join10(accessPath, mutexDirectoryName);
  let mutexStatus;
  try {
    mutexStatus = await lstat9(mutexPath);
  } catch (error) {
    if (isCode7(error, "ENOENT"))
      return;
    throw corrupt("Operation access mutex is unreadable", error);
  }
  if (!mutexStatus.isDirectory() || mutexStatus.isSymbolicLink())
    throw corrupt("Operation access mutex is not a real directory");
  if (Date.now() - mutexStatus.mtimeMs <= abandonedMutexAfterMs)
    return;
  if ((await readdir3(mutexPath)).length !== 0)
    throw corrupt("Operation access mutex contains unexpected evidence");
  const state = await readAccessState(accessPath, true, true);
  const interrupted = await readInterruptedHeartbeats(accessPath, state);
  if (interrupted.length !== 1) {
    throw corrupt("Abandoned operation access mutex has no unique interrupted heartbeat owner; manual recovery is required");
  }
  const now = Date.now();
  for (const claim of [...state.requests, ...state.holders]) {
    const heartbeat = new Date(claim.heartbeatAt).getTime();
    if (heartbeat > now + abandonedClaimAfterMs || now - heartbeat <= abandonedClaimAfterMs) {
      throw corrupt(`Operation access claim ${claim.requestId} is not safely expired`);
    }
    if (processIsAlive(claim.processId))
      throw corrupt(`Operation access claim ${claim.requestId} is still held by a live process`);
  }
  const current = await lstat9(mutexPath);
  if (current.dev !== mutexStatus.dev || current.ino !== mutexStatus.ino || current.mtimeMs !== mutexStatus.mtimeMs) {
    throw corrupt("Operation access mutex changed during recovery");
  }
  await rmdir(mutexPath);
  await syncDirectory6(accessPath);
}
async function readInterruptedHeartbeats(accessPath, state) {
  const claims = new Map([...state.requests, ...state.holders].map((claim) => [claim.requestId, claim]));
  const interrupted = [];
  for (const name of [requestsDirectoryName, holdersDirectoryName]) {
    const directory = join10(accessPath, name);
    for (const entry of await readdir3(directory, { withFileTypes: true })) {
      if (!entry.name.endsWith(".tmp"))
        continue;
      const match = /^\.([0-9a-f-]+)\.json\.([0-9a-f-]+)\.tmp$/iu.exec(entry.name);
      if (!entry.isFile() || entry.isSymbolicLink() || match === null || !uuidPattern.test(match[1]) || !uuidPattern.test(match[2])) {
        throw corrupt(`Unrecognized interrupted operation access heartbeat: ${entry.name}`);
      }
      const requestId = match[1];
      const claim = claims.get(requestId);
      if (claim === void 0 || name === holdersDirectoryName !== state.holders.some((holder) => holder.requestId === requestId)) {
        throw corrupt(`Interrupted heartbeat ${requestId} has no matching claim`);
      }
      const path = join10(directory, entry.name);
      const pending = await readClaim(path);
      const { heartbeatAt: _prior, ...claimIdentity } = claim;
      const { heartbeatAt: _pending, ...pendingIdentity } = pending;
      if (JSON.stringify(claimIdentity) !== JSON.stringify(pendingIdentity) || pending.heartbeatAt < claim.heartbeatAt) {
        throw corrupt(`Interrupted heartbeat ${requestId} does not match its claim`);
      }
      const modified = await lstat9(path);
      const now = Date.now();
      if (now - modified.mtimeMs <= abandonedClaimAfterMs || new Date(pending.heartbeatAt).getTime() > now + abandonedClaimAfterMs || processIsAlive(claim.processId)) {
        throw corrupt(`Interrupted heartbeat ${requestId} may still be active`);
      }
      interrupted.push({ requestId, path, directory });
    }
  }
  return interrupted;
}
function validateOptions(options) {
  if (options.mode !== "shared" && options.mode !== "exclusive") {
    throw new TypeError("Project operation access mode must be shared or exclusive");
  }
  if (options.operation.length === 0 || options.operation.length > 256 || options.operation.trim() !== options.operation) {
    throw new TypeError("Project operation identity must contain 1 to 256 non-padding characters");
  }
}
async function prepareAccessDirectory(root) {
  let governedRoot;
  try {
    governedRoot = await realpath3(root);
  } catch (cause) {
    throw new OperationAccessError("project-not-ready", `Project root is not readable: ${root}`, { cause });
  }
  const projectorPath = join10(governedRoot, ".projector");
  try {
    const projectorStatus = await lstat9(projectorPath);
    if (!projectorStatus.isDirectory() || projectorStatus.isSymbolicLink())
      throw new Error("not a real directory");
  } catch (cause) {
    throw new OperationAccessError("project-not-ready", "Project operation access requires an initialized .projector directory", { cause });
  }
  const runtimePath = join10(governedRoot, runtimeRelativePath);
  await ensureRealDirectory(runtimePath);
  const accessPath = join10(runtimePath, accessDirectoryName);
  await ensureRealDirectory(accessPath);
  await ensureRealDirectory(join10(accessPath, requestsDirectoryName));
  await ensureRealDirectory(join10(accessPath, holdersDirectoryName));
  return accessPath;
}
async function ensureRealDirectory(path) {
  await mkdir9(path, { recursive: true });
  const status = await lstat9(path);
  if (!status.isDirectory() || status.isSymbolicLink()) {
    throw new OperationAccessError("access-corrupt", `Operation access path is not a real directory: ${path}`);
  }
}
async function enqueue(accessPath, options) {
  return withMutex(accessPath, options.signal, async () => {
    const state = await readAccessState(accessPath);
    if (state.nextTicket === Number.MAX_SAFE_INTEGER)
      throw corrupt("Operation access ticket space is exhausted");
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    const claim = {
      version: 1,
      requestId: randomUUID4(),
      ticket: state.nextTicket + 1,
      operation: options.operation,
      mode: options.mode,
      processId: process.pid,
      createdAt,
      heartbeatAt: createdAt
    };
    await writeAtomic(accessPath, counterFileName, `${claim.ticket}
`);
    await writeNewClaim(join10(accessPath, requestsDirectoryName, `${claim.requestId}.json`), claim);
    return claim;
  });
}
function startHeartbeat(accessPath, claim, integrity) {
  let requestStop = () => void 0;
  const stopped = new Promise((resolve3) => {
    requestStop = () => resolve3(true);
  });
  const loop = (async () => {
    while (true) {
      const shouldStop = await Promise.race([delay2(250).then(() => false), stopped]);
      if (shouldStop)
        return;
      await refreshHeartbeat(accessPath, claim);
    }
  })();
  const outcome = loop.then(() => void 0, (error) => {
    integrity.abort(error);
    return error;
  });
  return {
    stop: async () => {
      requestStop();
      const error = await outcome;
      if (error !== void 0)
        throw error;
    }
  };
}
async function refreshHeartbeat(accessPath, claim) {
  await withMutex(accessPath, void 0, async () => {
    const state = await readAccessState(accessPath);
    const holder = state.holders.find((candidate) => candidate.requestId === claim.requestId);
    const request = state.requests.find((candidate) => candidate.requestId === claim.requestId);
    const persisted = holder ?? request;
    if (persisted === void 0 || !sameClaim(persisted, claim)) {
      throw corrupt(`Operation access claim ${claim.requestId} is missing or changed during heartbeat`);
    }
    const previousTime = new Date(claim.heartbeatAt).getTime();
    const heartbeatAt = new Date(Math.max(Date.now(), previousTime + 1)).toISOString();
    const refreshed = { ...claim, heartbeatAt };
    await writeAtomic(join10(accessPath, holder === void 0 ? requestsDirectoryName : holdersDirectoryName), `${claim.requestId}.json`, `${JSON.stringify(refreshed)}
`);
    claim.heartbeatAt = heartbeatAt;
  });
}
async function waitToAcquire(accessPath, claim, signal) {
  while (true) {
    throwIfAborted3(signal);
    const acquired = await withMutex(accessPath, signal, async () => {
      const state = await readAccessState(accessPath);
      const ownRequest = state.requests.find((candidate) => candidate.requestId === claim.requestId);
      if (ownRequest === void 0 || !sameClaim(ownRequest, claim)) {
        throw corrupt(`Operation access request ${claim.requestId} is missing or changed`);
      }
      const canAcquire = claim.mode === "shared" ? state.holders.every((holder) => holder.mode === "shared") && state.requests.every((request) => request.ticket >= claim.ticket || request.mode !== "exclusive") : state.holders.length === 0 && state.requests.every((request) => request.ticket >= claim.ticket);
      if (!canAcquire)
        return false;
      try {
        await rename7(join10(accessPath, requestsDirectoryName, `${claim.requestId}.json`), join10(accessPath, holdersDirectoryName, `${claim.requestId}.json`));
      } catch (cause) {
        throw corrupt(`Operation access request ${claim.requestId} could not become a holder`, cause);
      }
      await syncDirectory6(join10(accessPath, requestsDirectoryName));
      await syncDirectory6(join10(accessPath, holdersDirectoryName));
      return true;
    });
    if (acquired)
      return;
    await abortableDelay(signal);
  }
}
async function removeOwnClaim(accessPath, location, claim) {
  await withMutex(accessPath, void 0, async () => {
    const state = await readAccessState(accessPath);
    const claims = location === requestsDirectoryName ? state.requests : state.holders;
    const persisted = claims.find((candidate) => candidate.requestId === claim.requestId);
    if (persisted === void 0 || !sameClaim(persisted, claim)) {
      throw corrupt(`Operation access claim ${claim.requestId} is missing or changed during release`);
    }
    try {
      await rm10(join10(accessPath, location, `${claim.requestId}.json`));
    } catch (cause) {
      throw corrupt(`Operation access claim ${claim.requestId} could not be released`, cause);
    }
    await syncDirectory6(join10(accessPath, location));
  });
}
async function readAccessState(accessPath, permitAbandoned = false, permitInterruptedHeartbeats = false) {
  await validateAccessDirectoryEntries(accessPath);
  const requests = await readClaims(join10(accessPath, requestsDirectoryName), permitInterruptedHeartbeats);
  const holders = await readClaims(join10(accessPath, holdersDirectoryName), permitInterruptedHeartbeats);
  const allClaims = [...requests, ...holders];
  const now = Date.now();
  for (const claim of allClaims) {
    const heartbeat = new Date(claim.heartbeatAt).getTime();
    if (!permitAbandoned && (heartbeat > now + abandonedClaimAfterMs || now - heartbeat > abandonedClaimAfterMs)) {
      throw corrupt(`Operation access claim ${claim.requestId} has an abandoned or invalid heartbeat and requires recovery`);
    }
  }
  const requestIds = /* @__PURE__ */ new Set();
  const tickets = /* @__PURE__ */ new Set();
  for (const claim of allClaims) {
    if (requestIds.has(claim.requestId) || tickets.has(claim.ticket)) {
      throw corrupt("Operation access claims have ambiguous identity or ticket order");
    }
    requestIds.add(claim.requestId);
    tickets.add(claim.ticket);
  }
  const exclusiveHolders = holders.filter((claim) => claim.mode === "exclusive");
  if (exclusiveHolders.length > 0 && holders.length !== 1) {
    throw corrupt("An exclusive operation access claim overlaps another holder");
  }
  if (holders.some((holder) => requests.some((request) => request.mode === "exclusive" && request.ticket < holder.ticket))) {
    throw corrupt("An operation holder bypasses an earlier exclusive request");
  }
  const nextTicket = await readCounter(accessPath, allClaims.length);
  if (allClaims.some((claim) => claim.ticket > nextTicket)) {
    throw corrupt("Operation access ticket counter precedes a persisted claim");
  }
  return { requests, holders, nextTicket };
}
function processIsAlive(processId) {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    if (isCode7(error, "ESRCH"))
      return false;
    if (isCode7(error, "EPERM"))
      return true;
    throw corrupt(`Could not determine whether operation access process ${processId} is alive`, error);
  }
}
async function validateAccessDirectoryEntries(accessPath) {
  const allowed = /* @__PURE__ */ new Set([requestsDirectoryName, holdersDirectoryName, counterFileName, mutexDirectoryName]);
  let entries;
  try {
    entries = await readdir3(accessPath, { withFileTypes: true });
  } catch (cause) {
    throw corrupt("Operation access directory is unreadable", cause);
  }
  for (const entry of entries) {
    if (!allowed.has(entry.name))
      throw corrupt(`Unexpected operation access entry: ${entry.name}`);
    if ((entry.name === requestsDirectoryName || entry.name === holdersDirectoryName || entry.name === mutexDirectoryName) && !entry.isDirectory() || entry.name === counterFileName && !entry.isFile() || entry.isSymbolicLink()) {
      throw corrupt(`Operation access entry has an invalid type: ${entry.name}`);
    }
  }
}
async function readClaims(directory, permitInterruptedHeartbeats = false) {
  const claims = [];
  let entries;
  try {
    entries = await readdir3(directory, { withFileTypes: true });
  } catch (cause) {
    throw corrupt(`Operation access claims are unreadable: ${directory}`, cause);
  }
  for (const entry of entries) {
    if (permitInterruptedHeartbeats && entry.name.endsWith(".tmp"))
      continue;
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith(".json")) {
      throw corrupt(`Invalid operation access claim entry: ${entry.name}`);
    }
    const claim = await readClaim(join10(directory, entry.name));
    if (entry.name !== `${claim.requestId}.json`) {
      throw corrupt(`Operation access claim filename does not match its identity: ${entry.name}`);
    }
    claims.push(claim);
  }
  return claims;
}
async function readClaim(path) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile7(path, "utf8"));
  } catch (cause) {
    throw corrupt(`Operation access claim is unreadable: ${path}`, cause);
  }
  if (!isAccessClaim(parsed))
    throw corrupt(`Operation access claim is invalid: ${path}`);
  return parsed;
}
function isAccessClaim(value) {
  if (typeof value !== "object" || value === null)
    return false;
  const candidate = value;
  return Object.keys(value).sort().join(",") === "createdAt,heartbeatAt,mode,operation,processId,requestId,ticket,version" && candidate.version === 1 && typeof candidate.requestId === "string" && uuidPattern.test(candidate.requestId) && typeof candidate.ticket === "number" && Number.isSafeInteger(candidate.ticket) && candidate.ticket > 0 && typeof candidate.operation === "string" && candidate.operation.length > 0 && candidate.operation.length <= 256 && candidate.operation.trim() === candidate.operation && (candidate.mode === "shared" || candidate.mode === "exclusive") && typeof candidate.processId === "number" && Number.isSafeInteger(candidate.processId) && candidate.processId > 0 && isIsoDate2(candidate.createdAt) && isIsoDate2(candidate.heartbeatAt) && candidate.heartbeatAt >= candidate.createdAt;
}
async function readCounter(accessPath, claimCount) {
  try {
    const raw = await readFile7(join10(accessPath, counterFileName), "utf8");
    if (!/^(0|[1-9][0-9]*)\n$/u.test(raw))
      throw new Error("invalid decimal encoding");
    const value = Number(raw.trim());
    if (!Number.isSafeInteger(value))
      throw new Error("counter exceeds safe integer range");
    return value;
  } catch (cause) {
    if (isCode7(cause, "ENOENT") && claimCount === 0)
      return 0;
    throw corrupt("Operation access ticket counter is missing or unreadable", cause);
  }
}
async function writeNewClaim(path, claim) {
  const handle = await open8(path, "wx");
  try {
    await handle.writeFile(`${JSON.stringify(claim)}
`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await syncDirectory6(join10(path, ".."));
}
async function writeAtomic(directory, name, content) {
  const temporaryName = `.${name}.${randomUUID4()}.tmp`;
  const temporaryPath = join10(directory, temporaryName);
  const handle = await open8(temporaryPath, "wx");
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename7(temporaryPath, join10(directory, name));
    await syncDirectory6(directory);
  } catch (cause) {
    await rm10(temporaryPath, { force: true });
    throw cause;
  }
}
async function syncDirectory6(path) {
  const handle = await open8(path, "r");
  try {
    await handle.sync();
  } catch (cause) {
    if (!isCode7(cause, "EINVAL") && !isCode7(cause, "ENOTSUP") && !isCode7(cause, "EPERM"))
      throw cause;
  } finally {
    await handle.close();
  }
}
async function withMutex(accessPath, signal, body) {
  const mutexPath = join10(accessPath, mutexDirectoryName);
  while (true) {
    throwIfAborted3(signal);
    try {
      await mkdir9(mutexPath);
      break;
    } catch (cause) {
      if (!isCode7(cause, "EEXIST"))
        throw cause;
      let mutexStatus;
      try {
        mutexStatus = await stat2(mutexPath);
      } catch (error) {
        if (isCode7(error, "ENOENT"))
          continue;
        throw corrupt("Operation access mutex is unreadable", error);
      }
      if (!mutexStatus.isDirectory())
        throw corrupt("Operation access mutex is not a directory");
      if (Date.now() - mutexStatus.mtimeMs > abandonedMutexAfterMs) {
        throw corrupt("Operation access mutex appears abandoned and requires recovery");
      }
      await abortableDelay(signal);
    }
  }
  try {
    return await body();
  } finally {
    try {
      await rmdir(mutexPath);
    } catch (cause) {
      throw corrupt("Operation access mutex could not be released", cause);
    }
  }
}
async function abortableDelay(signal) {
  if (signal === void 0) {
    await delay2(pollIntervalMs);
    return;
  }
  await new Promise((resolve3, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(aborted(signal));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve3();
    }, pollIntervalMs);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted)
      onAbort();
  });
}
function delay2(milliseconds) {
  return new Promise((resolve3) => setTimeout(resolve3, milliseconds));
}
function throwIfAborted3(signal) {
  if (signal?.aborted === true)
    throw aborted(signal);
}
function aborted(signal) {
  return new OperationAccessError("access-aborted", "Project operation access was aborted", { cause: signal.reason });
}
function corrupt(message, cause) {
  return new OperationAccessError("access-corrupt", message, cause === void 0 ? void 0 : { cause });
}
function sameClaim(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function isIsoDate2(value) {
  if (typeof value !== "string")
    return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}
function isCode7(error, code) {
  return error instanceof Error && "code" in error && error.code === code;
}

// node_modules/@projector/runtime/dist/migrations/project-backup.js
import { createHash as createHash5, randomUUID as randomUUID5 } from "node:crypto";
import { constants as constants7 } from "node:fs";
import { link as link4, lstat as lstat10, open as open9, opendir as opendir3, rm as rm11 } from "node:fs/promises";
import { isAbsolute as isAbsolute4, join as join11, relative as relative3, resolve as resolve2 } from "node:path";
var archiveMagic = Buffer.from("PROJECTOR-BACKUP-ARCHIVE-V1\n");
var maximumEntryCount = 1e5;
var maximumArchiveBytes = 64 * 1024 * 1024 * 1024;
var maximumManifestBytes = 16 * 1024 * 1024;
var ioBufferSize = 1024 * 1024;
var ProjectBackupError = class extends Error {
  recoveryPath;
  constructor(message, recoveryPath, options) {
    super(message, options);
    this.recoveryPath = recoveryPath;
    this.name = "ProjectBackupError";
  }
};
async function createProjectBackup(input, dependencies = {}) {
  const repositoryRoot = resolveRequiredPath(input.repositoryRoot, "repository root");
  const codexDataRoot = resolveRequiredPath(input.codexDataRoot, "Codex data root");
  const sourceRoot = containedPath(repositoryRoot, join11(repositoryRoot, ".projector"), "project source");
  const backupId = (dependencies.createBackupId ?? randomUUID5)();
  const temporaryId = (dependencies.createTemporaryId ?? randomUUID5)();
  assertBackupId(backupId);
  assertBackupId(temporaryId);
  await assertRegularDirectory(repositoryRoot, "Repository root");
  await assertRegularDirectory(sourceRoot, "Projector source directory");
  await assertRegularDirectory(codexDataRoot, "Codex data root");
  const excludedPaths = await authenticateCoordination(input.coordination);
  const fileName = `projector-backup-${backupId}.pba`;
  const backupPath = containedPath(codexDataRoot, join11(codexDataRoot, fileName), "backup archive");
  const temporaryPath = containedPath(codexDataRoot, join11(codexDataRoot, `.projector-backup-${backupId}.${temporaryId}.tmp`), "backup staging archive");
  if (await exists(backupPath))
    return recoverPublishedArchive(backupPath, codexDataRoot, backupId, dependencies);
  if (await exists(temporaryPath)) {
    throw new ProjectBackupError(`Backup staging name already exists: ${temporaryPath}`, temporaryPath);
  }
  const initial = await scanTree(sourceRoot, excludedPaths);
  const manifest = {
    formatVersion: 1,
    backupId,
    createdAt: (dependencies.now ?? (() => /* @__PURE__ */ new Date()))().toISOString(),
    source: { projectorDirectory: ".projector" },
    files: initial.files.map((file) => ({ path: `.projector/${file.path}`, length: file.length, sha256: file.sha256 }))
  };
  const manifestBytes = Buffer.from(`${canonicalJson(manifest)}
`);
  if (manifestBytes.byteLength > maximumManifestBytes)
    throw new ProjectBackupError("Backup manifest exceeds its byte limit");
  const lengthBytes = Buffer.alloc(8);
  lengthBytes.writeBigUInt64BE(BigInt(manifestBytes.byteLength));
  let namespacePublished = false;
  try {
    const archiveHash = createHash5("sha256");
    const output = await open9(temporaryPath, "wx", 384);
    try {
      for (const bytes of [archiveMagic, lengthBytes, manifestBytes]) {
        await writeAll2(output, bytes);
        archiveHash.update(bytes);
      }
      for (const file of initial.files) {
        const source = await openRegularFile(join11(sourceRoot, ...file.path.split("/")), "r", `.projector/${file.path}`);
        try {
          const copied = await copyAndHash(source, output, archiveHash);
          if (copied.length !== file.length || copied.sha256 !== file.sha256) {
            throw new ProjectBackupError(`Projector source changed while copying .projector/${file.path}`, temporaryPath);
          }
        } finally {
          await source.close();
        }
        await dependencies.afterFileCopied?.(`.projector/${file.path}`);
      }
      await output.sync();
    } finally {
      await output.close();
    }
    await assertCoordinationOwned(input.coordination);
    const finalSnapshot = await scanTree(sourceRoot, excludedPaths);
    if (!sameSnapshot2(initial, finalSnapshot)) {
      throw new ProjectBackupError("Projector source changed while the backup was being created", temporaryPath);
    }
    const staged = await inspectArchive(temporaryPath, backupId);
    const expectedArchiveHash = contentHash3(archiveHash.digest("hex"));
    if (staged.archiveHash !== expectedArchiveHash || !staged.manifestBytes.equals(manifestBytes)) {
      throw new ProjectBackupError("Staged backup archive failed exact verification", temporaryPath);
    }
    dependencies.crash?.("before-namespace-publish");
    try {
      await link4(temporaryPath, backupPath);
    } catch (error) {
      if (hasCode(error, "EEXIST")) {
        return await recoverPublishedArchive(backupPath, codexDataRoot, backupId, dependencies);
      }
      throw error;
    }
    namespacePublished = true;
    await syncBackupDirectory(codexDataRoot, dependencies);
    dependencies.crash?.("after-namespace-publish");
    await dependencies.afterNamespacePublished?.(backupPath);
    await flushPublished(backupPath, dependencies);
    const published = await inspectArchive(backupPath, backupId);
    if (published.archiveHash !== expectedArchiveHash || !published.manifestBytes.equals(manifestBytes)) {
      throw new ProjectBackupError("Published backup archive failed exact verification", backupPath);
    }
    await rm11(temporaryPath);
    await syncBackupDirectory(codexDataRoot, dependencies);
    return resultFromInspection(backupPath, codexDataRoot, published);
  } catch (error) {
    const recoveryPath = namespacePublished ? backupPath : temporaryPath;
    if (error instanceof ProjectBackupError) {
      if (error.recoveryPath !== void 0)
        throw error;
      throw new ProjectBackupError(error.message, recoveryPath, { cause: error });
    }
    throw new ProjectBackupError(`Backup archive publication failed; recover from ${recoveryPath}: ${errorMessage2(error)}`, recoveryPath, { cause: error });
  }
}
function hashProjectBackupManifest(bytes) {
  return hashFramedDomain("project-data-backup-archive-manifest-bytes", Buffer.from(bytes).toString("base64"));
}
function hashProjectBackupArchive(bytes) {
  return contentHash3(createHash5("sha256").update(bytes).digest("hex"));
}
async function verifyProjectBackup(input) {
  const codexDataRoot = resolveRequiredPath(input.codexDataRoot, "Codex data root");
  await assertRegularDirectory(codexDataRoot, "Codex data root");
  assertBackupId(input.backup.id);
  if (input.backup.location.kind !== "codex-data-relative") {
    throw new ProjectBackupError("Recorded backup location kind is unsupported");
  }
  const expectedLocation = `projector-backup-${input.backup.id}.pba`;
  if (input.backup.location.path !== expectedLocation) {
    throw new ProjectBackupError("Recorded backup location does not match its backup identity");
  }
  const backupPath = containedPath(codexDataRoot, join11(codexDataRoot, ...input.backup.location.path.split("/")), "recorded backup archive");
  let inspection;
  try {
    inspection = await inspectArchive(backupPath, input.backup.id);
  } catch (error) {
    throw new ProjectBackupError(`Recorded backup archive could not be authenticated: ${errorMessage2(error)}`, backupPath, { cause: error });
  }
  const manifestHash = hashProjectBackupManifest(inspection.manifestBytes);
  if (manifestHash !== input.backup.manifestHash) {
    throw new ProjectBackupError("Recorded backup manifest hash does not match the exact archive manifest", backupPath);
  }
  return resultFromInspection(backupPath, codexDataRoot, inspection);
}
async function recoverPublishedArchive(path, codexDataRoot, backupId, dependencies) {
  let inspection;
  try {
    inspection = await inspectArchive(path, backupId);
  } catch (error) {
    throw new ProjectBackupError(`Existing backup ID ${backupId} contains unknown archive bytes`, path, { cause: error });
  }
  try {
    await flushPublished(path, dependencies);
  } catch (error) {
    throw new ProjectBackupError(`Existing backup archive could not be flushed: ${errorMessage2(error)}`, path, { cause: error });
  }
  await syncBackupDirectory(codexDataRoot, dependencies);
  inspection = await inspectArchive(path, backupId);
  return resultFromInspection(path, codexDataRoot, inspection);
}
function resultFromInspection(path, root, inspection) {
  return {
    backupId: inspection.manifest.backupId,
    backupPath: path,
    backupLocation: { kind: "codex-data-relative", path: relative3(root, path).replaceAll("\\", "/") },
    manifest: inspection.manifest,
    manifestHash: hashProjectBackupManifest(inspection.manifestBytes),
    archiveHash: inspection.archiveHash
  };
}
async function flushPublished(path, dependencies) {
  const handle = await openRegularFile(path, "r+", "Published backup archive");
  try {
    await (dependencies.syncPublished ?? ((file) => file.sync()))(handle);
  } catch (error) {
    throw new ProjectBackupError(`Published backup archive flush failed: ${errorMessage2(error)}`, path, { cause: error });
  } finally {
    await handle.close();
  }
}
async function syncDirectory7(path, platform) {
  const handle = await open9(path, "r");
  try {
    await handle.sync();
  } catch (error) {
    if (platform === "win32" && (hasCode(error, "EINVAL") || hasCode(error, "ENOTSUP") || hasCode(error, "EPERM")))
      return;
    throw error;
  } finally {
    await handle.close();
  }
}
async function syncBackupDirectory(path, dependencies) {
  if (dependencies.syncDirectory !== void 0)
    return dependencies.syncDirectory(path);
  return syncDirectory7(path, dependencies.platform ?? process.platform);
}
async function inspectArchive(path, expectedBackupId) {
  const handle = await openRegularFile(path, "r", "Backup archive");
  try {
    const status = await handle.stat();
    if (status.size > maximumArchiveBytes)
      throw new ProjectBackupError("Backup archive exceeds its byte limit", path);
    const archiveHash = createHash5("sha256");
    let offset = 0;
    const readPart = async (length) => {
      const bytes = await readExact(handle, offset, length);
      offset += length;
      archiveHash.update(bytes);
      return bytes;
    };
    if (!(await readPart(archiveMagic.byteLength)).equals(archiveMagic))
      throw new ProjectBackupError("Backup archive magic is invalid", path);
    const manifestLength = Number((await readPart(8)).readBigUInt64BE());
    if (!Number.isSafeInteger(manifestLength) || manifestLength < 1 || manifestLength > maximumManifestBytes) {
      throw new ProjectBackupError("Backup archive manifest length is invalid", path);
    }
    const manifestBytes = await readPart(manifestLength);
    const manifest = parseManifest(manifestBytes, expectedBackupId);
    for (const file of manifest.files) {
      const digest = createHash5("sha256");
      let remaining = file.length;
      while (remaining > 0) {
        const chunk = await readPart(Math.min(ioBufferSize, remaining));
        digest.update(chunk);
        remaining -= chunk.byteLength;
      }
      if (digest.digest("hex") !== file.sha256)
        throw new ProjectBackupError(`Backup archive payload failed SHA-256: ${file.path}`, path);
    }
    if (offset !== status.size)
      throw new ProjectBackupError("Backup archive contains trailing or missing bytes", path);
    return { manifest, manifestBytes, archiveHash: contentHash3(archiveHash.digest("hex")) };
  } finally {
    await handle.close();
  }
}
function parseManifest(bytes, expectedBackupId) {
  let value;
  try {
    value = parseCanonicalJson(bytes.toString("utf8"));
  } catch (error) {
    throw new ProjectBackupError(`Backup archive manifest is malformed: ${errorMessage2(error)}`);
  }
  if (!isRecord3(value) || !hasExactKeys(value, ["backupId", "createdAt", "files", "formatVersion", "source"])) {
    throw new ProjectBackupError("Backup archive manifest has an invalid structure");
  }
  const source = value.source;
  if (!isRecord3(source) || !hasExactKeys(source, ["projectorDirectory"]) || source.projectorDirectory !== ".projector") {
    throw new ProjectBackupError("Backup archive manifest source is invalid");
  }
  if (value.formatVersion !== 1 || value.backupId !== expectedBackupId || typeof value.createdAt !== "string" || new Date(value.createdAt).toISOString() !== value.createdAt || !Array.isArray(value.files) || value.files.length > maximumEntryCount) {
    throw new ProjectBackupError("Backup archive manifest identity or metadata is invalid");
  }
  assertBackupId(value.backupId);
  const files = [];
  let prior = "";
  let total = 0;
  for (const item of value.files) {
    if (!isRecord3(item) || !hasExactKeys(item, ["length", "path", "sha256"]) || typeof item.path !== "string" || !item.path.startsWith(".projector/") || !PortableRelativePathSchema.safeParse(item.path).success || typeof item.length !== "number" || !Number.isSafeInteger(item.length) || item.length < 0 || typeof item.sha256 !== "string" || !/^[0-9a-f]{64}$/u.test(item.sha256) || item.path <= prior) {
      throw new ProjectBackupError("Backup archive manifest contains an invalid file declaration");
    }
    prior = item.path;
    total += item.length;
    if (!Number.isSafeInteger(total) || total > maximumArchiveBytes)
      throw new ProjectBackupError("Backup archive payload exceeds its byte limit");
    files.push({ path: item.path, length: item.length, sha256: item.sha256 });
  }
  const manifest = {
    formatVersion: 1,
    backupId: value.backupId,
    createdAt: value.createdAt,
    source: { projectorDirectory: ".projector" },
    files
  };
  if (!bytes.equals(Buffer.from(`${canonicalJson(manifest)}
`)))
    throw new ProjectBackupError("Backup archive manifest is not canonical JSON");
  return manifest;
}
async function scanTree(root, excludedPaths = /* @__PURE__ */ new Set()) {
  const files = [];
  let entries = 0;
  let totalBytes = 0;
  async function visit(directory, prefix) {
    await assertRegularDirectory(directory, prefix.length === 0 ? "Projector source directory" : `.projector/${prefix}`);
    const names = [];
    const stream = await opendir3(directory);
    for await (const entry of stream) {
      entries += 1;
      if (entries > maximumEntryCount)
        throw new ProjectBackupError("Projector source exceeds its entry limit");
      names.push(entry.name);
    }
    names.sort(compareText);
    for (const name of names) {
      const relativePath = prefix.length === 0 ? name : `${prefix}/${name}`;
      if (excludedPaths.has(relativePath))
        continue;
      if (!PortableRelativePathSchema.safeParse(`.projector/${relativePath}`).success) {
        throw new ProjectBackupError(`Projector source contains an unsafe path: .projector/${relativePath}`);
      }
      const path = join11(directory, name);
      const status = await lstat10(path);
      if (status.isSymbolicLink())
        throw new ProjectBackupError(`Projector source contains a symbolic link: .projector/${relativePath}`);
      if (status.isDirectory())
        await visit(path, relativePath);
      else if (status.isFile()) {
        const source = await openRegularFile(path, "r", `.projector/${relativePath}`);
        try {
          const measured = await hashOpenFile(source);
          totalBytes += measured.length;
          if (!Number.isSafeInteger(totalBytes) || totalBytes > maximumArchiveBytes)
            throw new ProjectBackupError("Projector source exceeds its byte limit");
          files.push({ path: relativePath, ...measured });
        } finally {
          await source.close();
        }
      } else
        throw new ProjectBackupError(`Projector source contains a non-regular entry: .projector/${relativePath}`);
    }
  }
  await visit(root, "");
  files.sort((left, right) => compareText(left.path, right.path));
  return { files };
}
var accessCounterPath = ".projector/runtime/operation-access/next-ticket";
var accessHolderPattern = /^\.projector\/runtime\/operation-access\/holders\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/iu;
var writerLeasePaths = [
  ".projector/runtime/writer-lease.lock/owner.json",
  ".projector/runtime/writer-lease.lock/heartbeat"
];
async function authenticateCoordination(coordination) {
  if (coordination === void 0)
    return /* @__PURE__ */ new Set();
  await assertCoordinationOwned(coordination);
  const paths = [...coordination.operationAccess.ownedRelativePaths];
  if (paths.length !== 2 || new Set(paths).size !== 2 || !paths.includes(accessCounterPath) || paths.filter((path) => accessHolderPattern.test(path)).length !== 1) {
    throw new ProjectBackupError("Backup coordination must identify exactly the authenticated access counter and holder");
  }
  for (const path of paths) {
    if (!PortableRelativePathSchema.safeParse(path).success) {
      throw new ProjectBackupError(`Backup coordination contains an unsafe owned path: ${path}`);
    }
  }
  return new Set([...paths, ...writerLeasePaths].map((path) => path.slice(".projector/".length)));
}
async function assertCoordinationOwned(coordination) {
  if (coordination === void 0)
    return;
  await coordination.operationAccess.assertOwned();
  await coordination.writerLease.heartbeat();
  await coordination.operationAccess.assertOwned();
}
async function hashOpenFile(handle) {
  const digest = createHash5("sha256");
  let length = 0;
  const buffer = Buffer.allocUnsafe(ioBufferSize);
  while (true) {
    const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, null);
    if (bytesRead === 0)
      break;
    digest.update(buffer.subarray(0, bytesRead));
    length += bytesRead;
    if (length > maximumArchiveBytes)
      throw new ProjectBackupError("Projector source file exceeds its byte limit");
  }
  return { length, sha256: digest.digest("hex") };
}
async function copyAndHash(source, destination, archiveHash) {
  const digest = createHash5("sha256");
  let length = 0;
  const buffer = Buffer.allocUnsafe(ioBufferSize);
  while (true) {
    const { bytesRead } = await source.read(buffer, 0, buffer.byteLength, null);
    if (bytesRead === 0)
      break;
    const chunk = buffer.subarray(0, bytesRead);
    await writeAll2(destination, chunk);
    digest.update(chunk);
    archiveHash.update(chunk);
    length += bytesRead;
    if (length > maximumArchiveBytes)
      throw new ProjectBackupError("Projector source file exceeds its byte limit");
  }
  return { length, sha256: digest.digest("hex") };
}
async function writeAll2(handle, bytes) {
  let offset = 0;
  while (offset < bytes.byteLength)
    offset += (await handle.write(bytes, offset, bytes.byteLength - offset)).bytesWritten;
}
async function readExact(handle, position, length) {
  const bytes = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const result = await handle.read(bytes, offset, length - offset, position + offset);
    if (result.bytesRead === 0)
      throw new ProjectBackupError("Backup archive ended unexpectedly");
    offset += result.bytesRead;
  }
  return bytes;
}
async function openRegularFile(path, mode, label) {
  const status = await lstat10(path);
  if (status.isSymbolicLink())
    throw new ProjectBackupError(`${label} is a symbolic link`);
  if (!status.isFile())
    throw new ProjectBackupError(`${label} is not a regular file`);
  const flags = (mode === "r" ? constants7.O_RDONLY : constants7.O_RDWR) | (constants7.O_NOFOLLOW ?? 0);
  return open9(path, flags);
}
async function assertRegularDirectory(path, label) {
  const status = await lstat10(path);
  if (status.isSymbolicLink())
    throw new ProjectBackupError(`${label} is a symbolic link`);
  if (!status.isDirectory())
    throw new ProjectBackupError(`${label} is not a regular directory`);
}
function sameSnapshot2(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function resolveRequiredPath(value, label) {
  if (value.length === 0)
    throw new TypeError(`A ${label} is required`);
  return resolve2(value);
}
function containedPath(root, target, label) {
  const resolvedRoot = resolve2(root);
  const resolvedTarget = resolve2(target);
  const offset = relative3(resolvedRoot, resolvedTarget);
  if (offset === "" || offset === ".." || offset.startsWith("..\\") || offset.startsWith("../") || isAbsolute4(offset)) {
    if (resolvedTarget !== resolvedRoot)
      throw new ProjectBackupError(`${label} escapes its required root`);
  }
  return resolvedTarget;
}
function assertBackupId(value) {
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(value) || !PortableRelativePathSchema.safeParse(value).success) {
    throw new TypeError(`Invalid backup identifier: ${value}`);
  }
}
function contentHash3(hex) {
  return `sha256:v1:${hex}`;
}
function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasExactKeys(value, expected) {
  const keys = Object.keys(value).sort(compareText);
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}
async function exists(path) {
  try {
    await lstat10(path);
    return true;
  } catch (error) {
    if (hasCode(error, "ENOENT"))
      return false;
    throw error;
  }
}
function hasCode(error, code) {
  return error instanceof Error && "code" in error && error.code === code;
}
function errorMessage2(error) {
  return error instanceof Error ? error.message : String(error);
}

export {
  parseTomlDocument,
  stringifyTomlDocument,
  PathSecurityError,
  RepositoryPathService,
  createProjectorEditorSchemaBundle,
  installProjectorEditorSchemaBundle,
  canonicalEditorSchemaRelativePath,
  currentObservationScope,
  withObservationScope,
  markdownCanonicalKinds,
  isMarkdownCanonicalKind,
  parseCanonicalMarkdownDocument,
  stringifyCanonicalMarkdownDocument,
  canonicalApiVersion,
  canonicalSchemaVersion,
  classifyCanonicalSource,
  collectCanonicalSnapshotSources,
  parseCanonicalSnapshotSources,
  assertSupportedCanonicalVersions,
  CanonicalFileRepository,
  compareCanonicalSnapshots,
  ArtifactSetIntegrityError,
  ArtifactSetIncompleteError,
  DurableArtifactSetStore,
  currentSqliteSchemaVersion,
  sqliteMigrationSetHash,
  migrateSqlite,
  SqliteDerivedStore,
  ExecutionRefusedError,
  ExecutionLimitError,
  ExecutionCleanupError,
  configuredHostAssumptions,
  StateBoundCommandExecutor,
  NativeProcessLauncher,
  executePacketPlan,
  inspectExistingSqliteDerivedState,
  rebuildDerivedStore,
  DERIVED_CACHE_MAX_BYTES,
  DerivedCacheError,
  withDerivedCacheAdmission,
  checkDerivedCacheBudget,
  readDerivedCacheSource,
  touchDerivedCacheEntry,
  checkoutCacheLocation,
  resolveDerivedCachePath,
  SqliteObservationStore,
  hashFileTransactionJournalBytes,
  fileTransactionJournalRelativePath,
  parseFileTransactionJournalSource,
  InvalidJournalTransitionError,
  JournalRecoveryRequiredError,
  FileTransaction,
  FileTransactionJournal,
  StateBoundMutationError,
  GovernedWorktreeRuntime,
  GovernedWorktreeSession,
  LeaseConflictError,
  WriterLeaseHandle,
  MigrationRecoveryWriterLeaseHandle,
  GenerationWriterLeaseHandle,
  WriterLeaseManager,
  TransformScopeError,
  TransformPreconditionError,
  ExactTextPatchTransform,
  MoveReferenceTransform,
  TransformClaimConflictError,
  TransformRegistry,
  WatchCoordinator,
  authenticateWatchCheckpoint,
  FileWatchCheckpointStore,
  runWatchLifecycle,
  unavailableOperationalEvidence,
  deriveOperationalExitCode,
  redactBeforeBoundary,
  OperationalReportSchema,
  parseOperationalReport,
  createOperationalReport,
  validateOperationalReport,
  renderOperationalReport,
  JsonlTelemetryStore,
  PROJECTOR_CONFIG_PATH,
  inspectProjectActivation,
  initializeProjectLocalIgnore,
  OperationAccessError,
  tryWithProjectExclusiveAccess,
  withProjectOperationAccess,
  recoverAbandonedProjectOperationAccess,
  processIsAlive,
  ProjectBackupError,
  createProjectBackup,
  hashProjectBackupManifest,
  hashProjectBackupArchive,
  verifyProjectBackup
};
