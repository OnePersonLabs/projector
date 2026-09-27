#!/usr/bin/env node
import { createRequire as __projectorCreateRequire } from "node:module"; const require = __projectorCreateRequire(import.meta.url);
import {
  runPublicCommand
} from "../chunks/shared-DTOWCEJ5.js";
import {
  createBundledProjectorOperationRunner
} from "../chunks/shared-EAF64WQH.js";
import "../chunks/shared-IS6JDIFX.js";
import "../chunks/shared-SFAAGYPE.js";
import "../chunks/shared-ZVAUVDKU.js";
import "../chunks/shared-NAF7P2ZX.js";
import "../chunks/shared-7TU7H6FV.js";
import "../chunks/shared-BDBDN4N7.js";
import "../chunks/shared-JZDJZQHJ.js";
import "../chunks/shared-UXWNVNBJ.js";
import "../chunks/shared-UF33E7SL.js";
import "../chunks/shared-XUCQQRWD.js";
import "../chunks/shared-E2ZEUURS.js";
import "../chunks/shared-OYZBO5ZA.js";
import "../chunks/shared-HODAXZKW.js";
import "../chunks/shared-3WNQLUKU.js";
import "../chunks/shared-GHTLNEBM.js";
import "../chunks/shared-IFURLTPX.js";
import "../chunks/shared-FZTNE5ZL.js";
import "../chunks/shared-RWHW46VO.js";
import "../chunks/shared-GHDUIXJM.js";
import "../chunks/shared-UX72GU5O.js";
import "../chunks/shared-ZKECJVYF.js";
import "../chunks/shared-6VIFAIKJ.js";

// dist/command-main.mjs
import { fileURLToPath } from "node:url";
try {
  const packagedRoot = fileURLToPath(new URL("..", import.meta.url));
  const runner = await createBundledProjectorOperationRunner({ packagedRoot });
  const result = await runPublicCommand(process.argv.slice(2), { runner, cwd: process.cwd() });
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
} catch (error) {
  process.stderr.write(String(error.message ?? error) + "\n");
  process.exitCode = 2;
}
