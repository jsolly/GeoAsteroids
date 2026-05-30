#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=/dev/null
source "$REPO_ROOT/.agents/scripts/cloud-install-lib.sh"

use_node_for_cursor_cloud
npm ci
install_playwright_chromium
npx playwright install chromium-headless-shell
if [[ ! -f .env ]] && [[ -f .env.example ]]; then
	cp .env.example .env
fi

echo "cloud-agent-install: OK (node $(node -v))"
