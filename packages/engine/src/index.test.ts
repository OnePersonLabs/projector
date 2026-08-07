import { describe, expect, it } from "vitest";

import {
  DependencyScopedStateBindingValidator,
  InMemoryGraphReader,
  StateBoundChangeExecutor,
  QueryDependencyRegistry,
  compileProjectionLenses,
  createExecutionCapsule,
  createStateBinding,
  evaluateSelector,
  groupCausalEvidence,
} from "./index.js";

describe("engine public entrypoint", () => {
  it("exports the Slice 0 state and query primitives", () => {
    expect(DependencyScopedStateBindingValidator).toBeTypeOf("function");
    expect(InMemoryGraphReader).toBeTypeOf("function");
    expect(QueryDependencyRegistry).toBeTypeOf("function");
    expect(createStateBinding).toBeTypeOf("function");
    expect(groupCausalEvidence).toBeTypeOf("function");
    expect(evaluateSelector).toBeTypeOf("function");
    expect(compileProjectionLenses).toBeTypeOf("function");
    expect(createExecutionCapsule).toBeTypeOf("function");
    expect(StateBoundChangeExecutor).toBeTypeOf("function");
  });
});
