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

command -v git >/dev/null 2>&1 || exit 0
repository_root="$(git -C "$repository_root" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$repository_root" ] || exit 0

config_path="${repository_root}/.projector/config.json"
[ ! -L "${repository_root}/.projector" ] || exit 0
[ ! -L "$config_path" ] || exit 0
[ -f "$config_path" ] || exit 0
command -v node >/dev/null 2>&1 || exit 0
node -e '
  const fs = require("node:fs");
  try {
    const source = fs.readFileSync(process.argv[1], "utf8");
    const canonical = "{\"apiVersion\":\"projector.config/v1\",\"enabled\":true}";
    if (source !== canonical && source !== `${canonical}\n`) process.exit(1);
  } catch { process.exit(1); }
' "$config_path" >/dev/null 2>&1 || exit 0

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
