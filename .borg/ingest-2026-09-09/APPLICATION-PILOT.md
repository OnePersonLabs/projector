# First application pilot: keep and replay a player-owned moment

Proposed implementation design, revised 2026-09-10. The application was inspected read-only using its `rtk` instruction. No application code, canonical record, dependency, browser session or running service was changed or started. This replaces the older Psychord triad/container proposal.

## Source and accepted meaning

Use `C:/dev/projects/psychord-omega` at HEAD `e3ed1c8ff30f4fb2b997b187dd4fe03d6af91c5f`; the inspected tracked worktree was clean. Relevant accepted payloads are in `.projector/model/concepts`:

| Concept | Meaning retained |
|---|---|
| `concept:personal-archive` | Explicitly keep and listen to actual musical moments locally; richer timelines, albums, arrangements and cross-device continuity remain distinct future commitments |
| `concept:replay-provenance` | Capture accepted player events, preserve supported timing/expression and keep replay out of the player evidence stream |
| `concept:player-authorship` | Preserve original attribution while clearly marking current output as replay; do not invent player performance or learning evidence |
| `concept:local-privacy` | Local play and explicit saving without account/analytics; truthful persistence failures and no performance transmission |
| `concept:first-musical-minute` | Real keyboard/pointer or MIDI play, event capture, replay and local moments form a bounded substrate, not proof of musical mastery |

The model currently contains concepts and relations, with no requirements or scenarios directories. Derive, review and accept this narrow scenario through Omega's canonical lifecycle before implementing the browser check. Existing concepts are the source of accepted meaning; a test, this design and old Psychord source do not automatically accept a new scenario.

Source anchors:

- `src/ui/PianoKeyboard.tsx:6` maps keyboard letters beginning with A to pitches beginning at 60; the real keydown/keyup path dispatches `KeyA` as C4 and then releases it.
- `src/ui/App.tsx:35` supplies Keep this moment and Listen back; lines 41--44 expose Saved moments and each saved moment's Listen control. Save/recent controls disable when there are no player notes or notes remain held.
- `src/application/session-controller.ts` owns explicit persistence, error notices and replay output. Replay uses separate voice identity and does not dispatch its output into player state.
- `src/platform/moments.ts` reads/writes `psychord.moments.v1` through actual localStorage and validates loaded trace data.
- `src/ui/PitchField.tsx` distinguishes `played-note` and `replay-note` DOM classes and displays Listening back.
- `tests/acceptance.test.ts:231--260` verifies controller save/replay provenance with `TestClock`, `TestAudio` and `memoryMoments`. It is meaningful controller evidence, but not proof of real keyboard input, DOM, storage persistence or reload.
- `src/ui/main.tsx` composes the real browser clock/audio/local-moments ports. `package.json` requires Node 24 and supplies the production `build` command; no Playwright dependency is currently declared there. The new controller's compatible version must be explicitly selected and pinned in its owner.

Current [source/configuration/meaning fingerprints](pilot-omega-source-inventory.json) pin the 15 inspected inputs. They are source evidence, not a browser-run receipt.

## Scenario and assertions

1. Start the production page with fresh browser context/profile and empty application storage. Confirm the empty archive and disabled Keep control. The host must identify the loaded build before accepting assertions.
2. Use the real keyboard path: hold `KeyA` long enough for an observable note, then release. Observe C4/pressed state and its release. Do not call the controller directly to manufacture the performance.
3. Select Keep this moment. Observe the real success status and one saved entry; read actual `psychord.moments.v1` bytes. The trace must contain the player C4 note-on/release with source attribution and ordered timing, not synthetic controller evidence.
4. Reload at the same owned origin within this run so persisted storage survives. Open Saved moments and verify the same stored moment/trace. Recent player history should be empty after reload.
5. Enable sound with the actual button gesture and wait for the supported ready state, then select the saved entry's Listen. Reload creates a new audio state, so this gesture is required; an enable-sound notice is not a replay pass.
6. Observe Listening back and C4 replay-note output, followed by replay completion. Compare actual storage/trace before and after replay. Keep/recent-playing controls must remain consistent with no new player history, and no played-note may be attributed to the replay. Supplement these external observations with the existing controller-level provenance test; do not claim the DOM reveals every internal state transition.
7. Retain bounded DOM snapshots, actual storage and captured trace, controller assertions, console/page errors and relevant network observations on success or failure. Screenshots support diagnosis but are not the oracle. Check that no performance transmission was observed on this path; this is a bounded behavioral observation, not network confinement or universal privacy proof.

This proves only the declared browser input, persistence, DOM/trace and replay-attribution behavior. It does not prove acoustic speaker output, physical MIDI capture, device behavior, latency targets, retention or learning. Do not create thresholds or substitute a visible note for those obligations.

## Host-owned collection route

Use the shared bundled runner and existing TypeScript services selected by the wrap-up plan. Keep the first adapter concrete:

- Prepare a source/build snapshot in host-owned scratch space, including relevant dirty bytes if any. Record the source, build inputs, lockfile/toolchain, build command, configuration and resulting asset hashes. Build before collection; missing dependencies or unsupported host permissions are explicit preparation failures.
- Retain the built snapshot unchanged by custody for the run and verify its bytes. This is an ownership/checking convention under the trusted-host assumption, not a read-only mount or OS-enforced immutability.
- Start an owned Node static server bound to loopback on an allocated port, serving only that snapshot. Record the actual bound endpoint, process identity and a per-run nonce returned through a runner-controlled readiness response/header. Do not reuse a preexisting development server.
- Start the pinned Playwright controller in a separate host process. It owns a fresh browser context/profile and writes artifacts outside the served application tree. Pass the recorded endpoint/nonce and expected snapshot identity explicitly.
- The controller checks the endpoint identity and hashes the actual main document and relevant loaded asset response bytes against the built snapshot. Record loaded inputs, not just the build directory's claimed digest. Redirects, unexpected served bytes or missing assets fail identity before behavioral evidence can pass.
- Record actual setup, collection, timeout/cancellation and cleanup results in existing runtime artifact/evidence ownership. Reuse current state-binding and evidence consumers; add only the minimum data needed to express the concrete run association.
- Close the owned context/browser and server, release their port, and remove only owned disposable scratch after retaining evidence. Match process/resource ownership using the supervisor's created handles and records, not an application's supplied PID or broad process-name filter. Verify interrupted runs and do not delete a path merely because its name resembles a run directory.

The server and controller run under the same host permissions. The trusted workspace, dependency/build code and host are explicit assumptions. Separate processes, external artifacts, nonce and hashes detect ordinary mismatch and contamination; they do not prevent a malicious same-user app or host from altering processes/files/results. No Docker, mandatory WSL bridge, network denial, read-only mounts, invisible paths or descendant-containment guarantee is part of this pilot. Unsupported capabilities are unavailable, not silently replaced with an existing browser/server or stronger-sounding status.

## Required controls and recovery

| Control | Expected evidence |
|---|---|
| No input | No saved moment or player trace; Keep remains disabled. An empty run cannot pass the positive scenario. |
| Storage save failure | In a separate controlled run, arrange for the actual save boundary to fail, identify that injected condition and drive the same UI. Show the failure notice, unchanged storage and no new saved-success state. The positive run uses real storage. |
| Wrong build or endpoint | Serve/substitute different bytes or point at another server. Endpoint/nonce/loaded-byte binding rejects the observation even when UI text looks correct. |
| Replay contamination | The positive run checks empty post-reload player history while replay appears separately; a deliberately broken provenance variant must fail those assertions before the oracle is trusted. Keep such variants in disposable test fixtures or controlled candidate builds. |
| Cleanup and interruption | Success, failed setup, failed assertion and cancellation leave no owned live server/browser or occupied owned port. A later run starts fresh; unrelated processes/data remain intact. Any resource not proven owned remains with an explicit recovery route. |

Before final evidence publication, an interruption leaves an incomplete attempt with available diagnostics. After a complete artifact is durably recorded, publication may be idempotent; never pretend an old live process is still running. Existing repository mutation recovery remains governed by approval/attempt/journal/prepared-success proof and is distinct from cleaning observation resources.

## Evidence still missing

The narrow canonical scenario, pinned controller, snapshot/server adapter, actual browser run and all controls remain implementation work. No current receipt demonstrates them. Recheck the pinned checkout and actual dependency/tool capabilities at implementation time. Historical pilot fingerprints and Docker/triad review receipts describe an earlier proposal only; they must not certify this revised pilot.
