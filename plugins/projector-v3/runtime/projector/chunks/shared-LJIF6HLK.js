import { createRequire as __projectorCreateRequire } from "node:module"; const require = __projectorCreateRequire(import.meta.url);
import {
  hashFramedDomain
} from "./shared-6VIFAIKJ.js";

// node_modules/@projector/integrations/dist/models/inference.js
var InferenceFailure = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "InferenceFailure";
  }
};
async function boundedProviderCall(call, remainingMs, signal) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new InferenceFailure("inference-timeout", "structured inference timed out")), remainingMs);
    const cancel = () => reject(new InferenceFailure("inference-cancelled", "structured inference cancelled"));
    signal?.addEventListener("abort", cancel, { once: true });
    call.then(resolve, reject).finally(() => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", cancel);
    }).catch(() => void 0);
  });
}
async function runStructuredInference(request, policy, ports) {
  if (request.inputHash !== hashFramedDomain("structured-model-input", request.input))
    throw new Error("structured model input hash does not match normalized input");
  if (!Number.isSafeInteger(policy.maximumAttempts) || policy.maximumAttempts < 1 || policy.maximumTokens < 1 || policy.maximumCost < 0 || policy.timeoutMs < 1)
    throw new Error("invalid bounded inference policy");
  if (policy.signal?.aborted === true)
    throw new InferenceFailure("inference-cancelled", "structured inference cancelled");
  const requestedTokens = (request.maxInputTokens ?? 0) + (request.maxOutputTokens ?? 0);
  if (requestedTokens > policy.maximumTokens || (request.maxCost ?? 0) > policy.maximumCost)
    throw new Error("structured inference request exceeds policy budget");
  const normalized = { purpose: request.purpose.trim(), role: request.role, programVersion: request.programVersion, schemaName: request.schemaName, schemaVersion: request.schemaVersion, schema: request.schema, input: request.input, inputHash: request.inputHash, ...request.executionCapsule === void 0 ? {} : { executionCapsule: request.executionCapsule }, risk: request.risk, ...request.maxInputTokens === void 0 ? {} : { maxInputTokens: request.maxInputTokens }, ...request.maxOutputTokens === void 0 ? {} : { maxOutputTokens: request.maxOutputTokens }, maxCost: Math.min(request.maxCost ?? policy.maximumCost, policy.maximumCost / policy.maximumAttempts) };
  const started = Date.now();
  const requestHash = hashFramedDomain("structured-model-request", normalized);
  const routeControl = { timeoutMs: policy.timeoutMs, ...policy.signal === void 0 ? {} : { signal: policy.signal } };
  const route = await boundedProviderCall(ports.router.route(normalized, routeControl), policy.timeoutMs, policy.signal);
  if (route.contentHash !== hashFramedDomain("authenticated-model-route", route.value))
    throw new Error("model route identity is unauthenticated");
  const key = hashFramedDomain("structured-inference-cache-key", { requestHash, route: route.value, policy: { maximumAttempts: policy.maximumAttempts, maximumTokens: policy.maximumTokens, maximumCost: policy.maximumCost, timeoutMs: policy.timeoutMs, retry: [...policy.retry].sort(), resampleId: policy.resampleId ?? null } });
  if (policy.replay === "allow") {
    const stored = await ports.store.read(key);
    if (stored !== void 0) {
      if (stored === null || typeof stored !== "object")
        throw new Error("cached inference artifact is malformed");
      const artifact = stored;
      const response = artifact.response;
      if (artifact.key !== key || artifact.requestHash !== requestHash || artifact.routeHash !== route.contentHash || response === void 0 || response.provider !== route.value.providerId || response.model !== route.value.model || route.value.providerRevision !== void 0 && response.providerRevision !== route.value.providerRevision || response.rawResponseHash !== hashFramedDomain("structured-model-response-value", response.value) || !ports.schema.validate(response.value, normalized.schema) || !Number.isSafeInteger(response.attempt) || response.attempt < 1 || response.attempt > policy.maximumAttempts || (response.inputTokens ?? 0) + (response.outputTokens ?? 0) > policy.maximumTokens || artifact.candidateHash !== hashFramedDomain("structured-inference-candidate", { key, response, attempt: response.attempt, resampleId: policy.resampleId ?? null })) {
        throw new Error("cached inference artifact failed authentication");
      }
      return { ...artifact, status: "replayed" };
    }
  }
  let lastReason = "provider failure";
  let consumedTokens = 0;
  for (let attempt = 1; attempt <= policy.maximumAttempts; attempt += 1) {
    if (Boolean(policy.signal?.aborted))
      throw new InferenceFailure("inference-cancelled", "structured inference cancelled");
    if (Date.now() - started >= policy.timeoutMs)
      throw new InferenceFailure("inference-timeout", "structured inference timed out");
    try {
      const remainingMs = policy.timeoutMs - (Date.now() - started);
      if (remainingMs <= 0)
        throw new InferenceFailure("inference-timeout", "structured inference timed out");
      const callControl = { timeoutMs: remainingMs, ...policy.signal === void 0 ? {} : { signal: policy.signal } };
      const response = await boundedProviderCall(route.provider.generateStructured(normalized, callControl), remainingMs, policy.signal);
      if (response.provider !== route.value.providerId || response.model !== route.value.model || route.value.providerRevision !== void 0 && response.providerRevision !== route.value.providerRevision)
        throw new Error("provider response route identity mismatch");
      if (response.rawResponseHash !== hashFramedDomain("structured-model-response-value", response.value))
        throw new Error("provider response hash mismatch");
      consumedTokens += (response.inputTokens ?? normalized.maxInputTokens ?? policy.maximumTokens) + (response.outputTokens ?? normalized.maxOutputTokens ?? policy.maximumTokens);
      if (consumedTokens > policy.maximumTokens)
        throw new Error("structured inference token budget exhausted");
      if (!ports.schema.validate(response.value, normalized.schema)) {
        lastReason = "schema-invalid";
        if (!policy.retry.includes("schema-invalid"))
          break;
        continue;
      }
      const candidateHash = hashFramedDomain("structured-inference-candidate", { key, response, attempt, resampleId: policy.resampleId ?? null });
      const artifact = { key, requestHash, routeHash: route.contentHash, response: { ...response, attempt }, candidateHash };
      await ports.store.write(key, artifact);
      return { status: "recorded", ...artifact };
    } catch (error) {
      if (error instanceof InferenceFailure)
        throw error;
      lastReason = error instanceof Error ? error.message : String(error);
      if (!policy.retry.includes("transient"))
        break;
    }
  }
  throw new InferenceFailure("inference-exhausted", `structured inference exhausted: ${lastReason.replace(/[\r\n]/gu, " ").slice(0, 160)}`);
}

export {
  InferenceFailure,
  runStructuredInference
};
