#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const nodeMajor = Number.parseInt(process.versions.node.split(".", 1)[0] ?? "", 10);
if (!Number.isInteger(nodeMajor) || nodeMajor < 24) throw new Error(`Projector requires Node 24 or later on PATH; resolved ${process.version}.`);

const packagedRoot = resolve(import.meta.dirname, "../runtime/projector");
const moduleUrl = pathToFileURL(resolve(packagedRoot, "exports/mcp.js")).href;
const { serveProjectorMcpStdio } = await import(moduleUrl);
if (typeof serveProjectorMcpStdio !== "function") throw new Error("The installed Projector package does not export its MCP server");
const host = serveProjectorMcpStdio({ packagedRoot, environment: process.env });
const close = () => { void host.close().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 2; }); };
process.once("SIGINT", close);
process.once("SIGTERM", close);
