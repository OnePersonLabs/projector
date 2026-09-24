# Reviewed branch merge

## Why

Projector publishes verified changes on candidate branches, but integration into the user's current branch remains a manual operation. A clean textual merge can still combine requirements, designs, implementation, or evidence incorrectly. Users need one workflow that protects current work, reviews the combined result, and explains uncertain conflicts before integration.

## What Changes

- Add a discoverable merge skill that integrates one selected source branch into the branch checked out in the user's original working directory.
- Isolate merge construction and conflict resolution in a linked worktree until checks and independent adversarial review support publication.
- Escalate unresolved conflicts with a self-contained decision brief and leave the target branch unchanged while a decision is pending.
- Document and qualify reviewed integration as the step after Projector finish.

## Capabilities

### Modified Capabilities

- projector/workflow: Add reviewed branch integration to the installed conversational workflow.

## Impact

Installed Projector skills, workflow documentation, package discovery, version metadata, and installed-client qualification.
