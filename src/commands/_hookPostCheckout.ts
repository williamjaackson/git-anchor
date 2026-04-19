import type { Command } from "./types";
import {
  branchExists,
  branchesAtSha,
  execSafe,
  getCurrentBranch,
} from "../core/git";
import {
  generateId,
  getAnchor,
  setAnchor,
  setParent,
} from "../core/anchor";
import { isHookEnabled } from "../core/hook";
import { parseReflogCreatedFrom } from "../core/reflog";

export default {
  name: "__hook-post-checkout",
  description: "internal: invoked by the post-checkout hook",
  usage: "git anchor __hook-post-checkout <prev-sha> <new-sha>",
  hidden: true,
  run(args: string[]) {
    if (!isHookEnabled()) return;

    const prevSha = args[0];
    const newSha = args[1];
    if (!prevSha || !newSha) return;

    const current = getCurrentBranch();
    if (current === "HEAD") return; // detached
    if (getAnchor(current)) return; // already anchored

    setAnchor(current, generateId());

    const parentName = inferParent(current, prevSha);
    if (!parentName) return;
    if (!branchExists(parentName)) return; // defend against stale reflog entries

    let parentId = getAnchor(parentName);
    if (!parentId) {
      parentId = generateId();
      setAnchor(parentName, parentId);
    }
    setParent(current, parentId);
  },
} satisfies Command;

function inferParent(current: string, prevSha: string): string | null {
  const atPrev = branchesAtSha(prevSha).filter((b) => b !== current);
  if (atPrev.length === 1 && atPrev[0]) return atPrev[0];

  const fromReflog = parseReflogCreatedFrom(current);
  if (fromReflog) return fromReflog;

  const prev = execSafe("rev-parse --abbrev-ref @{-1}").stdout;
  if (prev && prev !== "HEAD" && prev !== current) return prev;

  return null;
}
