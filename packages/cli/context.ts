/**
 * Global options and shared access to Sesame's local state: paths, config,
 * database, and the index lock. Commands go through these helpers so errors
 * carry stable codes.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  acquireIndexLock,
  type Database,
  getXDGPaths,
  type IndexLockHandle,
  loadConfig,
  openDatabase,
  parseRelativeDate,
  type SesameConfig,
} from "@aliou/sesame";
import { boolean } from "@drizzle-team/brocli";
import { getDebug, OUTPUT_OPTIONS } from "./kit/context";
import { CliError, usageError } from "./kit/errors";

export const globalOptions = {
  ...OUTPUT_OPTIONS,
  json: boolean("json").alias("j").hidden().desc("Alias for --output json"),
  quiet: boolean("quiet").alias("q").desc("Suppress progress messages"),
  noColor: boolean("no-color").desc("Disable ANSI color (also NO_COLOR)"),
  debug: boolean("debug").desc("Print resolved paths to stderr"),
};

export interface SesamePaths {
  dataDir: string;
  configPath: string;
  databasePath: string;
}

export function sesamePaths(): SesamePaths {
  const paths = getXDGPaths();
  return {
    dataDir: paths.data,
    configPath: join(paths.config, "config.jsonc"),
    databasePath: join(paths.data, "index.sqlite"),
  };
}

/** Load config.jsonc, creating it with defaults when missing. */
export async function loadSesameConfig(): Promise<SesameConfig> {
  try {
    return await loadConfig();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new CliError(
      `cannot read ${sesamePaths().configPath}: ${reason}`,
      "CONFIG_ERROR",
    );
  }
}

/** Open the index database, creating the data directory when needed. */
export function openIndex(): Database {
  const paths = sesamePaths();
  mkdirSync(paths.dataDir, { recursive: true });
  return openDatabase(paths.databasePath);
}

/** Take the index lock so index and watch never write at the same time. */
export function lockIndex(holder: "index" | "watch"): IndexLockHandle {
  const paths = sesamePaths();
  mkdirSync(paths.dataDir, { recursive: true });
  try {
    return acquireIndexLock(paths.dataDir, holder);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new CliError(reason, "INDEX_LOCKED");
  }
}

/** Parse a --after/--before value (7d, 2w, 1m, or YYYY-MM-DD). */
export function parseDateFlag(
  flag: string,
  value: string | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  try {
    return parseRelativeDate(value);
  } catch {
    throw usageError(
      `invalid value for ${flag}: "${value}" (use 7d, 2w, 1m, or YYYY-MM-DD)`,
      "INVALID_DATE",
    );
  }
}

/** Write safe diagnostics to stderr when --debug is set. */
export function writeDebug(): void {
  if (!getDebug()) return;
  const paths = sesamePaths();
  process.stderr.write(
    `debug: data=${paths.dataDir} db=${paths.databasePath} config=${paths.configPath}\n`,
  );
}
