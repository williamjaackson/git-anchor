import { exec, execSafe } from "./git";

const ANCHOR_KEY_RE = /^branch\.(.+)\.anchor (.+)$/;

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

export function removeAnchor(branch: string): void {
  execSafe(`config --unset branch.${branch}.anchor`);
}

function parseAnchorConfig(): Map<string, string> {
  const out = execSafe(
    `config --get-regexp ^branch\\..*\\.anchor$`,
  ).stdout;
  const result = new Map<string, string>();
  if (!out) return result;
  for (const line of out.split("\n")) {
    const m = line.match(ANCHOR_KEY_RE);
    if (m && m[1] && m[2]) result.set(m[1], m[2]);
  }
  return result;
}

export function resolveAnchor(id: string): string | null {
  const matches: string[] = [];
  for (const [branch, anchor] of parseAnchorConfig()) {
    if (anchor === id) matches.push(branch);
  }
  if (matches.length === 0) return null;
  matches.sort();
  return matches[0] ?? null;
}

export interface AnchorEntry {
  branch: string;
  anchor: string;
}

export function listAnchors(): AnchorEntry[] {
  const entries: AnchorEntry[] = [];
  for (const [branch, anchor] of parseAnchorConfig()) {
    entries.push({ branch, anchor });
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
