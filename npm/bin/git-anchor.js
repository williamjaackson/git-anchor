#!/usr/bin/env node
// Wrapper that execs the vendored git-anchor binary. npm's bin shim only
// speaks JS, so we hop through Node to reach the native binary.

const path = require("path");
const { spawnSync } = require("child_process");

const exeSuffix = process.platform === "win32" ? ".exe" : "";
const binary = path.join(__dirname, "..", "vendor", `git-anchor${exeSuffix}`);

const result = spawnSync(binary, process.argv.slice(2), {
  stdio: "inherit",
});

if (result.error) {
  if (result.error.code === "ENOENT") {
    console.error(
      "git-anchor: binary not found. Reinstall with `npm install -g git-anchor`.",
    );
  } else {
    console.error(`git-anchor: failed to exec binary: ${result.error.message}`);
  }
  process.exit(1);
}

process.exit(result.status ?? 1);
