#!/bin/sh
bun build src/index.ts --compile --outfile git-anchor --minify
codesign --remove-signature ./git-anchor
codesign -f -s - ./git-anchor
