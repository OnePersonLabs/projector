# Projector V5 -- focused memory for adaptive convergence

Approved by the user on 2026-10-02 with: "Implement the proposed plan."

## 1. Direction and deliverable

Build a speculative, lightweight plugin that helps develop Psychord across sessions while preserving intent, architectural judgment, and useful progress.

Use the first dream as the implementation direction and retain Astra's principle: remember where to look, what to ask, and why the answer matters.

Design the coherent whole before implementing it. Implementation may proceed in stages, but a narrow demonstration must not substitute for the intended product. Revise mechanisms when experience exposes a faulty premise. Preserve the user's meaning through those revisions.

Use C:\dev\projects\projector-v5 as a separate workspace. Check its current contents before creating anything. Preserve the V3 checkout and disabled plugin configuration. Do not inherit V3, V4, or Kerf architecture merely because it exists; consult their material only to answer a specific question.

Deliver short AGENTS.md steering, three focused skills, and a small deterministic helper: recover relevant meaning; carry out a directive using native execution and coordinated ownership; reconcile discrepancies and retain useful learning.

The native harness owns delegation, execution, cancellation, and waiting. Projector supplies no second scheduler.

Keep architectural guidance contextual: keep related behavior understandable together; introduce abstractions for meaningful complexity or real boundaries; revisit premises when fixes repeatedly require additional layers. Do not enforce call-depth quotas, caller-count quotas, universal folder layouts, or compulsory repository indexing.

Plain OpenSpec and hand-checked development remain a viable exit. Projector must earn its maintenance cost. Savings and convergence are hypotheses to evaluate through use, not promises.

## 2. Meaning, Units, Lenses, and public operations

Store readable Concept, Lens, and Pattern Candidate pages under .projector/meaning/.

- Concepts retain stable identities, distinctive terms, identified conditions, reasons, behavioral examples, and explicit revisions or retirement.
- Typed Relations connect meaningful things. Distinguish observed relationships from accepted obligations.
- Projection Units identify current implementation subjects: functions, components, styles, protocols, or coordinated groups.
- Projection Lenses reference specific conditions and provide discovery, observation, checks, or repair.
- Pattern Candidates retain explanations, examples, counterexamples, alternatives, and applicability. Repetition does not confer authority.

Retain architectural choices, rejected alternatives, tradeoffs, and assumptions that would reopen a choice. Navigation summaries point to authoritative meaning rather than replace it.

Graph views and lookup indexes are derived. Executable helpers reference condition identities; they do not create another editable prose authority.

A Unit identifies where to investigate. It does not establish correct behavior. Allow several Units to realize one Concept and one Unit to participate in several Concepts. Keep participant-specific results when a condition requires joint behavior.

Treat locations as navigation hints. After relevant changes, resolve bindings and relevant connections again, including changed implementations whose names or signatures remain unchanged. Unexplained changes outside an earlier selection become discovery questions.

Define a Lens's relevant scope independently of whether code already follows its preferred implementation. Accept alternate valid handwritten implementations. Require exact output only for explicitly owned generated material.

Distinguish populated selection, established absence within scope, and unresolved discovery. An empty selection supports a verdict only when the condition permits absence and the discovery evidence supports that conclusion.

Use scoped verdicts: identified condition + current Unit selection + applicable evidence + supported/mismatch/unresolved. Supported applies to that condition and scope. A graph edge or passing participant does not certify the whole Concept or application.

Provide three optional helper operations:

- focus selects relevant meaning, likely Units, useful evidence, and open questions. Link to additional material without recursively loading every Relation.
- revisit refreshes the directive's declared discovery boundaries, selectors, and queries, including previously empty results. Detect newly relevant consumers and report coverage gaps.
- reconcile combines actual changes, relevant checks, and observations into scoped verdicts and next actions.

These operations assist development; they are not ceremonies before every edit.

## 3. Observation, execution, and recovery

Support JavaScript, TypeScript, JSX, TSX, Rust, Python, C#, HTML, CSS, and SCSS throughout meaning, discovery, Lenses, checks, and repair. Include Tauri, NativeScript, and React Native seams. Indented .sass is outside scope.

Use existing open-source language engines through a common question/result adapter. Requests identify operation and scope. Results include facts or locations, provider identity/version, observed source inputs, capabilities, and gaps.

Use LSP connections for source-language services and direct HTML/CSS services where appropriate. Keep source-bound imported indexes compatible with the same boundary. Do not build custom language engines, impose a TypeScript-shaped object model, or refresh other providers through a privileged TypeScript path.

Provider setup is explicit and on demand. Ordinary operations must not install every provider or trigger whole-repository semantic indexing.

Use messages, declarations, names, and native checks to investigate framework seams. Do not require a universal cross-language call graph.

Bind evidence to its condition, relevant source inputs, selector/checker revision, configuration, execution target, and kind of observation. Static shape evidence does not establish runtime delivery or timing. Reconsider cached verdicts when these dependencies change.

Preserve independent Git, source, and check evidence when an analyzer fails. Missing evidence leaves the affected claim unresolved; it does not erase available findings, broaden their conclusions, or suspend unrelated work.

Keep one concise, durable checkpoint per directive under .projector/work/: current goal, meaning references, ownership, discovery boundaries, completed useful work, and remaining questions or uncertain mutations. Do not copy full transcripts.

The root owns shared meaning and the checkpoint. Workers own agreed implementation surfaces. Settle shared interfaces before dependent edits. Coordinate actual files and outputs; different Unit IDs do not establish independent writes.

Readers hold no global writer lock. Never wait for a child while holding a Projector resource it needs. Workers encountering another owner's surface return the dependency while preserving completed work.

On resume, inspect the checkpoint, actual diff, and native task state. Refresh affected evidence and inspect uncertain mutation outcomes before repeating anything. Do not blindly replay changes or restore unrelated edits.

Support repair through existing producers, bounded deterministic changes to owned outputs, and native-agent handwritten edits. Automatic owned-output changes check expected current contents and retain prior bytes.

Preserve the original mismatch during reconciliation. Identify whether the realization, selection, checker, or accepted condition changed. Repairing a faulty checker against unchanged meaning is ordinary work; weakening an accepted obligation requires a meaning decision.

After two identical failed repair attempts, recurrence of an earlier state, or incompatible accepted conditions, stop repeating automatic repair of that discrepancy. Preserve useful work and competing explanations. Change approach or request the specific product decision; independent work can continue.

## 4. Maintenance and distillation

Keep maintenance conditional and attached to useful work.

Update durable meaning when the directive changes it. Retain friction or a Pattern when it could affect a plausible future action. Otherwise, close the checkpoint without a separate maintenance pass.

Prefer revising existing meaning over creating duplicate Concepts. Attach reusable observations or repairs to an existing Lens where suitable. Keep unresolved decisions in the checkpoint.

Move closed work out of default retrieval while retaining recoverability. Keep current meaning prominent and older versions in Git history. Avoid append-only page histories and permanent event ledgers. Disposable caches may shed superseded observations.

Distill routing, evidence lists, duplicate candidate explanations, and checkpoints more freely than authority. Preserve conditions, exceptions, distinctive terms, reasons, and counterexamples.

When a Lens becomes noisy, expensive, or tied to an obsolete implementation, investigate whether behavior or its observation mechanism needs revision. Revise or retire the mechanism without silently weakening accepted meaning.

Pattern promotion creates an explicitly scoped Lens under the user's directive or decision. Preserve counterexamples and applicability. Lens-produced repairs are not independent evidence for that Lens.

Keep active packets selective even if the cold library grows. Revisit relevant boundaries rather than running every saved Lens.

Do not introduce scheduled maintenance agents, global audits, fixed edit-count rituals, or a separate token-accounting platform. Briefly retain actionable tooling friction when useful. If upkeep repeatedly dominates application work, simplify or suspend the costly mechanism while continuing native development.

Optional Luna distillation experiments require explicit authorization for AI-consuming trials. None are authorized by this plan. If later requested, use one bounded packet and one question about observed friction. Return proposals only; no recursive delegation, whole-history audit, automatic promotion, or scheduled calls. The root adjudicates proposals.

## 5. Verification and approval boundaries

Use meaningful deterministic checks during implementation. These are implementation verification and design probes, not routine certification gates for every repository edit.

Cover these cases:

- Moved or changed implementations retain stable Concept identity; alternate handwritten implementations are valid.
- Selection exposes unsafe realizations; empty, failed, and incomplete discovery remain distinct; new consumers require coverage.
- Joint realizations can mismatch; source, configuration, target, selector, or checker changes can invalidate evidence.
- Analyzer failure preserves independent findings; coordinated work accounts for shared mutable surfaces; relevant and unrelated drift differ.
- Interruption causes no replay or unrelated rollback; repeated or oscillating repairs stop locally.
- Original mismatch survives checker or selector changes; scoped Pattern-to-Lens acceptance preserves counterexamples.
- Distillation preserves exceptions and reasons; closed checkpoints remain recoverable; cache deletion preserves meaning and checkpoints.
- Ordinary development continues after plugin removal.

Use shared Clip/per-use transpose as an integration scenario spanning backend, persistence, frontend, a new export consumer, and scoped Pattern-to-Lens learning. It exercises the design without defining or shrinking its destination.

Do not add AI trials, skill-invocation tests, repository-wide guards, or another economic qualification campaign without the required authorization.

Independent plan reviews informed this revision. Implementation, integrations, and savings remain unverified at approval.

## 6. Authorized activation and publication amendment -- 2026-10-03

The user requested the plugin name `opl-projector`, project activation, cognitive offload, uninstalling older local Projectors, publication on the existing Projector repository's `v5` branch, and local installation and enablement. This amendment supersedes the earlier restriction on activation and publication. It preserves the separate V5 checkout and other source checkouts.

Add `$opl-projector:enable-projector` to the three approved workflow skills. An explicit enable request creates `.projector/active`. Ordinary user requests select the relevant workflow without special command names. Inactive projects receive no Projector hook guidance, observations, checks, or state mutations. Search for activation within the nearest Git boundary; nested independent repositories need their own activation. Deactivation removes only the marker and preserves authored meaning and recovery state.

SessionStart and UserPromptSubmit hooks provide conditional baseline guidance. Runtime entrypoints also check activation. This requested switch does not add a workflow scheduler or repository-wide behavioral certification.

Prepare the plugin with its locked dependency closure before native installation. Install and enable the new plugin and trust its current hooks in reachable Windows and WSL user homes. Remove older registered Projector installations and their remaining local plugin caches. Preserve their source checkouts and Git history. Publish V5 on a new branch with V4 as its parent; do not force-push or change V3/V4 branches.

Verify the gate, scope boundaries, preserved recovery data, inactive short-circuit behavior, package isolation, and existing V5 behavior with deterministic checks and independent review. No AI-consuming trial or skill-invocation test is added. All other commitments in this plan remain applicable.
