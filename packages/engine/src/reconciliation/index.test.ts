import { describe, expect, it } from "vitest";

import type { ContentHash } from "@projector/core";

import {
  MANDATORY_VERTICAL_SLICE_STEPS,
  MANDATORY_VERTICAL_SLICE_EVIDENCE_KINDS,
  mandatoryVerticalSliceEvidenceDigest,
  createMandatoryVerticalSliceExecutionContext,
  NonconvergentReconciliationError,
  assertMandatoryVerticalSliceEvidence,
  reconcileToFixedPoint,
} from "./index.js";

describe("reconcileToFixedPoint", () => {
  it("requires a zero-material-delta terminal iteration", async () => {
    const outcomes = [
      { governedStateDigest: ("sha256:v1:" + "1".repeat(64)) as ContentHash, materialChanged: true, fixedPointTerminal: true },
      { governedStateDigest: ("sha256:v1:" + "1".repeat(64)) as ContentHash, materialChanged: false, fixedPointTerminal: true },
    ] as const;

    const result = await reconcileToFixedPoint({
      async iterate(iteration) {
        return outcomes[iteration - 1]!;
      },
    });

    expect(result.converged).toBe(true);
    expect(result.iterations).toHaveLength(2);
    expect(result.materialDelta).toBe(false);
  });

  it("rejects a repeated nonterminal governed digest", async () => {
    await expect(reconcileToFixedPoint({
      async iterate(iteration) {
        return {
          governedStateDigest: `sha256:v1:${(iteration % 2 === 0 ? "2" : "1").repeat(64)}` as const,
          materialChanged: true,
          fixedPointTerminal: false,
        };
      },
    })).rejects.toBeInstanceOf(NonconvergentReconciliationError);
  });
});

describe("mandatory vertical-slice evidence", () => {
  const evidence = () => MANDATORY_VERTICAL_SLICE_STEPS.map((step, index) => {
    const evidenceKind = MANDATORY_VERTICAL_SLICE_EVIDENCE_KINDS[index]!;
    const artifactRefs = [`artifact:concrete:${index + 1}`];
    const proof = {
        stepIndex: index + 1,
        artifactId: `artifact:concrete:${index + 1}`,
        artifactRefs: [`artifact:concrete:${index + 1}`],
        observedAt: `event:${index + 1}`,
        inventoryUnitIds: ["unit:fixture"], classificationIds: ["classification:fixture"], executedRepositoryCode: false,
        familyKeys: ["family:fixture"], familyCount: 1,
        sourceUnitId: "unit:source", testUnitId: "unit:test", causalEvidenceIds: ["evidence:causal"],
        authorityId: "authority:fixture", activeLensId: "lens:fixture", authorityStatus: "approved",
        repairedPaths: ["scripts/validate-repo.mjs"], independenceGroups: ["group:fixture"], provenanceRef: "receipt:fixture",
        shadowLensId: "lens:fixture:shadow", ruleIds: ["rule:fixture"],
        divergenceIds: ["divergence:fixture"], counterEvidenceIds: ["evidence:counter"],
        planId: "plan:fixture", operationKinds: ["move-reference-update"], touchedUnitIds: ["unit:fixture"],
        planDependencyDigest: `sha256:v1:${"1".repeat(64)}`, capsuleDependencyDigest: `sha256:v1:${"1".repeat(64)}`, approvalDependencyDigest: `sha256:v1:${"1".repeat(64)}`,
        leaseId: "lease:fixture", transactionId: "transaction:fixture", journalRef: `journal:${"a".repeat(64)}`, journalPhases: ["prepared", "committed"], touchedPaths: ["path:fixture"],
        operationIds: ["operation:fixture"], pathSummaries: ["moved source to destination", "updated registered reference in package.json"],
        validatorIds: ["validator:fixture"], validationStatuses: ["passed"], validatorEvidenceIds: ["evidence:validator"],
        iterationDigests: [`sha256:v1:${"2".repeat(64)}`], materialChanged: [true], terminalIteration: true,
        invocation: 2, beforeDigest: `sha256:v1:${"3".repeat(64)}`, afterDigest: `sha256:v1:${"3".repeat(64)}`, materialDelta: false,
        unresolvedClusterWork: 0, unresolvedDivergenceIds: [], computedFrom: "state:fixture",
        receiptRef: "/tmp/receipt:fixture", certificateRef: "/tmp/certificate:fixture", receiptHash: `sha256:v1:${"4".repeat(64)}`, certificateHash: `sha256:v1:${"5".repeat(64)}`,
        semanticHashPairs: [{ before: `sha256:v1:${"6".repeat(64)}`, after: `sha256:v1:${"6".repeat(64)}` }],
    };
    return {
      step,
      sequence: index + 1,
      summary: `evidence for ${step}`,
      details: {
        outputDigest: mandatoryVerticalSliceEvidenceDigest(step, evidenceKind, artifactRefs, proof),
        evidenceKind,
        artifactRefs,
        proof,
        assertions: [{ claim: `observed output for ${step}`, observed: true, expected: true, passed: true }],
      },
    };
  });

  const contextFor = (items: ReturnType<typeof evidence>) => createMandatoryVerticalSliceExecutionContext({
    observations: Object.fromEntries(items.map(({ details }) => [details.evidenceKind, { ...details.proof, artifactRefs: undefined }])) as never,
    artifactRefs: Object.fromEntries(items.map(({ details }) => [details.evidenceKind, details.artifactRefs])) as never,
    artifacts: Object.fromEntries(items.flatMap(({ details }) => details.artifactRefs.map((ref) => [ref, { observed: ref }]))),
  }) as ReturnType<typeof createMandatoryVerticalSliceExecutionContext>;

  it("requires all seventeen steps in normative order", () => {
    expect(MANDATORY_VERTICAL_SLICE_STEPS).toHaveLength(17);
    expect(() => assertMandatoryVerticalSliceEvidence(evidence(), contextFor(evidence()))).not.toThrow();
    expect(() => assertMandatoryVerticalSliceEvidence(
      MANDATORY_VERTICAL_SLICE_STEPS.slice(1).map((step, index) => ({
        step,
        sequence: index + 1,
        summary: `evidence for ${step}`,
      })) as unknown as Parameters<typeof assertMandatoryVerticalSliceEvidence>[0], contextFor(evidence()),
    )).toThrow(/17 ordered steps/u);
  });

  it("rejects labels that are not substantiated by output-linked assertions", () => {
    const labelsOnly = evidence().map(({ details: _details, ...item }) => item);
    expect(() => assertMandatoryVerticalSliceEvidence(labelsOnly as unknown as Parameters<typeof assertMandatoryVerticalSliceEvidence>[0], contextFor(evidence()))).toThrow(/structured details/u);
    const falseClaim = evidence();
    falseClaim[13]!.details.assertions[0]!.passed = false;
    expect(() => assertMandatoryVerticalSliceEvidence(falseClaim, contextFor(evidence()))).toThrow(/failed assertion/u);
  });

  it("rejects evidence with a deleted load-bearing proof family for every step", () => {
    for (const index of MANDATORY_VERTICAL_SLICE_STEPS.keys()) {
      const forged = evidence();
      forged[index]!.details.proof = {} as unknown as typeof forged[number]["details"]["proof"];
      expect(() => assertMandatoryVerticalSliceEvidence(forged, contextFor(evidence()))).toThrow(/step/u);
    }
  });

  it("rejects falsification of each step's distinct proof field", () => {
    const proofFields = [
      "inventoryUnitIds", "familyKeys", "causalEvidenceIds", "authorityId", "provenanceRef", "ruleIds", "divergenceIds",
      "planId", "planDependencyDigest", "leaseId", "operationIds", "validatorIds", "iterationDigests", "beforeDigest",
      "computedFrom", "certificateHash", "semanticHashPairs",
    ] as const;
    for (const [index, field] of proofFields.entries()) {
      const forged = evidence();
      const proof = { ...forged[index]!.details.proof };
      delete proof[field];
      forged[index]!.details.proof = proof as typeof forged[number]["details"]["proof"];
      expect(() => assertMandatoryVerticalSliceEvidence(forged, contextFor(evidence()))).toThrow(/proof field|typed predicate|output digest|correspond/u);
    }
  });

  it("rejects self-corresponding labels that only repeat the step name", () => {
    const forged = evidence();
    forged[0]!.details.artifactRefs = ["artifact:inventory-and-classify-without-execution"];
    forged[0]!.details.proof = { step: "inventory-and-classify-without-execution" } as unknown as typeof forged[number]["details"]["proof"];
    expect(() => assertMandatoryVerticalSliceEvidence(forged, contextFor(evidence()))).toThrow(/step/u);
  });

  it("rejects an omnibus proof whose digest is recomputed against mismatched run observations", () => {
    const actual = evidence();
    const context = contextFor(actual);
    for (const index of MANDATORY_VERTICAL_SLICE_STEPS.keys()) {
      const forged = evidence();
      const proof: Record<string, unknown> = { ...forged[index]!.details.proof, artifactRefs: forged[index]!.details.artifactRefs };
      const firstKey = Object.keys(proof).find((key) => key !== "artifactRefs");
      if (firstKey === undefined) throw new Error("expected a proof field");
      proof[firstKey] = typeof proof[firstKey] === "string" ? `${proof[firstKey]}:forged` : "forged";
      forged[index]!.details.proof = proof as typeof forged[number]["details"]["proof"];
      forged[index]!.details.outputDigest = mandatoryVerticalSliceEvidenceDigest(
        forged[index]!.step,
        forged[index]!.details.evidenceKind,
        forged[index]!.details.artifactRefs,
        proof,
      );
      expect(() => assertMandatoryVerticalSliceEvidence(forged, context), `step ${index + 1}`).toThrow(/correspond|proof field|typed predicate/u);
    }
  });

  it("requires bidirectional exact proof/context keys, including journalRef", () => {
    const actual = evidence();
    const context = contextFor(actual);

    const missingObservedField = evidence();
    const missingObservedProof = { ...missingObservedField[0]!.details.proof } as Record<string, unknown>;
    delete missingObservedProof.observedAt;
    missingObservedField[0]!.details.proof = missingObservedProof as typeof missingObservedField[number]["details"]["proof"];
    missingObservedField[0]!.details.outputDigest = mandatoryVerticalSliceEvidenceDigest(
      missingObservedField[0]!.step,
      missingObservedField[0]!.details.evidenceKind,
      missingObservedField[0]!.details.artifactRefs,
      missingObservedProof,
    );
    expect(() => assertMandatoryVerticalSliceEvidence(missingObservedField, context)).toThrow(/proof keys|correspond/u);

    const missingJournalRef = evidence();
    const missingJournalProof = { ...missingJournalRef[8]!.details.proof } as Record<string, unknown>;
    delete missingJournalProof.journalRef;
    missingJournalRef[8]!.details.proof = missingJournalProof as typeof missingJournalRef[number]["details"]["proof"];
    missingJournalRef[8]!.details.outputDigest = mandatoryVerticalSliceEvidenceDigest(
      missingJournalRef[8]!.step,
      missingJournalRef[8]!.details.evidenceKind,
      missingJournalRef[8]!.details.artifactRefs,
      missingJournalProof,
    );
    expect(() => assertMandatoryVerticalSliceEvidence(missingJournalRef, context)).toThrow(/proof field|proof keys|correspond/u);

    const extraProof = evidence();
    const extraProofValue = { ...extraProof[0]!.details.proof, contextOnly: "forged" };
    extraProof[0]!.details.proof = extraProofValue;
    extraProof[0]!.details.outputDigest = mandatoryVerticalSliceEvidenceDigest(
      extraProof[0]!.step,
      extraProof[0]!.details.evidenceKind,
      extraProof[0]!.details.artifactRefs,
      extraProofValue,
    );
    expect(() => assertMandatoryVerticalSliceEvidence(extraProof, context)).toThrow(/proof keys|correspond/u);

    const contextObservation = structuredClone(context.observations) as Record<string, Record<string, unknown>>;
    contextObservation.inventory!.contextOnly = "forged";
    const contextWithExtra = createMandatoryVerticalSliceExecutionContext({
      observations: contextObservation as never,
      artifactRefs: context.artifactRefs,
      artifacts: context.artifacts,
    });
    expect(() => assertMandatoryVerticalSliceEvidence(actual, contextWithExtra)).toThrow(/proof keys|correspond/u);
  });
});
