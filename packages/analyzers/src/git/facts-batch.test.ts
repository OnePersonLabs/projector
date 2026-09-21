import { execFile } from "node:child_process";
import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
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

afterEach(async () => {
  vi.mocked(observationGit).mockClear();
  vi.mocked(observationGitBytes).mockClear();
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("batched deleted Git facts", () => {
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
