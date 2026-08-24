import type { Database } from "../db";
import type { Migration } from "./index";

/**
 * Add the tool_call_args table for parameter-level tool filtering.
 *
 * Rows are extracted at index time from allowlisted tool call params (see
 * tool-arg-allowlist.ts), one row per (chunk, key). Existing sessions are
 * invalidated so the next `sesame index` re-parses and backfills them.
 *
 * Every statement is idempotent because the SCHEMA constant pre-creates the
 * final shape before migrations run on partially migrated databases.
 */
const migration: Migration = {
  id: 7,
  description: "add tool_call_args table for parameter filtering",
  fn: (db: Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tool_call_args (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chunk_id INTEGER NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        value TEXT NOT NULL
      );
    `);

    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_tool_call_args_chunk ON tool_call_args(chunk_id)",
    );
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_tool_call_args_key ON tool_call_args(key)",
    );

    // Args are extracted at index time. Invalidate stored mtimes so the next
    // `sesame index` re-parses every session instead of skipping it.
    db.exec("UPDATE sessions SET file_mtime = -1");
  },
};

export default migration;
