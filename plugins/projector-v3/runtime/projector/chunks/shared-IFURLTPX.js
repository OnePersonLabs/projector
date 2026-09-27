import { createRequire as __projectorCreateRequire } from "node:module"; const require = __projectorCreateRequire(import.meta.url);
import {
  DerivedObservationBudget,
  ObservationBudget,
  ObservationError,
  canonicalJson,
  deriveEntityId,
  hashFramedCanonicalJsonChunks,
  hashFramedDomain
} from "./shared-6VIFAIKJ.js";

// node_modules/@projector/analyzers/dist/filesystem/inventory.js
import { lstat, opendir, readlink } from "node:fs/promises";
import { dirname, isAbsolute, join as join2, relative, resolve, sep } from "node:path";

// node_modules/@projector/analyzers/dist/ordering.js
function compareCodePoint(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

// node_modules/@projector/analyzers/dist/filesystem/observation-io.js
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";
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
    const chunks = [];
    let size = 0;
    while (true) {
      checkObservation(budget, signal, "file-read", scope);
      const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, budget.limits.maxFileBytes - size + 1, budget.remaining("maxTotalBytes") + 1));
      const { bytesRead } = await handle.read(buffer);
      if (bytesRead === 0)
        break;
      size += bytesRead;
      budget.assertFileBytes(size, scope);
      budget.consume("maxTotalBytes", bytesRead, "file-read", scope);
      chunks.push(buffer.subarray(0, bytesRead));
    }
    return Buffer.concat(chunks, size);
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
async function observationGit(root, args, budget, options = {}) {
  return observationGitResult(root, args, budget, options, (output) => output.toString("utf8"));
}
async function observationGitBytes(root, args, budget, options = {}) {
  return observationGitResult(root, args, budget, options, (output) => output);
}
async function observationGitResult(root, args, budget, options, result) {
  const stage = options.stage ?? "git-facts";
  checkObservation(budget, options.signal, stage);
  return new Promise((resolve3, reject) => {
    const child = spawn("git", [
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
    const timer = setTimeout(() => stop(new ObservationError("observation-limit-exceeded", stage, ".", "Repository observation deadline exceeded; explicitly increase timeoutMs to retry.", "timeoutMs", budget.limits.timeoutMs)), budget.remainingMs());
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
    child.stdout.on("data", (chunk) => collect(stdout, chunk));
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
      resolve3(result(Buffer.concat(stdout)));
    });
    child.stdin.end(options.input);
    if (options.signal?.aborted)
      onAbort();
  });
}

// node_modules/@projector/analyzers/dist/filesystem/inventory.js
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
  if (/\.(?:mjs|js)$/u.test(path))
    return "text/javascript";
  if (/\.(?:mts|ts)$/u.test(path))
    return "text/typescript";
  if (path.endsWith(".md"))
    return "text/markdown";
  return "application/octet-stream";
}
function missing(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
async function confirmedNonGit(root, error) {
  if (!(error instanceof GitCommandError) || !/not a git repository/iu.test(error.stderr))
    return false;
  for (let directory = root; ; directory = dirname(directory)) {
    try {
      await lstat(join2(directory, ".git"));
      return false;
    } catch (markerError) {
      if (!missing(markerError))
        return false;
    }
    if (dirname(directory) === directory)
      return true;
  }
}
async function inventoryRepository(repositoryRoot, options = {}) {
  const root = resolve(repositoryRoot), budget = options.budget ?? new ObservationBudget(options.observationLimits);
  const signal = options.signal;
  const entries = [], ignoreSources = [];
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
  let output = "";
  try {
    output = await observationGit(root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], budget, { ...signal === void 0 ? {} : { signal }, stage: "git-inventory" });
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
    if (!path || isAbsolute(path) || path.includes("\0"))
      throw new Error("Git returned an invalid repository path");
    const absolute = resolve(root, ...path.split("/")), fromRoot = relative(root, absolute);
    if (!fromRoot || fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot))
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
    if (stat.isSymbolicLink()) {
      const symlinkTarget = await readlink(absolute);
      const size = Buffer.byteLength(symlinkTarget);
      budget.assertFileBytes(size, path);
      budget.consume("maxTotalBytes", size, "symlink-read", path);
      entries.push({
        path,
        kind: "symlink",
        mediaType: "inode/symlink",
        content: symlinkTarget,
        contentHash: hashFramedDomain("repository-artifact-content", symlinkTarget),
        generated: false,
        symlinkTarget
      });
      return;
    }
    const bytes = await readObservationFile(absolute, budget, path, activeSignal), content = bytes.toString("utf8");
    const generated = /(?:@generated|generated file|do not edit)/iu.test(content.slice(0, 1024));
    entries.push({
      path,
      kind: "file",
      mediaType: mediaType(path),
      content,
      contentHash: hashFramedDomain("repository-artifact-content", bytes.toString("base64")),
      generated,
      ...generated ? { generatedReason: "source-marker" } : {}
    });
  }
  async function visit(directory, activeSignal = signal) {
    const scope = repositoryPath(root, directory) || ".";
    countDirectory(scope);
    if (method === "git-index-and-nonignored-untracked")
      await fingerprint(join2(directory, ".gitignore"), scope === "." ? ".gitignore" : `${scope}/.gitignore`, activeSignal);
    const directories = [];
    const handle = await opendir(directory, { bufferSize: 32 });
    for await (const child of handle) {
      checkObservation(budget, activeSignal, "directory-enumeration", scope);
      const absolute = join2(directory, child.name), path = repositoryPath(root, absolute);
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
      const paths = /* @__PURE__ */ new Set();
      for (let start = 0; start < output.length; ) {
        const end = output.indexOf("\0", start);
        if (end < 0)
          throw new Error("Git inventory is not NUL terminated");
        const path = output.slice(start, end);
        start = end + 1;
        if (path && !isExcludedInventoryPath(path)) {
          countFile(path);
          paths.add(path);
        }
      }
      output = "";
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
  return {
    entries,
    failures: [],
    rootAvailability: "available",
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
    const frame = stack.at(-1);
    if (content[cursor] !== ":" || frame?.kind !== "object")
      continue;
    let key;
    try {
      key = JSON.parse(content.slice(start, index));
    } catch {
      continue;
    }
    if (frame.keys.has(key))
      duplicates.add(key);
    else
      frame.keys.add(key);
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
import { createHash } from "node:crypto";

// node_modules/@projector/analyzers/dist/typescript/facts.js
import { extname, posix } from "node:path";
var sourceExtensions = [".mjs", ".js", ".cjs", ".mts", ".ts"];
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
  function* chunks() {
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
  return hashFramedCanonicalJsonChunks(domain, chunks);
}
function hashJavaScriptSemantics(content, domain, budget = new DerivedObservationBudget(), scope = ".", envelope) {
  const lexed = lexJavaScript(content, budget, scope);
  try {
    return hashNormalizedTokens(lexed.tokens, domain, budget, scope, envelope);
  } finally {
    budget.release(lexed.reservedBytes);
  }
}
function normalizeJavaScriptSemantics(content, budget = new DerivedObservationBudget(), scope = ".") {
  const lexed = lexJavaScript(content, budget, scope);
  try {
    return normalizeTokens(lexed.tokens, budget, scope);
  } finally {
    budget.release(lexed.reservedBytes);
  }
}
function stringLiteralValue(raw) {
  const quote = raw[0];
  const body = raw.slice(1, -1);
  if (quote === '"') {
    try {
      return JSON.parse(raw);
    } catch {
      return body;
    }
  }
  return body.replace(/\\([\\'])/gu, "$1");
}
function significantTokens(tokens, budget, scope) {
  budget.reserveItems(tokens.length, 8, "javascript-token-view", scope);
  return tokens.filter((token) => token.kind !== "line-break");
}
function extractExports(tokens, budget, scope) {
  const significant = significantTokens(tokens, budget, scope);
  try {
    const exports = /* @__PURE__ */ new Set();
    for (let index = 0; index < significant.length; index += 1) {
      if (significant[index]?.kind !== "identifier" || significant[index]?.value !== "export")
        continue;
      let cursor = index + 1;
      if (significant[cursor]?.value === "default")
        cursor += 1;
      if (significant[cursor]?.value === "async")
        cursor += 1;
      if (!["function", "class", "const", "let", "var"].includes(significant[cursor]?.value ?? ""))
        continue;
      const name = significant[cursor + 1];
      if (name?.kind === "identifier" && !exports.has(name.value)) {
        budget.reserve(64 + 2 * name.value.length, "javascript-exports", scope);
        exports.add(name.value);
      }
    }
    return [...exports].sort(compareCodePoint);
  } finally {
    budget.release(tokens.length * 8);
  }
}
function extractTestNames(tokens, budget, scope) {
  const significant = significantTokens(tokens, budget, scope);
  try {
    const names = /* @__PURE__ */ new Set();
    for (let index = 0; index < significant.length - 2; index += 1) {
      const token = significant[index];
      if (token?.kind !== "identifier" || !["test", "it"].includes(token.value))
        continue;
      if (significant[index - 1]?.value === "." || significant[index + 1]?.value !== "(")
        continue;
      const name = significant[index + 2];
      if (name?.kind === "string") {
        budget.reserve(64 + 2 * name.value.length, "javascript-tests", scope);
        names.add(stringLiteralValue(name.value));
      }
    }
    return [...names].sort(compareCodePoint);
  } finally {
    budget.release(tokens.length * 8);
  }
}
function sourceLocation(content, offset, endOffset) {
  const before = content.slice(0, offset);
  const lines = before.split(/\r?\n/u);
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1, offset, endOffset };
}
function parseNamedBindings(body, statementTypeOnly, budget, scope) {
  const bindings = [];
  for (let start = 0; start < body.length; ) {
    const comma = body.indexOf(",", start), end = comma < 0 ? body.length : comma;
    budget.reserveString(end - start, "javascript-import-bindings", scope);
    const part = body.slice(start, end).trim();
    start = end + 1;
    if (!part)
      continue;
    budget.reserve(160 + 4 * part.length, "javascript-import-bindings", scope);
    const typeOnly = statementTypeOnly || part.startsWith("type ");
    const normalized = part.replace(/^type\s+/u, "");
    const [imported = "", local = imported] = normalized.split(/\s+as\s+/u);
    bindings.push({ imported: imported.trim(), local: local.trim(), typeOnly });
  }
  return bindings.sort((left, right) => compareCodePoint(left.imported, right.imported) || compareCodePoint(left.local, right.local));
}
function extractImportSyntax(tokens, budget, scope) {
  const imports = [];
  const values = significantTokens(tokens, budget, scope);
  try {
    for (let index = 0; index < values.length; index += 1) {
      if (values[index]?.kind !== "identifier" || values[index]?.value !== "import" || values[index + 1]?.value === "(" || values[index - 1]?.value === ".")
        continue;
      if (values[index + 1]?.kind === "string") {
        budget.reserve(192 + 2 * values[index + 1].value.length, "javascript-imports", scope);
        imports.push({ specifier: stringLiteralValue(values[index + 1].value), bindings: [], typeOnly: false });
        continue;
      }
      let cursor = index + 1;
      const typeOnly = values[cursor]?.value === "type";
      if (typeOnly)
        cursor += 1;
      const clauseStart = cursor;
      while (cursor < values.length && values[cursor]?.value !== "from" && values[cursor]?.value !== ";")
        cursor += 1;
      if (values[cursor]?.value !== "from" || values[cursor + 1]?.kind !== "string")
        continue;
      budget.reserveItems(cursor - clauseStart, 8, "javascript-import-clause", scope);
      const clause = values.slice(clauseStart, cursor);
      const bindings = [];
      if (clause[0]?.kind === "identifier" && clause[0]?.value !== "type") {
        budget.reserve(128 + 2 * clause[0].value.length, "javascript-import-bindings", scope);
        bindings.push({ imported: "default", local: clause[0].value, typeOnly });
      }
      for (let part = 0; part < clause.length; part += 1) {
        if (clause[part]?.value === "*" && clause[part + 1]?.value === "as" && clause[part + 2]?.kind === "identifier") {
          budget.reserve(128 + 2 * clause[part + 2].value.length, "javascript-import-bindings", scope);
          bindings.push({ imported: "*", local: clause[part + 2].value, typeOnly });
        }
        if (clause[part]?.value !== "{")
          continue;
        part += 1;
        while (part < clause.length && clause[part]?.value !== "}") {
          const bindingTypeOnly = typeOnly || clause[part]?.value === "type";
          if (clause[part]?.value === "type")
            part += 1;
          const imported = clause[part]?.kind === "identifier" ? clause[part].value : void 0;
          if (imported !== void 0) {
            const local = clause[part + 1]?.value === "as" && clause[part + 2]?.kind === "identifier" ? clause[part + 2].value : imported;
            budget.reserve(128 + 2 * (imported.length + local.length), "javascript-import-bindings", scope);
            bindings.push({ imported, local, typeOnly: bindingTypeOnly });
          }
          while (part < clause.length && ![",", "}"].includes(clause[part]?.value ?? ""))
            part += 1;
          if (clause[part]?.value === ",")
            part += 1;
        }
      }
      budget.reserve(192 + 2 * values[cursor + 1].value.length, "javascript-imports", scope);
      imports.push({ specifier: stringLiteralValue(values[cursor + 1].value), bindings: bindings.sort((a, b) => compareCodePoint(a.imported, b.imported) || compareCodePoint(a.local, b.local)), typeOnly });
      budget.release((cursor - clauseStart) * 8);
      index = cursor + 1;
    }
    return imports;
  } finally {
    budget.release(tokens.length * 8);
  }
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
function maskCommentsAndLiterals(content) {
  let result = "";
  let index = 0;
  while (index < content.length) {
    const character = content[index];
    const next = content[index + 1];
    if (character === "/" && next === "/") {
      while (index < content.length && !/[\r\n]/u.test(content[index])) {
        result += " ";
        index += 1;
      }
      continue;
    }
    if (character === "/" && next === "*") {
      result += "  ";
      index += 2;
      while (index < content.length && !(content[index] === "*" && content[index + 1] === "/")) {
        result += /[\r\n]/u.test(content[index]) ? content[index] : " ";
        index += 1;
      }
      if (index < content.length) {
        result += "  ";
        index += 2;
      }
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      const end = scanQuoted(content, index, character);
      result += " ".repeat(end - index);
      index = end;
      continue;
    }
    result += character;
    index += 1;
  }
  return result;
}
function extractDeclarations(content, scopeKey, budget, scope) {
  const declarations = [];
  budget.reserveString(content.length, "javascript-syntax-mask", scope);
  try {
    const syntax = maskCommentsAndLiterals(content);
    const pattern = /\b(export\s+)?(default\s+)?(?:declare\s+)?(?:async\s+)?(function|class|interface|type|enum|namespace|const|let|var)\s+([A-Za-z_$][\w$]*)/gu;
    for (const match of syntax.matchAll(pattern)) {
      budget.reserve(640 + 2 * (scopeKey.length + match[0].length), "javascript-declarations", scope);
      const rawKind = match[3];
      const kind = ["const", "let", "var"].includes(rawKind) ? "variable" : rawKind;
      const name = match[4];
      const exported = match[1] !== void 0;
      const isDefault = match[2] !== void 0;
      const tailStart = (match.index ?? 0) + match[0].length;
      const nextLine = content.indexOf("\n", tailStart);
      const tail = content.slice(tailStart, nextLine < 0 ? content.length : nextLine);
      const overload = rawKind === "function" && /^[^{]*;/u.test(tail);
      const semantic = { scopeKey, name, kind, exported, default: isDefault, overload };
      const semanticHash = hashFramedDomain("typescript-semantic-declaration", semantic);
      declarations.push({ id: `ts_decl_${hashFramedDomain("typescript-semantic-declaration-identity", { scopeKey, name, kind }).slice(-32)}`, ...semantic, location: sourceLocation(content, match.index ?? 0, (match.index ?? 0) + match[0].length), semanticHash });
    }
    return declarations.sort((left, right) => compareCodePoint(left.id, right.id) || left.location.offset - right.location.offset);
  } finally {
    budget.release(24 + 2 * content.length);
  }
}
function extractExportFacts(content, declarations, budget, scope) {
  const facts = [];
  for (const declaration of declarations)
    if (declaration.exported) {
      budget.reserve(192, "javascript-export-facts", scope);
      facts.push({ exportedName: declaration.default ? "default" : declaration.name, localName: declaration.name, typeOnly: declaration.kind === "type" || declaration.kind === "interface", default: declaration.default, wildcard: false, location: declaration.location });
    }
  const named = /\bexport\s+(type\s+)?\{([^}]*)\}(?:\s+from\s+(["'])([^"']+)\3)?/gu;
  for (const match of content.matchAll(named))
    for (const binding of parseNamedBindings(match[2] ?? "", match[1] !== void 0, budget, scope)) {
      budget.reserve(256 + 2 * (match[4]?.length ?? 0), "javascript-export-facts", scope);
      facts.push({ exportedName: binding.local, localName: binding.imported, ...match[4] === void 0 ? {} : { from: match[4] }, typeOnly: binding.typeOnly, default: binding.local === "default", wildcard: false, location: sourceLocation(content, match.index ?? 0, (match.index ?? 0) + match[0].length) });
    }
  const wildcard = /\bexport\s+\*\s+from\s+(["'])([^"']+)\1/gu;
  for (const match of content.matchAll(wildcard)) {
    budget.reserve(256 + 2 * match[2].length, "javascript-export-facts", scope);
    facts.push({ from: match[2], typeOnly: false, default: false, wildcard: true, location: sourceLocation(content, match.index ?? 0, (match.index ?? 0) + match[0].length) });
  }
  return facts.sort((left, right) => compareCodePoint(left.exportedName ?? "*", right.exportedName ?? "*") || left.location.offset - right.location.offset);
}
function fileParticipantId(scopeKey, declarations, tokens, budget, scope) {
  const anchors = declarations.filter(({ exported }) => exported).map(({ name, kind }) => `${kind}:${name}`).sort(compareCodePoint);
  const hash = anchors.length > 0 ? hashFramedDomain("typescript-participant", { scopeKey, anchor: anchors }) : hashNormalizedTokens(tokens, "typescript-participant", budget, scope, { fields: { scopeKey }, key: "anchor" });
  return `ts_participant_${hash.slice(-32)}`;
}
function extractEvents(tokens, content, scopeKey, participantId, artifactHash, budget, scope) {
  const events = [];
  const uncertainties = [];
  const unknowns = [];
  const values = significantTokens(tokens, budget, scope);
  try {
    for (let index = 0; index < values.length - 4; index += 1) {
      if (values[index]?.kind !== "identifier" || values[index + 1]?.value !== "." || values[index + 2]?.kind !== "identifier" || values[index + 3]?.value !== "(")
        continue;
      const receiver = values[index].value;
      const operation = values[index + 2].value;
      if (!["emit", "publish", "dispatchEvent", "on", "addEventListener", "subscribe"].includes(operation))
        continue;
      const argument = values[index + 4];
      const role = ["emit", "publish", "dispatchEvent"].includes(operation) ? "producer" : "consumer";
      if (argument?.kind !== "string") {
        budget.reserve(512 + 2 * (receiver.length + operation.length + scopeKey.length + participantId.length), "javascript-event-facts", scope);
        const evidenceId = `event_uncertainty_${hashFramedDomain("event-uncertainty", { receiver, role, scopeKey, participantId }).slice(-32)}`;
        uncertainties.push({ receiver, role, scopeKey, participantId, evidenceId, artifactHash });
        unknowns.push(`dynamic event name for ${receiver}.${operation}`);
        continue;
      }
      budget.reserve(768 + 2 * (argument.value.length + receiver.length + scopeKey.length + participantId.length), "javascript-event-facts", scope);
      const semanticKey = stringLiteralValue(argument.value);
      const subjectId = `event_${hashFramedDomain("event-subject", { receiver, semanticKey }).slice(-32)}`;
      const offset = content.indexOf(argument.value);
      const location = sourceLocation(content, Math.max(0, offset), Math.max(0, offset) + argument.value.length);
      events.push({ subjectId, semanticKey, receiver, scopeKey, participantId, role, dynamic: false, location, evidenceId: `event_evidence_${hashFramedDomain("event-evidence", { participantId, role, semanticKey, location }).slice(-32)}`, artifactHash });
    }
    if (values.some((token, index) => token.value === "import" && values[index + 1]?.value === "(")) {
      budget.reserve(128, "javascript-event-facts", scope);
      unknowns.push("dynamic import cannot prove a static dependency");
    }
    return { events: events.sort((left, right) => compareCodePoint(left.subjectId, right.subjectId) || compareCodePoint(left.participantId, right.participantId) || compareCodePoint(left.role, right.role)), uncertainties: uncertainties.sort((left, right) => compareCodePoint(left.receiver, right.receiver) || compareCodePoint(left.participantId, right.participantId)), unknowns: [...new Set(unknowns)].sort(compareCodePoint) };
  } finally {
    budget.release(tokens.length * 8);
  }
}
function resolveLocalImport(importerPath, specifier, paths) {
  if (!specifier.startsWith("."))
    return void 0;
  const base = posix.normalize(posix.join(posix.dirname(importerPath), specifier));
  const candidates = extname(base).length > 0 ? [base, ...base.endsWith(".js") ? [`${base.slice(0, -3)}.ts`, `${base.slice(0, -3)}.tsx`] : [], ...base.endsWith(".mjs") ? [`${base.slice(0, -4)}.mts`] : [], ...base.endsWith(".cjs") ? [`${base.slice(0, -4)}.cts`] : []] : [...sourceExtensions.map((extension) => `${base}${extension}`), ...sourceExtensions.map((extension) => `${base}/index${extension}`)];
  return candidates.find((candidate) => paths.has(candidate));
}
function analyzeJavaScript(entries, budget = new DerivedObservationBudget()) {
  budget.reserveItems(entries.length, 128, "javascript-file-index");
  let scratchBytes = entries.length * 128;
  const sourceEntries = entries.filter((entry) => entry.kind === "file" && sourceExtensions.some((extension) => entry.path.endsWith(extension))).sort((left, right) => compareCodePoint(left.path, right.path));
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
      const declarations = extractDeclarations(entry.content, scopeKey, budget, entry.path);
      const exportFacts = extractExportFacts(entry.content, declarations, budget, entry.path);
      const exports = [...new Set(extractExports(tokens, budget, entry.path))].sort(compareCodePoint);
      const participantId = fileParticipantId(scopeKey, declarations, tokens, budget, entry.path);
      const extractedEvents = extractEvents(tokens, entry.content, scopeKey, participantId, entry.contentHash, budget, entry.path);
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
        testNames: extractTestNames(tokens, budget, entry.path),
        semanticHash: hashNormalizedTokens(tokens, "projector.local-semantic", budget, entry.path),
        fallbackHash: hashNormalizedTokens(tokens, "local-unit-fallback", budget, entry.path),
        variantHash: hashNormalizedTokens(tokens, "local-unit-variant", budget, entry.path),
        participantId,
        scopeKey,
        declarations,
        exportFacts,
        unknowns: extractedEvents.unknowns
      });
      for (const syntax of extractImportSyntax(tokens, budget, entry.path)) {
        const resolvedPath = resolveLocalImport(entry.path, syntax.specifier, paths);
        budget.reserve(256 + 2 * (entry.path.length + syntax.specifier.length + (resolvedPath?.length ?? 0)) + 32 * syntax.bindings.length, "javascript-dependencies", entry.path);
        dependencies.push({
          sourceClass: "derived",
          importerPath: entry.path,
          specifier: syntax.specifier,
          ...resolvedPath === void 0 ? {} : { resolvedPath },
          importedBindings: [...new Set(syntax.bindings.map(({ imported }) => imported))].sort(compareCodePoint),
          bindings: syntax.bindings,
          typeOnly: syntax.typeOnly
        });
        if (syntax.specifier.startsWith(".") && resolvedPath === void 0) {
          budget.reserve(256 + 2 * (entry.path.length + syntax.specifier.length), "javascript-failures", entry.path);
          failures.push({
            analyzerId: "projector.javascript-local",
            capability: "module-resolution",
            scope: entry.path,
            message: `Cannot resolve local module ${syntax.specifier}`,
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
function parseStatus(output) {
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
  const status = parseStatus(commandResults[2]);
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
  let deleted = [];
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
    deleted = parseBatchContents(await gitBytes(["cat-file", "--batch"], `${objectIds.join("\n")}
`), objectIds, sizes, status.deleted);
    for (const candidate of deleted)
      budget.assertFileBytes(Buffer.byteLength(candidate.content), candidate.path);
  }
  const entryByPath = new Map((options.entries ?? []).filter((entry) => entry.kind === "file").map((entry) => [entry.path, entry]));
  const untracked = status.untracked.flatMap((path) => {
    const entry = entryByPath.get(path);
    return entry === void 0 ? [] : [{ path, content: entry.content }];
  });
  return {
    availability: "available",
    revision,
    identities: identities.sort((a, b) => compareCodePoint(a.path, b.path)),
    moves: status.moves,
    failures: [],
    pendingMoveCandidates: { deleted, untracked }
  };
}
function moveFingerprint(path, content, budget) {
  if (content.includes("\0") || content.includes("\uFFFD"))
    return void 0;
  const temporaryStart = budget.usedBytes;
  let fingerprint;
  try {
    const javaScript = /\.(?:[cm]?[jt]s|[jt]sx)$/iu.test(path);
    const comparable = javaScript ? normalizeJavaScriptSemantics(content, budget, path) : content;
    fingerprint = createHash("sha256").update(javaScript ? "javascript\0" : "bytes\0").update(comparable).digest("hex");
  } finally {
    budget.release(budget.usedBytes - temporaryStart);
  }
  budget.reserveString(fingerprint.length, "git-move-fingerprint", path);
  return fingerprint;
}
function finalizeGitFacts(facts, budget = new DerivedObservationBudget()) {
  const candidates = facts.pendingMoveCandidates;
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
  const startedBytes = budget.usedBytes;
  let retainedMoveBytes = 0;
  try {
    budget.reserveItems(candidates.untracked.length, 128, "git-move-candidates");
    const contents = new Map(candidates.untracked.flatMap(({ path, content }) => {
      const fingerprint = moveFingerprint(path, content, budget);
      return fingerprint === void 0 ? [] : [[path, fingerprint]];
    }));
    const moves = [...facts.moves];
    for (const { path: fromPath, content } of candidates.deleted) {
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
var adapterVersion = "2.2.0";
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
      if (/\.(?:mjs|js|cjs|mts|ts)$/u.test(target) && !target.includes("*"))
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
  if (/\.test\.(?:mjs|js|cjs|mts|ts)$/u.test(entry.path))
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
function stableSemanticKey(entry, javaScript, role) {
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
  return `${role}:${javaScript?.fallbackHash ?? hashFramedDomain("local-unit-fallback", entry.content)}`;
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
      adapterVersion,
      supportedLanguages: ["JavaScript", "TypeScript"],
      supportedSemantics: ["static-imports", "named-exports", "test-targets", "hook-lifecycle", "package-script-invocations"],
      enumeration: {
        observability: "bounded",
        method: "no-exec-local-syntax-extraction",
        assumptions: ["ES module syntax uses static string specifiers"],
        blindSpots: ["dynamic imports", "computed module paths", "re-exports lists", "full TypeScript type semantics"],
        dynamicMechanisms: ["dynamic import", "runtime module resolution"]
      },
      executesRepositoryCode: false
    },
    {
      analyzerId: "projector.typescript-semantic",
      adapterVersion,
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
  const inventoryResult = await inventoryRepository(repositoryRoot, { budget, ...signalOption });
  const gitFacts = await collectGitFacts(repositoryRoot, inventoryResult.entries.map((entry) => entry.path), {
    budget,
    ...signalOption,
    entries: inventoryResult.entries,
    confirmedNonGit: inventoryResult.enumeration.method === "recursive-filesystem-fallback"
  });
  budget.check("collection");
  return { options: {
    repositoryRoot,
    ...options.observedAt === void 0 ? {} : { observedAt: options.observedAt },
    ...options.observationRevision === void 0 ? {} : { observationRevision: options.observationRevision }
  }, inventoryResult, gitFacts };
}
function analyzeCollectedLocalRepository(collected, derivedBudget = new DerivedObservationBudget(collected.inventoryResult.observationDescriptor.limits.maxDerivedBytes)) {
  const { options, inventoryResult } = collected;
  const inventory = inventoryResult.entries;
  const packageFacts = analyzePackageScripts(inventory);
  const javaScriptFacts = analyzeJavaScript(inventory, derivedBudget);
  const documentFacts = analyzeDocuments(inventory);
  const gitFacts = finalizeGitFacts(collected.gitFacts, derivedBudget);
  const hookReachable = hookReachablePaths(javaScriptFacts.files, javaScriptFacts.dependencies);
  const javaScriptByPath = new Map(javaScriptFacts.files.map((facts) => [facts.path, facts]));
  const gitByPath = new Map(gitFacts.identities.map((identity) => [identity.path, identity]));
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
    const { role } = roleFor(entry, javaScript, packageFacts.invocations, javaScriptFacts.testTargets, hookReachable);
    const key = stableSemanticKey(entry, javaScript, role);
    baseSemanticKeys.set(entry.path, key);
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }
  const semanticKeys = /* @__PURE__ */ new Map();
  for (const entry of inventory) {
    const javaScript = javaScriptByPath.get(entry.path);
    const baseSemanticKey = baseSemanticKeys.get(entry.path);
    const semanticKey = keyCounts.get(baseSemanticKey) === 1 ? baseSemanticKey : `${baseSemanticKey}:variant:${javaScript?.variantHash ?? hashFramedDomain("local-unit-variant", entry.content)}`;
    semanticKeys.set(entry.path, semanticKey);
  }
  for (const entry of inventory) {
    const javaScript = javaScriptByPath.get(entry.path);
    const { role, evidence } = roleFor(entry, javaScript, packageFacts.invocations, javaScriptFacts.testTargets, hookReachable);
    derivedBudget.reserve(3072 + 4 * entry.path.length + 64 * evidence.length, "local-artifact-facts", entry.path);
    const semanticKey = semanticKeys.get(entry.path);
    const movedFrom = gitFacts.moves.find((move) => move.toPath === entry.path)?.fromPath;
    const observationKey = `source:${movedFrom ?? entry.path}`;
    const artifactId = deriveEntityId("projector.repository-artifact", observationKey);
    const unitId = deriveEntityId("projector.projection-unit", observationKey);
    const structuralFields = {
      role,
      exports: javaScript?.exports ?? [],
      lifecycleExports: javaScript?.lifecycleExports ?? [],
      dependencySpecifiers: javaScriptFacts.dependencies.filter((dependency) => dependency.importerPath === entry.path).map((dependency) => dependency.specifier).sort(compareCodePoint)
    };
    const structuralSignature = signature("projector.local-structural", semanticKey, structuralFields, javaScript === void 0 ? void 0 : hashJavaScriptSemantics(entry.content, "projector.local-structural", derivedBudget, entry.path, {
      fields: structuralFields,
      key: "syntaxTokens"
    }));
    const semanticSignature = signature("projector.local-semantic", semanticKey, entry.content, javaScript?.semanticHash);
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

export {
  observationFailure,
  checkObservation,
  observationMap,
  readObservationFile,
  GitCommandError,
  observationGit,
  isExcludedInventoryPath,
  inventoryRepository,
  analyzeDocuments,
  hashJavaScriptSemantics,
  normalizeJavaScriptSemantics,
  analyzeJavaScript,
  collectGitFacts,
  finalizeGitFacts,
  compileEventContractTopology,
  compileAuthenticatedAnalyzerTopology,
  createTopologyRelevanceQueryStatePort,
  createTopologyRelevanceAdapter,
  compileRepositoryTopology,
  detectMechanicalDivergences,
  analyzeLocalRepository,
  collectLocalRepositoryInputs,
  analyzeCollectedLocalRepository
};
