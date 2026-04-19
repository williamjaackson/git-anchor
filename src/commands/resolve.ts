import type { Command } from "./types";
import { resolveAnchor, UUID_RE } from "../core/anchor";
import { AnchorError } from "../core/error";
import { err, out } from "../core/log";

export default {
  name: "resolve",
  description: "resolve an anchor UUID to a branch name",
  usage: "git anchor resolve <id>",
  examples: ["git anchor resolve 7c9e6679-7425-40de-944b-e07fc1f90ae7"],
  run(args: string[]) {
    const id = args[0];
    if (!id) {
      throw new AnchorError("missing <id>");
    }
    if (!UUID_RE.test(id)) {
      throw new AnchorError(`not a valid UUID: '${id}'`);
    }

    const name = resolveAnchor(id);
    if (!name) {
      err(`no branch found for anchor ${id}`);
      process.exit(1);
    }
    out(name);
  },
} satisfies Command;
