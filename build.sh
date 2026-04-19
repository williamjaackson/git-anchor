#!/bin/sh
# Build git-anchor for the host or a named Bun target.
#
#   build.sh                → host platform, output ./git-anchor
#   build.sh <target>       → named target, output ./dist/git-anchor-<target>[.exe]
#                             e.g. build.sh darwin-arm64
#
# Bun cross-compiles to any target from any host. Darwin binaries get an
# ad-hoc codesign when the host has `codesign` available (macOS only).
set -e

sign_darwin() {
  path="$1"
  if command -v codesign >/dev/null 2>&1; then
    codesign --remove-signature "$path" 2>/dev/null || true
    codesign -f -s - "$path"
  fi
}

target="${1:-}"

if [ -z "$target" ]; then
  bun build src/index.ts --compile --outfile git-anchor --minify
  case "$(uname -s)" in
    Darwin) sign_darwin ./git-anchor ;;
  esac
  exit 0
fi

suffix=""
case "$target" in
  windows-*) suffix=".exe" ;;
esac

mkdir -p dist
output="dist/git-anchor-${target}${suffix}"
bun build src/index.ts --compile --target="bun-${target}" --outfile "$output" --minify

case "$target" in
  darwin-*) sign_darwin "$output" ;;
esac
