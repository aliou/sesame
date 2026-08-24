import type { Database } from "../db";
import type { Migration } from "./index";

/**
 * Add the global skill catalog (`skills`) and its FTS table (`skills_fts`).
 *
 * The catalog records skill description VERSIONS across all indexed
 * sessions: one row per distinct (name, description, path), never rewritten
 * except for last_seen_at. Fuzzy skill search (search --skill <text>) runs
 * BM25 over this catalog and then filters sessions by the matched names.
 *
 * Every statement is idempotent because the SCHEMA constant pre-creates the
 * final shape before migrations run on partially migrated databases.
 */
const migration: Migration = {
  id: 6,
  description: "add skills catalog table and skills_fts for fuzzy skill search",
  fn: (db: Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        path TEXT,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
        name,
        description,
        content='skills',
        content_rowid='id',
        tokenize='porter unicode61'
      );

      CREATE TRIGGER IF NOT EXISTS skills_ai AFTER INSERT ON skills BEGIN
        INSERT INTO skills_fts(rowid, name, description) VALUES (new.id, new.name, COALESCE(new.description, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS skills_ad AFTER DELETE ON skills BEGIN
        INSERT INTO skills_fts(skills_fts, rowid, name, description) VALUES('delete', old.id, old.name, COALESCE(old.description, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS skills_au AFTER UPDATE ON skills BEGIN
        INSERT INTO skills_fts(skills_fts, rowid, name, description) VALUES('delete', old.id, old.name, COALESCE(old.description, ''));
        INSERT INTO skills_fts(rowid, name, description) VALUES (new.id, new.name, COALESCE(new.description, ''));
      END;
    `);

    // The catalog is populated at index time. Invalidate stored mtimes so
    // the next `sesame index` re-parses every session instead of skipping it.
    db.exec(`UPDATE sessions SET file_mtime = -1`);
  },
};

export default migration;
