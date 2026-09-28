import { expect, test } from "vitest";
import { withObservationScope } from "@projector/runtime";
import { observationHostSignal } from "./deadline-signal.js";

test("unlimited host work has no timer and still receives caller cancellation", async () => {
  await withObservationScope({}, async (scope) => {
    const caller = new AbortController();
    const host = observationHostSignal(scope, caller.signal);
    try {
      expect(scope.deadline).toBe(Number.POSITIVE_INFINITY);
      expect(host.signal.aborted).toBe(false);
      caller.abort(new Error("cancel host read"));
      expect(host.signal.aborted).toBe(true);
    } finally { host.close(); }
  });
});
