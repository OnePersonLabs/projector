import { ArchitectureDecisionSchema, AuthorityRecordSchema, ConceptSchema, ProjectionLensSchema, type ArchitectureDecision, type AuthorityRecord, type CanonicalDocumentEnvelope, type ProjectionLens, type DerivedObservationBudget, type Relation } from "@projector/core";
import { compileProjectionLenses } from "@projector/engine";
const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
export function validateCanonicalRelationEndpoints(relations: readonly Relation[], knownIds: ReadonlySet<string>, options: { populationComplete: boolean; removedIds?: ReadonlySet<string> }): string[] {
  const unresolved: string[] = [];
  for (const relation of relations) if (relation.active && (!knownIds.has(relation.fromId) || !knownIds.has(relation.toId))) {
    const issue = `relation ${relation.id} has a dangling endpoint`;
    if (options.populationComplete || options.removedIds?.has(relation.fromId) || options.removedIds?.has(relation.toId)) throw new Error(issue);
    unresolved.push(`${issue}: ${[relation.fromId, relation.toId].filter(id => !knownIds.has(id)).join(", ")}; external identity population is unobserved`);
  }
  return unresolved;
}
function assertEligibleAuthority(record: AuthorityRecord, subjectId: string, label: string): void {
  if (record.subjectId !== subjectId) throw new Error(`${label} authority ${record.id} is bound to ${record.subjectId}, expected ${subjectId}`);
  if (record.status !== "approved" && record.status !== "auto-approved") throw new Error(`${label} authority ${record.id} is not approved`);
  if (record.conclusion === "unknown" || record.conclusion === "exception") throw new Error(`${label} authority ${record.id} does not authorize activation`);
  if (record.decidedBy === "system" && record.status !== "auto-approved") throw new Error(`system authority ${record.id} lacks auto-approval`);
}

function isEligibleAuthority(record: AuthorityRecord): boolean {
  return (record.status === "approved" || record.status === "auto-approved")
    && record.conclusion !== "unknown"
    && record.conclusion !== "exception"
    && (record.decidedBy !== "system" || record.status === "auto-approved");
}
/** Static contracts only; empty units do not verify dynamic membership or ownership. */
export function validateStaticCanonicalGovernance(documents: readonly CanonicalDocumentEnvelope[], knownAfterIds: ReadonlySet<string>, options: { populationComplete: boolean; removedIds?: ReadonlySet<string>; derivedBudget?: DerivedObservationBudget }): string[] {
  const documentsAfter = new Map(documents.map(d => [d.id, d]));
  const unresolved: string[] = [];
  const authoritiesAfter = [...documentsAfter.values()].filter(({ kind }) => kind === "authority-record").map(({ payload }) => AuthorityRecordSchema.parse(payload) as AuthorityRecord);
  const authorityById = new Map(authoritiesAfter.map((record) => [record.id, record]));
  const decisionsAfter = [...documentsAfter.values()].filter(({ kind }) => kind === "architecture-decision").map(({ payload }) => ArchitectureDecisionSchema.parse(payload) as ArchitectureDecision);
  const lensesAfter = [...documentsAfter.values()].filter(({ kind }) => kind === "projection-lens").map(({ payload }) => ProjectionLensSchema.parse(payload) as ProjectionLens);
    const decisionConcernIds = new Set(decisionsAfter.map(({ concernId }) => concernId));
    for (const authority of authoritiesAfter.filter(isEligibleAuthority)) if (!knownAfterIds.has(authority.subjectId) && !decisionConcernIds.has(authority.subjectId)) {
      const issue = `authority ${authority.id} has a dangling subject ${authority.subjectId}`;
      if (options.populationComplete || options.removedIds?.has(authority.subjectId)) throw new Error(issue);
      unresolved.push(issue);
    }
    for (const decision of decisionsAfter.filter(({ lifecycle }) => lifecycle === "active")) {
      const authority = authorityById.get(decision.authorityRecordId);
      if (authority === undefined) throw new Error(`active decision ${decision.id} has no authority record ${decision.authorityRecordId}`);
      assertEligibleAuthority(authority, decision.concernId, `active decision ${decision.id}`);
    }
    const activeByConcern = new Map<string, string[]>();
    for (const decision of decisionsAfter) {
      if (decision.lifecycle === "active") activeByConcern.set(decision.concernId, [...(activeByConcern.get(decision.concernId) ?? []), decision.id]);
      for (const supersededId of decision.supersedesDecisionIds) {
        const targetDocument = documentsAfter.get(supersededId);
        if (targetDocument?.kind !== "architecture-decision") throw new Error(`decision ${decision.id} supersedes a missing or non-decision target ${supersededId}`);
        const target = ArchitectureDecisionSchema.parse(targetDocument.payload) as ArchitectureDecision;
        if (target.concernId !== decision.concernId) throw new Error(`decision ${decision.id} cannot supersede ${supersededId} from another concern`);
        if (target.lifecycle !== "superseded") throw new Error(`superseded decision ${supersededId} must be superseded in the proposed final state`);
      }
    }
    for (const [concernId, ids] of activeByConcern) if (ids.length > 1) throw new Error(`concern ${concernId} has multiple active decisions: ${ids.sort(compare).join(", ")}`);
    for (const governed of [...decisionsAfter.filter(({ lifecycle }) => lifecycle === "active"), ...lensesAfter.filter(({ status }) => status === "active")]) for (const basis of governed.governanceBasis) {
      const referencedId = basis.kind === "architecture-decision" ? basis.decisionId
        : basis.kind === "hard-constraint" ? basis.conceptId
          : basis.kind === "adopted-standard" ? basis.authorityRecordId
            : basis.kind === "migration-overlay" ? basis.migrationId
              : basis.kind === "active-lens" ? basis.lensId
                : undefined;
      if (referencedId === undefined) continue;
      const target = documentsAfter.get(referencedId);
      const expectedKind = basis.kind === "architecture-decision" ? "architecture-decision"
        : basis.kind === "hard-constraint" ? "concept"
          : basis.kind === "adopted-standard" ? "authority-record"
            : basis.kind === "migration-overlay" ? "migration"
              : "projection-lens";
      if (target?.kind !== expectedKind) throw new Error(`${governed.id} governance basis ${basis.kind} references missing or wrong-kind ${referencedId}`);
      if (basis.kind === "hard-constraint") {
        const concept = ConceptSchema.parse(target.payload) as { status: string };
        if (concept.status !== "active") throw new Error(`${governed.id} hard constraint ${referencedId} is not active`);
      } else if (basis.kind === "architecture-decision") {
        const decision = ArchitectureDecisionSchema.parse(target.payload) as ArchitectureDecision;
        if (decision.lifecycle !== "active") throw new Error(`${governed.id} decision basis ${referencedId} is not active`);
      } else if (basis.kind === "adopted-standard") {
        const authority = AuthorityRecordSchema.parse(target.payload) as AuthorityRecord;
        const subjectId = "concernId" in governed ? governed.concernId : governed.id;
        assertEligibleAuthority(authority, subjectId, `${governed.id} adopted-standard basis`);
      } else if (basis.kind === "active-lens") {
        const lens = ProjectionLensSchema.parse(target.payload) as ProjectionLens;
        if (lens.status !== "active") throw new Error(`${governed.id} lens basis ${referencedId} is not active`);
      }
    }
    compileProjectionLenses({ lenses: lensesAfter, units: [], authorityRecords: authoritiesAfter, ...(options.derivedBudget ? { derivedBudget: options.derivedBudget } : {}) });
  return unresolved;
}

