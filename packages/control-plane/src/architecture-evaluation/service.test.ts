import { expect, test } from "vitest";
import { hashFramedDomain, hashSemantic, type ArchitectureConcern, type Evidence } from "@projector/core";
import { evaluateArchitectureOptions } from "./service.js";

const payload = { id: "concern:test", key: "test", title: "Storage", question: "Which storage?", scope: { op: "atom", field: "path", matcher: "glob", value: "src/**" }, sourceClass: "authored", status: "active", materiality: "blocking-now", activationReasons: [], relatedConceptIds: [], relatedRequirementIds: [], decisionIds: [], evidence: [] };
const concern = { ...payload, semanticHash: hashSemantic("architecture-concern", payload) } as ArchitectureConcern;
const observation = { canonical: { documents: [{ id: concern.id, kind: "architecture-concern", payload: concern }] } } as unknown as Parameters<typeof evaluateArchitectureOptions>[0];
const request = { concernId: concern.id, options: [{ key: "a", title: "A", description: "Candidate", hardConstraintStatus: "passes", tradeoffs: [], evidence: [], preferenceFit: [] }] };
test("missing required research blocks recommendations for the canonical concern", async () => {
  const result = await evaluateArchitectureOptions(observation, request);
  expect(result.acceptanceBlocked).toBe(true);
  expect(result.evaluation.recommendedOptionKey).toBeUndefined();
  expect(result.canonicalMutationAuthorized).toBe(false);
});
test("request cannot disable required concern research", async () => {
  expect((await evaluateArchitectureOptions(observation, { ...request, research: { required: false, records: [], maxAgeDays: 999999 } })).acceptanceBlocked).toBe(true);
});
test("unavailable canonical preferences fail authentication", async () => {
  await expect(evaluateArchitectureOptions(observation, { ...request, preferenceIds: ["preference:untrusted"] })).rejects.toThrow(/preference.*unavailable/u);
});
const research: Evidence = { id: "evidence:research", kind: "official-documentation", locator: "https://example.com/support", capturedAt: "2026-09-26T00:00:00.000Z", sourceDate: "2026-09-25", contentHash: hashFramedDomain("research", "source"), excerpt: "Support statement", claims: [{ subjectKey: concern.id, predicate: "evaluated", object: true }, { subjectKey: "a", predicate: "supported", object: true }], reliability: "high", normativeAuthority: "authoritative-guidance", independenceGroup: "vendor", applicability: "direct", freshness: 1, causalOrigin: { kind: "external" }, metadata: {} };
test("stale submitted research cannot establish a current recommendation", async () => {
  const result = await evaluateArchitectureOptions(observation, { ...request, options: [{ ...request.options[0], evidence: [{ evidenceId: research.id, stance: "supports" }] }], research: { records: [{ ...research, capturedAt: "2020-01-01" }] } }, { now: () => "2026-09-27T00:00:00.000Z" });
  expect(result.acceptanceBlocked).toBe(true);
});
test("current applicable provenance permits a candidate recommendation without mutation authority", async () => {
  const result = await evaluateArchitectureOptions(observation, { ...request, options: [{ ...request.options[0], evidence: [{ evidenceId: research.id, stance: "supports" }] }], research: { records: [research] } }, { now: () => "2026-09-27T00:00:00.000Z" });
  expect(result.evaluation.recommendedOptionKey).toBe("a");
  expect(result.acceptanceBlocked).toBe(false);
  expect(result.canonicalMutationAuthorized).toBe(false);
});
test("canonical preferences are authenticated even when omitted by the caller", async () => {
  const preference = { id: "preference:bad", key: "bad", scope: "project", selector: { op: "atom", field: "tag", matcher: "equals", value: "a" }, strength: "prefer", statement: "Choose A", status: "active", sourceClass: "authored", semanticHash: hashFramedDomain("wrong", "hash") };
  const withPreference = { canonical: { ...observation.canonical, documents: [...observation.canonical.documents, { id: preference.id, kind: "developer-preference", payload: preference }] } } as unknown as Parameters<typeof evaluateArchitectureOptions>[0];
  await expect(evaluateArchitectureOptions(withPreference, request)).rejects.toThrow(/semantic authentication/u);
});
test("unrelated project preference does not displace applicable user preference", async () => {
  const makePreference = (scope: string, key: string, option: string) => {
    const payload = { id: `preference:${key}`, key, scope, selector: { op: "atom", field: "tag", matcher: "equals", value: option }, strength: "prefer", statement: `Prefer ${option}`, status: "active", sourceClass: "authored" };
    return { id: payload.id, kind: "developer-preference", payload: { ...payload, semanticHash: hashSemantic("developer-preference", payload) } };
  };
  const scoped = { canonical: { ...observation.canonical, documents: [...observation.canonical.documents, makePreference("project", "unrelated", "z"), makePreference("user", "relevant", "b")] } } as unknown as Parameters<typeof evaluateArchitectureOptions>[0];
  const nonblocking = { ...concern, materiality: "deferable" };
  nonblocking.semanticHash = hashSemantic("architecture-concern", nonblocking);
  const local = { canonical: { ...scoped.canonical, documents: scoped.canonical.documents.map((record) => record.id === concern.id ? { ...record, payload: nonblocking } : record) } };
  const result = await evaluateArchitectureOptions(local, { ...request, options: [...request.options, { ...request.options[0], key: "b" }], research: { required: false } });
  expect(result.evaluation.recommendedOptionKey).toBe("b");
});
