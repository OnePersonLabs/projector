import type { ObservationScope } from "@projector/runtime";

/** A caller deadline can exceed Node's maximum single timer delay. Reschedule
 * until the actual deadline instead of converting an unlimited run to a timer. */
export function observationHostSignal(scope: ObservationScope, caller: AbortSignal): { signal: AbortSignal; close: () => void } {
  const deadline = scope.deadline;
  if (!Number.isFinite(deadline)) return { signal: AbortSignal.any([scope.signal, caller]), close() {} };

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = (): void => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      controller.abort(new Error("Observation deadline exceeded"));
      return;
    }
    timer = setTimeout(schedule, Math.min(remaining, 2_147_483_647));
    timer.unref();
  };
  schedule();
  return {
    signal: AbortSignal.any([scope.signal, caller, controller.signal]),
    close() { if (timer !== undefined) clearTimeout(timer); },
  };
}
