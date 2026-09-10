"""Generate the reviewed, unapplied historical-spec changeset in this directory."""
from pathlib import Path
import difflib
import hashlib
import json
import shutil

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
inventory = json.loads((HERE / 'source-hashes.json').read_text(encoding='utf-8-sig'))
for item in inventory:
    actual = hashlib.sha256((ROOT / item['path']).read_bytes()).hexdigest()
    if actual != item['sha256']:
        raise SystemExit(f"Source changed. Refresh design before regenerating: {item['path']}")

changes = {}
owners = {}

def change(proposal, name, transform):
    path = 'PROJECTOR_SPEC/' + name
    if path in owners:
        raise ValueError(f'Duplicate spec owner: {path}')
    owners[path] = proposal
    source = ROOT / path
    before = source.read_text(encoding='utf-8') if source.exists() else ''
    after = transform(before)
    if before == after:
        raise ValueError(f'No change produced: {path}')
    changes[path] = (before, after)

def append(proposal, name, body):
    change(proposal, name, lambda before: before.rstrip() + '\n\n' + body.strip() + '\n')

def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError(f'Expected unique anchor: {old[:100]}')
    return text.replace(old, new, 1)

def root_spec(before):
    before = replace_once(before, '## Authoritative Implementation Specification', '## Historical implementation design and acceptance evidence')
    before = replace_once(before, '**Status:** Normative implementation handoff  ', '**Status:** Historical design and transitional acceptance input. Current acceptance is in typed Projector records')
    start = before.index('## Authority and composition\n')
    end = before.index('\n---', start)
    return before[:start] + '''## Authority and composition

Accepted product meaning lives in typed `.projector/model/` records. Executable architecture lives in `.projector/lenses/`, `.projector/decisions/`, and `.projector/authorities/`. Those records remain claims to check against user intent and current evidence.

`PROJECTOR_SPEC` preserves historical design, rationale, and transitional acceptance-inventory input. Its older normative wording does not establish current acceptance or implementation. Proposed revisions require explicit acceptance through the current conceptual model and architecture lifecycle.

- `SPEC.md` records product identity, composition, the causal loop, and disclosure routes.
- Modules in `spec.manifest.json` record their historical subsystem design. Typed contracts own executable machine shapes and schema generation.
- `INDEX.md` is navigation. It introduces no independent requirement.
- Resolve contradictions explicitly and preserve provenance. Neither a summary nor a stored status proves implementation.
- Preserve unrealized commitments when implementing a bounded slice. Historical delivery plans are not the current work queue.
- Changes to acceptance inputs require coordinated canonical/test-inventory validation. Editing prose alone does not change the accepted model or executable behavior.

The application-evidence, contribution, correction, and longitudinal-evaluation contracts describe one conceptual control loop. They add no parallel requirement, progress, or approval store.
''' + before[end:]

change('P1', 'SPEC.md', root_spec)

def index_spec(before):
    before = replace_once(before, 'This index routes readers and agents to authoritative modules without requiring full-spec ingestion. It is navigation, not an independent source of requirements.', 'This index routes readers to historical design and transitional acceptance-input modules. Accepted meaning and executable architecture live in typed `.projector/` records. This index creates no independent requirements or implementation claims.')
    anchor = '- [Persistence and Observation](09-evolution/persistence-and-observation.md)'
    at = before.index('\n', before.index(anchor))
    return before[:at] + '\n- [Application Evidence](09-evolution/application-evidence.md) -- concrete application runs, collector trust, scenario binding, evidence admission, and recovery.' + before[at:]

change('P1', 'INDEX.md', index_spec)

def manifest_spec(before):
    value = json.loads(before)
    new = {'path': '09-evolution/application-evidence.md', 'tags': ['application-evidence', 'runtime', 'validation']}
    if any(row['path'] == new['path'] for row in value['modules']):
        raise ValueError('Application module already registered')
    index = next(i for i, row in enumerate(value['modules']) if row['path'] == '09-evolution/persistence-and-observation.md')
    value['modules'].insert(index + 1, new)
    return json.dumps(value, indent=2, ensure_ascii=False) + '\n'

change('P1', 'spec.manifest.json', manifest_spec)
change('P1', '09-evolution/application-evidence.md', lambda _: """# Application Evidence

## Purpose and ownership

Application evidence connects accepted behavior to an actual run through the shared JavaScript operation runner. It supplies observations for existing validation and completion contracts. It creates no new authority plane or pass-status store.

The first workload is Psychord-omega's keyboard performance, local moment saving, reload, and replay. Existing personal-archive, replay-provenance, player-authorship, local-privacy, and first-musical-minute concepts own its purpose. Accept a specific scenario before execution. Replay must not add player events. Saving failure must remain visible and preserve earlier data. Acoustic output, physical MIDI, device latency, and musical learning remain outside this initial claim.

Core owns portable contracts. The engine evaluates supplied evidence through ports. Integrations own the application/controller adapter. Runtime owns ordinary host processes and artifacts. The control plane composes admission, currentness, validation, coverage, and lifecycle consumers.

## Run and evidence contract

A run request MUST identify scenario IDs/hashes, bound context, adapter/profile version, and actual source/build inputs. It MUST identify fixture/configuration, controller/helper dependencies, toolchain, required oracle, limits, and expected assurance.

A host-owned manifest MUST record run/attempt, actual served-build and endpoint identity, setup/readiness/cleanup outcomes, and collection interval. Artifact references bind content, type, size, collection method, origin, and retention. Use existing Evidence, ValidationResult, StateBinding, and CompletionContract contracts where they already express these responsibilities.

Keep operational status, behavioral outcome, currentness, and assurance separate. Successful setup or process exit does not prove behavior. Missing setup capability is unavailable evidence. A historical failure remains a historical failure after its inputs become stale.

A screenshot, URL, timestamp, or Git HEAD alone MUST NOT establish a current application claim. A validator entry-file hash does not prove its transitive dependency cone. Broad observable inputs require broad dependency binding or an explicit unknown result.

## Host-controlled collection

Use the host's configured permissions. The initial adapter prepares a pinned build, starts an owned loopback static server on an allocated port, and drives a pinned browser controller. Do not reuse an existing server. Bind served resource bytes and the controller's endpoint/run observations to the prepared build. Use fresh browser storage and retain controller diagnostics outside page state.

This lane assumes a trusted workspace and host. Separate processes, browser contexts, nonce checks, and hashes do not establish adversarial confinement or authenticated independence. Same-user code can tamper with collection. Do not claim host-network denial, read-only mounts, immutable overlays, or descendant containment without actual enforcement. This adapter satisfies only its accepted host-observed application scenario. It MUST NOT report confinement or device-level obligations as fulfilled by these observations.

Freeze reviewed oracle inputs independently of candidate edits and validate their identity at use. A before/after hash cannot prove hostile code never changed and restored bytes. Source independence does not prove oracle correctness. Candidate app output cannot select its own assurance.

Host permissions govern execution. This application adapter does not recreate a mandatory Projector sandbox, WSL bridge, Docker service, general provisioning language, or separate mutation executor.

## Admission, failure, and recovery

Admit observations only at their demonstrated assurance and current dependency scope. Required lifecycle evidence must be declared in the concrete plan. Ordinary host observations do not gain controlled-execution certificates.

Keep setup failure, unavailable capability, failed assertion, stale evidence, and incomplete cleanup distinct. Preserve bounded failure artifacts. Stop or clean only resources identified as owned by this attempt. Interruption cannot authorize killing another server or replaying external user effects.

A finalized manifest may be published idempotently. An interrupted run remains interrupted unless actual evidence completes it. Missing artifacts after a clone are unavailable, not recreated historical successes.

## Verification and migration

Exercise the actual keyboard/save/reload/replay path and no-input, save-failure, wrong-build, stale-controller, and interrupted-cleanup controls. Fake-port domain tests supplement the browser result. Test units, thresholds, and device claims only where accepted meaning and actual instrumentation support them.

Version new runtime shapes through the existing migration system. Preserve old evidence and approval interpretation. Never upgrade legacy screenshots or pass flags into authenticated observations. Apply this transitional spec delta after the owning implementation and checks complete, before final canonical parity and spec retirement.
""")

append('P1', '02-semantic-kernel/conceptual-architecture.md', '''## Behavioral evidence in the existing planes

Accepted scenarios in the Intent plane define the claim. Lenses and validation contracts define required checks. A concrete application run is an observed Surface, and its collected results enter the observed shadow with provenance and currentness. The engine evaluates eligibility. The control plane reconciles it against accepted obligations.

Application manifests and continuation views are derived operational artifacts. They MUST NOT become a fourth authority plane. A collector records observations. A validator evaluates a bounded claim. An accepted decision authorizes governance. No one of these roles may manufacture independent support for itself.
''')
append('P1', '02-semantic-kernel/reference-implementation.md', """## Application evidence composition

The control plane owns evidence admission, currentness, lifecycle integration, and coverage. Integrations implement the scenario/controller adapter. Runtime owns host processes, artifact custody, and cleanup. Core owns portable contracts. Engine logic operates on injected values and ports.

Skills and the shared operation runner compose existing services. The first application adapter uses host-controlled build/server/browser processes and explicit trusted-workspace assurance. It introduces no mandatory container daemon or custom confinement backend. Unavailable capabilities remain unavailable.

Use existing packages. Do not import browser or process implementations into core or engine. Preserve one accepted repository mutation lifecycle and remove obsolete transport consumers through their owning implementation changes.
""")
append('P1', '03-knowledge/evidence-and-authority.md', '''## Collected application evidence

Distinguish four questions: who collected the observation, what behavior it records, whether its dependencies remain current, and what assurance the collection supports. A content hash answers none of those questions without its producer and binding contract.

Admitted runtime evidence MUST bind the actual application/build, scenario, controller dependency cone, fixtures/configuration, toolchain, adapter and demonstrated capabilities. The host controller owns the manifest outside page state under an explicit trusted-workspace assumption. Candidate application output MUST NOT choose its own provenance, independence, or assurance. Host custody alone does not defeat same-user tampering.

Source separation does not establish oracle correctness. A pinned test may still encode a mistaken interpretation. Shared generated tests, copied examples, and same-lens artifacts remain correlated evidence. Preserve contradictions and historical failed observations when later collection is unavailable.
''')
append('P1', '06-reconciliation/coverage-and-completion.md', '''## Behavioral fulfillment and continuation

A mapped scenario is not behaviorally fulfilled until its required current evidence is admitted. Successful application setup, a process exit, worker completion, a historical receipt, or a mutable progress flag is insufficient. Keep scenario outcome, evidence currentness, assurance, and operational completion separate.

Derive bounded continuation from accepted meaning, current context/evidence and the existing lifecycle's recovery state. Show usable results, invalidated inputs, missing required evidence, remaining obligations and the next supported action. Report total/included/omitted counts and expansion routes. Do not introduce a second feature, answer, or completion ledger.

An unavailable browser/audio/device lane remains an explicit unrealized obligation. Do not broaden mappings or remove requirements to make a bounded delivery appear complete. Useful delivery may proceed at its demonstrated scope without a claim of whole-product completion or comparative advantage.
''')
append('P1', '09-evolution/persistence-and-observation.md', '''## Operational artifacts and historical observations

Application run manifests and existing lifecycle artifacts are versioned operational evidence under current runtime ownership. Their indexes are rebuildable. The historical external observations themselves are not reconstructible from current source. Missing uncopied artifacts after cloning remain unavailable.

Version new runtime contracts and preserve old capture readers and hash semantics. Never migrate screenshots or pass flags into authenticated successful runs. Write attachments atomically before referencing them. Validate size, hash, ownership and version when admitting them. Preserve failed and interrupted observations within declared retention limits.

Retaining a historical observation does not keep it current. Reevaluate its actual dependency and capability inputs before reuse. A current source snapshot or cache rebuild cannot manufacture a missing past run.
''')

append('P2', '05-projections/execution-capsules.md', """## Readable work and exact execution instructions

Host agents may prepare bounded investigations and candidate edits using saved context. Their notes name the objective, relied-on context, outputs, unresolved conditions, and evidence limits. Notes are advisory and do not authorize mutation or prove validation ran.

Ordinary conceptual reading needs no mutation approval. Exact plan-bound instruction inspection must work before approval to support review. Execution requires current dependencies, the appropriate authority, and actual delivery of the selected instructions. Keep integrity, currentness, semantic fidelity, authorization, and delivery distinct.

Reuse existing representation and lifecycle artifacts across session reset. Preserve required conditions, provenance, omission counts, and drill-down routes. Do not add a competing handoff renderer or progress authority.
""")
append('P2', '07-change/plans.md', """## Host preparation and current continuation

The host owns candidate notes and files before exact capture. The coordinator resolves shared contracts and observes the combined result before submitting one concrete proposal. Disjoint paths and worker success do not prove semantic compatibility. Missing required investigation remains explicit.

The existing proposal, plan, approval, and currentness contracts govern accepted mutation. Reconcile saved value/query dependencies before reuse, including relevant dirty edits and changed empty-query membership. Refresh affected reasoning without discarding independently current work.

Derive bounded continuation from saved context, plans, approvals, attempts, recovery state, and current evidence. Report missing local artifacts as unavailable. No new contribution importer, approval hash profile, scheduler, or mutable completion store is required for this host-owned workflow.
""")
append('P2', '07-change/transactions-and-certificates.md', """## Concrete capture after independent preparation

Host-native parallel preparation precedes exact capture. The coordinator resolves conflicts and submits final concrete edits through the existing one-packet repository lifecycle. Do not approve unknown future work or invoke a second packet executor.

Worker notes remain advisory. They cannot substitute for required observed validation or broaden approval. Combined edits require their own current observation, governing checks, exact plan, and valid approval.

Recover previous mutation from authenticated approval, attempt, journal, and prepared-success evidence. Missing preparation notes cannot obstruct safe rollback or idempotent publication of a committed authenticated result. Missing prepared-success proof cannot be fabricated. Recovery must not rerun committed effects.

""")
append('P2', '08-agents/orchestration-and-models.md', """## Optional host orchestration

Logical roles describe responsibilities, not a mandatory process/model roster. Use existing host tools and deterministic operations first. Parallelize materially independent preparation with explicit ownership, a bounded deliverable, and a coordinator who resolves shared contracts.

Reuse useful context and agents. Bound retries, time, cost, and required results. A missing result cannot disappear inside a convincing summary. A fresh reviewer is not independent evidence when it shares the same mistaken oracle.

Domain specialization belongs in the narrowest useful tool, adapter, context, or existing lens. It does not require a recursive runtime, graph database, or durable memory service. One agent and one concrete change remain valid.
""")
append('P2', '08-agents/hosts-and-mcp.md', """## Supported host composition and completion

The skills-and-scripts direction uses one shared JavaScript runner over existing TypeScript services. Retire obsolete MCP/standalone-CLI delivery and wrapper chains as their real consumers move. Do not keep shims solely to preserve obsolete names.

Observe actual repository content and value/query dependencies before reuse or effects. Git HEAD and porcelain status alone cannot detect changed bytes in an already dirty file. Capability discovery must describe implemented and actually available operations.

Process exit, parser checks, and host success text do not establish semantic fulfillment. Repair a legacy dispatch path only for a required supported consumer. Otherwise retire it after preserving active-host behavior. Current context, required behavioral evidence, and the existing lifecycle determine their respective claims.
""")

append('P3', '03-knowledge/architecture-concerns-and-validity.md', '''## Observed counterexamples and correction scope

A behavioral failure or incompatible contribution may expose a material architecture concern. Reference its affected accepted obligation, actual observation, plausible cause, alternative explanations and a discriminating check. Deterministically observed failure is not automatically proof of its proposed cause.

Reconsider only affected decisions and scope. Unsupported causal claims remain inferred or unknown. A correction may revise or retire a faulty constraint. Existing prevalence and historical approval are not reasons to preserve a disproved premise.

An isolated local defect does not require a new concern, rule or shadow-evaluation workflow. Use those mechanisms only when evidence makes an architectural choice or reusable enforcement material. Preserve unrelated accepted meaning and historical rationale.
''')
append('P3', '04-governance/lenses.md', '''## Counterexample-driven enforcement

Before proposing reusable enforcement, identify the actual producer or recurrence mechanism, or a concrete security, privacy, data-loss or release-safety invariant. Evaluate the proposed scope against independent positive/negative cases and intentional variants. State maintenance cost, evidence limits and reconsideration conditions.

Copies, generated conformity and static complexity/verbosity metrics cannot authorize a lens. A legitimate alternate implementation that satisfies accepted behavior is counterevidence to an overbroad rule. Narrow, reject, revise or retire that rule through existing authority rather than adding exceptions solely to preserve it.

Shadow evaluation is conditional on proposing reusable enforcement. A local repair may complete without adding a rule, validator or policy. Repository-wide recurrence guards require the applicable explicit authority. Diagnosis itself does not grant it.
''')
append('P3', '06-reconciliation/reconciliation-and-divergence.md', '''## Failure evidence and bounded correction

Keep setup/capability failure, stale evidence, failed behavioral assertion and incompatible contribution contracts distinct. Preserve original observations when later analysis or collection is unavailable. Attach new evidence to stable affected obligations instead of introducing an incident or answer ledger.

Route the next action to the implicated implementation, oracle, adapter, context or accepted architecture. Use the smallest discriminating check that can change the decision. A claimed root cause remains a hypothesis until supported by intervention or other adequate evidence.

Do not require whole-run reset after every defect. Preserve unaffected valid work and use existing transaction recovery. Restart a broader scope only when compromised inputs, a failed shared premise or unrecoverable state justifies it. No restart may erase another worker's changes or the evidence of failed attempts.

When diagnosis supports only local repair, use the existing change route without compulsory shadow-rule or architecture-product work. When accepted governance changes, retain the existing concern/decision/authority and actual consequence-product requirements.
''')
append('P3', '09-evolution/historical-evaluation-and-research.md', '''## Paired probes and causal restraint

A paired semantic probe changes a justified condition that should change behavior and defines both expected outcomes independently of the candidate implementation. An irrelevant-change control checks stability. Pair success requires both answers to be correct, not merely different. Count invalid pairs and oracle errors separately.

Use these probes for a concrete correction or shadow-lens decision. Do not infer a model's internal reasoning mechanism, intelligence score or software-graph performance from a perturbation result. Training-data information measures do not authorize Projector architecture.

An LLM diagnosis, co-change correlation or static score may suggest a cause. Replay or intervene on the smallest material factor before reporting a causal effect. Otherwise retain the hypothesis and counterevidence. Generalize a correction only when its recurrence or invariant and scope justify the additional enforcement.
''')

append('P4', '11-validation/testing-and-adversarial-evaluation.md', '''## Later-change acceptance and optional comparison

For a comparative claim, evaluate short sequences of real changes from matched initial states. Both arms receive the same task information, tools, model versions and resource policy at each checkpoint. A capable ordinary-agent baseline may use search, tests, concise notes and selective subagents. The Projector arm includes semantic setup and maintenance costs.

Preserve each arm's accumulated code and restart the agent between changes. Withhold later requirements until the same reveal in both arms. Grade the new behavior and prior regressions separately using predeclared, separately sourced oracles. Do not leak a future requirement into only one arm's initial conceptual model.

Include a relevant dependency change under unchanged HEAD, new empty-query membership, validator drift, an unrelated-edit control and a real answer-changing condition. Keep failed, timed-out, unavailable and aborted attempts in the report with their actual costs. Rerun only under a declared policy that preserves the initial result.

Required self-hosting acceptance executes a real Projector change and a subsequent affected change in fresh sessions with the historical spec absent. Use existing tests and public operations. A general trajectory driver or multi-repository study is not required. Comparative live trials are separate, opt-in, and budgeted.
''')
append('P4', '11-validation/benchmarks-and-redesign-criteria.md', '''## Scope of thresholds and comparative claims

The numeric gates above are historical workload-bound engineering hypotheses. Preserve their concrete safety invariants. Do not apply an arbitrary inherited threshold as a universal maintainability measure or prerequisite for every useful release. New performance thresholds require an identified workload, denominator, oracle and decision consequence.

Report matched later-change outcomes, prior regressions, setup/unavailable/timeout categories, total observed cost and uncertainty separately. Static code metrics remain diagnostics with language, tool, version and extraction limits. Human repository histories are calibration rather than a causal baseline unless development tasks and conditions are matched.

Count failed attempts, review and repair, evidence collection, context/model use, deterministic time, and semantic maintenance. Missing prices or labor measurements remain unavailable, not zero. Amortize setup only over the observed horizon. Do not hide failure inside one aggregate quality or slop score.

Useful delivery requires appropriate behavioral verification. Broad comparative advantage requires separate measured evidence and MUST NOT be inferred from those checks. Lack of demonstrated superiority does not by itself block a useful bounded release. Distinguish premise, design, implementation and evaluation failures. Test a plausible bounded correction when it could change the decision.
''')
append('P4', '10-operation/observability-and-reporting.md', '''## Trajectory outcomes and complete cost

Optional comparative reports bind task/arm/checkpoint/attempt identities, source snapshots, model/tool/adapter versions, reveal schedule, grading contract and raw output references. Record newly requested behavior, prior regressions, setup errors, timeouts, unavailable capabilities and abandoned attempts separately.

Required self-hosting receipts record actual outcomes and bounded observed costs using existing reporting. No new telemetry platform is required. Cost records distinguish setup, retrieval/context, model and tool use, deterministic work, evidence collection, human review/repair and canonical maintenance. Preserve actual units and pricing provenance. Missing costs are unavailable. A context reduction or low token price is not a measured total-cost advantage.

Every diagnostic metric identifies its tool/version, population/denominator, extraction failures and causal origin. Report counts and paired differences with uncertainty. Checkpoints from one repository are not independent samples. A judge's causal label remains a hypothesis without adequate intervention evidence. Do not omit unsuccessful trajectories or count same-lens artifacts as independent authority support.
''')

patches = {key: [] for key in ('P1', 'P2', 'P3', 'P4')}
manifest = []
for path in sorted(changes):
    before, after = changes[path]
    proposal = owners[path]
    lines = [f'diff --git a/{path} b/{path}\n']
    if not before:
        lines.append('new file mode 100644\n')
    lines.extend(difflib.unified_diff(before.splitlines(True), after.splitlines(True), fromfile=('a/' + path) if before else '/dev/null', tofile='b/' + path))
    patches[proposal].append(''.join(lines))
    manifest.append({'proposal': proposal, 'path': path, 'operation': 'modify' if before else 'add', 'sourceSha256': hashlib.sha256((ROOT/path).read_bytes()).hexdigest() if before else None, 'proposedTextSha256': hashlib.sha256(after.encode()).hexdigest()})

for proposal, chunks in patches.items():
    (HERE / f'{proposal}.patch').write_text(''.join(chunks), encoding='utf-8', newline='\n')
(HERE / 'PROJECTOR_SPEC.patch').write_text(''.join(''.join(patches[p]) for p in patches), encoding='utf-8', newline='\n')
(HERE / 'change-manifest.json').write_text(json.dumps({'baseline': '043a7c32e62f3e8319fe5a0e4bfc54d949a9f096', 'status': 'proposed-unapplied', 'changes': manifest}, indent=2) + '\n', encoding='utf-8')

mirror = HERE / 'review-tree' / 'PROJECTOR_SPEC'
shutil.copytree(ROOT / 'PROJECTOR_SPEC', mirror, dirs_exist_ok=True)
for path, (_, after) in changes.items():
    target = HERE / 'review-tree' / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(after, encoding='utf-8', newline='\n')
print(json.dumps({'files': len(changes), 'perProposal': {p: sum(owner == p for owner in owners.values()) for p in patches}, 'mirror': str(mirror)}, indent=2))
