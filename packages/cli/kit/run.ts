// Adapted from @378labs/sbx-cli-kit 4.3.0 (homelab/sandbox libraries/cli-kit).
// Changes are marked "Sesame change".

import type { Command, GlobalHelpEvent } from "@drizzle-team/brocli";
import { run } from "@drizzle-team/brocli";
import { rootCommandIndex } from "./argv";
import {
  CLI_KIT_BOOLEAN_OPTIONS,
  CLI_KIT_BOOLEAN_VALUE_OPTIONS,
  type DebugOptions,
  getCommandExitCode,
  getCompact,
  getOutputMode,
  getPretty,
  type OutputOptions,
  outputMode,
  resetCommandExitCode,
  setGlobalOptions,
} from "./context";
import {
  type CliError,
  type ErrorNormalizer,
  printCliError,
  usageError,
} from "./errors";

type BrocliGlobals = Record<string, unknown>;

export interface RunCliOptions {
  name: string;
  description: string;
  version: string;
  commands: Command[];
  globals: BrocliGlobals;
  argv: string[];
  valueOptions?: string[];
  valueOptionPrefixes?: string[];
  booleanOptions?: string[];
  booleanValueOptions?: string[];
  skipUnknownFlags?: boolean;
  transformArgv?: (argv: string[]) => string[];
  handleHelp?: (argv: string[]) => boolean;
  handleCompletion?: (argv: string[]) => boolean | Promise<boolean>;
  renderGlobalHelp?: (event: GlobalHelpEvent) => string;
  writeDebug?: () => void;
  defaultErrorCode?: string;
  normalizeError?: ErrorNormalizer;
}

const usageViolations = new Set([
  "missing_args_error",
  "unrecognized_args_error",
  "unknown_command_error",
  "unknown_subcommand_error",
  "above_max",
  "below_min",
  "expected_int",
  "invalid_boolean_syntax",
  "invalid_string_syntax",
  "invalid_number_syntax",
  "invalid_number_value",
  "enum_violation",
]);

export async function runCliWithBrocli(
  options: RunCliOptions,
): Promise<number> {
  let exitCode = 0;
  const argv = options.transformArgv?.(options.argv) ?? options.argv;
  const print = (error: unknown) =>
    printCliError(error, {
      json: isJsonOutputRequested(argv),
      pretty: getPretty(),
      compact: getCompact(),
      defaultCode: options.defaultErrorCode,
      normalize: options.normalizeError,
    });
  try {
    // Sesame change: Brocli shows global help for an unknown leading flag
    // (`sesame -V`). Reject it as a usage error instead.
    const leadingError = leadingFlagError(argv, options);
    if (leadingError) return print(leadingError);
    const earlyArgv = earlyDispatchArgv(argv, options);
    if (earlyArgv) {
      const error = earlyGlobalOptionError(earlyArgv);
      if (error) return print(error);
    }
    if (options.handleHelp?.(argv)) return 0;
    if (await options.handleCompletion?.(argv)) return 0;
    const config = {
      name: options.name,
      description: options.description,
      version: options.version,
      globals: options.globals,
      argSource: argv,
      omitKeysOfUndefinedOptions: true,
      hook: (event: string, _command: unknown, globals: unknown) => {
        if (event === "before") {
          setGlobalOptions(
            (globals as (OutputOptions & DebugOptions) | undefined) ?? {},
          );
          getOutputMode();
          options.writeDebug?.();
        }
      },
      theme: (event: { type: string; violation?: string; error?: unknown }) => {
        if (event.type === "global_help" && options.renderGlobalHelp) {
          process.stdout.write(
            `${options.renderGlobalHelp(event as GlobalHelpEvent)}\n`,
          );
          return true;
        }
        if (event.type !== "error") return false;
        if (event.violation === "unknown_error") {
          exitCode = print(event.error);
          return true;
        }
        // Sesame change: print usage errors as `CODE: message` in human
        // mode too, so both modes share one error format.
        if (usageViolations.has(event.violation ?? "")) {
          exitCode = print(usageErrorMessage(event, options.name));
          return true;
        }
        exitCode = 1;
        return false;
      },
    };
    await run(options.commands as never, { ...config, noExit: true } as never);
    return Math.max(exitCode, getCommandExitCode());
  } finally {
    setGlobalOptions(undefined);
    resetCommandExitCode();
  }
}

function earlyDispatchArgv(
  argv: string[],
  options: Pick<
    RunCliOptions,
    | "valueOptions"
    | "valueOptionPrefixes"
    | "booleanOptions"
    | "booleanValueOptions"
    | "skipUnknownFlags"
  >,
): string[] | undefined {
  const index = rootCommandIndex(argv, {
    valueOptions: options.valueOptions,
    valueOptionPrefixes: options.valueOptionPrefixes,
    booleanOptions: options.booleanOptions ?? CLI_KIT_BOOLEAN_OPTIONS,
    booleanValueOptions:
      options.booleanValueOptions ?? CLI_KIT_BOOLEAN_VALUE_OPTIONS,
    skipUnknownFlags: options.skipUnknownFlags,
  });
  if (index === undefined) return undefined;
  const command = argv[index];
  if (command === "help") return argv;
  if (command !== "complete" && command !== "completion") return undefined;
  return argv[index + 1] === "--" ? argv.slice(0, index + 2) : argv;
}

function leadingFlagError(
  argv: string[],
  options: Pick<
    RunCliOptions,
    "valueOptions" | "valueOptionPrefixes" | "booleanOptions"
  >,
): CliError | undefined {
  const first = argv[2];
  if (!first?.startsWith("-") || first === "--") return undefined;
  const name = first.split("=")[0];
  const known = [
    ...(options.booleanOptions ?? CLI_KIT_BOOLEAN_OPTIONS),
    ...(options.valueOptions ?? []),
  ];
  if (known.includes(name)) return undefined;
  const prefixes = options.valueOptionPrefixes ?? [];
  if (prefixes.some((prefix) => first.startsWith(prefix))) return undefined;
  return usageError(`unrecognized input: ${first}`, "INVALID_INPUT");
}

function earlyGlobalOptionError(
  argv: string[],
): ReturnType<typeof usageError> | undefined {
  for (let index = 2; index < argv.length; index++) {
    const arg = argv[index];
    if (arg.startsWith("--output=") || arg.startsWith("-o=")) {
      const value = arg.startsWith("--output=")
        ? arg.slice("--output=".length)
        : arg.slice("-o=".length);
      const error = invalidOutputError(value);
      if (error) return error;
      continue;
    }
    if (arg === "--output" || arg === "-o") {
      const value = argv[++index];
      if (value === undefined) {
        return usageError(`missing value for ${arg}`, "MISSING_INPUT");
      }
      const error = invalidOutputError(value);
      if (error) return error;
    }
  }
  return undefined;
}

function invalidOutputError(
  value: string,
): ReturnType<typeof usageError> | undefined {
  try {
    outputMode({ output: value });
  } catch (error) {
    return error as ReturnType<typeof usageError>;
  }
  return undefined;
}

function commandName(
  command: { name?: string } | "globals" | undefined,
): string | undefined {
  return command && command !== "globals"
    ? (command.name ?? "command")
    : undefined;
}

function usageErrorMessage(
  event: {
    violation?: string;
    offender?: string | { namePart?: string; dataPart?: string };
    command?: { name?: string } | "globals";
    missing?: [string[], ...string[][]];
    unrecognized?: [string, ...string[]];
    option?: {
      name?: string;
      minVal?: number;
      maxVal?: number;
      enumVals?: string[];
    };
  },
  cliName: string,
): ReturnType<typeof usageError> {
  switch (event.violation) {
    case "unknown_command_error":
      return usageError(
        typeof event.offender === "string"
          ? `unknown command: ${event.offender}`
          : "unknown command",
        "UNKNOWN_COMMAND",
      );
    case "unknown_subcommand_error":
      return usageError(
        typeof event.offender === "string"
          ? `unknown subcommand: ${event.offender}`
          : "unknown subcommand",
        "UNKNOWN_SUBCOMMAND",
      );
    case "missing_args_error": {
      const command = commandName(event.command);
      const missing = event.missing?.map((opt) => {
        const [name, ...aliases] = opt;
        return aliases.length ? `${name} [${aliases.join(", ")}]` : name;
      });
      if (!command || !missing?.length) {
        return usageError("missing required input", "MISSING_INPUT");
      }
      return usageError(
        `command '${command}' is missing required input: ${missing.join(", ")} (try '${cliName} ${command} --help')`,
        "MISSING_INPUT",
      );
    }
    case "unrecognized_args_error": {
      const command = commandName(event.command);
      if (!command || !event.unrecognized?.length) {
        return usageError(
          "invalid command option or argument",
          "INVALID_INPUT",
        );
      }
      // Sesame change: a stray positional usually means an unquoted phrase.
      const quoteHint = event.unrecognized.some((arg) => !arg.startsWith("-"))
        ? "; quote arguments that contain spaces"
        : "";
      return usageError(
        `unrecognized input for '${command}': ${event.unrecognized.join(", ")} (try '${cliName} ${command} --help'${quoteHint})`,
        "INVALID_INPUT",
      );
    }
    case "enum_violation": {
      const name = validationName(event);
      const allowed = event.option?.enumVals?.join(", ");
      return usageError(
        name
          ? `invalid value for ${name}${allowed ? `: expected one of ${allowed}` : ""}`
          : "invalid input",
        "INVALID_INPUT",
      );
    }
    case "below_min": {
      const name = validationName(event);
      return usageError(
        name
          ? `${name} must be at least ${event.option?.minVal}`
          : "invalid input",
        "INVALID_INPUT",
      );
    }
    case "above_max": {
      const name = validationName(event);
      return usageError(
        name
          ? `${name} must be at most ${event.option?.maxVal}`
          : "invalid input",
        "INVALID_INPUT",
      );
    }
    case "expected_int": {
      const name = validationName(event);
      return usageError(
        name ? `${name} must be an integer` : "invalid input",
        "INVALID_INPUT",
      );
    }
    case "invalid_number_syntax":
    case "invalid_number_value": {
      const name = validationName(event);
      return usageError(
        name ? `${name} must be a number` : "invalid input",
        "INVALID_INPUT",
      );
    }
    case "invalid_boolean_syntax":
    case "invalid_string_syntax":
      return usageError("invalid input", "INVALID_INPUT");
    default:
      return usageError("invalid command usage", "INVALID_USAGE");
  }
}

function validationName(event: {
  option?: { name?: string };
  offender?: string | { namePart?: string };
}): string | undefined {
  if (typeof event.offender === "object" && event.offender?.namePart) {
    return event.offender.namePart;
  }
  return event.option?.name;
}

export function isJsonOutputRequested(argv: string[]): boolean {
  for (let index = 2; index < argv.length; index++) {
    const arg = argv[index];
    if (
      arg === "--json" ||
      arg === "-j" ||
      arg === "--json=true" ||
      arg === "-j=true"
    ) {
      return true;
    }
    if (arg === "--output=json" || arg === "-o=json") return true;
    if ((arg === "--output" || arg === "-o") && argv[index + 1] === "json") {
      return true;
    }
  }
  return false;
}
