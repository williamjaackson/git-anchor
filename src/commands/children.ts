import type { Command } from "./types";
import { requireBranch } from "../core/git";
import { getAnchor, listAnchors } from "../core/anchor";
import { out } from "../core/log";

export default {
  name: "children",
  description: "print the child anchor UUIDs (or names with --name)",
  usage: "git anchor children [branch] [--name]",
  examples: [
    "git anchor children",
    "git anchor children main",
    "git anchor children main --name",
  ],
  run(args: string[]) {
    const wantName = args.includes("--name");
    const positional = args.filter((a) => !a.startsWith("--"));
    const branch = requireBranch(positional[0]);

    const anchor = getAnchor(branch);
    if (!anchor) return;

    const children = listAnchors()
      .filter((entry) => entry.parent === anchor)
      .sort((a, b) => a.branch.localeCompare(b.branch));

    for (const child of children) {
      out(wantName ? child.branch : child.anchor);
    }
  },
} satisfies Command;
