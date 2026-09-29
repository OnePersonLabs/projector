#!/usr/bin/env node
import {
  runPublicCommand
} from "../chunks/shared-UBKINRJT.js";
import {
  createBundledProjectorOperationRunner
} from "../chunks/shared-DF226XHO.js";
import "../chunks/shared-KP2KQVTQ.js";
import "../chunks/shared-QC25VWUM.js";
import "../chunks/shared-VSPYHD5H.js";
import "../chunks/shared-IBVT2KG2.js";
import "../chunks/shared-CPHR3K42.js";
import "../chunks/shared-4VMBTM7P.js";
import "../chunks/shared-DGXUSCZI.js";
import "../chunks/shared-ZHCNFIWV.js";
import "../chunks/shared-ZG4NJD52.js";
import "../chunks/shared-EMQJ4CG6.js";
import "../chunks/shared-4GV3JCWN.js";
import "../chunks/shared-WPJ24CHV.js";
import "../chunks/shared-SRZY32OS.js";
import "../chunks/shared-BEDSHOK5.js";
import "../chunks/shared-JM234DST.js";
import "../chunks/shared-AIE6IGAJ.js";
import "../chunks/shared-I4PDDX5T.js";
import "../chunks/shared-YP2F3RSX.js";
import "../chunks/shared-3OPGBX4O.js";
import "../chunks/shared-QSFRBEBN.js";
import "../chunks/shared-BGCYVYNK.js";
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
