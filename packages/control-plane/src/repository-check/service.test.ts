import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, expect, test } from "vitest";
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
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 })));
});

test("first observation is explicitly unavailable as a comparison; exact handling is independent from observation", async () => {
  const root = await repository();
  const first = await checkRepository(root, { sessionId: "one" });
  expect(first).toMatchObject({ status: "no previous observation", offer: true, pending: { fromHead: null, baselineEvidenceIdentity: null, paths: [] } });
  expect(await checkRepository(root, { mode: "commit-only", sessionId: "one" })).toMatchObject({ status: "unchanged", offer: false, pending: { findingId: first.pending!.findingId } });
  const handled = await checkRepository(root, { handled: { findingId: first.pending!.findingId, evidenceIdentity: first.pending!.evidenceIdentity } });
  expect(handled.pending).toBeUndefined();
  expect(await checkRepository(root)).toMatchObject({ status: "unchanged", offer: false });
});

test("dirty bytes change repeatedly; commit-only is cheap; pending coalesces and stale handling cannot erase it", async () => {
  const root = await repository();
  const first = await checkRepository(root, { sessionId: "one" });
  await writeFile(join(root, "file.txt"), "dirty 1");
  const cheap = await checkRepository(root, { mode: "commit-only", sessionId: "one" }, { maxFileBytes: 1 });
  expect(cheap.status).toBe("unchanged");
  const second = await checkRepository(root, { sessionId: "one" });
  expect(second).toMatchObject({ status: "changed", offer: false, pending: { findingId: first.pending!.findingId, paths: ["file.txt"], fromHead: null } });
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
