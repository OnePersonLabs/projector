import { ArchitectureEvaluationRequestSchema, ArchitectureConcernSchema, AuthorityRecordSchema, DeveloperPreferenceSchema, canonicalJson, hashSemantic, type ArchitectureConcern, type AuthorityRecord, type DecisionOption, type DeveloperPreference, type Evidence } from "@projector/core";
import { evaluateDecisionOptions, evaluateSelector } from "@projector/engine";
import { observeChangeRepository, type ChangeRepositoryObservation } from "../change-lifecycle/repository-observer.js";
export { ArchitectureEvaluationOutputSchema } from "@projector/core";

/** Reports candidate tradeoffs. This service cannot approve or mutate canonical products. */
export async function evaluateArchitectureOptions(observation: Pick<ChangeRepositoryObservation, "canonical">, request: unknown, host: { now?: () => string } = {}) {
  const input = ArchitectureEvaluationRequestSchema.parse(request);
  const documents = observation.canonical.documents;
  const read = (id: string, kind: string) => documents.find((item) => item.id === id && item.kind === kind)?.payload;
  const concern = ArchitectureConcernSchema.parse(read(input.concernId, "architecture-concern")) as ArchitectureConcern;
  if (concern.semanticHash !== hashSemantic("architecture-concern", concern)) throw new Error(`concern ${concern.id} failed semantic authentication`);
  if (concern.status !== "active" && concern.status !== "candidate") throw new Error(`concern ${concern.id} is not open for evaluation`);
  const authorities = documents.filter(({ kind }) => kind === "authority-record").map(({ payload }) => AuthorityRecordSchema.parse(payload) as AuthorityRecord)
    .filter((record) => record.subjectId === concern.id && (record.status === "approved" || record.status === "auto-approved"));
  for (const record of authorities) if (record.semanticHash !== hashSemantic("authority-record", record)) throw new Error(`authority ${record.id} failed semantic authentication`);
  const policies = authorities.flatMap((record) => record.evidenceRefreshPolicy === undefined ? [] : [record.evidenceRefreshPolicy]);
  const required = (input.research?.required ?? true) || concern.materiality === "blocking-now" || policies.length > 0;
  const maxAgeDays = Math.min(input.research?.maxAgeDays ?? 30, ...policies.flatMap((policy) => policy.mode === "max-age" && policy.maxAgeDays !== undefined ? [policy.maxAgeDays] : []));
  const evaluatedAt = (host.now ?? (() => new Date().toISOString()))();
  const clock = Date.parse(evaluatedAt);
  if (!Number.isFinite(clock)) throw new Error("architecture evaluation clock is invalid");
  const records = (input.research?.records ?? []) as Evidence[];
  const recordIdentities = new Map<string, string>();
  for (const record of records) {
    const identity = canonicalJson(record);
    if (recordIdentities.has(record.id) && recordIdentities.get(record.id) !== identity) throw new Error(`conflicting research evidence ${record.id}`);
    recordIdentities.set(record.id, identity);
  }
  const usable = records.filter((record) => {
    const captured = Date.parse(record.capturedAt);
    return record.locator.trim().length > 0 && Number.isFinite(captured) && captured <= clock && clock - captured <= maxAgeDays * 86400000
      && record.freshness > 0 && record.applicability === "direct" && record.reliability !== "untrusted"
      && record.claims.some(({ subjectKey }) => subjectKey === concern.id)
      && (!policies.some(({ requireOfficialSourceWhenAvailable }) => requireOfficialSourceWhenAvailable) || record.normativeAuthority === "authoritative-guidance")
      && !policies.some(({ mode }) => mode === "version-sensitive");
  });
  const options = input.options as DecisionOption[];
  const matchesPreference = (preference: DeveloperPreference, option: DecisionOption) => canonicalJson(preference.selector) === canonicalJson(concern.scope)
    || evaluateSelector(preference.selector, { id: option.key, values: { tag: option.key }, dependencyKeys: [] }).matched;
  const covered = options.every((option) => usable.some((record) => option.evidence.some(({ evidenceId }) => evidenceId === record.id) && record.claims.some(({ subjectKey }) => subjectKey === option.key)));
  const preferenceIds: string[] = [];
  for (const id of new Set([...(input.preferenceIds ?? []), ...documents.filter(({ kind }) => kind === "developer-preference").map(({ id }) => id)])) {
    const payload = read(id, "developer-preference");
    if (payload === undefined) throw new Error(`authenticated preference ${id} is unavailable`);
    const preference = DeveloperPreferenceSchema.parse(payload) as DeveloperPreference;
    if (preference.id !== id || preference.semanticHash !== hashSemantic("developer-preference", preference)) throw new Error(`preference ${id} failed semantic authentication`);
    if (preference.status === "active" && options.some((option) => matchesPreference(preference, option))) preferenceIds.push(id);
  }
  const result = await evaluateDecisionOptions({ concern, options, preferenceIds, research: { required, affectedEvidenceIds: concern.evidence.map(({ evidenceId }) => evidenceId) }, acceptance: input.acceptance ?? { kind: "automatic" }, evaluatedAt }, {
    research: { verifyOptionSet: async () => ({ options, evidenceIds: usable.map(({ id }) => id), unavailable: !covered, uncertainty: ["Research provenance is submitted evidence; source hashes do not attest external truth.", ...(!covered ? ["Fresh concern-scoped research does not cover every proposed option."] : [])] }) },
    preferences: {
      read: async (id) => { const record = read(id, "developer-preference"); return record === undefined ? undefined : DeveloperPreferenceSchema.parse(record) as DeveloperPreference; },
      match: async ({ preference, options: candidates }) => candidates.filter((option) => matchesPreference(preference, option)).map(({ key }) => key),
    },
    authority: { read: async (id) => { const record = read(id, "authority-record"); return record === undefined ? undefined : AuthorityRecordSchema.parse(record) as AuthorityRecord; } },
  });
  return { ...result, canonicalMutationAuthorized: false as const };
}

export async function evaluateRepositoryArchitectureOptions(repositoryRoot: string, request: unknown) {
  return evaluateArchitectureOptions(await observeChangeRepository(repositoryRoot), request);
}
