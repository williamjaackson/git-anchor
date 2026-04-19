import type { Command } from "./types";
import { listAnchors } from "../core/anchor";
import { out } from "../core/log";

export default {
  name: "list",
  description: "list all branches with their anchors",
  usage: "git anchor list [--json]",
  examples: ["git anchor list", "git anchor list --json"],
  run(args: string[]) {
    const json = args.includes("--json");
    const entries = listAnchors();

    if (json) {
      out(JSON.stringify(entries, null, 2));
      return;
    }

    for (const e of entries) {
      out(`${e.branch}\t${e.anchor}`);
    }
  },
} satisfies Command;
