import { expect, it } from "vitest";
import { resolveObservationLimits } from "@projector/core";
import { runObservationTask } from "./task-runner.js";

it("cancels a running reverse-import computation and drains its worker", async () => {
  const count = 20_000;
  const controller = new AbortController();
  let started = false;
  await expect(runObservationTask("change-relevance", {
    editedPaths: ["0"],
    observation: { analysis: {
      dependencies: Array.from({ length: count }, (_, index) => ({ importerPath: String(count - index), resolvedPath: String(count - index - 1) })),
      projectionUnits: [], failures: [], javaScript: { files: [] },
      surface: { id: "surface:test", enumeration: { observability: "closed", method: "fixture", assumptions: [], blindSpots: [], dynamicMechanisms: [] } },
    } },
  }, {
    limits: resolveObservationLimits(), deadline: Date.now() + 10_000, signal: controller.signal,
    onWorkerStarted() { started = true; controller.abort(new Error("cancel reverse imports")); },
  })).rejects.toThrow("cancel reverse imports");
  expect(started).toBe(true);
  expect(await runObservationTask("hash-content", { content: "after cancellation" }, { limits: resolveObservationLimits(), deadline: Date.now() + 10_000 })).toMatch(/^sha256:v1:/u);
});
