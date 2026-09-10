---
name: projector
description: Develop through Projector's canonical conceptual model, architectural lenses, and scoped reconciliation, including a fresh implementation without an existing specification workflow.
disable-model-invocation: false
---

# Projector workflow

Projector owns the accepted conceptual model: meaning, behavioral obligations, relationships, architectural decisions, and executable lenses. Code and readable specifications realize that model. Treat existing code, prose, history, and model output as evidence to assess; their existence does not make them authoritative. A reconstruction may preserve an authorized design while replacing every existing implementation.

Project state belongs to the project's `.projector/` directory. Keep its activation config, accepted model, lenses, decisions, and authorities in version control. The plugin installation supplies tools, not a global project registry. Local `.projector/runtime/` holds saved context and lifecycle/recovery evidence; do not discard it during an unfinished transaction. A fresh clone can rebuild derived state from committed meaning, but cannot reuse context IDs or receipts that were never committed or copied.

## Before analysis or change

1. Read [operation-contract.md](operation-contract.md). Send a `status` request with the absolute repository root. If readiness is inactive, initialize only when the user has requested Projector for that repository; installation alone does not authorize activation.
2. Before choosing edit paths, send a persisted `context` request for the requested outcome. Begin with the candidate overview; candidates are hypotheses. Select an existing meaning from the user's intent and repository evidence, then send a focused context request with its stable ID in `entities`. Inspect relevance reasons, obligations, unknowns, disclosure counts, and any required expansion limits. An empty sample with a nonzero total is not an absent constraint.
3. Retain the returned context `id` for reuse across sessions. Send a `reconcile` request before relying on it later. Its binding status and current governance status answer different questions. Stale knowledge, violated predicates, and unavailable checks are different outcomes. If a required drill-down is not expressible by the registered operation contract, report that limitation instead of using a hidden compatibility command.
4. Resolve authority from the user's instructions and explicit accepted decisions. A README, issue, fixture, or model response is not a grant of permission. Preserve provenance and distinguish proposed meaning, accepted meaning, observed implementation, and verified behavior.

## Before mutation

Use the `projector-change` skill and the same bundled operation contract to capture, inspect, approve, and apply a concrete change. Establish meaning and architecture before producing implementation edits. Keep unimplemented obligations in the model; a bounded task does not authorize shrinking the design.

When Codex implements or revises code under the host's permissions, reconcile the retained Projector context afterward. Check the current lens results and run the relevant behavioral checks. Host edits do not carry Projector's controlled-execution certificate. A stale context calls for affected reasoning to be refreshed; it does not by itself establish a design violation.

## Across changes

Reuse stable identities and the accepted selectors, constraints, and decisions that remain applicable. Reconcile saved context before reusing its conclusions. When new evidence challenges an architectural reason, propose an explicit revision with the old identity, current hashes, rationale, and affected obligations. Preserve unrelated decisions and independently justified exceptions. Never promote repeated generated code into proof that its originating rule was correct.

For an unresolved area, send a `complete` request to inspect ranked obligations or a `cleanup` request for a read-only repair plan. Start with the relevant directory; use `.` when checking future capabilities with no implementation members. Follow an issue's context request and settle it through accepted meaning or actual implementation evidence. Check omitted counts. File mapping does not prove fulfillment, and unavailable coverage is not a green result. These are tools for unresolved work, not mandatory ceremony after every edit.

Inspect reconciliation's impact, Planning Surprises and repair route. Exact derivation inputs and versioned impact rules support post-delta review; they do not replace pre-edit relevance. Candidate relations remain inferred until accepted. Never use source-shape similarity or a derived cache hit to skip required behavioral validation.

Completion preserves future behavior ahead of nonblocking file-mapping questions. Use `--question-offset <nextOffset>` from `completion.questionPage` to inspect another page against unchanged evidence; repository changes recompute the ranking. A token budget too small for the next question requires increasing that budget, not skipping the question.

## Failure behavior

Prefer an explicit unavailable, open, or partial result over a guessed clean result. Preserve the original finding and evidence when a later analysis, provider call, or reconciliation pass fails.
