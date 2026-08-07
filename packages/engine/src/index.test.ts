import { describe, expect, it } from "vitest";

import {
  DependencyScopedStateBindingValidator,
  InMemoryGraphReader,
  QueryDependencyRegistry,
  createStateBinding,
} from "./index.js";

describe("engine public entrypoint", () => {
  it("exports the Slice 0 state and query primitives", () => {
    expect(DependencyScopedStateBindingValidator).toBeTypeOf("function");
    expect(InMemoryGraphReader).toBeTypeOf("function");
    expect(QueryDependencyRegistry).toBeTypeOf("function");
    expect(createStateBinding).toBeTypeOf("function");
  });
});
