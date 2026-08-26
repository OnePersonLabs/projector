# Capsule write authorization design

## Goal

Give every mutation boundary one deterministic, fail-closed interpretation of an execution capsule's operation grants and repository-path selectors.

## Problem

The change executor, packet coordinator, deterministic transform, and host composition currently interpret `allowedWrites` and `forbiddenWrites` independently. The engine compiles a limited selector subset, the runtime packet coordinator ignores grant operations, and the host accepts several path prefixes without considering matcher semantics, forbidden grants, or the capsule operation. A capsule can therefore be accepted by one layer and rejected by another, and the weakest layer can authorize an observed write that the capsule did not grant.

This is a semantic authorization concern, not filesystem containment. Canonical repository identity, symlink defense, and real-path containment remain runtime responsibilities.

## Design

Add a pure authorization module under `@projector/core`. It owns:

- canonical repository-relative path and path-pattern validation;
- the canonical deterministic glob matcher used by selector evaluation;
- compilation of operation-applicable `ScopeGrant` selectors into serializable allowed and forbidden path scopes;
- authorization of one observed repository path against the compiled result.

A compiled scope preserves the current algebra: grants are disjunctive, while path predicates inside one `all` selector are conjunctive. Supported mutation atoms are:

- `path equals <repository-relative-path>`;
- `path glob <canonical-glob>`;
- `operation equals <capsule-operation>`.

`all` may combine those atoms. Other fields, matchers, `any`, and `not` are not proven enforceable by this slice and therefore make the entire compiled authorization unsupported. Operation-mismatched selectors are unsatisfiable, not global grants. A path-neutral forbidden selector forbids the operation globally.

Compilation returns data, not callbacks, so the same object can cross engine/runtime boundaries and remain inspectable and hashable. Authorization succeeds only when:

1. compilation is supported;
2. the operation has at least one satisfiable allowed grant;
3. the candidate is a canonical repository-relative path;
4. one allowed scope matches; and
5. no forbidden scope matches.

The engine compiles once during preflight and passes the result in its approved transform context. The deterministic transform evaluates that object instead of reconstructing path rules. The packet coordinator and host use the same core compiler and evaluator for authoritative observed paths. Existing plan-boundary checks and runtime real-path containment remain additional independent restrictions.

The governance selector evaluator delegates glob matching to the same core primitive. This prevents a path glob from meaning one thing while Projector reasons about scope and another while it authorizes mutation.

## Failure behavior

- No applicable allowed grant denies the operation.
- Any unsupported or malformed applicable allowed or forbidden selector makes the compiled authorization unsupported and denies every path.
- A malformed, absolute, traversal-bearing, empty, or oversized observed path is denied.
- A matching forbidden grant overrides any matching allowed grant.
- Host launch and packet integration reject authoritative writes outside the compiled authorization before success can be recorded.

## Acceptance

1. Core tests prove exact, glob, conjunction, operation, forbidden-precedence, global-forbid, malformed-path, and unsupported-selector behavior.
2. The engine, deterministic transform, packet coordinator, and host delete their local write-authorization interpretations and use the core primitive.
3. Existing supported capsule behavior remains compatible, including `**`, directory globs, and multi-pattern conjunction.
4. A host session with the wrong operation or a matching forbidden grant fails and restores the fixture.
5. A packet whose authoritative observation widens capsule scope rolls back and records failure evidence.
6. Governance and authorization use the same deterministic glob semantics.
7. Full verification, package boundaries, packed release acceptance, and manual-only Actions remain green.

## Authority

- [Execution Capsules](../../../PROJECTOR_SPEC/05-projections/execution-capsules.md)
- [Scope, Selectors, and Rules](../../../PROJECTOR_SPEC/04-governance/scope-and-rules.md)
- [Transactions and Certificates](../../../PROJECTOR_SPEC/07-change/transactions-and-certificates.md)
- [Projector north star](../../../NORTH_STAR.md)
