#!/usr/bin/env node
import { readFile } from "node:fs/promises";
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
  const bytes = await readFile(resolve(process.argv[2]));
  if (bytes.length > maximumRequestBytes) throw new Error(`Projector operation request exceeds ${maximumRequestBytes} bytes`);
  return bytes.toString("utf8");
}

async function main() {
  if (!/^24\./u.test(process.versions.node)) throw new Error(`Projector requires Node 24 on PATH; resolved ${process.version}.`);
  const request = JSON.parse(await requestSource());
  const moduleUrl = pathToFileURL(resolve(packagedRoot, "exports/operations.js")).href;
  const { createBundledProjectorOperationRunner } = await import(moduleUrl);
  if (typeof createBundledProjectorOperationRunner !== "function") throw new Error("The installed Projector package does not export its operation runner");
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort(new DOMException("Host cancelled Projector operation", "AbortError"));
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  try {
    const runner = await createBundledProjectorOperationRunner({ packagedRoot });
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
