import {
  RepositoryImpactReferenceSchema,
  RepositoryImpactReportSchema,
  readDerivedObservationSource
} from "./shared-HUQ6JTJS.js";
import {
  runObservationTask
} from "./shared-2INZJVA6.js";
import {
  RepositoryPathService,
  readDerivedCacheSource,
  touchDerivedCacheEntry,
  withDerivedCacheAdmission,
  withObservationScope
} from "./shared-EHAKQ7RC.js";
import {
  AnalyzerCapabilitiesSchema,
  AnalyzerFailureSchema,
  ApplicationEvidenceAssessmentRequestSchema,
  ApplicationEvidenceAssessmentSchema,
  ApplicationEvidencePredicateBindingSchema,
  AuthorityReconsiderTriggerSchema,
  CodeContextSummarySchema,
  ContentHashSchema,
  DecisionValidityAssessmentSchema,
  NormalizedPredicateSchema,
  RelevanceClosureSchema,
  StateBindingSchema,
  StateBindingValidationSchema,
  StateDigestSchema,
  StateValueDependencyRefSchema,
  applicationEvidenceDependencies,
  assessApplicationEvidence,
  canonicalJson,
  hashFramedDomain
} from "./shared-AJ5KBTH5.js";

// node_modules/@projector/control-plane/dist/knowledge/types.js
import { z as z2 } from "zod";

// node_modules/@projector/control-plane/dist/knowledge/application-evidence.js
import { z } from "zod";
var unavailable = z.strictObject({
  status: z.literal("unavailable"),
  owner: z.strictObject({ kind: z.enum(["requirement", "behavioral-scenario"]), id: z.string().min(1), canonicalDocumentHash: ContentHashSchema }),
  binding: ApplicationEvidencePredicateBindingSchema,
  evidenceIds: z.array(z.string().min(1)).min(1),
  dependencies: z.array(StateValueDependencyRefSchema),
  reason: z.string().min(1).max(4096),
  contentHash: ContentHashSchema
});
var assessed = z.strictObject({
  status: z.literal("assessed"),
  owner: z.strictObject({ kind: z.enum(["requirement", "behavioral-scenario"]), id: z.string().min(1), canonicalDocumentHash: ContentHashSchema }),
  binding: ApplicationEvidencePredicateBindingSchema,
  evidenceIds: z.array(z.string().min(1)).min(1),
  assessment: ApplicationEvidenceAssessmentSchema,
  dependencies: z.array(StateValueDependencyRefSchema),
  contentHash: ContentHashSchema
});
var KnowledgeApplicationEvidenceAssessmentSchema = z.discriminatedUnion("status", [unavailable, assessed]);
async function assessKnowledgeApplicationEvidence(input) {
  const results = [];
  for (const envelope of input.observation.canonical.documents.filter(({ kind, id }) => (kind === "requirement" || kind === "behavioral-scenario") && input.ownerIds.includes(id))) {
    if (envelope.kind !== "requirement" && envelope.kind !== "behavioral-scenario")
      continue;
    for (const group of applicationGroups(envelope)) {
      input.signal.throwIfAborted();
      const scenario = scenarioDisposition(input.observation, group.binding);
      const owner = { kind: envelope.kind, id: envelope.id, canonicalDocumentHash: envelope.canonicalDocumentHash };
      const base = { owner, binding: group.binding, evidenceIds: group.evidenceIds, dependencies: [scenario.dependency] };
      if (scenario.status !== "matched") {
        results.push(withHash({ status: "unavailable", ...base, reason: scenario.reason }));
        continue;
      }
      if (input.port === void 0) {
        results.push(withHash({ status: "unavailable", ...base, reason: "Authenticated application evidence assessment is unavailable for this repository observation." }));
        continue;
      }
      try {
        const request = ApplicationEvidenceAssessmentRequestSchema.parse({
          schemaVersion: "application-evidence-assessment-request@1",
          owner,
          binding: group.binding,
          evidenceIds: group.evidenceIds
        });
        const assessment = ApplicationEvidenceAssessmentSchema.parse(await assessApplicationEvidence(input.port, request, { signal: input.signal }));
        input.signal.throwIfAborted();
        results.push(withHash({ status: "assessed", ...base, assessment, dependencies: [...base.dependencies, ...applicationEvidenceDependencies(assessment)] }));
      } catch (error) {
        input.signal.throwIfAborted();
        results.push(withHash({ status: "unavailable", ...base, reason: (error instanceof Error ? error.message : String(error)).slice(0, 4096) }));
      }
    }
  }
  return results.sort((left, right) => assessmentKey(left).localeCompare(assessmentKey(right)));
}
function applicationEvidenceDisposition(items) {
  if (items.length === 0)
    return "not-applicable";
  const assessedItems = items.filter((item) => item.status === "assessed");
  if (assessedItems.some(({ assessment }) => assessment.fulfillment.status === "violated"))
    return "violated";
  if (items.some(({ status }) => status === "unavailable"))
    return "unknown";
  if (assessedItems.some(({ assessment }) => assessment.fulfillment.status === "unknown"))
    return "unknown";
  return "satisfied";
}
function applicationEvidenceDependencies2(items) {
  return items.flatMap((item) => item.dependencies);
}
function assessmentKey(item) {
  const binding = item.binding;
  return canonicalJson([item.owner.kind, item.owner.id, binding.adapter.id, binding.adapter.version, binding.scenario, binding.case, binding.predicateId, binding.assertionIds]);
}
function applicationGroups(envelope) {
  const groups = /* @__PURE__ */ new Map();
  const evidence = Array.isArray(envelope.payload.evidence) ? envelope.payload.evidence : [];
  for (const raw of evidence) {
    if (typeof raw !== "object" || raw === null || !("applicationPredicate" in raw) || !("evidenceId" in raw))
      continue;
    const parsed = ApplicationEvidencePredicateBindingSchema.safeParse(raw.applicationPredicate);
    if (!parsed.success || typeof raw.evidenceId !== "string")
      continue;
    const binding = parsed.data;
    const key = canonicalJson([binding.adapter.id, binding.adapter.version, binding.scenario, binding.case, binding.predicateId, binding.assertionIds]);
    const group = groups.get(key) ?? { binding, evidenceIds: [] };
    group.evidenceIds.push(raw.evidenceId);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({ ...group, evidenceIds: [...new Set(group.evidenceIds)].sort() }));
}
function withHash(body) {
  return { ...body, contentHash: hashFramedDomain("knowledge-application-evidence-assessment/v1", body) };
}
function scenarioDisposition(observation, binding) {
  const addressed = observation.canonical.readDocument?.(binding.scenario.id);
  const envelope = observation.canonical.readDocument === void 0 ? observation.canonical.documents.find(({ kind, id }) => kind === "behavioral-scenario" && id === binding.scenario.id) : addressed?.kind === "behavioral-scenario" ? addressed : void 0;
  const observedSemanticHash = envelope !== void 0 && typeof envelope.payload.semanticHash === "string" ? envelope.payload.semanticHash : null;
  const status = envelope === void 0 ? "missing" : observedSemanticHash === binding.scenario.semanticHash ? "matched" : "mismatched";
  const versionHash = hashFramedDomain("application-evidence-scenario-disposition/v1", { scenarioId: binding.scenario.id, status, canonicalDocumentHash: envelope?.canonicalDocumentHash ?? null, semanticHash: observedSemanticHash });
  return {
    status,
    reason: status === "matched" ? "The referenced canonical scenario meaning is current." : status === "missing" ? `Referenced application-evidence scenario ${binding.scenario.id} is absent.` : `Referenced application-evidence scenario ${binding.scenario.id} no longer has semantic hash ${binding.scenario.semanticHash}.`,
    dependency: StateValueDependencyRefSchema.parse({ kind: "external-snapshot", id: `application-evidence-scenario:${binding.scenario.id}`, versionHash, role: "Observed canonical scenario meaning referenced by the application predicate" })
  };
}

// node_modules/@projector/control-plane/dist/knowledge/types.js
var KNOWLEDGE_API_VERSION = "projector.knowledge/v1";
var candidateSignalSchema = z2.enum(["id", "key", "alias", "lexical", "lineage", "tombstone"]);
var KnowledgeInterpretationCandidateSchema = z2.strictObject({
  entityId: z2.string().min(1),
  entityKind: z2.enum(["concept", "requirement", "scenario", "architecture-decision", "architecture-concern", "developer-preference", "projection-unit", "projection-lens"]),
  score: z2.number().min(0).max(1).finite(),
  direct: z2.boolean(),
  signals: z2.array(candidateSignalSchema),
  explanation: z2.string(),
  continuityFromIds: z2.array(z2.string())
});
var KnowledgeInterpretationSchema = z2.strictObject({
  status: z2.enum(["direct", "candidates", "unresolved"]),
  candidates: z2.array(KnowledgeInterpretationCandidateSchema),
  unknowns: z2.array(z2.string())
});
var KnowledgeLensObligationSchema = z2.strictObject({
  lensId: z2.string(),
  lensVersion: z2.string(),
  lensSemanticHash: ContentHashSchema,
  authorityRecordId: z2.string(),
  unitId: z2.string(),
  membershipFingerprint: ContentHashSchema,
  applicabilityFingerprint: ContentHashSchema,
  ruleIds: z2.array(z2.string()),
  predicates: z2.array(NormalizedPredicateSchema),
  validatorIds: z2.array(z2.string()),
  expectationKinds: z2.array(z2.string()),
  status: z2.enum(["applicable", "unknown"]),
  unknowns: z2.array(z2.string())
});
var relevanceMetricsSchema = z2.strictObject({
  consideredEdgeCount: z2.number().int().nonnegative(),
  includedEdgeCount: z2.number().int().nonnegative(),
  duplicateEdgeCount: z2.number().int().nonnegative(),
  belowThresholdEdgeCount: z2.number().int().nonnegative(),
  budgetDeferredEdgeCount: z2.number().int().nonnegative(),
  frontierCount: z2.number().int().nonnegative(),
  irrelevantExpansionRate: z2.number().min(0).max(1).finite(),
  closureSize: z2.number().int().nonnegative()
});
var compiledContextSchema = z2.strictObject({
  sourceClosureId: z2.string(),
  items: z2.array(z2.strictObject({
    entityId: z2.string(),
    sourceSemanticHash: ContentHashSchema,
    kind: z2.enum(["concept", "requirement", "scenario", "decision", "projection-unit", "other"]),
    band: z2.enum(["direct", "governing", "consequence", "possible"]),
    disclosure: z2.enum(["full", "summary", "identity"]),
    content: z2.string(),
    relevanceScore: z2.number().finite(),
    relevanceReasons: z2.array(z2.string()),
    uncertainty: z2.array(z2.string()),
    confidence: z2.number().finite()
  })),
  unknowns: z2.array(z2.string()),
  estimatedCost: z2.number().nonnegative(),
  requiredBudgetOverrun: z2.number().nonnegative(),
  requiredExpansionIds: z2.array(z2.string()),
  contentHash: ContentHashSchema
});
var KnowledgeDecisionValiditySchema = z2.strictObject({
  decisionId: z2.string(),
  authorityId: z2.string(),
  baseline: z2.strictObject({ kind: z2.enum(["authenticated-transaction", "tracked-git-history", "unavailable"]), reference: z2.string().optional(), reason: z2.string().optional() }),
  checks: z2.array(z2.strictObject({ trigger: AuthorityReconsiderTriggerSchema, status: z2.enum(["current", "fired", "unknown", "unobserved"]), reason: z2.string() })),
  assessment: DecisionValidityAssessmentSchema,
  contentHash: ContentHashSchema
});
var governanceEvaluationSchema = z2.strictObject({
  unitId: z2.string(),
  status: z2.enum(["conformant", "violated", "unknown"]),
  findings: z2.array(z2.strictObject({
    id: z2.string(),
    unitId: z2.string(),
    ruleId: z2.string(),
    predicateHash: ContentHashSchema,
    status: z2.enum(["satisfied", "violated", "unknown"]),
    reason: z2.string(),
    evidenceIds: z2.array(z2.string())
  })),
  boundary: z2.array(z2.string()),
  observationHash: ContentHashSchema,
  contentHash: ContentHashSchema
});
var KnowledgeContextBranchSchema = z2.strictObject({
  id: z2.string(),
  interpretation: KnowledgeInterpretationCandidateSchema,
  hypothesis: z2.boolean(),
  closure: RelevanceClosureSchema,
  context: compiledContextSchema,
  metrics: relevanceMetricsSchema,
  frontier: z2.array(z2.string()),
  lensObligations: z2.array(KnowledgeLensObligationSchema),
  decisionValidity: z2.array(KnowledgeDecisionValiditySchema).optional(),
  governanceEvaluations: z2.array(governanceEvaluationSchema).optional(),
  applicationEvidence: z2.array(KnowledgeApplicationEvidenceAssessmentSchema),
  sourceFingerprint: ContentHashSchema,
  semanticFingerprint: ContentHashSchema,
  queryFingerprint: ContentHashSchema
});
var KnowledgeContextResultSchema = z2.strictObject({
  code: CodeContextSummarySchema.optional(),
  impactBaseline: RepositoryImpactReferenceSchema.optional(),
  apiVersion: z2.literal(KNOWLEDGE_API_VERSION),
  id: z2.string(),
  request: z2.string(),
  requestFingerprint: ContentHashSchema,
  operation: z2.string(),
  requestOptions: z2.strictObject({
    entities: z2.array(z2.string()),
    namedTargets: z2.array(z2.string()),
    operation: z2.string(),
    policy: z2.strictObject({
      maxCandidates: z2.number().int().positive(),
      maxEntries: z2.number().int().positive(),
      maxDepth: z2.number().int().nonnegative(),
      maxTraversalCost: z2.number().nonnegative(),
      minimumScore: z2.number().min(0).max(1),
      maxContextCost: z2.number().nonnegative()
    })
  }),
  capturedState: StateDigestSchema,
  discoveryBinding: StateBindingSchema,
  interpretation: KnowledgeInterpretationSchema,
  branches: z2.array(KnowledgeContextBranchSchema),
  analyzerCapabilities: z2.array(AnalyzerCapabilitiesSchema),
  analyzerFailures: z2.array(AnalyzerFailureSchema),
  unknowns: z2.array(z2.string()),
  persisted: z2.boolean(),
  contentHash: ContentHashSchema
});
var KnowledgeReconciliationResultSchema = z2.strictObject({
  impact: RepositoryImpactReportSchema.optional(),
  scopeChanges: z2.strictObject({
    scope: z2.literal("retained-context"),
    addedEntityIds: z2.array(z2.string()),
    removedFromContextEntityIds: z2.array(z2.string()),
    changedSemanticEntityIds: z2.array(z2.string()),
    changedSourceEntityIds: z2.array(z2.string()),
    changedQueryIds: z2.array(z2.string()),
    unknownDependencyIds: z2.array(z2.string()),
    frontierEntityIds: z2.array(z2.string()),
    unknowns: z2.array(z2.string())
  }).optional(),
  apiVersion: z2.literal(KNOWLEDGE_API_VERSION),
  contextId: z2.string(),
  capturedState: StateDigestSchema,
  currentState: StateDigestSchema,
  status: z2.enum(["current", "rebound", "stale", "suspect", "unavailable"]),
  discoveryValidation: StateBindingValidationSchema,
  branches: z2.array(z2.strictObject({ branchId: z2.string(), validation: StateBindingValidationSchema })),
  governance: z2.strictObject({
    status: z2.enum(["conformant", "violated", "unknown", "not-applicable"]),
    regeneratedContextId: z2.string(),
    branches: z2.array(z2.strictObject({
      interpretationEntityId: z2.string(),
      retainedBranchId: z2.string().optional(),
      currentBranchId: z2.string().optional(),
      decisionValidity: z2.array(KnowledgeDecisionValiditySchema).optional(),
      status: z2.enum(["conformant", "violated", "unknown", "not-applicable"]),
      evaluations: z2.array(z2.strictObject({
        unitId: z2.string(),
        status: z2.enum(["conformant", "violated", "unknown"]),
        findings: z2.array(z2.strictObject({
          id: z2.string(),
          unitId: z2.string(),
          ruleId: z2.string(),
          predicateHash: ContentHashSchema,
          status: z2.enum(["satisfied", "violated", "unknown"]),
          reason: z2.string(),
          evidenceIds: z2.array(z2.string())
        })),
        boundary: z2.array(z2.string()),
        observationHash: ContentHashSchema,
        contentHash: ContentHashSchema
      })),
      reasons: z2.array(z2.string())
    })),
    reasons: z2.array(z2.string())
  }),
  applicationEvidence: z2.strictObject({
    status: z2.enum(["satisfied", "violated", "unknown", "not-applicable"]),
    branches: z2.array(z2.strictObject({ branchId: z2.string(), status: z2.enum(["satisfied", "violated", "unknown", "not-applicable"]), changed: z2.boolean(), reasons: z2.array(z2.string()) }))
  }),
  reasons: z2.array(z2.string()),
  contentHash: ContentHashSchema
});

// node_modules/@projector/control-plane/dist/knowledge/store.js
var storeRoot = ".projector/runtime/knowledge/contexts";
function finalizeKnowledgeContext(basis) {
  const contentHash = hashFramedDomain("knowledge-context-record", basis);
  return { ...basis, id: `knowledge_context_${contentHash.slice(-32)}`, contentHash };
}
function authenticate(value) {
  const parsed = KnowledgeContextResultSchema.parse(value);
  const { id: _id, contentHash: _contentHash, ...basis } = parsed;
  const expected = finalizeKnowledgeContext(basis);
  if (parsed.id !== expected.id || parsed.contentHash !== expected.contentHash) {
    throw new Error(`knowledge context ${parsed.id} failed content authentication`);
  }
  return parsed;
}
function authenticateKnowledgeContextSource(source) {
  return authenticate(KnowledgeContextResultSchema.parse(JSON.parse(source)));
}
function filename(contextId) {
  if (!/^knowledge_context_[0-9a-f]{32}$/u.test(contextId))
    throw new Error(`invalid knowledge context selector: ${contextId}`);
  return `${contextId.slice("knowledge_context_".length)}.json`;
}
function knowledgeContextWrite(context) {
  const authenticated = authenticate(context);
  if (!authenticated.persisted)
    throw new Error("non-persisting knowledge context cannot be written to the derived cache");
  return { relativePath: `${storeRoot}/${filename(authenticated.id)}`, content: `${canonicalJson(authenticated)}
` };
}
var KnowledgeContextStore = class _KnowledgeContextStore {
  paths;
  constructor(paths) {
    this.paths = paths;
  }
  static async create(repositoryRoot) {
    return new _KnowledgeContextStore(await RepositoryPathService.create(repositoryRoot));
  }
  async write(context, session) {
    const write = knowledgeContextWrite(context);
    if (session === void 0)
      await withDerivedCacheAdmission(this.paths.root, (cache) => cache.publish(write.relativePath, write.content));
    else
      await session.publish(write.relativePath, write.content);
    return this.read(context.id);
  }
  async read(contextId, touch = true, authenticator) {
    return withObservationScope({}, async (scope) => {
      let source;
      try {
        const cached = await readDerivedCacheSource(this.paths.root, `${storeRoot}/${filename(contextId)}`, scope);
        if (cached !== void 0)
          source = cached;
        else {
          const path = await this.paths.resolveRead(`${storeRoot}/${filename(contextId)}`);
          source = await readDerivedObservationSource(path.realTarget, contextId, scope);
        }
      } catch (error) {
        if (isCode(error, "ENOENT"))
          throw new Error(`Saved context ${contextId} is no longer in the disposable cache; request fresh persisted context and refresh or replan any dormant capture before approval`, { cause: error });
        throw error;
      }
      const context = authenticator === void 0 ? await runObservationTask("authenticate-context", { source }, { ...scope, maxDerivedBytes: scope.limits.maxDerivedBytes, maxWorkerHeapMiB: scope.limits.maxWorkerHeapMiB }) : await authenticator(source);
      scope.budget.check("context-authentication", contextId);
      scope.signal.throwIfAborted();
      if (context.id !== contextId)
        throw new Error("knowledge context selector does not match authenticated identity");
      if (touch)
        await touchDerivedCacheEntry(this.paths.root, `${storeRoot}/${filename(contextId)}`);
      return context;
    });
  }
};
function isCode(error, code) {
  return error instanceof Error && "code" in error && error.code === code;
}

export {
  KnowledgeApplicationEvidenceAssessmentSchema,
  assessKnowledgeApplicationEvidence,
  applicationEvidenceDisposition,
  applicationEvidenceDependencies2 as applicationEvidenceDependencies,
  assessmentKey,
  KNOWLEDGE_API_VERSION,
  KnowledgeInterpretationCandidateSchema,
  KnowledgeLensObligationSchema,
  KnowledgeDecisionValiditySchema,
  governanceEvaluationSchema,
  KnowledgeContextResultSchema,
  KnowledgeReconciliationResultSchema,
  finalizeKnowledgeContext,
  authenticateKnowledgeContextSource,
  knowledgeContextWrite,
  KnowledgeContextStore
};
