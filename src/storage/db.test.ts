import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { unlinkSync } from "node:fs";
import {
  deleteSession,
  dropAll,
  getStats,
  insertSession,
  openDatabase,
  type StoredChunk,
  type StoredSession,
  search,
} from "./db.ts";

describe("Database operations", () => {
  let dbPath: string;
  let db: any;

  beforeEach(() => {
    dbPath = `/tmp/sesame-test-db-${Date.now()}-${Math.random()}.sqlite`;
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    try {
      unlinkSync(dbPath);
    } catch {
      // Ignore if file doesn't exist
    }
    // Clean up WAL and SHM files
    try {
      unlinkSync(`${dbPath}-wal`);
    } catch {}
    try {
      unlinkSync(`${dbPath}-shm`);
    } catch {}
  });

  test("openDatabase creates tables and FTS index", () => {
    db = openDatabase(dbPath);

    // Verify tables exist by querying sqlite_master
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all() as Array<{ name: string }>;

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("sessions");
    expect(tableNames).toContain("chunks");
    expect(tableNames).toContain("chunks_fts");
  });

  test("insertSession + search finds it", () => {
    db = openDatabase(dbPath);

    const session: StoredSession = {
      id: "test-1",
      source: "pi",
      path: "/path/to/session.jsonl",
      cwd: "/home/user/project",
      name: "Test Session",
      created_at: "2026-01-15T10:00:00Z",
      modified_at: "2026-01-15T11:00:00Z",
      message_count: 2,
      file_mtime: Date.now(),
    };

    const chunks: StoredChunk[] = [
      {
        id: 0,
        session_id: "test-1",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 0,
        content: "How do I write a test?",
      },
      {
        id: 0,
        session_id: "test-1",
        kind: "message",
        role: "assistant",
        tool_name: null,
        seq: 1,
        content: "You can use the test framework to write tests.",
      },
    ];

    insertSession(db, session, chunks);

    const results = search(db, "test");

    expect(results).toHaveLength(1);
    expect(results[0].sessionId).toBe("test-1");
    expect(results[0].name).toBe("Test Session");
    expect(results[0].cwd).toBe("/home/user/project");
    expect(results[0].matchedSnippet).toBeTruthy();
  });

  test("search with BM25 ranks relevant sessions higher", () => {
    db = openDatabase(dbPath);

    // Insert session 1 with specific content about databases
    const session1: StoredSession = {
      id: "db-session",
      source: "pi",
      path: "/path/to/db.jsonl",
      cwd: "/project",
      name: "Database Work",
      created_at: "2026-01-15T10:00:00Z",
      modified_at: "2026-01-15T10:00:00Z",
      message_count: 1,
      file_mtime: Date.now(),
    };

    const chunks1: StoredChunk[] = [
      {
        id: 0,
        session_id: "db-session",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 0,
        content:
          "How do I optimize database queries? I need help with database performance and database indexing.",
      },
    ];

    // Insert session 2 with less relevant content
    const session2: StoredSession = {
      id: "other-session",
      source: "pi",
      path: "/path/to/other.jsonl",
      cwd: "/project",
      name: "Other Work",
      created_at: "2026-01-15T11:00:00Z",
      modified_at: "2026-01-15T11:00:00Z",
      message_count: 1,
      file_mtime: Date.now(),
    };

    const chunks2: StoredChunk[] = [
      {
        id: 0,
        session_id: "other-session",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 0,
        content: "The database mentioned in passing.",
      },
    ];

    insertSession(db, session1, chunks1);
    insertSession(db, session2, chunks2);

    const results = search(db, "database");

    expect(results.length).toBeGreaterThanOrEqual(2);
    // The session with more occurrences of "database" should rank higher (lower score)
    expect(results[0].sessionId).toBe("db-session");
  });

  test("search filters - cwd filter", () => {
    db = openDatabase(dbPath);

    const session1: StoredSession = {
      id: "proj-a",
      source: "pi",
      path: "/path/to/a.jsonl",
      cwd: "/home/user/project-a",
      name: "Project A",
      created_at: "2026-01-15T10:00:00Z",
      modified_at: "2026-01-15T10:00:00Z",
      message_count: 1,
      file_mtime: Date.now(),
    };

    const session2: StoredSession = {
      id: "proj-b",
      source: "pi",
      path: "/path/to/b.jsonl",
      cwd: "/home/user/project-b",
      name: "Project B",
      created_at: "2026-01-15T10:00:00Z",
      modified_at: "2026-01-15T10:00:00Z",
      message_count: 1,
      file_mtime: Date.now(),
    };

    const chunks: StoredChunk[] = [
      {
        id: 0,
        session_id: "proj-a",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 0,
        content: "testing content",
      },
      {
        id: 0,
        session_id: "proj-b",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 0,
        content: "testing content",
      },
    ];

    insertSession(db, session1, [chunks[0]]);
    insertSession(db, session2, [chunks[1]]);

    const results = search(db, "testing", { cwd: "/home/user/project-a" });

    expect(results).toHaveLength(1);
    expect(results[0].sessionId).toBe("proj-a");
  });

  test("search filters - date filters", () => {
    db = openDatabase(dbPath);

    const session1: StoredSession = {
      id: "old-session",
      source: "pi",
      path: "/path/to/old.jsonl",
      cwd: "/project",
      name: "Old Session",
      created_at: "2026-01-01T10:00:00Z",
      modified_at: "2026-01-01T10:00:00Z",
      message_count: 1,
      file_mtime: Date.now(),
    };

    const session2: StoredSession = {
      id: "new-session",
      source: "pi",
      path: "/path/to/new.jsonl",
      cwd: "/project",
      name: "New Session",
      created_at: "2026-02-01T10:00:00Z",
      modified_at: "2026-02-01T10:00:00Z",
      message_count: 1,
      file_mtime: Date.now(),
    };

    const chunks: StoredChunk[] = [
      {
        id: 0,
        session_id: "old-session",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 0,
        content: "testing filter",
      },
      {
        id: 0,
        session_id: "new-session",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 0,
        content: "testing filter",
      },
    ];

    insertSession(db, session1, [chunks[0]]);
    insertSession(db, session2, [chunks[1]]);

    // Filter by after date
    const afterResults = search(db, "filter", { after: "2026-01-15" });
    expect(afterResults).toHaveLength(1);
    expect(afterResults[0].sessionId).toBe("new-session");

    // Filter by before date
    const beforeResults = search(db, "filter", { before: "2026-01-15" });
    expect(beforeResults).toHaveLength(1);
    expect(beforeResults[0].sessionId).toBe("old-session");
  });

  test("search filters - limit", () => {
    db = openDatabase(dbPath);

    // Insert 5 sessions
    for (let i = 0; i < 5; i++) {
      const session: StoredSession = {
        id: `session-${i}`,
        source: "pi",
        path: `/path/to/${i}.jsonl`,
        cwd: "/project",
        name: `Session ${i}`,
        created_at: "2026-01-15T10:00:00Z",
        modified_at: "2026-01-15T10:00:00Z",
        message_count: 1,
        file_mtime: Date.now(),
      };

      const chunks: StoredChunk[] = [
        {
          id: 0,
          session_id: `session-${i}`,
          kind: "message",
          role: "user",
          tool_name: null,
          seq: 0,
          content: "common search term",
        },
      ];

      insertSession(db, session, chunks);
    }

    const results = search(db, "common", { limit: 3 });

    expect(results).toHaveLength(3);
  });

  test("deleteSession removes session and chunks", () => {
    db = openDatabase(dbPath);

    const session: StoredSession = {
      id: "delete-me",
      source: "pi",
      path: "/path/to/session.jsonl",
      cwd: "/project",
      name: "Session to Delete",
      created_at: "2026-01-15T10:00:00Z",
      modified_at: "2026-01-15T10:00:00Z",
      message_count: 1,
      file_mtime: Date.now(),
    };

    const chunks: StoredChunk[] = [
      {
        id: 0,
        session_id: "delete-me",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 0,
        content: "test content",
      },
    ];

    insertSession(db, session, chunks);

    // Verify session exists
    let results = search(db, "content");
    expect(results).toHaveLength(1);

    // Delete session
    deleteSession(db, "delete-me");

    // Verify session is gone
    results = search(db, "content");
    expect(results).toHaveLength(0);

    // Verify chunks are also gone
    const chunkCount = db
      .prepare("SELECT COUNT(*) as count FROM chunks")
      .get() as {
      count: number;
    };
    expect(chunkCount.count).toBe(0);
  });

  test("getStats returns correct counts", () => {
    db = openDatabase(dbPath);

    const session: StoredSession = {
      id: "stats-test",
      source: "pi",
      path: "/path/to/session.jsonl",
      cwd: "/project",
      name: "Stats Test",
      created_at: "2026-01-15T10:00:00Z",
      modified_at: "2026-01-15T10:00:00Z",
      message_count: 3,
      file_mtime: Date.now(),
    };

    const chunks: StoredChunk[] = [
      {
        id: 0,
        session_id: "stats-test",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 0,
        content: "chunk 1",
      },
      {
        id: 0,
        session_id: "stats-test",
        kind: "message",
        role: "assistant",
        tool_name: null,
        seq: 1,
        content: "chunk 2",
      },
      {
        id: 0,
        session_id: "stats-test",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 2,
        content: "chunk 3",
      },
    ];

    insertSession(db, session, chunks);

    const stats = getStats(db);

    expect(stats.sessionCount).toBe(1);
    expect(stats.chunkCount).toBe(3);
    expect(stats.dbSizeBytes).toBeGreaterThan(0);
  });

  test("dropAll clears everything", () => {
    db = openDatabase(dbPath);

    // Insert some data
    const session: StoredSession = {
      id: "drop-test",
      source: "pi",
      path: "/path/to/session.jsonl",
      cwd: "/project",
      name: "Drop Test",
      created_at: "2026-01-15T10:00:00Z",
      modified_at: "2026-01-15T10:00:00Z",
      message_count: 1,
      file_mtime: Date.now(),
    };

    const chunks: StoredChunk[] = [
      {
        id: 0,
        session_id: "drop-test",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 0,
        content: "test",
      },
    ];

    insertSession(db, session, chunks);

    // Verify data exists
    let stats = getStats(db);
    expect(stats.sessionCount).toBe(1);
    expect(stats.chunkCount).toBe(1);

    // Drop everything
    dropAll(db);

    // Verify everything is gone
    stats = getStats(db);
    expect(stats.sessionCount).toBe(0);
    expect(stats.chunkCount).toBe(0);

    // Verify schema still exists (can insert again)
    insertSession(db, session, chunks);
    stats = getStats(db);
    expect(stats.sessionCount).toBe(1);
  });
});
