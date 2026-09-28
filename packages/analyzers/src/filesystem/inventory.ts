import { lstat, opendir, readlink } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { ObservationBudget, ObservationError, hashFramedDomain, type AnalyzerFailure, type ContentHash,
  type ObservationDescriptor, type ObservationLimits } from "@projector/core";
import { compareCodePoint } from "../ordering.js";
import { checkObservation, GitCommandError, observationFailure, observationGit, observationMap, readObservationFile } from "./observation-io.js";

export interface InventoryEntry {
  readonly path: string; readonly kind: "file" | "symlink"; readonly mediaType: string;
  readonly content: string; readonly contentHash: ContentHash; readonly generated: boolean;
  readonly generatedReason?: "source-marker"; readonly symlinkTarget?: string;
}
export interface InventoryResult {
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
export interface InventoryByteReuse {
  readonly baseline: InventoryResult;
  readonly changedPaths: readonly string[];
  readonly uncoveredPrefixes: readonly string[];
}
export interface InventoryOptions { readonly observationLimits?: Partial<ObservationLimits>; readonly budget?: ObservationBudget; readonly signal?: AbortSignal; readonly byteReuse?: InventoryByteReuse; }
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
export async function readInventoryEntry(repositoryRoot:string,path:string,budget:ObservationBudget,signal?:AbortSignal):Promise<InventoryEntry|undefined>{
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
    return{path,kind:"symlink",mediaType:"inode/symlink",content:symlinkTarget,contentHash:hashFramedDomain("repository-artifact-content",symlinkTarget),generated:false,symlinkTarget};
  }
  const bytes=await readObservationFile(absolute,budget,path,signal),content=bytes.toString("utf8");
  const generated=/(?:@generated|generated file|do not edit)/iu.test(content.slice(0,1024));
  return{path,kind:"file",mediaType:mediaType(path),content,contentHash:hashFramedDomain("repository-artifact-content",bytes.toString("base64")),generated,...(generated?{generatedReason:"source-marker" as const}:{})};
}
async function confirmedNonGit(root: string, error: unknown): Promise<boolean> {
  if (!(error instanceof GitCommandError) || !/not a git repository/iu.test(error.stderr)) return false;
  for (let directory = root; ; directory = dirname(directory)) {
    try { await lstat(join(directory, ".git")); return false; }
    catch (markerError) { if (!missing(markerError)) return false; }
    if (dirname(directory) === directory) return true;
  }
}

export async function inventoryRepository(repositoryRoot: string, options: InventoryOptions = {}): Promise<InventoryResult> {
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
  let output = "";
  try { output = await observationGit(root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], budget,
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
      entries.push(cached.entry); capturedBytes.set(path, cached); return;
    }
    if (stat.isSymbolicLink()) {
      const symlinkTarget = await readlink(absolute);
      const size = Buffer.byteLength(symlinkTarget); budget.assertFileBytes(size, path); budget.consume("maxTotalBytes", size, "symlink-read", path);
      entries.push({ path, kind: "symlink", mediaType: "inode/symlink", content: symlinkTarget,
        contentHash: hashFramedDomain("repository-artifact-content", symlinkTarget), generated: false, symlinkTarget });
      capturedBytes.set(path, { entry: Object.freeze({ ...entries.at(-1)! }), size });
      return;
    }
    const bytes = await readObservationFile(absolute, budget, path, activeSignal), content = bytes.toString("utf8");
    const generated = /(?:@generated|generated file|do not edit)/iu.test(content.slice(0, 1024));
    entries.push({ path, kind: "file", mediaType: mediaType(path), content,
      contentHash: hashFramedDomain("repository-artifact-content", bytes.toString("base64")), generated,
      ...(generated ? { generatedReason: "source-marker" as const } : {}) });
    capturedBytes.set(path, { entry: Object.freeze({ ...entries.at(-1)! }), size: bytes.length });
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
      const paths = new Set<string>();
      for (let start = 0; start < output.length;) {
        const end = output.indexOf("\0", start); if (end < 0) throw new Error("Git inventory is not NUL terminated");
        const path = output.slice(start, end); start = end + 1;
        if (path && !isExcludedInventoryPath(path)) { countFile(path); paths.add(path); }
      }
      output = "";
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
  const result: InventoryResult = { entries, failures: [], rootAvailability: "available",directories:[...countedDirectories].sort(compareCodePoint),
    observationDescriptor: { schemaVersion: "projector.observation/v1", observerVersion: "3.0.0", scope: ".", enumerationMethod: method,
      limits: budget.limits, ignoreSources, excludedPaths: [...excludedPrefixes, ...(method === "recursive-filesystem-fallback" ? ["**/node_modules"] : [])], globalGitConfig: "disabled" },
    enumeration: { method, assumptions: [method === "git-index-and-nonignored-untracked" ? "Git CLI can read repository ignore and index metadata" : "repository root is readable"],
      blindSpots: method === "git-index-and-nonignored-untracked" ? ["untracked Git-ignored files outside the repository inventory", "excluded .git, .worktrees, and .projector/runtime contents"]
        : ["confirmed non-Git repository; recursive bounded enumeration used", "excluded .git, .worktrees, node_modules, and .projector/runtime contents"] } };
  inventoryBytes.set(result, { root, entries: capturedBytes });
  return result;
}
