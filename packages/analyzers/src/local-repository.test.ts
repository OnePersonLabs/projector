import { execFile } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, readFile, rename, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";
import { DerivedObservationBudget, hashFramedDomain } from "@projector/core";

import { analyzeJavaScript, analyzeLocalRepository, normalizeJavaScriptSemantics } from "./index.js";

const execFileAsync = promisify(execFile);
const fixtureRoot = new URL("../../../fixtures/misplaced-repository-script/", import.meta.url);
const temporaryRoots: string[] = [];

async function gitExecutable(): Promise<string> {
  const locator = process.platform === "win32" ? "where.exe" : "which";
  const { stdout } = await execFileAsync(locator, ["git"]);
  return stdout.trim().split(/\r?\n/u)[0]!;
}

async function gitWrapper(root: string, gitPath: string, marker: string | undefined, failLog: boolean): Promise<string> {
  if (process.platform === "win32") {
    const path = join(root, "git.exe");
    const source = `using System; using System.Diagnostics; using System.IO; using System.Linq;
public static class Program { public static int Main(string[] args) {
  foreach (var arg in args) if (arg == "log") { ${marker === undefined ? "" : `File.AppendAllText(${JSON.stringify(marker)}, "x");`} ${failLog ? "return 71;" : ""} }
  var start = new ProcessStartInfo(${JSON.stringify(gitPath)}) { UseShellExecute = false, Arguments = String.Join(" ", args.Select(arg => "\\\"" + arg.Replace("\\\"", "\\\\\\\"") + "\\\"")) };
  var child = Process.Start(start); child.WaitForExit(); return child.ExitCode;
} }`;
    const sourcePath = join(root, "git-wrapper.cs"); await writeFile(sourcePath, source);
    await execFileAsync("powershell.exe", ["-NoProfile", "-Command", `Add-Type -Path '${sourcePath.replaceAll("'", "''")}' -OutputAssembly '${path.replaceAll("'", "''")}' -OutputType ConsoleApplication`]);
    return path;
  }
  const path = join(root, "git");
  const action = failLog ? "exit 71" : marker === undefined ? ":" : `printf x >> '${marker}'`;
  await writeFile(path, `#!/bin/sh\nfor arg in "$@"; do\n  if [ "$arg" = "log" ]; then ${action}; fi\ndone\nexec '${gitPath}' "$@"\n`);
  await chmod(path, 0o755);
  return path;
}

async function denyRead(path: string): Promise<() => Promise<void>> {
  if (process.platform !== "win32") {
    await chmod(path, 0);
    return async () => chmod(path, 0o600);
  }
  const principal = process.env.USERNAME;
  if (principal === undefined || principal === "") throw new Error("Windows unreadable-file fixture requires USERNAME");
  await execFileAsync("icacls.exe", [path, "/deny", `${principal}:(R)`]);
  return async () => { await execFileAsync("icacls.exe", [path, "/remove:d", principal]); };
}

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
  it("admits lexical allocations incrementally and shares the derived allowance across normalization calls", () => {
    const bounded = new DerivedObservationBudget(4096);
    expect(() => normalizeJavaScriptSemantics(";".repeat(1_000_000), bounded, "punctuation.ts")).toThrow(expect.objectContaining({
      code: "observation-limit-exceeded", limit: "maxDerivedBytes", stage: "javascript-tokens", scope: "punctuation.ts",
    }));
    expect(bounded.usedBytes).toBe(0);
    const shared = new DerivedObservationBudget(512);
    const retained = Array.from({ length: 6 }, () => normalizeJavaScriptSemantics(";", shared));
    expect(retained).toEqual(Array(6).fill("10:punctuator:1:;"));
    expect(shared.usedBytes).toBe(348);
    expect(() => shared.release(349)).toThrow(expect.objectContaining({ stage: "derived-release" }));
    expect(shared.usedBytes).toBe(348);
    expect(() => normalizeJavaScriptSemantics(";", shared)).toThrow(expect.objectContaining({ limit: "maxDerivedBytes" }));
  });

  it("uses the collected observation's explicit derived limit during semantic analysis", async () => {
    const root = await fixtureRepository();
    await expect(analyzeLocalRepository({ repositoryRoot: root, observationLimits: { maxDerivedBytes: 256 } })).rejects.toMatchObject({
      code: "observation-limit-exceeded", limit: "maxDerivedBytes",
    });
  });

  it("reserves derived space before accumulating export syntax facts", () => {
    const content = "export { a };";
    expect(() => analyzeJavaScript([{ path: "exports.ts", kind: "file", mediaType: "text/typescript", content,
      contentHash: hashFramedDomain("test-content", content), generated: false }], new DerivedObservationBudget(1050))).toThrow(expect.objectContaining({
      code: "observation-limit-exceeded", limit: "maxDerivedBytes", stage: "javascript-export-facts",
    }));
  });
  it("bounds deleted Git object contents used for move inference", async () => {
    const root = await fixtureRepository();
    await writeFile(join(root, "large.ts"), "x".repeat(4096));
    await execFileAsync("git", ["add", "large.ts"], { cwd: root });
    await execFileAsync("git", ["-c", "user.name=Projector Test", "-c", "user.email=projector@example.invalid", "commit", "--quiet", "-m", "large source"], { cwd: root });
    await unlink(join(root, "large.ts"));
    await expect(analyzeLocalRepository({ repositoryRoot: root, observationLimits: { maxFileBytes: 2048 } })).rejects.toMatchObject({
      code: "observation-limit-exceeded", limit: "maxFileBytes", scope: "large.ts",
    });
  });
  it("keeps distinct source and generated copies addressable when their syntax and bytes match", async () => {
    const root = await fixtureRepository();
    await mkdir(join(root, "copies"));
    await writeFile(join(root, "copies", "first.ts"), "export const identical = 1;\n");
    await writeFile(join(root, "copies", "second.ts"), "export const identical = 1;\n");
    await writeFile(join(root, "copies", "empty-a.d.ts"), "export {};\n");
    await writeFile(join(root, "copies", "empty-b.d.ts"), "export {};\n");
    const analysis = await analyzeLocalRepository({ repositoryRoot: root });
    expect(new Set(analysis.artifacts.map(({ id }) => id)).size).toBe(analysis.artifacts.length);
    expect(new Set(analysis.projectionUnits.map(({ id }) => id)).size).toBe(analysis.projectionUnits.length);
    const copies = analysis.projectionUnits.filter(({ key }) => key.startsWith("copies/"));
    expect(copies).toHaveLength(4);
    expect(copies[0]!.semanticSignature.hash).toBe(copies[1]!.semanticSignature.hash);
    const survivorId = copies.find(({ key }) => key === "copies/first.ts")!.id;
    await unlink(join(root, "copies", "second.ts"));
    await writeFile(join(root, "copies", "first.ts"), "export const renamed = 2;\n");
    const changed = await analyzeLocalRepository({ repositoryRoot: root });
    expect(changed.projectionUnits.find(({ key }) => key === "copies/first.ts")!.id).toBe(survivorId);
  });

  it("classifies the misplaced repository script from invocation and dependency evidence without executing it", async () => {
    const root = await fixtureRepository();
    const marker = join(root, "execution-marker.txt");
    process.env.PROJECTOR_FIXTURE_EXECUTION_MARKER = "execution-marker.txt";

    const result = await analyzeLocalRepository({ repositoryRoot: root });

    delete process.env.PROJECTOR_FIXTURE_EXECUTION_MARKER;
    await expect(readFile(marker, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    expect(result.capabilities.every((capability) => !capability.executesRepositoryCode)).toBe(true);
    expect(result.capabilities.every(({ adapterVersion }) => adapterVersion === "2.2.0")).toBe(true);

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

  it("collects tracked introduction history in one batched Git traversal", async () => {
    const root = await fixtureRepository();
    const wrapperRoot = await mkdtemp(join(tmpdir(), "projector-git-batch-wrapper-"));
    temporaryRoots.push(wrapperRoot);
    const marker = join(wrapperRoot, "log-invocations.txt");
    const gitPath = await gitExecutable();
    await gitWrapper(wrapperRoot, gitPath, marker, false);
    const originalPath = process.env.PATH;
    process.env.PATH = `${wrapperRoot}${delimiter}${originalPath ?? ""}`;

    try {
      const result = await analyzeLocalRepository({ repositoryRoot: root });
      expect(await readFile(marker, "utf8")).toBe("x");
      expect(result.gitIdentities.filter(({ tracked }) => tracked === true).every(({ introductionHistory, introductionCommit }) => introductionHistory === "available" && introductionCommit !== undefined)).toBe(true);
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
    }
  });

  it("rejects an unreadable filesystem entry without publishing a partial analysis", async () => {
    const root = await fixtureRepository();
    const unreadable = join(root, "scripts/unreadable.mjs");
    await writeFile(unreadable, "export const unavailable = true;\n");
    const restore = await denyRead(unreadable);
    await expect(analyzeLocalRepository({ repositoryRoot: root }).finally(restore)).rejects.toMatchObject({
      code: "observation-failed", scope: "scripts/unreadable.mjs",
    });
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
      blindSpots: expect.arrayContaining(["untracked Git-ignored files outside the repository inventory"]),
    });
  });

  it("excludes nested managed worktrees from the repository inventory", async () => {
    const root = await fixtureRepository();
    await mkdir(join(root, ".worktrees", "review", "src"), { recursive: true });
    await writeFile(join(root, ".worktrees", "review", "src", "duplicate.ts"), "export const duplicate = true;\n");

    const result = await analyzeLocalRepository({ repositoryRoot: root });

    expect(result.artifacts.some(({ locator }) => locator.startsWith(".worktrees/"))).toBe(false);
    expect(result.files.some(({ path }) => path.startsWith(".worktrees/"))).toBe(false);
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

  it("rejects a nonexistent repository root instead of proving an empty repository", async () => {
    const parent = await mkdtemp(join(tmpdir(), "projector-missing-root-"));
    temporaryRoots.push(parent);

    await expect(analyzeLocalRepository({ repositoryRoot: join(parent, "does-not-exist") })).rejects.toMatchObject({ code: "observation-failed" });
  });

  it("rejects a readable root when a required child artifact is unavailable", async () => {
    const root = await fixtureRepository();
    const unreadable = join(root, "scripts/child-unavailable.mjs");
    await writeFile(unreadable, "export const childUnavailable = true;\n");
    const restore = await denyRead(unreadable);
    await expect(analyzeLocalRepository({ repositoryRoot: root }).finally(restore)).rejects.toMatchObject({
      code: "observation-failed", scope: "scripts/child-unavailable.mjs",
    });
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

  it("rejects Git history failure without publishing a partial observation", async () => {
    const root = await fixtureRepository();
    const wrapperRoot = await mkdtemp(join(tmpdir(), "projector-git-wrapper-"));
    temporaryRoots.push(wrapperRoot);
    const gitPath = await gitExecutable();
    await gitWrapper(wrapperRoot, gitPath, undefined, true);
    const originalPath = process.env.PATH;
    process.env.PATH = `${wrapperRoot}${delimiter}${originalPath ?? ""}`;

    try {
      await expect(analyzeLocalRepository({ repositoryRoot: root })).rejects.toMatchObject({ code: "observation-failed", stage: "git-facts" });
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
    }
  });
});
