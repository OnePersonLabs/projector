import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  createApplicationObservationContractSchemas,
  hashApplicationObservationInput,
  hashApplicationObservationOutput,
} from "./index.js";

describe("application observation contract factory", () => {
  const adapterId = "psychord-browser";
  const adapterVersion = "1.0.0";
  const inputSchema = z.strictObject({ repositoryHead: z.string().regex(/^[a-f0-9]{40}$/u), expectedOrigin: z.string().url() });
  const outputSchema = z.strictObject({ actualOrigin: z.string().url(), assertionsPassed: z.boolean() });
  const schemas = createApplicationObservationContractSchemas({ adapterId, adapterVersion, adapterInputSchema: inputSchema, adapterOutputSchema: outputSchema });
  const hash = `sha256:v1:${"a".repeat(64)}` as const;
  const adapterInput = { repositoryHead: "b".repeat(40), expectedOrigin: "http://127.0.0.1:4173" };
  const adapterOutput = { actualOrigin: "http://127.0.0.1:4173", assertionsPassed: true };
  const plan = {
    schemaVersion: "application-observation-plan@1",
    runId: "run:psychord-1",
    scenario: { id: "scenario:play-note", semanticHash: hash },
    case: "case:note-round-trip",
    adapter: { id: adapterId, version: adapterVersion, inputHash: hashApplicationObservationInput(adapterId, adapterVersion, adapterInput), input: adapterInput },
  } as const;
  const result = {
    schemaVersion: "application-observation-result@1",
    runId: plan.runId,
    scenario: plan.scenario,
    case: plan.case,
    adapter: { id: adapterId, version: adapterVersion, inputHash: plan.adapter.inputHash, outputHash: hashApplicationObservationOutput(adapterId, adapterVersion, adapterOutput), output: adapterOutput },
    operationalStatus: "completed",
    outcome: "passed",
    currentness: "current",
    assurance: "supporting",
    diagnostics: [],
    cleanup: { complete: true, resources: [], diagnostics: [] },
  } as const;

  it("accepts exact adapter-bound plan and result values", () => {
    expect(schemas.ApplicationObservationPlanSchema.safeParse(plan).success).toBe(true);
    expect(schemas.ApplicationObservationResultSchema.safeParse(result).success).toBe(true);
    expect(schemas.ApplicationObservationExchangeSchema.safeParse({ plan, result }).success).toBe(true);
  });

  it("rejects opaque, mismatched, stale, and unrecoverable evidence", () => {
    expect(schemas.ApplicationObservationPlanSchema.safeParse({ ...plan, adapter: { ...plan.adapter, input: { ...adapterInput, hidden: true } } }).success).toBe(false);
    expect(schemas.ApplicationObservationPlanSchema.safeParse({ ...plan, adapter: { ...plan.adapter, inputHash: hash } }).success).toBe(false);
    expect(schemas.ApplicationObservationResultSchema.safeParse({ ...result, adapter: { ...result.adapter, outputHash: hash } }).success).toBe(false);
    expect(schemas.ApplicationObservationResultSchema.safeParse({ ...result, currentness: "stale" }).success).toBe(false);
    expect(schemas.ApplicationObservationResultSchema.safeParse({ ...result, cleanup: { ...result.cleanup, complete: false } }).success).toBe(false);
    expect(schemas.ApplicationObservationResultSchema.safeParse({ ...result, operationalStatus: "cancelled" }).success).toBe(false);
    expect(schemas.ApplicationObservationResultSchema.safeParse({ ...result, adapter: { ...result.adapter, output: { ...adapterOutput, hidden: true } } }).success).toBe(false);
    expect(schemas.ApplicationObservationExchangeSchema.safeParse({ plan, result: { ...result, runId: "run:other" } }).success).toBe(false);
    expect(schemas.ApplicationObservationExchangeSchema.safeParse({ plan, result: { ...result, adapter: { ...result.adapter, inputHash: hash } } }).success).toBe(false);
    const incomplete = { ...result, operationalStatus: "failed", outcome: "unavailable", cleanup: { complete: false, resources: [{ kind: "server", handle: "pid:123", outcome: "retained-for-recovery" }], diagnostics: [] }, recovery: { code: "server-retained", message: "The server remains owned.", action: "Terminate the recorded process.", artifactRefs: [] } } as const;
    expect(schemas.ApplicationObservationResultSchema.safeParse(incomplete).success).toBe(true);
    expect(schemas.ApplicationObservationResultSchema.safeParse({ ...incomplete, cleanup: { ...incomplete.cleanup, complete: true } }).success).toBe(false);
  });
});
