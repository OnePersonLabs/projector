import {
  DEFAULT_OBSERVATION_LIMITS,
  DerivedObservationBudget,
  ObservationBudget,
  ObservationError,
  canonicalJson,
  deriveEntityId,
  hashFramedCanonicalJsonChunks,
  hashFramedDomain,
  observationLimitValue
} from "./shared-Q56AARV7.js";

// node_modules/@projector/analyzers/dist/filesystem/inventory.js
import { constants as constants3 } from "node:fs";
import { lstat, open as open3, opendir, readlink } from "node:fs/promises";
import { createHash as createHash2 } from "node:crypto";
import { dirname, isAbsolute as isAbsolute3, join as join3, relative, resolve, sep } from "node:path";

// node_modules/@projector/analyzers/dist/ordering.js
function compareCodePoint(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

// node_modules/@projector/analyzers/dist/filesystem/observation-io.js
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { StringDecoder } from "node:string_decoder";
function observationFailure(error, stage, scope = ".") {
  return error instanceof ObservationError ? error : new ObservationError("observation-failed", stage, scope, error instanceof Error ? error.message : String(error));
}
function checkObservation(budget, signal, stage = "collection", scope = ".") {
  budget.check(stage, scope);
  if (signal?.aborted)
    throw new ObservationError("observation-failed", stage, scope, "Repository observation cancelled.");
}
async function observationMap(items, action, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted)
    abort();
  const results = new Array(items.length);
  let cursor = 0, failure2;
  const worker = async () => {
    while (!controller.signal.aborted && cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await action(items[index], controller.signal);
      } catch (error) {
        failure2 ??= error;
        controller.abort();
      }
    }
  };
  try {
    await Promise.allSettled(Array.from({ length: Math.min(4, items.length) }, () => worker()));
    if (failure2 !== void 0)
      throw failure2;
    if (controller.signal.aborted)
      throw new ObservationError("observation-failed", "collection", ".", "Repository observation cancelled.");
    return results;
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}
async function readObservationFile(path, budget, scope, signal) {
  checkObservation(budget, signal, "file-read", scope);
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile())
      throw new Error("Observation source is not a regular file");
    budget.assertFileBytes(stat.size, scope);
    budget.assertTotalBytes(stat.size, scope);
    const chunks2 = [];
    let size = 0;
    while (true) {
      checkObservation(budget, signal, "file-read", scope);
      const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, observationLimitValue(budget.limits.maxFileBytes) - size + 1, budget.remaining("maxTotalBytes") + 1));
      const { bytesRead } = await handle.read(buffer);
      if (bytesRead === 0)
        break;
      size += bytesRead;
      budget.assertFileBytes(size, scope);
      budget.consume("maxTotalBytes", bytesRead, "file-read", scope);
      chunks2.push(buffer.subarray(0, bytesRead));
    }
    return Buffer.concat(chunks2, size);
  } catch (error) {
    throw observationFailure(error, "file-read", scope);
  } finally {
    await handle?.close();
  }
}
function environment() {
  const result = {};
  for (const key of ["PATH", "PATHEXT", "SystemRoot", "WINDIR", "TMP", "TEMP", "TMPDIR"]) {
    if (process.env[key] !== void 0)
      result[key] = process.env[key];
  }
  return {
    ...result,
    LANG: "C",
    LC_ALL: "C",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_ATTR_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    GIT_OPTIONAL_LOCKS: "0"
  };
}
var GitCommandError = class extends ObservationError {
  exitCode;
  stderr;
  constructor(exitCode, stderr, stage) {
    super("observation-failed", stage, ".", `Git observation failed (${exitCode ?? "signal"}): ${stderr.trim()}`);
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
};
async function observationGitRecords(root, args, budget, consume, options = {}) {
  const decoder = new StringDecoder("utf8");
  let pending = "";
  const accept = (text) => {
    pending += text;
    let start = 0, end;
    while ((end = pending.indexOf("\0", start)) !== -1) {
      consume(pending.slice(start, end));
      start = end + 1;
    }
    pending = pending.slice(start);
  };
  await observationGit(root, args, budget, { ...options, consumeStdout: (chunk) => accept(decoder.write(chunk)) });
  accept(decoder.end());
  if (pending !== "")
    throw new ObservationError("observation-failed", options.stage ?? "git-records", ".", "Git records are not NUL terminated");
}
async function observationGit(root, args, budget, options = {}) {
  return observationGitResult(root, args, budget, options, (output) => output.toString("utf8"));
}
async function observationGitBytes(root, args, budget, options = {}) {
  return observationGitResult(root, args, budget, options, (output) => output);
}
async function observationGitResult(root, args, budget, options, result) {
  const stage = options.stage ?? "git-facts";
  checkObservation(budget, options.signal, stage);
  if (options.executable !== void 0 && !isAbsolute(options.executable))
    throw new Error("Host-selected Git executable must be absolute");
  return new Promise((resolve5, reject) => {
    const child = spawn(options.executable ?? "git", [
      "-c",
      "core.fsmonitor=false",
      "-c",
      "core.untrackedCache=false",
      "-c",
      `core.hooksPath=${process.platform === "win32" ? "NUL" : "/dev/null"}`,
      ...args
    ], { cwd: root, env: environment(), stdio: ["pipe", "pipe", "pipe"], windowsHide: true, detached: process.platform !== "win32" });
    const stdout = [], stderr = [];
    let failure2;
    let termination = Promise.resolve();
    const stop = (error) => {
      if (failure2 !== void 0)
        return;
      failure2 = observationFailure(error, stage);
      if (child.pid === void 0)
        return;
      if (process.platform !== "win32") {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch (killError) {
          if (killError.code !== "ESRCH")
            child.kill("SIGKILL");
        }
      } else {
        const killer = spawn(join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe"), ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
        termination = new Promise((done) => {
          killer.on("error", () => {
            child.kill("SIGKILL");
            done();
          });
          killer.on("close", () => done());
        });
      }
    };
    const onAbort = () => stop(new Error("Repository observation cancelled."));
    options.signal?.addEventListener("abort", onAbort, { once: true });
    const remaining = budget.remainingMs();
    const timer = Number.isFinite(remaining) ? setTimeout(() => stop(new ObservationError("observation-limit-exceeded", stage, ".", "Repository observation exceeded the caller-requested deadline.", "timeoutMs", budget.limits.timeoutMs ?? void 0)), remaining) : void 0;
    const collect = (target, chunk) => {
      if (failure2 !== void 0)
        return;
      try {
        budget.consume("maxGitOutputBytes", chunk.length, stage);
        target.push(chunk);
      } catch (error) {
        stop(error);
      }
    };
    child.stdout.on("data", (chunk) => {
      if (options.consumeStdout === void 0) {
        collect(stdout, chunk);
        return;
      }
      if (failure2 !== void 0)
        return;
      try {
        budget.consume("maxGitOutputBytes", chunk.length, stage);
        options.consumeStdout(chunk);
      } catch (error) {
        stop(error);
      }
    });
    child.stderr.on("data", (chunk) => collect(stderr, chunk));
    child.on("error", stop);
    child.stdin.on("error", (error) => {
      if (error.code !== "EPIPE")
        stop(error);
    });
    child.on("close", async (code) => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      await termination;
      if (failure2 !== void 0) {
        reject(failure2);
        return;
      }
      if (code !== 0 && !options.allowedExitCodes?.includes(code ?? -1)) {
        reject(new GitCommandError(code, Buffer.concat(stderr).toString("utf8"), stage));
        return;
      }
      resolve5(result(Buffer.concat(stdout)));
    });
    child.stdin.end(options.input);
    if (options.signal?.aborted)
      onAbort();
  });
}

// node_modules/@projector/analyzers/dist/filesystem/inventory-content-store.js
import { createHash, randomUUID } from "node:crypto";
import { constants as constants2, mkdirSync, rmSync } from "node:fs";
import { open as open2 } from "node:fs/promises";
import { isAbsolute as isAbsolute2, join as join2, toNamespacedPath } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { StringDecoder as StringDecoder2 } from "node:string_decoder";
function frame(hash, value) {
  const size = Buffer.allocUnsafe(8);
  size.writeBigUInt64BE(BigInt(value.length));
  hash.update(size);
  hash.update(value);
}
var InventoryContentStore = class _InventoryContentStore {
  descriptor;
  db;
  writable;
  closed = false;
  lastRead;
  constructor(path, writable, append = false) {
    if (!isAbsolute2(path))
      throw new TypeError("Inventory capture requires an absolute path");
    this.descriptor = { schemaVersion: "projector.inventory-content/v1", path };
    this.writable = writable;
    this.db = new DatabaseSync(toNamespacedPath(path), { readOnly: !writable });
    if (writable && !append)
      this.db.exec(`
      PRAGMA journal_mode=DELETE;
      CREATE TABLE inventory_entries(path TEXT PRIMARY KEY, metadata TEXT NOT NULL) STRICT;
      CREATE TABLE inventory_content(path TEXT NOT NULL, sequence INTEGER NOT NULL, bytes BLOB NOT NULL,
        PRIMARY KEY(path,sequence)) STRICT, WITHOUT ROWID;
      PRAGMA user_version=1;
      BEGIN IMMEDIATE;
    `);
    else if (this.db.prepare("PRAGMA user_version").get()?.user_version !== 1) {
      this.db.close();
      this.closed = true;
      throw new Error("Unsupported inventory capture version");
    }
    if (append)
      this.db.exec("BEGIN IMMEDIATE");
  }
  static create(directory) {
    mkdirSync(directory, { recursive: true });
    return new _InventoryContentStore(join2(directory, `${randomUUID().replaceAll("-", "")}.db`), true);
  }
  static open(descriptor) {
    if (descriptor.schemaVersion !== "projector.inventory-content/v1")
      throw new Error("Unsupported inventory capture descriptor");
    return new _InventoryContentStore(descriptor.path, false);
  }
  static append(descriptor) {
    if (descriptor.schemaVersion !== "projector.inventory-content/v1")
      throw new Error("Unsupported inventory capture descriptor");
    return new _InventoryContentStore(descriptor.path, true, true);
  }
  finish() {
    if (this.writable) {
      this.db.exec("COMMIT");
      this.writable = false;
    }
  }
  beginAppend() {
    if (!this.writable) {
      this.db.exec("BEGIN IMMEDIATE");
      this.writable = true;
    }
  }
  close() {
    if (this.closed)
      return;
    if (this.db.isTransaction)
      this.db.exec("ROLLBACK");
    this.db.close();
    this.closed = true;
    this.lastRead = void 0;
  }
  dispose() {
    this.close();
    rmSync(this.descriptor.path, { force: true });
  }
  put(metadata, content) {
    return this.putChunks(metadata, [Buffer.from(content)]);
  }
  putChunks(metadata, chunks2) {
    const { content: _content, ...fields } = metadata;
    const insert = this.db.prepare("INSERT INTO inventory_content(path,sequence,bytes) VALUES(?,?,?)");
    let sequence = 0;
    for (const bytes of chunks2)
      for (let offset = 0; offset < bytes.length; offset += 64 * 1024)
        insert.run(metadata.path, sequence++, bytes.subarray(offset, offset + 64 * 1024));
    this.db.prepare("INSERT INTO inventory_entries(path,metadata) VALUES(?,?)").run(metadata.path, JSON.stringify(fields));
    return this.entry(fields);
  }
  async capture(path, absolute, mediaType2, budget, signal) {
    const handle = await open2(absolute, constants2.O_RDONLY | (constants2.O_NOFOLLOW ?? 0));
    try {
      const before = await handle.stat();
      if (!before.isFile())
        throw new Error(`Inventory source is not a regular file: ${path}`);
      budget.assertFileBytes(before.size, path);
      budget.assertTotalBytes(before.size, path);
      const hash = createHash("sha256");
      frame(hash, Buffer.from("projector\0sha256\0v1"));
      frame(hash, Buffer.from("repository-artifact-content"));
      const encodedLength = 4 * Math.ceil(before.size / 3) + 2;
      const length = Buffer.allocUnsafe(8);
      length.writeBigUInt64BE(BigInt(encodedLength));
      hash.update(length);
      hash.update('"');
      const insert = this.db.prepare("INSERT INTO inventory_content(path,sequence,bytes) VALUES(?,?,?)");
      let sequence = 0, size = 0, remainder = Buffer.alloc(0), prefix = Buffer.alloc(0);
      const chunk = Buffer.allocUnsafe(64 * 1024);
      while (true) {
        signal?.throwIfAborted();
        budget.check("inventory-capture", path);
        const { bytesRead } = await handle.read(chunk);
        if (bytesRead === 0)
          break;
        size += bytesRead;
        budget.assertFileBytes(size, path);
        budget.consume("maxTotalBytes", bytesRead, "inventory-capture", path);
        const bytes = chunk.subarray(0, bytesRead);
        insert.run(path, sequence++, bytes);
        if (prefix.length < 4096)
          prefix = Buffer.concat([prefix, bytes.subarray(0, 4096 - prefix.length)]);
        const encoded = remainder.length === 0 ? bytes : Buffer.concat([remainder, bytes]);
        const complete = encoded.length - encoded.length % 3;
        hash.update(encoded.subarray(0, complete).toString("base64"));
        remainder = Buffer.from(encoded.subarray(complete));
      }
      hash.update(remainder.toString("base64"));
      hash.update('"');
      const after = await handle.stat();
      if (size !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs || after.ino !== before.ino)
        throw new ObservationError("observation-failed", "inventory-capture", path, "Source changed while its observation was captured");
      const generated = /(?:@generated|generated file|do not edit)/iu.test(prefix.toString("utf8").slice(0, 1024));
      const metadata = {
        path,
        kind: "file",
        mediaType: mediaType2,
        contentHash: `sha256:v1:${hash.digest("hex")}`,
        generated,
        contentBytes: size,
        ...generated ? { generatedReason: "source-marker" } : {}
      };
      this.db.prepare("INSERT INTO inventory_entries(path,metadata) VALUES(?,?)").run(path, JSON.stringify(metadata));
      return this.entry(metadata);
    } finally {
      await handle.close();
    }
  }
  read(path) {
    if (this.closed)
      throw new Error("Inventory capture is closed");
    if (this.lastRead?.path === path)
      return this.lastRead.content;
    const parts = [];
    for (const chunk of this.chunks(path))
      parts.push(Buffer.from(chunk));
    const content = Buffer.concat(parts).toString("utf8");
    this.lastRead = { path, content };
    return content;
  }
  *chunks(path) {
    const record = this.db.prepare("SELECT metadata FROM inventory_entries WHERE path=?").get(path);
    if (record === void 0)
      throw new Error(`Inventory capture entry is missing: ${path}`);
    const expected = JSON.parse(String(record.metadata)).contentBytes;
    let bytes = 0;
    for (const row of this.db.prepare("SELECT bytes FROM inventory_content WHERE path=? ORDER BY sequence").iterate(path)) {
      const chunk = row.bytes;
      bytes += chunk.byteLength;
      yield chunk;
    }
    if (bytes !== expected)
      throw new Error(`Inventory capture content is incomplete: ${path}`);
  }
  entry(metadata) {
    const { contentBytes: _size, ...fields } = metadata;
    return Object.defineProperties(fields, {
      content: { enumerable: true, get: () => this.read(metadata.path) },
      contentBytes: { enumerable: false, value: metadata.contentBytes },
      contentChunks: { enumerable: false, value: () => this.chunks(metadata.path) }
    });
  }
  entries(paths) {
    if (paths !== void 0)
      return paths.map((path) => {
        const row = this.db.prepare("SELECT metadata FROM inventory_entries WHERE path=?").get(path);
        if (row === void 0)
          throw new Error(`Captured inventory entry is missing: ${path}`);
        return this.entry(JSON.parse(String(row.metadata)));
      });
    return [...this.db.prepare("SELECT metadata FROM inventory_entries ORDER BY path").iterate()].map((row) => this.entry(JSON.parse(String(row.metadata))));
  }
};
function inventoryEntryBytes(entry) {
  return "contentBytes" in entry && typeof entry.contentBytes === "number" ? entry.contentBytes : Buffer.byteLength(entry.content);
}
function inventoryEntryWithBytes(entry, bytes) {
  return Object.defineProperties(entry, { contentBytes: { value: bytes.byteLength }, contentChunks: { value: () => [bytes] } });
}
function inventoryEntryChunks(entry) {
  const source = entry;
  return source.contentChunks?.() ?? [Buffer.from(entry.content)];
}
var textHashes = /* @__PURE__ */ new WeakMap();
function inventoryTextHash(entry, domain) {
  if (!("contentChunks" in entry))
    return hashFramedDomain(domain, entry.content);
  const cached = textHashes.get(entry) ?? /* @__PURE__ */ new Map();
  const previous = cached.get(domain);
  if (previous !== void 0)
    return previous;
  function* jsonText() {
    const decoder = new StringDecoder2("utf8");
    yield '"';
    for (const bytes of inventoryEntryChunks(entry))
      yield JSON.stringify(decoder.write(bytes)).slice(1, -1);
    yield JSON.stringify(decoder.end()).slice(1, -1);
    yield '"';
  }
  const hash = hashFramedCanonicalJsonChunks(domain, jsonText);
  cached.set(domain, hash);
  textHashes.set(entry, cached);
  return hash;
}
function inventoryForTransport(inventory) {
  if (inventory.contentStore === void 0)
    return inventory;
  return { ...inventory, contentStore: { ...inventory.contentStore, paths: inventory.entries.map((entry) => entry.path) }, entries: [] };
}
function hydrateInventory(inventory) {
  if (inventory.contentStore === void 0)
    return { inventory, close() {
    } };
  if (inventory.contentStore.schemaVersion !== "projector.inventory-content/v1")
    throw new Error("Source-content v2 captures require runtime hydration");
  const store = InventoryContentStore.open(inventory.contentStore);
  return { inventory: { ...inventory, entries: store.entries(inventory.contentStore.paths) }, close: () => store.close() };
}

// node_modules/@projector/analyzers/dist/filesystem/inventory.js
var Base64ContentHasher = class {
  hash = createHash2("sha256");
  carry = Buffer.alloc(0);
  constructor(size) {
    for (const part of ["projector\0sha256\0v1", "repository-artifact-content"]) {
      const bytes = Buffer.from(part);
      const length = Buffer.allocUnsafe(8);
      length.writeBigUInt64BE(BigInt(bytes.length));
      this.hash.update(length).update(bytes);
    }
    const frameLength = Buffer.allocUnsafe(8);
    frameLength.writeBigUInt64BE(4n * ((BigInt(size) + 2n) / 3n) + 2n);
    this.hash.update(frameLength).update('"');
  }
  update(input) {
    const bytes = this.carry.length === 0 ? Buffer.from(input) : Buffer.concat([this.carry, input]);
    const complete = bytes.length - bytes.length % 3;
    if (complete > 0)
      this.hash.update(bytes.subarray(0, complete).toString("base64"));
    this.carry = Buffer.from(bytes.subarray(complete));
  }
  digest() {
    if (this.carry.length > 0)
      this.hash.update(this.carry.toString("base64"));
    this.hash.update('"');
    return `sha256:v1:${this.hash.digest("hex")}`;
  }
};
async function fileIdentity(path, absolute, media, budget, signal) {
  const handle = await open3(absolute, constants3.O_RDONLY | (constants3.O_NOFOLLOW ?? 0));
  try {
    const before = await handle.stat();
    if (!before.isFile())
      throw new ObservationError("observation-failed", "inventory-proof", path, "Inventory source is not a regular file");
    budget.assertFileBytes(before.size, path);
    const digest = new Base64ContentHasher(before.size);
    let total = 0;
    let prefix = Buffer.alloc(0);
    const buffer = Buffer.allocUnsafe(64 * 1024);
    while (true) {
      checkObservation(budget, signal, "inventory-proof", path);
      const { bytesRead } = await handle.read(buffer);
      if (bytesRead === 0)
        break;
      const bytes = buffer.subarray(0, bytesRead);
      total += bytesRead;
      budget.assertFileBytes(total, path);
      budget.consume("maxTotalBytes", bytesRead, "inventory-proof", path);
      digest.update(bytes);
      if (prefix.length < 4096)
        prefix = Buffer.concat([prefix, bytes.subarray(0, 4096 - prefix.length)]);
    }
    const after = await handle.stat();
    if (total !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs || after.ino !== before.ino)
      throw new ObservationError("observation-failed", "inventory-proof", path, "Source changed during final inventory proof");
    const generated = /(?:@generated|generated file|do not edit)/iu.test(prefix.toString("utf8").slice(0, 1024));
    return {
      path,
      kind: "file",
      mediaType: media,
      contentHash: digest.digest(),
      generated,
      ...generated ? { generatedReason: "source-marker" } : {}
    };
  } finally {
    await handle.close();
  }
}
var inventoryBytes = /* @__PURE__ */ new WeakMap();
var excludedPrefixes = [".git", ".worktrees", ".projector/runtime"];
var fallbackDirectories = /* @__PURE__ */ new Set([".git", ".worktrees", "node_modules"]);
function repositoryPath(root, absolute) {
  return relative(root, absolute).split(sep).join("/");
}
function isExcludedInventoryPath(path) {
  return excludedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
function mediaType(path) {
  if (path.endsWith(".json"))
    return "application/json";
  if (/\.ya?ml$/u.test(path))
    return "application/yaml";
  if (path.endsWith(".toml"))
    return "application/toml";
  if (/\.(?:mjs|cjs|js|jsx)$/u.test(path))
    return "text/javascript";
  if (/\.(?:mts|cts|ts|tsx)$/u.test(path))
    return "text/typescript";
  if (path.endsWith(".md"))
    return "text/markdown";
  return "application/octet-stream";
}
function missing(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
async function readInventoryEntry(repositoryRoot, path, budget, signal, capture) {
  const root = resolve(repositoryRoot);
  checkObservation(budget, signal, "delta-file-read", path);
  if (!path || isAbsolute3(path) || path.includes("\\") || path.includes("\0") || path.split("/").some((part) => !part || part === "." || part === ".."))
    throw new ObservationError("observation-failed", "delta-file-read", path, "Invalid inventory delta path");
  if (isExcludedInventoryPath(path))
    return void 0;
  const absolute = resolve(root, ...path.split("/"));
  let stat;
  try {
    stat = await lstat(absolute);
  } catch (error) {
    if (missing(error))
      return void 0;
    throw observationFailure(error, "delta-file-read", path);
  }
  for (let parent = dirname(absolute); parent !== root; parent = dirname(parent))
    if ((await lstat(parent)).isSymbolicLink())
      throw new ObservationError("observation-failed", "symlink-parent", path, "Inventory delta traverses a symbolic-link parent");
  if (!stat.isFile() && !stat.isSymbolicLink())
    return void 0;
  budget.consume("maxFiles", 1, "delta-file-read", path);
  if (stat.isSymbolicLink()) {
    const symlinkTarget = await readlink(absolute);
    const bytes2 = Buffer.byteLength(symlinkTarget);
    budget.assertFileBytes(bytes2, path);
    budget.consume("maxTotalBytes", bytes2, "delta-symlink-read", path);
    const entry = { path, kind: "symlink", mediaType: "inode/symlink", content: symlinkTarget, contentHash: hashFramedDomain("repository-artifact-content", symlinkTarget), generated: false, symlinkTarget };
    return capture === void 0 ? entry : await capture.put({ ...entry, contentBytes: bytes2 }, symlinkTarget);
  }
  if (capture !== void 0)
    return capture.capture(path, absolute, mediaType(path), budget, signal);
  const bytes = await readObservationFile(absolute, budget, path, signal), content = bytes.toString("utf8");
  const generated = /(?:@generated|generated file|do not edit)/iu.test(content.slice(0, 1024));
  return inventoryEntryWithBytes({ path, kind: "file", mediaType: mediaType(path), content, contentHash: hashFramedDomain("repository-artifact-content", bytes.toString("base64")), generated, ...generated ? { generatedReason: "source-marker" } : {} }, bytes);
}
async function confirmedNonGit(root, error) {
  if (!(error instanceof GitCommandError) || !/not a git repository/iu.test(error.stderr))
    return false;
  for (let directory = root; ; directory = dirname(directory)) {
    try {
      await lstat(join3(directory, ".git"));
      return false;
    } catch (markerError) {
      if (!missing(markerError))
        return false;
    }
    if (dirname(directory) === directory)
      return true;
  }
}
async function inventoryRepositoryIdentities(repositoryRoot, options = {}) {
  const scanned = await scanInventory(repositoryRoot, options, true);
  return {
    entries: scanned.entries.map(({ path, kind, mediaType: mediaType2, contentHash, generated, generatedReason, symlinkTarget }) => ({
      path,
      kind,
      mediaType: mediaType2,
      contentHash,
      generated,
      ...generatedReason === void 0 ? {} : { generatedReason },
      ...symlinkTarget === void 0 ? {} : { symlinkTarget }
    })),
    failures: scanned.failures,
    rootAvailability: scanned.rootAvailability,
    ...scanned.directories === void 0 ? {} : { directories: scanned.directories },
    observationDescriptor: scanned.observationDescriptor,
    enumeration: scanned.enumeration
  };
}
async function inventoryRepository(repositoryRoot, options = {}) {
  return scanInventory(repositoryRoot, options, false);
}
async function scanInventory(repositoryRoot, options, identitiesOnly) {
  const root = resolve(repositoryRoot), budget = options.budget ?? new ObservationBudget(options.observationLimits);
  const signal = options.signal;
  const entries = [], ignoreSources = [];
  const capturedBytes = /* @__PURE__ */ new Map();
  const generation = options.byteReuse === void 0 ? void 0 : inventoryBytes.get(options.byteReuse.baseline);
  const baseline = generation?.root === root ? generation.entries : void 0;
  if (baseline !== void 0)
    for (const [path, cached] of baseline) {
      checkObservation(budget, signal, "byte-reuse-admission", path);
      budget.assertFileBytes(cached.size, path);
      budget.consume("maxTotalBytes", cached.size, "byte-reuse-admission", path);
    }
  const countedFiles = /* @__PURE__ */ new Set(), countedDirectories = /* @__PURE__ */ new Set();
  const countFile = (path) => {
    if (!countedFiles.has(path)) {
      budget.consume("maxFiles", 1, "file-enumeration", path);
      countedFiles.add(path);
    }
  };
  const countDirectory = (path) => {
    if (!countedDirectories.has(path)) {
      budget.consume("maxDirectories", 1, "directory-enumeration", path);
      countedDirectories.add(path);
    }
  };
  let method = "git-index-and-nonignored-untracked";
  const paths = /* @__PURE__ */ new Set();
  try {
    await observationGitRecords(root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], budget, (path) => {
      if (path && !isExcludedInventoryPath(path)) {
        countFile(path);
        paths.add(path);
      }
    }, { ...signal === void 0 ? {} : { signal }, stage: "git-inventory" });
  } catch (error) {
    if (!await confirmedNonGit(root, error))
      throw observationFailure(error, "git-inventory");
    method = "recursive-filesystem-fallback";
  }
  const git = (args, input, allowedExitCodes) => observationGit(root, args, budget, { ...signal === void 0 ? {} : { signal }, ...input === void 0 ? {} : { input }, ...allowedExitCodes === void 0 ? {} : { allowedExitCodes }, stage: "ignore-boundary" });
  async function fingerprint(absolute, source, activeSignal = signal) {
    let stat;
    try {
      stat = await lstat(absolute);
    } catch (error) {
      if (missing(error))
        return;
      throw error;
    }
    if (stat.isSymbolicLink())
      throw new ObservationError("observation-failed", "ignore-boundary", source, "Ignore/config source is a symbolic link; cannot bind a stable boundary.");
    if (!stat.isFile())
      throw new ObservationError("observation-failed", "ignore-boundary", source, "Ignore/config source is not a regular file.");
    countFile(source);
    const bytes = await readObservationFile(absolute, budget, source, activeSignal);
    ignoreSources.push({ path: source, contentHash: hashFramedDomain("repository-ignore-source", bytes.toString("base64")) });
  }
  async function inspect(path, allowDeleted = false, activeSignal = signal) {
    checkObservation(budget, activeSignal, "file-enumeration", path);
    if (!path || isAbsolute3(path) || path.includes("\0"))
      throw new Error("Git returned an invalid repository path");
    const absolute = resolve(root, ...path.split("/")), fromRoot = relative(root, absolute);
    if (!fromRoot || fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute3(fromRoot))
      throw new Error("Git returned a path outside the repository root");
    let stat;
    try {
      stat = await lstat(absolute);
    } catch (error) {
      if (allowDeleted && missing(error))
        return;
      throw observationFailure(error, "artifact-metadata", path);
    }
    for (let parent = dirname(absolute); parent !== root; parent = dirname(parent)) {
      if ((await lstat(parent)).isSymbolicLink())
        throw new ObservationError("observation-failed", "symlink-parent", path, "Git-selected path traverses a symbolic-link parent");
    }
    if (!stat.isFile() && !stat.isSymbolicLink())
      return;
    countFile(path);
    const cached = baseline?.get(path);
    const reuse = options.byteReuse;
    if (cached !== void 0 && reuse !== void 0 && cached.entry.kind === (stat.isSymbolicLink() ? "symlink" : "file") && !reuse.changedPaths.some((changed) => path === changed || path.startsWith(`${changed}/`)) && !reuse.uncoveredPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.split("/").includes(prefix))) {
      budget.assertFileBytes(cached.size, path);
      const sourceVersionId = cached.entry.sourceVersionId;
      const cachedMetadata = Object.fromEntries(Object.keys(cached.entry).filter((key) => key !== "content").map((key) => [key, cached.entry[key]]));
      const entry = options.contentStore === void 0 ? cached.entry : sourceVersionId !== void 0 && options.contentStore.linkExisting !== void 0 ? options.contentStore.linkExisting({ ...cachedMetadata, contentBytes: cached.size }, sourceVersionId) : await options.contentStore.putChunks({ ...cachedMetadata, contentBytes: cached.size }, inventoryEntryChunks(cached.entry));
      entries.push(entry);
      capturedBytes.set(path, { entry, size: cached.size });
      return;
    }
    if (stat.isSymbolicLink()) {
      const symlinkTarget = await readlink(absolute);
      const size = Buffer.byteLength(symlinkTarget);
      budget.assertFileBytes(size, path);
      budget.consume("maxTotalBytes", size, "symlink-read", path);
      const entry = {
        path,
        kind: "symlink",
        mediaType: "inode/symlink",
        content: symlinkTarget,
        contentHash: hashFramedDomain("repository-artifact-content", symlinkTarget),
        generated: false,
        symlinkTarget
      };
      entries.push(options.contentStore === void 0 ? entry : await options.contentStore.put({ ...entry, contentBytes: size }, symlinkTarget));
      capturedBytes.set(path, { entry: Object.freeze(Object.defineProperties({}, Object.getOwnPropertyDescriptors(entries.at(-1)))), size });
      return;
    }
    if (identitiesOnly) {
      const identity = await fileIdentity(path, absolute, mediaType(path), budget, activeSignal);
      const entry = identity;
      entries.push(entry);
      return;
    }
    if (options.contentStore !== void 0) {
      const entry = await options.contentStore.capture(path, absolute, mediaType(path), budget, activeSignal);
      entries.push(entry);
      capturedBytes.set(path, { entry, size: stat.size });
      return;
    }
    const bytes = await readObservationFile(absolute, budget, path, activeSignal), content = bytes.toString("utf8");
    const generated = /(?:@generated|generated file|do not edit)/iu.test(content.slice(0, 1024));
    entries.push(inventoryEntryWithBytes({
      path,
      kind: "file",
      mediaType: mediaType(path),
      content,
      contentHash: hashFramedDomain("repository-artifact-content", bytes.toString("base64")),
      generated,
      ...generated ? { generatedReason: "source-marker" } : {}
    }, bytes));
    capturedBytes.set(path, { entry: Object.freeze(Object.defineProperties({}, Object.getOwnPropertyDescriptors(entries.at(-1)))), size: bytes.length });
  }
  async function visit(directory, activeSignal = signal) {
    const scope = repositoryPath(root, directory) || ".";
    countDirectory(scope);
    if (method === "git-index-and-nonignored-untracked")
      await fingerprint(join3(directory, ".gitignore"), scope === "." ? ".gitignore" : `${scope}/.gitignore`, activeSignal);
    const directories = [];
    const handle = await opendir(directory, { bufferSize: 32 });
    for await (const child of handle) {
      checkObservation(budget, activeSignal, "directory-enumeration", scope);
      const absolute = join3(directory, child.name), path = repositoryPath(root, absolute);
      if (isExcludedInventoryPath(path))
        continue;
      if (child.isDirectory()) {
        if (method === "recursive-filesystem-fallback" && fallbackDirectories.has(child.name))
          continue;
        countDirectory(path);
        directories.push(path);
      } else if (method === "recursive-filesystem-fallback")
        await inspect(path, false, activeSignal);
      else
        countFile(path);
    }
    return directories;
  }
  try {
    if (method === "git-index-and-nonignored-untracked") {
      const deleted = new Set((await git(["ls-files", "--deleted", "-z"])).split("\0").filter(Boolean));
      await observationMap([...paths].sort(compareCodePoint), (path, signal2) => inspect(path, deleted.has(path), signal2), signal);
      const boundary = await observationMap([
        ["rev-parse", "--git-path", "config"],
        ["rev-parse", "--git-path", "config.worktree"],
        ["rev-parse", "--git-path", "info/exclude"],
        ["config", "--show-origin", "--null", "--list"],
        ["config", "--path", "--get", "core.excludesFile"]
      ], (args, signal2) => observationGit(root, args, budget, { signal: signal2, stage: "ignore-boundary", allowedExitCodes: args.includes("--get") ? [1] : [] }), signal);
      ignoreSources.push({ path: "git:effective-config", contentHash: hashFramedDomain("repository-ignore-source", boundary[3]) });
      await observationMap(["config", "config.worktree", "info/exclude"], (name, signal2) => fingerprint(resolve(root, boundary[["config", "config.worktree", "info/exclude"].indexOf(name)].trim()), `git:${name}`, signal2), signal);
      const excludesFile = boundary[4].trim();
      if (excludesFile)
        await fingerprint(resolve(root, excludesFile), `git:core.excludesFile:${excludesFile}`);
    }
    let directories = [root];
    while (directories.length > 0) {
      const candidates = (await observationMap(directories, (directory, signal2) => visit(directory, signal2), signal)).flat();
      const ignored = /* @__PURE__ */ new Set();
      if (method === "git-index-and-nonignored-untracked" && candidates.length > 0) {
        const ignoredOutput = await git(["check-ignore", "--no-index", "-z", "--stdin"], candidates.map((path) => `${path}/\0`).join(""), [1]);
        for (const path of ignoredOutput.split("\0"))
          if (path)
            ignored.add(path.replace(/\/$/u, ""));
      }
      directories = candidates.filter((path) => !ignored.has(path)).map((path) => resolve(root, ...path.split("/")));
    }
  } catch (error) {
    throw observationFailure(error, "inventory");
  }
  entries.sort((a, b) => compareCodePoint(a.path, b.path));
  ignoreSources.sort((a, b) => compareCodePoint(a.path, b.path));
  if (options.deferContentStoreFinish !== true)
    await options.contentStore?.finish();
  const result = {
    ...options.contentStore === void 0 ? {} : { contentStore: options.contentStore.descriptor },
    entries,
    failures: [],
    rootAvailability: "available",
    directories: [...countedDirectories].sort(compareCodePoint),
    observationDescriptor: {
      schemaVersion: "projector.observation/v1",
      observerVersion: "3.0.0",
      scope: ".",
      enumerationMethod: method,
      limits: budget.limits,
      ignoreSources,
      excludedPaths: [...excludedPrefixes, ...method === "recursive-filesystem-fallback" ? ["**/node_modules"] : []],
      globalGitConfig: "disabled"
    },
    enumeration: {
      method,
      assumptions: [method === "git-index-and-nonignored-untracked" ? "Git CLI can read repository ignore and index metadata" : "repository root is readable"],
      blindSpots: method === "git-index-and-nonignored-untracked" ? ["untracked Git-ignored files outside the repository inventory", "excluded .git, .worktrees, and .projector/runtime contents"] : ["confirmed non-Git repository; recursive bounded enumeration used", "excluded .git, .worktrees, node_modules, and .projector/runtime contents"]
    }
  };
  inventoryBytes.set(result, { root, entries: capturedBytes });
  return result;
}

// node_modules/@projector/analyzers/dist/formats/documents.js
var scalarKind = (value) => /^(?:true|false)$/iu.test(value) ? "boolean" : /^[-+]?\d+(?:\.\d+)?$/u.test(value) ? "number" : /^(?:null|~)$/u.test(value) ? "null" : "string";
var pointer = (parts) => `/${parts.map(String).map((part) => part.replace(/~/gu, "~0").replace(/\//gu, "~1")).join("/")}`;
var unit = (path, value, line, column) => ({ stablePath: pointer(path), valueKind: scalarKind(value.trim()), line, column, contentHash: hashFramedDomain("structured-document-unit", { path, value: value.trim() }) });
var failure = (path, capability, message) => ({ analyzerId: "projector.structured-documents", capability, scope: path, message, recoverable: true, affectedClaimKinds: ["structured-document", "stable-path"] });
function duplicateJsonKeys(content) {
  const duplicates = /* @__PURE__ */ new Set();
  const stack = [];
  let index = 0;
  while (index < content.length) {
    const character = content[index];
    if (character === "{") {
      stack.push({ kind: "object", keys: /* @__PURE__ */ new Set() });
      index += 1;
      continue;
    }
    if (character === "[") {
      stack.push({ kind: "array" });
      index += 1;
      continue;
    }
    if (character === "}" || character === "]") {
      stack.pop();
      index += 1;
      continue;
    }
    if (character !== '"') {
      index += 1;
      continue;
    }
    const start = index;
    index = scanJsonString(content, index);
    let cursor = index;
    while (/\s/u.test(content[cursor] ?? ""))
      cursor += 1;
    const frame2 = stack.at(-1);
    if (content[cursor] !== ":" || frame2?.kind !== "object")
      continue;
    let key;
    try {
      key = JSON.parse(content.slice(start, index));
    } catch {
      continue;
    }
    if (frame2.keys.has(key))
      duplicates.add(key);
    else
      frame2.keys.add(key);
  }
  return [...duplicates].sort(compareCodePoint);
}
function scanJsonString(content, start) {
  let index = start + 1;
  let escaped = false;
  while (index < content.length) {
    const character = content[index];
    if (escaped)
      escaped = false;
    else if (character === "\\")
      escaped = true;
    else if (character === '"')
      return index + 1;
    index += 1;
  }
  return content.length;
}
function walkJson(value, path, units) {
  if (Array.isArray(value))
    value.forEach((item, index) => walkJson(item, [...path, index], units));
  else if (value !== null && typeof value === "object")
    for (const [key, item] of Object.entries(value).sort(([a], [b]) => compareCodePoint(a, b)))
      walkJson(item, [...path, key], units);
  else
    units.push(unit(path, value === null ? "null" : String(value), 1, 1));
}
function parseYaml(path, content) {
  const units = [];
  const unknowns = [];
  const stack = [];
  const sequenceIndexes = /* @__PURE__ */ new Map();
  const multiDocument = /^\s*---\s*$/mu.test(content);
  let documentIndex = multiDocument ? 0 : -1;
  let documentHasContent = false;
  const seen = /* @__PURE__ */ new Set();
  content.split(/\r?\n/u).forEach((line, lineIndex) => {
    if (/^\s*---\s*$/u.test(line)) {
      if (documentHasContent)
        documentIndex += 1;
      documentHasContent = false;
      stack.length = 0;
      return;
    }
    if (/![A-Za-z]/u.test(line))
      unknowns.push(`custom tag at line ${lineIndex + 1}`);
    if (/[&*][A-Za-z]/u.test(line))
      unknowns.push(`anchor or alias at line ${lineIndex + 1}`);
    const match = line.match(/^(\s*)(-\s*)?([^:#][^:]*):(?:\s*(.*))?$/u);
    if (match === null || line.trimStart().startsWith("#"))
      return;
    documentHasContent = true;
    const indent = match[1].length;
    const sequenceItem = match[2] !== void 0;
    const key = match[3].trim().replace(/^['"]|['"]$/gu, "");
    while (stack.at(-1) !== void 0 && stack.at(-1).indent >= indent)
      stack.pop();
    if (sequenceItem) {
      const sequencePath = pointer([...documentIndex >= 0 ? [documentIndex] : [], ...stack.map(({ key: part }) => part)]);
      const sequenceKey = `${sequencePath}\0${indent}`;
      const itemIndex = sequenceIndexes.get(sequenceKey) ?? 0;
      sequenceIndexes.set(sequenceKey, itemIndex + 1);
      stack.push({ indent, key: itemIndex });
    }
    const base = [...documentIndex >= 0 ? [documentIndex] : [], ...stack.map(({ key: key2 }) => key2), key];
    const value = match[4]?.trim() ?? "";
    if (value === "")
      stack.push({ indent: sequenceItem ? indent + 1 : indent, key });
    else {
      const stablePath = pointer(base);
      if (seen.has(stablePath))
        unknowns.push(`duplicate key ${stablePath} at line ${lineIndex + 1}`);
      else
        seen.add(stablePath);
      units.push(unit(base, value, lineIndex + 1, indent + 1));
    }
  });
  units.sort((a, b) => compareCodePoint(a.stablePath, b.stablePath));
  return { path, format: "yaml", units, unknowns: [...new Set(unknowns)].sort(compareCodePoint), contentHash: hashFramedDomain("structured-document", { path, units, unknowns }) };
}
function parseToml(path, content) {
  const units = [];
  const unknowns = [];
  let table = [];
  const arrays = /* @__PURE__ */ new Map();
  const keys = /* @__PURE__ */ new Set();
  content.split(/\r?\n/u).forEach((line, lineIndex) => {
    const clean = line.replace(/\s+#.*$/u, "").trim();
    if (clean === "")
      return;
    const arrayTable = clean.match(/^\[\[([^\]]+)\]\]$/u);
    if (arrayTable !== null) {
      const names = arrayTable[1].split(".").map((name) => name.trim());
      const base = pointer(names);
      const index = arrays.get(base) ?? 0;
      arrays.set(base, index + 1);
      table = [...names, index];
      return;
    }
    const ordinary = clean.match(/^\[([^\]]+)\]$/u);
    if (ordinary !== null) {
      table = ordinary[1].split(".").map((name) => name.trim());
      return;
    }
    const pair = clean.match(/^([^=]+?)\s*=\s*(.+)$/u);
    if (pair === null) {
      unknowns.push(`unsupported TOML syntax at line ${lineIndex + 1}`);
      return;
    }
    const parts = pair[1].split(".").map((name) => name.trim().replace(/^['"]|['"]$/gu, ""));
    const full = [...table, ...parts];
    const stablePath = pointer(full);
    if (keys.has(stablePath))
      unknowns.push(`duplicate key ${stablePath} at line ${lineIndex + 1}`);
    else
      keys.add(stablePath);
    units.push(unit(full, pair[2], lineIndex + 1, line.indexOf(pair[1]) + 1));
  });
  units.sort((a, b) => compareCodePoint(a.stablePath, b.stablePath));
  return { path, format: "toml", units, unknowns: [...new Set(unknowns)].sort(compareCodePoint), contentHash: hashFramedDomain("structured-document", { path, units, unknowns }) };
}
function parseActions(entry) {
  const lines = entry.content.split(/\r?\n/u);
  const triggers = [];
  const triggerLocations = [];
  const pathFilters = [];
  const permissions = [];
  const workflowInputs = [];
  const workflowOutputs = [];
  const jobs = [];
  const unknowns = [];
  let section = "";
  let trigger = "";
  let activePathFilter;
  let activePathFilterKind;
  let job;
  let inSteps = false;
  let jobSubsection = "";
  let workflowCallSubsection = "";
  lines.forEach((line, index) => {
    if (/\$\{\{/u.test(line))
      unknowns.push(`expression at line ${index + 1}`);
    const indent = line.match(/^\s*/u)?.[0].length ?? 0;
    const trimmed = line.trim();
    const rootSection = indent === 0 ? trimmed.match(/^(on|permissions|jobs):\s*(.*)$/u) : null;
    if (rootSection !== null) {
      section = rootSection[1];
      job = void 0;
      inSteps = false;
      activePathFilter = void 0;
      activePathFilterKind = void 0;
      const scalar = rootSection[2].trim();
      if (section === "permissions" && scalar !== "") {
        if (["read-all", "write-all", "{}"].includes(scalar))
          permissions.push({ key: "*", value: scalar, line: index + 1 });
        else
          unknowns.push(`unsupported permissions shape at line ${index + 1}`);
      } else if (scalar !== "")
        unknowns.push(`unsupported ${section} scalar shape at line ${index + 1}`);
      return;
    }
    if (section === "on" && indent === 2) {
      const key = trimmed.match(/^([^:]+):/u)?.[1];
      if (key) {
        trigger = key;
        triggers.push(key);
        triggerLocations.push({ key, line: index + 1 });
      }
      workflowCallSubsection = "";
      activePathFilter = void 0;
      activePathFilterKind = void 0;
      return;
    }
    if (section === "on" && trigger === "workflow_call" && indent === 4 && /^(inputs|outputs):$/u.test(trimmed)) {
      workflowCallSubsection = trimmed.slice(0, -1);
      return;
    }
    if (section === "on" && trigger === "workflow_call" && indent === 6) {
      const key = trimmed.match(/^([^:]+):/u)?.[1];
      if (key)
        (workflowCallSubsection === "outputs" ? workflowOutputs : workflowInputs).push({ key, value: trimmed.slice(trimmed.indexOf(":") + 1).trim(), line: index + 1 });
      return;
    }
    if (section === "on" && indent === 4 && /^(paths|paths-ignore):/u.test(trimmed)) {
      const pair = trimmed.match(/^(paths|paths-ignore):\s*(.*)$/u);
      const raw = pair[2].trim();
      const values = raw === "" ? [] : raw.replace(/^\[|\]$/gu, "").split(",").map((value) => value.trim().replace(/^['"]|['"]$/gu, "")).filter(Boolean);
      const existing = pathFilters.find((filter) => filter.trigger === trigger) ?? { trigger, include: [], exclude: [], line: index + 1 };
      if (!pathFilters.includes(existing))
        pathFilters.push(existing);
      activePathFilter = existing;
      activePathFilterKind = pair[1];
      for (const value of values) {
        if (activePathFilterKind === "paths" && value.startsWith("!"))
          existing.exclude.push(value.slice(1));
        else
          (activePathFilterKind === "paths" ? existing.include : existing.exclude).push(value);
      }
      return;
    }
    if (section === "on" && indent === 6 && activePathFilter !== void 0 && activePathFilterKind !== void 0 && /^-\s+/u.test(trimmed)) {
      const value = trimmed.replace(/^-\s+/u, "").replace(/^['"]|['"]$/gu, "");
      if (activePathFilterKind === "paths" && !value.startsWith("!"))
        activePathFilter.include.push(value);
      else
        activePathFilter.exclude.push(value.startsWith("!") ? value.slice(1) : value);
      return;
    }
    if (section === "permissions" && indent === 2) {
      const pair = trimmed.match(/^([^:]+):\s*(.+)$/u);
      if (pair)
        permissions.push({ key: pair[1], value: pair[2], line: index + 1 });
      return;
    }
    if (section !== "jobs")
      return;
    const jobHeader = indent === 2 ? trimmed.match(/^([^:]+):$/u) : null;
    if (jobHeader !== null) {
      job = { id: jobHeader[1], needs: [], uses: [], steps: [], matrix: [], inputs: [], outputs: [], line: index + 1 };
      jobs.push(job);
      inSteps = false;
      jobSubsection = "";
      return;
    }
    if (job === void 0)
      return;
    if (indent === 4 && /^permissions:/u.test(trimmed)) {
      const scalar = trimmed.replace(/^permissions:\s*/u, "");
      if (!["read-all", "write-all", "{}"].includes(scalar))
        unknowns.push(`unsupported job permissions shape at line ${index + 1}`);
      return;
    }
    if (indent === 4 && trimmed === "steps:") {
      inSteps = true;
      return;
    }
    if (inSteps && /^-\s+uses:/u.test(trimmed)) {
      const uses = trimmed.replace(/^-\s+uses:\s*/u, "");
      job.steps.push({ index: job.steps.length, uses, line: index + 1 });
      if (!uses.startsWith("./"))
        unknowns.push(`remote action ${uses} at line ${index + 1}`);
      return;
    }
    if (inSteps && /^-\s+run:/u.test(trimmed)) {
      job.steps.push({ index: job.steps.length, run: trimmed.replace(/^-\s+run:\s*/u, ""), line: index + 1 });
      return;
    }
    if (indent === 4 && /^(with|outputs):$/u.test(trimmed)) {
      jobSubsection = trimmed.slice(0, -1);
      inSteps = false;
      return;
    }
    if (indent === 4 && trimmed === "strategy:") {
      jobSubsection = "strategy";
      inSteps = false;
      return;
    }
    if (indent === 6 && jobSubsection === "strategy" && trimmed === "matrix:") {
      jobSubsection = "matrix";
      return;
    }
    if (indent === 8 && jobSubsection === "matrix") {
      const pair = trimmed.match(/^([^:]+):\s*(.*)$/u);
      if (pair)
        job.matrix.push({ key: pair[1], values: pair[2].replace(/^\[|\]$/gu, "").split(",").map((value) => value.trim()).filter(Boolean), line: index + 1 });
      return;
    }
    if (indent === 6 && (jobSubsection === "with" || jobSubsection === "outputs")) {
      const pair = trimmed.match(/^([^:]+):\s*(.*)$/u);
      if (pair)
        (jobSubsection === "with" ? job.inputs : job.outputs).push({ key: pair[1], value: pair[2], line: index + 1 });
      return;
    }
    const environment2 = indent === 4 ? trimmed.match(/^environment:\s*(.+)$/u) : null;
    if (environment2) {
      job.environment = environment2[1];
      return;
    }
    const needs = indent === 4 ? trimmed.match(/^needs:\s*(.+)$/u) : null;
    if (needs !== null) {
      job.needs.push(...needs[1].replace(/^\[|\]$/gu, "").split(",").map((v) => v.trim()).filter(Boolean));
      return;
    }
    const jobUses = indent === 4 ? trimmed.match(/^uses:\s*(.+)$/u) : null;
    if (jobUses !== null) {
      job.uses.push(jobUses[1]);
      if (!jobUses[1].startsWith("./"))
        unknowns.push(`remote reusable workflow at line ${index + 1}`);
      return;
    }
  });
  triggers.sort(compareCodePoint);
  permissions.sort((a, b) => compareCodePoint(a.key, b.key));
  jobs.forEach((item) => {
    item.needs.sort(compareCodePoint);
    item.uses.sort(compareCodePoint);
  });
  jobs.sort((a, b) => compareCodePoint(a.id, b.id));
  pathFilters.sort((a, b) => compareCodePoint(a.trigger, b.trigger));
  workflowInputs.sort((a, b) => compareCodePoint(a.key, b.key));
  workflowOutputs.sort((a, b) => compareCodePoint(a.key, b.key));
  return { path: entry.path, triggers, triggerLocations, pathFilters, permissions, inputs: workflowInputs, outputs: workflowOutputs, jobs, unknowns: [...new Set(unknowns)].sort(compareCodePoint), contentHash: hashFramedDomain("actions-workflow", { triggers, triggerLocations, pathFilters, permissions, inputs: workflowInputs, outputs: workflowOutputs, jobs, unknowns }) };
}
function parseMarkdown(entry) {
  const headings = [];
  const contractReferences = [];
  const fences = [];
  const links = [];
  const references = [];
  let fence;
  entry.content.split(/\r?\n/u).forEach((line, index) => {
    const marker = line.match(/^\s*```\s*(.*)$/u);
    if (marker !== null) {
      if (fence === void 0)
        fence = { info: marker[1].trim(), startLine: index + 1 };
      else {
        fences.push({ ...fence, endLine: index + 1 });
        fence = void 0;
      }
      return;
    }
    if (fence !== void 0)
      return;
    const heading = line.match(/^(#{1,6})\s+(.+)$/u);
    if (heading)
      headings.push({ level: heading[1].length, text: heading[2].trim(), line: index + 1 });
    for (const match of line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/gu))
      links.push({ text: match[1], target: match[2], line: index + 1 });
    const reference = line.match(/^\s*\[([^\]]+)\]:\s*(\S+)/u);
    if (reference)
      references.push({ key: reference[1], target: reference[2], line: index + 1 });
    for (const match of line.matchAll(/\bcontract:([A-Za-z_$][\w$.-]*@\d+)\b/gu))
      contractReferences.push({ key: match[1], line: index + 1 });
  });
  headings.sort((a, b) => a.line - b.line);
  contractReferences.sort((a, b) => compareCodePoint(a.key, b.key));
  return { path: entry.path, headings, contractReferences, fences, links, references, contentHash: hashFramedDomain("markdown-structure", { headings, contractReferences, fences, links, references }) };
}
function analyzeDocuments(entries) {
  const documents = [];
  const actions = [];
  const markdown = [];
  const failures = [];
  for (const entry of [...entries].sort((a, b) => compareCodePoint(a.path, b.path))) {
    if (entry.kind !== "file")
      continue;
    if (entry.path.endsWith(".md")) {
      markdown.push(parseMarkdown(entry));
      continue;
    }
    if (/\.ya?ml$/u.test(entry.path)) {
      const document = parseYaml(entry.path, entry.content);
      documents.push(document);
      if (document.unknowns.some((item) => item.startsWith("duplicate key")))
        failures.push(failure(entry.path, "duplicate-key", document.unknowns.filter((item) => item.startsWith("duplicate key")).join("; ")));
      if (/^\.github\/workflows\//u.test(entry.path))
        actions.push(parseActions(entry));
      continue;
    }
    if (entry.path.endsWith(".toml")) {
      const document = parseToml(entry.path, entry.content);
      documents.push(document);
      if (document.unknowns.some((item) => item.startsWith("duplicate key")))
        failures.push(failure(entry.path, "duplicate-key", document.unknowns.filter((item) => item.startsWith("duplicate key")).join("; ")));
      continue;
    }
    if (!entry.path.endsWith(".json"))
      continue;
    const units = [];
    const duplicates = duplicateJsonKeys(entry.content);
    if (duplicates.length > 0)
      failures.push(failure(entry.path, "duplicate-key", `duplicate JSON keys: ${duplicates.join(", ")}`));
    try {
      walkJson(JSON.parse(entry.content), [], units);
    } catch (error) {
      failures.push(failure(entry.path, "document-parse", error instanceof Error ? error.message : String(error)));
    }
    units.sort((a, b) => compareCodePoint(a.stablePath, b.stablePath));
    documents.push({ path: entry.path, format: "json", units, unknowns: [], contentHash: hashFramedDomain("structured-document", { path: entry.path, units }) });
  }
  failures.sort((a, b) => compareCodePoint(a.scope, b.scope) || compareCodePoint(a.capability, b.capability));
  return { documents, actions, markdown, failures };
}

// node_modules/@projector/analyzers/dist/git/facts.js
import { createHash as createHash3 } from "node:crypto";

// node_modules/@projector/analyzers/dist/typescript/facts.js
import { extname, posix } from "node:path";

// node_modules/@projector/analyzers/dist/typescript/compiler-syntax.js
import ts from "typescript";
var syntaxProgramVersion = `typescript-syntax-1.${ts.version}`;
function analyzeCompilerSyntax(content, path, scopeKey, budget) {
  const scratch = 1024 + content.length * 16;
  budget.reserve(scratch, "typescript-syntax-tree", path);
  try {
    const scriptKind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : path.endsWith(".jsx") ? ts.ScriptKind.JSX : /\.(?:mjs|cjs|js)$/u.test(path) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
    const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, scriptKind);
    const host = {
      getSourceFile: (name) => name === path ? source : void 0,
      getDefaultLibFileName: () => "",
      writeFile: () => {
        throw new Error("Static syntax observation cannot emit files");
      },
      getCurrentDirectory: () => "/",
      getDirectories: () => [],
      getCanonicalFileName: (name) => name,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => "\n",
      fileExists: (name) => name === path,
      readFile: (name) => name === path ? content : void 0
    };
    const program = ts.createProgram([path], { noLib: true, noResolve: true, noEmit: true, allowJs: true, jsx: ts.JsxEmit.Preserve }, host);
    const diagnostics = program.getSyntacticDiagnostics(source).map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, " "));
    const imports = [], declarations = [], exportFacts = [];
    const eventCalls = [], testNames = /* @__PURE__ */ new Set(), unknowns = /* @__PURE__ */ new Set();
    const location2 = (node) => {
      const offset = node.getStart(source), point = source.getLineAndCharacterOfPosition(offset);
      return { line: point.line + 1, column: point.character + 1, offset, endOffset: node.getEnd() };
    };
    const modifiers = (node) => ts.canHaveModifiers(node) ? ts.getModifiers(node) ?? [] : [];
    const modified = (node, kind) => modifiers(node).some((modifier) => modifier.kind === kind);
    const bindingNames = (name) => ts.isIdentifier(name) ? [name.text] : name.elements.flatMap((element) => ts.isOmittedExpression(element) ? [] : bindingNames(element.name));
    const declare = (node, name, kind, owner = node) => {
      const semantic = { scopeKey, name, kind, exported: modified(owner, ts.SyntaxKind.ExportKeyword), default: modified(owner, ts.SyntaxKind.DefaultKeyword), overload: ts.isFunctionDeclaration(node) && node.body === void 0 };
      budget.reserve(640 + 2 * (scopeKey.length + name.length), "javascript-declarations", path);
      declarations.push({
        id: `ts_decl_${hashFramedDomain("typescript-semantic-declaration-identity", { scopeKey, name, kind }).slice(-32)}`,
        ...semantic,
        location: location2(owner),
        semanticHash: hashFramedDomain("typescript-semantic-declaration", semantic)
      });
    };
    const module = (specifier, bindings, typeOnly) => {
      budget.reserve(192 + 2 * specifier.length + bindings.reduce((size, binding) => size + 160 + 2 * (binding.imported.length + binding.local.length), 0), "javascript-imports", path);
      imports.push({ specifier, bindings: bindings.sort((a, b) => compareCodePoint(a.imported, b.imported) || compareCodePoint(a.local, b.local)), typeOnly });
    };
    const visit = (node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const clause = node.importClause, typeOnly = clause?.isTypeOnly ?? false, bindings = [];
        if (clause?.name)
          bindings.push({ imported: "default", local: clause.name.text, typeOnly });
        const named = clause?.namedBindings;
        if (named && ts.isNamespaceImport(named))
          bindings.push({ imported: "*", local: named.name.text, typeOnly });
        if (named && ts.isNamedImports(named))
          for (const element of named.elements)
            bindings.push({ imported: (element.propertyName ?? element.name).text, local: element.name.text, typeOnly: typeOnly || element.isTypeOnly });
        module(node.moduleSpecifier.text, bindings, typeOnly);
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) {
        module(node.moduleReference.expression.text, [{ imported: "*", local: node.name.text, typeOnly: node.isTypeOnly }], node.isTypeOnly);
      } else if (ts.isExportDeclaration(node)) {
        const from = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : void 0;
        const bindings = [];
        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) {
            const typeOnly = node.isTypeOnly || element.isTypeOnly, imported = (element.propertyName ?? element.name).text;
            bindings.push({ imported, local: element.name.text, typeOnly });
            exportFacts.push({ exportedName: element.name.text, localName: imported, ...from === void 0 ? {} : { from }, typeOnly, default: element.name.text === "default", wildcard: false, location: location2(node) });
          }
        } else {
          const exportedName = node.exportClause && ts.isNamespaceExport(node.exportClause) ? node.exportClause.name.text : void 0;
          bindings.push({ imported: "*", local: exportedName ?? "*", typeOnly: node.isTypeOnly });
          exportFacts.push({ ...exportedName === void 0 ? {} : { exportedName }, ...from === void 0 ? {} : { from }, typeOnly: node.isTypeOnly, default: false, wildcard: true, location: location2(node) });
        }
        if (from !== void 0)
          module(from, bindings, node.isTypeOnly);
      } else if (ts.isExportAssignment(node)) {
        exportFacts.push({ exportedName: node.isExportEquals ? "export=" : "default", typeOnly: false, default: !node.isExportEquals, wildcard: false, location: location2(node) });
      }
      if (ts.isVariableStatement(node))
        for (const declaration of node.declarationList.declarations)
          for (const name of bindingNames(declaration.name))
            declare(declaration, name, "variable", node);
      else if (ts.isFunctionDeclaration(node) && node.name)
        declare(node, node.name.text, "function");
      else if (ts.isClassDeclaration(node) && node.name)
        declare(node, node.name.text, "class");
      else if (ts.isInterfaceDeclaration(node))
        declare(node, node.name.text, "interface");
      else if (ts.isTypeAliasDeclaration(node))
        declare(node, node.name.text, "type");
      else if (ts.isEnumDeclaration(node))
        declare(node, node.name.text, "enum");
      else if (ts.isModuleDeclaration(node))
        declare(node, node.name.text, "namespace");
      if (ts.isCallExpression(node)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword)
          unknowns.add("dynamic import cannot prove a static dependency");
        if (ts.isIdentifier(node.expression) && node.expression.text === "require")
          unknowns.add("runtime require binding is outside static module resolution");
        const argument = node.arguments[0];
        if (ts.isIdentifier(node.expression) && ["test", "it"].includes(node.expression.text) && argument && ts.isStringLiteral(argument))
          testNames.add(argument.text);
        if (ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression)) {
          const operation = node.expression.name.text;
          if (["emit", "publish", "dispatchEvent", "on", "addEventListener", "subscribe"].includes(operation)) {
            eventCalls.push({ receiver: node.expression.expression.text, operation, ...argument && ts.isStringLiteral(argument) ? { name: argument.text } : {}, location: location2(argument ?? node) });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    if (diagnostics.length === 0)
      visit(source);
    else
      for (const diagnostic of diagnostics)
        unknowns.add(`syntax observation incomplete: ${diagnostic}`);
    for (const declaration of declarations)
      if (declaration.exported)
        exportFacts.push({ exportedName: declaration.default ? "default" : declaration.name, localName: declaration.name, typeOnly: ["type", "interface"].includes(declaration.kind), default: declaration.default, wildcard: false, location: declaration.location });
    budget.reserveItems(exportFacts.length, 256, "javascript-export-facts", path);
    budget.reserveItems(testNames.size, 128, "javascript-tests", path);
    budget.reserveItems(eventCalls.length, 256, "javascript-event-syntax", path);
    budget.reserveItems(unknowns.size, 256, "javascript-syntax-unknowns", path);
    return {
      imports,
      declarations: declarations.sort((a, b) => compareCodePoint(a.id, b.id) || a.location.offset - b.location.offset),
      exportFacts: exportFacts.sort((a, b) => compareCodePoint(a.exportedName ?? "*", b.exportedName ?? "*") || a.location.offset - b.location.offset),
      exports: [...new Set(exportFacts.filter((fact) => !fact.typeOnly && fact.exportedName !== void 0).map((fact) => fact.exportedName))].sort(compareCodePoint),
      eventCalls,
      testNames: [...testNames].sort(compareCodePoint),
      unknowns: [...unknowns].sort(compareCodePoint),
      diagnostics
    };
  } finally {
    budget.release(scratch);
  }
}

// node_modules/@projector/analyzers/dist/typescript/facts.js
function isBundledRuntimeDependencyPath(path) {
  return path.startsWith("plugins/projector-v3/runtime/projector/node_modules/");
}
var sourceExtensions = [".mjs", ".js", ".cjs", ".mts", ".cts", ".ts", ".tsx", ".jsx"];
var lifecycleNames = /* @__PURE__ */ new Set(["onPreTool", "onPostTool", "onSessionStart", "onSessionEnd"]);
var operators = [
  ">>>=",
  "===",
  "!==",
  "**=",
  ">>>",
  "<<=",
  ">>=",
  "=>",
  "==",
  "!=",
  "<=",
  ">=",
  "++",
  "--",
  "&&",
  "||",
  "??",
  "?.",
  "**",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "<<",
  ">>",
  "..."
].sort((left, right) => right.length - left.length);
function pushLineBreak(tokens, budget, scope) {
  if (tokens.at(-1)?.kind !== "line-break") {
    budget.reserve(66, "javascript-tokens", scope);
    tokens.push({ kind: "line-break", value: "\n" });
    return 66;
  }
  return 0;
}
function canStartRegex(previous) {
  if (previous === void 0 || previous.kind === "line-break")
    return true;
  if (previous.kind === "identifier") {
    return ["return", "throw", "case", "delete", "void", "typeof", "instanceof", "in", "of", "yield", "await"].includes(previous.value);
  }
  return previous.kind === "punctuator" && /^[([{=,:;!&|?+\-*%^~<>]$/u.test(previous.value);
}
function scanQuoted(content, start, quote) {
  let index = start + 1;
  let escaped = false;
  while (index < content.length) {
    const character = content[index];
    if (escaped)
      escaped = false;
    else if (character === "\\")
      escaped = true;
    else if (character === quote)
      return index + 1;
    index += 1;
  }
  return content.length;
}
function scanRegex(content, start) {
  let index = start + 1;
  let escaped = false;
  let characterClass = false;
  while (index < content.length) {
    const character = content[index];
    if (escaped)
      escaped = false;
    else if (character === "\\")
      escaped = true;
    else if (character === "[")
      characterClass = true;
    else if (character === "]")
      characterClass = false;
    else if (character === "/" && !characterClass) {
      index += 1;
      while (index < content.length && /[A-Za-z]/u.test(content[index]))
        index += 1;
      return index;
    } else if (character === "\n" || character === "\r")
      return start + 1;
    index += 1;
  }
  return start + 1;
}
function lexJavaScript(content, budget, scope) {
  const tokens = [];
  let reservedBytes = 0;
  let previous;
  const pushToken = (kind, start, end) => {
    const bytes = 64 + 2 * (end - start);
    budget.reserve(bytes, "javascript-tokens", scope);
    reservedBytes += bytes;
    const token = { kind, value: content.slice(start, end) };
    tokens.push(token);
    previous = token;
  };
  let index = 0;
  try {
    while (index < content.length) {
      const character = content[index];
      const next = content[index + 1];
      if (/\s/u.test(character)) {
        let hasLineBreak = false;
        while (index < content.length && /\s/u.test(content[index])) {
          if (content[index] === "\n" || content[index] === "\r")
            hasLineBreak = true;
          index += 1;
        }
        if (hasLineBreak)
          reservedBytes += pushLineBreak(tokens, budget, scope);
        continue;
      }
      if (character === "/" && next === "/") {
        index += 2;
        while (index < content.length && content[index] !== "\n" && content[index] !== "\r")
          index += 1;
        reservedBytes += pushLineBreak(tokens, budget, scope);
        continue;
      }
      if (character === "/" && next === "*") {
        index += 2;
        let hasLineBreak = false;
        while (index < content.length && !(content[index] === "*" && content[index + 1] === "/")) {
          if (content[index] === "\n" || content[index] === "\r")
            hasLineBreak = true;
          index += 1;
        }
        index = Math.min(index + 2, content.length);
        if (hasLineBreak)
          reservedBytes += pushLineBreak(tokens, budget, scope);
        continue;
      }
      if (character === "'" || character === '"') {
        const end = scanQuoted(content, index, character);
        pushToken("string", index, end);
        index = end;
        continue;
      }
      if (character === "`") {
        const end = scanQuoted(content, index, character);
        pushToken("template", index, end);
        index = end;
        continue;
      }
      if (/[A-Za-z_$]/u.test(character)) {
        const start = index;
        index += 1;
        while (index < content.length && /[\w$]/u.test(content[index]))
          index += 1;
        pushToken("identifier", start, index);
        continue;
      }
      if (/\d/u.test(character)) {
        const start = index;
        index += 1;
        while (index < content.length && /[\w.]/u.test(content[index]))
          index += 1;
        pushToken("number", start, index);
        continue;
      }
      if (character === "/" && canStartRegex(previous)) {
        const end = scanRegex(content, index);
        if (end > index + 1) {
          pushToken("regex", index, end);
          index = end;
          continue;
        }
      }
      const operator = operators.find((candidate) => content.startsWith(candidate, index));
      if (operator !== void 0) {
        pushToken("punctuator", index, index + operator.length);
        index += operator.length;
        continue;
      }
      pushToken("punctuator", index, index + 1);
      index += 1;
    }
    while (tokens[0]?.kind === "line-break")
      tokens.shift();
    while (tokens.at(-1)?.kind === "line-break")
      tokens.pop();
    return { tokens, reservedBytes };
  } catch (error) {
    budget.release(reservedBytes);
    throw error;
  }
}
function normalizeTokens(tokens, budget, scope) {
  const parts = [];
  let length = Math.max(0, tokens.length - 1);
  let reservedBytes = 0;
  try {
    for (const token of tokens) {
      const size = String(token.kind.length).length + token.kind.length + String(token.value.length).length + token.value.length + 3;
      budget.reserve(32 + 2 * size, "javascript-normalization", scope);
      reservedBytes += 32 + 2 * size;
      parts.push(`${token.kind.length}:${token.kind}:${token.value.length}:${token.value}`);
      length += size;
    }
    budget.reserveString(length, "javascript-normalization", scope);
    return parts.join("|");
  } finally {
    budget.release(reservedBytes);
  }
}
function hashNormalizedTokens(tokens, domain, budget, scope, envelope) {
  const keys = envelope === void 0 ? [] : [...Object.keys(envelope.fields), envelope.key].sort(compareCodePoint);
  let before = "", after = "";
  if (envelope !== void 0) {
    const index = keys.indexOf(envelope.key);
    const field = (key) => `${JSON.stringify(key)}:${canonicalJson(envelope.fields[key])}`;
    before = `{${keys.slice(0, index).map(field).join(",")}${index > 0 ? "," : ""}${JSON.stringify(envelope.key)}:`;
    after = `${index < keys.length - 1 ? "," : ""}${keys.slice(index + 1).map(field).join(",")}}`;
  }
  function* chunks2() {
    yield before;
    yield '"';
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      const size = String(token.kind.length).length + token.kind.length + String(token.value.length).length + token.value.length + 3;
      const scratch = 96 + 16 * size;
      budget.reserve(scratch, "javascript-normalization-hash", scope);
      try {
        if (index > 0)
          yield "|";
        yield JSON.stringify(`${token.kind.length}:${token.kind}:${token.value.length}:${token.value}`).slice(1, -1);
      } finally {
        budget.release(scratch);
      }
    }
    yield '"';
    yield after;
  }
  return hashFramedCanonicalJsonChunks(domain, chunks2);
}
function hashJavaScriptSemantics(content, domain, budget = new DerivedObservationBudget(), scope = ".", envelope) {
  if (/\.(?:tsx|jsx)$/u.test(scope)) {
    const normalized = normalizeJavaScriptSemantics(content, budget, scope);
    try {
      return hashFramedDomain(domain, envelope === void 0 ? normalized : { ...envelope.fields, [envelope.key]: normalized });
    } finally {
      budget.release(32 + content.length * 2);
    }
  }
  const lexed = lexJavaScript(content, budget, scope);
  try {
    return hashNormalizedTokens(lexed.tokens, domain, budget, scope, envelope);
  } finally {
    budget.release(lexed.reservedBytes);
  }
}
function normalizeJavaScriptSemantics(content, budget = new DerivedObservationBudget(), scope = ".") {
  if (/\.(?:tsx|jsx)$/u.test(scope)) {
    budget.reserve(32 + content.length * 2, "jsx-source-normalization", scope);
    return content;
  }
  const lexed = lexJavaScript(content, budget, scope);
  try {
    return normalizeTokens(lexed.tokens, budget, scope);
  } finally {
    budget.release(lexed.reservedBytes);
  }
}
function sourceLocation(content, offset, endOffset) {
  const lines = content.slice(0, offset).split(/\r?\n/u);
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1, offset, endOffset };
}
function packageScopes(entries) {
  const manifests = entries.filter(({ path }) => posix.basename(path) === "package.json").map((entry) => {
    try {
      const parsed = JSON.parse(entry.content);
      return { directory: posix.dirname(entry.path) === "." ? "" : posix.dirname(entry.path), name: typeof parsed.name === "string" ? parsed.name : void 0 };
    } catch {
      return { directory: posix.dirname(entry.path), name: void 0 };
    }
  }).filter((item) => item.name !== void 0).sort((left, right) => right.directory.length - left.directory.length || compareCodePoint(left.name, right.name));
  const result = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const manifest = manifests.find(({ directory }) => directory === "" || entry.path === directory || entry.path.startsWith(`${directory}/`));
    result.set(entry.path, manifest?.name ?? "local-repository");
  }
  return result;
}
function fileParticipantId(scopeKey, declarations, tokens, budget, scope) {
  const anchors = declarations.filter(({ exported }) => exported).map(({ name, kind }) => `${kind}:${name}`).sort(compareCodePoint);
  const hash = anchors.length > 0 ? hashFramedDomain("typescript-participant", { scopeKey, anchor: anchors }) : hashNormalizedTokens(tokens, "typescript-participant", budget, scope, { fields: { scopeKey }, key: "anchor" });
  return `ts_participant_${hash.slice(-32)}`;
}
function extractEvents(calls, scopeKey, participantId, artifactHash, budget, scope) {
  const events = [], uncertainties = [], unknowns = [];
  for (const call of calls) {
    const { receiver, operation, location: location2 } = call;
    const role = ["emit", "publish", "dispatchEvent"].includes(operation) ? "producer" : "consumer";
    if (call.name === void 0) {
      budget.reserve(512 + 2 * (receiver.length + operation.length + scopeKey.length + participantId.length), "javascript-event-facts", scope);
      const evidenceId = `event_uncertainty_${hashFramedDomain("event-uncertainty", { receiver, role, scopeKey, participantId }).slice(-32)}`;
      uncertainties.push({ receiver, role, scopeKey, participantId, evidenceId, artifactHash });
      unknowns.push(`dynamic event name for ${receiver}.${operation}`);
      continue;
    }
    const semanticKey = call.name;
    budget.reserve(768 + 2 * (semanticKey.length + receiver.length + scopeKey.length + participantId.length), "javascript-event-facts", scope);
    const subjectId = `event_${hashFramedDomain("event-subject", { receiver, semanticKey }).slice(-32)}`;
    events.push({
      subjectId,
      semanticKey,
      receiver,
      scopeKey,
      participantId,
      role,
      dynamic: false,
      location: location2,
      evidenceId: `event_evidence_${hashFramedDomain("event-evidence", { participantId, role, semanticKey, location: location2 }).slice(-32)}`,
      artifactHash
    });
  }
  return {
    events: events.sort((a, b) => compareCodePoint(a.subjectId, b.subjectId) || compareCodePoint(a.participantId, b.participantId) || compareCodePoint(a.role, b.role)),
    uncertainties: uncertainties.sort((a, b) => compareCodePoint(a.receiver, b.receiver) || compareCodePoint(a.participantId, b.participantId)),
    unknowns: [...new Set(unknowns)].sort(compareCodePoint)
  };
}
function localImportCandidates(importerPath, specifier) {
  if (!specifier.startsWith("."))
    return [];
  const base = posix.normalize(posix.join(posix.dirname(importerPath), specifier));
  const candidates = extname(base).length > 0 ? [base, ...base.endsWith(".js") ? [`${base.slice(0, -3)}.ts`, `${base.slice(0, -3)}.tsx`] : [], ...base.endsWith(".mjs") ? [`${base.slice(0, -4)}.mts`] : [], ...base.endsWith(".cjs") ? [`${base.slice(0, -4)}.cts`] : []] : [...sourceExtensions.map((extension) => `${base}${extension}`), ...sourceExtensions.map((extension) => `${base}/index${extension}`)];
  return candidates;
}
function resolveLocalImport(importerPath, specifier, paths) {
  return localImportCandidates(importerPath, specifier).find((candidate) => paths.has(candidate));
}
function analyzeJavaScript(entries, budget = new DerivedObservationBudget()) {
  budget.reserveItems(entries.length, 128, "javascript-file-index");
  let scratchBytes = entries.length * 128;
  const sourceEntries = entries.filter((entry) => entry.kind === "file" && !isBundledRuntimeDependencyPath(entry.path) && sourceExtensions.some((extension) => entry.path.endsWith(extension))).sort((left, right) => compareCodePoint(left.path, right.path));
  const paths = new Set(entries.filter((entry) => entry.kind === "file").map((entry) => entry.path));
  const scopes = packageScopes(entries);
  const files = [];
  const dependencies = [];
  const events = [];
  const eventUncertainties = [];
  const contracts = [];
  const failures = [];
  for (const entry of sourceEntries) {
    const lexed = lexJavaScript(entry.content, budget, entry.path), tokens = lexed.tokens;
    try {
      const scopeKey = scopes.get(entry.path) ?? "local-repository";
      const syntax = analyzeCompilerSyntax(entry.content, entry.path, scopeKey, budget);
      const { declarations, exportFacts, exports } = syntax;
      for (const diagnostic of syntax.diagnostics) {
        budget.reserve(256 + 2 * (entry.path.length + diagnostic.length), "javascript-failures", entry.path);
        failures.push({
          analyzerId: "projector.javascript-local",
          capability: "syntax",
          scope: entry.path,
          message: diagnostic,
          recoverable: true,
          affectedClaimKinds: ["dependency", "test-target", "hook-reachability", "semantic-declaration", "event-topology"]
        });
      }
      const participantId = fileParticipantId(scopeKey, declarations, tokens, budget, entry.path);
      const extractedEvents = extractEvents(syntax.eventCalls, scopeKey, participantId, entry.contentHash, budget, entry.path);
      budget.reserveItems(extractedEvents.events.length + extractedEvents.uncertainties.length, 8, "javascript-event-index", entry.path);
      for (const event of extractedEvents.events)
        events.push(event);
      for (const uncertainty of extractedEvents.uncertainties)
        eventUncertainties.push(uncertainty);
      budget.reserve(832 + 2 * entry.path.length, "javascript-file-facts", entry.path);
      files.push({
        path: entry.path,
        exports,
        lifecycleExports: exports.filter((name) => lifecycleNames.has(name)),
        testNames: syntax.testNames,
        semanticHash: /\.(?:tsx|jsx)$/u.test(entry.path) ? hashJavaScriptSemantics(entry.content, "projector.local-semantic", budget, entry.path) : hashNormalizedTokens(tokens, "projector.local-semantic", budget, entry.path),
        fallbackHash: /\.(?:tsx|jsx)$/u.test(entry.path) ? hashJavaScriptSemantics(entry.content, "local-unit-fallback", budget, entry.path) : hashNormalizedTokens(tokens, "local-unit-fallback", budget, entry.path),
        variantHash: /\.(?:tsx|jsx)$/u.test(entry.path) ? hashJavaScriptSemantics(entry.content, "local-unit-variant", budget, entry.path) : hashNormalizedTokens(tokens, "local-unit-variant", budget, entry.path),
        participantId,
        scopeKey,
        declarations,
        exportFacts,
        unknowns: [.../* @__PURE__ */ new Set([...syntax.unknowns, ...extractedEvents.unknowns])].sort(compareCodePoint)
      });
      for (const importedSyntax of syntax.imports) {
        const resolvedPath = resolveLocalImport(entry.path, importedSyntax.specifier, paths);
        budget.reserve(256 + 2 * (entry.path.length + importedSyntax.specifier.length + (resolvedPath?.length ?? 0)) + 32 * importedSyntax.bindings.length, "javascript-dependencies", entry.path);
        dependencies.push({
          sourceClass: "derived",
          importerPath: entry.path,
          specifier: importedSyntax.specifier,
          ...resolvedPath === void 0 ? {} : { resolvedPath },
          importedBindings: [...new Set(importedSyntax.bindings.map(({ imported }) => imported))].sort(compareCodePoint),
          bindings: importedSyntax.bindings,
          typeOnly: importedSyntax.typeOnly
        });
        if (importedSyntax.specifier.startsWith(".") && resolvedPath === void 0) {
          budget.reserve(256 + 2 * (entry.path.length + importedSyntax.specifier.length), "javascript-failures", entry.path);
          failures.push({
            analyzerId: "projector.javascript-local",
            capability: "module-resolution",
            scope: entry.path,
            message: `Cannot resolve local module ${importedSyntax.specifier}`,
            recoverable: true,
            affectedClaimKinds: ["dependency", "test-target", "hook-reachability"]
          });
        }
      }
    } finally {
      budget.release(lexed.reservedBytes);
    }
  }
  const groupedDependencies = /* @__PURE__ */ new Map();
  for (const dependency of dependencies) {
    const indexBytes = 128 + 2 * (dependency.importerPath.length + dependency.specifier.length);
    budget.reserve(indexBytes, "javascript-dependency-index", dependency.importerPath);
    scratchBytes += indexBytes;
    const key = `${dependency.importerPath}\0${dependency.specifier}`;
    const existing = groupedDependencies.get(key);
    if (existing === void 0)
      groupedDependencies.set(key, dependency);
    else {
      budget.reserveItems(existing.bindings.length + dependency.bindings.length, 128, "javascript-binding-index", dependency.importerPath);
      const bindings = [...new Map([...existing.bindings, ...dependency.bindings].map((binding) => [`${binding.imported}\0${binding.local}\0${binding.typeOnly}`, binding])).values()].sort((left, right) => compareCodePoint(left.imported, right.imported) || compareCodePoint(left.local, right.local));
      groupedDependencies.set(key, { ...existing, ...existing.resolvedPath === void 0 && dependency.resolvedPath !== void 0 ? { resolvedPath: dependency.resolvedPath } : {}, bindings, importedBindings: [...new Set(bindings.map(({ imported }) => imported))].sort(compareCodePoint), typeOnly: existing.typeOnly && dependency.typeOnly });
    }
  }
  budget.reserveItems(groupedDependencies.size, 8, "javascript-dependency-index");
  const normalizedDependencies = [...groupedDependencies.values()].sort((left, right) => compareCodePoint(left.importerPath, right.importerPath) || compareCodePoint(left.specifier, right.specifier));
  const testTargets = dependencies.filter((dependency) => /\.test\.(?:mjs|js|cjs|mts|ts)$/u.test(dependency.importerPath) && dependency.resolvedPath !== void 0).map((dependency) => {
    budget.reserve(128, "javascript-test-targets", dependency.importerPath);
    return {
      sourceClass: "derived",
      testPath: dependency.importerPath,
      targetPath: dependency.resolvedPath
    };
  }).sort((left, right) => compareCodePoint(left.testPath, right.testPath) || compareCodePoint(left.targetPath, right.targetPath));
  files.sort((left, right) => compareCodePoint(left.path, right.path));
  const declarationsByScope = /* @__PURE__ */ new Map();
  for (const file of files) {
    budget.reserveItems(file.declarations.length, 128, "javascript-declaration-index", file.path);
    scratchBytes += file.declarations.length * 128;
    const declarations = declarationsByScope.get(file.scopeKey) ?? /* @__PURE__ */ new Map();
    for (const declaration of file.declarations.filter(({ kind, name }) => ["interface", "type", "class"].includes(kind) || name.endsWith("Schema")))
      declarations.set(declaration.name, declaration);
    declarationsByScope.set(file.scopeKey, declarations);
  }
  const packageExports = /* @__PURE__ */ new Map();
  for (const file of files) {
    budget.reserveItems(file.declarations.length + file.exportFacts.length, 192, "javascript-export-index", file.path);
    scratchBytes += (file.declarations.length + file.exportFacts.length) * 192;
    const exported = packageExports.get(file.scopeKey) ?? /* @__PURE__ */ new Map();
    for (const declaration of file.declarations.filter(({ exported: exported2, kind, name }) => exported2 && (["interface", "type", "class"].includes(kind) || name.endsWith("Schema"))))
      exported.set(declaration.name, { semanticKey: declaration.name, declaration, exportPath: file.path, location: declaration.location });
    for (const fact of file.exportFacts) {
      if (fact.exportedName === void 0 || fact.localName === void 0 || fact.wildcard)
        continue;
      const declaration = declarationsByScope.get(file.scopeKey)?.get(fact.localName);
      if (declaration !== void 0)
        exported.set(fact.exportedName, { semanticKey: fact.exportedName, declaration, exportPath: file.path, location: fact.location });
    }
    packageExports.set(file.scopeKey, exported);
  }
  for (const [scopeKey, exported] of [...packageExports.entries()].sort(([left], [right]) => compareCodePoint(left, right))) {
    for (const symbol of [...exported.values()].sort((left, right) => compareCodePoint(left.semanticKey, right.semanticKey))) {
      budget.reserve(768 + 2 * (symbol.semanticKey.length + scopeKey.length), "javascript-contract-facts", symbol.exportPath);
      const exportFile = files.find(({ path }) => path === symbol.exportPath);
      const sourceEntry = sourceEntries.find(({ path }) => path === symbol.exportPath);
      const participantId = exportFile.participantId;
      const subjectId = `contract_${hashFramedDomain("public-contract-subject", { scopeKey, semanticKey: symbol.semanticKey }).slice(-32)}`;
      contracts.push({ subjectId, semanticKey: symbol.semanticKey, scopeKey, participantId, role: "producer", location: symbol.location, evidenceId: `contract_evidence_${hashFramedDomain("contract-evidence", { participantId, declarationId: symbol.declaration.id, semanticKey: symbol.semanticKey }).slice(-32)}`, artifactHash: sourceEntry.contentHash });
    }
  }
  for (const file of files) {
    const participantId = file.participantId;
    const sourceEntry = sourceEntries.find(({ path }) => path === file.path);
    for (const dependency of normalizedDependencies.filter(({ importerPath }) => importerPath === file.path)) {
      const sourceScope = dependency.resolvedPath === void 0 ? dependency.specifier : scopes.get(dependency.resolvedPath) ?? dependency.specifier;
      const exports = packageExports.get(sourceScope);
      if (exports === void 0)
        continue;
      for (const binding of dependency.bindings) {
        const symbol = exports.get(binding.imported);
        if (symbol === void 0)
          continue;
        budget.reserve(768 + 2 * (symbol.semanticKey.length + sourceScope.length), "javascript-contract-facts", file.path);
        const subjectId = `contract_${hashFramedDomain("public-contract-subject", { scopeKey: sourceScope, semanticKey: symbol.semanticKey }).slice(-32)}`;
        contracts.push({ subjectId, semanticKey: symbol.semanticKey, scopeKey: sourceScope, participantId, role: "consumer", location: sourceLocation(sourceEntry.content, 0, 0), evidenceId: `contract_evidence_${hashFramedDomain("contract-import-evidence", { participantId, sourceScope, imported: binding.imported, local: binding.local }).slice(-32)}`, artifactHash: sourceEntry.contentHash });
      }
    }
  }
  events.sort((left, right) => compareCodePoint(left.subjectId, right.subjectId) || compareCodePoint(left.participantId, right.participantId) || compareCodePoint(left.role, right.role));
  contracts.sort((left, right) => compareCodePoint(left.subjectId, right.subjectId) || compareCodePoint(left.participantId, right.participantId) || compareCodePoint(left.role, right.role));
  budget.release(scratchBytes);
  return { files, dependencies: normalizedDependencies, testTargets, events, eventUncertainties, contracts, failures };
}

// node_modules/@projector/analyzers/dist/git/facts.js
function parseTracked(output) {
  const result = /* @__PURE__ */ new Map();
  for (const record of output.split("\0")) {
    const match = /^\d+ ([0-9a-f]+) \d+\t([\s\S]+)$/u.exec(record);
    if (match?.[1] !== void 0 && match[2] !== void 0)
      result.set(match[2], match[1]);
  }
  return result;
}
function parseIntroductionHistory(output) {
  const result = /* @__PURE__ */ new Map();
  for (const segment of output.split("").slice(1)) {
    const separator = segment.indexOf("\0");
    if (separator < 1)
      continue;
    const commit = segment.slice(0, separator);
    if (!/^[0-9a-f]+$/u.test(commit))
      continue;
    let names = segment.slice(separator + 1);
    if (names.startsWith("\0\n"))
      names = names.slice(2);
    else if (names.startsWith("\n"))
      names = names.slice(1);
    for (const path of names.split("\0").filter(Boolean))
      result.set(path, commit);
  }
  return result;
}
async function collectGitPathIdentities(repositoryRoot, paths, revision, known, options) {
  const tracked = /* @__PURE__ */ new Map();
  const batches = [];
  let batch = [], characters = 0;
  for (const path of [...new Set(paths)].sort(compareCodePoint)) {
    if (path.length > 8e3)
      throw new ObservationError("observation-failed", "git-path-identities", path, "Git path exceeds the bounded literal command argument limit");
    if (batch.length >= 64 || characters + path.length > 12e3) {
      batches.push(batch);
      batch = [];
      characters = 0;
    }
    batch.push(path);
    characters += path.length + 4;
  }
  if (batch.length > 0)
    batches.push(batch);
  for (const paths2 of batches) {
    const output = await observationGit(repositoryRoot, ["--literal-pathspecs", "ls-files", "--stage", "-z", "--", ...paths2], options.budget, { signal: options.signal, stage: "git-path-identities" });
    for (const [path, object] of parseTracked(output))
      tracked.set(path, object);
  }
  const identities = [];
  for (const path of [...new Set(paths)].sort(compareCodePoint)) {
    options.budget.check("git-path-identities", path);
    options.signal.throwIfAborted();
    const objectId = tracked.get(path);
    if (objectId === void 0) {
      identities.push({ sourceClass: "derived", path, tracked: false, availability: "available", introductionHistory: "not-applicable" });
      continue;
    }
    let introductionCommit = options.ancestryPreserved ? known.get(path)?.introductionCommit : void 0;
    if (introductionCommit === void 0 && revision !== "unborn")
      introductionCommit = (await observationGit(repositoryRoot, ["--literal-pathspecs", "log", "--no-ext-diff", "--follow", "--diff-filter=A", "--format=%H", "--", path], options.budget, { signal: options.signal, stage: "git-path-history" })).trim().split("\n").filter(Boolean).at(-1);
    identities.push({ sourceClass: "derived", path, tracked: true, availability: "available", introductionHistory: revision === "unborn" ? "not-applicable" : "available", objectId, ...introductionCommit === void 0 ? {} : { introductionCommit } });
  }
  return identities;
}
function parseGitStatus(output) {
  const records = output.split("\0"), moves = [], deleted = [], untracked = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record)
      continue;
    const status = record.slice(0, 2), path = record.slice(3);
    if (/R/u.test(status)) {
      const fromPath = records[++index];
      if (fromPath && !isExcludedInventoryPath(fromPath) && !isExcludedInventoryPath(path))
        moves.push({
          sourceClass: "derived",
          fromPath,
          toPath: path,
          status: status[0] === "R" ? "staged-rename" : "working-tree-rename"
        });
    } else if (!isExcludedInventoryPath(path) && (status === " D" || status === "D "))
      deleted.push(path);
    else if (!isExcludedInventoryPath(path) && status === "??")
      untracked.push(path);
  }
  return { moves, deleted: deleted.sort(compareCodePoint), untracked: untracked.sort(compareCodePoint) };
}
function parseHeadTree(output) {
  const objects = /* @__PURE__ */ new Map();
  for (const record of output.split("\0")) {
    const match = /^(?:\d+) (?:blob|commit|tree) ([0-9a-f]{40,64})\t([\s\S]+)$/u.exec(record);
    if (match?.[1] !== void 0 && match[2] !== void 0)
      objects.set(match[2], match[1]);
  }
  return objects;
}
function parseBatchSizes(output, objectIds) {
  const lines = output.split("\n").filter(Boolean);
  if (lines.length !== objectIds.length)
    throw new Error("Git object-size batch returned an unexpected record count");
  return lines.map((line, index) => {
    const match = /^([0-9a-f]{40,64}) ([a-z]+) (\d+)$/u.exec(line);
    const objectId = objectIds[index];
    if (match?.[1] !== objectId || match[3] === void 0)
      throw new Error(`Invalid Git object-size header for ${objectId}`);
    const size = Number(match[3]);
    if (!Number.isSafeInteger(size) || size < 0)
      throw new Error(`Invalid Git object size for ${objectId}`);
    return size;
  });
}
function parseBatchContents(bytes, objectIds, sizes, paths) {
  const deleted = [];
  let offset = 0;
  for (let index = 0; index < objectIds.length; index += 1) {
    const headerEnd = bytes.indexOf(10, offset);
    const objectId = objectIds[index], size = sizes[index], path = paths[index];
    if (headerEnd < offset)
      throw new Error(`Missing Git content header for ${path}`);
    const header = bytes.subarray(offset, headerEnd).toString("ascii");
    if (!new RegExp(`^${objectId} [a-z]+ ${size}$`, "u").test(header))
      throw new Error(`Invalid Git content header for ${path}`);
    const contentStart = headerEnd + 1, contentEnd = contentStart + size;
    if (contentEnd >= bytes.length || bytes[contentEnd] !== 10)
      throw new Error(`Invalid Git content length for ${path}`);
    const content = bytes.subarray(contentStart, contentEnd).toString("utf8");
    deleted.push({ path, content });
    offset = contentEnd + 1;
  }
  if (offset !== bytes.length)
    throw new Error("Git content batch has trailing bytes");
  return deleted;
}
async function collectGitFacts(repositoryRoot, paths, options = {}) {
  if (options.confirmedNonGit)
    return {
      availability: "unavailable",
      revision: "filesystem",
      moves: [],
      identities: paths.map((path) => ({ sourceClass: "derived", path, tracked: "unknown", availability: "unavailable", introductionHistory: "unavailable" })),
      failures: [{
        analyzerId: "projector.git-local",
        capability: "git-identity-and-moves",
        scope: ".git",
        message: "Confirmed non-Git repository has no Git identity or history.",
        recoverable: true,
        affectedClaimKinds: ["git-identity", "move-lineage"]
      }]
    };
  const budget = options.budget ?? new ObservationBudget();
  const git = (args, allowedExitCodes, signal = options.signal) => observationGit(repositoryRoot, args, budget, { ...signal === void 0 ? {} : { signal }, ...allowedExitCodes === void 0 ? {} : { allowedExitCodes } });
  const gitText = (args, input) => observationGit(repositoryRoot, args, budget, { ...options.signal === void 0 ? {} : { signal: options.signal }, input });
  const gitBytes = (args, input) => observationGitBytes(repositoryRoot, args, budget, { ...options.signal === void 0 ? {} : { signal: options.signal }, input });
  const commandResults = await observationMap([
    { args: ["rev-parse", "--verify", "--quiet", "HEAD"], allowedExitCodes: [1] },
    { args: ["ls-files", "--stage", "-z"], allowedExitCodes: [] },
    { args: ["status", "--porcelain=v1", "--untracked-files=all", "-z"], allowedExitCodes: [] }
  ], (command, signal) => observationGit(repositoryRoot, command.args, budget, { signal, allowedExitCodes: command.allowedExitCodes }), options.signal);
  const revisionOutput = commandResults[0];
  if (revisionOutput.trim() === "") {
    const headReference = (await git(["symbolic-ref", "--quiet", "HEAD"])).trim();
    const references = await git(["show-ref"], [1]);
    if (!headReference.startsWith("refs/heads/") || references.split("\n").some((record) => record.endsWith(` ${headReference}`))) {
      throw new ObservationError("observation-failed", "git-facts", "HEAD", "Git HEAD could not be resolved and is not a confirmed unborn branch.");
    }
  }
  const revision = revisionOutput.trim() || "unborn";
  const tracked = parseTracked(commandResults[1]);
  const status = parseGitStatus(commandResults[2]);
  const introductions = revision === "unborn" ? /* @__PURE__ */ new Map() : parseIntroductionHistory(await git([
    "log",
    "--no-ext-diff",
    "--diff-filter=A",
    "--format=%x1e%H%x00",
    "--name-only",
    "-z",
    "--"
  ]));
  const identities = await observationMap(paths, async (path, signal) => {
    budget.check("git-facts", path);
    const objectId = tracked.get(path);
    if (objectId === void 0)
      return { sourceClass: "derived", path, tracked: false, availability: "available", introductionHistory: "not-applicable" };
    let introductionCommit = introductions.get(path);
    if (introductionCommit === void 0 && revision !== "unborn") {
      introductionCommit = (await git(["log", "--no-ext-diff", "--follow", "--diff-filter=A", "--format=%H", "--", path], void 0, signal)).trim().split("\n").filter(Boolean).at(-1);
    }
    return {
      sourceClass: "derived",
      path,
      tracked: true,
      availability: "available",
      introductionHistory: revision === "unborn" ? "not-applicable" : "available",
      objectId,
      ...introductionCommit === void 0 ? {} : { introductionCommit }
    };
  }, options.signal);
  const entryByPath = new Map((options.entries ?? []).filter((entry) => entry.kind === "file").map((entry) => [entry.path, entry]));
  const untrackedPaths = status.untracked.filter((path) => entryByPath.has(path));
  const needsMoveCapture = revision !== "unborn" && status.deleted.length > 0 && untrackedPaths.length > 0;
  const capture = options.contentStore === void 0 || !needsMoveCapture ? void 0 : options.contentStore.schemaVersion === "projector.inventory-content/v1" ? InventoryContentStore.append(options.contentStore) : InventoryContentStore.create(`${options.contentStore.path}.temporary`);
  const ownsCapture = options.contentStore?.schemaVersion === "projector.source-content/v2" && capture !== void 0;
  let captureHandedOff = false;
  try {
    const deleted = [];
    if (revision !== "unborn" && status.deleted.length > 0) {
      const tree = parseHeadTree(await git(["ls-tree", "-r", "-z", "HEAD"]));
      const objectIds = status.deleted.map((path) => {
        const objectId = tree.get(path);
        if (objectId === void 0)
          throw new Error(`Missing Git object for ${path}`);
        return objectId;
      });
      const sizes = parseBatchSizes(await gitText(["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"], `${objectIds.join("\n")}
`), objectIds);
      for (let index = 0; index < status.deleted.length; index += 1) {
        const path = status.deleted[index], size = sizes[index];
        budget.check("git-facts", path);
        budget.assertFileBytes(size, path);
        budget.consume("maxTotalBytes", size, "git-move-content", path);
      }
      for (let start = 0; start < objectIds.length; ) {
        let end = start + 1, total = sizes[start];
        while (end < objectIds.length && end - start < 64 && total + sizes[end] <= 8 * 1024 * 1024)
          total += sizes[end++];
        const candidates = parseBatchContents(await gitBytes(["cat-file", "--batch"], `${objectIds.slice(start, end).join("\n")}
`), objectIds.slice(start, end), sizes.slice(start, end), status.deleted.slice(start, end));
        for (const candidate of candidates) {
          budget.assertFileBytes(Buffer.byteLength(candidate.content), candidate.path);
          if (capture === void 0)
            deleted.push(candidate);
          else {
            const address = `git-deleted:${candidate.path}`;
            capture.put({ path: address, kind: "file", mediaType: "application/octet-stream", contentHash: hashFramedDomain("git-move-capture", candidate.content), contentBytes: Buffer.byteLength(candidate.content), generated: false }, candidate.content);
            deleted.push({ path: candidate.path, contentAddress: address });
          }
        }
        start = end;
      }
    }
    const untracked = status.untracked.flatMap((path) => {
      const entry = entryByPath.get(path);
      if (entry === void 0)
        return [];
      if (capture === void 0)
        return [{ path, content: entry.content }];
      if (options.contentStore?.schemaVersion === "projector.source-content/v2") {
        const fields = Object.fromEntries(Object.keys(entry).filter((key) => key !== "content").map((key) => [key, entry[key]]));
        capture.putChunks({ ...fields, contentBytes: inventoryEntryBytes(entry) }, inventoryEntryChunks(entry));
      }
      return [{ path, contentAddress: path }];
    });
    capture?.finish();
    const facts = {
      availability: "available",
      revision,
      identities: identities.sort((a, b) => compareCodePoint(a.path, b.path)),
      moves: status.moves,
      failures: [],
      pendingMoveCandidates: { deleted, untracked },
      ...capture === void 0 ? {} : { moveCandidateContent: { ...capture.descriptor, ...ownsCapture ? { disposeAfterUse: true } : {} } }
    };
    captureHandedOff = ownsCapture;
    return facts;
  } finally {
    if (ownsCapture && !captureHandedOff)
      capture?.dispose();
    else
      capture?.close();
  }
}
function moveFingerprint(path, content, budget) {
  if (content.includes("\0") || content.includes("\uFFFD"))
    return void 0;
  const temporaryStart = budget.usedBytes;
  let fingerprint;
  try {
    const javaScript = /\.(?:[cm]?[jt]s|[jt]sx)$/iu.test(path);
    const comparable = javaScript ? normalizeJavaScriptSemantics(content, budget, path) : content;
    fingerprint = createHash3("sha256").update(javaScript ? "javascript\0" : "bytes\0").update(comparable).digest("hex");
  } finally {
    budget.release(budget.usedBytes - temporaryStart);
  }
  budget.reserveString(fingerprint.length, "git-move-fingerprint", path);
  return fingerprint;
}
function finalizeGitFacts(facts, budget = new DerivedObservationBudget()) {
  const candidates = facts.pendingMoveCandidates;
  const startedBytes = budget.usedBytes;
  let retainedMoveBytes = 0;
  const capture = facts.moveCandidateContent === void 0 ? void 0 : InventoryContentStore.open(facts.moveCandidateContent);
  try {
    if (candidates === void 0)
      return facts;
    if (candidates.deleted.length === 0 || candidates.untracked.length === 0)
      return {
        availability: facts.availability,
        revision: facts.revision,
        identities: facts.identities,
        failures: facts.failures,
        moves: [...facts.moves].sort((a, b) => compareCodePoint(a.fromPath, b.fromPath) || compareCodePoint(a.toPath, b.toPath))
      };
    const contentOf = (candidate) => {
      if ("content" in candidate)
        return candidate.content;
      if (capture === void 0)
        throw new Error("Git move candidate capture is missing");
      return capture.read(candidate.contentAddress);
    };
    budget.reserveItems(candidates.untracked.length, 128, "git-move-candidates");
    const contents = new Map(candidates.untracked.flatMap((candidate) => {
      const path = candidate.path, content = contentOf(candidate);
      const fingerprint = moveFingerprint(path, content, budget);
      return fingerprint === void 0 ? [] : [[path, fingerprint]];
    }));
    const moves = [...facts.moves];
    for (const candidate of candidates.deleted) {
      const fromPath = candidate.path, content = contentOf(candidate);
      const temporaryStart = budget.usedBytes;
      const retainedStart = retainedMoveBytes;
      try {
        const previous = moveFingerprint(fromPath, content, budget);
        if (previous === void 0)
          continue;
        const matches = [...contents].filter(([, value]) => value === previous).map(([path]) => path);
        if (matches.length !== 1)
          continue;
        const toPath = matches[0];
        contents.delete(toPath);
        const moveBytes = 192 + 2 * (fromPath.length + toPath.length);
        budget.reserve(moveBytes, "git-move-facts", fromPath);
        retainedMoveBytes += moveBytes;
        moves.push({ sourceClass: "derived", fromPath, toPath, status: "working-tree-rename" });
      } finally {
        budget.release(budget.usedBytes - temporaryStart - (retainedMoveBytes - retainedStart));
      }
    }
    return {
      availability: facts.availability,
      revision: facts.revision,
      identities: facts.identities,
      failures: facts.failures,
      moves: moves.filter((move, index) => moves.findIndex((candidate) => candidate.fromPath === move.fromPath && candidate.toPath === move.toPath) === index).sort((a, b) => compareCodePoint(a.fromPath, b.fromPath) || compareCodePoint(a.toPath, b.toPath))
    };
  } finally {
    if (facts.moveCandidateContent?.schemaVersion === "projector.inventory-content/v1" && facts.moveCandidateContent.disposeAfterUse)
      capture?.dispose();
    else
      capture?.close();
    budget.release(budget.usedBytes - startedBytes - retainedMoveBytes);
  }
}

// node_modules/@projector/analyzers/dist/local-repository.js
import { posix as posix2, resolve as resolve2 } from "node:path";

// node_modules/@projector/analyzers/dist/topology/index.js
var compareStrings = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var sortedUnique = (values) => [...new Set(values)].sort(compareStrings);
function normalize(observation) {
  if (observation.subjectId.trim() === "" || observation.semanticKey.trim() === "" || observation.participantId.trim() === "") {
    throw new Error("topology observations require stable semantic subject and participant identities");
  }
  if (!Number.isFinite(observation.confidence) || observation.confidence < 0 || observation.confidence > 1) {
    throw new Error("topology confidence must be within 0..1");
  }
  return {
    subjectId: observation.subjectId,
    subjectKind: observation.subjectKind,
    semanticKey: observation.semanticKey,
    participantId: observation.participantId,
    role: observation.role,
    assurance: observation.assurance,
    confidence: observation.confidence,
    evidenceIds: sortedUnique(observation.evidenceIds),
    adapterVersion: observation.adapterVersion,
    artifactHash: observation.artifactHash
  };
}
function compileEventContractTopology(observations, enumeration) {
  if (enumeration !== void 0 && (enumeration.observability === "closed" || enumeration.observability === "bounded") && enumeration.method.trim().length === 0) {
    throw new Error(`${enumeration.observability} topology enumeration requires an explicit proof method`);
  }
  if (enumeration?.observability === "bounded" && enumeration.assumptions.length === 0) {
    throw new Error("bounded topology enumeration requires an explicit proof assumption");
  }
  if (enumeration?.observability === "closed" && (enumeration.blindSpots.length > 0 || enumeration.dynamicMechanisms.length > 0)) {
    throw new Error("closed topology enumeration cannot retain blind spots or dynamic mechanisms outside its proof");
  }
  const unique = /* @__PURE__ */ new Map();
  const subjectSemantics = /* @__PURE__ */ new Map();
  for (const observation of observations) {
    const normalized = normalize(observation);
    const subjectSemantic = canonicalJson({ subjectKind: normalized.subjectKind, semanticKey: normalized.semanticKey });
    const existingSubjectSemantic = subjectSemantics.get(normalized.subjectId);
    if (existingSubjectSemantic !== void 0 && existingSubjectSemantic !== subjectSemantic) {
      throw new Error(`conflicting stable subject identity ${normalized.subjectId}`);
    }
    subjectSemantics.set(normalized.subjectId, subjectSemantic);
    const key = canonicalJson({
      subjectId: normalized.subjectId,
      subjectKind: normalized.subjectKind,
      semanticKey: normalized.semanticKey,
      participantId: normalized.participantId,
      role: normalized.role
    });
    const existing = unique.get(key);
    if (existing !== void 0 && canonicalJson(existing) !== canonicalJson(normalized)) {
      throw new Error(`conflicting duplicate topology observation for ${normalized.subjectId}/${normalized.participantId}`);
    }
    unique.set(key, normalized);
  }
  const groups = /* @__PURE__ */ new Map();
  for (const observation of unique.values()) {
    const key = canonicalJson({
      subjectId: observation.subjectId,
      subjectKind: observation.subjectKind,
      semanticKey: observation.semanticKey
    });
    groups.set(key, [...groups.get(key) ?? [], observation]);
  }
  const routes = [...groups.values()].map((group) => {
    const head = group[0];
    const links = group.sort((left, right) => compareStrings(left.participantId, right.participantId) || compareStrings(left.role, right.role)).map(({ participantId, role, confidence, evidenceIds, adapterVersion: adapterVersion2, artifactHash }) => ({
      participantId,
      role,
      assurance: "heuristic",
      confidence: Math.min(confidence, 0.5),
      evidenceIds: [...evidenceIds],
      adapterVersion: adapterVersion2,
      artifactHash
    }));
    const routeIdentity = { subjectId: head.subjectId, subjectKind: head.subjectKind };
    const defaultObservability = "open";
    const semantic = {
      subjectId: head.subjectId,
      subjectKind: head.subjectKind,
      semanticKey: head.semanticKey,
      queryVersion: sortedUnique(links.map(({ adapterVersion: adapterVersion2 }) => adapterVersion2)).join("+") || "1",
      producerIds: sortedUnique(links.filter(({ role }) => role === "producer").map(({ participantId }) => participantId)),
      consumerIds: sortedUnique(links.filter(({ role }) => role === "consumer").map(({ participantId }) => participantId)),
      links,
      observability: defaultObservability,
      ...enumeration === void 0 ? {} : { enumeration: {
        method: enumeration.method,
        assumptions: sortedUnique(enumeration.assumptions),
        blindSpots: sortedUnique(enumeration.blindSpots),
        dynamicMechanisms: sortedUnique(enumeration.dynamicMechanisms),
        ...enumeration.freshnessRequirement === void 0 ? {} : { freshnessRequirement: enumeration.freshnessRequirement }
      } }
    };
    const contentHash = hashFramedDomain("event-contract-topology-route", semantic);
    return { id: `topology_route_${hashFramedDomain("event-contract-topology-route-identity", routeIdentity).slice(-32)}`, ...semantic, contentHash };
  }).sort((left, right) => compareStrings(left.subjectId, right.subjectId));
  return { routes, contentHash: hashFramedDomain("event-contract-topology", routes) };
}
function compileAuthenticatedAnalyzerTopology(input) {
  const subjects = /* @__PURE__ */ new Map();
  for (const subject of input.subjects) {
    const existing = subjects.get(subject.subjectId);
    if (existing !== void 0 && canonicalJson(existing) !== canonicalJson(subject))
      throw new Error(`conflicting authenticated topology subject ${subject.subjectId}`);
    subjects.set(subject.subjectId, subject);
  }
  const capabilities = input.capabilities.filter(({ executesRepositoryCode }) => !executesRepositoryCode);
  const routes = [...subjects.values()].map((subject) => {
    const semantic = subject.subjectKind === "event" ? "event-topology" : "public-contract-topology";
    const candidates = capabilities.filter(({ supportedSemantics }) => supportedSemantics.includes(semantic));
    const profiles = new Map(candidates.map((candidate) => [canonicalJson({
      ...candidate,
      supportedLanguages: sortedUnique(candidate.supportedLanguages),
      supportedSemantics: sortedUnique(candidate.supportedSemantics),
      enumeration: { ...candidate.enumeration, assumptions: sortedUnique(candidate.enumeration.assumptions), blindSpots: sortedUnique(candidate.enumeration.blindSpots), dynamicMechanisms: sortedUnique(candidate.enumeration.dynamicMechanisms) }
    }), candidate]));
    if (profiles.size > 1)
      throw new Error(`conflicting authenticated capability profiles for ${semantic}`);
    const capability = profiles.values().next().value;
    const localFailures = input.failures.filter(({ analyzerId, scope, affectedClaimKinds, capability: failedCapability }) => capability?.analyzerId === analyzerId && (scope === subject.scopeKey || scope === subject.subjectId) && (affectedClaimKinds.includes(semantic) || failedCapability === semantic));
    const authenticated = capability !== void 0 && localFailures.length === 0;
    const links = input.participants.filter(({ subjectId }) => subjectId === subject.subjectId).map((participant) => ({
      participantId: participant.participantId,
      role: participant.role,
      assurance: authenticated ? "exact" : "heuristic",
      confidence: authenticated ? 1 : 0.5,
      evidenceIds: sortedUnique(participant.evidenceIds),
      adapterVersion: capability?.adapterVersion ?? "unavailable",
      artifactHash: participant.artifactHash
    })).sort((left, right) => compareStrings(left.participantId, right.participantId) || compareStrings(left.role, right.role));
    const queryVersion = capability?.adapterVersion ?? "unavailable";
    const observability = subject.dynamic || !authenticated ? "open" : capability.enumeration.observability;
    const enumeration = capability === void 0 ? void 0 : {
      method: capability.enumeration.method,
      assumptions: sortedUnique(capability.enumeration.assumptions),
      blindSpots: sortedUnique(capability.enumeration.blindSpots),
      dynamicMechanisms: sortedUnique(capability.enumeration.dynamicMechanisms),
      ...capability.enumeration.freshnessRequirement === void 0 ? {} : { freshnessRequirement: capability.enumeration.freshnessRequirement }
    };
    const routeSemantic = {
      subjectId: subject.subjectId,
      subjectKind: subject.subjectKind,
      semanticKey: subject.semanticKey,
      queryVersion,
      producerIds: sortedUnique(links.filter(({ role }) => role === "producer").map(({ participantId }) => participantId)),
      consumerIds: sortedUnique(links.filter(({ role }) => role === "consumer").map(({ participantId }) => participantId)),
      links,
      observability,
      ...enumeration === void 0 ? {} : { enumeration }
    };
    return { id: `topology_route_${hashFramedDomain("event-contract-topology-route-identity", { subjectId: subject.subjectId, subjectKind: subject.subjectKind }).slice(-32)}`, ...routeSemantic, contentHash: hashFramedDomain("event-contract-topology-route", routeSemantic) };
  }).sort((left, right) => compareStrings(left.subjectId, right.subjectId));
  return { routes, contentHash: hashFramedDomain("event-contract-topology", routes) };
}
function createTopologyRelevanceQueryStatePort(topology) {
  const routes = new Map(topology.routes.map((route) => [route.subjectId, route]));
  return {
    inspect: (subjectId, subjectKind) => {
      const route = routes.get(subjectId);
      if (route === void 0 || route.subjectKind !== subjectKind) {
        return { results: [], observability: "unavailable", assumptions: [], unavailableLanes: [`topology:${subjectId}`], dependencyKeys: [`topology:${subjectId}`] };
      }
      return {
        results: route.links.filter(({ role }) => role === "consumer").map((link) => ({
          id: `${link.role}:${link.participantId}`,
          subjectId: route.subjectId,
          subjectKind: route.subjectKind,
          semanticKey: route.semanticKey,
          observability: route.observability,
          enumeration: route.enumeration ?? null,
          participantId: link.participantId,
          role: link.role,
          assurance: link.assurance,
          confidence: link.confidence,
          evidenceIds: link.evidenceIds,
          adapterVersion: link.adapterVersion,
          artifactHash: link.artifactHash,
          requiredForPlanning: link.assurance !== "heuristic",
          reasonKind: route.subjectKind === "contract" ? "contract-producer-consumer" : "event-producer-consumer",
          reasonExplanation: `${link.role} of ${route.semanticKey} observed with ${link.assurance} assurance`
        })),
        observability: route.observability,
        assumptions: sortedUnique([
          ...route.enumeration?.assumptions ?? [],
          ...route.enumeration?.blindSpots.map((value) => `blind-spot:${value}`) ?? [],
          ...route.enumeration?.dynamicMechanisms.map((value) => `dynamic:${value}`) ?? []
        ]),
        unavailableLanes: [],
        dependencyKeys: [`topology:${subjectId}`]
      };
    }
  };
}
function createTopologyRelevanceAdapter(topology, queryBinding) {
  const routes = new Map(topology.routes.map((route) => [route.subjectId, route]));
  return {
    discover: async (subjectId, _depth, context) => {
      const route = routes.get(subjectId);
      if (route === void 0)
        throw new Error(`topology route ${subjectId} is unavailable for registered query binding`);
      const links = route?.links.filter(({ role }) => role === "consumer") ?? [];
      const edges = links.map((link) => ({
        entityId: link.participantId,
        band: "consequence",
        score: link.confidence,
        requiredForPlanning: link.assurance !== "heuristic",
        reason: {
          kind: route?.subjectKind === "contract" ? "contract-producer-consumer" : "event-producer-consumer",
          fromId: subjectId,
          weight: link.confidence,
          provenance: link.assurance === "exact" ? "derived" : "observed",
          confidence: link.confidence,
          explanation: `${link.role} of ${route?.semanticKey ?? subjectId} observed with ${link.assurance} assurance`,
          evidenceIds: [...link.evidenceIds]
        },
        cost: 1
      })).sort((left, right) => compareStrings(left.entityId, right.entityId));
      const dependency = await queryBinding.bind(subjectId, route.subjectKind, context);
      const programId = `projector.topology.${route.subjectKind}-relevance`;
      const kind = `${route.subjectKind}-topology`;
      const input = { subjectId };
      const queryHash = hashFramedDomain("state-query", { kind, programId, programVersion: route.queryVersion, input });
      const snapshot = createTopologyRelevanceQueryStatePort(topology).inspect(subjectId, route.subjectKind);
      const expectedFingerprint = {
        queryHash,
        resultHash: hashFramedDomain("state-query-result", snapshot.results),
        resultCount: snapshot.results.length,
        observability: snapshot.observability,
        assumptions: snapshot.assumptions,
        unavailableLanes: snapshot.unavailableLanes,
        dependencyKeys: snapshot.dependencyKeys
      };
      if (dependency.query.kind !== kind || dependency.query.programId !== programId || dependency.query.programVersion !== route.queryVersion || canonicalJson(dependency.query.input) !== canonicalJson(input) || dependency.query.semanticHash !== queryHash || canonicalJson(dependency.priorResult) !== canonicalJson(expectedFingerprint)) {
        throw new Error(`topology query binding for ${subjectId} is not the canonical registered query fingerprint`);
      }
      return {
        edges,
        dependency
      };
    }
  };
}

// node_modules/@projector/analyzers/dist/topology/repository.js
function compileRepositoryTopology(javaScript, capabilities, failures) {
  const observations = [...javaScript.events.map((fact) => ({ ...fact, subjectKind: "event" })), ...javaScript.contracts.map((fact) => ({ ...fact, subjectKind: "contract", dynamic: false }))];
  const bySubject = /* @__PURE__ */ new Map();
  for (const observation of observations)
    bySubject.set(observation.subjectId, [...bySubject.get(observation.subjectId) ?? [], observation]);
  const uncertainEventReceivers = new Set(javaScript.eventUncertainties.map(({ receiver }) => receiver));
  const subjects = [...bySubject.values()].map((group) => {
    const producer = group.find(({ role }) => role === "producer") ?? group[0];
    const receiver = "receiver" in producer ? producer.receiver : void 0;
    return { subjectId: producer.subjectId, subjectKind: producer.subjectKind, semanticKey: producer.semanticKey, scopeKey: producer.scopeKey, artifactHash: producer.artifactHash, dynamic: group.some(({ dynamic }) => dynamic) || receiver !== void 0 && uncertainEventReceivers.has(receiver) };
  });
  const participants = observations.map(({ subjectId, participantId, role, evidenceId, artifactHash }) => ({ subjectId, participantId, role, evidenceIds: [evidenceId], artifactHash }));
  return compileAuthenticatedAnalyzerTopology({ subjects, participants, capabilities, failures });
}
function divergence(code, path, subjectIds, explanation, evidenceIds, coverageCaveat) {
  const semantic = { code, path, subjectIds: [...new Set(subjectIds)].sort(compareCodePoint), explanation, provenance: { analyzerId: "projector.mechanical-divergence", evidenceIds: [...new Set(evidenceIds)].sort(compareCodePoint) }, assurance: "exact", counterevidence: [], coverageCaveat };
  return { id: `analyzer_divergence_${hashFramedDomain("analyzer-divergence-identity", { code, path, subjectIds: semantic.subjectIds }).slice(-32)}`, ...semantic, contentHash: hashFramedDomain("analyzer-divergence", semantic) };
}
function detectMechanicalDivergences(javaScript, actions) {
  const result = [];
  for (const failure2 of javaScript.failures.filter(({ capability }) => capability === "module-resolution"))
    result.push(divergence("broken-static-import", failure2.scope, [], failure2.message, [], "Only static relative imports are resolved."));
  const publicExports = /* @__PURE__ */ new Map();
  for (const file of javaScript.files)
    for (const declaration of file.declarations.filter(({ exported }) => exported)) {
      const key = `${file.scopeKey}\0${declaration.name}`;
      publicExports.set(key, [...publicExports.get(key) ?? [], { path: file.path, id: declaration.id }]);
    }
  for (const candidates of publicExports.values()) {
    const duplicates = [...new Map(candidates.map((candidate) => [candidate.path, candidate])).values()];
    if (duplicates.length > 1)
      result.push(divergence("duplicate-public-export", duplicates.map(({ path }) => path).sort(compareCodePoint)[0], duplicates.map(({ id }) => id), "The same package scope exposes multiple declarations with one public name.", duplicates.map(({ id }) => id), "Declaration merging remains outside exact duplicate classification."));
  }
  for (const workflow of actions) {
    const jobIds = new Set(workflow.jobs.map(({ id }) => id));
    for (const job of workflow.jobs)
      for (const missing2 of job.needs.filter((need) => !jobIds.has(need)))
        result.push(divergence("actions-needs-gap", workflow.path, [`actions-job:${job.id}`, `actions-job:${missing2}`], `Job ${job.id} needs missing job ${missing2}.`, [`${workflow.path}:${job.line}`], "Only literal needs entries in this workflow are checked."));
  }
  return result.sort((a, b) => compareCodePoint(a.code, b.code) || compareCodePoint(a.path, b.path) || compareCodePoint(a.id, b.id));
}

// node_modules/@projector/analyzers/dist/local-repository.js
var localRepositoryAdapterVersion = "2.3.1";
var adapterVersion = localRepositoryAdapterVersion;
function tokenizeCommand(command) {
  const tokens = [];
  let token = "";
  let quote;
  let escaped = false;
  for (const character of command) {
    if (escaped) {
      token += character;
      escaped = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote !== void 0) {
      if (character === quote)
        quote = void 0;
      else
        token += character;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === ";" || character === "&" || character === "|" || character === ">" || character === "<") {
      if (token.length > 0)
        tokens.push(token);
      token = "";
      const previous = tokens.at(-1);
      if (character !== ";" && previous === character)
        tokens[tokens.length - 1] = `${character}${character}`;
      else
        tokens.push(character);
      continue;
    }
    if (/\s/u.test(character)) {
      if (token.length > 0)
        tokens.push(token);
      token = "";
      continue;
    }
    token += character;
  }
  if (token.length > 0)
    tokens.push(token);
  return tokens;
}
function executableTargets(tokens) {
  const result = [];
  let segment = [];
  const consume = () => {
    if (segment.length === 0)
      return;
    let runnerIndex = 0;
    while (/^[A-Za-z_][A-Za-z0-9_]*=/u.test(segment[runnerIndex] ?? ""))
      runnerIndex += 1;
    const runner = posix2.basename(segment[runnerIndex] ?? "");
    if (!["node", "node.exe", "bun", "deno", "tsx", "ts-node"].includes(runner)) {
      segment = [];
      return;
    }
    let skipNext = false;
    for (const target of segment.slice(runnerIndex + 1)) {
      if (skipNext) {
        skipNext = false;
        continue;
      }
      if ([">", ">>", "<", "<<"].includes(target)) {
        skipNext = true;
        continue;
      }
      if (["-e", "--eval", "-p", "--print", "--input-type", "--require", "-r", "--import"].includes(target)) {
        skipNext = true;
        continue;
      }
      if (target.startsWith("-"))
        continue;
      if (/\.(?:mjs|js|cjs|mts|cts|ts|tsx|jsx)$/u.test(target) && !target.includes("*"))
        result.push({ runner, target });
    }
    segment = [];
  };
  for (const token of tokens) {
    if ([";", "&", "&&", "|", "||"].includes(token))
      consume();
    else
      segment.push(token);
  }
  consume();
  return result;
}
function analyzePackageScripts(entries) {
  const invocations = [];
  const failures = [];
  let repositoryKey = "local-repository";
  for (const entry of entries.filter((candidate) => posix2.basename(candidate.path) === "package.json")) {
    try {
      const manifest = JSON.parse(entry.content);
      if (entry.path === "package.json" && typeof manifest.name === "string" && manifest.name.trim().length > 0) {
        repositoryKey = manifest.name.trim();
      }
      if (typeof manifest.scripts !== "object" || manifest.scripts === null || Array.isArray(manifest.scripts))
        continue;
      for (const [scriptName, value] of Object.entries(manifest.scripts).sort(([left], [right]) => compareCodePoint(left, right))) {
        if (typeof value !== "string")
          continue;
        const tokens = tokenizeCommand(value);
        for (const { runner, target } of executableTargets(tokens)) {
          const targetPath = posix2.normalize(posix2.join(posix2.dirname(entry.path), target.replace(/^\.\//u, "")));
          invocations.push({
            sourceClass: "derived",
            manifestPath: entry.path,
            scriptName,
            command: value,
            runner,
            targetPath
          });
        }
      }
    } catch (error) {
      failures.push({
        analyzerId: "projector.package-scripts",
        capability: "package-script-invocations",
        scope: entry.path,
        message: error instanceof Error ? error.message : String(error),
        recoverable: true,
        affectedClaimKinds: ["package-script-invocation", "repository-automation-role"]
      });
    }
  }
  invocations.sort((left, right) => compareCodePoint(left.manifestPath, right.manifestPath) || compareCodePoint(left.scriptName, right.scriptName) || compareCodePoint(left.targetPath, right.targetPath));
  return { invocations, failures, repositoryKey };
}
function hookReachablePaths(files, dependencies) {
  const entrypoints = files.filter((file) => file.lifecycleExports.length > 0).map((file) => file.path);
  const outgoing = /* @__PURE__ */ new Map();
  for (const dependency of dependencies) {
    if (dependency.resolvedPath === void 0)
      continue;
    const targets = outgoing.get(dependency.importerPath) ?? [];
    targets.push(dependency.resolvedPath);
    outgoing.set(dependency.importerPath, targets);
  }
  const reachable = new Set(entrypoints);
  const queue = [...entrypoints];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === void 0)
      continue;
    for (const target of outgoing.get(current) ?? []) {
      if (reachable.has(target))
        continue;
      reachable.add(target);
      queue.push(target);
    }
  }
  return reachable;
}
function roleFor(entry, javaScript, invocations, testTargets, hookReachable) {
  const evidence = [];
  const packageInvocations = invocations.filter((invocation) => invocation.targetPath === entry.path);
  evidence.push(...packageInvocations.map((invocation) => ({
    sourceClass: "derived",
    kind: "package-script-invocation",
    detail: invocation.scriptName,
    strength: 100
  })));
  const targetingTests = testTargets.filter((target) => target.targetPath === entry.path);
  evidence.push(...targetingTests.map((target) => ({
    sourceClass: "derived",
    kind: "test-target",
    detail: target.testPath,
    strength: 90
  })));
  if (javaScript !== void 0 && javaScript.lifecycleExports.length > 0) {
    evidence.push({ sourceClass: "derived", kind: "hook-lifecycle", detail: javaScript.lifecycleExports.join(","), strength: 100 });
  }
  if (hookReachable.has(entry.path) && javaScript?.lifecycleExports.length === 0) {
    evidence.push({ sourceClass: "derived", kind: "hook-reachability", detail: "reachable-from-hook-entrypoint", strength: 90 });
  }
  if (entry.path.startsWith(".codex/hooks/")) {
    evidence.push({ sourceClass: "derived", kind: "directory-proximity", detail: ".codex/hooks", strength: 10 });
  }
  evidence.sort((left, right) => right.strength - left.strength || compareCodePoint(left.kind, right.kind) || compareCodePoint(left.detail, right.detail));
  if (/\.test\.(?:mjs|js|cjs|mts|cts|ts|tsx|jsx)$/u.test(entry.path))
    return { role: "test", evidence };
  if (javaScript !== void 0 && javaScript.lifecycleExports.length > 0)
    return { role: "hook-entrypoint", evidence };
  if (hookReachable.has(entry.path))
    return { role: "hook-private-support", evidence };
  if (packageInvocations.length > 0 || targetingTests.length > 0)
    return { role: "repository-automation", evidence };
  if (entry.path.endsWith("package.json"))
    return { role: "configuration", evidence };
  if (entry.mediaType === "text/markdown")
    return { role: "documentation", evidence };
  if (javaScript !== void 0)
    return { role: "source", evidence };
  return { role: "other", evidence };
}
function signature(profileId, scope, value, hash) {
  return {
    hash: hash ?? hashFramedDomain(profileId, value),
    profileId,
    profileVersion: "1",
    scope,
    assurance: "exact",
    evidenceIds: []
  };
}
function localSemanticKey(entry, javaScript, role) {
  if (javaScript !== void 0 && javaScript.exports.length > 0)
    return `exports:${javaScript.exports.join(",")}`;
  if (javaScript !== void 0 && javaScript.testNames.length > 0)
    return `tests:${javaScript.testNames.join("|")}`;
  if (entry.path.endsWith("package.json")) {
    try {
      const parsed = JSON.parse(entry.content);
      if (typeof parsed.name === "string")
        return `package:${parsed.name}`;
    } catch {
    }
  }
  return `${role}:${javaScript?.fallbackHash ?? inventoryTextHash(entry, "local-unit-fallback")}`;
}
function projectionRole(role) {
  if (role === "test")
    return "test";
  if (role === "configuration")
    return "configuration";
  if (role === "documentation")
    return "documentation";
  if (role === "hook-private-support")
    return "supporting";
  return "implementation";
}
function buildCapabilities(rootAvailable, inventoryEnumeration) {
  return [
    {
      analyzerId: "projector.filesystem-local",
      adapterVersion,
      supportedLanguages: [],
      supportedSemantics: ["deterministic-file-inventory", "generated-source-markers"],
      enumeration: {
        observability: "bounded",
        method: inventoryEnumeration.method,
        assumptions: [...inventoryEnumeration.assumptions],
        blindSpots: [...inventoryEnumeration.blindSpots],
        dynamicMechanisms: []
      },
      executesRepositoryCode: false
    },
    {
      analyzerId: "projector.git-local",
      adapterVersion,
      supportedLanguages: [],
      supportedSemantics: ["tracked-object-identity", "introduction-commit", "working-tree-moves"],
      enumeration: {
        observability: "bounded",
        method: "read-only-git-plumbing",
        assumptions: ["Git CLI can read repository metadata"],
        blindSpots: ["copy intent without recorded history"],
        dynamicMechanisms: []
      },
      executesRepositoryCode: false
    },
    {
      analyzerId: "projector.javascript-local",
      adapterVersion: `${adapterVersion}+${syntaxProgramVersion}`,
      supportedLanguages: ["JavaScript", "TypeScript"],
      supportedSemantics: ["static-imports", "static-reexports", "named-exports", "test-targets", "hook-lifecycle", "package-script-invocations"],
      enumeration: {
        observability: "bounded",
        method: "no-exec-local-syntax-extraction",
        assumptions: ["ES module syntax uses static string specifiers"],
        blindSpots: ["dynamic imports", "computed module paths", "runtime require bindings", "full TypeScript type semantics"],
        dynamicMechanisms: ["dynamic import", "runtime module resolution"]
      },
      executesRepositoryCode: false
    },
    {
      analyzerId: "projector.typescript-semantic",
      adapterVersion: `${adapterVersion}+${syntaxProgramVersion}`,
      supportedLanguages: ["JavaScript", "TypeScript"],
      supportedSemantics: ["semantic-declarations", "scoped-symbol-identity", "event-topology", "public-contract-topology"],
      enumeration: rootAvailable ? {
        observability: "bounded",
        method: "bounded static syntax inventory",
        assumptions: ["inventory complete for route scope"],
        blindSpots: ["computed event and contract names"],
        dynamicMechanisms: ["computed event names", "runtime module resolution"]
      } : { observability: "unavailable", method: "repository-root-read-attempt", assumptions: [], blindSpots: ["repository unavailable"], dynamicMechanisms: [] },
      executesRepositoryCode: false
    },
    {
      analyzerId: "projector.structured-documents",
      adapterVersion,
      supportedLanguages: ["JSON", "YAML", "TOML", "Markdown", "GitHub Actions"],
      supportedSemantics: ["stable-document-paths", "actions-workflow-structure", "markdown-structure"],
      enumeration: { observability: rootAvailable ? "bounded" : "unavailable", method: "inert bounded document parsing", assumptions: rootAvailable ? ["inventoried text is complete"] : [], blindSpots: ["custom YAML tags", "runtime Actions expressions"], dynamicMechanisms: ["Actions expressions"] },
      executesRepositoryCode: false
    }
  ];
}
async function analyzeLocalRepository(options) {
  const budget = options.budget ?? new ObservationBudget(options.observationLimits);
  const result = analyzeCollectedLocalRepository(await collectLocalRepositoryInputs({ ...options, budget }));
  budget.check("semantic-analysis");
  return result;
}
async function collectLocalRepositoryInputs(options) {
  const repositoryRoot = resolve2(options.repositoryRoot);
  const budget = options.budget ?? new ObservationBudget(options.observationLimits);
  const signalOption = options.signal === void 0 ? {} : { signal: options.signal };
  const inventoryResult = await inventoryRepository(repositoryRoot, { budget, ...signalOption, ...options.contentStore === void 0 ? {} : { contentStore: options.contentStore }, ...options.byteReuse === void 0 ? {} : { byteReuse: options.byteReuse } });
  const gitFacts = await collectGitFacts(repositoryRoot, inventoryResult.entries.map((entry) => entry.path), {
    budget,
    ...signalOption,
    entries: inventoryResult.entries,
    ...inventoryResult.contentStore === void 0 ? {} : { contentStore: inventoryResult.contentStore },
    confirmedNonGit: inventoryResult.enumeration.method === "recursive-filesystem-fallback"
  });
  budget.check("collection");
  return { options: {
    repositoryRoot,
    ...options.observedAt === void 0 ? {} : { observedAt: options.observedAt },
    ...options.observationRevision === void 0 ? {} : { observationRevision: options.observationRevision }
  }, inventoryResult, gitFacts };
}
function analyzeCollectedLocalRepository(collected, derivedBudget = new DerivedObservationBudget(collected.inventoryResult.observationDescriptor.limits.maxDerivedBytes), context) {
  const { options, inventoryResult } = collected;
  const inventory = inventoryResult.entries;
  const packageFacts = analyzePackageScripts(inventory);
  const javaScriptFacts = context?.javaScript ?? analyzeJavaScript(inventory, derivedBudget);
  const documentFacts = analyzeDocuments(inventory);
  const gitFacts = finalizeGitFacts(collected.gitFacts, derivedBudget);
  const hookReachable = hookReachablePaths(javaScriptFacts.files, javaScriptFacts.dependencies);
  const javaScriptByPath = new Map(javaScriptFacts.files.map((facts) => [facts.path, facts]));
  const gitByPath = new Map(gitFacts.identities.map((identity) => [identity.path, identity]));
  const movedFromByPath = new Map(gitFacts.moves.map((move) => [move.toPath, move.fromPath]));
  const specifiersByPath = /* @__PURE__ */ new Map();
  for (const dependency of javaScriptFacts.dependencies) {
    const specifiers = specifiersByPath.get(dependency.importerPath) ?? [];
    specifiers.push(dependency.specifier);
    specifiersByPath.set(dependency.importerPath, specifiers);
  }
  for (const specifiers of specifiersByPath.values())
    specifiers.sort(compareCodePoint);
  const rootAvailable = inventoryResult.rootAvailability === "available";
  const surfaceId = deriveEntityId("projector.repository-surface", packageFacts.repositoryKey);
  const surface = {
    id: surfaceId,
    key: packageFacts.repositoryKey,
    kind: "repository",
    adapter: "projector.local-repository@1",
    access: rootAvailable ? "read-only" : "unavailable",
    enumeration: rootAvailable ? {
      observability: "bounded",
      method: "composed-local-filesystem-git-and-static-syntax-observation",
      assumptions: [...inventoryResult.enumeration.assumptions],
      blindSpots: [...inventoryResult.enumeration.blindSpots, "dynamic module resolution", "unavailable per-entry observations"],
      dynamicMechanisms: ["runtime module resolution", "generated state outside inventory boundary"]
    } : {
      observability: "unavailable",
      method: "repository-root-read-attempt",
      assumptions: [],
      blindSpots: ["repository root could not be enumerated; no absence claim is valid"],
      dynamicMechanisms: []
    },
    capabilities: {
      read: rootAvailable,
      write: false,
      watch: false,
      transactionalWrites: false,
      stableAnchors: rootAvailable,
      humanApprovalRequired: false
    },
    boundary: { repositoryKey: packageFacts.repositoryKey }
  };
  const observedAt = options.observedAt ?? "1970-01-01T00:00:00.000Z";
  const observationRevision = options.observationRevision ?? gitFacts.revision;
  const artifacts = [];
  const projectionUnits = [];
  const files = [];
  const baseSemanticKeys = /* @__PURE__ */ new Map();
  const keyCounts = /* @__PURE__ */ new Map();
  for (const entry of inventory) {
    const javaScript = javaScriptByPath.get(entry.path);
    const { role } = roleFor(entry, javaScript, packageFacts.invocations, context?.testTargets ?? javaScriptFacts.testTargets, hookReachable);
    const key = localSemanticKey(entry, javaScript, role);
    baseSemanticKeys.set(entry.path, key);
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }
  const semanticKeys = /* @__PURE__ */ new Map();
  for (const entry of inventory) {
    const javaScript = javaScriptByPath.get(entry.path);
    const baseSemanticKey = baseSemanticKeys.get(entry.path);
    const semanticKey = (context?.semanticKeyCounts?.[baseSemanticKey] ?? keyCounts.get(baseSemanticKey)) === 1 ? baseSemanticKey : `${baseSemanticKey}:variant:${javaScript?.variantHash ?? inventoryTextHash(entry, "local-unit-variant")}`;
    semanticKeys.set(entry.path, semanticKey);
  }
  for (const entry of inventory) {
    const javaScript = javaScriptByPath.get(entry.path);
    const { role, evidence } = roleFor(entry, javaScript, packageFacts.invocations, context?.testTargets ?? javaScriptFacts.testTargets, hookReachable);
    derivedBudget.reserve(3072 + 4 * entry.path.length + 64 * evidence.length, "local-artifact-facts", entry.path);
    const semanticKey = semanticKeys.get(entry.path);
    const movedFrom = movedFromByPath.get(entry.path);
    const observationKey = `source:${movedFrom ?? entry.path}`;
    const artifactId = deriveEntityId("projector.repository-artifact", observationKey);
    const unitId = deriveEntityId("projector.projection-unit", observationKey);
    const structuralFields = {
      role,
      exports: javaScript?.exports ?? [],
      lifecycleExports: javaScript?.lifecycleExports ?? [],
      dependencySpecifiers: specifiersByPath.get(entry.path) ?? []
    };
    const structuralSignature = signature("projector.local-structural", semanticKey, structuralFields, javaScript === void 0 ? void 0 : hashJavaScriptSemantics(entry.content, "projector.local-structural", derivedBudget, entry.path, {
      fields: structuralFields,
      key: "syntaxTokens"
    }));
    const semanticSignature = signature("projector.local-semantic", semanticKey, void 0, javaScript?.semanticHash ?? inventoryTextHash(entry, "projector.local-semantic"));
    const anchor = javaScript !== void 0 && javaScript.exports.length > 0 ? { kind: "symbol", value: `exports:${javaScript.exports.join(",")}`, fallbackSignature: structuralSignature } : javaScript !== void 0 && javaScript.testNames.length > 0 ? { kind: "ast-node", value: `tests:${javaScript.testNames.join("|")}`, fallbackSignature: structuralSignature } : entry.path.endsWith("package.json") ? { kind: "json-pointer", value: "/", fallbackSignature: structuralSignature } : { kind: "file", value: semanticKey, fallbackSignature: structuralSignature };
    const tags = [role, "source-class:derived", ...entry.generated ? ["generated"] : []].sort(compareCodePoint);
    artifacts.push({
      id: artifactId,
      surfaceId,
      locator: entry.path,
      mediaType: entry.mediaType,
      contentHash: entry.contentHash,
      structuralSignature,
      semanticSignature,
      observedAt,
      observationRevision,
      causalOrigin: { kind: "deterministic-observation" },
      metadata: {
        sourceClass: "derived",
        generated: entry.generated,
        semanticRole: role,
        ...entry.generatedReason === void 0 ? {} : { generatedReason: entry.generatedReason },
        ...entry.symlinkTarget === void 0 ? {} : { symlinkTarget: entry.symlinkTarget }
      }
    });
    projectionUnits.push({
      id: unitId,
      artifactId,
      key: entry.path,
      role: projectionRole(role),
      anchor,
      control: { ownership: "structured", mutation: "transform", actuation: "approval" },
      conceptIds: [],
      requirementIds: [],
      scenarioIds: [],
      lenses: [],
      tags,
      structuralSignature,
      semanticSignature,
      membershipHash: hashFramedDomain("projection-unit-membership", { semanticKey, role, tags }),
      validity: "valid",
      confidence: role === "other" ? 0.5 : 1,
      causalOrigin: { kind: "deterministic-observation" },
      generatedFromUnitIds: []
    });
    files.push({
      sourceClass: "derived",
      path: entry.path,
      artifactId,
      mediaType: entry.mediaType,
      contentHash: entry.contentHash,
      generated: entry.generated,
      ...entry.generatedReason === void 0 ? {} : { generatedReason: entry.generatedReason },
      semanticRole: role,
      roleEvidence: evidence,
      exports: javaScript?.exports ?? [],
      lifecycleExports: javaScript?.lifecycleExports ?? [],
      ...gitByPath.get(entry.path) === void 0 ? {} : { gitIdentity: gitByPath.get(entry.path) }
    });
  }
  const byLocator = (left, right) => compareCodePoint(left.locator, right.locator);
  artifacts.sort(byLocator);
  projectionUnits.sort((left, right) => compareCodePoint(left.key, right.key));
  files.sort((left, right) => compareCodePoint(left.path, right.path));
  const failures = [...inventoryResult.failures, ...packageFacts.failures, ...javaScriptFacts.failures, ...documentFacts.failures, ...gitFacts.failures].sort((left, right) => compareCodePoint(left.analyzerId, right.analyzerId) || compareCodePoint(left.scope, right.scope) || compareCodePoint(left.capability, right.capability));
  const capabilities = buildCapabilities(rootAvailable, inventoryResult.enumeration);
  const topology = compileRepositoryTopology(javaScriptFacts, capabilities, failures);
  const divergences = detectMechanicalDivergences(javaScriptFacts, documentFacts.actions);
  return {
    observationDescriptor: inventoryResult.observationDescriptor,
    surface,
    capabilities,
    artifacts,
    projectionUnits,
    files,
    git: gitFacts,
    gitIdentities: gitFacts.identities,
    gitMoves: gitFacts.moves,
    packageScriptInvocations: packageFacts.invocations,
    dependencies: javaScriptFacts.dependencies,
    testTargets: javaScriptFacts.testTargets,
    javaScript: javaScriptFacts,
    documents: documentFacts.documents,
    actions: documentFacts.actions,
    markdown: documentFacts.markdown,
    topology,
    divergences,
    failures
  };
}

// node_modules/@projector/analyzers/dist/git/tree.js
async function analyzeGitTree(root, tree, budget, derived, signal) {
  const options = { signal, stage: "git-tree-analysis" };
  const listing = await observationGitBytes(root, ["ls-tree", "-r", "-z", tree], budget, options);
  const objects = [];
  for (const record of new TextDecoder("utf-8", { fatal: true }).decode(listing).split("\0")) {
    if (!record)
      continue;
    const match = /^(\d+) (\w+) ([a-f0-9]+)\t([\s\S]+)$/.exec(record);
    if (!match)
      throw new Error("Malformed immutable Git tree entry");
    const path = match[4];
    if (path === ".projector" || path.startsWith(".projector/") || path.startsWith(".git/") || path.startsWith(".worktrees/"))
      continue;
    budget.consume("maxFiles", 1, "git-tree-analysis", path);
    derived.reserve(256 + record.length * 2, "git-tree-analysis", path);
    objects.push({ path, oid: match[3], mode: match[1], type: match[2] });
  }
  const failures = [];
  const selected = objects.filter((object) => object.type === "blob");
  for (const object of objects.filter((object2) => object2.type !== "blob"))
    failures.push({ analyzerId: "projector.git-tree", capability: "inventory", scope: object.path, recoverable: false, affectedClaimKinds: ["dependency-population"], message: "Submodule contents are outside this immutable tree." });
  const entries = [];
  if (selected.length) {
    const input = selected.map((object) => object.oid).join("\n") + "\n";
    const sizes = (await observationGit(root, ["cat-file", "--batch-check"], budget, { ...options, input })).trimEnd().split("\n");
    if (sizes.length !== selected.length)
      throw new Error("Invalid immutable blob count");
    let total = 0;
    sizes.forEach((header, index) => {
      const match = /^([a-f0-9]+) blob (\d+)$/.exec(header);
      if (!match || match[1] !== selected[index].oid)
        throw new Error("Invalid immutable blob header");
      const size = Number(match[2]);
      if (!Number.isSafeInteger(size))
        throw new Error("Invalid immutable blob size");
      budget.assertFileBytes(size, selected[index].path);
      total += size;
    });
    budget.assertTotalBytes(total, "git-tree-analysis");
    const bytes = await observationGitBytes(root, ["cat-file", "--batch"], budget, { ...options, input });
    let offset = 0;
    for (const object of selected) {
      checkObservation(budget, signal, "git-tree-analysis", object.path);
      const end = bytes.indexOf(10, offset), match = /^([a-f0-9]+) blob (\d+)$/.exec(bytes.subarray(offset, end).toString("ascii"));
      if (end < 0 || !match || match[1] !== object.oid)
        throw new Error("Invalid immutable blob framing");
      const size = Number(match[2]);
      offset = end + 1;
      if (!Number.isSafeInteger(size) || offset + size >= bytes.length || bytes[offset + size] !== 10)
        throw new Error("Truncated immutable blob");
      budget.consume("maxTotalBytes", size, "git-tree-analysis", object.path);
      const raw = bytes.subarray(offset, offset + size);
      offset += size + 1;
      const content = raw.toString("utf8"), generated = /(?:@generated|generated file|do not edit)/iu.test(content.slice(0, 1024));
      const mediaType2 = object.path.endsWith(".json") ? "application/json" : /\.ya?ml$/u.test(object.path) ? "application/yaml" : object.path.endsWith(".toml") ? "application/toml" : /\.(?:js|jsx|mjs|cjs)$/u.test(object.path) ? "text/javascript" : /\.(?:ts|tsx|mts|cts)$/u.test(object.path) ? "text/typescript" : object.path.endsWith(".md") ? "text/markdown" : "application/octet-stream";
      entries.push({ path: object.path, kind: object.mode === "120000" ? "symlink" : "file", mediaType: mediaType2, content, contentHash: hashFramedDomain("repository-artifact-content", raw.toString("base64")), generated, ...generated ? { generatedReason: "source-marker" } : {}, ...object.mode === "120000" ? { symlinkTarget: content } : {} });
    }
    if (offset !== bytes.length)
      throw new Error("Unexpected immutable blob trailing bytes");
  }
  const inventoryResult = { entries, failures, rootAvailability: "available", observationDescriptor: { schemaVersion: "projector.observation/v1", observerVersion: "3.0.0", scope: ".", enumerationMethod: "git-immutable-tree", limits: budget.limits, ignoreSources: [], excludedPaths: [".projector", ".git", ".worktrees"], globalGitConfig: "disabled" }, enumeration: { method: "git-immutable-tree", assumptions: ["All ordinary tracked blobs in the immutable tree are enumerated; checkout ignore rules are irrelevant"], blindSpots: ["Submodule contents", "runtime dependency resolution"] } };
  return analyzeCollectedLocalRepository({ options: { repositoryRoot: root, observationRevision: tree }, inventoryResult, gitFacts: { availability: "available", revision: tree, identities: objects.map((object) => ({ sourceClass: "observed", path: object.path, tracked: true, availability: "available", introductionHistory: "unavailable", objectId: object.oid })), moves: [], failures: [] } }, derived);
}

// node_modules/@projector/analyzers/dist/code-intelligence/typescript-provider.js
import { resolve as resolve4, relative as relative2, isAbsolute as isAbsolute4, sep as sep2, posix as posix3 } from "node:path";
import { readFileSync as readFileSync2, readdirSync as readdirSync2, statSync as statSync2 } from "node:fs";
import ts2 from "typescript";

// node_modules/@projector/analyzers/dist/code-intelligence/input-binding.js
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve as resolve3 } from "node:path";
function codeInputHash(content) {
  return hashFramedDomain("projector-code-input-v1", Buffer.from(content).toString("base64"));
}
function verifyCodeInputBinding(binding, repositoryRoot) {
  if (binding.status !== "verified")
    return false;
  for (const input of [
    ...binding.sourceInputs,
    ...binding.configInputs,
    ...binding.resolutionInputs
  ]) {
    try {
      if (codeInputHash(readFileSync(resolve3(repositoryRoot, input.path))) !== input.contentHash)
        return false;
    } catch {
      return false;
    }
  }
  for (const probe of binding.resolutionProbes ?? []) {
    let present = false;
    try {
      present = statSync(resolve3(repositoryRoot, probe.path)).isFile();
    } catch (error) {
      if (error.code !== "ENOENT")
        return false;
    }
    if (present !== probe.exists)
      return false;
  }
  for (const probe of binding.directoryProbes ?? []) {
    let present = false;
    try {
      present = statSync(resolve3(repositoryRoot, probe.path)).isDirectory();
    } catch (error) {
      if (error.code !== "ENOENT")
        return false;
    }
    if (present !== probe.exists)
      return false;
  }
  for (const listing of binding.directoryListings ?? []) {
    let directories;
    try {
      directories = readdirSync(resolve3(repositoryRoot, listing.path), {
        withFileTypes: true
      }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    } catch (error) {
      if (error.code !== "ENOENT")
        return false;
      directories = [];
    }
    if (directories.length !== listing.directories.length || directories.some((name, index) => name !== listing.directories[index]))
      return false;
  }
  return true;
}

// node_modules/@projector/analyzers/dist/code-intelligence/typescript-provider.js
function discoverTypeScriptProjects(inputs) {
  const candidates = inputs.filter((input) => /(?:^|\/)(?:tsconfig|jsconfig)(?:\.[^/]*)?\.json$/iu.test(input.path));
  const known = new Set(candidates.map((input) => input.path));
  const inherited = /* @__PURE__ */ new Set(), referenced = /* @__PURE__ */ new Set();
  const ownsFiles = /* @__PURE__ */ new Set();
  const resolveConfig = (from, target) => {
    const path = posix3.normalize(posix3.join(posix3.dirname(from), target));
    return [path, `${path}.json`, `${path}/tsconfig.json`].find((candidate) => known.has(candidate));
  };
  for (const input of candidates) {
    if (input.content === void 0)
      continue;
    const parsed = ts2.parseConfigFileTextToJson(input.path, input.content);
    if (parsed.error !== void 0)
      throw new Error(ts2.flattenDiagnosticMessageText(parsed.error.messageText, "\n"));
    const config = parsed.config;
    if (config.files !== void 0 || config.include !== void 0)
      ownsFiles.add(input.path);
    for (const parent of typeof config.extends === "string" ? [config.extends] : config.extends ?? []) {
      const path = resolveConfig(input.path, parent);
      if (path !== void 0)
        inherited.add(path);
    }
    for (const reference of config.references ?? []) {
      const path = resolveConfig(input.path, reference.path);
      if (path !== void 0)
        referenced.add(path);
    }
  }
  return candidates.map((input) => input.path).filter((path) => !inherited.has(path) || referenced.has(path) || ownsFiles.has(path)).sort();
}
var extensions = /\.(?:tsx?|jsx?|mts|cts|mjs|cjs)$/iu;
var provider = "projector.typescript-program";
var isIndexedDeclaration = (node) => ts2.isVariableDeclaration(node) || ts2.isFunctionDeclaration(node) || ts2.isFunctionExpression(node) || ts2.isClassDeclaration(node) || ts2.isClassExpression(node) || ts2.isInterfaceDeclaration(node) || ts2.isTypeAliasDeclaration(node) || ts2.isEnumDeclaration(node) || ts2.isEnumMember(node) || ts2.isModuleDeclaration(node) || ts2.isMethodDeclaration(node) || ts2.isMethodSignature(node) || ts2.isPropertyDeclaration(node) || ts2.isPropertySignature(node) || ts2.isPropertyAssignment(node) || ts2.isShorthandPropertyAssignment(node) || ts2.isParameter(node) || ts2.isBindingElement(node) || ts2.isGetAccessorDeclaration(node) || ts2.isSetAccessorDeclaration(node) || ts2.isTypeParameterDeclaration(node);
var TypeScriptCodeProvider = class {
  program;
  fingerprint;
  snapshot;
  get currentProgram() {
    return this.program;
  }
  update(inputs, options, sink) {
    const maxProofBytes = options.maxProofBytes ?? DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes;
    if (maxProofBytes !== null && (!Number.isSafeInteger(maxProofBytes) || maxProofBytes < 1))
      throw new RangeError("TypeScript maxProofBytes must be a positive safe integer");
    const assertProofBudget = (binding2) => {
      const proofBytes = Buffer.byteLength(JSON.stringify(binding2));
      if (maxProofBytes !== null && proofBytes > maxProofBytes)
        throw new Error(`TypeScript input binding requires ${proofBytes} bytes, exceeding maxProofBytes (${maxProofBytes}); increase the declared derived observation budget to retry`);
    };
    if (!isAbsolute4(options.repositoryRoot))
      throw new Error("TypeScript code provider requires absolute repositoryRoot");
    let files = [...inputs].filter((input) => extensions.test(input.path)).sort((a, b) => a.path.localeCompare(b.path));
    const seen = /* @__PURE__ */ new Set();
    for (const file of files) {
      if (!file.path || file.path.startsWith("/") || file.path.includes("\\") || file.path.split("/").includes("..") || seen.has(file.path))
        throw new Error(`Invalid or duplicate TypeScript source path: ${file.path}`);
      seen.add(file.path);
    }
    const configReads = /* @__PURE__ */ new Map();
    const configPath = options.configPath === void 0 ? void 0 : resolve4(options.repositoryRoot, options.configPath);
    const configSystem = {
      ...ts2.sys,
      readFile: (path) => {
        const value = ts2.sys.readFile(path);
        if (value !== void 0)
          configReads.set(resolve4(path), codeInputHash(value));
        return value;
      }
    };
    let parsedConfig;
    if (configPath !== void 0) {
      const parsed = ts2.readConfigFile(configPath, configSystem.readFile);
      if (parsed.error !== void 0)
        throw new Error(ts2.flattenDiagnosticMessageText(parsed.error.messageText, "\n"));
      parsedConfig = ts2.parseJsonConfigFileContent(parsed.config, configSystem, resolve4(configPath, ".."), void 0, configPath);
      if (parsedConfig.errors.length > 0)
        throw new Error(parsedConfig.errors.map((error) => ts2.flattenDiagnosticMessageText(error.messageText, "\n")).join("\n"));
      const members = new Set(parsedConfig.fileNames.map((path) => resolve4(path)));
      files = files.filter((file) => members.has(resolve4(options.repositoryRoot, file.path)));
    }
    const compilerOptions = {
      noEmit: true,
      allowJs: true,
      checkJs: true,
      jsx: ts2.JsxEmit.Preserve,
      module: ts2.ModuleKind.NodeNext,
      moduleResolution: ts2.ModuleResolutionKind.NodeNext,
      target: ts2.ScriptTarget.ES2024,
      ...parsedConfig?.options,
      ...options.compilerOptions
    };
    const configFingerprint = options.configFingerprint ?? hashFramedDomain("projector-ts-options-v1", {
      compilerOptions,
      configReads: [...configReads]
    });
    const inputFingerprint = hashFramedDomain("projector-ts-input-v1", files.map(({ path, content: content2 }) => ({
      path,
      contentHash: codeInputHash(content2)
    })));
    const cacheKey = hashFramedDomain("projector-ts-program-v1", {
      inputFingerprint,
      configFingerprint
    });
    const sourceBytesMatch = files.every((file) => {
      try {
        return readFileSync2(resolve4(options.repositoryRoot, file.path), "utf8") === file.content;
      } catch {
        return false;
      }
    });
    if (sourceBytesMatch && cacheKey === this.fingerprint && sink === void 0 && this.snapshot !== void 0 && verifyCodeInputBinding(this.snapshot.binding, options.repositoryRoot)) {
      assertProofBudget(this.snapshot.binding);
      return this.snapshot;
    }
    const content = new Map(files.map((file) => [resolve4(options.repositoryRoot, file.path), file]));
    const normalized = (name) => resolve4(name);
    const baseHost = ts2.createCompilerHost(compilerOptions);
    const externalReads = /* @__PURE__ */ new Map();
    const externalProbes = /* @__PURE__ */ new Map();
    const directoryProbes = /* @__PURE__ */ new Map();
    const directoryListings = /* @__PURE__ */ new Map();
    const diskDirectoryExists = (name) => {
      try {
        return statSync2(name).isDirectory();
      } catch (error) {
        if (error.code === "ENOENT")
          return false;
        throw error;
      }
    };
    const diskDirectories = (name) => {
      try {
        return readdirSync2(name, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
      } catch (error) {
        if (error.code === "ENOENT")
          return [];
        throw error;
      }
    };
    const fileExists = (name) => {
      const path = normalized(name), exists = content.has(path) || baseHost.fileExists(name);
      if (!content.has(path))
        externalProbes.set(path, exists);
      return exists;
    };
    const readFile = (name) => {
      const internal = content.get(normalized(name));
      if (internal !== void 0)
        return internal.content;
      const value = baseHost.readFile(name);
      if (value !== void 0)
        externalReads.set(normalized(name), codeInputHash(value));
      return value;
    };
    const host = {
      ...baseHost,
      getCurrentDirectory: () => options.repositoryRoot,
      fileExists,
      readFile,
      getSourceFile: (name, languageVersion, onError) => {
        const data = readFile(name);
        if (data === void 0) {
          onError?.(`Missing source ${name}`);
          return void 0;
        }
        const scriptKind = /\.tsx$/iu.test(name) ? ts2.ScriptKind.TSX : /\.jsx$/iu.test(name) ? ts2.ScriptKind.JSX : /\.(?:js|mjs|cjs)$/iu.test(name) ? ts2.ScriptKind.JS : ts2.ScriptKind.TS;
        return ts2.createSourceFile(name, data, languageVersion, true, scriptKind);
      },
      writeFile: () => {
        throw new Error("Code intelligence must not emit compiler output");
      },
      directoryExists: (name) => {
        const directory = normalized(name), exists = diskDirectoryExists(directory);
        directoryProbes.set(directory, exists);
        return [...content.keys()].some((path) => path.startsWith(`${directory}${sep2}`)) || exists;
      },
      getDirectories: (name) => {
        const normalizedName = normalized(name), disk = diskDirectories(normalizedName);
        directoryListings.set(normalizedName, disk);
        const directory = new Set(disk);
        for (const path of content.keys())
          if (path.startsWith(`${normalizedName}${sep2}`)) {
            const remainder = path.slice(normalizedName.length + 1);
            if (remainder.includes(sep2))
              directory.add(remainder.split(sep2)[0]);
          }
        return [...directory].sort();
      }
    };
    const program = ts2.createProgram({
      rootNames: [...content.keys()],
      options: compilerOptions,
      host,
      ...this.program === void 0 ? {} : { oldProgram: this.program }
    });
    const checker = program.getTypeChecker();
    const sourceFor = (source) => content.get(normalized(source.fileName))?.path;
    const symbolId3 = (symbol) => {
      if (symbol === void 0)
        return void 0;
      const actual = (symbol.flags & ts2.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(symbol) : symbol;
      const declaration = actual.declarations?.find((node) => sourceFor(node.getSourceFile()) !== void 0);
      if (declaration === void 0)
        return void 0;
      const source = declaration.getSourceFile(), path = sourceFor(source);
      return hashFramedDomain("projector-code-symbol-v1", {
        projectKey: options.binding.projectKey,
        path,
        start: declaration.getStart(source),
        name: actual.getName()
      });
    };
    const resolutions = [];
    const partitions = [];
    for (const file of files) {
      const partition = (() => {
        const source = program.getSourceFile(resolve4(options.repositoryRoot, file.path));
        if (source === void 0)
          throw new Error(`Compiler omitted source ${file.path}`);
        const provenance = {
          provider,
          version: ts2.version,
          inputHash: codeInputHash(file.content)
        };
        const symbols = [], edges = [];
        let ownerSymbolId;
        const locate = (node) => {
          const start = node.getStart(source), point = source.getLineAndCharacterOfPosition(start);
          return {
            path: file.path,
            start,
            end: node.getEnd(),
            line: point.line + 1,
            column: point.character + 1
          };
        };
        const addEdge = (kind, node, resolved, targetPath, unknown2 = false) => {
          const location2 = locate(node), resolution = resolved === void 0 && targetPath === void 0 ? unknown2 ? "unknown" : "unresolved" : "resolved";
          edges.push({
            id: hashFramedDomain("projector-code-edge-v1", {
              kind,
              location: location2,
              resolved,
              targetPath
            }),
            kind,
            source: location2,
            ...ownerSymbolId === void 0 ? {} : { sourceSymbolId: ownerSymbolId },
            ...resolved === void 0 ? {} : { targetSymbolId: resolved },
            ...targetPath === void 0 ? {} : { targetPath },
            resolution,
            provenance
          });
        };
        const visit = (node) => {
          const previousOwner = ownerSymbolId;
          if (isIndexedDeclaration(node) && "name" in node && node.name && (ts2.isIdentifier(node.name) || ts2.isStringLiteral(node.name) || ts2.isNumericLiteral(node.name))) {
            const name = node.name, symbol = checker.getSymbolAtLocation(name), id = symbolId3(symbol);
            if (id !== void 0 && symbol?.declarations?.includes(node))
              ownerSymbolId = id;
            if (id !== void 0 && symbol?.declarations?.[0] === node) {
              const kind = ts2.SyntaxKind[node.kind] ?? String(node.kind), definition = locate(name), extent = locate(node);
              const body = "body" in node && node.body && typeof node.body === "object" && "getText" in node.body ? node.body : void 0;
              const implementationBody = symbol.declarations?.find((declaration) => sourceFor(declaration.getSourceFile()) !== void 0 && "body" in declaration && declaration.body !== void 0);
              const bodyForHash = body ?? (implementationBody !== void 0 && "body" in implementationBody ? implementationBody.body : void 0);
              const surfaces = (symbol.declarations ?? []).filter((declaration) => sourceFor(declaration.getSourceFile()) !== void 0).map((declaration) => {
                const declarationSource = declaration.getSourceFile();
                const text = declaration.getText(declarationSource);
                const implementation = "body" in declaration && declaration.body !== void 0 ? declaration.body : void 0;
                const surface = implementation === void 0 ? text : text.slice(0, implementation.getStart(declarationSource) - declaration.getStart(declarationSource)) + text.slice(implementation.getEnd() - declaration.getStart(declarationSource));
                return {
                  path: sourceFor(declarationSource),
                  start: declaration.getStart(declarationSource),
                  kind: ts2.SyntaxKind[declaration.kind],
                  surface
                };
              }).sort((a, b) => a.path.localeCompare(b.path) || a.start - b.start);
              const typeSurface = checker.typeToString(
                checker.getTypeAtLocation(name),
                node,
                // Keep recursive inferred types bounded in this display string.
                // Compiler symbols and relationships are collected independently.
                ts2.TypeFormatFlags.None
              );
              const declarationHash = hashFramedDomain("projector-code-declaration-v1", {
                kind,
                surfaces,
                typeSurface
              });
              const bodyText = bodyForHash?.getText() ?? (ts2.isClassDeclaration(node) ? node.members.map((member) => "body" in member && member.body ? member.body.getText(source) : "").join("\n") : void 0);
              symbols.push({
                id,
                name: name.text,
                kind,
                definition,
                extent,
                typeDisplay: typeSurface,
                declarationHash,
                ...bodyText === void 0 ? {} : {
                  bodyHash: hashFramedDomain("projector-code-body-v1", bodyText)
                },
                provenance
              });
            }
          }
          if (ts2.isImportDeclaration(node) && ts2.isStringLiteral(node.moduleSpecifier)) {
            const resolved = ts2.resolveModuleName(node.moduleSpecifier.text, source.fileName, compilerOptions, host).resolvedModule;
            const resolvedSource = resolved === void 0 ? void 0 : program.getSourceFile(resolved.resolvedFileName);
            const target = resolvedSource === void 0 ? void 0 : sourceFor(resolvedSource);
            resolutions.push({
              importer: file.path,
              specifier: node.moduleSpecifier.text,
              ...target === void 0 ? {} : { resolved: target }
            });
            addEdge("import", node.moduleSpecifier, void 0, target);
          }
          if (ts2.isCallExpression(node) || ts2.isNewExpression(node)) {
            const target = checker.getResolvedSignature(node)?.declaration;
            addEdge("call", node.expression, target === void 0 ? void 0 : symbolId3(checker.getSymbolAtLocation(target.name ?? target)));
          }
          if (ts2.isHeritageClause(node))
            for (const type of node.types)
              addEdge(node.token === ts2.SyntaxKind.ImplementsKeyword ? "implementation" : "type", type.expression, symbolId3(checker.getSymbolAtLocation(type.expression)));
          if (ts2.isTypeReferenceNode(node))
            addEdge("type", node.typeName, symbolId3(checker.getSymbolAtLocation(node.typeName)));
          if (ts2.isIdentifier(node) && !(isIndexedDeclaration(node.parent) && "name" in node.parent && node.parent.name === node) && !ts2.isImportSpecifier(node.parent) && !ts2.isExportSpecifier(node.parent)) {
            const symbol = checker.getSymbolAtLocation(node), target = symbolId3(symbol);
            if (target !== void 0)
              addEdge("reference", node, target);
            else if (symbol !== void 0) {
              const actual = (symbol.flags & ts2.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(symbol) : symbol;
              if (actual.declarations?.some((declaration) => sourceFor(declaration.getSourceFile()) === void 0))
                addEdge("reference", node, void 0, void 0, true);
            }
          }
          ts2.forEachChild(node, visit);
          ownerSymbolId = previousOwner;
        };
        visit(source);
        const unknown = edges.some((edge) => edge.resolution !== "resolved") || (parsedConfig?.projectReferences?.length ?? 0) > 0;
        const capabilities = [
          "definition",
          "reference",
          "import",
          "call",
          "type",
          "implementation"
        ].map((kind) => ({
          kind,
          fidelity: "semantic",
          status: unknown ? "partial" : "available"
        }));
        return {
          path: file.path,
          inputHash: codeInputHash(file.content),
          symbols,
          edges,
          coverage: {
            path: file.path,
            status: unknown ? "partial" : "complete",
            ...unknown ? {
              reason: "Some static targets or project references are outside the supplied source closure"
            } : {},
            capabilities
          }
        };
      })();
      if (sink === void 0)
        partitions.push(partition);
      else
        sink.put(partition);
    }
    const indexedSymbols = /* @__PURE__ */ new Set();
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const partition = sink === void 0 ? partitions[index] : sink.get(file.path);
      if (partition === void 0)
        throw new Error(`Missing staged TypeScript partition: ${file.path}`);
      for (const symbol of partition.symbols)
        indexedSymbols.add(symbol.id);
    }
    for (let index = 0; index < files.length; index++) {
      const partition = sink === void 0 ? partitions[index] : sink.get(files[index].path);
      let missingLocalDefinition = false;
      const edges = partition.edges.map((edge) => {
        if (edge.targetSymbolId === void 0 || edge.targetPath !== void 0 || indexedSymbols.has(edge.targetSymbolId))
          return edge;
        missingLocalDefinition = true;
        const { targetSymbolId: _targetSymbolId, ...withoutTarget } = edge;
        return {
          ...withoutTarget,
          id: hashFramedDomain("projector-code-edge-v1", {
            kind: edge.kind,
            location: edge.source,
            resolved: void 0,
            targetPath: void 0
          }),
          resolution: "unknown"
        };
      });
      if (!missingLocalDefinition)
        continue;
      const reason = "Some local semantic targets have no indexed definition";
      const revised = {
        ...partition,
        edges,
        coverage: {
          ...partition.coverage,
          status: "partial",
          reason: partition.coverage.reason ? `${partition.coverage.reason}; ${reason}` : reason,
          capabilities: partition.coverage.capabilities.map((capability) => ({
            ...capability,
            status: "partial"
          }))
        }
      };
      if (sink === void 0)
        partitions[index] = revised;
      else
        sink.replace(revised);
    }
    const resolutionFingerprint = hashFramedDomain("projector-ts-resolution-v1", {
      resolutions: resolutions.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      externalReads: [...externalReads].sort((a, b) => a[0].localeCompare(b[0]))
    });
    const bindingPath = (path) => relative2(options.repositoryRoot, path).replaceAll("\\", "/") || ".";
    const binding = {
      ...options.binding,
      status: sourceBytesMatch ? "verified" : "unbound",
      sourceInputs: files.map(({ path, content: content2 }) => ({
        path,
        contentHash: codeInputHash(content2)
      })),
      configInputs: [...configReads].map(([path, contentHash]) => ({
        path: bindingPath(path),
        contentHash
      })).sort((a, b) => a.path.localeCompare(b.path)),
      resolutionInputs: [...externalReads].map(([path, contentHash]) => ({
        path: bindingPath(path),
        contentHash
      })).sort((a, b) => a.path.localeCompare(b.path)),
      resolutionProbes: [...externalProbes].map(([path, exists]) => ({ path: bindingPath(path), exists })).sort((a, b) => a.path.localeCompare(b.path)),
      directoryProbes: [...directoryProbes].map(([path, exists]) => ({ path: bindingPath(path), exists })).sort((a, b) => a.path.localeCompare(b.path)),
      directoryListings: [...directoryListings].map(([path, directories]) => ({
        path: bindingPath(path),
        directories
      })).sort((a, b) => a.path.localeCompare(b.path))
    };
    assertProofBudget(binding);
    const snapshot = {
      schemaVersion: "projector.code-intelligence/v1",
      provider,
      providerVersion: ts2.version,
      inputFingerprint,
      configFingerprint,
      resolutionFingerprint,
      binding,
      partitions
    };
    this.program = program;
    this.fingerprint = cacheKey;
    if (sink === void 0)
      this.snapshot = snapshot;
    else
      delete this.snapshot;
    return snapshot;
  }
};

// node_modules/@projector/analyzers/dist/code-intelligence/tree-sitter-provider.js
import { Parser, Language } from "web-tree-sitter";
import { getWasmPath } from "tree-sitter-wasm";
var languageByExtension = {
  py: "python",
  go: "go",
  rs: "rust",
  java: "java",
  cs: "c_sharp",
  c: "c",
  h: "c",
  cc: "cpp",
  cpp: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  scala: "scala",
  sc: "scala",
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "tsx"
};
var supportedTreeSitterLanguages = [...new Set(Object.values(languageByExtension))].sort();
var declarationKinds = /* @__PURE__ */ new Set([
  "function_definition",
  "function_declaration",
  "function_item",
  "method_definition",
  "method_declaration",
  "class_definition",
  "class_declaration",
  "class_specifier",
  "struct_item",
  "struct_specifier",
  "interface_declaration",
  "trait_item",
  "type_declaration",
  "object_definition",
  "object_declaration",
  "enum_declaration",
  "enum_item"
]);
var provider2 = "projector.tree-sitter-syntax";
var TreeSitterCodeProvider = class _TreeSitterCodeProvider {
  static initialization;
  grammars = /* @__PURE__ */ new Map();
  parsers = /* @__PURE__ */ new Map();
  async update(inputs, options, emitPartition) {
    _TreeSitterCodeProvider.initialization ??= Parser.init();
    await _TreeSitterCodeProvider.initialization;
    const files = [...inputs].filter((file) => languageByExtension[file.path.split(".").at(-1)?.toLowerCase() ?? ""] !== void 0).sort((a, b) => a.path.localeCompare(b.path));
    const seen = /* @__PURE__ */ new Set();
    const partitions = [];
    for (const file of files) {
      if (!file.path || file.path.startsWith("/") || file.path.includes("\\") || file.path.split("/").includes("..") || seen.has(file.path))
        throw new Error(`Invalid or duplicate syntax source path: ${file.path}`);
      seen.add(file.path);
      const languageId = languageByExtension[file.path.split(".").at(-1).toLowerCase()];
      let grammar = this.grammars.get(languageId);
      if (grammar === void 0) {
        grammar = await Language.load(getWasmPath(languageId));
        this.grammars.set(languageId, grammar);
      }
      let parser = this.parsers.get(languageId);
      if (parser === void 0) {
        parser = new Parser();
        parser.setLanguage(grammar);
        this.parsers.set(languageId, parser);
      }
      const tree = parser.parse(file.content);
      if (tree === null)
        throw new Error(`Tree-sitter parser did not return a tree for ${file.path}`);
      const provenance = {
        provider: provider2,
        version: "web-tree-sitter/0.27.0",
        inputHash: codeInputHash(file.content),
        artifact: `tree-sitter-wasm/2.0.2:${languageId}`
      };
      const location2 = (node) => ({
        path: file.path,
        start: node.startIndex,
        end: node.endIndex,
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1
      });
      const symbols = [];
      const walk = (node) => {
        if (declarationKinds.has(node.type)) {
          const name = node.childForFieldName("name") ?? node.childForFieldName("declarator");
          if (name !== null && name.text.length > 0) {
            const id = hashFramedDomain("projector-syntax-symbol-v1", {
              projectKey: options.binding.projectKey,
              path: file.path,
              start: name.startIndex,
              kind: node.type
            });
            symbols.push({
              id,
              name: name.text,
              kind: node.type,
              definition: location2(name),
              extent: location2(node),
              declarationHash: hashFramedDomain("projector-syntax-declaration-v1", node.text),
              provenance
            });
          }
        }
        for (const child of node.namedChildren)
          walk(child);
      };
      walk(tree.rootNode);
      const capabilities = [
        "definition",
        "reference",
        "import",
        "call",
        "type",
        "implementation"
      ].map((kind) => ({
        kind,
        fidelity: "syntax",
        status: kind === "definition" ? "partial" : "unavailable",
        reason: kind === "definition" ? "Syntax declarations have no resolved identity" : "Syntax fallback does not resolve cross-file targets"
      }));
      const partition = {
        path: file.path,
        inputHash: codeInputHash(file.content),
        symbols,
        edges: [],
        coverage: {
          path: file.path,
          status: "partial",
          reason: tree.rootNode.hasError ? "Syntax tree contains parse errors; resolved relations unavailable" : "Syntax fallback cannot resolve relations",
          capabilities
        }
      };
      if (emitPartition === void 0)
        partitions.push(partition);
      else
        emitPartition(partition);
      tree.delete();
    }
    const binding = {
      ...options.binding,
      status: options.binding.status ?? "unbound",
      sourceInputs: files.map(({ path, content }) => ({
        path,
        contentHash: codeInputHash(content)
      })),
      configInputs: [],
      resolutionInputs: []
    };
    return {
      schemaVersion: "projector.code-intelligence/v1",
      provider: provider2,
      providerVersion: "0.27.0",
      inputFingerprint: hashFramedDomain("projector-syntax-input-v1", binding.sourceInputs),
      configFingerprint: hashFramedDomain("projector-syntax-grammars-v1", files.map((file) => languageByExtension[file.path.split(".").at(-1).toLowerCase()])),
      resolutionFingerprint: hashFramedDomain("projector-syntax-resolution-v1", []),
      binding,
      partitions
    };
  }
  close() {
    for (const parser of this.parsers.values())
      parser.delete();
    this.parsers.clear();
    this.grammars.clear();
  }
};

// node_modules/@projector/analyzers/dist/code-intelligence/scip-import.js
import { fromBinary } from "@bufbuild/protobuf";
import { createHash as createHash4 } from "node:crypto";
import { DocumentSchema, MetadataSchema, PositionEncoding, SymbolInformation_Kind, SymbolRole } from "@scip-code/scip";

// node_modules/@projector/analyzers/dist/code-intelligence/protobuf-framing.js
async function* chunks(source) {
  if (source instanceof Uint8Array) {
    for (let offset = 0; offset < source.length; offset += 1024 * 1024)
      yield source.subarray(offset, offset + 1024 * 1024);
  } else
    for await (const chunk of source)
      for (let offset = 0; offset < chunk.length; offset += 1024 * 1024)
        yield chunk.subarray(offset, offset + 1024 * 1024);
}
async function* boundedProtobufFrames(source, digest, maxArtifact, maxFrame) {
  if (maxArtifact !== Infinity && (!Number.isSafeInteger(maxArtifact) || maxArtifact < 1))
    throw new RangeError("maxArtifactBytes must be a positive safe integer");
  if (maxFrame !== Infinity && (!Number.isSafeInteger(maxFrame) || maxFrame < 1))
    throw new RangeError("maxFrameBytes must be a positive safe integer");
  const iterator = chunks(source)[Symbol.asyncIterator]();
  let buffer = Buffer.alloc(0), total = 0;
  const ensure = async (size) => {
    while (buffer.length < size) {
      const next = await iterator.next();
      if (next.done)
        return false;
      total += next.value.byteLength;
      if (total > maxArtifact)
        throw new Error(`Protobuf artifact exceeds maxArtifactBytes (${maxArtifact}); increase the declared derived observation budget to retry`);
      digest.update(next.value);
      buffer = Buffer.concat([buffer, next.value]);
    }
    return true;
  };
  const take = async (size) => {
    if (!await ensure(size))
      throw new Error("Truncated protobuf field");
    const bytes = buffer.subarray(0, size);
    buffer = buffer.subarray(size);
    return bytes;
  };
  const readVarint = async () => {
    let value = 0, shift = 0;
    while (shift <= 49) {
      const byte = (await take(1))[0];
      value += (byte & 127) * 2 ** shift;
      if ((byte & 128) === 0 && Number.isSafeInteger(value))
        return value;
      shift += 7;
    }
    throw new Error("Invalid protobuf varint");
  };
  while (await ensure(1)) {
    const tag = await readVarint(), field = Math.floor(tag / 8), wire = tag % 8;
    if (field < 1)
      throw new Error("Invalid protobuf field number");
    if (wire === 2) {
      const size = await readVarint();
      if (size > maxFrame)
        throw new Error(`Protobuf frame exceeds maxFrameBytes (${maxFrame}); increase the declared frame budget to retry`);
      yield { field, value: await take(size) };
    } else if (wire === 0)
      await readVarint();
    else if (wire === 1 || wire === 5)
      await take(wire === 1 ? 8 : 4);
    else
      throw new Error(`Unsupported protobuf wire type ${wire}`);
  }
}

// node_modules/@projector/analyzers/dist/code-intelligence/scip-import.js
var provider3 = "projector.scip";
function range(occurrence, enclosing = false) {
  const typed = enclosing ? occurrence.typedEnclosingRange : occurrence.typedRange;
  if (typed.case === "singleLineRange" || typed.case === "singleLineEnclosingRange")
    return [
      typed.value.line,
      typed.value.startCharacter,
      typed.value.line,
      typed.value.endCharacter
    ];
  if (typed.case === "multiLineRange" || typed.case === "multiLineEnclosingRange")
    return [
      typed.value.startLine,
      typed.value.startCharacter,
      typed.value.endLine,
      typed.value.endCharacter
    ];
  const old = enclosing ? occurrence.enclosingRange : occurrence.range;
  if (old.length === 3)
    return [old[0], old[1], old[0], old[2]];
  if (old.length === 4)
    return [old[0], old[1], old[2], old[3]];
  return void 0;
}
function sourceLocation2(path, content, encoding, sourceRange) {
  if (encoding === PositionEncoding.UnspecifiedPositionEncoding)
    return void 0;
  const [startLine, startColumn, endLine, endColumn] = sourceRange;
  const lines = content.split("\n");
  const locate = (line, column) => {
    if (line < 0 || line >= lines.length || column < 0)
      return void 0;
    const prefix = lines.slice(0, line).reduce((size, value) => size + value.length + 1, 0), text = lines[line];
    if (encoding === PositionEncoding.UTF16CodeUnitOffsetFromLineStart)
      return column <= text.length ? prefix + column : void 0;
    let units = 0, index = 0;
    for (const character of text) {
      if (units === column)
        return prefix + index;
      units += encoding === PositionEncoding.UTF8CodeUnitOffsetFromLineStart ? Buffer.byteLength(character) : 1;
      index += character.length;
    }
    return units === column ? prefix + index : void 0;
  };
  const start = locate(startLine, startColumn), end = locate(endLine, endColumn);
  if (start === void 0 || end === void 0 || end < start)
    return void 0;
  return { path, start, end, line: startLine + 1, column: startColumn + 1 };
}
function symbolId(symbol, path) {
  return hashFramedDomain("projector-scip-symbol-v1", {
    symbol,
    ...symbol.startsWith("local ") ? { path } : {}
  });
}
async function importScip(source, options) {
  const artifactDigest = createHash4("sha256");
  const inputs = new Map(options.inputs.map((input) => [input.path, input]));
  const partitions = [];
  let metadataSeen = false, toolVersion = "unknown";
  let allVerified = true;
  const documentPaths = /* @__PURE__ */ new Set();
  for await (const frame2 of boundedProtobufFrames(source, artifactDigest, observationLimitValue(options.maxArtifactBytes ?? DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes), observationLimitValue(options.maxFrameBytes ?? options.maxArtifactBytes ?? DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes))) {
    if (frame2.field === 1) {
      if (metadataSeen || documentPaths.size > 0)
        throw new Error("SCIP metadata must occur exactly once before documents");
      metadataSeen = true;
      const metadata = fromBinary(MetadataSchema, frame2.value);
      toolVersion = `${metadata.toolInfo?.name ?? "unknown"}/${metadata.toolInfo?.version ?? "unknown"}`;
      continue;
    }
    if (frame2.field !== 2)
      continue;
    if (!metadataSeen)
      throw new Error("SCIP document appeared before metadata");
    const document = fromBinary(DocumentSchema, frame2.value), path = document.relativePath.replaceAll("\\", "/");
    if (!path || path.startsWith("/") || /^[A-Za-z]:/u.test(path) || path.includes("\0") || path.split("/").some((part) => part === ".." || part === "." || part === "") || documentPaths.has(path))
      throw new Error(`Unsafe or duplicate SCIP document path: ${path}`);
    documentPaths.add(path);
    const input = inputs.get(path), content = input?.content ?? document.text, hasContent = input !== void 0 || document.text !== "";
    if (input !== void 0 && document.text !== "" && document.text !== input.content)
      throw new Error(`SCIP embedded source differs from observed input: ${path}`);
    const sourceHash = hasContent ? codeInputHash(content) : "missing-source";
    const provenance = {
      provider: provider3,
      version: toolVersion,
      inputHash: sourceHash,
      artifact: options.artifact
    };
    const symbols = [], edges = [];
    let invalidRanges = 0;
    const infos = new Map(document.symbols.map((info) => [info.symbol, info]));
    if (hasContent)
      for (const occurrence of document.occurrences) {
        const sourceRange = range(occurrence), location2 = sourceRange === void 0 ? void 0 : sourceLocation2(path, content, document.positionEncoding, sourceRange);
        if (location2 === void 0) {
          invalidRanges++;
          continue;
        }
        const enclosingRange = range(occurrence, true), extent = enclosingRange === void 0 ? location2 : sourceLocation2(path, content, document.positionEncoding, enclosingRange) ?? location2;
        if (!occurrence.symbol)
          continue;
        const targetSymbolId = symbolId(occurrence.symbol, path);
        const definition = (occurrence.symbolRoles & SymbolRole.Definition) !== 0;
        if (definition) {
          const info = infos.get(occurrence.symbol);
          symbols.push({
            id: targetSymbolId,
            name: info?.displayName || occurrence.symbol,
            kind: info === void 0 ? "symbol" : SymbolInformation_Kind[info.kind] ?? "symbol",
            definition: location2,
            extent,
            ...info?.signatureDocumentation?.text ? { typeDisplay: info.signatureDocumentation.text } : {},
            declarationHash: hashFramedDomain("projector-scip-declaration-v1", {
              symbol: occurrence.symbol,
              signature: info?.signatureDocumentation?.text ?? "",
              text: content.slice(extent.start, extent.end)
            }),
            provenance
          });
          for (const relationship of info?.relationships ?? []) {
            const kind = relationship.isImplementation ? "implementation" : relationship.isTypeDefinition ? "type" : relationship.isReference ? "reference" : void 0;
            if (kind !== void 0)
              edges.push({
                id: hashFramedDomain("projector-scip-edge-v1", {
                  kind,
                  path,
                  at: location2.start,
                  target: relationship.symbol
                }),
                kind,
                source: location2,
                sourceSymbolId: targetSymbolId,
                targetSymbolId: symbolId(relationship.symbol, path),
                resolution: "resolved",
                provenance
              });
          }
        } else {
          const kind = (occurrence.symbolRoles & SymbolRole.Import) !== 0 ? "import" : "reference";
          edges.push({
            id: hashFramedDomain("projector-scip-edge-v1", {
              kind,
              path,
              at: location2.start,
              target: occurrence.symbol
            }),
            kind,
            source: location2,
            targetSymbolId,
            resolution: "resolved",
            provenance
          });
        }
      }
    const available = hasContent && invalidRanges === 0;
    const capabilities = [
      "definition",
      "reference",
      "import",
      "call",
      "type",
      "implementation"
    ].map((kind) => ({
      kind,
      fidelity: "index",
      status: kind === "call" ? "unavailable" : !hasContent ? "unavailable" : invalidRanges > 0 ? "partial" : "available",
      ...kind === "call" ? {
        reason: "SCIP occurrences and relationships do not prove runtime calls"
      } : {}
    }));
    const partition = {
      path,
      inputHash: sourceHash,
      symbols,
      edges,
      coverage: {
        path,
        status: available ? "complete" : hasContent ? "partial" : "unavailable",
        ...available ? {} : {
          reason: hasContent ? "Some SCIP positions cannot be mapped to source" : "Source bytes unavailable for SCIP positions"
        },
        capabilities
      }
    };
    allVerified &&= input !== void 0 && options.sourceHashes?.[path] === sourceHash && sourceHash !== "missing-source";
    if (options.emitPartition === void 0)
      partitions.push(partition);
    else
      options.emitPartition(partition);
  }
  if (!metadataSeen)
    throw new Error("SCIP metadata missing");
  const artifactHash = `sha256:${artifactDigest.digest("hex")}`;
  const sourceInputs = [...inputs.values()].map((input) => ({
    path: input.path,
    contentHash: codeInputHash(input.content)
  })).sort((a, b) => a.path.localeCompare(b.path));
  const verified = documentPaths.size > 0 && options.sourceHashes !== void 0 && allVerified;
  const binding = {
    ...options.binding,
    status: verified ? "verified" : "unbound",
    sourceInputs,
    configInputs: [],
    resolutionInputs: []
  };
  return {
    schemaVersion: "projector.code-intelligence/v1",
    provider: provider3,
    providerVersion: toolVersion,
    inputFingerprint: hashFramedDomain("projector-scip-input-v1", {
      artifactHash,
      sourceInputs
    }),
    configFingerprint: hashFramedDomain("projector-scip-tool-v1", toolVersion),
    resolutionFingerprint: options.emitPartition === void 0 ? hashFramedDomain("projector-scip-relations-v1", partitions.map((partition) => partition.edges.map((edge) => edge.id))) : hashFramedCanonicalJsonChunks("projector-scip-relations-v1", function* () {
      yield "[";
      let first = true;
      for (const path of documentPaths) {
        if (!first)
          yield ",";
        first = false;
        const partition = options.getPartition?.(path);
        if (partition === void 0)
          throw new Error(`Staged SCIP document missing: ${path}`);
        yield JSON.stringify(partition.edges.map((edge) => edge.id));
      }
      yield "]";
    }),
    binding,
    partitions
  };
}

// node_modules/@projector/analyzers/dist/code-intelligence/semanticdb-import.js
import { createHash as createHash5 } from "node:crypto";

// node_modules/@projector/analyzers/dist/code-intelligence/semanticdb/generated/semanticdb.js
import $protobuf from "protobufjs/minimal.js";
var $Reader = $protobuf.Reader;
var $Writer = $protobuf.Writer;
var $util = $protobuf.util;
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});
var scala = $root.scala = (() => {
  const scala2 = {};
  scala2.meta = (function() {
    const meta = {};
    meta.internal = (function() {
      const internal = {};
      internal.semanticdb = (function() {
        const semanticdb = {};
        semanticdb.Schema = (function() {
          const valuesById = {}, values = Object.create(valuesById);
          values[valuesById[0] = "LEGACY"] = 0;
          values[valuesById[3] = "SEMANTICDB3"] = 3;
          values[valuesById[4] = "SEMANTICDB4"] = 4;
          return values;
        })();
        semanticdb.TextDocuments = (function() {
          function TextDocuments(properties) {
            this.documents = [];
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          TextDocuments.prototype.documents = $util.emptyArray;
          TextDocuments.create = function create(properties) {
            return new TextDocuments(properties);
          };
          TextDocuments.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.documents != null && message.documents.length)
              for (let i = 0; i < message.documents.length; ++i)
                $root.scala.meta.internal.semanticdb.TextDocument.encode(message.documents[i], writer.uint32(
                  /* id 1, wireType 2 =*/
                  10
                ).fork()).ldelim();
            return writer;
          };
          TextDocuments.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          TextDocuments.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.TextDocuments();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  if (!(message.documents && message.documents.length))
                    message.documents = [];
                  message.documents.push($root.scala.meta.internal.semanticdb.TextDocument.decode(reader, reader.uint32()));
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          TextDocuments.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          TextDocuments.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.documents != null && message.hasOwnProperty("documents")) {
              if (!Array.isArray(message.documents))
                return "documents: array expected";
              for (let i = 0; i < message.documents.length; ++i) {
                let error = $root.scala.meta.internal.semanticdb.TextDocument.verify(message.documents[i]);
                if (error)
                  return "documents." + error;
              }
            }
            return null;
          };
          TextDocuments.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.TextDocuments)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.TextDocuments();
            if (object.documents) {
              if (!Array.isArray(object.documents))
                throw TypeError(".scala.meta.internal.semanticdb.TextDocuments.documents: array expected");
              message.documents = [];
              for (let i = 0; i < object.documents.length; ++i) {
                if (typeof object.documents[i] !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.TextDocuments.documents: object expected");
                message.documents[i] = $root.scala.meta.internal.semanticdb.TextDocument.fromObject(object.documents[i]);
              }
            }
            return message;
          };
          TextDocuments.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.arrays || options.defaults)
              object.documents = [];
            if (message.documents && message.documents.length) {
              object.documents = [];
              for (let j = 0; j < message.documents.length; ++j)
                object.documents[j] = $root.scala.meta.internal.semanticdb.TextDocument.toObject(message.documents[j], options);
            }
            return object;
          };
          TextDocuments.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          TextDocuments.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.TextDocuments";
          };
          return TextDocuments;
        })();
        semanticdb.TextDocument = (function() {
          function TextDocument(properties) {
            this.symbols = [];
            this.occurrences = [];
            this.diagnostics = [];
            this.synthetics = [];
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          TextDocument.prototype.schema = 0;
          TextDocument.prototype.uri = "";
          TextDocument.prototype.text = "";
          TextDocument.prototype.md5 = "";
          TextDocument.prototype.language = 0;
          TextDocument.prototype.symbols = $util.emptyArray;
          TextDocument.prototype.occurrences = $util.emptyArray;
          TextDocument.prototype.diagnostics = $util.emptyArray;
          TextDocument.prototype.synthetics = $util.emptyArray;
          TextDocument.prototype.buildTarget = "";
          TextDocument.create = function create(properties) {
            return new TextDocument(properties);
          };
          TextDocument.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.schema != null && Object.hasOwnProperty.call(message, "schema"))
              writer.uint32(
                /* id 1, wireType 0 =*/
                8
              ).int32(message.schema);
            if (message.uri != null && Object.hasOwnProperty.call(message, "uri"))
              writer.uint32(
                /* id 2, wireType 2 =*/
                18
              ).string(message.uri);
            if (message.text != null && Object.hasOwnProperty.call(message, "text"))
              writer.uint32(
                /* id 3, wireType 2 =*/
                26
              ).string(message.text);
            if (message.symbols != null && message.symbols.length)
              for (let i = 0; i < message.symbols.length; ++i)
                $root.scala.meta.internal.semanticdb.SymbolInformation.encode(message.symbols[i], writer.uint32(
                  /* id 5, wireType 2 =*/
                  42
                ).fork()).ldelim();
            if (message.occurrences != null && message.occurrences.length)
              for (let i = 0; i < message.occurrences.length; ++i)
                $root.scala.meta.internal.semanticdb.SymbolOccurrence.encode(message.occurrences[i], writer.uint32(
                  /* id 6, wireType 2 =*/
                  50
                ).fork()).ldelim();
            if (message.diagnostics != null && message.diagnostics.length)
              for (let i = 0; i < message.diagnostics.length; ++i)
                $root.scala.meta.internal.semanticdb.Diagnostic.encode(message.diagnostics[i], writer.uint32(
                  /* id 7, wireType 2 =*/
                  58
                ).fork()).ldelim();
            if (message.language != null && Object.hasOwnProperty.call(message, "language"))
              writer.uint32(
                /* id 10, wireType 0 =*/
                80
              ).int32(message.language);
            if (message.md5 != null && Object.hasOwnProperty.call(message, "md5"))
              writer.uint32(
                /* id 11, wireType 2 =*/
                90
              ).string(message.md5);
            if (message.synthetics != null && message.synthetics.length)
              for (let i = 0; i < message.synthetics.length; ++i)
                $root.scala.meta.internal.semanticdb.Synthetic.encode(message.synthetics[i], writer.uint32(
                  /* id 12, wireType 2 =*/
                  98
                ).fork()).ldelim();
            if (message.buildTarget != null && Object.hasOwnProperty.call(message, "buildTarget"))
              writer.uint32(
                /* id 13, wireType 2 =*/
                106
              ).string(message.buildTarget);
            return writer;
          };
          TextDocument.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          TextDocument.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.TextDocument();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.schema = reader.int32();
                  break;
                }
                case 2: {
                  message.uri = reader.string();
                  break;
                }
                case 3: {
                  message.text = reader.string();
                  break;
                }
                case 11: {
                  message.md5 = reader.string();
                  break;
                }
                case 10: {
                  message.language = reader.int32();
                  break;
                }
                case 5: {
                  if (!(message.symbols && message.symbols.length))
                    message.symbols = [];
                  message.symbols.push($root.scala.meta.internal.semanticdb.SymbolInformation.decode(reader, reader.uint32()));
                  break;
                }
                case 6: {
                  if (!(message.occurrences && message.occurrences.length))
                    message.occurrences = [];
                  message.occurrences.push($root.scala.meta.internal.semanticdb.SymbolOccurrence.decode(reader, reader.uint32()));
                  break;
                }
                case 7: {
                  if (!(message.diagnostics && message.diagnostics.length))
                    message.diagnostics = [];
                  message.diagnostics.push($root.scala.meta.internal.semanticdb.Diagnostic.decode(reader, reader.uint32()));
                  break;
                }
                case 12: {
                  if (!(message.synthetics && message.synthetics.length))
                    message.synthetics = [];
                  message.synthetics.push($root.scala.meta.internal.semanticdb.Synthetic.decode(reader, reader.uint32()));
                  break;
                }
                case 13: {
                  message.buildTarget = reader.string();
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          TextDocument.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          TextDocument.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.schema != null && message.hasOwnProperty("schema"))
              switch (message.schema) {
                default:
                  return "schema: enum value expected";
                case 0:
                case 3:
                case 4:
                  break;
              }
            if (message.uri != null && message.hasOwnProperty("uri")) {
              if (!$util.isString(message.uri))
                return "uri: string expected";
            }
            if (message.text != null && message.hasOwnProperty("text")) {
              if (!$util.isString(message.text))
                return "text: string expected";
            }
            if (message.md5 != null && message.hasOwnProperty("md5")) {
              if (!$util.isString(message.md5))
                return "md5: string expected";
            }
            if (message.language != null && message.hasOwnProperty("language"))
              switch (message.language) {
                default:
                  return "language: enum value expected";
                case 0:
                case 1:
                case 2:
                case 3:
                  break;
              }
            if (message.symbols != null && message.hasOwnProperty("symbols")) {
              if (!Array.isArray(message.symbols))
                return "symbols: array expected";
              for (let i = 0; i < message.symbols.length; ++i) {
                let error = $root.scala.meta.internal.semanticdb.SymbolInformation.verify(message.symbols[i]);
                if (error)
                  return "symbols." + error;
              }
            }
            if (message.occurrences != null && message.hasOwnProperty("occurrences")) {
              if (!Array.isArray(message.occurrences))
                return "occurrences: array expected";
              for (let i = 0; i < message.occurrences.length; ++i) {
                let error = $root.scala.meta.internal.semanticdb.SymbolOccurrence.verify(message.occurrences[i]);
                if (error)
                  return "occurrences." + error;
              }
            }
            if (message.diagnostics != null && message.hasOwnProperty("diagnostics")) {
              if (!Array.isArray(message.diagnostics))
                return "diagnostics: array expected";
              for (let i = 0; i < message.diagnostics.length; ++i) {
                let error = $root.scala.meta.internal.semanticdb.Diagnostic.verify(message.diagnostics[i]);
                if (error)
                  return "diagnostics." + error;
              }
            }
            if (message.synthetics != null && message.hasOwnProperty("synthetics")) {
              if (!Array.isArray(message.synthetics))
                return "synthetics: array expected";
              for (let i = 0; i < message.synthetics.length; ++i) {
                let error = $root.scala.meta.internal.semanticdb.Synthetic.verify(message.synthetics[i]);
                if (error)
                  return "synthetics." + error;
              }
            }
            if (message.buildTarget != null && message.hasOwnProperty("buildTarget")) {
              if (!$util.isString(message.buildTarget))
                return "buildTarget: string expected";
            }
            return null;
          };
          TextDocument.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.TextDocument)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.TextDocument();
            switch (object.schema) {
              default:
                if (typeof object.schema === "number") {
                  message.schema = object.schema;
                  break;
                }
                break;
              case "LEGACY":
              case 0:
                message.schema = 0;
                break;
              case "SEMANTICDB3":
              case 3:
                message.schema = 3;
                break;
              case "SEMANTICDB4":
              case 4:
                message.schema = 4;
                break;
            }
            if (object.uri != null)
              message.uri = String(object.uri);
            if (object.text != null)
              message.text = String(object.text);
            if (object.md5 != null)
              message.md5 = String(object.md5);
            switch (object.language) {
              default:
                if (typeof object.language === "number") {
                  message.language = object.language;
                  break;
                }
                break;
              case "UNKNOWN_LANGUAGE":
              case 0:
                message.language = 0;
                break;
              case "SCALA":
              case 1:
                message.language = 1;
                break;
              case "JAVA":
              case 2:
                message.language = 2;
                break;
              case "PROTOBUF":
              case 3:
                message.language = 3;
                break;
            }
            if (object.symbols) {
              if (!Array.isArray(object.symbols))
                throw TypeError(".scala.meta.internal.semanticdb.TextDocument.symbols: array expected");
              message.symbols = [];
              for (let i = 0; i < object.symbols.length; ++i) {
                if (typeof object.symbols[i] !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.TextDocument.symbols: object expected");
                message.symbols[i] = $root.scala.meta.internal.semanticdb.SymbolInformation.fromObject(object.symbols[i]);
              }
            }
            if (object.occurrences) {
              if (!Array.isArray(object.occurrences))
                throw TypeError(".scala.meta.internal.semanticdb.TextDocument.occurrences: array expected");
              message.occurrences = [];
              for (let i = 0; i < object.occurrences.length; ++i) {
                if (typeof object.occurrences[i] !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.TextDocument.occurrences: object expected");
                message.occurrences[i] = $root.scala.meta.internal.semanticdb.SymbolOccurrence.fromObject(object.occurrences[i]);
              }
            }
            if (object.diagnostics) {
              if (!Array.isArray(object.diagnostics))
                throw TypeError(".scala.meta.internal.semanticdb.TextDocument.diagnostics: array expected");
              message.diagnostics = [];
              for (let i = 0; i < object.diagnostics.length; ++i) {
                if (typeof object.diagnostics[i] !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.TextDocument.diagnostics: object expected");
                message.diagnostics[i] = $root.scala.meta.internal.semanticdb.Diagnostic.fromObject(object.diagnostics[i]);
              }
            }
            if (object.synthetics) {
              if (!Array.isArray(object.synthetics))
                throw TypeError(".scala.meta.internal.semanticdb.TextDocument.synthetics: array expected");
              message.synthetics = [];
              for (let i = 0; i < object.synthetics.length; ++i) {
                if (typeof object.synthetics[i] !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.TextDocument.synthetics: object expected");
                message.synthetics[i] = $root.scala.meta.internal.semanticdb.Synthetic.fromObject(object.synthetics[i]);
              }
            }
            if (object.buildTarget != null)
              message.buildTarget = String(object.buildTarget);
            return message;
          };
          TextDocument.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.arrays || options.defaults) {
              object.symbols = [];
              object.occurrences = [];
              object.diagnostics = [];
              object.synthetics = [];
            }
            if (options.defaults) {
              object.schema = options.enums === String ? "LEGACY" : 0;
              object.uri = "";
              object.text = "";
              object.language = options.enums === String ? "UNKNOWN_LANGUAGE" : 0;
              object.md5 = "";
              object.buildTarget = "";
            }
            if (message.schema != null && message.hasOwnProperty("schema"))
              object.schema = options.enums === String ? $root.scala.meta.internal.semanticdb.Schema[message.schema] === void 0 ? message.schema : $root.scala.meta.internal.semanticdb.Schema[message.schema] : message.schema;
            if (message.uri != null && message.hasOwnProperty("uri"))
              object.uri = message.uri;
            if (message.text != null && message.hasOwnProperty("text"))
              object.text = message.text;
            if (message.symbols && message.symbols.length) {
              object.symbols = [];
              for (let j = 0; j < message.symbols.length; ++j)
                object.symbols[j] = $root.scala.meta.internal.semanticdb.SymbolInformation.toObject(message.symbols[j], options);
            }
            if (message.occurrences && message.occurrences.length) {
              object.occurrences = [];
              for (let j = 0; j < message.occurrences.length; ++j)
                object.occurrences[j] = $root.scala.meta.internal.semanticdb.SymbolOccurrence.toObject(message.occurrences[j], options);
            }
            if (message.diagnostics && message.diagnostics.length) {
              object.diagnostics = [];
              for (let j = 0; j < message.diagnostics.length; ++j)
                object.diagnostics[j] = $root.scala.meta.internal.semanticdb.Diagnostic.toObject(message.diagnostics[j], options);
            }
            if (message.language != null && message.hasOwnProperty("language"))
              object.language = options.enums === String ? $root.scala.meta.internal.semanticdb.Language[message.language] === void 0 ? message.language : $root.scala.meta.internal.semanticdb.Language[message.language] : message.language;
            if (message.md5 != null && message.hasOwnProperty("md5"))
              object.md5 = message.md5;
            if (message.synthetics && message.synthetics.length) {
              object.synthetics = [];
              for (let j = 0; j < message.synthetics.length; ++j)
                object.synthetics[j] = $root.scala.meta.internal.semanticdb.Synthetic.toObject(message.synthetics[j], options);
            }
            if (message.buildTarget != null && message.hasOwnProperty("buildTarget"))
              object.buildTarget = message.buildTarget;
            return object;
          };
          TextDocument.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          TextDocument.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.TextDocument";
          };
          return TextDocument;
        })();
        semanticdb.Language = (function() {
          const valuesById = {}, values = Object.create(valuesById);
          values[valuesById[0] = "UNKNOWN_LANGUAGE"] = 0;
          values[valuesById[1] = "SCALA"] = 1;
          values[valuesById[2] = "JAVA"] = 2;
          values[valuesById[3] = "PROTOBUF"] = 3;
          return values;
        })();
        semanticdb.Range = (function() {
          function Range(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          Range.prototype.startLine = 0;
          Range.prototype.startCharacter = 0;
          Range.prototype.endLine = 0;
          Range.prototype.endCharacter = 0;
          Range.create = function create(properties) {
            return new Range(properties);
          };
          Range.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.startLine != null && Object.hasOwnProperty.call(message, "startLine"))
              writer.uint32(
                /* id 1, wireType 0 =*/
                8
              ).int32(message.startLine);
            if (message.startCharacter != null && Object.hasOwnProperty.call(message, "startCharacter"))
              writer.uint32(
                /* id 2, wireType 0 =*/
                16
              ).int32(message.startCharacter);
            if (message.endLine != null && Object.hasOwnProperty.call(message, "endLine"))
              writer.uint32(
                /* id 3, wireType 0 =*/
                24
              ).int32(message.endLine);
            if (message.endCharacter != null && Object.hasOwnProperty.call(message, "endCharacter"))
              writer.uint32(
                /* id 4, wireType 0 =*/
                32
              ).int32(message.endCharacter);
            return writer;
          };
          Range.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          Range.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Range();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.startLine = reader.int32();
                  break;
                }
                case 2: {
                  message.startCharacter = reader.int32();
                  break;
                }
                case 3: {
                  message.endLine = reader.int32();
                  break;
                }
                case 4: {
                  message.endCharacter = reader.int32();
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          Range.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          Range.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.startLine != null && message.hasOwnProperty("startLine")) {
              if (!$util.isInteger(message.startLine))
                return "startLine: integer expected";
            }
            if (message.startCharacter != null && message.hasOwnProperty("startCharacter")) {
              if (!$util.isInteger(message.startCharacter))
                return "startCharacter: integer expected";
            }
            if (message.endLine != null && message.hasOwnProperty("endLine")) {
              if (!$util.isInteger(message.endLine))
                return "endLine: integer expected";
            }
            if (message.endCharacter != null && message.hasOwnProperty("endCharacter")) {
              if (!$util.isInteger(message.endCharacter))
                return "endCharacter: integer expected";
            }
            return null;
          };
          Range.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.Range)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.Range();
            if (object.startLine != null)
              message.startLine = object.startLine | 0;
            if (object.startCharacter != null)
              message.startCharacter = object.startCharacter | 0;
            if (object.endLine != null)
              message.endLine = object.endLine | 0;
            if (object.endCharacter != null)
              message.endCharacter = object.endCharacter | 0;
            return message;
          };
          Range.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults) {
              object.startLine = 0;
              object.startCharacter = 0;
              object.endLine = 0;
              object.endCharacter = 0;
            }
            if (message.startLine != null && message.hasOwnProperty("startLine"))
              object.startLine = message.startLine;
            if (message.startCharacter != null && message.hasOwnProperty("startCharacter"))
              object.startCharacter = message.startCharacter;
            if (message.endLine != null && message.hasOwnProperty("endLine"))
              object.endLine = message.endLine;
            if (message.endCharacter != null && message.hasOwnProperty("endCharacter"))
              object.endCharacter = message.endCharacter;
            return object;
          };
          Range.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          Range.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.Range";
          };
          return Range;
        })();
        semanticdb.Location = (function() {
          function Location(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          Location.prototype.uri = "";
          Location.prototype.range = null;
          Location.create = function create(properties) {
            return new Location(properties);
          };
          Location.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.uri != null && Object.hasOwnProperty.call(message, "uri"))
              writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).string(message.uri);
            if (message.range != null && Object.hasOwnProperty.call(message, "range"))
              $root.scala.meta.internal.semanticdb.Range.encode(message.range, writer.uint32(
                /* id 2, wireType 2 =*/
                18
              ).fork()).ldelim();
            return writer;
          };
          Location.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          Location.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Location();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.uri = reader.string();
                  break;
                }
                case 2: {
                  message.range = $root.scala.meta.internal.semanticdb.Range.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          Location.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          Location.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.uri != null && message.hasOwnProperty("uri")) {
              if (!$util.isString(message.uri))
                return "uri: string expected";
            }
            if (message.range != null && message.hasOwnProperty("range")) {
              let error = $root.scala.meta.internal.semanticdb.Range.verify(message.range);
              if (error)
                return "range." + error;
            }
            return null;
          };
          Location.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.Location)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.Location();
            if (object.uri != null)
              message.uri = String(object.uri);
            if (object.range != null) {
              if (typeof object.range !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Location.range: object expected");
              message.range = $root.scala.meta.internal.semanticdb.Range.fromObject(object.range);
            }
            return message;
          };
          Location.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults) {
              object.uri = "";
              object.range = null;
            }
            if (message.uri != null && message.hasOwnProperty("uri"))
              object.uri = message.uri;
            if (message.range != null && message.hasOwnProperty("range"))
              object.range = $root.scala.meta.internal.semanticdb.Range.toObject(message.range, options);
            return object;
          };
          Location.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          Location.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.Location";
          };
          return Location;
        })();
        semanticdb.Scope = (function() {
          function Scope(properties) {
            this.symlinks = [];
            this.hardlinks = [];
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          Scope.prototype.symlinks = $util.emptyArray;
          Scope.prototype.hardlinks = $util.emptyArray;
          Scope.create = function create(properties) {
            return new Scope(properties);
          };
          Scope.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.symlinks != null && message.symlinks.length)
              for (let i = 0; i < message.symlinks.length; ++i)
                writer.uint32(
                  /* id 1, wireType 2 =*/
                  10
                ).string(message.symlinks[i]);
            if (message.hardlinks != null && message.hardlinks.length)
              for (let i = 0; i < message.hardlinks.length; ++i)
                $root.scala.meta.internal.semanticdb.SymbolInformation.encode(message.hardlinks[i], writer.uint32(
                  /* id 2, wireType 2 =*/
                  18
                ).fork()).ldelim();
            return writer;
          };
          Scope.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          Scope.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Scope();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  if (!(message.symlinks && message.symlinks.length))
                    message.symlinks = [];
                  message.symlinks.push(reader.string());
                  break;
                }
                case 2: {
                  if (!(message.hardlinks && message.hardlinks.length))
                    message.hardlinks = [];
                  message.hardlinks.push($root.scala.meta.internal.semanticdb.SymbolInformation.decode(reader, reader.uint32()));
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          Scope.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          Scope.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.symlinks != null && message.hasOwnProperty("symlinks")) {
              if (!Array.isArray(message.symlinks))
                return "symlinks: array expected";
              for (let i = 0; i < message.symlinks.length; ++i)
                if (!$util.isString(message.symlinks[i]))
                  return "symlinks: string[] expected";
            }
            if (message.hardlinks != null && message.hasOwnProperty("hardlinks")) {
              if (!Array.isArray(message.hardlinks))
                return "hardlinks: array expected";
              for (let i = 0; i < message.hardlinks.length; ++i) {
                let error = $root.scala.meta.internal.semanticdb.SymbolInformation.verify(message.hardlinks[i]);
                if (error)
                  return "hardlinks." + error;
              }
            }
            return null;
          };
          Scope.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.Scope)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.Scope();
            if (object.symlinks) {
              if (!Array.isArray(object.symlinks))
                throw TypeError(".scala.meta.internal.semanticdb.Scope.symlinks: array expected");
              message.symlinks = [];
              for (let i = 0; i < object.symlinks.length; ++i)
                message.symlinks[i] = String(object.symlinks[i]);
            }
            if (object.hardlinks) {
              if (!Array.isArray(object.hardlinks))
                throw TypeError(".scala.meta.internal.semanticdb.Scope.hardlinks: array expected");
              message.hardlinks = [];
              for (let i = 0; i < object.hardlinks.length; ++i) {
                if (typeof object.hardlinks[i] !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.Scope.hardlinks: object expected");
                message.hardlinks[i] = $root.scala.meta.internal.semanticdb.SymbolInformation.fromObject(object.hardlinks[i]);
              }
            }
            return message;
          };
          Scope.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.arrays || options.defaults) {
              object.symlinks = [];
              object.hardlinks = [];
            }
            if (message.symlinks && message.symlinks.length) {
              object.symlinks = [];
              for (let j = 0; j < message.symlinks.length; ++j)
                object.symlinks[j] = message.symlinks[j];
            }
            if (message.hardlinks && message.hardlinks.length) {
              object.hardlinks = [];
              for (let j = 0; j < message.hardlinks.length; ++j)
                object.hardlinks[j] = $root.scala.meta.internal.semanticdb.SymbolInformation.toObject(message.hardlinks[j], options);
            }
            return object;
          };
          Scope.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          Scope.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.Scope";
          };
          return Scope;
        })();
        semanticdb.Type = (function() {
          function Type(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          Type.prototype.typeRef = null;
          Type.prototype.singleType = null;
          Type.prototype.thisType = null;
          Type.prototype.superType = null;
          Type.prototype.constantType = null;
          Type.prototype.intersectionType = null;
          Type.prototype.unionType = null;
          Type.prototype.withType = null;
          Type.prototype.structuralType = null;
          Type.prototype.annotatedType = null;
          Type.prototype.existentialType = null;
          Type.prototype.universalType = null;
          Type.prototype.byNameType = null;
          Type.prototype.repeatedType = null;
          Type.prototype.matchType = null;
          Type.prototype.lambdaType = null;
          let $oneOfFields;
          Object.defineProperty(Type.prototype, "sealedValue", {
            get: $util.oneOfGetter($oneOfFields = ["typeRef", "singleType", "thisType", "superType", "constantType", "intersectionType", "unionType", "withType", "structuralType", "annotatedType", "existentialType", "universalType", "byNameType", "repeatedType", "matchType", "lambdaType"]),
            set: $util.oneOfSetter($oneOfFields)
          });
          Type.create = function create(properties) {
            return new Type(properties);
          };
          Type.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.typeRef != null && Object.hasOwnProperty.call(message, "typeRef"))
              $root.scala.meta.internal.semanticdb.TypeRef.encode(message.typeRef, writer.uint32(
                /* id 2, wireType 2 =*/
                18
              ).fork()).ldelim();
            if (message.structuralType != null && Object.hasOwnProperty.call(message, "structuralType"))
              $root.scala.meta.internal.semanticdb.StructuralType.encode(message.structuralType, writer.uint32(
                /* id 7, wireType 2 =*/
                58
              ).fork()).ldelim();
            if (message.annotatedType != null && Object.hasOwnProperty.call(message, "annotatedType"))
              $root.scala.meta.internal.semanticdb.AnnotatedType.encode(message.annotatedType, writer.uint32(
                /* id 8, wireType 2 =*/
                66
              ).fork()).ldelim();
            if (message.existentialType != null && Object.hasOwnProperty.call(message, "existentialType"))
              $root.scala.meta.internal.semanticdb.ExistentialType.encode(message.existentialType, writer.uint32(
                /* id 9, wireType 2 =*/
                74
              ).fork()).ldelim();
            if (message.universalType != null && Object.hasOwnProperty.call(message, "universalType"))
              $root.scala.meta.internal.semanticdb.UniversalType.encode(message.universalType, writer.uint32(
                /* id 10, wireType 2 =*/
                82
              ).fork()).ldelim();
            if (message.byNameType != null && Object.hasOwnProperty.call(message, "byNameType"))
              $root.scala.meta.internal.semanticdb.ByNameType.encode(message.byNameType, writer.uint32(
                /* id 13, wireType 2 =*/
                106
              ).fork()).ldelim();
            if (message.repeatedType != null && Object.hasOwnProperty.call(message, "repeatedType"))
              $root.scala.meta.internal.semanticdb.RepeatedType.encode(message.repeatedType, writer.uint32(
                /* id 14, wireType 2 =*/
                114
              ).fork()).ldelim();
            if (message.intersectionType != null && Object.hasOwnProperty.call(message, "intersectionType"))
              $root.scala.meta.internal.semanticdb.IntersectionType.encode(message.intersectionType, writer.uint32(
                /* id 17, wireType 2 =*/
                138
              ).fork()).ldelim();
            if (message.unionType != null && Object.hasOwnProperty.call(message, "unionType"))
              $root.scala.meta.internal.semanticdb.UnionType.encode(message.unionType, writer.uint32(
                /* id 18, wireType 2 =*/
                146
              ).fork()).ldelim();
            if (message.withType != null && Object.hasOwnProperty.call(message, "withType"))
              $root.scala.meta.internal.semanticdb.WithType.encode(message.withType, writer.uint32(
                /* id 19, wireType 2 =*/
                154
              ).fork()).ldelim();
            if (message.singleType != null && Object.hasOwnProperty.call(message, "singleType"))
              $root.scala.meta.internal.semanticdb.SingleType.encode(message.singleType, writer.uint32(
                /* id 20, wireType 2 =*/
                162
              ).fork()).ldelim();
            if (message.thisType != null && Object.hasOwnProperty.call(message, "thisType"))
              $root.scala.meta.internal.semanticdb.ThisType.encode(message.thisType, writer.uint32(
                /* id 21, wireType 2 =*/
                170
              ).fork()).ldelim();
            if (message.superType != null && Object.hasOwnProperty.call(message, "superType"))
              $root.scala.meta.internal.semanticdb.SuperType.encode(message.superType, writer.uint32(
                /* id 22, wireType 2 =*/
                178
              ).fork()).ldelim();
            if (message.constantType != null && Object.hasOwnProperty.call(message, "constantType"))
              $root.scala.meta.internal.semanticdb.ConstantType.encode(message.constantType, writer.uint32(
                /* id 23, wireType 2 =*/
                186
              ).fork()).ldelim();
            if (message.matchType != null && Object.hasOwnProperty.call(message, "matchType"))
              $root.scala.meta.internal.semanticdb.MatchType.encode(message.matchType, writer.uint32(
                /* id 25, wireType 2 =*/
                202
              ).fork()).ldelim();
            if (message.lambdaType != null && Object.hasOwnProperty.call(message, "lambdaType"))
              $root.scala.meta.internal.semanticdb.LambdaType.encode(message.lambdaType, writer.uint32(
                /* id 26, wireType 2 =*/
                210
              ).fork()).ldelim();
            return writer;
          };
          Type.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          Type.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Type();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 2: {
                  message.typeRef = $root.scala.meta.internal.semanticdb.TypeRef.decode(reader, reader.uint32());
                  break;
                }
                case 20: {
                  message.singleType = $root.scala.meta.internal.semanticdb.SingleType.decode(reader, reader.uint32());
                  break;
                }
                case 21: {
                  message.thisType = $root.scala.meta.internal.semanticdb.ThisType.decode(reader, reader.uint32());
                  break;
                }
                case 22: {
                  message.superType = $root.scala.meta.internal.semanticdb.SuperType.decode(reader, reader.uint32());
                  break;
                }
                case 23: {
                  message.constantType = $root.scala.meta.internal.semanticdb.ConstantType.decode(reader, reader.uint32());
                  break;
                }
                case 17: {
                  message.intersectionType = $root.scala.meta.internal.semanticdb.IntersectionType.decode(reader, reader.uint32());
                  break;
                }
                case 18: {
                  message.unionType = $root.scala.meta.internal.semanticdb.UnionType.decode(reader, reader.uint32());
                  break;
                }
                case 19: {
                  message.withType = $root.scala.meta.internal.semanticdb.WithType.decode(reader, reader.uint32());
                  break;
                }
                case 7: {
                  message.structuralType = $root.scala.meta.internal.semanticdb.StructuralType.decode(reader, reader.uint32());
                  break;
                }
                case 8: {
                  message.annotatedType = $root.scala.meta.internal.semanticdb.AnnotatedType.decode(reader, reader.uint32());
                  break;
                }
                case 9: {
                  message.existentialType = $root.scala.meta.internal.semanticdb.ExistentialType.decode(reader, reader.uint32());
                  break;
                }
                case 10: {
                  message.universalType = $root.scala.meta.internal.semanticdb.UniversalType.decode(reader, reader.uint32());
                  break;
                }
                case 13: {
                  message.byNameType = $root.scala.meta.internal.semanticdb.ByNameType.decode(reader, reader.uint32());
                  break;
                }
                case 14: {
                  message.repeatedType = $root.scala.meta.internal.semanticdb.RepeatedType.decode(reader, reader.uint32());
                  break;
                }
                case 25: {
                  message.matchType = $root.scala.meta.internal.semanticdb.MatchType.decode(reader, reader.uint32());
                  break;
                }
                case 26: {
                  message.lambdaType = $root.scala.meta.internal.semanticdb.LambdaType.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          Type.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          Type.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            let properties = {};
            if (message.typeRef != null && message.hasOwnProperty("typeRef")) {
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.TypeRef.verify(message.typeRef);
                if (error)
                  return "typeRef." + error;
              }
            }
            if (message.singleType != null && message.hasOwnProperty("singleType")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.SingleType.verify(message.singleType);
                if (error)
                  return "singleType." + error;
              }
            }
            if (message.thisType != null && message.hasOwnProperty("thisType")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.ThisType.verify(message.thisType);
                if (error)
                  return "thisType." + error;
              }
            }
            if (message.superType != null && message.hasOwnProperty("superType")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.SuperType.verify(message.superType);
                if (error)
                  return "superType." + error;
              }
            }
            if (message.constantType != null && message.hasOwnProperty("constantType")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.ConstantType.verify(message.constantType);
                if (error)
                  return "constantType." + error;
              }
            }
            if (message.intersectionType != null && message.hasOwnProperty("intersectionType")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.IntersectionType.verify(message.intersectionType);
                if (error)
                  return "intersectionType." + error;
              }
            }
            if (message.unionType != null && message.hasOwnProperty("unionType")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.UnionType.verify(message.unionType);
                if (error)
                  return "unionType." + error;
              }
            }
            if (message.withType != null && message.hasOwnProperty("withType")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.WithType.verify(message.withType);
                if (error)
                  return "withType." + error;
              }
            }
            if (message.structuralType != null && message.hasOwnProperty("structuralType")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.StructuralType.verify(message.structuralType);
                if (error)
                  return "structuralType." + error;
              }
            }
            if (message.annotatedType != null && message.hasOwnProperty("annotatedType")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.AnnotatedType.verify(message.annotatedType);
                if (error)
                  return "annotatedType." + error;
              }
            }
            if (message.existentialType != null && message.hasOwnProperty("existentialType")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.ExistentialType.verify(message.existentialType);
                if (error)
                  return "existentialType." + error;
              }
            }
            if (message.universalType != null && message.hasOwnProperty("universalType")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.UniversalType.verify(message.universalType);
                if (error)
                  return "universalType." + error;
              }
            }
            if (message.byNameType != null && message.hasOwnProperty("byNameType")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.ByNameType.verify(message.byNameType);
                if (error)
                  return "byNameType." + error;
              }
            }
            if (message.repeatedType != null && message.hasOwnProperty("repeatedType")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.RepeatedType.verify(message.repeatedType);
                if (error)
                  return "repeatedType." + error;
              }
            }
            if (message.matchType != null && message.hasOwnProperty("matchType")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.MatchType.verify(message.matchType);
                if (error)
                  return "matchType." + error;
              }
            }
            if (message.lambdaType != null && message.hasOwnProperty("lambdaType")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.LambdaType.verify(message.lambdaType);
                if (error)
                  return "lambdaType." + error;
              }
            }
            return null;
          };
          Type.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.Type)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.Type();
            if (object.typeRef != null) {
              if (typeof object.typeRef !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Type.typeRef: object expected");
              message.typeRef = $root.scala.meta.internal.semanticdb.TypeRef.fromObject(object.typeRef);
            }
            if (object.singleType != null) {
              if (typeof object.singleType !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Type.singleType: object expected");
              message.singleType = $root.scala.meta.internal.semanticdb.SingleType.fromObject(object.singleType);
            }
            if (object.thisType != null) {
              if (typeof object.thisType !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Type.thisType: object expected");
              message.thisType = $root.scala.meta.internal.semanticdb.ThisType.fromObject(object.thisType);
            }
            if (object.superType != null) {
              if (typeof object.superType !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Type.superType: object expected");
              message.superType = $root.scala.meta.internal.semanticdb.SuperType.fromObject(object.superType);
            }
            if (object.constantType != null) {
              if (typeof object.constantType !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Type.constantType: object expected");
              message.constantType = $root.scala.meta.internal.semanticdb.ConstantType.fromObject(object.constantType);
            }
            if (object.intersectionType != null) {
              if (typeof object.intersectionType !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Type.intersectionType: object expected");
              message.intersectionType = $root.scala.meta.internal.semanticdb.IntersectionType.fromObject(object.intersectionType);
            }
            if (object.unionType != null) {
              if (typeof object.unionType !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Type.unionType: object expected");
              message.unionType = $root.scala.meta.internal.semanticdb.UnionType.fromObject(object.unionType);
            }
            if (object.withType != null) {
              if (typeof object.withType !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Type.withType: object expected");
              message.withType = $root.scala.meta.internal.semanticdb.WithType.fromObject(object.withType);
            }
            if (object.structuralType != null) {
              if (typeof object.structuralType !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Type.structuralType: object expected");
              message.structuralType = $root.scala.meta.internal.semanticdb.StructuralType.fromObject(object.structuralType);
            }
            if (object.annotatedType != null) {
              if (typeof object.annotatedType !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Type.annotatedType: object expected");
              message.annotatedType = $root.scala.meta.internal.semanticdb.AnnotatedType.fromObject(object.annotatedType);
            }
            if (object.existentialType != null) {
              if (typeof object.existentialType !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Type.existentialType: object expected");
              message.existentialType = $root.scala.meta.internal.semanticdb.ExistentialType.fromObject(object.existentialType);
            }
            if (object.universalType != null) {
              if (typeof object.universalType !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Type.universalType: object expected");
              message.universalType = $root.scala.meta.internal.semanticdb.UniversalType.fromObject(object.universalType);
            }
            if (object.byNameType != null) {
              if (typeof object.byNameType !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Type.byNameType: object expected");
              message.byNameType = $root.scala.meta.internal.semanticdb.ByNameType.fromObject(object.byNameType);
            }
            if (object.repeatedType != null) {
              if (typeof object.repeatedType !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Type.repeatedType: object expected");
              message.repeatedType = $root.scala.meta.internal.semanticdb.RepeatedType.fromObject(object.repeatedType);
            }
            if (object.matchType != null) {
              if (typeof object.matchType !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Type.matchType: object expected");
              message.matchType = $root.scala.meta.internal.semanticdb.MatchType.fromObject(object.matchType);
            }
            if (object.lambdaType != null) {
              if (typeof object.lambdaType !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Type.lambdaType: object expected");
              message.lambdaType = $root.scala.meta.internal.semanticdb.LambdaType.fromObject(object.lambdaType);
            }
            return message;
          };
          Type.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (message.typeRef != null && message.hasOwnProperty("typeRef")) {
              object.typeRef = $root.scala.meta.internal.semanticdb.TypeRef.toObject(message.typeRef, options);
              if (options.oneofs)
                object.sealedValue = "typeRef";
            }
            if (message.structuralType != null && message.hasOwnProperty("structuralType")) {
              object.structuralType = $root.scala.meta.internal.semanticdb.StructuralType.toObject(message.structuralType, options);
              if (options.oneofs)
                object.sealedValue = "structuralType";
            }
            if (message.annotatedType != null && message.hasOwnProperty("annotatedType")) {
              object.annotatedType = $root.scala.meta.internal.semanticdb.AnnotatedType.toObject(message.annotatedType, options);
              if (options.oneofs)
                object.sealedValue = "annotatedType";
            }
            if (message.existentialType != null && message.hasOwnProperty("existentialType")) {
              object.existentialType = $root.scala.meta.internal.semanticdb.ExistentialType.toObject(message.existentialType, options);
              if (options.oneofs)
                object.sealedValue = "existentialType";
            }
            if (message.universalType != null && message.hasOwnProperty("universalType")) {
              object.universalType = $root.scala.meta.internal.semanticdb.UniversalType.toObject(message.universalType, options);
              if (options.oneofs)
                object.sealedValue = "universalType";
            }
            if (message.byNameType != null && message.hasOwnProperty("byNameType")) {
              object.byNameType = $root.scala.meta.internal.semanticdb.ByNameType.toObject(message.byNameType, options);
              if (options.oneofs)
                object.sealedValue = "byNameType";
            }
            if (message.repeatedType != null && message.hasOwnProperty("repeatedType")) {
              object.repeatedType = $root.scala.meta.internal.semanticdb.RepeatedType.toObject(message.repeatedType, options);
              if (options.oneofs)
                object.sealedValue = "repeatedType";
            }
            if (message.intersectionType != null && message.hasOwnProperty("intersectionType")) {
              object.intersectionType = $root.scala.meta.internal.semanticdb.IntersectionType.toObject(message.intersectionType, options);
              if (options.oneofs)
                object.sealedValue = "intersectionType";
            }
            if (message.unionType != null && message.hasOwnProperty("unionType")) {
              object.unionType = $root.scala.meta.internal.semanticdb.UnionType.toObject(message.unionType, options);
              if (options.oneofs)
                object.sealedValue = "unionType";
            }
            if (message.withType != null && message.hasOwnProperty("withType")) {
              object.withType = $root.scala.meta.internal.semanticdb.WithType.toObject(message.withType, options);
              if (options.oneofs)
                object.sealedValue = "withType";
            }
            if (message.singleType != null && message.hasOwnProperty("singleType")) {
              object.singleType = $root.scala.meta.internal.semanticdb.SingleType.toObject(message.singleType, options);
              if (options.oneofs)
                object.sealedValue = "singleType";
            }
            if (message.thisType != null && message.hasOwnProperty("thisType")) {
              object.thisType = $root.scala.meta.internal.semanticdb.ThisType.toObject(message.thisType, options);
              if (options.oneofs)
                object.sealedValue = "thisType";
            }
            if (message.superType != null && message.hasOwnProperty("superType")) {
              object.superType = $root.scala.meta.internal.semanticdb.SuperType.toObject(message.superType, options);
              if (options.oneofs)
                object.sealedValue = "superType";
            }
            if (message.constantType != null && message.hasOwnProperty("constantType")) {
              object.constantType = $root.scala.meta.internal.semanticdb.ConstantType.toObject(message.constantType, options);
              if (options.oneofs)
                object.sealedValue = "constantType";
            }
            if (message.matchType != null && message.hasOwnProperty("matchType")) {
              object.matchType = $root.scala.meta.internal.semanticdb.MatchType.toObject(message.matchType, options);
              if (options.oneofs)
                object.sealedValue = "matchType";
            }
            if (message.lambdaType != null && message.hasOwnProperty("lambdaType")) {
              object.lambdaType = $root.scala.meta.internal.semanticdb.LambdaType.toObject(message.lambdaType, options);
              if (options.oneofs)
                object.sealedValue = "lambdaType";
            }
            return object;
          };
          Type.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          Type.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.Type";
          };
          return Type;
        })();
        semanticdb.LambdaType = (function() {
          function LambdaType(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          LambdaType.prototype.parameters = null;
          LambdaType.prototype.returnType = null;
          LambdaType.create = function create(properties) {
            return new LambdaType(properties);
          };
          LambdaType.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.parameters != null && Object.hasOwnProperty.call(message, "parameters"))
              $root.scala.meta.internal.semanticdb.Scope.encode(message.parameters, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message.returnType != null && Object.hasOwnProperty.call(message, "returnType"))
              $root.scala.meta.internal.semanticdb.Type.encode(message.returnType, writer.uint32(
                /* id 2, wireType 2 =*/
                18
              ).fork()).ldelim();
            return writer;
          };
          LambdaType.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          LambdaType.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.LambdaType();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.parameters = $root.scala.meta.internal.semanticdb.Scope.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  message.returnType = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          LambdaType.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          LambdaType.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.parameters != null && message.hasOwnProperty("parameters")) {
              let error = $root.scala.meta.internal.semanticdb.Scope.verify(message.parameters);
              if (error)
                return "parameters." + error;
            }
            if (message.returnType != null && message.hasOwnProperty("returnType")) {
              let error = $root.scala.meta.internal.semanticdb.Type.verify(message.returnType);
              if (error)
                return "returnType." + error;
            }
            return null;
          };
          LambdaType.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.LambdaType)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.LambdaType();
            if (object.parameters != null) {
              if (typeof object.parameters !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.LambdaType.parameters: object expected");
              message.parameters = $root.scala.meta.internal.semanticdb.Scope.fromObject(object.parameters);
            }
            if (object.returnType != null) {
              if (typeof object.returnType !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.LambdaType.returnType: object expected");
              message.returnType = $root.scala.meta.internal.semanticdb.Type.fromObject(object.returnType);
            }
            return message;
          };
          LambdaType.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults) {
              object.parameters = null;
              object.returnType = null;
            }
            if (message.parameters != null && message.hasOwnProperty("parameters"))
              object.parameters = $root.scala.meta.internal.semanticdb.Scope.toObject(message.parameters, options);
            if (message.returnType != null && message.hasOwnProperty("returnType"))
              object.returnType = $root.scala.meta.internal.semanticdb.Type.toObject(message.returnType, options);
            return object;
          };
          LambdaType.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          LambdaType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.LambdaType";
          };
          return LambdaType;
        })();
        semanticdb.TypeRef = (function() {
          function TypeRef(properties) {
            this.typeArguments = [];
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          TypeRef.prototype.prefix = null;
          TypeRef.prototype.symbol = "";
          TypeRef.prototype.typeArguments = $util.emptyArray;
          TypeRef.create = function create(properties) {
            return new TypeRef(properties);
          };
          TypeRef.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.prefix != null && Object.hasOwnProperty.call(message, "prefix"))
              $root.scala.meta.internal.semanticdb.Type.encode(message.prefix, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message.symbol != null && Object.hasOwnProperty.call(message, "symbol"))
              writer.uint32(
                /* id 2, wireType 2 =*/
                18
              ).string(message.symbol);
            if (message.typeArguments != null && message.typeArguments.length)
              for (let i = 0; i < message.typeArguments.length; ++i)
                $root.scala.meta.internal.semanticdb.Type.encode(message.typeArguments[i], writer.uint32(
                  /* id 3, wireType 2 =*/
                  26
                ).fork()).ldelim();
            return writer;
          };
          TypeRef.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          TypeRef.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.TypeRef();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.prefix = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  message.symbol = reader.string();
                  break;
                }
                case 3: {
                  if (!(message.typeArguments && message.typeArguments.length))
                    message.typeArguments = [];
                  message.typeArguments.push($root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32()));
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          TypeRef.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          TypeRef.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.prefix != null && message.hasOwnProperty("prefix")) {
              let error = $root.scala.meta.internal.semanticdb.Type.verify(message.prefix);
              if (error)
                return "prefix." + error;
            }
            if (message.symbol != null && message.hasOwnProperty("symbol")) {
              if (!$util.isString(message.symbol))
                return "symbol: string expected";
            }
            if (message.typeArguments != null && message.hasOwnProperty("typeArguments")) {
              if (!Array.isArray(message.typeArguments))
                return "typeArguments: array expected";
              for (let i = 0; i < message.typeArguments.length; ++i) {
                let error = $root.scala.meta.internal.semanticdb.Type.verify(message.typeArguments[i]);
                if (error)
                  return "typeArguments." + error;
              }
            }
            return null;
          };
          TypeRef.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.TypeRef)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.TypeRef();
            if (object.prefix != null) {
              if (typeof object.prefix !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.TypeRef.prefix: object expected");
              message.prefix = $root.scala.meta.internal.semanticdb.Type.fromObject(object.prefix);
            }
            if (object.symbol != null)
              message.symbol = String(object.symbol);
            if (object.typeArguments) {
              if (!Array.isArray(object.typeArguments))
                throw TypeError(".scala.meta.internal.semanticdb.TypeRef.typeArguments: array expected");
              message.typeArguments = [];
              for (let i = 0; i < object.typeArguments.length; ++i) {
                if (typeof object.typeArguments[i] !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.TypeRef.typeArguments: object expected");
                message.typeArguments[i] = $root.scala.meta.internal.semanticdb.Type.fromObject(object.typeArguments[i]);
              }
            }
            return message;
          };
          TypeRef.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.arrays || options.defaults)
              object.typeArguments = [];
            if (options.defaults) {
              object.prefix = null;
              object.symbol = "";
            }
            if (message.prefix != null && message.hasOwnProperty("prefix"))
              object.prefix = $root.scala.meta.internal.semanticdb.Type.toObject(message.prefix, options);
            if (message.symbol != null && message.hasOwnProperty("symbol"))
              object.symbol = message.symbol;
            if (message.typeArguments && message.typeArguments.length) {
              object.typeArguments = [];
              for (let j = 0; j < message.typeArguments.length; ++j)
                object.typeArguments[j] = $root.scala.meta.internal.semanticdb.Type.toObject(message.typeArguments[j], options);
            }
            return object;
          };
          TypeRef.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          TypeRef.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.TypeRef";
          };
          return TypeRef;
        })();
        semanticdb.SingleType = (function() {
          function SingleType(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          SingleType.prototype.prefix = null;
          SingleType.prototype.symbol = "";
          SingleType.create = function create(properties) {
            return new SingleType(properties);
          };
          SingleType.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.prefix != null && Object.hasOwnProperty.call(message, "prefix"))
              $root.scala.meta.internal.semanticdb.Type.encode(message.prefix, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message.symbol != null && Object.hasOwnProperty.call(message, "symbol"))
              writer.uint32(
                /* id 2, wireType 2 =*/
                18
              ).string(message.symbol);
            return writer;
          };
          SingleType.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          SingleType.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.SingleType();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.prefix = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  message.symbol = reader.string();
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          SingleType.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          SingleType.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.prefix != null && message.hasOwnProperty("prefix")) {
              let error = $root.scala.meta.internal.semanticdb.Type.verify(message.prefix);
              if (error)
                return "prefix." + error;
            }
            if (message.symbol != null && message.hasOwnProperty("symbol")) {
              if (!$util.isString(message.symbol))
                return "symbol: string expected";
            }
            return null;
          };
          SingleType.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.SingleType)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.SingleType();
            if (object.prefix != null) {
              if (typeof object.prefix !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.SingleType.prefix: object expected");
              message.prefix = $root.scala.meta.internal.semanticdb.Type.fromObject(object.prefix);
            }
            if (object.symbol != null)
              message.symbol = String(object.symbol);
            return message;
          };
          SingleType.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults) {
              object.prefix = null;
              object.symbol = "";
            }
            if (message.prefix != null && message.hasOwnProperty("prefix"))
              object.prefix = $root.scala.meta.internal.semanticdb.Type.toObject(message.prefix, options);
            if (message.symbol != null && message.hasOwnProperty("symbol"))
              object.symbol = message.symbol;
            return object;
          };
          SingleType.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          SingleType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.SingleType";
          };
          return SingleType;
        })();
        semanticdb.ThisType = (function() {
          function ThisType(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          ThisType.prototype.symbol = "";
          ThisType.create = function create(properties) {
            return new ThisType(properties);
          };
          ThisType.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.symbol != null && Object.hasOwnProperty.call(message, "symbol"))
              writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).string(message.symbol);
            return writer;
          };
          ThisType.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          ThisType.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ThisType();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.symbol = reader.string();
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          ThisType.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          ThisType.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.symbol != null && message.hasOwnProperty("symbol")) {
              if (!$util.isString(message.symbol))
                return "symbol: string expected";
            }
            return null;
          };
          ThisType.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.ThisType)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.ThisType();
            if (object.symbol != null)
              message.symbol = String(object.symbol);
            return message;
          };
          ThisType.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults)
              object.symbol = "";
            if (message.symbol != null && message.hasOwnProperty("symbol"))
              object.symbol = message.symbol;
            return object;
          };
          ThisType.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          ThisType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.ThisType";
          };
          return ThisType;
        })();
        semanticdb.SuperType = (function() {
          function SuperType(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          SuperType.prototype.prefix = null;
          SuperType.prototype.symbol = "";
          SuperType.create = function create(properties) {
            return new SuperType(properties);
          };
          SuperType.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.prefix != null && Object.hasOwnProperty.call(message, "prefix"))
              $root.scala.meta.internal.semanticdb.Type.encode(message.prefix, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message.symbol != null && Object.hasOwnProperty.call(message, "symbol"))
              writer.uint32(
                /* id 2, wireType 2 =*/
                18
              ).string(message.symbol);
            return writer;
          };
          SuperType.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          SuperType.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.SuperType();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.prefix = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  message.symbol = reader.string();
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          SuperType.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          SuperType.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.prefix != null && message.hasOwnProperty("prefix")) {
              let error = $root.scala.meta.internal.semanticdb.Type.verify(message.prefix);
              if (error)
                return "prefix." + error;
            }
            if (message.symbol != null && message.hasOwnProperty("symbol")) {
              if (!$util.isString(message.symbol))
                return "symbol: string expected";
            }
            return null;
          };
          SuperType.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.SuperType)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.SuperType();
            if (object.prefix != null) {
              if (typeof object.prefix !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.SuperType.prefix: object expected");
              message.prefix = $root.scala.meta.internal.semanticdb.Type.fromObject(object.prefix);
            }
            if (object.symbol != null)
              message.symbol = String(object.symbol);
            return message;
          };
          SuperType.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults) {
              object.prefix = null;
              object.symbol = "";
            }
            if (message.prefix != null && message.hasOwnProperty("prefix"))
              object.prefix = $root.scala.meta.internal.semanticdb.Type.toObject(message.prefix, options);
            if (message.symbol != null && message.hasOwnProperty("symbol"))
              object.symbol = message.symbol;
            return object;
          };
          SuperType.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          SuperType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.SuperType";
          };
          return SuperType;
        })();
        semanticdb.ConstantType = (function() {
          function ConstantType(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          ConstantType.prototype.constant = null;
          ConstantType.create = function create(properties) {
            return new ConstantType(properties);
          };
          ConstantType.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.constant != null && Object.hasOwnProperty.call(message, "constant"))
              $root.scala.meta.internal.semanticdb.Constant.encode(message.constant, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            return writer;
          };
          ConstantType.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          ConstantType.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ConstantType();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.constant = $root.scala.meta.internal.semanticdb.Constant.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          ConstantType.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          ConstantType.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.constant != null && message.hasOwnProperty("constant")) {
              let error = $root.scala.meta.internal.semanticdb.Constant.verify(message.constant);
              if (error)
                return "constant." + error;
            }
            return null;
          };
          ConstantType.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.ConstantType)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.ConstantType();
            if (object.constant != null) {
              if (typeof object.constant !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.ConstantType.constant: object expected");
              message.constant = $root.scala.meta.internal.semanticdb.Constant.fromObject(object.constant);
            }
            return message;
          };
          ConstantType.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults)
              object.constant = null;
            if (message.constant != null && message.hasOwnProperty("constant"))
              object.constant = $root.scala.meta.internal.semanticdb.Constant.toObject(message.constant, options);
            return object;
          };
          ConstantType.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          ConstantType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.ConstantType";
          };
          return ConstantType;
        })();
        semanticdb.IntersectionType = (function() {
          function IntersectionType(properties) {
            this.types = [];
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          IntersectionType.prototype.types = $util.emptyArray;
          IntersectionType.create = function create(properties) {
            return new IntersectionType(properties);
          };
          IntersectionType.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.types != null && message.types.length)
              for (let i = 0; i < message.types.length; ++i)
                $root.scala.meta.internal.semanticdb.Type.encode(message.types[i], writer.uint32(
                  /* id 1, wireType 2 =*/
                  10
                ).fork()).ldelim();
            return writer;
          };
          IntersectionType.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          IntersectionType.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.IntersectionType();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  if (!(message.types && message.types.length))
                    message.types = [];
                  message.types.push($root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32()));
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          IntersectionType.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          IntersectionType.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.types != null && message.hasOwnProperty("types")) {
              if (!Array.isArray(message.types))
                return "types: array expected";
              for (let i = 0; i < message.types.length; ++i) {
                let error = $root.scala.meta.internal.semanticdb.Type.verify(message.types[i]);
                if (error)
                  return "types." + error;
              }
            }
            return null;
          };
          IntersectionType.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.IntersectionType)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.IntersectionType();
            if (object.types) {
              if (!Array.isArray(object.types))
                throw TypeError(".scala.meta.internal.semanticdb.IntersectionType.types: array expected");
              message.types = [];
              for (let i = 0; i < object.types.length; ++i) {
                if (typeof object.types[i] !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.IntersectionType.types: object expected");
                message.types[i] = $root.scala.meta.internal.semanticdb.Type.fromObject(object.types[i]);
              }
            }
            return message;
          };
          IntersectionType.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.arrays || options.defaults)
              object.types = [];
            if (message.types && message.types.length) {
              object.types = [];
              for (let j = 0; j < message.types.length; ++j)
                object.types[j] = $root.scala.meta.internal.semanticdb.Type.toObject(message.types[j], options);
            }
            return object;
          };
          IntersectionType.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          IntersectionType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.IntersectionType";
          };
          return IntersectionType;
        })();
        semanticdb.UnionType = (function() {
          function UnionType(properties) {
            this.types = [];
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          UnionType.prototype.types = $util.emptyArray;
          UnionType.create = function create(properties) {
            return new UnionType(properties);
          };
          UnionType.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.types != null && message.types.length)
              for (let i = 0; i < message.types.length; ++i)
                $root.scala.meta.internal.semanticdb.Type.encode(message.types[i], writer.uint32(
                  /* id 1, wireType 2 =*/
                  10
                ).fork()).ldelim();
            return writer;
          };
          UnionType.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          UnionType.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.UnionType();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  if (!(message.types && message.types.length))
                    message.types = [];
                  message.types.push($root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32()));
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          UnionType.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          UnionType.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.types != null && message.hasOwnProperty("types")) {
              if (!Array.isArray(message.types))
                return "types: array expected";
              for (let i = 0; i < message.types.length; ++i) {
                let error = $root.scala.meta.internal.semanticdb.Type.verify(message.types[i]);
                if (error)
                  return "types." + error;
              }
            }
            return null;
          };
          UnionType.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.UnionType)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.UnionType();
            if (object.types) {
              if (!Array.isArray(object.types))
                throw TypeError(".scala.meta.internal.semanticdb.UnionType.types: array expected");
              message.types = [];
              for (let i = 0; i < object.types.length; ++i) {
                if (typeof object.types[i] !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.UnionType.types: object expected");
                message.types[i] = $root.scala.meta.internal.semanticdb.Type.fromObject(object.types[i]);
              }
            }
            return message;
          };
          UnionType.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.arrays || options.defaults)
              object.types = [];
            if (message.types && message.types.length) {
              object.types = [];
              for (let j = 0; j < message.types.length; ++j)
                object.types[j] = $root.scala.meta.internal.semanticdb.Type.toObject(message.types[j], options);
            }
            return object;
          };
          UnionType.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          UnionType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.UnionType";
          };
          return UnionType;
        })();
        semanticdb.WithType = (function() {
          function WithType(properties) {
            this.types = [];
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          WithType.prototype.types = $util.emptyArray;
          WithType.create = function create(properties) {
            return new WithType(properties);
          };
          WithType.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.types != null && message.types.length)
              for (let i = 0; i < message.types.length; ++i)
                $root.scala.meta.internal.semanticdb.Type.encode(message.types[i], writer.uint32(
                  /* id 1, wireType 2 =*/
                  10
                ).fork()).ldelim();
            return writer;
          };
          WithType.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          WithType.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.WithType();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  if (!(message.types && message.types.length))
                    message.types = [];
                  message.types.push($root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32()));
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          WithType.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          WithType.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.types != null && message.hasOwnProperty("types")) {
              if (!Array.isArray(message.types))
                return "types: array expected";
              for (let i = 0; i < message.types.length; ++i) {
                let error = $root.scala.meta.internal.semanticdb.Type.verify(message.types[i]);
                if (error)
                  return "types." + error;
              }
            }
            return null;
          };
          WithType.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.WithType)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.WithType();
            if (object.types) {
              if (!Array.isArray(object.types))
                throw TypeError(".scala.meta.internal.semanticdb.WithType.types: array expected");
              message.types = [];
              for (let i = 0; i < object.types.length; ++i) {
                if (typeof object.types[i] !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.WithType.types: object expected");
                message.types[i] = $root.scala.meta.internal.semanticdb.Type.fromObject(object.types[i]);
              }
            }
            return message;
          };
          WithType.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.arrays || options.defaults)
              object.types = [];
            if (message.types && message.types.length) {
              object.types = [];
              for (let j = 0; j < message.types.length; ++j)
                object.types[j] = $root.scala.meta.internal.semanticdb.Type.toObject(message.types[j], options);
            }
            return object;
          };
          WithType.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          WithType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.WithType";
          };
          return WithType;
        })();
        semanticdb.StructuralType = (function() {
          function StructuralType(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          StructuralType.prototype.tpe = null;
          StructuralType.prototype.declarations = null;
          StructuralType.create = function create(properties) {
            return new StructuralType(properties);
          };
          StructuralType.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.tpe != null && Object.hasOwnProperty.call(message, "tpe"))
              $root.scala.meta.internal.semanticdb.Type.encode(message.tpe, writer.uint32(
                /* id 4, wireType 2 =*/
                34
              ).fork()).ldelim();
            if (message.declarations != null && Object.hasOwnProperty.call(message, "declarations"))
              $root.scala.meta.internal.semanticdb.Scope.encode(message.declarations, writer.uint32(
                /* id 5, wireType 2 =*/
                42
              ).fork()).ldelim();
            return writer;
          };
          StructuralType.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          StructuralType.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.StructuralType();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 4: {
                  message.tpe = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                  break;
                }
                case 5: {
                  message.declarations = $root.scala.meta.internal.semanticdb.Scope.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          StructuralType.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          StructuralType.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.tpe != null && message.hasOwnProperty("tpe")) {
              let error = $root.scala.meta.internal.semanticdb.Type.verify(message.tpe);
              if (error)
                return "tpe." + error;
            }
            if (message.declarations != null && message.hasOwnProperty("declarations")) {
              let error = $root.scala.meta.internal.semanticdb.Scope.verify(message.declarations);
              if (error)
                return "declarations." + error;
            }
            return null;
          };
          StructuralType.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.StructuralType)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.StructuralType();
            if (object.tpe != null) {
              if (typeof object.tpe !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.StructuralType.tpe: object expected");
              message.tpe = $root.scala.meta.internal.semanticdb.Type.fromObject(object.tpe);
            }
            if (object.declarations != null) {
              if (typeof object.declarations !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.StructuralType.declarations: object expected");
              message.declarations = $root.scala.meta.internal.semanticdb.Scope.fromObject(object.declarations);
            }
            return message;
          };
          StructuralType.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults) {
              object.tpe = null;
              object.declarations = null;
            }
            if (message.tpe != null && message.hasOwnProperty("tpe"))
              object.tpe = $root.scala.meta.internal.semanticdb.Type.toObject(message.tpe, options);
            if (message.declarations != null && message.hasOwnProperty("declarations"))
              object.declarations = $root.scala.meta.internal.semanticdb.Scope.toObject(message.declarations, options);
            return object;
          };
          StructuralType.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          StructuralType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.StructuralType";
          };
          return StructuralType;
        })();
        semanticdb.AnnotatedType = (function() {
          function AnnotatedType(properties) {
            this.annotations = [];
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          AnnotatedType.prototype.annotations = $util.emptyArray;
          AnnotatedType.prototype.tpe = null;
          AnnotatedType.create = function create(properties) {
            return new AnnotatedType(properties);
          };
          AnnotatedType.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.tpe != null && Object.hasOwnProperty.call(message, "tpe"))
              $root.scala.meta.internal.semanticdb.Type.encode(message.tpe, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message.annotations != null && message.annotations.length)
              for (let i = 0; i < message.annotations.length; ++i)
                $root.scala.meta.internal.semanticdb.AnnotationTree.encode(message.annotations[i], writer.uint32(
                  /* id 3, wireType 2 =*/
                  26
                ).fork()).ldelim();
            return writer;
          };
          AnnotatedType.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          AnnotatedType.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.AnnotatedType();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 3: {
                  if (!(message.annotations && message.annotations.length))
                    message.annotations = [];
                  message.annotations.push($root.scala.meta.internal.semanticdb.AnnotationTree.decode(reader, reader.uint32()));
                  break;
                }
                case 1: {
                  message.tpe = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          AnnotatedType.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          AnnotatedType.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.annotations != null && message.hasOwnProperty("annotations")) {
              if (!Array.isArray(message.annotations))
                return "annotations: array expected";
              for (let i = 0; i < message.annotations.length; ++i) {
                let error = $root.scala.meta.internal.semanticdb.AnnotationTree.verify(message.annotations[i]);
                if (error)
                  return "annotations." + error;
              }
            }
            if (message.tpe != null && message.hasOwnProperty("tpe")) {
              let error = $root.scala.meta.internal.semanticdb.Type.verify(message.tpe);
              if (error)
                return "tpe." + error;
            }
            return null;
          };
          AnnotatedType.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.AnnotatedType)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.AnnotatedType();
            if (object.annotations) {
              if (!Array.isArray(object.annotations))
                throw TypeError(".scala.meta.internal.semanticdb.AnnotatedType.annotations: array expected");
              message.annotations = [];
              for (let i = 0; i < object.annotations.length; ++i) {
                if (typeof object.annotations[i] !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.AnnotatedType.annotations: object expected");
                message.annotations[i] = $root.scala.meta.internal.semanticdb.AnnotationTree.fromObject(object.annotations[i]);
              }
            }
            if (object.tpe != null) {
              if (typeof object.tpe !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.AnnotatedType.tpe: object expected");
              message.tpe = $root.scala.meta.internal.semanticdb.Type.fromObject(object.tpe);
            }
            return message;
          };
          AnnotatedType.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.arrays || options.defaults)
              object.annotations = [];
            if (options.defaults)
              object.tpe = null;
            if (message.tpe != null && message.hasOwnProperty("tpe"))
              object.tpe = $root.scala.meta.internal.semanticdb.Type.toObject(message.tpe, options);
            if (message.annotations && message.annotations.length) {
              object.annotations = [];
              for (let j = 0; j < message.annotations.length; ++j)
                object.annotations[j] = $root.scala.meta.internal.semanticdb.AnnotationTree.toObject(message.annotations[j], options);
            }
            return object;
          };
          AnnotatedType.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          AnnotatedType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.AnnotatedType";
          };
          return AnnotatedType;
        })();
        semanticdb.ExistentialType = (function() {
          function ExistentialType(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          ExistentialType.prototype.tpe = null;
          ExistentialType.prototype.declarations = null;
          ExistentialType.create = function create(properties) {
            return new ExistentialType(properties);
          };
          ExistentialType.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.tpe != null && Object.hasOwnProperty.call(message, "tpe"))
              $root.scala.meta.internal.semanticdb.Type.encode(message.tpe, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message.declarations != null && Object.hasOwnProperty.call(message, "declarations"))
              $root.scala.meta.internal.semanticdb.Scope.encode(message.declarations, writer.uint32(
                /* id 3, wireType 2 =*/
                26
              ).fork()).ldelim();
            return writer;
          };
          ExistentialType.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          ExistentialType.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ExistentialType();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.tpe = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                  break;
                }
                case 3: {
                  message.declarations = $root.scala.meta.internal.semanticdb.Scope.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          ExistentialType.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          ExistentialType.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.tpe != null && message.hasOwnProperty("tpe")) {
              let error = $root.scala.meta.internal.semanticdb.Type.verify(message.tpe);
              if (error)
                return "tpe." + error;
            }
            if (message.declarations != null && message.hasOwnProperty("declarations")) {
              let error = $root.scala.meta.internal.semanticdb.Scope.verify(message.declarations);
              if (error)
                return "declarations." + error;
            }
            return null;
          };
          ExistentialType.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.ExistentialType)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.ExistentialType();
            if (object.tpe != null) {
              if (typeof object.tpe !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.ExistentialType.tpe: object expected");
              message.tpe = $root.scala.meta.internal.semanticdb.Type.fromObject(object.tpe);
            }
            if (object.declarations != null) {
              if (typeof object.declarations !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.ExistentialType.declarations: object expected");
              message.declarations = $root.scala.meta.internal.semanticdb.Scope.fromObject(object.declarations);
            }
            return message;
          };
          ExistentialType.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults) {
              object.tpe = null;
              object.declarations = null;
            }
            if (message.tpe != null && message.hasOwnProperty("tpe"))
              object.tpe = $root.scala.meta.internal.semanticdb.Type.toObject(message.tpe, options);
            if (message.declarations != null && message.hasOwnProperty("declarations"))
              object.declarations = $root.scala.meta.internal.semanticdb.Scope.toObject(message.declarations, options);
            return object;
          };
          ExistentialType.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          ExistentialType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.ExistentialType";
          };
          return ExistentialType;
        })();
        semanticdb.UniversalType = (function() {
          function UniversalType(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          UniversalType.prototype.typeParameters = null;
          UniversalType.prototype.tpe = null;
          UniversalType.create = function create(properties) {
            return new UniversalType(properties);
          };
          UniversalType.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.tpe != null && Object.hasOwnProperty.call(message, "tpe"))
              $root.scala.meta.internal.semanticdb.Type.encode(message.tpe, writer.uint32(
                /* id 2, wireType 2 =*/
                18
              ).fork()).ldelim();
            if (message.typeParameters != null && Object.hasOwnProperty.call(message, "typeParameters"))
              $root.scala.meta.internal.semanticdb.Scope.encode(message.typeParameters, writer.uint32(
                /* id 3, wireType 2 =*/
                26
              ).fork()).ldelim();
            return writer;
          };
          UniversalType.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          UniversalType.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.UniversalType();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 3: {
                  message.typeParameters = $root.scala.meta.internal.semanticdb.Scope.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  message.tpe = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          UniversalType.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          UniversalType.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.typeParameters != null && message.hasOwnProperty("typeParameters")) {
              let error = $root.scala.meta.internal.semanticdb.Scope.verify(message.typeParameters);
              if (error)
                return "typeParameters." + error;
            }
            if (message.tpe != null && message.hasOwnProperty("tpe")) {
              let error = $root.scala.meta.internal.semanticdb.Type.verify(message.tpe);
              if (error)
                return "tpe." + error;
            }
            return null;
          };
          UniversalType.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.UniversalType)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.UniversalType();
            if (object.typeParameters != null) {
              if (typeof object.typeParameters !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.UniversalType.typeParameters: object expected");
              message.typeParameters = $root.scala.meta.internal.semanticdb.Scope.fromObject(object.typeParameters);
            }
            if (object.tpe != null) {
              if (typeof object.tpe !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.UniversalType.tpe: object expected");
              message.tpe = $root.scala.meta.internal.semanticdb.Type.fromObject(object.tpe);
            }
            return message;
          };
          UniversalType.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults) {
              object.tpe = null;
              object.typeParameters = null;
            }
            if (message.tpe != null && message.hasOwnProperty("tpe"))
              object.tpe = $root.scala.meta.internal.semanticdb.Type.toObject(message.tpe, options);
            if (message.typeParameters != null && message.hasOwnProperty("typeParameters"))
              object.typeParameters = $root.scala.meta.internal.semanticdb.Scope.toObject(message.typeParameters, options);
            return object;
          };
          UniversalType.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          UniversalType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.UniversalType";
          };
          return UniversalType;
        })();
        semanticdb.ByNameType = (function() {
          function ByNameType(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          ByNameType.prototype.tpe = null;
          ByNameType.create = function create(properties) {
            return new ByNameType(properties);
          };
          ByNameType.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.tpe != null && Object.hasOwnProperty.call(message, "tpe"))
              $root.scala.meta.internal.semanticdb.Type.encode(message.tpe, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            return writer;
          };
          ByNameType.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          ByNameType.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ByNameType();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.tpe = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          ByNameType.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          ByNameType.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.tpe != null && message.hasOwnProperty("tpe")) {
              let error = $root.scala.meta.internal.semanticdb.Type.verify(message.tpe);
              if (error)
                return "tpe." + error;
            }
            return null;
          };
          ByNameType.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.ByNameType)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.ByNameType();
            if (object.tpe != null) {
              if (typeof object.tpe !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.ByNameType.tpe: object expected");
              message.tpe = $root.scala.meta.internal.semanticdb.Type.fromObject(object.tpe);
            }
            return message;
          };
          ByNameType.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults)
              object.tpe = null;
            if (message.tpe != null && message.hasOwnProperty("tpe"))
              object.tpe = $root.scala.meta.internal.semanticdb.Type.toObject(message.tpe, options);
            return object;
          };
          ByNameType.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          ByNameType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.ByNameType";
          };
          return ByNameType;
        })();
        semanticdb.RepeatedType = (function() {
          function RepeatedType(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          RepeatedType.prototype.tpe = null;
          RepeatedType.create = function create(properties) {
            return new RepeatedType(properties);
          };
          RepeatedType.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.tpe != null && Object.hasOwnProperty.call(message, "tpe"))
              $root.scala.meta.internal.semanticdb.Type.encode(message.tpe, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            return writer;
          };
          RepeatedType.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          RepeatedType.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.RepeatedType();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.tpe = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          RepeatedType.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          RepeatedType.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.tpe != null && message.hasOwnProperty("tpe")) {
              let error = $root.scala.meta.internal.semanticdb.Type.verify(message.tpe);
              if (error)
                return "tpe." + error;
            }
            return null;
          };
          RepeatedType.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.RepeatedType)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.RepeatedType();
            if (object.tpe != null) {
              if (typeof object.tpe !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.RepeatedType.tpe: object expected");
              message.tpe = $root.scala.meta.internal.semanticdb.Type.fromObject(object.tpe);
            }
            return message;
          };
          RepeatedType.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults)
              object.tpe = null;
            if (message.tpe != null && message.hasOwnProperty("tpe"))
              object.tpe = $root.scala.meta.internal.semanticdb.Type.toObject(message.tpe, options);
            return object;
          };
          RepeatedType.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          RepeatedType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.RepeatedType";
          };
          return RepeatedType;
        })();
        semanticdb.MatchType = (function() {
          function MatchType(properties) {
            this.cases = [];
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          MatchType.prototype.scrutinee = null;
          MatchType.prototype.cases = $util.emptyArray;
          MatchType.create = function create(properties) {
            return new MatchType(properties);
          };
          MatchType.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.scrutinee != null && Object.hasOwnProperty.call(message, "scrutinee"))
              $root.scala.meta.internal.semanticdb.Type.encode(message.scrutinee, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message.cases != null && message.cases.length)
              for (let i = 0; i < message.cases.length; ++i)
                $root.scala.meta.internal.semanticdb.MatchType.CaseType.encode(message.cases[i], writer.uint32(
                  /* id 2, wireType 2 =*/
                  18
                ).fork()).ldelim();
            return writer;
          };
          MatchType.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          MatchType.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.MatchType();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.scrutinee = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  if (!(message.cases && message.cases.length))
                    message.cases = [];
                  message.cases.push($root.scala.meta.internal.semanticdb.MatchType.CaseType.decode(reader, reader.uint32()));
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          MatchType.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          MatchType.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.scrutinee != null && message.hasOwnProperty("scrutinee")) {
              let error = $root.scala.meta.internal.semanticdb.Type.verify(message.scrutinee);
              if (error)
                return "scrutinee." + error;
            }
            if (message.cases != null && message.hasOwnProperty("cases")) {
              if (!Array.isArray(message.cases))
                return "cases: array expected";
              for (let i = 0; i < message.cases.length; ++i) {
                let error = $root.scala.meta.internal.semanticdb.MatchType.CaseType.verify(message.cases[i]);
                if (error)
                  return "cases." + error;
              }
            }
            return null;
          };
          MatchType.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.MatchType)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.MatchType();
            if (object.scrutinee != null) {
              if (typeof object.scrutinee !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.MatchType.scrutinee: object expected");
              message.scrutinee = $root.scala.meta.internal.semanticdb.Type.fromObject(object.scrutinee);
            }
            if (object.cases) {
              if (!Array.isArray(object.cases))
                throw TypeError(".scala.meta.internal.semanticdb.MatchType.cases: array expected");
              message.cases = [];
              for (let i = 0; i < object.cases.length; ++i) {
                if (typeof object.cases[i] !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.MatchType.cases: object expected");
                message.cases[i] = $root.scala.meta.internal.semanticdb.MatchType.CaseType.fromObject(object.cases[i]);
              }
            }
            return message;
          };
          MatchType.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.arrays || options.defaults)
              object.cases = [];
            if (options.defaults)
              object.scrutinee = null;
            if (message.scrutinee != null && message.hasOwnProperty("scrutinee"))
              object.scrutinee = $root.scala.meta.internal.semanticdb.Type.toObject(message.scrutinee, options);
            if (message.cases && message.cases.length) {
              object.cases = [];
              for (let j = 0; j < message.cases.length; ++j)
                object.cases[j] = $root.scala.meta.internal.semanticdb.MatchType.CaseType.toObject(message.cases[j], options);
            }
            return object;
          };
          MatchType.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          MatchType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.MatchType";
          };
          MatchType.CaseType = (function() {
            function CaseType(properties) {
              if (properties) {
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                  if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
              }
            }
            CaseType.prototype.key = null;
            CaseType.prototype.body = null;
            CaseType.create = function create(properties) {
              return new CaseType(properties);
            };
            CaseType.encode = function encode(message, writer) {
              if (!writer)
                writer = $Writer.create();
              if (message.key != null && Object.hasOwnProperty.call(message, "key"))
                $root.scala.meta.internal.semanticdb.Type.encode(message.key, writer.uint32(
                  /* id 1, wireType 2 =*/
                  10
                ).fork()).ldelim();
              if (message.body != null && Object.hasOwnProperty.call(message, "body"))
                $root.scala.meta.internal.semanticdb.Type.encode(message.body, writer.uint32(
                  /* id 2, wireType 2 =*/
                  18
                ).fork()).ldelim();
              return writer;
            };
            CaseType.encodeDelimited = function encodeDelimited(message, writer) {
              return this.encode(message, writer).ldelim();
            };
            CaseType.decode = function decode(reader, length, error) {
              if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
              let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.MatchType.CaseType();
              while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                  break;
                switch (tag >>> 3) {
                  case 1: {
                    message.key = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                    break;
                  }
                  case 2: {
                    message.body = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                    break;
                  }
                  default:
                    reader.skipType(tag & 7);
                    break;
                }
              }
              return message;
            };
            CaseType.decodeDelimited = function decodeDelimited(reader) {
              if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
              return this.decode(reader, reader.uint32());
            };
            CaseType.verify = function verify(message) {
              if (typeof message !== "object" || message === null)
                return "object expected";
              if (message.key != null && message.hasOwnProperty("key")) {
                let error = $root.scala.meta.internal.semanticdb.Type.verify(message.key);
                if (error)
                  return "key." + error;
              }
              if (message.body != null && message.hasOwnProperty("body")) {
                let error = $root.scala.meta.internal.semanticdb.Type.verify(message.body);
                if (error)
                  return "body." + error;
              }
              return null;
            };
            CaseType.fromObject = function fromObject(object) {
              if (object instanceof $root.scala.meta.internal.semanticdb.MatchType.CaseType)
                return object;
              let message = new $root.scala.meta.internal.semanticdb.MatchType.CaseType();
              if (object.key != null) {
                if (typeof object.key !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.MatchType.CaseType.key: object expected");
                message.key = $root.scala.meta.internal.semanticdb.Type.fromObject(object.key);
              }
              if (object.body != null) {
                if (typeof object.body !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.MatchType.CaseType.body: object expected");
                message.body = $root.scala.meta.internal.semanticdb.Type.fromObject(object.body);
              }
              return message;
            };
            CaseType.toObject = function toObject(message, options) {
              if (!options)
                options = {};
              let object = {};
              if (options.defaults) {
                object.key = null;
                object.body = null;
              }
              if (message.key != null && message.hasOwnProperty("key"))
                object.key = $root.scala.meta.internal.semanticdb.Type.toObject(message.key, options);
              if (message.body != null && message.hasOwnProperty("body"))
                object.body = $root.scala.meta.internal.semanticdb.Type.toObject(message.body, options);
              return object;
            };
            CaseType.prototype.toJSON = function toJSON() {
              return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };
            CaseType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
              if (typeUrlPrefix === void 0) {
                typeUrlPrefix = "type.googleapis.com";
              }
              return typeUrlPrefix + "/scala.meta.internal.semanticdb.MatchType.CaseType";
            };
            return CaseType;
          })();
          return MatchType;
        })();
        semanticdb.Constant = (function() {
          function Constant(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          Constant.prototype.unitConstant = null;
          Constant.prototype.booleanConstant = null;
          Constant.prototype.byteConstant = null;
          Constant.prototype.shortConstant = null;
          Constant.prototype.charConstant = null;
          Constant.prototype.intConstant = null;
          Constant.prototype.longConstant = null;
          Constant.prototype.floatConstant = null;
          Constant.prototype.doubleConstant = null;
          Constant.prototype.stringConstant = null;
          Constant.prototype.nullConstant = null;
          let $oneOfFields;
          Object.defineProperty(Constant.prototype, "sealedValue", {
            get: $util.oneOfGetter($oneOfFields = ["unitConstant", "booleanConstant", "byteConstant", "shortConstant", "charConstant", "intConstant", "longConstant", "floatConstant", "doubleConstant", "stringConstant", "nullConstant"]),
            set: $util.oneOfSetter($oneOfFields)
          });
          Constant.create = function create(properties) {
            return new Constant(properties);
          };
          Constant.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.unitConstant != null && Object.hasOwnProperty.call(message, "unitConstant"))
              $root.scala.meta.internal.semanticdb.UnitConstant.encode(message.unitConstant, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message.booleanConstant != null && Object.hasOwnProperty.call(message, "booleanConstant"))
              $root.scala.meta.internal.semanticdb.BooleanConstant.encode(message.booleanConstant, writer.uint32(
                /* id 2, wireType 2 =*/
                18
              ).fork()).ldelim();
            if (message.byteConstant != null && Object.hasOwnProperty.call(message, "byteConstant"))
              $root.scala.meta.internal.semanticdb.ByteConstant.encode(message.byteConstant, writer.uint32(
                /* id 3, wireType 2 =*/
                26
              ).fork()).ldelim();
            if (message.shortConstant != null && Object.hasOwnProperty.call(message, "shortConstant"))
              $root.scala.meta.internal.semanticdb.ShortConstant.encode(message.shortConstant, writer.uint32(
                /* id 4, wireType 2 =*/
                34
              ).fork()).ldelim();
            if (message.charConstant != null && Object.hasOwnProperty.call(message, "charConstant"))
              $root.scala.meta.internal.semanticdb.CharConstant.encode(message.charConstant, writer.uint32(
                /* id 5, wireType 2 =*/
                42
              ).fork()).ldelim();
            if (message.intConstant != null && Object.hasOwnProperty.call(message, "intConstant"))
              $root.scala.meta.internal.semanticdb.IntConstant.encode(message.intConstant, writer.uint32(
                /* id 6, wireType 2 =*/
                50
              ).fork()).ldelim();
            if (message.longConstant != null && Object.hasOwnProperty.call(message, "longConstant"))
              $root.scala.meta.internal.semanticdb.LongConstant.encode(message.longConstant, writer.uint32(
                /* id 7, wireType 2 =*/
                58
              ).fork()).ldelim();
            if (message.floatConstant != null && Object.hasOwnProperty.call(message, "floatConstant"))
              $root.scala.meta.internal.semanticdb.FloatConstant.encode(message.floatConstant, writer.uint32(
                /* id 8, wireType 2 =*/
                66
              ).fork()).ldelim();
            if (message.doubleConstant != null && Object.hasOwnProperty.call(message, "doubleConstant"))
              $root.scala.meta.internal.semanticdb.DoubleConstant.encode(message.doubleConstant, writer.uint32(
                /* id 9, wireType 2 =*/
                74
              ).fork()).ldelim();
            if (message.stringConstant != null && Object.hasOwnProperty.call(message, "stringConstant"))
              $root.scala.meta.internal.semanticdb.StringConstant.encode(message.stringConstant, writer.uint32(
                /* id 10, wireType 2 =*/
                82
              ).fork()).ldelim();
            if (message.nullConstant != null && Object.hasOwnProperty.call(message, "nullConstant"))
              $root.scala.meta.internal.semanticdb.NullConstant.encode(message.nullConstant, writer.uint32(
                /* id 11, wireType 2 =*/
                90
              ).fork()).ldelim();
            return writer;
          };
          Constant.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          Constant.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Constant();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.unitConstant = $root.scala.meta.internal.semanticdb.UnitConstant.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  message.booleanConstant = $root.scala.meta.internal.semanticdb.BooleanConstant.decode(reader, reader.uint32());
                  break;
                }
                case 3: {
                  message.byteConstant = $root.scala.meta.internal.semanticdb.ByteConstant.decode(reader, reader.uint32());
                  break;
                }
                case 4: {
                  message.shortConstant = $root.scala.meta.internal.semanticdb.ShortConstant.decode(reader, reader.uint32());
                  break;
                }
                case 5: {
                  message.charConstant = $root.scala.meta.internal.semanticdb.CharConstant.decode(reader, reader.uint32());
                  break;
                }
                case 6: {
                  message.intConstant = $root.scala.meta.internal.semanticdb.IntConstant.decode(reader, reader.uint32());
                  break;
                }
                case 7: {
                  message.longConstant = $root.scala.meta.internal.semanticdb.LongConstant.decode(reader, reader.uint32());
                  break;
                }
                case 8: {
                  message.floatConstant = $root.scala.meta.internal.semanticdb.FloatConstant.decode(reader, reader.uint32());
                  break;
                }
                case 9: {
                  message.doubleConstant = $root.scala.meta.internal.semanticdb.DoubleConstant.decode(reader, reader.uint32());
                  break;
                }
                case 10: {
                  message.stringConstant = $root.scala.meta.internal.semanticdb.StringConstant.decode(reader, reader.uint32());
                  break;
                }
                case 11: {
                  message.nullConstant = $root.scala.meta.internal.semanticdb.NullConstant.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          Constant.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          Constant.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            let properties = {};
            if (message.unitConstant != null && message.hasOwnProperty("unitConstant")) {
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.UnitConstant.verify(message.unitConstant);
                if (error)
                  return "unitConstant." + error;
              }
            }
            if (message.booleanConstant != null && message.hasOwnProperty("booleanConstant")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.BooleanConstant.verify(message.booleanConstant);
                if (error)
                  return "booleanConstant." + error;
              }
            }
            if (message.byteConstant != null && message.hasOwnProperty("byteConstant")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.ByteConstant.verify(message.byteConstant);
                if (error)
                  return "byteConstant." + error;
              }
            }
            if (message.shortConstant != null && message.hasOwnProperty("shortConstant")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.ShortConstant.verify(message.shortConstant);
                if (error)
                  return "shortConstant." + error;
              }
            }
            if (message.charConstant != null && message.hasOwnProperty("charConstant")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.CharConstant.verify(message.charConstant);
                if (error)
                  return "charConstant." + error;
              }
            }
            if (message.intConstant != null && message.hasOwnProperty("intConstant")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.IntConstant.verify(message.intConstant);
                if (error)
                  return "intConstant." + error;
              }
            }
            if (message.longConstant != null && message.hasOwnProperty("longConstant")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.LongConstant.verify(message.longConstant);
                if (error)
                  return "longConstant." + error;
              }
            }
            if (message.floatConstant != null && message.hasOwnProperty("floatConstant")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.FloatConstant.verify(message.floatConstant);
                if (error)
                  return "floatConstant." + error;
              }
            }
            if (message.doubleConstant != null && message.hasOwnProperty("doubleConstant")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.DoubleConstant.verify(message.doubleConstant);
                if (error)
                  return "doubleConstant." + error;
              }
            }
            if (message.stringConstant != null && message.hasOwnProperty("stringConstant")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.StringConstant.verify(message.stringConstant);
                if (error)
                  return "stringConstant." + error;
              }
            }
            if (message.nullConstant != null && message.hasOwnProperty("nullConstant")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.NullConstant.verify(message.nullConstant);
                if (error)
                  return "nullConstant." + error;
              }
            }
            return null;
          };
          Constant.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.Constant)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.Constant();
            if (object.unitConstant != null) {
              if (typeof object.unitConstant !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Constant.unitConstant: object expected");
              message.unitConstant = $root.scala.meta.internal.semanticdb.UnitConstant.fromObject(object.unitConstant);
            }
            if (object.booleanConstant != null) {
              if (typeof object.booleanConstant !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Constant.booleanConstant: object expected");
              message.booleanConstant = $root.scala.meta.internal.semanticdb.BooleanConstant.fromObject(object.booleanConstant);
            }
            if (object.byteConstant != null) {
              if (typeof object.byteConstant !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Constant.byteConstant: object expected");
              message.byteConstant = $root.scala.meta.internal.semanticdb.ByteConstant.fromObject(object.byteConstant);
            }
            if (object.shortConstant != null) {
              if (typeof object.shortConstant !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Constant.shortConstant: object expected");
              message.shortConstant = $root.scala.meta.internal.semanticdb.ShortConstant.fromObject(object.shortConstant);
            }
            if (object.charConstant != null) {
              if (typeof object.charConstant !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Constant.charConstant: object expected");
              message.charConstant = $root.scala.meta.internal.semanticdb.CharConstant.fromObject(object.charConstant);
            }
            if (object.intConstant != null) {
              if (typeof object.intConstant !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Constant.intConstant: object expected");
              message.intConstant = $root.scala.meta.internal.semanticdb.IntConstant.fromObject(object.intConstant);
            }
            if (object.longConstant != null) {
              if (typeof object.longConstant !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Constant.longConstant: object expected");
              message.longConstant = $root.scala.meta.internal.semanticdb.LongConstant.fromObject(object.longConstant);
            }
            if (object.floatConstant != null) {
              if (typeof object.floatConstant !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Constant.floatConstant: object expected");
              message.floatConstant = $root.scala.meta.internal.semanticdb.FloatConstant.fromObject(object.floatConstant);
            }
            if (object.doubleConstant != null) {
              if (typeof object.doubleConstant !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Constant.doubleConstant: object expected");
              message.doubleConstant = $root.scala.meta.internal.semanticdb.DoubleConstant.fromObject(object.doubleConstant);
            }
            if (object.stringConstant != null) {
              if (typeof object.stringConstant !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Constant.stringConstant: object expected");
              message.stringConstant = $root.scala.meta.internal.semanticdb.StringConstant.fromObject(object.stringConstant);
            }
            if (object.nullConstant != null) {
              if (typeof object.nullConstant !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Constant.nullConstant: object expected");
              message.nullConstant = $root.scala.meta.internal.semanticdb.NullConstant.fromObject(object.nullConstant);
            }
            return message;
          };
          Constant.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (message.unitConstant != null && message.hasOwnProperty("unitConstant")) {
              object.unitConstant = $root.scala.meta.internal.semanticdb.UnitConstant.toObject(message.unitConstant, options);
              if (options.oneofs)
                object.sealedValue = "unitConstant";
            }
            if (message.booleanConstant != null && message.hasOwnProperty("booleanConstant")) {
              object.booleanConstant = $root.scala.meta.internal.semanticdb.BooleanConstant.toObject(message.booleanConstant, options);
              if (options.oneofs)
                object.sealedValue = "booleanConstant";
            }
            if (message.byteConstant != null && message.hasOwnProperty("byteConstant")) {
              object.byteConstant = $root.scala.meta.internal.semanticdb.ByteConstant.toObject(message.byteConstant, options);
              if (options.oneofs)
                object.sealedValue = "byteConstant";
            }
            if (message.shortConstant != null && message.hasOwnProperty("shortConstant")) {
              object.shortConstant = $root.scala.meta.internal.semanticdb.ShortConstant.toObject(message.shortConstant, options);
              if (options.oneofs)
                object.sealedValue = "shortConstant";
            }
            if (message.charConstant != null && message.hasOwnProperty("charConstant")) {
              object.charConstant = $root.scala.meta.internal.semanticdb.CharConstant.toObject(message.charConstant, options);
              if (options.oneofs)
                object.sealedValue = "charConstant";
            }
            if (message.intConstant != null && message.hasOwnProperty("intConstant")) {
              object.intConstant = $root.scala.meta.internal.semanticdb.IntConstant.toObject(message.intConstant, options);
              if (options.oneofs)
                object.sealedValue = "intConstant";
            }
            if (message.longConstant != null && message.hasOwnProperty("longConstant")) {
              object.longConstant = $root.scala.meta.internal.semanticdb.LongConstant.toObject(message.longConstant, options);
              if (options.oneofs)
                object.sealedValue = "longConstant";
            }
            if (message.floatConstant != null && message.hasOwnProperty("floatConstant")) {
              object.floatConstant = $root.scala.meta.internal.semanticdb.FloatConstant.toObject(message.floatConstant, options);
              if (options.oneofs)
                object.sealedValue = "floatConstant";
            }
            if (message.doubleConstant != null && message.hasOwnProperty("doubleConstant")) {
              object.doubleConstant = $root.scala.meta.internal.semanticdb.DoubleConstant.toObject(message.doubleConstant, options);
              if (options.oneofs)
                object.sealedValue = "doubleConstant";
            }
            if (message.stringConstant != null && message.hasOwnProperty("stringConstant")) {
              object.stringConstant = $root.scala.meta.internal.semanticdb.StringConstant.toObject(message.stringConstant, options);
              if (options.oneofs)
                object.sealedValue = "stringConstant";
            }
            if (message.nullConstant != null && message.hasOwnProperty("nullConstant")) {
              object.nullConstant = $root.scala.meta.internal.semanticdb.NullConstant.toObject(message.nullConstant, options);
              if (options.oneofs)
                object.sealedValue = "nullConstant";
            }
            return object;
          };
          Constant.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          Constant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.Constant";
          };
          return Constant;
        })();
        semanticdb.UnitConstant = (function() {
          function UnitConstant(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          UnitConstant.create = function create(properties) {
            return new UnitConstant(properties);
          };
          UnitConstant.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            return writer;
          };
          UnitConstant.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          UnitConstant.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.UnitConstant();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          UnitConstant.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          UnitConstant.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            return null;
          };
          UnitConstant.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.UnitConstant)
              return object;
            return new $root.scala.meta.internal.semanticdb.UnitConstant();
          };
          UnitConstant.toObject = function toObject() {
            return {};
          };
          UnitConstant.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          UnitConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.UnitConstant";
          };
          return UnitConstant;
        })();
        semanticdb.BooleanConstant = (function() {
          function BooleanConstant(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          BooleanConstant.prototype.value = false;
          BooleanConstant.create = function create(properties) {
            return new BooleanConstant(properties);
          };
          BooleanConstant.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.value != null && Object.hasOwnProperty.call(message, "value"))
              writer.uint32(
                /* id 1, wireType 0 =*/
                8
              ).bool(message.value);
            return writer;
          };
          BooleanConstant.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          BooleanConstant.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.BooleanConstant();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.value = reader.bool();
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          BooleanConstant.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          BooleanConstant.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.value != null && message.hasOwnProperty("value")) {
              if (typeof message.value !== "boolean")
                return "value: boolean expected";
            }
            return null;
          };
          BooleanConstant.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.BooleanConstant)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.BooleanConstant();
            if (object.value != null)
              message.value = Boolean(object.value);
            return message;
          };
          BooleanConstant.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults)
              object.value = false;
            if (message.value != null && message.hasOwnProperty("value"))
              object.value = message.value;
            return object;
          };
          BooleanConstant.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          BooleanConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.BooleanConstant";
          };
          return BooleanConstant;
        })();
        semanticdb.ByteConstant = (function() {
          function ByteConstant(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          ByteConstant.prototype.value = 0;
          ByteConstant.create = function create(properties) {
            return new ByteConstant(properties);
          };
          ByteConstant.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.value != null && Object.hasOwnProperty.call(message, "value"))
              writer.uint32(
                /* id 1, wireType 0 =*/
                8
              ).int32(message.value);
            return writer;
          };
          ByteConstant.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          ByteConstant.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ByteConstant();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.value = reader.int32();
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          ByteConstant.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          ByteConstant.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.value != null && message.hasOwnProperty("value")) {
              if (!$util.isInteger(message.value))
                return "value: integer expected";
            }
            return null;
          };
          ByteConstant.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.ByteConstant)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.ByteConstant();
            if (object.value != null)
              message.value = object.value | 0;
            return message;
          };
          ByteConstant.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults)
              object.value = 0;
            if (message.value != null && message.hasOwnProperty("value"))
              object.value = message.value;
            return object;
          };
          ByteConstant.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          ByteConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.ByteConstant";
          };
          return ByteConstant;
        })();
        semanticdb.ShortConstant = (function() {
          function ShortConstant(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          ShortConstant.prototype.value = 0;
          ShortConstant.create = function create(properties) {
            return new ShortConstant(properties);
          };
          ShortConstant.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.value != null && Object.hasOwnProperty.call(message, "value"))
              writer.uint32(
                /* id 1, wireType 0 =*/
                8
              ).int32(message.value);
            return writer;
          };
          ShortConstant.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          ShortConstant.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ShortConstant();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.value = reader.int32();
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          ShortConstant.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          ShortConstant.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.value != null && message.hasOwnProperty("value")) {
              if (!$util.isInteger(message.value))
                return "value: integer expected";
            }
            return null;
          };
          ShortConstant.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.ShortConstant)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.ShortConstant();
            if (object.value != null)
              message.value = object.value | 0;
            return message;
          };
          ShortConstant.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults)
              object.value = 0;
            if (message.value != null && message.hasOwnProperty("value"))
              object.value = message.value;
            return object;
          };
          ShortConstant.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          ShortConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.ShortConstant";
          };
          return ShortConstant;
        })();
        semanticdb.CharConstant = (function() {
          function CharConstant(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          CharConstant.prototype.value = 0;
          CharConstant.create = function create(properties) {
            return new CharConstant(properties);
          };
          CharConstant.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.value != null && Object.hasOwnProperty.call(message, "value"))
              writer.uint32(
                /* id 1, wireType 0 =*/
                8
              ).int32(message.value);
            return writer;
          };
          CharConstant.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          CharConstant.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.CharConstant();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.value = reader.int32();
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          CharConstant.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          CharConstant.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.value != null && message.hasOwnProperty("value")) {
              if (!$util.isInteger(message.value))
                return "value: integer expected";
            }
            return null;
          };
          CharConstant.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.CharConstant)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.CharConstant();
            if (object.value != null)
              message.value = object.value | 0;
            return message;
          };
          CharConstant.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults)
              object.value = 0;
            if (message.value != null && message.hasOwnProperty("value"))
              object.value = message.value;
            return object;
          };
          CharConstant.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          CharConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.CharConstant";
          };
          return CharConstant;
        })();
        semanticdb.IntConstant = (function() {
          function IntConstant(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          IntConstant.prototype.value = 0;
          IntConstant.create = function create(properties) {
            return new IntConstant(properties);
          };
          IntConstant.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.value != null && Object.hasOwnProperty.call(message, "value"))
              writer.uint32(
                /* id 1, wireType 0 =*/
                8
              ).int32(message.value);
            return writer;
          };
          IntConstant.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          IntConstant.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.IntConstant();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.value = reader.int32();
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          IntConstant.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          IntConstant.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.value != null && message.hasOwnProperty("value")) {
              if (!$util.isInteger(message.value))
                return "value: integer expected";
            }
            return null;
          };
          IntConstant.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.IntConstant)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.IntConstant();
            if (object.value != null)
              message.value = object.value | 0;
            return message;
          };
          IntConstant.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults)
              object.value = 0;
            if (message.value != null && message.hasOwnProperty("value"))
              object.value = message.value;
            return object;
          };
          IntConstant.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          IntConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.IntConstant";
          };
          return IntConstant;
        })();
        semanticdb.LongConstant = (function() {
          function LongConstant(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          LongConstant.prototype.value = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;
          LongConstant.create = function create(properties) {
            return new LongConstant(properties);
          };
          LongConstant.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.value != null && Object.hasOwnProperty.call(message, "value"))
              writer.uint32(
                /* id 1, wireType 0 =*/
                8
              ).int64(message.value);
            return writer;
          };
          LongConstant.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          LongConstant.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.LongConstant();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.value = reader.int64();
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          LongConstant.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          LongConstant.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.value != null && message.hasOwnProperty("value")) {
              if (!$util.isInteger(message.value) && !(message.value && $util.isInteger(message.value.low) && $util.isInteger(message.value.high)))
                return "value: integer|Long expected";
            }
            return null;
          };
          LongConstant.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.LongConstant)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.LongConstant();
            if (object.value != null) {
              if ($util.Long)
                (message.value = $util.Long.fromValue(object.value)).unsigned = false;
              else if (typeof object.value === "string")
                message.value = parseInt(object.value, 10);
              else if (typeof object.value === "number")
                message.value = object.value;
              else if (typeof object.value === "object")
                message.value = new $util.LongBits(object.value.low >>> 0, object.value.high >>> 0).toNumber();
            }
            return message;
          };
          LongConstant.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults)
              if ($util.Long) {
                let long = new $util.Long(0, 0, false);
                object.value = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
              } else
                object.value = options.longs === String ? "0" : 0;
            if (message.value != null && message.hasOwnProperty("value"))
              if (typeof message.value === "number")
                object.value = options.longs === String ? String(message.value) : message.value;
              else
                object.value = options.longs === String ? $util.Long.prototype.toString.call(message.value) : options.longs === Number ? new $util.LongBits(message.value.low >>> 0, message.value.high >>> 0).toNumber() : message.value;
            return object;
          };
          LongConstant.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          LongConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.LongConstant";
          };
          return LongConstant;
        })();
        semanticdb.FloatConstant = (function() {
          function FloatConstant(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          FloatConstant.prototype.value = 0;
          FloatConstant.create = function create(properties) {
            return new FloatConstant(properties);
          };
          FloatConstant.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.value != null && Object.hasOwnProperty.call(message, "value"))
              writer.uint32(
                /* id 1, wireType 5 =*/
                13
              ).float(message.value);
            return writer;
          };
          FloatConstant.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          FloatConstant.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.FloatConstant();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.value = reader.float();
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          FloatConstant.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          FloatConstant.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.value != null && message.hasOwnProperty("value")) {
              if (typeof message.value !== "number")
                return "value: number expected";
            }
            return null;
          };
          FloatConstant.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.FloatConstant)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.FloatConstant();
            if (object.value != null)
              message.value = Number(object.value);
            return message;
          };
          FloatConstant.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults)
              object.value = 0;
            if (message.value != null && message.hasOwnProperty("value"))
              object.value = options.json && !isFinite(message.value) ? String(message.value) : message.value;
            return object;
          };
          FloatConstant.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          FloatConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.FloatConstant";
          };
          return FloatConstant;
        })();
        semanticdb.DoubleConstant = (function() {
          function DoubleConstant(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          DoubleConstant.prototype.value = 0;
          DoubleConstant.create = function create(properties) {
            return new DoubleConstant(properties);
          };
          DoubleConstant.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.value != null && Object.hasOwnProperty.call(message, "value"))
              writer.uint32(
                /* id 1, wireType 1 =*/
                9
              ).double(message.value);
            return writer;
          };
          DoubleConstant.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          DoubleConstant.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.DoubleConstant();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.value = reader.double();
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          DoubleConstant.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          DoubleConstant.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.value != null && message.hasOwnProperty("value")) {
              if (typeof message.value !== "number")
                return "value: number expected";
            }
            return null;
          };
          DoubleConstant.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.DoubleConstant)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.DoubleConstant();
            if (object.value != null)
              message.value = Number(object.value);
            return message;
          };
          DoubleConstant.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults)
              object.value = 0;
            if (message.value != null && message.hasOwnProperty("value"))
              object.value = options.json && !isFinite(message.value) ? String(message.value) : message.value;
            return object;
          };
          DoubleConstant.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          DoubleConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.DoubleConstant";
          };
          return DoubleConstant;
        })();
        semanticdb.StringConstant = (function() {
          function StringConstant(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          StringConstant.prototype.value = "";
          StringConstant.create = function create(properties) {
            return new StringConstant(properties);
          };
          StringConstant.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.value != null && Object.hasOwnProperty.call(message, "value"))
              writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).string(message.value);
            return writer;
          };
          StringConstant.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          StringConstant.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.StringConstant();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.value = reader.string();
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          StringConstant.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          StringConstant.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.value != null && message.hasOwnProperty("value")) {
              if (!$util.isString(message.value))
                return "value: string expected";
            }
            return null;
          };
          StringConstant.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.StringConstant)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.StringConstant();
            if (object.value != null)
              message.value = String(object.value);
            return message;
          };
          StringConstant.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults)
              object.value = "";
            if (message.value != null && message.hasOwnProperty("value"))
              object.value = message.value;
            return object;
          };
          StringConstant.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          StringConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.StringConstant";
          };
          return StringConstant;
        })();
        semanticdb.NullConstant = (function() {
          function NullConstant(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          NullConstant.create = function create(properties) {
            return new NullConstant(properties);
          };
          NullConstant.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            return writer;
          };
          NullConstant.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          NullConstant.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.NullConstant();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          NullConstant.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          NullConstant.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            return null;
          };
          NullConstant.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.NullConstant)
              return object;
            return new $root.scala.meta.internal.semanticdb.NullConstant();
          };
          NullConstant.toObject = function toObject() {
            return {};
          };
          NullConstant.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          NullConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.NullConstant";
          };
          return NullConstant;
        })();
        semanticdb.Signature = (function() {
          function Signature(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          Signature.prototype.classSignature = null;
          Signature.prototype.methodSignature = null;
          Signature.prototype.typeSignature = null;
          Signature.prototype.valueSignature = null;
          let $oneOfFields;
          Object.defineProperty(Signature.prototype, "sealedValue", {
            get: $util.oneOfGetter($oneOfFields = ["classSignature", "methodSignature", "typeSignature", "valueSignature"]),
            set: $util.oneOfSetter($oneOfFields)
          });
          Signature.create = function create(properties) {
            return new Signature(properties);
          };
          Signature.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.classSignature != null && Object.hasOwnProperty.call(message, "classSignature"))
              $root.scala.meta.internal.semanticdb.ClassSignature.encode(message.classSignature, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message.methodSignature != null && Object.hasOwnProperty.call(message, "methodSignature"))
              $root.scala.meta.internal.semanticdb.MethodSignature.encode(message.methodSignature, writer.uint32(
                /* id 2, wireType 2 =*/
                18
              ).fork()).ldelim();
            if (message.typeSignature != null && Object.hasOwnProperty.call(message, "typeSignature"))
              $root.scala.meta.internal.semanticdb.TypeSignature.encode(message.typeSignature, writer.uint32(
                /* id 3, wireType 2 =*/
                26
              ).fork()).ldelim();
            if (message.valueSignature != null && Object.hasOwnProperty.call(message, "valueSignature"))
              $root.scala.meta.internal.semanticdb.ValueSignature.encode(message.valueSignature, writer.uint32(
                /* id 4, wireType 2 =*/
                34
              ).fork()).ldelim();
            return writer;
          };
          Signature.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          Signature.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Signature();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.classSignature = $root.scala.meta.internal.semanticdb.ClassSignature.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  message.methodSignature = $root.scala.meta.internal.semanticdb.MethodSignature.decode(reader, reader.uint32());
                  break;
                }
                case 3: {
                  message.typeSignature = $root.scala.meta.internal.semanticdb.TypeSignature.decode(reader, reader.uint32());
                  break;
                }
                case 4: {
                  message.valueSignature = $root.scala.meta.internal.semanticdb.ValueSignature.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          Signature.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          Signature.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            let properties = {};
            if (message.classSignature != null && message.hasOwnProperty("classSignature")) {
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.ClassSignature.verify(message.classSignature);
                if (error)
                  return "classSignature." + error;
              }
            }
            if (message.methodSignature != null && message.hasOwnProperty("methodSignature")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.MethodSignature.verify(message.methodSignature);
                if (error)
                  return "methodSignature." + error;
              }
            }
            if (message.typeSignature != null && message.hasOwnProperty("typeSignature")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.TypeSignature.verify(message.typeSignature);
                if (error)
                  return "typeSignature." + error;
              }
            }
            if (message.valueSignature != null && message.hasOwnProperty("valueSignature")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.ValueSignature.verify(message.valueSignature);
                if (error)
                  return "valueSignature." + error;
              }
            }
            return null;
          };
          Signature.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.Signature)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.Signature();
            if (object.classSignature != null) {
              if (typeof object.classSignature !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Signature.classSignature: object expected");
              message.classSignature = $root.scala.meta.internal.semanticdb.ClassSignature.fromObject(object.classSignature);
            }
            if (object.methodSignature != null) {
              if (typeof object.methodSignature !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Signature.methodSignature: object expected");
              message.methodSignature = $root.scala.meta.internal.semanticdb.MethodSignature.fromObject(object.methodSignature);
            }
            if (object.typeSignature != null) {
              if (typeof object.typeSignature !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Signature.typeSignature: object expected");
              message.typeSignature = $root.scala.meta.internal.semanticdb.TypeSignature.fromObject(object.typeSignature);
            }
            if (object.valueSignature != null) {
              if (typeof object.valueSignature !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Signature.valueSignature: object expected");
              message.valueSignature = $root.scala.meta.internal.semanticdb.ValueSignature.fromObject(object.valueSignature);
            }
            return message;
          };
          Signature.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (message.classSignature != null && message.hasOwnProperty("classSignature")) {
              object.classSignature = $root.scala.meta.internal.semanticdb.ClassSignature.toObject(message.classSignature, options);
              if (options.oneofs)
                object.sealedValue = "classSignature";
            }
            if (message.methodSignature != null && message.hasOwnProperty("methodSignature")) {
              object.methodSignature = $root.scala.meta.internal.semanticdb.MethodSignature.toObject(message.methodSignature, options);
              if (options.oneofs)
                object.sealedValue = "methodSignature";
            }
            if (message.typeSignature != null && message.hasOwnProperty("typeSignature")) {
              object.typeSignature = $root.scala.meta.internal.semanticdb.TypeSignature.toObject(message.typeSignature, options);
              if (options.oneofs)
                object.sealedValue = "typeSignature";
            }
            if (message.valueSignature != null && message.hasOwnProperty("valueSignature")) {
              object.valueSignature = $root.scala.meta.internal.semanticdb.ValueSignature.toObject(message.valueSignature, options);
              if (options.oneofs)
                object.sealedValue = "valueSignature";
            }
            return object;
          };
          Signature.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          Signature.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.Signature";
          };
          return Signature;
        })();
        semanticdb.ClassSignature = (function() {
          function ClassSignature(properties) {
            this.parents = [];
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          ClassSignature.prototype.typeParameters = null;
          ClassSignature.prototype.parents = $util.emptyArray;
          ClassSignature.prototype.self = null;
          ClassSignature.prototype.declarations = null;
          ClassSignature.create = function create(properties) {
            return new ClassSignature(properties);
          };
          ClassSignature.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.typeParameters != null && Object.hasOwnProperty.call(message, "typeParameters"))
              $root.scala.meta.internal.semanticdb.Scope.encode(message.typeParameters, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message.parents != null && message.parents.length)
              for (let i = 0; i < message.parents.length; ++i)
                $root.scala.meta.internal.semanticdb.Type.encode(message.parents[i], writer.uint32(
                  /* id 2, wireType 2 =*/
                  18
                ).fork()).ldelim();
            if (message.self != null && Object.hasOwnProperty.call(message, "self"))
              $root.scala.meta.internal.semanticdb.Type.encode(message.self, writer.uint32(
                /* id 3, wireType 2 =*/
                26
              ).fork()).ldelim();
            if (message.declarations != null && Object.hasOwnProperty.call(message, "declarations"))
              $root.scala.meta.internal.semanticdb.Scope.encode(message.declarations, writer.uint32(
                /* id 4, wireType 2 =*/
                34
              ).fork()).ldelim();
            return writer;
          };
          ClassSignature.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          ClassSignature.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ClassSignature();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.typeParameters = $root.scala.meta.internal.semanticdb.Scope.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  if (!(message.parents && message.parents.length))
                    message.parents = [];
                  message.parents.push($root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32()));
                  break;
                }
                case 3: {
                  message.self = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                  break;
                }
                case 4: {
                  message.declarations = $root.scala.meta.internal.semanticdb.Scope.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          ClassSignature.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          ClassSignature.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.typeParameters != null && message.hasOwnProperty("typeParameters")) {
              let error = $root.scala.meta.internal.semanticdb.Scope.verify(message.typeParameters);
              if (error)
                return "typeParameters." + error;
            }
            if (message.parents != null && message.hasOwnProperty("parents")) {
              if (!Array.isArray(message.parents))
                return "parents: array expected";
              for (let i = 0; i < message.parents.length; ++i) {
                let error = $root.scala.meta.internal.semanticdb.Type.verify(message.parents[i]);
                if (error)
                  return "parents." + error;
              }
            }
            if (message.self != null && message.hasOwnProperty("self")) {
              let error = $root.scala.meta.internal.semanticdb.Type.verify(message.self);
              if (error)
                return "self." + error;
            }
            if (message.declarations != null && message.hasOwnProperty("declarations")) {
              let error = $root.scala.meta.internal.semanticdb.Scope.verify(message.declarations);
              if (error)
                return "declarations." + error;
            }
            return null;
          };
          ClassSignature.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.ClassSignature)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.ClassSignature();
            if (object.typeParameters != null) {
              if (typeof object.typeParameters !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.ClassSignature.typeParameters: object expected");
              message.typeParameters = $root.scala.meta.internal.semanticdb.Scope.fromObject(object.typeParameters);
            }
            if (object.parents) {
              if (!Array.isArray(object.parents))
                throw TypeError(".scala.meta.internal.semanticdb.ClassSignature.parents: array expected");
              message.parents = [];
              for (let i = 0; i < object.parents.length; ++i) {
                if (typeof object.parents[i] !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.ClassSignature.parents: object expected");
                message.parents[i] = $root.scala.meta.internal.semanticdb.Type.fromObject(object.parents[i]);
              }
            }
            if (object.self != null) {
              if (typeof object.self !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.ClassSignature.self: object expected");
              message.self = $root.scala.meta.internal.semanticdb.Type.fromObject(object.self);
            }
            if (object.declarations != null) {
              if (typeof object.declarations !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.ClassSignature.declarations: object expected");
              message.declarations = $root.scala.meta.internal.semanticdb.Scope.fromObject(object.declarations);
            }
            return message;
          };
          ClassSignature.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.arrays || options.defaults)
              object.parents = [];
            if (options.defaults) {
              object.typeParameters = null;
              object.self = null;
              object.declarations = null;
            }
            if (message.typeParameters != null && message.hasOwnProperty("typeParameters"))
              object.typeParameters = $root.scala.meta.internal.semanticdb.Scope.toObject(message.typeParameters, options);
            if (message.parents && message.parents.length) {
              object.parents = [];
              for (let j = 0; j < message.parents.length; ++j)
                object.parents[j] = $root.scala.meta.internal.semanticdb.Type.toObject(message.parents[j], options);
            }
            if (message.self != null && message.hasOwnProperty("self"))
              object.self = $root.scala.meta.internal.semanticdb.Type.toObject(message.self, options);
            if (message.declarations != null && message.hasOwnProperty("declarations"))
              object.declarations = $root.scala.meta.internal.semanticdb.Scope.toObject(message.declarations, options);
            return object;
          };
          ClassSignature.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          ClassSignature.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.ClassSignature";
          };
          return ClassSignature;
        })();
        semanticdb.MethodSignature = (function() {
          function MethodSignature(properties) {
            this.parameterLists = [];
            this.throws = [];
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          MethodSignature.prototype.typeParameters = null;
          MethodSignature.prototype.parameterLists = $util.emptyArray;
          MethodSignature.prototype.returnType = null;
          MethodSignature.prototype.throws = $util.emptyArray;
          MethodSignature.create = function create(properties) {
            return new MethodSignature(properties);
          };
          MethodSignature.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.typeParameters != null && Object.hasOwnProperty.call(message, "typeParameters"))
              $root.scala.meta.internal.semanticdb.Scope.encode(message.typeParameters, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message.parameterLists != null && message.parameterLists.length)
              for (let i = 0; i < message.parameterLists.length; ++i)
                $root.scala.meta.internal.semanticdb.Scope.encode(message.parameterLists[i], writer.uint32(
                  /* id 2, wireType 2 =*/
                  18
                ).fork()).ldelim();
            if (message.returnType != null && Object.hasOwnProperty.call(message, "returnType"))
              $root.scala.meta.internal.semanticdb.Type.encode(message.returnType, writer.uint32(
                /* id 3, wireType 2 =*/
                26
              ).fork()).ldelim();
            if (message.throws != null && message.throws.length)
              for (let i = 0; i < message.throws.length; ++i)
                $root.scala.meta.internal.semanticdb.Type.encode(message.throws[i], writer.uint32(
                  /* id 4, wireType 2 =*/
                  34
                ).fork()).ldelim();
            return writer;
          };
          MethodSignature.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          MethodSignature.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.MethodSignature();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.typeParameters = $root.scala.meta.internal.semanticdb.Scope.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  if (!(message.parameterLists && message.parameterLists.length))
                    message.parameterLists = [];
                  message.parameterLists.push($root.scala.meta.internal.semanticdb.Scope.decode(reader, reader.uint32()));
                  break;
                }
                case 3: {
                  message.returnType = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                  break;
                }
                case 4: {
                  if (!(message.throws && message.throws.length))
                    message.throws = [];
                  message.throws.push($root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32()));
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          MethodSignature.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          MethodSignature.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.typeParameters != null && message.hasOwnProperty("typeParameters")) {
              let error = $root.scala.meta.internal.semanticdb.Scope.verify(message.typeParameters);
              if (error)
                return "typeParameters." + error;
            }
            if (message.parameterLists != null && message.hasOwnProperty("parameterLists")) {
              if (!Array.isArray(message.parameterLists))
                return "parameterLists: array expected";
              for (let i = 0; i < message.parameterLists.length; ++i) {
                let error = $root.scala.meta.internal.semanticdb.Scope.verify(message.parameterLists[i]);
                if (error)
                  return "parameterLists." + error;
              }
            }
            if (message.returnType != null && message.hasOwnProperty("returnType")) {
              let error = $root.scala.meta.internal.semanticdb.Type.verify(message.returnType);
              if (error)
                return "returnType." + error;
            }
            if (message.throws != null && message.hasOwnProperty("throws")) {
              if (!Array.isArray(message.throws))
                return "throws: array expected";
              for (let i = 0; i < message.throws.length; ++i) {
                let error = $root.scala.meta.internal.semanticdb.Type.verify(message.throws[i]);
                if (error)
                  return "throws." + error;
              }
            }
            return null;
          };
          MethodSignature.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.MethodSignature)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.MethodSignature();
            if (object.typeParameters != null) {
              if (typeof object.typeParameters !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.MethodSignature.typeParameters: object expected");
              message.typeParameters = $root.scala.meta.internal.semanticdb.Scope.fromObject(object.typeParameters);
            }
            if (object.parameterLists) {
              if (!Array.isArray(object.parameterLists))
                throw TypeError(".scala.meta.internal.semanticdb.MethodSignature.parameterLists: array expected");
              message.parameterLists = [];
              for (let i = 0; i < object.parameterLists.length; ++i) {
                if (typeof object.parameterLists[i] !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.MethodSignature.parameterLists: object expected");
                message.parameterLists[i] = $root.scala.meta.internal.semanticdb.Scope.fromObject(object.parameterLists[i]);
              }
            }
            if (object.returnType != null) {
              if (typeof object.returnType !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.MethodSignature.returnType: object expected");
              message.returnType = $root.scala.meta.internal.semanticdb.Type.fromObject(object.returnType);
            }
            if (object.throws) {
              if (!Array.isArray(object.throws))
                throw TypeError(".scala.meta.internal.semanticdb.MethodSignature.throws: array expected");
              message.throws = [];
              for (let i = 0; i < object.throws.length; ++i) {
                if (typeof object.throws[i] !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.MethodSignature.throws: object expected");
                message.throws[i] = $root.scala.meta.internal.semanticdb.Type.fromObject(object.throws[i]);
              }
            }
            return message;
          };
          MethodSignature.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.arrays || options.defaults) {
              object.parameterLists = [];
              object.throws = [];
            }
            if (options.defaults) {
              object.typeParameters = null;
              object.returnType = null;
            }
            if (message.typeParameters != null && message.hasOwnProperty("typeParameters"))
              object.typeParameters = $root.scala.meta.internal.semanticdb.Scope.toObject(message.typeParameters, options);
            if (message.parameterLists && message.parameterLists.length) {
              object.parameterLists = [];
              for (let j = 0; j < message.parameterLists.length; ++j)
                object.parameterLists[j] = $root.scala.meta.internal.semanticdb.Scope.toObject(message.parameterLists[j], options);
            }
            if (message.returnType != null && message.hasOwnProperty("returnType"))
              object.returnType = $root.scala.meta.internal.semanticdb.Type.toObject(message.returnType, options);
            if (message.throws && message.throws.length) {
              object.throws = [];
              for (let j = 0; j < message.throws.length; ++j)
                object.throws[j] = $root.scala.meta.internal.semanticdb.Type.toObject(message.throws[j], options);
            }
            return object;
          };
          MethodSignature.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          MethodSignature.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.MethodSignature";
          };
          return MethodSignature;
        })();
        semanticdb.TypeSignature = (function() {
          function TypeSignature(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          TypeSignature.prototype.typeParameters = null;
          TypeSignature.prototype.lowerBound = null;
          TypeSignature.prototype.upperBound = null;
          TypeSignature.create = function create(properties) {
            return new TypeSignature(properties);
          };
          TypeSignature.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.typeParameters != null && Object.hasOwnProperty.call(message, "typeParameters"))
              $root.scala.meta.internal.semanticdb.Scope.encode(message.typeParameters, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message.lowerBound != null && Object.hasOwnProperty.call(message, "lowerBound"))
              $root.scala.meta.internal.semanticdb.Type.encode(message.lowerBound, writer.uint32(
                /* id 2, wireType 2 =*/
                18
              ).fork()).ldelim();
            if (message.upperBound != null && Object.hasOwnProperty.call(message, "upperBound"))
              $root.scala.meta.internal.semanticdb.Type.encode(message.upperBound, writer.uint32(
                /* id 3, wireType 2 =*/
                26
              ).fork()).ldelim();
            return writer;
          };
          TypeSignature.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          TypeSignature.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.TypeSignature();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.typeParameters = $root.scala.meta.internal.semanticdb.Scope.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  message.lowerBound = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                  break;
                }
                case 3: {
                  message.upperBound = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          TypeSignature.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          TypeSignature.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.typeParameters != null && message.hasOwnProperty("typeParameters")) {
              let error = $root.scala.meta.internal.semanticdb.Scope.verify(message.typeParameters);
              if (error)
                return "typeParameters." + error;
            }
            if (message.lowerBound != null && message.hasOwnProperty("lowerBound")) {
              let error = $root.scala.meta.internal.semanticdb.Type.verify(message.lowerBound);
              if (error)
                return "lowerBound." + error;
            }
            if (message.upperBound != null && message.hasOwnProperty("upperBound")) {
              let error = $root.scala.meta.internal.semanticdb.Type.verify(message.upperBound);
              if (error)
                return "upperBound." + error;
            }
            return null;
          };
          TypeSignature.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.TypeSignature)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.TypeSignature();
            if (object.typeParameters != null) {
              if (typeof object.typeParameters !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.TypeSignature.typeParameters: object expected");
              message.typeParameters = $root.scala.meta.internal.semanticdb.Scope.fromObject(object.typeParameters);
            }
            if (object.lowerBound != null) {
              if (typeof object.lowerBound !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.TypeSignature.lowerBound: object expected");
              message.lowerBound = $root.scala.meta.internal.semanticdb.Type.fromObject(object.lowerBound);
            }
            if (object.upperBound != null) {
              if (typeof object.upperBound !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.TypeSignature.upperBound: object expected");
              message.upperBound = $root.scala.meta.internal.semanticdb.Type.fromObject(object.upperBound);
            }
            return message;
          };
          TypeSignature.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults) {
              object.typeParameters = null;
              object.lowerBound = null;
              object.upperBound = null;
            }
            if (message.typeParameters != null && message.hasOwnProperty("typeParameters"))
              object.typeParameters = $root.scala.meta.internal.semanticdb.Scope.toObject(message.typeParameters, options);
            if (message.lowerBound != null && message.hasOwnProperty("lowerBound"))
              object.lowerBound = $root.scala.meta.internal.semanticdb.Type.toObject(message.lowerBound, options);
            if (message.upperBound != null && message.hasOwnProperty("upperBound"))
              object.upperBound = $root.scala.meta.internal.semanticdb.Type.toObject(message.upperBound, options);
            return object;
          };
          TypeSignature.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          TypeSignature.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.TypeSignature";
          };
          return TypeSignature;
        })();
        semanticdb.ValueSignature = (function() {
          function ValueSignature(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          ValueSignature.prototype.tpe = null;
          ValueSignature.create = function create(properties) {
            return new ValueSignature(properties);
          };
          ValueSignature.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.tpe != null && Object.hasOwnProperty.call(message, "tpe"))
              $root.scala.meta.internal.semanticdb.Type.encode(message.tpe, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            return writer;
          };
          ValueSignature.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          ValueSignature.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ValueSignature();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.tpe = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          ValueSignature.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          ValueSignature.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.tpe != null && message.hasOwnProperty("tpe")) {
              let error = $root.scala.meta.internal.semanticdb.Type.verify(message.tpe);
              if (error)
                return "tpe." + error;
            }
            return null;
          };
          ValueSignature.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.ValueSignature)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.ValueSignature();
            if (object.tpe != null) {
              if (typeof object.tpe !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.ValueSignature.tpe: object expected");
              message.tpe = $root.scala.meta.internal.semanticdb.Type.fromObject(object.tpe);
            }
            return message;
          };
          ValueSignature.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults)
              object.tpe = null;
            if (message.tpe != null && message.hasOwnProperty("tpe"))
              object.tpe = $root.scala.meta.internal.semanticdb.Type.toObject(message.tpe, options);
            return object;
          };
          ValueSignature.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          ValueSignature.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.ValueSignature";
          };
          return ValueSignature;
        })();
        semanticdb.SymbolInformation = (function() {
          function SymbolInformation(properties) {
            this.annotations = [];
            this.overriddenSymbols = [];
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          SymbolInformation.prototype.symbol = "";
          SymbolInformation.prototype.language = 0;
          SymbolInformation.prototype.kind = 0;
          SymbolInformation.prototype.properties = 0;
          SymbolInformation.prototype.displayName = "";
          SymbolInformation.prototype.signature = null;
          SymbolInformation.prototype.annotations = $util.emptyArray;
          SymbolInformation.prototype.access = null;
          SymbolInformation.prototype.overriddenSymbols = $util.emptyArray;
          SymbolInformation.prototype.documentation = null;
          SymbolInformation.create = function create(properties) {
            return new SymbolInformation(properties);
          };
          SymbolInformation.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.symbol != null && Object.hasOwnProperty.call(message, "symbol"))
              writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).string(message.symbol);
            if (message.kind != null && Object.hasOwnProperty.call(message, "kind"))
              writer.uint32(
                /* id 3, wireType 0 =*/
                24
              ).int32(message.kind);
            if (message.properties != null && Object.hasOwnProperty.call(message, "properties"))
              writer.uint32(
                /* id 4, wireType 0 =*/
                32
              ).int32(message.properties);
            if (message.displayName != null && Object.hasOwnProperty.call(message, "displayName"))
              writer.uint32(
                /* id 5, wireType 2 =*/
                42
              ).string(message.displayName);
            if (message.annotations != null && message.annotations.length)
              for (let i = 0; i < message.annotations.length; ++i)
                $root.scala.meta.internal.semanticdb.AnnotationTree.encode(message.annotations[i], writer.uint32(
                  /* id 13, wireType 2 =*/
                  106
                ).fork()).ldelim();
            if (message.language != null && Object.hasOwnProperty.call(message, "language"))
              writer.uint32(
                /* id 16, wireType 0 =*/
                128
              ).int32(message.language);
            if (message.signature != null && Object.hasOwnProperty.call(message, "signature"))
              $root.scala.meta.internal.semanticdb.Signature.encode(message.signature, writer.uint32(
                /* id 17, wireType 2 =*/
                138
              ).fork()).ldelim();
            if (message.access != null && Object.hasOwnProperty.call(message, "access"))
              $root.scala.meta.internal.semanticdb.Access.encode(message.access, writer.uint32(
                /* id 18, wireType 2 =*/
                146
              ).fork()).ldelim();
            if (message.overriddenSymbols != null && message.overriddenSymbols.length)
              for (let i = 0; i < message.overriddenSymbols.length; ++i)
                writer.uint32(
                  /* id 19, wireType 2 =*/
                  154
                ).string(message.overriddenSymbols[i]);
            if (message.documentation != null && Object.hasOwnProperty.call(message, "documentation"))
              $root.scala.meta.internal.semanticdb.Documentation.encode(message.documentation, writer.uint32(
                /* id 20, wireType 2 =*/
                162
              ).fork()).ldelim();
            return writer;
          };
          SymbolInformation.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          SymbolInformation.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.SymbolInformation();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.symbol = reader.string();
                  break;
                }
                case 16: {
                  message.language = reader.int32();
                  break;
                }
                case 3: {
                  message.kind = reader.int32();
                  break;
                }
                case 4: {
                  message.properties = reader.int32();
                  break;
                }
                case 5: {
                  message.displayName = reader.string();
                  break;
                }
                case 17: {
                  message.signature = $root.scala.meta.internal.semanticdb.Signature.decode(reader, reader.uint32());
                  break;
                }
                case 13: {
                  if (!(message.annotations && message.annotations.length))
                    message.annotations = [];
                  message.annotations.push($root.scala.meta.internal.semanticdb.AnnotationTree.decode(reader, reader.uint32()));
                  break;
                }
                case 18: {
                  message.access = $root.scala.meta.internal.semanticdb.Access.decode(reader, reader.uint32());
                  break;
                }
                case 19: {
                  if (!(message.overriddenSymbols && message.overriddenSymbols.length))
                    message.overriddenSymbols = [];
                  message.overriddenSymbols.push(reader.string());
                  break;
                }
                case 20: {
                  message.documentation = $root.scala.meta.internal.semanticdb.Documentation.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          SymbolInformation.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          SymbolInformation.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.symbol != null && message.hasOwnProperty("symbol")) {
              if (!$util.isString(message.symbol))
                return "symbol: string expected";
            }
            if (message.language != null && message.hasOwnProperty("language"))
              switch (message.language) {
                default:
                  return "language: enum value expected";
                case 0:
                case 1:
                case 2:
                case 3:
                  break;
              }
            if (message.kind != null && message.hasOwnProperty("kind"))
              switch (message.kind) {
                default:
                  return "kind: enum value expected";
                case 0:
                case 19:
                case 20:
                case 3:
                case 21:
                case 6:
                case 7:
                case 8:
                case 17:
                case 9:
                case 10:
                case 11:
                case 12:
                case 13:
                case 14:
                case 18:
                case 22:
                case 23:
                case 24:
                case 25:
                case 26:
                case 27:
                case 28:
                  break;
              }
            if (message.properties != null && message.hasOwnProperty("properties")) {
              if (!$util.isInteger(message.properties))
                return "properties: integer expected";
            }
            if (message.displayName != null && message.hasOwnProperty("displayName")) {
              if (!$util.isString(message.displayName))
                return "displayName: string expected";
            }
            if (message.signature != null && message.hasOwnProperty("signature")) {
              let error = $root.scala.meta.internal.semanticdb.Signature.verify(message.signature);
              if (error)
                return "signature." + error;
            }
            if (message.annotations != null && message.hasOwnProperty("annotations")) {
              if (!Array.isArray(message.annotations))
                return "annotations: array expected";
              for (let i = 0; i < message.annotations.length; ++i) {
                let error = $root.scala.meta.internal.semanticdb.AnnotationTree.verify(message.annotations[i]);
                if (error)
                  return "annotations." + error;
              }
            }
            if (message.access != null && message.hasOwnProperty("access")) {
              let error = $root.scala.meta.internal.semanticdb.Access.verify(message.access);
              if (error)
                return "access." + error;
            }
            if (message.overriddenSymbols != null && message.hasOwnProperty("overriddenSymbols")) {
              if (!Array.isArray(message.overriddenSymbols))
                return "overriddenSymbols: array expected";
              for (let i = 0; i < message.overriddenSymbols.length; ++i)
                if (!$util.isString(message.overriddenSymbols[i]))
                  return "overriddenSymbols: string[] expected";
            }
            if (message.documentation != null && message.hasOwnProperty("documentation")) {
              let error = $root.scala.meta.internal.semanticdb.Documentation.verify(message.documentation);
              if (error)
                return "documentation." + error;
            }
            return null;
          };
          SymbolInformation.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.SymbolInformation)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.SymbolInformation();
            if (object.symbol != null)
              message.symbol = String(object.symbol);
            switch (object.language) {
              default:
                if (typeof object.language === "number") {
                  message.language = object.language;
                  break;
                }
                break;
              case "UNKNOWN_LANGUAGE":
              case 0:
                message.language = 0;
                break;
              case "SCALA":
              case 1:
                message.language = 1;
                break;
              case "JAVA":
              case 2:
                message.language = 2;
                break;
              case "PROTOBUF":
              case 3:
                message.language = 3;
                break;
            }
            switch (object.kind) {
              default:
                if (typeof object.kind === "number") {
                  message.kind = object.kind;
                  break;
                }
                break;
              case "UNKNOWN_KIND":
              case 0:
                message.kind = 0;
                break;
              case "LOCAL":
              case 19:
                message.kind = 19;
                break;
              case "FIELD":
              case 20:
                message.kind = 20;
                break;
              case "METHOD":
              case 3:
                message.kind = 3;
                break;
              case "CONSTRUCTOR":
              case 21:
                message.kind = 21;
                break;
              case "MACRO":
              case 6:
                message.kind = 6;
                break;
              case "TYPE":
              case 7:
                message.kind = 7;
                break;
              case "PARAMETER":
              case 8:
                message.kind = 8;
                break;
              case "SELF_PARAMETER":
              case 17:
                message.kind = 17;
                break;
              case "TYPE_PARAMETER":
              case 9:
                message.kind = 9;
                break;
              case "OBJECT":
              case 10:
                message.kind = 10;
                break;
              case "PACKAGE":
              case 11:
                message.kind = 11;
                break;
              case "PACKAGE_OBJECT":
              case 12:
                message.kind = 12;
                break;
              case "CLASS":
              case 13:
                message.kind = 13;
                break;
              case "TRAIT":
              case 14:
                message.kind = 14;
                break;
              case "INTERFACE":
              case 18:
                message.kind = 18;
                break;
              case "MESSAGE":
              case 22:
                message.kind = 22;
                break;
              case "PROTOBUF_ENUM":
              case 23:
                message.kind = 23;
                break;
              case "PROTOBUF_ENUM_VALUE":
              case 24:
                message.kind = 24;
                break;
              case "SERVICE":
              case 25:
                message.kind = 25;
                break;
              case "RPC":
              case 26:
                message.kind = 26;
                break;
              case "ONEOF":
              case 27:
                message.kind = 27;
                break;
              case "FILE":
              case 28:
                message.kind = 28;
                break;
            }
            if (object.properties != null)
              message.properties = object.properties | 0;
            if (object.displayName != null)
              message.displayName = String(object.displayName);
            if (object.signature != null) {
              if (typeof object.signature !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.SymbolInformation.signature: object expected");
              message.signature = $root.scala.meta.internal.semanticdb.Signature.fromObject(object.signature);
            }
            if (object.annotations) {
              if (!Array.isArray(object.annotations))
                throw TypeError(".scala.meta.internal.semanticdb.SymbolInformation.annotations: array expected");
              message.annotations = [];
              for (let i = 0; i < object.annotations.length; ++i) {
                if (typeof object.annotations[i] !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.SymbolInformation.annotations: object expected");
                message.annotations[i] = $root.scala.meta.internal.semanticdb.AnnotationTree.fromObject(object.annotations[i]);
              }
            }
            if (object.access != null) {
              if (typeof object.access !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.SymbolInformation.access: object expected");
              message.access = $root.scala.meta.internal.semanticdb.Access.fromObject(object.access);
            }
            if (object.overriddenSymbols) {
              if (!Array.isArray(object.overriddenSymbols))
                throw TypeError(".scala.meta.internal.semanticdb.SymbolInformation.overriddenSymbols: array expected");
              message.overriddenSymbols = [];
              for (let i = 0; i < object.overriddenSymbols.length; ++i)
                message.overriddenSymbols[i] = String(object.overriddenSymbols[i]);
            }
            if (object.documentation != null) {
              if (typeof object.documentation !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.SymbolInformation.documentation: object expected");
              message.documentation = $root.scala.meta.internal.semanticdb.Documentation.fromObject(object.documentation);
            }
            return message;
          };
          SymbolInformation.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.arrays || options.defaults) {
              object.annotations = [];
              object.overriddenSymbols = [];
            }
            if (options.defaults) {
              object.symbol = "";
              object.kind = options.enums === String ? "UNKNOWN_KIND" : 0;
              object.properties = 0;
              object.displayName = "";
              object.language = options.enums === String ? "UNKNOWN_LANGUAGE" : 0;
              object.signature = null;
              object.access = null;
              object.documentation = null;
            }
            if (message.symbol != null && message.hasOwnProperty("symbol"))
              object.symbol = message.symbol;
            if (message.kind != null && message.hasOwnProperty("kind"))
              object.kind = options.enums === String ? $root.scala.meta.internal.semanticdb.SymbolInformation.Kind[message.kind] === void 0 ? message.kind : $root.scala.meta.internal.semanticdb.SymbolInformation.Kind[message.kind] : message.kind;
            if (message.properties != null && message.hasOwnProperty("properties"))
              object.properties = message.properties;
            if (message.displayName != null && message.hasOwnProperty("displayName"))
              object.displayName = message.displayName;
            if (message.annotations && message.annotations.length) {
              object.annotations = [];
              for (let j = 0; j < message.annotations.length; ++j)
                object.annotations[j] = $root.scala.meta.internal.semanticdb.AnnotationTree.toObject(message.annotations[j], options);
            }
            if (message.language != null && message.hasOwnProperty("language"))
              object.language = options.enums === String ? $root.scala.meta.internal.semanticdb.Language[message.language] === void 0 ? message.language : $root.scala.meta.internal.semanticdb.Language[message.language] : message.language;
            if (message.signature != null && message.hasOwnProperty("signature"))
              object.signature = $root.scala.meta.internal.semanticdb.Signature.toObject(message.signature, options);
            if (message.access != null && message.hasOwnProperty("access"))
              object.access = $root.scala.meta.internal.semanticdb.Access.toObject(message.access, options);
            if (message.overriddenSymbols && message.overriddenSymbols.length) {
              object.overriddenSymbols = [];
              for (let j = 0; j < message.overriddenSymbols.length; ++j)
                object.overriddenSymbols[j] = message.overriddenSymbols[j];
            }
            if (message.documentation != null && message.hasOwnProperty("documentation"))
              object.documentation = $root.scala.meta.internal.semanticdb.Documentation.toObject(message.documentation, options);
            return object;
          };
          SymbolInformation.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          SymbolInformation.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.SymbolInformation";
          };
          SymbolInformation.Kind = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "UNKNOWN_KIND"] = 0;
            values[valuesById[19] = "LOCAL"] = 19;
            values[valuesById[20] = "FIELD"] = 20;
            values[valuesById[3] = "METHOD"] = 3;
            values[valuesById[21] = "CONSTRUCTOR"] = 21;
            values[valuesById[6] = "MACRO"] = 6;
            values[valuesById[7] = "TYPE"] = 7;
            values[valuesById[8] = "PARAMETER"] = 8;
            values[valuesById[17] = "SELF_PARAMETER"] = 17;
            values[valuesById[9] = "TYPE_PARAMETER"] = 9;
            values[valuesById[10] = "OBJECT"] = 10;
            values[valuesById[11] = "PACKAGE"] = 11;
            values[valuesById[12] = "PACKAGE_OBJECT"] = 12;
            values[valuesById[13] = "CLASS"] = 13;
            values[valuesById[14] = "TRAIT"] = 14;
            values[valuesById[18] = "INTERFACE"] = 18;
            values[valuesById[22] = "MESSAGE"] = 22;
            values[valuesById[23] = "PROTOBUF_ENUM"] = 23;
            values[valuesById[24] = "PROTOBUF_ENUM_VALUE"] = 24;
            values[valuesById[25] = "SERVICE"] = 25;
            values[valuesById[26] = "RPC"] = 26;
            values[valuesById[27] = "ONEOF"] = 27;
            values[valuesById[28] = "FILE"] = 28;
            return values;
          })();
          SymbolInformation.Property = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "UNKNOWN_PROPERTY"] = 0;
            values[valuesById[4] = "ABSTRACT"] = 4;
            values[valuesById[8] = "FINAL"] = 8;
            values[valuesById[16] = "SEALED"] = 16;
            values[valuesById[32] = "IMPLICIT"] = 32;
            values[valuesById[64] = "LAZY"] = 64;
            values[valuesById[128] = "CASE"] = 128;
            values[valuesById[256] = "COVARIANT"] = 256;
            values[valuesById[512] = "CONTRAVARIANT"] = 512;
            values[valuesById[1024] = "VAL"] = 1024;
            values[valuesById[2048] = "VAR"] = 2048;
            values[valuesById[4096] = "STATIC"] = 4096;
            values[valuesById[8192] = "PRIMARY"] = 8192;
            values[valuesById[16384] = "ENUM"] = 16384;
            values[valuesById[32768] = "DEFAULT"] = 32768;
            values[valuesById[65536] = "GIVEN"] = 65536;
            values[valuesById[131072] = "INLINE"] = 131072;
            values[valuesById[262144] = "OPEN"] = 262144;
            values[valuesById[524288] = "TRANSPARENT"] = 524288;
            values[valuesById[1048576] = "INFIX"] = 1048576;
            values[valuesById[2097152] = "OPAQUE"] = 2097152;
            values[valuesById[4194304] = "OVERRIDE"] = 4194304;
            values[valuesById[8388608] = "SYNTHETIC"] = 8388608;
            return values;
          })();
          return SymbolInformation;
        })();
        semanticdb.Documentation = (function() {
          function Documentation(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          Documentation.prototype.message = "";
          Documentation.prototype.format = 0;
          Documentation.create = function create(properties) {
            return new Documentation(properties);
          };
          Documentation.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.message != null && Object.hasOwnProperty.call(message, "message"))
              writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).string(message.message);
            if (message.format != null && Object.hasOwnProperty.call(message, "format"))
              writer.uint32(
                /* id 2, wireType 0 =*/
                16
              ).int32(message.format);
            return writer;
          };
          Documentation.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          Documentation.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Documentation();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.message = reader.string();
                  break;
                }
                case 2: {
                  message.format = reader.int32();
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          Documentation.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          Documentation.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.message != null && message.hasOwnProperty("message")) {
              if (!$util.isString(message.message))
                return "message: string expected";
            }
            if (message.format != null && message.hasOwnProperty("format"))
              switch (message.format) {
                default:
                  return "format: enum value expected";
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                  break;
              }
            return null;
          };
          Documentation.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.Documentation)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.Documentation();
            if (object.message != null)
              message.message = String(object.message);
            switch (object.format) {
              default:
                if (typeof object.format === "number") {
                  message.format = object.format;
                  break;
                }
                break;
              case "HTML":
              case 0:
                message.format = 0;
                break;
              case "MARKDOWN":
              case 1:
                message.format = 1;
                break;
              case "JAVADOC":
              case 2:
                message.format = 2;
                break;
              case "SCALADOC":
              case 3:
                message.format = 3;
                break;
              case "KDOC":
              case 4:
                message.format = 4;
                break;
            }
            return message;
          };
          Documentation.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults) {
              object.message = "";
              object.format = options.enums === String ? "HTML" : 0;
            }
            if (message.message != null && message.hasOwnProperty("message"))
              object.message = message.message;
            if (message.format != null && message.hasOwnProperty("format"))
              object.format = options.enums === String ? $root.scala.meta.internal.semanticdb.Documentation.Format[message.format] === void 0 ? message.format : $root.scala.meta.internal.semanticdb.Documentation.Format[message.format] : message.format;
            return object;
          };
          Documentation.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          Documentation.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.Documentation";
          };
          Documentation.Format = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "HTML"] = 0;
            values[valuesById[1] = "MARKDOWN"] = 1;
            values[valuesById[2] = "JAVADOC"] = 2;
            values[valuesById[3] = "SCALADOC"] = 3;
            values[valuesById[4] = "KDOC"] = 4;
            return values;
          })();
          return Documentation;
        })();
        semanticdb.AnnotationTree = (function() {
          function AnnotationTree(properties) {
            this["arguments"] = [];
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          AnnotationTree.prototype.tpe = null;
          AnnotationTree.prototype["arguments"] = $util.emptyArray;
          AnnotationTree.create = function create(properties) {
            return new AnnotationTree(properties);
          };
          AnnotationTree.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.tpe != null && Object.hasOwnProperty.call(message, "tpe"))
              $root.scala.meta.internal.semanticdb.Type.encode(message.tpe, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message["arguments"] != null && message["arguments"].length)
              for (let i = 0; i < message["arguments"].length; ++i)
                $root.scala.meta.internal.semanticdb.Tree.encode(message["arguments"][i], writer.uint32(
                  /* id 2, wireType 2 =*/
                  18
                ).fork()).ldelim();
            return writer;
          };
          AnnotationTree.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          AnnotationTree.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.AnnotationTree();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.tpe = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  if (!(message["arguments"] && message["arguments"].length))
                    message["arguments"] = [];
                  message["arguments"].push($root.scala.meta.internal.semanticdb.Tree.decode(reader, reader.uint32()));
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          AnnotationTree.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          AnnotationTree.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.tpe != null && message.hasOwnProperty("tpe")) {
              let error = $root.scala.meta.internal.semanticdb.Type.verify(message.tpe);
              if (error)
                return "tpe." + error;
            }
            if (message["arguments"] != null && message.hasOwnProperty("arguments")) {
              if (!Array.isArray(message["arguments"]))
                return "arguments: array expected";
              for (let i = 0; i < message["arguments"].length; ++i) {
                let error = $root.scala.meta.internal.semanticdb.Tree.verify(message["arguments"][i]);
                if (error)
                  return "arguments." + error;
              }
            }
            return null;
          };
          AnnotationTree.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.AnnotationTree)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.AnnotationTree();
            if (object.tpe != null) {
              if (typeof object.tpe !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.AnnotationTree.tpe: object expected");
              message.tpe = $root.scala.meta.internal.semanticdb.Type.fromObject(object.tpe);
            }
            if (object["arguments"]) {
              if (!Array.isArray(object["arguments"]))
                throw TypeError(".scala.meta.internal.semanticdb.AnnotationTree.arguments: array expected");
              message["arguments"] = [];
              for (let i = 0; i < object["arguments"].length; ++i) {
                if (typeof object["arguments"][i] !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.AnnotationTree.arguments: object expected");
                message["arguments"][i] = $root.scala.meta.internal.semanticdb.Tree.fromObject(object["arguments"][i]);
              }
            }
            return message;
          };
          AnnotationTree.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.arrays || options.defaults)
              object["arguments"] = [];
            if (options.defaults)
              object.tpe = null;
            if (message.tpe != null && message.hasOwnProperty("tpe"))
              object.tpe = $root.scala.meta.internal.semanticdb.Type.toObject(message.tpe, options);
            if (message["arguments"] && message["arguments"].length) {
              object["arguments"] = [];
              for (let j = 0; j < message["arguments"].length; ++j)
                object["arguments"][j] = $root.scala.meta.internal.semanticdb.Tree.toObject(message["arguments"][j], options);
            }
            return object;
          };
          AnnotationTree.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          AnnotationTree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.AnnotationTree";
          };
          return AnnotationTree;
        })();
        semanticdb.AssignTree = (function() {
          function AssignTree(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          AssignTree.prototype.lhs = null;
          AssignTree.prototype.rhs = null;
          AssignTree.create = function create(properties) {
            return new AssignTree(properties);
          };
          AssignTree.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.lhs != null && Object.hasOwnProperty.call(message, "lhs"))
              $root.scala.meta.internal.semanticdb.Tree.encode(message.lhs, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message.rhs != null && Object.hasOwnProperty.call(message, "rhs"))
              $root.scala.meta.internal.semanticdb.Tree.encode(message.rhs, writer.uint32(
                /* id 2, wireType 2 =*/
                18
              ).fork()).ldelim();
            return writer;
          };
          AssignTree.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          AssignTree.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.AssignTree();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.lhs = $root.scala.meta.internal.semanticdb.Tree.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  message.rhs = $root.scala.meta.internal.semanticdb.Tree.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          AssignTree.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          AssignTree.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.lhs != null && message.hasOwnProperty("lhs")) {
              let error = $root.scala.meta.internal.semanticdb.Tree.verify(message.lhs);
              if (error)
                return "lhs." + error;
            }
            if (message.rhs != null && message.hasOwnProperty("rhs")) {
              let error = $root.scala.meta.internal.semanticdb.Tree.verify(message.rhs);
              if (error)
                return "rhs." + error;
            }
            return null;
          };
          AssignTree.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.AssignTree)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.AssignTree();
            if (object.lhs != null) {
              if (typeof object.lhs !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.AssignTree.lhs: object expected");
              message.lhs = $root.scala.meta.internal.semanticdb.Tree.fromObject(object.lhs);
            }
            if (object.rhs != null) {
              if (typeof object.rhs !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.AssignTree.rhs: object expected");
              message.rhs = $root.scala.meta.internal.semanticdb.Tree.fromObject(object.rhs);
            }
            return message;
          };
          AssignTree.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults) {
              object.lhs = null;
              object.rhs = null;
            }
            if (message.lhs != null && message.hasOwnProperty("lhs"))
              object.lhs = $root.scala.meta.internal.semanticdb.Tree.toObject(message.lhs, options);
            if (message.rhs != null && message.hasOwnProperty("rhs"))
              object.rhs = $root.scala.meta.internal.semanticdb.Tree.toObject(message.rhs, options);
            return object;
          };
          AssignTree.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          AssignTree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.AssignTree";
          };
          return AssignTree;
        })();
        semanticdb.Access = (function() {
          function Access(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          Access.prototype.privateAccess = null;
          Access.prototype.privateThisAccess = null;
          Access.prototype.privateWithinAccess = null;
          Access.prototype.protectedAccess = null;
          Access.prototype.protectedThisAccess = null;
          Access.prototype.protectedWithinAccess = null;
          Access.prototype.publicAccess = null;
          let $oneOfFields;
          Object.defineProperty(Access.prototype, "sealedValue", {
            get: $util.oneOfGetter($oneOfFields = ["privateAccess", "privateThisAccess", "privateWithinAccess", "protectedAccess", "protectedThisAccess", "protectedWithinAccess", "publicAccess"]),
            set: $util.oneOfSetter($oneOfFields)
          });
          Access.create = function create(properties) {
            return new Access(properties);
          };
          Access.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.privateAccess != null && Object.hasOwnProperty.call(message, "privateAccess"))
              $root.scala.meta.internal.semanticdb.PrivateAccess.encode(message.privateAccess, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message.privateThisAccess != null && Object.hasOwnProperty.call(message, "privateThisAccess"))
              $root.scala.meta.internal.semanticdb.PrivateThisAccess.encode(message.privateThisAccess, writer.uint32(
                /* id 2, wireType 2 =*/
                18
              ).fork()).ldelim();
            if (message.privateWithinAccess != null && Object.hasOwnProperty.call(message, "privateWithinAccess"))
              $root.scala.meta.internal.semanticdb.PrivateWithinAccess.encode(message.privateWithinAccess, writer.uint32(
                /* id 3, wireType 2 =*/
                26
              ).fork()).ldelim();
            if (message.protectedAccess != null && Object.hasOwnProperty.call(message, "protectedAccess"))
              $root.scala.meta.internal.semanticdb.ProtectedAccess.encode(message.protectedAccess, writer.uint32(
                /* id 4, wireType 2 =*/
                34
              ).fork()).ldelim();
            if (message.protectedThisAccess != null && Object.hasOwnProperty.call(message, "protectedThisAccess"))
              $root.scala.meta.internal.semanticdb.ProtectedThisAccess.encode(message.protectedThisAccess, writer.uint32(
                /* id 5, wireType 2 =*/
                42
              ).fork()).ldelim();
            if (message.protectedWithinAccess != null && Object.hasOwnProperty.call(message, "protectedWithinAccess"))
              $root.scala.meta.internal.semanticdb.ProtectedWithinAccess.encode(message.protectedWithinAccess, writer.uint32(
                /* id 6, wireType 2 =*/
                50
              ).fork()).ldelim();
            if (message.publicAccess != null && Object.hasOwnProperty.call(message, "publicAccess"))
              $root.scala.meta.internal.semanticdb.PublicAccess.encode(message.publicAccess, writer.uint32(
                /* id 7, wireType 2 =*/
                58
              ).fork()).ldelim();
            return writer;
          };
          Access.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          Access.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Access();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.privateAccess = $root.scala.meta.internal.semanticdb.PrivateAccess.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  message.privateThisAccess = $root.scala.meta.internal.semanticdb.PrivateThisAccess.decode(reader, reader.uint32());
                  break;
                }
                case 3: {
                  message.privateWithinAccess = $root.scala.meta.internal.semanticdb.PrivateWithinAccess.decode(reader, reader.uint32());
                  break;
                }
                case 4: {
                  message.protectedAccess = $root.scala.meta.internal.semanticdb.ProtectedAccess.decode(reader, reader.uint32());
                  break;
                }
                case 5: {
                  message.protectedThisAccess = $root.scala.meta.internal.semanticdb.ProtectedThisAccess.decode(reader, reader.uint32());
                  break;
                }
                case 6: {
                  message.protectedWithinAccess = $root.scala.meta.internal.semanticdb.ProtectedWithinAccess.decode(reader, reader.uint32());
                  break;
                }
                case 7: {
                  message.publicAccess = $root.scala.meta.internal.semanticdb.PublicAccess.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          Access.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          Access.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            let properties = {};
            if (message.privateAccess != null && message.hasOwnProperty("privateAccess")) {
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.PrivateAccess.verify(message.privateAccess);
                if (error)
                  return "privateAccess." + error;
              }
            }
            if (message.privateThisAccess != null && message.hasOwnProperty("privateThisAccess")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.PrivateThisAccess.verify(message.privateThisAccess);
                if (error)
                  return "privateThisAccess." + error;
              }
            }
            if (message.privateWithinAccess != null && message.hasOwnProperty("privateWithinAccess")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.PrivateWithinAccess.verify(message.privateWithinAccess);
                if (error)
                  return "privateWithinAccess." + error;
              }
            }
            if (message.protectedAccess != null && message.hasOwnProperty("protectedAccess")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.ProtectedAccess.verify(message.protectedAccess);
                if (error)
                  return "protectedAccess." + error;
              }
            }
            if (message.protectedThisAccess != null && message.hasOwnProperty("protectedThisAccess")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.ProtectedThisAccess.verify(message.protectedThisAccess);
                if (error)
                  return "protectedThisAccess." + error;
              }
            }
            if (message.protectedWithinAccess != null && message.hasOwnProperty("protectedWithinAccess")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.ProtectedWithinAccess.verify(message.protectedWithinAccess);
                if (error)
                  return "protectedWithinAccess." + error;
              }
            }
            if (message.publicAccess != null && message.hasOwnProperty("publicAccess")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.PublicAccess.verify(message.publicAccess);
                if (error)
                  return "publicAccess." + error;
              }
            }
            return null;
          };
          Access.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.Access)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.Access();
            if (object.privateAccess != null) {
              if (typeof object.privateAccess !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Access.privateAccess: object expected");
              message.privateAccess = $root.scala.meta.internal.semanticdb.PrivateAccess.fromObject(object.privateAccess);
            }
            if (object.privateThisAccess != null) {
              if (typeof object.privateThisAccess !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Access.privateThisAccess: object expected");
              message.privateThisAccess = $root.scala.meta.internal.semanticdb.PrivateThisAccess.fromObject(object.privateThisAccess);
            }
            if (object.privateWithinAccess != null) {
              if (typeof object.privateWithinAccess !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Access.privateWithinAccess: object expected");
              message.privateWithinAccess = $root.scala.meta.internal.semanticdb.PrivateWithinAccess.fromObject(object.privateWithinAccess);
            }
            if (object.protectedAccess != null) {
              if (typeof object.protectedAccess !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Access.protectedAccess: object expected");
              message.protectedAccess = $root.scala.meta.internal.semanticdb.ProtectedAccess.fromObject(object.protectedAccess);
            }
            if (object.protectedThisAccess != null) {
              if (typeof object.protectedThisAccess !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Access.protectedThisAccess: object expected");
              message.protectedThisAccess = $root.scala.meta.internal.semanticdb.ProtectedThisAccess.fromObject(object.protectedThisAccess);
            }
            if (object.protectedWithinAccess != null) {
              if (typeof object.protectedWithinAccess !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Access.protectedWithinAccess: object expected");
              message.protectedWithinAccess = $root.scala.meta.internal.semanticdb.ProtectedWithinAccess.fromObject(object.protectedWithinAccess);
            }
            if (object.publicAccess != null) {
              if (typeof object.publicAccess !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Access.publicAccess: object expected");
              message.publicAccess = $root.scala.meta.internal.semanticdb.PublicAccess.fromObject(object.publicAccess);
            }
            return message;
          };
          Access.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (message.privateAccess != null && message.hasOwnProperty("privateAccess")) {
              object.privateAccess = $root.scala.meta.internal.semanticdb.PrivateAccess.toObject(message.privateAccess, options);
              if (options.oneofs)
                object.sealedValue = "privateAccess";
            }
            if (message.privateThisAccess != null && message.hasOwnProperty("privateThisAccess")) {
              object.privateThisAccess = $root.scala.meta.internal.semanticdb.PrivateThisAccess.toObject(message.privateThisAccess, options);
              if (options.oneofs)
                object.sealedValue = "privateThisAccess";
            }
            if (message.privateWithinAccess != null && message.hasOwnProperty("privateWithinAccess")) {
              object.privateWithinAccess = $root.scala.meta.internal.semanticdb.PrivateWithinAccess.toObject(message.privateWithinAccess, options);
              if (options.oneofs)
                object.sealedValue = "privateWithinAccess";
            }
            if (message.protectedAccess != null && message.hasOwnProperty("protectedAccess")) {
              object.protectedAccess = $root.scala.meta.internal.semanticdb.ProtectedAccess.toObject(message.protectedAccess, options);
              if (options.oneofs)
                object.sealedValue = "protectedAccess";
            }
            if (message.protectedThisAccess != null && message.hasOwnProperty("protectedThisAccess")) {
              object.protectedThisAccess = $root.scala.meta.internal.semanticdb.ProtectedThisAccess.toObject(message.protectedThisAccess, options);
              if (options.oneofs)
                object.sealedValue = "protectedThisAccess";
            }
            if (message.protectedWithinAccess != null && message.hasOwnProperty("protectedWithinAccess")) {
              object.protectedWithinAccess = $root.scala.meta.internal.semanticdb.ProtectedWithinAccess.toObject(message.protectedWithinAccess, options);
              if (options.oneofs)
                object.sealedValue = "protectedWithinAccess";
            }
            if (message.publicAccess != null && message.hasOwnProperty("publicAccess")) {
              object.publicAccess = $root.scala.meta.internal.semanticdb.PublicAccess.toObject(message.publicAccess, options);
              if (options.oneofs)
                object.sealedValue = "publicAccess";
            }
            return object;
          };
          Access.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          Access.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.Access";
          };
          return Access;
        })();
        semanticdb.PrivateAccess = (function() {
          function PrivateAccess(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          PrivateAccess.create = function create(properties) {
            return new PrivateAccess(properties);
          };
          PrivateAccess.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            return writer;
          };
          PrivateAccess.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          PrivateAccess.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.PrivateAccess();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          PrivateAccess.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          PrivateAccess.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            return null;
          };
          PrivateAccess.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.PrivateAccess)
              return object;
            return new $root.scala.meta.internal.semanticdb.PrivateAccess();
          };
          PrivateAccess.toObject = function toObject() {
            return {};
          };
          PrivateAccess.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          PrivateAccess.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.PrivateAccess";
          };
          return PrivateAccess;
        })();
        semanticdb.PrivateThisAccess = (function() {
          function PrivateThisAccess(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          PrivateThisAccess.create = function create(properties) {
            return new PrivateThisAccess(properties);
          };
          PrivateThisAccess.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            return writer;
          };
          PrivateThisAccess.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          PrivateThisAccess.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.PrivateThisAccess();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          PrivateThisAccess.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          PrivateThisAccess.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            return null;
          };
          PrivateThisAccess.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.PrivateThisAccess)
              return object;
            return new $root.scala.meta.internal.semanticdb.PrivateThisAccess();
          };
          PrivateThisAccess.toObject = function toObject() {
            return {};
          };
          PrivateThisAccess.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          PrivateThisAccess.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.PrivateThisAccess";
          };
          return PrivateThisAccess;
        })();
        semanticdb.PrivateWithinAccess = (function() {
          function PrivateWithinAccess(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          PrivateWithinAccess.prototype.symbol = "";
          PrivateWithinAccess.create = function create(properties) {
            return new PrivateWithinAccess(properties);
          };
          PrivateWithinAccess.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.symbol != null && Object.hasOwnProperty.call(message, "symbol"))
              writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).string(message.symbol);
            return writer;
          };
          PrivateWithinAccess.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          PrivateWithinAccess.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.PrivateWithinAccess();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.symbol = reader.string();
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          PrivateWithinAccess.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          PrivateWithinAccess.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.symbol != null && message.hasOwnProperty("symbol")) {
              if (!$util.isString(message.symbol))
                return "symbol: string expected";
            }
            return null;
          };
          PrivateWithinAccess.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.PrivateWithinAccess)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.PrivateWithinAccess();
            if (object.symbol != null)
              message.symbol = String(object.symbol);
            return message;
          };
          PrivateWithinAccess.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults)
              object.symbol = "";
            if (message.symbol != null && message.hasOwnProperty("symbol"))
              object.symbol = message.symbol;
            return object;
          };
          PrivateWithinAccess.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          PrivateWithinAccess.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.PrivateWithinAccess";
          };
          return PrivateWithinAccess;
        })();
        semanticdb.ProtectedAccess = (function() {
          function ProtectedAccess(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          ProtectedAccess.create = function create(properties) {
            return new ProtectedAccess(properties);
          };
          ProtectedAccess.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            return writer;
          };
          ProtectedAccess.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          ProtectedAccess.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ProtectedAccess();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          ProtectedAccess.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          ProtectedAccess.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            return null;
          };
          ProtectedAccess.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.ProtectedAccess)
              return object;
            return new $root.scala.meta.internal.semanticdb.ProtectedAccess();
          };
          ProtectedAccess.toObject = function toObject() {
            return {};
          };
          ProtectedAccess.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          ProtectedAccess.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.ProtectedAccess";
          };
          return ProtectedAccess;
        })();
        semanticdb.ProtectedThisAccess = (function() {
          function ProtectedThisAccess(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          ProtectedThisAccess.create = function create(properties) {
            return new ProtectedThisAccess(properties);
          };
          ProtectedThisAccess.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            return writer;
          };
          ProtectedThisAccess.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          ProtectedThisAccess.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ProtectedThisAccess();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          ProtectedThisAccess.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          ProtectedThisAccess.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            return null;
          };
          ProtectedThisAccess.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.ProtectedThisAccess)
              return object;
            return new $root.scala.meta.internal.semanticdb.ProtectedThisAccess();
          };
          ProtectedThisAccess.toObject = function toObject() {
            return {};
          };
          ProtectedThisAccess.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          ProtectedThisAccess.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.ProtectedThisAccess";
          };
          return ProtectedThisAccess;
        })();
        semanticdb.ProtectedWithinAccess = (function() {
          function ProtectedWithinAccess(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          ProtectedWithinAccess.prototype.symbol = "";
          ProtectedWithinAccess.create = function create(properties) {
            return new ProtectedWithinAccess(properties);
          };
          ProtectedWithinAccess.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.symbol != null && Object.hasOwnProperty.call(message, "symbol"))
              writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).string(message.symbol);
            return writer;
          };
          ProtectedWithinAccess.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          ProtectedWithinAccess.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ProtectedWithinAccess();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.symbol = reader.string();
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          ProtectedWithinAccess.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          ProtectedWithinAccess.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.symbol != null && message.hasOwnProperty("symbol")) {
              if (!$util.isString(message.symbol))
                return "symbol: string expected";
            }
            return null;
          };
          ProtectedWithinAccess.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.ProtectedWithinAccess)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.ProtectedWithinAccess();
            if (object.symbol != null)
              message.symbol = String(object.symbol);
            return message;
          };
          ProtectedWithinAccess.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults)
              object.symbol = "";
            if (message.symbol != null && message.hasOwnProperty("symbol"))
              object.symbol = message.symbol;
            return object;
          };
          ProtectedWithinAccess.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          ProtectedWithinAccess.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.ProtectedWithinAccess";
          };
          return ProtectedWithinAccess;
        })();
        semanticdb.PublicAccess = (function() {
          function PublicAccess(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          PublicAccess.create = function create(properties) {
            return new PublicAccess(properties);
          };
          PublicAccess.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            return writer;
          };
          PublicAccess.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          PublicAccess.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.PublicAccess();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          PublicAccess.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          PublicAccess.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            return null;
          };
          PublicAccess.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.PublicAccess)
              return object;
            return new $root.scala.meta.internal.semanticdb.PublicAccess();
          };
          PublicAccess.toObject = function toObject() {
            return {};
          };
          PublicAccess.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          PublicAccess.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.PublicAccess";
          };
          return PublicAccess;
        })();
        semanticdb.SymbolOccurrence = (function() {
          function SymbolOccurrence(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          SymbolOccurrence.prototype.range = null;
          SymbolOccurrence.prototype.symbol = "";
          SymbolOccurrence.prototype.role = 0;
          SymbolOccurrence.create = function create(properties) {
            return new SymbolOccurrence(properties);
          };
          SymbolOccurrence.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.range != null && Object.hasOwnProperty.call(message, "range"))
              $root.scala.meta.internal.semanticdb.Range.encode(message.range, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message.symbol != null && Object.hasOwnProperty.call(message, "symbol"))
              writer.uint32(
                /* id 2, wireType 2 =*/
                18
              ).string(message.symbol);
            if (message.role != null && Object.hasOwnProperty.call(message, "role"))
              writer.uint32(
                /* id 3, wireType 0 =*/
                24
              ).int32(message.role);
            return writer;
          };
          SymbolOccurrence.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          SymbolOccurrence.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.SymbolOccurrence();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.range = $root.scala.meta.internal.semanticdb.Range.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  message.symbol = reader.string();
                  break;
                }
                case 3: {
                  message.role = reader.int32();
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          SymbolOccurrence.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          SymbolOccurrence.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.range != null && message.hasOwnProperty("range")) {
              let error = $root.scala.meta.internal.semanticdb.Range.verify(message.range);
              if (error)
                return "range." + error;
            }
            if (message.symbol != null && message.hasOwnProperty("symbol")) {
              if (!$util.isString(message.symbol))
                return "symbol: string expected";
            }
            if (message.role != null && message.hasOwnProperty("role"))
              switch (message.role) {
                default:
                  return "role: enum value expected";
                case 0:
                case 1:
                case 2:
                  break;
              }
            return null;
          };
          SymbolOccurrence.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.SymbolOccurrence)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.SymbolOccurrence();
            if (object.range != null) {
              if (typeof object.range !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.SymbolOccurrence.range: object expected");
              message.range = $root.scala.meta.internal.semanticdb.Range.fromObject(object.range);
            }
            if (object.symbol != null)
              message.symbol = String(object.symbol);
            switch (object.role) {
              default:
                if (typeof object.role === "number") {
                  message.role = object.role;
                  break;
                }
                break;
              case "UNKNOWN_ROLE":
              case 0:
                message.role = 0;
                break;
              case "REFERENCE":
              case 1:
                message.role = 1;
                break;
              case "DEFINITION":
              case 2:
                message.role = 2;
                break;
            }
            return message;
          };
          SymbolOccurrence.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults) {
              object.range = null;
              object.symbol = "";
              object.role = options.enums === String ? "UNKNOWN_ROLE" : 0;
            }
            if (message.range != null && message.hasOwnProperty("range"))
              object.range = $root.scala.meta.internal.semanticdb.Range.toObject(message.range, options);
            if (message.symbol != null && message.hasOwnProperty("symbol"))
              object.symbol = message.symbol;
            if (message.role != null && message.hasOwnProperty("role"))
              object.role = options.enums === String ? $root.scala.meta.internal.semanticdb.SymbolOccurrence.Role[message.role] === void 0 ? message.role : $root.scala.meta.internal.semanticdb.SymbolOccurrence.Role[message.role] : message.role;
            return object;
          };
          SymbolOccurrence.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          SymbolOccurrence.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.SymbolOccurrence";
          };
          SymbolOccurrence.Role = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "UNKNOWN_ROLE"] = 0;
            values[valuesById[1] = "REFERENCE"] = 1;
            values[valuesById[2] = "DEFINITION"] = 2;
            return values;
          })();
          return SymbolOccurrence;
        })();
        semanticdb.Diagnostic = (function() {
          function Diagnostic(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          Diagnostic.prototype.range = null;
          Diagnostic.prototype.severity = 0;
          Diagnostic.prototype.message = "";
          Diagnostic.create = function create(properties) {
            return new Diagnostic(properties);
          };
          Diagnostic.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.range != null && Object.hasOwnProperty.call(message, "range"))
              $root.scala.meta.internal.semanticdb.Range.encode(message.range, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message.severity != null && Object.hasOwnProperty.call(message, "severity"))
              writer.uint32(
                /* id 2, wireType 0 =*/
                16
              ).int32(message.severity);
            if (message.message != null && Object.hasOwnProperty.call(message, "message"))
              writer.uint32(
                /* id 3, wireType 2 =*/
                26
              ).string(message.message);
            return writer;
          };
          Diagnostic.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          Diagnostic.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Diagnostic();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.range = $root.scala.meta.internal.semanticdb.Range.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  message.severity = reader.int32();
                  break;
                }
                case 3: {
                  message.message = reader.string();
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          Diagnostic.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          Diagnostic.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.range != null && message.hasOwnProperty("range")) {
              let error = $root.scala.meta.internal.semanticdb.Range.verify(message.range);
              if (error)
                return "range." + error;
            }
            if (message.severity != null && message.hasOwnProperty("severity"))
              switch (message.severity) {
                default:
                  return "severity: enum value expected";
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                  break;
              }
            if (message.message != null && message.hasOwnProperty("message")) {
              if (!$util.isString(message.message))
                return "message: string expected";
            }
            return null;
          };
          Diagnostic.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.Diagnostic)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.Diagnostic();
            if (object.range != null) {
              if (typeof object.range !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Diagnostic.range: object expected");
              message.range = $root.scala.meta.internal.semanticdb.Range.fromObject(object.range);
            }
            switch (object.severity) {
              default:
                if (typeof object.severity === "number") {
                  message.severity = object.severity;
                  break;
                }
                break;
              case "UNKNOWN_SEVERITY":
              case 0:
                message.severity = 0;
                break;
              case "ERROR":
              case 1:
                message.severity = 1;
                break;
              case "WARNING":
              case 2:
                message.severity = 2;
                break;
              case "INFORMATION":
              case 3:
                message.severity = 3;
                break;
              case "HINT":
              case 4:
                message.severity = 4;
                break;
            }
            if (object.message != null)
              message.message = String(object.message);
            return message;
          };
          Diagnostic.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults) {
              object.range = null;
              object.severity = options.enums === String ? "UNKNOWN_SEVERITY" : 0;
              object.message = "";
            }
            if (message.range != null && message.hasOwnProperty("range"))
              object.range = $root.scala.meta.internal.semanticdb.Range.toObject(message.range, options);
            if (message.severity != null && message.hasOwnProperty("severity"))
              object.severity = options.enums === String ? $root.scala.meta.internal.semanticdb.Diagnostic.Severity[message.severity] === void 0 ? message.severity : $root.scala.meta.internal.semanticdb.Diagnostic.Severity[message.severity] : message.severity;
            if (message.message != null && message.hasOwnProperty("message"))
              object.message = message.message;
            return object;
          };
          Diagnostic.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          Diagnostic.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.Diagnostic";
          };
          Diagnostic.Severity = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "UNKNOWN_SEVERITY"] = 0;
            values[valuesById[1] = "ERROR"] = 1;
            values[valuesById[2] = "WARNING"] = 2;
            values[valuesById[3] = "INFORMATION"] = 3;
            values[valuesById[4] = "HINT"] = 4;
            return values;
          })();
          return Diagnostic;
        })();
        semanticdb.Synthetic = (function() {
          function Synthetic(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          Synthetic.prototype.range = null;
          Synthetic.prototype.tree = null;
          Synthetic.create = function create(properties) {
            return new Synthetic(properties);
          };
          Synthetic.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.range != null && Object.hasOwnProperty.call(message, "range"))
              $root.scala.meta.internal.semanticdb.Range.encode(message.range, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message.tree != null && Object.hasOwnProperty.call(message, "tree"))
              $root.scala.meta.internal.semanticdb.Tree.encode(message.tree, writer.uint32(
                /* id 2, wireType 2 =*/
                18
              ).fork()).ldelim();
            return writer;
          };
          Synthetic.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          Synthetic.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Synthetic();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.range = $root.scala.meta.internal.semanticdb.Range.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  message.tree = $root.scala.meta.internal.semanticdb.Tree.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          Synthetic.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          Synthetic.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.range != null && message.hasOwnProperty("range")) {
              let error = $root.scala.meta.internal.semanticdb.Range.verify(message.range);
              if (error)
                return "range." + error;
            }
            if (message.tree != null && message.hasOwnProperty("tree")) {
              let error = $root.scala.meta.internal.semanticdb.Tree.verify(message.tree);
              if (error)
                return "tree." + error;
            }
            return null;
          };
          Synthetic.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.Synthetic)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.Synthetic();
            if (object.range != null) {
              if (typeof object.range !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Synthetic.range: object expected");
              message.range = $root.scala.meta.internal.semanticdb.Range.fromObject(object.range);
            }
            if (object.tree != null) {
              if (typeof object.tree !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Synthetic.tree: object expected");
              message.tree = $root.scala.meta.internal.semanticdb.Tree.fromObject(object.tree);
            }
            return message;
          };
          Synthetic.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults) {
              object.range = null;
              object.tree = null;
            }
            if (message.range != null && message.hasOwnProperty("range"))
              object.range = $root.scala.meta.internal.semanticdb.Range.toObject(message.range, options);
            if (message.tree != null && message.hasOwnProperty("tree"))
              object.tree = $root.scala.meta.internal.semanticdb.Tree.toObject(message.tree, options);
            return object;
          };
          Synthetic.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          Synthetic.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.Synthetic";
          };
          return Synthetic;
        })();
        semanticdb.Tree = (function() {
          function Tree(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          Tree.prototype.applyTree = null;
          Tree.prototype.functionTree = null;
          Tree.prototype.idTree = null;
          Tree.prototype.literalTree = null;
          Tree.prototype.macroExpansionTree = null;
          Tree.prototype.originalTree = null;
          Tree.prototype.selectTree = null;
          Tree.prototype.typeApplyTree = null;
          Tree.prototype.assignTree = null;
          Tree.prototype.annotationTree = null;
          let $oneOfFields;
          Object.defineProperty(Tree.prototype, "sealedValue", {
            get: $util.oneOfGetter($oneOfFields = ["applyTree", "functionTree", "idTree", "literalTree", "macroExpansionTree", "originalTree", "selectTree", "typeApplyTree", "assignTree", "annotationTree"]),
            set: $util.oneOfSetter($oneOfFields)
          });
          Tree.create = function create(properties) {
            return new Tree(properties);
          };
          Tree.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.applyTree != null && Object.hasOwnProperty.call(message, "applyTree"))
              $root.scala.meta.internal.semanticdb.ApplyTree.encode(message.applyTree, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message.functionTree != null && Object.hasOwnProperty.call(message, "functionTree"))
              $root.scala.meta.internal.semanticdb.FunctionTree.encode(message.functionTree, writer.uint32(
                /* id 2, wireType 2 =*/
                18
              ).fork()).ldelim();
            if (message.idTree != null && Object.hasOwnProperty.call(message, "idTree"))
              $root.scala.meta.internal.semanticdb.IdTree.encode(message.idTree, writer.uint32(
                /* id 3, wireType 2 =*/
                26
              ).fork()).ldelim();
            if (message.literalTree != null && Object.hasOwnProperty.call(message, "literalTree"))
              $root.scala.meta.internal.semanticdb.LiteralTree.encode(message.literalTree, writer.uint32(
                /* id 4, wireType 2 =*/
                34
              ).fork()).ldelim();
            if (message.macroExpansionTree != null && Object.hasOwnProperty.call(message, "macroExpansionTree"))
              $root.scala.meta.internal.semanticdb.MacroExpansionTree.encode(message.macroExpansionTree, writer.uint32(
                /* id 5, wireType 2 =*/
                42
              ).fork()).ldelim();
            if (message.originalTree != null && Object.hasOwnProperty.call(message, "originalTree"))
              $root.scala.meta.internal.semanticdb.OriginalTree.encode(message.originalTree, writer.uint32(
                /* id 6, wireType 2 =*/
                50
              ).fork()).ldelim();
            if (message.selectTree != null && Object.hasOwnProperty.call(message, "selectTree"))
              $root.scala.meta.internal.semanticdb.SelectTree.encode(message.selectTree, writer.uint32(
                /* id 7, wireType 2 =*/
                58
              ).fork()).ldelim();
            if (message.typeApplyTree != null && Object.hasOwnProperty.call(message, "typeApplyTree"))
              $root.scala.meta.internal.semanticdb.TypeApplyTree.encode(message.typeApplyTree, writer.uint32(
                /* id 8, wireType 2 =*/
                66
              ).fork()).ldelim();
            if (message.assignTree != null && Object.hasOwnProperty.call(message, "assignTree"))
              $root.scala.meta.internal.semanticdb.AssignTree.encode(message.assignTree, writer.uint32(
                /* id 9, wireType 2 =*/
                74
              ).fork()).ldelim();
            if (message.annotationTree != null && Object.hasOwnProperty.call(message, "annotationTree"))
              $root.scala.meta.internal.semanticdb.AnnotationTree.encode(message.annotationTree, writer.uint32(
                /* id 10, wireType 2 =*/
                82
              ).fork()).ldelim();
            return writer;
          };
          Tree.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          Tree.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Tree();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.applyTree = $root.scala.meta.internal.semanticdb.ApplyTree.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  message.functionTree = $root.scala.meta.internal.semanticdb.FunctionTree.decode(reader, reader.uint32());
                  break;
                }
                case 3: {
                  message.idTree = $root.scala.meta.internal.semanticdb.IdTree.decode(reader, reader.uint32());
                  break;
                }
                case 4: {
                  message.literalTree = $root.scala.meta.internal.semanticdb.LiteralTree.decode(reader, reader.uint32());
                  break;
                }
                case 5: {
                  message.macroExpansionTree = $root.scala.meta.internal.semanticdb.MacroExpansionTree.decode(reader, reader.uint32());
                  break;
                }
                case 6: {
                  message.originalTree = $root.scala.meta.internal.semanticdb.OriginalTree.decode(reader, reader.uint32());
                  break;
                }
                case 7: {
                  message.selectTree = $root.scala.meta.internal.semanticdb.SelectTree.decode(reader, reader.uint32());
                  break;
                }
                case 8: {
                  message.typeApplyTree = $root.scala.meta.internal.semanticdb.TypeApplyTree.decode(reader, reader.uint32());
                  break;
                }
                case 9: {
                  message.assignTree = $root.scala.meta.internal.semanticdb.AssignTree.decode(reader, reader.uint32());
                  break;
                }
                case 10: {
                  message.annotationTree = $root.scala.meta.internal.semanticdb.AnnotationTree.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          Tree.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          Tree.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            let properties = {};
            if (message.applyTree != null && message.hasOwnProperty("applyTree")) {
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.ApplyTree.verify(message.applyTree);
                if (error)
                  return "applyTree." + error;
              }
            }
            if (message.functionTree != null && message.hasOwnProperty("functionTree")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.FunctionTree.verify(message.functionTree);
                if (error)
                  return "functionTree." + error;
              }
            }
            if (message.idTree != null && message.hasOwnProperty("idTree")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.IdTree.verify(message.idTree);
                if (error)
                  return "idTree." + error;
              }
            }
            if (message.literalTree != null && message.hasOwnProperty("literalTree")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.LiteralTree.verify(message.literalTree);
                if (error)
                  return "literalTree." + error;
              }
            }
            if (message.macroExpansionTree != null && message.hasOwnProperty("macroExpansionTree")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.MacroExpansionTree.verify(message.macroExpansionTree);
                if (error)
                  return "macroExpansionTree." + error;
              }
            }
            if (message.originalTree != null && message.hasOwnProperty("originalTree")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.OriginalTree.verify(message.originalTree);
                if (error)
                  return "originalTree." + error;
              }
            }
            if (message.selectTree != null && message.hasOwnProperty("selectTree")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.SelectTree.verify(message.selectTree);
                if (error)
                  return "selectTree." + error;
              }
            }
            if (message.typeApplyTree != null && message.hasOwnProperty("typeApplyTree")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.TypeApplyTree.verify(message.typeApplyTree);
                if (error)
                  return "typeApplyTree." + error;
              }
            }
            if (message.assignTree != null && message.hasOwnProperty("assignTree")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.AssignTree.verify(message.assignTree);
                if (error)
                  return "assignTree." + error;
              }
            }
            if (message.annotationTree != null && message.hasOwnProperty("annotationTree")) {
              if (properties.sealedValue === 1)
                return "sealedValue: multiple values";
              properties.sealedValue = 1;
              {
                let error = $root.scala.meta.internal.semanticdb.AnnotationTree.verify(message.annotationTree);
                if (error)
                  return "annotationTree." + error;
              }
            }
            return null;
          };
          Tree.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.Tree)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.Tree();
            if (object.applyTree != null) {
              if (typeof object.applyTree !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Tree.applyTree: object expected");
              message.applyTree = $root.scala.meta.internal.semanticdb.ApplyTree.fromObject(object.applyTree);
            }
            if (object.functionTree != null) {
              if (typeof object.functionTree !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Tree.functionTree: object expected");
              message.functionTree = $root.scala.meta.internal.semanticdb.FunctionTree.fromObject(object.functionTree);
            }
            if (object.idTree != null) {
              if (typeof object.idTree !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Tree.idTree: object expected");
              message.idTree = $root.scala.meta.internal.semanticdb.IdTree.fromObject(object.idTree);
            }
            if (object.literalTree != null) {
              if (typeof object.literalTree !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Tree.literalTree: object expected");
              message.literalTree = $root.scala.meta.internal.semanticdb.LiteralTree.fromObject(object.literalTree);
            }
            if (object.macroExpansionTree != null) {
              if (typeof object.macroExpansionTree !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Tree.macroExpansionTree: object expected");
              message.macroExpansionTree = $root.scala.meta.internal.semanticdb.MacroExpansionTree.fromObject(object.macroExpansionTree);
            }
            if (object.originalTree != null) {
              if (typeof object.originalTree !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Tree.originalTree: object expected");
              message.originalTree = $root.scala.meta.internal.semanticdb.OriginalTree.fromObject(object.originalTree);
            }
            if (object.selectTree != null) {
              if (typeof object.selectTree !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Tree.selectTree: object expected");
              message.selectTree = $root.scala.meta.internal.semanticdb.SelectTree.fromObject(object.selectTree);
            }
            if (object.typeApplyTree != null) {
              if (typeof object.typeApplyTree !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Tree.typeApplyTree: object expected");
              message.typeApplyTree = $root.scala.meta.internal.semanticdb.TypeApplyTree.fromObject(object.typeApplyTree);
            }
            if (object.assignTree != null) {
              if (typeof object.assignTree !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Tree.assignTree: object expected");
              message.assignTree = $root.scala.meta.internal.semanticdb.AssignTree.fromObject(object.assignTree);
            }
            if (object.annotationTree != null) {
              if (typeof object.annotationTree !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.Tree.annotationTree: object expected");
              message.annotationTree = $root.scala.meta.internal.semanticdb.AnnotationTree.fromObject(object.annotationTree);
            }
            return message;
          };
          Tree.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (message.applyTree != null && message.hasOwnProperty("applyTree")) {
              object.applyTree = $root.scala.meta.internal.semanticdb.ApplyTree.toObject(message.applyTree, options);
              if (options.oneofs)
                object.sealedValue = "applyTree";
            }
            if (message.functionTree != null && message.hasOwnProperty("functionTree")) {
              object.functionTree = $root.scala.meta.internal.semanticdb.FunctionTree.toObject(message.functionTree, options);
              if (options.oneofs)
                object.sealedValue = "functionTree";
            }
            if (message.idTree != null && message.hasOwnProperty("idTree")) {
              object.idTree = $root.scala.meta.internal.semanticdb.IdTree.toObject(message.idTree, options);
              if (options.oneofs)
                object.sealedValue = "idTree";
            }
            if (message.literalTree != null && message.hasOwnProperty("literalTree")) {
              object.literalTree = $root.scala.meta.internal.semanticdb.LiteralTree.toObject(message.literalTree, options);
              if (options.oneofs)
                object.sealedValue = "literalTree";
            }
            if (message.macroExpansionTree != null && message.hasOwnProperty("macroExpansionTree")) {
              object.macroExpansionTree = $root.scala.meta.internal.semanticdb.MacroExpansionTree.toObject(message.macroExpansionTree, options);
              if (options.oneofs)
                object.sealedValue = "macroExpansionTree";
            }
            if (message.originalTree != null && message.hasOwnProperty("originalTree")) {
              object.originalTree = $root.scala.meta.internal.semanticdb.OriginalTree.toObject(message.originalTree, options);
              if (options.oneofs)
                object.sealedValue = "originalTree";
            }
            if (message.selectTree != null && message.hasOwnProperty("selectTree")) {
              object.selectTree = $root.scala.meta.internal.semanticdb.SelectTree.toObject(message.selectTree, options);
              if (options.oneofs)
                object.sealedValue = "selectTree";
            }
            if (message.typeApplyTree != null && message.hasOwnProperty("typeApplyTree")) {
              object.typeApplyTree = $root.scala.meta.internal.semanticdb.TypeApplyTree.toObject(message.typeApplyTree, options);
              if (options.oneofs)
                object.sealedValue = "typeApplyTree";
            }
            if (message.assignTree != null && message.hasOwnProperty("assignTree")) {
              object.assignTree = $root.scala.meta.internal.semanticdb.AssignTree.toObject(message.assignTree, options);
              if (options.oneofs)
                object.sealedValue = "assignTree";
            }
            if (message.annotationTree != null && message.hasOwnProperty("annotationTree")) {
              object.annotationTree = $root.scala.meta.internal.semanticdb.AnnotationTree.toObject(message.annotationTree, options);
              if (options.oneofs)
                object.sealedValue = "annotationTree";
            }
            return object;
          };
          Tree.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          Tree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.Tree";
          };
          return Tree;
        })();
        semanticdb.ApplyTree = (function() {
          function ApplyTree(properties) {
            this["arguments"] = [];
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          ApplyTree.prototype["function"] = null;
          ApplyTree.prototype["arguments"] = $util.emptyArray;
          ApplyTree.prototype.properties = 0;
          ApplyTree.create = function create(properties) {
            return new ApplyTree(properties);
          };
          ApplyTree.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message["function"] != null && Object.hasOwnProperty.call(message, "function"))
              $root.scala.meta.internal.semanticdb.Tree.encode(message["function"], writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message["arguments"] != null && message["arguments"].length)
              for (let i = 0; i < message["arguments"].length; ++i)
                $root.scala.meta.internal.semanticdb.Tree.encode(message["arguments"][i], writer.uint32(
                  /* id 2, wireType 2 =*/
                  18
                ).fork()).ldelim();
            if (message.properties != null && Object.hasOwnProperty.call(message, "properties"))
              writer.uint32(
                /* id 3, wireType 0 =*/
                24
              ).int32(message.properties);
            return writer;
          };
          ApplyTree.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          ApplyTree.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ApplyTree();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message["function"] = $root.scala.meta.internal.semanticdb.Tree.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  if (!(message["arguments"] && message["arguments"].length))
                    message["arguments"] = [];
                  message["arguments"].push($root.scala.meta.internal.semanticdb.Tree.decode(reader, reader.uint32()));
                  break;
                }
                case 3: {
                  message.properties = reader.int32();
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          ApplyTree.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          ApplyTree.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message["function"] != null && message.hasOwnProperty("function")) {
              let error = $root.scala.meta.internal.semanticdb.Tree.verify(message["function"]);
              if (error)
                return "function." + error;
            }
            if (message["arguments"] != null && message.hasOwnProperty("arguments")) {
              if (!Array.isArray(message["arguments"]))
                return "arguments: array expected";
              for (let i = 0; i < message["arguments"].length; ++i) {
                let error = $root.scala.meta.internal.semanticdb.Tree.verify(message["arguments"][i]);
                if (error)
                  return "arguments." + error;
              }
            }
            if (message.properties != null && message.hasOwnProperty("properties")) {
              if (!$util.isInteger(message.properties))
                return "properties: integer expected";
            }
            return null;
          };
          ApplyTree.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.ApplyTree)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.ApplyTree();
            if (object["function"] != null) {
              if (typeof object["function"] !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.ApplyTree.function: object expected");
              message["function"] = $root.scala.meta.internal.semanticdb.Tree.fromObject(object["function"]);
            }
            if (object["arguments"]) {
              if (!Array.isArray(object["arguments"]))
                throw TypeError(".scala.meta.internal.semanticdb.ApplyTree.arguments: array expected");
              message["arguments"] = [];
              for (let i = 0; i < object["arguments"].length; ++i) {
                if (typeof object["arguments"][i] !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.ApplyTree.arguments: object expected");
                message["arguments"][i] = $root.scala.meta.internal.semanticdb.Tree.fromObject(object["arguments"][i]);
              }
            }
            if (object.properties != null)
              message.properties = object.properties | 0;
            return message;
          };
          ApplyTree.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.arrays || options.defaults)
              object["arguments"] = [];
            if (options.defaults) {
              object["function"] = null;
              object.properties = 0;
            }
            if (message["function"] != null && message.hasOwnProperty("function"))
              object["function"] = $root.scala.meta.internal.semanticdb.Tree.toObject(message["function"], options);
            if (message["arguments"] && message["arguments"].length) {
              object["arguments"] = [];
              for (let j = 0; j < message["arguments"].length; ++j)
                object["arguments"][j] = $root.scala.meta.internal.semanticdb.Tree.toObject(message["arguments"][j], options);
            }
            if (message.properties != null && message.hasOwnProperty("properties"))
              object.properties = message.properties;
            return object;
          };
          ApplyTree.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          ApplyTree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.ApplyTree";
          };
          return ApplyTree;
        })();
        semanticdb.FunctionTree = (function() {
          function FunctionTree(properties) {
            this.parameters = [];
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          FunctionTree.prototype.parameters = $util.emptyArray;
          FunctionTree.prototype.body = null;
          FunctionTree.create = function create(properties) {
            return new FunctionTree(properties);
          };
          FunctionTree.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.parameters != null && message.parameters.length)
              for (let i = 0; i < message.parameters.length; ++i)
                $root.scala.meta.internal.semanticdb.IdTree.encode(message.parameters[i], writer.uint32(
                  /* id 1, wireType 2 =*/
                  10
                ).fork()).ldelim();
            if (message.body != null && Object.hasOwnProperty.call(message, "body"))
              $root.scala.meta.internal.semanticdb.Tree.encode(message.body, writer.uint32(
                /* id 2, wireType 2 =*/
                18
              ).fork()).ldelim();
            return writer;
          };
          FunctionTree.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          FunctionTree.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.FunctionTree();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  if (!(message.parameters && message.parameters.length))
                    message.parameters = [];
                  message.parameters.push($root.scala.meta.internal.semanticdb.IdTree.decode(reader, reader.uint32()));
                  break;
                }
                case 2: {
                  message.body = $root.scala.meta.internal.semanticdb.Tree.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          FunctionTree.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          FunctionTree.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.parameters != null && message.hasOwnProperty("parameters")) {
              if (!Array.isArray(message.parameters))
                return "parameters: array expected";
              for (let i = 0; i < message.parameters.length; ++i) {
                let error = $root.scala.meta.internal.semanticdb.IdTree.verify(message.parameters[i]);
                if (error)
                  return "parameters." + error;
              }
            }
            if (message.body != null && message.hasOwnProperty("body")) {
              let error = $root.scala.meta.internal.semanticdb.Tree.verify(message.body);
              if (error)
                return "body." + error;
            }
            return null;
          };
          FunctionTree.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.FunctionTree)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.FunctionTree();
            if (object.parameters) {
              if (!Array.isArray(object.parameters))
                throw TypeError(".scala.meta.internal.semanticdb.FunctionTree.parameters: array expected");
              message.parameters = [];
              for (let i = 0; i < object.parameters.length; ++i) {
                if (typeof object.parameters[i] !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.FunctionTree.parameters: object expected");
                message.parameters[i] = $root.scala.meta.internal.semanticdb.IdTree.fromObject(object.parameters[i]);
              }
            }
            if (object.body != null) {
              if (typeof object.body !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.FunctionTree.body: object expected");
              message.body = $root.scala.meta.internal.semanticdb.Tree.fromObject(object.body);
            }
            return message;
          };
          FunctionTree.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.arrays || options.defaults)
              object.parameters = [];
            if (options.defaults)
              object.body = null;
            if (message.parameters && message.parameters.length) {
              object.parameters = [];
              for (let j = 0; j < message.parameters.length; ++j)
                object.parameters[j] = $root.scala.meta.internal.semanticdb.IdTree.toObject(message.parameters[j], options);
            }
            if (message.body != null && message.hasOwnProperty("body"))
              object.body = $root.scala.meta.internal.semanticdb.Tree.toObject(message.body, options);
            return object;
          };
          FunctionTree.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          FunctionTree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.FunctionTree";
          };
          return FunctionTree;
        })();
        semanticdb.IdTree = (function() {
          function IdTree(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          IdTree.prototype.symbol = "";
          IdTree.create = function create(properties) {
            return new IdTree(properties);
          };
          IdTree.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.symbol != null && Object.hasOwnProperty.call(message, "symbol"))
              writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).string(message.symbol);
            return writer;
          };
          IdTree.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          IdTree.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.IdTree();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.symbol = reader.string();
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          IdTree.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          IdTree.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.symbol != null && message.hasOwnProperty("symbol")) {
              if (!$util.isString(message.symbol))
                return "symbol: string expected";
            }
            return null;
          };
          IdTree.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.IdTree)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.IdTree();
            if (object.symbol != null)
              message.symbol = String(object.symbol);
            return message;
          };
          IdTree.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults)
              object.symbol = "";
            if (message.symbol != null && message.hasOwnProperty("symbol"))
              object.symbol = message.symbol;
            return object;
          };
          IdTree.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          IdTree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.IdTree";
          };
          return IdTree;
        })();
        semanticdb.LiteralTree = (function() {
          function LiteralTree(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          LiteralTree.prototype.constant = null;
          LiteralTree.create = function create(properties) {
            return new LiteralTree(properties);
          };
          LiteralTree.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.constant != null && Object.hasOwnProperty.call(message, "constant"))
              $root.scala.meta.internal.semanticdb.Constant.encode(message.constant, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            return writer;
          };
          LiteralTree.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          LiteralTree.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.LiteralTree();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.constant = $root.scala.meta.internal.semanticdb.Constant.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          LiteralTree.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          LiteralTree.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.constant != null && message.hasOwnProperty("constant")) {
              let error = $root.scala.meta.internal.semanticdb.Constant.verify(message.constant);
              if (error)
                return "constant." + error;
            }
            return null;
          };
          LiteralTree.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.LiteralTree)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.LiteralTree();
            if (object.constant != null) {
              if (typeof object.constant !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.LiteralTree.constant: object expected");
              message.constant = $root.scala.meta.internal.semanticdb.Constant.fromObject(object.constant);
            }
            return message;
          };
          LiteralTree.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults)
              object.constant = null;
            if (message.constant != null && message.hasOwnProperty("constant"))
              object.constant = $root.scala.meta.internal.semanticdb.Constant.toObject(message.constant, options);
            return object;
          };
          LiteralTree.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          LiteralTree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.LiteralTree";
          };
          return LiteralTree;
        })();
        semanticdb.MacroExpansionTree = (function() {
          function MacroExpansionTree(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          MacroExpansionTree.prototype.beforeExpansion = null;
          MacroExpansionTree.prototype.tpe = null;
          MacroExpansionTree.create = function create(properties) {
            return new MacroExpansionTree(properties);
          };
          MacroExpansionTree.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.beforeExpansion != null && Object.hasOwnProperty.call(message, "beforeExpansion"))
              $root.scala.meta.internal.semanticdb.Tree.encode(message.beforeExpansion, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message.tpe != null && Object.hasOwnProperty.call(message, "tpe"))
              $root.scala.meta.internal.semanticdb.Type.encode(message.tpe, writer.uint32(
                /* id 2, wireType 2 =*/
                18
              ).fork()).ldelim();
            return writer;
          };
          MacroExpansionTree.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          MacroExpansionTree.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.MacroExpansionTree();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.beforeExpansion = $root.scala.meta.internal.semanticdb.Tree.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  message.tpe = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          MacroExpansionTree.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          MacroExpansionTree.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.beforeExpansion != null && message.hasOwnProperty("beforeExpansion")) {
              let error = $root.scala.meta.internal.semanticdb.Tree.verify(message.beforeExpansion);
              if (error)
                return "beforeExpansion." + error;
            }
            if (message.tpe != null && message.hasOwnProperty("tpe")) {
              let error = $root.scala.meta.internal.semanticdb.Type.verify(message.tpe);
              if (error)
                return "tpe." + error;
            }
            return null;
          };
          MacroExpansionTree.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.MacroExpansionTree)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.MacroExpansionTree();
            if (object.beforeExpansion != null) {
              if (typeof object.beforeExpansion !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.MacroExpansionTree.beforeExpansion: object expected");
              message.beforeExpansion = $root.scala.meta.internal.semanticdb.Tree.fromObject(object.beforeExpansion);
            }
            if (object.tpe != null) {
              if (typeof object.tpe !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.MacroExpansionTree.tpe: object expected");
              message.tpe = $root.scala.meta.internal.semanticdb.Type.fromObject(object.tpe);
            }
            return message;
          };
          MacroExpansionTree.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults) {
              object.beforeExpansion = null;
              object.tpe = null;
            }
            if (message.beforeExpansion != null && message.hasOwnProperty("beforeExpansion"))
              object.beforeExpansion = $root.scala.meta.internal.semanticdb.Tree.toObject(message.beforeExpansion, options);
            if (message.tpe != null && message.hasOwnProperty("tpe"))
              object.tpe = $root.scala.meta.internal.semanticdb.Type.toObject(message.tpe, options);
            return object;
          };
          MacroExpansionTree.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          MacroExpansionTree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.MacroExpansionTree";
          };
          return MacroExpansionTree;
        })();
        semanticdb.OriginalTree = (function() {
          function OriginalTree(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          OriginalTree.prototype.range = null;
          OriginalTree.create = function create(properties) {
            return new OriginalTree(properties);
          };
          OriginalTree.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.range != null && Object.hasOwnProperty.call(message, "range"))
              $root.scala.meta.internal.semanticdb.Range.encode(message.range, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            return writer;
          };
          OriginalTree.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          OriginalTree.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.OriginalTree();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.range = $root.scala.meta.internal.semanticdb.Range.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          OriginalTree.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          OriginalTree.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.range != null && message.hasOwnProperty("range")) {
              let error = $root.scala.meta.internal.semanticdb.Range.verify(message.range);
              if (error)
                return "range." + error;
            }
            return null;
          };
          OriginalTree.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.OriginalTree)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.OriginalTree();
            if (object.range != null) {
              if (typeof object.range !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.OriginalTree.range: object expected");
              message.range = $root.scala.meta.internal.semanticdb.Range.fromObject(object.range);
            }
            return message;
          };
          OriginalTree.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults)
              object.range = null;
            if (message.range != null && message.hasOwnProperty("range"))
              object.range = $root.scala.meta.internal.semanticdb.Range.toObject(message.range, options);
            return object;
          };
          OriginalTree.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          OriginalTree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.OriginalTree";
          };
          return OriginalTree;
        })();
        semanticdb.SelectTree = (function() {
          function SelectTree(properties) {
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          SelectTree.prototype.qualifier = null;
          SelectTree.prototype.id = null;
          SelectTree.create = function create(properties) {
            return new SelectTree(properties);
          };
          SelectTree.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message.qualifier != null && Object.hasOwnProperty.call(message, "qualifier"))
              $root.scala.meta.internal.semanticdb.Tree.encode(message.qualifier, writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
              $root.scala.meta.internal.semanticdb.IdTree.encode(message.id, writer.uint32(
                /* id 2, wireType 2 =*/
                18
              ).fork()).ldelim();
            return writer;
          };
          SelectTree.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          SelectTree.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.SelectTree();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message.qualifier = $root.scala.meta.internal.semanticdb.Tree.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  message.id = $root.scala.meta.internal.semanticdb.IdTree.decode(reader, reader.uint32());
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          SelectTree.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          SelectTree.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message.qualifier != null && message.hasOwnProperty("qualifier")) {
              let error = $root.scala.meta.internal.semanticdb.Tree.verify(message.qualifier);
              if (error)
                return "qualifier." + error;
            }
            if (message.id != null && message.hasOwnProperty("id")) {
              let error = $root.scala.meta.internal.semanticdb.IdTree.verify(message.id);
              if (error)
                return "id." + error;
            }
            return null;
          };
          SelectTree.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.SelectTree)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.SelectTree();
            if (object.qualifier != null) {
              if (typeof object.qualifier !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.SelectTree.qualifier: object expected");
              message.qualifier = $root.scala.meta.internal.semanticdb.Tree.fromObject(object.qualifier);
            }
            if (object.id != null) {
              if (typeof object.id !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.SelectTree.id: object expected");
              message.id = $root.scala.meta.internal.semanticdb.IdTree.fromObject(object.id);
            }
            return message;
          };
          SelectTree.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.defaults) {
              object.qualifier = null;
              object.id = null;
            }
            if (message.qualifier != null && message.hasOwnProperty("qualifier"))
              object.qualifier = $root.scala.meta.internal.semanticdb.Tree.toObject(message.qualifier, options);
            if (message.id != null && message.hasOwnProperty("id"))
              object.id = $root.scala.meta.internal.semanticdb.IdTree.toObject(message.id, options);
            return object;
          };
          SelectTree.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          SelectTree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.SelectTree";
          };
          return SelectTree;
        })();
        semanticdb.TypeApplyTree = (function() {
          function TypeApplyTree(properties) {
            this.typeArguments = [];
            if (properties) {
              for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                  this[keys[i]] = properties[keys[i]];
            }
          }
          TypeApplyTree.prototype["function"] = null;
          TypeApplyTree.prototype.typeArguments = $util.emptyArray;
          TypeApplyTree.create = function create(properties) {
            return new TypeApplyTree(properties);
          };
          TypeApplyTree.encode = function encode(message, writer) {
            if (!writer)
              writer = $Writer.create();
            if (message["function"] != null && Object.hasOwnProperty.call(message, "function"))
              $root.scala.meta.internal.semanticdb.Tree.encode(message["function"], writer.uint32(
                /* id 1, wireType 2 =*/
                10
              ).fork()).ldelim();
            if (message.typeArguments != null && message.typeArguments.length)
              for (let i = 0; i < message.typeArguments.length; ++i)
                $root.scala.meta.internal.semanticdb.Type.encode(message.typeArguments[i], writer.uint32(
                  /* id 2, wireType 2 =*/
                  18
                ).fork()).ldelim();
            return writer;
          };
          TypeApplyTree.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
          };
          TypeApplyTree.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
              reader = $Reader.create(reader);
            let end = length === void 0 ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.TypeApplyTree();
            while (reader.pos < end) {
              let tag = reader.uint32();
              if (tag === error)
                break;
              switch (tag >>> 3) {
                case 1: {
                  message["function"] = $root.scala.meta.internal.semanticdb.Tree.decode(reader, reader.uint32());
                  break;
                }
                case 2: {
                  if (!(message.typeArguments && message.typeArguments.length))
                    message.typeArguments = [];
                  message.typeArguments.push($root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32()));
                  break;
                }
                default:
                  reader.skipType(tag & 7);
                  break;
              }
            }
            return message;
          };
          TypeApplyTree.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
              reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
          };
          TypeApplyTree.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
              return "object expected";
            if (message["function"] != null && message.hasOwnProperty("function")) {
              let error = $root.scala.meta.internal.semanticdb.Tree.verify(message["function"]);
              if (error)
                return "function." + error;
            }
            if (message.typeArguments != null && message.hasOwnProperty("typeArguments")) {
              if (!Array.isArray(message.typeArguments))
                return "typeArguments: array expected";
              for (let i = 0; i < message.typeArguments.length; ++i) {
                let error = $root.scala.meta.internal.semanticdb.Type.verify(message.typeArguments[i]);
                if (error)
                  return "typeArguments." + error;
              }
            }
            return null;
          };
          TypeApplyTree.fromObject = function fromObject(object) {
            if (object instanceof $root.scala.meta.internal.semanticdb.TypeApplyTree)
              return object;
            let message = new $root.scala.meta.internal.semanticdb.TypeApplyTree();
            if (object["function"] != null) {
              if (typeof object["function"] !== "object")
                throw TypeError(".scala.meta.internal.semanticdb.TypeApplyTree.function: object expected");
              message["function"] = $root.scala.meta.internal.semanticdb.Tree.fromObject(object["function"]);
            }
            if (object.typeArguments) {
              if (!Array.isArray(object.typeArguments))
                throw TypeError(".scala.meta.internal.semanticdb.TypeApplyTree.typeArguments: array expected");
              message.typeArguments = [];
              for (let i = 0; i < object.typeArguments.length; ++i) {
                if (typeof object.typeArguments[i] !== "object")
                  throw TypeError(".scala.meta.internal.semanticdb.TypeApplyTree.typeArguments: object expected");
                message.typeArguments[i] = $root.scala.meta.internal.semanticdb.Type.fromObject(object.typeArguments[i]);
              }
            }
            return message;
          };
          TypeApplyTree.toObject = function toObject(message, options) {
            if (!options)
              options = {};
            let object = {};
            if (options.arrays || options.defaults)
              object.typeArguments = [];
            if (options.defaults)
              object["function"] = null;
            if (message["function"] != null && message.hasOwnProperty("function"))
              object["function"] = $root.scala.meta.internal.semanticdb.Tree.toObject(message["function"], options);
            if (message.typeArguments && message.typeArguments.length) {
              object.typeArguments = [];
              for (let j = 0; j < message.typeArguments.length; ++j)
                object.typeArguments[j] = $root.scala.meta.internal.semanticdb.Type.toObject(message.typeArguments[j], options);
            }
            return object;
          };
          TypeApplyTree.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
          };
          TypeApplyTree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === void 0) {
              typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/scala.meta.internal.semanticdb.TypeApplyTree";
          };
          return TypeApplyTree;
        })();
        return semanticdb;
      })();
      return internal;
    })();
    return meta;
  })();
  return scala2;
})();

// node_modules/@projector/analyzers/dist/code-intelligence/semanticdb-import.js
var db = scala.meta.internal.semanticdb;
var provider4 = "projector.semanticdb";
function location(path, content, value) {
  if (value === null || value === void 0)
    return void 0;
  const lines = content.split("\n");
  const startLine = value.startLine ?? 0, startCharacter = value.startCharacter ?? 0, endLine = value.endLine ?? 0, endCharacter = value.endCharacter ?? 0;
  const offset = (line, column) => line >= 0 && line < lines.length && column >= 0 && column <= lines[line].length ? lines.slice(0, line).reduce((sum, text) => sum + text.length + 1, 0) + column : void 0;
  const start = offset(startLine, startCharacter), end = offset(endLine, endCharacter);
  if (start === void 0 || end === void 0 || end < start)
    return void 0;
  return { path, start, end, line: startLine + 1, column: startCharacter + 1 };
}
function symbolId2(symbol, path) {
  return hashFramedDomain("projector-semanticdb-symbol-v1", {
    symbol,
    ...symbol.startsWith("local") ? { path } : {}
  });
}
async function importSemanticDb(source, options) {
  const digest = createHash5("sha256"), inputs = new Map(options.inputs.map((input) => [input.path, input]));
  const partitions = [], paths = /* @__PURE__ */ new Set();
  let allVerified = true;
  for await (const frame2 of boundedProtobufFrames(source, digest, observationLimitValue(options.maxArtifactBytes ?? DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes), observationLimitValue(options.maxFrameBytes ?? options.maxArtifactBytes ?? DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes))) {
    if (frame2.field !== 1)
      continue;
    const document = db.TextDocument.decode(frame2.value);
    if (document.schema !== db.Schema.SEMANTICDB4)
      throw new Error("SemanticDB document is not schema v4");
    let path;
    try {
      path = decodeURIComponent(document.uri).replaceAll("\\", "/");
    } catch {
      throw new Error("SemanticDB document URI is invalid");
    }
    if (!path || path.startsWith("/") || /^[A-Za-z]:/u.test(path) || path.includes("\0") || path.split("/").some((part) => part === ".." || part === "." || part === "") || paths.has(path))
      throw new Error(`Unsafe or duplicate SemanticDB document URI: ${path}`);
    paths.add(path);
    const input = inputs.get(path), text = input?.content ?? document.text, hasText = input !== void 0 || document.text !== "";
    if (input !== void 0 && document.text !== "" && document.text !== input.content)
      throw new Error(`SemanticDB embedded text differs from observed source: ${path}`);
    const inputHash = hasText ? codeInputHash(text) : "missing-source";
    const md5 = document.md5 || "";
    if (md5 && hasText && createHash5("md5").update(text).digest("hex") !== md5.toLowerCase())
      throw new Error(`SemanticDB source MD5 differs from observed input: ${path}`);
    const provenance = {
      provider: provider4,
      version: "scalameta-semanticdb/4.17.4",
      inputHash,
      artifact: options.artifact
    };
    const infos = new Map(document.symbols.map((info) => [info.symbol, info]));
    const symbols = [], edges = [];
    let invalidRanges = 0;
    if (hasText)
      for (const occurrence of document.occurrences) {
        const at = location(path, text, occurrence.range);
        if (at === void 0) {
          invalidRanges++;
          continue;
        }
        if (!occurrence.symbol)
          continue;
        const id = symbolId2(occurrence.symbol, path), info = infos.get(occurrence.symbol);
        if (occurrence.role === db.SymbolOccurrence.Role.DEFINITION) {
          symbols.push({
            id,
            name: info?.displayName || occurrence.symbol,
            kind: info === void 0 ? "symbol" : db.SymbolInformation.Kind[info.kind ?? 0] ?? "symbol",
            definition: at,
            extent: at,
            declarationHash: hashFramedDomain("projector-semanticdb-declaration-v1", {
              symbol: occurrence.symbol,
              signature: JSON.stringify(info?.signature ?? null),
              text: text.slice(at.start, at.end)
            }),
            provenance
          });
          for (const overridden of info?.overriddenSymbols ?? [])
            edges.push({
              id: hashFramedDomain("projector-semanticdb-override-v1", {
                path,
                at: at.start,
                overridden
              }),
              kind: "implementation",
              source: at,
              sourceSymbolId: id,
              targetSymbolId: symbolId2(overridden, path),
              resolution: "resolved",
              provenance
            });
        } else if (occurrence.role === db.SymbolOccurrence.Role.REFERENCE) {
          edges.push({
            id: hashFramedDomain("projector-semanticdb-reference-v1", {
              path,
              at: at.start,
              symbol: occurrence.symbol
            }),
            kind: "reference",
            source: at,
            targetSymbolId: id,
            resolution: "resolved",
            provenance
          });
        }
      }
    const capabilities = [
      "definition",
      "reference",
      "import",
      "call",
      "type",
      "implementation"
    ].map((kind) => ({
      kind,
      fidelity: "index",
      status: !hasText ? "unavailable" : kind === "definition" || kind === "reference" ? invalidRanges ? "partial" : "available" : kind === "implementation" ? "partial" : "unavailable",
      ...kind === "call" ? { reason: "SemanticDB occurrences do not establish runtime calls" } : {}
    }));
    const partition = {
      path,
      inputHash,
      symbols,
      edges,
      coverage: {
        path,
        status: !hasText ? "unavailable" : "partial",
        reason: !hasText ? "Source bytes unavailable for SemanticDB ranges" : invalidRanges ? "Some SemanticDB positions cannot be mapped to source" : "SemanticDB exposes references and overrides, but not resolved calls/imports",
        capabilities
      }
    };
    allVerified &&= input !== void 0 && options.sourceHashes?.[path] === inputHash && inputHash !== "missing-source";
    if (options.emitPartition === void 0)
      partitions.push(partition);
    else
      options.emitPartition(partition);
  }
  const artifactHash = `sha256:${digest.digest("hex")}`;
  const sourceInputs = [...inputs.values()].map((input) => ({
    path: input.path,
    contentHash: codeInputHash(input.content)
  })).sort((a, b) => a.path.localeCompare(b.path));
  const verified = paths.size > 0 && options.sourceHashes !== void 0 && allVerified;
  const binding = {
    ...options.binding,
    status: verified ? "verified" : "unbound",
    sourceInputs,
    configInputs: [],
    resolutionInputs: []
  };
  return {
    schemaVersion: "projector.code-intelligence/v1",
    provider: provider4,
    providerVersion: "scalameta-semanticdb/4.17.4",
    inputFingerprint: hashFramedDomain("projector-semanticdb-input-v1", {
      artifactHash,
      sourceInputs
    }),
    configFingerprint: hashFramedDomain("projector-semanticdb-schema-v1", "4.17.4"),
    resolutionFingerprint: options.emitPartition === void 0 ? hashFramedDomain("projector-semanticdb-relations-v1", partitions.map((partition) => partition.edges.map((edge) => edge.id))) : hashFramedCanonicalJsonChunks("projector-semanticdb-relations-v1", function* () {
      yield "[";
      let first = true;
      for (const path of paths) {
        if (!first)
          yield ",";
        first = false;
        const partition = options.getPartition?.(path);
        if (partition === void 0)
          throw new Error(`Staged SemanticDB document missing: ${path}`);
        yield JSON.stringify(partition.edges.map((edge) => edge.id));
      }
      yield "]";
    }),
    binding,
    partitions
  };
}

export {
  observationFailure,
  checkObservation,
  observationMap,
  readObservationFile,
  GitCommandError,
  observationGit,
  observationGitBytes,
  InventoryContentStore,
  inventoryEntryBytes,
  inventoryEntryWithBytes,
  inventoryEntryChunks,
  inventoryTextHash,
  inventoryForTransport,
  hydrateInventory,
  isExcludedInventoryPath,
  readInventoryEntry,
  inventoryRepositoryIdentities,
  inventoryRepository,
  analyzeDocuments,
  syntaxProgramVersion,
  isBundledRuntimeDependencyPath,
  hashJavaScriptSemantics,
  normalizeJavaScriptSemantics,
  localImportCandidates,
  analyzeJavaScript,
  collectGitPathIdentities,
  parseGitStatus,
  collectGitFacts,
  finalizeGitFacts,
  compileEventContractTopology,
  compileAuthenticatedAnalyzerTopology,
  createTopologyRelevanceQueryStatePort,
  createTopologyRelevanceAdapter,
  compileRepositoryTopology,
  detectMechanicalDivergences,
  localRepositoryAdapterVersion,
  localSemanticKey,
  analyzeLocalRepository,
  collectLocalRepositoryInputs,
  analyzeCollectedLocalRepository,
  analyzeGitTree,
  codeInputHash,
  verifyCodeInputBinding,
  discoverTypeScriptProjects,
  TypeScriptCodeProvider,
  supportedTreeSitterLanguages,
  TreeSitterCodeProvider,
  importScip,
  importSemanticDb
};
