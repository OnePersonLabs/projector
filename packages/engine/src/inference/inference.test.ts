import { describe, expect, it } from "vitest";

import { evidence, projectionUnit } from "../governance/test-fixtures.js";
import { groupCausalEvidence, inferPatternFamilies, summarizeEvidenceSupport } from "./index.js";

describe("causal evidence grouping", () => {
  it("collapses copied occurrences and discounts Projector-generated support for its causal lens", () => {
    const items = [
      ...Array.from({ length: 40 }, (_, index) => evidence(`copy-${index}`, "scaffold:legacy")),
      evidence("independent-a", "author:a"),
      evidence("independent-b", "author:b"),
      evidence("projector-repair", "repair:1", {
        causalOrigin: { kind: "lens-transform", causedByLensId: "lens:repository-script" },
      }),
    ];

    const groups = groupCausalEvidence(items, { targetLensId: "lens:repository-script" });
    const support = summarizeEvidenceSupport({ evidence: items, targetLensId: "lens:repository-script" });

    expect(groups).toHaveLength(4);
    expect(groups.find(({ independenceGroup }) => independenceGroup === "scaffold:legacy")?.evidenceIds).toHaveLength(40);
    expect(groups.find(({ independenceGroup }) => independenceGroup === "repair:1")?.authorityEligible).toBe(false);
    expect(support.independentOccurrenceCount).toBe(3);
    expect(support.generatedEvidenceIds).toEqual(["projector-repair"]);
  });

  it("defaults every Projector-caused occurrence to authority-ineligible without requiring a target", () => {
    const items = [
      evidence("human-source", "human:source"),
      evidence("lens-output", "generated:lens", {
        causalOrigin: { kind: "lens-transform", causedByLensId: "lens:any" },
      }),
      evidence("rule-output", "generated:rule", {
        causalOrigin: { kind: "semantic-resolution", causedByRuleId: "rule:any", causedByTransformId: "transform:any" },
      }),
      evidence("plan-output", "generated:plan", {
        causalOrigin: { kind: "plan", causedByPlanId: "plan:any" },
      }),
      evidence("model-output", "generated:model", { causalOrigin: { kind: "model-inference" } }),
      evidence("relevance-output", "generated:relevance", { causalOrigin: { kind: "relevance-analysis" } }),
      evidence("surprise-output", "generated:surprise", { causalOrigin: { kind: "planning-surprise" } }),
    ];

    const groups = groupCausalEvidence(items);
    const summary = summarizeEvidenceSupport({ evidence: items });

    expect(groups.filter(({ authorityEligible }) => authorityEligible).map(({ independenceGroup }) => independenceGroup))
      .toEqual(["human:source"]);
    expect(summary.independentOccurrenceCount).toBe(1);
    expect(summary.generatedEvidenceIds).toEqual([
      "lens-output",
      "model-output",
      "plan-output",
      "relevance-output",
      "rule-output",
      "surprise-output",
    ]);
  });

  it.each(["open", "sampled", "unavailable"] as const)("never treats an empty %s lane as absence proof", (observability) => {
    const summary = summarizeEvidenceSupport({
      evidence: [],
      lanes: [{ id: "external", observability, assumptions: [], unavailable: observability === "unavailable" }],
    });

    expect(summary.absenceProven).toBe(false);
    expect(summary.proofCaveats).not.toEqual([]);
  });
});

describe("descriptive pattern inference", () => {
  it("keeps generated members visible without turning them into independent authority or an AuthorityRecord", () => {
    const candidate = inferPatternFamilies([
      {
        familyKey: "repository-automation",
        purposeHypothesis: "repository-wide automation",
        classification: "member",
        independenceGroup: "human:a",
        unit: projectionUnit("script-a", { path: "scripts/a.mjs" }),
        evidence: [{ evidenceId: "e:a", stance: "supports" }],
      },
      {
        familyKey: "repository-automation",
        purposeHypothesis: "repository-wide automation",
        classification: "member",
        independenceGroup: "repair:a",
        unit: projectionUnit("script-generated", {
          path: "scripts/generated.mjs",
          causalOrigin: { kind: "lens-transform", causedByLensId: "lens:repository-script" },
        }),
        evidence: [{ evidenceId: "e:generated", stance: "supports" }],
      },
    ])[0]!;

    expect(candidate.memberUnitIds).toEqual(["script-a", "script-generated"]);
    expect(candidate.independenceGroups).toEqual(["human:a"]);
    expect(candidate).not.toHaveProperty("authorityRecordId");
    expect(candidate).not.toHaveProperty("status", "active");
  });
});
