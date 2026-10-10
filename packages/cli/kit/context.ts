// Copied from @378labs/sbx-cli-kit 4.3.0 (homelab/sandbox libraries/cli-kit).

import { boolean, string } from "@drizzle-team/brocli";
import { usageError } from "./errors";

export type OutputMode = "human" | "json";

export type OutputOptions = {
  json?: boolean;
  output?: string;
  pretty?: boolean;
  compact?: boolean;
  quiet?: boolean;
  noColor?: boolean;
};

export type DebugOptions = {
  debug?: boolean;
};

type CliKitOptions = OutputOptions & DebugOptions;

let globals: CliKitOptions = {};
let commandExitCode = 0;

export const OUTPUT_OPTIONS = {
  json: boolean("json")
    .alias("j")
    .hidden()
    .desc("Print JSON output (hidden alias for --output json)"),
  output: string("output").alias("o").desc("Output mode: human or json"),
  pretty: boolean("pretty").desc("Pretty-print JSON output"),
  compact: boolean("compact").desc("Force single-line JSON output"),
  quiet: boolean("quiet").alias("q").desc("Suppress confirmation messages"),
  noColor: boolean("no-color").desc("Disable ANSI color and animation"),
};

export const DEBUG_OPTIONS = {
  debug: boolean("debug").desc("Print safe diagnostic details to stderr"),
};

export const CLI_KIT_BOOLEAN_OPTIONS = [
  "--json",
  "-j",
  "--pretty",
  "--compact",
  "--quiet",
  "-q",
  "--no-color",
  "--debug",
  "--help",
  "-h",
  "--version",
  "-v",
];

export const CLI_KIT_BOOLEAN_VALUE_OPTIONS = CLI_KIT_BOOLEAN_OPTIONS.flatMap(
  (option) => [`${option}=true`, `${option}=false`],
);

export function setGlobalOptions(next: CliKitOptions | undefined): void {
  globals = next ?? {};
}

export function getGlobalOptions(): CliKitOptions {
  return globals;
}

export function setCommandExitCode(code: number): void {
  commandExitCode = code;
}

export function getCommandExitCode(): number {
  return commandExitCode;
}

export function resetCommandExitCode(): void {
  commandExitCode = 0;
}

export function outputMode(
  options: Pick<OutputOptions, "json" | "output">,
): OutputMode {
  if (options.json) return "json";
  if (options.output === undefined || options.output === "human") {
    return "human";
  }
  if (options.output === "json") return "json";
  throw usageError('--output must be "human" or "json"');
}

export function getOutputMode(): OutputMode {
  return outputMode(globals);
}

export function getPretty(): boolean {
  return globals.pretty === true;
}

export function getCompact(): boolean {
  return globals.compact === true;
}

export function getQuiet(): boolean {
  return globals.quiet === true;
}

export function getNoColor(): boolean {
  return globals.noColor === true;
}

export function getDebug(): boolean {
  return globals.debug === true;
}
