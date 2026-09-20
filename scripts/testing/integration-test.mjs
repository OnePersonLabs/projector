import { withObservationScope } from "@projector/runtime";
import { test } from "vitest";

/** Complete workflows get a generous outer guard; owned work is cancelled and awaited first. */
export function integrationTest(name, run) {
  test(name, async (context) => {
    const controller = new AbortController();
    const workDeadlineMs = 297_000;
    const warning = setTimeout(() => console.warn(`SLOW INTEGRATION TEST: ${name} has exceeded 30 seconds`), 30_000);
    const timeout = setTimeout(() => controller.abort(new Error(`Integration workflow exceeded its ${workDeadlineMs}ms work deadline`)), workDeadlineMs);
    try {
      await withObservationScope({ signal: controller.signal, limits: { timeoutMs: workDeadlineMs } }, () => run(context));
      controller.signal.throwIfAborted();
    } finally {
      // Awaited observation failures drain workers and owned processes before fixture cleanup.
      clearTimeout(warning);
      clearTimeout(timeout);
    }
  }, 300_000);
}
