import type { Command } from "./types";
import { requireBranch } from "../core/git";
import { removeAnchor } from "../core/anchor";
import { out } from "../core/log";

export default {
  name: "remove",
  description: "clear the anchor for a branch",
  usage: "git anchor remove [branch]",
  examples: ["git anchor remove", "git anchor remove feature"],
  run(args: string[]) {
    const positional = args.filter((a) => !a.startsWith("--"));
    const branch = requireBranch(positional[0]);

    removeAnchor(branch);
    out(`cleared anchor for '${branch}'`);
  },
} satisfies Command;
