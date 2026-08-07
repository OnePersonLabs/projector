# Evidence and Authority

## Evidence and authority

Authority must remain inspectable without pretending that one scalar captures several different questions.

## Evidence contract

```ts
export type EvidenceKind =
  | "explicit-decision"
  | "repository-structure"
  | "code-relationship"
  | "test"
  | "documentation"
  | "git-history"
  | "runtime-observation"
  | "build-output"
  | "official-documentation"
  | "standard"
  | "research-paper"
  | "reference-implementation"
  | "issue-or-incident"
  | "user-decision"
  | "agent-inference";

export interface EvidenceClaim {
  subjectKey: string;
  predicate: string;
  object: unknown;
  inferenceConfidence?: Confidence;
}

export interface Evidence {
  id: EntityId;
  kind: EvidenceKind;
  locator: string;
  capturedAt: string;
  sourceDate?: string;
  contentHash: ContentHash;
  excerpt?: string;
  claims: EvidenceClaim[];
  reliability:
    | "mechanically-proven"
    | "high"
    | "medium"
    | "low"
    | "untrusted";
  normativeAuthority:
    | "binding-decision"
    | "hard-constraint"
    | "authoritative-guidance"
    | "supporting"
    | "descriptive-only"
    | "none";
  independenceGroup: string;
  applicability: "direct" | "analogous" | "contextual" | "uncertain";
  freshness: Confidence;
  causalOrigin: CausalOrigin;
  metadata: Record<string, unknown>;
}
```

Repository text, commit messages, issue content, model responses, and web content are untrusted data. They never alter Projector permissions or orchestration policy by being present in a source.

## Independence and causal origin

Forty copies generated from one template represent one design occurrence unless independent evidence shows otherwise.

Signals include:

- common introduction commit.
- copy/move history.
- common scaffold or generator.
- near-identical AST plus common ancestor.
- shared migration source.

More importantly, a conforming occurrence created by Projector under Lens X MUST NOT count as independent evidence that Lens X should be authoritative. Historical evaluation MUST identify Projector-endogenous changes and discount them from the same authority claim.

This rule prevents governance from manufacturing its own evidence base.

## Authority vector

```ts
export interface AuthorityVector {
  explicitDecisionAlignment: number;
  productConstraintFit: number;
  semanticFit: number;
  independentOccurrence: number;
  historicalStability: number;
  independentValidationSupport: number;
  boundaryCoherence: number;
  maintenanceOutcome: number;
  platformCompatibility: number;
  externalRationale: number;
  ecosystemHealth: number;
  securitySupport: number;
  reversibility: number;
  migrationCost: number;
  counterEvidence: number;
}
```

The vector is an explainable support profile, not a probability distribution. Aggregate ranking scores MAY be computed for prioritization, but MUST NOT be labeled as calibrated probability unless separately calibrated.

## Typed reconsideration triggers

```ts
export type AuthorityReconsiderTrigger =
  | { type: "concept-changed"; conceptId: EntityId }
  | { type: "requirement-changed"; subjectId: EntityId | string }
  | { type: "scenario-changed"; scenarioId: EntityId }
  | { type: "relation-changed"; relationId: EntityId }
  | { type: "constraint-changed"; constraintId: EntityId }
  | { type: "scope-expanded"; scopeKey: string }
  | { type: "surface-added"; surfaceKind: Surface["kind"] }
  | { type: "assumption-falsified"; assumptionKey: string }
  | { type: "lens-changed"; lensId: EntityId }
  | { type: "evidence-invalidated"; evidenceId: EntityId }
  | { type: "evidence-refresh-required"; policyKey: string }
  | { type: "toolchain-version"; tool: string; constraint: string }
  | { type: "platform-version"; platform: string; constraint: string }
  | { type: "project-preference-changed"; preferenceId: EntityId }
  | { type: "counterevidence-threshold"; subjectId: EntityId; threshold: number }
  | { type: "date"; at: string }
  | { type: "manual-review" };

export interface EvidenceRefreshPolicy {
  key: string;
  mode: "on-trigger" | "version-sensitive" | "max-age" | "manual";
  maxAgeDays?: number;
  trackedTechnologies?: string[];
  requireOfficialSourceWhenAvailable: boolean;
}
```

## Authority records

```ts
export interface AuthorityRecord {
  id: EntityId;
  key: string;
  subjectId: EntityId;
  status: "provisional" | "approved" | "auto-approved" | "rejected" | "superseded";
  conclusion: "preserve" | "normalize" | "migrate" | "exception" | "unknown";
  rationale: string;
  alternatives: AuthorityAlternative[];
  assumptions: string[];
  reconsiderWhen: AuthorityReconsiderTrigger[];
  evidenceRefreshPolicy?: EvidenceRefreshPolicy;
  vector: AuthorityVector;
  assessmentConfidence: "low" | "medium" | "high";
  evidence: EvidenceRef[];
  governanceRiskClass: RiskClass;
  decidedBy: "system" | "user" | "policy";
  createdAt: string;
  semanticHash: ContentHash;
}
```

Authority is always two-stage:

```text
descriptive inference: what regularity appears to exist?
normative selection: what should govern future evolution?
```

The stages MUST remain distinct even when the same run performs both.

---


