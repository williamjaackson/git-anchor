import type { Command } from "./types";
import get from "./get";
import resolve from "./resolve";
import help from "./help";

const commands: Command[] = [get, resolve, help];

const commandMap = new Map(commands.map((c) => [c.name, c]));

export function getCommand(name: string): Command | undefined {
  return commandMap.get(name);
}

export function getAllCommands(): Command[] {
  return commands;
}
