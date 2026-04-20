#!/usr/bin/env node
// Postinstall script: downloads the git-anchor binary for this host's
// platform + arch from the matching GitHub release.
//
// Runs on every `npm install git-anchor`. The binary lands in ./vendor/
// and the bin wrapper at ./bin/git-anchor.js execs it.

const fs = require("fs");
const path = require("path");
const https = require("https");

const REPO = "williamjaackson/git-anchor";
const VERSION = require("./package.json").version;

const TARGETS = {
  "darwin-arm64": "darwin-arm64",
  "darwin-x64": "darwin-x64",
  "linux-arm64": "linux-arm64",
  "linux-x64": "linux-x64",
  "win32-x64": "windows-x64",
};

const key = `${process.platform}-${process.arch}`;
const target = TARGETS[key];
if (!target) {
  console.error(
    `git-anchor: unsupported platform ${key}. Supported: ${Object.keys(TARGETS).join(", ")}.`,
  );
  process.exit(1);
}

const exeSuffix = process.platform === "win32" ? ".exe" : "";
const assetName = `git-anchor-${target}${exeSuffix}`;
const url = `https://github.com/${REPO}/releases/download/v${VERSION}/${assetName}`;

const vendorDir = path.join(__dirname, "vendor");
const outPath = path.join(vendorDir, `git-anchor${exeSuffix}`);

fs.mkdirSync(vendorDir, { recursive: true });

function download(fromUrl, dest) {
  return new Promise((resolve, reject) => {
    const req = https.get(fromUrl, (res) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        res.resume();
        download(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} fetching ${fromUrl}`));
        res.resume();
        return;
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
      file.on("error", (err) => {
        fs.unlink(dest, () => reject(err));
      });
    });
    req.on("error", reject);
  });
}

(async () => {
  console.log(`git-anchor: downloading ${assetName} (v${VERSION})`);
  try {
    await download(url, outPath);
    if (process.platform !== "win32") {
      fs.chmodSync(outPath, 0o755);
    }
    console.log(`git-anchor: installed to ${outPath}`);
  } catch (err) {
    console.error(`git-anchor: install failed: ${err.message}`);
    console.error(
      `See https://github.com/${REPO}/releases/tag/v${VERSION} to download manually.`,
    );
    process.exit(1);
  }
})();
