import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AsyncSessionSearch } from "@aliou/sesame";
import { afterEach, describe, expect, test } from "vitest";
import { insertSession, openDatabase } from "./storage/db";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (
    path: string,
  ) => {
    exec: (sql: string) => void;
    close: () => void;
  };
};

describe("AsyncSessionSearch", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
  });

  test("searches and lists on a worker without blocking the caller", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sesame-async-"));
    dirs.push(dir);
    const path = join(dir, "index.sqlite");
    const db = openDatabase(path);
    insertSession(
      db,
      {
        id: "first",
        source: "pi",
        path: "/sessions/first.jsonl",
        cwd: "/project",
        name: "First session",
        created_at: "2026-01-01T00:00:00Z",
        modified_at: "2026-01-02T00:00:00Z",
        message_count: 4,
        file_mtime: 1,
        parent_session_id: null,
      },
      [
        {
          id: 0,
          session_id: "first",
          kind: "message",
          role: "user",
          tool_name: null,
          seq: 0,
          content: "hello worker",
          is_error: null,
          entry_id: "entry",
          parent_entry_id: null,
          timestamp: null,
          source_type: null,
        },
      ],
    );
    db.close();

    const client = new AsyncSessionSearch(dir);
    try {
      const search = client.search("worker");
      const tick = new Promise<void>((resolve) => setTimeout(resolve, 0));
      await tick;
      const matches = await search;
      expect(matches[0]).toMatchObject({
        sessionId: "first",
        messageCount: 4,
        matchedEntryId: "entry",
      });
      const listed = await client.list("/project");
      expect(listed[0].id).toBe("first");
      const named = await client.searchNames("First");
      expect(named[0].id).toBe("first");
      const reference = await client.get("first");
      expect(reference?.id).toBe("first");

      const controller = new AbortController();
      controller.abort(new Error("stale search"));
      await expect(
        client.search("worker", {}, controller.signal),
      ).rejects.toThrow("stale search");
      const followingSearch = await client.search("worker");
      expect(followingSearch).toHaveLength(1);
    } finally {
      await client.close();
    }
  });

  test("creates an index in a missing data directory", async () => {
    const root = mkdtempSync(join(tmpdir(), "sesame-async-empty-"));
    dirs.push(root);
    const dataDir = join(root, "data", "sesame");
    const client = new AsyncSessionSearch(dataDir);
    try {
      const rows = await client.search();
      expect(rows).toEqual([]);
    } finally {
      await client.close();
    }
  });

  test("migrates an existing older index before querying", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sesame-async-legacy-"));
    dirs.push(dir);
    const legacy = new DatabaseSync(join(dir, "index.sqlite"));
    legacy.exec(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY, source TEXT NOT NULL, path TEXT NOT NULL,
        cwd TEXT, name TEXT, created_at TEXT, modified_at TEXT,
        message_count INTEGER, file_mtime INTEGER
      );
      CREATE TABLE chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        kind TEXT NOT NULL, role TEXT, tool_name TEXT, seq INTEGER,
        content TEXT NOT NULL
      );
    `);
    legacy.close();

    const client = new AsyncSessionSearch(dir);
    try {
      const rows = await client.search();
      expect(rows).toEqual([]);
    } finally {
      await client.close();
    }
  });

  test("filters directory depth before applying the result limit", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sesame-async-depth-"));
    dirs.push(dir);
    const db = openDatabase(join(dir, "index.sqlite"));
    for (const [id, cwd, modified] of [
      ["deep", "/project/a/b", "2026-01-03T00:00:00Z"],
      ["child", "/project/a", "2026-01-02T00:00:00Z"],
      ["exact", "/project", "2026-01-01T00:00:00Z"],
    ]) {
      insertSession(
        db,
        {
          id,
          source: "pi",
          path: `/sessions/${id}.jsonl`,
          cwd,
          name: id,
          created_at: modified,
          modified_at: modified,
          message_count: 1,
          file_mtime: 1,
          parent_session_id: null,
        },
        [],
      );
    }
    db.close();

    const client = new AsyncSessionSearch(dir);
    try {
      const rows = await client.list("/project", 1, 1);
      expect(rows.map((row) => row.id)).toEqual(["child"]);
      const exact = await client.list("/project", 1);
      expect(exact.map((row) => row.id)).toEqual(["exact"]);
    } finally {
      await client.close();
    }
  });
});
