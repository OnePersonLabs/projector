## MODIFIED Requirements

### Requirement: Honest read modes
Projector SHALL offer exact revision reads and explicitly enrolled managed implementation checkouts, including ordinary selected checkouts. Enrollment SHALL require lifecycle identity and acknowledged writes; assertion alone SHALL NOT establish currentness. Missing observation, interrupted writes, root replacement, and unknown outputs SHALL yield pending/unavailable without current payload. Exact historical revisions remain queryable.

#### Scenario: Writer interruption
- **WHEN** an acknowledged batch is interrupted
- **THEN** current reads remain pending or unavailable until ownership and checkpoint recover

### Requirement: Coalesced publication
Projector SHALL coalesce undemanded writes, share extraction, validate generation before publication, and preserve newer dirtiness. One hundred edits followed by thirty-two readers SHALL require one extraction of the final demanded file. A matching warm read SHALL perform no source reads, hashing, parsing, or model calls.

#### Scenario: A file changes during extraction
- **WHEN** a newer batch changes an in-flight input
- **THEN** the obsolete result cannot clear dirtiness or publish current output

### Requirement: Shared owner and bounded workers
Projector SHALL use one OS-owned authenticated local endpoint, independent root identities, at most two blocking lanes, fair bounded queues, bounded queries/history/output/storage, and overload errors. Closing a relay SHALL NOT close the owner. Evidence execution SHALL permit its selected bounded deadline through client/owner transport while normal operations retain their budget; disconnected callers SHALL inspect recorded results before retrying.

#### Scenario: Simultaneous clients
- **WHEN** two relays start concurrently
- **THEN** one exclusive owner initializes and both join it

#### Scenario: Long evidence check
- **WHEN** an installed check runs longer than thirty seconds within its selected deadline
- **THEN** it completes with one recorded result without an owner/client thirty-second timeout

### Requirement: Disposable cache recovery
Authored meaning, target refs, and recovery identity SHALL remain outside disposable SQLite. Cache deletion or corruption SHALL rebuild derived facts without deleting authored state. Provider cache identities SHALL include extraction schema, provider/parser/grammar/query revisions, path/content, and relevant project configuration. Worker failure and parser cancellation SHALL withhold publication and permit recovery; syntax trees SHALL NOT be retained between jobs.

#### Scenario: Index corruption
- **WHEN** a derived database is corrupt after an interrupted batch
- **THEN** the observation record survives and an explicit checkpoint rebuilds

#### Scenario: Provider identity changes
- **WHEN** parser query or project configuration changes
- **THEN** derived extraction/resolution is invalidated before reuse
