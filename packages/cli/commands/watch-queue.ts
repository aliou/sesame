import { expandPath } from "@aliou/sesame";

export type SourceConfig = {
  path: string;
  /** If set, only these specific files are indexed instead of scanning `path`. */
  files?: string[];
};

type RunBatch = (sources: SourceConfig[]) => Promise<void>;
type IsShuttingDown = () => boolean;
type Log = (message: string, ...args: unknown[]) => void;

export interface ReindexQueue {
  enqueue: (sources: SourceConfig[], reason: string) => void;
  waitForIdle: () => Promise<void>;
}

/**
 * Minimum time between consecutive indexing runs for the same source.
 * When Pi writes to the current session every few seconds, this prevents
 * back-to-back full re-indexes.
 */
const COOLDOWN_MS = 2000;

export function createReindexQueue(
  runBatch: RunBatch,
  isShuttingDown: IsShuttingDown,
  log: Log,
): ReindexQueue {
  let isIndexing = false;
  const pendingSources = new Map<string, SourceConfig>();
  const idleResolvers = new Set<() => void>();

  function resolveIdleIfIdle(): void {
    if (!isShuttingDown() && (isIndexing || pendingSources.size > 0)) {
      return;
    }

    for (const resolve of idleResolvers) {
      resolve();
    }
    idleResolvers.clear();
  }

  /**
   * Merge an incoming SourceConfig into the pending map.
   *
   * - If the incoming entry is a full scan (no `files`), it replaces any
   *   existing targeted entry (full scan is a superset).
   * - If the existing entry is a full scan, keep it (covers everything).
   * - If both have `files`, merge the file lists (deduped).
   */
  function mergeSource(key: string, incoming: SourceConfig): void {
    const existing = pendingSources.get(key);
    if (!existing) {
      pendingSources.set(key, incoming);
      return;
    }

    // Incoming full scan replaces everything
    if (!incoming.files) {
      pendingSources.set(key, incoming);
      return;
    }

    // Existing is a full scan — keep it, it covers incoming files
    if (!existing.files) {
      return;
    }

    // Both targeted: merge file lists
    const merged = new Set([...existing.files, ...incoming.files]);
    existing.files = Array.from(merged);
  }

  async function drain(): Promise<void> {
    if (isIndexing || isShuttingDown()) {
      resolveIdleIfIdle();
      return;
    }

    isIndexing = true;
    try {
      while (!isShuttingDown()) {
        const sources = Array.from(pendingSources.values());
        pendingSources.clear();

        if (sources.length === 0) {
          break;
        }

        log(
          "[%s] Re-indexing %d source(s)...",
          new Date().toISOString(),
          sources.length,
        );
        await runBatch(sources);

        // Cooldown: if more work arrived during indexing, wait before
        // processing it. This prevents back-to-back full re-indexes when
        // Pi keeps appending to the current session.
        // The sleep is checked every 200ms so shutdown is not delayed by
        // the full COOLDOWN_MS.
        if (!isShuttingDown() && pendingSources.size > 0) {
          const sleepStep = 200;
          let remaining = COOLDOWN_MS;
          while (remaining > 0 && !isShuttingDown()) {
            const wait = Math.min(sleepStep, remaining);
            await new Promise<void>((resolve) => setTimeout(resolve, wait));
            remaining -= wait;
          }
        }
      }
    } finally {
      isIndexing = false;
      if (!isShuttingDown() && pendingSources.size > 0) {
        void drain();
      } else {
        resolveIdleIfIdle();
      }
    }
  }

  return {
    enqueue: (sources: SourceConfig[], reason: string) => {
      for (const source of sources) {
        const key = expandPath(source.path);
        mergeSource(key, source);
      }

      if (isShuttingDown()) {
        pendingSources.clear();
        resolveIdleIfIdle();
        return;
      }

      if (isIndexing) {
        log(
          "[%s] Indexing in progress; queued %d source(s) (%s)",
          new Date().toISOString(),
          pendingSources.size,
          reason,
        );
        return;
      }

      void drain();
    },
    waitForIdle: () => {
      if (isShuttingDown() || (!isIndexing && pendingSources.size === 0)) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        idleResolvers.add(resolve);
      });
    },
  };
}
