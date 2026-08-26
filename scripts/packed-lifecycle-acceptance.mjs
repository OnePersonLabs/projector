import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { access, cp, lstat, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const bubblewrap = "/usr/bin/bwrap";
const canonical = (value) => JSON.stringify(sortValue(value));
const hash = (domain, value) => `sha256:v1:${createHash("sha256").update(`${domain}\0${canonical(value)}`, "utf8").digest("hex")}`;

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortValue(item)]));
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(`packed lifecycle evidence ${message}`);
}

function sameStrings(left, right) {
  return canonical([...left].sort()) === canonical([...right].sort());
}

function authenticateTrace(trace) {
  let previousHash = null;
  for (const entry of trace) {
    const { entryHash, ...body } = entry;
    assert(body.previousHash === previousHash, "has a broken agent trace chain");
    assert(body.invocationHash === hash("projector-agent-cli-invocation", { command: body.command, args: body.args }), "has an invalid agent invocation hash");
    assert(entryHash === hash("projector-agent-trace-entry", body), "has an invalid agent trace entry hash");
    previousHash = entryHash;
  }
  const sequence = trace.map(({ phase, command }) => `${phase}:${command}`);
  const expected = ["invoked:change", "completed:change", "invoked:plan", "completed:plan", "invoked:approve", "completed:approve", "invoked:apply", "invoked:recover", "completed:recover", "invoked:resume", "completed:resume", "invoked:resume", "completed:resume"];
  assert(canonical(sequence) === canonical(expected), "does not preserve the interrupted invocation and recovery trace");
  assert(trace[6]?.exitCode === null && trace[6]?.outputHash === null, "does not leave the killed apply invocation durably open");
}

export function verifyPackedLifecycleEvidence(evidence) {
  assert(evidence?.version === 1, "has an unsupported version");
  assert(typeof evidence.request === "string" && evidence.request.length > 0 && evidence.request !== "repair-governed-state", "uses a fixture-only request");
  assert(evidence.sourceBoundary?.sourceAccessDenied === true && evidence.sourceBoundary.installedSymlinkCount === 0 && evidence.sourceBoundary.pluginSourceReferenceCount === 0, "did not sever source access");
  assert(evidence.direct?.changeSelector === evidence.pause?.changeSelector && evidence.direct?.planHash === evidence.pause?.planHash, "does not match direct and agent plan identity");
  assert(evidence.pause?.status === "approval-required" && evidence.approval?.status === "approved" && evidence.approval?.substitutedHashRejected === true && evidence.approval?.planHash === evidence.direct?.planHash, "did not enforce exact plan-hash approval");
  assert(evidence.interruption?.signal === "SIGKILL" && evidence.interruption?.journalPhase === "validating" && evidence.interruption?.mutationObserved === true, "did not prove a real validating-phase interruption");
  assert(evidence.recovery?.action === "rolled-back" && evidence.recovery?.exactBeforeRestored === true, "did not prove exact rollback");
  assert(evidence.result?.outcome === "success" && evidence.result?.approvalSelector === evidence.approval?.approvalSelector && evidence.result?.planId === evidence.direct?.planId, "does not bind successful result identity");
  assert(/^sha256:v1:[a-f0-9]{64}$/u.test(evidence.result?.certificateHash ?? "") && /^sha256:v1:[a-f0-9]{64}$/u.test(evidence.result?.receiptHash ?? ""), "has unauthenticated completion artifacts");
  assert(sameStrings(evidence.direct.predictedChangedPaths, evidence.result.predictedChangedPaths) && sameStrings(evidence.result.predictedChangedPaths, evidence.result.observedChangedPaths), "has predicted/observed path impact mismatch");
  assert(evidence.result.unexpectedChangedPaths.length === 0 && evidence.result.unexpectedChangedCanonicalIds.length === 0 && evidence.result.planningSurpriseIds.length === 0 && evidence.result.unknowns.length === 0, "has unexplained impact or planning surprise");
  assert(evidence.result.independentExecutionSource === "immutable-captured-overlay" && evidence.result.fixedPoint === true, "lacks independent immutable validation or fixed-point replay");
  assert(evidence.fixtureMarkerAbsent === true, "used the mandatory fixture fallback");
  authenticateTrace(evidence.trace);
  return hash("packed-held-out-lifecycle-evidence", evidence);
}

function sandboxArguments({ temporaryRoot, consumerRoot, pluginRoot, repository, installedCli, fixtureMarker }, executable, args) {
  const environment = {
    HOME: repository,
    NODE_PATH: "",
    PATH: `${dirname(process.execPath)}:/usr/bin`,
    PROJECTOR_CLI: installedCli,
    PROJECTOR_FIXTURE_EXECUTION_MARKER: fixtureMarker,
  };
  return [
    "--die-with-parent", "--new-session", "--unshare-net", "--clearenv", "--dev", "/dev", "--proc", "/proc",
    "--ro-bind", "/usr", "/usr", "--ro-bind", "/lib", "/lib", "--ro-bind", "/lib64", "/lib64",
    "--ro-bind", dirname(process.execPath), dirname(process.execPath),
    "--dir", "/tmp", "--dir", temporaryRoot,
    "--dir", consumerRoot, "--ro-bind", consumerRoot, consumerRoot,
    "--dir", pluginRoot, "--ro-bind", pluginRoot, pluginRoot,
    "--dir", repository, "--bind", repository, repository,
    "--chdir", repository,
    ...Object.entries(environment).sort(([left], [right]) => left.localeCompare(right)).flatMap(([key, value]) => ["--setenv", key, value]),
    executable, ...args,
  ];
}

function launch(file, args, options = {}) {
  const child = spawn(file, args, { cwd: options.cwd, env: options.env ?? {}, detached: options.detached ?? false, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = ""; let stderr = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.on("data", (chunk) => { stderr += chunk; });
  const completed = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ exitCode: code, signal, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
  return { child, completed };
}

async function run(file, args, options = {}) {
  return launch(file, args, options).completed;
}

function requireExit(result, label, allowed = [0]) {
  if (!allowed.includes(result.exitCode)) throw new Error(`${label} exited ${String(result.exitCode)} (${result.signal ?? "no signal"}): ${result.stderr || result.stdout || "no diagnostic"}`);
  return result;
}

function json(result, label, allowed = [0]) {
  requireExit(result, label, allowed);
  try { return JSON.parse(result.stdout); } catch { throw new Error(`${label} returned non-JSON output: ${result.stdout}`); }
}

async function initializeGit(repository) {
  requireExit(await run("git", ["init", "-q"], { cwd: repository, env: process.env }), "held-out git init");
  requireExit(await run("git", ["add", "."], { cwd: repository, env: process.env }), "held-out git add");
  requireExit(await run("git", ["-c", "user.name=Packed Acceptance", "-c", "user.email=packed@projector.invalid", "commit", "-qm", "held-out baseline"], { cwd: repository, env: process.env }), "held-out git commit");
}

async function countSymlinks(root) {
  let count = 0;
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name); const metadata = await lstat(path);
      if (metadata.isSymbolicLink()) count += 1;
      else if (metadata.isDirectory()) await visit(path);
    }
  };
  await visit(root);
  return count;
}

async function countSourceReferences(root, sourceRoot) {
  let count = 0;
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) { const content = await readFile(path, "utf8"); count += content.split(sourceRoot).length - 1; }
    }
  };
  await visit(root);
  return count;
}

async function waitForJournalPhase(repository, phase) {
  const root = join(repository, ".projector", "runtime", "journal");
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    let names = [];
    try { names = await readdir(root); } catch { /* lifecycle has not begun */ }
    for (const name of names.filter((candidate) => candidate.endsWith(".json"))) {
      try {
        const record = JSON.parse(await readFile(join(root, name), "utf8"));
        if (record.entry?.phase === phase) return record.entry;
      } catch { /* atomic replacement can briefly race directory observation */ }
    }
    await delay(25);
  }
  throw new Error(`packed lifecycle did not reach journal phase ${phase}`);
}

async function waitForStaleLease(repository) {
  const root = join(repository, ".projector", "runtime", "writer-lease.lock");
  const owner = JSON.parse(await readFile(join(root, "owner.json"), "utf8"));
  const heartbeat = await stat(join(root, "heartbeat"));
  await delay(Math.max(0, heartbeat.mtimeMs + owner.staleAfterMs + 500 - Date.now()));
}

async function killProcessTree(rootProcessId) {
  const seen = new Set(); const postorder = [];
  const visit = async (processId) => {
    if (seen.has(processId)) return;
    seen.add(processId);
    let children = "";
    try { children = await readFile(`/proc/${String(processId)}/task/${String(processId)}/children`, "utf8"); }
    catch (error) { if (error?.code !== "ENOENT") throw error; }
    for (const child of children.trim().split(/\s+/u).filter(Boolean).map(Number)) await visit(child);
    postorder.push(processId);
  };
  await visit(rootProcessId);
  for (const processId of postorder) {
    try { process.kill(processId, "SIGKILL"); }
    catch (error) { if (error?.code !== "ESRCH") throw error; }
  }
  return postorder;
}

async function pathAbsent(path) {
  try { await access(path); return false; } catch (error) { if (error?.code === "ENOENT") return true; throw error; }
}

export async function runPackedLifecycleAcceptance(input) {
  const pluginRoot = join(input.temporaryRoot, "held-out-plugin");
  const repository = join(input.temporaryRoot, "held-out-repository");
  const fixtureMarker = join(repository, "mandatory-fixture-executed.marker");
  const installedCli = join(input.installedProjector, "bin", "projector.js");
  const wrapper = join(pluginRoot, "scripts", "projector-change.mjs");
  await cp(input.pluginSource, pluginRoot, { recursive: true });
  await mkdir(join(repository, "src"), { recursive: true });
  await mkdir(join(repository, "test"), { recursive: true });
  await writeFile(join(repository, ".gitignore"), ".projector/runtime/\n", "utf8");
  await writeFile(join(repository, "package.json"), "{\"type\":\"module\"}\n", "utf8");
  const beforeSource = "export const formatLabel = (value) => String(value);\n";
  const afterSource = "export const formatLabel = (value) => typeof value === 'string' ? value.trim() : String(value);\n";
  const supplemental = "import assert from 'node:assert/strict'; import { formatLabel } from '../src/index.mjs'; assert.equal(formatLabel('  beta  '), 'beta');\n";
  await writeFile(join(repository, "src", "format-label.mjs"), beforeSource, "utf8");
  await writeFile(join(repository, "src", "index.mjs"), "export { formatLabel } from './format-label.mjs';\n", "utf8");
  await writeFile(join(repository, "test", "public-api.test.mjs"), [
    "import assert from 'node:assert/strict';",
    "import { existsSync } from 'node:fs';",
    "import { setTimeout as delay } from 'node:timers/promises';",
    "import { formatLabel } from '../src/index.mjs';",
    "if (existsSync('.projector/runtime/interruption-hold')) await delay(120_000);",
    "assert.equal(formatLabel('alpha'), 'alpha');",
    "",
  ].join("\n"), "utf8");
  const request = "Trim surrounding label whitespace while preserving existing callers.";
  const proposalPath = "change-proposal.json";
  const expectedPaths = ["src/format-label.mjs", "test/trim-label.test.mjs"];
  const proposal = {
    apiVersion: "projector.change-proposal/v1",
    requirements: [{ key: "trimmed-project-label", title: "Trimmed project label", statement: "A string project label excludes surrounding whitespace.", aliases: [] }],
    scenarios: [{ key: "format-spaced-label", title: "Format a spaced label", aliases: [], steps: [
      { role: "precondition", statement: "A caller supplies a label with surrounding whitespace." },
      { role: "trigger", statement: "The caller formats the label." },
      { role: "expected-outcome", statement: "The result contains the label without surrounding whitespace." },
    ] }],
    architecture: null,
    edits: [{ path: "src/format-label.mjs", before: beforeSource, after: afterSource }, { path: "test/trim-label.test.mjs", before: null, after: supplemental }],
    validation: { independentNodeTests: ["test/public-api.test.mjs"], supplementalNodeTests: ["test/trim-label.test.mjs"] },
    analysisFacets: ["architecture", "behavior"],
  };
  await writeFile(join(repository, proposalPath), `${JSON.stringify(proposal, null, 2)}\n`, "utf8");
  await initializeGit(repository);
  await mkdir(join(repository, ".projector", "runtime"), { recursive: true });
  await writeFile(join(repository, ".projector", "runtime", "interruption-hold"), "hold\n", "utf8");

  const sandbox = { temporaryRoot: input.temporaryRoot, consumerRoot: input.consumerRoot, pluginRoot, repository, installedCli, fixtureMarker };
  const severed = (executable, args, options = {}) => launch(bubblewrap, sandboxArguments(sandbox, executable, args), { cwd: repository, detached: options.detached });
  const direct = async (args) => (await severed(process.execPath, [installedCli, ...args]).completed);
  const agent = async (args) => (await severed(process.execPath, [wrapper, ...args]).completed);
  const sourceProbeCode = "import { access } from 'node:fs/promises'; try { await access(process.argv[1]); process.exitCode=9; } catch (error) { if (error?.code !== 'ENOENT') throw error; process.stdout.write(JSON.stringify({sourceAccessDenied:true})+'\\n'); }";
  const installedVersion = requireExit(await direct(["--version"]), "source-severed installed CLI version").stdout;
  assert(installedVersion === "2.0.0", "did not execute the installed CLI");
  const denied = json(await severed(process.execPath, ["--input-type=module", "--eval", sourceProbeCode, input.repositoryRoot]).completed, "source access negative probe");

  const directChange = json(await direct(["change", request, "--proposal", proposalPath, "--format", "json"]), "direct held-out change");
  const directPlan = json(await direct(["plan", directChange.selector, "--format", "json"]), "direct held-out plan");
  const pause = json(await agent(["start", "--request", request, "--proposal", proposalPath]), "agent held-out start");
  const substituted = await agent(["approve", "--continuation", pause.continuation, "--plan-hash", `${pause.planHash.slice(0, -1)}0`]);
  assert(substituted.exitCode !== 0 && /exact plan hash/iu.test(substituted.stderr), "accepted a substituted plan hash");
  const approval = json(await agent(["approve", "--continuation", pause.continuation, "--plan-hash", pause.planHash]), "agent held-out approval");

  const applying = severed(process.execPath, [wrapper, "apply", "--approval", approval.approvalSelector], { detached: true });
  const progress = await Promise.race([
    waitForJournalPhase(repository, "validating").then((entry) => ({ kind: "validating", entry })),
    applying.completed.then((result) => ({ kind: "exited", result })),
  ]);
  if (progress.kind === "exited") throw new Error(`packed apply exited before validation: ${progress.result.stderr || progress.result.stdout || "no diagnostic"}`);
  const validating = progress.entry;
  const mutationObserved = await readFile(join(repository, "src", "format-label.mjs"), "utf8") === afterSource && !(await pathAbsent(join(repository, "test", "trim-label.test.mjs")));
  const killedProcessIds = await killProcessTree(applying.child.pid);
  const interrupted = await applying.completed;
  await rm(join(repository, ".projector", "runtime", "interruption-hold"), { force: true });
  await waitForStaleLease(repository);

  const recovered = json(await agent(["recover", "--approval", approval.approvalSelector]), "agent held-out recovery");
  const recovery = recovered.outcomes.find(({ transactionId }) => transactionId === validating.transactionId);
  const recoveredSource = await readFile(join(repository, "src", "format-label.mjs"), "utf8");
  const supplementalAbsent = await pathAbsent(join(repository, "test", "trim-label.test.mjs"));
  const exactBeforeRestored = recoveredSource === beforeSource && supplementalAbsent;
  if (recovery?.action !== "rolled-back" || !exactBeforeRestored) throw new Error(`packed rollback mismatch: ${canonical({ validating, recovered, recovery, recoveredSource, supplementalAbsent })}`);
  const result = json(await agent(["resume", "--approval", approval.approvalSelector]), "agent held-out resume");
  const fixed = json(await agent(["resume", "--approval", approval.approvalSelector]), "agent held-out fixed-point resume");
  const observation = result.validations.find(({ validatorId }) => validatorId === "projector.repository-post-observation")?.details?.observation;
  const independent = result.validations.find(({ validatorId }) => validatorId === "node-independent:test/public-api.test.mjs");
  const trace = (await readFile(join(repository, ".projector", "runtime", "change-lifecycles", "agent-trace.jsonl"), "utf8")).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const evidence = {
    version: 1,
    request,
    sourceBoundary: { sourceAccessDenied: denied.sourceAccessDenied === true, installedSymlinkCount: await countSymlinks(input.installedProjector), pluginSourceReferenceCount: await countSourceReferences(pluginRoot, input.repositoryRoot) },
    direct: { changeSelector: directChange.selector, planHash: directPlan.immutablePlanHash, planId: directPlan.plan.id, predictedChangedPaths: expectedPaths, preview: directPlan.preview },
    pause,
    approval: { ...approval, substitutedHashRejected: substituted.exitCode !== 0 },
    interruption: { signal: interrupted.signal, journalPhase: validating.phase, mutationObserved, killedProcessCount: killedProcessIds.length },
    recovery: { action: recovery?.action, exactBeforeRestored },
    result: {
      outcome: result.outcome,
      approvalSelector: result.approvalSelector,
      planId: result.certificate?.planId,
      certificateHash: result.certificateHash,
      receiptHash: result.receiptHash,
      predictedChangedPaths: observation?.predictedChangedPaths ?? [],
      observedChangedPaths: observation?.observedChangedPaths ?? [],
      unexpectedChangedPaths: observation?.unexpectedChangedPaths ?? [],
      unexpectedChangedCanonicalIds: observation?.unexpectedChangedCanonicalIds ?? [],
      planningSurpriseIds: observation?.planningSurpriseIds ?? [],
      unknowns: observation?.unknowns ?? [],
      independentExecutionSource: independent?.details?.executionSource,
      fixedPoint: fixed.certificateHash === result.certificateHash && fixed.receiptHash === result.receiptHash && await readFile(join(repository, "src", "format-label.mjs"), "utf8") === afterSource,
    },
    trace,
    fixtureMarkerAbsent: await pathAbsent(fixtureMarker),
  };
  const evidenceHash = verifyPackedLifecycleEvidence(evidence);
  return { evidence, evidenceHash, transcriptHash: hash("packed-held-out-lifecycle-transcript", { directChange, directPlan, pause, approval, interrupted, recovered, result, fixed, trace }) };
}
