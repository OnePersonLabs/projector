import { hashFramedDomain, type RiskAssessment, type StructuredModelRequest } from "@projector/core";
import { describe, expect, it, vi } from "vitest";

import { runStructuredInference, type InferenceArtifactStore } from "./inference.js";

const risk: RiskAssessment = { class: "R0", inherentOperationRisk: 0, affectedUnitCount: 0, affectedSurfaceCount: 0, publicContractImpact: false, externalImpact: false, dataImpact: false, reversibility: "full", validationStrength: "strong", closureConfidence: "bounded", unresolvedIdentityCount: 0, relevanceFrontierCount: 0, openWorldDependencies: false, unresolvedBlockingConcernCount: 0, suspectDecisionCount: 0, compensationAvailable: true, reasons: [] };
const request = (): StructuredModelRequest<{ label: string }> => ({ purpose: "classify fixture", role: "classify", programVersion: "1", schemaName: "label", schemaVersion: "1", schema: { type: "object" }, input: { evidence: ["a"] }, inputHash: hashFramedDomain("structured-model-input", { evidence: ["a"] }), risk, maxInputTokens: 100, maxOutputTokens: 20, maxCost: 1 });
const memory = (): InferenceArtifactStore => { const values = new Map<string, unknown>(); return { read: async (key) => values.get(key), write: async (key, value) => { if (values.has(key) && JSON.stringify(values.get(key)) !== JSON.stringify(value)) throw new Error("conflict"); values.set(key, value); } }; };

describe("provider-neutral structured inference", () => {
  it("authenticates request/route/response identities, retries schema-invalid output, and replays exact policy", async () => {
    const provider = { generateStructured: vi.fn().mockResolvedValueOnce({ value: { nope: true }, provider: "fake", model: "small", providerRevision: "r1", inputTokens: 10, outputTokens: 5, rawResponseHash: hashFramedDomain("structured-model-response-value", { nope: true }), attempt: 1 }).mockResolvedValueOnce({ value: { label: "ok" }, provider: "fake", model: "small", providerRevision: "r1", inputTokens: 10, outputTokens: 5, rawResponseHash: hashFramedDomain("structured-model-response-value", { label: "ok" }), attempt: 2 }) };
    const routeValue = { providerId: "fake", model: "small", providerRevision: "r1" }; const store = memory();
    const ports = { router: { route: async () => ({ value: routeValue, contentHash: hashFramedDomain("authenticated-model-route", routeValue), provider }) }, schema: { validate: (value: unknown) => typeof value === "object" && value !== null && "label" in value }, store };
    const first = await runStructuredInference(request(), { maximumAttempts: 2, maximumTokens: 200, maximumCost: 2, timeoutMs: 1000, retry: ["schema-invalid"], replay: "allow" }, ports);
    expect(first.status).toBe("recorded"); expect(first.response.value).toEqual({ label: "ok" }); expect(provider.generateStructured).toHaveBeenCalledTimes(2);
    const replay = await runStructuredInference(request(), { maximumAttempts: 2, maximumTokens: 200, maximumCost: 2, timeoutMs: 1000, retry: ["schema-invalid"], replay: "allow" }, ports);
    expect(replay.status).toBe("replayed"); expect(provider.generateStructured).toHaveBeenCalledTimes(2);
    await expect(runStructuredInference({ ...request(), inputHash: hashFramedDomain("forged", {}) }, { maximumAttempts: 1, maximumTokens: 20, maximumCost: 1, timeoutMs: 10, retry: [], replay: "deny" }, ports)).rejects.toThrow(/input.*hash|request/iu);
    const forgedStore: InferenceArtifactStore = { read: async () => ({ key: hashFramedDomain("forged", "key"), requestHash: hashFramedDomain("forged", "request"), routeHash: hashFramedDomain("forged", "route"), response: { value: { nope: true }, provider: "attacker", model: "wrong", rawResponseHash: hashFramedDomain("forged", "response"), attempt: 99 }, candidateHash: hashFramedDomain("forged", "candidate") }), write: async () => undefined };
    await expect(runStructuredInference(request(), { maximumAttempts: 2, maximumTokens: 200, maximumCost: 2, timeoutMs: 1000, retry: ["schema-invalid"], replay: "allow" }, { ...ports, store: forgedStore })).rejects.toThrow(/cache|replay|artifact/iu);
  });

  it("fails explicitly on cancellation/exhaustion and makes resampling a distinct candidate", async () => {
    const provider = { generateStructured: async () => ({ value: { invalid: true }, provider: "fake", model: "small", rawResponseHash: hashFramedDomain("structured-model-response-value", { invalid: true }), attempt: 1 }) };
    const routeValue = { providerId: "fake", model: "small" }; const ports = { router: { route: async () => ({ value: routeValue, contentHash: hashFramedDomain("authenticated-model-route", routeValue), provider }) }, schema: { validate: () => false }, store: memory() };
    await expect(runStructuredInference(request(), { maximumAttempts: 1, maximumTokens: 120, maximumCost: 1, timeoutMs: 100, retry: [], replay: "deny" }, ports)).rejects.toMatchObject({ code: "inference-exhausted" });
    const controller = new AbortController(); controller.abort();
    await expect(runStructuredInference(request(), { maximumAttempts: 1, maximumTokens: 120, maximumCost: 1, timeoutMs: 100, retry: [], replay: "deny", signal: controller.signal }, ports)).rejects.toMatchObject({ code: "inference-cancelled" });
    const hanging = { ...ports, router: { route: async () => ({ value: routeValue, contentHash: hashFramedDomain("authenticated-model-route", routeValue), provider: { generateStructured: async () => new Promise<never>(() => undefined) } }) } };
    await expect(runStructuredInference(request(), { maximumAttempts: 1, maximumTokens: 120, maximumCost: 1, timeoutMs: 5, retry: [], replay: "deny" }, hanging)).rejects.toMatchObject({ code: "inference-timeout" });
  });
});
