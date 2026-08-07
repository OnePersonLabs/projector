import { describe, expect, it } from "vitest";

import { PROJECTOR_VERSION, renderCli } from "./cli.js";

describe("minimal CLI entrypoint", () => {
  it("renders help without composing unfinished subsystems", () => {
    expect(renderCli(["--help"])).toContain("Usage: projector");
  });

  it("renders the package version", () => {
    expect(renderCli(["--version"])).toBe(PROJECTOR_VERSION);
  });
});
