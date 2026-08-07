import { execFile } from "node:child_process";
import { chmod, cp, mkdtemp, readFile, rename, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { analyzeLocalRepository } from "./index.js";

const execFileAsync = promisify(execFile);
const fixtureRoot = new URL("../../../fixtures/misplaced-repository-script/", import.meta.url);
const temporaryRoots: string[] = [];

async function fixtureRepository(): Promise<string> {
  const parent = await mkdtemp(join(tmpdir(), "projector-analyzer-"));
  temporaryRoots.push(parent);
  const root = join(parent, "repository");
  await cp(fixtureRoot, root, { recursive: true });
  await execFileAsync("git", ["init", "--quiet", "--initial-branch=main"], { cwd: root });
  await execFileAsync("git", ["add", "--all"], { cwd: root });
  await execFileAsync(
    "git",
    ["-c", "user.name=Projector Test", "-c", "user.email=projector@example.invalid", "commit", "--quiet", "-m", "fixture"],
    { cwd: root },
  );
  return root;
}

async function fixtureWithoutGit(): Promise<string> {
  const parent = await mkdtemp(join(tmpdir(), "projector-analyzer-no-git-"));
  temporaryRoots.push(parent);
  const root = join(parent, "repository");
  await cp(fixtureRoot, root, { recursive: true });
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("local repository analyzer", () => {
  it("classifies the misplaced repository script from invocation and dependency evidence without executing it", async () => {
    const root = await fixtureRepository();
    const marker = join(root, "execution-marker.txt");
    process.env.PROJECTOR_FIXTURE_EXECUTION_MARKER = "execution-marker.txt";

    const result = await analyzeLocalRepository({ repositoryRoot: root });

    delete process.env.PROJECTOR_FIXTURE_EXECUTION_MARKER;
    await expect(readFile(marker, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    expect(result.capabilities.every((capability) => !capability.executesRepositoryCode)).toBe(true);

    const misplaced = result.files.find((file) => file.path === ".codex/hooks/validate-repo.mjs");
    expect(misplaced).toMatchObject({
      sourceClass: "derived",
      generated: false,
      semanticRole: "repository-automation",
      roleEvidence: expect.arrayContaining([
        expect.objectContaining({ kind: "package-script-invocation", detail: "validate:repo" }),
        expect.objectContaining({ kind: "test-target" }),
      ]),
    });
    expect(misplaced?.roleEvidence.some((evidence) => evidence.kind === "directory-proximity")).toBe(true);

    expect(result.packageScriptInvocations).toContainEqual(expect.objectContaining({
      sourceClass: "derived",
      scriptName: "validate:repo",
      targetPath: ".codex/hooks/validate-repo.mjs",
    }));
    expect(result.testTargets).toContainEqual(expect.objectContaining({
      sourceClass: "derived",
      testPath: ".codex/hooks/validate-repo.test.mjs",
      targetPath: ".codex/hooks/validate-repo.mjs",
    }));
    expect(result.dependencies).toContainEqual(expect.objectContaining({
      sourceClass: "derived",
      importerPath: ".codex/hooks/pre-tool.mjs",
      resolvedPath: ".codex/hooks/lib/validate-repo.mjs",
    }));

    expect(result.files.find((file) => file.path === ".codex/hooks/pre-tool.mjs")).toMatchObject({
      semanticRole: "hook-entrypoint",
      lifecycleExports: ["onPreTool"],
    });
    expect(result.files.find((file) => file.path === ".codex/hooks/lib/validate-repo.mjs")).toMatchObject({
      semanticRole: "hook-private-support",
    });
    expect(result.files.find((file) => file.path === "scripts/build-index.mjs")).toMatchObject({
      semanticRole: "repository-automation",
    });

    const misplacedUnit = result.projectionUnits.find((unit) => unit.artifactId === misplaced?.artifactId);
    expect(misplacedUnit).toMatchObject({
      role: "implementation",
      anchor: { kind: "symbol", value: "exports:findRepositoryRoot,validateRepository" },
      causalOrigin: { kind: "deterministic-observation" },
      generatedFromUnitIds: [],
      tags: expect.arrayContaining(["repository-automation", "source-class:derived"]),
    });
  });

  it("keeps semantic anchors, IDs, and formatting-insensitive signatures stable across a harmless edit and move", async () => {
    const root = await fixtureRepository();
    const before = await analyzeLocalRepository({ repositoryRoot: root });
    const beforeSource = before.files.find((file) => file.path === ".codex/hooks/validate-repo.mjs");
    const beforeTest = before.files.find((file) => file.path === ".codex/hooks/validate-repo.test.mjs");
    const beforeUnit = before.projectionUnits.find((unit) => unit.artifactId === beforeSource?.artifactId);

    await writeFile(
      join(root, ".codex/hooks/validate-repo.mjs"),
      `// harmless formatting note\n${await readFile(join(root, ".codex/hooks/validate-repo.mjs"), "utf8")}`,
    );
    await rename(join(root, ".codex/hooks/validate-repo.mjs"), join(root, "scripts/validate-repo.mjs"));
    await rename(join(root, ".codex/hooks/validate-repo.test.mjs"), join(root, "scripts/validate-repo.test.mjs"));
    const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { scripts: Record<string, string> };
    manifest.scripts["validate:repo"] = "node scripts/validate-repo.mjs";
    manifest.scripts.test = "node --test scripts/*.test.mjs";
    await writeFile(join(root, "package.json"), `${JSON.stringify(manifest, undefined, 2)}\n`);

    const after = await analyzeLocalRepository({ repositoryRoot: root });
    const afterSource = after.files.find((file) => file.path === "scripts/validate-repo.mjs");
    const afterTest = after.files.find((file) => file.path === "scripts/validate-repo.test.mjs");
    const afterUnit = after.projectionUnits.find((unit) => unit.artifactId === afterSource?.artifactId);

    expect(afterSource?.artifactId).toBe(beforeSource?.artifactId);
    expect(afterTest?.artifactId).toBe(beforeTest?.artifactId);
    expect(afterUnit?.id).toBe(beforeUnit?.id);
    expect(afterUnit?.anchor).toEqual(beforeUnit?.anchor);
    expect(afterUnit?.semanticSignature.hash).toBe(beforeUnit?.semanticSignature.hash);
    expect(after.gitMoves).toContainEqual(expect.objectContaining({
      sourceClass: "derived",
      fromPath: ".codex/hooks/validate-repo.mjs",
      toPath: "scripts/validate-repo.mjs",
    }));
  });

  it("localizes a malformed manifest failure while preserving filesystem and JavaScript observations", async () => {
    const root = await fixtureRepository();
    await writeFile(join(root, "package.json"), "{ definitely-not-json");

    const result = await analyzeLocalRepository({ repositoryRoot: root });

    expect(result.failures).toContainEqual(expect.objectContaining({
      analyzerId: "projector.package-scripts",
      capability: "package-script-invocations",
      scope: "package.json",
      recoverable: true,
      affectedClaimKinds: ["package-script-invocation", "repository-automation-role"],
    }));
    expect(result.files.some((file) => file.path === ".codex/hooks/pre-tool.mjs")).toBe(true);
    expect(result.dependencies.some((dependency) => dependency.importerPath === ".codex/hooks/pre-tool.mjs")).toBe(true);
    expect(result.files.find((file) => file.path === ".codex/hooks/pre-tool.mjs")?.semanticRole).toBe("hook-entrypoint");
  });

  it("marks generated sources explicitly and limits unresolved imports to dependency claims", async () => {
    const root = await fixtureRepository();
    await writeFile(join(root, "scripts/generated.mjs"), "// @generated\nimport './missing.mjs';\nexport const value = 1;\n");

    const result = await analyzeLocalRepository({ repositoryRoot: root });

    expect(result.files.find((file) => file.path === "scripts/generated.mjs")).toMatchObject({
      generated: true,
      generatedReason: "source-marker",
      sourceClass: "derived",
    });
    expect(result.failures).toContainEqual(expect.objectContaining({
      analyzerId: "projector.javascript-local",
      capability: "module-resolution",
      scope: "scripts/generated.mjs",
      affectedClaimKinds: ["dependency", "test-target", "hook-reachability"],
    }));
    expect(result.packageScriptInvocations.length).toBeGreaterThan(0);
  });

  it("preserves whitespace inside literals when computing formatting-insensitive semantics", async () => {
    const root = await fixtureRepository();
    const path = join(root, "scripts/literal.mjs");
    await writeFile(path, "export const literalValue = 'a b';\n");
    const before = await analyzeLocalRepository({ repositoryRoot: root });

    await writeFile(path, "export const literalValue = 'ab';\n");
    const after = await analyzeLocalRepository({ repositoryRoot: root });

    const beforeUnit = before.projectionUnits.find((unit) => unit.key === "scripts/literal.mjs");
    const afterUnit = after.projectionUnits.find((unit) => unit.key === "scripts/literal.mjs");
    expect(afterUnit?.id).toBe(beforeUnit?.id);
    expect(afterUnit?.semanticSignature.hash).not.toBe(beforeUnit?.semanticSignature.hash);
  });

  it("neutralizes executable local Git configuration during every probe", async () => {
    const root = await fixtureRepository();
    const marker = join(root, "fsmonitor-executed.txt");
    const monitor = join(root, "hostile-fsmonitor.sh");
    await writeFile(monitor, `#!/bin/sh\ntouch '${marker}'\nexit 0\n`);
    await chmod(monitor, 0o755);
    await execFileAsync("git", ["config", "--local", "core.fsmonitor", monitor], { cwd: root });

    const result = await analyzeLocalRepository({ repositoryRoot: root });

    expect(result.git.availability).toBe("available");
    await expect(readFile(marker, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("localizes an unreadable filesystem entry without discarding other artifacts", async () => {
    const root = await fixtureRepository();
    const unreadable = join(root, "scripts/unreadable.mjs");
    await writeFile(unreadable, "export const unavailable = true;\n");
    await chmod(unreadable, 0);

    const result = await analyzeLocalRepository({ repositoryRoot: root });

    expect(result.failures).toContainEqual(expect.objectContaining({
      analyzerId: "projector.filesystem-local",
      capability: "artifact-content",
      scope: "scripts/unreadable.mjs",
      affectedClaimKinds: ["artifact-content", "projection-unit", "source-relationships"],
    }));
    expect(result.files.some((file) => file.path === "scripts/build-index.mjs")).toBe(true);
    expect(result.packageScriptInvocations.some((fact) => fact.scriptName === "build:index")).toBe(true);
  });

  it("reports Git outage as unavailable unknown evidence rather than known untracked files", async () => {
    const root = await fixtureWithoutGit();

    const result = await analyzeLocalRepository({ repositoryRoot: root });

    expect(result.git.availability).toBe("unavailable");
    expect(result.gitIdentities.length).toBeGreaterThan(0);
    expect(result.gitIdentities.every((identity) => identity.tracked === "unknown" && identity.availability === "unavailable")).toBe(true);
    expect(result.gitIdentities.some((identity) => identity.tracked === false)).toBe(false);
    expect(result.failures).toContainEqual(expect.objectContaining({
      analyzerId: "projector.git-local",
      capability: "git-identity-and-moves",
    }));
  });

  it("does not collapse whitespace that changes JavaScript token structure or automatic semicolon insertion", async () => {
    const root = await fixtureRepository();
    await writeFile(join(root, "scripts/collision-a.mjs"), "export function collision() { return\n{ value: 1 }; }\n");
    await writeFile(join(root, "scripts/collision-b.mjs"), "export function collision() { return { value: 1 }; }\n");

    const result = await analyzeLocalRepository({ repositoryRoot: root });
    const first = result.projectionUnits.find((unit) => unit.key === "scripts/collision-a.mjs");
    const second = result.projectionUnits.find((unit) => unit.key === "scripts/collision-b.mjs");

    expect(first?.id).not.toBe(second?.id);
    expect(first?.semanticSignature.hash).not.toBe(second?.semanticSignature.hash);
    expect(first?.anchor.fallbackSignature?.hash).not.toBe(second?.anchor.fallbackSignature?.hash);
  });

  it("does not extract imports, tests, lifecycle exports, or commands from comments and string literals", async () => {
    const root = await fixtureRepository();
    await writeFile(
      join(root, "scripts/false-positive.mjs"),
      [
        "// import './ghost-comment.mjs'; export function onPreTool() {}",
        "const sourceText = \"import './ghost-string.mjs'; export function onPreTool() {}; test('ghost', () => {});\";",
        "export const realValue = sourceText;",
        "",
      ].join("\n"),
    );
    const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { scripts: Record<string, string> };
    manifest.scripts["print:example"] = "echo 'node scripts/ghost-command.mjs'";
    await writeFile(join(root, "package.json"), `${JSON.stringify(manifest, undefined, 2)}\n`);

    const result = await analyzeLocalRepository({ repositoryRoot: root });
    const file = result.files.find((candidate) => candidate.path === "scripts/false-positive.mjs");

    expect(result.dependencies.some((dependency) => dependency.importerPath === "scripts/false-positive.mjs")).toBe(false);
    expect(result.testTargets.some((target) => target.testPath === "scripts/false-positive.mjs")).toBe(false);
    expect(file).toMatchObject({ lifecycleExports: [], semanticRole: "source", exports: ["realValue"] });
    expect(result.packageScriptInvocations.some((invocation) => invocation.scriptName === "print:example")).toBe(false);
  });

  it("declares the composed repository observation bounded rather than closed-world", async () => {
    const root = await fixtureRepository();
    const result = await analyzeLocalRepository({ repositoryRoot: root });

    expect(result.surface.enumeration).toMatchObject({
      observability: "bounded",
      blindSpots: expect.arrayContaining(["ignored .git and node_modules contents"]),
    });
  });

  it("does not follow an untracked symlink outside the repository when inferring a move", async () => {
    const root = await fixtureRepository();
    const outside = join(root, "..", "outside-validate-repo.mjs");
    const original = join(root, ".codex/hooks/validate-repo.mjs");
    await writeFile(outside, await readFile(original, "utf8"));
    await unlink(original);
    await symlink(outside, join(root, "scripts/validate-repo.mjs"));

    const result = await analyzeLocalRepository({ repositoryRoot: root });

    expect(result.gitMoves).not.toContainEqual(expect.objectContaining({
      fromPath: ".codex/hooks/validate-repo.mjs",
      toPath: "scripts/validate-repo.mjs",
    }));
  });

  it("distinguishes staged renames from working-tree rename clues", async () => {
    const root = await fixtureRepository();
    await rename(join(root, "scripts/build-index.mjs"), join(root, "scripts/generate-index.mjs"));
    await execFileAsync("git", ["add", "--all"], { cwd: root });

    const result = await analyzeLocalRepository({ repositoryRoot: root });

    expect(result.gitMoves).toContainEqual(expect.objectContaining({
      fromPath: "scripts/build-index.mjs",
      toPath: "scripts/generate-index.mjs",
      status: "staged-rename",
    }));
  });

  it("orders repository paths by Unicode code point independent of locale", async () => {
    const root = await fixtureRepository();
    await writeFile(join(root, "scripts/\uE000.mjs"), "export const privateUse = true;\n");
    await writeFile(join(root, "scripts/\u{10000}.mjs"), "export const supplementary = true;\n");

    const result = await analyzeLocalRepository({ repositoryRoot: root });
    const paths = result.files.map((file) => file.path);

    expect(paths.indexOf("scripts/\uE000.mjs")).toBeLessThan(paths.indexOf("scripts/\u{10000}.mjs"));
  });

  it("reports a nonexistent repository root as unavailable instead of proving an empty repository", async () => {
    const parent = await mkdtemp(join(tmpdir(), "projector-missing-root-"));
    temporaryRoots.push(parent);

    const result = await analyzeLocalRepository({ repositoryRoot: join(parent, "does-not-exist") });

    expect(result.surface).toMatchObject({
      access: "unavailable",
      enumeration: { observability: "unavailable" },
      capabilities: { read: false, stableAnchors: false },
    });
    expect(result.files).toEqual([]);
    expect(result.failures).toContainEqual(expect.objectContaining({
      analyzerId: "projector.filesystem-local",
      capability: "directory-enumeration",
      scope: ".",
      affectedClaimKinds: ["artifact-enumeration", "inventory-completeness"],
    }));
  });

  it("keeps a readable root bounded when only one child artifact is unavailable", async () => {
    const root = await fixtureRepository();
    const unreadable = join(root, "scripts/child-unavailable.mjs");
    await writeFile(unreadable, "export const childUnavailable = true;\n");
    await chmod(unreadable, 0);

    const result = await analyzeLocalRepository({ repositoryRoot: root });

    expect(result.surface).toMatchObject({
      access: "read-only",
      enumeration: { observability: "bounded" },
      capabilities: { read: true, stableAnchors: true },
    });
    expect(result.failures).toContainEqual(expect.objectContaining({ scope: "scripts/child-unavailable.mjs" }));
  });

  it("does not treat pipeline commands or redirection destinations as package-script targets", async () => {
    const root = await fixtureRepository();
    const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { scripts: Record<string, string> };
    manifest.scripts.background = "node scripts/build-index.mjs & echo scripts/not-invoked.mjs";
    manifest.scripts.redirect = "node scripts/check-links.mjs > scripts/captured-output.mjs";
    await writeFile(join(root, "package.json"), `${JSON.stringify(manifest, undefined, 2)}\n`);

    const result = await analyzeLocalRepository({ repositoryRoot: root });
    const backgroundTargets = result.packageScriptInvocations.filter((fact) => fact.scriptName === "background").map((fact) => fact.targetPath);
    const redirectTargets = result.packageScriptInvocations.filter((fact) => fact.scriptName === "redirect").map((fact) => fact.targetPath);

    expect(backgroundTargets).toEqual(["scripts/build-index.mjs"]);
    expect(redirectTargets).toEqual(["scripts/check-links.mjs"]);
  });

  it("localizes per-file Git history failure without discarding available Git identity", async () => {
    const root = await fixtureRepository();
    const wrapperRoot = await mkdtemp(join(tmpdir(), "projector-git-wrapper-"));
    temporaryRoots.push(wrapperRoot);
    const wrapper = join(wrapperRoot, "git");
    const { stdout: gitPathOutput } = await execFileAsync("which", ["git"]);
    const gitPath = gitPathOutput.trim();
    await writeFile(
      wrapper,
      `#!/bin/sh\nfor arg in "$@"; do\n  if [ "$arg" = "log" ]; then exit 71; fi\ndone\nexec '${gitPath}' "$@"\n`,
    );
    await chmod(wrapper, 0o755);
    const originalPath = process.env.PATH;
    process.env.PATH = `${wrapperRoot}:${originalPath ?? ""}`;

    try {
      const result = await analyzeLocalRepository({ repositoryRoot: root });
      const identity = result.gitIdentities.find((fact) => fact.path === "scripts/build-index.mjs");

      expect(result.git.availability).toBe("available");
      expect(identity).toMatchObject({ tracked: true, introductionHistory: "unavailable" });
      expect(identity?.introductionCommit).toBeUndefined();
      expect(result.failures).toContainEqual(expect.objectContaining({
        analyzerId: "projector.git-local",
        capability: "introduction-history",
        scope: "scripts/build-index.mjs",
        recoverable: true,
        affectedClaimKinds: ["git-introduction-commit"],
      }));
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
    }
  });
});
