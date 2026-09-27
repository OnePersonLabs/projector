# Projector managed changes

## Purpose

Keep requirements, decisions, implementation and executed evidence coherent through revision and completion.

## Requirements

### Requirement: Separate accepted proposed and actual views
Projector SHALL pin an accepted baseline and durable prospective target, implement in the selected checkout by default, and offer explicit isolated mode. Existing isolated sessions SHALL retain their work and identity. Checked tasks SHALL NOT override authority or prove completion. Revision SHALL preserve partial implementation, expose scoped plan changes, and reconcile divergent artifacts before overwriting or sealing them.

#### Scenario: Revision during partial implementation
- **WHEN** a target withdraws one reason from a shared file
- **THEN** the plan reconsiders previous and new footprints without reverting surviving work

### Requirement: Applicability and independent coverage
Every new or broadened requirement SHALL have executable selectors or justified scoped exclusions. Actual changed artifacts SHALL be inventoried independently of declared bindings. Missing responsibility, unexplained changes, unknown populations, and unresolved applicability SHALL block completion.

#### Scenario: Unplanned source file
- **WHEN** implementation creates an artifact absent from contributions
- **THEN** completion reports it even if declared links are valid

### Requirement: Current evidence and contribution disposition
Each affected previous contribution SHALL receive retain, remove, replace, or revise with a current reason. Retention SHALL require surviving support. Checks SHALL bind to versioned verification inputs and meaningful coverage, separately from plan/review identity. Task checkbox and result-bookkeeping changes SHALL NOT automatically invalidate application checks; substantive task changes SHALL require reconciliation. Failed and superseded evidence SHALL remain historical and ineligible for current completion. Material final changes SHALL receive independent review.

#### Scenario: Stale successful check
- **WHEN** source, tests, relevant configuration, or authority changes after verification
- **THEN** affected previous evidence cannot authorize completion

#### Scenario: Task bookkeeping
- **WHEN** only actual task completion markers or recorded results change
- **THEN** eligible application checks remain reusable and unfinished tasks still block completion

### Requirement: Coherent recoverable finish
Finish SHALL use supported OpenSpec merge/validation, assemble selected implementation and accepted authority together, create the commit through normal hooks, qualify the actual resulting commit, and integrate it into the selected branch by conditional publication. Unrelated staging and working changes SHALL survive. A durable journal SHALL recover interrupted branch/index/file installation without overwriting unexpected edits. Repeat finish SHALL recognize exact publication and complete only remaining bookkeeping. Published prerequisites SHALL remain discoverable after archive.

#### Scenario: Crash after publication
- **WHEN** branch advancement succeeds before checkout installation completes
- **THEN** resume recognizes the publication and safely continues journaled installation

#### Scenario: Archived published prerequisite
- **WHEN** the baseline contains an archived prerequisite publication
- **THEN** validation recognizes it without restoring an active change

#### Scenario: Hook changes inputs
- **WHEN** a hook changes the finalized implementation
- **THEN** changed inputs require refreshed checks and review before publication

### Requirement: Clean evolution
Reconciliation SHALL account for previous and new footprints, changed artifacts, and concrete consumers. It SHALL reject obsolete routes, unjustified compatibility layers, unused registrations/dependencies/configuration, and unsupported retained abstractions within that closure. All artifact domains SHALL participate. A settled second pass SHALL be a substantive no-op under the same basis.

#### Scenario: Removing a strategy
- **WHEN** the motivating requirement is withdrawn
- **THEN** unnecessary strategy and integration are removed while shared capabilities with surviving support remain

### Requirement: Generated contribution provenance
Relevant generated contributions SHALL identify producer, inputs/configuration, generation identity, and tracked/disposable status. Changed inputs SHALL require current regeneration evidence. A removed producer SHALL require tracked output removal or surviving rebinding. Missing relevant provenance SHALL remain an explicit obligation; disposable ignored output SHALL NOT establish authority.

#### Scenario: Retired generator
- **WHEN** the owning producer is removed
- **THEN** tracked generated output is removed or rebound to current support
