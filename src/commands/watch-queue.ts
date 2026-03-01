import { expandPath } from "../utils/config";

export type SourceConfig = {
  path: string;
  parser: string;
};

type RunBatch = (sources: SourceConfig[]) => Promise<void>;
type IsShuttingDown = () => boolean;
type Log = (message: string, ...args: unknown[]) => void;

export interface ReindexQueue {
  enqueue: (sources: SourceConfig[], reason: string) => void;
  waitForIdle: () => Promise<void>;
}

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
        pendingSources.set(expandPath(source.path), source);
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
