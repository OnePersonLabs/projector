import assert from "node:assert/strict";
import test from "node:test";

import { validateRepository } from "./validate-repo.mjs";

test("repository validation recognizes declared automation", async () => {
  assert.deepEqual(await validateRepository(), ["build:index", "check:links", "test", "validate:repo"]);
});
