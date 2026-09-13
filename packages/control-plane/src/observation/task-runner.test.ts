import { describe, expect, it } from "vitest";
import { resolveObservationLimits } from "@projector/core";
import { withObservationScope } from "@projector/runtime";
import { runObservationTask } from "./task-runner.js";

const limits = resolveObservationLimits();
describe("terminable observation worker", () => {
  it("reports worker heap exhaustion as a structured observation limit", async () => {
    await expect(runObservationTask("canonical", { sources: [] }, {
      limits, deadline: Date.now() + 10_000, maxWorkerHeapMiB: 4,
    })).rejects.toMatchObject({ code: "observation-limit-exceeded", limit: "maxWorkerHeapMiB" });
    expect((await runObservationTask("canonical", { sources: [] }, { limits, deadline: Date.now() + 10_000 })).documents).toEqual([]);
  });
  it("reuses loaded worker code within one scope and disposes it before the next scope", async () => {
    const workers: number[] = [];
    await withObservationScope({}, async (scope) => {
      for (let index = 0; index < 2; index += 1) {
        await runObservationTask("hash-content", { content: "same input" }, { ...scope, onWorkerStarted: (id) => { workers.push(id); } });
      }
    });
    await withObservationScope({}, async (scope) => {
      await runObservationTask("hash-content", { content: "same input" }, { ...scope, onWorkerStarted: (id) => { workers.push(id); } });
    });
    expect(workers).toHaveLength(3);
    expect(workers[0]).toBe(workers[1]);
    expect(workers[2]).not.toBe(workers[0]);
  });
  it("parses canonical observations using the compiled shipped worker", async () => {
    const result = await runObservationTask("canonical", { sources: [] }, { limits, deadline: Date.now() + 10_000 });
    expect(result.documents).toEqual([]);
    expect(result.entries).toEqual([]);
    expect(result.rootDigest).toMatch(/^sha256:v1:[0-9a-f]{64}$/u);
  });

  it("rejects an oversized derived response instead of publishing it", async () => {
    await expect(runObservationTask("canonical", { sources: [] }, { limits, deadline: Date.now() + 10_000, maxDerivedBytes: 32 }))
      .rejects.toThrow(/derived-data limit/u);
  });

  it("terminates and drains a worker before returning a cancellation", async () => {
    const controller = new AbortController();
    const pending = runObservationTask("canonical", { sources: [] }, { limits, deadline: Date.now() + 10_000, signal: controller.signal });
    controller.abort(new Error("cancel observation"));
    await expect(pending).rejects.toThrow("cancel observation");
    // A subsequent task succeeds after the first worker has been drained.
    expect((await runObservationTask("canonical", { sources: [] }, { limits, deadline: Date.now() + 10_000 })).documents).toEqual([]);
  });

  it("enforces the shared deadline while a real worker is active", async () => {
    await expect(runObservationTask("canonical", { sources: [] }, { limits, deadline: Date.now() + 10 })).rejects.toThrow(/deadline/u);
  });

  it("interrupts synchronous TOML parsing after worker startup", async () => {
    const controller = new AbortController();
    let started = false;
    const source = `value = [${"0,".repeat(2_000_000)}0]`;
    await expect(runObservationTask("canonical", { sources: [{ path: "input.concept.toml", relativePath: "model/concepts/input.concept.toml", source }] }, {
      limits, deadline: Date.now() + 10_000, signal: controller.signal,
      onWorkerStarted() { started = true; controller.abort(new Error("cancel synchronous parsing")); },
    })).rejects.toThrow("cancel synchronous parsing");
    expect(started).toBe(true);
  });
});
