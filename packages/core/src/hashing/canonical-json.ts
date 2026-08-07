import { createHash } from "node:crypto";

export type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue | undefined };

function serialize(value: unknown, seen: Set<object>, inArray: boolean): string | undefined {
  if (value === undefined) {
    if (inArray) {
      throw new TypeError("undefined array elements are not JSON values");
    }
    return undefined;
  }
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("canonical JSON numbers must be finite");
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value !== "object") {
    throw new TypeError(`${typeof value} is not a JSON value`);
  }
  if (seen.has(value)) {
    throw new TypeError("cyclic values are not JSON values");
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((item) => serialize(item, seen, true)).join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value) as object | null;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("only plain objects are JSON values");
    }
    const entries: string[] = [];
    for (const key of Object.keys(value).sort()) {
      const item = serialize((value as Record<string, unknown>)[key], seen, false);
      if (item !== undefined) {
        entries.push(`${JSON.stringify(key)}:${item}`);
      }
    }
    return `{${entries.join(",")}}`;
  } finally {
    seen.delete(value);
  }
}

export function canonicalJson(value: unknown): string {
  const result = serialize(value, new Set(), false);
  if (result === undefined) {
    throw new TypeError("top-level undefined is not a JSON value");
  }
  return result;
}

export function parseCanonicalJson(source: string): unknown {
  let offset = 0;
  const whitespace = (): void => {
    while (/\s/u.test(source[offset] ?? "")) offset += 1;
  };
  const fail = (message: string): never => {
    throw new SyntaxError(`${message} at offset ${offset}`);
  };
  const string = (): string => {
    const start = offset;
    if (source[offset] !== '"') fail("expected string");
    offset += 1;
    while (offset < source.length) {
      const character = source[offset];
      if (character === '"') {
        offset += 1;
        return JSON.parse(source.slice(start, offset)) as string;
      }
      if (character === "\\") {
        offset += 2;
      } else {
        offset += 1;
      }
    }
    return fail("unterminated string");
  };
  const value = (): unknown => {
    whitespace();
    const character = source[offset];
    if (character === '"') return string();
    if (character === "{") {
      offset += 1;
      const result: Record<string, unknown> = {};
      const keys = new Set<string>();
      whitespace();
      if (source[offset] === "}") {
        offset += 1;
        return result;
      }
      while (true) {
        whitespace();
        const key = string();
        if (keys.has(key)) fail(`duplicate object key ${JSON.stringify(key)}`);
        keys.add(key);
        whitespace();
        if (source[offset] !== ":") fail("expected colon");
        offset += 1;
        result[key] = value();
        whitespace();
        if (source[offset] === "}") {
          offset += 1;
          return result;
        }
        if (source[offset] !== ",") fail("expected comma");
        offset += 1;
      }
    }
    if (character === "[") {
      offset += 1;
      const result: unknown[] = [];
      whitespace();
      if (source[offset] === "]") {
        offset += 1;
        return result;
      }
      while (true) {
        result.push(value());
        whitespace();
        if (source[offset] === "]") {
          offset += 1;
          return result;
        }
        if (source[offset] !== ",") fail("expected comma");
        offset += 1;
      }
    }
    for (const [token, parsed] of [["true", true], ["false", false], ["null", null]] as const) {
      if (source.startsWith(token, offset)) {
        offset += token.length;
        return parsed;
      }
    }
    const number = source.slice(offset).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u)?.[0];
    if (number !== undefined) {
      offset += number.length;
      const parsed = Number(number);
      if (!Number.isFinite(parsed)) fail("JSON number must be finite");
      return parsed;
    }
    return fail("expected JSON value");
  };
  const parsed = value();
  whitespace();
  if (offset !== source.length) fail("unexpected trailing input");
  return parsed;
}

function frame(value: Uint8Array): Uint8Array {
  const length = Buffer.allocUnsafe(8);
  length.writeBigUInt64BE(BigInt(value.byteLength));
  return Buffer.concat([length, value]);
}

export function hashFramedDomain(domain: string, ...values: readonly unknown[]): `sha256:v1:${string}` {
  const hash = createHash("sha256");
  hash.update(frame(Buffer.from("projector\0sha256\0v1", "utf8")));
  hash.update(frame(Buffer.from(domain, "utf8")));
  for (const value of values) {
    hash.update(frame(Buffer.from(canonicalJson(value), "utf8")));
  }
  return `sha256:v1:${hash.digest("hex")}`;
}
