import { parse, stringify, TomlError } from "smol-toml";

const nullMarkerKey = "__projector_toml_null";
const readableProseKeys = new Set([
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
  "statement",
]);
const readableProseColumn = 100;

export interface TomlDocumentOptions {
  readonly schemaPath?: string;
}

function assertJsonCompatible(value: unknown, path = "$"): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`unsupported TOML value at ${path}: non-finite number`);
    return;
  }
  if (typeof value === "bigint") throw new Error(`unsupported TOML value at ${path}: bigint`);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonCompatible(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === "object" && !(value instanceof Date)) {
    for (const [key, item] of Object.entries(value)) assertJsonCompatible(item, `${path}.${key}`);
    return;
  }
  throw new Error(`unsupported TOML value at ${path}: ${value instanceof Date ? "date" : typeof value}`);
}

export function parseTomlDocument(source: string, path = "TOML document"): unknown {
  try {
    const value = parse(source.replaceAll("\r\n", "\n"), { integersAsBigInt: "asNeeded" });
    const decoded = decodeNulls(value);
    if (decoded === null) throw new Error("a TOML document root cannot be null");
    assertJsonCompatible(decoded);
    return decoded;
  } catch (error) {
    if (error instanceof TomlError) {
      throw new Error(
        `invalid TOML at ${path}, line ${error.line}, column ${error.column}: ${error.message}`,
        { cause: error },
      );
    }
    throw error;
  }
}

export function stringifyTomlDocument(
  value: Readonly<Record<string, unknown>>,
  options: TomlDocumentOptions = {},
): string {
  assertJsonCompatible(value);
  assertNoReservedNullMarkers(value);
  const schemaDirective = options.schemaPath === undefined ? "" : schemaHeader(options.schemaPath);
  const encodable = encodeNulls(value) as Record<string, unknown>;
  const reserved = new Set<string>();
  collectStrings(encodable, reserved);
  const replacements: Array<{ readonly token: string; readonly value: string }> = [];
  const prepared = replaceMultilineStrings(encodable, reserved, replacements);
  let encoded = stringify(prepared);
  for (const replacement of replacements) {
    const quotedToken = JSON.stringify(replacement.token);
    const pieces = encoded.split(quotedToken);
    if (pieces.length !== 2) throw new Error("TOML multiline placeholder was not serialized exactly once");
    encoded = `${pieces[0]}${renderMultilineBasicString(replacement.value)}${pieces[1]}`;
  }
  return `${schemaDirective}${encoded.endsWith("\n") ? encoded : `${encoded}\n`}`;
}

function encodeNulls(value: unknown): unknown {
  if (value === null) return { [nullMarkerKey]: true };
  if (Array.isArray(value)) return value.map(encodeNulls);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeNulls(item)]));
  }
  return value;
}

function decodeNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeNulls);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (Object.hasOwn(value, nullMarkerKey)) {
      if (entries.length !== 1 || (value as Record<string, unknown>)[nullMarkerKey] !== true) {
        throw new Error(`invalid reserved TOML null marker ${nullMarkerKey}`);
      }
      return null;
    }
    return Object.fromEntries(entries.map(([key, item]) => [key, decodeNulls(item)]));
  }
  return value;
}

function assertNoReservedNullMarkers(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoReservedNullMarkers(item, `${path}[${index}]`));
  } else if (value !== null && typeof value === "object") {
    if (Object.hasOwn(value, nullMarkerKey)) throw new Error(`${nullMarkerKey} is reserved at ${path}`);
    for (const [key, item] of Object.entries(value)) assertNoReservedNullMarkers(item, `${path}.${key}`);
  }
}

function schemaHeader(path: string): string {
  const relativeSchemaPath = /^(?![A-Za-z][A-Za-z0-9+.-]*:)(?![/\\])(?:\.{1,2}\/|[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.json$/u;
  if (!relativeSchemaPath.test(path)) {
    throw new Error(`schemaPath must be a document-relative JSON schema path: ${path}`);
  }
  return `#:schema ${path}\n`;
}

function collectStrings(value: unknown, collected: Set<string>): void {
  if (typeof value === "string") {
    collected.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, collected);
  } else if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      collected.add(key);
      collectStrings(item, collected);
    }
  }
}

function replaceMultilineStrings(
  value: unknown,
  reserved: Set<string>,
  replacements: Array<{ token: string; value: string }>,
  key?: string,
): unknown {
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
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, item]) => [entryKey, replaceMultilineStrings(item, reserved, replacements, entryKey)]),
    );
  }
  return value;
}

function shouldWrapProse(key: string | undefined, value: string): boolean {
  return key !== undefined && readableProseKeys.has(key) && value.length > readableProseColumn && value.includes(" ");
}

function renderMultilineBasicString(value: string): string {
  let encoded = "";
  let column = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    const code = character.charCodeAt(0);
    let fragment: string;
    if (character === "\n") fragment = index === 0 || index === value.length - 1 ? "\\n" : "\n";
    else if (character === "\\") fragment = "\\\\";
    else if (character === '"') fragment = '\\"';
    else if (character === "\b") fragment = "\\b";
    else if (character === "\t") fragment = "\\t";
    else if (character === "\f") fragment = "\\f";
    else if (character === "\r") fragment = "\\r";
    else if (code < 0x20 || code === 0x7f) fragment = `\\u${code.toString(16).padStart(4, "0")}`;
    else fragment = character;
    encoded += fragment;
    if (fragment === "\n") column = 0;
    else column += fragment.length;
    if (character === " " && column >= readableProseColumn && index < value.length - 1 && value[index + 1] !== " ") {
      encoded += "\\\n  ";
      column = 2;
    }
  }
  return `"""${encoded}"""`;
}
