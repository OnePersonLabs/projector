# Operation and Validation Requirements Audit

## Scope

Audited `.planning/intel/requirements-parts/06-operation-validation.md` against:

- `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md`
- `PROJECTOR_SPEC/10-operation/observability-and-reporting.md`
- `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md`
- `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md`

The review covered CLI commands and flags, exit codes, operating modes, security/path/command/authorization controls, observability metrics, report fields, unit/property/adversarial/host/live tests, fixtures, benchmark metrics and thresholds, kill criteria, non-goals, and H1/H2/H3 source mappings.

## Coverage result

| Area | Requirements | Source clauses covered |
|---|---:|---:|
| CLI and execution policy | 56 | 56/56 |
| Operating modes | 12 | 12/12 |
| Security, paths, commands, authorization | 29 | 29/29 |
| Observability and economics | 45 | 45/45 |
| Reporting | 20 | 20/20 |
| Unit and property tests | 63 | 63/63 |
| Fixtures, adversarial, host, live evaluation | 65 | 65/65 |
| Benchmarks and release gates | 50 | 50/50 |
| Kill/redesign criteria | 23 | 23/23 |
| **Total** | **363** | **363/363** |

No normative source clause is omitted. The source set contains four H1 headings and 25 H2 headings; all 29 are mapped. There are no H3 headings in the audited sources.

**Findings fixed:** 6 total (5 high-confidence contract-wording findings; 1 high-confidence source-mapping finding).

## Findings fixed

1. **P1 / high confidence — benchmark zero/no gates were weakly phrased.** `BENCH-042`, `BENCH-043`, and `BENCH-047` used “MUST allow zero,” which permits non-zero outcomes, and `BENCH-045`/`BENCH-046` used “MUST permit no,” which is unnecessarily ambiguous. They now require the observable result to **have/produce zero or no** outcomes, preserving the source thresholds and conditions.
2. **P2 / high confidence — incomplete/malformed source-coverage range.** The H1 mapping for `testing-and-adversarial-evaluation.md` referenced nonexistent `EVAL-001` and omitted fixture IDs `EVAL-048`–`EVAL-066`. It now references the complete `EVAL-002`–`EVAL-066` range; all referenced IDs resolve without renumbering existing requirements.

## Validation performed

- Parsed all requirement markers: 363 IDs, 363 unique; no duplicate or malformed requirement IDs.
- Verified every requirement’s source path exists and its cited H1/H2 heading is present.
- Checked source-coverage ranges and locked/non-goal references for orphan IDs; none remain.
- Reconciled exact command/flag lists, exit-code meanings, mode stop conditions, security exceptions, path/command constraints, metrics, report obligations, test/property lists, fixture names, benchmark thresholds/conditions, and kill criteria against the source text.
- Confirmed the held-out, open/sampled/unavailable, state-binding, representation-fidelity, crash-recovery, and compact-context conditions remain explicit.

## Residual risk

This is a document/static audit; no runtime CLI, filesystem, host-process, benchmark, or live-provider execution was available or required. Implementations still need runtime verification against these contracts, especially path/symlink enforcement, state-bound authorization, transaction recovery, and the zero/100% engineering gates.
