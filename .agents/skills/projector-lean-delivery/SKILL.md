---
name: projector-lean-delivery
description: Implement and review Projector changes against observable behavior, including context reuse, invalidation, architectural predicates, and recovery. Use for Projector implementation or repair work.
---

# Projector delivery

Before choosing edit paths, follow the repository's `AGENTS.md` context and reconciliation procedure. Treat existing specifications, reports, status fields, and tests as claims to check against the user's intent and current code.

For substantial cross-package changes, retain one Sol-medium implementor and a separate Sol-medium reviewer across implementation and repair. Assign nonoverlapping file ownership. For small changes, work locally. Do not revive historical task numbering, DAGs, or task-report directories.

Before implementation, identify the smallest public workflow that exercises the requested behavior. Include applicable failure cases: stale knowledge, new query members, ambiguous identity, unsupported observation, invalid authority, failure before mutation, and recovery after interruption. Retain context and lifecycle identities in their actual Projector owners; do not create a second scratch result as a handoff ledger.

During implementation, reuse the canonical schemas, identity, relevance, state binding, lens, and lifecycle components. Add a regression when it demonstrates a material failure. Run affected tests and rebuild packages before testing consumers that import their `dist` outputs.

After a coherent change, run `pnpm build`, `pnpm verify`, applicable public acceptance commands, and `git diff --check`. Do not repeat the full gate after every small edit. Report unsupported platform capabilities; do not turn an unavailable safety mechanism into a success result.

Have the reviewer inspect the integrated diff and supported public paths once. Consolidate material findings into one repair batch, then request targeted closure. A blocker needs a concrete requirement, reproducible supported path, and material consequence. Do not prolong review for style or hypothetical internal misuse.

Before calling work complete, distinguish specified intent, implemented behavior, public integration, and demonstrated advantage. Passing self-authored tests proves only their exercised behavior. Comparative quality and economics require a strong ordinary-agent baseline, including a later change and stale-knowledge detection.
