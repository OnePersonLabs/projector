import { describe, expect, it } from "vitest";

import {
  extractTypeScriptImports,
  validateCuratedExports,
  validatePackageDependencies,
  validateSubsystemArchitecture,
} from "./check-package-boundaries.mjs";

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
      "@projector/control-plane": ["@projector/core", "@projector/engine", "@projector/analyzers", "@projector/runtime"],
      "@projector/cli": [
        "@projector/core",
        "@projector/engine",
        "@projector/analyzers",
        "@projector/runtime",
        "@projector/integrations",
        "@projector/control-plane",
      ],
    })).toEqual([]);
  });
});

describe("TypeScript-aware public composition", () => {
  it("reads imports from syntax, not comments or string fragments", () => {
    expect(extractTypeScriptImports(`
      // import { fake } from "@projector/runtime";
      const text = 'from "@projector/engine"';
      import { RepositoryChangeLifecycleService } from "@projector/control-plane";
    `)).toEqual(["@projector/control-plane"]);
  });

  it("requires the exact curated control-plane facade", () => {
    const source = `export { RepositoryChangeLifecycleService, type LifecycleRecoveryOutcome } from "./change-lifecycle/service.js";`;
    expect(validateCuratedExports(source, ["LifecycleRecoveryOutcome", "RepositoryChangeLifecycleService"])).toEqual([]);
    expect(validateCuratedExports(`${source}\nexport * from "./change-lifecycle/store.js";`, ["LifecycleRecoveryOutcome", "RepositoryChangeLifecycleService"])).toContain("curated facade must not use export-star declarations");
  });
});

describe("subsystem architecture closure", () => {
  it("rejects parallel renderers and every severed representation composition edge", () => {
    const complete = {
      context: "const semanticContextOnly = true;",
      planning: "const representation = ports.representations.compile(change);",
      host: "authenticateRepresentationBinding(input);",
      session: "input.capsule.representation; input.instructions.representation; hashFramedDomain(\"representation-artifact\", input.instructions.text);",
      mcpServer: "function createProjectorMcpServer() {}",
      mcpComposition: 'read["projector.preview_representation"] = preview; read["projector.validate_representation"] = validate;',
      coverage: "const reason = 'authenticated representation projection evidence';",
    };
    expect(validateSubsystemArchitecture(complete)).toEqual([]);
    for (const key of ["planning", "host", "session", "mcpServer", "mcpComposition", "coverage"] as const) expect(validateSubsystemArchitecture({ ...complete, [key]: "severed" }).join("\n")).toMatch(/planning|host|session|mcp|coverage/iu);
    expect(validateSubsystemArchitecture({ ...complete, context: "deriveBehaviorViews(); const profile = 'agent-compact';" }).join("\n")).toMatch(/parallel.*renderer|context/iu);
  });
});
