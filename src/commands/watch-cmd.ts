/**
 * Watch command - monitors and indexes session files on change
 */

import { type FSWatcher, mkdirSync, watch } from "node:fs";
import { join } from "node:path";
import { indexSessions } from "../indexer/index";
import { PiParser } from "../parsers/pi";
import { type Database, openDatabase } from "../storage/db";
import { expandPath, loadConfig } from "../utils/config";
import { getXDGPaths } from "../utils/xdg";

interface WatchState {
  db: Database;
  watchers: FSWatcher[];
  debounceTimers: Map<string, NodeJS.Timeout>;
  intervalId?: NodeJS.Timeout;
  isShuttingDown: boolean;
}

export default async function watchCommand(args: string[]): Promise<void> {
  // Parse --interval flag
  let pollInterval: number | null = null;
  const intervalIndex = args.indexOf("--interval");
  if (intervalIndex !== -1 && args[intervalIndex + 1]) {
    const intervalValue = parseInt(args[intervalIndex + 1], 10);
    if (Number.isNaN(intervalValue) || intervalValue <= 0) {
      console.error("Error: --interval must be a positive number");
      process.exit(1);
    }
    pollInterval = intervalValue * 1000; // Convert to milliseconds
  }

  // Load configuration
  const config = await loadConfig();

  // Get data directory and ensure it exists
  const paths = getXDGPaths();
  mkdirSync(paths.data, { recursive: true });

  // Open database
  const dbPath = join(paths.data, "index.sqlite");
  const db = openDatabase(dbPath);

  const state: WatchState = {
    db,
    watchers: [],
    debounceTimers: new Map(),
    isShuttingDown: false,
  };

  // Set up graceful shutdown
  const shutdown = () => {
    if (state.isShuttingDown) {
      return;
    }
    state.isShuttingDown = true;

    console.error("\n[%s] Shutting down...", new Date().toISOString());

    // Clear all debounce timers
    for (const timer of state.debounceTimers.values()) {
      clearTimeout(timer);
    }
    state.debounceTimers.clear();

    // Close all watchers
    for (const watcher of state.watchers) {
      watcher.close();
    }
    state.watchers = [];

    // Clear interval if polling
    if (state.intervalId) {
      clearInterval(state.intervalId);
    }

    // Close database
    state.db.close();

    console.error("[%s] Shutdown complete", new Date().toISOString());
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    console.error("[%s] Starting watch mode...", new Date().toISOString());

    // Run initial index pass
    console.error("[%s] Running initial index...", new Date().toISOString());
    await runIndexing(state, config.sources);

    if (pollInterval) {
      // Polling mode
      console.error(
        "[%s] Starting poll-based monitoring (interval: %d seconds)",
        new Date().toISOString(),
        pollInterval / 1000,
      );

      state.intervalId = setInterval(async () => {
        if (!state.isShuttingDown) {
          console.error(
            "[%s] Running scheduled index...",
            new Date().toISOString(),
          );
          await runIndexing(state, config.sources);
        }
      }, pollInterval);
    } else {
      // File system watch mode
      console.error(
        "[%s] Starting file system monitoring...",
        new Date().toISOString(),
      );

      for (const source of config.sources) {
        const expandedPath = expandPath(source.path);

        if (source.parser !== "pi") {
          console.error(
            "[%s] Skipping watch for %s: unsupported parser '%s'",
            new Date().toISOString(),
            source.path,
            source.parser,
          );
          continue;
        }

        try {
          const watcher = watch(
            expandedPath,
            { recursive: true },
            (eventType, filename) => {
              if (state.isShuttingDown) {
                return;
              }

              const timestamp = new Date().toISOString();
              console.error(
                "[%s] Detected %s: %s",
                timestamp,
                eventType,
                filename || "unknown",
              );

              // Debounce: clear existing timer and set new one
              const existingTimer = state.debounceTimers.get(expandedPath);
              if (existingTimer) {
                clearTimeout(existingTimer);
              }

              const timer = setTimeout(async () => {
                state.debounceTimers.delete(expandedPath);
                if (!state.isShuttingDown) {
                  console.error(
                    "[%s] Re-indexing %s...",
                    new Date().toISOString(),
                    expandedPath,
                  );
                  await runIndexing(state, [source]);
                }
              }, 500);

              state.debounceTimers.set(expandedPath, timer);
            },
          );

          watcher.on("error", (error) => {
            console.error(
              "[%s] Watcher error for %s: %s",
              new Date().toISOString(),
              expandedPath,
              error.message,
            );
          });

          state.watchers.push(watcher);
          console.error(
            "[%s] Watching: %s",
            new Date().toISOString(),
            expandedPath,
          );
        } catch (error) {
          console.error(
            "[%s] Failed to watch %s: %s",
            new Date().toISOString(),
            expandedPath,
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    }

    console.error(
      "[%s] Watch mode active. Press Ctrl+C to stop.",
      new Date().toISOString(),
    );

    // Keep the process alive
    await new Promise(() => {});
  } catch (error) {
    console.error(
      "[%s] Fatal error: %s",
      new Date().toISOString(),
      error instanceof Error ? error.message : String(error),
    );
    shutdown();
    process.exit(1);
  }
}

async function runIndexing(
  state: WatchState,
  sources: Array<{ path: string; parser: string }>,
): Promise<void> {
  const timestamp = new Date().toISOString();

  for (const source of sources) {
    const expandedPath = expandPath(source.path);

    if (source.parser !== "pi") {
      continue;
    }

    const parser = new PiParser();

    try {
      const result = await indexSessions(state.db, expandedPath, parser);

      // Log to stderr (human-readable)
      console.error(
        "[%s] Indexed %s - added: %d, updated: %d, skipped: %d, errors: %d",
        timestamp,
        expandedPath,
        result.added,
        result.updated,
        result.skipped,
        result.errors,
      );

      // Log to stdout (JSON for machine consumption)
      console.log(
        JSON.stringify({
          timestamp,
          path: expandedPath,
          added: result.added,
          updated: result.updated,
          skipped: result.skipped,
          errors: result.errors,
        }),
      );
    } catch (error) {
      console.error(
        "[%s] Error indexing %s: %s",
        timestamp,
        expandedPath,
        error instanceof Error ? error.message : String(error),
      );

      // Log error to stdout as JSON
      console.log(
        JSON.stringify({
          timestamp,
          path: expandedPath,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
