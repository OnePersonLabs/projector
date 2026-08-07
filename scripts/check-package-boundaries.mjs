import { readFile, readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const allowed = {
  "@projector/core": new Set(),
  "@projector/engine": new Set(["@projector/core"]),
  "@projector/analyzers": new Set(["@projector/core"]),
  "@projector/runtime": new Set(["@projector/core"]),
  "@projector/integrations": new Set(["@projector/core", "@projector/engine"]),
  "@projector/cli": new Set([
    "@projector/core",
    "@projector/engine",
    "@projector/analyzers",
    "@projector/runtime",
    "@projector/integrations",
  ]),
  "@projector/testkit": new Set(["@projector/core"]),
};

export function validatePackageDependencies(graph) {
  const errors = [];
  for (const [name, dependencies] of Object.entries(graph)) {
    const packageAllowed = allowed[name];
    if (packageAllowed === undefined) continue;
    for (const dependency of dependencies) {
      if (dependency.startsWith("@projector/") && !packageAllowed.has(dependency)) {
        errors.push(`${name} must not depend on ${dependency}`);
      }
    }
  }
  return errors.sort();
}

async function readWorkspaceGraph(root) {
  const packagesDirectory = path.join(root, "packages");
  const graph = {};
  for (const entry of await readdir(packagesDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifest = JSON.parse(await readFile(path.join(packagesDirectory, entry.name, "package.json"), "utf8"));
    graph[manifest.name] = Object.keys({
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.optionalDependencies,
      ...manifest.peerDependencies,
    });
  }
  return graph;
}

async function main() {
  const errors = validatePackageDependencies(await readWorkspaceGraph(process.cwd()));
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log("Package dependency boundaries valid.");
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
