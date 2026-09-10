import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { validateOperationalReport } from "@projector/runtime";
import { afterEach, describe, expect, test } from "vitest";

import { runReadOnlyOperationalVerification } from "./operational-verification.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("read-only operational verification", () => {
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
      policy: { preset: "observe", allowMutation: false, allowPersistence: false },
      unavailableFields: expect.arrayContaining(["architecturalConformance", "decisionValidity"]),
    });
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
