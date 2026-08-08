import { hashFramedDomain, type ContentHash, type RelevanceClosure, type SelectorExpr, type StateDigest } from "@projector/core";
import { describe, expect, it } from "vitest";

import { discoverArchitectureConcerns } from "./discovery.js";

const hash = (value: string): ContentHash => `sha256:v1:${value.padEnd(64, "0")}`;
const scope: SelectorExpr = { op: "atom", field: "platform", matcher: "in", value: ["web", "desktop", "android", "ios"] };
const state: StateDigest = {
  gitBase: "base",
  worktreeDigest: hash("worktree"),
  canonicalProjectorDigest: hash("canonical"),
  toolchainDigest: hash("toolchain"),
};
const closure: RelevanceClosure = {
  id: "closure:cross-platform",
  requestHash: hash("request"),
  seeds: [],
  entries: [{ entityId: "requirement:targets", band: "direct", score: 1, requiredForPlanning: true, reasons: [] }],
  activatedFacetKeys: ["platform", "public-contract"],
  unknowns: [],
  unavailableLanes: [],
  boundState: { compiledAgainst: state, valueDependencies: [], queryDependencies: [], dependencyDigest: hash("binding") },
  contentHash: hash("closure"),
};

describe("progressive architecture concern discovery", () => {
  it("activates a bounded cross-platform question frontier without selecting technology answers", () => {
    const first = discoverArchitectureConcerns({
      closure,
      changes: [{ kind: "surface-added", activationFacets: ["platform-target", "workspace-expansion", "public-contract", "distribution"], subjectIds: ["desktop", "android", "ios"], explanation: "add native targets", scope }],
      inferred: [{ key: "task-orchestration", title: "Task orchestration", question: "When do scripts stop being sufficient?", scope, materiality: "deferable", subjectIds: ["requirement:targets"] }],
    });
    const reordered = discoverArchitectureConcerns({
      closure,
      changes: [{ kind: "surface-added", activationFacets: ["distribution", "public-contract", "workspace-expansion", "platform-target"], subjectIds: ["ios", "desktop", "android"], explanation: "add native targets", scope }],
      inferred: [{ key: "task-orchestration", title: "Task orchestration", question: "When do scripts stop being sufficient?", scope, materiality: "deferable", subjectIds: ["requirement:targets"] }],
    });

    expect(first.concerns.map(({ key }) => key)).toEqual(expect.arrayContaining([
      "workspace-topology", "cross-platform-runtime", "shared-code-boundary", "dependency-version-coherence",
      "api-contract", "build-release", "distribution-signing", "task-orchestration",
    ]));
    expect(first.concerns.some((concern) => /nx|turbo|tauri|react native|graphql/iu.test(`${concern.title} ${concern.question}`))).toBe(false);
    expect(first.concerns.find(({ key }) => key === "distribution-signing")?.materiality).toBe("blocking-now");
    expect(first.contentHash).toBe(reordered.contentHash);
  });

  it("refuses to lower deterministic security/platform/public-contract minima or accept circular justification", () => {
    expect(() => discoverArchitectureConcerns({
      closure,
      changes: [{ kind: "surface-added", activationFacets: ["distribution"], subjectIds: ["ios"], explanation: "distribution surface", scope }],
      inferred: [{ key: "distribution-signing", title: "Distribution", question: "How is distribution secured?", scope, materiality: "deferable", subjectIds: ["ios"] }],
    })).not.toThrow();
    const result = discoverArchitectureConcerns({
      closure,
      changes: [{ kind: "surface-added", activationFacets: ["distribution"], subjectIds: ["ios"], explanation: "distribution surface", scope }],
      inferred: [{
        key: "generated-loop", title: "Generated loop", question: "Does generated state justify itself?", scope,
        materiality: "blocking-now", subjectIds: ["requirement:other"], originatingDecision: { decisionId: "decision:generated-loop", semanticHash: hashFramedDomain("architecture-concern-origin", { decisionId: "decision:generated-loop" }) },
      }],
    });
    expect(result.concerns.find(({ key }) => key === "distribution-signing")?.materiality).toBe("blocking-now");
    expect(result.concerns.some(({ key }) => key === "generated-loop")).toBe(false);
    expect(result.unknowns.join(" ")).toMatch(/circular/iu);
  });
});
