#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

try {
  const nodeMajor = Number.parseInt(process.versions.node.split(".", 1)[0] ?? "", 10);
  if (!Number.isInteger(nodeMajor) || nodeMajor < 24) throw new Error(`Projector requires Node 24 or later; found ${process.version}`);
  const packagedRoot = resolve(import.meta.dirname, "../runtime/projector");
  const { createBundledProjectorOperationRunner } = await import(pathToFileURL(resolve(packagedRoot, "exports/operations.js")).href);
  const { runPublicCommand } = await import(pathToFileURL(resolve(packagedRoot, "exports/commands.js")).href);
  const runner = await createBundledProjectorOperationRunner({ packagedRoot });
  const result = await runPublicCommand(process.argv.slice(2), { runner, cwd: process.cwd() });
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
} catch (error) {
  process.stderr.write(`Projector: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
}
