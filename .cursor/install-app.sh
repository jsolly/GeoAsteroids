#!/usr/bin/env bash
# Install the GeoRoids application development environment on a Cloud Agent VM:
# native libraries for the `canvas` dependency, Node 24 (package.json engines
# require ^24.15.0; .nvmrc pins major 24), project dependencies, and the empty
# .env the game server loads via --env-file=.env. Manual benchmarks and Wiki
# media install their browsers on demand; code tests need no browser binaries.
#
# Idempotent: safe to re-run from .cursor/environment.json `install`.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

run_privileged() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    echo "install-app: ERROR — need root or sudo to run: $*" >&2
    return 1
  fi
}

# --- native libraries for the `canvas` dependency ---
# canvas builds against Cairo, Pango, libjpeg, giflib and librsvg headers.
if ! pkg-config --exists cairo 2>/dev/null; then
  echo "install-app: installing canvas native libraries via apt"
  run_privileged apt-get update -qq
  run_privileged apt-get install -y --no-install-recommends \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    libpixman-1-dev build-essential pkg-config python3
else
  echo "install-app: canvas native libraries already present"
fi

# --- Node 24 via nvm ---
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  # Claude Code cloud images ship no nvm; bootstrap a pinned release.
  echo "install-app: installing nvm v0.40.3 into $NVM_DIR"
  mkdir -p "$NVM_DIR"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh |
    PROFILE=/dev/null NVM_DIR="$NVM_DIR" bash
fi
# nvm.sh exits 3 under `set -eu` when no default alias exists yet.
set +eu
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh" --no-use
set -eu
nvm install 24
nvm alias default 24
nvm use 24
node24_dir="$(dirname "$(nvm which 24)")"
export PATH="$node24_dir:$PATH"
# Claude Code cloud sessions do not source nvm and put an image Node first on
# PATH; link Node 24 into ~/.local/bin, which that PATH searches earlier.
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  mkdir -p "$HOME/.local/bin"
  for tool in node npm npx corepack; do
    ln -sf "$node24_dir/$tool" "$HOME/.local/bin/$tool"
  done
fi
echo "install-app: using node $(node --version) (npm $(npm --version))"

# --- project dependencies ---
npm ci

# --- empty .env required by the server's --env-file=.env ---
[ -f .env ] || touch .env

echo "install-app: done"
