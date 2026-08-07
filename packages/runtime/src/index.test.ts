import { describe, expect, it } from "vitest";

import {
  CanonicalFileRepository,
  SqliteDerivedStore,
  assertSupportedCanonicalVersions,
  currentSqliteSchemaVersion,
} from "./index.js";

describe("runtime public entrypoint", () => {
  it("exports the Slice 0 persistence primitives", () => {
    expect(CanonicalFileRepository).toBeTypeOf("function");
    expect(SqliteDerivedStore).toBeTypeOf("function");
    expect(assertSupportedCanonicalVersions).toBeTypeOf("function");
    expect(currentSqliteSchemaVersion).toBe(1);
  });
});
