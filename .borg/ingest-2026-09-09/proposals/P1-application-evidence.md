# P1 -- Bind real application observations to accepted behavior

Proposed, revised after wrap-up integration review on 2026-09-10. Implementation owner: wrap-up Task 7, after its shared runner, execution and migration prerequisites. This replaces the earlier Docker/legacy-CLI design.

## What and why

Close the existing runtime-evidence commitment through one real Psychord-omega workflow. A useful result states what ran, what the controller observed, what failed, which inputs remain current, and what the host's permissions actually guarantee. This lets the agent distinguish an old screenshot, wrong server, setup failure and actual behavioral failure.

Use the approved shared JavaScript runner and host execution. Preserve pinned oracle/source inputs, exact change authorization and journal recovery. Retire obsolete sandbox/CLI/MCP machinery through its owning wrap-up tasks. No Docker product or new mandatory confinement backend is required.

## Stories

- Two worktrees show the same UI. The controller reaches the wrong server; endpoint and served-byte identity reject its evidence.
- A player keeps a moment and reloads. The saved performance survives. Replaying it adds no player events. A controller assertion and stored trace substantiate that bounded behavior.
- Storage rejects a save. The application reports failure and preserves prior data; an optimistic success message fails the oracle.
- A session stops during collection. The next operation reports incomplete evidence and cleans only resources owned by that attempt, preserving another worktree's server.
- A controller or relevant dirty input changes with HEAD unchanged. The observation becomes stale. Unrelated edits preserve it only when the dependency proof supports that conclusion.

## Design

[APPLICATION-PILOT.md](../APPLICATION-PILOT.md) selects the existing Psychord-omega free-play/save/replay slice and exact oracle limits. Existing canonical concepts own the intent; the repository currently lacks a separate scenario record for this flow, so first accept a narrow scenario derived from those concepts. Do not invent a musical-learning or acoustic correctness claim.

The host runner prepares a pinned application build, starts its own loopback static server on an allocated port, and launches a pinned Playwright controller with fresh browser storage. The server/controller bind actual served bytes, endpoint and run identity to the manifest. Controller output is collected outside the app's page state. Dependencies include build inputs, controller and helper code, fixture/configuration, toolchain and capability observations. A before/after digest alone cannot prove hostile code never modified and restored bytes.

This is evidence under a trusted-workspace/host assumption. Same-user code or a compromised host can tamper with it. Separate processes, hashes, browser contexts and a nonce do not establish OS confinement, anti-forgery independence or host-network denial. Tasks 2.2 and 4.7 explicitly revise the old mandatory confinement contract before this adapter is accepted. P1 must demonstrate its host-observed application scenario; it does not certify a confinement or device-level obligation. Oracle independence is reviewed separately from custody.

Core owns the minimal typed binding; engine functions evaluate supplied values; integration owns the application-specific controller; runtime owns ordinary processes/artifacts; control plane composes evidence admission, knowledge, coverage and lifecycle. Reuse current contracts and failure categories. Do not introduce a generic provisioning language or telemetry service.

Operational status, outcome, currentness and assurance remain separate. Historical failures remain historical failures. A new collection failure does not erase prior evidence. Missing artifacts after a clone are unavailable, not reconstructed successes. A finalized run may be published idempotently; an interrupted run cannot be assumed alive or rerun external user effects.

## How and completion evidence

| Task | Concrete implementation | Completion evidence |
|---|---|---|
| P1.1 | Revalidate Psychord-omega source/concepts; accept the selected scenario and host-evidence assurance in existing canonical records. Resolve any conflicting confinement obligation explicitly. | Preserved IDs/provenance, actual expected/forbidden behavior and unobserved lanes; no inferred scenario identity. |
| P1.2 | Extend core contracts/ports and generated schemas only for run/profile/input/artifact references absent from existing Evidence, ValidationResult, StateBinding and CompletionContract. Include any persisted shape in wrap-up Tasks 5--6. | Malformed/version-mismatched/cross-run evidence is rejected; old evidence retains its original assurance and hash interpretation. |
| P1.3 | Implement ordinary host-owned build/server/controller setup and cleanup in existing runtime/integration seams. Use allocated loopback ports, no server reuse, fresh browser storage, pinned controller inputs, bounded output/time and caller cancellation. | Wrong server/build, unavailable browser, cancelled setup and interrupted cleanup give actionable results; owned-resource cleanup does not affect unrelated work. |
| P1.4 | Implement the real keyboard/save/reload/replay controller and independent negative controls from the pilot. Collect served-byte identity, assertion results, relevant storage/trace observations and bounded diagnostics. | Actual browser behavior passes; no-input, save-failure and replay-contamination controls fail as intended. Domain fake-port tests alone do not satisfy this task. |
| P1.5 | Admit manifests through control-plane evidence and currentness services; reuse actual value/query observation and artifact hashing. | Relevant dirty build/controller/fixture changes invalidate evidence; conservative wider dependencies or unknowns remain visible. |
| P1.6 | Connect admitted evidence to context, reconciliation, coverage and the new shared runner's observation/inspection operations. Preserve no-exec capability discovery. | Mapped-but-unobserved behavior remains open; setup failure, assertion failure, staleness and missing artifacts remain distinct. |
| P1.7 | Connect required application checks to the existing controlled lifecycle only where the concrete plan declares their host capabilities and assurance. Do not grant host edits a controlled-execution certificate. | Actual required evidence controls success, with approval/lease/journal/recovery invariants preserved. |
| P1.8 | Exercise installed native Windows and direct WSL paths at their claimed capabilities; run affected tests, build/verify and independent review. | Real pilot and negative cases have receipts, unsupported lanes are explicit, and no blocker remains for the advertised slice. |

## Spec delta after implementation

After P1.1--P1.8 complete, wrap-up Task 7.7 refreshes and applies [P1.patch](../spec-deltas/P1.patch) in the same completion batch. Its nine paths cover historical authority/navigation/manifest, one application-evidence module, conceptual/reference architecture, evidence, completion and persistence. Exact paths and hashes are in the [manifest](../spec-deltas/change-manifest.json).

Earlier wrap-up edits will change this patch's base. Inspect the actual implementation and canonical meaning, regenerate/review affected hunks against current files, then run apply/spec checks. Never force an old patch or apply the combined patch after individual patches. Preserve intended-versus-delivered scope. Typed contracts own schema generation; historical Markdown supplies transitional design and acceptance-inventory evidence.
