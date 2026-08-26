#!/usr/bin/env bash
set -eu

# This hook is advisory and read-only. It reports availability only when the
# repository and the same installed CLI boundary used by the MCP launcher exist.
repository_root="${PROJECTOR_ROOT:-}"

if [ -z "$repository_root" ] && command -v git >/dev/null 2>&1; then
  repository_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi

if [ -z "$repository_root" ]; then
  exit 0
fi

configured_cli="${PROJECTOR_CLI:-}"
if [ -n "$configured_cli" ]; then
  case "$configured_cli" in
    *.js|*.mjs|*.cjs)
      [ -r "$configured_cli" ] && command -v node >/dev/null 2>&1 || exit 0
      ;;
    *)
      [ -x "$configured_cli" ] || exit 0
      ;;
  esac
elif ! command -v projector >/dev/null 2>&1; then
  exit 0
fi

printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"Projector MCP is available for this repository. Use projector.status and projector.audit before mutation."}}'
