import { hashFramedDomain, type ContentHash, type StructuredModelRequest, type StructuredModelResponse } from "@projector/core";

export interface InferencePolicy { readonly maximumAttempts: number; readonly maximumTokens: number; readonly maximumCost: number; readonly timeoutMs: number; readonly retry: readonly ("schema-invalid" | "transient")[]; readonly replay: "allow" | "deny"; readonly resampleId?: string; readonly signal?: AbortSignal }
export interface AuthenticatedModelRoute { readonly value: { readonly providerId: string; readonly model: string; readonly providerRevision?: string }; readonly contentHash: ContentHash; readonly provider: { generateStructured(request: StructuredModelRequest<unknown>): Promise<StructuredModelResponse<unknown>> } }
export interface InferenceArtifactStore { read(key: string): Promise<unknown>; write(key: string, value: unknown): Promise<void> }
export interface InferencePorts { readonly router: { route(request: StructuredModelRequest<unknown>): Promise<AuthenticatedModelRoute> }; readonly schema: { validate(value: unknown, schema: unknown): boolean }; readonly store: InferenceArtifactStore }
export interface InferenceArtifact<T> { readonly status: "recorded" | "replayed"; readonly key: ContentHash; readonly requestHash: ContentHash; readonly routeHash: ContentHash; readonly response: StructuredModelResponse<T>; readonly candidateHash: ContentHash }
export class InferenceFailure extends Error { constructor(readonly code: "inference-cancelled" | "inference-exhausted" | "inference-timeout", message: string) { super(message); this.name = "InferenceFailure"; } }

async function boundedProviderCall<T>(call: Promise<T>, remainingMs: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new InferenceFailure("inference-timeout", "structured inference timed out")), remainingMs);
    const cancel = () => reject(new InferenceFailure("inference-cancelled", "structured inference cancelled"));
    signal?.addEventListener("abort", cancel, { once: true });
    call.then(resolve, reject).finally(() => { clearTimeout(timeout); signal?.removeEventListener("abort", cancel); }).catch(() => undefined);
  });
}

export async function runStructuredInference<T>(request: StructuredModelRequest<T>, policy: InferencePolicy, ports: InferencePorts): Promise<InferenceArtifact<T>> {
  if (request.inputHash !== hashFramedDomain("structured-model-input", request.input)) throw new Error("structured model input hash does not match normalized input");
  if (!Number.isSafeInteger(policy.maximumAttempts) || policy.maximumAttempts < 1 || policy.maximumTokens < 1 || policy.maximumCost < 0 || policy.timeoutMs < 1) throw new Error("invalid bounded inference policy");
  if (policy.signal?.aborted === true) throw new InferenceFailure("inference-cancelled", "structured inference cancelled");
  const requestedTokens = (request.maxInputTokens ?? 0) + (request.maxOutputTokens ?? 0);
  if (requestedTokens > policy.maximumTokens || (request.maxCost ?? 0) > policy.maximumCost) throw new Error("structured inference request exceeds policy budget");
  const normalized = { purpose: request.purpose.trim(), role: request.role, programVersion: request.programVersion, schemaName: request.schemaName, schemaVersion: request.schemaVersion, schema: request.schema, input: request.input, inputHash: request.inputHash, ...(request.executionCapsule === undefined ? {} : { executionCapsule: request.executionCapsule }), risk: request.risk, ...(request.maxInputTokens === undefined ? {} : { maxInputTokens: request.maxInputTokens }), ...(request.maxOutputTokens === undefined ? {} : { maxOutputTokens: request.maxOutputTokens }), maxCost: Math.min(request.maxCost ?? policy.maximumCost, policy.maximumCost / policy.maximumAttempts) } satisfies StructuredModelRequest<T>;
  const requestHash = hashFramedDomain("structured-model-request", normalized); const route = await ports.router.route(normalized);
  if (route.contentHash !== hashFramedDomain("authenticated-model-route", route.value)) throw new Error("model route identity is unauthenticated");
  const key = hashFramedDomain("structured-inference-cache-key", { requestHash, route: route.value, policy: { maximumAttempts: policy.maximumAttempts, maximumTokens: policy.maximumTokens, maximumCost: policy.maximumCost, timeoutMs: policy.timeoutMs, retry: [...policy.retry].sort(), resampleId: policy.resampleId ?? null } });
  if (policy.replay === "allow") { const stored = await ports.store.read(key); if (stored !== undefined) return { ...(stored as Omit<InferenceArtifact<T>, "status">), status: "replayed" }; }
  const started = Date.now(); let lastReason = "provider failure"; let consumedTokens = 0;
  for (let attempt = 1; attempt <= policy.maximumAttempts; attempt += 1) {
    if (Boolean(policy.signal?.aborted)) throw new InferenceFailure("inference-cancelled", "structured inference cancelled");
    if (Date.now() - started >= policy.timeoutMs) throw new InferenceFailure("inference-timeout", "structured inference timed out");
    try {
      const remainingMs = policy.timeoutMs - (Date.now() - started);
      if (remainingMs <= 0) throw new InferenceFailure("inference-timeout", "structured inference timed out");
      const response = await boundedProviderCall(route.provider.generateStructured(normalized), remainingMs, policy.signal) as StructuredModelResponse<T>;
      if (response.provider !== route.value.providerId || response.model !== route.value.model || (route.value.providerRevision !== undefined && response.providerRevision !== route.value.providerRevision)) throw new Error("provider response route identity mismatch");
      if (response.rawResponseHash !== hashFramedDomain("structured-model-response-value", response.value)) throw new Error("provider response hash mismatch");
      consumedTokens += (response.inputTokens ?? normalized.maxInputTokens ?? policy.maximumTokens) + (response.outputTokens ?? normalized.maxOutputTokens ?? policy.maximumTokens);
      if (consumedTokens > policy.maximumTokens) throw new Error("structured inference token budget exhausted");
      if (!ports.schema.validate(response.value, normalized.schema)) { lastReason = "schema-invalid"; if (!policy.retry.includes("schema-invalid")) break; continue; }
      const candidateHash = hashFramedDomain("structured-inference-candidate", { key, response, attempt, resampleId: policy.resampleId ?? null });
      const artifact = { key, requestHash, routeHash: route.contentHash, response: { ...response, attempt }, candidateHash };
      await ports.store.write(key, artifact); return { status: "recorded", ...artifact };
    } catch (error) { if (error instanceof InferenceFailure) throw error; lastReason = error instanceof Error ? error.message : String(error); if (!policy.retry.includes("transient")) break; }
  }
  throw new InferenceFailure("inference-exhausted", `structured inference exhausted: ${lastReason.replace(/[\r\n]/gu, " ").slice(0, 160)}`);
}
