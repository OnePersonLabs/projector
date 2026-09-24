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
Projector SHALL provide discoverable skills for initialization, exploration, complete and incremental proposals, continuation, revision, implementation, verification, synchronization, finish, reviewed branch integration, audit and reconciliation. The agent SHALL author artifacts and operate tools. Planning SHALL stop for review by default, while explicit end-to-end authorization permits continuation.

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

### Requirement: Reviewed branch integration
Projector SHALL integrate one selected source commit into the branch checked out in the original working directory. Projector SHALL complete isolated merge construction, applicable checks and independent adversarial review before integration. Projector SHALL leave that target branch unchanged while a conflict, failed check, review finding, dirty target or moved target remains unresolved. An unresolved conflict SHALL produce a self-contained human decision brief. The brief SHALL explain the affected behavior, both branch intents, the available choices and their practical consequences.

#### Scenario: Reviewed integration succeeds
- **WHEN** the isolated merge has no unresolved conflict and checks and independent review support the result
- **THEN** Projector advances the unchanged clean target branch to the reviewed integration and removes temporary merge state

#### Scenario: Human decision is required
- **WHEN** the agent cannot resolve a merge conflict with sufficient evidence
- **THEN** Projector preserves the isolated merge, leaves the target branch unchanged and presents all currently known unresolved choices for human review
