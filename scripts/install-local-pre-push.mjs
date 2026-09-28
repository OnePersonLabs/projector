import { access, chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve, relative, isAbsolute } from "node:path";
import { executeReleaseCommand } from "./npm-command.mjs";

const root = (await executeReleaseCommand("git", ["rev-parse", "--show-toplevel"])).stdout.trim();
const hookDirectory = resolve(root, (await executeReleaseCommand("git", ["rev-parse", "--path-format=absolute", "--git-path", "hooks"], { cwd: root })).stdout.trim());
const commonDirectory = resolve(root, (await executeReleaseCommand("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: root })).stdout.trim());
const inside = (parent, child) => { const path = relative(parent, child); return !isAbsolute(path) && path !== ".." && !path.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`); };
if (!inside(root, hookDirectory) && !inside(commonDirectory, hookDirectory)) throw new Error("The effective hooks directory is outside this repository. Configure a repository-local hooks directory before installing; shared global hooks are not overwritten.");
if (process.platform === "win32") await executeReleaseCommand("git", ["config", "--local", "core.longpaths", "true"], { cwd: root });
const hook = join(hookDirectory, "pre-push");
const preserved = join(hookDirectory, "pre-push.projector-original");
const marker = "# Projector local pre-push v1";
let previous;
try { previous = await readFile(hook, "utf8"); }
catch (error) { if (error.code !== "ENOENT") throw error; }
if (previous?.includes(marker)) {
  console.log(`Projector pre-push is already installed: ${hook}`);
} else {
  await mkdir(hookDirectory, { recursive: true });
  if (previous !== undefined) {
    try { await access(preserved); throw new Error(`Refusing to overwrite preserved hook: ${preserved}`); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    await rename(hook, preserved);
  }
  const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
  const content = `#!/bin/sh\n${marker}\nexec ${quote(process.execPath.replaceAll("\\", "/"))} ${quote(join(root, "scripts", "local-pre-push.mjs").replaceAll("\\", "/"))} "$@"${previous === undefined ? "" : ` ${quote(preserved.replaceAll("\\", "/"))}`}\n`;
  let written = false;
  try { await writeFile(hook, content, { flag: "wx", mode: 0o755 }); written = true; await chmod(hook, 0o755); }
  catch (error) {
    if (written) { const { rm } = await import("node:fs/promises"); await rm(hook); }
    if (previous !== undefined) await rename(preserved, hook);
    throw error;
  }
  console.log(`Installed local pre-push: ${hook}`);
}
