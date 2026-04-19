import { branchExists, exec, execSafe, listLocalBranches } from "./git";
import { ensureHookInstalled } from "./hook";
import { parseReflogCreatedFrom } from "./reflog";

const ANCHOR_KEY_RE = /^branch\.(.+)\.anchor (.+)$/;
const PARENT_KEY_RE = /^branch\.(.+)\.anchorparent (.+)$/;

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function generateId(): string {
  return crypto.randomUUID();
}

export function getAnchor(branch: string): string | null {
  const r = execSafe(`config --get branch.${branch}.anchor`);
  return r.ok && r.stdout ? r.stdout : null;
}

export function setAnchor(branch: string, id: string): void {
  exec(`config branch.${branch}.anchor ${id}`);
}

export function getParent(branch: string): string | null {
  const r = execSafe(`config --get branch.${branch}.anchorparent`);
  return r.ok && r.stdout ? r.stdout : null;
}

export function setParent(branch: string, parentId: string): void {
  exec(`config branch.${branch}.anchorparent ${parentId}`);
}

export function removeAnchor(branch: string): void {
  execSafe(`config --unset branch.${branch}.anchor`);
  execSafe(`config --unset branch.${branch}.anchorparent`);
}

export function removeParent(branch: string): void {
  execSafe(`config --unset branch.${branch}.anchorparent`);
}

function parseRegexp(key: "anchor" | "anchorparent"): Map<string, string> {
  const pattern = key === "anchor" ? ANCHOR_KEY_RE : PARENT_KEY_RE;
  const out = execSafe(
    `config --get-regexp ^branch\\..*\\.${key}$`,
  ).stdout;
  const result = new Map<string, string>();
  if (!out) return result;
  for (const line of out.split("\n")) {
    const m = line.match(pattern);
    if (m && m[1] && m[2]) result.set(m[1], m[2]);
  }
  return result;
}

export function resolveAnchor(id: string): string | null {
  const matches: string[] = [];
  for (const [branch, anchor] of parseRegexp("anchor")) {
    if (anchor === id) matches.push(branch);
  }
  if (matches.length === 0) return null;
  matches.sort();
  return matches[0] ?? null;
}

export interface AnchorEntry {
  branch: string;
  anchor: string;
  parent: string | null;
}

export function listAnchors(): AnchorEntry[] {
  const anchors = parseRegexp("anchor");
  const parents = parseRegexp("anchorparent");
  const entries: AnchorEntry[] = [];
  for (const [branch, anchor] of anchors) {
    entries.push({ branch, anchor, parent: parents.get(branch) ?? null });
  }
  entries.sort((a, b) => a.branch.localeCompare(b.branch));
  return entries;
}

/**
 * Lazy-create an anchor for a single branch if missing. Also ensures the
 * post-checkout hook is installed so future branch creations get captured.
 * Cost is bounded — one config read, one file-stat — regardless of repo size.
 */
export function ensureAnchor(branch: string): string {
  ensureHookInstalled();
  const id = getAnchor(branch);
  if (id) return id;
  const fresh = generateId();
  setAnchor(branch, fresh);
  return fresh;
}

/**
 * Assign an anchor to `branch` if missing. Used internally by the sweep so it
 * doesn't recurse into parent resolution for branches that already have one.
 * Returns null if the branch doesn't exist — guards against reflog-recovered
 * parent names that point to since-deleted branches, which would otherwise
 * leave orphan `branch.<ghost>.anchor` entries in git config.
 */
function ensureAnchorIdOnly(branch: string): string | null {
  const existing = getAnchor(branch);
  if (existing) return existing;
  if (!branchExists(branch)) return null;
  const id = generateId();
  setAnchor(branch, id);
  return id;
}

export interface SweepReport {
  anchored: Array<{ branch: string; anchor: string }>;
  parented: Array<{ branch: string; parentName: string }>;
  unrecoverable: string[];
  unchanged: number;
}

/**
 * Repo-wide pass: anchors every local branch that lacks one and attempts
 * reflog-based parent recovery for anchored-but-parentless branches.
 * Idempotent — returns a diff of what actually changed on this run.
 *
 * "unrecoverable" only includes branches that were anchored *this run* and
 * whose parent still couldn't be recovered — so re-running doesn't noisily
 * re-flag stable root branches like `main`.
 */
export function runSweep(): SweepReport {
  const branches = listLocalBranches();

  const before = new Map<
    string,
    { anchor: string | null; parent: string | null }
  >();
  for (const b of branches) {
    before.set(b, { anchor: getAnchor(b), parent: getParent(b) });
  }

  for (const branch of branches) {
    if (!getAnchor(branch)) setAnchor(branch, generateId());

    if (getParent(branch)) continue;

    const parentName = parseReflogCreatedFrom(branch);
    if (!parentName || parentName === branch) continue;

    const parentId = ensureAnchorIdOnly(parentName);
    if (!parentId) continue;
    setParent(branch, parentId);
  }

  const report: SweepReport = {
    anchored: [],
    parented: [],
    unrecoverable: [],
    unchanged: 0,
  };

  for (const branch of branches) {
    const prev = before.get(branch)!;
    const anchor = getAnchor(branch);
    const parent = getParent(branch);
    if (!anchor) continue;

    const newlyAnchored = !prev.anchor;
    const newlyParented = !prev.parent && parent !== null;

    if (newlyAnchored) report.anchored.push({ branch, anchor });

    if (newlyParented) {
      const parentName = resolveAnchor(parent!);
      if (parentName) report.parented.push({ branch, parentName });
    } else if (newlyAnchored && !parent) {
      report.unrecoverable.push(branch);
    }

    if (!newlyAnchored && !newlyParented) report.unchanged += 1;
  }

  return report;
}
