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

const commands: Record<string, (args: string[]) => Promise<void>> = {
  index: indexCommand,
  search: searchCommand,
  skills: skillsCommand,
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
  search [query]     Search sessions or browse recent sessions
  skills             List skills used across indexed sessions
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
  --path <file>      Find sessions that touched a file
  --skill <text>     Find sessions by skill: exact name, else fuzzy over name and description
  --arg <t:k=v>      Find sessions where tool <t> was called with param <k> matching <v> (repeatable)
  --skill-path <s>   Find sessions that used a skill whose SKILL.md path contains <s>
  --exclude <id>     Exclude session ID (repeatable)
  --json             Output as JSON

Skills options:
  --cwd <path>       Filter by project directory
  --after <date>     Filter sessions after date
  --before <date>    Filter sessions before date
  --actor <kind>     Filter by who used the skill: user | agent
  --limit <n>        Max results (default: 100)
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
