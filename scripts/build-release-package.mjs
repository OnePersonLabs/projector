import { execFile } from "node:child_process";
import { chmod, cp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { resolveNpmCommand } from "./npm-command.mjs";
import { releasePackageName, releaseVersion } from "./release-identity.mjs";

const execute = promisify(execFile);
const require = createRequire(import.meta.url);
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
export { releasePackageName, releaseVersion };
const internalPackages = ["core", "analyzers", "engine", "runtime", "integrations", "control-plane", "testkit"];
const bundledNames = internalPackages.map((name) => `@projector/${name}`);
const exportTargets = { ".": "cli", "./cli": "cli", "./operations": "operation-runner", "./core": "core", "./analyzers": "analyzers", "./engine": "engine", "./engine/architecture": "engine/architecture", "./engine/coverage": "engine/coverage", "./engine/modernization": "engine/modernization", "./runtime": "runtime", "./integrations": "integrations", "./integrations/surfaces": "integrations/surfaces", "./integrations/models": "integrations/models", "./integrations/codex": "integrations/codex", "./control-plane": "control-plane", "./testkit": "testkit" };

export async function buildReleasePackage(stagingRoot, packDestination) {
  if (!basename(stagingRoot).startsWith("projector-release-")) throw new Error("release staging root must be a dedicated projector-release-* directory"); await rm(stagingRoot, { recursive: true, force: true }); await mkdir(stagingRoot, { recursive: true }); await mkdir(packDestination, { recursive: true });
  await cp(join(repositoryRoot, "packages/cli/dist"), join(stagingRoot, "dist"), { recursive: true }); await mkdir(join(stagingRoot, "exports"), { recursive: true }); await mkdir(join(stagingRoot, "node_modules/@projector"), { recursive: true });
  for (const name of internalPackages) { const source = join(repositoryRoot, `packages/${name}`); const target = join(stagingRoot, `node_modules/@projector/${name}`); await mkdir(target, { recursive: true }); await cp(join(source, "dist"), join(target, "dist"), { recursive: true }); const manifest = JSON.parse(await readFile(join(source, "package.json"), "utf8")); if (manifest.version !== releaseVersion) throw new Error(`${manifest.name} version does not match root release version ${releaseVersion}`); manifest.private = false; for (const group of ["dependencies", "optionalDependencies", "peerDependencies"]) if (manifest[group] !== undefined) for (const [dependency, version] of Object.entries(manifest[group])) if (typeof version === "string" && version.startsWith("workspace:")) manifest[group][dependency] = releaseVersion; await writeFile(join(target, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`); }
  const zod = await realpath(join(repositoryRoot, "packages/core/node_modules/zod")); await cp(zod, join(stagingRoot, "node_modules/zod"), { recursive: true });
  const smolToml = await realpath(join(repositoryRoot, "packages/runtime/node_modules/smol-toml")); await cp(smolToml, join(stagingRoot, "node_modules/smol-toml"), { recursive: true });
  const nodeTypes = dirname(require.resolve("@types/node/package.json")); await mkdir(join(stagingRoot, "node_modules/@types"), { recursive: true }); await cp(nodeTypes, join(stagingRoot, "node_modules/@types/node"), { recursive: true }); const undiciTypes = await realpath(join(nodeTypes, "../../undici-types")); await cp(undiciTypes, join(stagingRoot, "node_modules/undici-types"), { recursive: true });
  for (const [subpath, target] of Object.entries(exportTargets)) { const name = subpath === "." ? "index" : subpath.slice(2).replaceAll("/", "-"); const statement = target === "cli" || target === "operation-runner" ? `export * from "../dist/${target === "cli" ? "cli" : "operation-runner"}.js";\n` : `export * from "@projector/${target.split("/")[0]}${target.includes("/") ? `/${target.split("/").slice(1).join("/")}` : ""}";\n`; await writeFile(join(stagingRoot, `exports/${name}.js`), statement); await writeFile(join(stagingRoot, `exports/${name}.d.ts`), `/// <reference types="node" />\n${statement}`); }
  await mkdir(join(stagingRoot, "bin")); const binPath = join(stagingRoot, "bin/projector.js"); await writeFile(binPath, "#!/usr/bin/env node\nimport { main } from \"../dist/cli.js\";\nprocess.exitCode = await main();\n"); await chmod(binPath, 0o755);
  const packageJson = { name: releasePackageName, version: releaseVersion, description: "Local semantic governance and change execution kernel", type: "module", engines: { node: ">=24 <25" }, bin: { projector: "./bin/projector.js" }, exports: Object.fromEntries(Object.keys(exportTargets).map((subpath) => { const base = `./exports/${subpath === "." ? "index" : subpath.slice(2).replaceAll("/", "-")}`; return [subpath, { types: `${base}.d.ts`, default: `${base}.js` }]; })), files: ["bin", "dist", "exports"], dependencies: Object.fromEntries([...bundledNames.map((name) => [name, releaseVersion]), ["@types/node", "^24.13.3"], ["smol-toml", "1.8.0"], ["undici-types", "^7.18.2"], ["zod", "^4.0.15"]]), bundledDependencies: [...bundledNames, "@types/node", "smol-toml", "undici-types", "zod"], publishConfig: { access: "public" } }; await writeFile(join(stagingRoot, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);
  const npmArguments = ["pack", "--json", "--pack-destination", packDestination];
  const { executable, arguments: arguments_ } = await resolveNpmCommand(npmArguments);
  const { stdout } = await execute(executable, arguments_, { cwd: stagingRoot, encoding: "utf8", maxBuffer: 10_000_000 }); const packed = JSON.parse(stdout); const metadata = Array.isArray(packed) ? packed[0] : Object.values(packed)[0]; if (metadata?.name !== releasePackageName || metadata?.version !== releaseVersion || metadata?.filename === undefined) throw new Error("npm pack did not return the expected scoped tarball"); return join(packDestination, metadata.filename);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) { const staging = process.argv[2]; const destination = process.argv[3] ?? (staging === undefined ? undefined : dirname(staging)); if (staging === undefined || destination === undefined) throw new Error("usage: build-release-package <projector-release-staging> [pack-destination]"); process.stdout.write(`${await buildReleasePackage(staging, destination)}\n`); }
