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
    before = replace_once(before, '## Authoritative Implementation Specification', '## Historical implementation design and contract input')
    before = replace_once(before, '**Status:** Normative implementation handoff', '**Status:** Historical design and legacy contract input. Current acceptance is in typed Projector records')
    start = before.index('## Authority and composition\n')
    end = before.index('\n---', start)
    return before[:start] + '''## Authority and composition

Accepted product meaning lives in typed `.projector/model/` records. Executable architecture lives in `.projector/lenses/`, `.projector/decisions/`, and `.projector/authorities/`. Those records remain claims to check against user intent and current evidence.

`PROJECTOR_SPEC` preserves historical design, rationale, and legacy contract-generation input. Its older normative wording does not establish current acceptance or implementation. Proposed revisions require explicit acceptance through the current conceptual model and architecture lifecycle.

- `SPEC.md` records product identity, composition, the causal loop, and disclosure routes.
- Modules in `spec.manifest.json` own their historical subsystem contracts. Keep each exported contract in one owning module.
- `INDEX.md` is navigation. It introduces no independent requirement.
- Resolve contradictions explicitly and preserve provenance. Neither a summary nor a stored status proves implementation.
- Preserve unrealized commitments when implementing a bounded slice. Historical delivery plans are not the current work queue.
- Changes to historical contract input require coordinated domain/schema/generator validation. Editing prose alone does not change the accepted model or executable behavior.

The application-evidence, contribution, correction, and longitudinal-evaluation contracts describe one conceptual control loop. They add no parallel requirement, progress, or approval store.
''' + before[end:]

change('P1', 'SPEC.md', root_spec)

def index_spec(before):
    before = replace_once(before, 'This index routes readers and agents to authoritative modules without requiring full-spec ingestion. It is navigation, not an independent source of requirements.', 'This index routes readers to historical design and legacy contract-input modules. Accepted meaning and executable architecture live in typed `.projector/` records. This index creates no independent requirements or implementation claims.')
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
change('P1', '09-evolution/application-evidence.md', lambda _: '''# Application Evidence

## Purpose and ownership

Application evidence connects an accepted Behavioral Scenario to an actual application run. It supplies observations for the existing validation and completion contracts. It creates no new authority plane or pass-status store.

The first concrete workload is the existing Psychord web-internal C-major triad Recognition path. Its controller checks Harmony triad/major, Technique chord gesture, and PitchEar chord-quality evidence through the real shared runtime. A no-injection control and a broken-finalization variant distinguish a useful oracle from a success-shaped display. This initial claim excludes acoustic output, physical MIDI, device latency, and human musical learning. Those obligations remain visible.

Core owns portable contracts. The engine evaluates evidence eligibility through ports. Integrations own the concrete application/controller adapter. Runtime owns isolated resources and immutable artifacts. The control plane composes admission, currentness, validation, coverage, and lifecycle consumers.

## Run and evidence contract

A run request MUST identify accepted scenario IDs/hashes, bound context, adapter/profile version, and actual source or build inputs. It MUST also identify fixture/configuration, controller dependencies, resource policy, required oracle, and limits.

A runtime-owned manifest MUST record run/attempt, launched build/container identities, engine/toolchain, and observed capabilities. It MUST also record setup/readiness/cleanup outcomes, collection interval, artifact references, and incomplete evidence. Artifact references MUST bind content hash, type, size, collection method, causal origin, and retention policy.

Keep operational status, behavioral outcome, currentness, and assurance separate. Successful setup or process exit does not prove behavior. A failed assertion is a behavioral failure. Missing setup capability is unavailable evidence. A historical failure remains a historical failure after its inputs become stale.

Use the existing Evidence, ValidationResult, StateBinding, CompletionContract, and derivation contracts. Add a narrow typed run binding where needed. A screenshot, URL, timestamp, or Git HEAD alone MUST NOT establish a current application claim. A validator entry-file hash does not prove its entire dependency cone.

## Concrete private application profile

The initial optional profile uses Docker Engine Linux containers and a separate Playwright controller. The trusted Projector supervisor runs outside the build, app, and controller containers. The existing network-denied repository-node validator and WSL bubblewrap route remain unchanged. Docker is not required for the semantic engine or ordinary repository lifecycle.

The profile MUST validate a local engine endpoint. Remote engine contexts are unsupported initially. It MUST pin compatible images, browser/controller dependencies, source snapshot, internal build mode, assets, fixtures, and configuration. Dependency acquisition is a separate authorized preparation step. Evidence collection MUST NOT silently fetch missing dependencies.

Build scripts run in a disposable container without controller inputs, host credentials, daemon access, or evidence-store access. Serve the actual frozen internal build from the app container. Disable reuse of existing or externally selected application servers. Preserve the distinction between internal Dev Workbench artifacts and production artifacts.

Use a private internal network with isolated gateway mode for enabled address families. Do not publish ports, attach a default external network, expose a host gateway, or mount a daemon socket. Internal-network mode alone does not prove denial of gateway-host services. Capability probes MUST verify host-service, external-address, and DNS escape denial.

The controller MUST have a separate filesystem/process namespace, non-root browser sandbox, explicit seccomp policy, private bounded shared memory, and resource limits. Do not use privileged mode, host IPC, or extra administrator capabilities. The app MUST NOT access controller output, process state, manifests, or supervisor authentication material. The controller MUST NOT expose an automation/debug listener to the app.

The supervisor creates and inspects exact engine object identities and reads controller results through its own attached channel. It imports bounded artifacts from controller-owned storage and writes the manifest outside candidate containers. App stdout is application evidence, not controller protocol. Hashing or signing app-supplied manifest fields alone is insufficient authentication.

The engine/VM and supervisor are explicit trusted computing base. Unsupported isolation or collection capabilities produce unavailable evidence. The profile MUST NOT fall back to a developer browser/server or broaden the existing validator policy.

## Admission and freshness

The control plane admits only supervisor-owned run records with validated contract, artifact integrity, actual instance/controller identity, observed capability evidence, and current dependencies. Host-provided screenshots or diagnostics MAY support investigation at a separately declared assurance. They MUST NOT become strong evidence merely through hashing or a claimed independence label.

Bind the actual observable input population. If a controller can read the whole repository, use that wider validity boundary unless a narrower enforced dependency contract exists. Reevaluate changed source/build, scenario, controller/helpers, fixture/configuration, toolchain, adapter, capability, and relevant query membership. Unchanged structure does not waive required behavioral checks.

Coverage MUST keep mapping distinct from behavioral fulfillment. A required missing, stale, failed, or unavailable evidence lane prevents its completion claim. Preserve unaffected evidence only when the dependency proof supports reuse. Report omissions and expansion routes explicitly.

## Lifecycle and recovery

Observation is no-exec by default. Application setup and collection require an explicit declared action policy. A controlled plan includes its actual required collector/capability inputs before approval. The existing mutation coordinator, writer lease, independent validation, journal, and prepared-success protocol remain the only accepted repository write route.

Collection after ordinary host edits MAY supply useful evidence. It does not issue a controlled-execution certificate for those edits. A transaction certificate describes only its concrete state, supported behavior, and modeled boundary.

Interrupted runs retain bounded diagnostics and explicit incomplete state. Cleanup acts only on authenticated owned engine object IDs, never names or identifiers supplied by the app. Missing ownership proof requires an explicit recovery result. Finalized manifests publish idempotently. An old run record does not imply an old live service still exists.

Store raw logs, traces, screenshots, and run manifests locally under existing runtime ownership. A clone can recover accepted meaning and adapter configuration, but cannot recreate uncopied observations. Legacy screenshots and flags remain legacy evidence. Migration MUST NOT manufacture authenticated passes or rewrite old approvals/certificates.

## Required survival cases

Verify stale/substituted builds, changed controller dependencies, tampered artifacts, fake app-supplied controller output, and controller-output/process access. Also verify host/network escape, stale endpoints, missing assets, no-injection and broken-finalization behavior, and interruption before/after finalization. The declared profile must verify owned-resource cleanup.

These checks establish only the tested profile and scenario. They do not prove a correct oracle, a trustworthy compromised engine/kernel, every device capability, or economic advantage.
''')

append('P1', '02-semantic-kernel/conceptual-architecture.md', '''## Behavioral evidence in the existing planes

Accepted scenarios in the Intent plane define the claim. Lenses and validation contracts define required checks. A concrete application run is an observed Surface, and its collected results enter the observed shadow with provenance and currentness. The engine evaluates eligibility. The control plane reconciles it against accepted obligations.

Application manifests, contribution graphs, and continuation views are derived operational artifacts. They MUST NOT become a fourth authority plane. A collector records observations. A validator evaluates a bounded claim. An accepted decision authorizes governance. No one of these roles may manufacture independent support for itself.
''')
append('P1', '02-semantic-kernel/reference-implementation.md', '''## Application evidence composition

The control plane owns application-evidence admission, currentness, lifecycle integration, and coverage views. Integrations implement the concrete scenario/controller adapter. Runtime owns isolated processes, resources, immutable artifact custody, and cleanup. Core owns portable contracts. Engine logic operates only on injected values and ports.

The initial optional application profile uses a local Docker Engine with separate application and Playwright-controller containers. It does not replace the existing WSL/bubblewrap repository validator or require a daemon for normal semantic operation. A missing profile capability is unavailable, not implicit permission to use host resources.

Use the existing packages. Split a package only for an actual release, security, performance, or dependency-isolation need. Do not import browser/process/engine-client implementations into core or engine, or create a second repository executor to support contribution-shaped inputs.
''')
append('P1', '03-knowledge/evidence-and-authority.md', '''## Collected application evidence

Distinguish four questions: who collected the observation, what behavior it records, whether its dependencies remain current, and what assurance the collection supports. A content hash answers none of those questions without its producer and binding contract.

Admitted runtime evidence MUST bind the actual application/build, scenario, controller dependency cone, fixtures/configuration, toolchain, adapter and demonstrated capabilities. The trusted supervisor owns the manifest outside candidate execution. Candidate application output MUST NOT choose its own provenance, independence, or assurance.

Source separation does not establish oracle correctness. A pinned test may still encode a mistaken interpretation. Shared generated tests, copied examples, and same-lens artifacts remain correlated evidence. Preserve contradictions and historical failed observations when later collection is unavailable.
''')
append('P1', '06-reconciliation/coverage-and-completion.md', '''## Behavioral fulfillment and continuation

A mapped scenario is not behaviorally fulfilled until its required current evidence is admitted. Successful application setup, a process exit, worker completion, a historical receipt, or a mutable progress flag is insufficient. Keep scenario outcome, evidence currentness, assurance, and operational completion separate.

Derive bounded continuation from accepted meaning, current context/evidence and the existing lifecycle's recovery state. Show usable results, invalidated inputs, missing required evidence, remaining obligations and the next supported action. Report total/included/omitted counts and expansion routes. Do not introduce a second feature, answer, or completion ledger.

An unavailable browser/audio/device lane remains an explicit unrealized obligation. Do not broaden mappings or remove requirements to make a bounded delivery appear complete. Useful delivery may proceed at its demonstrated scope without a claim of whole-product completion or comparative advantage.
''')
append('P1', '09-evolution/persistence-and-observation.md', '''## Operational artifacts and historical observations

Application run manifests and contribution attachments are immutable operational evidence under existing runtime ownership. Their indexes are rebuildable. The historical external observations themselves are not reconstructible from current source. Missing uncopied artifacts after cloning remain unavailable.

Version new runtime contracts and preserve old capture readers and hash semantics. Never migrate screenshots or pass flags into authenticated successful runs. Write attachments atomically before referencing them. Validate size, hash, ownership and version when admitting them. Preserve failed and interrupted observations within declared retention limits.

Retaining a historical observation does not keep it current. Reevaluate its actual dependency and capability inputs before reuse. A current source snapshot or cache rebuild cannot manufacture a missing past run.
''')

append('P2', '05-projections/execution-capsules.md', '''## Bound contributions and readable handoffs

A host MAY use saved context to prepare read-only investigations or isolated candidate edits. A contribution contract MUST identify the objective, result schema/version, exact context, value/query dependencies, and required/optional predecessors. It MUST also identify producer attempt, output/evidence references, effect scope, semantic owners, unresolved conditions, and omissions.

Candidate preparation is not accepted mutation. Do not force a read-only contribution through a mutation packet that requires write selectors. Context isolation does not establish process, credential, or causal-evidence isolation. A worker's complete status describes only its contribution.

The returned summary MUST preserve required conditions, evidence references and unknowns. A short handoff does not permit dropping governing meaning. A one-agent contribution is valid. No fixed role roster or fan-out is required.
''')
append('P2', '07-change/plans.md', '''## Contributions before capture and current continuation

Before an exact proposal exists, the host owns its candidate files. A saved context and content-derived work contract may identify that preparation without creating another SemanticChange or managed workflow store. Missing pre-capture files are unavailable evidence, not proof that preparation completed.

Capture imports frozen contributions and joins them into an exact proposal. The strict versioned proposal includes complete contribution-envelope hashes and the join contract/result digest. These contribute to proposal and SemanticChange identity and the approved plan input-evidence digest. Equal edits/state with different admitted evidence MUST produce different capture/plan identities.

Required predecessor absence, hash/version mismatch, stale value/query input, and unresolved shared-contract conflict prevent readiness. Optional omission remains visible. Disjoint paths alone do not establish semantic independence. Changed joined content requires a new capture and approval. A predecessor-capture link is provenance only.

Continuation is derived from current context and authenticated lifecycle evidence. Carry forward useful work only while its bindings hold. Recover prior transactions before new mutation. Native pre-capture scheduling, automatic semantic merge and general partial multi-packet commits remain future capabilities, not assumptions of this bounded contribution path.
''')
append('P2', '07-change/transactions-and-certificates.md', '''## Immutable contribution admission

The first public contribution path retains one accepted mutation packet through the repository lifecycle. Parallel host research/candidate production occurs before capture. It MUST NOT invoke a second packet executor or approve unknown future edits.

Capture freezes imported bytes, verifies envelope/result schemas, value/query currentness, predecessor outcomes, semantic ownership, conflicts and relevant governance, then compiles one exact proposal. Worker reports and same-packet tests remain evidence claims until the combined diff is independently observed and validated.

Hash complete versioned envelopes, including producer/provenance, required/optional status, unresolved conditions and omissions. Bind the canonical envelope set and join contract/result digests into the strict proposal hash and existing intent/SemanticChange derivation. Bind an explicit plan input-evidence digest into approval. Store-only attachment metadata is insufficient. Preserve old proposal profiles and hash domains.

Plan, approve and new apply MUST authenticate required immutable attachments against that bound digest. Same edits and repository state with changed admitted evidence require a different capture/plan and cannot reuse approval. Missing or substituted evidence blocks new acceptance/effects that require it.

Recovery follows the already authenticated approval/attempt/journal/prepared-success chain. Missing candidate attachments alone MUST NOT obstruct safe rollback or idempotent publication of an already authenticated historical committed result. Missing prepared-success proof cannot be fabricated. Recovery MUST NOT rerun committed effects or create a fresh completion claim to compensate for lost evidence. Report current evidence availability separately from historical transaction state.
''')
append('P2', '08-agents/orchestration-and-models.md', '''## Optional scheduling and bounded joins

Logical roles describe responsibilities, not a mandatory process/model roster. A loop is a graph pattern. A graph may be sequential. Use deterministic operations and existing host tools first. Parallelize preparation only when the work is materially independent and an explicit join handles dependencies and conflicts.

Bound retries, cost, cancellation and required/optional results. A missing required result cannot disappear inside a convincing merge. A fresh agent or different model is not automatically independent evidence when it shares the same oracle or selected context.

Domain specialization belongs in the narrowest useful tool, adapter, context or existing lens. It does not require a custom recursive agent runtime, universal shell/filesystem access, or a new durable memory service. Model routing claims require task-matched outcome and complete escalation/retry cost evidence. Lower price per token is insufficient.
''')
append('P2', '08-agents/hosts-and-mcp.md', '''## Capability and completion honesty

Distinguish declared tools, registered production handlers, capability-proven host integration and actually exercised workflows. Do not advertise every catalog entry as callable. Probe required features rather than reporting them true because an executable exists.

Before admitting host contributions or effects, observe actual repository content and validate value/query dependencies. Git HEAD and porcelain status alone do not detect changed bytes in an already dirty file. Saved or synthetic canonical/toolchain digests are not current-state evidence.

A zero process exit, allowed path set, parser check or fixed-point status is not independent semantic completion. The public host wrapper MUST report only its supported assurance and route accepted repository mutation through the existing lifecycle. Do not use its weaker completion result as a contribution-join or application-evidence certificate.

Use existing host subagents/tools before duplicating their runtime. Host-produced candidate files remain untrusted until frozen and admitted by the contribution-aware capture path. Generated instructions remain bounded projections of the same contracts.
''')

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

append('P4', '11-validation/testing-and-adversarial-evaluation.md', '''## Matched longitudinal evaluation

Evaluate short sequences of real changes from matched initial states. Both arms receive the same task information, tools, model versions and resource policy at each checkpoint. A capable ordinary-agent baseline may use search, tests, concise notes and selective subagents. The Projector arm includes semantic setup and maintenance costs.

Preserve each arm's accumulated code and restart the agent between changes. Withhold later requirements until the same reveal in both arms. Grade the new behavior and prior regressions separately using predeclared, separately sourced oracles. Do not leak a future requirement into only one arm's initial conceptual model.

Include a relevant dependency change under unchanged HEAD, new empty-query membership, validator drift, an unrelated-edit control and a real answer-changing condition. Keep failed, timed-out, unavailable and aborted attempts in the report with their actual costs. Rerun only under a declared policy that preserves the initial result.

Use a small multi-chain pilot to test feasibility, not population-level superiority. Repeat or expand when stochastic uncertainty could change the decision. Use targeted ablations or replayed interventions only for a material remaining attribution question. Default automated checks remain model-free. Live trials are opt-in and budgeted.
''')
append('P4', '11-validation/benchmarks-and-redesign-criteria.md', '''## Scope of thresholds and comparative claims

The numeric gates above are historical workload-bound engineering hypotheses. Preserve their concrete safety invariants. Do not apply an arbitrary inherited threshold as a universal maintainability measure or prerequisite for every useful release. New performance thresholds require an identified workload, denominator, oracle and decision consequence.

Report matched later-change outcomes, prior regressions, setup/unavailable/timeout categories, total observed cost and uncertainty separately. Static code metrics remain diagnostics with language, tool, version and extraction limits. Human repository histories are calibration rather than a causal baseline unless development tasks and conditions are matched.

Count failed attempts, review and repair, evidence collection, context/model use, deterministic time, and semantic maintenance. Missing prices or labor measurements remain unavailable, not zero. Amortize setup only over the observed horizon. Do not hide failure inside one aggregate quality or slop score.

Useful delivery requires appropriate behavioral verification. Broad comparative advantage requires separate measured evidence and MUST NOT be inferred from those checks. Lack of demonstrated superiority does not by itself block a useful bounded release. Distinguish premise, design, implementation and evaluation failures. Test a plausible bounded correction when it could change the decision.
''')
append('P4', '10-operation/observability-and-reporting.md', '''## Trajectory outcomes and complete cost

Longitudinal reports bind task/arm/checkpoint/attempt identities, source snapshots, model/tool/adapter versions, reveal schedule, grading contract and raw output references. Record newly requested behavior, prior regressions, setup errors, timeouts, unavailable capabilities and abandoned attempts separately.

Cost records distinguish setup, retrieval/context, model and tool use, deterministic work, evidence collection, human review/repair and canonical maintenance. Preserve actual units and pricing provenance. Missing costs are unavailable. A context reduction or low token price is not a measured total-cost advantage.

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
