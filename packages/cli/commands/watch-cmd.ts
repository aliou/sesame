/**
 * sesame watch - index once, then re-index on file changes or on a timer.
 *
 * stdout carries one event per indexed source: a human line by default, or
 * one compact JSON object per line with --output json. Logs go to stderr.
 */

import { type FSWatcher, watch } from "node:fs";
import { join } from "node:path";
import {
  type Database,
  expandPath,
  type IndexLockHandle,
  type IndexResult,
  indexFile,
  indexSessions,
  setMetadata,
} from "@aliou/sesame";
import { command, number } from "@drizzle-team/brocli";
import { loadSesameConfig, lockIndex, openIndex } from "../context";
import { isJson } from "../kit/output";
import { sumResults } from "./index-cmd";
import {
  createReindexQueue,
  type ReindexQueue,
  type SourceConfig,
} from "./watch-queue";

const DEBOUNCE_MS = 500;

interface WatchState {
  db: Database;
  indexLock: IndexLockHandle;
  watchers: FSWatcher[];
  debounceTimers: Map<string, NodeJS.Timeout>;
  intervalId?: NodeJS.Timeout;
  isShuttingDown: boolean;
}

type WatchEvent =
  | ({ timestamp: string; path: string } & IndexResult)
  | { timestamp: string; path: string; error: string };

export const watchCommand = command({
  name: "watch",
  desc: "Index, then keep the index updated as session files change",
  options: {
    interval: number("interval")
      .int()
      .min(1)
      .desc("Re-index every N seconds instead of watching the file system"),
  },
  handler: async (flags: { interval?: number }) => runWatch(flags.interval),
});

function log(message: string, ...args: unknown[]): void {
  console.error(`[%s] ${message}`, new Date().toISOString(), ...args);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function formatWatchEvent(event: WatchEvent, json: boolean): string {
  if (json) return JSON.stringify(event);
  if ("error" in event) {
    return `${event.timestamp} ${event.path} error: ${event.error}`;
  }
  return `${event.timestamp} ${event.path} added=${event.added} updated=${event.updated} skipped=${event.skipped} errors=${event.errors}`;
}

/** Emit an event on stdout. Human-mode errors are already logged to stderr. */
function emit(event: WatchEvent): void {
  const json = isJson();
  if (!json && "error" in event) return;
  process.stdout.write(`${formatWatchEvent(event, json)}\n`);
}

async function runWatch(intervalSeconds: number | undefined): Promise<void> {
  const config = await loadSesameConfig();
  const indexLock = lockIndex("watch");
  let db: Database;
  try {
    db = openIndex();
  } catch (error) {
    indexLock.release();
    throw error;
  }

  const state: WatchState = {
    db,
    indexLock,
    watchers: [],
    debounceTimers: new Map(),
    isShuttingDown: false,
  };
  const queue = createReindexQueue(
    (sources) => runIndexing(state, sources).catch((error) => fail(error)),
    () => state.isShuttingDown,
    console.error,
  );
  const sources = config.piSessionPaths.map((path) => ({ path }));

  const shutdown = () => {
    if (!stop(state)) return;
    log("Shutdown complete");
    process.exit(0);
  };
  // A queued re-index runs outside this function's try block. Release the
  // lock and database before exiting so a supervisor can restart cleanly.
  const fail = (error: unknown) => {
    log("Fatal error: %s", errorMessage(error));
    stop(state);
    process.exit(1);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    log("Starting watch mode...");
    log("Running initial index...");
    await runIndexing(state, sources);
    if (intervalSeconds) startPolling(state, queue, sources, intervalSeconds);
    else startWatching(state, queue, sources);
    log("Watch mode active. Press Ctrl+C to stop.");
  } catch (error) {
    stop(state);
    throw error;
  }

  // Keep the process alive until a signal arrives.
  await new Promise(() => {});
}

/** Release every resource. Returns false when already stopped. */
function stop(state: WatchState): boolean {
  if (state.isShuttingDown) return false;
  state.isShuttingDown = true;
  log("Shutting down...");
  for (const timer of state.debounceTimers.values()) clearTimeout(timer);
  state.debounceTimers.clear();
  for (const watcher of state.watchers) watcher.close();
  state.watchers = [];
  if (state.intervalId) clearInterval(state.intervalId);
  state.db.close();
  state.indexLock.release();
  return true;
}

function startPolling(
  state: WatchState,
  queue: ReindexQueue,
  sources: SourceConfig[],
  intervalSeconds: number,
): void {
  log("Starting poll-based monitoring (interval: %d seconds)", intervalSeconds);
  state.intervalId = setInterval(() => {
    if (!state.isShuttingDown) queue.enqueue(sources, "scheduled");
  }, intervalSeconds * 1000);
}

function startWatching(
  state: WatchState,
  queue: ReindexQueue,
  sources: SourceConfig[],
): void {
  log("Starting file system monitoring...");
  for (const source of sources) {
    const root = expandPath(source.path);
    try {
      const watcher = watch(root, { recursive: true }, (eventType, filename) =>
        onFileEvent(state, queue, source, eventType, filename),
      );
      watcher.on("error", (error) =>
        log("Watcher error for %s: %s", root, error.message),
      );
      state.watchers.push(watcher);
      log("Watching: %s", root);
    } catch (error) {
      log("Failed to watch %s: %s", root, errorMessage(error));
    }
  }
}

function onFileEvent(
  state: WatchState,
  queue: ReindexQueue,
  source: SourceConfig,
  eventType: string,
  filename: string | null,
): void {
  if (state.isShuttingDown) return;
  log("Detected %s: %s", eventType, filename || "unknown");
  const root = expandPath(source.path);

  // No filename: fall back to a full scan of the source.
  if (!filename) {
    debounce(state, root, () => queue.enqueue([source], `fs:${eventType}`));
    return;
  }
  // Only session files matter; ignore everything else.
  if (!filename.endsWith(".jsonl")) return;

  const file = join(root, filename);
  debounce(state, file, () =>
    queue.enqueue(
      [{ path: source.path, files: [file] }],
      `fs:${eventType}:${filename}`,
    ),
  );
}

function debounce(state: WatchState, key: string, run: () => void): void {
  clearTimeout(state.debounceTimers.get(key));
  const timer = setTimeout(() => {
    state.debounceTimers.delete(key);
    if (!state.isShuttingDown) run();
  }, DEBOUNCE_MS);
  state.debounceTimers.set(key, timer);
}

async function runIndexing(
  state: WatchState,
  sources: SourceConfig[],
): Promise<void> {
  const timestamp = new Date().toISOString();
  const results: IndexResult[] = [];

  for (const source of sources) {
    const targets = source.files?.length
      ? source.files.map((file) => ({ path: file, index: indexFile }))
      : [{ path: expandPath(source.path), index: indexSessions }];
    for (const target of targets) {
      const result = await indexTarget(state.db, timestamp, target);
      results.push(result);
    }
  }

  const totals = sumResults(results);
  if (totals.errors === 0 && totals.added + totals.updated > 0) {
    setMetadata(state.db, "last_sync_at", new Date().toISOString());
  }
}

async function indexTarget(
  db: Database,
  timestamp: string,
  target: {
    path: string;
    index: (db: Database, path: string) => Promise<IndexResult>;
  },
): Promise<IndexResult> {
  try {
    const result = await target.index(db, target.path);
    emit({ timestamp, path: target.path, ...result });
    return result;
  } catch (error) {
    log("Error indexing %s: %s", target.path, errorMessage(error));
    emit({ timestamp, path: target.path, error: errorMessage(error) });
    return { added: 0, updated: 0, skipped: 0, errors: 1 };
  }
}
