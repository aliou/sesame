import { describe, expect, test, vi } from "vitest";
import { createReindexQueue, type SourceConfig } from "./watch-queue";

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = () => {};
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("createReindexQueue", () => {
  test("serializes runs and coalesces queued sources", async () => {
    const batches: SourceConfig[][] = [];
    const first = deferred();
    let runCount = 0;

    const queue = createReindexQueue(
      async (sources) => {
        runCount += 1;
        batches.push(sources);
        if (runCount === 1) {
          await first.promise;
        }
      },
      () => false,
      vi.fn(),
    );

    queue.enqueue([{ path: "/tmp/a" }], "initial");
    await Promise.resolve();

    queue.enqueue([{ path: "/tmp/a" }], "dup");
    queue.enqueue([{ path: "/tmp/b" }], "new");

    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual([{ path: "/tmp/a" }]);

    first.resolve();
    await queue.waitForIdle();

    expect(batches).toHaveLength(2);
    expect(batches[1]).toHaveLength(2);
    expect(batches[1].map((s) => s.path).sort()).toEqual(["/tmp/a", "/tmp/b"]);
  });

  test("never runs concurrent batches", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const queue = createReindexQueue(
      async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      },
      () => false,
      vi.fn(),
    );

    queue.enqueue([{ path: "/tmp/a" }], "1");
    queue.enqueue([{ path: "/tmp/b" }], "2");
    queue.enqueue([{ path: "/tmp/c" }], "3");

    await queue.waitForIdle();

    expect(maxInFlight).toBe(1);
  });

  test("does not start new work when shutting down", async () => {
    let shuttingDown = false;
    const runBatch = vi.fn(async () => {
      shuttingDown = true;
    });

    const queue = createReindexQueue(runBatch, () => shuttingDown, vi.fn());

    queue.enqueue([{ path: "/tmp/a" }], "first");
    queue.enqueue([{ path: "/tmp/b" }], "second");

    await queue.waitForIdle();

    expect(runBatch).toHaveBeenCalledTimes(1);
  });
});
