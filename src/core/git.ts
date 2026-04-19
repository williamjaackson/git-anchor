import { execSync } from "child_process";
import { AnchorError } from "./error";

export function exec(args: string): string {
  return execSync(`git ${args}`, {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

export function execSafe(args: string): { ok: boolean; stdout: string } {
  try {
    return { ok: true, stdout: exec(args) };
  } catch {
    return { ok: false, stdout: "" };
  }
}

export function gitDir(): string {
  return exec("rev-parse --git-dir");
}

export function branchExists(name: string): boolean {
  return execSafe(`rev-parse --verify refs/heads/${name}`).ok;
}

export function getCurrentBranch(): string {
  return exec("rev-parse --abbrev-ref HEAD");
}

export function isDetached(): boolean {
  return getCurrentBranch() === "HEAD";
}

/**
 * Resolve a branch argument from a command's positional args:
 *   - If `explicit` is given, verify the branch exists and return it.
 *   - Otherwise fall back to the current branch, rejecting detached HEAD.
 *
 * Throws `AnchorError` with a user-facing message on any failure mode so
 * command handlers can just let it bubble to the top-level catch.
 */
export function requireBranch(explicit: string | undefined): string {
  if (explicit) {
    if (!branchExists(explicit)) {
      throw new AnchorError(`branch '${explicit}' does not exist`);
    }
    return explicit;
  }
  if (isDetached()) {
    throw new AnchorError("not on a branch (detached HEAD)");
  }
  return getCurrentBranch();
}

export function listLocalBranches(): string[] {
  const out = execSafe(
    "for-each-ref --format='%(refname:short)' refs/heads/",
  ).stdout;
  if (!out) return [];
  return out.split("\n").filter((s) => s.length > 0);
}

export function resolveRef(ref: string): string | null {
  const r = execSafe(`rev-parse --verify ${ref}`);
  return r.ok ? r.stdout : null;
}
