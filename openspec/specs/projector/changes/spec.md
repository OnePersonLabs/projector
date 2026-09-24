# Projector managed changes

## Purpose

Keep requirements, decisions, implementation and executed evidence coherent through revision and completion.

## Requirements

### Requirement: Separate accepted proposed and actual views
Projector SHALL pin an accepted baseline and durable prospective target, allocate an isolated candidate, preserve editable tasks and actual implementation contributions, and expose scoped plan changes when the target changes. Checked tasks SHALL NOT override requirements or prove completion.

#### Scenario: Revision during partial implementation
- **WHEN** a target withdraws one reason from a file containing still-valid work
- **THEN** the plan reconsiders the previous and new footprints without reverting all changes in that file

### Requirement: Applicability and independent coverage
Every new or broadened requirement SHALL have executable concern/scope selectors or a justified scoped exclusion. Actual changed artifacts SHALL be inventoried independently of declared design bindings. Missing responsibility, unexplained changes, unknown populations and unresolved applicability SHALL block completion.

#### Scenario: Unplanned source file
- **WHEN** an implementation creates a file absent from its declared contributions
- **THEN** completion reports the unaccounted artifact even if all declared links are valid

### Requirement: Current evidence and contribution disposition
Each affected previous contribution SHALL receive retain, remove, replace or revise with a current reason. Retention requires surviving product, design or external obligations. Changed behavior SHALL have executed evidence bound to the input basis. Material changes SHALL have an independent review examining missing concerns, unsupported structure and a credible alternative.

#### Scenario: Stale successful check
- **WHEN** source or supporting target changes after verification
- **THEN** its previous successful evidence cannot authorize completion

### Requirement: Coherent recoverable finish
Projector SHALL use OpenSpec's supported merge and validation behavior, materialize the exact reviewed live target, archive only complete work, and publish only by an expected-old-ref update on the candidate branch. Repeat finish SHALL resume bookkeeping for an exact existing publication. Main integration requires separate authorization; missing prerequisites keep a candidate blocked. A published prerequisite record SHALL remain discoverable after archival.

#### Scenario: Crash after publication
- **WHEN** the candidate ref update succeeds and bookkeeping is interrupted
- **THEN** resume recognizes the exact publication and does not repeat semantic work

#### Scenario: Archived published prerequisite
- **WHEN** a candidate baseline contains a prerequisite publication and its state record is in the archive
- **THEN** plan validation recognizes the published prerequisite without restoring an active change

### Requirement: Clean evolution
Reconciliation SHALL account for previous and new footprints, changed artifacts and concrete dependent consumers. It SHALL reject obsolete parallel routes, unjustified compatibility layers, unused registrations/dependencies/configuration and unsupported retained abstractions within that closure. A settled second pass SHALL be a substantive no-op under the same dependency basis.

#### Scenario: Removing a strategy
- **WHEN** the requirement motivating a preview-specific strategy is removed
- **THEN** the strategy and its unnecessary integration are removed while shared capabilities with surviving requirements remain
