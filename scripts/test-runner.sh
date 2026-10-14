#!/usr/bin/env bash
((BASH_VERSINFO[0] >= 5)) || { echo "✗ $0 requires Bash >= 5, not $BASH_VERSION. Fix: brew install bash; open a fresh shell and rerun repository setup." >&2; exit 1; }
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
case "${1:-}" in
    --benchmark-client|--benchmark-load)
        exec "$BASH" "$ROOT/scripts/benchmark-runner.sh" "$@" ;;
    *) exec node "$ROOT/scripts/code-integration-runner.mjs" "$@" ;;
esac
