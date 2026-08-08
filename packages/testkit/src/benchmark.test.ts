import { describe, expect, it } from "vitest";
import { REQUIRED_BENCHMARK_GATES } from "./benchmark.js";
describe("release benchmark inventory", () => { it("keeps the exact immutable 17-gate definition", () => { expect(REQUIRED_BENCHMARK_GATES).toHaveLength(17); expect(Object.isFrozen(REQUIRED_BENCHMARK_GATES)).toBe(true); }); });
