import { statSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

export type Database = DatabaseSync;

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
}

export interface StoredChunk {
  id: number;
  session_id: string;
  kind: string; // 'message' or 'tool_call'
  role: string | null;
  tool_name: string | null;
  seq: number;
  content: string;
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
}

export interface SearchOptions {
  cwd?: string;
  after?: string; // ISO date string
  before?: string; // ISO date string
  limit?: number; // default 10
  toolsOnly?: boolean;
  toolName?: string;
  pathFilter?: string;
  json?: boolean;
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
  file_mtime INTEGER
);

CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  role TEXT,
  tool_name TEXT,
  seq INTEGER,
  content TEXT NOT NULL
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

export function openDatabase(dbPath: string): Database {
  const db = new DatabaseSync(dbPath);

  // Enable WAL mode for better concurrency
  db.exec("PRAGMA journal_mode = WAL");

  // Enable foreign keys
  db.exec("PRAGMA foreign_keys = ON");

  // Create schema
  db.exec(SCHEMA);

  return db;
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
    `INSERT INTO sessions (id, source, path, cwd, name, created_at, modified_at, message_count, file_mtime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const insertChunkStmt = db.prepare(
    `INSERT INTO chunks (session_id, kind, role, tool_name, seq, content)
     VALUES (?, ?, ?, ?, ?, ?)`,
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
    );

    for (const chunk of chunks) {
      insertChunkStmt.run(
        chunk.session_id,
        chunk.kind,
        chunk.role,
        chunk.tool_name,
        chunk.seq,
        chunk.content,
      );
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function search(
  db: Database,
  query: string,
  options: SearchOptions = {},
): SearchResult[] {
  const {
    cwd,
    after,
    before,
    limit = 10,
    toolsOnly = false,
    toolName,
    pathFilter,
  } = options;

  const safeQuery = escapeFtsQuery(query);

  // First, get matching chunk IDs with scores from FTS
  const ftsQuery = `
    SELECT 
      rowid,
      bm25(chunks_fts) as score,
      snippet(chunks_fts, 0, '', '', '...', 32) as snippet
    FROM chunks_fts
    WHERE chunks_fts MATCH ?
  `;

  const ftsStmt = db.prepare(ftsQuery);
  const ftsResults = ftsStmt.all(safeQuery) as Array<{
    rowid: number;
    score: number;
    snippet: string;
  }>;

  if (ftsResults.length === 0) {
    return [];
  }

  // Build main query with filters
  const rowids = ftsResults.map((r) => r.rowid);
  const scoreMap = new Map(ftsResults.map((r) => [r.rowid, r]));

  let sql = `
    SELECT DISTINCT
      s.id as sessionId,
      s.source,
      s.path,
      s.cwd,
      s.name,
      s.created_at as createdAt,
      s.modified_at as modifiedAt,
      c.id as chunkId
    FROM chunks c
    JOIN sessions s ON s.id = c.session_id
    WHERE c.id IN (${rowids.map(() => "?").join(",")})
  `;

  const mainParams: unknown[] = [...rowids];

  if (cwd) {
    sql += " AND s.cwd LIKE ?";
    mainParams.push(`${cwd}%`);
  }

  if (after) {
    sql += " AND s.created_at >= ?";
    mainParams.push(after);
  }

  if (before) {
    sql += " AND s.created_at <= ?";
    mainParams.push(before);
  }

  if (toolsOnly) {
    sql += " AND c.kind = 'tool_call'";
  }

  if (toolName) {
    sql += " AND c.tool_name = ?";
    mainParams.push(toolName);
  }

  if (pathFilter) {
    sql += " AND c.kind = 'tool_call' AND c.content LIKE ?";
    mainParams.push(`%${pathFilter}%`);
  }

  const mainStmt = db.prepare(sql);
  const rows = mainStmt.all(...(mainParams as [string])) as Array<{
    sessionId: string;
    source: string;
    path: string;
    cwd: string | null;
    name: string | null;
    createdAt: string | null;
    modifiedAt: string | null;
    chunkId: number;
  }>;

  // Group by session and get best score
  const sessionMap = new Map<string, SearchResult>();

  for (const row of rows) {
    const scoreData = scoreMap.get(row.chunkId);
    if (!scoreData) continue;

    const existing = sessionMap.get(row.sessionId);
    if (!existing || scoreData.score < existing.score) {
      sessionMap.set(row.sessionId, {
        sessionId: row.sessionId,
        source: row.source,
        path: row.path,
        cwd: row.cwd,
        name: row.name,
        score: scoreData.score,
        createdAt: row.createdAt,
        modifiedAt: row.modifiedAt,
        matchedSnippet: scoreData.snippet,
      });
    }
  }

  // Sort by score and limit
  const results = Array.from(sessionMap.values())
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);

  return results;
}

export function getStats(db: Database): {
  sessionCount: number;
  chunkCount: number;
  dbSizeBytes: number;
} {
  const sessionCountStmt = db.prepare("SELECT COUNT(*) as count FROM sessions");
  const chunkCountStmt = db.prepare("SELECT COUNT(*) as count FROM chunks");

  const sessionCount = (sessionCountStmt.get() as { count: number }).count;
  const chunkCount = (chunkCountStmt.get() as { count: number }).count;

  // Get database file size
  const dbPath = db.location();
  let dbSizeBytes = 0;
  try {
    if (dbPath) {
      const stats = statSync(dbPath);
      dbSizeBytes = stats.size;
    }
  } catch {
    // If file doesn't exist or can't be read, size is 0
  }

  return { sessionCount, chunkCount, dbSizeBytes };
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

  // Recreate schema
  db.exec(SCHEMA);
}
