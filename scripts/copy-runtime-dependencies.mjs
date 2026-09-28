import { cp, mkdir, readFile, realpath, stat } from "node:fs/promises";
import { findPackageJSON } from "node:module";
import { dirname, join } from "node:path";

async function packageRoot(name, from) {
  const manifestPath = findPackageJSON(name, join(from, "package.json"));
  if (manifestPath === undefined) throw Object.assign(new Error(`Cannot locate the installed manifest for ${name} from ${from}`), { code: "MODULE_NOT_FOUND" });
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.name !== name) throw new Error(`Installed dependency ${name} resolved to ${manifest.name} from ${from}`);
  return dirname(manifestPath);
}

/** Copy the installed production dependency graph, preserving version conflicts.
 * Internal workspace packages are assembled by the caller. No network install,
 * lifecycle scripts, or symlinks into the development checkout enter the bundle.
 */
export async function copyRuntimeDependencies(requests, stagingRoot, options = {}) {
  const roots = new Map();
  const bundled = new Map();
  async function copy(name, from, parent, ancestors) {
    options.signal?.throwIfAborted();
    if (name.startsWith("@projector/")) return;
    const source = await realpath(await packageRoot(name, from));
    const manifest = JSON.parse(await readFile(join(source, "package.json"), "utf8"));
    const key = `${manifest.name}@${manifest.version}`;
    if (ancestors.get(name) === key) return;
    let target;
    const existing = roots.get(name);
    if (existing === key) return;
    if (existing === undefined) {
      roots.set(name, key);
      bundled.set(name, manifest.version);
      target = join(stagingRoot, "node_modules", name);
    } else target = join(parent, "node_modules", name);
    await mkdir(dirname(target), { recursive: true });
    try {
      await stat(target);
      const prior = JSON.parse(await readFile(join(target, "package.json"), "utf8"));
      if (`${prior.name}@${prior.version}` !== key) throw new Error(`Conflicting installed dependencies at ${target}`);
      return;
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    await cp(source, target, { recursive: true, dereference: true, filter: path => { options.signal?.throwIfAborted(); return path !== join(source, "node_modules"); } });
    const next = new Map(ancestors).set(name, key);
    for (const dependency of Object.keys(manifest.dependencies ?? {}).sort()) await copy(dependency, source, target, next);
    // Optional packages may legitimately be absent for this platform. Preserve an
    // installed one; report other resolver failures rather than masking them.
    for (const dependency of Object.keys(manifest.optionalDependencies ?? {}).sort()) {
      try { await packageRoot(dependency, source); }
      catch (error) { if (error.code === "MODULE_NOT_FOUND") continue; throw error; }
      await copy(dependency, source, target, next);
    }
  }
  for (const { name, from } of requests) await copy(name, from, stagingRoot, new Map());
  return Object.fromEntries([...bundled].sort(([a],[b])=>a.localeCompare(b)));
}
