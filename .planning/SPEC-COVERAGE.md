# Projector Specification Migration Coverage

**Migration date:** 2026-08-07  
**Authoritative inputs:** 44 Markdown documents  
**Excluded as non-authoritative:** `PROJECTOR_SPEC/INDEX.md`, `PROJECTOR_SPEC/PROJECTOR_SPEC.md`

## Migration Contract

The original specification may be removed only when all of these conditions hold:

1. Every authoritative input has an exact, checksummed migration snapshot.
2. Every source H1, H2, and H3 maps to requirements, locked constraints/decisions, explicit non-goals, or retained context.
3. Every normative obligation is re-expressed as a self-contained, atomic GSD requirement with a stable ID and source locator.
4. Independent reviewers have compared every requirements shard to its authoritative source and repaired omissions or weakened normative language.
5. Every v1 requirement maps to exactly one roadmap phase.
6. Phase plans preserve the detailed contracts, acceptance conditions, proof boundaries, thresholds, and dependencies owned by their mapped requirements.
7. No GSD artifact requires `PROJECTOR_SPEC/` to remain present for interpretation or execution.
8. Projector imports the GSD artifacts into its own canonical model and proves equivalent requirement, decision, constraint, non-goal, relationship, and acceptance coverage.
9. Projector governs its own repository successfully through plan, execution, verification, reconciliation, recovery, explanation, and completion workflows.
10. Only after the preceding gates pass may `PROJECTOR_SPEC/`, `.planning/`, and project-local GSD support be removed.

## Exact Preservation

- Snapshot: `.planning/intel/source-snapshot/PROJECTOR_SPEC/`
- Checksums: `.planning/intel/source-snapshot/SHA256SUMS`
- Files preserved: 44 authoritative Markdown files, `spec.manifest.json`, and three migration-support scripts
- Byte comparison at ingestion: 44/44 authoritative Markdown files identical
- Checksum verification at ingestion: passed
- `INDEX.md`: intentionally not copied because it is navigation without independent semantics
- `PROJECTOR_SPEC.md`: intentionally not copied or validated because it is an ignorable generated bundle

## Re-expression Coverage

| Domain | Source docs | Source headings | v1 requirements | Requirements shard | Independent audit |
|--------|-------------|-----------------|-----------------|--------------------|-------------------|
| Product and semantic kernel | 12 | 99 | 97 | `requirements-parts/01-product-kernel.md` | `requirements-audits/01-product-kernel.md` |
| Knowledge, evidence, architecture, and risk | 6 | 38 | 97 | `requirements-parts/02-knowledge.md` | `requirements-audits/02-knowledge.md` |
| Governance and projections | 5 | 44 | 161 | `requirements-parts/03-governance-projections.md` | `requirements-audits/03-governance-projections.md` |
| Reconciliation and change | 5 | 38 | 150 | `requirements-parts/04-reconcile-change.md` | `requirements-audits/04-reconcile-change.md` |
| Agents and evolution | 5 | 43 | 117 | `requirements-parts/05-agents-evolution.md` | `requirements-audits/05-agents-evolution.md` |
| Operation and validation | 4 | 29 | 363 | `requirements-parts/06-operation-validation.md` | `requirements-audits/06-operation-validation.md` |
| Delivery, acceptance, and self-hosting handoff | 7 | 85 | 334 | `requirements-parts/07-delivery-acceptance.md` | `requirements-audits/07-delivery-acceptance.md` |
| **Total** | **44** | **376** | **1,319** | **7 shards** | **7 audits** |

The detailed heading-to-ID map is embedded in `.planning/REQUIREMENTS.md` under `## Source Coverage`. The exact source corpus is also embedded in `.planning/intel/constraints.md` for staged conflict detection and retained in the checksummed snapshot above.

## Current Gate Status

- [x] Exact authoritative source set identified
- [x] Non-authoritative index and generated bundle excluded
- [x] Exact snapshot and checksums created
- [x] All 44 sources classified and synthesized without conflicts
- [x] All 376 source headings mapped
- [x] 1,319 unique numeric v1 requirement IDs generated
- [x] Seven independent fidelity audits completed
- [x] Requirements approved by the user
- [x] Every requirement mapped to exactly one roadmap phase
- [x] Roadmap approved and committed
- [ ] Detailed phase plans created and verified
- [ ] Projector implementation complete
- [ ] GSD-to-Projector semantic import and equivalence proof complete
- [ ] Projector self-governance proof complete
- [ ] Original specification and GSD bootstrap safely removable

---
*Last updated: 2026-08-07 after user requirements approval and exact roadmap-mapping validation*
