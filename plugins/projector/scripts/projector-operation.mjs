#!/usr/bin/env node
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const maximumRequestBytes = 8 * 1024 * 1024;
const pluginRoot = resolve(import.meta.dirname, "..");
const packagedRoot = resolve(pluginRoot, "runtime/projector");

async function readBoundedStdin() {
  const chunks = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > maximumRequestBytes) throw new Error(`Projector operation request exceeds ${maximumRequestBytes} bytes`);
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function requestSource() {
  if (process.argv.length > 3) throw new Error("usage: projector-operation.mjs [request.json]");
  if (process.argv[2] === undefined) return readBoundedStdin();
  const requestPath = resolve(process.argv[2]);
  const pathStatus = await lstat(requestPath);
  if (pathStatus.isSymbolicLink()) throw new Error("Projector operation request must not be a symbolic link");
  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  const handle = await open(requestPath, constants.O_RDONLY | noFollow);
  try {
    const status = await handle.stat();
    if (!status.isFile()) throw new Error("Projector operation request must be a regular file");
    if (status.dev !== pathStatus.dev || status.ino !== pathStatus.ino) throw new Error("Projector operation request identity changed before reading");
    if (status.size > maximumRequestBytes) throw new Error(`Projector operation request exceeds ${maximumRequestBytes} bytes`);
    const bytes = Buffer.allocUnsafe(maximumRequestBytes + 1);
    let length = 0;
    while (length < bytes.length) {
      const result = await handle.read(bytes, length, bytes.length - length, null);
      if (result.bytesRead === 0) break;
      length += result.bytesRead;
    }
    if (length > maximumRequestBytes) throw new Error(`Projector operation request exceeds ${maximumRequestBytes} bytes`);
    return bytes.subarray(0, length).toString("utf8");
  } finally {
    await handle.close();
  }
}

async function main() {
  const nodeMajor = Number.parseInt(process.versions.node.split(".", 1)[0] ?? "", 10);
  if (!Number.isInteger(nodeMajor) || nodeMajor < 24) throw new Error(`Projector requires Node 24 or later on PATH; resolved ${process.version}.`);
  const request = JSON.parse(await requestSource());
  const moduleUrl = pathToFileURL(resolve(packagedRoot, "exports/operations.js")).href;
  const { createBundledProjectorOperationRunner } = await import(moduleUrl);
  if (typeof createBundledProjectorOperationRunner !== "function") throw new Error("The installed Projector package does not export its operation runner");
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort(new DOMException("Host cancelled Projector operation", "AbortError"));
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  try {
    const runner = await createBundledProjectorOperationRunner({
      packagedRoot,
    });
    const result = await runner.execute(request, { signal: cancellation.signal, environment: process.env });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return result.exitCode;
  } finally {
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
  }
}

main().then(
  (exitCode) => { process.exitCode = exitCode; },
  (error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  },
);
