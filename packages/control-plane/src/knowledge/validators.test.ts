import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ObservationError } from "@projector/core";
import { expect, test } from "vitest";
import { observeChangeRepository } from "../change-lifecycle/repository-observer.js";
import { KnowledgeValidatorRun } from "./validators.js";

test("secondary observation exhaustion escapes validator unknown handling", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-validator-bound-"));
  try {
    const observation = await observeChangeRepository(root);
    const failure = new ObservationError("observation-limit-exceeded", "validator-source", ".", "source limit exceeded");
    const run = new KnowledgeValidatorRun({ ...observation, independentValidator: async () => { throw failure; } }, new AbortController().signal);
    await expect(run.evaluate({
      unitId: "unit:fixture", unitPath: "fixture.ts",
      binding: { id: "validator:fixture", version: "1", provider: "repository-node", input: { path: "check.cjs" }, required: true },
    })).rejects.toBe(failure);
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5 });
  }
});
