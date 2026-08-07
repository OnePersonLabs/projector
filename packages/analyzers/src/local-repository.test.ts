import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
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
});
