import {
  __export
} from "./shared-WC2OT3WX.js";

// node_modules/@projector/core/dist/observation.js
import { z } from "zod";
var ObservationLimitsSchema = z.object({
  maxFiles: z.number().int().positive().safe(),
  maxDirectories: z.number().int().positive().safe(),
  maxFileBytes: z.number().int().positive().safe(),
  maxTotalBytes: z.number().int().positive().safe(),
  maxGitOutputBytes: z.number().int().positive().safe(),
  timeoutMs: z.number().int().positive().safe(),
  maxWorkerHeapMiB: z.number().int().positive().safe(),
  maxDerivedBytes: z.number().int().positive().safe()
}).strict();
var ObservationLimitsOverrideSchema = ObservationLimitsSchema.partial();
var DEFAULT_OBSERVATION_LIMITS = Object.freeze({
  maxFiles: 2e4,
  maxDirectories: 2e4,
  maxFileBytes: 8 * 1024 * 1024,
  maxTotalBytes: 256 * 1024 * 1024,
  maxGitOutputBytes: 32 * 1024 * 1024,
  timeoutMs: 6e4,
  maxWorkerHeapMiB: 512,
  maxDerivedBytes: 64 * 1024 * 1024
});
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
    this.deadline = startedAt + this.limits.timeoutMs;
  }
  remainingMs() {
    return Math.max(0, this.deadline - Date.now());
  }
  remaining(limit) {
    return this.limits[limit] - this.counts[limit];
  }
  check(stage, scope = ".") {
    if (this.remainingMs() === 0)
      throw new ObservationError("observation-limit-exceeded", stage, scope, "Repository observation deadline exceeded; explicitly increase timeoutMs to retry.", "timeoutMs", this.limits.timeoutMs);
  }
  consume(limit, amount, stage, scope = ".") {
    this.check(stage, scope);
    if (!Number.isSafeInteger(amount) || amount < 0)
      throw new ObservationError("observation-failed", stage, scope, "Observation accounting requires a nonnegative safe integer.");
    const observed = this.counts[limit] + amount;
    if (observed > this.limits[limit])
      throw new ObservationError("observation-limit-exceeded", stage, scope, `Repository observation exceeds ${limit} (${this.limits[limit]}); explicitly increase this limit to retry.`, limit, observed);
    this.counts[limit] = observed;
  }
  assertFileBytes(bytes, scope) {
    this.check("file-read", scope);
    if (bytes > this.limits.maxFileBytes)
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
    if (!Number.isSafeInteger(maxDerivedBytes) || maxDerivedBytes <= 0)
      throw new ObservationError("observation-failed", "derived-limits", ".", "maxDerivedBytes must be a positive safe integer.");
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
    if (observed > this.maxDerivedBytes)
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
import { z as z3 } from "zod";

// node_modules/@projector/core/dist/schemas/contracts.js
import { z as z2 } from "zod";
var EntityIdSchema = z2.string().min(1).regex(/^(?!\s)(?!.*\s$)(?!\.$)(?!\.\.$)[^\\/\0]+$/u, "entity ID must be trimmed, path-independent, and free of path separators");
var ConfidenceSchema = z2.number().min(0).max(1).finite();
var ContentHashSchema = z2.string().regex(/^sha256:v1:[0-9a-f]{64}$/u, "expected a sha256:v1 content hash with 64 lowercase hexadecimal characters");
var SourceClassSchema = z2.enum(["authored", "derived", "observed", "inferred"]);
var PortableRelativePathSchema = z2.string().min(1).max(1024).regex(/^(?!\/)(?!.*:)(?!.*\\)(?!.*\0)(?!.*\/\/)(?!.*[. ](?:\/|$))(?!.*(?:^|\/)(?:[Cc][Oo][Nn]|[Pp][Rr][Nn]|[Aa][Uu][Xx]|[Nn][Uu][Ll]|[Cc][Oo][Mm][1-9]|[Ll][Pp][Tt][1-9])(?:\.[^/]*)?(?:\/|$))(?!(?:\.|\.\.)(?:\/|$))(?!.*\/(?:\.|\.\.)(?:\/|$))[^/](?:.*[^/])?$/u, "must be a portable canonical relative path without aliases, device names, or alternate data streams");
var GitRealizationLocatorSchema = z2.string().regex(/^git:(?:[a-f0-9]{40}|[a-f0-9]{64}):(?!\/)(?![A-Za-z]:)(?!.*\\)(?!.*\/\/)(?!(?:\.|\.\.)(?:\/|$))(?!.*\/(?:\.|\.\.)(?:\/|$))[^/](?:.*[^/])?$/u, "git realization origin must contain a full commit ID and canonical repository-relative path");

// node_modules/@projector/core/dist/schemas/generated-contracts.js
var JsonValueSchema = z3.lazy(() => z3.union([z3.null(), z3.boolean(), z3.number().finite(), z3.string(), z3.array(JsonValueSchema), z3.record(z3.string(), JsonValueSchema)]));
var strictObject = (shape) => z3.strictObject(shape);
var ConcernMaterialitySchema = z3.lazy(() => z3.union([z3.literal("blocking-now"), z3.literal("material-soon"), z3.literal("deferable")]));
var ConcernActivationReasonSchema = z3.lazy(() => strictObject({
  "kind": z3.union([z3.literal("requirement-delta"), z3.literal("scenario-delta"), z3.literal("relevance-discovery"), z3.literal("planning-surprise"), z3.literal("constraint-delta"), z3.literal("surface-added"), z3.literal("scale-signal"), z3.literal("pattern-friction"), z3.literal("decision-trigger"), z3.literal("research"), z3.literal("user-request"), z3.literal("inference")]),
  "subjectIds": z3.array(z3.union([EntityIdSchema, z3.string()])),
  "explanation": z3.string(),
  "causalOrigin": CausalOriginSchema
}));
var DecisionDeferralSchema = z3.lazy(() => strictObject({
  "rationale": z3.string(),
  "preserveOptionality": z3.array(z3.string()),
  "forbiddenCommitments": z3.array(z3.string()),
  "reconsiderWhen": z3.array(AuthorityReconsiderTriggerSchema),
  "reviewBy": z3.string().optional()
}));
var ArchitectureConcernSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z3.string(),
  "title": z3.string(),
  "question": z3.string(),
  "scope": SelectorExprSchema,
  "sourceClass": SourceClassSchema,
  "status": z3.union([z3.literal("candidate"), z3.literal("active"), z3.literal("deferred"), z3.literal("resolved"), z3.literal("dismissed"), z3.literal("superseded")]),
  "materiality": ConcernMaterialitySchema,
  "activationReasons": z3.array(ConcernActivationReasonSchema),
  "relatedConceptIds": z3.array(EntityIdSchema),
  "relatedRequirementIds": z3.array(EntityIdSchema),
  "relevanceClosureId": EntityIdSchema.optional(),
  "decisionIds": z3.array(EntityIdSchema),
  "deferral": DecisionDeferralSchema.optional(),
  "evidence": z3.array(EvidenceRefSchema),
  "semanticHash": ContentHashSchema
}));
var DecisionConsequenceSchema = z3.lazy(() => strictObject({
  "kind": z3.union([z3.literal("activate-governance"), z3.literal("deactivate-governance"), z3.literal("introduce-constraint"), z3.literal("retire-constraint"), z3.literal("select-technology"), z3.literal("deprecate-technology"), z3.literal("require-migration"), z3.literal("activate-concern"), z3.literal("constrain-decision"), z3.literal("advisory")]),
  "targetId": EntityIdSchema.optional(),
  "scope": SelectorExprSchema.optional(),
  "payload": z3.record(z3.string(), JsonValueSchema).optional(),
  "explanation": z3.string()
}));
var AppliedPreferenceRefSchema = z3.lazy(() => strictObject({
  "key": z3.string(),
  "scope": z3.union([z3.literal("user"), z3.literal("organization"), z3.literal("project")]),
  "semanticHash": ContentHashSchema,
  "influence": z3.string()
}));
var ArchitectureDecisionSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z3.string(),
  "concernId": EntityIdSchema,
  "title": z3.string(),
  "decision": z3.string(),
  "selectedOptionKey": z3.string(),
  "scope": SelectorExprSchema,
  "lifecycle": z3.union([z3.literal("active"), z3.literal("superseded"), z3.literal("retired")]),
  "authorityRecordId": EntityIdSchema,
  "governanceBasis": z3.array(GovernanceBasisSchema),
  "consequences": z3.array(DecisionConsequenceSchema),
  "appliedPreferences": z3.array(AppliedPreferenceRefSchema),
  "supersedesDecisionIds": z3.array(EntityIdSchema),
  "migrationId": EntityIdSchema.optional(),
  "semanticHash": ContentHashSchema
}));
var DecisionOptionSchema = z3.lazy(() => strictObject({
  "key": z3.string(),
  "title": z3.string(),
  "description": z3.string(),
  "hardConstraintStatus": z3.union([z3.literal("passes"), z3.literal("fails"), z3.literal("unknown")]),
  "tradeoffs": z3.array(z3.string()),
  "evidence": z3.array(EvidenceRefSchema),
  "preferenceFit": z3.array(AppliedPreferenceRefSchema)
}));
var DecisionEvaluationSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "concernId": EntityIdSchema,
  "scope": SelectorExprSchema,
  "options": z3.array(DecisionOptionSchema),
  "eliminatedOptionKeys": z3.array(z3.string()),
  "recommendedOptionKey": z3.string().optional(),
  "outcome": z3.union([z3.literal("recommended"), z3.literal("contested"), z3.literal("insufficient-evidence")]),
  "hardConstraints": z3.array(EntityIdSchema),
  "preferenceSnapshotHash": ContentHashSchema,
  "researchEvidenceIds": z3.array(EntityIdSchema),
  "unknowns": z3.array(z3.string()),
  "evaluatedAt": z3.string(),
  "semanticHash": ContentHashSchema
}));
var DecisionValidityAssessmentSchema = z3.lazy(() => strictObject({
  "decisionId": EntityIdSchema,
  "scope": SelectorExprSchema,
  "state": z3.union([z3.literal("valid"), z3.literal("suspect"), z3.literal("contested"), z3.literal("invalid-for-scope")]),
  "firedTriggers": z3.array(AuthorityReconsiderTriggerSchema),
  "invalidatedAssumptions": z3.array(z3.string()),
  "staleEvidenceIds": z3.array(EntityIdSchema),
  "blocksCurrentChange": z3.boolean(),
  "explanation": z3.string()
}));
var DeveloperPreferenceSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z3.string(),
  "scope": z3.union([z3.literal("user"), z3.literal("organization"), z3.literal("project")]),
  "selector": SelectorExprSchema,
  "strength": z3.union([z3.literal("prefer"), z3.literal("strongly-prefer"), z3.literal("avoid")]),
  "statement": z3.string(),
  "rationale": z3.string().optional(),
  "status": z3.union([z3.literal("active"), z3.literal("retired")]),
  "sourceClass": SourceClassSchema,
  "semanticHash": ContentHashSchema
}));
var GovernanceBasisSchema = z3.lazy(() => z3.union([strictObject({
  "kind": z3.literal("architecture-decision"),
  "decisionId": EntityIdSchema
}), strictObject({
  "kind": z3.literal("hard-constraint"),
  "conceptId": EntityIdSchema
}), strictObject({
  "kind": z3.literal("adopted-standard"),
  "authorityRecordId": EntityIdSchema
}), strictObject({
  "kind": z3.literal("migration-overlay"),
  "migrationId": EntityIdSchema
}), strictObject({
  "kind": z3.literal("host-safety"),
  "key": z3.string()
}), strictObject({
  "kind": z3.literal("active-lens"),
  "lensId": EntityIdSchema
})]));
var EvidenceRefSchema = z3.lazy(() => strictObject({
  "evidenceId": EntityIdSchema,
  "stance": z3.union([z3.literal("supports"), z3.literal("contradicts"), z3.literal("context")]),
  "weight": z3.number().finite().optional(),
  "applicationPredicate": ApplicationEvidencePredicateBindingSchema.optional()
}));
var ApplicationEvidencePredicateBindingSchema = z3.lazy(() => strictObject({
  "kind": z3.literal("application-observation"),
  "adapter": strictObject({
    "id": z3.string(),
    "version": z3.string()
  }),
  "scenario": strictObject({
    "id": EntityIdSchema,
    "semanticHash": ContentHashSchema
  }),
  "case": z3.string(),
  "predicateId": EntityIdSchema,
  "assertionIds": z3.array(z3.string()),
  "observationRole": z3.union([z3.literal("prior"), z3.literal("latest")])
}).superRefine((value, context) => {
  const textFields = [value.adapter.id, value.adapter.version, value.case, value.predicateId, ...value.assertionIds];
  if (textFields.some((item) => item.trim() === "" || item !== item.trim()))
    context.addIssue({ code: "custom", message: "application evidence binding identifiers must be nonblank normalized text" });
  if (value.assertionIds.length === 0 || new Set(value.assertionIds).size !== value.assertionIds.length)
    context.addIssue({ code: "custom", path: ["assertionIds"], message: "application evidence binding requires unique assertion identities" });
}));
var CausalOriginSchema = z3.lazy(() => strictObject({
  "kind": z3.union([z3.literal("pre-projector"), z3.literal("human"), z3.literal("deterministic-observation"), z3.literal("model-inference"), z3.literal("semantic-resolution"), z3.literal("relevance-analysis"), z3.literal("planning-surprise"), z3.literal("lens-transform"), z3.literal("plan"), z3.literal("external")]),
  "causedByLensId": EntityIdSchema.optional(),
  "causedByRuleId": EntityIdSchema.optional(),
  "causedByTransformId": z3.string().optional(),
  "causedBySemanticChangeId": EntityIdSchema.optional(),
  "causedByRelevanceClosureId": EntityIdSchema.optional(),
  "causedByPlanningSurpriseId": EntityIdSchema.optional(),
  "causedByPlanId": EntityIdSchema.optional(),
  "causedByPacketId": EntityIdSchema.optional()
}));
var SemanticSignatureSchema = z3.lazy(() => strictObject({
  "hash": ContentHashSchema,
  "profileId": z3.string(),
  "profileVersion": z3.string(),
  "scope": z3.string(),
  "assurance": z3.union([z3.literal("exact"), z3.literal("validated"), z3.literal("heuristic")]),
  "evidenceIds": z3.array(EntityIdSchema)
}));
var LineageRecordSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "kind": z3.union([z3.literal("move"), z3.literal("split"), z3.literal("merge"), z3.literal("replace"), z3.literal("delete")]),
  "fromIds": z3.array(EntityIdSchema),
  "toIds": z3.array(EntityIdSchema),
  "reason": z3.string(),
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
var TombstoneSchema = z3.lazy(() => strictObject({
  "entityId": EntityIdSchema,
  "deletedAtRevision": z3.number().finite(),
  "lastSemanticHash": ContentHashSchema,
  "replacementIds": z3.array(EntityIdSchema),
  "reason": z3.string()
}));
var ConceptSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z3.string(),
  "kind": z3.union([z3.literal("capability"), z3.literal("behavior"), z3.literal("invariant"), z3.literal("decision"), z3.literal("ownership"), z3.literal("obligation"), z3.literal("data"), z3.literal("interface"), z3.literal("event"), z3.literal("command"), z3.literal("policy"), z3.literal("read-model"), z3.literal("contract"), z3.literal("assumption"), z3.literal("migration"), z3.literal("constraint")]),
  "name": z3.string(),
  "aliases": z3.array(z3.string()),
  "statement": z3.string(),
  "status": z3.union([z3.literal("candidate"), z3.literal("active"), z3.literal("deprecated"), z3.literal("rejected")]),
  "sourceClass": SourceClassSchema,
  "confidence": ConfidenceSchema,
  "tags": z3.array(z3.string()),
  "evidence": z3.array(EvidenceRefSchema),
  "origin": z3.array(IntentOriginRefSchema).optional(),
  "realizations": z3.array(RealizationBindingSchema).optional(),
  "discoveryHash": ContentHashSchema,
  "semanticHash": ContentHashSchema
}));
var RelationTypeSchema = z3.lazy(() => z3.union([z3.literal("realizes"), z3.literal("requires"), z3.literal("constrains"), z3.literal("depends-on"), z3.literal("has-requirement"), z3.literal("demonstrated-by"), z3.literal("produces"), z3.literal("consumes"), z3.literal("triggers"), z3.literal("governed-by"), z3.literal("applies-to"), z3.literal("generates"), z3.literal("documents"), z3.literal("verifies"), z3.literal("deploys-to"), z3.literal("publishes-to"), z3.literal("observes"), z3.literal("owns"), z3.literal("incompatible-with"), z3.literal("derived-from"), z3.literal("supersedes"), z3.literal("exception-to"), z3.literal("variant-of")]));
var RelationSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "fromId": EntityIdSchema,
  "toId": EntityIdSchema,
  "type": RelationTypeSchema,
  "sourceClass": SourceClassSchema,
  "confidence": ConfidenceSchema,
  "evidence": z3.array(EvidenceRefSchema),
  "active": z3.boolean(),
  "semanticHash": ContentHashSchema
}));
var IntentOriginRefSchema = z3.lazy(() => strictObject({
  "kind": z3.union([z3.literal("user-request"), z3.literal("linear"), z3.literal("github-issue"), z3.literal("document"), z3.literal("external")]),
  "locator": z3.string(),
  "contentHash": ContentHashSchema.optional(),
  "description": z3.string().optional()
}));
var RealizationBindingSchema = z3.lazy(() => strictObject({
  "selector": RealizationSelectorExprSchema,
  "origin": RealizationOriginRefSchema
}));
var RealizationOriginRefSchema = z3.lazy(() => z3.union([strictObject({
  "kind": z3.literal("git"),
  "locator": GitRealizationLocatorSchema,
  "description": z3.string().optional()
}), strictObject({
  "kind": z3.literal("content"),
  "locator": z3.string(),
  "contentHash": ContentHashSchema,
  "description": z3.string().optional()
})]));
var RequirementSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z3.string(),
  "title": z3.string(),
  "aliases": z3.array(z3.string()),
  "statement": z3.string(),
  "status": z3.union([z3.literal("candidate"), z3.literal("active"), z3.literal("deprecated"), z3.literal("rejected"), z3.literal("superseded")]),
  "sourceClass": SourceClassSchema,
  "scope": SelectorExprSchema,
  "origin": z3.array(IntentOriginRefSchema),
  "realizations": z3.array(RealizationBindingSchema).optional(),
  "evidence": z3.array(EvidenceRefSchema),
  "discoveryHash": ContentHashSchema,
  "semanticHash": ContentHashSchema
}).superRefine((value, context) => {
  for (const issue of applicationEvidenceBindingIssues(value.evidence))
    context.addIssue({ code: "custom", path: ["evidence", issue.index, "applicationPredicate", "observationRole"], message: issue.message });
}));
var BehavioralScenarioStepSchema = z3.lazy(() => strictObject({
  "role": z3.union([z3.literal("precondition"), z3.literal("trigger"), z3.literal("expected-outcome"), z3.literal("forbidden-outcome")]),
  "statement": z3.string()
}));
var BehavioralScenarioSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z3.string(),
  "title": z3.string(),
  "aliases": z3.array(z3.string()),
  "status": z3.union([z3.literal("candidate"), z3.literal("active"), z3.literal("deprecated"), z3.literal("rejected"), z3.literal("superseded")]),
  "sourceClass": SourceClassSchema,
  "scope": SelectorExprSchema,
  "steps": z3.array(BehavioralScenarioStepSchema),
  "origin": z3.array(IntentOriginRefSchema).optional(),
  "realizations": z3.array(RealizationBindingSchema).optional(),
  "evidence": z3.array(EvidenceRefSchema),
  "discoveryHash": ContentHashSchema,
  "semanticHash": ContentHashSchema
}).superRefine((value, context) => {
  for (const issue of applicationEvidenceBindingIssues(value.evidence))
    context.addIssue({ code: "custom", path: ["evidence", issue.index, "applicationPredicate", "observationRole"], message: issue.message });
  for (const [index, reference] of value.evidence.entries())
    if (reference.applicationPredicate !== void 0 && (reference.applicationPredicate.scenario.id !== value.id || reference.applicationPredicate.scenario.semanticHash !== value.semanticHash))
      context.addIssue({ code: "custom", path: ["evidence", index, "applicationPredicate", "scenario"], message: "scenario-owned application evidence must bind the owning scenario identity and semantic hash" });
}));
var RepresentationTargetSchema = z3.lazy(() => z3.union([z3.literal("human-technical"), z3.literal("behavior-spec"), z3.literal("agent-context"), z3.literal("machine-invariant")]));
var PreservationDimensionSchema = z3.lazy(() => z3.union([z3.literal("normative-force"), z3.literal("negation"), z3.literal("scope"), z3.literal("quantifier-cardinality"), z3.literal("logical-connective"), z3.literal("condition-guard"), z3.literal("exception"), z3.literal("dependency-order"), z3.literal("behavior-step-role"), z3.literal("concept-identity"), z3.literal("identifier-literal")]));
var SemanticPreservationFingerprintSchema = z3.lazy(() => strictObject({
  "sourceSemanticHash": ContentHashSchema,
  "profileId": EntityIdSchema,
  "profileVersion": z3.string(),
  "protectedDimensions": z3.array(PreservationDimensionSchema),
  "dimensionHashes": z3.partialRecord(z3.union([z3.literal("normative-force"), z3.literal("negation"), z3.literal("scope"), z3.literal("quantifier-cardinality"), z3.literal("logical-connective"), z3.literal("condition-guard"), z3.literal("exception"), z3.literal("dependency-order"), z3.literal("behavior-step-role"), z3.literal("concept-identity"), z3.literal("identifier-literal")]), ContentHashSchema),
  "dimensionAssurance": z3.partialRecord(z3.union([z3.literal("normative-force"), z3.literal("negation"), z3.literal("scope"), z3.literal("quantifier-cardinality"), z3.literal("logical-connective"), z3.literal("condition-guard"), z3.literal("exception"), z3.literal("dependency-order"), z3.literal("behavior-step-role"), z3.literal("concept-identity"), z3.literal("identifier-literal")]), z3.union([z3.literal("exact"), z3.literal("validated"), z3.literal("heuristic")])),
  "unsupportedDimensions": z3.array(PreservationDimensionSchema),
  "assurance": z3.union([z3.literal("exact"), z3.literal("validated"), z3.literal("heuristic")]),
  "evidenceIds": z3.array(EntityIdSchema),
  "semanticHash": ContentHashSchema
}));
var RepresentationStyleRuleSchema = z3.lazy(() => strictObject({
  "key": z3.string(),
  "kind": z3.union([z3.literal("terminology"), z3.literal("sentence-structure"), z3.literal("active-voice"), z3.literal("condition-order"), z3.literal("scenario-structure"), z3.literal("paragraph-structure"), z3.literal("word-choice"), z3.literal("punctuation"), z3.literal("abbreviation"), z3.literal("narration"), z3.literal("filler-removal"), z3.literal("token-optimization"), z3.literal("literal-preservation")]),
  "parameters": z3.record(z3.string(), JsonValueSchema),
  "blocking": z3.boolean()
}));
var SemanticRepresentationProfileSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z3.string(),
  "version": z3.string(),
  "status": z3.union([z3.literal("active"), z3.literal("deprecated"), z3.literal("retired")]),
  "target": RepresentationTargetSchema,
  "selector": SelectorExprSchema,
  "optimization": z3.union([z3.literal("clarity-first"), z3.literal("token-first"), z3.literal("machine-first")]),
  "protectedDimensions": z3.array(PreservationDimensionSchema),
  "styleRules": z3.array(RepresentationStyleRuleSchema),
  "generatorId": z3.string(),
  "validatorIds": z3.array(z3.string()),
  "tokenizerProfileId": z3.string().optional(),
  "fallbackProfileId": EntityIdSchema.optional(),
  "semanticHash": ContentHashSchema
}));
var RepresentationTokenAccountingSchema = z3.lazy(() => strictObject({
  "sourceTokens": z3.number().finite().optional(),
  "outputTokens": z3.number().finite().optional(),
  "profileOverheadTokens": z3.number().finite().optional(),
  "estimatedNetTokens": z3.number().finite().optional(),
  "tokenizerProfileId": z3.string().optional(),
  "estimatedNetInstructionEfficiency": z3.number().finite().optional(),
  "utilityProfileId": z3.string().optional(),
  "utilityEvidence": z3.string().optional()
}));
var RepresentationProjectionSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "profileId": EntityIdSchema,
  "profileVersion": z3.string(),
  "target": RepresentationTargetSchema,
  "sourceEntityIds": z3.array(EntityIdSchema),
  "sourceSemanticHash": ContentHashSchema,
  "boundState": StateBindingSchema,
  "contentHash": ContentHashSchema,
  "preservation": SemanticPreservationFingerprintSchema,
  "tokenAccounting": RepresentationTokenAccountingSchema.optional(),
  "status": z3.union([z3.literal("valid"), z3.literal("suspect"), z3.literal("invalid"), z3.literal("fallback-used")]),
  "validatorResults": z3.array(ValidationResultSchema),
  "semanticHash": ContentHashSchema
}));
var RepresentationProjectionRefSchema = z3.lazy(() => strictObject({
  "projectionId": EntityIdSchema,
  "profileId": EntityIdSchema,
  "profileVersion": z3.string(),
  "contentHash": ContentHashSchema,
  "preservationHash": ContentHashSchema
}));
var StateDigestSchema = z3.lazy(() => strictObject({
  "gitBase": z3.string(),
  "worktreeDigest": ContentHashSchema,
  "canonicalProjectorDigest": ContentHashSchema,
  "toolchainDigest": ContentHashSchema,
  "pinnedExternalSnapshotDigest": ContentHashSchema.optional()
}));
var StateValueDependencyKindSchema = z3.lazy(() => z3.union([z3.literal("canonical-entity"), z3.literal("canonical-governance"), z3.literal("projection-unit"), z3.literal("artifact"), z3.literal("toolchain"), z3.literal("adapter"), z3.literal("signature-profile"), z3.literal("representation-profile"), z3.literal("external-snapshot")]));
var StateValueDependencyRefSchema = z3.lazy(() => strictObject({
  "kind": StateValueDependencyKindSchema,
  "id": z3.union([EntityIdSchema, z3.string()]),
  "versionHash": ContentHashSchema,
  "role": z3.string()
}));
var StateQueryKindSchema = z3.lazy(() => z3.union([z3.literal("semantic-identity-search"), z3.literal("relation-neighborhood"), z3.literal("reverse-derivation"), z3.literal("selector-membership"), z3.literal("impact-rule-applicability"), z3.literal("decision-applicability"), z3.literal("implementation-binding"), z3.literal("event-topology"), z3.literal("contract-topology"), z3.literal("verification-binding"), z3.literal("package-dependency"), z3.literal("surface-enumeration"), z3.literal("custom")]));
var StateQuerySpecSchema = z3.lazy(() => strictObject({
  "id": z3.string(),
  "kind": StateQueryKindSchema,
  "programId": z3.string(),
  "programVersion": z3.string(),
  "input": z3.record(z3.string(), JsonValueSchema),
  "semanticHash": ContentHashSchema
}));
var StateQueryResultFingerprintSchema = z3.lazy(() => strictObject({
  "queryHash": ContentHashSchema,
  "resultHash": ContentHashSchema,
  "resultCount": z3.number().finite(),
  "observability": ObservabilityClassSchema,
  "assumptions": z3.array(z3.string()),
  "unavailableLanes": z3.array(z3.string()),
  "dependencyKeys": z3.array(z3.string())
}));
var StateQueryDependencySchema = z3.lazy(() => strictObject({
  "query": StateQuerySpecSchema,
  "priorResult": StateQueryResultFingerprintSchema,
  "role": z3.string()
}));
var StateBindingSchema = z3.lazy(() => strictObject({
  "compiledAgainst": StateDigestSchema,
  "valueDependencies": z3.array(StateValueDependencyRefSchema),
  "queryDependencies": z3.array(StateQueryDependencySchema),
  "dependencyDigest": ContentHashSchema
}));
var StateBindingValidationSchema = z3.lazy(() => strictObject({
  "status": z3.union([z3.literal("current"), z3.literal("rebound"), z3.literal("stale"), z3.literal("suspect"), z3.literal("unavailable")]),
  "currentState": StateDigestSchema,
  "changedValueDependencyIds": z3.array(z3.union([EntityIdSchema, z3.string()])),
  "changedQueryDependencyIds": z3.array(z3.string()),
  "reasons": z3.array(z3.string()),
  "rebound": StateBindingSchema.optional(),
  "observations": z3.array(StateDependencyObservationSchema).optional()
}));
var StateDependencyObservationSchema = z3.lazy(() => z3.union([strictObject({
  "kind": z3.literal("value"),
  "dependency": StateValueDependencyRefSchema,
  "status": z3.union([z3.literal("current"), z3.literal("stale"), z3.literal("unknown")]),
  "basis": z3.union([z3.literal("same-snapshot"), z3.literal("observed")]),
  "currentVersionHash": ContentHashSchema.optional(),
  "reason": z3.string()
}), strictObject({
  "kind": z3.literal("query"),
  "dependency": StateQueryDependencySchema,
  "status": z3.union([z3.literal("current"), z3.literal("stale"), z3.literal("unknown")]),
  "basis": z3.union([z3.literal("same-snapshot"), z3.literal("unchanged-dependency-keys"), z3.literal("evaluated"), z3.literal("unavailable")]),
  "currentResult": StateQueryResultFingerprintSchema.optional(),
  "reason": z3.string()
})]));
var ValidationResultSchema = z3.lazy(() => strictObject({
  "validatorId": z3.string(),
  "status": z3.union([z3.literal("passed"), z3.literal("failed"), z3.literal("skipped"), z3.literal("blocked")]),
  "summary": z3.string(),
  "evidenceIds": z3.array(EntityIdSchema),
  "evidenceLane": z3.union([z3.literal("compiler"), z3.literal("test"), z3.literal("schema"), z3.literal("runtime"), z3.literal("property"), z3.literal("representation"), z3.literal("architecture"), z3.literal("historical"), z3.literal("human"), z3.literal("independent-agent"), z3.literal("same-packet-agent")]),
  "independenceGroup": z3.string(),
  "assurance": z3.union([z3.literal("weak"), z3.literal("supporting"), z3.literal("strong"), z3.literal("exact")]),
  "authorSource": z3.string(),
  "sideEffectClass": z3.union([z3.literal("none"), z3.literal("read-only"), z3.literal("workspace-write"), z3.literal("external-write")]),
  "details": z3.record(z3.string(), JsonValueSchema),
  "startedAt": z3.string(),
  "completedAt": z3.string()
}));
var RollbackSpecSchema = z3.lazy(() => strictObject({
  "kind": z3.union([z3.literal("git-checkpoint"), z3.literal("inverse-transform"), z3.literal("compensation"), z3.literal("manual"), z3.literal("none")]),
  "checkpointId": z3.string().optional(),
  "transformId": z3.string().optional(),
  "instructions": z3.string().optional()
}));
var OperationEvidenceSchema = z3.lazy(() => strictObject({
  "operationId": z3.string(),
  "executor": z3.union([z3.literal("transform"), z3.literal("agent"), z3.literal("manual"), z3.literal("external")]),
  "unitIds": z3.array(EntityIdSchema),
  "beforeHashes": z3.array(ContentHashSchema),
  "afterHashes": z3.array(ContentHashSchema),
  "evidenceIds": z3.array(EntityIdSchema),
  "summary": z3.string()
}));
var AnalyzerCapabilitiesSchema = z3.lazy(() => strictObject({
  "analyzerId": z3.string(),
  "adapterVersion": z3.string(),
  "supportedLanguages": z3.array(z3.string()),
  "supportedSemantics": z3.array(z3.string()),
  "enumeration": EnumerationContractSchema,
  "executesRepositoryCode": z3.boolean()
}));
var AnalyzerFailureSchema = z3.lazy(() => strictObject({
  "analyzerId": z3.string(),
  "capability": z3.string(),
  "scope": z3.string(),
  "message": z3.string(),
  "recoverable": z3.boolean(),
  "affectedClaimKinds": z3.array(z3.string())
}));
var ArtifactFingerprintSchema = z3.lazy(() => strictObject({
  "contentHash": ContentHashSchema,
  "structuralSignature": SemanticSignatureSchema.optional(),
  "semanticSignature": SemanticSignatureSchema.optional(),
  "adapterVersion": z3.string()
}));
var TransformPreviewSchema = z3.lazy(() => strictObject({
  "applicable": z3.boolean(),
  "operations": z3.array(z3.record(z3.string(), JsonValueSchema)),
  "touchedUnitIds": z3.array(EntityIdSchema),
  "expectedDiff": z3.string(),
  "warnings": z3.array(z3.string())
}));
var TransformResultSchema = z3.lazy(() => strictObject({
  "transformId": z3.string(),
  "changed": z3.boolean(),
  "touchedUnitIds": z3.array(EntityIdSchema),
  "operations": z3.array(OperationEvidenceSchema),
  "checkpointId": z3.string().optional()
}));
var SurfaceChangeSchema = z3.lazy(() => strictObject({
  "semanticChangeId": EntityIdSchema,
  "surfaceId": EntityIdSchema,
  "operation": z3.string(),
  "payload": z3.record(z3.string(), JsonValueSchema)
}));
var SurfacePlanSchema = z3.lazy(() => strictObject({
  "adapterId": z3.string(),
  "surfaceId": EntityIdSchema,
  "riskClass": RiskClassSchema,
  "operations": z3.array(z3.record(z3.string(), JsonValueSchema)),
  "requiredApprovals": z3.array(z3.string()),
  "validatorIds": z3.array(z3.string()),
  "boundState": StateBindingSchema
}));
var SurfaceApplyResultSchema = z3.lazy(() => strictObject({
  "changed": z3.boolean(),
  "operationEvidence": z3.array(OperationEvidenceSchema),
  "externalReferences": z3.array(z3.string())
}));
var RecognizerBindingSchema = z3.lazy(() => strictObject({
  "id": z3.string(),
  "version": z3.string(),
  "adapterId": z3.string(),
  "query": z3.record(z3.string(), JsonValueSchema),
  "minimumConfidence": ConfidenceSchema
}));
var ValidatorBindingSchema = z3.lazy(() => strictObject({
  "id": z3.string(),
  "version": z3.string(),
  "provider": z3.string(),
  "input": z3.record(z3.string(), JsonValueSchema),
  "required": z3.boolean(),
  "requiredIndependenceGroup": z3.string().optional()
}));
var TransformBindingSchema = z3.lazy(() => strictObject({
  "id": z3.string(),
  "version": z3.string(),
  "input": z3.record(z3.string(), JsonValueSchema),
  "exclusiveUnitClaim": z3.boolean()
}));
var MigrationBindingSchema = z3.lazy(() => strictObject({
  "fromVersion": z3.string(),
  "toVersion": z3.string(),
  "transformIds": z3.array(z3.string()),
  "validationIds": z3.array(z3.string())
}));
var GovernanceExceptionSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z3.string(),
  "selector": SelectorExprSchema,
  "exceptedRuleIds": z3.array(EntityIdSchema),
  "exceptedLensIds": z3.array(EntityIdSchema),
  "exceptedExpectationIds": z3.array(EntityIdSchema),
  "rationale": z3.string(),
  "evidence": z3.array(EvidenceRefSchema),
  "owner": z3.string(),
  "reviewOrExpiryTrigger": AuthorityReconsiderTriggerSchema,
  "invalidationConditions": z3.array(AuthorityReconsiderTriggerSchema),
  "exitCriteria": z3.array(z3.string()).optional(),
  "status": z3.union([z3.literal("active"), z3.literal("expired"), z3.literal("revoked")]),
  "semanticHash": ContentHashSchema
}));
var MigrationOverlaySchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z3.string(),
  "sourceLensRef": LensRefSchema,
  "targetLensRef": LensRefSchema,
  "phase": z3.union([z3.literal("proposed"), z3.literal("prepared"), z3.literal("dual-running"), z3.literal("cutover"), z3.literal("cleanup"), z3.literal("complete"), z3.literal("rolled-back")]),
  "entryCriteria": z3.array(z3.string()),
  "exitCriteria": z3.array(z3.string()),
  "compatibilityStrategy": z3.string(),
  "allowedTemporaryDivergenceIds": z3.array(EntityIdSchema),
  "generatedOutputOverlays": z3.array(z3.string()).optional(),
  "validationObligations": z3.array(z3.string()),
  "rollbackPlan": z3.string(),
  "compensationPlan": z3.string().optional(),
  "cleanupResidueDetector": z3.string(),
  "semanticHash": ContentHashSchema
}));
var LensExampleSchema = z3.lazy(() => strictObject({
  "unitId": EntityIdSchema.optional(),
  "artifactLocator": z3.string().optional(),
  "explanation": z3.string(),
  "evidenceIds": z3.array(EntityIdSchema)
}));
var AuthorityAlternativeSchema = z3.lazy(() => strictObject({
  "key": z3.string(),
  "description": z3.string(),
  "advantages": z3.array(z3.string()),
  "disadvantages": z3.array(z3.string()),
  "rejectedBecause": z3.array(z3.string()),
  "evidence": z3.array(EvidenceRefSchema)
}));
var ObservabilityClassSchema = z3.lazy(() => z3.union([z3.literal("closed"), z3.literal("bounded"), z3.literal("open"), z3.literal("sampled"), z3.literal("unavailable")]));
var EnumerationContractSchema = z3.lazy(() => strictObject({
  "observability": ObservabilityClassSchema,
  "method": z3.string(),
  "assumptions": z3.array(z3.string()),
  "blindSpots": z3.array(z3.string()),
  "dynamicMechanisms": z3.array(z3.string()),
  "freshnessRequirement": z3.string().optional()
}));
var SurfaceCapabilitiesSchema = z3.lazy(() => strictObject({
  "read": z3.boolean(),
  "write": z3.boolean(),
  "watch": z3.boolean(),
  "transactionalWrites": z3.boolean(),
  "stableAnchors": z3.boolean(),
  "humanApprovalRequired": z3.boolean()
}));
var SurfaceSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z3.string(),
  "kind": z3.union([z3.literal("repository"), z3.literal("ci"), z3.literal("cloud"), z3.literal("package-registry"), z3.literal("app-store"), z3.literal("website"), z3.literal("runtime"), z3.literal("database"), z3.literal("external")]),
  "adapter": z3.string(),
  "access": z3.union([z3.literal("read-write"), z3.literal("read-only"), z3.literal("declared-only"), z3.literal("unavailable")]),
  "enumeration": EnumerationContractSchema,
  "capabilities": SurfaceCapabilitiesSchema,
  "boundary": z3.record(z3.string(), JsonValueSchema)
}));
var ArtifactSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "surfaceId": EntityIdSchema,
  "locator": z3.string(),
  "mediaType": z3.string(),
  "contentHash": ContentHashSchema,
  "structuralSignature": SemanticSignatureSchema.optional(),
  "semanticSignature": SemanticSignatureSchema.optional(),
  "observedAt": z3.string(),
  "observationRevision": z3.string(),
  "causalOrigin": CausalOriginSchema,
  "metadata": z3.record(z3.string(), JsonValueSchema)
}));
var SemanticAnchorSchema = z3.lazy(() => strictObject({
  "kind": z3.union([z3.literal("file"), z3.literal("symbol"), z3.literal("ast-node"), z3.literal("json-pointer"), z3.literal("yaml-path"), z3.literal("markdown-section"), z3.literal("workflow-job"), z3.literal("resource-property"), z3.literal("external-field")]),
  "value": z3.string(),
  "fallbackSignature": SemanticSignatureSchema.optional()
}));
var ControlPolicySchema = z3.lazy(() => strictObject({
  "ownership": z3.union([z3.literal("exclusive"), z3.literal("structured"), z3.literal("shared"), z3.literal("observed")]),
  "mutation": z3.union([z3.literal("replace"), z3.literal("transform"), z3.literal("agent"), z3.literal("external"), z3.literal("none")]),
  "actuation": z3.union([z3.literal("automatic"), z3.literal("approval"), z3.literal("human"), z3.literal("unavailable")])
}));
var LensRefSchema = z3.lazy(() => strictObject({
  "lensId": EntityIdSchema,
  "version": z3.string(),
  "semanticHash": ContentHashSchema
}));
var ValidityStateSchema = z3.lazy(() => z3.union([z3.literal("valid"), z3.literal("suspect"), z3.literal("invalid"), z3.literal("revalidating"), z3.literal("repair-planned"), z3.literal("blocked"), z3.literal("unreachable")]));
var ProjectionUnitSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "artifactId": EntityIdSchema,
  "key": z3.string(),
  "role": z3.union([z3.literal("implementation"), z3.literal("contract"), z3.literal("test"), z3.literal("fixture"), z3.literal("documentation"), z3.literal("comment"), z3.literal("configuration"), z3.literal("deployment"), z3.literal("publication"), z3.literal("telemetry"), z3.literal("migration"), z3.literal("supporting")]),
  "anchor": SemanticAnchorSchema,
  "control": ControlPolicySchema,
  "conceptIds": z3.array(EntityIdSchema),
  "requirementIds": z3.array(EntityIdSchema),
  "scenarioIds": z3.array(EntityIdSchema),
  "lenses": z3.array(LensRefSchema),
  "tags": z3.array(z3.string()),
  "structuralSignature": SemanticSignatureSchema,
  "semanticSignature": SemanticSignatureSchema,
  "membershipHash": ContentHashSchema,
  "validity": ValidityStateSchema,
  "confidence": ConfidenceSchema,
  "causalOrigin": CausalOriginSchema,
  "generatedFromUnitIds": z3.array(EntityIdSchema)
}));
var EvidenceKindSchema = z3.lazy(() => z3.union([z3.literal("explicit-decision"), z3.literal("repository-structure"), z3.literal("code-relationship"), z3.literal("test"), z3.literal("documentation"), z3.literal("git-history"), z3.literal("runtime-observation"), z3.literal("build-output"), z3.literal("official-documentation"), z3.literal("standard"), z3.literal("research-paper"), z3.literal("reference-implementation"), z3.literal("issue-or-incident"), z3.literal("user-decision"), z3.literal("agent-inference")]));
var EvidenceClaimSchema = z3.lazy(() => strictObject({
  "subjectKey": z3.string(),
  "predicate": z3.string(),
  "object": JsonValueSchema,
  "inferenceConfidence": ConfidenceSchema.optional()
}));
var EvidenceSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "kind": EvidenceKindSchema,
  "locator": z3.string(),
  "capturedAt": z3.string(),
  "sourceDate": z3.string().optional(),
  "contentHash": ContentHashSchema,
  "excerpt": z3.string().optional(),
  "claims": z3.array(EvidenceClaimSchema),
  "reliability": z3.union([z3.literal("mechanically-proven"), z3.literal("high"), z3.literal("medium"), z3.literal("low"), z3.literal("untrusted")]),
  "normativeAuthority": z3.union([z3.literal("binding-decision"), z3.literal("hard-constraint"), z3.literal("authoritative-guidance"), z3.literal("supporting"), z3.literal("descriptive-only"), z3.literal("none")]),
  "independenceGroup": z3.string(),
  "applicability": z3.union([z3.literal("direct"), z3.literal("analogous"), z3.literal("contextual"), z3.literal("uncertain")]),
  "freshness": ConfidenceSchema,
  "causalOrigin": CausalOriginSchema,
  "metadata": z3.record(z3.string(), JsonValueSchema)
}));
var AuthorityVectorSchema = z3.lazy(() => strictObject({
  "explicitDecisionAlignment": z3.number().finite(),
  "productConstraintFit": z3.number().finite(),
  "semanticFit": z3.number().finite(),
  "independentOccurrence": z3.number().finite(),
  "historicalStability": z3.number().finite(),
  "independentValidationSupport": z3.number().finite(),
  "boundaryCoherence": z3.number().finite(),
  "maintenanceOutcome": z3.number().finite(),
  "platformCompatibility": z3.number().finite(),
  "externalRationale": z3.number().finite(),
  "ecosystemHealth": z3.number().finite(),
  "securitySupport": z3.number().finite(),
  "reversibility": z3.number().finite(),
  "migrationCost": z3.number().finite(),
  "counterEvidence": z3.number().finite()
}));
var AuthorityReconsiderTriggerSchema = z3.lazy(() => z3.union([strictObject({
  "type": z3.literal("concept-changed"),
  "conceptId": EntityIdSchema
}), strictObject({
  "type": z3.literal("requirement-changed"),
  "subjectId": z3.union([EntityIdSchema, z3.string()])
}), strictObject({
  "type": z3.literal("scenario-changed"),
  "scenarioId": EntityIdSchema
}), strictObject({
  "type": z3.literal("relation-changed"),
  "relationId": EntityIdSchema
}), strictObject({
  "type": z3.literal("constraint-changed"),
  "constraintId": EntityIdSchema
}), strictObject({
  "type": z3.literal("scope-expanded"),
  "scopeKey": z3.string()
}), strictObject({
  "type": z3.literal("surface-added"),
  "surfaceKind": z3.union([z3.literal("repository"), z3.literal("ci"), z3.literal("cloud"), z3.literal("package-registry"), z3.literal("app-store"), z3.literal("website"), z3.literal("runtime"), z3.literal("database"), z3.literal("external")])
}), strictObject({
  "type": z3.literal("assumption-falsified"),
  "assumptionKey": z3.string()
}), strictObject({
  "type": z3.literal("lens-changed"),
  "lensId": EntityIdSchema
}), strictObject({
  "type": z3.literal("evidence-invalidated"),
  "evidenceId": EntityIdSchema
}), strictObject({
  "type": z3.literal("evidence-refresh-required"),
  "policyKey": z3.string()
}), strictObject({
  "type": z3.literal("toolchain-version"),
  "tool": z3.string(),
  "constraint": z3.string()
}), strictObject({
  "type": z3.literal("platform-version"),
  "platform": z3.string(),
  "constraint": z3.string()
}), strictObject({
  "type": z3.literal("project-preference-changed"),
  "preferenceId": EntityIdSchema
}), strictObject({
  "type": z3.literal("counterevidence-threshold"),
  "subjectId": EntityIdSchema,
  "threshold": z3.number().finite()
}), strictObject({
  "type": z3.literal("date"),
  "at": z3.string()
}), strictObject({
  "type": z3.literal("manual-review")
})]));
var EvidenceRefreshPolicySchema = z3.lazy(() => strictObject({
  "key": z3.string(),
  "mode": z3.union([z3.literal("on-trigger"), z3.literal("version-sensitive"), z3.literal("max-age"), z3.literal("manual")]),
  "maxAgeDays": z3.number().finite().optional(),
  "trackedTechnologies": z3.array(z3.string()).optional(),
  "requireOfficialSourceWhenAvailable": z3.boolean()
}));
var AuthorityRecordSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z3.string(),
  "subjectId": EntityIdSchema,
  "status": z3.union([z3.literal("provisional"), z3.literal("approved"), z3.literal("auto-approved"), z3.literal("rejected"), z3.literal("superseded")]),
  "conclusion": z3.union([z3.literal("preserve"), z3.literal("normalize"), z3.literal("migrate"), z3.literal("exception"), z3.literal("unknown")]),
  "rationale": z3.string(),
  "alternatives": z3.array(AuthorityAlternativeSchema),
  "assumptions": z3.array(z3.string()),
  "reconsiderWhen": z3.array(AuthorityReconsiderTriggerSchema),
  "evidenceRefreshPolicy": EvidenceRefreshPolicySchema.optional(),
  "vector": AuthorityVectorSchema,
  "assessmentConfidence": z3.union([z3.literal("low"), z3.literal("medium"), z3.literal("high")]),
  "evidence": z3.array(EvidenceRefSchema),
  "governanceRiskClass": RiskClassSchema,
  "decidedBy": z3.union([z3.literal("system"), z3.literal("user"), z3.literal("policy")]),
  "createdAt": z3.string(),
  "semanticHash": ContentHashSchema
}));
var SemanticIdentityCandidateSchema = z3.lazy(() => strictObject({
  "entityId": EntityIdSchema,
  "entityKind": z3.union([z3.literal("concept"), z3.literal("requirement"), z3.literal("scenario")]),
  "similarity": ConfidenceSchema,
  "ownershipFit": ConfidenceSchema,
  "boundaryFit": ConfidenceSchema,
  "evidence": z3.array(EvidenceRefSchema),
  "explanation": z3.string()
}));
var NewSemanticBoundarySchema = z3.lazy(() => strictObject({
  "owns": z3.array(z3.string()),
  "excludes": z3.array(z3.string()),
  "nearestEntityIds": z3.array(EntityIdSchema),
  "rationale": z3.string()
}));
var SemanticIdentityResolutionSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "requestedMeaning": z3.string(),
  "requestedKind": z3.union([z3.literal("concept"), z3.literal("requirement"), z3.literal("scenario"), z3.literal("unknown")]),
  "outcome": z3.union([z3.literal("reuse-existing"), z3.literal("coordinated-modification"), z3.literal("split-existing"), z3.literal("merge-existing"), z3.literal("replace-existing"), z3.literal("create-new"), z3.literal("no-durable-entity"), z3.literal("unresolved")]),
  "candidates": z3.array(SemanticIdentityCandidateSchema),
  "selectedEntityIds": z3.array(EntityIdSchema),
  "newBoundary": NewSemanticBoundarySchema.optional(),
  "confidence": ConfidenceSchema,
  "evidence": z3.array(EvidenceRefSchema),
  "unknowns": z3.array(z3.string()),
  "boundState": StateBindingSchema,
  "contentHash": ContentHashSchema
}));
var RelevanceBandSchema = z3.lazy(() => z3.union([z3.literal("direct"), z3.literal("governing"), z3.literal("consequence"), z3.literal("possible")]));
var RelevanceSeedSchema = z3.lazy(() => strictObject({
  "kind": z3.union([z3.literal("request-term"), z3.literal("semantic-entity"), z3.literal("projection-unit"), z3.literal("artifact"), z3.literal("code-symbol"), z3.literal("contract"), z3.literal("event"), z3.literal("decision"), z3.literal("manual")]),
  "subjectId": z3.union([EntityIdSchema, z3.string()]).optional(),
  "value": z3.string().optional(),
  "reason": z3.string(),
  "confidence": ConfidenceSchema
}));
var RelevanceReasonSchema = z3.lazy(() => strictObject({
  "kind": z3.union([z3.literal("explicit"), z3.literal("identity-match"), z3.literal("governs"), z3.literal("constrains"), z3.literal("depends-on"), z3.literal("implementation-binding"), z3.literal("selector-applicability"), z3.literal("event-producer-consumer"), z3.literal("contract-producer-consumer"), z3.literal("verification-binding"), z3.literal("package-dependency"), z3.literal("historical-cochange"), z3.literal("semantic-similarity"), z3.literal("model-inference"), z3.literal("analysis-facet"), z3.literal("open-world-widening")]),
  "fromId": z3.union([EntityIdSchema, z3.string()]).optional(),
  "weight": z3.number().finite(),
  "provenance": z3.union([z3.literal("declared"), z3.literal("derived"), z3.literal("observed"), z3.literal("inferred")]),
  "confidence": ConfidenceSchema,
  "explanation": z3.string(),
  "evidenceIds": z3.array(EntityIdSchema)
}));
var RelevanceEntrySchema = z3.lazy(() => strictObject({
  "entityId": EntityIdSchema,
  "band": RelevanceBandSchema,
  "score": z3.number().finite(),
  "requiredForPlanning": z3.boolean(),
  "reasons": z3.array(RelevanceReasonSchema)
}));
var RelevanceClosureSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "requestHash": ContentHashSchema,
  "seeds": z3.array(RelevanceSeedSchema),
  "entries": z3.array(RelevanceEntrySchema),
  "activatedFacetKeys": z3.array(z3.string()),
  "unknowns": z3.array(z3.string()),
  "unavailableLanes": z3.array(z3.string()),
  "boundState": StateBindingSchema,
  "contentHash": ContentHashSchema
}));
var AnalysisFacetSchema = z3.lazy(() => strictObject({
  "key": z3.string(),
  "version": z3.string(),
  "selector": SelectorExprSchema,
  "questionKeys": z3.array(z3.string()),
  "relevanceRuleIds": z3.array(z3.string()),
  "requiredEvidenceLanes": z3.array(z3.union([z3.literal("compiler"), z3.literal("test"), z3.literal("schema"), z3.literal("runtime"), z3.literal("property"), z3.literal("representation"), z3.literal("architecture"), z3.literal("historical"), z3.literal("human"), z3.literal("independent-agent"), z3.literal("same-packet-agent")])),
  "outputKinds": z3.array(z3.string())
}));
var PlanningSurpriseSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "planId": EntityIdSchema,
  "kind": z3.union([z3.literal("unpredicted-semantic-impact"), z3.literal("unpredicted-code-impact"), z3.literal("missing-relation"), z3.literal("scope-expansion"), z3.literal("agent-overreach"), z3.literal("benign-discovery")]),
  "predictedEntityIds": z3.array(EntityIdSchema),
  "observedEntityIds": z3.array(EntityIdSchema),
  "unexpectedEntityIds": z3.array(EntityIdSchema),
  "evidence": z3.array(EvidenceRefSchema),
  "explanation": z3.string(),
  "disposition": z3.union([z3.literal("accept-and-learn"), z3.literal("accept-no-model-change"), z3.literal("repair-plan"), z3.literal("revert-overreach"), z3.literal("human-decision"), z3.literal("unresolved")]),
  "proposedRelationIds": z3.array(EntityIdSchema),
  "contentHash": ContentHashSchema
}));
var RiskClassSchema = z3.lazy(() => z3.union([z3.literal("R0"), z3.literal("R1"), z3.literal("R2"), z3.literal("R3"), z3.literal("R4")]));
var RiskAssessmentSchema = z3.lazy(() => strictObject({
  "class": RiskClassSchema,
  "inherentOperationRisk": z3.number().finite(),
  "affectedUnitCount": z3.number().finite(),
  "affectedSurfaceCount": z3.number().finite(),
  "publicContractImpact": z3.boolean(),
  "externalImpact": z3.boolean(),
  "dataImpact": z3.boolean(),
  "reversibility": z3.union([z3.literal("full"), z3.literal("strong"), z3.literal("partial"), z3.literal("none")]),
  "validationStrength": z3.union([z3.literal("weak"), z3.literal("supporting"), z3.literal("strong"), z3.literal("exact")]),
  "closureConfidence": z3.union([z3.literal("proven"), z3.literal("bounded"), z3.literal("high"), z3.literal("partial"), z3.literal("unknown")]),
  "unresolvedIdentityCount": z3.number().finite(),
  "relevanceFrontierCount": z3.number().finite(),
  "openWorldDependencies": z3.boolean(),
  "unresolvedBlockingConcernCount": z3.number().finite(),
  "suspectDecisionCount": z3.number().finite(),
  "compensationAvailable": z3.boolean(),
  "reasons": z3.array(z3.string())
}));
var ExecutionPolicySchema = z3.lazy(() => strictObject({
  "preset": z3.union([z3.literal("observe"), z3.literal("guide"), z3.literal("govern"), z3.literal("autonomous"), z3.literal("salvage")]),
  "maximumAutomaticRisk": RiskClassSchema,
  "network": z3.union([z3.literal("deny"), z3.literal("ask"), z3.literal("allow")]),
  "externalWrites": z3.union([z3.literal("deny"), z3.literal("approval"), z3.literal("allow-with-capability")]),
  "requireIndependentValidationAtOrAbove": RiskClassSchema,
  "requireWorktreeAtOrAbove": RiskClassSchema,
  "allowAutoPromotion": z3.boolean(),
  "allowAutoMutation": z3.boolean(),
  "maxChangedUnits": z3.number().finite().optional(),
  "maxChangedSurfaces": z3.number().finite().optional(),
  "maxCost": z3.number().finite().optional(),
  "maxTokens": z3.number().finite().optional()
}));
var PatternCandidateSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z3.string(),
  "purposeHypothesis": z3.string(),
  "memberUnitIds": z3.array(EntityIdSchema),
  "excludedUnitIds": z3.array(EntityIdSchema),
  "counterExamples": z3.array(EntityIdSchema),
  "independenceGroups": z3.array(z3.string()),
  "alternatives": z3.array(z3.string()),
  "confidence": ConfidenceSchema,
  "evidence": z3.array(EvidenceRefSchema),
  "semanticHash": ContentHashSchema
}));
var LensContributionRoleSchema = z3.lazy(() => z3.union([z3.literal("projection-owner"), z3.literal("constraint-contributor"), z3.literal("validator-contributor"), z3.literal("migration-overlay")]));
var ProjectionExpectationSchema = z3.lazy(() => z3.union([strictObject({
  "kind": z3.literal("exact-output"),
  "generatorId": z3.string(),
  "expectedSignatureProfile": z3.string()
}), strictObject({
  "kind": z3.literal("structured-template"),
  "structureValidatorId": z3.string(),
  "authoredHoles": z3.array(z3.string())
}), strictObject({
  "kind": z3.literal("predicate-constrained"),
  "predicateIds": z3.array(z3.string()),
  "validatorIds": z3.array(z3.string())
}), strictObject({
  "kind": z3.literal("observed-state"),
  "comparisonPolicyId": z3.string()
}), strictObject({
  "kind": z3.literal("human-procedure"),
  "procedureId": z3.string(),
  "evidenceRequirements": z3.array(z3.string())
})]));
var ProjectionSpecSchema = z3.lazy(() => strictObject({
  "role": z3.union([z3.literal("implementation"), z3.literal("contract"), z3.literal("test"), z3.literal("fixture"), z3.literal("documentation"), z3.literal("comment"), z3.literal("configuration"), z3.literal("deployment"), z3.literal("publication"), z3.literal("telemetry"), z3.literal("migration"), z3.literal("supporting")]),
  "cardinality": z3.union([z3.literal("one"), z3.literal("zero-or-one"), z3.literal("many"), z3.literal("at-least-one")]),
  "surfaceKind": z3.union([z3.literal("repository"), z3.literal("ci"), z3.literal("cloud"), z3.literal("package-registry"), z3.literal("app-store"), z3.literal("website"), z3.literal("runtime"), z3.literal("database"), z3.literal("external")]),
  "selector": SelectorExprSchema,
  "control": ControlPolicySchema,
  "expectation": ProjectionExpectationSchema
}));
var ProjectionLensSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z3.string(),
  "version": z3.string(),
  "status": z3.union([z3.literal("candidate"), z3.literal("shadow"), z3.literal("active"), z3.literal("deprecated"), z3.literal("retired")]),
  "purpose": z3.string(),
  "realizesConceptKinds": z3.array(z3.union([z3.literal("capability"), z3.literal("behavior"), z3.literal("invariant"), z3.literal("decision"), z3.literal("ownership"), z3.literal("obligation"), z3.literal("data"), z3.literal("interface"), z3.literal("event"), z3.literal("command"), z3.literal("policy"), z3.literal("read-model"), z3.literal("contract"), z3.literal("assumption"), z3.literal("migration"), z3.literal("constraint")])),
  "selector": SelectorExprSchema,
  "contributions": z3.array(LensContributionRoleSchema),
  "expectedProjections": z3.array(ProjectionSpecSchema),
  "rules": z3.array(RuleSchema),
  "impactRules": z3.array(ImpactRuleSchema),
  "recognizers": z3.array(RecognizerBindingSchema),
  "validators": z3.array(ValidatorBindingSchema),
  "transforms": z3.array(TransformBindingSchema),
  "migrations": z3.array(MigrationBindingSchema),
  "conflictsWith": z3.array(LensRefSchema),
  "compatibleWith": z3.array(LensRefSchema),
  "examples": z3.array(LensExampleSchema),
  "counterExamples": z3.array(LensExampleSchema),
  "authorityRecordId": EntityIdSchema,
  "governanceBasis": z3.array(GovernanceBasisSchema),
  "semanticHash": ContentHashSchema
}));
var SelectorExprSchema = z3.lazy(() => z3.union([strictObject({
  "op": z3.literal("all"),
  "items": z3.array(SelectorExprSchema)
}), strictObject({
  "op": z3.literal("any"),
  "items": z3.array(SelectorExprSchema)
}), strictObject({
  "op": z3.literal("not"),
  "item": SelectorExprSchema
}), strictObject({
  "op": z3.literal("atom"),
  "field": z3.union([z3.literal("path"), z3.literal("language"), z3.literal("artifact-role"), z3.literal("concept"), z3.literal("concept-kind"), z3.literal("requirement"), z3.literal("scenario"), z3.literal("lens"), z3.literal("surface"), z3.literal("package"), z3.literal("package-kind"), z3.literal("operation"), z3.literal("platform"), z3.literal("migration-phase"), z3.literal("risk"), z3.literal("tag"), z3.literal("control-ownership"), z3.literal("control-mutation"), z3.literal("ast-pattern"), z3.literal("relation"), z3.literal("causal-origin")]),
  "matcher": z3.union([z3.literal("equals"), z3.literal("in"), z3.literal("glob"), z3.literal("regex"), z3.literal("contains"), z3.literal("exists"), z3.literal("matches-structural-query")]),
  "value": JsonValueSchema
})]));
var RealizationSelectorExprSchema = z3.lazy(() => z3.union([strictObject({
  "op": z3.literal("all"),
  "items": z3.array(RealizationSelectorExprSchema)
}), strictObject({
  "op": z3.literal("any"),
  "items": z3.array(RealizationSelectorExprSchema)
}), strictObject({
  "op": z3.literal("not"),
  "item": RealizationSelectorExprSchema
}), strictObject({
  "op": z3.literal("atom"),
  "field": z3.union([z3.literal("path"), z3.literal("artifact-role"), z3.literal("surface"), z3.literal("package"), z3.literal("package-kind"), z3.literal("tag"), z3.literal("control-ownership"), z3.literal("control-mutation"), z3.literal("causal-origin")]),
  "matcher": z3.union([z3.literal("equals"), z3.literal("in"), z3.literal("glob"), z3.literal("regex"), z3.literal("contains"), z3.literal("exists"), z3.literal("matches-structural-query")]),
  "value": JsonValueSchema
})]));
var IgnorePolicySchema = z3.lazy(() => strictObject({
  "inventory": z3.array(SelectorExprSchema),
  "inferenceAuthority": z3.array(SelectorExprSchema),
  "mutation": z3.array(SelectorExprSchema),
  "reporting": z3.array(SelectorExprSchema),
  "modelContext": z3.array(SelectorExprSchema),
  "coverageDenominator": z3.array(SelectorExprSchema)
}));
var RuleEffectSchema = z3.lazy(() => z3.union([z3.literal("require"), z3.literal("forbid"), z3.literal("prefer"), z3.literal("validate"), z3.literal("transform"), z3.literal("route"), z3.literal("grant"), z3.literal("restrict"), z3.literal("explain")]));
var AuthorityClassSchema = z3.lazy(() => z3.union([z3.literal("host-safety"), z3.literal("platform-constraint"), z3.literal("approved-user-intent"), z3.literal("active-lens"), z3.literal("adopted-external-standard"), z3.literal("migration-overlay"), z3.literal("local-convention"), z3.literal("inferred-candidate"), z3.literal("task-suggestion")]));
var NormalizedPredicateSchema = z3.lazy(() => z3.union([strictObject({
  "kind": z3.literal("path-under"),
  "root": z3.string()
}), strictObject({
  "kind": z3.literal("path-not-under"),
  "root": z3.string()
}), strictObject({
  "kind": z3.literal("relation-required"),
  "relation": RelationTypeSchema,
  "targetSelector": SelectorExprSchema
}), strictObject({
  "kind": z3.literal("relation-forbidden"),
  "relation": RelationTypeSchema,
  "targetSelector": SelectorExprSchema
}), strictObject({
  "kind": z3.literal("cardinality"),
  "selector": SelectorExprSchema,
  "min": z3.number().finite().optional(),
  "max": z3.number().finite().optional()
}), strictObject({
  "kind": z3.literal("dependency-allowed"),
  "from": SelectorExprSchema,
  "to": SelectorExprSchema
}), strictObject({
  "kind": z3.literal("dependency-forbidden"),
  "from": SelectorExprSchema,
  "to": SelectorExprSchema
}), strictObject({
  "kind": z3.literal("permission"),
  "operation": z3.string(),
  "allowed": z3.boolean()
}), strictObject({
  "kind": z3.literal("unit-state"),
  "state": ValidityStateSchema
}), strictObject({
  "kind": z3.literal("schema-valid"),
  "schemaId": z3.string()
}), strictObject({
  "kind": z3.literal("validator"),
  "validatorId": z3.string()
})]));
var RuleSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z3.string(),
  "version": z3.string(),
  "effect": RuleEffectSchema,
  "authorityClass": AuthorityClassSchema,
  "governanceBasis": z3.array(GovernanceBasisSchema),
  "selector": SelectorExprSchema,
  "predicates": z3.array(NormalizedPredicateSchema),
  "advisoryPayload": z3.record(z3.string(), JsonValueSchema).optional(),
  "rationale": z3.string(),
  "evidence": z3.array(EvidenceRefSchema),
  "conflictPolicy": z3.union([z3.literal("error"), z3.literal("merge"), z3.literal("higher-authority"), z3.literal("explicit-exception-only")]),
  "validatorIds": z3.array(z3.string()),
  "transformIds": z3.array(z3.string()),
  "semanticHash": ContentHashSchema
}));
var RuleConflictSchema = z3.lazy(() => strictObject({
  "ruleIds": z3.array(EntityIdSchema),
  "unitId": EntityIdSchema,
  "kind": z3.union([z3.literal("require-forbid"), z3.literal("exclusive-transform"), z3.literal("authority-override"), z3.literal("ambiguous-selector"), z3.literal("incompatible-predicate")]),
  "explanation": z3.string(),
  "evidenceIds": z3.array(EntityIdSchema)
}));
var EffectiveRuleBundleSchema = z3.lazy(() => strictObject({
  "unitId": EntityIdSchema,
  "operation": z3.string(),
  "rules": z3.array(RuleSchema),
  "suppressedRules": z3.array(strictObject({
    "ruleId": EntityIdSchema,
    "reason": z3.string(),
    "supersededBy": EntityIdSchema.optional()
  })),
  "predicates": z3.array(NormalizedPredicateSchema),
  "conflicts": z3.array(RuleConflictSchema),
  "dependencyFingerprint": ContentHashSchema,
  "bundleHash": ContentHashSchema
}));
var DerivationInputSchema = z3.lazy(() => strictObject({
  "kind": z3.union([z3.literal("concept"), z3.literal("requirement"), z3.literal("scenario"), z3.literal("relation"), z3.literal("lens"), z3.literal("rule-bundle"), z3.literal("unit"), z3.literal("artifact"), z3.literal("external-constraint"), z3.literal("toolchain"), z3.literal("adapter"), z3.literal("signature-profile"), z3.literal("representation-profile"), z3.literal("representation-projection")]),
  "id": z3.union([EntityIdSchema, z3.string()]),
  "versionHash": ContentHashSchema,
  "role": z3.string()
}));
var DerivationRecordSchema = z3.lazy(() => strictObject({
  "unitId": EntityIdSchema,
  "proofGroupId": EntityIdSchema.optional(),
  "engineVersion": z3.string(),
  "adapterVersion": z3.string(),
  "inputs": z3.array(DerivationInputSchema),
  "ruleBundleHash": ContentHashSchema,
  "outputSemanticSignature": SemanticSignatureSchema,
  "outputStructuralSignature": SemanticSignatureSchema,
  "membershipHash": ContentHashSchema,
  "establishedAt": z3.string(),
  "validators": z3.array(ValidationResultSchema)
}));
var ImpactRuleSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "key": z3.string(),
  "version": z3.string(),
  "selector": SelectorExprSchema,
  "trigger": z3.union([z3.literal("concept-change"), z3.literal("interface-change"), z3.literal("membership-change"), z3.literal("removal"), z3.literal("lens-change"), z3.literal("rule-change"), z3.literal("decision-change"), z3.literal("concern-resolution"), z3.literal("representation-profile-change"), z3.literal("external-change"), z3.literal("manual")]),
  "direction": z3.union([z3.literal("forward"), z3.literal("reverse"), z3.literal("both")]),
  "relationTypes": z3.array(RelationTypeSchema).optional(),
  "maxDepth": z3.number().finite().optional(),
  "effect": z3.union([z3.literal("invalidate"), z3.literal("revalidate"), z3.literal("widen-analysis"), z3.literal("advisory"), z3.literal("block")]),
  "requiredRelationConfidence": z3.number().finite().optional(),
  "semanticHash": ContentHashSchema
}));
var InvalidationCauseSchema = z3.lazy(() => strictObject({
  "eventKind": z3.string(),
  "subjectId": z3.union([EntityIdSchema, z3.string()]),
  "oldHash": ContentHashSchema.optional(),
  "newHash": ContentHashSchema.optional()
}));
var InvalidationEventSchema = z3.lazy(() => strictObject({
  "eventKind": z3.string(),
  "subjectId": z3.union([EntityIdSchema, z3.string()]),
  "oldHash": ContentHashSchema.optional(),
  "newHash": ContentHashSchema.optional(),
  "graphRevision": z3.number().finite(),
  "stateDigest": StateDigestSchema
}));
var InvalidationResultSchema = z3.lazy(() => strictObject({
  "directlyAffected": z3.array(EntityIdSchema),
  "transitivelyAffected": z3.array(EntityIdSchema),
  "possibleFrontier": z3.array(EntityIdSchema),
  "unavailable": z3.array(EntityIdSchema),
  "reasons": z3.record(EntityIdSchema, z3.array(z3.string()))
}));
var RepairStrategySchema = z3.lazy(() => z3.union([z3.literal("reuse"), z3.literal("revalidate"), z3.literal("deterministic-patch"), z3.literal("regenerate"), z3.literal("agent-repair"), z3.literal("widen-analysis"), z3.literal("human-decision")]));
var RepairCapabilitiesSchema = z3.lazy(() => strictObject({
  "validatorCanProveValidity": z3.boolean(),
  "deterministicPatch": z3.boolean(),
  "patchIsReversible": z3.boolean(),
  "generator": z3.boolean(),
  "upstreamSourceKnown": z3.boolean()
}));
var ContextPrecedentSchema = z3.lazy(() => strictObject({
  "unitId": EntityIdSchema,
  "similarity": ConfidenceSchema,
  "relevance": z3.string(),
  "evidenceIds": z3.array(EntityIdSchema)
}));
var ScopeGrantSchema = z3.lazy(() => strictObject({
  "selector": SelectorExprSchema,
  "operations": z3.array(z3.string()),
  "reason": z3.string()
}));
var CompletionContractSchema = z3.lazy(() => strictObject({
  "requiredUnitStates": z3.array(strictObject({
    "unitId": EntityIdSchema,
    "state": z3.union([z3.literal("valid"), z3.literal("removed"), z3.literal("exception")])
  })),
  "requiredValidators": z3.array(z3.string()),
  "requiredEvidenceLanes": z3.array(z3.union([z3.literal("compiler"), z3.literal("test"), z3.literal("schema"), z3.literal("runtime"), z3.literal("property"), z3.literal("representation"), z3.literal("architecture"), z3.literal("historical"), z3.literal("human"), z3.literal("independent-agent"), z3.literal("same-packet-agent")])),
  "minimumValidationAssurance": z3.union([z3.literal("weak"), z3.literal("supporting"), z3.literal("strong"), z3.literal("exact")]),
  "requireIndependentValidation": z3.boolean(),
  "maximumNewDivergences": z3.number().finite(),
  "maximumUnknowns": z3.number().finite(),
  "allowUnavailableExternalActions": z3.boolean(),
  "requiredArtifacts": z3.array(z3.string()),
  "cleanWorkingTree": z3.boolean()
}));
var ExecutionCapsuleSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "taskId": EntityIdSchema,
  "objective": z3.string(),
  "operation": z3.string(),
  "unitIds": z3.array(EntityIdSchema),
  "boundState": StateBindingSchema,
  "relevanceClosureId": EntityIdSchema,
  "analysisFacetKeys": z3.array(z3.string()),
  "requirementIds": z3.array(EntityIdSchema),
  "scenarioIds": z3.array(EntityIdSchema),
  "conceptSummary": z3.string(),
  "decisionIds": z3.array(EntityIdSchema),
  "decisionSummary": z3.string(),
  "unresolvedArchitectureConcerns": z3.array(EntityIdSchema),
  "lensSummary": z3.string(),
  "effectiveRules": z3.array(EffectiveRuleBundleSchema),
  "normativeKernelHash": ContentHashSchema,
  "representation": RepresentationProjectionRefSchema.optional(),
  "relevantPrecedents": z3.array(ContextPrecedentSchema),
  "allowedWrites": z3.array(ScopeGrantSchema),
  "forbiddenWrites": z3.array(ScopeGrantSchema),
  "availablePrimitives": z3.array(z3.string()),
  "requiredValidations": z3.array(z3.string()),
  "upstreamImplications": z3.array(z3.string()),
  "downstreamImplications": z3.array(z3.string()),
  "knownExceptions": z3.array(z3.string()),
  "unknowns": z3.array(z3.string()),
  "risk": RiskAssessmentSchema,
  "completionContract": CompletionContractSchema,
  "contextDependencyHash": ContentHashSchema,
  "contextHash": ContentHashSchema
}));
var CommandSpecSchema = z3.lazy(() => strictObject({
  "id": z3.string(),
  "argv": z3.array(z3.string()),
  "cwd": z3.string(),
  "readScope": z3.array(z3.string()),
  "writeScope": z3.array(z3.string()),
  "requiresNetwork": z3.boolean(),
  "environmentKeys": z3.array(z3.string()),
  "sideEffectClass": z3.union([z3.literal("none"), z3.literal("read-only"), z3.literal("workspace-write"), z3.literal("external-write")]),
  "timeoutMs": z3.number().finite(),
  "cpuBudgetMs": z3.number().finite().optional(),
  "memoryBudgetMb": z3.number().finite().optional()
}));
var CoverageLaneSchema = z3.lazy(() => strictObject({
  "key": z3.string(),
  "observability": ObservabilityClassSchema,
  "numerator": z3.number().finite(),
  "denominator": z3.number().finite().optional(),
  "confidence": ConfidenceSchema,
  "assumptions": z3.array(z3.string()),
  "blindSpots": z3.array(z3.string()),
  "analyzerFailures": z3.array(AnalyzerFailureSchema),
  "staleObservationIds": z3.array(z3.string()),
  "exactClosureProvable": z3.boolean()
}));
var CoverageSnapshotSchema = z3.lazy(() => strictObject({
  "graphRevision": z3.number().finite(),
  "boundary": z3.array(z3.string()),
  "lanes": z3.array(CoverageLaneSchema),
  "completeWithinBoundary": z3.boolean(),
  "allowsBoundedAgentRepair": z3.boolean(),
  "unknownFrontierIds": z3.array(EntityIdSchema),
  "unavailableSurfaceIds": z3.array(EntityIdSchema),
  "proofStatement": z3.union([z3.literal("proven-within-boundary"), z3.literal("bounded"), z3.literal("high-confidence"), z3.literal("partial"), z3.literal("not-established")])
}));
var DivergenceSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "type": z3.string(),
  "title": z3.string(),
  "severity": z3.union([z3.literal("info"), z3.literal("low"), z3.literal("medium"), z3.literal("high"), z3.literal("critical")]),
  "confidence": ConfidenceSchema,
  "leverage": z3.number().finite(),
  "status": z3.union([z3.literal("open"), z3.literal("auto-fixed"), z3.literal("planned"), z3.literal("accepted-exception"), z3.literal("dismissed"), z3.literal("blocked")]),
  "expected": z3.record(z3.string(), JsonValueSchema),
  "observed": z3.record(z3.string(), JsonValueSchema),
  "conceptIds": z3.array(EntityIdSchema),
  "requirementIds": z3.array(EntityIdSchema),
  "scenarioIds": z3.array(EntityIdSchema),
  "unitIds": z3.array(EntityIdSchema),
  "ruleIds": z3.array(EntityIdSchema),
  "evidence": z3.array(EvidenceRefSchema),
  "counterEvidence": z3.array(EvidenceRefSchema),
  "rationale": z3.string(),
  "possibleIntentionality": z3.array(z3.string()),
  "recommendedDisposition": z3.string(),
  "repairStrategies": z3.array(RepairStrategySchema),
  "coverageCaveat": z3.string(),
  "semanticHash": ContentHashSchema
}));
var PlanCheckpointSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "afterPacketIds": z3.array(EntityIdSchema),
  "requiredValidators": z3.array(z3.string()),
  "rollback": RollbackSpecSchema
}));
var ExecutionPlanSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "revision": z3.number().finite(),
  "supersedesPlanId": EntityIdSchema.optional(),
  "semanticChangeId": EntityIdSchema.optional(),
  "sourceRunId": EntityIdSchema,
  "boundState": StateBindingSchema,
  "relevanceClosureId": EntityIdSchema.optional(),
  "predictedImpactClosureHash": ContentHashSchema.optional(),
  "boundary": z3.array(z3.string()),
  "assumptions": z3.array(z3.string()),
  "knownAffectedUnitIds": z3.array(EntityIdSchema),
  "possibleFrontierUnitIds": z3.array(EntityIdSchema),
  "unavailableSurfaceIds": z3.array(EntityIdSchema),
  "packetIds": z3.array(EntityIdSchema),
  "checkpoints": z3.array(PlanCheckpointSchema),
  "completionCriteria": CompletionContractSchema,
  "recommendedNextChunk": z3.string().optional()
}));
var IntentStatementSchema = z3.lazy(() => strictObject({
  "kind": z3.union([z3.literal("behavior"), z3.literal("constraint"), z3.literal("non-goal"), z3.literal("assumption"), z3.literal("implementation-proposal")]),
  "statement": z3.string(),
  "origin": z3.array(IntentOriginRefSchema),
  "confidence": ConfidenceSchema
}));
var ChangeIntentAnalysisSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "request": z3.string(),
  "normalizedIntent": z3.string(),
  "statements": z3.array(IntentStatementSchema),
  "ambiguity": z3.array(z3.string()),
  "assumptions": z3.array(z3.string()),
  "contentHash": ContentHashSchema
}));
var RequirementDeltaSchema = z3.lazy(() => strictObject({
  "subjectType": z3.literal("requirement"),
  "kind": z3.union([z3.literal("add"), z3.literal("modify"), z3.literal("remove"), z3.literal("supersede")]),
  "requirementId": EntityIdSchema.optional(),
  "proposedRequirement": RequirementSchema.optional(),
  "rationale": z3.string()
}).superRefine((value, context) => {
  const needsExistingId = value.kind !== "add";
  const needsProposedValue = value.kind !== "remove";
  if (needsExistingId !== (value.requirementId !== void 0))
    context.addIssue({ code: "custom", path: ["requirementId"], message: needsExistingId ? "existing ID is required" : "add cannot name an existing ID" });
  if (needsProposedValue !== (value.proposedRequirement !== void 0))
    context.addIssue({ code: "custom", path: ["proposedRequirement"], message: needsProposedValue ? "proposed value is required" : "remove cannot carry a proposed value" });
}));
var BehavioralScenarioDeltaSchema = z3.lazy(() => strictObject({
  "subjectType": z3.literal("scenario"),
  "kind": z3.union([z3.literal("add"), z3.literal("modify"), z3.literal("remove"), z3.literal("supersede")]),
  "scenarioId": EntityIdSchema.optional(),
  "proposedScenario": BehavioralScenarioSchema.optional(),
  "rationale": z3.string()
}).superRefine((value, context) => {
  const needsExistingId = value.kind !== "add";
  const needsProposedValue = value.kind !== "remove";
  if (needsExistingId !== (value.scenarioId !== void 0))
    context.addIssue({ code: "custom", path: ["scenarioId"], message: needsExistingId ? "existing ID is required" : "add cannot name an existing ID" });
  if (needsProposedValue !== (value.proposedScenario !== void 0))
    context.addIssue({ code: "custom", path: ["proposedScenario"], message: needsProposedValue ? "proposed value is required" : "remove cannot carry a proposed value" });
}));
var SemanticOperationSchema = z3.lazy(() => strictObject({
  "kind": z3.union([z3.literal("add"), z3.literal("modify"), z3.literal("remove"), z3.literal("replace"), z3.literal("migrate"), z3.literal("adopt-rule"), z3.literal("deprecate-rule"), z3.literal("resolve-divergence")]),
  "subjectType": z3.union([z3.literal("concept"), z3.literal("relation"), z3.literal("decision"), z3.literal("lens"), z3.literal("rule"), z3.literal("projection"), z3.literal("surface"), z3.literal("other")]),
  "subjectKey": z3.string(),
  "subjectId": EntityIdSchema.optional(),
  "payload": z3.record(z3.string(), JsonValueSchema)
}));
var ChangeOperationSchema = z3.lazy(() => z3.union([SemanticOperationSchema, RequirementDeltaSchema, BehavioralScenarioDeltaSchema]));
var ImpactClosureRefSchema = z3.lazy(() => strictObject({
  "contentHash": ContentHashSchema,
  "knownAffectedUnitIds": z3.array(EntityIdSchema),
  "possibleFrontierUnitIds": z3.array(EntityIdSchema),
  "unavailableSurfaceIds": z3.array(EntityIdSchema)
}));
var SemanticChangeSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "request": z3.string(),
  "normalizedIntent": z3.string(),
  "intentAnalysisId": EntityIdSchema,
  "identityResolutionIds": z3.array(EntityIdSchema),
  "relevanceClosureId": EntityIdSchema,
  "analysisFacetKeys": z3.array(z3.string()),
  "operations": z3.array(ChangeOperationSchema),
  "decisionIds": z3.array(EntityIdSchema),
  "assumptions": z3.array(z3.string()),
  "boundary": z3.array(z3.string()),
  "predictedImpact": ImpactClosureRefSchema.optional(),
  "risk": RiskAssessmentSchema,
  "status": z3.union([z3.literal("draft"), z3.literal("analyzed"), z3.literal("approved"), z3.literal("executing"), z3.literal("complete"), z3.literal("blocked")])
}));
var WorkPacketSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "planId": EntityIdSchema,
  "title": z3.string(),
  "strategy": RepairStrategySchema,
  "unitIds": z3.array(EntityIdSchema),
  "dependencies": z3.array(EntityIdSchema),
  "capsuleId": EntityIdSchema,
  "risk": RiskAssessmentSchema,
  "executionMode": z3.union([z3.literal("deterministic"), z3.literal("agent"), z3.literal("manual"), z3.literal("external")]),
  "transformId": z3.string().optional(),
  "validatorIds": z3.array(z3.string()),
  "rollback": RollbackSpecSchema,
  "boundState": StateBindingSchema,
  "status": z3.union([z3.literal("pending"), z3.literal("running"), z3.literal("succeeded"), z3.literal("failed"), z3.literal("blocked"), z3.literal("skipped")])
}));
var TransactionPhaseSchema = z3.lazy(() => z3.union([z3.literal("prepared"), z3.literal("workspace-mutating"), z3.literal("workspace-staged"), z3.literal("validating"), z3.literal("canonical-staging"), z3.literal("committing"), z3.literal("committed"), z3.literal("rolling-back"), z3.literal("rolled-back"), z3.literal("recovery-required")]));
var TransactionJournalEntrySchema = z3.lazy(() => strictObject({
  "transactionId": EntityIdSchema,
  "planId": EntityIdSchema,
  "phase": TransactionPhaseSchema,
  "beforeState": StateDigestSchema,
  "intendedAfterCanonicalDigest": ContentHashSchema.optional(),
  "worktreePath": z3.string(),
  "checkpointIds": z3.array(z3.string()),
  "touchedPaths": z3.array(z3.string()),
  "externalOperationIds": z3.array(z3.string()),
  "updatedAt": z3.string()
}));
var TransactionReceiptSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "planId": EntityIdSchema,
  "semanticChangeId": EntityIdSchema.optional(),
  "riskClass": RiskClassSchema,
  "beforeState": StateDigestSchema,
  "afterState": StateDigestSchema,
  "changedCanonicalEntityIds": z3.array(EntityIdSchema),
  "changedRequirementIds": z3.array(EntityIdSchema),
  "changedScenarioIds": z3.array(EntityIdSchema),
  "changedUnitIds": z3.array(EntityIdSchema),
  "validationSummaryHash": ContentHashSchema,
  "certificateHash": ContentHashSchema.optional(),
  "rollbackRef": z3.string().optional(),
  "createdAt": z3.string(),
  "semanticHash": ContentHashSchema
}));
var ChangeCertificateSchema = z3.lazy(() => strictObject({
  "id": EntityIdSchema,
  "planId": EntityIdSchema,
  "baseGitRevision": z3.string().optional(),
  "resultingGitRevision": z3.string().optional(),
  "semanticChange": SemanticChangeSchema.optional(),
  "relevanceClosureHash": ContentHashSchema.optional(),
  "predictedImpactClosureHash": ContentHashSchema.optional(),
  "observedImpactClosureHash": ContentHashSchema.optional(),
  "beforeState": StateDigestSchema,
  "afterState": StateDigestSchema.optional(),
  "changedConcepts": z3.array(EntityIdSchema),
  "changedRequirements": z3.array(EntityIdSchema),
  "changedScenarios": z3.array(EntityIdSchema),
  "changedRelations": z3.array(EntityIdSchema),
  "changedUnits": z3.array(EntityIdSchema),
  "planningSurpriseIds": z3.array(EntityIdSchema),
  "deterministicOperations": z3.array(OperationEvidenceSchema),
  "agentOperations": z3.array(OperationEvidenceSchema),
  "validations": z3.array(ValidationResultSchema),
  "divergencesResolved": z3.array(EntityIdSchema),
  "divergencesIntroduced": z3.array(EntityIdSchema),
  "modeledBoundary": z3.array(z3.string()),
  "completeness": z3.union([z3.literal("proven-within-boundary"), z3.literal("bounded"), z3.literal("high-confidence"), z3.literal("partial"), z3.literal("not-established")]),
  "unknowns": z3.array(z3.string()),
  "unavailableActions": z3.array(z3.string()),
  "rollback": z3.array(RollbackSpecSchema),
  "createdAt": z3.string()
}));
var StructuredModelRequestSchema = z3.lazy(() => strictObject({
  "purpose": z3.string(),
  "role": z3.union([z3.literal("classify"), z3.literal("infer-concepts"), z3.literal("resolve-identity"), z3.literal("discover-relevance"), z3.literal("analyze-intent"), z3.literal("infer-pattern"), z3.literal("research-synthesis"), z3.literal("architecture"), z3.literal("bounded-edit"), z3.literal("representation-render"), z3.literal("representation-review"), z3.literal("adversarial-review"), z3.literal("judge")]),
  "programVersion": z3.string(),
  "schemaName": z3.string(),
  "schemaVersion": z3.string(),
  "schema": JsonValueSchema,
  "input": z3.record(z3.string(), JsonValueSchema),
  "inputHash": ContentHashSchema,
  "executionCapsule": ExecutionCapsuleSchema.optional(),
  "risk": RiskAssessmentSchema,
  "maxInputTokens": z3.number().finite().optional(),
  "maxOutputTokens": z3.number().finite().optional(),
  "maxCost": z3.number().finite().optional()
}));
var StructuredModelResponseSchema = z3.lazy(() => strictObject({
  "value": JsonValueSchema,
  "provider": z3.string(),
  "model": z3.string(),
  "providerRevision": z3.string().optional(),
  "inputTokens": z3.number().finite().optional(),
  "outputTokens": z3.number().finite().optional(),
  "rawResponseHash": ContentHashSchema,
  "attempt": z3.number().finite()
}));

// node_modules/@projector/core/dist/schemas/canonical-envelope.js
import { z as z4 } from "zod";
var CanonicalKindSchema = z4.enum([
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
  apiVersion: z4.string().min(1),
  schemaVersion: z4.string().min(1),
  kind: CanonicalKindSchema,
  id: EntityIdSchema,
  key: z4.string().min(1),
  lifecycle: z4.string().min(1),
  payload: z4.record(z4.string(), JsonValueSchema),
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
var CanonicalDocumentEnvelopeSchema = z4.strictObject(canonicalEnvelopeShape).superRefine((value, context) => {
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
  return z4.strictObject({
    ...canonicalEnvelopeShape,
    kind: z4.literal(kind),
    payload: CanonicalPayloadSchemas[kind]
  }).superRefine((value, context) => {
    verifyCanonicalOwnerEvidence(value, context);
    verifyEnvelope(value, context);
  });
}
var CanonicalDocumentEnvelopeSchemasByKind = Object.freeze(Object.fromEntries(CanonicalKindSchema.options.map((kind) => [kind, canonicalDocumentEnvelopeSchemaForKind(kind)])));
var canonicalDocumentEnvelopeSchemas = Object.values(CanonicalDocumentEnvelopeSchemasByKind);
var CanonicalDocumentEnvelopeByKindSchema = z4.union(canonicalDocumentEnvelopeSchemas);
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
  return z4.strictObject({
    apiVersion: z4.string().min(1),
    schemaVersion: z4.string().min(1),
    kind: z4.literal(kind),
    id: EntityIdSchema,
    key: z4.string().min(1),
    lifecycle: canonicalWireLifecycleSchema(kind, payload, mirrors),
    payload: z4.strictObject(authoredPayloadShape)
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
    return z4.enum(["active", "inactive"]);
  const fixed = FixedCanonicalLifecycleByKind[kind];
  return fixed === void 0 ? z4.string().min(1) : z4.literal(fixed);
}
var CanonicalDocumentWireSchemasByKind = Object.freeze(Object.fromEntries(CanonicalKindSchema.options.map((kind) => [kind, canonicalDocumentWireSchemaForKind(kind)])));
var canonicalDocumentWireSchemas = Object.values(CanonicalDocumentWireSchemasByKind);
var CanonicalDocumentWireByKindSchema = z4.union(canonicalDocumentWireSchemas);
function hydrateCanonicalDocumentWire(unparsed) {
  const kind = z4.strictObject({ kind: CanonicalKindSchema }).loose().parse(unparsed).kind;
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
  const kind = z4.strictObject({ kind: CanonicalKindSchema }).loose().parse(unparsed).kind;
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
  if (!(unwrapped instanceof z4.ZodObject))
    throw new Error("canonical payload schema must resolve to an object");
  return unwrapped;
}

// node_modules/@projector/core/dist/schemas/change-proposal.js
import { z as z5 } from "zod";
var changeProposalApiVersion = "projector.change-proposal/v1";
var facets = ["behavior", "architecture", "events", "security", "realtime", "migration", "public-contract", "workspace-expansion", "persistence", "performance", "observability", "compatibility", "distribution", "cleanup", "external-surface"];
var compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var text = (maximum = 4096) => z5.string().min(1).max(maximum).refine((value) => !value.includes("\0") && value.trim().length > 0, "must be nonblank bounded text").transform((value) => value.normalize("NFKC").trim());
var key = text(160).refine((value) => /^[a-z0-9][a-z0-9._:-]*$/u.test(value.toLocaleLowerCase("en-US")), "must be a stable lowercase key").transform((value) => value.toLocaleLowerCase("en-US"));
var repositoryPath = z5.string().min(1).max(1024).refine((value) => {
  const normalized = value.normalize("NFKC");
  return normalized === value && !normalized.includes("\\") && !normalized.startsWith("/") && !/^[A-Za-z]:/u.test(normalized) && !normalized.endsWith("/") && !normalized.includes("//") && normalized.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}, "must be a canonical repository-relative path");
var unique = (schema, minimum = 0, maximum = 64) => z5.array(schema).min(minimum).max(maximum).superRefine((values, context) => {
  if (new Set(values.map((value) => JSON.stringify(value))).size !== values.length)
    context.addIssue({ code: "custom", message: "contains duplicates" });
});
var RevisionSchema = z5.object({
  id: text(512),
  expectedSemanticHash: z5.string().regex(/^sha256:v1:[a-f0-9]{64}$/u),
  rationale: text()
}).strict();
var RequirementProposalSchema = z5.object({ key, title: text(240), statement: text(), aliases: unique(text(512)).default([]), revision: RevisionSchema.optional() }).strict();
var ScenarioStepSchema = z5.object({ role: z5.enum(["precondition", "trigger", "expected-outcome", "forbidden-outcome"]), statement: text() }).strict();
var ScenarioStepsSchema = unique(ScenarioStepSchema, 2, 32).superRefine((steps, context) => {
  if (!steps.some(({ role }) => role === "trigger") || !steps.some(({ role }) => role === "expected-outcome" || role === "forbidden-outcome"))
    context.addIssue({ code: "custom", message: "steps must contain a trigger and an outcome" });
});
var ScenarioProposalSchema = z5.object({ key, title: text(240), aliases: unique(text(512)).default([]), steps: ScenarioStepsSchema, revision: RevisionSchema.optional() }).strict();
var DeferralSchema = z5.object({ rationale: text(), reconsiderWhen: text(), validUntil: z5.iso.datetime(), preservedOptions: unique(text(512), 1), forbiddenCommitments: unique(text(512), 1), forbiddenWritePaths: unique(repositoryPath, 1).superRefine((paths, context) => {
  if (paths.some((path) => /[*?[\]]/u.test(path)))
    context.addIssue({ code: "custom", message: "forbidden write paths must contain exact canonical paths, not globs" });
}) }).strict();
var ArchitectureProposalSchema = z5.object({ concernKey: key, title: text(240), question: text(), materiality: z5.enum(["material-soon", "deferable"]), deferral: DeferralSchema }).strict();
var ExactEditSchema = z5.object({ path: repositoryPath.refine((path) => ![".git", ".projector", ".worktrees", "node_modules"].some((root) => path === root || path.startsWith(`${root}/`)), "path is reserved and cannot be edited"), before: z5.string().max(4 * 1024 * 1024).nullable(), after: z5.string().max(4 * 1024 * 1024).nullable() }).strict().superRefine(({ before, after }, context) => {
  if (before === after)
    context.addIssue({ code: "custom", message: "edit is a no-op" });
  if ([before, after].some((value) => value?.includes("\0") === true))
    context.addIssue({ code: "custom", message: "edit content contains a NUL byte" });
});
var ValidationProposalSchema = z5.object({ independentNodeTests: unique(repositoryPath, 0), supplementalNodeTests: unique(repositoryPath).default([]) }).strict().superRefine(({ independentNodeTests, supplementalNodeTests }, context) => {
  for (const path of [...independentNodeTests, ...supplementalNodeTests])
    if (!/(?:^|\/)\S+\.test\.(?:mjs|cjs|js)$/u.test(path))
      context.addIssue({ code: "custom", message: `Node validator must be a test file: ${path}` });
  if (independentNodeTests.some((path) => supplementalNodeTests.includes(path)))
    context.addIssue({ code: "custom", message: "validator provenance groups overlap" });
});
var contentHash = z5.string().regex(/^sha256:v1:[a-f0-9]{64}$/u);
var NewIdentityBoundarySchema = z5.object({
  owns: unique(text(), 1),
  excludes: unique(text(), 1),
  nearestEntityIds: unique(text(512)),
  rationale: text()
}).strict();
var IdentityResolutionSchema = z5.object({
  contextId: text(512),
  contextHash: contentHash,
  outcome: z5.enum(["reuse-existing", "coordinated-modification", "split-existing", "merge-existing", "replace-existing", "create-new", "no-durable-entity"]),
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
  if (!(schema instanceof z5.ZodLazy))
    throw new TypeError("canonical mutation payload schema must be lazy");
  const object = schema.unwrap();
  if (!(object instanceof z5.ZodObject))
    throw new TypeError("canonical mutation payload schema must unwrap to an object");
  const { semanticHash: _semanticHash, discoveryHash: _discoveryHash, ...shape } = object.shape;
  return z5.strictObject(hasDiscoveryHash ? shape : { ...shape, ..._discoveryHash === void 0 ? {} : { discoveryHash: _discoveryHash } });
}
var canonicalPayloadSchemas = {
  requirement: canonicalPayloadWithoutDerivedHashes(RequirementSchema, true).extend({ key, title: text(240), statement: text(), aliases: unique(text(512)) }),
  "behavioral-scenario": canonicalPayloadWithoutDerivedHashes(BehavioralScenarioSchema, true).extend({ key, title: text(240), aliases: unique(text(512)), steps: ScenarioStepsSchema }),
  concept: canonicalPayloadWithoutDerivedHashes(ConceptSchema, true).extend({ key, name: text(240), statement: text(16384), aliases: unique(text(512)) }),
  relation: canonicalPayloadWithoutDerivedHashes(RelationSchema),
  "architecture-decision": canonicalPayloadWithoutDerivedHashes(ArchitectureDecisionSchema).extend({ key, title: text(240), decision: text(16384) }),
  "architecture-concern": canonicalPayloadWithoutDerivedHashes(ArchitectureConcernSchema).extend({ key, title: text(240), question: text() }),
  "developer-preference": canonicalPayloadWithoutDerivedHashes(DeveloperPreferenceSchema).extend({ key, statement: text() }),
  "projection-lens": canonicalPayloadWithoutDerivedHashes(ProjectionLensSchema).extend({
    key,
    purpose: text(),
    rules: z5.array(canonicalPayloadWithoutDerivedHashes(RuleSchema)),
    impactRules: z5.array(canonicalPayloadWithoutDerivedHashes(ImpactRuleSchema))
  }),
  "authority-record": canonicalPayloadWithoutDerivedHashes(AuthorityRecordSchema).extend({ key, rationale: text(16384) })
};
var canonicalMutationFor = (kind, payload) => z5.discriminatedUnion("operation", [
  z5.object({ kind: z5.literal(kind), operation: z5.literal("add"), expectedAbsent: z5.literal(true), payload, rationale: text() }).strict(),
  z5.object({ kind: z5.literal(kind), operation: z5.literal("revise"), expectedSemanticHash: contentHash, expectedDocumentHash: contentHash, payload, rationale: text() }).strict()
]);
var LineageSourceSchema = z5.object({
  id: text(512),
  kind: z5.enum(["requirement", "behavioral-scenario", "concept"]),
  expectedSemanticHash: contentHash,
  expectedDocumentHash: contentHash
}).strict();
var LineageMutationSchema = z5.object({
  kind: z5.literal("lineage"),
  operation: z5.literal("add"),
  lineageKind: z5.enum(["move", "split", "merge", "replace", "delete"]),
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
var CanonicalMutationSchema = z5.discriminatedUnion("kind", [
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
var ChangeProposalSchema = z5.object({
  apiVersion: z5.literal(changeProposalApiVersion),
  requirements: unique(RequirementProposalSchema, 0, 32).default([]),
  scenarios: unique(ScenarioProposalSchema, 0, 64).default([]),
  identityResolution: IdentityResolutionSchema.optional(),
  canonicalMutations: unique(CanonicalMutationSchema, 0, 64).optional(),
  architecture: ArchitectureProposalSchema.nullable(),
  edits: unique(ExactEditSchema, 0, 256).default([]),
  validation: ValidationProposalSchema.default({ independentNodeTests: [], supplementalNodeTests: [] }),
  analysisFacets: unique(z5.enum(facets), 2)
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
import { z as z6 } from "zod";
var ArchitectureEvaluationRequestSchema = z6.strictObject({
  concernId: EntityIdSchema,
  options: z6.array(DecisionOptionSchema).min(1),
  preferenceIds: z6.array(EntityIdSchema).optional(),
  research: z6.strictObject({
    required: z6.boolean().optional(),
    records: z6.array(EvidenceSchema).optional(),
    maxAgeDays: z6.number().finite().nonnegative().optional()
  }).optional(),
  acceptance: z6.discriminatedUnion("kind", [
    z6.strictObject({ kind: z6.literal("automatic") }),
    z6.strictObject({ kind: z6.literal("explicit-user"), authorityRecordId: EntityIdSchema })
  ]).optional()
});
var ArchitectureEvaluationOutputSchema = z6.strictObject({
  evaluation: DecisionEvaluationSchema,
  acceptanceBlocked: z6.boolean(),
  appliedPreferences: z6.array(AppliedPreferenceRefSchema),
  preferenceConflicts: z6.array(z6.string()),
  governanceConsequences: z6.array(z6.never()),
  canonicalMutationAuthorized: z6.literal(false)
});

// node_modules/@projector/core/dist/schemas/verification.js
import { z as z7 } from "zod";
var VerificationPopulationSchema = z7.object({ directory: z7.string().min(1), recursive: z7.boolean() }).strict();
var VerificationInputSnapshotSchema = z7.object({
  files: z7.record(z7.string(), ContentHashSchema),
  populations: z7.array(z7.object({ directory: z7.string().min(1), recursive: z7.boolean(), members: z7.array(z7.string().min(1)) }).strict()),
  producerPath: z7.string().min(1),
  producerHash: ContentHashSchema,
  environmentHash: ContentHashSchema,
  platform: z7.string(),
  architecture: z7.string(),
  nodeVersion: z7.string()
}).strict();
var VerificationRequestSchema = z7.object({
  executable: z7.string().min(1),
  args: z7.array(z7.string()).max(1024),
  sourcePath: z7.string().min(1).optional(),
  inputPaths: z7.array(z7.string().min(1)).min(1).max(1e4),
  populations: z7.array(VerificationPopulationSchema).max(128),
  environment: z7.array(z7.string().min(1)).max(256),
  timeoutMs: z7.number().int().positive().max(3e5),
  completeInputs: z7.boolean().optional()
}).strict();
var VerificationEvidenceSchema = z7.object({
  id: z7.string().regex(/^execution_[0-9a-f-]{36}$/u),
  request: VerificationRequestSchema,
  inputs: VerificationInputSnapshotSchema,
  basisHash: ContentHashSchema,
  profile: z7.literal("native-observed/v1"),
  startedAt: z7.string(),
  completedAt: z7.string().optional(),
  status: z7.enum(["running", "passed", "failed", "interrupted", "inputs-changed"]),
  exitCode: z7.number().int().nullable().optional(),
  stdout: z7.string().optional(),
  stderr: z7.string().optional(),
  error: z7.string().optional(),
  contentHash: ContentHashSchema
}).strict();
var VerificationInspectionSchema = z7.object({ records: z7.array(VerificationEvidenceSchema), pendingPublications: z7.array(z7.object({ artifactSetId: z7.string(), state: z7.enum(["staged", "finalizing"]), recoverable: z7.boolean() }).strict()) }).strict();
var VerificationRecoverySchema = z7.object({ recoveredArtifactSetIds: z7.array(z7.string()), inspection: VerificationInspectionSchema }).strict();
var BuiltinVerificationRequestSchema = z7.strictObject({ check: z7.literal("projector.canonical-integrity/v1"), target: z7.string().min(1), timeoutMs: z7.number().int().positive().max(3e5).optional() });
var BuiltinVerificationArtifactSchema = z7.strictObject({ path: z7.string().min(1), sha256: z7.string().regex(/^[a-f0-9]{64}$/u) });
var BuiltinVerificationEvidenceSchema = z7.strictObject({
  id: z7.string().regex(/^execution_[0-9a-f-]{36}$/u),
  profile: z7.literal("projector-closed-static/v1"),
  request: BuiltinVerificationRequestSchema,
  targetObject: z7.string(),
  targetTree: z7.string(),
  binding: StateBindingSchema,
  basisHash: ContentHashSchema,
  producer: z7.strictObject({ identity: z7.string(), buildHash: ContentHashSchema, files: z7.record(z7.string(), ContentHashSchema), production: z7.boolean() }),
  trustPolicyHash: ContentHashSchema,
  contractHash: ContentHashSchema,
  environmentHash: ContentHashSchema,
  artifacts: z7.array(BuiltinVerificationArtifactSchema),
  status: z7.enum(["running", "passed", "failed", "interrupted", "inputs-changed"]),
  startedAt: z7.string(),
  completedAt: z7.string().optional(),
  findings: z7.array(z7.string()),
  unknowns: z7.array(z7.string()),
  error: z7.string().optional(),
  contentHash: ContentHashSchema
});
var BuiltinVerificationAssessmentSchema = z7.strictObject({ eventId: z7.string(), scope: z7.literal("projector.canonical-integrity/v1"), reusable: z7.boolean(), authorization: z7.literal(false), bindingStatus: z7.enum(["current", "rebound", "stale", "suspect", "unavailable"]), contradictory: z7.boolean(), targetObject: z7.string().optional(), targetTree: z7.string().optional(), reasons: z7.array(z7.string()) });
var BuiltinVerificationInspectionSchema = z7.strictObject({ scope: z7.literal("projector.canonical-integrity/v1"), records: z7.array(BuiltinVerificationEvidenceSchema), pendingPublications: z7.array(z7.strictObject({ artifactSetId: z7.string(), state: z7.enum(["staged", "finalizing"]), recoverable: z7.boolean() })) });
var BuiltinVerificationRecoverySchema = z7.strictObject({ recoveredArtifactSetIds: z7.array(z7.string()), inspection: BuiltinVerificationInspectionSchema });
var BuiltinVerificationOperationSchema = z7.discriminatedUnion("action", [
  z7.strictObject({ action: z7.literal("execute"), request: BuiltinVerificationRequestSchema }),
  z7.strictObject({ action: z7.literal("assess"), eventId: z7.string().min(1), target: z7.string().min(1) }),
  z7.strictObject({ action: z7.literal("inspect") }),
  z7.strictObject({ action: z7.literal("recover") })
]);

// node_modules/@projector/core/dist/schemas/generated-output.js
import { z as z8 } from "zod";
var GeneratedOutputRequestSchema = z8.object({
  producerId: z8.string().min(1),
  executable: z8.string().min(1),
  sourcePath: z8.string().min(1),
  args: z8.array(z8.string()).max(1024),
  inputPaths: z8.array(z8.string().min(1)).max(1e4),
  outputs: z8.array(z8.object({ path: z8.string().min(1), ownership: z8.enum(["retained", "disposable"]) }).strict()).min(1).max(1e4),
  environment: z8.array(z8.string().min(1)).max(256),
  timeoutMs: z8.number().int().positive().max(3e5),
  completeInputs: z8.boolean().optional(),
  populations: z8.array(VerificationPopulationSchema).max(128)
}).strict();
var GeneratedOutputEvidenceSchema = z8.object({
  id: z8.string(),
  request: GeneratedOutputRequestSchema,
  check: VerificationEvidenceSchema,
  before: z8.record(z8.string(), ContentHashSchema),
  after: z8.record(z8.string(), ContentHashSchema),
  afterObservation: z8.enum(["immediate", "recovery"]),
  contentHash: ContentHashSchema
}).strict();
var GeneratedOutputInspectionSchema = z8.object({
  records: z8.array(z8.object({ evidence: GeneratedOutputEvidenceSchema, current: z8.boolean(), reason: z8.string(), outputs: z8.array(z8.object({ path: z8.string(), ownership: z8.enum(["retained", "disposable"]), observation: z8.enum(["missing", "unchanged-after-invocation", "changed-after-invocation"]), disposition: z8.enum(["current", "preserve-and-review", "regenerate", "removal-eligible"]) }).strict()) }).strict()),
  pendingPublications: z8.array(z8.object({ artifactSetId: z8.string(), state: z8.enum(["staged", "finalizing"]), recoverable: z8.boolean() }).strict())
}).strict();
var GeneratedOutputRecoverySchema = z8.object({ recoveredArtifactSetIds: z8.array(z8.string()), inspection: GeneratedOutputInspectionSchema }).strict();

// node_modules/@projector/core/dist/schemas/git-integration.js
import { z as z9 } from "zod";
var ref = z9.string().min(1);
var objectId = z9.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
var GitIntegrationRequestSchema = z9.strictObject({ target: ref, incoming: ref, base: ref.optional(), result: ref.optional() });
var contribution = z9.strictObject({ side: z9.enum(["target", "incoming"]), change: z9.enum(["added", "modified", "removed"]), status: z9.enum(["preserved", "altered", "lost"]) });
var population = z9.strictObject({ dependencyPath: z9.string(), targetConsumers: z9.array(z9.string()), incomingConsumers: z9.array(z9.string()), resultConsumers: z9.array(z9.string()), newlyRelevantConsumers: z9.array(z9.string()), removedConsumers: z9.array(z9.string()), fingerprint: z9.string() });
var obligations = z9.strictObject({ lensId: z9.string(), targetMembers: z9.array(z9.string()), incomingMembers: z9.array(z9.string()), resultMembers: z9.array(z9.string()), newlyApplicableUnitIds: z9.array(z9.string()), resultObligations: z9.array(z9.strictObject({ unitId: z9.string(), applicabilityFingerprint: z9.string(), validatorIds: z9.array(z9.string()), ruleIds: z9.array(z9.string()) })) });
var GitResultReconciliationSchema = z9.strictObject({
  status: z9.enum(["assessed", "incomplete", "failed", "not-assessed"]),
  scope: z9.literal("immutable-result-static-consumers-and-obligations"),
  consumerQueries: z9.array(population),
  lensPopulations: z9.array(obligations),
  topologyQueries: z9.array(z9.strictObject({ subjectId: z9.string(), subjectKind: z9.enum(["event", "contract"]), targetConsumers: z9.array(z9.string()), incomingConsumers: z9.array(z9.string()), resultConsumers: z9.array(z9.string()), newlyRelevantConsumers: z9.array(z9.string()), observability: z9.string(), fingerprint: z9.string() })),
  semanticChanges: z9.array(z9.strictObject({ path: z9.string(), targetHash: z9.string().optional(), incomingHash: z9.string().optional(), resultHash: z9.string().optional() })),
  contradictions: z9.array(z9.string()),
  unknowns: z9.array(z9.string()),
  behavior: z9.strictObject({ status: z9.literal("not-assessed"), reusable: z9.literal(false) })
});
var GitIntegrationAssessmentSchema = z9.strictObject({
  baseCommit: objectId,
  targetCommit: objectId,
  incomingCommit: objectId,
  resultTree: objectId,
  resultCommit: objectId.optional(),
  baseSelection: z9.enum(["inferred", "explicit"]),
  resultSource: z9.enum(["calculated-merge", "supplied"]),
  status: z9.enum(["review-required", "conflicted", "invalid"]),
  conflictPaths: z9.array(z9.string()),
  changedCodePaths: z9.strictObject({ target: z9.array(z9.string()), incoming: z9.array(z9.string()) }),
  codeContributions: z9.array(contribution.extend({ path: z9.string() })),
  contributions: z9.array(contribution.extend({ entityId: z9.string(), kind: z9.string(), baseSemanticHash: z9.string().optional(), branchSemanticHash: z9.string().optional(), resultSemanticHash: z9.string().optional(), baseAuthoredHash: z9.string().optional(), branchAuthoredHash: z9.string().optional(), resultAuthoredHash: z9.string().optional(), documentDrift: z9.boolean() })),
  semanticOverlapIds: z9.array(z9.string()),
  resultOnlyPaths: z9.array(z9.string()),
  canonicalValidation: z9.strictObject({ scope: z9.literal("canonical-record-integrity"), status: z9.enum(["passed", "failed", "not-assessed"]), issues: z9.array(z9.string()) }),
  staticGovernanceValidation: z9.strictObject({ status: z9.enum(["passed", "failed", "incomplete", "not-assessed"]), checks: z9.array(z9.string()), issues: z9.array(z9.string()) }),
  resultReconciliation: GitResultReconciliationSchema,
  assessedAt: z9.iso.datetime(),
  requiresReview: z9.literal(true),
  verificationGaps: z9.array(z9.string())
});

// node_modules/@projector/core/dist/schemas/operations.js
import { z as z10 } from "zod";
var projectorOperationApiVersion = "projector.operation/v1";
var projectorOperationResultApiVersion = "projector.operation-result/v1";
var ProjectorOperationSchema = z10.enum([
  "status",
  "init",
  "context",
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
  "application.observe"
]);
var requestBase = {
  apiVersion: z10.literal(projectorOperationApiVersion),
  repositoryRoot: z10.string().min(1),
  requestId: z10.string().min(1).optional(),
  observationLimits: ObservationLimitsOverrideSchema.optional()
};
function createProjectorOperationRequestSchema(operation, inputSchema) {
  return z10.strictObject({ ...requestBase, operation: z10.literal(operation), input: inputSchema.strict() });
}
var boundedInspectionInput = {
  scope: z10.string().min(1).optional(),
  budgetTokens: z10.number().int().nonnegative().optional(),
  budgetCost: z10.number().nonnegative().optional(),
  questionOffset: z10.number().int().nonnegative().optional()
};
var knowledgePolicy = z10.strictObject({
  maxCandidates: z10.number().int().positive().max(1e4).optional(),
  maxEntries: z10.number().int().positive().max(1e4).optional(),
  maxDepth: z10.number().int().nonnegative().max(1e3).optional(),
  maxTraversalCost: z10.number().int().positive().max(1e7).optional(),
  minimumScore: z10.number().min(0).max(1).optional(),
  maxContextCost: z10.number().int().positive().max(1e7).optional()
});
var ProjectorOperationInputSchemas = Object.freeze({
  status: z10.strictObject({}),
  init: z10.strictObject({}),
  context: z10.strictObject({
    view: z10.enum(["agent", "full"]).optional(),
    request: z10.string().min(1).max(4096),
    entities: z10.array(z10.string().min(1).max(512)).max(64).optional(),
    namedTargets: z10.array(z10.string().min(1).max(1024)).max(64).optional(),
    operation: z10.string().min(1).max(160).optional(),
    persist: z10.boolean().optional(),
    policy: knowledgePolicy.optional()
  }),
  reconcile: z10.strictObject({ contextId: z10.string().min(1), view: z10.enum(["agent", "full"]).optional() }),
  "repository.check": z10.strictObject({
    mode: z10.enum(["full", "commit-only"]).optional(),
    sessionId: z10.string().min(1).max(512).optional(),
    handled: z10.strictObject({ findingId: z10.string().min(1).max(128), evidenceIdentity: ContentHashSchema }).optional()
  }),
  "repository.integration": GitIntegrationRequestSchema,
  "operation-access.recover": z10.strictObject({}),
  "change.capture": z10.strictObject({ request: z10.string().min(1), proposal: ChangeProposalSchema, contextId: z10.string().min(1).optional() }),
  "change.plan": z10.strictObject({ changeSelector: z10.string().min(1) }),
  "change.approve": z10.strictObject({ changeSelector: z10.string().min(1), planHash: ContentHashSchema }),
  "change.apply": z10.strictObject({ approvalSelector: z10.string().min(1) }),
  "change.recover": z10.strictObject({ approvalSelector: z10.string().min(1) }),
  coverage: z10.strictObject(boundedInspectionInput),
  complete: z10.strictObject(boundedInspectionInput),
  cleanup: z10.strictObject({
    ...boundedInspectionInput,
    contextId: z10.string().min(1).optional(),
    changeSelector: z10.string().min(1).optional(),
    approvalSelector: z10.string().min(1).optional(),
    evidenceOffset: z10.number().int().nonnegative().optional(),
    evidenceLimit: z10.number().int().positive().max(50).optional(),
    evidenceIdentity: ContentHashSchema.optional()
  }),
  verify: z10.strictObject({}),
  "representation.inspect": z10.strictObject({
    changeSelector: z10.string().min(1),
    capsuleId: z10.string().min(1).optional(),
    approvalSelector: z10.string().min(1).optional(),
    view: z10.enum(["summary", "content"])
  }),
  "representation.reconcile": z10.strictObject({
    changeSelector: z10.string().min(1),
    approvalSelector: z10.string().min(1).optional()
  }),
  "representation.recover": z10.strictObject({}),
  "representation.pending": z10.strictObject({}),
  "architecture.evaluate": ArchitectureEvaluationRequestSchema,
  "verification.execute": VerificationRequestSchema,
  "verification.builtin": z10.strictObject({ command: BuiltinVerificationOperationSchema }),
  "verification.inspect": z10.strictObject({ eventIds: z10.array(z10.string().min(1)).max(1e4).optional() }),
  "verification.recover": z10.strictObject({}),
  "generated.execute": z10.strictObject({ generation: GeneratedOutputRequestSchema }),
  "generated.inspect": z10.strictObject({ activeProducerIds: z10.array(z10.string().min(1)).max(1e4) }),
  "generated.recover": z10.strictObject({ activeProducerIds: z10.array(z10.string().min(1)).max(1e4) })
});
var ProjectorOperationRequestSchema = z10.discriminatedUnion("operation", [
  createProjectorOperationRequestSchema("status", ProjectorOperationInputSchemas.status),
  createProjectorOperationRequestSchema("init", ProjectorOperationInputSchemas.init),
  createProjectorOperationRequestSchema("context", ProjectorOperationInputSchemas.context),
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
var PackageVersionSchema = z10.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u, "must be a numeric semantic version");
var PackageIdentitySchema = z10.strictObject({
  name: z10.string().min(1),
  version: PackageVersionSchema
});
var ProjectReadinessStatusSchema = z10.enum([
  "ready",
  "inactive",
  "upgrade-required",
  "recovery-required",
  "busy",
  "unavailable"
]);
var ProjectReadinessSchema = z10.strictObject({
  status: ProjectReadinessStatusSchema,
  package: PackageIdentitySchema,
  observed: z10.strictObject({
    configApiVersion: z10.string().min(1),
    preparedProjectorVersion: PackageVersionSchema.optional()
  }).optional(),
  reason: z10.string().min(1).optional(),
  recovery: z10.strictObject({
    code: z10.string().min(1),
    location: z10.string().min(1).optional(),
    action: z10.string().min(1)
  }).optional()
});
var ProjectorOperationErrorSchema = z10.strictObject({
  code: z10.string().min(1),
  message: z10.string().min(1),
  retriable: z10.boolean(),
  observation: z10.strictObject({
    stage: z10.string().min(1),
    scope: z10.string().min(1),
    limit: ObservationLimitsSchema.keyof().optional(),
    observed: z10.number().nonnegative().optional()
  }).optional()
});
var ProjectorOperationActionSchema = z10.strictObject({
  kind: z10.enum(["approval-required", "recovery-required", "retry", "activate", "upgrade"]),
  operation: ProjectorOperationSchema,
  selector: z10.string().min(1).optional(),
  reason: z10.string().min(1)
});
function createProjectorOperationResultSchema(operation, outputSchema) {
  const base = {
    apiVersion: z10.literal(projectorOperationResultApiVersion),
    operation: z10.literal(operation),
    package: PackageIdentitySchema,
    requestId: z10.string().min(1).optional(),
    exitCode: z10.number().int(),
    readiness: ProjectReadinessSchema
  };
  const unsuccessful = {
    ...base,
    error: ProjectorOperationErrorSchema,
    action: ProjectorOperationActionSchema.optional(),
    output: outputSchema.optional()
  };
  return z10.discriminatedUnion("status", [
    z10.strictObject({ ...base, status: z10.literal("succeeded"), output: outputSchema }),
    z10.strictObject({ ...unsuccessful, status: z10.literal("failed") }),
    z10.strictObject({ ...unsuccessful, status: z10.literal("unavailable") }),
    z10.strictObject({ ...unsuccessful, status: z10.literal("cancelled") })
  ]);
}

// node_modules/@projector/core/dist/schemas/project-config.js
import { z as z11 } from "zod";
var projectorConfigApiVersion = "projector.config/v3";
var PreparedProjectorConfigSchema = z11.object({
  apiVersion: z11.literal(projectorConfigApiVersion),
  enabled: z11.literal(true),
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
import { z as z12 } from "zod";
var durableRepresentationArtifactApiVersion = "projector.representation-artifact/v1";
var DurableRepresentationArtifactRecordBodySchema = z12.strictObject({
  apiVersion: z12.literal(durableRepresentationArtifactApiVersion),
  projection: RepresentationProjectionSchema
});
function hashDurableRepresentationArtifactRecord(input) {
  return hashFramedDomain("durable-representation-artifact", DurableRepresentationArtifactRecordBodySchema.parse(input));
}
var DurableRepresentationArtifactRecordSchema = z12.strictObject({
  apiVersion: z12.literal(durableRepresentationArtifactApiVersion),
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
import { z as z13 } from "zod";
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
    z13.toJSONSchema(registration.schema, {
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
import { z as z14 } from "zod";
var applicationEvidenceAssessmentRequestSchemaVersion = "application-evidence-assessment-request@1";
var applicationEvidenceAssessmentSchemaVersion = "application-evidence-assessment@1";
var identity = z14.string().min(1).max(512).regex(/^[^\0\r\n]+$/u);
var reason = z14.string().min(1).max(4096);
var owner = z14.strictObject({
  kind: z14.enum(["requirement", "behavioral-scenario"]),
  id: identity,
  canonicalDocumentHash: ContentHashSchema
});
var ApplicationEvidenceAssessmentRequestSchema = z14.strictObject({
  schemaVersion: z14.literal(applicationEvidenceAssessmentRequestSchemaVersion),
  owner,
  binding: ApplicationEvidencePredicateBindingSchema,
  evidenceIds: z14.array(identity).min(1).max(64)
}).superRefine((value, context) => {
  if (new Set(value.evidenceIds).size !== value.evidenceIds.length) {
    context.addIssue({ code: "custom", path: ["evidenceIds"], message: "application evidence IDs must be unique" });
  }
});
var custody = z14.discriminatedUnion("status", [
  z14.strictObject({ status: z14.literal("authenticated"), receiptHash: ContentHashSchema }),
  z14.strictObject({ status: z14.literal("unavailable"), reason })
]);
var currentness = z14.discriminatedUnion("status", [
  z14.strictObject({ status: z14.literal("current"), observationHash: ContentHashSchema }),
  z14.strictObject({ status: z14.literal("stale"), observationHash: ContentHashSchema, reason }),
  z14.strictObject({ status: z14.literal("unknown"), reason })
]);
var fulfillment = z14.strictObject({ status: z14.enum(["satisfied", "violated", "unknown"]), reason });
var ApplicationEvidenceAssessmentSchema = z14.strictObject({
  schemaVersion: z14.literal(applicationEvidenceAssessmentSchemaVersion),
  request: ApplicationEvidenceAssessmentRequestSchema,
  custody,
  currentness,
  fulfillment,
  dependencies: z14.array(StateValueDependencyRefSchema).max(256),
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
import { z as z15 } from "zod";
var applicationObservationPlanSchemaVersion = "application-observation-plan@1";
var applicationObservationResultSchemaVersion = "application-observation-result@1";
var boundedIdentity = z15.string().min(1).max(512).regex(/^[^\0\r\n]+$/u);
var diagnostic = z15.strictObject({
  code: boundedIdentity,
  message: z15.string().min(1).max(4096)
});
var scenarioBinding = z15.strictObject({
  id: EntityIdSchema,
  semanticHash: ContentHashSchema
});
var cleanup = z15.strictObject({
  complete: z15.boolean(),
  resources: z15.array(z15.strictObject({
    kind: boundedIdentity,
    handle: boundedIdentity,
    outcome: z15.enum(["released", "not-found", "retained-for-recovery", "release-failed"])
  })).max(256),
  diagnostics: z15.array(diagnostic).max(64)
});
var recovery = z15.strictObject({
  code: boundedIdentity,
  message: z15.string().min(1).max(4096),
  action: z15.string().min(1).max(4096),
  artifactRefs: z15.array(boundedIdentity).max(64)
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
  const ApplicationObservationPlanSchema = z15.strictObject({
    schemaVersion: z15.literal(applicationObservationPlanSchemaVersion),
    runId: boundedIdentity,
    scenario: scenarioBinding,
    case: boundedIdentity,
    adapter: z15.strictObject({
      id: z15.literal(input.adapterId),
      version: z15.literal(input.adapterVersion),
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
  const ApplicationObservationResultSchema = z15.strictObject({
    schemaVersion: z15.literal(applicationObservationResultSchemaVersion),
    runId: boundedIdentity,
    scenario: scenarioBinding,
    case: boundedIdentity,
    adapter: z15.strictObject({
      id: z15.literal(input.adapterId),
      version: z15.literal(input.adapterVersion),
      inputHash: ContentHashSchema,
      outputHash: ContentHashSchema,
      output: input.adapterOutputSchema
    }),
    operationalStatus: z15.enum(["completed", "failed", "cancelled"]),
    outcome: z15.enum(["passed", "failed", "unavailable"]),
    currentness: z15.enum(["current", "stale", "unknown"]),
    assurance: z15.literal("supporting"),
    diagnostics: z15.array(diagnostic).max(64),
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
  const ApplicationObservationExchangeSchema = z15.strictObject({
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
import { z as z16 } from "zod";
var CompletionAssessmentSchema = z16.object({
  status: z16.enum(["violated", "unknown", "unavailable"]),
  category: z16.enum(["authority-problem", "rule-violation", "conflicting-rules", "unreachable-selector", "missing-validator", "unrealized-behavior", "missing-evidence", "meaning-gap"])
}).strict();
var CompletionRepairRouteSchema = z16.enum(["canonical-proposal", "implementation-repair", "missing-evidence"]);
var CompletionRepairAlternativeSchema = z16.object({
  strategy: z16.enum(["reuse", "revalidate", "regenerate", "deterministic-patch", "agent-repair", "widen-analysis", "human-decision"]),
  status: z16.enum(["available", "unavailable", "skipped"]),
  reason: z16.string().min(1),
  capabilityIds: z16.array(z16.string())
}).strict();

export {
  ObservationLimitsSchema,
  ObservationLimitsOverrideSchema,
  DEFAULT_OBSERVATION_LIMITS,
  resolveObservationLimits,
  ObservationDescriptorSchema,
  ObservationError,
  ObservationBudget,
  DerivedObservationBudget,
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
