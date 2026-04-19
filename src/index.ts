import { getCommand } from "./commands";
import { printGlobalHelp } from "./commands/help";
import { AnchorError } from "./core/error";
import { err } from "./core/log";

function main() {
  const args = process.argv.slice(2);
  const first = args[0];

  if (!first) {
    printGlobalHelp();
    process.exit(1);
  }

  const command = getCommand(first);
  if (!command) {
    err(`unknown command: ${first}`);
    process.exit(1);
  }

  try {
    command.run(args.slice(1));
  } catch (e) {
    if (e instanceof AnchorError) {
      err(`error: ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
}

main();
