import assert from "node:assert/strict";
import test from "node:test";

import { findBrokenLinks } from "./check-links.mjs";

test("reports broken repository links", () => {
  assert.deepEqual(findBrokenLinks(["docs:start", "missing:old"]), ["missing:old"]);
});
