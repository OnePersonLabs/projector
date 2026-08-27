import { describe, expect, it } from "vitest";

import { isSafeSpecificationManifestPath } from "./task19-dogfood.mjs";

describe("manifest-addressed Projector dogfood root", () => {
  it("keeps manifest members inside PROJECTOR_SPEC", () => {
    expect(isSafeSpecificationManifestPath("12-delivery/release-and-directive.md")).toBe(true);
    for (const path of ["/etc/passwd", "../outside.md", "nested/../../outside.md", "https://example.invalid/spec.md", "C:\\outside.md", "nested/%2e%2e/outside.md"]) {
      expect(isSafeSpecificationManifestPath(path), path).toBe(false);
    }
  });
});
