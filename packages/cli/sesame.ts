#!/usr/bin/env node
/**
 * Sesame CLI entry point.
 */

import { getCompact, getOutputMode, getPretty } from "./kit/context";
import { printCliError } from "./kit/errors";
import { DEFAULT_ERROR_CODE, runCli } from "./run";

async function main(): Promise<void> {
  process.exitCode = await runCli(process.argv);
}

void main().catch((error: unknown) => {
  const code = printCliError(error, {
    json: getOutputMode() === "json",
    pretty: getPretty(),
    compact: getCompact(),
    defaultCode: DEFAULT_ERROR_CODE,
  });
  process.exit(code);
});
