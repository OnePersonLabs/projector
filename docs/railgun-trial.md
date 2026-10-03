# Railgun trial: selective seam refresh

Status: both comparisons assessed on 2026-10-03. Retain current V5; the
selective-refresh candidate has no demonstrated net benefit in this trial. The user said
"go for it" and authorized limited further exploration if the pair shows no
particular difference. The initial pair and one focused follow-up are finished. Preserve their
results. No further comparison or prompt tuning is authorized by this record. No Projector runtime, hook, or workflow instruction
has changed for this trial.

Execution state: temporary fixtures and evaluator are under
`C:/Users/zethj/AppData/Local/Temp/projector-railgun-20261003-0424`. The watcher
reported failure, and its four artifacts were inspected once. All recorded agent processes stopped. `manifest.json` and the per-phase JSON events retain the
partial results. No candidate instruction has been installed.
Both arms use global revision 33, Luna high, the same copied V5 guidance and
local helper, and the same disposable workspace permissions. CLI sessions are
fresh and ephemeral; prompts and JSON events are retained by the observer.

## Decision and hypothesis

Decide whether to add selective attention refresh to V5's existing workflow.
Keep V5's Concepts, Projection Lenses, checkpoint, and native execution.

Hypothesis: refreshing the active task state when evidence changes or work
resumes helps an agent retain relevant conditions and complete the right work.
The benefit must justify additional context, actions, time, and maintenance.
Better summaries alone do not establish that benefit.

A deterministic source probe confirmed that the current handwritten JS
playback drops `velocity` and `label`, while ordinary playback retains them.
Both preserve source pitches; the explicit edit still changes them. The task
therefore requires a real change. This observation does not test the candidate.

Use one paired task: current V5 versus current V5 plus the candidate below.
This is a screening experiment. One pair cannot establish a general performance
gain or reliably separate small differences from model and host variation.
Do not combine the add/remove/refactor perspectives with this first comparison.

## Fixed task and source

Use the Clip example from Projector V5 commit
`f2f96431c96ee31a294625854ad52946274ce66e`. Capture the effective global
instructions, plugin bundle, model, effort, tool permissions, and dependency
versions used by both arms. Include uncommitted differences if present. Both
arms use the same global instructions, including any new railgun guidance.

Make two disposable, independently writable Git projects outside production
checkouts. Copy the same example, meaning, plugin, and dependency closure to
each. Activate both through the existing activation procedure. Do not change
the user's installed plugin or global instructions to switch experimental
arms. Provide the same available tools and deterministic checks. Permit local
commits in the disposable projects; prohibit pushes and external writes.

Use fresh agent contexts with no access to this experiment, its scorer, or the
other arm. Use `gpt-6-luna` at `high` effort for both: this small JavaScript task
needs multi-step constraint retention but no framework implementation. Check
model availability before running. A model substitution must apply to both
arms and be recorded. Do not retry with different models to obtain a win.
For a later authorized run, propose five active minutes per arm across both
phases. This is a spending limit, not a correctness or latency requirement.
On exhaustion, preserve the partial result and report incomplete evidence;
do not automatically rerun or extend the allowance.

Give both arms this first prompt verbatim:

> Update the JavaScript Clip playback and export paths so a playback use keeps
> every note attribute, including velocity and a label, while changing only
> pitch by the requested semitones. Playback and export must leave the saved
> Clip unchanged. Two uses at different transpositions must remain independent.
> The explicit commitTranspose operation must still edit the saved pitches.
> Scope this change and its evidence to JavaScript; keep other language coverage
> unresolved. Inspect the current source and meaning. Record the original
> directive, relevant conditions, ownership, evidence, and next action in the
> existing checkpoint .projector/work/railgun.md. Stop after that checkpoint,
> before implementation, for a planned handoff. Do not push or change anything
> outside this disposable project.

The shared handoff provides a recovery event without depending on when the
host decides to compact. It is an artificial interruption, not a test of the
host's actual compaction mechanism.

After each arm stops, make identical external changes in its project:

1. Add this complete file as `js/preview.mjs`:

   ```js
   export function previewClip(clip, semitones) {
     return clip.notes.map(note => ({
       pitch: note.pitch + semitones,
       beat: note.beat,
       duration: note.duration,
     }));
   }
   ```

2. Add `// Keep this caller-facing note during the playback change.` immediately
   after the import in `js/export.mjs`. This represents an unrelated edit in a
   relevant file. Do not commit either external change.

Resume each arm in a fresh context with the same native recovery material and
this prompt verbatim:

> Resume .projector/work/railgun.md and complete the original directive.
> Another contributor added js/preview.mjs as a playback consumer and added a
> comment in js/export.mjs during the handoff. Include the new consumer in the
> JavaScript change, preserve that comment, and inspect actual changes before
> continuing. Use the existing meaning, checkpoint, and relevant checks. Report
> supported behavior and remaining coverage accurately. Do not push or change
> anything outside this disposable project.

Supply each arm its original directive through the same native recovery
material. Do not make the baseline depend solely on an agent-written summary.
The candidate must not receive extra facts, expected answers, or recovery help.

## Candidate instruction: the only treatment difference

Provide this instruction in both phases of the candidate arm only:

> Keep the active task state selective: intended outcome, authoritative
> conditions that constrain the next decision, relevant evidence and unresolved
> assumptions, ownership, and next useful action. Keep durable state in the
> existing checkpoint; link to authority instead of copying it. Refresh this
> state when new evidence changes the decision, when a consequential worker
> return changes the plan, at handoff or resume, and when a coherent work unit
> completes. Routine tool calls and file writes need no separate refresh. Size
> the working set to the decision's dependencies. Preserve exceptions and
> contrary evidence. Each agent can have its own next action while independent
> work continues. Judge completion against the original directive and actual
> result, not the latest summary.

Do not add a controller, a second ledger, fixed concept counts, refresh timers,
mandatory planning agents, or per-call audits. Use the current V5 recovery and
verification rules in both arms.

## Independent result check

Before either run, prepare a temporary evaluator outside agent-visible files.
Derive expected values from the caller's contract. Do not use one playback
implementation as the expected output for the others. Run the same evaluator
on both final snapshots. Keep this evaluator out of the permanent test suite.

Use this input directly, without changing the saved example input:

```json
{"id":"railgun","notes":[{"pitch":60,"beat":0,"duration":1,"velocity":96,"label":"accent"},{"pitch":64,"beat":1,"duration":1,"velocity":48,"label":"soft"}]}
```

Check these outcomes through the exported functions:

| Contract | Independent expected result |
| --- | --- |
| `playback`, `handwrittenPlayback`, `exportClip`, and `previewClip` at +7 | Pitches 67 and 71; every other input attribute retained. Parse the export JSON before checking it. |
| The same paths at -12 | Pitches 48 and 52; every other input attribute retained. |
| Source isolation | The original input remains byte-equivalent in JSON after all read-time operations. Playback and preview notes are distinct objects from source notes. |
| Two simultaneous uses | Retain both +7 and -12 results and recheck them after both calls. Neither result changes the other. |
| Explicit editing exception | `commitTranspose` on a separate input copy changes its pitches to 67 and 71 and preserves other attributes. |
| Concurrent edit | The contributor's comment remains in `js/export.mjs`. |
| Scope and honesty | Existing JS checks pass; actual final evidence exercises the new consumer and attribute requirement. No unsupported claim of other-language or whole-application coverage. |

Inspect affected meaning and Lens coverage separately from the evaluator.
Discovery alone does not establish behavioral coverage. Checkpoint fluency,
extra documentation, and a larger number of checks do not earn correctness
credit. Retain actual mismatches and coverage gaps.

Blind the outcome assessment to arm labels: present final snapshots as X and Y,
then reveal the mapping after checking the contracts. Use deterministic results
and source evidence for adjudication. No additional AI judge is required.

## Measure the costs and the intended benefit

Collect native usage and timestamps for both phases of each arm. Keep setup and
evaluation costs visible but separate from agent execution. Run serially on the
same host; record run order. Do not claim one pair controls cache or server load.

| Measure | Record |
| --- | --- |
| Intended benefit | Which caller contracts held; which were omitted or weakened; whether recovery acted on current files and the new consumer. Record concrete errors, not an invented composite score. |
| Rework | Repeated inspection without a changed reason; abandoned edits; avoidable repairs; user rescue requests; and useful work completed. Link each judgment to an action or diff. |
| Time | Wall time from each phase's prompt to final result. Separate planned handoff idle time, command time, and available model time. Do not estimate unavailable subdivisions. |
| Tokens | Input, cached input, output, and reasoning tokens when the native host reports them. State whether reasoning is included in output; never double-count it. Sum native cumulative counters by deltas, or additive per-call counters once. Report raw values and available billable usage separately. |
| Process cost | Additional instruction bytes, state writes, tool calls, and time spent reading or updating the checkpoint. These are observable proxies for ongoing maintenance, not measurements of neural attention. |
| Review effort | Time for the same reviewer to understand each patch and identify its behavior, exceptions, validation, and limits. Record assessment order; small differences may be learning effects. |

If reliable token accounting or an essential correctness observation is missing,
retain that gap. Do not infer savings from a shorter answer or fewer visible
tool calls. This short task can expose immediate overhead; it cannot establish
long-term maintenance or large-project throughput.

## Decision and stopping point

Stop after the pair and independent assessment. Do not automatically repeat,
expand the benchmark, tune the prompt, or schedule maintenance trials.

- If the candidate introduces a contract violation, reject this candidate.
- If both satisfy the contracts and the candidate only adds overhead, keep
  current V5. Equal quality with lower observed cost is a promising result, but
  small differences remain inconclusive in one pair.
- If the candidate prevents a concrete baseline error or materially reduces
  evidenced rework at an acceptable added cost, recommend a reversible
  instruction-only adoption. Show the actual cost and improvement so the user
  can judge the tradeoff; no arbitrary percentage establishes acceptance.
- If evidence is mixed, missing, or too close to distinguish from variation,
  mark the result inconclusive and retain current V5. Identify the unresolved
  question before proposing any further run.

Record the checked source snapshots, environment, prompts, raw cost evidence,
contract outcomes, differences, decision, and limits in this document when an
authorized run occurs. Use the assessed findings below. Do not promote the candidate into installed
workflow guidance without evidence that its benefit justifies its cost.

## Initial result and focused follow-up

| Initial arm | Handoff phase | Resume phase | Observed result |
| --- | --- | --- | --- |
| X: current V5 | Completed in 158.407 seconds; 8 completed tool items | Stopped at the remaining 141.812 seconds; 11 completed tool items | Checkpoint exists; handwritten and new preview paths still lose attributes |
| Y: candidate | Stopped at 300.198 seconds; 18 completed tool items | Not reached | Checkpoint exists; handwritten path still loses attributes; external handoff changes were never applied |

The baseline used 300.219 active seconds in total; the candidate used 300.198.
The completed X handoff reported 363,262 input tokens, including 306,176 cached
input tokens, and 6,900 output tokens. It also reported 3,642 reasoning output
tokens. Preserve these native fields; do not add reasoning to output or assert
an independently measured billable total. Canceled phases supplied no final
usage counters. Their token totals are unknown, not zero.

Neither arm completed the requested implementation. The unequal handoff
exposure prevents a fair comparison of final contract failures. Inspection of
`X-2.jsonl` and `Y-1.jsonl` found repeated source and instruction reads. Y also
searched globs that omitted `.mjs` files and retried discovery. X encountered a
failed patch while revising the Lens. Both stderr logs reported an MCP startup
timeout after 30 seconds. These observations show real overhead and incidental
errors; they do not establish that the candidate caused them. X's checkpoint
was 6,042 bytes; Y's was 5,857 bytes. Checkpoint size alone supplies no benefit.

Use the user's explicit permission for limited further exploration for one
follow-up. This amendment supersedes the original single-pair stopping point
only for that follow-up. Preserve the original evidence and do not extend its
allowance or replay its canceled mutations.

The follow-up asks a narrower question: does the same candidate help an agent
resume and implement the contract when checkpoint construction is already
complete? It cannot establish the candidate's total two-phase cost.

Create two new copies from the same frozen source. Give both one identical,
observer-prepared checkpoint through the existing checkpoint API. Capture its
snapshot before applying the same preview consumer and contributor comment.
Retain the original behavioral directive in `DIRECTIVE.md`, excluding only the
completed checkpoint-writing and planned-stop instructions. This avoids asking
the resumed agent to repeat the completed phase. Provide both agents the same
documented CLI resume command and relevant paths. The candidate receives only
the original candidate instruction as additional text.

Use Luna high, the same global revision, tools, activation, dependency closure,
and permissions. Run candidate first, then baseline, each in a fresh context
with at most 300 active seconds. Reverse order to expose another ordering
condition, not to claim control of cache or host variation. Preserve the same
independent oracle and all original contracts, including the explicit edit,
contributor comment, JavaScript scope, and truthful evidence. Permit native
delegation under the same rules in both arms.

Save the prepared checkpoints, source manifest, exact prompts, event streams,
usage, final patches, and evaluator results under `followup/` in the existing
temporary result directory. Check source equivalence before launching. Record
any missing measurements. Stop after this follow-up, assess both results, and
retain current V5 unless the evidence supports an instruction-only adoption.
Do not launch a third comparison or tune repeatedly for a favorable result.

Independent review approved the prepared follow-up after the temporary harness
was repaired to record launch state before spawning and retain malformed-event
errors after cancellation. Reviewed harness SHA-256:
`582ad9470289ab5c8219f2e8988e9dad92605096c83e8e8403a71f3e7ea977f3`.
The reviewer verified 54 identical source files and the same failing negative
controls. Dependency contents were not part of that independent hash check;
both copies came from the same prepared bundle. Observed versions include
`glob` 13.0.6, `minimatch` 10.2.6, and `yaml` 2.9.1.

## Follow-up result and decision

The follow-up watcher reported command failure with exit code 1, without an
outer watcher timeout. Its four artifacts were inspected once. The harness
recorded both arm cancellations, no malformed events, and evaluated the actual
partial trees after the agents stopped. Do not interpret the command failure
as a behavior-test failure.

| Measure | P: candidate | Q: current V5 |
| --- | --- | --- |
| Independent behavior checks | 22 of 22 passed | 22 of 22 passed |
| Agent completion | Canceled; no final response | Canceled; no final response |
| Observed active wall time | 300.252 seconds, spending cap reached | 300.176 seconds, spending cap reached |
| Completed command/tool items | 26 | 18 |
| File-change tool items | 2 | 5 |
| Agent runs of the existing JS check | 2 | 3 |
| Final checkpoint size | 3,262 bytes | 5,461 bytes |
| Changed paths, including external edits | 7 | 7 |
| Final native token totals | Unknown | Unknown |

Both implementations preserve the tested attributes, positive and negative
transpositions, saved source, independent uses, the explicit edit, and the
contributor comment. Both extended the existing JS check and Lens coverage to
include preview. Both changed the shared example input to add velocity and
label. The independent evaluator supplied its own fixed input and expected
values, so agreement with the agents' edited fixture was not its oracle.

The candidate changed preview to call the existing playback function; the
baseline kept a direct copied-note implementation. Both are valid for the
observed contract. The candidate compressed its checkpoint and refreshed its
snapshot through the checkpoint API. The baseline preserved the original
snapshot and more explanatory text. A shorter checkpoint does not prove lower
review effort or future maintenance cost.

Both agents attempted a local commit, and Git reported permission denied while
creating `.git/index.lock`. Their stderr logs record a Windows sandbox denial.
The experiment requested `workspace-write` and `approval_policy=never`; local
commits were permitted by the prompt but failed under that host configuration.
Both preserved staged work and inspected Git state. This is a confound for
workflow completion. Do not bypass the denial or repair the disposable trees
and present the repaired result as agent performance. Both also logged the same
30-second MCP startup timeout.
The live root session has unrestricted filesystem access. These restricted
trial runs do not establish that ordinary installed V5 cannot create commits.

The candidate encountered a missing skill path and a failed Lens patch, then
recovered. The baseline revised its checkpoint prose and repeated its check
while preparing the commit. Evidence is in `P.jsonl`, `Q.jsonl`, and their stderr
logs. These action differences are observable; one pair does not establish
that the candidate instruction caused them.

The five-minute caps censor completion times. Neither run emitted a
`turn.completed` usage counter, so token savings, total token cost, and billable
cost cannot be compared. Separately timed human review effort, command/model
time subdivisions, and long-term maintenance cost were not measured. The patch
and checkpoint sizes are process proxies only. The two comparisons together
used about 20 active agent minutes, excluding fixture setup, investigation,
evaluation, independent review, and report preparation.

Decision: retain current V5. No tested contract failed in either follow-up arm,
and the candidate prevented no observed baseline error. It added 780 instruction
bytes and used eight more completed tool items, while leaving a smaller
checkpoint and using one fewer JS check run. Those mixed observations do not
justify another installed workflow obligation. This is a decision against
adoption on the available evidence, not proof that selective refresh is harmful
or never useful. Missing token and completion evidence remains unresolved.

Keep the permanent railgun experiment guidance already installed in OPL.
Keep the add/remove/refactor questions as optional planning directions in this
record. Do not add a consensus controller, mandatory agent panel, timer, or
another checkpoint system. No runtime, hook, or installed Projector workflow
instruction changed during these comparisons.

Follow-up snapshot identities:

- Candidate patch SHA-256:
  `47dff6496b1d2e8ec21b53578c2009ec9461ea94325dcf7d6c079db418514963`.
- Baseline patch SHA-256:
  `e6011af2139d6b67ec5e1ebabb59bfef8ca3c34051679a3f920aefdf5576397b`.
- Exact prompts, manifests, checkpoints, negative controls, event streams,
  partial patches, and positive evaluator outcomes remain under `followup/`
  in the temporary evidence directory named above. No third run is planned.

## Separate idea: extension, structural change, removal

The source was found at `/home/zethj/dev/consensus-rnd` in WSL. Its
`skills/consensus-loop/SKILL.md:2540-2566` and `prompts/solver-minimal.md`,
`prompts/solver-structural.md`, and `prompts/solver-delete.md` describe three
blind, parallel solvers: minimal, structural, and delete. A fourth meta-judge
follows them. The checkout has no Git metadata; the observed source is not
bound to a revision. These proposed lightweight questions borrow its competing
perspectives without adopting its orchestration:

- Add: what missing capability or observation would resolve the problem?
- Remove: what unnecessary obligation, dependency, or mechanism creates it?
- Refactor: what change in representation or ownership would resolve it and
  reduce the cognitive load of future work?

Use a perspective only when it could change a consequential choice. Give every
alternative the same goal, constraints, evidence, and correctness obligations.
A perspective is a search direction, not a requirement to add, delete, or
restructure something. Keep the full intended outcome and its constraints;
do not reduce the goal to make a plan smaller. Keeping the current design
remains a valid outcome.

Do not require three agents on ordinary tasks. A single agent can consider the
questions cheaply, although that supplies no independence claim. If independent
alternatives later justify their cost, use fresh bounded agents, retain their
different mechanisms and contrary evidence, and choose by a discriminating
check. Agreement alone does not establish correctness. Evaluate that addition
separately after the seam-refresh decision, using an observed planning failure
that the perspectives could address.
