import { createHash, randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { access, cp, lstat, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { canonicalJson as candidateJson, hashBytes, hashCanonical, inventoryCandidateFiles, validateReleaseCandidate } from "./release-candidate.mjs";
import { resolveNpmCommand } from "./npm-command.mjs";

const execute = promisify(execFile);
const maximumOutputBytes = 1_048_576;
const maximumExecutionMs = 60_000;
const canonical = canonicalJson;
const hash = (domain, value) => `sha256:v1:${createHash("sha256").update(`${domain}\0${canonical(value)}`, "utf8").digest("hex")}`;

function serializeCanonical(value, seen, inArray) {
  if (value === undefined) {
    if (inArray) throw new TypeError("undefined array elements are not JSON values");
    return undefined;
  }
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("canonical JSON numbers must be finite");
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value !== "object") throw new TypeError(`${typeof value} is not a JSON value`);
  if (seen.has(value)) throw new TypeError("cyclic values are not JSON values");
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) if (!Object.hasOwn(value, index)) throw new TypeError(`sparse array hole at index ${index} is not a JSON value`);
      return `[${value.map((item) => serializeCanonical(item, seen, true)).join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError("only plain objects are JSON values");
    const entries = [];
    for (const key of Object.keys(value).sort()) {
      const item = serializeCanonical(value[key], seen, false);
      if (item !== undefined) entries.push(`${JSON.stringify(key)}:${item}`);
    }
    return `{${entries.join(",")}}`;
  } finally {
    seen.delete(value);
  }
}

function canonicalJson(value) {
  const result = serializeCanonical(value, new Set(), false);
  if (result === undefined) throw new TypeError("top-level undefined is not a JSON value");
  return result;
}

function frame(value) {
  const length = Buffer.allocUnsafe(8);
  length.writeBigUInt64BE(BigInt(value.byteLength));
  return Buffer.concat([length, value]);
}

function hashFramedDomain(domain, ...values) {
  const framed = createHash("sha256");
  framed.update(frame(Buffer.from("projector\0sha256\0v1", "utf8")));
  framed.update(frame(Buffer.from(domain, "utf8")));
  for (const value of values) framed.update(frame(Buffer.from(canonicalJson(value), "utf8")));
  return `sha256:v1:${framed.digest("hex")}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(`packed lifecycle evidence ${message}`);
}

function sameStrings(left, right) {
  return canonical([...left].sort()) === canonical([...right].sort());
}

function authenticateTrace(trace, plan) {
  let previousHash = null;
  for (const entry of trace) {
    const { entryHash, ...body } = entry;
    assert(body.previousHash === previousHash, "has a broken agent trace chain");
    assert(body.invocationHash === hash("projector-agent-operation-invocation", { operation: body.operation, input: body.input }), "has an invalid agent invocation hash");
    if (body.phase === "completed") {
      assert(body.outputHash === hash("projector-agent-operation-output", { exitCode: body.exitCode, stdout: body.output }), "has an invalid agent output hash");
      assert(body.diagnosticHash === hash("projector-agent-operation-diagnostic", body.diagnostic), "has an invalid agent diagnostic hash");
    } else {
      assert(body.exitCode === null && body.output === null && body.diagnostic === null && body.outputHash === null && body.diagnosticHash === null, "has output on an incomplete agent invocation");
    }
    assert(entryHash === hash("projector-agent-trace-entry", body), "has an invalid agent trace entry hash");
    previousHash = entryHash;
  }
  const sequence = trace.map(({ phase, operation }) => `${phase}:${operation}`);
  const expected = ["invoked:change.capture", "completed:change.capture", "invoked:change.plan", "completed:change.plan", "invoked:change.approve", "completed:change.approve", "invoked:change.approve", "completed:change.approve", "invoked:change.apply", "invoked:change.recover", "completed:change.recover", "invoked:change.resume", "completed:change.resume", "invoked:change.resume", "completed:change.resume"];
  assert(canonical(sequence) === canonical(expected), "does not preserve the interrupted invocation and recovery trace");
  const rejectedInvocation = trace[4]; const rejectedCompletion = trace[5]; const acceptedInvocation = trace[6]; const acceptedCompletion = trace[7];
  assert(canonical(rejectedInvocation.input) === canonical(rejectedCompletion.input) && canonical(acceptedInvocation.input) === canonical(acceptedCompletion.input), "has mismatched approval invocation/completion inputs");
  const rejectedInput = rejectedInvocation.input; const acceptedInput = acceptedInvocation.input;
  const rejectedResult = JSON.parse(rejectedCompletion.output);
  assert(rejectedInput.changeSelector === plan.changeSelector && acceptedInput.changeSelector === plan.changeSelector, "does not bind approval attempts to the exact change selector");
  assert(rejectedInput.planHash !== plan.planHash && acceptedInput.planHash === plan.planHash, "does not preserve the substituted and exact plan hashes");
  assert(rejectedCompletion.exitCode !== 0 && /(?:plan hash.*(?:does not match|exact)|exact.*plan hash)/iu.test(rejectedResult.error?.message ?? "") && acceptedCompletion.exitCode === 0, "does not authenticate substituted plan-hash rejection and exact approval");
  assert(trace[8]?.exitCode === null && trace[8]?.outputHash === null, "does not leave the killed apply invocation durably open");
}

export function verifyPackedLifecycleEvidence(evidence) {
  assert(evidence?.version === 1, "has an unsupported version");
  assert(typeof evidence.runId === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/iu.test(evidence.runId), "has no authenticated run identity");
  assert(typeof evidence.request === "string" && evidence.request.length > 0 && evidence.request !== "repair-governed-state", "uses a fixture-only request");
  assert(evidence.activation?.initialized === true && evidence.activation?.projectEnabled === true && evidence.activation?.config?.apiVersion === "projector.config/v1" && evidence.activation?.config?.enabled === true && evidence.activation?.config?.projectorVersion === "2.1.0", "did not explicitly activate the held-out repository");
  const boundary = evidence.artifactBoundary;
  assert(boundary?.checkoutDependency === "none-declared" && boundary.checkoutPathInput === null && boundary.checkoutAbsenceObservation === "not-claimed" && typeof boundary.candidateManifestHash === "string" && typeof boundary.pluginBundleHash === "string" && boundary.installedSymlinkCount === 0 && boundary.pluginSymlinkCount === 0 && boundary.nodePathEmpty === true && boundary.execution === "trusted-host", "did not prove checkout-independent installed-artifact execution");
  assert(evidence.plan?.changeSelector === evidence.pause?.changeSelector && evidence.plan?.planHash === evidence.pause?.planHash, "does not match planned and approval-required identity");
  assert(evidence.pause?.status === "approval-required" && evidence.approval?.status === "approved" && evidence.approval?.planHash === evidence.plan?.planHash, "did not enforce exact plan-hash approval");
  const interruption = evidence.interruption;
  assert(interruption?.terminationRequested === true && interruption.rootExitObserved === true && interruption.journalPhase === "validating" && interruption.mutationObserved === true, "did not prove a bounded validating-phase interruption");
  const windowsCleanupObserved = interruption.cleanupStrategy === "windows-taskkill-tree" && interruption.cleanupStatus === "reported-complete" && interruption.cleanupCommandExitCode === 0 && interruption.rootAbsentObserved === true;
  const posixCleanupRecovered = interruption.cleanupStrategy === "posix-process-group-sigkill" && interruption.cleanupStatus === "unconfirmed" && typeof interruption.cleanupReason === "string" && interruption.cleanupReason.length > 0 && evidence.recovery?.action === "rolled-back" && evidence.recovery?.exactBeforeRestored === true;
  assert(windowsCleanupObserved || posixCleanupRecovered, "did not preserve truthful platform cleanup and recovery evidence");
  assert(evidence.recovery?.action === "rolled-back" && evidence.recovery?.exactBeforeRestored === true, "did not prove exact rollback");
  assert(evidence.result?.outcome === "success" && evidence.result?.approvalSelector === evidence.approval?.approvalSelector && evidence.result?.planId === evidence.plan?.planId, "does not bind successful result identity");
  let certificateArtifact; let receipt;
  try { certificateArtifact = JSON.parse(evidence.result?.certificateBytes); receipt = JSON.parse(evidence.result?.receiptBytes); } catch { throw new Error("packed lifecycle evidence has malformed completion artifact bytes"); }
  assert(`${canonicalJson(certificateArtifact)}\n` === evidence.result.certificateBytes && `${canonicalJson(receipt)}\n` === evidence.result.receiptBytes, "has noncanonical persisted completion artifact bytes");
  assert(evidence.result.certificateHash === hashFramedDomain("change-certificate-artifact", certificateArtifact) && evidence.result.receiptHash === hashFramedDomain("transaction-receipt-artifact", receipt) && receipt.certificateHash === evidence.result.certificateHash, "has completion hashes that do not match artifact bytes");
  assert(sameStrings(evidence.plan.predictedChangedPaths, evidence.result.predictedChangedPaths) && sameStrings(evidence.result.predictedChangedPaths, evidence.result.observedChangedPaths), "has predicted/observed path impact mismatch");
  assert(evidence.result.unexpectedChangedPaths.length === 0 && evidence.result.unexpectedChangedCanonicalIds.length === 0 && evidence.result.planningSurpriseIds.length === 0 && evidence.result.unknowns.length === 0, "has unexplained impact or planning surprise");
  const oracle = evidence.independentOracle; assert(oracle?.beforeExitCode !== 0 && oracle?.afterExitCode === 0 && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(oracle?.gitObjectId ?? "") && oracle?.expectedContentHash === oracle?.beforeContentHash && oracle?.beforeContentHash === oracle?.afterContentHash && oracle?.afterContentHash === oracle?.executedContentHash && oracle?.executionSource === "exact-live-tracked-validator", "lacks an independent Git-base desired-behavior oracle");
  const rerun = evidence.fixedPointRerun; assert(rerun?.firstCertificateHash === evidence.result.certificateHash && rerun?.secondCertificateHash === rerun?.firstCertificateHash && rerun?.firstReceiptHash === evidence.result.receiptHash && rerun?.secondReceiptHash === rerun?.firstReceiptHash && rerun?.afterSourceHash === rerun?.rerunSourceHash, "lacks an actual fixed-point rerun");
  authenticateTrace(evidence.trace, evidence.plan);
  return hash("packed-held-out-lifecycle-evidence", evidence);
}

function launch(file, args, options = {}) {
  const child = spawn(file, args, { cwd: options.cwd, env: options.env ?? {}, detached: options.detached ?? false, stdio: [options.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"] });
  let stdout = ""; let stderr = ""; let outputBytes = 0; let boundaryFailure; let cleanup;
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  const collect = (stream) => (chunk) => {
    outputBytes += Buffer.byteLength(chunk);
    if (outputBytes <= maximumOutputBytes) {
      if (stream === "stdout") stdout += chunk; else stderr += chunk;
      return;
    }
    boundaryFailure ??= `output exceeded ${String(maximumOutputBytes)} bytes`;
    cleanup ??= terminateProcessTree(child.pid);
  };
  child.stdout.on("data", collect("stdout")); child.stderr.on("data", collect("stderr"));
  if (options.stdin !== undefined) child.stdin.end(options.stdin);
  const timer = setTimeout(() => {
    boundaryFailure ??= `execution exceeded ${String(options.timeoutMs ?? maximumExecutionMs)}ms`;
    cleanup ??= terminateProcessTree(child.pid);
  }, options.timeoutMs ?? maximumExecutionMs);
  timer.unref();
  const completed = new Promise((resolve, reject) => {
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", async (code, signal) => {
      clearTimeout(timer);
      if (cleanup !== undefined) await cleanup;
      resolve({ exitCode: code, signal, stdout: stdout.trim(), stderr: stderr.trim(), boundaryFailure });
    });
  });
  return { child, completed };
}

async function run(file, args, options = {}) {
  return launch(file, args, options).completed;
}

function requireExit(result, label, allowed = [0]) {
  if (result.boundaryFailure !== undefined) throw new Error(`${label} ${result.boundaryFailure}`);
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

async function processAbsent(processId) {
  try { process.kill(processId, 0); return false; }
  catch (error) { if (error?.code === "ESRCH") return true; if (error?.code === "EPERM") return false; throw error; }
}

async function waitForProcessAbsence(processId, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await processAbsent(processId)) return true;
    await delay(25);
  }
  return processAbsent(processId);
}

export async function terminateProcessTree(rootProcessId) {
  if (process.platform === "win32") {
    let cleanupCommandExitCode = 0;
    try {
      await execute("taskkill", ["/PID", String(rootProcessId), "/T", "/F"], { windowsHide: true, timeout: 10_000 });
    } catch (error) {
      cleanupCommandExitCode = typeof error?.code === "number" ? error.code : -1;
      if (error?.code !== 128 && error?.code !== "ESRCH") throw error;
    }
    const rootAbsentObserved = await waitForProcessAbsence(rootProcessId);
    if (!rootAbsentObserved) throw new Error(`taskkill returned but root process ${String(rootProcessId)} remained observable`);
    return { strategy: "windows-taskkill-tree", requestedProcessIds: [rootProcessId], cleanupCommandExitCode, rootAbsentObserved, status: "reported-complete" };
  }

  try { process.kill(-rootProcessId, "SIGKILL"); }
  catch (error) { if (error?.code !== "ESRCH") throw error; }
  return {
    strategy: "posix-process-group-sigkill",
    requestedProcessIds: [rootProcessId],
    rootAbsentObserved: await waitForProcessAbsence(rootProcessId),
    status: "unconfirmed",
    reason: "The owned process group received SIGKILL, but descendants that escaped into another session cannot be confirmed absent.",
  };
}

async function pathAbsent(path) {
  try { await access(path); return false; } catch (error) { if (error?.code === "ENOENT") return true; throw error; }
}

export function validatePackedLifecycleInput(input) {
  assert(input !== null && typeof input === "object" && typeof input.temporaryRoot === "string" && typeof input.candidateRoot === "string", "packed lifecycle requires owned temporary and candidate roots");
  for (const forbidden of ["repositoryRoot", "checkoutPath", "pluginSource", "fixture", "consumerRoot", "installedProjector"]) assert(!Object.hasOwn(input, forbidden), `received forbidden caller input: ${forbidden}`);
}

async function installCandidateTarball(candidate, temporaryRoot) {
  const consumerRoot = join(temporaryRoot, "packed-consumer");
  await mkdir(consumerRoot, { recursive: true });
  await writeFile(join(consumerRoot, "package.json"), "{\"private\":true,\"type\":\"module\"}\n");
  const npmConfig = join(temporaryRoot, "packed-empty-npmrc");
  await writeFile(npmConfig, "");
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toLowerCase().startsWith("npm_config_")));
  environment.NPM_CONFIG_USERCONFIG = npmConfig;
  const npm = await resolveNpmCommand(["install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-package-lock", join(candidate.root, candidate.manifest.tarballPath)], environment);
  requireExit(await run(npm.executable, npm.arguments, { cwd: consumerRoot, env: environment }), "packed candidate tarball install");
  return { consumerRoot, installedProjector: join(consumerRoot, "node_modules/@onepersonlabs/projector") };
}

export async function runPackedLifecycleAcceptance(input) {
  validatePackedLifecycleInput(input);
  const candidate = await validateReleaseCandidate(input.candidateRoot);
  const candidatePluginRoot = join(candidate.root, candidate.manifest.pluginRoot);
  const pluginFiles = candidate.files.filter(({ path }) => path.startsWith(`${candidate.manifest.pluginRoot}/`));
  assert(pluginFiles.length > 0, "release candidate has no authenticated plugin files");
  const fixtureDescriptor = candidate.files.find(({ path }) => path === candidate.manifest.fixturePath);
  const fixtureBytes = await readFile(join(candidate.root, candidate.manifest.fixturePath));
  assert(fixtureDescriptor !== undefined && hashBytes(fixtureBytes) === fixtureDescriptor.digest, "held-out fixture bytes do not match the candidate manifest");
  const fixture = JSON.parse(fixtureBytes.toString("utf8"));
  assert(fixture?.version === 1 && typeof fixture.request === "string" && Array.isArray(fixture.expectedPaths), "received an invalid held-out fixture");
  const { installedProjector } = await installCandidateTarball(candidate, input.temporaryRoot);
  const runId = randomUUID();
  const pluginRoot = join(input.temporaryRoot, "held-out-plugin");
  const repository = join(input.temporaryRoot, "held-out-repository");
  const operationEntry = join(pluginRoot, "scripts", "projector-operation.mjs");
  await cp(candidatePluginRoot, pluginRoot, { recursive: true });
  const expectedCopiedPluginFiles = pluginFiles.map(({ path, ...rest }) => ({ path: path.slice(`${candidate.manifest.pluginRoot}/`.length), ...rest }));
  const copiedPluginFiles = await inventoryCandidateFiles(pluginRoot);
  assert(candidateJson(expectedCopiedPluginFiles) === candidateJson(copiedPluginFiles), "copied plugin bytes do not match the candidate manifest");
  await mkdir(join(repository, "src"), { recursive: true });
  await mkdir(join(repository, "test"), { recursive: true });
  await writeFile(join(repository, ".gitignore"), ".projector/runtime/\n", "utf8");
  await writeFile(join(repository, "package.json"), "{\"type\":\"module\"}\n", "utf8");
  const { beforeSource, afterSource, supplementalTestSource: supplemental } = fixture;
  assert([beforeSource, afterSource, supplemental, fixture.indexSource, fixture.independentOracleSource].every((value) => typeof value === "string" && value.length > 0), "received incomplete held-out fixture bytes");
  await writeFile(join(repository, "src", "format-label.mjs"), beforeSource, "utf8");
  await writeFile(join(repository, "src", "index.mjs"), fixture.indexSource, "utf8");
  await writeFile(join(repository, "test", "public-api.test.mjs"), fixture.independentOracleSource, "utf8");
  const { request, proposalPath, expectedPaths } = fixture;
  assert(typeof proposalPath === "string" && proposalPath.length > 0 && expectedPaths.every((path) => typeof path === "string" && path.length > 0), "received invalid held-out fixture paths");
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
    validation: { independentNodeTests: ["test/public-api.test.mjs"], supplementalNodeTests: [] },
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

  const inherited = ["SystemRoot", "WINDIR", "COMSPEC", "PATHEXT", "PATH", "TEMP", "TMP", "TMPDIR"].flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key]]]);
  const environment = { ...Object.fromEntries(inherited), HOME: repository, NODE_PATH: "" };
  const hostLaunch = (executable, args, options = {}) => launch(executable, args, { cwd: repository, env: environment, detached: options.detached });
  const trace = [];
  const recordInvocation = (phase, operation, input, result) => {
    const previousHash = trace.at(-1)?.entryHash ?? null;
    const body = { version: 1, phase, operation, input, exitCode: result?.exitCode ?? null, invocationHash: hash("projector-agent-operation-invocation", { operation, input }), output: result?.stdout ?? null, diagnostic: result?.stderr ?? null, outputHash: result === undefined ? null : hash("projector-agent-operation-output", { exitCode: result.exitCode, stdout: result.stdout }), diagnosticHash: result === undefined ? null : hash("projector-agent-operation-diagnostic", result.stderr), previousHash, recordedAt: new Date().toISOString() };
    trace.push({ ...body, entryHash: hash("projector-agent-trace-entry", body) });
  };
  const launchAgent = (operation, input, options = {}) => {
    recordInvocation("invoked", operation, input);
    const requestEnvelope = { apiVersion: "projector.operation/v1", operation, repositoryRoot: repository, requestId: `${runId}:${trace.length}`, input };
    const launched = launch(process.execPath, [operationEntry], { cwd: repository, env: environment, detached: options.detached, stdin: `${canonical(requestEnvelope)}\n` });
    const completed = launched.completed.then((result) => { if (options.recordCompletion !== false) recordInvocation("completed", operation, input, result); return result; });
    return { ...launched, completed };
  };
  const agentResult = async (operation, input, label, allowed = [0]) => json(await launchAgent(operation, input).completed, label, allowed);
  const succeededOutput = (result, label) => {
    assert(result.status === "succeeded" && result.output !== undefined, `${label} did not return a successful operation output`);
    return result.output;
  };
  const initializationRequest = { apiVersion: "projector.operation/v1", operation: "init", repositoryRoot: repository, requestId: `${runId}:init`, input: {} };
  const initializedEnvelope = json(await launch(process.execPath, [operationEntry], { cwd: repository, env: environment, stdin: `${canonical(initializationRequest)}\n` }).completed, "explicit held-out repository activation");
  assert(initializedEnvelope.package?.name === "@onepersonlabs/projector" && initializedEnvelope.package?.version === "2.1.0", "did not execute the installed operation package");
  const initialized = succeededOutput(initializedEnvelope, "initialization");
  const { parse: parseToml } = await import(pathToFileURL(join(installedProjector, "node_modules/smol-toml/dist/index.js")).href);
  const activationConfig = parseToml(await readFile(join(repository, ".projector", "config.toml"), "utf8"));

  const capturedEnvelope = await agentResult("change.capture", { request, proposal }, "agent held-out capture");
  const captured = succeededOutput(capturedEnvelope, "capture");
  const plannedEnvelope = await agentResult("change.plan", { changeSelector: captured.selector }, "agent held-out plan");
  const pause = succeededOutput(plannedEnvelope, "plan");
  const substitutedPlanHash = `${pause.immutablePlanHash.slice(0, -1)}${pause.immutablePlanHash.endsWith("0") ? "1" : "0"}`;
  const substituted = await launchAgent("change.approve", { changeSelector: pause.selector, planHash: substitutedPlanHash }).completed;
  const substitutedResult = json(substituted, "substituted plan hash", [6]);
  assert(substitutedResult.status === "failed" && /(?:plan hash.*(?:does not match|exact)|exact.*plan hash)/iu.test(substitutedResult.error?.message ?? ""), "accepted a substituted plan hash");
  const approval = succeededOutput(await agentResult("change.approve", { changeSelector: pause.selector, planHash: pause.immutablePlanHash }, "agent held-out approval"), "approval");

  const applying = launchAgent("change.apply", { approvalSelector: approval.selector }, { detached: true, recordCompletion: false });
  const progress = await Promise.race([
    waitForJournalPhase(repository, "validating").then((entry) => ({ kind: "validating", entry })),
    applying.completed.then((result) => ({ kind: "exited", result })),
  ]);
  if (progress.kind === "exited") throw new Error(`packed apply exited before validation: ${progress.result.stderr || progress.result.stdout || "no diagnostic"}`);
  const validating = progress.entry;
  const mutationObserved = await readFile(join(repository, "src", "format-label.mjs"), "utf8") === afterSource && !(await pathAbsent(join(repository, "test", "trim-label.test.mjs")));
  const cleanup = await terminateProcessTree(applying.child.pid);
  const interrupted = await applying.completed;
  await rm(join(repository, ".projector", "runtime", "interruption-hold"), { force: true });
  await waitForStaleLease(repository);

  const recovered = succeededOutput(await agentResult("change.recover", { approvalSelector: approval.selector }, "agent held-out recovery"), "recovery");
  const recovery = recovered.outcomes.find(({ transactionId }) => transactionId === validating.transactionId);
  const recoveredSource = await readFile(join(repository, "src", "format-label.mjs"), "utf8");
  const supplementalAbsent = await pathAbsent(join(repository, "test", "trim-label.test.mjs"));
  const exactBeforeRestored = recoveredSource === beforeSource && supplementalAbsent;
  if (recovery?.action !== "rolled-back" || !exactBeforeRestored) throw new Error(`packed rollback mismatch: ${canonical({ validating, recovered, recovery, recoveredSource, supplementalAbsent })}`);
  const result = succeededOutput(await agentResult("change.resume", { approvalSelector: approval.selector }, "agent held-out resume"), "resume");
  const fixed = succeededOutput(await agentResult("change.resume", { approvalSelector: approval.selector }, "agent held-out fixed-point resume"), "fixed-point resume");
  const afterOracle = await hostLaunch(process.execPath, [oracleValidatorPath]).completed;
  const observation = result.validations.find(({ validatorId }) => validatorId === "projector.repository-post-observation")?.details?.observation;
  const independent = result.validations.find(({ validatorId }) => validatorId === "node-independent:test/public-api.test.mjs");
  const certificateBytes = await readFile(join(repository, result.certificateRef), "utf8"); const receiptBytes = await readFile(join(repository, result.receiptRef), "utf8");
  const rerunSource = await readFile(join(repository, "src", "format-label.mjs"), "utf8");
  const revalidatedCandidate = await validateReleaseCandidate(candidate.root);
  assert(revalidatedCandidate.manifestHash === candidate.manifestHash && candidateJson(revalidatedCandidate.files) === candidateJson(candidate.files), "release candidate inputs changed during packed execution");
  const evidence = {
    version: 1,
    runId,
    request,
    activation: { initialized: initialized.created === true, projectEnabled: initialized.readiness?.status === "ready", config: activationConfig },
    artifactBoundary: { checkoutDependency: "none-declared", checkoutPathInput: null, checkoutAbsenceObservation: "not-claimed", candidateManifestHash: candidate.manifestHash, pluginBundleHash: hashCanonical(copiedPluginFiles), installedSymlinkCount: await countSymlinks(installedProjector), pluginSymlinkCount: await countSymlinks(pluginRoot), nodePathEmpty: environment.NODE_PATH === "", execution: "trusted-host" },
    plan: { changeSelector: pause.selector, planHash: pause.immutablePlanHash, planId: pause.plan.id, predictedChangedPaths: expectedPaths, preview: pause.preview },
    pause: { status: "approval-required", changeSelector: pause.selector, planHash: pause.immutablePlanHash },
    approval: { status: approval.kind === "lifecycle-approval" ? "approved" : "invalid", approvalSelector: approval.selector, planHash: approval.immutablePlanHash },
    interruption: { terminationRequested: cleanup.requestedProcessIds.length > 0, rootExitObserved: interrupted.exitCode !== null || interrupted.signal !== null, rootAbsentObserved: cleanup.rootAbsentObserved, cleanupStatus: cleanup.status, cleanupStrategy: cleanup.strategy, cleanupCommandExitCode: cleanup.cleanupCommandExitCode, cleanupReason: cleanup.reason, journalPhase: validating.phase, mutationObserved, requestedProcessCount: cleanup.requestedProcessIds.length },
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
  };
  const evidenceHash = verifyPackedLifecycleEvidence(evidence);
  const transcript = { runId, captured, planned: pause, approval, interrupted, recovered, result, fixed, trace };
  return { runId, evidence, evidenceHash, transcript, transcriptHash: hash("packed-held-out-lifecycle-transcript", transcript) };
}
