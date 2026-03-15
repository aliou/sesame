import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { acquireIndexLock } from "./index-lock";

describe("acquireIndexLock", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "sesame-index-lock-"));
    dirs.push(dir);
    return dir;
  }

  test("creates lock file and releases it", () => {
    const dir = createTempDir();

    const lock = acquireIndexLock(dir, "watch");

    const lockFile = JSON.parse(readFileSync(lock.path, "utf8")) as {
      pid?: number;
      holder?: string;
      startedAt?: string;
    };
    expect(lockFile.pid).toBe(process.pid);
    expect(lockFile.holder).toBe("watch");
    expect(lockFile.startedAt).toBeTypeOf("string");

    lock.release();

    expect(() => readFileSync(lock.path, "utf8")).toThrow();
  });

  test("fails when another live holder owns the lock", () => {
    const dir = createTempDir();
    const lockPath = join(dir, "index.lock");

    writeFileSync(
      lockPath,
      JSON.stringify({
        pid: process.pid,
        holder: "watch",
        startedAt: "2026-03-01T00:00:00.000Z",
      }),
      "utf8",
    );

    expect(() => acquireIndexLock(dir, "index")).toThrow(
      "Index already running",
    );
  });

  test("removes stale lock when recorded pid is dead", () => {
    const dir = createTempDir();
    const lockPath = join(dir, "index.lock");

    writeFileSync(
      lockPath,
      JSON.stringify({
        pid: 999999,
        holder: "watch",
        startedAt: "2026-03-01T00:00:00.000Z",
      }),
      "utf8",
    );

    const lock = acquireIndexLock(dir, "index");
    const lockFile = JSON.parse(readFileSync(lock.path, "utf8")) as {
      pid?: number;
      holder?: string;
    };

    expect(lockFile.pid).toBe(process.pid);
    expect(lockFile.holder).toBe("index");

    lock.release();
  });
});
