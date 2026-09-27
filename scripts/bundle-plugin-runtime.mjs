import { build } from "esbuild";
import { cp, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** Bundle executable exports while keeping the npm release packaging independent. */
export async function bundlePluginRuntime(releaseRoot, outputRoot, manifest, options = {}) {
  const entries = { "dist/command-main": join(releaseRoot, manifest.bin.projector), "workers/task-worker": join(releaseRoot, "node_modules/@projector/control-plane/dist/observation/task-worker.js") };
  const exports = {};
  for (const [name, target] of Object.entries(manifest.exports)) {
    const runtimePath = typeof target === "string" ? target : target.default;
    if (typeof runtimePath !== "string" || !runtimePath.endsWith(".js")) throw new Error(`Unsupported plugin runtime export: ${name}`);
    entries[runtimePath.replace(/^\.\//u, "").replace(/\.js$/u, "")] = join(releaseRoot, runtimePath);
    exports[name] = runtimePath;
  }
  options.signal?.throwIfAborted();
  const result = await build({
    entryPoints: entries, outdir: outputRoot, absWorkingDir: releaseRoot, bundle: true, splitting: true,
    platform: "node", target: "node24", format: "esm", chunkNames: "chunks/shared-[hash]",
    outExtension: { ".js": ".js" }, metafile: true, legalComments: "linked",
    banner: { js: 'import { createRequire as __projectorCreateRequire } from "node:module"; const require = __projectorCreateRequire(import.meta.url);' },
    plugins: [{ name: "projector-runtime-assets", setup(builder) {
      builder.onLoad({ filter: /[\\/]dist[\\/](observation[\\/]task-runner|execution[\\/]command-executor)\.js$/ }, async ({ path }) => {
        let contents = await readFile(path, "utf8");
        const workerModule = path.replaceAll("\\", "/").endsWith("/observation/task-runner.js");
        const original = workerModule
          ? 'new URL("./task-worker.js", import.meta.url)'
          : 'new URL("./windows-job-supervisor.ps1", import.meta.url)';
        const replacement = workerModule
          ? 'new URL("../workers/task-worker.js", import.meta.url)'
          : 'new URL("../assets/windows-job-supervisor.ps1", import.meta.url)';
        if (!contents.includes(original)) throw new Error(`Cannot bundle ${workerModule ? "observation worker" : "Windows job supervisor"}: expected asset URL expression is absent in ${path}`);
        contents = contents.replace(original, replacement);
        return { contents, loader: "js" };
      });
    } }],
  });
  options.signal?.throwIfAborted();
  // esbuild normalizes output extensions; the public executable keeps its .mjs path.
  const command = await readFile(join(outputRoot, "dist/command-main.js"), "utf8");
  await writeFile(join(outputRoot, "dist/command-main.mjs"), command);
  await unlink(join(outputRoot, "dist/command-main.js"));
  await mkdir(join(outputRoot, "assets"), { recursive: true });
  await cp(join(releaseRoot, "node_modules/@projector/runtime/dist/execution/windows-job-supervisor.ps1"), join(outputRoot, "assets/windows-job-supervisor.ps1"));
  const packages = new Map();
  for (const input of Object.keys(result.metafile.inputs)) {
    const absolute = join(releaseRoot, input);
    const path = relative(releaseRoot, absolute).replaceAll("\\", "/");
    const match = /^node_modules\/((?:@[^/]+\/)?[^/]+)\//u.exec(path);
    if (match === null) continue;
    const name = match[1];
    if (packages.has(name)) continue;
    const root = join(releaseRoot, "node_modules", name);
    const packageManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    packages.set(name, { name, version: packageManifest.version, license: packageManifest.license });
    for (const file of await readdir(root)) {
      if (!/^(?:license|licence|notice|copyright)(?:\.|$)/iu.test(file)) continue;
      const destination = join(outputRoot, "licenses", name.replaceAll("/", "__"), file);
      await mkdir(dirname(destination), { recursive: true });
      await cp(join(root, file), destination);
    }
  }
  await mkdir(join(outputRoot, "licenses"), { recursive: true });
  await writeFile(join(outputRoot, "licenses/third-party.json"), `${JSON.stringify([...packages.values()].sort((a, b) => a.name.localeCompare(b.name)), null, 2)}\n`);
  await cp(fileURLToPath(new URL("../LICENSE", import.meta.url)), join(outputRoot, "LICENSE"));
  await writeFile(join(outputRoot, "package.json"), `${JSON.stringify({ name: manifest.name, version: manifest.version, description: manifest.description, type: "module", engines: manifest.engines, bin: manifest.bin, exports }, null, 2)}\n`);
}
