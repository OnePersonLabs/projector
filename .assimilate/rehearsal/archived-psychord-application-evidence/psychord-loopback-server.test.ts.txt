import { getEventListeners } from "node:events";
import { createServer } from "node:http";
import { createServer as createTcpServer } from "node:net";

import { expect, it } from "vitest";

import { listenOnPlannedLoopback } from "./psychord-loopback-server.js";

it("observes server closure when cancellation wins before the listening callback", async () => {
  const port = await availablePort();
  const server = createServer();
  const initialListeners = {
    listening: server.listenerCount("listening"),
    close: server.listenerCount("close"),
    error: server.listenerCount("error"),
  };
  const controller = new AbortController();
  const listening = listenOnPlannedLoopback(server, {
    server: { expectedOrigin: `http://127.0.0.1:${port}` },
  }, controller.signal);
  controller.abort(new Error("cancel startup"));

  await expect(listening).rejects.toThrow("cancel startup");
  expect(server.listening).toBe(false);
  expect(server.listenerCount("listening")).toBe(initialListeners.listening);
  expect(server.listenerCount("close")).toBe(initialListeners.close);
  expect(server.listenerCount("error")).toBe(initialListeners.error);
  expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);

  const probe = createTcpServer();
  await new Promise<void>((resolvePromise, reject) => {
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", resolvePromise);
  });
  await new Promise<void>((resolvePromise, reject) => probe.close((error) => error === undefined ? resolvePromise() : reject(error)));
});

async function availablePort(): Promise<number> {
  const probe = createTcpServer();
  await new Promise<void>((resolvePromise, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = probe.address();
  if (address === null || typeof address === "string") throw new Error("test probe has no TCP port");
  await new Promise<void>((resolvePromise, reject) => probe.close((error) => error === undefined ? resolvePromise() : reject(error)));
  return address.port;
}
