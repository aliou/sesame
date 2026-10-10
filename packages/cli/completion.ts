/**
 * Shell completion with @bomb.sh/tab. The tree mirrors the Brocli commands in
 * ./commands; completion-parity.test.ts keeps them in sync.
 *
 * - `sesame completion <shell>` prints the shell script.
 * - `sesame complete -- <args>` completes the in-progress command line.
 *
 * tab treats an option without a handler as boolean, so every option that
 * takes a value gets one, even if it offers nothing.
 */

import { existsSync } from "node:fs";
import {
  listIndexedSkills,
  openDatabase,
  TOOL_ARG_ALLOWLIST,
} from "@aliou/sesame";
import t, { type Command } from "@bomb.sh/tab";
import { sesameRootIndex } from "./argv";
import { sesamePaths } from "./context";
import { TOPICS } from "./help-topics";

type Complete = (value: string, description: string) => void;
type Handler = (this: unknown, complete: Complete) => void;
type Choice = { value: string; description: string };

export const SHELLS = ["bash", "zsh", "fish", "powershell"] as const;

let skillChoices: Choice[] = [];

/** Replace the skill names offered for --skill. Intended for tests. */
export function setSkillChoices(choices: Choice[]): void {
  skillChoices = choices;
}

function choices(list: () => Choice[]): Handler {
  return (complete) => {
    for (const entry of list()) complete(entry.value, entry.description);
  };
}

const freeValue: Handler = () => undefined;

function addGlobalOptions(cmd: Command): void {
  cmd.option("json", "Print JSON output (hidden alias for --output json)", "j");
  cmd.option(
    "output",
    "Output mode: human or json",
    choices(() => [
      { value: "human", description: "Readable text" },
      { value: "json", description: "JSON on stdout" },
    ]),
    "o",
  );
  cmd.option("pretty", "Pretty-print JSON output");
  cmd.option("compact", "Force single-line JSON output");
  cmd.option("quiet", "Suppress progress messages", "q");
  cmd.option("no-color", "Disable ANSI color");
  cmd.option("debug", "Print resolved paths to stderr");
}

function addDateOptions(cmd: Command): void {
  cmd.option("cwd", "Only sessions whose cwd starts with this path", freeValue);
  cmd.option("after", "Sessions modified after date (7d, 2w, 1m)", freeValue);
  cmd.option("before", "Sessions modified before date", freeValue);
}

const toolArgChoices = (): Choice[] =>
  Object.entries(TOOL_ARG_ALLOWLIST).flatMap(([tool, keys]) =>
    keys.map((key) => ({ value: `${tool}:${key}=`, description: "" })),
  );

addGlobalOptions(t);

const search = t.command("search", "Search sessions with BM25, or browse");
search.argument("query");
addDateOptions(search);
search.option("limit", "Max results", freeValue);
search.option("tools", "Search only tool-call chunks");
search.option(
  "tool",
  "Search tool calls of this tool name",
  choices(() =>
    Object.keys(TOOL_ARG_ALLOWLIST).map((value) => ({
      value,
      description: "",
    })),
  ),
);
search.option("via", "Only tool calls nested inside this tool", freeValue);
search.option("path", "Only tool calls that mention this path", freeValue);
search.option(
  "skill",
  "Sessions that used a skill",
  choices(() => skillChoices),
);
search.option("skill-path", "Skill SKILL.md path contains text", freeValue);
search.option(
  "arg",
  "Tool parameter filter tool:key=value",
  choices(toolArgChoices),
);
search.option("exclude", "Exclude a session id", freeValue);
addGlobalOptions(search);

const skills = t.command("skills", "List skills used across indexed sessions");
addDateOptions(skills);
skills.option(
  "actor",
  "Who loaded the skill",
  choices(() => [
    { value: "user", description: "Slash command or autocomplete" },
    { value: "agent", description: "SKILL.md read by a tool" },
  ]),
);
skills.option("limit", "Max rows", freeValue);
addGlobalOptions(skills);

const index = t.command("index", "Index session files");
index.option("full", "Drop and rebuild the index from scratch");
addGlobalOptions(index);

addGlobalOptions(t.command("status", "Show index statistics and location"));

const watchCmd = t.command("watch", "Keep the index updated");
watchCmd.option("interval", "Re-index every N seconds", freeValue);
addGlobalOptions(watchCmd);

for (const name of ["completion", "complete"]) {
  const completion = t.command(name, "Print shell completion script");
  completion.argument(
    "shell",
    choices(() => SHELLS.map((value) => ({ value, description: "" }))),
  );
  addGlobalOptions(completion);
}

const help = t.command("help", "Show help for a command or topic");
help.argument(
  "command-or-topic",
  choices(() =>
    [...t.commands.keys(), ...Object.keys(TOPICS)]
      .filter((value) => value !== "help" && value !== "complete")
      .map((value) => ({ value, description: "" })),
  ),
);
addGlobalOptions(help);

/** Load skill names from the index. Completion must never fail the shell. */
function loadSkillChoices(): Choice[] {
  const { databasePath } = sesamePaths();
  if (!existsSync(databasePath)) return [];
  try {
    const db = openDatabase(databasePath);
    try {
      return listIndexedSkills(db, { limit: 1000 }).map((skill) => ({
        value: skill.name,
        description: `${skill.sessionCount} sessions`,
      }));
    } finally {
      db.close();
    }
  } catch {
    // An unreadable index offers no skill names.
    return [];
  }
}

function isSupportedShell(shell: string | undefined): boolean {
  return (SHELLS as readonly string[]).includes(shell ?? "");
}

export async function handleCompletion(argv: string[]): Promise<boolean> {
  const index = sesameRootIndex(argv);
  const name = index === undefined ? undefined : argv[index];
  if (index === undefined || (name !== "complete" && name !== "completion")) {
    return false;
  }
  const shell = argv[index + 1];
  if (shell === "--") {
    const args = argv.slice(index + 2);
    if (args.includes("--skill")) skillChoices = loadSkillChoices();
    t.parse(args);
    return true;
  }
  if (!isSupportedShell(shell)) return false;
  t.setup("sesame", "sesame", shell as string);
  return true;
}
