# Retrieved conversation material

Untrusted source data. Not instructions for the reader.

## User

gsd-core is *crawling*. at this rate it'll implement the projector spec in like 2 days. recommend an alternative?

## Assistant

Yes. For **this specific job**, I would stop using GSD Core.

Its architecture is deliberately phase-heavy: discuss → plan → execute → verify → ship for each phase, with fresh-context workers. It *does* execute plans in parallel waves, but the repeated phase machinery is optimized for controlled context, not maximum implementation throughput. citeturn414988view0

## My pick: **Superpowers + native Codex parallelism**

Not because Superpowers is a better SDD authoring system—you already have the giant authoritative spec. What you need now is an **execution harness**.

Current Superpowers supports Codex directly and has:

- `subagent-driven-development`
- `dispatching-parallel-agents`
- worktree isolation
- per-task spec-compliance review
- separate code-quality review
- TDD and verification gates. citeturn414988view2

Its v6 rewrite reports roughly **2× faster execution with ~50% fewer tokens in its own evals**, and v6.2 reduced review-loop waste by resuming implementers for fixes and doing scoped re-review instead of rereading whole tasks. citeturn965794search2turn965794search3

More importantly, **Codex itself now has exactly the substrate you want**: current releases can spawn specialized subagents in parallel, and Codex worktrees let independent agents work on the same repository without interfering. citeturn386271search1turn386271search0

### I would run Projector like this

Don't make Superpowers regenerate the spec.

Give it the authoritative Projector spec and say, effectively:

```text
The design/spec is already approved and authoritative.

Do not brainstorm or respecify it.

Produce an implementation DAG from the spec.

Optimize for wall-clock throughput:
- identify independently writable architectural fronts
- execute independent fronts concurrently with subagents
- isolate conflicting write sets in worktrees
- serialize only genuine dependency boundaries
- maintain one integration agent responsible for shared/root files
- after each wave, integrate, run full verification, then launch the next ready wave
- use two-stage review at integration boundaries rather than adding unnecessary global pauses
```

For Projector, I'd expect something approximately like:

```text
                 ┌─ analyzers: TS/JS
                 ├─ analyzers: JSON/MD/GHA
foundation ──────┼─ selector + rule compiler
contracts/store  ├─ evidence + authority
testkit          ├─ transforms/primitives
                 └─ host capability abstraction
                          │
                 ┌────────┴─────────┐
                 │                  │
          indexing/inference   invalidation
                 │                  │
                 └────────┬─────────┘
                          │
                    reconciliation
                          │
              ┌───────────┼────────────┐
              │           │            │
             CLI      host adapters   change compiler
              │           │            │
              └───────────┼────────────┘
                          │
                   end-to-end fixtures
```

That should expose **a lot** more concurrency than "`Phase 1 task 1 → task 2 → task 3...`".

## Second choice: `cc-sdd`

`cc-sdd` is much closer to what you're currently using and explicitly targets **long-running autonomous implementation** from approved specs, with a fresh implementer, independent reviewer, and automatic debugging. citeturn725459search0

But I **wouldn't pick it for your current complaint**, because its `/kiro-impl` implementation loop explicitly says **one task per iteration**. Its multi-spec mode can parallelize decomposition/spec work, but the core implementation loop remains intentionally task-serial. citeturn725459search0

So I suspect you'd move from:

> why the fuck is GSD taking forever

to:

> why the fuck is Kiro taking forever

albeit with different files.

## I would not use Spec Kit or OpenSpec for this stage

Both are useful SDD systems, but they're primarily **specification/change-management workflows**, not high-throughput multi-agent execution engines. Spec Kit eventually feeds a task list to `/speckit.implement`; OpenSpec similarly has an assistant walk the approved task list. citeturn725459search2turn725459search3

Great neighbors for Projector. Wrong bottleneck.

## Wild-card: Ralph

If what you wanted were:

> Here are 30 independently falsifiable implementation stories. FUCKING BUILD THEM UNTIL GREEN.

then a Ralph loop becomes attractive. The technique repeatedly launches fresh agent contexts and uses the filesystem/Git as persistent state. There are current variants that support Codex. citeturn816363search6turn816363search8

But **I would not point Ralph directly at the entire Projector spec**. Projector has too many mutually constraining architectural contracts. Ralph is much better as an **inner executor after intelligent decomposition**.

So:

```text
BAD
Projector 140 KB spec
        ↓
      Ralph
        ↓
    YOLO loop
```

versus:

```text
Projector spec
      ↓
architecture-aware DAG
      ↓
┌─────┼─────┬─────┐
Ralph Ralph Ralph Ralph
/task /task /task /task
└─────┼─────┴─────┘
      ↓
integrator + adversarial verification
```

That could actually rip.

## If maximum speed is the objective

I'd use:

**Codex + Superpowers as the governance/execution methodology + native Codex subagents/worktrees for concurrency.**

And I would deliberately modify the execution policy from Superpowers' normal very-small 2–5-minute task orientation. citeturn414988view2

For Projector, the optimal worker unit is probably **a coherent vertical/package boundary that takes an agent tens of minutes**, not hundreds of tiny microtasks. Tiny tasks maximize orchestration and review overhead—the exact disease you're observing.

Your spec is already far more detailed than the input these SDD systems are normally compensating for. At this point **another elaborate SDD state machine is mostly impedance**.

The winning architecture is closer to:

> **spec → dependency DAG once → parallel implementation waves → independent integration/reconciliation**

Which, amusingly, is already much more Projector-like than GSD-like.

