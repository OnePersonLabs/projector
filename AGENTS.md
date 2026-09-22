# Projector V4 development rules

Projector V4 development follows the repository's normal durable source, OpenSpec, and design artifacts.

## Handoff isolation

Files under `.temp/` are **one-way agent inputs only**. No tracked file outside `.temp/` may import, load, link to, cite, embed the path of, or otherwise depend on any file under `.temp/`.

If information from a handoff or scratch file becomes necessary to the implementation, express that information in the appropriate durable source, specification, design, test, or configuration artifact outside `.temp/`; never create a back-reference into `.temp/`.

Only this `AGENTS.md` and `.gitignore` may name `.temp/`, solely to state/enforce the isolation rule and track the handoff package. No other tracked file outside `.temp/` may mention or depend on a `.temp/` path.

Do not modify or merge from `legacy/projector-main-v3` while implementing V4 unless the user explicitly requests a specific comparison. Do not resurrect V3 machinery by default.

Before finishing a change, verify that newly written tracked files outside `.temp/` contain no handoff-path references or dependencies.
