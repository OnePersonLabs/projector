## MODIFIED Requirements

### Requirement: Agent owned conversational workflow
Projector SHALL provide discoverable skills for initialization, exploration, complete and incremental proposals, continuation, revision, implementation, verification, synchronization, finish, reviewed branch integration, audit and reconciliation. The agent SHALL author artifacts and operate tools. Planning SHALL stop for review by default, while explicit end-to-end authorization permits continuation.

#### Scenario: Natural language feature
- **WHEN** a person describes a feature
- **THEN** the agent drafts coherent nested requirements, designs and tasks and presents a concise review summary before implementing unless already authorized

## ADDED Requirements

### Requirement: Reviewed branch integration
Projector SHALL integrate one selected source commit into the branch checked out in the original working directory. Projector SHALL complete isolated merge construction, applicable checks and independent adversarial review before integration. Projector SHALL leave that target branch unchanged while a conflict, failed check, review finding, dirty target or moved target remains unresolved. An unresolved conflict SHALL produce a self-contained human decision brief. The brief SHALL explain the affected behavior, both branch intents, the available choices and their practical consequences.

#### Scenario: Reviewed integration succeeds
- **WHEN** the isolated merge has no unresolved conflict and checks and independent review support the result
- **THEN** Projector advances the unchanged clean target branch to the reviewed integration and removes temporary merge state

#### Scenario: Human decision is required
- **WHEN** the agent cannot resolve a merge conflict with sufficient evidence
- **THEN** Projector preserves the isolated merge, leaves the target branch unchanged and presents all currently known unresolved choices for human review
