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

export interface StoredSkill {
  session_id: string;
  /** Skill directory name, e.g. "vitest". */
  name: string;
  /** Absolute path to SKILL.md, when known. */
  path: string | null;
  /** Actor who loaded this skill: user injected it, agent read it. */
  actor: "user" | "agent";
  /** How the skill was discovered: slash (user typed /skill), autocomplete, or null (read). */
  detail: "slash" | "autocomplete" | null;
}

/** A skill aggregated across the indexed sessions that used it. */
export interface SkillSummary {
  name: string;
  /** Number of distinct sessions that used the skill. */
  sessionCount: number;
  /** Actors seen for this skill: `user` or `agent`, or both. */
  actors: string[];
  /** How each actor discovered the skill, grouped by actor. */
  details: Array<{
    actor: "user" | "agent";
    details: ("slash" | "autocomplete" | null)[];
  }>;
  /** Known SKILL.md paths for this skill, most used first. */
  paths: string[];
}

export interface ListSkillsOptions {
  cwd?: string;
  after?: string;
  before?: string;
  /** Restrict to one usage actor. */
  actor?: "user" | "agent";
  limit?: number; // default 100
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
  /** Only sessions that used this skill (exact name, case-insensitive). */
  skill?: string;
  /** Only sessions that used a skill whose SKILL.md path contains this substring. */
  skillPath?: string;
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
  /** Only sessions that used this skill (exact name, case-insensitive). */
  skill?: string;
  /** Only sessions that used a skill whose SKILL.md path contains this substring. */
  skillPath?: string;
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

CREATE TABLE IF NOT EXISTS session_skills (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  path TEXT,
  actor TEXT NOT NULL,
  detail TEXT
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
CREATE INDEX IF NOT EXISTS idx_session_skills_session ON session_skills(session_id);
CREATE INDEX IF NOT EXISTS idx_session_skills_name ON session_skills(name);
CREATE INDEX IF NOT EXISTS idx_session_skills_path ON session_skills(path);
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
  // Depends on the actor column, which only exists after migration 005 has
  // run on databases that predate it.
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_session_skills_actor ON session_skills(actor)",
  );
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

/** Escape a literal so it can be used inside a `LIKE ... ESCAPE '\'` pattern. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/**
 * Build the SQL fragment and params for the skill filters.
 *
 * Uses a single EXISTS rather than a join so the filter composes with the
 * existing chunk joins without multiplying rows. Both `skill` and `skillPath`
 * constrain the *same* `session_skills` row, so combining them means "this
 * skill, loaded from this path".
 */
function skillFilterClause(
  options: Pick<SearchOptions, "skill" | "skillPath">,
  sessionAlias: string,
): { sql: string; params: unknown[] } {
  const predicates: string[] = [];
  const params: unknown[] = [];

  if (options.skill) {
    predicates.push("sk.name = ? COLLATE NOCASE");
    params.push(options.skill);
  }

  if (options.skillPath) {
    predicates.push("sk.path LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLike(options.skillPath)}%`);
  }

  if (predicates.length === 0) return { sql: "", params };

  return {
    sql: ` AND EXISTS (SELECT 1 FROM session_skills sk WHERE sk.session_id = ${sessionAlias}.id AND ${predicates.join(" AND ")})`,
    params,
  };
}

export function insertSession(
  db: Database,
  session: StoredSession,
  chunks: StoredChunk[],
  skills: StoredSkill[] = [],
): void {
  const insertSessionStmt = db.prepare(
    `INSERT INTO sessions (id, source, path, cwd, name, created_at, modified_at, message_count, file_mtime, parent_session_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const insertChunkStmt = db.prepare(
    `INSERT INTO chunks (session_id, kind, role, tool_name, seq, content, is_error, entry_id, parent_entry_id, timestamp, source_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const insertSkillStmt = db.prepare(
    `INSERT INTO session_skills (session_id, name, path, actor, detail)
     VALUES (?, ?, ?, ?, ?)`,
  );

  // Replace any existing row for this session so a re-index never leaves the
  // database with a deleted session and no replacement.
  const deleteSessionStmt = db.prepare("DELETE FROM sessions WHERE id = ?");

  db.exec("BEGIN");
  try {
    deleteSessionStmt.run(session.id);

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

    for (const skill of skills) {
      insertSkillStmt.run(
        skill.session_id,
        skill.name,
        skill.path,
        skill.actor,
        skill.detail,
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

  const skillFilter = skillFilterClause(options, "s");
  sql += skillFilter.sql;
  params.push(...skillFilter.params);

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
  const skillFilter = skillFilterClause(options, "s");
  sql += skillFilter.sql;
  params.push(...skillFilter.params);
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

  let sql = "SELECT s.* FROM sessions s WHERE 1=1";
  const params: unknown[] = [];

  if (cwd) {
    sql += " AND s.cwd LIKE ? ESCAPE '\\'";
    params.push(`${escapeLike(cwd)}%`);
  }
  if (after) {
    sql += " AND s.modified_at >= ?";
    params.push(after);
  }
  if (before) {
    sql += " AND s.modified_at <= ?";
    params.push(before);
  }

  const skillFilter = skillFilterClause(options, "s");
  sql += skillFilter.sql;
  params.push(...skillFilter.params);

  sql += " ORDER BY s.modified_at DESC LIMIT ? OFFSET ?";
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

/** Skills used by a single session, ordered by name. */
export function getSessionSkills(
  db: Database,
  sessionId: string,
): StoredSkill[] {
  const stmt = db.prepare(
    `SELECT session_id, name, path, actor, detail FROM session_skills
     WHERE session_id = ?
     ORDER BY name, actor`,
  );
  return stmt.all(sessionId) as StoredSkill[];
}

/** Skills used by several sessions at once, keyed by session ID. */
export function getSkillsForSessions(
  db: Database,
  sessionIds: string[],
): Map<string, StoredSkill[]> {
  const bySession = new Map<string, StoredSkill[]>();
  if (sessionIds.length === 0) return bySession;

  const placeholders = sessionIds.map(() => "?").join(",");
  const stmt = db.prepare(
    `SELECT session_id, name, path, actor, detail FROM session_skills
     WHERE session_id IN (${placeholders})
     ORDER BY name, actor`,
  );
  const rows = stmt.all(...(sessionIds as [string])) as StoredSkill[];

  for (const row of rows) {
    const existing = bySession.get(row.session_id);
    if (existing) {
      existing.push(row);
    } else {
      bySession.set(row.session_id, [row]);
    }
  }

  return bySession;
}

/**
 * List indexed skills with the number of sessions that used each one,
 * most used first.
 */
export function listIndexedSkills(
  db: Database,
  options: ListSkillsOptions = {},
): SkillSummary[] {
  const limit = Math.max(1, Math.min(options.limit ?? 100, 1000));

  let sql = `
    SELECT
      sk.name as name,
      COUNT(DISTINCT sk.session_id) as sessionCount,
      GROUP_CONCAT(DISTINCT sk.actor) as actors,
      GROUP_CONCAT(DISTINCT sk.actor || char(31) || COALESCE(sk.detail, '')) as detailPairs
    FROM session_skills sk
    JOIN sessions s ON s.id = sk.session_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  const scope = skillScopeClause(options);
  sql += scope.sql;
  params.push(...scope.params);

  sql += `
    GROUP BY sk.name
    ORDER BY sessionCount DESC, sk.name ASC
    LIMIT ?
  `;
  params.push(limit);

  const rows = db.prepare(sql).all(...(params as [string])) as Array<{
    name: string;
    sessionCount: number;
    actors: string | null;
    detailPairs: string | null;
  }>;

  const pathsByName = skillPathsByName(
    db,
    rows.map((row) => row.name),
    options,
  );

  return rows.map((row) => {
    const actors = (row.actors ?? "").split(",").filter(Boolean).sort();
    const detailsByActor = new Map<
      string,
      ("slash" | "autocomplete" | null)[]
    >();
    for (const pair of (row.detailPairs ?? "").split(",").filter(Boolean)) {
      const sep = pair.indexOf("\u001f");
      const actor = sep === -1 ? pair : pair.slice(0, sep);
      const rawDetail = sep === -1 ? "" : pair.slice(sep + 1);
      const detail = rawDetail ? (rawDetail as "slash" | "autocomplete") : null;
      const existing = detailsByActor.get(actor);
      if (existing) {
        if (!existing.includes(detail)) existing.push(detail);
      } else {
        detailsByActor.set(actor, [detail]);
      }
    }
    return {
      name: row.name,
      sessionCount: row.sessionCount,
      actors,
      details: [...detailsByActor.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([actor, details]) => ({
          actor: actor as "user" | "agent",
          details,
        })),
      paths: pathsByName.get(row.name) ?? [],
    };
  });
}

/**
 * Session-scope predicates shared by the skill aggregate and path queries,
 * so both see exactly the same set of `session_skills` rows.
 *
 * Expects `session_skills sk` joined to `sessions s`.
 */
function skillScopeClause(options: ListSkillsOptions): {
  sql: string;
  params: unknown[];
} {
  const { cwd, after, before, actor } = options;
  let sql = "";
  const params: unknown[] = [];

  if (cwd) {
    sql += " AND s.cwd LIKE ? ESCAPE '\\'";
    params.push(`${escapeLike(cwd)}%`);
  }
  if (after) {
    sql += " AND s.modified_at >= ?";
    params.push(after);
  }
  if (before) {
    sql += " AND s.modified_at <= ?";
    params.push(before);
  }
  if (actor) {
    sql += " AND sk.actor = ?";
    params.push(actor);
  }

  return { sql, params };
}

/** Distinct SKILL.md paths per skill name, most used first. */
function skillPathsByName(
  db: Database,
  names: string[],
  options: ListSkillsOptions,
): Map<string, string[]> {
  const byName = new Map<string, string[]>();
  if (names.length === 0) return byName;

  const placeholders = names.map(() => "?").join(",");
  const scope = skillScopeClause(options);
  const sql = `
    SELECT sk.name as name, sk.path as path, COUNT(DISTINCT sk.session_id) as sessionCount
    FROM session_skills sk
    JOIN sessions s ON s.id = sk.session_id
    WHERE sk.name IN (${placeholders}) AND sk.path IS NOT NULL
    ${scope.sql}
    GROUP BY sk.name, sk.path
    ORDER BY sessionCount DESC, sk.path ASC
  `;
  const params: unknown[] = [...names, ...scope.params];

  const rows = db.prepare(sql).all(...(params as [string])) as Array<{
    name: string;
    path: string;
  }>;

  for (const row of rows) {
    const existing = byName.get(row.name);
    if (existing) {
      existing.push(row.path);
    } else {
      byName.set(row.name, [row.path]);
    }
  }

  return byName;
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
  db.exec("DROP INDEX IF EXISTS idx_session_skills_session");
  db.exec("DROP INDEX IF EXISTS idx_session_skills_name");
  db.exec("DROP INDEX IF EXISTS idx_session_skills_path");
  db.exec("DROP INDEX IF EXISTS idx_session_skills_actor");

  // Drop tables (FTS table first to avoid foreign key issues)
  db.exec("DROP TABLE IF EXISTS chunks_fts");
  db.exec("DROP TABLE IF EXISTS chunks");
  db.exec("DROP TABLE IF EXISTS session_skills");
  db.exec("DROP TABLE IF EXISTS sessions");
  db.exec("DROP TABLE IF EXISTS metadata");
  db.exec("DROP TABLE IF EXISTS schema_migrations");

  // Recreate schema and mark all migrations as applied
  db.exec(SCHEMA);
  runMigrations(db, true);
  ensurePostMigrationIndexes(db);
}
