import { describe, expect, it } from "vitest";
import { setTimeout as delay } from "node:timers/promises";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeReleaseCommand, isReleaseCommandCleanupUnconfirmed } from "./npm-command.mjs";
import { buildReleasePackage } from "./build-release-package.mjs";

describe("release staging ownership", () => {
  it("creates missing parent directories before exclusively allocating new staging", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-staging-parents-test-"));
    const staging = join(root, "missing", "parents", "projector-release-new");
    const destination = join(root, "artifacts");
    try {
      const signal = AbortSignal.timeout(25);
      const failure = await buildReleasePackage(staging, destination, { signal })
        .then(() => undefined, (error: unknown) => error);
      expect(failure).toBe(signal.reason);
      expect(signal.aborted).toBe(true);
      await expect(access(join(staging, "dist"))).resolves.toBeUndefined();
      await expect(access(destination)).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each(["directory", "file"])("refuses an existing %s on every retry without replacing retained evidence", async (kind) => {
    const root = await mkdtemp(join(tmpdir(), "projector-staging-ownership-test-"));
    const staging = join(root, "projector-release-retained");
    const destination = join(root, "artifacts");
    const evidence = kind === "directory" ? join(staging, "recovery-evidence.txt") : staging;
    try {
      if (kind === "directory") await mkdir(staging);
      await writeFile(evidence, "retained process recovery evidence");
      for (let attempt = 0; attempt < 2; attempt += 1) {
        // Bound the old destructive implementation during the regression's RED
        // run; refusal must happen before copying or launching npm.
        const failure = await buildReleasePackage(staging, destination, { signal: AbortSignal.timeout(25) })
          .then(() => undefined, (error: unknown) => error);
        const retained = await readFile(evidence, "utf8").catch(() => "missing evidence");
        expect(retained).toBe("retained process recovery evidence");
        expect(failure).toMatchObject({ code: "RELEASE_STAGING_EXISTS" });
        await expect(access(destination)).rejects.toMatchObject({ code: "ENOENT" });
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("owned release subprocesses", () => {
  it.skipIf(process.platform !== "win32")("closes the owned job when an exited non-Node parent leaves inherited pipes open", async () => {
    let descendant: number | undefined;
    let output = "";
    const command = "$s=New-Object System.Diagnostics.ProcessStartInfo; $s.FileName='" + process.execPath.replaceAll("'", "''")
      + "'; $s.Arguments='-e \"setTimeout(()=>{},4000)\"'; $s.UseShellExecute=$false; $s.CreateNoWindow=$true; $p=[System.Diagnostics.Process]::Start($s); [Console]::WriteLine($p.Id);";
    try {
      const result = await executeReleaseCommand("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command], {
        timeout: 8_000,
        onStdout: (chunk: string) => {
          output += chunk;
          if (output.includes("\n")) descendant = Number(output.trim());
        },
      });
      expect(result.stdout).toBe(output);
      expect(Number.isSafeInteger(descendant)).toBe(true);
      await expect.poll(() => {
        try { process.kill(descendant!, 0); return "alive"; } catch { return "exited"; }
      }, { timeout: 1_000 }).toBe("exited");
    } finally {
      // Cleanup is a safety net if the regression returns before the job closes.
      if (descendant !== undefined) {
        try { process.kill(descendant); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
        await expect.poll(() => {
          try { process.kill(descendant!, 0); return "alive"; } catch { return "exited"; }
        }, { timeout: 1_000 }).toBe("exited");
      } else {
        await delay(4_500);
      }
    }
  });

  it("preserves cleanup uncertainty through nested and cyclic failure wrappers", () => {
    const uncertain = Object.assign(new Error("unknown descendants"), { code: "RELEASE_COMMAND_CLEANUP_UNCONFIRMED" });
    const cycle = new Error("wrapper");
    cycle.cause = cycle;
    expect(isReleaseCommandCleanupUnconfirmed(new AggregateError([cycle, new Error("outer", { cause: uncertain })]))).toBe(true);
    expect(isReleaseCommandCleanupUnconfirmed(new AggregateError([cycle, new Error("ordinary failure")]))).toBe(false);
    expect(isReleaseCommandCleanupUnconfirmed(undefined)).toBe(false);
  });

  it("passes shell metacharacters and spaces as opaque arguments", async () => {
    const args = ["space value", "& echo injected", "$(anything)", "quote\"value", "%PATH%"];
    const result = await executeReleaseCommand(process.execPath, ["-e", "process.stdout.write(JSON.stringify(process.argv.slice(1)))", ...args]);
    expect(JSON.parse(result.stdout)).toEqual(args);
  });

  it("preserves the original spawn failure code", async () => {
    await expect(executeReleaseCommand("projector-no-such-release-executable", []))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("returns complete bounded command output", async () => {
    expect(await executeReleaseCommand(process.execPath, ["-e", "process.stdout.write('packed'); process.stderr.write('diagnostic');"]))
      .toMatchObject({ stdout: "packed", stderr: "diagnostic" });
  });

  it("kills and drains the owned child tree before cancellation returns", async () => {
    const controller = new AbortController();
    let identities: { parent: number; descendant: number } | undefined;
    let output = "";
    const code = "const {spawn}=require('node:child_process'); const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); console.log(JSON.stringify({parent:process.pid,descendant:child.pid})); setInterval(()=>{},1000);";
    await expect(executeReleaseCommand(process.execPath, ["-e", code], {
      signal: controller.signal,
      onStdout: (chunk: string) => {
        output += chunk;
        if (!output.includes("\n")) return;
        identities = JSON.parse(output.trim());
        controller.abort(new Error("release cancelled"));
      },
    })).rejects.toThrow("release cancelled");
    expect(identities).toBeDefined();
    for (const pid of [identities!.parent, identities!.descendant]) expect(() => process.kill(pid, 0)).toThrow();
  });

  it("drains a command when its own deadline expires", async () => {
    await expect(executeReleaseCommand(process.execPath, ["-e", "setInterval(()=>{},1000)"], { timeout: 100 }))
      .rejects.toThrow(/100ms deadline/u);
  });

  it("terminates an output-flooding child at the configured bound", async () => {
    await expect(executeReleaseCommand(process.execPath, ["-e", "setInterval(()=>process.stdout.write('x'.repeat(4096)),1)"], { maxBuffer: 1024 }))
      .rejects.toThrow(/output.*bound/iu);
  });
});
