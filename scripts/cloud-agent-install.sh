#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=/dev/null
source "$REPO_ROOT/.agents/scripts/cloud-install-lib.sh"

use_node_for_cursor_cloud
npm ci
# Fleet verify checks Linux headless-shell paths; macOS dev uses Chromium bundle (launch still works).
if [ "$(uname -s)" = Darwin ]; then
	PLAYWRIGHT_E2E_VERIFY=0 install_playwright_browsers_for_e2e
else
	install_playwright_browsers_for_e2e
fi
if [[ ! -f .env ]] && [[ -f .env.example ]]; then
	cp .env.example .env
fi

echo "cloud-agent-install: OK (node $(node -v))"
