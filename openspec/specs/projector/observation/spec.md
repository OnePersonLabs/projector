# Projector observation contracts

## Purpose

Distinguish precisely identified historical facts from qualified working observations.

## Requirements

### Requirement: Honest read modes
Projector SHALL offer exact revision reads and explicitly managed candidate reads. An ordinary editor worktree SHALL NOT become managed by assertion. Missing observation, interrupted writes, root replacement and unknown shell outputs SHALL return pending or unavailable with no purported current payload. Prior exact revisions remain independently queryable.

#### Scenario: Writer interruption
- **WHEN** a cooperating writer fails to complete an acknowledged batch
- **THEN** current reads remain pending or unavailable until its ownership and independent checkpoint are resolved

### Requirement: Coalesced publication
Projector SHALL coalesce undemanded writes, share required extraction between readers, validate generation before publication, and preserve newer dirtiness when older work completes. One hundred edits followed by thirty-two readers SHALL require only one extraction of the final demanded file. A matching warm read SHALL perform no source reads, source hashing, parsing, or model calls.

#### Scenario: A file changes during extraction
- **WHEN** a newer batch changes the input of an in-flight extraction
- **THEN** the obsolete result cannot clear the newer dirty state or become a current answer

### Requirement: Shared owner and bounded workers
Projector SHALL use one OS-owned authenticated user-local endpoint, independent root identities, at most two blocking-work lanes, fair bounded queues, bounded query/history/output/storage resources and explicit overload errors. Closing a relay SHALL NOT close the owner needed by another relay.

#### Scenario: Simultaneous clients
- **WHEN** two client relays start concurrently
- **THEN** only the exclusive endpoint owner initializes the kernel and both clients join it

### Requirement: Disposable cache recovery
Projector SHALL keep authored meaning, active previous targets and recovery identity outside its disposable SQLite index. Cache deletion or corruption SHALL rebuild derived facts without deleting authored state. Worker failure SHALL withhold publication and allow subsequent jobs to recover.

#### Scenario: Index corruption
- **WHEN** a candidate's derived database is corrupt after an interrupted batch
- **THEN** Projector retains the pending observation record and rebuilds after an explicit checkpoint
