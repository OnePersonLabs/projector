import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { access, cp, lstat, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { canonicalJson, hashFramedDomain } from "../packages/core/dist/index.js";

const bubblewrap = "/usr/bin/bwrap";
const canonical = (value) => JSON.stringify(sortValue(value));
const hash = (domain, value) => `sha256:v1:${createHash("sha256").update(`${domain}\0${canonical(value)}`, "utf8").digest("hex")}`;

export function packedLifecycleSeveranceMode(environment = process.env) {
  return environment.GITHUB_ACTIONS === "true" ? "host-mount-namespace" : "bubblewrap";
}

export function packedLifecycleNsenterWorkingDirectoryArguments(repository) {
  return [`--wd=${repository}`];
}

export async function closePackedLifecycleNamespaceKeeper({ namespaceProcessId, keeper, signalProcess }) {
  const signal = async (name) => {
    try { await signalProcess(namespaceProcessId, name); }
    catch (error) { if (error?.code !== "ESRCH") throw error; }
  };
  await signal("SIGTERM");
  if (!(await waitForProcessExit(namespaceProcessId, 2_000))) {
    await signal("SIGKILL");
    if (!(await waitForProcessExit(namespaceProcessId, 2_000))) throw new Error("host source-severance namespace did not terminate");
  }
  if (!(await completesWithin(keeper.completed, 2_000))) {
    try { keeper.child.kill("SIGTERM"); } catch (error) { if (error?.code !== "ESRCH") throw error; }
    if (!(await completesWithin(keeper.completed, 2_000))) throw new Error("host source-severance launcher did not terminate");
  }
}

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

function option(args, name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function authenticateTrace(trace, direct) {
  let previousHash = null;
  for (const entry of trace) {
    const { entryHash, ...body } = entry;
    assert(body.previousHash === previousHash, "has a broken agent trace chain");
    assert(body.invocationHash === hash("projector-agent-cli-invocation", { command: body.command, args: body.args }), "has an invalid agent invocation hash");
    if (body.phase === "completed") {
      assert(body.outputHash === hash("projector-agent-cli-output", { exitCode: body.exitCode, stdout: body.output }), "has an invalid agent output hash");
      assert(body.diagnosticHash === hash("projector-agent-cli-diagnostic", body.diagnostic), "has an invalid agent diagnostic hash");
    } else {
      assert(body.exitCode === null && body.output === null && body.diagnostic === null && body.outputHash === null && body.diagnosticHash === null, "has output on an incomplete agent invocation");
    }
    assert(entryHash === hash("projector-agent-trace-entry", body), "has an invalid agent trace entry hash");
    previousHash = entryHash;
  }
  const sequence = trace.map(({ phase, command }) => `${phase}:${command}`);
  const expected = ["invoked:start", "completed:start", "invoked:approve", "completed:approve", "invoked:approve", "completed:approve", "invoked:apply", "invoked:recover", "completed:recover", "invoked:resume", "completed:resume", "invoked:resume", "completed:resume"];
  assert(canonical(sequence) === canonical(expected), "does not preserve the interrupted invocation and recovery trace");
  const rejectedInvocation = trace[2]; const rejectedCompletion = trace[3]; const acceptedInvocation = trace[4]; const acceptedCompletion = trace[5];
  assert(canonical(rejectedInvocation.args) === canonical(rejectedCompletion.args) && canonical(acceptedInvocation.args) === canonical(acceptedCompletion.args), "has mismatched approval invocation/completion arguments");
  assert(option(rejectedInvocation.args, "--change") === direct.changeSelector && option(acceptedInvocation.args, "--change") === direct.changeSelector, "does not bind approval attempts to the exact change selector");
  assert(option(rejectedInvocation.args, "--plan-hash") !== direct.planHash && option(acceptedInvocation.args, "--plan-hash") === direct.planHash, "does not preserve the substituted and exact plan hashes");
  assert(rejectedCompletion.exitCode !== 0 && /(?:plan hash.*(?:does not match|exact)|exact.*plan hash)/iu.test(rejectedCompletion.diagnostic) && acceptedCompletion.exitCode === 0, "does not authenticate substituted plan-hash rejection and exact approval");
  assert(trace[6]?.exitCode === null && trace[6]?.outputHash === null, "does not leave the killed apply invocation durably open");
}

export function verifyPackedLifecycleEvidence(evidence) {
  assert(evidence?.version === 1, "has an unsupported version");
  assert(typeof evidence.runId === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/iu.test(evidence.runId), "has no authenticated run identity");
  assert(typeof evidence.request === "string" && evidence.request.length > 0 && evidence.request !== "repair-governed-state", "uses a fixture-only request");
  assert(evidence.activation?.initialized === true && evidence.activation?.projectEnabled === true && canonical(evidence.activation?.config) === canonical({ apiVersion: "projector.config/v1", enabled: true }), "did not explicitly activate the held-out repository");
  assert(evidence.sourceBoundary?.sourceAccessDenied === true && evidence.sourceBoundary.installedSymlinkCount === 0 && evidence.sourceBoundary.pluginSourceReferenceCount === 0, "did not sever source access");
  assert(evidence.direct?.changeSelector === evidence.pause?.changeSelector && evidence.direct?.planHash === evidence.pause?.planHash, "does not match direct and agent plan identity");
  assert(evidence.pause?.status === "approval-required" && evidence.approval?.status === "approved" && evidence.approval?.planHash === evidence.direct?.planHash, "did not enforce exact plan-hash approval");
  assert(evidence.interruption?.signal === "SIGKILL" && evidence.interruption?.journalPhase === "validating" && evidence.interruption?.mutationObserved === true, "did not prove a real validating-phase interruption");
  assert(evidence.recovery?.action === "rolled-back" && evidence.recovery?.exactBeforeRestored === true, "did not prove exact rollback");
  assert(evidence.result?.outcome === "success" && evidence.result?.approvalSelector === evidence.approval?.approvalSelector && evidence.result?.planId === evidence.direct?.planId, "does not bind successful result identity");
  let certificateArtifact; let receipt;
  try { certificateArtifact = JSON.parse(evidence.result?.certificateBytes); receipt = JSON.parse(evidence.result?.receiptBytes); } catch { throw new Error("packed lifecycle evidence has malformed completion artifact bytes"); }
  assert(`${canonicalJson(certificateArtifact)}\n` === evidence.result.certificateBytes && `${canonicalJson(receipt)}\n` === evidence.result.receiptBytes, "has noncanonical persisted completion artifact bytes");
  assert(evidence.result.certificateHash === hashFramedDomain("change-certificate-artifact", certificateArtifact) && evidence.result.receiptHash === hashFramedDomain("transaction-receipt-artifact", receipt) && receipt.certificateHash === evidence.result.certificateHash, "has completion hashes that do not match artifact bytes");
  assert(sameStrings(evidence.direct.predictedChangedPaths, evidence.result.predictedChangedPaths) && sameStrings(evidence.result.predictedChangedPaths, evidence.result.observedChangedPaths), "has predicted/observed path impact mismatch");
  assert(evidence.result.unexpectedChangedPaths.length === 0 && evidence.result.unexpectedChangedCanonicalIds.length === 0 && evidence.result.planningSurpriseIds.length === 0 && evidence.result.unknowns.length === 0, "has unexplained impact or planning surprise");
  const oracle = evidence.independentOracle; assert(oracle?.beforeExitCode !== 0 && oracle?.afterExitCode === 0 && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(oracle?.gitObjectId ?? "") && oracle?.expectedContentHash === oracle?.beforeContentHash && oracle?.beforeContentHash === oracle?.afterContentHash && oracle?.afterContentHash === oracle?.executedContentHash && oracle?.executionSource === "immutable-captured-overlay", "lacks an independent Git-base desired-behavior oracle");
  const rerun = evidence.fixedPointRerun; assert(rerun?.firstCertificateHash === evidence.result.certificateHash && rerun?.secondCertificateHash === rerun?.firstCertificateHash && rerun?.firstReceiptHash === evidence.result.receiptHash && rerun?.secondReceiptHash === rerun?.firstReceiptHash && rerun?.afterSourceHash === rerun?.rerunSourceHash, "lacks an actual fixed-point rerun");
  assert(evidence.fixtureMarkerAbsent === true, "used the mandatory fixture fallback");
  authenticateTrace(evidence.trace, evidence.direct);
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
  const killed = [];
  for (const processId of postorder) {
    try { process.kill(processId, "SIGKILL"); killed.push(processId); }
    catch (error) { if (error?.code !== "ESRCH" && error?.code !== "EPERM") throw error; }
  }
  return killed;
}

async function pathAbsent(path) {
  try { await access(path); return false; } catch (error) { if (error?.code === "ENOENT") return true; throw error; }
}

async function waitForProcessExit(processId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await pathAbsent(`/proc/${String(processId)}`)) return true;
    await delay(25);
  }
  return pathAbsent(`/proc/${String(processId)}`);
}

function completesWithin(completed, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    timer.unref();
    completed.then(() => { clearTimeout(timer); resolve(true); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

async function signalPrivilegedProcess(processId, signal) {
  const result = await run("sudo", ["-n", "kill", `-${signal}`, String(processId)], { env: process.env });
  if (result.exitCode !== 0 && !/No such process/iu.test(result.stderr)) {
    throw new Error(`host source-severance namespace ${signal} failed: ${result.stderr || result.stdout || String(result.exitCode)}`);
  }
}

async function waitForTextFile(path, label) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try { return (await readFile(path, "utf8")).trim(); }
    catch (error) { if (error?.code !== "ENOENT") throw error; }
    await delay(25);
  }
  throw new Error(`${label} did not become ready`);
}

async function createHostMountNamespaceSeverance(input, sandbox) {
  const root = join(input.temporaryRoot, "host-severance");
  const emptySource = join(root, "empty-source");
  const pidFile = join(root, "namespace.pid");
  await mkdir(emptySource, { recursive: true });
  const script = [
    "mount --make-rprivate /",
    "mount --bind \"$1\" \"$2\"",
    "ip link set lo up",
    "printf '%s\\n' \"$$\" > \"$3\"",
    "exec sleep infinity",
  ].join("\n");
  const keeper = launch("sudo", ["-n", "unshare", "--mount", "--net", "--fork", "--kill-child", "--propagation", "private", "bash", "-ceu", script, "projector-severance", emptySource, input.repositoryRoot, pidFile], { cwd: input.temporaryRoot, env: process.env });
  const namespaceProcessId = await Promise.race([
    waitForTextFile(pidFile, "host source-severance namespace"),
    keeper.completed.then((result) => { throw new Error(`host source-severance namespace exited early: ${result.stderr || result.stdout || String(result.exitCode)}`); }),
  ]);
  if (!/^\d+$/u.test(namespaceProcessId)) throw new Error("host source-severance namespace returned an invalid process ID");
  const environment = {
    HOME: sandbox.repository,
    NODE_PATH: "",
    PATH: `${dirname(process.execPath)}:/usr/bin`,
    PROJECTOR_CLI: sandbox.installedCli,
    PROJECTOR_FIXTURE_EXECUTION_MARKER: sandbox.fixtureMarker,
  };
  return {
    launch(executable, args, options = {}) {
      const command = [
        "-n", "nsenter", "--target", namespaceProcessId, "--mount", "--net",
        `--setgid=${String(process.getgid())}`, `--setuid=${String(process.getuid())}`,
        ...packedLifecycleNsenterWorkingDirectoryArguments(sandbox.repository), "--", "/usr/bin/env", "-i",
        ...Object.entries(environment).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`),
        executable, ...args,
      ];
      return launch("sudo", command, { cwd: sandbox.repository, env: process.env, detached: options.detached });
    },
    async close() {
      await closePackedLifecycleNamespaceKeeper({ namespaceProcessId, keeper, signalProcess: signalPrivilegedProcess });
    },
  };
}

export async function runPackedLifecycleAcceptance(input) {
  const runId = randomUUID();
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
    "assert.equal(formatLabel('  beta  '), 'beta');",
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
  const oracleValidatorPath = join(repository, "test", "public-api.test.mjs");
  const beforeOracle = await run(process.execPath, [oracleValidatorPath], { cwd: repository, env: {} });
  assert(beforeOracle.exitCode !== 0, "desired-behavior oracle did not fail before the change");
  const gitObjectId = requireExit(await run("git", ["rev-parse", "HEAD:test/public-api.test.mjs"], { cwd: repository, env: process.env }), "Git-base validator object identity").stdout;
  await mkdir(join(repository, ".projector", "runtime"), { recursive: true });
  await writeFile(join(repository, ".projector", "runtime", "interruption-hold"), "hold\n", "utf8");

  const sandbox = { temporaryRoot: input.temporaryRoot, consumerRoot: input.consumerRoot, pluginRoot, repository, installedCli, fixtureMarker };
  const isolation = packedLifecycleSeveranceMode() === "host-mount-namespace"
    ? await createHostMountNamespaceSeverance(input, sandbox)
    : { launch: (executable, args, options = {}) => launch(bubblewrap, sandboxArguments(sandbox, executable, args), { cwd: repository, detached: options.detached }), close: async () => {} };
  const severed = isolation.launch;
  const direct = async (args) => (await severed(process.execPath, [installedCli, ...args]).completed);
  const trace = [];
  const recordInvocation = (phase, command, args, result) => {
    const previousHash = trace.at(-1)?.entryHash ?? null;
    const body = { version: 1, phase, command, args, exitCode: result?.exitCode ?? null, invocationHash: hash("projector-agent-cli-invocation", { command, args }), output: result?.stdout ?? null, diagnostic: result?.stderr ?? null, outputHash: result === undefined ? null : hash("projector-agent-cli-output", { exitCode: result.exitCode, stdout: result.stdout }), diagnosticHash: result === undefined ? null : hash("projector-agent-cli-diagnostic", result.stderr), previousHash, recordedAt: new Date().toISOString() };
    trace.push({ ...body, entryHash: hash("projector-agent-trace-entry", body) });
  };
  const launchAgent = (args, options = {}) => {
    const [command, ...commandArgs] = args; recordInvocation("invoked", command, commandArgs);
    const launched = severed(process.execPath, [wrapper, ...args], { detached: options.detached });
    const completed = launched.completed.then((result) => { if (options.recordCompletion !== false) recordInvocation("completed", command, commandArgs, result); return result; });
    return { ...launched, completed };
  };
  const agent = async (args) => launchAgent(args).completed;
  try {
  const sourceProbeCode = "import { access } from 'node:fs/promises'; try { await access(process.argv[1]); process.exitCode=9; } catch (error) { if (error?.code !== 'ENOENT') throw error; process.stdout.write(JSON.stringify({sourceAccessDenied:true})+'\\n'); }";
  const installedVersion = requireExit(await direct(["--version"]), "source-severed installed CLI version").stdout;
  assert(installedVersion === "2.0.0", "did not execute the installed CLI");
  const denied = json(await severed(process.execPath, ["--input-type=module", "--eval", sourceProbeCode, join(input.repositoryRoot, "package.json")]).completed, "source access negative probe");
  const initialized = json(await direct(["init", "--format", "json"]), "explicit held-out repository activation");
  const activationConfig = JSON.parse(await readFile(join(repository, ".projector", "config.json"), "utf8"));

  const directChange = json(await direct(["change", request, "--proposal", proposalPath, "--format", "json"]), "direct held-out change");
  const directPlan = json(await direct(["plan", directChange.selector, "--format", "json"]), "direct held-out plan");
  const pause = json(await agent(["start", "--request", request, "--proposal", proposalPath]), "agent held-out start", [3]);
  const substitutedPlanHash = `${pause.immutablePlanHash.slice(0, -1)}${pause.immutablePlanHash.endsWith("0") ? "1" : "0"}`;
  const substituted = await agent(["approve", "--change", pause.selector, "--plan-hash", substitutedPlanHash]);
  assert(substituted.exitCode !== 0 && /(?:plan hash.*(?:does not match|exact)|exact.*plan hash)/iu.test(substituted.stderr), "accepted a substituted plan hash");
  const approval = json(await agent(["approve", "--change", pause.selector, "--plan-hash", pause.immutablePlanHash]), "agent held-out approval");

  const applying = launchAgent(["apply", "--approval", approval.selector], { detached: true, recordCompletion: false });
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

  const recovered = json(await agent(["recover", "--approval", approval.selector]), "agent held-out recovery");
  const recovery = recovered.outcomes.find(({ transactionId }) => transactionId === validating.transactionId);
  const recoveredSource = await readFile(join(repository, "src", "format-label.mjs"), "utf8");
  const supplementalAbsent = await pathAbsent(join(repository, "test", "trim-label.test.mjs"));
  const exactBeforeRestored = recoveredSource === beforeSource && supplementalAbsent;
  if (recovery?.action !== "rolled-back" || !exactBeforeRestored) throw new Error(`packed rollback mismatch: ${canonical({ validating, recovered, recovery, recoveredSource, supplementalAbsent })}`);
  const result = json(await agent(["resume", "--approval", approval.selector]), "agent held-out resume");
  const fixed = json(await agent(["resume", "--approval", approval.selector]), "agent held-out fixed-point resume");
  const afterOracle = await severed(process.execPath, [oracleValidatorPath]).completed;
  const observation = result.validations.find(({ validatorId }) => validatorId === "projector.repository-post-observation")?.details?.observation;
  const independent = result.validations.find(({ validatorId }) => validatorId === "node-independent:test/public-api.test.mjs");
  const certificateBytes = await readFile(join(repository, result.certificateRef), "utf8"); const receiptBytes = await readFile(join(repository, result.receiptRef), "utf8");
  const rerunSource = await readFile(join(repository, "src", "format-label.mjs"), "utf8");
  const evidence = {
    version: 1,
    runId,
    request,
    activation: { initialized: initialized.initialized === true, projectEnabled: initialized.projectEnabled === true, config: activationConfig },
    sourceBoundary: { sourceAccessDenied: denied.sourceAccessDenied === true, installedSymlinkCount: await countSymlinks(input.installedProjector), pluginSourceReferenceCount: await countSourceReferences(pluginRoot, input.repositoryRoot) },
    direct: { changeSelector: directChange.selector, planHash: directPlan.immutablePlanHash, planId: directPlan.plan.id, predictedChangedPaths: expectedPaths, preview: directPlan.preview },
    pause: { status: pause.outcome, changeSelector: pause.selector, planHash: pause.immutablePlanHash },
    approval: { status: approval.kind === "lifecycle-approval" ? "approved" : "invalid", approvalSelector: approval.selector, planHash: approval.immutablePlanHash },
    interruption: { signal: killedProcessIds.length > 0 && interrupted.exitCode !== 0 ? "SIGKILL" : interrupted.signal, journalPhase: validating.phase, mutationObserved, killedProcessCount: killedProcessIds.length },
    recovery: { action: recovery?.action, exactBeforeRestored },
    result: {
      outcome: result.outcome,
      approvalSelector: result.selector,
      planId: result.certificate?.planId,
      certificateHash: result.certificateHash,
      receiptHash: result.receiptHash,
      certificateBytes,
      receiptBytes,
      predictedChangedPaths: observation?.predictedChangedPaths ?? [],
      observedChangedPaths: observation?.observedChangedPaths ?? [],
      unexpectedChangedPaths: observation?.unexpectedChangedPaths ?? [],
      unexpectedChangedCanonicalIds: observation?.unexpectedChangedCanonicalIds ?? [],
      planningSurpriseIds: observation?.planningSurpriseIds ?? [],
      unknowns: observation?.unknowns ?? [],
      independentExecutionSource: independent?.details?.executionSource,
      fixedPoint: fixed.certificateHash === result.certificateHash && fixed.receiptHash === result.receiptHash && await readFile(join(repository, "src", "format-label.mjs"), "utf8") === afterSource,
    },
    independentOracle: { beforeExitCode: beforeOracle.exitCode, afterExitCode: afterOracle.exitCode, gitObjectId, expectedContentHash: independent?.details?.expectedContentHash, beforeContentHash: independent?.details?.beforeContentHash, afterContentHash: independent?.details?.afterContentHash, executedContentHash: independent?.details?.executedContentHash, executionSource: independent?.details?.executionSource },
    fixedPointRerun: { firstCertificateHash: result.certificateHash, secondCertificateHash: fixed.certificateHash, firstReceiptHash: result.receiptHash, secondReceiptHash: fixed.receiptHash, afterSourceHash: hash("packed-lifecycle-source-bytes", afterSource), rerunSourceHash: hash("packed-lifecycle-source-bytes", rerunSource) },
    trace,
    fixtureMarkerAbsent: await pathAbsent(fixtureMarker),
  };
  const evidenceHash = verifyPackedLifecycleEvidence(evidence);
  return { runId, evidence, evidenceHash, transcriptHash: hash("packed-held-out-lifecycle-transcript", { runId, directChange, directPlan, pause, approval, interrupted, recovered, result, fixed, trace }) };
  } finally {
    await isolation.close();
  }
}
