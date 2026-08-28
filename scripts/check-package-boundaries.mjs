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

const releaseVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const versionLiteralOwnerDeclarations = Object.freeze([
  ["packages/core/src/versioning.ts", /\bCANONICAL_API_VERSION\s*=\s*["']([^"']+)["']/u],
  ["packages/core/src/domain/contracts.ts", /\bCONTENT_HASH_PREFIX\s*=\s*["']([^"']+)["']/u],
  ["packages/engine/src/representation/index.ts", /\bhumanTechnical:\s*["']([^"']+)["']/u],
  ["packages/engine/src/representation/index.ts", /\bbehaviorGherkin:\s*["']([^"']+)["']/u],
  ["packages/engine/src/representation/index.ts", /\bagentCompact:\s*["']([^"']+)["']/u],
  ["packages/engine/src/representation/index.ts", /\bmachineInvariant:\s*["']([^"']+)["']/u],
  ["packages/engine/src/representation/index.ts", /\bMACHINE_REPRESENTATION_API_VERSION\s*=\s*["']([^"']+)["']/u],
  ["packages/engine/src/representation/index.ts", /\bREPRESENTATION_FIDELITY_VALIDATOR_ID\s*=\s*["']([^"']+)["']/u],
  ["packages/engine/src/representation/index.ts", /\bREPRESENTATION_FIDELITY_INDEPENDENCE_GROUP\s*=\s*["']([^"']+)["']/u],
  ["packages/engine/src/representation/upgrades.ts", /\bUPGRADE_DECLARATION_API_VERSION\s*=\s*["']([^"']+)["']/u],
  ["packages/engine/src/invalidation/index.ts", /\bINVALIDATION_DERIVED_SCHEMA_VERSION\s*=\s*["']([^"']+)["']/u],
  ["packages/engine/src/invalidation/index.ts", /\bIMPACT_CLOSURE_VERSION\s*=\s*["']([^"']+)["']/u],
  ["packages/integrations/src/codex/provider.ts", /\bCODEX_STRUCTURED_PROTOCOL_VERSION\s*=\s*["']([^"']+)["']/u],
  ["packages/cli/src/cli.ts", /\btokenizer:\s*["']([^"']+)["']/u],
  ["packages/cli/src/cli.ts", /\butility:\s*["']([^"']+)["']/u],
]);

export function validateVersionAuthority(rootManifest, workspaceManifests) {
  const errors = [];
  if (typeof rootManifest.version !== "string" || !releaseVersionPattern.test(rootManifest.version)) {
    errors.push("the root projector manifest must own a valid release version");
  }
  for (const manifest of workspaceManifests) {
    if (typeof manifest.name === "string" && manifest.name.startsWith("@projector/") && Object.hasOwn(manifest, "version")) {
      errors.push(`${manifest.name} must inherit the root release version instead of declaring its own`);
    }
  }
  return errors.sort();
}

export function validateVersionLiteralOwnership(files) {
  const errors = [];
  for (const [owner, declaration] of versionLiteralOwnerDeclarations) {
    const ownerSource = files[owner];
    if (ownerSource === undefined) continue;
    const literal = declaration.exec(ownerSource)?.[1];
    if (literal === undefined) {
      errors.push(`${owner} no longer declares its guarded compatibility literal`);
      continue;
    }
    for (const [file, source] of Object.entries(files)) if (file !== owner && source.includes(literal)) {
      errors.push(`${file} copies version literal ${literal}; use the owner in ${owner}`);
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

async function readWorkspaceManifests(root) {
  const packagesDirectory = path.join(root, "packages");
  const manifests = [];
  for (const entry of await readdir(packagesDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    manifests.push(JSON.parse(await readFile(path.join(packagesDirectory, entry.name, "package.json"), "utf8")));
  }
  return manifests;
}

function workspaceGraph(manifests) {
  const graph = {};
  for (const manifest of manifests) {
    graph[manifest.name] = Object.keys({
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.optionalDependencies,
      ...manifest.peerDependencies,
    });
  }
  return graph;
}

async function readVersionAuthorityFiles(root) {
  const files = {};
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === "dist" || entry.name === "node_modules") continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile() && /\.(?:ts|mjs|js)$/u.test(entry.name) && !/\.test\.(?:ts|mjs|js)$/u.test(entry.name)) {
        files[path.relative(root, absolute).split(path.sep).join("/")] = await readFile(absolute, "utf8");
      }
    }
  };
  await Promise.all(["packages", "scripts", "plugins"].map((directory) => visit(path.join(root, directory))));
  return files;
}

async function main() {
  const root = process.cwd();
  const [rootManifest, workspaceManifests, versionAuthorityFiles] = await Promise.all([
    readFile(path.join(root, "package.json"), "utf8").then((source) => JSON.parse(source)),
    readWorkspaceManifests(root),
    readVersionAuthorityFiles(root),
  ]);
  const subsystemFiles = Object.fromEntries(await Promise.all(Object.entries({ context: "packages/engine/src/context/index.ts", planning: "packages/engine/src/planning/change-plan.ts", host: "packages/integrations/src/codex/adapter.ts", mcp: "packages/integrations/src/mcp/server.ts", coverage: "packages/cli/src/cli.ts" }).map(async ([key, file]) => [key, await readFile(path.join(root, file), "utf8")])));
  const errors = [
    ...validatePackageDependencies(workspaceGraph(workspaceManifests)),
    ...validateSubsystemArchitecture(subsystemFiles),
    ...validateVersionAuthority(rootManifest, workspaceManifests),
    ...validateVersionLiteralOwnership(versionAuthorityFiles),
  ];
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
