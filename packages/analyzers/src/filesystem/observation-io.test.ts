import { execFile } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";
import { ObservationBudget } from "@projector/core";
import { expect, it } from "vitest";
import { observationGit } from "./observation-io.js";

const execFileAsync = promisify(execFile);

it("terminates and drains a timed-out Git process together with its pipe-owning child", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-git-deadline-"));
  const marker = join(root, "child.pid"), originalPath = process.env.PATH;
  let childPid: number | undefined;
  try {
    if (process.platform === "win32") {
      const source = `using System.Diagnostics; using System.IO;
public static class Program { public static void Main() {
  var child = Process.Start(new ProcessStartInfo(${JSON.stringify(process.execPath)}, "-e \\\"setTimeout(()=>{},30000)\\\"") { UseShellExecute = false });
  File.WriteAllText(${JSON.stringify(marker)}, child.Id.ToString()); child.WaitForExit();
} }`;
      const sourcePath = join(root, "fixture.cs"); await writeFile(sourcePath, source);
      await execFileAsync("powershell.exe", ["-NoProfile", "-Command", `Add-Type -Path '${sourcePath.replaceAll("'", "''")}' -OutputAssembly '${join(root, "git.exe").replaceAll("'", "''")}' -OutputType ConsoleApplication`]);
    } else {
      const executable = join(root, "git");
      await writeFile(executable, `#!/bin/sh\n'${process.execPath.replaceAll("'", "'\\''")}' -e 'setTimeout(()=>{},30000)' &\necho $! > '${marker.replaceAll("'", "'\\''")}'\nwait\n`);
      await chmod(executable, 0o755);
    }
    process.env.PATH = `${root}${delimiter}${originalPath ?? ""}`;
    const startedAt = Date.now();
    await expect(observationGit(root, ["status"], new ObservationBudget({ timeoutMs: 1000 }))).rejects.toMatchObject({
      code: "observation-limit-exceeded", limit: "timeoutMs",
    });
    expect(Date.now() - startedAt).toBeLessThan(5000);
    childPid = Number(await readFile(marker, "utf8"));
    expect(() => process.kill(childPid!, 0)).toThrow();
  } finally {
    if (originalPath === undefined) delete process.env.PATH; else process.env.PATH = originalPath;
    if (childPid !== undefined) { try { process.kill(childPid, "SIGKILL"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; } }
    await rm(root, { recursive: true, force: true });
  }
}, 10_000);
