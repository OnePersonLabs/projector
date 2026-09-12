import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CodexReadOnlyValidatorLauncher } from "./validator-launcher.js";

describe.skipIf(process.platform !== "win32")("Codex unelevated Windows validators", () => {
  it("runs literal argv and inherited child output while denying writes to validator bytes", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-validator-"));
    const path = join(root, "validator.cjs");
    const source = `const fs = require('node:fs'); const {spawnSync} = require('node:child_process');
      let denied = false; try { fs.writeFileSync(__filename, 'tampered'); } catch(e) { if (!['EPERM','EACCES'].includes(e.code)) throw e; denied = true; }
      const child = spawnSync(process.execPath, ['-e', 'console.log("child completed")'], {stdio:'inherit',windowsHide:true});
      if (child.error) throw child.error;
      console.log(JSON.stringify({denied, childExit:child.status, argument:process.argv[2]}));`;
    await writeFile(path, source);
    // Node is a valid executable but cannot run Codex's sandbox command. A cwd
    // lookup would launch this decoy outside any sandbox and fail the test.
    await copyFile(process.execPath, join(root, "codex.exe"));
    try {
      const result = await new CodexReadOnlyValidatorLauncher().launch({ executable: process.execPath, args: [path, 'literal "quoted" & value'], cwd: root, env: {}, timeoutMs: 5000, maxOutputBytes: 65536, signal: new AbortController().signal });
      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stdout).toContain("child completed");
      expect(JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1)!)).toEqual({ denied: true, childExit: 0, argument: 'literal "quoted" & value' });
      expect(await readFile(path, "utf8")).toBe(source);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("does not execute the validator when Codex is absent", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-validator-missing-"));
    const marker = join(root, "must-not-exist");
    try {
      await expect(new CodexReadOnlyValidatorLauncher(join(root, "absent.exe")).launch({ executable: process.execPath, args: ["-e", `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'escaped')`], cwd: root, env: {}, timeoutMs: 5000, maxOutputBytes: 65536, signal: new AbortController().signal })).rejects.toMatchObject({ code: "ENOENT" });
      await expect(readFile(marker)).rejects.toMatchObject({ code: "ENOENT" });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it.each(["timeout", "output", "aborted"] as const)("enforces the %s limit through the sandbox command", async (limit) => {
    const controller = new AbortController();
    const timer = limit === "aborted" ? setTimeout(() => controller.abort(), 500) : undefined;
    try {
      await expect(new CodexReadOnlyValidatorLauncher().launch({
        executable: process.execPath,
        args: ["-e", limit === "output" ? "setInterval(()=>process.stdout.write('x'.repeat(8192)), 10)" : "setInterval(()=>{},1000)"],
        cwd: process.cwd(), env: {}, timeoutMs: limit === "timeout" ? 500 : 5000,
        maxOutputBytes: 4096, signal: controller.signal,
      })).rejects.toMatchObject({ limit });
    } finally { clearTimeout(timer); }
  });
});
