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

export function validateSubsystemArchitecture(files) {
  const errors = [];
  if (/deriveBehaviorViews|agent-compact|machine-invariant/u.test(files.context)) errors.push("context contains a forbidden parallel representation renderer");
  if (!files.planning.includes("ports.representations.compile") || !/representation[,}]/u.test(files.planning)) errors.push("planning does not compose representation into semantic-change capsules");
  if (!files.host.includes("capsule.representation") || !files.host.includes("instructions.representation") || !files.host.includes('hashFramedDomain("representation-artifact", request.instructions.text)')) errors.push("host does not authenticate the exact capsule representation artifact");
  if (!files.mcp.includes("dedicatedRepresentationReads") || !files.mcp.includes("projector.preview_representation") || !files.mcp.includes("projector.validate_representation")) errors.push("MCP does not use dedicated representation handlers");
  if (!files.coverage.includes("authenticated representation projection evidence") || /documentNumerator|structuredArtifacts.*representation/iu.test(files.coverage)) errors.push("coverage substitutes a generic document proxy for representation projection evidence");
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
  const root = process.cwd();
  const subsystemFiles = Object.fromEntries(await Promise.all(Object.entries({ context: "packages/engine/src/context/index.ts", planning: "packages/engine/src/planning/change-plan.ts", host: "packages/integrations/src/codex/adapter.ts", mcp: "packages/integrations/src/mcp/server.ts", coverage: "packages/cli/src/cli.ts" }).map(async ([key, file]) => [key, await readFile(path.join(root, file), "utf8")])));
  const errors = [...validatePackageDependencies(await readWorkspaceGraph(root)), ...validateSubsystemArchitecture(subsystemFiles)];
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
