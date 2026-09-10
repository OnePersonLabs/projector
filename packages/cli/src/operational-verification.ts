import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { analyzeLocalRepository } from "@projector/analyzers";
import { hashFramedDomain, type ContentHash } from "@projector/core";
import {
  CanonicalFileRepository,
  createOperationalReport,
  parseOperationalReport,
  unavailableOperationalEvidence,
  type OperationalExitProof,
  type OperationalReport,
} from "@projector/runtime";

const execFileAsync = promisify(execFile);

export interface ReadOnlyOperationalVerificationOptions {
  readonly signal: AbortSignal;
  readonly toolVersion: string;
  readonly policy: unknown;
}

export async function runReadOnlyOperationalVerification(
  repositoryRoot: string,
  options: ReadOnlyOperationalVerificationOptions,
): Promise<OperationalReport> {
  const started = Date.now();
  options.signal.throwIfAborted();
  const knowledge = await inspectCanonicalKnowledge(repositoryRoot);
  options.signal.throwIfAborted();
  const analysis = await analyzeLocalRepository({ repositoryRoot });
  options.signal.throwIfAborted();

  const findings = [
    ...knowledge.findings,
    {
      code: "canonical-authentication-scope",
      title: "Canonical checking authenticates document schemas and hashes. Architectural conformance and decision validity are not evaluated by this operational command; use context and reconcile for scoped semantic evidence.",
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
  ];
  const proof: OperationalExitProof = {
    commandFailed: false,
    blockingInvalidity: knowledge.findings.length > 0 || analysis.failures.length > 0,
    approvalRequired: false,
    incompleteCoverage: false,
    requiredUnavailable: analysis.surface.access === "unavailable",
    recoveryFailure: false,
    budgetExhausted: false,
    resumable: false,
  };
  const stateDigest = hashFramedDomain("operational-run-state", {
    repositoryRoot,
    command: "verify",
    findings,
    canonicalDigest: knowledge.canonicalDigest,
  });
  let gitHead: string | undefined;
  try {
    gitHead = (await execFileAsync("git", ["-C", repositoryRoot, "rev-parse", "HEAD"], {
      encoding: "utf8",
      signal: options.signal,
    })).stdout.trim();
  } catch (error) {
    options.signal.throwIfAborted();
    if (error instanceof Error && error.name === "AbortError") throw error;
  }
  const evidence = {
    ...unavailableOperationalEvidence("not exercised by local operational composition"),
    configDigest: knowledge.canonicalDigest,
    toolchainDigest: hashFramedDomain("operational-toolchain", options.toolVersion),
    ...(gitHead === undefined ? {} : { gitHead: hashFramedDomain("operational-git-head", gitHead) }),
    worktreeDigest: stateDigest,
    canonicalDigest: knowledge.canonicalDigest,
    analyzerRecords: analysis.capabilities.map(({ analyzerId, adapterVersion }) => `${analyzerId}@${adapterVersion}`),
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
      "decisionRecords",
      "transformRecords",
      "validationRecords",
      "architecturalConformance",
      "decisionValidity",
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
    const snapshot = await new CanonicalFileRepository(repositoryRoot).snapshot();
    return { canonicalDigest: snapshot.rootDigest, findings: [] };
  } catch (error) {
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
