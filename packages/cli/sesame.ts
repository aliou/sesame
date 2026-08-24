#!/usr/bin/env node
/**
 * Sesame - BM25 search for coding agent sessions
 * Main CLI entry point
 */

import indexCommand from "./commands/index-cmd";
import searchCommand from "./commands/search-cmd";
import skillsCommand from "./commands/skills-cmd";
import statusCommand from "./commands/status-cmd";
import watchCommand from "./commands/watch-cmd";
import { printFullUsage, printUsageFor, VERSION } from "./usage";

const commands: Record<string, (args: string[]) => Promise<void>> = {
  index: indexCommand,
  search: searchCommand,
  skills: skillsCommand,
  status: statusCommand,
  watch: watchCommand,
};

type Command = keyof typeof commands;

function isVersionFlag(arg: string): boolean {
  return arg === "--version" || arg === "-V";
}

function isHelpFlag(arg: string): boolean {
  return arg === "--help" || arg === "-h";
}

async function main() {
  const args = process.argv.slice(2);

  // Bare invocation or top-level help -> full usage to stdout, exit 0.
  if (args.length === 0 || args[0] === "help" || isHelpFlag(args[0])) {
    printFullUsage();
    process.exit(0);
  }

  // Top-level --version / -V -> print version and exit 0.
  if (isVersionFlag(args[0])) {
    console.log(VERSION);
    process.exit(0);
  }

  const commandName = args[0] as Command;
  const commandArgs = args.slice(1);

  // Unknown command -> error + hint to stderr, exit 1.
  if (!(commandName in commands)) {
    console.error(`Unknown command: ${commandName}`);
    console.error(`Run 'sesame help' for usage information.`);
    process.exit(1);
  }

  // Per-command help/version: intercept before the command parser rejects
  // them as unknown flags. Works anywhere in the command's argv, so
  // `sesame search --version` prints the version too.
  if (commandArgs.some(isHelpFlag)) {
    console.log(printUsageFor(commandName));
    process.exit(0);
  }
  if (commandArgs.some(isVersionFlag)) {
    console.log(VERSION);
    process.exit(0);
  }

  try {
    await commands[commandName](commandArgs);
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

main();
