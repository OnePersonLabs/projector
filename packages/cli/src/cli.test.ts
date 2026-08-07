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
});
