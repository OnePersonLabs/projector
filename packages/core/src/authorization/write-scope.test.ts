import { describe, expect, it } from "vitest";

import type { ScopeGrant, SelectorExpr } from "../domain/contracts.js";
import {
  authorizeRepositoryPath,
  compileWriteAuthorization,
  matchesCanonicalGlob,
  normalizeRepositoryRelativePath,
} from "./write-scope.js";

const grant = (selector: SelectorExpr, operations: readonly string[] = ["repair"]): ScopeGrant => ({
  selector,
  operations: [...operations],
  reason: "test grant",
});

const pathEquals = (value: string): SelectorExpr => ({ op: "atom", field: "path", matcher: "equals", value });
const pathGlob = (value: string): SelectorExpr => ({ op: "atom", field: "path", matcher: "glob", value });
const operationEquals = (value: string): SelectorExpr => ({ op: "atom", field: "operation", matcher: "equals", value });

describe("capsule write authorization", () => {
  it("matches canonical exact and full glob semantics", () => {
    const compiled = compileWriteAuthorization({
      operation: "repair",
      allowedWrites: [grant(pathEquals("README.md")), grant(pathGlob("scripts/**/*.mjs"))],
      forbiddenWrites: [],
    });

    expect(compiled).toMatchObject({ enforceable: true, operationGranted: true, reasons: [] });
    expect(authorizeRepositoryPath(compiled, "README.md")).toEqual({ authorized: true, reason: "authorized" });
    expect(authorizeRepositoryPath(compiled, "scripts/check.mjs")).toEqual({ authorized: true, reason: "authorized" });
    expect(authorizeRepositoryPath(compiled, "scripts/release/check.mjs")).toEqual({ authorized: true, reason: "authorized" });
    expect(authorizeRepositoryPath(compiled, "scripts/check.ts")).toEqual({ authorized: false, reason: "outside-allowed-scope" });
  });

  it("preserves disjunction between grants and conjunction within one grant", () => {
    const compiled = compileWriteAuthorization({
      operation: "repair",
      allowedWrites: [
        grant({ op: "all", items: [pathGlob("scripts/**"), pathGlob("**/*.mjs"), operationEquals("repair")] }),
        grant(pathEquals("package.json")),
      ],
      forbiddenWrites: [],
    });

    expect(authorizeRepositoryPath(compiled, "scripts/check.mjs").authorized).toBe(true);
    expect(authorizeRepositoryPath(compiled, "scripts/check.ts").authorized).toBe(false);
    expect(authorizeRepositoryPath(compiled, "package.json").authorized).toBe(true);
  });

  it("requires both the grant operation and any operation selector to match", () => {
    const wrongGrantOperation = compileWriteAuthorization({
      operation: "repair",
      allowedWrites: [grant(pathGlob("**"), ["delete"])],
      forbiddenWrites: [],
    });
    const wrongSelectorOperation = compileWriteAuthorization({
      operation: "repair",
      allowedWrites: [grant({ op: "all", items: [pathGlob("**"), operationEquals("delete")] })],
      forbiddenWrites: [],
    });

    expect(wrongGrantOperation).toMatchObject({ enforceable: true, operationGranted: false });
    expect(wrongSelectorOperation).toMatchObject({ enforceable: true, operationGranted: false });
    expect(authorizeRepositoryPath(wrongGrantOperation, "README.md").reason).toBe("operation-not-granted");
    expect(authorizeRepositoryPath(wrongSelectorOperation, "README.md").reason).toBe("operation-not-granted");
  });

  it("gives matching forbidden grants precedence and detects a global forbid", () => {
    const bounded = compileWriteAuthorization({
      operation: "repair",
      allowedWrites: [grant(pathGlob("src/**"))],
      forbiddenWrites: [grant(pathGlob("src/private/**"))],
    });
    const global = compileWriteAuthorization({
      operation: "repair",
      allowedWrites: [grant(pathGlob("**"))],
      forbiddenWrites: [grant(operationEquals("repair"))],
    });

    expect(authorizeRepositoryPath(bounded, "src/public/api.ts").authorized).toBe(true);
    expect(authorizeRepositoryPath(bounded, "src/private/key.ts")).toEqual({ authorized: false, reason: "forbidden-scope" });
    expect(global).toMatchObject({ enforceable: true, operationGranted: false });
    expect(authorizeRepositoryPath(global, "README.md").reason).toBe("operation-not-granted");
  });

  it("fails closed for unsupported selector algebra even when another grant would allow", () => {
    const compiled = compileWriteAuthorization({
      operation: "repair",
      allowedWrites: [
        grant(pathGlob("**")),
        grant({ op: "any", items: [pathEquals("README.md"), pathEquals("package.json")] }),
      ],
      forbiddenWrites: [],
    });

    expect(compiled.enforceable).toBe(false);
    expect(compiled.reasons).toContain("allowed write selector cannot be enforced deterministically");
    expect(authorizeRepositoryPath(compiled, "README.md").reason).toBe("unsupported-selector");
  });

  it("fails closed for malformed selectors and observed repository paths", () => {
    const malformedSelector = compileWriteAuthorization({
      operation: "repair",
      allowedWrites: [grant(pathGlob("../outside/**"))],
      forbiddenWrites: [],
    });
    const compiled = compileWriteAuthorization({
      operation: "repair",
      allowedWrites: [grant(pathGlob("**"))],
      forbiddenWrites: [],
    });

    expect(malformedSelector.enforceable).toBe(false);
    for (const path of ["", "/etc/passwd", "../secret", "src/../secret", "C:\\secret", "src//file.ts", "src/./file.ts"]) {
      expect(authorizeRepositoryPath(compiled, path).reason).toBe("invalid-repository-path");
    }
    expect(normalizeRepositoryRelativePath("./src\\file.ts")).toBe("src/file.ts");
  });

  it("uses one deterministic glob contract", () => {
    expect(matchesCanonicalGlob("scripts/**/*.mjs", "scripts/check.mjs")).toBe(true);
    expect(matchesCanonicalGlob("scripts/**/*.mjs", "scripts/release/check.mjs")).toBe(true);
    expect(matchesCanonicalGlob("src/?pi.ts", "src/api.ts")).toBe(true);
    expect(matchesCanonicalGlob("src/?pi.ts", "src/deep/api.ts")).toBe(false);
  });
});
