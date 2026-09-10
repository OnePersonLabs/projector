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
const cloneFixture = `${fixture}-clone`;
const output = path.join(sourceRoot, ".temp/knowledge-acceptance.json");
const steps = [];
const report = {
  kind: "public-cli-functional-acceptance",
  status: "running",
  scope: "Static dependency evidence, retained meaning, and dependency-scoped invalidation on a copy of Projector.",
  limitations: ["Does not measure ordinary-agent task quality, tokens, maintenance cost, or economic advantage.", "Static conformance does not establish runtime behavior or sandbox availability."],
  steps,
};

async function run(label, command, args, { json = false, cwd = fixture } = {}) {
  const start = performance.now();
  let result;
  try { result = { ...await exec(command, args, { cwd, maxBuffer: 64 * 1024 * 1024, timeout: 120_000 }), code: 0 }; }
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

async function context(label, request, cwd = fixture) {
  const result = await run(label, process.execPath, [cli, "context", "--request", request, "--entity", "lens:core-static-dependencies", "--format", "json"], { json: true, cwd });
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

function assertDisclosure(disclosure, complete, included, label) {
  assert.deepEqual(disclosure, { total: complete.length, included: included.length, omitted: complete.length - included.length }, label);
  for (const value of included) assert(complete.some(original => JSON.stringify(original) === JSON.stringify(value)), `${label}: disclosed value must be unchanged`);
}

const stable = value => JSON.stringify(value, (_, item) => item !== null && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right))) : item);

function assertContextDisclosure(full, view) {
  assert.equal(view.detail, "agent");
  assert.equal(view.id, full.id, "A compact saved view must name the same complete retained context.");
  assertDisclosure(view.interpretation.candidateDisclosure, full.interpretation.candidates, view.interpretation.candidates, "candidate identity samples");
  assertDisclosure(view.interpretation.unknownDisclosure, full.interpretation.unknowns, view.interpretation.unknowns, "interpretation uncertainty");
  assertDisclosure(view.unknownDisclosure, full.unknowns, view.unknowns, "context uncertainty");
  assertDisclosure(view.branchDisclosure, full.branches.map(branch => branch.id), view.branches.map(branch => branch.id), "branch identity samples");
  for (const branch of view.branches) {
    const complete = full.branches.find(value => value.id === branch.id);
    assert(complete, "Every displayed branch must retain its original identity.");
    assert.deepEqual(branch.interpretation, complete.interpretation);
    assert.equal(branch.closure, undefined);
    assertDisclosure(branch.context.itemsDisclosure, complete.context.items, branch.context.items, "whole context records");
    const includedIds = branch.context.items.map(item => item.entityId);
    const deferredItems = branch.context.deferredItems.flatMap(({ items, ...group }) => items.map(item => ({ ...group, ...item })));
    const deferredIds = deferredItems.map(item => item.entityId);
    const allDeferred = complete.context.items.filter(item => !includedIds.includes(item.entityId));
    assert.equal(new Set([...includedIds, ...deferredIds]).size, includedIds.length + deferredIds.length, "Full records and deferred samples must not overlap or duplicate identities.");
    assertDisclosure(branch.context.deferredIdentityDisclosure, allDeferred.map(item => item.entityId), deferredIds, "omitted identities retain exact counts and valid samples");
    for (const item of deferredItems) {
      const original = complete.context.items.find(value => value.entityId === item.entityId);
      assert(original);
      assert.deepEqual({ kind: item.kind, band: item.band, disclosure: item.disclosure }, { kind: original.kind, band: original.band, disclosure: original.disclosure });
      assert.equal(item.contentBytes, Buffer.byteLength(original.content));
      assert(item.reason.length > 0, "Deferral requires an explicit expansion reason.");
    }
    assertDisclosure(branch.context.requiredExpansionDisclosure, complete.context.requiredExpansionIds, branch.context.requiredExpansionIds, "semantic expansion requirements");
    assertDisclosure(branch.context.requiredDisclosureExpansion, view.interpretation.status === "direct" ? allDeferred.filter(item => item.band === "direct" || item.band === "governing").map(item => item.entityId) : [], branch.context.requiredDisclosureExpansionIds, "required focused meaning remains accounted for even when its identity sample is omitted");
    assert.equal(branch.context.requiredBudgetOverrun, complete.context.requiredBudgetOverrun);
    assertDisclosure(branch.frontierDisclosure, complete.frontier, branch.frontier, "unknown frontier");

    // Partition every per-unit obligation by its exact semantic content. The
    // compact view may sample unit IDs, but must retain predicates, status,
    // uncertainty and the complete applicability count.
    const groups = new Map();
    for (const { unitId, membershipFingerprint, applicabilityFingerprint, ...semantic } of complete.lensObligations) {
      const key = stable(semantic);
      const group = groups.get(key) ?? { semantic, unitIds: [], memberships: new Set(), applicability: new Set() };
      group.unitIds.push(unitId); group.memberships.add(membershipFingerprint); group.applicability.add(applicabilityFingerprint);
      groups.set(key, group);
    }
    const remaining = [...groups.values()];
    assert.deepEqual(branch.obligationDisclosure, { total: remaining.length, included: branch.lensObligations.length, omitted: remaining.length - branch.lensObligations.length });
    for (const { unitIds, unitCount, omittedUnitCount, membershipFingerprintVariants, applicabilityFingerprintVariants, unknownCount, omittedUnknownCount, ...semantic } of branch.lensObligations) {
      const { unknowns, ...meaning } = semantic;
      const index = remaining.findIndex(group => {
        const { unknowns: originalUnknowns, ...originalMeaning } = group.semantic;
        return stable(meaning) === stable(originalMeaning) && originalUnknowns.length === unknownCount && unknowns.every(value => originalUnknowns.includes(value));
      });
      assert(index >= 0, "Every included obligation must retain exact predicates and governance distinctions.");
      const [group] = remaining.splice(index, 1);
      assert.equal(unitCount, group.unitIds.length);
      assert.equal(omittedUnitCount, unitCount - unitIds.length);
      assert(unitIds.every(id => group.unitIds.includes(id)));
      assert.equal(membershipFingerprintVariants, group.memberships.size);
      assert.equal(applicabilityFingerprintVariants, group.applicability.size);
      assert.equal(omittedUnknownCount, unknownCount - unknowns.length);
    }
    assert.deepEqual(branch.deferredObligationDisclosure, { total: remaining.length, included: branch.deferredObligations.length, omitted: remaining.length - branch.deferredObligations.length });
    for (const obligation of branch.deferredObligations) {
      const { reason, ruleIds, ruleDisclosure, validatorIds, validatorDisclosure, expectationKinds, expectationDisclosure, ...summary } = obligation;
      const index = remaining.findIndex(({ semantic, unitIds }) => stable({ lensId: semantic.lensId, lensVersion: semantic.lensVersion, authorityRecordId: semantic.authorityRecordId, status: semantic.status, unitCount: unitIds.length, predicateCount: semantic.predicates.length, unknownCount: semantic.unknowns.length }) === stable(summary)
        && ruleIds.every(id => semantic.ruleIds.includes(id)) && semantic.ruleIds.length === ruleDisclosure.total
        && validatorIds.every(id => semantic.validatorIds.includes(id)) && semantic.validatorIds.length === validatorDisclosure.total
        && expectationKinds.every(kind => semantic.expectationKinds.includes(kind)) && semantic.expectationKinds.length === expectationDisclosure.total);
      assert(index >= 0, "Every deferred obligation must identify the omitted semantic group and its full counts.");
      assert(reason.length > 0);
      const [{ semantic }] = remaining.splice(index, 1);
      assertDisclosure(ruleDisclosure, semantic.ruleIds, ruleIds, "deferred rule identities");
      assertDisclosure(validatorDisclosure, semantic.validatorIds, validatorIds, "deferred validator identities");
      assertDisclosure(expectationDisclosure, semantic.expectationKinds, expectationKinds, "deferred expectation kinds");
    }
    assert.equal(remaining.length, branch.deferredObligationDisclosure.omitted, "Every unsampled full-context obligation must remain in exact omission accounting.");
    assert.equal(branch.fullEvidence.command, "projector");
    assert.deepEqual(branch.fullEvidence.arguments, ["context", "--request", full.request, "--entity", branch.interpretation.entityId, "--format", "json", "--mode", "observe"]);
  }
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
  const first = await context("capture before choosing edits", "--core-boundary: check the static dependency rule before changing implementation");
  const compact = await run("agent view accounts for every disclosed or deferred obligation", process.execPath, [cli, "context", "--request", first.request, "--entity", "lens:core-static-dependencies", "--compact", "--format", "json"], { json: true });
  assert.equal(compact.code, 0);
  assertContextDisclosure(first, compact.value);
  assert(compact.value.branches.some(branch => branch.context.itemsDisclosure.omitted > 0), "This real repository must exercise deferred detail.");
  assert(compact.value.branches.some(branch => branch.context.deferredIdentityDisclosure.omitted > 0), "This real repository must exercise omitted identity metadata as well as omitted bodies.");
  assert(Buffer.byteLength(compact.stdout) < Buffer.byteLength(JSON.stringify(first)) / 2, "The view must materially reduce this repository's output, not merely rename it.");
  const expandedView = await run("returned drill-down exposes unchanged full current dependency proof", process.execPath, [cli, ...compact.value.branches[0].fullEvidence.arguments], { json: true });
  assert.equal(expandedView.code, 0);
  assert.equal(expandedView.value.persisted, false);
  assert.deepEqual(expandedView.value.branches, first.branches, "Omitted transport detail remains in full context, including dependency proofs and every per-unit obligation.");
  assert.deepEqual(expandedView.value.unknowns, first.unknowns);
  assert.equal(expandedView.value.requestFingerprint, first.requestFingerprint);
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
  const violation = await reconcile("out-of-band forbidden import is a violation", third.id, ["stale"], "violated");
  const compactViolation = await run("compact reconciliation preserves binding and every finding count", process.execPath, [cli, "reconcile", third.id, "--compact", "--format", "json"], { json: true });
  assert.equal(compactViolation.code, 2);
  assert.equal(compactViolation.value.status, violation.status);
  assert.equal(compactViolation.value.governance.status, "violated");
  assertDisclosure(compactViolation.value.branchDisclosure, violation.branches.map(branch => branch.branchId), compactViolation.value.branches.map(branch => branch.branchId), "reconciliation branch identities");
  for (const branch of compactViolation.value.branches) {
    const complete = violation.branches.find(value => value.branchId === branch.branchId).validation;
    assert.equal(branch.status, complete.status);
    assertDisclosure(branch.changedValueDependencyDisclosure, complete.changedValueDependencyIds, branch.changedValueDependencyIds, "changed value dependency samples");
    assertDisclosure(branch.changedQueryDependencyDisclosure, complete.changedQueryDependencyIds, branch.changedQueryDependencyIds, "changed query dependency samples");
  }
  const fullFindings = violation.governance.branches.flatMap(branch => branch.evaluations.flatMap(evaluation => evaluation.findings));
  for (const status of ["satisfied", "violated", "unknown"]) assert.equal(compactViolation.value.governance.branches.reduce((sum, branch) => sum + branch.findingCounts[status], 0), fullFindings.filter(finding => finding.status === status).length);
  const critical = fullFindings.filter(finding => finding.status === "violated" || finding.status === "unknown");
  const disclosedCritical = compactViolation.value.governance.branches.flatMap(branch => branch.criticalFindings);
  assert.equal(compactViolation.value.governance.branches.reduce((sum, branch) => sum + branch.criticalFindingDisclosure.total, 0), critical.length);
  for (const finding of disclosedCritical) assert(critical.some(original => stable(original) === stable(finding)), "Displayed violations must remain exact evidence.");
  assert(disclosedCritical.some(finding => finding.status === "violated"), "The exercised violation must be visible in the bounded view.");
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

  assert.equal((await run("fresh Git clone carries committed project authority", "git", ["clone", "--quiet", "--no-local", fixture, cloneFixture])).code, 0);
  const tracked = (await exec("git", ["ls-files", "-z", ".projector"], { cwd: cloneFixture })).stdout.split("\0").filter(Boolean);
  assert.equal((await exec("git", ["rev-parse", "HEAD"], { cwd: cloneFixture })).stdout.trim(), (await exec("git", ["rev-parse", "HEAD"], { cwd: fixture })).stdout.trim(), "Clone must retain the exact committed tree.");
  for (const directory of ["model", "lenses", "decisions", "authorities"]) assert(tracked.some(file => file.startsWith(`.projector/${directory}/`)), `Clone must carry ${directory}.`);
  assert(tracked.includes(".projector/config.toml"));
  // Git may convert checkout line endings on Windows. The committed tree above
  // remains exact; canonical JSON must preserve every accepted field and hash.
  for (const relative of tracked.filter(file => file.endsWith(".json"))) assert.deepEqual(JSON.parse(await readFile(path.join(cloneFixture, relative), "utf8")), JSON.parse(await readFile(path.join(fixture, relative), "utf8")), `Clone must preserve accepted canonical content: ${relative}`);
  await assert.rejects(lstat(path.join(cloneFixture, ".projector/state.db")), { code: "ENOENT" });
  await assert.rejects(lstat(path.join(cloneFixture, ".projector/runtime/knowledge")), { code: "ENOENT" });
  const cloneInit = await run("clone rebuilds disposable SQLite from committed meaning", process.execPath, [cli, "init", "--format", "json"], { json: true, cwd: cloneFixture });
  assert.equal(cloneInit.code, 0);
  assert.equal(cloneInit.value.configCreated, false);
  assert(cloneInit.value.rebuild.documentCount > 0);
  assert((await lstat(path.join(cloneFixture, ".projector/state.db"))).isFile());
  const cloned = await context("clone derives fresh context with the same accepted identity", "Check the committed core boundary in a fresh clone", cloneFixture);
  assert.equal(cloned.branches[0].interpretation.entityId, first.branches[0].interpretation.entityId);
  const cloneReuse = await run("clone validates its own retained context", process.execPath, [cli, "reconcile", cloned.id, "--format", "json"], { json: true, cwd: cloneFixture });
  assert.equal(cloneReuse.code, 0);
  assert(["current", "rebound"].includes(cloneReuse.value.status));
  assert.equal(cloneReuse.value.governance.status, "conformant");
  report.clonePortability = { trackedProjectFiles: tracked.length, acceptedIdentity: cloned.branches[0].interpretation.entityId, rebuiltDocuments: cloneInit.value.rebuild.documentCount, priorContextIdsAndExecutionHistoryTransferred: false };
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack ?? String(error);
  process.exitCode = 1;
  console.error(report.error);
} finally {
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  for (const target of [cloneFixture, fixture]) {
    let resolved;
    try { resolved = await realpath(target); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    assert.equal(path.dirname(resolved), temporaryParent);
    assert(path.basename(resolved).startsWith("projector-knowledge-acceptance-"));
    await rm(resolved, { recursive: true, force: true });
  }
}
