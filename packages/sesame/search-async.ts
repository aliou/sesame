import { join } from "node:path";
import { Worker } from "node:worker_threads";
import type { SearchOptions, SearchResult } from "./storage/db";
import { getXDGPaths } from "./utils/xdg";

type SearchRow = SearchResult & { messageCount: number };
export interface IndexedSessionRow {
  id: string;
  path: string;
  cwd: string | null;
  name: string | null;
  created_at: string | null;
  modified_at: string | null;
  message_count: number;
}

export interface SessionReferenceRow {
  id: string;
  cwd: string | null;
  name: string | null;
  created_at: string | null;
  modified_at: string | null;
}

type SearchRequest =
  | { operation: "search"; query?: string; options?: SearchOptions }
  | { operation: "list"; cwd: string; limit: number; depth: number }
  | { operation: "get"; sessionId: string }
  | { operation: "names"; token: string; cwd?: string };

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  cleanup?: () => void;
};

/** Owns one SQLite connection on a worker, keeping synchronous queries off the caller's event loop. */
export class AsyncSessionSearch {
  private worker: Worker;
  private nextId = 0;
  private pending = new Map<number, Pending>();
  private closed = false;

  constructor(dataDir = getXDGPaths().data) {
    const dbPath = join(dataDir, "index.sqlite");
    // Resolve the package subpath at runtime, even when this class is bundled
    // into an embedding app whose import.meta.url points outside Sesame.
    this.worker = new Worker(
      new URL(import.meta.resolve("@aliou/sesame/worker")),
      { workerData: { dbPath } },
    );
    this.worker.on("message", ({ id, result, error }) => {
      const request = this.pending.get(id);
      if (!request) return;
      this.pending.delete(id);
      request.cleanup?.();
      if (error) request.reject(new Error(error));
      else request.resolve(result);
    });
    this.worker.on("error", (error) =>
      this.fail(error instanceof Error ? error : new Error(String(error))),
    );
    this.worker.on("exit", (code) => {
      if (!this.closed) this.fail(new Error(`Search worker exited (${code})`));
    });
  }

  private fail(error: Error): void {
    this.closed = true;
    for (const request of this.pending.values()) {
      request.cleanup?.();
      request.reject(error);
    }
    this.pending.clear();
  }

  private request<T>(message: SearchRequest, signal?: AbortSignal): Promise<T> {
    if (this.closed)
      return Promise.reject(new Error("Search worker is closed"));
    if (signal?.aborted) return Promise.reject(signal.reason);
    const id = ++this.nextId;
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => {
        this.pending.delete(id);
        reject(signal?.reason ?? new Error("Search aborted"));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        cleanup: () => signal?.removeEventListener("abort", onAbort),
      });
      this.worker.postMessage({ id, ...message });
    });
  }

  search(
    query?: string,
    options?: SearchOptions,
    signal?: AbortSignal,
  ): Promise<SearchRow[]> {
    return this.request({ operation: "search", query, options }, signal);
  }

  list(
    cwd: string,
    limit = 20,
    depth = 0,
    signal?: AbortSignal,
  ): Promise<IndexedSessionRow[]> {
    return this.request({ operation: "list", cwd, limit, depth }, signal);
  }

  get(sessionId: string): Promise<SessionReferenceRow | null> {
    return this.request({ operation: "get", sessionId });
  }

  searchNames(token: string, cwd?: string): Promise<IndexedSessionRow[]> {
    return this.request({ operation: "names", token, cwd });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.fail(new Error("Search worker closed"));
    await this.worker.terminate();
  }
}
