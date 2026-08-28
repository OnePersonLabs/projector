import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validatePackageDependencies, validateSubsystemArchitecture, validateVersionAuthority, validateVersionLiteralOwnership } from "./check-package-boundaries.mjs";

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

  it("keeps the release version authoritative in the root manifest", async () => {
    const rootManifest = JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf8")) as { version?: unknown };
    const packageDirectories = await readdir(join(process.cwd(), "packages"), { withFileTypes: true });
    const packageVersions = await Promise.all(packageDirectories
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const manifest = JSON.parse(await readFile(join(process.cwd(), "packages", entry.name, "package.json"), "utf8")) as { name?: unknown; version?: unknown };
        return [manifest.name, manifest.version] as const;
      }));

    expect(rootManifest.version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u);
    expect(packageVersions).toEqual(packageVersions.map(([name]) => [name, undefined]));
  });

  it("rejects copied workspace release versions", () => {
    expect(validateVersionAuthority(
      { name: "projector", version: "2.0.0" },
      [{ name: "@projector/core", private: true, version: "2.0.0" }],
    )).toEqual(["@projector/core must inherit the root release version instead of declaring its own"]);
  });

  it("rejects copied Projector-owned compatibility literals", () => {
    expect(validateVersionLiteralOwnership({
      "packages/core/src/versioning.ts": "export const CANONICAL_API_VERSION = 'projector/v2';",
      "packages/runtime/src/copied.ts": "const version = 'projector/v2';",
    })).toEqual(["packages/runtime/src/copied.ts copies version literal projector/v2; use the owner in packages/core/src/versioning.ts"]);
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
