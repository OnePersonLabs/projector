import { describe, expect, it } from "vitest";

import { PROJECTOR_VERSION, createHostSessionRecord, executeProjector, hostSessionSelector, main, renderCli } from "./cli.js";

describe("minimal CLI entrypoint", () => {
  it("preserves the public stored-session compatibility helpers", () => {
    expect(createHostSessionRecord).toBeTypeOf("function");
    expect(hostSessionSelector).toBeTypeOf("function");
  });

  it("renders help without composing unfinished subsystems", () => {
    const help = renderCli(["--help"]);
    expect(help).toContain("Usage: projector");
    const commandSection = help.split("Commands:\n")[1]?.split("\n\nOptions:")[0];
    expect(commandSection?.match(/^  [a-z]+/gmu)?.map((line) => line.trim())).toEqual([
      "init",
      "audit",
      "change",
      "plan",
      "apply",
      "reconcile",
      "coverage",
      "complete",
      "cleanup",
      "run",
      "mcp",
      "watch",
      "ci",
      "recover",
      "verify",
      "upgrade",
      "explain",
    ]);
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
      governance: {
        detectCanonicalConflictPaths: async () => [],
        operation: { command: "apply", sideEffect: "canonical-write", externalWrite: false, canonicalMutation: true },
      },
    });
    expect(result.exitCode).toBe(3);
    expect(result.output).toMatch(/risk R2 exceeds/u);
  });

  it("derives and rejects command risk before any repository access", async () => {
    let repositoryAccessed = false;
    const result = await executeProjector(["init", "--mode", "autonomous"], {
      cwd: "/definitely/not/a/repository",
      governance: {
        detectCanonicalConflictPaths: async () => { repositoryAccessed = true; return []; },
        assessOperationRisk: async () => { throw new Error("risk must be derived before repository access"); },
        operation: { command: "init", sideEffect: "canonical-write", externalWrite: false, canonicalMutation: true },
      },
    });
    expect(result.exitCode).toBe(3);
    expect(result.report.operationRisk).toBe("R2");
    expect(repositoryAccessed).toBe(false);
  });
});
