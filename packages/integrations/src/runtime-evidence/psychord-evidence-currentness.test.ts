import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hashFramedDomain, type ContentHash } from "@projector/core";
import { afterEach, expect, it, vi } from "vitest";

import { createPsychordApplicationObservationPlan } from "./psychord-contract.js";
import { observePsychordEvidenceCurrentness, PsychordEvidenceCurrentnessSchema } from "./psychord-evidence-currentness.js";
import type { PsychordCommandRunner } from "./psychord-agent-browser-host.js";

const fileRace = vi.hoisted(() => ({ beforeOpen: undefined as undefined | ((path: string) => Promise<void>) }));
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    async open(path: Parameters<typeof actual.open>[0], flags: Parameters<typeof actual.open>[1]) {
      await fileRace.beforeOpen?.(String(path));
      return await actual.open(path, flags);
    },
  };
});

const roots: string[] = [];
afterEach(async () => {
  fileRace.beforeOpen = undefined;
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

it("reobserves repository, dependency, and build bytes without rerunning browser behavior", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-psychord-currentness-"));
  roots.push(root);
  await mkdir(join(root, "src"));
  await mkdir(join(root, "dist"));
  const source = Buffer.from("export const value = 1;\n");
  const build = Buffer.from("<main>one</main>\n");
  await writeFile(join(root, "src/app.ts"), source);
  await writeFile(join(root, "dist/index.html"), build);
  const head = "a".repeat(40);
  let diff = "";
  const runner: PsychordCommandRunner = {
    async run(request) {
      const key = request.args.join(" ");
      const stdout = key === "rev-parse HEAD" ? `${head}\n` : key.startsWith("diff ") ? diff : key.startsWith("ls-files ") ? "" : "";
      return { exitCode: 0, signal: null, stdout, stderr: "", durationMs: 1 };
    },
  };
  const worktreeDigest = digest(head, "");
  const plan = createPsychordApplicationObservationPlan({
    runId: "currentness-run",
    case: "no-input",
    scenario: { id: "scenario:currentness", semanticHash: hash("scenario") },
    repository: { root, gitHead: head, worktreeDigest },
    dependencies: [{ role: "source", locator: "src/app.ts", contentHash: sha256(source) }],
    ownedArtifactRoot: join(root, ".projector/runtime/application-evidence/currentness-run"),
    representativeInput: { code: "KeyA", holdMs: 1_000 },
    server: {
      expectedOrigin: "http://127.0.0.1:43123",
      readinessNonce: "nonce",
      readinessPath: "/.projector-ready",
      applicationPath: "/",
      expectedBuildArtifacts: [{ role: "application-document", buildLocator: "dist/index.html", requestPath: "/", contentHash: sha256(build) }],
    },
    limits: { timeoutMs: 1_000, cleanupTimeoutMs: 1_000, maximumOutputBytes: 4_096, maximumDiagnosticBytes: 4_096 },
  });
  const observe = () => observePsychordEvidenceCurrentness({ commands: runner, plan, environment: {}, signal: new AbortController().signal });

  const current = await observe();
  expect(current).toMatchObject({ status: "current", repository: { status: "current" }, dependencies: [{ status: "current" }], buildArtifacts: [{ status: "current" }] });
  expect(() => PsychordEvidenceCurrentnessSchema.parse({ ...current, reasons: ["fabricated"] })).toThrow(/reasons/u);
  const outside = await mkdtemp(join(tmpdir(), "projector-psychord-currentness-outside-"));
  roots.push(outside);
  const outsideSource = join(outside, "outside.ts");
  const sourceBackup = join(root, "src/app.original.ts");
  await writeFile(outsideSource, source);
  fileRace.beforeOpen = async (path) => {
    if (path !== join(root, "src/app.ts")) return;
    fileRace.beforeOpen = undefined;
    await rename(path, sourceBackup);
    await symlink(outsideSource, path, "file");
  };
  const raced = await observe();
  expect(raced).toMatchObject({ status: "unknown", dependencies: [{ status: "unavailable" }] });
  expect("observedHash" in raced.dependencies[0]!).toBe(false);
  await rm(join(root, "src/app.ts"));
  await rename(sourceBackup, join(root, "src/app.ts"));
  await writeFile(join(root, "src/app.ts"), "export const value = 2;\n");
  await expect(observe()).resolves.toMatchObject({ status: "stale", dependencies: [{ status: "stale" }] });
  await writeFile(join(root, "src/app.ts"), source);
  await rm(join(root, "dist/index.html"));
  await expect(observe()).resolves.toMatchObject({ status: "unknown", buildArtifacts: [{ status: "unavailable" }] });
  await writeFile(join(root, "dist/index.html"), build);
  diff = "changed";
  await expect(observe()).resolves.toMatchObject({ status: "stale", repository: { status: "stale" } });
});

function digest(head: string, diff: string): ContentHash {
  return hashFramedDomain("psychord-worktree@1", JSON.stringify({ head, diff, untracked: [] }));
}
function hash(value: string): ContentHash { return `sha256:v1:${createHash("sha256").update(value).digest("hex")}`; }
function sha256(bytes: Uint8Array): ContentHash { return `sha256:v1:${createHash("sha256").update(bytes).digest("hex")}`; }
