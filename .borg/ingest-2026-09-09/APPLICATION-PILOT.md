# Selected application pilot and collection boundary

Design choice after independent review, 2026-09-10. This narrows P1 to a real inspected workload and a concrete execution design. It does not implement or run the adapter, change Psychord, start Docker, install dependencies or accept Psychord meaning into Projector.

## Selected behavior and source identity

Use `C:/dev/projects/psychord` at `75d4d9e5949c33f39b43b215e315f8f4d80efc36` (tracked worktree observed clean) as the first application evidence workload. Pin the exact inspected files in [pilot-source-inventory.json](pilot-source-inventory.json).

The selected scenario is **deterministic C-major triad recognition through the real web internal runtime**:

1. Build and open the internal Dev Workbench in a new isolated browser context and fresh application state.
2. Inject the C Major Chord using the existing control surface.
3. Observe the resulting Harmony triad/major, Technique chord gesture and PitchEar chord-quality evidence, and the visible completion of the synthetic sequence.
4. Include a no-injection control and a deliberately broken finalization variant. An empty run must not claim recognition, and broken finalization must fail the expected evidence.

Evidence sources are `openspec/specs/tooling-dev-workbench/spec.md` (target-internal hosts use the real runtime; deterministic Recognition evidence survives), `apps/web/e2e/chord-bootstrap.spec.ts`, `apps/web/e2e/dev-workbench.helpers.ts`, `apps/web/playwright.config.ts`, `apps/web/package.json` and `e2e/dev-workbench.spec.ts`. These are rationale, current test and integration evidence, not self-proving acceptance. The controller's expected behavior must be reviewed against the existing scenario before it becomes a pinned independent oracle.

The exact three-cell expectations are already asserted by the existing browser test; they are not a new musical-learning design. This exercises browser input, the shared application runtime and inspectable output. It does **not** prove acoustic FMOD playback, physical MIDI capture, device latency, musical retention or transfer to a human jam. Those future obligations stay explicit. The Psychord North Star supports honest evidence and preserved authorship; no scoring/reward UI is added.

Use the application-owned `apps/web/playwright.config.ts` and build scripts as integration evidence, not the root smoke test. Root `e2e/web-loads.spec.ts` only checks text. The app config permits existing/external servers in some modes; the collector must supply its own run endpoint and prohibit server reuse. Bind the internal build mode, lockfile, asset manifest, controller's dependency cone and fresh storage/seed state. A production build must not be substituted for the internal artifact or expose the Dev Workbench as product functionality.

## Selected first execution profile

Choose a concrete optional **Docker Engine Linux-container adapter** for this application lane, with Playwright in a separate controller container. Do not extend the current Node-only WSL validator launcher into a browser supervisor. The existing bubblewrap repository-validation decision remains intact.

Why: the current WSL launcher is a narrow, capability-proven Node execution path. Sharing one new sandbox between candidate app code and its collector would not establish collector integrity. Separate app and controller containers, supervised by the trusted Projector runtime outside both, give an inspectable standard process/filesystem boundary without inventing a general scheduler or network-namespace daemon.

This adapter is optional. Docker is not a dependency of Projector's semantic engine or ordinary CLI lifecycle. `docker.exe` exists on this workstation; daemon availability, image availability and the required capabilities were not tested. An unsupported profile reports unavailable and gives the concrete missing capability. It never silently switches to a developer's existing browser/server. Supporting manual evidence remains a separately labeled lane.

Profile design:

- Projector runtime validates a local engine endpoint; a remote Docker context is unsupported in v1. The engine/VM and Projector supervisor are explicit trusted computing base.
- Build application bytes in a separate disposable build container with no network during evidence capture and an already provisioned, content-pinned dependency/image set. Build scripts receive only the source snapshot and owned scratch space. They receive no daemon socket, host credentials or controller files. Network-dependent dependency acquisition is a separate authorized preparation action, never hidden inside observation.
- Extract and hash the actual internal build. Serve those frozen bytes from the app container. The trusted supervisor, not app JavaScript, records the image/build/configuration and created container identities.
- Create one private network with `--internal` and isolated gateway mode for enabled address families; no published ports, default external network, host gateway mapping or extra attached network. **`--internal` alone is insufficient:** Docker documents that containers can still reach gateway-host services. Probe host-service, external-address and DNS escape denial for the chosen engine configuration.
- Run the immutable Playwright controller/browser in a separate non-root container, with its own filesystem/process namespace, browser sandbox, explicit seccomp policy, private bounded shared memory and resource limits. Do not use host IPC, privileged mode, extra admin capability or a mounted daemon socket. Controller input and its dependency image are pinned independently of the candidate app.
- Give the app only its frozen served build and bounded runtime scratch. Give the controller only its pinned test/input and its own bounded output. The app cannot read/write controller output, manifests, supervisor files or controller process state. The containers communicate only through the app protocol on the private network; the controller exposes no automation/debug listener to the app.
- The host supervisor creates unique run/container/network IDs, observes engine state, streams controller output through its own attached process channel, and copies artifact bytes from the controller-owned location. It treats app logs as app claims, never as controller protocol or manifest fields. It hashes and validates all imported artifact bytes and verifies the actual inspected container/image/mount/network configuration before finalizing the manifest.
- The supervisor writes the immutable manifest in Projector's existing runtime ownership and authenticates that record through the existing lifecycle/store trust boundary. Raw artifact hashes are not authentication. Candidate processes have no path to that store or any authentication material. Plan/claim consumers load the supervisor-owned record, recheck hashes and currentness, and do not accept an arbitrary imported manifest as equivalent.
- Cleanup acts on exact recorded engine object IDs with matching run ownership, not names, PIDs from app output or broad image filters. Interrupted setup/collection remains an incomplete attempt with retained diagnostics; resources not proven owned require explicit recovery handling.

Official Docker documentation distinguishes an internal network from its isolated gateway mode; the latter removes the bridge address. The proposed profile still requires actual capability probes and does not infer host isolation from a flag. [Internal-network semantics](https://docs.docker.com/reference/cli/docker/network/create/), [gateway modes](https://docs.docker.com/engine/network/port-publishing/)

Playwright provides browser container guidance and warns that default root execution disables Chromium sandboxing. This design chooses a non-root controller and preserves process isolation rather than copying the documentation's convenient host-IPC examples. Pin compatible Playwright package/browser-image versions from Psychord's actual dependency set when the adapter is built. [Official container guidance](https://playwright.dev/docs/docker)

## Required boundary proofs before a strong claim

Run negative controls for a substituted old build; modified controller/helper; tampered artifact; app-generated fake controller output; attempted controller-output/process access; extra network attachment or host-gateway access; stale endpoint; missing asset; no-injection and broken-finalization behavior; and interruption before/after manifest finalization. Check the complete observed process/resource teardown.

These protect a concrete evidence-authenticity and release-safety invariant; they are not arbitrary repository-wide recurrence guards. Passing them establishes only the declared profile and scenario, not a general defense against a compromised kernel/engine, every malicious website or an incorrect oracle. The trusted engine/VM assumption and non-root browser isolation must be stated in the evidence assurance.

If a required control fails, repair the specific collector boundary or keep strong evidence unavailable. Do not reduce the declared assurance to get a passing certificate. The real behavior scenario is selected; platform execution and its measured proof remain implementation tasks.
