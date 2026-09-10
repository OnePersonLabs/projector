import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { validateOperationalReport } from "@projector/runtime";
import { afterEach, describe, expect, test } from "vitest";

import { runReadOnlyOperationalVerification } from "./operational-verification.js";

const roots: string[] = [];
const execFileAsync = promisify(execFile);

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 20,
  })));
});

describe("read-only operational verification", () => {
  test("binds owner coverage evidence and remains unavailable when required lanes retain blind spots", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-operation-verify-ready-"));
    roots.push(root);
    await writeFile(join(root, "package.json"), '{"name":"fixture","version":"1.0.0"}\n');
    await execFileAsync("git", ["init", root]);
    await execFileAsync("git", ["-C", root, "add", "package.json"]);
    await execFileAsync("git", ["-C", root, "-c", "user.name=Projector Test", "-c", "user.email=test@projector.invalid", "commit", "-m", "fixture"]);

    const report = await runReadOnlyOperationalVerification(root, {
      signal: new AbortController().signal,
      toolVersion: "2.1.0-test",
      policy: { preset: "observe", allowMutation: false, allowPersistence: false },
    });

    expect(report.exitCode).toBe(5);
    expect(report.exitProof).toMatchObject({ blockingInvalidity: false, requiredUnavailable: true });
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "verification-evidence-unavailable", title: expect.stringMatching(/blind spots|dynamic module resolution/iu) }),
    ]));
    expect(report.evidence.graphRecords).toHaveLength(1);
    expect(report.evidence.decisionRecords).toHaveLength(2);
    expect(report.evidence.validationRecords).toHaveLength(3);
  });

  test("returns an authenticated report and exposes unavailable semantic proof", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-operation-verify-"));
    roots.push(root);
    await writeFile(join(root, "package.json"), '{"name":"fixture","version":"1.0.0"}\n');

    const report = await runReadOnlyOperationalVerification(root, {
      signal: new AbortController().signal,
      toolVersion: "2.1.0-test",
      policy: { preset: "observe", allowMutation: false, allowPersistence: false },
    });

    expect(validateOperationalReport(report)).toBe(true);
    expect(report).toMatchObject({
      command: "verify",
      exitCode: 5,
      exitProof: { requiredUnavailable: true },
      policy: { preset: "observe", allowMutation: false, allowPersistence: false },
      evidence: {
        configDigest: { unavailable: expect.any(String) },
        worktreeDigest: { unavailable: expect.any(String) },
      },
      unavailableFields: expect.arrayContaining(["modelRecords", "snapshotRecords", "transformRecords"]),
    });

    await writeFile(join(root, "observed.ts"), "export const observed = 1;\n");
    const changed = await runReadOnlyOperationalVerification(root, {
      signal: new AbortController().signal,
      toolVersion: "2.1.0-test",
      policy: { preset: "observe", allowMutation: false, allowPersistence: false },
    });
    expect(changed.stateDigest).not.toBe(report.stateDigest);
    expect(changed.evidence.configDigest).toEqual(report.evidence.configDigest);
    expect(changed.evidence.worktreeDigest).toEqual(report.evidence.worktreeDigest);
  });

  test("reports malformed canonical input as blocking without mutating it", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-operation-verify-invalid-"));
    roots.push(root);
    const canonicalDirectory = join(root, ".projector", "model");
    await mkdir(canonicalDirectory, { recursive: true });
    const malformed = join(canonicalDirectory, "invalid.toml");
    await writeFile(malformed, "not = [valid\n");

    const report = await runReadOnlyOperationalVerification(root, {
      signal: new AbortController().signal,
      toolVersion: "2.1.0-test",
      policy: { preset: "observe", allowMutation: false, allowPersistence: false },
    });

    expect(report.exitProof.blockingInvalidity).toBe(true);
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "canonical-knowledge-invalid", severity: "error" }),
    ]));
  });

  test("honors cancellation before observation", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-operation-verify-cancelled-"));
    roots.push(root);
    const controller = new AbortController();
    controller.abort(new Error("caller stopped verification"));

    await expect(runReadOnlyOperationalVerification(root, {
      signal: controller.signal,
      toolVersion: "2.1.0-test",
      policy: { preset: "observe", allowMutation: false, allowPersistence: false },
    })).rejects.toThrow("caller stopped verification");
  });
});
