/**
 * `sesame help <topic>`: help for things that are not commands.
 */

import { sesameRootIndex } from "./argv";
import { writeHuman } from "./kit/output";

export const TOPICS: Record<string, string> = {
  config: `Configuration

Sesame reads <config-dir>/config.jsonc, normally ~/.config/sesame/config.jsonc.
It is created on first use with:

  { "piSessionPaths": ["~/.pi/agent/sessions"] }

The index lives at <data-dir>/index.sqlite, normally
~/.local/share/sesame/index.sqlite.

Environment:
  SESAME_DATA_DIR     Data directory (overrides XDG_DATA_HOME/sesame)
  SESAME_CONFIG_DIR   Config directory (overrides XDG_CONFIG_HOME/sesame)
  NO_COLOR            Disable color output

Run any command with --debug to print the resolved paths to stderr.`,
  json: `JSON output

Use --output json (or -o json) for machine-readable output on stdout.
Errors are JSON objects on stderr: {"error":{"code":"...","message":"..."}}.
Progress, warnings, hints, and --debug output always go to stderr.

JSON is indented on a terminal and single-line when piped. Use --pretty or
--compact to force either. sesame watch always prints one JSON object per
line.`,
  "exit-codes": `Exit codes

0    Success
1    Runtime failure (database, config, index lock held)
2    Usage error (unknown command or flag, missing or invalid value)
3    sesame index finished, but some session files failed to index
130  Interrupted`,
  completion: `Shell completion

Run sesame completion <bash|zsh|fish|powershell> to print a completion
script for your shell. For example:

  sesame completion zsh > "\${fpath[1]}/_sesame"
  sesame completion fish > ~/.config/fish/completions/sesame.fish

Generated scripts call sesame complete -- internally. --skill completes skill
names from the local index.`,
  "agent-guide": `Automation guide

Use -o json and treat stdout as data and stderr as diagnostics. Check the
exit code: 2 means the command line was wrong, 1 means sesame failed.

Typical flow:
  sesame search "query" -o json --limit 5
  sesame search "*" --cwd /path/to/project --after 7d -o json
  sesame skills -o json
  sesame search "*" --skill <name> -o json

Quote multi-word queries. Repeat --exclude to page past sessions you have
already seen.`,
};

export function renderHelpTopic(topic?: string): string {
  if (!topic) {
    return `Run sesame --help for commands. Topics: ${Object.keys(TOPICS).join(", ")}.`;
  }
  return (
    TOPICS[topic] ??
    `No help topic named ${topic}. Run sesame ${topic} --help for command help.`
  );
}

export function printHelpTopic(topic?: string): void {
  writeHuman(renderHelpTopic(topic));
}

/**
 * Handle `help <topic>` before Brocli dispatch. Anything else falls through
 * so Brocli renders command or global help.
 */
export function handleHelp(argv: string[]): boolean {
  const index = sesameRootIndex(argv);
  if (index === undefined || argv[index] !== "help") return false;
  const topic = argv[index + 1];
  if (!topic || !TOPICS[topic]) return false;
  printHelpTopic(topic);
  return true;
}
