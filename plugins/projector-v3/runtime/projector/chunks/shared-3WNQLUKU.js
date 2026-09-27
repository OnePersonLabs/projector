import { createRequire as __projectorCreateRequire } from "node:module"; const require = __projectorCreateRequire(import.meta.url);
import {
  CanonicalDocumentEnvelopeSchema,
  CanonicalDocumentEnvelopeSchemasByKind,
  CanonicalDocumentWireSchemasByKind,
  ContentHashSchema,
  DEFAULT_OBSERVATION_LIMITS,
  DerivedObservationBudget,
  ObservationBudget,
  ObservationError,
  PortableRelativePathSchema,
  StateBindingSchema,
  StateDigestSchema,
  __export,
  authorizeRepositoryPath,
  canonicalJson,
  compileWriteAuthorization,
  exportContractJsonSchemas,
  external_exports,
  hashFramedDomain,
  hashRootManifest,
  hydrateCanonicalDocumentWire,
  parseCanonicalJson,
  parseProjectorConfig,
  projectorConfigApiVersion,
  toCanonicalDocumentWire
} from "./shared-6VIFAIKJ.js";

// node_modules/@projector/runtime/dist/persistence/canonical-repository.js
import { createHash, randomBytes as randomBytes2 } from "node:crypto";
import { constants as constants2, createReadStream } from "node:fs";
import { lstat as lstat3, mkdir as mkdir2, open as open2, opendir, readFile as readFile2, rename, rm as rm2 } from "node:fs/promises";
import { dirname as dirname2, join as join3, relative as relative2 } from "node:path";

// node_modules/smol-toml/dist/date.js
var DATE_TIME_RE = /^(\d{4}-\d{2}-\d{2})?[T ]?(?:(\d{2}):\d{2}(?::\d{2}(?:\.\d+)?)?)?(Z|[-+]\d{2}:\d{2})?$/i;
var TomlDate = class _TomlDate extends Date {
  #hasDate = false;
  #hasTime = false;
  #offset = null;
  constructor(date) {
    let hasDate = true;
    let hasTime = true;
    let offset = "Z";
    if (typeof date === "string") {
      let match = date.match(DATE_TIME_RE);
      if (match) {
        if (!match[1]) {
          hasDate = false;
          date = `0000-01-01T${date}`;
        }
        hasTime = !!match[2];
        hasTime && date[10] === " " && (date = date.replace(" ", "T"));
        if (match[2] && +match[2] > 23) {
          date = "";
        } else {
          offset = match[3] || null;
          date = date.toUpperCase();
          if (!offset && hasTime)
            date += "Z";
        }
      } else {
        date = "";
      }
    }
    super(date);
    if (!isNaN(this.getTime())) {
      this.#hasDate = hasDate;
      this.#hasTime = hasTime;
      this.#offset = offset;
    }
  }
  isDateTime() {
    return this.#hasDate && this.#hasTime;
  }
  isLocal() {
    return !this.#hasDate || !this.#hasTime || !this.#offset;
  }
  isDate() {
    return this.#hasDate && !this.#hasTime;
  }
  isTime() {
    return this.#hasTime && !this.#hasDate;
  }
  isValid() {
    return this.#hasDate || this.#hasTime;
  }
  toISOString() {
    let iso = super.toISOString();
    if (this.isDate())
      return iso.slice(0, 10);
    if (this.isTime())
      return iso.slice(11, 23);
    if (this.#offset === null)
      return iso.slice(0, -1);
    if (this.#offset === "Z")
      return iso;
    let offset = +this.#offset.slice(1, 3) * 60 + +this.#offset.slice(4, 6);
    offset = this.#offset[0] === "-" ? offset : -offset;
    let offsetDate = new Date(this.getTime() - offset * 6e4);
    return offsetDate.toISOString().slice(0, -1) + this.#offset;
  }
  static wrapAsOffsetDateTime(jsDate, offset = "Z") {
    let date = new _TomlDate(jsDate);
    date.#offset = offset;
    return date;
  }
  static wrapAsLocalDateTime(jsDate) {
    let date = new _TomlDate(jsDate);
    date.#offset = null;
    return date;
  }
  static wrapAsLocalDate(jsDate) {
    let date = new _TomlDate(jsDate);
    date.#hasTime = false;
    date.#offset = null;
    return date;
  }
  static wrapAsLocalTime(jsDate) {
    let date = new _TomlDate(jsDate);
    date.#hasDate = false;
    date.#offset = null;
    return date;
  }
};

// node_modules/smol-toml/dist/error.js
function getLineColFromPtr(string3, ptr) {
  let lines = string3.slice(0, ptr).split(/\r\n|\n|\r/g);
  return [lines.length, lines.pop().length + 1];
}
function makeCodeBlock(string3, line, column) {
  let lines = string3.split(/\r\n|\n|\r/g);
  let codeblock = "";
  let numberLen = (Math.log10(line + 1) | 0) + 1;
  for (let i = line - 1; i <= line + 1; i++) {
    let l = lines[i - 1];
    if (!l)
      continue;
    codeblock += i.toString().padEnd(numberLen, " ");
    codeblock += ":  ";
    codeblock += l;
    codeblock += "\n";
    if (i === line) {
      codeblock += " ".repeat(numberLen + column + 2);
      codeblock += "^\n";
    }
  }
  return codeblock;
}
var TomlError = class extends Error {
  line;
  column;
  codeblock;
  constructor(message, options) {
    const [line, column] = getLineColFromPtr(options.toml, options.ptr);
    const codeblock = makeCodeBlock(options.toml, line, column);
    super(`Invalid TOML document: ${message}

${codeblock}`, options);
    this.line = line;
    this.column = column;
    this.codeblock = codeblock;
  }
};

// node_modules/smol-toml/dist/util.js
function indexOfNewline(str, start = 0) {
  let idx = str.indexOf("\n", start);
  if (str.charCodeAt(idx - 1) === 13)
    idx--;
  return idx;
}
function skipComment(ctx) {
  for (; ctx.p < ctx.s.length; ctx.p++) {
    let c = ctx.s.charCodeAt(ctx.p);
    if (c === 10)
      break;
    if (c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10) {
      ctx.p++;
      break;
    }
    if (c < 32 && c !== 9 || c === 127) {
      throw new TomlError("control characters are not allowed in comments", {
        toml: ctx.s,
        ptr: ctx.p
      });
    }
  }
}
function skipVoid(ctx, banNewLines, banComments) {
  let c;
  while (1) {
    while ((c = ctx.s.charCodeAt(ctx.p)) === 32 || c === 9 || !banNewLines && (c === 10 || c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10))
      ctx.p++;
    if (banComments || c !== 35)
      break;
    skipComment(ctx);
  }
}
function skipUntil(ctx, sep2, end) {
  let ptr = ctx.p;
  if (!end) {
    ptr = indexOfNewline(ctx.s, ptr);
    ctx.p = ptr < 0 ? ctx.s.length : ptr;
    return;
  }
  for (; ctx.p < ctx.s.length; ctx.p++) {
    let c = ctx.s.charCodeAt(ctx.p);
    if (c === 35) {
      skipComment(ctx);
    } else if (c === end || c === sep2) {
      return;
    }
  }
  throw new TomlError("cannot find end of structure", {
    toml: ctx.s,
    ptr
  });
}

// node_modules/smol-toml/dist/primitive.js
var INT_REGEX = /^((0x[0-9a-fA-F](_?[0-9a-fA-F])*)|(([+-]|0[ob])?\d(_?\d)*))$/;
var FLOAT_REGEX = /^[+-]?\d(_?\d)*(\.\d(_?\d)*)?([eE][+-]?\d(_?\d)*)?$/;
var LEADING_ZERO = /^[+-]?0[0-9_]/;
function parseString(ctx) {
  let start = ctx.p;
  let c = ctx.s.charCodeAt(ctx.p++);
  let first = c;
  let isLiteral = c === 39;
  let isMultiline = c === ctx.s.charCodeAt(ctx.p) && c === ctx.s.charCodeAt(ctx.p + 1);
  if (isMultiline) {
    if ((c = ctx.s.charCodeAt(ctx.p += 2)) === 10)
      ctx.p++;
    else if (c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10)
      ctx.p += 2;
  }
  let parsed = "";
  let sliceStart = ctx.p;
  let state = 0;
  for (; ctx.p < ctx.s.length; ctx.p++) {
    c = ctx.s.charCodeAt(ctx.p);
    if (isMultiline && (c === 10 || c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10)) {
      state = state && 3;
    } else if (c < 32 && c !== 9 || c === 127) {
      throw new TomlError("control characters are not allowed in strings", {
        toml: ctx.s,
        ptr: ctx.p
      });
    } else if ((!state || state === 3) && c === first && (!isMultiline || ctx.s.charCodeAt(ctx.p + 1) === first && ctx.s.charCodeAt(ctx.p + 2) === first)) {
      if (isMultiline) {
        if (ctx.s.charCodeAt(ctx.p + 3) === first)
          ctx.p++;
        if (ctx.s.charCodeAt(ctx.p + 3) === first)
          ctx.p++;
      }
      if (!state)
        parsed += ctx.s.slice(sliceStart, ctx.p);
      ctx.p += isMultiline ? 3 : 1;
      return parsed;
    } else if (!state) {
      if (!isLiteral && c === 92) {
        parsed += ctx.s.slice(sliceStart, sliceStart = ctx.p);
        state = 1;
      }
    } else if (state === 1) {
      if (c === 120 || c === 117 || c === 85) {
        let value = 0;
        let len = c === 120 ? 2 : c === 117 ? 4 : 8;
        for (let j = 0; j < len; j++, ctx.p++) {
          let hex = ctx.s.charCodeAt(ctx.p + 1);
          let digit = (
            /* 0-9 */
            hex >= 48 && hex <= 57 ? hex - 48 : (
              /* A-F */
              hex >= 65 && hex <= 70 ? hex - 65 + 10 : (
                /* a-f */
                hex >= 97 && hex <= 102 ? hex - 97 + 10 : -1
              )
            )
          );
          if (digit < 0)
            throw new TomlError("invalid non-hex character in unicode escape", { toml: ctx.s, ptr: ctx.p + 1 });
          value = value << 4 | digit;
        }
        if (value < 0 || value > 1114111 || value >= 55296 && value <= 57343) {
          throw new TomlError("invalid unicode escape", { toml: ctx.s, ptr: ctx.p });
        }
        parsed += String.fromCodePoint(value);
        sliceStart = ctx.p + 1;
        state = 0;
      } else if (c === 32 || c === 9) {
        state = 2;
      } else {
        if (c === 98)
          parsed += "\b";
        else if (c === 116)
          parsed += "	";
        else if (c === 110)
          parsed += "\n";
        else if (c === 102)
          parsed += "\f";
        else if (c === 114)
          parsed += "\r";
        else if (c === 101)
          parsed += "\x1B";
        else if (c === 34)
          parsed += '"';
        else if (c === 92)
          parsed += "\\";
        else
          throw new TomlError("unrecognized escape sequence", { toml: ctx.s, ptr: ctx.p });
        sliceStart = ctx.p + 1;
        state = 0;
      }
    } else if (c !== 32 && c !== 9) {
      if (state === 2) {
        throw new TomlError("invalid escape: only line-ending whitespace may be escaped", {
          toml: ctx.s,
          ptr: sliceStart
        });
      }
      state = !isLiteral && c === 92 ? 1 : 0;
      sliceStart = ctx.p;
    }
  }
  throw new TomlError("unfinished string", { toml: ctx.s, ptr: start });
}
function sliceAndTrimEndOf(ctx, start, end) {
  let value = ctx.s.slice(start, end);
  let commentIdx = value.indexOf("#");
  if (commentIdx > 0) {
    skipComment({ s: value, p: commentIdx, d: 0 });
    value = value.slice(0, commentIdx);
  }
  return value.trimEnd();
}
function parseValue(ctx, integersAsBigInt, end) {
  let ptr = ctx.p;
  let err = { toml: ctx.s, ptr };
  skipUntil(ctx, 44, end);
  let value = sliceAndTrimEndOf(ctx, ptr, ctx.p);
  if (!value)
    throw new TomlError("incomplete declaration: value expected", err);
  if (value === "-inf")
    return -Infinity;
  if (value === "inf" || value === "+inf")
    return Infinity;
  if (value === "nan" || value === "+nan" || value === "-nan")
    return NaN;
  if (value === "-0")
    return integersAsBigInt ? 0n : 0;
  let isInt = INT_REGEX.test(value);
  if (isInt || FLOAT_REGEX.test(value)) {
    if (LEADING_ZERO.test(value)) {
      throw new TomlError("leading zeroes are not allowed", err);
    }
    value = value.replace(/_/g, "");
    let numeric = +value;
    if (isNaN(numeric)) {
      throw new TomlError("invalid number", err);
    }
    if (isInt) {
      if ((isInt = !Number.isSafeInteger(numeric)) && !integersAsBigInt) {
        throw new TomlError("integer value cannot be represented losslessly", err);
      }
      if (isInt || integersAsBigInt === true)
        numeric = BigInt(value);
    }
    return numeric;
  }
  const date = new TomlDate(value);
  if (!date.isValid())
    throw new TomlError("invalid value", err);
  return date;
}

// node_modules/smol-toml/dist/extract.js
function extractValue(ctx, end, integersAsBigInt) {
  let ptr = ctx.p;
  let c = ctx.s.charCodeAt(ptr);
  if (c === 91 || c === 123) {
    if (!ctx.d--) {
      throw new TomlError("document contains excessively nested structures. aborting.", {
        toml: ctx.s,
        ptr
      });
    }
    let value = c === 91 ? parseArray(ctx, integersAsBigInt) : parseInlineTable(ctx, integersAsBigInt);
    ctx.d++;
    return value;
  }
  if (c === 34 || c === 39) {
    return parseString(ctx);
  }
  if (c === 116) {
    if (ctx.s.charCodeAt(++ctx.p) !== 114 || ctx.s.charCodeAt(++ctx.p) !== 117 || ctx.s.charCodeAt(++ctx.p) !== 101)
      throw new TomlError("invalid value", { toml: ctx.s, ptr });
    ctx.p++;
    return true;
  }
  if (c === 102) {
    if (ctx.s.charCodeAt(++ctx.p) !== 97 || ctx.s.charCodeAt(++ctx.p) !== 108 || ctx.s.charCodeAt(++ctx.p) !== 115 || ctx.s.charCodeAt(++ctx.p) !== 101)
      throw new TomlError("invalid value", { toml: ctx.s, ptr });
    ctx.p++;
    return false;
  }
  return parseValue(ctx, integersAsBigInt, end);
}

// node_modules/smol-toml/dist/struct.js
var KEY_PART_RE = /^[a-zA-Z0-9-_]+[ \t]*$/;
function parseKey(ctx, end = "=") {
  let start = ctx.p;
  let dot = start - 1;
  let parsed = [];
  let endPtr = ctx.s.indexOf(end, start);
  if (endPtr < 0) {
    throw new TomlError("incomplete key-value: cannot find end of key", {
      toml: ctx.s,
      ptr: start
    });
  }
  do {
    let c = ctx.s.charCodeAt(ctx.p = ++dot);
    if (c !== 32 && c !== 9) {
      if (c === 34 || c === 39) {
        if (c === ctx.s.charCodeAt(ctx.p + 1) && c === ctx.s.charCodeAt(ctx.p + 2)) {
          throw new TomlError("multiline strings are not allowed in keys", {
            toml: ctx.s,
            ptr: ctx.p
          });
        }
        let part = parseString(ctx);
        dot = ctx.s.indexOf(".", ctx.p);
        let strEnd = ctx.s.slice(ctx.p, dot < 0 || dot > endPtr ? endPtr : dot);
        let newLine = indexOfNewline(strEnd);
        if (newLine > -1) {
          throw new TomlError("newlines are not allowed in keys", {
            toml: ctx.s,
            ptr: newLine
          });
        }
        if (strEnd.trimStart()) {
          throw new TomlError("found extra tokens after the string part", {
            toml: ctx.s,
            ptr: ctx.p
          });
        }
        if (endPtr < ctx.p) {
          endPtr = ctx.s.indexOf(end, ctx.p);
          if (endPtr < 0) {
            throw new TomlError("incomplete key-value: cannot find end of key", {
              toml: ctx.s,
              ptr: start
            });
          }
        }
        parsed.push(part);
      } else {
        dot = ctx.s.indexOf(".", ctx.p);
        let part = ctx.s.slice(ctx.p, dot < 0 || dot > endPtr ? endPtr : dot);
        if (!KEY_PART_RE.test(part)) {
          throw new TomlError("only letter, numbers, dashes and underscores are allowed in keys", {
            toml: ctx.s,
            ptr: ctx.p
          });
        }
        parsed.push(part.trimEnd());
      }
    }
  } while (dot + 1 && dot < endPtr);
  ctx.p = endPtr + 1;
  skipVoid(ctx, true, true);
  return parsed;
}
function parseInlineTable(ctx, integersAsBigInt) {
  let res = {};
  let seen = /* @__PURE__ */ new Set();
  let c;
  ctx.p++;
  while (ctx.p < ctx.s.length) {
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p)) === 125) {
      ctx.p++;
      return res;
    }
    let k;
    let t = res;
    let hasOwn = false;
    let p = ctx.p;
    let key = parseKey(ctx);
    for (let i = 0; i < key.length; i++) {
      if (i)
        t = hasOwn ? t[k] : t[k] = {};
      k = key[i];
      if ((hasOwn = Object.hasOwn(t, k)) && (typeof t[k] !== "object" || seen.has(t[k]))) {
        throw new TomlError("trying to redefine an already defined value", {
          toml: ctx.s,
          ptr: p
        });
      }
      if (!hasOwn && k === "__proto__") {
        Object.defineProperty(t, k, { enumerable: true, configurable: true, writable: true });
      }
    }
    if (hasOwn) {
      throw new TomlError("trying to redefine an already defined value", {
        toml: ctx.s,
        ptr: ctx.p
      });
    }
    let value = extractValue(ctx, 125, integersAsBigInt);
    seen.add(t[k] = value);
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p++)) === 125) {
      return res;
    }
    if (c !== 44) {
      throw new TomlError("expected comma or end of structure", { toml: ctx.s, ptr: ctx.p - 1 });
    }
  }
  throw new TomlError("unfinished table encountered", {
    toml: ctx.s,
    ptr: ctx.p
  });
}
function parseArray(ctx, integersAsBigInt) {
  let res = [];
  let c;
  ctx.p++;
  while (ctx.p < ctx.s.length) {
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p)) === 93) {
      ctx.p++;
      return res;
    }
    res.push(extractValue(ctx, 93, integersAsBigInt));
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p++)) === 93) {
      return res;
    }
    if (c !== 44) {
      throw new TomlError("expected comma or end of structure", { toml: ctx.s, ptr: ctx.p - 1 });
    }
  }
  throw new TomlError("unfinished array encountered", {
    toml: ctx.s,
    ptr: ctx.p
  });
}

// node_modules/smol-toml/dist/parse.js
function peekTable(key, table, meta, type) {
  let t = table;
  let m = meta;
  let k;
  let hasOwn = false;
  let state;
  for (let i = 0; i < key.length; i++) {
    if (i) {
      t = hasOwn ? t[k] : t[k] = {};
      m = (state = m[k]).c;
      if (type === 0 && (state.t === 1 || state.t === 2)) {
        return null;
      }
      if (state.t === 2) {
        let l = t.length - 1;
        t = t[l];
        m = m[l].c;
      }
    }
    k = key[i];
    if ((hasOwn = Object.hasOwn(t, k)) && m[k]?.t === 0 && m[k]?.d) {
      return null;
    }
    if (!hasOwn) {
      if (k === "__proto__") {
        Object.defineProperty(t, k, { enumerable: true, configurable: true, writable: true });
        Object.defineProperty(m, k, { enumerable: true, configurable: true, writable: true });
      }
      m[k] = {
        t: i < key.length - 1 && type === 2 ? 3 : type,
        d: false,
        i: 0,
        c: {}
      };
    }
  }
  state = m[k];
  if (state.t !== type && !(type === 1 && state.t === 3)) {
    return null;
  }
  if (type === 2) {
    if (!state.d) {
      state.d = true;
      t[k] = [];
    }
    t[k].push(t = {});
    state.c[state.i++] = state = { t: 1, d: false, i: 0, c: {} };
  }
  if (state.d) {
    return null;
  }
  state.d = true;
  if (type === 1) {
    t = hasOwn ? t[k] : t[k] = {};
  } else if (type === 0 && hasOwn) {
    return null;
  }
  return [k, t, state.c];
}
function parse(toml, { maxDepth = 1e3, integersAsBigInt } = {}) {
  let ctx = { s: toml, p: 0, d: maxDepth };
  let res = {};
  let meta = {};
  let tmp;
  let tbl = res;
  let m = meta;
  skipVoid(ctx);
  while (ctx.p < toml.length) {
    if (toml.charCodeAt(ctx.p) === 91) {
      let isTableArray = toml.charCodeAt(++ctx.p) === 91;
      tmp = ctx.p += +isTableArray;
      let k = parseKey(ctx, "]");
      if (isTableArray) {
        if (toml.charCodeAt(ctx.p - 1) !== 93) {
          throw new TomlError("expected end of table declaration", {
            toml,
            ptr: ctx.p - 1
          });
        }
        ctx.p++;
      }
      let p = peekTable(
        k,
        res,
        meta,
        isTableArray ? 2 : 1
        /* Type.EXPLICIT */
      );
      if (!p) {
        throw new TomlError("trying to redefine an already defined table or value", {
          toml,
          ptr: tmp
        });
      }
      m = p[2];
      tbl = p[1];
    } else {
      tmp = ctx.p;
      let k = parseKey(ctx);
      let p = peekTable(
        k,
        tbl,
        m,
        0
        /* Type.DOTTED */
      );
      if (!p) {
        throw new TomlError("trying to redefine an already defined table or value", {
          toml,
          ptr: tmp
        });
      }
      p[1][p[0]] = extractValue(ctx, void 0, integersAsBigInt);
    }
    skipVoid(ctx, true);
    if (ctx.p < toml.length && (tmp = toml.charCodeAt(ctx.p)) !== 10 && tmp !== 13) {
      throw new TomlError("each key-value declaration must be followed by an end-of-line", {
        toml,
        ptr: ctx.p
      });
    }
    skipVoid(ctx);
  }
  return res;
}

// node_modules/smol-toml/dist/stringify.js
var BARE_KEY = /^[a-z0-9-_]+$/i;
function extendedTypeOf(obj) {
  let type = typeof obj;
  if (type === "object") {
    if (Array.isArray(obj))
      return "array";
    if (typeof obj?.getUTCDate === "function" && obj instanceof Date)
      return "date";
    if (globalThis.Temporal && // check for the 'since' property as an early bailout that avoids running all 5 instanceof checks
    typeof obj?.since === "function" && (obj instanceof Temporal.Instant || obj instanceof Temporal.PlainDate || obj instanceof Temporal.PlainDateTime || obj instanceof Temporal.PlainTime || obj instanceof Temporal.ZonedDateTime)) {
      return "temporal";
    }
  }
  return type;
}
function isArrayOfTables(obj) {
  for (let i = 0; i < obj.length; i++) {
    if (extendedTypeOf(obj[i]) !== "object")
      return false;
  }
  return obj.length != 0;
}
function formatString(s) {
  return JSON.stringify(s).replace(/\x7f/g, "\\u007f");
}
function stringifyTemporal(temporal) {
  return temporal.toString({
    calendarName: "never",
    timeZoneName: "never"
  });
}
function stringifyValue(val, type, depth, numberAsFloat) {
  if (depth === 0) {
    throw new Error("Could not stringify the object: maximum object depth exceeded");
  }
  switch (type) {
    // @ts-expect-error -- intentional fallthrough case
    case "number":
      if (isNaN(val))
        return "nan";
      if (val === Infinity)
        return "inf";
      if (val === -Infinity)
        return "-inf";
      if (Number.isInteger(val) && (numberAsFloat || !Number.isSafeInteger(val)))
        return val.toFixed(1);
    case "bigint":
    case "boolean":
      return val.toString();
    case "string":
      return formatString(val);
    case "date":
      if (isNaN(val.getTime()))
        throw new TypeError("cannot serialize invalid date");
      return val.toISOString();
    case "object":
      return stringifyInlineTable(val, depth, numberAsFloat);
    case "array":
      return stringifyArray(val, depth, numberAsFloat);
    case "temporal":
      return stringifyTemporal(val);
  }
}
function stringifyInlineTable(obj, depth, numberAsFloat) {
  let keys = Object.keys(obj);
  if (keys.length === 0)
    return "{}";
  let res = "{ ";
  for (let i = 0; i < keys.length; i++) {
    let k = keys[i];
    if (i)
      res += ", ";
    res += BARE_KEY.test(k) ? k : formatString(k);
    res += " = ";
    res += stringifyValue(obj[k], extendedTypeOf(obj[k]), depth - 1, numberAsFloat);
  }
  return res + " }";
}
function stringifyArray(array, depth, numberAsFloat) {
  if (array.length === 0)
    return "[]";
  let res = "[ ";
  for (let i = 0; i < array.length; i++) {
    if (i)
      res += ", ";
    if (array[i] === null || array[i] === void 0) {
      throw new TypeError("arrays cannot contain null or undefined values");
    }
    res += stringifyValue(array[i], extendedTypeOf(array[i]), depth - 1, numberAsFloat);
  }
  return res + " ]";
}
function stringifyArrayTable(array, key, depth, numberAsFloat) {
  if (depth === 0) {
    throw new Error("Could not stringify the object: maximum object depth exceeded");
  }
  let res = "";
  for (let i = 0; i < array.length; i++) {
    res += `${res && "\n"}[[${key}]]
`;
    res += stringifyTable(0, array[i], key, depth, numberAsFloat);
  }
  return res;
}
function stringifyTable(tableKey, obj, prefix, depth, numberAsFloat) {
  if (depth === 0) {
    throw new Error("Could not stringify the object: maximum object depth exceeded");
  }
  let preamble = "";
  let tables = "";
  let keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++) {
    let k = keys[i];
    if (obj[k] !== null && obj[k] !== void 0) {
      let type = extendedTypeOf(obj[k]);
      if (type === "symbol" || type === "function") {
        throw new TypeError(`cannot serialize values of type '${type}'`);
      }
      let key = BARE_KEY.test(k) ? k : formatString(k);
      if (type === "array" && isArrayOfTables(obj[k])) {
        tables += (tables && "\n") + stringifyArrayTable(obj[k], prefix ? `${prefix}.${key}` : key, depth - 1, numberAsFloat);
      } else if (type === "object") {
        let tblKey = prefix ? `${prefix}.${key}` : key;
        tables += (tables && "\n") + stringifyTable(tblKey, obj[k], tblKey, depth - 1, numberAsFloat);
      } else {
        preamble += key;
        preamble += " = ";
        preamble += stringifyValue(obj[k], type, depth, numberAsFloat);
        preamble += "\n";
      }
    }
  }
  if (tableKey && (preamble || !tables))
    preamble = preamble ? `[${tableKey}]
${preamble}` : `[${tableKey}]`;
  return preamble && tables ? `${preamble}
${tables}` : preamble || tables;
}
function stringify(obj, { maxDepth = 1e3, numbersAsFloat = false } = {}) {
  if (extendedTypeOf(obj) !== "object") {
    throw new TypeError("stringify can only be called with an object");
  }
  let str = stringifyTable(0, obj, "", maxDepth, numbersAsFloat);
  if (str[str.length - 1] !== "\n")
    return str + "\n";
  return str;
}

// node_modules/@projector/runtime/dist/persistence/toml-codec.js
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
    value.forEach((item, index2) => assertJsonCompatible(item, `${path}[${index2}]`));
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
    value.forEach((item, index2) => assertNoReservedNullMarkers(item, `${path}[${index2}]`));
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
  for (let index2 = 0; index2 < value.length; index2 += 1) {
    const character = value[index2];
    const code = character.charCodeAt(0);
    let fragment;
    if (character === "\n")
      fragment = index2 === 0 || index2 === value.length - 1 ? "\\n" : "\n";
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
    if (character === " " && column >= readableProseColumn && index2 < value.length - 1 && value[index2 + 1] !== " ") {
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
    for (let index2 = 0; index2 < segments.length; index2 += 1) {
      const segment = segments[index2];
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
          cursor = join(cursor, ...segments.slice(index2));
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
      tomlEncodingSchema(external_exports.toJSONSchema(schema, {
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
    schema.items.forEach((child, index2) => assertTaploDraft4Schema(child, `${location}/items/${index2}`));
  }
  for (const keyword of ["allOf", "anyOf", "oneOf"]) {
    const children = schema[keyword];
    if (Array.isArray(children))
      children.forEach((child, index2) => assertTaploDraft4Schema(child, `${location}/${keyword}/${index2}`));
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

// node_modules/mdast-util-to-string/lib/index.js
var emptyOptions = {};
function toString(value, options) {
  const settings = options || emptyOptions;
  const includeImageAlt = typeof settings.includeImageAlt === "boolean" ? settings.includeImageAlt : true;
  const includeHtml = typeof settings.includeHtml === "boolean" ? settings.includeHtml : true;
  return one(value, includeImageAlt, includeHtml);
}
function one(value, includeImageAlt, includeHtml) {
  if (node(value)) {
    if ("value" in value) {
      return value.type === "html" && !includeHtml ? "" : value.value;
    }
    if (includeImageAlt && "alt" in value && value.alt) {
      return value.alt;
    }
    if ("children" in value) {
      return all(value.children, includeImageAlt, includeHtml);
    }
  }
  if (Array.isArray(value)) {
    return all(value, includeImageAlt, includeHtml);
  }
  return "";
}
function all(values, includeImageAlt, includeHtml) {
  const result = [];
  let index2 = -1;
  while (++index2 < values.length) {
    result[index2] = one(values[index2], includeImageAlt, includeHtml);
  }
  return result.join("");
}
function node(value) {
  return Boolean(value && typeof value === "object");
}

// node_modules/character-entities/index.js
var characterEntities = {
  AElig: "\xC6",
  AMP: "&",
  Aacute: "\xC1",
  Abreve: "\u0102",
  Acirc: "\xC2",
  Acy: "\u0410",
  Afr: "\u{1D504}",
  Agrave: "\xC0",
  Alpha: "\u0391",
  Amacr: "\u0100",
  And: "\u2A53",
  Aogon: "\u0104",
  Aopf: "\u{1D538}",
  ApplyFunction: "\u2061",
  Aring: "\xC5",
  Ascr: "\u{1D49C}",
  Assign: "\u2254",
  Atilde: "\xC3",
  Auml: "\xC4",
  Backslash: "\u2216",
  Barv: "\u2AE7",
  Barwed: "\u2306",
  Bcy: "\u0411",
  Because: "\u2235",
  Bernoullis: "\u212C",
  Beta: "\u0392",
  Bfr: "\u{1D505}",
  Bopf: "\u{1D539}",
  Breve: "\u02D8",
  Bscr: "\u212C",
  Bumpeq: "\u224E",
  CHcy: "\u0427",
  COPY: "\xA9",
  Cacute: "\u0106",
  Cap: "\u22D2",
  CapitalDifferentialD: "\u2145",
  Cayleys: "\u212D",
  Ccaron: "\u010C",
  Ccedil: "\xC7",
  Ccirc: "\u0108",
  Cconint: "\u2230",
  Cdot: "\u010A",
  Cedilla: "\xB8",
  CenterDot: "\xB7",
  Cfr: "\u212D",
  Chi: "\u03A7",
  CircleDot: "\u2299",
  CircleMinus: "\u2296",
  CirclePlus: "\u2295",
  CircleTimes: "\u2297",
  ClockwiseContourIntegral: "\u2232",
  CloseCurlyDoubleQuote: "\u201D",
  CloseCurlyQuote: "\u2019",
  Colon: "\u2237",
  Colone: "\u2A74",
  Congruent: "\u2261",
  Conint: "\u222F",
  ContourIntegral: "\u222E",
  Copf: "\u2102",
  Coproduct: "\u2210",
  CounterClockwiseContourIntegral: "\u2233",
  Cross: "\u2A2F",
  Cscr: "\u{1D49E}",
  Cup: "\u22D3",
  CupCap: "\u224D",
  DD: "\u2145",
  DDotrahd: "\u2911",
  DJcy: "\u0402",
  DScy: "\u0405",
  DZcy: "\u040F",
  Dagger: "\u2021",
  Darr: "\u21A1",
  Dashv: "\u2AE4",
  Dcaron: "\u010E",
  Dcy: "\u0414",
  Del: "\u2207",
  Delta: "\u0394",
  Dfr: "\u{1D507}",
  DiacriticalAcute: "\xB4",
  DiacriticalDot: "\u02D9",
  DiacriticalDoubleAcute: "\u02DD",
  DiacriticalGrave: "`",
  DiacriticalTilde: "\u02DC",
  Diamond: "\u22C4",
  DifferentialD: "\u2146",
  Dopf: "\u{1D53B}",
  Dot: "\xA8",
  DotDot: "\u20DC",
  DotEqual: "\u2250",
  DoubleContourIntegral: "\u222F",
  DoubleDot: "\xA8",
  DoubleDownArrow: "\u21D3",
  DoubleLeftArrow: "\u21D0",
  DoubleLeftRightArrow: "\u21D4",
  DoubleLeftTee: "\u2AE4",
  DoubleLongLeftArrow: "\u27F8",
  DoubleLongLeftRightArrow: "\u27FA",
  DoubleLongRightArrow: "\u27F9",
  DoubleRightArrow: "\u21D2",
  DoubleRightTee: "\u22A8",
  DoubleUpArrow: "\u21D1",
  DoubleUpDownArrow: "\u21D5",
  DoubleVerticalBar: "\u2225",
  DownArrow: "\u2193",
  DownArrowBar: "\u2913",
  DownArrowUpArrow: "\u21F5",
  DownBreve: "\u0311",
  DownLeftRightVector: "\u2950",
  DownLeftTeeVector: "\u295E",
  DownLeftVector: "\u21BD",
  DownLeftVectorBar: "\u2956",
  DownRightTeeVector: "\u295F",
  DownRightVector: "\u21C1",
  DownRightVectorBar: "\u2957",
  DownTee: "\u22A4",
  DownTeeArrow: "\u21A7",
  Downarrow: "\u21D3",
  Dscr: "\u{1D49F}",
  Dstrok: "\u0110",
  ENG: "\u014A",
  ETH: "\xD0",
  Eacute: "\xC9",
  Ecaron: "\u011A",
  Ecirc: "\xCA",
  Ecy: "\u042D",
  Edot: "\u0116",
  Efr: "\u{1D508}",
  Egrave: "\xC8",
  Element: "\u2208",
  Emacr: "\u0112",
  EmptySmallSquare: "\u25FB",
  EmptyVerySmallSquare: "\u25AB",
  Eogon: "\u0118",
  Eopf: "\u{1D53C}",
  Epsilon: "\u0395",
  Equal: "\u2A75",
  EqualTilde: "\u2242",
  Equilibrium: "\u21CC",
  Escr: "\u2130",
  Esim: "\u2A73",
  Eta: "\u0397",
  Euml: "\xCB",
  Exists: "\u2203",
  ExponentialE: "\u2147",
  Fcy: "\u0424",
  Ffr: "\u{1D509}",
  FilledSmallSquare: "\u25FC",
  FilledVerySmallSquare: "\u25AA",
  Fopf: "\u{1D53D}",
  ForAll: "\u2200",
  Fouriertrf: "\u2131",
  Fscr: "\u2131",
  GJcy: "\u0403",
  GT: ">",
  Gamma: "\u0393",
  Gammad: "\u03DC",
  Gbreve: "\u011E",
  Gcedil: "\u0122",
  Gcirc: "\u011C",
  Gcy: "\u0413",
  Gdot: "\u0120",
  Gfr: "\u{1D50A}",
  Gg: "\u22D9",
  Gopf: "\u{1D53E}",
  GreaterEqual: "\u2265",
  GreaterEqualLess: "\u22DB",
  GreaterFullEqual: "\u2267",
  GreaterGreater: "\u2AA2",
  GreaterLess: "\u2277",
  GreaterSlantEqual: "\u2A7E",
  GreaterTilde: "\u2273",
  Gscr: "\u{1D4A2}",
  Gt: "\u226B",
  HARDcy: "\u042A",
  Hacek: "\u02C7",
  Hat: "^",
  Hcirc: "\u0124",
  Hfr: "\u210C",
  HilbertSpace: "\u210B",
  Hopf: "\u210D",
  HorizontalLine: "\u2500",
  Hscr: "\u210B",
  Hstrok: "\u0126",
  HumpDownHump: "\u224E",
  HumpEqual: "\u224F",
  IEcy: "\u0415",
  IJlig: "\u0132",
  IOcy: "\u0401",
  Iacute: "\xCD",
  Icirc: "\xCE",
  Icy: "\u0418",
  Idot: "\u0130",
  Ifr: "\u2111",
  Igrave: "\xCC",
  Im: "\u2111",
  Imacr: "\u012A",
  ImaginaryI: "\u2148",
  Implies: "\u21D2",
  Int: "\u222C",
  Integral: "\u222B",
  Intersection: "\u22C2",
  InvisibleComma: "\u2063",
  InvisibleTimes: "\u2062",
  Iogon: "\u012E",
  Iopf: "\u{1D540}",
  Iota: "\u0399",
  Iscr: "\u2110",
  Itilde: "\u0128",
  Iukcy: "\u0406",
  Iuml: "\xCF",
  Jcirc: "\u0134",
  Jcy: "\u0419",
  Jfr: "\u{1D50D}",
  Jopf: "\u{1D541}",
  Jscr: "\u{1D4A5}",
  Jsercy: "\u0408",
  Jukcy: "\u0404",
  KHcy: "\u0425",
  KJcy: "\u040C",
  Kappa: "\u039A",
  Kcedil: "\u0136",
  Kcy: "\u041A",
  Kfr: "\u{1D50E}",
  Kopf: "\u{1D542}",
  Kscr: "\u{1D4A6}",
  LJcy: "\u0409",
  LT: "<",
  Lacute: "\u0139",
  Lambda: "\u039B",
  Lang: "\u27EA",
  Laplacetrf: "\u2112",
  Larr: "\u219E",
  Lcaron: "\u013D",
  Lcedil: "\u013B",
  Lcy: "\u041B",
  LeftAngleBracket: "\u27E8",
  LeftArrow: "\u2190",
  LeftArrowBar: "\u21E4",
  LeftArrowRightArrow: "\u21C6",
  LeftCeiling: "\u2308",
  LeftDoubleBracket: "\u27E6",
  LeftDownTeeVector: "\u2961",
  LeftDownVector: "\u21C3",
  LeftDownVectorBar: "\u2959",
  LeftFloor: "\u230A",
  LeftRightArrow: "\u2194",
  LeftRightVector: "\u294E",
  LeftTee: "\u22A3",
  LeftTeeArrow: "\u21A4",
  LeftTeeVector: "\u295A",
  LeftTriangle: "\u22B2",
  LeftTriangleBar: "\u29CF",
  LeftTriangleEqual: "\u22B4",
  LeftUpDownVector: "\u2951",
  LeftUpTeeVector: "\u2960",
  LeftUpVector: "\u21BF",
  LeftUpVectorBar: "\u2958",
  LeftVector: "\u21BC",
  LeftVectorBar: "\u2952",
  Leftarrow: "\u21D0",
  Leftrightarrow: "\u21D4",
  LessEqualGreater: "\u22DA",
  LessFullEqual: "\u2266",
  LessGreater: "\u2276",
  LessLess: "\u2AA1",
  LessSlantEqual: "\u2A7D",
  LessTilde: "\u2272",
  Lfr: "\u{1D50F}",
  Ll: "\u22D8",
  Lleftarrow: "\u21DA",
  Lmidot: "\u013F",
  LongLeftArrow: "\u27F5",
  LongLeftRightArrow: "\u27F7",
  LongRightArrow: "\u27F6",
  Longleftarrow: "\u27F8",
  Longleftrightarrow: "\u27FA",
  Longrightarrow: "\u27F9",
  Lopf: "\u{1D543}",
  LowerLeftArrow: "\u2199",
  LowerRightArrow: "\u2198",
  Lscr: "\u2112",
  Lsh: "\u21B0",
  Lstrok: "\u0141",
  Lt: "\u226A",
  Map: "\u2905",
  Mcy: "\u041C",
  MediumSpace: "\u205F",
  Mellintrf: "\u2133",
  Mfr: "\u{1D510}",
  MinusPlus: "\u2213",
  Mopf: "\u{1D544}",
  Mscr: "\u2133",
  Mu: "\u039C",
  NJcy: "\u040A",
  Nacute: "\u0143",
  Ncaron: "\u0147",
  Ncedil: "\u0145",
  Ncy: "\u041D",
  NegativeMediumSpace: "\u200B",
  NegativeThickSpace: "\u200B",
  NegativeThinSpace: "\u200B",
  NegativeVeryThinSpace: "\u200B",
  NestedGreaterGreater: "\u226B",
  NestedLessLess: "\u226A",
  NewLine: "\n",
  Nfr: "\u{1D511}",
  NoBreak: "\u2060",
  NonBreakingSpace: "\xA0",
  Nopf: "\u2115",
  Not: "\u2AEC",
  NotCongruent: "\u2262",
  NotCupCap: "\u226D",
  NotDoubleVerticalBar: "\u2226",
  NotElement: "\u2209",
  NotEqual: "\u2260",
  NotEqualTilde: "\u2242\u0338",
  NotExists: "\u2204",
  NotGreater: "\u226F",
  NotGreaterEqual: "\u2271",
  NotGreaterFullEqual: "\u2267\u0338",
  NotGreaterGreater: "\u226B\u0338",
  NotGreaterLess: "\u2279",
  NotGreaterSlantEqual: "\u2A7E\u0338",
  NotGreaterTilde: "\u2275",
  NotHumpDownHump: "\u224E\u0338",
  NotHumpEqual: "\u224F\u0338",
  NotLeftTriangle: "\u22EA",
  NotLeftTriangleBar: "\u29CF\u0338",
  NotLeftTriangleEqual: "\u22EC",
  NotLess: "\u226E",
  NotLessEqual: "\u2270",
  NotLessGreater: "\u2278",
  NotLessLess: "\u226A\u0338",
  NotLessSlantEqual: "\u2A7D\u0338",
  NotLessTilde: "\u2274",
  NotNestedGreaterGreater: "\u2AA2\u0338",
  NotNestedLessLess: "\u2AA1\u0338",
  NotPrecedes: "\u2280",
  NotPrecedesEqual: "\u2AAF\u0338",
  NotPrecedesSlantEqual: "\u22E0",
  NotReverseElement: "\u220C",
  NotRightTriangle: "\u22EB",
  NotRightTriangleBar: "\u29D0\u0338",
  NotRightTriangleEqual: "\u22ED",
  NotSquareSubset: "\u228F\u0338",
  NotSquareSubsetEqual: "\u22E2",
  NotSquareSuperset: "\u2290\u0338",
  NotSquareSupersetEqual: "\u22E3",
  NotSubset: "\u2282\u20D2",
  NotSubsetEqual: "\u2288",
  NotSucceeds: "\u2281",
  NotSucceedsEqual: "\u2AB0\u0338",
  NotSucceedsSlantEqual: "\u22E1",
  NotSucceedsTilde: "\u227F\u0338",
  NotSuperset: "\u2283\u20D2",
  NotSupersetEqual: "\u2289",
  NotTilde: "\u2241",
  NotTildeEqual: "\u2244",
  NotTildeFullEqual: "\u2247",
  NotTildeTilde: "\u2249",
  NotVerticalBar: "\u2224",
  Nscr: "\u{1D4A9}",
  Ntilde: "\xD1",
  Nu: "\u039D",
  OElig: "\u0152",
  Oacute: "\xD3",
  Ocirc: "\xD4",
  Ocy: "\u041E",
  Odblac: "\u0150",
  Ofr: "\u{1D512}",
  Ograve: "\xD2",
  Omacr: "\u014C",
  Omega: "\u03A9",
  Omicron: "\u039F",
  Oopf: "\u{1D546}",
  OpenCurlyDoubleQuote: "\u201C",
  OpenCurlyQuote: "\u2018",
  Or: "\u2A54",
  Oscr: "\u{1D4AA}",
  Oslash: "\xD8",
  Otilde: "\xD5",
  Otimes: "\u2A37",
  Ouml: "\xD6",
  OverBar: "\u203E",
  OverBrace: "\u23DE",
  OverBracket: "\u23B4",
  OverParenthesis: "\u23DC",
  PartialD: "\u2202",
  Pcy: "\u041F",
  Pfr: "\u{1D513}",
  Phi: "\u03A6",
  Pi: "\u03A0",
  PlusMinus: "\xB1",
  Poincareplane: "\u210C",
  Popf: "\u2119",
  Pr: "\u2ABB",
  Precedes: "\u227A",
  PrecedesEqual: "\u2AAF",
  PrecedesSlantEqual: "\u227C",
  PrecedesTilde: "\u227E",
  Prime: "\u2033",
  Product: "\u220F",
  Proportion: "\u2237",
  Proportional: "\u221D",
  Pscr: "\u{1D4AB}",
  Psi: "\u03A8",
  QUOT: '"',
  Qfr: "\u{1D514}",
  Qopf: "\u211A",
  Qscr: "\u{1D4AC}",
  RBarr: "\u2910",
  REG: "\xAE",
  Racute: "\u0154",
  Rang: "\u27EB",
  Rarr: "\u21A0",
  Rarrtl: "\u2916",
  Rcaron: "\u0158",
  Rcedil: "\u0156",
  Rcy: "\u0420",
  Re: "\u211C",
  ReverseElement: "\u220B",
  ReverseEquilibrium: "\u21CB",
  ReverseUpEquilibrium: "\u296F",
  Rfr: "\u211C",
  Rho: "\u03A1",
  RightAngleBracket: "\u27E9",
  RightArrow: "\u2192",
  RightArrowBar: "\u21E5",
  RightArrowLeftArrow: "\u21C4",
  RightCeiling: "\u2309",
  RightDoubleBracket: "\u27E7",
  RightDownTeeVector: "\u295D",
  RightDownVector: "\u21C2",
  RightDownVectorBar: "\u2955",
  RightFloor: "\u230B",
  RightTee: "\u22A2",
  RightTeeArrow: "\u21A6",
  RightTeeVector: "\u295B",
  RightTriangle: "\u22B3",
  RightTriangleBar: "\u29D0",
  RightTriangleEqual: "\u22B5",
  RightUpDownVector: "\u294F",
  RightUpTeeVector: "\u295C",
  RightUpVector: "\u21BE",
  RightUpVectorBar: "\u2954",
  RightVector: "\u21C0",
  RightVectorBar: "\u2953",
  Rightarrow: "\u21D2",
  Ropf: "\u211D",
  RoundImplies: "\u2970",
  Rrightarrow: "\u21DB",
  Rscr: "\u211B",
  Rsh: "\u21B1",
  RuleDelayed: "\u29F4",
  SHCHcy: "\u0429",
  SHcy: "\u0428",
  SOFTcy: "\u042C",
  Sacute: "\u015A",
  Sc: "\u2ABC",
  Scaron: "\u0160",
  Scedil: "\u015E",
  Scirc: "\u015C",
  Scy: "\u0421",
  Sfr: "\u{1D516}",
  ShortDownArrow: "\u2193",
  ShortLeftArrow: "\u2190",
  ShortRightArrow: "\u2192",
  ShortUpArrow: "\u2191",
  Sigma: "\u03A3",
  SmallCircle: "\u2218",
  Sopf: "\u{1D54A}",
  Sqrt: "\u221A",
  Square: "\u25A1",
  SquareIntersection: "\u2293",
  SquareSubset: "\u228F",
  SquareSubsetEqual: "\u2291",
  SquareSuperset: "\u2290",
  SquareSupersetEqual: "\u2292",
  SquareUnion: "\u2294",
  Sscr: "\u{1D4AE}",
  Star: "\u22C6",
  Sub: "\u22D0",
  Subset: "\u22D0",
  SubsetEqual: "\u2286",
  Succeeds: "\u227B",
  SucceedsEqual: "\u2AB0",
  SucceedsSlantEqual: "\u227D",
  SucceedsTilde: "\u227F",
  SuchThat: "\u220B",
  Sum: "\u2211",
  Sup: "\u22D1",
  Superset: "\u2283",
  SupersetEqual: "\u2287",
  Supset: "\u22D1",
  THORN: "\xDE",
  TRADE: "\u2122",
  TSHcy: "\u040B",
  TScy: "\u0426",
  Tab: "	",
  Tau: "\u03A4",
  Tcaron: "\u0164",
  Tcedil: "\u0162",
  Tcy: "\u0422",
  Tfr: "\u{1D517}",
  Therefore: "\u2234",
  Theta: "\u0398",
  ThickSpace: "\u205F\u200A",
  ThinSpace: "\u2009",
  Tilde: "\u223C",
  TildeEqual: "\u2243",
  TildeFullEqual: "\u2245",
  TildeTilde: "\u2248",
  Topf: "\u{1D54B}",
  TripleDot: "\u20DB",
  Tscr: "\u{1D4AF}",
  Tstrok: "\u0166",
  Uacute: "\xDA",
  Uarr: "\u219F",
  Uarrocir: "\u2949",
  Ubrcy: "\u040E",
  Ubreve: "\u016C",
  Ucirc: "\xDB",
  Ucy: "\u0423",
  Udblac: "\u0170",
  Ufr: "\u{1D518}",
  Ugrave: "\xD9",
  Umacr: "\u016A",
  UnderBar: "_",
  UnderBrace: "\u23DF",
  UnderBracket: "\u23B5",
  UnderParenthesis: "\u23DD",
  Union: "\u22C3",
  UnionPlus: "\u228E",
  Uogon: "\u0172",
  Uopf: "\u{1D54C}",
  UpArrow: "\u2191",
  UpArrowBar: "\u2912",
  UpArrowDownArrow: "\u21C5",
  UpDownArrow: "\u2195",
  UpEquilibrium: "\u296E",
  UpTee: "\u22A5",
  UpTeeArrow: "\u21A5",
  Uparrow: "\u21D1",
  Updownarrow: "\u21D5",
  UpperLeftArrow: "\u2196",
  UpperRightArrow: "\u2197",
  Upsi: "\u03D2",
  Upsilon: "\u03A5",
  Uring: "\u016E",
  Uscr: "\u{1D4B0}",
  Utilde: "\u0168",
  Uuml: "\xDC",
  VDash: "\u22AB",
  Vbar: "\u2AEB",
  Vcy: "\u0412",
  Vdash: "\u22A9",
  Vdashl: "\u2AE6",
  Vee: "\u22C1",
  Verbar: "\u2016",
  Vert: "\u2016",
  VerticalBar: "\u2223",
  VerticalLine: "|",
  VerticalSeparator: "\u2758",
  VerticalTilde: "\u2240",
  VeryThinSpace: "\u200A",
  Vfr: "\u{1D519}",
  Vopf: "\u{1D54D}",
  Vscr: "\u{1D4B1}",
  Vvdash: "\u22AA",
  Wcirc: "\u0174",
  Wedge: "\u22C0",
  Wfr: "\u{1D51A}",
  Wopf: "\u{1D54E}",
  Wscr: "\u{1D4B2}",
  Xfr: "\u{1D51B}",
  Xi: "\u039E",
  Xopf: "\u{1D54F}",
  Xscr: "\u{1D4B3}",
  YAcy: "\u042F",
  YIcy: "\u0407",
  YUcy: "\u042E",
  Yacute: "\xDD",
  Ycirc: "\u0176",
  Ycy: "\u042B",
  Yfr: "\u{1D51C}",
  Yopf: "\u{1D550}",
  Yscr: "\u{1D4B4}",
  Yuml: "\u0178",
  ZHcy: "\u0416",
  Zacute: "\u0179",
  Zcaron: "\u017D",
  Zcy: "\u0417",
  Zdot: "\u017B",
  ZeroWidthSpace: "\u200B",
  Zeta: "\u0396",
  Zfr: "\u2128",
  Zopf: "\u2124",
  Zscr: "\u{1D4B5}",
  aacute: "\xE1",
  abreve: "\u0103",
  ac: "\u223E",
  acE: "\u223E\u0333",
  acd: "\u223F",
  acirc: "\xE2",
  acute: "\xB4",
  acy: "\u0430",
  aelig: "\xE6",
  af: "\u2061",
  afr: "\u{1D51E}",
  agrave: "\xE0",
  alefsym: "\u2135",
  aleph: "\u2135",
  alpha: "\u03B1",
  amacr: "\u0101",
  amalg: "\u2A3F",
  amp: "&",
  and: "\u2227",
  andand: "\u2A55",
  andd: "\u2A5C",
  andslope: "\u2A58",
  andv: "\u2A5A",
  ang: "\u2220",
  ange: "\u29A4",
  angle: "\u2220",
  angmsd: "\u2221",
  angmsdaa: "\u29A8",
  angmsdab: "\u29A9",
  angmsdac: "\u29AA",
  angmsdad: "\u29AB",
  angmsdae: "\u29AC",
  angmsdaf: "\u29AD",
  angmsdag: "\u29AE",
  angmsdah: "\u29AF",
  angrt: "\u221F",
  angrtvb: "\u22BE",
  angrtvbd: "\u299D",
  angsph: "\u2222",
  angst: "\xC5",
  angzarr: "\u237C",
  aogon: "\u0105",
  aopf: "\u{1D552}",
  ap: "\u2248",
  apE: "\u2A70",
  apacir: "\u2A6F",
  ape: "\u224A",
  apid: "\u224B",
  apos: "'",
  approx: "\u2248",
  approxeq: "\u224A",
  aring: "\xE5",
  ascr: "\u{1D4B6}",
  ast: "*",
  asymp: "\u2248",
  asympeq: "\u224D",
  atilde: "\xE3",
  auml: "\xE4",
  awconint: "\u2233",
  awint: "\u2A11",
  bNot: "\u2AED",
  backcong: "\u224C",
  backepsilon: "\u03F6",
  backprime: "\u2035",
  backsim: "\u223D",
  backsimeq: "\u22CD",
  barvee: "\u22BD",
  barwed: "\u2305",
  barwedge: "\u2305",
  bbrk: "\u23B5",
  bbrktbrk: "\u23B6",
  bcong: "\u224C",
  bcy: "\u0431",
  bdquo: "\u201E",
  becaus: "\u2235",
  because: "\u2235",
  bemptyv: "\u29B0",
  bepsi: "\u03F6",
  bernou: "\u212C",
  beta: "\u03B2",
  beth: "\u2136",
  between: "\u226C",
  bfr: "\u{1D51F}",
  bigcap: "\u22C2",
  bigcirc: "\u25EF",
  bigcup: "\u22C3",
  bigodot: "\u2A00",
  bigoplus: "\u2A01",
  bigotimes: "\u2A02",
  bigsqcup: "\u2A06",
  bigstar: "\u2605",
  bigtriangledown: "\u25BD",
  bigtriangleup: "\u25B3",
  biguplus: "\u2A04",
  bigvee: "\u22C1",
  bigwedge: "\u22C0",
  bkarow: "\u290D",
  blacklozenge: "\u29EB",
  blacksquare: "\u25AA",
  blacktriangle: "\u25B4",
  blacktriangledown: "\u25BE",
  blacktriangleleft: "\u25C2",
  blacktriangleright: "\u25B8",
  blank: "\u2423",
  blk12: "\u2592",
  blk14: "\u2591",
  blk34: "\u2593",
  block: "\u2588",
  bne: "=\u20E5",
  bnequiv: "\u2261\u20E5",
  bnot: "\u2310",
  bopf: "\u{1D553}",
  bot: "\u22A5",
  bottom: "\u22A5",
  bowtie: "\u22C8",
  boxDL: "\u2557",
  boxDR: "\u2554",
  boxDl: "\u2556",
  boxDr: "\u2553",
  boxH: "\u2550",
  boxHD: "\u2566",
  boxHU: "\u2569",
  boxHd: "\u2564",
  boxHu: "\u2567",
  boxUL: "\u255D",
  boxUR: "\u255A",
  boxUl: "\u255C",
  boxUr: "\u2559",
  boxV: "\u2551",
  boxVH: "\u256C",
  boxVL: "\u2563",
  boxVR: "\u2560",
  boxVh: "\u256B",
  boxVl: "\u2562",
  boxVr: "\u255F",
  boxbox: "\u29C9",
  boxdL: "\u2555",
  boxdR: "\u2552",
  boxdl: "\u2510",
  boxdr: "\u250C",
  boxh: "\u2500",
  boxhD: "\u2565",
  boxhU: "\u2568",
  boxhd: "\u252C",
  boxhu: "\u2534",
  boxminus: "\u229F",
  boxplus: "\u229E",
  boxtimes: "\u22A0",
  boxuL: "\u255B",
  boxuR: "\u2558",
  boxul: "\u2518",
  boxur: "\u2514",
  boxv: "\u2502",
  boxvH: "\u256A",
  boxvL: "\u2561",
  boxvR: "\u255E",
  boxvh: "\u253C",
  boxvl: "\u2524",
  boxvr: "\u251C",
  bprime: "\u2035",
  breve: "\u02D8",
  brvbar: "\xA6",
  bscr: "\u{1D4B7}",
  bsemi: "\u204F",
  bsim: "\u223D",
  bsime: "\u22CD",
  bsol: "\\",
  bsolb: "\u29C5",
  bsolhsub: "\u27C8",
  bull: "\u2022",
  bullet: "\u2022",
  bump: "\u224E",
  bumpE: "\u2AAE",
  bumpe: "\u224F",
  bumpeq: "\u224F",
  cacute: "\u0107",
  cap: "\u2229",
  capand: "\u2A44",
  capbrcup: "\u2A49",
  capcap: "\u2A4B",
  capcup: "\u2A47",
  capdot: "\u2A40",
  caps: "\u2229\uFE00",
  caret: "\u2041",
  caron: "\u02C7",
  ccaps: "\u2A4D",
  ccaron: "\u010D",
  ccedil: "\xE7",
  ccirc: "\u0109",
  ccups: "\u2A4C",
  ccupssm: "\u2A50",
  cdot: "\u010B",
  cedil: "\xB8",
  cemptyv: "\u29B2",
  cent: "\xA2",
  centerdot: "\xB7",
  cfr: "\u{1D520}",
  chcy: "\u0447",
  check: "\u2713",
  checkmark: "\u2713",
  chi: "\u03C7",
  cir: "\u25CB",
  cirE: "\u29C3",
  circ: "\u02C6",
  circeq: "\u2257",
  circlearrowleft: "\u21BA",
  circlearrowright: "\u21BB",
  circledR: "\xAE",
  circledS: "\u24C8",
  circledast: "\u229B",
  circledcirc: "\u229A",
  circleddash: "\u229D",
  cire: "\u2257",
  cirfnint: "\u2A10",
  cirmid: "\u2AEF",
  cirscir: "\u29C2",
  clubs: "\u2663",
  clubsuit: "\u2663",
  colon: ":",
  colone: "\u2254",
  coloneq: "\u2254",
  comma: ",",
  commat: "@",
  comp: "\u2201",
  compfn: "\u2218",
  complement: "\u2201",
  complexes: "\u2102",
  cong: "\u2245",
  congdot: "\u2A6D",
  conint: "\u222E",
  copf: "\u{1D554}",
  coprod: "\u2210",
  copy: "\xA9",
  copysr: "\u2117",
  crarr: "\u21B5",
  cross: "\u2717",
  cscr: "\u{1D4B8}",
  csub: "\u2ACF",
  csube: "\u2AD1",
  csup: "\u2AD0",
  csupe: "\u2AD2",
  ctdot: "\u22EF",
  cudarrl: "\u2938",
  cudarrr: "\u2935",
  cuepr: "\u22DE",
  cuesc: "\u22DF",
  cularr: "\u21B6",
  cularrp: "\u293D",
  cup: "\u222A",
  cupbrcap: "\u2A48",
  cupcap: "\u2A46",
  cupcup: "\u2A4A",
  cupdot: "\u228D",
  cupor: "\u2A45",
  cups: "\u222A\uFE00",
  curarr: "\u21B7",
  curarrm: "\u293C",
  curlyeqprec: "\u22DE",
  curlyeqsucc: "\u22DF",
  curlyvee: "\u22CE",
  curlywedge: "\u22CF",
  curren: "\xA4",
  curvearrowleft: "\u21B6",
  curvearrowright: "\u21B7",
  cuvee: "\u22CE",
  cuwed: "\u22CF",
  cwconint: "\u2232",
  cwint: "\u2231",
  cylcty: "\u232D",
  dArr: "\u21D3",
  dHar: "\u2965",
  dagger: "\u2020",
  daleth: "\u2138",
  darr: "\u2193",
  dash: "\u2010",
  dashv: "\u22A3",
  dbkarow: "\u290F",
  dblac: "\u02DD",
  dcaron: "\u010F",
  dcy: "\u0434",
  dd: "\u2146",
  ddagger: "\u2021",
  ddarr: "\u21CA",
  ddotseq: "\u2A77",
  deg: "\xB0",
  delta: "\u03B4",
  demptyv: "\u29B1",
  dfisht: "\u297F",
  dfr: "\u{1D521}",
  dharl: "\u21C3",
  dharr: "\u21C2",
  diam: "\u22C4",
  diamond: "\u22C4",
  diamondsuit: "\u2666",
  diams: "\u2666",
  die: "\xA8",
  digamma: "\u03DD",
  disin: "\u22F2",
  div: "\xF7",
  divide: "\xF7",
  divideontimes: "\u22C7",
  divonx: "\u22C7",
  djcy: "\u0452",
  dlcorn: "\u231E",
  dlcrop: "\u230D",
  dollar: "$",
  dopf: "\u{1D555}",
  dot: "\u02D9",
  doteq: "\u2250",
  doteqdot: "\u2251",
  dotminus: "\u2238",
  dotplus: "\u2214",
  dotsquare: "\u22A1",
  doublebarwedge: "\u2306",
  downarrow: "\u2193",
  downdownarrows: "\u21CA",
  downharpoonleft: "\u21C3",
  downharpoonright: "\u21C2",
  drbkarow: "\u2910",
  drcorn: "\u231F",
  drcrop: "\u230C",
  dscr: "\u{1D4B9}",
  dscy: "\u0455",
  dsol: "\u29F6",
  dstrok: "\u0111",
  dtdot: "\u22F1",
  dtri: "\u25BF",
  dtrif: "\u25BE",
  duarr: "\u21F5",
  duhar: "\u296F",
  dwangle: "\u29A6",
  dzcy: "\u045F",
  dzigrarr: "\u27FF",
  eDDot: "\u2A77",
  eDot: "\u2251",
  eacute: "\xE9",
  easter: "\u2A6E",
  ecaron: "\u011B",
  ecir: "\u2256",
  ecirc: "\xEA",
  ecolon: "\u2255",
  ecy: "\u044D",
  edot: "\u0117",
  ee: "\u2147",
  efDot: "\u2252",
  efr: "\u{1D522}",
  eg: "\u2A9A",
  egrave: "\xE8",
  egs: "\u2A96",
  egsdot: "\u2A98",
  el: "\u2A99",
  elinters: "\u23E7",
  ell: "\u2113",
  els: "\u2A95",
  elsdot: "\u2A97",
  emacr: "\u0113",
  empty: "\u2205",
  emptyset: "\u2205",
  emptyv: "\u2205",
  emsp13: "\u2004",
  emsp14: "\u2005",
  emsp: "\u2003",
  eng: "\u014B",
  ensp: "\u2002",
  eogon: "\u0119",
  eopf: "\u{1D556}",
  epar: "\u22D5",
  eparsl: "\u29E3",
  eplus: "\u2A71",
  epsi: "\u03B5",
  epsilon: "\u03B5",
  epsiv: "\u03F5",
  eqcirc: "\u2256",
  eqcolon: "\u2255",
  eqsim: "\u2242",
  eqslantgtr: "\u2A96",
  eqslantless: "\u2A95",
  equals: "=",
  equest: "\u225F",
  equiv: "\u2261",
  equivDD: "\u2A78",
  eqvparsl: "\u29E5",
  erDot: "\u2253",
  erarr: "\u2971",
  escr: "\u212F",
  esdot: "\u2250",
  esim: "\u2242",
  eta: "\u03B7",
  eth: "\xF0",
  euml: "\xEB",
  euro: "\u20AC",
  excl: "!",
  exist: "\u2203",
  expectation: "\u2130",
  exponentiale: "\u2147",
  fallingdotseq: "\u2252",
  fcy: "\u0444",
  female: "\u2640",
  ffilig: "\uFB03",
  fflig: "\uFB00",
  ffllig: "\uFB04",
  ffr: "\u{1D523}",
  filig: "\uFB01",
  fjlig: "fj",
  flat: "\u266D",
  fllig: "\uFB02",
  fltns: "\u25B1",
  fnof: "\u0192",
  fopf: "\u{1D557}",
  forall: "\u2200",
  fork: "\u22D4",
  forkv: "\u2AD9",
  fpartint: "\u2A0D",
  frac12: "\xBD",
  frac13: "\u2153",
  frac14: "\xBC",
  frac15: "\u2155",
  frac16: "\u2159",
  frac18: "\u215B",
  frac23: "\u2154",
  frac25: "\u2156",
  frac34: "\xBE",
  frac35: "\u2157",
  frac38: "\u215C",
  frac45: "\u2158",
  frac56: "\u215A",
  frac58: "\u215D",
  frac78: "\u215E",
  frasl: "\u2044",
  frown: "\u2322",
  fscr: "\u{1D4BB}",
  gE: "\u2267",
  gEl: "\u2A8C",
  gacute: "\u01F5",
  gamma: "\u03B3",
  gammad: "\u03DD",
  gap: "\u2A86",
  gbreve: "\u011F",
  gcirc: "\u011D",
  gcy: "\u0433",
  gdot: "\u0121",
  ge: "\u2265",
  gel: "\u22DB",
  geq: "\u2265",
  geqq: "\u2267",
  geqslant: "\u2A7E",
  ges: "\u2A7E",
  gescc: "\u2AA9",
  gesdot: "\u2A80",
  gesdoto: "\u2A82",
  gesdotol: "\u2A84",
  gesl: "\u22DB\uFE00",
  gesles: "\u2A94",
  gfr: "\u{1D524}",
  gg: "\u226B",
  ggg: "\u22D9",
  gimel: "\u2137",
  gjcy: "\u0453",
  gl: "\u2277",
  glE: "\u2A92",
  gla: "\u2AA5",
  glj: "\u2AA4",
  gnE: "\u2269",
  gnap: "\u2A8A",
  gnapprox: "\u2A8A",
  gne: "\u2A88",
  gneq: "\u2A88",
  gneqq: "\u2269",
  gnsim: "\u22E7",
  gopf: "\u{1D558}",
  grave: "`",
  gscr: "\u210A",
  gsim: "\u2273",
  gsime: "\u2A8E",
  gsiml: "\u2A90",
  gt: ">",
  gtcc: "\u2AA7",
  gtcir: "\u2A7A",
  gtdot: "\u22D7",
  gtlPar: "\u2995",
  gtquest: "\u2A7C",
  gtrapprox: "\u2A86",
  gtrarr: "\u2978",
  gtrdot: "\u22D7",
  gtreqless: "\u22DB",
  gtreqqless: "\u2A8C",
  gtrless: "\u2277",
  gtrsim: "\u2273",
  gvertneqq: "\u2269\uFE00",
  gvnE: "\u2269\uFE00",
  hArr: "\u21D4",
  hairsp: "\u200A",
  half: "\xBD",
  hamilt: "\u210B",
  hardcy: "\u044A",
  harr: "\u2194",
  harrcir: "\u2948",
  harrw: "\u21AD",
  hbar: "\u210F",
  hcirc: "\u0125",
  hearts: "\u2665",
  heartsuit: "\u2665",
  hellip: "\u2026",
  hercon: "\u22B9",
  hfr: "\u{1D525}",
  hksearow: "\u2925",
  hkswarow: "\u2926",
  hoarr: "\u21FF",
  homtht: "\u223B",
  hookleftarrow: "\u21A9",
  hookrightarrow: "\u21AA",
  hopf: "\u{1D559}",
  horbar: "\u2015",
  hscr: "\u{1D4BD}",
  hslash: "\u210F",
  hstrok: "\u0127",
  hybull: "\u2043",
  hyphen: "\u2010",
  iacute: "\xED",
  ic: "\u2063",
  icirc: "\xEE",
  icy: "\u0438",
  iecy: "\u0435",
  iexcl: "\xA1",
  iff: "\u21D4",
  ifr: "\u{1D526}",
  igrave: "\xEC",
  ii: "\u2148",
  iiiint: "\u2A0C",
  iiint: "\u222D",
  iinfin: "\u29DC",
  iiota: "\u2129",
  ijlig: "\u0133",
  imacr: "\u012B",
  image: "\u2111",
  imagline: "\u2110",
  imagpart: "\u2111",
  imath: "\u0131",
  imof: "\u22B7",
  imped: "\u01B5",
  in: "\u2208",
  incare: "\u2105",
  infin: "\u221E",
  infintie: "\u29DD",
  inodot: "\u0131",
  int: "\u222B",
  intcal: "\u22BA",
  integers: "\u2124",
  intercal: "\u22BA",
  intlarhk: "\u2A17",
  intprod: "\u2A3C",
  iocy: "\u0451",
  iogon: "\u012F",
  iopf: "\u{1D55A}",
  iota: "\u03B9",
  iprod: "\u2A3C",
  iquest: "\xBF",
  iscr: "\u{1D4BE}",
  isin: "\u2208",
  isinE: "\u22F9",
  isindot: "\u22F5",
  isins: "\u22F4",
  isinsv: "\u22F3",
  isinv: "\u2208",
  it: "\u2062",
  itilde: "\u0129",
  iukcy: "\u0456",
  iuml: "\xEF",
  jcirc: "\u0135",
  jcy: "\u0439",
  jfr: "\u{1D527}",
  jmath: "\u0237",
  jopf: "\u{1D55B}",
  jscr: "\u{1D4BF}",
  jsercy: "\u0458",
  jukcy: "\u0454",
  kappa: "\u03BA",
  kappav: "\u03F0",
  kcedil: "\u0137",
  kcy: "\u043A",
  kfr: "\u{1D528}",
  kgreen: "\u0138",
  khcy: "\u0445",
  kjcy: "\u045C",
  kopf: "\u{1D55C}",
  kscr: "\u{1D4C0}",
  lAarr: "\u21DA",
  lArr: "\u21D0",
  lAtail: "\u291B",
  lBarr: "\u290E",
  lE: "\u2266",
  lEg: "\u2A8B",
  lHar: "\u2962",
  lacute: "\u013A",
  laemptyv: "\u29B4",
  lagran: "\u2112",
  lambda: "\u03BB",
  lang: "\u27E8",
  langd: "\u2991",
  langle: "\u27E8",
  lap: "\u2A85",
  laquo: "\xAB",
  larr: "\u2190",
  larrb: "\u21E4",
  larrbfs: "\u291F",
  larrfs: "\u291D",
  larrhk: "\u21A9",
  larrlp: "\u21AB",
  larrpl: "\u2939",
  larrsim: "\u2973",
  larrtl: "\u21A2",
  lat: "\u2AAB",
  latail: "\u2919",
  late: "\u2AAD",
  lates: "\u2AAD\uFE00",
  lbarr: "\u290C",
  lbbrk: "\u2772",
  lbrace: "{",
  lbrack: "[",
  lbrke: "\u298B",
  lbrksld: "\u298F",
  lbrkslu: "\u298D",
  lcaron: "\u013E",
  lcedil: "\u013C",
  lceil: "\u2308",
  lcub: "{",
  lcy: "\u043B",
  ldca: "\u2936",
  ldquo: "\u201C",
  ldquor: "\u201E",
  ldrdhar: "\u2967",
  ldrushar: "\u294B",
  ldsh: "\u21B2",
  le: "\u2264",
  leftarrow: "\u2190",
  leftarrowtail: "\u21A2",
  leftharpoondown: "\u21BD",
  leftharpoonup: "\u21BC",
  leftleftarrows: "\u21C7",
  leftrightarrow: "\u2194",
  leftrightarrows: "\u21C6",
  leftrightharpoons: "\u21CB",
  leftrightsquigarrow: "\u21AD",
  leftthreetimes: "\u22CB",
  leg: "\u22DA",
  leq: "\u2264",
  leqq: "\u2266",
  leqslant: "\u2A7D",
  les: "\u2A7D",
  lescc: "\u2AA8",
  lesdot: "\u2A7F",
  lesdoto: "\u2A81",
  lesdotor: "\u2A83",
  lesg: "\u22DA\uFE00",
  lesges: "\u2A93",
  lessapprox: "\u2A85",
  lessdot: "\u22D6",
  lesseqgtr: "\u22DA",
  lesseqqgtr: "\u2A8B",
  lessgtr: "\u2276",
  lesssim: "\u2272",
  lfisht: "\u297C",
  lfloor: "\u230A",
  lfr: "\u{1D529}",
  lg: "\u2276",
  lgE: "\u2A91",
  lhard: "\u21BD",
  lharu: "\u21BC",
  lharul: "\u296A",
  lhblk: "\u2584",
  ljcy: "\u0459",
  ll: "\u226A",
  llarr: "\u21C7",
  llcorner: "\u231E",
  llhard: "\u296B",
  lltri: "\u25FA",
  lmidot: "\u0140",
  lmoust: "\u23B0",
  lmoustache: "\u23B0",
  lnE: "\u2268",
  lnap: "\u2A89",
  lnapprox: "\u2A89",
  lne: "\u2A87",
  lneq: "\u2A87",
  lneqq: "\u2268",
  lnsim: "\u22E6",
  loang: "\u27EC",
  loarr: "\u21FD",
  lobrk: "\u27E6",
  longleftarrow: "\u27F5",
  longleftrightarrow: "\u27F7",
  longmapsto: "\u27FC",
  longrightarrow: "\u27F6",
  looparrowleft: "\u21AB",
  looparrowright: "\u21AC",
  lopar: "\u2985",
  lopf: "\u{1D55D}",
  loplus: "\u2A2D",
  lotimes: "\u2A34",
  lowast: "\u2217",
  lowbar: "_",
  loz: "\u25CA",
  lozenge: "\u25CA",
  lozf: "\u29EB",
  lpar: "(",
  lparlt: "\u2993",
  lrarr: "\u21C6",
  lrcorner: "\u231F",
  lrhar: "\u21CB",
  lrhard: "\u296D",
  lrm: "\u200E",
  lrtri: "\u22BF",
  lsaquo: "\u2039",
  lscr: "\u{1D4C1}",
  lsh: "\u21B0",
  lsim: "\u2272",
  lsime: "\u2A8D",
  lsimg: "\u2A8F",
  lsqb: "[",
  lsquo: "\u2018",
  lsquor: "\u201A",
  lstrok: "\u0142",
  lt: "<",
  ltcc: "\u2AA6",
  ltcir: "\u2A79",
  ltdot: "\u22D6",
  lthree: "\u22CB",
  ltimes: "\u22C9",
  ltlarr: "\u2976",
  ltquest: "\u2A7B",
  ltrPar: "\u2996",
  ltri: "\u25C3",
  ltrie: "\u22B4",
  ltrif: "\u25C2",
  lurdshar: "\u294A",
  luruhar: "\u2966",
  lvertneqq: "\u2268\uFE00",
  lvnE: "\u2268\uFE00",
  mDDot: "\u223A",
  macr: "\xAF",
  male: "\u2642",
  malt: "\u2720",
  maltese: "\u2720",
  map: "\u21A6",
  mapsto: "\u21A6",
  mapstodown: "\u21A7",
  mapstoleft: "\u21A4",
  mapstoup: "\u21A5",
  marker: "\u25AE",
  mcomma: "\u2A29",
  mcy: "\u043C",
  mdash: "\u2014",
  measuredangle: "\u2221",
  mfr: "\u{1D52A}",
  mho: "\u2127",
  micro: "\xB5",
  mid: "\u2223",
  midast: "*",
  midcir: "\u2AF0",
  middot: "\xB7",
  minus: "\u2212",
  minusb: "\u229F",
  minusd: "\u2238",
  minusdu: "\u2A2A",
  mlcp: "\u2ADB",
  mldr: "\u2026",
  mnplus: "\u2213",
  models: "\u22A7",
  mopf: "\u{1D55E}",
  mp: "\u2213",
  mscr: "\u{1D4C2}",
  mstpos: "\u223E",
  mu: "\u03BC",
  multimap: "\u22B8",
  mumap: "\u22B8",
  nGg: "\u22D9\u0338",
  nGt: "\u226B\u20D2",
  nGtv: "\u226B\u0338",
  nLeftarrow: "\u21CD",
  nLeftrightarrow: "\u21CE",
  nLl: "\u22D8\u0338",
  nLt: "\u226A\u20D2",
  nLtv: "\u226A\u0338",
  nRightarrow: "\u21CF",
  nVDash: "\u22AF",
  nVdash: "\u22AE",
  nabla: "\u2207",
  nacute: "\u0144",
  nang: "\u2220\u20D2",
  nap: "\u2249",
  napE: "\u2A70\u0338",
  napid: "\u224B\u0338",
  napos: "\u0149",
  napprox: "\u2249",
  natur: "\u266E",
  natural: "\u266E",
  naturals: "\u2115",
  nbsp: "\xA0",
  nbump: "\u224E\u0338",
  nbumpe: "\u224F\u0338",
  ncap: "\u2A43",
  ncaron: "\u0148",
  ncedil: "\u0146",
  ncong: "\u2247",
  ncongdot: "\u2A6D\u0338",
  ncup: "\u2A42",
  ncy: "\u043D",
  ndash: "\u2013",
  ne: "\u2260",
  neArr: "\u21D7",
  nearhk: "\u2924",
  nearr: "\u2197",
  nearrow: "\u2197",
  nedot: "\u2250\u0338",
  nequiv: "\u2262",
  nesear: "\u2928",
  nesim: "\u2242\u0338",
  nexist: "\u2204",
  nexists: "\u2204",
  nfr: "\u{1D52B}",
  ngE: "\u2267\u0338",
  nge: "\u2271",
  ngeq: "\u2271",
  ngeqq: "\u2267\u0338",
  ngeqslant: "\u2A7E\u0338",
  nges: "\u2A7E\u0338",
  ngsim: "\u2275",
  ngt: "\u226F",
  ngtr: "\u226F",
  nhArr: "\u21CE",
  nharr: "\u21AE",
  nhpar: "\u2AF2",
  ni: "\u220B",
  nis: "\u22FC",
  nisd: "\u22FA",
  niv: "\u220B",
  njcy: "\u045A",
  nlArr: "\u21CD",
  nlE: "\u2266\u0338",
  nlarr: "\u219A",
  nldr: "\u2025",
  nle: "\u2270",
  nleftarrow: "\u219A",
  nleftrightarrow: "\u21AE",
  nleq: "\u2270",
  nleqq: "\u2266\u0338",
  nleqslant: "\u2A7D\u0338",
  nles: "\u2A7D\u0338",
  nless: "\u226E",
  nlsim: "\u2274",
  nlt: "\u226E",
  nltri: "\u22EA",
  nltrie: "\u22EC",
  nmid: "\u2224",
  nopf: "\u{1D55F}",
  not: "\xAC",
  notin: "\u2209",
  notinE: "\u22F9\u0338",
  notindot: "\u22F5\u0338",
  notinva: "\u2209",
  notinvb: "\u22F7",
  notinvc: "\u22F6",
  notni: "\u220C",
  notniva: "\u220C",
  notnivb: "\u22FE",
  notnivc: "\u22FD",
  npar: "\u2226",
  nparallel: "\u2226",
  nparsl: "\u2AFD\u20E5",
  npart: "\u2202\u0338",
  npolint: "\u2A14",
  npr: "\u2280",
  nprcue: "\u22E0",
  npre: "\u2AAF\u0338",
  nprec: "\u2280",
  npreceq: "\u2AAF\u0338",
  nrArr: "\u21CF",
  nrarr: "\u219B",
  nrarrc: "\u2933\u0338",
  nrarrw: "\u219D\u0338",
  nrightarrow: "\u219B",
  nrtri: "\u22EB",
  nrtrie: "\u22ED",
  nsc: "\u2281",
  nsccue: "\u22E1",
  nsce: "\u2AB0\u0338",
  nscr: "\u{1D4C3}",
  nshortmid: "\u2224",
  nshortparallel: "\u2226",
  nsim: "\u2241",
  nsime: "\u2244",
  nsimeq: "\u2244",
  nsmid: "\u2224",
  nspar: "\u2226",
  nsqsube: "\u22E2",
  nsqsupe: "\u22E3",
  nsub: "\u2284",
  nsubE: "\u2AC5\u0338",
  nsube: "\u2288",
  nsubset: "\u2282\u20D2",
  nsubseteq: "\u2288",
  nsubseteqq: "\u2AC5\u0338",
  nsucc: "\u2281",
  nsucceq: "\u2AB0\u0338",
  nsup: "\u2285",
  nsupE: "\u2AC6\u0338",
  nsupe: "\u2289",
  nsupset: "\u2283\u20D2",
  nsupseteq: "\u2289",
  nsupseteqq: "\u2AC6\u0338",
  ntgl: "\u2279",
  ntilde: "\xF1",
  ntlg: "\u2278",
  ntriangleleft: "\u22EA",
  ntrianglelefteq: "\u22EC",
  ntriangleright: "\u22EB",
  ntrianglerighteq: "\u22ED",
  nu: "\u03BD",
  num: "#",
  numero: "\u2116",
  numsp: "\u2007",
  nvDash: "\u22AD",
  nvHarr: "\u2904",
  nvap: "\u224D\u20D2",
  nvdash: "\u22AC",
  nvge: "\u2265\u20D2",
  nvgt: ">\u20D2",
  nvinfin: "\u29DE",
  nvlArr: "\u2902",
  nvle: "\u2264\u20D2",
  nvlt: "<\u20D2",
  nvltrie: "\u22B4\u20D2",
  nvrArr: "\u2903",
  nvrtrie: "\u22B5\u20D2",
  nvsim: "\u223C\u20D2",
  nwArr: "\u21D6",
  nwarhk: "\u2923",
  nwarr: "\u2196",
  nwarrow: "\u2196",
  nwnear: "\u2927",
  oS: "\u24C8",
  oacute: "\xF3",
  oast: "\u229B",
  ocir: "\u229A",
  ocirc: "\xF4",
  ocy: "\u043E",
  odash: "\u229D",
  odblac: "\u0151",
  odiv: "\u2A38",
  odot: "\u2299",
  odsold: "\u29BC",
  oelig: "\u0153",
  ofcir: "\u29BF",
  ofr: "\u{1D52C}",
  ogon: "\u02DB",
  ograve: "\xF2",
  ogt: "\u29C1",
  ohbar: "\u29B5",
  ohm: "\u03A9",
  oint: "\u222E",
  olarr: "\u21BA",
  olcir: "\u29BE",
  olcross: "\u29BB",
  oline: "\u203E",
  olt: "\u29C0",
  omacr: "\u014D",
  omega: "\u03C9",
  omicron: "\u03BF",
  omid: "\u29B6",
  ominus: "\u2296",
  oopf: "\u{1D560}",
  opar: "\u29B7",
  operp: "\u29B9",
  oplus: "\u2295",
  or: "\u2228",
  orarr: "\u21BB",
  ord: "\u2A5D",
  order: "\u2134",
  orderof: "\u2134",
  ordf: "\xAA",
  ordm: "\xBA",
  origof: "\u22B6",
  oror: "\u2A56",
  orslope: "\u2A57",
  orv: "\u2A5B",
  oscr: "\u2134",
  oslash: "\xF8",
  osol: "\u2298",
  otilde: "\xF5",
  otimes: "\u2297",
  otimesas: "\u2A36",
  ouml: "\xF6",
  ovbar: "\u233D",
  par: "\u2225",
  para: "\xB6",
  parallel: "\u2225",
  parsim: "\u2AF3",
  parsl: "\u2AFD",
  part: "\u2202",
  pcy: "\u043F",
  percnt: "%",
  period: ".",
  permil: "\u2030",
  perp: "\u22A5",
  pertenk: "\u2031",
  pfr: "\u{1D52D}",
  phi: "\u03C6",
  phiv: "\u03D5",
  phmmat: "\u2133",
  phone: "\u260E",
  pi: "\u03C0",
  pitchfork: "\u22D4",
  piv: "\u03D6",
  planck: "\u210F",
  planckh: "\u210E",
  plankv: "\u210F",
  plus: "+",
  plusacir: "\u2A23",
  plusb: "\u229E",
  pluscir: "\u2A22",
  plusdo: "\u2214",
  plusdu: "\u2A25",
  pluse: "\u2A72",
  plusmn: "\xB1",
  plussim: "\u2A26",
  plustwo: "\u2A27",
  pm: "\xB1",
  pointint: "\u2A15",
  popf: "\u{1D561}",
  pound: "\xA3",
  pr: "\u227A",
  prE: "\u2AB3",
  prap: "\u2AB7",
  prcue: "\u227C",
  pre: "\u2AAF",
  prec: "\u227A",
  precapprox: "\u2AB7",
  preccurlyeq: "\u227C",
  preceq: "\u2AAF",
  precnapprox: "\u2AB9",
  precneqq: "\u2AB5",
  precnsim: "\u22E8",
  precsim: "\u227E",
  prime: "\u2032",
  primes: "\u2119",
  prnE: "\u2AB5",
  prnap: "\u2AB9",
  prnsim: "\u22E8",
  prod: "\u220F",
  profalar: "\u232E",
  profline: "\u2312",
  profsurf: "\u2313",
  prop: "\u221D",
  propto: "\u221D",
  prsim: "\u227E",
  prurel: "\u22B0",
  pscr: "\u{1D4C5}",
  psi: "\u03C8",
  puncsp: "\u2008",
  qfr: "\u{1D52E}",
  qint: "\u2A0C",
  qopf: "\u{1D562}",
  qprime: "\u2057",
  qscr: "\u{1D4C6}",
  quaternions: "\u210D",
  quatint: "\u2A16",
  quest: "?",
  questeq: "\u225F",
  quot: '"',
  rAarr: "\u21DB",
  rArr: "\u21D2",
  rAtail: "\u291C",
  rBarr: "\u290F",
  rHar: "\u2964",
  race: "\u223D\u0331",
  racute: "\u0155",
  radic: "\u221A",
  raemptyv: "\u29B3",
  rang: "\u27E9",
  rangd: "\u2992",
  range: "\u29A5",
  rangle: "\u27E9",
  raquo: "\xBB",
  rarr: "\u2192",
  rarrap: "\u2975",
  rarrb: "\u21E5",
  rarrbfs: "\u2920",
  rarrc: "\u2933",
  rarrfs: "\u291E",
  rarrhk: "\u21AA",
  rarrlp: "\u21AC",
  rarrpl: "\u2945",
  rarrsim: "\u2974",
  rarrtl: "\u21A3",
  rarrw: "\u219D",
  ratail: "\u291A",
  ratio: "\u2236",
  rationals: "\u211A",
  rbarr: "\u290D",
  rbbrk: "\u2773",
  rbrace: "}",
  rbrack: "]",
  rbrke: "\u298C",
  rbrksld: "\u298E",
  rbrkslu: "\u2990",
  rcaron: "\u0159",
  rcedil: "\u0157",
  rceil: "\u2309",
  rcub: "}",
  rcy: "\u0440",
  rdca: "\u2937",
  rdldhar: "\u2969",
  rdquo: "\u201D",
  rdquor: "\u201D",
  rdsh: "\u21B3",
  real: "\u211C",
  realine: "\u211B",
  realpart: "\u211C",
  reals: "\u211D",
  rect: "\u25AD",
  reg: "\xAE",
  rfisht: "\u297D",
  rfloor: "\u230B",
  rfr: "\u{1D52F}",
  rhard: "\u21C1",
  rharu: "\u21C0",
  rharul: "\u296C",
  rho: "\u03C1",
  rhov: "\u03F1",
  rightarrow: "\u2192",
  rightarrowtail: "\u21A3",
  rightharpoondown: "\u21C1",
  rightharpoonup: "\u21C0",
  rightleftarrows: "\u21C4",
  rightleftharpoons: "\u21CC",
  rightrightarrows: "\u21C9",
  rightsquigarrow: "\u219D",
  rightthreetimes: "\u22CC",
  ring: "\u02DA",
  risingdotseq: "\u2253",
  rlarr: "\u21C4",
  rlhar: "\u21CC",
  rlm: "\u200F",
  rmoust: "\u23B1",
  rmoustache: "\u23B1",
  rnmid: "\u2AEE",
  roang: "\u27ED",
  roarr: "\u21FE",
  robrk: "\u27E7",
  ropar: "\u2986",
  ropf: "\u{1D563}",
  roplus: "\u2A2E",
  rotimes: "\u2A35",
  rpar: ")",
  rpargt: "\u2994",
  rppolint: "\u2A12",
  rrarr: "\u21C9",
  rsaquo: "\u203A",
  rscr: "\u{1D4C7}",
  rsh: "\u21B1",
  rsqb: "]",
  rsquo: "\u2019",
  rsquor: "\u2019",
  rthree: "\u22CC",
  rtimes: "\u22CA",
  rtri: "\u25B9",
  rtrie: "\u22B5",
  rtrif: "\u25B8",
  rtriltri: "\u29CE",
  ruluhar: "\u2968",
  rx: "\u211E",
  sacute: "\u015B",
  sbquo: "\u201A",
  sc: "\u227B",
  scE: "\u2AB4",
  scap: "\u2AB8",
  scaron: "\u0161",
  sccue: "\u227D",
  sce: "\u2AB0",
  scedil: "\u015F",
  scirc: "\u015D",
  scnE: "\u2AB6",
  scnap: "\u2ABA",
  scnsim: "\u22E9",
  scpolint: "\u2A13",
  scsim: "\u227F",
  scy: "\u0441",
  sdot: "\u22C5",
  sdotb: "\u22A1",
  sdote: "\u2A66",
  seArr: "\u21D8",
  searhk: "\u2925",
  searr: "\u2198",
  searrow: "\u2198",
  sect: "\xA7",
  semi: ";",
  seswar: "\u2929",
  setminus: "\u2216",
  setmn: "\u2216",
  sext: "\u2736",
  sfr: "\u{1D530}",
  sfrown: "\u2322",
  sharp: "\u266F",
  shchcy: "\u0449",
  shcy: "\u0448",
  shortmid: "\u2223",
  shortparallel: "\u2225",
  shy: "\xAD",
  sigma: "\u03C3",
  sigmaf: "\u03C2",
  sigmav: "\u03C2",
  sim: "\u223C",
  simdot: "\u2A6A",
  sime: "\u2243",
  simeq: "\u2243",
  simg: "\u2A9E",
  simgE: "\u2AA0",
  siml: "\u2A9D",
  simlE: "\u2A9F",
  simne: "\u2246",
  simplus: "\u2A24",
  simrarr: "\u2972",
  slarr: "\u2190",
  smallsetminus: "\u2216",
  smashp: "\u2A33",
  smeparsl: "\u29E4",
  smid: "\u2223",
  smile: "\u2323",
  smt: "\u2AAA",
  smte: "\u2AAC",
  smtes: "\u2AAC\uFE00",
  softcy: "\u044C",
  sol: "/",
  solb: "\u29C4",
  solbar: "\u233F",
  sopf: "\u{1D564}",
  spades: "\u2660",
  spadesuit: "\u2660",
  spar: "\u2225",
  sqcap: "\u2293",
  sqcaps: "\u2293\uFE00",
  sqcup: "\u2294",
  sqcups: "\u2294\uFE00",
  sqsub: "\u228F",
  sqsube: "\u2291",
  sqsubset: "\u228F",
  sqsubseteq: "\u2291",
  sqsup: "\u2290",
  sqsupe: "\u2292",
  sqsupset: "\u2290",
  sqsupseteq: "\u2292",
  squ: "\u25A1",
  square: "\u25A1",
  squarf: "\u25AA",
  squf: "\u25AA",
  srarr: "\u2192",
  sscr: "\u{1D4C8}",
  ssetmn: "\u2216",
  ssmile: "\u2323",
  sstarf: "\u22C6",
  star: "\u2606",
  starf: "\u2605",
  straightepsilon: "\u03F5",
  straightphi: "\u03D5",
  strns: "\xAF",
  sub: "\u2282",
  subE: "\u2AC5",
  subdot: "\u2ABD",
  sube: "\u2286",
  subedot: "\u2AC3",
  submult: "\u2AC1",
  subnE: "\u2ACB",
  subne: "\u228A",
  subplus: "\u2ABF",
  subrarr: "\u2979",
  subset: "\u2282",
  subseteq: "\u2286",
  subseteqq: "\u2AC5",
  subsetneq: "\u228A",
  subsetneqq: "\u2ACB",
  subsim: "\u2AC7",
  subsub: "\u2AD5",
  subsup: "\u2AD3",
  succ: "\u227B",
  succapprox: "\u2AB8",
  succcurlyeq: "\u227D",
  succeq: "\u2AB0",
  succnapprox: "\u2ABA",
  succneqq: "\u2AB6",
  succnsim: "\u22E9",
  succsim: "\u227F",
  sum: "\u2211",
  sung: "\u266A",
  sup1: "\xB9",
  sup2: "\xB2",
  sup3: "\xB3",
  sup: "\u2283",
  supE: "\u2AC6",
  supdot: "\u2ABE",
  supdsub: "\u2AD8",
  supe: "\u2287",
  supedot: "\u2AC4",
  suphsol: "\u27C9",
  suphsub: "\u2AD7",
  suplarr: "\u297B",
  supmult: "\u2AC2",
  supnE: "\u2ACC",
  supne: "\u228B",
  supplus: "\u2AC0",
  supset: "\u2283",
  supseteq: "\u2287",
  supseteqq: "\u2AC6",
  supsetneq: "\u228B",
  supsetneqq: "\u2ACC",
  supsim: "\u2AC8",
  supsub: "\u2AD4",
  supsup: "\u2AD6",
  swArr: "\u21D9",
  swarhk: "\u2926",
  swarr: "\u2199",
  swarrow: "\u2199",
  swnwar: "\u292A",
  szlig: "\xDF",
  target: "\u2316",
  tau: "\u03C4",
  tbrk: "\u23B4",
  tcaron: "\u0165",
  tcedil: "\u0163",
  tcy: "\u0442",
  tdot: "\u20DB",
  telrec: "\u2315",
  tfr: "\u{1D531}",
  there4: "\u2234",
  therefore: "\u2234",
  theta: "\u03B8",
  thetasym: "\u03D1",
  thetav: "\u03D1",
  thickapprox: "\u2248",
  thicksim: "\u223C",
  thinsp: "\u2009",
  thkap: "\u2248",
  thksim: "\u223C",
  thorn: "\xFE",
  tilde: "\u02DC",
  times: "\xD7",
  timesb: "\u22A0",
  timesbar: "\u2A31",
  timesd: "\u2A30",
  tint: "\u222D",
  toea: "\u2928",
  top: "\u22A4",
  topbot: "\u2336",
  topcir: "\u2AF1",
  topf: "\u{1D565}",
  topfork: "\u2ADA",
  tosa: "\u2929",
  tprime: "\u2034",
  trade: "\u2122",
  triangle: "\u25B5",
  triangledown: "\u25BF",
  triangleleft: "\u25C3",
  trianglelefteq: "\u22B4",
  triangleq: "\u225C",
  triangleright: "\u25B9",
  trianglerighteq: "\u22B5",
  tridot: "\u25EC",
  trie: "\u225C",
  triminus: "\u2A3A",
  triplus: "\u2A39",
  trisb: "\u29CD",
  tritime: "\u2A3B",
  trpezium: "\u23E2",
  tscr: "\u{1D4C9}",
  tscy: "\u0446",
  tshcy: "\u045B",
  tstrok: "\u0167",
  twixt: "\u226C",
  twoheadleftarrow: "\u219E",
  twoheadrightarrow: "\u21A0",
  uArr: "\u21D1",
  uHar: "\u2963",
  uacute: "\xFA",
  uarr: "\u2191",
  ubrcy: "\u045E",
  ubreve: "\u016D",
  ucirc: "\xFB",
  ucy: "\u0443",
  udarr: "\u21C5",
  udblac: "\u0171",
  udhar: "\u296E",
  ufisht: "\u297E",
  ufr: "\u{1D532}",
  ugrave: "\xF9",
  uharl: "\u21BF",
  uharr: "\u21BE",
  uhblk: "\u2580",
  ulcorn: "\u231C",
  ulcorner: "\u231C",
  ulcrop: "\u230F",
  ultri: "\u25F8",
  umacr: "\u016B",
  uml: "\xA8",
  uogon: "\u0173",
  uopf: "\u{1D566}",
  uparrow: "\u2191",
  updownarrow: "\u2195",
  upharpoonleft: "\u21BF",
  upharpoonright: "\u21BE",
  uplus: "\u228E",
  upsi: "\u03C5",
  upsih: "\u03D2",
  upsilon: "\u03C5",
  upuparrows: "\u21C8",
  urcorn: "\u231D",
  urcorner: "\u231D",
  urcrop: "\u230E",
  uring: "\u016F",
  urtri: "\u25F9",
  uscr: "\u{1D4CA}",
  utdot: "\u22F0",
  utilde: "\u0169",
  utri: "\u25B5",
  utrif: "\u25B4",
  uuarr: "\u21C8",
  uuml: "\xFC",
  uwangle: "\u29A7",
  vArr: "\u21D5",
  vBar: "\u2AE8",
  vBarv: "\u2AE9",
  vDash: "\u22A8",
  vangrt: "\u299C",
  varepsilon: "\u03F5",
  varkappa: "\u03F0",
  varnothing: "\u2205",
  varphi: "\u03D5",
  varpi: "\u03D6",
  varpropto: "\u221D",
  varr: "\u2195",
  varrho: "\u03F1",
  varsigma: "\u03C2",
  varsubsetneq: "\u228A\uFE00",
  varsubsetneqq: "\u2ACB\uFE00",
  varsupsetneq: "\u228B\uFE00",
  varsupsetneqq: "\u2ACC\uFE00",
  vartheta: "\u03D1",
  vartriangleleft: "\u22B2",
  vartriangleright: "\u22B3",
  vcy: "\u0432",
  vdash: "\u22A2",
  vee: "\u2228",
  veebar: "\u22BB",
  veeeq: "\u225A",
  vellip: "\u22EE",
  verbar: "|",
  vert: "|",
  vfr: "\u{1D533}",
  vltri: "\u22B2",
  vnsub: "\u2282\u20D2",
  vnsup: "\u2283\u20D2",
  vopf: "\u{1D567}",
  vprop: "\u221D",
  vrtri: "\u22B3",
  vscr: "\u{1D4CB}",
  vsubnE: "\u2ACB\uFE00",
  vsubne: "\u228A\uFE00",
  vsupnE: "\u2ACC\uFE00",
  vsupne: "\u228B\uFE00",
  vzigzag: "\u299A",
  wcirc: "\u0175",
  wedbar: "\u2A5F",
  wedge: "\u2227",
  wedgeq: "\u2259",
  weierp: "\u2118",
  wfr: "\u{1D534}",
  wopf: "\u{1D568}",
  wp: "\u2118",
  wr: "\u2240",
  wreath: "\u2240",
  wscr: "\u{1D4CC}",
  xcap: "\u22C2",
  xcirc: "\u25EF",
  xcup: "\u22C3",
  xdtri: "\u25BD",
  xfr: "\u{1D535}",
  xhArr: "\u27FA",
  xharr: "\u27F7",
  xi: "\u03BE",
  xlArr: "\u27F8",
  xlarr: "\u27F5",
  xmap: "\u27FC",
  xnis: "\u22FB",
  xodot: "\u2A00",
  xopf: "\u{1D569}",
  xoplus: "\u2A01",
  xotime: "\u2A02",
  xrArr: "\u27F9",
  xrarr: "\u27F6",
  xscr: "\u{1D4CD}",
  xsqcup: "\u2A06",
  xuplus: "\u2A04",
  xutri: "\u25B3",
  xvee: "\u22C1",
  xwedge: "\u22C0",
  yacute: "\xFD",
  yacy: "\u044F",
  ycirc: "\u0177",
  ycy: "\u044B",
  yen: "\xA5",
  yfr: "\u{1D536}",
  yicy: "\u0457",
  yopf: "\u{1D56A}",
  yscr: "\u{1D4CE}",
  yucy: "\u044E",
  yuml: "\xFF",
  zacute: "\u017A",
  zcaron: "\u017E",
  zcy: "\u0437",
  zdot: "\u017C",
  zeetrf: "\u2128",
  zeta: "\u03B6",
  zfr: "\u{1D537}",
  zhcy: "\u0436",
  zigrarr: "\u21DD",
  zopf: "\u{1D56B}",
  zscr: "\u{1D4CF}",
  zwj: "\u200D",
  zwnj: "\u200C"
};

// node_modules/decode-named-character-reference/index.js
var own = {}.hasOwnProperty;
function decodeNamedCharacterReference(value) {
  return own.call(characterEntities, value) ? characterEntities[value] : false;
}

// node_modules/micromark-util-chunked/index.js
function splice(list2, start, remove, items) {
  const end = list2.length;
  let chunkStart = 0;
  let parameters;
  if (start < 0) {
    start = -start > end ? 0 : end + start;
  } else {
    start = start > end ? end : start;
  }
  remove = remove > 0 ? remove : 0;
  if (items.length < 1e4) {
    parameters = Array.from(items);
    parameters.unshift(start, remove);
    list2.splice(...parameters);
  } else {
    if (remove) list2.splice(start, remove);
    while (chunkStart < items.length) {
      parameters = items.slice(chunkStart, chunkStart + 1e4);
      parameters.unshift(start, 0);
      list2.splice(...parameters);
      chunkStart += 1e4;
      start += 1e4;
    }
  }
}
function push(list2, items) {
  if (list2.length > 0) {
    splice(list2, list2.length, 0, items);
    return list2;
  }
  return items;
}

// node_modules/micromark-util-combine-extensions/index.js
var hasOwnProperty = {}.hasOwnProperty;
function combineExtensions(extensions) {
  const all2 = {};
  let index2 = -1;
  while (++index2 < extensions.length) {
    syntaxExtension(all2, extensions[index2]);
  }
  return all2;
}
function syntaxExtension(all2, extension2) {
  let hook;
  for (hook in extension2) {
    const maybe = hasOwnProperty.call(all2, hook) ? all2[hook] : void 0;
    const left = maybe || (all2[hook] = {});
    const right = extension2[hook];
    let code;
    if (right) {
      for (code in right) {
        if (!hasOwnProperty.call(left, code)) left[code] = [];
        const value = right[code];
        constructs(
          // @ts-expect-error Looks like a list.
          left[code],
          Array.isArray(value) ? value : value ? [value] : []
        );
      }
    }
  }
}
function constructs(existing, list2) {
  let index2 = -1;
  const before = [];
  while (++index2 < list2.length) {
    ;
    (list2[index2].add === "after" ? existing : before).push(list2[index2]);
  }
  splice(existing, 0, 0, before);
}

// node_modules/micromark-util-decode-numeric-character-reference/index.js
function decodeNumericCharacterReference(value, base) {
  const code = Number.parseInt(value, base);
  if (
    // C0 except for HT, LF, FF, CR, space.
    code < 9 || code === 11 || code > 13 && code < 32 || // Control character (DEL) of C0, and C1 controls.
    code > 126 && code < 160 || // Lone high surrogates and low surrogates.
    code > 55295 && code < 57344 || // Noncharacters.
    code > 64975 && code < 65008 || /* eslint-disable no-bitwise */
    (code & 65535) === 65535 || (code & 65535) === 65534 || /* eslint-enable no-bitwise */
    // Out of range
    code > 1114111
  ) {
    return "\uFFFD";
  }
  return String.fromCodePoint(code);
}

// node_modules/micromark-util-normalize-identifier/index.js
function normalizeIdentifier(value) {
  return value.replace(/[\t\n\r ]+/g, " ").replace(/^ | $/g, "").toLowerCase().toUpperCase();
}

// node_modules/micromark-util-character/index.js
var asciiAlpha = regexCheck(/[A-Za-z]/);
var asciiAlphanumeric = regexCheck(/[\dA-Za-z]/);
var asciiAtext = regexCheck(/[#-'*+\--9=?A-Z^-~]/);
function asciiControl(code) {
  return (
    // Special whitespace codes (which have negative values), C0 and Control
    // character DEL
    code !== null && (code < 32 || code === 127)
  );
}
var asciiDigit = regexCheck(/\d/);
var asciiHexDigit = regexCheck(/[\dA-Fa-f]/);
var asciiPunctuation = regexCheck(/[!-/:-@[-`{-~]/);
function markdownLineEnding(code) {
  return code !== null && code < -2;
}
function markdownLineEndingOrSpace(code) {
  return code !== null && (code < 0 || code === 32);
}
function markdownSpace(code) {
  return code === -2 || code === -1 || code === 32;
}
var unicodePunctuation = regexCheck(new RegExp("\\p{P}|\\p{S}", "u"));
var unicodeWhitespace = regexCheck(/\s/);
function regexCheck(regex) {
  return check;
  function check(code) {
    return code !== null && code > -1 && regex.test(String.fromCharCode(code));
  }
}

// node_modules/micromark-factory-space/index.js
function factorySpace(effects, ok, type, max) {
  const limit = max ? max - 1 : Number.POSITIVE_INFINITY;
  let size = 0;
  return start;
  function start(code) {
    if (markdownSpace(code)) {
      effects.enter(type);
      return prefix(code);
    }
    return ok(code);
  }
  function prefix(code) {
    if (markdownSpace(code) && size++ < limit) {
      effects.consume(code);
      return prefix;
    }
    effects.exit(type);
    return ok(code);
  }
}

// node_modules/micromark/lib/initialize/content.js
var content = {
  tokenize: initializeContent
};
function initializeContent(effects) {
  const contentStart = effects.attempt(this.parser.constructs.contentInitial, afterContentStartConstruct, paragraphInitial);
  let previous2;
  return contentStart;
  function afterContentStartConstruct(code) {
    if (code === null) {
      effects.consume(code);
      return;
    }
    effects.enter("lineEnding");
    effects.consume(code);
    effects.exit("lineEnding");
    return factorySpace(effects, contentStart, "linePrefix");
  }
  function paragraphInitial(code) {
    effects.enter("paragraph");
    return lineStart(code);
  }
  function lineStart(code) {
    const token = effects.enter("chunkText", {
      contentType: "text",
      previous: previous2
    });
    if (previous2) {
      previous2.next = token;
    }
    previous2 = token;
    return data(code);
  }
  function data(code) {
    if (code === null) {
      effects.exit("chunkText");
      effects.exit("paragraph");
      effects.consume(code);
      return;
    }
    if (markdownLineEnding(code)) {
      effects.consume(code);
      effects.exit("chunkText");
      return lineStart;
    }
    effects.consume(code);
    return data;
  }
}

// node_modules/micromark/lib/initialize/document.js
var document = {
  tokenize: initializeDocument
};
var containerConstruct = {
  tokenize: tokenizeContainer
};
function initializeDocument(effects) {
  const self = this;
  const stack = [];
  let continued = 0;
  let childFlow;
  let childToken;
  let lineStartOffset;
  return start;
  function start(code) {
    if (continued < stack.length) {
      const item = stack[continued];
      self.containerState = item[1];
      return effects.attempt(item[0].continuation, documentContinue, checkNewContainers)(code);
    }
    return checkNewContainers(code);
  }
  function documentContinue(code) {
    continued++;
    if (self.containerState._closeFlow) {
      self.containerState._closeFlow = void 0;
      if (childFlow) {
        closeFlow();
      }
      const indexBeforeExits = self.events.length;
      let indexBeforeFlow = indexBeforeExits;
      let point3;
      while (indexBeforeFlow--) {
        if (self.events[indexBeforeFlow][0] === "exit" && self.events[indexBeforeFlow][1].type === "chunkFlow") {
          point3 = self.events[indexBeforeFlow][1].end;
          break;
        }
      }
      exitContainers(continued);
      let index2 = indexBeforeExits;
      while (index2 < self.events.length) {
        self.events[index2][1].end = {
          ...point3
        };
        index2++;
      }
      splice(self.events, indexBeforeFlow + 1, 0, self.events.slice(indexBeforeExits));
      self.events.length = index2;
      return checkNewContainers(code);
    }
    return start(code);
  }
  function checkNewContainers(code) {
    if (continued === stack.length) {
      if (!childFlow) {
        return documentContinued(code);
      }
      if (childFlow.currentConstruct && childFlow.currentConstruct.concrete) {
        return flowStart(code);
      }
      self.interrupt = Boolean(childFlow.currentConstruct && !childFlow._gfmTableDynamicInterruptHack);
    }
    self.containerState = {};
    return effects.check(containerConstruct, thereIsANewContainer, thereIsNoNewContainer)(code);
  }
  function thereIsANewContainer(code) {
    if (childFlow) closeFlow();
    exitContainers(continued);
    return documentContinued(code);
  }
  function thereIsNoNewContainer(code) {
    self.parser.lazy[self.now().line] = continued !== stack.length;
    lineStartOffset = self.now().offset;
    return flowStart(code);
  }
  function documentContinued(code) {
    self.containerState = {};
    return effects.attempt(containerConstruct, containerContinue, flowStart)(code);
  }
  function containerContinue(code) {
    continued++;
    stack.push([self.currentConstruct, self.containerState]);
    return documentContinued(code);
  }
  function flowStart(code) {
    if (code === null) {
      if (childFlow) closeFlow();
      exitContainers(0);
      effects.consume(code);
      return;
    }
    childFlow = childFlow || self.parser.flow(self.now());
    effects.enter("chunkFlow", {
      _tokenizer: childFlow,
      contentType: "flow",
      previous: childToken
    });
    return flowContinue(code);
  }
  function flowContinue(code) {
    if (code === null) {
      writeToChild(effects.exit("chunkFlow"), true);
      exitContainers(0);
      effects.consume(code);
      return;
    }
    if (markdownLineEnding(code)) {
      effects.consume(code);
      writeToChild(effects.exit("chunkFlow"));
      continued = 0;
      self.interrupt = void 0;
      return start;
    }
    effects.consume(code);
    return flowContinue;
  }
  function writeToChild(token, endOfFile) {
    const stream = self.sliceStream(token);
    if (endOfFile) stream.push(null);
    token.previous = childToken;
    if (childToken) childToken.next = token;
    childToken = token;
    childFlow.defineSkip(token.start);
    childFlow.write(stream);
    if (self.parser.lazy[token.start.line]) {
      let index2 = childFlow.events.length;
      while (index2--) {
        if (
          // The token starts before the line ending…
          childFlow.events[index2][1].start.offset < lineStartOffset && // …and either is not ended yet…
          (!childFlow.events[index2][1].end || // …or ends after it.
          childFlow.events[index2][1].end.offset > lineStartOffset)
        ) {
          return;
        }
      }
      const indexBeforeExits = self.events.length;
      let indexBeforeFlow = indexBeforeExits;
      let seen;
      let point3;
      while (indexBeforeFlow--) {
        if (self.events[indexBeforeFlow][0] === "exit" && self.events[indexBeforeFlow][1].type === "chunkFlow") {
          if (seen) {
            point3 = self.events[indexBeforeFlow][1].end;
            break;
          }
          seen = true;
        }
      }
      exitContainers(continued);
      index2 = indexBeforeExits;
      while (index2 < self.events.length) {
        self.events[index2][1].end = {
          ...point3
        };
        index2++;
      }
      splice(self.events, indexBeforeFlow + 1, 0, self.events.slice(indexBeforeExits));
      self.events.length = index2;
    }
  }
  function exitContainers(size) {
    let index2 = stack.length;
    while (index2-- > size) {
      const entry = stack[index2];
      self.containerState = entry[1];
      entry[0].exit.call(self, effects);
    }
    stack.length = size;
  }
  function closeFlow() {
    childFlow.write([null]);
    childToken = void 0;
    childFlow = void 0;
    self.containerState._closeFlow = void 0;
  }
}
function tokenizeContainer(effects, ok, nok) {
  return factorySpace(effects, effects.attempt(this.parser.constructs.document, ok, nok), "linePrefix", this.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4);
}

// node_modules/micromark-util-classify-character/index.js
function classifyCharacter(code) {
  if (code === null || markdownLineEndingOrSpace(code) || unicodeWhitespace(code)) {
    return 1;
  }
  if (unicodePunctuation(code)) {
    return 2;
  }
}

// node_modules/micromark-util-resolve-all/index.js
function resolveAll(constructs2, events, context) {
  const called = [];
  let index2 = -1;
  while (++index2 < constructs2.length) {
    const resolve3 = constructs2[index2].resolveAll;
    if (resolve3 && !called.includes(resolve3)) {
      events = resolve3(events, context);
      called.push(resolve3);
    }
  }
  return events;
}

// node_modules/micromark-core-commonmark/lib/attention.js
var attention = {
  name: "attention",
  resolveAll: resolveAllAttention,
  tokenize: tokenizeAttention
};
function resolveAllAttention(events, context) {
  let index2 = -1;
  let open11;
  let group;
  let text3;
  let openingSequence;
  let closingSequence;
  let use;
  let nextEvents;
  let offset;
  while (++index2 < events.length) {
    if (events[index2][0] === "enter" && events[index2][1].type === "attentionSequence" && events[index2][1]._close) {
      open11 = index2;
      while (open11--) {
        if (events[open11][0] === "exit" && events[open11][1].type === "attentionSequence" && events[open11][1]._open && // If the markers are the same:
        context.sliceSerialize(events[open11][1]).charCodeAt(0) === context.sliceSerialize(events[index2][1]).charCodeAt(0)) {
          if ((events[open11][1]._close || events[index2][1]._open) && (events[index2][1].end.offset - events[index2][1].start.offset) % 3 && !((events[open11][1].end.offset - events[open11][1].start.offset + events[index2][1].end.offset - events[index2][1].start.offset) % 3)) {
            continue;
          }
          use = events[open11][1].end.offset - events[open11][1].start.offset > 1 && events[index2][1].end.offset - events[index2][1].start.offset > 1 ? 2 : 1;
          const start = {
            ...events[open11][1].end
          };
          const end = {
            ...events[index2][1].start
          };
          movePoint(start, -use);
          movePoint(end, use);
          openingSequence = {
            type: use > 1 ? "strongSequence" : "emphasisSequence",
            start,
            end: {
              ...events[open11][1].end
            }
          };
          closingSequence = {
            type: use > 1 ? "strongSequence" : "emphasisSequence",
            start: {
              ...events[index2][1].start
            },
            end
          };
          text3 = {
            type: use > 1 ? "strongText" : "emphasisText",
            start: {
              ...events[open11][1].end
            },
            end: {
              ...events[index2][1].start
            }
          };
          group = {
            type: use > 1 ? "strong" : "emphasis",
            start: {
              ...openingSequence.start
            },
            end: {
              ...closingSequence.end
            }
          };
          events[open11][1].end = {
            ...openingSequence.start
          };
          events[index2][1].start = {
            ...closingSequence.end
          };
          nextEvents = [];
          if (events[open11][1].end.offset - events[open11][1].start.offset) {
            nextEvents = push(nextEvents, [["enter", events[open11][1], context], ["exit", events[open11][1], context]]);
          }
          nextEvents = push(nextEvents, [["enter", group, context], ["enter", openingSequence, context], ["exit", openingSequence, context], ["enter", text3, context]]);
          nextEvents = push(nextEvents, resolveAll(context.parser.constructs.insideSpan.null, events.slice(open11 + 1, index2), context));
          nextEvents = push(nextEvents, [["exit", text3, context], ["enter", closingSequence, context], ["exit", closingSequence, context], ["exit", group, context]]);
          if (events[index2][1].end.offset - events[index2][1].start.offset) {
            offset = 2;
            nextEvents = push(nextEvents, [["enter", events[index2][1], context], ["exit", events[index2][1], context]]);
          } else {
            offset = 0;
          }
          splice(events, open11 - 1, index2 - open11 + 3, nextEvents);
          index2 = open11 + nextEvents.length - offset - 2;
          break;
        }
      }
    }
  }
  index2 = -1;
  while (++index2 < events.length) {
    if (events[index2][1].type === "attentionSequence") {
      events[index2][1].type = "data";
    }
  }
  return events;
}
function tokenizeAttention(effects, ok) {
  const attentionMarkers2 = this.parser.constructs.attentionMarkers.null;
  const previous2 = this.previous;
  const before = classifyCharacter(previous2);
  let marker;
  return start;
  function start(code) {
    marker = code;
    effects.enter("attentionSequence");
    return inside(code);
  }
  function inside(code) {
    if (code === marker) {
      effects.consume(code);
      return inside;
    }
    const token = effects.exit("attentionSequence");
    const after = classifyCharacter(code);
    const open11 = !after || after === 2 && before || attentionMarkers2.includes(code);
    const close = !before || before === 2 && after || attentionMarkers2.includes(previous2);
    token._open = Boolean(marker === 42 ? open11 : open11 && (before || !close));
    token._close = Boolean(marker === 42 ? close : close && (after || !open11));
    return ok(code);
  }
}
function movePoint(point3, offset) {
  point3.column += offset;
  point3.offset += offset;
  point3._bufferIndex += offset;
}

// node_modules/micromark-core-commonmark/lib/autolink.js
var autolink = {
  name: "autolink",
  tokenize: tokenizeAutolink
};
function tokenizeAutolink(effects, ok, nok) {
  let size = 0;
  return start;
  function start(code) {
    effects.enter("autolink");
    effects.enter("autolinkMarker");
    effects.consume(code);
    effects.exit("autolinkMarker");
    effects.enter("autolinkProtocol");
    return open11;
  }
  function open11(code) {
    if (asciiAlpha(code)) {
      effects.consume(code);
      return schemeOrEmailAtext;
    }
    if (code === 64) {
      return nok(code);
    }
    return emailAtext(code);
  }
  function schemeOrEmailAtext(code) {
    if (code === 43 || code === 45 || code === 46 || asciiAlphanumeric(code)) {
      size = 1;
      return schemeInsideOrEmailAtext(code);
    }
    return emailAtext(code);
  }
  function schemeInsideOrEmailAtext(code) {
    if (code === 58) {
      effects.consume(code);
      size = 0;
      return urlInside;
    }
    if ((code === 43 || code === 45 || code === 46 || asciiAlphanumeric(code)) && size++ < 32) {
      effects.consume(code);
      return schemeInsideOrEmailAtext;
    }
    size = 0;
    return emailAtext(code);
  }
  function urlInside(code) {
    if (code === 62) {
      effects.exit("autolinkProtocol");
      effects.enter("autolinkMarker");
      effects.consume(code);
      effects.exit("autolinkMarker");
      effects.exit("autolink");
      return ok;
    }
    if (code === null || code === 32 || code === 60 || asciiControl(code)) {
      return nok(code);
    }
    effects.consume(code);
    return urlInside;
  }
  function emailAtext(code) {
    if (code === 64) {
      effects.consume(code);
      return emailAtSignOrDot;
    }
    if (asciiAtext(code)) {
      effects.consume(code);
      return emailAtext;
    }
    return nok(code);
  }
  function emailAtSignOrDot(code) {
    return asciiAlphanumeric(code) ? emailLabel(code) : nok(code);
  }
  function emailLabel(code) {
    if (code === 46) {
      effects.consume(code);
      size = 0;
      return emailAtSignOrDot;
    }
    if (code === 62) {
      effects.exit("autolinkProtocol").type = "autolinkEmail";
      effects.enter("autolinkMarker");
      effects.consume(code);
      effects.exit("autolinkMarker");
      effects.exit("autolink");
      return ok;
    }
    return emailValue(code);
  }
  function emailValue(code) {
    if ((code === 45 || asciiAlphanumeric(code)) && size++ < 63) {
      const next = code === 45 ? emailValue : emailLabel;
      effects.consume(code);
      return next;
    }
    return nok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/blank-line.js
var blankLine = {
  partial: true,
  tokenize: tokenizeBlankLine
};
function tokenizeBlankLine(effects, ok, nok) {
  return start;
  function start(code) {
    return markdownSpace(code) ? factorySpace(effects, after, "linePrefix")(code) : after(code);
  }
  function after(code) {
    return code === null || markdownLineEnding(code) ? ok(code) : nok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/block-quote.js
var blockQuote = {
  continuation: {
    tokenize: tokenizeBlockQuoteContinuation
  },
  exit,
  name: "blockQuote",
  tokenize: tokenizeBlockQuoteStart
};
function tokenizeBlockQuoteStart(effects, ok, nok) {
  const self = this;
  return start;
  function start(code) {
    if (code === 62) {
      const state = self.containerState;
      if (!state.open) {
        effects.enter("blockQuote", {
          _container: true
        });
        state.open = true;
      }
      effects.enter("blockQuotePrefix");
      effects.enter("blockQuoteMarker");
      effects.consume(code);
      effects.exit("blockQuoteMarker");
      return after;
    }
    return nok(code);
  }
  function after(code) {
    if (markdownSpace(code)) {
      effects.enter("blockQuotePrefixWhitespace");
      effects.consume(code);
      effects.exit("blockQuotePrefixWhitespace");
      effects.exit("blockQuotePrefix");
      return ok;
    }
    effects.exit("blockQuotePrefix");
    return ok(code);
  }
}
function tokenizeBlockQuoteContinuation(effects, ok, nok) {
  const self = this;
  return contStart;
  function contStart(code) {
    if (markdownSpace(code)) {
      return factorySpace(effects, contBefore, "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code);
    }
    return contBefore(code);
  }
  function contBefore(code) {
    return effects.attempt(blockQuote, ok, nok)(code);
  }
}
function exit(effects) {
  effects.exit("blockQuote");
}

// node_modules/micromark-core-commonmark/lib/character-escape.js
var characterEscape = {
  name: "characterEscape",
  tokenize: tokenizeCharacterEscape
};
function tokenizeCharacterEscape(effects, ok, nok) {
  return start;
  function start(code) {
    effects.enter("characterEscape");
    effects.enter("escapeMarker");
    effects.consume(code);
    effects.exit("escapeMarker");
    return inside;
  }
  function inside(code) {
    if (asciiPunctuation(code)) {
      effects.enter("characterEscapeValue");
      effects.consume(code);
      effects.exit("characterEscapeValue");
      effects.exit("characterEscape");
      return ok;
    }
    return nok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/character-reference.js
var characterReference = {
  name: "characterReference",
  tokenize: tokenizeCharacterReference
};
function tokenizeCharacterReference(effects, ok, nok) {
  const self = this;
  let size = 0;
  let max;
  let test;
  return start;
  function start(code) {
    effects.enter("characterReference");
    effects.enter("characterReferenceMarker");
    effects.consume(code);
    effects.exit("characterReferenceMarker");
    return open11;
  }
  function open11(code) {
    if (code === 35) {
      effects.enter("characterReferenceMarkerNumeric");
      effects.consume(code);
      effects.exit("characterReferenceMarkerNumeric");
      return numeric;
    }
    effects.enter("characterReferenceValue");
    max = 31;
    test = asciiAlphanumeric;
    return value(code);
  }
  function numeric(code) {
    if (code === 88 || code === 120) {
      effects.enter("characterReferenceMarkerHexadecimal");
      effects.consume(code);
      effects.exit("characterReferenceMarkerHexadecimal");
      effects.enter("characterReferenceValue");
      max = 6;
      test = asciiHexDigit;
      return value;
    }
    effects.enter("characterReferenceValue");
    max = 7;
    test = asciiDigit;
    return value(code);
  }
  function value(code) {
    if (code === 59 && size) {
      const token = effects.exit("characterReferenceValue");
      if (test === asciiAlphanumeric && !decodeNamedCharacterReference(self.sliceSerialize(token))) {
        return nok(code);
      }
      effects.enter("characterReferenceMarker");
      effects.consume(code);
      effects.exit("characterReferenceMarker");
      effects.exit("characterReference");
      return ok;
    }
    if (test(code) && size++ < max) {
      effects.consume(code);
      return value;
    }
    return nok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/code-fenced.js
var nonLazyContinuation = {
  partial: true,
  tokenize: tokenizeNonLazyContinuation
};
var codeFenced = {
  concrete: true,
  name: "codeFenced",
  tokenize: tokenizeCodeFenced
};
function tokenizeCodeFenced(effects, ok, nok) {
  const self = this;
  const closeStart = {
    partial: true,
    tokenize: tokenizeCloseStart
  };
  let initialPrefix = 0;
  let sizeOpen = 0;
  let marker;
  return start;
  function start(code) {
    return beforeSequenceOpen(code);
  }
  function beforeSequenceOpen(code) {
    const tail = self.events[self.events.length - 1];
    initialPrefix = tail && tail[1].type === "linePrefix" ? tail[2].sliceSerialize(tail[1], true).length : 0;
    marker = code;
    effects.enter("codeFenced");
    effects.enter("codeFencedFence");
    effects.enter("codeFencedFenceSequence");
    return sequenceOpen(code);
  }
  function sequenceOpen(code) {
    if (code === marker) {
      sizeOpen++;
      effects.consume(code);
      return sequenceOpen;
    }
    if (sizeOpen < 3) {
      return nok(code);
    }
    effects.exit("codeFencedFenceSequence");
    return markdownSpace(code) ? factorySpace(effects, infoBefore, "whitespace")(code) : infoBefore(code);
  }
  function infoBefore(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit("codeFencedFence");
      return self.interrupt ? ok(code) : effects.check(nonLazyContinuation, atNonLazyBreak, after)(code);
    }
    effects.enter("codeFencedFenceInfo");
    effects.enter("chunkString", {
      contentType: "string"
    });
    return info(code);
  }
  function info(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit("chunkString");
      effects.exit("codeFencedFenceInfo");
      return infoBefore(code);
    }
    if (markdownSpace(code)) {
      effects.exit("chunkString");
      effects.exit("codeFencedFenceInfo");
      return factorySpace(effects, metaBefore, "whitespace")(code);
    }
    if (code === 96 && code === marker) {
      return nok(code);
    }
    effects.consume(code);
    return info;
  }
  function metaBefore(code) {
    if (code === null || markdownLineEnding(code)) {
      return infoBefore(code);
    }
    effects.enter("codeFencedFenceMeta");
    effects.enter("chunkString", {
      contentType: "string"
    });
    return meta(code);
  }
  function meta(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit("chunkString");
      effects.exit("codeFencedFenceMeta");
      return infoBefore(code);
    }
    if (code === 96 && code === marker) {
      return nok(code);
    }
    effects.consume(code);
    return meta;
  }
  function atNonLazyBreak(code) {
    return effects.attempt(closeStart, after, contentBefore)(code);
  }
  function contentBefore(code) {
    effects.enter("lineEnding");
    effects.consume(code);
    effects.exit("lineEnding");
    return contentStart;
  }
  function contentStart(code) {
    return initialPrefix > 0 && markdownSpace(code) ? factorySpace(effects, beforeContentChunk, "linePrefix", initialPrefix + 1)(code) : beforeContentChunk(code);
  }
  function beforeContentChunk(code) {
    if (code === null || markdownLineEnding(code)) {
      return effects.check(nonLazyContinuation, atNonLazyBreak, after)(code);
    }
    effects.enter("codeFlowValue");
    return contentChunk(code);
  }
  function contentChunk(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit("codeFlowValue");
      return beforeContentChunk(code);
    }
    effects.consume(code);
    return contentChunk;
  }
  function after(code) {
    effects.exit("codeFenced");
    return ok(code);
  }
  function tokenizeCloseStart(effects2, ok2, nok2) {
    let size = 0;
    return startBefore;
    function startBefore(code) {
      effects2.enter("lineEnding");
      effects2.consume(code);
      effects2.exit("lineEnding");
      return start2;
    }
    function start2(code) {
      effects2.enter("codeFencedFence");
      return markdownSpace(code) ? factorySpace(effects2, beforeSequenceClose, "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code) : beforeSequenceClose(code);
    }
    function beforeSequenceClose(code) {
      if (code === marker) {
        effects2.enter("codeFencedFenceSequence");
        return sequenceClose(code);
      }
      return nok2(code);
    }
    function sequenceClose(code) {
      if (code === marker) {
        size++;
        effects2.consume(code);
        return sequenceClose;
      }
      if (size >= sizeOpen) {
        effects2.exit("codeFencedFenceSequence");
        return markdownSpace(code) ? factorySpace(effects2, sequenceCloseAfter, "whitespace")(code) : sequenceCloseAfter(code);
      }
      return nok2(code);
    }
    function sequenceCloseAfter(code) {
      if (code === null || markdownLineEnding(code)) {
        effects2.exit("codeFencedFence");
        return ok2(code);
      }
      return nok2(code);
    }
  }
}
function tokenizeNonLazyContinuation(effects, ok, nok) {
  const self = this;
  return start;
  function start(code) {
    if (code === null) {
      return nok(code);
    }
    effects.enter("lineEnding");
    effects.consume(code);
    effects.exit("lineEnding");
    return lineStart;
  }
  function lineStart(code) {
    return self.parser.lazy[self.now().line] ? nok(code) : ok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/code-indented.js
var codeIndented = {
  name: "codeIndented",
  tokenize: tokenizeCodeIndented
};
var furtherStart = {
  partial: true,
  tokenize: tokenizeFurtherStart
};
function tokenizeCodeIndented(effects, ok, nok) {
  const self = this;
  return start;
  function start(code) {
    effects.enter("codeIndented");
    return factorySpace(effects, afterPrefix, "linePrefix", 4 + 1)(code);
  }
  function afterPrefix(code) {
    const tail = self.events[self.events.length - 1];
    return tail && tail[1].type === "linePrefix" && tail[2].sliceSerialize(tail[1], true).length >= 4 ? atBreak(code) : nok(code);
  }
  function atBreak(code) {
    if (code === null) {
      return after(code);
    }
    if (markdownLineEnding(code)) {
      return effects.attempt(furtherStart, atBreak, after)(code);
    }
    effects.enter("codeFlowValue");
    return inside(code);
  }
  function inside(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit("codeFlowValue");
      return atBreak(code);
    }
    effects.consume(code);
    return inside;
  }
  function after(code) {
    effects.exit("codeIndented");
    return ok(code);
  }
}
function tokenizeFurtherStart(effects, ok, nok) {
  const self = this;
  return furtherStart2;
  function furtherStart2(code) {
    if (self.parser.lazy[self.now().line]) {
      return nok(code);
    }
    if (markdownLineEnding(code)) {
      effects.enter("lineEnding");
      effects.consume(code);
      effects.exit("lineEnding");
      return furtherStart2;
    }
    return factorySpace(effects, afterPrefix, "linePrefix", 4 + 1)(code);
  }
  function afterPrefix(code) {
    const tail = self.events[self.events.length - 1];
    return tail && tail[1].type === "linePrefix" && tail[2].sliceSerialize(tail[1], true).length >= 4 ? ok(code) : markdownLineEnding(code) ? furtherStart2(code) : nok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/code-text.js
var codeText = {
  name: "codeText",
  previous,
  resolve: resolveCodeText,
  tokenize: tokenizeCodeText
};
function resolveCodeText(events) {
  let tailExitIndex = events.length - 4;
  let headEnterIndex = 3;
  let index2;
  let enter;
  if ((events[headEnterIndex][1].type === "lineEnding" || events[headEnterIndex][1].type === "space") && (events[tailExitIndex][1].type === "lineEnding" || events[tailExitIndex][1].type === "space")) {
    index2 = headEnterIndex;
    while (++index2 < tailExitIndex) {
      if (events[index2][1].type === "codeTextData") {
        events[headEnterIndex][1].type = "codeTextPadding";
        events[tailExitIndex][1].type = "codeTextPadding";
        headEnterIndex += 2;
        tailExitIndex -= 2;
        break;
      }
    }
  }
  index2 = headEnterIndex - 1;
  tailExitIndex++;
  while (++index2 <= tailExitIndex) {
    if (enter === void 0) {
      if (index2 !== tailExitIndex && events[index2][1].type !== "lineEnding") {
        enter = index2;
      }
    } else if (index2 === tailExitIndex || events[index2][1].type === "lineEnding") {
      events[enter][1].type = "codeTextData";
      if (index2 !== enter + 2) {
        events[enter][1].end = events[index2 - 1][1].end;
        events.splice(enter + 2, index2 - enter - 2);
        tailExitIndex -= index2 - enter - 2;
        index2 = enter + 2;
      }
      enter = void 0;
    }
  }
  return events;
}
function previous(code) {
  return code !== 96 || this.events[this.events.length - 1][1].type === "characterEscape";
}
function tokenizeCodeText(effects, ok, nok) {
  const self = this;
  let sizeOpen = 0;
  let size;
  let token;
  return start;
  function start(code) {
    effects.enter("codeText");
    effects.enter("codeTextSequence");
    return sequenceOpen(code);
  }
  function sequenceOpen(code) {
    if (code === 96) {
      effects.consume(code);
      sizeOpen++;
      return sequenceOpen;
    }
    effects.exit("codeTextSequence");
    return between(code);
  }
  function between(code) {
    if (code === null) {
      return nok(code);
    }
    if (code === 32) {
      effects.enter("space");
      effects.consume(code);
      effects.exit("space");
      return between;
    }
    if (code === 96) {
      token = effects.enter("codeTextSequence");
      size = 0;
      return sequenceClose(code);
    }
    if (markdownLineEnding(code)) {
      effects.enter("lineEnding");
      effects.consume(code);
      effects.exit("lineEnding");
      return between;
    }
    effects.enter("codeTextData");
    return data(code);
  }
  function data(code) {
    if (code === null || code === 32 || code === 96 || markdownLineEnding(code)) {
      effects.exit("codeTextData");
      return between(code);
    }
    effects.consume(code);
    return data;
  }
  function sequenceClose(code) {
    if (code === 96) {
      effects.consume(code);
      size++;
      return sequenceClose;
    }
    if (size === sizeOpen) {
      effects.exit("codeTextSequence");
      effects.exit("codeText");
      return ok(code);
    }
    token.type = "codeTextData";
    return data(code);
  }
}

// node_modules/micromark-util-subtokenize/lib/splice-buffer.js
var SpliceBuffer = class {
  /**
   * @param {ReadonlyArray<T> | null | undefined} [initial]
   *   Initial items (optional).
   * @returns
   *   Splice buffer.
   */
  constructor(initial) {
    this.left = initial ? [...initial] : [];
    this.right = [];
  }
  /**
   * Array access;
   * does not move the cursor.
   *
   * @param {number} index
   *   Index.
   * @return {T}
   *   Item.
   */
  get(index2) {
    if (index2 < 0 || index2 >= this.left.length + this.right.length) {
      throw new RangeError("Cannot access index `" + index2 + "` in a splice buffer of size `" + (this.left.length + this.right.length) + "`");
    }
    if (index2 < this.left.length) return this.left[index2];
    return this.right[this.right.length - index2 + this.left.length - 1];
  }
  /**
   * The length of the splice buffer, one greater than the largest index in the
   * array.
   */
  get length() {
    return this.left.length + this.right.length;
  }
  /**
   * Remove and return `list[0]`;
   * moves the cursor to `0`.
   *
   * @returns {T | undefined}
   *   Item, optional.
   */
  shift() {
    this.setCursor(0);
    return this.right.pop();
  }
  /**
   * Slice the buffer to get an array;
   * does not move the cursor.
   *
   * @param {number} start
   *   Start.
   * @param {number | null | undefined} [end]
   *   End (optional).
   * @returns {Array<T>}
   *   Array of items.
   */
  slice(start, end) {
    const stop = end === null || end === void 0 ? Number.POSITIVE_INFINITY : end;
    if (stop < this.left.length) {
      return this.left.slice(start, stop);
    }
    if (start > this.left.length) {
      return this.right.slice(this.right.length - stop + this.left.length, this.right.length - start + this.left.length).reverse();
    }
    return this.left.slice(start).concat(this.right.slice(this.right.length - stop + this.left.length).reverse());
  }
  /**
   * Mimics the behavior of Array.prototype.splice() except for the change of
   * interface necessary to avoid segfaults when patching in very large arrays.
   *
   * This operation moves cursor is moved to `start` and results in the cursor
   * placed after any inserted items.
   *
   * @param {number} start
   *   Start;
   *   zero-based index at which to start changing the array;
   *   negative numbers count backwards from the end of the array and values
   *   that are out-of bounds are clamped to the appropriate end of the array.
   * @param {number | null | undefined} [deleteCount=0]
   *   Delete count (default: `0`);
   *   maximum number of elements to delete, starting from start.
   * @param {Array<T> | null | undefined} [items=[]]
   *   Items to include in place of the deleted items (default: `[]`).
   * @return {Array<T>}
   *   Any removed items.
   */
  splice(start, deleteCount, items) {
    const count = deleteCount || 0;
    this.setCursor(Math.trunc(start));
    const removed = this.right.splice(this.right.length - count, Number.POSITIVE_INFINITY);
    if (items) chunkedPush(this.left, items);
    return removed.reverse();
  }
  /**
   * Remove and return the highest-numbered item in the array, so
   * `list[list.length - 1]`;
   * Moves the cursor to `length`.
   *
   * @returns {T | undefined}
   *   Item, optional.
   */
  pop() {
    this.setCursor(Number.POSITIVE_INFINITY);
    return this.left.pop();
  }
  /**
   * Inserts a single item to the high-numbered side of the array;
   * moves the cursor to `length`.
   *
   * @param {T} item
   *   Item.
   * @returns {undefined}
   *   Nothing.
   */
  push(item) {
    this.setCursor(Number.POSITIVE_INFINITY);
    this.left.push(item);
  }
  /**
   * Inserts many items to the high-numbered side of the array.
   * Moves the cursor to `length`.
   *
   * @param {Array<T>} items
   *   Items.
   * @returns {undefined}
   *   Nothing.
   */
  pushMany(items) {
    this.setCursor(Number.POSITIVE_INFINITY);
    chunkedPush(this.left, items);
  }
  /**
   * Inserts a single item to the low-numbered side of the array;
   * Moves the cursor to `0`.
   *
   * @param {T} item
   *   Item.
   * @returns {undefined}
   *   Nothing.
   */
  unshift(item) {
    this.setCursor(0);
    this.right.push(item);
  }
  /**
   * Inserts many items to the low-numbered side of the array;
   * moves the cursor to `0`.
   *
   * @param {Array<T>} items
   *   Items.
   * @returns {undefined}
   *   Nothing.
   */
  unshiftMany(items) {
    this.setCursor(0);
    chunkedPush(this.right, items.reverse());
  }
  /**
   * Move the cursor to a specific position in the array. Requires
   * time proportional to the distance moved.
   *
   * If `n < 0`, the cursor will end up at the beginning.
   * If `n > length`, the cursor will end up at the end.
   *
   * @param {number} n
   *   Position.
   * @return {undefined}
   *   Nothing.
   */
  setCursor(n) {
    if (n === this.left.length || n > this.left.length && this.right.length === 0 || n < 0 && this.left.length === 0) return;
    if (n < this.left.length) {
      const removed = this.left.splice(n, Number.POSITIVE_INFINITY);
      chunkedPush(this.right, removed.reverse());
    } else {
      const removed = this.right.splice(this.left.length + this.right.length - n, Number.POSITIVE_INFINITY);
      chunkedPush(this.left, removed.reverse());
    }
  }
};
function chunkedPush(list2, right) {
  let chunkStart = 0;
  if (right.length < 1e4) {
    list2.push(...right);
  } else {
    while (chunkStart < right.length) {
      list2.push(...right.slice(chunkStart, chunkStart + 1e4));
      chunkStart += 1e4;
    }
  }
}

// node_modules/micromark-util-subtokenize/index.js
function subtokenize(eventsArray) {
  const jumps = {};
  let index2 = -1;
  let event;
  let lineIndex;
  let otherIndex;
  let otherEvent;
  let parameters;
  let subevents;
  let more;
  const events = new SpliceBuffer(eventsArray);
  while (++index2 < events.length) {
    while (index2 in jumps) {
      index2 = jumps[index2];
    }
    event = events.get(index2);
    if (index2 && event[1].type === "chunkFlow" && events.get(index2 - 1)[1].type === "listItemPrefix") {
      subevents = event[1]._tokenizer.events;
      otherIndex = 0;
      if (otherIndex < subevents.length && subevents[otherIndex][1].type === "lineEndingBlank") {
        otherIndex += 2;
      }
      if (otherIndex < subevents.length && subevents[otherIndex][1].type === "content") {
        while (++otherIndex < subevents.length) {
          if (subevents[otherIndex][1].type === "content") {
            break;
          }
          if (subevents[otherIndex][1].type === "chunkText") {
            subevents[otherIndex][1]._isInFirstContentOfListItem = true;
            otherIndex++;
          }
        }
      }
    }
    if (event[0] === "enter") {
      if (event[1].contentType) {
        Object.assign(jumps, subcontent(events, index2));
        index2 = jumps[index2];
        more = true;
      }
    } else if (event[1]._container) {
      otherIndex = index2;
      lineIndex = void 0;
      while (otherIndex--) {
        otherEvent = events.get(otherIndex);
        if (otherEvent[1].type === "lineEnding" || otherEvent[1].type === "lineEndingBlank") {
          if (otherEvent[0] === "enter") {
            if (lineIndex) {
              events.get(lineIndex)[1].type = "lineEndingBlank";
            }
            otherEvent[1].type = "lineEnding";
            lineIndex = otherIndex;
          }
        } else if (otherEvent[1].type === "linePrefix" || otherEvent[1].type === "listItemIndent") {
        } else {
          break;
        }
      }
      if (lineIndex) {
        event[1].end = {
          ...events.get(lineIndex)[1].start
        };
        parameters = events.slice(lineIndex, index2);
        parameters.unshift(event);
        events.splice(lineIndex, index2 - lineIndex + 1, parameters);
      }
    }
  }
  splice(eventsArray, 0, Number.POSITIVE_INFINITY, events.slice(0));
  return !more;
}
function subcontent(events, eventIndex) {
  const token = events.get(eventIndex)[1];
  const context = events.get(eventIndex)[2];
  let startPosition = eventIndex - 1;
  const startPositions = [];
  let tokenizer = token._tokenizer;
  if (!tokenizer) {
    tokenizer = context.parser[token.contentType](token.start);
    if (token._contentTypeTextTrailing) {
      tokenizer._contentTypeTextTrailing = true;
    }
  }
  const childEvents = tokenizer.events;
  const jumps = [];
  const gaps = {};
  let stream;
  let previous2;
  let index2 = -1;
  let current = token;
  let adjust = 0;
  let start = 0;
  const breaks = [start];
  while (current) {
    while (events.get(++startPosition)[1] !== current) {
    }
    startPositions.push(startPosition);
    if (!current._tokenizer) {
      stream = context.sliceStream(current);
      if (!current.next) {
        stream.push(null);
      }
      if (previous2) {
        tokenizer.defineSkip(current.start);
      }
      if (current._isInFirstContentOfListItem) {
        tokenizer._gfmTasklistFirstContentOfListItem = true;
      }
      tokenizer.write(stream);
      if (current._isInFirstContentOfListItem) {
        tokenizer._gfmTasklistFirstContentOfListItem = void 0;
      }
    }
    previous2 = current;
    current = current.next;
  }
  current = token;
  while (++index2 < childEvents.length) {
    if (
      // Find a void token that includes a break.
      childEvents[index2][0] === "exit" && childEvents[index2 - 1][0] === "enter" && childEvents[index2][1].type === childEvents[index2 - 1][1].type && childEvents[index2][1].start.line !== childEvents[index2][1].end.line
    ) {
      start = index2 + 1;
      breaks.push(start);
      current._tokenizer = void 0;
      current.previous = void 0;
      current = current.next;
    }
  }
  tokenizer.events = [];
  if (current) {
    current._tokenizer = void 0;
    current.previous = void 0;
  } else {
    breaks.pop();
  }
  index2 = breaks.length;
  while (index2--) {
    const slice = childEvents.slice(breaks[index2], breaks[index2 + 1]);
    const start2 = startPositions.pop();
    jumps.push([start2, start2 + slice.length - 1]);
    events.splice(start2, 2, slice);
  }
  jumps.reverse();
  index2 = -1;
  while (++index2 < jumps.length) {
    gaps[adjust + jumps[index2][0]] = adjust + jumps[index2][1];
    adjust += jumps[index2][1] - jumps[index2][0] - 1;
  }
  return gaps;
}

// node_modules/micromark-core-commonmark/lib/content.js
var content2 = {
  resolve: resolveContent,
  tokenize: tokenizeContent
};
var continuationConstruct = {
  partial: true,
  tokenize: tokenizeContinuation
};
function resolveContent(events) {
  subtokenize(events);
  return events;
}
function tokenizeContent(effects, ok) {
  let previous2;
  return chunkStart;
  function chunkStart(code) {
    effects.enter("content");
    previous2 = effects.enter("chunkContent", {
      contentType: "content"
    });
    return chunkInside(code);
  }
  function chunkInside(code) {
    if (code === null) {
      return contentEnd(code);
    }
    if (markdownLineEnding(code)) {
      return effects.check(continuationConstruct, contentContinue, contentEnd)(code);
    }
    effects.consume(code);
    return chunkInside;
  }
  function contentEnd(code) {
    effects.exit("chunkContent");
    effects.exit("content");
    return ok(code);
  }
  function contentContinue(code) {
    effects.consume(code);
    effects.exit("chunkContent");
    previous2.next = effects.enter("chunkContent", {
      contentType: "content",
      previous: previous2
    });
    previous2 = previous2.next;
    return chunkInside;
  }
}
function tokenizeContinuation(effects, ok, nok) {
  const self = this;
  return startLookahead;
  function startLookahead(code) {
    effects.exit("chunkContent");
    effects.enter("lineEnding");
    effects.consume(code);
    effects.exit("lineEnding");
    return factorySpace(effects, prefixed, "linePrefix");
  }
  function prefixed(code) {
    if (code === null || markdownLineEnding(code)) {
      return nok(code);
    }
    const tail = self.events[self.events.length - 1];
    if (!self.parser.constructs.disable.null.includes("codeIndented") && tail && tail[1].type === "linePrefix" && tail[2].sliceSerialize(tail[1], true).length >= 4) {
      return ok(code);
    }
    return effects.interrupt(self.parser.constructs.flow, nok, ok)(code);
  }
}

// node_modules/micromark-factory-destination/index.js
function factoryDestination(effects, ok, nok, type, literalType, literalMarkerType, rawType, stringType, max) {
  const limit = max || Number.POSITIVE_INFINITY;
  let balance = 0;
  return start;
  function start(code) {
    if (code === 60) {
      effects.enter(type);
      effects.enter(literalType);
      effects.enter(literalMarkerType);
      effects.consume(code);
      effects.exit(literalMarkerType);
      return enclosedBefore;
    }
    if (code === null || code === 32 || code === 41 || asciiControl(code)) {
      return nok(code);
    }
    effects.enter(type);
    effects.enter(rawType);
    effects.enter(stringType);
    effects.enter("chunkString", {
      contentType: "string"
    });
    return raw(code);
  }
  function enclosedBefore(code) {
    if (code === 62) {
      effects.enter(literalMarkerType);
      effects.consume(code);
      effects.exit(literalMarkerType);
      effects.exit(literalType);
      effects.exit(type);
      return ok;
    }
    effects.enter(stringType);
    effects.enter("chunkString", {
      contentType: "string"
    });
    return enclosed(code);
  }
  function enclosed(code) {
    if (code === 62) {
      effects.exit("chunkString");
      effects.exit(stringType);
      return enclosedBefore(code);
    }
    if (code === null || code === 60 || markdownLineEnding(code)) {
      return nok(code);
    }
    effects.consume(code);
    return code === 92 ? enclosedEscape : enclosed;
  }
  function enclosedEscape(code) {
    if (code === 60 || code === 62 || code === 92) {
      effects.consume(code);
      return enclosed;
    }
    return enclosed(code);
  }
  function raw(code) {
    if (!balance && (code === null || code === 41 || markdownLineEndingOrSpace(code))) {
      effects.exit("chunkString");
      effects.exit(stringType);
      effects.exit(rawType);
      effects.exit(type);
      return ok(code);
    }
    if (balance < limit && code === 40) {
      effects.consume(code);
      balance++;
      return raw;
    }
    if (code === 41) {
      effects.consume(code);
      balance--;
      return raw;
    }
    if (code === null || code === 32 || code === 40 || asciiControl(code)) {
      return nok(code);
    }
    effects.consume(code);
    return code === 92 ? rawEscape : raw;
  }
  function rawEscape(code) {
    if (code === 40 || code === 41 || code === 92) {
      effects.consume(code);
      return raw;
    }
    return raw(code);
  }
}

// node_modules/micromark-factory-label/index.js
function factoryLabel(effects, ok, nok, type, markerType, stringType) {
  const self = this;
  let size = 0;
  let seen;
  return start;
  function start(code) {
    effects.enter(type);
    effects.enter(markerType);
    effects.consume(code);
    effects.exit(markerType);
    effects.enter(stringType);
    return atBreak;
  }
  function atBreak(code) {
    if (size > 999 || code === null || code === 91 || code === 93 && !seen || // To do: remove in the future once we’ve switched from
    // `micromark-extension-footnote` to `micromark-extension-gfm-footnote`,
    // which doesn’t need this.
    // Hidden footnotes hook.
    /* c8 ignore next 3 */
    code === 94 && !size && "_hiddenFootnoteSupport" in self.parser.constructs) {
      return nok(code);
    }
    if (code === 93) {
      effects.exit(stringType);
      effects.enter(markerType);
      effects.consume(code);
      effects.exit(markerType);
      effects.exit(type);
      return ok;
    }
    if (markdownLineEnding(code)) {
      effects.enter("lineEnding");
      effects.consume(code);
      effects.exit("lineEnding");
      return atBreak;
    }
    effects.enter("chunkString", {
      contentType: "string"
    });
    return labelInside(code);
  }
  function labelInside(code) {
    if (code === null || code === 91 || code === 93 || markdownLineEnding(code) || size++ > 999) {
      effects.exit("chunkString");
      return atBreak(code);
    }
    effects.consume(code);
    if (!seen) seen = !markdownSpace(code);
    return code === 92 ? labelEscape : labelInside;
  }
  function labelEscape(code) {
    if (code === 91 || code === 92 || code === 93) {
      effects.consume(code);
      size++;
      return labelInside;
    }
    return labelInside(code);
  }
}

// node_modules/micromark-factory-title/index.js
function factoryTitle(effects, ok, nok, type, markerType, stringType) {
  let marker;
  return start;
  function start(code) {
    if (code === 34 || code === 39 || code === 40) {
      effects.enter(type);
      effects.enter(markerType);
      effects.consume(code);
      effects.exit(markerType);
      marker = code === 40 ? 41 : code;
      return begin;
    }
    return nok(code);
  }
  function begin(code) {
    if (code === marker) {
      effects.enter(markerType);
      effects.consume(code);
      effects.exit(markerType);
      effects.exit(type);
      return ok;
    }
    effects.enter(stringType);
    return atBreak(code);
  }
  function atBreak(code) {
    if (code === marker) {
      effects.exit(stringType);
      return begin(marker);
    }
    if (code === null) {
      return nok(code);
    }
    if (markdownLineEnding(code)) {
      effects.enter("lineEnding");
      effects.consume(code);
      effects.exit("lineEnding");
      return factorySpace(effects, atBreak, "linePrefix");
    }
    effects.enter("chunkString", {
      contentType: "string"
    });
    return inside(code);
  }
  function inside(code) {
    if (code === marker || code === null || markdownLineEnding(code)) {
      effects.exit("chunkString");
      return atBreak(code);
    }
    effects.consume(code);
    return code === 92 ? escape : inside;
  }
  function escape(code) {
    if (code === marker || code === 92) {
      effects.consume(code);
      return inside;
    }
    return inside(code);
  }
}

// node_modules/micromark-factory-whitespace/index.js
function factoryWhitespace(effects, ok) {
  let seen;
  return start;
  function start(code) {
    if (markdownLineEnding(code)) {
      effects.enter("lineEnding");
      effects.consume(code);
      effects.exit("lineEnding");
      seen = true;
      return start;
    }
    if (markdownSpace(code)) {
      return factorySpace(effects, start, seen ? "linePrefix" : "lineSuffix")(code);
    }
    return ok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/definition.js
var definition = {
  name: "definition",
  tokenize: tokenizeDefinition
};
var titleBefore = {
  partial: true,
  tokenize: tokenizeTitleBefore
};
function tokenizeDefinition(effects, ok, nok) {
  const self = this;
  let identifier;
  return start;
  function start(code) {
    effects.enter("definition");
    return before(code);
  }
  function before(code) {
    return factoryLabel.call(
      self,
      effects,
      labelAfter,
      // Note: we don’t need to reset the way `markdown-rs` does.
      nok,
      "definitionLabel",
      "definitionLabelMarker",
      "definitionLabelString"
    )(code);
  }
  function labelAfter(code) {
    identifier = normalizeIdentifier(self.sliceSerialize(self.events[self.events.length - 1][1]).slice(1, -1));
    if (code === 58) {
      effects.enter("definitionMarker");
      effects.consume(code);
      effects.exit("definitionMarker");
      return markerAfter;
    }
    return nok(code);
  }
  function markerAfter(code) {
    return markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, destinationBefore)(code) : destinationBefore(code);
  }
  function destinationBefore(code) {
    return factoryDestination(
      effects,
      destinationAfter,
      // Note: we don’t need to reset the way `markdown-rs` does.
      nok,
      "definitionDestination",
      "definitionDestinationLiteral",
      "definitionDestinationLiteralMarker",
      "definitionDestinationRaw",
      "definitionDestinationString"
    )(code);
  }
  function destinationAfter(code) {
    return effects.attempt(titleBefore, after, after)(code);
  }
  function after(code) {
    return markdownSpace(code) ? factorySpace(effects, afterWhitespace, "whitespace")(code) : afterWhitespace(code);
  }
  function afterWhitespace(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit("definition");
      self.parser.defined.push(identifier);
      return ok(code);
    }
    return nok(code);
  }
}
function tokenizeTitleBefore(effects, ok, nok) {
  return titleBefore2;
  function titleBefore2(code) {
    return markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, beforeMarker)(code) : nok(code);
  }
  function beforeMarker(code) {
    return factoryTitle(effects, titleAfter, nok, "definitionTitle", "definitionTitleMarker", "definitionTitleString")(code);
  }
  function titleAfter(code) {
    return markdownSpace(code) ? factorySpace(effects, titleAfterOptionalWhitespace, "whitespace")(code) : titleAfterOptionalWhitespace(code);
  }
  function titleAfterOptionalWhitespace(code) {
    return code === null || markdownLineEnding(code) ? ok(code) : nok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/hard-break-escape.js
var hardBreakEscape = {
  name: "hardBreakEscape",
  tokenize: tokenizeHardBreakEscape
};
function tokenizeHardBreakEscape(effects, ok, nok) {
  return start;
  function start(code) {
    effects.enter("hardBreakEscape");
    effects.consume(code);
    return after;
  }
  function after(code) {
    if (markdownLineEnding(code)) {
      effects.exit("hardBreakEscape");
      return ok(code);
    }
    return nok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/heading-atx.js
var headingAtx = {
  name: "headingAtx",
  resolve: resolveHeadingAtx,
  tokenize: tokenizeHeadingAtx
};
function resolveHeadingAtx(events, context) {
  let contentEnd = events.length - 2;
  let contentStart = 3;
  let content3;
  let text3;
  if (events[contentStart][1].type === "whitespace") {
    contentStart += 2;
  }
  if (contentEnd - 2 > contentStart && events[contentEnd][1].type === "whitespace") {
    contentEnd -= 2;
  }
  if (events[contentEnd][1].type === "atxHeadingSequence" && (contentStart === contentEnd - 1 || contentEnd - 4 > contentStart && events[contentEnd - 2][1].type === "whitespace")) {
    contentEnd -= contentStart + 1 === contentEnd ? 2 : 4;
  }
  if (contentEnd > contentStart) {
    content3 = {
      type: "atxHeadingText",
      start: events[contentStart][1].start,
      end: events[contentEnd][1].end
    };
    text3 = {
      type: "chunkText",
      start: events[contentStart][1].start,
      end: events[contentEnd][1].end,
      contentType: "text"
    };
    splice(events, contentStart, contentEnd - contentStart + 1, [["enter", content3, context], ["enter", text3, context], ["exit", text3, context], ["exit", content3, context]]);
  }
  return events;
}
function tokenizeHeadingAtx(effects, ok, nok) {
  let size = 0;
  return start;
  function start(code) {
    effects.enter("atxHeading");
    return before(code);
  }
  function before(code) {
    effects.enter("atxHeadingSequence");
    return sequenceOpen(code);
  }
  function sequenceOpen(code) {
    if (code === 35 && size++ < 6) {
      effects.consume(code);
      return sequenceOpen;
    }
    if (code === null || markdownLineEndingOrSpace(code)) {
      effects.exit("atxHeadingSequence");
      return atBreak(code);
    }
    return nok(code);
  }
  function atBreak(code) {
    if (code === 35) {
      effects.enter("atxHeadingSequence");
      return sequenceFurther(code);
    }
    if (code === null || markdownLineEnding(code)) {
      effects.exit("atxHeading");
      return ok(code);
    }
    if (markdownSpace(code)) {
      return factorySpace(effects, atBreak, "whitespace")(code);
    }
    effects.enter("atxHeadingText");
    return data(code);
  }
  function sequenceFurther(code) {
    if (code === 35) {
      effects.consume(code);
      return sequenceFurther;
    }
    effects.exit("atxHeadingSequence");
    return atBreak(code);
  }
  function data(code) {
    if (code === null || code === 35 || markdownLineEndingOrSpace(code)) {
      effects.exit("atxHeadingText");
      return atBreak(code);
    }
    effects.consume(code);
    return data;
  }
}

// node_modules/micromark-util-html-tag-name/index.js
var htmlBlockNames = [
  "address",
  "article",
  "aside",
  "base",
  "basefont",
  "blockquote",
  "body",
  "caption",
  "center",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "frame",
  "frameset",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "iframe",
  "legend",
  "li",
  "link",
  "main",
  "menu",
  "menuitem",
  "nav",
  "noframes",
  "ol",
  "optgroup",
  "option",
  "p",
  "param",
  "search",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "track",
  "ul"
];
var htmlRawNames = ["pre", "script", "style", "textarea"];

// node_modules/micromark-core-commonmark/lib/html-flow.js
var htmlFlow = {
  concrete: true,
  name: "htmlFlow",
  resolveTo: resolveToHtmlFlow,
  tokenize: tokenizeHtmlFlow
};
var blankLineBefore = {
  partial: true,
  tokenize: tokenizeBlankLineBefore
};
var nonLazyContinuationStart = {
  partial: true,
  tokenize: tokenizeNonLazyContinuationStart
};
function resolveToHtmlFlow(events) {
  let index2 = events.length;
  while (index2--) {
    if (events[index2][0] === "enter" && events[index2][1].type === "htmlFlow") {
      break;
    }
  }
  if (index2 > 1 && events[index2 - 2][1].type === "linePrefix") {
    events[index2][1].start = events[index2 - 2][1].start;
    events[index2 + 1][1].start = events[index2 - 2][1].start;
    events.splice(index2 - 2, 2);
  }
  return events;
}
function tokenizeHtmlFlow(effects, ok, nok) {
  const self = this;
  let marker;
  let closingTag;
  let buffer;
  let index2;
  let markerB;
  return start;
  function start(code) {
    return before(code);
  }
  function before(code) {
    effects.enter("htmlFlow");
    effects.enter("htmlFlowData");
    effects.consume(code);
    return open11;
  }
  function open11(code) {
    if (code === 33) {
      effects.consume(code);
      return declarationOpen;
    }
    if (code === 47) {
      effects.consume(code);
      closingTag = true;
      return tagCloseStart;
    }
    if (code === 63) {
      effects.consume(code);
      marker = 3;
      return self.interrupt ? ok : continuationDeclarationInside;
    }
    if (asciiAlpha(code)) {
      effects.consume(code);
      buffer = String.fromCharCode(code);
      return tagName;
    }
    return nok(code);
  }
  function declarationOpen(code) {
    if (code === 45) {
      effects.consume(code);
      marker = 2;
      return commentOpenInside;
    }
    if (code === 91) {
      effects.consume(code);
      marker = 5;
      index2 = 0;
      return cdataOpenInside;
    }
    if (asciiAlpha(code)) {
      effects.consume(code);
      marker = 4;
      return self.interrupt ? ok : continuationDeclarationInside;
    }
    return nok(code);
  }
  function commentOpenInside(code) {
    if (code === 45) {
      effects.consume(code);
      return self.interrupt ? ok : continuationDeclarationInside;
    }
    return nok(code);
  }
  function cdataOpenInside(code) {
    const value = "CDATA[";
    if (code === value.charCodeAt(index2++)) {
      effects.consume(code);
      if (index2 === value.length) {
        return self.interrupt ? ok : continuation;
      }
      return cdataOpenInside;
    }
    return nok(code);
  }
  function tagCloseStart(code) {
    if (asciiAlpha(code)) {
      effects.consume(code);
      buffer = String.fromCharCode(code);
      return tagName;
    }
    return nok(code);
  }
  function tagName(code) {
    if (code === null || code === 47 || code === 62 || markdownLineEndingOrSpace(code)) {
      const slash = code === 47;
      const name = buffer.toLowerCase();
      if (!slash && !closingTag && htmlRawNames.includes(name)) {
        marker = 1;
        return self.interrupt ? ok(code) : continuation(code);
      }
      if (htmlBlockNames.includes(buffer.toLowerCase())) {
        marker = 6;
        if (slash) {
          effects.consume(code);
          return basicSelfClosing;
        }
        return self.interrupt ? ok(code) : continuation(code);
      }
      marker = 7;
      return self.interrupt && !self.parser.lazy[self.now().line] ? nok(code) : closingTag ? completeClosingTagAfter(code) : completeAttributeNameBefore(code);
    }
    if (code === 45 || asciiAlphanumeric(code)) {
      effects.consume(code);
      buffer += String.fromCharCode(code);
      return tagName;
    }
    return nok(code);
  }
  function basicSelfClosing(code) {
    if (code === 62) {
      effects.consume(code);
      return self.interrupt ? ok : continuation;
    }
    return nok(code);
  }
  function completeClosingTagAfter(code) {
    if (markdownSpace(code)) {
      effects.consume(code);
      return completeClosingTagAfter;
    }
    return completeEnd(code);
  }
  function completeAttributeNameBefore(code) {
    if (code === 47) {
      effects.consume(code);
      return completeEnd;
    }
    if (code === 58 || code === 95 || asciiAlpha(code)) {
      effects.consume(code);
      return completeAttributeName;
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return completeAttributeNameBefore;
    }
    return completeEnd(code);
  }
  function completeAttributeName(code) {
    if (code === 45 || code === 46 || code === 58 || code === 95 || asciiAlphanumeric(code)) {
      effects.consume(code);
      return completeAttributeName;
    }
    return completeAttributeNameAfter(code);
  }
  function completeAttributeNameAfter(code) {
    if (code === 61) {
      effects.consume(code);
      return completeAttributeValueBefore;
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return completeAttributeNameAfter;
    }
    return completeAttributeNameBefore(code);
  }
  function completeAttributeValueBefore(code) {
    if (code === null || code === 60 || code === 61 || code === 62 || code === 96) {
      return nok(code);
    }
    if (code === 34 || code === 39) {
      effects.consume(code);
      markerB = code;
      return completeAttributeValueQuoted;
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return completeAttributeValueBefore;
    }
    return completeAttributeValueUnquoted(code);
  }
  function completeAttributeValueQuoted(code) {
    if (code === markerB) {
      effects.consume(code);
      markerB = null;
      return completeAttributeValueQuotedAfter;
    }
    if (code === null || markdownLineEnding(code)) {
      return nok(code);
    }
    effects.consume(code);
    return completeAttributeValueQuoted;
  }
  function completeAttributeValueUnquoted(code) {
    if (code === null || code === 34 || code === 39 || code === 47 || code === 60 || code === 61 || code === 62 || code === 96 || markdownLineEndingOrSpace(code)) {
      return completeAttributeNameAfter(code);
    }
    effects.consume(code);
    return completeAttributeValueUnquoted;
  }
  function completeAttributeValueQuotedAfter(code) {
    if (code === 47 || code === 62 || markdownSpace(code)) {
      return completeAttributeNameBefore(code);
    }
    return nok(code);
  }
  function completeEnd(code) {
    if (code === 62) {
      effects.consume(code);
      return completeAfter;
    }
    return nok(code);
  }
  function completeAfter(code) {
    if (code === null || markdownLineEnding(code)) {
      return continuation(code);
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return completeAfter;
    }
    return nok(code);
  }
  function continuation(code) {
    if (code === 45 && marker === 2) {
      effects.consume(code);
      return continuationCommentInside;
    }
    if (code === 60 && marker === 1) {
      effects.consume(code);
      return continuationRawTagOpen;
    }
    if (code === 62 && marker === 4) {
      effects.consume(code);
      return continuationClose;
    }
    if (code === 63 && marker === 3) {
      effects.consume(code);
      return continuationDeclarationInside;
    }
    if (code === 93 && marker === 5) {
      effects.consume(code);
      return continuationCdataInside;
    }
    if (markdownLineEnding(code) && (marker === 6 || marker === 7)) {
      effects.exit("htmlFlowData");
      return effects.check(blankLineBefore, continuationAfter, continuationStart)(code);
    }
    if (code === null || markdownLineEnding(code)) {
      effects.exit("htmlFlowData");
      return continuationStart(code);
    }
    effects.consume(code);
    return continuation;
  }
  function continuationStart(code) {
    return effects.check(nonLazyContinuationStart, continuationStartNonLazy, continuationAfter)(code);
  }
  function continuationStartNonLazy(code) {
    effects.enter("lineEnding");
    effects.consume(code);
    effects.exit("lineEnding");
    return continuationBefore;
  }
  function continuationBefore(code) {
    if (code === null || markdownLineEnding(code)) {
      return continuationStart(code);
    }
    effects.enter("htmlFlowData");
    return continuation(code);
  }
  function continuationCommentInside(code) {
    if (code === 45) {
      effects.consume(code);
      return continuationDeclarationInside;
    }
    return continuation(code);
  }
  function continuationRawTagOpen(code) {
    if (code === 47) {
      effects.consume(code);
      buffer = "";
      return continuationRawEndTag;
    }
    return continuation(code);
  }
  function continuationRawEndTag(code) {
    if (code === 62) {
      const name = buffer.toLowerCase();
      if (htmlRawNames.includes(name)) {
        effects.consume(code);
        return continuationClose;
      }
      return continuation(code);
    }
    if (asciiAlpha(code) && buffer.length < 8) {
      effects.consume(code);
      buffer += String.fromCharCode(code);
      return continuationRawEndTag;
    }
    return continuation(code);
  }
  function continuationCdataInside(code) {
    if (code === 93) {
      effects.consume(code);
      return continuationDeclarationInside;
    }
    return continuation(code);
  }
  function continuationDeclarationInside(code) {
    if (code === 62) {
      effects.consume(code);
      return continuationClose;
    }
    if (code === 45 && marker === 2) {
      effects.consume(code);
      return continuationDeclarationInside;
    }
    return continuation(code);
  }
  function continuationClose(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit("htmlFlowData");
      return continuationAfter(code);
    }
    effects.consume(code);
    return continuationClose;
  }
  function continuationAfter(code) {
    effects.exit("htmlFlow");
    return ok(code);
  }
}
function tokenizeNonLazyContinuationStart(effects, ok, nok) {
  const self = this;
  return start;
  function start(code) {
    if (markdownLineEnding(code)) {
      effects.enter("lineEnding");
      effects.consume(code);
      effects.exit("lineEnding");
      return after;
    }
    return nok(code);
  }
  function after(code) {
    return self.parser.lazy[self.now().line] ? nok(code) : ok(code);
  }
}
function tokenizeBlankLineBefore(effects, ok, nok) {
  return start;
  function start(code) {
    effects.enter("lineEnding");
    effects.consume(code);
    effects.exit("lineEnding");
    return effects.attempt(blankLine, ok, nok);
  }
}

// node_modules/micromark-core-commonmark/lib/html-text.js
var htmlText = {
  name: "htmlText",
  tokenize: tokenizeHtmlText
};
function tokenizeHtmlText(effects, ok, nok) {
  const self = this;
  let marker;
  let index2;
  let returnState;
  return start;
  function start(code) {
    effects.enter("htmlText");
    effects.enter("htmlTextData");
    effects.consume(code);
    return open11;
  }
  function open11(code) {
    if (code === 33) {
      effects.consume(code);
      return declarationOpen;
    }
    if (code === 47) {
      effects.consume(code);
      return tagCloseStart;
    }
    if (code === 63) {
      effects.consume(code);
      return instruction;
    }
    if (asciiAlpha(code)) {
      effects.consume(code);
      return tagOpen;
    }
    return nok(code);
  }
  function declarationOpen(code) {
    if (code === 45) {
      effects.consume(code);
      return commentOpenInside;
    }
    if (code === 91) {
      effects.consume(code);
      index2 = 0;
      return cdataOpenInside;
    }
    if (asciiAlpha(code)) {
      effects.consume(code);
      return declaration;
    }
    return nok(code);
  }
  function commentOpenInside(code) {
    if (code === 45) {
      effects.consume(code);
      return commentEnd;
    }
    return nok(code);
  }
  function comment(code) {
    if (code === null) {
      return nok(code);
    }
    if (code === 45) {
      effects.consume(code);
      return commentClose;
    }
    if (markdownLineEnding(code)) {
      returnState = comment;
      return lineEndingBefore(code);
    }
    effects.consume(code);
    return comment;
  }
  function commentClose(code) {
    if (code === 45) {
      effects.consume(code);
      return commentEnd;
    }
    return comment(code);
  }
  function commentEnd(code) {
    return code === 62 ? end(code) : code === 45 ? commentClose(code) : comment(code);
  }
  function cdataOpenInside(code) {
    const value = "CDATA[";
    if (code === value.charCodeAt(index2++)) {
      effects.consume(code);
      return index2 === value.length ? cdata : cdataOpenInside;
    }
    return nok(code);
  }
  function cdata(code) {
    if (code === null) {
      return nok(code);
    }
    if (code === 93) {
      effects.consume(code);
      return cdataClose;
    }
    if (markdownLineEnding(code)) {
      returnState = cdata;
      return lineEndingBefore(code);
    }
    effects.consume(code);
    return cdata;
  }
  function cdataClose(code) {
    if (code === 93) {
      effects.consume(code);
      return cdataEnd;
    }
    return cdata(code);
  }
  function cdataEnd(code) {
    if (code === 62) {
      return end(code);
    }
    if (code === 93) {
      effects.consume(code);
      return cdataEnd;
    }
    return cdata(code);
  }
  function declaration(code) {
    if (code === null || code === 62) {
      return end(code);
    }
    if (markdownLineEnding(code)) {
      returnState = declaration;
      return lineEndingBefore(code);
    }
    effects.consume(code);
    return declaration;
  }
  function instruction(code) {
    if (code === null) {
      return nok(code);
    }
    if (code === 63) {
      effects.consume(code);
      return instructionClose;
    }
    if (markdownLineEnding(code)) {
      returnState = instruction;
      return lineEndingBefore(code);
    }
    effects.consume(code);
    return instruction;
  }
  function instructionClose(code) {
    return code === 62 ? end(code) : instruction(code);
  }
  function tagCloseStart(code) {
    if (asciiAlpha(code)) {
      effects.consume(code);
      return tagClose;
    }
    return nok(code);
  }
  function tagClose(code) {
    if (code === 45 || asciiAlphanumeric(code)) {
      effects.consume(code);
      return tagClose;
    }
    return tagCloseBetween(code);
  }
  function tagCloseBetween(code) {
    if (markdownLineEnding(code)) {
      returnState = tagCloseBetween;
      return lineEndingBefore(code);
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return tagCloseBetween;
    }
    return end(code);
  }
  function tagOpen(code) {
    if (code === 45 || asciiAlphanumeric(code)) {
      effects.consume(code);
      return tagOpen;
    }
    if (code === 47 || code === 62 || markdownLineEndingOrSpace(code)) {
      return tagOpenBetween(code);
    }
    return nok(code);
  }
  function tagOpenBetween(code) {
    if (code === 47) {
      effects.consume(code);
      return end;
    }
    if (code === 58 || code === 95 || asciiAlpha(code)) {
      effects.consume(code);
      return tagOpenAttributeName;
    }
    if (markdownLineEnding(code)) {
      returnState = tagOpenBetween;
      return lineEndingBefore(code);
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return tagOpenBetween;
    }
    return end(code);
  }
  function tagOpenAttributeName(code) {
    if (code === 45 || code === 46 || code === 58 || code === 95 || asciiAlphanumeric(code)) {
      effects.consume(code);
      return tagOpenAttributeName;
    }
    return tagOpenAttributeNameAfter(code);
  }
  function tagOpenAttributeNameAfter(code) {
    if (code === 61) {
      effects.consume(code);
      return tagOpenAttributeValueBefore;
    }
    if (markdownLineEnding(code)) {
      returnState = tagOpenAttributeNameAfter;
      return lineEndingBefore(code);
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return tagOpenAttributeNameAfter;
    }
    return tagOpenBetween(code);
  }
  function tagOpenAttributeValueBefore(code) {
    if (code === null || code === 60 || code === 61 || code === 62 || code === 96) {
      return nok(code);
    }
    if (code === 34 || code === 39) {
      effects.consume(code);
      marker = code;
      return tagOpenAttributeValueQuoted;
    }
    if (markdownLineEnding(code)) {
      returnState = tagOpenAttributeValueBefore;
      return lineEndingBefore(code);
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return tagOpenAttributeValueBefore;
    }
    effects.consume(code);
    return tagOpenAttributeValueUnquoted;
  }
  function tagOpenAttributeValueQuoted(code) {
    if (code === marker) {
      effects.consume(code);
      marker = void 0;
      return tagOpenAttributeValueQuotedAfter;
    }
    if (code === null) {
      return nok(code);
    }
    if (markdownLineEnding(code)) {
      returnState = tagOpenAttributeValueQuoted;
      return lineEndingBefore(code);
    }
    effects.consume(code);
    return tagOpenAttributeValueQuoted;
  }
  function tagOpenAttributeValueUnquoted(code) {
    if (code === null || code === 34 || code === 39 || code === 60 || code === 61 || code === 96) {
      return nok(code);
    }
    if (code === 47 || code === 62 || markdownLineEndingOrSpace(code)) {
      return tagOpenBetween(code);
    }
    effects.consume(code);
    return tagOpenAttributeValueUnquoted;
  }
  function tagOpenAttributeValueQuotedAfter(code) {
    if (code === 47 || code === 62 || markdownLineEndingOrSpace(code)) {
      return tagOpenBetween(code);
    }
    return nok(code);
  }
  function end(code) {
    if (code === 62) {
      effects.consume(code);
      effects.exit("htmlTextData");
      effects.exit("htmlText");
      return ok;
    }
    return nok(code);
  }
  function lineEndingBefore(code) {
    effects.exit("htmlTextData");
    effects.enter("lineEnding");
    effects.consume(code);
    effects.exit("lineEnding");
    return lineEndingAfter;
  }
  function lineEndingAfter(code) {
    return markdownSpace(code) ? factorySpace(effects, lineEndingAfterPrefix, "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code) : lineEndingAfterPrefix(code);
  }
  function lineEndingAfterPrefix(code) {
    effects.enter("htmlTextData");
    return returnState(code);
  }
}

// node_modules/micromark-core-commonmark/lib/label-end.js
var labelEnd = {
  name: "labelEnd",
  resolveAll: resolveAllLabelEnd,
  resolveTo: resolveToLabelEnd,
  tokenize: tokenizeLabelEnd
};
var resourceConstruct = {
  tokenize: tokenizeResource
};
var referenceFullConstruct = {
  tokenize: tokenizeReferenceFull
};
var referenceCollapsedConstruct = {
  tokenize: tokenizeReferenceCollapsed
};
function resolveAllLabelEnd(events) {
  let index2 = -1;
  const newEvents = [];
  while (++index2 < events.length) {
    const token = events[index2][1];
    newEvents.push(events[index2]);
    if (token.type === "labelImage" || token.type === "labelLink" || token.type === "labelEnd") {
      const offset = token.type === "labelImage" ? 4 : 2;
      token.type = "data";
      index2 += offset;
    }
  }
  if (events.length !== newEvents.length) {
    splice(events, 0, events.length, newEvents);
  }
  return events;
}
function resolveToLabelEnd(events, context) {
  let index2 = events.length;
  let offset = 0;
  let token;
  let open11;
  let close;
  let media;
  while (index2--) {
    token = events[index2][1];
    if (open11) {
      if (token.type === "link" || token.type === "labelLink" && token._inactive) {
        break;
      }
      if (events[index2][0] === "enter" && token.type === "labelLink") {
        token._inactive = true;
      }
    } else if (close) {
      if (events[index2][0] === "enter" && (token.type === "labelImage" || token.type === "labelLink") && !token._balanced) {
        open11 = index2;
        if (token.type !== "labelLink") {
          offset = 2;
          break;
        }
      }
    } else if (token.type === "labelEnd") {
      close = index2;
    }
  }
  const group = {
    type: events[open11][1].type === "labelLink" ? "link" : "image",
    start: {
      ...events[open11][1].start
    },
    end: {
      ...events[events.length - 1][1].end
    }
  };
  const label = {
    type: "label",
    start: {
      ...events[open11][1].start
    },
    end: {
      ...events[close][1].end
    }
  };
  const text3 = {
    type: "labelText",
    start: {
      ...events[open11 + offset + 2][1].end
    },
    end: {
      ...events[close - 2][1].start
    }
  };
  media = [["enter", group, context], ["enter", label, context]];
  media = push(media, events.slice(open11 + 1, open11 + offset + 3));
  media = push(media, [["enter", text3, context]]);
  media = push(media, resolveAll(context.parser.constructs.insideSpan.null, events.slice(open11 + offset + 4, close - 3), context));
  media = push(media, [["exit", text3, context], events[close - 2], events[close - 1], ["exit", label, context]]);
  media = push(media, events.slice(close + 1));
  media = push(media, [["exit", group, context]]);
  splice(events, open11, events.length, media);
  return events;
}
function tokenizeLabelEnd(effects, ok, nok) {
  const self = this;
  let index2 = self.events.length;
  let labelStart;
  let defined;
  while (index2--) {
    if ((self.events[index2][1].type === "labelImage" || self.events[index2][1].type === "labelLink") && !self.events[index2][1]._balanced) {
      labelStart = self.events[index2][1];
      break;
    }
  }
  return start;
  function start(code) {
    if (!labelStart) {
      return nok(code);
    }
    if (labelStart._inactive) {
      return labelEndNok(code);
    }
    defined = self.parser.defined.includes(normalizeIdentifier(self.sliceSerialize({
      start: labelStart.end,
      end: self.now()
    })));
    effects.enter("labelEnd");
    effects.enter("labelMarker");
    effects.consume(code);
    effects.exit("labelMarker");
    effects.exit("labelEnd");
    return after;
  }
  function after(code) {
    if (code === 40) {
      return effects.attempt(resourceConstruct, labelEndOk, defined ? labelEndOk : labelEndNok)(code);
    }
    if (code === 91) {
      return effects.attempt(referenceFullConstruct, labelEndOk, defined ? referenceNotFull : labelEndNok)(code);
    }
    return defined ? labelEndOk(code) : labelEndNok(code);
  }
  function referenceNotFull(code) {
    return effects.attempt(referenceCollapsedConstruct, labelEndOk, labelEndNok)(code);
  }
  function labelEndOk(code) {
    return ok(code);
  }
  function labelEndNok(code) {
    labelStart._balanced = true;
    return nok(code);
  }
}
function tokenizeResource(effects, ok, nok) {
  return resourceStart;
  function resourceStart(code) {
    effects.enter("resource");
    effects.enter("resourceMarker");
    effects.consume(code);
    effects.exit("resourceMarker");
    return resourceBefore;
  }
  function resourceBefore(code) {
    return markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, resourceOpen)(code) : resourceOpen(code);
  }
  function resourceOpen(code) {
    if (code === 41) {
      return resourceEnd(code);
    }
    return factoryDestination(effects, resourceDestinationAfter, resourceDestinationMissing, "resourceDestination", "resourceDestinationLiteral", "resourceDestinationLiteralMarker", "resourceDestinationRaw", "resourceDestinationString", 32)(code);
  }
  function resourceDestinationAfter(code) {
    return markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, resourceBetween)(code) : resourceEnd(code);
  }
  function resourceDestinationMissing(code) {
    return nok(code);
  }
  function resourceBetween(code) {
    if (code === 34 || code === 39 || code === 40) {
      return factoryTitle(effects, resourceTitleAfter, nok, "resourceTitle", "resourceTitleMarker", "resourceTitleString")(code);
    }
    return resourceEnd(code);
  }
  function resourceTitleAfter(code) {
    return markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, resourceEnd)(code) : resourceEnd(code);
  }
  function resourceEnd(code) {
    if (code === 41) {
      effects.enter("resourceMarker");
      effects.consume(code);
      effects.exit("resourceMarker");
      effects.exit("resource");
      return ok;
    }
    return nok(code);
  }
}
function tokenizeReferenceFull(effects, ok, nok) {
  const self = this;
  return referenceFull;
  function referenceFull(code) {
    return factoryLabel.call(self, effects, referenceFullAfter, referenceFullMissing, "reference", "referenceMarker", "referenceString")(code);
  }
  function referenceFullAfter(code) {
    return self.parser.defined.includes(normalizeIdentifier(self.sliceSerialize(self.events[self.events.length - 1][1]).slice(1, -1))) ? ok(code) : nok(code);
  }
  function referenceFullMissing(code) {
    return nok(code);
  }
}
function tokenizeReferenceCollapsed(effects, ok, nok) {
  return referenceCollapsedStart;
  function referenceCollapsedStart(code) {
    effects.enter("reference");
    effects.enter("referenceMarker");
    effects.consume(code);
    effects.exit("referenceMarker");
    return referenceCollapsedOpen;
  }
  function referenceCollapsedOpen(code) {
    if (code === 93) {
      effects.enter("referenceMarker");
      effects.consume(code);
      effects.exit("referenceMarker");
      effects.exit("reference");
      return ok;
    }
    return nok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/label-start-image.js
var labelStartImage = {
  name: "labelStartImage",
  resolveAll: labelEnd.resolveAll,
  tokenize: tokenizeLabelStartImage
};
function tokenizeLabelStartImage(effects, ok, nok) {
  const self = this;
  return start;
  function start(code) {
    effects.enter("labelImage");
    effects.enter("labelImageMarker");
    effects.consume(code);
    effects.exit("labelImageMarker");
    return open11;
  }
  function open11(code) {
    if (code === 91) {
      effects.enter("labelMarker");
      effects.consume(code);
      effects.exit("labelMarker");
      effects.exit("labelImage");
      return after;
    }
    return nok(code);
  }
  function after(code) {
    return code === 94 && "_hiddenFootnoteSupport" in self.parser.constructs ? nok(code) : ok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/label-start-link.js
var labelStartLink = {
  name: "labelStartLink",
  resolveAll: labelEnd.resolveAll,
  tokenize: tokenizeLabelStartLink
};
function tokenizeLabelStartLink(effects, ok, nok) {
  const self = this;
  return start;
  function start(code) {
    effects.enter("labelLink");
    effects.enter("labelMarker");
    effects.consume(code);
    effects.exit("labelMarker");
    effects.exit("labelLink");
    return after;
  }
  function after(code) {
    return code === 94 && "_hiddenFootnoteSupport" in self.parser.constructs ? nok(code) : ok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/line-ending.js
var lineEnding = {
  name: "lineEnding",
  tokenize: tokenizeLineEnding
};
function tokenizeLineEnding(effects, ok) {
  return start;
  function start(code) {
    effects.enter("lineEnding");
    effects.consume(code);
    effects.exit("lineEnding");
    return factorySpace(effects, ok, "linePrefix");
  }
}

// node_modules/micromark-core-commonmark/lib/thematic-break.js
var thematicBreak = {
  name: "thematicBreak",
  tokenize: tokenizeThematicBreak
};
function tokenizeThematicBreak(effects, ok, nok) {
  let size = 0;
  let marker;
  return start;
  function start(code) {
    effects.enter("thematicBreak");
    return before(code);
  }
  function before(code) {
    marker = code;
    return atBreak(code);
  }
  function atBreak(code) {
    if (code === marker) {
      effects.enter("thematicBreakSequence");
      return sequence(code);
    }
    if (size >= 3 && (code === null || markdownLineEnding(code))) {
      effects.exit("thematicBreak");
      return ok(code);
    }
    return nok(code);
  }
  function sequence(code) {
    if (code === marker) {
      effects.consume(code);
      size++;
      return sequence;
    }
    effects.exit("thematicBreakSequence");
    return markdownSpace(code) ? factorySpace(effects, atBreak, "whitespace")(code) : atBreak(code);
  }
}

// node_modules/micromark-core-commonmark/lib/list.js
var list = {
  continuation: {
    tokenize: tokenizeListContinuation
  },
  exit: tokenizeListEnd,
  name: "list",
  tokenize: tokenizeListStart
};
var listItemPrefixWhitespaceConstruct = {
  partial: true,
  tokenize: tokenizeListItemPrefixWhitespace
};
var indentConstruct = {
  partial: true,
  tokenize: tokenizeIndent
};
function tokenizeListStart(effects, ok, nok) {
  const self = this;
  const tail = self.events[self.events.length - 1];
  let initialSize = tail && tail[1].type === "linePrefix" ? tail[2].sliceSerialize(tail[1], true).length : 0;
  let size = 0;
  return start;
  function start(code) {
    const kind = self.containerState.type || (code === 42 || code === 43 || code === 45 ? "listUnordered" : "listOrdered");
    if (kind === "listUnordered" ? !self.containerState.marker || code === self.containerState.marker : asciiDigit(code)) {
      if (!self.containerState.type) {
        self.containerState.type = kind;
        effects.enter(kind, {
          _container: true
        });
      }
      if (kind === "listUnordered") {
        effects.enter("listItemPrefix");
        return code === 42 || code === 45 ? effects.check(thematicBreak, nok, atMarker)(code) : atMarker(code);
      }
      if (!self.interrupt || code === 49) {
        effects.enter("listItemPrefix");
        effects.enter("listItemValue");
        return inside(code);
      }
    }
    return nok(code);
  }
  function inside(code) {
    if (asciiDigit(code) && ++size < 10) {
      effects.consume(code);
      return inside;
    }
    if ((!self.interrupt || size < 2) && (self.containerState.marker ? code === self.containerState.marker : code === 41 || code === 46)) {
      effects.exit("listItemValue");
      return atMarker(code);
    }
    return nok(code);
  }
  function atMarker(code) {
    effects.enter("listItemMarker");
    effects.consume(code);
    effects.exit("listItemMarker");
    self.containerState.marker = self.containerState.marker || code;
    return effects.check(
      blankLine,
      // Can’t be empty when interrupting.
      self.interrupt ? nok : onBlank,
      effects.attempt(listItemPrefixWhitespaceConstruct, endOfPrefix, otherPrefix)
    );
  }
  function onBlank(code) {
    self.containerState.initialBlankLine = true;
    initialSize++;
    return endOfPrefix(code);
  }
  function otherPrefix(code) {
    if (markdownSpace(code)) {
      effects.enter("listItemPrefixWhitespace");
      effects.consume(code);
      effects.exit("listItemPrefixWhitespace");
      return endOfPrefix;
    }
    return nok(code);
  }
  function endOfPrefix(code) {
    self.containerState.size = initialSize + self.sliceSerialize(effects.exit("listItemPrefix"), true).length;
    return ok(code);
  }
}
function tokenizeListContinuation(effects, ok, nok) {
  const self = this;
  self.containerState._closeFlow = void 0;
  return effects.check(blankLine, onBlank, notBlank);
  function onBlank(code) {
    self.containerState.furtherBlankLines = self.containerState.furtherBlankLines || self.containerState.initialBlankLine;
    return factorySpace(effects, ok, "listItemIndent", self.containerState.size + 1)(code);
  }
  function notBlank(code) {
    if (self.containerState.furtherBlankLines || !markdownSpace(code)) {
      self.containerState.furtherBlankLines = void 0;
      self.containerState.initialBlankLine = void 0;
      return notInCurrentItem(code);
    }
    self.containerState.furtherBlankLines = void 0;
    self.containerState.initialBlankLine = void 0;
    return effects.attempt(indentConstruct, ok, notInCurrentItem)(code);
  }
  function notInCurrentItem(code) {
    self.containerState._closeFlow = true;
    self.interrupt = void 0;
    return factorySpace(effects, effects.attempt(list, ok, nok), "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code);
  }
}
function tokenizeIndent(effects, ok, nok) {
  const self = this;
  return factorySpace(effects, afterPrefix, "listItemIndent", self.containerState.size + 1);
  function afterPrefix(code) {
    const tail = self.events[self.events.length - 1];
    return tail && tail[1].type === "listItemIndent" && tail[2].sliceSerialize(tail[1], true).length === self.containerState.size ? ok(code) : nok(code);
  }
}
function tokenizeListEnd(effects) {
  effects.exit(this.containerState.type);
}
function tokenizeListItemPrefixWhitespace(effects, ok, nok) {
  const self = this;
  return factorySpace(effects, afterPrefix, "listItemPrefixWhitespace", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4 + 1);
  function afterPrefix(code) {
    const tail = self.events[self.events.length - 1];
    return !markdownSpace(code) && tail && tail[1].type === "listItemPrefixWhitespace" ? ok(code) : nok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/setext-underline.js
var setextUnderline = {
  name: "setextUnderline",
  resolveTo: resolveToSetextUnderline,
  tokenize: tokenizeSetextUnderline
};
function resolveToSetextUnderline(events, context) {
  let index2 = events.length;
  let content3;
  let text3;
  let definition2;
  while (index2--) {
    if (events[index2][0] === "enter") {
      if (events[index2][1].type === "content") {
        content3 = index2;
        break;
      }
      if (events[index2][1].type === "paragraph") {
        text3 = index2;
      }
    } else {
      if (events[index2][1].type === "content") {
        events.splice(index2, 1);
      }
      if (!definition2 && events[index2][1].type === "definition") {
        definition2 = index2;
      }
    }
  }
  const heading = {
    type: "setextHeading",
    start: {
      ...events[content3][1].start
    },
    end: {
      ...events[events.length - 1][1].end
    }
  };
  events[text3][1].type = "setextHeadingText";
  if (definition2) {
    events.splice(text3, 0, ["enter", heading, context]);
    events.splice(definition2 + 1, 0, ["exit", events[content3][1], context]);
    events[content3][1].end = {
      ...events[definition2][1].end
    };
  } else {
    events[content3][1] = heading;
  }
  events.push(["exit", heading, context]);
  return events;
}
function tokenizeSetextUnderline(effects, ok, nok) {
  const self = this;
  let marker;
  return start;
  function start(code) {
    let index2 = self.events.length;
    let paragraph;
    while (index2--) {
      if (self.events[index2][1].type !== "lineEnding" && self.events[index2][1].type !== "linePrefix" && self.events[index2][1].type !== "content") {
        paragraph = self.events[index2][1].type === "paragraph";
        break;
      }
    }
    if (!self.parser.lazy[self.now().line] && (self.interrupt || paragraph)) {
      effects.enter("setextHeadingLine");
      marker = code;
      return before(code);
    }
    return nok(code);
  }
  function before(code) {
    effects.enter("setextHeadingLineSequence");
    return inside(code);
  }
  function inside(code) {
    if (code === marker) {
      effects.consume(code);
      return inside;
    }
    effects.exit("setextHeadingLineSequence");
    return markdownSpace(code) ? factorySpace(effects, after, "lineSuffix")(code) : after(code);
  }
  function after(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit("setextHeadingLine");
      return ok(code);
    }
    return nok(code);
  }
}

// node_modules/micromark/lib/initialize/flow.js
var flow = {
  tokenize: initializeFlow
};
function initializeFlow(effects) {
  const self = this;
  const initial = effects.attempt(
    // Try to parse a blank line.
    blankLine,
    atBlankEnding,
    // Try to parse initial flow (essentially, only code).
    effects.attempt(this.parser.constructs.flowInitial, afterConstruct, factorySpace(effects, effects.attempt(this.parser.constructs.flow, afterConstruct, effects.attempt(content2, afterConstruct)), "linePrefix"))
  );
  return initial;
  function atBlankEnding(code) {
    if (code === null) {
      effects.consume(code);
      return;
    }
    effects.enter("lineEndingBlank");
    effects.consume(code);
    effects.exit("lineEndingBlank");
    self.currentConstruct = void 0;
    return initial;
  }
  function afterConstruct(code) {
    if (code === null) {
      effects.consume(code);
      return;
    }
    effects.enter("lineEnding");
    effects.consume(code);
    effects.exit("lineEnding");
    self.currentConstruct = void 0;
    return initial;
  }
}

// node_modules/micromark/lib/initialize/text.js
var resolver = {
  resolveAll: createResolver()
};
var string = initializeFactory("string");
var text = initializeFactory("text");
function initializeFactory(field) {
  return {
    resolveAll: createResolver(field === "text" ? resolveAllLineSuffixes : void 0),
    tokenize: initializeText
  };
  function initializeText(effects) {
    const self = this;
    const constructs2 = this.parser.constructs[field];
    const text3 = effects.attempt(constructs2, start, notText);
    return start;
    function start(code) {
      return atBreak(code) ? text3(code) : notText(code);
    }
    function notText(code) {
      if (code === null) {
        effects.consume(code);
        return;
      }
      effects.enter("data");
      effects.consume(code);
      return data;
    }
    function data(code) {
      if (atBreak(code)) {
        effects.exit("data");
        return text3(code);
      }
      effects.consume(code);
      return data;
    }
    function atBreak(code) {
      if (code === null) {
        return true;
      }
      const list2 = constructs2[code];
      let index2 = -1;
      if (list2) {
        while (++index2 < list2.length) {
          const item = list2[index2];
          if (!item.previous || item.previous.call(self, self.previous)) {
            return true;
          }
        }
      }
      return false;
    }
  }
}
function createResolver(extraResolver) {
  return resolveAllText;
  function resolveAllText(events, context) {
    let index2 = -1;
    let enter;
    while (++index2 <= events.length) {
      if (enter === void 0) {
        if (events[index2] && events[index2][1].type === "data") {
          enter = index2;
          index2++;
        }
      } else if (!events[index2] || events[index2][1].type !== "data") {
        if (index2 !== enter + 2) {
          events[enter][1].end = events[index2 - 1][1].end;
          events.splice(enter + 2, index2 - enter - 2);
          index2 = enter + 2;
        }
        enter = void 0;
      }
    }
    return extraResolver ? extraResolver(events, context) : events;
  }
}
function resolveAllLineSuffixes(events, context) {
  let eventIndex = 0;
  while (++eventIndex <= events.length) {
    if ((eventIndex === events.length || events[eventIndex][1].type === "lineEnding") && events[eventIndex - 1][1].type === "data") {
      const data = events[eventIndex - 1][1];
      const chunks = context.sliceStream(data);
      let index2 = chunks.length;
      let bufferIndex = -1;
      let size = 0;
      let tabs;
      while (index2--) {
        const chunk = chunks[index2];
        if (typeof chunk === "string") {
          bufferIndex = chunk.length;
          while (chunk.charCodeAt(bufferIndex - 1) === 32) {
            size++;
            bufferIndex--;
          }
          if (bufferIndex) break;
          bufferIndex = -1;
        } else if (chunk === -2) {
          tabs = true;
          size++;
        } else if (chunk === -1) {
        } else {
          index2++;
          break;
        }
      }
      if (context._contentTypeTextTrailing && eventIndex === events.length) {
        size = 0;
      }
      if (size) {
        const token = {
          type: eventIndex === events.length || tabs || size < 2 ? "lineSuffix" : "hardBreakTrailing",
          start: {
            _bufferIndex: index2 ? bufferIndex : data.start._bufferIndex + bufferIndex,
            _index: data.start._index + index2,
            line: data.end.line,
            column: data.end.column - size,
            offset: data.end.offset - size
          },
          end: {
            ...data.end
          }
        };
        data.end = {
          ...token.start
        };
        if (data.start.offset === data.end.offset) {
          Object.assign(data, token);
        } else {
          events.splice(eventIndex, 0, ["enter", token, context], ["exit", token, context]);
          eventIndex += 2;
        }
      }
      eventIndex++;
    }
  }
  return events;
}

// node_modules/micromark/lib/constructs.js
var constructs_exports = {};
__export(constructs_exports, {
  attentionMarkers: () => attentionMarkers,
  contentInitial: () => contentInitial,
  disable: () => disable,
  document: () => document2,
  flow: () => flow2,
  flowInitial: () => flowInitial,
  insideSpan: () => insideSpan,
  string: () => string2,
  text: () => text2
});
var document2 = {
  [42]: list,
  [43]: list,
  [45]: list,
  [48]: list,
  [49]: list,
  [50]: list,
  [51]: list,
  [52]: list,
  [53]: list,
  [54]: list,
  [55]: list,
  [56]: list,
  [57]: list,
  [62]: blockQuote
};
var contentInitial = {
  [91]: definition
};
var flowInitial = {
  [-2]: codeIndented,
  [-1]: codeIndented,
  [32]: codeIndented
};
var flow2 = {
  [35]: headingAtx,
  [42]: thematicBreak,
  [45]: [setextUnderline, thematicBreak],
  [60]: htmlFlow,
  [61]: setextUnderline,
  [95]: thematicBreak,
  [96]: codeFenced,
  [126]: codeFenced
};
var string2 = {
  [38]: characterReference,
  [92]: characterEscape
};
var text2 = {
  [-5]: lineEnding,
  [-4]: lineEnding,
  [-3]: lineEnding,
  [33]: labelStartImage,
  [38]: characterReference,
  [42]: attention,
  [60]: [autolink, htmlText],
  [91]: labelStartLink,
  [92]: [hardBreakEscape, characterEscape],
  [93]: labelEnd,
  [95]: attention,
  [96]: codeText
};
var insideSpan = {
  null: [attention, resolver]
};
var attentionMarkers = {
  null: [42, 95]
};
var disable = {
  null: []
};

// node_modules/micromark/lib/create-tokenizer.js
function createTokenizer(parser, initialize, from) {
  let point3 = {
    _bufferIndex: -1,
    _index: 0,
    line: from && from.line || 1,
    column: from && from.column || 1,
    offset: from && from.offset || 0
  };
  const columnStart = {};
  const resolveAllConstructs = [];
  let chunks = [];
  let stack = [];
  let consumed = true;
  const effects = {
    attempt: constructFactory(onsuccessfulconstruct),
    check: constructFactory(onsuccessfulcheck),
    consume,
    enter,
    exit: exit2,
    interrupt: constructFactory(onsuccessfulcheck, {
      interrupt: true
    })
  };
  const context = {
    code: null,
    containerState: {},
    defineSkip,
    events: [],
    now,
    parser,
    previous: null,
    sliceSerialize,
    sliceStream,
    write
  };
  let state = initialize.tokenize.call(context, effects);
  let expectedCode;
  if (initialize.resolveAll) {
    resolveAllConstructs.push(initialize);
  }
  return context;
  function write(slice) {
    chunks = push(chunks, slice);
    main();
    if (chunks[chunks.length - 1] !== null) {
      return [];
    }
    addResult(initialize, 0);
    context.events = resolveAll(resolveAllConstructs, context.events, context);
    return context.events;
  }
  function sliceSerialize(token, expandTabs) {
    return serializeChunks(sliceStream(token), expandTabs);
  }
  function sliceStream(token) {
    return sliceChunks(chunks, token);
  }
  function now() {
    const {
      _bufferIndex,
      _index,
      line,
      column,
      offset
    } = point3;
    return {
      _bufferIndex,
      _index,
      line,
      column,
      offset
    };
  }
  function defineSkip(value) {
    columnStart[value.line] = value.column;
    accountForPotentialSkip();
  }
  function main() {
    let chunkIndex;
    while (point3._index < chunks.length) {
      const chunk = chunks[point3._index];
      if (typeof chunk === "string") {
        chunkIndex = point3._index;
        if (point3._bufferIndex < 0) {
          point3._bufferIndex = 0;
        }
        while (point3._index === chunkIndex && point3._bufferIndex < chunk.length) {
          go(chunk.charCodeAt(point3._bufferIndex));
        }
      } else {
        go(chunk);
      }
    }
  }
  function go(code) {
    consumed = void 0;
    expectedCode = code;
    state = state(code);
  }
  function consume(code) {
    if (markdownLineEnding(code)) {
      point3.line++;
      point3.column = 1;
      point3.offset += code === -3 ? 2 : 1;
      accountForPotentialSkip();
    } else if (code !== -1) {
      point3.column++;
      point3.offset++;
    }
    if (point3._bufferIndex < 0) {
      point3._index++;
    } else {
      point3._bufferIndex++;
      if (point3._bufferIndex === // Points w/ non-negative `_bufferIndex` reference
      // strings.
      /** @type {string} */
      chunks[point3._index].length) {
        point3._bufferIndex = -1;
        point3._index++;
      }
    }
    context.previous = code;
    consumed = true;
  }
  function enter(type, fields) {
    const token = fields || {};
    token.type = type;
    token.start = now();
    context.events.push(["enter", token, context]);
    stack.push(token);
    return token;
  }
  function exit2(type) {
    const token = stack.pop();
    token.end = now();
    context.events.push(["exit", token, context]);
    return token;
  }
  function onsuccessfulconstruct(construct, info) {
    addResult(construct, info.from);
  }
  function onsuccessfulcheck(_, info) {
    info.restore();
  }
  function constructFactory(onreturn, fields) {
    return hook;
    function hook(constructs2, returnState, bogusState) {
      let listOfConstructs;
      let constructIndex;
      let currentConstruct;
      let info;
      return Array.isArray(constructs2) ? (
        /* c8 ignore next 1 */
        handleListOfConstructs(constructs2)
      ) : "tokenize" in constructs2 ? (
        // Looks like a construct.
        handleListOfConstructs([
          /** @type {Construct} */
          constructs2
        ])
      ) : handleMapOfConstructs(constructs2);
      function handleMapOfConstructs(map) {
        return start;
        function start(code) {
          const left = code !== null && map[code];
          const all2 = code !== null && map.null;
          const list2 = [
            // To do: add more extension tests.
            /* c8 ignore next 2 */
            ...Array.isArray(left) ? left : left ? [left] : [],
            ...Array.isArray(all2) ? all2 : all2 ? [all2] : []
          ];
          return handleListOfConstructs(list2)(code);
        }
      }
      function handleListOfConstructs(list2) {
        listOfConstructs = list2;
        constructIndex = 0;
        if (list2.length === 0) {
          return bogusState;
        }
        return handleConstruct(list2[constructIndex]);
      }
      function handleConstruct(construct) {
        return start;
        function start(code) {
          info = store();
          currentConstruct = construct;
          if (!construct.partial) {
            context.currentConstruct = construct;
          }
          if (construct.name && context.parser.constructs.disable.null.includes(construct.name)) {
            return nok(code);
          }
          return construct.tokenize.call(
            // If we do have fields, create an object w/ `context` as its
            // prototype.
            // This allows a “live binding”, which is needed for `interrupt`.
            fields ? Object.assign(Object.create(context), fields) : context,
            effects,
            ok,
            nok
          )(code);
        }
      }
      function ok(code) {
        consumed = true;
        onreturn(currentConstruct, info);
        return returnState;
      }
      function nok(code) {
        consumed = true;
        info.restore();
        if (++constructIndex < listOfConstructs.length) {
          return handleConstruct(listOfConstructs[constructIndex]);
        }
        return bogusState;
      }
    }
  }
  function addResult(construct, from2) {
    if (construct.resolveAll && !resolveAllConstructs.includes(construct)) {
      resolveAllConstructs.push(construct);
    }
    if (construct.resolve) {
      splice(context.events, from2, context.events.length - from2, construct.resolve(context.events.slice(from2), context));
    }
    if (construct.resolveTo) {
      context.events = construct.resolveTo(context.events, context);
    }
  }
  function store() {
    const startPoint = now();
    const startPrevious = context.previous;
    const startCurrentConstruct = context.currentConstruct;
    const startEventsIndex = context.events.length;
    const startStack = Array.from(stack);
    return {
      from: startEventsIndex,
      restore
    };
    function restore() {
      point3 = startPoint;
      context.previous = startPrevious;
      context.currentConstruct = startCurrentConstruct;
      context.events.length = startEventsIndex;
      stack = startStack;
      accountForPotentialSkip();
    }
  }
  function accountForPotentialSkip() {
    if (point3.line in columnStart && point3.column < 2) {
      point3.column = columnStart[point3.line];
      point3.offset += columnStart[point3.line] - 1;
    }
  }
}
function sliceChunks(chunks, token) {
  const startIndex = token.start._index;
  const startBufferIndex = token.start._bufferIndex;
  const endIndex = token.end._index;
  const endBufferIndex = token.end._bufferIndex;
  let view;
  if (startIndex === endIndex) {
    view = [chunks[startIndex].slice(startBufferIndex, endBufferIndex)];
  } else {
    view = chunks.slice(startIndex, endIndex);
    if (startBufferIndex > -1) {
      const head = view[0];
      if (typeof head === "string") {
        view[0] = head.slice(startBufferIndex);
      } else {
        view.shift();
      }
    }
    if (endBufferIndex > 0) {
      view.push(chunks[endIndex].slice(0, endBufferIndex));
    }
  }
  return view;
}
function serializeChunks(chunks, expandTabs) {
  let index2 = -1;
  const result = [];
  let atTab;
  while (++index2 < chunks.length) {
    const chunk = chunks[index2];
    let value;
    if (typeof chunk === "string") {
      value = chunk;
    } else switch (chunk) {
      case -5: {
        value = "\r";
        break;
      }
      case -4: {
        value = "\n";
        break;
      }
      case -3: {
        value = "\r\n";
        break;
      }
      case -2: {
        value = expandTabs ? " " : "	";
        break;
      }
      case -1: {
        if (!expandTabs && atTab) continue;
        value = " ";
        break;
      }
      default: {
        value = String.fromCharCode(chunk);
      }
    }
    atTab = chunk === -2;
    result.push(value);
  }
  return result.join("");
}

// node_modules/micromark/lib/parse.js
function parse2(options) {
  const settings = options || {};
  const constructs2 = (
    /** @type {FullNormalizedExtension} */
    combineExtensions([constructs_exports, ...settings.extensions || []])
  );
  const parser = {
    constructs: constructs2,
    content: create(content),
    defined: [],
    document: create(document),
    flow: create(flow),
    lazy: {},
    string: create(string),
    text: create(text)
  };
  return parser;
  function create(initial) {
    return creator;
    function creator(from) {
      return createTokenizer(parser, initial, from);
    }
  }
}

// node_modules/micromark/lib/postprocess.js
function postprocess(events) {
  while (!subtokenize(events)) {
  }
  return events;
}

// node_modules/micromark/lib/preprocess.js
var search = /[\0\t\n\r]/g;
function preprocess() {
  let column = 1;
  let buffer = "";
  let start = true;
  let atCarriageReturn;
  return preprocessor;
  function preprocessor(value, encoding, end) {
    const chunks = [];
    let match;
    let next;
    let startPosition;
    let endPosition;
    let code;
    value = buffer + (typeof value === "string" ? value.toString() : new TextDecoder(encoding || void 0).decode(value));
    startPosition = 0;
    buffer = "";
    if (start) {
      if (value.charCodeAt(0) === 65279) {
        startPosition++;
      }
      start = void 0;
    }
    while (startPosition < value.length) {
      search.lastIndex = startPosition;
      match = search.exec(value);
      endPosition = match && match.index !== void 0 ? match.index : value.length;
      code = value.charCodeAt(endPosition);
      if (!match) {
        buffer = value.slice(startPosition);
        break;
      }
      if (code === 10 && startPosition === endPosition && atCarriageReturn) {
        chunks.push(-3);
        atCarriageReturn = void 0;
      } else {
        if (atCarriageReturn) {
          chunks.push(-5);
          atCarriageReturn = void 0;
        }
        if (startPosition < endPosition) {
          chunks.push(value.slice(startPosition, endPosition));
          column += endPosition - startPosition;
        }
        switch (code) {
          case 0: {
            chunks.push(65533);
            column++;
            break;
          }
          case 9: {
            next = Math.ceil(column / 4) * 4;
            chunks.push(-2);
            while (column++ < next) chunks.push(-1);
            break;
          }
          case 10: {
            chunks.push(-4);
            column = 1;
            break;
          }
          default: {
            atCarriageReturn = true;
            column = 1;
          }
        }
      }
      startPosition = endPosition + 1;
    }
    if (end) {
      if (atCarriageReturn) chunks.push(-5);
      if (buffer) chunks.push(buffer);
      chunks.push(null);
    }
    return chunks;
  }
}

// node_modules/micromark-util-decode-string/index.js
var characterEscapeOrReference = /\\([!-/:-@[-`{-~])|&(#(?:\d{1,7}|x[\da-f]{1,6})|[\da-z]{1,31});/gi;
function decodeString(value) {
  return value.replace(characterEscapeOrReference, decode);
}
function decode($0, $1, $2) {
  if ($1) {
    return $1;
  }
  const head = $2.charCodeAt(0);
  if (head === 35) {
    const head2 = $2.charCodeAt(1);
    const hex = head2 === 120 || head2 === 88;
    return decodeNumericCharacterReference($2.slice(hex ? 2 : 1), hex ? 16 : 10);
  }
  return decodeNamedCharacterReference($2) || $0;
}

// node_modules/unist-util-stringify-position/lib/index.js
function stringifyPosition(value) {
  if (!value || typeof value !== "object") {
    return "";
  }
  if ("position" in value || "type" in value) {
    return position(value.position);
  }
  if ("start" in value || "end" in value) {
    return position(value);
  }
  if ("line" in value || "column" in value) {
    return point(value);
  }
  return "";
}
function point(point3) {
  return index(point3 && point3.line) + ":" + index(point3 && point3.column);
}
function position(pos) {
  return point(pos && pos.start) + "-" + point(pos && pos.end);
}
function index(value) {
  return value && typeof value === "number" ? value : 1;
}

// node_modules/mdast-util-from-markdown/lib/index.js
var own2 = {}.hasOwnProperty;
function fromMarkdown(value, encoding, options) {
  if (encoding && typeof encoding === "object") {
    options = encoding;
    encoding = void 0;
  }
  return compiler(options)(postprocess(parse2(options).document().write(preprocess()(value, encoding, true))));
}
function compiler(options) {
  const config = {
    transforms: [],
    canContainEols: ["emphasis", "fragment", "heading", "paragraph", "strong"],
    enter: {
      autolink: opener(link6),
      autolinkProtocol: onenterdata,
      autolinkEmail: onenterdata,
      atxHeading: opener(heading),
      blockQuote: opener(blockQuote2),
      characterEscape: onenterdata,
      characterReference: onenterdata,
      codeFenced: opener(codeFlow),
      codeFencedFenceInfo: buffer,
      codeFencedFenceMeta: buffer,
      codeIndented: opener(codeFlow, buffer),
      codeText: opener(codeText2, buffer),
      codeTextData: onenterdata,
      data: onenterdata,
      codeFlowValue: onenterdata,
      definition: opener(definition2),
      definitionDestinationString: buffer,
      definitionLabelString: buffer,
      definitionTitleString: buffer,
      emphasis: opener(emphasis),
      hardBreakEscape: opener(hardBreak),
      hardBreakTrailing: opener(hardBreak),
      htmlFlow: opener(html, buffer),
      htmlFlowData: onenterdata,
      htmlText: opener(html, buffer),
      htmlTextData: onenterdata,
      image: opener(image),
      label: buffer,
      link: opener(link6),
      listItem: opener(listItem),
      listItemValue: onenterlistitemvalue,
      listOrdered: opener(list2, onenterlistordered),
      listUnordered: opener(list2),
      paragraph: opener(paragraph),
      reference: onenterreference,
      referenceString: buffer,
      resourceDestinationString: buffer,
      resourceTitleString: buffer,
      setextHeading: opener(heading),
      strong: opener(strong),
      thematicBreak: opener(thematicBreak2)
    },
    exit: {
      atxHeading: closer(),
      atxHeadingSequence: onexitatxheadingsequence,
      autolink: closer(),
      autolinkEmail: onexitautolinkemail,
      autolinkProtocol: onexitautolinkprotocol,
      blockQuote: closer(),
      characterEscapeValue: onexitdata,
      characterReferenceMarkerHexadecimal: onexitcharacterreferencemarker,
      characterReferenceMarkerNumeric: onexitcharacterreferencemarker,
      characterReferenceValue: onexitcharacterreferencevalue,
      characterReference: onexitcharacterreference,
      codeFenced: closer(onexitcodefenced),
      codeFencedFence: onexitcodefencedfence,
      codeFencedFenceInfo: onexitcodefencedfenceinfo,
      codeFencedFenceMeta: onexitcodefencedfencemeta,
      codeFlowValue: onexitdata,
      codeIndented: closer(onexitcodeindented),
      codeText: closer(onexitcodetext),
      codeTextData: onexitdata,
      data: onexitdata,
      definition: closer(),
      definitionDestinationString: onexitdefinitiondestinationstring,
      definitionLabelString: onexitdefinitionlabelstring,
      definitionTitleString: onexitdefinitiontitlestring,
      emphasis: closer(),
      hardBreakEscape: closer(onexithardbreak),
      hardBreakTrailing: closer(onexithardbreak),
      htmlFlow: closer(onexithtmlflow),
      htmlFlowData: onexitdata,
      htmlText: closer(onexithtmltext),
      htmlTextData: onexitdata,
      image: closer(onexitimage),
      label: onexitlabel,
      labelText: onexitlabeltext,
      lineEnding: onexitlineending,
      link: closer(onexitlink),
      listItem: closer(),
      listOrdered: closer(),
      listUnordered: closer(),
      paragraph: closer(),
      referenceString: onexitreferencestring,
      resourceDestinationString: onexitresourcedestinationstring,
      resourceTitleString: onexitresourcetitlestring,
      resource: onexitresource,
      setextHeading: closer(onexitsetextheading),
      setextHeadingLineSequence: onexitsetextheadinglinesequence,
      setextHeadingText: onexitsetextheadingtext,
      strong: closer(),
      thematicBreak: closer()
    }
  };
  configure(config, (options || {}).mdastExtensions || []);
  const data = {};
  return compile;
  function compile(events) {
    let tree = {
      type: "root",
      children: []
    };
    const context = {
      stack: [tree],
      tokenStack: [],
      config,
      enter,
      exit: exit2,
      buffer,
      resume,
      data
    };
    const listStack = [];
    let index2 = -1;
    while (++index2 < events.length) {
      if (events[index2][1].type === "listOrdered" || events[index2][1].type === "listUnordered") {
        if (events[index2][0] === "enter") {
          listStack.push(index2);
        } else {
          const tail = listStack.pop();
          index2 = prepareList(events, tail, index2);
        }
      }
    }
    index2 = -1;
    while (++index2 < events.length) {
      const handler = config[events[index2][0]];
      if (own2.call(handler, events[index2][1].type)) {
        handler[events[index2][1].type].call(Object.assign({
          sliceSerialize: events[index2][2].sliceSerialize
        }, context), events[index2][1]);
      }
    }
    if (context.tokenStack.length > 0) {
      const tail = context.tokenStack[context.tokenStack.length - 1];
      const handler = tail[1] || defaultOnError;
      handler.call(context, void 0, tail[0]);
    }
    tree.position = {
      start: point2(events.length > 0 ? events[0][1].start : {
        line: 1,
        column: 1,
        offset: 0
      }),
      end: point2(events.length > 0 ? events[events.length - 2][1].end : {
        line: 1,
        column: 1,
        offset: 0
      })
    };
    index2 = -1;
    while (++index2 < config.transforms.length) {
      tree = config.transforms[index2](tree) || tree;
    }
    return tree;
  }
  function prepareList(events, start, length) {
    let index2 = start - 1;
    let containerBalance = -1;
    let listSpread = false;
    let listItem2;
    let lineIndex;
    let firstBlankLineIndex;
    let atMarker;
    while (++index2 <= length) {
      const event = events[index2];
      switch (event[1].type) {
        case "listUnordered":
        case "listOrdered":
        case "blockQuote": {
          if (event[0] === "enter") {
            containerBalance++;
          } else {
            containerBalance--;
          }
          atMarker = void 0;
          break;
        }
        case "lineEndingBlank": {
          if (event[0] === "enter") {
            if (listItem2 && !atMarker && !containerBalance && !firstBlankLineIndex) {
              firstBlankLineIndex = index2;
            }
            atMarker = void 0;
          }
          break;
        }
        case "linePrefix":
        case "listItemValue":
        case "listItemMarker":
        case "listItemPrefix":
        case "listItemPrefixWhitespace": {
          break;
        }
        default: {
          atMarker = void 0;
        }
      }
      if (!containerBalance && event[0] === "enter" && event[1].type === "listItemPrefix" || containerBalance === -1 && event[0] === "exit" && (event[1].type === "listUnordered" || event[1].type === "listOrdered")) {
        if (listItem2) {
          let tailIndex = index2;
          lineIndex = void 0;
          while (tailIndex--) {
            const tailEvent = events[tailIndex];
            if (tailEvent[1].type === "lineEnding" || tailEvent[1].type === "lineEndingBlank") {
              if (tailEvent[0] === "exit") continue;
              if (lineIndex) {
                events[lineIndex][1].type = "lineEndingBlank";
                listSpread = true;
              }
              tailEvent[1].type = "lineEnding";
              lineIndex = tailIndex;
            } else if (tailEvent[1].type === "linePrefix" || tailEvent[1].type === "blockQuotePrefix" || tailEvent[1].type === "blockQuotePrefixWhitespace" || tailEvent[1].type === "blockQuoteMarker" || tailEvent[1].type === "listItemIndent") {
            } else {
              break;
            }
          }
          if (firstBlankLineIndex && (!lineIndex || firstBlankLineIndex < lineIndex)) {
            listItem2._spread = true;
          }
          listItem2.end = Object.assign({}, lineIndex ? events[lineIndex][1].start : event[1].end);
          events.splice(lineIndex || index2, 0, ["exit", listItem2, event[2]]);
          index2++;
          length++;
        }
        if (event[1].type === "listItemPrefix") {
          const item = {
            type: "listItem",
            _spread: false,
            start: Object.assign({}, event[1].start),
            // @ts-expect-error: we’ll add `end` in a second.
            end: void 0
          };
          listItem2 = item;
          events.splice(index2, 0, ["enter", item, event[2]]);
          index2++;
          length++;
          firstBlankLineIndex = void 0;
          atMarker = true;
        }
      }
    }
    events[start][1]._spread = listSpread;
    return length;
  }
  function opener(create, and) {
    return open11;
    function open11(token) {
      enter.call(this, create(token), token);
      if (and) and.call(this, token);
    }
  }
  function buffer() {
    this.stack.push({
      type: "fragment",
      children: []
    });
  }
  function enter(node2, token, errorHandler) {
    const parent = this.stack[this.stack.length - 1];
    const siblings = parent.children;
    siblings.push(node2);
    this.stack.push(node2);
    this.tokenStack.push([token, errorHandler || void 0]);
    node2.position = {
      start: point2(token.start),
      // @ts-expect-error: `end` will be patched later.
      end: void 0
    };
  }
  function closer(and) {
    return close;
    function close(token) {
      if (and) and.call(this, token);
      exit2.call(this, token);
    }
  }
  function exit2(token, onExitError) {
    const node2 = this.stack.pop();
    const open11 = this.tokenStack.pop();
    if (!open11) {
      throw new Error("Cannot close `" + token.type + "` (" + stringifyPosition({
        start: token.start,
        end: token.end
      }) + "): it\u2019s not open");
    } else if (open11[0].type !== token.type) {
      if (onExitError) {
        onExitError.call(this, token, open11[0]);
      } else {
        const handler = open11[1] || defaultOnError;
        handler.call(this, token, open11[0]);
      }
    }
    node2.position.end = point2(token.end);
  }
  function resume() {
    return toString(this.stack.pop());
  }
  function onenterlistordered() {
    this.data.expectingFirstListItemValue = true;
  }
  function onenterlistitemvalue(token) {
    if (this.data.expectingFirstListItemValue) {
      const ancestor = this.stack[this.stack.length - 2];
      ancestor.start = Number.parseInt(this.sliceSerialize(token), 10);
      this.data.expectingFirstListItemValue = void 0;
    }
  }
  function onexitcodefencedfenceinfo() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.lang = data2;
  }
  function onexitcodefencedfencemeta() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.meta = data2;
  }
  function onexitcodefencedfence() {
    if (this.data.flowCodeInside) return;
    this.buffer();
    this.data.flowCodeInside = true;
  }
  function onexitcodefenced() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2.replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, "");
    this.data.flowCodeInside = void 0;
  }
  function onexitcodeindented() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2.replace(/(\r?\n|\r)$/g, "");
  }
  function onexitdefinitionlabelstring(token) {
    const label = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.label = label;
    node2.identifier = normalizeIdentifier(this.sliceSerialize(token)).toLowerCase();
  }
  function onexitdefinitiontitlestring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.title = data2;
  }
  function onexitdefinitiondestinationstring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.url = data2;
  }
  function onexitatxheadingsequence(token) {
    const node2 = this.stack[this.stack.length - 1];
    if (!node2.depth) {
      const depth = this.sliceSerialize(token).length;
      node2.depth = depth;
    }
  }
  function onexitsetextheadingtext() {
    this.data.setextHeadingSlurpLineEnding = true;
  }
  function onexitsetextheadinglinesequence(token) {
    const node2 = this.stack[this.stack.length - 1];
    node2.depth = this.sliceSerialize(token).codePointAt(0) === 61 ? 1 : 2;
  }
  function onexitsetextheading() {
    this.data.setextHeadingSlurpLineEnding = void 0;
  }
  function onenterdata(token) {
    const node2 = this.stack[this.stack.length - 1];
    const siblings = node2.children;
    let tail = siblings[siblings.length - 1];
    if (!tail || tail.type !== "text") {
      tail = text3();
      tail.position = {
        start: point2(token.start),
        // @ts-expect-error: we’ll add `end` later.
        end: void 0
      };
      siblings.push(tail);
    }
    this.stack.push(tail);
  }
  function onexitdata(token) {
    const tail = this.stack.pop();
    tail.value += this.sliceSerialize(token);
    tail.position.end = point2(token.end);
  }
  function onexitlineending(token) {
    const context = this.stack[this.stack.length - 1];
    if (this.data.atHardBreak) {
      const tail = context.children[context.children.length - 1];
      tail.position.end = point2(token.end);
      this.data.atHardBreak = void 0;
      return;
    }
    if (!this.data.setextHeadingSlurpLineEnding && config.canContainEols.includes(context.type)) {
      onenterdata.call(this, token);
      onexitdata.call(this, token);
    }
  }
  function onexithardbreak() {
    this.data.atHardBreak = true;
  }
  function onexithtmlflow() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2;
  }
  function onexithtmltext() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2;
  }
  function onexitcodetext() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2;
  }
  function onexitlink() {
    const node2 = this.stack[this.stack.length - 1];
    if (this.data.inReference) {
      const referenceType = this.data.referenceType || "shortcut";
      node2.type += "Reference";
      node2.referenceType = referenceType;
      delete node2.url;
      delete node2.title;
    } else {
      delete node2.identifier;
      delete node2.label;
    }
    this.data.referenceType = void 0;
  }
  function onexitimage() {
    const node2 = this.stack[this.stack.length - 1];
    if (this.data.inReference) {
      const referenceType = this.data.referenceType || "shortcut";
      node2.type += "Reference";
      node2.referenceType = referenceType;
      delete node2.url;
      delete node2.title;
    } else {
      delete node2.identifier;
      delete node2.label;
    }
    this.data.referenceType = void 0;
  }
  function onexitlabeltext(token) {
    const string3 = this.sliceSerialize(token);
    const ancestor = this.stack[this.stack.length - 2];
    ancestor.label = decodeString(string3);
    ancestor.identifier = normalizeIdentifier(string3).toLowerCase();
  }
  function onexitlabel() {
    const fragment = this.stack[this.stack.length - 1];
    const value = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    this.data.inReference = true;
    if (node2.type === "link") {
      const children = fragment.children;
      node2.children = children;
    } else {
      node2.alt = value;
    }
  }
  function onexitresourcedestinationstring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.url = data2;
  }
  function onexitresourcetitlestring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.title = data2;
  }
  function onexitresource() {
    this.data.inReference = void 0;
  }
  function onenterreference() {
    this.data.referenceType = "collapsed";
  }
  function onexitreferencestring(token) {
    const label = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.label = label;
    node2.identifier = normalizeIdentifier(this.sliceSerialize(token)).toLowerCase();
    this.data.referenceType = "full";
  }
  function onexitcharacterreferencemarker(token) {
    this.data.characterReferenceType = token.type;
  }
  function onexitcharacterreferencevalue(token) {
    const data2 = this.sliceSerialize(token);
    const type = this.data.characterReferenceType;
    let value;
    if (type) {
      value = decodeNumericCharacterReference(data2, type === "characterReferenceMarkerNumeric" ? 10 : 16);
      this.data.characterReferenceType = void 0;
    } else {
      const result = decodeNamedCharacterReference(data2);
      value = result;
    }
    const tail = this.stack[this.stack.length - 1];
    tail.value += value;
  }
  function onexitcharacterreference(token) {
    const tail = this.stack.pop();
    tail.position.end = point2(token.end);
  }
  function onexitautolinkprotocol(token) {
    onexitdata.call(this, token);
    const node2 = this.stack[this.stack.length - 1];
    node2.url = this.sliceSerialize(token);
  }
  function onexitautolinkemail(token) {
    onexitdata.call(this, token);
    const node2 = this.stack[this.stack.length - 1];
    node2.url = "mailto:" + this.sliceSerialize(token);
  }
  function blockQuote2() {
    return {
      type: "blockquote",
      children: []
    };
  }
  function codeFlow() {
    return {
      type: "code",
      lang: null,
      meta: null,
      value: ""
    };
  }
  function codeText2() {
    return {
      type: "inlineCode",
      value: ""
    };
  }
  function definition2() {
    return {
      type: "definition",
      identifier: "",
      label: null,
      title: null,
      url: ""
    };
  }
  function emphasis() {
    return {
      type: "emphasis",
      children: []
    };
  }
  function heading() {
    return {
      type: "heading",
      // @ts-expect-error `depth` will be set later.
      depth: 0,
      children: []
    };
  }
  function hardBreak() {
    return {
      type: "break"
    };
  }
  function html() {
    return {
      type: "html",
      value: ""
    };
  }
  function image() {
    return {
      type: "image",
      title: null,
      url: "",
      alt: null
    };
  }
  function link6() {
    return {
      type: "link",
      title: null,
      url: "",
      children: []
    };
  }
  function list2(token) {
    return {
      type: "list",
      ordered: token.type === "listOrdered",
      start: null,
      spread: token._spread,
      children: []
    };
  }
  function listItem(token) {
    return {
      type: "listItem",
      spread: token._spread,
      checked: null,
      children: []
    };
  }
  function paragraph() {
    return {
      type: "paragraph",
      children: []
    };
  }
  function strong() {
    return {
      type: "strong",
      children: []
    };
  }
  function text3() {
    return {
      type: "text",
      value: ""
    };
  }
  function thematicBreak2() {
    return {
      type: "thematicBreak"
    };
  }
}
function point2(d) {
  return {
    line: d.line,
    column: d.column,
    offset: d.offset
  };
}
function configure(combined, extensions) {
  let index2 = -1;
  while (++index2 < extensions.length) {
    const value = extensions[index2];
    if (Array.isArray(value)) {
      configure(combined, value);
    } else {
      extension(combined, value);
    }
  }
}
function extension(combined, extension2) {
  let key;
  for (key in extension2) {
    if (own2.call(extension2, key)) {
      switch (key) {
        case "canContainEols": {
          const right = extension2[key];
          if (right) {
            combined[key].push(...right);
          }
          break;
        }
        case "transforms": {
          const right = extension2[key];
          if (right) {
            combined[key].push(...right);
          }
          break;
        }
        case "enter":
        case "exit": {
          const right = extension2[key];
          if (right) {
            Object.assign(combined[key], right);
          }
          break;
        }
      }
    }
  }
}
function defaultOnError(left, right) {
  if (left) {
    throw new Error("Cannot close `" + left.type + "` (" + stringifyPosition({
      start: left.start,
      end: left.end
    }) + "): a different token (`" + right.type + "`, " + stringifyPosition({
      start: right.start,
      end: right.end
    }) + ") is open");
  } else {
    throw new Error("Cannot close document, a token (`" + right.type + "`, " + stringifyPosition({
      start: right.start,
      end: right.end
    }) + ") is still open");
  }
}

// node_modules/@projector/runtime/dist/persistence/markdown-canonical.js
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
function stringifyCanonicalMarkdownDocument(document3) {
  const wire = toCanonicalDocumentWire(document3);
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
    const position2 = child.position;
    if (typeof child.depth !== "number" || !isObject(position2) || !isObject(position2.start) || !isObject(position2.end) || typeof position2.start.offset !== "number" || typeof position2.end.offset !== "number")
      throw new Error(`Markdown heading lacks source positions at ${path}`);
    const lineEnd = body.indexOf("\n", position2.start.offset);
    const line = body.slice(position2.start.offset, lineEnd < 0 ? body.length : lineEnd);
    const match = /^(#{1,2})[ \t]+(.+?)\s*$/u.exec(line);
    if (match === null || match[1].length !== child.depth)
      throw new Error(`canonical Markdown headings must use ATX H1 or H2 syntax at ${path}`);
    headings.push({ level: child.depth, text: match[2], start: position2.start.offset, end: lineEnd < 0 ? body.length : lineEnd });
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
  return remaining.map((heading, index2) => {
    if (heading.level !== 2)
      throw new Error(`canonical Markdown section must be H2 at ${path}`);
    const start = heading.end + (body[heading.end] === "\n" ? 1 : 0);
    return { heading: heading.text, text: normalizeBody(body.slice(start, remaining[index2 + 1]?.start ?? body.length), path) };
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
  if (sections.length === 0 || sections.some(({ heading, text: text3 }) => heading === void 0 || roles[heading] === void 0 || text3 === ""))
    throw new Error(`scenario Markdown requires nonempty Given, When, Then, or Must not sections at ${path}`);
  return sections.map(({ heading, text: text3 }) => ({ role: roles[heading], statement: text3 }));
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
      const [topLevel] = relativePath.split("/");
      if (entry.isDirectory() && topLevel !== void 0 && operationalTopLevelDirectories.has(topLevel) || entry.isFile() && !relativePath.includes("/") && operationalRootFiles.has(entry.name) || entry.isFile() && !relativePath.includes("/") && readableIndexRootFiles.has(entry.name) || entry.isFile() && topLevel === "receipts" && !entry.name.endsWith(".receipt.json"))
        continue;
      if (entry.isSymbolicLink()) {
        if (topLevel === void 0 || !derivedTopLevelDirectories.has(topLevel)) {
          throw new Error(`symlink canonical entry is not allowed: ${path}`);
        }
        continue;
      }
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile() && (entry.name.endsWith(".toml") || entry.name.endsWith(".md"))) {
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
    const extension2 = relativePath.endsWith(".md") ? "markdown" : "toml";
    if (location.format !== extension2)
      throw new Error(`legacy or mixed canonical format requires one-time V3 cutover at ${path}`);
    derivedBudget.reserveItems(1, 128, "canonical-record", path);
    const document3 = withCanonicalParsingReservation(source, path, derivedBudget, () => parseEnvelope(source, path, location.format));
    if (document3.kind !== supportedKind)
      throw new Error(`canonical kind/path conflict at ${path}: expected ${supportedKind}, found ${document3.kind}`);
    documents.push(document3);
    locators.push({ kind: supportedKind, id: document3.id, path, relativePath, format: location.format });
  }
  documents.sort((left, right) => Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)) || Buffer.compare(Buffer.from(left.canonicalDocumentHash), Buffer.from(right.canonicalDocumentHash)));
  const keys = /* @__PURE__ */ new Map();
  for (const document3 of documents) {
    const owner = keys.get(document3.key);
    if (owner !== void 0 && owner !== document3.id)
      throw new Error(`duplicate canonical key ${document3.key}: ${owner} and ${document3.id}`);
    keys.set(document3.key, document3.id);
  }
  const entries = documents.map(({ id, canonicalDocumentHash }) => ({ entityId: id, canonicalDocumentHash }));
  return { snapshot: { documents, entries, rootDigest: hashRootManifest(entries) }, locators };
}
function canonicalKindForPath(relativePath) {
  const parts = relativePath.split("/");
  for (const [kind, location] of Object.entries(kindLocations)) {
    if (!location.directory.every((part, index2) => parts[index2] === part))
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
function withCanonicalParsingReservation(source, path, budget, parse4) {
  const temporaryBytes = 256 + source.length * 4;
  budget.reserve(temporaryBytes, "canonical-source-expansion", path);
  try {
    return parse4();
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
  let document3;
  try {
    document3 = hydrateCanonicalDocumentWire(parsed);
  } catch (error) {
    throw new Error(`invalid canonical document at ${path}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  assertSupportedCanonicalVersions(document3, ` at ${path}`);
  return document3;
}
function assertSupportedCanonicalVersions(document3, location = "") {
  if (document3.apiVersion !== canonicalApiVersion) {
    throw new Error(`unsupported canonical apiVersion ${document3.apiVersion}${location}`);
  }
  if (document3.schemaVersion !== canonicalSchemaVersion) {
    throw new Error(`unsupported canonical schemaVersion ${document3.schemaVersion}${location}`);
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
  prepareWrite(document3, options = {}) {
    const kind = document3.kind;
    if (!(kind in kindLocations))
      throw new Error(`unsupported canonical kind: ${document3.kind}`);
    const result = CanonicalDocumentEnvelopeSchemasByKind[kind].safeParse(document3);
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
    if (relativePath === "" || relativePath === ".." || relativePath.startsWith("../") || !location.directory.every((part, index2) => parts[index2] === part) || (location.format === "markdown" ? !relativePath.endsWith(".md") : !relativePath.endsWith(".toml"))) {
      throw new Error(`prepared canonical destination is outside the ${kind} family: ${path}`);
    }
  }
  async write(document3) {
    const kind = document3.kind;
    const existing = await this.locate(kind, document3.id);
    const prepared = this.prepareWrite(document3, existing === void 0 ? {} : { existingPath: existing.path });
    await this.validateOwnedPath(prepared.path, document3.kind, document3.id);
    await atomicWrite(prepared.path, prepared.contents);
    return prepared.path;
  }
  async read(kind, id) {
    const located = await this.locate(kind, id);
    if (located === void 0)
      return void 0;
    if (!await this.validateOwnedPath(located.path, kind, id))
      return void 0;
    const document3 = parseEnvelope(await readFile2(located.path, "utf8"), located.path, kindLocations[kind].format);
    if (document3.kind !== kind || document3.id !== id) {
      throw new Error(`canonical path lookup conflict at ${located.path}`);
    }
    return document3;
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
  const expectedById = new Map(expected.documents.map((document3) => [document3.id, document3]));
  const actualById = new Map(actual.documents.map((document3) => [document3.id, document3]));
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
function canonicalMeaning(document3) {
  const wire = toCanonicalDocumentWire(document3);
  return { kind: wire.kind, id: wire.id, key: wire.key, lifecycle: wire.lifecycle, payload: wire.payload };
}
function readableSlug(value) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 96) || "entity";
}
function documentTitleSlug(document3) {
  const payload = document3.payload;
  const candidate = payload.name ?? payload.title ?? payload.subjectId ?? document3.id;
  const title = readableSlug(typeof candidate === "string" ? candidate : document3.id);
  const key = readableSlug(document3.key);
  return title === key ? title : `${title.slice(0, 45)}--${key.slice(0, 48)}`;
}

// node_modules/@projector/runtime/dist/persistence/durable-artifact-set.js
import { createHash as createHash2, randomUUID } from "node:crypto";
import { constants as constants3 } from "node:fs";
import { link as link2, lstat as lstat4, mkdir as mkdir3, open as open3, readdir, rename as rename2, rm as rm3 } from "node:fs/promises";
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
  constructor(storageRoot, validateManifest, testHooks = {}) {
    this.storageRoot = storageRoot;
    this.validateManifest = validateManifest;
    this.testHooks = testHooks;
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
    const manifestBytes = await readRegularFile(manifestPath, "artifact manifest");
    return this.finalize({ artifactSetId, manifestBytes });
  }
  async read(artifactSetId) {
    assertArtifactSetId(artifactSetId);
    const publishedPath = this.publishedPath(artifactSetId);
    if (await pathExists(publishedPath)) {
      try {
        return await this.readCompleteSet(publishedPath, artifactSetId);
      } catch (error) {
        return { status: "integrity-failed", artifactSetId, reason: errorMessage(error) };
      }
    }
    const stage = this.stagePath(artifactSetId);
    const finalizing = this.finalizingPath(artifactSetId);
    if (await pathExists(stage) && await pathExists(finalizing)) {
      return { status: "integrity-failed", artifactSetId, reason: "Artifact set has ambiguous staging and finalizing state" };
    }
    const incomplete = await pathExists(finalizing) ? finalizing : stage;
    if (!await pathExists(incomplete))
      return { status: "missing", artifactSetId };
    try {
      const manifestPath = join4(incomplete, "manifest.bin");
      if (await pathExists(manifestPath))
        await this.readCompleteSet(incomplete, artifactSetId);
      else
        await collectStagedBlobs(incomplete);
      return { status: "incomplete", artifactSetId };
    } catch (error) {
      return { status: "integrity-failed", artifactSetId, reason: errorMessage(error) };
    }
  }
  async readCompleteSet(directory, artifactSetId) {
    await assertDirectory(directory, "artifact set");
    const manifest = await this.checkManifest(await readRegularFile(join4(directory, "manifest.bin"), "artifact manifest"));
    const staged = await collectStagedBlobs(directory, true);
    assertExactDeclaredSet(artifactSetId, manifest.blobs, staged);
    verifyHashes(manifest.blobs, staged);
    return {
      status: "published",
      artifactSetId,
      manifestBytes: manifest.manifestBytes,
      manifest: manifest.manifest,
      blobs: staged
    };
  }
  async checkManifest(bytes) {
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
    }
    const blobs = Object.freeze(validated.blobs.map(({ path, sha256 }) => Object.freeze({ path, sha256 })));
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
    const finalizing = this.finalizingPath(artifactSetId);
    const manifestPath = join4(finalizing, "manifest.bin");
    try {
      if ((await readRegularFile(manifestPath, "artifact manifest")).equals(manifestBytes)) {
        await rm3(manifestPath);
        await syncDirectory2(finalizing);
      }
      if (!await pathExists(this.stagePath(artifactSetId))) {
        await rename2(finalizing, this.stagePath(artifactSetId));
        await syncDirectory2(this.stagingRoot());
        await syncDirectory2(this.finalizingRoot());
      }
    } catch {
    }
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
function verifyHashes(declarations, staged) {
  for (const declaration of declarations) {
    const bytes = staged.get(declaration.path);
    if (bytes === void 0 || hash(bytes) !== declaration.sha256) {
      throw new RecoverableArtifactSetValidationError(`Blob ${declaration.path} failed its declared SHA-256 hash`);
    }
  }
}
async function collectStagedBlobs(directory, allowManifest = false) {
  await assertDirectory(directory, "artifact set");
  const rootEntries = await readdir(directory, { withFileTypes: true });
  let foundBlobs = false;
  for (const entry of rootEntries) {
    const status = await lstat4(join4(directory, entry.name));
    if (status.isSymbolicLink())
      throw new ArtifactSetIntegrityError(`Artifact set contains a symbolic link: ${entry.name}`);
    if (entry.name === "blobs" && status.isDirectory())
      foundBlobs = true;
    else if (!(allowManifest && entry.name === "manifest.bin" && status.isFile())) {
      throw new ArtifactSetIntegrityError(`Artifact set contains an unexpected entry: ${entry.name}`);
    }
  }
  if (!foundBlobs)
    return /* @__PURE__ */ new Map();
  const blobs = /* @__PURE__ */ new Map();
  await collectBlobDirectory(join4(directory, "blobs"), "", blobs);
  return blobs;
}
async function collectBlobDirectory(root, relative4, blobs) {
  const directory = relative4.length === 0 ? root : join4(root, ...relative4.split("/"));
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = relative4.length === 0 ? entry.name : `${relative4}/${entry.name}`;
    assertBlobPath(path);
    const absolute = join4(directory, entry.name);
    const status = await lstat4(absolute);
    if (status.isSymbolicLink())
      throw new ArtifactSetIntegrityError(`Artifact set contains a symbolic link: blobs/${path}`);
    if (status.isDirectory())
      await collectBlobDirectory(root, path, blobs);
    else if (status.isFile())
      blobs.set(path, await readRegularFile(absolute, `blob ${path}`));
    else
      throw new ArtifactSetIntegrityError(`Artifact set contains a non-regular entry: blobs/${path}`);
  }
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
async function readRegularFile(path, label) {
  const handle = await open3(path, constants3.O_RDONLY | constants3.O_NOFOLLOW);
  try {
    const status = await handle.stat();
    if (!status.isFile())
      throw new ArtifactSetIntegrityError(`${label} is not a regular file`);
    return await handle.readFile();
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
function payloadOf(document3) {
  return document3.payload;
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
    const computedDigest = hashRootManifest(snapshot.documents.map((document3) => ({
      entityId: document3.id,
      canonicalDocumentHash: document3.canonicalDocumentHash
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
      for (const document3 of snapshot.documents)
        this.insertDocument(document3, nextRevision);
      this.database.prepare("UPDATE graph_state SET revision = ?, canonical_root_digest = ? WHERE singleton = 1").run(nextRevision, snapshot.rootDigest);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.revision();
  }
  applyCanonicalUpdate(document3, rootDigest) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const nextRevision = this.revisionNumber() + 1;
      this.database.prepare("DELETE FROM canonical_documents WHERE id = ?").run(document3.id);
      this.insertDocument(document3, nextRevision);
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
    const document3 = result.data;
    assertSupportedCanonicalVersions(document3);
    const mismatched = document3.id !== requestedId || document3.id !== row.id || document3.kind !== row.kind || document3.key !== row.canonicalKey || document3.lifecycle !== row.lifecycle || document3.semanticHash !== row.semanticHash || (document3.discoveryHash ?? null) !== row.discoveryHash || document3.canonicalDocumentHash !== row.canonicalDocumentHash || canonicalJson(document3) !== row.documentJson;
    if (mismatched)
      throw new Error(`corrupt canonical index row ${requestedId}: envelope/column mismatch`);
    return document3;
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
  insertDocument(document3, revision) {
    const result = CanonicalDocumentEnvelopeSchema.safeParse(document3);
    if (!result.success)
      throw new Error(`invalid canonical document ${document3.id}: ${result.error.message}`);
    assertSupportedCanonicalVersions(document3);
    this.database.prepare(`
      INSERT INTO canonical_documents(
        id, kind, canonical_key, lifecycle, semantic_hash, discovery_hash,
        canonical_document_hash, document_json, indexed_revision
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(document3.id, document3.kind, document3.key, document3.lifecycle, document3.semanticHash, document3.discoveryHash ?? null, document3.canonicalDocumentHash, canonicalJson(document3), revision);
    const payload = payloadOf(document3);
    switch (document3.kind) {
      case "concept":
        this.database.prepare("INSERT INTO entities(id, entity_kind, source_class, status) VALUES (?, ?, ?, ?)").run(document3.id, requiredString2(payload, "kind"), requiredString2(payload, "sourceClass"), requiredString2(payload, "status"));
        break;
      case "requirement":
        this.database.prepare("INSERT INTO requirements(id, source_class, status) VALUES (?, ?, ?)").run(document3.id, requiredString2(payload, "sourceClass"), requiredString2(payload, "status"));
        break;
      case "behavioral-scenario":
        this.database.prepare("INSERT INTO behavioral_scenarios(id, source_class, status) VALUES (?, ?, ?)").run(document3.id, requiredString2(payload, "sourceClass"), requiredString2(payload, "status"));
        break;
      case "relation":
        this.database.prepare("INSERT INTO relations(id, from_id, to_id, relation_type, active) VALUES (?, ?, ?, ?, ?)").run(document3.id, requiredString2(payload, "fromId"), requiredString2(payload, "toId"), requiredString2(payload, "type"), payload.active === true ? 1 : 0);
        break;
      case "lineage":
        this.database.prepare("INSERT INTO lineage_records(id, lineage_kind) VALUES (?, ?)").run(document3.id, requiredString2(payload, "kind"));
        break;
      case "tombstone":
        this.database.prepare("INSERT INTO tombstones(id, entity_id, deleted_at_revision) VALUES (?, ?, ?)").run(document3.id, requiredString2(payload, "entityId"), payload.deletedAtRevision);
        break;
      default:
        this.database.prepare("INSERT INTO governance_documents(id, governance_kind) VALUES (?, ?)").run(document3.id, document3.kind);
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
  return left.length === right.length && left.every((value, index2) => value === right[index2]);
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
      const roots2 = (grants) => grants.flatMap(({ selector }) => selector.op === "atom" && selector.field === "path" && typeof selector.value === "string" ? [selectorRoot(selector.value)] : []);
      const leftRoots = roots2(a);
      const rightRoots = roots2(b);
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
  const document3 = result.data;
  assertSupportedCanonicalVersions(document3);
  if (document3.id !== row.id || document3.kind !== row.kind || document3.key !== row.canonicalKey || document3.lifecycle !== row.lifecycle || document3.semanticHash !== row.semanticHash || (document3.discoveryHash ?? null) !== row.discoveryHash || document3.canonicalDocumentHash !== row.canonicalDocumentHash || canonicalJson(document3) !== row.documentJson || !Number.isSafeInteger(row.indexedRevision) || row.indexedRevision < 1 || row.indexedRevision > revision)
    throw new Error(`corrupt canonical index row ${row.id}: envelope/column mismatch`);
  return document3;
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
  for (const document3 of documents) {
    const payload = document3.payload;
    switch (document3.kind) {
      case "concept":
        expected.entities.push({ id: document3.id, entity_kind: payload.kind, source_class: payload.sourceClass, status: payload.status });
        break;
      case "requirement":
        expected.requirements.push({ id: document3.id, source_class: payload.sourceClass, status: payload.status });
        break;
      case "behavioral-scenario":
        expected.behavioral_scenarios.push({ id: document3.id, source_class: payload.sourceClass, status: payload.status });
        break;
      case "relation":
        expected.relations.push({ id: document3.id, from_id: payload.fromId, to_id: payload.toId, relation_type: payload.type, active: payload.active === true ? 1 : 0 });
        break;
      case "lineage":
        expected.lineage_records.push({ id: document3.id, lineage_kind: payload.kind });
        break;
      case "tombstone":
        expected.tombstones.push({ id: document3.id, entity_id: payload.entityId, deleted_at_revision: payload.deletedAtRevision });
        break;
      default:
        expected.governance_documents.push({ id: document3.id, governance_kind: document3.kind });
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

// node_modules/@projector/runtime/dist/journal/transaction-journal.js
import { createHash as createHash3, randomUUID as randomUUID2 } from "node:crypto";
import { constants as constants5 } from "node:fs";
import { chmod, link as link3, lstat as lstat6, mkdir as mkdir4, open as open5, readFile as readFile3, readdir as readdir2, rename as rename3, rm as rm5 } from "node:fs/promises";
import { dirname as dirname5, join as join6, posix as posix2 } from "node:path";
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
  async writeFile(path, content3) {
    await this.ensureMutationPhase();
    const before = await this.journal.snapshot(path, this.record.allowedWriteRoots);
    const after = {
      kind: "file",
      contentBase64: Buffer.from(content3).toString("base64"),
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
      const source = await readFile3(join6(directory, name), "utf8");
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
      const status = await lstat6(target.realTarget);
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
      await syncDirectory3(dirname5(target.realTarget));
      return;
    }
    await this.ensureParent(path, scopes2);
    const resolved = await this.paths.resolveScopedWrite(path, scopes2);
    const temporary = join6(dirname5(resolved.realTarget), `.projector-tx-${randomUUID2()}.tmp`);
    const handle = await open5(temporary, "wx", snapshot.mode);
    try {
      await handle.writeFile(Buffer.from(snapshot.contentBase64, "base64"));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await chmod(temporary, snapshot.mode);
    await rename3(temporary, resolved.realTarget);
    await syncDirectory3(dirname5(resolved.realTarget));
  }
  async move(source, destination, scopes2) {
    const sourcePath = await this.paths.resolveScopedWrite(source, scopes2);
    await this.ensureParent(destination, scopes2);
    const destinationPath = await this.paths.resolveScopedWrite(destination, scopes2);
    await rename3(sourcePath.realTarget, destinationPath.realTarget);
    await syncDirectory3(dirname5(sourcePath.realTarget));
    if (dirname5(sourcePath.realTarget) !== dirname5(destinationPath.realTarget)) {
      await syncDirectory3(dirname5(destinationPath.realTarget));
    }
  }
  async persist(record, mustBeNew = false) {
    record.entry.updatedAt = this.timestamp();
    const destination = await this.recordPath(record.entry.transactionId);
    const directory = dirname5(destination);
    const temporary = join6(directory, `.${recordFileName(record.entry.transactionId)}.${randomUUID2()}.tmp`);
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
  inject(point3) {
    this.crash?.(point3);
  }
  async ensureJournalRoot() {
    const initial = await this.paths.resolveWrite(journalRoot);
    await mkdir4(initial.realTarget, { recursive: true });
    return (await this.paths.resolveWrite(journalRoot)).realTarget;
  }
  async recordPath(transactionId) {
    await this.ensureJournalRoot();
    return (await this.paths.resolveWrite(fileTransactionJournalRelativePath(transactionId))).realTarget;
  }
  async ensureParent(path, scopes2) {
    const authorizedTarget = await this.paths.resolveScopedWrite(path, scopes2);
    await mkdir4(dirname5(authorizedTarget.realTarget), { recursive: true });
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
  return `${createHash3("sha256").update(transactionId).digest("hex")}.json`;
}
async function readBoundedRegularFile(path, maximumBytes) {
  const before = await lstat6(path);
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
function parseRecord(text3) {
  let value;
  try {
    value = JSON.parse(text3);
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
import { mkdir as mkdir5, open as open6, readFile as readFile4, rename as rename4, rm as rm6, stat } from "node:fs/promises";
import { join as join7 } from "node:path";
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
    const activePath = join7(runtime, activeLeaseName);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await mkdir5(activePath);
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
          await writeDurableNewFile2(join7(activePath, "owner.json"), `${JSON.stringify(record)}
`);
          await writeDurableNewFile2(join7(activePath, "heartbeat"), `${record.leaseId}
`);
          const heartbeat2 = await open6(join7(activePath, "heartbeat"), "r+");
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
      const heartbeat = await stat(join7(activePath, "heartbeat")).catch((error) => {
        throw corruptLease(error);
      });
      if (this.now().getTime() - heartbeat.mtimeMs < existing.staleAfterMs) {
        throw new LeaseConflictError("lease-held", `Worktree writer lease is held by ${existing.sessionId}/${String(existing.processId)}`);
      }
      const staleDirectory = join7(runtime, "stale-leases");
      await mkdir5(staleDirectory, { recursive: true });
      const displacedPath = join7(staleDirectory, existing.leaseId);
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
    const releasedPath = join7(await this.runtimePath(), `released-${leaseId}`);
    try {
      await rename4(activePath, releasedPath);
    } catch (error) {
      if (isCode5(error, "ENOENT"))
        throw lostLease(leaseId);
      throw error;
    }
    const moved = await readLeaseRecord(join7(releasedPath, "owner.json"));
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
    await mkdir5(initial.realTarget, { recursive: true });
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
  if (actual.length !== expected.length || actual.some((key, index2) => key !== expected[index2])) {
    throw new TypeError("Migration recovery lease owner contains unexpected keys or missing fields");
  }
}
function isIsoDate(value) {
  if (typeof value !== "string")
    return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}
async function writeDurableNewFile2(path, content3) {
  const handle = await open6(path, "wx");
  try {
    await handle.writeFile(content3, "utf8");
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
var contentHash = (content3) => hashFramedDomain("transform-content", content3);
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
      for (const [index2, edit] of edits.entries()) {
        if (context.signal.aborted)
          throw new Error("transform aborted");
        if (edit.after === null)
          await this.mutation.deleteFile(edit.path);
        else
          await this.mutation.writeFile(edit.path, edit.after);
        evidence.push({
          operationId: `${this.id}:${index2 + 1}`,
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
function countOccurrences(content3, anchor) {
  if (anchor.length === 0)
    throw new TransformPreconditionError("reference anchor cannot be empty");
  return content3.split(anchor).length - 1;
}
function contentHash2(content3) {
  return hashFramedDomain("transform-content", content3);
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
      for (const [index2, operation] of operations.entries()) {
        if (context.signal.aborted)
          throw new Error("transform aborted");
        if (operation.kind === "move") {
          await this.mutation.moveFile(operation.from, operation.to);
          evidence.push({
            operationId: `${this.id}:move:${index2 + 1}`,
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
            operationId: `${this.id}:reference:${index2 + 1}`,
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
      const content3 = referenceContents.get(reference.path) ?? await this.mutation.readFile(reference.path);
      if (content3 === void 0)
        throw new TransformPreconditionError(`reference file is missing: ${reference.path}`);
      const oldCount = countOccurrences(content3, reference.from);
      if (oldCount === 0 && countOccurrences(content3, reference.to) >= reference.expectedOccurrences)
        continue;
      if (oldCount !== reference.expectedOccurrences) {
        throw new TransformPreconditionError(`unresolved reference anchor in ${reference.path}: expected ${reference.expectedOccurrences}, found ${oldCount}`);
      }
      const after = content3.split(reference.from).join(reference.to);
      referenceContents.set(reference.path, after);
      operations.push({
        kind: "update-reference",
        ...reference,
        before: content3,
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
    components.forEach((component, index2) => component.forEach((id) => componentById.set(id, index2)));
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
    const remainingComponents = new Set(components.map((_component, index2) => index2));
    while (remainingComponents.size > 0) {
      const ready = [...remainingComponents].filter((index2) => indegree[index2] === 0).sort((left, right) => compareStrings(components[left]?.[0] ?? "", components[right]?.[0] ?? ""));
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
import { mkdir as mkdir6, readFile as readFile5, rename as rename5, rm as rm7, writeFile } from "node:fs/promises";
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
      const scan2 = await this.ports.scan({ fullScan, paths, events: [...events] });
      const value = { digest: scan2.digest, affectedDependencyIds: [...scan2.affectedDependencyIds], generatedEventIds: [...scan2.generatedEventIds] };
      if (scan2.contentHash !== hashFramedDomain("authenticated-watch-scan", value))
        throw new Error("watch scan authentication failed");
      const processed = await this.ports.process(scan2);
      if (processed.digest !== scan2.digest)
        throw new Error("watch process digest mismatch");
      const invalidated = unique3(scan2.affectedDependencyIds);
      latest = { digest: scan2.digest, fullScan, paths, invalidatedDependencyIds: invalidated, preservedCacheKeys: unique3(processed.cacheKeys.filter((key) => !invalidated.includes(key))), generatedEventIds: unique3(scan2.generatedEventIds), iterations: iteration };
      const follow = processed.followUpEvents ?? [];
      if (follow.length === 0)
        return latest;
      if (seen.has(scan2.digest))
        throw new Error(`nonconvergent watch repeated digest ${scan2.digest}`);
      seen.add(scan2.digest);
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
    await mkdir6((await paths.resolveWrite(posix3.dirname(canonical))).realTarget, { recursive: true });
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
      const capacity2 = maximumEvents - processedEvents;
      const accepted = events.slice(0, Math.max(0, capacity2));
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
import { appendFile, mkdir as mkdir7, readFile as readFile6, rm as rm8 } from "node:fs/promises";
import { posix as posix4 } from "node:path";
var OperationalExitProofSchema = external_exports.strictObject({
  commandFailed: external_exports.boolean(),
  blockingInvalidity: external_exports.boolean(),
  approvalRequired: external_exports.boolean(),
  incompleteCoverage: external_exports.boolean(),
  requiredUnavailable: external_exports.boolean(),
  recoveryFailure: external_exports.boolean(),
  budgetExhausted: external_exports.boolean(),
  resumable: external_exports.boolean()
});
var UnavailableOperationalEvidenceSchema = external_exports.strictObject({ unavailable: external_exports.string() });
var OperationalEvidenceValueSchema = external_exports.union([ContentHashSchema, UnavailableOperationalEvidenceSchema]);
var OperationalRunEvidenceSchema = external_exports.strictObject({
  configDigest: OperationalEvidenceValueSchema,
  toolchainDigest: OperationalEvidenceValueSchema,
  gitHead: OperationalEvidenceValueSchema,
  worktreeDigest: OperationalEvidenceValueSchema,
  canonicalDigest: OperationalEvidenceValueSchema,
  graphRecords: external_exports.array(external_exports.string()),
  analyzerRecords: external_exports.array(external_exports.string()),
  modelRecords: external_exports.array(external_exports.string()),
  snapshotRecords: external_exports.array(external_exports.string()),
  decisionRecords: external_exports.array(external_exports.string()),
  transformRecords: external_exports.array(external_exports.string()),
  validationRecords: external_exports.array(external_exports.string()),
  journalRecords: external_exports.array(external_exports.string()),
  errorRecords: external_exports.array(external_exports.string()),
  durationMs: external_exports.union([external_exports.number().finite().nonnegative(), UnavailableOperationalEvidenceSchema])
});
var OperationalFindingSchema = external_exports.strictObject({
  id: ContentHashSchema,
  code: external_exports.string(),
  title: external_exports.string(),
  path: external_exports.string().optional(),
  severity: external_exports.enum(["note", "warning", "error"]),
  evidenceIds: external_exports.array(external_exports.string())
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
var classify = (value, key) => /-----BEGIN [A-Z ]*PRIVATE KEY-----/u.test(value) ? "private-key" : /(?:authorization\s*:|password\s*=|credential)/iu.test(value) || key !== void 0 && secretKey.test(key) ? "credential" : /(?:gh[pousr]_[A-Za-z0-9]{20,}|bearer\s+[A-Za-z0-9._~+\/-]{8,}|[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{8,})/iu.test(value) ? "token" : void 0;
function redactBeforeBoundary(value, key) {
  if (typeof value === "string") {
    const kind = classify(value, key);
    return kind === void 0 ? value : `<redacted:${kind}>`;
  }
  if (Array.isArray(value))
    return value.map((item) => redactBeforeBoundary(item));
  if (value !== null && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redactBeforeBoundary(item, name)]));
  return value;
}
var OperationalReportSchema = external_exports.strictObject({
  version: external_exports.literal(1),
  runId: external_exports.string(),
  command: external_exports.string(),
  exitCode: external_exports.number().int(),
  exitProof: OperationalExitProofSchema,
  evidence: OperationalRunEvidenceSchema,
  policy: external_exports.json(),
  stateDigest: ContentHashSchema,
  unavailableFields: external_exports.array(external_exports.string()),
  findings: external_exports.array(OperationalFindingSchema),
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
    await mkdir7(resolved.realTarget, { recursive: true });
    await paths.resolveWrite(path);
    return new _JsonlTelemetryStore(paths, path, maximumRecords);
  }
  async acquire() {
    const lockPath = `${this.path}.lock`;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const lock = await this.paths.resolveWrite(lockPath);
      try {
        await mkdir7(lock.realTarget);
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
    let text3;
    try {
      text3 = await readFile6(target.realTarget, "utf8");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return [];
      throw error;
    }
    const lines = text3.split(/\r?\n/u).filter(Boolean);
    if (lines.length > this.maximumRecords)
      throw new Error(`telemetry JSONL exceeds bounded replay limit ${this.maximumRecords}`);
    const records = [];
    for (const [index2, line] of lines.entries()) {
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        throw new Error(`corrupt telemetry JSONL at sequence ${index2 + 1}`);
      }
      const { entryHash, ...base } = record;
      if (record.version !== 1 || record.sequence !== index2 + 1 || record.previousHash !== (records.at(-1)?.entryHash ?? null) || entryHash !== hashFramedDomain("operational-telemetry-line", base) || !validateOperationalReport(record.report))
        throw new Error(`corrupt telemetry JSONL hash/sequence at ${index2 + 1}`);
      records.push(record);
    }
    return records;
  }
};

// node_modules/@projector/runtime/dist/activation/project-activation.js
import { randomBytes as randomBytes3 } from "node:crypto";
import { constants as constants6 } from "node:fs";
import { lstat as lstat7, open as open7, rename as rename6, rm as rm9 } from "node:fs/promises";
import { dirname as dirname6, join as join8, parse as parse3 } from "node:path";
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
      const gitMarker = await lstat7(join8(cursor, ".git"));
      if (gitMarker.isDirectory() || gitMarker.isFile())
        return cursor;
    } catch (error) {
      if (!isMissing2(error))
        throw error;
    }
    const parent = dirname6(cursor);
    if (parent === cursor || cursor === parse3(cursor).root)
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
    value = parse(source);
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
  const temporary = join8(dirname6(target), `.gitignore.${randomBytes3(12).toString("hex")}.tmp`);
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
    await syncDirectory5(dirname6(target));
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
import { lstat as lstat8, mkdir as mkdir8, open as open8, readFile as readFile7, readdir as readdir3, realpath as realpath2, rename as rename7, rm as rm10, rmdir, stat as stat2 } from "node:fs/promises";
import { join as join9 } from "node:path";
var OperationAccessError = class extends Error {
  code;
  constructor(code, message, options) {
    super(message, options);
    this.name = "OperationAccessError";
    this.code = code;
  }
};
var runtimeRelativePath = join9(".projector", "runtime");
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
  const mutexPath = join9(accessPath, mutexDirectoryName);
  try {
    await mkdir8(mutexPath);
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
    await writeNewClaim(join9(accessPath, holdersDirectoryName, `${claim.requestId}.json`), claim);
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
      const directory = join9(accessPath, requestIds.has(claim.requestId) ? requestsDirectoryName : holdersDirectoryName);
      await rm10(join9(directory, `${claim.requestId}.json`));
      synced.add(directory);
    }
    for (const directory of synced)
      await syncDirectory6(directory);
    return { removedClaimIds: abandoned.map(({ requestId }) => requestId) };
  });
}
async function recoverInterruptedMutex(accessPath) {
  const mutexPath = join9(accessPath, mutexDirectoryName);
  let mutexStatus;
  try {
    mutexStatus = await lstat8(mutexPath);
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
  const current = await lstat8(mutexPath);
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
    const directory = join9(accessPath, name);
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
      const path = join9(directory, entry.name);
      const pending = await readClaim(path);
      const { heartbeatAt: _prior, ...claimIdentity } = claim;
      const { heartbeatAt: _pending, ...pendingIdentity } = pending;
      if (JSON.stringify(claimIdentity) !== JSON.stringify(pendingIdentity) || pending.heartbeatAt < claim.heartbeatAt) {
        throw corrupt(`Interrupted heartbeat ${requestId} does not match its claim`);
      }
      const modified = await lstat8(path);
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
    governedRoot = await realpath2(root);
  } catch (cause) {
    throw new OperationAccessError("project-not-ready", `Project root is not readable: ${root}`, { cause });
  }
  const projectorPath = join9(governedRoot, ".projector");
  try {
    const projectorStatus = await lstat8(projectorPath);
    if (!projectorStatus.isDirectory() || projectorStatus.isSymbolicLink())
      throw new Error("not a real directory");
  } catch (cause) {
    throw new OperationAccessError("project-not-ready", "Project operation access requires an initialized .projector directory", { cause });
  }
  const runtimePath = join9(governedRoot, runtimeRelativePath);
  await ensureRealDirectory(runtimePath);
  const accessPath = join9(runtimePath, accessDirectoryName);
  await ensureRealDirectory(accessPath);
  await ensureRealDirectory(join9(accessPath, requestsDirectoryName));
  await ensureRealDirectory(join9(accessPath, holdersDirectoryName));
  return accessPath;
}
async function ensureRealDirectory(path) {
  await mkdir8(path, { recursive: true });
  const status = await lstat8(path);
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
    await writeNewClaim(join9(accessPath, requestsDirectoryName, `${claim.requestId}.json`), claim);
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
    await writeAtomic(join9(accessPath, holder === void 0 ? requestsDirectoryName : holdersDirectoryName), `${claim.requestId}.json`, `${JSON.stringify(refreshed)}
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
        await rename7(join9(accessPath, requestsDirectoryName, `${claim.requestId}.json`), join9(accessPath, holdersDirectoryName, `${claim.requestId}.json`));
      } catch (cause) {
        throw corrupt(`Operation access request ${claim.requestId} could not become a holder`, cause);
      }
      await syncDirectory6(join9(accessPath, requestsDirectoryName));
      await syncDirectory6(join9(accessPath, holdersDirectoryName));
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
      await rm10(join9(accessPath, location, `${claim.requestId}.json`));
    } catch (cause) {
      throw corrupt(`Operation access claim ${claim.requestId} could not be released`, cause);
    }
    await syncDirectory6(join9(accessPath, location));
  });
}
async function readAccessState(accessPath, permitAbandoned = false, permitInterruptedHeartbeats = false) {
  await validateAccessDirectoryEntries(accessPath);
  const requests = await readClaims(join9(accessPath, requestsDirectoryName), permitInterruptedHeartbeats);
  const holders = await readClaims(join9(accessPath, holdersDirectoryName), permitInterruptedHeartbeats);
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
    const claim = await readClaim(join9(directory, entry.name));
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
    const raw = await readFile7(join9(accessPath, counterFileName), "utf8");
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
  await syncDirectory6(join9(path, ".."));
}
async function writeAtomic(directory, name, content3) {
  const temporaryName = `.${name}.${randomUUID4()}.tmp`;
  const temporaryPath = join9(directory, temporaryName);
  const handle = await open8(temporaryPath, "wx");
  try {
    await handle.writeFile(content3, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename7(temporaryPath, join9(directory, name));
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
  const mutexPath = join9(accessPath, mutexDirectoryName);
  while (true) {
    throwIfAborted3(signal);
    try {
      await mkdir8(mutexPath);
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

// node_modules/@projector/runtime/dist/cache/derived-cache.js
import { randomUUID as randomUUID5 } from "node:crypto";
import { constants as constants7 } from "node:fs";
import { link as link4, lstat as lstat9, mkdir as mkdir9, open as open9, opendir as opendir2, readFile as readFile8, readdir as readdir4, rename as rename8, rm as rm11, rmdir as rmdir2, utimes } from "node:fs/promises";
import { dirname as dirname7 } from "node:path";
var DERIVED_CACHE_MAX_BYTES = 256 * 1024 * 1024;
var roots = [".projector/runtime/knowledge/contexts", ".projector/runtime/impact"];
var mutex = ".projector/runtime/cache-admission";
var DerivedCacheError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "DerivedCacheError";
  }
};
async function withDerivedCacheAdmission(root, body, options = {}) {
  const operationDeadline = options.deadline ?? options.budget?.deadline;
  if (operationDeadline !== void 0 && !Number.isFinite(operationDeadline))
    throw new RangeError("Cache admission deadline must be finite");
  checkAdmission(options.signal, operationDeadline);
  const maximum = options.maxBytes ?? DERIVED_CACHE_MAX_BYTES;
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > DERIVED_CACHE_MAX_BYTES)
    throw new RangeError("Invalid derived cache capacity");
  const paths = await RepositoryPathService.create(root);
  const runtime = (await paths.resolveWrite(".projector/runtime")).realTarget;
  await mkdir9(runtime, { recursive: true });
  const deadline = Date.now() + 5e3;
  const lockPath = (await paths.resolveWrite(mutex)).realTarget;
  const owner = `owner-${process.pid}-${randomUUID5()}`;
  const candidate = `${mutex}-claim-${owner}`;
  const candidatePath = (await paths.resolveWrite(candidate)).realTarget;
  await reclaimAbandonedCandidates(paths);
  await mkdir9(candidatePath);
  let acquired = false;
  try {
    await mkdir9((await paths.resolveWrite(`${candidate}/${owner}`)).realTarget);
    while (true) {
      checkAdmission(options.signal, operationDeadline);
      await paths.resolveWrite(mutex);
      try {
        await rename8(candidatePath, lockPath);
        acquired = true;
        break;
      } catch (error) {
        if (!isCode8(error, "EEXIST") && !isCode8(error, "ENOTEMPTY") && !isCode8(error, "EPERM"))
          throw error;
        if (await reclaimDeadLock(paths, mutex))
          continue;
        if (Date.now() >= deadline)
          throw new DerivedCacheError("cache-busy", "Derived cache admission is held by a live process; retry after active operations finish");
        await new Promise((resolve3) => setTimeout(resolve3, 10));
      }
    }
    const budget = options.budget ?? { deadline: Math.min(Date.now() + 5e3, operationDeadline ?? Infinity), remainingEntries: 1e4, remainingBytes: DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes };
    const records = await scan(paths, budget);
    checkAdmission(options.signal, operationDeadline);
    const session = new CacheSession(paths, records, maximum, options.signal, operationDeadline);
    try {
      const result = await body(session);
      checkAdmission(options.signal, operationDeadline);
      return result;
    } finally {
      session.close();
    }
  } finally {
    if (acquired) {
      const marker = await lstat9((await paths.resolveRead(`${mutex}/${owner}`)).realTarget);
      if (!marker.isDirectory() || marker.isSymbolicLink())
        throw new DerivedCacheError("cache-corrupt", "Cache admission ownership changed before release");
      await rename8((await paths.resolveWrite(mutex)).realTarget, candidatePath);
    }
    try {
      await rmdir2((await paths.resolveWrite(`${candidate}/${owner}`)).realTarget);
    } catch (error) {
      if (!isCode8(error, "ENOENT"))
        throw error;
    }
    await rmdir2((await paths.resolveWrite(candidate)).realTarget);
  }
}
var ownerPattern = /^owner-([1-9][0-9]*)-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
async function reclaimDeadLock(paths, relativePath, candidateOwner) {
  const target = (await paths.resolveRead(relativePath)).realTarget;
  let identity;
  try {
    identity = await lstat9(target, { bigint: true });
  } catch (error) {
    if (isCode8(error, "ENOENT"))
      return true;
    throw error;
  }
  if (!identity.isDirectory() || identity.isSymbolicLink())
    throw new DerivedCacheError("cache-corrupt", "Cache admission claim is not a real directory");
  const entries = await readdir4(target, { withFileTypes: true });
  const owner = candidateOwner ?? entries[0]?.name;
  const match = owner === void 0 ? null : ownerPattern.exec(owner);
  if (match === null || entries.length > 1 || entries.length === 0 && candidateOwner === void 0 || entries.some((entry) => entry.name !== owner || !entry.isDirectory() || entry.isSymbolicLink()))
    throw new DerivedCacheError("cache-corrupt", "Cache admission owner is ambiguous; preserve the claim for inspection");
  const pid = Number(match[1]);
  if (!Number.isSafeInteger(pid) || pid > 2147483647)
    throw new DerivedCacheError("cache-corrupt", "Cache admission process identity is invalid");
  if (processIsAlive(pid))
    return false;
  if (owner === void 0)
    throw new DerivedCacheError("cache-corrupt", "Cache admission owner is missing");
  const current = await lstat9(target, { bigint: true });
  if (current.dev !== identity.dev || current.ino !== identity.ino)
    throw new DerivedCacheError("cache-corrupt", "Cache admission owner changed during recovery");
  if (entries.length !== 0) {
    try {
      await rmdir2((await paths.resolveWrite(`${relativePath}/${owner}`)).realTarget);
    } catch (error) {
      if (!isCode8(error, "ENOENT"))
        throw error;
    }
  }
  try {
    await rmdir2((await paths.resolveWrite(relativePath)).realTarget);
  } catch (error) {
    if (!isCode8(error, "ENOENT") && !isCode8(error, "ENOTEMPTY") && !isCode8(error, "EEXIST"))
      throw error;
  }
  return true;
}
async function reclaimAbandonedCandidates(paths) {
  const directory = await opendir2((await paths.resolveRead(".projector/runtime")).realTarget);
  let remaining = 1e4;
  for await (const entry of directory) {
    if (--remaining < 0)
      throw new DerivedCacheError("cache-budget", "Runtime claim discovery exceeds the bounded cache admission inspection");
    const prefix = "cache-admission-claim-";
    if (entry.name.startsWith(prefix))
      await reclaimDeadLock(paths, `.projector/runtime/${entry.name}`, entry.name.slice(prefix.length));
  }
}
var CacheSession = class {
  paths;
  records;
  maximum;
  signal;
  deadline;
  usable = true;
  writing = false;
  constructor(paths, records, maximum, signal, deadline) {
    this.paths = paths;
    this.records = records;
    this.maximum = maximum;
    this.signal = signal;
    this.deadline = deadline;
  }
  get entries() {
    return [...this.records.values()].map(({ entry }) => entry);
  }
  get totalBytes() {
    return this.entries.reduce((sum, entry) => sum + entry.bytes, 0);
  }
  close() {
    this.usable = false;
  }
  async publish(relativePath, content3) {
    await this.publishAll([{ relativePath, content: content3 }]);
  }
  async publishAll(writes) {
    if (!this.usable || this.writing)
      throw new DerivedCacheError("cache-busy", "Cache admission session is closed, failed, or already publishing");
    this.writing = true;
    try {
      await this.publishBatch(writes);
    } catch (error) {
      if (!(error instanceof DerivedCacheError) || error.code !== "cache-capacity")
        this.usable = false;
      throw error;
    } finally {
      this.writing = false;
    }
  }
  async publishBatch(writes) {
    checkAdmission(this.signal, this.deadline);
    const unique4 = /* @__PURE__ */ new Map();
    for (const write of writes) {
      if (classify2(write.relativePath) === "staging")
        throw new DerivedCacheError("cache-corrupt", "Cannot publish a staging path");
      if (unique4.has(write.relativePath) && unique4.get(write.relativePath).content !== write.content)
        throw new DerivedCacheError("cache-corrupt", "Conflicting cache batch addresses");
      unique4.set(write.relativePath, write);
    }
    const pending = [];
    let projected = this.totalBytes;
    if (projected > this.maximum)
      throw capacity();
    for (const write of unique4.values()) {
      const existing = this.records.get(write.relativePath);
      if (existing !== void 0) {
        const target = await this.checked(existing, false);
        if (await readFile8(target, { encoding: "utf8", ...this.signal === void 0 ? {} : { signal: this.signal } }) !== write.content)
          throw new DerivedCacheError("cache-corrupt", `Derived cache content differs at ${write.relativePath}; inspect and remove only this disposable entry before refreshing context`);
        await this.checked(existing, false);
        checkAdmission(this.signal, this.deadline);
      } else {
        const bytes = Buffer.byteLength(write.content);
        if (projected + bytes * 2 > this.maximum)
          throw capacity();
        projected += bytes;
        pending.push(write);
      }
    }
    const publishedContexts = [];
    try {
      for (const write of pending) {
        await this.writeNew(write);
        const record = this.records.get(write.relativePath);
        if (record.entry.kind === "context")
          publishedContexts.push(record);
      }
      checkAdmission(this.signal, this.deadline);
    } catch (error) {
      if (this.signal?.aborted === true || this.deadline !== void 0 && Date.now() >= this.deadline) {
        for (const record of publishedContexts) {
          await rm11(await this.checked(record, false));
          this.records.delete(record.entry.relativePath);
        }
      }
      throw error;
    }
  }
  async remove(entry) {
    if (!this.usable || this.writing)
      throw new DerivedCacheError("cache-busy", "Cannot collect using a closed session or during cache publication");
    checkAdmission(this.signal, this.deadline);
    const record = this.records.get(entry.relativePath);
    if (record === void 0 || record.entry !== entry)
      throw new DerivedCacheError("cache-corrupt", "Cache deletion did not name an inspected entry");
    const target = await this.checked(record);
    await rm11(target);
    this.records.delete(entry.relativePath);
  }
  async checked(record, checkMtime = true) {
    const target = (await this.paths.resolveRead(record.entry.relativePath)).realTarget;
    const current = await lstat9(target, { bigint: true });
    if (!current.isFile() || current.isSymbolicLink() || current.dev !== record.identity.dev || current.ino !== record.identity.ino || current.size !== record.identity.size || checkMtime && current.mtimeNs !== record.identity.mtimeNs)
      throw new DerivedCacheError("cache-corrupt", `Derived cache changed during admission: ${record.entry.relativePath}`);
    return target;
  }
  async writeNew(write) {
    checkAdmission(this.signal, this.deadline);
    const initial = (await this.paths.resolveWrite(write.relativePath)).realTarget;
    await mkdir9(dirname7(initial), { recursive: true });
    const destination = (await this.paths.resolveWrite(write.relativePath)).realTarget;
    const temporaryRelative = `${write.relativePath}.${process.pid}.${randomUUID5()}.tmp`;
    const temporary = (await this.paths.resolveWrite(temporaryRelative)).realTarget;
    const handle = await open9(temporary, constants7.O_CREAT | constants7.O_EXCL | constants7.O_WRONLY, 384);
    let linked = false;
    let writtenIdentity;
    try {
      try {
        try {
          const bytes = Buffer.from(write.content, "utf8");
          for (let offset = 0; offset < bytes.length; ) {
            checkAdmission(this.signal, this.deadline);
            const { bytesWritten } = await handle.write(bytes.subarray(offset, offset + 64 * 1024));
            if (bytesWritten === 0)
              throw new Error("Derived cache staging write made no progress");
            offset += bytesWritten;
          }
          await handle.sync();
          writtenIdentity = await handle.stat({ bigint: true });
        } finally {
          await handle.close();
        }
        await this.paths.resolveWrite(write.relativePath);
        await this.paths.resolveWrite(temporaryRelative);
        checkAdmission(this.signal, this.deadline);
        await link4(temporary, destination);
        linked = true;
        checkAdmission(this.signal, this.deadline);
      } finally {
        await this.paths.resolveWrite(temporaryRelative);
        await rm11(temporary);
      }
      const identity = await lstat9(destination, { bigint: true });
      checkAdmission(this.signal, this.deadline);
      this.records.set(write.relativePath, { identity, entry: { relativePath: write.relativePath, bytes: Number(identity.size), lastUsedMs: Number(identity.mtimeMs), kind: classify2(write.relativePath) } });
    } catch (error) {
      if (linked && classify2(write.relativePath) === "context" && writtenIdentity !== void 0) {
        const current = await lstat9((await this.paths.resolveRead(write.relativePath)).realTarget, { bigint: true });
        if (current.dev !== writtenIdentity.dev || current.ino !== writtenIdentity.ino)
          throw new DerivedCacheError("cache-corrupt", "New context identity changed before cancelled publication cleanup");
        await rm11(destination);
      }
      throw error;
    }
  }
};
async function scan(paths, budget) {
  const records = /* @__PURE__ */ new Map();
  for (const root of roots) {
    const directory = (await paths.resolveRead(root)).realTarget;
    let handle;
    try {
      handle = await opendir2(directory);
    } catch (error) {
      if (isCode8(error, "ENOENT"))
        continue;
      throw error;
    }
    for await (const entry of handle) {
      budget.remainingEntries -= 1;
      checkDerivedCacheBudget(budget);
      const relativePath = `${root}/${entry.name}`;
      const kind = classify2(relativePath);
      const target = (await paths.resolveRead(relativePath)).realTarget;
      const identity = await lstat9(target, { bigint: true });
      if (!identity.isFile() || identity.isSymbolicLink())
        throw new DerivedCacheError("cache-corrupt", `Derived cache entry must be a regular file: ${relativePath}`);
      records.set(relativePath, { identity, entry: { relativePath, bytes: Number(identity.size), lastUsedMs: Number(identity.mtimeMs), kind } });
    }
  }
  const links = /* @__PURE__ */ new Map();
  for (const { identity } of records.values()) {
    const key = `${identity.dev}:${identity.ino}`;
    links.set(key, (links.get(key) ?? 0) + 1);
  }
  for (const { identity, entry } of records.values()) {
    if (identity.nlink !== BigInt(links.get(`${identity.dev}:${identity.ino}`)))
      throw new DerivedCacheError("cache-corrupt", `Derived cache entry has links outside the disposable cache: ${entry.relativePath}`);
  }
  return records;
}
function classify2(path) {
  const match = /^\.projector\/runtime\/(knowledge\/contexts\/[0-9a-f]{32}|impact\/[0-9a-f]{64})\.json(\.\d+\.(?:[0-9a-f-]+)\.tmp)?$/u.exec(path);
  if (match === null)
    throw new DerivedCacheError("cache-corrupt", `Unrecognized disposable cache entry: ${path}`);
  return match[2] !== void 0 ? "staging" : path.includes("/contexts/") ? "context" : "impact";
}
function checkDerivedCacheBudget(budget) {
  if (Date.now() > budget.deadline || budget.remainingEntries < 0 || budget.remainingBytes < 0)
    throw new DerivedCacheError("cache-budget", "Derived cache maintenance could not complete its bounded safety inspection; no unproven entries may be removed");
}
async function touchDerivedCacheEntry(root, relativePath) {
  classify2(relativePath);
  const paths = await RepositoryPathService.create(root);
  const target = (await paths.resolveRead(relativePath)).realTarget;
  const status = await lstat9(target);
  if (!status.isFile() || status.isSymbolicLink())
    throw new DerivedCacheError("cache-corrupt", `Invalid cache entry: ${relativePath}`);
  const now = /* @__PURE__ */ new Date();
  await utimes(target, now, now);
}
function capacity() {
  return new DerivedCacheError("cache-capacity", "Derived cache capacity cannot admit this publication including staging; finish or recover protected operations, run cache maintenance, then request fresh context");
}
function checkAdmission(signal, deadline) {
  signal?.throwIfAborted();
  if (deadline !== void 0 && Date.now() >= deadline)
    throw new DerivedCacheError("cache-budget", "Derived cache publication exceeded the operation deadline; retry with an explicit larger observation allowance");
}
function isCode8(error, code) {
  return error instanceof Error && "code" in error && error.code === code;
}

// node_modules/@projector/runtime/dist/migrations/project-backup.js
import { createHash as createHash4, randomUUID as randomUUID6 } from "node:crypto";
import { constants as constants8 } from "node:fs";
import { link as link5, lstat as lstat10, open as open10, opendir as opendir3, rm as rm12 } from "node:fs/promises";
import { isAbsolute as isAbsolute2, join as join10, relative as relative3, resolve as resolve2 } from "node:path";
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
  const sourceRoot = containedPath(repositoryRoot, join10(repositoryRoot, ".projector"), "project source");
  const backupId = (dependencies.createBackupId ?? randomUUID6)();
  const temporaryId = (dependencies.createTemporaryId ?? randomUUID6)();
  assertBackupId(backupId);
  assertBackupId(temporaryId);
  await assertRegularDirectory(repositoryRoot, "Repository root");
  await assertRegularDirectory(sourceRoot, "Projector source directory");
  await assertRegularDirectory(codexDataRoot, "Codex data root");
  const excludedPaths = await authenticateCoordination(input.coordination);
  const fileName = `projector-backup-${backupId}.pba`;
  const backupPath = containedPath(codexDataRoot, join10(codexDataRoot, fileName), "backup archive");
  const temporaryPath = containedPath(codexDataRoot, join10(codexDataRoot, `.projector-backup-${backupId}.${temporaryId}.tmp`), "backup staging archive");
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
    const archiveHash = createHash4("sha256");
    const output = await open10(temporaryPath, "wx", 384);
    try {
      for (const bytes of [archiveMagic, lengthBytes, manifestBytes]) {
        await writeAll2(output, bytes);
        archiveHash.update(bytes);
      }
      for (const file of initial.files) {
        const source = await openRegularFile(join10(sourceRoot, ...file.path.split("/")), "r", `.projector/${file.path}`);
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
      await link5(temporaryPath, backupPath);
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
    await rm12(temporaryPath);
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
  return contentHash3(createHash4("sha256").update(bytes).digest("hex"));
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
  const backupPath = containedPath(codexDataRoot, join10(codexDataRoot, ...input.backup.location.path.split("/")), "recorded backup archive");
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
  const handle = await open10(path, "r");
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
    const archiveHash = createHash4("sha256");
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
      const digest = createHash4("sha256");
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
      const path = join10(directory, name);
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
  const digest = createHash4("sha256");
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
  const digest = createHash4("sha256");
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
async function readExact(handle, position2, length) {
  const bytes = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const result = await handle.read(bytes, offset, length - offset, position2 + offset);
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
  const flags = (mode === "r" ? constants8.O_RDONLY : constants8.O_RDWR) | (constants8.O_NOFOLLOW ?? 0);
  return open10(path, flags);
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
  if (offset === "" || offset === ".." || offset.startsWith("..\\") || offset.startsWith("../") || isAbsolute2(offset)) {
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
  return keys.length === expected.length && keys.every((key, index2) => key === expected[index2]);
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
  DERIVED_CACHE_MAX_BYTES,
  DerivedCacheError,
  withDerivedCacheAdmission,
  checkDerivedCacheBudget,
  touchDerivedCacheEntry,
  ProjectBackupError,
  createProjectBackup,
  hashProjectBackupManifest,
  hashProjectBackupArchive,
  verifyProjectBackup
};
/*! For license information please see shared-3WNQLUKU.js.LEGAL.txt */
