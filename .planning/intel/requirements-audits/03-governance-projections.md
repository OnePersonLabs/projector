# Audit: Governance and Projections Requirements

## Scope

Audited `.planning/intel/requirements-parts/03-governance-projections.md` against:

- `PROJECTOR_SPEC/04-governance/scope-and-rules.md`
- `PROJECTOR_SPEC/04-governance/lenses.md`
- `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md`
- `PROJECTOR_SPEC/05-projections/execution-capsules.md`
- `PROJECTOR_SPEC/05-projections/runtime-and-representations.md`

The review covered every normative paragraph/list item, TypeScript field/type, enum and quoted literal, algorithm step/order, proof and assurance rule, exception/escape hatch, lock, non-goal, and source heading mapping.

## Coverage and integrity

| Check | Result |
|---|---:|
| Source headings (H1/H2/H3) | 44 (H1 5, H2 39, H3 0) |
| Source-coverage rows | 44/44 mapped |
| v1 requirement IDs | 161, unique and contiguous by prefix |
| Locked constraints | 10 |
| Explicit non-goals | 12 |
| Total IDs | 183, unique |
| Quoted source literals checked | 134 unique; no omissions after patch |
| Contract field names checked | All source code fields represented |

All source H1/H2 headings are mapped in the fragment's Source Coverage table. There are no H3 headings in the audited source files.

## Findings and fixes

### Fixed — high-confidence fidelity gaps (P1/P2)

1. **PROJ-005 — signature-profile assurance was weakened (P1).** The prior text omitted that formatting-insensitive AST equality is only heuristic for business behavior, exported declaration equality says nothing about runtime semantics, and test equivalence cannot prove untested side effects. It also changed source `MAY`/non-proof language into an unconditional assertion. The requirement now preserves all three assurance boundaries.
2. **INVAL-003 — Relevance Closure role was omitted (P2).** The requirement now states that pre-change Relevance Closure is an upstream cognition mechanism in addition to forbidding its use as an invalidation substitute.
3. **INVAL-014 — algorithm condition wording was narrowed (P2).** `analyzer failures` is now plural, matching the source failure class.
4. **PROJ-016 — routing operation terminology was incorrect (P2).** `backdatable` was replaced with the defined `backdated` operation and the eligibility condition is explicit.
5. **Contract type fidelity (P2).** Typed fields and optionality were made explicit for the rule/predicate, lens, derivation, invalidation, capsule, transform, and command contracts, including `ValidationResult["evidenceLane"]`, `ValidationResult["assurance"]`, `StateDigest`, async transform method signatures, and all source enum literals. This prevents callers from inferring weaker or incompatible contracts from field-name-only summaries.

## Validation performed

- Re-read all five source files with line-numbered output and traced each source H1/H2/H3 heading to the coverage table.
- Checked every source quoted literal against the fragment; all 134 unique literals are represented.
- Checked every TypeScript contract field name; no source field is absent from the fragment.
- Verified ID uniqueness and contiguous numeric ranges for every prefix.
- Verified the normal/failure/edge semantics represented by the audited requirements: exact-vs-heuristic proof, unresolved cycle widening, and state/query-sensitive invalidation/capsule rebinding.

## Residual risk and follow-up

No unresolved source-to-fragment omissions remain in this scope. Runtime behavior (actual regex safety, SCC convergence/limits, invalidation execution, command sandboxing, transform rollback, and representation-fidelity validators) still requires implementation-level tests and environment verification; this audit only establishes requirements traceability.

