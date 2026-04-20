import type { Command } from "./types";
import init from "./init";
import get from "./get";
import parent from "./parent";
import children from "./children";
import resolve from "./resolve";
import list from "./list";
import setParent from "./setParent";
import remove from "./remove";
import version from "./version";
import help from "./help";

const commands: Command[] = [
  init,
  get,
  parent,
  children,
  resolve,
  list,
  setParent,
  remove,
  version,
  help,
];

const commandMap = new Map(commands.map((c) => [c.name, c]));

export function getCommand(name: string): Command | undefined {
  return commandMap.get(name);
}

export function getAllCommands(): Command[] {
  return commands;
}
