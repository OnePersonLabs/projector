# Preserve intent through observable, recoverable change

Status: proposed design, 2026-09-10. No implementation or canonical acceptance is claimed. Recipient baseline: `043a7c32e62f3e8319fe5a0e4bfc54d949a9f096`.

## Recommendation

Make Projector's existing conceptual control plane close the loop between an accepted behavioral commitment, a real change, the application behavior that results, and what the next change teaches us. Preserve one authority model and one accepted mutation lifecycle. Make evidence and handoffs portable across agents; keep the host responsible for using agents where they help.

The useful assimilation is a connected system with four changes:

1. [P1 -- Bind application behavior to accepted scenarios](proposals/P1-application-evidence.md). Deliver the missing observation path and make completion consume it honestly.
2. [P2 -- Make contributions and continuation state-bound](proposals/P2-contributions-and-continuation.md). Let independent agents produce bounded contributions that join into one concrete, reviewable change, and let a fresh session recover what remains trustworthy.
3. [P3 -- Turn failures into scoped corrections](proposals/P3-correction-and-governance.md). Use counterexamples to repair code, context, tests, tools, or architecture at the actual fault; promote reusable constraints only when justified.
4. [P4 -- Evaluate the next change](proposals/P4-longitudinal-evaluation.md). Establish whether these mechanisms preserve behavior and make subsequent work easier, with matched trajectories and deliberately changed conditions.

These are delivery boundaries within one goal, not a proposal per donor document. P1 supplies observations; P2 supplies bounded work and provenance; P3 converts discrepancies into corrections; P4 tests whether the combined system helps. Any component must remain useful without an autonomous agent scheduler or hosted service.

## What changes for a user

Consider a repository containing a small application that imports jobs, displays progress, and lets users cancel them. This is an illustrative workload, not a claim about an existing Projector fixture or Psychord requirement.

Today an agent can retrieve relevant meaning, propose exact edits, obtain a controlled apply, run pinned repository validators, and reconcile. However, a browser observation is not connected to that public acceptance lifecycle, and general work-packet machinery does not make the public single-packet compiler a working multi-agent scheduler.

In the proposed system, a request to add cancellation first retrieves the existing cancellation and resource-release obligations. Two agents can separately inspect backend behavior and UI behavior using the same bound context. They return evidence and candidate edits with input and output identities. The coordinator resolves their shared contract and joins the exact edits. Projector presents one concrete plan and retains the existing approval and transaction semantics.

An isolated run then exercises cancellation. A pinned test controller observes the relevant state transition, the absence of a late completion event, and the displayed result. A screenshot remains useful diagnostic evidence, but assertions and run identity determine the bounded acceptance claim. A failed setup is unavailable evidence; a cancellation assertion that fails is a behavioral failure. Neither becomes a green completion flag.

A fresh session can inspect the current scenario obligations, retained context, captured contribution provenance, transaction recovery state, and application evidence. It can reuse an unrelated UI inspection after a documentation edit. It must reconsider a result when the cancellation event schema or test controller changed, including when Git HEAD stayed the same.

Later, retries are added. The old design accidentally lets a cancelled job be restarted. Projector exposes the affected scenario and decision, not a global demand to rewrite every module. A paired test distinguishes a retryable failure from a deliberate cancellation. The repair may be a local conditional, a shared state transition, or a revised requirement; the evidence must determine which. A rule requiring a particular class hierarchy would need a separate justification.

Finally, evaluation compares this two-change history with a capable ordinary agent using the same task, tools, tests and budget. It counts setup, failed attempts, model use, review and semantic maintenance. It can conclude that Projector costs more on this workload. Useful delivery proceeds on demonstrated behavior; superiority is a separate claim requiring comparative evidence.

Psychord remains the first demanding application target already named by accepted meaning. The selected first observation is its existing web-internal C-major triad Recognition scenario, with source, oracle limits and an optional separate-container collection design pinned in [APPLICATION-PILOT.md](APPLICATION-PILOT.md). This design does not invent Psychord product behavior or authorize modifying that repository in this investigation.

## What to preserve and what to reshape

Preserve stable semantic identities, typed canonical meaning, scope-aware decisions, executable lenses, relevance before edit selection, value/query-bound invalidation, independent validator sources, writer leases, exact approval, journals, and the distinction between host edits and controlled execution. These are the receiving mechanisms, not new donor discoveries.

Reshape the gaps around those mechanisms:

- Application observations become first-class evidence consumers of scenarios and validators, with an explicit trusted collection boundary.
- Domain specialization lives in a concrete adapter, test/fixture, tool affordance, or existing lens. It does not require an agent persona, a new ontology for every task, or a replacement host.
- Collaboration is a graph of bound contributions and dependencies rendered from actual work. One agent with one contribution is valid. Cycles, fan-out and extra reviewers are not benefits by themselves.
- Continuation is a projection of current context and lifecycle evidence. It is not `features.json`, a second task database, or a mutable pass/fail checklist.
- Failure feedback can remove a bad constraint or fix a tool. It need not add another rule.
- Quality is tested through behavior under later changes. Complexity and verbosity are diagnostics with provenance, not universal measures of maintainability.

## Architecture across all levels

| Level | Current base | Proposed alteration | Boundary that remains |
|---|---|---|---|
| Product | Standalone conceptual control plane; future obligations retained | User can inspect why a change is ready, what observed behavior supports it, and what a new session must revisit | No claim of universal correctness, autonomous completion, or lower cost |
| Intent | Requirements, scenarios, concepts and relations | Refine existing runtime-evidence, completion, invalidation, reconsideration and self-hosted-value meaning; add only genuinely new contribution/scenario commitments | Stable identities and provenance; no donor-shaped requirement copies |
| Architecture | Concerns, decisions, authorities | Decide collector trust, contribution admission, correction promotion and evaluation scope with alternatives and reconsideration conditions | A proposed design document does not accept a canonical decision |
| Lenses | Selectors, constraints, pinned validators | Bind affected application checks to a declared evidence profile; validate candidate constraints in shadow mode before adoption | Neither frequency nor an agent-written test creates authority |
| Representation | Human, compact agent, machine projections | Derive a bounded handoff/continuation view with exact omission counts and links to evidence | No competing prose specification or compressed-away obligations |
| Knowledge | Bound context and relevance graph | Include scenario evidence dependencies and contribution provenance only where relevant | Relevance hypotheses are not exact impact edges |
| Deterministic engine | Identity, state/query binding, governance, invalidation | Add pure admission, evidence eligibility and correction classification where reusable | No browser, process, vendor or database dependency in core/engine |
| Control plane | Repository compilation, observation, apply/recovery, coverage | Orchestrate application runs, import/join contributions, derive continuation and scoped correction views | One public repository compiler/executor and one mutation authority |
| Runtime | Files, Git worktrees, process sandbox, journal, SQLite | Own isolated run resources, bounded artifacts, process cleanup and interrupted-run recovery | Private run ownership cannot authorize host network or arbitrary deletion |
| Integrations | Host/model/MCP/surface adapters | Concrete application observation adapter and honest capability reporting | Host tools return evidence; their success text cannot issue a change certificate |
| CLI/plugin | MCP reads plus controlled CLI workflow | Expose observation/inspection and contribution-aware capture using production handlers; derive concise host guidance | A declared catalog name is not an implemented operation |
| Persistence | Versioned accepted records; local runtime evidence | Runtime manifests and immutable capture attachments; retained failure diagnostics; rebuildable indexes | Cloning meaning does not recreate historical runs or live capabilities |
| Security | Independent Git-base validators, immutable overlays, network denial | Separate application-run capability from repository-node validation; prove private resources and collector identity | No widening existing sandbox policy by calling a browser test a validator |
| Parallelism | Public lifecycle permits one mutation packet | Parallel host research/candidate generation; authenticated join; serial accepted mutation | No speculative approvals, generic graph executor, or automatic semantic merge |
| Validation | Strong local tests; broad advantage unestablished | Real application survival cases, cross-session tests, held-out later changes and paired perturbations | Generated tests and proxy metrics do not become an independent oracle |
| Delivery/economics | Lean useful delivery, bounded checks | Stage by risky boundary; measure total cost and maintenance burden; retain future scope explicitly | Comparative research does not block an otherwise verified useful release |

The [shared design](DESIGN.md) defines ownership, trust transitions, schemas, failure behavior and migration. The proposals provide the what/why, stories, exact spec delta references, design decisions and concrete task lists.

## Choices explicitly rejected

Do not import geometric model training, latent-space representations or a graph database into Projector. A mathematical graph of program dependencies, an agent work graph and a model's latent geometry have different semantics. Useful perturbation tests survive without those claims.

Do not adopt universal run resets, a fixed roster of agent roles, maximum-detail specifications, unconditional full-suite checks at every handoff, or automatic lint rules after every mistake. Each can increase cost, hide a faulty oracle, or create new semantic debt.

Do not use research headline scores as Projector release gates. Do not substitute code-size ratios, checkpoint statistics or agents grading themselves for measured downstream success. Do not treat a source title as proof of its body, nor treat a real named technology as fake simply because its claims are overstated.

## Value and delivery order

Start with P1's trust boundary and one real application scenario. Establish P4's comparison protocol before exposing held-out later tasks, but keep the experiment off the release-critical path. Deliver P2 first as host-produced contributions imported into exact capture, so it needs no scheduler. Exercise P3 on a real observed failure before adding generalized ranking or promotion machinery. Run a composed fresh-session/later-change trial once those paths exist.

The endpoint of this campaign is the design package, its unapplied spec changeset and reviewed implementation plan. The proposed implementation succeeds when a real affected scenario can be exercised, its evidence survives an honest restart or fails currentness honestly, independent contributions can be joined without weakening approval, and a later counterexample reaches the right correction owner. Net economic advantage remains an empirical question.
