import { posix, resolve } from "node:path";

import {
  deriveEntityId,
  hashFramedDomain,
  type AnalyzerCapabilities,
  type AnalyzerFailure,
  type Artifact,
  type ContentHash,
  type ProjectionUnit,
  type SemanticSignature,
  type SourceClass,
  type Surface,
} from "@projector/core";

import { inventoryRepository, type InventoryEntry } from "./filesystem/inventory.js";
import { collectGitFacts, type GitFacts, type GitIdentityFact, type GitMoveFact } from "./git/facts.js";
import { compareCodePoint } from "./ordering.js";
import {
  analyzeJavaScript,
  type JavaScriptFileFacts,
  type ModuleDependencyFact,
  type TestTargetFact,
} from "./typescript/facts.js";

export type LocalSemanticRole =
  | "repository-automation"
  | "hook-entrypoint"
  | "hook-private-support"
  | "test"
  | "configuration"
  | "documentation"
  | "source"
  | "other";

export interface RoleEvidenceFact {
  readonly sourceClass: SourceClass;
  readonly kind: "package-script-invocation" | "test-target" | "hook-lifecycle" | "hook-reachability" | "directory-proximity" | "file-kind";
  readonly detail: string;
  readonly strength: number;
}

export interface PackageScriptInvocationFact {
  readonly sourceClass: SourceClass;
  readonly manifestPath: string;
  readonly scriptName: string;
  readonly command: string;
  readonly runner: string;
  readonly targetPath: string;
}

export interface LocalFileFact {
  readonly sourceClass: SourceClass;
  readonly path: string;
  readonly artifactId: string;
  readonly mediaType: string;
  readonly contentHash: ContentHash;
  readonly generated: boolean;
  readonly generatedReason?: "source-marker";
  readonly semanticRole: LocalSemanticRole;
  readonly roleEvidence: RoleEvidenceFact[];
  readonly exports: string[];
  readonly lifecycleExports: string[];
  readonly gitIdentity?: GitIdentityFact;
}

export interface LocalRepositoryAnalysis {
  readonly surface: Surface;
  readonly capabilities: AnalyzerCapabilities[];
  readonly artifacts: Artifact[];
  readonly projectionUnits: ProjectionUnit[];
  readonly files: LocalFileFact[];
  readonly git: GitFacts;
  readonly gitIdentities: GitIdentityFact[];
  readonly gitMoves: GitMoveFact[];
  readonly packageScriptInvocations: PackageScriptInvocationFact[];
  readonly dependencies: ModuleDependencyFact[];
  readonly testTargets: TestTargetFact[];
  readonly failures: AnalyzerFailure[];
}

export interface AnalyzeLocalRepositoryOptions {
  readonly repositoryRoot: string;
  readonly observedAt?: string;
  readonly observationRevision?: string;
}

const adapterVersion = "1.0.0";

function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let token = "";
  let quote: "'" | "\"" | undefined;
  let escaped = false;
  for (const character of command) {
    if (escaped) {
      token += character;
      escaped = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote !== undefined) {
      if (character === quote) quote = undefined;
      else token += character;
      continue;
    }
    if (character === "'" || character === "\"") {
      quote = character;
      continue;
    }
    if (character === ";" || character === "&" || character === "|" || character === ">" || character === "<") {
      if (token.length > 0) tokens.push(token);
      token = "";
      const previous = tokens.at(-1);
      if (character !== ";" && previous === character) tokens[tokens.length - 1] = `${character}${character}`;
      else tokens.push(character);
      continue;
    }
    if (/\s/u.test(character)) {
      if (token.length > 0) tokens.push(token);
      token = "";
      continue;
    }
    token += character;
  }
  if (token.length > 0) tokens.push(token);
  return tokens;
}

function executableTargets(tokens: readonly string[]): Array<{ runner: string; target: string }> {
  const result: Array<{ runner: string; target: string }> = [];
  let segment: string[] = [];
  const consume = (): void => {
    if (segment.length === 0) return;
    let runnerIndex = 0;
    while (/^[A-Za-z_][A-Za-z0-9_]*=/u.test(segment[runnerIndex] ?? "")) runnerIndex += 1;
    const runner = posix.basename(segment[runnerIndex] ?? "");
    if (!["node", "node.exe", "bun", "deno", "tsx", "ts-node"].includes(runner)) {
      segment = [];
      return;
    }
    let skipNext = false;
    for (const target of segment.slice(runnerIndex + 1)) {
      if (skipNext) {
        skipNext = false;
        continue;
      }
      if ([">", ">>", "<", "<<"].includes(target)) {
        skipNext = true;
        continue;
      }
      if (["-e", "--eval", "-p", "--print", "--input-type", "--require", "-r", "--import"].includes(target)) {
        skipNext = true;
        continue;
      }
      if (target.startsWith("-")) continue;
      if (/\.(?:mjs|js|cjs|mts|ts)$/u.test(target) && !target.includes("*")) result.push({ runner, target });
    }
    segment = [];
  };
  for (const token of tokens) {
    if ([";", "&", "&&", "|", "||"].includes(token)) consume();
    else segment.push(token);
  }
  consume();
  return result;
}

interface PackageFacts {
  readonly invocations: PackageScriptInvocationFact[];
  readonly failures: AnalyzerFailure[];
  readonly repositoryKey: string;
}

function analyzePackageScripts(entries: readonly InventoryEntry[]): PackageFacts {
  const invocations: PackageScriptInvocationFact[] = [];
  const failures: AnalyzerFailure[] = [];
  let repositoryKey = "local-repository";
  for (const entry of entries.filter((candidate) => posix.basename(candidate.path) === "package.json")) {
    try {
      const manifest = JSON.parse(entry.content) as { name?: unknown; scripts?: unknown };
      if (entry.path === "package.json" && typeof manifest.name === "string" && manifest.name.trim().length > 0) {
        repositoryKey = manifest.name.trim();
      }
      if (typeof manifest.scripts !== "object" || manifest.scripts === null || Array.isArray(manifest.scripts)) continue;
      for (const [scriptName, value] of Object.entries(manifest.scripts as Record<string, unknown>).sort(([left], [right]) => compareCodePoint(left, right))) {
        if (typeof value !== "string") continue;
        const tokens = tokenizeCommand(value);
        for (const { runner, target } of executableTargets(tokens)) {
          const targetPath = posix.normalize(posix.join(posix.dirname(entry.path), target.replace(/^\.\//u, "")));
          invocations.push({
            sourceClass: "derived",
            manifestPath: entry.path,
            scriptName,
            command: value,
            runner,
            targetPath,
          });
        }
      }
    } catch (error) {
      failures.push({
        analyzerId: "projector.package-scripts",
        capability: "package-script-invocations",
        scope: entry.path,
        message: error instanceof Error ? error.message : String(error),
        recoverable: true,
        affectedClaimKinds: ["package-script-invocation", "repository-automation-role"],
      });
    }
  }
  invocations.sort((left, right) => compareCodePoint(left.manifestPath, right.manifestPath) || compareCodePoint(left.scriptName, right.scriptName) || compareCodePoint(left.targetPath, right.targetPath));
  return { invocations, failures, repositoryKey };
}

function hookReachablePaths(files: readonly JavaScriptFileFacts[], dependencies: readonly ModuleDependencyFact[]): Set<string> {
  const entrypoints = files.filter((file) => file.lifecycleExports.length > 0).map((file) => file.path);
  const outgoing = new Map<string, string[]>();
  for (const dependency of dependencies) {
    if (dependency.resolvedPath === undefined) continue;
    const targets = outgoing.get(dependency.importerPath) ?? [];
    targets.push(dependency.resolvedPath);
    outgoing.set(dependency.importerPath, targets);
  }
  const reachable = new Set(entrypoints);
  const queue = [...entrypoints];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) continue;
    for (const target of outgoing.get(current) ?? []) {
      if (reachable.has(target)) continue;
      reachable.add(target);
      queue.push(target);
    }
  }
  return reachable;
}

function roleFor(
  entry: InventoryEntry,
  javaScript: JavaScriptFileFacts | undefined,
  invocations: readonly PackageScriptInvocationFact[],
  testTargets: readonly TestTargetFact[],
  hookReachable: ReadonlySet<string>,
): { role: LocalSemanticRole; evidence: RoleEvidenceFact[] } {
  const evidence: RoleEvidenceFact[] = [];
  const packageInvocations = invocations.filter((invocation) => invocation.targetPath === entry.path);
  evidence.push(...packageInvocations.map((invocation): RoleEvidenceFact => ({
    sourceClass: "derived",
    kind: "package-script-invocation",
    detail: invocation.scriptName,
    strength: 100,
  })));
  const targetingTests = testTargets.filter((target) => target.targetPath === entry.path);
  evidence.push(...targetingTests.map((target): RoleEvidenceFact => ({
    sourceClass: "derived",
    kind: "test-target",
    detail: target.testPath,
    strength: 90,
  })));
  if (javaScript !== undefined && javaScript.lifecycleExports.length > 0) {
    evidence.push({ sourceClass: "derived", kind: "hook-lifecycle", detail: javaScript.lifecycleExports.join(","), strength: 100 });
  }
  if (hookReachable.has(entry.path) && javaScript?.lifecycleExports.length === 0) {
    evidence.push({ sourceClass: "derived", kind: "hook-reachability", detail: "reachable-from-hook-entrypoint", strength: 90 });
  }
  if (entry.path.startsWith(".codex/hooks/")) {
    evidence.push({ sourceClass: "derived", kind: "directory-proximity", detail: ".codex/hooks", strength: 10 });
  }
  evidence.sort((left, right) => right.strength - left.strength || compareCodePoint(left.kind, right.kind) || compareCodePoint(left.detail, right.detail));

  if (/\.test\.(?:mjs|js|cjs|mts|ts)$/u.test(entry.path)) return { role: "test", evidence };
  if (javaScript !== undefined && javaScript.lifecycleExports.length > 0) return { role: "hook-entrypoint", evidence };
  if (hookReachable.has(entry.path)) return { role: "hook-private-support", evidence };
  if (packageInvocations.length > 0 || targetingTests.length > 0) return { role: "repository-automation", evidence };
  if (entry.path.endsWith("package.json")) return { role: "configuration", evidence };
  if (entry.mediaType === "text/markdown") return { role: "documentation", evidence };
  if (javaScript !== undefined) return { role: "source", evidence };
  return { role: "other", evidence };
}

function signature(profileId: string, scope: string, value: unknown): SemanticSignature {
  return {
    hash: hashFramedDomain(profileId, value),
    profileId,
    profileVersion: "1",
    scope,
    assurance: "exact",
    evidenceIds: [],
  };
}

function stableSemanticKey(entry: InventoryEntry, javaScript: JavaScriptFileFacts | undefined, role: LocalSemanticRole): string {
  if (javaScript !== undefined && javaScript.exports.length > 0) return `exports:${javaScript.exports.join(",")}`;
  if (javaScript !== undefined && javaScript.testNames.length > 0) return `tests:${javaScript.testNames.join("|")}`;
  if (entry.path.endsWith("package.json")) {
    try {
      const parsed = JSON.parse(entry.content) as { name?: unknown };
      if (typeof parsed.name === "string") return `package:${parsed.name}`;
    } catch {
      // The malformed manifest retains a deterministic fallback observation.
    }
  }
  return `${role}:${hashFramedDomain("local-unit-fallback", javaScript?.normalizedSemantics ?? entry.content)}`;
}

function projectionRole(role: LocalSemanticRole): ProjectionUnit["role"] {
  if (role === "test") return "test";
  if (role === "configuration") return "configuration";
  if (role === "documentation") return "documentation";
  if (role === "hook-private-support") return "supporting";
  return "implementation";
}

function buildCapabilities(): AnalyzerCapabilities[] {
  return [
    {
      analyzerId: "projector.filesystem-local",
      adapterVersion,
      supportedLanguages: [],
      supportedSemantics: ["deterministic-file-inventory", "generated-source-markers"],
      enumeration: {
        observability: "bounded",
        method: "recursive-lstat-without-symlink-following",
        assumptions: ["repository root is readable"],
        blindSpots: ["ignored .git and node_modules contents"],
        dynamicMechanisms: [],
      },
      executesRepositoryCode: false,
    },
    {
      analyzerId: "projector.git-local",
      adapterVersion,
      supportedLanguages: [],
      supportedSemantics: ["tracked-object-identity", "introduction-commit", "working-tree-moves"],
      enumeration: {
        observability: "bounded",
        method: "read-only-git-plumbing",
        assumptions: ["Git CLI can read repository metadata"],
        blindSpots: ["copy intent without recorded history"],
        dynamicMechanisms: [],
      },
      executesRepositoryCode: false,
    },
    {
      analyzerId: "projector.javascript-local",
      adapterVersion,
      supportedLanguages: ["JavaScript", "TypeScript"],
      supportedSemantics: ["static-imports", "named-exports", "test-targets", "hook-lifecycle", "package-script-invocations"],
      enumeration: {
        observability: "bounded",
        method: "no-exec-local-syntax-extraction",
        assumptions: ["ES module syntax uses static string specifiers"],
        blindSpots: ["dynamic imports", "computed module paths", "re-exports lists", "full TypeScript type semantics"],
        dynamicMechanisms: ["dynamic import", "runtime module resolution"],
      },
      executesRepositoryCode: false,
    },
  ];
}

export async function analyzeLocalRepository(options: AnalyzeLocalRepositoryOptions): Promise<LocalRepositoryAnalysis> {
  const repositoryRoot = resolve(options.repositoryRoot);
  const inventoryResult = await inventoryRepository(repositoryRoot);
  const inventory = inventoryResult.entries;
  const packageFacts = analyzePackageScripts(inventory);
  const javaScriptFacts = analyzeJavaScript(inventory);
  const gitFacts = await collectGitFacts(repositoryRoot, inventory.map((entry) => entry.path));
  const hookReachable = hookReachablePaths(javaScriptFacts.files, javaScriptFacts.dependencies);
  const javaScriptByPath = new Map(javaScriptFacts.files.map((facts) => [facts.path, facts]));
  const gitByPath = new Map(gitFacts.identities.map((identity) => [identity.path, identity]));
  const rootAvailable = inventoryResult.rootAvailability === "available";
  const surfaceId = deriveEntityId("projector.repository-surface", packageFacts.repositoryKey);
  const surface: Surface = {
    id: surfaceId,
    key: packageFacts.repositoryKey,
    kind: "repository",
    adapter: "projector.local-repository@1",
    access: rootAvailable ? "read-only" : "unavailable",
    enumeration: rootAvailable
      ? {
          observability: "bounded",
          method: "composed-local-filesystem-git-and-static-syntax-observation",
          assumptions: ["repository root and available Git metadata are readable"],
          blindSpots: ["ignored .git and node_modules contents", "dynamic module resolution", "unavailable per-entry observations"],
          dynamicMechanisms: ["runtime module resolution", "generated state outside inventory boundary"],
        }
      : {
          observability: "unavailable",
          method: "repository-root-read-attempt",
          assumptions: [],
          blindSpots: ["repository root could not be enumerated; no absence claim is valid"],
          dynamicMechanisms: [],
        },
    capabilities: {
      read: rootAvailable,
      write: false,
      watch: false,
      transactionalWrites: false,
      stableAnchors: rootAvailable,
      humanApprovalRequired: false,
    },
    boundary: { repositoryKey: packageFacts.repositoryKey },
  };
  const observedAt = options.observedAt ?? "1970-01-01T00:00:00.000Z";
  const observationRevision = options.observationRevision ?? gitFacts.revision;
  const artifacts: Artifact[] = [];
  const projectionUnits: ProjectionUnit[] = [];
  const files: LocalFileFact[] = [];
  const baseSemanticKeys = new Map<string, string>();
  const keyCounts = new Map<string, number>();
  for (const entry of inventory) {
    const javaScript = javaScriptByPath.get(entry.path);
    const { role } = roleFor(entry, javaScript, packageFacts.invocations, javaScriptFacts.testTargets, hookReachable);
    const key = stableSemanticKey(entry, javaScript, role);
    baseSemanticKeys.set(entry.path, key);
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }

  for (const entry of inventory) {
    const javaScript = javaScriptByPath.get(entry.path);
    const { role, evidence } = roleFor(entry, javaScript, packageFacts.invocations, javaScriptFacts.testTargets, hookReachable);
    const baseSemanticKey = baseSemanticKeys.get(entry.path)!;
    const semanticKey = keyCounts.get(baseSemanticKey) === 1
      ? baseSemanticKey
      : `${baseSemanticKey}:variant:${hashFramedDomain("local-unit-variant", javaScript?.normalizedSemantics ?? entry.content)}`;
    const artifactId = deriveEntityId("projector.repository-artifact", semanticKey, { path: entry.path });
    const unitId = deriveEntityId("projector.projection-unit", semanticKey, { path: entry.path });
    const structuralSignature = signature("projector.local-structural", semanticKey, {
      role,
      exports: javaScript?.exports ?? [],
      lifecycleExports: javaScript?.lifecycleExports ?? [],
      dependencySpecifiers: javaScriptFacts.dependencies.filter((dependency) => dependency.importerPath === entry.path).map((dependency) => dependency.specifier).sort(compareCodePoint),
      syntaxTokens: javaScript?.normalizedSemantics,
    });
    const semanticSignature = signature("projector.local-semantic", semanticKey, javaScript?.normalizedSemantics ?? entry.content);
    const anchor = javaScript !== undefined && javaScript.exports.length > 0
      ? { kind: "symbol" as const, value: `exports:${javaScript.exports.join(",")}`, fallbackSignature: structuralSignature }
      : javaScript !== undefined && javaScript.testNames.length > 0
        ? { kind: "ast-node" as const, value: `tests:${javaScript.testNames.join("|")}`, fallbackSignature: structuralSignature }
        : entry.path.endsWith("package.json")
          ? { kind: "json-pointer" as const, value: "/", fallbackSignature: structuralSignature }
          : { kind: "file" as const, value: semanticKey, fallbackSignature: structuralSignature };
    const tags = [role, "source-class:derived", ...(entry.generated ? ["generated"] : [])].sort(compareCodePoint);
    artifacts.push({
      id: artifactId,
      surfaceId,
      locator: entry.path,
      mediaType: entry.mediaType,
      contentHash: entry.contentHash,
      structuralSignature,
      semanticSignature,
      observedAt,
      observationRevision,
      causalOrigin: { kind: "deterministic-observation" },
      metadata: {
        sourceClass: "derived",
        generated: entry.generated,
        semanticRole: role,
        ...(entry.generatedReason === undefined ? {} : { generatedReason: entry.generatedReason }),
        ...(entry.symlinkTarget === undefined ? {} : { symlinkTarget: entry.symlinkTarget }),
      },
    });
    projectionUnits.push({
      id: unitId,
      artifactId,
      key: entry.path,
      role: projectionRole(role),
      anchor,
      control: { ownership: "structured", mutation: "transform", actuation: "approval" },
      conceptIds: [],
      requirementIds: [],
      scenarioIds: [],
      lenses: [],
      tags,
      structuralSignature,
      semanticSignature,
      membershipHash: hashFramedDomain("projection-unit-membership", { semanticKey, role, tags }),
      validity: "valid",
      confidence: role === "other" ? 0.5 : 1,
      causalOrigin: { kind: "deterministic-observation" },
      generatedFromUnitIds: [],
    });
    files.push({
      sourceClass: "derived",
      path: entry.path,
      artifactId,
      mediaType: entry.mediaType,
      contentHash: entry.contentHash,
      generated: entry.generated,
      ...(entry.generatedReason === undefined ? {} : { generatedReason: entry.generatedReason }),
      semanticRole: role,
      roleEvidence: evidence,
      exports: javaScript?.exports ?? [],
      lifecycleExports: javaScript?.lifecycleExports ?? [],
      ...(gitByPath.get(entry.path) === undefined ? {} : { gitIdentity: gitByPath.get(entry.path)! }),
    });
  }

  const byLocator = (left: Artifact, right: Artifact): number => compareCodePoint(left.locator, right.locator);
  artifacts.sort(byLocator);
  projectionUnits.sort((left, right) => compareCodePoint(left.key, right.key));
  files.sort((left, right) => compareCodePoint(left.path, right.path));
  const failures = [...inventoryResult.failures, ...packageFacts.failures, ...javaScriptFacts.failures, ...gitFacts.failures]
    .sort((left, right) => compareCodePoint(left.analyzerId, right.analyzerId) || compareCodePoint(left.scope, right.scope) || compareCodePoint(left.capability, right.capability));
  return {
    surface,
    capabilities: buildCapabilities(),
    artifacts,
    projectionUnits,
    files,
    git: gitFacts,
    gitIdentities: gitFacts.identities,
    gitMoves: gitFacts.moves,
    packageScriptInvocations: packageFacts.invocations,
    dependencies: javaScriptFacts.dependencies,
    testTargets: javaScriptFacts.testTargets,
    failures,
  };
}
