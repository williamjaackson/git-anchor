import { execSafe } from "./git";

/**
 * Best-effort parent detection from a branch's reflog. Returns the branch
 * name recorded at creation, or null if not resolvable.
 *
 * Strategy:
 *   1. Parse `<branch>`'s own reflog for the oldest "branch: Created from X"
 *      entry. If X is a real branch name, use it.
 *   2. If X is "HEAD" (typical for `git checkout -b <name>` without an
 *      explicit source), scan HEAD's reflog for the oldest
 *      "checkout: moving from <Y> to <branch>" entry and use Y.
 */
export function parseReflogCreatedFrom(branch: string): string | null {
  const own = execSafe(
    `reflog show --format=%gs refs/heads/${branch}`,
  ).stdout;
  if (!own) return null;

  const lines = own.split("\n").filter((l) => l.length > 0);
  const oldest = lines[lines.length - 1];
  if (!oldest) return null;

  const match = oldest.match(/^branch: Created from (.+)$/);
  if (!match) return null;

  const source = match[1]?.trim();
  if (!source) return null;

  if (source !== "HEAD") return source;

  const headLog = execSafe("reflog show --format=%gs HEAD").stdout;
  if (!headLog) return null;

  const headLines = headLog.split("\n").filter((l) => l.length > 0);
  const re = new RegExp(
    `^checkout: moving from (.+) to ${escapeRegex(branch)}$`,
  );
  for (let i = headLines.length - 1; i >= 0; i--) {
    const line = headLines[i];
    if (!line) continue;
    const m = line.match(re);
    if (m && m[1]) {
      const from = m[1].trim();
      if (from && from !== "HEAD" && from !== branch) return from;
    }
  }
  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
