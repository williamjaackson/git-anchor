import { readFileSync, writeFileSync, chmodSync, existsSync } from "fs";
import { join } from "path";
import { getConfigBool, gitDir } from "./git";
import { info } from "./log";

/**
 * Read `anchor.hook` git config. Defaults to true. When false:
 *   - ensureHookInstalled() skips installation
 *   - the `__hook-post-checkout` command bails early, so already-installed
 *     hooks self-deactivate without needing to edit the file
 */
export function isHookEnabled(): boolean {
  return getConfigBool("anchor.hook", true);
}

const MARKER_START = "# >>> git-anchor managed block (do not edit)";
const MARKER_END = "# <<< git-anchor managed block";

const BLOCK = `${MARKER_START}
if [ "$3" = "1" ]; then
  git anchor __hook-post-checkout "$1" "$2" >/dev/null 2>&1 || true
fi
${MARKER_END}`;

function hookPath(): string {
  return join(gitDir(), "hooks", "post-checkout");
}

export function ensureHookInstalled(): void {
  if (!isHookEnabled()) return;
  const path = hookPath();

  if (!existsSync(path)) {
    writeFileSync(path, `#!/bin/sh\n${BLOCK}\n`);
    chmodSync(path, 0o755);
    info("git-anchor: installed post-checkout hook");
    return;
  }

  const current = readFileSync(path, "utf-8");
  if (current.includes(MARKER_START)) return;

  const needsNewline = current.length > 0 && !current.endsWith("\n");
  writeFileSync(path, current + (needsNewline ? "\n" : "") + BLOCK + "\n");
  chmodSync(path, 0o755);
  info("git-anchor: appended to existing post-checkout hook");
}
