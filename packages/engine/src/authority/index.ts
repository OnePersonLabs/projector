import type { AuthorityClass, AuthorityRecord, GovernanceBasis, ProjectionLens } from "@projector/core";

export const AUTHORITY_ORDER = [
  "host-safety",
  "platform-constraint",
  "approved-user-intent",
  "active-lens",
  "adopted-external-standard",
  "migration-overlay",
  "local-convention",
  "inferred-candidate",
  "task-suggestion",
] as const satisfies readonly AuthorityClass[];

const authorityRanks = new Map<AuthorityClass, number>(AUTHORITY_ORDER.map((authority, index) => [authority, index]));

/** Lower numeric rank is stronger. */
export function authorityRank(authority: AuthorityClass): number {
  const rank = authorityRanks.get(authority);
  if (rank === undefined) throw new Error(`unknown authority class ${String(authority)}`);
  return rank;
}

export function compareAuthority(left: AuthorityClass, right: AuthorityClass): number {
  return authorityRank(left) - authorityRank(right);
}

export function governanceBasisIsEndogenous(lensId: string, basis: readonly GovernanceBasis[]): boolean {
  return basis.some((item) => item.kind === "active-lens" && item.lensId === lensId);
}

export interface LensAuthorityAssessment {
  eligible: boolean;
  reasons: string[];
  record?: AuthorityRecord;
}

/** Authority records are consumed, never synthesized from a descriptive candidate. */
export function assessLensAuthority(
  lens: ProjectionLens,
  records: readonly AuthorityRecord[],
): LensAuthorityAssessment {
  const record = records.find(({ id }) => id === lens.authorityRecordId);
  const reasons: string[] = [];
  if (governanceBasisIsEndogenous(lens.id, lens.governanceBasis)) {
    reasons.push(`lens ${lens.id} cannot cite itself as its governance basis`);
  }
  if (record === undefined) {
    reasons.push(`authority record ${lens.authorityRecordId} is missing`);
  } else {
    if (record.status !== "approved" && record.status !== "auto-approved") {
      reasons.push(`authority record ${record.id} has non-active status ${record.status}`);
    }
    if (record.conclusion === "unknown" || record.conclusion === "exception") {
      reasons.push(`authority record ${record.id} does not authorize general lens activation`);
    }
  }
  return {
    eligible: reasons.length === 0,
    reasons,
    ...(record === undefined ? {} : { record: structuredClone(record) }),
  };
}
