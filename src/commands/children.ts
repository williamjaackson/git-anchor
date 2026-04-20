import type { Command } from "./types";
import { requireBranch } from "../core/git";
import {
  ensureAnchor,
  listAnchors,
  runSweep,
} from "../core/anchor";
import { out } from "../core/log";

export default {
  name: "children",
  description: "print the child anchor UUIDs (or names with --name)",
  usage: "git anchor children [branch] [--name] [--no-sweep]",
  examples: [
    "git anchor children",
    "git anchor children main",
    "git anchor children main --name",
    "git anchor children main --no-sweep",
  ],
  run(args: string[]) {
    const wantName = args.includes("--name");
    const noSweep = args.includes("--no-sweep");
    const positional = args.filter((a) => !a.startsWith("--"));
    const branch = requireBranch(positional[0]);

    const anchor = ensureAnchor(branch);

    let children = listAnchors()
      .filter((entry) => entry.parent === anchor)
      .sort((a, b) => a.branch.localeCompare(b.branch));

    if (children.length === 0 && !noSweep) {
      // No children recorded — compensating full sweep may populate parents
      // on branches that were created without being individually queried.
      runSweep();
      children = listAnchors()
        .filter((entry) => entry.parent === anchor)
        .sort((a, b) => a.branch.localeCompare(b.branch));
    }

    for (const child of children) {
      out(wantName ? child.branch : child.anchor);
    }
  },
} satisfies Command;
