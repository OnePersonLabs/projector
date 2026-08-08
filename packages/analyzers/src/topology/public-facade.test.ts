import * as analyzers from "../index.js";
import { describe, expect, it } from "vitest";

describe("analyzers public facade", () => {
  it("exports event and contract topology through the root barrel", () => {
    expect(analyzers.compileEventContractTopology).toBeDefined();
  });
});
