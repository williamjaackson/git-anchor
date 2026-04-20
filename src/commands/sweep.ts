import type { Command } from "./types";
import { runSweep } from "../core/anchor";
import { out } from "../core/log";

export default {
  name: "sweep",
  description: "anchor every local branch and recover parents from reflog",
  usage: "git anchor sweep",
  examples: ["git anchor sweep"],
  run(_args: string[]) {
    const report = runSweep();

    const totalChanges =
      report.anchored.length +
      report.parented.length +
      report.unrecoverable.length;

    if (totalChanges === 0) {
      out(`nothing to do — ${report.unchanged} branches already set up`);
      return;
    }

    if (report.anchored.length > 0) {
      out("anchored:");
      const width = Math.max(...report.anchored.map((a) => a.branch.length));
      for (const { branch, anchor } of report.anchored) {
        out(`  ${branch.padEnd(width)}  ${anchor}`);
      }
    }

    if (report.parented.length > 0) {
      out("parented:");
      const width = Math.max(...report.parented.map((p) => p.branch.length));
      for (const { branch, parentName } of report.parented) {
        out(`  ${branch.padEnd(width)}  -> ${parentName}`);
      }
    }

    if (report.unrecoverable.length > 0) {
      out("no parent recoverable:");
      for (const branch of report.unrecoverable) {
        out(`  ${branch}`);
      }
    }
  },
} satisfies Command;
