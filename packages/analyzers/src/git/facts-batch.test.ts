import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../filesystem/observation-io.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../filesystem/observation-io.js")>();
  return { ...actual, observationGit: vi.fn(actual.observationGit), observationGitBytes: vi.fn(actual.observationGitBytes) };
});

import { observationGit, observationGitBytes } from "../filesystem/observation-io.js";
import { collectGitFacts } from "./facts.js";

const execFileAsync = promisify(execFile);
const temporaryRoots: string[] = [];
const realObservationGit = vi.mocked(observationGit).getMockImplementation()!;

function mockTrackedPaths(paths: readonly string[], readHistory: (path: string, signal: AbortSignal | undefined) => Promise<string>): void {
  const objectId = "a".repeat(40), commitId = "b".repeat(40);
  vi.mocked(observationGit).mockImplementation(async (_root, args, _budget, options = {}) => {
    if (args[0] === "rev-parse") return `${commitId}\n`;
    if (args[0] === "ls-files") return paths.map((path) => `100644 ${objectId} 0\t${path}\0`).join("");
    if (args[0] === "status") return "";
    if (args[0] === "log" && args.includes("--follow")) return readHistory(args.at(-1)!, options.signal);
    if (args[0] === "log") return "";
    throw new Error(`Unexpected Git command: ${args.join(" ")}`);
  });
}

afterEach(async () => {
  vi.mocked(observationGit).mockClear();
  vi.mocked(observationGit).mockImplementation(realObservationGit);
  vi.mocked(observationGitBytes).mockClear();
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("batched deleted Git facts", () => {
  it("does not allocate a v2 move capture when either candidate side is empty", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-git-no-move-capture-"));
    temporaryRoots.push(root);
    mockTrackedPaths([], async () => "");
    await collectGitFacts(root, [], { contentStore: { schemaVersion: "projector.source-content/v2", path: join(root, "index.sqlite"), captureId: "test" } });
    await expect(readdir(`${join(root, "index.sqlite")}.temporary`)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("removes an owned v2 move capture when Git fails after capture creation", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-git-failed-move-capture-"));
    temporaryRoots.push(root);
    const commitId = "b".repeat(40), failure = new Error("tree read failed");
    vi.mocked(observationGit).mockImplementation(async (_root, args) => {
      if (args[0] === "rev-parse") return `${commitId}\n`;
      if (args[0] === "ls-files") return "";
      if (args[0] === "status") return " D old.ts\0?? new.ts\0";
      if (args[0] === "log") return "";
      if (args[0] === "ls-tree") throw failure;
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    });
    const temporaryDirectory = `${join(root, "index.sqlite")}.temporary`;
    await expect(collectGitFacts(root, [], {
      contentStore: { schemaVersion: "projector.source-content/v2", path: join(root, "index.sqlite"), captureId: "test" },
      entries: [{ path: "new.ts", kind: "file", mediaType: "text/plain", contentHash: "sha256:v1:test" as never, content: "x", generated: false }],
    })).rejects.toBe(failure);
    await expect(readdir(temporaryDirectory)).resolves.toEqual([]);
  });

  it("reads many deleted objects through one tree lookup and two bounded batches", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-git-facts-batch-"));
    temporaryRoots.push(root);
    const files = [
      { path: "plain.ts", content: "export const plain = 1;\n" },
      { path: "naïve.ts", content: "export const café = '☕';\n" },
      ...(process.platform === "win32" ? [] : [{ path: "line\nbreak.ts", content: "export const lineBreak = '✓';\n" }]),
    ];
    await execFileAsync("git", ["init", "--quiet", "--initial-branch=main"], { cwd: root });
    for (const file of files) await writeFile(join(root, file.path), file.content);
    await execFileAsync("git", ["add", "--all"], { cwd: root });
    await execFileAsync("git", ["-c", "user.name=Projector Test", "-c", "user.email=projector@example.invalid", "commit", "--quiet", "-m", "sources"], { cwd: root });
    for (const file of files) await unlink(join(root, file.path));

    const facts = await collectGitFacts(root, []);

    expect(facts.pendingMoveCandidates?.deleted).toEqual(expect.arrayContaining(files));
    const commands = [...vi.mocked(observationGit).mock.calls, ...vi.mocked(observationGitBytes).mock.calls].map(([, args]) => args);
    expect(commands.filter((args) => args[0] === "ls-tree" && args.includes("-z"))).toHaveLength(1);
    expect(commands.filter((args) => args[0] === "cat-file" && args.some((arg) => arg.startsWith("--batch-check=")))).toHaveLength(1);
    expect(commands.filter((args) => args[0] === "cat-file" && args.includes("--batch"))).toHaveLength(1);
    expect(commands.filter((args) => args[0] === "show" || (args[0] === "cat-file" && args.includes("-s")))).toHaveLength(0);
  });
});

describe("bounded introduction-history reads", () => {
  it("preserves exact introduction commits across a file rename", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-git-follow-rename-"));
    temporaryRoots.push(root);
    await execFileAsync("git", ["init", "--quiet", "--initial-branch=main"], { cwd: root });
    await mkdir(join(root, "old"));
    await writeFile(join(root, "old", "name.ts"), "export const value = 1;\n");
    await execFileAsync("git", ["add", "--all"], { cwd: root });
    await execFileAsync("git", ["-c", "user.name=Projector Test", "-c", "user.email=projector@example.invalid", "commit", "--quiet", "-m", "create source"], { cwd: root });
    const introduction = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim();
    await mkdir(join(root, "new"));
    await execFileAsync("git", ["mv", "old/name.ts", "new/name.ts"], { cwd: root });
    await execFileAsync("git", ["-c", "user.name=Projector Test", "-c", "user.email=projector@example.invalid", "commit", "--quiet", "-m", "rename source"], { cwd: root });

    const facts = await collectGitFacts(root, ["new/name.ts"]);

    expect(facts.identities[0]).toMatchObject({ path: "new/name.ts", tracked: true, introductionHistory: "available", introductionCommit: introduction });
  });

  it("follows each path independently with at most four reads while preserving result order", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-git-follow-concurrency-"));
    temporaryRoots.push(root);
    const paths = Array.from({ length: 12 }, (_, index) => `src/file-${index}.ts`);
    let active = 0, maximum = 0, calls = 0;
    mockTrackedPaths(paths, async (_path) => {
      active += 1; calls += 1; maximum = Math.max(maximum, active);
      try { await new Promise((resolve) => setTimeout(resolve, 12)); return `${"c".repeat(40)}\n`; }
      finally { active -= 1; }
    });

    const facts = await collectGitFacts(root, paths);

    expect(maximum).toBe(4);
    expect(calls).toBe(paths.length);
    expect(active).toBe(0);
    expect(facts.identities.map(({ path }) => path)).toEqual([...paths].sort());
    expect(facts.identities.every(({ introductionCommit }) => introductionCommit === "c".repeat(40))).toBe(true);
  });

  it("aborts and drains fallback reads while preserving the first Git error", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-git-follow-error-"));
    temporaryRoots.push(root);
    const paths = Array.from({ length: 10 }, (_, index) => `src/file-${index}.ts`);
    const firstError = new Error("first history failure");
    let active = 0, started = 0, siblingsCancelled = 0;
    mockTrackedPaths(paths, async (path, signal) => {
      active += 1; started += 1;
      try {
        await new Promise((resolve) => setTimeout(resolve, path.endsWith("file-0.ts") ? 2 : 20));
        if (path.endsWith("file-0.ts")) throw firstError;
        if (signal?.aborted) { siblingsCancelled += 1; throw new Error("sibling cancelled"); }
        return `${"c".repeat(40)}\n`;
      } finally { active -= 1; }
    });

    await expect(collectGitFacts(root, paths)).rejects.toBe(firstError);
    expect(started).toBe(4);
    expect(siblingsCancelled).toBe(3);
    expect(active).toBe(0);
  });

  it("drains active children on caller cancellation", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-git-follow-cancel-"));
    temporaryRoots.push(root);
    const paths = Array.from({ length: 10 }, (_, index) => `src/file-${index}.ts`);
    const controller = new AbortController();
    let active = 0, started = 0, cancelled = 0, maximum = 0;
    let resolveFourStarted!: () => void;
    const fourStarted = new Promise<void>((resolve) => { resolveFourStarted = resolve; });
    mockTrackedPaths(paths, async (_path, signal) => {
      active += 1; started += 1; maximum = Math.max(maximum, active);
      if (started === 4) resolveFourStarted();
      try {
        await new Promise((resolve) => setTimeout(resolve, 20));
        if (signal?.aborted) { cancelled += 1; throw new Error("child cancelled"); }
        return `${"c".repeat(40)}\n`;
      } finally { active -= 1; }
    });
    const pending = collectGitFacts(root, paths, { signal: controller.signal });
    await fourStarted;
    controller.abort();

    await expect(pending).rejects.toThrow(/cancelled/iu);
    expect(maximum).toBe(4);
    expect(started).toBe(4);
    expect(cancelled).toBe(4);
    expect(active).toBe(0);
  });
});
