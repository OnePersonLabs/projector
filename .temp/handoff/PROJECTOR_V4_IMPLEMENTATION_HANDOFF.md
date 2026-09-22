# Projector V4: implementation handoff

**Prepared 2026-09-22. Execution proposal H1, derived from the running specification at `5c7e083db63e9b349526f202c1d97b011b4038e1`, revision 0.10.**

## Read this first

Build a small, usable Projector V4, not a framework for eventually building it. This document is self-contained for implementation. The running spec and capture in `OnePersonLabs/projector` live under `.temp/handoff/` on V4 `main`; they preserve attribution and background but are not required reading before implementation. The prior V3 `main` is preserved as `legacy/projector-main-v3`. Files under `.temp/` are handoff/scratch inputs only and must never become dependencies of tracked product files outside `.temp/`.

Michael requested this handoff and delegated engineering recommendations. H1 chooses a concrete implementation baseline; those new choices remain attributed assistant recommendations in the running spec until adopted. Giving an implementer this document with an instruction to implement authorizes working from that baseline. It does not turn measurements not yet performed into established facts. Explicit newer user direction and established requirements outrank H1. Earlier provisional alternatives do not require implementing multiple competing mechanisms.

Use the model and effort configured by the user. Do not infer an API enum from the phrase “ultra effort,” silently lower competence, launch background paid model loops, or add an API billing dependency. Use the host agent and real supported delegation for semantic work. The deterministic kernel makes zero model calls.

Start implementation on a short-lived branch based on the current V4 `main`. Do not modify `legacy/projector-main-v3`, resurrect V3 into the working tree, change Psychord, force-push, deploy, or rewrite another repository without authorization. The caller may explicitly authorize discarding local modifications before starting; otherwise preserve unrelated local work. Only inspect the relevant `opl-openspec` integration surfaces; propose any required changes there separately unless cross-repository editing is authorized.

The objective is a **complete, economical change loop on a supported profile**: requirements and nested designs explain ordinary code; managed changes keep those explanations and implementation coherent; removing a reason removes its unnecessary complexity; readers never mistake unknown observations for current facts. It is not universal automatic program verification.

## 1. Non-negotiable product contract

1. OpenSpec is required and owns requirements. Live `spec.md` changes drive accepted-meaning invalidation. An active change's deltas are prospective intent, never silently accepted live requirements.
2. Designs are nested, human-readable, progressively disclosed, and concern-oriented. They explain contracts, architectural decisions, realization, and child responsibilities. A containment tree is not the entire dependency graph.
3. **Designs reference code, not the reverse.** No mandatory source annotations, decorators, IDs, plugin imports, or runtime dependency. Removing Projector and its explicit tooling integration leaves ordinary builds and source usable.
4. Use only `[[...]]` for references, including qualified and inside-target references. The reference rules in section 5 preserve the approved global-default convention.
5. A live design referencing an undefined term is drift. Expected inconsistency during an implementing delta is scoped to that transition, not a blanket exemption.
6. Coverage and evidence justify implementation. Links, hashes, checked boxes, and an agent's confidence do not prove behavioral correctness.
7. Changed or removed designs illuminate their **previous** whole/partial implementation footprint. That footprint is a reconsideration set, not a preservation list.
8. Reconciliation aims at **clean-reconstruction equivalence**: no materially unnecessary structural residue caused solely by history. A settled second pass must be a substantive no-op. Neither property requires identical source text across independent implementations.
9. Repair is planned, reviewed, then executed. Human review may be skipped for well-supported non-pivotal choices; consequential interpretation/implementation ambiguity is escalated with evidence-supported options plus Other.
10. Compute, I/O, memory, process overhead, token use, and churn all count. Coalesce causal edits, share work, and preserve valid results. Broad ordinary reads, repeated unneeded parsing, and recursive model-repair loops are design failures.

## 2. Resolution of the three material holes

### Observation: an explicit operating contract, not a watcher promise

Implement two read modes from the outset:

- **Revision read:** exact accepted commit, exact proposed target revision, or a sealed implementation checkpoint. Validate stored bytes/identity and extraction versions for that revision. No claim that it is the latest arbitrary filesystem state.
- **Working-current read:** return only when a qualified observation profile establishes the relevant completed and in-flight mutations through a stated boundary. Otherwise return `pending` or `unavailable`, with the precise missing condition. Never silently substitute a revision read.

Ship revision reads and the managed-writer profile as the mandatory core. The managed profile applies to an explicitly allocated candidate worktree whose participating writers use acknowledged begin/end mutation batches, or an equivalent tested host boundary. An ordinary worktree with arbitrary editors is **not** silently enrolled by assertion. Generic watcher notifications are hints, not the proof behind this profile. Its guarantee is conditional on the declared cooperating-writer/isolation contract, not protection against any same-user process deliberately modifying the checkout outside it.

Use a small host qualification test at milestone 0 to determine actual coverage. If the chosen host cannot support that contract, build and expose revision/checkpoint operation honestly; record working-current as unavailable and do not call the managed experience complete. Do not weaken the requirement, implement a polling sweep per read, or spend the rest of the project inventing a cross-platform filesystem interposer. A qualified live external-observer profile is an extension, not a prerequisite for exact revision operation.

This is a deliberate delivery boundary, not a claim that missing hooks are harmless. The user retains a valuable precise core; unsupported live behavior remains explicit rather than falsely implemented.

### Discovery: executable applicability plus a bounded judgment gate

Every changed/new requirement must receive an applicability disposition before completion: one or more explicit concern/scope/contract selectors, or a justified scoped non-applicability finding. Missing scope is an unresolved obligation, never “applies nowhere.” Use actual inventoried changes independently of design bindings. Compare them with the expected scope, current ownership, and the union of previous/new design footprints.

Deterministic coverage is complete only for its declared, observed population. For prose applicability, the host agent examines the affected concerns' outward contracts and the compact root concern catalog, then records the decisive inclusion/exclusion rationale and unresolved questions. Do not claim exhaustive natural-language inference. If the request could apply globally, broaden this particular discovery step deliberately; never hide that cost in every query.

A broad path selector establishes where to examine or who owns responsibility; it is not evidence that every new behavior in that path is legitimate. New/modified implementation must still fit a current decision and its evidence policy. Unexpected code produced by Projector itself is subject to the same rule.

### Clean endpoint: a finite disposition rule and discriminating tests

For each affected previous decision/implementation contribution, select **retain, remove, replace, or revise**, with a current reason. Retention requires surviving requirements, a current design need, or an explicit external obligation, not “pre-existing,” “tests pass,” or “someone might use it.” Reject unexplained old/new parallel paths, compatibility wrappers for internal callers that can migrate, orphan registrations, unused dependencies/configuration, and abstractions whose motivating choice disappeared.

Stop when the changed obligations are satisfied, previous contributions are accounted for, affected interactions hold, and no identified material residue remains within that causal closure. Unrelated aesthetic improvement is not part of this operation. Conversely, fewer edited lines do not justify keeping obsolete architecture.

“Some other architect might choose differently” does not fail a clean endpoint. A surviving layer with no adequate reason does. Lifecycle and repair cannot guarantee a unique global optimum; the practical evidence bar is defined in section 12, not left to implementer enthusiasm.

## 3. Bounded architecture

Start with **one TypeScript package** and explicit internal module entry points. Do not create a workspace package for each noun. Separate these responsibilities without creating a framework:

| Module | Owns | Must not own |
| --- | --- | --- |
| `documents` | Markdown schemas, reference addresses, deterministic deltas | Filesystem watching or model invocation |
| `index` | Extraction records, memberships, SQLite transactions, snapshots | Design decisions or source repair |
| `kernel` | Root sessions, batches, shared refresh, read validity, budgets | OpenSpec requirement-merging reimplementation |
| `change` | Targets, planning basis, contribution/discovery gates, coherent finish | A new ticket tracker or global scheduler |
| `host` | MCP/CLI/plugin adapters, IPC, process/observer qualification | Competing caches or hidden authority |
| `testkit` | Controlled filesystem/events/processes, counters, held-out fixtures | Alternate production semantics |

Dependency direction goes from host into change/kernel, and from those into document/index services through their interfaces. Testkit depends on production interfaces; production never imports testkit. Enforce entry points and forbidden directions with one existing boundary checker or the package's standard ESLint import rules. Do not build a new architecture-lint product.

Use Node 24 LTS at a pinned tested patch, TypeScript, an established Markdown AST parser, the official MCP SDK version supported by the host, and SQLite. Keep dependencies explicit and count installation/native packaging costs. `node:sqlite` is the default candidate if the selected runtime and worker architecture pass qualification; its synchronous API must not block the coordinator. A different established SQLite binding is allowed only for an observed blocker, not speculative flexibility. Avoid Rust/.NET sidecars solely for this version.

Begin with Markdown and JavaScript/TypeScript support. Preserve a narrow language-extraction interface, but do not claim support for other languages. Opaque/config/generated artifacts still have file-level ownership and explicit verification obligations. Unsupported syntax or unresolved module topology is a reported limitation, never proof of absence or uniqueness.

## 4. Authoring contract and exact design deltas

Recommended layout:

```text
openspec/
  specs/<capability-path>/spec.md
  terms/<term-path>.md
  designs/<concern-path>/design.md
  changes/<change>/
    proposal.md
    specs/<capability-path>/spec.md
    designs/<concern-path>/design.md
    tasks.md
    implementation-state.json
```

Use an OpenSpec custom schema for separate `specs/**/spec.md` and `designs/**/design.md` artifacts. One task tree per change initially. Do not put design deltas under `specs/` and assume stock archive knows how to merge them. A change-level `design.md` may be a linking overview only where stock/custom schema consumers need it; it must not duplicate nested decisions.

A live design has small YAML frontmatter: `projectorDesign: 1`, a unique stable `id`, and its resolution/ownership scope. Its H1 is human prose. Its addressable H2 parts are **Contract**, **Decision: <local-key>**, **Realization**, and **Subdesigns**. Decisions repeat with distinct local keys; the other roles are singleton when present. Contract is required. Other parts appear only when they have content. Decisions have readable labeled fields, parsed through the Markdown AST:

- Choice and Reason are required.
- Requires names the motivating requirement(s); Constraints names additional applicable obligations.
- Alternative and Tradeoff are required for a new boundary/dependency/abstraction or consequential strategy, not routine internal work.
- Realizes points to source artifacts or scoped symbol sets. Shared implementation can have several justifications.
- Evidence names checks or observations and their scope. Unexecuted checks remain pending.
- Reopen identifies non-obvious changed premises not already expressed by the referenced requirements.

The Contract states responsibility, public guarantees, and dependencies. Realization can bind uncontroversial internal artifacts to existing decisions without one Decision per helper. Subdesigns links to child design IDs. A child does not inherit every ancestor's text as a hash dependency. Bind the particular outward promises/constraints it relies on. Referenceable Markdown headings beneath a part are subaddresses, not automatically a new design-part type.

For applicability, add compact `Applies` entries in the owning design's Contract: requirement reference plus a selector and reason. A new requirement without any disposition creates an unresolved planning obligation. These entries describe applicability; they do not copy or override requirement prose. One root concern design/index supplies navigation and any genuinely project-wide applicability. Do not produce every-requirement-by-every-design rows.

A design delta uses frontmatter identifying `designDelta: 1`, target design ID, and the expected baseline revision. Its H2 operations are `Add: <part-address>`, `Replace: <part-address>`, `Remove: <part-address>`, and `Rename: <old-address>`. Replacement contains the **complete new addressed part**, not open-ended textual instructions. Remove/Rename have explicit targets and a concise reason; Rename includes the new local address and preserves binding identity. Whole-design add/remove is explicit. Coalesce multiple changes to the same part into one final operation before application.

Validate missing or duplicate targets, conflicting ancestor/descendant operations, duplicate IDs, and stale old content. Identical add/retry may return already-applied only when its recorded target and exact resulting state match. Never treat a conflicting existing part as an idempotent success. Reject overlapping operations rather than invent precedence. Compute the final document in memory and write each affected document once per settled delta batch. Preserve untouched content and formatting; no global pretty-print pass.

Changing a requirement heading/path uses an explicit rename mapping or is a delete/add that raises affected references. Do not infer semantic identity from similar prose. Stable design IDs and part keys live in designs, not code. Location-derived code addresses can change through an explicitly bound refactor.

## 5. Reference and selector semantics

Bare names use the approved normalization: case-insensitive comparison with spaces and underscores removed. Centralize normalization, use a pinned tested Unicode case-folding implementation, and keep other punctuation significant. This is not fuzzy search. `[[Some Type]]`, `[[SomeType]]`, `[[some_type]]` share a key.

Resolution precedence:

1. One eligible Markdown H1 term definition owns the bare key.
2. Without that definition, exactly one logical referenceable project code declaration owns it.
3. Multiple Markdown owners are errors. Multiple code candidates make the bare reference ambiguous, not the code declarations illegal. No candidates is unresolved.
4. Qualified code references bypass Markdown default ownership, not boundary rules.

Members/local variables are not all global bare-name candidates. Top-level referenceable project declarations are. Deduplicate imports, aliases, overloads, declaration merging, and re-exports only when the language resolver establishes a common logical symbol. Do not call an incomplete candidate inventory globally unique.

For implementation H1 choose explicit addresses inside the same brackets:

```text
[[Some Type]]
[[somepackage.SomeType]]
[[code:packages/audio/src/PreviewPlayer.ts#PreviewPlayer.replay]]
[[spec:audio/preview#Immediate replay]]
[[design:audio/preview#decision:retain-buffer]]
[[Player Evidence#Origin#System events]]
```

Package-qualified shorthand resolves through actual package exports/module resolution, not string concatenation. `code:` is the unambiguous file/symbol fallback. `spec:` names the full capability path and requirement heading; `design:` names stable design/part identities. Percent-escape reserved address characters in components; do not make punctuation disappearance part of name normalization. Markdown context carries owning package/scope for boundary checks; source comments use their file scope for permissions but not import-local default-name selection.

Cross-package implementation references use declared public boundaries unless the design actually owns the referenced private scope. A scope declaration is not permission to bypass existing dependency policy. Use actual configured policy through a supported adapter. An unsupported detected policy is explicit, not replaced by allow-all. Read-only audit observations and a claimed architectural dependency are distinct kinds of edges.

Autofix qualification only with exactly one permitted target. Changed owner/collision populations invalidate stored bare-name bindings. A new Markdown owner cannot silently redirect old code references: show a rebinding finding, then qualify or intentionally adopt the new meaning within the reviewed batch. Resolve old historical links in their old revision, not today's symbol table.

Keep set selectors separate from exact references. First selector vocabulary: exact design/requirement/symbol ID, path prefix/glob within a named root, concern descendants, and static import/consumer relationships. Conjunction/union are sufficient. Add `implements` only with reliable language-semantic support. No generic CSS engine, arbitrary user code, dynamic graph predicates, or tag language in H1. Explicitly unsupported selectors return unknown, not an empty set. Track each query's candidate population, including empty membership.

## 6. Hosting and external state

One on-demand user-local kernel serves multiple roots. Each host session launches only a thin MCP relay. Hook and CLI clients call the same protocol; they do not build maps or own repair locks. No manual system service, elevated process, or global repository crawl.

The kernel's lifetime ownership must be OS-held, not a timestamp/PID file. Prefer a vetted portable primitive. A sufficiently simple alternative is a single per-user configured loopback endpoint held by an exclusive socket bind: start contenders may race, only the endpoint owner initializes databases, losers join after authenticated/versioned handshake. A foreign port occupant or incompatible server is an explicit error, not a reason to search random ports and create competing kernels. Qualify exclusivity on the supported OS before selecting this alternative. Use one unversioned ownership namespace across upgrades.

For a loopback transport, bind only to loopback, authenticate using a per-user private credential, reject browser origins and unauthenticated control requests, bound payloads, and never log credentials. An established same-user IPC endpoint with equivalent access control is equally acceptable. This is one transport choice, not two production backends required at launch. Stdout of the relay remains MCP only.

Identify roots by canonical actual worktree identity, Git worktree metadata, and an incarnation detecting replacement. Path aliases share a root; different worktrees do not. Treat Windows and WSL writing the same checkout as unsupported dual ownership unless explicitly connected to the same qualified owner. Do not silently equate matching remote URLs or branch names.

Use one outside-repository SQLite database per root. Tables represent files, semantic units, typed edges, name/scope populations, bounded query dependencies, and revision/evidence metadata. Exact SQL naming is implementation freedom. Use transactions, unique constraints, migrations limited to this version's real data, and prepared queries. Cache corruption triggers rebuilding, not permission to erase authored state.

The coordinator does scheduling and short messages. Parsing and blocking SQLite work run outside that response loop in a bounded pool. Start with at most two work lanes, schedule fairly across active roots, and serialize each root's publications. A worker owns its connection; do not share a synchronous connection unsafely between threads. Transactions contain validated index changes, not parsing, subprocess execution, or model calls. A slow parse must not hold another root's publication lock.

Budgets cap active roots/ASTs, concurrent refreshes, waiters, result bytes, cached queries, retained history, and WAL/checkpoint growth. Query paging is deterministic and revision-bound. Active comparison/recovery state cannot be evicted; reject admission rather than quietly discard it. Idle shutdown is permitted after durable pending-state recording. Do not build adaptive budget optimization or telemetry services: counters and fixed conservative limits are sufficient initially.

## 7. Indexing, invalidation, and shared reads

**Extraction unit: file. Propagation unit: semantic record and query population.** Persist declarations/import summaries and addressed document parts, not an AST node for every expression. The JS/TS adapter uses the language's actual parser/resolver. Cache source trees/program state only as needed and within budget; do not construct a whole-project language program afresh for every lookup. Demand semantic resolution for aliases/re-exports where syntax alone is insufficient, and count that work.

Track separate relevant fingerprints: address/name membership, public contract, implementation body, design rationale/basis, and check environment. Reusing a name/type signature does not validate behavior. Cosmetic document edits may retain a parsed part's meaningful value; do not claim arbitrary prose equivalence from similarity.

A pending mutation marks files/scope as pending immediately. Repeated edits coalesce by final demanded version. A bounded active-query reverse index can mark answers pending without traversing the entire semantic graph per save. Dirty symbols and changed records propagate after extraction at a settled batch. An active query's dependency footprint must include its transitive factual basis or sound coarser population generations, not only the first edge.

Every new/deleted declaration updates its normalized-name population. A bare globally unique reference waits for pending eligible declaration changes that could collide. An exact reference can bypass that population barrier when it truly does not depend on it. Empty selector results subscribe to their search population. New requirements without applicability records remain unresolved until classified.

Refresh work is single-flight by root, input revision, and extractor/policy basis. Overlapping readers share file extraction and use one coherent published result. Validate job input generations and kernel incarnation immediately before publication. An obsolete result cannot clear newer dirtiness. Keep independent valid results when only one file races. Do not rerun a joined job per reader.

Once a needed settled version is validated, a warm read performs no source I/O/hash/parse/model work. It still pays for IPC, validity bookkeeping, any necessary observation barrier, and serialization. Limit cached query subscriptions rather than letting cross-product storage grow indefinitely. Reuse content-addressed extraction for matching bytes and extractor versions.

## 8. Mutation and read protocol

Implement a small typed protocol, not one generic command carrying arbitrary hidden behavior. Suggested operations:

- `openRoot`, `read`, `inspectStatus`, `releaseRoot`.
- `beginBatch`, `completeBatch`, `checkpoint`, with causal target/change identity.
- `prepareChange`, `validatePlan`, `recordEvidence`, `finishChange`, `resumeChange`.

Names are not public API promises until stabilized. Thin MCP tools/CLI commands translate to these operations. The deterministic kernel returns work obligations, excerpts, dispositions, diagnostics, and tokens; it does not pretend to make architectural judgments.

`beginBatch` acknowledges a scope before managed edits start. It records target identity and preconditions but does not parse or start a semantic repair. Unknown arbitrary shell writes cannot be represented as a precise file set merely because the agent listed anticipated outputs. Either the host observes actual writes, or the operation closes through an independently validated checkpoint. Build/test commands write only declared generated/temporary outputs or register source changes. Detached writers need explicit ownership; an escaped child keeps observation unknown.

`completeBatch` supplies actual changes where available. Missing completion, process interruption, policy changes, root switch, or lost observer intervals keep the affected scope unknown/pending. Checkpoint validates the actual scope and inventory independently of plan claims. A broad inventory is justified at initial enrollment or an unbounded gap, not inside normal reads. An immutable checkpoint is labeled revision-bound.

A current read does this in order: select root/view; establish the supported observation boundary; refresh necessary discovery populations; join/demand relevant settled extraction; read a single coherent publication; return data plus its dependency token. Do not serve stale content with a small warning under a `current` result. Timeouts return no purported current payload. Optional historical data requires an explicitly historical request/result.

Response axes are separate: `freshness` (validated/pending/unavailable for the selected view), `coverage` (complete-for-profile/partial/unknown), `conformance` (satisfied/discrepancy/unreviewed), and `transition` (settled/implementing/blocked). Use a tagged union to prevent invalid combinations. Tokens include root incarnation, view/target revision, observation epoch and required dependency basis. Database generation alone is not sufficient.

No reader lock survives into agent reasoning. Before consequential mutation/publication, validate its token and target, then use cooperative write exclusion or compare-and-swap preconditions. Check-then-write is not atomic against noncooperating writers. A writer querying its own open batch settles a checkpoint first or requests the explicit baseline view; it must not wait forever for itself.

## 9. One managed apply lifecycle

Use the existing `opl-openspec` route with one explicit Projector-enabled extension, not competing stock skill names or advisory instructions secretly overriding stock apply. OpenSpec remains the requirement parser/merger and external trackers remain backlog authority. Do not modify installed plugin caches as an integration technique.

The current donor at `071055f1229cfcc76bb0248036596a85b28e7a50` supports nested capability paths, deferrals, and mandatory archive gates. It does not by itself implement this candidate lifecycle. Use a source-level adapter/skill route that is valid under its stock-skill protection, and preserve its required validation. If that route needs a companion-repository change, prepare the exact patch/PR and do not claim end-to-end integration before it is authorized and tested.

Lifecycle: `prepared -> implementing -> verifying -> ready-for-integration -> completed`; `blocked` and `aborted` are explicit alternatives with recoverable state. One managed change per candidate worktree initially, with optional non-overlapping worker scopes. Do not add a global scheduler.

Pin a known baseline and prospective requirement/design target. Obtain only the needed accepted slices plus target overrides. During work keep accepted, proposed and actual views distinct. Use an existing isolated worktree facility. Never automatically stash/reset unrelated local work. A candidate's work-in-progress commits are not accepted completion.

Planning derives a readable `tasks.md` tree from the target, previous footprint, actual changes, and required evidence. Tasks have stable local keys, objective, scope, supporting decisions and checks where relevant. Non-checkable grouping headings may express serial/parallel/delegated work. Use a minimal optional metadata syntax on group/leaf records; do not encode a second product specification there.

User task edits are inputs: scheduling changes alter the plan; behavior/architecture/evidence changes propose amendments to their owning authority. Preserve those requests rather than overwriting them on regeneration. Before apply/resume, verify plan basis; unchanged basis reuses the plan. Material changes show a scoped plan diff. A checked box cannot prove completion, survive invalidated support, or waive an obligation.

Revising a target compares old target, new target, and actual candidate. Reassess affected contributions rather than reverting whole commits or repeatedly unsyncing live files. Retain still-justified work; remove/rewrite obsolete work even when tests pass. Batch net file edits. An existing file can contain both valid and invalidated contributions.

At finish, require the completion gates in sections 10-12, materialize exactly the reviewed live spec/design target, verify its match, archive, and create one coherent repository revision when authorized. Use OpenSpec's supported merge/validation behavior. Do not hand-reimplement spec merging. If no suitable in-process API exists, use its pinned CLI in the isolated candidate and verify outputs. Do not rerun both stock finish and an equivalent Projector audit.

Git publication is one revision boundary, not an atomic working-tree multi-file write or a transaction with external services. Use an expected-old-ref comparison for publication; a moved baseline requires scoped refresh, not force. Respect PR/user review and branch policies. A ready candidate is not permission to merge `main`.

A small durable `implementation-state.json` records change/target identity, baseline, phase, input hashes/references needed for recovery, contribution/evidence keys and unresolved obligations. It lives with the change and is archived with it; bulk cache and raw run logs stay outside. It cannot create product meaning or replace human-readable design/plan evidence. Retain prior target contents through Git checkpoint objects/refs or equivalent durable files, not only in the disposable database. Never retain all intermediate full trees indefinitely.

After repository publication, refresh the derived map. Crash between the two means cache recovery, not a distributed transaction. Repeat finish recognizes the exact published target and resumes only the remaining bookkeeping. A blocker parks the candidate and uses the existing tracker/linked-change deferral convention. After its prerequisite lands, refresh affected dependencies and continue; unfinished work is not archived as success.

## 10. Discovery and evidence gate in detail

At target planning, perform one compact routing pass for new or broadened requirement meaning. Reuse existing applicability when its scope/premises remain valid. The routing inputs are the changed requirement, indexed concern contracts, cross-cutting policy, and actual changed populations. A changed requirement may have several owners/constraints. A deleted requirement triggers the old-support calculation without needing current links to the deleted record.

Record the result in ordinary design applicability fields and a short plan/review disposition: examined scope, selected concerns and why, material exclusions, unresolved choices. Do not produce an exhaustive proof ledger. Each unsatisfied discovery obligation is attached to the change and its relevant revision. Cache reuse requires the same applicability basis and observed population; changing that basis reopens the obligation.

Before completion check the independent actual changed-artifact set against declared implementation contributions. Every added/modified unit needs a current responsibility/decision or legitimate inherited scope plus current conformance evidence; every removed unit needs a checked disposition of consumers/registration/configuration. Exclusions are explicit and scoped, not convenient path globs invented to silence errors.

Evidence policy:

| Change/claim | Required evidence |
| --- | --- |
| Bound rename/move without meaning change | Binding/identity preconditions, affected references and existing relevant checks |
| Ordinary internal implementation under an existing decision | Changed-contract tests and review of fit; reuse unchanged rationale |
| New boundary/dependency/strategy or removal of a structural choice | Current reasons, credible simpler alternative, contribution dispositions and boundary/residue checks |
| Timing, concurrency, persistence, or resource claims | The relevant measurement/failure trace/test under stated conditions, not a prose assertion |
| New/broadened prose requirement or unexpected ownership | Bounded applicability/intent assessment with explicit unresolved questions |

Checks and review reports bind to the inputs they actually establish. Missing or stale evidence is not silently passed. The agent can propose findings and dispositions; deterministic code verifies schemas, addresses, coverage, currentness and completion invariants. It cannot certify a fabricated benchmark result. Store actual run command/version/outcome or verifiable artifact, not just “passed” written by the implementer.

For material changes use one isolated reviewer with relevant target/current evidence and actual diff, not a role-play claim of independence. The reviewer must look for a missing concern, unsupported retained structure and a counterexample, not merely agree with the rationale. Reuse that review across finish stages until its basis changes. Routine exact mechanical changes use the approved human-skip policy and do not require an architecture committee.

Escalate only the unresolved material choice. Present observation, alternatives with consequences, a recommendation where supported, and Other. Group by cause/revision. “Add a design that justifies the code” is not a valid shortcut around choosing intended behavior.

## 11. Clean reconstruction and economical stopping

Use the union of old footprint, new realization, independent changed artifacts, and necessary consumer/registration dependencies. Expand scope only when a concrete edge, observation, or unresolved applicability warrants it.

The change's contribution disposition includes affected design decision, previous implementation targets, chosen action, remaining justification if retained, and evidence. It is derived/reviewed change material, not a permanent per-line history database. Multiple decisions may support a shared artifact. Losing one reason does not automatically delete shared code; circular code references without a surviving product/design reason do not rescue orphaned structure.

Required cleanup checks include old exported names/entry points, registrations and factories, feature flags/config keys, package dependencies, tests that exercise only a retired route, and runtime branches for obsolete behavior. Use maintained indexes and existing relevant tools. Dead-code tooling supports this review; it does not decide whether a still-used abstraction remains worthwhile.

Do not rank designs by LOC alone. Compare behavior, responsibility ownership, dependency direction, public surface, number of obsolete/coexisting paths, and any resource property actually motivating the design. No unexplained complexity introduced solely by update history may pass. Equivalent clean implementations may differ in names, helpers, or valid algorithms.

A second settled reconciliation must have no net document/code changes and no new semantic decisions absent new evidence. Do not achieve no-op by remembering “already checked” under a key that ignores changed dependencies.

The cleanup stopping rule is causal and evidence-based: all affected contributions accounted for, no detected material unjustified residue, surviving obligations satisfied, and no unresolved pivotal alternative. Do not search for the globally smallest possible program. New unrelated refactor ideas are out of this change, not automatic tickets or required future work.

## 12. Acceptance tests, including failure and cost

Implement deterministic tests through production interfaces with a fake clock/event stream, injected filesystem/process failures, and counters. No sleeps as the primary correctness oracle and no unconditional paid model calls in the unit suite.

| ID | Test family | Required result |
| --- | --- | --- |
| T1 | References and authoring | All approved spelling/default rules; MD duplicate errors; legal code duplicates; alias deduplication; subreferences; boundary denial; no silent rebinding; malformed/overlapping deltas rejected |
| T2 | Batching and reads | 100 undemanded edits to a file, then 32 readers: one extraction of the final required version. Identical warm read: zero source read/hash/parse/model work. Necessary barrier/serialization counted |
| T3 | Population changes | Empty selector gains a member; second symbol collides; new Markdown owner; new requirement has no scope; unplanned new source artifact: no false empty/unique/complete result |
| T4 | Concurrency/lifetime | Concurrent relays select one owner; close one relay; two roots; worker crash; stale completion; interrupted batch; bounded waiting and fairness; no self-deadlock or newer-dirty clearing |
| T5 | Observation/revision | Startup gap, missed event, unknown shell writes, partial parse, root replacement, policy change: current unavailable until qualified; explicit prior revision remains usable; no mixed target generations |
| T6 | Revision and completion | Update/remove design during partial implementation; keep valid contribution in same file; withdraw obsolete one; task edit cannot override meaning; blocking prerequisite; idempotent finish and archive recovery |
| T7 | Recovery and portability | Delete disposable cache; reconstruct active prior ownership; corrupt DB; crash around publication; remove Projector integration and ordinary app still builds; no hidden sole authority |
| T8 | Scale/resource controls | Same local workload on larger unchanged background: no repository-wide processing bill. Bound AST/query/queue/WAL resources; account cold indexing and global obligations honestly |
| T9 | Installed loop | Fresh plugin installation outside source checkout: open/query, nested spec/design target, plan, apply/revise, verify/archive; two real clients; actual host profile diagnosis and native paths |

Assertions use operation counts before wall-clock tuning. Separate source bytes read, hash bytes, parsed files, semantic extraction, dependency visits, subprocess starts, published transactions, cache size, output tokens, and model usage. Adding background files before measurement is different from adding new files during a measured batch: new files require real indexing. Required upstream broad checks are counted once, not hidden or repeated.

Then implement a **coupled fixture** with playback, event provenance, evidence retention, and a late consumer. It is an evaluation world, not Psychord and not a one-function toy. Hold oracle expectations outside participant context; provide all legitimate requirements and facts.

Use three paired trajectories with equal final intended state: (a) add then remove a preview-specific strategy; (b) revise a shared artifact after another concern gains a legitimate need; (c) change ownership/rename during partial apply, then introduce a new consumer. Compare an evolved implementation with a direct implementation of the same final target. Require equivalent intended behavior, correct ownership, no prohibited structural residue, and a settled no-op. Exact source equality is not required.

Qualify the evaluator itself with seeded bad candidates: hidden new consumer, invented justification, duplicated old/new route, unused framework/dependency, and a no-op cache that ignores changed inputs. It must reject those for the intended reasons before a passing generated candidate counts as evidence.

Run only the three paired hosted trials initially, using the authorized host/model and explicit per-run ceilings established from available quota controls. These are at most six participant runs, not an expanding benchmark campaign. If the host exposes no enforceable token ceiling, use bounded task/context/time limits and report actual usage; never invent a quota percentage. Do not spend separate API credits without authorization. Repeat only affected failed cases after repair. Any unrun hosted or platform qualification remains marked unverified, not “all tests pass.” This is bounded evidence of repeated clean outcomes, not a statistical claim of universal reliability.

## 13. Build sequence and restrained adaptation

### Milestone 0: qualify only decision-changing seams

Inspect current repo/branch state; installed Node/OpenSpec/Codex/plugin versions; actual MCP/hook shapes; the supported OS and filesystem; the archive/stock-skill guard extension seam. Run tiny non-product probes for shared endpoint ownership, SQLite worker access, one managed-write/read interleaving, and custom nested artifact discovery/merge behavior. Do not inspect all V3 or install a new daemon.

Write a short amendments section **only for a real finding changing H1**: observation, affected choice, minimal revision, impacted later milestones, evidence. A successful probe needs one result line, not another design essay. Correct technical choices and proceed autonomously within the non-negotiables. Escalate only a changed guarantee, unsupported required experience, external mutation/cost permission, or genuinely pivotal product choice. No speculative list of everything the agent might someday want to reconsider.

### Milestone 1: documents and one exact revision query

Build typed contracts, Markdown/delta parser, reference resolver, file inventory and basic SQLite index, a CLI exact-revision read, and tests T1/T3/T7. Prove nested design readability with one real example. Keep semantic unknowns explicit. This should already produce useful diagnostics without a model-backed runtime.

### Milestone 2: shared incremental kernel

Add relay/startup, per-root sessions, generation checks, shared extraction, query populations and supported managed observation; pass T2/T4/T5/T8. Do not optimize with per-expression graphs. Verify root independence and cheap warm reads before increasing feature surface.

### Milestone 3: complete change loop

Implement the OpenSpec adapter, target views, editable plan reconciliation, contribution/discovery/evidence gates, previous footprint, coherent finish and crash resume. Pass T6 and an installed two-client T9. If the companion plugin seam requires a patch, validate the exact installed combination, not only source-level calls.

### Milestone 4: clean-evolution evidence and delivery

Finish the coupled fixture, seed bad outcomes, run the bounded hosted trials, repair actual failures, and repeat the relevant evidence. Deliver the usable plugin, source, succinct usage guide, reproducible verification commands, operation counts and limits. Remove scaffolding not needed by the product. No additional engine, viewer, analytics service or general workflow scheduler.

Parallel work is optional after interfaces settle: independent parser/resolver tests and host/transport probes may proceed separately. Each delegate gets one coherent responsibility, named interface, explicit write scope and acceptance evidence. The parent owns integration. Never split tightly coupled revisions just to use more agents, and do not have each worker reanalyze the entire architecture.

## 14. Definition of done and honest handoff back

“Implemented” requires the installed end-to-end loop, deterministic cost/race tests, reference/design-delta behavior, actual missing-coverage blocking, preservation of previous design support, and correct revision/currentness separation. “Qualified for routine use” additionally requires the actual supported host integration and bounded hosted clean-evolution trials. A static checker alone, attractive demo, or README claiming the loop exists is not sufficient.

Report the exact installed version, tested platform/profile, commands/results, counter-based resource evidence, model trials and spend exposed by the host, and remaining limitations. Separate technical conformance from economic benefit on a large real project. No general performance superiority has yet been measured.

Keep a short resumable implementation record if work is interrupted: current commit, completed evidence, next executable action, concrete blocker. Do not replace implementation with a comprehensive new roadmap or declare completion after planning. Do not broaden the task to rescuing Psychord.

## 15. Primary-source anchors and what was actually verified

These anchors support narrow tool premises, not the proposed product's correctness. The design above includes their relevant consequences; following every link is not an implementation prerequisite.

- Projector state inspected at `5c7e083db63e9b349526f202c1d97b011b4038e1`, running spec 0.10. No V4 runtime exists in that tree: `.gitignore` and design records only. The append-only capture is a provenance source, not a required model-context payload.
- `OnePersonLabs/onepersonlabs-plugins` inspected at `071055f1229cfcc76bb0248036596a85b28e7a50`. `plugins/opl-openspec/README.md` documents nested capability paths and external tracker ownership; hooks retain archive/skill discipline. Do not assume an unmodified advisory hook can replace apply.
- OpenAI hooks: https://developers.openai.com/codex/hooks . Tool-hook coverage is not a complete enforcement boundary. Missing or bypassed signals cannot be the basis of an unconditional current-state claim.
- OpenAI MCP: https://developers.openai.com/codex/mcp . Use actual configured transports and host capabilities; do not invent host APIs from this proposal.
- MCP stdio: https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/transports/stdio.mdx . Client-launched processes motivate relays; pin a protocol supported by the actual client/SDK, not merely the newest published revision.
- SQLite: https://www.sqlite.org/wal.html . Snapshot transactions do not validate source freshness. Bound writer, reader and checkpoint costs.
- Node SQLite: https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html . Verify the chosen patch/API; synchronous work belongs off the response loop.
- Watchman synchronization: https://facebook.github.io/watchman/docs/cookies . Generic watcher quiet time is not a portable barrier proof.
- Git publication: https://git-scm.com/docs/git-update-ref . Expected-old-ref updates support guarded single-ref publication; they do not atomically update a working directory or external service.
- OpenSpec merge/task contracts: https://github.com/Fission-AI/OpenSpec/blob/634c557bd0470eec37861b46172c3f503d283c1b/src/utils/spec-discovery.ts and https://github.com/Fission-AI/OpenSpec/blob/634c557bd0470eec37861b46172c3f503d283c1b/src/utils/task-progress.ts . Nested `spec.md` discovery and indented task counting do not supply design-delta or orchestration semantics.

**End state sought:** a small truthful tool that makes justified changes cheap and obsolete complexity removable, not another layer that needs its own rescue project.