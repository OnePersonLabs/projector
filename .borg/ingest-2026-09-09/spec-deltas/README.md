# Exact proposed historical-spec changeset

Unapplied against Projector `043a7c32e62f3e8319fe5a0e4bfc54d949a9f096`.

- [PROJECTOR_SPEC.patch](PROJECTOR_SPEC.patch): 21 files, 208 inserted lines, 10 deleted lines.
- [P1.patch](P1.patch): 9 files, including the new application-evidence module and honest historical-authority entrypoints.
- [P2.patch](P2.patch): 5 files covering contribution identity, joins, continuation and host assurance.
- [P3.patch](P3.patch): 4 files covering scoped correction and conditional governance.
- [P4.patch](P4.patch): 3 files covering later-change validation and complete cost.
- [change-manifest.json](change-manifest.json): file operations, owners, current-source hashes and proposed-text hashes.
- [source-hashes.json](source-hashes.json): pinned historical-spec inputs.
- [review-tree/PROJECTOR_SPEC](review-tree/PROJECTOR_SPEC/): proposed spec materialized only inside this design package for inspection and checks.

The four patches have disjoint file ownership and each passes `git apply --check` independently against the baseline. The combined patch also passes. This does not apply the patch or accept its product meaning.

`build_patches.py` contains the exact source transformations and checks pinned source hashes before generation. It writes only inside this directory and copies the historical spec into the review tree. Run from this repository with `python -X utf8 .borg/ingest-2026-09-09/spec-deltas/build_patches.py` to reproduce it while those source hashes remain unchanged. It is a design-artifact helper, not a Projector validator, hook or runtime workflow.

The copied spec passes both the Python manifest/link/declaration/style checks and the current engine's human-technical lint under Node 24. No exported declaration was added or duplicated. Existing nonblocking style advice remains. [Check receipt](../receipts/spec-verification.md)
