import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, expect, test } from "vitest";
import { CodeIndexRunSchema } from "@projector/core";
import { SqliteCodeStore, withObservationScope } from "@projector/runtime";
import { executeCodeOperation, shutdownCodeIndexRuns } from "../code-intelligence/service.js";
import { checkRepository } from "./service.js";

const exec = promisify(execFile);
const roots: string[] = [];
const git = (root: string, ...args: string[]) => exec("git", args, { cwd: root });
async function repository() {
  const root = await mkdtemp(join(tmpdir(), "projector-check-"));
  roots.push(root);
  await git(root, "init");
  await git(root, "config", "user.name", "Test");
  await git(root, "config", "user.email", "test@example.invalid");
  await writeFile(join(root, "file.txt"), "initial");
  await writeFile(join(root, ".gitignore"), "ignored.txt\n");
  await git(root, "add", ".");
  await git(root, "commit", "-m", "initial");
  return root;
}
afterEach(async () => {
  await shutdownCodeIndexRuns();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 })));
});

async function indexNative(root: string): Promise<string> {
  const signal = new AbortController().signal;
  const operation = (name: "code.index" | "code.index-wait", input: unknown) =>
    withObservationScope({ signal, limits: { timeoutMs: 60_000 } }, () =>
      executeCodeOperation(root, name, input, { signal, environment: process.env }),
    );
  const started = CodeIndexRunSchema.parse(await operation("code.index", { provider: "native", timeoutMs: 30_000 }));
  const finished = started.state === "running"
    ? CodeIndexRunSchema.parse(await operation("code.index-wait", { runId: started.id, timeoutMs: 30_000 }))
    : started;
  expect(finished.state, finished.error).toBe("published");
  return finished.generation!;
}

test("pins the repository-check baseline across independent indexes and later impact", async () => {
  const root = await repository();
  const source = join(root, "value.ts");
  await writeFile(source, "export const value = () => 1;\n");
  const first = await checkRepository(root);
  const baseline = first.semantic!.generation;
  await writeFile(source, "export const value = () => 2;\n");
  await indexNative(root);
  await writeFile(source, "export const value = () => 3;\n");
  await indexNative(root);
  const store = await SqliteCodeStore.open(root);
  try {
    store.pruneUnpinned();
    expect(store.hasGeneration(baseline)).toBe(true);
  } finally { store.close(); }
  const next = await checkRepository(root);
  expect(next.status).toBe("changed");
  expect(next.semantic?.affectedPaths).toContain("value.ts");
  expect(next.semantic?.unknowns).not.toContain(expect.stringContaining("Prior semantic baseline is unavailable"));
});

test("a failed state publication retains the old semantic baseline pin", async () => {
  const root = await repository();
  const source = join(root, "value.ts");
  await writeFile(source, "export const value = () => 1;\n");
  const first = await checkRepository(root);
  const baseline = first.semantic!.generation;
  const cache = join(root, ".projector/runtime/repository-check/state.json");
  const oldState = await readFile(cache, "utf8");
  await writeFile(source, "export const value = () => 2;\n");
  const temporary = `${cache}.${process.pid}.tmp`;
  await writeFile(temporary, "occupied");
  expect((await checkRepository(root)).status).toBe("incomplete");
  expect(await readFile(cache, "utf8")).toBe(oldState);
  const store = await SqliteCodeStore.open(root);
  try {
    store.pruneUnpinned();
    expect(store.hasGeneration(baseline)).toBe(true);
  } finally { store.close(); }
  await rm(temporary);
  expect((await checkRepository(root)).semantic?.affectedPaths).toContain("value.ts");
});

test("combined Git output respects the caller's allowance across separate commands", async () => {
  const root = await repository();
  await checkRepository(root);
  const statePath = join(root, ".projector/runtime/repository-check/state.json");
  const priorState = await readFile(statePath, "utf8");
  for (let index = 0; index < 5; index++) {
    await writeFile(join(root, `untracked-${index}-${"long-name".repeat(4)}.txt`), "content");
  }

  const pathspec = ["--", ".", ":(exclude).projector/runtime", ":(exclude).projector/runtime/**"];
  const [topLevel, head, untracked] = await Promise.all([
    git(root, "rev-parse", "--show-toplevel"),
    git(root, "rev-parse", "--revs-only", "HEAD"),
    git(root, "ls-files", "--others", "--exclude-standard", "-z", ...pathspec),
  ]);
  const individualBytes = [topLevel.stdout, head.stdout, untracked.stdout].map((output) => Buffer.byteLength(output));
  const combinedBytes = individualBytes.reduce((sum, bytes) => sum + bytes, 0);
  const allowance = combinedBytes - 1;
  expect(Math.max(...individualBytes)).toBeLessThan(allowance);

  const checked = await withObservationScope({ limits: { maxGitOutputBytes: allowance } }, () => checkRepository(root));
  expect(checked.status).toBe("incomplete");
  expect(checked.limitations).toEqual(expect.arrayContaining([expect.stringContaining("maxGitOutputBytes")]));
  expect(await readFile(statePath, "utf8")).toBe(priorState);
});

test("parallel file inspection reserves one shared total-byte allowance", async () => {
  const root = await repository();
  await checkRepository(root);
  const statePath = join(root, ".projector/runtime/repository-check/state.json");
  const priorState = await readFile(statePath, "utf8");
  for (let index = 0; index < 4; index++) {
    await writeFile(join(root, `parallel-${index}.txt`), "four");
  }

  const checked = await checkRepository(root, {}, { maxFileBytes: 8, maxTotalBytes: 12 });
  expect(checked.status).toBe("incomplete");
  expect(checked.limitations).toEqual(expect.arrayContaining([expect.stringContaining("maxTotalBytes")]));
  expect(await readFile(statePath, "utf8")).toBe(priorState);
});

test("a legacy pruned baseline reestablishes semantic history with an explicit unknown", async () => {
  const root = await repository();
  const source = join(root, "value.ts");
  await writeFile(source, "export const value = () => 1;\n");
  const first = await checkRepository(root);
  const baseline = first.semantic!.generation;
  const store = await SqliteCodeStore.open(root);
  try { store.releaseRetained(baseline, "repository-check:baseline"); }
  finally { store.close(); }
  await writeFile(source, "export const value = () => 2;\n");
  await indexNative(root);
  await writeFile(source, "export const value = () => 3;\n");
  await indexNative(root);
  const pruner = await SqliteCodeStore.open(root);
  try {
    pruner.pruneUnpinned();
    expect(pruner.hasGeneration(baseline)).toBe(false);
  } finally { pruner.close(); }
  const recovered = await checkRepository(root);
  expect(recovered.status).toBe("changed");
  expect(recovered.semantic?.unknowns).toEqual(expect.arrayContaining([
    expect.stringContaining("Prior semantic baseline is unavailable"),
  ]));
  expect(recovered.semantic?.generation).not.toBe(baseline);
  expect((await checkRepository(root)).status).toBe("unchanged");
});

test("first observation is explicitly unavailable as a comparison; exact handling is independent from observation", async () => {
  const root = await repository();
  const first = await checkRepository(root, { sessionId: "one" });
  expect(first).toMatchObject({ status: "no previous observation", offer: true, pending: { fromHead: null, baselineEvidenceIdentity: null, paths: [] } });
  expect(first.semantic?.generation).toMatch(/^sha256:v1:/u);
  expect(await checkRepository(root, { mode: "commit-only", sessionId: "one" })).toMatchObject({ status: "unchanged", offer: false, pending: { findingId: first.pending!.findingId } });
  const handled = await checkRepository(root, { handled: { findingId: first.pending!.findingId, evidenceIdentity: first.pending!.evidenceIdentity } });
  expect(handled.pending).toBeUndefined();
  expect(await checkRepository(root)).toMatchObject({ status: "unchanged", offer: false });
});

test("full check publishes a current native generation and reports additive semantic paths", async () => {
  const root = await repository();
  await writeFile(join(root, "value.ts"), "export const value = () => 1;\n");
  await writeFile(join(root, "consumer.ts"), "import { value } from './value.js'; export const consume = () => value();\n");
  const before = await checkRepository(root);
  expect(before.semantic?.generation).toMatch(/^sha256:v1:/u);
  await writeFile(join(root, "value.ts"), "export const value = () => 2;\n");
  const after = await checkRepository(root);
  expect(after.status).toBe("changed");
  expect(after.semantic?.generation).not.toBe(before.semantic?.generation);
  expect(after.semantic?.affectedPaths).toContain("value.ts");
  expect(after.pending?.paths).toContain("value.ts");
});

test("dirty bytes change repeatedly; commit-only is cheap; pending coalesces and stale handling cannot erase it", async () => {
  const root = await repository();
  const first = await checkRepository(root, { sessionId: "one" });
  await writeFile(join(root, "file.txt"), "dirty 1");
  const cheap = await checkRepository(root, { mode: "commit-only", sessionId: "one" }, { maxFileBytes: 1 });
  expect(cheap.status).toBe("unchanged");
  const second = await checkRepository(root, { sessionId: "one" });
  expect(second).toMatchObject({ status: "changed", offer: false, pending: { findingId: first.pending!.findingId, paths: ["file.txt"], fromHead: null } });
  expect(second.semantic?.generation).not.toBe(first.semantic?.generation);
  await writeFile(join(root, "file.txt"), "dirty 2");
  const third = await checkRepository(root, { handled: { findingId: second.pending!.findingId, evidenceIdentity: second.pending!.evidenceIdentity }, sessionId: "one" });
  expect(third.status).toBe("incomplete");
  expect(third.pending?.evidenceIdentity).not.toBe(second.pending?.evidenceIdentity);
  expect((await checkRepository(root, { sessionId: "two" })).offer).toBe(true);
});

test("observes staged identities, deletions, nonignored untracked and canonical bytes, excluding runtime", async () => {
  const root = await repository();
  const first = await checkRepository(root);
  await checkRepository(root, { handled: { findingId: first.pending!.findingId, evidenceIdentity: first.pending!.evidenceIdentity } });
  await mkdir(join(root, ".projector", "model"), { recursive: true });
  await writeFile(join(root, ".projector", "model", "meaning.json"), "{}");
  await writeFile(join(root, "new.txt"), "new");
  await writeFile(join(root, "ignored.txt"), "ignore");
  await rm(join(root, "file.txt"));
  const changed = await checkRepository(root);
  expect(changed.pending?.paths).toEqual([".projector/model/meaning.json", "file.txt", "new.txt"]);
  await writeFile(join(root, ".projector", "runtime", "noise"), "noise");
  expect((await checkRepository(root)).status).toBe("unchanged");
  await git(root, "add", "new.txt");
  expect((await checkRepository(root)).status).toBe("changed");
  await writeFile(join(root, "new.txt"), "new second");
  await git(root, "add", "new.txt");
  await writeFile(join(root, "new.txt"), "new");
  expect((await checkRepository(root)).status).toBe("changed");
});

test("commit-only detects new commits in a clean tree and retains diff anchors", async () => {
  const root = await repository();
  const first = await checkRepository(root);
  await checkRepository(root, { handled: { findingId: first.pending!.findingId, evidenceIdentity: first.pending!.evidenceIdentity } });
  await writeFile(join(root, "file.txt"), "committed change");
  await git(root, "add", "file.txt");
  await git(root, "commit", "-m", "change");
  const changed = await checkRepository(root, { mode: "commit-only" });
  expect(changed).toMatchObject({ status: "changed", pending: { paths: ["file.txt"], fromHead: first.observation!.head } });
  expect(changed.pending?.toHead).not.toBe(changed.pending?.fromHead);
});

test("bounds and lock failures preserve unresolved state; malformed baseline never becomes clean", async () => {
  const root = await repository();
  const first = await checkRepository(root);
  const cache = join(root, ".projector/runtime/repository-check/state.json");
  const original = await readFile(cache, "utf8");
  await writeFile(join(root, "large.txt"), "too many bytes");
  expect(await checkRepository(root, {}, { maxFileBytes: 4 })).toMatchObject({ status: "incomplete", pending: { findingId: first.pending!.findingId } });
  expect(await readFile(cache, "utf8")).toBe(original);
  expect((await checkRepository(root, {}, { maxMilliseconds: 0 })).status).toBe("incomplete");
  await writeFile(join(root, ".projector/runtime/repository-check/check.lock"), "{}");
  expect((await checkRepository(root)).status).toBe("incomplete");
  expect(await readFile(cache, "utf8")).toBe(original);
  await rm(join(root, ".projector/runtime/repository-check/check.lock"));
  await writeFile(cache, "broken");
  expect((await checkRepository(root)).status).toBe("incomplete");
  expect(await readFile(cache, "utf8")).toBe("broken");
});

test("concurrent calls cannot overwrite a pending finding", async () => {
  const root = await repository();
  const results = await Promise.all([checkRepository(root), checkRepository(root)]);
  expect(results.map((result) => result.status).sort()).toEqual(["incomplete", "no previous observation"]);
  expect((await checkRepository(root)).pending?.findingId).toBe(results.find((result) => result.pending)?.pending?.findingId);
});

test("unchanged cheap checks preserve cache write time; a new finding can be offered in the same session", async () => {
  const root = await repository();
  const first = await checkRepository(root, { sessionId: "same" });
  const cache = join(root, ".projector/runtime/repository-check/state.json");
  await utimes(cache, new Date(1000), new Date(1000));
  const before = await stat(cache);
  expect((await checkRepository(root, { sessionId: "same", mode: "commit-only" })).offer).toBe(false);
  expect((await stat(cache)).mtimeMs).toBe(before.mtimeMs);
  await checkRepository(root, { handled: { findingId: first.pending!.findingId, evidenceIdentity: first.pending!.evidenceIdentity }, sessionId: "same" });
  await writeFile(join(root, "file.txt"), "new investigation");
  expect(await checkRepository(root, { sessionId: "same" })).toMatchObject({ status: "changed", offer: true });
});

test("unborn checkout is observable and disclosed paths remain bounded across coalescing", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-check-unborn-"));
  roots.push(root);
  await git(root, "init");
  const first = await checkRepository(root);
  expect(first).toMatchObject({ status: "no previous observation", observation: { head: null } });
  await Promise.all(Array.from({ length: 105 }, (_, index) => writeFile(join(root, `file-${index}.txt`), "a")));
  const changed = await checkRepository(root);
  expect(changed.pending?.paths).toHaveLength(100);
  expect(changed.pending?.omittedPaths).toBe(5);
  await writeFile(join(root, "file-104.txt"), "b");
  expect((await checkRepository(root)).pending?.omittedPaths).toBe(5);
});

test("dirty submodules and symlinked paths are incomplete and preserve pending investigation", async () => {
  const root = await repository();
  const first = await checkRepository(root);
  const cache = join(root, ".projector/runtime/repository-check/state.json");
  const original = await readFile(cache, "utf8");
  const nested = join(root, "nested");
  await mkdir(nested);
  await git(nested, "init");
  await writeFile(join(nested, "file.txt"), "nested");
  await git(nested, "add", ".");
  await git(nested, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "nested");
  const submodule = await checkRepository(root);
  expect(submodule).toMatchObject({ status: "incomplete", pending: { findingId: first.pending!.findingId } });
  expect(submodule.limitations.join(" ")).toMatch(/nonregular file/);
  expect(await readFile(cache, "utf8")).toBe(original);
  await rm(nested, { recursive: true });
  const outside = await repository();
  await symlink(outside, join(root, "linked"), process.platform === "win32" ? "junction" : "dir");
  const linked = await checkRepository(root);
  expect(linked).toMatchObject({ status: "incomplete", pending: { findingId: first.pending!.findingId } });
  expect(linked.limitations.join(" ")).toMatch(/Symbolic links/);
  expect(await readFile(cache, "utf8")).toBe(original);
});
