#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=/dev/null
# Fleet cloud-install lib exists only when the cloud bridge is wired (currently deferred).
if [ -f "$REPO_ROOT/.agents/scripts/cloud-install-lib.sh" ]; then
  source "$REPO_ROOT/.agents/scripts/cloud-install-lib.sh"
fi

if type use_node_for_cursor_cloud >/dev/null 2>&1; then
  use_node_for_cursor_cloud
else
  echo "fleet cloud-install-lib absent; using VM default Node (cloud bridge deferred)" >&2
fi
npm ci
# macOS dev uses Chromium bundle (launch still works); skip Linux-only headless-shell verify.
if [ "$(uname -s)" = Darwin ]; then
	PLAYWRIGHT_E2E_VERIFY=0 bash scripts/ensure-playwright-browsers.sh
else
	bash scripts/ensure-playwright-browsers.sh
fi
if [[ ! -f .env ]] && [[ -f .env.example ]]; then
	cp .env.example .env
fi

echo "cloud-agent-install: OK (node $(node -v))"
