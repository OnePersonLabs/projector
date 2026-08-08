import { describe, expect, it } from "vitest";

import {
  DependencyScopedStateBindingValidator,
  InMemoryGraphReader,
  MANDATORY_VERTICAL_SLICE_STEPS,
  StateBoundChangeExecutor,
  QueryDependencyRegistry,
  compileProjectionLenses,
  compileAuthenticatedCoverageSnapshot,
  createExecutionCapsule,
  createStateBinding,
  evaluateSelector,
  groupCausalEvidence,
  reconcileToFixedPoint,
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
    expect(compileAuthenticatedCoverageSnapshot).toBeTypeOf("function");
    expect(createExecutionCapsule).toBeTypeOf("function");
    expect(StateBoundChangeExecutor).toBeTypeOf("function");
    expect(reconcileToFixedPoint).toBeTypeOf("function");
    expect(MANDATORY_VERTICAL_SLICE_STEPS).toHaveLength(17);
  });
});
