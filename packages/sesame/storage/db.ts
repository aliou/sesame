import { statSync } from "node:fs";
import { createRequire } from "node:module";
import { migrations } from "./migrations/index";

const require = createRequire(import.meta.url);

type StatementLike = {
  run: (...args: unknown[]) => unknown;
  get: (...args: unknown[]) => unknown;
  all: (...args: unknown[]) => unknown;
};

export interface Database {
  prepare: (sql: string) => StatementLike;
  exec: (sql: string) => unknown;
  close: () => void;
  location?: () => string;
  filename?: string;
}

export interface StoredSession {
  id: string;
  source: string;
  path: string;
  cwd: string | null;
  name: string | null;
  created_at: string | null;
  modified_at: string | null;
  message_count: number;
  file_mtime: number;
  parent_session_id: string | null;
}

export interface StoredChunk {
  id: number;
  session_id: string;
  kind: string; // 'message' or 'tool_call'
  role: string | null;
  tool_name: string | null;
  seq: number;
  content: string;
  is_error: number | null; // 0 = success, 1 = error, null = not applicable
  entry_id: string | null;
  parent_entry_id: string | null;
  timestamp: string | null;
  source_type: string | null;
}

export interface SearchResult {
  sessionId: string;
  source: string;
  path: string;
  cwd: string | null;
  name: string | null;
  score: number;
  createdAt: string | null;
  modifiedAt: string | null;
  matchedSnippet: string;
  matchMode: "all" | "any" | "browse";
  matchedType: string | null;
  matchedEntryId: string | null;
  matchedAt: string | null;
}

export interface ListSessionsOptions {
  cwd?: string;
  after?: string; // ISO date string
  before?: string; // ISO date string
  limit?: number; // default 50
  offset?: number; // default 0
}

export interface SearchOptions {
  cwd?: string;
  after?: string; // ISO date string
  before?: string; // ISO date string
  limit?: number; // default 10
  toolsOnly?: boolean;
  toolName?: string;
  pathFilter?: string;
  exclude?: string[];
  json?: boolean;
  status?: "success" | "error";
}

/**
 * Escape FTS5 special characters in a query string.
 * Wraps each token in double quotes to prevent operators like . * - from
 * being interpreted as FTS5 syntax.
 */
function escapeFtsQuery(query: string): string {
  // Split on whitespace, wrap each token in quotes
  return query
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `"${token.replace(/"/g, '""')}"`)
    .join(" ");
}

function escapeFtsAnyQuery(query: string): string {
  return query
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `"${token.replace(/"/g, '""')}"`)
    .join(" OR ");
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  path TEXT NOT NULL,
  cwd TEXT,
  name TEXT,
  created_at TEXT,
  modified_at TEXT,
  message_count INTEGER,
  file_mtime INTEGER,
  parent_session_id TEXT
);

CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  role TEXT,
  tool_name TEXT,
  seq INTEGER,
  content TEXT NOT NULL,
  is_error INTEGER DEFAULT NULL,
  entry_id TEXT,
  parent_entry_id TEXT,
  timestamp TEXT,
  source_type TEXT
);

CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  content,
  content='chunks',
  content_rowid='id',
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, content) VALUES (new.id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', old.id, old.content);
END;

CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', old.id, old.content);
  INSERT INTO chunks_fts(rowid, content) VALUES (new.id, new.content);
END;

CREATE INDEX IF NOT EXISTS idx_chunks_session ON chunks(session_id);
CREATE INDEX IF NOT EXISTS idx_chunks_kind ON chunks(kind);
CREATE INDEX IF NOT EXISTS idx_chunks_tool ON chunks(tool_name);
`;

const nodeSqlite = require("node:sqlite") as {
  DatabaseSync: new (path: string) => Database;
};

function getDatabaseConstructor(): new (path: string) => Database {
  return nodeSqlite.DatabaseSync;
}

export function openDatabase(dbPath: string): Database {
  const DatabaseConstructor = getDatabaseConstructor();
  const db = new DatabaseConstructor(dbPath);

  // Enable WAL mode for better concurrency
  db.exec("PRAGMA journal_mode = WAL");

  // Enable foreign keys
  db.exec("PRAGMA foreign_keys = ON");

  // Detect whether the database already has tables (existing DB vs fresh).
  // Must happen before SCHEMA so we know whether to run or skip migrations.
  const existing = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'",
    )
    .get() as { name: string } | undefined;
  const isFresh = !existing;

  // Create schema. Uses CREATE IF NOT EXISTS so it's safe for both fresh
  // and existing databases. The SCHEMA constant always reflects the latest
  // table definitions, including columns added by migrations.
  db.exec(SCHEMA);

  // Run pending migrations.
  runMigrations(db, isFresh);

  // Create indexes that depend on columns introduced by migrations.
  ensurePostMigrationIndexes(db);

  return db;
}

function runMigrations(db: Database, isFresh: boolean): void {
  // Ensure tracking table exists.
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      description TEXT,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Collect already-applied migration IDs.
  const rows = db.prepare("SELECT id FROM schema_migrations").all() as Array<{
    id: number;
  }>;
  const applied = new Set(rows.map((r) => r.id));

  const insertStmt = db.prepare(
    "INSERT INTO schema_migrations (id, description) VALUES (?, ?)",
  );

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue;
    }

    // Fresh databases already have the latest schema from the SCHEMA
    // constant, so we only need to record the migration, not run it.
    if (!isFresh) {
      migration.fn(db);
    }

    insertStmt.run(migration.id, migration.description);
  }
}

function ensurePostMigrationIndexes(db: Database): void {
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_sessions_parent ON sessions(parent_session_id)",
  );
  db.exec("CREATE INDEX IF NOT EXISTS idx_chunks_entry ON chunks(entry_id)");
}

export function getSessionMtime(
  db: Database,
  sessionId: string,
): number | null {
  const stmt = db.prepare("SELECT file_mtime FROM sessions WHERE id = ?");
  const row = stmt.get(sessionId) as { file_mtime: number } | undefined;
  return row?.file_mtime ?? null;
}

export function deleteSession(db: Database, sessionId: string): void {
  const stmt = db.prepare("DELETE FROM sessions WHERE id = ?");
  stmt.run(sessionId);
}

export function insertSession(
  db: Database,
  session: StoredSession,
  chunks: StoredChunk[],
): void {
  const insertSessionStmt = db.prepare(
    `INSERT INTO sessions (id, source, path, cwd, name, created_at, modified_at, message_count, file_mtime, parent_session_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const insertChunkStmt = db.prepare(
    `INSERT INTO chunks (session_id, kind, role, tool_name, seq, content, is_error, entry_id, parent_entry_id, timestamp, source_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  db.exec("BEGIN");
  try {
    insertSessionStmt.run(
      session.id,
      session.source,
      session.path,
      session.cwd,
      session.name,
      session.created_at,
      session.modified_at,
      session.message_count,
      session.file_mtime,
      session.parent_session_id,
    );

    for (const chunk of chunks) {
      insertChunkStmt.run(
        chunk.session_id,
        chunk.kind,
        chunk.role,
        chunk.tool_name,
        chunk.seq,
        chunk.content,
        chunk.is_error,
        chunk.entry_id,
        chunk.parent_entry_id,
        chunk.timestamp,
        chunk.source_type,
      );
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * List all sessions without FTS search, ordered by modification date.
 * Used when query is "*" to bypass full-text search.
 */
function listAllSessions(db: Database, options: SearchOptions): SearchResult[] {
  const {
    cwd,
    after,
    before,
    limit = 10,
    toolsOnly = false,
    toolName,
    pathFilter,
    exclude,
    status,
  } = options;

  const needsChunkJoin =
    toolsOnly || toolName || pathFilter || (status && (toolsOnly || toolName));

  let sql: string;
  if (needsChunkJoin) {
    sql = `
      SELECT DISTINCT
        s.id as sessionId,
        s.source,
        s.path,
        s.cwd,
        s.name,
        s.created_at as createdAt,
        s.modified_at as modifiedAt
      FROM sessions s
      JOIN chunks c ON c.session_id = s.id
      WHERE 1=1
    `;
  } else {
    sql = `
      SELECT 
        s.id as sessionId,
        s.source,
        s.path,
        s.cwd,
        s.name,
        s.created_at as createdAt,
        s.modified_at as modifiedAt
      FROM sessions s
      WHERE 1=1
    `;
  }

  const params: unknown[] = [];

  if (cwd) {
    sql += " AND s.cwd LIKE ?";
    params.push(`${cwd}%`);
  }

  if (after) {
    sql += " AND s.modified_at >= ?";
    params.push(after);
  }

  if (before) {
    sql += " AND s.modified_at <= ?";
    params.push(before);
  }

  if (exclude && exclude.length > 0) {
    sql += ` AND s.id NOT IN (${exclude.map(() => "?").join(",")})`;
    params.push(...exclude);
  }

  if (needsChunkJoin) {
    if (toolsOnly) {
      sql += " AND c.kind = 'tool_call'";
    }

    if (toolName) {
      sql += " AND c.tool_name = ?";
      params.push(toolName);
    }

    if (pathFilter) {
      sql += " AND c.kind = 'tool_call' AND c.content LIKE ?";
      params.push(`%${pathFilter}%`);
    }

    if (status && (toolsOnly || toolName)) {
      const isErrorValue = status === "error" ? 1 : 0;
      // Status filter requires a matching tool result chunk in the same session
      sql += ` AND s.id IN (
        SELECT c2.session_id FROM chunks c2
        WHERE c2.is_error = ?
        ${toolName ? "AND c2.tool_name = ?" : ""}
      )`;
      params.push(isErrorValue);
      if (toolName) {
        params.push(toolName);
      }
    }
  }

  sql += " ORDER BY s.modified_at DESC LIMIT ?";
  params.push(limit);

  const stmt = db.prepare(sql);
  const rows = stmt.all(...(params as [string])) as Array<{
    sessionId: string;
    source: string;
    path: string;
    cwd: string | null;
    name: string | null;
    createdAt: string | null;
    modifiedAt: string | null;
  }>;

  return rows.map((row) => ({
    sessionId: row.sessionId,
    source: row.source,
    path: row.path,
    cwd: row.cwd,
    name: row.name,
    score: 0, // No relevance score for list-all
    createdAt: row.createdAt,
    modifiedAt: row.modifiedAt,
    matchedSnippet: row.name || "(recent session)",
    matchMode: "browse",
    matchedType: null,
    matchedEntryId: null,
    matchedAt: null,
  }));
}

function searchFts(
  db: Database,
  ftsQuery: string,
  options: SearchOptions,
  matchMode: "all" | "any",
): SearchResult[] {
  const {
    cwd,
    after,
    before,
    limit = 10,
    toolsOnly = false,
    toolName,
    pathFilter,
    exclude,
    status,
  } = options;

  let sql = `
    SELECT
      s.id as sessionId,
      s.source,
      s.path,
      s.cwd,
      s.name,
      s.created_at as createdAt,
      s.modified_at as modifiedAt,
      c.id as chunkId,
      c.entry_id as matchedEntryId,
      c.timestamp as matchedAt,
      CASE
        WHEN c.kind = 'tool_call' THEN 'tool_call'
        WHEN c.source_type IS NOT NULL THEN c.source_type
        ELSE c.kind
      END as matchedType,
      bm25(chunks_fts) as score,
      snippet(chunks_fts, 0, '', '', '...', 32) as matchedSnippet
    FROM chunks_fts
    JOIN chunks c ON c.id = chunks_fts.rowid
    JOIN sessions s ON s.id = c.session_id
    WHERE chunks_fts MATCH ?
  `;
  const params: unknown[] = [ftsQuery];

  if (cwd) {
    sql += " AND s.cwd LIKE ?";
    params.push(`${cwd}%`);
  }
  if (after) {
    sql += " AND s.modified_at >= ?";
    params.push(after);
  }
  if (before) {
    sql += " AND s.modified_at <= ?";
    params.push(before);
  }
  if (exclude && exclude.length > 0) {
    sql += ` AND s.id NOT IN (${exclude.map(() => "?").join(",")})`;
    params.push(...exclude);
  }
  if (toolsOnly) {
    sql += " AND c.kind = 'tool_call'";
  }
  if (toolName) {
    sql += " AND c.tool_name = ?";
    params.push(toolName);
  }
  if (pathFilter) {
    sql += " AND c.kind = 'tool_call' AND c.content LIKE ?";
    params.push(`%${pathFilter}%`);
  }
  if (status && (toolsOnly || toolName)) {
    const isErrorValue = status === "error" ? 1 : 0;
    sql += ` AND s.id IN (
      SELECT c2.session_id FROM chunks c2
      WHERE c2.is_error = ?
      ${toolName ? "AND c2.tool_name = ?" : ""}
    )`;
    params.push(isErrorValue);
    if (toolName) {
      params.push(toolName);
    }
  }

  const rows = db.prepare(sql).all(...(params as [string])) as Array<{
    sessionId: string;
    source: string;
    path: string;
    cwd: string | null;
    name: string | null;
    createdAt: string | null;
    modifiedAt: string | null;
    chunkId: number;
    matchedEntryId: string | null;
    matchedAt: string | null;
    matchedType: string | null;
    score: number;
    matchedSnippet: string;
  }>;

  const sessionMap = new Map<string, SearchResult>();
  for (const row of rows) {
    const existing = sessionMap.get(row.sessionId);
    if (!existing || row.score < existing.score) {
      sessionMap.set(row.sessionId, {
        sessionId: row.sessionId,
        source: row.source,
        path: row.path,
        cwd: row.cwd,
        name: row.name,
        score: row.score,
        createdAt: row.createdAt,
        modifiedAt: row.modifiedAt,
        matchedSnippet: row.matchedSnippet,
        matchMode,
        matchedType: row.matchedType,
        matchedEntryId: row.matchedEntryId,
        matchedAt: row.matchedAt,
      });
    }
  }

  return Array.from(sessionMap.values())
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}

export function search(
  db: Database,
  query?: string,
  options: SearchOptions = {},
): SearchResult[] {
  // Normalize empty query to "*" for listing all sessions with filters
  query = query?.trim();
  if (!query) {
    query = "*";
  }

  // Special case: "*" means list all sessions with filters
  if (query === "*") {
    return listAllSessions(db, options);
  }

  const strictResults = searchFts(db, escapeFtsQuery(query), options, "all");
  if (strictResults.length > 0 || query.trim().split(/\s+/).length <= 1) {
    return strictResults;
  }
  return searchFts(db, escapeFtsAnyQuery(query), options, "any");
}

export function listSessions(
  db: Database,
  options: ListSessionsOptions = {},
): StoredSession[] {
  const {
    cwd,
    after,
    before,
    limit: rawLimit = 50,
    offset: rawOffset = 0,
  } = options;

  const limit = Math.max(1, Math.min(rawLimit, 500));
  const offset = Math.max(0, rawOffset);

  let sql = "SELECT * FROM sessions WHERE 1=1";
  const params: unknown[] = [];

  if (cwd) {
    const escaped = cwd.replace(/[%_]/g, "\\$&");
    sql += " AND cwd LIKE ? ESCAPE '\\'";
    params.push(`${escaped}%`);
  }
  if (after) {
    sql += " AND modified_at >= ?";
    params.push(after);
  }
  if (before) {
    sql += " AND modified_at <= ?";
    params.push(before);
  }

  sql += " ORDER BY modified_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const stmt = db.prepare(sql);
  return stmt.all(...(params as [string])) as StoredSession[];
}

export function getSession(
  db: Database,
  sessionId: string,
): StoredSession | null {
  const stmt = db.prepare("SELECT * FROM sessions WHERE id = ?");
  const row = stmt.get(sessionId) as StoredSession | undefined;
  return row ?? null;
}

export function getStats(db: Database): {
  sessionCount: number;
  chunkCount: number;
  dbSizeBytes: number;
  lastSyncAt: string | null;
} {
  const sessionCountStmt = db.prepare("SELECT COUNT(*) as count FROM sessions");
  const chunkCountStmt = db.prepare("SELECT COUNT(*) as count FROM chunks");

  const sessionCount = (sessionCountStmt.get() as { count: number }).count;
  const chunkCount = (chunkCountStmt.get() as { count: number }).count;
  const lastSyncAt = getMetadata(db, "last_sync_at");

  // Get database file size
  const dbPath = db.location?.() ?? db.filename;
  let dbSizeBytes = 0;
  try {
    if (dbPath) {
      const stats = statSync(dbPath);
      dbSizeBytes = stats.size;
    }
  } catch {
    // If file doesn't exist or can't be read, size is 0
    void 0;
  }

  return { sessionCount, chunkCount, dbSizeBytes, lastSyncAt };
}

export function getMetadata(db: Database, key: string): string | null {
  const stmt = db.prepare("SELECT value FROM metadata WHERE key = ?");
  const row = stmt.get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setMetadata(db: Database, key: string, value: string): void {
  const stmt = db.prepare(`
    INSERT INTO metadata (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = datetime('now')
  `);

  stmt.run(key, value);
}

export function dropAll(db: Database): void {
  // Drop triggers first
  db.exec("DROP TRIGGER IF EXISTS chunks_ai");
  db.exec("DROP TRIGGER IF EXISTS chunks_ad");
  db.exec("DROP TRIGGER IF EXISTS chunks_au");

  // Drop indexes
  db.exec("DROP INDEX IF EXISTS idx_chunks_session");
  db.exec("DROP INDEX IF EXISTS idx_chunks_kind");
  db.exec("DROP INDEX IF EXISTS idx_chunks_tool");

  // Drop tables (FTS table first to avoid foreign key issues)
  db.exec("DROP TABLE IF EXISTS chunks_fts");
  db.exec("DROP TABLE IF EXISTS chunks");
  db.exec("DROP TABLE IF EXISTS sessions");
  db.exec("DROP TABLE IF EXISTS metadata");
  db.exec("DROP TABLE IF EXISTS schema_migrations");

  // Recreate schema and mark all migrations as applied
  db.exec(SCHEMA);
  runMigrations(db, true);
  ensurePostMigrationIndexes(db);
}
