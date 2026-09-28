import { mkdtemp, mkdir, writeFile, rm, access, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, dirname, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { executeReleaseCommand, isReleaseCommandCleanupUnconfirmed } from "./npm-command.mjs";

const zero = (value) => /^0+$/u.test(value);
export function parsePushInput(input) {
  return input.split(/\r?\n/u).filter(Boolean).map((line) => {
    const fields = line.split(" ");
    if (fields.length !== 4) throw new Error("Malformed pre-push input: expected four fields");
    const [localRef, localOid, remoteRef, remoteOid] = fields;
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(localOid) || remoteOid.length !== localOid.length || !/^[a-f0-9]+$/u.test(remoteOid) || !remoteRef.startsWith("refs/") || !localRef) throw new Error("Malformed pre-push ref or object identity");
    if (zero(localOid) !== (localRef === "(delete)")) throw new Error("Malformed pre-push deletion");
    return { localRef, localOid, remoteRef, remoteOid };
  });
}
export function selectPushChecks(paths) {
  return paths?.length > 0 && paths.every((path) => /^docs\/[^\0]+\.md$/u.test(path))
    ? ["build", "spec:check"] : ["build", "verify", "release:check"];
}
async function pnpmCommand(args) {
  if (process.platform !== "win32") return { file: "pnpm", args };
  const path = Object.entries(process.env).find(([key]) => key.toLowerCase() === "path")?.[1] ?? "";
  for (const entry of path.split(delimiter)) {
    if (!entry) continue;
    let hasShim = false;
    for (const name of ["pnpm.exe", "pnpm.cmd", "pnpm.ps1", "pnpm"]) {
      try { await access(join(entry, name)); hasShim = true; break; }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    if (!hasShim) continue;
    const candidates = [join(entry, "pnpm.exe"), join(entry, "node_modules", "pnpm", "bin", "pnpm.cjs")];
    for (const packageName of ["pnpm", "corepack"]) {
      const packageRoot = join(entry, "node_modules", packageName);
      let manifest;
      try { manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")); }
      catch (error) { if (error.code === "ENOENT") continue; throw error; }
      const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.pnpm;
      if (typeof bin === "string") candidates.push(resolve(packageRoot, bin));
    }
    for (const candidate of candidates) {
      try {
        await access(candidate);
        if (/\.exe$/iu.test(candidate)) return { file: candidate, args };
        if (/\.(?:cjs|mjs|js)$/iu.test(candidate)) return { file: process.execPath, args: [candidate, ...args] };
        throw new Error(`Unsupported Windows pnpm package executable: ${candidate}`);
      } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
  }
  throw new Error("A native pnpm executable or pnpm/Corepack package bin is missing from PATH; install the package.json packageManager version");
}

export async function verifyPush({ root, remote, input, run = executeReleaseCommand, runChecks }) {
  const refs = parsePushInput(input);
  if (refs.length === 0) return;
  const environment = { ...process.env };
  const localVariables = (await run("git", ["rev-parse", "--local-env-vars"], { cwd: root })).stdout;
  for (const name of localVariables.trim().split("\n")) delete environment[name.trim()];
  const git = async (args, cwd = root) => (await run("git", args, { cwd, env: environment })).stdout;
  const checkRemote = async () => {
    const actual = new Map((await git(["ls-remote", "--refs", "--", remote, ...refs.map((ref) => ref.remoteRef)]))
      .trim().split("\n").filter(Boolean).map((line) => { const [oid, name] = line.trim().split(/\s+/u); return [name, oid]; }));
    for (const ref of refs) if ((actual.get(ref.remoteRef) ?? "0".repeat(ref.remoteOid.length)) !== ref.remoteOid) throw new Error(`Destination changed since push advertisement: ${ref.remoteRef}; retry the push`);
  };
  await checkRemote();
  const workspace = await mkdtemp(join(tmpdir(), "projector-pre-push-"));
  const clone = join(workspace, "checkout");
  let cleanupConfirmed = true;
  try {
    await git(["clone", ...(process.platform === "win32" ? ["-c", "core.longpaths=true"] : []), "--shared", "--no-checkout", "--", root, clone]);
    const commits = new Map();
    for (const ref of refs.filter((ref) => !zero(ref.localOid))) {
      const commit = (await git(["rev-parse", "--verify", `${ref.localOid}^{commit}`])).trim();
      let paths = null;
      if (!zero(ref.remoteOid)) {
        // A missing advertised base is uncertainty, not an empty selection.
        let available;
        try { available = (await git(["rev-parse", "--verify", "--quiet", "--end-of-options", `${ref.remoteOid}^{commit}`])).trim(); }
        catch (error) {
          if (!((error.code === 1 || error.status === 1) && !String(error.stderr ?? "").trim())) throw error;
        }
        if (available !== undefined) {
          paths = (await git(["diff", "--name-only", "-z", ref.remoteOid, commit, "--"])).split("\0").filter(Boolean);
        }
      }
      const checks = selectPushChecks(paths);
      const prior = commits.get(commit);
      if (!prior || checks.includes("verify")) commits.set(commit, checks);
    }
    for (const [commit, checks] of commits) {
      await git(["checkout", "--detach", "--force", commit], clone);
      await git(["clean", "-ffdx"], clone);
      if (runChecks) await runChecks({ cwd: clone, commit, checks });
      else {
        for (const args of [["install", "--frozen-lockfile"], ...checks.map((check) => [check])]) {
          const command = await pnpmCommand(args);
          await run(command.file, command.args, { cwd: clone, env: environment, timeout: 1_800_000 });
        }
      }
    }
    await checkRemote();
  } catch (error) {
    cleanupConfirmed = !isReleaseCommandCleanupUnconfirmed(error);
    if (!cleanupConfirmed) error.message += `; retained checkout: ${workspace}`;
    throw error;
  } finally {
    if (cleanupConfirmed) await rm(workspace, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const input = Buffer.concat(chunks).toString("utf8");
  const [, , remoteName, remoteLocation, priorHook] = process.argv;
  const root = (await executeReleaseCommand("git", ["rev-parse", "--show-toplevel"])).stdout.trim();
  const logDirectory = join(root, ".temp", "local-pre-push");
  await mkdir(logDirectory, { recursive: true });
  const log = join(logDirectory, `${Date.now()}.log`);
  const evidence = [];
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort(new Error("Local pre-push verification cancelled"));
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  const run = async (file, args, options = {}) => {
    evidence.push(JSON.stringify({ file, args, cwd: options.cwd }));
    try {
      const result = await executeReleaseCommand(file, args, { ...options, signal: cancellation.signal });
      evidence.push(result.stdout, result.stderr);
      return result;
    } catch (error) { evidence.push(error.stdout ?? "", error.stderr ?? "", error.message); throw error; }
  };
  try {
    // Git supplies the same stream to the preserved hook before our check.
    if (priorHook) {
      const stdinFile = `${log}.stdin`;
      await writeFile(stdinFile, input);
      try {
        await run("git", ["-c", `core.hooksPath=${dirname(priorHook)}`, "hook", "run", "--allow-unknown-hook-name", `--to-stdin=${stdinFile}`, "pre-push.projector-original", "--", remoteName, remoteLocation], { cwd: root });
      } finally { await rm(stdinFile, { force: true }); }
    }
    await verifyPush({ root, remote: remoteLocation, input, run });
    console.error(`Local pre-push checks passed. Evidence: ${log}`);
  } catch (error) {
    console.error(`Local pre-push blocked: ${error.message}. Evidence: ${log}`);
    process.exitCode = 1;
  } finally {
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
    await writeFile(log, evidence.join("\n"));
  }
}
