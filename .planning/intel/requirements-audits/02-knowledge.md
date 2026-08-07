# Requirements Audit — Knowledge, Relevance, Architecture, Evidence, and Risk

## Scope

Audited `.planning/intel/requirements-parts/02-knowledge.md` against every authoritative H1/H2/H3 section in:

- `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md`
- `PROJECTOR_SPEC/03-knowledge/evidence-and-authority.md`
- `PROJECTOR_SPEC/03-knowledge/architecture-decisions.md`
- `PROJECTOR_SPEC/03-knowledge/architecture-concerns-and-validity.md`
- `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md`
- `PROJECTOR_SPEC/03-knowledge/risk-and-execution-policy.md`

The review checked normative force (`MUST`, `MUST NOT`, `SHOULD`, `MAY`), conditions and exceptions, ordering, contract fields, enum/union literals, list elements, non-goals, locked constraints, source links, and source-heading coverage.

## Results

| Area | v1 IDs | Locked IDs | Non-goals | Result |
|---|---:|---:|---:|---|
| Relevance/change cognition | 37 | 2 | 3 | Covered |
| Evidence/authority | 12 | 1 | 1 | Covered |
| Architecture | 41 | 3 | 7 | Covered |
| Risk/execution policy | 7 | 1 | 1 | Covered |
| **Total** | **97** | **7** | **12** | **Covered** |

All 97 v1 requirements remain unchecked (`[ ]`); audit completion is recorded here rather than in the requirement fragment. IDs are unique and contiguous within each prefix (`KNOW-001..037`, `EVID-001..012`, `ARCH-001..041`, `RISK-001..007`). No new IDs were needed after repairing the existing requirement records in place.

All 38 authoritative source headings (6 H1, 31 H2, 1 H3) have a source-coverage row in the fragment. Every row resolves to an existing requirement, locked constraint, or explicit non-goal; no orphan heading or dangling ID was found.

## Corrections applied

The fragment was complete in structure but had several fidelity gaps. The following existing IDs were strengthened without renumbering or changing their source ownership:

- **KNOW-001:** retained the relevance/impact distinction and added the source’s exploratory, confidence-ranked relevance allowance and the distinct omission/context-waste versus mutation/completion failure modes.
- **KNOW-006:** made the source rule that names are not identities explicit.
- **KNOW-012:** restored the condition that aliases apply when one canonical entity has recurring alternate terminology.
- **KNOW-016:** restored the ordered evidence-preference qualifiers (`semantic` IDs/request terms, stable aliases, and Architecture Decision relationships).
- **KNOW-015:** restored the `consequence` definition for entities plausibly relevant because of direct/governing material (rather than only entities “caused by” it).
- **KNOW-020:** restored the explicit closure-bound discovery-result wording, including queries deciding what entered, did not enter, or stopped expansion.
- **KNOW-031:** restored the full quality-metric list, including held-out recall and average/percentile subgraph-size measures.
- **KNOW-034:** restored “newly discovered” and canonical/derived graph promotion language for surprise learning.
- **KNOW-036:** made the reference algorithm atomic at the clause level: intent/constraint normalization, named/code/artifact seeding, declared/derived traversal, selector/applicability matching, architecture-decision relationships, explicit band literals, `StateValueDependencyRef`, and dependency/query ordering (including empty/stop results).
- **ARCH-007:** restored canonical entity selection, reconsideration-trigger inputs, event/contract/public-surface relationships, adapter-declared platform implications, and replayable model inference at the frontier.
- **ARCH-009:** made the technology-neutral prohibition explicitly cover any technology.
- **ARCH-012/015:** made the non-score materiality boundary and the “progressive commitment, not omission” disclosure boundary explicit.
- **ARCH-028:** tied recorded preference influence to material option evaluation, as required by the source.
- **ARCH-031:** preserved the source’s allowance for deferral guardrails to protect reversibility while forbidding hidden architecture commitment.
- **ARCH-032:** restored the small typed consequence-kernel wording and the allowed “constrain another decision” / “remain advisory” outcomes.
- **EVID-008:** restored the allowance to compute aggregate ranking scores for prioritization while prohibiting probability labeling without calibration.
- **RISK-005:** restored the explicit “semantic” qualifier for unresolved identity/ownership uncertainty.

No source clause required a new requirement ID after these repairs. No weakened `MUST`/`MUST NOT` force remains in the audited fragment.

## Prioritization

- **P1 documentation fidelity (fixed, high confidence):** the reference-algorithm and closure-binding omissions in KNOW-020/KNOW-036 could have hidden dependency invalidation requirements; restoring the exact literals and ordering removes that planning risk.
- **P2 documentation fidelity (fixed, high confidence):** the remaining wording gaps could weaken identity, relevance-quality, architecture-materiality, preference, evidence, or uncertainty policy interpretation; each is now explicit in its existing ID.
- **Residual P2 delivery risk:** this is a source-to-requirements audit only. Runtime implementations may still fail to honor the documented contracts until separately verified.

## Validation and residual risk

- Structural validation: 97 v1 checkboxes are `[ ]`; 116 total unique IDs (97 v1 + 7 locked + 12 non-goal); 38/38 source headings mapped.
- Contract validation: all source TypeScript fields, optional markers, enum/union literals, trigger variants, and policy fields are present in the corresponding `*-exactly` requirements.
- Ordering validation: relevance cognition, architecture preflight, consequence activation, and risk-policy sequences are represented in source order.
- No runtime or implementation tests were applicable; this audit validates documentation/requirements fidelity only. Runtime behavior, generated artifacts, and downstream implementation conformance remain delivery-time risks.
