#!/usr/bin/env bash
# Ensure Playwright Chromium + headless shell are installed for browser E2E.
# Handles stale __dirlock, hung downloads at 100%, and zip recovery from /tmp.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=/dev/null
source "$REPO_ROOT/.agents/scripts/cloud-install-lib.sh"

PLAYWRIGHT_INSTALL_TIMEOUT="${PLAYWRIGHT_INSTALL_TIMEOUT:-600}"
browsers_path="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"

clear_playwright_lock() {
	rm -rf "${browsers_path}/__dirlock" 2>/dev/null || true
}

run_with_timeout() {
	local label="$1"
	shift
	if command -v timeout >/dev/null 2>&1; then
		timeout "${PLAYWRIGHT_INSTALL_TIMEOUT}" "$@" || {
			echo "ensure-playwright-browsers: ${label} timed out after ${PLAYWRIGHT_INSTALL_TIMEOUT}s" >&2
			return 1
		}
	else
		"$@"
	fi
}

recover_headless_shell_from_tmp() {
	local zip
	zip="$(find /tmp/playwright-download-* -name '*headless-shell*.zip' 2>/dev/null | head -1 || true)"
	if [[ -z "$zip" ]]; then
		return 1
	fi
	echo "ensure-playwright-browsers: recovering headless shell from ${zip}"
	local dest_dir
	dest_dir="$(find "$browsers_path" -maxdepth 1 -type d -name 'chromium_headless_shell-*' 2>/dev/null | head -1 || true)"
	if [[ -z "$dest_dir" ]]; then
		dest_dir="${browsers_path}/chromium_headless_shell-1217"
	fi
	mkdir -p "$dest_dir"
	unzip -qo "$zip" -d "$dest_dir"
}

recover_chromium_from_tmp() {
	local zip
	zip="$(find /tmp/playwright-download-* -name '*chromium-ubuntu*.zip' -o -name '*chrome-linux*.zip' 2>/dev/null | head -1 || true)"
	if [[ -z "$zip" ]]; then
		return 1
	fi
	echo "ensure-playwright-browsers: recovering chromium from ${zip}"
	local dest_dir
	dest_dir="$(find "$browsers_path" -maxdepth 1 -type d -name 'chromium-*' ! -name 'chromium_headless_shell-*' 2>/dev/null | head -1 || true)"
	if [[ -z "$dest_dir" ]]; then
		dest_dir="${browsers_path}/chromium-1217"
	fi
	mkdir -p "$dest_dir"
	unzip -qo "$zip" -d "$dest_dir"
}

install_browsers() {
	clear_playwright_lock
	echo "Installing Playwright Chromium..."
	run_with_timeout "chromium install" npx playwright install chromium || true
	clear_playwright_lock
	echo "Installing Playwright chromium-headless-shell..."
	run_with_timeout "headless-shell install" npx playwright install chromium-headless-shell || true
	clear_playwright_lock
}

verify_headless_shell() {
	if [[ "${PLAYWRIGHT_E2E_VERIFY:-1}" == "0" ]]; then
		return 0
	fi
	local bin
	bin="$(playwright_headless_shell_bin || true)"
	if [[ -n "$bin" && -x "$bin" ]]; then
		echo "Playwright headless shell ready: $bin"
		return 0
	fi
	return 1
}

smoke_launch() {
	if [[ "$(uname -s)" != Linux ]]; then
		return 0
	fi
	node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  await browser.close();
  console.log('Playwright launch smoke test: OK');
})().catch((err) => { console.error(err); process.exit(1); });
"
}

main() {
	install_browsers

	if ! verify_headless_shell; then
		echo "ensure-playwright-browsers: binary missing after install; attempting /tmp recovery..." >&2
		clear_playwright_lock
		recover_headless_shell_from_tmp || true
		recover_chromium_from_tmp || true
	fi

	if ! verify_headless_shell; then
		echo "Playwright headless shell binary still missing." >&2
		echo "Troubleshooting: rm -rf ~/.cache/ms-playwright/__dirlock && re-run this script." >&2
		exit 1
	fi

	smoke_launch
	echo "ensure-playwright-browsers: OK"
}

main "$@"
