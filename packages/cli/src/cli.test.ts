import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PROJECTOR_VERSION, createHostSessionRecord, executeProjector, hostSessionSelector, renderCli } from "./cli.js";

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
      "context",
      "reconcile",
      "change",
      "plan",
      "approve",
      "apply",
      "recover",
      "resume",
      "coverage",
      "complete",
      "cleanup",
      "run",
      "mcp",
      "watch",
      "ci",
      "verify",
      "upgrade",
      "explain",
    ]);
  });

  it("renders the package version", () => {
    expect(renderCli(["--version"])).toBe(PROJECTOR_VERSION);
  });

  it("blocks canonical governance conflicts before public mutation work begins", async () => {
    const repository = await mkdtemp(join(tmpdir(), "projector-cli-governance-"));
    try {
      await mkdir(join(repository, ".projector"));
      await mkdir(join(repository, ".git"));
      await writeFile(join(repository, ".projector/config.toml"), `apiVersion = "projector.config/v1"\nenabled = true\nprojectorVersion = "${PROJECTOR_VERSION}"\n`);
      const result = await executeProjector(["apply", "lifecycle_approval_test", "--mode", "govern"], {
        cwd: repository,
        governance: { detectCanonicalConflictPaths: async () => [".projector/rules/conflicted.toml"], assessOperationRisk: async () => "R1" },
      });
      expect(result.exitCode).toBe(2);
      expect(result.output).toMatch(/canonical governance conflict/u);
    } finally {
      await rm(repository, { recursive: true, force: true });
    }
  });

  it("enforces actual operation risk before public mutation work begins", async () => {
    const result = await executeProjector(["apply", "lifecycle_approval_test", "--mode", "autonomous"], {
      cwd: "/definitely/not/a/repository",
      governance: {
        detectCanonicalConflictPaths: async () => [],
        operation: { command: "apply", sideEffect: "canonical-write", externalWrite: false, canonicalMutation: true },
      },
    });
    expect(result.exitCode).toBe(2);
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
    expect(result.exitCode).toBe(2);
    expect(result.report.operationRisk).toBe("R2");
    expect(repositoryAccessed).toBe(false);
  });
});
