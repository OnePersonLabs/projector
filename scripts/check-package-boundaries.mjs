import { readFile, readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";

const allowed = {
  "@projector/core": new Set(),
  "@projector/engine": new Set(["@projector/core"]),
  "@projector/analyzers": new Set(["@projector/core"]),
  "@projector/runtime": new Set(["@projector/core"]),
  "@projector/integrations": new Set(["@projector/core", "@projector/engine"]),
  "@projector/control-plane": new Set(["@projector/core", "@projector/engine", "@projector/analyzers", "@projector/runtime", "@projector/integrations"]),
  "@projector/cli": new Set([
    "@projector/core",
    "@projector/engine",
    "@projector/analyzers",
    "@projector/runtime",
    "@projector/integrations",
    "@projector/control-plane",
  ]),
  "@projector/testkit": new Set(["@projector/core"]),
};

function sourceFile(source) {
  return ts.createSourceFile("boundary.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

export function extractTypeScriptImports(source) {
  const imports = [];
  for (const statement of sourceFile(source).statements) {
    if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier)) imports.push(statement.moduleSpecifier.text);
    if (ts.isImportEqualsDeclaration(statement) && ts.isExternalModuleReference(statement.moduleReference) && statement.moduleReference.expression !== undefined && ts.isStringLiteral(statement.moduleReference.expression)) imports.push(statement.moduleReference.expression.text);
  }
  return [...new Set(imports)].sort();
}

export function validateCuratedExports(source, expected) {
  const names = [];
  const errors = [];
  for (const statement of sourceFile(source).statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    if (statement.exportClause === undefined) errors.push("curated facade must not use export-star declarations");
    else if (ts.isNamedExports(statement.exportClause)) for (const element of statement.exportClause.elements) names.push(element.name.text);
  }
  if (JSON.stringify(names.sort()) !== JSON.stringify([...expected].sort())) errors.push(`curated facade exports ${names.sort().join(", ")} instead of ${[...expected].sort().join(", ")}`);
  return errors.sort();
}

function syntaxFacts(source) {
  const identifiers = new Set();
  const literals = new Set();
  const properties = new Set();
  const calls = new Set();
  const propertyPath = (node) => {
    if (ts.isIdentifier(node)) return node.text;
    if (ts.isPropertyAccessExpression(node)) {
      const left = propertyPath(node.expression);
      return left === undefined ? undefined : `${left}.${node.name.text}`;
    }
    if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression)) {
      const left = propertyPath(node.expression);
      return left === undefined ? undefined : `${left}[${JSON.stringify(node.argumentExpression.text)}]`;
    }
  };
  const visit = (node) => {
    if (ts.isIdentifier(node)) identifiers.add(node.text);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) literals.add(node.text);
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const property = propertyPath(node);
      if (property !== undefined) properties.add(property);
    }
    if (ts.isCallExpression(node)) {
      const call = propertyPath(node.expression);
      if (call !== undefined) calls.add(call);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile(source));
  return { identifiers, literals, properties, calls };
}

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
  const facts = Object.fromEntries(Object.entries(files).map(([key, source]) => [key, syntaxFacts(source)]));
  if (facts.context.identifiers.has("deriveBehaviorViews") || facts.context.literals.has("agent-compact") || facts.context.literals.has("machine-invariant")) errors.push("context contains a forbidden parallel representation renderer");
  if (!facts.planning.calls.has("ports.representations.compile") || !facts.planning.identifiers.has("representation")) errors.push("planning does not compose representation into semantic-change capsules");
  if (!facts.host.identifiers.has("authenticateRepresentationBinding") || !facts.session.properties.has("input.capsule.representation") || !facts.session.properties.has("input.instructions.representation") || !facts.session.calls.has("hashFramedDomain") || !facts.session.literals.has("representation-artifact")) errors.push("host does not authenticate the exact capsule representation artifact through shared session authority");
  if (!facts.mcpServer.identifiers.has("createProjectorMcpServer") || !facts.mcpComposition.properties.has('read["projector.preview_representation"]') || !facts.mcpComposition.properties.has('read["projector.validate_representation"]')) errors.push("MCP composition does not register dedicated representation handlers explicitly");
  if (![...facts.coverage.literals].some((value) => value.includes("authenticated representation projection evidence")) || facts.coverage.identifiers.has("documentNumerator") || (facts.coverage.identifiers.has("structuredArtifacts") && facts.coverage.identifiers.has("representation"))) errors.push("coverage substitutes a generic document proxy for representation projection evidence");
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

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(target));
    else if (entry.isFile() && /(?<!\.test)\.tsx?$/u.test(entry.name)) files.push(target);
  }
  return files;
}

async function readImportGraph(root) {
  const graph = {};
  for (const entry of await readdir(path.join(root, "packages"), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packageRoot = path.join(root, "packages", entry.name);
    const manifest = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
    const imports = [];
    for (const file of await sourceFiles(path.join(packageRoot, "src"))) imports.push(...extractTypeScriptImports(await readFile(file, "utf8")));
    graph[manifest.name] = [...new Set(imports.filter((specifier) => specifier.startsWith("@projector/")).map((specifier) => specifier.split("/").slice(0, 2).join("/")))];
  }
  return graph;
}

async function main() {
  const root = process.cwd();
  const subsystemFiles = Object.fromEntries(await Promise.all(Object.entries({ context: "packages/engine/src/context/index.ts", planning: "packages/engine/src/planning/change-plan.ts", host: "packages/integrations/src/codex/adapter.ts", session: "packages/integrations/src/sessions/index.ts", mcpServer: "packages/integrations/src/mcp/server.ts", mcpComposition: "packages/cli/src/mcp-cli.ts", coverage: "packages/cli/src/cli.ts" }).map(async ([key, file]) => [key, await readFile(path.join(root, file), "utf8")])));
  const controlPlaneFacade = await readFile(path.join(root, "packages/control-plane/src/index.ts"), "utf8");
  const errors = [
    ...validatePackageDependencies(await readWorkspaceGraph(root)),
    ...validatePackageDependencies(await readImportGraph(root)),
    ...validateCuratedExports(controlPlaneFacade, ["LifecycleRecoveryOutcome", "RepositoryChangeLifecycleService"]),
    ...validateSubsystemArchitecture(subsystemFiles),
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
