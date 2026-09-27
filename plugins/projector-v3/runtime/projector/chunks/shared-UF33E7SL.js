import { createRequire as __projectorCreateRequire } from "node:module"; const require = __projectorCreateRequire(import.meta.url);
import {
  RepositoryImpactReferenceSchema,
  RepositoryImpactReportSchema,
  readDerivedObservationSource
} from "./shared-XUCQQRWD.js";
import {
  runObservationTask
} from "./shared-HODAXZKW.js";
import {
  RepositoryPathService,
  touchDerivedCacheEntry,
  withDerivedCacheAdmission,
  withObservationScope
} from "./shared-3WNQLUKU.js";
import {
  AnalyzerCapabilitiesSchema,
  AnalyzerFailureSchema,
  ApplicationEvidenceAssessmentRequestSchema,
  ApplicationEvidenceAssessmentSchema,
  ApplicationEvidencePredicateBindingSchema,
  AuthorityReconsiderTriggerSchema,
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
  external_exports,
  hashFramedDomain
} from "./shared-6VIFAIKJ.js";

// node_modules/@projector/control-plane/dist/knowledge/application-evidence.js
var unavailable = external_exports.strictObject({
  status: external_exports.literal("unavailable"),
  owner: external_exports.strictObject({ kind: external_exports.enum(["requirement", "behavioral-scenario"]), id: external_exports.string().min(1), canonicalDocumentHash: ContentHashSchema }),
  binding: ApplicationEvidencePredicateBindingSchema,
  evidenceIds: external_exports.array(external_exports.string().min(1)).min(1),
  dependencies: external_exports.array(StateValueDependencyRefSchema),
  reason: external_exports.string().min(1).max(4096),
  contentHash: ContentHashSchema
});
var assessed = external_exports.strictObject({
  status: external_exports.literal("assessed"),
  owner: external_exports.strictObject({ kind: external_exports.enum(["requirement", "behavioral-scenario"]), id: external_exports.string().min(1), canonicalDocumentHash: ContentHashSchema }),
  binding: ApplicationEvidencePredicateBindingSchema,
  evidenceIds: external_exports.array(external_exports.string().min(1)).min(1),
  assessment: ApplicationEvidenceAssessmentSchema,
  dependencies: external_exports.array(StateValueDependencyRefSchema),
  contentHash: ContentHashSchema
});
var KnowledgeApplicationEvidenceAssessmentSchema = external_exports.discriminatedUnion("status", [unavailable, assessed]);
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
  const envelope = observation.canonical.documents.find(({ kind, id }) => kind === "behavioral-scenario" && id === binding.scenario.id);
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
var candidateSignalSchema = external_exports.enum(["id", "key", "alias", "lexical", "lineage", "tombstone"]);
var KnowledgeInterpretationCandidateSchema = external_exports.strictObject({
  entityId: external_exports.string().min(1),
  entityKind: external_exports.enum(["concept", "requirement", "scenario", "architecture-decision", "architecture-concern", "developer-preference", "projection-unit", "projection-lens"]),
  score: external_exports.number().min(0).max(1).finite(),
  direct: external_exports.boolean(),
  signals: external_exports.array(candidateSignalSchema),
  explanation: external_exports.string(),
  continuityFromIds: external_exports.array(external_exports.string())
});
var KnowledgeInterpretationSchema = external_exports.strictObject({
  status: external_exports.enum(["direct", "candidates", "unresolved"]),
  candidates: external_exports.array(KnowledgeInterpretationCandidateSchema),
  unknowns: external_exports.array(external_exports.string())
});
var KnowledgeLensObligationSchema = external_exports.strictObject({
  lensId: external_exports.string(),
  lensVersion: external_exports.string(),
  lensSemanticHash: ContentHashSchema,
  authorityRecordId: external_exports.string(),
  unitId: external_exports.string(),
  membershipFingerprint: ContentHashSchema,
  applicabilityFingerprint: ContentHashSchema,
  ruleIds: external_exports.array(external_exports.string()),
  predicates: external_exports.array(NormalizedPredicateSchema),
  validatorIds: external_exports.array(external_exports.string()),
  expectationKinds: external_exports.array(external_exports.string()),
  status: external_exports.enum(["applicable", "unknown"]),
  unknowns: external_exports.array(external_exports.string())
});
var relevanceMetricsSchema = external_exports.strictObject({
  consideredEdgeCount: external_exports.number().int().nonnegative(),
  includedEdgeCount: external_exports.number().int().nonnegative(),
  duplicateEdgeCount: external_exports.number().int().nonnegative(),
  belowThresholdEdgeCount: external_exports.number().int().nonnegative(),
  budgetDeferredEdgeCount: external_exports.number().int().nonnegative(),
  frontierCount: external_exports.number().int().nonnegative(),
  irrelevantExpansionRate: external_exports.number().min(0).max(1).finite(),
  closureSize: external_exports.number().int().nonnegative()
});
var compiledContextSchema = external_exports.strictObject({
  sourceClosureId: external_exports.string(),
  items: external_exports.array(external_exports.strictObject({
    entityId: external_exports.string(),
    sourceSemanticHash: ContentHashSchema,
    kind: external_exports.enum(["concept", "requirement", "scenario", "decision", "projection-unit", "other"]),
    band: external_exports.enum(["direct", "governing", "consequence", "possible"]),
    disclosure: external_exports.enum(["full", "summary", "identity"]),
    content: external_exports.string(),
    relevanceScore: external_exports.number().finite(),
    relevanceReasons: external_exports.array(external_exports.string()),
    uncertainty: external_exports.array(external_exports.string()),
    confidence: external_exports.number().finite()
  })),
  unknowns: external_exports.array(external_exports.string()),
  estimatedCost: external_exports.number().nonnegative(),
  requiredBudgetOverrun: external_exports.number().nonnegative(),
  requiredExpansionIds: external_exports.array(external_exports.string()),
  contentHash: ContentHashSchema
});
var KnowledgeDecisionValiditySchema = external_exports.strictObject({
  decisionId: external_exports.string(),
  authorityId: external_exports.string(),
  baseline: external_exports.strictObject({ kind: external_exports.enum(["authenticated-transaction", "tracked-git-history", "unavailable"]), reference: external_exports.string().optional(), reason: external_exports.string().optional() }),
  checks: external_exports.array(external_exports.strictObject({ trigger: AuthorityReconsiderTriggerSchema, status: external_exports.enum(["current", "fired", "unknown", "unobserved"]), reason: external_exports.string() })),
  assessment: DecisionValidityAssessmentSchema,
  contentHash: ContentHashSchema
});
var governanceEvaluationSchema = external_exports.strictObject({
  unitId: external_exports.string(),
  status: external_exports.enum(["conformant", "violated", "unknown"]),
  findings: external_exports.array(external_exports.strictObject({
    id: external_exports.string(),
    unitId: external_exports.string(),
    ruleId: external_exports.string(),
    predicateHash: ContentHashSchema,
    status: external_exports.enum(["satisfied", "violated", "unknown"]),
    reason: external_exports.string(),
    evidenceIds: external_exports.array(external_exports.string())
  })),
  boundary: external_exports.array(external_exports.string()),
  observationHash: ContentHashSchema,
  contentHash: ContentHashSchema
});
var KnowledgeContextBranchSchema = external_exports.strictObject({
  id: external_exports.string(),
  interpretation: KnowledgeInterpretationCandidateSchema,
  hypothesis: external_exports.boolean(),
  closure: RelevanceClosureSchema,
  context: compiledContextSchema,
  metrics: relevanceMetricsSchema,
  frontier: external_exports.array(external_exports.string()),
  lensObligations: external_exports.array(KnowledgeLensObligationSchema),
  decisionValidity: external_exports.array(KnowledgeDecisionValiditySchema).optional(),
  governanceEvaluations: external_exports.array(governanceEvaluationSchema).optional(),
  applicationEvidence: external_exports.array(KnowledgeApplicationEvidenceAssessmentSchema),
  sourceFingerprint: ContentHashSchema,
  semanticFingerprint: ContentHashSchema,
  queryFingerprint: ContentHashSchema
});
var KnowledgeContextResultSchema = external_exports.strictObject({
  impactBaseline: RepositoryImpactReferenceSchema.optional(),
  apiVersion: external_exports.literal(KNOWLEDGE_API_VERSION),
  id: external_exports.string(),
  request: external_exports.string(),
  requestFingerprint: ContentHashSchema,
  operation: external_exports.string(),
  requestOptions: external_exports.strictObject({
    entities: external_exports.array(external_exports.string()),
    namedTargets: external_exports.array(external_exports.string()),
    operation: external_exports.string(),
    policy: external_exports.strictObject({
      maxCandidates: external_exports.number().int().positive(),
      maxEntries: external_exports.number().int().positive(),
      maxDepth: external_exports.number().int().nonnegative(),
      maxTraversalCost: external_exports.number().nonnegative(),
      minimumScore: external_exports.number().min(0).max(1),
      maxContextCost: external_exports.number().nonnegative()
    })
  }),
  capturedState: StateDigestSchema,
  discoveryBinding: StateBindingSchema,
  interpretation: KnowledgeInterpretationSchema,
  branches: external_exports.array(KnowledgeContextBranchSchema),
  analyzerCapabilities: external_exports.array(AnalyzerCapabilitiesSchema),
  analyzerFailures: external_exports.array(AnalyzerFailureSchema),
  unknowns: external_exports.array(external_exports.string()),
  persisted: external_exports.boolean(),
  contentHash: ContentHashSchema
});
var KnowledgeReconciliationResultSchema = external_exports.strictObject({
  impact: RepositoryImpactReportSchema.optional(),
  apiVersion: external_exports.literal(KNOWLEDGE_API_VERSION),
  contextId: external_exports.string(),
  capturedState: StateDigestSchema,
  currentState: StateDigestSchema,
  status: external_exports.enum(["current", "rebound", "stale", "suspect", "unavailable"]),
  discoveryValidation: StateBindingValidationSchema,
  branches: external_exports.array(external_exports.strictObject({ branchId: external_exports.string(), validation: StateBindingValidationSchema })),
  governance: external_exports.strictObject({
    status: external_exports.enum(["conformant", "violated", "unknown", "not-applicable"]),
    regeneratedContextId: external_exports.string(),
    branches: external_exports.array(external_exports.strictObject({
      interpretationEntityId: external_exports.string(),
      retainedBranchId: external_exports.string().optional(),
      currentBranchId: external_exports.string().optional(),
      decisionValidity: external_exports.array(KnowledgeDecisionValiditySchema).optional(),
      status: external_exports.enum(["conformant", "violated", "unknown", "not-applicable"]),
      evaluations: external_exports.array(external_exports.strictObject({
        unitId: external_exports.string(),
        status: external_exports.enum(["conformant", "violated", "unknown"]),
        findings: external_exports.array(external_exports.strictObject({
          id: external_exports.string(),
          unitId: external_exports.string(),
          ruleId: external_exports.string(),
          predicateHash: ContentHashSchema,
          status: external_exports.enum(["satisfied", "violated", "unknown"]),
          reason: external_exports.string(),
          evidenceIds: external_exports.array(external_exports.string())
        })),
        boundary: external_exports.array(external_exports.string()),
        observationHash: ContentHashSchema,
        contentHash: ContentHashSchema
      })),
      reasons: external_exports.array(external_exports.string())
    })),
    reasons: external_exports.array(external_exports.string())
  }),
  applicationEvidence: external_exports.strictObject({
    status: external_exports.enum(["satisfied", "violated", "unknown", "not-applicable"]),
    branches: external_exports.array(external_exports.strictObject({ branchId: external_exports.string(), status: external_exports.enum(["satisfied", "violated", "unknown", "not-applicable"]), changed: external_exports.boolean(), reasons: external_exports.array(external_exports.string()) }))
  }),
  reasons: external_exports.array(external_exports.string()),
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
      const path = await this.paths.resolveRead(`${storeRoot}/${filename(contextId)}`);
      let source;
      try {
        source = await readDerivedObservationSource(path.realTarget, contextId, scope);
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
