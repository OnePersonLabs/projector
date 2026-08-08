import { hashFramedDomain, type AnalyzerCapabilities, type ContentHash } from "@projector/core";
import { describe, expect, it } from "vitest";

import { compileAuthenticatedAnalyzerTopology } from "./index.js";

const hash = (value: string): ContentHash => hashFramedDomain("fixture", value);
const capability = (version = "2"): AnalyzerCapabilities => ({ analyzerId: "projector.typescript-semantic", adapterVersion: version, supportedLanguages: ["TypeScript"], supportedSemantics: ["event-topology", "public-contract-topology"], enumeration: { observability: "bounded", method: "bounded static syntax inventory", assumptions: ["inventory complete for route scope"], blindSpots: ["dynamic names are route-local unknowns"], dynamicMechanisms: ["computed event names"] }, executesRepositoryCode: false });

describe("authenticated route-local topology", () => {
  it("emits zero-consumer bindable routes and preserves exact siblings beside an open dynamic route", () => {
    const topology = compileAuthenticatedAnalyzerTopology({
      subjects: [
        { subjectId: "event:known", subjectKind: "event", semanticKey: "known", scopeKey: "pkg:a", artifactHash: hash("known"), dynamic: false },
        { subjectId: "event:dynamic", subjectKind: "event", semanticKey: "dynamic", scopeKey: "pkg:b", artifactHash: hash("dynamic"), dynamic: true },
      ],
      participants: [{ subjectId: "event:dynamic", participantId: "consumer:b", role: "consumer", evidenceIds: ["call:b"], artifactHash: hash("b") }],
      capabilities: [capability()], failures: [],
    });
    expect(topology.routes.find(({ subjectId }) => subjectId === "event:known")).toMatchObject({ consumerIds: [], observability: "bounded", queryVersion: "2" });
    expect(topology.routes.find(({ subjectId }) => subjectId === "event:dynamic")).toMatchObject({ consumerIds: ["consumer:b"], observability: "open" });
  });

  it("derives assurance/version from capability evidence and localizes failures", () => {
    const input = { subjects: [{ subjectId: "contract:a", subjectKind: "contract" as const, semanticKey: "A", scopeKey: "pkg:a", artifactHash: hash("a"), dynamic: false }], participants: [{ subjectId: "contract:a", participantId: "producer:a", role: "producer" as const, evidenceIds: ["export:a"], artifactHash: hash("a") }] };
    const before = compileAuthenticatedAnalyzerTopology({ ...input, capabilities: [capability("2")], failures: [] }).routes[0]!;
    const after = compileAuthenticatedAnalyzerTopology({ ...input, capabilities: [capability("3")], failures: [] }).routes[0]!;
    expect(after.id).toBe(before.id);
    expect(after.queryVersion).not.toBe(before.queryVersion);
    expect(after.contentHash).not.toBe(before.contentHash);
    const failed = compileAuthenticatedAnalyzerTopology({ ...input, capabilities: [capability("2")], failures: [{ analyzerId: "projector.typescript-semantic", capability: "event-topology", scope: "pkg:other", message: "other route failed", recoverable: true, affectedClaimKinds: ["event-topology"] }] }).routes[0]!;
    expect(failed.observability).toBe("bounded");
    expect(failed.links[0]?.assurance).toBe("exact");
  });
});
