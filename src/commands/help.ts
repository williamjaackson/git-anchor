import type { Command } from "./types";
import { getAllCommands, getCommand } from "./index";
import { err, out } from "../core/log";

export function printGlobalHelp(): void {
  out("usage: git anchor <command> [args]");
  out("");
  out("commands:");
  const visible = getAllCommands().filter((c) => !c.hidden);
  const width = Math.max(...visible.map((c) => c.name.length));
  for (const cmd of visible) {
    out(`  ${cmd.name.padEnd(width)}  ${cmd.description}`);
  }
  out("");
  out("run 'git anchor help <command>' for command-specific help");
}

export function printCommandHelp(cmd: Command): void {
  out(cmd.description);
  out("");
  out(`usage: ${cmd.usage}`);
  if (cmd.examples && cmd.examples.length > 0) {
    out("");
    out("examples:");
    for (const ex of cmd.examples) {
      out(`  ${ex}`);
    }
  }
}

export default {
  name: "help",
  description: "show help for a command",
  usage: "git anchor help [command]",
  examples: ["git anchor help", "git anchor help get"],
  run(args: string[]) {
    const name = args[0];
    if (!name) {
      printGlobalHelp();
      return;
    }
    const cmd = getCommand(name);
    if (!cmd) {
      err(`unknown command: ${name}`);
      process.exit(1);
    }
    printCommandHelp(cmd);
  },
} satisfies Command;
