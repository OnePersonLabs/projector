import {
  BuiltinVerificationService,
  GeneratedOutputService,
  LifecycleApplyOutputSchema,
  LifecycleApprovalOutputSchema,
  LifecycleCaptureOutputSchema,
  LifecyclePlanOutputSchema,
  LifecycleRecoveryOutputSchema,
  PreparedProjectInitializationResultSchema,
  RepositoryCheckOutputSchema,
  RepositoryRepresentationProfileReconciliationService,
  RepresentationProfileReconciliationOperationOutputSchema,
  RepresentationProfileReconciliationOutputSchema,
  VerificationService,
  assessGitIntegration,
  checkRepository,
  evaluateRepositoryArchitectureOptions,
  executeCodeOperation,
  executeCodeTestReplay,
  initializePreparedProject,
  inspectProjectReadiness,
  projectLifecycleApply,
  projectLifecycleApproval,
  projectLifecycleCapture,
  projectLifecyclePlan,
  projectLifecycleRecovery,
  projectRepresentationProfileReconciliationOperation,
  withProjectOperationAccess
} from "./shared-IUM5GDZ5.js";
import {
  RepositoryCleanupOutputSchema,
  RepositoryCompletionOutputSchema,
  RepositoryCoverageOutputSchema,
  inspectRepositoryCoverage
} from "./shared-BA2BEPNL.js";
import {
  KnowledgeContextInspectOperationOutputSchema,
  KnowledgeContextOperationOutputSchema,
  KnowledgeReconciliationOperationOutputSchema,
  RepositoryChangeLifecycleService,
  RepositoryKnowledgeService,
  RepositoryRepresentationInspectionService,
  RepresentationInspectionOperationOutputSchema,
  RepresentationInspectionOutputSchema,
  RepresentationPendingOutputSchema,
  RepresentationRecoveryOutputSchema,
  inspectKnowledgeContext,
  projectKnowledgeContext,
  projectKnowledgeReconciliation,
  projectRepresentationInspectionOperation
} from "./shared-3PAR7O5R.js";
import {
  runObservationTask
} from "./shared-FFVGFO5N.js";
import {
  NativeProcessLauncher,
  OperationalReportSchema,
  collectCanonicalSnapshotSources,
  createOperationalReport,
  currentObservationScope,
  parseOperationalReport,
  unavailableOperationalEvidence,
  withObservationScope
} from "./shared-GXAKKSCS.js";
import {
  collectLocalRepositoryInputs
} from "./shared-XAKKJSHO.js";
import {
  ApplicationEvidenceAssessmentRequestSchema,
  ArchitectureEvaluationOutputSchema,
  BuiltinVerificationAssessmentSchema,
  BuiltinVerificationEvidenceSchema,
  BuiltinVerificationInspectionSchema,
  BuiltinVerificationRecoverySchema,
  CodeEvidenceResultSchema,
  CodeExportResultSchema,
  CodeImpactResultSchema,
  CodeIndexRunSchema,
  CodeIndexStatusSchema,
  CodeQueryEvidenceSchema,
  CodeTestRunResultSchema,
  CodeTestsResultSchema,
  DEFAULT_OBSERVATION_LIMITS,
  GeneratedOutputEvidenceSchema,
  GeneratedOutputInspectionSchema,
  GeneratedOutputRecoverySchema,
  GitIntegrationAssessmentSchema,
  ObservationError,
  ObservationLimitsOverrideSchema,
  ObservationLimitsSchema,
  PackageIdentitySchema,
  ProjectReadinessSchema,
  ProjectorOperationInputSchemas,
  ProjectorOperationSchema,
  VerificationEvidenceSchema,
  VerificationInspectionSchema,
  VerificationRecoverySchema,
  applicationEvidenceDependencies,
  assessApplicationEvidence,
  canonicalJson,
  createProjectorOperationRequestSchema,
  createProjectorOperationResultSchema,
  hashApplicationEvidenceAssessment,
  hashFramedDomain,
  projectorOperationApiVersion,
  projectorOperationResultApiVersion
} from "./shared-Q56AARV7.js";

// dist/operation-runner.js
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { join } from "node:path";
import { z as z2 } from "zod";

// dist/operational-verification.js
async function runReadOnlyOperationalVerification(repositoryRoot, options) {
  return withObservationScope({ signal: options.signal }, () => verifyWithinScope(repositoryRoot, options));
}
async function verifyWithinScope(repositoryRoot, options) {
  const started = Date.now();
  options.signal.throwIfAborted();
  const knowledge = await inspectCanonicalKnowledge(repositoryRoot);
  options.signal.throwIfAborted();
  const scope = currentObservationScope();
  const collected = await collectLocalRepositoryInputs({ repositoryRoot, budget: scope.budget, signal: scope.signal });
  const analysis = await runObservationTask("analyze-collected", { collected }, scope);
  options.signal.throwIfAborted();
  let coverage;
  let coverageFailure;
  try {
    if (knowledge.findings.length > 0)
      throw new Error("Canonical knowledge is invalid; dependent coverage cannot be evaluated.");
    coverage = await inspectRepositoryCoverage(repositoryRoot, { scope: "." }, "coverage", {
      signal: options.signal,
      ...options.applicationEvidence === void 0 ? {} : { applicationEvidence: options.applicationEvidence }
    });
  } catch (error) {
    options.signal.throwIfAborted();
    if (error instanceof ObservationError)
      throw error;
    coverageFailure = error instanceof Error ? error.message : String(error);
  }
  options.signal.throwIfAborted();
  const requiredLaneKeys = [
    "authority",
    "architecture-decision",
    "lens",
    "rule-enforceability",
    "validation-evidence"
  ];
  const requiredLanes = requiredLaneKeys.map((key) => coverage?.lanes.find((lane) => lane.key === key));
  const unavailableLanes = requiredLaneKeys.filter((_key, index) => {
    const lane = requiredLanes[index];
    return lane === void 0 || lane.observability === "unavailable" || lane.numerator !== lane.denominator || lane.blindSpots.length > 0;
  });
  const verificationFindings = [
    ...unavailableLanes.map((key) => {
      const lane = requiredLanes[requiredLaneKeys.indexOf(key)];
      return {
        code: "verification-evidence-unavailable",
        title: coverageFailure === void 0 ? `Required ${key} verification evidence is unavailable (${lane?.numerator ?? "unknown"}/${lane?.denominator ?? "unknown"}; ${lane?.blindSpots.join("; ") || "no recorded blind spots"})` : `Required ${key} verification evidence is unavailable: ${coverageFailure}`,
        severity: "error",
        evidenceIds: coverage === void 0 ? [] : [coverage.bindingIdentity]
      };
    })
  ];
  const findings = [
    ...knowledge.findings,
    {
      code: "canonical-authentication-scope",
      title: "Canonical checking authenticates document schemas and hashes. Architecture and decision observations are reported separately from the coverage owner and retain its stated boundary and blind spots.",
      severity: "note",
      evidenceIds: []
    },
    ...analysis.failures.map(({ capability, message: message2, scope: scope2, analyzerId }) => ({
      code: capability,
      title: message2,
      path: scope2,
      severity: "error",
      evidenceIds: [analyzerId]
    })),
    ...verificationFindings
  ];
  const proof = {
    commandFailed: false,
    blockingInvalidity: knowledge.findings.length > 0 || analysis.failures.length > 0,
    approvalRequired: false,
    incompleteCoverage: false,
    requiredUnavailable: analysis.surface.access === "unavailable" || unavailableLanes.length > 0,
    recoveryFailure: false,
    budgetExhausted: false,
    resumable: false
  };
  const stateDigest = hashFramedDomain("operational-run-state", {
    command: "verify",
    canonicalDigest: knowledge.canonicalDigest,
    artifacts: analysis.artifacts.map(({ id, contentHash }) => ({ id, contentHash })),
    failures: analysis.failures,
    coverageObservation: coverage === void 0 ? { unavailable: coverageFailure ?? "coverage observation unavailable" } : { bindingIdentity: coverage.bindingIdentity, verificationLanes: requiredLanes }
  });
  const gitHead = analysis.git.availability === "available" ? analysis.git.revision : void 0;
  const evidence = {
    ...unavailableOperationalEvidence("not exercised by local operational composition"),
    toolchainDigest: hashFramedDomain("operational-toolchain", options.toolVersion),
    ...gitHead === void 0 ? {} : { gitHead: hashFramedDomain("operational-git-head", gitHead) },
    canonicalDigest: knowledge.canonicalDigest,
    graphRecords: coverage === void 0 ? [] : [coverage.bindingIdentity],
    analyzerRecords: analysis.capabilities.map(({ analyzerId, adapterVersion }) => `${analyzerId}@${adapterVersion}`),
    decisionRecords: requiredLanes.filter((lane) => lane?.key === "authority" || lane?.key === "architecture-decision").map((lane) => hashFramedDomain("operational-verification-lane", lane)),
    validationRecords: requiredLanes.filter((lane) => lane !== void 0 && lane.key !== "authority" && lane.key !== "architecture-decision").map((lane) => hashFramedDomain("operational-verification-lane", lane)),
    errorRecords: findings.filter(({ severity }) => severity === "error").map(({ code }) => code),
    durationMs: Date.now() - started
  };
  const report = createOperationalReport({
    runId: hashFramedDomain("operational-run-id", { command: "verify", stateDigest, started }),
    command: "verify",
    exitProof: proof,
    evidence,
    policy: options.policy,
    stateDigest,
    unavailableFields: [
      "modelRecords",
      "snapshotRecords",
      "transformRecords"
    ],
    findings
  });
  return parseOperationalReport(report);
}
async function inspectCanonicalKnowledge(repositoryRoot) {
  try {
    const snapshot = await withObservationScope({}, async (scope) => {
      const sources = await collectCanonicalSnapshotSources(repositoryRoot, scope.budget, scope.signal);
      return runObservationTask("canonical", { sources }, scope);
    });
    return { canonicalDigest: snapshot.rootDigest, findings: [] };
  } catch (error) {
    if (error instanceof ObservationError && error.code === "observation-limit-exceeded")
      throw error;
    const reason = error instanceof Error ? error.message : String(error);
    return {
      canonicalDigest: hashFramedDomain("unavailable-canonical-knowledge", reason),
      findings: [{
        code: "canonical-knowledge-invalid",
        title: reason,
        path: ".projector",
        severity: "error",
        evidenceIds: []
      }]
    };
  }
}

// dist/application-evidence-host.js
import { z } from "zod";
var protocol = "projector-application-evidence-http@1";
var identity = z.string().min(1).max(512).regex(/^[^\0\r\n]+$/u);
var responseSchema = z.strictObject({ protocol: z.literal(protocol), host: z.strictObject({ id: identity, build: identity }), assessment: z.unknown() });
function createConfiguredApplicationEvidencePort(input) {
  const environment = input.environment ?? process.env;
  const endpoint = environment.PROJECTOR_APPLICATION_EVIDENCE_ENDPOINT;
  const id = environment.PROJECTOR_APPLICATION_EVIDENCE_HOST_ID;
  const build = environment.PROJECTOR_APPLICATION_EVIDENCE_HOST_BUILD;
  if (endpoint === void 0 && id === void 0 && build === void 0)
    return void 0;
  if (!endpoint || !id || !build)
    throw new Error("Application evidence requires endpoint, host ID, and host build configuration");
  const host = z.strictObject({ id: identity, build: identity }).parse({ id, build });
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("Application evidence endpoint must be an absolute HTTPS or loopback HTTP URL");
  }
  if (url.username || url.password || url.hash || url.search || !(url.protocol === "https:" || url.protocol === "http:" && ["127.0.0.1", "[::1]"].includes(url.hostname))) {
    throw new Error("Application evidence endpoint requires HTTPS or numeric loopback HTTP, without credentials, query, or fragment");
  }
  return {
    async assess(request, context) {
      const exact = ApplicationEvidenceAssessmentRequestSchema.parse(request);
      const signal = AbortSignal.any([context.signal, ...input.signal === void 0 ? [] : [input.signal]]);
      signal.throwIfAborted();
      const body = JSON.stringify({ protocol, host, request: exact });
      const assessment = await assessApplicationEvidence({ async assess() {
        for (let attempt = 1; attempt <= 2; attempt++) {
          const response = await fetch(url, { method: "POST", redirect: "error", headers: { "content-type": "application/json", accept: "application/json" }, body, signal });
          if ([502, 503, 504].includes(response.status) && attempt === 1) {
            await response.body?.cancel();
            console.warn(JSON.stringify({ event: "application_evidence_assessment_retry", status: response.status, attempt }));
            continue;
          }
          if (!response.ok) {
            await response.body?.cancel();
            throw new Error(`Application evidence host returned HTTP ${response.status}`);
          }
          const reader = response.body?.getReader();
          if (reader === void 0)
            throw new Error("Application evidence host returned no response body");
          const chunks = [];
          try {
            for (; ; ) {
              const item = await reader.read();
              if (item.done)
                break;
              chunks.push(item.value);
            }
          } catch (error) {
            try {
              await reader.cancel();
            } catch {
              console.warn(JSON.stringify({ event: "application_evidence_response_cleanup_failed" }));
            }
            throw error;
          } finally {
            reader.releaseLock();
          }
          let decoded;
          try {
            decoded = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          } catch {
            throw new Error("Application evidence host returned invalid JSON");
          }
          const envelope = responseSchema.parse(decoded);
          if (envelope.host.id !== host.id || envelope.host.build !== host.build)
            throw new Error("Application evidence host identity or build does not match configuration");
          return envelope.assessment;
        }
        throw new Error("Application evidence host assessment retry exhausted");
      } }, exact, { signal });
      const dependencyId = "application-evidence-host:configured-transport";
      const dependencies = applicationEvidenceDependencies(assessment);
      if (dependencies.length >= 256 || dependencies.some((item) => item.id === dependencyId)) {
        throw new Error("Application evidence host must reserve one dependency slot for configured transport identity");
      }
      const { contentHash: _contentHash, ...basis } = assessment;
      const bound = { ...basis, dependencies: [...dependencies, { kind: "artifact", id: dependencyId, versionHash: hashFramedDomain("application-evidence-http-host/v1", { endpoint: url.href, host }), role: "Explicit host endpoint, identity, and build configuration" }] };
      return { ...bound, contentHash: hashApplicationEvidenceAssessment(bound) };
    }
  };
}

// dist/operation-runner.js
var optionalApplicationEvidence = (port) => port === void 0 ? {} : { applicationEvidence: port };
var verificationOptions = (context) => ({
  signal: context.signal,
  ...context.environment.PROJECTOR_VERIFICATION_EVIDENCE_STORE === void 0 ? {} : { evidenceStoreRoot: context.environment.PROJECTOR_VERIFICATION_EVIDENCE_STORE }
});
var maximumPackageManifestBytes = 16 * 1024;
var ordinaryOperationSchema = ProjectorOperationSchema.exclude(["status", "init"]);
var operationEnvelopeSchema = z2.strictObject({
  apiVersion: z2.literal(projectorOperationApiVersion),
  operation: ProjectorOperationSchema,
  repositoryRoot: z2.string().min(1),
  requestId: z2.string().min(1).optional(),
  observationLimits: ObservationLimitsOverrideSchema.optional(),
  input: z2.unknown()
}).superRefine((envelope, context) => {
  if (!Object.hasOwn(envelope, "input")) {
    context.addIssue({ code: "custom", path: ["input"], message: "Operation input is required" });
  }
});
function defineProjectorOperationHandler(handler) {
  return handler;
}
var hostCapabilityObservationSchema = z2.strictObject({
  capability: z2.string().min(1).max(256),
  available: z2.boolean(),
  evidence: z2.string().min(1).max(4096)
});
var hostCapabilityObservationsSchema = z2.array(hostCapabilityObservationSchema).superRefine((observations, context) => {
  const capabilities = /* @__PURE__ */ new Set();
  for (const observation of observations) {
    if (capabilities.has(observation.capability)) {
      context.addIssue({
        code: "custom",
        message: `Duplicate or conflicting host capability observation: ${observation.capability}`
      });
    }
    capabilities.add(observation.capability);
  }
});
var operationCapabilitySchema = z2.strictObject({
  operation: ProjectorOperationSchema,
  registered: z2.boolean(),
  reachable: z2.boolean(),
  reason: z2.string().min(1).max(4096)
});
var OperationCapabilityDiscoverySchema = z2.strictObject({
  package: PackageIdentitySchema,
  readiness: ProjectReadinessSchema,
  operations: z2.array(operationCapabilitySchema).length(ProjectorOperationSchema.options.length).superRefine((operations, context) => {
    const observed = /* @__PURE__ */ new Set();
    for (const item of operations) {
      if (observed.has(item.operation)) {
        context.addIssue({ code: "custom", message: `Duplicate operation capability: ${item.operation}` });
      }
      observed.add(item.operation);
    }
    for (const operation of ProjectorOperationSchema.options) {
      if (!observed.has(operation)) {
        context.addIssue({ code: "custom", message: `Missing operation capability: ${operation}` });
      }
    }
  }),
  observedHostCapabilities: hostCapabilityObservationsSchema
});
async function createProjectorOperationRunner(input) {
  const packageIdentity = await readPackageIdentity(input.packagedRoot);
  const handlers = buildRegistry(input.handlers);
  const observedHostCapabilities = parseHostCapabilityObservations(input.ports.observedHostCapabilities);
  return {
    package: packageIdentity,
    execute: async (candidate, options = {}) => {
      const request = operationEnvelopeSchema.parse(candidate);
      return executeOperation(request, options, packageIdentity, handlers, observedHostCapabilities, input.ports);
    },
    discoverCapabilities: async ({ repositoryRoot, signal }) => {
      const readiness = await input.ports.inspectReadiness(repositoryRoot, {
        operation: "status",
        package: packageIdentity,
        ...signal === void 0 ? {} : { signal }
      });
      const parsedReadiness = ProjectReadinessSchema.parse(readiness);
      return assembleCapabilityDiscovery(packageIdentity, parsedReadiness, handlers, observedHostCapabilities);
    }
  };
}
async function createBundledProjectorOperationRunner(input) {
  const applicationEvidenceFor = (repositoryRoot, context) => input.applicationEvidence?.({
    repositoryRoot,
    signal: context.signal,
    environment: context.environment
  }) ?? createConfiguredApplicationEvidencePort({ repositoryRoot, signal: context.signal, environment: context.environment });
  const handlers = [
    defineProjectorOperationHandler({
      operation: "code.test-run",
      inputSchema: ProjectorOperationInputSchemas["code.test-run"],
      outputSchema: CodeTestRunResultSchema,
      execute: async ({ repositoryRoot, input: request }, context) => CodeTestRunResultSchema.parse(await executeCodeTestReplay(repositoryRoot, request, { signal: context.signal, environment: context.environment }))
    }),
    ...[
      ["code.query", CodeQueryEvidenceSchema],
      ["code.index", CodeIndexRunSchema],
      ["code.index-status", CodeIndexStatusSchema],
      ["code.index-wait", CodeIndexRunSchema],
      ["code.index-cancel", CodeIndexRunSchema],
      ["code.impact", CodeImpactResultSchema],
      ["code.tests", CodeTestsResultSchema],
      ["code.evidence", CodeEvidenceResultSchema],
      ["code.export", CodeExportResultSchema]
    ].map(([operation, outputSchema]) => defineProjectorOperationHandler({
      operation,
      inputSchema: ProjectorOperationInputSchemas[operation],
      outputSchema,
      execute: async ({ repositoryRoot, input: request }, context) => outputSchema.parse(await executeCodeOperation(repositoryRoot, operation, request, { signal: context.signal, environment: context.environment }))
    })),
    defineProjectorOperationHandler({
      operation: "verification.builtin",
      inputSchema: ProjectorOperationInputSchemas["verification.builtin"],
      outputSchema: z2.union([BuiltinVerificationEvidenceSchema, BuiltinVerificationAssessmentSchema, BuiltinVerificationInspectionSchema, BuiltinVerificationRecoverySchema]),
      execute: async ({ repositoryRoot, input: input2 }, context) => {
        const evidenceStoreRoot = context.environment.PROJECTOR_VERIFICATION_EVIDENCE_STORE;
        if (evidenceStoreRoot === void 0)
          throw new Error("Built-in verification requires host-configured PROJECTOR_VERIFICATION_EVIDENCE_STORE outside the checkout");
        const service = await BuiltinVerificationService.create(repositoryRoot, { evidenceStoreRoot, trustedChecks: (context.environment.PROJECTOR_VERIFICATION_TRUST_POLICY ?? "").split(",").filter(Boolean), signal: context.signal, ...context.environment.PROJECTOR_VERIFICATION_TRUST_POLICY_VERSION === void 0 ? {} : { trustPolicyVersion: context.environment.PROJECTOR_VERIFICATION_TRUST_POLICY_VERSION } });
        const command = input2.command;
        if (command.action === "execute")
          return service.execute(command.request);
        if (command.action === "assess")
          return service.assess(command);
        if (command.action === "inspect")
          return service.inspect();
        return service.recover();
      }
    }),
    defineProjectorOperationHandler({
      operation: "verification.execute",
      inputSchema: ProjectorOperationInputSchemas["verification.execute"],
      outputSchema: VerificationEvidenceSchema,
      execute: async ({ repositoryRoot, input: input2 }, context) => (await VerificationService.create(repositoryRoot, verificationOptions(context))).execute(input2)
    }),
    defineProjectorOperationHandler({
      operation: "verification.inspect",
      inputSchema: ProjectorOperationInputSchemas["verification.inspect"],
      outputSchema: VerificationInspectionSchema,
      execute: async ({ repositoryRoot, input: input2 }, context) => (await VerificationService.create(repositoryRoot, verificationOptions(context))).inspect(input2.eventIds)
    }),
    defineProjectorOperationHandler({
      operation: "verification.recover",
      inputSchema: ProjectorOperationInputSchemas["verification.recover"],
      outputSchema: VerificationRecoverySchema,
      execute: async ({ repositoryRoot }, context) => (await VerificationService.create(repositoryRoot, verificationOptions(context))).recover()
    }),
    defineProjectorOperationHandler({
      operation: "architecture.evaluate",
      inputSchema: ProjectorOperationInputSchemas["architecture.evaluate"],
      outputSchema: ArchitectureEvaluationOutputSchema,
      execute: async ({ repositoryRoot, input: input2 }) => evaluateRepositoryArchitectureOptions(repositoryRoot, input2)
    }),
    defineProjectorOperationHandler({
      operation: "generated.execute",
      inputSchema: ProjectorOperationInputSchemas["generated.execute"],
      outputSchema: GeneratedOutputEvidenceSchema,
      execute: async ({ repositoryRoot, input: input2 }, context) => (await GeneratedOutputService.create(repositoryRoot, verificationOptions(context))).execute(input2.generation)
    }),
    defineProjectorOperationHandler({
      operation: "generated.inspect",
      inputSchema: ProjectorOperationInputSchemas["generated.inspect"],
      outputSchema: GeneratedOutputInspectionSchema,
      execute: async ({ repositoryRoot, input: input2 }, context) => (await GeneratedOutputService.create(repositoryRoot, verificationOptions(context))).inspect(input2.activeProducerIds)
    }),
    defineProjectorOperationHandler({
      operation: "generated.recover",
      inputSchema: ProjectorOperationInputSchemas["generated.recover"],
      outputSchema: GeneratedOutputRecoverySchema,
      execute: async ({ repositoryRoot, input: input2 }, context) => (await GeneratedOutputService.create(repositoryRoot, verificationOptions(context))).recover(input2.activeProducerIds)
    }),
    defineProjectorOperationHandler({
      operation: "representation.pending",
      inputSchema: ProjectorOperationInputSchemas["representation.pending"],
      outputSchema: RepresentationPendingOutputSchema,
      execute: async ({ repositoryRoot }, context) => (await RepositoryChangeLifecycleService.create(repositoryRoot)).pendingRepresentations({ signal: context.signal })
    }),
    defineProjectorOperationHandler({
      operation: "representation.recover",
      inputSchema: ProjectorOperationInputSchemas["representation.recover"],
      outputSchema: RepresentationRecoveryOutputSchema,
      execute: async ({ repositoryRoot }, context) => (await RepositoryChangeLifecycleService.create(repositoryRoot)).recoverRepresentations({ signal: context.signal })
    }),
    defineProjectorOperationHandler({
      operation: "repository.check",
      inputSchema: ProjectorOperationInputSchemas["repository.check"],
      outputSchema: RepositoryCheckOutputSchema,
      execute: ({ repositoryRoot, input: input2 }, context) => checkRepository(repositoryRoot, input2, { signal: context.signal })
    }),
    defineProjectorOperationHandler({
      operation: "repository.integration",
      inputSchema: ProjectorOperationInputSchemas["repository.integration"],
      outputSchema: GitIntegrationAssessmentSchema,
      execute: ({ repositoryRoot, input: input2 }, context) => assessGitIntegration(repositoryRoot, input2, { signal: context.signal })
    }),
    defineProjectorOperationHandler({
      operation: "context",
      inputSchema: ProjectorOperationInputSchemas.context,
      outputSchema: KnowledgeContextOperationOutputSchema,
      execute: async ({ repositoryRoot, input: input2 }, context) => {
        const { signal } = context;
        const service = await RepositoryKnowledgeService.create({ repositoryRoot, ...optionalApplicationEvidence(applicationEvidenceFor(repositoryRoot, context)) });
        return projectKnowledgeContext(await service.context({
          request: input2.request,
          signal,
          ...input2.view === void 0 ? {} : { view: input2.view },
          ...input2.entities === void 0 ? {} : { entities: input2.entities },
          ...input2.namedTargets === void 0 ? {} : { namedTargets: input2.namedTargets },
          ...input2.operation === void 0 ? {} : { operation: input2.operation },
          ...input2.persist === void 0 ? {} : { persist: input2.persist },
          ...input2.policy === void 0 ? {} : { policy: {
            ...input2.policy.maxCandidates === void 0 ? {} : { maxCandidates: input2.policy.maxCandidates },
            ...input2.policy.maxEntries === void 0 ? {} : { maxEntries: input2.policy.maxEntries },
            ...input2.policy.maxDepth === void 0 ? {} : { maxDepth: input2.policy.maxDepth },
            ...input2.policy.maxTraversalCost === void 0 ? {} : { maxTraversalCost: input2.policy.maxTraversalCost },
            ...input2.policy.minimumScore === void 0 ? {} : { minimumScore: input2.policy.minimumScore },
            ...input2.policy.maxContextCost === void 0 ? {} : { maxContextCost: input2.policy.maxContextCost }
          } }
        }), input2.view);
      }
    }),
    defineProjectorOperationHandler({
      operation: "context.inspect",
      inputSchema: ProjectorOperationInputSchemas["context.inspect"],
      outputSchema: KnowledgeContextInspectOperationOutputSchema,
      execute: async ({ repositoryRoot, input: input2 }, context) => {
        const service = await RepositoryKnowledgeService.create(repositoryRoot);
        return inspectKnowledgeContext(await service.inspectContext(input2.contextId, context.signal), {
          ...input2.cursor === void 0 ? {} : { cursor: input2.cursor },
          ...input2.limit === void 0 ? {} : { limit: input2.limit },
          ...input2.view === void 0 ? {} : { view: input2.view }
        });
      }
    }),
    defineProjectorOperationHandler({
      operation: "reconcile",
      inputSchema: ProjectorOperationInputSchemas.reconcile,
      outputSchema: KnowledgeReconciliationOperationOutputSchema,
      execute: async ({ repositoryRoot, input: input2 }, context) => {
        const { signal } = context;
        const service = await RepositoryKnowledgeService.create({ repositoryRoot, ...optionalApplicationEvidence(applicationEvidenceFor(repositoryRoot, context)) });
        return projectKnowledgeReconciliation(await service.reconcile(input2.contextId, { signal }), input2.view);
      }
    }),
    defineProjectorOperationHandler({
      operation: "change.capture",
      inputSchema: ProjectorOperationInputSchemas["change.capture"],
      outputSchema: LifecycleCaptureOutputSchema,
      execute: async ({ repositoryRoot, input: input2 }, context) => {
        const { signal } = context;
        const service = await RepositoryChangeLifecycleService.create(repositoryRoot, { ...optionalApplicationEvidence(applicationEvidenceFor(repositoryRoot, context)) });
        return LifecycleCaptureOutputSchema.parse(projectLifecycleCapture(await service.capture({
          request: input2.request,
          proposal: input2.proposal,
          ...input2.contextId === void 0 ? {} : { knowledgeContextId: input2.contextId }
        }, { signal })));
      }
    }),
    defineProjectorOperationHandler({
      operation: "change.plan",
      inputSchema: ProjectorOperationInputSchemas["change.plan"],
      outputSchema: LifecyclePlanOutputSchema,
      execute: async ({ repositoryRoot, input: input2 }, context) => {
        const { signal } = context;
        const service = await RepositoryChangeLifecycleService.create(repositoryRoot, { ...optionalApplicationEvidence(applicationEvidenceFor(repositoryRoot, context)) });
        return LifecyclePlanOutputSchema.parse(projectLifecyclePlan(input2.changeSelector, await service.plan(input2.changeSelector, { signal })));
      }
    }),
    defineProjectorOperationHandler({
      operation: "change.approve",
      inputSchema: ProjectorOperationInputSchemas["change.approve"],
      outputSchema: LifecycleApprovalOutputSchema,
      execute: async ({ repositoryRoot, input: input2 }, context) => {
        const { signal } = context;
        const service = await RepositoryChangeLifecycleService.create(repositoryRoot, { ...optionalApplicationEvidence(applicationEvidenceFor(repositoryRoot, context)) });
        return LifecycleApprovalOutputSchema.parse(projectLifecycleApproval(await service.approve(input2.changeSelector, input2.planHash, { signal })));
      }
    }),
    defineProjectorOperationHandler({
      operation: "change.apply",
      inputSchema: ProjectorOperationInputSchemas["change.apply"],
      outputSchema: LifecycleApplyOutputSchema,
      execute: async ({ repositoryRoot, input: input2 }, context) => {
        const { signal } = context;
        const service = await RepositoryChangeLifecycleService.create(repositoryRoot, { ...optionalApplicationEvidence(applicationEvidenceFor(repositoryRoot, context)) });
        return LifecycleApplyOutputSchema.parse(projectLifecycleApply(input2.approvalSelector, await service.apply(input2.approvalSelector, { signal })));
      }
    }),
    defineProjectorOperationHandler({
      operation: "operation-access.recover",
      inputSchema: ProjectorOperationInputSchemas["operation-access.recover"],
      outputSchema: z2.strictObject({ accessReady: z2.literal(true) }),
      execute: async () => ({ accessReady: true })
    }),
    defineProjectorOperationHandler({
      operation: "change.recover",
      inputSchema: ProjectorOperationInputSchemas["change.recover"],
      outputSchema: LifecycleRecoveryOutputSchema,
      execute: async ({ repositoryRoot, input: input2 }, context) => {
        const { signal } = context;
        const service = await RepositoryChangeLifecycleService.create(repositoryRoot, { ...optionalApplicationEvidence(applicationEvidenceFor(repositoryRoot, context)) });
        return LifecycleRecoveryOutputSchema.parse(projectLifecycleRecovery(input2.approvalSelector, await service.recover(input2.approvalSelector, { signal })));
      }
    }),
    coverageHandler("coverage", RepositoryCoverageOutputSchema, applicationEvidenceFor),
    coverageHandler("complete", RepositoryCompletionOutputSchema, applicationEvidenceFor),
    coverageHandler("cleanup", RepositoryCleanupOutputSchema, applicationEvidenceFor),
    defineProjectorOperationHandler({
      operation: "verify",
      inputSchema: ProjectorOperationInputSchemas.verify,
      outputSchema: OperationalReportSchema,
      execute: async ({ repositoryRoot }, context) => OperationalReportSchema.parse(await runReadOnlyOperationalVerification(repositoryRoot, {
        signal: context.signal,
        toolVersion: context.package.version,
        policy: { preset: "observe", allowMutation: false, allowPersistence: false },
        ...optionalApplicationEvidence(applicationEvidenceFor(repositoryRoot, context))
      }))
    }),
    defineProjectorOperationHandler({
      operation: "representation.inspect",
      inputSchema: ProjectorOperationInputSchemas["representation.inspect"],
      outputSchema: RepresentationInspectionOperationOutputSchema,
      execute: async ({ repositoryRoot, input: input2 }, context) => {
        const service = await RepositoryRepresentationInspectionService.create(repositoryRoot, {
          ...optionalApplicationEvidence(applicationEvidenceFor(repositoryRoot, context))
        });
        return projectRepresentationInspectionOperation(RepresentationInspectionOutputSchema.parse(await service.inspect({
          changeSelector: input2.changeSelector,
          view: input2.view,
          ...input2.capsuleId === void 0 ? {} : { capsuleId: input2.capsuleId },
          ...input2.approvalSelector === void 0 ? {} : { approvalSelector: input2.approvalSelector },
          signal: context.signal
        })));
      }
    }),
    defineProjectorOperationHandler({
      operation: "representation.reconcile",
      inputSchema: ProjectorOperationInputSchemas["representation.reconcile"],
      outputSchema: RepresentationProfileReconciliationOperationOutputSchema,
      execute: async ({ repositoryRoot, input: input2 }, context) => {
        const service = await RepositoryRepresentationProfileReconciliationService.create(repositoryRoot, {
          ...optionalApplicationEvidence(applicationEvidenceFor(repositoryRoot, context))
        });
        return projectRepresentationProfileReconciliationOperation(RepresentationProfileReconciliationOutputSchema.parse(await service.reconcile({
          changeSelector: input2.changeSelector,
          ...input2.approvalSelector === void 0 ? {} : { approvalSelector: input2.approvalSelector },
          signal: context.signal
        })));
      }
    })
  ];
  const launcherCapabilities = new NativeProcessLauncher().capabilities;
  return createProjectorOperationRunner({
    packagedRoot: input.packagedRoot,
    handlers,
    ports: {
      inspectReadiness: inspectProjectReadiness,
      initializer: {
        resultSchema: PreparedProjectInitializationResultSchema,
        execute: initializePreparedProject
      },
      withProjectOperationAccess,
      observedHostCapabilities: [
        {
          capability: "process.cpu-limit-enforcement",
          available: launcherCapabilities.cpuLimits,
          evidence: launcherCapabilities.cpuLimits ? "NativeProcessLauncher reports CPU limit enforcement available" : "NativeProcessLauncher reports CPU limit enforcement unavailable and refuses requested CPU limits before spawn"
        },
        {
          capability: "process.memory-limit-enforcement",
          available: launcherCapabilities.memoryLimits,
          evidence: launcherCapabilities.memoryLimits ? "NativeProcessLauncher reports memory limit enforcement available" : "NativeProcessLauncher reports memory limit enforcement unavailable and refuses requested memory limits before spawn"
        }
      ]
    }
  });
}
function coverageHandler(operation, outputSchema, applicationEvidenceFor) {
  return defineProjectorOperationHandler({
    operation,
    inputSchema: ProjectorOperationInputSchemas[operation],
    outputSchema,
    execute: async ({ repositoryRoot, input }, context) => outputSchema.parse(await inspectRepositoryCoverage(repositoryRoot, {
      ...input,
      scope: input.scope ?? ".",
      ...input.budgetTokens === void 0 ? {} : { budgetTokens: input.budgetTokens },
      ...input.budgetCost === void 0 ? {} : { budgetCost: input.budgetCost },
      ...input.questionOffset === void 0 ? {} : { questionOffset: input.questionOffset }
    }, operation, { signal: context.signal, ...optionalApplicationEvidence(applicationEvidenceFor(repositoryRoot, context)) }))
  });
}
async function executeOperation(request, options, packageIdentity, handlers, observedHostCapabilities, ports) {
  let observedReadiness;
  let accessSignal;
  const base = {
    apiVersion: projectorOperationResultApiVersion,
    operation: request.operation,
    package: packageIdentity,
    ...request.requestId === void 0 ? {} : { requestId: request.requestId }
  };
  try {
    throwIfAborted(options.signal);
    if (request.operation === "status") {
      const statusRequest = createProjectorOperationRequestSchema("status", ProjectorOperationInputSchemas.status).parse(request);
      const readiness = ProjectReadinessSchema.parse(await ports.inspectReadiness(statusRequest.repositoryRoot, {
        operation: "status",
        package: packageIdentity,
        ...options.signal === void 0 ? {} : { signal: options.signal }
      }));
      observedReadiness = readiness;
      if (readiness.status === "ready") {
        const access2 = await ports.withProjectOperationAccess(statusRequest.repositoryRoot, {
          operation: "status",
          package: packageIdentity,
          ...options.signal === void 0 ? {} : { signal: options.signal }
        }, async ({ readiness: current, signal }) => {
          accessSignal = signal;
          return assembleCapabilityDiscovery(packageIdentity, current, handlers, observedHostCapabilities);
        });
        if (access2.readiness.status !== "ready") {
          return readinessResult("status", base, ProjectReadinessSchema.parse(access2.readiness), OperationCapabilityDiscoverySchema);
        }
        observedReadiness = access2.readiness;
        return validatedExecutionResult(createProjectorOperationResultSchema("status", OperationCapabilityDiscoverySchema), {
          ...base,
          status: "succeeded",
          exitCode: 0,
          readiness: access2.readiness,
          output: access2.value
        });
      }
      const output = assembleCapabilityDiscovery(packageIdentity, readiness, handlers, observedHostCapabilities);
      return validatedExecutionResult(createProjectorOperationResultSchema("status", OperationCapabilityDiscoverySchema), {
        ...base,
        status: "succeeded",
        exitCode: 0,
        readiness,
        output
      });
    }
    if (request.operation === "init") {
      const initRequest = createProjectorOperationRequestSchema("init", ProjectorOperationInputSchemas.init).parse(request);
      const rawInitialized = await ports.initializer.execute(initRequest.repositoryRoot, {
        package: packageIdentity,
        ...options.signal === void 0 ? {} : { signal: options.signal }
      });
      const initialized = parseExactJson(ports.initializer.resultSchema, rawInitialized, "Initializer result");
      const readiness = ProjectReadinessSchema.parse(initialized.readiness);
      observedReadiness = readiness;
      if (readiness.status !== "ready")
        return readinessResult(request.operation, base, readiness, ports.initializer.resultSchema);
      return validatedExecutionResult(createProjectorOperationResultSchema("init", ports.initializer.resultSchema), {
        ...base,
        status: "succeeded",
        exitCode: 0,
        readiness,
        output: initialized
      });
    }
    const operation = ordinaryOperationSchema.parse(request.operation);
    const handler = handlers.get(operation);
    if (handler === void 0) {
      const readiness = ProjectReadinessSchema.parse(await ports.inspectReadiness(request.repositoryRoot, {
        operation,
        package: packageIdentity,
        ...options.signal === void 0 ? {} : { signal: options.signal }
      }));
      observedReadiness = readiness;
      return validatedExecutionResult(createProjectorOperationResultSchema(operation, z2.never()), {
        ...base,
        status: "unavailable",
        exitCode: 5,
        readiness,
        error: {
          code: "operation-unregistered",
          message: `Operation ${operation} is not registered in this package`,
          retriable: false
        }
      });
    }
    const operationRequest = parseExactJson(createProjectorOperationRequestSchema(operation, handler.inputSchema), request, `Operation ${operation} request`);
    const access = await ports.withProjectOperationAccess(operationRequest.repositoryRoot, {
      operation,
      package: packageIdentity,
      ...options.signal === void 0 ? {} : { signal: options.signal }
    }, async ({ readiness, signal }) => {
      observedReadiness = readiness;
      accessSignal = signal;
      throwIfAborted(signal);
      const output = await withObservationScope({
        ...operationRequest.observationLimits === void 0 ? {} : { limits: ObservationLimitsSchema.parse({ ...DEFAULT_OBSERVATION_LIMITS, ...operationRequest.observationLimits }) },
        signal
      }, async () => handler.execute(operationRequest, {
        package: packageIdentity,
        readiness,
        signal,
        environment: options.environment ?? {}
      }));
      throwIfAborted(signal);
      return parseExactJson(handler.outputSchema, output, `Operation ${operation} output`);
    });
    if (access.readiness.status !== "ready") {
      return readinessResult(operation, base, ProjectReadinessSchema.parse(access.readiness), handler.outputSchema);
    }
    return validatedExecutionResult(createProjectorOperationResultSchema(operation, handler.outputSchema), {
      ...base,
      status: "succeeded",
      exitCode: 0,
      readiness: access.readiness,
      output: access.value
    });
  } catch (error) {
    const cancellation = cancellationKind(error, options.signal, accessSignal);
    const readiness = observedReadiness ?? unobservedReadiness(packageIdentity, cancellation !== void 0);
    const outputSchema = request.operation === "status" ? OperationCapabilityDiscoverySchema : request.operation === "init" ? ports.initializer.resultSchema : handlers.get(request.operation)?.outputSchema ?? z2.never();
    const cancelled = cancellation !== void 0;
    return validatedExecutionResult(createProjectorOperationResultSchema(request.operation, outputSchema), {
      ...base,
      status: cancelled ? "cancelled" : "failed",
      exitCode: 6,
      readiness,
      error: {
        code: cancellation === "access" ? "operation-access-lost" : cancelled ? "operation-cancelled" : error instanceof ObservationError ? error.code : "operation-failed",
        message: cancellation === "access" ? `Project operation access was lost: ${message(accessSignal?.reason ?? error)}` : cancelled ? "Projector operation was cancelled" : message(error),
        retriable: false,
        ...!cancelled && error instanceof ObservationError ? { observation: {
          stage: error.stage,
          scope: error.scope,
          ...error.limit === void 0 ? {} : { limit: error.limit },
          ...error.observed === void 0 ? {} : { observed: error.observed }
        } } : {}
      }
    });
  }
}
function buildRegistry(handlers) {
  const registry = /* @__PURE__ */ new Map();
  for (const handler of handlers) {
    const operation = ordinaryOperationSchema.parse(handler.operation);
    if (registry.has(operation))
      throw new Error(`Duplicate Projector operation handler: ${operation}`);
    registry.set(operation, handler);
  }
  return registry;
}
function readinessResult(operation, base, readiness, outputSchema) {
  const mapped = mapReadiness(operation, readiness);
  return validatedExecutionResult(createProjectorOperationResultSchema(operation, outputSchema), {
    ...base,
    status: "unavailable",
    exitCode: readiness.status === "recovery-required" ? 6 : 5,
    readiness,
    error: mapped.error,
    ...mapped.action === void 0 ? {} : { action: mapped.action }
  });
}
function validatedExecutionResult(schema, input) {
  return schema.parse(input);
}
function parseExactJson(schema, raw, owner) {
  const rawCanonical = exactCanonicalJson(raw, `${owner} raw value`);
  const parsed = schema.parse(raw);
  const parsedCanonical = exactCanonicalJson(parsed, `${owner} parsed value`);
  if (rawCanonical !== parsedCanonical) {
    throw new Error(`${owner} schema transformed, stripped, defaulted, or coerced the returned value`);
  }
  return parsed;
}
function exactCanonicalJson(value, owner) {
  assertJsonValue(value, owner, /* @__PURE__ */ new Set());
  return canonicalJson(value);
}
function assertJsonValue(value, path, seen) {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new TypeError(`${path} contains a non-finite number`);
    return;
  }
  if (typeof value !== "object")
    throw new TypeError(`${path} contains a non-JSON ${typeof value} value`);
  if (seen.has(value))
    throw new TypeError(`${path} contains a cycle`);
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const ownNames = Object.getOwnPropertyNames(value);
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index))
          throw new TypeError(`${path} contains a sparse array hole at ${index}`);
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === void 0 || !descriptor.enumerable || !("value" in descriptor)) {
          throw new TypeError(`${path}[${index}] is not an enumerable JSON data property`);
        }
        assertJsonValue(descriptor.value, `${path}[${index}]`, seen);
      }
      if (ownNames.some((name) => name !== "length" && !/^(0|[1-9]\d*)$/u.test(name))) {
        throw new TypeError(`${path} contains non-JSON array properties`);
      }
    } else {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null)
        throw new TypeError(`${path} is not a plain JSON object`);
      for (const key of Object.getOwnPropertyNames(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === void 0 || !descriptor.enumerable || !("value" in descriptor)) {
          throw new TypeError(`${path}.${key} is not an enumerable JSON data property`);
        }
        if (descriptor.value === void 0)
          throw new TypeError(`${path}.${key} is undefined`);
        assertJsonValue(descriptor.value, `${path}.${key}`, seen);
      }
    }
    if (Object.getOwnPropertySymbols(value).length > 0)
      throw new TypeError(`${path} contains symbol keys`);
  } finally {
    seen.delete(value);
  }
}
function parseHostCapabilityObservations(input) {
  return hostCapabilityObservationsSchema.parse(input);
}
function mapReadiness(operation, readiness) {
  const reason = readiness.reason ?? `Project readiness is ${readiness.status}`;
  switch (readiness.status) {
    case "inactive":
      return {
        error: { code: "project-inactive", message: reason, retriable: false },
        action: { kind: "activate", operation: "init", reason }
      };
    case "upgrade-required":
      return {
        error: { code: "project-upgrade-required", message: reason, retriable: false },
        action: { kind: "upgrade", operation: "init", reason }
      };
    case "recovery-required":
      return {
        error: { code: readiness.recovery?.code ?? "project-recovery-required", message: reason, retriable: false },
        action: {
          kind: "recovery-required",
          operation: readiness.recovery?.code === "operation-access-corrupt" ? "operation-access.recover" : operation,
          reason: readiness.recovery?.action ?? reason
        }
      };
    case "busy":
      return {
        error: { code: "project-busy", message: reason, retriable: true },
        action: { kind: "retry", operation, reason }
      };
    case "unavailable":
      return { error: { code: "project-unavailable", message: reason, retriable: false } };
    case "ready":
      return { error: { code: "operation-unavailable", message: reason, retriable: false } };
  }
}
async function readPackageIdentity(packagedRoot) {
  const rootStatus = await lstat(packagedRoot);
  if (!rootStatus.isDirectory() || rootStatus.isSymbolicLink()) {
    throw new Error(`Packaged root must be a real directory: ${packagedRoot}`);
  }
  const manifestPath = join(packagedRoot, "package.json");
  const pathStatus = await lstat(manifestPath);
  if (!pathStatus.isFile() || pathStatus.isSymbolicLink()) {
    throw new Error(`Package manifest must be a regular non-symlink file: ${manifestPath}`);
  }
  if (pathStatus.size > maximumPackageManifestBytes) {
    throw new Error(`Package manifest exceeds ${maximumPackageManifestBytes} bytes: ${manifestPath}`);
  }
  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  const handle = await open(manifestPath, constants.O_RDONLY | noFollow);
  try {
    const handleStatus = await handle.stat();
    if (!handleStatus.isFile() || handleStatus.size > maximumPackageManifestBytes || handleStatus.size !== pathStatus.size) {
      throw new Error(`Package manifest changed during bounded inspection: ${manifestPath}`);
    }
    const buffer = Buffer.alloc(maximumPackageManifestBytes + 1);
    let offset = 0;
    while (offset < buffer.byteLength) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.byteLength - offset, offset);
      if (bytesRead === 0)
        break;
      offset += bytesRead;
    }
    if (offset > maximumPackageManifestBytes) {
      throw new Error(`Package manifest exceeds ${maximumPackageManifestBytes} bytes: ${manifestPath}`);
    }
    const finalStatus = await handle.stat();
    if (finalStatus.size !== handleStatus.size)
      throw new Error(`Package manifest changed during bounded inspection: ${manifestPath}`);
    if (offset !== handleStatus.size)
      throw new Error(`Package manifest changed during bounded inspection: ${manifestPath}`);
    const parsed = JSON.parse(buffer.toString("utf8", 0, offset));
    if (typeof parsed !== "object" || parsed === null)
      throw new Error("Package manifest must contain an object");
    const manifest = parsed;
    return PackageIdentitySchema.parse({ name: manifest.name, version: manifest.version });
  } finally {
    await handle.close();
  }
}
function assembleCapabilityDiscovery(packageIdentity, readiness, handlers, observedHostCapabilities) {
  return OperationCapabilityDiscoverySchema.parse({
    package: packageIdentity,
    readiness,
    operations: ProjectorOperationSchema.options.map((operation) => {
      const registered = operation === "status" || operation === "init" || handlers.has(operation);
      return {
        operation,
        registered,
        reachable: registered,
        reason: capabilityReason(registered)
      };
    }),
    observedHostCapabilities
  });
}
function capabilityReason(registered) {
  if (!registered)
    return "No handler is registered in this package";
  return "The registered handler is reachable through this runner; project readiness is reported separately";
}
function unobservedReadiness(packageIdentity, cancelled) {
  return ProjectReadinessSchema.parse({
    status: "unavailable",
    package: packageIdentity,
    reason: cancelled ? "Readiness was not observed because the operation was cancelled" : "Readiness was not returned because operation execution failed"
  });
}
function throwIfAborted(signal) {
  if (signal?.aborted === true)
    throw signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}
function cancellationKind(error, callerSignal, accessSignal) {
  if (callerSignal?.aborted === true)
    return "caller";
  if (accessSignal?.aborted === true)
    return "access";
  if (error instanceof Error && error.name === "AbortError")
    return "caller";
  return void 0;
}
function message(error) {
  return error instanceof Error ? error.message : String(error);
}

export {
  defineProjectorOperationHandler,
  OperationCapabilityDiscoverySchema,
  createProjectorOperationRunner,
  createBundledProjectorOperationRunner
};
