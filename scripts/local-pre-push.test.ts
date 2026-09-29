import { describe, expect, it } from "vitest";
import { parsePushInput, selectPushChecks, verifyPush } from "./local-pre-push.mjs";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, mkdir, readFile, readdir, rm, copyFile, chmod, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const a = "a".repeat(40), b = "b".repeat(40), zero = "0".repeat(40);
describe("local pre-push protocol and conservative selection", () => {
  it("parses multiple refs and deletion without replacing commit identities", () => {
    expect(parsePushInput(`HEAD~1 ${a} refs/heads/main ${b}\n(delete) ${zero} refs/heads/old ${b}\n`)).toEqual([
      { localRef: "HEAD~1", localOid: a, remoteRef: "refs/heads/main", remoteOid: b },
      { localRef: "(delete)", localOid: zero, remoteRef: "refs/heads/old", remoteOid: b },
    ]);
    expect(() => parsePushInput(`main ${a} refs/heads/main bad`)).toThrow();
  });
  it("widens missing/empty populations and all executable or instruction inputs", () => {
    for (const paths of [null, [], ["packages/core/src/index.ts"], ["pnpm-lock.yaml"], ["AGENTS.md"], ["docs/query.json"], ["docs/reference/new.txt"]]) {
      expect(selectPushChecks(paths)).toEqual(["build", "verify", "release:check"]);
    }
    expect(selectPushChecks(["docs/reference/cli.md"])).toEqual(["build", "spec:check"]);
  });
});

describe("actual committed trees and local remote lifecycle", () => {
  async function fixture(run: (fixture: { root: string; remote: string; base: string; tip: string; git: (args: string[], cwd?: string) => string }) => Promise<void>) {
    const parent = await mkdtemp(join(tmpdir(), "projector-hook-test-"));
    const root = join(parent, "source"), remote = join(parent, "remote.git");
    await mkdir(root);
    const git = (args: string[], cwd = root) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    try {
      git(["init", "--initial-branch=main"]);
      git(["config", "user.email", "fixture@example.test"]); git(["config", "user.name", "Fixture"]);
      await writeFile(join(root, "source.txt"), "base"); git(["add", "."]); git(["commit", "-m", "base"]);
      const base = git(["rev-parse", "HEAD"]);
      git(["init", "--bare", remote]); git(["push", remote, "HEAD:refs/heads/main"]);
      await writeFile(join(root, "source.txt"), "committed"); git(["add", "."]); git(["commit", "-m", "tip"]);
      const tip = git(["rev-parse", "HEAD"]);
      await run({ root, remote, base, tip, git });
    } finally { await rm(parent, { recursive: true, force: true }); }
  }
  const runner = async (file: string, args: string[], options: { cwd: string; env?: NodeJS.ProcessEnv }) => ({ stdout: execFileSync(file, args, { ...options, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }), stderr: "" });
  it("checks both proposed commit trees while preserving dirty files, index and refs", async () => {
    await fixture(async ({ root, remote, base, tip, git }) => {
      await writeFile(join(root, "source.txt"), "staged"); git(["add", "."]);
      await writeFile(join(root, "source.txt"), "dirty"); await writeFile(join(root, "untracked.txt"), "keep");
      const before = git(["status", "--porcelain=v1"]), index = git(["write-tree"]), seen: string[] = [];
      await verifyPush({ root, remote, input: `HEAD ${tip} refs/heads/main ${base}\nHEAD~1 ${base} refs/heads/new ${zero}\n`, run: runner,
        runChecks: async ({ cwd, commit, checks }: { cwd: string; commit: string; checks: string[] }) => {
          seen.push(commit); expect(checks).toEqual(["build", "verify", "release:check"]);
          expect(await readFile(join(cwd, "source.txt"), "utf8")).toBe(commit === tip ? "committed" : "base");
        } });
      expect(seen).toEqual([tip, base]); expect(git(["status", "--porcelain=v1"])).toBe(before);
      expect(git(["write-tree"])).toBe(index); expect(git(["rev-parse", "HEAD"])).toBe(tip);
    });
  });
  it("records each gate stage and runs all hook commands without an injected deadline", async () => {
    await fixture(async ({ root, remote, base, tip }) => {
      const stages: Array<{ event: string; stage: string; commit?: string; status: string; durationMs: number }> = [];
      const checkOptions: Array<{ timeout?: number | null; captureOutput?: boolean }> = [];
      const run = async (file: string, args: string[], options: { cwd: string; env?: NodeJS.ProcessEnv; timeout?: number | null; captureOutput?: boolean }) => {
        expect(options.timeout).toBeNull();
        if (file === "git") return runner(file, args, options);
        checkOptions.push(options);
        return { stdout: "", stderr: "" };
      };
      await verifyPush({ root, remote, input: `HEAD ${tip} refs/heads/main ${base}\n`, run, onStage: (stage: typeof stages[number]) => stages.push(stage) });
      expect(stages.map(({ stage }) => stage)).toEqual(["push gate", "setup", "checkout", "install", "build", "verify", "release-check", "push gate"]);
      expect(stages.every(({ event, status, durationMs }) => event === "pre-push-stage" && status === "passed" && Number.isSafeInteger(durationMs) && durationMs >= 0)).toBe(true);
      expect(stages.filter(({ commit }) => commit !== undefined).every(({ commit }) => commit === tip)).toBe(true);
      expect(checkOptions).toHaveLength(4);
      expect(checkOptions.every(({ timeout }) => timeout === null)).toBe(true);
      expect(checkOptions.every(({ captureOutput }) => captureOutput === false)).toBe(true);
      const failures: typeof stages = [];
      await expect(verifyPush({ root, remote, input: `HEAD ${tip} refs/heads/main ${base}\n`, run: runner,
        runChecks: async () => { throw new Error("gate failed"); }, onStage: (stage: typeof stages[number]) => failures.push(stage) })).rejects.toThrow("gate failed");
      expect(failures.at(-1)).toMatchObject({ event: "pre-push-stage", stage: "checks", commit: tip, status: "failed" });
    });
  });
  it("blocks gate failures and destination movement; deletion runs no checks", async () => {
    await fixture(async ({ root, remote, base, tip, git }) => {
      const input = `HEAD ${tip} refs/heads/main ${base}\n`;
      await expect(verifyPush({ root, remote, input, run: runner, runChecks: async () => { throw new Error("gate failed"); } })).rejects.toThrow("gate failed");
      let checks = 0;
      await verifyPush({ root, remote, input: `(delete) ${zero} refs/heads/main ${base}\n`, run: runner, runChecks: async () => { checks++; } });
      expect(checks).toBe(0);
      await expect(verifyPush({ root, remote, input, run: runner, runChecks: async () => { git(["push", remote, "HEAD:refs/heads/main"]); } })).rejects.toThrow("Destination changed");
      await expect(verifyPush({ root, remote, input, run: runner, runChecks: async () => { throw new Error("should not run"); } })).rejects.toThrow("Destination changed");
    });
  });
  it("verifies committed input with an unmerged source index and pruned loose objects", async () => {
    await fixture(async ({ root, remote, base, tip, git }) => {
      git(["checkout", "-b", "conflicting", base]);
      await writeFile(join(root, "source.txt"), "conflicting branch");
      git(["add", "source.txt"]); git(["commit", "-m", "conflicting"]);
      expect(() => git(["merge", "main"])).toThrow();
      await writeFile(join(root, "untracked.txt"), "keep");
      const indexPath = join(root, ".git", "index");
      const index = await readFile(indexPath), status = git(["status", "--porcelain=v1"]), head = git(["rev-parse", "HEAD"]);
      const conflict = await readFile(join(root, "source.txt"), "utf8");
      expect(git(["ls-files", "--unmerged"])).not.toBe("");
      await verifyPush({ root, remote, input: `refs/heads/main ${tip} refs/heads/main ${base}\n`, run: runner,
        runChecks: async ({ cwd, commit }: { cwd: string; commit: string }) => {
          git(["gc", "--prune=now"], root);
          git(["gc", "--prune=now"], cwd);
          expect(git(["rev-parse", "HEAD"], cwd)).toBe(commit);
          expect(await readFile(join(cwd, "source.txt"), "utf8")).toBe("committed");
        } });
      expect(await readFile(indexPath)).toEqual(index);
      expect(git(["status", "--porcelain=v1"])).toBe(status);
      expect(git(["rev-parse", "HEAD"])).toBe(head);
      expect(await readFile(join(root, "source.txt"), "utf8")).toBe(conflict);
      expect(await readFile(join(root, "untracked.txt"), "utf8")).toBe("keep");
      expect(git(["rev-parse", "refs/heads/main"], remote)).toBe(base);
    });
  });
  it("blocks interrupted verification, cleans confirmed ownership, and retains uncertain ownership", async () => {
    await fixture(async ({ root, remote, base, tip, git }) => {
      await writeFile(join(root, "source.txt"), "staged"); git(["add", "source.txt"]);
      await writeFile(join(root, "source.txt"), "dirty");
      const index = await readFile(join(root, ".git", "index")), status = git(["status", "--porcelain=v1"]);
      const input = `HEAD ${tip} refs/heads/main ${base}\n`;
      for (const uncertain of [false, true]) {
        let checkout = "";
        const failure = Object.assign(new Error("verification interrupted"), uncertain ? { code: "RELEASE_COMMAND_CLEANUP_UNCONFIRMED" } : {});
        try {
          await expect(verifyPush({ root, remote, input, run: runner,
            runChecks: async ({ cwd }: { cwd: string }) => { checkout = cwd; throw failure; } })).rejects.toThrow("verification interrupted");
          expect(checkout).not.toBe("");
          if (uncertain) {
            await access(checkout);
            expect(failure.message).toContain("retained checkout:");
          } else await expect(access(checkout)).rejects.toMatchObject({ code: "ENOENT" });
          expect(await readFile(join(root, ".git", "index"))).toEqual(index);
          expect(git(["status", "--porcelain=v1"])).toBe(status);
          expect(git(["rev-parse", "HEAD"])).toBe(tip);
          expect(git(["rev-parse", "refs/heads/main"], remote)).toBe(base);
        } finally {
          if (checkout) await rm(join(checkout, ".."), { recursive: true, force: true });
        }
      }
    });
  });
  it("installs idempotently and preserves an existing hook's input, arguments and failure", async () => {
    await fixture(async ({ root, remote, base, tip, git }) => {
      await mkdir(join(root, "scripts"));
      for (const name of ["install-local-pre-push.mjs", "local-pre-push.mjs", "npm-command.mjs", "windows-job-supervisor.ps1"]) {
        await copyFile(join(process.cwd(), "scripts", name), join(root, "scripts", name));
      }
      const original = join(root, ".git", "hooks", "pre-push");
      const originalContent = '#!/bin/sh\nprintf "%s\\n" "$@" > prior-args.txt\ncat > prior-input.txt\nexit 42\n';
      await writeFile(original, originalContent); await chmod(original, 0o755);
      execFileSync(process.execPath, [join(root, "scripts", "install-local-pre-push.mjs")], { cwd: root });
      const installed = await readFile(original, "utf8");
      execFileSync(process.execPath, [join(root, "scripts", "install-local-pre-push.mjs")], { cwd: root });
      expect(await readFile(original, "utf8")).toBe(installed);
      if (process.platform === "win32") expect(git(["config", "--local", "--get", "core.longpaths"])).toBe("true");
      expect(await readFile(`${original}.projector-original`, "utf8")).toBe(originalContent);
      const input = `HEAD ${tip} refs/heads/main ${base}\n`, stdin = join(root, "stdin.txt");
      await writeFile(stdin, input);
      expect(() => git(["hook", "run", `--to-stdin=${stdin}`, "pre-push", "--", "origin", remote])).toThrow();
      expect(await readFile(join(root, "prior-input.txt"), "utf8")).toBe(input);
      expect(await readFile(join(root, "prior-args.txt"), "utf8")).toBe(`origin\n${remote}\n`);
      await access(join(root, ".git", "hooks", "commit-msg.sample"));
    });
  });
  it("runs real hooks through change 1 push and change 2 pull/conflict/merge/push against a local bare remote", async () => {
    await fixture(async ({ root, remote, base, tip, git }) => {
      const peer = join(root, "..", "peer"), tools = join(root, "..", "fixture-tools"), audit = join(tools, "checks.log");
      await mkdir(join(tools, "node_modules", "pnpm", "bin"), { recursive: true });
      const fixtureGate = `const fs = require('node:fs'); const cp = require('node:child_process'); const command = process.argv[2]; const source = fs.readFileSync('source.txt','utf8'); if(source.includes('<<<<<<<')) process.exit(9); fs.appendFileSync(process.env.PROJECTOR_FIXTURE_AUDIT, JSON.stringify({command, cwd:process.cwd(), commit:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source})+'\\n');`;
      await writeFile(join(tools, "node_modules", "pnpm", "bin", "pnpm.cjs"), fixtureGate);
      // On POSIX the hook resolves the executable directly from PATH.
      await writeFile(join(tools, "pnpm"), `#!/bin/sh\nexec "${process.execPath}" "${join(tools, "node_modules", "pnpm", "bin", "pnpm.cjs")}" "$@"\n`);
      await chmod(join(tools, "pnpm"), 0o755);
      const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === "path") ?? "PATH";
      const env = { ...process.env, [pathKey]: `${tools}${process.platform === "win32" ? ";" : ":"}${process.env[pathKey]}`, PROJECTOR_FIXTURE_AUDIT: audit };
      const gitWithHook = (args: string[], cwd = root) => execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
      const install = async (cwd: string) => {
        await mkdir(join(cwd, "scripts"));
        for (const name of ["install-local-pre-push.mjs", "local-pre-push.mjs", "npm-command.mjs", "windows-job-supervisor.ps1"]) await copyFile(join(process.cwd(), "scripts", name), join(cwd, "scripts", name));
        execFileSync(process.execPath, [join(cwd, "scripts", "install-local-pre-push.mjs")], { cwd, env });
      };
      git(["clone", "--no-checkout", root, peer]);
      git(["checkout", "-B", "main", base], peer);
      git(["config", "user.email", "fixture@example.test"], peer); git(["config", "user.name", "Fixture"], peer);
      git(["remote", "set-url", "origin", remote], peer);
      await install(root); await install(peer);
      gitWithHook(["push", remote, "HEAD:refs/heads/main"]);
      await writeFile(join(peer, "source.txt"), "change 2"); git(["add", "source.txt"], peer); git(["commit", "-m", "change 2"], peer);
      expect(() => gitWithHook(["pull", "--no-rebase", "origin", "main"], peer)).toThrow();
      expect(await readFile(join(peer, "source.txt"), "utf8")).toContain("<<<<<<<");
      await writeFile(join(peer, "source.txt"), "committed plus change 2"); git(["add", "source.txt"], peer); git(["commit", "-m", "resolve both changes"], peer);
      const merged = git(["rev-parse", "HEAD"], peer);
      gitWithHook(["push", "origin", "HEAD:refs/heads/main"], peer);
      const records = (await readFile(audit, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
      expect(records.filter((record) => record.commit === tip).map((record) => record.command)).toEqual(["install", "build", "verify", "release:check"]);
      expect(records.filter((record) => record.commit === merged).map((record) => record.command)).toEqual(["install", "build", "verify", "release:check"]);
      expect(records.filter((record) => record.commit === merged).every((record) => record.source === "committed plus change 2")).toBe(true);
      for (const [repository, commit] of [[root, tip], [peer, merged]] as const) {
        const logDirectory = join(repository, ".temp", "local-pre-push");
        const logs = (await readdir(logDirectory)).filter((name) => name.endsWith(".log"));
        expect(logs).toHaveLength(1);
        const stages = (await readFile(join(logDirectory, logs[0]), "utf8")).split("\n")
          .filter((line) => line.startsWith('{"event":"pre-push-stage"'))
          .map((line) => JSON.parse(line));
        expect(stages.map(({ stage }: { stage: string }) => stage)).toEqual(["push gate", "setup", "checkout", "install", "build", "verify", "release-check", "push gate"]);
        expect(stages.every(({ durationMs, status }: { durationMs: number; status: string }) => Number.isSafeInteger(durationMs) && durationMs >= 0 && status === "passed")).toBe(true);
        expect(stages.filter(({ commit: stageCommit }: { commit?: string }) => stageCommit !== undefined).every(({ commit: stageCommit }: { commit: string }) => stageCommit === commit)).toBe(true);
      }
      expect(git(["rev-parse", "refs/heads/main"], remote)).toBe(merged);
    });
  });
});
