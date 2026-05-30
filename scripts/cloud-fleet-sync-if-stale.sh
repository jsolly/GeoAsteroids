#!/usr/bin/env bash
# Cloud task startup: pull fleet subtree when FLEET.lock is behind dotagents/fleet.
# Requires DOTAGENTS_GITHUB_TOKEN (or SSH dotagents remote) and a clean working tree.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

HOOK=".agents/hooks/check-fleet-subtree-stale.sh"
[[ -x "$HOOK" ]] || {
  echo "Missing $HOOK — commit .agents/ from a recent fleet subtree first" >&2
  exit 1
}

out="$(CURSOR_PROJECT_DIR="$ROOT" bash "$HOOK" <<< '{}')"
if echo "$out" | jq -e '.env.FLEET_SUBTREE_STALE == "1"' >/dev/null 2>&1; then
  echo "Fleet subtree stale — running ./scripts/update-agents-subtree.sh" >&2
  ./scripts/update-agents-subtree.sh
else
  echo "Fleet subtree already matches dotagents/fleet"
fi
