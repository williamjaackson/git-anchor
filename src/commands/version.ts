import type { Command } from "./types";
import pkg from "../../package.json";
import { out } from "../core/log";

export default {
  name: "version",
  description: "print the git-anchor version",
  usage: "git anchor version",
  examples: ["git anchor version"],
  run(_args: string[]) {
    out(pkg.version);
  },
} satisfies Command;
