#!/usr/bin/env node
import {
  runPublicCommand
} from "../chunks/shared-7NNPYQ64.js";
import {
  createBundledProjectorOperationRunner
} from "../chunks/shared-5FEUECAF.js";
import "../chunks/shared-HOCZL5MZ.js";
import "../chunks/shared-R7Q3INRD.js";
import "../chunks/shared-Z6IO2SZ3.js";
import "../chunks/shared-F7QIBUKX.js";
import "../chunks/shared-AE4LCZHI.js";
import "../chunks/shared-ZQJOKWDN.js";
import "../chunks/shared-RDKUY5LE.js";
import "../chunks/shared-5DRPCZRI.js";
import "../chunks/shared-KSINEUXG.js";
import "../chunks/shared-IYQMR2PN.js";
import "../chunks/shared-NMHHCCIJ.js";
import "../chunks/shared-SRZY32OS.js";
import "../chunks/shared-A2IBJY7A.js";
import "../chunks/shared-P2AMJQGE.js";
import "../chunks/shared-XUP2BAXD.js";
import "../chunks/shared-DJXEJPTL.js";
import "../chunks/shared-BRRTY4V2.js";
import "../chunks/shared-QJIGMBBX.js";
import "../chunks/shared-3OPGBX4O.js";
import "../chunks/shared-GXAKKSCS.js";
import "../chunks/shared-5EIJVVQJ.js";
import "../chunks/shared-XN3IZTFL.js";
import "../chunks/shared-53BCDAHA.js";
import "../chunks/shared-JRUJSZFM.js";
import "../chunks/shared-EK2KJXX2.js";
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
