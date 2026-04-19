#!/bin/sh
# One-line installer for git-anchor.
#
#   curl -fsSL https://raw.githubusercontent.com/williamjaackson/git-anchor/master/install.sh | sh
#
# Downloads the latest release binary for the host OS/arch and drops it at
# $INSTALL_DIR/git-anchor (defaults to ~/.local/bin).
#
# Supports: darwin-arm64, darwin-x64, linux-x64, linux-arm64.
# Windows users: download git-anchor-windows-x64.exe from the releases page
# manually and add it to PATH.

set -e

REPO="williamjaackson/git-anchor"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"

# Detect OS
os=$(uname -s | tr '[:upper:]' '[:lower:]')
case "${os}" in
  darwin|linux) ;;
  *)
    printf 'git-anchor installer does not support OS "%s".\n' "${os}" >&2
    printf 'Download a binary from https://github.com/%s/releases manually.\n' "${REPO}" >&2
    exit 1
    ;;
esac

# Detect arch
arch=$(uname -m)
case "${arch}" in
  arm64|aarch64) arch="arm64" ;;
  x86_64|amd64) arch="x64" ;;
  *)
    printf 'git-anchor installer does not support architecture "%s".\n' "${arch}" >&2
    exit 1
    ;;
esac

target="${os}-${arch}"

# Resolve latest release tag via the GitHub API.
api="https://api.github.com/repos/${REPO}/releases/latest"
version=$(curl -fsSL "${api}" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -1)
if [ -z "${version}" ]; then
  printf 'Could not resolve latest release from %s\n' "${api}" >&2
  exit 1
fi

url="https://github.com/${REPO}/releases/download/${version}/git-anchor-${target}"

mkdir -p "${INSTALL_DIR}"
dest="${INSTALL_DIR}/git-anchor"

printf 'Installing git-anchor %s (%s) to %s\n' "${version}" "${target}" "${dest}"
curl -fsSL "${url}" -o "${dest}"
chmod +x "${dest}"

printf 'Installed: %s\n' "${dest}"

case ":${PATH}:" in
  *":${INSTALL_DIR}:"*) ;;
  *)
    printf '\n'
    printf 'Note: %s is not on your PATH.\n' "${INSTALL_DIR}"
    printf 'Add this to your shell profile:\n'
    printf '  export PATH="%s:$PATH"\n' "${INSTALL_DIR}"
    ;;
esac
