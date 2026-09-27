## MODIFIED Requirements

### Requirement: External design ownership
Projector SHALL keep explanations in nested designs that refer to ordinary source. Source SHALL NOT require Projector annotations, IDs, imports, decorators, or runtime dependencies. OpenSpec live specifications own accepted requirements; active deltas remain prospective.

#### Scenario: Removing integration
- **WHEN** Projector tooling is removed
- **THEN** the ordinary application build and execution remain usable

### Requirement: Exact references
Projector SHALL preserve existing code, specification, and design reference identities. Bracket references SHALL use Unicode case-folding and removal of spaces and underscores only. A unique Markdown H1 owns a bare key before a globally unique logical top-level code declaration. Duplicate Markdown owners are errors; duplicate code names are legal but ambiguous. Qualified references SHALL obey public boundaries and configured policy. Non-code semantic units SHALL use domain-qualified artifact addresses and SHALL NOT enter bare code-symbol lookup. Logical declarations SHALL retain owner/signature identity where needed; incomplete inventories SHALL NOT prove uniqueness. Ownership changes SHALL require explicit rebinding.

#### Scenario: A new owner appears
- **WHEN** a Markdown definition owns a previously code-bound bare reference
- **THEN** Projector requires qualification or adoption

#### Scenario: Domain-separated styles
- **WHEN** a style entry has the same name as a code declaration
- **THEN** its artifact address remains distinct and cannot silently take bare code ownership

### Requirement: Exact design deltas
Projector SHALL apply complete addressed additions, replacements, removals, and renames with exact baseline preconditions; reject duplicate, ambiguous, overlapping, and stale operations; preserve untouched formatting; and accept retries only against exact receipts. Narrative sections SHALL coexist with structural Contract, Decision, Realization, and Subdesign parts without changing existing addresses.

#### Scenario: Overlapping replacements
- **WHEN** a batch replaces a part and its subheading
- **THEN** the batch is rejected without modification

#### Scenario: Narrative round trip
- **WHEN** a design includes context or risks sections
- **THEN** addressed operations preserve them unless explicitly changed

### Requirement: Explicit semantic limits
Projector SHALL report unsupported syntax, unresolved topology, missing terms, unsupported selectors, and unadapted dependency policy as explicit unknown or drift. Completeness SHALL be capability-specific. Empty memberships SHALL retain population dependencies. Initialization, packaging, ABI, and programming failures SHALL be actionable errors rather than opaque success.

#### Scenario: A previously empty scope gains implementation
- **WHEN** an acknowledged batch adds an artifact in an empty scope
- **THEN** later queries include it and completion requires disposition

## ADDED Requirements

### Requirement: Composed document providers
The asynchronous document service SHALL compose exactly one primary provider per input with zero or more additive supplements. Providers SHALL declare stable identity/version, inputs, domains, capabilities, and completeness. Primary conflicts SHALL be errors unless replacement is intentional; supplements SHALL NOT hide or overwrite primary facts. Built-in composition SHALL be order-independent and require no repository manifest or dynamic installation. Existing synchronous extraction SHALL retain its established behavior.

#### Scenario: Conflicting providers
- **WHEN** two primaries claim a file without intentional replacement
- **THEN** service construction reports the conflict

### Requirement: Useful language resolution
Built-in providers SHALL preserve JavaScript/TypeScript/JSX/TSX/Markdown behavior and provide declarations plus useful static repository resolution for C#, Rust, and Python. HTML, CSS, and SCSS SHALL expose domain-specific facts and static relationships. Indented Sass SHALL be recognized with explicitly unknown semantic support. Unsupported project evaluation, macro expansion, conditional configuration, namespace/package topology, and dynamic imports SHALL remain scoped unknowns.

#### Scenario: Repository language reference
- **WHEN** a static reference crosses a supported project/module boundary
- **THEN** the service resolves through project configuration or reports the exact unsupported boundary

### Requirement: Framework relationships
Built-in Tauri intelligence SHALL distinguish Rust commands and actual registration, frontend invokes through supported wrappers, static events, and configuration/resources/permissions. React Native intelligence SHALL expose static styles/composition, imports/usages, platform files, native/configuration/assets, and generated binding relationships. Dynamic relationships and unproven native wiring SHALL remain explicit limits.

#### Scenario: Native declaration without wiring
- **WHEN** a frontend declares a native operation without proven registration
- **THEN** Projector reports incomplete wiring rather than native runtime qualification

### Requirement: Universal artifact inventory
Every tracked artifact SHALL have raw-byte identity and ownership metadata, including binary and generated outputs. Untracked inventory SHALL respect Git ignores. Binary and large artifacts SHALL NOT be decoded as semantic text or rejected solely by text parsing budgets. Parsing and retained text SHALL remain bounded; unavailable semantics SHALL be explicit.

#### Scenario: Large binary asset
- **WHEN** a tracked binary bank exceeds the text parsing limit
- **THEN** file identity and ownership remain available without UTF-8 parsing
