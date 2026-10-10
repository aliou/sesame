/**
 * Argv helpers that run before Brocli parses the command line.
 */

import { rootCommandIndex } from "./kit/argv";
import {
  CLI_KIT_BOOLEAN_OPTIONS,
  CLI_KIT_BOOLEAN_VALUE_OPTIONS,
} from "./kit/context";

export const VALUE_OPTIONS = ["--output", "-o"];
export const VALUE_OPTION_PREFIXES = ["--output=", "-o="];

/** Options that may repeat, per root command. */
const REPEATABLE_OPTIONS: Record<string, string[]> = {
  search: ["--exclude", "--arg"],
};

export function sesameRootIndex(argv: string[]): number | undefined {
  return rootCommandIndex(argv, {
    valueOptions: VALUE_OPTIONS,
    valueOptionPrefixes: VALUE_OPTION_PREFIXES,
    booleanOptions: CLI_KIT_BOOLEAN_OPTIONS,
    booleanValueOptions: CLI_KIT_BOOLEAN_VALUE_OPTIONS,
    skipUnknownFlags: false,
  });
}

/** Commands whose arguments are handled before Brocli sees them. */
const EARLY_COMMANDS = new Set(["help", "complete", "completion"]);

/**
 * Brocli finds the command by assuming every flag takes a value, so
 * `sesame --compact search q` resolves to command `q`. Move the command name
 * in front of leading global flags: `sesame search --compact q`.
 */
export function hoistCommand(argv: string[]): string[] {
  const index = sesameRootIndex(argv);
  if (index === undefined || index === 2) return argv;
  const name = argv[index];
  if (name.startsWith("-") || EARLY_COMMANDS.has(name)) return argv;
  return [
    ...argv.slice(0, 2),
    name,
    ...argv.slice(2, index),
    ...argv.slice(index + 1),
  ];
}

/** Every argv rewrite, in order. */
export function normalizeArgv(argv: string[]): string[] {
  return foldRepeatedOptions(hoistCommand(argv));
}

/**
 * Brocli keeps only one value per option. Collect every value of a
 * repeatable option and pass them as a single JSON array, which the command
 * decodes with {@link decodeRepeated}. A flag with no value is left in place
 * so Brocli reports it.
 */
export function foldRepeatedOptions(argv: string[]): string[] {
  const index = sesameRootIndex(argv);
  if (index === undefined) return argv;
  const repeatable = REPEATABLE_OPTIONS[argv[index]];
  if (!repeatable) return argv;

  // Everything from `--` on is positional; keep it as is, at the end.
  const end = argv.indexOf("--", index + 1);
  const tail = end === -1 ? [] : argv.slice(end);
  const head = end === -1 ? argv : argv.slice(0, end);
  const kept = head.slice(0, index + 1);
  const values = new Map<string, string[]>();
  for (let i = index + 1; i < head.length; i++) {
    const option = readRepeatable(head, i, repeatable);
    if (!option) {
      kept.push(head[i]);
      continue;
    }
    values.set(option.name, [...(values.get(option.name) ?? []), option.value]);
    i += option.consumed - 1;
  }
  for (const [name, list] of values) kept.push(name, JSON.stringify(list));
  return [...kept, ...tail];
}

function readRepeatable(
  argv: string[],
  index: number,
  names: string[],
): { name: string; value: string; consumed: number } | undefined {
  const arg = argv[index];
  const [name, ...rest] = arg.split("=");
  if (!names.includes(name)) return undefined;
  if (rest.length > 0) return { name, value: rest.join("="), consumed: 1 };
  const next = argv[index + 1];
  if (next === undefined || next.startsWith("-")) return undefined;
  return { name, value: next, consumed: 2 };
}

/** Decode a value produced by {@link foldRepeatedOptions}. */
export function decodeRepeated(value: string | undefined): string[] {
  if (value === undefined) return [];
  const parsed: unknown = JSON.parse(value);
  return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
}
