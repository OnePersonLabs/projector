import { describe, expect, test } from "vitest";
import { currentObservationScope, withObservationScope } from "./observation-scope.js";

describe("observation scope", () => {
  test("preserves nested caller cancellation instead of an IO wrapper failure", async () => {
    const controller = new AbortController();
    await expect(withObservationScope({}, () => withObservationScope({ signal: controller.signal }, async () => {
      controller.abort();
      throw new Error("wrapped IO cancellation");
    }))).rejects.toMatchObject({ name: "AbortError" });
  });
  test("drains scope-owned resources on failure, including registrations through a nested signal", async () => {
    const events: string[] = [];
    await expect(withObservationScope({}, async (scope) => {
      await withObservationScope({ signal: new AbortController().signal }, async (nested) => {
        nested.registerCleanup(async () => { expect(scope.isActive()).toBe(false); events.push("drained"); });
      });
      throw new Error("failed observation");
    })).rejects.toThrow("failed observation");
    expect(events).toEqual(["drained"]);
  });
  test("shares finite budgets across secondary and nested work without leaking to other operations", async () => {
    await withObservationScope({ limits: { maxFiles: 2 } }, async (scope) => {
      expect(currentObservationScope()).toBe(scope);
      scope.budget.consume("maxFiles", 2, "inventory");
      await withObservationScope({ limits: { maxFiles: 100 } }, async (nested) => {
        expect(nested).toBe(scope);
        expect(() => nested.budget.consume("maxFiles", 1, "secondary-read"))
          .toThrow(/maxFiles/);
      });
    });
    expect(currentObservationScope()).toBeUndefined();
    await withObservationScope({ limits: { maxFiles: 2 } }, async (scope) => {
      expect(() => scope.budget.consume("maxFiles", 2, "inventory")).not.toThrow();
    });
  });

  test("rejects cancellation before invoking an observer", async () => {
    const controller = new AbortController();
    controller.abort();
    let invoked = false;
    await expect(Promise.resolve().then(() => withObservationScope({ signal: controller.signal }, async () => {
      invoked = true;
    }))).rejects.toMatchObject({ name: "AbortError" });
    expect(invoked).toBe(false);
  });
});
