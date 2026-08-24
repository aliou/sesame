/**
 * Usage text and version helpers for the Sesame CLI.
 *
 * Extracted from the entry point so tests can import `printUsageFor` and
 * `VERSION` without triggering `main()`.
 */

import pkg from "./package.json" with { type: "json" };

/** CLI version, sourced from packages/cli/package.json. */
export const VERSION: string = pkg.version;

const HEADER = `Sesame - Search for coding agent sessions

Usage: sesame <command> [options]

Commands:
  index              Index session files (incremental)
  index --full       Drop and rebuild index
  search [query]     Search sessions or browse recent sessions
  skills             List skills used across indexed sessions
  status             Show index statistics
  watch              Watch session files and index on change
  watch --interval <seconds>  Poll-based re-indexing at fixed interval`;

const SEARCH_OPTIONS = `Search options:
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
  --json             Output as JSON`;

const SKILLS_OPTIONS = `Skills options:
  --cwd <path>       Filter by project directory
  --after <date>     Filter sessions after date
  --before <date>    Filter sessions before date
  --actor <kind>     Filter by who used the skill: user | agent
  --limit <n>        Max results (default: 100)
  --json             Output as JSON`;

const GLOBAL_OPTIONS = `Global options:
  --help, -h         Show help (use 'sesame <command> --help' for per-command help)
  --version, -V      Print the CLI version and exit`;

/** Per-command usage text, used by `sesame <command> --help` / `-h`. */
const COMMAND_USAGE: Record<string, string> = {
  index: `Usage: sesame index [options]

Index session files (incremental, using each file's mtime).

Options:
  --full             Drop and rebuild the index from scratch
  ${GLOBAL_OPTIONS}`,
  search: `Usage: sesame search [query] [options]

Search indexed sessions with BM25, or browse recent sessions.

${SEARCH_OPTIONS}

${GLOBAL_OPTIONS}`,
  skills: `Usage: sesame skills [options]

List skills used across indexed sessions.

${SKILLS_OPTIONS}

${GLOBAL_OPTIONS}`,
  status: `Usage: sesame status

Show index statistics.

${GLOBAL_OPTIONS}`,
  watch: `Usage: sesame watch [options]

Watch session files and index on change.

Options:
  --interval <seconds>  Poll-based re-indexing at fixed interval

${GLOBAL_OPTIONS}`,
};

/**
 * Returns the help text for a single command. Exported so tests can verify
 * per-command help without invoking the CLI process.
 */
export function printUsageFor(command: string): string {
  return COMMAND_USAGE[command] ?? "";
}

/** Full usage text (top-level help / bare invocation). */
export function fullUsageText(): string {
  return `${HEADER}\n\n${SEARCH_OPTIONS}\n\n${SKILLS_OPTIONS}\n\n${GLOBAL_OPTIONS}`;
}

/** Prints the full usage to stdout. */
export function printFullUsage(): void {
  console.log(fullUsageText());
}
