#!/usr/bin/env node
import {
  runPublicCommand
} from "../chunks/shared-UBKINRJT.js";
import {
  createBundledProjectorOperationRunner
} from "../chunks/shared-PO727SLG.js";
import "../chunks/shared-7TNVZRWS.js";
import "../chunks/shared-PBCNT5ED.js";
import "../chunks/shared-7F6QD6HY.js";
import "../chunks/shared-53T52QIE.js";
import "../chunks/shared-XO4N5UQ4.js";
import "../chunks/shared-4VMBTM7P.js";
import "../chunks/shared-T7I2XRNT.js";
import "../chunks/shared-A4MG5XTQ.js";
import "../chunks/shared-NNEVKOIJ.js";
import "../chunks/shared-F4F42JVN.js";
import "../chunks/shared-HMB6GHHY.js";
import "../chunks/shared-RLI43OE3.js";
import "../chunks/shared-SRZY32OS.js";
import "../chunks/shared-3WBVMTX7.js";
import "../chunks/shared-HCFZBUVW.js";
import "../chunks/shared-A7FXFSCG.js";
import "../chunks/shared-VH32AY4L.js";
import "../chunks/shared-K5SAD5NH.js";
import "../chunks/shared-3OPGBX4O.js";
import "../chunks/shared-QSFRBEBN.js";
import "../chunks/shared-XAKKJSHO.js";
import "../chunks/shared-XN3IZTFL.js";
import "../chunks/shared-EK2KJXX2.js";
import "../chunks/shared-53BCDAHA.js";
import "../chunks/shared-JRUJSZFM.js";
import "../chunks/shared-RMBXVF7C.js";
import "../chunks/shared-Q56AARV7.js";
import "../chunks/shared-WC2OT3WX.js";

// dist/command-main.mjs
import { fileURLToPath } from "node:url";
try {
  const packagedRoot = fileURLToPath(new URL("..", import.meta.url));
  const runner = await createBundledProjectorOperationRunner({ packagedRoot });
  const result = await runPublicCommand(process.argv.slice(2), { runner: { execute: (request) => runner.execute(request, { environment: process.env }) }, cwd: process.cwd() });
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
} catch (error) {
  process.stderr.write(String(error.message ?? error) + "\n");
  process.exitCode = 2;
}
