import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DerivedObservationBudget, hashFramedDomain, withCanonicalHashes, type AdapterContext, type ArchitectureDecision, type AuthorityRecord, type Concept } from "@projector/core";
import { createRepositoryScriptLens } from "@projector/engine";
import { CanonicalFileRepository, withObservationScope } from "@projector/runtime";
import { expect, it, vi } from "vitest";
import { observeIndexedRepository } from "../change-lifecycle/indexed-observer.js";
import { KnowledgeGraph, KNOWLEDGE_QUERY_PROGRAMS } from "./graph.js";
import { IndexedKnowledgeGraph } from "./indexed-graph.js";
import { IndexedGovernance } from "./indexed-governance.js";
import { RepositoryKnowledgeService } from "./service.js";
import type { KnowledgeComputeHost } from "../observation/knowledge-host.js";

it("preserves eager identity, addressed sources and query results through indexed reads", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-indexed-knowledge-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    await writeFile(join(root, "package.json"), '{"name":"indexed-knowledge","type":"module"}');
    await writeFile(join(root, "shared.ts"), "export const shared = 1;\n");
    await writeFile(join(root, "consumer.ts"), 'import { shared } from "./shared.js"; export const consumer = shared;\n');
    const meaning: Concept = { id: "concept:shared", key: "shared-meaning", kind: "capability", name: "Shared meaning", aliases: ["common"], statement: "Keep shared meaning visible.", status: "active", sourceClass: "authored", confidence: 1, tags: [], evidence: [], semanticHash: hashFramedDomain("test-semantic", "shared"), discoveryHash: hashFramedDomain("test-discovery", "shared") };
    await new CanonicalFileRepository(root).write(withCanonicalHashes({ apiVersion: "projector/v3", schemaVersion: "3.0.0", kind: "concept", id: meaning.id, key: meaning.key, lifecycle: meaning.status, payload: { ...meaning } }));
    const authority = (id: string, subjectId: string): AuthorityRecord => ({ id, key: id, subjectId, status: "approved", conclusion: "normalize", rationale: "Keep the observed source population complete.", alternatives: [], assumptions: [], reconsiderWhen: [{ type: "manual-review" }], vector: { explicitDecisionAlignment: 1, productConstraintFit: 1, semanticFit: 1, independentOccurrence: 1, historicalStability: 1, independentValidationSupport: 1, boundaryCoherence: 1, maintenanceOutcome: 1, platformCompatibility: 1, externalRationale: 0, ecosystemHealth: 0, securitySupport: 0, reversibility: 1, migrationCost: 0, counterEvidence: 0 }, assessmentConfidence: "high", evidence: [], governanceRiskClass: "R1", decidedBy: "user", createdAt: "2026-09-09T00:00:00.000Z", semanticHash: hashFramedDomain("authority", id) });
    const lensAuthority = authority("authority:population", "lens:population");
    const decisionAuthority = authority("authority:choice", "concern:choice");
    const selector = { op: "atom", field: "path", matcher: "glob", value: "**/*.ts" } as const;
    const base = createRepositoryScriptLens({ id: "lens:population", status: "active", authorityRecordId: lensAuthority.id, selector, governanceBasis: [{ kind: "hard-constraint", conceptId: meaning.id }] });
    const rule = { ...base.rules[0]!, id: "rule:population", key: "rule:population", predicates: [{ kind: "cardinality" as const, selector, min: 2 }], validatorIds: [], transformIds: [], semanticHash: hashFramedDomain("cardinality-rule", "population") };
    const lens = { ...base, rules: [rule], validators: base.validators.map((validator) => ({ ...validator, input: { ruleIds: [rule.id] } })), expectedProjections: base.expectedProjections.map((projection) => ({ ...projection, expectation: { kind: "predicate-constrained" as const, predicateIds: [rule.id], validatorIds: [] } })), impactRules: [] };
    const decision: ArchitectureDecision = { id: "decision:choice", key: "choice", concernId: decisionAuthority.subjectId, title: "Source choice", decision: "Keep both source units.", selectedOptionKey: "both", scope: selector, lifecycle: "active", authorityRecordId: decisionAuthority.id, governanceBasis: [], consequences: [], appliedPreferences: [], supersedesDecisionIds: [], semanticHash: hashFramedDomain("decision", "choice") };
    for (const record of [lensAuthority, decisionAuthority]) await new CanonicalFileRepository(root).write(withCanonicalHashes({ apiVersion: "projector/v3", schemaVersion: "3.0.0", kind: "authority-record", id: record.id, key: record.key, lifecycle: record.status, payload: { ...record } }));
    await new CanonicalFileRepository(root).write(withCanonicalHashes({ apiVersion: "projector/v3", schemaVersion: "3.0.0", kind: "projection-lens", id: lens.id, key: lens.key, lifecycle: lens.status, payload: { ...lens } }));
    await new CanonicalFileRepository(root).write(withCanonicalHashes({ apiVersion: "projector/v3", schemaVersion: "3.0.0", kind: "architecture-decision", id: decision.id, key: decision.key, lifecycle: decision.lifecycle, payload: { ...decision } }));
    await withObservationScope({}, async () => {
      const observation = await observeIndexedRepository(root);
      try {
        const full = observation.materialize();
        const decisionHost = { now: () => "2026-09-27T12:00:00.000Z", readDecisionBaseline: async () => ({ kind: "unavailable" as const, reason: "No accepted baseline." }) };
        const eager = new KnowledgeGraph(full, decisionHost);
        const budget = new DerivedObservationBudget();
        const indexed = new IndexedKnowledgeGraph(observation.descriptor, observation.store, (registry) => new IndexedGovernance(observation.descriptor, observation.store, registry, decisionHost, budget), budget);
        const context: AdapterContext = { repositoryRoot: root, stateDigest: observation.descriptor.metadata.state, config: {}, signal: new AbortController().signal };
        for (const request of [meaning.id, meaning.key, "common", "visible", "missing"]) {
          expect(indexed.search(request, [], 10)).toEqual(eager.search(request, [], 10));
          expect(indexed.search("inspect", [request], 10)).toEqual(eager.search("inspect", [request], 10));
        }
        const addressedReads = vi.spyOn(observation.store, "getAt");
        expect(indexed.search("unfindable unrelated vocabulary", [], 10)).toEqual(eager.search("unfindable unrelated vocabulary", [], 10));
        expect(addressedReads.mock.calls.filter(([, kind]) => kind === "knowledge-identity")).toHaveLength(0);
        addressedReads.mockRestore();
        expect(indexed.resolveNamedTargets(["shared.ts", "consumer.ts", "missing.ts"])).toEqual(eager.resolveNamedTargets(["shared.ts", "consumer.ts", "missing.ts"]));
        const unitId = observation.store.populationAt(observation.descriptor.generation, "unit-path:shared.ts")[0]!;
        for (const id of [meaning.id, unitId]) {
          expect(await indexed.load(id)).toEqual(await eager.load(id));
          expect(indexed.valueDependencies([id])).toEqual(eager.valueDependencies([id]));
          expect(indexed.sourceHash(id)).toEqual(eager.sourceHash(id));
        }
        for (const [programId, input] of [
          [KNOWLEDGE_QUERY_PROGRAMS.identity, { request: "inspect", addressed: [meaning.id], namedTargets: ["shared.ts"] }],
          [KNOWLEDGE_QUERY_PROGRAMS.relations, { subjectId: meaning.id }],
          [KNOWLEDGE_QUERY_PROGRAMS.implementation, { subjectId: meaning.id }],
          [KNOWLEDGE_QUERY_PROGRAMS.topology, { unitId }],
        ] as const) {
          const query = eager.registry.createSpec({ id: "oracle", programId, input });
          expect(await indexed.registry.evaluateObserved(query, context)).toEqual(await eager.registry.evaluateObserved(query, context));
        }
        const eagerDependencies: import("@projector/core").StateQueryDependency[] = [];
        const indexedDependencies: import("@projector/core").StateQueryDependency[] = [];
        expect(await indexed.discovery(context, indexedDependencies).discover(unitId, 0, context)).toEqual(await eager.discovery(context, eagerDependencies).discover(unitId, 0, context));
        expect(indexedDependencies).toEqual(eagerDependencies);
        const selected = new Set([unitId, lens.id, decision.id]);
        expect(eager.lensCompilationUnknown).toBeUndefined();
        expect(eager.lensObligations(selected, "change")).toHaveLength(1);
        expect(indexed.lensObligations(selected, "change")).toEqual(eager.lensObligations(selected, "change"));
        expect(indexed.governanceEvaluations(selected, "change")).toEqual(eager.governanceEvaluations(selected, "change"));
        expect(await indexed.bindDecisionApplicability(decision.id, context)).toEqual(await eager.bindDecisionApplicability(decision.id, context));
        expect(await indexed.bindDecisionTriggers(decision.id, "change", context)).toEqual(await eager.bindDecisionTriggers(decision.id, "change", context));
        const computeHost: KnowledgeComputeHost = { continuation: async () => { throw new Error("Unexpected continuation"); }, baseline: decisionHost.readDecisionBaseline, validators: async () => ({ findings: [], executed: false }), applicationEvidence: async () => [], freshState: async () => full.state, readImpact: async () => { throw new Error("Ordinary context must not create an impact baseline"); } };
        const request = { request: "inspect source choice", namedTargets: ["shared.ts"], entities: [decision.id], persist: false };
        const indexedResult = await RepositoryKnowledgeService.computeContext(request, full, decisionHost, computeHost, new DerivedObservationBudget(), indexed);
        const eagerResult = await RepositoryKnowledgeService.computeContext(request, full, decisionHost, computeHost, new DerivedObservationBudget(), eager);
        expect(indexedResult).toEqual(eagerResult);
        for (const [programId, input] of [
          [KNOWLEDGE_QUERY_PROGRAMS.lensMembership, { unitId: "unit:missing" }],
          [KNOWLEDGE_QUERY_PROGRAMS.decisionMembership, { unitId: "unit:missing" }],
          [KNOWLEDGE_QUERY_PROGRAMS.decisionApplicability, { decisionId: "decision:missing" }],
        ] as const) {
          const query = eager.registry.createSpec({ id: "known-absence", programId, input });
          expect(await indexed.registry.evaluateObserved(query, context)).toEqual(await eager.registry.evaluateObserved(query, context));
        }
        await new CanonicalFileRepository(root).delete("architecture-decision", decision.id);
        await rm(join(root, "shared.ts"));
        const changed = await observeIndexedRepository(root, { rebuild: true });
        try {
          const changedFull = changed.materialize();
          const changedEager = new KnowledgeGraph(changedFull, decisionHost);
          const changedBudget = new DerivedObservationBudget();
          const changedIndexed = new IndexedKnowledgeGraph(changed.descriptor, changed.store, (registry) => new IndexedGovernance(changed.descriptor, changed.store, registry, decisionHost, changedBudget), changedBudget);
          expect(await RepositoryKnowledgeService.computeReconciliation(indexedResult.result, changedFull, decisionHost, computeHost, new DerivedObservationBudget(), changedIndexed)).toEqual(await RepositoryKnowledgeService.computeReconciliation(eagerResult.result, changedFull, decisionHost, computeHost, new DerivedObservationBudget(), changedEager));
        } finally { changed.close(); }
      } finally { observation.close(); }
    });
  } finally { await rm(root, { recursive: true, force: true }); }
});
