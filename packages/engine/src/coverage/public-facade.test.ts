import { describe, expect, it } from "vitest";
import * as coverage from "@projector/engine/coverage";

describe("coverage public facade", () => {
  it("exports the built composition surface", () => {
    expect(coverage.compileAuthenticatedCoverageSnapshot).toBeDefined();
    expect(coverage.rankCompletionQuestions).toBeDefined();
    expect(coverage.resumeCleanupPlan).toBeDefined();
    expect(coverage.computeCoverageQualityMetrics).toBeDefined();
  });
});
