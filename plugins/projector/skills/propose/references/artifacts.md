# Authoring coherent Projector artifacts

Use the installed projector schema/templates as the artifact dependency source. Read repository instructions and relevant accepted specs/designs before drafting. New changes use a unique lowercase kebab-case directory and `.openspec.yaml` containing `schema: projector`, even if the repository default is a different schema.

## Proposal and requirements

Write `proposal.md` with Why, What Changes, Capabilities (New/Modified), and Impact. Explain user-visible outcomes, affected boundaries, and real constraints. Do not turn internal lifecycle steps into product requirements.

Write nested requirement deltas at `specs/CAPABILITY/spec.md`. Preserve existing capability paths and requirement names. For new capabilities include a Purpose of at least fifty characters. Use standard delta sections:

```markdown
## ADDED Requirements

### Requirement: Immediate replay
The player SHALL restart the requested preview exactly once.

#### Scenario: Replay request
- **WHEN** a user requests replay
- **THEN** the preview restarts exactly once
```

Use MODIFIED Requirements with the complete updated requirement and all surviving scenarios, not a partial sentence patch. REMOVED Requirements name the actual removed guarantee and include a reason and migration explanation where relevant. RENAMED Requirements use the bundled OpenSpec format from its instructions. Do not invent a requirement merely to make cleanup validate.

## Design deltas

Write `designs/CONCERN/design.md` separately from requirements. A design's ID follows the nested concern path. Deltas require `designDelta: 1`, target, and exact baseline. A brand-new design uses `baseline: absent` and a single Add: design operation containing a complete live document:

~~~~markdown
---
designDelta: 1
target: audio/preview
baseline: absent
---
# Preview design delta

## Add: design

```markdown
---
projectorDesign: 1
id: audio/preview
scope: src
---
# Preview playback

## Contract

Own preview replay while preserving caller ownership of stored events.

Applies: [[spec:audio/preview#Immediate replay]] | {"kind":"path","root":".","prefix":"src"} | Playback code handles replay.

## Decision: playback

Choice: Restart through the direct replay function once.
Reason: One user request must cause one restart.
Requires: [[spec:audio/preview#Immediate replay]]
Alternative: Add a replay scheduler.
Tradeoff: A direct call avoids scheduling state for an immediate action.
Realizes: [[code:src/player.js#replay]]
Evidence: Exercise repeated requests and assert one restart per request.
```
~~~~

For an existing design, hash exact UTF-8 Git baseline document bytes with SHA-256. Do not hash a normalized worktree copy or guess the digest. Use the prepared state's pinned baseline when revising, rather than the already-projected target. Deltas remain a full proposal against that accepted baseline.

Address parts explicitly: `## Replace: decision:playback` followed by a fenced complete `## Decision: playback` section; `## Add: decision:new-choice`; or `## Remove: decision:old-choice` with `Reason:`. Rename has both `To:` and `Reason:`. Whole removal is `## Remove: design`. Do not mix whole-document operations with part operations, or overlap parent/child addresses. A resulting live design must retain its Contract.

Use bracket references such as `[[spec:audio/preview#Immediate replay]]`, `[[design:audio/preview#decision:playback]]`, and `[[code:src/player.js#replay]]`. Realizes belongs to the decision owning the contribution and must name actual files/symbols. A file binding is appropriate for non-symbol artifacts; use specific bindings for symbol ownership when necessary to preserve justified code during revision. Binding a new implementation symbol is a planned obligation until it exists.

Declare executable Applies selectors in Contract as shown, or supply them through validatePlan. Capture consequential alternatives and tradeoffs explicitly; evidence prose describes intended verification but does not replace executed results.

## Tasks, adoption, and validation

Write one `tasks.md` with meaningful `- [ ]` implementation, reconciliation, and verification tasks. Each must have a checkable result. Keep dependency order and actual implementation scope visible. Check only performed work; keep missing evidence unchecked. Task edits propose scheduling or authority amendments and do not override requirements/designs.

When adopting an existing OpenSpec change, read its schema/status and actual artifacts. Preserve its proposal, requirements, decisions, and acceptance meaning; convert its relevant design.md into nested Projector deltas and select the projector schema for that change only. Do not replace repository-wide custom schemas or rewrite archives. If an external store owns the artifacts, resolve that ownership before creating any local counterpart.

Use bundled OpenSpec status/instructions for templates and strict validation for complete requirement changes. Inspect semantic consistency yourself: a structurally valid artifact can still contradict the implementation or another decision. Missing incremental layers remain absent; do not fill them with placeholders to obtain a green status.
