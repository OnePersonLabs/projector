# Projector V4 implementation handoff prompt

Start by making the local `OnePersonLabs/projector` checkout exactly match `origin/main`. **Discard every local modification, untracked file, and ignored file in this repository; this destructive cleanup is explicitly authorized for Projector by the user.** Fetch/prune origin, switch to `main`, hard-reset to `origin/main`, and clean the worktree (including ignored files). Do not apply this destructive cleanup to any other repository.

Read root `AGENTS.md` and obey it. Then read this directory's `PROJECTOR_V4_IMPLEMENTATION_HANDOFF.md` and treat it as the implementation contract. The sibling running spec and append-only capture are background/provenance only; consult them only when the implementation handoff is genuinely ambiguous or a concrete finding requires source attribution.

Create a short-lived implementation branch from the freshly synchronized `main` **before** editing product files. Do not modify `legacy/projector-main-v3`, Psychord, or unrelated repositories. Do not force-push or merge to `main` unless separately authorized.

Execute the implementation handoff end to end, beginning with its bounded Milestone 0 qualification and continuing through its definition of done. Amend the handoff only when a concrete observed result changes an implementation decision. Record the evidence, the minimal correction, and affected downstream decisions, then continue. Do not reopen settled product goals or manufacture speculative blockers merely because adaptation is permitted.

Do not stop at planning, scaffolding, or a static checker. Deliver the installed loop and the required deterministic, race, cost, recovery, and clean-evolution evidence. Follow the handoff's escalation rules for genuinely pivotal ambiguity; otherwise proceed autonomously.

No attachments are required: the authoritative handoff package is already in this repository under `.temp/handoff/`.
