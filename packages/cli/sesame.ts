#!/usr/bin/env node
/**
 * Sesame - Semantic search for coding agent sessions
 * Main CLI entry point
 */

import indexCommand from "./commands/index-cmd";
import searchCommand from "./commands/search-cmd";
import statusCommand from "./commands/status-cmd";
import watchCommand from "./commands/watch-cmd";

const commands: Record<string, (args: string[]) => Promise<void>> = {
  index: indexCommand,
  search: searchCommand,
  status: statusCommand,
  watch: watchCommand,
  help: async (_args: string[]) => {
    printUsage();
  },
};

type Command = keyof typeof commands;

function printUsage() {
  console.log(`Sesame - Search for coding agent sessions

Usage: sesame <command> [options]

Commands:
  index              Index session files (incremental)
  index --full       Drop and rebuild index
  search <query>     Search sessions
  status             Show index statistics
  watch              Watch session files and index on change
  watch --interval <seconds>  Poll-based re-indexing at fixed interval

Search options:
  --cwd <path>       Filter by project directory
  --after <date>     Filter sessions after date (7d, 2w, 1m, or ISO date)
  --before <date>    Filter sessions before date
  --limit <n>        Max results (default: 10)
  --tools            Search only tool call chunks
  --tool <name>      Search specific tool type
  --json             Output as JSON
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (
    args.length === 0 ||
    args[0] === "help" ||
    args[0] === "--help" ||
    args[0] === "-h"
  ) {
    printUsage();
    process.exit(0);
  }

  const commandName = args[0] as Command;
  const commandArgs = args.slice(1);

  if (!(commandName in commands)) {
    console.error(`Unknown command: ${commandName}`);
    console.error(`Run 'sesame help' for usage information.`);
    process.exit(1);
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
