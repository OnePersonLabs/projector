# Product-kernel requirements audit

## Scope

Audited `.planning/intel/requirements-parts/01-product-kernel.md` against `PROJECTOR_SPEC/SPEC.md`, every H1/H2/H3 in `PROJECTOR_SPEC/01-product/*.md`, and every H1/H2/H3 in `PROJECTOR_SPEC/02-semantic-kernel/*.md`.

## Result

- **130 unique requirement/lock/non-goal IDs**, each with exactly one `Source:` line.
- **97 v1 requirements**: 8 `CORE`, 33 `PROD`, and 56 `KERN`; every v1 item uses `- [ ] **ID...`.
- **33 locked/non-goal items** retain their non-v1 forms.
- **99/99 assigned H1/H2/H3 headings** are represented in Source Coverage.
- No duplicate or malformed IDs remain.

## Fixes applied

- Restored specification composition details: exact `spec.manifest.json` authority, canonical cross-module references, subsystem-over-root precedence, and contradiction handling.
- Restored zero-ceremony/value-before-declaration guarantees and the complete compounding causal-loop ordering, including authority, representations, derivations, divergence, promotion, and certification.
- Preserved deterministic-first routing, model uncertainty-frontier lanes, governed-sandbox/system acceptance, layered oracle definitions, representation authority boundaries, and exact encapsulation/non-goal force.
- Expanded identity and behavioral contracts with `IntentOriginRef`, scenario-step fields, representation/evidence examples, derived adjacency indexes, and behavior-vs-obligation rules.
- Restored canonical-state rebuild closure, canonical/derived classifications, locality and manifest semantics, stable-ID storage rules, and exact source hash distinctions.
- Corrected governance failure force from “exactly” to source “include” and restored recursive declaration fields, oracle definitions, scope boundaries, and WHAT/WHY–WHERE/WHAT-ELSE–HOW ordering.
- Expanded architecture decision, evaluation, validity, preference, and Governance Basis field/enum contracts.
- Expanded representation profile rules, surface/artifact/Projection Unit contracts, State Binding/query/negative-space contracts, validation/rollback evidence, and all core port fields.
- Split the reference architecture’s 16 required subsystems into independently testable `KERN-056` and expanded the locked package tree and revisable-default discipline.

## Remaining source ambiguities

- `SPEC.md` includes a date in its identity metadata; it is not an implementation obligation, so `CORE-LOCK-001` intentionally retains the normative identity/runtime fields but not the date.
- Source prose sometimes uses lowercase “may/should” in explanatory definitions while the product principles reserve uppercase RFC keywords for normative force. The fragment preserves explicit uppercase force and treats explanatory lists as context unless they carry a contract obligation.
- The reference technology table contains descriptive rationale/trigger prose. `KERN-053` requires materializing each rationale and trigger as Architecture Decision/Authority information; the table’s implementation-specific wording remains source-owned.
- Root reading routes point to modules outside this assigned product/kernel scope; those modules were not audited here and remain covered by their owning fragments.

## Validation

The audit used source heading enumeration, ID/duplicate checks, checkbox-shape checks, and Source-line cardinality checks. No runtime test was applicable because this change only updates requirements and audit documentation.
