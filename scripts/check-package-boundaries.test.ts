import { describe, expect, it } from "vitest";

import { validatePackageDependencies } from "./check-package-boundaries.mjs";

describe("workspace dependency direction", () => {
  it("rejects a workspace dependency from core", () => {
    expect(validatePackageDependencies({
      "@projector/core": ["@projector/runtime"],
      "@projector/runtime": ["@projector/core"],
    })).toContain("@projector/core must not depend on @projector/runtime");
  });

  it("accepts the declared ports-and-composition-root graph", () => {
    expect(validatePackageDependencies({
      "@projector/core": [],
      "@projector/engine": ["@projector/core"],
      "@projector/analyzers": ["@projector/core"],
      "@projector/runtime": ["@projector/core"],
      "@projector/integrations": ["@projector/core", "@projector/engine"],
      "@projector/cli": [
        "@projector/core",
        "@projector/engine",
        "@projector/analyzers",
        "@projector/runtime",
        "@projector/integrations",
      ],
    })).toEqual([]);
  });
});
