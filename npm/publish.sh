#!/bin/sh
# Publish the npm package for the current `package.json` version.
#
# Usage: bash npm/publish.sh
#
# Expects `npm login` to have been run. Copies README.md and LICENSE from
# the repo root into the npm/ directory at pack time, publishes, then cleans
# up. Exits non-zero if the package version doesn't match the latest git tag.
set -e

cd "$(dirname "$0")"

PKG_VERSION=$(node -p "require('./package.json').version")
LATEST_TAG=$(git describe --tags --abbrev=0 --match 'v*')
EXPECTED="v${PKG_VERSION}"

if [ "${LATEST_TAG}" != "${EXPECTED}" ]; then
  echo "npm: package version (${PKG_VERSION}) does not match latest tag (${LATEST_TAG})." >&2
  echo "    Update npm/package.json to match the tag you want to publish." >&2
  exit 1
fi

cleanup() {
  rm -f README.md LICENSE
}
trap cleanup EXIT

cp ../README.md ./README.md
cp ../LICENSE ./LICENSE

echo "npm: publishing git-anchor@${PKG_VERSION}"
npm publish "$@"
