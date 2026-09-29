import {
  __export
} from "./shared-WC2OT3WX.js";

// node_modules/@projector/core/dist/observation.js
import { z } from "zod";
var ObservationLimitsSchema = z.object({
  maxFiles: z.number().int().positive().safe().nullable(),
  maxDirectories: z.number().int().positive().safe().nullable(),
  maxFileBytes: z.number().int().positive().safe().nullable(),
  maxTotalBytes: z.number().int().positive().safe().nullable(),
  maxGitOutputBytes: z.number().int().positive().safe().nullable(),
  timeoutMs: z.number().int().positive().safe().nullable(),
  maxWorkerHeapMiB: z.number().int().positive().safe().nullable(),
  maxDerivedBytes: z.number().int().positive().safe().nullable()
}).strict();
var ObservationLimitsOverrideSchema = ObservationLimitsSchema.partial();
var DEFAULT_OBSERVATION_LIMITS = Object.freeze({
  maxFiles: null,
  maxDirectories: null,
  maxFileBytes: null,
  maxTotalBytes: null,
  maxGitOutputBytes: null,
  timeoutMs: null,
  maxWorkerHeapMiB: null,
  maxDerivedBytes: null
});
function observationLimitValue(limit) {
  return limit ?? Infinity;
}
function resolveObservationLimits(overrides = {}) {
  const parsed = ObservationLimitsOverrideSchema.safeParse(overrides);
  if (!parsed.success)
    throw new ObservationError("observation-failed", "limits", ".", `Invalid observation limits: ${parsed.error.message}`);
  return ObservationLimitsSchema.parse({ ...DEFAULT_OBSERVATION_LIMITS, ...parsed.data });
}
var ObservationDescriptorSchema = z.object({
  schemaVersion: z.literal("projector.observation/v1"),
  observerVersion: z.string(),
  scope: z.literal("."),
  enumerationMethod: z.enum(["git-index-and-nonignored-untracked", "recursive-filesystem-fallback", "git-immutable-tree"]),
  limits: ObservationLimitsSchema,
  ignoreSources: z.array(z.object({ path: z.string(), contentHash: z.string() }).strict()),
  excludedPaths: z.array(z.string()),
  globalGitConfig: z.literal("disabled")
}).strict();
var ObservationError = class extends Error {
  code;
  stage;
  scope;
  limit;
  observed;
  constructor(code, stage, scope, message, limit, observed) {
    super(message);
    this.code = code;
    this.stage = stage;
    this.scope = scope;
    this.limit = limit;
    this.observed = observed;
    this.name = "ObservationError";
  }
};
var ObservationBudget = class {
  limits;
  deadline;
  counts = { maxFiles: 0, maxDirectories: 0, maxTotalBytes: 0, maxGitOutputBytes: 0 };
  constructor(overrides = {}, startedAt = Date.now()) {
    this.limits = resolveObservationLimits(overrides);
    this.deadline = this.limits.timeoutMs === null ? Infinity : startedAt + this.limits.timeoutMs;
  }
  remainingMs() {
    return Math.max(0, this.deadline - Date.now());
  }
  remaining(limit) {
    return observationLimitValue(this.limits[limit]) - this.counts[limit];
  }
  check(stage, scope = ".") {
    if (this.limits.timeoutMs !== null && this.remainingMs() === 0)
      throw new ObservationError("observation-limit-exceeded", stage, scope, "Repository observation deadline exceeded; explicitly increase timeoutMs to retry.", "timeoutMs", this.limits.timeoutMs);
  }
  consume(limit, amount, stage, scope = ".") {
    this.check(stage, scope);
    if (!Number.isSafeInteger(amount) || amount < 0)
      throw new ObservationError("observation-failed", stage, scope, "Observation accounting requires a nonnegative safe integer.");
    const observed = this.counts[limit] + amount;
    if (observed > observationLimitValue(this.limits[limit]))
      throw new ObservationError("observation-limit-exceeded", stage, scope, `Repository observation exceeds ${limit} (${this.limits[limit]}); explicitly increase this limit to retry.`, limit, observed);
    this.counts[limit] = observed;
  }
  assertFileBytes(bytes, scope) {
    this.check("file-read", scope);
    if (bytes > observationLimitValue(this.limits.maxFileBytes))
      throw new ObservationError("observation-limit-exceeded", "file-read", scope, `File exceeds maxFileBytes (${this.limits.maxFileBytes}); explicitly increase this limit to retry.`, "maxFileBytes", bytes);
  }
  assertTotalBytes(bytes, scope) {
    this.check("file-read", scope);
    if (bytes > this.remaining("maxTotalBytes"))
      throw new ObservationError("observation-limit-exceeded", "file-read", scope, `Repository observation exceeds maxTotalBytes (${this.limits.maxTotalBytes}); explicitly increase this limit to retry.`, "maxTotalBytes", this.counts.maxTotalBytes + bytes);
  }
};
var DerivedObservationBudget = class {
  maxDerivedBytes;
  consumed = 0;
  constructor(maxDerivedBytes = DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes) {
    this.maxDerivedBytes = maxDerivedBytes;
    if (maxDerivedBytes !== null && (!Number.isSafeInteger(maxDerivedBytes) || maxDerivedBytes <= 0))
      throw new ObservationError("observation-failed", "derived-limits", ".", "maxDerivedBytes must be a positive safe integer or null.");
  }
  get usedBytes() {
    return this.consumed;
  }
  release(bytes) {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > this.consumed)
      throw new ObservationError("observation-failed", "derived-release", ".", "Cannot release unreserved derived allocation bytes.");
    this.consumed -= bytes;
  }
  reserve(bytes, stage, scope = ".") {
    if (!Number.isSafeInteger(bytes) || bytes < 0)
      throw new ObservationError("observation-failed", stage, scope, "Derived allocation accounting requires a nonnegative safe integer.");
    const observed = this.consumed + bytes;
    if (observed > observationLimitValue(this.maxDerivedBytes))
      throw new ObservationError("observation-limit-exceeded", stage, scope, `Derived observation exceeds maxDerivedBytes (${this.maxDerivedBytes}); explicitly increase this limit to retry.`, "maxDerivedBytes", observed);
    this.consumed = observed;
  }
  reserveString(length, stage, scope = ".") {
    this.reserve(24 + 2 * length, stage, scope);
  }
  reserveItems(count, itemBytes, stage, scope = ".") {
    this.reserve(count * itemBytes, stage, scope);
  }
};

// node_modules/@projector/core/dist/code-intelligence.js
import { z as z2 } from "zod";
var CodeLocationSchema = z2.object({
  path: z2.string().min(1),
  start: z2.number().int().nonnegative(),
  end: z2.number().int().nonnegative(),
  line: z2.number().int().positive(),
  column: z2.number().int().positive()
}).strict().refine((value) => value.end >= value.start);
var CodeProvenanceSchema = z2.object({
  provider: z2.string().min(1),
  version: z2.string().min(1),
  inputHash: z2.string().min(1),
  artifact: z2.string().optional()
}).strict();
var CodeSymbolSchema = z2.object({
  id: z2.string().min(1),
  name: z2.string(),
  kind: z2.string().min(1),
  definition: CodeLocationSchema,
  extent: CodeLocationSchema,
  typeDisplay: z2.string().optional(),
  declarationHash: z2.string().min(1),
  bodyHash: z2.string().optional(),
  provenance: CodeProvenanceSchema
}).strict();
var CodeEdgeSchema = z2.object({
  id: z2.string().min(1),
  kind: z2.enum([
    "reference",
    "import",
    "call",
    "type",
    "implementation",
    "bridge"
  ]),
  source: CodeLocationSchema,
  sourceSymbolId: z2.string().optional(),
  targetSymbolId: z2.string().optional(),
  targetPath: z2.string().optional(),
  resolution: z2.enum(["resolved", "unresolved", "unknown"]),
  provenance: CodeProvenanceSchema
}).strict().superRefine((value, context) => {
  if (value.resolution === "resolved" && value.targetSymbolId === void 0 && value.targetPath === void 0)
    context.addIssue({
      code: "custom",
      message: "resolved edge needs a target"
    });
  if (value.resolution !== "resolved" && (value.targetSymbolId !== void 0 || value.targetPath !== void 0))
    context.addIssue({
      code: "custom",
      message: "unresolved edge cannot claim a target"
    });
});
var CodeCapabilitySchema = z2.object({
  kind: z2.enum([
    "definition",
    "reference",
    "import",
    "call",
    "type",
    "implementation"
  ]),
  fidelity: z2.enum(["semantic", "index", "syntax"]),
  status: z2.enum(["available", "partial", "unavailable"]),
  reason: z2.string().optional()
}).strict();
var CodeCoverageSchema = z2.object({
  path: z2.string().min(1),
  status: z2.enum(["complete", "partial", "unavailable"]),
  reason: z2.string().optional(),
  capabilities: z2.array(CodeCapabilitySchema)
}).strict();
var CodePartitionSchema = z2.object({
  path: z2.string().min(1),
  inputHash: z2.string().min(1),
  symbols: z2.array(CodeSymbolSchema),
  edges: z2.array(CodeEdgeSchema),
  coverage: CodeCoverageSchema
}).strict();
var CodeInputBindingSchema = z2.object({
  status: z2.enum(["verified", "unbound"]),
  checkoutId: z2.string().min(1),
  worktreeDigest: z2.string().min(1),
  projectKey: z2.string().min(1),
  sourceInputs: z2.array(z2.object({ path: z2.string().min(1), contentHash: z2.string().min(1) }).strict()),
  configInputs: z2.array(z2.object({ path: z2.string().min(1), contentHash: z2.string().min(1) }).strict()),
  resolutionInputs: z2.array(z2.object({ path: z2.string().min(1), contentHash: z2.string().min(1) }).strict()),
  resolutionProbes: z2.array(z2.object({ path: z2.string().min(1), exists: z2.boolean() }).strict()).optional(),
  directoryProbes: z2.array(z2.object({ path: z2.string().min(1), exists: z2.boolean() }).strict()).optional(),
  directoryListings: z2.array(z2.object({
    path: z2.string().min(1),
    directories: z2.array(z2.string().min(1))
  }).strict()).optional()
}).strict();
var CodeSnapshotSchema = z2.object({
  schemaVersion: z2.literal("projector.code-intelligence/v1"),
  provider: z2.string().min(1),
  providerVersion: z2.string().min(1),
  inputFingerprint: z2.string().min(1),
  configFingerprint: z2.string().min(1),
  resolutionFingerprint: z2.string().min(1),
  binding: CodeInputBindingSchema,
  partitions: z2.array(CodePartitionSchema)
}).strict();
var CodeQuerySchema = z2.object({
  schemaVersion: z2.literal("projector.code-query/v1"),
  generation: z2.string().min(1),
  kind: z2.enum([
    "definition",
    "reference",
    "import",
    "call",
    "type",
    "implementation",
    "symbol"
  ]),
  direction: z2.enum(["incoming", "outgoing"]).default("incoming"),
  symbolId: z2.string().optional(),
  path: z2.string().optional(),
  limit: z2.number().int().min(1).max(1e3).default(100),
  cursor: z2.string().optional()
}).strict().refine((value) => value.symbolId !== void 0 || value.path !== void 0, "symbolId or path required");
var CodeQueryResultSchema = z2.object({
  schemaVersion: z2.literal("projector.code-query-result/v1"),
  generation: z2.string().min(1),
  symbols: z2.array(CodeSymbolSchema),
  edges: z2.array(CodeEdgeSchema),
  coverage: z2.array(CodeCoverageSchema),
  nextCursor: z2.string().optional()
}).strict();
var CodeNeighborhoodSchema = z2.object({
  generation: z2.string().min(1),
  path: z2.string().min(1),
  symbols: z2.array(CodeSymbolSchema),
  incoming: z2.array(CodeEdgeSchema),
  outgoing: z2.array(CodeEdgeSchema),
  coverage: CodeCoverageSchema.optional(),
  relatedPaths: z2.array(z2.string()),
  truncated: z2.boolean()
}).strict();

// node_modules/@projector/core/dist/authorization/write-scope.js
var compareStrings = (left, right) => left < right ? -1 : left > right ? 1 : 0;
function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/gu, "\\$&");
}
function compileCanonicalGlob(glob) {
  if (glob.length === 0 || glob.length > 512 || glob.includes("\0")) {
    throw new TypeError("invalid or oversized glob selector");
  }
  let result = "^";
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index];
    if (character === "*") {
      if (glob[index + 1] === "*") {
        index += 1;
        if (glob[index + 1] === "/") {
          index += 1;
          result += "(?:[^/]+/)*";
        } else {
          result += ".*";
        }
      } else {
        result += "[^/]*";
      }
    } else if (character === "?") {
      result += "[^/]";
    } else {
      result += escapeRegex(character);
    }
  }
  return new RegExp(`${result}$`, "u");
}
function validateCanonicalGlob(glob) {
  compileCanonicalGlob(glob);
}
function matchesCanonicalGlob(glob, candidate) {
  if (candidate.length > 4096)
    return false;
  try {
    return compileCanonicalGlob(glob).test(candidate.replaceAll("\\", "/"));
  } catch {
    return false;
  }
}
function normalizedRepositoryValue(value) {
  if (value.length === 0 || value.length > 4096 || value.includes("\0"))
    return void 0;
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//u, "");
  if (normalized.length === 0 || normalized.startsWith("/") || /^[A-Za-z]:/u.test(normalized))
    return void 0;
  const segments = normalized.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === ".."))
    return void 0;
  return normalized;
}
function normalizeRepositoryRelativePath(path) {
  return normalizedRepositoryValue(path);
}
function normalizePathPredicate(matcher, value) {
  const normalized = normalizedRepositoryValue(value);
  if (normalized === void 0)
    return void 0;
  if (matcher === "glob") {
    try {
      validateCanonicalGlob(normalized);
    } catch {
      return void 0;
    }
  }
  return Object.freeze({ matcher, value: normalized });
}
function compileSelectorPathScope(selector, operation) {
  if (selector.op === "atom") {
    if (selector.field === "path" && (selector.matcher === "equals" || selector.matcher === "glob") && typeof selector.value === "string") {
      const predicate = normalizePathPredicate(selector.matcher, selector.value);
      return predicate === void 0 ? { supported: false, satisfiable: false, predicates: [] } : { supported: true, satisfiable: true, predicates: [predicate] };
    }
    if (selector.field === "operation" && selector.matcher === "equals" && typeof selector.value === "string") {
      return { supported: true, satisfiable: selector.value === operation, predicates: [] };
    }
    return { supported: false, satisfiable: false, predicates: [] };
  }
  if (selector.op !== "all")
    return { supported: false, satisfiable: false, predicates: [] };
  const children = selector.items.map((item) => compileSelectorPathScope(item, operation));
  if (children.some((child) => !child.supported)) {
    return { supported: false, satisfiable: false, predicates: [] };
  }
  const predicates = /* @__PURE__ */ new Map();
  for (const predicate of children.flatMap((child) => child.predicates)) {
    predicates.set(`${predicate.matcher}\0${predicate.value}`, predicate);
  }
  return {
    supported: true,
    satisfiable: children.every((child) => child.satisfiable),
    predicates: Object.freeze([...predicates.values()].sort((left, right) => compareStrings(left.matcher, right.matcher) || compareStrings(left.value, right.value)))
  };
}
function compileGrants(grants, operation) {
  const compiled = grants.filter((grant) => grant.operations.includes(operation)).map((grant) => compileSelectorPathScope(grant.selector, operation));
  return {
    supported: compiled.every((scope) => scope.supported),
    scopes: Object.freeze(compiled.filter((scope) => scope.satisfiable).map((scope) => Object.freeze([...scope.predicates])))
  };
}
function compileWriteAuthorization(input) {
  const allowed = compileGrants(input.allowedWrites, input.operation);
  const forbidden = compileGrants(input.forbiddenWrites, input.operation);
  const enforceable = allowed.supported && forbidden.supported;
  const reasons = [];
  if (!allowed.supported)
    reasons.push("allowed write selector cannot be enforced deterministically");
  if (!forbidden.supported)
    reasons.push("forbidden write selector cannot be enforced deterministically");
  const globallyForbidden = forbidden.scopes.some((scope) => scope.length === 0);
  const operationGranted = enforceable && allowed.scopes.length > 0 && !globallyForbidden;
  if (!operationGranted && enforceable)
    reasons.push(`capsule operation is not granted for mutation: ${input.operation}`);
  return Object.freeze({
    operation: input.operation,
    enforceable,
    operationGranted,
    allowedPathScopes: allowed.scopes,
    forbiddenPathScopes: forbidden.scopes,
    reasons: Object.freeze(reasons)
  });
}
function predicateMatches(predicate, path) {
  return predicate.matcher === "equals" ? path === predicate.value : matchesCanonicalGlob(predicate.value, path);
}
function scopeMatches(scope, path) {
  return scope.every((predicate) => predicateMatches(predicate, path));
}
function authorizeRepositoryPath(authorization, path) {
  if (!authorization.enforceable)
    return Object.freeze({ authorized: false, reason: "unsupported-selector" });
  if (!authorization.operationGranted)
    return Object.freeze({ authorized: false, reason: "operation-not-granted" });
  const normalized = normalizeRepositoryRelativePath(path);
  if (normalized === void 0)
    return Object.freeze({ authorized: false, reason: "invalid-repository-path" });
  if (!authorization.allowedPathScopes.some((scope) => scopeMatches(scope, normalized))) {
    return Object.freeze({ authorized: false, reason: "outside-allowed-scope" });
  }
  if (authorization.forbiddenPathScopes.some((scope) => scopeMatches(scope, normalized))) {
    return Object.freeze({ authorized: false, reason: "forbidden-scope" });
  }
  return Object.freeze({ authorized: true, reason: "authorized" });
}

// node_modules/@projector/core/dist/hashing/canonical-json.js
import { createHash } from "node:crypto";
function serialize(value, seen, inArray) {
  if (value === void 0) {
    if (inArray) {
      throw new TypeError("undefined array elements are not JSON values");
    }
    return void 0;
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
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
          throw new TypeError(`sparse array hole at index ${index} is not a JSON value`);
        }
      }
      return `[${value.map((item) => serialize(item, seen, true)).join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("only plain objects are JSON values");
    }
    const entries = [];
    for (const key2 of Object.keys(value).sort()) {
      const item = serialize(value[key2], seen, false);
      if (item !== void 0) {
        entries.push(`${JSON.stringify(key2)}:${item}`);
      }
    }
    return `{${entries.join(",")}}`;
  } finally {
    seen.delete(value);
  }
}
function canonicalJson(value) {
  const result = serialize(value, /* @__PURE__ */ new Set(), false);
  if (result === void 0) {
    throw new TypeError("top-level undefined is not a JSON value");
  }
  return result;
}
function parseCanonicalJson(source) {
  let offset = 0;
  const whitespace = () => {
    while (/\s/u.test(source[offset] ?? ""))
      offset += 1;
  };
  const fail = (message) => {
    throw new SyntaxError(`${message} at offset ${offset}`);
  };
  const string = () => {
    const start = offset;
    if (source[offset] !== '"')
      fail("expected string");
    offset += 1;
    while (offset < source.length) {
      const character = source[offset];
      if (character === '"') {
        offset += 1;
        return JSON.parse(source.slice(start, offset));
      }
      if (character === "\\") {
        offset += 2;
      } else {
        offset += 1;
      }
    }
    return fail("unterminated string");
  };
  const value = () => {
    whitespace();
    const character = source[offset];
    if (character === '"')
      return string();
    if (character === "{") {
      offset += 1;
      const result = {};
      const keys = /* @__PURE__ */ new Set();
      whitespace();
      if (source[offset] === "}") {
        offset += 1;
        return result;
      }
      while (true) {
        whitespace();
        const key2 = string();
        if (keys.has(key2))
          fail(`duplicate object key ${JSON.stringify(key2)}`);
        keys.add(key2);
        whitespace();
        if (source[offset] !== ":")
          fail("expected colon");
        offset += 1;
        result[key2] = value();
        whitespace();
        if (source[offset] === "}") {
          offset += 1;
          return result;
        }
        if (source[offset] !== ",")
          fail("expected comma");
        offset += 1;
      }
    }
    if (character === "[") {
      offset += 1;
      const result = [];
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
        if (source[offset] !== ",")
          fail("expected comma");
        offset += 1;
      }
    }
    for (const [token, parsed2] of [["true", true], ["false", false], ["null", null]]) {
      if (source.startsWith(token, offset)) {
        offset += token.length;
        return parsed2;
      }
    }
    const number = source.slice(offset).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u)?.[0];
    if (number !== void 0) {
      offset += number.length;
      const parsed2 = Number(number);
      if (!Number.isFinite(parsed2))
        fail("JSON number must be finite");
      return parsed2;
    }
    return fail("expected JSON value");
  };
  const parsed = value();
  whitespace();
  if (offset !== source.length)
    fail("unexpected trailing input");
  return parsed;
}
function frame(value) {
  const length = Buffer.allocUnsafe(8);
  length.writeBigUInt64BE(BigInt(value.byteLength));
  return Buffer.concat([length, value]);
}
function hashFramedDomain(domain, ...values) {
  const hash = createHash("sha256");
  hash.update(frame(Buffer.from("projector\0sha256\0v1", "utf8")));
  hash.update(frame(Buffer.from(domain, "utf8")));
  for (const value of values) {
    hash.update(frame(Buffer.from(canonicalJson(value), "utf8")));
  }
  return `sha256:v1:${hash.digest("hex")}`;
}
function hashFramedCanonicalJsonChunks(domain, chunks) {
  function* utf8Chunks() {
    let pending = "";
    for (const chunk of chunks()) {
      const value = pending + chunk;
      const last = value.charCodeAt(value.length - 1);
      const hasHighSurrogate = last >= 55296 && last <= 56319;
      pending = hasHighSurrogate ? value.slice(-1) : "";
      yield hasHighSurrogate ? value.slice(0, -1) : value;
    }
    if (pending !== "")
      yield pending;
  }
  let byteLength = 0;
  for (const chunk of utf8Chunks())
    byteLength += Buffer.byteLength(chunk, "utf8");
  const hash = createHash("sha256");
  hash.update(frame(Buffer.from("projector\0sha256\0v1", "utf8")));
  hash.update(frame(Buffer.from(domain, "utf8")));
  const length = Buffer.allocUnsafe(8);
  length.writeBigUInt64BE(BigInt(byteLength));
  hash.update(length);
  for (const chunk of utf8Chunks())
    hash.update(chunk, "utf8");
  return `sha256:v1:${hash.digest("hex")}`;
}

// node_modules/@projector/core/dist/hashing/merkle-manifest.js
var bucketSize = 32;
function manifestKey(path) {
  return hashFramedDomain("projector-manifest-key/v1", path).slice("sha256:v1:".length);
}
function leaf(prefix, entries) {
  const sorted = [...entries].sort((a, b) => a.key.localeCompare(b.key));
  return { kind: "leaf", entries: sorted, count: sorted.length, digest: hashFramedDomain("projector-manifest-leaf/v1", { prefix, entries: sorted }) };
}
function branch(prefix, children) {
  const ordered = Object.fromEntries(Object.entries(children).sort(([a], [b]) => a.localeCompare(b)));
  return { kind: "branch", children: ordered, count: Object.values(ordered).reduce((sum, child) => sum + child.count, 0), digest: hashFramedDomain("projector-manifest-branch/v1", { prefix, children: ordered }) };
}
function build(prefix, entries, nodes) {
  if (entries.length <= bucketSize) {
    const node2 = leaf(prefix, entries);
    nodes.set(prefix, node2);
    return node2;
  }
  if (prefix.length >= 64)
    throw new Error("Manifest hash collision exceeds bounded leaf capacity");
  const groups = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const digit = entry.key[prefix.length];
    const group = groups.get(digit) ?? [];
    group.push(entry);
    groups.set(digit, group);
  }
  const children = {};
  for (const [digit, group] of groups) {
    const node2 = build(prefix + digit, group, nodes);
    children[digit] = { digest: node2.digest, count: node2.count };
  }
  const node = branch(prefix, children);
  nodes.set(prefix, node);
  return node;
}
function buildManifest(entries) {
  if (entries.some((entry) => !/^[0-9a-f]{64}$/u.test(entry.key)) || new Set(entries.map((entry) => entry.key)).size !== entries.length)
    throw new Error("Manifest contains invalid or duplicate keys");
  const nodes = /* @__PURE__ */ new Map();
  const root = build("", entries, nodes);
  return { root: root.digest, nodes, removed: [] };
}
function updateManifest(root, changes, read) {
  const nodes = /* @__PURE__ */ new Map(), removed = /* @__PURE__ */ new Set();
  const load = (prefix, expected) => {
    const value = nodes.get(prefix) ?? read(prefix);
    if (value === null || typeof value !== "object")
      throw new Error(`Manifest node missing: ${prefix}`);
    const node = value;
    if (!Number.isSafeInteger(node.count) || node.count < 0 || node.digest !== expected.digest || node.count !== expected.count)
      throw new Error(`Manifest node identity mismatch: ${prefix}`);
    let computed;
    if (node.kind === "leaf" && Array.isArray(node.entries)) {
      if (node.entries.length !== node.count || node.entries.some((entry) => typeof entry.key !== "string" || !/^[0-9a-f]{64}$/u.test(entry.key) || !entry.key.startsWith(prefix)) || new Set(node.entries.map((entry) => entry.key)).size !== node.entries.length)
        throw new Error(`Manifest leaf invalid: ${prefix}`);
      computed = leaf(prefix, node.entries);
    } else if (node.kind === "branch" && node.children !== null && typeof node.children === "object") {
      if (prefix.length >= 64 || Object.entries(node.children).some(([digit, child]) => !/^[0-9a-f]$/u.test(digit) || !Number.isSafeInteger(child.count) || child.count < 1 || typeof child.digest !== "string"))
        throw new Error(`Manifest branch invalid: ${prefix}`);
      computed = branch(prefix, node.children);
    } else
      throw new Error(`Manifest node invalid: ${prefix}`);
    if (computed.digest !== expected.digest || computed.count !== expected.count)
      throw new Error(`Manifest node content mismatch: ${prefix}`);
    return node;
  };
  const collect = (prefix, reference2) => {
    const node = load(prefix, reference2);
    removed.add(prefix);
    nodes.delete(prefix);
    return node.kind === "leaf" ? [...node.entries] : Object.entries(node.children).flatMap(([digit, child]) => collect(prefix + digit, child));
  };
  const apply = (prefix, reference2, change) => {
    const node = load(prefix, reference2);
    if (node.kind === "leaf") {
      const entries = node.entries.filter((entry) => entry.key !== change.key);
      if ("value" in change)
        entries.push({ key: change.key, value: change.value });
      return build(prefix, entries, nodes);
    }
    const digit = change.key[prefix.length], children = { ...node.children }, prior = children[digit];
    let next;
    if (prior === void 0) {
      if (!("value" in change))
        return node;
      next = build(prefix + digit, [{ key: change.key, value: change.value }], nodes);
    } else
      next = apply(prefix + digit, prior, change);
    if (next.count === 0) {
      delete children[digit];
      removed.add(prefix + digit);
      nodes.delete(prefix + digit);
    } else
      children[digit] = { digest: next.digest, count: next.count };
    const count = Object.values(children).reduce((sum, child) => sum + child.count, 0);
    if (count <= bucketSize) {
      const entries = Object.entries(children).flatMap(([childDigit, child]) => collect(prefix + childDigit, child));
      return build(prefix, entries, nodes);
    }
    const updated = branch(prefix, children);
    nodes.set(prefix, updated);
    return updated;
  };
  const rootValue = read("");
  if (rootValue === void 0 || rootValue.digest !== root)
    throw new Error("Manifest root unavailable");
  let reference = { digest: root, count: rootValue.count };
  for (const change of changes) {
    if (!/^[0-9a-f]{64}$/u.test(change.key))
      throw new Error("Manifest change key invalid");
    const node = apply("", reference, change);
    reference = { digest: node.digest, count: node.count };
  }
  return { root: reference.digest, nodes, removed: [...removed].filter((prefix) => !nodes.has(prefix)) };
}

// node_modules/@projector/core/dist/hashing/projections.js
var profiles = /* @__PURE__ */ new Map();
function normalizeProfile(profile) {
  return {
    semantic: [...new Set(profile.semantic)].sort(),
    discovery: [...new Set(profile.discovery)].sort(),
    volatile: [...new Set(profile.volatile)].sort(),
    ...profile.exactDocument === void 0 ? {} : { exactDocument: [...new Set(profile.exactDocument)].sort() }
  };
}
function pathsOverlap(left, right) {
  return left === right || left.startsWith(`${right}.`) || right.startsWith(`${left}.`);
}
function validateProfile(kind, profile) {
  const persistedProjections = [
    ["semantic", profile.semantic],
    ["discovery", profile.discovery],
    ["exact-document", profile.exactDocument ?? []]
  ];
  for (const volatilePath of profile.volatile) {
    for (const [projectionName, projectionPaths] of persistedProjections) {
      const projectionPath = projectionPaths.find((path) => pathsOverlap(volatilePath, path));
      if (projectionPath !== void 0) {
        throw new Error(`hash profile ${kind} volatile path "${volatilePath}" overlaps ${projectionName} path "${projectionPath}"`);
      }
    }
  }
}
function registerHashProfile(kind, profile) {
  const normalized = normalizeProfile(profile);
  validateProfile(kind, normalized);
  const existing = profiles.get(kind);
  if (existing !== void 0 && canonicalJson(existing) !== canonicalJson(normalized)) {
    throw new Error(`hash profile ${kind} is already registered differently`);
  }
  profiles.set(kind, normalized);
}
function getHashProfile(kind) {
  const profile = profiles.get(kind);
  if (profile === void 0) {
    throw new Error(`no registered hash projection for ${kind}`);
  }
  return profile;
}
function atPath(value, path) {
  let current = value;
  for (const segment of path.split(".")) {
    if (typeof current !== "object" || current === null || !(segment in current)) {
      return void 0;
    }
    current = current[segment];
  }
  return current;
}
function select(value, paths) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("hash projections require an object");
  }
  return Object.fromEntries(paths.map((path) => [path, atPath(value, path)]));
}
function exactProjection(value, profile) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("canonical documents require an object");
  }
  if (profile.exactDocument !== void 0) {
    return select(value, profile.exactDocument);
  }
  const result = { ...value };
  const omit = (target, path) => {
    const [head, ...tail] = path.split(".");
    if (head === void 0)
      return;
    if (tail.length === 0) {
      delete target[head];
      return;
    }
    const child = target[head];
    if (typeof child !== "object" || child === null || Array.isArray(child))
      return;
    const cloned = { ...child };
    target[head] = cloned;
    omit(cloned, tail.join("."));
  };
  omit(result, "canonicalDocumentHash");
  for (const path of profile.volatile) {
    omit(result, path);
    if (typeof result.payload === "object" && result.payload !== null) {
      omit(result, `payload.${path}`);
    }
  }
  return result;
}
function hashSemantic(kind, value) {
  const profile = getHashProfile(kind);
  return hashFramedDomain("semantic", { kind, projection: select(value, profile.semantic) });
}
function hashDiscovery(kind, value) {
  const profile = getHashProfile(kind);
  return hashFramedDomain("discovery", { kind, projection: select(value, profile.discovery) });
}
function hashCanonicalDocument(kind, value) {
  const profile = getHashProfile(kind);
  return hashFramedDomain("canonical-document", { kind, document: exactProjection(value, profile) });
}
function hashRootManifest(entries) {
  const sorted = [...entries].sort((left, right) => Buffer.compare(Buffer.from(left.entityId), Buffer.from(right.entityId)) || Buffer.compare(Buffer.from(left.canonicalDocumentHash), Buffer.from(right.canonicalDocumentHash)));
  const duplicate = sorted.find((entry, index) => entry.entityId === sorted[index - 1]?.entityId);
  if (duplicate !== void 0) {
    throw new Error(`duplicate canonical root entity ID: ${duplicate.entityId}`);
  }
  return hashFramedDomain("canonical-root", sorted);
}

// node_modules/@projector/core/dist/hashing/builtin-profiles.js
var profiles2 = {
  concept: {
    semantic: ["kind", "statement", "status", "tags"],
    discovery: ["key", "name", "aliases"],
    volatile: []
  },
  requirement: {
    semantic: ["statement", "status", "scope"],
    discovery: ["key", "title", "aliases"],
    volatile: []
  },
  "behavioral-scenario": {
    semantic: ["status", "scope", "steps"],
    discovery: ["key", "title", "aliases"],
    volatile: []
  },
  relation: {
    semantic: ["fromId", "toId", "type", "active", "confidence"],
    discovery: [],
    volatile: []
  },
  lineage: {
    semantic: ["kind", "fromIds", "toIds", "reason", "stateDigest"],
    discovery: [],
    volatile: []
  },
  tombstone: {
    semantic: ["entityId", "deletedAtRevision", "lastSemanticHash", "replacementIds", "reason"],
    discovery: [],
    volatile: []
  },
  rule: {
    semantic: ["version", "effect", "authorityClass", "governanceBasis", "selector", "predicates", "advisoryPayload", "conflictPolicy", "validatorIds", "transformIds"],
    discovery: ["key"],
    volatile: []
  },
  "projection-lens": {
    semantic: ["version", "status", "realizesConceptKinds", "selector", "contributions", "expectedProjections", "rules", "impactRules", "recognizers", "validators", "transforms", "migrations", "conflictsWith", "compatibleWith", "authorityRecordId", "governanceBasis"],
    discovery: ["key"],
    volatile: []
  },
  "semantic-representation-profile": {
    semantic: ["version", "status", "target", "selector", "optimization", "protectedDimensions", "styleRules", "generatorId", "validatorIds", "tokenizerProfileId", "fallbackProfileId"],
    discovery: ["key"],
    volatile: []
  },
  "authority-record": {
    semantic: ["subjectId", "status", "conclusion", "assumptions", "reconsiderWhen", "evidenceRefreshPolicy", "vector", "assessmentConfidence", "evidence", "governanceRiskClass", "decidedBy"],
    discovery: ["key"],
    volatile: ["createdAt"]
  },
  "architecture-decision": {
    semantic: ["concernId", "decision", "selectedOptionKey", "scope", "lifecycle", "authorityRecordId", "governanceBasis", "consequences", "appliedPreferences", "supersedesDecisionIds", "migrationId"],
    discovery: ["key", "title"],
    volatile: []
  },
  "architecture-concern": {
    semantic: ["question", "scope", "sourceClass", "status", "materiality", "activationReasons", "relatedConceptIds", "relatedRequirementIds", "decisionIds", "deferral", "evidence"],
    discovery: ["key", "title"],
    volatile: []
  },
  "developer-preference": {
    semantic: ["scope", "selector", "strength", "statement", "status", "sourceClass"],
    discovery: ["key"],
    volatile: []
  },
  exception: {
    semantic: ["selector", "exceptedRuleIds", "exceptedLensIds", "exceptedExpectationIds", "rationale", "evidence", "owner", "reviewOrExpiryTrigger", "invalidationConditions", "exitCriteria", "status"],
    discovery: ["key"],
    volatile: []
  },
  migration: {
    semantic: ["sourceLensRef", "targetLensRef", "phase", "entryCriteria", "exitCriteria", "compatibilityStrategy", "allowedTemporaryDivergenceIds", "generatedOutputOverlays", "validationObligations", "rollbackPlan", "compensationPlan", "cleanupResidueDetector"],
    discovery: ["key"],
    volatile: []
  },
  "transaction-receipt": {
    semantic: ["planId", "semanticChangeId", "riskClass", "beforeState", "afterState", "changedCanonicalEntityIds", "changedRequirementIds", "changedScenarioIds", "changedUnitIds", "validationSummaryHash", "certificateHash", "rollbackRef"],
    discovery: [],
    volatile: ["createdAt"]
  }
};
for (const [kind, profile] of Object.entries(profiles2)) {
  registerHashProfile(kind, profile);
}
var builtinHashProfiles = profiles2;

// node_modules/@projector/core/dist/hashing/canonical-envelope.js
var FixedCanonicalLifecycleByKind = Object.freeze({
  lineage: "active",
  rule: "active",
  tombstone: "deleted",
  "transaction-receipt": "committed"
});
function withCanonicalHashes(document) {
  const semanticHash = hashSemantic(document.kind, document.payload);
  const discoveryHash = getHashProfile(document.kind).discovery.length === 0 ? void 0 : hashDiscovery(document.kind, document.payload);
  const payload = {
    ...document.payload,
    ...Object.hasOwn(document.payload, "semanticHash") ? { semanticHash } : {},
    ...Object.hasOwn(document.payload, "discoveryHash") && discoveryHash !== void 0 ? { discoveryHash } : {}
  };
  const withoutDocumentHash = {
    ...document,
    payload,
    semanticHash,
    ...discoveryHash === void 0 ? {} : { discoveryHash }
  };
  return {
    ...withoutDocumentHash,
    canonicalDocumentHash: hashCanonicalDocument(document.kind, withoutDocumentHash)
  };
}
function verifyCanonicalEnvelope(document) {
  const errors = [];
  if (document.apiVersion.trim().length === 0 || document.schemaVersion.trim().length === 0) {
    errors.push("canonical envelope versions cannot be blank");
  }
  if (typeof document.payload.id === "string" && document.payload.id !== document.id) {
    errors.push("envelope ID must match payload ID");
  }
  if (typeof document.payload.key === "string" && document.payload.key !== document.key) {
    errors.push("envelope key must match payload key");
  }
  const derivedKey = document.kind === "relation" ? `relation:${document.id}` : document.kind === "lineage" ? `lineage:${document.id}` : document.kind === "tombstone" && typeof document.payload.entityId === "string" ? `tombstone:${document.payload.entityId}` : document.kind === "transaction-receipt" ? `receipt:${document.id}` : void 0;
  if (derivedKey !== void 0 && document.key !== derivedKey) {
    errors.push(`canonical key must be ${derivedKey}`);
  }
  const payloadLifecycle = typeof document.payload.lifecycle === "string" ? document.payload.lifecycle : typeof document.payload.status === "string" ? document.payload.status : document.kind === "relation" && typeof document.payload.active === "boolean" ? document.payload.active ? "active" : "inactive" : FixedCanonicalLifecycleByKind[document.kind];
  if (payloadLifecycle !== void 0 && payloadLifecycle !== document.lifecycle) {
    errors.push("envelope lifecycle must match payload lifecycle");
  }
  const expected = withCanonicalHashes({
    apiVersion: document.apiVersion,
    schemaVersion: document.schemaVersion,
    kind: document.kind,
    id: document.id,
    key: document.key,
    lifecycle: document.lifecycle,
    payload: document.payload
  });
  if (document.semanticHash !== expected.semanticHash)
    errors.push("semantic hash mismatch");
  if (document.discoveryHash !== expected.discoveryHash)
    errors.push("discovery hash mismatch");
  if (document.canonicalDocumentHash !== expected.canonicalDocumentHash)
    errors.push("canonical document hash mismatch");
  return errors;
}

// node_modules/@projector/core/dist/identity/identity.js
function slug(value) {
  const normalized = value.normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "entity";
}
function deriveEntityId(adapterNamespace, semanticKey, _incidental) {
  const namespace = slug(adapterNamespace);
  const key2 = semanticKey.normalize("NFKC").trim();
  if (key2.length === 0) {
    throw new Error("semantic key cannot be blank");
  }
  const digest = hashFramedDomain("derived-entity-id", { namespace, key: key2 });
  return `${namespace}_${digest.slice(-32)}`;
}
function inferEntityId(kind, semanticKey, evidenceIds) {
  const normalizedEvidenceIds = [...new Set(evidenceIds)].sort();
  const digest = hashFramedDomain("inferred-entity-id", {
    kind: kind.normalize("NFKC").trim(),
    semanticKey: semanticKey.normalize("NFKC").trim(),
    evidenceIds: normalizedEvidenceIds
  });
  return `inferred_${digest.slice(-32)}`;
}
function validateLineage(lineage) {
  const errors = [];
  if (new Set(lineage.fromIds).size !== lineage.fromIds.length) {
    errors.push("lineage source IDs must be unique");
  }
  if (new Set(lineage.toIds).size !== lineage.toIds.length) {
    errors.push("lineage destination IDs must be unique");
  }
  if (lineage.fromIds.length === 0) {
    errors.push("lineage requires at least one source");
  }
  if (lineage.kind === "move" && (lineage.fromIds.length !== 1 || lineage.toIds.length !== 1)) {
    errors.push("move lineage requires exactly one source and destination");
  }
  if (lineage.kind === "split" && lineage.toIds.length < 2) {
    errors.push("split lineage requires at least two destinations");
  }
  if (lineage.kind === "merge" && (lineage.fromIds.length < 2 || lineage.toIds.length !== 1)) {
    errors.push("merge lineage requires at least two sources and one destination");
  }
  if (lineage.kind === "replace" && lineage.toIds.length === 0) {
    errors.push("replace lineage requires at least one destination");
  }
  if (lineage.kind === "delete" && lineage.toIds.length !== 0) {
    errors.push("delete lineage cannot have destinations");
  }
  return errors;
}

// node_modules/@projector/core/dist/schemas/application-evidence-binding.js
function applicationEvidenceBindingIssues(evidence) {
  const latest = /* @__PURE__ */ new Set();
  const issues = [];
  for (const [index, reference] of evidence.entries()) {
    const binding = reference.applicationPredicate;
    if (binding?.observationRole !== "latest")
      continue;
    const group = JSON.stringify([binding.adapter.id, binding.adapter.version, binding.scenario.id, binding.case, binding.predicateId]);
    if (latest.has(group))
      issues.push({ index, message: "only one latest application observation is allowed for a canonical evidence-owner predicate" });
    latest.add(group);
  }
  return issues;
}

// node_modules/@projector/core/dist/schemas/generated-contracts.js
var generated_contracts_exports = {};
__export(generated_contracts_exports, {
  AnalysisFacetSchema: () => AnalysisFacetSchema,
  AnalyzerCapabilitiesSchema: () => AnalyzerCapabilitiesSchema,
  AnalyzerFailureSchema: () => AnalyzerFailureSchema,
  ApplicationEvidencePredicateBindingSchema: () => ApplicationEvidencePredicateBindingSchema,
  AppliedPreferenceRefSchema: () => AppliedPreferenceRefSchema,
  ArchitectureConcernSchema: () => ArchitectureConcernSchema,
  ArchitectureDecisionSchema: () => ArchitectureDecisionSchema,
  ArtifactFingerprintSchema: () => ArtifactFingerprintSchema,
  ArtifactSchema: () => ArtifactSchema,
  AuthorityAlternativeSchema: () => AuthorityAlternativeSchema,
  AuthorityClassSchema: () => AuthorityClassSchema,
  AuthorityReconsiderTriggerSchema: () => AuthorityReconsiderTriggerSchema,
  AuthorityRecordSchema: () => AuthorityRecordSchema,
  AuthorityVectorSchema: () => AuthorityVectorSchema,
  BehavioralScenarioDeltaSchema: () => BehavioralScenarioDeltaSchema,
  BehavioralScenarioSchema: () => BehavioralScenarioSchema,
  BehavioralScenarioStepSchema: () => BehavioralScenarioStepSchema,
  CausalOriginSchema: () => CausalOriginSchema,
  ChangeCertificateSchema: () => ChangeCertificateSchema,
  ChangeIntentAnalysisSchema: () => ChangeIntentAnalysisSchema,
  ChangeOperationSchema: () => ChangeOperationSchema,
  CommandSpecSchema: () => CommandSpecSchema,
  CompletionContractSchema: () => CompletionContractSchema,
  ConceptSchema: () => ConceptSchema,
  ConcernActivationReasonSchema: () => ConcernActivationReasonSchema,
  ConcernMaterialitySchema: () => ConcernMaterialitySchema,
  ContextPrecedentSchema: () => ContextPrecedentSchema,
  ControlPolicySchema: () => ControlPolicySchema,
  CoverageLaneSchema: () => CoverageLaneSchema,
  CoverageSnapshotSchema: () => CoverageSnapshotSchema,
  DecisionConsequenceSchema: () => DecisionConsequenceSchema,
  DecisionDeferralSchema: () => DecisionDeferralSchema,
  DecisionEvaluationSchema: () => DecisionEvaluationSchema,
  DecisionOptionSchema: () => DecisionOptionSchema,
  DecisionValidityAssessmentSchema: () => DecisionValidityAssessmentSchema,
  DerivationInputSchema: () => DerivationInputSchema,
  DerivationRecordSchema: () => DerivationRecordSchema,
  DeveloperPreferenceSchema: () => DeveloperPreferenceSchema,
  DivergenceSchema: () => DivergenceSchema,
  EffectiveRuleBundleSchema: () => EffectiveRuleBundleSchema,
  EnumerationContractSchema: () => EnumerationContractSchema,
  EvidenceClaimSchema: () => EvidenceClaimSchema,
  EvidenceKindSchema: () => EvidenceKindSchema,
  EvidenceRefSchema: () => EvidenceRefSchema,
  EvidenceRefreshPolicySchema: () => EvidenceRefreshPolicySchema,
  EvidenceSchema: () => EvidenceSchema,
  ExecutionCapsuleSchema: () => ExecutionCapsuleSchema,
  ExecutionPlanSchema: () => ExecutionPlanSchema,
  ExecutionPolicySchema: () => ExecutionPolicySchema,
  GovernanceBasisSchema: () => GovernanceBasisSchema,
  GovernanceExceptionSchema: () => GovernanceExceptionSchema,
  IgnorePolicySchema: () => IgnorePolicySchema,
  ImpactClosureRefSchema: () => ImpactClosureRefSchema,
  ImpactRuleSchema: () => ImpactRuleSchema,
  IntentOriginRefSchema: () => IntentOriginRefSchema,
  IntentStatementSchema: () => IntentStatementSchema,
  InvalidationCauseSchema: () => InvalidationCauseSchema,
  InvalidationEventSchema: () => InvalidationEventSchema,
  InvalidationResultSchema: () => InvalidationResultSchema,
  JsonValueSchema: () => JsonValueSchema,
  LensContributionRoleSchema: () => LensContributionRoleSchema,
  LensExampleSchema: () => LensExampleSchema,
  LensRefSchema: () => LensRefSchema,
  LineageRecordSchema: () => LineageRecordSchema,
  MigrationBindingSchema: () => MigrationBindingSchema,
  MigrationOverlaySchema: () => MigrationOverlaySchema,
  NewSemanticBoundarySchema: () => NewSemanticBoundarySchema,
  NormalizedPredicateSchema: () => NormalizedPredicateSchema,
  ObservabilityClassSchema: () => ObservabilityClassSchema,
  OperationEvidenceSchema: () => OperationEvidenceSchema,
  PatternCandidateSchema: () => PatternCandidateSchema,
  PlanCheckpointSchema: () => PlanCheckpointSchema,
  PlanningSurpriseSchema: () => PlanningSurpriseSchema,
  PreservationDimensionSchema: () => PreservationDimensionSchema,
  ProjectionExpectationSchema: () => ProjectionExpectationSchema,
  ProjectionLensSchema: () => ProjectionLensSchema,
  ProjectionSpecSchema: () => ProjectionSpecSchema,
  ProjectionUnitSchema: () => ProjectionUnitSchema,
  RealizationBindingSchema: () => RealizationBindingSchema,
  RealizationOriginRefSchema: () => RealizationOriginRefSchema,
  RealizationSelectorExprSchema: () => RealizationSelectorExprSchema,
  RecognizerBindingSchema: () => RecognizerBindingSchema,
  RelationSchema: () => RelationSchema,
  RelationTypeSchema: () => RelationTypeSchema,
  RelevanceBandSchema: () => RelevanceBandSchema,
  RelevanceClosureSchema: () => RelevanceClosureSchema,
  RelevanceEntrySchema: () => RelevanceEntrySchema,
  RelevanceReasonSchema: () => RelevanceReasonSchema,
  RelevanceSeedSchema: () => RelevanceSeedSchema,
  RepairCapabilitiesSchema: () => RepairCapabilitiesSchema,
  RepairStrategySchema: () => RepairStrategySchema,
  RepresentationProjectionRefSchema: () => RepresentationProjectionRefSchema,
  RepresentationProjectionSchema: () => RepresentationProjectionSchema,
  RepresentationStyleRuleSchema: () => RepresentationStyleRuleSchema,
  RepresentationTargetSchema: () => RepresentationTargetSchema,
  RepresentationTokenAccountingSchema: () => RepresentationTokenAccountingSchema,
  RequirementDeltaSchema: () => RequirementDeltaSchema,
  RequirementSchema: () => RequirementSchema,
  RiskAssessmentSchema: () => RiskAssessmentSchema,
  RiskClassSchema: () => RiskClassSchema,
  RollbackSpecSchema: () => RollbackSpecSchema,
  RuleConflictSchema: () => RuleConflictSchema,
  RuleEffectSchema: () => RuleEffectSchema,
  RuleSchema: () => RuleSchema,
  ScopeGrantSchema: () => ScopeGrantSchema,
  SelectorExprSchema: () => SelectorExprSchema,
  SemanticAnchorSchema: () => SemanticAnchorSchema,
  SemanticChangeSchema: () => SemanticChangeSchema,
  SemanticIdentityCandidateSchema: () => SemanticIdentityCandidateSchema,
  SemanticIdentityResolutionSchema: () => SemanticIdentityResolutionSchema,
  SemanticOperationSchema: () => SemanticOperationSchema,
  SemanticPreservationFingerprintSchema: () => SemanticPreservationFingerprintSchema,
  SemanticRepresentationProfileSchema: () => SemanticRepresentationProfileSchema,
  SemanticSignatureSchema: () => SemanticSignatureSchema,
  StateBindingSchema: () => StateBindingSchema,
  StateBindingValidationSchema: () => StateBindingValidationSchema,
  StateDependencyObservationSchema: () => StateDependencyObservationSchema,
  StateDigestSchema: () => StateDigestSchema,
  StateQueryDependencySchema: () => StateQueryDependencySchema,
  StateQueryKindSchema: () => StateQueryKindSchema,
  StateQueryResultFingerprintSchema: () => StateQueryResultFingerprintSchema,
  StateQuerySpecSchema: () => StateQuerySpecSchema,
  StateValueDependencyKindSchema: () => StateValueDependencyKindSchema,
  StateValueDependencyRefSchema: () => StateValueDependencyRefSchema,
  StructuredModelRequestSchema: () => StructuredModelRequestSchema,
  StructuredModelResponseSchema: () => StructuredModelResponseSchema,
  SurfaceApplyResultSchema: () => SurfaceApplyResultSchema,
  SurfaceCapabilitiesSchema: () => SurfaceCapabilitiesSchema,
  SurfaceChangeSchema: () => SurfaceChangeSchema,
  SurfacePlanSchema: () => SurfacePlanSchema,
  SurfaceSchema: () => SurfaceSchema,
  TombstoneSchema: () => TombstoneSchema,
  TransactionJournalEntrySchema: () => TransactionJournalEntrySchema,
  TransactionPhaseSchema: () => TransactionPhaseSchema,
  TransactionReceiptSchema: () => TransactionReceiptSchema,
  TransformBindingSchema: () => TransformBindingSchema,
  TransformPreviewSchema: () => TransformPreviewSchema,
  TransformResultSchema: () => TransformResultSchema,
  ValidationResultSchema: () => ValidationResultSchema,
  ValidatorBindingSchema: () => ValidatorBindingSchema,
  ValidityStateSchema: () => ValidityStateSchema,
  WorkPacketSchema: () => WorkPacketSchema
});
import { z as z4 } from "zod";

// node_modules/@projector/core/dist/schemas/contracts.js
import { z as z3 } from "zod";
var EntityIdSchema = z3.string().min(1).regex(/^(?!\s)(?!.*\s$)(?!\.$)(?!\.\.$)[^\\/\0]+$/u, "entity ID must be trimmed, path-independent, and free of path separators");
var ConfidenceSchema = z3.number().min(0).max(1).finite();
var ContentHashSchema = z3.string().regex(/^sha256:v1:[0-9a-f]{64}$/u, "expected a sha256:v1 content hash with 64 lowercase hexadecimal characters");
var SourceClassSchema = z3.enum(["authored", "derived", "observed", "inferred"]);
var PortableRelativePathSchema = z3.string().min(1).max(1024).regex(/^(?!\/)(?!.*:)(?!.*\\)(?!.*\0)(?!.*\/\/)(?!.*[. ](?:\/|$))(?!.*(?:^|\/)(?:[Cc][Oo][Nn]|[Pp][Rr][Nn]|[Aa][Uu][Xx]|[Nn][Uu][Ll]|[Cc][Oo][Mm][1-9]|[Ll][Pp][Tt][1-9])(?:\.[^/]*)?(?:\/|$))(?!(?:\.|\.\.)(?:\/|$))(?!.*\/(?:\.|\.\.)(?:\/|$))[^/](?:.*[^/])?$/u, "must be a portable canonical relative path without aliases, device names, or alternate data streams");
var GitRealizationLocatorSchema = z3.string().regex(/^git:(?:[a-f0-9]{40}|[a-f0-9]{64}):(?!\/)(?![A-Za-z]:)(?!.*\\)(?!.*\/\/)(?!(?:\.|\.\.)(?:\/|$))(?!.*\/(?:\.|\.\.)(?:\/|$))[^/](?:.*[^/])?$/u, "git realization origin must contain a full commit ID and canonical repository-relative path");

// node_modules/@projector/core/dist/schemas/generated-contracts.js
var JsonValueSchema = z4.lazy(() => z4.union([z4.null(), z4.boolean(), z4.number().finite(), z4.string(), z4.array(JsonValueSchema), z4.record(z4.string(), JsonValueSchema)]));
var strictObject = (shape) => z4.strictObject(shape);
var ConcernMaterialitySchema = z4.lazy(() => z4.union([z4.literal("blocking-now"), z4.literal("material-soon"), z4.literal("deferable")]));
var ConcernActivationReasonSchema = z4.lazy(() => strictObject({
  "kind": z4.union([z4.literal("requirement-delta"), z4.literal("scenario-delta"), z4.literal("relevance-discovery"), z4.literal("planning-surprise"), z4.literal("constraint-delta"), z4.literal("surface-added"), z4.literal("scale-signal"), z4.literal("pattern-friction"), z4.literal("decision-trigger"), z4.literal("research"), z4.literal("user-request"), z4.literal("inference")]),
  "subjectIds": z4.array(z4.union([EntityIdSchema, z4.string()])),
  "explanation": z4.string(),
  "causalOrigin": CausalOriginSchema
}));
var DecisionDeferralSchema = z4.lazy(() => strictObject({
  "rationale": z4.string(),
  "preserveOptionality": z4.array(z4.string()),
  "forbiddenCommitments": z4.array(z4.string()),
  "reconsiderWhen": z4.array(AuthorityReconsiderTriggerSchema),
  "reviewBy": z4.string().optional()
}));
var ArchitectureConcernSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z4.string(),
  "title": z4.string(),
  "question": z4.string(),
  "scope": SelectorExprSchema,
  "sourceClass": SourceClassSchema,
  "status": z4.union([z4.literal("candidate"), z4.literal("active"), z4.literal("deferred"), z4.literal("resolved"), z4.literal("dismissed"), z4.literal("superseded")]),
  "materiality": ConcernMaterialitySchema,
  "activationReasons": z4.array(ConcernActivationReasonSchema),
  "relatedConceptIds": z4.array(EntityIdSchema),
  "relatedRequirementIds": z4.array(EntityIdSchema),
  "relevanceClosureId": EntityIdSchema.optional(),
  "decisionIds": z4.array(EntityIdSchema),
  "deferral": DecisionDeferralSchema.optional(),
  "evidence": z4.array(EvidenceRefSchema),
  "semanticHash": ContentHashSchema
}));
var DecisionConsequenceSchema = z4.lazy(() => strictObject({
  "kind": z4.union([z4.literal("activate-governance"), z4.literal("deactivate-governance"), z4.literal("introduce-constraint"), z4.literal("retire-constraint"), z4.literal("select-technology"), z4.literal("deprecate-technology"), z4.literal("require-migration"), z4.literal("activate-concern"), z4.literal("constrain-decision"), z4.literal("advisory")]),
  "targetId": EntityIdSchema.optional(),
  "scope": SelectorExprSchema.optional(),
  "payload": z4.record(z4.string(), JsonValueSchema).optional(),
  "explanation": z4.string()
}));
var AppliedPreferenceRefSchema = z4.lazy(() => strictObject({
  "key": z4.string(),
  "scope": z4.union([z4.literal("user"), z4.literal("organization"), z4.literal("project")]),
  "semanticHash": ContentHashSchema,
  "influence": z4.string()
}));
var ArchitectureDecisionSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z4.string(),
  "concernId": EntityIdSchema,
  "title": z4.string(),
  "decision": z4.string(),
  "selectedOptionKey": z4.string(),
  "scope": SelectorExprSchema,
  "lifecycle": z4.union([z4.literal("active"), z4.literal("superseded"), z4.literal("retired")]),
  "authorityRecordId": EntityIdSchema,
  "governanceBasis": z4.array(GovernanceBasisSchema),
  "consequences": z4.array(DecisionConsequenceSchema),
  "appliedPreferences": z4.array(AppliedPreferenceRefSchema),
  "supersedesDecisionIds": z4.array(EntityIdSchema),
  "migrationId": EntityIdSchema.optional(),
  "semanticHash": ContentHashSchema
}));
var DecisionOptionSchema = z4.lazy(() => strictObject({
  "key": z4.string(),
  "title": z4.string(),
  "description": z4.string(),
  "hardConstraintStatus": z4.union([z4.literal("passes"), z4.literal("fails"), z4.literal("unknown")]),
  "tradeoffs": z4.array(z4.string()),
  "evidence": z4.array(EvidenceRefSchema),
  "preferenceFit": z4.array(AppliedPreferenceRefSchema)
}));
var DecisionEvaluationSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "concernId": EntityIdSchema,
  "scope": SelectorExprSchema,
  "options": z4.array(DecisionOptionSchema),
  "eliminatedOptionKeys": z4.array(z4.string()),
  "recommendedOptionKey": z4.string().optional(),
  "outcome": z4.union([z4.literal("recommended"), z4.literal("contested"), z4.literal("insufficient-evidence")]),
  "hardConstraints": z4.array(EntityIdSchema),
  "preferenceSnapshotHash": ContentHashSchema,
  "researchEvidenceIds": z4.array(EntityIdSchema),
  "unknowns": z4.array(z4.string()),
  "evaluatedAt": z4.string(),
  "semanticHash": ContentHashSchema
}));
var DecisionValidityAssessmentSchema = z4.lazy(() => strictObject({
  "decisionId": EntityIdSchema,
  "scope": SelectorExprSchema,
  "state": z4.union([z4.literal("valid"), z4.literal("suspect"), z4.literal("contested"), z4.literal("invalid-for-scope")]),
  "firedTriggers": z4.array(AuthorityReconsiderTriggerSchema),
  "invalidatedAssumptions": z4.array(z4.string()),
  "staleEvidenceIds": z4.array(EntityIdSchema),
  "blocksCurrentChange": z4.boolean(),
  "explanation": z4.string()
}));
var DeveloperPreferenceSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z4.string(),
  "scope": z4.union([z4.literal("user"), z4.literal("organization"), z4.literal("project")]),
  "selector": SelectorExprSchema,
  "strength": z4.union([z4.literal("prefer"), z4.literal("strongly-prefer"), z4.literal("avoid")]),
  "statement": z4.string(),
  "rationale": z4.string().optional(),
  "status": z4.union([z4.literal("active"), z4.literal("retired")]),
  "sourceClass": SourceClassSchema,
  "semanticHash": ContentHashSchema
}));
var GovernanceBasisSchema = z4.lazy(() => z4.union([strictObject({
  "kind": z4.literal("architecture-decision"),
  "decisionId": EntityIdSchema
}), strictObject({
  "kind": z4.literal("hard-constraint"),
  "conceptId": EntityIdSchema
}), strictObject({
  "kind": z4.literal("adopted-standard"),
  "authorityRecordId": EntityIdSchema
}), strictObject({
  "kind": z4.literal("migration-overlay"),
  "migrationId": EntityIdSchema
}), strictObject({
  "kind": z4.literal("host-safety"),
  "key": z4.string()
}), strictObject({
  "kind": z4.literal("active-lens"),
  "lensId": EntityIdSchema
})]));
var EvidenceRefSchema = z4.lazy(() => strictObject({
  "evidenceId": EntityIdSchema,
  "stance": z4.union([z4.literal("supports"), z4.literal("contradicts"), z4.literal("context")]),
  "weight": z4.number().finite().optional(),
  "applicationPredicate": ApplicationEvidencePredicateBindingSchema.optional()
}));
var ApplicationEvidencePredicateBindingSchema = z4.lazy(() => strictObject({
  "kind": z4.literal("application-observation"),
  "adapter": strictObject({
    "id": z4.string(),
    "version": z4.string()
  }),
  "scenario": strictObject({
    "id": EntityIdSchema,
    "semanticHash": ContentHashSchema
  }),
  "case": z4.string(),
  "predicateId": EntityIdSchema,
  "assertionIds": z4.array(z4.string()),
  "observationRole": z4.union([z4.literal("prior"), z4.literal("latest")])
}).superRefine((value, context) => {
  const textFields = [value.adapter.id, value.adapter.version, value.case, value.predicateId, ...value.assertionIds];
  if (textFields.some((item) => item.trim() === "" || item !== item.trim()))
    context.addIssue({ code: "custom", message: "application evidence binding identifiers must be nonblank normalized text" });
  if (value.assertionIds.length === 0 || new Set(value.assertionIds).size !== value.assertionIds.length)
    context.addIssue({ code: "custom", path: ["assertionIds"], message: "application evidence binding requires unique assertion identities" });
}));
var CausalOriginSchema = z4.lazy(() => strictObject({
  "kind": z4.union([z4.literal("pre-projector"), z4.literal("human"), z4.literal("deterministic-observation"), z4.literal("model-inference"), z4.literal("semantic-resolution"), z4.literal("relevance-analysis"), z4.literal("planning-surprise"), z4.literal("lens-transform"), z4.literal("plan"), z4.literal("external")]),
  "causedByLensId": EntityIdSchema.optional(),
  "causedByRuleId": EntityIdSchema.optional(),
  "causedByTransformId": z4.string().optional(),
  "causedBySemanticChangeId": EntityIdSchema.optional(),
  "causedByRelevanceClosureId": EntityIdSchema.optional(),
  "causedByPlanningSurpriseId": EntityIdSchema.optional(),
  "causedByPlanId": EntityIdSchema.optional(),
  "causedByPacketId": EntityIdSchema.optional()
}));
var SemanticSignatureSchema = z4.lazy(() => strictObject({
  "hash": ContentHashSchema,
  "profileId": z4.string(),
  "profileVersion": z4.string(),
  "scope": z4.string(),
  "assurance": z4.union([z4.literal("exact"), z4.literal("validated"), z4.literal("heuristic")]),
  "evidenceIds": z4.array(EntityIdSchema)
}));
var LineageRecordSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "kind": z4.union([z4.literal("move"), z4.literal("split"), z4.literal("merge"), z4.literal("replace"), z4.literal("delete")]),
  "fromIds": z4.array(EntityIdSchema),
  "toIds": z4.array(EntityIdSchema),
  "reason": z4.string(),
  "stateDigest": ContentHashSchema
}).superRefine((value, context) => {
  const issue = (message) => context.addIssue({ code: "custom", message });
  if (new Set(value.fromIds).size !== value.fromIds.length || new Set(value.toIds).size !== value.toIds.length)
    issue("lineage endpoints must be unique");
  if (value.fromIds.length === 0)
    issue("lineage requires at least one source");
  if (value.kind === "move" && (value.fromIds.length !== 1 || value.toIds.length !== 1))
    issue("move lineage requires exactly one source and destination");
  if (value.kind === "split" && value.toIds.length < 2)
    issue("split lineage requires at least two destinations");
  if (value.kind === "merge" && (value.fromIds.length < 2 || value.toIds.length !== 1))
    issue("merge lineage requires at least two sources and one destination");
  if (value.kind === "replace" && value.toIds.length === 0)
    issue("replace lineage requires at least one destination");
  if (value.kind === "delete" && value.toIds.length !== 0)
    issue("delete lineage cannot have destinations");
}));
var TombstoneSchema = z4.lazy(() => strictObject({
  "entityId": EntityIdSchema,
  "deletedAtRevision": z4.number().finite(),
  "lastSemanticHash": ContentHashSchema,
  "replacementIds": z4.array(EntityIdSchema),
  "reason": z4.string()
}));
var ConceptSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z4.string(),
  "kind": z4.union([z4.literal("capability"), z4.literal("behavior"), z4.literal("invariant"), z4.literal("decision"), z4.literal("ownership"), z4.literal("obligation"), z4.literal("data"), z4.literal("interface"), z4.literal("event"), z4.literal("command"), z4.literal("policy"), z4.literal("read-model"), z4.literal("contract"), z4.literal("assumption"), z4.literal("migration"), z4.literal("constraint")]),
  "name": z4.string(),
  "aliases": z4.array(z4.string()),
  "statement": z4.string(),
  "status": z4.union([z4.literal("candidate"), z4.literal("active"), z4.literal("deprecated"), z4.literal("rejected")]),
  "sourceClass": SourceClassSchema,
  "confidence": ConfidenceSchema,
  "tags": z4.array(z4.string()),
  "evidence": z4.array(EvidenceRefSchema),
  "origin": z4.array(IntentOriginRefSchema).optional(),
  "realizations": z4.array(RealizationBindingSchema).optional(),
  "discoveryHash": ContentHashSchema,
  "semanticHash": ContentHashSchema
}));
var RelationTypeSchema = z4.lazy(() => z4.union([z4.literal("realizes"), z4.literal("requires"), z4.literal("constrains"), z4.literal("depends-on"), z4.literal("has-requirement"), z4.literal("demonstrated-by"), z4.literal("produces"), z4.literal("consumes"), z4.literal("triggers"), z4.literal("governed-by"), z4.literal("applies-to"), z4.literal("generates"), z4.literal("documents"), z4.literal("verifies"), z4.literal("deploys-to"), z4.literal("publishes-to"), z4.literal("observes"), z4.literal("owns"), z4.literal("incompatible-with"), z4.literal("derived-from"), z4.literal("supersedes"), z4.literal("exception-to"), z4.literal("variant-of")]));
var RelationSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "fromId": EntityIdSchema,
  "toId": EntityIdSchema,
  "type": RelationTypeSchema,
  "sourceClass": SourceClassSchema,
  "confidence": ConfidenceSchema,
  "evidence": z4.array(EvidenceRefSchema),
  "active": z4.boolean(),
  "semanticHash": ContentHashSchema
}));
var IntentOriginRefSchema = z4.lazy(() => strictObject({
  "kind": z4.union([z4.literal("user-request"), z4.literal("linear"), z4.literal("github-issue"), z4.literal("document"), z4.literal("external")]),
  "locator": z4.string(),
  "contentHash": ContentHashSchema.optional(),
  "description": z4.string().optional()
}));
var RealizationBindingSchema = z4.lazy(() => strictObject({
  "selector": RealizationSelectorExprSchema,
  "origin": RealizationOriginRefSchema
}));
var RealizationOriginRefSchema = z4.lazy(() => z4.union([strictObject({
  "kind": z4.literal("git"),
  "locator": GitRealizationLocatorSchema,
  "description": z4.string().optional()
}), strictObject({
  "kind": z4.literal("content"),
  "locator": z4.string(),
  "contentHash": ContentHashSchema,
  "description": z4.string().optional()
})]));
var RequirementSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z4.string(),
  "title": z4.string(),
  "aliases": z4.array(z4.string()),
  "statement": z4.string(),
  "status": z4.union([z4.literal("candidate"), z4.literal("active"), z4.literal("deprecated"), z4.literal("rejected"), z4.literal("superseded")]),
  "sourceClass": SourceClassSchema,
  "scope": SelectorExprSchema,
  "origin": z4.array(IntentOriginRefSchema),
  "realizations": z4.array(RealizationBindingSchema).optional(),
  "evidence": z4.array(EvidenceRefSchema),
  "discoveryHash": ContentHashSchema,
  "semanticHash": ContentHashSchema
}).superRefine((value, context) => {
  for (const issue of applicationEvidenceBindingIssues(value.evidence))
    context.addIssue({ code: "custom", path: ["evidence", issue.index, "applicationPredicate", "observationRole"], message: issue.message });
}));
var BehavioralScenarioStepSchema = z4.lazy(() => strictObject({
  "role": z4.union([z4.literal("precondition"), z4.literal("trigger"), z4.literal("expected-outcome"), z4.literal("forbidden-outcome")]),
  "statement": z4.string()
}));
var BehavioralScenarioSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z4.string(),
  "title": z4.string(),
  "aliases": z4.array(z4.string()),
  "status": z4.union([z4.literal("candidate"), z4.literal("active"), z4.literal("deprecated"), z4.literal("rejected"), z4.literal("superseded")]),
  "sourceClass": SourceClassSchema,
  "scope": SelectorExprSchema,
  "steps": z4.array(BehavioralScenarioStepSchema),
  "origin": z4.array(IntentOriginRefSchema).optional(),
  "realizations": z4.array(RealizationBindingSchema).optional(),
  "evidence": z4.array(EvidenceRefSchema),
  "discoveryHash": ContentHashSchema,
  "semanticHash": ContentHashSchema
}).superRefine((value, context) => {
  for (const issue of applicationEvidenceBindingIssues(value.evidence))
    context.addIssue({ code: "custom", path: ["evidence", issue.index, "applicationPredicate", "observationRole"], message: issue.message });
  for (const [index, reference] of value.evidence.entries())
    if (reference.applicationPredicate !== void 0 && (reference.applicationPredicate.scenario.id !== value.id || reference.applicationPredicate.scenario.semanticHash !== value.semanticHash))
      context.addIssue({ code: "custom", path: ["evidence", index, "applicationPredicate", "scenario"], message: "scenario-owned application evidence must bind the owning scenario identity and semantic hash" });
}));
var RepresentationTargetSchema = z4.lazy(() => z4.union([z4.literal("human-technical"), z4.literal("behavior-spec"), z4.literal("agent-context"), z4.literal("machine-invariant")]));
var PreservationDimensionSchema = z4.lazy(() => z4.union([z4.literal("normative-force"), z4.literal("negation"), z4.literal("scope"), z4.literal("quantifier-cardinality"), z4.literal("logical-connective"), z4.literal("condition-guard"), z4.literal("exception"), z4.literal("dependency-order"), z4.literal("behavior-step-role"), z4.literal("concept-identity"), z4.literal("identifier-literal")]));
var SemanticPreservationFingerprintSchema = z4.lazy(() => strictObject({
  "sourceSemanticHash": ContentHashSchema,
  "profileId": EntityIdSchema,
  "profileVersion": z4.string(),
  "protectedDimensions": z4.array(PreservationDimensionSchema),
  "dimensionHashes": z4.partialRecord(z4.union([z4.literal("normative-force"), z4.literal("negation"), z4.literal("scope"), z4.literal("quantifier-cardinality"), z4.literal("logical-connective"), z4.literal("condition-guard"), z4.literal("exception"), z4.literal("dependency-order"), z4.literal("behavior-step-role"), z4.literal("concept-identity"), z4.literal("identifier-literal")]), ContentHashSchema),
  "dimensionAssurance": z4.partialRecord(z4.union([z4.literal("normative-force"), z4.literal("negation"), z4.literal("scope"), z4.literal("quantifier-cardinality"), z4.literal("logical-connective"), z4.literal("condition-guard"), z4.literal("exception"), z4.literal("dependency-order"), z4.literal("behavior-step-role"), z4.literal("concept-identity"), z4.literal("identifier-literal")]), z4.union([z4.literal("exact"), z4.literal("validated"), z4.literal("heuristic")])),
  "unsupportedDimensions": z4.array(PreservationDimensionSchema),
  "assurance": z4.union([z4.literal("exact"), z4.literal("validated"), z4.literal("heuristic")]),
  "evidenceIds": z4.array(EntityIdSchema),
  "semanticHash": ContentHashSchema
}));
var RepresentationStyleRuleSchema = z4.lazy(() => strictObject({
  "key": z4.string(),
  "kind": z4.union([z4.literal("terminology"), z4.literal("sentence-structure"), z4.literal("active-voice"), z4.literal("condition-order"), z4.literal("scenario-structure"), z4.literal("paragraph-structure"), z4.literal("word-choice"), z4.literal("punctuation"), z4.literal("abbreviation"), z4.literal("narration"), z4.literal("filler-removal"), z4.literal("token-optimization"), z4.literal("literal-preservation")]),
  "parameters": z4.record(z4.string(), JsonValueSchema),
  "blocking": z4.boolean()
}));
var SemanticRepresentationProfileSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z4.string(),
  "version": z4.string(),
  "status": z4.union([z4.literal("active"), z4.literal("deprecated"), z4.literal("retired")]),
  "target": RepresentationTargetSchema,
  "selector": SelectorExprSchema,
  "optimization": z4.union([z4.literal("clarity-first"), z4.literal("token-first"), z4.literal("machine-first")]),
  "protectedDimensions": z4.array(PreservationDimensionSchema),
  "styleRules": z4.array(RepresentationStyleRuleSchema),
  "generatorId": z4.string(),
  "validatorIds": z4.array(z4.string()),
  "tokenizerProfileId": z4.string().optional(),
  "fallbackProfileId": EntityIdSchema.optional(),
  "semanticHash": ContentHashSchema
}));
var RepresentationTokenAccountingSchema = z4.lazy(() => strictObject({
  "sourceTokens": z4.number().finite().optional(),
  "outputTokens": z4.number().finite().optional(),
  "profileOverheadTokens": z4.number().finite().optional(),
  "estimatedNetTokens": z4.number().finite().optional(),
  "tokenizerProfileId": z4.string().optional(),
  "estimatedNetInstructionEfficiency": z4.number().finite().optional(),
  "utilityProfileId": z4.string().optional(),
  "utilityEvidence": z4.string().optional()
}));
var RepresentationProjectionSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "profileId": EntityIdSchema,
  "profileVersion": z4.string(),
  "target": RepresentationTargetSchema,
  "sourceEntityIds": z4.array(EntityIdSchema),
  "sourceSemanticHash": ContentHashSchema,
  "boundState": StateBindingSchema,
  "contentHash": ContentHashSchema,
  "preservation": SemanticPreservationFingerprintSchema,
  "tokenAccounting": RepresentationTokenAccountingSchema.optional(),
  "status": z4.union([z4.literal("valid"), z4.literal("suspect"), z4.literal("invalid"), z4.literal("fallback-used")]),
  "validatorResults": z4.array(ValidationResultSchema),
  "semanticHash": ContentHashSchema
}));
var RepresentationProjectionRefSchema = z4.lazy(() => strictObject({
  "projectionId": EntityIdSchema,
  "profileId": EntityIdSchema,
  "profileVersion": z4.string(),
  "contentHash": ContentHashSchema,
  "preservationHash": ContentHashSchema
}));
var StateDigestSchema = z4.lazy(() => strictObject({
  "gitBase": z4.string(),
  "worktreeDigest": ContentHashSchema,
  "canonicalProjectorDigest": ContentHashSchema,
  "toolchainDigest": ContentHashSchema,
  "pinnedExternalSnapshotDigest": ContentHashSchema.optional()
}));
var StateValueDependencyKindSchema = z4.lazy(() => z4.union([z4.literal("canonical-entity"), z4.literal("canonical-governance"), z4.literal("projection-unit"), z4.literal("artifact"), z4.literal("toolchain"), z4.literal("adapter"), z4.literal("signature-profile"), z4.literal("representation-profile"), z4.literal("external-snapshot")]));
var StateValueDependencyRefSchema = z4.lazy(() => strictObject({
  "kind": StateValueDependencyKindSchema,
  "id": z4.union([EntityIdSchema, z4.string()]),
  "versionHash": ContentHashSchema,
  "role": z4.string()
}));
var StateQueryKindSchema = z4.lazy(() => z4.union([z4.literal("semantic-identity-search"), z4.literal("relation-neighborhood"), z4.literal("reverse-derivation"), z4.literal("selector-membership"), z4.literal("impact-rule-applicability"), z4.literal("decision-applicability"), z4.literal("implementation-binding"), z4.literal("event-topology"), z4.literal("contract-topology"), z4.literal("verification-binding"), z4.literal("package-dependency"), z4.literal("surface-enumeration"), z4.literal("custom")]));
var StateQuerySpecSchema = z4.lazy(() => strictObject({
  "id": z4.string(),
  "kind": StateQueryKindSchema,
  "programId": z4.string(),
  "programVersion": z4.string(),
  "input": z4.record(z4.string(), JsonValueSchema),
  "semanticHash": ContentHashSchema
}));
var StateQueryResultFingerprintSchema = z4.lazy(() => strictObject({
  "queryHash": ContentHashSchema,
  "resultHash": ContentHashSchema,
  "resultCount": z4.number().finite(),
  "observability": ObservabilityClassSchema,
  "assumptions": z4.array(z4.string()),
  "unavailableLanes": z4.array(z4.string()),
  "dependencyKeys": z4.array(z4.string())
}));
var StateQueryDependencySchema = z4.lazy(() => strictObject({
  "query": StateQuerySpecSchema,
  "priorResult": StateQueryResultFingerprintSchema,
  "role": z4.string()
}));
var StateBindingSchema = z4.lazy(() => strictObject({
  "compiledAgainst": StateDigestSchema,
  "valueDependencies": z4.array(StateValueDependencyRefSchema),
  "queryDependencies": z4.array(StateQueryDependencySchema),
  "dependencyDigest": ContentHashSchema
}));
var StateBindingValidationSchema = z4.lazy(() => strictObject({
  "status": z4.union([z4.literal("current"), z4.literal("rebound"), z4.literal("stale"), z4.literal("suspect"), z4.literal("unavailable")]),
  "currentState": StateDigestSchema,
  "changedValueDependencyIds": z4.array(z4.union([EntityIdSchema, z4.string()])),
  "changedQueryDependencyIds": z4.array(z4.string()),
  "reasons": z4.array(z4.string()),
  "rebound": StateBindingSchema.optional(),
  "observations": z4.array(StateDependencyObservationSchema).optional()
}));
var StateDependencyObservationSchema = z4.lazy(() => z4.union([strictObject({
  "kind": z4.literal("value"),
  "dependency": StateValueDependencyRefSchema,
  "status": z4.union([z4.literal("current"), z4.literal("stale"), z4.literal("unknown")]),
  "basis": z4.union([z4.literal("same-snapshot"), z4.literal("observed")]),
  "currentVersionHash": ContentHashSchema.optional(),
  "reason": z4.string()
}), strictObject({
  "kind": z4.literal("query"),
  "dependency": StateQueryDependencySchema,
  "status": z4.union([z4.literal("current"), z4.literal("stale"), z4.literal("unknown")]),
  "basis": z4.union([z4.literal("same-snapshot"), z4.literal("unchanged-dependency-keys"), z4.literal("evaluated"), z4.literal("unavailable")]),
  "currentResult": StateQueryResultFingerprintSchema.optional(),
  "reason": z4.string()
})]));
var ValidationResultSchema = z4.lazy(() => strictObject({
  "validatorId": z4.string(),
  "status": z4.union([z4.literal("passed"), z4.literal("failed"), z4.literal("skipped"), z4.literal("blocked")]),
  "summary": z4.string(),
  "evidenceIds": z4.array(EntityIdSchema),
  "evidenceLane": z4.union([z4.literal("compiler"), z4.literal("test"), z4.literal("schema"), z4.literal("runtime"), z4.literal("property"), z4.literal("representation"), z4.literal("architecture"), z4.literal("historical"), z4.literal("human"), z4.literal("independent-agent"), z4.literal("same-packet-agent")]),
  "independenceGroup": z4.string(),
  "assurance": z4.union([z4.literal("weak"), z4.literal("supporting"), z4.literal("strong"), z4.literal("exact")]),
  "authorSource": z4.string(),
  "sideEffectClass": z4.union([z4.literal("none"), z4.literal("read-only"), z4.literal("workspace-write"), z4.literal("external-write")]),
  "details": z4.record(z4.string(), JsonValueSchema),
  "startedAt": z4.string(),
  "completedAt": z4.string()
}));
var RollbackSpecSchema = z4.lazy(() => strictObject({
  "kind": z4.union([z4.literal("git-checkpoint"), z4.literal("inverse-transform"), z4.literal("compensation"), z4.literal("manual"), z4.literal("none")]),
  "checkpointId": z4.string().optional(),
  "transformId": z4.string().optional(),
  "instructions": z4.string().optional()
}));
var OperationEvidenceSchema = z4.lazy(() => strictObject({
  "operationId": z4.string(),
  "executor": z4.union([z4.literal("transform"), z4.literal("agent"), z4.literal("manual"), z4.literal("external")]),
  "unitIds": z4.array(EntityIdSchema),
  "beforeHashes": z4.array(ContentHashSchema),
  "afterHashes": z4.array(ContentHashSchema),
  "evidenceIds": z4.array(EntityIdSchema),
  "summary": z4.string()
}));
var AnalyzerCapabilitiesSchema = z4.lazy(() => strictObject({
  "analyzerId": z4.string(),
  "adapterVersion": z4.string(),
  "supportedLanguages": z4.array(z4.string()),
  "supportedSemantics": z4.array(z4.string()),
  "enumeration": EnumerationContractSchema,
  "executesRepositoryCode": z4.boolean()
}));
var AnalyzerFailureSchema = z4.lazy(() => strictObject({
  "analyzerId": z4.string(),
  "capability": z4.string(),
  "scope": z4.string(),
  "message": z4.string(),
  "recoverable": z4.boolean(),
  "affectedClaimKinds": z4.array(z4.string())
}));
var ArtifactFingerprintSchema = z4.lazy(() => strictObject({
  "contentHash": ContentHashSchema,
  "structuralSignature": SemanticSignatureSchema.optional(),
  "semanticSignature": SemanticSignatureSchema.optional(),
  "adapterVersion": z4.string()
}));
var TransformPreviewSchema = z4.lazy(() => strictObject({
  "applicable": z4.boolean(),
  "operations": z4.array(z4.record(z4.string(), JsonValueSchema)),
  "touchedUnitIds": z4.array(EntityIdSchema),
  "expectedDiff": z4.string(),
  "warnings": z4.array(z4.string())
}));
var TransformResultSchema = z4.lazy(() => strictObject({
  "transformId": z4.string(),
  "changed": z4.boolean(),
  "touchedUnitIds": z4.array(EntityIdSchema),
  "operations": z4.array(OperationEvidenceSchema),
  "checkpointId": z4.string().optional()
}));
var SurfaceChangeSchema = z4.lazy(() => strictObject({
  "semanticChangeId": EntityIdSchema,
  "surfaceId": EntityIdSchema,
  "operation": z4.string(),
  "payload": z4.record(z4.string(), JsonValueSchema)
}));
var SurfacePlanSchema = z4.lazy(() => strictObject({
  "adapterId": z4.string(),
  "surfaceId": EntityIdSchema,
  "riskClass": RiskClassSchema,
  "operations": z4.array(z4.record(z4.string(), JsonValueSchema)),
  "requiredApprovals": z4.array(z4.string()),
  "validatorIds": z4.array(z4.string()),
  "boundState": StateBindingSchema
}));
var SurfaceApplyResultSchema = z4.lazy(() => strictObject({
  "changed": z4.boolean(),
  "operationEvidence": z4.array(OperationEvidenceSchema),
  "externalReferences": z4.array(z4.string())
}));
var RecognizerBindingSchema = z4.lazy(() => strictObject({
  "id": z4.string(),
  "version": z4.string(),
  "adapterId": z4.string(),
  "query": z4.record(z4.string(), JsonValueSchema),
  "minimumConfidence": ConfidenceSchema
}));
var ValidatorBindingSchema = z4.lazy(() => strictObject({
  "id": z4.string(),
  "version": z4.string(),
  "provider": z4.string(),
  "input": z4.record(z4.string(), JsonValueSchema),
  "required": z4.boolean(),
  "requiredIndependenceGroup": z4.string().optional()
}));
var TransformBindingSchema = z4.lazy(() => strictObject({
  "id": z4.string(),
  "version": z4.string(),
  "input": z4.record(z4.string(), JsonValueSchema),
  "exclusiveUnitClaim": z4.boolean()
}));
var MigrationBindingSchema = z4.lazy(() => strictObject({
  "fromVersion": z4.string(),
  "toVersion": z4.string(),
  "transformIds": z4.array(z4.string()),
  "validationIds": z4.array(z4.string())
}));
var GovernanceExceptionSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z4.string(),
  "selector": SelectorExprSchema,
  "exceptedRuleIds": z4.array(EntityIdSchema),
  "exceptedLensIds": z4.array(EntityIdSchema),
  "exceptedExpectationIds": z4.array(EntityIdSchema),
  "rationale": z4.string(),
  "evidence": z4.array(EvidenceRefSchema),
  "owner": z4.string(),
  "reviewOrExpiryTrigger": AuthorityReconsiderTriggerSchema,
  "invalidationConditions": z4.array(AuthorityReconsiderTriggerSchema),
  "exitCriteria": z4.array(z4.string()).optional(),
  "status": z4.union([z4.literal("active"), z4.literal("expired"), z4.literal("revoked")]),
  "semanticHash": ContentHashSchema
}));
var MigrationOverlaySchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z4.string(),
  "sourceLensRef": LensRefSchema,
  "targetLensRef": LensRefSchema,
  "phase": z4.union([z4.literal("proposed"), z4.literal("prepared"), z4.literal("dual-running"), z4.literal("cutover"), z4.literal("cleanup"), z4.literal("complete"), z4.literal("rolled-back")]),
  "entryCriteria": z4.array(z4.string()),
  "exitCriteria": z4.array(z4.string()),
  "compatibilityStrategy": z4.string(),
  "allowedTemporaryDivergenceIds": z4.array(EntityIdSchema),
  "generatedOutputOverlays": z4.array(z4.string()).optional(),
  "validationObligations": z4.array(z4.string()),
  "rollbackPlan": z4.string(),
  "compensationPlan": z4.string().optional(),
  "cleanupResidueDetector": z4.string(),
  "semanticHash": ContentHashSchema
}));
var LensExampleSchema = z4.lazy(() => strictObject({
  "unitId": EntityIdSchema.optional(),
  "artifactLocator": z4.string().optional(),
  "explanation": z4.string(),
  "evidenceIds": z4.array(EntityIdSchema)
}));
var AuthorityAlternativeSchema = z4.lazy(() => strictObject({
  "key": z4.string(),
  "description": z4.string(),
  "advantages": z4.array(z4.string()),
  "disadvantages": z4.array(z4.string()),
  "rejectedBecause": z4.array(z4.string()),
  "evidence": z4.array(EvidenceRefSchema)
}));
var ObservabilityClassSchema = z4.lazy(() => z4.union([z4.literal("closed"), z4.literal("bounded"), z4.literal("open"), z4.literal("sampled"), z4.literal("unavailable")]));
var EnumerationContractSchema = z4.lazy(() => strictObject({
  "observability": ObservabilityClassSchema,
  "method": z4.string(),
  "assumptions": z4.array(z4.string()),
  "blindSpots": z4.array(z4.string()),
  "dynamicMechanisms": z4.array(z4.string()),
  "freshnessRequirement": z4.string().optional()
}));
var SurfaceCapabilitiesSchema = z4.lazy(() => strictObject({
  "read": z4.boolean(),
  "write": z4.boolean(),
  "watch": z4.boolean(),
  "transactionalWrites": z4.boolean(),
  "stableAnchors": z4.boolean(),
  "humanApprovalRequired": z4.boolean()
}));
var SurfaceSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z4.string(),
  "kind": z4.union([z4.literal("repository"), z4.literal("ci"), z4.literal("cloud"), z4.literal("package-registry"), z4.literal("app-store"), z4.literal("website"), z4.literal("runtime"), z4.literal("database"), z4.literal("external")]),
  "adapter": z4.string(),
  "access": z4.union([z4.literal("read-write"), z4.literal("read-only"), z4.literal("declared-only"), z4.literal("unavailable")]),
  "enumeration": EnumerationContractSchema,
  "capabilities": SurfaceCapabilitiesSchema,
  "boundary": z4.record(z4.string(), JsonValueSchema)
}));
var ArtifactSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "surfaceId": EntityIdSchema,
  "locator": z4.string(),
  "mediaType": z4.string(),
  "contentHash": ContentHashSchema,
  "structuralSignature": SemanticSignatureSchema.optional(),
  "semanticSignature": SemanticSignatureSchema.optional(),
  "observedAt": z4.string(),
  "observationRevision": z4.string(),
  "causalOrigin": CausalOriginSchema,
  "metadata": z4.record(z4.string(), JsonValueSchema)
}));
var SemanticAnchorSchema = z4.lazy(() => strictObject({
  "kind": z4.union([z4.literal("file"), z4.literal("symbol"), z4.literal("ast-node"), z4.literal("json-pointer"), z4.literal("yaml-path"), z4.literal("markdown-section"), z4.literal("workflow-job"), z4.literal("resource-property"), z4.literal("external-field")]),
  "value": z4.string(),
  "fallbackSignature": SemanticSignatureSchema.optional()
}));
var ControlPolicySchema = z4.lazy(() => strictObject({
  "ownership": z4.union([z4.literal("exclusive"), z4.literal("structured"), z4.literal("shared"), z4.literal("observed")]),
  "mutation": z4.union([z4.literal("replace"), z4.literal("transform"), z4.literal("agent"), z4.literal("external"), z4.literal("none")]),
  "actuation": z4.union([z4.literal("automatic"), z4.literal("approval"), z4.literal("human"), z4.literal("unavailable")])
}));
var LensRefSchema = z4.lazy(() => strictObject({
  "lensId": EntityIdSchema,
  "version": z4.string(),
  "semanticHash": ContentHashSchema
}));
var ValidityStateSchema = z4.lazy(() => z4.union([z4.literal("valid"), z4.literal("suspect"), z4.literal("invalid"), z4.literal("revalidating"), z4.literal("repair-planned"), z4.literal("blocked"), z4.literal("unreachable")]));
var ProjectionUnitSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "artifactId": EntityIdSchema,
  "key": z4.string(),
  "role": z4.union([z4.literal("implementation"), z4.literal("contract"), z4.literal("test"), z4.literal("fixture"), z4.literal("documentation"), z4.literal("comment"), z4.literal("configuration"), z4.literal("deployment"), z4.literal("publication"), z4.literal("telemetry"), z4.literal("migration"), z4.literal("supporting")]),
  "anchor": SemanticAnchorSchema,
  "control": ControlPolicySchema,
  "conceptIds": z4.array(EntityIdSchema),
  "requirementIds": z4.array(EntityIdSchema),
  "scenarioIds": z4.array(EntityIdSchema),
  "lenses": z4.array(LensRefSchema),
  "tags": z4.array(z4.string()),
  "structuralSignature": SemanticSignatureSchema,
  "semanticSignature": SemanticSignatureSchema,
  "membershipHash": ContentHashSchema,
  "validity": ValidityStateSchema,
  "confidence": ConfidenceSchema,
  "causalOrigin": CausalOriginSchema,
  "generatedFromUnitIds": z4.array(EntityIdSchema)
}));
var EvidenceKindSchema = z4.lazy(() => z4.union([z4.literal("explicit-decision"), z4.literal("repository-structure"), z4.literal("code-relationship"), z4.literal("test"), z4.literal("documentation"), z4.literal("git-history"), z4.literal("runtime-observation"), z4.literal("build-output"), z4.literal("official-documentation"), z4.literal("standard"), z4.literal("research-paper"), z4.literal("reference-implementation"), z4.literal("issue-or-incident"), z4.literal("user-decision"), z4.literal("agent-inference")]));
var EvidenceClaimSchema = z4.lazy(() => strictObject({
  "subjectKey": z4.string(),
  "predicate": z4.string(),
  "object": JsonValueSchema,
  "inferenceConfidence": ConfidenceSchema.optional()
}));
var EvidenceSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "kind": EvidenceKindSchema,
  "locator": z4.string(),
  "capturedAt": z4.string(),
  "sourceDate": z4.string().optional(),
  "contentHash": ContentHashSchema,
  "excerpt": z4.string().optional(),
  "claims": z4.array(EvidenceClaimSchema),
  "reliability": z4.union([z4.literal("mechanically-proven"), z4.literal("high"), z4.literal("medium"), z4.literal("low"), z4.literal("untrusted")]),
  "normativeAuthority": z4.union([z4.literal("binding-decision"), z4.literal("hard-constraint"), z4.literal("authoritative-guidance"), z4.literal("supporting"), z4.literal("descriptive-only"), z4.literal("none")]),
  "independenceGroup": z4.string(),
  "applicability": z4.union([z4.literal("direct"), z4.literal("analogous"), z4.literal("contextual"), z4.literal("uncertain")]),
  "freshness": ConfidenceSchema,
  "causalOrigin": CausalOriginSchema,
  "metadata": z4.record(z4.string(), JsonValueSchema)
}));
var AuthorityVectorSchema = z4.lazy(() => strictObject({
  "explicitDecisionAlignment": z4.number().finite(),
  "productConstraintFit": z4.number().finite(),
  "semanticFit": z4.number().finite(),
  "independentOccurrence": z4.number().finite(),
  "historicalStability": z4.number().finite(),
  "independentValidationSupport": z4.number().finite(),
  "boundaryCoherence": z4.number().finite(),
  "maintenanceOutcome": z4.number().finite(),
  "platformCompatibility": z4.number().finite(),
  "externalRationale": z4.number().finite(),
  "ecosystemHealth": z4.number().finite(),
  "securitySupport": z4.number().finite(),
  "reversibility": z4.number().finite(),
  "migrationCost": z4.number().finite(),
  "counterEvidence": z4.number().finite()
}));
var AuthorityReconsiderTriggerSchema = z4.lazy(() => z4.union([strictObject({
  "type": z4.literal("concept-changed"),
  "conceptId": EntityIdSchema
}), strictObject({
  "type": z4.literal("requirement-changed"),
  "subjectId": z4.union([EntityIdSchema, z4.string()])
}), strictObject({
  "type": z4.literal("scenario-changed"),
  "scenarioId": EntityIdSchema
}), strictObject({
  "type": z4.literal("relation-changed"),
  "relationId": EntityIdSchema
}), strictObject({
  "type": z4.literal("constraint-changed"),
  "constraintId": EntityIdSchema
}), strictObject({
  "type": z4.literal("scope-expanded"),
  "scopeKey": z4.string()
}), strictObject({
  "type": z4.literal("surface-added"),
  "surfaceKind": z4.union([z4.literal("repository"), z4.literal("ci"), z4.literal("cloud"), z4.literal("package-registry"), z4.literal("app-store"), z4.literal("website"), z4.literal("runtime"), z4.literal("database"), z4.literal("external")])
}), strictObject({
  "type": z4.literal("assumption-falsified"),
  "assumptionKey": z4.string()
}), strictObject({
  "type": z4.literal("lens-changed"),
  "lensId": EntityIdSchema
}), strictObject({
  "type": z4.literal("evidence-invalidated"),
  "evidenceId": EntityIdSchema
}), strictObject({
  "type": z4.literal("evidence-refresh-required"),
  "policyKey": z4.string()
}), strictObject({
  "type": z4.literal("toolchain-version"),
  "tool": z4.string(),
  "constraint": z4.string()
}), strictObject({
  "type": z4.literal("platform-version"),
  "platform": z4.string(),
  "constraint": z4.string()
}), strictObject({
  "type": z4.literal("project-preference-changed"),
  "preferenceId": EntityIdSchema
}), strictObject({
  "type": z4.literal("counterevidence-threshold"),
  "subjectId": EntityIdSchema,
  "threshold": z4.number().finite()
}), strictObject({
  "type": z4.literal("date"),
  "at": z4.string()
}), strictObject({
  "type": z4.literal("manual-review")
})]));
var EvidenceRefreshPolicySchema = z4.lazy(() => strictObject({
  "key": z4.string(),
  "mode": z4.union([z4.literal("on-trigger"), z4.literal("version-sensitive"), z4.literal("max-age"), z4.literal("manual")]),
  "maxAgeDays": z4.number().finite().optional(),
  "trackedTechnologies": z4.array(z4.string()).optional(),
  "requireOfficialSourceWhenAvailable": z4.boolean()
}));
var AuthorityRecordSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z4.string(),
  "subjectId": EntityIdSchema,
  "status": z4.union([z4.literal("provisional"), z4.literal("approved"), z4.literal("auto-approved"), z4.literal("rejected"), z4.literal("superseded")]),
  "conclusion": z4.union([z4.literal("preserve"), z4.literal("normalize"), z4.literal("migrate"), z4.literal("exception"), z4.literal("unknown")]),
  "rationale": z4.string(),
  "alternatives": z4.array(AuthorityAlternativeSchema),
  "assumptions": z4.array(z4.string()),
  "reconsiderWhen": z4.array(AuthorityReconsiderTriggerSchema),
  "evidenceRefreshPolicy": EvidenceRefreshPolicySchema.optional(),
  "vector": AuthorityVectorSchema,
  "assessmentConfidence": z4.union([z4.literal("low"), z4.literal("medium"), z4.literal("high")]),
  "evidence": z4.array(EvidenceRefSchema),
  "governanceRiskClass": RiskClassSchema,
  "decidedBy": z4.union([z4.literal("system"), z4.literal("user"), z4.literal("policy")]),
  "createdAt": z4.string(),
  "semanticHash": ContentHashSchema
}));
var SemanticIdentityCandidateSchema = z4.lazy(() => strictObject({
  "entityId": EntityIdSchema,
  "entityKind": z4.union([z4.literal("concept"), z4.literal("requirement"), z4.literal("scenario")]),
  "similarity": ConfidenceSchema,
  "ownershipFit": ConfidenceSchema,
  "boundaryFit": ConfidenceSchema,
  "evidence": z4.array(EvidenceRefSchema),
  "explanation": z4.string()
}));
var NewSemanticBoundarySchema = z4.lazy(() => strictObject({
  "owns": z4.array(z4.string()),
  "excludes": z4.array(z4.string()),
  "nearestEntityIds": z4.array(EntityIdSchema),
  "rationale": z4.string()
}));
var SemanticIdentityResolutionSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "requestedMeaning": z4.string(),
  "requestedKind": z4.union([z4.literal("concept"), z4.literal("requirement"), z4.literal("scenario"), z4.literal("unknown")]),
  "outcome": z4.union([z4.literal("reuse-existing"), z4.literal("coordinated-modification"), z4.literal("split-existing"), z4.literal("merge-existing"), z4.literal("replace-existing"), z4.literal("create-new"), z4.literal("no-durable-entity"), z4.literal("unresolved")]),
  "candidates": z4.array(SemanticIdentityCandidateSchema),
  "selectedEntityIds": z4.array(EntityIdSchema),
  "newBoundary": NewSemanticBoundarySchema.optional(),
  "confidence": ConfidenceSchema,
  "evidence": z4.array(EvidenceRefSchema),
  "unknowns": z4.array(z4.string()),
  "boundState": StateBindingSchema,
  "contentHash": ContentHashSchema
}));
var RelevanceBandSchema = z4.lazy(() => z4.union([z4.literal("direct"), z4.literal("governing"), z4.literal("consequence"), z4.literal("possible")]));
var RelevanceSeedSchema = z4.lazy(() => strictObject({
  "kind": z4.union([z4.literal("request-term"), z4.literal("semantic-entity"), z4.literal("projection-unit"), z4.literal("artifact"), z4.literal("code-symbol"), z4.literal("contract"), z4.literal("event"), z4.literal("decision"), z4.literal("manual")]),
  "subjectId": z4.union([EntityIdSchema, z4.string()]).optional(),
  "value": z4.string().optional(),
  "reason": z4.string(),
  "confidence": ConfidenceSchema
}));
var RelevanceReasonSchema = z4.lazy(() => strictObject({
  "kind": z4.union([z4.literal("explicit"), z4.literal("identity-match"), z4.literal("governs"), z4.literal("constrains"), z4.literal("depends-on"), z4.literal("implementation-binding"), z4.literal("selector-applicability"), z4.literal("event-producer-consumer"), z4.literal("contract-producer-consumer"), z4.literal("verification-binding"), z4.literal("package-dependency"), z4.literal("historical-cochange"), z4.literal("semantic-similarity"), z4.literal("model-inference"), z4.literal("analysis-facet"), z4.literal("open-world-widening")]),
  "fromId": z4.union([EntityIdSchema, z4.string()]).optional(),
  "weight": z4.number().finite(),
  "provenance": z4.union([z4.literal("declared"), z4.literal("derived"), z4.literal("observed"), z4.literal("inferred")]),
  "confidence": ConfidenceSchema,
  "explanation": z4.string(),
  "evidenceIds": z4.array(EntityIdSchema)
}));
var RelevanceEntrySchema = z4.lazy(() => strictObject({
  "entityId": EntityIdSchema,
  "band": RelevanceBandSchema,
  "score": z4.number().finite(),
  "requiredForPlanning": z4.boolean(),
  "reasons": z4.array(RelevanceReasonSchema)
}));
var RelevanceClosureSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "requestHash": ContentHashSchema,
  "seeds": z4.array(RelevanceSeedSchema),
  "entries": z4.array(RelevanceEntrySchema),
  "activatedFacetKeys": z4.array(z4.string()),
  "unknowns": z4.array(z4.string()),
  "unavailableLanes": z4.array(z4.string()),
  "boundState": StateBindingSchema,
  "contentHash": ContentHashSchema
}));
var AnalysisFacetSchema = z4.lazy(() => strictObject({
  "key": z4.string(),
  "version": z4.string(),
  "selector": SelectorExprSchema,
  "questionKeys": z4.array(z4.string()),
  "relevanceRuleIds": z4.array(z4.string()),
  "requiredEvidenceLanes": z4.array(z4.union([z4.literal("compiler"), z4.literal("test"), z4.literal("schema"), z4.literal("runtime"), z4.literal("property"), z4.literal("representation"), z4.literal("architecture"), z4.literal("historical"), z4.literal("human"), z4.literal("independent-agent"), z4.literal("same-packet-agent")])),
  "outputKinds": z4.array(z4.string())
}));
var PlanningSurpriseSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "planId": EntityIdSchema,
  "kind": z4.union([z4.literal("unpredicted-semantic-impact"), z4.literal("unpredicted-code-impact"), z4.literal("missing-relation"), z4.literal("scope-expansion"), z4.literal("agent-overreach"), z4.literal("benign-discovery")]),
  "predictedEntityIds": z4.array(EntityIdSchema),
  "observedEntityIds": z4.array(EntityIdSchema),
  "unexpectedEntityIds": z4.array(EntityIdSchema),
  "evidence": z4.array(EvidenceRefSchema),
  "explanation": z4.string(),
  "disposition": z4.union([z4.literal("accept-and-learn"), z4.literal("accept-no-model-change"), z4.literal("repair-plan"), z4.literal("revert-overreach"), z4.literal("human-decision"), z4.literal("unresolved")]),
  "proposedRelationIds": z4.array(EntityIdSchema),
  "contentHash": ContentHashSchema
}));
var RiskClassSchema = z4.lazy(() => z4.union([z4.literal("R0"), z4.literal("R1"), z4.literal("R2"), z4.literal("R3"), z4.literal("R4")]));
var RiskAssessmentSchema = z4.lazy(() => strictObject({
  "class": RiskClassSchema,
  "inherentOperationRisk": z4.number().finite(),
  "affectedUnitCount": z4.number().finite(),
  "affectedSurfaceCount": z4.number().finite(),
  "publicContractImpact": z4.boolean(),
  "externalImpact": z4.boolean(),
  "dataImpact": z4.boolean(),
  "reversibility": z4.union([z4.literal("full"), z4.literal("strong"), z4.literal("partial"), z4.literal("none")]),
  "validationStrength": z4.union([z4.literal("weak"), z4.literal("supporting"), z4.literal("strong"), z4.literal("exact")]),
  "closureConfidence": z4.union([z4.literal("proven"), z4.literal("bounded"), z4.literal("high"), z4.literal("partial"), z4.literal("unknown")]),
  "unresolvedIdentityCount": z4.number().finite(),
  "relevanceFrontierCount": z4.number().finite(),
  "openWorldDependencies": z4.boolean(),
  "unresolvedBlockingConcernCount": z4.number().finite(),
  "suspectDecisionCount": z4.number().finite(),
  "compensationAvailable": z4.boolean(),
  "reasons": z4.array(z4.string())
}));
var ExecutionPolicySchema = z4.lazy(() => strictObject({
  "preset": z4.union([z4.literal("observe"), z4.literal("guide"), z4.literal("govern"), z4.literal("autonomous"), z4.literal("salvage")]),
  "maximumAutomaticRisk": RiskClassSchema,
  "network": z4.union([z4.literal("deny"), z4.literal("ask"), z4.literal("allow")]),
  "externalWrites": z4.union([z4.literal("deny"), z4.literal("approval"), z4.literal("allow-with-capability")]),
  "requireIndependentValidationAtOrAbove": RiskClassSchema,
  "requireWorktreeAtOrAbove": RiskClassSchema,
  "allowAutoPromotion": z4.boolean(),
  "allowAutoMutation": z4.boolean(),
  "maxChangedUnits": z4.number().finite().optional(),
  "maxChangedSurfaces": z4.number().finite().optional(),
  "maxCost": z4.number().finite().optional(),
  "maxTokens": z4.number().finite().optional()
}));
var PatternCandidateSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z4.string(),
  "purposeHypothesis": z4.string(),
  "memberUnitIds": z4.array(EntityIdSchema),
  "excludedUnitIds": z4.array(EntityIdSchema),
  "counterExamples": z4.array(EntityIdSchema),
  "independenceGroups": z4.array(z4.string()),
  "alternatives": z4.array(z4.string()),
  "confidence": ConfidenceSchema,
  "evidence": z4.array(EvidenceRefSchema),
  "semanticHash": ContentHashSchema
}));
var LensContributionRoleSchema = z4.lazy(() => z4.union([z4.literal("projection-owner"), z4.literal("constraint-contributor"), z4.literal("validator-contributor"), z4.literal("migration-overlay")]));
var ProjectionExpectationSchema = z4.lazy(() => z4.union([strictObject({
  "kind": z4.literal("exact-output"),
  "generatorId": z4.string(),
  "expectedSignatureProfile": z4.string()
}), strictObject({
  "kind": z4.literal("structured-template"),
  "structureValidatorId": z4.string(),
  "authoredHoles": z4.array(z4.string())
}), strictObject({
  "kind": z4.literal("predicate-constrained"),
  "predicateIds": z4.array(z4.string()),
  "validatorIds": z4.array(z4.string())
}), strictObject({
  "kind": z4.literal("observed-state"),
  "comparisonPolicyId": z4.string()
}), strictObject({
  "kind": z4.literal("human-procedure"),
  "procedureId": z4.string(),
  "evidenceRequirements": z4.array(z4.string())
})]));
var ProjectionSpecSchema = z4.lazy(() => strictObject({
  "role": z4.union([z4.literal("implementation"), z4.literal("contract"), z4.literal("test"), z4.literal("fixture"), z4.literal("documentation"), z4.literal("comment"), z4.literal("configuration"), z4.literal("deployment"), z4.literal("publication"), z4.literal("telemetry"), z4.literal("migration"), z4.literal("supporting")]),
  "cardinality": z4.union([z4.literal("one"), z4.literal("zero-or-one"), z4.literal("many"), z4.literal("at-least-one")]),
  "surfaceKind": z4.union([z4.literal("repository"), z4.literal("ci"), z4.literal("cloud"), z4.literal("package-registry"), z4.literal("app-store"), z4.literal("website"), z4.literal("runtime"), z4.literal("database"), z4.literal("external")]),
  "selector": SelectorExprSchema,
  "control": ControlPolicySchema,
  "expectation": ProjectionExpectationSchema
}));
var ProjectionLensSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z4.string(),
  "version": z4.string(),
  "status": z4.union([z4.literal("candidate"), z4.literal("shadow"), z4.literal("active"), z4.literal("deprecated"), z4.literal("retired")]),
  "purpose": z4.string(),
  "realizesConceptKinds": z4.array(z4.union([z4.literal("capability"), z4.literal("behavior"), z4.literal("invariant"), z4.literal("decision"), z4.literal("ownership"), z4.literal("obligation"), z4.literal("data"), z4.literal("interface"), z4.literal("event"), z4.literal("command"), z4.literal("policy"), z4.literal("read-model"), z4.literal("contract"), z4.literal("assumption"), z4.literal("migration"), z4.literal("constraint")])),
  "selector": SelectorExprSchema,
  "contributions": z4.array(LensContributionRoleSchema),
  "expectedProjections": z4.array(ProjectionSpecSchema),
  "rules": z4.array(RuleSchema),
  "impactRules": z4.array(ImpactRuleSchema),
  "recognizers": z4.array(RecognizerBindingSchema),
  "validators": z4.array(ValidatorBindingSchema),
  "transforms": z4.array(TransformBindingSchema),
  "migrations": z4.array(MigrationBindingSchema),
  "conflictsWith": z4.array(LensRefSchema),
  "compatibleWith": z4.array(LensRefSchema),
  "examples": z4.array(LensExampleSchema),
  "counterExamples": z4.array(LensExampleSchema),
  "authorityRecordId": EntityIdSchema,
  "governanceBasis": z4.array(GovernanceBasisSchema),
  "semanticHash": ContentHashSchema
}));
var SelectorExprSchema = z4.lazy(() => z4.union([strictObject({
  "op": z4.literal("all"),
  "items": z4.array(SelectorExprSchema)
}), strictObject({
  "op": z4.literal("any"),
  "items": z4.array(SelectorExprSchema)
}), strictObject({
  "op": z4.literal("not"),
  "item": SelectorExprSchema
}), strictObject({
  "op": z4.literal("atom"),
  "field": z4.union([z4.literal("path"), z4.literal("language"), z4.literal("artifact-role"), z4.literal("concept"), z4.literal("concept-kind"), z4.literal("requirement"), z4.literal("scenario"), z4.literal("lens"), z4.literal("surface"), z4.literal("package"), z4.literal("package-kind"), z4.literal("operation"), z4.literal("platform"), z4.literal("migration-phase"), z4.literal("risk"), z4.literal("tag"), z4.literal("control-ownership"), z4.literal("control-mutation"), z4.literal("ast-pattern"), z4.literal("relation"), z4.literal("causal-origin")]),
  "matcher": z4.union([z4.literal("equals"), z4.literal("in"), z4.literal("glob"), z4.literal("regex"), z4.literal("contains"), z4.literal("exists"), z4.literal("matches-structural-query")]),
  "value": JsonValueSchema
})]));
var RealizationSelectorExprSchema = z4.lazy(() => z4.union([strictObject({
  "op": z4.literal("all"),
  "items": z4.array(RealizationSelectorExprSchema)
}), strictObject({
  "op": z4.literal("any"),
  "items": z4.array(RealizationSelectorExprSchema)
}), strictObject({
  "op": z4.literal("not"),
  "item": RealizationSelectorExprSchema
}), strictObject({
  "op": z4.literal("atom"),
  "field": z4.union([z4.literal("path"), z4.literal("artifact-role"), z4.literal("surface"), z4.literal("package"), z4.literal("package-kind"), z4.literal("tag"), z4.literal("control-ownership"), z4.literal("control-mutation"), z4.literal("causal-origin")]),
  "matcher": z4.union([z4.literal("equals"), z4.literal("in"), z4.literal("glob"), z4.literal("regex"), z4.literal("contains"), z4.literal("exists"), z4.literal("matches-structural-query")]),
  "value": JsonValueSchema
})]));
var IgnorePolicySchema = z4.lazy(() => strictObject({
  "inventory": z4.array(SelectorExprSchema),
  "inferenceAuthority": z4.array(SelectorExprSchema),
  "mutation": z4.array(SelectorExprSchema),
  "reporting": z4.array(SelectorExprSchema),
  "modelContext": z4.array(SelectorExprSchema),
  "coverageDenominator": z4.array(SelectorExprSchema)
}));
var RuleEffectSchema = z4.lazy(() => z4.union([z4.literal("require"), z4.literal("forbid"), z4.literal("prefer"), z4.literal("validate"), z4.literal("transform"), z4.literal("route"), z4.literal("grant"), z4.literal("restrict"), z4.literal("explain")]));
var AuthorityClassSchema = z4.lazy(() => z4.union([z4.literal("host-safety"), z4.literal("platform-constraint"), z4.literal("approved-user-intent"), z4.literal("active-lens"), z4.literal("adopted-external-standard"), z4.literal("migration-overlay"), z4.literal("local-convention"), z4.literal("inferred-candidate"), z4.literal("task-suggestion")]));
var NormalizedPredicateSchema = z4.lazy(() => z4.union([strictObject({
  "kind": z4.literal("path-under"),
  "root": z4.string()
}), strictObject({
  "kind": z4.literal("path-not-under"),
  "root": z4.string()
}), strictObject({
  "kind": z4.literal("relation-required"),
  "relation": RelationTypeSchema,
  "targetSelector": SelectorExprSchema
}), strictObject({
  "kind": z4.literal("relation-forbidden"),
  "relation": RelationTypeSchema,
  "targetSelector": SelectorExprSchema
}), strictObject({
  "kind": z4.literal("cardinality"),
  "selector": SelectorExprSchema,
  "min": z4.number().finite().optional(),
  "max": z4.number().finite().optional()
}), strictObject({
  "kind": z4.literal("dependency-allowed"),
  "from": SelectorExprSchema,
  "to": SelectorExprSchema
}), strictObject({
  "kind": z4.literal("dependency-forbidden"),
  "from": SelectorExprSchema,
  "to": SelectorExprSchema
}), strictObject({
  "kind": z4.literal("permission"),
  "operation": z4.string(),
  "allowed": z4.boolean()
}), strictObject({
  "kind": z4.literal("unit-state"),
  "state": ValidityStateSchema
}), strictObject({
  "kind": z4.literal("schema-valid"),
  "schemaId": z4.string()
}), strictObject({
  "kind": z4.literal("validator"),
  "validatorId": z4.string()
})]));
var RuleSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z4.string(),
  "version": z4.string(),
  "effect": RuleEffectSchema,
  "authorityClass": AuthorityClassSchema,
  "governanceBasis": z4.array(GovernanceBasisSchema),
  "selector": SelectorExprSchema,
  "predicates": z4.array(NormalizedPredicateSchema),
  "advisoryPayload": z4.record(z4.string(), JsonValueSchema).optional(),
  "rationale": z4.string(),
  "evidence": z4.array(EvidenceRefSchema),
  "conflictPolicy": z4.union([z4.literal("error"), z4.literal("merge"), z4.literal("higher-authority"), z4.literal("explicit-exception-only")]),
  "validatorIds": z4.array(z4.string()),
  "transformIds": z4.array(z4.string()),
  "semanticHash": ContentHashSchema
}));
var RuleConflictSchema = z4.lazy(() => strictObject({
  "ruleIds": z4.array(EntityIdSchema),
  "unitId": EntityIdSchema,
  "kind": z4.union([z4.literal("require-forbid"), z4.literal("exclusive-transform"), z4.literal("authority-override"), z4.literal("ambiguous-selector"), z4.literal("incompatible-predicate")]),
  "explanation": z4.string(),
  "evidenceIds": z4.array(EntityIdSchema)
}));
var EffectiveRuleBundleSchema = z4.lazy(() => strictObject({
  "unitId": EntityIdSchema,
  "operation": z4.string(),
  "rules": z4.array(RuleSchema),
  "suppressedRules": z4.array(strictObject({
    "ruleId": EntityIdSchema,
    "reason": z4.string(),
    "supersededBy": EntityIdSchema.optional()
  })),
  "predicates": z4.array(NormalizedPredicateSchema),
  "conflicts": z4.array(RuleConflictSchema),
  "dependencyFingerprint": ContentHashSchema,
  "bundleHash": ContentHashSchema
}));
var DerivationInputSchema = z4.lazy(() => strictObject({
  "kind": z4.union([z4.literal("concept"), z4.literal("requirement"), z4.literal("scenario"), z4.literal("relation"), z4.literal("lens"), z4.literal("rule-bundle"), z4.literal("unit"), z4.literal("artifact"), z4.literal("external-constraint"), z4.literal("toolchain"), z4.literal("adapter"), z4.literal("signature-profile"), z4.literal("representation-profile"), z4.literal("representation-projection")]),
  "id": z4.union([EntityIdSchema, z4.string()]),
  "versionHash": ContentHashSchema,
  "role": z4.string()
}));
var DerivationRecordSchema = z4.lazy(() => strictObject({
  "unitId": EntityIdSchema,
  "proofGroupId": EntityIdSchema.optional(),
  "engineVersion": z4.string(),
  "adapterVersion": z4.string(),
  "inputs": z4.array(DerivationInputSchema),
  "ruleBundleHash": ContentHashSchema,
  "outputSemanticSignature": SemanticSignatureSchema,
  "outputStructuralSignature": SemanticSignatureSchema,
  "membershipHash": ContentHashSchema,
  "establishedAt": z4.string(),
  "validators": z4.array(ValidationResultSchema)
}));
var ImpactRuleSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z4.string(),
  "version": z4.string(),
  "selector": SelectorExprSchema,
  "trigger": z4.union([z4.literal("concept-change"), z4.literal("interface-change"), z4.literal("membership-change"), z4.literal("removal"), z4.literal("lens-change"), z4.literal("rule-change"), z4.literal("decision-change"), z4.literal("concern-resolution"), z4.literal("representation-profile-change"), z4.literal("external-change"), z4.literal("manual")]),
  "direction": z4.union([z4.literal("forward"), z4.literal("reverse"), z4.literal("both")]),
  "relationTypes": z4.array(RelationTypeSchema).optional(),
  "maxDepth": z4.number().finite().optional(),
  "effect": z4.union([z4.literal("invalidate"), z4.literal("revalidate"), z4.literal("widen-analysis"), z4.literal("advisory"), z4.literal("block")]),
  "requiredRelationConfidence": z4.number().finite().optional(),
  "semanticHash": ContentHashSchema
}));
var InvalidationCauseSchema = z4.lazy(() => strictObject({
  "eventKind": z4.string(),
  "subjectId": z4.union([EntityIdSchema, z4.string()]),
  "oldHash": ContentHashSchema.optional(),
  "newHash": ContentHashSchema.optional()
}));
var InvalidationEventSchema = z4.lazy(() => strictObject({
  "eventKind": z4.string(),
  "subjectId": z4.union([EntityIdSchema, z4.string()]),
  "oldHash": ContentHashSchema.optional(),
  "newHash": ContentHashSchema.optional(),
  "graphRevision": z4.number().finite(),
  "stateDigest": StateDigestSchema
}));
var InvalidationResultSchema = z4.lazy(() => strictObject({
  "directlyAffected": z4.array(EntityIdSchema),
  "transitivelyAffected": z4.array(EntityIdSchema),
  "possibleFrontier": z4.array(EntityIdSchema),
  "unavailable": z4.array(EntityIdSchema),
  "reasons": z4.record(EntityIdSchema, z4.array(z4.string()))
}));
var RepairStrategySchema = z4.lazy(() => z4.union([z4.literal("reuse"), z4.literal("revalidate"), z4.literal("deterministic-patch"), z4.literal("regenerate"), z4.literal("agent-repair"), z4.literal("widen-analysis"), z4.literal("human-decision")]));
var RepairCapabilitiesSchema = z4.lazy(() => strictObject({
  "validatorCanProveValidity": z4.boolean(),
  "deterministicPatch": z4.boolean(),
  "patchIsReversible": z4.boolean(),
  "generator": z4.boolean(),
  "upstreamSourceKnown": z4.boolean()
}));
var ContextPrecedentSchema = z4.lazy(() => strictObject({
  "unitId": EntityIdSchema,
  "similarity": ConfidenceSchema,
  "relevance": z4.string(),
  "evidenceIds": z4.array(EntityIdSchema)
}));
var ScopeGrantSchema = z4.lazy(() => strictObject({
  "selector": SelectorExprSchema,
  "operations": z4.array(z4.string()),
  "reason": z4.string()
}));
var CompletionContractSchema = z4.lazy(() => strictObject({
  "requiredUnitStates": z4.array(strictObject({
    "unitId": EntityIdSchema,
    "state": z4.union([z4.literal("valid"), z4.literal("removed"), z4.literal("exception")])
  })),
  "requiredValidators": z4.array(z4.string()),
  "requiredEvidenceLanes": z4.array(z4.union([z4.literal("compiler"), z4.literal("test"), z4.literal("schema"), z4.literal("runtime"), z4.literal("property"), z4.literal("representation"), z4.literal("architecture"), z4.literal("historical"), z4.literal("human"), z4.literal("independent-agent"), z4.literal("same-packet-agent")])),
  "minimumValidationAssurance": z4.union([z4.literal("weak"), z4.literal("supporting"), z4.literal("strong"), z4.literal("exact")]),
  "requireIndependentValidation": z4.boolean(),
  "maximumNewDivergences": z4.number().finite(),
  "maximumUnknowns": z4.number().finite(),
  "allowUnavailableExternalActions": z4.boolean(),
  "requiredArtifacts": z4.array(z4.string()),
  "cleanWorkingTree": z4.boolean()
}));
var ExecutionCapsuleSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "taskId": EntityIdSchema,
  "objective": z4.string(),
  "operation": z4.string(),
  "unitIds": z4.array(EntityIdSchema),
  "boundState": StateBindingSchema,
  "relevanceClosureId": EntityIdSchema,
  "analysisFacetKeys": z4.array(z4.string()),
  "requirementIds": z4.array(EntityIdSchema),
  "scenarioIds": z4.array(EntityIdSchema),
  "conceptSummary": z4.string(),
  "decisionIds": z4.array(EntityIdSchema),
  "decisionSummary": z4.string(),
  "unresolvedArchitectureConcerns": z4.array(EntityIdSchema),
  "lensSummary": z4.string(),
  "effectiveRules": z4.array(EffectiveRuleBundleSchema),
  "normativeKernelHash": ContentHashSchema,
  "representation": RepresentationProjectionRefSchema.optional(),
  "relevantPrecedents": z4.array(ContextPrecedentSchema),
  "allowedWrites": z4.array(ScopeGrantSchema),
  "forbiddenWrites": z4.array(ScopeGrantSchema),
  "availablePrimitives": z4.array(z4.string()),
  "requiredValidations": z4.array(z4.string()),
  "upstreamImplications": z4.array(z4.string()),
  "downstreamImplications": z4.array(z4.string()),
  "knownExceptions": z4.array(z4.string()),
  "unknowns": z4.array(z4.string()),
  "risk": RiskAssessmentSchema,
  "completionContract": CompletionContractSchema,
  "contextDependencyHash": ContentHashSchema,
  "contextHash": ContentHashSchema
}));
var CommandSpecSchema = z4.lazy(() => strictObject({
  "id": z4.string(),
  "argv": z4.array(z4.string()),
  "cwd": z4.string(),
  "readScope": z4.array(z4.string()),
  "writeScope": z4.array(z4.string()),
  "requiresNetwork": z4.boolean(),
  "environmentKeys": z4.array(z4.string()),
  "sideEffectClass": z4.union([z4.literal("none"), z4.literal("read-only"), z4.literal("workspace-write"), z4.literal("external-write")]),
  "timeoutMs": z4.number().finite(),
  "cpuBudgetMs": z4.number().finite().optional(),
  "memoryBudgetMb": z4.number().finite().optional()
}));
var CoverageLaneSchema = z4.lazy(() => strictObject({
  "key": z4.string(),
  "observability": ObservabilityClassSchema,
  "numerator": z4.number().finite(),
  "denominator": z4.number().finite().optional(),
  "confidence": ConfidenceSchema,
  "assumptions": z4.array(z4.string()),
  "blindSpots": z4.array(z4.string()),
  "analyzerFailures": z4.array(AnalyzerFailureSchema),
  "staleObservationIds": z4.array(z4.string()),
  "exactClosureProvable": z4.boolean()
}));
var CoverageSnapshotSchema = z4.lazy(() => strictObject({
  "graphRevision": z4.number().finite(),
  "boundary": z4.array(z4.string()),
  "lanes": z4.array(CoverageLaneSchema),
  "completeWithinBoundary": z4.boolean(),
  "allowsBoundedAgentRepair": z4.boolean(),
  "unknownFrontierIds": z4.array(EntityIdSchema),
  "unavailableSurfaceIds": z4.array(EntityIdSchema),
  "proofStatement": z4.union([z4.literal("proven-within-boundary"), z4.literal("bounded"), z4.literal("high-confidence"), z4.literal("partial"), z4.literal("not-established")])
}));
var DivergenceSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "type": z4.string(),
  "title": z4.string(),
  "severity": z4.union([z4.literal("info"), z4.literal("low"), z4.literal("medium"), z4.literal("high"), z4.literal("critical")]),
  "confidence": ConfidenceSchema,
  "leverage": z4.number().finite(),
  "status": z4.union([z4.literal("open"), z4.literal("auto-fixed"), z4.literal("planned"), z4.literal("accepted-exception"), z4.literal("dismissed"), z4.literal("blocked")]),
  "expected": z4.record(z4.string(), JsonValueSchema),
  "observed": z4.record(z4.string(), JsonValueSchema),
  "conceptIds": z4.array(EntityIdSchema),
  "requirementIds": z4.array(EntityIdSchema),
  "scenarioIds": z4.array(EntityIdSchema),
  "unitIds": z4.array(EntityIdSchema),
  "ruleIds": z4.array(EntityIdSchema),
  "evidence": z4.array(EvidenceRefSchema),
  "counterEvidence": z4.array(EvidenceRefSchema),
  "rationale": z4.string(),
  "possibleIntentionality": z4.array(z4.string()),
  "recommendedDisposition": z4.string(),
  "repairStrategies": z4.array(RepairStrategySchema),
  "coverageCaveat": z4.string(),
  "semanticHash": ContentHashSchema
}));
var PlanCheckpointSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "afterPacketIds": z4.array(EntityIdSchema),
  "requiredValidators": z4.array(z4.string()),
  "rollback": RollbackSpecSchema
}));
var ExecutionPlanSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "revision": z4.number().finite(),
  "supersedesPlanId": EntityIdSchema.optional(),
  "semanticChangeId": EntityIdSchema.optional(),
  "sourceRunId": EntityIdSchema,
  "boundState": StateBindingSchema,
  "relevanceClosureId": EntityIdSchema.optional(),
  "predictedImpactClosureHash": ContentHashSchema.optional(),
  "boundary": z4.array(z4.string()),
  "assumptions": z4.array(z4.string()),
  "knownAffectedUnitIds": z4.array(EntityIdSchema),
  "possibleFrontierUnitIds": z4.array(EntityIdSchema),
  "unavailableSurfaceIds": z4.array(EntityIdSchema),
  "packetIds": z4.array(EntityIdSchema),
  "checkpoints": z4.array(PlanCheckpointSchema),
  "completionCriteria": CompletionContractSchema,
  "recommendedNextChunk": z4.string().optional()
}));
var IntentStatementSchema = z4.lazy(() => strictObject({
  "kind": z4.union([z4.literal("behavior"), z4.literal("constraint"), z4.literal("non-goal"), z4.literal("assumption"), z4.literal("implementation-proposal")]),
  "statement": z4.string(),
  "origin": z4.array(IntentOriginRefSchema),
  "confidence": ConfidenceSchema
}));
var ChangeIntentAnalysisSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "request": z4.string(),
  "normalizedIntent": z4.string(),
  "statements": z4.array(IntentStatementSchema),
  "ambiguity": z4.array(z4.string()),
  "assumptions": z4.array(z4.string()),
  "contentHash": ContentHashSchema
}));
var RequirementDeltaSchema = z4.lazy(() => strictObject({
  "subjectType": z4.literal("requirement"),
  "kind": z4.union([z4.literal("add"), z4.literal("modify"), z4.literal("remove"), z4.literal("supersede")]),
  "requirementId": EntityIdSchema.optional(),
  "proposedRequirement": RequirementSchema.optional(),
  "rationale": z4.string()
}).superRefine((value, context) => {
  const needsExistingId = value.kind !== "add";
  const needsProposedValue = value.kind !== "remove";
  if (needsExistingId !== (value.requirementId !== void 0))
    context.addIssue({ code: "custom", path: ["requirementId"], message: needsExistingId ? "existing ID is required" : "add cannot name an existing ID" });
  if (needsProposedValue !== (value.proposedRequirement !== void 0))
    context.addIssue({ code: "custom", path: ["proposedRequirement"], message: needsProposedValue ? "proposed value is required" : "remove cannot carry a proposed value" });
}));
var BehavioralScenarioDeltaSchema = z4.lazy(() => strictObject({
  "subjectType": z4.literal("scenario"),
  "kind": z4.union([z4.literal("add"), z4.literal("modify"), z4.literal("remove"), z4.literal("supersede")]),
  "scenarioId": EntityIdSchema.optional(),
  "proposedScenario": BehavioralScenarioSchema.optional(),
  "rationale": z4.string()
}).superRefine((value, context) => {
  const needsExistingId = value.kind !== "add";
  const needsProposedValue = value.kind !== "remove";
  if (needsExistingId !== (value.scenarioId !== void 0))
    context.addIssue({ code: "custom", path: ["scenarioId"], message: needsExistingId ? "existing ID is required" : "add cannot name an existing ID" });
  if (needsProposedValue !== (value.proposedScenario !== void 0))
    context.addIssue({ code: "custom", path: ["proposedScenario"], message: needsProposedValue ? "proposed value is required" : "remove cannot carry a proposed value" });
}));
var SemanticOperationSchema = z4.lazy(() => strictObject({
  "kind": z4.union([z4.literal("add"), z4.literal("modify"), z4.literal("remove"), z4.literal("replace"), z4.literal("migrate"), z4.literal("adopt-rule"), z4.literal("deprecate-rule"), z4.literal("resolve-divergence")]),
  "subjectType": z4.union([z4.literal("concept"), z4.literal("relation"), z4.literal("decision"), z4.literal("lens"), z4.literal("rule"), z4.literal("projection"), z4.literal("surface"), z4.literal("other")]),
  "subjectKey": z4.string(),
  "subjectId": EntityIdSchema.optional(),
  "payload": z4.record(z4.string(), JsonValueSchema)
}));
var ChangeOperationSchema = z4.lazy(() => z4.union([SemanticOperationSchema, RequirementDeltaSchema, BehavioralScenarioDeltaSchema]));
var ImpactClosureRefSchema = z4.lazy(() => strictObject({
  "contentHash": ContentHashSchema,
  "knownAffectedUnitIds": z4.array(EntityIdSchema),
  "possibleFrontierUnitIds": z4.array(EntityIdSchema),
  "unavailableSurfaceIds": z4.array(EntityIdSchema)
}));
var SemanticChangeSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "request": z4.string(),
  "normalizedIntent": z4.string(),
  "intentAnalysisId": EntityIdSchema,
  "identityResolutionIds": z4.array(EntityIdSchema),
  "relevanceClosureId": EntityIdSchema,
  "analysisFacetKeys": z4.array(z4.string()),
  "operations": z4.array(ChangeOperationSchema),
  "decisionIds": z4.array(EntityIdSchema),
  "assumptions": z4.array(z4.string()),
  "boundary": z4.array(z4.string()),
  "predictedImpact": ImpactClosureRefSchema.optional(),
  "risk": RiskAssessmentSchema,
  "status": z4.union([z4.literal("draft"), z4.literal("analyzed"), z4.literal("approved"), z4.literal("executing"), z4.literal("complete"), z4.literal("blocked")])
}));
var WorkPacketSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "planId": EntityIdSchema,
  "title": z4.string(),
  "strategy": RepairStrategySchema,
  "unitIds": z4.array(EntityIdSchema),
  "dependencies": z4.array(EntityIdSchema),
  "capsuleId": EntityIdSchema,
  "risk": RiskAssessmentSchema,
  "executionMode": z4.union([z4.literal("deterministic"), z4.literal("agent"), z4.literal("manual"), z4.literal("external")]),
  "transformId": z4.string().optional(),
  "validatorIds": z4.array(z4.string()),
  "rollback": RollbackSpecSchema,
  "boundState": StateBindingSchema,
  "status": z4.union([z4.literal("pending"), z4.literal("running"), z4.literal("succeeded"), z4.literal("failed"), z4.literal("blocked"), z4.literal("skipped")])
}));
var TransactionPhaseSchema = z4.lazy(() => z4.union([z4.literal("prepared"), z4.literal("workspace-mutating"), z4.literal("workspace-staged"), z4.literal("validating"), z4.literal("canonical-staging"), z4.literal("committing"), z4.literal("committed"), z4.literal("rolling-back"), z4.literal("rolled-back"), z4.literal("recovery-required")]));
var TransactionJournalEntrySchema = z4.lazy(() => strictObject({
  "transactionId": EntityIdSchema,
  "planId": EntityIdSchema,
  "phase": TransactionPhaseSchema,
  "beforeState": StateDigestSchema,
  "intendedAfterCanonicalDigest": ContentHashSchema.optional(),
  "worktreePath": z4.string(),
  "checkpointIds": z4.array(z4.string()),
  "touchedPaths": z4.array(z4.string()),
  "externalOperationIds": z4.array(z4.string()),
  "updatedAt": z4.string()
}));
var TransactionReceiptSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "planId": EntityIdSchema,
  "semanticChangeId": EntityIdSchema.optional(),
  "riskClass": RiskClassSchema,
  "beforeState": StateDigestSchema,
  "afterState": StateDigestSchema,
  "changedCanonicalEntityIds": z4.array(EntityIdSchema),
  "changedRequirementIds": z4.array(EntityIdSchema),
  "changedScenarioIds": z4.array(EntityIdSchema),
  "changedUnitIds": z4.array(EntityIdSchema),
  "validationSummaryHash": ContentHashSchema,
  "certificateHash": ContentHashSchema.optional(),
  "rollbackRef": z4.string().optional(),
  "createdAt": z4.string(),
  "semanticHash": ContentHashSchema
}));
var ChangeCertificateSchema = z4.lazy(() => strictObject({
  "id": EntityIdSchema,
  "planId": EntityIdSchema,
  "baseGitRevision": z4.string().optional(),
  "resultingGitRevision": z4.string().optional(),
  "semanticChange": SemanticChangeSchema.optional(),
  "relevanceClosureHash": ContentHashSchema.optional(),
  "predictedImpactClosureHash": ContentHashSchema.optional(),
  "observedImpactClosureHash": ContentHashSchema.optional(),
  "beforeState": StateDigestSchema,
  "afterState": StateDigestSchema.optional(),
  "changedConcepts": z4.array(EntityIdSchema),
  "changedRequirements": z4.array(EntityIdSchema),
  "changedScenarios": z4.array(EntityIdSchema),
  "changedRelations": z4.array(EntityIdSchema),
  "changedUnits": z4.array(EntityIdSchema),
  "planningSurpriseIds": z4.array(EntityIdSchema),
  "deterministicOperations": z4.array(OperationEvidenceSchema),
  "agentOperations": z4.array(OperationEvidenceSchema),
  "validations": z4.array(ValidationResultSchema),
  "divergencesResolved": z4.array(EntityIdSchema),
  "divergencesIntroduced": z4.array(EntityIdSchema),
  "modeledBoundary": z4.array(z4.string()),
  "completeness": z4.union([z4.literal("proven-within-boundary"), z4.literal("bounded"), z4.literal("high-confidence"), z4.literal("partial"), z4.literal("not-established")]),
  "unknowns": z4.array(z4.string()),
  "unavailableActions": z4.array(z4.string()),
  "rollback": z4.array(RollbackSpecSchema),
  "createdAt": z4.string()
}));
var StructuredModelRequestSchema = z4.lazy(() => strictObject({
  "purpose": z4.string(),
  "role": z4.union([z4.literal("classify"), z4.literal("infer-concepts"), z4.literal("resolve-identity"), z4.literal("discover-relevance"), z4.literal("analyze-intent"), z4.literal("infer-pattern"), z4.literal("research-synthesis"), z4.literal("architecture"), z4.literal("bounded-edit"), z4.literal("representation-render"), z4.literal("representation-review"), z4.literal("adversarial-review"), z4.literal("judge")]),
  "programVersion": z4.string(),
  "schemaName": z4.string(),
  "schemaVersion": z4.string(),
  "schema": JsonValueSchema,
  "input": z4.record(z4.string(), JsonValueSchema),
  "inputHash": ContentHashSchema,
  "executionCapsule": ExecutionCapsuleSchema.optional(),
  "risk": RiskAssessmentSchema,
  "maxInputTokens": z4.number().finite().optional(),
  "maxOutputTokens": z4.number().finite().optional(),
  "maxCost": z4.number().finite().optional()
}));
var StructuredModelResponseSchema = z4.lazy(() => strictObject({
  "value": JsonValueSchema,
  "provider": z4.string(),
  "model": z4.string(),
  "providerRevision": z4.string().optional(),
  "inputTokens": z4.number().finite().optional(),
  "outputTokens": z4.number().finite().optional(),
  "rawResponseHash": ContentHashSchema,
  "attempt": z4.number().finite()
}));

// node_modules/@projector/core/dist/schemas/canonical-envelope.js
import { z as z5 } from "zod";
var CanonicalKindSchema = z5.enum([
  "concept",
  "requirement",
  "behavioral-scenario",
  "relation",
  "lineage",
  "tombstone",
  "rule",
  "projection-lens",
  "semantic-representation-profile",
  "authority-record",
  "architecture-decision",
  "architecture-concern",
  "developer-preference",
  "exception",
  "migration",
  "transaction-receipt"
]);
var CanonicalPayloadSchemas = Object.freeze({
  "architecture-decision": ArchitectureDecisionSchema,
  "architecture-concern": ArchitectureConcernSchema,
  "developer-preference": DeveloperPreferenceSchema,
  "authority-record": AuthorityRecordSchema,
  "behavioral-scenario": BehavioralScenarioSchema,
  concept: ConceptSchema,
  exception: GovernanceExceptionSchema,
  lineage: LineageRecordSchema,
  migration: MigrationOverlaySchema,
  "projection-lens": ProjectionLensSchema,
  relation: RelationSchema,
  requirement: RequirementSchema,
  rule: RuleSchema,
  "semantic-representation-profile": SemanticRepresentationProfileSchema,
  tombstone: TombstoneSchema,
  "transaction-receipt": TransactionReceiptSchema
});
var canonicalEnvelopeShape = {
  apiVersion: z5.string().min(1),
  schemaVersion: z5.string().min(1),
  kind: CanonicalKindSchema,
  id: EntityIdSchema,
  key: z5.string().min(1),
  lifecycle: z5.string().min(1),
  payload: z5.record(z5.string(), JsonValueSchema),
  semanticHash: ContentHashSchema,
  discoveryHash: ContentHashSchema.optional(),
  canonicalDocumentHash: ContentHashSchema
};
var verifyEnvelope = (value, context) => {
  for (const message of verifyCanonicalEnvelope(value)) {
    context.addIssue({ code: "custom", message });
  }
};
var verifyCanonicalOwnerEvidence = (value, context) => {
  if (value.kind !== "requirement" && value.kind !== "behavioral-scenario")
    return;
  const parsed = CanonicalPayloadSchemas[value.kind].safeParse(value.payload);
  if (!parsed.success)
    return;
  for (const issue of applicationEvidenceBindingIssues(parsed.data.evidence)) {
    context.addIssue({ code: "custom", path: ["payload", "evidence", issue.index, "applicationPredicate", "observationRole"], message: issue.message });
  }
};
var CanonicalDocumentEnvelopeSchema = z5.strictObject(canonicalEnvelopeShape).superRefine((value, context) => {
  const payloadResult = CanonicalPayloadSchemas[value.kind].safeParse(value.payload);
  if (!payloadResult.success) {
    for (const issue of payloadResult.error.issues) {
      context.addIssue({ code: "custom", path: ["payload", ...issue.path], message: issue.message });
    }
  }
  verifyCanonicalOwnerEvidence(value, context);
  verifyEnvelope(value, context);
});
function canonicalDocumentEnvelopeSchemaForKind(kind) {
  return z5.strictObject({
    ...canonicalEnvelopeShape,
    kind: z5.literal(kind),
    payload: CanonicalPayloadSchemas[kind]
  }).superRefine((value, context) => {
    verifyCanonicalOwnerEvidence(value, context);
    verifyEnvelope(value, context);
  });
}
var CanonicalDocumentEnvelopeSchemasByKind = Object.freeze(Object.fromEntries(CanonicalKindSchema.options.map((kind) => [kind, canonicalDocumentEnvelopeSchemaForKind(kind)])));
var canonicalDocumentEnvelopeSchemas = Object.values(CanonicalDocumentEnvelopeSchemasByKind);
var CanonicalDocumentEnvelopeByKindSchema = z5.union(canonicalDocumentEnvelopeSchemas);
var canonicalPayloadMirrorFields = Object.freeze(Object.fromEntries(CanonicalKindSchema.options.map((kind) => {
  const payload = unwrapObjectSchema(CanonicalPayloadSchemas[kind]);
  const fields = payload.shape;
  return [kind, Object.freeze({
    id: Object.hasOwn(fields, "id"),
    key: Object.hasOwn(fields, "key"),
    ...Object.hasOwn(fields, "lifecycle") ? { lifecycle: "lifecycle" } : Object.hasOwn(fields, "status") ? { lifecycle: "status" } : Object.hasOwn(fields, "active") ? { lifecycle: "active" } : {},
    semanticHash: Object.hasOwn(fields, "semanticHash"),
    discoveryHash: Object.hasOwn(fields, "discoveryHash")
  })];
})));
function canonicalDocumentWireSchemaForKind(kind) {
  const payload = unwrapObjectSchema(CanonicalPayloadSchemas[kind]);
  const mirrors = canonicalPayloadMirrorFields[kind];
  const omitted = Object.fromEntries([
    ...mirrors.id ? ["id"] : [],
    ...mirrors.key ? ["key"] : [],
    ...mirrors.lifecycle === void 0 ? [] : [mirrors.lifecycle],
    ...mirrors.semanticHash ? ["semanticHash"] : [],
    ...mirrors.discoveryHash ? ["discoveryHash"] : []
  ].map((field) => [field, true]));
  const authoredPayloadShape = Object.fromEntries(Object.entries(payload.shape).filter(([field]) => omitted[field] !== true));
  return z5.strictObject({
    apiVersion: z5.string().min(1),
    schemaVersion: z5.string().min(1),
    kind: z5.literal(kind),
    id: EntityIdSchema,
    key: z5.string().min(1),
    lifecycle: canonicalWireLifecycleSchema(kind, payload, mirrors),
    payload: z5.strictObject(authoredPayloadShape)
  }).superRefine((value, context) => {
    const result = CanonicalDocumentEnvelopeSchemasByKind[kind].safeParse(hydrateParsedCanonicalDocumentWire(value));
    if (!result.success)
      for (const issue of result.error.issues)
        context.addIssue({ code: "custom", path: issue.path, message: issue.message });
  });
}
function canonicalWireLifecycleSchema(kind, payload, mirrors) {
  if (mirrors.lifecycle === "status" || mirrors.lifecycle === "lifecycle")
    return payload.shape[mirrors.lifecycle];
  if (mirrors.lifecycle === "active")
    return z5.enum(["active", "inactive"]);
  const fixed = FixedCanonicalLifecycleByKind[kind];
  return fixed === void 0 ? z5.string().min(1) : z5.literal(fixed);
}
var CanonicalDocumentWireSchemasByKind = Object.freeze(Object.fromEntries(CanonicalKindSchema.options.map((kind) => [kind, canonicalDocumentWireSchemaForKind(kind)])));
var canonicalDocumentWireSchemas = Object.values(CanonicalDocumentWireSchemasByKind);
var CanonicalDocumentWireByKindSchema = z5.union(canonicalDocumentWireSchemas);
function hydrateCanonicalDocumentWire(unparsed) {
  const kind = z5.strictObject({ kind: CanonicalKindSchema }).loose().parse(unparsed).kind;
  const wire = CanonicalDocumentWireSchemasByKind[kind].parse(unparsed);
  const hydrated = hydrateParsedCanonicalDocumentWire(wire);
  return CanonicalDocumentEnvelopeSchemasByKind[wire.kind].parse(hydrated);
}
function hydrateParsedCanonicalDocumentWire(wire) {
  const mirrors = canonicalPayloadMirrorFields[wire.kind];
  const payload = {
    ...wire.payload,
    ...mirrors.id ? { id: wire.id } : {},
    ...mirrors.key ? { key: wire.key } : {},
    ...mirrors.lifecycle === "lifecycle" ? { lifecycle: wire.lifecycle } : mirrors.lifecycle === "status" ? { status: wire.lifecycle } : mirrors.lifecycle === "active" ? { active: wire.lifecycle === "active" } : {},
    ...mirrors.semanticHash ? { semanticHash: "sha256:v1:placeholder" } : {},
    ...mirrors.discoveryHash ? { discoveryHash: "sha256:v1:placeholder" } : {}
  };
  return withCanonicalHashes({
    apiVersion: wire.apiVersion,
    schemaVersion: wire.schemaVersion,
    kind: wire.kind,
    id: wire.id,
    key: wire.key,
    lifecycle: wire.lifecycle,
    payload
  });
}
function toCanonicalDocumentWire(unparsed) {
  const kind = z5.strictObject({ kind: CanonicalKindSchema }).loose().parse(unparsed).kind;
  const envelope = CanonicalDocumentEnvelopeSchemasByKind[kind].parse(unparsed);
  const mirrors = canonicalPayloadMirrorFields[envelope.kind];
  const payload = { ...envelope.payload };
  if (mirrors.id)
    delete payload.id;
  if (mirrors.key)
    delete payload.key;
  if (mirrors.lifecycle !== void 0)
    delete payload[mirrors.lifecycle];
  if (mirrors.semanticHash)
    delete payload.semanticHash;
  if (mirrors.discoveryHash)
    delete payload.discoveryHash;
  return CanonicalDocumentWireSchemasByKind[envelope.kind].parse({
    apiVersion: envelope.apiVersion,
    schemaVersion: envelope.schemaVersion,
    kind: envelope.kind,
    id: envelope.id,
    key: envelope.key,
    lifecycle: envelope.lifecycle,
    payload
  });
}
function unwrapObjectSchema(schema) {
  const candidate = schema;
  const unwrapped = candidate.unwrap?.() ?? candidate;
  if (!(unwrapped instanceof z5.ZodObject))
    throw new Error("canonical payload schema must resolve to an object");
  return unwrapped;
}

// node_modules/@projector/core/dist/schemas/change-proposal.js
import { z as z6 } from "zod";
var changeProposalApiVersion = "projector.change-proposal/v1";
var facets = ["behavior", "architecture", "events", "security", "realtime", "migration", "public-contract", "workspace-expansion", "persistence", "performance", "observability", "compatibility", "distribution", "cleanup", "external-surface"];
var compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var text = (maximum) => (maximum === void 0 ? z6.string().min(1) : z6.string().min(1).max(maximum)).refine((value) => !value.includes("\0") && value.trim().length > 0, "must be nonblank text without NUL bytes").transform((value) => value.normalize("NFKC").trim());
var key = text(160).refine((value) => /^[a-z0-9][a-z0-9._:-]*$/u.test(value.toLocaleLowerCase("en-US")), "must be a stable lowercase key").transform((value) => value.toLocaleLowerCase("en-US"));
var repositoryPath = z6.string().min(1).max(1024).refine((value) => {
  const normalized = value.normalize("NFKC");
  return normalized === value && !normalized.includes("\\") && !normalized.startsWith("/") && !/^[A-Za-z]:/u.test(normalized) && !normalized.endsWith("/") && !normalized.includes("//") && normalized.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}, "must be a canonical repository-relative path");
var unique = (schema, minimum = 0, maximum = 64) => z6.array(schema).min(minimum).max(maximum).superRefine((values, context) => {
  if (new Set(values.map((value) => JSON.stringify(value))).size !== values.length)
    context.addIssue({ code: "custom", message: "contains duplicates" });
});
var RevisionSchema = z6.object({
  id: text(512),
  expectedSemanticHash: z6.string().regex(/^sha256:v1:[a-f0-9]{64}$/u),
  rationale: text()
}).strict();
var RequirementProposalSchema = z6.object({ key, title: text(240), statement: text(), aliases: unique(text(512)).default([]), revision: RevisionSchema.optional() }).strict();
var ScenarioStepSchema = z6.object({ role: z6.enum(["precondition", "trigger", "expected-outcome", "forbidden-outcome"]), statement: text() }).strict();
var ScenarioStepsSchema = unique(ScenarioStepSchema, 2, 32).superRefine((steps, context) => {
  if (!steps.some(({ role }) => role === "trigger") || !steps.some(({ role }) => role === "expected-outcome" || role === "forbidden-outcome"))
    context.addIssue({ code: "custom", message: "steps must contain a trigger and an outcome" });
});
var ScenarioProposalSchema = z6.object({ key, title: text(240), aliases: unique(text(512)).default([]), steps: ScenarioStepsSchema, revision: RevisionSchema.optional() }).strict();
var DeferralSchema = z6.object({ rationale: text(), reconsiderWhen: text(), validUntil: z6.iso.datetime(), preservedOptions: unique(text(512), 1), forbiddenCommitments: unique(text(512), 1), forbiddenWritePaths: unique(repositoryPath, 1).superRefine((paths, context) => {
  if (paths.some((path) => /[*?[\]]/u.test(path)))
    context.addIssue({ code: "custom", message: "forbidden write paths must contain exact canonical paths, not globs" });
}) }).strict();
var ArchitectureProposalSchema = z6.object({ concernKey: key, title: text(240), question: text(), materiality: z6.enum(["material-soon", "deferable"]), deferral: DeferralSchema }).strict();
var ExactEditSchema = z6.object({ path: repositoryPath.refine((path) => ![".git", ".projector", ".worktrees", "node_modules"].some((root) => path === root || path.startsWith(`${root}/`)), "path is reserved and cannot be edited"), before: z6.string().max(4 * 1024 * 1024).nullable(), after: z6.string().max(4 * 1024 * 1024).nullable() }).strict().superRefine(({ before, after }, context) => {
  if (before === after)
    context.addIssue({ code: "custom", message: "edit is a no-op" });
  if ([before, after].some((value) => value?.includes("\0") === true))
    context.addIssue({ code: "custom", message: "edit content contains a NUL byte" });
});
var ValidationProposalSchema = z6.object({ independentNodeTests: unique(repositoryPath, 0), supplementalNodeTests: unique(repositoryPath).default([]) }).strict().superRefine(({ independentNodeTests, supplementalNodeTests }, context) => {
  for (const path of [...independentNodeTests, ...supplementalNodeTests])
    if (!/(?:^|\/)\S+\.test\.(?:mjs|cjs|js)$/u.test(path))
      context.addIssue({ code: "custom", message: `Node validator must be a test file: ${path}` });
  if (independentNodeTests.some((path) => supplementalNodeTests.includes(path)))
    context.addIssue({ code: "custom", message: "validator provenance groups overlap" });
});
var contentHash = z6.string().regex(/^sha256:v1:[a-f0-9]{64}$/u);
var NewIdentityBoundarySchema = z6.object({
  owns: unique(text(), 1),
  excludes: unique(text(), 1),
  nearestEntityIds: unique(text(512)),
  rationale: text()
}).strict();
var IdentityResolutionSchema = z6.object({
  contextId: text(512),
  contextHash: contentHash,
  outcome: z6.enum(["reuse-existing", "coordinated-modification", "split-existing", "merge-existing", "replace-existing", "create-new", "no-durable-entity"]),
  selectedEntityIds: unique(text(512), 0, 64),
  rationale: text(),
  newBoundary: NewIdentityBoundarySchema.optional()
}).strict().superRefine(({ outcome, selectedEntityIds, newBoundary }, context) => {
  if (["create-new", "split-existing", "replace-existing"].includes(outcome) && newBoundary === void 0) {
    context.addIssue({ code: "custom", message: `${outcome} identity resolution requires a new boundary` });
  }
  if (["reuse-existing", "coordinated-modification", "merge-existing"].includes(outcome) && selectedEntityIds.length === 0) {
    context.addIssue({ code: "custom", message: `${outcome} identity resolution requires selected entities` });
  }
});
function canonicalPayloadWithoutDerivedHashes(schema, hasDiscoveryHash = false) {
  if (!(schema instanceof z6.ZodLazy))
    throw new TypeError("canonical mutation payload schema must be lazy");
  const object = schema.unwrap();
  if (!(object instanceof z6.ZodObject))
    throw new TypeError("canonical mutation payload schema must unwrap to an object");
  const { semanticHash: _semanticHash, discoveryHash: _discoveryHash, ...shape } = object.shape;
  return z6.strictObject(hasDiscoveryHash ? shape : { ...shape, ..._discoveryHash === void 0 ? {} : { discoveryHash: _discoveryHash } });
}
var canonicalPayloadSchemas = {
  requirement: canonicalPayloadWithoutDerivedHashes(RequirementSchema, true).extend({ key, title: text(240), statement: text(), aliases: unique(text(512)) }),
  "behavioral-scenario": canonicalPayloadWithoutDerivedHashes(BehavioralScenarioSchema, true).extend({ key, title: text(240), aliases: unique(text(512)), steps: ScenarioStepsSchema }),
  concept: canonicalPayloadWithoutDerivedHashes(ConceptSchema, true).extend({ key, name: text(240), statement: text(), aliases: unique(text(512)) }),
  relation: canonicalPayloadWithoutDerivedHashes(RelationSchema),
  "architecture-decision": canonicalPayloadWithoutDerivedHashes(ArchitectureDecisionSchema).extend({ key, title: text(240), decision: text() }),
  "architecture-concern": canonicalPayloadWithoutDerivedHashes(ArchitectureConcernSchema).extend({ key, title: text(240), question: text() }),
  "developer-preference": canonicalPayloadWithoutDerivedHashes(DeveloperPreferenceSchema).extend({ key, statement: text() }),
  "projection-lens": canonicalPayloadWithoutDerivedHashes(ProjectionLensSchema).extend({
    key,
    purpose: text(),
    rules: z6.array(canonicalPayloadWithoutDerivedHashes(RuleSchema)),
    impactRules: z6.array(canonicalPayloadWithoutDerivedHashes(ImpactRuleSchema))
  }),
  "authority-record": canonicalPayloadWithoutDerivedHashes(AuthorityRecordSchema).extend({ key, rationale: text() })
};
var canonicalMutationFor = (kind, payload) => z6.discriminatedUnion("operation", [
  z6.object({ kind: z6.literal(kind), operation: z6.literal("add"), expectedAbsent: z6.literal(true), payload, rationale: text() }).strict(),
  z6.object({ kind: z6.literal(kind), operation: z6.literal("revise"), expectedSemanticHash: contentHash, expectedDocumentHash: contentHash, payload, rationale: text() }).strict()
]);
var LineageSourceSchema = z6.object({
  id: text(512),
  kind: z6.enum(["requirement", "behavioral-scenario", "concept"]),
  expectedSemanticHash: contentHash,
  expectedDocumentHash: contentHash
}).strict();
var LineageMutationSchema = z6.object({
  kind: z6.literal("lineage"),
  operation: z6.literal("add"),
  lineageKind: z6.enum(["move", "split", "merge", "replace", "delete"]),
  sources: unique(LineageSourceSchema, 1, 64),
  replacementIds: unique(text(512), 0, 64),
  rationale: text()
}).strict().superRefine(({ lineageKind, sources, replacementIds }, context) => {
  const sourceIds = new Set(sources.map(({ id }) => id));
  if (replacementIds.some((id) => sourceIds.has(id)))
    context.addIssue({ code: "custom", message: "lineage source cannot also be a replacement" });
  if (lineageKind === "move" && (sources.length !== 1 || replacementIds.length !== 1))
    context.addIssue({ code: "custom", message: "move lineage requires one source and one replacement" });
  if (lineageKind === "split" && (sources.length !== 1 || replacementIds.length < 2))
    context.addIssue({ code: "custom", message: "split lineage requires one source and at least two replacements" });
  if (lineageKind === "merge" && (sources.length < 2 || replacementIds.length !== 1))
    context.addIssue({ code: "custom", message: "merge lineage requires at least two sources and one replacement" });
  if (lineageKind === "replace" && (sources.length !== 1 || replacementIds.length < 1))
    context.addIssue({ code: "custom", message: "replace lineage requires one source and at least one replacement" });
  if (lineageKind === "delete" && replacementIds.length !== 0)
    context.addIssue({ code: "custom", message: "delete lineage cannot have replacements" });
});
var CanonicalMutationSchema = z6.discriminatedUnion("kind", [
  canonicalMutationFor("requirement", canonicalPayloadSchemas.requirement),
  canonicalMutationFor("behavioral-scenario", canonicalPayloadSchemas["behavioral-scenario"]),
  canonicalMutationFor("concept", canonicalPayloadSchemas.concept),
  canonicalMutationFor("relation", canonicalPayloadSchemas.relation),
  canonicalMutationFor("architecture-decision", canonicalPayloadSchemas["architecture-decision"]),
  canonicalMutationFor("architecture-concern", canonicalPayloadSchemas["architecture-concern"]),
  canonicalMutationFor("developer-preference", canonicalPayloadSchemas["developer-preference"]),
  canonicalMutationFor("projection-lens", canonicalPayloadSchemas["projection-lens"]),
  canonicalMutationFor("authority-record", canonicalPayloadSchemas["authority-record"]),
  LineageMutationSchema
]);
var ChangeProposalSchema = z6.object({
  apiVersion: z6.literal(changeProposalApiVersion),
  requirements: unique(RequirementProposalSchema, 0, 32).default([]),
  scenarios: unique(ScenarioProposalSchema, 0, 64).default([]),
  identityResolution: IdentityResolutionSchema.optional(),
  canonicalMutations: unique(CanonicalMutationSchema, 0, 64).optional(),
  architecture: ArchitectureProposalSchema.nullable(),
  edits: unique(ExactEditSchema, 0, 256).default([]),
  validation: ValidationProposalSchema.default({ independentNodeTests: [], supplementalNodeTests: [] }),
  analysisFacets: unique(z6.enum(facets), 2)
}).strict().superRefine((proposal, context) => {
  const assertClaims = (label, items) => {
    const claims = /* @__PURE__ */ new Set();
    for (const item of items)
      for (const claim of [item.key, ...item.aliases.map((value) => value.toLocaleLowerCase("en-US"))]) {
        if (claims.has(claim))
          context.addIssue({ code: "custom", message: `duplicate ${label} identity claim: ${claim}` });
        claims.add(claim);
      }
  };
  assertClaims("requirement", proposal.requirements);
  assertClaims("scenario", proposal.scenarios);
  const edited = proposal.edits.map(({ path }) => path);
  if (new Set(edited).size !== edited.length)
    context.addIssue({ code: "custom", message: "proposal has duplicate edit paths" });
  if (proposal.validation.independentNodeTests.some((path) => edited.includes(path)))
    context.addIssue({ code: "custom", message: "independent Node tests cannot be edited" });
  const editsByPath = new Map(proposal.edits.map((edit) => [edit.path, edit]));
  for (const path of proposal.validation.supplementalNodeTests) {
    if (editsByPath.get(path)?.after == null)
      context.addIssue({ code: "custom", path: ["validation", "supplementalNodeTests"], message: `supplemental Node test must be supplied by a nondeleted exact edit: ${path}` });
  }
  if ((proposal.architecture?.deferral.forbiddenWritePaths ?? []).some((path) => edited.includes(path)))
    context.addIssue({ code: "custom", message: "architecture deferral forbidden write paths overlap proposed edits" });
  const hasModelMutation = proposal.requirements.length > 0 || proposal.scenarios.length > 0 || (proposal.canonicalMutations?.length ?? 0) > 0;
  if (proposal.edits.length === 0 && !hasModelMutation)
    context.addIssue({ code: "custom", message: "proposal must contain a code edit or canonical semantic mutation" });
  if (proposal.edits.length > 0) {
    if (proposal.requirements.length === 0 || proposal.scenarios.length === 0)
      context.addIssue({ code: "custom", message: "code-edit proposals require at least one requirement and behavioral scenario" });
    if (proposal.validation.independentNodeTests.length === 0)
      context.addIssue({ code: "custom", message: "code-edit proposals require an independent Node test" });
  } else if (proposal.validation.independentNodeTests.length > 0 || proposal.validation.supplementalNodeTests.length > 0) {
    context.addIssue({ code: "custom", message: "canonical-only proposals cannot claim runtime validation" });
  }
  const mutationClaims = /* @__PURE__ */ new Set();
  for (const [mutationIndex, mutation] of (proposal.canonicalMutations ?? []).entries()) {
    if (mutation.kind === "lineage") {
      const claim = `lineage:${mutation.lineageKind}:${mutation.sources.map(({ id: id2 }) => id2).sort(compare).join(",")}:${mutation.replacementIds.join(",")}`;
      if (mutationClaims.has(claim))
        context.addIssue({ code: "custom", message: `duplicate canonical mutation: ${claim}` });
      mutationClaims.add(claim);
      continue;
    }
    const id = typeof mutation.payload.id === "string" ? mutation.payload.id : void 0;
    if (mutation.kind === "requirement" || mutation.kind === "behavioral-scenario")
      for (const issue of applicationEvidenceBindingIssues(mutation.payload.evidence))
        context.addIssue({ code: "custom", path: ["canonicalMutations", mutationIndex, "payload", "evidence", issue.index, "applicationPredicate", "observationRole"], message: issue.message });
    if (mutation.kind === "behavioral-scenario") {
      const derivedSemanticHash = hashSemantic("behavioral-scenario", mutation.payload);
      for (const [evidenceIndex, reference] of mutation.payload.evidence.entries())
        if (reference.applicationPredicate !== void 0 && (reference.applicationPredicate.scenario.id !== mutation.payload.id || reference.applicationPredicate.scenario.semanticHash !== derivedSemanticHash))
          context.addIssue({ code: "custom", path: ["canonicalMutations", mutationIndex, "payload", "evidence", evidenceIndex, "applicationPredicate", "scenario"], message: "scenario-owned application evidence must bind the owning scenario identity and derived semantic hash" });
    }
    if (id === void 0 || id.trim().length === 0)
      context.addIssue({ code: "custom", message: `${mutation.kind} mutation payload requires an id` });
    else {
      const claim = `${mutation.kind}:${id}`;
      if (mutationClaims.has(claim))
        context.addIssue({ code: "custom", message: `duplicate canonical mutation: ${claim}` });
      mutationClaims.add(claim);
    }
  }
  if (!proposal.analysisFacets.includes("behavior") || !proposal.analysisFacets.includes("architecture"))
    context.addIssue({ code: "custom", message: "analysis facets must include behavior and architecture" });
}).transform((proposal) => ({ ...proposal, requirements: proposal.requirements.map((item) => ({ ...item, aliases: [...item.aliases].sort(compare) })), scenarios: proposal.scenarios.map((item) => ({ ...item, aliases: [...item.aliases].sort(compare) })), ...proposal.canonicalMutations === void 0 ? {} : { canonicalMutations: [...proposal.canonicalMutations].sort((left, right) => compare(canonicalMutationSortKey(left), canonicalMutationSortKey(right))) }, edits: [...proposal.edits].sort((left, right) => compare(left.path, right.path)), validation: { independentNodeTests: [...proposal.validation.independentNodeTests].sort(compare), supplementalNodeTests: [...proposal.validation.supplementalNodeTests].sort(compare) }, analysisFacets: [...proposal.analysisFacets].sort(compare) }));
function canonicalMutationSortKey(mutation) {
  return mutation.kind === "lineage" ? `lineage:${mutation.lineageKind}:${mutation.sources.map(({ id }) => id).sort(compare).join(",")}:${mutation.replacementIds.join(",")}` : `${mutation.kind}:${String(mutation.payload.id)}`;
}
function parseChangeProposal(value) {
  return ChangeProposalSchema.parse(value);
}

// node_modules/@projector/core/dist/schemas/architecture-evaluation.js
import { z as z7 } from "zod";
var ArchitectureEvaluationRequestSchema = z7.strictObject({
  concernId: EntityIdSchema,
  options: z7.array(DecisionOptionSchema).min(1),
  preferenceIds: z7.array(EntityIdSchema).optional(),
  research: z7.strictObject({
    required: z7.boolean().optional(),
    records: z7.array(EvidenceSchema).optional(),
    maxAgeDays: z7.number().finite().nonnegative().optional()
  }).optional(),
  acceptance: z7.discriminatedUnion("kind", [
    z7.strictObject({ kind: z7.literal("automatic") }),
    z7.strictObject({ kind: z7.literal("explicit-user"), authorityRecordId: EntityIdSchema })
  ]).optional()
});
var ArchitectureEvaluationOutputSchema = z7.strictObject({
  evaluation: DecisionEvaluationSchema,
  acceptanceBlocked: z7.boolean(),
  appliedPreferences: z7.array(AppliedPreferenceRefSchema),
  preferenceConflicts: z7.array(z7.string()),
  governanceConsequences: z7.array(z7.never()),
  canonicalMutationAuthorized: z7.literal(false)
});

// node_modules/@projector/core/dist/schemas/verification.js
import { z as z8 } from "zod";
var VerificationPopulationSchema = z8.object({ directory: z8.string().min(1), recursive: z8.boolean() }).strict();
var VerificationInputSnapshotSchema = z8.object({
  files: z8.record(z8.string(), ContentHashSchema),
  populations: z8.array(z8.object({ directory: z8.string().min(1), recursive: z8.boolean(), members: z8.array(z8.string().min(1)) }).strict()),
  producerPath: z8.string().min(1),
  producerHash: ContentHashSchema,
  environmentHash: ContentHashSchema,
  platform: z8.string(),
  architecture: z8.string(),
  nodeVersion: z8.string()
}).strict();
var VerificationRequestSchema = z8.object({
  executable: z8.string().min(1),
  args: z8.array(z8.string()),
  sourcePath: z8.string().min(1).optional(),
  inputPaths: z8.array(z8.string().min(1)).min(1),
  populations: z8.array(VerificationPopulationSchema),
  environment: z8.array(z8.string().min(1)),
  timeoutMs: z8.number().int().positive().safe().nullable().default(null),
  completeInputs: z8.boolean().optional()
}).strict();
var VerificationEvidenceSchema = z8.object({
  id: z8.string().regex(/^execution_[0-9a-f-]{36}$/u),
  request: VerificationRequestSchema,
  inputs: VerificationInputSnapshotSchema,
  basisHash: ContentHashSchema,
  profile: z8.literal("native-observed/v1"),
  startedAt: z8.string(),
  completedAt: z8.string().optional(),
  status: z8.enum(["running", "passed", "failed", "interrupted", "inputs-changed"]),
  exitCode: z8.number().int().nullable().optional(),
  stdout: z8.string().optional(),
  stderr: z8.string().optional(),
  error: z8.string().optional(),
  contentHash: ContentHashSchema
}).strict();
var VerificationInspectionSchema = z8.object({ records: z8.array(VerificationEvidenceSchema), pendingPublications: z8.array(z8.object({ artifactSetId: z8.string(), state: z8.enum(["staged", "finalizing"]), recoverable: z8.boolean() }).strict()) }).strict();
var VerificationRecoverySchema = z8.object({ recoveredArtifactSetIds: z8.array(z8.string()), inspection: VerificationInspectionSchema }).strict();
var BuiltinVerificationRequestSchema = z8.strictObject({ check: z8.literal("projector.canonical-integrity/v1"), target: z8.string().min(1), timeoutMs: z8.number().int().positive().safe().nullable().optional() });
var BuiltinVerificationArtifactSchema = z8.strictObject({ path: z8.string().min(1), sha256: z8.string().regex(/^[a-f0-9]{64}$/u) });
var BuiltinVerificationEvidenceSchema = z8.strictObject({
  id: z8.string().regex(/^execution_[0-9a-f-]{36}$/u),
  profile: z8.literal("projector-closed-static/v1"),
  request: BuiltinVerificationRequestSchema,
  targetObject: z8.string(),
  targetTree: z8.string(),
  binding: StateBindingSchema,
  basisHash: ContentHashSchema,
  producer: z8.strictObject({ identity: z8.string(), buildHash: ContentHashSchema, files: z8.record(z8.string(), ContentHashSchema), production: z8.boolean() }),
  trustPolicyHash: ContentHashSchema,
  contractHash: ContentHashSchema,
  environmentHash: ContentHashSchema,
  artifacts: z8.array(BuiltinVerificationArtifactSchema),
  status: z8.enum(["running", "passed", "failed", "interrupted", "inputs-changed"]),
  startedAt: z8.string(),
  completedAt: z8.string().optional(),
  findings: z8.array(z8.string()),
  unknowns: z8.array(z8.string()),
  error: z8.string().optional(),
  contentHash: ContentHashSchema
});
var BuiltinVerificationAssessmentSchema = z8.strictObject({ eventId: z8.string(), scope: z8.literal("projector.canonical-integrity/v1"), reusable: z8.boolean(), authorization: z8.literal(false), bindingStatus: z8.enum(["current", "rebound", "stale", "suspect", "unavailable"]), contradictory: z8.boolean(), targetObject: z8.string().optional(), targetTree: z8.string().optional(), reasons: z8.array(z8.string()) });
var BuiltinVerificationInspectionSchema = z8.strictObject({ scope: z8.literal("projector.canonical-integrity/v1"), records: z8.array(BuiltinVerificationEvidenceSchema), pendingPublications: z8.array(z8.strictObject({ artifactSetId: z8.string(), state: z8.enum(["staged", "finalizing"]), recoverable: z8.boolean() })) });
var BuiltinVerificationRecoverySchema = z8.strictObject({ recoveredArtifactSetIds: z8.array(z8.string()), inspection: BuiltinVerificationInspectionSchema });
var BuiltinVerificationOperationSchema = z8.discriminatedUnion("action", [
  z8.strictObject({ action: z8.literal("execute"), request: BuiltinVerificationRequestSchema }),
  z8.strictObject({ action: z8.literal("assess"), eventId: z8.string().min(1), target: z8.string().min(1) }),
  z8.strictObject({ action: z8.literal("inspect") }),
  z8.strictObject({ action: z8.literal("recover") })
]);

// node_modules/@projector/core/dist/schemas/generated-output.js
import { z as z9 } from "zod";
var GeneratedOutputRequestSchema = z9.object({
  producerId: z9.string().min(1),
  executable: z9.string().min(1),
  sourcePath: z9.string().min(1),
  args: z9.array(z9.string()),
  inputPaths: z9.array(z9.string().min(1)),
  outputs: z9.array(z9.object({ path: z9.string().min(1), ownership: z9.enum(["retained", "disposable"]) }).strict()).min(1),
  environment: z9.array(z9.string().min(1)),
  timeoutMs: z9.number().int().positive().safe().nullable().default(null),
  completeInputs: z9.boolean().optional(),
  populations: z9.array(VerificationPopulationSchema)
}).strict();
var GeneratedOutputEvidenceSchema = z9.object({
  id: z9.string(),
  request: GeneratedOutputRequestSchema,
  check: VerificationEvidenceSchema,
  before: z9.record(z9.string(), ContentHashSchema),
  after: z9.record(z9.string(), ContentHashSchema),
  afterObservation: z9.enum(["immediate", "recovery"]),
  contentHash: ContentHashSchema
}).strict();
var GeneratedOutputInspectionSchema = z9.object({
  records: z9.array(z9.object({ evidence: GeneratedOutputEvidenceSchema, current: z9.boolean(), reason: z9.string(), outputs: z9.array(z9.object({ path: z9.string(), ownership: z9.enum(["retained", "disposable"]), observation: z9.enum(["missing", "unchanged-after-invocation", "changed-after-invocation"]), disposition: z9.enum(["current", "preserve-and-review", "regenerate", "removal-eligible"]) }).strict()) }).strict()),
  pendingPublications: z9.array(z9.object({ artifactSetId: z9.string(), state: z9.enum(["staged", "finalizing"]), recoverable: z9.boolean() }).strict())
}).strict();
var GeneratedOutputRecoverySchema = z9.object({ recoveredArtifactSetIds: z9.array(z9.string()), inspection: GeneratedOutputInspectionSchema }).strict();

// node_modules/@projector/core/dist/schemas/git-integration.js
import { z as z10 } from "zod";
var ref = z10.string().min(1);
var objectId = z10.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
var GitIntegrationRequestSchema = z10.strictObject({ target: ref, incoming: ref, base: ref.optional(), result: ref.optional() });
var contribution = z10.strictObject({ side: z10.enum(["target", "incoming"]), change: z10.enum(["added", "modified", "removed"]), status: z10.enum(["preserved", "altered", "lost"]) });
var population = z10.strictObject({ dependencyPath: z10.string(), targetConsumers: z10.array(z10.string()), incomingConsumers: z10.array(z10.string()), resultConsumers: z10.array(z10.string()), newlyRelevantConsumers: z10.array(z10.string()), removedConsumers: z10.array(z10.string()), fingerprint: z10.string() });
var obligations = z10.strictObject({ lensId: z10.string(), targetMembers: z10.array(z10.string()), incomingMembers: z10.array(z10.string()), resultMembers: z10.array(z10.string()), newlyApplicableUnitIds: z10.array(z10.string()), resultObligations: z10.array(z10.strictObject({ unitId: z10.string(), applicabilityFingerprint: z10.string(), validatorIds: z10.array(z10.string()), ruleIds: z10.array(z10.string()) })) });
var GitResultReconciliationSchema = z10.strictObject({
  status: z10.enum(["assessed", "incomplete", "failed", "not-assessed"]),
  scope: z10.literal("immutable-result-static-consumers-and-obligations"),
  consumerQueries: z10.array(population),
  lensPopulations: z10.array(obligations),
  topologyQueries: z10.array(z10.strictObject({ subjectId: z10.string(), subjectKind: z10.enum(["event", "contract"]), targetConsumers: z10.array(z10.string()), incomingConsumers: z10.array(z10.string()), resultConsumers: z10.array(z10.string()), newlyRelevantConsumers: z10.array(z10.string()), observability: z10.string(), fingerprint: z10.string() })),
  semanticChanges: z10.array(z10.strictObject({ path: z10.string(), targetHash: z10.string().optional(), incomingHash: z10.string().optional(), resultHash: z10.string().optional() })),
  contradictions: z10.array(z10.string()),
  unknowns: z10.array(z10.string()),
  behavior: z10.strictObject({ status: z10.literal("not-assessed"), reusable: z10.literal(false) })
});
var GitIntegrationAssessmentSchema = z10.strictObject({
  baseCommit: objectId,
  targetCommit: objectId,
  incomingCommit: objectId,
  resultTree: objectId,
  resultCommit: objectId.optional(),
  baseSelection: z10.enum(["inferred", "explicit"]),
  resultSource: z10.enum(["calculated-merge", "supplied"]),
  status: z10.enum(["review-required", "conflicted", "invalid"]),
  conflictPaths: z10.array(z10.string()),
  changedCodePaths: z10.strictObject({ target: z10.array(z10.string()), incoming: z10.array(z10.string()) }),
  codeContributions: z10.array(contribution.extend({ path: z10.string() })),
  contributions: z10.array(contribution.extend({ entityId: z10.string(), kind: z10.string(), baseSemanticHash: z10.string().optional(), branchSemanticHash: z10.string().optional(), resultSemanticHash: z10.string().optional(), baseAuthoredHash: z10.string().optional(), branchAuthoredHash: z10.string().optional(), resultAuthoredHash: z10.string().optional(), documentDrift: z10.boolean() })),
  semanticOverlapIds: z10.array(z10.string()),
  resultOnlyPaths: z10.array(z10.string()),
  canonicalValidation: z10.strictObject({ scope: z10.literal("canonical-record-integrity"), status: z10.enum(["passed", "failed", "not-assessed"]), issues: z10.array(z10.string()) }),
  staticGovernanceValidation: z10.strictObject({ status: z10.enum(["passed", "failed", "incomplete", "not-assessed"]), checks: z10.array(z10.string()), issues: z10.array(z10.string()) }),
  resultReconciliation: GitResultReconciliationSchema,
  assessedAt: z10.iso.datetime(),
  requiresReview: z10.literal(true),
  verificationGaps: z10.array(z10.string())
});

// node_modules/@projector/core/dist/code-workflows.js
import { z as z11 } from "zod";
var CodeRepositoryPathSchema = z11.string().min(1).max(4096).refine((path) => !path.includes("\\") && !path.startsWith("/") && !/^[A-Za-z]:/u.test(path) && !path.includes("\0") && path.split("/").every((part) => part !== "" && part !== "." && part !== ".."), "Expected a canonical repository-relative path");
var generation = z11.string().min(1).max(256);
var inputHashes = z11.record(CodeRepositoryPathSchema, z11.string().min(1).max(256));
var CodeProducerSchema = z11.strictObject({
  executable: z11.string().min(1).max(4096),
  args: z11.array(z11.string().max(8192)).max(256),
  cwd: CodeRepositoryPathSchema.optional(),
  artifact: CodeRepositoryPathSchema,
  format: z11.enum(["scip", "semanticdb"]),
  environment: z11.record(z11.string().min(1).max(256), z11.string().max(8192)).optional()
});
var CodeIndexRequestSchema = z11.strictObject({
  provider: z11.enum(["native", "syntax", "scip", "semanticdb", "external"]).default("native"),
  project: CodeRepositoryPathSchema.optional(),
  buildVariant: z11.string().min(1).max(512).default("default"),
  artifact: CodeRepositoryPathSchema.optional(),
  sourceHashes: inputHashes.optional(),
  producer: CodeProducerSchema.optional(),
  timeoutMs: z11.number().int().min(1e3).safe().nullable().default(null)
}).superRefine((request, ctx) => {
  if (["scip", "semanticdb"].includes(request.provider) && request.artifact === void 0)
    ctx.addIssue({
      code: "custom",
      message: "An artifact is required for imported semantic evidence"
    });
  if (request.provider === "external" && request.producer === void 0)
    ctx.addIssue({
      code: "custom",
      message: "An explicit producer command is required"
    });
  if (request.provider !== "external" && request.producer !== void 0)
    ctx.addIssue({
      code: "custom",
      message: "Only external indexing accepts a producer command"
    });
});
var CodeQueryRequestSchema = z11.strictObject({
  kind: z11.enum([
    "symbols",
    "definition",
    "references",
    "callers",
    "callees",
    "implementations",
    "types",
    "imports",
    "neighborhood"
  ]),
  symbolId: z11.string().min(1).max(2048).optional(),
  path: CodeRepositoryPathSchema.optional(),
  name: z11.string().min(1).max(512).optional(),
  offset: z11.number().int().nonnegative().optional(),
  generation: generation.optional(),
  freshness: z11.enum(["current", "pinned"]).default("current"),
  project: CodeRepositoryPathSchema.optional(),
  limit: z11.number().int().min(1).max(1e3).default(100),
  cursor: z11.string().max(16384).optional()
}).superRefine((request, ctx) => {
  if (request.symbolId === void 0 && request.path === void 0 && request.name === void 0)
    ctx.addIssue({
      code: "custom",
      message: "Select a symbol, path, or name"
    });
  if (request.freshness === "pinned" && request.generation === void 0)
    ctx.addIssue({
      code: "custom",
      message: "Pinned queries require a generation"
    });
  if (request.offset !== void 0 && request.path === void 0)
    ctx.addIssue({
      code: "custom",
      message: "An offset requires a source path"
    });
});
var CodeQueryEvidenceSchema = z11.strictObject({
  query: CodeQueryResultSchema,
  freshness: z11.enum(["current", "historical", "unbound"]),
  dependencyKeys: z11.array(z11.string()),
  resultHash: z11.string(),
  unknowns: z11.array(z11.string())
});
var CodeIndexRunSchema = z11.strictObject({
  id: z11.string().min(1),
  repositoryRoot: z11.string().min(1),
  provider: z11.string().min(1),
  state: z11.enum(["running", "published", "failed", "cancelled", "interrupted"]),
  startedAt: z11.string(),
  finishedAt: z11.string().optional(),
  generation: generation.optional(),
  ownerPid: z11.number().int().positive(),
  error: z11.string().optional()
});
var CodeIndexStatusRequestSchema = z11.strictObject({
  runId: z11.string().min(1).max(256).optional()
});
var CodeIndexWaitRequestSchema = z11.strictObject({
  runId: z11.string().min(1).max(256),
  timeoutMs: z11.number().int().min(0).max(3e4).default(2e4)
});
var CodeIndexCancelRequestSchema = z11.strictObject({
  runId: z11.string().min(1).max(256)
});
var CodeIndexStatusSchema = z11.strictObject({
  head: generation.nullable(),
  runs: z11.array(CodeIndexRunSchema),
  runsTruncated: z11.boolean(),
  providers: z11.array(z11.strictObject({
    id: z11.string(),
    languages: z11.array(z11.string()),
    status: z11.enum(["available", "configured", "requires-toolchain"]),
    detail: z11.string()
  }))
});
var CodeImpactRequestSchema = z11.strictObject({
  before: generation,
  after: generation.optional(),
  paths: z11.array(CodeRepositoryPathSchema).max(1e3).optional(),
  maxNodes: z11.number().int().min(1).max(1e4).default(2e3)
});
var CodeImpactResultSchema = z11.strictObject({
  before: generation,
  after: generation,
  changedSymbols: z11.array(z11.string()),
  affectedSymbols: z11.array(z11.string()),
  affectedPaths: z11.array(z11.string()),
  possiblePaths: z11.array(z11.string()),
  unknowns: z11.array(z11.string()),
  truncated: z11.boolean()
});
var CodeRuntimeEvidenceSchema = z11.strictObject({
  id: z11.string().min(1),
  generation,
  sourceHashes: inputHashes,
  testId: z11.string().min(1),
  runId: z11.string().min(1),
  runner: z11.string().min(1),
  buildId: z11.string().min(1),
  workload: z11.string().min(1),
  attribution: z11.enum(["per-test", "isolated_replay", "aggregate"]),
  outcome: z11.enum(["passed", "failed", "unknown"]),
  durationMs: z11.number().nonnegative().optional(),
  ranges: z11.array(z11.strictObject({
    path: CodeRepositoryPathSchema,
    startLine: z11.number().int().positive(),
    endLine: z11.number().int().positive()
  }))
});
var CodeBridgeSchema = z11.strictObject({
  id: z11.string().min(1),
  protocol: z11.string().min(1),
  identity: z11.string().min(1),
  fromSymbolId: z11.string().min(1),
  toSymbolId: z11.string().min(1),
  sourcePaths: z11.array(CodeRepositoryPathSchema).min(1),
  explanation: z11.string().min(1)
});
var CodeEvidenceRequestSchema = z11.strictObject({
  format: z11.enum(["projector", "coverage-py", "istanbul", "v8", "bridges"]),
  artifact: CodeRepositoryPathSchema.optional(),
  evidence: CodeRuntimeEvidenceSchema.optional(),
  bridges: z11.array(CodeBridgeSchema).optional(),
  generation: generation.optional(),
  sourceHashes: inputHashes.optional()
});
var CodeEvidenceResultSchema = z11.strictObject({
  accepted: z11.array(z11.string()),
  unknowns: z11.array(z11.string())
});
var CodeTestsRequestSchema = z11.strictObject({
  generation: generation.optional(),
  paths: z11.array(CodeRepositoryPathSchema).min(1).max(1e3),
  limit: z11.number().int().min(1).max(1e3).default(100),
  cursor: z11.string().min(1).max(4096).optional()
});
var CodeTestsResultSchema = z11.strictObject({
  generation,
  recommendations: z11.array(z11.strictObject({
    testId: z11.string(),
    reasons: z11.array(z11.string()),
    evidenceIds: z11.array(z11.string()),
    observed: z11.boolean(),
    durationMs: z11.number().nonnegative().optional()
  })),
  unknowns: z11.array(z11.string()),
  complete: z11.boolean(),
  nextCursor: z11.string().optional(),
  pageSemantics: z11.literal("merge-recommendations-by-test-id"),
  requiredVerificationUnaffected: z11.literal(true)
});
var CodeTestRunRequestSchema = z11.strictObject({
  testFile: CodeRepositoryPathSchema,
  testName: z11.string().min(1).max(2048),
  command: z11.strictObject({
    executable: z11.string().min(1).max(4096),
    args: z11.array(z11.string().max(8192)).max(256).default([]),
    environment: z11.record(z11.string().min(1).max(256), z11.string().max(8192)).optional()
  }).optional(),
  timeoutMs: z11.number().int().min(1e3).safe().nullable().default(null)
});
var CodeTestRunResultSchema = z11.strictObject({
  runId: z11.string().min(1),
  generation,
  testId: z11.string().min(1),
  outcome: z11.enum(["passed", "failed"]),
  durationMs: z11.number().nonnegative(),
  evidenceIds: z11.array(z11.string()),
  sourceHashes: inputHashes,
  buildId: z11.string().min(1),
  workload: z11.string().min(1),
  command: z11.strictObject({
    executable: z11.string(),
    args: z11.array(z11.string())
  }),
  unknowns: z11.array(z11.string()),
  requiredVerificationUnaffected: z11.literal(true)
});
var CodeExportRequestSchema = z11.strictObject({
  generation: generation.optional(),
  format: z11.enum(["jsonl", "graphml", "nodes-csv", "edges-csv"]),
  artifactName: z11.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/u).optional(),
  maxBytes: z11.number().int().min(1024).max(16 * 1024 * 1024).default(1024 * 1024)
});
var CodeExportResultSchema = z11.strictObject({
  generation,
  format: z11.string(),
  content: z11.string().optional(),
  artifact: z11.strictObject({ path: z11.string().min(1), bytes: z11.number().int().nonnegative(), sha256: z11.string().min(1) }).optional(),
  mediaType: z11.string(),
  symbols: z11.number().int().nonnegative(),
  edges: z11.number().int().nonnegative()
});
var CodeContextSummarySchema = z11.strictObject({
  generation,
  worktreeDigest: z11.string(),
  symbols: z11.array(CodeSymbolSchema),
  edges: z11.array(CodeEdgeSchema),
  relatedPaths: z11.array(z11.string()),
  coverage: z11.array(CodeCoverageSchema),
  unknowns: z11.array(z11.string())
});

// node_modules/@projector/core/dist/schemas/operations.js
import { z as z12 } from "zod";
var projectorOperationApiVersion = "projector.operation/v1";
var projectorOperationResultApiVersion = "projector.operation-result/v1";
var ProjectorOperationSchema = z12.enum([
  "status",
  "init",
  "context",
  "context.inspect",
  "reconcile",
  "repository.check",
  "repository.integration",
  "operation-access.recover",
  "change.capture",
  "change.plan",
  "change.approve",
  "change.apply",
  "change.recover",
  "coverage",
  "complete",
  "cleanup",
  "verify",
  "representation.inspect",
  "representation.reconcile",
  "representation.recover",
  "representation.pending",
  "architecture.evaluate",
  "verification.execute",
  "verification.builtin",
  "verification.inspect",
  "verification.recover",
  "generated.execute",
  "generated.inspect",
  "generated.recover",
  "application.observe",
  "code.query",
  "code.index",
  "code.index-status",
  "code.index-wait",
  "code.index-cancel",
  "code.impact",
  "code.tests",
  "code.test-run",
  "code.evidence",
  "code.export"
]);
var requestBase = {
  apiVersion: z12.literal(projectorOperationApiVersion),
  repositoryRoot: z12.string().min(1),
  requestId: z12.string().min(1).optional(),
  observationLimits: ObservationLimitsOverrideSchema.optional()
};
function createProjectorOperationRequestSchema(operation, inputSchema) {
  return z12.strictObject({ ...requestBase, operation: z12.literal(operation), input: inputSchema.strict() });
}
var boundedInspectionInput = {
  scope: z12.string().min(1).optional(),
  budgetTokens: z12.number().int().nonnegative().optional(),
  budgetCost: z12.number().nonnegative().optional(),
  questionOffset: z12.number().int().nonnegative().optional()
};
var knowledgePolicy = z12.strictObject({
  maxCandidates: z12.number().int().positive().max(1e4).optional(),
  maxEntries: z12.number().int().positive().max(1e4).optional(),
  maxDepth: z12.number().int().nonnegative().max(1e3).optional(),
  maxTraversalCost: z12.number().int().positive().max(1e7).optional(),
  minimumScore: z12.number().min(0).max(1).optional(),
  maxContextCost: z12.number().int().positive().max(1e7).optional()
});
var ProjectorOperationInputSchemas = Object.freeze({
  "code.query": CodeQueryRequestSchema,
  "code.index": CodeIndexRequestSchema,
  "code.index-status": CodeIndexStatusRequestSchema,
  "code.index-wait": CodeIndexWaitRequestSchema,
  "code.index-cancel": CodeIndexCancelRequestSchema,
  "code.impact": CodeImpactRequestSchema,
  "code.tests": CodeTestsRequestSchema,
  "code.test-run": CodeTestRunRequestSchema,
  "code.evidence": CodeEvidenceRequestSchema,
  "code.export": CodeExportRequestSchema,
  status: z12.strictObject({}),
  init: z12.strictObject({}),
  context: z12.strictObject({
    view: z12.enum(["agent", "full"]).optional(),
    request: z12.string().min(1).max(4096),
    entities: z12.array(z12.string().min(1).max(512)).max(64).optional(),
    namedTargets: z12.array(z12.string().min(1).max(1024)).max(64).optional(),
    operation: z12.string().min(1).max(160).optional(),
    persist: z12.boolean().optional(),
    policy: knowledgePolicy.optional()
  }),
  "context.inspect": z12.strictObject({
    contextId: z12.string().min(1),
    cursor: z12.string().min(1).max(4096).optional(),
    limit: z12.number().int().positive().max(100).optional(),
    view: z12.literal("full").optional()
  }),
  reconcile: z12.strictObject({ contextId: z12.string().min(1), view: z12.enum(["agent", "full"]).optional() }),
  "repository.check": z12.strictObject({
    mode: z12.enum(["full", "commit-only"]).optional(),
    sessionId: z12.string().min(1).max(512).optional(),
    handled: z12.strictObject({ findingId: z12.string().min(1).max(128), evidenceIdentity: ContentHashSchema }).optional()
  }),
  "repository.integration": GitIntegrationRequestSchema,
  "operation-access.recover": z12.strictObject({}),
  "change.capture": z12.strictObject({ request: z12.string().min(1), proposal: ChangeProposalSchema, contextId: z12.string().min(1).optional() }),
  "change.plan": z12.strictObject({ changeSelector: z12.string().min(1) }),
  "change.approve": z12.strictObject({ changeSelector: z12.string().min(1), planHash: ContentHashSchema }),
  "change.apply": z12.strictObject({ approvalSelector: z12.string().min(1) }),
  "change.recover": z12.strictObject({ approvalSelector: z12.string().min(1) }),
  coverage: z12.strictObject(boundedInspectionInput),
  complete: z12.strictObject(boundedInspectionInput),
  cleanup: z12.strictObject({
    ...boundedInspectionInput,
    contextId: z12.string().min(1).optional(),
    changeSelector: z12.string().min(1).optional(),
    approvalSelector: z12.string().min(1).optional(),
    evidenceOffset: z12.number().int().nonnegative().optional(),
    evidenceLimit: z12.number().int().positive().max(50).optional(),
    evidenceIdentity: ContentHashSchema.optional()
  }),
  verify: z12.strictObject({}),
  "representation.inspect": z12.strictObject({
    changeSelector: z12.string().min(1),
    capsuleId: z12.string().min(1).optional(),
    approvalSelector: z12.string().min(1).optional(),
    view: z12.enum(["summary", "content"])
  }),
  "representation.reconcile": z12.strictObject({
    changeSelector: z12.string().min(1),
    approvalSelector: z12.string().min(1).optional()
  }),
  "representation.recover": z12.strictObject({}),
  "representation.pending": z12.strictObject({}),
  "architecture.evaluate": ArchitectureEvaluationRequestSchema,
  "verification.execute": VerificationRequestSchema,
  "verification.builtin": z12.strictObject({ command: BuiltinVerificationOperationSchema }),
  "verification.inspect": z12.strictObject({ eventIds: z12.array(z12.string().min(1)).optional() }),
  "verification.recover": z12.strictObject({}),
  "generated.execute": z12.strictObject({ generation: GeneratedOutputRequestSchema }),
  "generated.inspect": z12.strictObject({ activeProducerIds: z12.array(z12.string().min(1)) }),
  "generated.recover": z12.strictObject({ activeProducerIds: z12.array(z12.string().min(1)) })
});
var ProjectorOperationRequestSchema = z12.discriminatedUnion("operation", [
  createProjectorOperationRequestSchema("code.query", ProjectorOperationInputSchemas["code.query"]),
  createProjectorOperationRequestSchema("code.index", ProjectorOperationInputSchemas["code.index"]),
  createProjectorOperationRequestSchema("code.index-status", ProjectorOperationInputSchemas["code.index-status"]),
  createProjectorOperationRequestSchema("code.index-wait", ProjectorOperationInputSchemas["code.index-wait"]),
  createProjectorOperationRequestSchema("code.index-cancel", ProjectorOperationInputSchemas["code.index-cancel"]),
  createProjectorOperationRequestSchema("code.impact", ProjectorOperationInputSchemas["code.impact"]),
  createProjectorOperationRequestSchema("code.tests", ProjectorOperationInputSchemas["code.tests"]),
  createProjectorOperationRequestSchema("code.test-run", ProjectorOperationInputSchemas["code.test-run"]),
  createProjectorOperationRequestSchema("code.evidence", ProjectorOperationInputSchemas["code.evidence"]),
  createProjectorOperationRequestSchema("code.export", ProjectorOperationInputSchemas["code.export"]),
  createProjectorOperationRequestSchema("status", ProjectorOperationInputSchemas.status),
  createProjectorOperationRequestSchema("init", ProjectorOperationInputSchemas.init),
  createProjectorOperationRequestSchema("context", ProjectorOperationInputSchemas.context),
  createProjectorOperationRequestSchema("context.inspect", ProjectorOperationInputSchemas["context.inspect"]),
  createProjectorOperationRequestSchema("reconcile", ProjectorOperationInputSchemas.reconcile),
  createProjectorOperationRequestSchema("repository.check", ProjectorOperationInputSchemas["repository.check"]),
  createProjectorOperationRequestSchema("repository.integration", ProjectorOperationInputSchemas["repository.integration"]),
  createProjectorOperationRequestSchema("operation-access.recover", ProjectorOperationInputSchemas["operation-access.recover"]),
  createProjectorOperationRequestSchema("change.capture", ProjectorOperationInputSchemas["change.capture"]),
  createProjectorOperationRequestSchema("change.plan", ProjectorOperationInputSchemas["change.plan"]),
  createProjectorOperationRequestSchema("change.approve", ProjectorOperationInputSchemas["change.approve"]),
  createProjectorOperationRequestSchema("change.apply", ProjectorOperationInputSchemas["change.apply"]),
  createProjectorOperationRequestSchema("change.recover", ProjectorOperationInputSchemas["change.recover"]),
  createProjectorOperationRequestSchema("coverage", ProjectorOperationInputSchemas.coverage),
  createProjectorOperationRequestSchema("complete", ProjectorOperationInputSchemas.complete),
  createProjectorOperationRequestSchema("cleanup", ProjectorOperationInputSchemas.cleanup),
  createProjectorOperationRequestSchema("verify", ProjectorOperationInputSchemas.verify),
  createProjectorOperationRequestSchema("representation.inspect", ProjectorOperationInputSchemas["representation.inspect"]),
  createProjectorOperationRequestSchema("representation.reconcile", ProjectorOperationInputSchemas["representation.reconcile"]),
  createProjectorOperationRequestSchema("representation.recover", ProjectorOperationInputSchemas["representation.recover"]),
  createProjectorOperationRequestSchema("representation.pending", ProjectorOperationInputSchemas["representation.pending"]),
  createProjectorOperationRequestSchema("architecture.evaluate", ProjectorOperationInputSchemas["architecture.evaluate"]),
  createProjectorOperationRequestSchema("verification.execute", ProjectorOperationInputSchemas["verification.execute"]),
  createProjectorOperationRequestSchema("verification.builtin", ProjectorOperationInputSchemas["verification.builtin"]),
  createProjectorOperationRequestSchema("verification.inspect", ProjectorOperationInputSchemas["verification.inspect"]),
  createProjectorOperationRequestSchema("verification.recover", ProjectorOperationInputSchemas["verification.recover"]),
  createProjectorOperationRequestSchema("generated.execute", ProjectorOperationInputSchemas["generated.execute"]),
  createProjectorOperationRequestSchema("generated.inspect", ProjectorOperationInputSchemas["generated.inspect"]),
  createProjectorOperationRequestSchema("generated.recover", ProjectorOperationInputSchemas["generated.recover"])
]);
var PackageVersionSchema = z12.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u, "must be a numeric semantic version");
var PackageIdentitySchema = z12.strictObject({
  name: z12.string().min(1),
  version: PackageVersionSchema
});
var ProjectReadinessStatusSchema = z12.enum([
  "ready",
  "inactive",
  "upgrade-required",
  "recovery-required",
  "busy",
  "unavailable"
]);
var ProjectReadinessSchema = z12.strictObject({
  status: ProjectReadinessStatusSchema,
  package: PackageIdentitySchema,
  observed: z12.strictObject({
    configApiVersion: z12.string().min(1),
    preparedProjectorVersion: PackageVersionSchema.optional()
  }).optional(),
  reason: z12.string().min(1).optional(),
  recovery: z12.strictObject({
    code: z12.string().min(1),
    location: z12.string().min(1).optional(),
    action: z12.string().min(1)
  }).optional()
});
var ProjectorOperationErrorSchema = z12.strictObject({
  code: z12.string().min(1),
  message: z12.string().min(1),
  retriable: z12.boolean(),
  observation: z12.strictObject({
    stage: z12.string().min(1),
    scope: z12.string().min(1),
    limit: ObservationLimitsSchema.keyof().optional(),
    observed: z12.number().nonnegative().optional()
  }).optional()
});
var ProjectorOperationActionSchema = z12.strictObject({
  kind: z12.enum(["approval-required", "recovery-required", "retry", "activate", "upgrade"]),
  operation: ProjectorOperationSchema,
  selector: z12.string().min(1).optional(),
  reason: z12.string().min(1)
});
function createProjectorOperationResultSchema(operation, outputSchema) {
  const base = {
    apiVersion: z12.literal(projectorOperationResultApiVersion),
    operation: z12.literal(operation),
    package: PackageIdentitySchema,
    requestId: z12.string().min(1).optional(),
    exitCode: z12.number().int(),
    readiness: ProjectReadinessSchema
  };
  const unsuccessful = {
    ...base,
    error: ProjectorOperationErrorSchema,
    action: ProjectorOperationActionSchema.optional(),
    output: outputSchema.optional()
  };
  return z12.discriminatedUnion("status", [
    z12.strictObject({ ...base, status: z12.literal("succeeded"), output: outputSchema }),
    z12.strictObject({ ...unsuccessful, status: z12.literal("failed") }),
    z12.strictObject({ ...unsuccessful, status: z12.literal("unavailable") }),
    z12.strictObject({ ...unsuccessful, status: z12.literal("cancelled") })
  ]);
}

// node_modules/@projector/core/dist/schemas/project-config.js
import { z as z13 } from "zod";
var projectorConfigApiVersion = "projector.config/v3";
var PreparedProjectorConfigSchema = z13.object({
  apiVersion: z13.literal(projectorConfigApiVersion),
  enabled: z13.literal(true),
  projectorVersion: PackageVersionSchema
}).strict();
var ProjectorConfigSchema = PreparedProjectorConfigSchema;
function parseProjectorConfig(value) {
  return ProjectorConfigSchema.parse(value);
}
function parsePreparedProjectorConfig(value) {
  return PreparedProjectorConfigSchema.parse(value);
}

// node_modules/@projector/core/dist/schemas/representation-artifact.js
import { z as z14 } from "zod";
var durableRepresentationArtifactApiVersion = "projector.representation-artifact/v1";
var DurableRepresentationArtifactRecordBodySchema = z14.strictObject({
  apiVersion: z14.literal(durableRepresentationArtifactApiVersion),
  projection: RepresentationProjectionSchema
});
function hashDurableRepresentationArtifactRecord(input) {
  return hashFramedDomain("durable-representation-artifact", DurableRepresentationArtifactRecordBodySchema.parse(input));
}
var DurableRepresentationArtifactRecordSchema = z14.strictObject({
  apiVersion: z14.literal(durableRepresentationArtifactApiVersion),
  projection: RepresentationProjectionSchema,
  recordHash: ContentHashSchema
}).superRefine(({ recordHash, ...body }, context) => {
  if (recordHash !== hashDurableRepresentationArtifactRecord(body)) {
    context.addIssue({ code: "custom", path: ["recordHash"], message: "representation artifact record hash is invalid" });
  }
});
function createDurableRepresentationArtifactRecord(projection) {
  const body = DurableRepresentationArtifactRecordBodySchema.parse({
    apiVersion: durableRepresentationArtifactApiVersion,
    projection
  });
  return DurableRepresentationArtifactRecordSchema.parse({
    ...body,
    recordHash: hashDurableRepresentationArtifactRecord(body)
  });
}

// node_modules/@projector/core/dist/schemas/registry.js
import { z as z15 } from "zod";
var normativeContractNames = [
  "AdapterContext",
  "AnalysisFacet",
  "AnalyzerCapabilities",
  "AnalyzerFailure",
  "AppliedPreferenceRef",
  "ArchitectureConcern",
  "ArchitectureDecision",
  "Artifact",
  "ArtifactFingerprint",
  "AuthorityAlternative",
  "AuthorityClass",
  "AuthorityReconsiderTrigger",
  "AuthorityRecord",
  "AuthorityVector",
  "BehavioralScenario",
  "BehavioralScenarioDelta",
  "BehavioralScenarioStep",
  "CausalOrigin",
  "ChangeCertificate",
  "ChangeIntentAnalysis",
  "ChangeOperation",
  "ChangeProposal",
  "CanonicalDocumentEnvelope",
  "CanonicalDocumentEnvelopeByKind",
  "CanonicalDocumentWireByKind",
  "CommandSpec",
  "CompletionContract",
  "Concept",
  "ConcernActivationReason",
  "ConcernMateriality",
  "Confidence",
  "ContentHash",
  "ContextPrecedent",
  "ControlPolicy",
  "CoverageLane",
  "CoverageSnapshot",
  "DecisionConsequence",
  "DecisionDeferral",
  "DecisionEvaluation",
  "DecisionOption",
  "DecisionValidityAssessment",
  "DerivationInput",
  "DerivationRecord",
  "DeveloperPreference",
  "DurableRepresentationArtifactRecord",
  "Divergence",
  "EffectiveRuleBundle",
  "EntityId",
  "EnumerationContract",
  "Evidence",
  "EvidenceClaim",
  "EvidenceKind",
  "EvidenceRef",
  "ApplicationEvidencePredicateBinding",
  "EvidenceRefreshPolicy",
  "ExecutionCapsule",
  "ExecutionPlan",
  "ExecutionPolicy",
  "GovernanceBasis",
  "GovernanceException",
  "GitRealizationLocator",
  "GraphReader",
  "IgnorePolicy",
  "ImpactClosureRef",
  "ImpactRule",
  "IntentOriginRef",
  "IntentStatement",
  "InvalidationCause",
  "InvalidationEvent",
  "InvalidationResult",
  "LensContributionRole",
  "LensExample",
  "LensRef",
  "LineageRecord",
  "MigrationBinding",
  "MigrationOverlay",
  "ModelProvider",
  "NewSemanticBoundary",
  "NormalizedPredicate",
  "ObservabilityClass",
  "OperationEvidence",
  "PatternCandidate",
  "PlanCheckpoint",
  "PlanningSurprise",
  "PortableRelativePath",
  "PreservationDimension",
  "ProjectionExpectation",
  "ProjectionLens",
  "ProjectionSpec",
  "ProjectionUnit",
  "PreparedProjectorConfig",
  "RecognizerBinding",
  "Relation",
  "RelationType",
  "RelevanceBand",
  "RelevanceClosure",
  "RelevanceEntry",
  "RelevanceReason",
  "RelevanceSeed",
  "RealizationBinding",
  "RealizationOriginRef",
  "RealizationSelectorExpr",
  "RepairCapabilities",
  "RepairStrategy",
  "RepresentationProjection",
  "RepresentationProjectionRef",
  "RepresentationStyleRule",
  "RepresentationTarget",
  "RepresentationTokenAccounting",
  "Requirement",
  "RequirementDelta",
  "RiskAssessment",
  "RiskClass",
  "RollbackSpec",
  "Rule",
  "RuleConflict",
  "RuleEffect",
  "ScopeGrant",
  "SelectorExpr",
  "SemanticAnchor",
  "SemanticChange",
  "SemanticIdentityCandidate",
  "SemanticIdentityResolution",
  "SemanticOperation",
  "SemanticPreservationFingerprint",
  "SemanticRepresentationProfile",
  "SemanticSignature",
  "SourceClass",
  "StateBinding",
  "StateBindingValidation",
  "StateBindingValidator",
  "StateDigest",
  "StateQueryDependency",
  "StateQueryKind",
  "StateQueryReader",
  "StateQueryResultFingerprint",
  "StateQuerySpec",
  "StateValueDependencyKind",
  "StateValueDependencyRef",
  "StructuredModelRequest",
  "StructuredModelResponse",
  "Surface",
  "SurfaceAdapter",
  "SurfaceApplyResult",
  "SurfaceCapabilities",
  "SurfaceChange",
  "SurfacePlan",
  "TokenCounter",
  "Tombstone",
  "TransactionJournalEntry",
  "TransactionPhase",
  "TransactionReceipt",
  "Transform",
  "TransformBinding",
  "TransformContext",
  "TransformPreview",
  "TransformResult",
  "ValidationResult",
  "ValidatorBinding",
  "ValidityState",
  "WorkPacket"
];
var runtimeOnly = /* @__PURE__ */ new Set([
  "AdapterContext",
  "GraphReader",
  "ModelProvider",
  "StateBindingValidator",
  "StateQueryReader",
  "SurfaceAdapter",
  "TokenCounter",
  "Transform",
  "TransformContext"
]);
var hashProfileKinds = {
  ArchitectureDecision: "architecture-decision",
  AuthorityRecord: "authority-record",
  BehavioralScenario: "behavioral-scenario",
  Concept: "concept",
  GovernanceException: "exception",
  LineageRecord: "lineage",
  MigrationOverlay: "migration",
  ProjectionLens: "projection-lens",
  Relation: "relation",
  Requirement: "requirement",
  Rule: "rule",
  SemanticRepresentationProfile: "semantic-representation-profile",
  Tombstone: "tombstone",
  TransactionReceipt: "transaction-receipt"
};
var schemaExports = {
  EntityIdSchema,
  ConfidenceSchema,
  ContentHashSchema,
  GitRealizationLocatorSchema,
  SourceClassSchema,
  ...generated_contracts_exports,
  ChangeProposalSchema,
  CanonicalDocumentEnvelopeSchema,
  CanonicalDocumentEnvelopeByKindSchema,
  CanonicalDocumentWireByKindSchema,
  PreparedProjectorConfigSchema,
  PortableRelativePathSchema,
  DurableRepresentationArtifactRecordSchema
};
var contractRegistry = Object.freeze(Object.fromEntries(normativeContractNames.map((name) => {
  const serialized = !runtimeOnly.has(name);
  const schema = schemaExports[`${name}Schema`];
  const hashProfileKind = hashProfileKinds[name];
  return [name, Object.freeze({
    ...schema === void 0 ? {} : { schema },
    ...hashProfileKind === void 0 ? {} : { hashProfileKind },
    serialized
  })];
})));
function validateContractRegistry() {
  const errors = [];
  if (Object.keys(contractRegistry).length !== normativeContractNames.length) {
    errors.push("contract registry contains duplicate declaration names");
  }
  for (const [name, registration] of Object.entries(contractRegistry)) {
    if (registration.serialized && registration.schema === void 0 && !registration.extensionDefined) {
      errors.push(`${name} is serialized but has no schema`);
    }
    if (!registration.serialized && registration.schema !== void 0) {
      errors.push(`${name} is runtime-only but has a serialized schema`);
    }
    if (registration.hashProfileKind !== void 0) {
      try {
        getHashProfile(registration.hashProfileKind);
      } catch {
        errors.push(`${name} has no registered hash profile`);
      }
    }
  }
  return errors;
}
var exportedJsonSchemas;
function freezeJsonSchema(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value))
    return;
  for (const child of Object.values(value))
    freezeJsonSchema(child);
  Object.freeze(value);
}
function exportContractJsonSchemas() {
  if (exportedJsonSchemas !== void 0)
    return exportedJsonSchemas;
  const schemas = Object.fromEntries(Object.entries(contractRegistry).filter((entry) => entry[1].schema !== void 0).map(([name, registration]) => [
    name,
    z15.toJSONSchema(registration.schema, {
      target: "draft-2020-12",
      reused: "ref",
      cycles: "ref",
      io: "input"
    })
  ]));
  freezeJsonSchema(schemas);
  exportedJsonSchemas = schemas;
  return schemas;
}
function collectRefs(value, refs) {
  if (Array.isArray(value)) {
    for (const item of value)
      collectRefs(item, refs);
    return;
  }
  if (typeof value !== "object" || value === null)
    return;
  for (const [key2, item] of Object.entries(value)) {
    if (key2 === "$ref" && typeof item === "string")
      refs.push(item);
    else
      collectRefs(item, refs);
  }
}
function resolvePointer(root, pointer) {
  if (pointer === "#")
    return root;
  if (!pointer.startsWith("#/"))
    return void 0;
  let current = root;
  for (const rawSegment of pointer.slice(2).split("/")) {
    const segment = rawSegment.replaceAll("~1", "/").replaceAll("~0", "~");
    if (typeof current !== "object" || current === null || !(segment in current))
      return void 0;
    current = current[segment];
  }
  return current;
}
function validateJsonSchemaReferences(schemas = exportContractJsonSchemas()) {
  const errors = [];
  for (const [name, schema] of Object.entries(schemas)) {
    const refs = [];
    collectRefs(schema, refs);
    for (const ref2 of refs) {
      if (ref2.startsWith("#") && resolvePointer(schema, ref2) === void 0) {
        errors.push(`${name} has unresolved JSON Schema reference ${ref2}`);
      }
    }
  }
  return errors;
}

// node_modules/@projector/core/dist/schemas/application-evidence-assessment.js
import { z as z16 } from "zod";
var applicationEvidenceAssessmentRequestSchemaVersion = "application-evidence-assessment-request@1";
var applicationEvidenceAssessmentSchemaVersion = "application-evidence-assessment@1";
var identity = z16.string().min(1).max(512).regex(/^[^\0\r\n]+$/u);
var reason = z16.string().min(1).max(4096);
var owner = z16.strictObject({
  kind: z16.enum(["requirement", "behavioral-scenario"]),
  id: identity,
  canonicalDocumentHash: ContentHashSchema
});
var ApplicationEvidenceAssessmentRequestSchema = z16.strictObject({
  schemaVersion: z16.literal(applicationEvidenceAssessmentRequestSchemaVersion),
  owner,
  binding: ApplicationEvidencePredicateBindingSchema,
  evidenceIds: z16.array(identity).min(1).max(64)
}).superRefine((value, context) => {
  if (new Set(value.evidenceIds).size !== value.evidenceIds.length) {
    context.addIssue({ code: "custom", path: ["evidenceIds"], message: "application evidence IDs must be unique" });
  }
});
var custody = z16.discriminatedUnion("status", [
  z16.strictObject({ status: z16.literal("authenticated"), receiptHash: ContentHashSchema }),
  z16.strictObject({ status: z16.literal("unavailable"), reason })
]);
var currentness = z16.discriminatedUnion("status", [
  z16.strictObject({ status: z16.literal("current"), observationHash: ContentHashSchema }),
  z16.strictObject({ status: z16.literal("stale"), observationHash: ContentHashSchema, reason }),
  z16.strictObject({ status: z16.literal("unknown"), reason })
]);
var fulfillment = z16.strictObject({ status: z16.enum(["satisfied", "violated", "unknown"]), reason });
var ApplicationEvidenceAssessmentSchema = z16.strictObject({
  schemaVersion: z16.literal(applicationEvidenceAssessmentSchemaVersion),
  request: ApplicationEvidenceAssessmentRequestSchema,
  custody,
  currentness,
  fulfillment,
  dependencies: z16.array(StateValueDependencyRefSchema).max(256),
  contentHash: ContentHashSchema
}).superRefine((value, context) => {
  if (value.fulfillment.status !== "unknown" && (value.custody.status !== "authenticated" || value.currentness.status !== "current")) {
    context.addIssue({ code: "custom", path: ["fulfillment", "status"], message: "satisfied or violated evidence requires authenticated custody and current observation" });
  }
  const { contentHash: _contentHash, ...basis } = value;
  if (value.contentHash !== hashApplicationEvidenceAssessment(basis)) {
    context.addIssue({ code: "custom", path: ["contentHash"], message: "application evidence assessment hash does not match its exact response" });
  }
});
function hashApplicationEvidenceAssessment(value) {
  return hashFramedDomain("application-evidence-assessment/v1", value);
}
async function assessApplicationEvidence(port, request, environment) {
  const expected = ApplicationEvidenceAssessmentRequestSchema.parse(request);
  const assessment = ApplicationEvidenceAssessmentSchema.parse(await port.assess(expected, environment));
  if (canonicalJson(assessment.request) !== canonicalJson(expected)) {
    throw new Error("Application evidence host returned an assessment for a different exact request");
  }
  return assessment;
}
function applicationEvidenceDependencies(assessment) {
  return assessment.dependencies.map((dependency) => StateValueDependencyRefSchema.parse(dependency));
}

// node_modules/@projector/core/dist/schemas/application-observation.js
import { z as z17 } from "zod";
var applicationObservationPlanSchemaVersion = "application-observation-plan@1";
var applicationObservationResultSchemaVersion = "application-observation-result@1";
var boundedIdentity = z17.string().min(1).max(512).regex(/^[^\0\r\n]+$/u);
var diagnostic = z17.strictObject({
  code: boundedIdentity,
  message: z17.string().min(1).max(4096)
});
var scenarioBinding = z17.strictObject({
  id: EntityIdSchema,
  semanticHash: ContentHashSchema
});
var cleanup = z17.strictObject({
  complete: z17.boolean(),
  resources: z17.array(z17.strictObject({
    kind: boundedIdentity,
    handle: boundedIdentity,
    outcome: z17.enum(["released", "not-found", "retained-for-recovery", "release-failed"])
  })).max(256),
  diagnostics: z17.array(diagnostic).max(64)
});
var recovery = z17.strictObject({
  code: boundedIdentity,
  message: z17.string().min(1).max(4096),
  action: z17.string().min(1).max(4096),
  artifactRefs: z17.array(boundedIdentity).max(64)
});
function hashApplicationObservationInput(adapterId, adapterVersion, input) {
  return hashFramedDomain("application-observation-adapter-input:v1", { adapterId, adapterVersion, input });
}
function hashApplicationObservationOutput(adapterId, adapterVersion, output) {
  return hashFramedDomain("application-observation-adapter-output:v1", { adapterId, adapterVersion, output });
}
function createApplicationObservationContractSchemas(input) {
  boundedIdentity.parse(input.adapterId);
  boundedIdentity.parse(input.adapterVersion);
  const ApplicationObservationPlanSchema = z17.strictObject({
    schemaVersion: z17.literal(applicationObservationPlanSchemaVersion),
    runId: boundedIdentity,
    scenario: scenarioBinding,
    case: boundedIdentity,
    adapter: z17.strictObject({
      id: z17.literal(input.adapterId),
      version: z17.literal(input.adapterVersion),
      inputHash: ContentHashSchema,
      input: input.adapterInputSchema
    })
  }).superRefine((plan, context) => {
    const adapter = plan.adapter;
    const actual = hashApplicationObservationInput(input.adapterId, input.adapterVersion, adapter.input);
    if (actual !== adapter.inputHash) {
      context.addIssue({ code: "custom", path: ["adapter", "inputHash"], message: "adapter input hash does not match the strict parsed input" });
    }
  });
  const ApplicationObservationResultSchema = z17.strictObject({
    schemaVersion: z17.literal(applicationObservationResultSchemaVersion),
    runId: boundedIdentity,
    scenario: scenarioBinding,
    case: boundedIdentity,
    adapter: z17.strictObject({
      id: z17.literal(input.adapterId),
      version: z17.literal(input.adapterVersion),
      inputHash: ContentHashSchema,
      outputHash: ContentHashSchema,
      output: input.adapterOutputSchema
    }),
    operationalStatus: z17.enum(["completed", "failed", "cancelled"]),
    outcome: z17.enum(["passed", "failed", "unavailable"]),
    currentness: z17.enum(["current", "stale", "unknown"]),
    assurance: z17.literal("supporting"),
    diagnostics: z17.array(diagnostic).max(64),
    cleanup,
    recovery: recovery.optional()
  }).superRefine((result, context) => {
    const adapter = result.adapter;
    const actual = hashApplicationObservationOutput(input.adapterId, input.adapterVersion, adapter.output);
    if (actual !== adapter.outputHash) {
      context.addIssue({ code: "custom", path: ["adapter", "outputHash"], message: "adapter output hash does not match the strict parsed output" });
    }
    if (result.outcome === "passed" && (result.operationalStatus !== "completed" || result.currentness !== "current" || !result.cleanup.complete)) {
      context.addIssue({ code: "custom", path: ["outcome"], message: "passed evidence requires completed operation, current inputs, and complete cleanup" });
    }
    if (result.operationalStatus !== "completed" && result.outcome !== "unavailable") {
      context.addIssue({ code: "custom", path: ["outcome"], message: "an operation that did not complete cannot report a behavioral outcome" });
    }
    const resourcesReleased = result.cleanup.resources.every(({ outcome }) => outcome === "released" || outcome === "not-found");
    if (result.cleanup.complete !== resourcesReleased) {
      context.addIssue({ code: "custom", path: ["cleanup", "complete"], message: "cleanup is complete exactly when every owned resource was released or already absent" });
    }
    if (!result.cleanup.complete && result.recovery === void 0) {
      context.addIssue({ code: "custom", path: ["recovery"], message: "incomplete cleanup requires an explicit recovery action" });
    }
  });
  const ApplicationObservationExchangeSchema = z17.strictObject({
    plan: ApplicationObservationPlanSchema,
    result: ApplicationObservationResultSchema
  }).superRefine(({ plan, result }, context) => {
    const mismatches = [
      ["runId", plan.runId, result.runId],
      ["scenario.id", plan.scenario.id, result.scenario.id],
      ["scenario.semanticHash", plan.scenario.semanticHash, result.scenario.semanticHash],
      ["case", plan.case, result.case],
      ["adapter.id", plan.adapter.id, result.adapter.id],
      ["adapter.version", plan.adapter.version, result.adapter.version],
      ["adapter.inputHash", plan.adapter.inputHash, result.adapter.inputHash]
    ];
    for (const [field, expected, actual] of mismatches) {
      if (expected !== actual)
        context.addIssue({ code: "custom", path: ["result", ...field.split(".")], message: `result ${field} does not match the exact observation plan` });
    }
  });
  return Object.freeze({ ApplicationObservationPlanSchema, ApplicationObservationResultSchema, ApplicationObservationExchangeSchema });
}

// node_modules/@projector/core/dist/schemas/completion-audit.js
import { z as z18 } from "zod";
var CompletionAssessmentSchema = z18.object({
  status: z18.enum(["violated", "unknown", "unavailable"]),
  category: z18.enum(["authority-problem", "rule-violation", "conflicting-rules", "unreachable-selector", "missing-validator", "unrealized-behavior", "missing-evidence", "meaning-gap"])
}).strict();
var CompletionRepairRouteSchema = z18.enum(["canonical-proposal", "implementation-repair", "missing-evidence"]);
var CompletionRepairAlternativeSchema = z18.object({
  strategy: z18.enum(["reuse", "revalidate", "regenerate", "deterministic-patch", "agent-repair", "widen-analysis", "human-decision"]),
  status: z18.enum(["available", "unavailable", "skipped"]),
  reason: z18.string().min(1),
  capabilityIds: z18.array(z18.string())
}).strict();

export {
  ObservationLimitsSchema,
  ObservationLimitsOverrideSchema,
  DEFAULT_OBSERVATION_LIMITS,
  observationLimitValue,
  resolveObservationLimits,
  ObservationDescriptorSchema,
  ObservationError,
  ObservationBudget,
  DerivedObservationBudget,
  CodeLocationSchema,
  CodeProvenanceSchema,
  CodeSymbolSchema,
  CodeEdgeSchema,
  CodeCapabilitySchema,
  CodeCoverageSchema,
  CodePartitionSchema,
  CodeInputBindingSchema,
  CodeSnapshotSchema,
  CodeQuerySchema,
  CodeQueryResultSchema,
  CodeNeighborhoodSchema,
  validateCanonicalGlob,
  matchesCanonicalGlob,
  normalizeRepositoryRelativePath,
  compileWriteAuthorization,
  authorizeRepositoryPath,
  canonicalJson,
  parseCanonicalJson,
  hashFramedDomain,
  hashFramedCanonicalJsonChunks,
  manifestKey,
  buildManifest,
  updateManifest,
  registerHashProfile,
  getHashProfile,
  hashSemantic,
  hashDiscovery,
  hashCanonicalDocument,
  hashRootManifest,
  builtinHashProfiles,
  FixedCanonicalLifecycleByKind,
  withCanonicalHashes,
  verifyCanonicalEnvelope,
  deriveEntityId,
  inferEntityId,
  validateLineage,
  applicationEvidenceBindingIssues,
  JsonValueSchema,
  ConcernMaterialitySchema,
  ConcernActivationReasonSchema,
  DecisionDeferralSchema,
  ArchitectureConcernSchema,
  DecisionConsequenceSchema,
  AppliedPreferenceRefSchema,
  ArchitectureDecisionSchema,
  DecisionOptionSchema,
  DecisionEvaluationSchema,
  DecisionValidityAssessmentSchema,
  DeveloperPreferenceSchema,
  GovernanceBasisSchema,
  EvidenceRefSchema,
  ApplicationEvidencePredicateBindingSchema,
  CausalOriginSchema,
  SemanticSignatureSchema,
  LineageRecordSchema,
  TombstoneSchema,
  ConceptSchema,
  RelationTypeSchema,
  RelationSchema,
  IntentOriginRefSchema,
  RealizationBindingSchema,
  RealizationOriginRefSchema,
  RequirementSchema,
  BehavioralScenarioStepSchema,
  BehavioralScenarioSchema,
  RepresentationTargetSchema,
  PreservationDimensionSchema,
  SemanticPreservationFingerprintSchema,
  RepresentationStyleRuleSchema,
  SemanticRepresentationProfileSchema,
  RepresentationTokenAccountingSchema,
  RepresentationProjectionSchema,
  RepresentationProjectionRefSchema,
  StateDigestSchema,
  StateValueDependencyKindSchema,
  StateValueDependencyRefSchema,
  StateQueryKindSchema,
  StateQuerySpecSchema,
  StateQueryResultFingerprintSchema,
  StateQueryDependencySchema,
  StateBindingSchema,
  StateBindingValidationSchema,
  StateDependencyObservationSchema,
  ValidationResultSchema,
  RollbackSpecSchema,
  OperationEvidenceSchema,
  AnalyzerCapabilitiesSchema,
  AnalyzerFailureSchema,
  ArtifactFingerprintSchema,
  TransformPreviewSchema,
  TransformResultSchema,
  SurfaceChangeSchema,
  SurfacePlanSchema,
  SurfaceApplyResultSchema,
  RecognizerBindingSchema,
  ValidatorBindingSchema,
  TransformBindingSchema,
  MigrationBindingSchema,
  GovernanceExceptionSchema,
  MigrationOverlaySchema,
  LensExampleSchema,
  AuthorityAlternativeSchema,
  ObservabilityClassSchema,
  EnumerationContractSchema,
  SurfaceCapabilitiesSchema,
  SurfaceSchema,
  ArtifactSchema,
  SemanticAnchorSchema,
  ControlPolicySchema,
  LensRefSchema,
  ValidityStateSchema,
  ProjectionUnitSchema,
  EvidenceKindSchema,
  EvidenceClaimSchema,
  EvidenceSchema,
  AuthorityVectorSchema,
  AuthorityReconsiderTriggerSchema,
  EvidenceRefreshPolicySchema,
  AuthorityRecordSchema,
  SemanticIdentityCandidateSchema,
  NewSemanticBoundarySchema,
  SemanticIdentityResolutionSchema,
  RelevanceBandSchema,
  RelevanceSeedSchema,
  RelevanceReasonSchema,
  RelevanceEntrySchema,
  RelevanceClosureSchema,
  AnalysisFacetSchema,
  PlanningSurpriseSchema,
  RiskClassSchema,
  RiskAssessmentSchema,
  ExecutionPolicySchema,
  PatternCandidateSchema,
  LensContributionRoleSchema,
  ProjectionExpectationSchema,
  ProjectionSpecSchema,
  ProjectionLensSchema,
  SelectorExprSchema,
  RealizationSelectorExprSchema,
  IgnorePolicySchema,
  RuleEffectSchema,
  AuthorityClassSchema,
  NormalizedPredicateSchema,
  RuleSchema,
  RuleConflictSchema,
  EffectiveRuleBundleSchema,
  DerivationInputSchema,
  DerivationRecordSchema,
  ImpactRuleSchema,
  InvalidationCauseSchema,
  InvalidationEventSchema,
  InvalidationResultSchema,
  RepairStrategySchema,
  RepairCapabilitiesSchema,
  ContextPrecedentSchema,
  ScopeGrantSchema,
  CompletionContractSchema,
  ExecutionCapsuleSchema,
  CommandSpecSchema,
  CoverageLaneSchema,
  CoverageSnapshotSchema,
  DivergenceSchema,
  PlanCheckpointSchema,
  ExecutionPlanSchema,
  IntentStatementSchema,
  ChangeIntentAnalysisSchema,
  RequirementDeltaSchema,
  BehavioralScenarioDeltaSchema,
  SemanticOperationSchema,
  ChangeOperationSchema,
  ImpactClosureRefSchema,
  SemanticChangeSchema,
  WorkPacketSchema,
  TransactionPhaseSchema,
  TransactionJournalEntrySchema,
  TransactionReceiptSchema,
  ChangeCertificateSchema,
  StructuredModelRequestSchema,
  StructuredModelResponseSchema,
  EntityIdSchema,
  ConfidenceSchema,
  ContentHashSchema,
  SourceClassSchema,
  PortableRelativePathSchema,
  GitRealizationLocatorSchema,
  CanonicalKindSchema,
  CanonicalPayloadSchemas,
  CanonicalDocumentEnvelopeSchema,
  canonicalDocumentEnvelopeSchemaForKind,
  CanonicalDocumentEnvelopeSchemasByKind,
  CanonicalDocumentEnvelopeByKindSchema,
  CanonicalDocumentWireSchemasByKind,
  CanonicalDocumentWireByKindSchema,
  hydrateCanonicalDocumentWire,
  toCanonicalDocumentWire,
  changeProposalApiVersion,
  ChangeProposalSchema,
  parseChangeProposal,
  ArchitectureEvaluationRequestSchema,
  ArchitectureEvaluationOutputSchema,
  VerificationPopulationSchema,
  VerificationInputSnapshotSchema,
  VerificationRequestSchema,
  VerificationEvidenceSchema,
  VerificationInspectionSchema,
  VerificationRecoverySchema,
  BuiltinVerificationRequestSchema,
  BuiltinVerificationArtifactSchema,
  BuiltinVerificationEvidenceSchema,
  BuiltinVerificationAssessmentSchema,
  BuiltinVerificationInspectionSchema,
  BuiltinVerificationRecoverySchema,
  BuiltinVerificationOperationSchema,
  GeneratedOutputRequestSchema,
  GeneratedOutputEvidenceSchema,
  GeneratedOutputInspectionSchema,
  GeneratedOutputRecoverySchema,
  GitIntegrationRequestSchema,
  GitResultReconciliationSchema,
  GitIntegrationAssessmentSchema,
  CodeRepositoryPathSchema,
  CodeProducerSchema,
  CodeIndexRequestSchema,
  CodeQueryRequestSchema,
  CodeQueryEvidenceSchema,
  CodeIndexRunSchema,
  CodeIndexStatusRequestSchema,
  CodeIndexWaitRequestSchema,
  CodeIndexCancelRequestSchema,
  CodeIndexStatusSchema,
  CodeImpactRequestSchema,
  CodeImpactResultSchema,
  CodeRuntimeEvidenceSchema,
  CodeBridgeSchema,
  CodeEvidenceRequestSchema,
  CodeEvidenceResultSchema,
  CodeTestsRequestSchema,
  CodeTestsResultSchema,
  CodeTestRunRequestSchema,
  CodeTestRunResultSchema,
  CodeExportRequestSchema,
  CodeExportResultSchema,
  CodeContextSummarySchema,
  projectorOperationApiVersion,
  projectorOperationResultApiVersion,
  ProjectorOperationSchema,
  createProjectorOperationRequestSchema,
  ProjectorOperationInputSchemas,
  ProjectorOperationRequestSchema,
  PackageVersionSchema,
  PackageIdentitySchema,
  ProjectReadinessStatusSchema,
  ProjectReadinessSchema,
  ProjectorOperationErrorSchema,
  ProjectorOperationActionSchema,
  createProjectorOperationResultSchema,
  projectorConfigApiVersion,
  PreparedProjectorConfigSchema,
  ProjectorConfigSchema,
  parseProjectorConfig,
  parsePreparedProjectorConfig,
  durableRepresentationArtifactApiVersion,
  DurableRepresentationArtifactRecordBodySchema,
  hashDurableRepresentationArtifactRecord,
  DurableRepresentationArtifactRecordSchema,
  createDurableRepresentationArtifactRecord,
  normativeContractNames,
  contractRegistry,
  validateContractRegistry,
  exportContractJsonSchemas,
  validateJsonSchemaReferences,
  applicationEvidenceAssessmentRequestSchemaVersion,
  applicationEvidenceAssessmentSchemaVersion,
  ApplicationEvidenceAssessmentRequestSchema,
  ApplicationEvidenceAssessmentSchema,
  hashApplicationEvidenceAssessment,
  assessApplicationEvidence,
  applicationEvidenceDependencies,
  applicationObservationPlanSchemaVersion,
  applicationObservationResultSchemaVersion,
  hashApplicationObservationInput,
  hashApplicationObservationOutput,
  createApplicationObservationContractSchemas,
  CompletionAssessmentSchema,
  CompletionRepairRouteSchema,
  CompletionRepairAlternativeSchema
};
