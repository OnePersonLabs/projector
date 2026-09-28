import { createHash } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { access, lstat, opendir, readFile, realpath } from "node:fs/promises";
import { delimiter, dirname, isAbsolute, join, relative, sep } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { hashFramedDomain, type ContentHash, type ObservationBudget } from "@projector/core";

/** Enumerate actual installed package bytes; callers cannot declare producer closure. */
export async function resolveHostGitExecutable(repositoryRoot: string): Promise<string> {
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    const canonical = directory.replace(/^"|"$/gu, "");
    if (!isAbsolute(canonical)) continue;
    const candidate = join(canonical, process.platform === "win32" ? "git.exe" : "git");
    try {
      const path = await realpath(candidate), fromRepository = relative(repositoryRoot, path);
      if (fromRepository !== ".." && !fromRepository.startsWith(`..${sep}`) && !isAbsolute(fromRepository)) continue;
      if (!(await lstat(path)).isFile()) continue;
      await access(path, constants.X_OK); return path;
    } catch (error) { if (!(error instanceof Error && "code" in error && ["ENOENT", "ENOTDIR", "EACCES"].includes(String(error.code)))) throw error; }
  }
  throw new Error("A host Git executable outside the repository must be available on the absolute host PATH");
}
export async function captureBuiltinProducer(entryUrl: string, budget: ObservationBudget, signal: AbortSignal, transport: { path: string; version: string }) {
  const files: Record<string, ContentHash> = {}, visited = new Set<string>();
  async function hash(path: string, identity: string) {
    signal.throwIfAborted(); budget.consume("maxFiles", 1, "closed-producer", identity);
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`Unsupported installed producer file: ${identity}`);
    budget.consume("maxTotalBytes", metadata.size, "closed-producer", identity);
    const digest = createHash("sha256"), stream = createReadStream(path);
    for await (const chunk of stream) { signal.throwIfAborted(); budget.check("closed-producer", identity); digest.update(chunk as Buffer); }
    const result: ContentHash = `sha256:v1:${digest.digest("hex")}`;
    if (files[identity] !== undefined && files[identity] !== result) throw new Error(`Installed dependency identity has different bytes: ${identity}`);
    files[identity] = result;
  }
  async function packageRoot(entry: string): Promise<string> {
    for (let path = dirname(await realpath(entry)); ; path = dirname(path)) {
      try { const manifest = JSON.parse(await readFile(join(path, "package.json"), "utf8")); if (typeof manifest.name === "string") return path; }
      catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
      if (dirname(path) === path) throw new Error(`Installed producer package cannot be resolved: ${entry}`);
    }
  }
  async function visitPackage(root: string) {
    root = await realpath(root); if (visited.has(root)) return; visited.add(root);
    const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { name: string; version: string; dependencies?: Record<string, string>; optionalDependencies?: Record<string, string> };
    const identity = `${manifest.name}@${manifest.version}`;
    await hash(join(root, "package.json"), `${identity}/package.json`);
    async function walk(directory: string, relative: string) {
      signal.throwIfAborted(); budget.consume("maxDirectories", 1, "closed-producer", `${identity}/${relative}`);
      for await (const entry of await opendir(directory)) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        const path = join(directory, entry.name), key = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isSymbolicLink()) throw new Error(`Installed producer package contains a symlink: ${identity}/${key}`);
        if (entry.isDirectory()) await walk(path, key);
        else if (entry.isFile() && key !== "package.json") await hash(path, `${identity}/${key}`);
        else if (!entry.isFile()) throw new Error(`Unsupported installed producer entry: ${identity}/${key}`);
      }
    }
    if (manifest.name.startsWith("@projector/")) await walk(join(root, "dist"), "dist");
    else await walk(root, "");
    const require = createRequire(join(root, "package.json"));
    for (const name of Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies }).sort()) {
      let entry: string;
      try { entry = require.resolve(name); }
      catch (error) {
        try { entry = require.resolve(`${name}/package.json`); }
        catch { throw new Error(`Installed producer dependency is unavailable: ${identity}: ${name}`, { cause: error }); }
      }
      await visitPackage(await packageRoot(entry));
    }
  }
  const entry = fileURLToPath(entryUrl), root = await packageRoot(entry);
  await visitPackage(root);
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { name: string };
  const relativeEntry = relative(root, await realpath(entry)).replaceAll("\\", "/");
  // The npm layout executes dist modules. The standalone plugin bundles those
  // same modules into shared ESM chunks, whose complete bytes were hashed above.
  const emittedModule = relativeEntry.startsWith("dist/")
    || (manifest.name === "@onepersonlabs/projector" && /^chunks\/shared-[^/]+\.js$/u.test(relativeEntry));
  const production = emittedModule && !process.env.NODE_OPTIONS && !process.execArgv.some(arg => /^(?:--import|--loader|--experimental-loader|--require|-r)(?:=|$)/u.test(arg));
  await hash(await realpath(process.execPath), `node@${process.version}/${process.platform}/${process.arch}`);
  await hash(transport.path, `${transport.version.replace(/^git version /u, "git@")}/transport`);
  return { identity: "projector.canonical-integrity/v1", buildHash: hashFramedDomain("closed-producer-build/v1", files), files, production };
}
