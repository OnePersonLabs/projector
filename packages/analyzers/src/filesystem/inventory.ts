import { constants } from "node:fs";
import { lstat, open, opendir, readlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { ObservationBudget, ObservationError, hashFramedDomain, type AnalyzerFailure, type SourceContentEntry,
  type ObservationDescriptor, type ObservationLimits } from "@projector/core";
import { compareCodePoint } from "../ordering.js";
import { checkObservation, GitCommandError, observationFailure, observationGit, observationGitRecords, observationMap, readObservationFile } from "./observation-io.js";
import { inventoryEntryChunks, inventoryEntryWithBytes, type InventoryContentDescriptor, type InventoryEntryMetadata } from "./inventory-content-store.js";

export interface InventoryEntry extends SourceContentEntry {}
export interface InventoryCapturePort {
  readonly descriptor: InventoryContentDescriptor;
  capture(path: string, absolute: string, mediaType: string, budget: ObservationBudget, signal?: AbortSignal): Promise<InventoryEntry>;
  put(metadata: InventoryEntryMetadata, content: string): InventoryEntry | Promise<InventoryEntry>;
  putChunks(metadata: InventoryEntryMetadata, chunks: Iterable<Uint8Array>): InventoryEntry | Promise<InventoryEntry>;
  linkExisting?(metadata: InventoryEntryMetadata, versionId: string): InventoryEntry;
  finish(): void | Promise<void>;
  beginAppend(): void | Promise<void>;
}
export interface InventoryResult {
  readonly contentStore?: InventoryContentDescriptor;
  readonly entries: InventoryEntry[]; readonly failures: AnalyzerFailure[];
  readonly rootAvailability: "available" | "unavailable";
  /** Exact directory admission population, including inspected ignored candidates. */
  readonly directories?: readonly string[];
  readonly observationDescriptor: ObservationDescriptor;
  readonly enumeration: {
    readonly method: "git-index-and-nonignored-untracked" | "recursive-filesystem-fallback" | "git-immutable-tree";
    readonly assumptions: readonly string[]; readonly blindSpots: readonly string[];
  };
}
export type InventoryIdentity = Pick<InventoryEntry, "path" | "kind" | "mediaType" | "contentHash" | "generated" | "generatedReason" | "symlinkTarget">;
export type InventoryIdentityResult = Omit<InventoryResult, "entries" | "contentStore"> & { readonly entries: readonly InventoryIdentity[] };
export interface InventoryByteReuse {
  readonly baseline: InventoryResult;
  readonly changedPaths: readonly string[];
  readonly uncoveredPrefixes: readonly string[];
}
export interface InventoryOptions { readonly observationLimits?: Partial<ObservationLimits>; readonly budget?: ObservationBudget; readonly signal?: AbortSignal; readonly byteReuse?: InventoryByteReuse; readonly contentStore?: InventoryCapturePort; readonly deferContentStoreFinish?: boolean; }

class Base64ContentHasher {
  private readonly hash = createHash("sha256");
  private carry = Buffer.alloc(0);
  constructor(size: number) {
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
  update(input: Uint8Array): void {
    const bytes = this.carry.length === 0 ? Buffer.from(input) : Buffer.concat([this.carry, input]);
    const complete = bytes.length - bytes.length % 3;
    if (complete > 0) this.hash.update(bytes.subarray(0, complete).toString("base64"));
    this.carry = Buffer.from(bytes.subarray(complete));
  }
  digest(): string {
    if (this.carry.length > 0) this.hash.update(this.carry.toString("base64"));
    this.hash.update('"');
    return `sha256:v1:${this.hash.digest("hex")}`;
  }
}

async function fileIdentity(path: string, absolute: string, media: string, budget: ObservationBudget, signal?: AbortSignal): Promise<InventoryIdentity> {
  const handle = await open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const before = await handle.stat();
    if (!before.isFile()) throw new ObservationError("observation-failed", "inventory-proof", path, "Inventory source is not a regular file");
    budget.assertFileBytes(before.size, path);
    const digest = new Base64ContentHasher(before.size);
    let total = 0;
    let prefix = Buffer.alloc(0);
    const buffer = Buffer.allocUnsafe(64 * 1024);
    while (true) {
      checkObservation(budget, signal, "inventory-proof", path);
      const { bytesRead } = await handle.read(buffer);
      if (bytesRead === 0) break;
      const bytes = buffer.subarray(0, bytesRead);
      total += bytesRead;
      budget.assertFileBytes(total, path);
      budget.consume("maxTotalBytes", bytesRead, "inventory-proof", path);
      digest.update(bytes);
      if (prefix.length < 4096) prefix = Buffer.concat([prefix, bytes.subarray(0, 4096 - prefix.length)]);
    }
    const after = await handle.stat();
    if (total !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs || after.ino !== before.ino)
      throw new ObservationError("observation-failed", "inventory-proof", path, "Source changed during final inventory proof");
    const generated = /(?:@generated|generated file|do not edit)/iu.test(prefix.toString("utf8").slice(0, 1024));
    return {path,kind:"file",mediaType:media,contentHash:digest.digest() as InventoryEntry["contentHash"],generated,
      ...(generated ? {generatedReason:"source-marker" as const} : {})};
  } finally { await handle.close(); }
}
const inventoryBytes = new WeakMap<InventoryResult, { root: string; entries: ReadonlyMap<string, { entry: InventoryEntry; size: number }> }>();
const excludedPrefixes = [".git", ".worktrees", ".projector/runtime"] as const;
const fallbackDirectories = new Set([".git", ".worktrees", "node_modules"]);
function repositoryPath(root: string, absolute: string): string { return relative(root, absolute).split(sep).join("/"); }
export function isExcludedInventoryPath(path: string): boolean { return excludedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)); }
function mediaType(path: string): string {
  if (path.endsWith(".json")) return "application/json";
  if (/\.ya?ml$/u.test(path)) return "application/yaml";
  if (path.endsWith(".toml")) return "application/toml";
  if (/\.(?:mjs|cjs|js|jsx)$/u.test(path)) return "text/javascript";
  if (/\.(?:mts|cts|ts|tsx)$/u.test(path)) return "text/typescript";
  if (path.endsWith(".md")) return "text/markdown";
  return "application/octet-stream";
}
function missing(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"; }
/** Addressed leaf reads require a complete population delta from their caller. */
export async function readInventoryEntry(repositoryRoot:string,path:string,budget:ObservationBudget,signal?:AbortSignal,capture?:InventoryCapturePort):Promise<InventoryEntry|undefined>{
  const root=resolve(repositoryRoot);
  checkObservation(budget,signal,"delta-file-read",path);
  if(!path||isAbsolute(path)||path.includes("\\")||path.includes("\0")||path.split("/").some(part=>!part||part==="."||part===".."))throw new ObservationError("observation-failed","delta-file-read",path,"Invalid inventory delta path");
  if(isExcludedInventoryPath(path))return undefined;
  const absolute=resolve(root,...path.split("/"));
  let stat;try{stat=await lstat(absolute);}catch(error){if(missing(error))return undefined;throw observationFailure(error,"delta-file-read",path);}
  for(let parent=dirname(absolute);parent!==root;parent=dirname(parent))if((await lstat(parent)).isSymbolicLink())throw new ObservationError("observation-failed","symlink-parent",path,"Inventory delta traverses a symbolic-link parent");
  if(!stat.isFile()&&!stat.isSymbolicLink())return undefined;
  budget.consume("maxFiles",1,"delta-file-read",path);
  if(stat.isSymbolicLink()){
    const symlinkTarget=await readlink(absolute);const bytes=Buffer.byteLength(symlinkTarget);budget.assertFileBytes(bytes,path);budget.consume("maxTotalBytes",bytes,"delta-symlink-read",path);
    const entry:InventoryEntry={path,kind:"symlink",mediaType:"inode/symlink",content:symlinkTarget,contentHash:hashFramedDomain("repository-artifact-content",symlinkTarget),generated:false,symlinkTarget};
    return capture===undefined?entry:await capture.put({...entry,contentBytes:bytes},symlinkTarget);
  }
  if(capture!==undefined)return capture.capture(path,absolute,mediaType(path),budget,signal);
  const bytes=await readObservationFile(absolute,budget,path,signal),content=bytes.toString("utf8");
  const generated=/(?:@generated|generated file|do not edit)/iu.test(content.slice(0,1024));
  return inventoryEntryWithBytes({path,kind:"file",mediaType:mediaType(path),content,contentHash:hashFramedDomain("repository-artifact-content",bytes.toString("base64")),generated,...(generated?{generatedReason:"source-marker" as const}:{})},bytes);
}
async function confirmedNonGit(root: string, error: unknown): Promise<boolean> {
  if (!(error instanceof GitCommandError) || !/not a git repository/iu.test(error.stderr)) return false;
  for (let directory = root; ; directory = dirname(directory)) {
    try { await lstat(join(directory, ".git")); return false; }
    catch (markerError) { if (!missing(markerError)) return false; }
    if (dirname(directory) === directory) return true;
  }
}

export async function inventoryRepositoryIdentities(repositoryRoot: string, options: Omit<InventoryOptions, "contentStore" | "byteReuse"> = {}): Promise<InventoryIdentityResult> {
  const scanned = await scanInventory(repositoryRoot, options, true);
  return {entries: scanned.entries.map(({path,kind,mediaType,contentHash,generated,generatedReason,symlinkTarget}) =>
    ({path,kind,mediaType,contentHash,generated,...(generatedReason === undefined ? {} : {generatedReason}),
      ...(symlinkTarget === undefined ? {} : {symlinkTarget})})),
    failures: scanned.failures, rootAvailability: scanned.rootAvailability,
    ...(scanned.directories === undefined ? {} : {directories: scanned.directories}),
    observationDescriptor: scanned.observationDescriptor, enumeration: scanned.enumeration};
}

export async function inventoryRepository(repositoryRoot: string, options: InventoryOptions = {}): Promise<InventoryResult> {
  return scanInventory(repositoryRoot, options, false);
}

async function scanInventory(repositoryRoot: string, options: InventoryOptions, identitiesOnly: boolean): Promise<InventoryResult> {
  const root = resolve(repositoryRoot), budget = options.budget ?? new ObservationBudget(options.observationLimits);
  const signal = options.signal;
  const entries: InventoryEntry[] = [], ignoreSources: ObservationDescriptor["ignoreSources"] = [];
  const capturedBytes = new Map<string, { entry: InventoryEntry; size: number }>();
  const generation = options.byteReuse === undefined ? undefined : inventoryBytes.get(options.byteReuse.baseline);
  const baseline = generation?.root === root ? generation.entries : undefined;
  // The prior generation remains resident while new bytes are staged. Charge it
  // once, including removed/dirty entries; unchanged reused bytes need no second allocation.
  if (baseline !== undefined) for (const [path, cached] of baseline) {
    checkObservation(budget, signal, "byte-reuse-admission", path);
    budget.assertFileBytes(cached.size, path);
    budget.consume("maxTotalBytes", cached.size, "byte-reuse-admission", path);
  }
  const countedFiles = new Set<string>(), countedDirectories = new Set<string>();
  const countFile = (path: string): void => {
    if (!countedFiles.has(path)) { budget.consume("maxFiles", 1, "file-enumeration", path); countedFiles.add(path); }
  };
  const countDirectory = (path: string): void => {
    if (!countedDirectories.has(path)) { budget.consume("maxDirectories", 1, "directory-enumeration", path); countedDirectories.add(path); }
  };
  let method: InventoryResult["enumeration"]["method"] = "git-index-and-nonignored-untracked";
  const paths=new Set<string>();
  try { await observationGitRecords(root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], budget,path=>{
    if(path&&!isExcludedInventoryPath(path)){countFile(path);paths.add(path);}
  },
    { ...(signal === undefined ? {} : { signal }), stage: "git-inventory" }); }
  catch (error) { if (!await confirmedNonGit(root, error)) throw observationFailure(error, "git-inventory"); method = "recursive-filesystem-fallback"; }
  const git = (args: readonly string[], input?: string, allowedExitCodes?: readonly number[]): Promise<string> => observationGit(root, args, budget,
    { ...(signal === undefined ? {} : { signal }), ...(input === undefined ? {} : { input }), ...(allowedExitCodes === undefined ? {} : { allowedExitCodes }), stage: "ignore-boundary" });
  async function fingerprint(absolute: string, source: string, activeSignal = signal): Promise<void> {
    let stat;
    try { stat = await lstat(absolute); } catch (error) { if (missing(error)) return; throw error; }
    if (stat.isSymbolicLink()) throw new ObservationError("observation-failed", "ignore-boundary", source, "Ignore/config source is a symbolic link; cannot bind a stable boundary.");
    if (!stat.isFile()) throw new ObservationError("observation-failed", "ignore-boundary", source, "Ignore/config source is not a regular file.");
    countFile(source);
    const bytes = await readObservationFile(absolute, budget, source, activeSignal);
    ignoreSources.push({ path: source, contentHash: hashFramedDomain("repository-ignore-source", bytes.toString("base64")) });
  }
  async function inspect(path: string, allowDeleted = false, activeSignal = signal): Promise<void> {
    checkObservation(budget, activeSignal, "file-enumeration", path);
    if (!path || isAbsolute(path) || path.includes("\0")) throw new Error("Git returned an invalid repository path");
    const absolute = resolve(root, ...path.split("/")), fromRoot = relative(root, absolute);
    if (!fromRoot || fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) throw new Error("Git returned a path outside the repository root");
    let stat;
    try { stat = await lstat(absolute); }
    catch (error) { if (allowDeleted && missing(error)) return; throw observationFailure(error, "artifact-metadata", path); }
    for (let parent = dirname(absolute); parent !== root; parent = dirname(parent)) {
      if ((await lstat(parent)).isSymbolicLink()) throw new ObservationError("observation-failed", "symlink-parent", path, "Git-selected path traverses a symbolic-link parent");
    }
    if (!stat.isFile() && !stat.isSymbolicLink()) return;
    countFile(path);
    const cached = baseline?.get(path);
    const reuse = options.byteReuse;
    if (cached !== undefined && reuse !== undefined && cached.entry.kind === (stat.isSymbolicLink() ? "symlink" : "file") &&
      !reuse.changedPaths.some((changed) => path === changed || path.startsWith(`${changed}/`)) &&
      !reuse.uncoveredPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.split("/").includes(prefix))) {
      budget.assertFileBytes(cached.size, path);
      const sourceVersionId=(cached.entry as InventoryEntry & {sourceVersionId?:string}).sourceVersionId;
      const cachedMetadata=Object.fromEntries(Object.keys(cached.entry).filter(key=>key!=="content").map(key=>
        [key,(cached.entry as unknown as Record<string,unknown>)[key]])) as Omit<InventoryEntry,"content">;
      const entry = options.contentStore === undefined ? cached.entry : sourceVersionId!==undefined&&options.contentStore.linkExisting!==undefined
        ? options.contentStore.linkExisting({...cachedMetadata,contentBytes:cached.size},sourceVersionId)
        : await options.contentStore.putChunks({...cachedMetadata,contentBytes:cached.size},inventoryEntryChunks(cached.entry));
      entries.push(entry); capturedBytes.set(path, {entry,size:cached.size}); return;
    }
    if (stat.isSymbolicLink()) {
      const symlinkTarget = await readlink(absolute);
      const size = Buffer.byteLength(symlinkTarget); budget.assertFileBytes(size, path); budget.consume("maxTotalBytes", size, "symlink-read", path);
      const entry: InventoryEntry = { path, kind: "symlink", mediaType: "inode/symlink", content: symlinkTarget,
        contentHash: hashFramedDomain("repository-artifact-content", symlinkTarget), generated: false, symlinkTarget };
      entries.push(options.contentStore === undefined ? entry : await options.contentStore.put({ ...entry, contentBytes: size },symlinkTarget));
      capturedBytes.set(path, { entry: Object.freeze(Object.defineProperties({},Object.getOwnPropertyDescriptors(entries.at(-1)!))) as InventoryEntry, size });
      return;
    }
    if (identitiesOnly) {
      const identity = await fileIdentity(path, absolute, mediaType(path), budget, activeSignal);
      // This internal entry never escapes the identity-only projection above.
      const entry = identity as InventoryEntry;
      entries.push(entry);
      return;
    }
    if (options.contentStore !== undefined) {
      const entry = await options.contentStore.capture(path, absolute, mediaType(path), budget, activeSignal);
      entries.push(entry); capturedBytes.set(path,{ entry, size:stat.size }); return;
    }
    const bytes = await readObservationFile(absolute, budget, path, activeSignal), content = bytes.toString("utf8");
    const generated = /(?:@generated|generated file|do not edit)/iu.test(content.slice(0, 1024));
    entries.push(inventoryEntryWithBytes({ path, kind: "file", mediaType: mediaType(path), content,
      contentHash: hashFramedDomain("repository-artifact-content", bytes.toString("base64")), generated,
      ...(generated ? { generatedReason: "source-marker" as const } : {}) },bytes));
    capturedBytes.set(path, { entry: Object.freeze(Object.defineProperties({},Object.getOwnPropertyDescriptors(entries.at(-1)!))) as InventoryEntry, size: bytes.length });
  }
  // Streaming traversal sees ignored .gitignore files in otherwise active directories.
  // Git itself decides which directory rules apply.
  async function visit(directory: string, activeSignal = signal): Promise<string[]> {
    const scope = repositoryPath(root, directory) || ".";
    countDirectory(scope);
    if (method === "git-index-and-nonignored-untracked") await fingerprint(join(directory, ".gitignore"), scope === "." ? ".gitignore" : `${scope}/.gitignore`, activeSignal);
    const directories: string[] = [];
    const handle = await opendir(directory, { bufferSize: 32 });
    for await (const child of handle) {
      checkObservation(budget, activeSignal, "directory-enumeration", scope);
      const absolute = join(directory, child.name), path = repositoryPath(root, absolute);
      if (isExcludedInventoryPath(path)) continue;
      if (child.isDirectory()) {
        if (method === "recursive-filesystem-fallback" && fallbackDirectories.has(child.name)) continue;
        countDirectory(path); directories.push(path);
      } else if (method === "recursive-filesystem-fallback") await inspect(path, false, activeSignal);
      else countFile(path);
    }
    return directories;
  }
  try {
    if (method === "git-index-and-nonignored-untracked") {
      const deleted = new Set((await git(["ls-files", "--deleted", "-z"])).split("\0").filter(Boolean));
      await observationMap([...paths].sort(compareCodePoint), (path, signal) => inspect(path, deleted.has(path), signal), signal);
      const boundary = await observationMap([
        ["rev-parse", "--git-path", "config"], ["rev-parse", "--git-path", "config.worktree"], ["rev-parse", "--git-path", "info/exclude"],
        ["config", "--show-origin", "--null", "--list"], ["config", "--path", "--get", "core.excludesFile"],
      ], (args, signal) => observationGit(root, args, budget, { signal, stage: "ignore-boundary", allowedExitCodes: args.includes("--get") ? [1] : [] }), signal);
      ignoreSources.push({ path: "git:effective-config", contentHash: hashFramedDomain("repository-ignore-source", boundary[3]!) });
      await observationMap(["config", "config.worktree", "info/exclude"], (name, signal) => fingerprint(resolve(root,
        boundary[["config", "config.worktree", "info/exclude"].indexOf(name)]!.trim()), `git:${name}`, signal), signal);
      const excludesFile = boundary[4]!.trim();
      if (excludesFile) await fingerprint(resolve(root, excludesFile), `git:core.excludesFile:${excludesFile}`);
    }
    let directories = [root];
    while (directories.length > 0) {
      const candidates = (await observationMap(directories, (directory, signal) => visit(directory, signal), signal)).flat();
      const ignored = new Set<string>();
      if (method === "git-index-and-nonignored-untracked" && candidates.length > 0) {
        const ignoredOutput = await git(["check-ignore", "--no-index", "-z", "--stdin"], candidates.map((path) => `${path}/\0`).join(""), [1]);
        for (const path of ignoredOutput.split("\0")) if (path) ignored.add(path.replace(/\/$/u, ""));
      }
      directories = candidates.filter((path) => !ignored.has(path)).map((path) => resolve(root, ...path.split("/")));
    }
  } catch (error) { throw observationFailure(error, "inventory"); }
  entries.sort((a, b) => compareCodePoint(a.path, b.path));
  ignoreSources.sort((a, b) => compareCodePoint(a.path, b.path));
  if(options.deferContentStoreFinish!==true)await options.contentStore?.finish();
  const result: InventoryResult = { ...(options.contentStore === undefined ? {} : {contentStore:options.contentStore.descriptor}), entries, failures: [], rootAvailability: "available",directories:[...countedDirectories].sort(compareCodePoint),
    observationDescriptor: { schemaVersion: "projector.observation/v1", observerVersion: "3.0.0", scope: ".", enumerationMethod: method,
      limits: budget.limits, ignoreSources, excludedPaths: [...excludedPrefixes, ...(method === "recursive-filesystem-fallback" ? ["**/node_modules"] : [])], globalGitConfig: "disabled" },
    enumeration: { method, assumptions: [method === "git-index-and-nonignored-untracked" ? "Git CLI can read repository ignore and index metadata" : "repository root is readable"],
      blindSpots: method === "git-index-and-nonignored-untracked" ? ["untracked Git-ignored files outside the repository inventory", "excluded .git, .worktrees, and .projector/runtime contents"]
        : ["confirmed non-Git repository; recursive bounded enumeration used", "excluded .git, .worktrees, node_modules, and .projector/runtime contents"] } };
  inventoryBytes.set(result, { root, entries: capturedBytes });
  return result;
}
