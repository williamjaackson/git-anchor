import type { Command } from "./types";
import { requireBranch } from "../core/git";
import { getParent, resolveAnchor, runSweep } from "../core/anchor";
import { out } from "../core/log";

export default {
  name: "parent",
  description: "print the parent anchor UUID (or branch name with --name)",
  usage: "git anchor parent [branch] [--name] [--no-sweep]",
  examples: [
    "git anchor parent",
    "git anchor parent feature",
    "git anchor parent feature --name",
    "git anchor parent feature --no-sweep",
  ],
  run(args: string[]) {
    const wantName = args.includes("--name");
    const noSweep = args.includes("--no-sweep");
    const positional = args.filter((a) => !a.startsWith("--"));
    const branch = requireBranch(positional[0]);

    let parentId = getParent(branch);

    if (!parentId && !noSweep) {
      // No parent recorded — compensating full sweep tries to recover it.
      runSweep();
      parentId = getParent(branch);
    }

    if (!parentId) return;

    if (!wantName) {
      out(parentId);
      return;
    }

    const name = resolveAnchor(parentId);
    if (!name) return;
    out(name);
  },
} satisfies Command;
