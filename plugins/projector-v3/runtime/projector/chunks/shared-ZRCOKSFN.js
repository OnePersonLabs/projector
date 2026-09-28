import {
  executionCapsuleHash,
  executionPlanHash
} from "./shared-WYYVWFGB.js";
import {
  createStateBinding
} from "./shared-HEBLUKDF.js";
import {
  canonicalJson,
  hashFramedDomain
} from "./shared-AJ5KBTH5.js";

// node_modules/@projector/integrations/dist/sessions/index.js
import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
var sessionBody = (record) => record;
function createHostSessionRecord(input) {
  return { ...input, contentHash: hashFramedDomain("task17-host-session", sessionBody(input)) };
}
function hostSessionSelector(record) {
  return `session:${record.contentHash.slice("sha256:v1:".length)}`;
}
function authenticateRepresentationBinding(input) {
  const projection = input.capsule.representation;
  if (projection === void 0)
    return { status: "absent", reason: "authenticated execution capsule omits its representation projection" };
  if (canonicalJson(input.instructions.representation) !== canonicalJson(projection))
    return { status: "invalid", reason: "authenticated session representation projection does not match its capsule binding" };
  if (!input.instructions.sourceHashes.includes(input.capsule.normativeKernelHash))
    return { status: "invalid", reason: "authenticated session instructions omit the normative kernel source" };
  if (hashFramedDomain("representation-artifact", input.instructions.text) !== projection.contentHash)
    return { status: "invalid", reason: "authenticated session representation artifact hash is invalid" };
  return { status: "valid", projection, text: input.instructions.text };
}
async function loadAuthenticatedRepositorySession(request) {
  const match = /^session:([a-f0-9]{64})$/u.exec(request.sessionSelector);
  if (match?.[1] === void 0)
    throw new Error("repository session requires an immutable session selector");
  const path = join(request.repositoryRoot, ".projector", "task17-sessions", `session-${match[1]}.json`);
  const stored = JSON.parse(await readFile(path, "utf8"));
  const { contentHash, ...body } = stored;
  if (stored.kind !== "task17-host-session" || contentHash !== hashFramedDomain("task17-host-session", body) || contentHash.slice("sha256:v1:".length) !== match[1])
    throw new Error("repository session selector is unauthenticated");
  if (request.host !== void 0 && stored.host !== request.host || stored.repositoryRootHash !== hashFramedDomain("task17-host-repository-root", await realpath(request.repositoryRoot)))
    throw new Error("repository session route/root mismatch");
  const bindingAuthentic = canonicalJson(createStateBinding(stored.plan.boundState)) === canonicalJson(stored.plan.boundState);
  const approvalAuthentic = bindingAuthentic && stored.approval.planId === stored.plan.id && stored.approval.planRevision === stored.plan.revision && stored.approval.planHash === executionPlanHash(stored.plan) && stored.approval.dependencyDigest === stored.plan.boundState.dependencyDigest && stored.approval.capsuleId === stored.capsule.id && stored.approval.capsuleHash === executionCapsuleHash(stored.capsule) && canonicalJson(stored.plan.boundState) === canonicalJson(stored.capsule.boundState);
  if (!approvalAuthentic)
    throw new Error("repository session approval or state binding is unauthenticated");
  return { record: stored, representation: authenticateRepresentationBinding(stored) };
}

// node_modules/@projector/integrations/dist/codex/adapter.js
function sameState(left, right) {
  return hashFramedDomain("host-current-state", left) === hashFramedDomain("host-current-state", right);
}
function createHostAdapter(host, executable, dependencies) {
  async function capabilities() {
    const available = await dependencies.probe.executable(executable);
    const enabled = async (feature) => available && dependencies.probe.feature(feature);
    const [instructionInstallation, lifecycleHooks, programmaticExecution, subagents, isolatedWorktrees, structuredResult, toolObservation, filesystemObservation, cancellation, stateCapability] = await Promise.all([
      enabled("instruction-installation"),
      enabled("lifecycle-hooks"),
      enabled("programmatic-execution"),
      enabled("subagents"),
      enabled("isolated-worktrees"),
      enabled("structured-result"),
      enabled("tool-observation"),
      enabled("filesystem-observation"),
      enabled("cancellation"),
      enabled("state-capability")
    ]);
    const observable = toolObservation || filesystemObservation || lifecycleHooks;
    const level = available && programmaticExecution && structuredResult && observable && stateCapability ? 3 : available && observable ? 2 : 1;
    return { host, level, executable: available, instructionInstallation, lifecycleHooks, programmaticExecution, subagents, isolatedWorktrees, structuredResult, toolObservation, filesystemObservation, cancellation, stateCapability, enforcement: level === 3 ? "state-bound" : level === 2 ? "observed" : "instruction-only" };
  }
  return {
    capabilities,
    async run(request, ports) {
      const capability = await capabilities();
      if (!capability.executable)
        return { status: "manual", changedPaths: [], failure: `${host} executable is unavailable` };
      if (request.binding.dependencyDigest !== request.capsule.boundState.dependencyDigest)
        throw new Error("host binding does not match execution capsule");
      const context = { repositoryRoot: request.repositoryRoot, stateDigest: request.currentState, config: {}, signal: request.signal };
      const validation = await ports.bindingValidator.validate(request.binding, request.currentState, context);
      if (validation.status !== "current" && validation.status !== "rebound")
        throw new Error(`host StateBinding is ${validation.status}`);
      const effectiveBinding = validation.status === "rebound" ? validation.rebound : request.binding;
      if (effectiveBinding === void 0 || !sameState(effectiveBinding.compiledAgainst, request.currentState) || effectiveBinding.dependencyDigest !== request.binding.dependencyDigest)
        throw new Error("host StateBinding rebound is unauthenticated");
      const representation = authenticateRepresentationBinding({ capsule: request.capsule, instructions: request.instructions });
      if (representation.status !== "valid")
        throw new Error(`host representation is ${representation.status}: ${representation.reason}`);
      if (!await ports.authority.verify({ sessionId: request.sessionId, capsule: request.capsule, binding: effectiveBinding, currentState: request.currentState }))
        throw new Error("host authority is absent or stale");
      const requestHash = hashFramedDomain("host-run-request", { sessionId: request.sessionId, repositoryRoot: request.repositoryRoot, argv: request.argv, environmentKeys: request.allowedEnvironmentKeys, capsuleHash: request.capsule.contextHash, bindingDigest: effectiveBinding.dependencyDigest, currentState: request.currentState, instructions: request.instructions });
      const capsuleHash = hashFramedDomain("host-execution-capsule", request.capsule);
      const journal = await ports.journal.prepare({ requestHash, host, capsuleHash });
      const before = await ports.observe.capture({ phase: "before", repositoryRoot: request.repositoryRoot });
      const allow = new Set(request.allowedEnvironmentKeys);
      const env = Object.fromEntries(Object.entries(request.environment).filter(([key]) => allow.has(key)));
      let launch;
      let failure;
      try {
        launch = await ports.launcher.launch({ executable, args: [...request.argv], cwd: request.repositoryRoot, env, signal: request.signal, instructions: request.instructions });
      } catch (error) {
        failure = request.signal.aborted ? "host cancelled" : error instanceof Error ? error.message : String(error);
      }
      const after = await ports.observe.capture({ phase: "after", repositoryRoot: request.repositoryRoot });
      const reconciled = await ports.reconcile.run({ capsule: request.capsule, before, after, launch, ...failure === void 0 ? {} : { failure } });
      const status = reconciled.status;
      await ports.journal.finish({ journalId: journal.id, status, before, after, ...failure === void 0 ? {} : { failure } });
      return { status, changedPaths: [...reconciled.changedPaths], journalId: journal.id, ...failure === void 0 ? {} : { failure } };
    }
  };
}
function createCodexHostAdapter(dependencies) {
  return createHostAdapter("codex", "codex", dependencies);
}

// node_modules/@projector/integrations/dist/codex/provider.js
import { spawn } from "node:child_process";
import { open, mkdtemp, realpath as realpath2, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join as join2 } from "node:path";
var CodexExecProviderError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "CodexExecProviderError";
  }
};
var PROVIDER_ID = "codex-cli-chatgpt";
var DEFAULT_MAXIMUM_OUTPUT_BYTES = 1024 * 1024;
var DEFAULT_PROBE_TIMEOUT_MS = 5e3;
var REQUIRED_EXEC_FLAGS = ["--output-schema", "--json", "--output-last-message", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--sandbox", "--cd", "--disable"];
var DISABLED_CODEX_EXEC_FEATURES = [
  "apps",
  "auth_elicitation",
  "browser_use",
  "browser_use_external",
  "browser_use_full_cdp_access",
  "code_mode_host",
  "computer_use",
  "goals",
  "hooks",
  "image_generation",
  "in_app_browser",
  "multi_agent",
  "multi_agent_v2",
  "plugins",
  "remote_plugin",
  "shell_snapshot",
  "shell_tool",
  "skill_mcp_dependency_install",
  "skill_search",
  "tool_call_mcp_elicitation",
  "tool_suggest",
  "unified_exec",
  "view_image",
  "workspace_dependencies"
];
function validBound(value, name) {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error(`${name} must be a positive safe integer`);
  return value;
}
function minimalEnvironment(source) {
  const allowed = process.platform === "win32" ? ["PATH", "HOME", "CODEX_HOME", "TMPDIR", "LANG", "LC_ALL", "SystemRoot"] : ["PATH", "HOME", "CODEX_HOME", "TMPDIR", "LANG", "LC_ALL"];
  const entries = [];
  for (const key of allowed)
    if (typeof source[key] === "string" && source[key] !== "")
      entries.push([key, source[key]]);
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}
function safeFailureMessage(error) {
  if (error instanceof CodexExecProviderError)
    return error.message;
  if (error instanceof Error && "code" in error && error.code === "ENOENT")
    return "Codex CLI executable was not found";
  return "Codex CLI process could not be started";
}
var SpawnCodexProcessRunner = class {
  async run(request) {
    if (request.signal?.aborted === true)
      throw new CodexExecProviderError("cancelled", "Codex CLI execution was cancelled");
    return new Promise((resolve, reject) => {
      let settled = false;
      let stdoutBytes = 0;
      let stderrBytes = 0;
      const stdout = [];
      const stderr = [];
      const child = spawn(request.executable, [...request.args], { cwd: request.cwd, env: { ...request.environment }, shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
      const stop = (error) => {
        if (settled)
          return;
        settled = true;
        clearTimeout(timer);
        request.signal?.removeEventListener("abort", cancel);
        child.kill("SIGKILL");
        reject(error);
      };
      const cancel = () => stop(new CodexExecProviderError("cancelled", "Codex CLI execution was cancelled"));
      const timer = setTimeout(() => stop(new CodexExecProviderError("timeout", "Codex CLI execution exceeded its wall-clock budget")), request.timeoutMs);
      request.signal?.addEventListener("abort", cancel, { once: true });
      const collect = (target, chunk, stream) => {
        if (settled)
          return;
        if (stream === "stdout")
          stdoutBytes += chunk.byteLength;
        else
          stderrBytes += chunk.byteLength;
        if (stdoutBytes + stderrBytes > request.maximumOutputBytes) {
          stop(new CodexExecProviderError("output-limit", "Codex CLI diagnostic output exceeded its byte budget"));
          return;
        }
        target.push(chunk);
      };
      child.stdout.on("data", (chunk) => collect(stdout, chunk, "stdout"));
      child.stderr.on("data", (chunk) => collect(stderr, chunk, "stderr"));
      child.once("error", (error) => {
        if (settled)
          return;
        settled = true;
        clearTimeout(timer);
        request.signal?.removeEventListener("abort", cancel);
        reject(error);
      });
      child.once("close", (exitCode) => {
        if (settled)
          return;
        settled = true;
        clearTimeout(timer);
        request.signal?.removeEventListener("abort", cancel);
        resolve({ exitCode: exitCode ?? 1, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") });
      });
      child.stdin.end(request.stdin);
    });
  }
};
function unavailable(executable, reason, authKind = "unavailable", providerRevision) {
  return { providerId: PROVIDER_ID, available: false, executable, authenticated: false, authKind, ...providerRevision === void 0 ? {} : { providerRevision }, structuredOutput: false, programmaticExecution: false, cancellation: true, filesystemAccess: "read-only", toolIsolation: "unavailable", configuration: "isolated", tokenBudgetEnforcement: "preflight-and-observed", monetaryCostMetering: false, reason };
}
function parseUsage(stdout) {
  let usage;
  for (const line of stdout.split(/\r?\n/u).filter((value) => value.trim() !== "")) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      throw new CodexExecProviderError("malformed-response", "Codex CLI emitted malformed structured event output");
    }
    if (event !== null && typeof event === "object" && event.type === "turn.completed") {
      const raw = event.usage;
      const inputTokens = raw?.input_tokens;
      const outputTokens = raw?.output_tokens;
      if (Number.isSafeInteger(inputTokens) && Number(inputTokens) >= 0 && Number.isSafeInteger(outputTokens) && Number(outputTokens) >= 0)
        usage = { inputTokens: Number(inputTokens), outputTokens: Number(outputTokens) };
    }
  }
  if (usage === void 0)
    throw new CodexExecProviderError("malformed-response", "Codex CLI did not provide authenticated token usage");
  return usage;
}
async function boundedRead(path, maximumBytes) {
  const handle = await open(path, "r");
  try {
    const stat = await handle.stat();
    if (stat.size > maximumBytes)
      throw new CodexExecProviderError("output-limit", "Codex CLI structured response exceeded its byte budget");
    return await handle.readFile("utf8");
  } finally {
    await handle.close();
  }
}
function createCodexExecRouter(provider) {
  return { route: async (_request, control) => provider.authenticatedRoute(control) };
}
function createCodexExecProvider(options) {
  const executable = options.executable ?? "codex";
  const model = options.model.trim();
  if (model === "" || /[\u0000\r\n]/u.test(model))
    throw new Error("Codex provider requires an explicit safe model identity");
  const maximumOutputBytes = validBound(options.maximumOutputBytes ?? DEFAULT_MAXIMUM_OUTPUT_BYTES, "maximumOutputBytes");
  const probeTimeoutMs = validBound(options.probeTimeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS, "probeTimeoutMs");
  const runner = options.runner ?? new SpawnCodexProcessRunner();
  const environment = minimalEnvironment(options.environment ?? process.env);
  const invoke = async (cwd, args, timeoutMs, signal, stdin = "") => runner.run({ executable, args, cwd, environment, stdin, timeoutMs, maximumOutputBytes: Math.max(64 * 1024, maximumOutputBytes), ...signal === void 0 ? {} : { signal } });
  async function probe(signal, totalTimeoutMs) {
    const deadline = Date.now() + validBound(totalTimeoutMs, "probe timeout");
    const remaining = () => {
      const value = deadline - Date.now();
      if (value < 1)
        throw new CodexExecProviderError("timeout", "Codex CLI capability probe exceeded its wall-clock budget");
      return value;
    };
    let cwd;
    try {
      cwd = await realpath2(options.cwd);
    } catch {
      return unavailable(false, "Provider working directory is unavailable");
    }
    let versionResult;
    try {
      versionResult = await invoke(cwd, ["--version"], remaining(), signal);
    } catch (error) {
      if (error instanceof CodexExecProviderError && (error.code === "cancelled" || error.code === "timeout"))
        throw error;
      return unavailable(false, safeFailureMessage(error));
    }
    const providerRevision = versionResult.stdout.trim().split(/\r?\n/u)[0]?.slice(0, 120);
    if (versionResult.exitCode !== 0 || providerRevision === void 0 || !/^codex-cli\s+\d+\.\d+\.\d+/u.test(providerRevision))
      return unavailable(true, "Codex CLI version identity is unavailable");
    let login;
    try {
      login = await invoke(cwd, ["login", "status"], remaining(), signal);
    } catch (error) {
      if (error instanceof CodexExecProviderError && (error.code === "cancelled" || error.code === "timeout"))
        throw error;
      return unavailable(true, "Codex CLI login status is unavailable", "unavailable", providerRevision);
    }
    const loginStatus = `${login.stdout}
${login.stderr}`;
    if (login.exitCode !== 0 || !/logged in using chatgpt/iu.test(loginStatus)) {
      const unsupported = /api key|access token/iu.test(loginStatus);
      return unavailable(true, unsupported ? "Codex CLI is authenticated with unsupported credentials; a ChatGPT subscription login is required" : "Codex CLI is not authenticated with a ChatGPT subscription", unsupported ? "unsupported" : "unavailable", providerRevision);
    }
    let help;
    try {
      help = await invoke(cwd, ["exec", "--help"], remaining(), signal);
    } catch (error) {
      if (error instanceof CodexExecProviderError && (error.code === "cancelled" || error.code === "timeout"))
        throw error;
      return unavailable(true, "Codex CLI exec contract is unavailable", "chatgpt-subscription", providerRevision);
    }
    const missing = REQUIRED_EXEC_FLAGS.filter((flag) => !help.stdout.includes(flag));
    if (help.exitCode !== 0 || missing.length > 0)
      return unavailable(true, "Codex CLI does not expose the required bounded structured-exec contract", "chatgpt-subscription", providerRevision);
    let features;
    try {
      features = await invoke(cwd, ["features", "list"], remaining(), signal);
    } catch (error) {
      if (error instanceof CodexExecProviderError && (error.code === "cancelled" || error.code === "timeout"))
        throw error;
      return unavailable(true, "Codex CLI feature inventory is unavailable", "chatgpt-subscription", providerRevision);
    }
    const stableFeatures = new Set(features.stdout.split(/\r?\n/u).flatMap((line) => {
      const match = /^(\S+)\s+stable\s+(?:true|false)\s*$/u.exec(line);
      return match?.[1] === void 0 ? [] : [match[1]];
    }));
    if (features.exitCode !== 0 || DISABLED_CODEX_EXEC_FEATURES.some((feature) => !stableFeatures.has(feature)))
      return unavailable(true, "Codex CLI cannot prove the required stable tool-disable inventory", "chatgpt-subscription", providerRevision);
    return { providerId: PROVIDER_ID, available: true, executable: true, authenticated: true, authKind: "chatgpt-subscription", providerRevision, structuredOutput: true, programmaticExecution: true, cancellation: true, filesystemAccess: "read-only", toolIsolation: "all-stable-tools-disabled", configuration: "isolated", tokenBudgetEnforcement: "preflight-and-observed", monetaryCostMetering: false };
  }
  async function capabilities(signal) {
    return probe(signal, probeTimeoutMs);
  }
  async function executeStructured(request, control, proven) {
    if (!proven.available || proven.providerRevision === void 0)
      throw new CodexExecProviderError(proven.authKind === "unsupported" ? "unsupported-auth" : "unavailable", proven.reason ?? "Codex CLI provider is unavailable");
    if (request.inputHash !== hashFramedDomain("structured-model-input", request.input))
      throw new CodexExecProviderError("invalid-request", "Codex provider input hash does not match normalized input");
    if (!Number.isSafeInteger(request.maxInputTokens) || request.maxInputTokens < 1 || !Number.isSafeInteger(request.maxOutputTokens) || request.maxOutputTokens < 1)
      throw new CodexExecProviderError("invalid-request", "Codex provider requires explicit positive input and output token budgets");
    const cwd = await realpath2(options.cwd);
    const requestHash = hashFramedDomain("codex-exec-structured-request", request);
    const capsuleHash = request.executionCapsule === void 0 ? void 0 : hashFramedDomain("codex-exec-capsule-binding", request.executionCapsule);
    const promptValue = { protocol: "projector.codex-structured.v1", requestHash, purpose: request.purpose, role: request.role, programVersion: request.programVersion, schemaName: request.schemaName, schemaVersion: request.schemaVersion, schemaHash: hashFramedDomain("codex-exec-output-schema", request.schema), input: request.input, inputHash: request.inputHash, ...request.executionCapsule === void 0 ? {} : { executionCapsule: request.executionCapsule, capsuleHash }, risk: request.risk, maxInputTokens: request.maxInputTokens, maxOutputTokens: request.maxOutputTokens, instruction: "Return only one JSON value matching the supplied output schema. Do not modify files or use credentials." };
    const prompt = canonicalJson(promptValue);
    const schemaText = `${canonicalJson(request.schema)}
`;
    const estimatedInputTokens = Math.ceil((Buffer.byteLength(prompt, "utf8") + Buffer.byteLength(schemaText, "utf8")) / 4);
    if (estimatedInputTokens > request.maxInputTokens)
      throw new CodexExecProviderError("token-budget", "Codex provider prompt exceeds its declared input token budget");
    const timeoutMs = validBound(control?.timeoutMs ?? probeTimeoutMs, "timeoutMs");
    const temporary = await mkdtemp(join2(tmpdir(), "projector-codex-exec-"));
    const schemaPath = join2(temporary, "schema.json");
    const outputPath = join2(temporary, "response.json");
    try {
      await writeFile(schemaPath, schemaText, { encoding: "utf8", mode: 384, flag: "wx" });
      const disabledFeatures = DISABLED_CODEX_EXEC_FEATURES.flatMap((feature) => ["--disable", feature]);
      const result = await invoke(cwd, ["exec", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--sandbox", "read-only", ...disabledFeatures, "--color", "never", "--output-schema", schemaPath, "--output-last-message", outputPath, "--json", "--cd", cwd, "--model", model, "-"], timeoutMs, control?.signal, prompt);
      if (result.exitCode !== 0)
        throw new CodexExecProviderError("process-failed", `Codex CLI structured execution failed with exit code ${result.exitCode}`);
      const usage = parseUsage(result.stdout);
      if (usage.inputTokens > request.maxInputTokens || usage.outputTokens > request.maxOutputTokens)
        throw new CodexExecProviderError("token-budget", "Codex CLI exceeded the declared token budget");
      const raw = await boundedRead(outputPath, maximumOutputBytes);
      let value;
      try {
        value = JSON.parse(raw);
      } catch {
        throw new CodexExecProviderError("malformed-response", "Codex CLI returned malformed structured JSON");
      }
      return { value, provider: PROVIDER_ID, model, providerRevision: proven.providerRevision, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, rawResponseHash: hashFramedDomain("structured-model-response-value", value), attempt: 1 };
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
  const provider = {
    capabilities,
    async authenticatedRoute(control) {
      const proven = await probe(control?.signal, control?.timeoutMs ?? probeTimeoutMs);
      if (!proven.available || proven.providerRevision === void 0)
        throw new CodexExecProviderError(proven.authKind === "unsupported" ? "unsupported-auth" : proven.authKind === "chatgpt-subscription" ? "unsupported-contract" : "unavailable", proven.reason ?? "Codex CLI provider is unavailable");
      const value = { providerId: PROVIDER_ID, model, providerRevision: proven.providerRevision };
      return { value, contentHash: hashFramedDomain("authenticated-model-route", value), provider: { generateStructured: (request, callControl) => executeStructured(request, callControl, proven) } };
    },
    async generateStructured(request, control) {
      const totalTimeoutMs = control?.timeoutMs ?? probeTimeoutMs;
      const started = Date.now();
      const proven = await probe(control?.signal, totalTimeoutMs);
      const remaining = totalTimeoutMs - (Date.now() - started);
      if (remaining < 1)
        throw new CodexExecProviderError("timeout", "Codex CLI execution exceeded its wall-clock budget");
      return executeStructured(request, { timeoutMs: remaining, ...control?.signal === void 0 ? {} : { signal: control.signal } }, proven);
    }
  };
  return provider;
}

export {
  createHostSessionRecord,
  hostSessionSelector,
  authenticateRepresentationBinding,
  loadAuthenticatedRepositorySession,
  createHostAdapter,
  createCodexHostAdapter,
  CodexExecProviderError,
  DISABLED_CODEX_EXEC_FEATURES,
  SpawnCodexProcessRunner,
  createCodexExecRouter,
  createCodexExecProvider
};
