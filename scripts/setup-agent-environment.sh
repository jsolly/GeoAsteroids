#!/usr/bin/env bash
((BASH_VERSINFO[0] >= 5)) || { echo "✗ $0 requires Bash >= 5, not $BASH_VERSION. Fix: brew install bash; open a fresh shell and rerun repository setup." >&2; exit 1; }
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$root"
# A fresh Linux cloud image may not have the public tool manager. Install only
# this pinned, checksum-verified upstream binary; never pipe a remote script to a shell.
install_public_mise() (
  existing="$(command -v mise 2>/dev/null || true)"
  if [[ -n "$existing" && -x "$existing" ]]; then
    "$existing" --version >/dev/null
    exit 0
  fi
  local_version=2026.9.12
  destination='/usr/local/bin/mise'
  case "$(uname -s) $(uname -m)" in
    'Linux x86_64') asset="mise-v${local_version}-linux-x64"; expected=e79ae57945034903aee8aa2ea66b4c7ca9cd4f4edd5a8a78a589cbae6d0f428a ;;
    'Linux aarch64' | 'Linux arm64') asset="mise-v${local_version}-linux-arm64"; expected=f344c6961190ed2f68e595ed7cb4f03c36c17812bd608886bec799a3082180ff ;;
    *) echo 'Install mise on this host, then rerun repository setup. See docs/development.md.' >&2; exit 1 ;;
  esac
  [[ ! -e "$destination" && ! -L "$destination" ]] || { echo 'A mise destination already exists outside PATH; inspect it before setup.' >&2; exit 1; }
  scratch="$(mktemp -d)"
  trap 'rm -rf "$scratch"' EXIT
  curl --fail --silent --show-error --location --retry 3 \
    "https://github.com/jdx/mise/releases/download/v${local_version}/${asset}" -o "$scratch/mise"
  bash "$root/scripts/repo-python.sh" -c \
    'import hashlib, pathlib, sys; actual = hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(); sys.exit(0 if actual == sys.argv[2] else "Downloaded mise checksum does not match the repository pin")' \
    "$scratch/mise" "$expected"
  chmod 0755 "$scratch/mise"
  "$scratch/mise" --version >/dev/null
  if [[ -w "$(dirname "$destination")" ]]; then
    install -m 0755 "$scratch/mise" "$destination"
  else
    sudo -n install -m 0755 "$scratch/mise" "$destination"
  fi
  command -v mise >/dev/null || { echo 'mise was installed in /usr/local/bin; put that directory on PATH before retrying setup.' >&2; exit 1; }
)

# Installation validates the complete reviewed bundle before writing hook state.
# It runs no dependency lifecycle script. Unreviewed setup cannot upgrade hooks.
bash scripts/repo-python.sh scripts/repo-hooks.py install --root "$root"
if [[ "$(uname -s)" == Linux ]] && ! pkg-config --exists cairo pangocairo librsvg-2.0 pixman-1 2>/dev/null; then
  if [[ "$(id -u)" == 0 ]]; then
    apt-get update -qq
    apt-get install -y --no-install-recommends libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev libpixman-1-dev build-essential pkg-config python3
  else
    sudo -n apt-get update -qq
    sudo -n apt-get install -y --no-install-recommends libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev libpixman-1-dev build-essential pkg-config python3
  fi
fi
install_public_mise
mise trust "$root/.mise.toml"
mise install
if [[ -f package-lock.json ]]; then
  mise exec -- npm ci
fi
# The local server's --env-file requires a file; never replace existing settings.
[[ -e .env ]] || touch .env
bash scripts/repo-python.sh scripts/repo-hooks.py verify --root "$root"
echo 'Repository environment ready; no private configuration repository is required.'
