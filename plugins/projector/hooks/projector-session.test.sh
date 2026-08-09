#!/usr/bin/env bash
set -eu

plugin_root="$(cd "$(dirname "$0")/.." && pwd)"
repository_root="$(cd "${plugin_root}/../.." && pwd)"

available_payload="$(
  PROJECTOR_ROOT="$repository_root" \
  PLUGIN_ROOT="$plugin_root" \
  bash "${plugin_root}/hooks/projector-session.sh"
)"

printf '%s' "$available_payload" | jq -e '
  .hookSpecificOutput.hookEventName == "SessionStart"
  and (.hookSpecificOutput.additionalContext | contains("projector.status"))
' >/dev/null

unavailable_payload="$(
  PROJECTOR_ROOT="${repository_root}/not-a-projector-checkout" \
  PLUGIN_ROOT="$plugin_root" \
  bash "${plugin_root}/hooks/projector-session.sh"
)"

test -z "$unavailable_payload"
jq -e '
  .hooks.SessionStart[0].hooks[0].command == "bash \"${PLUGIN_ROOT}/hooks/projector-session.sh\""
  and .hooks.SessionStart[0].hooks[0].additionalContextLimit == 256
' "${plugin_root}/hooks/hooks.json" >/dev/null

printf '%s\n' "Projector SessionStart hook tests passed"
