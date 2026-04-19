import { exec, execSafe } from "./git";

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
 * Lazy-create an anchor for a single branch if missing.
 */
export function ensureAnchor(branch: string): string {
  const id = getAnchor(branch);
  if (id) return id;
  const fresh = generateId();
  setAnchor(branch, fresh);
  return fresh;
}
