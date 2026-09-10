import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { OperationAccessError, withProjectOperationAccess } from "./operation-access.js";

const accessModuleUrl = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "operation-access.ts")).href;
const childProcesses = new Set<ChildProcess>();

afterEach(() => {
  for (const child of childProcesses) child.kill();
  childProcesses.clear();
});

describe("withProjectOperationAccess", () => {
  it("allows shared access across processes", async () => {
    const root = await readyProject();

    await withProjectOperationAccess(root, { operation: "inspect", mode: "shared" }, async () => {
      const child = runAccessChild(root, "shared", "child-read");
      await waitForFile(join(root, "child-read.acquired"));
      await writeFile(join(root, "child-read.release"), "release\n");
      await expectChildSuccess(child);
    });
  });

  it("gives a queued exclusive operation priority over later shared requests", async () => {
    const root = await readyProject();
    let releaseInitial: (() => void) | undefined;
    let initialAcquired: (() => void) | undefined;
    const acquired = new Promise<void>((resolve) => { initialAcquired = resolve; });
    const release = new Promise<void>((resolve) => { releaseInitial = resolve; });
    const initial = withProjectOperationAccess(root, { operation: "initial-read", mode: "shared" }, async () => {
      initialAcquired?.();
      await release;
    });
    await acquired;

    const exclusive = runAccessChild(root, "exclusive", "migration");
    await waitForRequestCount(root, 1);
    const laterShared = runAccessChild(root, "shared", "late-read");
    await waitForRequestCount(root, 2);
    await expect(fileExists(join(root, "migration.acquired"))).resolves.toBe(false);
    await expect(fileExists(join(root, "late-read.acquired"))).resolves.toBe(false);

    releaseInitial?.();
    await initial;
    await waitForFile(join(root, "migration.acquired"));
    await expect(fileExists(join(root, "late-read.acquired"))).resolves.toBe(false);
    await writeFile(join(root, "migration.release"), "release\n");
    await expectChildSuccess(exclusive);
    await waitForFile(join(root, "late-read.acquired"));
    await writeFile(join(root, "late-read.release"), "release\n");
    await expectChildSuccess(laterShared);
  });

  it("fails closed when a persisted access claim is corrupt", async () => {
    const root = await readyProject();
    const holders = join(root, ".projector", "runtime", "operation-access", "holders");
    await mkdir(holders, { recursive: true });
    await writeFile(join(holders, "not-a-valid-claim.json"), "{broken");

    await expect(
      withProjectOperationAccess(root, { operation: "inspect", mode: "shared" }, async () => undefined),
    ).rejects.toMatchObject({ code: "access-corrupt" });
  });

  it("fails closed when persisted claims have an ambiguous ticket order", async () => {
    const root = await readyProject();
    const access = join(root, ".projector", "runtime", "operation-access");
    await mkdir(join(access, "requests"), { recursive: true });
    await mkdir(join(access, "holders"), { recursive: true });
    await writeFile(join(access, "next-ticket"), "2\n");
    await writeClaim(join(access, "requests", "11111111-1111-4111-8111-111111111111.json"), {
      requestId: "11111111-1111-4111-8111-111111111111",
      ticket: 1,
      operation: "first",
      mode: "shared",
    });
    await writeClaim(join(access, "holders", "22222222-2222-4222-8222-222222222222.json"), {
      requestId: "22222222-2222-4222-8222-222222222222",
      ticket: 1,
      operation: "second",
      mode: "shared",
    });

    await expect(
      withProjectOperationAccess(root, { operation: "inspect", mode: "shared" }, async () => undefined),
    ).rejects.toMatchObject({ code: "access-corrupt" });
  });

  it("aborts a waiting request and removes it from the queue", async () => {
    const root = await readyProject();
    const controller = new AbortController();

    await withProjectOperationAccess(root, { operation: "migration", mode: "exclusive" }, async () => {
      const waiting = withProjectOperationAccess(
        root,
        { operation: "inspect", mode: "shared", signal: controller.signal },
        async () => undefined,
      );
      await waitForRequestCount(root, 1);
      controller.abort(new Error("cancelled by caller"));
      await expect(waiting).rejects.toMatchObject({ code: "access-aborted" });
      await expect(requestCount(root)).resolves.toBe(0);
    });
  });

  it("releases access in finally when the operation throws", async () => {
    const root = await readyProject();
    const failure = new Error("operation failed");

    await expect(
      withProjectOperationAccess(root, { operation: "inspect", mode: "shared" }, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    await expect(
      withProjectOperationAccess(root, { operation: "migration", mode: "exclusive" }, async () => "released"),
    ).resolves.toBe("released");
  });

  it("heartbeats a held claim and stops the heartbeat before release", async () => {
    const root = await readyProject();
    const holders = join(root, ".projector", "runtime", "operation-access", "holders");
    let claimPath = "";

    await withProjectOperationAccess(root, { operation: "long-inspection", mode: "shared" }, async () => {
      const entries = await readdir(holders);
      expect(entries).toHaveLength(1);
      claimPath = join(holders, entries[0] as string);
      const initial = JSON.parse(await readFile(claimPath, "utf8")) as { heartbeatAt?: string };
      expect(initial.heartbeatAt).toBeTypeOf("string");
      await waitForHeartbeatAfter(claimPath, initial.heartbeatAt as string);
    });

    await expect(fileExists(claimPath)).resolves.toBe(false);
    await delay(350);
    await expect(fileExists(claimPath)).resolves.toBe(false);
  });

  it("does not initialize an unprepared project", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-access-unready-"));

    await expect(
      withProjectOperationAccess(root, { operation: "inspect", mode: "shared" }, async () => undefined),
    ).rejects.toBeInstanceOf(OperationAccessError);
    await expect(stat(join(root, ".projector"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});

async function readyProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "projector-operation-access-"));
  await mkdir(join(root, ".projector"));
  return root;
}

function runAccessChild(root: string, mode: "shared" | "exclusive", operation: string): ChildProcess {
  const script = `
    import { stat, writeFile } from "node:fs/promises";
    import { join } from "node:path";
    import { withProjectOperationAccess } from ${JSON.stringify(accessModuleUrl)};
    const [root, mode, operation] = process.argv.slice(1);
    await writeFile(join(root, operation + ".started"), "started\\n");
    await withProjectOperationAccess(root, { mode, operation }, async () => {
      await writeFile(join(root, operation + ".acquired"), "acquired\\n");
      while (true) {
        try { await stat(join(root, operation + ".release")); break; }
        catch (error) { if (error?.code !== "ENOENT") throw error; }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    });
  `;
  const child = spawn(process.execPath, ["--experimental-strip-types", "--input-type=module", "--eval", script, root, mode, operation], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  childProcesses.add(child);
  child.once("exit", () => childProcesses.delete(child));
  return child;
}

async function expectChildSuccess(child: ChildProcess): Promise<void> {
  let stderr = "";
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => { stderr += chunk; });
  const code = await new Promise<number | null>((resolve) => child.once("exit", resolve));
  expect(code, stderr).toBe(0);
}

async function waitForFile(path: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (await fileExists(path)) return;
    await delay(10);
  }
  throw new Error(`Timed out waiting for ${path}`);
}

async function fileExists(path: string): Promise<boolean> {
  try { await stat(path); return true; }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function waitForRequestCount(root: string, expected: number): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (await requestCount(root) === expected) return;
    await delay(10);
  }
  throw new Error(`Timed out waiting for ${expected} queued request(s)`);
}

async function waitForHeartbeatAfter(path: string, initial: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const claim = JSON.parse(await readFile(path, "utf8")) as { heartbeatAt?: string };
    if (typeof claim.heartbeatAt === "string" && claim.heartbeatAt > initial) return;
    await delay(10);
  }
  throw new Error(`Timed out waiting for heartbeat advancement in ${path}`);
}

async function requestCount(root: string): Promise<number> {
  const { readdir } = await import("node:fs/promises");
  const path = join(root, ".projector", "runtime", "operation-access", "requests");
  try { return (await readdir(path)).length; }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return 0;
    throw error;
  }
}

async function writeClaim(
  path: string,
  claim: { requestId: string; ticket: number; operation: string; mode: "shared" | "exclusive" },
): Promise<void> {
  await writeFile(path, `${JSON.stringify({
    version: 1,
    ...claim,
    processId: 42,
    createdAt: "2026-09-10T12:00:00.000Z",
    heartbeatAt: "2026-09-10T12:00:00.000Z",
  })}\n`);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
