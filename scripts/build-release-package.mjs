import { cp as copyFiles, mkdir, readFile, writeFile, lstat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { executeReleaseCommand, resolveNpmCommand } from "./npm-command.mjs";
import { copyRuntimeDependencies } from "./copy-runtime-dependencies.mjs";
import { releasePackageName, releaseVersion } from "./release-identity.mjs";


const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
export { releasePackageName, releaseVersion };
const internalPackages = ["core", "analyzers", "engine", "runtime", "integrations", "control-plane"];
const bundledNames = internalPackages.map((name) => `@projector/${name}`);
const exportTargets = { "./commands": "public-command", "./operations": "operation-runner", "./core": "core", "./analyzers": "analyzers", "./engine": "engine", "./engine/architecture": "engine/architecture", "./engine/coverage": "engine/coverage", "./engine/modernization": "engine/modernization", "./runtime": "runtime", "./integrations": "integrations", "./integrations/surfaces": "integrations/surfaces", "./integrations/models": "integrations/models", "./integrations/codex": "integrations/codex", "./control-plane": "control-plane" };
const operationRuntimeModules = ["operation-runner", "operational-verification", "public-command"];

export async function buildReleasePackage(stagingRoot, packDestination, options = {}) {
  options.signal?.throwIfAborted();
  const cp = async (source, target, copyOptions = {}) => {
    await copyFiles(source, target, { ...copyOptions, filter: (from,to) => { options.signal?.throwIfAborted(); return copyOptions.filter?.(from,to) ?? true; } });
    options.signal?.throwIfAborted();
  };
  if (!basename(stagingRoot).startsWith("projector-release-")) throw new Error("release staging root must be a dedicated projector-release-* directory");
  await mkdir(dirname(stagingRoot), { recursive: true });
  try {
    // Exclusive creation also closes the check/create race between concurrent
    // callers. Existing staging may belong to a still-running release process.
    await mkdir(stagingRoot);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    throw Object.assign(new Error(`Release staging root already exists; preserve its artifacts and choose a new staging path: ${stagingRoot}`, { cause: error }), { code: "RELEASE_STAGING_EXISTS" });
  }
  await mkdir(packDestination, { recursive: true });
  await mkdir(join(stagingRoot, "dist"), { recursive: true }); await mkdir(join(stagingRoot, "exports"), { recursive: true }); await mkdir(join(stagingRoot, "node_modules/@projector"), { recursive: true });
  for (const module of operationRuntimeModules) for (const extension of [".js", ".js.map", ".d.ts", ".d.ts.map"]) await cp(join(repositoryRoot, `packages/cli/dist/${module}${extension}`), join(stagingRoot, `dist/${module}${extension}`));
  for (const name of internalPackages) { const source = join(repositoryRoot, `packages/${name}`); const target = join(stagingRoot, `node_modules/@projector/${name}`); await mkdir(target, { recursive: true }); await cp(join(source, "dist"), join(target, "dist"), { recursive: true, filter: async (from) => {
    if ((await lstat(from)).isDirectory()) return true;
    const item = relative(join(source, "dist"), from);
    if (/\.test\.|\.tsbuildinfo$/u.test(item)) return false;
    if (item.endsWith(".ps1")) return name === "runtime" && basename(item) === "windows-job-supervisor.ps1";
    const original = item.replace(/(?:\.d\.ts|\.js)(?:\.map)?$/u, ".ts");
    return original !== item && existsSync(join(source, "src", original));
  } }); const manifest = JSON.parse(await readFile(join(source, "package.json"), "utf8")); if (manifest.version !== releaseVersion) throw new Error(`${manifest.name} version does not match root release version ${releaseVersion}`); manifest.private = false; for (const group of ["dependencies", "optionalDependencies", "peerDependencies"]) if (manifest[group] !== undefined) for (const [dependency, version] of Object.entries(manifest[group])) if (typeof version === "string" && version.startsWith("workspace:")) manifest[group][dependency] = releaseVersion; await writeFile(join(target, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`); }
  const externalRequests = [];
  for (const name of internalPackages) {
    const from = join(repositoryRoot, "packages", name);
    const manifest = JSON.parse(await readFile(join(from, "package.json"), "utf8"));
    for (const dependency of Object.keys(manifest.dependencies ?? {})) if (!dependency.startsWith("@projector/")) externalRequests.push({ name: dependency, from });
  }
  externalRequests.push({ name: "@types/node", from: repositoryRoot });
  const externalDependencies = await copyRuntimeDependencies(externalRequests, stagingRoot, options);
  for (const [subpath, target] of Object.entries(exportTargets)) { const name = subpath.slice(2).replaceAll("/", "-"); const statement = operationRuntimeModules.includes(target) ? `export * from "../dist/${target}.js";\n` : `export * from "@projector/${target.split("/")[0]}${target.includes("/") ? `/${target.split("/").slice(1).join("/")}` : ""}";\n`; await writeFile(join(stagingRoot, `exports/${name}.js`), statement); await writeFile(join(stagingRoot, `exports/${name}.d.ts`), `/// <reference types="node" />\n${statement}`); }
  await writeFile(join(stagingRoot, "dist/command-main.mjs"), [
    '#!/usr/bin/env node',
    'import { fileURLToPath } from "node:url";',
    'import { createBundledProjectorOperationRunner } from "./operation-runner.js";',
    'import { runPublicCommand } from "./public-command.js";',
    'try {',
    ' const packagedRoot = fileURLToPath(new URL("..", import.meta.url));',
    ' const runner = await createBundledProjectorOperationRunner({ packagedRoot });',
    ' const result = await runPublicCommand(process.argv.slice(2), { runner, cwd: process.cwd() });',
    ' process.stdout.write(result.text); process.exitCode = result.exitCode;',
    '} catch (error) { process.stderr.write(String(error.message ?? error) + "\\n"); process.exitCode = 2; }',
  ].join("\n") + "\n");
  const packageJson = { name: releasePackageName, version: releaseVersion, description: "Readable project meaning, task context and consequence checks for Codex", type: "module", bin: { projector: "./dist/command-main.mjs" }, engines: { node: ">=24" }, exports: Object.fromEntries(Object.keys(exportTargets).map((subpath) => { const base = `./exports/${subpath.slice(2).replaceAll("/", "-")}`; return [subpath, { types: `${base}.d.ts`, default: `${base}.js` }]; })), files: ["dist", "exports"], dependencies: { ...Object.fromEntries(bundledNames.map((name) => [name, releaseVersion])), ...externalDependencies }, bundledDependencies: [...bundledNames, ...Object.keys(externalDependencies)], publishConfig: { access: "public" } }; await writeFile(join(stagingRoot, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);
  const npmArguments = ["pack", "--json", "--pack-destination", packDestination];
  const { executable, arguments: arguments_ } = await resolveNpmCommand(npmArguments);
  const { stdout } = await executeReleaseCommand(executable, arguments_, { cwd: stagingRoot, signal: options.signal, maxBuffer: 10_000_000 }); const packed = JSON.parse(stdout); const metadata = Array.isArray(packed) ? packed[0] : Object.values(packed)[0]; if (metadata?.name !== releasePackageName || metadata?.version !== releaseVersion || metadata?.filename === undefined) throw new Error("npm pack did not return the expected scoped tarball"); return join(packDestination, metadata.filename);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) { const staging = process.argv[2]; const destination = process.argv[3] ?? (staging === undefined ? undefined : dirname(staging)); if (staging === undefined || destination === undefined) throw new Error("usage: build-release-package <projector-release-staging> [pack-destination]"); process.stdout.write(`${await buildReleasePackage(staging, destination)}\n`); }
