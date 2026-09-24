# Projector 4.1 workflow qualification

Qualification performed on 2026-09-23 using Windows, Node 24.19.0 and the bundled OpenSpec 1.13.1.

## Executed checks

The implementation passed build, ESLint and the full acceptance suite. Checks cover installed MCP initialization, schema setup and idempotence, configuration preservation, synchronization/revision/finish, interrupted recovery, stale evidence, candidate-only publication and settled repeated finish.

An independent native reviewer reproduced and verified fixes for interrupted synchronization after source edits, synchronized target retention through Git pruning, and adopted config.yml preservation through finish. Negative deletion probes confirmed that retained and nonexistent files cannot use the removed-baseline-file disposition.

The mixed-edit import exercise included staged addition/deletion, a file with both staged and unstaged edits, and an untracked binary. Selected bytes matched the candidate, unrelated work remained excluded, and source file content, status, diffs and index bytes remained unchanged. Candidate behavior assertions passed. This exercise validates import mechanics; it is separate from the installed lifecycle tests.

## Installed host discovery

Codex's supported installer refreshes `projector@projector-v4-local` into the user cache at version 4.1.2. A fresh actual Codex app-server verifies eleven workflow skills, named `projector:init`, `projector:propose`, and their peers, plus seventeen tools including initProject and syncChange. Discovery uses the registered installed package, without a replacement MCP configuration. Qualification applies process-local exclusions for unrelated integrations; persistent configuration remains unchanged by discovery.

The installed-client tests execute initProject through the packaged MCP relay, verify all skill directories, and exercise sync followed by revision and finish. Registration, skill discovery, MCP handshake and actual tool execution are distinct checks.

## Review and limitations

A separate agent exercised the installed 4.1 runtime from the natural-language request to add a greeting function with trimmed names and blank-name rejection. It authored the proposal, requirements, design and tasks; initialized twice; validated the artifacts with bundled OpenSpec; implemented through managed batches; and ran two tests covering eight inputs. A separate native reviewer examined the actual candidate and found no blockers. Finish archived and published the candidate, repeated finish reused the same publication, and the source branch remained unchanged. This was an executed agent workflow, not a simulated review fixture. The naming patch shortens public skill names to the host's canonical namespace. Version 4.1.2 also preserves repository-owned schema edits through revision; initialization verifies the new-design template can be applied.

Independent review attribution: native reviewer `/root/review`. Review covered initialization, lifecycle changes, configuration adoption, deletion gates, the complete skill suite, and user documentation. It compared shared lifecycle operations with separate workflow state machines and mutable versus retained synchronization targets.

The production runtime makes no model calls. Automated fixture review strings test the attestation protocol; they are not represented as independent semantic review. The independent review above is separate actual agent work.

The supported runtime remains local Git repositories, JavaScript/TypeScript and Markdown. OpenSpec stores are explicitly unsupported. Bulk finish cannot silently repin a prepared dependent candidate or merge conflicting branches. Completed candidates still require separately authorized integration.
