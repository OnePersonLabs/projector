import { describe, expect, test } from "vitest";

import { comparePackageVersions } from "./version-order.js";

describe("numeric package version ordering", () => {
  test.each([
    ["1.9.0", "1.10.0", -1],
    ["2.0.0", "1.99.99", 1],
    ["2.1.0-alpha", "2.1.0", -1],
    ["2.1.0-alpha.10", "2.1.0-alpha.2", 1],
    ["2.1.0-99999999999999999999", "2.1.0-100000000000000000000", -1],
    ["2.1.0-alpha", "2.1.0-1", 1],
    ["2.1.0+windows", "2.1.0+linux", 0],
  ] as const)("orders %s against %s", (left, right, expected) => {
    expect(comparePackageVersions(left, right)).toBe(expected);
    expect(comparePackageVersions(right, left)).toBe(expected === 0 ? 0 : -expected);
  });
});
