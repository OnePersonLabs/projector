# projector/workflow Specification

## Purpose
Enable agents to turn conversational requests into coherent reviewed plans and verified local implementation without manual artifact authoring.

## Requirements

### Requirement: Installed repository setup
The installed plugin SHALL initialize a local Git repository's OpenSpec directories and bundled Projector schema idempotently, preserving existing configuration and artifacts and reporting incompatible files before overwriting them. Setup SHALL not require a globally installed OpenSpec CLI.

#### Scenario: Existing project
- **WHEN** initialization encounters existing requirements and configuration
- **THEN** they remain intact and missing Projector scaffolding is added safely

### Requirement: Agent owned conversational workflow
Projector SHALL provide discoverable skills for initialization, exploration, complete and incremental proposals, continuation, revision, implementation, verification, synchronization, finish, audit and reconciliation. The agent SHALL author artifacts and operate tools. Planning SHALL stop for review by default, while explicit end-to-end authorization permits continuation.

#### Scenario: Natural language feature
- **WHEN** a person describes a feature
- **THEN** the agent drafts coherent nested requirements, designs and tasks and presents a concise review summary before implementing unless already authorized

### Requirement: Safe workflow continuity
Projector SHALL preserve unrelated edits during reconciliation, distinguish observed behavior from approved intent, and require current checks and independent review for completion. Bulk finish SHALL use explicit selections, detect overlaps and prerequisites, and report each outcome. Candidate synchronization SHALL materialize the exact target without archive or branch publication and remain compatible with revision, evidence invalidation and finish.

#### Scenario: Synchronize then revise
- **WHEN** a candidate target is synchronized and later revised
- **THEN** implementation remains available, outdated evidence cannot authorize completion, and finish materializes the revised target exactly

### Requirement: Usable installed entry points
The README SHALL explain user benefit, installation and skill invocation concisely, with internals in deeper documentation. The installed plugin SHALL operate independently of the development checkout and expose the documented skills and MCP operations.

#### Scenario: First use
- **WHEN** a user follows the README in a fresh session
- **THEN** they can initialize and request a change without manually writing artifacts or running runtime commands
