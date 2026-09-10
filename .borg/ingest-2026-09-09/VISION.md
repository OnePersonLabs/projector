# Preserve intent through observable, recoverable change

Proposed design, revised 2026-09-10. This package prepares Projector for the Psychord remake; it does not implement Projector changes or begin that remake. The [wrap-up plan](../../.temp/projector-wrap-up-plan-2026-09-09.md) controls execution direction, including interface simplification, safe upgrades, canonical ingestion and specification retirement.

## Recommended outcome

Make Projector's existing conceptual control plane connect accepted meaning, a concrete reviewed change, observed behavior and the next change. Deliver it as skills/hooks plus one bundled JavaScript runner calling the existing TypeScript services. Retire MCP, standalone CLI delivery and the mandatory Windows-to-WSL bridge/sandbox as their consumers move. Execute through the host's configured permissions while preserving source/currentness checks, legitimate approval, pinned validators, bounded execution and journaled recovery.

Four bounded improvements recover the useful mechanisms from all 11 donors:

1. [P1 Application evidence](proposals/P1-application-evidence.md): observe the real Psychord Omega keyboard/save/reload/replay scenario and bind the result to the tested build and accepted obligation.
2. [P2 Preparation and continuation](proposals/P2-contributions-and-continuation.md): let the host divide useful work, let one coordinator assemble the final exact proposal, and recover current meaning and lifecycle state through existing saved contexts and representations.
3. [P3 Scoped correction](proposals/P3-correction-and-governance.md): exercise the host's investigate/propose/fix/reconcile loop against an actual discrepancy. Use existing observations and authority products.
4. [P4 Later-change survival](proposals/P4-longitudinal-evaluation.md): test currentness and preservation under subsequent changes, and record lightweight actual costs through existing tests/reports. Broad controlled comparisons remain optional future research.

These improvements serve one product. They require neither a new contribution protocol nor an agent scheduler, failure-classifier service or benchmark platform.

## Concrete user experience

The first application target is `C:/dev/projects/psychord-omega` at `e3ed1c8ff30f4fb2b997b187dd4fe03d6af91c5f`. Its accepted concepts describe player-owned local moments, truthful replay provenance and explicit saving. There is no accepted scenario record for this pilot yet. Before implementation, derive and accept the narrow scenario from those concepts through the application's canonical lifecycle.

A player presses keyboard C4, releases it, chooses **Keep this moment**, reloads, opens **Saved moments**, enables sound through the real gesture and chooses **Listen**. The saved trace retains the player's attribution; replay never becomes new player history. The application reports persistence failure honestly. This is a real production UI route, not the older Psychord Dev Workbench triad experiment. [Pilot details](APPLICATION-PILOT.md) distinguish the existing controller tests from the browser evidence still needed.

The host runner builds a known snapshot, owns a loopback static server on an allocated port and launches a pinned Playwright controller in a separate process. Fresh browser state separates runs; a nonce, endpoint and served-byte hashes identify the snapshot actually loaded. DOM, storage and trace observations support the bounded claim. Evidence and cleanup records live outside the application's served tree.

This setup assumes a trusted workspace and host. Separate processes and browser contexts prevent ordinary test contamination; they do not protect against a malicious same-user application or host, or establish network/OS confinement. Unsupported host capabilities remain unavailable. Acoustic output, physical MIDI, latency and learning remain unproved.

During development, optional host agents can inspect different concerns. Their notes are advisory. One coordinator resolves shared meaning and overlapping edits and prepares one exact proposal for the existing context/binding/approval/apply/recovery route. A fresh session reconciles the saved context and reads actual transaction state before continuing. A worker's success note cannot approve a change or erase an unresolved obligation.

When the pilot fails, the host uses concrete evidence to distinguish implementation failure from a wrong oracle, stale build or setup problem, makes the scoped correction, and reruns the affected observation. A new architectural rule is justified only by a real reusable need, recurrence or specific safety invariant. A later change then tests whether the result and its reasoning remain valid. Useful delivery does not depend on proving universal superiority.

## Architecture coverage

| Responsibility | Selected direction | Evidence boundary |
|---|---|---|
| Product and meaning | Preserve concepts, requirements, scenarios, relations and future commitments in typed canonical records | A source inventory, mapped file or pass flag is not conceptual fulfillment |
| Architecture and lenses | Retain reasons, alternatives, authority and scoped executable predicates; revise superseded execution assumptions explicitly | Existing code frequency and generated conformity cannot promote policy |
| Representation and knowledge | Reuse saved context, scoped invalidation, bounded human/agent views and exact execution associations where needed | Integrity, freshness, fidelity, authorization and delivery are separate facts |
| Core and engine | Reuse typed contracts, bindings, evidence and completion rules; add only fields needed by the concrete consumer | No browser/process/vendor logic in pure semantic code |
| Control plane | Compose context, canonical change, observation, completion and recovery through existing services | One accepted mutation lifecycle; host notes remain advisory |
| Runtime and integrations | Host-owned snapshot/server/controller resources, pinned collection and bounded cleanup | Honest host permissions; no new sandbox project or hidden network-denial claim |
| Plugin and delivery | One bundled JavaScript operation runner, real readiness/hooks and installed workflow verification | No wrapper-to-CLI chain, obsolete MCP catalog or checkout-only dependency |
| Persistence and upgrades | Preserve canonical records and journal/receipt evidence; use the wrap-up plan's verified backup/staging/migration route | Operational evidence is not reconstructible from a clone; indexes may be |
| Collaboration | Host-native preparation and coordinator-owned final proposal | No speculative approval, automatic semantic merge or mandatory agent roster |
| Validation and cost | Actual scenario controls, fresh-session reuse, later-change regressions, observed effort and time | Proxy scores and absent price data cannot establish economics |
| Specification transition | Account for useful historical commitments, move live acceptance consumers, then retire `PROJECTOR_SPEC` | Typed contracts generate schemas; historical Markdown is transitional evidence |

## Completion direction

Use the [integrated order](IMPLEMENTATION-ORDER.md) within the controlling wrap-up plan. Apply each proposal's corresponding canonical/spec/status deltas at the end of its owning implemented and verified change, in the same completion batch. A preparatory canonical-only scenario acceptance is its own verified batch before application implementation. Rebase exact patches as earlier changes touch the same sections.

The product endpoint includes installed native Windows and direct WSL operation, safe readiness/upgrades, the real application pilot, durable conceptual views, specification-absent self-development and a final remake handoff. That handoff recovers the Psychord vision and rejected choices, exposes future commitments and identifies the next bounded remake work; it does not authorize or require an unbounded remake within this plan.

Retain the donors' useful dependency maps, independent evidence, restart orientation and perturbation tests. Reject graphs-versus-loops rhetoric, compulsory recursive reviewers, mutable feature ledgers, universal reset/maximum-detail rules, geometric-model claims and unsupported efficiency figures. Full dispositions remain in [EVIDENCE.md](EVIDENCE.md).
