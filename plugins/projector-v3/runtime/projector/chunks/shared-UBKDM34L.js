import {
  ChangeLifecycleStore
} from "./shared-IYQMR2PN.js";
import {
  KnowledgeDecisionBaselineSchema,
  captureDecisionTriggerObservations
} from "./shared-P2AMJQGE.js";
import "./shared-XUP2BAXD.js";
import "./shared-3OPGBX4O.js";
import {
  assertSupportedCanonicalVersions,
  parseCanonicalMarkdownDocument,
  parseTomlDocument
} from "./shared-GXAKKSCS.js";
import "./shared-5EIJVVQJ.js";
import "./shared-XN3IZTFL.js";
import "./shared-EK2KJXX2.js";
import "./shared-53BCDAHA.js";
import "./shared-JRUJSZFM.js";
import "./shared-RMBXVF7C.js";
import {
  hashFramedDomain,
  hashSemantic,
  hydrateCanonicalDocumentWire
} from "./shared-Q56AARV7.js";
import "./shared-WC2OT3WX.js";

// node_modules/@projector/control-plane/dist/knowledge/decision-baseline-data.js
async function executeDecisionBaselineData(input) {
  if (input.kind === "git-observations") {
    const parsed = await executeDecisionBaselineData({ kind: "canonical", sources: input.sources });
    if (parsed.kind !== "canonical")
      throw new Error("Canonical baseline parsing returned another result kind");
    if (parsed.error !== void 0)
      return { kind: input.kind, observations: [], error: parsed.error };
    for (const [index, record] of parsed.documents.entries()) {
      if (record.id !== input.sources[index].subjectId)
        return { kind: input.kind, observations: [], error: `tracked trigger subject ${input.sources[index].subjectId} cannot be authenticated` };
    }
    const recordedDecision = parsed.documents.at(-1);
    if (recordedDecision?.semanticHash !== input.decision.semanticHash)
      return { kind: input.kind, observations: [], error: "decision changed without an applicable authority baseline" };
    return { kind: input.kind, observations: captureDecisionTriggerObservations(input.decision, input.authority, parsed.documents.slice(0, -1), input.paths, "repository") };
  }
  if (input.kind === "canonical") {
    try {
      return { kind: "canonical", documents: input.sources.map(({ text, path }) => {
        let record;
        try {
          record = hydrateCanonicalDocumentWire(path.endsWith(".md") ? parseCanonicalMarkdownDocument(text, path) : parseTomlDocument(text, path));
        } catch (error) {
          throw new Error(`invalid tracked canonical document at ${path}: ${error instanceof Error ? error.message : String(error)}`);
        }
        assertSupportedCanonicalVersions(record, ` at ${path}`);
        return record;
      }) };
    } catch (error) {
      return { kind: "canonical", documents: [], error: error instanceof Error ? error.message : String(error) };
    }
  }
  const store = ChangeLifecycleStore.fromCollectedSources(input.repositoryRoot, input.sources);
  const receipts = [];
  for (const path of Object.keys(input.sources).sort()) {
    if (!/^\.projector\/runtime\/change-lifecycles\/results\/[a-f0-9]{64}\.json$/u.test(path))
      continue;
    try {
      const untrusted = JSON.parse(input.sources[path]);
      if (typeof untrusted.attemptId !== "string")
        continue;
      const expected = hashFramedDomain("change-lifecycle-selector", untrusted.attemptId).slice("sha256:v1:".length);
      if (!path.endsWith(`/${expected}.json`))
        continue;
      const record = await store.readAttemptResult(untrusted.attemptId);
      if (record.outcome !== "success")
        continue;
      const approval = await store.readApproval(record.approvalId);
      const capture = await store.readCapture(approval.semanticChangeId);
      for (const validation of record.result.validations) {
        if (validation.validatorId !== "projector.post-change-knowledge" && validation.validatorId !== "projector.canonical-decision-baselines")
          continue;
        if (validation.status !== "passed" || !Array.isArray(validation.details.decisionBaselines))
          continue;
        for (const item of validation.details.decisionBaselines) {
          const parsed = KnowledgeDecisionBaselineSchema.safeParse(item);
          if (!parsed.success)
            continue;
          const baseline = parsed.data;
          const mutations = capture.proposal.canonicalMutations?.filter((candidate) => candidate.kind === "authority-record" && candidate.payload.id === baseline.authorityId || candidate.kind === "architecture-decision" && candidate.payload.id === baseline.decisionId) ?? [];
          const approved = mutations.some((mutation) => {
            if (!("payload" in mutation))
              return false;
            const payload = mutation.payload;
            return hashSemantic(mutation.kind, payload) === (mutation.kind === "authority-record" ? baseline.authoritySemanticHash : baseline.decisionSemanticHash);
          });
          if (!approved || capture.planHash !== approval.planHash)
            continue;
          receipts.push({
            baseline,
            reference: record.receiptHash ?? record.contentHash,
            completedAt: record.completedAt,
            observationsIdentity: hashFramedDomain("decision-baseline-observations", baseline.observations)
          });
        }
      }
    } catch {
    }
  }
  return { kind: "receipts", receipts: receipts.sort((left, right) => right.completedAt.localeCompare(left.completedAt) || left.reference.localeCompare(right.reference)) };
}
export {
  executeDecisionBaselineData
};
