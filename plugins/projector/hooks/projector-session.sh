#!/usr/bin/env bash
set -eu

# This hook is advisory and read-only. Outside a built Projector checkout it
# exits successfully without injecting context or claiming availability.
repository_root="${PROJECTOR_ROOT:-}"

if [ -z "$repository_root" ] && command -v git >/dev/null 2>&1; then
  repository_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi

if [ -z "$repository_root" ] && [ -n "${PLUGIN_ROOT:-}" ]; then
  source_repository="$(cd "${PLUGIN_ROOT}/../.." 2>/dev/null && pwd || true)"
  if [ -f "${source_repository}/packages/cli/dist/cli.js" ]; then
    repository_root="$source_repository"
  fi
fi

if [ -z "$repository_root" ] || [ ! -f "${repository_root}/packages/cli/dist/cli.js" ]; then
  exit 0
fi

printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"Projector MCP is available for this repository. Use projector.status and projector.audit before mutation."}}'
