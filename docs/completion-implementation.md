# Completion implementation

This contributor record tracks implementation and qualification. It does not
replace accepted meaning under `.projector/`. The baseline is commit
`8b92ce4ca507eee7c0dd3cc31ff3a361c94170c3`.

## Shared contracts

Accepted meaning keeps its existing identities, typed relationships, lineage,
authority and representation guarantees. Implementation targets and observations
are evidence about that meaning. They do not author or approve it.

Git owns authored code, accepted meaning, versions and normal transport. The
user's existing checkout is the default execution location. Independent clones
and optional worktrees are physical locations, not portable evidence owners.
No managed candidate session, custom worktree or begin/export/import/finish
publication sequence is required. Git integration records the common base,
target, incoming contribution and actual result by immutable object identity.
It exposes preserved, altered and lost authored records and code contributions.
Execution events are independently retained observations. Neither kind of
evidence grants mutation approval.

Repository identity, checkout identity, branch state, execution identity and
input identity have different purposes. A repository can have several independent
checkouts. Runtime state and recovery belong to the checkout that created them.
Portable evidence identifies complete relevant inputs, actual producer,
environment and evaluation contract; source checkout liveness is not required.
A moved path does
not grant a different checkout the original mutation authority.

An observation is usable only when its declared population is complete and its
source bytes, canonical inputs, exclusions, analyzer versions and effective
configuration are known. An incremental observer must establish a complete delta
from a valid baseline. A lost cursor, interrupted enrollment, incompatible scope
or unknown event history requires explicit rediscovery. File timestamps, a clean
Git status and absence of watcher events cannot independently prove currentness.
Incomplete work must not replace the last complete baseline.

A reusable check binds its command, executed producer, source and test inputs,
configuration, environment and relevant query populations. An empty population
is still a dependency. A changed target commit alone does not invalidate a check
whose complete relevant inputs match. Unknown inputs prevent a current-success
claim. Failed and interrupted executions remain evidence, never current passes.

Assess the actual integration tree/ref from the common base, each branch delta
and the final result. Validate final-model consistency and retained, altered or
lost contributions. A valid model can still lose an intended contribution. Assessment must not change refs, the index, or working files. `git merge-tree --write-tree` may create ordinary immutable Git tree/blob objects; no alternate object directory or custom worktree is required. An explicitly supplied hosting-provider result is also a supported assessment input.
Recompute obligations, query populations and newly relevant consumers.
Local operation approval and integration review bind the entire result and its actual
target. Target movement requires review of the new combination. It can reuse
matching constituent checks. It cannot carry stale mutation approval across a
rebase, merge, squash, source change or checkout change. Ordinary Git and hosted
PR integration remain supported routes; disposable indexes are not branch
authority or required merge artifacts.

Trust, currentness and cache eligibility are separate assessments. Preserve all
execution events, including failures, interruptions and contradictory outcomes.
Do not infer distributed supersession from independent wall-clock timestamps.
Existing local timestamp ordering is not distributed qualification. Use existing
CI artifacts and build caches for routine records. Durable claims need defined
retention of their facts and required artifacts; caches remain disposable.
Approvals, locks, leases and journals remain local to their owning operation.

Persist incremental updates in the existing derivation graph and registered
query/dependency contracts. Keep mutable state per checkout; an optional shared
immutable cache can serve matching inputs. Establish complete Git and dirty
deltas or perform an explicit bounded rebuild. Include all discovery, canonical
loading, Git facts, hashing, worker transfer and downstream work in locality
qualification. Preserve cancellation, unknowns and the last complete baseline.

Generated output evidence binds the producer that actually ran, its inputs and
its outputs. Declaring a producer next to an unrelated successful command is
insufficient. Source-byte identity, semantic preservation, consumer delivery and
behavioral effectiveness are separate claims.

Recovery inspects actual lifecycle state before acting. It completes publication
of already committed evidence without executing the committed mutation again.
It preserves unrelated files, other checkouts and later authorized edits.

## Verification approach

Derive affected behavior and failure cases before inspecting test assertions.
Maintain separate test-change and execution selections. Reuse adequate tests and
matching evidence. Record intended failures before behavioral fixes; do not
manufacture retrospective failures for already completed work.

The integrated local gate is `pnpm verify`; installed changes also require
`pnpm release:check`. The current delivery instruction replaces hosted PR/CI
qualification with an impact-aware local pre-push hook and a disposable local
Git integration exercise. The hook must be installed and qualified before that
exercise pushes. The full verification and release checks remain required.
This assignment does not publish the working repository to an external remote.

Qualification must cover ordinary edits, unrelated additions, a distant new
consumer, a shared dependency, loss of observation freshness, and independent
branches from one baseline in both integration orders. The local integration
exercise makes and pushes change 1, starts change 2 at the preceding commit,
commits change 2, pulls, resolves the result, and pushes through the hook. Use a
disposable local bare remote and checkouts. Include compatible and conflicting
changes. Local evidence establishes neither hosting-provider behavior nor
execution on another operating system.

Measure the complete path, including discovery, reads, hashing, analysis,
retrieval, verification and integration. Hold relevant impact fixed while adding
unrelated content. Parser counts alone do not establish locality. Fourfold token
overhead, routine five-minute edit feedback and approximately linear warm local
change cost are rejection cases. Actual token economics require actual token
measurements and a matched ordinary-agent baseline.

## Capability register

Each entry remains required until its public behavior and appropriate evidence
support closure. Existing passing checks are evidence only for unchanged inputs.

| ID | Required outcome | Current implementation status |
| --- | --- | --- |
| C01 | One readable typed semantic authority | Preserved. Installed acceptance, inspection and Markdown round trip passed; no competing authority added. |
| C02 | Stable identity and explicit continuity | Qualified for move, split, merge and delete through actual lifecycle capture/approve/apply, then fresh-clone retrieval after source deletion. Installed source rename also retains identity. |
| C03 | Semantic, discovery, exact-source and population validity | Partly closed. Native execution records bind exact files, executable, environment and declared populations, including empty directories. Root-file populations are supported; recursive populations that include the operation's own runtime evidence are refused before launch. Caller declarations do not establish dependency completeness. Full semantic consumer and incremental-observation qualification remains required. |
| C04 | Executable governance and decision reconsideration | Partly closed. Changed or deleted canonical evidence reaches stale-evidence consumers. Text changes cannot establish factual assumption falsification; that observation remains unknown. |
| C05 | Concern-scoped research and preference reasoning | Partly closed. Public evaluation authenticates canonical concerns/preferences and exposes missing/stale research. Submitted provenance does not independently establish external truth. |
| C06 | Faithful representations reach consumers | Qualified for a bounded initial implementation and later revision. Independent agents consumed actual public context rendering and passed the same behavioral probes as ordinary-source agents. This is not broad behavioral-effectiveness evidence. |
| C07 | Representation persistence and interruption recovery | Partly closed. Production publication uses durable staging and explicit inspection/recovery. Missing lifecycle capture remains recovery-required, with exact content retained. Interruption tests cover connected writers. |
| C08 | Claim-bound application evidence | Partly closed. Configured HTTP host validates exact requests, hashes, host build and bounded responses. Real local server tests cover current, stale, missing, violated and interrupted results. A target application's independent evidence remains required. |
| C09 | Provenance-preserving synthesis and deliberate acceptance | Qualified with three conflicting sources, a rejected proposal, deliberate acceptance, and a fourth-source revision of the same requirement identity. Retained source fingerprints and independent consumer behavior were checked. |
| C10 | Useful implementation ownership with honest coverage | JavaScript and TypeScript syntax now uses the installed TypeScript compiler API, including JSX and static re-exports. Syntax failures remain unknown. Existing mixed-artifact analyzers remain; unsupported framework and dynamic behavior is not inferred. |
| C11 | Coherent implementation and revision | Partly implemented. Ordinary Git deltas and result assessment account for preserved, altered and lost authored/code contributions. Focused independent-clone, rebase, squash and linked-worktree checks pass. Installed contribution and source-independent history checks pass. Full revision and behavioral reconciliation remain required. |
| C12 | Executed evidence and review bound to supported results | Implemented for host-trusted, fixed canonical-integrity verification with complete named inputs, actual producer/environment identity, immutable retention and publication recovery. Arbitrary native commands remain reusable:false. Contradictions remain visible, timestamps do not establish distributed supersession, and no approval transfers. |
| C13 | Defensible generated-output provenance | Partly closed. The declared source entrypoint is invoked directly through the bound runtime; inputs, pre/post outputs, ownership and failures are recorded. The existing worktree writer lease coordinates declared repository writes with lifecycle mutations, and a durable prelaunch intent binds the actual input/output observation. Unchanged bytes are distinguished from changed bytes. Recovery-time output observations cannot establish current success. Exclusive causation and execution confinement are not established. |
| C14 | Recoverable publication of code and meaning | Existing transaction, representation, execution and generation recovery is preserved. Hook tests cover a real unmerged index, source/checker pruning, blocked publication, confirmed cleanup and retained uncertain cleanup. Those tests do not by themselves prove recovery from every operating-system interruption. |
| C15 | Installed public workflows and bounded costs | The final fresh offline installation passed all 26 workflow checks. Four actual agent runs supply initial/later child token measurements. Complete-workflow economics, including intake and orchestration, remain unqualified. |
| C16 | Human discovery and comprehension without semantic loss | Partly closed. Renderer connects whole meaning to typed relevance, uncertainty and continuation. Independent agent navigation answered 5/5 tasks; human comprehension remains unqualified. |
| C17 | Change cost follows relevant impact | Implemented for complete scoped source deltas with an external SQLite index, addressed graph/query reads and Merkle population updates. Fresh public CLI measurements include filesystem reads, main/worker SQL rows and bytes. Explicit rebuilds remain for unsupported structural, history and global-analysis changes; unrestricted locality is not established. |
| C18 | Existing checkout and ordinary independent PR integration | Ordinary immutable Git assessment covers independent clones, source deletion, both merge orders, rebase, squash, linked worktrees, conflicts and contribution accounting. Actual result reconciliation finds static newly relevant consumers and obligations. Static observations do not qualify arbitrary behavioral reuse. Local push/pull/conflict/resolve/push replaces the earlier hosted PR/CI requirement. |
| C19 | Impact-aware verification with maintained protection | Installed in this checkout and qualified through two real local pushes using `$projector-verify`. A known nonempty docs-only delta selects build/spec checks; other or unknown populations select build/verify/release checks. Windows installation automatically applies repository-local `core.longpaths=true`. Final combined gates are recorded below. |

## Comprehension adaptations

| ID | Implementation direction | Required preservation |
| --- | --- | --- |
| K01 | Purpose and named reading routes | Navigation does not own accepted facts. |
| K02 | Linked neighborhoods in the existing human view | Show scope, authority, reasons, implementation, evidence and unknowns from one observation. |
| K03 | Explain why each record is relevant | Preserve typed direction, multiple reasons and source identity. |
| K04 | Question-led context and inspection | Reuse existing retrieval and currentness services. |
| K05 | Explicit bounds and targeted continuation | Keep whole normative sections and disclose omitted populations. |
| K06 | Readable governed lenses | Retain provenance, exact inputs and recoverable mutation. |

Before independent comprehension checks, state the tasks and failure criteria.
Use different material from presentation tuning. Record incorrect interpretations
and inaccessible detail. An agent navigation exercise is not a human-user study.

## Implemented slices and evidence limits

- [x] Local candidate receipts bind immutable revisions, actual execution,
  declared files/populations and environment. Recovery publishes saved manifests
  without repeating execution. Foreign Git environment regression was repaired.
- [x] Generated-output evidence invokes the bound entrypoint, records pre/post
  bytes, ownership, input changes, retirement and failure. Unchanged bytes do not
  prove generation. Exclusive causation and confinement remain unknown.
- [x] Representation production writers use durable staging and interruption
  recovery. Missing authenticated lifecycle capture remains recovery-required.
- [x] Decision/evaluation passed 13 focused tests; the HTTP adapter passed ten
  real-server tests covering current, stale, missing, violated and interrupted
  results. Host truth remains outside transport proof. See
  [application evidence](application-evidence.md).
- [x] Local Git candidate checks covered both disjoint merge orders, target
  movement, rebase/squash continuation, fresh-process restoration, unresolved
  conflicts and executable index mode. Later review repairs covered exact-index
  conflicts, concurrent index/HEAD movement and external junction parents.
  Nine focused repairs and a native Windows leaf-junction case passed.
  Native POSIX symlink/executable worktree behavior remains unqualified.
  None of these checks proves semantic contribution accounting or clone portability.
- [x] Independent navigation proxy answered 5/5 predefined tasks. Human
  comprehension remains unqualified; agent navigation is not a human study.
- [x] Recorded broad gate passed in 354.9 seconds: 1,180 tests, two skipped
  tests and one skipped file, eight typechecks, package boundaries and zero
  blocking specification findings. An earlier broad run failed and remains a
  failure. Population/history and generated rendering repairs settled after
  that gate started; 13 candidate/generated tests, 47 CLI/runner tests and a
  complete package build passed separately.
- [x] Offline installation passed 21 checks using a separate plugin runtime and
  fresh CLI processes, generation, scoped reuse, missing-research refusal and
  satisfied/violated HTTP clock-fixture observations. Two earlier fixture setup
  failures were repaired without weakening requirements. This result applies
  to that built package, not the active plugin cache or domain truth.
- [x] Packaged generation instructions were repaired and inspected: ten fields
  and three wrappers passed structure checks. Inserted-entrypoint boundary
  probes passed 1,023 additional arguments, 9,999 additional distinct inputs and
  10,000 entries including the entrypoint. This is not a new execution or
  installed gate.

Retained context inspection found a current continuation observation but stale
old reasoning: three branches changed query dependencies and reconstruction
rebound. Governance remained unknown for three decisions with changed proof
bindings. Public check reported changed repository, stale meaning and application
evidence not applicable. Both observations used a bounded 120-second allowance.
They are not design-conformance certificates or authority to reuse old approval.

The Git/native-evidence checkpoint checked retained context
`knowledge_context_9234bfddad12c1bb90948a02a2fee62c`. It became stale because
13 topology-query dependencies changed; bound semantic values did not change.
Fresh context `knowledge_context_502c6bc4b1a960df25834c470d5d3b3c` retains the
applicable authority, scoped-invalidation, recovery and native-host execution
obligations. Its coordinated-writer requirement exposed the generation lease
correction below. These observations used a finite 120-second allowance because
the current observer still performs repository-wide work.

After that correction, the retained-context check reports eight changed bound
source/unit values and one changed topology query across the retained branches,
with no Planning Surprises. Fresh context
`knowledge_context_7b7fca1e2306d8a0c4fa27af25107091` captures the current source.
Both the prior and fresh retrieval report four blocked decision assessments
across branches because authenticated applicability or state-binding proof is
missing. They report no governance violations. The fresh bounded retrieval also
discloses omitted expansion and unobserved decision triggers. Passing executable
checks does not resolve those proof gaps or make these contexts conformance
certificates.

## Mechanism amendment and remaining delivery

All C01--C19 and K01--K06 outcomes remain required. Replace mandatory
checkout-bound candidate sessions, custom publication and export/import with
normal Git transport and actual integration-result assessment. Physical identity
guards local mutable operations only. Existing receipts retain historical scope.
The canceled export/import implementation was rolled back. Its local candidate
mechanism has been replaced; earlier qualification remains historical evidence.

- [x] Implement candidate-independent integration assessment without changing refs, the index, or working files over
  common-base, target, incoming and result Git revisions. Provide an ordinary
  CLI integration command. Check stable-ID retained/altered/lost contributions,
  final canonical integrity and known static governance without a source checkout.
  Focused service and CLI tests pass. This does not establish dynamic governance
  or completed behavioral verification.
- [x] Qualify two independent clones, source clone deletion, both integration
  orders, rebase, squash, linked local worktrees, disjoint/conflicting semantics,
  contribution accounting and resource limits: 15 Git tests pass, with a separate
  final raw-index preservation check. The earlier 34 combined integration/canonical/
  architecture checks remain applicable. The CLI slice passes its combined
  57-test selection.
- [x] Qualify installed integration and retained native history after source-clone
  deletion, both merge orders, supplied squash and detected contribution loss,
  preserving destination HEAD, index and dirty files.
- [x] Implement integrated-result static new-consumer reconciliation and
  behavioral evidence reuse boundaries. Qualify the local pre-push hook and
  ordinary commit/push/pull/resolve/push workflow, including index-conflict,
  pruning and interruption recovery cases. Two actual local pushes exercised
  the installed hook. Hosted PR/CI qualification was superseded by the user's
  local-only delivery instruction on 2026-09-27. The expanded installed gate
  checks both integration orders and trusted fixed-check reuse after source
  deletion; arbitrary behavioral evidence remains ineligible for reuse.
- [x] Implement native verification and generated-output observation retention
  with no candidate session. Qualify source-independent history, contradictory
  outcomes, local prelaunch intent and interrupted publication recovery. Native
  observations are not proof of complete input closure or portable safe reuse.
  Typechecking, 23 focused native-process checks and installed qualification pass.
- [x] Finish the generation coordination correction found in fresh accepted
  context. Declared repository output writes use the existing per-worktree
  writer lease and a durable prelaunch native input/output intent. Declared
  `.projector` and `.git` outputs, including case aliases and symlink paths,
  are refused. Evidence readers and publication-only recovery remain independent.
  Typechecking and 26 focused tests pass, including real lifecycle contention
  and native cancellation after lease loss. The refreshed full and installed
  gates below cover this correction.
- [x] Repair root-file population observation and refuse recursive populations
  that would include their own runtime evidence before launch. All 13 native
  verification-service tests pass; the intended-red counterexample is retained.
- [x] Implement a portable fixed-check adapter for canonical integrity with
  complete named input, producer, environment, contract, trust and retention
  boundaries. Preserve contradictory outcomes; independent timestamps are not
  distributed order. Arbitrary native command records remain non-reusable.
- [x] Implement persistent incremental observation and downstream updates in
  the existing graph. Include complete Git/dirty deltas, discovery, canonical
  loading, hashing, worker transfer, impact/context work, enrollment races,
  interruption, concurrency, finite limits and freshness/exclusion/version loss.
  Preserve the last complete baseline. Explicit bounded rebuilds are valid
  recovery; hidden full scans cannot prove locality. Watchman/provider or
  byte/syntax reuse alone does not close C17.
- [ ] Qualify broader C17 locality beyond the supported scoped workloads. Keep
  fixed-impact source growth measurements, global-analysis costs, unsupported
  rebuilds and Git's own metadata work visible; bounded fixture results do not
  establish universal locality.
- [ ] Qualify the configured evidence adapter against the target application's
  actual owner/scenario/predicate contracts.
- [x] Qualify C02 transitions and fresh-clone retrieval, bounded C06 consumer
  effectiveness, C09 multi-source revision and C14 ordinary delivery/recovery
  workloads. Preserve the capability register's limits and other criteria.
- [ ] Extend C10 framework qualification beyond the supported static syntax and
  mixed-artifact analyzers. Unsupported dynamic behavior remains unknown.
- [ ] Complete K01--K06 preservation and human navigation qualification. Measure
  matched complete-workflow tokens/resources with fixed relevant impact as
  unrelated content grows; retain all efficiency rejection cases.
- [x] Run `pnpm verify` for the combined implementation: 1,228 tests pass, two
  tests and one file remain skipped, eight package typechecks pass, package
  boundaries are valid and specification validation has zero blocking findings.
  The subsequent generation-recovery adjustment also passes refreshed typechecking
  and 23 focused tests. The offline installed exercise passes 24 checks. Its first
  attempt stopped in npm setup; the retry filters only the inherited script-allowlist
  environment alias for installation and retains `--ignore-scripts`. Later source
  changes require their applicable checks; these results do not close unimplemented
  capabilities.
- [x] Refresh the integrated gates after generation coordination and root-file
  population changes: 1,235 tests pass, two tests and one file remain skipped,
  all eight package typechecks pass, package boundaries are valid and there are
  zero blocking specification findings. The newly built offline installation
  passes all 24 workflow checks. The previous results remain historical evidence.
- [x] Install and qualify the impact-aware pre-push hook. Run the local Git
  integration exercise through the installed hook. Preserve the applicable full
  verification and installed-release gates.

No canonical meaning was changed, no production application was published and no
pull request was created during the recorded checkpoint. This durable record
contains its own contract and status; it can be revised without a scratch packet.

## Active continuation on 2026-09-27

The user requested completion of all remaining outcomes, with CI implemented as
a local pre-push hook, and requested a whole-system optimization pass. The
capability register and every other unfinished outcome remain in scope.

Retained context `knowledge_context_7b7fca1e2306d8a0c4fa27af25107091` was resumed.
Bound values remained current, but two decision-query bindings were stale or
not proof-eligible. Fresh context
`knowledge_context_6a89777aaead1de2339c48674d6a03d8` preserves scoped invalidation,
reverse reconciliation, native host execution, and executable governance
obligations. Its bounded view omits expansion and contains a blocked decision
assessment. It is evidence for investigation, not a conformance certificate.
The resume and retrieval used finite 120-second budgets because current
observation still collects repository-wide inputs. Logs are under
`.temp/completion-20260927/`.

The active implementation separates three independently owned outcomes:
immutable Git-result consumer and obligation analysis; a local pre-push hook and
ordinary Git integration exercise; and persistent incremental observation with
affected graph/query updates. Runner evidence must use those input and query
contracts where applicable. Declared native input matches remain insufficient
for safe portable reuse. New storage alone cannot close C17.

Optimization must cover discovery, Git facts, exclusions, canonical loading,
source hashing, worker transfer, graph/query work, and result publication. A
complete requested output can itself require work proportional to that output.
Warm scoped work must avoid materializing unrelated complete snapshots. Full
and installed gates are batched after the combined implementation settles;
focused checks establish each intermediate behavior. Earlier passing gates
remain historical until their relevant inputs are shown to match.

### Integrated implementation and qualification

Git supplies immutable revisions, complete index membership, history and ignore
rules. The cache supplies disposable derived records and dependency witnesses;
it cannot grant authority. The source/query/context owner is an external SQLite
database per physical checkout. Transactional publication preserves the last
completed generation on cancellation, failed admission, lost currentness or a
competing writer. Cache-only writes preserve the latest source cursor. Pure
Merkle population roots and registered query versions allow addressed updates,
including complete empty populations.

Source discovery and incremental notifications use Git's effective ignore
rules. Ignored untracked files and ignored directories without tracked
descendants do not enter source analysis or trigger source rebuilds. Files
already tracked by Git remain observable even when an ignore pattern matches.
Changes to exclusion controls require fresh observation. Explicit canonical
meaning, durable lifecycle evidence and the executing producer's installed
dependencies retain their separate validation contracts; source exclusion does
not erase those obligations. Disposable observation and query state lives in the
host cache directory, outside the source checkout.

The public context path now transfers a generation-bound descriptor to workers.
Workers read relevant graph records instead of receiving a complete observation
array. Ordinary reconciliation compares retained values, sources and queries.
Historical planning snapshots keep their stronger impact contract. Realization
incidence includes initially empty selectors, and reverse traversal includes
empty leaves. Active lens, cardinality, decision and concern populations are
updated with the affected source component. Full-observation oracles exposed and
verified repairs to canonical Git identities, implementation-binding populations,
directory admission and validator freshness.

Fresh public-command subprocess measurements held the relevant edit fixed while
adding 40 unrelated files. Unchanged contexts read 119 addressed rows at both
sizes; ordinary edits read 315 and 317 rows. Worker edit reads stayed at 173 rows,
and each edit read only the changed source file. The extra two rows were Merkle
trie nodes. Recorded edit times were 2,141 and 2,163 milliseconds. These are
bounded fixture observations, not universal complexity or latency guarantees.
The full metrics and filesystem/SQL traces are in
`.temp/completion-20260927/fresh-cli-*`.

An actual Windows Watchman daemon independently qualified cold enrollment,
unchanged generation reuse, dirty edit, new distant consumer and deletion. All
five stages matched a complete state and analysis oracle. The final native
exercise detected the consumer through a fresh public CLI process. An actual
new directory caused explicit rediscovery with complete oracle parity. The
native exercise exposed parent-directory metadata events absent from the initial
protocol fixture; that seam was repaired before qualification passed. See
`.temp/completion-20260927/workload-native-watchman-report.md`.

The actual local Git exercise used two independent checkouts and a local bare
remote. Change 1 was committed and pushed through the installed hook. Change 2
started at the preceding commit, was committed, pulled change 1, encountered a
conflict, resolved both contributions and pushed through the hook. Both pushes
ran actual frozen installation, build and specification checks for proved
docs-only deltas. These are additional checks, not a substitute for the required
combined verification and installed-release gates. The source checkout's HEAD
and staged entries remained unchanged; concurrent implementation edits prevented
a whole-working-tree equality assertion. The initial failure and reconciled
result are retained in `.temp/completion-20260927/local-integration-*`.

Four independent agent runs exercised initial implementation and later revision
with matched behavioral probes: 32 of 32 checks passed. The Projector condition
retained three conflicting sources, distinguished a rejected proposal, accepted
meaning through the actual lifecycle, and revised the same requirement from a
fourth source. Actual rendered context reached both consumers. Child input-token
totals were 212,014 for ordinary sources and 188,629 for Projector context.
Harness context and cache warmth differ, and intake, acceptance and orchestration
costs were not measured. These results do not prove whole-workflow savings. See
`.temp/completion-20260927/workload-agent-report.md` and its predeclared criteria.

Open evidence boundaries remain explicit: a real target application's
independent owner/scenario evidence, human comprehension, complete-workflow token
economics, arbitrary dynamic/framework behavior, and universal incremental
locality are not established by these fixtures. Active global lens configuration,
Git's internal index/status work on metadata changes and unsupported rebuild
cases can still require work beyond the selected source component. No recorded
agent experiment is described as a human study.

The final independent persistence review identified full-payload transfer during
eviction, native JSON parsing before legacy size rejection, and competing first
initializers. All three findings are closed. Eviction hashes bounded BLOB chunks
inside the writer transaction; legacy reads check their size before parsing;
initialization rechecks the schema version under the writer lock. The 42-test
cache slice includes a 240 KB entry removed with a 4 KB transfer allowance,
changed-byte rejection, cancellation, lifecycle protection and shared-cache
accounting. Historical local staging and recoverable evidence remain intact.

The initial combined verification attempt failed and is retained as
`final-verify.log`. Repairs address cache-owner migration assumptions, validator
freshness invalidating its own observation lease, native directory notifications,
ordinary-context reconciliation, obsolete hosted-workflow assertions and native
TypeScript dependency packaging. The initial installed failure is retained as
`final-release.log`; native vendor dependencies now retain their supported module
layout in the standalone plugin. Focused checks passed before the combined gates
were restarted. These failures are evidence, not passing results.

The final accepted-meaning check completed with the prior context correctly
stale after changed source values and query populations. Its evaluated governance
branches reported no violations or blocked decisions. The repository check
retains a pending host-change finding; existing uncommitted work was not marked
handled wholesale. Fresh context
`knowledge_context_8871434e420dbe30617875f06cb6b1d8` focuses on scoped invalidation
and reverse reconciliation. It reports no analyzer failures and no blocked
decisions in that view, and discloses 83 unknowns, of which 12 are rendered.
This finite observation does not establish conformance for omitted or unsupported
behavior. Evidence is in `projector-final-check.json` and
`projector-final-context.json` under the same local evidence directory.

The combined `pnpm verify` rerun passed all eight package typechecks and all
1,301 tests (two tests and one file skipped) in 530.36 seconds. Its next stage
found three new public builtin-verification exports missing from the curated
facade declaration. The declaration now includes those exact exports. Package
boundary validation, specification validation with zero blocking findings, and
all 10 checker tests then passed. Product code and the full suite's relevant
inputs were unchanged by that checker-declaration repair, so the passing suite
is reused. The initial command's nonzero result remains in `final-verify-2.log`;
the completed checks are in `final-boundaries.log`, `final-spec.log` and
`final-checker-tests.log`.

The second installed attempt reached integration but failed closed on unknown
static analysis. Its integration baseline reused a prior generator example with
copied exports and an unresolved generator dependency; the two branch examples
also used the same exported name. The installed exercise now keeps that completed
generation/application repository intact and initializes a separate integration
repository with distinct exports. The exact repaired integration phase passed
13 recorded operations against the retained installed binary, including both
merge orders, a new re-export consumer, source deletion, narrow evidence reuse,
squash and intentional contribution-loss refusal. Product analysis and failure
statuses were not weakened. The failed run remains in `final-release-2.log` and
the isolated proof in `installed-integration-probe/`.

The final fresh `pnpm release:check` completed successfully with all 26 installed
workflow checks. Its report is `installed-final-3/result.json`, and its complete
command transcript is retained beside it. This includes both integration orders,
the newly relevant re-export consumer, supplied squash, rejected contribution
loss, source-clone deletion and retained fixed-check reuse without transferred
authority. The source checkout remains at
`8b92ce4ca507eee7c0dd3cc31ff3a361c94170c3`, with its original staged entries
preserved. No source change was committed or pushed to an external remote.
The local hook is installed and `core.longpaths=true` is effective in this
repository's local Git configuration.

Remaining qualification requires a named real target application and its
owner/scenario/predicate contract, human navigation evidence, broader supported
framework coverage, and matched complete-workflow economics and locality
measurements. These outcomes remain open rather than being inferred from passing
fixtures. No accepted requirement was removed to report completion.

