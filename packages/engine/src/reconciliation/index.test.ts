import { describe, expect, it } from "vitest";

import type { ContentHash } from "@projector/core";

import {
  MANDATORY_VERTICAL_SLICE_STEPS,
  NonconvergentReconciliationError,
  assertMandatoryVerticalSliceEvidence,
  reconcileToFixedPoint,
} from "./index.js";

describe("reconcileToFixedPoint", () => {
  it("requires a zero-material-delta terminal iteration", async () => {
    const outcomes = [
      { governedStateDigest: ("sha256:v1:" + "1".repeat(64)) as ContentHash, materialChanged: true, fixedPointTerminal: true },
      { governedStateDigest: ("sha256:v1:" + "1".repeat(64)) as ContentHash, materialChanged: false, fixedPointTerminal: true },
    ] as const;

    const result = await reconcileToFixedPoint({
      async iterate(iteration) {
        return outcomes[iteration - 1]!;
      },
    });

    expect(result.converged).toBe(true);
    expect(result.iterations).toHaveLength(2);
    expect(result.materialDelta).toBe(false);
  });

  it("rejects a repeated nonterminal governed digest", async () => {
    await expect(reconcileToFixedPoint({
      async iterate(iteration) {
        return {
          governedStateDigest: `sha256:v1:${(iteration % 2 === 0 ? "2" : "1").repeat(64)}` as const,
          materialChanged: true,
          fixedPointTerminal: false,
        };
      },
    })).rejects.toBeInstanceOf(NonconvergentReconciliationError);
  });
});

describe("mandatory vertical-slice evidence", () => {
  it("requires all seventeen steps in normative order", () => {
    expect(MANDATORY_VERTICAL_SLICE_STEPS).toHaveLength(17);
    expect(() => assertMandatoryVerticalSliceEvidence(
      MANDATORY_VERTICAL_SLICE_STEPS.map((step, index) => ({
        step,
        sequence: index + 1,
        summary: `evidence for ${step}`,
      })),
    )).not.toThrow();
    expect(() => assertMandatoryVerticalSliceEvidence(
      MANDATORY_VERTICAL_SLICE_STEPS.slice(1).map((step, index) => ({
        step,
        sequence: index + 1,
        summary: `evidence for ${step}`,
      })),
    )).toThrow(/17 ordered steps/u);
  });
});
