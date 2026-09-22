# Projector V4: running specification

**Revision 0.12.** Current conception through user event **U014** and assistant response **A012**. Implementation handoff H1 is packaged for execution on V4 `main`; no runtime result is implied.

## 1. Authority, preservation, and approval

Michael's requirements and choices govern this design. The sibling `PROJECTOR_V4_INITIAL_CAPTURE.md` preserves the attributed conversation; this file is its self-contained current-state snapshot. Update both on `OnePersonLabs/projector`, branch `main`, under `.temp/handoff/`, after each substantive response. Read current branch state, preserve concurrent work, append rather than rewrite prior capture, and preferably publish both files in one commit. Keep useful assistant proposals by default, but distinguish them from user direction until explicitly or unambiguously implicitly approved. Cleaning up prose is not permission to add requirements. A skim, silence, or agreement with one point is not blanket acceptance.

Approval ledger:
- **U001-U006:** user direction and proposals as qualified below. U005 establishes one `[[...]]` reference notation. U006's new default-resolution proposal supersedes its conflicting earlier import-local rule upon U007 approval.
- **U007:** explicitly approves the previous three completed responses, A004-A006. This includes P14-P18, the candidate part/evidence matrix as presented, the single-reference convention, and A006's global default/normalization/population/rebinding refinements. An illustrative syntax remains illustrative; approval is not a claim that exact part schema or language support is implemented.
- **U008-U009:** require previous-design implementation-footprint recovery, clean reconstruction after add/modify/remove/refactor, and aggressively minimal compute, I/O, churn, and token costs.
- **U010:** explicitly approves A007, including its mechanisms, assumptions, clean-convergence/idempotence distinction, efficiency-first pipeline, and remaining-hole assessment. Approval does not solve those holes or prove performance bounds. U010 also proposes an outside-repository map and an MCP/concurrency approach for evaluation.
- **U011:** asks for a cohesive first-principles proposal for discrepancy handling and one OpenSpec/Projector change workflow; reports opl-openspec now supports nested specs. Its candidate mechanisms are not blanket approvals, and earlier nested-design decisions remain in force.
- **U012:** requires sound current-state reads, explicit coverage versus discovery assurance, grouped consequential escalation, historical ownership without stale authority, and a concrete minimal-cost kernel proposal. Hosting details are evaluation candidates, not approvals.
- **U013:** requests engineering closure where possible and an implementation handoff with only evidence-driven initial adaptation, not speculative blockers or blanket approval.
- **U014:** directs the repository branch handoff: preserve former V3 main at `legacy/projector-main-v3`, promote V4 to `main`, package the handoff records under `.temp/handoff/`, add a root isolation rule preventing product dependencies on `.temp/`, and provide an attachment-less execution prompt.\n- **A012:** performs that repository packaging and branch transition; it does not change H1's product semantics.\n- **A011 / H1 / P41-P47:** section 14 supplies the current recommended implementation profile, authoring/delta contract, discovery/cleanup gates and bounded build/evaluation sequence. New choices remain attributed recommendations until adopted.
- **A010 / P35-P40:** recommended refinement in section 13 remains provisional. It is the current assistant recommendation, not approved user architecture. A008/A009 remain provisional except independently approved foundations.
- **A009 / P26-P34:** the integrated workflow, layout, editable plan, candidate publication and map coordination below are provisional.
- **A008 / P19-P25:** new refinements below remain provisional. Earlier P1-P13 are not blanket-approved except where an approved later statement adopts or supersedes their content. Source-derived facts are precedents, not product authority.

V4 is a blank slate. V3 is reference material with no automatic inheritance of schemas, terminology, orchestration, or obligations. V4 is now the repository's `main` line. The prior V3 `main` is preserved at `legacy/projector-main-v3`; V4 retains that ancestry without carrying the V3 working tree. `.temp/initial-design/` is deliberately tracked while other temporary output stays ignored. Do not change main/V3 or build runtime machinery merely to maintain this conversation. The documentation capture is not a mandate for a product event-store subsystem. Its replay should recover the conception faithfully, not promise byte-identical natural-language synthesis.

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

**Current recommendation:** section 13 (A010) reconciles these provisional mechanisms with managed apply. Its shared user-local kernel/root partitions refine the earlier per-root-coordinator alternative; neither has been blanket-approved.

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

A011/H1 in section 14 gives the current recommended implementation baseline. Old hole 6 is resolved by explicit revision and qualified managed-current contracts, not an unconditional filesystem claim. Old hole 7 now has applicability dispositions, independent actual-change coverage and a finite semantic-review gate. Old hole 10 now has contribution dispositions, causal stopping criteria and coupled clean-evolution tests. These are proposed operational solutions, not measured success or blanket approval.

The actual host/write observation contract, SDK/CLI integration, native packaging, resource costs and semantic trial results still need qualification. An unsupported current-state profile is unavailable, never silently weakened; revision-only delivery does not count as the complete managed experience. H1 defines a bounded first milestone for actual decision-changing probes and an amendment only when evidence warrants it. Do not turn implementation details into another open-ended design program.

Earlier provisional alternatives are retained below for context; where they conflict, section 14 is the current assistant recommendation, subordinate to user requirements and explicit approvals. No runtime, installed qualification or product benchmark is established by these records.

## 11. Source precedents and limits

These are explanatory references, not dependencies or V4 authority. The required ideas are described in this snapshot; external access is not needed to understand its design. No cited tool was installed or benchmarked as part of this update.

- **Bazel Skyframe:** dependency tracking and unchanged-value pruning are incremental-evaluation precedents, not proofs of prose equivalence or complete discovery. https://bazel.build/versions/8.6.0/reference/skyframe
- **Nx boundaries:** project-tag constraints can inform permitted references; they do not implement Markdown resolution. https://nx.dev/docs/features/enforce-module-boundaries
- **Obsidian / TypeDoc / ESLint:** nested heading links, language-aware declaration/member links, and CSS-like structural AST queries respectively inform optional syntax. Exact references identify one thing; provisional selectors identify bounded changing sets. Full CSS cascade, ambiguous multi-target exact links, and universal semantic selectors are not selected. https://help.obsidian.md/links ; https://typedoc.org/documents/Declaration_References.html ; https://eslint.org/docs/latest/extend/selectors
- **wrtnlabs/evidence**, inspected at `9b5bfdd7f7affed0c27bd74cd2f425ac008fd25e`: `@evidence <target> <reason>`, justified exclusions, scoped claim/reference populations, structural ancestry, and separate fingerprint-current review are useful precedents. Its documented model permits Markdown claims targeting code, despite code-comment examples. Markdown structural headings are not V4 typed parts. Standalone file-qualified references do not implement imported-symbol resolution. A checker cannot establish prose truth or reviewer identity. Borrow concise reasons/scoped coverage/currentness selectively; do not inherit all-functions-by-all-rules cross products, hidden rationale, manual hashes, mandatory source tags, or promotional performance claims. https://github.com/wrtnlabs/evidence/blob/9b5bfdd7f7affed0c27bd74cd2f425ac008fd25e/.agents/skills/project/evidence/SKILL.md
- **A008 primary research, 2026-09-22:** Tree-sitter is embeddable incremental parsing; Codex supports local stdio and Streamable HTTP MCP; MCP connection lifetime is not a shared service lifecycle; Codex MCP hooks are synchronous calls to existing connections and may fail non-blockingly; SQLite WAL provides snapshot isolation/concurrent readers and a single writer but has local-filesystem/checkpoint constraints; Node watcher events have platform/replacement/filename limitations; Watchman's synchronization cookies and recrawl are useful but platform-qualified precedents, not universal freshness proof. https://tree-sitter.github.io/tree-sitter/ ; https://developers.openai.com/codex/mcp ; https://learn.chatgpt.com/docs/hooks ; https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle ; https://www.sqlite.org/isolation.html ; https://www.sqlite.org/wal.html ; https://nodejs.org/api/fs.html ; https://facebook.github.io/watchman/docs/cookies ; https://facebook.github.io/watchman/docs/troubleshooting

## 12. One OpenSpec/Projector change workflow (A009, provisional)

### Status and reading of U011

U011 asks for a first-principles proposal, not implementation or approval of its brainstorming mechanisms. It favors one unambiguous workflow, proportionate discrepancy questions, nested design deltas, and tasks as a reviewable plan rather than independent product truth. It explicitly preserves prior nested/progressive-disclosure decisions despite uncertain recollection. Its final edit reports that opl-openspec has now been updated for nested specs. That is confirmed in the inspected plugin README. U011 does not blanket-approve A008/P19-P25. All new mechanisms P26-P34 below are assistant-provisional.

### P26. Resolve one consequential discrepancy, not one notification per artifact

Surface unexpected material drift promptly, grouped by causal discrepancy. Show the observed fact, expected accepted contract, affected scope, and the smallest decision needed. First refresh relevant map facts and eliminate known in-progress transitions, a provable rename/move, and stale-index explanations. A mechanically justified repair can follow the existing plan/review and human-skip criteria; do not ask the user for every diagnostic. A map cannot invent missing ownership or establish semantic applicability merely by having an index.

When product intent remains ambiguous after proportionate investigation, ask a short multiple-choice-plus-Other question. Candidate options: associate with an existing design and demonstrate fit; preserve the capability by proposing a design/requirement delta; remove accidental code; explain another intended owner/behavior. Include only viable options supported by the case. Selecting an owner is not conformance proof, and adding a design is not a free way to bless existing slop. Unknown is not a proved violation. Do not silence unknowns as false positives or manufacture evidence for a suggested answer.

Deduplicate by the discrepancy and its relevant input revision. During a managed apply, expected mismatches stay visible as transition status rather than creating repeated popups. Unexpected scope expansion or material ambiguity pauses the affected work and uses the established escalation path; unrelated work need not stop. One question resolving a common cause can address several artifacts.

### P27. Explicit workflow composition, not competing skill overrides

Keep OpenSpec as spec/change authority and retain opl-openspec's host workflow, selected-root handling, structural validation, deferral rules, and required archive guards. Add an explicit Projector-enabled schema/route that calls Projector planning, reconciliation, and completion services. The chosen workflow has one entry point and one owner for each step; do not install two skills with colliding names/descriptions and expect the model to choose the intended one.

Schema templates/artifact dependencies customize the planning surface. They do not automatically replace stock apply's checklist loop or make CLI behavior transactional. Current plugin operationGuidance is advisory and explicitly cannot override controlling stock instructions, so merely injecting guidance is insufficient. A declared adapter/extension seam must select the Projector apply behavior instead of recursively invoking an incompatible stock implementation loop. Hooks record/check transition boundaries; they are not the hidden workflow engine. Unsupported or bypassed managed operations fail explicitly or enter ordinary observed-drift handling; hooks are not assumed to intercept every possible action.

Use upstream spec merging/validation semantics through supported interfaces, not a new forked spec language. Do not copy a whole finish pipeline and then add an equivalent second Projector pass. Compose needed primitives once, share still-valid evidence, and honor existing mandatory checks. Any unavoidable broad upstream gate has a real accounted cost; changing its behavior is a separate deliberate integration decision, not a silent bypass.

The inspected tool versions do not establish a supported library dry-run/transaction API for every operation. That adapter seam still needs implementation-level verification. No new CLI command or hook capability is claimed to exist. A schema named projector in examples is illustrative, not installed.

### P28. Nested design deltas; one task tree per change by default

Proposed layout:

    openspec/specs/<capability-path>/spec.md
    openspec/designs/<concern-path>/design.md
    openspec/changes/<change>/specs/<capability-path>/spec.md
    openspec/changes/<change>/designs/<concern-path>/design.md
    openspec/changes/<change>/tasks.md

Live designs form their own concern hierarchy rather than being forced into one-design-per-capability placement. A design may satisfy several specs, and several subdesigns may realize one capability. References preserve those relationships. This is a proposed location, not a new conceptual namespace rule. Design parts retain the approved candidate roles; exact part grammar/identity remain open.

Each change-side design.md contains explicit add/modify/remove deltas against addressable parts of its identified live design, plus necessary rationale. A brand-new design is an addition; an unmarked full document must not silently replace an existing live design. A change-level design.md may be a short linking overview only when it helps readers; it is not another copy of all decisions. Configure explicit artifact patterns, for example specs/**/spec.md and designs/**/design.md, instead of treating every Markdown file under specs as a requirement delta.

Keep tasks.md as one indented non-numbered tree by default. Nest work within the document by coherent outcome and useful orchestration, not by requiring a tasks file beside every design. Split into linked parts only when size/independent collaboration demonstrates a benefit; that extension is not required initially. Current OpenSpec can count nested unnumbered checkbox items, but those counts do not supply execution-DAG, ownership, or evidence semantics.

A readable plan can contain groups such as contracts first, parallel after contracts, and integration; leaf work states objective, relevant design/contract, affected scope and verification. Optional delegation names a responsibility and non-overlapping write scope rather than mandating a subagent per node. Nesting alone must not be misread as the complete cross-group dependency graph. Parallelism and granularity are justified by useful independent work and cost.

### P29. One apply unit with a coherent acceptance boundary

Make managed apply one resumable operation: pin baseline and target; reconcile the reviewable plan; implement the candidate; validate conformance and cleanup; synchronize live specs/designs; archive; and publish one coherent repository revision. These remain distinct internal steps with failure handling, not simultaneous edits or one giant filesystem/database lock. The label apply changes in Projector-enabled workflows only through the explicit route in P27.

Use an isolated candidate branch/worktree or equivalent existing host isolation, preferably reusing the host's facility. Start from a known committed baseline for affected implementation and live meaning. Preserve dirty unrelated/local work; never auto-stash, reset, delete, or absorb it. Planning drafts can be captured as the candidate's declared inputs. Requiring every unrelated file in every worktree to be clean is not necessary. Begin with one active managed change per candidate worktree, not a new general multi-change scheduler.

A target view is the baseline's accepted specs/designs plus one reviewed set of proposed deltas. It is prospective intent, explicitly distinct from accepted live truth. Materialize only affected documents when a consumer needs files; do not clone or reconstruct all meaning on each query. The earlier live-spec monitoring rule remains intact: draft files do not become globally accepted requirements merely by existing. The selected change workflow may interpret their prospective effects to plan implementation.

Implement against that target while ordinary accepted state remains stable. At closure, use OpenSpec's actual synchronization/archive behavior for specs and Projector's part-delta behavior for designs in the candidate; verify the materialized result agrees with the reviewed target. Apply required evidence to the candidate state, not yesterday's plan. Publish code, tests/config changes, live specs, live designs, and the archive transition as one coherent commit/tree when authorized and all gates pass. Archive is a completion step, not proof of implementation or deployment.

If repository policy requires review/PR integration, the candidate can be ready-for-integration without bypassing it. No force push, automatic main merge, deployment, or remote-resource action is inferred. Intermediate/WIP checkpoints may exist on the private work branch; they are not accepted completion. A Git commit gives coherent versioned content; updating a checked-out tree is not a magically atomic multi-file filesystem operation. Participating readers use the transition/snapshot boundary. External services, database migrations, and irreversible effects need their own declared plan and evidence, not a fictitious universal rollback.

If a guard or finalization step fails, preserve the candidate and resume the incomplete phase; do not publish partial success or replay all preceding work. An immutable completion target and phase record can make repeat apply a no-op when already done. The minimum durable recovery record must survive loss of optional caches; storage details remain open.

### P30. Revisions reconcile from the new target, not repeated live rollback

Before each apply/resume, validate the plan's actual dependency basis. A cache hit reuses it; a meaningfully changed dependency or explicit plan edit triggers only affected replanning. Do not blindly regenerate the whole tasks file on every invocation. Cosmetic plan edits or purely organizational delegation changes need not invalidate product reasoning.

If proposed requirements/designs change during implementation, stop newly invalidated work, establish a new target revision, and compare it with previous target plus actual candidate state. Retain work only when its current justification, contracts, and applicable evidence still hold. Explicitly remove or replace effects that lost justification; clear affected completion status; plan additions and coherent simplification. Test success alone is not evidence that unwanted structure belongs there. No compatibility bridge or duplicate old/new path merely because work is already done.

Use old design footprints, new support and accepted boundaries to classify retain/remove/rewrite/add. Batch final edits per affected file and preserve unrelated valid contributions when several work items share a file. Do not use blanket git reset, reverting whole commits, or repeatedly unsyncing the live specs as the ordinary revision method. A material decision or increased scope follows existing review/escalation criteria. This is clean-current-state reconciliation, not edit-history reversal.

### P31. tasks.md is a review surface, not competing truth

Requirements establish required outcomes; designs establish chosen realization and relevant rationale; tasks.md presents the proposed execution plan, orchestration and observed progress. Its status must be derived from current evidence, not trusted because a box is checked. The plan is a meaningful reviewed artifact but cannot silently override requirements or design choices.

Permit structured human edits as planning input. Reordering or delegating work becomes a validated planning constraint. An edit that changes behavior, a design choice, or required verification becomes an explicit proposed amendment to the corresponding authority and is resolved before execution. Do not silently discard the user's edit on regeneration, and do not implement it against contradictory accepted intent. An unsupported freeform edit is surfaced rather than guessed.

Before consequential execution, compare the saved plan basis and valid amendments with current target/observations. Show a concise semantic plan diff only when material work changed. A missing mandatory task or unjustified completed task is a discrepancy, not an opportunity to lower the target. Preserve stable task labels where useful without requiring line numbers, a separate authored task database, or code annotations. The exact grammar for amendable fields and stable plan identity remains provisional.

### P32. The map understands candidate state and supports its own repair planning

Build on the still-provisional A008 map design without implying its adoption. Keep accepted-view identity separate from candidate change/revision and actual working observations. A query states which view it needs, and its dependency token must match the active target before plan application. Reuse unaffected accepted facts; keep only affected overrides and input generations for the candidate. Do not rebuild the whole map per candidate or treat folder location alone as authority.

The workflow emits cheap begin/end mutation batches, expected scopes, exact added/changed/deleted inputs where available, and meaningful checkpoints. Missing completion signals leave affected observation uncertain. Invalidation is immediate; expensive extraction is coalesced or demanded. Reads of unrelated current scope continue; overlapping readers share refresh. No per-save model calls, lock held during reasoning, or repair performed by a map read.

Expected transition mismatches are marked as belonging to the active delta, not mistaken for unexplained drift and not waived at completion. Unexpected changes still surface. Retain old ownership long enough to see artifacts orphaned by deletion. Index freshness remains distinct from semantic validity, and a current map can report drift needed to plan repair.

Publish the repository revision first as the recoverable authority; then mark/promote matching derived map slices only after validating their basis. A crash after repository publication but before cache update produces stale/unavailable cache, never a falsely current answer. Do not create a distributed transaction across Git and a disposable index. Completion recovery and map refresh are idempotent for their observed revision, with dependency validation before reuse. Unknown external writes or lost observation follow the explicit recovery policy rather than defining normal cost.

### P33. Blockers park work without falsifying completion

If a distinct prerequisite is discovered, record it in the existing external work tracker and link the selected OpenSpec changes as the plugin's deferral policy expects. Preserve the original candidate and mark it blocked; do not archive it as completed or check off deferred work. Create/select a separate prerequisite change only for a genuinely separate necessary outcome. Small same-outcome repairs can remain in scope after the required plan/review update.

After the prerequisite is completed and integrated, rebase/refresh the original baseline and reevaluate only invalidated dependencies and work contributions. Carry valid work with evidence; reconstruct invalidated parts. Cyclic blockers require revisiting the partition/combined change, not recursively manufacturing more tickets. No new dependency database or tracker is implied. 'One apply operation' means a coherent lifecycle, not a promise never to pause for real blockers.

### P34. Evidence and economics for this workflow

Use deterministic controlled tests first: a plan derived from unchanged inputs is reused without model work; several related edits share one affected pass; unrelated dirty scopes do not stall reads; revising/removing a design midway withdraws its obsolete implementation; a formatting-only task change does not trigger redesign; a scope/verification-changing task edit cannot override authority; a new consumer invalidates relevant planning before publication; a blocker preserves work without false archival; and a crash around sync/archive/publication leaves a recoverable candidate or a complete revision, never silently mixed accepted truth.

Compare the materialized spec/design target with the plan's reviewed target. Reuse identical evidence across planning/apply/finish when its dependencies still hold; do not run both stock and Projector audits over the same unchanged evidence. Budget cold-start, cache recovery, stock required checks, actual file writes, RPC/process starts and model context alongside Projector's own work. A genuinely broad dependency or mandatory gate may cost more; disclose and justify that cost rather than claim sublinear behavior for all changes. Follow-on revision tests exercise clean-reconstruction equivalence without generating an independent full implementation on every apply.

### Source observations and unresolved seams

Inspected opl-openspec on main at 071055f1229cfcc76bb0248036596a85b28e7a50, with README and apply/finish skill blobs c9b903910abc2fb29585c7984e70216152b98a77, 6070b356ea08512d8a81558273e7cc0f42413bfe, and 736fac8bbcc31c117a05d86a6bbfe44c393bfd5a. README aligns to OpenSpec 1.13.1 at 634c557bd0470eec37861b46172c3f503d283c1b and explicitly preserves nested capability paths, external work tracking, and deferral/archive guards. Its finish workflow already sequences apply, targeted reconciliation/review/verification, sync, and archive; this is a donor for composition, not evidence of a transactional implementation.

At that pinned upstream revision, spec-discovery.ts traverses only capability spec.md files for merges. Other Markdown can coexist, but a design.md with spec-style delta sections is an unread-delta error candidate, and any file under a change's specs directory conflicts with skip_specs. Placing a design.md beside a spec therefore does not create durable design synchronization/delta semantics. The default schema has one change-level design.md; custom schemas can define other outputs and dependencies. The task-progress parser accepts nested unnumbered checkbox lines and can resolve schema-selected task files, but counting is not orchestration or verified completion.

Useful references: https://github.com/OnePersonLabs/onepersonlabs-plugins/blob/071055f1229cfcc76bb0248036596a85b28e7a50/plugins/opl-openspec/README.md ; https://github.com/OnePersonLabs/onepersonlabs-plugins/blob/071055f1229cfcc76bb0248036596a85b28e7a50/plugins/opl-openspec/skills/openspec-apply-change/SKILL.md ; https://github.com/OnePersonLabs/onepersonlabs-plugins/blob/071055f1229cfcc76bb0248036596a85b28e7a50/plugins/opl-openspec/skills/openspec-x-finish/SKILL.md ; https://github.com/Fission-AI/OpenSpec/blob/634c557bd0470eec37861b46172c3f503d283c1b/src/utils/spec-discovery.ts ; https://github.com/Fission-AI/OpenSpec/blob/634c557bd0470eec37861b46172c3f503d283c1b/src/utils/task-progress.ts ; https://github.com/Fission-AI/OpenSpec/blob/634c557bd0470eec37861b46172c3f503d283c1b/schemas/spec-driven/schema.yaml ; https://github.com/Fission-AI/OpenSpec/blob/main/docs/customization.md . Source contracts were inspected; no plugin workflow, schema or runtime has been installed, modified or tested here.

Remaining consequential seams: prospective-state/acceptance lifecycle versus stock adapters and mandatory hooks; exact design-part and plan-amendment grammar; recoverable local publication and optional external-store boundaries; and bounded semantic applicability/cleanup evidence. A map and managed workflow greatly reduce rediscovery but do not alone solve those semantic questions. This proposal assumes one repository-local OpenSpec root for one code/design publication unit; external standalone stores require an explicit cross-repository boundary rather than being silently treated as atomic.

**Current state:** A007 remains approved by U010. U012 refines required behavior and requests reassessment, not blanket adoption. P19-P25/P26-P34 remain provisional; A010/P35-P40 supply the current recommended kernel refinement. No runtime, observer, schema, workflow implementation, conformance proof or performance result is implemented by these records.

## 13. Map/kernel reassessment with managed changes (A010, provisional)

**Current implementation recommendation:** A011/H1 in section 14 refines this candidate into a bounded implementation contract. Existing approved requirements and attribution remain in force.

### Attribution and guarantees

U012 requests reassessment, not adoption of its hosting candidates or blanket approval of A008/A009. Its explicit requirements are: current-state reads never silently use stale or unvalidated facts; relevant reads wait for validation while unrelated valid reads and editing continue; managed completion catches missing coverage and does not hide discovery uncertainty; consequential ambiguity is grouped into evidence-supported choices plus Other; historical ownership remains usable as revision-bound evidence; every mechanism justifies resource cost. A010/P35-P40 below are the recommended candidate, not implemented or approved mechanics. A007's approved clean-reconstruction/economics foundations remain in force.

The guarantee is refusal to pass unknown or stale information off as current, conditional on a declared observation contract for the supported host and filesystem. This is not a guarantee that arbitrary semantic applicability is decidable or that no noncooperating write can occur after an answer. Operation-count expectations below are falsifiable design targets, not benchmark results.

### Assumptions for this assessment

1. **Qualified observation.** A managed mutation provides acknowledged begin/end boundaries and its actual write set, or the root has a separately qualified change-observation barrier. Missing/unprovable coverage is unknown, not clean. Hooks alone are not assumed complete. This makes the earlier managed-work premise an explicit condition.
2. **Revision separation.** Accepted meaning, proposed target, observed implementation, and historical evidence have distinct identities. Current reads have an observation boundary; historical reads name an immutable revision. Consequential use revalidates dependencies. This carries forward the managed-change proposal, not its blanket approval.
3. **Accountable discovery.** A completion claim depends on scoped coverage and applicability evidence, not absence of diagnostics. Clean-reconstruction evidence also addresses structural residue, not behavior tests alone. Unknowns remain explicit and cannot be cleared by merely adding a justification label.
4. **Two granularities.** Extract changed files; propagate changes through addressable requirements, design contracts/decisions/realizations, referenced symbols, and indexed query populations. Do not persist every AST expression or treat every file as one semantic dependency. This is a concrete new proposal.
5. **User-local host.** Recommend one on-demand kernel per OS user/security domain, shared by authorized clients and isolated by canonical worktree root. Root partitions have bounded work and short publication transactions; no global parse lock. This refines, rather than literally adopts, the machine-singleton candidate.

### P35. Thin relays and one user-local kernel

Recommend the candidate hosting shape: a client-launched thin MCP relay connects to an on-demand local kernel; CLI/hook clients use the same protocol and never own another index, refresh algorithm, or lock hierarchy. The relay has no parser or persistent map cache. Direct hook calls over an existing connection can avoid process creation where supported; otherwise a small protocol client records batches. Do not start an indexer for every hook or use model calls for bookkeeping.

Use an OS-held process-lifetime ownership lock and local endpoint, scoped to the user's security domain. A winning launcher starts the kernel; competing launchers join it. Validate readiness/protocol version and kernel incarnation. Never steal ownership solely because a PID file is old or a timeout expires. A closing relay does not terminate the kernel used by others. On idle exit or crash, pending requests receive explicit failure/pending status rather than cached answers. An incompatible protocol is a visible upgrade/reconnect condition, not a reason to spawn rival owners over the same cache.

Inside the kernel, isolate roots by canonical filesystem/worktree identity, not remote repository URL or branch name. Symlink aliases of the same actual worktree should not create duplicate owners; different worktrees of one repository remain separate. Root replacement or identity changes require reopening/revalidation. A Windows/WSL/container pair writing the same actual checkout is not automatically two safe independent owners: route it to one qualified owner or declare that sharing unsupported. No elevated machine-wide service or universal cross-environment bridge is proposed.

Recommend one local SQLite database per root in plugin-owned outside-repository storage, with short WAL publication transactions and separate snapshot readers, plus a bounded shared extraction worker pool and fair per-root queues. This avoids coupling unrelated roots through one database writer. Parsing/IO occurs outside publication transactions and off the coordinator's response path. SQLite is a recommended baseline, not an accepted dependency; no custom MVCC engine or distributed lock service is needed. Snapshot isolation is not source freshness.

Watch active roots, retain hot parser/query state within fixed memory/disk limits, and release idle roots. Do not preload every repository on the machine. One process shares lifecycle and code; it does not imply one unbounded map or that a busy root may monopolize all workers. Bound active queries, result size, waiters, background batches, retained source snapshots, and database checkpoint/WAL costs. Structural storage is proportional to inventoried files, selected semantic records, real edges, and bounded cached queries, not all possible artifact/requirement pairs.

This addresses duplicate process ownership, competing refresh writers, most relay lifetime questions, and cross-client coherence by a concrete design. It does not establish complete mutation observation or semantic discovery. One kernel crash can interrupt all clients; persistent partitions and observation recovery handle that without pretending process isolation. Platform lock/IPC implementation and test qualification are engineering work, not a reason for another framework.

### P36. Concrete indexing and refresh granularity

Use four modest groups of records, not four new services:

| Group | Stored state | Invalidation/refresh trigger | Why this granularity |
| --- | --- | --- | --- |
| Input manifest | Canonical path/file identity, observed content version/hash, extraction version, pending mutation generation, known additions/deletions | Actual completed file change, possible write, inventory gap, relevant parser/config change | One settled file read/hash/parse can update all extracted records |
| Semantic records | Requirements; design contract/decision/realization parts; eligible code declarations/members needed for references and ownership; direct typed edges; scoped fingerprints and evidence status | Changed extracted record or a dependency of a claim/check | Addressable decisions and public guarantees propagate separately from unrelated detail |
| Reverse and discovery indexes | Design-side realization bindings and reverse coverage; incoming edges; normalized name-to-candidate sets; scope/path/export/contract indexes; cached selectors and their population dependencies | Edge/ownership changes, candidate births/deaths, changed selector scope or membership | Find the union of affected consumers without rescanning every design or materializing a Cartesian product |
| Query/revision records | Bounded cached query results and their dependency/policy versions; observation boundary; accepted/target/working view identity; historical ownership keyed to immutable revisions | Used input/membership/checker changes, view change, lost observation | Reuse current results, share work, and retain prior ownership without confusing it with live observations |

Start with file-level extraction and semantic-record-level invalidation. Tree-sitter incremental edits are an optional optimization only where exact edit ranges and a warm tree are available; ordinary bounded parsing of a changed file is sufficient initially. Code extraction keeps import/export and referenceable-declaration summaries plus needed ownership/binding data, not every token as a persistent graph node. Local bodies may be covered under a coherent owner, but changed conformance evidence still needs its actual body/input dependencies.

A parser may update several records from one file. Unchanged extracted records retain their versions. The parent design does not hash every descendant. Equally, an unchanged type signature does not prove behavior unchanged: a behavior conclusion depending on a modified implementation/check becomes stale even if names and types do not. Hash only validates identity/currentness under the selected profile, never arbitrary semantic equivalence.

Before a managed write, mark the affected input generation pending immediately. Do not walk the entire transitive graph for every edit. Keep a coalesced dirty-input set and defer extraction until a logical batch settles or a relevant read demands it. Refresh each needed settled file version once, compare its records, and traverse the union of changed dependencies once per settled batch. Final code mutations are still a separate planned/reviewed unit, combined per affected file.

Demand jobs are deduplicated by root/view/input generation/extractor basis. Overlapping requests join shared per-file extraction rather than each creating a refresh. Derive narrower query results after their shared inputs publish. One stale input does not discard unrelated valid extraction. A worker's publication is conditional on its captured input/dependency generations and kernel incarnation; completion cannot clear newer dirtiness. Avoid an independent lock, worker, or persistent node per code symbol.

Record new-member dependencies as first-class query inputs. Example: a bare globally unique name depends on the eligible declaration population, not only its previous target. A pending edit elsewhere might introduce a second symbol. Refresh the necessary changed declaration summaries before asserting uniqueness. Exact qualified reads not depending on that population can continue. Similarly, an empty ownership/consumer query watches its bounded population. Do not decide a dirty file is irrelevant merely because it is absent from the old result. Unsupported or unbounded queries are explicit unknowns or deliberately costly operations, not cheap-but-unsound fast paths.

Changes to extraction, name resolution, evidence rules, boundary policy, or population definitions invalidate the records actually governed by them. Reuse identical bytes under identical extractor versions; do not rehash untouched source on every request. Cache result dependency subscriptions or generation summaries so warm queries do not rewalk their entire transitive closure. Cache count and dependency storage are bounded; evicted entries recompute on demand. No exotic per-expression dependency engine is required.

### P37. Current reads, in-flight writes, and historical comparisons

A current read follows this protocol:
1. Select the root and explicit accepted/target/working view. Establish an observation barrier covering relevant writes completed before the read, plus known in-flight work. The last event received or an old cached watermark is not itself a current barrier.
2. Ensure the needed discovery/name/membership populations are validated before trusting any saved closure. On startup, validate cached observation continuity; absent reliable continuity, mark the affected population unknown and recover it.
3. If required scope is pending, join/prioritize its bounded refresh after a settled mutation checkpoint. Other scopes and editing remain free. Do not hold a read lock while an agent edits or thinks, and do not let a map request wait for semantic repair. A writer asking about its own unfinished batch needs an explicit settled checkpoint, not a circular wait for itself.
4. Read one coherent published snapshot with the necessary input and rule versions validated. Return factual results, extraction limitations, coverage/discovery status, design discrepancies, and expected transition state separately.
5. Revalidate relied-on versions/target identity before consequential managed use/publication. The response does not authorize relying on it forever. Timeout or unavailable observation yields pending/unavailable, never implicit stale fallback.

Normal managed checks use acknowledged writes and qualified observation, not a recurring full-tree scan. Missing hooks, unknown shell scope, detached writers, watcher loss, startup gaps, external edits, or root changes require the smallest justified recovery. A broad scan can be necessary after an unbounded lost interval or on cold initialization; share it and do not hide it inside every read. Until discovery scope is validated, a local read may proceed only if it genuinely does not depend on that unknown population. Global name uniqueness can require global eligible-inventory validation on a cold start.

A qualified observation mode is a condition of claiming live freshness. Use explicit managed write boundaries plus a supported observer/barrier, or immutable checkpoint input for exact revision-bound operations. Generic asynchronous notifications, quiet debounce time, mtime, or singleton ownership cannot manufacture that condition. If the host cannot establish current working-tree coverage, refuse a live-current claim; an explicitly historical/checkpoint query remains possible but is not silently relabeled current. Concurrent noncooperating writes cannot be made atomic by check-then-read/check-then-write; require isolation/cooperation for that stronger claim.

A current map may correctly report a known missing design justification or unresolved interpretation. Return it as current observations plus discrepancy/unknown status. It is useful for repair planning and does not wait until all product defects are fixed. Stale observations, unparsed relevant source, and unknown extraction coverage cannot satisfy requests for validated current facts. This distinguishes factual currentness from design conformance and from semantic-discovery assurance.

Historical ownership is an explicit revision-bound read: 'design D at revision R justified these artifacts under these bindings.' Preserve last accepted and relevant prior candidate-target design inputs, footprints, and source revision identities needed by active changes. Use ordinary Git/candidate checkpoints or an explicit durable revision record for irrecoverable authored transition inputs; a disposable map cannot be their sole surviving copy. Rebuild derived historic footprints on demand from those inputs. Pin active comparison state and bound remaining cache retention rather than retaining every old full map indefinitely.

Planning removals combines the prior footprint, new target support, and freshly validated current artifacts/consumers. Old support identifies what to reconsider; it neither proves a referenced artifact still exists unchanged nor grants permission to delete shared code. Historical references use their historical resolution context. A missing old target today is a comparison result, not a reason to corrupt historical meaning. Cache loss must not erase the basis for withdrawing obsolete implementation. No new full repository event store or second authored authority is implied.

### P38. Coverage and discovery are separate completion obligations

A **detected coverage gap** is a known current artifact or applicable requirement missing required ownership/realization/evidence. It can arise inside the managed workflow; do not blame a bypass by default. A **discovery gap** is uncertainty about whether the necessary artifact/requirement population and applicability were examined. It is not automatically a proved violation or a proved absence.

At apply planning, compare declared changes with independently observed input/declaration inventories and both old/new design footprints. On each settled batch, account for actual additions/modifications/removals instead of observing only planned write paths. A changed design binding must not be its own sole definition of the artifacts that exist. Reconcile new requirement criteria and changed concept/contract/query populations; activate affected scope and cross-cutting concerns from indexes. Deterministic selectors/rules can establish completeness only for their declared, fully observed populations.

For prose-only or insufficiently formalized applicability, assign one explicit discovery obligation to the relevant change/concern scope, not one record per requirement-by-artifact pair. Record what was examined, the scope/exclusion rationale, important dependencies, and unresolved questions in existing plan/design evidence. An affected concern review may expand that scope. It is bounded judgment, not proof that arbitrary natural-language implications are exhaustive. Do not claim semantic completeness from name matching, typechecking, an empty error list, or an agent saying done.

Before coherent completion, require no unaccounted implementation changes, coverage for known applicable obligations, current required evidence, and no material unresolved discovery obligations under the selected policy. The workflow already provides the point at which to enforce this; a new verification ceremony for every file is unnecessary. Planned transition exceptions must be resolved rather than laundered into final acceptance. No requirement weakening or automatic design manufacture just to make a check green.

If deterministic processing cannot settle an issue, report its smallest unresolved decision with supporting observations and consequences. Group related findings by cause/revision. Offer evidence-supported choices plus Other, not a generic menu for each file. Example: 'These replay events now reach assessment. Should that path be excluded because only player-origin events count, or is intentional generated-event assessment a proposed requirement/design change? Other.' Show only alternatives actually plausible in the specific case. Escalate pivotal intent/implementation choices according to existing criteria; resolved mechanical work need not interrupt the user.

Thus managed apply and the map adequately place and support coverage gates, but do not themselves supply a universal discovery oracle. Designing the coverage policy and testing semantic misses remains a substantive frontier. The same applies to deciding whether a new implementation is free of unjustified historical structure.

### P39. Cost constraints and deterministic verification

The proposed warm-path cost follows distinct changed source bytes, changed semantic records, necessary indexed dependencies/populations, requested output, and required evidence. It is not universally constant or sublinear: a genuine global constraint, startup inventory, or a globally scoped uniqueness query can require broad necessary work. Do not lower correctness to preserve a slogan.

Bookkeeping stores known events/generations and real relationships, not speculative every-to-every links. A settled warm query with no relevant changes performs no source reading/hashing/parsing and no model call; it still pays necessary IPC, observation-barrier, small status checks and result serialization costs. Query-dependency validation must not reread every transitive source. Event ingestion itself costs work even when downstream computations coalesce.

Use bounded parallel extraction only when justified; one coordinator response loop and short per-root transactions are enough initially. Content reuse and coalescing pay before AST micro-optimization, background precomputation, or more workers. Parsing, index publication, cache validation, and routine map reads use zero model calls. Targeted semantic/evidence work occurs in the managed plan. Required upstream broad validation is still counted and must not be duplicated by another Projector pass.

Five deterministic test groups, with synthetic interleavings and instrumented counters:

| Group | Required discriminating cases |
| --- | --- |
| Coalescing and warm reuse | 100 related writes followed by 32 readers after one settled batch share one required final-file extraction; intermediate states are not demanded. Repeated settled reads do zero source IO/hash/parse/model work. Genuinely unaffected reads return while another scope is pending. Global population-dependent reads are not mislabeled unaffected. |
| Ownership and race isolation | Simultaneous relay startups select one kernel; one relay closing does not kill others; two roots do not share write queues/data; crash/restart fails pending reads explicitly; old-incarnation or stale-generation workers cannot publish or clear newer dirtiness. Paused incomplete batches do not deadlock reads used to plan their own repair. |
| Discovery and freshness | Add a colliding name, a member to an empty selector, an unbound artifact, and a broadened requirement scope. Pending discovery is processed before negative/unique conclusions. Lost notifications, unsupported extraction, read failures and startup gaps never appear clean. Reordered multi-file writes cannot mix target generations. |
| Completion and semantic status | A current map returns a known design discrepancy without running repair. Missing coverage and unresolved applicability block completion claims even when boxes are checked. Group same-cause findings into one decision. Model-free fixtures exercise gate mechanics, not semantic judgment quality. |
| Historical reconstruction and retention | Removing/revising a design still exposes its old partial/shared footprint; current artifact checks use current facts. Deleting disposable cache reconstructs needed history from pinned inputs. Old evidence cannot satisfy current read validation. Active history is protected; inactive AST/query/WAL retention obeys budgets. |

Measure parse/hash/read bytes and counts, partitions and edges visited, IPC/process starts, publication count, queued/waiting work, memory/disk retention and startup/recovery costs. Test scaling with added unrelated files after initialization and with overlapping versus distinct changes. These reject structural performance traps before empirical latency tuning. They do not prove real-world overhead, semantic discovery, or clean-reconstruction benefit; focused held-out change scenarios and measured supported-host tests are still required.

### P40. What remains of earlier holes 6-10

Earlier numbers refer to A008's response, not the six older A007 holes. The recommended candidate reduces the open architectural list as follows:

- **Old 8, Granularity economics:** given a concrete bounded design in P36/P39, no longer an unspecified architecture hole. File extraction, part invalidation, real indexes, capped demand queries and counters make the tradeoff inspectable. Implementation must pass tests; this is not a proven performance result.
- **Old 9, Liveness/publication:** addressed at the design level by one user-local owner, fair root queues, shared refreshes, short conditional publication, explicit pending failures and resumable managed changes. Exact lock/IPC/timeout APIs are implementation choices subject to tests. Host coverage remains in hole 6, not relabeled solved.
- **Old 6, Observation gap:** reduced to the concrete qualified-observer/managed-writer seam. Singleton ownership does not settle it.
- **Old 7, Semantic gap:** workflow gates and discrepancy UX are accounted for; sufficient scope/applicability evidence still needs definition and testing.
- **Old 10, Cleanliness/stopping:** historical footprints provide the needed inputs and managed apply the place to act; the acceptance bar is still substantive.

Remaining holes, using assumptions 1-5 above:

6. **Observation contract.** Demonstrate exactly how supported writers/hosts establish a current boundary, detect lost intervals and avoid bypass races without a routine sweep. Unsupported environments get explicit limited/checkpoint operation, not false currentness. [1, 2, 5]
7. **Discovery sufficiency.** Establish an evidence bar that catches newly applicable semantic obligations and unintended implementation, including the workflow's own misses, without a requirement-by-artifact audit. [2, 3, 4]
10. **Clean endpoint.** Establish the structural residue/simplification stopping criteria that reject old scaffolding while preserving still-justified shared work, without full independent regeneration on every change. [2, 3, 4]

These are unresolved evidence/contract questions, not demonstrated impossibilities. Stable IDs, cache tables, ownership-lock mechanics, batching queues and deadline handling are not each another conceptual dealbreaker. Implementation errors can still invalidate the proposed solution. Exact design-part grammar and the stock workflow adapter remain separate previously acknowledged work; this reassessment does not declare them finished.

### Source grounding and limits

Read the actual running spec at a6eb5946d4dbd4eecb51af48156a15a5620bf004, including A008/P19-P25 and A009/P26-P34. This reassessment preserves their provisional status and approved foundations. It refines P20's prior per-root-coordinator suggestion into the preferred shared-host/root-partition candidate; that is a recommendation, not a user-approved migration. No code, database, daemon, plugin workflow, or runtime test is implemented here.

Primary sources checked for implementation premises: MCP's stdio transport launches a subprocess per client, which supports separating a thin relay from shared ownership; https://modelcontextprotocol.io/specification/2025-11-25/basic/transports . SQLite WAL supports snapshot readers with writes, but snapshots do not validate filesystem observation; https://www.sqlite.org/isolation.html . Codex MCP hooks use existing connections and do not block on missing servers/tool errors; some paths can bypass tool hooks; https://developers.openai.com/codex/hooks (redirects to https://learn.chatgpt.com/docs/hooks). Watchman's synchronization-cookie documentation contains platform-specific limitations, so it is a precedent rather than a universal freshness proof; https://facebook.github.io/watchman/docs/cookies . These are checked source claims, not required dependencies or claims of tested V4 behavior.


## 14. Implementation handoff and scoped closure (A011/H1, recommended)

**Attribution:** U013 requests engineering closure and a practical implementation handoff, not speculative blockers or blanket approval of A008-A010. H1 is the assistant's recommended baseline, subordinate to newer user direction and established requirements. Giving an implementer H1 with an instruction to implement adopts that baseline for the task. Preparing documents proves no runtime or empirical result.

The standalone artifact is `PROJECTOR_V4_IMPLEMENTATION_HANDOFF.md`, H1, based on revision 0.10 at `5c7e083db63e9b349526f202c1d97b011b4038e1`; SHA-256 `64845d067c6087f5f9d13b08780259afca79f101199475fce939b525b5830988`. It gives product/authoring contracts, small module architecture, kernel/change protocols, completion rules, tests and build sequence. It is an implementation instruction, not another synthesis prompt. It does not require rereading V3 or the conversation. The specification-relevant decisions are preserved below, independently of that downloadable artifact.

### P41. Observation contract and delivery boundary

Implement exact-revision reads for accepted commits, prospective targets and sealed implementation checkpoints. They are exact for their named input, not assertions about a newer arbitrary filesystem state. Working-current is a separate mode available only with a qualified observation profile covering relevant completed/in-flight mutations. Unknown or pending facts yield unavailable/pending, never a historical substitute labeled current.

Deliver revision operation and a managed-writer profile for explicitly allocated candidate worktrees using acknowledged begin/end batches and independently validated checkpoints. Hooks, quiet watchers or calling a directory managed do not establish coverage. The guarantee is conditional on the declared cooperating-writer/isolation contract, not every same-user noncooperating process. Test actual host routes, interruptions, read ordering and restart behavior. If the host cannot meet the profile, revision/checkpoint operation may be delivered with working-current explicitly unavailable, but the full managed experience is not complete. Do not weaken the guarantee, scan the whole tree per read, or start a filesystem-interposition research project.

Notifications mark suspicion; a cached watermark does not prove freshness. Unknown shell scope, detached writers, missed hooks, root changes and lost intervals require the smallest justified recovery. Revalidate dependency/target tokens before consequential use. Old footprints are valid historical evidence; current consumers/artifacts still require current validated facts. Old hole 6 now has a scoped architecture contract, with host qualification still necessary.

### P42. Explicit applicability and finite discovery gate

Every new/meaningfully changed requirement needs a disposition: concern/scope/contract selectors or justified scoped non-applicability. Missing scope is unresolved, not applies-nowhere. Reuse only while premises and populations hold. Independently observe actual changes, including unintended changes introduced by the managed workflow itself.

Recommend compact Applies entries in the owning design Contract: requirement reference, selector, reason. Do not copy requirement prose or create another requirement authority. A compact root concern catalog supplies navigation and genuinely cross-cutting rules. Broad ownership scope selects responsibility, not permission for arbitrary behavior. No requirement-by-artifact Cartesian product.

Use deterministic selectors first. Prose applicability gets one bounded host-agent routing/discovery pass over changed meaning, outward contracts, indexed consumers/dependencies and the root catalog. Record examined scope, inclusion/exclusion rationale and material unresolved questions in existing design/plan evidence. A genuinely global requirement may justify broad assessment for that change, not every read. Completion requires known obligations covered, actual changes accounted for, current evidence and no material unresolved discovery questions under the declared policy. This is a finite evidence bar, not complete natural-language deduction. Group consequential ambiguity into evidence-supported options plus Other; never fabricate a design to bless accidental code.

### P43. Clean reconstruction and stopping rule

Use old footprint, new realization, independent changed artifacts and necessary consumer/registration edges. Disposition each affected previous contribution as retain/remove/replace/revise with a current reason. Retention requires surviving requirements, current design need or explicit external obligation. Pre-existing, tests-pass and hypothetical compatibility are insufficient. Shared implementation can retain multiple reasons; circular code references alone cannot preserve orphaned machinery.

Check superseded entry points, registrations, config/flags, dependencies, tests limited to retired routes, duplicate old/new paths and internal compatibility wrappers whose callers can migrate. Use indexed scope and existing checks. Dead-code tools assist, but do not decide whether a used abstraction remains worthwhile. Fewer edited lines must not preserve obsolete structure.

Stop when changed obligations/affected interactions hold, prior contributions are accounted for, no identified material historical residue remains in the causal closure and no pivotal alternative is unresolved. Different clean helper names/algorithms are acceptable. Unrelated aesthetics are outside scope. A settled second reconciliation must be a substantive no-op with sound dependency validation. Three paired coupled trajectories and seeded bad candidates qualify this bar, without rebuilding from scratch on each apply. This resolves the policy behind old hole 10, not universal optimality or measured reliability.

### P44. Small implementation and kernel

One TypeScript package, with internal documents/index/kernel/change/host/testkit modules, not one published package per noun. Testkit never enters production. Enforce entry points/direction with existing tooling. Use a tested pinned Node 24 LTS patch, TypeScript, an established Markdown AST parser, a host-compatible official MCP SDK and SQLite. Prefer node:sqlite when qualified, off the coordinator response loop. Change binding only for an observed blocker, not speculative abstraction. No Rust/.NET sidecar or added model API billing. Initial extraction supports Markdown and JS/TS through actual language parsing/resolution; other artifacts have explicit file-level ownership/limits. Keep language-agnostic interfaces, not fictitious universal support. Avoid rebuilding a whole language program on every lookup; bound retained AST/compiler state.

One on-demand user-local kernel, thin relays, per-worktree SQLite partitions, bounded fair work lanes and short guarded publication. Start with at most two worker lanes. No per-symbol locks, custom MVCC, global scheduler, vector store, daemon installer, Evidence runtime dependency or background model loop. OS-held lifetime ownership is required. A vetted primitive is preferred; an exclusively bound per-user loopback endpoint with authenticated/versioned handshake is a minimal candidate, subject to real OS exclusivity qualification. Only its owner initializes databases; losers join. Foreign occupancy/version mismatch fails, never chooses random ports and creates competing owners. Keep ownership namespace stable across upgrades. Loopback requires user-private credentials, origin rejection, bounded payloads and no secret logging. Equivalent established local IPC is acceptable; do not build both transports initially.

Extract files; invalidate meaningful records/populations. Store identities/versions, document and code summaries, typed edges, reverse ownership, name/scope populations, bounded query dependencies and revision/evidence metadata. Distinguish name/address, public-contract, body and design-basis fingerprints. A stable type signature is not stable behavior. Coalesce repeated file edits before propagating changed summaries. Active-query dependencies must cover transitive factual support or sound population summaries. Bound subscriptions, ASTs, queues, result bytes, roots, WAL/history retention. Parse/blocking database work stays out of coordinator response handling and publication transactions.

Overlapping reads share one extraction per needed settled version. Validate input generations and kernel incarnation at publication; old jobs cannot clear newer dirtiness. Name collisions and empty selectors require population validation before absence/uniqueness claims. Warm reads do no source read/hash/parse/model work, but IPC, barriers and serialization remain real costs. Broad cold/recovery inventories and genuinely global changes are counted necessities, not hidden normal paths.

### P45. H1 authoring and design-delta grammar

Layout: live specs at openspec/specs/<capability>/spec.md; terms at openspec/terms/**/*.md; nested concern designs at openspec/designs/<concern>/design.md. Change design deltas are under designs/<concern>/design.md parallel to specs, not inside specs. One tasks.md tree per change; any change-level overview links rather than duplicates.

Live design YAML has projectorDesign: 1, stable unique id and ownership/resolution scope. Addressable H2 roles: Contract (required), repeatable Decision: <local-key>, singleton Realization and Subdesigns when needed. Contract names responsibility, outward guarantees and dependencies. Child links do not force ancestor hashes to include every internal detail. Decision labels: Choice/Reason required; Requires for motivating requirements; Constraints for applicable obligations; Alternative/Tradeoff for material strategies; Realizes; Evidence; Reopen for non-obvious premises. Apply the evidence matrix rather than boilerplate everywhere. Subheadings are subaddresses, not automatically new design-part types. Internal helpers can inherit coherent responsibility, not unrestricted permission.

Design-delta YAML has designDelta: 1, target design ID and expected baseline revision. H2 Add/Replace/Remove/Rename operations target parts explicitly. Replace carries the complete new part; Remove/Rename name targets and reason, Rename adds its new address. Whole-design add/remove is explicit. Coalesce repeated edits to a part; reject missing/duplicate/stale targets and ancestor/descendant overlap rather than invent ordering. A retry is already-applied only when recorded target and exact resulting state match. Construct each final document once in memory and preserve untouched formatting. Similar prose is not identity proof.

Retain approved bare [[...]] normalization/default precedence. H1 adds explicit qualified code:<repo-path>#<symbol/member>, spec:<capability>#<requirement-heading>, design:<stable-id>#<part-address>, plus package-qualified shorthand and nested heading references. Percent-escape reserved address characters. Qualified lookup respects actual module/boundary policy; unsupported policy is explicit, not allow-all. Historical lookup uses old inputs. Centralize a pinned tested Unicode case-folding implementation with spaces/underscores removed, not fuzzy search. Candidate eligibility excludes every local variable/member short name and installed dependency universe unless explicitly supported. Deduplicate aliases only with language evidence.

Initial selectors: exact identity, root-scoped path prefix/glob, concern descendants and static import/consumer relations, with conjunction/union. Implement `implements` only with reliable semantics. No universal CSS/tag/query language. Unsupported queries are unknown, not empty, and membership populations are tracked.

### P46. Managed execution and recoverable completion

One explicit Projector-enabled opl-openspec extension/schema route preserves stock merging, archive/skill guards and external backlog ownership. Do not overwrite installed caches or pretend advisory guidance overrides apply. A companion-repository integration patch needs authorization and installed-combination testing. Internal protocol proposes openRoot/read/inspectStatus/releaseRoot, beginBatch/completeBatch/checkpoint, prepareChange/validatePlan/recordEvidence/finishChange/resumeChange. The host agent makes semantic decisions; the kernel returns facts and obligations and never repairs source during a read.

Candidate phases: prepared, implementing, verifying, ready-for-integration, completed, with blocked/aborted alternatives. One managed change per candidate worktree initially; optional non-overlapping delegated scopes, no new scheduler. Accepted/proposed/actual views remain distinct. Apply/resume checks plan basis, retains justified contributions and removes/replaces invalidated ones even within a shared file. Task scheduling edits constrain planning; behavior/design/evidence edits propose authority amendments. Checkbox status is not proof. Show material plan diffs, not full repeated regeneration.

A small implementation-state.json beside change artifacts records baseline/target/phase and recovery/contribution/evidence references, and archives with the change. It is machine recovery data, not product authority. Human justification stays readable; bulk cache/logs remain external. Preserve previous target bytes in Git checkpoints or equivalent durable files, never solely the disposable database. Active evidence is protected and historical retention bounded. Finish validates actual coverage/discovery/conformance/cleanup, materializes exactly the reviewed target through supported OpenSpec behavior, archives and publishes one coherent revision when authorized. Guard expected old ref; respect PRs/user work. No long lock during reasoning, automatic main merge or fictional rollback of external services. Git publication followed by cache refresh needs recovery, not distributed transactions. Repeated finish resumes only remaining work. Blockers use existing tracker/deferral conventions, never false completion.

### P47. Evidence, tests and restrained implementation

The H1 evidence matrix requires: bound renames/moves use binding and identity preconditions plus affected-reference checks; ordinary internal work uses existing rationale and changed-contract evidence; new boundaries/strategies or withdrawn choices add credible alternatives and structural dispositions; timing/concurrency/persistence/resource claims need discriminating measurements or failure traces; new prose applicability needs a scoped assessment. Missing or stale evidence cannot pass. Actual commands/version/outcomes or verifiable artifacts matter, not an implementer writing passed. One isolated reviewer handles material changes and looks for omitted concerns, historical residue and counterexamples; reuse that review across finish while its basis holds. Routine exact mechanical work need not trigger a committee. Escalate only consequential unresolved interpretation/implementation choices with observations, viable options and Other, grouped by cause.

Deterministic T1-T9 families cover reference/authoring/delta semantics; coalescing and warm reuse; new populations/unbound artifacts; ownership/races; observation/revisions; target changes/completion; cache recovery and tool removal; resource scaling; and installed two-client operation. Use fake time/events and injected failures, not sleeps as primary correctness or paid model calls. A hundred undemanded edits then thirty-two readers must share the final required extraction; unchanged reads must do zero source I/O/hash/parse/model work. New actual files still require indexing, unlike larger unchanged background established before a benchmark. Counters track bytes/operations for reads/hashes/parses, semantic resolution, dependency visits, transactions, processes, memory/disk and exposed model usage. Mandatory stock broad checks count once.

The coupled evaluation world contains playback, provenance, evidence retention and a late consumer, not one isolated helper and not a Psychord rebuild. Three paired trajectories compare evolved with direct final-target implementation: add/remove a preview-specific strategy; revise shared machinery after another legitimate need appears; and revise/rename during partial apply followed by a new consumer. Require intended behavior, ownership, no prohibited historical residue and a settled no-op, not byte equality. Seed bad candidates before trusting evaluation: hidden consumer, invented justification, duplicate old/new path, unused framework/dependency and unsound no-op cache. Keep oracle answers from implementers while supplying legitimate facts. Initially run only three pairs, at most six participant runs, through the authorized host/model with feasible explicit ceilings. Do not add API billing or invent quota percentages. Repeat only affected failed cases. Unrun hosted/platform qualification remains unverified. This is bounded repeated evidence, not a universal statistical claim.

Milestone 0 checks only decision-changing actual seams: current repo/versions, MCP/hook behavior, OS/filesystem profile, SQLite worker access, singleton ownership and OpenSpec nested artifact/archive integration. A real failed probe may produce a short amendment naming its evidence, changed choice and downstream implications. No successful-probe essay or speculative blocker inventory. Correct technical details and proceed within the contract; escalate only a changed guarantee, unavailable required experience, permission/cost issue or pivotal product choice.

Build sequence: (1) document/delta/reference contracts and one exact revision query; (2) shared incremental kernel and cost/race tests; (3) complete managed apply/revision/finish loop and installed combination; (4) coupled clean-evolution evidence and delivery. Build one TypeScript package with responsibility boundaries, not a broad framework. Delegate only genuine independent work after interfaces settle, with explicit scope and parent-owned integration. No planning-only completion, success stubs, duplicate audit pipelines, automatic new frameworks or Psychord rescue.

Implemented means an installed end-to-end loop with truthful supported-profile behavior, not merely a checker/demo/README. Qualified for routine use additionally requires the actual host and bounded clean-evolution trials. Report exact tested version/platform/profile, commands/results, operation counts, exposed spend and limitations. No guarantee follows from ultra effort. Real host behavior, native packaging, resource costs and semantic quality still require evidence; the implementer does not need to invent the observation/discovery/cleanup architecture from scratch.

### Sources and recording boundary

Rechecked primary sources support narrow premises only: OpenAI hooks/MCP documentation, MCP stdio, SQLite WAL, Node SQLite, Watchman query synchronization and Git expected-old-ref publication. Actual plugin source remains at `071055f1229cfcc76bb0248036596a85b28e7a50`. H1 contains the relevant URLs and consequences. No runtime, installation, paid model run or product benchmark was executed to prepare the handoff. New recommendations are not silently approved. The current spec retains approval distinctions and these refinements; the capture preserves this attributed summary for replay. The downloadable handoff is separate from these two maintained repository records.

## 15. Repository handoff packaging

**U014/A012.** V4 is the active `main` branch. The immediately previous V3 main commit is preserved at `legacy/projector-main-v3`. The former `v4` branch name is retired after successful promotion.

The implementation handoff, running specification, append-only capture, and execution prompt are packaged under `.temp/handoff/`. They are agent handoff inputs, not product dependencies or runtime authority. Root `AGENTS.md` establishes a one-way isolation boundary: tracked files outside `.temp/` must not import, load, link to, cite, or otherwise depend on files under `.temp/`. If handoff information becomes necessary to the implementation, express it in the appropriate durable source/spec/design artifact outside `.temp/` rather than linking back.

The in-repository handoff prompt authorizes a destructive local checkout reset **only for the Projector repository at execution start**, because U014 explicitly requested a clean pull from `main` discarding local modifications there. The implementer then creates a short-lived implementation branch from `main` before writing product code. This operational reset does not authorize modifying the legacy branch, Psychord, or unrelated repositories.
