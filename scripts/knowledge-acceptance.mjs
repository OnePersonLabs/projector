import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

// Exercise the current working source and its real canonical records. Each call
// starts a new public CLI process; no assertion trusts an old task report.
const exec = promisify(execFile);
const sourceRoot = fileURLToPath(new URL("../", import.meta.url));
const cli = path.join(sourceRoot, "packages/cli/dist/cli.js");
const boundaryScript = path.join(sourceRoot, "scripts/check-package-boundaries.mjs");
const temporaryParent = await realpath(tmpdir());
const fixture = await mkdtemp(path.join(temporaryParent, "projector-knowledge-acceptance-"));
const output = path.join(sourceRoot, ".temp/knowledge-acceptance.json");
const steps = [];
const report = {
  kind: "public-cli-functional-acceptance",
  status: "running",
  scope: "Static dependency evidence, retained meaning, and dependency-scoped invalidation on a copy of Projector.",
  limitations: ["Does not measure ordinary-agent task quality, tokens, maintenance cost, or economic advantage.", "Static conformance does not establish runtime behavior or sandbox availability."],
  steps,
};

async function run(label, command, args, { json = false } = {}) {
  const start = performance.now();
  let result;
  try { result = { ...await exec(command, args, { cwd: fixture, maxBuffer: 64 * 1024 * 1024, timeout: 120_000 }), code: 0 }; }
  catch (error) {
    if (typeof error.code !== "number") throw error;
    result = error;
  }
  const stdout = result.stdout ?? "";
  const value = json ? JSON.parse(stdout) : undefined;
  steps.push({ label, exitCode: result.code, milliseconds: Math.round(performance.now() - start), outputBytes: Buffer.byteLength(stdout), outputHash: createHash("sha256").update(stdout).digest("hex"),
    ...(value === undefined ? {} : { contextId: value.id ?? value.contextId, interpretation: value.interpretation?.status, binding: value.status, governance: value.governance?.status, reasons: value.reasons }),
    ...(result.code === 0 ? {} : { stderr: (result.stderr ?? "").slice(0, 2000) }),
  });
  console.log(`${label}: exit ${result.code}${value?.status ? `, knowledge ${value.status}` : ""}${value?.governance ? `, architecture ${value.governance.status}` : ""}`);
  return { code: result.code, value, stdout };
}

async function context(label, request) {
  const result = await run(label, process.execPath, [cli, "context", request, "--entity", "core-static-dependencies", "--format", "json"], { json: true });
  assert.equal(result.code, 0, label);
  assert.equal(result.value.persisted, true);
  assert.equal(result.value.interpretation.status, "direct");
  assert(result.value.interpretation.candidates.some(candidate => candidate.entityId === "lens:core-static-dependencies" && candidate.direct));
  assert(result.value.branches.some(branch => branch.lensObligations.length > 0));
  return result.value;
}

async function reconcile(label, id, binding, governance) {
  const result = await run(label, process.execPath, [cli, "reconcile", id, "--format", "json"], { json: true });
  assert(binding.includes(result.value.status), `${label}: expected ${binding}, got ${result.value.status}: ${JSON.stringify(result.value.reasons)}`);
  assert.equal(result.value.governance.status, governance, label);
  assert.equal(result.code, governance === "violated" ? 2 : result.value.status === "stale" ? 4 : 0, label);
  return result.value;
}

try {
  await lstat(cli);
  const listed = await exec("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: sourceRoot, maxBuffer: 8 * 1024 * 1024 });
  let copied = 0;
  for (const relative of [...new Set(listed.stdout.split("\0").filter(Boolean))]) {
    const source = path.resolve(sourceRoot, relative);
    const target = path.resolve(fixture, relative);
    assert(target.startsWith(fixture + path.sep), "Fixture path must remain beneath its generated root.");
    // Retained runtime state is deliberately excluded even if accidentally tracked.
    if (/^\.projector\/(?:runtime|telemetry|watch)\//u.test(relative) || /^\.projector\/state\.db/u.test(relative)) continue;
    let stat;
    try { stat = await lstat(source); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    assert(stat.isFile() && !stat.isSymbolicLink(), `Only regular workspace files may be copied: ${relative}`);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
    copied++;
  }
  report.copiedFiles = copied;
  await exec("git", ["init", "-q", fixture]);
  await exec("git", ["add", "."], { cwd: fixture });
  await exec("git", ["-c", "user.name=Projector acceptance", "-c", "user.email=acceptance@example.invalid", "commit", "-qm", "Current Projector source fixture"], { cwd: fixture });

  assert.equal((await run("ordinary boundary script: unchanged", process.execPath, [boundaryScript])).code, 0);
  const first = await context("capture before choosing edits", "Check the core static dependency boundary before changing implementation");
  const compact = await run("agent view retains meaning without internal query transcripts", process.execPath, [cli, "context", first.request, "--entity", "core-static-dependencies", "--compact", "--format", "json"], { json: true });
  assert.equal(compact.code, 0);
  assert.equal(compact.value.id, first.id);
  assert.deepEqual(compact.value.branches.map(branch => branch.context.items), first.branches.map(branch => branch.context.items));
  const normalizeObligations = values => values.map(value => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))))).sort();
  assert.deepEqual(normalizeObligations(compact.value.branches.flatMap(branch => branch.lensObligations.flatMap(({ unitIds, ...obligation }) => unitIds.map(unitId => ({ ...obligation, unitId }))))), normalizeObligations(first.branches.flatMap(branch => branch.lensObligations)));
  assert.deepEqual(compact.value.unknowns, first.unknowns);
  assert(compact.value.branches.every(branch => branch.closure === undefined));
  await reconcile("fresh-process reuse", first.id, ["current", "rebound"], "conformant");

  await writeFile(path.join(fixture, "unrelated-acceptance-note.txt"), "Unrelated fixture note.\n");
  const rebound = await reconcile("unrelated change keeps knowledge reusable", first.id, ["rebound"], "conformant");
  assert.notEqual(rebound.capturedState.worktreeDigest, rebound.currentState.worktreeDigest);

  const selected = path.join(fixture, "packages/core/src/index.ts");
  const original = await readFile(selected, "utf8");
  await writeFile(selected, original + "\n// Source changed without changing the accepted dependency rule.\n");
  await reconcile("source-only edit invalidates retained evidence", first.id, ["stale"], "conformant");
  const second = await context("subsequent request reuses accepted meaning", "Review a second core change using the retained architectural decision");
  assert.equal(second.branches[0].interpretation.entityId, first.branches[0].interpretation.entityId);
  assert.notEqual(second.request, first.request);
  assert.equal(second.requestFingerprint, first.requestFingerprint, "Different wording of the same explicitly selected operation retains its semantic request fingerprint.");

  const consumer = path.join(fixture, "packages/core/src/acceptance-consumer.ts");
  await writeFile(consumer, "// A new member was absent from the saved selection.\nexport const acceptanceConsumer = (value: string): string => value.trim();\n");
  const expanded = await reconcile("new selected member invalidates an earlier query", second.id, ["stale"], "conformant");
  assert(expanded.branches.some(branch => branch.validation.changedQueryDependencyIds.length > 0), "New membership must change a recorded query dependency.");
  const third = await context("alternate handwritten implementation remains allowed", "Check another handwritten implementation against the same core boundary");
  assert(third.branches.reduce((sum, branch) => sum + branch.lensObligations.length, 0) > second.branches.reduce((sum, branch) => sum + branch.lensObligations.length, 0));
  assert.equal((await run("ordinary boundary script: alternate implementation", process.execPath, [boundaryScript])).code, 0);

  await writeFile(consumer, "import { compileProjectionLenses } from '@projector/engine';\nexport const acceptanceConsumer = compileProjectionLenses;\n");
  await reconcile("out-of-band forbidden import is a violation", third.id, ["stale"], "violated");
  const baselineViolation = await run("ordinary boundary script also detects forbidden import", process.execPath, [boundaryScript]);
  assert.equal(baselineViolation.code, 1);
  assert(steps.at(-1).stderr.includes("@projector/core must not depend on @projector/engine"));

  await writeFile(consumer, "export const acceptanceConsumer = (value: string): string => value.trim();\n");
  // Discard derived knowledge without touching the canonical model.
  await rm(path.join(fixture, ".projector/runtime/knowledge"), { recursive: true, force: true });
  await rm(path.join(fixture, ".projector/state.db"), { force: true });
  const rebuilt = await context("rebuild after discarding derived state preserves meaning", "Rebuild context for the original core architectural commitment");
  assert.equal(rebuilt.branches[0].interpretation.entityId, first.branches[0].interpretation.entityId);
  await reconcile("rebuilt knowledge is independently checked", rebuilt.id, ["current", "rebound"], "conformant");
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack ?? String(error);
  process.exitCode = 1;
  console.error(report.error);
} finally {
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  const resolved = await realpath(fixture);
  assert.equal(path.dirname(resolved), temporaryParent);
  assert(path.basename(resolved).startsWith("projector-knowledge-acceptance-"));
  await rm(resolved, { recursive: true, force: true });
}
