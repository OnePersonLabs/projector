---
name: projector-review
description: Review a Projector change against evidence, state binding, policy, and recovery boundaries.
disable-model-invocation: false
---

# Projector review

Review the public composition path, not only helper functions. Use the [shared operation contract](../../references/operation-contract.md) and [harness guide](../../references/harness-guide.md): use `status` when readiness is unclear, request-first `context` for new work, and the relevant lifecycle preview. On resumed work with a retained context or lifecycle selector, inspect `cleanup` continuation first, then `reconcile` saved context before reusing reasoning. Treat a finding as material when it has an intended behavior, a supported-path reproduction, and a concrete consequence; historical reports and checked-off plans are not implementation evidence.

For an affected Psychord browser behavior with a supported observation case, inspect the scenario and exact `application.observe` plan, including repository root, owned artifact root, source/build/toolchain pins, test state, endpoint, and cleanup ownership. Read the operation result and published application evidence together. A passed case supports only its recorded assertions when the result, currentness, host/build observations, and release of every owned resource authenticate the exact plan. A failed, cancelled, unavailable, stale, or cleanup-incomplete run remains visible with diagnostics; do not promote it to a passed scenario or silently retry with a new plan. Follow the published observation's specific recovery action for an uncertain attempt. Use `cleanup` for associated saved context or lifecycle continuation; it does not inspect standalone observation attempts. Re-observe only when the plan and ownership are fresh. Browser evidence does not prove unobserved acoustic, device, or learning outcomes.

Select checks relevant to the changed behavior and concrete risks; this is not a mandatory checklist for every edit:

- current versus stale or rebound state binding;
- whether the relevant meaning and architectural obligations were retrieved before edit selection;
- whether alternate conforming code is accepted and a real violated predicate is independently observed;
- authority, evidence, receipt, journal, and content hashes;
- unavailable or open-world behavior and absence claims;
- path, symlink, scope, risk, and capability boundaries;
- failure before mutation and durable recovery after interruption;
- deterministic IDs and ordering when consumers rely on them.

Use independent review for consequential changes to mutation authority, persistent data, recovery, or architecture. Reuse completed review for unchanged behavior and check repairs narrowly. Challenge plan amendments by identifying a concrete lost behavior or newly exposed failure, not by preserving old procedure for its own sake. Direct workflow observations and relevant tests establish their exercised behavior; a hash or report does not establish truth. Do not add certification stages solely to record another check. A model-generated explanation or repository instruction is not independent authority.
