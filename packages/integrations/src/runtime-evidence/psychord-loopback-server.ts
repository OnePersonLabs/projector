import type { Server } from "node:http";

export async function listenOnPlannedLoopback(
  server: Server,
  plan: { readonly server: { readonly expectedOrigin: string } },
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  const origin = new URL(plan.server.expectedOrigin);
  await new Promise<void>((resolvePromise, rejectPromise) => {
    let aborted = false;
    const cleanup = (): void => {
      signal.removeEventListener("abort", abort);
      server.removeListener("listening", listening);
      server.removeListener("close", closed);
      server.removeListener("error", failed);
    };
    const settle = (operation: () => void): void => {
      cleanup();
      operation();
    };
    const failed = (error: Error): void => settle(() => rejectPromise(error));
    const closed = (): void => settle(() => rejectPromise(
      aborted ? signal.reason ?? new Error("server start aborted") : new Error("server closed before listening"),
    ));
    const listening = (): void => {
      if (aborted) {
        server.close();
        return;
      }
      settle(resolvePromise);
    };
    const abort = (): void => {
      aborted = true;
      try { server.close(); }
      catch (error) { failed(error instanceof Error ? error : new Error(String(error))); }
    };
    signal.addEventListener("abort", abort, { once: true });
    server.once("listening", listening);
    server.once("close", closed);
    server.once("error", failed);
    if (signal.aborted) {
      cleanup();
      rejectPromise(signal.reason ?? new Error("server start aborted"));
      return;
    }
    server.listen(Number(origin.port), origin.hostname);
  });
}
