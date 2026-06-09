#!/usr/bin/env bash
# Pre-push gate for GeoRoids.
#
# Invoked by .git-hooks/pre-push (core.hooksPath=.git-hooks, wired by `npm run
# prepare`). Replaces the old .github/workflows/onMain.yml CI job: the quality
# gate now runs locally on push to main. (CodeQL was dropped; deploy is handled
# by the hosting provider on push, unchanged.)
#
# Only acts on a non-deleting push to main/master; feature-branch pushes stay
# fast. Escape hatch: FLEET_SKIP_PREPUSH=1 git push (audited).
set -euo pipefail

if [ "${FLEET_SKIP_PREPUSH:-}" = "1" ]; then
  echo "⚠ FLEET_SKIP_PREPUSH=1 — skipping pre-push gate" >&2
  exit 0
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# pre-push stdin: <local ref> <local sha> <remote ref> <remote sha>
ZERO="0000000000000000000000000000000000000000"
push_to_main=""
while read -r _local_ref local_sha remote_ref _remote_sha; do
  case "$remote_ref" in
    refs/heads/main | refs/heads/master)
      [ "$local_sha" = "$ZERO" ] && continue
      push_to_main="$remote_ref"
      ;;
  esac
done
[ -z "$push_to_main" ] && exit 0

echo "▶ pre-push gate (GeoRoids) → $push_to_main"
echo "• lint"
npm run lint
echo "• tsc --noEmit"
npm run check:ts
echo "• vitest"
npm test
echo "✓ pre-push gate complete"
