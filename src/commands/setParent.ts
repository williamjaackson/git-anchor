import type { Command } from "./types";
import { requireBranch } from "../core/git";
import {
  ensureAnchor,
  resolveAnchor,
  setParent,
  UUID_RE,
} from "../core/anchor";
import { AnchorError } from "../core/error";
import { out } from "../core/log";

export default {
  name: "set-parent",
  description: "manually set a branch's parent anchor",
  usage: "git anchor set-parent <branch> <parent-id>",
  examples: [
    "git anchor set-parent feature 7c9e6679-7425-40de-944b-e07fc1f90ae7",
  ],
  run(args: string[]) {
    const branchArg = args[0];
    const parentId = args[1];

    if (!branchArg || !parentId) {
      throw new AnchorError("usage: git anchor set-parent <branch> <parent-id>");
    }
    const branch = requireBranch(branchArg);

    if (!UUID_RE.test(parentId)) {
      throw new AnchorError(`not a valid UUID: '${parentId}'`);
    }
    if (!resolveAnchor(parentId)) {
      throw new AnchorError(`no branch found for anchor ${parentId}`);
    }

    ensureAnchor(branch);
    setParent(branch, parentId);
    out(`set parent of '${branch}' to ${parentId}`);
  },
} satisfies Command;
