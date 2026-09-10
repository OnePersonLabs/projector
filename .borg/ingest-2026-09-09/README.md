# Projector assimilation design

**Recommendation:** close Projector's existing conceptual loop with real application evidence, state-bound contributions and continuation, scoped correction, and later-change evaluation. Keep one canonical authority model and one accepted mutation lifecycle.

This is the complete investigation/design package for all 11 files in `.temp/ingest-2026-09-09-01`. The files were fingerprinted and fully inspected; important claims were checked against primary sources and actual Projector public paths. No product code, accepted model, historical spec or donor file was changed.

## Read the proposed outcome

1. [Integrated vision](VISION.md): what Projector becomes, realistic examples, every architectural level, exclusions and delivery order.
2. [Shared design](DESIGN.md): ownership, trust, contracts, alternatives, state, recovery, migration and risks.
3. [Selected real application pilot](APPLICATION-PILOT.md): Psychord's existing C-major triad Recognition path and concrete isolated collection design.
4. [Evidence and donor dispositions](EVIDENCE.md): what was retained, already present, rejected or deferred, and why.

## Review individual changes

Each proposal contains the what/why, user stories, exact spec-delta references, design and a numbered implementation task table with completion evidence.

| Proposal | Outcome |
|---|---|
| [P1 Application evidence](proposals/P1-application-evidence.md) | Acceptance can cite the actual affected application behavior and its limits |
| [P2 Contributions and continuation](proposals/P2-contributions-and-continuation.md) | Agents and fresh sessions can reuse checked work and join exact edits without speculative approval |
| [P3 Correction and governance](proposals/P3-correction-and-governance.md) | Failures reach the right code, oracle, tool, context or architectural owner |
| [P4 Longitudinal evaluation](proposals/P4-longitudinal-evaluation.md) | Later changes test preservation and total cost rather than merely today's passing tests |

The proposals are slices of one design. They are not one change request per source file.

## Inspect exact proposed changes

- [Combined PROJECTOR_SPEC patch](spec-deltas/PROJECTOR_SPEC.patch), with [individual patches and machine-readable manifest](spec-deltas/).
- [Canonical meaning/architecture deltas](CANONICAL-DELTAS.md), preserving existing identities and provenance. Historical prose is not current acceptance authority.
- [Integrated implementation order](IMPLEMENTATION-ORDER.md), connecting the concrete tasks across all four proposals.
- [Spec applicability and copied-tree verification](receipts/spec-verification.md).
- [Independent review and closure](research/W6-review.md).
- [Final verification receipt](receipts/final-verification.md).

The patch is unapplied. Canonical changes are proposed text, not active JSON envelopes. The Docker/application profile and comparative experiments are selected implementation work, not completed or economically proven capabilities.

## Evidence archive

[W1 empirical papers](research/W1-empirical.md), [W2 workflows/domain agents](research/W2-workflows.md), [W3 source integrity/critical claims](research/W3-critical.md), [W4 recipient architecture](research/W4-recipient.md), [source fingerprints](source-inventory.json), [coverage index](coverage.json), [pilot fingerprints](pilot-source-inventory.json).

Campaign state and recovery instructions: [STATE.md](STATE.md). The campaign artifacts are design evidence; they are not a new Projector runtime workflow store.
