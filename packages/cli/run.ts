import { normalizeArgv, VALUE_OPTION_PREFIXES, VALUE_OPTIONS } from "./argv";
import { commands } from "./commands/index";
import { handleCompletion } from "./completion";
import { globalOptions, writeDebug } from "./context";
import { renderGlobalHelp } from "./help";
import { handleHelp } from "./help-topics";
import { runCliWithBrocli } from "./kit/run";
import { VERSION } from "./version";

export const DEFAULT_ERROR_CODE = "SESAME_ERROR";

/**
 * Run the CLI in-process and return the exit code.
 *
 * Separate from the entry point so tests can drive the full Brocli pipeline
 * without process.exit. Global option state is module-level, so in-process
 * CLI tests must run sequentially.
 */
export async function runCli(argv: string[]): Promise<number> {
  return runCliWithBrocli({
    name: "sesame",
    description: "Sesame - search past coding agent sessions",
    version: VERSION,
    commands,
    globals: globalOptions,
    argv,
    valueOptions: VALUE_OPTIONS,
    valueOptionPrefixes: VALUE_OPTION_PREFIXES,
    transformArgv: normalizeArgv,
    handleHelp,
    handleCompletion,
    renderGlobalHelp,
    writeDebug,
    defaultErrorCode: DEFAULT_ERROR_CODE,
  });
}
