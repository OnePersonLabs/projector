import { describe, expect, it } from "vitest";

import { PROJECTOR_VERSION, executeProjector, main, renderCli } from "./cli.js";

describe("minimal CLI entrypoint", () => {
  it("renders help without composing unfinished subsystems", () => {
    expect(renderCli(["--help"])).toContain("Usage: projector");
  });

  it("renders the package version", () => {
    expect(renderCli(["--version"])).toBe(PROJECTOR_VERSION);
  });

  it("maps policy refusal and nonconvergence to stable programmatic exit codes", async () => {
    const refused = await executeProjector(["reconcile", "--dry-run"], { cwd: process.cwd() });
    expect(refused.exitCode).toBe(3);
    expect(await main(["reconcile", "--dry-run"])).toBe(3);
  });

  it("blocks canonical governance conflicts before public mutation work begins", async () => {
    const result = await executeProjector(["apply", "--mode", "govern"], {
      cwd: "/definitely/not/a/repository",
      governance: { detectCanonicalConflictPaths: async () => [".projector/rules/conflicted.json"], assessOperationRisk: async () => "R1" },
    });
    expect(result.exitCode).toBe(3);
    expect(result.output).toMatch(/canonical governance conflict/u);
  });

  it("enforces actual operation risk before public mutation work begins", async () => {
    const result = await executeProjector(["apply", "--mode", "autonomous"], {
      cwd: "/definitely/not/a/repository",
      governance: { detectCanonicalConflictPaths: async () => [], assessOperationRisk: async () => "R2" },
    });
    expect(result.exitCode).toBe(3);
    expect(result.output).toMatch(/risk R2 exceeds/u);
  });
});
