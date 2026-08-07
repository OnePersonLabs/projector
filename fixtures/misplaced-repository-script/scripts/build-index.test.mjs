import assert from "node:assert/strict";
import test from "node:test";

import { buildIndex } from "./build-index.mjs";

test("builds a stable repository index", () => {
  assert.equal(buildIndex(["zeta", "alpha"]), "alpha\nzeta");
});
