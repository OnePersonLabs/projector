import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { join, resolve } from "node:path";

const pluginRoot = resolve(import.meta.dirname, "..");

async function readable(path) {
  try { await access(path, constants.R_OK); return true; }
  catch { return false; }
}

/** Resolve only an explicit CLI, this plugin's packaged runtime, or PATH. */
export async function projectorRuntime() {
  const configured = process.env.PROJECTOR_CLI?.trim();
  const packagedCli = join(pluginRoot, "runtime", "projector", "bin", "projector.js");
  const cli = configured || (await readable(packagedCli) ? packagedCli : "projector");
  if (!/\.(?:c|m)?js$/u.test(cli)) return { executable: cli, prefix: [], cli };

  const packagedNode = join(pluginRoot, "runtime", "node", process.platform === "win32" ? "node.exe" : "node");
  const executable = await readable(packagedNode) ? packagedNode : process.execPath;
  if (executable === process.execPath && Number(process.versions.node.split(".")[0]) !== 24) {
    throw new Error("Projector requires Node 24. Use its packaged plugin runtime or launch this script with Node 24.");
  }
  return { executable, prefix: [cli], cli };
}
