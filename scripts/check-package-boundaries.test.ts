import { describe, expect, it } from "vitest";

import { validatePackageDependencies, validateSubsystemArchitecture } from "./check-package-boundaries.mjs";

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

describe("subsystem architecture closure", () => {
  it("rejects parallel renderers and every severed representation composition edge", () => {
    const complete = {
      context: "semantic context only",
      planning: "ports.representations.compile authenticated representation, capsule representation,",
      host: "capsule.representation instructions.representation hashFramedDomain(\"representation-artifact\", request.instructions.text)",
      mcp: "dedicatedRepresentationReads projector.preview_representation projector.validate_representation",
      coverage: "authenticated representation projection evidence",
    };
    expect(validateSubsystemArchitecture(complete)).toEqual([]);
    for (const key of ["planning", "host", "mcp", "coverage"] as const) expect(validateSubsystemArchitecture({ ...complete, [key]: "severed" }).join("\n")).toMatch(new RegExp(key, "iu"));
    expect(validateSubsystemArchitecture({ ...complete, context: "deriveBehaviorViews agent-compact" }).join("\n")).toMatch(/parallel.*renderer|context/iu);
  });
});
