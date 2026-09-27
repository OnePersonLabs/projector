# projector/workflow Specification

## Purpose
Enable agents to turn conversational requests into coherent reviewed plans and verified local implementation without manual artifact authoring.

## Requirements

### Requirement: Installed repository setup
The installed plugin SHALL initialize a local Git repository's OpenSpec directories and bundled Projector schema idempotently, preserving configuration and artifacts. Setup SHALL upgrade exact recognized previous bundled files, preserve customized files, and report conflicts before replacing any schema. Setup SHALL not require a global OpenSpec CLI.

#### Scenario: Existing project
- **WHEN** initialization encounters existing requirements and configuration
- **THEN** they remain intact and missing scaffolding is added safely

#### Scenario: Stock upgrade and customization
- **WHEN** previous stock files coexist with a customized template
- **THEN** setup reports the custom conflict without partially upgrading stock files

### Requirement: Agent owned conversational workflow
Projector SHALL provide discoverable skills for setup, exploration, proposals, continuation, revision, implementation, verification, synchronization, finish, integration, audit, and reconciliation. The agent SHALL author artifacts and operate tools. Planning SHALL stop for review by default, while explicit end-to-end authorization permits continuation.

#### Scenario: Natural language feature
- **WHEN** a person describes a feature
- **THEN** the agent drafts coherent artifacts and presents a review summary unless implementation is already authorized

### Requirement: Safe workflow continuity
Projector SHALL preserve unrelated edits, distinguish observed behavior from approved intent, and require eligible checks and independent review for completion. Bulk finish SHALL use explicit selections, detect overlaps and prerequisites, and report each outcome. Synchronization SHALL materialize the exact target without archive or publication and preserve compatibility with revision and finish.

#### Scenario: Synchronize then revise
- **WHEN** a synchronized target is revised
- **THEN** partial implementation survives and outdated assurance cannot authorize completion

### Requirement: Usable installed entry points
The README SHALL explain benefit, installation, and invocation concisely, with internals in deeper documentation. The installed plugin SHALL operate independently of the development checkout and expose documented skills and operations.

#### Scenario: First use
- **WHEN** a user follows the README in a fresh session
- **THEN** they can initialize and request a change without manually writing artifacts or runtime commands

### Requirement: Reviewed branch integration
Projector SHALL integrate a pinned selected source into the intended target through isolated construction, applicable checks, normal hooks, independent review, and recoverable selected-change publication. Unrelated staged and working edits SHALL survive, including disjoint changes in one file. Actual overlaps, target drift, failed checks, and unresolved review SHALL leave publication incomplete. Unresolved semantic conflicts SHALL produce a self-contained decision brief.

#### Scenario: Reviewed integration succeeds
- **WHEN** the isolated integration is checked and independently reviewed and the target remains compatible
- **THEN** the selected branch receives the exact reviewed result and temporary integration is removed

#### Scenario: Human decision is required
- **WHEN** evidence cannot establish one conflict resolution
- **THEN** Projector preserves isolated work and explains the branch intents, viable choices, and consequences

### Requirement: Artifact responsibilities
Proposals SHALL explain intended outcomes and scope; specifications SHALL state observable requirements; designs SHALL explain decisions and ownership; tasks SHALL describe concrete change-specific work. Shared workflow procedure SHALL live in skills. Legitimate changes without requirement deltas SHALL preserve existing authority without inventing specifications.

#### Scenario: Change-specific tasks
- **WHEN** the agent authors a refactor plan
- **THEN** tasks name concrete work and verification outcomes rather than a universal workflow rubric

### Requirement: Impact-aware verification
Verification SHALL distinguish test-change planning from execution selection, derive fresh behavioral obligations before inspecting existing assertions, preserve surviving test protection, and record intended failures before behavioral slices. Explicit pure-refactor, already-correct, and nonbehavioral cases SHALL identify why no new red is appropriate. Checks SHALL run at coherent checkpoints, reassess complete baseline impact, broaden unreliable selections, preserve required full/release checks, and reuse matching evidence without automatic per-edit repetition.

#### Scenario: New impact appears
- **WHEN** implementation reveals another consumer or shared setup change
- **THEN** the agent revises test obligations and execution selection before claiming completion

#### Scenario: Existing edits
- **WHEN** work predates the test-change plan
- **THEN** the agent reports the historical limitation without claiming retrospective test-first evidence
