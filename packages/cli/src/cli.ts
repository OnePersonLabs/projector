#!/usr/bin/env node
import { pathToFileURL } from "node:url";

export const PROJECTOR_VERSION = "2.0.0";

const HELP = `Projector ${PROJECTOR_VERSION}

Usage: projector [--help] [--version]

Options:
  -h, --help     Show this help text
  -v, --version  Show the Projector version`;

export function renderCli(arguments_: readonly string[]): string {
  if (arguments_.length === 0 || arguments_.includes("--help") || arguments_.includes("-h")) {
    return HELP;
  }
  if (arguments_.includes("--version") || arguments_.includes("-v")) {
    return PROJECTOR_VERSION;
  }
  throw new Error(`unknown argument: ${arguments_[0] ?? ""}`);
}

export function main(arguments_ = process.argv.slice(2)): number {
  try {
    process.stdout.write(`${renderCli(arguments_)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
