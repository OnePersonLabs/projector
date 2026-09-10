import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { join, resolve } from "node:path";

const pluginRoot = resolve(import.meta.dirname, "..");

async function readable(path) {
  try { await access(path, constants.R_OK); return true; }
  catch { return false; }
}

/** Resolve an explicit or packaged Projector CLI and use the host PATH for Node. */
export async function projectorRuntime() {
  const configured = process.env.PROJECTOR_CLI?.trim();
  const packagedCli = join(pluginRoot, "runtime", "projector", "bin", "projector.js");
  const cli = configured || (await readable(packagedCli) ? packagedCli : "projector");
  if (!/\.(?:c|m)?js$/u.test(cli)) return { executable: cli, prefix: [], cli };

  const version = execFileSync("node", ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (!/^v24\./u.test(version)) throw new Error(`Projector requires Node 24 on PATH; resolved ${version || "an unknown version"}.`);
  return { executable: "node", prefix: [cli], cli };
}
