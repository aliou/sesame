import { fs, vol } from "memfs";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { acquireIndexLock } from "./index-lock";

vi.mock("node:fs");

describe("acquireIndexLock", () => {
  beforeEach(() => {
    vol.reset();
    fs.mkdirSync("/tmp/sesame-index-lock", { recursive: true });
  });

  test("creates lock file and releases it", () => {
    const lock = acquireIndexLock("/tmp/sesame-index-lock", "watch");

    const lockFile = JSON.parse(fs.readFileSync(lock.path, "utf8")) as {
      pid?: number;
      holder?: string;
      startedAt?: string;
    };
    expect(lockFile.pid).toBe(process.pid);
    expect(lockFile.holder).toBe("watch");
    expect(lockFile.startedAt).toBeTypeOf("string");

    lock.release();

    expect(() => fs.readFileSync(lock.path, "utf8")).toThrow();
  });

  test("fails when another live holder owns the lock", () => {
    fs.writeFileSync(
      "/tmp/sesame-index-lock/index.lock",
      JSON.stringify({
        pid: process.pid,
        holder: "watch",
        startedAt: "2026-03-01T00:00:00.000Z",
      }),
      "utf8",
    );

    expect(() => acquireIndexLock("/tmp/sesame-index-lock", "index")).toThrow(
      "Index already running",
    );
  });

  test("removes stale lock when recorded pid is dead", () => {
    fs.writeFileSync(
      "/tmp/sesame-index-lock/index.lock",
      JSON.stringify({
        pid: 999999,
        holder: "watch",
        startedAt: "2026-03-01T00:00:00.000Z",
      }),
      "utf8",
    );

    const lock = acquireIndexLock("/tmp/sesame-index-lock", "index");
    const lockFile = JSON.parse(fs.readFileSync(lock.path, "utf8")) as {
      pid?: number;
      holder?: string;
    };

    expect(lockFile.pid).toBe(process.pid);
    expect(lockFile.holder).toBe("index");

    lock.release();
  });
});
