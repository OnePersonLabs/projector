import { collectLocalRepositoryInputs } from "@projector/analyzers";
import { hashFramedDomain, ObservationError, type ContentHash } from "@projector/core";
import { inspectRepositoryCoverage, runObservationTask, type ApplicationEvidencePort, type RepositoryCoverageResult } from "@projector/control-plane";
import {
  collectCanonicalSnapshotSources,
  currentObservationScope,
  withObservationScope,
  createOperationalReport,
  parseOperationalReport,
  unavailableOperationalEvidence,
  type OperationalExitProof,
  type OperationalReport,
} from "@projector/runtime";

export interface ReadOnlyOperationalVerificationOptions {
  readonly signal: AbortSignal;
  readonly toolVersion: string;
  readonly policy: unknown;
  readonly applicationEvidence?: ApplicationEvidencePort;
}

export async function runReadOnlyOperationalVerification(
  repositoryRoot: string,
  options: ReadOnlyOperationalVerificationOptions,
): Promise<OperationalReport> {
  return withObservationScope({ signal: options.signal }, () => verifyWithinScope(repositoryRoot, options));
}

async function verifyWithinScope(repositoryRoot: string, options: ReadOnlyOperationalVerificationOptions): Promise<OperationalReport> {
  const started = Date.now();
  options.signal.throwIfAborted();
  const knowledge = await inspectCanonicalKnowledge(repositoryRoot);
  options.signal.throwIfAborted();
  const scope = currentObservationScope()!;
  const collected = await collectLocalRepositoryInputs({ repositoryRoot, budget: scope.budget, signal: scope.signal });
  const analysis = await runObservationTask("analyze-collected", { collected }, scope);
  options.signal.throwIfAborted();
  let coverage: RepositoryCoverageResult | undefined;
  let coverageFailure: string | undefined;
  try {
    if (knowledge.findings.length > 0) throw new Error("Canonical knowledge is invalid; dependent coverage cannot be evaluated.");
    coverage = await inspectRepositoryCoverage(repositoryRoot, { scope: "." }, "coverage", {
      signal: options.signal,
      ...(options.applicationEvidence === undefined ? {} : { applicationEvidence: options.applicationEvidence }),
    });
  } catch (error) {
    options.signal.throwIfAborted();
    if (error instanceof ObservationError) throw error;
    coverageFailure = error instanceof Error ? error.message : String(error);
  }
  options.signal.throwIfAborted();

  const requiredLaneKeys = [
    "authority",
    "architecture-decision",
    "lens",
    "rule-enforceability",
    "validation-evidence",
  ] as const;
  const requiredLanes = requiredLaneKeys.map((key) => coverage?.lanes.find((lane) => lane.key === key));
  const unavailableLanes = requiredLaneKeys.filter((_key, index) => {
    const lane = requiredLanes[index];
    return lane === undefined || lane.observability === "unavailable"
      || lane.numerator !== lane.denominator
      || lane.blindSpots.length > 0;
  });
  const verificationFindings = [
    ...unavailableLanes.map((key) => {
      const lane = requiredLanes[requiredLaneKeys.indexOf(key)];
      return {
      code: "verification-evidence-unavailable",
      title: coverageFailure === undefined
        ? `Required ${key} verification evidence is unavailable (${lane?.numerator ?? "unknown"}/${lane?.denominator ?? "unknown"}; ${lane?.blindSpots.join("; ") || "no recorded blind spots"})`
        : `Required ${key} verification evidence is unavailable: ${coverageFailure}`,
      severity: "error" as const,
      evidenceIds: coverage === undefined ? [] : [coverage.bindingIdentity],
    }; }),
  ];

  const findings = [
    ...knowledge.findings,
    {
      code: "canonical-authentication-scope",
      title: "Canonical checking authenticates document schemas and hashes. Architecture and decision observations are reported separately from the coverage owner and retain its stated boundary and blind spots.",
      severity: "note" as const,
      evidenceIds: [] as string[],
    },
    ...analysis.failures.map(({ capability, message, scope, analyzerId }) => ({
      code: capability,
      title: message,
      path: scope,
      severity: "error" as const,
      evidenceIds: [analyzerId],
    })),
    ...verificationFindings,
  ];
  const proof: OperationalExitProof = {
    commandFailed: false,
    blockingInvalidity: knowledge.findings.length > 0 || analysis.failures.length > 0,
    approvalRequired: false,
    incompleteCoverage: false,
    requiredUnavailable: analysis.surface.access === "unavailable" || unavailableLanes.length > 0,
    recoveryFailure: false,
    budgetExhausted: false,
    resumable: false,
  };
  const stateDigest = hashFramedDomain("operational-run-state", {
    command: "verify",
    canonicalDigest: knowledge.canonicalDigest,
    artifacts: analysis.artifacts.map(({ id, contentHash }) => ({ id, contentHash })),
    failures: analysis.failures,
    coverageObservation: coverage === undefined
      ? { unavailable: coverageFailure ?? "coverage observation unavailable" }
      : { bindingIdentity: coverage.bindingIdentity, verificationLanes: requiredLanes },
  });
  const gitHead = analysis.git.availability === "available" ? analysis.git.revision : undefined;
  const evidence = {
    ...unavailableOperationalEvidence("not exercised by local operational composition"),
    toolchainDigest: hashFramedDomain("operational-toolchain", options.toolVersion),
    ...(gitHead === undefined ? {} : { gitHead: hashFramedDomain("operational-git-head", gitHead) }),
    canonicalDigest: knowledge.canonicalDigest,
    graphRecords: coverage === undefined ? [] : [coverage.bindingIdentity],
    analyzerRecords: analysis.capabilities.map(({ analyzerId, adapterVersion }) => `${analyzerId}@${adapterVersion}`),
    decisionRecords: requiredLanes
      .filter((lane) => lane?.key === "authority" || lane?.key === "architecture-decision")
      .map((lane) => hashFramedDomain("operational-verification-lane", lane)),
    validationRecords: requiredLanes
      .filter((lane) => lane !== undefined && lane.key !== "authority" && lane.key !== "architecture-decision")
      .map((lane) => hashFramedDomain("operational-verification-lane", lane)),
    errorRecords: findings.filter(({ severity }) => severity === "error").map(({ code }) => code),
    durationMs: Date.now() - started,
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
      "transformRecords",
    ],
    findings,
  });
  return parseOperationalReport(report);
}

export async function inspectCanonicalKnowledge(repositoryRoot: string): Promise<{
  readonly canonicalDigest: ContentHash;
  readonly findings: Array<{
    readonly code: string;
    readonly title: string;
    readonly path?: string;
    readonly severity: "error";
    readonly evidenceIds: string[];
  }>;
}> {
  try {
    const snapshot = await withObservationScope({}, async (scope) => {
      const sources = await collectCanonicalSnapshotSources(repositoryRoot, scope.budget, scope.signal);
      return runObservationTask("canonical", { sources }, scope);
    });
    return { canonicalDigest: snapshot.rootDigest, findings: [] };
  } catch (error) {
    if (error instanceof ObservationError && error.code === "observation-limit-exceeded") throw error;
    const reason = error instanceof Error ? error.message : String(error);
    return {
      canonicalDigest: hashFramedDomain("unavailable-canonical-knowledge", reason),
      findings: [{
        code: "canonical-knowledge-invalid",
        title: reason,
        path: ".projector",
        severity: "error",
        evidenceIds: [],
      }],
    };
  }
}
