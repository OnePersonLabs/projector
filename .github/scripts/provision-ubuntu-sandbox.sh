#!/usr/bin/env bash
set -euo pipefail

readonly bubblewrap_version="0.9.0-1ubuntu0.1"
readonly restriction_key="kernel.apparmor_restrict_unprivileged_userns"
readonly packaged_profile="/usr/share/apparmor/extra-profiles/bwrap-userns-restrict"
readonly loaded_profile="/etc/apparmor.d/bwrap-userns-restrict"

restriction_before="$(sysctl -n "$restriction_key")"
if [[ "$restriction_before" != "1" ]]; then
  echo "Expected Ubuntu's global unprivileged-user-namespace restriction to be enabled; observed $restriction_before" >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install --yes --no-install-recommends \
  "bubblewrap=$bubblewrap_version" \
  apparmor-profiles

installed_version="$(dpkg-query --show --showformat='${Version}' bubblewrap)"
if [[ "$installed_version" != "$bubblewrap_version" ]]; then
  echo "Expected bubblewrap $bubblewrap_version; installed $installed_version" >&2
  exit 1
fi

if [[ ! -r "$packaged_profile" ]]; then
  echo "Ubuntu's packaged Bubblewrap AppArmor profile is missing: $packaged_profile" >&2
  exit 1
fi

sudo install --mode=0644 "$packaged_profile" "$loaded_profile"
sudo apparmor_parser --replace "$loaded_profile"

restriction_after="$(sysctl -n "$restriction_key")"
if [[ "$restriction_after" != "$restriction_before" ]]; then
  echo "Global unprivileged-user-namespace restriction changed from $restriction_before to $restriction_after" >&2
  exit 1
fi

echo "Provisioned $(/usr/bin/bwrap --version) with AppArmor user-namespace support; $restriction_key=$restriction_after"
