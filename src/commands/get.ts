import type { Command } from "./types";
import { requireBranch } from "../core/git";
import { ensureAnchor, getAnchor } from "../core/anchor";
import { err, out } from "../core/log";

export default {
  name: "get",
  description: "print the anchor UUID for a branch (auto-creates)",
  usage: "git anchor get [branch] [--no-create]",
  examples: [
    "git anchor get",
    "git anchor get feature",
    "git anchor get --no-create",
  ],
  run(args: string[]) {
    const noCreate = args.includes("--no-create");
    const positional = args.filter((a) => !a.startsWith("--"));
    const branch = requireBranch(positional[0]);

    if (noCreate) {
      const existing = getAnchor(branch);
      if (!existing) {
        err(`no anchor for '${branch}'`);
        process.exit(1);
      }
      out(existing);
      return;
    }

    out(ensureAnchor(branch));
  },
} satisfies Command;
