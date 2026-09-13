import { withObservationScope } from "@projector/runtime";
import { test } from "vitest";

/** Complete workflows get a 30s outer guard; owned observation work is cancelled and awaited first. */
export function integrationTest(name, run) {
  test(name, async (context) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error("Integration workflow exceeded its 27 second work deadline")), 27_000);
    try {
      await withObservationScope({ signal: controller.signal, limits: { timeoutMs: 27_000 } }, () => run(context));
      controller.signal.throwIfAborted();
    } finally {
      // Awaited observation failures drain workers and owned processes before fixture cleanup.
      clearTimeout(timeout);
    }
  }, 30_000);
}
