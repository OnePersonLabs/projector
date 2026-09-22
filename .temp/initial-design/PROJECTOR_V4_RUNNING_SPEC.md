# Projector V4: running specification

**Revision 0.8.** Current conception through user event **U010** and assistant response **A008**. Incomplete design, not an instruction to implement a finished system.

## 1. Authority, preservation, and approval

Michael's requirements and choices govern this design. The sibling `PROJECTOR_V4_INITIAL_CAPTURE.md` preserves the attributed conversation; this file is its self-contained current-state snapshot. Update both on `OnePersonLabs/projector`, branch `v4`, under `.temp/initial-design/`, after each substantive response. Read current branch state, preserve concurrent work, append rather than rewrite prior capture, and preferably publish both files in one commit. Keep useful assistant proposals by default, but distinguish them from user direction until explicitly or unambiguously implicitly approved. Cleaning up prose is not permission to add requirements. A skim, silence, or agreement with one point is not blanket acceptance.

Approval ledger:
- **U001-U006:** user direction and proposals as qualified below. U005 establishes one `[[...]]` reference notation. U006's new default-resolution proposal supersedes its conflicting earlier import-local rule upon U007 approval.
- **U007:** explicitly approves the previous three completed responses, A004-A006. This includes P14-P18, the candidate part/evidence matrix as presented, the single-reference convention, and A006's global default/normalization/population/rebinding refinements. An illustrative syntax remains illustrative; approval is not a claim that exact part schema or language support is implemented.
- **U008-U009:** require previous-design implementation-footprint recovery, clean reconstruction after add/modify/remove/refactor, and aggressively minimal compute, I/O, churn, and token costs.
- **U010:** explicitly approves A007, including its mechanisms, assumptions, clean-convergence/idempotence distinction, efficiency-first pipeline, and remaining-hole assessment. Approval does not solve those holes or prove performance bounds. U010 also proposes an outside-repository map and an MCP/concurrency approach for evaluation.
- **A008 / P19-P25:** new refinements below remain provisional. Earlier P1-P13 are not blanket-approved except where an approved later statement adopts or supersedes their content. Source-derived facts are precedents, not product authority.

V4 is a blank slate. V3 is reference material with no automatic inheritance of schemas, terminology, orchestration, or obligations. The `v4` tree starts from the V3 parent history but contains only the copied `.gitignore` and these design records. `.temp/initial-design/` is deliberately tracked while other temporary output stays ignored. Do not change main/V3 or build runtime machinery merely to maintain this conversation. The documentation capture is not a mandate for a product event-store subsystem. Its replay should recover the conception faithfully, not promise byte-identical natural-language synthesis.

The user's phrase **The Slop Attractor / MichaelsBane** describes dangerous skimming; it is not another required subsystem.

## 2. Product boundary and OpenSpec

**User direction U001, U003-U004; approved A004/A007 refinements.**

Projector is symbiotic with an already initialized OpenSpec project. OpenSpec owns requirements. Assume its latest version is sufficient, including nested specs. Observe added, modified, and removed requirements in **live specs**, not requirement proposals in `changes/`. Draft deltas can explain an intentional transition without becoming accepted live meaning automatically.

Projector maintains resolvable references, requirement-justified designs, dependency-aware reevaluation, complete economical refactors, design-to-implementation accountability, and clean contraction when reasons for implementation disappear. The rest of the generation/execution experience remains under elaboration.

Concern-aligned contracts, encapsulation, progressive disclosure, human understanding, and total work economics are the motivation. Hierarchies organize responsibility; explicit cross-cutting relationships organize consequences. No one-package/file/entity-per-term rule follows.

**Designs reference and justify implementation. Source code must not be required to reference designs.** Projector must remain non-dominating and replaceable. No required source annotations, decorators, plugin imports, IDs, or code-to-design registry. Optional conceptual references in source comments remain supported; they are not mandatory coverage tags. Approved P14 permits a disposable reverse index for diagnostics. Its removability test is that removing Projector and its explicit checking/hook integration leaves ordinary source, builds, and tests usable without rewriting production code. Removing a checker does not preserve its enforcement.

## 3. Terms and exact references

**U001/U003/U005; global defaults from U006/A006 approved by U007.**

All term references use `[[...]]`. Examples:

```text
[[Term Name]]
[[term_name]]
[[SomeType]]
[[somepackage.SomeType]]
```

An eligible Markdown document defines a conceptual term with its leading `# <term>` heading. Eligibility is limited by a still-undecided path/pattern convention; arbitrary Markdown headings are not automatically definitions. A logical code symbol can supply a default term definition. The architecture should be language-agnostic; supported languages and adapters are not yet selected. `@Tag` was mentioned, but its semantics are open.

### Approved default ownership

Normalize bare lookup names by case folding and removing spaces and underscores. Preserve other punctuation unless a later rule says otherwise. This is formatting normalization, not fuzzy matching or changes to program identifiers. Thus `[[Some Type]]`, `[[SomeType]]`, `[[some type]]`, and `[[some_type]]` share a lookup key.

| Eligible Markdown definitions | Distinct referenceable code symbols | Bare-reference result |
| --- | --- | --- |
| One | Any number | Markdown term owns the default |
| None | One | That code symbol, regardless of its namespace |
| None | More than one | Ambiguity error; qualify the reference |
| None | None | Unresolved reference; live-design drift |
| More than one | Any number | Duplicate term-definition error; no fallback |

An explicit qualified code reference bypasses Markdown default ownership, but not applicable code/import boundary policy. Qualified language references retain actual symbol semantics and punctuation. Namespace support for separately authored conceptual terms is not selected; the user originally leans against it. Qualified code paths and subreferences remain possible independently of that question.

**Global default meaning replaces import-local selection for bare references.** A source comment's import cannot silently pick one of several global candidates or override a Markdown owner. Source-language imports themselves are unaffected. Location still matters for boundary eligibility and constructing a legal qualification. Unqualified/qualified references can point to the same symbol when no Markdown owner intervenes.

Count logical referenceable project declarations, not every local variable/member short name or all installed-library symbols. Members are available through subreferences. Deduplicate aliases/imports/re-exports only where actual language resolution proves the same logical target. Legitimate same-named declarations are not errors: only ambiguous bare references are. Exact candidate eligibility, external-library participation, unsupported languages, and completeness reporting remain open. Never infer global uniqueness from an incomplete population.

Adding/removing a Markdown owner, a colliding code symbol, or a renamed definition invalidates affected saved name bindings. Do not silently redirect prior code references to new Markdown meaning or silently fall back after a Markdown definition disappears. A reviewed batch may intentionally adopt the new owner or qualify references preserving the previous target. No separate mandatory human approval per reference is implied. Update normalized name-to-owner/candidate and reverse-use indexes for affected keys, including absence and candidate membership.

Duplicate explicit definitions have typecheck-level error visibility. Offer an autofix to a fully qualified code reference only when exactly one legal target is available from the relevant context; zero/multiple candidates or boundary violations do not permit guessing. Exact autofix application policy is open. Existing boundary tools such as Nx/dependency-cruiser are possible inputs, not selected dependencies or a second policy authority.

### Subreferences and live truth

U003 requires exact targeting inside things: a code property/member, a design part, or a nested Markdown heading path. Familiar provisional P9 examples are:

```text
[[Player Evidence#Origin#System events]]
[[SomeClass.someProperty]]
[[Playback Design#<part-id>]]
```

These do not establish a final cross-language grammar. TypeDoc's instance-member `#` is an alternative disambiguation; Markdown heading paths have an Obsidian precedent. Escaping, duplicate headings, overloads, stable part identity versus path, and precise qualified syntax are open. A referenced part may depend on its enclosing contract, not just its own text.

Undefined vocabulary can exist during ideation. **U002 requires an undefined reference in a live design to count as code drift.** Live designs, like live specs, are expected to be true except while implementing a design delta. Draft/live representation and the allowed temporary mismatch policy remain open. Proposed P7 associates expected inconsistencies with their actual implementing delta rather than treating any open delta as a universal exemption. A diagnostic does not determine the intended repair.

## 4. Nested designs, decisions, and evidence

**U001-U004; P14-P18 approved by U007.**

Nested subdesigns and progressive disclosure are fundamental, not an optional viewer. Architectural decisions belong at the design/subdesign level owning the responsibility. A parent explains its concern, outward promises, and delegated responsibilities; a child contains internal decisions. Readers should not need every child's internals to understand the parent. Nest by concern, not automatically by folders, classes, or artifact categories.

Applicable parent obligations remain available by reference instead of duplicated prose. They are not all universally inherited, and children cannot silently weaken governing contracts. Cross-cutting constraints/dependencies remain explicit links; containment is not the entire dependency graph. A child change does not automatically invalidate all ancestors/siblings: follow relied-on promises, design parts, and composition facts, including relevant child membership. Do not make every parent's identity a hash of all descendant detail. Changed outward guarantees affect their actual users.

Each design names requirements and concisely justifies satisfaction:
- **Primary:** requirements explaining why the design exists.
- **Secondary/applicable:** requirements constraining it through scope, behavior, dependencies, or other applicability criteria. Secondary is not optional.

A design retains a reasonably minimal coherent solution surface. A new requirement may justify a different implementation, not merely another patch. Reevaluation can also preserve a still-justified design.

### Approved candidate structure, not frozen grammar

The accepted candidate content roles from P16 are **Contract, Decisions, Realization, Subdesigns**. They do not imply four files or mandatory boilerplate everywhere. Parts can have formal, lintable child structures, expected lists, or headings, analogously disciplined to specs without copying their GIVEN/WHEN/THEN keywords.

A Decision is a compact argument: under these requirements and conditions, choose this approach rather than a credible alternative, for these reasons, yielding these implementation consequences, supported by this evidence. Record why the implementation has its shape, not a post-hoc story legitimizing arbitrary code. Candidate subparts include requirement basis, choice, rationale, material alternatives, realization, evidence, and reopening conditions. A Decision is a candidate addressable delta/invalidation part. Exact taxonomy, header grammar, file layout, inheritance mechanics, and delta schema remain open.

Illustrative syntax with invented targets, not an implemented schema or measured result:

```markdown
## Decision: retain the prepared preview
Requires: [[Preview#Immediate replay]]
Choice: Keep the decoded buffer until replacement or closure.
Alternative: Regenerate on each replay.
Reason: Avoid regeneration during replay; retain one buffer instead.
Realizes: [[PreviewPlayer.replay]]
Evidence: [[PreviewTests.reusesPreparedBuffer]]; pending execution.
Evidence: Replay-latency measurement; not yet available.
Reopen: Replay timing or buffer-lifetime requirements change.
```

### Criteria-driven evidence

U004 requests criteria or a matrix determining evidence needed to justify a distinct artifact or modification. P17's approved starting matrix:

| Trigger | Design evidence/content |
| --- | --- |
| Internal work already explained by an accepted decision | Bind the artifact/change to that decision, reuse current relevant evidence, run affected checks; no fabricated alternatives |
| New owner, boundary, dependency, abstraction, or significant strategy | Motivating requirements/criteria, chosen shape versus the strongest credible simpler alternative, including not adding structure where viable, and the consequential tradeoff |
| Choice relying on empirical/failure-sensitive claims | Discriminating test, measurement, trace, or review, with conditions and actual outcome or an explicit evidence gap |

Triggers can combine. They are not objective numeric rankings, exclusive risk tiers, or a mandatory essay ladder. Criteria select the evidence burden, not an automatic architectural winner. Exact materiality thresholds, mandatory proof kinds, and exceptions remain open. A reuse test is not proof of measured latency.

Linting can check part shape, matrix-required fields, references, evidence/exclusion conflicts, coverage, and evidence currentness. Actual checks and reviewed reasoning establish their observed claims; links and hashes alone do not establish semantic truth or reviewer independence. Dependence can include cited requirements, decision/criteria, implementation, and relevant checker/environment versions. Keep rationale human-readable; do not automatically hide it in comments or expose raw bookkeeping.

P18 connects decisions to retirement: withdrawing the motivating requirement reopens its choice and structural consequences, not only the reference. Retain machinery justified by other current needs, and simplify what no longer earns its place. This supplies a place for current reasons, but does not by itself solve semantic applicability or prove conformance.

## 5. Deltas and planned repair

**U002, with approved A007 scope/economics.**

Design deltas are analogous to spec deltas: add, remove, or modify design parts. Exact part granularity, schema, directory placement, relation to OpenSpec changes, live-update timing, and completion procedure remain open. No whole-file patch format or new backlog authority is selected. The temporary dependency work view is not automatically a persistent task tracker.

Drift repair is a **fully planned, reviewed, then executed unit of work**. A detected mismatch is not permission for a widening improvised repair campaign. Skipping human review does not skip planning or review. Planning the bounded repair does not mean planning the entire product. The relation among repair plan, design delta, and dirty-design batch is still open.

A candidate policy allows human review to be skipped when reasonable criteria establish no plausible material risk or pivotal ambiguity. Consider both interpretation and implementation: which meaning is intended, and which of multiple consequential repair paths to choose. Escalation can go to a parent/root agent, a more capable/higher-effort subagent chosen by its parent, or the user. These are alternatives, not a mandatory ladder or fixed model configuration. Exact authority, independence, criteria, unavailable escalation, and plan invalidation remain open.

P7/P8 refinements remain provisional except where adopted into subsequent approved rules: a missing reference can mean an incomplete rename, removed definition, wrong binding, or missing implementation. Do not invent definitions or weaken meaning just to clear it. Consequential uncertainty, not changed-line count, should determine escalation. More capable reasoning does not itself grant authority to change the user's product intention. Review requires grounds beyond implementer confidence.

## 6. Dependency-aware invalidation and refactoring

**U001/U003; A007 approved by U010.**

A live requirement edit invalidates designs depending on it; changes to depended-on designs affect relevant dependents. Accumulate invalidation reasons and process a settled causal batch, not one full repair per save. A proposed dirty flag denotes required reevaluation, not the right repair or permission to change meaning. Exact representation remains open.

New requirements and broadened scopes require applicability discovery: existing reverse references cannot discover edges that do not yet exist. Removing a requirement reopens surviving justification rather than automatically deleting its whole design. Changes to name candidates, query definitions/populations, including empty queries, must be observable. Supported discovery does not make arbitrary semantic inference complete.

Process prerequisites before dependents. In a diamond where C depends on dirty A and B, settle A/B before reevaluating C once for the resulting inputs. Group mechanical fixes among ready work; grouping must not bypass dependencies. Deterministic transformations, cheap classifiers, and stronger agents are options selected by necessary work, not a fixed routing engine. An unchanged dependency-relevant guarantee can stop propagation only with adequate evidence; prose similarity is not enough. Independently changed requirements still require review.

Detect and complete refactors of terms, symbols/types, packages, specs, nested spec paths, and renamed path segments. Hooks are possible integration points. Combine applicable changes so an affected file is updated once per settled refactor pass, without unrelated formatting. Approved current-state/causal processing does not mean every save is an atomic final batch.

Provisional P5 technique: resolve original bindings, collect renames/moves, group by file, then construct the final edit. Sequential `A -> B` and `B -> C` text replacement must not turn an original A binding into C. Recognize logical identity only with evidence; public names/paths may themselves be contracts. Collisions, swaps, concurrency, rename versus delete/add inference, cycles, and newly arriving changes require defined handling. Updating derived dirty metadata must not recursively count as changed product meaning.

## 7. Justified implementation and clean contraction

**U003-U004/U008; A007 approved by U010.**

Report unjustified code in the same context as typecheck diagnostics. Required evidence/bindings live in designs, never compulsory source tags. Derived reverse indexes can find a code unit's design owner. Population observation must also find newly created unbound artifacts; enumerating only existing bindings is insufficient. Inherited concern ownership can cover internal helpers without one miniature design per function, but cannot make a broad glob blanket permission for arbitrary behavior. Exact granularity and conformance witnesses remain open.

A current ownership link, current evidence, and actual behavior conformance are distinct. Mechanical checks detect missing/broken ownership, boundary violations, and stale required evidence; appropriate contract checks/review assess substantive justification. Unchanged verified meaning must not cause repeated model calls on every typecheck.

When a design/subdesign/part changes or disappears, retain and illuminate artifacts its **previous** accepted state wholly or partly justified. This footprint is an impact seed, not a preservation list. Determine what to cut, rewrite, refactor, retain under other live reasons, and add. Pre-existing code has no authority merely by existing. Do not build compatibility bridges or duplicate paths just to avoid challenging inherited implementation.

The approved properties are:
- **History-independent convergence / clean-reconstruction equivalence:** comparable accepted design endpoints should yield materially equivalent clean justified implementation shapes, rather than accumulating the accidental layers of their edit histories. This allows multiple clean realizations, legitimate later improvements, and surviving compatibility/state obligations, not byte-identical output or historical Git reversal.
- **Reconciliation idempotence:** once settled, another reconciliation proposes no substantive change.

Removing a requirement should simplify the implementation toward the shape it would have had without that requirement. Shared/conditional reasons still count. Merely deleting orphan code does not remove a no-longer-justified framework, abstraction, or storage strategy. Reopen decisions themselves. Raw reference counts and cycles with no live justification root must not preserve obsolete structure.

Approved footprint direction: derive/cache total and partial implementation coverage from design-side realizations, structure, decisions, and dependencies; retain enough old basis to calculate lost/gained/changed justification before discarding it. This is not an approved support algebra, universal compiler, or guarantee of complete discovery.

Use deterministic residue/dependency/reference/coverage checks, focused contract tests, selective clean-counterfactual comparisons where they justify their cost, and a settled no-op check. A fresh candidate is evidence, not automatic authority. Test representative add/modify/remove/refactor histories, including competing clean and residue-laden realizations. The bar is demonstrated behavior and structural cleanliness, not an agent's completion claim. A practical equivalence oracle and simplification stopping criterion remain unresolved.

## 8. Work economics govern the architecture

**U003/U009; all A007 proposals approved by U010.**

Every mechanism must justify local compute, filesystem work, latency, memory, retained storage, and AI tokens. Cleverly minimal overhead is a first-order design constraint, not later polish. Normal operation exploits known workflow causes; mystery drift is explicit recovery, not the default cost model.

Presumptive red flags include repeated broad sweeps, repeated parsing/hashing of known-unchanged inputs, model calls over unchanged meaning, per-event recomputation, full-document invalidation where relevant stable parts suffice, and read/edit/read/edit processing where one composed pass would do. Cold start, explicit observation recovery, or genuinely global changes can justify broad work; measure and bound it rather than disguise it as incremental.

Approved pipeline:

```text
known causal changes
  -> coalesce batch
  -> indexed affected dependencies
  -> old/new justification difference
  -> dependency-ordered decisions
  -> final affected artifacts
  -> one net mutation pass
  -> focused evidence
```

Aim for necessary delta plus actual affected-closure work, not event count times repository size. Maintain only bookkeeping that saves more than it costs. Cancel/supersede intermediate work where sound; do not erase durable/external effects merely because input text reverts. Preserve valid unaffected work and prune reliably unchanged outward guarantees. Actual input/output, global obligations, discovery-index upkeep, cold start, and recovery still cost work; no universal sublinear bound or mathematically optimal algorithm is claimed. Cache correctness needs all material invalidators, while overcapturing recreates the cost problem.

Minimum immediate edits and minimum lasting complexity are not identical. Avoiding churn must not sanctify unnecessary architecture; clean reconstruction must not authorize unrelated beautification. Finish once the changed scope meets current justification/contracts and the evidence bar.

## 9. External map and concurrent operation: new user proposal

**U010 proposal for evaluation, not a selected storage/process implementation.**

Consider a plugin-owned artifact/code <-> design <-> live-spec map outside the repository, hidden from ordinary viewing, scoped per filesystem repository root. Tree-sitter and an MCP server are candidate mechanisms. The initial reader/writer sketch permits Codex to keep editing while one exclusive map builder/repairer runs, suppresses duplicate builders, debounces lazy background work, and forces currentness before serving reads that need dirty map data. The user explicitly asks for a finer-grained, asynchronous alternative to one whole-map dirty flag/lock, avoiding stale data and editing stalls while minimizing all overhead.

**A008 recommendation, P19-P25, remains provisional:** one coordinator per root, versioned atomic publication, and dependency-specific freshness barriers. More locks are not the goal. The design below refines the sketch; it is not an implemented MCP, daemon, database, or measured performance result.

### P19. Outside-repository state without outside-repository authority

Use a stable plugin-owned per-user location outside repository and versioned plugin-installation paths, e.g. `<user-cache>/projector/repos/<root-key>/`. Namespace mutable state by canonical physical checkout root with repository/worktree identity verification. A branch or remote URL is not enough; two worktrees/clones are separate roots. Branch switches advance/invalidate observations. Replacement at the same path must not inherit an unrelated map; root moves may reattach only with established identity or explicitly rebuild.

Keep authored specs/designs/justifications portable in the repository. Derived indexes must be rebuildable and bounded, inspectable through a small explicit diagnostic interface, and removable with the tool. Hide bookkeeping, not explanations. Store local data privately and do not share a mutable SQLite/WAL database across hosts or Windows/WSL runtimes without a single safe owner.

Preserve/pin old design inputs and footprint bases while an active delta/recovery needs them. Committed bases can be retrieved from Git; uncommitted preimages require explicit retention. Cache loss without a recoverable old basis is a gap, not proof of zero prior ownership. Clearing or evicting cache must not silently erase the sole unfinished-transition evidence.

### P20. Parser and process lifetime

Tree-sitter is an embeddable incremental syntax parser, not a watcher daemon. Keep useful syntax trees in the coordinator if memory/cost justifies it; code-symbol resolution, policy, and semantic applicability need additional support. Parsing alone is not semantic verification.

MCP is the host-facing transport/lifetime option, not a guarantee of one shared persistent process across sessions. Multiple stdio clients can launch multiple servers. Proposed topology: thin MCP/CLI/hook clients attach to one per-root coordinator with a local IPC endpoint and OS-backed exclusive ownership. Losing startups join instead of creating duplicate indexers or killing arbitrary processes. Avoid PID-file/TTL-only ownership; use an incarnation check so retired-worker results cannot publish.

A first host process or an on-demand service can own the coordinator; no mandatory installed daemon is selected. Idle shutdown is permitted. On takeover, reestablish observation rather than assuming cached data remained current. Root-scoped sockets/named pipes are options; chosen HTTP transport needs appropriate access control. Use the same indexing/publication code for recovery rather than an independent fallback engine.

Hooks should record/acknowledge cheap invalidation and enqueue work, not manage long processes, scan a repository, or call models. Direct hooks to an existing MCP connection can avoid an edit-by-edit process spawn where supported. A missing connection needs honest recovery, not assumed delivery.

### P21. Single publication writer and snapshot readers

Do not hold a global reader/writer exclusion lock across parsing or rebuilding. Capture immutable inputs, perform bounded deterministic extraction outside the publication transaction, and briefly commit consistent updated records/forward/reverse links/membership changes atomically. A reader sees one valid published snapshot, not mixed generations of related records.

Track dirty input/part/query generations and coalesce duplicate jobs by their required versions. Readers needing the same repair share a job. Bounded workers may parallelize independent extraction, while one coordinator/publisher arbitrates publication. Revalidate all job input/dependency versions before committing. Old completion cannot clear newer dirtiness; keep unrelated valid work when one input races.

SQLite WAL is a candidate baseline for transactional snapshot reads with one short writer, not yet a selected dependency. It solves database atomicity, not filesystem freshness. Bound snapshot retention, WAL growth/checkpoint costs, memory, disk, and speculative work. Prefer generations/shared job promises to a lock per symbol or a custom distributed-lock framework.

### P22. Immediate invalidation, deferred computation, demand-driven reads

Managed writes register their expected affected scopes before mutating, then report actual completed changes/versions or an observation gap. Invalidation is immediate; only expensive maintenance is debounced. Multi-file edits that form one logical transition must not appear as a falsely settled half-state. Other scopes and ordinary editing remain free to proceed.

A current query first establishes an observation boundary for relevant completed/in-flight mutations. It refreshes required discovery indexes before trusting an old dependency closure, including default-name candidates, applicability criteria, absence/uniqueness, and selector membership. If its relevant closure is current, return a consistent snapshot without waiting for unrelated dirtiness. Otherwise bypass debounce only for the ready work it needs, prioritize/join that work, and wait for valid publication.

Stamp results with a snapshot/dependency generation and the observation boundary. Revalidate those relied-on inputs before managed plan application, using guarded/CAS-style writes or scoped cooperative exclusion where necessary. A returned answer is not timeless authority. Historical snapshots can be requested explicitly but must not masquerade as current decisions.

Bound waits/retries; return a clear in-progress/unavailable result rather than stale fallback. Do not wait for the whole repository to become idle or restart all extraction after each new edit. Preserve valid results, process declared settled batches, and give waiting queries priority. Necessary reprocessing of actually changed inputs is allowed; repeated work on unchanged inputs needs justification.

### P23. Fresh map is not repaired product

Map freshness, extraction/coverage completeness, design conformance/drift, and active transition state are distinct. A current map may correctly report undefined references, unjustified code, or dirty designs. Refreshing it must not implicitly redesign code, approve meaning, or wait for an agent to repair every semantic issue.

Routine indexing/reverse-map maintenance makes **zero model calls**. Structural/resolution unknowns are exposed; semantic interpretation and code repair remain in the approved planned/reviewed workflow. Do not turn 'bring the index current' into 'make the project correct before answering'.

### P24. Freshness requires ordering, not merely notification

An asynchronous watcher may report a write after a read starts. No queued notification is not proof that no edit occurred. Git hooks are not complete working-tree observation; MCP transports requests rather than interposing on all writes. Current Codex docs state missing/failed MCP hooks need not block tools and some tool paths can bypass hooks.

For managed work, use prewrite registration/completion and a reliable read barrier. For unobserved intervals, watcher overflow, restart, unknown write scope, unsupported constructs, root or policy changes, mark affected observation coverage unknown and reconcile it. Use reliable change cursors/journals or scoped revalidation when available. If a lost interval cannot be bounded, a complete inventory may be necessary; it is a justified recovery cost, not a hidden per-read sweep. Debounce quiet time and mtime alone do not prove freshness.

New members matter: a second code symbol can invalidate a bare name; a new Markdown owner can rebind it; an empty query can gain a member. Track changing name/query populations, not just old hit hashes. Update relevant partitions incrementally. Parser/resolver/inventory/boundary-rule changes invalidate what they actually govern.

A response is current through its declared observation boundary. Guaranteeing that no later independent writer invalidates it requires cooperative write exclusion or immutable source snapshots. A simple check-then-write against arbitrary noncooperating edits is not atomic. State host/writer guarantees honestly; unknown observation cannot be labeled clean. This does not require sweeping mystery-drift analysis during every managed operation.

### P25. Deterministic performance and race tests

Use controlled interleavings and operation counters without routine model calls. Required candidate exercises: burst edits coalesce; many readers share one repair; unrelated reads stay unblocked; stale jobs cannot overwrite newer results; duplicate processes yield one publisher; owner crash preserves atomic visibility and triggers observation recovery; new name/query members invalidate old answers; multi-file rename/deletion preserves the old footprint and avoids false settled states; missed hooks/overflow cannot return silently current data; repeated settled queries avoid parsing/scanning/AI work.

Measure bytes read/hashed/parsed, dependency/query partitions visited, publications, waiter delays, process starts, memory, retained disk, and initialization/recovery costs. Test real workloads later for latency and net value. Bounded background work, idle policy, and database maintenance also have to earn their cost. These tests are proposed acceptance evidence, not results already achieved.

## 10. Remaining design frontier

The following problems are acknowledged, not resolved by approval:
1. **Hidden ownership:** cheaply find affected implementation missing from prior bindings, without source annotations or repeated semantic sweeps.
2. **New applicability:** discover brand-new or broadened obligations and new consumers before existing links can name them.
3. **Cleanliness oracle:** evaluate clean-reconstruction equivalence without regenerating entire subsystems on every change.
4. **Part granularity and identity:** achieve narrow invalidation without atomizing the repo into expensive bureaucracy; handle refactors and scope.
5. **Sound cache dependencies:** capture enough to avoid silent wrongness without universal invalidation.
6. **Simplification stop:** remove causal residue without endless unrelated restructuring.

A008 adds a concrete engineering frontier: cheap host-specific observation barriers and multi-client lifetime, with bounded overhead and honest guarantees for noncooperating writes. Snapshots solve publication consistency but not missing observation or semantic applicability.

Other undecided mechanics remain: term-definition scope, namespaces, candidate eligibility and language set, tag/query grammar, subreference/part escaping and identity, stable requirement addressing, design locations/parts/deltas, cycles, dirty-state serialization, concurrency/refactor conflicts, review/escalation criteria, completion evidence, parser/database/service choices, and the rest of the implementation-generation loop. Do not fill them with V3 machinery automatically.

## 11. Source precedents and limits

These are explanatory references, not dependencies or V4 authority. The required ideas are described in this snapshot; external access is not needed to understand its design. No cited tool was installed or benchmarked as part of this update.

- **Bazel Skyframe:** dependency tracking and unchanged-value pruning are incremental-evaluation precedents, not proofs of prose equivalence or complete discovery. https://bazel.build/versions/8.6.0/reference/skyframe
- **Nx boundaries:** project-tag constraints can inform permitted references; they do not implement Markdown resolution. https://nx.dev/docs/features/enforce-module-boundaries
- **Obsidian / TypeDoc / ESLint:** nested heading links, language-aware declaration/member links, and CSS-like structural AST queries respectively inform optional syntax. Exact references identify one thing; provisional selectors identify bounded changing sets. Full CSS cascade, ambiguous multi-target exact links, and universal semantic selectors are not selected. https://help.obsidian.md/links ; https://typedoc.org/documents/Declaration_References.html ; https://eslint.org/docs/latest/extend/selectors
- **wrtnlabs/evidence**, inspected at `9b5bfdd7f7affed0c27bd74cd2f425ac008fd25e`: `@evidence <target> <reason>`, justified exclusions, scoped claim/reference populations, structural ancestry, and separate fingerprint-current review are useful precedents. Its documented model permits Markdown claims targeting code, despite code-comment examples. Markdown structural headings are not V4 typed parts. Standalone file-qualified references do not implement imported-symbol resolution. A checker cannot establish prose truth or reviewer identity. Borrow concise reasons/scoped coverage/currentness selectively; do not inherit all-functions-by-all-rules cross products, hidden rationale, manual hashes, mandatory source tags, or promotional performance claims. https://github.com/wrtnlabs/evidence/blob/9b5bfdd7f7affed0c27bd74cd2f425ac008fd25e/.agents/skills/project/evidence/SKILL.md
- **A008 primary research, 2026-09-22:** Tree-sitter is embeddable incremental parsing; Codex supports local stdio and Streamable HTTP MCP; MCP connection lifetime is not a shared service lifecycle; Codex MCP hooks are synchronous calls to existing connections and may fail non-blockingly; SQLite WAL provides snapshot isolation/concurrent readers and a single writer but has local-filesystem/checkpoint constraints; Node watcher events have platform/replacement/filename limitations; Watchman's synchronization cookies and recrawl are useful but platform-qualified precedents, not universal freshness proof. https://tree-sitter.github.io/tree-sitter/ ; https://developers.openai.com/codex/mcp ; https://learn.chatgpt.com/docs/hooks ; https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle ; https://www.sqlite.org/isolation.html ; https://www.sqlite.org/wal.html ; https://nodejs.org/api/fs.html ; https://facebook.github.io/watchman/docs/cookies ; https://facebook.github.io/watchman/docs/troubleshooting

**Current state:** A007 is approved by U010. The outside-repository map is the new user proposal; P19-P25 are assistant-provisional refinements. No V4 runtime, watcher/coordinator, conformance proof, or performance result is implemented by these records.
