# Projector document contracts

## Purpose

Keep ordinary source explainable through accepted requirements and nested concern designs without adding runtime coupling to applications.

## Requirements

### Requirement: External design ownership
Projector SHALL keep implementation explanations in nested human-readable designs that refer to ordinary source. Source SHALL NOT require Projector annotations, IDs, imports, decorators, or runtime dependencies. OpenSpec live specs own accepted requirements; active deltas remain prospective.

#### Scenario: Removing integration
- **WHEN** Projector tooling is removed from a supported application
- **THEN** the application's ordinary build and execution remain usable

### Requirement: Exact references
Projector SHALL resolve bracket references with Unicode case-folding and removal of spaces and underscores only. A unique Markdown H1 owns the bare key before a globally unique logical top-level code declaration. Duplicate Markdown owners are errors, duplicate code names are legal but ambiguous, and incomplete inventories cannot prove uniqueness. Qualified references obey public boundaries and configured policy. Changed ownership SHALL require explicit rebinding.

#### Scenario: A new owner appears
- **WHEN** a Markdown definition begins owning a previously code-bound bare reference
- **THEN** Projector reports the changed binding and requires qualification or explicit adoption

### Requirement: Exact design deltas
Projector SHALL apply addressed complete-part additions, replacements, removals and renames with baseline preconditions. It SHALL reject ambiguous, duplicate, overlapping and stale operations, preserve untouched formatting, and accept retries only against an exact matching receipt and result.

#### Scenario: Overlapping replacements
- **WHEN** a batch replaces a part and one of that part's subheadings
- **THEN** Projector rejects the batch without modifying the document

### Requirement: Explicit semantic limits
Projector SHALL report unsupported syntax, unresolved topology, missing terms, unsupported selectors and unadapted detected dependency policy as unknown or drift. Empty memberships SHALL retain their population dependencies.

#### Scenario: A previously empty scope gains implementation
- **WHEN** a managed batch adds a source artifact in that scope
- **THEN** a later query includes the new member and completion requires its disposition
