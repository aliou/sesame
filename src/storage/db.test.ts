import { unlinkSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  deleteSession,
  dropAll,
  getMetadata,
  getStats,
  insertSession,
  openDatabase,
  setMetadata,
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
    expect(tableNames).toContain("metadata");
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
        is_error: null,
      },
      {
        id: 0,
        session_id: "test-1",
        kind: "message",
        role: "assistant",
        tool_name: null,
        seq: 1,
        content: "You can use the test framework to write tests.",
        is_error: null,
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
        is_error: null,
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
        is_error: null,
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
        is_error: null,
      },
      {
        id: 0,
        session_id: "proj-b",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 0,
        content: "testing content",
        is_error: null,
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
        is_error: null,
      },
      {
        id: 0,
        session_id: "new-session",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 0,
        content: "testing filter",
        is_error: null,
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
          is_error: null,
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
        is_error: null,
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
        is_error: null,
      },
      {
        id: 0,
        session_id: "stats-test",
        kind: "message",
        role: "assistant",
        tool_name: null,
        seq: 1,
        content: "chunk 2",
        is_error: null,
      },
      {
        id: 0,
        session_id: "stats-test",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 2,
        content: "chunk 3",
        is_error: null,
      },
    ];

    insertSession(db, session, chunks);

    const stats = getStats(db);

    expect(stats.sessionCount).toBe(1);
    expect(stats.chunkCount).toBe(3);
    expect(stats.dbSizeBytes).toBeGreaterThan(0);
    expect(stats.lastSyncAt).toBeNull();
  });

  test("setMetadata + getMetadata works", () => {
    db = openDatabase(dbPath);

    const value = "2026-02-17T10:00:00.000Z";
    setMetadata(db, "last_sync_at", value);

    expect(getMetadata(db, "last_sync_at")).toBe(value);
    expect(getStats(db).lastSyncAt).toBe(value);
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
        is_error: null,
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

  test("search with '*' returns all sessions", () => {
    db = openDatabase(dbPath);

    // Insert 3 sessions
    for (let i = 0; i < 3; i++) {
      const session: StoredSession = {
        id: `all-${i}`,
        source: "pi",
        path: `/path/to/${i}.jsonl`,
        cwd: "/project",
        name: `Session ${i}`,
        created_at: `2026-01-${15 + i}T10:00:00Z`,
        modified_at: `2026-01-${15 + i}T10:00:00Z`,
        message_count: 1,
        file_mtime: Date.now(),
      };

      const chunks: StoredChunk[] = [
        {
          id: 0,
          session_id: `all-${i}`,
          kind: "message",
          role: "user",
          tool_name: null,
          seq: 0,
          content: `content ${i}`,
          is_error: null,
        },
      ];

      insertSession(db, session, chunks);
    }

    // Search with "*" and limit
    const results = search(db, "*", { limit: 10 });

    expect(results).toHaveLength(3);
    expect(results[0].score).toBe(0); // No relevance score for list-all
  });

  test("search with '*' respects filters", () => {
    db = openDatabase(dbPath);

    const session1: StoredSession = {
      id: "star-old",
      source: "pi",
      path: "/path/to/old.jsonl",
      cwd: "/home/user/project-a",
      name: "Old Session",
      created_at: "2026-01-01T10:00:00Z",
      modified_at: "2026-01-01T10:00:00Z",
      message_count: 1,
      file_mtime: Date.now(),
    };

    const session2: StoredSession = {
      id: "star-new",
      source: "pi",
      path: "/path/to/new.jsonl",
      cwd: "/home/user/project-b",
      name: "New Session",
      created_at: "2026-02-01T10:00:00Z",
      modified_at: "2026-02-01T10:00:00Z",
      message_count: 1,
      file_mtime: Date.now(),
    };

    const chunks: StoredChunk[] = [
      {
        id: 0,
        session_id: "star-old",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 0,
        content: "content 1",
        is_error: null,
      },
      {
        id: 0,
        session_id: "star-new",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 0,
        content: "content 2",
        is_error: null,
      },
    ];

    insertSession(db, session1, [chunks[0]]);
    insertSession(db, session2, [chunks[1]]);

    // Filter by after date
    const afterResults = search(db, "*", { after: "2026-01-15" });
    expect(afterResults).toHaveLength(1);
    expect(afterResults[0].sessionId).toBe("star-new");

    // Filter by cwd
    const cwdResults = search(db, "*", { cwd: "/home/user/project-a" });
    expect(cwdResults).toHaveLength(1);
    expect(cwdResults[0].sessionId).toBe("star-old");
  });

  test("search with '*' sorts by modified date descending", () => {
    db = openDatabase(dbPath);

    const session1: StoredSession = {
      id: "oldest",
      source: "pi",
      path: "/path/to/oldest.jsonl",
      cwd: "/project",
      name: "Oldest",
      created_at: "2026-01-01T10:00:00Z",
      modified_at: "2026-01-01T10:00:00Z",
      message_count: 1,
      file_mtime: Date.now(),
    };

    const session2: StoredSession = {
      id: "newest",
      source: "pi",
      path: "/path/to/newest.jsonl",
      cwd: "/project",
      name: "Newest",
      created_at: "2026-03-01T10:00:00Z",
      modified_at: "2026-03-01T10:00:00Z",
      message_count: 1,
      file_mtime: Date.now(),
    };

    const session3: StoredSession = {
      id: "middle",
      source: "pi",
      path: "/path/to/middle.jsonl",
      cwd: "/project",
      name: "Middle",
      created_at: "2026-02-01T10:00:00Z",
      modified_at: "2026-02-01T10:00:00Z",
      message_count: 1,
      file_mtime: Date.now(),
    };

    const chunks: StoredChunk[] = [
      {
        id: 0,
        session_id: "oldest",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 0,
        content: "content 1",
        is_error: null,
      },
      {
        id: 0,
        session_id: "newest",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 0,
        content: "content 2",
        is_error: null,
      },
      {
        id: 0,
        session_id: "middle",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 0,
        content: "content 3",
        is_error: null,
      },
    ];

    insertSession(db, session1, [chunks[0]]);
    insertSession(db, session2, [chunks[1]]);
    insertSession(db, session3, [chunks[2]]);

    const results = search(db, "*", { limit: 10 });

    expect(results).toHaveLength(3);
    expect(results[0].sessionId).toBe("newest");
    expect(results[1].sessionId).toBe("middle");
    expect(results[2].sessionId).toBe("oldest");
  });

  test("search with '*' exclude filters in SQL before limit", () => {
    db = openDatabase(dbPath);

    insertSession(
      db,
      {
        id: "exclude-newest",
        source: "pi",
        path: "/path/to/newest.jsonl",
        cwd: "/project",
        name: "Newest",
        created_at: "2026-03-01T10:00:00Z",
        modified_at: "2026-03-01T10:00:00Z",
        message_count: 1,
        file_mtime: Date.now(),
      },
      [
        {
          id: 0,
          session_id: "exclude-newest",
          kind: "message",
          role: "user",
          tool_name: null,
          seq: 0,
          content: "shared content",
          is_error: null,
        },
      ],
    );

    insertSession(
      db,
      {
        id: "exclude-middle",
        source: "pi",
        path: "/path/to/middle.jsonl",
        cwd: "/project",
        name: "Middle",
        created_at: "2026-02-01T10:00:00Z",
        modified_at: "2026-02-01T10:00:00Z",
        message_count: 1,
        file_mtime: Date.now(),
      },
      [
        {
          id: 0,
          session_id: "exclude-middle",
          kind: "message",
          role: "user",
          tool_name: null,
          seq: 0,
          content: "shared content",
          is_error: null,
        },
      ],
    );

    const results = search(db, "*", {
      limit: 1,
      exclude: ["exclude-newest"],
    });

    expect(results).toHaveLength(1);
    expect(results[0].sessionId).toBe("exclude-middle");
  });

  test("FTS search exclude filters in SQL before limit", () => {
    db = openDatabase(dbPath);

    insertSession(
      db,
      {
        id: "best-match",
        source: "pi",
        path: "/path/to/best.jsonl",
        cwd: "/project",
        name: "Best",
        created_at: "2026-01-01T10:00:00Z",
        modified_at: "2026-01-01T10:00:00Z",
        message_count: 1,
        file_mtime: Date.now(),
      },
      [
        {
          id: 0,
          session_id: "best-match",
          kind: "message",
          role: "user",
          tool_name: null,
          seq: 0,
          content: "alpha alpha alpha alpha alpha",
          is_error: null,
        },
      ],
    );

    insertSession(
      db,
      {
        id: "fallback-match",
        source: "pi",
        path: "/path/to/fallback.jsonl",
        cwd: "/project",
        name: "Fallback",
        created_at: "2026-01-02T10:00:00Z",
        modified_at: "2026-01-02T10:00:00Z",
        message_count: 1,
        file_mtime: Date.now(),
      },
      [
        {
          id: 0,
          session_id: "fallback-match",
          kind: "message",
          role: "user",
          tool_name: null,
          seq: 0,
          content: "alpha",
          is_error: null,
        },
      ],
    );

    const results = search(db, "alpha", {
      limit: 1,
      exclude: ["best-match"],
    });

    expect(results).toHaveLength(1);
    expect(results[0].sessionId).toBe("fallback-match");
  });

  test("search with empty query throws error", () => {
    db = openDatabase(dbPath);

    expect(() => search(db, "")).toThrow("Search query cannot be empty");
    expect(() => search(db, "   ")).toThrow("Search query cannot be empty");
  });

  test("search with '*' filters by toolName", () => {
    db = openDatabase(dbPath);

    const session1: StoredSession = {
      id: "tool-session",
      source: "pi",
      path: "/path/to/tool.jsonl",
      cwd: "/project",
      name: "Tool Session",
      created_at: "2026-01-15T10:00:00Z",
      modified_at: "2026-01-15T10:00:00Z",
      message_count: 2,
      file_mtime: Date.now(),
    };

    const session2: StoredSession = {
      id: "no-tool-session",
      source: "pi",
      path: "/path/to/notool.jsonl",
      cwd: "/project",
      name: "No Tool Session",
      created_at: "2026-01-15T11:00:00Z",
      modified_at: "2026-01-15T11:00:00Z",
      message_count: 1,
      file_mtime: Date.now(),
    };

    insertSession(db, session1, [
      {
        id: 0,
        session_id: "tool-session",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 0,
        content: "help me write a file",
        is_error: null,
      },
      {
        id: 0,
        session_id: "tool-session",
        kind: "tool_call",
        role: null,
        tool_name: "Bash",
        seq: 1,
        content: "tool: Bash\ncommand: ls -la",
        is_error: null,
      },
    ]);

    insertSession(db, session2, [
      {
        id: 0,
        session_id: "no-tool-session",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 0,
        content: "just chatting",
        is_error: null,
      },
    ]);

    // "*" with toolName should only return session with that tool
    const results = search(db, "*", { toolName: "Bash" });
    expect(results).toHaveLength(1);
    expect(results[0].sessionId).toBe("tool-session");
  });

  test("search with '*' filters by toolsOnly", () => {
    db = openDatabase(dbPath);

    const session1: StoredSession = {
      id: "has-tools",
      source: "pi",
      path: "/path/to/tools.jsonl",
      cwd: "/project",
      name: "Has Tools",
      created_at: "2026-01-15T10:00:00Z",
      modified_at: "2026-01-15T10:00:00Z",
      message_count: 1,
      file_mtime: Date.now(),
    };

    const session2: StoredSession = {
      id: "no-tools",
      source: "pi",
      path: "/path/to/notools.jsonl",
      cwd: "/project",
      name: "No Tools",
      created_at: "2026-01-15T11:00:00Z",
      modified_at: "2026-01-15T11:00:00Z",
      message_count: 1,
      file_mtime: Date.now(),
    };

    insertSession(db, session1, [
      {
        id: 0,
        session_id: "has-tools",
        kind: "tool_call",
        role: null,
        tool_name: "Write",
        seq: 0,
        content: "tool: Write\npath: test.txt",
        is_error: null,
      },
    ]);

    insertSession(db, session2, [
      {
        id: 0,
        session_id: "no-tools",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 0,
        content: "just a message",
        is_error: null,
      },
    ]);

    const results = search(db, "*", { toolsOnly: true });
    expect(results).toHaveLength(1);
    expect(results[0].sessionId).toBe("has-tools");
  });

  test("search with '*' filters by status with toolName", () => {
    db = openDatabase(dbPath);

    const session1: StoredSession = {
      id: "error-session",
      source: "pi",
      path: "/path/to/error.jsonl",
      cwd: "/project",
      name: "Error Session",
      created_at: "2026-01-15T10:00:00Z",
      modified_at: "2026-01-15T10:00:00Z",
      message_count: 2,
      file_mtime: Date.now(),
    };

    const session2: StoredSession = {
      id: "success-session",
      source: "pi",
      path: "/path/to/success.jsonl",
      cwd: "/project",
      name: "Success Session",
      created_at: "2026-01-15T11:00:00Z",
      modified_at: "2026-01-15T11:00:00Z",
      message_count: 2,
      file_mtime: Date.now(),
    };

    insertSession(db, session1, [
      {
        id: 0,
        session_id: "error-session",
        kind: "tool_call",
        role: null,
        tool_name: "Bash",
        seq: 0,
        content: "tool: Bash\ncommand: exit 1",
        is_error: null,
      },
      {
        id: 0,
        session_id: "error-session",
        kind: "message",
        role: "system",
        tool_name: "Bash",
        seq: 1,
        content: "Command failed with exit code 1",
        is_error: 1,
      },
    ]);

    insertSession(db, session2, [
      {
        id: 0,
        session_id: "success-session",
        kind: "tool_call",
        role: null,
        tool_name: "Bash",
        seq: 0,
        content: "tool: Bash\ncommand: echo hello",
        is_error: null,
      },
      {
        id: 0,
        session_id: "success-session",
        kind: "message",
        role: "system",
        tool_name: "Bash",
        seq: 1,
        content: "hello",
        is_error: 0,
      },
    ]);

    // Filter for errors only
    const errorResults = search(db, "*", { toolName: "Bash", status: "error" });
    expect(errorResults).toHaveLength(1);
    expect(errorResults[0].sessionId).toBe("error-session");

    // Filter for success only
    const successResults = search(db, "*", {
      toolName: "Bash",
      status: "success",
    });
    expect(successResults).toHaveLength(1);
    expect(successResults[0].sessionId).toBe("success-session");
  });

  test("status filter is ignored without toolName or toolsOnly", () => {
    db = openDatabase(dbPath);

    const session: StoredSession = {
      id: "status-ignored",
      source: "pi",
      path: "/path/to/session.jsonl",
      cwd: "/project",
      name: "Status Ignored",
      created_at: "2026-01-15T10:00:00Z",
      modified_at: "2026-01-15T10:00:00Z",
      message_count: 1,
      file_mtime: Date.now(),
    };

    insertSession(db, session, [
      {
        id: 0,
        session_id: "status-ignored",
        kind: "message",
        role: "user",
        tool_name: null,
        seq: 0,
        content: "just a message",
        is_error: null,
      },
    ]);

    // status without toolName/toolsOnly should be ignored, returning the session
    const results = search(db, "*", { status: "error" });
    expect(results).toHaveLength(1);
    expect(results[0].sessionId).toBe("status-ignored");
  });

  test("FTS search with status filter works", () => {
    db = openDatabase(dbPath);

    const session1: StoredSession = {
      id: "fts-error",
      source: "pi",
      path: "/path/to/fts-error.jsonl",
      cwd: "/project",
      name: "FTS Error",
      created_at: "2026-01-15T10:00:00Z",
      modified_at: "2026-01-15T10:00:00Z",
      message_count: 2,
      file_mtime: Date.now(),
    };

    const session2: StoredSession = {
      id: "fts-success",
      source: "pi",
      path: "/path/to/fts-success.jsonl",
      cwd: "/project",
      name: "FTS Success",
      created_at: "2026-01-15T11:00:00Z",
      modified_at: "2026-01-15T11:00:00Z",
      message_count: 2,
      file_mtime: Date.now(),
    };

    insertSession(db, session1, [
      {
        id: 0,
        session_id: "fts-error",
        kind: "tool_call",
        role: null,
        tool_name: "Bash",
        seq: 0,
        content: "tool: Bash\ncommand: deploy application",
        is_error: null,
      },
      {
        id: 0,
        session_id: "fts-error",
        kind: "message",
        role: "system",
        tool_name: "Bash",
        seq: 1,
        content: "deploy failed",
        is_error: 1,
      },
    ]);

    insertSession(db, session2, [
      {
        id: 0,
        session_id: "fts-success",
        kind: "tool_call",
        role: null,
        tool_name: "Bash",
        seq: 0,
        content: "tool: Bash\ncommand: deploy application",
        is_error: null,
      },
      {
        id: 0,
        session_id: "fts-success",
        kind: "message",
        role: "system",
        tool_name: "Bash",
        seq: 1,
        content: "deploy succeeded",
        is_error: 0,
      },
    ]);

    // FTS search for "deploy" with status filter
    const errorResults = search(db, "deploy", {
      toolName: "Bash",
      status: "error",
    });
    expect(errorResults).toHaveLength(1);
    expect(errorResults[0].sessionId).toBe("fts-error");

    const successResults = search(db, "deploy", {
      toolName: "Bash",
      status: "success",
    });
    expect(successResults).toHaveLength(1);
    expect(successResults[0].sessionId).toBe("fts-success");
  });
});
