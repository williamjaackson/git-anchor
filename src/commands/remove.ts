import type { Command } from "./types";
import { requireBranch } from "../core/git";
import { removeAnchor, removeParent } from "../core/anchor";
import { out } from "../core/log";

export default {
  name: "remove",
  description: "clear the anchor and parent for a branch",
  usage: "git anchor remove [branch] [--parent]",
  examples: [
    "git anchor remove",
    "git anchor remove feature",
    "git anchor remove feature --parent",
  ],
  run(args: string[]) {
    const parentOnly = args.includes("--parent");
    const positional = args.filter((a) => !a.startsWith("--"));
    const branch = requireBranch(positional[0]);

    if (parentOnly) {
      removeParent(branch);
      out(`cleared parent for '${branch}'`);
      return;
    }

    removeAnchor(branch);
    out(`cleared anchor for '${branch}'`);
  },
} satisfies Command;
