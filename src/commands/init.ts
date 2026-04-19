import type { Command } from "./types";
import { runSweep } from "../core/anchor";
import { ensureHookInstalled } from "../core/hook";
import { out } from "../core/log";

export default {
  name: "init",
  description: "install hook and backfill anchors/parents for existing branches",
  usage: "git anchor init",
  examples: ["git anchor init"],
  run(_args: string[]) {
    ensureHookInstalled();
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
