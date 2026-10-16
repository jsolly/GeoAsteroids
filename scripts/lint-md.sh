#!/usr/bin/env bash
# Lint markdown with the locally installed markdownlint-cli2 declared in package.json.
# Pass --fix to auto-fix violations: bash scripts/lint-md.sh --fix
((BASH_VERSINFO[0] >= 5)) || { echo "✗ $0 requires Bash >= 5, not $BASH_VERSION. Fix: brew install bash; open a fresh shell and rerun repository setup." >&2; exit 1; }
set -euo pipefail
cd "$(dirname "$0")/.."
bin="node_modules/.bin/markdownlint-cli2"
if [[ -x "$bin" ]]; then
  exec "$bin" --config config/quality/.markdownlint-cli2.jsonc "$@" "**/*.md"
fi
echo "lint-md: $bin not found — run 'npm ci' in the repository, then retry." >&2
exit 1
